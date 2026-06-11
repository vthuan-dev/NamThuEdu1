<?php

namespace App\Http\Controllers;

use App\Models\Exam;
use App\Models\Question;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class KidsExamController extends Controller
{
    /**
     * Get all kids exam templates (Starters, Movers, Flyers)
     */
    public function getExamTypes()
    {
        $templates = DB::table('kids_exam_templates')->get();
        
        // Parse JSON config
        $templates = $templates->map(function($template) {
            $template->config = json_decode($template->config, true);
            return $template;
        });
        
        return response()->json($templates);
    }

    /**
     * Get all kids task type definitions
     */
    public function getTaskTypes(Request $request)
    {
        $query = DB::table('kids_task_definitions');
        
        $taskTypes = $query->get();
        
        // Parse JSON definition
        $taskTypes = $taskTypes->map(function($task) use ($request) {
            $task->definition = json_decode($task->definition, true);
            
            // Filter by level if provided
            if ($request->has('level')) {
                $level = $request->level;
                if (!in_array($level, $task->definition['applicable_levels'] ?? [])) {
                    return null;
                }
            }
            
            // Filter by skill if provided
            if ($request->has('skill')) {
                if (($task->definition['skill'] ?? '') !== $request->skill) {
                    return null;
                }
            }
            
            return $task;
        })->filter();
        
        return response()->json($taskTypes->values());
    }

    /**
     * Get single task type definition
     */
    public function getTaskType($code)
    {
        $taskType = DB::table('kids_task_definitions')->where('code', $code)->first();
        
        if (!$taskType) {
            return response()->json(['message' => 'Task type not found'], 404);
        }
        
        $taskType->definition = json_decode($taskType->definition, true);
        
        return response()->json($taskType);
    }

    /**
     * Create kids exam using flexible JSON schema
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'eTitle' => 'required|string|max:255',
            'exam_type_code' => 'required|string', // yle_starters, yle_movers, yle_flyers
            'eDescription' => 'nullable|string',
            'eDuration' => 'nullable|integer',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Get exam template config
        $template = DB::table('kids_exam_templates')
            ->where('code', $request->exam_type_code)
            ->first();

        if (!$template) {
            return response()->json(['message' => 'Invalid exam type'], 422);
        }

        $templateConfig = json_decode($template->config, true);

        // Create exam with kids_exam_config JSON
        $exam = Exam::create([
            'eTitle' => $request->eTitle,
            'eDescription' => $request->eDescription,
            'eDuration' => $request->eDuration,
            'age_group' => 'kids',
            'eType' => 'GENERAL', // Kids (Cambridge YLE) — KHÔNG phải VSTEP; tránh default 'VSTEP' của cột eType
            'eTeacher_id' => auth()->id(),
            'eStatus' => 'draft',
            'kids_exam_config' => [
                'exam_type' => $request->exam_type_code,
                'mode' => $request->mode ?? 'flexible', // Add mode field
                'scope' => $request->scope ?? 'full', // Phạm vi: full | skill | part
                'scope_skill' => $request->scope_skill, // listening | reading_writing | speaking
                'scope_part' => $request->scope_part, // số part trong kỹ năng (khi scope=part)
                'level' => $templateConfig['level'],
                'age_range' => $templateConfig['age_range'],
                'vocabulary_size' => $templateConfig['vocabulary_size'],
                'skills' => $templateConfig['skills'],
                'parts' => $templateConfig['parts'],
            ],
        ]);

        return response()->json([
            'message' => 'Kids exam created successfully',
            'exam' => $exam
        ], 201);
    }

    /**
     * Get kids exams
     */
    public function index(Request $request)
    {
        $user = auth()->user();

        // Hiển thị:
        // 1) Đề kids của chính giáo viên này
        // 2) Đề kids public (eIs_private=false) đã published của giáo viên khác
        $query = Exam::where('age_group', 'kids')
            ->where(function($outer) use ($user) {
                $outer->where('eTeacher_id', $user->uId)
                      ->orWhere(function($pub) use ($user) {
                          $pub->where('eTeacher_id', '!=', $user->uId)
                              ->where(function($p) {
                                  $p->whereNull('eIs_private')
                                    ->orWhere('eIs_private', false);
                              })
                              ->where('eStatus', 'published');
                      });
            })
            ->with(['questions', 'teacher:uId,uName,uPhone']);

        if ($request->has('exam_type')) {
            $query->whereRaw("JSON_EXTRACT(kids_exam_config, '$.exam_type') = ?", [$request->exam_type]);
        }

        $exams = $query->orderBy('eCreated_at', 'desc')->get();
        
        // Map kids_exam_type_id to exam_type code for backward compatibility
        // Bảng kids_exam_types có thể chưa tồn tại nếu seeder chưa chạy → safe-guard
        $kidsExamTypes = collect();
        if (\Schema::hasTable('kids_exam_types')) {
            $kidsExamTypes = \DB::table('kids_exam_types')->get()->keyBy('id');
        }
        
        $exams->each(function($exam) use ($kidsExamTypes, $user) {
            if ($exam->kids_exam_config && $kidsExamTypes->isNotEmpty()) {
                $config = $exam->kids_exam_config;
                
                // If exam_type is missing but kids_exam_type_id exists, populate it
                if (empty($config['exam_type']) && !empty($config['kids_exam_type_id'])) {
                    $typeId = $config['kids_exam_type_id'];
                    if (isset($kidsExamTypes[$typeId])) {
                        $config['exam_type'] = $kidsExamTypes[$typeId]->code;
                        $exam->kids_exam_config = $config;
                    }
                }
            }

            // Owner metadata
            $isOwner = (int)$exam->eTeacher_id === (int)$user->uId;
            $exam->_is_owner = $isOwner;
            $exam->_owner_name = $isOwner
                ? 'Bạn'
                : ($exam->teacher->uName ?? 'Giáo viên khác');
        });
        
        return response()->json($exams);
    }

    /**
     * Get single kids exam
     */
    public function show($id)
    {
        $exam = Exam::where('age_group', 'kids')
            ->where('eId', $id)
            ->with('questions')
            ->first();

        if (!$exam) {
            return response()->json(['message' => 'Exam not found'], 404);
        }

        // Get media for this exam
        $media = DB::table('kids_media')
            ->where('exam_id', $id)
            ->get()
            ->groupBy('question_id');

        // Attach media to exam
        $exam->media = $media->get(null, collect([])); // Exam-level media
        
        // Attach media to each question
        if ($exam->questions) {
            foreach ($exam->questions as $question) {
                $question->media = $media->get($question->qId, collect([]));
            }
        }

        return response()->json($exam);
    }

    /**
     * Update kids exam
     */
    public function update(Request $request, $id)
    {
        $exam = Exam::where('age_group', 'kids')
            ->where('eId', $id)
            ->where('eTeacher_id', auth()->id())
            ->first();

        if (!$exam) {
            return response()->json(['message' => 'Exam not found'], 404);
        }

        $updateData = [];
        if ($request->has('eTitle')) $updateData['eTitle'] = $request->eTitle;
        if ($request->has('eDescription')) $updateData['eDescription'] = $request->eDescription;
        if ($request->has('eDuration')) $updateData['eDuration'] = $request->eDuration;
        if ($request->has('eStatus')) $updateData['eStatus'] = $request->eStatus;

        // Update mode in kids_exam_config if provided
        if ($request->has('mode')) {
            $config = $exam->kids_exam_config ?? [];
            $config['mode'] = $request->mode;
            $updateData['kids_exam_config'] = $config;
        }

        // Update scope (phạm vi đề) in kids_exam_config if provided
        if ($request->has('scope') || $request->has('scope_skill') || $request->has('scope_part')) {
            $config = $updateData['kids_exam_config'] ?? ($exam->kids_exam_config ?? []);
            if ($request->has('scope')) $config['scope'] = $request->scope;
            if ($request->has('scope_skill')) $config['scope_skill'] = $request->scope_skill;
            if ($request->has('scope_part')) $config['scope_part'] = $request->scope_part;
            $updateData['kids_exam_config'] = $config;
        }

        $exam->update($updateData);

        return response()->json([
            'message' => 'Exam updated successfully',
            'exam' => $exam
        ]);
    }

    /**
     * Delete kids exam
     */
    public function destroy($id)
    {
        $exam = Exam::where('age_group', 'kids')
            ->where('eId', $id)
            ->where('eTeacher_id', auth()->id())
            ->first();

        if (!$exam) {
            return response()->json(['message' => 'Exam not found'], 404);
        }

        $exam->delete();

        return response()->json(['message' => 'Exam deleted successfully']);
    }

    /**
     * Add question to kids exam using flexible JSON schema
     */
    public function addQuestion(Request $request, $examId)
    {
        $exam = Exam::where('age_group', 'kids')
            ->where('eId', $examId)
            ->where('eTeacher_id', auth()->id())
            ->first();

        if (!$exam) {
            return response()->json(['message' => 'Exam not found'], 404);
        }

        $validator = Validator::make($request->all(), [
            'task_type_code' => 'required|string',
            'task_data' => 'required|array',
            'qContent' => 'nullable|string',
            'qPoints' => 'nullable|integer',
            'part' => 'nullable|integer',      // Main part (1, 2, 3)
            'subPart' => 'nullable|integer',   // Cambridge sub-part
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Get task definition
        $taskDef = DB::table('kids_task_definitions')
            ->where('code', $request->task_type_code)
            ->first();

        if (!$taskDef) {
            return response()->json(['message' => 'Invalid task type'], 422);
        }

        $taskDefinition = json_decode($taskDef->definition, true);

        // Create question with kids_task_config JSON
        $question = Question::create([
            'exam_id' => $examId,
            'qContent' => $request->qContent,
            'qPoints' => $request->qPoints ?? 1,
            'qType' => 'kids_task',
            'qPart' => $request->part ?? 1,           // Main part
            'qSubPart' => $request->subPart,          // Cambridge sub-part (nullable)
            'kids_task_config' => [
                'task_type' => $request->task_type_code,
                'task_name' => $taskDef->name,
                'skill' => $taskDefinition['skill'],
                'instructions' => $taskDefinition['instructions'],
                'task_data' => $request->task_data,
            ],
        ]);

        return response()->json([
            'message' => 'Question added successfully',
            'question' => $question
        ], 201);
    }

    /**
     * Update question
     */
    public function updateQuestion(Request $request, $examId, $questionId)
    {
        $exam = Exam::where('age_group', 'kids')
            ->where('eId', $examId)
            ->where('eTeacher_id', auth()->id())
            ->first();

        if (!$exam) {
            return response()->json(['message' => 'Exam not found'], 404);
        }

        $question = Question::where('exam_id', $examId)
            ->where('qId', $questionId)
            ->first();

        if (!$question) {
            return response()->json(['message' => 'Question not found'], 404);
        }

        $updateData = [];
        if ($request->has('qContent')) $updateData['qContent'] = $request->qContent;
        if ($request->has('qPoints')) $updateData['qPoints'] = $request->qPoints;
        if ($request->has('task_data')) {
            $config = $question->kids_task_config ?? [];
            $config['task_data'] = $request->task_data;
            $updateData['kids_task_config'] = $config;
        }

        $question->update($updateData);

        return response()->json([
            'message' => 'Question updated successfully',
            'question' => $question
        ]);
    }

    /**
     * Delete question
     */
    public function deleteQuestion($examId, $questionId)
    {
        $exam = Exam::where('age_group', 'kids')
            ->where('eId', $examId)
            ->where('eTeacher_id', auth()->id())
            ->first();

        if (!$exam) {
            return response()->json(['message' => 'Exam not found'], 404);
        }

        $question = Question::where('exam_id', $examId)
            ->where('qId', $questionId)
            ->first();

        if (!$question) {
            return response()->json(['message' => 'Question not found'], 404);
        }

        $question->delete();

        return response()->json(['message' => 'Question deleted successfully']);
    }

    /**
     * Get media for exam (without question_id)
     */
    public function getExamMedia($examId)
    {
        $media = DB::table('kids_media')
            ->where('exam_id', $examId)
            ->whereNull('question_id')
            ->get()
            ->map(function($item) {
                // Convert relative URL to full URL
                $item->file_url = url($item->file_url);
                return $item;
            });

        return response()->json([
            'media' => $media
        ]);
    }

    /**
     * Upload media (audio/image)
     */
    public function uploadMedia(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|max:20480', // 20MB max (was 10MB)
            'media_type' => 'required|in:audio,image',
            'exam_id' => 'nullable|exists:exams,eId',
            'question_id' => 'nullable|exists:questions,qId',
        ]);

        if ($validator->fails()) {
            \Log::error('Upload validation failed', [
                'errors' => $validator->errors()->toArray(),
                'request' => $request->except('file')
            ]);
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $file = $request->file('file');
        $mediaType = $request->media_type;
        
        // Validate file type
        if ($mediaType === 'audio') {
            $allowedMimes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-m4a', 'audio/mp4', 'audio/ogg', 'audio/webm'];
        } else {
            $allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
        }

        if (!in_array($file->getMimeType(), $allowedMimes)) {
            \Log::error('Invalid file type', [
                'mime_type' => $file->getMimeType(),
                'media_type' => $mediaType,
                'allowed' => $allowedMimes
            ]);
            return response()->json([
                'message' => 'Invalid file type', 
                'mime_type' => $file->getMimeType(),
                'allowed' => $allowedMimes
            ], 422);
        }

        // Store file
        $path = $file->store("kids-exams/{$mediaType}s", 'public');
        $url = Storage::url($path);
        $fullUrl = url($url); // Convert to full URL

        // Save to database
        $media = DB::table('kids_media')->insertGetId([
            'exam_id' => $request->exam_id,
            'question_id' => $request->question_id,
            'media_type' => $mediaType,
            'file_url' => $url,
            'file_name' => $file->getClientOriginalName(),
            'file_size' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => 'Media uploaded successfully',
            'media' => [
                'id' => $media,
                'url' => $fullUrl,
                'type' => $mediaType,
                'name' => $file->getClientOriginalName(),
            ]
        ], 201);
    }

    /**
     * Delete media
     */
    public function deleteMedia($id)
    {
        // For now, just delete from storage
        // Media URLs are stored in JSON, not in separate table
        return response()->json(['message' => 'Media deletion not implemented yet'], 501);
    }
}

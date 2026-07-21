<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use App\Models\Exam;
use App\Models\Question;
use App\Models\Answer;

class ExamController extends Controller
{
    /**
     * @OA\Get(
     *     path="/teacher/exams",
     *     tags={"Exams"},
     *     summary="Get teacher exams",
     *     description="Get list of exams created by authenticated teacher",
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(
     *         response=200,
     *         description="Exams retrieved successfully"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
     * 
     * GET /api/teacher/exams
     * Lấy danh sách bài thi của teacher
     */
    public function index(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        // Giáo viên có TOÀN QUYỀN với mọi đề: hiển thị TẤT CẢ đề (của mình và của giáo viên khác),
        // mọi trạng thái/visibility, trừ đề mục đích luyện tập (practice).
        $query = Exam::where(function($q) {
                        $q->whereNull('ePurpose')
                          ->orWhere('ePurpose', '!=', 'practice');
                    })
                    ->with(['teacher:uId,uName,uPhone'])
                    ->withCount('questions');

        // Filter theo group: vstep_full | ielts_full | adult | kids | teens
        // NOTE: vstep_full và ielts_full hiện gom CẢ đề full lẫn skill riêng (Listening/Reading/Writing/Speaking)
        // để giáo viên thấy được tất cả đề loại đó trong "Ngân hàng đề thi"
        if ($request->has('group')) {
            switch ($request->group) {
                case 'vstep_full':
                case 'vstep':
                    $query->where('eType', 'VSTEP');
                    break;
                case 'ielts_full':
                case 'ielts':
                    $query->where('eType', 'IELTS');
                    break;
                case 'kids':
                    $query->where('age_group', 'kids');
                    break;
                case 'teens':
                    $query->where('age_group', 'teens');
                    break;
                case 'adults':
                case 'adult':
                    $query->where(function($q) {
                        // age_group nằm trong: adults | adult | all | null
                        $q->where('age_group', 'adults')
                          ->orWhere('age_group', 'adult')
                          ->orWhere('age_group', 'all')
                          ->orWhereNull('age_group');
                    })->where(function($q) {
                        // Loại trừ VSTEP/IELTS đã filter ở nhóm khác để tránh duplicate
                        $q->where('eType', '!=', 'VSTEP')
                          ->where('eType', '!=', 'IELTS')
                          ->orWhereNull('eType');
                    });
                    break;
            }
        }

        $exams = $query->orderBy('eCreated_at', 'desc')->get();

        // Gắn metadata owner để frontend hiển thị badge "Của tôi" / tên giáo viên khác
        $exams->transform(function ($exam) use ($user) {
            $isOwner = (int)$exam->eTeacher_id === (int)$user->uId;
            $exam->_is_owner = $isOwner;
            $exam->_owner_name = $isOwner
                ? 'Bạn'
                : ($exam->teacher->uName ?? 'Giáo viên khác');
            return $exam;
        });

        return response()->json([
            'status' => 'success',
            'data' => $exams
        ]);
    }

    /**
     * @OA\Post(
     *     path="/teacher/exams",
     *     tags={"Exams"},
     *     summary="Create new exam",
     *     description="Create a new exam (teacher only)",
     *     security={{"bearerAuth":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"eTitle","eType"},
     *             @OA\Property(property="eTitle", type="string", example="VSTEP Practice Test"),
     *             @OA\Property(property="eDescription", type="string", example="Practice test for VSTEP preparation"),
     *             @OA\Property(property="eType", type="string", example="VSTEP"),
     *             @OA\Property(property="eSkill", type="string", example="listening"),
     *             @OA\Property(property="eDuration", type="integer", example=90),
     *             @OA\Property(property="eTotal_score", type="integer", example=100)
     *         )
     *     ),
     *     @OA\Response(response=201, description="Exam created successfully"),
     *     @OA\Response(response=400, description="Validation error")
     * )
     * 
     * POST /api/teacher/exams
     * Tạo bài thi mới
     */
    public function store(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        if ($request->has('eSkill')) {
            $request->merge([
                'eSkill' => strtolower($request->eSkill) 
            ]);
        }

        $validator = Validator::make($request->all(), [
            'eTitle' => 'required|string|max:255',
            'eDescription' => 'nullable|string',
            'eType' => 'required|in:VSTEP,IELTS,GENERAL,THPT',
            'eSkill' => 'required|in:listening,reading,writing,speaking,mixed',
            'eScope' => 'nullable|in:full,skill,part',
            'ePart_type' => 'nullable|string|max:64',
            'ePart_number' => 'nullable|integer|min:1|max:99',
            'eDuration_minutes' => 'required|integer|min:1',
            'eIs_private' => 'nullable|boolean',
            'eSource_type' => 'nullable|in:manual,upload',
            'age_group' => 'nullable|in:kids,teens,adults,all',
            // New flexible format
            'content_blocks' => 'nullable|array',
            'content_blocks.*.block_type' => 'required_with:content_blocks|in:passage,audio,video,image,instruction',
            'content_blocks.*.content' => 'nullable|string',
            'content_blocks.*.metadata' => 'nullable|array',
            'content_blocks.*.display_order' => 'nullable|integer',
            'questions' => 'nullable|array',
            'questions.*.qType' => 'required_with:questions|string',
            'questions.*.qContent' => 'required_with:questions|string',
            'questions.*.qPoints' => 'nullable|integer',
            'questions.*.qData' => 'nullable|array',
            'questions.*.content_block_id' => 'nullable|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        \DB::beginTransaction();
        try {
            // 1. Create exam
            $ePurpose = null;
            $scope = $request->input('eScope') ?: ($request->eSkill === 'mixed' ? 'full' : 'skill');

            // Trạng thái khởi tạo dựa trên cài đặt auto-duyệt (dùng helper chung)
            $initialStatus = Exam::resolveModerationStatus();

            $exam = Exam::create([
                'eTitle' => $request->eTitle,
                'eDescription' => $request->eDescription,
                'eType' => $request->eType,
                'eSkill' => $request->eSkill,
                'eScope' => $scope,
                'ePart_type' => $scope === 'part' ? $request->input('ePart_type') : null,
                'ePart_number' => $scope === 'part' ? $request->input('ePart_number') : null,
                'eTeacher_id' => $user->uId,
                'eDuration_minutes' => $request->eDuration_minutes,
                'eIs_private' => $request->eIs_private ?? false,
                'eSource_type' => $request->eSource_type ?? 'manual',
                'age_group' => $request->age_group ?? 'all',
                'ePurpose' => $ePurpose,
                'eStatus' => $initialStatus,  // Trạng thái dựa trên cài đặt admin
            ]);

            // 2. Create content blocks (if provided)
            $contentBlockMap = [];
            if ($request->has('content_blocks')) {
                foreach ($request->content_blocks as $index => $blockData) {
                    $block = \App\Models\ContentBlock::create([
                        'exam_id' => $exam->eId,
                        'block_type' => $blockData['block_type'],
                        'content' => $blockData['content'] ?? null,
                        'metadata' => $blockData['metadata'] ?? null,
                        'display_order' => $blockData['display_order'] ?? ($index + 1),
                    ]);
                    
                    // Map index (1-based) to block id
                    $contentBlockMap[$index + 1] = $block->id;
                }
            }

            // 3. Create questions (if provided)
            if ($request->has('questions')) {
                foreach ($request->questions as $qIndex => $questionData) {
                    // Resolve content_block_id (support both index and actual id)
                    $contentBlockId = null;
                    if (isset($questionData['content_block_id'])) {
                        $cbId = $questionData['content_block_id'];
                        // If it's a small number (1-10), treat as index
                        if ($cbId <= 10 && isset($contentBlockMap[$cbId])) {
                            $contentBlockId = $contentBlockMap[$cbId];
                        } else {
                            $contentBlockId = $cbId;
                        }
                    }
                    
                    $question = \App\Models\Question::create([
                        'exam_id' => $exam->eId,
                        'content_block_id' => $contentBlockId,
                        'qType' => $questionData['qType'],
                        'qContent' => $questionData['qContent'],
                        'qPoints' => $questionData['qPoints'] ?? 1,
                        'qData' => $questionData['qData'] ?? null,
                        'age_group' => $questionData['age_group'] ?? $exam->age_group,
                        'qSection_order' => $qIndex + 1,
                    ]);
                    
                    // 4. Create answers from qData (if options provided)
                    if (isset($questionData['qData']['options'])) {
                        foreach ($questionData['qData']['options'] as $aIndex => $option) {
                            $isCorrect = false;
                            if (isset($questionData['qData']['correct_answer'])) {
                                $correctAnswer = $questionData['qData']['correct_answer'];
                                // Support both id-based and index-based correct answer
                                $isCorrect = ($option['id'] == $correctAnswer) || ($aIndex == $correctAnswer);
                            }
                            
                            \App\Models\Answer::create([
                                'question_id' => $question->qId,
                                'aText' => $option['text'],
                                'aIs_correct' => $isCorrect,
                                'aOrder' => $aIndex,
                            ]);
                        }
                    }
                }
            }

            \DB::commit();

            // Load relationships
            $exam->load(['contentBlocks', 'questions.answers']);

            return response()->json([
                'status' => 'success',
                'data' => $exam
            ]);

        } catch (\Exception $e) {
            \DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi khi tạo đề thi: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * @OA\Get(
     *     path="/teacher/exams/{id}",
     *     tags={"Exams"},
     *     summary="Get exam details",
     *     description="Get detailed information about a specific exam",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer"),
     *         example=1
     *     ),
     *     @OA\Response(response=200, description="Exam details retrieved successfully"),
     *     @OA\Response(response=404, description="Exam not found")
     * )
     * 
     * GET /api/teacher/exams/{id}
     * Lấy chi tiết bài thi với câu hỏi và đáp án
     */
    public function show(Request $request, $id)
    {
        $exam = Exam::where('eId', $id)
                   ->with([
                       'contentBlocks' => function($q) {
                           $q->orderBy('display_order');
                       },
                       'questions' => function($q) {
                           $q->orderBy('qOrder');
                       },
                       'questions.answers',
                       'questions.contentBlock'
                   ])
                   ->first();

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài thi.'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $exam
        ]);
    }

    /**
     * @OA\Put(
     *     path="/teacher/exams/{id}",
     *     tags={"Exams"},
     *     summary="Update exam",
     *     description="Update exam information",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             @OA\Property(property="eTitle", type="string"),
     *             @OA\Property(property="eDescription", type="string"),
     *             @OA\Property(property="eDuration", type="integer")
     *         )
     *     ),
     *     @OA\Response(response=200, description="Exam updated successfully"),
     *     @OA\Response(response=404, description="Exam not found")
     * )
     * 
     * PUT /api/teacher/exams/{id}
     * Cập nhật thông tin bài thi
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $exam = Exam::where('eId', $id)
                   
                   ->first();

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài thi.'
            ], 404);
        }

        if ($request->has('eSkill')) {
            $request->merge([
                'eSkill' => strtolower($request->eSkill)
            ]);
        }

        $validator = Validator::make($request->all(), [
            'eTitle' => 'sometimes|required|string|max:255',
            'eDescription' => 'nullable|string',
            'eType' => 'sometimes|required|in:VSTEP,IELTS,GENERAL',
            'eSkill' => 'sometimes|required|in:listening,reading,writing,speaking,mixed',
            'eScope' => 'nullable|in:full,skill,part',
            'ePart_type' => 'nullable|string|max:64',
            'ePart_number' => 'nullable|integer|min:1|max:99',
            'eDuration_minutes' => 'sometimes|required|integer|min:1',
            'eIs_private' => 'nullable|boolean',
            'eSource_type' => 'nullable|in:manual,upload',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        $exam->update($request->only([
            'eTitle', 'eDescription', 'eType', 'eSkill', 
            'eScope', 'ePart_type', 'ePart_number',
            'eDuration_minutes', 'eIs_private', 'eSource_type'
        ]));

        return response()->json([
            'status' => 'success',
            'data' => [
                'message' => 'Cập nhật bài thi thành công'
            ]
        ]);
    }

    /**
     * @OA\Delete(
     *     path="/teacher/exams/{id}",
     *     tags={"Exams"},
     *     summary="Delete exam",
     *     description="Delete an exam (soft delete)",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=200, description="Exam deleted successfully"),
     *     @OA\Response(response=404, description="Exam not found")
     * )
     * 
     * DELETE /api/teacher/exams/{id}
     * Xóa bài thi (soft delete)
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $exam = Exam::where('eId', $id)
                   
                   ->first();

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài thi.'
            ], 404);
        }

        $exam->delete();

        return response()->json([
            'status' => 'success',
            'data' => [
                'message' => 'Xóa bài thi thành công'
            ]
        ]);
    }

    /**
     * @OA\Post(
     *     path="/teacher/exams/{id}/questions",
     *     tags={"Exams"},
     *     summary="Add questions to exam",
     *     description="Add multiple questions to an exam",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             @OA\Property(
     *                 property="questions",
     *                 type="array",
     *                 @OA\Items(
     *                     @OA\Property(property="qText", type="string"),
     *                     @OA\Property(property="qType", type="string"),
     *                     @OA\Property(property="qScore", type="integer")
     *                 )
     *             )
     *         )
     *     ),
     *     @OA\Response(response=201, description="Questions added successfully"),
     *     @OA\Response(response=400, description="Validation error")
     * )
     * 
     * POST /api/teacher/exams/{id}/questions
     * Thêm câu hỏi vào bài thi (hàng loạt)
     */
    public function addQuestions(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $exam = Exam::where('eId', $id)
                   
                   ->first();

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài thi.'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'questions' => 'required|array|min:1',
            'questions.*.qContent' => 'required|string',
            'questions.*.qPoints' => 'required|integer|min:0',
            'questions.*.qSection' => 'nullable|string|in:listening,reading,writing,speaking',
            'questions.*.qSkill' => 'nullable|string|in:listening,reading,writing,speaking',
            'questions.*.qPart' => 'nullable|integer|min:1|max:5',
            'questions.*.qMedia_url' => 'nullable|string',
            'questions.*.qAudio_duration' => 'nullable|integer|min:1|max:3600',
            'questions.*.qTranscript' => 'nullable|string',
            'questions.*.qExplanation' => 'nullable|string',
            'questions.*.qListen_limit' => 'nullable|integer|min:1',
            'questions.*.qPassage_text' => 'nullable|string',
            'questions.*.qWord_count' => 'nullable|integer|min:1',
            'questions.*.qTime_limit' => 'nullable|integer|min:1',
            'questions.*.answers' => 'required|array|min:1',
            'questions.*.answers.*.aContent' => 'required|string',
            'questions.*.answers.*.aIs_correct' => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        // Validate each question has at least one correct answer
        $invalidQuestions = [];
        foreach ($request->questions as $index => $questionData) {
            $hasCorrectAnswer = false;
            foreach ($questionData['answers'] as $answer) {
                if ($answer['aIs_correct']) {
                    $hasCorrectAnswer = true;
                    break;
                }
            }
            if (!$hasCorrectAnswer) {
                $invalidQuestions[] = $index + 1;
            }
        }

        if (!empty($invalidQuestions)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Mỗi câu hỏi phải có ít nhất một đáp án đúng.',
                'invalidQuestions' => $invalidQuestions
            ], 400);
        }

        // Remove transaction for now to avoid savepoint issues in tests
        try {
            $questionsAdded = 0;

            foreach ($request->questions as $questionData) {
                $question = Question::create([
                    'exam_id' => $id,
                    'qContent' => $questionData['qContent'],
                    'qPoints' => $questionData['qPoints'],
                    'qMedia_url' => $questionData['qMedia_url'] ?? null,
                    'qTranscript' => $questionData['qTranscript'] ?? null,
                    'qExplanation' => $questionData['qExplanation'] ?? null,
                    'qListen_limit' => $questionData['qListen_limit'] ?? 1,
                ]);

                foreach ($questionData['answers'] as $answerData) {
                    Answer::create([
                        'question_id' => $question->qId,
                        'aContent' => $answerData['aContent'],
                        'aIs_correct' => $answerData['aIs_correct'],
                    ]);
                }

                $questionsAdded++;
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Thêm câu hỏi thành công',
                'data' => [
                    'added_questions_count' => $questionsAdded
                ]
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi hệ thống khi thêm câu hỏi.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * @OA\Put(
     *     path="/teacher/exams/{examId}/questions/{questionId}",
     *     tags={"Exams"},
     *     summary="Update question in exam",
     *     description="Update a specific question in an exam",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="examId",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Parameter(
     *         name="questionId",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=200, description="Question updated successfully")
     * )
     * 
     * PUT /api/teacher/exams/{examId}/questions/{questionId}
     * Cập nhật câu hỏi
     */
    public function updateQuestion(Request $request, $examId, $questionId)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $exam = Exam::where('eId', $examId)
                   
                   ->first();

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài thi.'
            ], 404);
        }

        $question = Question::where('qId', $questionId)
                           ->where('exam_id', $examId)
                           ->first();

        if (!$question) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy câu hỏi.'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'qContent' => 'sometimes|required|string',
            'qPoints' => 'sometimes|required|integer|min:0',
            'qMedia_url' => 'nullable|string',
            'qTranscript' => 'nullable|string',
            'qExplanation' => 'nullable|string',
            'qListen_limit' => 'nullable|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        $question->update($request->only([
            'qContent', 'qPoints', 'qMedia_url', 
            'qTranscript', 'qExplanation', 'qListen_limit'
        ]));

        return response()->json([
            'status' => 'success',
            'data' => [
                'message' => 'Cập nhật câu hỏi thành công'
            ]
        ]);
    }

    /**
     * DELETE /api/teacher/exams/{examId}/questions/{questionId}
     * Xóa câu hỏi
     */
    public function deleteQuestion(Request $request, $examId, $questionId)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $exam = Exam::where('eId', $examId)
                   
                   ->first();

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài thi.'
            ], 404);
        }

        $question = Question::where('qId', $questionId)
                           ->where('exam_id', $examId)
                           ->first();

        if (!$question) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy câu hỏi.'
            ], 404);
        }

        // Delete answers first (cascade)
        Answer::where('question_id', $questionId)->delete();
        $question->delete();

        return response()->json([
            'status' => 'success',
            'data' => [
                'message' => 'Xóa câu hỏi thành công'
            ]
        ]);
    }

    /**
     * GET /api/teacher/exams/{id}/sections
     * Xem cấu trúc sections của đề thi
     */
    /**
     * @OA\Get(
     *     path="/teacher/exams/{id}/sections",
     *     tags={"Exams"},
     *     summary="Get exam sections",
     *     description="Get exam structure organized by sections (listening, reading, writing, speaking)",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=200, description="Exam sections retrieved successfully"),
     *     @OA\Response(response=404, description="Exam not found")
     * )
     */
    public function sections(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $exam = Exam::where('eId', $id)
                   
                   ->with(['questions.answers'])
                   ->first();

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài thi.'
            ], 404);
        }

        // Organize questions by sections based on exam type
        $sections = $this->organizeQuestionsBySection($exam);

        return response()->json([
            'status' => 'success',
            'data' => [
                'exam' => [
                    'eId' => $exam->eId,
                    'eTitle' => $exam->eTitle,
                    'eType' => $exam->eType,
                    'eDuration_minutes' => $exam->eDuration_minutes,
                ],
                'sections' => $sections,
                'total_questions' => $exam->questions->count(),
                'total_points' => $exam->questions->sum('qPoints'),
            ]
        ]);
    }

    /**
     * POST /api/teacher/exams/{id}/clone
     * Nhân bản đề thi
     */
    /**
     * @OA\Post(
     *     path="/teacher/exams/{id}/clone",
     *     tags={"Exams"},
     *     summary="Clone exam",
     *     description="Create a copy of an existing exam with all questions and answers",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\RequestBody(
     *         required=false,
     *         @OA\JsonContent(
     *             @OA\Property(property="eTitle", type="string", example="Copy of Original Exam"),
     *             @OA\Property(property="eDescription", type="string", example="Cloned exam description")
     *         )
     *     ),
     *     @OA\Response(response=201, description="Exam cloned successfully"),
     *     @OA\Response(response=404, description="Exam not found")
     * )
     */
    public function clone(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $originalExam = Exam::where('eId', $id)
                           
                           ->with(['questions.answers'])
                           ->first();

        if (!$originalExam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài thi.'
            ], 404);
        }

        // Remove transaction for now to avoid savepoint issues in tests
        try {
            // Clone exam
            $newExam = Exam::create([
                'eTitle' => $request->eTitle ?? 'Copy of ' . $originalExam->eTitle,
                'eDescription' => $request->eDescription ?? $originalExam->eDescription,
                'eType' => $originalExam->eType,
                'eSkill' => $originalExam->eSkill,
                'eScope' => $originalExam->eScope ?: ($originalExam->eSkill === 'mixed' ? 'full' : 'skill'),
                'ePart_type' => $originalExam->ePart_type,
                'ePart_number' => $originalExam->ePart_number,
                'eTeacher_id' => $user->uId,
                'eDuration_minutes' => $originalExam->eDuration_minutes,
                'eIs_private' => $originalExam->eIs_private,
                'eSource_type' => 'manual',
                'template_id' => $originalExam->template_id,
                'eParent_exam_id' => $originalExam->eId, // Set parent exam ID
            ]);

            // Clone questions and answers
            foreach ($originalExam->questions as $originalQuestion) {
                $newQuestion = Question::create([
                    'exam_id' => $newExam->eId,
                    'qType' => $originalQuestion->qType,
                    'qContent' => $originalQuestion->qContent,
                    'qPoints' => $originalQuestion->qPoints,
                    'qMedia_url' => $originalQuestion->qMedia_url,
                    'qTranscript' => $originalQuestion->qTranscript,
                    'qExplanation' => $originalQuestion->qExplanation,
                    'qListen_limit' => $originalQuestion->qListen_limit ?? 1,
                ]);

                // Clone answers
                foreach ($originalQuestion->answers as $originalAnswer) {
                    Answer::create([
                        'question_id' => $newQuestion->qId,
                        'aContent' => $originalAnswer->aContent,
                        'aIs_correct' => $originalAnswer->aIs_correct,
                    ]);
                }
            }

            return response()->json([
                'status' => 'success',
                'data' => [
                    'examId' => $newExam->eId,
                    'message' => 'Nhân bản đề thi thành công',
                    'cloned_questions' => $originalExam->questions->count(),
                ]
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi hệ thống khi nhân bản đề thi.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /api/teacher/exams/{id}/preview
     * Xem trước đề thi
     */
    /**
     * @OA\Get(
     *     path="/teacher/exams/{id}/preview",
     *     tags={"Exams"},
     *     summary="Preview exam",
     *     description="Get exam preview as students would see it",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=200, description="Exam preview retrieved successfully"),
     *     @OA\Response(response=404, description="Exam not found")
     * )
     */
    public function preview(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $exam = Exam::where('eId', $id)
                   
                   ->with(['questions.answers'])
                   ->first();

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài thi.'
            ], 404);
        }

        // Format for student view (hide correct answers)
        $previewQuestions = $exam->questions->map(function($question) {
            return [
                'qId' => $question->qId,
                'qContent' => $question->qContent,
                'qPoints' => $question->qPoints,
                'qMedia_url' => $question->qMedia_url,
                'qTranscript' => $question->qTranscript,
                'qListen_limit' => $question->qListen_limit,
                'answers' => $question->answers->map(function($answer) {
                    return [
                        'aId' => $answer->aId,
                        'aContent' => $answer->aContent,
                        // Hide correct answer in preview
                    ];
                }),
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => [
                'exam' => [
                    'eId' => $exam->eId,
                    'eTitle' => $exam->eTitle,
                    'eDescription' => $exam->eDescription,
                    'eType' => $exam->eType,
                    'eSkill' => $exam->eSkill,
                    'eDuration_minutes' => $exam->eDuration_minutes,
                ],
                'questions' => $previewQuestions,
                'total_questions' => $exam->questions->count(),
                'total_points' => $exam->questions->sum('qPoints'),
                'estimated_time' => $exam->eDuration_minutes . ' phút',
            ]
        ]);
    }

    /**
     * POST /api/teacher/exams/{id}/publish
     * Xuất bản đề thi
     */
    /**
     * @OA\Post(
     *     path="/teacher/exams/{id}/publish",
     *     tags={"Exams"},
     *     summary="Publish exam",
     *     description="Publish exam to make it available for assignments",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=200, description="Exam published successfully"),
     *     @OA\Response(response=400, description="Exam cannot be published"),
     *     @OA\Response(response=404, description="Exam not found")
     * )
     */
    public function publish(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $exam = Exam::where('eId', $id)
                   
                   ->with('questions')
                   ->first();

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài thi.'
            ], 404);
        }

        if ($exam->eType === 'IELTS') {
            $validator = Validator::make($request->all(), [
                'ielts_test_type' => 'required|string|in:Academic,General Training',
                'ielts_data' => 'required|array',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Dữ liệu IELTS không hợp lệ.',
                    'errors' => $validator->errors()
                ], 400);
            }

            try {
                $result = \App\Services\IELTSService::publishIeltsExam(
                    $exam,
                    $request->input('ielts_test_type'),
                    $request->input('ielts_data')
                );

                return response()->json([
                    'status' => 'success',
                    'data' => [
                        'message' => 'Xuất bản đề thi IELTS thành công',
                        'exam_id' => $exam->eId,
                        'questions_count' => $result['total_questions'] ?? 0,
                    ]
                ]);
            } catch (\Exception $e) {
                \Log::error('Failed to publish IELTS exam: ' . $e->getMessage(), [
                    'exam_id' => $exam->eId,
                    'exception' => $e
                ]);
                return response()->json([
                    'status' => 'error',
                    'message' => 'Đã xảy ra lỗi khi xuất bản đề thi IELTS: ' . $e->getMessage(),
                ], 500);
            }
        }

        // Validate exam can be published
        $validationErrors = [];

        if ($exam->questions->count() === 0) {
            $validationErrors[] = 'Đề thi phải có ít nhất 1 câu hỏi.';
        }

        if (!$exam->eTitle) {
            $validationErrors[] = 'Đề thi phải có tiêu đề.';
        }

        if (!$exam->eDuration_minutes || $exam->eDuration_minutes <= 0) {
            $validationErrors[] = 'Đề thi phải có thời gian làm bài hợp lệ.';
        }

        // Câu CÓ LỰA CHỌN (≥2 phương án) chưa chọn → tự đặt phương án đầu làm đáp án.
        // Câu NHẬP TAY (điền từ/short answer) thiếu đáp án → CHẶN xuất bản.
        $subjectiveTypes = ['essay', 'writing', 'speaking', 'short_writing', 'speaking_task'];
        $fillTypes = ['fill_blank', 'fill_in_blank', 'short_answer', 'text', 'open_cloze', 'word_form'];
        $exam->loadMissing('questions.answers');
        $noAnswerKey = [];
        foreach ($exam->questions as $q) {
            $type = strtolower((string) $q->qType);
            $skill = strtolower((string) ($q->qSkill ?? ''));
            if (in_array($type, $subjectiveTypes, true) || in_array($skill, ['writing', 'speaking'], true)) {
                continue;
            }
            $hasKey = false;
            if ($q->relationLoaded('answers') && $q->answers->contains(fn($a) => (bool) $a->aIs_correct)) {
                $hasKey = true;
            }
            if (!$hasKey) {
                $d = is_array($q->qData) ? $q->qData : [];
                foreach (['correct_answer', 'answer'] as $k) {
                    if (isset($d[$k]) && trim((string) $d[$k]) !== '') { $hasKey = true; break; }
                }
                if (!$hasKey && (!empty($d['correct_answers']) || !empty($d['accepted_answers']))) $hasKey = true;
            }
            if ($hasKey) continue;

            $answers = $q->relationLoaded('answers')
                ? $q->answers->sortBy(fn($a) => $a->aOrder ?? $a->aId)->values()
                : $q->answers()->orderBy('aOrder')->get();
            $isChoice = $answers->count() >= 2 && !in_array($type, $fillTypes, true);
            if ($isChoice) {
                // Chọn đại phương án đầu làm đáp án đúng (placeholder, sửa sau).
                $first = $answers->first();
                $first->aIs_correct = true;
                $first->save();
                $d = is_array($q->qData) ? $q->qData : [];
                $d['correct_answer'] = $d['correct_answer'] ?? 'A';
                $q->qData = $d;
                $q->save();
            } else {
                // Dạng nhập tay / không có phương án để chọn → chặn.
                $noAnswerKey[] = $q->qSection_order ?? $q->qId;
            }
        }
        if (!empty($noAnswerKey)) {
            $shown = implode(', ', array_slice($noAnswerKey, 0, 20)) . (count($noAnswerKey) > 20 ? '…' : '');
            $validationErrors[] = "Câu {$shown} dạng tự nhập chưa có đáp án. Vui lòng nhập đáp án cho các câu này trước khi xuất bản.";
        }

        if (!empty($validationErrors)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không thể xuất bản đề thi.',
                'errors' => $validationErrors
            ], 400);
        }

        // Update exam status (theo cài đặt auto-duyệt)
        $moderationStatus = Exam::resolveModerationStatus();
        $exam->update([
            'eStatus' => $moderationStatus,
            'eIs_private' => $moderationStatus !== 'published',
        ]);

        return response()->json([
            'status' => 'success',
            'data' => [
                'message' => $moderationStatus === 'published'
                    ? 'Xuất bản đề thi thành công'
                    : 'Đã gửi đề thi, chờ quản trị viên duyệt',
                'exam_id' => $exam->eId,
                'exam_status' => $moderationStatus,
                'questions_count' => $exam->questions->count(),
            ]
        ]);
    }

    /**
     * POST /api/teacher/exams/{examId}/vstep/parts/{partNumber}
     * Lưu một part của đề VSTEP Reading
     */
    public function saveVstepPart(Request $request, $examId, $partNumber)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'partName' => 'required|string',
            'passage' => 'required|string',
            'wordCount' => 'required|integer',
            'questions' => 'required|array|min:1',
            'questions.*.questionNumber' => 'required|integer',
            'questions.*.questionText' => 'required|string',
            'questions.*.options' => 'required|array',
            'questions.*.options.A' => 'required|string',
            'questions.*.options.B' => 'required|string',
            'questions.*.options.C' => 'required|string',
            'questions.*.options.D' => 'required|string',
            'questions.*.correctAnswer' => 'nullable|in:A,B,C,D',
            'questions.*.explanation' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        DB::beginTransaction();
        try {
            // Find or create exam
            $exam = Exam::where('eId', $examId)
                       
                       ->first();

            if (!$exam) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Không tìm thấy đề thi. Vui lòng tạo đề trước khi lưu part.'
                ], 404);
            }

            // Delete existing reading questions for this part (DON'T touch listening/writing)
            $oldQs = Question::where('exam_id', $exam->eId)
                ->where('qSkill', 'reading')
                ->where('qPart', $partNumber)
                ->get();
            foreach ($oldQs as $oq) {
                Answer::where('question_id', $oq->qId)->delete();
                $oq->delete();
            }

            // Find or create content_block for this passage (avoid duplicates)
            $contentBlock = \App\Models\ContentBlock::where('exam_id', $exam->eId)
                ->where('block_type', 'passage')
                ->get()
                ->first(function ($b) use ($partNumber) {
                    $meta = $b->metadata ?? [];
                    return ($meta['part_number'] ?? null) == $partNumber
                        && isset($meta['word_count']);
                });

            $blockData = [
                'exam_id' => $exam->eId,
                'block_type' => 'passage',
                'content' => $request->passage,
                'metadata' => [
                    'part_number' => $partNumber,
                    'part_name' => $request->partName,
                    'word_count' => $request->wordCount,
                ],
                'display_order' => $partNumber,
            ];
            if ($contentBlock) {
                $contentBlock->update($blockData);
            } else {
                $contentBlock = \App\Models\ContentBlock::create($blockData);
            }

            // Create questions
            foreach ($request->questions as $questionData) {
                $correct = !empty($questionData['correctAnswer']) ? $questionData['correctAnswer'] : 'A';
                $question = Question::create([
                    'exam_id' => $exam->eId,
                    'content_block_id' => $contentBlock->id,
                    'qContent' => $questionData['questionText'],
                    'qType' => 'multiple_choice',
                    'qSection' => 'reading',
                    'qSkill' => 'reading',
                    'qPart' => $partNumber,
                    'qSection_order' => $questionData['questionNumber'],
                    'qPoints' => 1,
                    'qExplanation' => $questionData['explanation'] ?? null,
                    'qData' => [
                        'part_number' => $partNumber,
                        'part_name' => $request->partName,
                        'question_number' => $questionData['questionNumber'],
                        'options' => $questionData['options'],
                        'correct_answer' => $correct,
                    ],
                ]);

                // Create answers
                foreach (['A', 'B', 'C', 'D'] as $option) {
                    Answer::create([
                        'question_id' => $question->qId,
                        'aContent' => $questionData['options'][$option],
                        'aIs_correct' => $correct === $option,
                        'aOrder' => ord($option) - ord('A'),
                    ]);
                }
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Đã lưu Part ' . $partNumber . ' thành công',
                'data' => [
                    'exam_id' => $exam->eId,
                    'part_number' => $partNumber,
                    'questions_saved' => count($request->questions),
                    'word_count' => $request->wordCount,
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi khi lưu Part: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /api/teacher/exams/{examId}/vstep/publish
     * Xuất bản đề VSTEP Reading hoàn chỉnh
     */
    public function publishVstepExam(Request $request, $examId)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'parts' => 'required|array|size:4',
            'parts.*.partNumber' => 'required|integer|min:1|max:4',
            'parts.*.partName' => 'required|string',
            'parts.*.passage' => 'required|string',
            'parts.*.questions' => 'required|array|size:10',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        DB::beginTransaction();
        try {
            // Find exam
            $exam = Exam::where('eId', $examId)
                       
                       ->first();

            if (!$exam) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Không tìm thấy đề thi.'
                ], 404);
            }

            // Update exam title and status (theo cài đặt auto-duyệt)
            $moderationStatus = Exam::resolveModerationStatus();
            $exam->update([
                'eTitle' => $request->title,
                'eIs_private' => $moderationStatus !== 'published',
                'eStatus' => $moderationStatus,
            ]);

            // Verify all 4 parts exist
            $questionCount = Question::where('exam_id', $exam->eId)->count();
            if ($questionCount < 40) {
                DB::rollBack();
                return response()->json([
                    'status' => 'error',
                    'message' => 'Đề thi chưa đủ 40 câu hỏi (4 parts x 10 câu).',
                    'data' => [
                        'current_questions' => $questionCount,
                        'required_questions' => 40,
                    ]
                ], 400);
            }

            // Create practice session
            $practiceSession = DB::table('practice_sessions')->insertGetId([
                'ps_title' => $request->title,
                'ps_description' => 'Đề luyện tập VSTEP Reading - 4 Parts, 40 câu hỏi',
                'ps_type' => 'skill_based',
                'ps_purpose' => 'practice',
                'ps_target_skill' => 'reading',
                'ps_difficulty' => 'medium',
                'ps_duration_minutes' => 60,
                'ps_teacher_id' => $user->uId,
                'ps_exam_id' => $exam->eId,
                'ps_is_active' => true,
                'ps_created_at' => now(),
                'ps_updated_at' => now(),
            ]);

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Đã xuất bản đề thi thành công',
                'data' => [
                    'exam_id' => $exam->eId,
                    'exam_title' => $exam->eTitle,
                    'practice_session_id' => $practiceSession,
                    'total_questions' => $questionCount,
                    'parts' => 4,
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi khi xuất bản đề thi: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /api/teacher/exams/{examId}/vstep/load
     * Load existing VSTEP Reading exam
     */
    public function loadVstepExam(Request $request, $examId)
    {
        $user = $request->user();

        if (!$user || !in_array($user->uRole, ['teacher', 'admin'], true)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $isAdmin = $user->uRole === 'admin';

        $exam = Exam::where('eId', $examId)
                   ->when(false, fn($q) => $q)
                   ->with([
                       'contentBlocks' => function($q) {
                           $q->orderBy('display_order');
                       },
                       'questions' => function($q) {
                           $q->orderBy('qPart')->orderBy('qSection_order');
                       },
                       'questions.answers'
                   ])
                   ->first();

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy đề thi.'
            ], 404);
        }

        // Organize data by parts
        $parts = [];
        for ($i = 1; $i <= 4; $i++) {
            // Filter by skill + part; NULL-part/skill questions belong to Part 1 only
            $partQuestions = $exam->questions
                ->filter(function($q) use ($i) {
                    $skillMatch = $q->qSkill === 'reading' || $q->qSkill === null || $q->qSkill === '';
                    $noPartSet  = ($q->qPart === null || $q->qPart === 0);
                    $partMatch  = $noPartSet ? ($i === 1) : ($q->qPart == $i);
                    return $skillMatch && $partMatch;
                })
                ->values();
            
            // FIXED: Filter content blocks to only get reading parts (those with word_count)
            $contentBlock = $exam->contentBlocks->first(function($block) use ($i) {
                $metadata = $block->metadata ?? [];
                return isset($metadata['part_number']) && 
                       $metadata['part_number'] == $i &&
                       isset($metadata['word_count']); // Reading blocks have word_count
            });

            $parts[] = [
                'partNumber' => $i,
                'partName' => $contentBlock->metadata['part_name'] ?? "Part $i",
                'passage' => $contentBlock->content ?? '',
                'wordCount' => $contentBlock->metadata['word_count'] ?? 0,
                'questions' => $partQuestions->map(function($q) {
                    return [
                        'questionNumber' => $q->qData['question_number'] ?? $q->qSection_order,
                        'questionText' => $q->qContent,
                        'options' => $q->qData['options'] ?? (function() use ($q) {
                            $sorted = ($q->answers ?? collect())->sortBy(fn($ans) => $ans->aOrder !== null ? $ans->aOrder : $ans->aId)->values();
                            return [
                                'A' => $sorted[0]->aContent ?? '',
                                'B' => $sorted[1]->aContent ?? '',
                                'C' => $sorted[2]->aContent ?? '',
                                'D' => $sorted[3]->aContent ?? '',
                            ];
                        })(),
                        'correctAnswer' => $q->qData['correct_answer'] ?? 'A',
                        'explanation' => $q->qExplanation,
                    ];
                })->toArray(),
            ];
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'exam_id' => $exam->eId,
                'title' => $exam->eTitle,
                'parts' => $parts,
            ]
        ]);
    }

    /**
     * Helper method to organize questions by sections
     */
    private function organizeQuestionsBySection($exam)
    {
        $sections = [];
        
        // Default section structure based on exam type
        if ($exam->eType === 'VSTEP') {
            $sections = [
                'listening' => [
                    'name' => 'Listening', 
                    'questions' => [], 
                    'duration' => 40,
                    'total_questions' => 35,
                    'parts' => [
                        ['name' => 'Part 1: Announcements', 'questions' => 8, 'description' => 'Short announcements and instructions'],
                        ['name' => 'Part 2: Dialogues', 'questions' => 12, 'description' => 'Conversations between two or more people'],
                        ['name' => 'Part 3: Lectures', 'questions' => 15, 'description' => 'Academic lectures and presentations']
                    ]
                ],
                'reading' => [
                    'name' => 'Reading', 
                    'questions' => [], 
                    'duration' => 60,
                    'total_questions' => 40,
                    'parts' => [
                        ['name' => 'Passage 1', 'questions' => 10, 'description' => 'Short factual text (400-500 words)'],
                        ['name' => 'Passage 2', 'questions' => 10, 'description' => 'Descriptive or narrative text (400-500 words)'],
                        ['name' => 'Passage 3', 'questions' => 10, 'description' => 'Argumentative text (500-600 words)'],
                        ['name' => 'Passage 4', 'questions' => 10, 'description' => 'Academic text (600-700 words)']
                    ]
                ],
                'writing' => [
                    'name' => 'Writing', 
                    'questions' => [], 
                    'duration' => 60,
                    'total_questions' => 2,
                    'parts' => [
                        ['name' => 'Task 1: Letter/Email', 'questions' => 1, 'description' => 'Write a letter or email (150 words minimum)', 'weight' => 33.33],
                        ['name' => 'Task 2: Essay', 'questions' => 1, 'description' => 'Write an argumentative essay (250 words minimum)', 'weight' => 66.67]
                    ]
                ],
                'speaking' => [
                    'name' => 'Speaking', 
                    'questions' => [], 
                    'duration' => 12,
                    'total_questions' => 3,
                    'parts' => [
                        ['name' => 'Part 1: Social Interaction', 'questions' => 1, 'description' => 'Answer questions about familiar topics (3 minutes)'],
                        ['name' => 'Part 2: Solution Discussion', 'questions' => 1, 'description' => 'Choose and explain a solution (4 minutes)'],
                        ['name' => 'Part 3: Topic Development', 'questions' => 1, 'description' => 'Develop a topic with follow-ups (5 minutes)']
                    ]
                ]
            ];
        } elseif ($exam->eType === 'IELTS') {
            $sections = [
                'listening' => ['name' => 'Listening', 'questions' => [], 'duration' => 30],
                'reading' => ['name' => 'Reading', 'questions' => [], 'duration' => 60],
                'writing' => ['name' => 'Writing', 'questions' => [], 'duration' => 60],
                'speaking' => ['name' => 'Speaking', 'questions' => [], 'duration' => 15],
            ];
        } else {
            // General exam - single section
            $sections = [
                $exam->eSkill => ['name' => ucfirst($exam->eSkill), 'questions' => [], 'duration' => $exam->eDuration_minutes],
            ];
        }

        // Distribute questions to sections based on qSection field
        foreach ($exam->questions as $question) {
            $sectionKey = strtolower($question->qSection ?? $exam->eSkill);
            
            // Map section names to keys
            if (strpos($sectionKey, 'listening') !== false || strpos($sectionKey, 'announcement') !== false || strpos($sectionKey, 'dialogue') !== false || strpos($sectionKey, 'lecture') !== false) {
                $sectionKey = 'listening';
            } elseif (strpos($sectionKey, 'reading') !== false || strpos($sectionKey, 'passage') !== false) {
                $sectionKey = 'reading';
            } elseif (strpos($sectionKey, 'writing') !== false || strpos($sectionKey, 'task') !== false) {
                $sectionKey = 'writing';
            } elseif (strpos($sectionKey, 'speaking') !== false || strpos($sectionKey, 'part') !== false) {
                $sectionKey = 'speaking';
            }
            
            if (isset($sections[$sectionKey])) {
                $sections[$sectionKey]['questions'][] = $question;
            }
        }

        // Calculate statistics for each section
        foreach ($sections as $sectionKey => &$section) {
            $section['question_count'] = count($section['questions']);
            $section['total_points'] = collect($section['questions'])->sum('qPoints');
        }

        return $sections;
    }

    /* ========================================
     * ADMIN METHODS - Exam Moderation
     * ======================================== */

    /**
     * GET /api/admin/exams
     * Kiểm duyệt đề thi (Admin only)
     */
    public function adminExams(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ quản trị viên mới có quyền truy cập.'
            ], 403);
        }

        $query = Exam::with(['teacher'])
                    ->withCount('questions');

        // Filter by status
        if ($request->has('is_private')) {
            $query->where('eIs_private', $request->is_private);
        }

        // Filter by type
        if ($request->has('type')) {
            $query->where('eType', $request->type);
        }

        // Filter by skill
        if ($request->has('skill')) {
            $query->where('eSkill', $request->skill);
        }

        // Filter by teacher
        if ($request->has('teacher_id')) {
            $query->where('eTeacher_id', $request->teacher_id);
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('eTitle', 'LIKE', "%{$search}%")
                  ->orWhere('eDescription', 'LIKE', "%{$search}%");
            });
        }

        // Sort
        $sortBy = $request->get('sort_by', 'eCreated_at');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        $paginate = $request->get('paginate') === 'true';
        $exams = $paginate
            ? $query->paginate((int) $request->get('per_page', 20))
            : $query->get();

        return response()->json([
            'status' => 'success',
            'data' => $exams
        ]);
    }

    /**
     * GET /api/admin/exams/{id}
     * Xem chi tiết đề thi (Admin)
     */
    public function adminExamDetail(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ quản trị viên mới có quyền truy cập.'
            ], 403);
        }

        $exam = Exam::with(['teacher', 'questions.answers', 'template'])
                   ->withCount('questions')
                   ->where('eId', $id)
                   ->first();

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy đề thi.'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $exam
        ]);
    }

    /**
     * POST /api/admin/exams/{id}/approve
     * Duyệt đề thi
     */
    public function approveExam(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ quản trị viên mới có quyền duyệt đề thi.'
            ], 403);
        }

        $exam = Exam::where('eId', $id)->first();

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy đề thi.'
            ], 404);
        }

        if ($exam->eStatus === 'published') {
            return response()->json([
                'status' => 'error',
                'message' => 'Đề thi đã được duyệt rồi.'
            ], 400);
        }

        $exam->update([
            'eIs_private' => false,
            'eStatus' => 'published',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Exam approved successfully',
            'data' => [
                'exam_id' => $exam->eId,
                'exam_title' => $exam->eTitle,
                'approved_by' => $user->uName,
                'approved_at' => now()->toISOString()
            ]
        ]);
    }

    /**
     * POST /api/admin/exams/{id}/reject
     * Từ chối đề thi
     */
    public function rejectExam(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ quản trị viên mới có quyền từ chối đề thi.'
            ], 403);
        }

        $exam = Exam::where('eId', $id)->first();

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy đề thi.'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'required|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Vui lòng nhập lý do từ chối.',
                'errors' => $validator->errors()
            ], 400);
        }

        // For now, we'll keep it private and add a note in description
        $exam->update([
            'eIs_private' => true,
            'eStatus' => 'archived',
            'eDescription' => ($exam->eDescription ?? '') . "\n\n[ADMIN REJECTED: " . $request->reason . "]"
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Exam rejected successfully',
            'data' => [
                'exam_id' => $exam->eId,
                'exam_title' => $exam->eTitle,
                'reason' => $request->reason,
                'rejected_by' => $user->uName,
                'rejected_at' => now()->toISOString()
            ]
        ]);
    }

    /**
     * DELETE /api/admin/exams/{id}
     * Xóa đề thi (Admin)
     */
    public function adminDeleteExam(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ quản trị viên mới có quyền xóa đề thi.'
            ], 403);
        }

        $exam = Exam::where('eId', $id)->first();

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy đề thi.'
            ], 404);
        }

        // Check if exam is being used in assignments
        $assignmentCount = DB::table('test_assignments')->where('exam_id', $id)->count();
        if ($assignmentCount > 0) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không thể xóa đề thi đang được giao bài.',
                'data' => [
                    'assignments_count' => $assignmentCount
                ]
            ], 400);
        }

        $exam->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Exam deleted successfully'
        ]);
    }

    /**
     * GET /api/admin/exams/pending
     * Danh sách đề thi chờ duyệt
     */
    public function pendingExams(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ quản trị viên mới có quyền truy cập.'
            ], 403);
        }

        // Đề "chờ duyệt" = đề giáo viên đã gửi và đang đợi admin phê duyệt
        // (eStatus='pending', sinh ra khi admin tắt auto-duyệt examAutoApprove).
        // KHÔNG tính đề nháp (draft) đang soạn dở của giáo viên.
        $pendingExams = Exam::with(['teacher'])
                           ->withCount('questions')
                           ->where('eStatus', 'pending')
                           ->orderBy('eCreated_at', 'desc')
                           ->get();

        return response()->json([
            'status' => 'success',
            'data' => $pendingExams
        ]);
    }

    /**
     * GET /api/admin/exams/statistics
     * Thống kê đề thi
     */
    public function examStatistics(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ quản trị viên mới có quyền truy cập.'
            ], 403);
        }

        // Exams statistics
        $totalExams = Exam::count();
        // "Đã xuất bản" = đề đã công bố; "Chờ duyệt" = đề đang đợi admin phê duyệt
        // (eStatus='pending'). KHÔNG dùng eIs_private vì đề nháp (draft) cũng private
        // nhưng không phải đề chờ duyệt → trước đây đếm nhầm cả draft.
        $publicExams = Exam::where('eStatus', 'published')->count();
        $privateExams = Exam::where('eStatus', 'pending')->count();

        // Exams by type
        $examsByType = Exam::selectRaw('eType, COUNT(*) as count')
                          ->groupBy('eType')
                          ->pluck('count', 'eType');

        // Exams by skill
        $examsBySkill = Exam::selectRaw('eSkill, COUNT(*) as count')
                           ->groupBy('eSkill')
                           ->pluck('count', 'eSkill');

        // Exams by teacher (top 5)
        $examsByTeacher = Exam::with('teacher')
                             ->selectRaw('eTeacher_id, COUNT(*) as count')
                             ->groupBy('eTeacher_id')
                             ->orderByDesc('count')
                             ->limit(5)
                             ->get()
                             ->map(function($item) {
                                 return [
                                     'teacher_name' => $item->teacher->uName ?? 'Unknown',
                                     'exam_count' => $item->count
                                 ];
                             });

        // Recent activity
        $recentExams = Exam::where('eCreated_at', '>=', now()->subDays(7))->count();

        return response()->json([
            'status' => 'success',
            'data' => [
                'total_exams' => $totalExams,
                'approved_exams' => $publicExams,
                'pending_exams' => $privateExams,
                'rejected_exams' => 0,
                'by_type' => $examsByType,
                'by_skill' => $examsBySkill,
                'by_teacher' => $examsByTeacher,
                'recent_exams' => $recentExams,
            ]
        ]);
    }

    /* ========================================
     * VSTEP LISTENING METHODS
     * ======================================== */

    /**
     * Layout chuẩn VSTEP Listening (số section + số câu hỏi mỗi section)
     */
    private const LISTENING_LAYOUT = [
        1 => ['sectionCount' => 1, 'questionsPerSection' => 8, 'questionStart' => 1,  'sectionLabel' => 'Announcements'],
        2 => ['sectionCount' => 3, 'questionsPerSection' => 4, 'questionStart' => 9,  'sectionLabel' => 'Conversation'],
        3 => ['sectionCount' => 3, 'questionsPerSection' => 5, 'questionStart' => 21, 'sectionLabel' => 'Talk'],
    ];

    /**
     * Tính display_order chuẩn cho 1 section: partNumber*100 + sectionNumber.
     */
    private function listeningDisplayOrder(int $partNumber, int $sectionNumber): int
    {
        return $partNumber * 100 + $sectionNumber;
    }

    /**
     * Tìm content_block của 1 section, hỗ trợ cả schema mới (section_number trong metadata)
     * lẫn schema cũ (1 audio/part, không có section_number → coi là section 1).
     */
    private function findListeningSectionBlock(int $examId, int $partNumber, int $sectionNumber)
    {
        $matches = \App\Models\ContentBlock::where('exam_id', $examId)
            ->where('block_type', 'audio')
            ->get()
            ->filter(function ($b) use ($partNumber, $sectionNumber) {
                $meta = $b->metadata ?? [];
                if (($meta['part_number'] ?? null) != $partNumber) return false;
                $sec = $meta['section_number'] ?? 1; // legacy = section 1
                return $sec == $sectionNumber;
            });

        // Ưu tiên block có section_number explicit (data mới) > legacy block không có section_number
        $explicit = $matches->first(function ($b) {
            return isset($b->metadata['section_number']);
        });
        return $explicit ?: $matches->first();
    }

    /**
     * Tìm tất cả content_blocks match 1 section (để cleanup duplicates).
     */
    private function findAllListeningSectionBlocks(int $examId, int $partNumber, int $sectionNumber)
    {
        return \App\Models\ContentBlock::where('exam_id', $examId)
            ->where('block_type', 'audio')
            ->get()
            ->filter(function ($b) use ($partNumber, $sectionNumber) {
                $meta = $b->metadata ?? [];
                if (($meta['part_number'] ?? null) != $partNumber) return false;
                $sec = $meta['section_number'] ?? 1;
                return $sec == $sectionNumber;
            })
            ->values();
    }

    /**
     * POST /api/teacher/exams/{examId}/ielts/listening/sections/{sectionNumber}/audio
     * Upload audio file for IELTS listening section
     */
    public function uploadIeltsListeningAudio(Request $request, $examId, $sectionNumber)
    {
        $user = $request->user();
        $sectionNumber = (int) $sectionNumber;

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $exam = Exam::where('eId', $examId)
                    
                    ->first();

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài thi.'
            ], 404);
        }

        if ($sectionNumber < 1 || $sectionNumber > 4) {
            return response()->json([
                'status' => 'error',
                'message' => 'Section number không hợp lệ. IELTS chỉ có 4 section.'
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'audio' => 'required|file|mimes:mp3,wav,m4a,aac,ogg,webm|max:51200', // 50MB max
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        try {
            $audioFile = $request->file('audio');
            $originalName = $audioFile->getClientOriginalName();
            $extension = $audioFile->getClientOriginalExtension() ?: 'mp3';
            $filename = 'ielts_listening_' . $examId . '_sec' . $sectionNumber . '_' . time() . '_' . \Illuminate\Support\Str::random(8) . '.' . $extension;

            // Store file
            $path = $audioFile->storeAs('exam_audio', $filename, 'public');

            if (!$path) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Không thể lưu tệp tin âm thanh.'
                ], 500);
            }

            $audioUrl = url('files/audio/' . $filename);

            \Log::info('IELTS Listening Audio uploaded successfully', [
                'exam_id' => $examId,
                'section_number' => $sectionNumber,
                'filename' => $filename,
                'audio_url' => $audioUrl
            ]);

            return response()->json([
                'status' => 'success',
                'success' => true,
                'audio_url' => $audioUrl,
                'data' => [
                    'audio_url' => $audioUrl,
                    'filename' => $filename,
                    'originalName' => $originalName
                ]
            ]);

        } catch (\Exception $e) {
            \Log::error('IELTS audio upload exception', [
                'exam_id' => $examId,
                'section_number' => $sectionNumber,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Đã xảy ra lỗi hệ thống khi upload audio: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /api/teacher/exams/{examId}/ielts/listening/sections/{sectionNumber}/question-image
     * Upload a question page image (table / form / diagram) for an image-completion group.
     */
    public function uploadIeltsListeningQuestionImage(Request $request, $examId, $sectionNumber)
    {
        $user = $request->user();
        $sectionNumber = (int) $sectionNumber;

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 401);
        }

        $exam = Exam::where('eId', $examId)->first();
        if (!$exam) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy bài thi.'], 404);
        }

        $validator = \Validator::make($request->all(), [
            'image' => 'required|file|mimes:jpg,jpeg,png,gif,webp,pdf|max:20480',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'error', 'message' => 'File ảnh không hợp lệ.', 'errors' => $validator->errors()], 400);
        }

        try {
            $file      = $request->file('image');
            $ext       = $file->getClientOriginalExtension() ?: 'jpg';
            $filename  = 'ielts_q_img_' . $examId . '_sec' . $sectionNumber . '_' . time() . '_' . \Illuminate\Support\Str::random(8) . '.' . $ext;
            $path      = $file->storeAs('exam_images', $filename, 'public');
            $imageUrl  = \Storage::disk('public')->url($path);

            return response()->json([
                'status'    => 'success',
                'image_url' => $imageUrl,
                'data'      => ['image_url' => $imageUrl, 'filename' => $filename],
            ]);
        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => 'Lỗi upload ảnh: ' . $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/teacher/exams/{examId}/vstep/listening/parts/{partNumber}/sections/{sectionNumber}/audio
     * Auto-save audio + transcript của 1 section (không đụng questions).
     */
    public function saveVstepListeningSectionAudio(Request $request, $examId, $partNumber, $sectionNumber)
    {
        $user = $request->user();
        $partNumber = (int) $partNumber;
        $sectionNumber = (int) $sectionNumber;

        if (!isset(self::LISTENING_LAYOUT[$partNumber])) {
            return response()->json(['status' => 'error', 'message' => 'Part number không hợp lệ.'], 400);
        }
        $layout = self::LISTENING_LAYOUT[$partNumber];
        if ($sectionNumber < 1 || $sectionNumber > $layout['sectionCount']) {
            return response()->json([
                'status' => 'error',
                'message' => "Part {$partNumber} chỉ có {$layout['sectionCount']} section (1..{$layout['sectionCount']}).",
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'sectionName' => 'nullable|string',
            'audioUrl' => 'required|string',
            'audioDuration' => 'required|integer|min:1',
            'transcript' => 'nullable|string',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'error', 'message' => 'Dữ liệu không hợp lệ.', 'errors' => $validator->errors()], 400);
        }

        $exam = Exam::where('eId', $examId)->first();
        if (!$exam) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy đề thi.'], 404);
        }

        $allMatches = $this->findAllListeningSectionBlocks((int) $exam->eId, $partNumber, $sectionNumber);
        $existing = $this->findListeningSectionBlock((int) $exam->eId, $partNumber, $sectionNumber);

        $defaultName = "{$layout['sectionLabel']} {$sectionNumber}";
        $metadata = [
            'part_number' => $partNumber,
            'section_number' => $sectionNumber,
            'part_name' => "Part {$partNumber}",
            'section_name' => $request->sectionName ?: ($existing->metadata['section_name'] ?? $defaultName),
            'audio_duration' => $request->audioDuration,
            'transcript' => $request->transcript,
        ];

        if ($existing) {
            $existing->update([
                'content' => $request->audioUrl,
                'metadata' => $metadata,
                'display_order' => $this->listeningDisplayOrder($partNumber, $sectionNumber),
            ]);
        } else {
            $existing = \App\Models\ContentBlock::create([
                'exam_id' => $exam->eId,
                'block_type' => 'audio',
                'content' => $request->audioUrl,
                'metadata' => $metadata,
                'display_order' => $this->listeningDisplayOrder($partNumber, $sectionNumber),
            ]);
        }

        // Xoá các block duplicate (legacy block không có section_number, hoặc bản sao thừa)
        // Questions trỏ đến block bị xoá sẽ được load logic phân phối lại theo qSection_order.
        foreach ($allMatches as $b) {
            if ($b->id !== $existing->id) {
                $b->delete();
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => "Đã lưu audio Part {$partNumber} - Section {$sectionNumber}",
            'data' => [
                'exam_id' => $exam->eId,
                'part_number' => $partNumber,
                'section_number' => $sectionNumber,
                'audio_url' => $request->audioUrl,
                'audio_duration' => $request->audioDuration,
            ],
        ]);
    }

    /**
     * POST /api/teacher/exams/{examId}/vstep/listening/parts/{partNumber}/sections/{sectionNumber}
     * Lưu trọn 1 section: audio + transcript + questions (xoá-tạo lại questions).
     */
    public function saveVstepListeningSection(Request $request, $examId, $partNumber, $sectionNumber)
    {
        $user = $request->user();
        $partNumber = (int) $partNumber;
        $sectionNumber = (int) $sectionNumber;

        if (!isset(self::LISTENING_LAYOUT[$partNumber])) {
            return response()->json(['status' => 'error', 'message' => 'Part number không hợp lệ.'], 400);
        }
        $layout = self::LISTENING_LAYOUT[$partNumber];
        if ($sectionNumber < 1 || $sectionNumber > $layout['sectionCount']) {
            return response()->json([
                'status' => 'error',
                'message' => "Part {$partNumber} chỉ có {$layout['sectionCount']} section.",
            ], 400);
        }
        $expectedQ = $layout['questionsPerSection'];

        $validator = Validator::make($request->all(), [
            'sectionName' => 'nullable|string',
            'audioUrl' => 'nullable|string',
            'audioDuration' => 'nullable|integer|min:0',
            'transcript' => 'nullable|string',
            'questions' => "required|array|min:1|max:{$expectedQ}",
            'questions.*.questionNumber' => 'required|integer',
            'questions.*.questionText' => 'required|string',
            'questions.*.options' => 'required|array',
            'questions.*.options.A' => 'required|string',
            'questions.*.options.B' => 'required|string',
            'questions.*.options.C' => 'required|string',
            'questions.*.options.D' => 'required|string',
            'questions.*.correctAnswer' => 'nullable|in:A,B,C,D',
            'questions.*.explanation' => 'nullable|string',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'error', 'message' => 'Dữ liệu không hợp lệ.', 'errors' => $validator->errors()], 400);
        }

        $exam = Exam::where('eId', $examId)->first();
        if (!$exam) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy đề thi.'], 404);
        }

        DB::beginTransaction();
        try {
            // 1. UpdateOrCreate content_block của section
            $defaultName = "{$layout['sectionLabel']} {$sectionNumber}";
            $allMatches = $this->findAllListeningSectionBlocks((int) $exam->eId, $partNumber, $sectionNumber);
            $existing = $this->findListeningSectionBlock((int) $exam->eId, $partNumber, $sectionNumber);

            $audioUrl = $request->audioUrl ?? ($existing->content ?? '');
            $audioDuration = $request->audioDuration ?? ($existing->metadata['audio_duration'] ?? 0);

            $metadata = [
                'part_number' => $partNumber,
                'section_number' => $sectionNumber,
                'part_name' => "Part {$partNumber}",
                'section_name' => $request->sectionName ?: ($existing->metadata['section_name'] ?? $defaultName),
                'audio_duration' => $audioDuration,
                'transcript' => $request->transcript ?? ($existing->metadata['transcript'] ?? ''),
            ];

            if ($existing) {
                $existing->update([
                    'content' => $audioUrl,
                    'metadata' => $metadata,
                    'display_order' => $this->listeningDisplayOrder($partNumber, $sectionNumber),
                ]);
                $contentBlock = $existing;
            } else {
                $contentBlock = \App\Models\ContentBlock::create([
                    'exam_id' => $exam->eId,
                    'block_type' => 'audio',
                    'content' => $audioUrl,
                    'metadata' => $metadata,
                    'display_order' => $this->listeningDisplayOrder($partNumber, $sectionNumber),
                ]);
            }

            // Xoá các block duplicate (legacy + bản sao) sau khi đã update
            foreach ($allMatches as $b) {
                if ($b->id !== $contentBlock->id) {
                    $b->delete();
                }
            }

            // 2. Xoá questions cũ của section này
            //    Bao gồm: questions linked đúng content_block_id + legacy questions
            //    (xác định theo qData.section_number hoặc compute từ qSection_order)
            $qStart = $layout['questionStart'];
            $qPerSec = $layout['questionsPerSection'];
            $oldQuestions = Question::where('exam_id', $exam->eId)
                ->where('qSkill', 'listening')
                ->where('qPart', $partNumber)
                ->get()
                ->filter(function ($q) use ($contentBlock, $sectionNumber, $qStart, $qPerSec) {
                    if ($q->content_block_id == $contentBlock->id) return true;
                    $qSec = $q->qData['section_number'] ?? null;
                    if ($qSec !== null) return $qSec == $sectionNumber;
                    $qNum = $q->qData['question_number'] ?? $q->qSection_order ?? 0;
                    $relIdx = max(0, $qNum - $qStart);
                    $computed = intdiv($relIdx, max(1, $qPerSec)) + 1;
                    return $computed == $sectionNumber;
                });
            foreach ($oldQuestions as $oq) {
                Answer::where('question_id', $oq->qId)->delete();
                $oq->delete();
            }

            // 3. Tạo questions mới
            foreach ($request->questions as $qData) {
                // Chưa chọn đáp án → mặc định "A" (giáo viên sửa lại sau).
                $correct = !empty($qData['correctAnswer']) ? $qData['correctAnswer'] : 'A';
                $question = Question::create([
                    'exam_id' => $exam->eId,
                    'content_block_id' => $contentBlock->id,
                    'qContent' => $qData['questionText'],
                    'qType' => 'multiple_choice',
                    'qSection' => 'listening',
                    'qSkill' => 'listening',
                    'qPart' => $partNumber,
                    'qSection_order' => $qData['questionNumber'],
                    'qPoints' => 1,
                    'qExplanation' => $qData['explanation'] ?? null,
                    'qData' => [
                        'part_number' => $partNumber,
                        'section_number' => $sectionNumber,
                        'question_number' => $qData['questionNumber'],
                        'options' => $qData['options'],
                        'correct_answer' => $correct,
                    ],
                ]);

                foreach (['A', 'B', 'C', 'D'] as $opt) {
                    Answer::create([
                        'question_id' => $question->qId,
                        'aContent' => $qData['options'][$opt],
                        'aIs_correct' => $correct === $opt,
                        'aOrder' => ord($opt) - ord('A'),
                    ]);
                }
            }

            DB::commit();
            return response()->json([
                'status' => 'success',
                'message' => "Đã lưu Part {$partNumber} - Section {$sectionNumber}",
                'data' => [
                    'exam_id' => $exam->eId,
                    'part_number' => $partNumber,
                    'section_number' => $sectionNumber,
                    'questions_saved' => count($request->questions),
                ],
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['status' => 'error', 'message' => 'Lỗi khi lưu section: ' . $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/teacher/exams/{examId}/vstep/listening/parts/{partNumber}/audio
     * (LEGACY) Lightweight: chỉ lưu audioUrl + duration + transcript của 1 part,
     * KHÔNG đụng đến questions. Map sang section 1 cho backwards compatibility.
     */
    public function saveVstepListeningAudio(Request $request, $examId, $partNumber)
    {
        $user = $request->user();
        $partNumber = (int) $partNumber;

        if (!in_array($partNumber, [1, 2, 3], true)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Part number không hợp lệ.'
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'partName' => 'nullable|string',
            'audioUrl' => 'required|string',
            'audioDuration' => 'required|integer|min:1',
            'transcript' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        $exam = Exam::where('eId', $examId)
                   
                   ->first();

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy đề thi.'
            ], 404);
        }

        // Tìm content_block hiện tại của part này (nếu đã có)
        $existing = \App\Models\ContentBlock::where('exam_id', $exam->eId)
            ->where('block_type', 'audio')
            ->where('display_order', $partNumber)
            ->first();

        $partNames = [
            1 => 'Part 1 - Thông báo ngắn',
            2 => 'Part 2 - Hội thoại',
            3 => 'Part 3 - Bài giảng',
        ];

        $metadata = [
            'part_number' => $partNumber,
            'part_name' => $request->partName ?: ($existing->metadata['part_name'] ?? $partNames[$partNumber]),
            'audio_duration' => $request->audioDuration,
            'transcript' => $request->transcript,
        ];

        if ($existing) {
            $existing->update([
                'content' => $request->audioUrl,
                'metadata' => $metadata,
            ]);
        } else {
            \App\Models\ContentBlock::create([
                'exam_id' => $exam->eId,
                'block_type' => 'audio',
                'content' => $request->audioUrl,
                'metadata' => $metadata,
                'display_order' => $partNumber,
            ]);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Đã lưu audio Part ' . $partNumber,
            'data' => [
                'exam_id' => $exam->eId,
                'part_number' => $partNumber,
                'audio_url' => $request->audioUrl,
                'audio_duration' => $request->audioDuration,
            ],
        ]);
    }

    /**
     * POST /api/teacher/exams/{examId}/vstep/listening/parts/{partNumber}
     * Lưu một part của đề VSTEP Listening
     */
    public function saveVstepListeningPart(Request $request, $examId, $partNumber)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        // Validate part number and expected question count
        $expectedQuestions = [1 => 8, 2 => 12, 3 => 15];
        if (!isset($expectedQuestions[$partNumber])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Part number không hợp lệ. Chỉ có Part 1, 2, 3.'
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'partName' => 'required|string',
            'audioUrl' => 'required|string',
            'audioDuration' => 'required|integer|min:1',
            'transcript' => 'nullable|string',
            'completedQuestions' => 'required|integer|min:1',
            'totalQuestions' => 'required|integer',
            'questions' => 'required|array|min:1',
            'questions.*.questionNumber' => 'required|integer',
            'questions.*.questionText' => 'required|string',
            'questions.*.options' => 'required|array',
            'questions.*.options.A' => 'required|string',
            'questions.*.options.B' => 'required|string',
            'questions.*.options.C' => 'required|string',
            'questions.*.options.D' => 'required|string',
            'questions.*.correctAnswer' => 'nullable|in:A,B,C,D',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        // Validate question count doesn't exceed limit
        if (count($request->questions) > $expectedQuestions[$partNumber]) {
            return response()->json([
                'status' => 'error',
                'message' => "Part {$partNumber} chỉ có tối đa {$expectedQuestions[$partNumber]} câu hỏi."
            ], 400);
        }

        DB::beginTransaction();
        try {
            // Find or create exam
            $exam = Exam::where('eId', $examId)
                       
                       ->first();

            if (!$exam) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Không tìm thấy đề thi. Vui lòng tạo đề trước khi lưu part.'
                ], 404);
            }

            // Delete existing questions for this part
            Question::where('exam_id', $exam->eId)
                   ->where('qPart', $partNumber)
                   ->delete();

            // Create content block for audio
            $contentBlock = \App\Models\ContentBlock::create([
                'exam_id' => $exam->eId,
                'block_type' => 'audio',
                'content' => $request->audioUrl,
                'metadata' => [
                    'part_number' => $partNumber,
                    'part_name' => $request->partName,
                    'audio_duration' => $request->audioDuration,
                    'transcript' => $request->transcript,
                ],
                'display_order' => $partNumber,
            ]);

            // Create questions
            foreach ($request->questions as $questionData) {
                $correct = !empty($questionData['correctAnswer']) ? $questionData['correctAnswer'] : 'A';
                $question = Question::create([
                    'exam_id' => $exam->eId,
                    'content_block_id' => $contentBlock->id,
                    'qContent' => $questionData['questionText'],
                    'qType' => 'multiple_choice',
                    'qSection' => 'listening',
                    'qSkill' => 'listening',
                    'qPart' => $partNumber,
                    'qSection_order' => $questionData['questionNumber'],
                    'qPoints' => 1,
                    'qData' => [
                        'part_number' => $partNumber,
                        'part_name' => $request->partName,
                        'question_number' => $questionData['questionNumber'],
                        'options' => $questionData['options'],
                        'correct_answer' => $correct,
                    ],
                ]);

                // Create answers
                foreach (['A', 'B', 'C', 'D'] as $option) {
                    Answer::create([
                        'question_id' => $question->qId,
                        'aContent' => $questionData['options'][$option],
                        'aIs_correct' => $correct === $option,
                        'aOrder' => ord($option) - ord('A'),
                    ]);
                }
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Đã lưu Part ' . $partNumber . ' thành công',
                'data' => [
                    'exam_id' => $exam->eId,
                    'part_number' => $partNumber,
                    'questions_saved' => count($request->questions),
                    'audio_duration' => $request->audioDuration,
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi khi lưu Part: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /api/teacher/exams/{examId}/vstep/listening/publish
     * Xuất bản đề VSTEP Listening hoàn chỉnh
     */
    public function publishVstepListeningExam(Request $request, $examId)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'parts' => 'required|array|size:3',
            'parts.*.partNumber' => 'required|integer|min:1|max:3',
            'parts.*.partName' => 'required|string',
            'parts.*.audioUrl' => 'required|string',
            'parts.*.questions' => 'required|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        DB::beginTransaction();
        try {
            // Find exam
            $exam = Exam::where('eId', $examId)
                       
                       ->first();

            if (!$exam) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Không tìm thấy đề thi.'
                ], 404);
            }

            // Update exam title and status (theo cài đặt auto-duyệt)
            $moderationStatus = Exam::resolveModerationStatus();
            $exam->update([
                'eTitle' => $request->title,
                'eIs_private' => $moderationStatus !== 'published',
                'eStatus' => $moderationStatus,
            ]);

            // Verify all 3 parts exist with correct question counts
            $questionCount = Question::where('exam_id', $exam->eId)->count();
            if ($questionCount < 35) {
                DB::rollBack();
                return response()->json([
                    'status' => 'error',
                    'message' => 'Đề thi chưa đủ 35 câu hỏi (Part 1: 8, Part 2: 12, Part 3: 15).',
                    'data' => [
                        'current_questions' => $questionCount,
                        'required_questions' => 35,
                    ]
                ], 400);
            }

            // Create practice session
            $practiceSession = DB::table('practice_sessions')->insertGetId([
                'ps_title' => $request->title,
                'ps_description' => 'Đề luyện tập VSTEP Listening - 3 Parts, 35 câu hỏi',
                'ps_type' => 'skill_based',
                'ps_purpose' => 'practice',
                'ps_target_skill' => 'listening',
                'ps_difficulty' => 'medium',
                'ps_duration_minutes' => 40,
                'ps_teacher_id' => $user->uId,
                'ps_exam_id' => $exam->eId,
                'ps_is_active' => true,
                'ps_created_at' => now(),
                'ps_updated_at' => now(),
            ]);

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Đã xuất bản đề thi thành công',
                'data' => [
                    'exam_id' => $exam->eId,
                    'exam_title' => $exam->eTitle,
                    'practice_session_id' => $practiceSession,
                    'total_questions' => $questionCount,
                    'parts' => 3,
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi khi xuất bản đề thi: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /api/teacher/exams/{examId}/vstep/listening/load
     * Load existing VSTEP Listening exam
     */
    public function loadVstepListeningExam(Request $request, $examId)
    {
        $user = $request->user();

        if (!$user || !in_array($user->uRole, ['teacher', 'admin'], true)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $isAdmin = $user->uRole === 'admin';

        $exam = Exam::where('eId', $examId)
                   ->when(false, fn($q) => $q)
                   ->with([
                       'contentBlocks' => function($q) {
                           $q->orderBy('display_order');
                       },
                       'questions' => function($q) {
                           $q->orderBy('qPart')->orderBy('qSection_order');
                       },
                       'questions.answers'
                   ])
                   ->first();

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy đề thi.'
            ], 404);
        }

        // Organize data by parts -> sections
        $parts = [];
        foreach (self::LISTENING_LAYOUT as $partNumber => $layout) {
            $sectionCount = $layout['sectionCount'];
            $qPerSection  = $layout['questionsPerSection'];

            // Tìm tất cả audio content_blocks của part này
            $partBlocks = $exam->contentBlocks->filter(function ($block) use ($partNumber) {
                $meta = $block->metadata ?? [];
                return isset($meta['part_number'])
                    && $meta['part_number'] == $partNumber
                    && isset($meta['audio_duration']);
            })->values();

            // Build sections (1..sectionCount), kể cả khi DB trống
            $sections = [];
            for ($s = 1; $s <= $sectionCount; $s++) {
                // Match block by section_number trong metadata; legacy block (no section_number) → section 1
                $block = $partBlocks->first(function ($b) use ($s) {
                    $meta = $b->metadata ?? [];
                    $sec = $meta['section_number'] ?? 1;
                    return $sec == $s;
                });

                // Questions của section: phân phối theo thứ tự hợp lý
                // 1) Nếu qData.section_number có → dùng nó (data mới chuẩn)
                // 2) Nếu không → tính section dựa trên qSection_order/question_number
                //    (legacy: ví dụ Part 1 có 8 câu cho 8 section → Q1→S1, Q2→S2, ...)
                $qStart = $layout['questionStart'];
                $qPerSec = $qPerSection;
                $sectionQuestions = $exam->questions
                    ->where('qSkill', 'listening')
                    ->where('qPart', $partNumber)
                    ->filter(function ($q) use ($s, $qStart, $qPerSec) {
                        $qSec = $q->qData['section_number'] ?? null;
                        if ($qSec !== null) return $qSec == $s;
                        // Compute từ question_number (relative index trong part)
                        $qNum = $q->qData['question_number'] ?? $q->qSection_order ?? 0;
                        $relIdx = $qNum - $qStart;
                        if ($relIdx < 0) $relIdx = 0;
                        $computed = intdiv($relIdx, max(1, $qPerSec)) + 1;
                        return $computed == $s;
                    })
                    ->sortBy('qSection_order')
                    ->values();

                $storedAudio   = $block->content ?? '';
                $audioFilename = $storedAudio ? basename(parse_url($storedAudio, PHP_URL_PATH)) : '';
                $sections[] = [
                    'sectionNumber' => $s,
                    'sectionName'   => $block->metadata['section_name'] ?? "{$layout['sectionLabel']} {$s}",
                    'audioUrl'      => $audioFilename ? url('files/audio/' . $audioFilename) : '',
                    'audioDuration' => $block->metadata['audio_duration'] ?? 0,
                    'transcript'    => $block->metadata['transcript'] ?? '',
                    'questionStart' => $layout['questionStart'] + ($s - 1) * $qPerSection,
                    'questionsPerSection' => $qPerSection,
                    'questions'     => $sectionQuestions->map(function ($q) {
                        return [
                            'questionNumber' => $q->qData['question_number'] ?? $q->qSection_order,
                            'questionText' => $q->qContent,
                            'options' => $q->qData['options'] ?? (function() use ($q) {
                                $sorted = ($q->answers ?? collect())->sortBy(fn($ans) => $ans->aOrder !== null ? $ans->aOrder : $ans->aId)->values();
                                return [
                                    'A' => $sorted[0]->aContent ?? '',
                                    'B' => $sorted[1]->aContent ?? '',
                                    'C' => $sorted[2]->aContent ?? '',
                                    'D' => $sorted[3]->aContent ?? '',
                                ];
                            })(),
                            'correctAnswer' => $q->qData['correct_answer'] ?? 'A',
                            'explanation' => $q->qExplanation,
                        ];
                    })->values()->toArray(),
                ];
            }

            $parts[] = [
                'partNumber'   => $partNumber,
                'partName'     => "Part {$partNumber}",
                'sectionCount' => $sectionCount,
                'questionsPerSection' => $qPerSection,
                'sections'     => $sections,
            ];
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'exam_id' => $exam->eId,
                'title' => $exam->eTitle,
                'parts' => $parts,
            ]
        ]);
    }

    /* ========================================
     * VSTEP WRITING APIs
     * ======================================== */

    /**
     * POST /api/teacher/exams/{examId}/vstep/writing/tasks/{taskNumber}
     * Lưu một task của đề VSTEP Writing
     */
    public function saveVstepWritingTask(Request $request, $examId, $taskNumber)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        // Validate task number
        if (!in_array($taskNumber, [1, 2])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Task number không hợp lệ. Chỉ có Task 1, 2.'
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'taskName' => 'required|string',
            'prompt' => 'required|string',
            'wordCount' => 'required|array|size:2',
            'wordCount.0' => 'required|integer|min:1',
            'wordCount.1' => 'required|integer|min:1',
            'timeLimit' => 'required|integer|min:1',
            'explanation' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        DB::beginTransaction();
        try {
            // Find or create exam
            $exam = Exam::where('eId', $examId)
                       
                       ->first();

            if (!$exam) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Không tìm thấy đề thi. Vui lòng tạo đề trước khi lưu task.'
                ], 404);
            }

            // Delete existing writing question for this task (DON'T touch listening/reading)
            $oldQs = Question::where('exam_id', $exam->eId)
                ->where('qSkill', 'writing')
                ->where('qPart', $taskNumber)
                ->get();
            foreach ($oldQs as $oq) {
                Answer::where('question_id', $oq->qId)->delete();
                $oq->delete();
            }

            // Find or create content_block for this writing task (avoid duplicates)
            $contentBlock = \App\Models\ContentBlock::where('exam_id', $exam->eId)
                ->where('block_type', 'instruction')
                ->get()
                ->first(function ($b) use ($taskNumber) {
                    $meta = $b->metadata ?? [];
                    return ($meta['task_number'] ?? null) == $taskNumber;
                });

            $blockData = [
                'exam_id' => $exam->eId,
                'block_type' => 'instruction',
                'content' => $request->prompt,
                'metadata' => [
                    'task_number' => $taskNumber,
                    'task_name' => $request->taskName,
                    'word_count' => $request->wordCount,
                    'time_limit' => $request->timeLimit,
                ],
                'display_order' => $taskNumber,
            ];
            if ($contentBlock) {
                $contentBlock->update($blockData);
            } else {
                $contentBlock = \App\Models\ContentBlock::create($blockData);
            }

            // Create question (writing task)
            $question = Question::create([
                'exam_id' => $exam->eId,
                'content_block_id' => $contentBlock->id,
                'qContent' => $request->prompt,
                'qType' => 'essay',
                'qSection' => 'writing',
                'qSkill' => 'writing',
                'qPart' => $taskNumber,
                'qSection_order' => $taskNumber,
                'qPoints' => $taskNumber === 1 ? 33 : 67, // Task 1: 33%, Task 2: 67%
                'qExplanation' => $request->explanation ?? null,
                'qData' => [
                    'task_number' => $taskNumber,
                    'task_name' => $request->taskName,
                    'word_count' => $request->wordCount,
                    'time_limit' => $request->timeLimit,
                ],
            ]);

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Đã lưu Task ' . $taskNumber . ' thành công',
                'data' => [
                    'exam_id' => $exam->eId,
                    'task_number' => $taskNumber,
                    'word_count' => $request->wordCount,
                    'time_limit' => $request->timeLimit,
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi khi lưu Task: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /api/teacher/exams/{examId}/vstep/writing/publish
     * Xuất bản đề VSTEP Writing hoàn chỉnh
     */
    public function publishVstepWritingExam(Request $request, $examId)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'tasks' => 'required|array|size:2',
            'tasks.*.taskNumber' => 'required|integer|min:1|max:2',
            'tasks.*.taskName' => 'required|string',
            'tasks.*.prompt' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        DB::beginTransaction();
        try {
            // Find exam
            $exam = Exam::where('eId', $examId)
                       
                       ->first();

            if (!$exam) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Không tìm thấy đề thi.'
                ], 404);
            }

            // Update exam title and status (theo cài đặt auto-duyệt)
            $moderationStatus = Exam::resolveModerationStatus();
            $exam->update([
                'eTitle' => $request->title,
                'eIs_private' => $moderationStatus !== 'published',
                'eStatus' => $moderationStatus,
            ]);

            // Verify both tasks exist
            $questionCount = Question::where('exam_id', $exam->eId)->count();
            if ($questionCount < 2) {
                DB::rollBack();
                return response()->json([
                    'status' => 'error',
                    'message' => 'Đề thi chưa đủ 2 tasks (Task 1 + Task 2).',
                    'data' => [
                        'current_tasks' => $questionCount,
                        'required_tasks' => 2,
                    ]
                ], 400);
            }

            // Create practice session
            $practiceSession = DB::table('practice_sessions')->insertGetId([
                'ps_title' => $request->title,
                'ps_description' => 'Đề luyện tập VSTEP Writing - 2 Tasks',
                'ps_type' => 'skill_based',
                'ps_purpose' => 'practice',
                'ps_target_skill' => 'writing',
                'ps_difficulty' => 'medium',
                'ps_duration_minutes' => 60,
                'ps_teacher_id' => $user->uId,
                'ps_exam_id' => $exam->eId,
                'ps_is_active' => true,
                'ps_created_at' => now(),
                'ps_updated_at' => now(),
            ]);

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Đã xuất bản đề thi thành công',
                'data' => [
                    'exam_id' => $exam->eId,
                    'exam_title' => $exam->eTitle,
                    'practice_session_id' => $practiceSession,
                    'total_tasks' => $questionCount,
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi khi xuất bản đề thi: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /api/teacher/exams/{examId}/vstep/writing/load
     * Load existing VSTEP Writing exam
     */
    public function loadVstepWritingExam(Request $request, $examId)
    {
        $user = $request->user();

        if (!$user || !in_array($user->uRole, ['teacher', 'admin'], true)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $isAdmin = $user->uRole === 'admin';

        $exam = Exam::where('eId', $examId)
                   ->when(false, fn($q) => $q)
                   ->with([
                       'contentBlocks' => function($q) {
                           $q->orderBy('display_order');
                       },
                       'questions' => function($q) {
                           $q->orderBy('qPart');
                       }
                   ])
                   ->first();

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy đề thi.'
            ], 404);
        }

        // Organize data by tasks
        $tasks = [];
        for ($i = 1; $i <= 2; $i++) {
            $taskQuestion = $exam->questions->where('qPart', $i)->first();
            $contentBlock = $exam->contentBlocks->where('metadata.task_number', $i)->first();

            if ($taskQuestion && $contentBlock) {
                $tasks[] = [
                    'taskNumber' => $i,
                    'taskName' => $contentBlock->metadata['task_name'] ?? "Task $i",
                    'prompt' => $contentBlock->content ?? '',
                    'wordCount' => $contentBlock->metadata['word_count'] ?? [150, 250],
                    'timeLimit' => $contentBlock->metadata['time_limit'] ?? 20,
                ];
            }
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'exam_id' => $exam->eId,
                'title' => $exam->eTitle,
                'tasks' => $tasks,
            ]
        ]);
    }

    /* ========================================
     * VSTEP SPEAKING APIs
     * ======================================== */

    /**
     * POST /api/teacher/exams/{examId}/vstep/speaking/parts/{partNumber}
     * Lưu một part của đề VSTEP Speaking (NEW FORMAT)
     */
    public function saveVstepSpeakingPart(Request $request, $examId, $partNumber)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        // Validate part number
        if (!in_array($partNumber, [1, 2, 3])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Part number không hợp lệ. Chỉ có Part 1, 2, 3.'
            ], 400);
        }

        // NEW FORMAT: Accept part1Data, part2Data, part3Data
        $validator = Validator::make($request->all(), [
            'partName' => 'required|string',
            'timeLimit' => 'required|integer|min:1',
            'part1Data' => 'nullable|array',
            'part1Data.*.topicName' => 'required_with:part1Data|string',
            'part1Data.*.questions' => 'required_with:part1Data|array|size:3',
            'part1Data.*.explanations' => 'nullable|array',
            'part2Data' => 'nullable|array',
            'part2Data.situation' => 'required_with:part2Data|string',
            'part2Data.solutions' => 'required_with:part2Data|array|size:3',
            'part2Data.question' => 'required_with:part2Data|string',
            'part2Data.explanation' => 'nullable|string',
            'part3Data' => 'nullable|array',
            'part3Data.mainTopic' => 'required_with:part3Data|string',
            'part3Data.suggestedIdeas' => 'required_with:part3Data|array|min:3',
            'part3Data.followUpQuestions' => 'required_with:part3Data|array|min:2',
            'part3Data.explanation' => 'nullable|string',
            'part3Data.followUpExplanations' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        DB::beginTransaction();
        try {
            // Part/task save APIs must never create a new exam. The exam scope
            // is decided once at the parent exam level.
            $exam = Exam::where('eId', $examId)
                       
                       ->first();

            if (!$exam) {
                DB::rollBack();
                return response()->json([
                    'status' => 'error',
                    'message' => 'Không tìm thấy đề thi.'
                ], 404);
            }

            // Delete existing content blocks and questions for THIS Speaking part only.
            // CRITICAL: filter by block_type='instruction' để không xoá Reading passage
            // (cũng có metadata->part_number trùng) hoặc Listening audio.
            $existingBlocks = \App\Models\ContentBlock::where('exam_id', $exam->eId)
                ->where('block_type', 'instruction')
                ->whereJsonContains('metadata->part_number', $partNumber)
                ->get();

            foreach ($existingBlocks as $block) {
                // Chỉ xoá questions thuộc Speaking skill
                Question::where('content_block_id', $block->id)
                    ->where('qSkill', 'speaking')
                    ->delete();
                $block->delete();
            }

            // Đồng thời xoá orphan Speaking questions của part này (không gắn block)
            Question::where('exam_id', $exam->eId)
                ->where('qSkill', 'speaking')
                ->where('qPart', $partNumber)
                ->delete();

            // Create content block for part
            $contentBlock = \App\Models\ContentBlock::create([
                'exam_id' => $exam->eId,
                'block_type' => 'instruction',
                'content' => $request->partName,
                'metadata' => [
                    'part_number' => $partNumber,
                    'part_name' => $request->partName,
                    'time_limit' => $request->timeLimit,
                    'part1Data' => $request->part1Data ?? null,
                    'part2Data' => $request->part2Data ?? null,
                    'part3Data' => $request->part3Data ?? null,
                ],
                'display_order' => $partNumber,
            ]);

            // Create questions based on part type
            $questionsCreated = 0;

            if ($partNumber == 1 && $request->has('part1Data')) {
                // Part 1: Topics with 3 questions each
                foreach ($request->part1Data as $topicIndex => $topic) {
                    foreach ($topic['questions'] as $qIndex => $questionText) {
                        if (!empty($questionText)) {
                            Question::create([
                                'exam_id' => $exam->eId,
                                'content_block_id' => $contentBlock->id,
                                'qContent' => $questionText,
                                'qType' => 'speaking_interaction',
                                'qSection' => 'speaking',
                                'qSkill' => 'speaking',
                                'qPart' => $partNumber,
                                'qSection_order' => ($topicIndex * 3) + $qIndex + 1,
                                'qPoints' => 1,
                                'qExplanation' => $topic['explanations'][$qIndex] ?? null,
                                'qData' => [
                                    'part_number' => $partNumber,
                                    'topic_name' => $topic['topicName'],
                                    'topic_index' => $topicIndex,
                                    'question_index' => $qIndex,
                                ],
                            ]);
                            $questionsCreated++;
                        }
                    }
                }
            } elseif ($partNumber == 2 && $request->has('part2Data')) {
                // Part 2: Situation + 3 Solutions + Question
                $part2 = $request->part2Data;
                Question::create([
                    'exam_id' => $exam->eId,
                    'content_block_id' => $contentBlock->id,
                    'qContent' => $part2['question'],
                    'qType' => 'speaking_solution',
                    'qSection' => 'speaking',
                    'qSkill' => 'speaking',
                    'qPart' => $partNumber,
                    'qSection_order' => 1,
                    'qPoints' => 1,
                    'qExplanation' => $part2['explanation'] ?? null,
                    'qData' => [
                        'part_number' => $partNumber,
                        'situation' => $part2['situation'],
                        'solutions' => $part2['solutions'],
                        'question' => $part2['question'],
                    ],
                ]);
                $questionsCreated++;
            } elseif ($partNumber == 3 && $request->has('part3Data')) {
                // Part 3: Main Topic + Ideas + Follow-up Questions
                $part3 = $request->part3Data;
                
                // Main topic question
                Question::create([
                    'exam_id' => $exam->eId,
                    'content_block_id' => $contentBlock->id,
                    'qContent' => $part3['mainTopic'],
                    'qType' => 'speaking_topic',
                    'qSection' => 'speaking',
                    'qSkill' => 'speaking',
                    'qPart' => $partNumber,
                    'qSection_order' => 1,
                    'qPoints' => 1,
                    'qExplanation' => $part3['explanation'] ?? null,
                    'qData' => [
                        'part_number' => $partNumber,
                        'main_topic' => $part3['mainTopic'],
                        'suggested_ideas' => $part3['suggestedIdeas'],
                        'question_type' => 'main_topic',
                    ],
                ]);
                $questionsCreated++;
                
                // Follow-up questions
                foreach ($part3['followUpQuestions'] as $qIndex => $questionText) {
                    if (!empty($questionText)) {
                        Question::create([
                            'exam_id' => $exam->eId,
                            'content_block_id' => $contentBlock->id,
                            'qContent' => $questionText,
                            'qType' => 'speaking_topic',
                            'qSection' => 'speaking',
                            'qSkill' => 'speaking',
                            'qPart' => $partNumber,
                            'qSection_order' => $qIndex + 2,
                            'qPoints' => 1,
                            'qExplanation' => $part3['followUpExplanations'][$qIndex] ?? null,
                            'qData' => [
                                'part_number' => $partNumber,
                                'main_topic' => $part3['mainTopic'],
                                'question_type' => 'follow_up',
                                'question_index' => $qIndex,
                            ],
                        ]);
                        $questionsCreated++;
                    }
                }
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Đã lưu Part ' . $partNumber . ' thành công',
                'data' => [
                    'exam_id' => $exam->eId,
                    'part_number' => $partNumber,
                    'questions_saved' => $questionsCreated,
                    'time_limit' => $request->timeLimit,
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi khi lưu Part: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /api/teacher/exams/{examId}/vstep/speaking/publish
     * Xuất bản đề VSTEP Speaking hoàn chỉnh
     */
    public function publishVstepSpeakingExam(Request $request, $examId)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'parts' => 'required|array|size:3',
            'parts.*.partNumber' => 'required|integer|min:1|max:3',
            'parts.*.partName' => 'required|string',
            'parts.*.questions' => 'required|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        DB::beginTransaction();
        try {
            // Find exam
            $exam = Exam::where('eId', $examId)
                       
                       ->first();

            if (!$exam) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Không tìm thấy đề thi.'
                ], 404);
            }

            // Update exam title and status (theo cài đặt auto-duyệt)
            $moderationStatus = Exam::resolveModerationStatus();
            $exam->update([
                'eTitle' => $request->title,
                'eIs_private' => $moderationStatus !== 'published',
                'eStatus' => $moderationStatus,
            ]);

            // Verify all 3 parts exist
            $questionCount = Question::where('exam_id', $exam->eId)->count();
            if ($questionCount < 3) {
                DB::rollBack();
                return response()->json([
                    'status' => 'error',
                    'message' => 'Đề thi chưa đủ 3 parts (Part 1, 2, 3).',
                    'data' => [
                        'current_questions' => $questionCount,
                        'required_parts' => 3,
                    ]
                ], 400);
            }

            // Create practice session
            $practiceSession = DB::table('practice_sessions')->insertGetId([
                'ps_title' => $request->title,
                'ps_description' => 'Đề luyện tập VSTEP Speaking - 3 Parts',
                'ps_type' => 'skill_based',
                'ps_purpose' => 'practice',
                'ps_target_skill' => 'speaking',
                'ps_difficulty' => 'medium',
                'ps_duration_minutes' => 12,
                'ps_teacher_id' => $user->uId,
                'ps_exam_id' => $exam->eId,
                'ps_is_active' => true,
                'ps_created_at' => now(),
                'ps_updated_at' => now(),
            ]);

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Đã xuất bản đề thi thành công',
                'data' => [
                    'exam_id' => $exam->eId,
                    'exam_title' => $exam->eTitle,
                    'practice_session_id' => $practiceSession,
                    'total_questions' => $questionCount,
                    'parts' => 3,
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi khi xuất bản đề thi: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /api/teacher/exams/{examId}/vstep/speaking/load
     * Load existing VSTEP Speaking exam (NEW FORMAT)
     */
    public function loadVstepSpeakingExam(Request $request, $examId)
    {
        $user = $request->user();

        if (!$user || !in_array($user->uRole, ['teacher', 'admin'], true)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $isAdmin = $user->uRole === 'admin';

        $exam = Exam::where('eId', $examId)
                   ->when(false, fn($q) => $q)
                   ->with([
                       'contentBlocks' => function($q) {
                           $q->orderBy('display_order');
                       },
                       'questions' => function($q) {
                           // FIXED: Only load speaking questions
                           $q->where('qSkill', 'speaking')
                             ->orderBy('qPart')
                             ->orderBy('qSection_order');
                       }
                   ])
                   ->first();

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy đề thi.'
            ], 404);
        }

        // Organize data by parts (NEW FORMAT)
        $parts = [];
        for ($i = 1; $i <= 3; $i++) {
            // FIXED: Filter content blocks to only get speaking parts (those with part1Data/part2Data/part3Data)
            $contentBlock = $exam->contentBlocks->first(function($block) use ($i) {
                $metadata = $block->metadata ?? [];
                return isset($metadata['part_number']) && 
                       $metadata['part_number'] == $i &&
                       (isset($metadata['part1Data']) || isset($metadata['part2Data']) || isset($metadata['part3Data']));
            });
            
            if (!$contentBlock) {
                // Return empty structure if part doesn't exist
                $parts[] = [
                    'partNumber' => $i,
                    'partName' => "Part $i",
                    'timeLimit' => $i === 1 ? 3 : ($i === 2 ? 4 : 5),
                ];
                continue;
            }

            $partData = [
                'partNumber' => $i,
                'partName' => $contentBlock->metadata['part_name'] ?? "Part $i",
                'timeLimit' => $contentBlock->metadata['time_limit'] ?? 3,
            ];

            // Add part-specific data from metadata
            if (isset($contentBlock->metadata['part1Data'])) {
                $partData['part1Data'] = $contentBlock->metadata['part1Data'];
            } elseif (isset($contentBlock->metadata['part2Data'])) {
                $partData['part2Data'] = $contentBlock->metadata['part2Data'];
            } elseif (isset($contentBlock->metadata['part3Data'])) {
                $partData['part3Data'] = $contentBlock->metadata['part3Data'];
            }

            $parts[] = $partData;
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'exam_id' => $exam->eId,
                'title' => $exam->eTitle,
                'parts' => $parts,
            ]
        ]);
    }
}

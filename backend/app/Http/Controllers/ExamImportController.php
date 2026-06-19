<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use App\Models\Exam;
use App\Models\Question;
use App\Models\Answer;

class ExamImportController extends Controller
{
    /**
     * @OA\Post(
     *     path="/teacher/exams/import",
     *     tags={"Exams"},
     *     summary="Import exam from JSON",
     *     description="Import exam from Gemini AI parsed JSON format",
     *     security={{"bearerAuth":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"eTitle","eType","eSkill","eDuration_minutes","questions"},
     *             @OA\Property(property="eTitle", type="string"),
     *             @OA\Property(property="eDescription", type="string"),
     *             @OA\Property(property="eType", type="string", enum={"VSTEP","IELTS","GENERAL"}),
     *             @OA\Property(property="eSkill", type="string", enum={"listening","reading","writing","speaking","mixed"}),
     *             @OA\Property(property="eDuration_minutes", type="integer"),
     *             @OA\Property(property="eDifficulty", type="string", enum={"easy","medium","hard"}),
     *             @OA\Property(property="eTarget_level", type="string"),
     *             @OA\Property(property="questions", type="array", @OA\Items(type="object"))
     *         )
     *     ),
     *     @OA\Response(response=201, description="Exam imported successfully"),
     *     @OA\Response(response=400, description="Validation error")
     * )
     * 
     * POST /api/teacher/exams/import
     * Import exam từ JSON (từ Gemini AI hoặc converted format)
     */
    public function import(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'eTitle' => 'required|string|max:255',
            'eDescription' => 'nullable|string',
            'eType' => 'required|in:VSTEP,IELTS,GENERAL',
            'eSkill' => 'required|in:listening,reading,writing,speaking,mixed',
            'eDuration_minutes' => 'required|integer|min:1',
            'eIs_private' => 'nullable|boolean',
            'eDifficulty' => 'nullable|in:easy,medium,hard',
            'eTarget_level' => 'nullable|string|max:10',
            'questions' => 'required|array|min:1',
            'questions.*.qContent' => 'required|string',
            'questions.*.qType' => 'nullable|string',
            'questions.*.qPoints' => 'required|integer|min:0',
            'questions.*.qDifficulty' => 'nullable|in:easy,medium,hard',
            'questions.*.qSection' => 'nullable|string',
            'questions.*.qSkill' => 'nullable|string',
            'questions.*.qPart' => 'nullable|integer',
            'questions.*.qPassage_text' => 'nullable|string',
            'questions.*.qExplanation' => 'nullable|string',
            'questions.*.qTags' => 'nullable|array',
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

        try {
            DB::beginTransaction();

            // Create exam
            $moderationStatus = Exam::resolveModerationStatus();
            $scope = $request->eSkill === 'mixed' ? 'full' : 'skill';
            $exam = Exam::create([
                'eTitle' => $request->eTitle,
                'eDescription' => $request->eDescription,
                'eType' => $request->eType,
                'eSkill' => $request->eSkill,
                'eScope' => $scope,
                'ePart_type' => null,
                'ePart_number' => null,
                'eTeacher_id' => $user->uId,
                'eDuration_minutes' => $request->eDuration_minutes,
                'eIs_private' => $request->eIs_private ?? ($moderationStatus !== 'published'),
                'eStatus' => $moderationStatus,
                'eSource_type' => 'upload',
                'eDifficulty' => $request->eDifficulty ?? 'medium',
                'eTarget_level' => $request->eTarget_level,
            ]);

            $questionsAdded = 0;
            $totalPoints = 0;

            // Create questions and answers
            foreach ($request->questions as $questionData) {
                $question = Question::create([
                    'exam_id' => $exam->eId,
                    'qContent' => $questionData['qContent'],
                    'qPoints' => $questionData['qPoints'],
                    'qMedia_url' => $questionData['qMedia_url'] ?? null,
                    'qTranscript' => $questionData['qTranscript'] ?? null,
                    'qExplanation' => $questionData['qExplanation'] ?? null,
                    'qListen_limit' => $questionData['qListen_limit'] ?? 1,
                ]);

                // Create answers
                foreach ($questionData['answers'] as $answerData) {
                    Answer::create([
                        'question_id' => $question->qId,
                        'aContent' => $answerData['aContent'],
                        'aIs_correct' => $answerData['aIs_correct'],
                    ]);
                }

                $questionsAdded++;
                $totalPoints += $questionData['qPoints'];
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Import đề thi thành công',
                'data' => [
                    'examId' => $exam->eId,
                    'title' => $exam->eTitle,
                    'questions_count' => $questionsAdded,
                    'total_points' => $totalPoints,
                ]
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi hệ thống khi import đề thi.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /api/teacher/exams/import/validate
     * Validate JSON trước khi import
     */
    public function validateImport(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'eTitle' => 'required|string|max:255',
            'eType' => 'required|in:VSTEP,IELTS,GENERAL',
            'eSkill' => 'required|in:listening,reading,writing,speaking,mixed',
            'eDuration_minutes' => 'required|integer|min:1',
            'questions' => 'required|array|min:1',
            'questions.*.qContent' => 'required|string',
            'questions.*.qPoints' => 'required|integer|min:0',
            'questions.*.answers' => 'required|array|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors(),
                'valid' => false
            ], 400);
        }

        // Additional validation
        $issues = [];
        $warnings = [];
        
        foreach ($request->questions as $index => $questionData) {
            $questionNum = $index + 1;
            
            // Check if question has at least one correct answer
            $hasCorrectAnswer = false;
            if (isset($questionData['answers'])) {
                foreach ($questionData['answers'] as $answer) {
                    if (isset($answer['aIs_correct']) && $answer['aIs_correct']) {
                        $hasCorrectAnswer = true;
                        break;
                    }
                }
            }
            
            if (!$hasCorrectAnswer) {
                $issues[] = "Câu hỏi #{$questionNum} không có đáp án đúng";
            }
            
            // Check for empty content
            if (empty(trim($questionData['qContent']))) {
                $issues[] = "Câu hỏi #{$questionNum} không có nội dung";
            }
            
            // Warnings for missing optional fields
            if (empty($questionData['qDifficulty'])) {
                $warnings[] = "Câu hỏi #{$questionNum} chưa có độ khó";
            }
        }

        $totalQuestions = count($request->questions);
        $totalPoints = array_sum(array_column($request->questions, 'qPoints'));

        return response()->json([
            'status' => 'success',
            'valid' => empty($issues),
            'data' => [
                'total_questions' => $totalQuestions,
                'total_points' => $totalPoints,
                'issues' => $issues,
                'warnings' => $warnings,
                'exam_info' => [
                    'title' => $request->eTitle,
                    'type' => $request->eType,
                    'skill' => $request->eSkill,
                    'duration' => $request->eDuration_minutes,
                ]
            ]
        ]);
    }
}

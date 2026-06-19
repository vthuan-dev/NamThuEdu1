<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use App\Models\Exam;
use App\Models\Question;
use App\Models\Answer;

/**
 * Test Exam Controller - NO AUTH REQUIRED
 * For development testing only
 */
class TestExamController extends Controller
{
    /**
     * Store a new exam (TEST - No auth required)
     */
    public function store(Request $request)
    {
        // NO AUTH CHECK for testing
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'type' => 'required|in:VSTEP,IELTS,GENERAL',
            'skill' => 'required|in:Mixed,Listening,Reading,Writing,Speaking',
            'duration' => 'required|integer|min:1',
            'duration_unit' => 'nullable|in:minutes,hours',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        $skill = $this->normalizeSkill($request->skill);
        $exam = Exam::create([
            'eTitle' => $request->title,
            'eDescription' => $request->description,
            'eType' => $request->type,
            'eSkill' => $skill,
            'eScope' => $skill === 'mixed' ? 'full' : 'skill',
            'eTeacher_id' => 1, // Default teacher ID for testing
            'eDuration_minutes' => $request->duration,
            'eIs_private' => false,
            'eSource_type' => 'manual',
        ]);

        // Process questions if provided
        if ($request->has('questions') && is_array($request->questions)) {
            foreach ($request->questions as $questionData) {
                if (empty($questionData['text']) && empty($questionData['passage'])) {
                    continue; // Skip empty questions
                }

                $question = Question::create([
                    'exam_id' => $exam->eId,
                    'qExam_id' => $exam->eId,
                    'qContent' => $questionData['text'] ?? '',
                    'qType' => $this->normalizeQuestionType($questionData['type'] ?? 'multiple_choice'),
                    'qSkill' => $this->normalizeSkill($questionData['skill'] ?? $skill),
                    'qPart' => $questionData['part'] ?? 1,
                    'qOrder' => $questionData['order'] ?? 1,
                    'qPoints' => $questionData['points'] ?? 1,
                    'qPassage' => $questionData['passage'] ?? null,
                    'qMedia_url' => $questionData['audioFile'] ?? null,
                ]);

                // Process answers
                if (isset($questionData['answers']) && is_array($questionData['answers'])) {
                    foreach ($questionData['answers'] as $answerData) {
                        if (!empty($answerData['text'])) {
                            Answer::create([
                                'aQuestion_id' => $question->qId,
                                'aContent' => $answerData['text'],
                                'aIs_correct' => $answerData['isCorrect'] ?? false,
                            ]);
                        }
                    }
                }
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Exam created successfully',
            'exam' => [
                'id' => $exam->eId,
                'title' => $exam->eTitle,
                'type' => $exam->eType,
                'skill' => $exam->eSkill,
            ]
        ], 201);
    }

    /**
     * Get exam by ID (TEST - No auth required)
     */
    public function show($id)
    {
        $exam = Exam::with(['questions.answers'])->find($id);

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Exam not found'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'exam' => [
                'id' => $exam->eId,
                'title' => $exam->eTitle,
                'description' => $exam->eDescription,
                'type' => $exam->eType,
                'skill' => $exam->eSkill,
                'duration' => $exam->eDuration_minutes,
                'duration_unit' => 'minutes',
                'exam_metadata' => null,
                'questions' => $exam->questions->map(function ($question) {
                    return [
                        'id' => $question->qId,
                        'text' => $question->qContent,
                        'type' => $question->qType,
                        'skill' => $question->qSkill,
                        'part' => $question->qPart,
                        'order' => $question->qOrder ?? $question->qSection_order,
                        'points' => $question->qPoints,
                        'passage' => $question->qPassage_text ?? $question->qPassage,
                        'audioFile' => $question->qMedia_url,
                        'answers' => $question->answers->map(function ($answer) {
                            return [
                                'id' => $answer->aId,
                                'text' => $answer->aContent,
                                'isCorrect' => $answer->aIs_correct,
                            ];
                        }),
                    ];
                }),
                'updated_at' => $exam->updated_at,
            ]
        ]);
    }

    /**
     * Update exam (TEST - No auth required)
     */
    public function update(Request $request, $id)
    {
        $exam = Exam::find($id);

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Exam not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'type' => 'sometimes|required|in:VSTEP,IELTS,GENERAL',
            'skill' => 'sometimes|required|in:Mixed,Listening,Reading,Writing,Speaking',
            'duration' => 'sometimes|required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 400);
        }

        $skill = $request->has('skill') ? $this->normalizeSkill($request->skill) : $exam->eSkill;

        // Update exam
        $exam->update([
            'eTitle' => $request->get('title', $exam->eTitle),
            'eDescription' => $request->get('description', $exam->eDescription),
            'eType' => $request->get('type', $exam->eType),
            'eSkill' => $skill,
            'eScope' => $skill === 'mixed' ? 'full' : 'skill',
            'eDuration_minutes' => $request->get('duration', $exam->eDuration_minutes),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Exam updated successfully',
            'exam' => [
                'id' => $exam->eId,
                'title' => $exam->eTitle,
                'type' => $exam->eType,
                'skill' => $exam->eSkill,
            ]
        ]);
    }

    /**
     * Normalize question types
     */
    private function normalizeQuestionType($type)
    {
        $typeMap = [
            'multiple-choice' => 'multiple_choice',
            'true-false' => 'true_false',
            'fill-blank' => 'fill_blank',
            'short-answer' => 'short_answer',
            'essay' => 'essay',
            'matching' => 'reading_matching',
            'listening' => 'listening_multiple_choice',
            'speaking' => 'speaking_response',
        ];

        return $typeMap[$type] ?? 'multiple_choice';
    }

    private function normalizeSkill($skill): string
    {
        $normalized = strtolower((string) $skill);
        return in_array($normalized, ['listening', 'reading', 'writing', 'speaking', 'mixed'], true)
            ? $normalized
            : 'listening';
    }
}

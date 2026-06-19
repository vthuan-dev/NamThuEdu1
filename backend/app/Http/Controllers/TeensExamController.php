<?php

namespace App\Http\Controllers;

use App\Models\Answer;
use App\Models\Exam;
use App\Models\Question;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * TeensExamController — tạo đề thi LISTENING và SPEAKING cho học viên Teens (13–17).
 *
 * Mô hình dữ liệu: quan hệ Exam + Question + Answer (giống TeensExamSeeder),
 * để tái sử dụng tối đa hạ tầng sẵn có:
 *   - Player teens (TeensTestTaking) chạy theo exam.questions, đã phát qMedia_url
 *     và render trắc nghiệm → Listening tự chấm.
 *   - Speaking: học viên ghi âm → upload vào sGemini_feedback['speaking_audio'],
 *     submit kích hoạt GradeVstepSubjectiveJob → VstepGradingService.gradeSpeaking
 *     (bắt theo qSkill='speaking' + qPart) chấm bằng Groq Whisper + LLM.
 *
 * Endpoints (teacher):
 *   POST /api/teacher/exams/teens   → tạo đề listening hoặc speaking
 */
class TeensExamController extends Controller
{
    /**
     * POST /api/teacher/exams/teens
     *
     * Body chung: { skill, eTitle, eDescription?, eDuration_minutes? }
     *  - skill = 'listening':
     *      groups: [ { audio_url, questions: [ { qContent, options:[{content,isCorrect}] } ] } ]
     *  - skill = 'speaking':
     *      parts: [ { qContent, prepSeconds?, speakSeconds? } ]
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'teacher') {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 401);
        }

        $skill = strtolower((string) $request->input('skill'));
        if (!in_array($skill, ['listening', 'speaking'], true)) {
            return response()->json(['status' => 'error', 'message' => 'Kỹ năng không hợp lệ (chỉ listening hoặc speaking).'], 400);
        }

        $rules = [
            'eTitle'            => 'required|string|max:255',
            'eDescription'      => 'nullable|string',
            'eDuration_minutes' => 'nullable|integer|min:1|max:300',
            'eScope'            => 'nullable|in:skill,part',
            'ePart_type'        => 'nullable|string|max:64',
            'ePart_number'      => 'nullable|integer|min:1|max:99',
        ];

        if ($skill === 'listening') {
            $rules = array_merge($rules, [
                'groups'                          => 'required|array|min:1',
                'groups.*.audio_url'              => 'nullable|string|max:1000',
                'groups.*.questions'              => 'required|array|min:1',
                'groups.*.questions.*.qContent'   => 'required|string',
                'groups.*.questions.*.options'    => 'required|array|min:2',
                'groups.*.questions.*.options.*.content'   => 'required|string',
                'groups.*.questions.*.options.*.isCorrect' => 'required|boolean',
            ]);
        } else { // speaking
            $rules = array_merge($rules, [
                'parts'                 => 'required|array|min:1',
                'parts.*.qContent'      => 'required|string',
                'parts.*.prepSeconds'   => 'nullable|integer|min:0|max:600',
                'parts.*.speakSeconds'  => 'nullable|integer|min:10|max:1200',
            ]);
        }

        $validator = Validator::make($request->all(), $rules);
        if ($validator->fails()) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors'  => $validator->errors(),
            ], 400);
        }

        // Listening: bắt buộc mỗi câu có đúng 1 đáp án đúng
        if ($skill === 'listening') {
            foreach ($request->input('groups', []) as $gi => $group) {
                foreach (($group['questions'] ?? []) as $qi => $q) {
                    $correct = collect($q['options'] ?? [])->filter(fn($o) => filter_var($o['isCorrect'] ?? false, FILTER_VALIDATE_BOOLEAN))->count();
                    if ($correct < 1) {
                        return response()->json([
                            'status'  => 'error',
                            'message' => "Phần " . ($gi + 1) . ", câu " . ($qi + 1) . " chưa chọn đáp án đúng.",
                        ], 400);
                    }
                }
            }
        }

        $duration = (int) ($request->input('eDuration_minutes') ?: ($skill === 'speaking' ? 15 : 30));
        $moderationStatus = Exam::resolveModerationStatus();
        $scope = $request->input('eScope', 'skill');

        try {
            $examId = DB::transaction(function () use ($request, $user, $skill, $duration, $moderationStatus, $scope) {
                $exam = Exam::create([
                    'eTitle'            => $request->input('eTitle'),
                    'eDescription'      => $request->input('eDescription', ''),
                    'eType'             => 'GENERAL',
                    'eSkill'            => $skill,
                    'eScope'            => $scope,
                    'ePart_type'        => $scope === 'part' ? $request->input('ePart_type') : null,
                    'ePart_number'      => $scope === 'part' ? $request->input('ePart_number') : null,
                    'ePurpose'          => 'exam',
                    'eDifficulty'       => 'medium',
                    'eDuration_minutes' => $duration,
                    'eTotal_score'      => 100,
                    'ePass_score'       => 50,
                    'eStatus'           => $moderationStatus,
                    'eIs_private'       => $moderationStatus !== 'published',
                    'eTeacher_id'       => $user->uId,
                    'age_group'         => 'teens',
                ]);

                $order = 0;

                if ($skill === 'listening') {
                    foreach ($request->input('groups', []) as $gi => $group) {
                        $audioUrl = $group['audio_url'] ?? null;
                        foreach (($group['questions'] ?? []) as $q) {
                            $order++;
                            $question = Question::create([
                                'exam_id'        => $exam->eId,
                                'qContent'       => $q['qContent'],
                                'qType'          => 'multiple_choice',
                                'qSection'       => 'listening',
                                'qSkill'         => 'listening',
                                'qSection_order' => $order,
                                'qPart'          => $gi + 1,
                                'qMedia_url'     => $audioUrl,
                                'qPoints'        => 1,
                                'qDifficulty'    => 'medium',
                                'age_group'      => 'teens',
                            ]);

                            foreach (($q['options'] ?? []) as $opt) {
                                Answer::create([
                                    'question_id' => $question->qId,
                                    'aContent'    => $opt['content'],
                                    'aIs_correct' => filter_var($opt['isCorrect'] ?? false, FILTER_VALIDATE_BOOLEAN),
                                ]);
                            }
                        }
                    }
                } else { // speaking
                    foreach ($request->input('parts', []) as $pi => $part) {
                        $order++;
                        $speakSeconds = (int) ($part['speakSeconds'] ?? 120);
                        $prepSeconds  = (int) ($part['prepSeconds'] ?? 30);
                        Question::create([
                            'exam_id'        => $exam->eId,
                            'qContent'       => $part['qContent'],
                            'qType'          => 'speaking',
                            'qSection'       => 'speaking',
                            'qSkill'         => 'speaking',
                            'qSection_order' => $order,
                            'qPart'          => $pi + 1,
                            'qPoints'        => 10,
                            'qTime_limit'    => $speakSeconds,
                            'qDifficulty'    => 'medium',
                            'age_group'      => 'teens',
                            'qData'          => [
                                'prepSeconds'  => $prepSeconds,
                                'speakSeconds' => $speakSeconds,
                            ],
                        ]);
                    }
                }

                return $exam->eId;
            });
        } catch (\Throwable $e) {
            \Log::error('TeensExamController@store failed: ' . $e->getMessage());
            return response()->json(['status' => 'error', 'message' => 'Không tạo được đề thi. Vui lòng thử lại.'], 500);
        }

        $message = $moderationStatus === 'pending'
            ? 'Đã gửi đề thi, chờ quản trị viên duyệt.'
            : 'Đã tạo đề thi thành công.';

        return response()->json([
            'status' => 'success',
            'data'   => [
                'eId'     => $examId,
                'skill'   => $skill,
                'message' => $message,
            ],
        ]);
    }
}

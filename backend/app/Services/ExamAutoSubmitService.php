<?php

namespace App\Services;

use App\Http\Controllers\StudentTestController;
use App\Jobs\GradeVstepSubjectiveJob;
use App\Models\Submission;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * ExamAutoSubmitService
 *
 * Trung tâm xử lý auto-submit cho 3 nguồn kích hoạt:
 *   1. sendBeacon từ frontend (pagehide / visibilitychange)        → reason 'unload'
 *   2. Cron phát hiện hết giờ thi                                   → reason 'timeout'
 *   3. Cron phát hiện bài "câm" quá ngưỡng INACTIVITY_THRESHOLD_MIN → reason 'inactive'
 *
 * Triết lý chấm điểm: "Làm tới đâu chấm tới đó".
 *   - Câu đã trả lời  → chấm bình thường (theo logic gradeAnswers).
 *   - Câu trống       → 0 điểm.
 *   - Bài 0 câu       → 0/100, vẫn auto-submit (không hủy).
 *
 * Idempotent: nếu submission đã không còn ở `in_progress`, return current state.
 */
class ExamAutoSubmitService
{
    /** Ngưỡng "câm" mặc định (phút) để cron auto-submit. */
    public const INACTIVITY_THRESHOLD_MIN = 15;

    /** Các giá trị reason hợp lệ. */
    public const REASON_TIMEOUT  = 'timeout';
    public const REASON_INACTIVE = 'inactive';
    public const REASON_UNLOAD   = 'unload';
    public const REASON_RESTART  = 'restart';

    /**
     * Auto-submit 1 submission.
     *
     * @param  Submission  $submission  Đã eager-load: exam.questions.answers, answers
     * @param  string      $reason      One of REASON_* constants
     * @return array       ['ok' => bool, 'idempotent' => bool, 'data' => [...], 'message' => string]
     */
    public function autoSubmit(Submission $submission, string $reason): array
    {
        // Idempotent: đã nộp rồi → trả về current state, không làm gì
        if ($submission->sStatus !== 'in_progress') {
            return [
                'ok'         => true,
                'idempotent' => true,
                'data'       => [
                    'submissionId' => $submission->sId,
                    'sScore'       => $submission->sScore,
                    'sStatus'      => $submission->sStatus,
                    'autoSubmitReason' => $submission->auto_submit_reason,
                ],
                'message'    => 'Bài thi đã được xử lý trước đó.',
            ];
        }

        // Validate reason
        if (!in_array($reason, [self::REASON_TIMEOUT, self::REASON_INACTIVE, self::REASON_UNLOAD, self::REASON_RESTART], true)) {
            $reason = self::REASON_UNLOAD;
        }

        DB::beginTransaction();
        try {
            // Lock + reload to prevent race condition
            $submission = Submission::with(['exam.questions.answers', 'answers'])
                ->where('sId', $submission->sId)
                ->lockForUpdate()
                ->first();

            // Re-check status sau khi lock
            if (!$submission || $submission->sStatus !== 'in_progress') {
                DB::rollBack();
                return [
                    'ok'         => true,
                    'idempotent' => true,
                    'data'       => [
                        'submissionId' => $submission ? $submission->sId : null,
                        'sScore'       => $submission ? $submission->sScore : null,
                        'sStatus'      => $submission ? $submission->sStatus : 'unknown',
                    ],
                    'message'    => 'Bài thi đã được xử lý trước đó.',
                ];
            }

            // Reuse logic chấm điểm hiện tại của StudentTestController
            $isVstep = in_array(strtoupper($submission->exam->eType ?? ''), ['VSTEP', 'IELTS']);
            $subjectiveTypes = ['essay', 'writing', 'speaking'];

            /** @var StudentTestController $controller */
            $controller = app(StudentTestController::class);
            $gradingResult = $controller->gradeAnswers(
                $submission->answers,
                $submission->exam_id,
                $isVstep,
                $subjectiveTypes
            );

            if ($gradingResult['error']) {
                DB::rollBack();
                Log::warning('ExamAutoSubmitService grading error', [
                    'submission_id' => $submission->sId,
                    'reason'        => $reason,
                    'error'         => $gradingResult['error'],
                ]);
                return [
                    'ok'         => false,
                    'idempotent' => false,
                    'data'       => null,
                    'message'    => $gradingResult['error'],
                ];
            }

            $scorePercentage   = $gradingResult['scorePercentage'];
            $vstepMeta         = $gradingResult['vstepMeta'];
            $answeredQuestions = $submission->answers->count();
            $totalQuestions    = $submission->exam->questions->count();

            // Xác định trạng thái cuối: nếu là VSTEP/IELTS có nội dung subjective → grading_subjective
            $hasSubjectiveContent = false;
            if ($isVstep) {
                $hasWriting = $submission->answers->contains(function ($a) {
                    if (!$a->question) return false;
                    return strtolower($a->question->qSection ?? '') === 'writing'
                        && strlen(trim($a->saAnswer_text ?? '')) >= 30;
                });
                $rawFeedback = json_decode($submission->sGemini_feedback ?? '{}', true) ?? [];
                $hasSpeaking = !empty($rawFeedback['speaking_audio'] ?? []);
                $hasSubjectiveContent = $hasWriting || $hasSpeaking;
            }

            // Teens speaking (non-VSTEP/IELTS) cũng cần AI nếu có audio
            $teensSpeakingNeedsAi = false;
            if (!$isVstep) {
                $rawFeedbackTeens = json_decode($submission->sGemini_feedback ?? '{}', true) ?? [];
                $hasSpeakingAudioTeens = !empty($rawFeedbackTeens['speaking_audio'] ?? []);
                $hasSpeakingQuestion = $submission->exam->questions->contains(function ($q) {
                    return strtolower($q->qSkill ?? $q->qSection ?? '') === 'speaking';
                });
                if ($hasSpeakingAudioTeens && $hasSpeakingQuestion) {
                    $teensSpeakingNeedsAi = true;
                }
            }

            $needsSubjectiveGrading = $hasSubjectiveContent || $teensSpeakingNeedsAi;
            $finalStatus = $needsSubjectiveGrading ? 'grading_subjective' : 'auto_submitted';

            $reasonLabel = $this->reasonLabel($reason);
            $feedbackMsg = "Bài thi được tự động nộp ({$reasonLabel}). Đã trả lời {$answeredQuestions}/{$totalQuestions} câu hỏi.";

            $updateData = [
                'sSubmit_time'       => now(),
                'sScore'             => $scorePercentage,
                'sStatus'            => $finalStatus,
                'auto_submit_reason' => $reason,
                'sTeacher_feedback'  => $feedbackMsg,
                'last_activity_at'   => now(),
            ];

            // Chỉ set sGraded_time khi không cần chấm subjective
            if (!$needsSubjectiveGrading) {
                $updateData['sGraded_time'] = now();
            }

            // Lưu vstep_scores vào sGemini_feedback (preserve existing keys)
            if ($vstepMeta) {
                $existingRaw = json_decode($submission->sGemini_feedback ?? '{}', true) ?? [];
                $existingRaw['vstep_scores'] = $vstepMeta;
                $updateData['sGemini_feedback'] = json_encode($existingRaw);
            }

            $submission->update($updateData);

            DB::commit();

            // Dispatch AI grading job nếu cần
            if ($needsSubjectiveGrading) {
                try {
                    GradeVstepSubjectiveJob::dispatch($submission->sId);
                } catch (\Throwable $e) {
                    Log::warning('Cannot dispatch GradeVstepSubjectiveJob from auto-submit', [
                        'submission_id' => $submission->sId,
                        'error'         => $e->getMessage(),
                    ]);
                }
            }

            Log::info('ExamAutoSubmitService completed', [
                'submission_id'      => $submission->sId,
                'user_id'            => $submission->user_id,
                'exam_id'            => $submission->exam_id,
                'reason'             => $reason,
                'answered'           => $answeredQuestions,
                'total'              => $totalQuestions,
                'score'              => $scorePercentage,
                'final_status'       => $finalStatus,
            ]);

            $responseData = [
                'submissionId'      => $submission->sId,
                'sScore'            => $scorePercentage,
                'sStatus'           => $finalStatus,
                'autoSubmitReason'  => $reason,
                'answeredQuestions' => $answeredQuestions,
                'totalQuestions'    => $totalQuestions,
                'autoSubmitted'     => true,
            ];
            if ($vstepMeta) {
                $responseData['vstep_scores'] = $vstepMeta;
            }

            return [
                'ok'         => true,
                'idempotent' => false,
                'data'       => $responseData,
                'message'    => $finalStatus === 'grading_subjective'
                    ? 'Bài thi đã được tự động nộp. Đang chấm Writing & Speaking…'
                    : 'Bài thi đã được tự động nộp.',
            ];
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('ExamAutoSubmitService failed', [
                'submission_id' => $submission->sId ?? null,
                'reason'        => $reason,
                'error'         => $e->getMessage(),
                'trace'         => substr($e->getTraceAsString(), 0, 800),
            ]);
            return [
                'ok'         => false,
                'idempotent' => false,
                'data'       => null,
                'message'    => 'Lỗi hệ thống khi tự động nộp bài.',
            ];
        }
    }

    /**
     * Lấy nhãn tiếng Việt cho reason để hiển thị trong sTeacher_feedback.
     */
    private function reasonLabel(string $reason): string
    {
        switch ($reason) {
            case self::REASON_TIMEOUT:  return 'hết thời gian';
            case self::REASON_INACTIVE: return 'không hoạt động > ' . self::INACTIVITY_THRESHOLD_MIN . ' phút';
            case self::REASON_UNLOAD:   return 'đóng tab/trình duyệt';
            case self::REASON_RESTART:  return 'bắt đầu bài mới';
            default:                    return $reason;
        }
    }
}

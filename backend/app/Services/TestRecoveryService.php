<?php

namespace App\Services;

use App\Models\Submission;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * TestRecoveryService
 *
 * Cron-based recovery cho các bài thi đang in_progress nhưng đã:
 *   1. Hết thời gian thi (start_time + duration < now)         → reason = timeout
 *   2. "Câm" quá ngưỡng INACTIVITY_THRESHOLD_MIN phút           → reason = inactive
 *
 * Toàn bộ logic chấm + cập nhật trạng thái đã được tách ra
 * {@see ExamAutoSubmitService} để dùng chung với sendBeacon endpoint.
 */
class TestRecoveryService
{
    /**
     * Kiểm tra và xử lý các bài thi bị gián đoạn.
     * Chạy định kỳ bằng cron job (every minute).
     *
     * @return array ['timeout' => int, 'inactive' => int, 'failed' => int]
     */
    public static function handleInterruptedTests(): array
    {
        $threshold = ExamAutoSubmitService::INACTIVITY_THRESHOLD_MIN;

        // 1) Hết giờ thi (sStart_time + eDuration_minutes < now)
        $timeoutSubs = Submission::with(['exam.questions.answers', 'answers.question'])
            ->where('sStatus', 'in_progress')
            ->whereRaw('TIMESTAMPDIFF(MINUTE, sStart_time, NOW()) > (SELECT eDuration_minutes FROM exams WHERE eId = submissions.exam_id)')
            ->get();

        // 2) Câm quá ngưỡng (last_activity_at IS NOT NULL AND > threshold)
        // Loại trừ những bài đã match nhánh 1 để tránh double-process
        $timeoutIds = $timeoutSubs->pluck('sId')->all();
        $inactiveSubs = Submission::with(['exam.questions.answers', 'answers.question'])
            ->where('sStatus', 'in_progress')
            ->whereNotNull('last_activity_at')
            ->whereRaw('TIMESTAMPDIFF(MINUTE, last_activity_at, NOW()) > ?', [$threshold])
            ->when(!empty($timeoutIds), fn($q) => $q->whereNotIn('sId', $timeoutIds))
            ->get();

        $service = app(ExamAutoSubmitService::class);

        $stats = ['timeout' => 0, 'inactive' => 0, 'failed' => 0];

        foreach ($timeoutSubs as $submission) {
            $result = $service->autoSubmit($submission, ExamAutoSubmitService::REASON_TIMEOUT);
            if ($result['ok'] && !$result['idempotent']) {
                $stats['timeout']++;
                Log::info('TestRecoveryService timeout auto-submit', [
                    'submission_id' => $submission->sId,
                    'user_id'       => $submission->user_id,
                    'exam_id'       => $submission->exam_id,
                ]);
            } elseif (!$result['ok']) {
                $stats['failed']++;
            }
        }

        foreach ($inactiveSubs as $submission) {
            $result = $service->autoSubmit($submission, ExamAutoSubmitService::REASON_INACTIVE);
            if ($result['ok'] && !$result['idempotent']) {
                $stats['inactive']++;
                Log::info('TestRecoveryService inactive auto-submit', [
                    'submission_id'    => $submission->sId,
                    'user_id'          => $submission->user_id,
                    'exam_id'          => $submission->exam_id,
                    'last_activity_at' => $submission->last_activity_at,
                ]);
            } elseif (!$result['ok']) {
                $stats['failed']++;
            }
        }

        return $stats;
    }

    /**
     * Kiểm tra trạng thái bài thi của học viên.
     * Dùng khi học viên reload trang / quay lại từ tab khác.
     */
    public static function checkStudentTestStatus($userId, $assignmentId)
    {
        $submission = Submission::with(['exam'])
            ->where('user_id', $userId)
            ->where('assignment_id', $assignmentId)
            ->where('sStatus', 'in_progress')
            ->first();

        if (!$submission) {
            return ['status' => 'no_active_test'];
        }

        $timeElapsed = now()->diffInMinutes($submission->sStart_time);
        $timeRemaining = (int) $submission->exam->eDuration_minutes - $timeElapsed;

        if ($timeRemaining <= 0) {
            // Tự động nộp bài hết thời gian thông qua service trung tâm
            $submission->load(['exam.questions.answers', 'answers.question']);
            app(ExamAutoSubmitService::class)
                ->autoSubmit($submission, ExamAutoSubmitService::REASON_TIMEOUT);

            return [
                'status'  => 'auto_submitted',
                'message' => 'Bài thi đã hết thời gian và được tự động nộp.',
            ];
        }

        return [
            'status'        => 'in_progress',
            'submission_id' => $submission->sId,
            'time_remaining' => $timeRemaining,
            'can_resume'    => true,
        ];
    }
}

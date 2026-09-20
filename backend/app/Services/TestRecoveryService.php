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
     * Xác định thời lượng thi (phút) chính xác cho mọi loại đề thi:
     * - THPT: thpt_config['total_duration_minutes'] -> eDuration_minutes -> 60
     * - IELTS: eDuration_minutes -> theo skill (listening=30, reading=60, writing=60, speaking=15, mixed=165) -> 60
     * - VSTEP / Kids / Teens / General: eDuration_minutes -> 60
     * - Snapshot trong submission_payload (nếu có)
     */
    public static function resolveSubmissionDurationMinutes(Submission $submission): int
    {
        // 1. Kiểm tra snapshot trong submission_payload
        $payload = is_array($submission->submission_payload) ? $submission->submission_payload : [];
        if (!empty($payload['exam_snapshot']['eDuration_minutes'])) {
            return (int) $payload['exam_snapshot']['eDuration_minutes'];
        }
        if (!empty($payload['exam_snapshot']['config']['total_duration_minutes'])) {
            return (int) $payload['exam_snapshot']['config']['total_duration_minutes'];
        }

        $exam = $submission->exam;
        if (!$exam) {
            return 60;
        }

        $eType = strtoupper((string) ($exam->eType ?? ''));

        // 2. THPT
        if ($eType === 'THPT') {
            $fromConfig = $exam->thpt_config['total_duration_minutes'] ?? null;
            if (is_numeric($fromConfig) && (int) $fromConfig > 0) {
                return (int) $fromConfig;
            }
            $fromCol = (int) ($exam->eDuration_minutes ?? 0);
            return $fromCol > 0 ? $fromCol : 60;
        }

        // 3. IELTS
        if ($eType === 'IELTS') {
            if ((int) ($exam->eDuration_minutes ?? 0) > 0) {
                return (int) $exam->eDuration_minutes;
            }
            $skill = strtolower((string) ($exam->ielts_skill ?? $exam->eSkill ?? ''));
            $defaultIelts = [
                'listening' => 30,
                'reading'   => 60,
                'writing'   => 60,
                'speaking'  => 15,
                'mixed'     => 165,
            ];
            return $defaultIelts[$skill] ?? 60;
        }

        // 4. VSTEP / Kids / Teens / General
        $fromCol = (int) ($exam->eDuration_minutes ?? 0);
        return $fromCol > 0 ? $fromCol : 60;
    }

    /**
     * Kiểm tra và xử lý các bài thi bị gián đoạn.
     * Chạy định kỳ bằng cron job (every minute).
     *
     * @return array ['timeout' => int, 'inactive' => int, 'failed' => int]
     */
    public static function handleInterruptedTests(): array
    {
        $utcNow = now()->utc();

        // Lấy tất cả submissions đang in_progress
        $inProgressSubs = Submission::with(['exam.questions.answers', 'answers.question'])
            ->where('sStatus', 'in_progress')
            ->get();

        $service = app(ExamAutoSubmitService::class);
        $stats = ['timeout' => 0, 'inactive' => 0, 'failed' => 0];

        foreach ($inProgressSubs as $submission) {
            $startTime = $submission->sStart_time
                ? ($submission->sStart_time instanceof \Carbon\Carbon
                    ? $submission->sStart_time->copy()->utc()
                    : \Carbon\Carbon::parse((string) $submission->sStart_time)->utc())
                : ($submission->created_at ? $submission->created_at->copy()->utc() : $utcNow);

            $durationMinutes = self::resolveSubmissionDurationMinutes($submission);
            $payload = is_array($submission->submission_payload) ? $submission->submission_payload : [];

            // Kiểm tra deadline tuyệt đối nếu có trong payload, nếu không tính từ startTime + duration
            if (!empty($payload['timer_deadline_at'])) {
                $deadline = \Carbon\Carbon::parse($payload['timer_deadline_at'])->utc();
            } else {
                $deadline = $startTime->copy()->addMinutes($durationMinutes);
            }

            // 1. ĐÃ HẾT GIỜ THI (now >= deadline) -> Auto submit timeout
            if ($utcNow->greaterThanOrEqualTo($deadline)) {
                $result = $service->autoSubmit($submission, ExamAutoSubmitService::REASON_TIMEOUT);
                if ($result['ok'] && !$result['idempotent']) {
                    $stats['timeout']++;
                    Log::info('TestRecoveryService timeout auto-submit', [
                        'submission_id' => $submission->sId,
                        'user_id'       => $submission->user_id,
                        'exam_id'       => $submission->exam_id,
                        'duration'      => $durationMinutes,
                    ]);
                } elseif (!$result['ok']) {
                    $stats['failed']++;
                }
                continue;
            }

            // 2. Bài thi BỊ BỎ RƠI QUÁ LÂU (bỏ thi > 24 giờ)
            // Không dùng threshold 15 phút để tránh tự nộp non khi học viên tắt máy tạm thời trong lúc đề thi chưa hết giờ.
            $lastActivity = $submission->last_activity_at
                ? ($submission->last_activity_at instanceof \Carbon\Carbon
                    ? $submission->last_activity_at->copy()->utc()
                    : \Carbon\Carbon::parse((string) $submission->last_activity_at)->utc())
                : $startTime;

            if ($utcNow->diffInHours($lastActivity, false) >= 24) {
                $result = $service->autoSubmit($submission, ExamAutoSubmitService::REASON_INACTIVE);
                if ($result['ok'] && !$result['idempotent']) {
                    $stats['inactive']++;
                    Log::info('TestRecoveryService abandoned test auto-submit (24h+)', [
                        'submission_id' => $submission->sId,
                        'user_id'       => $submission->user_id,
                        'exam_id'       => $submission->exam_id,
                    ]);
                } elseif (!$result['ok']) {
                    $stats['failed']++;
                }
            }
        }

        return $stats;
    }

    /**
     * Kiểm tra trạng thái bài thi của học viên.
     * Dùng khi học viên reload trang / quay lại từ tab khác.
     */
    public static function checkStudentTestStatus($userId, $assignmentId = null, $submissionId = null)
    {
        $query = Submission::with(['exam'])
            ->where('user_id', $userId)
            ->where('sStatus', 'in_progress');

        if ($submissionId) {
            $query->where('sId', $submissionId);
        } elseif ($assignmentId) {
            $query->where('assignment_id', $assignmentId);
        } else {
            $query->whereNull('assignment_id');
        }

        $submission = $query->orderByDesc('sId')->first();

        if (!$submission) {
            return ['status' => 'no_active_test'];
        }

        $utcNow = now()->utc();
        $startTime = $submission->sStart_time
            ? ($submission->sStart_time instanceof \Carbon\Carbon
                ? $submission->sStart_time->copy()->utc()
                : \Carbon\Carbon::parse((string) $submission->sStart_time)->utc())
            : $utcNow;

        $durationMinutes = self::resolveSubmissionDurationMinutes($submission);
        $payload = is_array($submission->submission_payload) ? $submission->submission_payload : [];
        if (!empty($payload['timer_deadline_at'])) {
            $deadline = \Carbon\Carbon::parse($payload['timer_deadline_at'])->utc();
        } else {
            $deadline = $startTime->copy()->addMinutes($durationMinutes);
        }

        if ($utcNow->greaterThanOrEqualTo($deadline)) {
            // Tự động nộp bài hết thời gian thông qua service trung tâm
            $submission->load(['exam.questions.answers', 'answers.question']);
            app(ExamAutoSubmitService::class)
                ->autoSubmit($submission, ExamAutoSubmitService::REASON_TIMEOUT);

            return [
                'status'  => 'auto_submitted',
                'message' => 'Bài thi đã hết thời gian và được tự động nộp.',
            ];
        }

        $timeRemaining = max(0, (int) $deadline->diffInMinutes($utcNow));

        return [
            'status'         => 'in_progress',
            'submission_id'  => $submission->sId,
            'time_remaining' => $timeRemaining,
            'can_resume'     => true,
        ];
    }
}

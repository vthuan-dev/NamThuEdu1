<?php

namespace App\Services;

use App\Models\GradingHistory;
use App\Models\Submission;
use App\Models\User;
use App\Support\ScoreScale;
use Illuminate\Support\Facades\Log;

/**
 * Thông báo cho học viên sau khi giáo viên chấm/duyệt điểm.
 *
 * Tách "chấm xong lần đầu" và "sửa điểm" thành hai loại riêng. Trước đây cả hai
 * dùng chung một thông báo `graded_<sId>`, và vì `getNotifications` key theo sId
 * nên khi giáo viên chấm lại thì con số trong thông báo cũ ÂM THẦM đổi — học
 * viên không hề biết điểm đã bị sửa.
 *
 * Có hai đường vào việc chấm và cả hai đều phải gọi lớp này:
 *   - GradingController::grade            (nút "Xét duyệt" trong modal)
 *   - GradingReviewService::finalize      (POST /submissions/{id}/save-all)
 *
 * Trước đây chỉ `save-all` gửi push, nên duyệt bằng modal thì học viên chỉ biết
 * qua polling 10 giây của NotificationDropdown.
 */
class GradingNotifier
{
    /**
     * Ghi audit + gửi push sau khi một bài làm được chốt điểm.
     *
     * Phải gọi SAU khi `$submission->update()` đã chạy, và truyền vào giá trị
     * đọc được TRƯỚC khi update:
     *
     * @param  float|null  $previousScore   `sScore` cũ (thang thô, như trong DB)
     * @param  bool        $wasReviewed     `teacher_reviewed_at` đã có giá trị chưa
     */
    public function afterFinalize(
        Submission $submission,
        User $teacher,
        $previousScore,
        bool $wasReviewed,
        array $metadata = []
    ): void {
        $isRegrade = $wasReviewed;

        try {
            GradingHistory::create([
                'submission_id' => $submission->sId,
                'answer_id'     => null,
                'ghAction'      => GradingHistory::ACTION_TEACHER_SAVE,
                'ghActor_id'    => $teacher->uId,
                'ghPrev_score'  => $previousScore,
                'ghNew_score'   => $submission->sScore,
                'ghNote'        => $isRegrade ? 'Giáo viên sửa điểm' : 'Giáo viên chấm lần đầu',
                'ghMetadata'    => $metadata,
            ]);
        } catch (\Exception $e) {
            // Audit log không được làm hỏng việc chấm điểm.
            Log::warning('[grading] history write failed: ' . $e->getMessage());
        }

        try {
            $this->sendPush($submission, $previousScore, $isRegrade);
        } catch (\Exception $e) {
            Log::warning('[Push] Teacher review push failed: ' . $e->getMessage());
        }
    }

    /**
     * Đường dẫn trang kết quả theo LOẠI ĐỀ.
     *
     * Trang `/ket-qua/<sId>` chung chỉ tải rồi tự redirect sang trang chuyên
     * biệt với THPT/VSTEP/IELTS, nên phải trỏ thẳng để tránh nháy trang.
     * `getNotifications` đã làm đúng việc này từ trước; push thì chưa.
     *
     * @param  string  $prefix  '' cho action_url trong danh sách thông báo,
     *                          '/hoc-vien' cho URL tuyệt đối của push.
     */
    public static function resultUrl(Submission $submission, string $prefix = ''): string
    {
        $examType = strtoupper($submission->exam->eType ?? '');
        $examTitle = $submission->exam->eTitle ?? '';

        if ($examType === 'THPT') {
            $page = 'ket-qua-thpt';
        } elseif (ScoreScale::isIelts($examType, $examTitle)) {
            $page = 'ket-qua-ielts';
        } elseif (ScoreScale::isVstep($examType, $examTitle)) {
            $page = 'ket-qua-vstep';
        } else {
            $page = 'ket-qua';
        }

        return $prefix . '/' . $page . '/' . $submission->sId;
    }

    /**
     * Nhãn điểm theo thang của đề (3.75/10, band 7.5/9, ...) để học viên đọc
     * được ngay trong thông báo mà không phải mở trang kết quả.
     */
    public static function scoreLabel(Submission $submission, $rawScore): string
    {
        if ($rawScore === null) {
            return '—';
        }
        $scale = ScoreScale::forSubmission($submission);
        if ($scale['divisor'] <= 0) {
            return '—';
        }
        $display = (float) $rawScore / $scale['divisor'];

        return number_format(round($display, 2), 2, '.', '')
            . '/' . number_format($scale['max'], 0, '.', '');
    }

    private function sendPush(Submission $submission, $previousScore, bool $isRegrade): void
    {
        $examTitle = optional($submission->exam)->eTitle ?? 'Bài thi';
        $newLabel  = self::scoreLabel($submission, $submission->sScore);
        $url       = self::resultUrl($submission, '/hoc-vien');

        if ($isRegrade) {
            $oldLabel = self::scoreLabel($submission, $previousScore);
            $title = '✏️ Điểm bài thi của bạn đã được cập nhật';
            $body  = $examTitle . ' · ' . $oldLabel . ' → ' . $newLabel;
        } else {
            $title = '📝 Giáo viên đã chấm xong bài của bạn';
            $body  = $examTitle . ' · Điểm: ' . $newLabel;
        }

        (new PushNotificationService())->sendToUser(
            (int) $submission->user_id,
            $title,
            $body,
            ['url' => $url]
        );
    }
}

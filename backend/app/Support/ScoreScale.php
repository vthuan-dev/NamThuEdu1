<?php

namespace App\Support;

use App\Models\Submission;

/**
 * Thang điểm của từng loại đề.
 *
 * `submissions.sScore` KHÔNG có thang thống nhất — mỗi luồng chấm lưu một kiểu:
 *
 *   THPT    → điểm đã quy đổi sẵn theo `thpt_config.scale_max` (mặc định 10),
 *             xem ThptExamController::gradeThpt().
 *   VSTEP   → band 0-10 nhân 10, xem GradingController.
 *   IELTS   → band 0-9  nhân 10, xem GradingController (có ghi chú giữ nguyên
 *             dạng này "for compatibility with reports/sScore-based filters").
 *   Còn lại → PHẦN TRĂM 0-100, xem StudentTestController::gradeAnswers().
 *
 * Hệ quả: không được cộng/trung bình `sScore` thô giữa các loại đề. Trước đây
 * báo cáo làm đúng như vậy nên trộn 37.50 (phần trăm) với 3.40 (hệ 10), và
 * các ngưỡng kiểu `$avgScore < 7.0` chỉ đúng với đề hệ 10.
 *
 * Đây là bản PHP của `frontend/src/utils/gradeHelpers.ts`. Sửa một bên thì
 * phải sửa bên kia.
 */
class ScoreScale
{
    /** Thang mặc định khi đề không khai báo gì. */
    public const DEFAULT_SCALE_MAX = 10;

    public static function isIelts(?string $examType, ?string $examTitle = null): bool
    {
        return str_starts_with(strtoupper($examType ?? ''), 'IELTS')
            || str_contains(strtoupper($examTitle ?? ''), 'IELTS');
    }

    public static function isVstep(?string $examType, ?string $examTitle = null): bool
    {
        return strtoupper($examType ?? '') === 'VSTEP'
            || str_contains(strtoupper($examTitle ?? ''), 'VSTEP');
    }

    /**
     * Thang hiển thị của một đề.
     *
     * IELTS giữ band 0-9 và VSTEP giữ band 0-10 vì đó là thang chuẩn quốc tế —
     * quy về hệ 10 sẽ biến band 7.0 thành 7.8, vô nghĩa với giáo viên.
     *
     * @return array{max: float, divisor: float}
     */
    public static function resolve(?string $examType, ?string $examTitle = null, $scaleMax = null): array
    {
        $scaleMax = (is_numeric($scaleMax) && $scaleMax > 0) ? (float) $scaleMax : null;

        if (self::isIelts($examType, $examTitle)) {
            return ['max' => 9.0, 'divisor' => 10.0];
        }
        if (self::isVstep($examType, $examTitle)) {
            return ['max' => 10.0, 'divisor' => 10.0];
        }
        if (strtoupper($examType ?? '') === 'THPT') {
            // Backend đã quy đổi sẵn về scale_max nên không chia thêm.
            $max = $scaleMax ?? (float) self::DEFAULT_SCALE_MAX;
            return ['max' => $max, 'divisor' => 1.0];
        }
        // GENERAL / Kids / Teens: sScore là phần trăm.
        $max = $scaleMax ?? (float) self::DEFAULT_SCALE_MAX;
        return ['max' => $max, 'divisor' => 100.0 / $max];
    }

    /** Thang của một bài làm, đọc cấu hình từ quan hệ `exam`. */
    public static function forSubmission(Submission $submission): array
    {
        $exam = $submission->exam;
        if (!$exam) {
            return ['max' => (float) self::DEFAULT_SCALE_MAX, 'divisor' => 1.0];
        }

        // CHỈ đọc thpt_config.scale_max. KHÔNG dùng eTotal_score: đó là tổng
        // điểm THÔ của đề (AgeGroupContentController gán count($items) * 10,
        // TeensExamController/TestController gán cứng 100), không phải thang
        // hiển thị. Đề GENERAL có eTotal_score = 100 nghĩa là "chấm theo phần
        // trăm" — hiểu thành "thang 100" thì điểm sẽ không được quy đổi.
        $scaleMax = null;
        if (is_array($exam->thpt_config)) {
            $scaleMax = $exam->thpt_config['scale_max'] ?? null;
        }

        return self::resolve($exam->eType, $exam->eTitle, $scaleMax);
    }

    /**
     * Điểm quy về thang 0-10 để so sánh/trung bình được giữa các loại đề.
     * Trả null khi bài chưa có điểm — người gọi phải loại các giá trị này ra
     * trước khi tính trung bình, nếu không bài chưa chấm sẽ bị coi là 0 điểm.
     */
    public static function normalizedTen(Submission $submission): ?float
    {
        if ($submission->sScore === null) {
            return null;
        }
        $scale = self::forSubmission($submission);
        if ($scale['max'] <= 0 || $scale['divisor'] <= 0) {
            return null;
        }
        $display = (float) $submission->sScore / $scale['divisor'];

        return $display / $scale['max'] * 10;
    }

    /**
     * Trung bình theo thang 0-10 của một tập bài làm.
     *
     * Bỏ qua bài chưa có điểm. Trả null khi không còn bài nào có điểm, để
     * người gọi phân biệt được "chưa có dữ liệu" với "trung bình 0 điểm".
     *
     * Cần quan hệ `exam` — hãy eager-load bằng `with('exam')` trước khi gọi,
     * không thì sẽ sinh N+1 query.
     *
     * @param  iterable<Submission>  $submissions
     */
    public static function averageTen(iterable $submissions): ?float
    {
        $sum = 0.0;
        $count = 0;
        foreach ($submissions as $submission) {
            $value = self::normalizedTen($submission);
            if ($value !== null) {
                $sum += $value;
                $count++;
            }
        }

        return $count > 0 ? $sum / $count : null;
    }
}

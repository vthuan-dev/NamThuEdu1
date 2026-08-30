<?php

namespace Tests\Unit;

use App\Models\Exam;
use App\Models\Submission;
use App\Support\ScoreScale;
use Tests\TestCase;

/**
 * `submissions.sScore` không có thang thống nhất — mỗi luồng chấm lưu một kiểu.
 * Các test dưới đây neo lại đúng những con số THẬT lấy từ dữ liệu production,
 * và đặc biệt kiểm việc trung bình phải quy đổi trước khi cộng.
 *
 * Không dùng database: dựng Exam/Submission trong bộ nhớ rồi gán quan hệ, vì
 * ScoreScale chỉ đọc thuộc tính chứ không truy vấn.
 */
class ScoreScaleTest extends TestCase
{
    private function submission(string $eType, $sScore, array $thptConfig = null, string $eTitle = ''): Submission
    {
        $exam = new Exam();
        $exam->eType = $eType;
        $exam->eTitle = $eTitle;
        $exam->thpt_config = $thptConfig;

        $submission = new Submission();
        $submission->sScore = $sScore;
        $submission->setRelation('exam', $exam);

        return $submission;
    }

    public function test_thpt_score_is_already_converted(): void
    {
        // Dữ liệu thật: eType=THPT, sScore=3.40, thpt_config.scale_max=10.
        // Hiển thị đúng là 3.40/10, không phải 3.40/100.
        $scale = ScoreScale::resolve('THPT', '', 10);
        $this->assertSame(10.0, $scale['max']);
        $this->assertSame(1.0, $scale['divisor']);

        $sub = $this->submission('THPT', 3.40, ['scale_max' => 10]);
        $this->assertSame(3.4, round(ScoreScale::normalizedTen($sub), 2));
    }

    public function test_general_score_is_a_percentage(): void
    {
        // Dữ liệu thật: eType=GENERAL, sScore=37.50 → 3.75 trên thang 10.
        $sub = $this->submission('GENERAL', 37.50);
        $this->assertSame(3.75, round(ScoreScale::normalizedTen($sub), 2));
    }

    public function test_vstep_keeps_band_ten(): void
    {
        $scale = ScoreScale::resolve('VSTEP');
        $this->assertSame(10.0, $scale['max']);

        $sub = $this->submission('VSTEP', 65);
        $this->assertSame(6.5, round(ScoreScale::normalizedTen($sub), 2));
    }

    public function test_ielts_keeps_band_nine(): void
    {
        // Quy về hệ 10 sẽ biến band 7.0 thành 7.8 — vô nghĩa với giáo viên IELTS.
        $scale = ScoreScale::resolve('IELTS');
        $this->assertSame(9.0, $scale['max']);

        // band 7 / 9 * 10 = 7.78 khi chuẩn hoá để so sánh chéo loại đề.
        $sub = $this->submission('IELTS', 70);
        $this->assertSame(7.78, round(ScoreScale::normalizedTen($sub), 2));
    }

    public function test_ielts_variant_types_are_recognised(): void
    {
        // eType thật có biến thể IELTS_ACADEMIC (xem migration
        // add_ielts_skill_to_exams_table).
        $this->assertTrue(ScoreScale::isIelts('IELTS_ACADEMIC'));
        $this->assertSame(9.0, ScoreScale::resolve('IELTS_ACADEMIC')['max']);
    }

    public function test_general_exam_total_score_is_not_a_display_scale(): void
    {
        // Dữ liệu thật: đề GENERAL eId=136 có eTotal_score = 100. Đó là tổng điểm
        // THÔ, không phải thang hiển thị. Nếu dùng nó làm thang thì bài 37.50 sẽ
        // hiện 37.50/100 thay vì 3.75/10. Thang phải suy ra từ DẠNG ĐỀ.
        $exam = new Exam();
        $exam->eType = 'GENERAL';
        $exam->eTitle = 'Đọc hiểu: Teenagers and Smartphones';
        $exam->eTotal_score = 100;
        $exam->thpt_config = null;

        $submission = new Submission();
        $submission->sScore = 37.50;
        $submission->setRelation('exam', $exam);

        $scale = ScoreScale::forSubmission($submission);
        $this->assertSame(10.0, $scale['max']);
        $this->assertSame(3.75, round(ScoreScale::normalizedTen($submission), 2));
    }

    public function test_teacher_defined_scale_max_is_respected(): void
    {
        $this->assertSame(100.0, ScoreScale::resolve('THPT', '', 100)['max']);
    }

    public function test_zero_or_null_scale_max_falls_back_to_ten(): void
    {
        // Phòng dữ liệu cũ có scale_max = 0 → tránh chia cho 0.
        $this->assertSame(10.0, ScoreScale::resolve('GENERAL', '', 0)['max']);
        $this->assertSame(10.0, ScoreScale::resolve('GENERAL', '', null)['max']);

        $sub = $this->submission('GENERAL', 50, ['scale_max' => 0]);
        $this->assertTrue(is_finite(ScoreScale::normalizedTen($sub)));
    }

    public function test_ungraded_submission_returns_null(): void
    {
        $sub = $this->submission('GENERAL', null);
        $this->assertNull(ScoreScale::normalizedTen($sub));
    }

    public function test_zero_score_is_kept_not_treated_as_missing(): void
    {
        // Dữ liệu thật có nhiều bài sScore=0.00. Nếu dùng kiểm tra falsy thì
        // chúng bị loại khỏi trung bình và làm điểm TB của lớp cao giả tạo.
        $sub = $this->submission('GENERAL', 0);
        $this->assertSame(0.0, ScoreScale::normalizedTen($sub));
    }

    public function test_average_converts_before_summing(): void
    {
        // Đây là lỗi thật trên giao diện: 37.50 (phần trăm) cộng với 3.40 (hệ 10)
        // rồi chia 2 ra "TB: 20.45".
        $submissions = collect([
            $this->submission('GENERAL', 37.50),          // 3.75/10
            $this->submission('THPT', 3.40, ['scale_max' => 10]), // 3.40/10
        ]);

        $avg = ScoreScale::averageTen($submissions);
        $this->assertSame(3.58, round($avg, 2));
        $this->assertNotEquals(20.45, round($avg, 2));
    }

    public function test_average_ignores_ungraded_submissions(): void
    {
        // Bài chưa chấm phải bị loại, không được tính là 0 điểm — nếu không điểm
        // TB của học viên sẽ tụt mỗi lần họ được giao thêm bài.
        $submissions = collect([
            $this->submission('GENERAL', 80),   // 8.0
            $this->submission('GENERAL', null), // bỏ qua
        ]);

        $this->assertSame(8.0, round(ScoreScale::averageTen($submissions), 2));
    }

    public function test_average_returns_null_when_nothing_graded(): void
    {
        // Trả null để người gọi phân biệt "chưa có dữ liệu" với "trung bình 0".
        $submissions = collect([$this->submission('GENERAL', null)]);
        $this->assertNull(ScoreScale::averageTen($submissions));
    }

    public function test_submission_without_exam_does_not_crash(): void
    {
        // Đề bị xoá nhưng bài làm còn → quan hệ exam null. Không có eType thì
        // không đoán được thang; miễn là không nổ và không trả giá trị vô hạn.
        $sub = new Submission();
        $sub->sScore = 50;
        $sub->setRelation('exam', null);

        $value = ScoreScale::normalizedTen($sub);
        $this->assertNotNull($value);
        $this->assertTrue(is_finite($value));
    }
}

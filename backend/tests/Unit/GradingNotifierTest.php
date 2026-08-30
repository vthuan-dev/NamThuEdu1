<?php

namespace Tests\Unit;

use App\Models\Exam;
use App\Models\Submission;
use App\Services\GradingNotifier;
use Tests\TestCase;

/**
 * Nhãn điểm và URL kết quả trong thông báo gửi cho học viên.
 *
 * Hai kênh (danh sách thông báo và web push) phải cho ra cùng một nhãn và cùng
 * một đường dẫn — trước đây push luôn trỏ '/ket-qua/<sId>' cho mọi loại đề.
 */
class GradingNotifierTest extends TestCase
{
    private function makeSubmission(string $eType, $sScore, string $eTitle = '', $thptConfig = null): Submission
    {
        $exam = new Exam();
        $exam->eType = $eType;
        $exam->eTitle = $eTitle;
        $exam->thpt_config = $thptConfig;

        $submission = new Submission();
        $submission->sId = 300;
        $submission->sScore = $sScore;
        $submission->setRelation('exam', $exam);

        return $submission;
    }

    public function test_general_label_is_on_ten_scale(): void
    {
        // Dữ liệu thật: sScore = 37.50 là phần trăm → 3.75/10.
        $sub = $this->makeSubmission('GENERAL', 37.50, 'Đọc hiểu: Teenagers and Smartphones');
        $this->assertSame('3.75/10', GradingNotifier::scoreLabel($sub, $sub->sScore));
    }

    public function test_thpt_label_uses_teacher_scale(): void
    {
        $sub = $this->makeSubmission('THPT', 3.40, 'Đề Tiếng Anh THPT', ['scale_max' => 10]);
        $this->assertSame('3.40/10', GradingNotifier::scoreLabel($sub, $sub->sScore));
    }

    public function test_ielts_label_keeps_band_nine(): void
    {
        // sScore lưu band × 10, nên 75 = band 7.5. Không được hiện 7.5/10.
        $sub = $this->makeSubmission('IELTS', 75, 'IELTS Academic - Full Test');
        $this->assertSame('7.50/9', GradingNotifier::scoreLabel($sub, $sub->sScore));
    }

    public function test_vstep_label_keeps_band_ten(): void
    {
        $sub = $this->makeSubmission('VSTEP', 65, 'VSTEP B2 - Full Test');
        $this->assertSame('6.50/10', GradingNotifier::scoreLabel($sub, $sub->sScore));
    }

    public function test_missing_score_has_placeholder_label(): void
    {
        $sub = $this->makeSubmission('GENERAL', null);
        $this->assertSame('—', GradingNotifier::scoreLabel($sub, null));
    }

    public function test_zero_score_is_shown_not_treated_as_missing(): void
    {
        $sub = $this->makeSubmission('GENERAL', 0);
        $this->assertSame('0.00/10', GradingNotifier::scoreLabel($sub, 0));
    }

    public function test_result_url_points_to_type_specific_page(): void
    {
        $this->assertSame(
            '/ket-qua-thpt/300',
            GradingNotifier::resultUrl($this->makeSubmission('THPT', 5))
        );
        $this->assertSame(
            '/ket-qua-vstep/300',
            GradingNotifier::resultUrl($this->makeSubmission('VSTEP', 5))
        );
        $this->assertSame(
            '/ket-qua-ielts/300',
            GradingNotifier::resultUrl($this->makeSubmission('IELTS', 5))
        );
        $this->assertSame(
            '/ket-qua/300',
            GradingNotifier::resultUrl($this->makeSubmission('GENERAL', 5))
        );
    }

    public function test_ielts_variant_type_is_not_routed_to_vstep_page(): void
    {
        // eType thật có cả IELTS_ACADEMIC. Nếu kiểm VSTEP trước IELTS thì đề này
        // sẽ bị trỏ sang trang VSTEP.
        $this->assertSame(
            '/ket-qua-ielts/300',
            GradingNotifier::resultUrl($this->makeSubmission('IELTS_ACADEMIC', 5))
        );
    }

    public function test_push_url_is_prefixed_for_student_area(): void
    {
        $this->assertSame(
            '/hoc-vien/ket-qua-thpt/300',
            GradingNotifier::resultUrl($this->makeSubmission('THPT', 5), '/hoc-vien')
        );
    }
}

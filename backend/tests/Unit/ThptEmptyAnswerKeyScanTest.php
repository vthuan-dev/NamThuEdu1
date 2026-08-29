<?php

namespace Tests\Unit;

use App\Http\Controllers\ThptExamController;
use PHPUnit\Framework\TestCase;

/**
 * Bảo vệ lớp lỗi mà `thpt:scan-empty-answers` đi tìm.
 *
 * Lệnh scan lọc error theo chuỗi "trỏ vào phương án chưa có nội dung". Nếu ai đó
 * đổi câu chữ trong validateThptConfig() mà không sửa MARKER, scan sẽ âm thầm báo
 * "không có đề nào lỗi" — đúng cái kết luận nguy hiểm nhất. Test này khoá cả hành
 * vi phát hiện lẫn ngoại lệ đề dạng ảnh.
 *
 * Không dùng DB nên KHÔNG kèm RefreshDatabase/migrate:fresh — chạy độc lập được.
 */
class ThptEmptyAnswerKeyScanTest extends TestCase
{
    /** Chuỗi này phải khớp ScanThptEmptyAnswerKeys::MARKER. */
    private const MARKER = 'trỏ vào phương án chưa có nội dung';

    private function validate(array $config): array
    {
        $method = new \ReflectionMethod(ThptExamController::class, 'validateThptConfig');
        $method->setAccessible(true);

        return (array) $method->invoke(new ThptExamController(), $config);
    }

    private function matched(array $errors): array
    {
        return array_values(array_filter($errors, function ($e) {
            return strpos((string) $e, self::MARKER) !== false;
        }));
    }

    private function mcConfig(array $options, string $correctId): array
    {
        return [
            'sections' => [[
                'title' => 'Phần 1',
                'type'  => 'mc_questions',
                'items' => [[
                    'question_number' => 7,
                    'question'        => 'Chọn đáp án đúng.',
                    'options'         => $options,
                    'correct_id'      => $correctId,
                ]],
            ]],
        ];
    }

    /** @test */
    public function it_flags_a_correct_id_pointing_at_an_empty_option(): void
    {
        // Giáo viên chọn D làm đáp án rồi xoá nội dung D — không ai có thể đúng câu này.
        $errors = $this->validate($this->mcConfig([
            ['id' => 'A', 'text' => 'go'],
            ['id' => 'B', 'text' => 'goes'],
            ['id' => 'C', 'text' => 'going'],
            ['id' => 'D', 'text' => ''],
        ], 'D'));

        $matched = $this->matched($errors);

        $this->assertCount(1, $matched, 'Scan phải bắt được câu có đáp án trỏ vào phương án rỗng.');
        $this->assertStringContainsString('câu 7', $matched[0]);
    }

    /** @test */
    public function it_accepts_a_correct_id_pointing_at_a_filled_option(): void
    {
        $errors = $this->validate($this->mcConfig([
            ['id' => 'A', 'text' => 'go'],
            ['id' => 'B', 'text' => 'goes'],
            ['id' => 'C', 'text' => ''],
            ['id' => 'D', 'text' => ''],
        ], 'B'));

        $this->assertSame([], $this->matched($errors));
    }

    /** @test */
    public function it_exempts_image_based_exams_where_every_option_is_empty(): void
    {
        // Đề in câu hỏi trên ảnh: bảng bên phải chỉ hiện nhãn A/B/C/D, text rỗng là
        // bình thường. Nếu coi đây là lỗi thì scan sẽ báo động giả trên cả loại đề này.
        $errors = $this->validate($this->mcConfig([
            ['id' => 'A', 'text' => ''],
            ['id' => 'B', 'text' => ''],
            ['id' => 'C', 'text' => ''],
            ['id' => 'D', 'text' => ''],
        ], 'C'));

        $this->assertSame([], $this->matched($errors));
    }

    /** @test */
    public function it_treats_whitespace_only_option_text_as_empty(): void
    {
        $errors = $this->validate($this->mcConfig([
            ['id' => 'A', 'text' => 'go'],
            ['id' => 'B', 'text' => "  \n "],
        ], 'B'));

        $this->assertCount(1, $this->matched($errors));
    }
}

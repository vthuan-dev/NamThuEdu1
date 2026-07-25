<?php

namespace Tests\Unit;

use App\Http\Controllers\StudentTestController;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * Flyers Reading Part 1: hộp từ có nhiều từ hơn số câu (có từ nhiễu).
 * Học sinh chọn CHÍNH TỪ cho mỗi định nghĩa; bản cũ lưu nhãn chữ A/B/C
 * nên phải chấm đúng cả hai định dạng.
 */
class KidsWordDefinitionGradingTest extends TestCase
{
    private function ratio(array $taskData, array $answerMap): float
    {
        $controller = new StudentTestController();
        $method = new ReflectionMethod(StudentTestController::class, 'gradeKidsTask');
        $method->setAccessible(true);

        $question = new \stdClass();
        $question->kids_task_config = [
            'task_type' => 'word_definition_matching',
            'task_data' => $taskData,
        ];

        // Player luôn gửi JSON object (khóa = chỉ số câu), không phải mảng.
        $result = $method->invoke($controller, $question, json_encode($answerMap, JSON_FORCE_OBJECT));

        return (float) $result['ratio'];
    }

    private function taskData(): array
    {
        return [
            'words' => [
                ['word' => 'elephant', 'definition' => 'A big animal with a long nose.'],
                ['word' => 'rain', 'definition' => 'Water that falls from the clouds.'],
                ['word' => 'doctor', 'definition' => 'This person helps you when you are ill.'],
            ],
            'distractor_words' => ['bicycle', 'sunny'],
        ];
    }

    /** @test */
    public function test_scores_full_marks_when_student_picks_the_correct_words()
    {
        $ratio = $this->ratio($this->taskData(), [
            '0' => 'elephant',
            '1' => 'rain',
            '2' => 'doctor',
        ]);

        $this->assertSame(1.0, $ratio);
    }

    /** @test */
    public function test_ignores_case_and_spacing()
    {
        $ratio = $this->ratio($this->taskData(), [
            '0' => '  Elephant ',
            '1' => 'RAIN',
            '2' => 'doctor',
        ]);

        $this->assertSame(1.0, $ratio);
    }

    /** @test */
    public function test_distractor_word_is_never_correct()
    {
        $ratio = $this->ratio($this->taskData(), [
            '0' => 'bicycle',
            '1' => 'rain',
            '2' => 'doctor',
        ]);

        $this->assertEqualsWithDelta(2 / 3, $ratio, 0.0001);
    }

    /** @test */
    public function test_legacy_letter_answers_still_graded()
    {
        // Bài làm cũ lưu nhãn chữ theo chỉ số: câu 0 → 'A', câu 1 → 'B'…
        $ratio = $this->ratio($this->taskData(), [
            '0' => 'A',
            '1' => 'B',
            '2' => 'C',
        ]);

        $this->assertSame(1.0, $ratio);
    }
}

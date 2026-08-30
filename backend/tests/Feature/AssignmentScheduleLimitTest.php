<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AssignmentScheduleLimitTest extends TestCase
{
    use RefreshDatabase;

    private User $teacher;
    private User $student;
    private Exam $exam;

    protected function setUp(): void
    {
        parent::setUp();

        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
        $this->student = User::factory()->create([
            'uRole' => 'student',
            'age_group' => 'teens',
            'class_id' => null,
        ]);

        $this->exam = Exam::create([
            'eTitle' => 'Test Exam Duration 40m',
            'eType' => 'THPT',
            'eSkill' => 'reading',
            'eDuration_minutes' => 40,
            'eStatus' => 'published',
            'eTeacher_id' => $this->teacher->uId,
            'age_group' => 'teens',
        ]);
    }

    public function test_rejects_start_time_in_the_past(): void
    {
        $response = $this->actingAs($this->teacher, 'sanctum')
            ->postJson("/api/teacher/exams/{$this->exam->eId}/assign", [
                'taTarget_type' => 'student',
                'taTarget_id' => $this->student->uId,
                'taStart_time' => now()->subMinutes(10)->toDateTimeString(),
                'taDeadline' => now()->addHours(2)->toDateTimeString(),
            ]);

        $response->assertStatus(400);
        $this->assertStringContainsString('không được ở quá khứ', $response->json('message'));
    }

    public function test_rejects_deadline_too_early_relative_to_start_time(): void
    {
        // Đề dài 40 phút + 10 phút đệm = 50 phút tối thiểu.
        // Giao với hạn chót chỉ sau 30 phút -> lỗi.
        $response = $this->actingAs($this->teacher, 'sanctum')
            ->postJson("/api/teacher/exams/{$this->exam->eId}/assign", [
                'taTarget_type' => 'student',
                'taTarget_id' => $this->student->uId,
                'taStart_time' => now()->addMinutes(10)->toDateTimeString(),
                'taDeadline' => now()->addMinutes(30)->toDateTimeString(), // 20 phút kể từ lúc mở
            ]);

        $response->assertStatus(400);
        $this->assertStringContainsString('Hạn chót quá sớm', $response->json('message'));
    }

    public function test_rejects_deadline_too_early_relative_to_now_when_start_time_empty(): void
    {
        // Mở ngay lập tức (start_time rỗng). Đề dài 40 phút.
        // Giao với hạn chót chỉ sau 30 phút kể từ bây giờ -> lỗi.
        $response = $this->actingAs($this->teacher, 'sanctum')
            ->postJson("/api/teacher/exams/{$this->exam->eId}/assign", [
                'taTarget_type' => 'student',
                'taTarget_id' => $this->student->uId,
                'taDeadline' => now()->addMinutes(30)->toDateTimeString(),
            ]);

        $response->assertStatus(400);
        $this->assertStringContainsString('Hạn chót quá sớm', $response->json('message'));
    }

    public function test_accepts_valid_schedule(): void
    {
        // 40m đề + 10m đệm. Giao hạn chót sau 60 phút -> thành công.
        $response = $this->actingAs($this->teacher, 'sanctum')
            ->postJson("/api/teacher/exams/{$this->exam->eId}/assign", [
                'taTarget_type' => 'student',
                'taTarget_id' => $this->student->uId,
                'taStart_time' => now()->addMinutes(10)->toDateTimeString(),
                'taDeadline' => now()->addMinutes(70)->toDateTimeString(),
            ]);

        $response->assertStatus(200);
    }
}

<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Exam;
use App\Models\TestAssignment;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Regression cho bug "Giao rồi muốn chỉnh lại các yêu cầu chưa được".
 *
 * Trước khi fix, PUT /teacher/assignments/{id} validate/ghi vào các cột KHÔNG
 * tồn tại (taMax_attempts số nhiều, taIs_mandatory, ...) và thao tác 2 bảng
 * pivot đã bị bỏ → không lưu được gì hoặc lỗi khi ->load('students').
 */
class AssignmentUpdateTest extends TestCase
{
    use RefreshDatabase;

    protected $teacher;
    protected $teacherToken;

    protected function setUp(): void
    {
        parent::setUp();
        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
        $this->teacherToken = $this->teacher->createToken('test')->plainTextToken;
    }

    private function teacherHeader(): array
    {
        return ['Authorization' => 'Bearer ' . $this->teacherToken];
    }

    private function makeAssignment(): TestAssignment
    {
        $student = User::factory()->create(['uRole' => 'student', 'age_group' => 'teens']);

        $exam = Exam::create([
            'eTitle' => 'Đề mẫu',
            'eType' => 'THPT',
            'eSkill' => 'reading',
            'eDuration_minutes' => 60,
            'eStatus' => 'published',
            'eTeacher_id' => $this->teacher->uId,
            'age_group' => 'teens',
        ]);

        return TestAssignment::create([
            'exam_id' => $exam->eId,
            'taTarget_type' => 'student',
            'taTarget_id' => $student->uId,
            'taDeadline' => now()->addDays(3),
            'taInstructions' => 'Hướng dẫn cũ',
            'taMax_attempt' => 1,
            'taIs_public' => false,
            'taCreated_at' => now(),
        ]);
    }

    /** @test */
    public function teacher_can_update_assignment_requirements()
    {
        $assignment = $this->makeAssignment();
        $newDeadline = now()->addDays(7)->format('Y-m-d H:i:s');

        $response = $this->withHeaders($this->teacherHeader())
            ->putJson("/api/teacher/assignments/{$assignment->taId}", [
                'taMax_attempt' => 3,
                'taInstructions' => 'Hướng dẫn mới',
                'taDeadline' => $newDeadline,
                'taNotify_before_minutes' => 60,
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('status', 'success');

        $fresh = TestAssignment::find($assignment->taId);
        // Trước khi fix: taMax_attempt vẫn = 1 (bị ghi nhầm sang taMax_attempts).
        $this->assertEquals(3, $fresh->taMax_attempt);
        $this->assertEquals('Hướng dẫn mới', $fresh->taInstructions);
        $this->assertEquals(60, $fresh->taNotify_before_minutes);
        $this->assertEquals(
            $newDeadline,
            $fresh->taDeadline->format('Y-m-d H:i:s')
        );
    }

    /** @test */
    public function updating_notify_minutes_resets_notified_flag()
    {
        $assignment = $this->makeAssignment();
        $assignment->taNotified_at = now();
        $assignment->save();

        $this->withHeaders($this->teacherHeader())
            ->putJson("/api/teacher/assignments/{$assignment->taId}", [
                'taNotify_before_minutes' => 30,
            ])
            ->assertStatus(200);

        // Đổi lịch nhắc → cho phép gửi lại thông báo "trước giờ".
        $this->assertNull(TestAssignment::find($assignment->taId)->taNotified_at);
    }

    /** @test */
    public function update_does_not_crash_and_returns_exam_relation()
    {
        $assignment = $this->makeAssignment();

        $response = $this->withHeaders($this->teacherHeader())
            ->putJson("/api/teacher/assignments/{$assignment->taId}", [
                'taInstructions' => 'Chỉ đổi hướng dẫn',
            ]);

        $response->assertStatus(200);
        // Response nạp được quan hệ exam (trước đây ->load('students','classes') gây lỗi).
        $response->assertJsonPath('data.exam.eId', $assignment->exam_id);
    }

    /** @test */
    public function update_rejects_invalid_max_attempt()
    {
        $assignment = $this->makeAssignment();

        $this->withHeaders($this->teacherHeader())
            ->putJson("/api/teacher/assignments/{$assignment->taId}", [
                'taMax_attempt' => 0, // min:1
            ])
            ->assertStatus(400);
    }
}

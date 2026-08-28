<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Exam;
use App\Models\Submission;
use App\Models\TestAssignment;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Giới hạn lượt làm bài (taMax_attempt) cho các endpoint start-direct.
 *
 * THPT đã có bộ test riêng (ThptExamTest). File này phủ ba chỗ còn lại —
 * VSTEP/IELTS, teens, kids — vì cả ba từng có cùng hai lỗ:
 *
 *   1. restart hard-delete submission → bộ đếm lượt (Submission::count) tụt về
 *      0 → học viên đọc hết đề rồi làm lại vô hạn dù GV giới hạn 1 lần.
 *   2. assignment_id do FE gửi chỉ được kiểm theo exam_id → mượn taId của học
 *      viên khác là đếm lượt vào pool của họ, tự cấp thêm lượt cho mình.
 */
class AttemptLimitTest extends TestCase
{
    use RefreshDatabase;

    protected User $teacher;
    protected User $student;

    protected function setUp(): void
    {
        parent::setUp();
        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
        $this->student = User::factory()->create([
            'uRole' => 'student',
            'age_group' => 'teens',
        ]);
    }

    private function makeExam(string $type, string $ageGroup): Exam
    {
        return Exam::create([
            'eTitle' => "Đề {$type} {$ageGroup}",
            'eType' => $type,
            'eSkill' => 'mixed',
            'ePurpose' => 'exam',
            'eStatus' => 'published',
            'eTeacher_id' => $this->teacher->uId,
            'eDuration_minutes' => 30,
            'eIs_private' => false,
            'age_group' => $ageGroup,
        ]);
    }

    private function assign(int $examId, int $maxAttempt, ?int $studentId = null): TestAssignment
    {
        return TestAssignment::create([
            'exam_id' => $examId,
            'taTarget_type' => 'student',
            'taTarget_id' => $studentId ?? $this->student->uId,
            'taDeadline' => now()->addDays(3),
            'taMax_attempt' => $maxAttempt,
            'taCreated_at' => now(),
        ]);
    }

    /** Đánh dấu phiên đã nộp để lượt được tính, không cần chấm thật. */
    private function markSubmitted($submissionId): void
    {
        $submission = Submission::findOrFail($submissionId);
        $submission->sStatus = 'graded';
        $submission->sSubmit_time = now();
        $submission->save();
    }

    /* ==================== VSTEP / IELTS (adults) ==================== */

    /** @test */
    public function vstep_start_direct_enforces_the_attempt_limit(): void
    {
        $exam = $this->makeExam('VSTEP', 'adults');
        $this->assign($exam->eId, 1);

        $first = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/exams/{$exam->eId}/start-direct", []);
        $first->assertStatus(200);
        $this->markSubmitted($first->json('data.submissionId'));

        // Trước khi fix, endpoint này không đọc taMax_attempt và không set
        // sAttempt → học viên VSTEP/IELTS làm lại vô hạn.
        $second = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/exams/{$exam->eId}/start-direct", []);

        $second->assertStatus(403);
        $this->assertDatabaseCount('submissions', 1);
        $this->assertEquals(1, Submission::firstOrFail()->sAttempt);
    }

    /** @test */
    public function vstep_start_direct_ignores_an_assignment_belonging_to_another_student(): void
    {
        $exam = $this->makeExam('VSTEP', 'adults');
        $this->assign($exam->eId, 1);

        $other = User::factory()->create(['uRole' => 'student', 'age_group' => 'adults']);
        $foreign = $this->assign($exam->eId, 5, $other->uId);

        $first = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/exams/{$exam->eId}/start-direct", []);
        $this->markSubmitted($first->json('data.submissionId'));

        // Mượn taId của học viên khác (5 lượt) để né giới hạn 1 lượt của mình →
        // phải bị bỏ qua, rơi về pool của mình và bị chặn.
        $borrowed = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/exams/{$exam->eId}/start-direct", [
                'assignment_id' => $foreign->taId,
            ]);

        $borrowed->assertStatus(403);
        $this->assertDatabaseCount('submissions', 1);
    }

    /* ========================= TEENS / KIDS ========================= */

    /** @test */
    public function teens_direct_restart_is_rejected_when_no_spare_attempt_left(): void
    {
        $exam = $this->makeExam('GENERAL', 'teens');
        $this->assign($exam->eId, 1);

        $start = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/exams/{$exam->eId}/start-teens", []);
        $start->assertStatus(200);
        $sid = $start->json('data.submissionId');

        $restart = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/exams/{$exam->eId}/start-teens", ['restart' => true]);

        $restart->assertStatus(403);
        // Phiên đang làm phải còn nguyên — không được huỷ rồi mới chặn.
        $this->assertEquals('in_progress', Submission::find($sid)->sStatus);
        $this->assertDatabaseCount('submissions', 1);
    }

    /** @test */
    public function teens_direct_restart_voids_the_old_session_and_consumes_an_attempt(): void
    {
        $exam = $this->makeExam('GENERAL', 'teens');
        $this->assign($exam->eId, 2);

        $first = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/exams/{$exam->eId}/start-teens", []);
        $firstId = $first->json('data.submissionId');

        $restart = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/exams/{$exam->eId}/start-teens", ['restart' => true]);
        $restart->assertStatus(200);
        $this->assertNotEquals($firstId, $restart->json('data.submissionId'));

        $voided = Submission::find($firstId);
        $this->assertNotNull($voided, 'Phiên cũ phải được giữ lại (void), không hard-delete.');
        $this->assertEquals('auto_submitted', $voided->sStatus);
        $this->assertEquals('restart', $voided->auto_submit_reason);
        $this->assertDatabaseCount('submissions', 2);

        // Đã tiêu 2/2 lượt → restart lần nữa bị chặn.
        $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/exams/{$exam->eId}/start-teens", ['restart' => true])
            ->assertStatus(403);
    }

    /** @test */
    public function kids_direct_restart_keeps_the_used_attempt_in_the_pool(): void
    {
        $exam = $this->makeExam('GENERAL', 'kids');
        $this->assign($exam->eId, 1);

        $start = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/exams/{$exam->eId}/start-kids", []);
        $start->assertStatus(200);
        $sid = $start->json('data.submissionId');

        $restart = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/exams/{$exam->eId}/start-kids", ['restart' => true]);

        $restart->assertStatus(403);
        $this->assertEquals('in_progress', Submission::find($sid)->sStatus);
        $this->assertDatabaseCount('submissions', 1);
    }
}

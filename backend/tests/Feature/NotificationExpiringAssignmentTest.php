<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\Submission;
use App\Models\TestAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationExpiringAssignmentTest extends TestCase
{
    use RefreshDatabase;

    private User $teacher;
    private User $student;

    protected function setUp(): void
    {
        parent::setUp();

        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
        $this->student = User::factory()->create([
            'uRole' => 'student',
            'age_group' => 'teens',
        ]);
    }

    private function makeExam(): Exam
    {
        return Exam::create([
            'eTitle' => 'HSG-WORD FORMATION U123',
            'eType' => 'THPT',
            'eSkill' => 'Reading',
            'eDuration_minutes' => 60,
            'eStatus' => 'published',
            'eTeacher_id' => $this->teacher->uId,
            'age_group' => 'teens',
        ]);
    }

    private function assign(Exam $exam, ?string $deadline): TestAssignment
    {
        return TestAssignment::create([
            'exam_id' => $exam->eId,
            'taTarget_type' => 'student',
            'taTarget_id' => $this->student->uId,
            'taDeadline' => $deadline,
            'taMax_attempt' => 1,
            'taAssigned_by' => $this->teacher->uId,
        ]);
    }

    public function test_shows_deadline_notification_when_assignment_not_done(): void
    {
        $exam = $this->makeExam();
        $this->assign($exam, now()->addHours(7)->toDateTimeString());

        $res = $this->actingAs($this->student, 'sanctum')
            ->getJson('/api/student/notifications');

        $res->assertStatus(200);
        $notifications = $res->json('data.notifications');

        $deadlineNotifs = array_filter($notifications, fn($n) => $n['type'] === 'deadline');
        $this->assertCount(1, $deadlineNotifs);
    }

    public function test_hides_deadline_notification_when_assignment_is_completed(): void
    {
        $exam = $this->makeExam();
        $assignment = $this->assign($exam, now()->addHours(7)->toDateTimeString());

        Submission::create([
            'user_id' => $this->student->uId,
            'exam_id' => $exam->eId,
            'assignment_id' => $assignment->taId,
            'sAttempt' => 1,
            'sStatus' => 'graded',
            'sScore' => 8.0,
            'sGraded_time' => now(),
        ]);

        $res = $this->actingAs($this->student, 'sanctum')
            ->getJson('/api/student/notifications');

        $res->assertStatus(200);
        $notifications = $res->json('data.notifications');

        $deadlineNotifs = array_filter($notifications, fn($n) => $n['type'] === 'deadline');
        $this->assertCount(0, $deadlineNotifs);
    }

    public function test_hides_deadline_notification_when_submission_has_null_assignment_id(): void
    {
        $exam = $this->makeExam();
        $this->assign($exam, now()->addHours(7)->toDateTimeString());

        // Submission done on exam directly without assignment_id
        Submission::create([
            'user_id' => $this->student->uId,
            'exam_id' => $exam->eId,
            'assignment_id' => null,
            'sAttempt' => 1,
            'sStatus' => 'submitted',
            'sScore' => 9.0,
            'sSubmit_time' => now(),
        ]);

        $this->withoutExceptionHandling();
        $res = $this->actingAs($this->student, 'sanctum')
            ->getJson('/api/student/notifications');

        $res->assertStatus(200);
        $notifications = $res->json('data.notifications');

        $deadlineNotifs = array_filter($notifications, fn($n) => $n['type'] === 'deadline');
        $this->assertCount(0, $deadlineNotifs);
    }
}

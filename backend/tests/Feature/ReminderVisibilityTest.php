<?php

namespace Tests\Feature;

use App\Models\AssignmentReminder;
use App\Models\Exam;
use App\Models\Submission;
use App\Models\TestAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Nhắc nhở trên trang chủ học viên không được hiện khi đề đã quá hạn hoặc đã hết
 * lượt làm — bấm vào cũng bị chặn, nên thẻ chỉ gây nhiễu.
 */
class ReminderVisibilityTest extends TestCase
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
            'eTitle' => 'Đề Tiếng Anh THPT',
            'eType' => 'THPT',
            'eSkill' => 'Reading',
            'eDuration_minutes' => 60,
            'eStatus' => 'published',
            'eTeacher_id' => $this->teacher->uId,
            'age_group' => 'teens',
        ]);
    }

    private function assign(Exam $exam, ?string $deadline, int $maxAttempt = 1): TestAssignment
    {
        return TestAssignment::create([
            'exam_id' => $exam->eId,
            'taTarget_type' => 'student',
            'taTarget_id' => $this->student->uId,
            'taDeadline' => $deadline,
            'taMax_attempt' => $maxAttempt,
            'taAssigned_by' => $this->teacher->uId,
        ]);
    }

    private function remind(TestAssignment $assignment): AssignmentReminder
    {
        return AssignmentReminder::create([
            'assignment_id' => $assignment->taId,
            'student_id' => $this->student->uId,
            'teacher_id' => $this->teacher->uId,
            'message' => 'Nhớ làm bài nhé',
        ]);
    }

    private function fetchReminders(): array
    {
        $res = $this->actingAs($this->student, 'sanctum')
            ->getJson('/api/student/reminders');

        $res->assertStatus(200);

        return $res->json('data.reminders');
    }

    /** Mốc so sánh: chưa hết hạn, chưa làm gì thì phải hiện. */
    public function test_shows_reminder_for_an_open_assignment(): void
    {
        $exam = $this->makeExam();
        $this->remind($this->assign($exam, now()->addDays(3)->toDateTimeString()));

        $this->assertCount(1, $this->fetchReminders());
    }

    public function test_hides_reminder_when_the_deadline_has_passed(): void
    {
        $exam = $this->makeExam();
        $this->remind($this->assign($exam, now()->subDay()->toDateTimeString()));

        $this->assertCount(0, $this->fetchReminders());
    }

    /** Không có hạn nộp nghĩa là làm lúc nào cũng được, vẫn nhắc. */
    public function test_shows_reminder_when_there_is_no_deadline(): void
    {
        $exam = $this->makeExam();
        $this->remind($this->assign($exam, null));

        $this->assertCount(1, $this->fetchReminders());
    }

    public function test_hides_reminder_when_attempts_are_exhausted(): void
    {
        $exam = $this->makeExam();
        $assignment = $this->assign($exam, now()->addDays(3)->toDateTimeString(), 1);
        $this->remind($assignment);

        Submission::create([
            'user_id' => $this->student->uId,
            'exam_id' => $exam->eId,
            'assignment_id' => $assignment->taId,
            'sAttempt' => 1,
            'sStatus' => 'graded',
        ]);

        $this->assertCount(0, $this->fetchReminders());
    }

    /**
     * Đây là trường hợp cách làm cũ trả lời SAI: nó ẩn nhắc nhở ngay sau lượt
     * đầu, dù giáo viên cho hai lượt.
     */
    public function test_still_shows_reminder_when_attempts_remain(): void
    {
        $exam = $this->makeExam();
        $assignment = $this->assign($exam, now()->addDays(3)->toDateTimeString(), 2);
        $this->remind($assignment);

        Submission::create([
            'user_id' => $this->student->uId,
            'exam_id' => $exam->eId,
            'assignment_id' => $assignment->taId,
            'sAttempt' => 1,
            'sStatus' => 'graded',
        ]);

        $this->assertCount(1, $this->fetchReminders());
    }

    /**
     * Trường hợp thứ hai cách làm cũ trả lời sai: bài đã nộp đang chờ chấm chủ
     * quan có sStatus 'grading_subjective', không nằm trong danh sách
     * submitted/graded cũ nên vẫn bị nhắc như chưa làm.
     */
    public function test_hides_reminder_for_a_submission_awaiting_subjective_grading(): void
    {
        $exam = $this->makeExam();
        $assignment = $this->assign($exam, now()->addDays(3)->toDateTimeString(), 1);
        $this->remind($assignment);

        Submission::create([
            'user_id' => $this->student->uId,
            'exam_id' => $exam->eId,
            'assignment_id' => $assignment->taId,
            'sAttempt' => 1,
            'sStatus' => 'grading_subjective',
        ]);

        $this->assertCount(0, $this->fetchReminders());
    }

    /** Bài đang làm dở cũng tính là đã dùng lượt. */
    public function test_hides_reminder_when_the_only_attempt_is_in_progress(): void
    {
        $exam = $this->makeExam();
        $assignment = $this->assign($exam, now()->addDays(3)->toDateTimeString(), 1);
        $this->remind($assignment);

        Submission::create([
            'user_id' => $this->student->uId,
            'exam_id' => $exam->eId,
            'assignment_id' => $assignment->taId,
            'sAttempt' => 1,
            'sStatus' => 'in_progress',
        ]);

        $this->assertCount(0, $this->fetchReminders());
    }

    /** Nhắc nhở đã tự tắt thì không quay lại. */
    public function test_hides_a_dismissed_reminder(): void
    {
        $exam = $this->makeExam();
        $reminder = $this->remind($this->assign($exam, now()->addDays(3)->toDateTimeString()));
        $reminder->update(['dismissed_at' => now()]);

        $this->assertCount(0, $this->fetchReminders());
    }

    /**
     * taMax_attempt 0 phải hiểu là 1 lượt, khớp mặc định `?? 1` của bulkAssign.
     * Nếu hiểu theo nghĩa "0 lượt" thì nhắc nhở biến mất ngay khi vừa giao.
     */
    public function test_treats_zero_max_attempt_as_one(): void
    {
        $exam = $this->makeExam();
        $this->remind($this->assign($exam, now()->addDays(3)->toDateTimeString(), 0));

        $this->assertCount(1, $this->fetchReminders());
    }
}

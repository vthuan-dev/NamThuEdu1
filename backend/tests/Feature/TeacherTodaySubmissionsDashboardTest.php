<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\Submission;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TeacherTodaySubmissionsDashboardTest extends TestCase
{
    use RefreshDatabase;

    private User $teacher;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-06-19 12:00:00', 'Asia/Ho_Chi_Minh'));
        $this->teacher = User::factory()->teacher()->create();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_teacher_can_view_all_system_submissions_grouped_by_type_and_age_group(): void
    {
        $otherTeacher = User::factory()->teacher()->create();
        $adult = User::factory()->student()->create(['age_group' => 'adults']);
        $teen = User::factory()->student()->create(['age_group' => 'teens']);
        $kid = User::factory()->student()->create(['age_group' => 'kids']);

        $vstep = $this->exam($otherTeacher, 'VSTEP', 'all');
        $ielts = $this->exam($this->teacher, 'IELTS', 'adults');
        $thpt = $this->exam($this->teacher, 'THPT', 'teens');
        $kidsGeneral = $this->exam($otherTeacher, 'GENERAL', 'kids');
        $teensGeneral = $this->exam($this->teacher, 'GENERAL', 'teens');

        $this->submission($vstep, $adult, '2026-06-18 17:00:00', 'graded');
        $this->submission($vstep, $adult, '2026-06-19 03:00:00', 'auto_submitted', 2);
        $this->submission($ielts, $teen, '2026-06-19 04:00:00', 'submitted');
        $this->submission($thpt, $teen, '2026-06-19 05:00:00', 'grading_subjective');
        $this->submission($kidsGeneral, $kid, '2026-06-19 16:59:59', 'graded');
        $this->submission($teensGeneral, $teen, '2026-06-19 07:00:00', 'graded');

        // Outside the Vietnam day and an unfinished attempt must not count.
        $this->submission($vstep, $adult, '2026-06-18 16:59:59', 'graded', 3);
        $this->submission($vstep, $adult, '2026-06-19 17:00:00', 'graded', 4);
        Submission::factory()->create([
            'exam_id' => $vstep->eId,
            'user_id' => $adult->uId,
            'sStatus' => 'in_progress',
            'sSubmit_time' => null,
        ]);

        $response = $this->actingAs($this->teacher, 'sanctum')
            ->getJson('/api/teacher/dashboard/today-submissions-by-type');

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('meta.total', 6)
            ->assertJsonPath('meta.adults', 2)
            ->assertJsonPath('meta.teens', 3)
            ->assertJsonPath('meta.kids', 1)
            ->assertJsonPath('meta.date', '2026-06-19')
            ->assertJsonPath('meta.timezone', 'Asia/Ho_Chi_Minh')
            ->assertJsonFragment([
                'exam_type' => 'vstep',
                'label' => 'VSTEP',
                'adults' => 2,
                'teens' => 0,
                'kids' => 0,
                'total' => 2,
            ])
            ->assertJsonFragment([
                'exam_type' => 'ielts',
                'label' => 'IELTS',
                'adults' => 0,
                'teens' => 1,
                'kids' => 0,
                'total' => 1,
            ])
            ->assertJsonFragment([
                'exam_type' => 'cambridge_yle',
                'label' => 'Cambridge YLE',
                'adults' => 0,
                'teens' => 0,
                'kids' => 1,
                'total' => 1,
            ]);
    }

    public function test_student_cannot_access_today_submission_statistics(): void
    {
        $student = User::factory()->student()->create(['age_group' => 'adults']);

        $this->actingAs($student, 'sanctum')
            ->getJson('/api/teacher/dashboard/today-submissions-by-type')
            ->assertForbidden();
    }

    private function exam(User $teacher, string $type, string $ageGroup): Exam
    {
        return Exam::factory()->create([
            'eTeacher_id' => $teacher->uId,
            'eType' => $type,
            'age_group' => $ageGroup,
            'eStatus' => 'published',
        ]);
    }

    private function submission(
        Exam $exam,
        User $student,
        string $submittedAtUtc,
        string $status,
        int $attempt = 1
    ): Submission {
        return Submission::factory()->create([
            'exam_id' => $exam->eId,
            'user_id' => $student->uId,
            'sAttempt' => $attempt,
            'sStart_time' => Carbon::parse($submittedAtUtc, 'UTC')->subMinutes(30),
            'sSubmit_time' => Carbon::parse($submittedAtUtc, 'UTC'),
            'sStatus' => $status,
        ]);
    }
}

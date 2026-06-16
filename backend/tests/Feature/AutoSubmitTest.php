<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Exam;
use App\Models\ExamType;
use App\Models\Question;
use App\Models\Submission;
use App\Services\ExamAutoSubmitService;
use App\Console\Commands\ProcessExpiredTests;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;

/**
 * Test full chức năng auto-submit: unload, timeout, inactive.
 */
class AutoSubmitTest extends TestCase
{
    use RefreshDatabase;

    protected $teacher;
    protected $student;
    protected $exam;

    protected function setUp(): void
    {
        parent::setUp();
        $this->artisan('migrate:fresh');

        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
        $this->student = User::factory()->create(['uRole' => 'student']);

        ExamType::create(['etName' => 'VSTEP', 'etDescription' => 'VSTEP']);

        $this->exam = Exam::factory()->create([
            'eTeacher_id' => $this->teacher->uId,
            'eStatus' => 'published',
            'eDuration_minutes' => 60,
            'eType' => 'VSTEP',
        ]);

        Question::factory()->count(3)->create([
            'exam_id' => $this->exam->eId,
            'qType' => 'multiple_choice',
        ]);
    }

    /** @test */
    public function auto_submit_api_endpoint_works()
    {
        $submission = Submission::create([
            'user_id' => $this->student->uId,
            'exam_id' => $this->exam->eId,
            'sStatus' => 'in_progress',
            'sStart_time' => now()->subMinutes(5),
        ]);

        $token = $this->student->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson("/api/student/tests/{$submission->sId}/auto-submit", [
                'reason' => 'unload',
            ]);

        $response->assertOk();
        $response->assertJsonPath('status', 'success');
        $response->assertJsonPath('autoSubmitted', true);

        $submission->refresh();
        $this->assertNotEquals('in_progress', $submission->sStatus);
    }

    /** @test */
    public function auto_submit_is_idempotent()
    {
        $submission = Submission::create([
            'user_id' => $this->student->uId,
            'exam_id' => $this->exam->eId,
            'sStatus' => 'submitted',
            'sStart_time' => now()->subMinutes(5),
            'sSubmit_time' => now(),
        ]);

        $service = app(ExamAutoSubmitService::class);
        $result = $service->autoSubmit($submission, ExamAutoSubmitService::REASON_TIMEOUT);

        $this->assertTrue($result['ok']);
        $this->assertTrue($result['idempotent']);
    }

    /** @test */
    public function cron_detects_expired_tests()
    {
        $submission = Submission::create([
            'user_id' => $this->student->uId,
            'exam_id' => $this->exam->eId,
            'sStatus' => 'in_progress',
            'sStart_time' => now()->subMinutes(70), // hết giờ (60m + 10m)
        ]);

        $this->artisan('tests:process-expired');

        $submission->refresh();
        $this->assertEquals('auto_submitted', $submission->sStatus);
    }

    /** @test */
    public function cron_detects_inactive_tests()
    {
        $submission = Submission::create([
            'user_id' => $this->student->uId,
            'exam_id' => $this->exam->eId,
            'sStatus' => 'in_progress',
            'sStart_time' => now()->subMinutes(5),
            'last_activity_at' => now()->subMinutes(20), // "câm" 20 phút
        ]);

        $this->artisan('tests:process-expired');

        $submission->refresh();
        $this->assertEquals('auto_submitted', $submission->sStatus);
    }

    /** @test */
    public function cron_skips_active_tests()
    {
        $now = now();
        $submission = Submission::create([
            'user_id' => $this->student->uId,
            'exam_id' => $this->exam->eId,
            'sStatus' => 'in_progress',
            'sStart_time' => $now,
            'last_activity_at' => $now,
        ]);

        // Debug: verify the submission data in DB
        $freshSub = Submission::find($submission->sId);
        $this->assertEquals($now->toDateTimeString(), $freshSub->sStart_time->toDateTimeString());
        $this->assertEquals($now->toDateTimeString(), $freshSub->last_activity_at->toDateTimeString());

        $this->artisan('tests:process-expired');

        $submission->refresh();
        $this->assertEquals('in_progress', $submission->sStatus,
            'Submission should stay in_progress. Status changed to: ' . $submission->sStatus
            . ', start_time: ' . $submission->sStart_time
            . ', last_activity: ' . $submission->last_activity_at
            . ', exam_duration: ' . $this->exam->eDuration_minutes
        );
    }

    /** @test */
    public function auto_submit_reason_is_recorded()
    {
        $submission = Submission::create([
            'user_id' => $this->student->uId,
            'exam_id' => $this->exam->eId,
            'sStatus' => 'in_progress',
            'sStart_time' => now()->subMinutes(70),
        ]);

        $service = app(ExamAutoSubmitService::class);
        $service->autoSubmit($submission, ExamAutoSubmitService::REASON_INACTIVE);

        $submission->refresh();
        $this->assertEquals('inactive', $submission->auto_submit_reason);
    }

    /** @test */
    public function test_recovery_service_skips_active_tests()
    {
        Submission::create([
            'user_id' => $this->student->uId,
            'exam_id' => $this->exam->eId,
            'sStatus' => 'in_progress',
            'sStart_time' => now(),
            'last_activity_at' => now(),
        ]);

        $stats = \App\Services\TestRecoveryService::handleInterruptedTests();

        $this->assertEquals(0, $stats['timeout']);
        $this->assertEquals(0, $stats['inactive']);
        $this->assertEquals(0, $stats['failed']);
    }
}

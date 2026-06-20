<?php

namespace Tests\Integration;

use App\Models\Exam;
use App\Models\Question;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * Integration test: Submit → Grade → Result flow
 * Covers THPT, VSTEP, and generic exam types.
 */
class SubmitGradingFlowTest extends TestCase
{
    use RefreshDatabase;

    private User $student;
    private User $teacher;

    protected function setUp(): void
    {
        parent::setUp();
        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
        $this->student = User::factory()->create(['uRole' => 'student', 'age_group' => 'adults']);
    }

    /** @test */
    public function thpt_manual_submit_grades_correctly()
    {
        $exam = Exam::factory()->create([
            'eType' => 'THPT',
            'eTeacher_id' => $this->teacher->uId,
            'thpt_config' => [
                'scale_max' => 10,
                'sections' => [
                    [
                        'id' => 'sec1',
                        'type' => 'mc_questions',
                        'title' => 'Trắc nghiệm',
                        'points_per_question' => 1,
                        'items' => [
                            ['question_number' => 1, 'correct_id' => 'A'],
                            ['question_number' => 2, 'correct_id' => 'B'],
                        ],
                    ],
                ],
            ],
        ]);

        $submission = Submission::factory()->create([
            'user_id' => $this->student->uId,
            'exam_id' => $exam->eId,
            'sStatus' => 'in_progress',
        ]);

        $response = $this->actingAs($this->student, 'api')
            ->postJson("/api/student/thpt-exams/{$exam->eId}/submit", [
                'submission_id' => $submission->sId,
                'answers' => ['q1' => 'A', 'q2' => 'B'],
                'final' => true,
            ]);

        $response->assertOk();
        $data = $response->json('data');
        $this->assertEquals('graded', $data['sStatus']);
        $this->assertEquals(10.0, $data['sScore']);

        $submission->refresh();
        $result = $submission->submission_payload['result'];
        $this->assertEquals(2, $result['raw_score']);
        $this->assertEquals(10.0, $result['scaled_score']);
        $this->assertEquals('A', $result['correct_answers']['q1']);
    }

    /** @test */
    public function thpt_auto_submit_on_timeout()
    {
        $exam = Exam::factory()->create([
            'eType' => 'THPT',
            'eTeacher_id' => $this->teacher->uId,
            'eDuration_minutes' => 1,
            'thpt_config' => [
                'scale_max' => 10,
                'sections' => [
                    [
                        'id' => 'sec1',
                        'type' => 'mc_questions',
                        'title' => 'Trắc nghiệm',
                        'points_per_question' => 1,
                        'items' => [
                            ['question_number' => 1, 'correct_id' => 'A'],
                        ],
                    ],
                ],
            ],
        ]);

        $submission = Submission::factory()->create([
            'user_id' => $this->student->uId,
            'exam_id' => $exam->eId,
            'sStatus' => 'in_progress',
            'sStart_time' => now()->subMinutes(2),
        ]);

        $response = $this->actingAs($this->student, 'api')
            ->postJson("/api/student/thpt-exams/{$exam->eId}/submit", [
                'submission_id' => $submission->sId,
                'answers' => ['q1' => 'A'],
                'final' => true,
            ]);

        $response->assertOk();
        $submission->refresh();
        $this->assertTrue(in_array($submission->sStatus, ['graded', 'auto_submitted']));
    }

    /** @test */
    public function vstep_submit_triggers_grading_subjective_when_has_writing()
    {
        Queue::fake();

        $exam = Exam::factory()->create([
            'eType' => 'VSTEP',
            'eSkill' => 'mixed',
            'eTeacher_id' => $this->teacher->uId,
        ]);

        // Listening MCQ
        $qListen = Question::factory()->create([
            'exam_id' => $exam->eId,
            'qType' => 'multiple_choice',
            'qSection' => 'listening',
            'qPoints' => 1,
        ]);
        $qListen->answers()->create(['aContent' => 'A', 'aIs_correct' => true]);

        // Writing essay
        $qWrite = Question::factory()->create([
            'exam_id' => $exam->eId,
            'qType' => 'essay',
            'qSection' => 'writing',
            'qPoints' => 10,
        ]);

        $submission = Submission::factory()->create([
            'user_id' => $this->student->uId,
            'exam_id' => $exam->eId,
            'sStatus' => 'in_progress',
        ]);

        // Student answers listening correctly and writes essay
        $submission->answers()->create([
            'question_id' => $qListen->qId,
            'saAnswer_text' => 'A',
        ]);
        $submission->answers()->create([
            'question_id' => $qWrite->qId,
            'saAnswer_text' => str_repeat('word ', 50), // meaningful writing
        ]);

        $response = $this->actingAs($this->student, 'api')
            ->postJson("/api/student/tests/{$submission->sId}/submit");

        $response->assertOk();
        $data = $response->json('data');
        $this->assertEquals('grading_subjective', $data['sStatus']);
        $this->assertArrayHasKey('vstep_scores', $data);
        $this->assertEquals(10.0, $data['vstep_scores']['listening']);
        $this->assertNull($data['vstep_scores']['writing']);

        Queue::assertPushed(\App\Jobs\GradeVstepSubjectiveJob::class);
    }

    /** @test */
    public function teacher_can_override_vstep_skill_scores()
    {
        $exam = Exam::factory()->create([
            'eType' => 'VSTEP',
            'eTeacher_id' => $this->teacher->uId,
        ]);
        $submission = Submission::factory()->create([
            'user_id' => $this->student->uId,
            'exam_id' => $exam->eId,
            'sStatus' => 'graded',
            'sScore' => 60.0,
            'sGemini_feedback' => json_encode([
                'vstep_scores' => [
                    'listening' => 6.0,
                    'reading' => 6.0,
                    'writing' => null,
                    'speaking' => null,
                ],
            ]),
        ]);

        $response = $this->actingAs($this->teacher, 'api')
            ->postJson("/api/teacher/submissions/{$submission->sId}/grade", [
                'skill_overrides' => [
                    'listening' => 8.5,
                    'reading' => 7.0,
                ],
            ]);

        $response->assertOk();
        $submission->refresh();
        $raw = json_decode($submission->sGemini_feedback, true);
        $this->assertEquals(8.5, $raw['vstep_scores']['listening']);
        $this->assertEquals(7.0, $raw['vstep_scores']['reading']);
        // Overall = avg(8.5, 7.0) * 10 = 77.5
        $this->assertEquals(77.5, $submission->sScore);
    }

    /** @test */
    public function thpt_result_endpoint_returns_speaking_after_ai_grading()
    {
        $exam = Exam::factory()->create([
            'eType' => 'THPT',
            'eTeacher_id' => $this->teacher->uId,
        ]);
        $submission = Submission::factory()->create([
            'user_id' => $this->student->uId,
            'exam_id' => $exam->eId,
            'sStatus' => 'graded',
            'sScore' => 8.5,
            'submission_payload' => [
                'result' => [
                    'scaled_score' => 8.5,
                    'scale_max' => 10,
                    'speaking' => [
                        'score' => 7.5,
                        'scale_max' => 10,
                        'parts' => ['q1' => ['score' => 7.5]],
                    ],
                ],
            ],
        ]);

        $response = $this->actingAs($this->student, 'api')
            ->getJson("/api/student/thpt-submissions/{$submission->sId}/result");

        $response->assertOk();
        $data = $response->json('data');
        $this->assertEquals(8.5, $data['result']['scaled_score']);
        $this->assertEquals(7.5, $data['result']['speaking']['score']);
    }
}

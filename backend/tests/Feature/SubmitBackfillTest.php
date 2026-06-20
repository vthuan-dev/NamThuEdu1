<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ClassModel;
use App\Models\Exam;
use App\Models\Question;
use App\Models\Answer;
use App\Models\TestAssignment;
use App\Models\Submission;
use App\Models\SubmissionAnswer;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Đảm bảo các luồng submit (manual + auto) đều:
 *   1. Backfill blank SubmissionAnswer cho mọi câu hỏi chưa trả lời
 *   2. gradeAnswers chấm 0 cho MCQ bỏ trống
 *   3. Teacher grading nhìn được đủ câu hỏi (kể cả câu chưa làm)
 *   4. Endpoint bulk-answers cho phép push nhiều answer cùng lúc trước submit
 */
class SubmitBackfillTest extends TestCase
{
    use RefreshDatabase;

    protected User $teacher;
    protected User $student;
    protected ClassModel $class;
    protected Exam $exam;
    protected TestAssignment $assignment;

    /** @var array<int,array{qId:int,correct:string,wrong:string}> */
    protected array $questions = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->buildScenario();
    }

    private function buildScenario(): void
    {
        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
        $this->class = ClassModel::create([
            'cName' => 'Backfill Class',
            'cTeacher_id' => $this->teacher->uId,
            'age_group' => 'teens',
            'max_students' => 30,
            'cStatus' => 'active',
        ]);
        $this->student = User::factory()->create([
            'uRole' => 'student',
            'age_group' => 'teens',
            'class_id' => $this->class->cId,
            'uStatus' => 'active',
        ]);
        $this->exam = Exam::create([
            'eTitle' => 'Backfill Test Exam',
            'eDescription' => 'objective',
            'eType' => 'GENERAL',
            'eSkill' => 'mixed',
            'ePurpose' => 'exam',
            'eDifficulty' => 'easy',
            'eTeacher_id' => $this->teacher->uId,
            'eDuration_minutes' => 30,
            'eTotal_score' => 100,
            'ePass_score' => 50,
            'eIs_private' => false,
            'eSource_type' => 'manual',
            'eStatus' => 'published',
            'age_group' => 'teens',
        ]);

        // 5 câu trắc nghiệm, mỗi câu 20 điểm
        for ($i = 1; $i <= 5; $i++) {
            $q = Question::create([
                'exam_id' => $this->exam->eId,
                'qContent' => "Q{$i}?",
                'qType' => 'multiple_choice',
                'qPoints' => 20,
                'qOrder' => $i,
            ]);
            $correct = Answer::create([
                'question_id' => $q->qId,
                'aContent' => "correct_{$i}",
                'aIs_correct' => true,
                'aOrder' => 0,
            ]);
            Answer::create([
                'question_id' => $q->qId,
                'aContent' => "wrong_{$i}",
                'aIs_correct' => false,
                'aOrder' => 1,
            ]);
            $this->questions[] = [
                'qId' => $q->qId,
                'correct' => "correct_{$i}",
                'wrong' => "wrong_{$i}",
            ];
        }

        $this->assignment = TestAssignment::create([
            'exam_id' => $this->exam->eId,
            'taTeacher_id' => $this->teacher->uId,
            'taTarget_type' => 'class',
            'taTarget_id' => $this->class->cId,
            'taDeadline' => now()->addDays(7),
            'taMax_attempt' => 3,
            'taIs_public' => true,
        ]);
    }

    private function startSubmission(): int
    {
        $res = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/tests/{$this->assignment->taId}/start", []);
        $res->assertStatus(200);
        return $res->json('data.submissionId');
    }

    /** @test */
    public function submit_creates_blank_rows_for_unanswered_questions(): void
    {
        $submissionId = $this->startSubmission();

        // Học viên chỉ trả lời 2/5 câu
        $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/tests/{$submissionId}/answer", [
                'question_id' => $this->questions[0]['qId'],
                'saAnswer_text' => $this->questions[0]['correct'],
            ])->assertStatus(200);
        $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/tests/{$submissionId}/answer", [
                'question_id' => $this->questions[1]['qId'],
                'saAnswer_text' => $this->questions[1]['correct'],
            ])->assertStatus(200);

        // Submit
        $res = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/tests/{$submissionId}/submit", []);
        $res->assertStatus(200);
        $res->assertJsonPath('data.sStatus', 'graded');

        // Sau submit: TẤT CẢ 5 câu đều có row trong submission_answers
        $count = SubmissionAnswer::where('submission_id', $submissionId)->count();
        $this->assertEquals(5, $count, 'Mọi câu hỏi trong đề phải có 1 row trong submission_answers sau submit.');

        // 3 câu chưa trả lời phải có saAnswer_text='' và saIs_correct=false
        $unansweredQids = [$this->questions[2]['qId'], $this->questions[3]['qId'], $this->questions[4]['qId']];
        foreach ($unansweredQids as $qid) {
            $row = SubmissionAnswer::where('submission_id', $submissionId)
                ->where('question_id', $qid)->first();
            $this->assertNotNull($row, "Câu {$qid} phải có row backfill");
            $this->assertEquals('', $row->saAnswer_text);
            $this->assertEquals(false, (bool) $row->saIs_correct);
            $this->assertEquals(0.0, (float) $row->saPoints_awarded);
        }

        // Điểm: 2 đúng / 5 = 40
        $this->assertEquals(40.0, (float) $res->json('data.sScore'));
    }

    /** @test */
    public function submit_with_zero_answers_is_blocked(): void
    {
        $submissionId = $this->startSubmission();

        $res = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/tests/{$submissionId}/submit", []);

        $res->assertStatus(400);
        $this->assertEquals('Bạn chưa trả lời bất kỳ câu hỏi nào.', $res->json('message'));
    }

    /** @test */
    public function bulk_answer_endpoint_saves_multiple_answers_at_once(): void
    {
        $submissionId = $this->startSubmission();

        $payload = [
            'answers' => array_map(function ($q) {
                return [
                    'question_id' => $q['qId'],
                    'saAnswer_text' => $q['correct'],
                ];
            }, $this->questions),
        ];

        $res = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/tests/{$submissionId}/answers/bulk", $payload);
        $res->assertStatus(200);
        $res->assertJsonPath('data.saved', 5);
        $res->assertJsonPath('data.skipped', 0);

        // Verify all 5 answers in DB
        $count = SubmissionAnswer::where('submission_id', $submissionId)->count();
        $this->assertEquals(5, $count);

        // Submit và check 100 điểm
        $sub = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/tests/{$submissionId}/submit", []);
        $sub->assertStatus(200);
        $this->assertEquals(100.0, (float) $sub->json('data.sScore'));
    }

    /** @test */
    public function bulk_answer_skips_questions_not_in_exam(): void
    {
        $submissionId = $this->startSubmission();

        $payload = [
            'answers' => [
                ['question_id' => $this->questions[0]['qId'], 'saAnswer_text' => 'A'],
                ['question_id' => 99999, 'saAnswer_text' => 'A'], // câu không tồn tại
            ],
        ];

        $res = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/tests/{$submissionId}/answers/bulk", $payload);
        $res->assertStatus(200);
        $res->assertJsonPath('data.saved', 1);
        $res->assertJsonPath('data.skipped', 1);
    }

    /** @test */
    public function bulk_answer_rejects_after_submit(): void
    {
        $submissionId = $this->startSubmission();
        // Trả lời tối thiểu 1 câu để submit hợp lệ
        $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/tests/{$submissionId}/answer", [
                'question_id' => $this->questions[0]['qId'],
                'saAnswer_text' => 'A',
            ]);
        $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/tests/{$submissionId}/submit", [])
            ->assertStatus(200);

        // Bulk save sau khi đã submit → fail
        $res = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/tests/{$submissionId}/answers/bulk", [
                'answers' => [
                    ['question_id' => $this->questions[0]['qId'], 'saAnswer_text' => 'B'],
                ],
            ]);
        $res->assertStatus(400);
    }

    /** @test */
    public function teacher_can_see_all_questions_after_partial_submit(): void
    {
        $submissionId = $this->startSubmission();

        // Học viên chỉ làm 1/5 câu
        $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/tests/{$submissionId}/answer", [
                'question_id' => $this->questions[0]['qId'],
                'saAnswer_text' => $this->questions[0]['correct'],
            ]);
        $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/tests/{$submissionId}/submit", [])
            ->assertStatus(200);

        // Teacher xem chấm điểm — phải thấy đủ 5 câu
        $res = $this->actingAs($this->teacher, 'sanctum')
            ->getJson("/api/teacher/submissions/{$submissionId}");
        $res->assertStatus(200);

        $answers = $res->json('data.answers') ?? [];
        $this->assertCount(5, $answers, 'Teacher grading phải hiển thị đủ 5 câu (cả câu chưa làm).');

        // Verify câu chưa làm có saAnswer_text rỗng
        $unansweredCount = collect($answers)
            ->filter(fn($a) => trim($a['saAnswer_text'] ?? '') === '')
            ->count();
        $this->assertEquals(4, $unansweredCount, 'Phải có 4 câu hiển thị empty cho teacher.');
    }
}

<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;

/**
 * Xác minh: giáo viên có thể tạo & xuất bản đề VSTEP kỹ năng riêng
 * với TỐI THIỂU 1 phần (Writing 1 task / Speaking 1 part).
 */
class VstepPartialSkillPublishTest extends TestCase
{
    use DatabaseTransactions;

    protected $teacher;
    protected $token;

    protected function setUp(): void
    {
        parent::setUp();
        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
        $this->token = $this->teacher->createToken('test')->plainTextToken;
    }

    private function authHeader(): array
    {
        return ['Authorization' => 'Bearer ' . $this->token];
    }

    private function createExam(string $skill): int
    {
        $res = $this->withHeaders($this->authHeader())
            ->postJson('/api/teacher/exams', [
                'eTitle'            => "VSTEP {$skill} partial",
                'eType'             => 'VSTEP',
                'eSkill'            => $skill,
                'eDuration_minutes' => 60,
            ]);
        $res->assertStatus(200);
        return $res->json('data.eId');
    }

    // ===================== WRITING =====================

    /** @test */
    public function teacher_can_publish_writing_exam_with_only_task_1()
    {
        $examId = $this->createExam('writing');

        // Save chỉ Task 1
        $save = $this->withHeaders($this->authHeader())
            ->postJson("/api/teacher/exams/{$examId}/vstep/writing/tasks/1", [
                'taskNumber' => 1,
                'taskName'   => 'Task 1 - Email/Letter',
                'prompt'     => 'Write an email to your friend about your holiday.',
                'wordCount'  => [120, 150],
                'timeLimit'  => 20,
            ]);
        $save->assertStatus(200);

        // Publish chỉ với 1 task
        $publish = $this->withHeaders($this->authHeader())
            ->postJson("/api/teacher/exams/{$examId}/vstep/writing/publish", [
                'title' => 'VSTEP Writing - chỉ Task 1',
                'tasks' => [
                    [
                        'taskNumber' => 1,
                        'taskName'   => 'Task 1 - Email/Letter',
                        'prompt'     => 'Write an email to your friend about your holiday.',
                    ],
                ],
            ]);

        $publish->assertStatus(200);
        $publish->assertJson(['status' => 'success']);
    }

    /** @test */
    public function writing_publish_rejects_when_no_task_saved()
    {
        $examId = $this->createExam('writing');

        // Không save task nào, publish luôn → phải bị chặn (chưa có question)
        $publish = $this->withHeaders($this->authHeader())
            ->postJson("/api/teacher/exams/{$examId}/vstep/writing/publish", [
                'title' => 'VSTEP Writing rỗng',
                'tasks' => [
                    [
                        'taskNumber' => 1,
                        'taskName'   => 'Task 1',
                        'prompt'     => 'X', // payload hợp lệ nhưng chưa có question trong DB
                    ],
                ],
            ]);

        $publish->assertStatus(400);
    }

    // ===================== SPEAKING =====================

    /** @test */
    public function teacher_can_publish_speaking_exam_with_only_part_2()
    {
        $examId = $this->createExam('speaking');

        // Save chỉ Part 2 (NEW FORMAT: part2Data)
        $save = $this->withHeaders($this->authHeader())
            ->postJson("/api/teacher/exams/{$examId}/vstep/speaking/parts/2", [
                'partName'  => 'Part 2 - Solution Discussion',
                'timeLimit' => 4,
                'part2Data' => [
                    'situation'   => 'Your friend wants to learn English.',
                    'solutions'   => ['Take a course', 'Watch movies', 'Practice daily'],
                    'question'    => 'Which solution is best and why?',
                    'explanation' => 'Encourage structured learning.',
                ],
            ]);
        $save->assertStatus(200);

        // Publish chỉ với 1 part
        $publish = $this->withHeaders($this->authHeader())
            ->postJson("/api/teacher/exams/{$examId}/vstep/speaking/publish", [
                'title' => 'VSTEP Speaking - chỉ Part 2',
                'parts' => [
                    [
                        'partNumber' => 2,
                        'partName'   => 'Part 2 - Solution Discussion',
                        'timeLimit'  => 4,
                        'part2Data'  => [
                            'situation' => 'Your friend wants to learn English.',
                            'solutions' => ['Take a course', 'Watch movies', 'Practice daily'],
                            'question'  => 'Which solution is best and why?',
                        ],
                    ],
                ],
            ]);

        $publish->assertStatus(200);
        $publish->assertJson(['status' => 'success']);
    }

    // ===================== DELETE TASK/PART =====================

    /** @test */
    public function teacher_can_delete_writing_task()
    {
        $examId = $this->createExam('writing');

        // Lưu Task 1 + Task 2
        foreach ([1, 2] as $taskNumber) {
            $this->withHeaders($this->authHeader())
                ->postJson("/api/teacher/exams/{$examId}/vstep/writing/tasks/{$taskNumber}", [
                    'taskNumber' => $taskNumber,
                    'taskName'   => "Task {$taskNumber}",
                    'prompt'     => "Prompt for task {$taskNumber}.",
                    'wordCount'  => [120, 150],
                    'timeLimit'  => 20,
                ])->assertStatus(200);
        }

        // Trước khi xoá: có 2 writing question
        $this->assertSame(2, \App\Models\Question::where('exam_id', $examId)
            ->where('qSkill', 'writing')->count());

        // Xoá Task 2
        $delete = $this->withHeaders($this->authHeader())
            ->deleteJson("/api/teacher/exams/{$examId}/vstep/writing/tasks/2");
        $delete->assertStatus(200);
        $delete->assertJson(['status' => 'success']);
        $delete->assertJsonPath('data.remaining_writing_questions', 1);

        // Sau khi xoá: chỉ còn Task 1
        $this->assertSame(1, \App\Models\Question::where('exam_id', $examId)
            ->where('qSkill', 'writing')->count());
        $this->assertSame(0, \App\Models\Question::where('exam_id', $examId)
            ->where('qSkill', 'writing')->where('qPart', 2)->count());

        // Vẫn publish OK với 1 task còn lại
        $publish = $this->withHeaders($this->authHeader())
            ->postJson("/api/teacher/exams/{$examId}/vstep/writing/publish", [
                'title' => 'VSTEP Writing - sau khi xoá Task 2',
                'tasks' => [
                    ['taskNumber' => 1, 'taskName' => 'Task 1', 'prompt' => 'Prompt for task 1.'],
                ],
            ]);
        $publish->assertStatus(200);
    }

    /** @test */
    public function teacher_can_delete_speaking_part()
    {
        $examId = $this->createExam('speaking');

        // Lưu Part 1 (có topic + questions) và Part 2
        $this->withHeaders($this->authHeader())
            ->postJson("/api/teacher/exams/{$examId}/vstep/speaking/parts/1", [
                'partName'  => 'Part 1 - Social Interaction',
                'timeLimit' => 3,
                'part1Data' => [
                    [
                        'topicName' => 'Hobbies',
                        'questions' => ['Q1?', 'Q2?', 'Q3?'],
                    ],
                ],
            ])->assertStatus(200);

        $this->withHeaders($this->authHeader())
            ->postJson("/api/teacher/exams/{$examId}/vstep/speaking/parts/2", [
                'partName'  => 'Part 2 - Solution Discussion',
                'timeLimit' => 4,
                'part2Data' => [
                    'situation' => 'Your friend wants to learn English.',
                    'solutions' => ['Take a course', 'Watch movies', 'Practice daily'],
                    'question'  => 'Which solution is best and why?',
                ],
            ])->assertStatus(200);

        // Trước khi xoá: có speaking question ở cả part 1 và 2
        $this->assertTrue(\App\Models\Question::where('exam_id', $examId)
            ->where('qSkill', 'speaking')->where('qPart', 2)->exists());

        // Xoá Part 2
        $delete = $this->withHeaders($this->authHeader())
            ->deleteJson("/api/teacher/exams/{$examId}/vstep/speaking/parts/2");
        $delete->assertStatus(200);
        $delete->assertJson(['status' => 'success']);

        // Sau khi xoá: không còn question part 2, part 1 vẫn còn
        $this->assertSame(0, \App\Models\Question::where('exam_id', $examId)
            ->where('qSkill', 'speaking')->where('qPart', 2)->count());
        $this->assertTrue(\App\Models\Question::where('exam_id', $examId)
            ->where('qSkill', 'speaking')->where('qPart', 1)->exists());
    }

    /** @test */
    public function delete_task_returns_404_when_exam_not_found()
    {
        $delete = $this->withHeaders($this->authHeader())
            ->deleteJson('/api/teacher/exams/999999/vstep/writing/tasks/2');
        $delete->assertStatus(404);
    }
}

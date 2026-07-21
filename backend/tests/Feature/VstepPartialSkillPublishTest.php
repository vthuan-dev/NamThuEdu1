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
}

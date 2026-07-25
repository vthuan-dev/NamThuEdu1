<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Exam;
use App\Models\Classes;
use App\Models\TestAssignment;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Regression: "Học sinh bấm vào làm đề nhưng không tìm thấy đề".
 *
 * Nguyên nhân: giao được cả đề CHƯA xuất bản. Đề đó vẫn hiện trong danh sách
 * bài của học viên (GET /student/tests không lọc eStatus), nhưng loader làm bài
 * chỉ nhận đề published → trả "Không tìm thấy đề thi".
 */
class AssignPublishedOnlyTest extends TestCase
{
    use RefreshDatabase;

    protected $teacher;
    protected $student;

    protected function setUp(): void
    {
        parent::setUp();
        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
        $this->student = User::factory()->create(['uRole' => 'student', 'age_group' => 'teens']);
    }

    private function makeExam(string $status): Exam
    {
        return Exam::create([
            'eTitle' => 'Đề THPT ' . $status,
            'eType' => 'THPT',
            'eSkill' => 'mixed',
            'eDuration_minutes' => 60,
            'eStatus' => $status,
            'ePurpose' => 'exam',
            'eTeacher_id' => $this->teacher->uId,
            'age_group' => 'teens',
            'thpt_config' => [
                'version' => '2.0',
                'level' => 'THPT',
                'total_duration_minutes' => 45,
                'scale_max' => 10,
                'sections' => [[
                    'id' => 's1', 'type' => 'mc_questions', 'variant' => 'grammar',
                    'title' => 'MC', 'instructions' => '', 'points_per_question' => 1,
                    'items' => [[
                        'question_number' => 1, 'prompt' => 'x', 'correct_id' => 'A',
                        'options' => [['id' => 'A', 'text' => 'a'], ['id' => 'B', 'text' => 'b']],
                    ]],
                ]],
            ],
        ]);
    }

    /** @test */
    public function teacher_cannot_assign_unpublished_exam()
    {
        $draft = $this->makeExam('draft');

        $res = $this->actingAs($this->teacher, 'sanctum')
            ->postJson("/api/teacher/exams/{$draft->eId}/assign", [
                'taTarget_type' => 'student',
                'taTarget_id' => $this->student->uId,
                'taDeadline' => now()->addDays(3)->format('Y-m-d H:i:s'),
            ]);

        $res->assertStatus(422);
        $this->assertStringContainsString('chưa được xuất bản', $res->json('message'));
        $this->assertDatabaseCount('test_assignments', 0);
    }

    /** @test */
    public function bulk_assign_also_rejects_unpublished_exam()
    {
        $draft = $this->makeExam('draft');

        $res = $this->actingAs($this->teacher, 'sanctum')
            ->postJson('/api/teacher/assignments/bulk', [
                'exam_id' => $draft->eId,
                'targets' => [['type' => 'student', 'id' => $this->student->uId]],
                'taDeadline' => now()->addDays(3)->format('Y-m-d H:i:s'),
            ]);

        $res->assertStatus(422);
        $this->assertDatabaseCount('test_assignments', 0);
    }

    /** @test */
    public function teacher_can_assign_published_exam()
    {
        $exam = $this->makeExam('published');

        $this->actingAs($this->teacher, 'sanctum')
            ->postJson("/api/teacher/exams/{$exam->eId}/assign", [
                'taTarget_type' => 'student',
                'taTarget_id' => $this->student->uId,
                'taDeadline' => now()->addDays(3)->format('Y-m-d H:i:s'),
            ])
            ->assertStatus(200);

        $this->assertDatabaseCount('test_assignments', 1);
    }

    /** @test */
    public function student_test_list_hides_exams_that_are_not_published()
    {
        // Giả lập dữ liệu cũ: assignment đã tồn tại nhưng đề bị hạ về draft.
        $exam = $this->makeExam('published');
        TestAssignment::create([
            'exam_id' => $exam->eId,
            'taTarget_type' => 'student',
            'taTarget_id' => $this->student->uId,
            'taDeadline' => now()->addDays(3),
            'taMax_attempt' => 1,
            'taCreated_at' => now(),
        ]);

        // Còn published → thấy trong danh sách
        $res = $this->actingAs($this->student, 'sanctum')->getJson('/api/student/tests');
        $res->assertStatus(200);
        $this->assertNotEmpty($this->flattenTests($res->json('data')));

        // Hạ về draft → biến khỏi danh sách (không để học viên bấm vào rồi lỗi)
        $exam->update(['eStatus' => 'draft']);
        $res2 = $this->actingAs($this->student, 'sanctum')->getJson('/api/student/tests');
        $res2->assertStatus(200);
        $this->assertEmpty($this->flattenTests($res2->json('data')));
    }

    /** @test */
    public function student_gets_clear_message_when_exam_not_published()
    {
        $exam = $this->makeExam('draft');

        $res = $this->actingAs($this->student, 'sanctum')
            ->getJson("/api/student/thpt-exams/{$exam->eId}");

        // 409 + thông báo rõ ràng thay vì 404 "không tìm thấy đề thi"
        $res->assertStatus(409);
        $this->assertStringContainsString('chưa được giáo viên xuất bản', $res->json('message'));
    }

    /** @test */
    public function student_exam_duration_comes_from_config_not_stale_column()
    {
        $exam = $this->makeExam('published');
        // Cột lệch với config (dữ liệu cũ): config = 45, cột = 60
        $exam->update(['eDuration_minutes' => 60]);

        $res = $this->actingAs($this->student, 'sanctum')
            ->getJson("/api/student/thpt-exams/{$exam->eId}");

        $res->assertStatus(200);
        $this->assertEquals(45, $res->json('data.eDuration_minutes'));

        $start = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/thpt-exams/{$exam->eId}/start", []);
        $start->assertStatus(200);
        $this->assertEquals(45, $start->json('data.duration_minutes'));
    }

    /** Dữ liệu /student/tests có thể là mảng phẳng hoặc nhóm theo trạng thái. */
    private function flattenTests($data): array
    {
        if (!is_array($data)) return [];
        if (array_key_exists(0, $data)) return $data;
        $out = [];
        foreach ($data as $group) {
            if (is_array($group)) $out = array_merge($out, $group);
        }
        return $out;
    }
}

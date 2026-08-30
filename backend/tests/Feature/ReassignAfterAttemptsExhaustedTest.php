<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Exam;
use App\Models\Submission;
use App\Models\TestAssignment;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Giao lại một đề mà học viên đã làm hết lượt.
 *
 * Tình huống: học viên làm xong đề, dùng hết lượt (1/1). Giáo viên muốn cho làm
 * lại nên giao lại chính đề đó. Câu hỏi: học viên có làm được nữa không, và
 * danh sách hiện ra thế nào?
 *
 * Pool lượt được đếm theo `assignment_id`, không theo `exam_id`. Nên bản giao
 * mới là một pool mới — đó là hành vi ĐÚNG và cũng là cách giáo viên "mở lại"
 * một đề. Bộ test này khoá hành vi đó, và ghi lại phần hiển thị đi kèm.
 */
class ReassignAfterAttemptsExhaustedTest extends TestCase
{
    use RefreshDatabase;

    protected User $teacher;
    protected User $student;
    protected Exam $exam;

    protected function setUp(): void
    {
        parent::setUp();
        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
        $this->student = User::factory()->create([
            'uRole' => 'student',
            'age_group' => 'teens',
        ]);
        $this->exam = Exam::create([
            'eTitle' => 'Đề tổng hợp Teens',
            'eType' => 'GENERAL',
            'eSkill' => 'mixed',
            'ePurpose' => 'exam',
            'eStatus' => 'published',
            'eTeacher_id' => $this->teacher->uId,
            'eDuration_minutes' => 60,
            'eIs_private' => false,
            'age_group' => 'teens',
        ]);
    }

    private function assign(int $maxAttempt = 1): TestAssignment
    {
        return TestAssignment::create([
            'exam_id' => $this->exam->eId,
            'taTarget_type' => 'student',
            'taTarget_id' => $this->student->uId,
            'taDeadline' => now()->addDays(3),
            'taMax_attempt' => $maxAttempt,
            'taCreated_at' => now(),
        ]);
    }

    /** Tiêu hết lượt của một assignment bằng cách tạo phiên đã nộp. */
    private function exhaust(TestAssignment $assignment): void
    {
        Submission::create([
            'user_id' => $this->student->uId,
            'exam_id' => $this->exam->eId,
            'assignment_id' => $assignment->taId,
            'sAttempt' => 1,
            'sStart_time' => now()->subHour(),
            'sSubmit_time' => now()->subMinutes(30),
            'sStatus' => 'graded',
            'sScore' => 75,
        ]);
    }

    /**
     * Chốt hành vi cốt lõi: pool lượt tính theo assignment, nên bản giao mới cho
     * học viên một lượt mới dù bản cũ đã cạn.
     *
     * @test
     */
    public function giao_lai_tao_pool_luot_moi(): void
    {
        $first = $this->assign(1);
        $this->exhaust($first);

        // Bản cũ đã hết lượt.
        $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/tests/{$first->taId}/start")
            ->assertStatus(403);

        $second = $this->assign(1);

        // Bản mới còn lượt → vào được. Endpoint trả 200 (không phải 201) và
        // nhánh tạo mới trả về submissionId; assert theo id để chắc là PHIÊN MỚI
        // chứ không phải nhánh resume của phiên cũ.
        $res = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/tests/{$second->taId}/start")
            ->assertStatus(200);

        $newId = $res->json('data.submissionId');
        $this->assertNotNull($newId);
        $this->assertSame(
            $second->taId,
            (int) Submission::findOrFail($newId)->assignment_id
        );
    }

    /**
     * Lượt đã dùng của bản cũ KHÔNG được cộng sang bản mới, và ngược lại.
     *
     * @test
     */
    public function luot_da_dung_khong_lan_giua_hai_ban_giao(): void
    {
        $first = $this->assign(1);
        $this->exhaust($first);
        $second = $this->assign(1);

        $res = $this->actingAs($this->student, 'sanctum')
            ->getJson('/api/student/tests')
            ->assertStatus(200);

        $groups = $res->json('data');
        $all = array_merge(
            $groups['pending'] ?? [],
            $groups['in_progress'] ?? [],
            $groups['completed'] ?? [],
        );

        $byAssignment = collect($all)->keyBy('assignment_id');

        $this->assertSame(1, $byAssignment[$first->taId]['attempts_used']);
        $this->assertSame(0, $byAssignment[$second->taId]['attempts_used']);
    }

    /**
     * HỆ QUẢ HIỂN THỊ: danh sách gom theo assignment, nên giao lại làm xuất hiện
     * HAI thẻ cùng tên đề — một "Đã xong / Hết lượt", một "Chưa làm".
     *
     * Test này ghi lại hành vi hiện tại để nếu sau này gộp thẻ thì có chỗ đối
     * chiếu, chứ không khẳng định đây là trải nghiệm mong muốn.
     *
     * @test
     */
    public function danh_sach_hien_hai_the_cung_ten_de(): void
    {
        $first = $this->assign(1);
        $this->exhaust($first);
        $this->assign(1);

        $res = $this->actingAs($this->student, 'sanctum')
            ->getJson('/api/student/tests')
            ->assertStatus(200);

        $groups = $res->json('data');

        $this->assertCount(1, $groups['completed'] ?? []);
        $this->assertCount(1, $groups['pending'] ?? []);

        $titles = collect(array_merge($groups['completed'], $groups['pending']))
            ->pluck('exam_title');
        $this->assertSame(['Đề tổng hợp Teens', 'Đề tổng hợp Teens'], $titles->all());
    }

    /**
     * Giao lại KHÔNG được xoá kết quả cũ — học viên và giáo viên vẫn phải xem
     * lại được bài đã làm ở lượt trước.
     *
     * @test
     */
    public function ket_qua_cu_van_con(): void
    {
        $first = $this->assign(1);
        $this->exhaust($first);
        $this->assign(1);

        $this->assertSame(
            1,
            Submission::where('user_id', $this->student->uId)
                ->where('assignment_id', $first->taId)
                ->count()
        );
    }
}

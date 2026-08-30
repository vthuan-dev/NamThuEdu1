<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Exam;
use App\Models\Classes;
use App\Models\TestAssignment;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Regression: "giao đề lúc được lúc không, học viên teens không thấy đề".
 *
 * Nguyên nhân: `bulkAssign` bỏ qua target có age_group lệch với đề bằng
 * `continue`, nhưng trước đây vẫn trả HTTP 201 + status "success" ngay cả khi
 * KHÔNG giao được cho ai. Phía giáo viên (`AssignModal`) chỉ bắt exception của
 * lời gọi HTTP, nên 201 = thành công → toast "Đã giao 1 đề cho 1 học viên" trong
 * khi DB không có dòng nào.
 *
 * Nối với lỗi age_group đã sửa trước đó: học viên bị tạo sai thành `adults` sẽ
 * lặng lẽ trượt mọi lần giao đề teens — đúng kiểu "lúc được lúc không".
 *
 * Sau khi sửa: không giao được cho ai → 422 kèm lý do; giao được một phần → vẫn
 * 201 nhưng `errors` liệt kê người bị bỏ qua để UI hiển thị.
 */
class BulkAssignSilentSkipTest extends TestCase
{
    use RefreshDatabase;

    protected $teacher;

    protected function setUp(): void
    {
        parent::setUp();
        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
    }

    private function makeExam(?string $ageGroup): Exam
    {
        return Exam::create([
            'eTitle' => 'Đề Teens',
            'eType' => 'GENERAL',
            'eSkill' => 'mixed',
            'eDuration_minutes' => 60,
            'eStatus' => 'published',
            'ePurpose' => 'exam',
            'eTeacher_id' => $this->teacher->uId,
            'age_group' => $ageGroup,
        ]);
    }

    private function assign(Exam $exam, array $targets)
    {
        return $this->actingAs($this->teacher, 'sanctum')
            ->postJson('/api/teacher/assignments/bulk', [
                'exam_id' => $exam->eId,
                'targets' => $targets,
                'taDeadline' => now()->addDays(7)->toDateTimeString(),
                'taMax_attempt' => 1,
            ]);
    }

    /**
     * ĐÂY LÀ LỖI CHÍNH.
     *
     * Học viên bị ghi sai age_group (`adults` trong khi là thiếu niên) → đề teens
     * bị bỏ qua. Phải báo lỗi, không được báo thành công.
     */
    public function test_age_group_lech_thi_tra_422_chu_khong_bao_thanh_cong()
    {
        $exam = $this->makeExam('teens');
        $student = User::factory()->create(['uRole' => 'student', 'age_group' => 'adults']);

        $res = $this->assign($exam, [['type' => 'student', 'id' => $student->uId]]);

        $res->assertStatus(422);
        $this->assertSame('error', $res->json('status'));
        $this->assertSame(0, TestAssignment::where('exam_id', $exam->eId)->count());

        // Thông điệp phải nói rõ lý do để giáo viên biết đường sửa.
        $this->assertStringContainsString('nhóm', $res->json('message'));
        $this->assertNotEmpty($res->json('data.errors'));
    }

    /** Cùng đề, học viên đúng nhóm → giao được. Đây là lần "lúc được". */
    public function test_age_group_khop_thi_giao_duoc()
    {
        $exam = $this->makeExam('teens');
        $student = User::factory()->create(['uRole' => 'student', 'age_group' => 'teens']);

        $res = $this->assign($exam, [['type' => 'student', 'id' => $student->uId]]);

        $res->assertStatus(201);
        $this->assertSame(1, $res->json('data.success_count'));
        $this->assertSame(1, TestAssignment::where('exam_id', $exam->eId)->count());
    }

    /**
     * Giao cho LỚP: assignment được tạo thật, nhưng học viên chỉ thấy đề nếu
     * `users.class_id` trỏ đúng lớp đó. GET /student/tests đọc theo class_id,
     * không đọc bảng class_enrollments.
     */
    public function test_giao_cho_lop_ma_hoc_vien_khong_co_class_id_thi_khong_thay_de()
    {
        $exam = $this->makeExam('teens');
        $class = Classes::create([
            'cName' => 'Teens A',
            'cTeacher_id' => $this->teacher->uId,
            'age_group' => 'teens',
        ]);

        // Học viên đúng nhóm tuổi nhưng class_id để trống.
        $student = User::factory()->create([
            'uRole' => 'student',
            'age_group' => 'teens',
            'class_id' => null,
        ]);

        $res = $this->assign($exam, [['type' => 'class', 'id' => $class->cId]]);

        // Giao thành công thật — không phải lỗi của bước giao.
        $res->assertStatus(201);
        $this->assertSame(1, $res->json('data.success_count'));

        // Nhưng danh sách của học viên vẫn trống.
        $list = $this->actingAs($student, 'sanctum')->getJson('/api/student/tests');
        $list->assertStatus(200);
        $this->assertCount(0, $list->json('data.pending'));
    }

    /** Cùng tình huống nhưng class_id đúng → thấy đề. */
    public function test_giao_cho_lop_va_hoc_vien_co_class_id_thi_thay_de()
    {
        $exam = $this->makeExam('teens');
        $class = Classes::create([
            'cName' => 'Teens A',
            'cTeacher_id' => $this->teacher->uId,
            'age_group' => 'teens',
        ]);
        $student = User::factory()->create([
            'uRole' => 'student',
            'age_group' => 'teens',
            'class_id' => $class->cId,
        ]);

        $this->assign($exam, [['type' => 'class', 'id' => $class->cId]]);

        $list = $this->actingAs($student, 'sanctum')->getJson('/api/student/tests');
        $this->assertCount(1, $list->json('data.pending'));
    }

    /**
     * Đề `age_group = 'all'` bỏ qua mọi kiểm tra nhóm tuổi → giao cho ai cũng
     * được. Đây là lý do một số đề "luôn giao được" còn đề khác thì không.
     */
    public function test_de_age_group_all_giao_duoc_cho_moi_nhom()
    {
        $exam = $this->makeExam('all');
        $adult = User::factory()->create(['uRole' => 'student', 'age_group' => 'adults']);
        $teen = User::factory()->create(['uRole' => 'student', 'age_group' => 'teens']);

        $res = $this->assign($exam, [
            ['type' => 'student', 'id' => $adult->uId],
            ['type' => 'student', 'id' => $teen->uId],
        ]);

        $this->assertSame(2, $res->json('data.success_count'));
    }

    /**
     * Giao nhiều học viên một lượt: người lệch nhóm bị bỏ, người khớp vẫn được
     * giao. Vẫn là 201 (có assignment thật được tạo), nhưng `errors` phải liệt kê
     * người bị bỏ qua để UI cảnh báo — không được âm thầm.
     */
    public function test_giao_mot_phan_van_201_nhung_co_errors_de_ui_canh_bao()
    {
        $exam = $this->makeExam('teens');
        $ok = User::factory()->create(['uRole' => 'student', 'age_group' => 'teens']);
        $skipped = User::factory()->create(['uRole' => 'student', 'age_group' => 'adults']);

        $res = $this->assign($exam, [
            ['type' => 'student', 'id' => $ok->uId],
            ['type' => 'student', 'id' => $skipped->uId],
        ]);

        $res->assertStatus(201);
        $this->assertSame(1, $res->json('data.success_count'));
        $this->assertCount(1, $res->json('data.errors'));
        $this->assertSame(1, TestAssignment::where('exam_id', $exam->eId)->count());
    }

    /**
     * Đề chưa xuất bản trả 422 → phía giáo viên bắt được exception và báo lỗi.
     * Test này làm mốc đối chiếu: đường thất bại "ồn ào" thì UI hiển thị đúng,
     * chỉ đường thất bại "im lặng" (201 + success_count=0) là bị che.
     */
    public function test_de_chua_xuat_ban_tra_422_nen_ui_bat_duoc()
    {
        $exam = $this->makeExam('teens');
        $exam->update(['eStatus' => 'draft']);
        $student = User::factory()->create(['uRole' => 'student', 'age_group' => 'teens']);

        $this->assign($exam, [['type' => 'student', 'id' => $student->uId]])
            ->assertStatus(422);
    }
}

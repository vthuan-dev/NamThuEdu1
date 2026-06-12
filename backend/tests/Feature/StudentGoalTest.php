<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ClassModel;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Mục tiêu từng học viên + phân tích AI (nhánh không có dữ liệu → không gọi Groq).
 */
class StudentGoalTest extends TestCase
{
    use RefreshDatabase;

    protected User $teacher;
    protected User $otherTeacher;
    protected User $student;
    protected ClassModel $class;

    protected function setUp(): void
    {
        parent::setUp();
        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
        $this->otherTeacher = User::factory()->create(['uRole' => 'teacher']);
        $this->class = ClassModel::create([
            'cName' => 'Lớp Goal', 'cTeacher_id' => $this->teacher->uId,
            'age_group' => 'adults', 'max_students' => 30, 'cStatus' => 'active',
        ]);
        $this->student = User::factory()->create([
            'uRole' => 'student', 'age_group' => 'adults', 'class_id' => $this->class->cId,
        ]);
    }

    /** @test */
    public function gv_dat_va_lay_muc_tieu_cho_hoc_vien_cua_minh(): void
    {
        $this->actingAs($this->teacher, 'sanctum')
            ->putJson("/api/teacher/students/{$this->student->uId}/goal", [
                'target_level' => 'B2',
                'target_skill' => 'overall',
                'exam_type'    => 'VSTEP',
            ])->assertStatus(200)->assertJsonPath('data.target_level', 'B2');

        $this->assertDatabaseHas('student_goals', [
            'student_id' => $this->student->uId, 'target_level' => 'B2',
        ]);

        $this->actingAs($this->teacher, 'sanctum')
            ->getJson("/api/teacher/students/{$this->student->uId}/goal")
            ->assertStatus(200)
            ->assertJsonPath('data.goal.target_level', 'B2');
    }

    /** @test */
    public function gv_khac_khong_quan_ly_hoc_vien_thi_bi_chan(): void
    {
        $this->actingAs($this->otherTeacher, 'sanctum')
            ->putJson("/api/teacher/students/{$this->student->uId}/goal", [
                'target_level' => 'B2',
            ])->assertStatus(404);
    }

    /** @test */
    public function phan_tich_khi_chua_co_bai_thi_tra_ve_has_data_false(): void
    {
        // Đặt mục tiêu trước.
        $this->actingAs($this->teacher, 'sanctum')
            ->putJson("/api/teacher/students/{$this->student->uId}/goal", ['target_level' => 'B2']);

        // Phân tích: học viên chưa có submission → fallback, không gọi Groq.
        $this->actingAs($this->teacher, 'sanctum')
            ->postJson("/api/teacher/students/{$this->student->uId}/goal/analyze")
            ->assertStatus(200)
            ->assertJsonPath('data.analysis.has_data', false);
    }

    /** @test */
    public function phan_tich_khi_chua_dat_muc_tieu_tra_400(): void
    {
        $this->actingAs($this->teacher, 'sanctum')
            ->postJson("/api/teacher/students/{$this->student->uId}/goal/analyze")
            ->assertStatus(400);
    }
}

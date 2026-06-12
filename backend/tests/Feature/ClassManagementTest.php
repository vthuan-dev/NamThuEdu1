<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ClassModel;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Teacher Class Management — CRUD, ownership, enroll (độ tuổi + sĩ số), xóa lớp.
 */
class ClassManagementTest extends TestCase
{
    use RefreshDatabase;

    protected User $teacher;
    protected User $other;

    protected function setUp(): void
    {
        parent::setUp();
        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
        $this->other   = User::factory()->create(['uRole' => 'teacher']);
    }

    private function makeClass(User $owner, array $attrs = []): ClassModel
    {
        return ClassModel::create(array_merge([
            'cName'        => 'Lớp Test',
            'cTeacher_id'  => $owner->uId,
            'age_group'    => 'teens',
            'max_students' => 30,
            'cStatus'      => 'active',
        ], $attrs));
    }

    /** @test */
    public function teacher_chi_thay_lop_cua_minh(): void
    {
        $this->makeClass($this->teacher, ['cName' => 'Cua toi']);
        $this->makeClass($this->other, ['cName' => 'Cua nguoi khac']);

        $res = $this->actingAs($this->teacher, 'sanctum')->getJson('/api/teacher/classes');
        $res->assertStatus(200);
        $names = collect($res->json('data'))->pluck('cName')->all();
        $this->assertContains('Cua toi', $names);
        $this->assertNotContains('Cua nguoi khac', $names);
    }

    /** @test */
    public function truy_cap_lop_nguoi_khac_tra_404(): void
    {
        $class = $this->makeClass($this->other);
        $this->actingAs($this->teacher, 'sanctum')
            ->getJson("/api/teacher/classes/{$class->cId}")
            ->assertStatus(404);
    }

    /** @test */
    public function tao_lop_thanh_cong(): void
    {
        $res = $this->actingAs($this->teacher, 'sanctum')->postJson('/api/teacher/classes', [
            'name'         => 'Lớp Adults VSTEP',
            'age_group'    => 'adults',
            'max_students' => 20,
        ]);
        $res->assertStatus(201)->assertJsonPath('data.cName', 'Lớp Adults VSTEP');
    }

    /** @test */
    public function doi_age_group_khi_co_hoc_vien_khac_tuoi_bi_chan_409(): void
    {
        $class = $this->makeClass($this->teacher, ['age_group' => 'teens']);
        User::factory()->create([
            'uRole' => 'student', 'age_group' => 'teens', 'class_id' => $class->cId,
        ]);

        $this->actingAs($this->teacher, 'sanctum')
            ->putJson("/api/teacher/classes/{$class->cId}", ['age_group' => 'adults'])
            ->assertStatus(409);
    }

    /** @test */
    public function enroll_chan_hoc_vien_khac_do_tuoi(): void
    {
        $class = $this->makeClass($this->teacher, ['age_group' => 'teens']);
        $student = User::factory()->create(['uRole' => 'student', 'age_group' => 'kids', 'class_id' => null]);

        $res = $this->actingAs($this->teacher, 'sanctum')
            ->postJson("/api/teacher/classes/{$class->cId}/enroll", [
                'student_ids' => [$student->uId],
            ]);
        $res->assertStatus(200)->assertJsonPath('data.enrolled_count', 0);
        $this->assertNull($student->fresh()->class_id);
    }

    /** @test */
    public function enroll_set_class_id_va_chan_qua_si_so(): void
    {
        $class = $this->makeClass($this->teacher, ['age_group' => 'teens', 'max_students' => 1]);
        $s1 = User::factory()->create(['uRole' => 'student', 'age_group' => 'teens', 'class_id' => null]);
        $s2 = User::factory()->create(['uRole' => 'student', 'age_group' => 'teens', 'class_id' => null]);

        $res = $this->actingAs($this->teacher, 'sanctum')
            ->postJson("/api/teacher/classes/{$class->cId}/enroll", [
                'student_ids' => [$s1->uId, $s2->uId],
            ]);
        $res->assertStatus(200)->assertJsonPath('data.enrolled_count', 1);
        $this->assertEquals($class->cId, $s1->fresh()->class_id);
        $this->assertNull($s2->fresh()->class_id);
    }

    /** @test */
    public function xoa_lop_con_hoc_vien_chan_tru_khi_force(): void
    {
        $class = $this->makeClass($this->teacher, ['age_group' => 'teens']);
        $student = User::factory()->create([
            'uRole' => 'student', 'age_group' => 'teens', 'class_id' => $class->cId,
        ]);

        // Không force → 409
        $this->actingAs($this->teacher, 'sanctum')
            ->deleteJson("/api/teacher/classes/{$class->cId}")
            ->assertStatus(409);

        // force=true → xóa, học viên được gỡ class_id
        $this->actingAs($this->teacher, 'sanctum')
            ->deleteJson("/api/teacher/classes/{$class->cId}?force=true")
            ->assertStatus(200);
        $this->assertNull($student->fresh()->class_id);
    }
}

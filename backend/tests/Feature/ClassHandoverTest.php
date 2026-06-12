<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ClassModel;
use App\Models\ClassHandoverRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;

class ClassHandoverTest extends TestCase
{
    use RefreshDatabase;

    protected User $teacher;
    protected User $receiving;
    protected User $admin;
    protected ClassModel $class;

    protected function setUp(): void
    {
        parent::setUp();
        $this->teacher   = User::factory()->create(['uRole' => 'teacher']);
        $this->receiving = User::factory()->create(['uRole' => 'teacher']);
        $this->admin     = User::factory()->create(['uRole' => 'admin']);
        $this->class = ClassModel::create([
            'cName' => 'Lớp Bàn Giao', 'cTeacher_id' => $this->teacher->uId,
            'age_group' => 'teens', 'max_students' => 30, 'cStatus' => 'active',
        ]);
    }

    /** @test */
    public function giao_vien_gui_yeu_cau_ban_giao(): void
    {
        $res = $this->actingAs($this->teacher, 'sanctum')
            ->postJson("/api/teacher/classes/{$this->class->cId}/handover-request", [
                'reason' => 'Bận việc gia đình',
            ]);
        $res->assertStatus(201);
        $this->assertDatabaseHas('class_handover_requests', [
            'class_id' => $this->class->cId, 'status' => 'pending',
        ]);
    }

    /** @test */
    public function khong_tao_duoc_2_pending_cung_lop(): void
    {
        ClassHandoverRequest::create([
            'class_id' => $this->class->cId, 'from_teacher_id' => $this->teacher->uId, 'status' => 'pending',
        ]);
        $this->actingAs($this->teacher, 'sanctum')
            ->postJson("/api/teacher/classes/{$this->class->cId}/handover-request", [])
            ->assertStatus(409);
    }

    /** @test */
    public function admin_duyet_doi_chu_lop_va_giu_du_lieu(): void
    {
        $student = User::factory()->create([
            'uRole' => 'student', 'age_group' => 'teens', 'class_id' => $this->class->cId,
        ]);
        $req = ClassHandoverRequest::create([
            'class_id' => $this->class->cId, 'from_teacher_id' => $this->teacher->uId, 'status' => 'pending',
        ]);

        $res = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/handover-requests/{$req->id}/approve", [
                'receiving_teacher_id' => $this->receiving->uId,
            ]);
        $res->assertStatus(200);

        $this->assertEquals($this->receiving->uId, $this->class->fresh()->cTeacher_id);
        $this->assertEquals('approved', $req->fresh()->status);
        // Học viên giữ nguyên trong lớp
        $this->assertEquals($this->class->cId, $student->fresh()->class_id);
    }

    /** @test */
    public function admin_khong_duyet_cho_chinh_giao_vien_gui(): void
    {
        $req = ClassHandoverRequest::create([
            'class_id' => $this->class->cId, 'from_teacher_id' => $this->teacher->uId, 'status' => 'pending',
        ]);
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/handover-requests/{$req->id}/approve", [
                'receiving_teacher_id' => $this->teacher->uId,
            ])
            ->assertStatus(400);
    }

    /** @test */
    public function khong_xu_ly_request_da_resolved(): void
    {
        $req = ClassHandoverRequest::create([
            'class_id' => $this->class->cId, 'from_teacher_id' => $this->teacher->uId, 'status' => 'approved',
        ]);
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/handover-requests/{$req->id}/reject", [])
            ->assertStatus(409);
    }
}

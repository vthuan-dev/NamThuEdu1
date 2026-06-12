<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ClassModel;
use App\Models\ClassCoTeacher;
use App\Models\ClassHandoverRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Co-teaching: mời cùng quản lý, chuyển quyền chủ lớp (no admin),
 * và xóa lớp cần admin duyệt.
 */
class ClassCoTeachingTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $colleague;
    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner     = User::factory()->create(['uRole' => 'teacher']);
        $this->colleague = User::factory()->create(['uRole' => 'teacher']);
        $this->admin     = User::factory()->create(['uRole' => 'admin']);
    }

    private function makeClass(User $owner): ClassModel
    {
        return ClassModel::create([
            'cName'        => 'Lớp Test',
            'cTeacher_id'  => $owner->uId,
            'age_group'    => 'adults',
            'max_students' => 30,
            'cStatus'      => 'active',
        ]);
    }

    /** @test */
    public function moi_cung_quan_ly_va_chap_nhan_thi_co_teacher_truy_cap_duoc_lop(): void
    {
        $class = $this->makeClass($this->owner);

        // Trước khi mời: đồng nghiệp không xem được lớp.
        $this->actingAs($this->colleague, 'sanctum')
            ->getJson("/api/teacher/classes/{$class->cId}")
            ->assertStatus(404);

        // Chủ lớp mời cùng quản lý.
        $this->actingAs($this->owner, 'sanctum')
            ->postJson("/api/teacher/classes/{$class->cId}/co-teachers", [
                'teacher_id' => $this->colleague->uId,
                'type'       => 'co_teach',
            ])->assertStatus(201);

        // Đồng nghiệp thấy lời mời.
        $invId = ClassCoTeacher::where('class_id', $class->cId)
            ->where('teacher_id', $this->colleague->uId)->value('id');

        $this->actingAs($this->colleague, 'sanctum')
            ->getJson('/api/teacher/co-teacher-invitations')
            ->assertStatus(200)
            ->assertJsonFragment(['id' => $invId]);

        // Chấp nhận.
        $this->actingAs($this->colleague, 'sanctum')
            ->postJson("/api/teacher/co-teacher-invitations/{$invId}/respond", ['action' => 'accept'])
            ->assertStatus(200);

        // Sau khi chấp nhận: co-teacher xem/quản lý được lớp.
        $this->actingAs($this->colleague, 'sanctum')
            ->getJson("/api/teacher/classes/{$class->cId}")
            ->assertStatus(200);

        // Lớp xuất hiện trong danh sách của co-teacher với is_owner=false.
        $list = $this->actingAs($this->colleague, 'sanctum')->getJson('/api/teacher/classes')->json('data');
        $row = collect($list)->firstWhere('cId', $class->cId);
        $this->assertNotNull($row);
        $this->assertFalse($row['is_owner']);
    }

    /** @test */
    public function chuyen_quyen_chu_lop_khi_chap_nhan_thi_doi_chu_va_gv_cu_roi(): void
    {
        $class = $this->makeClass($this->owner);

        $this->actingAs($this->owner, 'sanctum')
            ->postJson("/api/teacher/classes/{$class->cId}/co-teachers", [
                'teacher_id' => $this->colleague->uId,
                'type'       => 'transfer',
            ])->assertStatus(201);

        $invId = ClassCoTeacher::where('class_id', $class->cId)
            ->where('teacher_id', $this->colleague->uId)->value('id');

        $this->actingAs($this->colleague, 'sanctum')
            ->postJson("/api/teacher/co-teacher-invitations/{$invId}/respond", ['action' => 'accept'])
            ->assertStatus(200);

        // Quyền chủ lớp đã chuyển.
        $this->assertEquals($this->colleague->uId, $class->fresh()->cTeacher_id);

        // GV mới là chủ lớp; GV cũ không còn truy cập.
        $this->actingAs($this->colleague, 'sanctum')
            ->getJson("/api/teacher/classes/{$class->cId}")
            ->assertStatus(200)
            ->assertJsonPath('data.is_owner', true);

        $this->actingAs($this->owner, 'sanctum')
            ->getJson("/api/teacher/classes/{$class->cId}")
            ->assertStatus(404);
    }

    /** @test */
    public function chi_chu_lop_moi_duoc_moi_co_teacher(): void
    {
        $class = $this->makeClass($this->owner);

        // Đồng nghiệp (không phải chủ) cố mời người khác → 404.
        $third = User::factory()->create(['uRole' => 'teacher']);
        $this->actingAs($this->colleague, 'sanctum')
            ->postJson("/api/teacher/classes/{$class->cId}/co-teachers", [
                'teacher_id' => $third->uId,
            ])->assertStatus(404);
    }

    /** @test */
    public function admin_duyet_yeu_cau_xoa_lop_thi_lop_bi_xoa(): void
    {
        $class = $this->makeClass($this->owner);

        // GV gửi yêu cầu xóa.
        $this->actingAs($this->owner, 'sanctum')
            ->deleteJson("/api/teacher/classes/{$class->cId}")
            ->assertStatus(201);

        $reqId = ClassHandoverRequest::where('class_id', $class->cId)
            ->where('request_type', 'deletion')->where('status', 'pending')->value('id');
        $this->assertNotNull($reqId);

        // Admin duyệt → lớp bị xóa.
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/handover-requests/{$reqId}/approve")
            ->assertStatus(200);

        // GV cũ không còn truy cập được lớp; lớp đã bị xóa khỏi DB.
        $this->actingAs($this->owner, 'sanctum')
            ->getJson("/api/teacher/classes/{$class->cId}")
            ->assertStatus(404);

        $this->assertDatabaseMissing('classes', ['cId' => $class->cId]);
    }
}

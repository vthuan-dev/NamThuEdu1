<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ClassModel;
use App\Models\ClassAnnouncement;
use Illuminate\Foundation\Testing\RefreshDatabase;

class ClassAnnouncementTest extends TestCase
{
    use RefreshDatabase;

    protected User $teacher;
    protected User $other;
    protected ClassModel $class;

    protected function setUp(): void
    {
        parent::setUp();
        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
        $this->other   = User::factory()->create(['uRole' => 'teacher']);
        $this->class = ClassModel::create([
            'cName' => 'Lớp Test', 'cTeacher_id' => $this->teacher->uId,
            'age_group' => 'teens', 'max_students' => 30, 'cStatus' => 'active',
        ]);
    }

    /** @test */
    public function owner_dang_thong_bao_thanh_cong(): void
    {
        $res = $this->actingAs($this->teacher, 'sanctum')
            ->postJson("/api/teacher/classes/{$this->class->cId}/announcements", [
                'title' => 'Nghỉ lễ', 'content' => 'Lớp nghỉ thứ 2', 'priority' => 'important',
            ]);
        $res->assertStatus(201)->assertJsonPath('data.title', 'Nghỉ lễ');
        $this->assertDatabaseHas('class_announcements', ['title' => 'Nghỉ lễ', 'priority' => 'important']);
    }

    /** @test */
    public function khong_phai_owner_khong_dang_duoc(): void
    {
        $this->actingAs($this->other, 'sanctum')
            ->postJson("/api/teacher/classes/{$this->class->cId}/announcements", [
                'title' => 'X', 'content' => 'Y',
            ])
            ->assertStatus(404);
    }

    /** @test */
    public function validate_thieu_truong_tra_400(): void
    {
        $this->actingAs($this->teacher, 'sanctum')
            ->postJson("/api/teacher/classes/{$this->class->cId}/announcements", [
                'title' => '',
            ])
            ->assertStatus(400);
    }

    /** @test */
    public function xoa_thong_bao(): void
    {
        $ann = ClassAnnouncement::create([
            'class_id' => $this->class->cId, 'teacher_id' => $this->teacher->uId,
            'title' => 'A', 'content' => 'B', 'priority' => 'normal',
        ]);
        $this->actingAs($this->teacher, 'sanctum')
            ->deleteJson("/api/teacher/classes/{$this->class->cId}/announcements/{$ann->id}")
            ->assertStatus(200);
        $this->assertSoftDeleted('class_announcements', ['id' => $ann->id]);
    }
}

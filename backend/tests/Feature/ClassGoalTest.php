<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ClassModel;
use App\Models\ClassGoal;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Carbon\Carbon;

class ClassGoalTest extends TestCase
{
    use RefreshDatabase;

    protected User $teacher;
    protected ClassModel $class;

    protected function setUp(): void
    {
        parent::setUp();
        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
        $this->class = ClassModel::create([
            'cName' => 'Lớp VSTEP', 'cTeacher_id' => $this->teacher->uId,
            'age_group' => 'adults', 'max_students' => 30, 'cStatus' => 'active',
        ]);
    }

    /** @test */
    public function tao_muc_tieu_tuong_lai_thanh_cong(): void
    {
        $res = $this->actingAs($this->teacher, 'sanctum')
            ->postJson("/api/teacher/classes/{$this->class->cId}/goals", [
                'goal_title'  => 'Thi VSTEP B2',
                'target_date' => Carbon::today()->addDays(30)->toDateString(),
                'target_level' => 'B2',
            ]);
        $res->assertStatus(201)->assertJsonPath('data.goal_title', 'Thi VSTEP B2');
    }

    /** @test */
    public function muc_tieu_qua_khu_bi_chan_400(): void
    {
        $this->actingAs($this->teacher, 'sanctum')
            ->postJson("/api/teacher/classes/{$this->class->cId}/goals", [
                'goal_title'  => 'Quá khứ',
                'target_date' => Carbon::today()->subDay()->toDateString(),
            ])
            ->assertStatus(400);
    }

    /** @test */
    public function next_class_goal_tra_muc_tieu_gan_nhat(): void
    {
        $student = User::factory()->create([
            'uRole' => 'student', 'age_group' => 'adults', 'class_id' => $this->class->cId,
        ]);
        ClassGoal::create([
            'class_id' => $this->class->cId, 'teacher_id' => $this->teacher->uId,
            'goal_title' => 'Gần', 'target_date' => Carbon::today()->addDays(10), 'status' => 'active',
        ]);
        ClassGoal::create([
            'class_id' => $this->class->cId, 'teacher_id' => $this->teacher->uId,
            'goal_title' => 'Xa', 'target_date' => Carbon::today()->addDays(40), 'status' => 'active',
        ]);

        $res = $this->actingAs($student, 'sanctum')->getJson('/api/student/class-goals/next');
        $res->assertStatus(200)
            ->assertJsonPath('data.goal_title', 'Gần')
            ->assertJsonPath('data.days_remaining', 10);
    }
}

<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ClassModel;
use App\Models\ClassGoal;
use App\Models\ClassGoalReminderLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Carbon\Carbon;

class DailyGoalRemindersTest extends TestCase
{
    use RefreshDatabase;

    protected User $teacher;
    protected ClassModel $class;

    protected function setUp(): void
    {
        parent::setUp();
        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
        $this->class = ClassModel::create([
            'cName' => 'Lớp', 'cTeacher_id' => $this->teacher->uId,
            'age_group' => 'adults', 'max_students' => 30, 'cStatus' => 'active',
        ]);
        User::factory()->create([
            'uRole' => 'student', 'age_group' => 'adults', 'class_id' => $this->class->cId,
        ]);
    }

    /** @test */
    public function chay_lai_cung_ngay_khong_nhan_doi_log(): void
    {
        ClassGoal::create([
            'class_id' => $this->class->cId, 'teacher_id' => $this->teacher->uId,
            'goal_title' => 'Thi', 'target_date' => Carbon::today()->addDays(15), 'status' => 'active',
        ]);

        $this->artisan('goals:send-daily-reminders')->assertExitCode(0);
        $this->artisan('goals:send-daily-reminders')->assertExitCode(0);

        $this->assertEquals(1, ClassGoalReminderLog::count());
    }

    /** @test */
    public function muc_tieu_qua_han_thanh_completed(): void
    {
        $goal = ClassGoal::create([
            'class_id' => $this->class->cId, 'teacher_id' => $this->teacher->uId,
            'goal_title' => 'Đã qua', 'target_date' => Carbon::today()->subDay(), 'status' => 'active',
        ]);

        $this->artisan('goals:send-daily-reminders')->assertExitCode(0);

        $this->assertEquals('completed', $goal->fresh()->status);
        $this->assertEquals(0, ClassGoalReminderLog::where('class_goal_id', $goal->id)->count());
    }
}

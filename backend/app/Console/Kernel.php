<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     *
     * @param  \Illuminate\Console\Scheduling\Schedule  $schedule
     * @return void
     */
    protected function schedule(Schedule $schedule)
    {
        // Tự động xử lý bài thi hết thời gian / "câm" quá ngưỡng — mỗi phút
        // (delegates to TestRecoveryService → ExamAutoSubmitService cho cả 2 nhánh
        //  timeout và inactive)
        $schedule->command('tests:process-expired')
                 ->everyMinute()
                 ->withoutOverlapping()
                 ->runInBackground();

        // Gửi thông báo "trước giờ" cho bài tập đã hẹn lịch — mỗi phút
        $schedule->command('assignments:send-scheduled-reminders')
                 ->everyMinute()
                 ->withoutOverlapping()
                 ->runInBackground();

        // Gửi thông báo động lực hằng ngày theo mục tiêu của lớp — 07:00 (giờ VN)
        $schedule->command('goals:send-daily-reminders')
                 ->dailyAt('07:00')
                 ->timezone('Asia/Ho_Chi_Minh')
                 ->withoutOverlapping()
                 ->runInBackground();

                 
        // Monitor WebSocket connections mỗi phút
        $schedule->call(function () {
            \App\Services\TestWebSocketService::checkInactiveSessions();
        })->everyMinute()->name('websocket-monitor');
        
        // Cleanup WebSocket statistics mỗi ngày
        $schedule->command('websockets:clean')
                 ->daily()
                 ->at('02:00');
        
        // Xóa vĩnh viễn học viên đã xóa quá 24 giờ - chạy mỗi giờ
        $schedule->command('students:cleanup-deleted')
                 ->hourly()
                 ->withoutOverlapping()
                 ->runInBackground();

        // Tự động xóa vĩnh viễn tài khoản đã yêu cầu xóa sau 3 ngày
        $schedule->call(function () {
            \App\Models\User::whereNotNull('scheduled_delete_at')
                ->where('scheduled_delete_at', '<=', now())
                ->forceDelete();
        })->daily()->name('cleanup-scheduled-deletions');
    }

    /**
     * Register the commands for the application.
     *
     * @return void
     */
    protected function commands()
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
        
        // Register test commands
        // if (app()->environment(['local', 'testing'])) {
        //     $this->commands([
        //         Commands\TestWebSocketLoad::class,
        //     ]);
        // }
    }
}

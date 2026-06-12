<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\ClassGoal;
use App\Models\ClassGoalReminderLog;
use App\Models\User;
use App\Services\PushNotificationService;
use Carbon\Carbon;

/**
 * Gửi thông báo động lực hằng ngày cho học viên theo mục tiêu của lớp.
 *
 * Với mỗi Class_Goal đang active và chưa quá hạn, mỗi ngày gửi 1 lần cho
 * mỗi học viên trong lớp một push đếm ngược tới target_date. Idempotency ở
 * mức (class_goal_id, ngày) qua bảng class_goal_reminder_logs để không gửi
 * trùng khi job chạy lại trong cùng ngày. Mục tiêu đã qua hạn → completed.
 */
class SendDailyGoalReminders extends Command
{
    protected $signature = 'goals:send-daily-reminders';

    protected $description = 'Gửi thông báo động lực hằng ngày theo mục tiêu của lớp';

    public function handle()
    {
        $today = Carbon::today();
        $pushService = new PushNotificationService();

        // 1) Mục tiêu đã qua hạn → đánh dấu completed (R6.6).
        ClassGoal::where('status', 'active')
            ->whereDate('target_date', '<=', $today)
            ->update(['status' => 'completed']);

        // 2) Nhắc cho mục tiêu active còn hạn.
        $goals = ClassGoal::where('status', 'active')
            ->whereDate('target_date', '>', $today)
            ->get();

        $processed = 0;
        $remindersGenerated = 0;

        foreach ($goals as $goal) {
            // Idempotency: đã gửi hôm nay cho goal này thì bỏ qua (R6.8, R13.3).
            $already = ClassGoalReminderLog::where('class_goal_id', $goal->id)
                ->whereDate('reminded_on', $today)
                ->exists();
            if ($already) {
                continue;
            }

            $students = User::where('class_id', $goal->class_id)
                ->where('uRole', 'student')
                ->whereNull('uDeleted_at')
                ->get();

            $processed++;

            if ($students->isEmpty()) {
                ClassGoalReminderLog::create([
                    'class_goal_id'     => $goal->id,
                    'reminded_on'       => $today,
                    'students_notified' => 0,
                ]);
                continue;
            }

            $daysLeft = (int) $today->diffInDays(Carbon::parse($goal->target_date), false);
            $message = "Còn {$daysLeft} ngày đến {$goal->goal_title}. Hôm nay luyện tập một chút nhé! 💪";

            try {
                $pushService->sendToUsers(
                    $students->pluck('uId')->toArray(),
                    '🎯 Mục tiêu sắp tới',
                    $message,
                    ['url' => '/hoc-vien']
                );
            } catch (\Exception $e) {
                \Log::warning('Daily goal reminder push failed (goal ' . $goal->id . '): ' . $e->getMessage());
            }

            ClassGoalReminderLog::create([
                'class_goal_id'     => $goal->id,
                'reminded_on'       => $today,
                'students_notified' => $students->count(),
            ]);

            $remindersGenerated += $students->count();
        }

        $this->info("Đã xử lý {$processed} mục tiêu, tạo {$remindersGenerated} lượt nhắc.");
        return 0;
    }
}

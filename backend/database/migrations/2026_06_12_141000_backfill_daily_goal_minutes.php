<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Seed mặc định: mỗi học viên có mục tiêu 30 phút/ngày (giáo viên chỉnh sau).
 * - Đặt DEFAULT 30 cho cột để học viên tạo mới tự có 30.
 * - Backfill các học viên hiện tại đang NULL về 30.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'daily_goal_minutes')) {
            return;
        }

        // Đặt default 30 (MySQL). Bọc try/catch để an toàn trên driver khác.
        try {
            DB::statement('ALTER TABLE `users` ALTER COLUMN `daily_goal_minutes` SET DEFAULT 30');
        } catch (\Throwable $e) {
            // Bỏ qua nếu driver không hỗ trợ — backfill bên dưới vẫn đảm bảo dữ liệu.
        }

        // Backfill học viên đang NULL -> 30
        DB::table('users')
            ->where('uRole', 'student')
            ->whereNull('daily_goal_minutes')
            ->update(['daily_goal_minutes' => 30]);
    }

    public function down(): void
    {
        if (!Schema::hasColumn('users', 'daily_goal_minutes')) {
            return;
        }

        try {
            DB::statement('ALTER TABLE `users` ALTER COLUMN `daily_goal_minutes` DROP DEFAULT');
        } catch (\Throwable $e) {
            // ignore
        }
    }
};

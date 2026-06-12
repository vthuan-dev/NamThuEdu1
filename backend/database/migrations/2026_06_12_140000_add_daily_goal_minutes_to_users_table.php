<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mục tiêu học mỗi ngày (phút) do giáo viên đặt cho từng học viên.
 * Hiển thị ở vòng "Mục tiêu hôm nay" trên trang chủ học viên (mọi role).
 * Mặc định null → frontend/backend fallback về 30 phút.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'daily_goal_minutes')) {
                $table->unsignedSmallInteger('daily_goal_minutes')->nullable()->after('age_group');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'daily_goal_minutes')) {
                $table->dropColumn('daily_goal_minutes');
            }
        });
    }
};

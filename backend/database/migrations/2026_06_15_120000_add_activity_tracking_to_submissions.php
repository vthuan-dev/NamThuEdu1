<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * Auto-save & Auto-submit (Phase 1 — Backend foundation)
 *
 * Thêm 2 cột vào bảng `submissions`:
 *  - last_activity_at  : mốc thời gian hoạt động cuối (heartbeat / draft / answer)
 *  - auto_submit_reason: lý do auto-submit ('timeout' | 'inactive' | 'unload' | null)
 *
 * Đồng thời chính thức hoá ENUM `sStatus` để bao gồm tất cả trạng thái đang dùng
 * trong code (auto_submitted / grading_subjective / grading_failed / partially_graded).
 */
class AddActivityTrackingToSubmissions extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('submissions', function (Blueprint $table) {
            if (!Schema::hasColumn('submissions', 'last_activity_at')) {
                $table->timestamp('last_activity_at')->nullable()->after('sStart_time');
            }
            if (!Schema::hasColumn('submissions', 'auto_submit_reason')) {
                $table->string('auto_submit_reason', 32)->nullable()->after('sStatus');
            }
        });

        // Add indexes (idempotent — try/catch to skip if đã tồn tại từ rerun)
        try {
            Schema::table('submissions', function (Blueprint $table) {
                $table->index('last_activity_at', 'submissions_last_activity_at_index');
            });
        } catch (\Throwable $e) {
            // index already exists — ignore
        }

        try {
            Schema::table('submissions', function (Blueprint $table) {
                $table->index(['sStatus', 'last_activity_at'], 'submissions_status_activity_index');
            });
        } catch (\Throwable $e) {
            // index already exists — ignore
        }

        // Mở rộng ENUM sStatus để chính thức bao gồm các giá trị code đã dùng
        DB::statement("ALTER TABLE submissions MODIFY COLUMN sStatus ENUM(
            'draft',
            'in_progress',
            'submitted',
            'graded',
            'partially_graded',
            'auto_submitted',
            'grading_subjective',
            'grading_failed'
        ) NOT NULL DEFAULT 'in_progress'");

        // Backfill last_activity_at = sStart_time cho các bài đang in_progress
        // để cron không hiểu nhầm các bài cũ là "câm > 15 phút" ngay khi deploy.
        DB::statement("
            UPDATE submissions
            SET last_activity_at = sStart_time
            WHERE last_activity_at IS NULL
              AND sStart_time IS NOT NULL
        ");
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('submissions', function (Blueprint $table) {
            try {
                $table->dropIndex('submissions_status_activity_index');
            } catch (\Throwable $e) {
                // ignore
            }
            try {
                $table->dropIndex('submissions_last_activity_at_index');
            } catch (\Throwable $e) {
                // ignore
            }
            if (Schema::hasColumn('submissions', 'auto_submit_reason')) {
                $table->dropColumn('auto_submit_reason');
            }
            if (Schema::hasColumn('submissions', 'last_activity_at')) {
                $table->dropColumn('last_activity_at');
            }
        });

        // Không thu hẹp ENUM lại để tránh phá data đang chạy.
    }
}

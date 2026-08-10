<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                // Modify the column to be nullable using raw SQL for compatibility
                DB::statement("ALTER TABLE users MODIFY COLUMN age_group ENUM('kids', 'teens', 'adults') NULL DEFAULT 'teens'");
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                // Ensure no NULL values exist before changing back to NOT NULL
                DB::statement("UPDATE users SET age_group = 'teens' WHERE age_group IS NULL");
                DB::statement("ALTER TABLE users MODIFY COLUMN age_group ENUM('kids', 'teens', 'adults') NOT NULL DEFAULT 'teens'");
            });
        }
    }
};

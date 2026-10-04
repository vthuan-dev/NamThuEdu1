<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Convert `questions.qType` from restrictive ENUM to VARCHAR(50)
     * to support multiple_choice_group, image_completion, and future question types
     * without triggering SQLSTATE[01000] Warning: 1265 Data truncated for column 'qType'.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE questions MODIFY COLUMN qType VARCHAR(50) DEFAULT 'multiple_choice'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Safe to leave as VARCHAR(50)
    }
};

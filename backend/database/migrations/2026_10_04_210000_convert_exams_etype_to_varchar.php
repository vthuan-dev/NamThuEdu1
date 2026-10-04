<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Convert exams.eType from ENUM to VARCHAR(50)
 *
 * Problem: Migration 2026_06_08_100000_add_thpt_to_exams_etype_enum.php
 * accidentally reset eType to ENUM('VSTEP','IELTS','GENERAL','THPT'),
 * losing Cambridge YL types (STARTERS, MOVERS, FLYERS, KET, PET, FCE …)
 * that had been added by 2026_03_18_120400_update_exams_type_enum.php.
 *
 * Solution: Drop the ENUM constraint entirely and use VARCHAR(50).
 * This mirrors what was done for questions.qType.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            ALTER TABLE exams
            MODIFY COLUMN eType VARCHAR(50) NOT NULL DEFAULT 'GENERAL'
        ");

        echo "exams.eType converted from ENUM to VARCHAR(50)\n";
    }

    public function down(): void
    {
        $invalid = DB::table('exams')
            ->whereNotIn('eType', ['VSTEP', 'IELTS', 'GENERAL', 'THPT'])
            ->count();

        if ($invalid > 0) {
            throw new \RuntimeException(
                "Cannot rollback: {$invalid} exam(s) have eType values " .
                "outside ENUM('VSTEP','IELTS','GENERAL','THPT'). " .
                "Delete or migrate them first."
            );
        }

        DB::statement("
            ALTER TABLE exams
            MODIFY COLUMN eType ENUM('VSTEP','IELTS','GENERAL','THPT') NOT NULL DEFAULT 'GENERAL'
        ");
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AddScopeFieldsToExamsTable extends Migration
{
    public function up()
    {
        Schema::table('exams', function (Blueprint $table) {
            if (!Schema::hasColumn('exams', 'eScope')) {
                $table->string('eScope', 16)->default('skill')->after('ePurpose');
            }
            if (!Schema::hasColumn('exams', 'ePart_type')) {
                $table->string('ePart_type', 64)->nullable()->after('eScope');
            }
            if (!Schema::hasColumn('exams', 'ePart_number')) {
                $table->unsignedSmallInteger('ePart_number')->nullable()->after('ePart_type');
            }
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement("
                UPDATE exams
                SET eScope = CASE
                    WHEN JSON_UNQUOTE(JSON_EXTRACT(kids_exam_config, '$.scope')) IN ('full', 'skill', 'part')
                        THEN JSON_UNQUOTE(JSON_EXTRACT(kids_exam_config, '$.scope'))
                    WHEN LOWER(COALESCE(eSkill, '')) = 'mixed' THEN 'full'
                    ELSE 'skill'
                END
            ");

            DB::statement("
                UPDATE exams
                SET ePart_number = CAST(JSON_UNQUOTE(JSON_EXTRACT(kids_exam_config, '$.scope_part')) AS UNSIGNED)
                WHERE eScope = 'part'
                  AND ePart_number IS NULL
                  AND JSON_EXTRACT(kids_exam_config, '$.scope_part') IS NOT NULL
            ");
            return;
        }

        DB::table('exams')->whereRaw("LOWER(COALESCE(eSkill, '')) = 'mixed'")->update(['eScope' => 'full']);
    }

    public function down()
    {
        Schema::table('exams', function (Blueprint $table) {
            if (Schema::hasColumn('exams', 'ePart_number')) {
                $table->dropColumn('ePart_number');
            }
            if (Schema::hasColumn('exams', 'ePart_type')) {
                $table->dropColumn('ePart_type');
            }
            if (Schema::hasColumn('exams', 'eScope')) {
                $table->dropColumn('eScope');
            }
        });
    }
}

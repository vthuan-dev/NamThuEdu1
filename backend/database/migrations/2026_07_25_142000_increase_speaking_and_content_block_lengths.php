<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class IncreaseSpeakingAndContentBlockLengths extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        if (Schema::hasTable('content_blocks')) {
            Schema::table('content_blocks', function (Blueprint $table) {
                $table->longText('content')->nullable()->change();
            });
        }

        if (Schema::hasTable('questions')) {
            Schema::table('questions', function (Blueprint $table) {
                $table->longText('qExplanation')->nullable()->change();
            });
        }
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        if (Schema::hasTable('content_blocks')) {
            Schema::table('content_blocks', function (Blueprint $table) {
                $table->text('content')->nullable()->change();
            });
        }

        if (Schema::hasTable('questions')) {
            Schema::table('questions', function (Blueprint $table) {
                $table->text('qExplanation')->nullable()->change();
            });
        }
    }
}

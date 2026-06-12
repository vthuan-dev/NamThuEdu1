<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateStudentGoalAnalysesTable extends Migration
{
    public function up()
    {
        Schema::create('student_goal_analyses', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('student_id');
            $table->unsignedBigInteger('goal_id')->nullable();
            $table->string('target_level', 50)->nullable();        // snapshot mục tiêu tại thời điểm phân tích
            $table->unsignedTinyInteger('overall_progress_percent')->nullable();
            $table->string('current_level_estimate', 50)->nullable();
            $table->boolean('on_track')->nullable();
            $table->json('analysis')->nullable();                   // toàn bộ kết quả AI
            $table->json('performance_snapshot')->nullable();       // dữ liệu điểm tại thời điểm đó
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('student_id')->references('uId')->on('users')->onDelete('cascade');
            $table->index(['student_id', 'created_at']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('student_goal_analyses');
    }
}

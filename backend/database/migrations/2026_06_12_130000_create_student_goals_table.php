<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateStudentGoalsTable extends Migration
{
    public function up()
    {
        Schema::create('student_goals', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('student_id');
            $table->unsignedBigInteger('teacher_id');
            $table->string('target_level', 50);              // VD: B2, IELTS 6.5, VSTEP B2
            $table->string('target_skill', 30)->nullable();  // overall|listening|reading|writing|speaking
            $table->string('exam_type', 30)->nullable();     // VSTEP|IELTS|THPT|GENERAL (khung tham chiếu)
            $table->date('target_date')->nullable();
            $table->text('note')->nullable();
            $table->enum('status', ['active', 'achieved', 'cancelled'])->default('active');
            $table->json('ai_analysis')->nullable();         // cache kết quả phân tích AI
            $table->timestamp('ai_analyzed_at')->nullable();
            $table->timestamps();

            $table->foreign('student_id')->references('uId')->on('users')->onDelete('cascade');
            $table->foreign('teacher_id')->references('uId')->on('users')->onDelete('cascade');
            $table->unique('student_id'); // mỗi học viên một mục tiêu (upsert)
        });
    }

    public function down()
    {
        Schema::dropIfExists('student_goals');
    }
}

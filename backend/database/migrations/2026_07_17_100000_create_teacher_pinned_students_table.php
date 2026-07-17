<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateTeacherPinnedStudentsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * Ghim học viên theo từng giáo viên — dùng để nổi học viên lên đầu
     * danh sách chấm điểm (đồng bộ mọi thiết bị).
     *
     * @return void
     */
    public function up()
    {
        Schema::create('teacher_pinned_students', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('teacher_id');
            $table->unsignedBigInteger('student_id');
            $table->timestamps();

            $table->unique(['teacher_id', 'student_id'], 'teacher_student_pin_unique');
            $table->index('teacher_id');
            $table->index('student_id');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('teacher_pinned_students');
    }
}

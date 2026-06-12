<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Lịch thi / lịch trình ôn luyện do giáo viên đặt cho từng học viên.
     * Mỗi học viên có thể có nhiều lịch (vd: thi VSTEP tháng sau, thi thử tuần này).
     */
    public function up(): void
    {
        Schema::create('student_exam_schedules', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('student_id');
            $table->unsignedBigInteger('teacher_id')->nullable();

            $table->string('title', 200);                 // VD: "Thi VSTEP B2"
            $table->string('exam_type', 50)->nullable();   // vstep | ielts | thpt | other
            $table->date('exam_date');                     // Ngày thi
            $table->time('exam_time')->nullable();         // Giờ thi cụ thể (tùy chọn)
            $table->string('location', 255)->nullable();   // Địa điểm thi (tùy chọn)
            $table->text('note')->nullable();              // Ghi chú / lời nhắn ôn luyện

            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent();

            $table->foreign('student_id')->references('uId')->on('users')->onDelete('cascade');
            $table->foreign('teacher_id')->references('uId')->on('users')->onDelete('set null');

            $table->index(['student_id', 'exam_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_exam_schedules');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateClassCoTeachersTable extends Migration
{
    public function up()
    {
        Schema::create('class_co_teachers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('class_id');
            $table->unsignedBigInteger('inviter_id');   // chủ lớp gửi lời mời
            $table->unsignedBigInteger('teacher_id');   // giáo viên được mời cùng quản lý
            $table->enum('status', ['pending', 'accepted', 'declined', 'revoked'])->default('pending');
            $table->string('message', 500)->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent();

            $table->foreign('class_id')->references('cId')->on('classes')->onDelete('cascade');
            $table->foreign('inviter_id')->references('uId')->on('users')->onDelete('cascade');
            $table->foreign('teacher_id')->references('uId')->on('users')->onDelete('cascade');

            // Mỗi (lớp, giáo viên) chỉ một bản ghi.
            $table->unique(['class_id', 'teacher_id']);
            $table->index(['teacher_id', 'status']);
            $table->index(['class_id', 'status']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('class_co_teachers');
    }
}

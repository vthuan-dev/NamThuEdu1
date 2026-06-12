<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateClassAnnouncementsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('class_announcements', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('class_id');
            $table->unsignedBigInteger('teacher_id');
            $table->string('title', 150);
            $table->text('content');
            $table->enum('priority', ['normal', 'important', 'urgent'])->default('normal');
            $table->boolean('is_pinned')->default(false);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent();
            $table->softDeletes();

            $table->foreign('class_id')->references('cId')->on('classes')->onDelete('cascade');
            $table->foreign('teacher_id')->references('uId')->on('users')->onDelete('cascade');

            $table->index('class_id');
            $table->index(['class_id', 'is_pinned', 'created_at'], 'class_ann_pin_created_idx');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('class_announcements');
    }
}

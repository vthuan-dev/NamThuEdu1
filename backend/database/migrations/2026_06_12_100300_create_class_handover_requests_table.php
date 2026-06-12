<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateClassHandoverRequestsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('class_handover_requests', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('class_id');
            $table->unsignedBigInteger('from_teacher_id');
            $table->unsignedBigInteger('receiving_teacher_id')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected', 'cancelled'])->default('pending');
            $table->string('reason', 500)->nullable();
            $table->string('admin_note', 500)->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent();

            $table->foreign('class_id')->references('cId')->on('classes')->onDelete('cascade');
            $table->foreign('from_teacher_id')->references('uId')->on('users')->onDelete('cascade');
            $table->foreign('receiving_teacher_id')->references('uId')->on('users')->onDelete('set null');

            $table->index(['status', 'class_id']);
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('class_handover_requests');
    }
}

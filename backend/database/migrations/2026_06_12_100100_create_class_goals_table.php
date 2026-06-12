<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateClassGoalsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('class_goals', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('class_id');
            $table->unsignedBigInteger('teacher_id');
            $table->string('goal_title', 150);
            $table->date('target_date');
            $table->string('target_level', 10)->nullable();
            $table->text('description')->nullable();
            $table->enum('status', ['active', 'completed', 'cancelled'])->default('active');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent();

            $table->foreign('class_id')->references('cId')->on('classes')->onDelete('cascade');
            $table->foreign('teacher_id')->references('uId')->on('users')->onDelete('cascade');

            $table->index(['class_id', 'target_date']);
            $table->index(['status', 'target_date']);
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('class_goals');
    }
}

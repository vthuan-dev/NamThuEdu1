<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateClassGoalReminderLogsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('class_goal_reminder_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('class_goal_id');
            $table->date('reminded_on');
            $table->unsignedInteger('students_notified')->default(0);
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('class_goal_id')->references('id')->on('class_goals')->onDelete('cascade');
            $table->unique(['class_goal_id', 'reminded_on'], 'class_goal_reminder_unique');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('class_goal_reminder_logs');
    }
}

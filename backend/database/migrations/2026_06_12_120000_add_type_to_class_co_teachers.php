<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddTypeToClassCoTeachers extends Migration
{
    public function up()
    {
        Schema::table('class_co_teachers', function (Blueprint $table) {
            // co_teach: cùng quản lý; transfer: chuyển quyền chủ lớp (GV cũ rời).
            $table->enum('type', ['co_teach', 'transfer'])->default('co_teach')->after('teacher_id');
        });
    }

    public function down()
    {
        Schema::table('class_co_teachers', function (Blueprint $table) {
            $table->dropColumn('type');
        });
    }
}

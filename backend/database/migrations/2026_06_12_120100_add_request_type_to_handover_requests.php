<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddRequestTypeToHandoverRequests extends Migration
{
    public function up()
    {
        Schema::table('class_handover_requests', function (Blueprint $table) {
            // handover: bàn giao cho GV khác; deletion: yêu cầu xóa lớp (admin duyệt).
            $table->enum('request_type', ['handover', 'deletion'])->default('handover')->after('class_id');
        });
    }

    public function down()
    {
        Schema::table('class_handover_requests', function (Blueprint $table) {
            $table->dropColumn('request_type');
        });
    }
}

<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use App\Models\Exam;

$teachers = User::where('uRole', 'teacher')->get();
echo "=== DANH SÁCH GIÁO VIÊN ===\n";
foreach ($teachers as $t) {
    $examCount = Exam::where('eTeacher_id', $t->uId)->count();
    echo "uId={$t->uId} | {$t->uName} | {$t->uEmail} | {$examCount} đề\n";
}

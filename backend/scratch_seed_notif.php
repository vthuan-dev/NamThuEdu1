<?php

/**
 * Scratch seeder: tạo vài submission "vừa nộp" (trong 2h gần nhất)
 * để test bell notification của giáo viên.
 *
 * Chạy:  php scratch_seed_notif.php
 * Xoá data test:  php scratch_seed_notif.php --clean
 */

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Submission;
use App\Models\Exam;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

$clean = in_array('--clean', $argv);

// Marker để nhận diện data test (idempotency key prefix)
$MARKER = 'NOTIF_SEED_';

if ($clean) {
    $deleted = Submission::where('submit_idempotency_key', 'like', $MARKER . '%')->delete();
    echo "🧹 Đã xoá {$deleted} submission test.\n";
    exit(0);
}

// ── 0. Xác định giáo viên mục tiêu ──────────────────────────────────────
// Cho phép truyền teacher uId qua tham số: php scratch_seed_notif.php 25
// Mặc định 25 = "Giáo viên Demo" (teacher@namthuedu.vn)
$teacherId = 25;
foreach ($argv as $arg) {
    if (is_numeric($arg)) { $teacherId = (int) $arg; break; }
}

// ── 1. Tìm giáo viên mục tiêu ───────────────────────────────────────────
$teacher = User::where('uRole', 'teacher')->where('uId', $teacherId)->first();
if (!$teacher) {
    echo "❌ Không tìm thấy giáo viên uId={$teacherId}. Dùng giáo viên đầu tiên...\n";
    $teacher = User::where('uRole', 'teacher')->first();
}
if (!$teacher) {
    echo "❌ Không tìm thấy giáo viên nào.\n";
    exit(1);
}
echo "👨‍🏫 Giáo viên: {$teacher->uName} (uId={$teacher->uId})\n";

// Đề của giáo viên này
$exams = Exam::where('eTeacher_id', $teacher->uId)->get();
if ($exams->isEmpty()) {
    echo "❌ Giáo viên chưa có đề thi nào.\n";
    exit(1);
}
echo "📚 Có {$exams->count()} đề thi.\n";

// ── 2. exam_id PHẢI thuộc về giáo viên này (điều kiện lọc của bell) ──────
$targetExam = $exams->first();
$assignmentExamId = $targetExam->eId;

// ── 3. assignment_id — chỉ cần 1 taId hợp lệ để thoả foreign key ────────
// Ưu tiên assignment gắn đúng đề của GV; nếu không có thì lấy bất kỳ.
$assignmentRow = DB::table('test_assignments')
    ->whereIn('exam_id', $exams->pluck('eId')->all())
    ->first();
if (!$assignmentRow) {
    $assignmentRow = DB::table('test_assignments')->first();
}
if (!$assignmentRow) {
    echo "❌ Không có assignment nào trong hệ thống (cần ít nhất 1 taId hợp lệ).\n";
    exit(1);
}
$assignmentId = $assignmentRow->taId ?? null;
echo "📝 Dùng assignment_id={$assignmentId}, exam_id={$assignmentExamId} (đề: {$targetExam->eTitle})\n";

// ── 3. Tìm học viên để gán submission ───────────────────────────────────
$students = User::where('uRole', 'student')->limit(4)->get();
if ($students->isEmpty()) {
    echo "❌ Không tìm thấy học viên nào.\n";
    exit(1);
}
echo "👥 Có {$students->count()} học viên để seed.\n\n";

// ── 4. Tạo submissions ──────────────────────────────────────────────────
// Mix: vài bài nộp thường + vài bài auto-submit (timeout / inactive)
$scenarios = [
    ['reason' => null,        'ago' => 2,  'status' => 'submitted'],
    ['reason' => 'timeout',   'ago' => 8,  'status' => 'grading_subjective'],
    ['reason' => null,        'ago' => 15, 'status' => 'submitted'],
    ['reason' => 'inactive',  'ago' => 25, 'status' => 'submitted'],
];

$created = 0;
foreach ($students as $i => $student) {
    $sc = $scenarios[$i % count($scenarios)];
    $submitTime = Carbon::now()->subMinutes($sc['ago']);
    $startTime  = $submitTime->copy()->subMinutes(40);

    $sub = new Submission();
    $sub->user_id                = $student->uId;
    $sub->exam_id                = $assignmentExamId;
    $sub->assignment_id          = $assignmentId;
    $sub->sAttempt               = 1;
    $sub->sStart_time            = $startTime;
    $sub->sSubmit_time           = $submitTime;
    $sub->submit_idempotency_key = $MARKER . uniqid();
    $sub->sStatus                = $sc['status'];
    $sub->sTime_taken            = 40 * 60;
    $sub->last_activity_at       = $submitTime;
    $sub->auto_submit_reason     = $sc['reason'];
    $sub->submission_payload     = ['seeded' => true];
    $sub->save();

    $label = $sc['reason'] ? "AUTO ({$sc['reason']})" : "thường";
    echo "  ✅ {$student->uName} — {$label}, {$sc['ago']} phút trước [status={$sc['status']}]\n";
    $created++;
}

echo "\n🎉 Đã tạo {$created} submission test. Mở bell của giáo viên '{$teacher->uName}' để xem.\n";
echo "   (Xoá sau khi test:  php scratch_seed_notif.php --clean)\n";

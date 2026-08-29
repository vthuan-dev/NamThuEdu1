#!/bin/bash
# CHỈ ĐỌC — không sửa, không xoá gì trên production.
#
# Quét đề THPT đã publish có `correct_id` trỏ vào phương án text rỗng. Validation ở
# 1265cec chỉ chặn lúc publish TỪ ĐÓ VỀ SAU; đề publish trước đó vẫn chấm sai và
# không học viên nào có thể đúng những câu đó.
#
# Script gọi lại CHÍNH validateThptConfig() đã deploy trên VPS (qua Reflection) nên
# kết quả không lệch khỏi gate lúc publish, và ngoại lệ đề dạng ảnh (tất cả phương
# án đều rỗng) tự động được tôn trọng.
#
# Chạy:  bash vps_scan_thpt_empty_answers.sh
set -euo pipefail
cd /var/www/namthuedu/backend

php <<'PHP'
<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Http\Controllers\ThptExamController;
use App\Models\Exam;
use App\Models\Submission;

const MARKER = 'trỏ vào phương án chưa có nội dung';

$method = new ReflectionMethod(ThptExamController::class, 'validateThptConfig');
$method->setAccessible(true);
$controller = new ThptExamController();

// Kiểm tra bộ phát hiện trước khi tin kết quả: nếu câu chữ trong validateThptConfig()
// đã đổi thì MARKER không khớp nữa và scan sẽ báo sạch một cách sai lệch.
$probe = $method->invoke($controller, ['sections' => [[
    'title' => 'probe', 'type' => 'mc_questions',
    'items' => [[
        'question_number' => 1,
        'options' => [
            ['id' => 'A', 'text' => 'x'],
            ['id' => 'B', 'text' => ''],
        ],
        'correct_id' => 'B',
    ]],
]]]);
$probeOk = false;
foreach ($probe as $e) { if (strpos($e, MARKER) !== false) { $probeOk = true; break; } }
if (!$probeOk) {
    echo "❌ SELF-CHECK FAIL: validateThptConfig() không còn sinh message khớp MARKER.\n";
    echo "   Kết quả scan KHÔNG đáng tin. Cập nhật MARKER rồi chạy lại.\n";
    exit(1);
}
echo "✔ Self-check bộ phát hiện: OK\n\n";

$exams = Exam::query()
    ->where('eType', 'THPT')
    ->whereIn('eStatus', ['published', 'pending'])
    ->whereNotNull('thpt_config')
    ->with('teacher:uId,uName')
    ->orderBy('eId')
    ->get(['eId', 'eTitle', 'eStatus', 'eTeacher_id', 'thpt_config']);

echo "🔍 CHỈ ĐỌC — quét {$exams->count()} đề THPT (published + pending)\n\n";

$counts = Submission::query()
    ->whereIn('exam_id', $exams->pluck('eId'))
    ->selectRaw('exam_id, COUNT(*) as total')
    ->groupBy('exam_id')
    ->pluck('total', 'exam_id');

$hitExams = 0; $hitQuestions = 0; $hitSubmissions = 0; $otherExams = [];

foreach ($exams as $exam) {
    $errors = (array) $method->invoke($controller, (array) $exam->thpt_config);
    if (empty($errors)) continue;

    $empty = []; $other = [];
    foreach ($errors as $e) {
        if (strpos($e, MARKER) !== false) { $empty[] = $e; } else { $other[] = $e; }
    }

    $subs = (int) ($counts[$exam->eId] ?? 0);
    $teacher = optional($exam->teacher)->uName ?: '(không rõ)';

    if (!empty($empty)) {
        $hitExams++;
        $hitQuestions += count($empty);
        $hitSubmissions += $subs;
        echo "⚠ #{$exam->eId} [{$exam->eStatus}] {$exam->eTitle}\n";
        echo "   GV: {$teacher} | {$subs} bài đã làm | " . count($empty) . " câu lỗi\n";
        foreach ($empty as $e) echo "   - {$e}\n";
        echo "\n";
    } elseif (!empty($other)) {
        $otherExams[] = "#{$exam->eId} [{$exam->eStatus}] {$exam->eTitle} ({$subs} bài): {$other[0]}";
    }
}

echo str_repeat('=', 70) . "\n";
if ($hitExams === 0) {
    echo "✅ KHÔNG có đề nào có đáp án trỏ vào phương án rỗng.\n";
} else {
    echo "⚠ {$hitExams} đề / {$hitQuestions} câu chấm sai — {$hitSubmissions} bài đã làm bị ảnh hưởng.\n";
}

if (!empty($otherExams)) {
    echo "\nĐề có lỗi validation KHÁC (" . count($otherExams) . " đề, cùng hậu quả nếu là 'chưa chọn đáp án đúng'):\n";
    foreach ($otherExams as $line) echo "  - {$line}\n";
}
PHP

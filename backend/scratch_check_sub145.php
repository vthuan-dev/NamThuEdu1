<?php
// Kiểm tra dữ liệu submission dùng để chấm điểm (listen_colour_write)
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Submission;
use App\Models\SubmissionAnswer;
use App\Models\Question;

$subId = (int)($argv[1] ?? 145);

echo "🔍 Submission ID: {$subId}\n";
echo str_repeat("=", 70) . "\n";

$sub = Submission::find($subId);
if (!$sub) {
    echo "❌ Không thấy submission {$subId}\n";
    exit(1);
}

$examId = $sub->exam_id ?? $sub->sExam_id ?? null;
echo "Exam ID: {$examId}\n";

// Lấy đáp án học sinh + câu hỏi qua quan hệ
$answers = SubmissionAnswer::where('submission_id', $subId)->get();
echo "Tổng đáp án: " . $answers->count() . "\n\n";

foreach ($answers as $a) {
    $q = Question::find($a->question_id);
    if (!$q) continue;
    $cfg = $q->kids_task_config; // đã cast array
    $taskType = is_array($cfg) ? ($cfg['task_type'] ?? '') : '';

    echo str_repeat("-", 70) . "\n";
    echo "qId: {$q->qId}  task_type: {$taskType}\n";
    echo "answer_text: " . ($a->saAnswer_text ?? '(null)')
       . "  isCorrect=" . var_export($a->saIs_correct, true)
       . "  points=" . ($a->saPoints_awarded ?? '?') . "\n";

    if ($taskType !== 'listen_colour_write' && $taskType !== 'listen_colour') {
        echo "(bỏ qua, không phải nghe & tô màu)\n";
        continue;
    }

    $td = is_array($cfg) ? ($cfg['task_data'] ?? $cfg) : [];
    echo "mainImageUrl: " . ($td['mainImageUrl'] ?? $td['imageUrl'] ?? $td['image_url'] ?? 'KHÔNG CÓ') . "\n";
    echo "mainAudioUrl: " . ($td['mainAudioUrl'] ?? $td['audioUrl'] ?? 'KHÔNG CÓ') . "\n";
    $inst = $td['instructions'] ?? [];
    if (is_array($inst)) {
        echo "instructions: " . count($inst) . " items\n";
        foreach ($inst as $i => $it) {
            $hs = isset($it['hotspot']) ? json_encode($it['hotspot']) : 'KHÔNG CÓ hotspot';
            echo "  #{$i} obj=" . ($it['objectName'] ?? '?')
               . " colour=" . ($it['colour'] ?? '-')
               . " write=" . ($it['write_text'] ?? $it['writeText'] ?? '-')
               . " hotspot={$hs}\n";
        }
    }
    echo "\nFULL kids_task_config:\n";
    echo json_encode($cfg, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
}

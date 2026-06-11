<?php
require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Exam;
use App\Models\Question;
use App\Models\TestAssignment;
use App\Models\Submission;

// Assignment 20 → exam?
$asg = TestAssignment::find(20);
echo "Assignment 20: " . ($asg ? "exam_id={$asg->exam_id}, target={$asg->taTarget_type}:{$asg->taTarget_id}" : "NULL") . PHP_EOL;

$sub = Submission::find(201);
echo "Submission 201: " . ($sub ? "exam_id={$sub->exam_id}, assignment_id={$sub->assignment_id}, status={$sub->sStatus}" : "NULL") . PHP_EOL;

$examId = $asg ? $asg->exam_id : ($sub ? $sub->exam_id : 114);
echo "=== Exam $examId questions (first 3) ===" . PHP_EOL;
$qs = Question::where('exam_id', $examId)->orderBy('qOrder')->orderBy('qId')->take(3)->get();
foreach ($qs as $q) {
    echo "qId={$q->qId} | qType={$q->qType} | qContent=" . mb_substr(strip_tags($q->qContent ?? ''), 0, 40) . PHP_EOL;
    $cfg = $q->kids_task_config;
    if (is_array($cfg)) {
        echo "  kids_task_config keys: " . implode(',', array_keys($cfg)) . PHP_EOL;
        echo "  task_type=" . ($cfg['task_type'] ?? 'NULL') . PHP_EOL;
        echo "  has task_data: " . (isset($cfg['task_data']) ? 'YES (keys: ' . implode(',', array_keys((array)$cfg['task_data'])) . ')' : 'NO') . PHP_EOL;
    } else {
        echo "  kids_task_config: " . var_export($cfg, true) . PHP_EOL;
    }
    echo "  qMedia_url=" . ($q->qMedia_url ?? 'NULL') . PHP_EOL;
}

// Exam meta
$exam = Exam::find($examId);
echo "=== Exam meta ===" . PHP_EOL;
echo "eType={$exam->eType} | eSkill={$exam->eSkill} | age_group={$exam->age_group} | kids_exam_type=" . ($exam->kids_exam_type ?? 'NULL') . PHP_EOL;

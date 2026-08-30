#!/bin/bash
set -euo pipefail
cd /var/www/namthuedu/backend

php <<'PHP'
<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\Submission;
use App\Models\TestAssignment;
use App\Models\Exam;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;

echo "===== 1) Simulate StudentTestController::start for ta=28 user=5 =====\n";
$user = User::find(5);
$assignment = TestAssignment::with('exam')->find(28);
echo "user={$user->uId} {$user->uName} age={$user->age_group}\n";
echo "assignment ta={$assignment->taId} exam={$assignment->exam_id} max={$assignment->taMax_attempt}\n";

// access check like start()
$hasAccess = ($assignment->taTarget_type === 'student' && (int)$assignment->taTarget_id === (int)$user->uId)
  || ($assignment->taTarget_type === 'class' && (int)$assignment->taTarget_id === (int)$user->class_id);
echo "hasAccess=" . ($hasAccess ? 'yes' : 'no') . " class={$user->class_id}\n";

$existing = Submission::where('user_id', $user->uId)
    ->where('assignment_id', 28)
    ->where('sStatus', 'in_progress')
    ->first();
echo "in_progress on ta28: " . ($existing ? "sId={$existing->sId}" : "none") . "\n";

$attemptsUsed = Submission::where('user_id', $user->uId)
    ->where('assignment_id', 28)
    ->count();
echo "attemptsUsed(ta28)={$attemptsUsed} max={$assignment->taMax_attempt}\n";
echo "would_block_start=" . ($attemptsUsed >= $assignment->taMax_attempt ? 'YES' : 'NO') . "\n";

echo "\n===== 2) Simulate index() payload for user=5 pending/completed =====\n";
$classIds = $user->class_id ? [$user->class_id] : [];
$assignments = TestAssignment::with(['exam' => function ($q) { $q->withCount('questions'); }])
    ->where(function ($query) use ($user, $classIds) {
        $query->where(function ($q) use ($user) {
            $q->where('taTarget_type', 'student')->where('taTarget_id', $user->uId);
        })->orWhere(function ($q) use ($classIds) {
            $q->where('taTarget_type', 'class')->whereIn('taTarget_id', $classIds);
        });
    })
    ->orderBy('taCreated_at', 'desc')
    ->get();

$assignmentIds = $assignments->pluck('taId')->all();
$submissionsByAssignment = Submission::where('user_id', $user->uId)
    ->whereIn('assignment_id', $assignmentIds)
    ->orderBy('sStart_time', 'desc')
    ->get()
    ->groupBy('assignment_id');

foreach ($assignments as $a) {
    if (!$a->exam) continue;
    $subs = $submissionsByAssignment->get($a->taId, collect());
    $attemptsUsed = $subs->count();
    $inProgressSub = $subs->firstWhere('sStatus', 'in_progress');
    $finishedSub = $subs->first(function ($s) {
        return in_array($s->sStatus, [
            'submitted', 'graded', 'auto_submitted',
            'grading_subjective', 'partially_graded', 'ai_graded',
        ], true);
    });
    if ($inProgressSub) $status = 'in_progress';
    elseif ($finishedSub) $status = 'completed';
    else $status = 'pending';
    $canStart = $attemptsUsed < (int)$a->taMax_attempt;
    echo sprintf(
        "ta=%d exam=%d status=%s used=%d/%d canStart=%s title=%s\n",
        $a->taId, $a->exam_id, $status, $attemptsUsed, $a->taMax_attempt,
        $canStart ? 'YES' : 'NO', mb_substr($a->exam->eTitle ?? '', 0, 40)
    );
}

echo "\n===== 3) Adults start-direct style for exam 37 =====\n";
// resolve newest active assignment for user 5 exam 37
$aid = TestAssignment::where('exam_id', 37)
    ->where(function ($q) use ($user, $classIds) {
        $q->where(function ($qq) use ($user) {
            $qq->where('taTarget_type', 'student')->where('taTarget_id', $user->uId);
        })->orWhere(function ($qq) use ($classIds) {
            if (empty($classIds)) { $qq->whereRaw('1=0'); return; }
            $qq->where('taTarget_type', 'class')->whereIn('taTarget_id', $classIds);
        });
    })
    ->where(function ($q) {
        $q->whereNull('taDeadline')->orWhere('taDeadline', '>=', now());
    })
    ->orderByRaw("CASE WHEN taTarget_type = 'student' THEN 0 ELSE 1 END")
    ->orderByDesc('taId')
    ->first();
echo "resolved active assignment: " . ($aid ? "ta={$aid->taId} max={$aid->taMax_attempt}" : "null") . "\n";
if ($aid) {
    $used = Submission::where('user_id', 5)->where('assignment_id', $aid->taId)->count();
    echo "used on resolved={$used} block=" . ($used >= $aid->taMax_attempt ? 'YES' : 'NO') . "\n";
}

// Bug path: counting by exam_id
$usedExam = Submission::where('user_id', 5)->where('exam_id', 37)->count();
echo "WRONG used_by_exam_id={$usedExam} (would block if max=1)\n";

echo "\n===== 4) Check opcache / file mtime of fixed controllers =====\n";
$files = [
  'app/Http/Controllers/StudentTestController.php',
  'app/Http/Controllers/GradingController.php',
  'app/Http/Controllers/TestAssignmentController.php',
];
foreach ($files as $f) {
  $p = "/var/www/namthuedu/backend/$f";
  echo basename($f) . " mtime=" . date('c', filemtime($p)) . " size=" . filesize($p) . "\n";
  // show snippet of time-aware
  $c = file_get_contents($p);
  echo "  has_at_param=" . (str_contains($c, '$at = null') ? 'yes' : 'no') . "\n";
  echo "  has_historical=" . (str_contains($c, 'Historical backfill') || str_contains($c, 'QUAN TRỌNG') ? 'yes' : 'no') . "\n";
}

echo "\n===== 5) Real HTTP-ish kernel call start assignment 28 =====\n";
try {
  // create sanctum token? use actingAs via request user injection
  $request = Request::create("/api/student/tests/28/start", 'POST');
  $request->setUserResolver(function () use ($user) { return $user; });
  // call controller method directly
  $controller = $app->make(App\Http\Controllers\StudentTestController::class);
  $response = $controller->start($request, 28);
  $content = $response->getContent();
  $status = $response->getStatusCode();
  echo "HTTP $status\n";
  $json = json_decode($content, true);
  echo "status=" . ($json['status'] ?? '?') . " message=" . ($json['message'] ?? 'ok') . "\n";
  if (isset($json['data']['submissionId'])) {
    echo "submissionId=" . $json['data']['submissionId'] . "\n";
    // cleanup the test submission we just created
    $sid = $json['data']['submissionId'];
    $sub = Submission::find($sid);
    if ($sub && $sub->sStatus === 'in_progress' && (int)$sub->user_id === 5 && (int)$sub->assignment_id === 28) {
      $sub->answers()->delete();
      $sub->delete();
      echo "cleaned synthetic submission $sid\n";
    }
  } else {
    echo substr($content, 0, 500) . "\n";
  }
} catch (Throwable $e) {
  echo "ERR: " . $e->getMessage() . "\n" . $e->getFile() . ':' . $e->getLine() . "\n";
}

echo "\n===== 6) Assignments that LOOK new but blocked for someone =====\n";
$rows = DB::select("
SELECT ta.taId, ta.exam_id, ta.taMax_attempt, ta.taCreated_at, ta.taTarget_type, ta.taTarget_id,
  u.uId, u.uName,
  (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id=ta.taId AND s.user_id=u.uId) used
FROM test_assignments ta
JOIN users u ON u.uRole='student' AND u.uDeleted_at IS NULL AND (
  (ta.taTarget_type='student' AND ta.taTarget_id=u.uId)
  OR (ta.taTarget_type='class' AND ta.taTarget_id=u.class_id)
)
WHERE ta.taCreated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
HAVING used >= ta.taMax_attempt
ORDER BY ta.taId DESC
");
foreach ($rows as $r) {
  echo sprintf("BLOCKED NEWISH ta=%d exam=%d user=%d(%s) used=%d/%d created=%s\n",
    $r->taId, $r->exam_id, $r->uId, $r->uName, $r->used, $r->taMax_attempt, $r->taCreated_at);
}
if (empty($rows)) echo "(none - good)\n";

echo "DONE\n";
PHP

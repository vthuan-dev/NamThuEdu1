#!/bin/bash
set -euo pipefail
cd /var/www/namthuedu/backend

php <<'PHP'
<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "===== exam 37 / ta 28 detail =====\n";
$ta = DB::select('SELECT taId, exam_id, taTarget_type, taTarget_id, taMax_attempt, taCreated_at, taDeadline FROM test_assignments WHERE taId=28');
print_r($ta);
$subs = DB::select('SELECT sId,user_id,assignment_id,sStatus,sStart_time,sAttempt FROM submissions WHERE exam_id=37 ORDER BY sId DESC LIMIT 20');
print_r($subs);

echo "===== Simulate attempts for students on recent assignments =====\n";
$rows = DB::select("
SELECT ta.taId, ta.exam_id, ta.taMax_attempt, ta.taTarget_type, ta.taTarget_id, ta.taCreated_at,
       u.uId AS user_id, u.uName, u.age_group, u.class_id,
       (SELECT COUNT(*) FROM submissions s WHERE s.user_id=u.uId AND s.assignment_id=ta.taId) AS used_aid,
       (SELECT COUNT(*) FROM submissions s WHERE s.user_id=u.uId AND s.exam_id=ta.exam_id) AS used_exam_all,
       (SELECT COUNT(*) FROM submissions s WHERE s.user_id=u.uId AND s.exam_id=ta.exam_id AND s.assignment_id IS NULL) AS used_exam_null,
       (SELECT s.sStatus FROM submissions s WHERE s.user_id=u.uId AND s.exam_id=ta.exam_id ORDER BY s.sId DESC LIMIT 1) AS last_status_any,
       (SELECT s.sStatus FROM submissions s WHERE s.user_id=u.uId AND s.assignment_id=ta.taId ORDER BY s.sId DESC LIMIT 1) AS last_status_aid
FROM test_assignments ta
JOIN users u ON u.uRole='student' AND u.uDeleted_at IS NULL
  AND (
    (ta.taTarget_type='student' AND ta.taTarget_id=u.uId)
    OR (ta.taTarget_type='class' AND ta.taTarget_id=u.class_id)
  )
WHERE ta.taId >= 20
ORDER BY ta.taId DESC, u.uId
");
foreach ($rows as $r) {
  $blocked = ($r->used_aid >= $r->taMax_attempt) ? 'BLOCK_AID' : 'ok_aid';
  $feDone = in_array($r->last_status_any, ['submitted','graded','auto_submitted','ai_graded','partially_graded','grading_subjective'], true) ? 'FE_DONE_ANY' : 'fe_open';
  echo sprintf(
    "ta=%d exam=%d user=%d(%s/%s) max=%d used_aid=%d used_exam=%d null=%d last_any=%s last_aid=%s => %s | %s\n",
    $r->taId, $r->exam_id, $r->user_id, $r->uName, $r->age_group,
    $r->taMax_attempt, $r->used_aid, $r->used_exam_all, $r->used_exam_null,
    $r->last_status_any ?? 'none', $r->last_status_aid ?? 'none', $blocked, $feDone
  );
}

echo "\n===== Case: start gate for ta=28 students =====\n";
$targets = DB::select("
SELECT u.uId, u.uName, u.age_group, u.class_id,
  (SELECT COUNT(*) FROM submissions s WHERE s.user_id=u.uId AND s.assignment_id=28) used28,
  (SELECT COUNT(*) FROM submissions s WHERE s.user_id=u.uId AND s.exam_id=37) usedExam37
FROM users u
WHERE u.uRole='student' AND u.uDeleted_at IS NULL
  AND (
    u.uId IN (SELECT taTarget_id FROM test_assignments WHERE taId=28 AND taTarget_type='student')
    OR u.class_id IN (SELECT taTarget_id FROM test_assignments WHERE taId=28 AND taTarget_type='class')
  )
");
print_r($targets);

echo "\n===== Which FE paths exist for attempt exhaustion =====\n";
// Search frontend on VPS if present
$feRoot = '/var/www/namthuedu/frontend';
if (is_dir($feRoot)) {
  echo "frontend dir exists\n";
} else {
  echo "no frontend source on VPS\n";
}

echo "\n===== Recent assignment 28 target info =====\n";
$t28 = DB::select('SELECT * FROM test_assignments WHERE taId IN (26,27,28)');
foreach ($t28 as $t) {
  echo json_encode($t, JSON_UNESCAPED_UNICODE) . "\n";
  if ($t->taTarget_type === 'class') {
    $students = DB::select('SELECT uId,uName,age_group FROM users WHERE class_id=? AND uRole=\"student\" AND uDeleted_at IS NULL', [$t->taTarget_id]);
    echo "  students: " . json_encode($students, JSON_UNESCAPED_UNICODE) . "\n";
  } else {
    $st = DB::select('SELECT uId,uName,age_group,class_id FROM users WHERE uId=?', [$t->taTarget_id]);
    echo "  student: " . json_encode($st, JSON_UNESCAPED_UNICODE) . "\n";
  }
}

echo "DONE\n";
PHP

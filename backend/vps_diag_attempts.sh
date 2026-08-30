#!/bin/bash
set -euo pipefail
cd /var/www/namthuedu/backend

php <<'PHP'
<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\Submission;
use App\Models\TestAssignment;
use App\Models\User;
use App\Models\Exam;
use Carbon\Carbon;

echo "===== 1) RECENT ASSIGNMENTS (last 15) =====\n";
$assigns = DB::select("
SELECT ta.taId, ta.exam_id, ta.taTarget_type, ta.taTarget_id,
       ta.taMax_attempt, ta.taCreated_at, ta.taDeadline,
       e.eTitle, e.age_group, e.eType,
       (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = ta.taId) AS used_by_aid,
       (SELECT COUNT(*) FROM submissions s WHERE s.exam_id = ta.exam_id) AS used_by_exam
FROM test_assignments ta
LEFT JOIN exams e ON e.eId = ta.exam_id
ORDER BY ta.taId DESC
LIMIT 15
");
foreach ($assigns as $a) {
    echo sprintf(
        "ta=%d exam=%d(%s) target=%s:%s max=%d used_aid=%d used_exam=%d created=%s title=%s\n",
        $a->taId, $a->exam_id, $a->age_group ?? '?', $a->taTarget_type, $a->taTarget_id,
        $a->taMax_attempt, $a->used_by_aid, $a->used_by_exam, $a->taCreated_at, mb_substr($a->eTitle ?? '', 0, 40)
    );
}

echo "\n===== 2) MISBOUND remaining =====\n";
$mis = DB::select("
SELECT COUNT(*) c FROM submissions s
JOIN test_assignments ta ON ta.taId=s.assignment_id
WHERE s.sStart_time IS NOT NULL AND ta.taCreated_at IS NOT NULL AND s.sStart_time < ta.taCreated_at
");
echo "misbound=" . $mis[0]->c . "\n";

echo "\n===== 3) Assignments with used >= max (blocked) =====\n";
$blocked = DB::select("
SELECT ta.taId, ta.exam_id, ta.taMax_attempt, ta.taCreated_at, e.eTitle, e.age_group,
       COUNT(s.sId) used,
       GROUP_CONCAT(CONCAT(s.sId,':',s.user_id,':',s.sStatus,':',IFNULL(s.sStart_time,'null')) ORDER BY s.sId SEPARATOR ' | ') samples
FROM test_assignments ta
JOIN submissions s ON s.assignment_id = ta.taId
LEFT JOIN exams e ON e.eId = ta.exam_id
GROUP BY ta.taId, ta.exam_id, ta.taMax_attempt, ta.taCreated_at, e.eTitle, e.age_group
HAVING used >= ta.taMax_attempt
ORDER BY ta.taId DESC
LIMIT 20
");
foreach ($blocked as $b) {
    echo sprintf(
        "BLOCKED ta=%d exam=%d max=%d used=%d age=%s created=%s title=%s\n  %s\n",
        $b->taId, $b->exam_id, $b->taMax_attempt, $b->used, $b->age_group ?? '?',
        $b->taCreated_at, mb_substr($b->eTitle ?? '', 0, 40), $b->samples
    );
}

echo "\n===== 4) Per-user attempts on recent assignments =====\n";
$perUser = DB::select("
SELECT ta.taId, ta.exam_id, ta.taMax_attempt, s.user_id, u.uName, u.age_group,
       COUNT(*) used,
       MIN(s.sStart_time) first_start, MAX(s.sStart_time) last_start,
       GROUP_CONCAT(s.sStatus) statuses
FROM test_assignments ta
JOIN submissions s ON s.assignment_id = ta.taId
LEFT JOIN users u ON u.uId = s.user_id
WHERE ta.taId >= (SELECT MAX(taId)-20 FROM test_assignments)
GROUP BY ta.taId, ta.exam_id, ta.taMax_attempt, s.user_id, u.uName, u.age_group
HAVING used >= 1
ORDER BY ta.taId DESC, used DESC
LIMIT 40
");
foreach ($perUser as $p) {
    $flag = ($p->used >= $p->taMax_attempt) ? 'FULL' : 'ok';
    echo sprintf(
        "[%s] ta=%d exam=%d user=%d(%s/%s) used=%d/%d first=%s last=%s statuses=%s\n",
        $flag, $p->taId, $p->exam_id, $p->user_id, $p->uName ?? '?', $p->age_group ?? '?',
        $p->used, $p->taMax_attempt, $p->first_start, $p->last_start, $p->statuses
    );
}

echo "\n===== 5) Orphan submissions (assignment_id NULL) for recent exams that have active assignments =====\n";
$orphans = DB::select("
SELECT s.sId, s.user_id, s.exam_id, s.sStatus, s.sStart_time, s.sAttempt,
       (SELECT ta.taId FROM test_assignments ta
        WHERE ta.exam_id = s.exam_id
        ORDER BY ta.taId DESC LIMIT 1) AS newest_ta,
       (SELECT ta.taCreated_at FROM test_assignments ta
        WHERE ta.exam_id = s.exam_id
        ORDER BY ta.taId DESC LIMIT 1) AS newest_ta_created,
       (SELECT ta.taMax_attempt FROM test_assignments ta
        WHERE ta.exam_id = s.exam_id
        ORDER BY ta.taId DESC LIMIT 1) AS newest_max
FROM submissions s
WHERE s.assignment_id IS NULL
  AND s.exam_id IN (SELECT exam_id FROM test_assignments WHERE taId >= (SELECT MAX(taId)-15 FROM test_assignments))
ORDER BY s.sId DESC
LIMIT 30
");
foreach ($orphans as $o) {
    echo sprintf(
        "orphan s=%d user=%d exam=%d status=%s start=%s newest_ta=%s created=%s max=%s\n",
        $o->sId, $o->user_id, $o->exam_id, $o->sStatus, $o->sStart_time,
        $o->newest_ta, $o->newest_ta_created, $o->newest_max
    );
}

echo "\n===== 6) Kids/Teens list path simulation: keyBy(exam_id) problem =====\n";
// If student has multiple assignments for same exam, keyBy keeps only one
$dupExams = DB::select("
SELECT exam_id, COUNT(*) c, GROUP_CONCAT(taId ORDER BY taId) aids, GROUP_CONCAT(taMax_attempt ORDER BY taId) maxs
FROM test_assignments
GROUP BY exam_id
HAVING c > 1
ORDER BY c DESC
LIMIT 15
");
foreach ($dupExams as $d) {
    echo sprintf("exam=%d assignments=%d aids=%s maxs=%s\n", $d->exam_id, $d->c, $d->aids, $d->maxs);
}

echo "\n===== 7) Check kids/teens dashboard attempt count source =====\n";
// Read how kids list counts attempts - grep in controller for keyBy exam
echo "See code paths for attempts_used by exam_id vs assignment_id\n";

echo "\n===== 8) Specific user=5 recent picture =====\n";
$u5 = DB::select("
SELECT s.sId, s.exam_id, s.assignment_id, s.sStatus, s.sStart_time, s.sAttempt, s.sScore,
       ta.taCreated_at, ta.taMax_attempt
FROM submissions s
LEFT JOIN test_assignments ta ON ta.taId = s.assignment_id
WHERE s.user_id = 5
ORDER BY s.sId DESC
LIMIT 25
");
foreach ($u5 as $r) {
    $bad = ($r->assignment_id && $r->sStart_time && $r->taCreated_at && $r->sStart_time < $r->taCreated_at) ? ' BAD' : '';
    echo sprintf(
        "s=%d exam=%d aid=%s status=%s start=%s attempt=%s score=%s ta_created=%s max=%s%s\n",
        $r->sId, $r->exam_id, $r->assignment_id ?? 'NULL', $r->sStatus, $r->sStart_time,
        $r->sAttempt, $r->sScore, $r->taCreated_at ?? '-', $r->taMax_attempt ?? '-', $bad
    );
}

echo "\nDONE\n";
PHP

<?php
/**
 * Repair submissions that were incorrectly bound to assignments created AFTER
 * the student started the attempt (sStart_time < taCreated_at).
 *
 * Usage:
 *   php repair_misbound_assignments.php --dry-run
 *   php repair_misbound_assignments.php
 */
require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\Submission;
use App\Models\TestAssignment;
use App\Models\User;
use Carbon\Carbon;

$dryRun = in_array('--dry-run', $argv ?? [], true);

echo ($dryRun ? "[DRY-RUN] " : "[APPLY] ") . "Repair misbound submissions\n";

$misbound = DB::select("
SELECT s.sId, s.user_id, s.exam_id, s.assignment_id AS old_assignment_id,
       s.sStatus, s.sStart_time, s.sSubmit_time,
       ta.taCreated_at AS assignment_created_at, ta.taMax_attempt
FROM submissions s
JOIN test_assignments ta ON ta.taId = s.assignment_id
WHERE s.sStart_time IS NOT NULL
  AND ta.taCreated_at IS NOT NULL
  AND s.sStart_time < ta.taCreated_at
ORDER BY s.sId
");

echo "Found " . count($misbound) . " misbound submission(s)\n";

$unbound = 0;
$rebound = 0;

foreach ($misbound as $row) {
    $at = $row->sStart_time ?? $row->sSubmit_time;
    $user = User::find($row->user_id);
    $newAid = null;

    if ($user && $at) {
        try {
            $atCarbon = Carbon::parse($at);
            $classIds = $user->class_id ? [(int) $user->class_id] : [];
            $candidate = TestAssignment::where('exam_id', $row->exam_id)
                ->where(function ($q) use ($user, $classIds) {
                    $q->where(function ($qq) use ($user) {
                        $qq->where('taTarget_type', 'student')
                            ->where('taTarget_id', $user->uId);
                    })->orWhere(function ($qq) use ($classIds) {
                        if (empty($classIds)) {
                            $qq->whereRaw('1 = 0');
                            return;
                        }
                        $qq->where('taTarget_type', 'class')
                            ->whereIn('taTarget_id', $classIds);
                    });
                })
                ->where(function ($q) use ($atCarbon) {
                    $q->whereNull('taCreated_at')
                        ->orWhere('taCreated_at', '<=', $atCarbon);
                })
                ->orderByRaw("CASE WHEN taTarget_type = 'student' THEN 0 ELSE 1 END")
                ->orderByDesc('taId')
                ->first(['taId']);
            $newAid = $candidate ? (int) $candidate->taId : null;
        } catch (Throwable $e) {
            $newAid = null;
        }
    }

    echo sprintf(
        "  sId=%d user=%d exam=%d old_ta=%d -> new_ta=%s (start=%s, ta_created=%s)\n",
        $row->sId,
        $row->user_id,
        $row->exam_id,
        $row->old_assignment_id,
        $newAid === null ? 'NULL' : (string) $newAid,
        $row->sStart_time,
        $row->assignment_created_at
    );

    if ($dryRun) {
        if ($newAid === null) {
            $unbound++;
        } else {
            $rebound++;
        }
        continue;
    }

    $sub = Submission::find($row->sId);
    if (!$sub) {
        continue;
    }
    $sub->assignment_id = $newAid;
    $sub->save();
    if ($newAid === null) {
        $unbound++;
    } else {
        $rebound++;
    }
}

echo "Done. unbound={$unbound}, rebound={$rebound}\n";

// Post-check: should be zero misbound remaining
$remaining = DB::select("
SELECT COUNT(*) AS c
FROM submissions s
JOIN test_assignments ta ON ta.taId = s.assignment_id
WHERE s.sStart_time IS NOT NULL
  AND ta.taCreated_at IS NOT NULL
  AND s.sStart_time < ta.taCreated_at
");
echo "Remaining misbound: " . ($remaining[0]->c ?? 0) . "\n";

<?php
require __DIR__.'/vendor/autoload.php';
$app = require __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Submission;

$s = Submission::find(250);
echo "subId={$s->sId}\n";
echo "status={$s->sStatus}\n";
echo "exam_id={$s->exam_id}\n";
echo "assignment_id=" . var_export($s->assignment_id, true) . "\n";
echo "start={$s->sStart_time}\n";
echo "submit={$s->sSubmit_time}\n";

// dump all attributes to see the schema
echo str_repeat('-', 60) . "\n";
foreach ($s->getAttributes() as $k => $v) {
    if (is_scalar($v) || is_null($v)) {
        echo "  {$k} = " . var_export($v, true) . "\n";
    }
}

echo str_repeat('-', 60) . "\n";
$exam = $s->exam ?? null;
if ($exam) {
    echo "exam title={$exam->eTitle}\n";
    $duration = $exam->eDuration_minutes ?? $exam->eDuration ?? 0;
    echo "duration={$duration}min\n";
    if ($s->sStart_time) {
        $elapsed = \Carbon\Carbon::parse($s->sStart_time)->diffInMinutes(now());
        echo "now=" . now() . "\n";
        echo "elapsed={$elapsed}min  remaining=" . ($duration - $elapsed) . "min\n";
    }
} else {
    echo "No exam relation resolved (exam_id={$s->exam_id})\n";
}

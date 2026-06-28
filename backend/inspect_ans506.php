<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$ans = \DB::table('answers')->where('submission_id', 202)->where('question_id', 506)->first();
if ($ans) {
    echo "saAnswer_text: " . var_export($ans->saAnswer_text, true) . "\n";
    echo "saIs_correct: " . var_export($ans->saIs_correct, true) . "\n";
} else {
    echo "Answer for question 506 not found\n";
}
unlink(__FILE__);

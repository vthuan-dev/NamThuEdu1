<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$columns = DB::select('DESCRIBE exams');
echo json_encode($columns, JSON_PRETTY_PRINT);

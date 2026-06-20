<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\File;

// Temporary debug route - DELETE AFTER DEBUGGING
Route::get('/debug/last-error', function () {
    if (!app()->environment('local', 'staging')) {
        abort(404);
    }
    
    $logPath = storage_path('logs/laravel-' . date('Y-m-d') . '.log');
    
    if (!File::exists($logPath)) {
        return response()->json(['error' => 'Log file not found']);
    }
    
    $content = File::get($logPath);
    $lines = explode("\n", $content);
    $lastErrors = [];
    
    // Get last 100 lines
    $recentLines = array_slice($lines, -100);
    
    foreach ($recentLines as $line) {
        if (str_contains($line, 'VstepSubmit error') || 
            str_contains($line, 'Draft save failed') ||
            str_contains($line, 'student/tests') ||
            str_contains($line, 'ERROR')) {
            $lastErrors[] = $line;
        }
    }
    
    return response()->json([
        'last_errors' => $lastErrors,
        'log_file' => $logPath,
        'total_lines' => count($lines),
    ]);
});

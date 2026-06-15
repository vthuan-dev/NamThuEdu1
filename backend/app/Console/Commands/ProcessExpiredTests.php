<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\TestRecoveryService;

class ProcessExpiredTests extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'tests:process-expired';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Process expired tests and auto-submit them';

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $this->info('Processing expired tests...');

        $stats = TestRecoveryService::handleInterruptedTests();

        // Backwards compatibility: nếu service cũ trả về int thì format gọn,
        // còn không thì in chi tiết theo từng nhánh.
        if (is_int($stats)) {
            $this->info("Processed {$stats} expired tests.");
        } else {
            $timeout  = $stats['timeout']  ?? 0;
            $inactive = $stats['inactive'] ?? 0;
            $failed   = $stats['failed']   ?? 0;
            $total    = $timeout + $inactive;

            $this->info("Processed {$total} expired tests (timeout: {$timeout}, inactive: {$inactive}, failed: {$failed}).");
        }

        return 0;
    }
}
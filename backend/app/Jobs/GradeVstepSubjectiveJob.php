<?php

namespace App\Jobs;

use App\Models\Submission;
use App\Services\VstepGradingService;
use App\Services\IELTSGradingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class GradeVstepSubjectiveJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Max attempts before failing */
    public int $tries = 3;

    /** Seconds before the job is considered timed out */
    public int $timeout = 180;

    /** Delay between retries (seconds) */
    public int $backoff = 30;

    private int $submissionId;

    public function __construct(int $submissionId)
    {
        $this->submissionId = $submissionId;
    }

    public function handle(VstepGradingService $vstep, IELTSGradingService $ielts): void
    {
        $submission = Submission::with(['exam.questions', 'answers.question'])
            ->find($this->submissionId);

        if (!$submission) {
            Log::warning("GradeVstepSubjectiveJob: submission {$this->submissionId} not found.");
            return;
        }

        if ($submission->sStatus !== 'grading_subjective') {
            Log::info("GradeVstepSubjectiveJob: submission {$this->submissionId} is not in grading_subjective status, skipping.");
            return;
        }

        $examType = strtoupper($submission->exam->eType ?? '');
        $service  = $examType === 'IELTS' ? $ielts : $vstep;

        Log::info("GradeVstepSubjectiveJob: starting for submission {$this->submissionId} type={$examType}");

        try {
            // Skip AI for short/empty writing answers — auto-grade as 0
            $hasWritingSection = $submission->exam->questions->contains(function ($q) {
                return strtolower($q->qSkill ?? $q->qSection ?? '') === 'writing';
            });
            $hasRealWriting = $submission->answers->contains(function ($a) {
                $sec = strtolower($a->question->qSkill ?? $a->question->qSection ?? '');
                if ($sec !== 'writing') return false;
                return strlen(trim($a->saAnswer_text ?? '')) >= 30;
            });
            // null khi đề KHÔNG có phần writing (vd: đề Speaking-only của teens) để
            // không kéo điểm trung bình xuống; 0 khi có phần writing nhưng bỏ trống.
            $writingScore  = $hasWritingSection ? ($hasRealWriting ? $service->gradeWriting($submission) : 0) : null;
            $speakingScore = $service->gradeSpeaking($submission);
            $service->updateSubmission($submission, $writingScore, $speakingScore);

            Log::info("GradeVstepSubjectiveJob: completed for submission {$this->submissionId}", [
                'type'     => $examType,
                'writing'  => $writingScore,
                'speaking' => $speakingScore,
            ]);

        } catch (\Exception $e) {
            Log::error("GradeVstepSubjectiveJob: failed for submission {$this->submissionId}: " . $e->getMessage());
            throw $e;
        }
    }

    public function failed(\Throwable $e): void
    {
        Log::error("GradeVstepSubjectiveJob: permanently failed for submission {$this->submissionId}: " . $e->getMessage());

        // Mark submission as partially graded so it's not stuck in grading_subjective
        $submission = Submission::find($this->submissionId);
        if ($submission && $submission->sStatus === 'grading_subjective') {
            $submission->update(['sStatus' => 'graded']);
        }
    }
}

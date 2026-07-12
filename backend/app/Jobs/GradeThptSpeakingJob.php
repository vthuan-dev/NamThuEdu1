<?php

namespace App\Jobs;

use App\Models\Submission;
use App\Services\VstepGradingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Chấm phần Nói (Speaking) cho đề THPT/tổng hợp Teens bằng AI (Groq Whisper + LLM).
 *
 * Đề THPT chấm khách quan đồng bộ ngay khi nộp (submission_payload['result']).
 * Job này chạy nền: chấm các bài ghi âm trong sGemini_feedback['speaking_audio'],
 * blend điểm Nói vào điểm tổng và cập nhật lại result + sScore.
 */
class GradeThptSpeakingJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 240;
    public int $backoff = 30;

    private int $submissionId;

    public function __construct(int $submissionId)
    {
        $this->submissionId = $submissionId;
    }

    public function handle(VstepGradingService $vstep): void
    {
        $submission = Submission::with('exam')->find($this->submissionId);
        if (!$submission) {
            Log::warning("GradeThptSpeakingJob: submission {$this->submissionId} not found.");
            return;
        }

        $payload = $submission->submission_payload ?? [];
        $config  = $payload['exam_snapshot']['config'] ?? optional($submission->exam)->thpt_config ?? [];
        $raw     = json_decode($submission->sGemini_feedback ?? '{}', true) ?: [];
        $audioMap = $raw['speaking_audio'] ?? [];

        if (empty($audioMap)) {
            Log::info("GradeThptSpeakingJob: no speaking audio for submission {$this->submissionId}.");
            return;
        }

        // prompt theo question_number để cung cấp ngữ cảnh cho AI
        $promptByQn = [];
        foreach (($config['sections'] ?? []) as $s) {
            if (($s['type'] ?? '') !== 'speaking') continue;
            foreach (($s['items'] ?? []) as $it) {
                $promptByQn[(string) ($it['question_number'] ?? '')] = $it['prompt'] ?? '';
            }
        }

        $scores = [];
        $parts  = [];
        foreach ($audioMap as $qn => $url) {
            $context = $promptByQn[(string) $qn] ?? '';
            try {
                $res = $vstep->gradeSpeakingAudio((string) $url, (string) $context, (int) $qn);
            } catch (\Throwable $e) {
                Log::error("GradeThptSpeakingJob: grade failed q{$qn} sub {$this->submissionId}: " . $e->getMessage());
                continue;
            }
            $scores[] = (float) ($res['score'] ?? 0);
            $parts["q{$qn}"] = $res;
        }

        if (empty($scores)) {
            Log::warning("GradeThptSpeakingJob: no speaking score produced for submission {$this->submissionId}.");
            return;
        }

        $speakingAvg = round(array_sum($scores) / count($scores), 2);

        // Blend với điểm khách quan (nếu có) — trung bình 2 phần.
        $result = $payload['result'] ?? [];
        $objectiveScaled = isset($result['scaled_score']) ? (float) $result['scaled_score'] : null;
        $objectiveTotal  = 0;
        foreach (($result['sections'] ?? []) as $st) {
            if (($st['type'] ?? '') !== 'speaking') {
                $objectiveTotal += (int) ($st['total_count'] ?? 0);
            }
        }

        $result['speaking'] = [
            'score'     => $speakingAvg,
            'scale_max' => 10,
            'parts'     => $parts,
        ];
        // Lưu điểm khách quan THUẦN (trước khi blend) để teacher/writing job blend lại an toàn.
        if ($objectiveScaled !== null && !isset($result['scaled_score_objective'])) {
            $result['scaled_score_objective'] = $objectiveScaled;
        }

        // Blend multi-skill: objective + speaking + writing (nếu có).
        $vals = [];
        $objPure = isset($result['scaled_score_objective'])
            ? (float) $result['scaled_score_objective']
            : $objectiveScaled;
        if ($objectiveTotal > 0 && $objPure !== null) {
            $vals[] = (float) $objPure;
        }
        $vals[] = $speakingAvg;
        if (isset($result['writing']['score'])) {
            $vals[] = (float) $result['writing']['score'];
        }
        $combined = round(array_sum($vals) / max(count($vals), 1), 2);
        $result['scaled_score'] = $combined;
        $payload['result'] = $result;

        $submission->submission_payload = $payload;
        $submission->sScore = $combined;
        $submission->sGraded_time = now();
        if ($submission->sStatus !== 'graded') {
            $submission->sStatus = 'graded';
        }
        $submission->save();

        Log::info("GradeThptSpeakingJob: done sub {$this->submissionId} speaking={$speakingAvg} combined={$combined}");
    }

    public function failed(\Throwable $e): void
    {
        Log::error("GradeThptSpeakingJob: permanently failed sub {$this->submissionId}: " . $e->getMessage());
    }
}

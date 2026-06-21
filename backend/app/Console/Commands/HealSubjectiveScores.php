<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\SubmissionAnswer;
use App\Models\Submission;
use Illuminate\Support\Facades\DB;

/**
 * Heal subjective (writing/speaking) scores corrupted by old grading bug.
 *
 * Old bug: GradingDetail FE bulk-save sent questionScores with saPoints_awarded=0
 * for tasks that teacher never reviewed (because FE defaulted null → 0).
 * Backend faithfully wrote 0, then recomputed skill avg from those 0s.
 *
 * Heal logic:
 *   - For writing/speaking SubmissionAnswers where saPoints_awarded = 0
 *     AND saAi_score > 0 AND saReview_status = 'pending'
 *     → restore saPoints_awarded = saAi_score (teacher never explicitly chấm 0).
 *   - Recompute vstep_scores.writing / vstep_scores.speaking for each
 *     affected submission and update sGemini_feedback + sScore.
 *
 * Usage: php artisan grading:heal-subjective [--dry-run]
 */
class HealSubjectiveScores extends Command
{
    protected $signature = 'grading:heal-subjective {--dry-run : Show changes without applying}';
    protected $description = 'Heal writing/speaking saPoints_awarded mistakenly set to 0 by old bulk-save bug';

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');

        $this->info('🔍 Đang quét submission_answers cần heal...');

        // Tìm các answer subjective có saPoints_awarded=0 nhưng AI đã chấm > 0
        $affected = SubmissionAnswer::query()
            ->where(function ($q) {
                $q->where('saPoints_awarded', 0)
                  ->orWhereNull('saPoints_awarded');
            })
            ->whereNotNull('saAi_score')
            ->where('saAi_score', '>', 0)
            ->where(function ($q) {
                $q->where('saReview_status', 'pending')
                  ->orWhereNull('saReview_status');
            })
            ->whereHas('question', function ($q) {
                $q->whereRaw('LOWER(qSkill) IN (?, ?)', ['writing', 'speaking'])
                  ->orWhereRaw('LOWER(qSection) IN (?, ?)', ['writing', 'speaking']);
            })
            ->with(['question', 'submission.exam'])
            ->get();

        $this->info("Tìm thấy {$affected->count()} answer cần heal.");

        if ($affected->isEmpty()) {
            $this->info('✅ Không có data corrupt — không cần làm gì.');
            return self::SUCCESS;
        }

        $affectedSubmissionIds = $affected->pluck('submission_id')->unique();
        $this->info("Ảnh hưởng đến {$affectedSubmissionIds->count()} submission.");

        if ($dryRun) {
            $this->warn('🚧 DRY-RUN — chỉ show, KHÔNG ghi DB.');
            $this->table(
                ['saId', 'submission_id', 'question_id', 'skill', 'old_points', 'will_set'],
                $affected->map(fn($a) => [
                    $a->saId,
                    $a->submission_id,
                    $a->question_id,
                    strtolower($a->question->qSkill ?? $a->question->qSection ?? ''),
                    $a->saPoints_awarded ?? 'NULL',
                    $a->saAi_score,
                ])->toArray()
            );
            return self::SUCCESS;
        }

        // ────── APPLY HEALING ──────
        $this->info('💊 Applying heal...');
        $bar = $this->output->createProgressBar($affected->count());

        DB::transaction(function () use ($affected, $bar) {
            foreach ($affected as $ans) {
                $ans->update(['saPoints_awarded' => $ans->saAi_score]);
                $bar->advance();
            }
        });
        $bar->finish();
        $this->newLine();

        // ────── RECOMPUTE per-submission ──────
        $this->info('🧮 Tính lại vstep_scores cho từng submission...');
        $bar2 = $this->output->createProgressBar($affectedSubmissionIds->count());

        foreach ($affectedSubmissionIds as $sid) {
            $sub = Submission::with(['answers.question', 'exam'])->find($sid);
            if (!$sub) continue;

            $writingScores = [];
            $speakingScores = [];
            foreach ($sub->answers as $ans) {
                if (!$ans->question) continue;
                $sec = strtolower($ans->question->qSkill ?? $ans->question->qSection ?? '');
                $pts = $ans->saPoints_awarded ?? $ans->saAi_score ?? 0;
                if ($sec === 'writing')   $writingScores[]  = $pts;
                if ($sec === 'speaking')  $speakingScores[] = $pts;
            }

            $raw = $sub->sGemini_feedback
                ? (json_decode($sub->sGemini_feedback, true) ?: [])
                : [];
            $vstepScores = $raw['vstep_scores'] ?? [];

            if (count($writingScores) > 0) {
                $vstepScores['writing'] = round(array_sum($writingScores) / count($writingScores), 2);
            }
            if (count($speakingScores) > 0) {
                $vstepScores['speaking'] = round(array_sum($speakingScores) / count($speakingScores), 2);
            }

            // Cập nhật writing_results.task_X.score nếu có (cho FE per-task display)
            if (isset($raw['writing_results']) && is_array($raw['writing_results'])) {
                foreach ($sub->answers as $ans) {
                    if (!$ans->question) continue;
                    $sec = strtolower($ans->question->qSkill ?? $ans->question->qSection ?? '');
                    if ($sec !== 'writing') continue;
                    $part = $ans->question->qPart ?? 1;
                    if (isset($raw['writing_results']["task_{$part}"])) {
                        $raw['writing_results']["task_{$part}"]['score'] =
                            $ans->saPoints_awarded ?? $ans->saAi_score;
                    }
                }
            }
            if (isset($raw['speaking_results']) && is_array($raw['speaking_results'])) {
                foreach ($sub->answers as $ans) {
                    if (!$ans->question) continue;
                    $sec = strtolower($ans->question->qSkill ?? $ans->question->qSection ?? '');
                    if ($sec !== 'speaking') continue;
                    $part = $ans->question->qPart ?? 1;
                    if (isset($raw['speaking_results']["part_{$part}"])) {
                        $raw['speaking_results']["part_{$part}"]['score'] =
                            $ans->saPoints_awarded ?? $ans->saAi_score;
                    }
                }
            }

            $raw['vstep_scores'] = $vstepScores;

            // Recompute overall
            $vals = array_filter([
                $vstepScores['listening'] ?? null,
                $vstepScores['reading']   ?? null,
                $vstepScores['writing']   ?? null,
                $vstepScores['speaking']  ?? null,
            ], fn($v) => !is_null($v));
            $newScore = count($vals) > 0
                ? round((array_sum($vals) / count($vals)) * 10, 2)
                : null;

            $update = ['sGemini_feedback' => json_encode($raw)];
            if ($newScore !== null) {
                $update['sScore'] = $newScore;
            }
            $sub->update($update);

            $bar2->advance();
        }
        $bar2->finish();
        $this->newLine();

        $this->info("✅ Healed {$affected->count()} answers across {$affectedSubmissionIds->count()} submissions.");
        return self::SUCCESS;
    }
}

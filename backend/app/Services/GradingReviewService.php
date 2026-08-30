<?php

namespace App\Services;

use App\Models\GradingHistory;
use App\Models\Submission;
use App\Models\SubmissionAnswer;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Handles teacher review actions on AI-graded answers.
 *
 *  - acceptAi:        teacher accepts AI score verbatim → copy to final fields.
 *  - modifyByTeacher: teacher overrides AI → write final fields, mark "modified".
 *  - regradeWithAi:   teacher asks AI to re-grade with optional hint.
 *  - finalizeSubmission: persist overall feedback + skill overrides; flip status to "graded".
 */
class GradingReviewService
{
    private VstepGradingService $vstepGrading;
    private IELTSGradingService $ieltsGrading;

    public function __construct(VstepGradingService $vstepGrading, IELTSGradingService $ieltsGrading)
    {
        $this->vstepGrading = $vstepGrading;
        $this->ieltsGrading = $ieltsGrading;
    }

    /**
     * Teacher accepts the AI's suggestion as-is.
     */
    public function acceptAi(SubmissionAnswer $answer, User $teacher): SubmissionAnswer
    {
        if (!$answer->hasAiScore()) {
            throw new \RuntimeException('AI chưa chấm câu này, không thể accept.');
        }

        $prev = $answer->saPoints_awarded;

        DB::transaction(function () use ($answer, $teacher, $prev) {
            $exam = $answer->submission ? $answer->submission->exam : null;
            $examType = $exam ? strtoupper($exam->eType ?? '') : '';
            $isVstep = $examType === 'VSTEP' || $examType === 'IELTS';
            $isCorrect = $isVstep ? ($answer->saAi_score >= 5.0) : ($answer->saAi_score >= floatval($answer->question->qPoints ?? 1) * 0.999);

            $answer->update([
                'saPoints_awarded'    => $answer->saAi_score,
                'saTeacher_feedback'  => $answer->saAi_feedback,
                'saIs_correct'        => $isCorrect,
                'saReview_status'     => 'accepted',
                'saReviewed_at'       => now(),
                'saReviewed_by'       => $teacher->uId,
            ]);

            GradingHistory::create([
                'submission_id' => $answer->submission_id,
                'answer_id'     => $answer->saId,
                'ghAction'      => GradingHistory::ACTION_TEACHER_ACCEPT,
                'ghActor_id'    => $teacher->uId,
                'ghPrev_score'  => $prev,
                'ghNew_score'   => $answer->saAi_score,
            ]);
        });

        return $answer->fresh();
    }

    /**
     * Teacher overrides AI suggestion with their own values.
     *
     * @param array $data { score: float, feedback?: string, criteria?: array, note?: string }
     */
    public function modifyByTeacher(SubmissionAnswer $answer, array $data, User $teacher): SubmissionAnswer
    {
        $score    = isset($data['score']) ? (float) $data['score'] : null;
        $feedback = $data['feedback'] ?? '';
        $criteria = $data['criteria'] ?? null;
        $note     = $data['note'] ?? null;

        if ($score === null) {
            throw new \InvalidArgumentException('score is required');
        }

        $score = max(0.0, min(10.0, $score));
        $prev  = $answer->saPoints_awarded;

        DB::transaction(function () use ($answer, $teacher, $score, $feedback, $criteria, $note, $prev) {
            // If teacher provided per-criterion scores, derive overall as their average
            // (overrides explicit overall)
            if (is_array($criteria) && count($criteria) > 0) {
                $vals = array_filter(array_values($criteria), fn($v) => is_numeric($v));
                if (count($vals) > 0) {
                    $score = round(array_sum($vals) / count($vals), 2);
                }
            }

            $exam = $answer->submission ? $answer->submission->exam : null;
            $examType = $exam ? strtoupper($exam->eType ?? '') : '';
            $isVstep = $examType === 'VSTEP' || $examType === 'IELTS';
            $isCorrect = $isVstep ? ($score >= 5.0) : ($score >= floatval($answer->question->qPoints ?? 1) * 0.999);

            $answer->update([
                'saPoints_awarded'   => $score,
                'saTeacher_feedback' => $feedback,
                'saIs_correct'       => $isCorrect,
                'saReview_status'    => 'modified',
                'saReviewed_at'      => now(),
                'saReviewed_by'      => $teacher->uId,
            ]);

            GradingHistory::create([
                'submission_id' => $answer->submission_id,
                'answer_id'     => $answer->saId,
                'ghAction'      => GradingHistory::ACTION_TEACHER_MODIFY,
                'ghActor_id'    => $teacher->uId,
                'ghPrev_score'  => $prev,
                'ghNew_score'   => $score,
                'ghNote'        => $note,
                'ghMetadata'    => $criteria ? ['criteria' => $criteria] : null,
            ]);
        });

        return $answer->fresh();
    }

    /**
     * Re-trigger AI grading for one specific answer.
     * Optional $hint is passed to AI to nudge re-evaluation.
     */
    public function regradeWithAi(SubmissionAnswer $answer, ?string $hint = null): SubmissionAnswer
    {
        $submission = $answer->submission;
        if (!$submission) {
            throw new \RuntimeException('Submission not found.');
        }

        $skill = strtolower($answer->question->qSkill ?? '');
        $prev  = $answer->saAi_score;

        if ($skill === 'writing') {
            // Re-grade single writing task — branch by exam type
            $examType   = strtoupper($submission->exam->eType ?? '');
            $taskNum    = (int) ($answer->question->qPart ?? 1);
            $taskPrompt = strip_tags($answer->question->qContent ?? '');
            $response   = trim($answer->saAnswer_text ?? '');
            if ($hint) {
                $taskPrompt .= "\n\n[Teacher hint for re-evaluation]: {$hint}";
            }

            if ($examType === 'IELTS') {
                $isAcademic = ($submission->exam->ielts_test_type ?? 'Academic') === 'Academic';
                $result = $this->ieltsGrading->gradeSingleWritingTask($taskNum, $isAcademic, $taskPrompt, $response);
                $score  = $result['band'];
            } else {
                $result = $this->vstepGrading->gradeSingleWritingTask($taskNum, $taskPrompt, $response);
                $score  = $result['score'];
            }

            DB::transaction(function () use ($answer, $score, $result, $prev, $hint) {
                $answer->update([
                    'saAi_score'      => $score,
                    'saAi_feedback'   => $result['feedback'] ?? '',
                    'saAi_criteria'   => [
                        'criteria'           => $result['criteria'] ?? [],
                        'criterion_comments' => $result['criterion_comments'] ?? [],
                        'suggestions'        => $result['suggestions'] ?? [],
                    ],
                    'saAi_model'      => env('GROQ_MODEL', 'llama-3.3-70b-versatile'),
                    'saAi_graded_at'  => now(),
                    // If teacher hadn't yet reviewed, keep pending; otherwise mark pending again
                    'saReview_status' => 'pending',
                    'saReviewed_at'   => null,
                    'saReviewed_by'   => null,
                ]);

                GradingHistory::create([
                    'submission_id' => $answer->submission_id,
                    'answer_id'     => $answer->saId,
                    'ghAction'      => GradingHistory::ACTION_AI_REGRADE,
                    'ghActor_id'    => null,
                    'ghPrev_score'  => $prev,
                    'ghNew_score'   => $score,
                    'ghNote'        => $hint,
                ]);
            });

            return $answer->fresh();
        }

        throw new \RuntimeException("Regrade hiện chỉ hỗ trợ kỹ năng Writing. Speaking phải regrade toàn bộ.");
    }

    /**
     * Finalize the submission — set status=graded, persist overall feedback & skill overrides.
     *
     * @param array $data {
     *   sTeacher_feedback?: string,
     *   skill_overrides?: { listening?: float, reading?: float, writing?: float, speaking?: float }
     * }
     * @throws \RuntimeException if any subjective answer is still pending
     */
    public function finalizeSubmission(Submission $submission, array $data, User $teacher): Submission
    {
        $pending = $submission->answers()
            ->whereHas('question', fn($q) => $q->whereIn(DB::raw('LOWER(qSkill)'), ['writing', 'speaking']))
            ->where('saReview_status', 'pending')
            ->whereNotNull('saAi_score')      // AI has graded but teacher hasn't reviewed
            ->pluck('saId');

        if ($pending->isNotEmpty()) {
            throw new \RuntimeException('Còn ' . $pending->count() . ' câu chưa được review.');
        }

        // Đọc TRƯỚC transaction để biết đây là lần chấm đầu hay sửa điểm.
        $previousScore = $submission->sScore;
        $wasReviewed   = $submission->teacher_reviewed_at !== null;

        DB::transaction(function () use ($submission, $data, $teacher, $previousScore, $wasReviewed) {
            $examType = strtoupper($submission->exam->eType ?? '');
            $isIelts  = $examType === 'IELTS';
            $isVstep  = $examType === 'VSTEP' || $isIelts;

            if ($isVstep) {
                $raw = $submission->sGemini_feedback
                    ? (json_decode($submission->sGemini_feedback, true) ?: [])
                    : [];

                // Pick scores key + max range based on exam type
                $scoresKey  = $isIelts ? 'ielts_scores' : 'vstep_scores';
                $maxScore   = $isIelts ? 9.0 : 10.0;
                $skillScores = $raw[$scoresKey] ?? [];

                // Apply teacher overrides (clamped + IELTS rounded to 0.5)
                $overrides = $data['skill_overrides'] ?? [];
                foreach (['listening', 'reading', 'writing', 'speaking'] as $skill) {
                    if (isset($overrides[$skill]) && is_numeric($overrides[$skill])) {
                        $val = (float) $overrides[$skill];
                        $val = max(0.0, min($maxScore, $val));
                        $skillScores[$skill] = $isIelts ? (round($val * 2) / 2) : round($val, 2);
                    }
                }
                $raw[$scoresKey] = $skillScores;

                // Overall = average of available skills (IELTS rounds to 0.5)
                $available = array_filter([
                    $skillScores['listening'] ?? null,
                    $skillScores['reading']   ?? null,
                    $skillScores['writing']   ?? null,
                    $skillScores['speaking']  ?? null,
                ], fn($v) => !is_null($v));

                $overallAvg = null;
                if (count($available) > 0) {
                    $avg = array_sum($available) / count($available);
                    $overallAvg = $isIelts ? (round($avg * 2) / 2) : round($avg, 2);
                }

                $update = [
                    'sGemini_feedback'    => json_encode($raw),
                    'sStatus'             => 'graded',
                    'sGraded_time'        => now(),
                    'teacher_reviewed_at' => now(),
                ];
                if (!empty($data['sTeacher_feedback'])) {
                    $update['sTeacher_feedback'] = $data['sTeacher_feedback'];
                }
                if (!is_null($overallAvg)) {
                    $update['sScore'] = round($overallAvg * 10, 2);
                }

                $submission->update($update);

                $historyMeta = [$scoresKey => $skillScores];
            } else {
                // Non-VSTEP/Kids/General logic
                $totalPoints = 0;
                $maxPoints = 0;

                // Load answers with question if not loaded
                if (!$submission->relationLoaded('answers') || $submission->answers->isEmpty()) {
                    $submission->load(['answers.question']);
                }

                foreach ($submission->answers as $answer) {
                    if (!$answer->question) continue;
                    $maxPoints += floatval($answer->question->qPoints ?: 1);
                    $totalPoints += floatval($answer->saPoints_awarded ?? 0);
                }

                $finalScore = $maxPoints > 0 ? round(($totalPoints / $maxPoints) * 100, 2) : 0;

                $update = [
                    'sStatus'             => 'graded',
                    'sGraded_time'        => now(),
                    'teacher_reviewed_at' => now(),
                    'sScore'              => $finalScore,
                ];
                if (!empty($data['sTeacher_feedback'])) {
                    $update['sTeacher_feedback'] = $data['sTeacher_feedback'];
                }

                $submission->update($update);

                $historyMeta = ['score' => $finalScore];
            }

            // Ghi audit + push. Phân biệt "chấm xong" với "sửa điểm" — trước đây
            // chỉ có một loại thông báo nên học viên không biết điểm đã bị sửa.
            (new GradingNotifier())->afterFinalize(
                $submission->fresh(['exam']),
                $teacher,
                $previousScore,
                $wasReviewed,
                $historyMeta
            );
        });

        return $submission->fresh();
    }
}

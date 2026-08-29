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
 * Chấm phần Viết (Writing essay) cho đề THPT/tổng hợp Teens bằng AI (Groq LLM).
 *
 * Điểm khách quan chấm sync khi nộp. Job này chạy nền:
 *  - Lấy bài viết từ submission_payload['answers']['q{n}']
 *  - Gọi VstepGradingService::gradeSingleWritingTask
 *  - Lưu result['writing']['parts']['q{n}'] (KHÔNG ghi đè speaking)
 *  - Blend điểm tổng: trung bình các skill có mặt (objective / speaking / writing)
 *
 * Giáo viên có thể chấm tay đè lên (teacher_*) qua ThptGradingController@save —
 * field AI (score/feedback/...) được giữ nguyên.
 */
class GradeThptWritingJob implements ShouldQueue
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
            Log::warning("GradeThptWritingJob: submission {$this->submissionId} not found.");
            return;
        }

        $payload = $submission->submission_payload ?? [];
        $config  = $payload['exam_snapshot']['config'] ?? optional($submission->exam)->thpt_config ?? [];
        $answers = is_array($payload['answers'] ?? null) ? $payload['answers'] : [];

        // Thu thập item writing: qn => prompt
        $items = [];
        foreach (($config['sections'] ?? []) as $s) {
            if (($s['type'] ?? '') !== 'writing') {
                continue;
            }
            foreach (($s['items'] ?? []) as $it) {
                $qn = $it['question_number'] ?? null;
                if ($qn === null) {
                    continue;
                }
                $items[(string) $qn] = [
                    'prompt' => (string) ($it['prompt'] ?? ''),
                    'min_words' => $it['min_words'] ?? null,
                    'max_words' => $it['max_words'] ?? null,
                ];
            }
        }

        if (empty($items)) {
            Log::info("GradeThptWritingJob: no writing items for submission {$this->submissionId}.");
            return;
        }

        $scores = [];
        $parts  = [];
        $taskNum = 2; // essay-style rubric (argumentative / paragraph)

        foreach ($items as $qn => $meta) {
            $text = trim((string) ($answers["q{$qn}"] ?? ''));
            $prompt = $meta['prompt'];

            // Bài quá ngắn / trống → 0, không gọi AI (tiết kiệm + nhất quán VSTEP)
            if (mb_strlen($text) < 30) {
                $parts["q{$qn}"] = [
                    'score' => 0.0,
                    'feedback' => $text === ''
                        ? 'Học viên không viết bài.'
                        : 'Bài viết quá ngắn để chấm chi tiết (dưới 30 ký tự).',
                    'suggestions' => ['Viết đầy đủ theo yêu cầu đề bài (đủ ý, đủ số từ gợi ý).'],
                    'criteria_detail' => [],
                    'criterion_comments' => [],
                    'content_score' => 0.0,
                    'pronunciation_score' => null,
                    'word_count' => $text === '' ? 0 : count(preg_split('/\s+/u', $text, -1, PREG_SPLIT_NO_EMPTY)),
                    'graded_by' => 'rule',
                ];
                $scores[] = 0.0;
                continue;
            }

            try {
                $res = $vstep->gradeSingleWritingTask($taskNum, $prompt, $text);
            } catch (\Throwable $e) {
                Log::error("GradeThptWritingJob: grade failed q{$qn} sub {$this->submissionId}: " . $e->getMessage());
                continue;
            }

            $score = (float) ($res['score'] ?? 0);
            $criteriaDetail = is_array($res['criteria'] ?? null) ? $res['criteria'] : [];
            // content_score: trung bình 4 tiêu chí nếu có, else = overall
            $critVals = array_values(array_filter(array_map(
                fn($v) => is_numeric($v) ? (float) $v : null,
                $criteriaDetail
            ), fn($v) => $v !== null));
            $contentScore = !empty($critVals)
                ? round(array_sum($critVals) / count($critVals), 2)
                : $score;

            $parts["q{$qn}"] = [
                'score' => $score,
                'feedback' => $res['feedback'] ?? '',
                'suggestions' => array_values(array_filter($res['suggestions'] ?? [])),
                'criteria_detail' => $criteriaDetail,
                'criterion_comments' => $res['criterion_comments'] ?? [],
                'content_score' => $contentScore,
                'pronunciation_score' => null,
                'word_count' => count(preg_split('/\s+/u', $text, -1, PREG_SPLIT_NO_EMPTY)),
                'graded_by' => 'ai',
            ];
            $scores[] = $score;
        }

        if (empty($parts)) {
            Log::warning("GradeThptWritingJob: no writing score produced for submission {$this->submissionId}.");
            return;
        }

        $writingAvg = round(array_sum($scores) / max(count($scores), 1), 2);

        $result = $payload['result'] ?? [];

        // Giữ điểm khách quan thuần
        if (!isset($result['scaled_score_objective']) && isset($result['scaled_score'])) {
            // Chỉ snapshot nếu chưa có speaking/writing blend trước đó
            // (GradeThptSpeakingJob cũng set field này)
            $result['scaled_score_objective'] = (float) $result['scaled_score'];
        }

        $result['writing'] = [
            'score' => $writingAvg,
            'scale_max' => 10,
            'parts' => $parts,
        ];

        $result['scaled_score'] = $this->blendScores($result);
        $payload['result'] = $result;

        $submission->submission_payload = $payload;

        // Điểm tổng giáo viên tự nhập thắng điểm AI.
        //
        // Job này nằm trong queue nên có thể chạy SAU khi giáo viên đã chấm tay: học
        // viên nộp → job xếp hàng → queue tắc → giáo viên vào chấm → job mới chạy và
        // ghi đè. Đề Viết/Nói lại đúng là loại giáo viên phải chấm tay, nên đây là
        // đường dễ mất điểm nhất. Vẫn cập nhật payload để điểm AI hiển thị được.
        $teacherOverride = isset($result['teacher_override_score'])
            ? (float) $result['teacher_override_score']
            : null;

        if ($teacherOverride === null) {
            $submission->sScore = $result['scaled_score'];
        } else {
            Log::info("GradeThptWritingJob: giữ điểm giáo viên {$teacherOverride} cho sub {$this->submissionId}, không ghi đè bằng điểm AI {$result['scaled_score']}");
        }

        $submission->sGraded_time = now();
        if ($submission->sStatus !== 'graded') {
            $submission->sStatus = 'graded';
        }
        $submission->save();

        Log::info("GradeThptWritingJob: done sub {$this->submissionId} writing={$writingAvg} combined={$result['scaled_score']}");
    }

    /**
     * Trung bình các skill có mặt: objective (nếu có câu), speaking, writing.
     */
    private function blendScores(array $result): float
    {
        $vals = [];

        $obj = isset($result['scaled_score_objective'])
            ? (float) $result['scaled_score_objective']
            : null;
        $hasObjectiveItems = false;
        foreach (($result['sections'] ?? []) as $st) {
            $t = $st['type'] ?? '';
            if (!in_array($t, ['speaking', 'writing'], true) && (int) ($st['total_count'] ?? 0) > 0) {
                $hasObjectiveItems = true;
                break;
            }
        }
        if ($hasObjectiveItems && $obj !== null) {
            $vals[] = $obj;
        }

        $spk = $result['speaking']['score'] ?? null;
        // Prefer effective avg from parts if present
        if (is_array($result['speaking']['parts'] ?? null) && !empty($result['speaking']['parts'])) {
            $eff = [];
            foreach ($result['speaking']['parts'] as $node) {
                if (!is_array($node)) continue;
                $e = $node['teacher_score'] ?? ($node['score'] ?? null);
                if ($e !== null) $eff[] = (float) $e;
            }
            if ($eff) $spk = round(array_sum($eff) / count($eff), 2);
        }
        if ($spk !== null) $vals[] = (float) $spk;

        $wrt = $result['writing']['score'] ?? null;
        if (is_array($result['writing']['parts'] ?? null) && !empty($result['writing']['parts'])) {
            $eff = [];
            foreach ($result['writing']['parts'] as $node) {
                if (!is_array($node)) continue;
                $e = $node['teacher_score'] ?? ($node['score'] ?? null);
                if ($e !== null) $eff[] = (float) $e;
            }
            if ($eff) $wrt = round(array_sum($eff) / count($eff), 2);
        }
        if ($wrt !== null) $vals[] = (float) $wrt;

        if (empty($vals)) {
            return (float) ($result['scaled_score'] ?? 0);
        }
        return round(array_sum($vals) / count($vals), 2);
    }

    public function failed(\Throwable $e): void
    {
        Log::error("GradeThptWritingJob: permanently failed sub {$this->submissionId}: " . $e->getMessage());
    }
}

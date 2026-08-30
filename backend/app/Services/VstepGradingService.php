<?php

namespace App\Services;

use App\Models\Submission;
use App\Services\PushNotificationService;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;

/**
 * VSTEP Subjective Grading Service
 *
 * Writing  → Groq LLM  (openai/gpt-oss-120b) with VSTEP rubric
 * Speaking → Groq Whisper (whisper-large-v3-turbo) transcribe audio
 *            → Groq LLM evaluate transcript with VSTEP speaking criteria
 *            → Pronunciation derived from Whisper signals (no external service)
 *
 * Config in .env:
 *   GROQ_API_KEY=gsk_...
 *   GROQ_MODEL=openai/gpt-oss-120b   (optional, this is default)
 */
class VstepGradingService
{
    private const LLM_URL       = 'https://api.groq.com/openai/v1/chat/completions';
    private const WHISPER_URL   = 'https://api.groq.com/openai/v1/audio/transcriptions';
    private const WHISPER_MODEL = 'whisper-large-v3-turbo';

    private Client $http;

    public function __construct()
    {
        $this->http = new Client([
            'timeout'         => 90,
            'connect_timeout' => 10,
            'verify'          => app()->environment('production'),
        ]);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  WRITING  (Groq LLM)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Grade all writing answers. Returns overall Writing score 0-10.
     */
    public function gradeWriting(Submission $submission): ?float
    {
        $writingAnswers = $submission->answers->filter(function ($a) {
            $sec = strtolower($a->question->qSkill ?? $a->question->qSection ?? '');
            return $sec === 'writing';
        })->sortBy(fn($a) => $a->question->qPart ?? 99)->values();

        if ($writingAnswers->isEmpty()) return null;

        $taskScores  = [];
        $raw         = $this->decodeGeminiField($submission);
        $rawResults  = $raw['writing_results'] ?? [];

        foreach ($writingAnswers as $answer) {
            $taskNum    = (int) ($answer->question->qPart ?? ($writingAnswers->search($answer) + 1));
            $taskPrompt = strip_tags($answer->question->qContent ?? '');
            $response   = trim($answer->saAnswer_text ?? '');

            if (mb_strlen($response) < 20) {
                $answer->update([
                    'saAi_score'      => 0,
                    'saAi_feedback'   => 'Bài viết quá ngắn hoặc bỏ trống.',
                    'saAi_criteria'   => [],
                    'saAi_model'      => env('GROQ_MODEL', 'openai/gpt-oss-120b'),
                    'saAi_graded_at'  => now(),
                    'saReview_status' => 'pending',
                    // ⚠️ Đồng bộ saPoints_awarded để FE result page (đọc cột này
                    // qua `wTasks[part] = saPoints_awarded`) hiển thị điểm Task 1/2.
                    'saPoints_awarded' => 0,
                ]);
                $taskScores[] = 0;
                $rawResults["task_{$taskNum}"] = ['score' => 0, 'criteria' => [], 'feedback' => 'Bài viết quá ngắn hoặc bỏ trống.'];
                continue;
            }

            $result = $this->gradeWritingTask($taskNum, $taskPrompt, $response);
            $score  = $result['score'];
            $answer->update([
                'saAi_score'      => $score,
                'saAi_feedback'   => $result['feedback'] ?? '',
                'saAi_criteria'   => [
                    'criteria'           => $result['criteria'] ?? [],
                    'criterion_comments' => $result['criterion_comments'] ?? [],
                    'suggestions'        => $result['suggestions'] ?? [],
                ],
                'saAi_model'      => env('GROQ_MODEL', 'openai/gpt-oss-120b'),
                'saAi_graded_at'  => now(),
                'saReview_status' => 'pending',
                // ⚠️ Đồng bộ saPoints_awarded để FE đọc đúng điểm per-task.
                'saPoints_awarded' => $score,
            ]);

            // Audit log
            \App\Models\GradingHistory::create([
                'submission_id' => $submission->sId,
                'answer_id'     => $answer->saId,
                'ghAction'      => \App\Models\GradingHistory::ACTION_AI_GRADE,
                'ghActor_id'    => null,
                'ghNew_score'   => $score,
                'ghMetadata'    => ['model' => env('GROQ_MODEL', 'openai/gpt-oss-120b'), 'task' => $taskNum],
            ]);

            $taskScores[] = $score;
            $rawResults["task_{$taskNum}"] = $result;
            Log::info("VstepGrading writing task {$taskNum}: score={$score}", $result);
        }

        // Persist detailed results back to sGemini_feedback
        $raw['writing_results'] = $rawResults;
        $submission->update(['sGemini_feedback' => json_encode($raw)]);

        return count($taskScores) > 0
            ? round(array_sum($taskScores) / count($taskScores), 2)
            : null;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  SPEAKING  (Whisper pronunciation 35% + Groq LLM content 65%)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Grade speaking parts using Groq Whisper + LLM scoring.
     *
     * Per part:
     *   1. Groq Whisper  → transcript text + pronunciation signals
     *   2. Whisper signals → Pronunciation score (Accuracy, Fluency, Clarity → /10)
     *   3. Groq LLM      → Content evaluation (Coherence, Vocabulary, Grammar → /10)
     *   4. Part score    = 0.35 × pronunciation + 0.65 × groq_content
     *
     * Returns overall Speaking score 0-10.
     */
    public function gradeSpeaking(Submission $submission): ?float
    {
        $raw       = $this->decodeGeminiField($submission);
        $audioUrls = $raw['speaking_audio'] ?? [];

        if (empty($audioUrls)) return null;

        $partScores    = [];
        $speakingResults = $raw['speaking_results'] ?? [];

        foreach ($audioUrls as $partNum => $audioUrl) {
            $audioUrl = (string) $audioUrl;

            // Step 1: Groq Whisper verbose_json → transcript + pronunciation signals
            $whisper = $this->transcribeWithGroqWhisperVerbose($audioUrl);
            if (!$whisper || empty($whisper['text'])) {
                Log::warning("VstepGrading: no transcript for part {$partNum}, submission {$submission->sId}");
                $partScores[] = 0;
                $speakingResults["part_{$partNum}"] = ['score' => 0, 'criteria' => [], 'feedback' => 'Không có bài ghi âm hoặc không nhận diện được giọng nói.', 'suggestions' => []];
                continue;
            }

            // Step 2: Pronunciation score derived from Whisper signals (0-10)
            $pronunciationScore = $this->computePronunciationScore($whisper);

            // Step 3: Extract question context for this part from exam
            $questionContext = $this->extractSpeakingContext($submission, (int) $partNum);

            // Step 4: Groq LLM content evaluation (returns full result)
            $contentResult = $this->gradeSpeakingTranscript((int) $partNum, $whisper['text'], $questionContext);
            $contentScore  = $contentResult['score'] ?? 5.0;

            // Step 5: 35% pronunciation (Whisper signals) + 65% content (Groq LLM)
            $combined = round(0.35 * $pronunciationScore + 0.65 * $contentScore, 2);
            Log::info("VstepGrading speaking part {$partNum}: pronunciation={$pronunciationScore}, content={$contentScore}, combined={$combined}");

            $partScores[] = $combined;
            $speakingResults["part_{$partNum}"] = array_merge($contentResult, [
                'score'              => $combined,
                'pronunciation_score' => $pronunciationScore,
                'content_score'       => $contentScore,
                'transcript'          => $whisper['text'],
            ]);

            // Also update the SubmissionAnswer row with the AI-graded result
            $speakingQuestion = \App\Models\Question::where('exam_id', $submission->exam_id)
                ->where(function($query) {
                    $query->whereRaw('LOWER(qSkill) = ?', ['speaking'])
                          ->orWhereRaw('LOWER(qSection) = ?', ['speaking']);
                })
                ->where('qPart', (int) $partNum)
                ->first();
                
            if ($speakingQuestion) {
                $speakingAnswer = \App\Models\SubmissionAnswer::where('submission_id', $submission->sId)
                    ->where('question_id', $speakingQuestion->qId)
                    ->first();
                
                if ($speakingAnswer) {
                    $speakingAnswer->update([
                        'saAi_score'      => $combined,
                        'saAi_feedback'   => $contentResult['feedback'] ?? '',
                        'saAi_criteria'   => [
                            'criteria'           => $contentResult['criteria'] ?? [],
                            'criterion_comments' => $contentResult['criterion_comments'] ?? [],
                            'suggestions'        => $contentResult['suggestions'] ?? [],
                        ],
                        'saAi_model'      => 'openai/gpt-oss-120b + whisper-large-v3-turbo',
                        'saAi_graded_at'  => now(),
                        'saReview_status' => 'pending',
                        // ⚠️ Đồng bộ saPoints_awarded để FE đọc đúng điểm per-part.
                        'saPoints_awarded' => $combined,
                    ]);
                }
            }
        }

        // Persist detailed results back to sGemini_feedback
        $raw['speaking_results'] = $speakingResults;
        $submission->update(['sGemini_feedback' => json_encode($raw)]);

        return count($partScores) > 0
            ? round(array_sum($partScores) / count($partScores), 2)
            : null;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  UPDATE SUBMISSION  (merge new scores, recompute overall, update status)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Chấm MỘT bài nói độc lập (dùng cho đề THPT/tổng hợp có phần Nói).
     * Trả: ['score','pronunciation_score','content_score','transcript','feedback','criteria','suggestions'].
     */
    public function gradeSpeakingAudio(string $audioUrl, string $context = '', int $partNum = 1): array
    {
        $whisper = $this->transcribeWithGroqWhisperVerbose($audioUrl);
        $rawText = trim((string) ($whisper['text'] ?? ''));
        // Đếm số "từ" thực (chữ cái/số) — loại dấu câu, khoảng trắng. "." hay "..." → 0 từ.
        $wordCount = $rawText === '' ? 0 : (int) preg_match_all('/[\p{L}\p{N}]+/u', $rawText);
        if (!$whisper || $wordCount < 2) {
            return [
                'score' => 0.0, 'pronunciation_score' => 0.0, 'content_score' => 0.0,
                'transcript' => $rawText,
                'feedback' => 'Không nhận diện được giọng nói trong bản ghi — có thể bạn chưa nói, nói quá nhỏ, hoặc micro không thu được âm. Hãy ghi âm lại và nói to, rõ ràng nhé.',
                'criteria' => [],
                'suggestions' => [
                    'Kiểm tra micro và môi trường yên tĩnh trước khi ghi âm.',
                    'Bắt đầu nói ngay khi bắt đầu ghi âm và trả lời đầy đủ câu hỏi.',
                ],
            ];
        }
        $pronunciation = $this->computePronunciationScore($whisper);
        $content       = $this->gradeSpeakingTranscript($partNum, $whisper['text'], $context);
        $contentScore  = $content['score'] ?? 5.0;
        $combined      = round(0.35 * $pronunciation + 0.65 * $contentScore, 2);
        return array_merge($content, [
            'score'               => $combined,
            'pronunciation_score' => $pronunciation,
            'content_score'       => $contentScore,
            'transcript'          => $whisper['text'],
        ]);
    }

    public function updateSubmission(Submission $submission, ?float $writingScore, ?float $speakingScore): void
    {
        $raw         = $this->decodeGeminiField($submission);
        $vstepScores = $raw['vstep_scores'] ?? [];

        if (!is_null($writingScore))  $vstepScores['writing']  = $writingScore;
        if (!is_null($speakingScore)) $vstepScores['speaking'] = $speakingScore;

        $raw['vstep_scores'] = $vstepScores;

        // Recompute overall on all four skills
        $available = array_filter([
            $vstepScores['listening'] ?? null,
            $vstepScores['reading']   ?? null,
            $vstepScores['writing']   ?? null,
            $vstepScores['speaking']  ?? null,
        ], fn($v) => !is_null($v));

        $overallAvg = count($available) > 0
            ? round(array_sum($available) / count($available), 2)
            : null;

        $updateData = ['sGemini_feedback' => json_encode($raw)];

        if (!is_null($overallAvg)) {
            $updateData['sScore'] = round($overallAvg * 10, 2);
        }

        // Mark graded only when W+S are resolved (scored or not submittable)
        $pendingW = is_null($vstepScores['writing']  ?? null) && $this->hasWritingAnswers($submission);
        $pendingS = is_null($vstepScores['speaking'] ?? null) && $this->hasSpeakingAudio($submission);

        if (!$pendingW && !$pendingS) {
            $updateData['sStatus']       = 'graded';
            $updateData['sGraded_time']  = now();
        }

        $submission->update($updateData);

        // Push notification khi chấm xong
        if (!$pendingW && !$pendingS) {
            try {
                $examTitle = optional($submission->exam)->eTitle ?? 'Bài thi VSTEP';
                (new PushNotificationService())->sendToUser(
                    (int) $submission->user_id,
                    '✅ Bài thi đã có điểm',
                    $examTitle . ' · Xem kết quả ngay',
                    ['url' => '/hoc-vien/ket-qua/' . $submission->sId]
                );
            } catch (\Exception $e) {
                Log::warning('[Push] VSTEP grading push failed: ' . $e->getMessage());
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════════════
    //  PRIVATE: Groq LLM — Writing grading
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Public wrapper for grading a single writing task.
     * Used by GradingReviewService when teacher requests regrade of one answer.
     */
    public function gradeSingleWritingTask(int $taskNum, string $taskPrompt, string $studentResponse): array
    {
        return $this->gradeWritingTask($taskNum, $taskPrompt, $studentResponse);
    }

    private function gradeWritingTask(int $taskNum, string $taskPrompt, string $studentResponse): array
    {
        $criteriaNames = $taskNum === 1
            ? ['Task Achievement', 'Coherence & Cohesion', 'Lexical Resource', 'Grammatical Range & Accuracy']
            : ['Task Response',    'Coherence & Cohesion', 'Lexical Resource', 'Grammatical Range & Accuracy'];

        $taskDesc = $taskNum === 1
            ? "an informal/semi-formal email or letter (~120 words)"
            : "an argumentative or discursive essay (~250+ words)";

        $c1Guide = $taskNum === 1
            ? "Task Achievement: Does the response address ALL bullet points in the prompt? Appropriate register (formal/informal)? Correct length (~120 words)?\n  9-10=all points addressed, perfect register & length; 7-8=mostly addressed, minor gaps; 5-6=some points missing or wrong register; 3-4=major omissions; 0-2=off-topic."
            : "Task Response: Does the essay directly answer the prompt? Is the position/argument clear and sustained throughout? Are ideas developed with specific examples and reasons?\n  9-10=fully answers, well-argued with strong examples; 7-8=mostly answered, adequate support; 5-6=partially answers, limited development; 3-4=tangential or position unclear; 0-2=off-topic.";

        $criteriaGuide = "
- {$c1Guide}
- Coherence & Cohesion (Bố cục & Mạch lạc): Is the response logically organised with a clear opening/body/closing? Are cohesive devices (however, therefore, in addition, etc.) used accurately and appropriately? Does each paragraph have a clear main idea?
  9-10=flawless organisation, varied and accurate linking; 7-8=clear structure, mostly appropriate linking; 5-6=some structure but linking is mechanical or repetitive; 3-4=difficult to follow, poor linking; 0-2=no discernible organisation.
- Lexical Resource (Từ vựng): Range, precision, and naturalness of vocabulary? Accurate use of collocations and word forms? Spelling errors?
  9-10=sophisticated and accurate, near-native collocations; 7-8=good range with minor errors; 5-6=adequate but repetitive or imprecise; 3-4=limited and frequent errors; 0-2=very poor.
- Grammatical Range & Accuracy (Ngữ pháp): Variety of grammatical structures (complex, compound, passive, conditionals)? Proportion of error-free sentences?
  9-10=wide range, nearly all sentences error-free; 7-8=mix of complex structures, occasional errors; 5-6=mainly simple structures, noticeable errors; 3-4=frequent errors impede meaning; 0-2=very poor.";

        $system = <<<PROMPT
You are a strict and calibrated VSTEP B1/B2 Writing examiner grading Task {$taskNum} ({$taskDesc}).

SCORING SCALE (0–10, 1 decimal):
  0–2 = Inadequate / incomprehensible
  3–4 = Below standard, major problems
  5–6 = Basic / approaching standard (VSTEP B1 borderline)
  7–8 = Competent (VSTEP B1–B2)
  9–10 = Excellent (VSTEP B2+, near native)

LANGUAGE RULE (MANDATORY):
- All explanations and feedback narrative MUST be in Vietnamese.
- You MAY keep English for: vocabulary examples (e.g. 'outgoing', 'cohesive devices'), grammar terms (e.g. 'passive voice', 'relative clause'), direct quotes from the student's text, and suggested English rewrites/alternatives.
- Do NOT write full English sentences as explanations. The connecting text must be Vietnamese.

IMPORTANT ANTI-INFLATION RULES:
- Most B1/B2 exam candidates score 5–7. A score of 9+ is RARE and requires near-perfect writing.
- Do NOT inflate scores. If the response has any significant errors, cap the criterion at 8.
- Check specifically for: missing prompt points, wrong register, repetitive vocabulary, grammar errors, weak cohesion, underdeveloped arguments.
- The overall score is the ARITHMETIC MEAN of the 4 criteria (do NOT round up).

CRITERIA RUBRICS:{$criteriaGuide}

OUTPUT FORMAT — respond ONLY with valid JSON (no markdown, no extra text):
{
  "criteria": {"c1": 0.0, "c2": 0.0, "c3": 0.0, "c4": 0.0},
  "overall": 0.0,
  "criterion_comments": {
    "c1": "1-2 câu nhận xét cụ thể về tiêu chí 1, trích dẫn câu/cụm từ thực tế trong bài nếu có",
    "c2": "1-2 câu về bố cục, cấu trúc đoạn văn, từ nối",
    "c3": "1-2 câu về từ vựng, chỉ ra từ dùng tốt hoặc cần thay",
    "c4": "1-2 câu về ngữ pháp, chỉ ra cấu trúc nổi bật hoặc lỗi cụ thể"
  },
  "brief_feedback": "2-3 câu tổng quan điểm mạnh và yếu chính bằng tiếng Việt",
  "suggestions": [
    "Gợi ý 1: nêu vấn đề cụ thể + ví dụ cách viết lại (bằng tiếng Việt)",
    "Gợi ý 2: nêu vấn đề cụ thể + ví dụ cách viết lại",
    "Gợi ý 3: nêu vấn đề cụ thể + ví dụ cách viết lại"
  ]
}
PROMPT;

        $user = "Task {$taskNum} prompt:\n{$taskPrompt}\n\nStudent response:\n{$studentResponse}";

        $context = "writing task {$taskNum}";
        $result  = $this->callGroqLLMFull($system, $user, $context, 900);

        // Retry once if criteria is missing (rate limit / truncation)
        if (empty($result['criteria'])) {
            Log::info("VstepGrading: retrying {$context} (missing criteria)");
            sleep(2);
            $result = $this->callGroqLLMFull($system, $user, $context, 900);
        }

        $score  = max(0.0, min(10.0, (float) ($result['overall'] ?? 5.0)));
        $criteria = [];
        $criterionComments = [];
        $rawComments = $result['criterion_comments'] ?? [];
        if (isset($result['criteria']) && is_array($result['criteria'])) {
            $vals = array_values($result['criteria']);
            $commentVals = array_values((array) $rawComments);
            foreach ($criteriaNames as $i => $name) {
                $criteria[$name] = isset($vals[$i]) ? round((float) $vals[$i], 1) : null;
                $criterionComments[$name] = $commentVals[$i] ?? null;
            }
        }
        return [
            'score'              => round($score, 2),
            'criteria'           => $criteria,
            'criterion_comments' => $criterionComments,
            'feedback'           => $result['brief_feedback'] ?? '',
            'suggestions'        => array_values(array_filter($result['suggestions'] ?? [])),
        ];
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PRIVATE: Groq Whisper verbose_json — transcription + signals
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Transcribe audio and return rich Whisper data:
     *   text          – full transcript
     *   avg_logprob   – average log-probability across segments (proxy for clarity/accuracy)
     *   duration      – total audio duration in seconds
     *   word_count    – number of words
     *   speech_rate   – words per minute
     *   no_speech_avg – average no-speech probability (silence/noise ratio)
     */
    private function transcribeWithGroqWhisperVerbose(string $audioUrl): ?array
    {
        $apiKey = config('services.groq.api_key');
        if (!$apiKey) {
            Log::warning('VSTEP grading: GROQ_API_KEY not set, skipping transcription.');
            return null;
        }

        try {
            $audioBytes = @file_get_contents($audioUrl);
            if (!$audioBytes) {
                Log::warning("VSTEP grading: could not fetch audio from {$audioUrl}");
                return null;
            }

            $tmpPath = tempnam(sys_get_temp_dir(), 'vstep_audio_') . '.webm';
            file_put_contents($tmpPath, $audioBytes);

            $response = $this->http->post(self::WHISPER_URL, [
                'headers'   => ['Authorization' => "Bearer {$apiKey}"],
                'multipart' => [
                    ['name' => 'file',            'contents' => fopen($tmpPath, 'r'), 'filename' => 'audio.webm'],
                    ['name' => 'model',           'contents' => self::WHISPER_MODEL],
                    ['name' => 'language',        'contents' => 'en'],
                    ['name' => 'response_format', 'contents' => 'verbose_json'],
                    ['name' => 'timestamp_granularities[]', 'contents' => 'segment'],
                ],
            ]);

            @unlink($tmpPath);

            $body = json_decode($response->getBody()->getContents(), true);
            $text = trim($body['text'] ?? '');
            if ($text === '') return null;

            $segments   = $body['segments'] ?? [];
            $duration   = (float) ($body['duration'] ?? 0);
            $wordCount  = str_word_count($text);
            $speechRate = $duration > 0 ? round($wordCount / ($duration / 60), 1) : 0;

            // Aggregate avg_logprob and no_speech_prob across segments
            $logProbs    = array_column($segments, 'avg_logprob');
            $noSpeech    = array_column($segments, 'no_speech_prob');
            $avgLogProb  = count($logProbs)  > 0 ? array_sum($logProbs)  / count($logProbs)  : -0.5;
            $avgNoSpeech = count($noSpeech) > 0 ? array_sum($noSpeech) / count($noSpeech) : 0.5;

            return [
                'text'          => $text,
                'avg_logprob'   => $avgLogProb,
                'duration'      => $duration,
                'word_count'    => $wordCount,
                'speech_rate'   => $speechRate,
                'no_speech_avg' => $avgNoSpeech,
            ];

        } catch (\Exception $e) {
            Log::error('Groq Whisper verbose transcription error: ' . $e->getMessage());
            return null;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PRIVATE: Compute pronunciation score from Whisper signals (0-10)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Derives a pronunciation/fluency score purely from Whisper metadata:
     *
     *  - avg_logprob  → Accuracy proxy  (range −1→0 mapped to 0→10)
     *  - speech_rate  → Fluency proxy   (ideal VSTEP: 100-150 wpm)
     *  - no_speech    → Clarity penalty (high silence = hesitation)
     *
     * Final = 0.5 × accuracy + 0.3 × fluency + 0.2 × clarity
     */
    private function computePronunciationScore(array $whisper): float
    {
        // 1. Accuracy from avg_logprob: [-1.0, 0.0] → [0, 10]
        $logProb  = max(-1.0, min(0.0, (float) ($whisper['avg_logprob'] ?? -0.5)));
        $accuracy = ($logProb + 1.0) * 10.0;

        // 2. Fluency from speech rate (words per minute)
        //    Ideal range for VSTEP B1-B2: 100-150 wpm
        $wpm = (float) ($whisper['speech_rate'] ?? 0);
        if ($wpm <= 0) {
            $fluency = 0;
        } elseif ($wpm < 60) {
            $fluency = ($wpm / 60) * 5;          // too slow
        } elseif ($wpm <= 150) {
            $fluency = 5 + (($wpm - 60) / 90) * 5; // ramp 60→150 wpm to 5→10
        } else {
            $fluency = max(5, 10 - (($wpm - 150) / 50)); // too fast → slight penalty
        }

        // 3. Clarity from no_speech_prob (silence/noise)
        //    0.0 = all speech (perfect), 1.0 = all silence
        $noSpeech = max(0.0, min(1.0, (float) ($whisper['no_speech_avg'] ?? 0.5)));
        $clarity  = (1.0 - $noSpeech) * 10.0;

        $score = 0.5 * $accuracy + 0.3 * $fluency + 0.2 * $clarity;

        Log::info("Whisper pronunciation signals: logprob={$logProb} acc={$accuracy}, wpm={$wpm} flu={$fluency}, noSpeech={$noSpeech} cla={$clarity} → {$score}");

        return round(max(0.0, min(10.0, $score)), 2);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PRIVATE: Groq LLM — Speaking evaluation (from transcript)
    // ═══════════════════════════════════════════════════════════════════════

    private function gradeSpeakingTranscript(int $partNum, string $transcript, string $questionContext = ''): array
    {
        $rubrics = [
            1 => [
                'desc'         => 'Social Interaction (Part 1) — candidate answers examiner questions on familiar topics.',
                'criteriaNames' => ['Communicative Effectiveness', 'Fluency & Pronunciation', 'Lexical Resource', 'Grammatical Range & Accuracy'],
                'criteriaGuide' => "
- Communicative Effectiveness: Trả lời đầy đủ các câu hỏi? Phù hợp ngữ cảnh? Tương tác tự nhiên?\n  9-10=hoàn toàn đáp ứng; 7-8=phần lớn; 5-6=một phần; 3-4=thiếu nhiều; 0-2=không liên quan.
- Fluency & Pronunciation: Lưu loát? Ít ngập ngừng? Phát âm rõ ràng?\n  9-10=rất lưu loát, phát âm chuẩn; 7-8=khá tốt; 5-6=đôi chỗ ngập ngừng; 3-4=thường xuyên ngập ngừng; 0-2=rất khó hiểu.
- Lexical Resource: Dùng từ vựng đa dạng và chính xác cho chủ đề thường ngày?\n  9-10=phong phú, tự nhiên; 7-8=đủ dùng; 5-6=hạn chế nhưng chấp nhận; 3-4=nghèo nàn; 0-2=không đánh giá được.
- Grammatical Range & Accuracy: Dùng cấu trúc câu đa dạng? Tỉ lệ lỗi ngữ pháp?\n  9-10=đa dạng, ít lỗi; 7-8=tạm ổn; 5-6=câu đơn giản, lỗi rõ; 3-4=nhiều lỗi; 0-2=không đánh giá được.",
            ],
            2 => [
                'desc'         => 'Solution Discussion (Part 2) — candidate evaluates three options and justifies a choice.',
                'criteriaNames' => ['Task Completion', 'Coherence & Organisation', 'Lexical Resource', 'Grammatical Range & Accuracy'],
                'criteriaGuide' => "
- Task Completion: Thảo luận đủ 3 phương án? Đưa ra lựa chọn có lý do thuyết phục?\n  9-10=đủ cả 3 phương án, lý do rõ; 7-8=đủ nhưng lý do mỏng; 5-6=thiếu 1 phương án; 3-4=thiếu nhiều; 0-2=lạc đề.
- Coherence & Organisation: Trình bày logic, có từ nối?\n  9-10=rất mạch lạc; 7-8=khá rõ ràng; 5-6=đôi chỗ lộn xộn; 3-4=khó theo; 0-2=không có tổ chức.
- Lexical Resource: Từ vựng đánh giá và lập luận ('on the other hand', 'I would recommend', ...) ?\n  9-10=đa dạng và chính xác; 7-8=khá tốt; 5-6=hạn chế; 3-4=rất ít; 0-2=không đánh giá được.
- Grammatical Range & Accuracy: Cấu trúc câu đa dạng? Tỉ lệ lỗi?\n  9-10=đa dạng, ít lỗi; 7-8=tạm ổn; 5-6=đơn giản, lỗi rõ; 3-4=nhiều lỗi; 0-2=không đánh giá được.",
            ],
            3 => [
                'desc'         => 'Topic Development (Part 3) — candidate develops a topic for ~2 minutes and responds to follow-up questions.',
                'criteriaNames' => ['Content Development', 'Coherence & Organisation', 'Lexical Resource', 'Grammatical Range & Accuracy'],
                'criteriaGuide' => "
- Content Development: Triển khai chủ đề với ví dụ và chi tiết cụ thể?\n  9-10=phong phú, có ví dụ; 7-8=đủ ý; 5-6=ít ý; 3-4=rất sơ sài; 0-2=lạc đề.
- Coherence & Organisation: Có mở đầu/thân bài/kết luận rõ ràng? Dùng từ nối tốt?\n  9-10=rất mạch lạc; 7-8=khá rõ; 5-6=đôi chỗ lộn; 3-4=khó theo; 0-2=không có cấu trúc.
- Lexical Resource: Từ vựng chuyên đề và trừu tượng?\n  9-10=phong phú, chính xác; 7-8=đủ dùng; 5-6=hạn chế; 3-4=rất ít; 0-2=không đánh giá được.
- Grammatical Range & Accuracy: Dùng cấu trúc phức? Tỉ lệ câu không lỗi?\n  9-10=đa dạng, chuẩn; 7-8=tạm ổn; 5-6=đơn giản, lỗi rõ; 3-4=nhiều lỗi; 0-2=không đánh giá được.",
            ],
        ];
        $r             = $rubrics[$partNum] ?? $rubrics[1];
        $criteriaNames = $r['criteriaNames'];
        $ctx           = $questionContext ? "\n\nExam questions / prompt given to the candidate:\n{$questionContext}" : '';

        $system = <<<PROMPT
You are a certified VSTEP B1/B2 Speaking examiner grading Part {$partNum}: {$r['desc']}

LANGUAGE RULE (MANDATORY):
- All explanations in criterion_comments, brief_feedback, and suggestions MUST be in Vietnamese.
- You MAY keep English for: quoted words from the transcript, vocabulary examples, grammar terms, suggested rewrites.

SCORING SCALE (0–10, 1 decimal): 0–2=Inadequate; 3–4=Below standard; 5–6=Basic; 7–8=Competent; 9–10=Excellent.
ANTI-INFLATION: Most B1/B2 candidates score 5–7. Score 9+ is RARE. overall = ARITHMETIC MEAN of 4 criteria.

CRITERIA RUBRICS:{$r['criteriaGuide']}

OUTPUT FORMAT — respond ONLY with valid JSON (no markdown, no extra text):
{
  "criteria": {"c1": 0.0, "c2": 0.0, "c3": 0.0, "c4": 0.0},
  "overall": 0.0,
  "criterion_comments": {
    "c1": "1-2 câu nhận xét cụ thể, trích dẫn từ/cụm từ từ transcript nếu có",
    "c2": "1-2 câu về mạch lạc, tổ chức",
    "c3": "1-2 câu về từ vựng, chỉ ra từ tốt hoặc cần cải thiện",
    "c4": "1-2 câu về ngữ pháp, cấu trúc câu"
  },
  "brief_feedback": "2-3 câu tổng quan điểm mạnh và yếu bằng tiếng Việt",
  "suggestions": [
    "Gợi ý 1 + ví dụ cụ thể bằng tiếng Việt",
    "Gợi ý 2 + ví dụ cụ thể",
    "Gợi ý 3 + ví dụ cụ thể"
  ]
}
PROMPT;

        $user   = "Part {$partNum} transcript (auto-generated from audio):{$ctx}\n\nTranscript:\n{$transcript}";
        $result = $this->callGroqLLMFull($system, $user, "speaking part {$partNum}", 700);

        $score    = max(0.0, min(10.0, (float) ($result['overall'] ?? 5.0)));
        $criteria = [];
        $criterionComments = [];
        if (isset($result['criteria']) && is_array($result['criteria'])) {
            $vals        = array_values($result['criteria']);
            $commentVals = array_values((array) ($result['criterion_comments'] ?? []));
            foreach ($criteriaNames as $i => $name) {
                $criteria[$name]           = isset($vals[$i]) ? round((float) $vals[$i], 1) : null;
                $criterionComments[$name]  = $commentVals[$i] ?? null;
            }
        }
        return [
            'score'              => round($score, 2),
            'criteria'           => $criteria,
            'criterion_comments' => $criterionComments,
            'feedback'           => $result['brief_feedback'] ?? '',
            'suggestions'        => array_values(array_filter($result['suggestions'] ?? [])),
        ];
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PRIVATE: Extract speaking question context from exam for a given part
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Builds a plain-text summary of what was asked in Speaking Part N.
     * Loads from sGemini_feedback (stored during exam creation) or falls back
     * to the submission answers' question content.
     */
    private function extractSpeakingContext(Submission $submission, int $partNum): string
    {
        // Try sGemini_feedback first — stores full speaking structure
        $raw     = $this->decodeGeminiField($submission);
        $spParts = $raw['speaking_parts'] ?? [];
        foreach ($spParts as $p) {
            if ((int) ($p['partNumber'] ?? 0) === $partNum) {
                return $this->flattenSpeakingPartContext($p, $partNum);
            }
        }

        // Fallback: load speaking questions from exam by qSection + qPart
        $examQuestions = $submission->exam->questions ?? collect();
        $partQs = $examQuestions->filter(function ($q) use ($partNum) {
            return strtolower($q->qSection ?? '') === 'speaking'
                && (int) ($q->qPart ?? 0) === $partNum;
        })->values();

        if ($partQs->isEmpty()) return '';

        return $partQs->map(fn($q) => '- ' . strip_tags($q->qContent ?? ''))->implode("\n");
    }

    private function flattenSpeakingPartContext(array $part, int $partNum): string
    {
        $lines = [];
        if ($partNum === 1 && isset($part['part1Data'])) {
            foreach ($part['part1Data'] as $topic) {
                $lines[] = 'Topic: ' . ($topic['topicName'] ?? '');
                foreach ($topic['questions'] ?? [] as $q) {
                    $lines[] = '- ' . (is_string($q) ? $q : ($q['questionText'] ?? ''));
                }
            }
        } elseif ($partNum === 2 && isset($part['part2Data'])) {
            $p2 = $part['part2Data'];
            $lines[] = 'Situation: ' . ($p2['situation'] ?? '');
            foreach ($p2['solutions'] ?? [] as $i => $s) {
                $lines[] = 'Option ' . ($i + 1) . ': ' . $s;
            }
            $lines[] = 'Question: ' . ($p2['question'] ?? '');
        } elseif ($partNum === 3 && isset($part['part3Data'])) {
            $p3 = $part['part3Data'];
            $lines[] = 'Main topic: ' . ($p3['mainTopic'] ?? '');
            foreach ($p3['suggestedIdeas'] ?? [] as $idea) {
                $lines[] = 'Idea: ' . $idea;
            }
            foreach ($p3['followUpQuestions'] ?? [] as $fq) {
                $lines[] = 'Follow-up: ' . $fq;
            }
        }
        return implode("\n", array_filter($lines));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PRIVATE: Shared Groq LLM POST helper
    // ═══════════════════════════════════════════════════════════════════════

    private function callGroqLLM(string $system, string $user, string $context): float
    {
        $result = $this->callGroqLLMFull($system, $user, $context);
        return max(0.0, min(10.0, (float) ($result['overall'] ?? 5.0)));
    }

    private function callGroqLLMFull(string $system, string $user, string $context, int $maxTokens = 500): array
    {
        $apiKey = config('services.groq.api_key');
        $model  = config('services.groq.model', 'openai/gpt-oss-120b');

        if (!$apiKey) {
            Log::warning("VSTEP grading: GROQ_API_KEY not set for {$context}, returning default.");
            return ['overall' => 5.0];
        }

        try {
            $response = $this->http->post(self::LLM_URL, [
                'headers' => [
                    'Authorization' => "Bearer {$apiKey}",
                    'Content-Type'  => 'application/json',
                ],
                'json' => [
                    'model'       => $model,
                    'messages'    => [
                        ['role' => 'system', 'content' => $system],
                        ['role' => 'user',   'content' => $user],
                    ],
                    'temperature' => 0.2,
                    'max_tokens'  => $maxTokens,
                ],
            ]);

            $body    = json_decode($response->getBody()->getContents(), true);
            $content = $body['choices'][0]['message']['content'] ?? '{}';
            Log::debug("Groq LLM raw ({$context}): " . substr($content, 0, 300));

            preg_match('/\{[\s\S]*\}/', $content, $matches);
            $parsed = isset($matches[0]) ? json_decode($matches[0], true) : null;
            return is_array($parsed) ? $parsed : [];

        } catch (\Exception $e) {
            Log::error("Groq LLM grading failed ({$context}): " . $e->getMessage());
            return ['overall' => 5.0];
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PRIVATE: helpers
    // ═══════════════════════════════════════════════════════════════════════

    private function decodeGeminiField(Submission $submission): array
    {
        if (!$submission->sGemini_feedback) return [];
        return is_array($submission->sGemini_feedback)
            ? $submission->sGemini_feedback
            : (json_decode($submission->sGemini_feedback, true) ?? []);
    }


    private function hasSpeakingAudio(Submission $submission): bool
    {
        $raw = $this->decodeGeminiField($submission);
        return !empty($raw['speaking_audio'] ?? []);
    }
}

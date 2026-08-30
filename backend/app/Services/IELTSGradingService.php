<?php

namespace App\Services;

use App\Models\Submission;
use App\Models\GradingHistory;
use App\Models\SubmissionAnswer;
use App\Models\Question;
use App\Services\PushNotificationService;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;

/**
 * IELTS Subjective Grading Service
 *
 * Writing  → Groq LLM with IELTS rubric (band 0-9, 4 criteria)
 * Speaking → Groq Whisper transcribe → Groq LLM evaluate with IELTS rubric
 *
 * Differences from VstepGradingService:
 *  • Score scale: 0–9 band (steps of 0.5)
 *  • Writing rubric: Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy
 *  • Speaking rubric: Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation
 *  • Overall: average of 4 skill bands → rounded to nearest 0.5
 *
 * Config in .env: GROQ_API_KEY=gsk_...
 */
class IELTSGradingService
{
    private const LLM_URL       = 'https://api.groq.com/openai/v1/chat/completions';
    private const WHISPER_URL   = 'https://api.groq.com/openai/v1/audio/transcriptions';
    private const WHISPER_MODEL = 'whisper-large-v3-turbo';
    private const BAND_MIN      = 0.0;
    private const BAND_MAX      = 9.0;

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
    //  WRITING  (Groq LLM with IELTS Writing rubric)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Grade all writing tasks (Task 1 + Task 2). Returns overall Writing band 0-9.
     * Task 1 carries 1/3 weight, Task 2 carries 2/3 weight (official IELTS weighting).
     */
    public function gradeWriting(Submission $submission): ?float
    {
        $writingAnswers = $submission->answers->filter(function ($a) {
            $sec = strtolower($a->question->qSkill ?? $a->question->qSection ?? '');
            return $sec === 'writing';
        })->sortBy(fn($a) => $a->question->qPart ?? 99)->values();

        if ($writingAnswers->isEmpty()) return null;

        $isAcademic = ($submission->exam->ielts_test_type ?? 'Academic') === 'Academic';
        $taskScores = []; // map taskNum → band
        $raw        = $this->decodeGeminiField($submission);
        $rawResults = $raw['ielts_writing_results'] ?? [];

        foreach ($writingAnswers as $answer) {
            $taskNum    = (int) ($answer->question->qPart ?? 1);
            $taskPrompt = strip_tags($answer->question->qContent ?? '');
            $response   = trim($answer->saAnswer_text ?? '');

            if (mb_strlen($response) < 30) {
                $answer->update([
                    'saAi_score'      => 0,
                    'saAi_feedback'   => 'Bài viết quá ngắn hoặc bỏ trống.',
                    'saAi_criteria'   => [],
                    'saAi_model'      => env('GROQ_MODEL', 'openai/gpt-oss-120b'),
                    'saAi_graded_at'  => now(),
                    'saReview_status' => 'pending',
                ]);
                $taskScores[$taskNum] = 0.0;
                $rawResults["task_{$taskNum}"] = ['band' => 0, 'criteria' => [], 'feedback' => 'Bài viết quá ngắn hoặc bỏ trống.'];
                continue;
            }

            $result = $this->gradeWritingTask($taskNum, $isAcademic, $taskPrompt, $response);
            $band   = $result['band'];

            $answer->update([
                'saAi_score'      => $band,
                'saAi_feedback'   => $result['feedback'] ?? '',
                'saAi_criteria'   => [
                    'criteria'           => $result['criteria'] ?? [],
                    'criterion_comments' => $result['criterion_comments'] ?? [],
                    'suggestions'        => $result['suggestions'] ?? [],
                ],
                'saAi_model'      => env('GROQ_MODEL', 'openai/gpt-oss-120b'),
                'saAi_graded_at'  => now(),
                'saReview_status' => 'pending',
            ]);

            GradingHistory::create([
                'submission_id' => $submission->sId,
                'answer_id'     => $answer->saId,
                'ghAction'      => GradingHistory::ACTION_AI_GRADE,
                'ghActor_id'    => null,
                'ghNew_score'   => $band,
                'ghMetadata'    => [
                    'model' => env('GROQ_MODEL', 'openai/gpt-oss-120b'),
                    'task'  => $taskNum,
                    'type'  => 'IELTS Writing',
                ],
            ]);

            $taskScores[$taskNum] = $band;
            $rawResults["task_{$taskNum}"] = $result;
            Log::info("IELTSGrading writing task {$taskNum}: band={$band}", $result);
        }

        $raw['ielts_writing_results'] = $rawResults;
        $submission->update(['sGemini_feedback' => json_encode($raw)]);

        // Official IELTS weighting: Task 1 = 1/3, Task 2 = 2/3
        $t1 = $taskScores[1] ?? null;
        $t2 = $taskScores[2] ?? null;
        if (is_null($t1) && is_null($t2)) return null;
        if (is_null($t1)) return $this->roundToHalfBand((float) $t2);
        if (is_null($t2)) return $this->roundToHalfBand((float) $t1);
        return $this->roundToHalfBand(($t1 + 2 * $t2) / 3);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  SPEAKING  (Groq Whisper + LLM with IELTS Speaking rubric)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Grade speaking parts. Each part is graded independently, overall is the
     * average across parts (rounded to nearest 0.5).
     */
    public function gradeSpeaking(Submission $submission): ?float
    {
        $raw       = $this->decodeGeminiField($submission);
        $audioUrls = $raw['speaking_audio'] ?? [];

        if (empty($audioUrls)) return null;

        $partBands       = [];
        $speakingResults = $raw['ielts_speaking_results'] ?? [];

        foreach ($audioUrls as $partNum => $audioUrl) {
            $audioUrl = (string) $audioUrl;
            $partNum  = (int) $partNum;

            $whisper = $this->transcribeWithGroqWhisperVerbose($audioUrl);
            if (!$whisper || empty($whisper['text'])) {
                Log::warning("IELTSGrading: no transcript for part {$partNum}, sub {$submission->sId}");
                $partBands[$partNum] = 0.0;
                $speakingResults["part_{$partNum}"] = [
                    'band'        => 0,
                    'criteria'    => [],
                    'feedback'    => 'Không có bài ghi âm hoặc không nhận diện được giọng nói.',
                    'suggestions' => [],
                ];
                continue;
            }

            $pronunciationBand = $this->computePronunciationBand($whisper);
            $questionContext   = $this->extractSpeakingContext($submission, $partNum);
            $contentResult     = $this->gradeSpeakingTranscript($partNum, $whisper['text'], $questionContext);
            $contentBand       = $contentResult['band'] ?? 5.0;

            // 35% pronunciation (Whisper signals) + 65% content (Groq LLM)
            $combined = $this->roundToHalfBand(0.35 * $pronunciationBand + 0.65 * $contentBand);

            Log::info("IELTSGrading speaking part {$partNum}: pron={$pronunciationBand}, content={$contentBand}, combined={$combined}");

            $partBands[$partNum] = $combined;
            $speakingResults["part_{$partNum}"] = array_merge($contentResult, [
                'band'                => $combined,
                'pronunciation_band'  => $pronunciationBand,
                'content_band'        => $contentBand,
                'transcript'          => $whisper['text'],
            ]);

            // Update SubmissionAnswer for the speaking question of this part
            $speakingQuestion = Question::where('exam_id', $submission->exam_id)
                ->where(function ($q) {
                    $q->whereRaw('LOWER(qSkill) = ?', ['speaking'])
                      ->orWhereRaw('LOWER(qSection) = ?', ['speaking']);
                })
                ->where('qPart', $partNum)
                ->first();

            if ($speakingQuestion) {
                $speakingAnswer = SubmissionAnswer::where('submission_id', $submission->sId)
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
                    ]);
                }
            }
        }

        $raw['ielts_speaking_results'] = $speakingResults;
        $submission->update(['sGemini_feedback' => json_encode($raw)]);

        if (empty($partBands)) return null;
        return $this->roundToHalfBand(array_sum($partBands) / count($partBands));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  UPDATE SUBMISSION  (merge new bands, recompute overall)
    // ═══════════════════════════════════════════════════════════════════════

    public function updateSubmission(Submission $submission, ?float $writingBand, ?float $speakingBand): void
    {
        $raw         = $this->decodeGeminiField($submission);
        $ieltsScores = $raw['ielts_scores'] ?? [];

        if (!is_null($writingBand))  $ieltsScores['writing']  = $writingBand;
        if (!is_null($speakingBand)) $ieltsScores['speaking'] = $speakingBand;

        $raw['ielts_scores'] = $ieltsScores;

        // Recompute overall band (average of available 4 skills, rounded to 0.5)
        $available = array_filter([
            $ieltsScores['listening'] ?? null,
            $ieltsScores['reading']   ?? null,
            $ieltsScores['writing']   ?? null,
            $ieltsScores['speaking']  ?? null,
        ], fn($v) => !is_null($v));

        $overallBand = count($available) > 0
            ? $this->roundToHalfBand(array_sum($available) / count($available))
            : null;

        $updateData = ['sGemini_feedback' => json_encode($raw)];

        if (!is_null($overallBand)) {
            // Persist sScore as 0-100 scale (band × 10) for compatibility with existing reporting
            // The IELTS UI re-extracts the band from sGemini_feedback.ielts_scores.
            $updateData['sScore'] = round($overallBand * 10, 2);
        }

        // Mark graded only when W+S are resolved
        $pendingW = is_null($ieltsScores['writing']  ?? null) && $this->hasWritingAnswers($submission);
        $pendingS = is_null($ieltsScores['speaking'] ?? null) && $this->hasSpeakingAudio($submission);

        if (!$pendingW && !$pendingS) {
            $updateData['sStatus']      = 'graded';
            $updateData['sGraded_time'] = now();
        }

        $submission->update($updateData);

        // Push notification khi chấm xong
        if (!$pendingW && !$pendingS) {
            try {
                $examTitle = optional($submission->exam)->eTitle ?? 'Bài thi IELTS';
                (new PushNotificationService())->sendToUser(
                    (int) $submission->user_id,
                    '✅ Bài thi đã có điểm',
                    $examTitle . ' · Xem kết quả ngay',
                    ['url' => '/hoc-vien/ket-qua/' . $submission->sId]
                );
            } catch (\Exception $e) {
                Log::warning('[Push] IELTS grading push failed: ' . $e->getMessage());
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PRIVATE: Groq LLM — Writing grading
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Public wrapper for grading a single writing task.
     * Used by GradingReviewService when teacher requests regrade.
     */
    public function gradeSingleWritingTask(int $taskNum, bool $isAcademic, string $prompt, string $response): array
    {
        return $this->gradeWritingTask($taskNum, $isAcademic, $prompt, $response);
    }

    private function gradeWritingTask(int $taskNum, bool $isAcademic, string $prompt, string $response): array
    {
        // Criterion 1 differs: Task 1 = "Task Achievement", Task 2 = "Task Response"
        $c1Name = $taskNum === 1 ? 'Task Achievement' : 'Task Response';
        $criteriaNames = [
            $c1Name,
            'Coherence and Cohesion',
            'Lexical Resource',
            'Grammatical Range and Accuracy',
        ];

        $taskDescription = $taskNum === 1
            ? ($isAcademic
                ? 'an Academic Task 1 — describing visual information (chart/graph/process/map) in ≥150 words'
                : 'a General Training Task 1 — writing a letter (formal / semi-formal / informal) in ≥150 words')
            : 'a Task 2 essay — discussing/arguing/answering a prompt in ≥250 words';

        $minWords = $taskNum === 1 ? 150 : 250;

        $c1Guide = $taskNum === 1
            ? ($isAcademic
                ? 'Task Achievement: Has the candidate covered all key features of the visual? Identified main trends, comparisons, or stages? Used appropriate overview? Avoided personal opinion? Met the 150-word minimum?'
                : 'Task Achievement: Has the candidate addressed ALL bullet points in the letter prompt? Used appropriate tone (formal/informal)? Followed letter conventions (greeting, closing)? Met the 150-word minimum?')
            : 'Task Response: Has the candidate fully addressed ALL parts of the question? Is the position clear and consistent? Are ideas extended and well-supported with examples? Met the 250-word minimum?';

        $criteriaGuide = "
- {$c1Guide}
  Band 9 = fully covers all requirements with insightful detail; Band 7-8 = covers most points with clear development; Band 5-6 = partially addresses, lacks development; Band 3-4 = limited or off-topic; Band 0-2 = no relevant content.
- Coherence and Cohesion: Logical organization with clear progression. Effective paragraphing. Range of cohesive devices (linkers, referencing) used naturally and accurately.
  Band 9 = effortless cohesion, skilful paragraphing; Band 7-8 = clear progression, varied linking; Band 5-6 = some progression but mechanical or repetitive linking; Band 3-4 = lacks logical sequencing; Band 0-2 = no organization.
- Lexical Resource: Range, accuracy, naturalness of vocabulary. Use of less common items, collocations, idioms. Spelling/word formation accuracy.
  Band 9 = wide, natural, sophisticated; Band 7-8 = sufficient flexibility, occasional inaccuracies; Band 5-6 = adequate but limited or with errors; Band 3-4 = limited and frequent errors; Band 0-2 = very poor.
- Grammatical Range and Accuracy: Range of structures (simple/complex), error rate, control of punctuation.
  Band 9 = wide range, error-free; Band 7-8 = mix of complex structures, occasional errors; Band 5-6 = mix of simple/complex, frequent errors but communication clear; Band 3-4 = limited range, frequent errors that impede; Band 0-2 = cannot use sentences.";

        $system = <<<PROMPT
You are a calibrated IELTS Writing examiner grading {$taskDescription}.

SCORING SCALE — IELTS Band 0-9 (steps of 0.5):
  Band 9 = Expert user — fully operational command, near-native
  Band 7-8 = Good to very good user — operational command, occasional inaccuracies
  Band 5-6 = Modest to competent user — generally effective, noticeable errors
  Band 3-4 = Extremely limited to limited user — frequent breakdowns
  Band 0-2 = Non-user / intermittent

LANGUAGE RULE (MANDATORY):
- All explanations and feedback narrative MUST be in Vietnamese.
- You MAY keep English for: vocabulary examples, grammar terms, direct quotes from the student's text, and suggested English rewrites.
- Do NOT write full English sentences as explanations.

ANTI-INFLATION RULES:
- Most candidates score Band 5-7. Band 8+ is rare and requires near-native proficiency.
- A response under {$minWords} words automatically caps Task Achievement at Band 5.
- If there are noticeable errors, cap the criterion at Band 7.
- The overall band is the ARITHMETIC MEAN of the 4 criteria, then ROUNDED to the nearest 0.5.

CRITERIA RUBRICS:{$criteriaGuide}

OUTPUT FORMAT — respond ONLY with valid JSON (no markdown):
{
  "criteria": {"c1": 0.0, "c2": 0.0, "c3": 0.0, "c4": 0.0},
  "overall": 0.0,
  "criterion_comments": {
    "c1": "1-2 câu nhận xét cụ thể về tiêu chí 1, trích dẫn cụm từ thực tế trong bài",
    "c2": "1-2 câu về bố cục, từ nối",
    "c3": "1-2 câu về từ vựng, chỉ ra từ tốt hoặc cần thay",
    "c4": "1-2 câu về ngữ pháp, ví dụ cấu trúc nổi bật hoặc lỗi cụ thể"
  },
  "brief_feedback": "2-3 câu tổng quan điểm mạnh và yếu chính bằng tiếng Việt",
  "suggestions": [
    "Gợi ý 1: nêu vấn đề cụ thể + ví dụ cách viết lại",
    "Gợi ý 2: nêu vấn đề cụ thể + ví dụ cách viết lại",
    "Gợi ý 3: nêu vấn đề cụ thể + ví dụ cách viết lại"
  ]
}
PROMPT;

        $user    = "Task {$taskNum} prompt:\n{$prompt}\n\nStudent response:\n{$response}";
        $context = "ielts writing task {$taskNum}";
        $result  = $this->callGroqLLM($system, $user, $context, 2500);

        if (empty($result['criteria'])) {
            Log::info("IELTSGrading: retrying {$context} (missing criteria)");
            sleep(2);
            $result = $this->callGroqLLM($system, $user, $context, 2500);
        }

        $band = $this->roundToHalfBand((float) ($result['overall'] ?? 5.0));

        $criteria          = [];
        $criterionComments = [];
        $rawComments       = $result['criterion_comments'] ?? [];
        if (isset($result['criteria']) && is_array($result['criteria'])) {
            $vals        = array_values($result['criteria']);
            $commentVals = array_values((array) $rawComments);
            foreach ($criteriaNames as $i => $name) {
                $criteria[$name]          = isset($vals[$i]) ? $this->roundToHalfBand((float) $vals[$i]) : null;
                $criterionComments[$name] = $commentVals[$i] ?? null;
            }
        }

        return [
            'band'                => $band,
            'criteria'            => $criteria,
            'criterion_comments'  => $criterionComments,
            'feedback'            => $result['brief_feedback'] ?? '',
            'suggestions'         => array_values(array_filter($result['suggestions'] ?? [])),
        ];
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PRIVATE: Speaking grading
    // ═══════════════════════════════════════════════════════════════════════

    private function gradeSpeakingTranscript(int $partNum, string $transcript, string $context): array
    {
        switch ($partNum) {
            case 1:
                $partDescription = 'Part 1 — Introduction & Interview (general questions about familiar topics, ~4-5 min)';
                break;
            case 2:
                $partDescription = 'Part 2 — Long Turn (1-2 min monologue from a cue card, ~3-4 min total)';
                break;
            case 3:
                $partDescription = 'Part 3 — Discussion (two-way discussion of abstract topics related to Part 2, ~4-5 min)';
                break;
            default:
                $partDescription = "Part {$partNum}";
        }

        $criteriaNames = [
            'Fluency and Coherence',
            'Lexical Resource',
            'Grammatical Range and Accuracy',
            'Pronunciation',
        ];

        $criteriaGuide = "
- Fluency and Coherence: Speaks fluently with very occasional repetition or self-correction. Develops topics fully and appropriately. Uses cohesive features effectively.
  Band 9 = fluent and coherent throughout; Band 7-8 = some hesitation but generally fluent; Band 5-6 = noticeable hesitation, sometimes loses coherence; Band 3-4 = significant hesitation, simple connections; Band 0-2 = cannot communicate.
- Lexical Resource: Uses vocabulary with full flexibility, idioms, and precision. Discusses any topic at length.
  Band 9 = fully natural, idiomatic; Band 7-8 = uses less common items appropriately; Band 5-6 = adequate but limited flexibility; Band 3-4 = simple vocabulary, frequent errors.
- Grammatical Range and Accuracy: Uses a full range of structures naturally. Produces consistently accurate output.
  Band 9 = full range, error-free; Band 7-8 = range of complex structures with occasional errors; Band 5-6 = mix of simple/complex with frequent errors; Band 3-4 = limited structures.
- Pronunciation: Uses a full range of features with precision. Sustains flexible use of features. Easy to understand throughout.
  Band 9 = fully intelligible, native-like; Band 7-8 = wide range of features, occasional issues; Band 5-6 = mixed control, mostly intelligible; Band 3-4 = limited range, mispronunciations frequent.";

        $system = <<<PROMPT
You are an IELTS Speaking examiner grading {$partDescription}.

SCORING SCALE — IELTS Band 0-9 (steps of 0.5):
  Band 9 = Expert user; Band 7-8 = Good user; Band 5-6 = Modest user; Band 3-4 = Limited user

LANGUAGE RULE (MANDATORY):
- All explanations and feedback narrative MUST be in Vietnamese.
- Direct quotes from transcript and English vocab/grammar examples are allowed.

ANTI-INFLATION:
- Most candidates score Band 5-7. Band 8+ requires near-native fluency.
- If transcript shows hesitation, simple vocabulary, or grammar errors, cap relevant criterion at Band 7.
- Overall band = ARITHMETIC MEAN of 4 criteria, ROUNDED to nearest 0.5.

CRITERIA RUBRICS:{$criteriaGuide}

OUTPUT — JSON only:
{
  "criteria": {"c1": 0.0, "c2": 0.0, "c3": 0.0, "c4": 0.0},
  "overall": 0.0,
  "criterion_comments": {
    "c1": "Tiếng Việt: nhận xét fluency với ví dụ trích từ transcript",
    "c2": "Tiếng Việt: nhận xét vocabulary",
    "c3": "Tiếng Việt: nhận xét grammar",
    "c4": "Tiếng Việt: nhận xét pronunciation (dựa trên các tín hiệu trong transcript)"
  },
  "brief_feedback": "2-3 câu tổng quan tiếng Việt",
  "suggestions": ["Gợi ý 1", "Gợi ý 2", "Gợi ý 3"]
}
PROMPT;

        $user = "Question/Topic context:\n{$context}\n\nTranscript:\n{$transcript}";
        $contextLabel = "ielts speaking part {$partNum}";
        $result = $this->callGroqLLM($system, $user, $contextLabel, 900);

        if (empty($result['criteria'])) {
            Log::info("IELTSGrading: retrying {$contextLabel} (missing criteria)");
            sleep(2);
            $result = $this->callGroqLLM($system, $user, $contextLabel, 900);
        }

        $band = $this->roundToHalfBand((float) ($result['overall'] ?? 5.0));

        $criteria          = [];
        $criterionComments = [];
        $rawComments       = $result['criterion_comments'] ?? [];
        if (isset($result['criteria']) && is_array($result['criteria'])) {
            $vals        = array_values($result['criteria']);
            $commentVals = array_values((array) $rawComments);
            foreach ($criteriaNames as $i => $name) {
                $criteria[$name]          = isset($vals[$i]) ? $this->roundToHalfBand((float) $vals[$i]) : null;
                $criterionComments[$name] = $commentVals[$i] ?? null;
            }
        }

        return [
            'band'                => $band,
            'criteria'            => $criteria,
            'criterion_comments'  => $criterionComments,
            'feedback'            => $result['brief_feedback'] ?? '',
            'suggestions'         => array_values(array_filter($result['suggestions'] ?? [])),
        ];
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PRIVATE: Whisper transcription + signals
    // ═══════════════════════════════════════════════════════════════════════

    private function transcribeWithGroqWhisperVerbose(string $audioUrl): ?array
    {
        $apiKey = config('services.groq.api_key');
        if (!$apiKey) {
            Log::warning('IELTS grading: GROQ_API_KEY not set, skipping transcription.');
            return null;
        }

        try {
            $audioBytes = @file_get_contents($audioUrl);
            if (!$audioBytes) {
                Log::warning("IELTS grading: could not fetch audio from {$audioUrl}");
                return null;
            }

            $tmpPath = tempnam(sys_get_temp_dir(), 'ielts_audio_') . '.webm';
            file_put_contents($tmpPath, $audioBytes);

            $response = $this->http->post(self::WHISPER_URL, [
                'headers'   => ['Authorization' => "Bearer {$apiKey}"],
                'multipart' => [
                    ['name' => 'file',                       'contents' => fopen($tmpPath, 'r'), 'filename' => 'audio.webm'],
                    ['name' => 'model',                      'contents' => self::WHISPER_MODEL],
                    ['name' => 'language',                   'contents' => 'en'],
                    ['name' => 'response_format',            'contents' => 'verbose_json'],
                    ['name' => 'timestamp_granularities[]',  'contents' => 'segment'],
                ],
            ]);

            @unlink($tmpPath);

            $body = json_decode($response->getBody()->getContents(), true);
            $text = trim($body['text'] ?? '');
            if ($text === '') return null;

            $segments    = $body['segments'] ?? [];
            $duration    = (float) ($body['duration'] ?? 0);
            $wordCount   = str_word_count($text);
            $speechRate  = $duration > 0 ? round($wordCount / ($duration / 60), 1) : 0;
            $logProbs    = array_column($segments, 'avg_logprob');
            $noSpeech    = array_column($segments, 'no_speech_prob');
            $avgLogProb  = count($logProbs) > 0 ? array_sum($logProbs) / count($logProbs) : -0.5;
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
            Log::error('IELTS Whisper transcription error: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Derive a pronunciation band (0-9) from Whisper signals.
     * Heuristic mirroring VstepGradingService but on band scale.
     */
    private function computePronunciationBand(array $whisper): float
    {
        $logProb    = $whisper['avg_logprob'] ?? -0.5;
        $rate       = $whisper['speech_rate'] ?? 0;
        $noSpeech   = $whisper['no_speech_avg'] ?? 0.5;
        $duration   = $whisper['duration'] ?? 0;

        // Step 1: clarity from log-probability (Whisper confidence)
        // logprob ~ -0.1 = excellent, -0.3 = good, -0.5 = avg, -0.8 = poor
        $clarity = max(0, min(9, ($logProb + 1.0) * 9));

        // Step 2: speech rate proximity to natural pace (130-160 wpm = best)
        $idealRate = 145;
        $rateDeviation = abs($rate - $idealRate) / $idealRate;
        $rateBand = max(3, 9 - $rateDeviation * 8);

        // Step 3: penalty for excessive silence
        $silencePenalty = $noSpeech > 0.3 ? ($noSpeech - 0.3) * 6 : 0;

        // Step 4: minimum response length penalty (< 30s for IELTS speaking is too short)
        $lengthPenalty = $duration < 30 ? max(0, (30 - $duration) / 30 * 2) : 0;

        $band = $clarity * 0.55 + $rateBand * 0.45 - $silencePenalty - $lengthPenalty;
        return $this->roundToHalfBand(max(0.0, min(9.0, $band)));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PRIVATE: Helpers
    // ═══════════════════════════════════════════════════════════════════════

    private function callGroqLLM(string $system, string $user, string $context, int $maxTokens = 2500): array
    {
        $apiKey = config('services.groq.api_key');
        if (!$apiKey) {
            Log::warning('IELTS grading: GROQ_API_KEY not set');
            return [];
        }

        $primaryModel = env('GROQ_MODEL', 'openai/gpt-oss-120b');
        $models = array_values(array_unique(array_filter([
            $primaryModel,
            'qwen/qwen3.6-27b',
            'openai/gpt-oss-20b',
            'qwen/qwen3.8-27b',
        ])));

        foreach ($models as $model) {
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
                        'temperature' => 0.3,
                        'max_tokens'  => $maxTokens,
                    ],
                ]);

                $body    = json_decode($response->getBody()->getContents(), true);
                $content = $body['choices'][0]['message']['content'] ?? '';

                // ── Reasoning-model support ──────────────────────────────
                $content = preg_replace('/<think>[\s\S]*?<\/think>/i', '', $content);
                $content = trim($content);

                if ($content === '' || $content === '{}') {
                    $reasoning = $body['choices'][0]['message']['reasoning'] ?? '';
                    if ($reasoning) {
                        $content = preg_replace('/<think>[\s\S]*?<\/think>/i', '', $reasoning);
                        $content = trim($content);
                    }
                }

                Log::debug("IELTS Groq LLM raw ({$context}, model={$model}): " . substr($content, 0, 500));

                // Extract JSON object from content
                preg_match('/\{[\s\S]*\}/', $content, $matches);
                $parsed = isset($matches[0]) ? json_decode($matches[0], true) : null;

                if (is_array($parsed) && !empty($parsed['criteria'])) {
                    return $parsed;
                }

                Log::warning("IELTS Groq LLM ({$model}) missing criteria for {$context}, trying next fallback model.");
            } catch (\Throwable $e) {
                Log::warning("IELTS Groq LLM model {$model} failed ({$context}): " . $e->getMessage() . ", trying next fallback.");
            }
        }

        Log::error("All IELTS Groq LLM models failed for {$context}");
        return [];
    }

    private function decodeGeminiField(Submission $submission): array
    {
        $raw = $submission->sGemini_feedback;
        if (is_string($raw)) {
            $decoded = json_decode($raw, true);
            return is_array($decoded) ? $decoded : [];
        }
        return is_array($raw) ? $raw : [];
    }

    private function extractSpeakingContext(Submission $submission, int $partNum): string
    {
        $question = Question::where('exam_id', $submission->exam_id)
            ->where(function ($q) {
                $q->whereRaw('LOWER(qSkill) = ?', ['speaking'])
                  ->orWhereRaw('LOWER(qSection) = ?', ['speaking']);
            })
            ->where('qPart', $partNum)
            ->first();

        if (!$question) return "IELTS Speaking Part {$partNum}";

        $base = strip_tags($question->qContent ?? '');
        $cueCard = $question->qData['cue_card'] ?? null;

        if ($partNum === 2 && is_array($cueCard)) {
            $bullets = is_array($cueCard['bullets'] ?? null)
                ? "\n- " . implode("\n- ", $cueCard['bullets'])
                : '';
            return ($cueCard['topic'] ?? $base) . $bullets;
        }

        return $base;
    }

    private function hasWritingAnswers(Submission $submission): bool
    {
        return $submission->answers->contains(function ($a) {
            $sec = strtolower($a->question->qSkill ?? $a->question->qSection ?? '');
            return $sec === 'writing' && trim($a->saAnswer_text ?? '') !== '';
        });
    }

    private function hasSpeakingAudio(Submission $submission): bool
    {
        $raw = $this->decodeGeminiField($submission);
        return !empty($raw['speaking_audio'] ?? []);
    }

    /**
     * Round a value to the nearest 0.5 within IELTS band range.
     */
    private function roundToHalfBand(float $val): float
    {
        $clamped = max(self::BAND_MIN, min(self::BAND_MAX, $val));
        return round($clamped * 2) / 2;
    }
}

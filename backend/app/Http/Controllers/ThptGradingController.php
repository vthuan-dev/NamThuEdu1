<?php

namespace App\Http\Controllers;

use App\Models\Submission;
use App\Services\PushNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * ThptGradingController — trang chấm điểm giáo viên cho đề Teens THPT.
 *
 * Khác với luồng VSTEP/IELTS (dùng bảng `submission_answers`), THPT lưu toàn bộ
 * dữ liệu chấm trong `submission_payload` + `sGemini_feedback`:
 *   • Câu trả lời học viên: submission_payload['answers']
 *   • Kết quả khách quan:    submission_payload['result']
 *   • Phần Nói AI:           submission_payload['result']['speaking']['parts']['q{n}']
 *   • Phần Viết AI:          submission_payload['result']['writing']['parts']['q{n}']
 *   • Bản ghi âm:            sGemini_feedback['speaking_audio'] (key = số câu trần)
 *
 * Endpoints (trong nhóm role:teacher / prefix teacher):
 *   GET  /api/teacher/thpt-submissions/{id}/grading  → show()  (chuẩn hoá payload)
 *   POST /api/teacher/thpt-submissions/{id}/grading  → save()  (override / phát hành)
 *
 * Quy ước "điểm hiệu lực" (effective) của 1 câu = teacher_score nếu có, ngược lại
 * score (AI). Override của giáo viên được ghi cạnh field AI với tiền tố teacher_*,
 * KHÔNG ghi đè field AI.
 */
class ThptGradingController extends Controller
{
    private const DEFAULT_SCALE_MAX = 10;

    /* ============================================================
     |  GET — chuẩn hoá payload chấm điểm
     * ===========================================================*/

    /**
     * GET /api/teacher/thpt-submissions/{id}/grading
     * Chỉ đọc — KHÔNG bao giờ sửa DB.
     */
    public function show(Request $request, int $id)
    {
        $sub = $this->ensureOwnership($id, $request->user());
        if ($sub instanceof JsonResponse) {
            return $sub;
        }

        if (!$sub->exam || $sub->exam->eType !== 'THPT') {
            return $this->error('Đề này không phải định dạng THPT.', 400);
        }

        return response()->json([
            'status' => 'success',
            'data' => $this->buildShowData($sub),
        ]);
    }

    /* ============================================================
     |  POST — lưu override / phát hành
     * ===========================================================*/

    /**
     * POST /api/teacher/thpt-submissions/{id}/grading
     */
    public function save(Request $request, int $id)
    {
        $sub = $this->ensureOwnership($id, $request->user());
        if ($sub instanceof JsonResponse) {
            return $sub;
        }

        if (!$sub->exam || $sub->exam->eType !== 'THPT') {
            return $this->error('Đề này không phải định dạng THPT.', 400);
        }

        $validated = $request->validate([
            'questions' => 'nullable|array',
            'questions.*.question_number' => 'required|integer',
            'questions.*.teacher_score' => 'required|numeric|min:0|max:10',
            'questions.*.teacher_criteria' => 'nullable|array',
            'questions.*.teacher_criteria.*' => 'nullable|numeric|min:0|max:10',
            'questions.*.teacher_feedback' => 'nullable|string|max:5000',
            'overall_teacher_feedback' => 'nullable|string|max:5000',
            // Điểm tổng ghi đè của giáo viên (0–10). Áp dụng cho mọi đề THPT,
            // kể cả đề toàn trắc nghiệm khách quan (không có phần Nói/Viết).
            'teacher_override_score' => 'nullable|numeric|min:0|max:10',
            'publish' => 'nullable|boolean',
            'answer_overrides' => 'nullable|array',
            'correct_overrides' => 'nullable|array',
            'objective_raw_score' => 'nullable|numeric',
            'objective_raw_max' => 'nullable|numeric',
            'objective_scaled_score' => 'nullable|numeric',
        ]);

        $user = $request->user();
        $publish = (bool) ($validated['publish'] ?? false);
        $questions = $validated['questions'] ?? [];
        $overall = $validated['overall_teacher_feedback'] ?? null;
        $overrideScore = array_key_exists('teacher_override_score', $validated)
            ? $validated['teacher_override_score']
            : null;

        $answerOverrides = $validated['answer_overrides'] ?? null;
        $correctOverrides = $validated['correct_overrides'] ?? null;
        $objRawScore = isset($validated['objective_raw_score']) ? (float) $validated['objective_raw_score'] : null;
        $objRawMax = isset($validated['objective_raw_max']) ? (float) $validated['objective_raw_max'] : null;
        $objScaledScore = isset($validated['objective_scaled_score']) ? (float) $validated['objective_scaled_score'] : null;

        DB::transaction(function () use ($sub, $user, $publish, $questions, $overall, $overrideScore, $answerOverrides, $correctOverrides, $objRawScore, $objRawMax, $objScaledScore) {
            $payload = $sub->submission_payload ?? [];
            $result = $payload['result'] ?? [];

            if ($answerOverrides !== null) {
                $payload['answer_overrides'] = $answerOverrides;
            }
            if ($correctOverrides !== null) {
                $payload['correct_overrides'] = $correctOverrides;
            }

            if ($objRawScore !== null) {
                $result['raw_score'] = $objRawScore;
            }
            if ($objRawMax !== null) {
                $result['raw_score_max'] = $objRawMax;
            }

            // Map question_number → skill từ exam snapshot/config
            $config = $payload['exam_snapshot']['config']
                ?? optional($sub->exam)->thpt_config
                ?? ['sections' => []];
            $skillByQn = [];
            foreach (($config['sections'] ?? []) as $s) {
                $type = $s['type'] ?? '';
                if (!in_array($type, ['speaking', 'writing'], true))
                    continue;
                foreach (($s['items'] ?? []) as $it) {
                    $qn = $it['question_number'] ?? null;
                    if ($qn === null)
                        continue;
                    $skillByQn[(int) $qn] = $type === 'writing' ? 'writing' : 'speaking';
                }
            }

            $speaking = is_array($result['speaking'] ?? null) ? $result['speaking'] : [];
            $writing = is_array($result['writing'] ?? null) ? $result['writing'] : [];
            $speakingParts = is_array($speaking['parts'] ?? null) ? $speaking['parts'] : [];
            $writingParts = is_array($writing['parts'] ?? null) ? $writing['parts'] : [];

            $now = now()->toIso8601String();
            foreach ($questions as $q) {
                $qn = (int) $q['question_number'];
                $key = "q{$qn}";
                $skill = $skillByQn[$qn] ?? 'speaking';
                $bucket = $skill === 'writing' ? $writingParts : $speakingParts;
                $node = is_array($bucket[$key] ?? null) ? $bucket[$key] : [];

                // KHÔNG ghi đè field AI — chỉ thêm/cập nhật teacher_*.
                $node['teacher_score'] = round((float) $q['teacher_score'], 2);
                $criteria = $q['teacher_criteria'] ?? [];
                $node['teacher_pronunciation_score'] = isset($criteria['pronunciation'])
                    ? (float) $criteria['pronunciation'] : null;
                $node['teacher_content_score'] = isset($criteria['content'])
                    ? (float) $criteria['content'] : null;
                $node['teacher_feedback'] = $q['teacher_feedback'] ?? null;
                $node['teacher_reviewed_at'] = $now;
                $node['teacher_reviewed_by'] = (int) $user->uId;

                if ($skill === 'writing') {
                    $writingParts[$key] = $node;
                } else {
                    $speakingParts[$key] = $node;
                }
            }

            $speakingAvg = $this->avgEffectiveScore($speakingParts);
            $writingAvg = $this->avgEffectiveScore($writingParts);

            if (!empty($speakingParts)) {
                $speaking['parts'] = $speakingParts;
                if (!isset($speaking['scale_max'])) {
                    $speaking['scale_max'] = self::DEFAULT_SCALE_MAX;
                }
                if ($speakingAvg !== null) {
                    $speaking['score'] = $speakingAvg;
                }
                $result['speaking'] = $speaking;
            }
            if (!empty($writingParts)) {
                $writing['parts'] = $writingParts;
                if (!isset($writing['scale_max'])) {
                    $writing['scale_max'] = self::DEFAULT_SCALE_MAX;
                }
                if ($writingAvg !== null) {
                    $writing['score'] = $writingAvg;
                }
                $result['writing'] = $writing;
            }

            // Blend multi-skill: objective + speaking + writing (nếu có).
            $objectiveScaled = $objScaledScore !== null
                ? $objScaledScore
                : (isset($result['scaled_score_objective'])
                    ? (float) $result['scaled_score_objective']
                    : $this->recomputeObjectiveScaled($result));

            if ($objScaledScore !== null) {
                $result['scaled_score_objective'] = $objScaledScore;
            }

            $combined = $this->blendSkillScores($objectiveScaled, $speakingAvg, $writingAvg, $result);
            if ($combined !== null) {
                $result['scaled_score'] = $combined;
            }

            // ── Điểm tổng ghi đè của giáo viên (thắng mọi điểm tự động) ──────
            // Lưu vào payload để hiển thị lại, và là điểm cuối khi phát hành.
            $finalScore = $combined;
            if ($overrideScore !== null) {
                $result['teacher_override_score'] = round((float) $overrideScore, 2);
                $finalScore = round((float) $overrideScore, 2);
            } else {
                unset($result['teacher_override_score']);
            }

            $payload['result'] = $result;

            $updates = ['submission_payload' => $payload];
            if ($publish) {                                   // Req 6
                if ($finalScore !== null) {
                    $updates['sScore'] = $finalScore;
                }
                $updates['sStatus'] = 'graded';
                $updates['sGraded_time'] = now();
                $updates['teacher_reviewed_at'] = now();
                $updates['sTeacher_feedback'] = $overall;
            } else {
                // Lưu nháp: ghi teacher_* + nhận xét, KHÔNG đổi sStatus.
                $updates['sTeacher_feedback'] = $overall;
            }

            $sub->update($updates);
        });

        $sub->refresh();

        if ($publish) {
            // Thông báo đẩy là best-effort — thất bại KHÔNG làm hỏng việc lưu (Req 6.5/6.6).
            try {
                $examTitle = optional($sub->exam)->eTitle ?? 'Đề THPT';
                app(PushNotificationService::class)->sendToUser(
                    (int) $sub->user_id,
                    '📝 Giáo viên đã chấm xong bài của bạn',
                    $examTitle . ' · Xem kết quả ngay',
                    ['url' => '/hoc-vien/ket-qua-thpt/' . $sub->sId]
                );
            } catch (\Throwable $e) {
                Log::error("ThptGradingController@save: push failed sub {$sub->sId}: " . $e->getMessage());
            }
        }

        $data = $this->buildShowData($sub);
        $payload = $sub->submission_payload ?? [];
        $result = $payload['result'] ?? [];
        $data['sStatus'] = $sub->sStatus;
        $data['sScore'] = $sub->sScore !== null ? (float) $sub->sScore : null;
        $data['speaking_score'] = $result['speaking']['score'] ?? null;
        $data['scaled_score'] = $result['scaled_score'] ?? null;

        return response()->json([
            'status' => 'success',
            'data' => $data,
        ]);
    }

    /* ============================================================
     |  Helpers
     * ===========================================================*/

    /**
     * Kiểm tra quyền: phải là giáo viên đã đăng nhập (401), submission tồn tại
     * (404), và giáo viên là chủ của đề thi (403). Trả Submission hoặc JsonResponse.
     */
    private function ensureOwnership(int $id, $user)
    {
        if (!$user || $user->uRole !== 'teacher') {
            return $this->error('Bạn không có quyền truy cập.', 401);          // Req 7.2
        }
        $sub = Submission::with(['exam', 'user.class'])->find($id);
        if (!$sub) {
            return $this->error('Không tìm thấy bài làm.', 404);
        }
        if (!$sub->exam || (int) $sub->exam->eTeacher_id !== (int) $user->uId) {
            return $this->error('Bạn không phải giáo viên của đề thi này.', 403); // Req 7.1
        }
        return $sub;
    }

    /**
     * Chuẩn hoá payload trả về cho frontend (dùng chung cho show + save).
     */
    private function buildShowData(Submission $sub): array
    {
        $payload = $sub->submission_payload ?? [];
        $result = $payload['result'] ?? [];
        $config = $payload['exam_snapshot']['config']
            ?? optional($sub->exam)->thpt_config
            ?? ['sections' => []];

        $rawFeedback = $sub->sGemini_feedback
            ? (json_decode($sub->sGemini_feedback, true) ?: [])
            : [];
        $audioMap = $rawFeedback['speaking_audio'] ?? [];
        $speakingParts = is_array($result['speaking']['parts'] ?? null) ? $result['speaking']['parts'] : [];
        $writingParts = is_array($result['writing']['parts'] ?? null) ? $result['writing']['parts'] : [];

        // prompt theo question_number (speaking + writing).
        $promptByQn = [];
        $skillByQn = []; // qn => 'speaking'|'writing'
        foreach (($config['sections'] ?? []) as $s) {
            $type = $s['type'] ?? '';
            if (!in_array($type, ['speaking', 'writing'], true))
                continue;
            foreach (($s['items'] ?? []) as $it) {
                $qn = (string) ($it['question_number'] ?? '');
                if ($qn === '')
                    continue;
                $promptByQn[$qn] = $it['prompt'] ?? '';
                $skillByQn[$qn] = $type === 'writing' ? 'writing' : 'speaking';
            }
        }

        // Câu trả lời học viên + đáp án đúng (đã chấm khách quan) — dùng để
        // dựng review từng câu, đồng bộ shape với ThptResultPage/SectionView.
        $answers = $payload['answers'] ?? [];
        $correctAnswers = $result['correct_answers'] ?? [];

        // Map thống kê điểm theo section (theo index — gradeSubmission duyệt
        // config.sections đúng thứ tự).
        $resultSections = is_array($result['sections'] ?? null) ? array_values($result['sections']) : [];

        $subjective = [];
        $subjectiveByQn = [];
        $anyPending = false;
        foreach (($config['sections'] ?? []) as $s) {
            $type = $s['type'] ?? '';
            if (!in_array($type, ['speaking', 'writing'], true))
                continue;

            foreach (($s['items'] ?? []) as $it) {
                $qn = $it['question_number'] ?? null;
                if ($qn === null)
                    continue;
                $key = "q{$qn}";
                $skill = $type === 'writing' ? 'writing' : 'speaking';
                $bucket = $skill === 'writing' ? $writingParts : $speakingParts;
                $node = is_array($bucket[$key] ?? null) ? $bucket[$key] : null;
                $audio = $skill === 'speaking' ? ($audioMap[(string) $qn] ?? null) : null;
                $studentText = isset($answers[$key]) ? (string) $answers[$key] : null;

                $hasAi = is_array($node) && isset($node['score']);
                $aiBlock = $hasAi ? [
                    'score' => isset($node['score']) ? (float) $node['score'] : null,
                    'criteria' => [
                        'pronunciation' => isset($node['pronunciation_score']) ? (float) $node['pronunciation_score'] : null,
                        'content' => isset($node['content_score']) ? (float) $node['content_score'] : null,
                    ],
                    // Writing AI có criteria_detail (4 tiêu chí IELTS-style) — FE dùng nếu có
                    'criteria_detail' => is_array($node['criteria_detail'] ?? null) ? $node['criteria_detail'] : null,
                    'criterion_comments' => is_array($node['criterion_comments'] ?? null) ? $node['criterion_comments'] : null,
                    'feedback' => $node['feedback'] ?? null,
                    'suggestions' => is_array($node['suggestions'] ?? null) ? array_values($node['suggestions']) : [],
                    'transcript' => $node['transcript'] ?? null,
                    'word_count' => isset($node['word_count']) ? (int) $node['word_count'] : null,
                ] : null;

                $hasTeacher = is_array($node) && isset($node['teacher_score']);
                $teacherBlock = $hasTeacher ? [
                    'score' => (float) $node['teacher_score'],
                    'criteria' => [
                        'pronunciation' => isset($node['teacher_pronunciation_score']) ? (float) $node['teacher_pronunciation_score'] : null,
                        'content' => isset($node['teacher_content_score']) ? (float) $node['teacher_content_score'] : null,
                    ],
                    'feedback' => $node['teacher_feedback'] ?? null,
                    'reviewed_at' => $node['teacher_reviewed_at'] ?? null,
                ] : null;

                if ($hasAi || $hasTeacher) {
                    $status = 'ai_graded';
                } elseif ($skill === 'writing') {
                    // Có bài viết → AI đang chấm / chờ queue; trống → no_ai
                    $hasText = is_string($studentText) && trim($studentText) !== '';
                    if ($hasText) {
                        $status = 'ai_pending';
                        $anyPending = true;
                    } else {
                        $status = 'no_ai';
                    }
                } elseif ($audio) {
                    $status = 'ai_pending';
                    $anyPending = true;
                } else {
                    $status = 'no_ai';
                }

                $sq = [
                    'question_number' => (int) $qn,
                    'skill' => $skill,
                    'prompt' => $promptByQn[(string) $qn] ?? ($it['prompt'] ?? ''),
                    'audio_url' => $audio,
                    'student_answer' => $studentText,
                    'status' => $status,
                    'ai' => $aiBlock,
                    'teacher' => $teacherBlock,
                ];
                $subjective[] = $sq;
                $subjectiveByQn[(int) $qn] = $sq;
            }
        }

        // Toàn bộ section học viên đã làm (khách quan review + chủ quan AI/teacher).
        $sectionsReview = $this->buildSectionsReview($config, $answers, $correctAnswers, $resultSections, $subjectiveByQn);

        $scaleMax = $result['scale_max'] ?? ($config['scale_max'] ?? self::DEFAULT_SCALE_MAX);
        $objectiveScaled = isset($result['scaled_score_objective'])
            ? (float) $result['scaled_score_objective']
            : $this->recomputeObjectiveScaled($result);

        return [
            'submission_id' => $sub->sId,
            'exam' => [
                'id' => optional($sub->exam)->eId,
                'title' => optional($sub->exam)->eTitle,
                'type' => optional($sub->exam)->eType,
            ],
            'student' => [
                'id' => optional($sub->user)->uId,
                'name' => optional($sub->user)->uName,
                'phone' => optional($sub->user)->uPhone,
                'email' => optional($sub->user)->uEmail,
                'gender' => optional($sub->user)->uGender,
                'address' => optional($sub->user)->uAddress,
                'dob' => optional($sub->user)->uDoB ? optional($sub->user)->uDoB->toDateString() : null,
                'class_name' => optional(optional($sub->user)->class)->cName,
                'age_group' => optional($sub->user)->age_group,
            ],
            'submitted_at' => optional($sub->sSubmit_time)->toIso8601String(),
            'status' => $sub->sStatus,
            'ai_speaking_pending' => $anyPending,
            'objective' => [
                'raw_score' => $result['raw_score'] ?? null,
                'raw_score_max' => $result['raw_score_max'] ?? null,
                'scaled_score' => $objectiveScaled,
                'scale_max' => $scaleMax,
            ],
            'overall_teacher_feedback' => $sub->sTeacher_feedback,
            'current_total' => $sub->sScore !== null ? (float) $sub->sScore : null,
            // Điểm tổng ghi đè của giáo viên (nếu đã lưu) — cho UI prefill ô nhập.
            'teacher_override_score' => isset($result['teacher_override_score'])
                ? (float) $result['teacher_override_score'] : null,
            // Raw maps — cho phép frontend tái dùng SectionView (review mode) y hệt trang học viên.
            'answers' => (object) $answers,
            'correct_answers' => (object) $correctAnswers,
            'answer_overrides' => $payload['answer_overrides'] ?? (object) [],
            'correct_overrides' => $payload['correct_overrides'] ?? (object) [],
            // Câu chủ quan (Nói/Viết) — giữ nguyên cho UI override hiện có.
            'subjective_questions' => $subjective,
            // Toàn bộ cấu trúc đề học viên đã làm, từng phần một (ADDED SCOPE).
            'sections' => $sectionsReview,
        ];
    }

    /**
     * Dựng danh sách review cho TẤT CẢ section học viên đã làm — đồng bộ shape
     * với cách `ThptResultPage`/`SectionView` đọc kết quả học viên.
     *
     * - Section khách quan (phonetics/mc_questions/listening/reading_mixed/…):
     *   trả `kind='objective'` + danh sách `questions[]` chỉ-đọc gồm số câu,
     *   đề bài/prompt, options (nếu trắc nghiệm), đáp án học viên, đáp án đúng,
     *   đúng/sai, kèm điểm tự động của section (`score`).
     * - Section chủ quan (speaking/writing): trả `kind='subjective'` + danh sách
     *   `questions[]` theo đúng shape `subjective_questions` (ai + teacher).
     *
     * Nguồn dữ liệu: $config (đề bài/options), $answers (câu trả lời học viên),
     * $correctAnswers (result.correct_answers), $resultSections (điểm/section),
     * $subjectiveByQn (map câu Nói/Viết đã chuẩn hoá).
     */
    private function buildSectionsReview(array $config, array $answers, array $correctAnswers, array $resultSections, array $subjectiveByQn): array
    {
        $normOptions = function ($opts): array {
            $out = [];
            foreach ((array) $opts as $o) {
                if (is_array($o)) {
                    $entry = ['id' => $o['id'] ?? null, 'text' => $o['text'] ?? ''];
                    if (isset($o['underline']))
                        $entry['underline'] = $o['underline'];
                    if (isset($o['underlineStart']))
                        $entry['underlineStart'] = $o['underlineStart'];
                    $out[] = $entry;
                }
            }
            return $out;
        };

        $matchText = function (?string $userVal, $accepted, bool $cs): bool {
            if ($userVal === null)
                return false;
            $u = $cs ? trim($userVal) : mb_strtolower(trim($userVal));
            if ($u === '')
                return false;
            foreach ((array) $accepted as $a) {
                $an = $cs ? trim((string) $a) : mb_strtolower(trim((string) $a));
                if ($u === $an)
                    return true;
            }
            return false;
        };

        // Một câu trắc nghiệm chọn 1 (q{n} → id).
        $mcq = function ($qn, $prompt, $options, $correctId) use ($answers, $normOptions): array {
            $key = "q{$qn}";
            $student = $answers[$key] ?? null;
            return [
                'question_number' => (int) $qn,
                'key' => $key,
                'kind' => 'mcq',
                'prompt' => $prompt,
                'options' => $normOptions($options),
                'student_answer' => $student,
                'correct_answer' => $correctId,
                'is_correct' => $correctId !== null && $correctId !== '' && (string) $student === (string) $correctId,
            ];
        };

        // Một câu nhập đáp án (q{n} → text), so khớp accepted_answers.
        $textQ = function ($qn, $prompt, $accepted, $cs, array $extra = []) use ($answers, $matchText): array {
            $key = "q{$qn}";
            $student = $answers[$key] ?? null;
            $acceptedArr = array_values((array) $accepted);
            return array_merge([
                'question_number' => (int) $qn,
                'key' => $key,
                'kind' => 'text',
                'prompt' => $prompt,
                'options' => [],
                'student_answer' => $student,
                'correct_answer' => $acceptedArr[0] ?? '',
                'accepted_answers' => $acceptedArr,
                'is_correct' => $matchText($student !== null ? (string) $student : null, $acceptedArr, $cs),
            ], $extra);
        };

        // Mệnh đề Đúng/Sai (q{n}.s{i} → bool).
        $tfStatements = function ($qn, $statements) use ($answers): array {
            $out = [];
            foreach ((array) $statements as $idx => $st) {
                $key = "q{$qn}.s" . ($idx + 1);
                $expected = (bool) ($st['correct'] ?? false);
                $hasAns = array_key_exists($key, $answers);
                $studentBool = $hasAns ? (bool) $answers[$key] : null;
                $out[] = [
                    'key' => $key,
                    'text' => $st['text'] ?? '',
                    'student_answer' => $studentBool,
                    'correct_answer' => $expected,
                    'is_correct' => $hasAns && $studentBool === $expected,
                ];
            }
            return $out;
        };

        $sectionsOut = [];
        foreach (($config['sections'] ?? []) as $idx => $s) {
            $type = $s['type'] ?? '';
            $stat = $resultSections[$idx] ?? null;

            $base = [
                'section_id' => $s['id'] ?? ($stat['section_id'] ?? null),
                'type' => $type,
                'title' => $s['title'] ?? ($stat['title'] ?? ''),
                'instructions' => $s['instructions'] ?? null,
            ];

            // ── Subjective (Nói / Viết) ──────────────────────────────────────
            if (in_array($type, ['speaking', 'writing'], true)) {
                $qs = [];
                foreach (($s['items'] ?? []) as $it) {
                    $qn = $it['question_number'] ?? null;
                    if ($qn === null)
                        continue;
                    $qs[] = $subjectiveByQn[(int) $qn] ?? [
                        'question_number' => (int) $qn,
                        'skill' => $type === 'writing' ? 'writing' : 'speaking',
                        'prompt' => $it['prompt'] ?? '',
                        'audio_url' => null,
                        'student_answer' => isset($answers["q{$qn}"]) ? (string) $answers["q{$qn}"] : null,
                        'status' => 'no_ai',
                        'ai' => null,
                        'teacher' => null,
                    ];
                }
                $sectionsOut[] = array_merge($base, [
                    'kind' => 'subjective',
                    'score' => null,
                    'questions' => $qs,
                ]);
                continue;
            }

            // ── Objective (chỉ đọc) ──────────────────────────────────────────
            $questions = [];
            switch ($type) {
                case 'phonetics':
                    // variant (pronunciation/stress) để UI review biết có tự dò đuôi ed/s/es không.
                    $phoneticsVariant = $s['variant'] ?? 'pronunciation';
                    $base['variant'] = $phoneticsVariant;
                    foreach (($s['items'] ?? []) as $it) {
                        $q = $mcq($it['question_number'] ?? '?', $it['prompt'] ?? null, $it['words'] ?? [], $it['correct_id'] ?? null);
                        $q['variant'] = $phoneticsVariant;
                        $questions[] = $q;
                    }
                    break;

                case 'mc_questions':
                    foreach (($s['items'] ?? []) as $it) {
                        $questions[] = $mcq($it['question_number'] ?? '?', $it['prompt'] ?? null, $it['options'] ?? [], $it['correct_id'] ?? null);
                    }
                    break;
                case 'listening':
                    $base['audio_url'] = $s['audio_url'] ?? null;
                    foreach (($s['items'] ?? []) as $it) {
                        $kind = $it['kind'] ?? 'mc';
                        if ($kind === 'fill_blank') {
                            $questions[] = $textQ(
                                $it['question_number'] ?? '?',
                                $it['prompt'] ?? null,
                                $it['accepted_answers'] ?? [],
                                (bool) ($it['case_sensitive'] ?? false)
                            );
                        } else {
                            $questions[] = $mcq($it['question_number'] ?? '?', $it['prompt'] ?? null, $it['options'] ?? [], $it['correct_id'] ?? null);
                        }
                    }
                    break;


                case 'error_identification':
                    foreach (($s['items'] ?? []) as $it) {
                        $questions[] = $mcq($it['question_number'] ?? '?', $it['sentence'] ?? ($it['prompt'] ?? null), $it['segments'] ?? [], $it['correct_id'] ?? null);
                    }
                    break;

                case 'word_form':
                    foreach (($s['items'] ?? []) as $it) {
                        $prompt = trim(($it['sentence'] ?? '') . ($it['root_word'] ? " ({$it['root_word']})" : ''));
                        $questions[] = $textQ($it['question_number'] ?? '?', $prompt, $it['accepted_answers'] ?? [], (bool) ($it['case_sensitive'] ?? false), ['root_word' => $it['root_word'] ?? null]);
                    }
                    break;

                case 'sentence_transformation':
                    foreach (($s['items'] ?? []) as $it) {
                        $questions[] = $textQ($it['question_number'] ?? '?', $it['original'] ?? '', $it['accepted_answers'] ?? [], false, [
                            'lead_in' => $it['lead_in'] ?? null,
                            'prompt_word' => $it['prompt_word'] ?? null,
                        ]);
                    }
                    break;

                case 'tf_group':
                    foreach (($s['items'] ?? []) as $it) {
                        $qn = $it['question_number'] ?? '?';
                        $questions[] = [
                            'question_number' => (int) $qn,
                            'kind' => 'tf_group',
                            'context' => $it['context'] ?? '',
                            'context_style' => $it['context_style'] ?? null,
                            'statements' => $tfStatements($qn, $it['statements'] ?? []),
                        ];
                    }
                    break;

                case 'matching':
                    foreach (($s['items'] ?? []) as $it) {
                        $qn = $it['question_number'] ?? '?';
                        $rows = [];
                        foreach (($it['list_1'] ?? []) as $i => $line) {
                            $pos = $i + 1;
                            $key = "q{$qn}.{$pos}";
                            $student = $answers[$key] ?? null;
                            $correctLetter = $it['answers'][$pos] ?? ($it['answers'][(string) $pos] ?? null);
                            $rows[] = [
                                'key' => $key,
                                'index' => $pos,
                                'text' => $line,
                                'student_answer' => $student,
                                'correct_answer' => $correctLetter,
                                'is_correct' => $student !== null && (string) $student === (string) $correctLetter,
                            ];
                        }
                        $questions[] = [
                            'question_number' => (int) $qn,
                            'kind' => 'matching',
                            'list_1' => array_values($it['list_1'] ?? []),
                            'list_2' => array_values($it['list_2'] ?? []),
                            'rows' => $rows,
                        ];
                    }
                    break;

                case 'mc_cloze':
                    $base['passage'] = $s['passage'] ?? null;
                    foreach (($s['blanks'] ?? []) as $b) {
                        $questions[] = $mcq($b['question_number'] ?? '?', null, $b['options'] ?? [], $b['correct_id'] ?? null);
                    }
                    break;

                case 'word_bank_cloze':
                    $base['word_bank'] = array_values($s['word_bank'] ?? []);
                    // fallthrough behaviour for blanks
                    $base['passage'] = $s['passage'] ?? null;
                    foreach (($s['blanks'] ?? []) as $b) {
                        $questions[] = $textQ($b['question_number'] ?? '?', null, $b['accepted_answers'] ?? [], (bool) ($b['case_sensitive'] ?? false));
                    }
                    break;

                case 'open_cloze':
                    $base['passage'] = $s['passage'] ?? null;
                    foreach (($s['blanks'] ?? []) as $b) {
                        $questions[] = $textQ($b['question_number'] ?? '?', null, $b['accepted_answers'] ?? [], (bool) ($b['case_sensitive'] ?? false));
                    }
                    break;

                case 'reading_mixed':
                    $base['passage'] = $s['passage'] ?? null;
                    foreach (($s['items'] ?? []) as $it) {
                        $qn = $it['question_number'] ?? '?';
                        $kind = $it['kind'] ?? 'mc';
                        if ($kind === 'tf_group') {
                            $questions[] = [
                                'question_number' => (int) $qn,
                                'kind' => 'tf_group',
                                'context_paragraph_ref' => $it['context_paragraph_ref'] ?? null,
                                'statements' => $tfStatements($qn, $it['statements'] ?? []),
                            ];
                        } elseif ($kind === 'sentence_insertion') {
                            $key = "q{$qn}";
                            $student = $answers[$key] ?? null;
                            $correctMarker = $it['correct_marker'] ?? ($it['correct'] ?? ($it['correct_id'] ?? null));
                            $questions[] = [
                                'question_number' => (int) $qn,
                                'key' => $key,
                                'kind' => 'sentence_insertion',
                                'prompt' => $it['prompt'] ?? '',
                                'sentence_to_insert' => $it['sentence_to_insert'] ?? '',
                                'markers' => ['A', 'B', 'C', 'D'],
                                'student_answer' => $student,
                                'correct_answer' => $correctMarker,
                                'is_correct' => $student !== null && (string) $student === (string) $correctMarker,
                            ];
                        } else { // mc
                            $questions[] = $mcq($qn, $it['prompt'] ?? null, $it['options'] ?? [], $it['correct_id'] ?? null);
                        }
                    }
                    break;

                default:
                    // Loại không xác định — vẫn trả section rỗng để frontend biết.
                    break;
            }

            $sectionsOut[] = array_merge($base, [
                'kind' => 'objective',
                'score' => $stat ? [
                    'correct_count' => $stat['correct_count'] ?? 0,
                    'total_count' => $stat['total_count'] ?? 0,
                    'raw_score' => $stat['raw_score'] ?? 0,
                    'raw_max' => $stat['raw_max'] ?? 0,
                ] : null,
                'questions' => $questions,
            ]);
        }

        return $sectionsOut;
    }

    /**
     * Suy ra điểm khách quan THUẦN (trước khi blend Nói) từ result.sections,
     * loại trừ section type 'speaking'. Dùng cho submission cũ chưa có
     * `scaled_score_objective`. Mirror công thức của ThptExamController@gradeSubmission. ok
     */
    private function recomputeObjectiveScaled(array $result): ?float
    {
        $sections = $result['sections'] ?? [];
        if (empty($sections)) {
            return null;
        }
        $rawScore = 0.0;
        $rawMax = 0.0;
        foreach ($sections as $st) {
            if (($st['type'] ?? '') === 'speaking')
                continue;
            $rawScore += (float) ($st['raw_score'] ?? 0);
            $rawMax += (float) ($st['raw_max'] ?? 0);
        }
        if ($rawMax <= 0) {
            return null;
        }
        $scaleMax = (float) ($result['scale_max'] ?? self::DEFAULT_SCALE_MAX);
        return round(($rawScore / $rawMax) * $scaleMax, 2);
    }

    private function error(string $message, int $code = 400, $errors = null): JsonResponse
    {
        $resp = ['status' => 'error', 'message' => $message];
        if ($errors !== null) {
            $resp['errors'] = $errors;
        }
        return response()->json($resp, $code);
    }
    /**
     * Trung bình điểm hiệu lực (teacher_score ?? score) của 1 bucket parts.
     */
    private function avgEffectiveScore(array $parts): ?float
    {
        $eff = [];
        foreach ($parts as $node) {
            if (!is_array($node))
                continue;
            $e = $node['teacher_score'] ?? ($node['score'] ?? null);
            if ($e !== null)
                $eff[] = (float) $e;
        }
        if (empty($eff))
            return null;
        return round(array_sum($eff) / count($eff), 2);
    }

    /**
     * Blend objective + speaking + writing (chỉ skill có điểm).
     * Objective chỉ tính nếu đề có câu khách quan (total_count > 0).
     */
    private function blendSkillScores(?float $objective, ?float $speaking, ?float $writing, array $result): ?float
    {
        $vals = [];
        $hasObj = false;
        foreach (($result['sections'] ?? []) as $st) {
            $t = $st['type'] ?? '';
            if (!in_array($t, ['speaking', 'writing'], true) && (int) ($st['total_count'] ?? 0) > 0) {
                $hasObj = true;
                break;
            }
        }
        // Fallback: nếu không suy ra được từ sections, vẫn dùng objective nếu có
        if (!$hasObj && $objective !== null && empty($result['sections'])) {
            $hasObj = true;
        }
        if ($hasObj && $objective !== null)
            $vals[] = $objective;
        if ($speaking !== null)
            $vals[] = $speaking;
        if ($writing !== null)
            $vals[] = $writing;
        if (empty($vals))
            return $objective ?? $speaking ?? $writing;
        return round(array_sum($vals) / count($vals), 2);
    }


}

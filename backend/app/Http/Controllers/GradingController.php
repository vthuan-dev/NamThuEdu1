<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use App\Models\Submission;
use App\Models\SubmissionAnswer;
use App\Models\Exam;
use App\Models\TeacherPinnedStudent;
use App\Models\TestAssignment;
use App\Models\User;
use App\Models\Classes;
use App\Models\ClassCoTeacher;
use App\Support\ScoreScale;

class GradingController extends Controller
{
    /**
     * @OA\Get(
     *     path="/teacher/submissions",
     *     tags={"Grading"},
     *     summary="Get submissions for grading",
     *     description="Get list of student submissions with optional filters",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="exam_id",
     *         in="query",
     *         required=false,
     *         @OA\Schema(type="integer"),
     *         description="Filter by exam ID"
     *     ),
     *     @OA\Parameter(
     *         name="status",
     *         in="query",
     *         required=false,
     *         @OA\Schema(type="string", enum={"completed","graded"}),
     *         description="Filter by submission status"
     *     ),
     *     @OA\Response(response=200, description="Submissions retrieved successfully"),
     *     @OA\Response(response=401, description="Unauthorized")
     * )
     *
     * GET /api/teacher/submissions
     * Lấy danh sách bài làm (có filter)
     */
    public function index(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        // Quyền xem: chủ đề HOẶC GV/co-GV của lớp học viên/assignment.
        // Trước đây chỉ eTeacher_id → GV giao đề ngân hàng (eTeacher_id = người khác)
        // sẽ không thấy bài học viên đã nộp.
        $query = Submission::with(['user.class', 'exam']);
        $this->applyTeacherSubmissionAccess($query, $user);

        // Filter by exam_id
        if ($request->has('exam_id')) {
            $query->where('exam_id', $request->exam_id);
        }

        // Filter by student (user_id)
        if ($request->has('student_id')) {
            $query->where('user_id', $request->student_id);
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('sStatus', $request->status);
        } else {
            // Mặc định: chỉ hiện bài ĐÃ NỘP để chấm. Loại bài nháp/đang làm dở
            // (draft/in_progress) — trước đây dedup ->first() vô tình giấu bớt các
            // phiên này; sau khi bỏ dedup phải lọc tường minh để chúng không lòi
            // vào danh sách chấm điểm của giáo viên.
            $query->whereNotIn('sStatus', ['draft', 'in_progress']);
        }

        // Filter by teacher review state: reviewed=0 (pending), reviewed=1 (done)
        if ($request->has('reviewed')) {
            if ($request->reviewed == '0') {
                $query->whereNull('teacher_reviewed_at');
            } else {
                $query->whereNotNull('teacher_reviewed_at');
            }
        }

        // Backfill: submission đã nộp nhưng thiếu assignment_id (bug start-direct
        // teens/kids/VSTEP cũ) → gắn assignment active để vào tab "Bài giao".
        // Chạy trước filter source=assigned, giới hạn theo đề của giáo viên này.
        if ($request->get('source', 'assigned') !== 'practice') {
            $this->backfillMissingAssignmentIds($user->uId);
        }

        // Filter by source: assigned (default) or practice (self-study)
        $source = $request->get('source', 'assigned');
        if ($source === 'practice') {
            $query->whereNull('assignment_id');
        } else {
            $query->whereNotNull('assignment_id');
        }

        // Hiển thị TẤT CẢ các phiên: học viên nộp/làm đề đó bao nhiêu lần thì có
        // bấy nhiêu kết quả (mỗi lần nộp = 1 dòng riêng). KHÔNG dedup theo
        // user_id-assignment_id nữa — trước đây gộp về 1 phiên mới nhất khiến các
        // phiên khác (kể cả bài đã chấm) bị ẩn, gây nhầm khi giáo viên xem lại.
        $submissions = $query->orderBy('sSubmit_time', 'desc')->get();

        // Đính kèm số câu hỏi của đề cho mỗi bài làm — giúp giáo viên phân biệt
        // đúng phiên/đề khi chấm (tránh nhầm giữa các phiên của cùng một đề).
        $submissions->each(function ($s) {
            $s->questions_count = $s->exam ? $s->exam->getQuestionsCount() : 0;
        });

        return response()->json([
            'status' => 'success',
            'data' => $submissions
        ]);
    }

    /**
     * @OA\Get(
     *     path="/teacher/submissions/{id}",
     *     tags={"Grading"},
     *     summary="Get submission details",
     *     description="Get detailed information about a specific submission",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=200, description="Submission details retrieved successfully"),
     *     @OA\Response(response=404, description="Submission not found")
     * )
     *
     * GET /api/teacher/submissions/{id}
     * Lấy chi tiết bài làm với tất cả câu trả lời
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $submission = Submission::where('sId', $id)
                                ->with(['user', 'exam.questions.answers', 'answers.question'])
                                ->first();

        if (!$submission || !$this->teacherCanAccessSubmission($user, $submission)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài làm.'
            ], 404);
        }

        $isVstep = strtoupper($submission->exam->eType ?? '') === 'VSTEP';
        $isIelts = strtoupper($submission->exam->eType ?? '') === 'IELTS';
        if ($isVstep || $isIelts) {
            $raw = $submission->sGemini_feedback
                ? (is_array($submission->sGemini_feedback)
                    ? $submission->sGemini_feedback
                    : json_decode($submission->sGemini_feedback, true))
                : [];

            $speakingAudio = $raw['speaking_audio'] ?? [];
            if (!empty($speakingAudio)) {
                // VSTEP Speaking: 1 part = 1 audio = 1 grading task
                // Group all speaking questions by part, pick the FIRST question in each part
                // as the representative for the placeholder answer row.
                $speakingQuestions = \App\Models\Question::where('exam_id', $submission->exam_id)
                    ->where(function($query) {
                        $query->whereRaw('LOWER(qSkill) = ?', ['speaking'])
                              ->orWhereRaw('LOWER(qSection) = ?', ['speaking']);
                    })
                    ->orderBy('qPart')
                    ->orderBy('qId')
                    ->get();

                // Build: part => first question of that part
                $firstQuestionByPart = [];
                foreach ($speakingQuestions as $q) {
                    $p = $q->qPart ?? 1;
                    if (!isset($firstQuestionByPart[$p])) {
                        $firstQuestionByPart[$p] = $q;
                    }
                }

                // Build: part => existing answer row (so we don't duplicate)
                $existingByPart = [];
                foreach ($submission->answers as $ans) {
                    $sec = strtolower($ans->question->qSkill ?? $ans->question->qSection ?? '');
                    if ($sec !== 'speaking') continue;
                    $p = $ans->question->qPart ?? 1;
                    if (!isset($existingByPart[$p])) {
                        $existingByPart[$p] = $ans;
                    }
                }

                $createdAny = false;
                foreach ($speakingAudio as $part => $audioUrl) {
                    if (empty($audioUrl)) continue;
                    if (!isset($firstQuestionByPart[$part])) continue; // no question matches this part

                    // Row already exists for this part → backfill URL if missing
                    if (isset($existingByPart[$part])) {
                        $existing = $existingByPart[$part];
                        $currentText = trim((string) ($existing->saAnswer_text ?? ''));
                        $looksLikeAudio = $currentText !== '' && (
                            str_starts_with($currentText, 'http://')
                            || str_starts_with($currentText, 'https://')
                            || str_contains($currentText, '/storage/')
                            || (bool) preg_match('/\.(webm|ogg|mp3|wav|m4a|aac|mp4)(\?|$)/i', $currentText)
                        );
                        if (!$looksLikeAudio) {
                            $existing->update(['saAnswer_text' => $audioUrl]);
                            $createdAny = true;
                        }
                        continue;
                    }

                    $question = $firstQuestionByPart[$part];
                    $saAiScore = null;
                    if (isset($raw['speaking_results']["part_{$part}"]['score'])) {
                        $saAiScore = $raw['speaking_results']["part_{$part}"]['score'];
                    } elseif (isset($raw['ielts_speaking_results']["part_{$part}"]['band'])) {
                        $saAiScore = $raw['ielts_speaking_results']["part_{$part}"]['band'];
                    }

                    \App\Models\SubmissionAnswer::create([
                        'submission_id'    => $submission->sId,
                        'question_id'      => $question->qId,
                        'saAnswer_text'    => $audioUrl,
                        'saPoints_awarded' => null,
                        'saIs_correct'     => null,
                        'saReview_status'  => 'pending',
                        'saAi_score'       => $saAiScore,
                    ]);
                    $createdAny = true;
                }

                if ($createdAny) {
                    // Reload submission with answers to include the newly created/updated rows
                    $submission = Submission::where('sId', $id)
                                            ->with(['user', 'exam.questions.answers', 'answers.question'])
                                            ->first();
                }
            }
        }

        return response()->json([
            'status' => 'success',
            'data' => $submission
        ]);
    }

    /**
     * @OA\Post(
     *     path="/teacher/submissions/{id}/grade",
     *     tags={"Grading"},
     *     summary="Grade submission",
     *     description="Grade a student submission (manual grading for essay questions)",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             @OA\Property(
     *                 property="grades",
     *                 type="array",
     *                 @OA\Items(
     *                     @OA\Property(property="question_id", type="integer"),
     *                     @OA\Property(property="score", type="number", format="float")
     *                 )
     *             ),
     *             @OA\Property(property="feedback", type="string", example="Good work overall")
     *         )
     *     ),
     *     @OA\Response(response=200, description="Submission graded successfully"),
     *     @OA\Response(response=404, description="Submission not found")
     * )
     *
     * POST /api/teacher/submissions/{id}/grade
     * Chấm điểm bài làm
     */
    public function grade(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $submission = Submission::with(['exam', 'user'])
                                ->where('sId', $id)
                                ->first();

        if (!$submission || !$this->teacherCanAccessSubmission($user, $submission)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài làm.'
            ], 404);
        }

        if (!in_array($submission->sStatus, [
            'submitted', 'graded', 'in_progress', 'partially_graded',
            'ai_graded', 'grading_subjective', 'auto_submitted',
        ])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Bài làm chưa được nộp.'
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'score' => 'nullable|numeric|min:0|max:100',
            'feedback' => 'nullable|string',
            'sTeacher_feedback' => 'nullable|string',
            'questionScores' => 'nullable|array',
            'questionScores.*.question_id' => 'required|integer',
            'questionScores.*.saPoints_awarded' => 'required|numeric|min:0',
            'skill_overrides' => 'nullable|array',
            'skill_overrides.listening' => 'nullable|numeric|min:0|max:10',
            'skill_overrides.reading' => 'nullable|numeric|min:0|max:10',
            'skill_overrides.writing' => 'nullable|numeric|min:0|max:10',
            'skill_overrides.speaking' => 'nullable|numeric|min:0|max:10',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        try {
            $examType = strtoupper($submission->exam->eType ?? '');
            $isVstep = $examType === 'VSTEP';
            $isIelts = $examType === 'IELTS';

            // Update individual question scores if provided
            if ($request->has('questionScores')) {
                foreach ($request->questionScores as $scoreData) {
                    $submissionAnswer = SubmissionAnswer::where('submission_id', $id)
                                                       ->where('question_id', $scoreData['question_id'])
                                                       ->first();

                    if (!$submissionAnswer) continue;

                    $newScore = (float) $scoreData['saPoints_awarded'];

                    // ⚠️ DEFENSIVE: với writing/speaking, KHÔNG ghi đè 0 lên saPoints_awarded
                    // nếu AI đã chấm > 0 và teacher chưa từng review.
                    // Bug cũ: FE map points=0 (do saPoints_awarded null), bulk save ghi đè 0
                    // → Task chưa chấm bị reset về 0. Chống lại bằng cách:
                    // - Nếu newScore == 0 AND saPoints_awarded null AND saAi_score > 0
                    //   → giữ saAi_score (coi như teacher chưa chạm).
                    $q = $submissionAnswer->question;
                    $sec = strtolower($q->qSkill ?? $q->qSection ?? '');
                    $isSubjective = in_array($sec, ['writing', 'speaking'], true);

                    if (
                        $isSubjective
                        && $newScore == 0.0
                        && is_null($submissionAnswer->saPoints_awarded)
                        && !is_null($submissionAnswer->saAi_score)
                        && (float) $submissionAnswer->saAi_score > 0.0
                    ) {
                        // Sync saPoints_awarded với saAi_score (heal data) — KHÔNG ghi 0.
                        $submissionAnswer->update([
                            'saPoints_awarded' => $submissionAnswer->saAi_score,
                        ]);
                        \Log::info('[grading.update] guarded zero overwrite', [
                            'submission_id' => $id,
                            'question_id' => $scoreData['question_id'],
                            'ai_score' => $submissionAnswer->saAi_score,
                            'reason' => 'FE sent 0 but AI graded — preserved AI score',
                        ]);
                        continue;
                    }

                    $submissionAnswer->update([
                        'saPoints_awarded' => $newScore,
                    ]);
                }
            }

            if ($isVstep) {
                // For VSTEP: calculate skill scores and update sGemini_feedback + sScore
                $sub = Submission::with(['answers.question'])->find($id);

                $listeningCorrect = 0;
                $listeningMax = 0;
                $readingCorrect = 0;
                $readingMax = 0;

                $writingScores = [];
                $speakingScores = [];

                foreach ($sub->answers as $ans) {
                    $sec = strtolower($ans->question->qSkill ?? $ans->question->qSection ?? '');
                    $qPoints = $ans->question->qPoints ?? 1;
                    // ⚠️ Self-heal: với writing/speaking, fallback saAi_score nếu
                    // saPoints_awarded null. Bảo vệ submission cũ chưa được FE
                    // ghi đúng saPoints_awarded vì AI grading job cũ không sync.
                    $isSubjective = in_array($sec, ['writing', 'speaking'], true);
                    $pointsAwarded = $isSubjective
                        ? ($ans->saPoints_awarded ?? $ans->saAi_score ?? 0)
                        : ($ans->saPoints_awarded ?? 0);

                    if ($sec === 'listening') {
                        $listeningMax += $qPoints;
                        $listeningCorrect += $pointsAwarded;
                    } elseif ($sec === 'reading') {
                        $readingMax += $qPoints;
                        $readingCorrect += $pointsAwarded;
                    } elseif ($sec === 'writing') {
                        $writingScores[] = $pointsAwarded;
                    } elseif ($sec === 'speaking') {
                        $speakingScores[] = $pointsAwarded;
                    }
                }

                $listeningScore = $listeningMax > 0 ? round(($listeningCorrect / $listeningMax) * 10, 2) : null;
                $readingScore = $readingMax > 0 ? round(($readingCorrect / $readingMax) * 10, 2) : null;
                $writingScore = count($writingScores) > 0 ? round(array_sum($writingScores) / count($writingScores), 2) : null;
                $speakingScore = count($speakingScores) > 0 ? round(array_sum($speakingScores) / count($speakingScores), 2) : null;

                // Read and update sGemini_feedback
                $raw = $sub->sGemini_feedback ? (json_decode($sub->sGemini_feedback, true) ?: []) : [];
                $vstepScores = $raw['vstep_scores'] ?? [];

                // FIX: Apply the freshly computed per-skill scores derived from the
                // teacher-edited saPoints_awarded. Without this, editing per-question
                // points (the page only sends questionScores) never updated the skill
                // scores nor sScore — the old AI values kept showing (override lost).
                if (!is_null($listeningScore)) $vstepScores['listening'] = $listeningScore;
                if (!is_null($readingScore))   $vstepScores['reading']   = $readingScore;
                if (!is_null($writingScore))   $vstepScores['writing']   = $writingScore;
                if (!is_null($speakingScore))  $vstepScores['speaking']  = $speakingScore;

                // Apply manual skill overrides from the request if present (takes precedence)
                if ($request->has('skill_overrides') && is_array($request->skill_overrides)) {
                    foreach (['listening', 'reading', 'writing', 'speaking'] as $skill) {
                        if (isset($request->skill_overrides[$skill]) && is_numeric($request->skill_overrides[$skill])) {
                            $vstepScores[$skill] = round((float) $request->skill_overrides[$skill], 2);
                        }
                    }
                }

                $raw['vstep_scores'] = $vstepScores;

                // Also update speaking_results parts in JSON if they exist, to stay in sync with answers
                if (isset($raw['speaking_results']) && is_array($raw['speaking_results'])) {
                    foreach ($sub->answers as $ans) {
                        $sec = strtolower($ans->question->qSkill ?? $ans->question->qSection ?? '');
                        if ($sec === 'speaking') {
                            $part = $ans->question->qPart ?? 1;
                            if (isset($raw['speaking_results']["part_{$part}"])) {
                                $raw['speaking_results']["part_{$part}"]['score'] = $ans->saPoints_awarded;
                            }
                        }
                    }
                }

                if ($request->has('score') && !$request->has('skill_overrides')) {
                    $totalScore = (float) $request->score;
                } else {
                    // Recalculate average
                    $available = array_filter([
                        $vstepScores['listening'] ?? null,
                        $vstepScores['reading']   ?? null,
                        $vstepScores['writing']   ?? null,
                        $vstepScores['speaking']  ?? null,
                    ], fn($v) => !is_null($v));

                    $overallAvg = count($available) > 0 ? round(array_sum($available) / count($available), 2) : 0;
                    $totalScore = round($overallAvg * 10, 2);
                }

                $submission->update([
                    'sGemini_feedback' => json_encode($raw),
                    'sTeacher_feedback' => $request->feedback ?? $request->sTeacher_feedback,
                    'sScore' => $totalScore,
                    'sStatus' => 'graded',
                    'sGraded_time' => now(),
                    'teacher_reviewed_at' => now(),
                ]);
            } elseif ($isIelts) {
                // For IELTS: similar to VSTEP but on band scale 0-9
                $sub = Submission::with(['answers.question'])->find($id);

                $listeningCorrect = 0;
                $listeningMax = 0;
                $readingCorrect = 0;
                $readingMax = 0;
                $writingBands = [];
                $speakingBands = [];

                foreach ($sub->answers as $ans) {
                    $sec = strtolower($ans->question->qSkill ?? $ans->question->qSection ?? '');
                    $qPoints = $ans->question->qPoints ?? 1;
                    // Self-heal cho IELTS: writing/speaking fallback saAi_score
                    $isSubjective = in_array($sec, ['writing', 'speaking'], true);
                    $pointsAwarded = $isSubjective
                        ? ($ans->saPoints_awarded ?? $ans->saAi_score ?? 0)
                        : ($ans->saPoints_awarded ?? 0);

                    if ($sec === 'listening') {
                        $listeningMax += $qPoints;
                        $listeningCorrect += $pointsAwarded;
                    } elseif ($sec === 'reading') {
                        $readingMax += $qPoints;
                        $readingCorrect += $pointsAwarded;
                    } elseif ($sec === 'writing') {
                        $writingBands[] = $pointsAwarded;
                    } elseif ($sec === 'speaking') {
                        $speakingBands[] = $pointsAwarded;
                    }
                }

                // IELTS raw-to-band conversion (40 questions Listening/Reading)
                // Approximate IDP/BC conversion table
                $rawToBand = function ($correct, $max) {
                    if ($max <= 0) return null;
                    $pct = $correct / $max;
                    // Approximate band conversion
                    if ($pct >= 0.975) return 9.0;
                    if ($pct >= 0.925) return 8.5;
                    if ($pct >= 0.875) return 8.0;
                    if ($pct >= 0.800) return 7.5;
                    if ($pct >= 0.725) return 7.0;
                    if ($pct >= 0.650) return 6.5;
                    if ($pct >= 0.575) return 6.0;
                    if ($pct >= 0.500) return 5.5;
                    if ($pct >= 0.400) return 5.0;
                    if ($pct >= 0.325) return 4.5;
                    if ($pct >= 0.250) return 4.0;
                    if ($pct >= 0.175) return 3.5;
                    if ($pct >= 0.100) return 3.0;
                    return 2.5;
                };

                $listeningBand = $rawToBand($listeningCorrect, $listeningMax);
                $readingBand   = $rawToBand($readingCorrect, $readingMax);
                $writingBand   = count($writingBands) > 0 ? array_sum($writingBands) / count($writingBands) : null;
                $speakingBand  = count($speakingBands) > 0 ? array_sum($speakingBands) / count($speakingBands) : null;

                // Round to nearest 0.5 (IELTS rule)
                $halfRound = fn($v) => is_null($v) ? null : round($v * 2) / 2;
                $listeningBand = $halfRound($listeningBand);
                $readingBand   = $halfRound($readingBand);
                $writingBand   = $halfRound($writingBand);
                $speakingBand  = $halfRound($speakingBand);

                $raw = $sub->sGemini_feedback ? (json_decode($sub->sGemini_feedback, true) ?: []) : [];
                $ieltsScores = $raw['ielts_scores'] ?? [];

                if (!is_null($listeningBand)) $ieltsScores['listening'] = $listeningBand;
                if (!is_null($readingBand))   $ieltsScores['reading']   = $readingBand;
                if (!is_null($writingBand))   $ieltsScores['writing']   = $writingBand;
                if (!is_null($speakingBand))  $ieltsScores['speaking']  = $speakingBand;

                // Manual band overrides (range 0-9 for IELTS)
                if ($request->has('skill_overrides') && is_array($request->skill_overrides)) {
                    foreach (['listening', 'reading', 'writing', 'speaking'] as $skill) {
                        if (isset($request->skill_overrides[$skill]) && is_numeric($request->skill_overrides[$skill])) {
                            $ieltsScores[$skill] = $halfRound((float) $request->skill_overrides[$skill]);
                        }
                    }
                }

                $raw['ielts_scores'] = $ieltsScores;

                $available = array_filter([
                    $ieltsScores['listening'] ?? null,
                    $ieltsScores['reading']   ?? null,
                    $ieltsScores['writing']   ?? null,
                    $ieltsScores['speaking']  ?? null,
                ], fn($v) => !is_null($v));

                $overallBand = count($available) > 0
                    ? $halfRound(array_sum($available) / count($available))
                    : 0;

                // Persist sScore as 0-100 (band × 10) for compatibility with reports/sScore-based filters
                $totalScore = round($overallBand * 10, 2);

                $submission->update([
                    'sGemini_feedback'   => json_encode($raw),
                    'sTeacher_feedback'  => $request->feedback ?? $request->sTeacher_feedback,
                    'sScore'             => $totalScore,
                    'sStatus'            => 'graded',
                    'sGraded_time'       => now(),
                    'teacher_reviewed_at' => now(),
                ]);
            } else {
                // Non-VSTEP / non-IELTS calculation (Cambridge / General / Kids)
                if ($request->has('questionScores')) {
                    $totalScore = $this->calculateTotalScore($id);
                } else {
                    $totalScore = $request->score ?? $this->calculateTotalScore($id);
                }

                $submission->update([
                    'sTeacher_feedback' => $request->feedback ?? $request->sTeacher_feedback,
                    'sScore' => $totalScore,
                    'sStatus' => 'graded',
                    'sGraded_time' => now(),
                    'teacher_reviewed_at' => now(),
                ]);
            }

            return response()->json([
                'status' => 'success',
                'data' => [
                    'submissionId' => $id,
                    'sScore' => $totalScore,
                    'message' => 'Chấm điểm bài làm thành công'
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi hệ thống khi chấm điểm.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * @OA\Post(
     *     path="/teacher/submissions/{id}/auto-grade",
     *     tags={"Grading"},
     *     summary="Auto-grade multiple choice questions",
     *     description="Automatically grade multiple choice, true/false, and fill-in-blank questions",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=200, description="Auto-grading completed successfully"),
     *     @OA\Response(response=404, description="Submission not found")
     * )
     *
     * POST /api/teacher/submissions/{id}/auto-grade
     * Tự động chấm câu trắc nghiệm
     */
    public function autoGrade(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $submission = Submission::where('sId', $id)
                                ->with(['answers.question.answers', 'exam', 'user'])
                                ->first();

        if (!$submission || !$this->teacherCanAccessSubmission($user, $submission)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài làm.'
            ], 404);
        }

        try {
            $autoGradedCount = 0;
            $manualGradingRequired = 0;

            foreach ($submission->answers as $submissionAnswer) {
                $question = $submissionAnswer->question;

                // Auto-grade only specific question types
                if (in_array($question->qType, ['multiple_choice', 'true_false_not_given', 'yes_no_not_given', 'fill_blank', 'true_false'])) {
                    $isCorrect = $this->checkAnswer($question, $submissionAnswer->saAnswer_text);
                    $pointsAwarded = $isCorrect ? $question->qPoints : 0;

                    $submissionAnswer->update([
                        'saIs_correct' => $isCorrect,
                        'saPoints_awarded' => $pointsAwarded
                    ]);

                    $autoGradedCount++;
                } else {
                    // Essay, short answer, etc. require manual grading
                    $manualGradingRequired++;
                }
            }

            // Recalculate total score
            $totalScore = $this->calculateTotalScore($id);

            // Update submission status
            $newStatus = $manualGradingRequired > 0 ? 'partially_graded' : 'graded';
            $submission->update([
                'sScore' => $totalScore,
                'sStatus' => $newStatus,
                'sGraded_time' => now()
            ]);

            return response()->json([
                'status' => 'success',
                'data' => [
                    'submissionId' => $id,
                    'auto_graded_questions' => $autoGradedCount,
                    'manual_grading_required' => $manualGradingRequired,
                    'current_score' => $totalScore,
                    'status' => $newStatus,
                    'message' => "Đã tự động chấm {$autoGradedCount} câu trắc nghiệm. Còn {$manualGradingRequired} câu cần chấm thủ công."
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi hệ thống khi tự động chấm điểm.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * @OA\Post(
     *     path="/teacher/submissions/{id}/detailed-grade",
     *     tags={"Grading"},
     *     summary="Detailed manual grading with comments",
     *     description="Grade individual questions with detailed feedback and comments",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             @OA\Property(
     *                 property="question_grades",
     *                 type="array",
     *                 @OA\Items(
     *                     @OA\Property(property="question_id", type="integer"),
     *                     @OA\Property(property="points_awarded", type="number", format="float"),
     *                     @OA\Property(property="feedback", type="string"),
     *                     @OA\Property(property="is_correct", type="boolean")
     *                 )
     *             ),
     *             @OA\Property(property="overall_feedback", type="string"),
     *             @OA\Property(property="strengths", type="array", @OA\Items(type="string")),
     *             @OA\Property(property="improvements", type="array", @OA\Items(type="string"))
     *         )
     *     ),
     *     @OA\Response(response=200, description="Detailed grading completed successfully")
     * )
     *
     * POST /api/teacher/submissions/{id}/detailed-grade
     * Chấm thủ công với nhận xét chi tiết
     */
    public function detailedGrade(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $submission = Submission::with(['exam', 'user'])
                                ->where('sId', $id)
                                ->first();

        if (!$submission || !$this->teacherCanAccessSubmission($user, $submission)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài làm.'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'question_grades' => 'required|array',
            'question_grades.*.question_id' => 'required|integer',
            'question_grades.*.points_awarded' => 'required|numeric|min:0',
            'question_grades.*.feedback' => 'nullable|string',
            'question_grades.*.is_correct' => 'nullable|boolean',
            'overall_feedback' => 'nullable|string',
            'strengths' => 'nullable|array',
            'improvements' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        try {
            // Update individual question grades with detailed feedback
            foreach ($request->question_grades as $gradeData) {
                $submissionAnswer = SubmissionAnswer::where('submission_id', $id)
                                                   ->where('question_id', $gradeData['question_id'])
                                                   ->first();

                if ($submissionAnswer) {
                    $submissionAnswer->update([
                        'saPoints_awarded' => $gradeData['points_awarded'],
                        'saIs_correct' => $gradeData['is_correct'] ?? null,
                        'saTeacher_feedback' => $gradeData['feedback'] ?? null
                    ]);
                }
            }

            // Prepare detailed feedback
            $detailedFeedback = [
                'overall_feedback' => $request->overall_feedback,
                'strengths' => $request->strengths ?? [],
                'improvements' => $request->improvements ?? [],
                'graded_by' => $user->uName,
                'graded_at' => now()->toISOString()
            ];

            // Recalculate total score
            $totalScore = $this->calculateTotalScore($id);

            // Update submission with detailed feedback
            $submission->update([
                'sScore' => $totalScore,
                'sStatus' => 'graded',
                'sTeacher_feedback' => json_encode($detailedFeedback),
                'sGraded_time' => now()
            ]);

            return response()->json([
                'status' => 'success',
                'data' => [
                    'submissionId' => $id,
                    'final_score' => $totalScore,
                    'questions_graded' => count($request->question_grades),
                    'detailed_feedback' => $detailedFeedback,
                    'message' => 'Chấm điểm chi tiết hoàn tất'
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi hệ thống khi chấm điểm chi tiết.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * @OA\Get(
     *     path="/teacher/classes/{classId}/report",
     *     tags={"Grading"},
     *     summary="Get class performance report",
     *     description="Get detailed performance report for a class including statistics and analysis",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="classId",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Parameter(
     *         name="exam_id",
     *         in="query",
     *         required=false,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=200, description="Class report generated successfully")
     * )
     *
     * GET /api/teacher/classes/{classId}/report
     * Xem báo cáo kết quả lớp học
     */
    public function classReport(Request $request, $classId)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        // Get class information
        $class = \App\Models\Classes::find($classId);
        if (!$class) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy lớp học.'
            ], 404);
        }

        // Get students in class - use users.class_id instead of class_enrollments
        $studentIds = DB::table('users')
                       ->where('class_id', $classId)
                       ->where('uRole', 'student')
                       ->whereNull('uDeleted_at')
                       ->pluck('uId');

        if ($studentIds->isEmpty()) {
            return response()->json([
                'status' => 'success',
                'data' => [
                    'class' => $class,
                    'message' => 'Lớp học chưa có học sinh nào.'
                ]
            ]);
        }

        // Build query for submissions
        $submissionsQuery = Submission::with(['user', 'exam'])
                                     ->whereIn('user_id', $studentIds)
                                     ->where('sStatus', 'graded');
        $this->applyTeacherSubmissionAccess($submissionsQuery, $user);

        // Filter by exam if specified
        if ($request->has('exam_id')) {
            $submissionsQuery->where('exam_id', $request->exam_id);
        }

        $submissions = $submissionsQuery->get();

        // Calculate statistics
        $statistics = $this->calculateClassStatistics($submissions, $studentIds);

        // Get performance by exam
        $examPerformance = $this->getExamPerformance($submissions);

        // Get student rankings
        $studentRankings = $this->getStudentRankings($submissions);

        // Get question analysis
        $questionAnalysis = $this->getQuestionAnalysis($submissions);

        return response()->json([
            'status' => 'success',
            'data' => [
                'class' => [
                    'cId' => $class->cId,
                    'cName' => $class->cName,
                    'total_students' => $studentIds->count()
                ],
                'statistics' => $statistics,
                'exam_performance' => $examPerformance,
                'student_rankings' => $studentRankings,
                'question_analysis' => $questionAnalysis,
                'generated_at' => now()->toISOString()
            ]
        ]);
    }

    /**
     * @OA\Get(
     *     path="/teacher/grading/statistics",
     *     tags={"Grading"},
     *     summary="Get grading statistics",
     *     description="Get overall grading statistics for teacher",
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(response=200, description="Grading statistics retrieved successfully")
     * )
     *
     * GET /api/teacher/grading/statistics
     * Thống kê chấm điểm tổng quan
     */
    public function gradingStatistics(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $submissionsQuery = Submission::with('exam');
        $this->applyTeacherSubmissionAccess($submissionsQuery, $user);
        $submissions = $submissionsQuery->get();

        $totalSubmissions = $submissions->count();
        // "Đã chấm" = đã có giáo viên xét duyệt (teacher_reviewed_at NOT NULL)
        // — đồng bộ với KPI "Đã xét duyệt" trên trang queue.
        $gradedSubmissions  = $submissions->whereNotNull('teacher_reviewed_at')->count();
        // "Chờ chấm" = mọi submission còn lại (chưa được GV xét duyệt).
        // Bao gồm: submitted, partially_graded, in_progress, ai_graded, và cả những bài
        // sStatus='graded' nhưng GV chưa xác nhận review.
        $pendingSubmissions = $totalSubmissions - $gradedSubmissions;

        // Average scores by exam type
        $scoresByExamType = $submissions->where('sStatus', 'graded')
                                      ->groupBy('exam.eType')
                                      ->map(function($group) {
                                          return [
                                              'count' => $group->count(),
                                              'average_score' => round($group->avg('sScore'), 2),
                                              'highest_score' => $group->max('sScore'),
                                              'lowest_score' => $group->min('sScore')
                                          ];
                                      });

        // Recent grading activity
        $recentActivity = $submissions->where('sStatus', 'graded')
                                    ->where('sGraded_time', '>=', now()->subDays(7))
                                    ->count();

        // Trend: last 7 days of grading activity
        $trend7d = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = now()->subDays($i);
            $count = $submissions->where('sStatus', 'graded')
                ->filter(function($s) use ($day) {
                    return $s->sGraded_time && $s->sGraded_time->toDateString() === $day->toDateString();
                })->count();
            $trend7d[] = ['date' => $day->format('d/m'), 'graded' => $count];
        }

        // By skill — group graded submissions by exam.eType
        $gradedSubs = $submissions->where('sStatus', 'graded');
        $bySkill = ['listening' => 0, 'reading' => 0, 'writing' => 0, 'speaking' => 0];
        foreach ($gradedSubs as $sub) {
            $type = strtolower($sub->exam->eType ?? '');
            if (isset($bySkill[$type])) $bySkill[$type]++;
        }

        // Score distribution (from graded submissions)
        // Phải quy về thang 10 trước khi phân nhóm: sScore của đề THPT đã là hệ 10
        // nên bài 9.25/10 trước đây rơi vào nhóm "0-59" cùng với bài trượt.
        // Nhãn nhóm giữ nguyên dạng phần trăm vì frontend đang đọc theo key này.
        $scores = $gradedSubs
            ->map(fn($sub) => ScoreScale::normalizedTen($sub))
            ->filter(fn($v) => $v !== null)
            ->map(fn($v) => $v * 10); // 0-10 -> 0-100 để khớp ngưỡng nhóm
        $scoreDist = [
            '90-100' => $scores->filter(fn($s) => $s >= 90)->count(),
            '80-89'  => $scores->filter(fn($s) => $s >= 80 && $s < 90)->count(),
            '70-79'  => $scores->filter(fn($s) => $s >= 70 && $s < 80)->count(),
            '60-69'  => $scores->filter(fn($s) => $s >= 60 && $s < 70)->count(),
            '0-59'   => $scores->filter(fn($s) => $s < 60)->count(),
        ];

        // Top 5 students by average score (min 1 graded submission)
        // Điểm TB trả về theo thang 10 — trước đây cộng thẳng sScore nên học viên
        // làm đề GENERAL (phần trăm) luôn đứng trên học viên làm đề THPT (hệ 10).
        $topStudents = $gradedSubs->groupBy('user_id')
            ->map(function($group) {
                $student = $group->first()->user;
                $avg = ScoreScale::averageTen($group);
                return [
                    'name'       => $student ? $student->uName : 'Unknown',
                    'avatar_url' => $student ? $student->avatar_url : null,
                    'user_id'    => $student ? $student->uId : null,
                    'count'      => $group->count(),
                    'avg'        => $avg !== null ? round($avg, 1) : 0,
                ];
            })
            ->sortByDesc('avg')
            ->take(5)
            ->values();

        // Top 5 exams with most pending submissions
        $pendingByExam = $submissions->whereIn('sStatus', ['submitted', 'partially_graded'])
            ->groupBy('exam_id')
            ->map(function($group) {
                $exam = $group->first()->exam;
                return [
                    'title' => $exam ? $exam->eTitle : 'Unknown',
                    'type'  => $exam ? $exam->eType : '—',
                    'count' => $group->count(),
                ];
            })
            ->sortByDesc('count')
            ->take(5)
            ->values();

        // Top 8 most ACTIVE students — those who submit & take exams the most.
        // Active score = total submissions (any status) regardless of grade outcome.
        $mostActiveStudents = $submissions->groupBy('user_id')
            ->map(function($group) {
                $student = $group->first()->user;
                $graded  = $group->where('sStatus', 'graded');
                $avg     = ScoreScale::averageTen($graded);
                $lastAt  = $group->max('sSubmit_time');
                return [
                    'user_id'         => $student ? $student->uId : null,
                    'name'            => $student ? $student->uName : 'Unknown',
                    'avatar_url'      => $student ? $student->avatar_url : null,
                    'submissions'     => $group->count(),
                    'graded'          => $graded->count(),
                    'avg_score'       => $avg !== null ? round($avg, 1) : 0,
                    'last_submit_at'  => $lastAt ? (string) $lastAt : null,
                ];
            })
            ->sortByDesc('submissions')
            ->take(8)
            ->values();

        // Top 5 students by ACTIVITY STREAK — longest run of consecutive days with submissions.
        // Streak counted from the most recent submission day backwards. If the latest day
        // is older than yesterday, the streak ends (current streak = 0 logic-wise, but we
        // use the longest historical streak per student so consistent learners are highlighted).
        $studentStreaks = $submissions->groupBy('user_id')->map(function($group) {
            $student = $group->first()->user;
            // Distinct submission days (Y-m-d), sorted ascending
            $days = $group->pluck('sSubmit_time')
                ->filter()
                ->map(function($t) { return date('Y-m-d', strtotime((string) $t)); })
                ->unique()
                ->values()
                ->sort()
                ->values();

            if ($days->isEmpty()) {
                return null;
            }

            // Walk through days, track longest run of consecutive days
            $longest = 1;
            $current = 1;
            for ($i = 1; $i < $days->count(); $i++) {
                $prev = strtotime($days[$i - 1]);
                $curr = strtotime($days[$i]);
                $diffDays = (int) round(($curr - $prev) / 86400);
                if ($diffDays === 1) {
                    $current++;
                    if ($current > $longest) $longest = $current;
                } else {
                    $current = 1;
                }
            }

            // Current streak — count back from most recent submission day if it's today/yesterday
            $today = date('Y-m-d');
            $yesterday = date('Y-m-d', strtotime('-1 day'));
            $lastDay = $days->last();
            $currentStreak = 0;
            if ($lastDay === $today || $lastDay === $yesterday) {
                $currentStreak = 1;
                for ($i = $days->count() - 1; $i > 0; $i--) {
                    $prev = strtotime($days[$i - 1]);
                    $curr = strtotime($days[$i]);
                    if ((int) round(($curr - $prev) / 86400) === 1) {
                        $currentStreak++;
                    } else {
                        break;
                    }
                }
            }

            return [
                'user_id'        => $student ? $student->uId : null,
                'name'           => $student ? $student->uName : 'Unknown',
                'avatar_url'     => $student ? $student->avatar_url : null,
                'longest_streak' => $longest,
                'current_streak' => $currentStreak,
                'active_days'    => $days->count(),
                'last_active_at' => $lastDay,
            ];
        })->filter()->sortByDesc(function($s) {
            // Prioritize current streak > longest streak > active days
            return ($s['current_streak'] * 10000) + ($s['longest_streak'] * 100) + $s['active_days'];
        })->take(5)->values();

        return response()->json([
            'status' => 'success',
            'data' => [
                'total_submissions'       => $totalSubmissions,
                'graded_submissions'      => $gradedSubmissions,
                'pending_submissions'     => $pendingSubmissions,
                'grading_completion_rate' => $totalSubmissions > 0 ? round(($gradedSubmissions / $totalSubmissions) * 100, 2) : 0,
                'scores_by_exam_type'     => $scoresByExamType,
                'recent_grading_activity' => $recentActivity,
                'average_grading_time'    => $this->calculateAverageGradingTime($submissions),
                'trend_7d'                => $trend7d,
                'by_skill'                => $bySkill,
                'score_dist'              => $scoreDist,
                'top_students'            => $topStudents,
                'most_active_students'    => $mostActiveStudents,
                'student_streaks'         => $studentStreaks,
                'pending_by_exam'         => $pendingByExam,
            ]
        ]);
    }

    /**
     * Check if an answer is correct for auto-grading
     */
    private function checkAnswer($question, $studentAnswer)
    {
        $correctAnswers = $question->answers()->where('aIs_correct', true)->get();

        if ($correctAnswers->isEmpty()) {
            return false;
        }

        $studentAnswer = trim(strtolower($studentAnswer));

        foreach ($correctAnswers as $correctAnswer) {
            $correctText = trim(strtolower($correctAnswer->aContent));

            // Exact match for multiple choice
            if ($question->qType === 'multiple_choice') {
                if ($studentAnswer === $correctText) {
                    return true;
                }
            }

            // Flexible matching for fill-in-blank
            if ($question->qType === 'fill_blank') {
                // Remove extra spaces and check
                if (str_replace(' ', '', $studentAnswer) === str_replace(' ', '', $correctText)) {
                    return true;
                }
            }

            // Boolean questions
            if (in_array($question->qType, ['true_false_not_given', 'yes_no_not_given'])) {
                if ($studentAnswer === $correctText) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Calculate class statistics
     */
    private function calculateClassStatistics($submissions, $studentIds)
    {
        $totalStudents = $studentIds->count();
        $studentsWithSubmissions = $submissions->pluck('user_id')->unique()->count();

        if ($submissions->isEmpty()) {
            return [
                'total_students' => $totalStudents,
                'students_with_submissions' => 0,
                'participation_rate' => 0,
                'average_score' => 0,
                'pass_rate' => 0,
                'score_distribution' => []
            ];
        }

        $scores = $submissions->pluck('sScore')->filter();
        $averageScore = round($scores->avg(), 2);
        $passCount = $scores->filter(function($score) { return $score >= 60; })->count();
        $passRate = round(($passCount / $scores->count()) * 100, 2);

        // Score distribution
        $scoreDistribution = [
            '90-100' => $scores->filter(function($s) { return $s >= 90; })->count(),
            '80-89' => $scores->filter(function($s) { return $s >= 80 && $s < 90; })->count(),
            '70-79' => $scores->filter(function($s) { return $s >= 70 && $s < 80; })->count(),
            '60-69' => $scores->filter(function($s) { return $s >= 60 && $s < 70; })->count(),
            '0-59' => $scores->filter(function($s) { return $s < 60; })->count(),
        ];

        return [
            'total_students' => $totalStudents,
            'students_with_submissions' => $studentsWithSubmissions,
            'participation_rate' => round(($studentsWithSubmissions / $totalStudents) * 100, 2),
            'average_score' => $averageScore,
            'highest_score' => $scores->max(),
            'lowest_score' => $scores->min(),
            'pass_rate' => $passRate,
            'score_distribution' => $scoreDistribution
        ];
    }

    /**
     * Get exam performance breakdown
     */
    private function getExamPerformance($submissions)
    {
        return $submissions->groupBy('exam_id')->map(function($examSubmissions) {
            $exam = $examSubmissions->first()->exam;
            $scores = $examSubmissions->pluck('sScore')->filter();

            return [
                'exam_id' => $exam->eId,
                'exam_title' => $exam->eTitle,
                'exam_type' => $exam->eType,
                'submissions_count' => $examSubmissions->count(),
                'average_score' => round($scores->avg(), 2),
                'highest_score' => $scores->max(),
                'lowest_score' => $scores->min(),
                'pass_rate' => round($scores->filter(function($s) { return $s >= 60; })->count() / $scores->count() * 100, 2)
            ];
        })->values();
    }

    /**
     * Get student rankings
     */
    private function getStudentRankings($submissions)
    {
        return $submissions->groupBy('user_id')->map(function($studentSubmissions) {
            $student = $studentSubmissions->first()->user;
            $scores = $studentSubmissions->pluck('sScore')->filter();

            return [
                'student_id' => $student->uId,
                'student_name' => $student->uName,
                'submissions_count' => $studentSubmissions->count(),
                'average_score' => round($scores->avg(), 2),
                'highest_score' => $scores->max(),
                'total_points' => $scores->sum()
            ];
        })->sortByDesc('average_score')->values();
    }

    /**
     * Get question analysis
     */
    private function getQuestionAnalysis($submissions)
    {
        $questionStats = [];

        foreach ($submissions as $submission) {
            foreach ($submission->answers as $answer) {
                $questionId = $answer->question_id;

                if (!isset($questionStats[$questionId])) {
                    $questionStats[$questionId] = [
                        'question_id' => $questionId,
                        'question_text' => $answer->question->qContent ?? 'N/A',
                        'question_type' => $answer->question->qType ?? 'N/A',
                        'total_attempts' => 0,
                        'correct_attempts' => 0,
                        'average_score' => 0,
                        'total_points' => 0
                    ];
                }

                $questionStats[$questionId]['total_attempts']++;
                if ($answer->saIs_correct) {
                    $questionStats[$questionId]['correct_attempts']++;
                }
                $questionStats[$questionId]['total_points'] += $answer->saPoints_awarded ?? 0;
            }
        }

        // Calculate averages and success rates
        foreach ($questionStats as &$stat) {
            $stat['success_rate'] = $stat['total_attempts'] > 0 ?
                round(($stat['correct_attempts'] / $stat['total_attempts']) * 100, 2) : 0;
            $stat['average_score'] = $stat['total_attempts'] > 0 ?
                round($stat['total_points'] / $stat['total_attempts'], 2) : 0;
        }

        return array_values($questionStats);
    }

    /**
     * Calculate average grading time
     */
    private function calculateAverageGradingTime($submissions)
    {
        $gradedSubmissions = $submissions->where('sStatus', 'graded')
                                       ->whereNotNull('sSubmit_time')
                                       ->whereNotNull('sGraded_time');

        if ($gradedSubmissions->isEmpty()) {
            return 0;
        }

        $totalMinutes = 0;
        foreach ($gradedSubmissions as $submission) {
            $submitTime = \Carbon\Carbon::parse($submission->sSubmit_time);
            $gradedTime = \Carbon\Carbon::parse($submission->sGraded_time);
            $totalMinutes += $submitTime->diffInMinutes($gradedTime);
        }

        return round($totalMinutes / $gradedSubmissions->count(), 2);
    }

    /**
     * Calculate total score for a submission
     */
    private function calculateTotalScore($submissionId)
    {
        $submission = Submission::with(['answers.question', 'exam'])->find($submissionId);
        if (!$submission) {
            return 0;
        }

        $isVstep = strtoupper($submission->exam->eType ?? '') === 'VSTEP';
        if ($isVstep) {
            $listeningCorrect = 0;
            $listeningMax = 0;
            $readingCorrect = 0;
            $readingMax = 0;
            $writingScores = [];
            $speakingScores = [];

            foreach ($submission->answers as $ans) {
                if (!$ans->question) continue;
                $sec = strtolower($ans->question->qSkill ?? $ans->question->qSection ?? '');
                $qPoints = $ans->question->qPoints ?? 1;
                // Self-heal: writing/speaking fallback saAi_score nếu saPoints null
                $isSubjective = in_array($sec, ['writing', 'speaking'], true);
                $pointsAwarded = $isSubjective
                    ? ($ans->saPoints_awarded ?? $ans->saAi_score ?? 0)
                    : ($ans->saPoints_awarded ?? 0);

                if ($sec === 'listening') {
                    $listeningMax += $qPoints;
                    $listeningCorrect += $pointsAwarded;
                } elseif ($sec === 'reading') {
                    $readingMax += $qPoints;
                    $readingCorrect += $pointsAwarded;
                } elseif ($sec === 'writing') {
                    $writingScores[] = $pointsAwarded;
                } elseif ($sec === 'speaking') {
                    $speakingScores[] = $pointsAwarded;
                }
            }

            $listeningScore = $listeningMax > 0 ? round(($listeningCorrect / $listeningMax) * 10, 2) : null;
            $readingScore = $readingMax > 0 ? round(($readingCorrect / $readingMax) * 10, 2) : null;
            $writingScore = count($writingScores) > 0 ? round(array_sum($writingScores) / count($writingScores), 2) : null;
            $speakingScore = count($speakingScores) > 0 ? round(array_sum($speakingScores) / count($speakingScores), 2) : null;

            // Read and update sGemini_feedback's vstep_scores
            $raw = $submission->sGemini_feedback ? (json_decode($submission->sGemini_feedback, true) ?: []) : [];
            $vstepScores = $raw['vstep_scores'] ?? [];

            if (!is_null($listeningScore)) $vstepScores['listening'] = $listeningScore;
            if (!is_null($readingScore)) $vstepScores['reading'] = $readingScore;
            if (!is_null($writingScore)) $vstepScores['writing'] = $writingScore;
            if (!is_null($speakingScore)) $vstepScores['speaking'] = $speakingScore;

            $raw['vstep_scores'] = $vstepScores;
            $submission->sGemini_feedback = json_encode($raw);
            $submission->save();

            // Recalculate average
            $available = array_filter([
                $vstepScores['listening'] ?? null,
                $vstepScores['reading']   ?? null,
                $vstepScores['writing']   ?? null,
                $vstepScores['speaking']  ?? null,
            ], fn($v) => !is_null($v));

            $overallAvg = count($available) > 0 ? round(array_sum($available) / count($available), 2) : 0;
            return round($overallAvg * 10, 2);
        }

        $totalPoints = 0;
        $maxPoints = 0;

        foreach ($submission->answers as $answer) {
            if (!$answer->question) continue;
            $maxPoints += $answer->question->qPoints;
            $totalPoints += $answer->saPoints_awarded ?? 0;
        }

        if ($maxPoints == 0) {
            return 0;
        }

        return round(($totalPoints / $maxPoints) * 100, 2);
    }

    /**
     * POST /api/teacher/questions/{questionId}/override-correct-answer
     * Sửa đáp án đúng của câu hỏi và cập nhật bài chấm hiện tại (nếu có)
     */
    public function overrideCorrectAnswer(Request $request, $questionId)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'correct_answer_id' => 'required|integer',
            'submission_id' => 'nullable|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        $correctAnswerId = $request->correct_answer_id;
        $submissionId = $request->submission_id;

        // 1. Verify question and answers exist
        $question = \App\Models\Question::with('answers')->find($questionId);
        if (!$question) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy câu hỏi.'
            ], 404);
        }

        // Verify teacher owns the exam of this question
        $exam = \App\Models\Exam::where('eId', $question->exam_id)
                                ->where('eTeacher_id', $user->uId)
                                ->first();
        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền chỉnh sửa câu hỏi này.'
            ], 403);
        }

        // Verify the correct_answer_id exists in question's answers
        $targetAnswer = $question->answers->where('aId', $correctAnswerId)->first();
        if (!$targetAnswer) {
            return response()->json([
                'status' => 'error',
                'message' => 'Đáp án được chọn không thuộc câu hỏi này.'
            ], 400);
        }

        DB::beginTransaction();
        try {
            // 2. Set the selected answer to correct, others to incorrect
            foreach ($question->answers as $ans) {
                $ans->update([
                    'aIs_correct' => ($ans->aId == $correctAnswerId)
                ]);
            }

            $responseData = [
                'message' => 'Cập nhật đáp án đúng thành công.'
            ];

            // 3. Update all submissions' answers and scores for this question to ensure consistency
            $subAnswers = SubmissionAnswer::where('question_id', $questionId)->get();

            // Lock all affected submissions in sorted order to prevent deadlocks and ensure consistency under concurrent load
            $submissionIds = $subAnswers->pluck('submission_id')->unique()->sort()->values()->toArray();
            if (!empty($submissionIds)) {
                Submission::whereIn('sId', $submissionIds)->lockForUpdate()->get();
            }

            // We also check letter-based matching (A, B, C, D)
            // Retrieve all answers of the question sorted by aOrder if available, else aId
            $firstAnswer = $question->answers->first();
            $hasOrder = $firstAnswer && $firstAnswer->aOrder !== null;
            $allAnswers = $hasOrder
                ? $question->answers->sortBy('aOrder')->values()
                : $question->answers->sortBy('aId')->values();

            $targetIndex = -1;
            foreach ($allAnswers as $idx => $ans) {
                if ($ans->aId == $correctAnswerId) {
                    $targetIndex = $idx;
                    break;
                }
            }

            $letters = ['a', 'b', 'c', 'd'];
            $targetLetter = ($targetIndex >= 0 && $targetIndex < count($letters)) ? $letters[$targetIndex] : '';
            $newCorrectText = trim(strtolower($targetAnswer->aContent));

            foreach ($subAnswers as $subAnswer) {
                $studentAnswerText = trim(strtolower($subAnswer->saAnswer_text));

                $isCorrect = false;
                if ($studentAnswerText === $newCorrectText) {
                    $isCorrect = true;
                } else if (!empty($targetLetter) && $studentAnswerText === $targetLetter) {
                    $isCorrect = true;
                }

                $points = $isCorrect ? ($question->qPoints ?? 1) : 0;

                $subAnswer->update([
                    'saIs_correct' => $isCorrect,
                    'saPoints_awarded' => $points,
                ]);

                // Recalculate total score of submission
                $totalScore = $this->calculateTotalScore($subAnswer->submission_id);
                $sub = Submission::find($subAnswer->submission_id);
                if ($sub) {
                    $sub->update([
                        'sScore' => $totalScore
                    ]);
                }

                if ($submissionId && $subAnswer->submission_id == $submissionId) {
                    $responseData['submission'] = [
                        'sScore' => $totalScore,
                        'question_points' => $points,
                        'question_is_correct' => $isCorrect
                    ];
                }
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'data' => $responseData
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi hệ thống khi cập nhật đáp án đúng.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /api/teacher/submissions/bulk-approve
     * Phê duyệt hàng loạt bài làm (giữ nguyên điểm hiện có / điểm AI).
     * Body: { submission_ids: number[], feedback?: string }
     */
    public function bulkApprove(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'submission_ids'   => 'required|array|min:1|max:100',
            'submission_ids.*' => 'required|integer',
            'feedback'         => 'nullable|string|max:2000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors'  => $validator->errors(),
            ], 400);
        }

        $ids = array_values(array_unique(array_map('intval', $request->submission_ids)));
        $feedback = $request->input('feedback');

        try {
            $submissions = Submission::with(['exam', 'user'])
                ->whereIn('sId', $ids)
                ->get()
                ->filter(fn ($s) => $this->teacherCanAccessSubmission($user, $s))
                ->values();

            if ($submissions->isEmpty()) {
                return response()->json([
                    'status'  => 'error',
                    'message' => 'Không tìm thấy bài làm hợp lệ để phê duyệt.',
                ], 404);
            }

            $now = now();
            $approved = [];
            $skipped = [];

            DB::beginTransaction();

            foreach ($submissions as $submission) {
                // Chỉ phê duyệt bài đã nộp / đã chấm (AI hoặc thủ công)
                if (!in_array($submission->sStatus, ['submitted', 'graded', 'partially_graded', 'ai_graded'], true)) {
                    $skipped[] = [
                        'id'     => $submission->sId,
                        'reason' => 'Bài làm chưa được nộp hoặc không thể phê duyệt.',
                    ];
                    continue;
                }

                $payload = [
                    'sStatus'             => 'graded',
                    'sGraded_time'        => $submission->sGraded_time ?? $now,
                    'teacher_reviewed_at' => $now,
                ];

                // Chỉ ghi feedback nếu teacher gửi kèm (không xoá feedback cũ)
                if (!is_null($feedback) && $feedback !== '') {
                    $payload['sTeacher_feedback'] = $feedback;
                }

                $submission->update($payload);
                $approved[] = $submission->sId;
            }

            DB::commit();

            $notFound = array_values(array_diff($ids, $submissions->pluck('sId')->all()));
            foreach ($notFound as $missingId) {
                $skipped[] = [
                    'id'     => $missingId,
                    'reason' => 'Không tìm thấy hoặc không thuộc quyền của bạn.',
                ];
            }

            return response()->json([
                'status' => 'success',
                'data'   => [
                    'approved_ids'   => $approved,
                    'approved_count' => count($approved),
                    'skipped'        => $skipped,
                    'teacher_reviewed_at' => $now->toISOString(),
                    'message'        => 'Đã phê duyệt ' . count($approved) . ' bài làm.',
                ],
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status'  => 'error',
                'message' => 'Lỗi hệ thống khi phê duyệt hàng loạt.',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * DELETE /api/teacher/submissions/{id}
     * Xóa kết quả làm bài của học viên (bao gồm câu trả lời và lịch sử chấm điểm liên quan)
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $submission = Submission::with(['exam', 'user'])
                                ->where('sId', $id)
                                ->first();

        if (!$submission || !$this->teacherCanAccessSubmission($user, $submission)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài làm hoặc bài làm không thuộc quyền quản lý của bạn.'
            ], 404);
        }

        try {
            \Illuminate\Support\Facades\DB::beginTransaction();

            // Xóa lịch sử chấm điểm (grading history)
            \Illuminate\Support\Facades\DB::table('grading_history')->where('submission_id', $submission->sId)->delete();

            // Xóa các câu trả lời chi tiết (submission answers)
            \Illuminate\Support\Facades\DB::table('submission_answers')->where('submission_id', $submission->sId)->delete();

            // Xóa chính bài làm (submission)
            $submission->delete();

            \Illuminate\Support\Facades\DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Đã xóa bài làm của học sinh thành công.'
            ]);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi hệ thống khi xóa bài làm.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /api/teacher/submissions/bulk-delete
     * Xóa hàng loạt kết quả bài làm của học sinh
     */
    public function bulkDelete(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $ids = $request->input('submission_ids', []);
        if (empty($ids)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Vui lòng chọn danh sách bài làm cần xóa.'
            ], 400);
        }

        // Lấy danh sách bài làm hợp lệ thuộc quyền của giáo viên
        $submissions = Submission::with(['exam', 'user'])
                                 ->whereIn('sId', $ids)
                                 ->get()
                                 ->filter(fn ($s) => $this->teacherCanAccessSubmission($user, $s))
                                 ->values();

        if ($submissions->isEmpty()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài làm nào hợp lệ để xóa.'
            ], 404);
        }

        try {
            \Illuminate\Support\Facades\DB::beginTransaction();

            $submissionIds = $submissions->pluck('sId')->all();

            // 1. Xóa lịch sử chấm điểm liên quan
            \Illuminate\Support\Facades\DB::table('grading_history')->whereIn('submission_id', $submissionIds)->delete();

            // 2. Xóa các câu trả lời chi tiết
            \Illuminate\Support\Facades\DB::table('submission_answers')->whereIn('submission_id', $submissionIds)->delete();

            // 3. Xóa các bài làm chính
            Submission::whereIn('sId', $submissionIds)->delete();

            \Illuminate\Support\Facades\DB::commit();

            $notFound = array_values(array_diff($ids, $submissionIds));
            $skippedCount = count($notFound);

            return response()->json([
                'status' => 'success',
                'data' => [
                    'deleted_ids' => $submissionIds,
                    'deleted_count' => count($submissionIds),
                    'skipped_count' => $skippedCount,
                    'message' => 'Đã xóa thành công ' . count($submissionIds) . ' bài làm.' . ($skippedCount > 0 ? " Bỏ qua {$skippedCount} bài không hợp lệ." : "")
                ]
            ]);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi hệ thống khi xóa hàng loạt.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /api/teacher/pinned-students
     * Lấy danh sách student_id đã ghim của giáo viên hiện tại.
     */
    public function pinnedStudents(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $studentIds = TeacherPinnedStudent::where('teacher_id', $user->uId)
            ->orderBy('created_at', 'desc')
            ->pluck('student_id')
            ->map(fn ($id) => (string) $id)
            ->values()
            ->all();

        return response()->json([
            'status' => 'success',
            'data' => [
                'student_ids' => $studentIds,
            ],
        ]);
    }

    /**
     * POST /api/teacher/pinned-students
     * Ghim một học viên (theo student_id).
     */
    public function pinStudent(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'student_id' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $studentId = (int) $request->input('student_id');

        $student = User::where('uId', $studentId)
            ->where('uRole', 'student')
            ->first();

        if (!$student) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy học viên.',
            ], 404);
        }

        TeacherPinnedStudent::firstOrCreate([
            'teacher_id' => $user->uId,
            'student_id' => $studentId,
        ]);

        $studentIds = TeacherPinnedStudent::where('teacher_id', $user->uId)
            ->orderBy('created_at', 'desc')
            ->pluck('student_id')
            ->map(fn ($id) => (string) $id)
            ->values()
            ->all();

        return response()->json([
            'status' => 'success',
            'message' => 'Đã ghim học viên.',
            'data' => [
                'student_ids' => $studentIds,
            ],
        ]);
    }

    /**
     * DELETE /api/teacher/pinned-students/{studentId}
     * Bỏ ghim một học viên.
     */
    public function unpinStudent(Request $request, $studentId)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $studentId = (int) $studentId;
        if ($studentId <= 0) {
            return response()->json([
                'status' => 'error',
                'message' => 'student_id không hợp lệ.',
            ], 422);
        }

        TeacherPinnedStudent::where('teacher_id', $user->uId)
            ->where('student_id', $studentId)
            ->delete();

        $studentIds = TeacherPinnedStudent::where('teacher_id', $user->uId)
            ->orderBy('created_at', 'desc')
            ->pluck('student_id')
            ->map(fn ($id) => (string) $id)
            ->values()
            ->all();

        return response()->json([
            'status' => 'success',
            'message' => 'Đã bỏ ghim học viên.',
            'data' => [
                'student_ids' => $studentIds,
            ],
        ]);
    }

    /**
     * Gắn assignment_id cho các submission đã nộp nhưng bị null.
     * Bug gốc: start-teens/start-kids/start-direct tạo submission không
     * set assignment_id → tab "Bài giao" (source=assigned) của giáo viên
     * không thấy bài.
     *
     * Không lọc theo eTeacher_id: GV có thể giao đề ngân hàng của người khác.
     * Không chặn assignment đã quá hạn: học viên có thể đã nộp trước deadline.
     *
     * QUAN TRỌNG: chỉ gắn assignment đã tồn tại tại thời điểm học viên bắt
     * đầu làm (taCreated_at <= sStart_time). Tránh "nhiễm" lượt giao mới
     * bằng submission cũ → hiện tượng "hết lượt" ngay khi GV giao lại cùng đề.
     */
    private function backfillMissingAssignmentIds(int $teacherId): void
    {
        $managedClassIds = $this->teacherManagedClassIds($teacherId);
        if (empty($managedClassIds)) {
            // Vẫn cho phép backfill submission thuộc đề do chính GV tạo
            // (học viên target=student, không có class).
        }

        $orphans = Submission::query()
            ->whereNull('assignment_id')
            ->whereNotIn('sStatus', ['draft', 'in_progress'])
            ->where(function ($q) use ($teacherId, $managedClassIds) {
                $q->whereHas('exam', function ($eq) use ($teacherId) {
                    $eq->where('eTeacher_id', $teacherId);
                });
                if (!empty($managedClassIds)) {
                    $q->orWhereHas('user', function ($uq) use ($managedClassIds) {
                        $uq->whereIn('class_id', $managedClassIds);
                    });
                }
            })
            ->with(['user:uId,class_id'])
            ->limit(300)
            ->get(['sId', 'user_id', 'exam_id', 'assignment_id', 'sStart_time', 'sSubmit_time']);

        if ($orphans->isEmpty()) {
            return;
        }

        foreach ($orphans as $sub) {
            if (!$sub->user || !$sub->exam_id) {
                continue;
            }
            $student = $sub->user;
            $classIds = $student->class_id ? [(int) $student->class_id] : [];

            $at = $sub->sStart_time ?? $sub->sSubmit_time ?? null;
            $atCarbon = null;
            if ($at !== null) {
                try {
                    $atCarbon = \Carbon\Carbon::parse($at);
                } catch (\Throwable $e) {
                    $atCarbon = null;
                }
            }

            $candidates = TestAssignment::where('exam_id', $sub->exam_id)
                ->where(function ($q) use ($student, $classIds) {
                    $q->where(function ($qq) use ($student) {
                        $qq->where('taTarget_type', 'student')
                            ->where('taTarget_id', $student->uId);
                    })->orWhere(function ($qq) use ($classIds) {
                        if (empty($classIds)) {
                            $qq->whereRaw('1 = 0');
                            return;
                        }
                        $qq->where('taTarget_type', 'class')
                            ->whereIn('taTarget_id', $classIds);
                    });
                })
                // Chỉ assignment đã tồn tại lúc HV bắt đầu làm bài.
                ->when($atCarbon, function ($q) use ($atCarbon) {
                    $q->where(function ($qq) use ($atCarbon) {
                        $qq->whereNull('taCreated_at')
                            ->orWhere('taCreated_at', '<=', $atCarbon);
                    });
                })
                // KHÔNG lọc deadline: bài đã nộp trước hạn vẫn cần gắn lại.
                ->orderByRaw("CASE WHEN taTarget_type = 'student' THEN 0 ELSE 1 END")
                ->orderByDesc('taId')
                ->limit(1)
                ->get(['taId']);

            if ($candidates->isEmpty()) {
                continue;
            }
            $sub->assignment_id = (int) $candidates->first()->taId;
            $sub->save();
        }
    }

    /**
     * Các lớp mà GV là chủ hoặc co-teacher (accepted).
     */
    private function teacherManagedClassIds(int $teacherId): array
    {
        $owned = Classes::where('cTeacher_id', $teacherId)->pluck('cId')->all();
        $co = ClassCoTeacher::acceptedClassIdsFor($teacherId);
        return array_values(array_unique(array_map('intval', array_merge($owned, $co))));
    }

    /**
     * Scope list submissions mà GV được xem/chấm:
     * 1) Chủ đề (exam.eTeacher_id)
     * 2) Chủ/co-GV lớp của học viên
     * 3) Chủ/co-GV lớp được giao qua assignment (taTarget_type=class)
     * 4) Assignment giao trực tiếp học viên thuộc lớp GV quản lý
     */
    private function applyTeacherSubmissionAccess($query, $user)
    {
        $teacherId = (int) $user->uId;
        $classIds = $this->teacherManagedClassIds($teacherId);

        $query->where(function ($outer) use ($teacherId, $classIds) {
            // 1) Chủ đề
            $outer->whereHas('exam', function ($q) use ($teacherId) {
                $q->where('eTeacher_id', $teacherId);
            });

            if (!empty($classIds)) {
                // 2) Học viên thuộc lớp GV quản lý
                $outer->orWhereHas('user', function ($q) use ($classIds) {
                    $q->whereIn('class_id', $classIds);
                });

                // 3) Assignment giao cho lớp GV quản lý
                $outer->orWhereIn('assignment_id', function ($sub) use ($classIds) {
                    $sub->select('taId')
                        ->from('test_assignments')
                        ->where('taTarget_type', 'class')
                        ->whereIn('taTarget_id', $classIds);
                });

                // 4) Assignment giao TRỰC TIẾP cho học viên thuộc lớp GV quản lý.
                // Nhánh này từng bị thiếu dù docblock có nêu: teacherCanAccessSubmission()
                // cho phép chấm bài đó, nhưng query danh sách lại không trả về → GV
                // không thấy bài cần chấm, chỉ vào được nếu biết ID.
                // Không trùng nhánh 2: học viên có thể đã chuyển lớp (hoặc chưa có
                // class_id) sau khi được giao bài.
                $outer->orWhereIn('assignment_id', function ($sub) use ($classIds) {
                    $sub->select('taId')
                        ->from('test_assignments')
                        ->where('taTarget_type', 'student')
                        ->whereIn('taTarget_id', function ($u) use ($classIds) {
                            $u->select('uId')
                                ->from('users')
                                ->whereIn('class_id', $classIds);
                        });
                });
            }
        });

        return $query;
    }

    /**
     * Kiểm tra 1 submission có thuộc quyền chấm của GV không.
     */
    private function teacherCanAccessSubmission($user, Submission $submission): bool
    {
        if (!$user || $user->uRole !== 'teacher') {
            return false;
        }
        $teacherId = (int) $user->uId;

        // 1) Chủ đề
        $examTeacherId = $submission->exam->eTeacher_id
            ?? Exam::where('eId', $submission->exam_id)->value('eTeacher_id');
        if ((int) $examTeacherId === $teacherId) {
            return true;
        }

        $classIds = $this->teacherManagedClassIds($teacherId);
        if (empty($classIds)) {
            return false;
        }

        // 2) Học viên thuộc lớp GV
        $studentClassId = $submission->user->class_id
            ?? User::where('uId', $submission->user_id)->value('class_id');
        if ($studentClassId && in_array((int) $studentClassId, $classIds, true)) {
            return true;
        }

        // 3) Assignment giao cho lớp GV
        if ($submission->assignment_id) {
            $assignment = TestAssignment::where('taId', $submission->assignment_id)->first(['taId', 'taTarget_type', 'taTarget_id']);
            if ($assignment) {
                if ($assignment->taTarget_type === 'class'
                    && in_array((int) $assignment->taTarget_id, $classIds, true)) {
                    return true;
                }
                if ($assignment->taTarget_type === 'student') {
                    $targetClass = User::where('uId', $assignment->taTarget_id)->value('class_id');
                    if ($targetClass && in_array((int) $targetClass, $classIds, true)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }
}
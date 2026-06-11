<?php

namespace App\Http\Controllers;

use App\Jobs\GradeVstepSubjectiveJob;
use App\Models\GradingHistory;
use App\Models\Submission;
use App\Models\SubmissionAnswer;
use App\Services\GradingReviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * AI-Assisted Grading Review endpoints.
 *
 *   POST   /teacher/submissions/{id}/ai-grade                 — trigger AI grading job
 *   GET    /teacher/submissions/{id}/ai-status                — poll AI job status
 *   POST   /teacher/submissions/{id}/answers/{ansId}/regrade  — regrade single answer
 *   POST   /teacher/submissions/{id}/answers/{ansId}/accept-ai — teacher accepts AI verbatim
 *   POST   /teacher/submissions/{id}/answers/{ansId}/teacher-grade — teacher overrides AI
 *   POST   /teacher/submissions/{id}/save-all                 — finalize submission
 *   GET    /teacher/submissions/{id}/grading-history          — audit log
 */
class GradingReviewController extends Controller
{
    private GradingReviewService $service;

    public function __construct(GradingReviewService $service)
    {
        $this->service = $service;
    }

    /* ─── 1. Trigger AI grading ──────────────────────────────────────── */

    public function triggerAiGrade(Request $request, int $id): JsonResponse
    {
        $teacher = $request->user();
        $submission = $this->ensureSubmissionAccess($id, $teacher);
        if ($submission instanceof JsonResponse) return $submission;

        $force = (bool) $request->input('force', false);

        // Idempotency: if already AI-graded and not force, return current state
        $alreadyAi = $submission->answers()
            ->whereNotNull('saAi_score')
            ->exists();

        if ($alreadyAi && !$force) {
            return response()->json([
                'status' => 'success',
                'data'   => [
                    'queued'  => false,
                    'message' => 'AI đã chấm bài này. Truyền force=true để chấm lại.',
                ],
            ]);
        }

        if (in_array($submission->sStatus, ['ai_grading', 'grading_subjective'], true) && !$force) {
            return response()->json([
                'status'  => 'error',
                'message' => 'AI đang chấm bài, vui lòng đợi.',
            ], 409);
        }

        // Đặt trạng thái 'grading_subjective' — đây là giá trị enum hợp lệ VÀ là
        // trạng thái mà GradeVstepSubjectiveJob::handle() yêu cầu để thực thi.
        // (Job tự chọn IELTSGradingService khi exam.eType === 'IELTS'.)
        $submission->update(['sStatus' => 'grading_subjective']);
        GradeVstepSubjectiveJob::dispatch($submission->sId);

        return response()->json([
            'status' => 'queued',
            'data'   => [
                'queued'             => true,
                'submission_id'      => $submission->sId,
                'estimated_seconds'  => 45,
            ],
        ], 202);
    }

    /* ─── 2. AI status poll ─────────────────────────────────────────── */

    public function aiStatus(Request $request, int $id): JsonResponse
    {
        $teacher = $request->user();
        $submission = $this->ensureSubmissionAccess($id, $teacher);
        if ($submission instanceof JsonResponse) return $submission;

        $raw = $submission->sGemini_feedback
            ? (json_decode($submission->sGemini_feedback, true) ?: [])
            : [];

        $writingAnswers = $submission->answers()
            ->whereHas('question', fn($q) => $q->whereRaw('LOWER(qSkill) = ?', ['writing']))
            ->get();

        $writing = null;
        if ($writingAnswers->isNotEmpty() && $writingAnswers->whereNotNull('saAi_score')->isNotEmpty()) {
            $avg = $writingAnswers->whereNotNull('saAi_score')->avg('saAi_score');
            $writing = [
                'graded_at'      => optional($writingAnswers->max('saAi_graded_at'))->toIso8601String(),
                'model'          => $writingAnswers->first()->saAi_model,
                'overall_score'  => round((float) $avg, 2),
                'tasks_count'    => $writingAnswers->whereNotNull('saAi_score')->count(),
                'pending_review' => $writingAnswers->where('saReview_status', 'pending')->count(),
            ];
        }

        $speaking = null;
        $speakingResults = $raw['speaking_results'] ?? ($raw['ielts_speaking_results'] ?? []);
        if (!empty($speakingResults)) {
            $scores = array_filter(array_map(
                fn($p) => $p['score'] ?? $p['band'] ?? null,
                $speakingResults
            ), fn($v) => $v !== null);
            $speaking = [
                'graded_at'     => $raw['speaking_graded_at'] ?? null,
                'model'         => 'llama-3.3-70b-versatile + whisper-large-v3-turbo',
                'overall_score' => count($scores) ? round(array_sum($scores) / count($scores), 2) : null,
                'parts_count'   => count($scores),
            ];
        }

        return response()->json([
            'status' => 'success',
            'data'   => [
                'submission_status' => $submission->sStatus,
                'writing'           => $writing,
                'speaking'          => $speaking,
            ],
        ]);
    }

    /* ─── 3. Regrade one answer ─────────────────────────────────────── */

    public function regradeAnswer(Request $request, int $id, int $ansId): JsonResponse
    {
        $teacher = $request->user();
        $submission = $this->ensureSubmissionAccess($id, $teacher);
        if ($submission instanceof JsonResponse) return $submission;

        $answer = SubmissionAnswer::with('question')->where('saId', $ansId)
            ->where('submission_id', $id)
            ->first();
        if (!$answer) {
            return response()->json(['status' => 'error', 'message' => 'Answer not found.'], 404);
        }

        $hint = $request->input('hint');

        try {
            $updated = $this->service->regradeWithAi($answer, $hint);
        } catch (\Throwable $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 422);
        }

        return response()->json([
            'status' => 'success',
            'data'   => $this->serializeAnswer($updated),
        ]);
    }

    /* ─── 4. Teacher accepts AI ─────────────────────────────────────── */

    public function acceptAi(Request $request, int $id, int $ansId): JsonResponse
    {
        $teacher = $request->user();
        $submission = $this->ensureSubmissionAccess($id, $teacher);
        if ($submission instanceof JsonResponse) return $submission;

        $answer = SubmissionAnswer::where('saId', $ansId)
            ->where('submission_id', $id)
            ->first();
        if (!$answer) {
            return response()->json(['status' => 'error', 'message' => 'Answer not found.'], 404);
        }

        try {
            $updated = $this->service->acceptAi($answer, $teacher);
        } catch (\Throwable $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 422);
        }

        return response()->json([
            'status' => 'success',
            'data'   => $this->serializeAnswer($updated),
        ]);
    }

    /* ─── 5. Teacher overrides ───────────────────────────────────────── */

    public function teacherGrade(Request $request, int $id, int $ansId): JsonResponse
    {
        $teacher = $request->user();
        $submission = $this->ensureSubmissionAccess($id, $teacher);
        if ($submission instanceof JsonResponse) return $submission;

        $request->validate([
            'score'             => 'required|numeric|min:0|max:10',
            'feedback'          => 'nullable|string|max:5000',
            'criteria'          => 'nullable|array',
            'criteria.*'        => 'nullable|numeric|min:0|max:10',
            'note'              => 'nullable|string|max:500',
        ]);

        $answer = SubmissionAnswer::where('saId', $ansId)
            ->where('submission_id', $id)
            ->first();
        if (!$answer) {
            return response()->json(['status' => 'error', 'message' => 'Answer not found.'], 404);
        }

        try {
            $updated = $this->service->modifyByTeacher($answer, [
                'score'    => $request->input('score'),
                'feedback' => $request->input('feedback', ''),
                'criteria' => $request->input('criteria'),
                'note'     => $request->input('note'),
            ], $teacher);
        } catch (\Throwable $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 422);
        }

        return response()->json([
            'status' => 'success',
            'data'   => $this->serializeAnswer($updated),
        ]);
    }

    /* ─── 6. Finalize submission ─────────────────────────────────────── */

    public function saveAll(Request $request, int $id): JsonResponse
    {
        $teacher = $request->user();
        $submission = $this->ensureSubmissionAccess($id, $teacher);
        if ($submission instanceof JsonResponse) return $submission;

        $request->validate([
            'sTeacher_feedback'      => 'nullable|string|max:5000',
            'skill_overrides'        => 'nullable|array',
            'skill_overrides.*'      => 'nullable|numeric|min:0|max:10',
        ]);

        try {
            $updated = $this->service->finalizeSubmission($submission, [
                'sTeacher_feedback' => $request->input('sTeacher_feedback'),
                'skill_overrides'   => $request->input('skill_overrides', []),
            ], $teacher);
        } catch (\Throwable $e) {
            $pending = $submission->answers()
                ->where('saReview_status', 'pending')
                ->whereNotNull('saAi_score')
                ->pluck('saId');
            return response()->json([
                'status'  => 'error',
                'message' => $e->getMessage(),
                'errors'  => ['pending_answers' => $pending],
            ], 422);
        }

        $raw = $updated->sGemini_feedback ? (json_decode($updated->sGemini_feedback, true) ?: []) : [];
        $vstepScores = $raw['vstep_scores'] ?? [];
        $vstepAvg = count($vstepScores) ? round(array_sum($vstepScores) / count($vstepScores), 2) : null;

        return response()->json([
            'status' => 'success',
            'data'   => [
                'sStatus'       => $updated->sStatus,
                'sScore'        => $updated->sScore,
                'vstep_scores'  => $vstepScores,
                'vstep_average' => $vstepAvg,
            ],
        ]);
    }

    /* ─── 7. Grading history (audit) ─────────────────────────────────── */

    public function history(Request $request, int $id): JsonResponse
    {
        $teacher = $request->user();
        $submission = $this->ensureSubmissionAccess($id, $teacher);
        if ($submission instanceof JsonResponse) return $submission;

        $rows = GradingHistory::with('actor:uId,uName')
            ->where('submission_id', $id)
            ->orderBy('created_at', 'desc')
            ->limit(200)
            ->get();

        $data = $rows->map(function (GradingHistory $h) {
            return [
                'id'          => $h->ghId,
                'action'      => $h->ghAction,
                'actor'       => $h->actor ? $h->actor->uName : null,
                'actor_id'    => $h->ghActor_id,
                'answer_id'   => $h->answer_id,
                'prev_score'  => $h->ghPrev_score,
                'new_score'   => $h->ghNew_score,
                'note'        => $h->ghNote,
                'metadata'    => $h->ghMetadata,
                'at'          => $h->created_at ? $h->created_at->toIso8601String() : null,
            ];
        });

        return response()->json([
            'status' => 'success',
            'data'   => $data,
        ]);
    }

    /* ─── Helpers ────────────────────────────────────────────────────── */

    private function ensureSubmissionAccess(int $id, $teacher)
    {
        if (!$teacher || $teacher->uRole !== 'teacher') {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 401);
        }

        $submission = Submission::with(['exam', 'answers.question'])->find($id);
        if (!$submission) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy bài làm.'], 404);
        }
        if ($submission->exam && (int) $submission->exam->eTeacher_id !== (int) $teacher->uId) {
            return response()->json(['status' => 'error', 'message' => 'Bạn không phải giáo viên của đề thi này.'], 403);
        }
        return $submission;
    }

    private function serializeAnswer(SubmissionAnswer $a): array
    {
        return [
            'saId'                 => $a->saId,
            'saPoints_awarded'     => $a->saPoints_awarded,
            'saTeacher_feedback'   => $a->saTeacher_feedback,
            'saAi_score'           => $a->saAi_score,
            'saAi_feedback'        => $a->saAi_feedback,
            'saAi_criteria'        => $a->saAi_criteria,
            'saAi_model'           => $a->saAi_model,
            'saAi_graded_at'       => optional($a->saAi_graded_at)->toIso8601String(),
            'saReview_status'      => $a->saReview_status,
            'saReviewed_at'        => optional($a->saReviewed_at)->toIso8601String(),
            'saReviewed_by'        => $a->saReviewed_by,
        ];
    }
}

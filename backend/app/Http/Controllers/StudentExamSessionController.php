<?php

namespace App\Http\Controllers;

use App\Models\Submission;
use App\Models\SubmissionAnswer;
use App\Models\Question;
use App\Services\ExamAutoSubmitService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

/**
 * StudentExamSessionController
 *
 * Tầng "phiên thi" cho hệ thống auto-save / auto-submit.
 *
 * 3 endpoint chính:
 *   1) POST /student/tests/{id}/draft      — Lưu nhiều câu trả lời trong 1 lần (debounced 1.5s).
 *   2) POST /student/tests/{id}/heartbeat  — Cập nhật last_activity_at (mỗi 60s).
 *   3) POST /student/tests/{id}/auto-submit — Auto-submit khi đóng tab / hết giờ ở client.
 *
 * Tất cả endpoint đều idempotent — gọi nhiều lần không gây hại.
 */
class StudentExamSessionController extends Controller
{
    /**
     * POST /student/tests/{id}/draft
     *
     * Lưu nhiều câu trả lời trong 1 request. Body:
     * {
     *   "answers": [
     *     { "question_id": 12, "saAnswer_text": "..." },
     *     { "question_id": 13, "saAnswer_text": "..." }
     *   ]
     * }
     *
     * Response: { status, savedCount, last_activity_at }
     */
    public function draft(Request $request, $submissionId)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'student') {
            return response()->json([
                'status'  => 'error',
                'message' => 'Bạn không có quyền truy cập.',
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'answers'                  => 'required|array|min:1|max:200',
            'answers.*.question_id'    => 'required|integer',
            'answers.*.saAnswer_text'  => 'nullable|string|max:50000',
            'answers.*.answer_text'    => 'nullable|string|max:50000',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors'  => $validator->errors(),
            ], 400);
        }

        try {
            $result = DB::transaction(function () use ($request, $submissionId, $user) {
                $submission = Submission::where('sId', $submissionId)
                    ->where('user_id', $user->uId)
                    ->lockForUpdate()
                    ->first();

                if (!$submission) {
                    return ['status' => 404, 'data' => ['status' => 'error', 'message' => 'Không tìm thấy bài làm.']];
                }
                if ($submission->sStatus !== 'in_progress') {
                    return ['status' => 409, 'data' => [
                        'status'      => 'error',
                        'message'     => 'Bài làm đã được nộp hoặc không thể chỉnh sửa.',
                        'sStatus'     => $submission->sStatus,
                        'autoSubmitted' => in_array($submission->sStatus, ['auto_submitted', 'grading_subjective', 'graded', 'partially_graded'], true),
                    ]];
                }

                // Lấy danh sách question_id hợp lệ thuộc bài thi này (1 query)
                $incomingIds = collect($request->input('answers'))
                    ->pluck('question_id')->unique()->values()->all();
                $validIds = Question::where('exam_id', $submission->exam_id)
                    ->whereIn('qId', $incomingIds)
                    ->pluck('qId')->all();

                $savedCount = 0;
                foreach ($request->input('answers') as $ans) {
                    if (!in_array((int) $ans['question_id'], $validIds, true)) {
                        continue; // bỏ qua câu hỏi không thuộc bài thi
                    }
                    SubmissionAnswer::updateOrCreate(
                        [
                            'submission_id' => $submission->sId,
                            'question_id'   => (int) $ans['question_id'],
                        ],
                        [
                            'saAnswer_text' => (string) ($ans['saAnswer_text'] ?? $ans['answer_text'] ?? ''),
                        ]
                    );
                    $savedCount++;
                }

                // Refresh activity timestamp
                $now = now();
                $submission->update(['last_activity_at' => $now]);

                return ['status' => 200, 'data' => [
                    'status'           => 'success',
                    'savedCount'       => $savedCount,
                    'last_activity_at' => $now->toIso8601String(),
                    'serverTime'       => $now->toIso8601String(),
                ]];
            });

            return response()->json($result['data'], $result['status']);
        } catch (\Throwable $e) {
            Log::error('Draft save failed', [
                'submission_id' => $submissionId,
                'user_id'       => $user->uId ?? null,
                'error'         => $e->getMessage(),
                'trace'         => $e->getTraceAsString(),
                'file'          => $e->getFile(),
                'line'          => $e->getLine(),
            ]);
            return response()->json([
                'status'  => 'error',
                'message' => 'Lỗi hệ thống khi lưu nháp.',
                'debug'   => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * POST /student/tests/{id}/heartbeat
     *
     * Cập nhật last_activity_at. Mục tiêu giữ submission "sống" và cho server biết
     * client còn online — cron sẽ KHÔNG auto-submit khi heartbeat còn mới.
     *
     * Response: { status, serverTime, time_remaining_seconds }
     */
    public function heartbeat(Request $request, $submissionId)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'student') {
            return response()->json([
                'status'  => 'error',
                'message' => 'Bạn không có quyền truy cập.',
            ], 401);
        }

        $submission = Submission::with('exam:eId,eDuration_minutes')
            ->where('sId', $submissionId)
            ->where('user_id', $user->uId)
            ->first();

        if (!$submission) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Không tìm thấy bài làm.',
            ], 404);
        }

        if ($submission->sStatus !== 'in_progress') {
            return response()->json([
                'status'        => 'finalized',
                'sStatus'       => $submission->sStatus,
                'autoSubmitted' => in_array($submission->sStatus, ['auto_submitted', 'grading_subjective', 'graded', 'partially_graded'], true),
                'message'       => 'Bài thi đã kết thúc.',
            ], 200);
        }

        $now = now()->utc();
        $submission->update(['last_activity_at' => $now]);

        // Tính time remaining (server-truth) — UTC-safe to avoid timezone drift
        $timeRemainingSeconds = null;
        if ($submission->exam && $submission->sStart_time) {
            $duration = (int) ($submission->exam->eDuration_minutes ?? 0) * 60;
            $elapsed  = (int) $now->diffInSeconds($submission->sStart_time->copy()->utc(), false);
            $timeRemainingSeconds = max(0, $duration - $elapsed);
        }

        return response()->json([
            'status'                 => 'success',
            'serverTime'             => $now->toIso8601String(),
            'last_activity_at'       => $now->toIso8601String(),
            'time_remaining_seconds' => $timeRemainingSeconds,
        ], 200);
    }

    /**
     * POST /student/tests/{id}/auto-submit
     *
     * Body: { "reason": "unload" | "timeout" | "inactive" }
     *
     * Idempotent — gọi từ:
     *   • fetch keepalive: true khi pagehide/visibilitychange
     *   • Cron (qua TestRecoveryService) — không qua endpoint này
     *
     * Response: { status, autoSubmitted, idempotent, data: { ... } }
     */
    public function autoSubmit(Request $request, $submissionId)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'student') {
            return response()->json([
                'status'  => 'error',
                'message' => 'Bạn không có quyền truy cập.',
            ], 401);
        }

        $reason = (string) $request->input('reason', ExamAutoSubmitService::REASON_UNLOAD);

        $submission = Submission::with(['exam.questions.answers', 'answers.question'])
            ->where('sId', $submissionId)
            ->where('user_id', $user->uId)
            ->first();

        if (!$submission) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Không tìm thấy bài làm.',
            ], 404);
        }

        /** @var ExamAutoSubmitService $service */
        $service = app(ExamAutoSubmitService::class);
        $result  = $service->autoSubmit($submission, $reason);

        return response()->json([
            'status'        => $result['ok'] ? 'success' : 'error',
            'autoSubmitted' => $result['ok'],
            'idempotent'    => $result['idempotent'],
            'message'       => $result['message'],
            'data'          => $result['data'],
        ], $result['ok'] ? 200 : 500);
    }
}

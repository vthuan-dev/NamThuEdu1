<?php

namespace App\Http\Controllers;

use App\Models\Exam;
use App\Models\Submission;
use App\Models\TestAssignment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

/**
 * ThptExamController — quản lý đề thi format THPT Quốc Gia / Đầu vào ĐH.
 *
 * Format chuẩn:
 *   • 4 parts × 25 questions × 60 phút
 *   • Part 1 (1-7):   TF group — context + 4 statements
 *   • Part 2 (8-15):  Reading mixed — passage [A-D] + TF + MC + Sentence Insertion
 *   • Part 3 (16-20): Matching tables — list_1 (1-4) → list_2 (A-F)
 *   • Part 4 (21-25): Open cloze — passage + 5 blanks (1 word each)
 *
 * Endpoints:
 *   Teacher:
 *     POST   /api/teacher/exams/thpt
 *     PUT    /api/teacher/exams/{id}/thpt
 *     GET    /api/teacher/exams/{id}/thpt/draft
 *     POST   /api/teacher/exams/{id}/thpt/publish
 *
 *   Student:
 *     GET    /api/student/thpt-exams/{id}
 *     POST   /api/student/thpt-exams/{id}/start
 *     POST   /api/student/thpt-exams/{id}/submit
 *     GET    /api/student/thpt-submissions/{submissionId}/result
 */
class ThptExamController extends Controller
{
    private const DEFAULT_DURATION_MINUTES = 60;
    private const DEFAULT_TOTAL_QUESTIONS = 25;
    private const DEFAULT_RAW_SCORE_MAX = 67;
    private const DEFAULT_SCALE_MAX = 10;

    /* ============================================================
     |  TEACHER endpoints
     * ===========================================================*/

    /**
     * POST /api/teacher/exams/thpt
     * Tạo draft đề THPT mới.
     */
    public function createDraft(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'teacher') {
            return $this->error('Bạn không có quyền truy cập.', 401);
        }

        $validator = Validator::make($request->all(), [
            'eTitle' => 'required|string|max:255',
            'eDescription' => 'nullable|string',
            'age_group' => 'nullable|in:kids,teens,adults,all',
            'thpt_config' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->error('Dữ liệu không hợp lệ.', 400, $validator->errors());
        }

        $config = $request->input('thpt_config') ?? $this->blankConfig();

        $exam = Exam::create([
            'eTitle' => $request->input('eTitle'),
            'eDescription' => $request->input('eDescription', ''),
            'eType' => 'THPT',
            'eSkill' => 'mixed',
            'eScope' => 'full',
            'ePart_type' => null,
            'ePart_number' => null,
            'eDuration_minutes' => $config['total_duration_minutes'] ?? self::DEFAULT_DURATION_MINUTES,
            'eStatus' => 'draft',
            'ePurpose' => 'exam',
            'eDifficulty' => 'medium',
            'eTeacher_id' => $user->uId,
            'age_group' => $request->input('age_group', 'teens'),
            'thpt_config' => $config,
        ]);

        return response()->json([
            'status' => 'success',
            'data' => [
                'eId' => $exam->eId,
                'message' => 'Đã tạo draft đề THPT.',
            ],
        ]);
    }

    /**
     * PUT /api/teacher/exams/{id}/thpt
     * Update draft (title/description/age_group/thpt_config).
     *
     * Versioning behavior:
     *  - Đề chưa publish (eStatus=draft) → ghi vào thpt_config trực tiếp như cũ.
     *  - Đề đã publish → ghi vào thpt_draft_config, KHÔNG đụng thpt_config.
     *    Học viên đang/đã làm bài vẫn thấy version cũ. Khi teacher click "Xuất bản
     *    bản mới" mới thực sự rotate sang config mới.
     */
    public function updateDraft(Request $request, $examId)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'teacher') {
            return $this->error('Bạn không có quyền truy cập.', 401);
        }
        // Đề thi là tài sản chung: mọi giáo viên đều sửa được, không giới hạn người tạo.
        $exam = Exam::where('eId', $examId)->first();

        if (!$exam) {
            return $this->error('Không tìm thấy đề thi.', 404);
        }
        if ($exam->eType !== 'THPT') {
            return $this->error('Đề này không phải định dạng THPT.', 400);
        }

        $validator = Validator::make($request->all(), [
            'eTitle' => 'sometimes|string|max:255',
            'eDescription' => 'sometimes|nullable|string',
            'age_group' => 'sometimes|in:kids,teens,adults,all',
            'thpt_config' => 'sometimes|array',
        ]);

        if ($validator->fails()) {
            return $this->error('Dữ liệu không hợp lệ.', 400, $validator->errors());
        }

        $isPublished = $exam->eStatus === 'published';
        $updates = $request->only(['eTitle', 'eDescription', 'age_group']);

        if ($request->has('thpt_config')) {
            $newConfig = $request->input('thpt_config');
            if ($isPublished) {
                // Đề đã live: ghi vào draft, GIỮ NGUYÊN thpt_config
                $updates['thpt_draft_config'] = $newConfig;
            } else {
                // Đề chưa publish: ghi trực tiếp như cũ
                $updates['thpt_config'] = $newConfig;
                $updates['eDuration_minutes'] = $newConfig['total_duration_minutes']
                    ?? $exam->eDuration_minutes;
            }
        }

        $exam->update($updates);

        return response()->json([
            'status' => 'success',
            'data' => [
                'message' => $isPublished
                    ? 'Đã lưu bản nháp. Đề đang publish chưa bị thay đổi cho học viên.'
                    : 'Đã lưu draft.',
                'has_draft' => $isPublished,
            ],
        ]);
    }

    /**
     * GET /api/teacher/exams/{id}/thpt/draft
     * Lấy đề để teacher edit/xem.
     *
     * Logic versioning:
     *  - Owner + đang có thpt_draft_config → trả draft (đang sửa)
     *  - Owner + không có draft → trả thpt_config (đang live hoặc đề draft thuần)
     *  - Non-owner → chỉ trả thpt_config nếu đề public + published (read-only)
     *
     * Frontend dùng `_is_owner` + `_has_draft` + `_live_version` để render UI.
     */
    public function getDraft(Request $request, $examId)
    {
        $user = $request->user();
        $exam = Exam::where('eId', $examId)->first();

        if (!$exam) {
            return $this->error('Không tìm thấy đề thi.', 404);
        }
        if ($exam->eType !== 'THPT') {
            return $this->error('Đề này không phải định dạng THPT.', 400);
        }

        // Đề thi là tài sản chung: mọi giáo viên đều xem + sửa được.
        $isTeacher = $user && $user->uRole === 'teacher';
        $isAdmin = $user && $user->uRole === 'admin';
        $isPublic = !($exam->eIs_private ?? false) && $exam->eStatus === 'published';

        if (!$isTeacher && !$isAdmin && !$isPublic) {
            return $this->error('Bạn không có quyền xem đề này.', 403);
        }

        // Giáo viên được coi như "chủ" để bật chế độ sửa.
        $isOwner = $isTeacher;

        // Đề đã publish + có nháp → ưu tiên hiển thị draft đang sửa cho giáo viên
        $hasDraft = $isTeacher && $exam->thpt_draft_config !== null;
        $configToShow = $hasDraft
            ? $exam->thpt_draft_config
            : ($exam->thpt_config ?? $this->blankConfig());

        return response()->json([
            'status' => 'success',
            'data' => [
                'eId' => $exam->eId,
                'eTitle' => $exam->eTitle,
                'eDescription' => $exam->eDescription,
                'eStatus' => $exam->eStatus,
                'eDuration_minutes' => $exam->eDuration_minutes,
                'age_group' => $exam->age_group ?? 'teens',
                'thpt_config' => $configToShow,
                '_is_owner' => $isOwner,
                '_has_draft' => $hasDraft,
                '_live_version' => (int) ($exam->thpt_version ?? 0),
                '_versions_count' => is_array($exam->thpt_versions)
                    ? count($exam->thpt_versions)
                    : 0,
            ],
        ]);
    }

    /**
     * POST /api/teacher/exams/{id}/thpt/publish
     *
     * Hai trường hợp:
     *  - Đề đang là draft: validate xong set eStatus = 'published', thpt_version = 1.
     *  - Đề đã published + có thpt_draft_config: rotate version
     *      1) Snapshot thpt_config hiện tại vào thpt_versions[]
     *      2) Move thpt_draft_config -> thpt_config
     *      3) Clear thpt_draft_config
     *      4) thpt_version += 1
     *    Học viên đang/đã làm bài KHÔNG ảnh hưởng vì submission đã snapshot config
     *    tại thời điểm bắt đầu thi (xem startSubmission).
     */
    public function publish(Request $request, $examId)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'teacher') {
            return $this->error('Bạn không có quyền truy cập.', 401);
        }
        // Đề thi là tài sản chung: mọi giáo viên đều xuất bản được.
        $exam = Exam::where('eId', $examId)->first();

        if (!$exam) {
            return $this->error('Không tìm thấy đề thi.', 404);
        }
        if ($exam->eType !== 'THPT') {
            return $this->error('Đề này không phải định dạng THPT.', 400);
        }

        $isPublished = $exam->eStatus === 'published';
        $hasDraft = $exam->thpt_draft_config !== null;

        // Config sẽ go-live: nếu có draft đang sửa thì lấy draft, không thì dùng config hiện tại
        $configToPublish = $hasDraft ? $exam->thpt_draft_config : $exam->thpt_config;

        // KHÔNG tự điền đáp án mặc định: giáo viên BẮT BUỘC phải chọn đáp án đúng
        // cho từng câu trắc nghiệm trước khi xuất bản. Validate bên dưới sẽ chặn
        // và trả về danh sách câu còn thiếu đáp án.
        $errors = $this->validateThptConfig($configToPublish);
        if (!empty($errors)) {
            return $this->error('Đề chưa đủ nội dung để publish.', 422, $errors);
        }

        // Lần đầu publish → áp cài đặt auto-duyệt. Nếu đề đã live rồi (rotate
        // version mới) thì GIỮ published, không hạ xuống pending để tránh gỡ
        // đề mà học viên đang làm.
        $moderationStatus = $isPublished ? 'published' : Exam::resolveModerationStatus();
        $updates = [
            'eStatus' => $moderationStatus,
            'eIs_private' => $moderationStatus !== 'published',
        ];

        if ($isPublished && $hasDraft) {
            // ── Rotate version ──────────────────────────────────────────
            $currentVersion = (int) ($exam->thpt_version ?? 1);
            $versions = is_array($exam->thpt_versions) ? $exam->thpt_versions : [];

            // Archive current live config
            $versions[] = [
                'version' => $currentVersion,
                'published_at' => optional($exam->updated_at)->toIso8601String() ?? now()->toIso8601String(),
                'archived_at' => now()->toIso8601String(),
                'config' => $exam->thpt_config,
            ];

            $updates['thpt_versions'] = $versions;
            $updates['thpt_config'] = $configToPublish;
            $updates['thpt_draft_config'] = null;
            $updates['thpt_version'] = $currentVersion + 1;
            $updates['eDuration_minutes'] = $configToPublish['total_duration_minutes']
                ?? $exam->eDuration_minutes;
        } elseif (!$isPublished) {
            // Lần đầu publish — ghi config đã auto-fill đáp án mặc định vào thpt_config.
            $updates['thpt_version'] = max(1, (int) ($exam->thpt_version ?? 0));
            $updates['thpt_config'] = $configToPublish;
            $updates['thpt_draft_config'] = null;
        }

        $exam->update($updates);
        $exam->refresh();

        if ($moderationStatus === 'pending') {
            $message = 'Đã gửi đề thi THPT, chờ quản trị viên duyệt.';
        } else {
            $message = $isPublished && $hasDraft
                ? "Đã xuất bản phiên bản {$exam->thpt_version}. Học viên đang làm bài cũ vẫn dùng phiên bản trước."
                : 'Đã xuất bản đề thi THPT.';
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'message' => $message,
                'live_version' => (int) $exam->thpt_version,
                'versions_count' => is_array($exam->thpt_versions)
                    ? count($exam->thpt_versions)
                    : 0,
            ],
        ]);
    }

    /**
     * DELETE /api/teacher/exams/{id}/thpt/draft
     * Bỏ bản nháp đang sửa, quay về phiên bản đang live.
     */
    public function discardDraft(Request $request, $examId)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'teacher') {
            return $this->error('Bạn không có quyền truy cập.', 401);
        }
        $exam = Exam::where('eId', $examId)->first();

        if (!$exam) {
            return $this->error('Không tìm thấy đề thi.', 404);
        }
        if ($exam->eType !== 'THPT') {
            return $this->error('Đề này không phải định dạng THPT.', 400);
        }
        if ($exam->thpt_draft_config === null) {
            return $this->error('Không có bản nháp nào để bỏ.', 400);
        }

        $exam->update(['thpt_draft_config' => null]);

        return response()->json([
            'status' => 'success',
            'data' => ['message' => 'Đã bỏ bản nháp. Quay về phiên bản đang live.'],
        ]);
    }

    /**
     * GET /api/teacher/exams/{id}/thpt/versions
     * Liệt kê các version cũ để teacher tham khảo (read-only).
     */
    public function listVersions(Request $request, $examId)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'teacher') {
            return $this->error('Bạn không có quyền truy cập.', 401);
        }
        $exam = Exam::where('eId', $examId)->first();

        if (!$exam) {
            return $this->error('Không tìm thấy đề thi.', 404);
        }

        $versions = is_array($exam->thpt_versions) ? $exam->thpt_versions : [];
        // Build summary (không trả full config để tránh payload lớn)
        $summary = array_map(function ($v) {
            return [
                'version' => $v['version'] ?? null,
                'published_at' => $v['published_at'] ?? null,
                'archived_at' => $v['archived_at'] ?? null,
                'sections_count' => isset($v['config']['sections']) && is_array($v['config']['sections'])
                    ? count($v['config']['sections'])
                    : 0,
            ];
        }, $versions);

        return response()->json([
            'status' => 'success',
            'data' => [
                'live_version' => (int) ($exam->thpt_version ?? 0),
                'has_draft' => $exam->thpt_draft_config !== null,
                'versions' => $summary,
            ],
        ]);
    }

    /* ============================================================
     |  STUDENT endpoints
     * ===========================================================*/

    /**
     * GET /api/student/thpt-exams/{id}
     * Lấy đề cho học viên (đã xoá đáp án).
     */
    public function getForStudent(Request $request, $examId)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'student') {
            return $this->error('Bạn không có quyền truy cập.', 401);
        }

        $exam = Exam::where('eId', $examId)
            ->where('eType', 'THPT')
            ->where('eStatus', 'published')
            ->first();

        if (!$exam) {
            return $this->error('Không tìm thấy đề thi.', 404);
        }

        $config = $this->stripAnswers($exam->thpt_config ?? $this->blankConfig());

        return response()->json([
            'status' => 'success',
            'data' => [
                'eId' => $exam->eId,
                'eTitle' => $exam->eTitle,
                'eDescription' => $exam->eDescription,
                'eDuration_minutes' => $exam->eDuration_minutes,
                'thpt_config' => $config,
            ],
        ]);
    }

    /**
     * POST /api/student/thpt-exams/{id}/start
     * Tạo (hoặc lấy lại) submission đang in_progress.
     */
    public function startSubmission(Request $request, $examId)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'student') {
            return $this->error('Bạn không có quyền truy cập.', 401);
        }

        $exam = Exam::where('eId', $examId)
            ->where('eType', 'THPT')
            ->where('eStatus', 'published')
            ->first();

        if (!$exam) {
            return $this->error('Không tìm thấy đề thi.', 404);
        }

        // Resume nếu đã có submission đang dở
        $existing = Submission::where('exam_id', $examId)
            ->where('user_id', $user->uId)
            ->where('sStatus', 'in_progress')
            ->first();

        // Huy phien do de lam lai tu dau.
        // Xoa/void TAT CA submission in_progress cua user+exam (tranh sot ban cu).
        if ($request->boolean('restart')) {
            $toVoid = Submission::where('exam_id', $examId)
                ->where('user_id', $user->uId)
                ->where('sStatus', 'in_progress')
                ->get();

            foreach ($toVoid as $sub) {
                try {
                    \DB::transaction(function () use ($sub) {
                        $sub->answers()->delete();
                        $sub->delete();
                    });
                } catch (\Throwable $e) {
                    \Log::warning('THPT restart hard-delete failed, voiding session instead', [
                        'submission_id' => $sub->sId,
                        'error' => $e->getMessage(),
                    ]);
                    $voidPayload = $sub->submission_payload ?? [];
                    $voidPayload['answers'] = new \stdClass();
                    $voidPayload['discarded'] = true;
                    $voidPayload['discarded_at'] = now()->toIso8601String();
                    $sub->submission_payload = $voidPayload;
                    $sub->sStatus = 'auto_submitted';
                    $sub->sSubmit_time = now();
                    $sub->auto_submit_reason = 'restart';
                    $sub->save();
                }
            }
            $existing = null;
        }

        if ($existing) {
            // Check if expired
            $durationMin = (int) ($existing->submission_payload['exam_snapshot']['eDuration_minutes']
                ?? $exam->eDuration_minutes
                ?? 60);

            $startedAt = $existing->sStart_time ? \Carbon\Carbon::parse($existing->sStart_time) : now();
            $payloadTmp = $existing->submission_payload ?? [];

            // Absolute deadline snapshot — nguồn sự thật, không phụ thuộc TZ client
            if (!empty($payloadTmp['timer_deadline_at'])) {
                $deadlineAt = \Carbon\Carbon::parse($payloadTmp['timer_deadline_at']);
            } else {
                // Backfill cho submission cũ (chưa có timer_deadline_at)
                $deadlineAt = $startedAt->copy()->addMinutes($durationMin);
                $payloadTmp['timer_deadline_at'] = $deadlineAt->toIso8601String();
                $existing->submission_payload = $payloadTmp;
                $existing->save();
            }

            $remainingSecExact = $deadlineAt->isPast()
                ? 0
                : max(0, now()->diffInSeconds($deadlineAt));
            $timeRemaining = $remainingSecExact / 60;

            if ($timeRemaining <= 0) {
                // Tự động nộp bài khi hết giờ
                $answers = $existing->submission_payload['answers'] ?? [];
                $payload = $existing->submission_payload ?? [];

                $configForGrading = $payload['exam_snapshot']['config']
                    ?? $exam->thpt_config
                    ?? $this->blankConfig();

                $result = $this->gradeSubmission($configForGrading, $answers);
                $existing->sScore = $result['scaled_score'];
                $existing->sStatus = 'graded';
                $existing->sSubmit_time = now();
                $existing->sGraded_time = now();
                $existing->sTime_taken = $existing->sStart_time
                    ? now()->diffInSeconds($existing->sStart_time)
                    : null;
                $existing->auto_submit_reason = 'timeout';

                $payload['result'] = $result;
                $existing->submission_payload = $payload;

                // Speaking + Writing AI (async)
                $hasSpeakingSection = collect($configForGrading['sections'] ?? [])
                    ->contains(fn($s) => ($s['type'] ?? '') === 'speaking');
                $rawFeedback = json_decode($existing->sGemini_feedback ?? '{}', true) ?: [];
                $hasSpeakingAudio = !empty($rawFeedback['speaking_audio'] ?? []);
                if ($hasSpeakingSection && $hasSpeakingAudio) {
                    \App\Jobs\GradeThptSpeakingJob::dispatch((int) $existing->sId);
                }
                $hasWritingSection = collect($configForGrading['sections'] ?? [])
                    ->contains(fn($s) => ($s['type'] ?? '') === 'writing');
                if ($hasWritingSection) {
                    \App\Jobs\GradeThptWritingJob::dispatch((int) $existing->sId);
                }

                $existing->save();

                return $this->error('Bài thi đã hết thời gian làm bài và đã được tự động nộp.', 403);
            }

            $existingPayload = $existing->submission_payload ?? [];
            $remainingSec = max(0, (int) round($timeRemaining * 60));
            return response()->json([
                'status' => 'success',
                'data' => [
                    'submission_id' => $existing->sId,
                    'sStart_time' => $existing->sStart_time,
                    'submission_payload' => $existingPayload ?: new \stdClass(),
                    'resumed' => true,
                    // Trả snapshot config để student tiếp tục với đúng version đã start
                    'exam_snapshot' => $existingPayload['exam_snapshot'] ?? null,
                    'duration_minutes' => $durationMin,
                    'time_remaining_seconds' => $remainingSec,
                    'deadline_at' => $existingPayload['timer_deadline_at']
                        ?? $startedAt->copy()->addMinutes($durationMin)->toIso8601String(),
                ],
            ]);
        }

        $assignmentId = $request->input('assignment_id');
        if ($assignmentId) {
            $assignment = TestAssignment::where('taId', $assignmentId)
                ->where('exam_id', $examId)
                ->first();
            if (!$assignment) {
                $assignmentId = null; // ignore invalid
            }
        }

        $submission = Submission::create([
            'user_id' => $user->uId,
            'exam_id' => $examId,
            'assignment_id' => $assignmentId,
            'sAttempt' => 1,
            'sStart_time' => now(),
            'sStatus' => 'in_progress',
            'submission_payload' => [
                'answers' => new \stdClass(),
                // ── VERSION SNAPSHOT ───────────────────────────────────────
                // Snapshot toàn bộ config tại thời điểm student bắt đầu thi.
                // Khi grade / review sau này luôn dùng snapshot này, KHÔNG đọc
                // exam.thpt_config hiện tại → teacher có thể publish version
                // mới mà không ảnh hưởng bài đã/đang chấm.
                'exam_snapshot' => [
                    'version' => (int) ($exam->thpt_version ?? 1),
                    'snapshot_at' => now()->toIso8601String(),
                    'config' => $exam->thpt_config,
                    'eDuration_minutes' => $exam->eDuration_minutes,
                ],
                // Absolute deadline (ISO) — nguồn sự thật cho timer, không phụ thuộc TZ client
                'timer_deadline_at' => now()->addMinutes((int) ($exam->eDuration_minutes ?? self::DEFAULT_DURATION_MINUTES))->toIso8601String(),
            ],
        ]);

        $durationMinNew = (int) ($exam->eDuration_minutes ?? self::DEFAULT_DURATION_MINUTES);
        return response()->json([
            'status' => 'success',
            'data' => [
                'submission_id' => $submission->sId,
                'sStart_time' => $submission->sStart_time,
                'submission_payload' => $submission->submission_payload,
                'resumed' => false,
                'duration_minutes' => $durationMinNew,
                'time_remaining_seconds' => $durationMinNew * 60,
                'deadline_at' => $submission->submission_payload['timer_deadline_at']
                    ?? now()->addMinutes($durationMinNew)->toIso8601String(),
            ],
        ]);
    }

    /**
     * POST /api/student/thpt-exams/{id}/submit
     * Lưu (auto-save hoặc final submit) đáp án.
     *
     * Body: { submission_id, answers: {...}, final?: true }
     */
    public function submitAnswers(Request $request, $examId)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'student') {
            return $this->error('Bạn không có quyền truy cập.', 401);
        }

        $validator = Validator::make($request->all(), [
            'submission_id' => 'required|integer',
            // autosave (final=false) có thể gửi answers rỗng khi học viên chưa
            // trả lời câu nào → dùng 'present' thay 'required' để không trả 400.
            'answers' => 'present|array',
            'final' => 'nullable|boolean',
        ]);
        if ($validator->fails()) {
            return $this->error('Dữ liệu không hợp lệ.', 400, $validator->errors());
        }

        $submission = Submission::where('sId', $request->submission_id)
            ->where('user_id', $user->uId)
            ->where('exam_id', $examId)
            ->first();

        if (!$submission) {
            return $this->error('Không tìm thấy bài làm.', 404);
        }

        $exam = Exam::where('eId', $examId)
            ->where('eType', 'THPT')
            ->first();
        if (!$exam) {
            return $this->error('Không tìm thấy đề thi.', 404);
        }

        $answers = $request->input('answers', []);
        $payload = $submission->submission_payload ?? [];
        $payload['answers'] = $answers;
        $submission->submission_payload = $payload;

        if ($request->boolean('final')) {
            // Diagnostic log để diagnose nếu user báo "nộp xong điểm 0"
            \Log::info('THPT submit (final) received', [
                'submission_id' => $submission->sId,
                'user_id' => $user->uId,
                'exam_id' => $examId,
                'answers_count' => is_array($answers) ? count($answers) : 0,
                'has_speaking_audio' => !empty(json_decode($submission->sGemini_feedback ?? '{}', true)['speaking_audio'] ?? []),
            ]);

            // Grade dùng snapshot trong submission (NOT exam.thpt_config) để
            // không bị ảnh hưởng nếu teacher publish version mới giữa chừng.
            $configForGrading = $payload['exam_snapshot']['config']
                ?? $exam->thpt_config
                ?? $this->blankConfig();

            $result = $this->gradeSubmission($configForGrading, $answers);
            $submission->sScore = $result['scaled_score'];
            $submission->sStatus = 'graded';
            $submission->sSubmit_time = now();
            $submission->sGraded_time = now();
            $submission->sTime_taken = $submission->sStart_time
                ? now()->diffInSeconds($submission->sStart_time)
                : null;

            $payload['result'] = $result;
            $submission->submission_payload = $payload;

            // Nếu đề có phần Nói + học viên đã ghi âm → AI chấm Nói chạy nền.
            // Nếu đề có phần Viết → AI chấm Viết chạy nền.
            // Điểm khách quan vẫn hiển thị ngay; job sẽ blend điểm chủ quan vào sau.
            $hasSpeakingSection = collect($configForGrading['sections'] ?? [])
                ->contains(fn($s) => ($s['type'] ?? '') === 'speaking');
            $rawFeedback = json_decode($submission->sGemini_feedback ?? '{}', true) ?: [];
            $hasSpeakingAudio = !empty($rawFeedback['speaking_audio'] ?? []);
            if ($hasSpeakingSection && $hasSpeakingAudio) {
                \App\Jobs\GradeThptSpeakingJob::dispatch((int) $submission->sId);
            }
            $hasWritingSection = collect($configForGrading['sections'] ?? [])
                ->contains(fn($s) => ($s['type'] ?? '') === 'writing');
            if ($hasWritingSection) {
                \App\Jobs\GradeThptWritingJob::dispatch((int) $submission->sId);
            }
        }
        $submission->save();

        return response()->json([
            'status' => 'success',
            'data' => [
                'submission_id' => $submission->sId,
                'sStatus' => $submission->sStatus,
                'sScore' => $submission->sScore,
                'final' => $request->boolean('final'),
            ],
        ]);
    }

    /**
     * GET /api/student/thpt-submissions/{submissionId}/result
     * Lấy kết quả + đáp án đúng để review.
     */
    public function getResult(Request $request, $submissionId)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'student') {
            return $this->error('Bạn không có quyền truy cập.', 401);
        }

        $submission = Submission::where('sId', $submissionId)
            ->where('user_id', $user->uId)
            ->first();
        if (!$submission) {
            return $this->error('Không tìm thấy bài làm.', 404);
        }
        $exam = Exam::where('eId', $submission->exam_id)->first();
        if (!$exam || $exam->eType !== 'THPT') {
            return $this->error('Không tìm thấy đề thi.', 404);
        }

        $payload = $submission->submission_payload ?? [];
        $answers = $payload['answers'] ?? [];

        // Dùng config snapshot tại thời điểm student bắt đầu thi (versioning-safe).
        // Fallback về exam.thpt_config nếu submission cũ chưa có snapshot.
        $reviewConfig = $payload['exam_snapshot']['config']
            ?? $exam->thpt_config
            ?? $this->blankConfig();
        $snapshotVersion = $payload['exam_snapshot']['version'] ?? null;

        $result = $payload['result'] ?? null;

        // Nếu bài đang làm và chưa hết hạn → không cho phép lấy kết quả (chặn cheat)
        if ($submission->sStatus === 'in_progress') {
            $durationMin = (int) ($payload['exam_snapshot']['eDuration_minutes']
                ?? $exam->eDuration_minutes
                ?? 60);
            $startedAt = $submission->sStart_time;
            $timeElapsed = now()->diffInMinutes($startedAt);
            if ($timeElapsed < $durationMin) {
                return $this->error('Bài thi đang trong quá trình làm, chưa thể xem kết quả.', 400);
            }
        }

        // ── SELF-HEAL ────────────────────────────────────────────────────────
        // Nếu bài chưa ở trạng thái 'graded' (vd: final submit bị gián đoạn, mất
        // mạng sau khi điều hướng, hoặc grade lỗi giữa chừng) thì chấm lại ngay
        // khi đọc kết quả. Chấm khách quan THPT là hàm thuần & idempotent nên an
        // toàn để chạy on-read, tránh kẹt "Đang chấm điểm..." vô hạn ở client.
        if ($submission->sStatus !== 'graded') {
            $hasAnswers = is_array($answers) && count($answers) > 0;
            $hasGradableConfig = !empty($reviewConfig['sections'] ?? []);

            if (!$hasAnswers && !$hasGradableConfig) {
                // Không đủ dữ liệu để chấm → lỗi terminal (FE sẽ dừng poll).
                return $this->error('Bài làm chưa có dữ liệu để chấm.', 422);
            }

            try {
                $result = $this->gradeSubmission($reviewConfig, $answers);
                $payload['result'] = $result;
                $submission->submission_payload = $payload;
                $submission->sScore = $result['scaled_score'] ?? 0;
                $submission->sStatus = 'graded';
                $submission->sSubmit_time = $submission->sSubmit_time ?? now();
                $submission->sGraded_time = now();
                if (!$submission->sTime_taken && $submission->sStart_time) {
                    $submission->sTime_taken = now()->diffInSeconds($submission->sStart_time);
                }
                $submission->save();

                // AI chủ quan (Nói/Viết) chạy nền nếu chưa có.
                $hasSpeakingSection = collect($reviewConfig['sections'] ?? [])
                    ->contains(fn($s) => ($s['type'] ?? '') === 'speaking');
                $rawFb = json_decode($submission->sGemini_feedback ?? '{}', true) ?: [];
                if ($hasSpeakingSection && !empty($rawFb['speaking_audio'] ?? [])) {
                    \App\Jobs\GradeThptSpeakingJob::dispatch((int) $submission->sId);
                }
                $hasWritingSection = collect($reviewConfig['sections'] ?? [])
                    ->contains(fn($s) => ($s['type'] ?? '') === 'writing');
                $payloadResult = $payload['result'] ?? [];
                $writingAlready = !empty($payloadResult['writing']['parts'] ?? []);
                if ($hasWritingSection && !$writingAlready) {
                    \App\Jobs\GradeThptWritingJob::dispatch((int) $submission->sId);
                }

                \Log::warning('THPT result self-healed (graded on read)', [
                    'submission_id' => $submission->sId,
                    'user_id' => $user->uId,
                ]);
            } catch (\Throwable $e) {
                \Log::error('THPT self-heal grading failed', [
                    'submission_id' => $submission->sId,
                    'error' => $e->getMessage(),
                ]);
                return $this->error('Không thể chấm bài tự động. Vui lòng liên hệ giáo viên.', 422);
            }
        }

        // Bài đã graded nhưng chưa cache result trong payload → chấm lại để hiển thị.
        if ($result === null) {
            $result = $this->gradeSubmission($reviewConfig, $answers);
        }

        // Overlay điểm giáo viên (teacher_*) lên field AI khi đọc — KHÔNG sửa DB.
        // Học viên thấy điểm giáo viên ở các câu đã chấm lại (Req 6.7).
        $result = $this->overlayTeacherScores($result);

        // Bản ghi âm phần Nói (để học viên nghe lại khi xem kết quả).
        $rawFeedback = json_decode($submission->sGemini_feedback ?? '{}', true) ?: [];
        $speakingAudio = $rawFeedback['speaking_audio'] ?? [];

        return response()->json([
            'status' => 'success',
            'data' => [
                'submission_id' => $submission->sId,
                'exam_id' => $exam->eId,
                'exam_title' => $exam->eTitle,
                'submitted_at' => $submission->sSubmit_time,
                'duration_seconds' => $submission->sTime_taken,
                'answers' => $answers,
                'result' => $result,
                'speaking_audio' => $speakingAudio,
                'thpt_config' => $reviewConfig,            // Snapshot — không phải bản live
                'thpt_version' => $snapshotVersion,        // Version mà student đã làm
                'thpt_live_version' => (int) ($exam->thpt_version ?? 0),
            ],
        ]);
    }

    /* ============================================================
     |  Helpers
     * ===========================================================*/

    private function blankConfig(): array
    {
        return [
            'version' => '2.0',
            'level' => 'THPT',
            'total_duration_minutes' => self::DEFAULT_DURATION_MINUTES,
            'scale_max' => self::DEFAULT_SCALE_MAX,
            'sections' => [],
        ];
    }

    /**
     * Validate config trước khi publish (section-based v2).
     */
    /**
     * Tự điền đáp án mặc định (đáp án đầu / "A") cho câu trắc nghiệm chưa chọn,
     * và placeholder "A" cho đáp án dạng nhập (để publish được, giáo viên sửa sau).
     */
    private function fillDefaultThptAnswers(?array $config): array
    {
        if (!is_array($config)) return $config ?? [];
        $firstOptId = function ($options) {
            if (is_array($options) && !empty($options)) {
                $first = $options[0];
                return is_array($first) ? ($first['id'] ?? 'A') : 'A';
            }
            return 'A';
        };
        $blank = fn($v) => $v === null || trim((string) $v) === '';
        $emptyAccepted = function ($arr): bool {
            if (!is_array($arr)) return true;
            foreach ($arr as $a) { if (trim((string) $a) !== '') return false; }
            return true;
        };

        foreach (($config['sections'] ?? []) as $si => $s) {
            $type = $s['type'] ?? null;
            switch ($type) {
                case 'phonetics':
                    foreach (($s['items'] ?? []) as $ii => $it) {
                        if ($blank($it['correct_id'] ?? null)) {
                            $config['sections'][$si]['items'][$ii]['correct_id'] = $firstOptId($it['words'] ?? []);
                        }
                    }
                    break;
                case 'mc_questions':
                    foreach (($s['items'] ?? []) as $ii => $it) {
                        if ($blank($it['correct_id'] ?? null)) {
                            $config['sections'][$si]['items'][$ii]['correct_id'] = $firstOptId($it['options'] ?? []);
                        }
                    }
                    break;
                case 'listening':
                    foreach (($s['items'] ?? []) as $ii => $it) {
                        $kind = $it['kind'] ?? 'mc';
                        if ($kind === 'fill_blank') {
                            // Text answers — no default fill
                            continue;
                        }
                        if ($blank($it['correct_id'] ?? null)) {
                            $config['sections'][$si]['items'][$ii]['correct_id'] = $firstOptId($it['options'] ?? []);
                        }
                    }
                    break;
                case 'error_identification':
                    foreach (($s['items'] ?? []) as $ii => $it) {
                        if ($blank($it['correct_id'] ?? null)) {
                            $config['sections'][$si]['items'][$ii]['correct_id'] = $firstOptId($it['segments'] ?? []);
                        }
                    }
                    break;
                case 'word_form':
                case 'sentence_transformation':
                    // Dạng NHẬP TAY — không tự điền; validate sẽ chặn nếu thiếu.
                    break;
                case 'matching':
                    foreach (($s['items'] ?? []) as $ii => $it) {
                        $ans = is_array($it['answers'] ?? null) ? $it['answers'] : [];
                        foreach (['1', '2', '3', '4'] as $k) {
                            if ($blank($ans[$k] ?? null)) $ans[$k] = 'A';
                        }
                        $config['sections'][$si]['items'][$ii]['answers'] = $ans;
                    }
                    break;
                case 'mc_cloze':
                    foreach (($s['blanks'] ?? []) as $bi => $b) {
                        if ($blank($b['correct_id'] ?? null)) {
                            $config['sections'][$si]['blanks'][$bi]['correct_id'] = $firstOptId($b['options'] ?? []);
                        }
                    }
                    break;
                case 'word_bank_cloze':
                case 'open_cloze':
                    // Dạng NHẬP TAY (điền từ) — không tự điền; validate sẽ chặn nếu thiếu.
                    break;
                case 'reading_mixed':
                    foreach (($s['items'] ?? []) as $ii => $it) {
                        $kind = $it['kind'] ?? 'mc';
                        if ($kind === 'mc' && $blank($it['correct_id'] ?? null)) {
                            $config['sections'][$si]['items'][$ii]['correct_id'] = $firstOptId($it['options'] ?? []);
                        } elseif ($kind === 'sentence_insertion' && $blank($it['correct'] ?? null) && $blank($it['correct_id'] ?? null)) {
                            $config['sections'][$si]['items'][$ii]['correct'] = 'A';
                        }
                    }
                    break;
                // tf_group: statements đã có 'correct' bool mặc định; speaking: AI chấm — bỏ qua.
            }
        }
        return $config;
    }

    private function validateThptConfig(?array $config): array
    {
        $errors = [];
        if (!$config) {
            $errors[] = 'Cấu hình đề trống.';
            return $errors;
        }
        $sections = $config['sections'] ?? [];
        if (count($sections) < 1) {
            $errors[] = 'Đề cần ít nhất 1 phần.';
            return $errors;
        }

        // Một "đáp án" hợp lệ: chuỗi/giá trị khác rỗng (id A/B/C/D), hoặc
        // mảng accepted_answers có ít nhất 1 phần tử khác rỗng.
        $hasId = fn($v) => $v !== null && trim((string) $v) !== '';
        $hasAccepted = function ($arr): bool {
            if (!is_array($arr)) return false;
            foreach ($arr as $a) { if (trim((string) $a) !== '') return true; }
            return false;
        };

        foreach ($sections as $idx => $s) {
            $label = ($s['title'] ?? ('Phần ' . ($idx + 1)));
            $type = $s['type'] ?? null;
            $items = $s['items'] ?? [];
            $qlabel = fn($it, $i) => 'câu ' . ($it['question_number'] ?? ($i + 1));

            switch ($type) {
                case 'phonetics':
                case 'mc_questions':
                case 'error_identification':
                    if (empty($items)) { $errors[] = "{$label}: chưa có câu hỏi nào."; break; }
                    foreach ($items as $i => $it) {
                        if (!$hasId($it['correct_id'] ?? null)) {
                            $errors[] = "{$label} ({$qlabel($it, $i)}): chưa chọn đáp án đúng.";
                        }
                    }
                    break;

                case 'word_form':
                    if (empty($items)) { $errors[] = "{$label}: chưa có câu hỏi nào."; break; }
                    foreach ($items as $i => $it) {
                        if (!$hasAccepted($it['accepted_answers'] ?? null)) {
                            $errors[] = "{$label} ({$qlabel($it, $i)}): chưa nhập đáp án đúng.";
                        }
                    }
                    break;

                case 'sentence_transformation':
                    if (empty($items)) { $errors[] = "{$label}: chưa có câu hỏi nào."; break; }
                    foreach ($items as $i => $it) {
                        if (!$hasAccepted($it['accepted_answers'] ?? null)) {
                            $errors[] = "{$label} ({$qlabel($it, $i)}): chưa nhập đáp án chấp nhận.";
                        }
                    }
                    break;

                case 'matching':
                    if (empty($items)) { $errors[] = "{$label}: chưa có câu hỏi nào."; break; }
                    foreach ($items as $i => $it) {
                        $ans = $it['answers'] ?? [];
                        $missing = false;
                        foreach (['1', '2', '3', '4'] as $k) {
                            if (!$hasId($ans[$k] ?? null)) { $missing = true; break; }
                        }
                        if ($missing) $errors[] = "{$label} ({$qlabel($it, $i)}): chưa nối đủ đáp án.";
                    }
                    break;

                case 'listening':
                    if (empty($s['audio_url'])) $errors[] = "{$label}: chưa có audio.";
                    if (empty($items)) { $errors[] = "{$label}: chưa có câu hỏi nào."; break; }
                    foreach ($items as $i => $it) {
                        $kind = $it['kind'] ?? 'mc';
                        if ($kind === 'fill_blank') {
                            if (!$hasAccepted($it['accepted_answers'] ?? null)) {
                                $errors[] = "{$label} ({$qlabel($it, $i)}): chưa nhập đáp án chấp nhận (điền chỗ trống).";
                            }
                        } else {
                            if (!$hasId($it['correct_id'] ?? null)) {
                                $errors[] = "{$label} ({$qlabel($it, $i)}): chưa chọn đáp án đúng.";
                            }
                        }
                    }
                    break;

                case 'speaking':
                    // Phần Nói do AI chấm — không cần đáp án.
                    if (empty($items)) $errors[] = "{$label}: chưa có đề nói nào.";
                    break;

                case 'writing':
                    // Phần Viết do giáo viên chấm tay — cần đề bài.
                    if (empty($items)) { $errors[] = "{$label}: chưa có đề viết nào."; break; }
                    foreach ($items as $i => $it) {
                        if (trim((string) ($it['prompt'] ?? '')) === '') {
                            $errors[] = "{$label} ({$qlabel($it, $i)}): chưa nhập đề bài viết.";
                        }
                    }
                    break;

                case 'tf_group':
                    if (empty($items)) { $errors[] = "{$label}: chưa có câu hỏi nào."; break; }
                    foreach ($items as $i => $it) {
                        if (empty($it['statements'])) {
                            $errors[] = "{$label} ({$qlabel($it, $i)}): chưa có mệnh đề Đúng/Sai.";
                        }
                    }
                    break;

                case 'reading_mixed':
                    if (empty($s['passage'])) $errors[] = "{$label}: thiếu đoạn văn.";
                    if (empty($items)) { $errors[] = "{$label}: chưa có câu hỏi nào."; break; }
                    foreach ($items as $i => $it) {
                        $kind = $it['kind'] ?? 'mc';
                        if ($kind === 'tf_group') {
                            if (empty($it['statements'])) $errors[] = "{$label} ({$qlabel($it, $i)}): chưa có mệnh đề Đúng/Sai.";
                        } else {
                            // mc / sentence_insertion → cần correct_id / correct
                            if (!$hasId($it['correct_id'] ?? null) && !$hasId($it['correct'] ?? null)) {
                                $errors[] = "{$label} ({$qlabel($it, $i)}): chưa chọn đáp án đúng.";
                            }
                        }
                    }
                    break;

                case 'mc_cloze':
                    if (empty($s['passage'])) $errors[] = "{$label}: thiếu đoạn văn.";
                    if (empty($s['blanks'])) { $errors[] = "{$label}: chưa có chỗ trống nào."; break; }
                    foreach (($s['blanks'] ?? []) as $i => $b) {
                        if (!$hasId($b['correct_id'] ?? null)) {
                            $errors[] = "{$label} (chỗ trống " . ($b['question_number'] ?? ($i + 1)) . "): chưa chọn đáp án đúng.";
                        }
                    }
                    break;

                case 'word_bank_cloze':
                case 'open_cloze':
                    if (empty($s['passage'])) $errors[] = "{$label}: thiếu đoạn văn.";
                    if (empty($s['blanks'])) { $errors[] = "{$label}: chưa có chỗ trống nào."; break; }
                    foreach (($s['blanks'] ?? []) as $i => $b) {
                        if (!$hasAccepted($b['accepted_answers'] ?? null)) {
                            $errors[] = "{$label} (chỗ trống " . ($b['question_number'] ?? ($i + 1)) . "): chưa nhập đáp án đúng.";
                        }
                    }
                    break;

                default:
                    $errors[] = "{$label}: loại phần không hợp lệ ({$type}).";
            }
        }
        return $errors;
    }

    /**
     * Strip đáp án + giải thích khỏi config trước khi gửi cho học viên.
     */
    private function stripAnswers(array $config): array
    {
        $sections = $config['sections'] ?? [];
        foreach ($sections as $si => $s) {
            $type = $s['type'] ?? null;
            switch ($type) {
                case 'phonetics':
                case 'mc_questions':
                case 'error_identification':
                    foreach (($s['items'] ?? []) as $i => $it) {
                        unset($it['correct_id'], $it['explanation']);
                        $sections[$si]['items'][$i] = $it;
                    }
                    break;
                case 'listening':
                    foreach (($s['items'] ?? []) as $i => $it) {
                        unset($it['correct_id'], $it['accepted_answers'], $it['explanation']);
                        $sections[$si]['items'][$i] = $it;
                    }
                    // Listening: transcript chỉ dành cho giáo viên, ẩn khi học viên thi
                    unset($sections[$si]['transcript']);
                    break;
                case 'writing':
                    // Ẩn guidance/rubric của giáo viên khi học viên thi
                    foreach (($s['items'] ?? []) as $i => $it) {
                        unset($it['guidance'], $it['explanation']);
                        $sections[$si]['items'][$i] = $it;
                    }
                    break;
                case 'word_form':
                case 'sentence_transformation':
                    foreach (($s['items'] ?? []) as $i => $it) {
                        unset($it['accepted_answers'], $it['explanation']);
                        $sections[$si]['items'][$i] = $it;
                    }
                    break;
                case 'tf_group':
                    foreach (($s['items'] ?? []) as $i => $it) {
                        foreach (($it['statements'] ?? []) as $j => $st) {
                            unset($st['correct'], $st['explanation']);
                            $it['statements'][$j] = $st;
                        }
                        $sections[$si]['items'][$i] = $it;
                    }
                    break;
                case 'matching':
                    foreach (($s['items'] ?? []) as $i => $it) {
                        unset($it['answers'], $it['explanation']);
                        $sections[$si]['items'][$i] = $it;
                    }
                    break;
                case 'reading_mixed':
                    foreach (($s['items'] ?? []) as $i => $it) {
                        $k = $it['kind'] ?? '';
                        if ($k === 'tf_group') {
                            foreach (($it['statements'] ?? []) as $j => $st) {
                                unset($st['correct'], $st['explanation']);
                                $it['statements'][$j] = $st;
                            }
                        } elseif ($k === 'mc') {
                            unset($it['correct_id'], $it['explanation']);
                        } elseif ($k === 'sentence_insertion') {
                            unset($it['correct_marker'], $it['explanation']);
                        }
                        $sections[$si]['items'][$i] = $it;
                    }
                    break;
                case 'mc_cloze':
                    foreach (($s['blanks'] ?? []) as $i => $b) {
                        unset($b['correct_id'], $b['explanation']);
                        $sections[$si]['blanks'][$i] = $b;
                    }
                    break;
                case 'word_bank_cloze':
                case 'open_cloze':
                    foreach (($s['blanks'] ?? []) as $i => $b) {
                        unset($b['accepted_answers'], $b['explanation']);
                        $sections[$si]['blanks'][$i] = $b;
                    }
                    break;
            }
        }
        $config['sections'] = $sections;
        return $config;
    }

    /**
     * Auto-grade section-based. Trả raw_score, scaled_score, per-section stats, correct_answers.
     *
     * Answer key conventions:
     *  - single: "q{n}" → string
     *  - tf:     "q{n}.s{i}" → bool
     *  - match:  "q{n}.{i}" → letter
     */
    private function gradeSubmission(array $config, array $userAnswers): array
    {
        $rawScore = 0;
        $rawMax = 0;
        $correct = [];
        $correctQuestions = [];
        $sectionStats = [];

        foreach ($config['sections'] ?? [] as $s) {
            $type = $s['type'] ?? null;
            $pts = (float) ($s['points_per_question'] ?? 1);
            $secRaw = 0;
            $secMax = 0;
            $secCorrect = 0;
            $secTotal = 0;

            $checkSingle = function (string $key, $expected, $isText = false, array $accepted = [], bool $cs = false)
                use (&$userAnswers, &$correct, &$correctQuestions, &$secRaw, &$secMax, &$secCorrect, &$secTotal, $pts) {
                $correct[$key] = $expected;
                $secMax += $pts;
                $secTotal++;
                if ($isText) {
                    $userVal = trim((string) ($userAnswers[$key] ?? ''));
                    $isCorrect = ($userVal !== '' && $this->matchOpenCloze($userVal, $accepted, $cs));
                    $correctQuestions[$key] = $isCorrect;
                    if ($isCorrect) {
                        $secRaw += $pts;
                        $secCorrect++;
                    }
                } else {
                    $isCorrect = ($expected !== null && $expected !== '' && ($userAnswers[$key] ?? null) === $expected);
                    $correctQuestions[$key] = $isCorrect;
                    if ($isCorrect) {
                        $secRaw += $pts;
                        $secCorrect++;
                    }
                }
            };

            switch ($type) {
                case 'phonetics':
                case 'mc_questions':
                case 'error_identification':
                    foreach ($s['items'] ?? [] as $it) {
                        $qn = $it['question_number'] ?? '?';
                        $checkSingle("q{$qn}", $it['correct_id'] ?? null);
                    }
                    break;

                case 'listening':
                    foreach ($s['items'] ?? [] as $it) {
                        $qn = $it['question_number'] ?? '?';
                        $kind = $it['kind'] ?? 'mc';
                        if ($kind === 'fill_blank') {
                            $accepted = $it['accepted_answers'] ?? [];
                            $checkSingle("q{$qn}", $accepted[0] ?? '', true, $accepted, (bool)($it['case_sensitive'] ?? false));
                        } else {
                            $checkSingle("q{$qn}", $it['correct_id'] ?? null);
                        }
                    }
                    break;

                case 'writing':
                case 'speaking':
                    // Subjective — không tự chấm khách quan (writing/speaking: AI job + GV override).
                    break;

                case 'word_form':
                    foreach ($s['items'] ?? [] as $it) {
                        $qn = $it['question_number'] ?? '?';
                        $accepted = $it['accepted_answers'] ?? [];
                        $checkSingle("q{$qn}", $accepted[0] ?? '', true, $accepted, (bool)($it['case_sensitive'] ?? false));
                    }
                    break;

                case 'sentence_transformation':
                    foreach ($s['items'] ?? [] as $it) {
                        $qn = $it['question_number'] ?? '?';
                        $accepted = $it['accepted_answers'] ?? [];
                        $checkSingle("q{$qn}", $accepted[0] ?? '', true, $accepted, false);
                    }
                    break;

                case 'tf_group':
                    foreach ($s['items'] ?? [] as $it) {
                        $qn = $it['question_number'] ?? '?';
                        foreach ($it['statements'] ?? [] as $idx => $st) {
                            $key = "q{$qn}.s" . ($idx + 1);
                            $expected = (bool) ($st['correct'] ?? false);
                            $correct[$key] = $expected;
                            $secMax += $pts; $secTotal++;
                            $isCorrect = (array_key_exists($key, $userAnswers) && (bool) $userAnswers[$key] === $expected);
                            $correctQuestions[$key] = $isCorrect;
                            if ($isCorrect) {
                                $secRaw += $pts; $secCorrect++;
                            }
                        }
                    }
                    break;

                case 'reading_mixed':
                    foreach ($s['items'] ?? [] as $it) {
                        $kind = $it['kind'] ?? null;
                        $qn = $it['question_number'] ?? '?';
                        if ($kind === 'tf_group') {
                            foreach ($it['statements'] ?? [] as $idx => $st) {
                                $key = "q{$qn}.s" . ($idx + 1);
                                $expected = (bool) ($st['correct'] ?? false);
                                $correct[$key] = $expected;
                                $secMax += $pts; $secTotal++;
                                if (array_key_exists($key, $userAnswers) && (bool) $userAnswers[$key] === $expected) {
                                    $secRaw += $pts; $secCorrect++;
                                }
                            }
                        } elseif ($kind === 'mc') {
                            $checkSingle("q{$qn}", $it['correct_id'] ?? null);
                        } elseif ($kind === 'sentence_insertion') {
                            $checkSingle("q{$qn}", $it['correct_marker'] ?? null);
                        }
                    }
                    break;

                case 'matching':
                    foreach ($s['items'] ?? [] as $it) {
                        $qn = $it['question_number'] ?? '?';
                        foreach (($it['answers'] ?? []) as $idx => $expectedLetter) {
                            $key = "q{$qn}.{$idx}";
                            $correct[$key] = $expectedLetter;
                            $secMax += $pts; $secTotal++;
                            $isCorrect = (($userAnswers[$key] ?? null) === $expectedLetter);
                            $correctQuestions[$key] = $isCorrect;
                            if ($isCorrect) {
                                $secRaw += $pts; $secCorrect++;
                            }
                        }
                    }
                    break;

                case 'mc_cloze':
                    foreach ($s['blanks'] ?? [] as $b) {
                        $qn = $b['question_number'] ?? '?';
                        $checkSingle("q{$qn}", $b['correct_id'] ?? null);
                    }
                    break;

                case 'word_bank_cloze':
                case 'open_cloze':
                    foreach ($s['blanks'] ?? [] as $b) {
                        $qn = $b['question_number'] ?? '?';
                        $accepted = $b['accepted_answers'] ?? [];
                        $checkSingle("q{$qn}", $accepted[0] ?? '', true, $accepted, (bool)($b['case_sensitive'] ?? false));
                    }
                    break;
            }

            $rawScore += $secRaw;
            $rawMax += $secMax;
            $sectionStats[] = [
                'section_id' => $s['id'] ?? null,
                'type' => $type,
                'title' => $s['title'] ?? '',
                'correct_count' => $secCorrect,
                'total_count' => $secTotal,
                'raw_score' => $secRaw,
                'raw_max' => $secMax,
            ];
        }

        $rawMaxFinal = max($rawMax, 1);
        $scaleMax = $config['scale_max'] ?? self::DEFAULT_SCALE_MAX;
        $scaledScore = round(($rawScore / $rawMaxFinal) * $scaleMax, 2);

        return [
            'raw_score' => $rawScore,
            'raw_score_max' => $rawMaxFinal,
            'scaled_score' => $scaledScore,
            'scale_max' => $scaleMax,
            'sections' => $sectionStats,
            'correct_answers' => $correct,
            'correct_questions' => $correctQuestions,
        ];
    }

    private function matchOpenCloze(string $userVal, array $accepted, bool $caseSensitive): bool
    {
        $u = $caseSensitive ? $userVal : mb_strtolower($userVal);
        foreach ($accepted as $a) {
            $aNorm = $caseSensitive ? trim($a) : mb_strtolower(trim($a));
            if ($u === $aNorm) {
                return true;
            }
        }
        return false;
    }

    /**
     * Overlay điểm/nhận xét của giáo viên (teacher_*) lên field AI trong
     * result['speaking']['parts'] khi đọc kết quả cho học viên. Chỉ thao tác
     * trên bản sao trong bộ nhớ — KHÔNG sửa field AI đã lưu trong DB.
     *
     * Với mỗi câu có teacher_score: đặt score = teacher_score, criteria theo
     * teacher_*, feedback = teacher_feedback ?? feedback, thêm graded_by='teacher'.
     * Tính lại result.speaking.score từ điểm hiệu lực (teacher_score ?? score).
     */
    private function overlayTeacherScores(array $result): array
    {
        foreach (['speaking', 'writing'] as $skill) {
            if (!isset($result[$skill]['parts']) || !is_array($result[$skill]['parts'])) {
                continue;
            }
            $parts = $result[$skill]['parts'];
            $effScores = [];
            foreach ($parts as $key => $node) {
                if (!is_array($node)) continue;
                if (isset($node['teacher_score'])) {
                    // Overlay teacher → field hiển thị chính (không đụng DB field AI gốc đã lưu)
                    $node['score'] = (float) $node['teacher_score'];
                    if (isset($node['teacher_pronunciation_score'])) {
                        $node['pronunciation_score'] = $node['teacher_pronunciation_score'];
                    }
                    if (isset($node['teacher_content_score'])) {
                        $node['content_score'] = $node['teacher_content_score'];
                    }
                    if (array_key_exists('teacher_feedback', $node) && $node['teacher_feedback'] !== null) {
                        $node['feedback'] = $node['teacher_feedback'];
                    }
                    $node['graded_by'] = 'teacher';
                    $parts[$key] = $node;
                }
                $eff = $node['teacher_score'] ?? ($node['score'] ?? null);
                if ($eff !== null) {
                    $effScores[] = (float) $eff;
                }
            }
            $result[$skill]['parts'] = $parts;
            if (!empty($effScores)) {
                $result[$skill]['score'] = round(array_sum($effScores) / count($effScores), 2);
            }
        }
        return $result;
    }

    private function error(string $message, int $code = 400, $errors = null)
    {
        $resp = ['status' => 'error', 'message' => $message];
        if ($errors !== null) {
            $resp['errors'] = $errors;
        }
        return response()->json($resp, $code);
    }
}


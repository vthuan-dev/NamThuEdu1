<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Models\TestAssignment;
use App\Models\Exam;
use App\Models\Submission;
use App\Models\SubmissionAnswer;
use App\Models\Question;
use App\Models\ExamComment;
use App\Services\StudentProgressService;
use App\Services\VstepGradingService;
use App\Jobs\GradeVstepSubjectiveJob;

class StudentTestController extends Controller
{
    /**
     * GET /api/student/class-goals/next
     * Trả mục tiêu lớp gần nhất (active, chưa quá hạn) của lớp học viên + số ngày còn lại.
     */
    public function nextClassGoal(Request $request)
    {
        $student = $request->user();
        if (!$student || !$student->class_id) {
            return response()->json(['status' => 'success', 'data' => null]);
        }

        $goal = \App\Models\ClassGoal::where('class_id', $student->class_id)
            ->where('status', 'active')
            ->whereDate('target_date', '>=', \Carbon\Carbon::today())
            ->orderBy('target_date')
            ->first();

        if (!$goal) {
            return response()->json(['status' => 'success', 'data' => null]);
        }

        $daysRemaining = (int) \Carbon\Carbon::today()->diffInDays(\Carbon\Carbon::parse($goal->target_date), false);

        return response()->json([
            'status' => 'success',
            'data' => [
                'id'             => $goal->id,
                'goal_title'     => $goal->goal_title,
                'target_date'    => $goal->target_date->toDateString(),
                'target_level'   => $goal->target_level,
                'description'    => $goal->description,
                'days_remaining' => $daysRemaining,
            ],
        ]);
    }

    /**
     * Áp dụng bộ lọc đề thi theo độ tuổi học viên lên một query của bảng exams.
     *
     * Quy tắc phân loại:
     * - VSTEP        : chỉ dành cho adults
     * - STARTERS/MOVERS/FLYERS (Cambridge YL) : chỉ dành cho kids
     * - Các loại còn lại (IELTS, ...) : dùng chung
     *
     * Dùng chung cho index / upcomingTests / inProgressTests / getReminders
     * để tránh tình trạng teens vẫn thấy đề VSTEP ở dashboard.
     *
     * @param  \Illuminate\Database\Eloquent\Builder|\Illuminate\Database\Query\Builder  $examQuery
     * @param  string|null  $ageGroup
     */
    private function applyAgeGroupExamFilter($examQuery, ?string $ageGroup): void
    {
        $vstepOnly     = ['VSTEP'];
        $kidsOnlyTypes = ['STARTERS', 'MOVERS', 'FLYERS'];

        // Ẩn VSTEP với học viên không phải adults
        if ($ageGroup !== 'adults') {
            $examQuery->whereNotIn('eType', $vstepOnly);
        }
        // Ẩn STARTERS/MOVERS/FLYERS với học viên không phải kids
        if ($ageGroup !== 'kids') {
            $examQuery->whereNotIn('eType', $kidsOnlyTypes);
        }
    }

    /**
     * @OA\Get(
     *     path="/student/tests",
     *     tags={"Students"},
     *     summary="Get student tests",
     *     description="Get list of tests assigned to authenticated student",
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(
     *         response=200,
     *         description="Tests retrieved successfully"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
     * 
     * GET /api/student/tests
     * Lấy danh sách bài thi được gán cho học viên
     */
    public function index(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'student') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        // Get class IDs where student is enrolled (now stored on users.class_id directly)
        $classIds = $user->class_id ? [$user->class_id] : [];

        $ageGroup = $user->age_group;

        // Get assignments for student (individual or class-based)
        $assignments = TestAssignment::with(['exam' => function ($q) {
                                            $q->withCount('questions');
                                        }])
                                    ->whereHas('exam', function ($q) use ($ageGroup) {
                                        $this->applyAgeGroupExamFilter($q, $ageGroup);
                                    })
                                    ->where(function ($query) use ($user, $classIds) {
                                        // Individual assignments
                                        $query->where(function ($q) use ($user) {
                                            $q->where('taTarget_type', 'student')
                                              ->where('taTarget_id', $user->uId);
                                        })
                                        // Class assignments
                                        ->orWhere(function ($q) use ($classIds) {
                                            $q->where('taTarget_type', 'class')
                                              ->whereIn('taTarget_id', $classIds);
                                        });
                                    })
                                    ->orderBy('taCreated_at', 'desc')
                                    ->get();

        // Bulk-fetch all submissions for these assignments (avoid N+1)
        $assignmentIds = $assignments->pluck('taId')->all();
        $submissionsByAssignment = Submission::where('user_id', $user->uId)
                                            ->whereIn('assignment_id', $assignmentIds)
                                            ->orderBy('sStart_time', 'desc')
                                            ->get()
                                            ->groupBy('assignment_id');

        $now = now();
        $grouped = [
            'pending'     => [],
            'in_progress' => [],
            'completed'   => [],
        ];

        foreach ($assignments as $assignment) {
            $exam = $assignment->exam;
            if (!$exam) {
                continue;
            }

            $subs           = $submissionsByAssignment->get($assignment->taId, collect());
            $attemptsUsed   = $subs->count();
            $inProgressSub  = $subs->firstWhere('sStatus', 'in_progress');
            $finishedSub    = $subs->first(function ($s) {
                return in_array($s->sStatus, ['submitted', 'graded']);
            });

            // Single-bucket classification: in_progress > completed > pending
            if ($inProgressSub) {
                $status = 'in_progress';
            } elseif ($finishedSub) {
                $status = 'completed';
            } else {
                $status = 'pending';
            }

            // Deadline & urgency
            $deadline      = $assignment->taDeadline;
            $isUrgent      = false;
            $timeRemaining = '';
            if ($deadline) {
                $deadlineCarbon = \Carbon\Carbon::parse($deadline);
                $hours          = $now->diffInHours($deadlineCarbon, false);
                $isUrgent       = $hours >= 0 && $hours <= 24;
                if ($hours < 0) {
                    $timeRemaining = 'Đã hết hạn';
                } elseif ($hours < 1) {
                    $timeRemaining = 'Dưới 1 giờ';
                } elseif ($hours < 24) {
                    $timeRemaining = (int) round($hours) . ' giờ';
                } else {
                    $timeRemaining = (int) floor($hours / 24) . ' ngày';
                }
            }

            $relevantSub = $inProgressSub ?? $finishedSub;

            $item = [
                'assignment_id'    => $assignment->taId,
                'exam_id'          => $exam->eId,
                'exam_title'       => $exam->eTitle,
                'exam_type'        => $exam->eType,
                'exam_skill'       => $exam->eSkill,
                'exam_duration'    => $exam->eDuration_minutes ?? $exam->eDuration ?? 0,
                'total_questions'  => $exam->questions_count ?? 0,
                'max_score'        => $exam->eTotal_score ?? 100,
                'start_time'       => $assignment->taCreated_at,
                'end_time'         => $assignment->taDeadline,
                'deadline'         => $assignment->taDeadline,
                'is_urgent'        => $isUrgent,
                'time_remaining'   => $timeRemaining,
                'attempts_allowed' => $assignment->taMax_attempt,
                'attempts_used'    => $attemptsUsed,
                'status'           => $status,
                'submission_id'    => $relevantSub ? $relevantSub->sId : null,
                'score'            => $finishedSub ? (float) $finishedSub->sScore : null,
                'submitted_at'     => $finishedSub ? $finishedSub->sSubmit_time : null,
            ];

            $grouped[$status][] = $item;
        }

        return response()->json([
            'status' => 'success',
            'data'   => $grouped,
        ]);
    }

    /**
     * @OA\Get(
     *     path="/student/tests/{id}",
     *     tags={"Students"},
     *     summary="Get test details",
     *     description="Get detailed information about a specific test (without correct answers)",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=200, description="Test details retrieved successfully"),
     *     @OA\Response(response=404, description="Test not found")
     * )
     * 
     * GET /api/student/tests/{id}
     * Lấy chi tiết bài thi (không hiển thị đáp án đúng)
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'student') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $assignment = TestAssignment::with(['exam.questions.answers', 'exam.contentBlocks'])
                                    ->find($id);

        if (!$assignment) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài thi.'
            ], 404);
        }

        // VSTEP chỉ adults; IELTS: adults + teens; Cambridge YL: chỉ kids
        if ($assignment->exam->eType === 'VSTEP' && $user->age_group !== 'adults') {
            return response()->json([
                'status' => 'error',
                'message' => 'Đề thi VSTEP chỉ dành cho học viên từ 18 tuổi trở lên.'
            ], 403);
        }
        if ($assignment->exam->eType === 'IELTS' && !in_array($user->age_group, ['adults', 'teens'])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Đề thi IELTS dành cho học viên từ 13 tuổi trở lên.'
            ], 403);
        }

        // STARTERS / MOVERS / FLYERS chỉ dành cho kids
        if (in_array($assignment->exam->eType, ['STARTERS', 'MOVERS', 'FLYERS']) && $user->age_group !== 'kids') {
            return response()->json([
                'status' => 'error',
                'message' => 'Đề thi ' . $assignment->exam->eType . ' chỉ dành cho học viên nhỏ tuổi (kids).'
            ], 403);
        }

        // Check if student is eligible
        if (!$this->isStudentEligible($user->uId, $assignment)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập bài thi này.'
            ], 403);
        }

        // Hide correct answers from students and add frontend compatibility aliases
        $exam = $assignment->exam;
        $exam->questions->each(function($question) {
            // Add alias for frontend compatibility
            $question->qPassage = $question->qPassage_text;
            $question->qSkill = $question->qSkill ?? $question->qSection;
            
            // Hide correct answers
            $question->answers->each(function($answer) {
                unset($answer->aIs_correct);
            });
        });

        $attemptsUsed = Submission::where('user_id', $user->uId)
                                 ->where('assignment_id', $id)
                                 ->count();

        $responseData = [
            'taId'         => $assignment->taId,
            'taDeadline'   => $assignment->taDeadline,
            'taMax_attempt' => $assignment->taMax_attempt,
            'attemptsUsed' => $attemptsUsed,
            'exam'         => $this->buildExamData($exam),
        ];

        return response()->json([
            'status' => 'success',
            'data'   => $responseData,
        ]);
    }

    /**
     * @OA\Post(
     *     path="/student/tests/{id}/start",
     *     tags={"Students"},
     *     summary="Start test",
     *     description="Start taking a test (creates submission)",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=201, description="Test started successfully"),
     *     @OA\Response(response=400, description="Cannot start test (already completed, expired, etc.)")
     * )
     * 
     * POST /api/student/tests/{id}/start
     * Bắt đầu làm bài thi
     */
    public function start(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'student') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $assignment = TestAssignment::with(['exam.questions.answers', 'exam.contentBlocks'])
                                    ->find($id);

        if (!$assignment) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài thi.'
            ], 404);
        }

        // VSTEP chỉ adults; IELTS: adults + teens; Cambridge YL: chỉ kids
        if ($assignment->exam->eType === 'VSTEP' && $user->age_group !== 'adults') {
            return response()->json([
                'status' => 'error',
                'message' => 'Đề thi VSTEP chỉ dành cho học viên từ 18 tuổi trở lên.'
            ], 403);
        }
        if ($assignment->exam->eType === 'IELTS' && !in_array($user->age_group, ['adults', 'teens'])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Đề thi IELTS dành cho học viên từ 13 tuổi trở lên.'
            ], 403);
        }

        // STARTERS / MOVERS / FLYERS chỉ dành cho kids
        if (in_array($assignment->exam->eType, ['STARTERS', 'MOVERS', 'FLYERS']) && $user->age_group !== 'kids') {
            return response()->json([
                'status' => 'error',
                'message' => 'Đề thi ' . $assignment->exam->eType . ' chỉ dành cho học viên nhỏ tuổi (kids).'
            ], 403);
        }

        // Check eligibility
        if (!$this->isStudentEligible($user->uId, $assignment)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền làm bài thi này.'
            ], 403);
        }

        // Check deadline
        if ($assignment->taDeadline && now() > $assignment->taDeadline) {
            return response()->json([
                'status' => 'error',
                'message' => 'Bài thi đã hết hạn nộp.'
            ], 403);
        }

        // Check if there's already an in_progress submission (resume takes priority over attempt limit)
        $existingSubmission = Submission::where('user_id', $user->uId)
                                       ->where('assignment_id', $id)
                                       ->where('sStatus', 'in_progress')
                                       ->first();

        if ($existingSubmission) {
            // Kiểm tra thời gian còn lại
            $timeElapsed = now()->diffInMinutes($existingSubmission->sStart_time);
            $timeRemaining = $assignment->exam->eDuration_minutes - $timeElapsed;

            if ($timeRemaining <= 0) {
                // Tự động nộp bài hết thời gian
                return $this->autoSubmit($existingSubmission);
            }

            return response()->json([
                'status' => 'info',
                'message' => 'Bạn có bài thi đang làm dở. Bạn có thể tiếp tục làm bài.',
                'data' => [
                    'submissionId' => $existingSubmission->sId,
                    'timeRemaining' => $timeRemaining,
                    'canResume' => true
                ]
            ], 200);
        }

        // Check attempt limit (only when starting a brand-new attempt)
        $attemptsUsed = Submission::where('user_id', $user->uId)
                                 ->where('assignment_id', $id)
                                 ->count();

        if ($attemptsUsed >= $assignment->taMax_attempt) {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn đã hết số lần làm bài cho bài thi này.'
            ], 403);
        }

        // Create new submission
        $submission = Submission::create([
            'user_id' => $user->uId,
            'exam_id' => $assignment->exam_id,
            'assignment_id' => $id,
            'sAttempt' => $attemptsUsed + 1,
            'sStart_time' => now(),
            'sStatus' => 'in_progress',
            'last_activity_at' => now(),
        ]);

        // Hide correct answers and add frontend compatibility aliases
        $exam = $assignment->exam;
        $exam->questions->each(function($question) {
            // Add alias for frontend compatibility
            $question->qPassage = $question->qPassage_text;
            $question->qSkill = $question->qSkill ?? $question->qSection;
            
            // Hide correct answers from students
            $question->answers->each(function($answer) {
                unset($answer->aIs_correct);
            });
        });

        return response()->json([
            'status' => 'success',
            'data' => [
                'submissionId' => $submission->sId,
                'sStart_time'  => $submission->sStart_time,
                'exam'         => $this->buildExamData($exam),
            ]
        ]);
    }

    /**
     * @OA\Post(
     *     path="/student/tests/{submissionId}/answer",
     *     tags={"Students"},
     *     summary="Submit answer",
     *     description="Submit answer for a question during test",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="submissionId",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"question_id"},
     *             @OA\Property(property="question_id", type="integer", example=1),
     *             @OA\Property(property="answer_id", type="integer", example=2, description="For multiple choice questions"),
     *             @OA\Property(property="answer_text", type="string", example="Essay answer text", description="For essay questions")
     *         )
     *     ),
     *     @OA\Response(response=200, description="Answer submitted successfully"),
     *     @OA\Response(response=400, description="Invalid submission or question")
     * )
     * 
     * POST /api/student/tests/{submissionId}/answer
     * Lưu câu trả lời
     */
    public function answer(Request $request, $submissionId)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'student') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'question_id' => 'required|integer|exists:questions,qId',
            'saAnswer_text' => 'required|string|max:50000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        try {
            $result = DB::transaction(function () use ($request, $submissionId, $user) {
                // Lock the submission row to prevent concurrent answer modifications / submissions
                $submission = Submission::where('sId', $submissionId)
                                       ->where('user_id', $user->uId)
                                       ->lockForUpdate()
                                       ->first();

                if (!$submission) {
                    return [
                        'status' => 404,
                        'data' => [
                            'status' => 'error',
                            'message' => 'Không tìm thấy bài làm.'
                        ]
                    ];
                }

                if ($submission->sStatus !== 'in_progress') {
                    return [
                        'status' => 400,
                        'data' => [
                            'status' => 'error',
                            'message' => 'Bài làm đã được nộp hoặc không thể chỉnh sửa.'
                        ]
                    ];
                }

                $question = Question::where('qId', $request->question_id)
                    ->where('exam_id', $submission->exam_id)
                    ->first();

                if (!$question) {
                    return [
                        'status' => 403,
                        'data' => [
                            'status' => 'error',
                            'message' => 'Câu hỏi không thuộc bài thi này.'
                        ]
                    ];
                }

                // Check if answer already exists, update or create
                SubmissionAnswer::updateOrCreate(
                    [
                        'submission_id' => $submissionId,
                        'question_id' => $question->qId,
                    ],
                    [
                        'saAnswer_text' => $request->saAnswer_text,
                    ]
                );

                // Bump activity timestamp so cron inactivity check (> 15 min) stays accurate
                // even for clients still on the legacy /answer endpoint.
                $submission->update(['last_activity_at' => now()]);

                return [
                    'status' => 200,
                    'data' => [
                        'status' => 'success',
                        'data' => [
                            'message' => 'Câu trả lời đã được lưu.'
                        ]
                    ]
                ];
            });

            return response()->json($result['data'], $result['status']);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi hệ thống khi lưu câu trả lời.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Lưu nhiều câu trả lời cùng lúc (bulk save).
     * Dùng để force-flush toàn bộ answers trong local state lên backend
     * trước khi submit, đảm bảo không mất dữ liệu nếu các /answer call
     * trước đó đã thất bại âm thầm (network blip, throttle, race...).
     *
     * Body: {
     *   answers: [
     *     { question_id: int, saAnswer_text: string }, ...
     *   ]
     * }
     *
     * Response: { saved: int, skipped: int, errors: array }
     */
    public function bulkAnswer(Request $request, $submissionId)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'student') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'answers' => 'required|array|min:1|max:200',
            'answers.*.question_id' => 'required|integer',
            'answers.*.saAnswer_text' => 'required|string|max:50000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        try {
            $result = DB::transaction(function () use ($request, $submissionId, $user) {
                $submission = Submission::where('sId', $submissionId)
                                       ->where('user_id', $user->uId)
                                       ->lockForUpdate()
                                       ->first();

                if (!$submission) {
                    return ['status' => 404, 'data' => [
                        'status' => 'error',
                        'message' => 'Không tìm thấy bài làm.'
                    ]];
                }

                if ($submission->sStatus !== 'in_progress') {
                    return ['status' => 400, 'data' => [
                        'status' => 'error',
                        'message' => 'Bài làm đã được nộp hoặc không thể chỉnh sửa.'
                    ]];
                }

                // Pre-fetch all valid question IDs of this exam to avoid N+1
                $questionIds = collect($request->answers)->pluck('question_id')->unique()->all();
                $validQids = Question::where('exam_id', $submission->exam_id)
                    ->whereIn('qId', $questionIds)
                    ->pluck('qId')
                    ->all();
                $validSet = array_flip($validQids);

                $saved = 0;
                $skipped = 0;
                $errors = [];

                foreach ($request->answers as $item) {
                    $qId = (int) $item['question_id'];
                    if (!isset($validSet[$qId])) {
                        $skipped++;
                        $errors[] = ['question_id' => $qId, 'reason' => 'Câu hỏi không thuộc bài thi'];
                        continue;
                    }
                    SubmissionAnswer::updateOrCreate(
                        [
                            'submission_id' => $submissionId,
                            'question_id' => $qId,
                        ],
                        [
                            'saAnswer_text' => (string) $item['saAnswer_text'],
                        ]
                    );
                    $saved++;
                }

                $submission->update(['last_activity_at' => now()]);

                return ['status' => 200, 'data' => [
                    'status' => 'success',
                    'data' => [
                        'saved' => $saved,
                        'skipped' => $skipped,
                        'errors' => $errors,
                        'message' => "Đã lưu {$saved} câu trả lời.",
                    ]
                ]];
            });

            return response()->json($result['data'], $result['status']);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi hệ thống khi lưu câu trả lời hàng loạt.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * @OA\Post(
     *     path="/student/tests/{submissionId}/submit",
     *     tags={"Students"},
     *     summary="Submit test",
     *     description="Submit completed test for grading",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="submissionId",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=200, description="Test submitted successfully"),
     *     @OA\Response(response=400, description="Cannot submit test (not started, already submitted, etc.)")
     * )
     * 
     * POST /api/student/tests/{submissionId}/submit
     * Nộp bài thi
     */
    public function submit(Request $request, $submissionId)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'student') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'submit_idempotency_key' => 'nullable|string|max:64',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        $idempotencyKey = $request->input('submit_idempotency_key');

        if ($idempotencyKey) {
            $existingByKey = Submission::where('submit_idempotency_key', $idempotencyKey)
                ->where('user_id', $user->uId)
                ->first();

            if ($existingByKey) {
                return response()->json([
                    'status' => 'success',
                    'data' => [
                        'submissionId' => $existingByKey->sId,
                        'sScore' => $existingByKey->sScore,
                        'sStatus' => $existingByKey->sStatus,
                        'message' => 'Yêu cầu nộp bài đã được xử lý trước đó.'
                    ]
                ]);
            }
        }

        $submission = Submission::with(['exam.questions.answers', 'answers'])
                               ->where('sId', $submissionId)
                               ->where('user_id', $user->uId)
                               ->first();

        if (!$submission) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài làm.'
            ], 404);
        }

        if ($submission->sStatus === 'graded' || $submission->sStatus === 'auto_submitted') {
            return response()->json([
                'status' => 'success',
                'data' => [
                    'submissionId' => $submissionId,
                    'sScore' => $submission->sScore,
                    'sStatus' => $submission->sStatus,
                    'message' => 'Bài làm đã được nộp trước đó.'
                ]
            ]);
        }

        if ($submission->sStatus !== 'in_progress') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bài làm đã được nộp.'
            ], 400);
        }

        // For VSTEP/IELTS exams: only gate on MCQ questions (writing/speaking are manually graded)
        // Kids (STARTERS/MOVERS/FLYERS): cũng dùng cổng mềm vì có phần nói/viết chấm tay
        $isVstep = in_array(strtoupper($submission->exam->eType ?? ''), ['VSTEP', 'IELTS']);
        $isKidsExam = in_array(strtoupper($submission->exam->eType ?? ''), ['STARTERS', 'MOVERS', 'FLYERS']);
        $subjectiveTypes = ['essay', 'writing', 'speaking'];
        if ($isVstep || $isKidsExam) {
            $mcqQuestions = $submission->exam->questions->filter(function ($q) use ($subjectiveTypes) {
                return !in_array(strtolower($q->qType ?? ''), $subjectiveTypes)
                    && !in_array(strtolower($q->qSection ?? ''), ['writing', 'speaking'])
                    && !in_array(strtolower($q->qSkill ?? ''), ['writing', 'speaking']);
            });
            $answeredMcqIds = $submission->answers->pluck('question_id')->toArray();
            $mcqIds = $mcqQuestions->pluck('qId')->toArray();
            $unansweredMcq = array_diff($mcqIds, $answeredMcqIds);

            // Soft gate: pass nếu có BẤT KỲ câu nào (MCQ hoặc subjective writing/speaking)
            // đã có trong submission_answers. Tránh false-block khi user chỉ làm
            // writing/speaking mà không làm MCQ.
            $hasAnyAnswer = $submission->answers->count() > 0;
            // Speaking audio cũng tính như "đã làm" — backend uploadSpeakingAudio
            // ghi sGemini_feedback.speaking_audio + tạo placeholder row trong
            // submission_answers, nên $hasAnyAnswer thường đã true.
            $rawFeedbackChk = json_decode($submission->sGemini_feedback ?? '{}', true) ?? [];
            $hasSpeakingAudio = !empty($rawFeedbackChk['speaking_audio'] ?? []);

            if (!$hasAnyAnswer && !$hasSpeakingAudio) {
                \Log::warning('VSTEP/IELTS submit blocked: no answers at all', [
                    'submission_id' => $submissionId,
                    'user_id' => $user->uId,
                    'exam_id' => $submission->exam_id,
                    'mcq_ids_count' => count($mcqIds),
                ]);
                return response()->json([
                    'status' => 'error',
                    'message' => 'Bạn chưa trả lời bất kỳ câu hỏi nào.',
                    'unansweredQuestions' => array_values($unansweredMcq)
                ], 400);
            }

            // Log để diagnose case "0/35 + 0/40 + chưa có bài nào"
            \Log::info('VSTEP/IELTS submit gate passed', [
                'submission_id' => $submissionId,
                'user_id' => $user->uId,
                'exam_id' => $submission->exam_id,
                'total_mcq' => count($mcqIds),
                'answered_mcq_count' => count($mcqIds) - count($unansweredMcq),
                'unanswered_mcq_count' => count($unansweredMcq),
                'total_submission_answers' => $submission->answers->count(),
                'has_speaking_audio' => $hasSpeakingAudio,
            ]);
        } else {
            // Cổng mềm: chỉ chặn khi CHƯA trả lời câu nào. Câu bỏ trống sẽ được chấm 0 điểm.
            // (Khớp với UX: frontend đã cảnh báo "còn N câu chưa trả lời, vẫn nộp?" và cho nộp.)
            $totalQuestions = $submission->exam->questions->count();
            $answeredQuestions = $submission->answers->count();
            if ($totalQuestions > 0 && $answeredQuestions === 0) {
                \Log::warning('Non-VSTEP submit blocked: zero answers', [
                    'submission_id' => $submissionId,
                    'user_id' => $user->uId,
                    'exam_id' => $submission->exam_id,
                    'exam_type' => $submission->exam->eType,
                    'total_questions' => $totalQuestions,
                ]);
                $unansweredQuestions = $submission->exam->questions->pluck('qId')->toArray();
                return response()->json([
                    'status' => 'error',
                    'message' => 'Bạn chưa trả lời bất kỳ câu hỏi nào.',
                    'unansweredQuestions' => array_values($unansweredQuestions)
                ], 400);
            }

            \Log::info('Non-VSTEP submit gate passed', [
                'submission_id' => $submissionId,
                'user_id' => $user->uId,
                'exam_id' => $submission->exam_id,
                'exam_type' => $submission->exam->eType,
                'total_questions' => $totalQuestions,
                'answered_questions' => $answeredQuestions,
            ]);
        }

        DB::beginTransaction();
        try {
            $submission = Submission::with(['exam.questions.answers', 'answers'])
                ->where('sId', $submissionId)
                ->where('user_id', $user->uId)
                ->lockForUpdate()
                ->first();

            if (!$submission) {
                DB::rollBack();
                return response()->json([
                    'status' => 'error',
                    'message' => 'Không tìm thấy bài làm.'
                ], 404);
            }

            if ($submission->sStatus === 'graded' || $submission->sStatus === 'auto_submitted') {
                DB::rollBack();
                return response()->json([
                    'status' => 'success',
                    'data' => [
                        'submissionId' => $submissionId,
                        'sScore' => $submission->sScore,
                        'sStatus' => $submission->sStatus,
                        'message' => 'Bài làm đã được nộp trước đó.'
                    ]
                ]);
            }

            if ($submission->sStatus !== 'in_progress') {
                DB::rollBack();
                return response()->json([
                    'status' => 'error',
                    'message' => 'Bài làm không ở trạng thái cho phép nộp.'
                ], 400);
            }

            // ── Backfill blank answers for ALL unanswered questions ──────────
            // Đảm bảo mọi câu hỏi trong đề đều có row trong submission_answers
            // → gradeAnswers chấm 0 cho MCQ bỏ trống, teacher grading nhìn thấy
            //   đủ câu hỏi (cả writing/speaking chưa làm), result page nhất quán.
            $answeredQids = $submission->answers->pluck('question_id')->all();
            $missingQuestions = $submission->exam->questions->reject(function ($q) use ($answeredQids) {
                return in_array($q->qId, $answeredQids, true);
            });
            if ($missingQuestions->count() > 0) {
                $rowsToInsert = $missingQuestions->map(function ($q) use ($submissionId) {
                    return [
                        'submission_id'    => $submissionId,
                        'question_id'      => $q->qId,
                        'saAnswer_text'    => '',
                        'saIs_correct'     => null, // gradeAnswers sẽ set lại
                        'saPoints_awarded' => null,
                    ];
                })->all();
                SubmissionAnswer::insert($rowsToInsert);
                // Reload submission->answers để gradeAnswers thấy các row vừa thêm
                $submission->load('answers.question');
            }

            // Grade all answers — skip subjective (writing/speaking) for VSTEP/IELTS
            $isVstepTx = in_array(strtoupper($submission->exam->eType ?? ''), ['VSTEP', 'IELTS']);
            $subjTypes  = ['essay', 'writing', 'speaking'];
            $gradingResult = $this->gradeAnswers($submission->answers, $submission->exam_id, $isVstepTx, $subjTypes);
            if ($gradingResult['error']) {
                DB::rollBack();
                return response()->json(['status' => 'error', 'message' => $gradingResult['error']], 400);
            }

            $scorePercentage = $gradingResult['scorePercentage'];
            $vstepMeta       = $gradingResult['vstepMeta'];

            // VSTEP/IELTS: W+S need AI grading — only if writing answer has meaningful content (>=30 chars)
            $hasSubjectiveContent = false;
            if ($isVstepTx && $vstepMeta) {
                // Xác định các skill thực sự có trong đề (IELTS thường chỉ 1 skill/đề)
                // Dùng qSection ?? qSkill để chịu được data có 1 trong 2 cột.
                $examSections = $submission->exam->questions
                    ->map(fn($q) => strtolower($q->qSection ?? $q->qSkill ?? ''))
                    ->unique()->filter()->values()->all();
                $hasWritingSection  = in_array('writing', $examSections, true);
                $hasSpeakingSection = in_array('speaking', $examSections, true);

                $hasWriting = $submission->answers->contains(function ($a) {
                    $sec = strtolower($a->question->qSection ?? $a->question->qSkill ?? '');
                    if ($sec !== 'writing') return false;
                    return strlen(trim($a->saAnswer_text ?? '')) >= 30;
                });
                $rawFeedback = json_decode($submission->sGemini_feedback ?? '{}', true) ?? [];
                $hasSpeaking = !empty($rawFeedback['speaking_audio'] ?? []);
                $hasSubjectiveContent = $hasWriting || $hasSpeaking;

                // Auto-grade empty/short writing answers as 0 — chỉ khi đề CÓ phần writing
                if ($hasWritingSection && !$hasWriting) {
                    $submission->answers->filter(function ($a) {
                        $sec = strtolower($a->question->qSection ?? $a->question->qSkill ?? '');
                        return $sec === 'writing';
                    })->each(fn($a) => $a->update(['saPoints_awarded' => 0]));
                    $vstepMeta['writing'] = 0;
                }
                if ($hasSpeakingSection && !$hasSpeaking) {
                    $vstepMeta['speaking'] = 0;
                }

                // Recalculate overall = trung bình các skill CÓ điểm (bỏ qua skill không có trong đề)
                if (!$hasSubjectiveContent) {
                    $present = array_filter([
                        $vstepMeta['listening'],
                        $vstepMeta['reading'],
                        $hasWritingSection ? ($vstepMeta['writing'] ?? null) : null,
                        $hasSpeakingSection ? ($vstepMeta['speaking'] ?? null) : null,
                    ], fn($v) => $v !== null);
                    if (count($present) > 0) {
                        $scorePercentage = round((array_sum($present) / count($present)) * 10, 2);
                    }
                }
            }

            $finalStatus = ($isVstepTx && $hasSubjectiveContent) ? 'grading_subjective' : 'graded';

            // Teens (non-VSTEP/IELTS) Speaking exams cũng cần chấm AI: nếu có audio
            // speaking đã upload thì đưa về grading_subjective + dispatch job.
            $teensSpeakingNeedsAi = false;
            if (!$isVstepTx) {
                $rawFeedbackTeens = json_decode($submission->sGemini_feedback ?? '{}', true) ?? [];
                $hasSpeakingAudioTeens = !empty($rawFeedbackTeens['speaking_audio'] ?? []);
                $hasSpeakingQuestion = $submission->exam->questions->contains(function ($q) {
                    return strtolower($q->qSkill ?? $q->qSection ?? '') === 'speaking';
                });
                if ($hasSpeakingAudioTeens && $hasSpeakingQuestion) {
                    $teensSpeakingNeedsAi = true;
                    $finalStatus = 'grading_subjective';
                }
            }

            $updateData = [
                'sSubmit_time'           => now(),
                'submit_idempotency_key' => $idempotencyKey,
                'sScore'                 => $scorePercentage,
                'sStatus'                => $finalStatus,
            ];
            if ($finalStatus === 'graded') {
                $updateData['sGraded_time'] = now();
            }
            if ($vstepMeta) {
                // Preserve existing speaking_audio if present
                $existingRaw = json_decode($submission->sGemini_feedback ?? '{}', true) ?? [];
                $existingRaw['vstep_scores'] = $vstepMeta;
                $updateData['sGemini_feedback'] = json_encode($existingRaw);
            }
            $submission->update($updateData);

            DB::commit();

            // Log diagnostics — giúp diagnose case "0/35 + 0/40" của user
            \Log::info('VSTEP/IELTS/Generic submit completed', [
                'submission_id' => $submissionId,
                'user_id' => $user->uId,
                'exam_id' => $submission->exam_id,
                'final_status' => $finalStatus,
                'score' => $scorePercentage,
                'vstep_scores' => $vstepMeta,
                'total_answered_after_backfill' => $submission->answers->count(),
                'correct_answers_count' => $submission->answers->filter(fn($a) => $a->saIs_correct === true || $a->saIs_correct === 1)->count(),
            ]);

            $responseData = [
                'submissionId' => $submissionId,
                'sScore'       => $scorePercentage,
                'sStatus'      => $finalStatus,
                'message'      => $finalStatus === 'grading_subjective'
                    ? 'Nộp bài thành công. Đang chấm Writing & Speaking...'
                    : "Nộp bài thành công. Điểm số: {$scorePercentage}%",
            ];
            if ($vstepMeta) {
                $responseData['vstep_scores'] = $vstepMeta;
            }

            // Dispatch Writing + Speaking AI grading (queued — runs async via queue:work)
            if ($finalStatus === 'grading_subjective') {
                GradeVstepSubjectiveJob::dispatch($submission->sId);
            }

            return response()->json(['status' => 'success', 'data' => $responseData]);

        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Submit failed', [
                'submission_id' => $submissionId,
                'user_id'       => $user->uId ?? null,
                'error'         => $e->getMessage(),
                'trace'         => $e->getTraceAsString(),
                'file'          => $e->getFile(),
                'line'          => $e->getLine(),
            ]);
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi hệ thống khi nộp bài.',
                'debug'   => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * @OA\Get(
     *     path="/student/submissions",
     *     tags={"Students"},
     *     summary="Get student submissions",
     *     description="Get submission history for authenticated student",
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(response=200, description="Submissions retrieved successfully"),
     *     @OA\Response(response=401, description="Unauthorized")
     * )
     * 
     * GET /api/student/submissions
     * Xem lịch sử bài làm
     */
    public function submissions(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'student') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'per_page' => 'nullable|integer|min:1|max:100',
            'status' => 'nullable|string|in:in_progress,submitted,graded,auto_submitted',
            'exam_id' => 'nullable|integer|exists:exams,eId',
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date|after_or_equal:from_date',
            'sort_by' => 'nullable|string|in:sSubmit_time,sScore,sStart_time',
            'sort_order' => 'nullable|string|in:asc,desc',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Tham số không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        $perPage = (int) $request->input('per_page', 20);
        $sortBy = $request->input('sort_by', 'sSubmit_time');
        $sortOrder = $request->input('sort_order', 'desc');

        $query = Submission::with(['exam', 'assignment'])
            ->where('user_id', $user->uId);

        if ($request->filled('status')) {
            $query->where('sStatus', $request->input('status'));
        }

        if ($request->filled('exam_id')) {
            $query->where('exam_id', $request->input('exam_id'));
        }

        if ($request->filled('from_date')) {
            $query->whereDate('sSubmit_time', '>=', $request->input('from_date'));
        }

        if ($request->filled('to_date')) {
            $query->whereDate('sSubmit_time', '<=', $request->input('to_date'));
        }

        $submissions = $query
            ->orderBy($sortBy, $sortOrder)
            ->paginate($perPage);

        return response()->json([
            'status' => 'success',
            'data' => $submissions
        ]);
    }

    /**
     * @OA\Get(
     *     path="/student/submissions/{id}",
     *     tags={"Students"},
     *     summary="Get submission details",
     *     description="Get detailed information about a specific submission with scores and feedback",
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
     * GET /api/student/submissions/{id}
     * Xem chi tiết bài làm với điểm số và feedback
     */
    public function submissionDetail(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'student') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $submission = Submission::with([
            'exam.questions.answers', 
            'exam.teacher', 
            'answers.question', 
            'user'
        ])
        ->where('sId', $id)
        ->where('user_id', $user->uId)
        ->first();

        if (!$submission) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài làm.'
            ], 404);
        }

        $isVstep = in_array(strtoupper($submission->exam->eType ?? ''), ['VSTEP', 'IELTS']);

        if (!$isVstep) {
            return response()->json([
                'status' => 'success',
                'data'   => $submission,
            ]);
        }

        // ── VSTEP enriched response ───────────────────────────────────────────
        $raw = $submission->sGemini_feedback
            ? (is_array($submission->sGemini_feedback)
                ? $submission->sGemini_feedback
                : json_decode($submission->sGemini_feedback, true))
            : [];

        $vstepScores = $raw['vstep_scores'] ?? [
            'listening' => null, 'reading' => null,
            'writing'   => null, 'speaking' => null,
        ];

        // Per-skill answer stats (MCQ only — L and R)
        // ⚠️ Dùng qSection ?? qSkill để chịu được data có 1 trong 2 cột.
        $skillStats = ['listening' => ['correct' => 0, 'answered' => 0, 'total' => 0],
                       'reading'   => ['correct' => 0, 'answered' => 0, 'total' => 0]];

        // Count total questions per skill from exam
        foreach ($submission->exam->questions as $q) {
            $sec = strtolower($q->qSection ?? $q->qSkill ?? '');
            if (isset($skillStats[$sec])) {
                $skillStats[$sec]['total']++;
            }
        }

        // Count answered + correct per skill
        foreach ($submission->answers as $ans) {
            $sec = strtolower($ans->question->qSection ?? $ans->question->qSkill ?? '');
            if (isset($skillStats[$sec])) {
                $skillStats[$sec]['answered']++;
                if ($ans->saIs_correct) {
                    $skillStats[$sec]['correct']++;
                }
            }
        }

        // Writing/Speaking: check audio/text was submitted — qSection ?? qSkill fallback
        $writingAnswers  = $submission->answers->filter(function ($a) {
            $sec = strtolower($a->question->qSection ?? $a->question->qSkill ?? '');
            return $sec === 'writing'
                && trim((string) ($a->saAnswer_text ?? '')) !== '';
        })->count();
        $speakingAnswers = $submission->answers->filter(function ($a) {
            $sec = strtolower($a->question->qSection ?? $a->question->qSkill ?? '');
            return $sec === 'speaking';
        })->count();
        $speakingAudios  = isset($raw['speaking_audio']) ? count((array) $raw['speaking_audio']) : 0;

        // Các skill thực sự có trong đề (IELTS thường chỉ 1 skill/đề)
        $examSections = $submission->exam->questions
            ->map(fn($q) => strtolower($q->qSection ?? $q->qSkill ?? ''))
            ->unique()->filter()->values()->all();

        // VSTEP band from available (non-null) scores
        $availableScores = array_filter([
            $vstepScores['listening'] ?? null,
            $vstepScores['reading']   ?? null,
            $vstepScores['writing']   ?? null,
            $vstepScores['speaking']  ?? null,
        ], fn($v) => !is_null($v));

        // ⚠️ overall_avg chỉ tính khi MỌI skill có trong đề đã có điểm.
        // Nếu còn skill pending (W/S đang chờ AI/teacher chấm), trả null để
        // FE show "Đang chấm..." thay vì hiển thị avg nửa vời. UX này phù hợp
        // với yêu cầu: show ngay điểm L/R, đợi W/S xong mới show overall.
        $expectedSkillsForOverall = array_values(array_unique(array_filter(
            $examSections,
            fn($s) => in_array($s, ['listening', 'reading', 'writing', 'speaking'], true)
        )));
        $allExpectedScored = !empty($expectedSkillsForOverall) && collect($expectedSkillsForOverall)
            ->every(fn($s) => !is_null($vstepScores[$s] ?? null));

        if ($allExpectedScored) {
            $relevant = array_map(fn($s) => $vstepScores[$s], $expectedSkillsForOverall);
            $overallAvg = round(array_sum($relevant) / count($relevant), 2);
        } else {
            $overallAvg = null;
        }

        $vstepBand = null;
        if (!is_null($overallAvg)) {
            if ($overallAvg >= 7.5)     $vstepBand = 'C1';
            elseif ($overallAvg >= 6.0) $vstepBand = 'B2';
            elseif ($overallAvg >= 4.0) $vstepBand = 'B1';
            else                        $vstepBand = 'A2+';
        }

        $vstepMeta = [
            'is_vstep'       => true,
            'vstep_scores'   => $vstepScores,
            'vstep_band'     => $vstepBand,
            'overall_avg'    => $overallAvg,
            'skill_stats'    => $skillStats,
            'exam_sections'  => $examSections,
            'writing_submitted'  => $writingAnswers > 0,
            'speaking_submitted' => $speakingAudios > 0 || $speakingAnswers > 0,
            'pending_skills' => array_values(array_filter(['writing', 'speaking'], function ($s) use ($vstepScores, $examSections) {
                // Chỉ pending nếu đề CÓ skill đó và chưa có điểm
                return in_array($s, $examSections, true) && is_null($vstepScores[$s] ?? null);
            })),
        ];

        return response()->json([
            'status' => 'success',
            'data'   => array_merge($submission->toArray(), ['vstep_meta' => $vstepMeta]),
        ]);
    }

    /**
     * GET /api/student/tests/{id}/resume
     * Khôi phục bài thi bị gián đoạn (cúp điện, mất mạng)
     */
    public function resume(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'student') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        // Tìm submission đang dở
        $submission = Submission::with(['exam.questions.answers', 'exam.contentBlocks', 'answers'])
                               ->where('user_id', $user->uId)
                               ->where('assignment_id', $id)
                               ->where('sStatus', 'in_progress')
                               ->first();

        if (!$submission) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài thi đang làm dở.'
            ], 404);
        }

        // Kiểm tra thời gian còn lại
        $timeElapsed = now()->diffInMinutes($submission->sStart_time);
        $timeRemaining = $submission->exam->eDuration_minutes - $timeElapsed;

        // Nếu hết thời gian, tự động nộp bài
        if ($timeRemaining <= 0) {
            return $this->autoSubmit($submission);
        }

        // Ẩn đáp án đúng và thêm alias cho frontend
        $exam = $submission->exam;
        $exam->questions->each(function($question) {
            // Add alias for frontend compatibility
            $question->qPassage = $question->qPassage_text;
            $question->qSkill = $question->qSkill ?? $question->qSection;
            
            // Hide correct answers
            $question->answers->each(function($answer) {
                unset($answer->aIs_correct);
            });
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Khôi phục bài thi thành công. Bạn có thể tiếp tục làm bài.',
            'data' => [
                'submissionId' => $submission->sId,
                'sStart_time'  => $submission->sStart_time,
                'timeRemaining' => $timeRemaining,
                'exam'         => $this->buildExamData($exam),
                'savedAnswers' => $submission->answers,
            ]
        ]);
    }

    /**
     * Auto-submit when time expires (called by start/resume helpers).
     * Delegates to {@see ExamAutoSubmitService} for the unified grading + status logic.
     */
    private function autoSubmit($submission)
    {
        $submission->loadMissing(['exam.questions.answers', 'answers.question']);

        $result = app(\App\Services\ExamAutoSubmitService::class)
            ->autoSubmit($submission, \App\Services\ExamAutoSubmitService::REASON_TIMEOUT);

        if (!$result['ok']) {
            return response()->json([
                'status'  => 'error',
                'message' => $result['message'] ?? 'Lỗi khi tự động nộp bài.',
            ], 500);
        }

        return response()->json([
            'status'  => 'warning',
            'message' => $result['message'] ?? 'Bài thi đã hết thời gian và được tự động nộp.',
            'data'    => $result['data'] ?? [],
        ]);
    }

    /**
     * @OA\Get(
     *     path="/student/submissions/{id}/answers",
     *     tags={"Students"},
     *     summary="Get submission answers with correct answers and explanations",
     *     description="Get detailed answers including correct answers and explanations after submission",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=200, description="Answers retrieved successfully"),
     *     @OA\Response(response=404, description="Submission not found")
     * )
     * 
     * GET /api/student/submissions/{id}/grading-status
     * Poll VSTEP grading progress (W+S subjective)
     */
    public function getGradingStatus(Request $request, $id)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'student') {
            return response()->json(['status' => 'error', 'message' => 'Unauthorized.'], 401);
        }

        $submission = Submission::where('sId', $id)->where('user_id', $user->uId)->first();
        if (!$submission) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy bài làm.'], 404);
        }

        $raw         = $submission->sGemini_feedback
            ? (json_decode($submission->sGemini_feedback, true) ?? [])
            : [];
        $vstepScores = $raw['vstep_scores'] ?? [];

        return response()->json([
            'status' => 'success',
            'data'   => [
                'sStatus'      => $submission->sStatus,
                'sScore'       => $submission->sScore,
                'sGraded_time' => $submission->sGraded_time,
                'vstep_scores' => $vstepScores,
                'is_fully_graded' => $submission->sStatus === 'graded',
            ],
        ]);
    }

    /**
     * GET /api/student/submissions/{id}/answers
     * Xem đáp án đúng và giải thích sau khi nộp bài
     */
    public function submissionAnswers(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'student') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $submission = Submission::with([
            'exam.questions.answers', 
            'answers.question.answers'
        ])
        ->where('sId', $id)
        ->where('user_id', $user->uId)
        ->first();

        if (!$submission) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài làm.'
            ], 404);
        }

        // Chỉ cho phép xem đáp án sau khi nộp bài
        if ($submission->sStatus === 'in_progress') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn chỉ có thể xem đáp án sau khi nộp bài.'
            ], 403);
        }

        // Tạo dữ liệu chi tiết với đáp án đúng và giải thích
        $detailedAnswers = [];
        
        foreach ($submission->exam->questions as $question) {
            $studentAnswer = $submission->answers->where('question_id', $question->qId)->first();
            $correctAnswer = $question->answers->where('aIs_correct', true)->first();
            
            $detailedAnswers[] = [
                'question' => [
                    'qId' => $question->qId,
                    'qContent' => $question->qContent,
                    'qType' => $question->qType,
                    'qPoints' => $question->qPoints,
                    'qExplanation' => $question->qExplanation,
                    'qSection' => $question->qSection,
                    'kids_task_config' => $question->kids_task_config,
                ],
                'student_answer' => $studentAnswer ? [
                    'saAnswer_text' => $studentAnswer->saAnswer_text,
                    'saIs_correct' => $studentAnswer->saIs_correct,
                    'saPoints_awarded' => $studentAnswer->saPoints_awarded,
                ] : null,
                'correct_answer' => $correctAnswer ? [
                    'aContent' => $correctAnswer->aContent,
                    'aIs_correct' => $correctAnswer->aIs_correct,
                ] : null,
                'all_options' => $question->answers->map(function($answer) {
                    return [
                        'aId' => $answer->aId,
                        'aContent' => $answer->aContent,
                        'aIs_correct' => $answer->aIs_correct,
                    ];
                }),
                'analysis' => [
                    'is_correct' => $studentAnswer ? $studentAnswer->saIs_correct : false,
                    'points_earned' => $studentAnswer ? $studentAnswer->saPoints_awarded : 0,
                    'points_possible' => $question->qPoints,
                ]
            ];
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'submission_info' => [
                    'sId' => $submission->sId,
                    'sScore' => $submission->sScore,
                    'sStatus' => $submission->sStatus,
                    'sSubmit_time' => $submission->sSubmit_time,
                    'exam_title' => $submission->exam->eTitle,
                    'exam_id' => $submission->exam_id,
                    'exam_type' => $submission->exam->eType,
                    'exam_skill' => $submission->exam->eSkill,
                ],
                'detailed_answers' => $detailedAnswers,
                'summary' => [
                    'total_questions' => count($detailedAnswers),
                    'answered_questions' => $submission->answers->count(),
                    'correct_answers' => $submission->answers->where('saIs_correct', true)->count(),
                    'total_score' => $submission->sScore,
                ]
            ]
        ]);
    }

    /**
     * @OA\Get(
     *     path="/student/progress",
     *     tags={"Students"},
     *     summary="Get student learning progress",
     *     description="Get comprehensive learning progress statistics and trends",
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(response=200, description="Progress data retrieved successfully"),
     *     @OA\Response(response=401, description="Unauthorized")
     * )
     * 
     * GET /api/student/progress
     * Theo dõi tiến độ học tập chi tiết
     */
    public function progress(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'student') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $progressData = StudentProgressService::calculateDetailedProgress($user->uId);

        return response()->json([
            'status' => 'success',
            'data' => $progressData
        ]);
    }

    /**
     * @OA\Get(
     *     path="/student/submissions/{id}/compare",
     *     tags={"Students"},
     *     summary="Compare submission with previous attempts",
     *     description="Compare current submission with previous attempts and class average",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=200, description="Comparison data retrieved successfully"),
     *     @OA\Response(response=404, description="Submission not found")
     * )
     * 
     * GET /api/student/submissions/{id}/compare
     * So sánh kết quả với lần làm trước và trung bình lớp
     */
    public function compareSubmission(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'student') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $currentSubmission = Submission::with(['exam', 'assignment'])
                                      ->where('sId', $id)
                                      ->where('user_id', $user->uId)
                                      ->first();

        if (!$currentSubmission) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài làm.'
            ], 404);
        }

        // Tìm các lần làm trước của cùng bài thi
        $previousSubmissions = Submission::where('user_id', $user->uId)
                                        ->where('exam_id', $currentSubmission->exam_id)
                                        ->where('sId', '!=', $id)
                                        ->whereIn('sStatus', ['graded', 'auto_submitted'])
                                        ->orderBy('sSubmit_time', 'desc')
                                        ->get();

        // Lấy submission gần nhất trước đó
        $previousSubmission = $previousSubmissions->first();

        // Thống kê của tất cả học viên cùng bài thi
        $allSubmissions = Submission::where('exam_id', $currentSubmission->exam_id)
                                   ->whereIn('sStatus', ['graded', 'auto_submitted'])
                                   ->get();

        $classStats = [
            'total_students' => $allSubmissions->unique('user_id')->count(),
            'average_score' => round($allSubmissions->avg('sScore'), 2),
            'highest_score' => $allSubmissions->max('sScore'),
            'lowest_score' => $allSubmissions->min('sScore'),
            'median_score' => $this->calculateMedian($allSubmissions->pluck('sScore')->toArray()),
        ];

        // So sánh với lần làm trước
        $comparison = [];
        if ($previousSubmission) {
            $scoreDifference = $currentSubmission->sScore - $previousSubmission->sScore;
            $comparison = [
                'has_previous' => true,
                'previous_score' => $previousSubmission->sScore,
                'current_score' => $currentSubmission->sScore,
                'score_difference' => round($scoreDifference, 2),
                'improvement_percentage' => $previousSubmission->sScore > 0 ? 
                    round(($scoreDifference / $previousSubmission->sScore) * 100, 2) : 0,
                'previous_date' => $previousSubmission->sSubmit_time,
                'current_date' => $currentSubmission->sSubmit_time,
                'time_between' => $previousSubmission->sSubmit_time->diffForHumans($currentSubmission->sSubmit_time),
            ];
        } else {
            $comparison = [
                'has_previous' => false,
                'message' => 'Đây là lần đầu tiên bạn làm bài thi này.',
            ];
        }

        // Xếp hạng trong lớp
        $betterThanCount = $allSubmissions->where('sScore', '<', $currentSubmission->sScore)->count();
        $totalStudents = $allSubmissions->unique('user_id')->count();
        $ranking = $totalStudents - $betterThanCount;
        $percentile = $totalStudents > 0 ? round((($totalStudents - $ranking + 1) / $totalStudents) * 100, 1) : 0;

        // Phân tích chi tiết theo từng câu hỏi (nếu có lần làm trước)
        $questionAnalysis = [];
        if ($previousSubmission) {
            $currentAnswers = SubmissionAnswer::where('submission_id', $currentSubmission->sId)->get()->keyBy('question_id');
            $previousAnswers = SubmissionAnswer::where('submission_id', $previousSubmission->sId)->get()->keyBy('question_id');

            foreach ($currentAnswers as $questionId => $currentAnswer) {
                $previousAnswer = $previousAnswers->get($questionId);
                
                $questionAnalysis[] = [
                    'question_id' => $questionId,
                    'current_correct' => $currentAnswer->saIs_correct,
                    'previous_correct' => $previousAnswer ? $previousAnswer->saIs_correct : null,
                    'current_points' => $currentAnswer->saPoints_awarded,
                    'previous_points' => $previousAnswer ? $previousAnswer->saPoints_awarded : 0,
                    'improvement' => $previousAnswer ? 
                        ($currentAnswer->saPoints_awarded - $previousAnswer->saPoints_awarded) : null,
                ];
            }
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'current_submission' => [
                    'sId' => $currentSubmission->sId,
                    'sScore' => $currentSubmission->sScore,
                    'sSubmit_time' => $currentSubmission->sSubmit_time,
                    'exam_title' => $currentSubmission->exam->eTitle,
                ],
                'comparison_with_previous' => $comparison,
                'class_statistics' => $classStats,
                'ranking' => [
                    'position' => $ranking,
                    'total_students' => $totalStudents,
                    'percentile' => $percentile,
                    'better_than_percent' => round(($betterThanCount / max($totalStudents, 1)) * 100, 1),
                ],
                'question_analysis' => $questionAnalysis,
                'all_attempts' => $previousSubmissions->map(function($submission) {
                    return [
                        'sId' => $submission->sId,
                        'sScore' => $submission->sScore,
                        'sSubmit_time' => $submission->sSubmit_time,
                        'sAttempt' => $submission->sAttempt,
                    ];
                }),
            ]
        ]);
    }

    /**
     * Helper methods for calculations
     */
    private function calculateImprovement($submissions)
    {
        if ($submissions->count() < 2) {
            return null;
        }

        $first = $submissions->first()->sScore;
        $last = $submissions->last()->sScore;
        
        return [
            'first_score' => $first,
            'latest_score' => $last,
            'difference' => round($last - $first, 2),
            'percentage' => $first > 0 ? round((($last - $first) / $first) * 100, 2) : 0,
            'trend' => $last > $first ? 'improving' : ($last < $first ? 'declining' : 'stable'),
        ];
    }

    private function calculateConsistency($submissions)
    {
        if ($submissions->count() < 2) {
            return null;
        }

        $scores = $submissions->pluck('sScore')->toArray();
        $mean = array_sum($scores) / count($scores);
        $variance = array_sum(array_map(function($score) use ($mean) {
            return pow($score - $mean, 2);
        }, $scores)) / count($scores);
        
        $standardDeviation = sqrt($variance);
        $coefficientOfVariation = $mean > 0 ? ($standardDeviation / $mean) * 100 : 0;

        return [
            'standard_deviation' => round($standardDeviation, 2),
            'coefficient_of_variation' => round($coefficientOfVariation, 2),
            'consistency_level' => $coefficientOfVariation < 15 ? 'high' : 
                                 ($coefficientOfVariation < 25 ? 'medium' : 'low'),
        ];
    }

    private function getStrengthAreas($statsBySkill)
    {
        return $statsBySkill->sortByDesc('average_score')->take(2)->map(function($stat) {
            return [
                'skill' => $stat['skill'],
                'average_score' => $stat['average_score'],
            ];
        })->values();
    }

    private function getImprovementAreas($statsBySkill)
    {
        return $statsBySkill->sortBy('average_score')->take(2)->map(function($stat) {
            return [
                'skill' => $stat['skill'],
                'average_score' => $stat['average_score'],
            ];
        })->values();
    }

    private function calculateMedian($scores)
    {
        sort($scores);
        $count = count($scores);
        
        if ($count === 0) return 0;
        
        if ($count % 2 === 0) {
            return ($scores[$count / 2 - 1] + $scores[$count / 2]) / 2;
        } else {
            return $scores[floor($count / 2)];
        }
    }

    /**
     * Check if student is eligible for assignment
     */
    private function isStudentEligible($studentId, $assignment)
    {
        if ($assignment->taTarget_type === 'student') {
            return $assignment->taTarget_id == $studentId;
        } else if ($assignment->taTarget_type === 'class') {
            // Class enrollment now stored on users.class_id directly
            $studentClassId = \App\Models\User::where('uId', $studentId)->value('class_id');
            return $studentClassId && $studentClassId == $assignment->taTarget_id;
        }
        return false;
    }

    /**
     * Get in-progress tests for dashboard
     */
    public function inProgressTests(Request $request)
    {
        $studentId = $request->user()->uId;
        $ageGroup  = $request->user()->age_group ?? null;

        // Get submissions that are in progress (not submitted yet)
        $inProgressSubmissions = Submission::where('user_id', $studentId)
            ->where('sStatus', 'in_progress')
            ->whereHas('exam', function ($q) use ($ageGroup) {
                $this->applyAgeGroupExamFilter($q, $ageGroup);
            })
            ->with(['exam'])
            ->orderBy('sStart_time', 'desc')
            ->get();

        $tests = $inProgressSubmissions->map(function ($submission) {
            $exam = $submission->exam;
            $duration = $exam->eDuration_minutes ?? $exam->eDuration ?? 0;
            // sStart_time luôn ở quá khứ → số phút đã trôi qua phải dương.
            // Truyền absolute=true để không bị âm khi Carbon trả về giá trị có dấu.
            $timeElapsed = \Carbon\Carbon::parse($submission->sStart_time)->diffInMinutes(now(), true);
            $timeRemaining = max(0, $duration - $timeElapsed);

            return [
                'id'             => $exam->eId,
                'submission_id'  => $submission->sId,
                'assignment_id'  => $submission->assignment_id,
                'title'          => $exam->eTitle,
                'type'           => $exam->eType,
                'skill'          => $exam->eSkill,
                'time_remaining' => $timeRemaining,
                'total_duration' => $duration,
                'started_at'     => $submission->sStart_time,
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => $tests,
        ]);
    }

    /**
     * Get upcoming tests for dashboard
     */
    public function upcomingTests(Request $request)
    {
        $studentId = $request->user()->uId;
        $days = $request->input('days', 7);

        // Get class IDs where student is enrolled (now stored on users.class_id directly)
        $student  = $request->user();
        $classIds = $student && $student->class_id ? [$student->class_id] : [];
        $ageGroup = $student->age_group ?? null;

        // Get assignments that are upcoming (deadline within next X days, not yet expired)
        $upcomingAssignments = TestAssignment::where(function ($query) use ($studentId, $classIds) {
                $query->where(function ($q) use ($studentId) {
                    $q->where('taTarget_type', 'student')
                      ->where('taTarget_id', $studentId);
                })->orWhere(function ($q) use ($classIds) {
                    $q->where('taTarget_type', 'class')
                      ->whereIn('taTarget_id', $classIds);
                });
            })
            ->whereHas('exam', function ($q) use ($ageGroup) {
                $this->applyAgeGroupExamFilter($q, $ageGroup);
            })
            ->whereNotNull('taDeadline')
            ->where('taDeadline', '>=', now())
            ->where('taDeadline', '<=', now()->addDays($days))
            ->with(['exam'])
            ->orderBy('taDeadline', 'asc')
            ->get();

        $tests = $upcomingAssignments->map(function ($assignment) use ($studentId) {
            $exam = $assignment->exam;
            if (!$exam) {
                return null;
            }
            $deadline  = \Carbon\Carbon::parse($assignment->taDeadline);
            $daysUntil = now()->diffInDays($deadline, false);
            $isUrgent  = $daysUntil <= 1;

            // Skip if student has any active submission for this assignment
            // (in_progress belongs to /tests/in-progress; finished belongs to /tests completed)
            $hasActivity = Submission::where('user_id', $studentId)
                ->where('assignment_id', $assignment->taId)
                ->whereIn('sStatus', ['in_progress', 'submitted', 'graded'])
                ->exists();

            if ($hasActivity) {
                return null;
            }

            return [
                'id'            => $exam->eId,
                'assignment_id' => $assignment->taId,
                'title'         => $exam->eTitle,
                'type'          => $exam->eType,
                'skill'         => $exam->eSkill,
                'deadline'      => $assignment->taDeadline,
                'duration'      => $exam->eDuration_minutes ?? $exam->eDuration,
                'is_urgent'     => $isUrgent,
                'days_until'    => max(0, $daysUntil),
            ];
        })->filter()->values();

        return response()->json([
            'status' => 'success',
            'data' => $tests,
        ]);
    }

    /**
     * Get practice recommendations based on student performance
     */
    public function practiceRecommendations(Request $request)
    {
        $studentId = $request->user()->uId;

        // Get student's recent performance by skill
        $recentSubmissions = Submission::where('user_id', $studentId)
            ->where('sStatus', 'graded')
            ->with(['exam'])
            ->orderBy('sSubmit_time', 'desc')
            ->take(20)
            ->get();

        $skillStats = [];
        foreach ($recentSubmissions as $submission) {
            if (!$submission->exam || $submission->sScore === null) continue;
            $skill = $submission->exam->eSkill ?? 'mixed';
            if (!isset($skillStats[$skill])) {
                $skillStats[$skill] = [
                    'count' => 0,
                    'total_score' => 0,
                    'scores' => [],
                ];
            }
            $skillStats[$skill]['count']++;
            $skillStats[$skill]['total_score'] += $submission->sScore;
            $skillStats[$skill]['scores'][] = $submission->sScore;
        }

        // Calculate average and identify weak areas
        $recommendations = [];
        foreach ($skillStats as $skill => $stats) {
            $avgScore = $stats['total_score'] / $stats['count'];
            $maxScore = max($stats['scores']);
            
            // Recommend practice if average is below 70 or needs improvement
            if ($avgScore < 70) {
                $recommendations[] = [
                    'id' => count($recommendations) + 1,
                    'title' => 'Luyện ' . $this->getSkillName($skill) . ' - Cơ bản',
                    'reason' => 'Điểm trung bình của bạn là ' . round($avgScore, 1) . '. Hãy luyện tập thêm để cải thiện!',
                    'skill' => $skill,
                    'duration' => 30,
                    'question_count' => 15,
                    'difficulty' => 'easy',
                    'link' => '/luyen-tap?skill=' . $skill . '&difficulty=easy',
                ];
            } else if ($avgScore >= 70 && $avgScore < 85) {
                $recommendations[] = [
                    'id' => count($recommendations) + 1,
                    'title' => 'Luyện ' . $this->getSkillName($skill) . ' - Nâng cao',
                    'reason' => 'Bạn đang làm tốt! Thử thách bản thân với bài khó hơn nhé.',
                    'skill' => $skill,
                    'duration' => 45,
                    'question_count' => 20,
                    'difficulty' => 'medium',
                    'link' => '/luyen-tap?skill=' . $skill . '&difficulty=medium',
                ];
            } else {
                $recommendations[] = [
                    'id' => count($recommendations) + 1,
                    'title' => 'Luyện ' . $this->getSkillName($skill) . ' - Chuyên sâu',
                    'reason' => 'Xuất sắc! Hãy thử thách với các bài tập khó nhất.',
                    'skill' => $skill,
                    'duration' => 60,
                    'question_count' => 25,
                    'difficulty' => 'hard',
                    'link' => '/luyen-tap?skill=' . $skill . '&difficulty=hard',
                ];
            }
        }

        // If no data, provide general recommendations
        if (empty($recommendations)) {
            $recommendations = [
                [
                    'id' => 1,
                    'title' => 'Bắt đầu với Listening',
                    'reason' => 'Hãy bắt đầu hành trình học tập của bạn!',
                    'skill' => 'listening',
                    'duration' => 30,
                    'question_count' => 15,
                    'difficulty' => 'easy',
                    'link' => '/luyen-tap?skill=listening',
                ],
                [
                    'id' => 2,
                    'title' => 'Luyện Reading cơ bản',
                    'reason' => 'Đọc hiểu là nền tảng quan trọng!',
                    'skill' => 'reading',
                    'duration' => 30,
                    'question_count' => 15,
                    'difficulty' => 'easy',
                    'link' => '/luyen-tap?skill=reading',
                ],
            ];
        }

        return response()->json([
            'status' => 'success',
            'data' => array_slice($recommendations, 0, 3), // Return top 3
        ]);
    }

    /**
     * Get skill name in Vietnamese
     */
    private function getSkillName($skill)
    {
        $names = [
            'listening' => 'Nghe',
            'reading' => 'Đọc',
            'writing' => 'Viết',
            'speaking' => 'Nói',
        ];
        return $names[$skill] ?? $skill;
    }

    /**
     * GET /api/student/notifications
     */
    public function getNotifications(Request $request)
    {
        $studentId = $request->user()->uId;
        $student   = $request->user();
        $classIds  = $student && $student->class_id ? [$student->class_id] : [];
        $urgent    = $request->boolean('urgent', false);
        $limit     = (int) $request->input('limit', 20);

        $notifications = [];

        // Assignments with deadline within 24 hours
        $urgentAssignments = TestAssignment::where(function ($q) use ($studentId, $classIds) {
                $q->where(function ($s) use ($studentId) {
                    $s->where('taTarget_type', 'student')->where('taTarget_id', $studentId);
                })->orWhere(function ($s) use ($classIds) {
                    $s->where('taTarget_type', 'class')->whereIn('taTarget_id', $classIds);
                });
            })
            ->whereNotNull('taDeadline')
            ->where('taDeadline', '>=', now())
            ->where('taDeadline', '<=', now()->addDay())
            ->with(['exam'])
            ->get();

        foreach ($urgentAssignments as $assignment) {
            if (!$assignment->exam) continue;
            $hoursLeft = (int) now()->diffInHours($assignment->taDeadline, false);
            $notifications[] = [
                'id'           => 'assignment_' . $assignment->taId,
                'title'        => 'Bài thi sắp hết hạn',
                'message'      => $assignment->exam->eTitle . ' sẽ hết hạn trong ' . $hoursLeft . ' giờ nữa. Hãy hoàn thành ngay!',
                'type'         => 'deadline',
                'color'        => '#EF4444',
                'is_read'      => false,
                'created_at'   => $assignment->taDeadline,
                'action_url'   => '/bai-tap',
                'action_label' => 'Làm bài ngay',
            ];
        }

        // Recently graded submissions (last 3 days)
        $recentGraded = Submission::where('user_id', $studentId)
            ->where('sStatus', 'graded')
            ->whereNotNull('sGraded_time')
            ->where('sGraded_time', '>=', now()->subDays(3))
            ->with(['exam'])
            ->orderBy('sGraded_time', 'desc')
            ->take(5)
            ->get();

        foreach ($recentGraded as $submission) {
            if (!$submission->exam) continue;

            // Compute display score on 0–10 scale (match frontend gradeHelpers.getSubmissionDisplayScore)
            // - VSTEP: average of 4 AI skill scores (hệ 10), fallback sScore/10
            // - Other: sScore/10 (sScore is stored as percentage 0-100)
            $displayScore = null;
            $isVstep = strtoupper($submission->exam->eType ?? '') === 'VSTEP'
                || stripos($submission->exam->eTitle ?? '', 'VSTEP') !== false;

            if ($isVstep) {
                $raw = is_string($submission->sGemini_feedback)
                    ? (json_decode($submission->sGemini_feedback, true) ?: [])
                    : ((array) ($submission->sGemini_feedback ?? []));
                $vs = $raw['vstep_scores'] ?? [];
                $vals = [];
                foreach (['listening', 'reading', 'writing', 'speaking'] as $sk) {
                    if (isset($vs[$sk]) && is_numeric($vs[$sk])) {
                        $vals[] = (float) $vs[$sk];
                    }
                }
                if (count($vals) === 4) {
                    $displayScore = array_sum($vals) / 4;
                } elseif ($submission->sScore !== null) {
                    $displayScore = (float) $submission->sScore / 10;
                }
            } elseif ($submission->sScore !== null) {
                $displayScore = (float) $submission->sScore / 10;
            }

            $scoreLabel = $displayScore !== null
                ? number_format(round($displayScore, 1), 1, '.', '') . '/10'
                : '—';

            $notifications[] = [
                'id'           => 'graded_' . $submission->sId,
                'title'        => 'Kết quả bài thi đã có',
                'message'      => 'Bài thi ' . $submission->exam->eTitle . ' đã được chấm. Điểm: ' . $scoreLabel,
                'type'         => 'graded',
                'color'        => '#10B981',
                'is_read'      => false,
                'created_at'   => $submission->sGraded_time,
                'action_url'   => '/ket-qua/' . $submission->sId,
                'action_label' => 'Xem kết quả',
            ];
        }

        // Newly assigned tests (last 7 days, not yet started)
        $newAssignments = TestAssignment::where(function ($q) use ($studentId, $classIds) {
                $q->where(function ($s) use ($studentId) {
                    $s->where('taTarget_type', 'student')->where('taTarget_id', $studentId);
                })->orWhere(function ($s) use ($classIds) {
                    $s->where('taTarget_type', 'class')->whereIn('taTarget_id', $classIds);
                });
            })
            ->where('taCreated_at', '>=', now()->subDays(7))
            ->with(['exam'])
            ->latest('taCreated_at')
            ->take(5)
            ->get();

        $startedAssignmentIds = Submission::where('user_id', $studentId)
            ->pluck('assignment_id')
            ->filter()
            ->flip();

        foreach ($newAssignments as $assignment) {
            if (!$assignment->exam) continue;
            if ($startedAssignmentIds->has($assignment->taId)) continue;
            $notifications[] = [
                'id'           => 'new_' . $assignment->taId,
                'title'        => 'Bài thi mới được giao',
                'message'      => 'Bạn có bài thi mới: ' . $assignment->exam->eTitle . '. Hãy chuẩn bị và làm bài!',
                'type'         => 'assignment',
                'color'        => '#2563EB',
                'is_read'      => false,
                'created_at'   => $assignment->taCreated_at,
                'action_url'   => '/bai-tap',
                'action_label' => 'Xem bài thi',
            ];
        }

        // ── Replies vào comment của user trong exam discussions (last 14 days) ──
        // Lấy id các comment do user viết
        $userCommentIds = ExamComment::where('user_id', $studentId)
            ->where('is_deleted', false)
            ->pluck('id');

        if ($userCommentIds->isNotEmpty()) {
            $replies = ExamComment::with(['user', 'exam', 'parent'])
                ->whereIn('parent_id', $userCommentIds)
                ->where('user_id', '!=', $studentId)        // không tự notify chính mình
                ->where('is_deleted', false)
                ->where('created_at', '>=', now()->subDays(14))
                ->orderBy('created_at', 'desc')
                ->take(15)
                ->get();

            foreach ($replies as $reply) {
                if (!$reply->exam || !$reply->user) continue;

                $replierName = $reply->user->uName ?: 'Một người dùng';
                $examTitle   = $reply->exam->eTitle ?: 'đề thi';
                $preview     = mb_substr(preg_replace('/\s+/', ' ', (string) $reply->content), 0, 80);
                if (mb_strlen((string) $reply->content) > 80) {
                    $preview .= '…';
                }

                // URL: trang IELTS detail nếu là exam IELTS, fallback chung
                $eType = strtolower((string) ($reply->exam->eType ?? ''));
                if ($eType === 'ielts') {
                    $actionUrl = '/de-thi/ielts/' . $reply->exam_id
                        . '?tab=discussion#comment-' . $reply->id;
                } else {
                    // Generic exam detail (chưa có discussion ở các loại khác — vẫn link đề thi)
                    $actionUrl = '/de-thi/' . $reply->exam_id
                        . '?tab=discussion#comment-' . $reply->id;
                }

                $notifications[] = [
                    'id'           => 'comment_reply_' . $reply->id,
                    'title'        => $replierName . ' đã trả lời bình luận của bạn',
                    'message'      => '"' . $preview . '" — trong đề "' . $examTitle . '"',
                    'type'         => 'message',
                    'color'        => '#7C3AED',
                    'is_read'      => false,
                    'created_at'   => $reply->created_at,
                    'action_url'   => $actionUrl,
                    'action_label' => 'Xem bình luận',
                ];
            }
        }

        // ── Thông báo quan trọng của lớp (important/urgent, 30 ngày) ──
        if (!empty($classIds)) {
            $classAnns = \App\Models\ClassAnnouncement::whereIn('class_id', $classIds)
                ->whereIn('priority', ['important', 'urgent'])
                ->where('created_at', '>=', now()->subDays(30))
                ->orderByDesc('created_at')
                ->take(10)
                ->get();

            foreach ($classAnns as $ann) {
                $preview = mb_substr(strip_tags((string) $ann->content), 0, 100);
                if (mb_strlen(strip_tags((string) $ann->content)) > 100) {
                    $preview .= '…';
                }
                $notifications[] = [
                    'id'           => 'announcement_' . $ann->id,
                    'title'        => ($ann->priority === 'urgent' ? '🚨 ' : '📢 ') . $ann->title,
                    'message'      => $preview,
                    'type'         => 'message',
                    'color'        => $ann->priority === 'urgent' ? '#EF4444' : '#F59E0B',
                    'is_read'      => false,
                    'created_at'   => $ann->created_at,
                    'action_url'   => '/thong-bao',
                    'action_label' => 'Xem thông báo',
                ];
            }
        }

        // ── Đếm ngược mục tiêu lớp gần nhất (entry động, đổi theo ngày) ──
        if ($student && $student->class_id) {
            $goal = \App\Models\ClassGoal::where('class_id', $student->class_id)
                ->where('status', 'active')
                ->whereDate('target_date', '>=', now()->toDateString())
                ->orderBy('target_date')
                ->first();

            if ($goal) {
                $daysLeft = (int) \Carbon\Carbon::today()->diffInDays(\Carbon\Carbon::parse($goal->target_date), false);
                $notifications[] = [
                    'id'           => 'goal_' . $goal->id . '_' . now()->toDateString(),
                    'title'        => '🎯 Mục tiêu sắp tới',
                    'message'      => "Còn {$daysLeft} ngày đến {$goal->goal_title}. Cố gắng lên nhé!",
                    'type'         => 'reminder',
                    'color'        => '#7C3AED',
                    'is_read'      => false,
                    'created_at'   => now(),
                    'action_url'   => '/',
                    'action_label' => 'Bắt đầu học',
                ];
            }
        }

        // ── Lịch thi do giáo viên đặt (sắp tới, từ hôm nay trở đi) ──
        $examSchedules = \App\Models\StudentExamSchedule::where('student_id', $studentId)
            ->whereDate('exam_date', '>=', now()->toDateString())
            ->orderBy('exam_date')
            ->take(10)
            ->get();

        foreach ($examSchedules as $sch) {
            $examDate = \Carbon\Carbon::parse($sch->exam_date);
            $daysLeft = (int) \Carbon\Carbon::today()->diffInDays($examDate->copy()->startOfDay(), false);
            $whenText = $daysLeft === 0 ? 'hôm nay' : ($daysLeft === 1 ? 'ngày mai' : "còn {$daysLeft} ngày");
            $timeText = $sch->exam_time ? (' lúc ' . substr($sch->exam_time, 0, 5)) : '';
            $isUrgent = $daysLeft >= 0 && $daysLeft <= 3;
            $notifications[] = [
                'id'           => 'exam_schedule_' . $sch->id,
                'title'        => '📅 Lịch thi: ' . $sch->title,
                'message'      => 'Ngày thi ' . $examDate->format('d/m/Y') . $timeText . ' (' . $whenText . ')'
                    . ($sch->location ? ' · Tại: ' . $sch->location : ''),
                'type'         => 'reminder',
                'color'        => $isUrgent ? '#EF4444' : '#0EA5E9',
                'is_read'      => false,
                'created_at'   => $sch->created_at,
                'action_url'   => '/',
                'action_label' => 'Xem lịch thi',
            ];
        }

        // Sort newest first
        usort($notifications, function ($a, $b) {
            return strtotime((string)$b['created_at']) - strtotime((string)$a['created_at']);
        });

        if ($urgent) {
            $notifications = array_values(array_filter($notifications, fn($n) => $n['type'] === 'deadline'));
        }

        $notifications = array_slice($notifications, 0, $limit);

        $readAt = $request->user()->notifications_read_at;

        // Filter out notifications the student has dismissed
        $dismissedIds = $request->user()->dismissed_notification_ids ?? [];
        $dismissedSet = array_flip((array) $dismissedIds);
        $notifications = array_values(array_filter(
            $notifications,
            fn($n) => !isset($dismissedSet[(string) $n['id']])
        ));

        foreach ($notifications as &$notif) {
            $notif['is_read'] = $readAt && strtotime((string)$notif['created_at']) <= $readAt->timestamp;
        }
        unset($notif);

        $unreadCount = count(array_filter($notifications, fn($n) => !$n['is_read']));

        return response()->json([
            'status' => 'success',
            'data'   => [
                'notifications' => array_values($notifications),
                'unread_count'  => $unreadCount,
            ],
        ]);
    }

    /**
     * PUT /api/student/notifications/{id}/read
     * Dynamic notifications don't have DB rows — marking all at current time covers this.
     */
    public function markNotificationRead(Request $request, $id)
    {
        $user = $request->user();
        if (!$user->notifications_read_at) {
            $user->notifications_read_at = now();
            $user->save();
        }
        return response()->json(['status' => 'success', 'message' => 'Đã đánh dấu đã đọc.']);
    }

    /**
     * PUT /api/student/notifications/read-all
     */
    public function markAllNotificationsRead(Request $request)
    {
        $user = $request->user();
        $user->notifications_read_at = now();
        $user->save();
        return response()->json(['status' => 'success', 'message' => 'Đã đánh dấu tất cả đã đọc.']);
    }

    /**
     * DELETE /api/student/notifications/{id}
     * Persists the notification ID to dismissed_notification_ids so it
     * stays hidden across sessions. Caps the list at 200 to prevent bloat.
     */
    public function deleteNotification(Request $request, $id)
    {
        $user = $request->user();
        $dismissed = array_values((array) ($user->dismissed_notification_ids ?? []));

        $strId = (string) $id;
        if (!in_array($strId, $dismissed, true)) {
            $dismissed[] = $strId;
            // Keep only the most recent 200 dismissed IDs
            if (count($dismissed) > 200) {
                $dismissed = array_slice($dismissed, -200);
            }
            $user->dismissed_notification_ids = $dismissed;
            $user->save();
        }

        return response()->json(['status' => 'success', 'message' => 'Đã xóa thông báo.']);
    }

    /**
     * GET /api/student/reminders
     * Active teacher reminders for the current student.
     * Excludes reminders for assignments the student already finished
     * (submitted/graded) to keep the list focused.
     */
    public function getReminders(Request $request)
    {
        $studentId = $request->user()->uId;
        $ageGroup  = $request->user()->age_group ?? null;

        $reminders = \App\Models\AssignmentReminder::with([
                'assignment.exam:eId,eTitle,eType,eSkill,eDuration_minutes',
                'teacher:uId,uName',
            ])
            ->where('student_id', $studentId)
            ->whereNull('dismissed_at')
            ->whereHas('assignment.exam', function ($q) use ($ageGroup) {
                $this->applyAgeGroupExamFilter($q, $ageGroup);
            })
            ->orderByDesc('updated_at')
            ->get();

        // Exclude assignments the student has already finished.
        $finishedAssignmentIds = Submission::where('user_id', $studentId)
            ->whereIn('sStatus', ['submitted', 'graded'])
            ->whereNotNull('assignment_id')
            ->pluck('assignment_id')
            ->flip();

        $items = $reminders->filter(function ($r) use ($finishedAssignmentIds) {
            if (!$r->assignment || !$r->assignment->exam) return false;
            return !$finishedAssignmentIds->has($r->assignment_id);
        })->map(function ($r) {
            $a = $r->assignment;
            $exam = $a->exam;
            $deadline = $a->taDeadline ? \Carbon\Carbon::parse($a->taDeadline) : null;
            $daysUntil = $deadline ? (int) now()->diffInDays($deadline, false) : null;
            $isUrgent = $deadline ? $deadline->lte(now()->addDay()) : false;

            return [
                'id'            => $r->id,
                'assignment_id' => $a->taId,
                'exam_id'       => $exam->eId,
                'title'         => $exam->eTitle,
                'type'          => $exam->eType,
                'skill'         => $exam->eSkill,
                'duration'      => $exam->eDuration_minutes,
                'deadline'      => $a->taDeadline,
                'days_until'    => $daysUntil,
                'is_urgent'     => $isUrgent,
                'message'       => $r->message,
                'teacher_name'  => $r->teacher->uName ?? null,
                'sent_at'       => $r->updated_at,
                'read_at'       => $r->read_at,
            ];
        })->values();

        return response()->json([
            'status' => 'success',
            'data'   => [
                'reminders'    => $items,
                'unread_count' => $items->whereNull('read_at')->count(),
            ],
        ]);
    }

    /**
     * PUT /api/student/reminders/{id}/read
     */
    public function markReminderRead(Request $request, $id)
    {
        $studentId = $request->user()->uId;
        $reminder = \App\Models\AssignmentReminder::where('id', $id)
            ->where('student_id', $studentId)
            ->first();

        if (!$reminder) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy nhắc nhở.'], 404);
        }

        if (!$reminder->read_at) {
            $reminder->update(['read_at' => now()]);
        }

        return response()->json(['status' => 'success', 'message' => 'Đã đánh dấu đã đọc.']);
    }

    /**
     * DELETE /api/student/reminders/{id}
     * Soft-dismiss a reminder so it disappears from the dashboard.
     */
    public function dismissReminder(Request $request, $id)
    {
        $studentId = $request->user()->uId;
        $reminder = \App\Models\AssignmentReminder::where('id', $id)
            ->where('student_id', $studentId)
            ->first();

        if (!$reminder) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy nhắc nhở.'], 404);
        }

        $reminder->update(['dismissed_at' => now()]);

        return response()->json(['status' => 'success', 'message' => 'Đã ẩn nhắc nhở.']);
    }

    private function normalizeAnswer($value)
    {
        $normalized = trim((string) $value);
        return function_exists('mb_strtolower') ? mb_strtolower($normalized, 'UTF-8') : strtolower($normalized);
    }

    /**
     * Tách 1 đáp án thành tập hợp token (cho dạng "Choose TWO letters").
     * "A,C" / "A, C" / "AC" → ['a','c'] (đã sort, unique).
     */
    private function answerSet($value): array
    {
        $norm = $this->normalizeAnswer($value);
        if ($norm === '') return [];
        // Hỗ trợ "a,c" | "a c" | "a;c" | "ac" (chuỗi chữ cái liền)
        if (preg_match('/^[a-h]{2,}$/', $norm)) {
            $parts = str_split($norm);
        } else {
            $parts = preg_split('/[\s,;]+/', $norm);
        }
        $parts = array_values(array_unique(array_filter(array_map('trim', $parts), fn($p) => $p !== '')));
        sort($parts);
        return $parts;
    }

    /**
     * So đáp án học viên với đáp án đúng.
     *  • Biến thể: "twentieth/20th" hoặc "color|colour" → chấp nhận bất kỳ biến thể.
     *  • Multi-select: "A,C" → so sánh như tập hợp không thứ tự.
     */
    private function isCorrectAnswer($studentAnswer, $correctAnswer)
    {
        $student = $this->normalizeAnswer($studentAnswer);
        $correct = (string) $correctAnswer;

        // Multi-select: chỉ kích hoạt khi đáp án đúng có >1 token.
        $correctSet = $this->answerSet($correct);
        if (count($correctSet) > 1) {
            return $this->answerSet($studentAnswer) === $correctSet;
        }

        // Biến thể đáp án (chuẩn IELTS dùng "/" để ngăn cách lựa chọn thay thế).
        $variants = preg_split('/\s*[\/|]\s*/', $correct);
        foreach ($variants as $variant) {
            if ($this->normalizeAnswer($variant) === $student && $student !== '') {
                return true;
            }
        }
        return false;
    }

    /**
     * Chấm 1 kids task. Đáp án đúng nằm trong kids_task_config.task_data.
     * $rawAnswer là chuỗi JSON map (vd {"1":"go","2":"is"}) do player gói lại.
     *
     * Trả về: ['manual' => bool, 'ratio' => float 0..1]
     *  - manual=true: dạng nói / viết tự do → để giáo viên chấm tay.
     *  - ratio: tỉ lệ ô con đúng (chấm từng phần).
     */
    private function gradeKidsTask($question, $rawAnswer): array
    {
        $config   = $question->kids_task_config ?? [];
        $taskType = $config['task_type'] ?? '';
        $data     = $config['task_data'] ?? [];

        // Parse JSON map đáp án học viên
        $map = [];
        $trimmed = trim((string) $rawAnswer);
        if ($trimmed !== '' && strncmp($trimmed, '{', 1) === 0) {
            $decoded = json_decode($trimmed, true);
            if (is_array($decoded)) {
                foreach ($decoded as $k => $v) {
                    // Giữ boolean dạng 'true'/'false' (look_and_read lưu tick/cross = bool)
                    // — tránh (string)false === '' bị hiểu nhầm là chưa trả lời.
                    if (is_bool($v)) {
                        $map[(string) $k] = $v ? 'true' : 'false';
                    } else {
                        $map[(string) $k] = (string) $v;
                    }
                }
            }
        } elseif ($trimmed !== '') {
            $map['0'] = $trimmed;
        }

        // Một số editor lưu items/questions lồng trong 'config'.
        $cfg = $data['config'] ?? [];

        $eq = function ($a, $b) {
            $na = $this->normalizeAnswer((string) $a);
            $nb = $this->normalizeAnswer((string) $b);
            return $na !== '' && $na === $nb;
        };

        switch ($taskType) {
            case 'odd_one_out': {
                $correct = (string) ($data['correct_odd_one'] ?? '');
                $got = $map['0'] ?? '';
                return ['manual' => false, 'ratio' => ($got !== '' && $got === $correct) ? 1.0 : 0.0];
            }
            case 'word_definition_matching': {
                $words = $data['words'] ?? [];
                $n = count($words);
                if ($n === 0) return ['manual' => false, 'ratio' => 0.0];
                $correct = 0;
                for ($i = 0; $i < $n; $i++) {
                    // Player lưu nhãn chữ (A,B,C…); định nghĩa đúng của từ i mang nhãn chr(65+i)
                    if (($map[(string) $i] ?? '') === chr(65 + $i)) $correct++;
                }
                return ['manual' => false, 'ratio' => $correct / $n];
            }
            case 'dialogue_matching': {
                $dialogues = $data['dialogues'] ?? [];
                $n = count($dialogues);
                if ($n === 0) return ['manual' => false, 'ratio' => 0.0];
                $correct = 0;
                foreach ($dialogues as $i => $d) {
                    if (($map[(string) $i] ?? '') === (string) ($d['correct_answer'] ?? '')) $correct++;
                }
                return ['manual' => false, 'ratio' => $correct / $n];
            }
            case 'listening_letter_match': {
                // Player lọc bỏ subject ví dụ rồi đánh index từ 0 → grader làm y hệt
                $subjects = array_values(array_filter(
                    $data['subjects'] ?? [],
                    fn($s) => empty($s['is_example']) && empty($s['isExample'])
                ));
                $n = count($subjects);
                if ($n === 0) return ['manual' => false, 'ratio' => 0.0];
                $correct = 0;
                foreach ($subjects as $i => $s) {
                    $expected = (string) ($s['correct_letter'] ?? $s['correctLetter'] ?? '');
                    if (($map[(string) $i] ?? '') === $expected && $expected !== '') $correct++;
                }
                return ['manual' => false, 'ratio' => $correct / $n];
            }
            case 'cloze_test': {
                $gaps = $data['gaps'] ?? [];
                $items = 0; $correct = 0;
                foreach ($gaps as $g) {
                    $items++;
                    $key = (string) ($g['gap_id'] ?? '');
                    if ($eq($map[$key] ?? '', $g['correct_answer'] ?? '')) $correct++;
                }
                if (!empty($data['story_title_question'])) {
                    $items++;
                    if ($eq($map['title'] ?? '', $data['story_title_question']['correct_answer'] ?? '')) $correct++;
                }
                if ($items === 0) return ['manual' => false, 'ratio' => 0.0];
                return ['manual' => false, 'ratio' => $correct / $items];
            }
            case 'open_cloze': {
                $gaps = $data['gaps'] ?? [];
                $n = count($gaps);
                if ($n === 0) return ['manual' => false, 'ratio' => 0.0];
                $correct = 0;
                foreach ($gaps as $g) {
                    $key = (string) ($g['gap_id'] ?? '');
                    $studentN = $this->normalizeAnswer($map[$key] ?? '');
                    foreach (($g['correct_answers'] ?? []) as $acc) {
                        if ($studentN !== '' && $this->normalizeAnswer($acc) === $studentN) { $correct++; break; }
                    }
                }
                return ['manual' => false, 'ratio' => $correct / $n];
            }
            case 'story_completion': {
                $sentences = $data['completion_sentences'] ?? [];
                $n = count($sentences);
                if ($n === 0) return ['manual' => false, 'ratio' => 0.0];
                $correct = 0;
                foreach ($sentences as $i => $s) {
                    if ($eq($map[(string) $i] ?? '', $s['correct_answer'] ?? '')) $correct++;
                }
                return ['manual' => false, 'ratio' => $correct / $n];
            }
            case 'unscramble_words': {
                $items = array_values(array_filter($data['items'] ?? [], fn($it) => empty($it['isExample'])));
                $n = count($items);
                if ($n === 0) return ['manual' => false, 'ratio' => 0.0];
                $correct = 0;
                foreach ($items as $i => $it) {
                    if ($eq($map[(string) $i] ?? '', $it['correct_answer'] ?? '')) $correct++;
                }
                return ['manual' => false, 'ratio' => $correct / $n];
            }
            case 'word_bank_fill': {
                $gaps = array_values(array_filter($data['gaps'] ?? [], fn($g) => empty($g['isExample'])));
                $n = count($gaps);
                if ($n === 0) return ['manual' => false, 'ratio' => 0.0];
                $correct = 0;
                foreach ($gaps as $g) {
                    $key = (string) ($g['gap_number'] ?? '');
                    if ($eq($map[$key] ?? '', $g['correct_word'] ?? '')) $correct++;
                }
                return ['manual' => false, 'ratio' => $correct / $n];
            }
            case 'reading_comprehension': {
                $questions = $data['questions'] ?? [];
                $n = count($questions);
                if ($n === 0) return ['manual' => false, 'ratio' => 0.0];
                $correct = 0;
                foreach ($questions as $i => $qq) {
                    if ($eq($map[(string) $i] ?? '', $qq['answer'] ?? '')) $correct++;
                }
                return ['manual' => false, 'ratio' => $correct / $n];
            }
            case 'listen_and_draw_lines': {
                // Nối tên (label) vào đúng hotspot trên tranh.
                // Player lưu { [labelIndex]: hotspotIndex }. Đúng khi label i nối vào hotspot i.
                $items = $data['items'] ?? [];
                $gradable = 0; $correct = 0;
                foreach ($items as $i => $it) {
                    if (!empty($it['isExample']) || !empty($it['is_example'])) continue; // ví dụ
                    $gradable++;
                    $got = $map[(string) $i] ?? '';
                    if ($got !== '' && (int) $got === (int) $i) $correct++;
                }
                if ($gradable === 0) return ['manual' => false, 'ratio' => 0.0];
                return ['manual' => false, 'ratio' => $correct / $gradable];
            }
            case 'listen_and_tick': {
                $items = $data['items'] ?? ($cfg['items'] ?? []);
                $gradable = 0; $correct = 0;
                foreach ($items as $i => $it) {
                    if (!empty($it['isExample']) || !empty($it['is_example'])) continue;
                    $gradable++;
                    $corr = strtoupper((string) ($it['correctAnswer'] ?? $it['correct_answer'] ?? ''));
                    $got = strtoupper((string) ($map[(string) $i] ?? ''));
                    if ($got !== '' && $got === $corr) $correct++;
                }
                if ($gradable === 0) return ['manual' => false, 'ratio' => 0.0];
                return ['manual' => false, 'ratio' => $correct / $gradable];
            }
            case 'listen_and_write': {
                $list = !empty($data['questions']) ? $data['questions']
                      : ($data['items'] ?? ($cfg['questions'] ?? $cfg['items'] ?? []));
                $gradable = 0; $correct = 0;
                foreach ($list as $i => $q) {
                    if (!empty($q['isExample']) || !empty($q['is_example'])) continue;
                    $gradable++;
                    $corr = $q['answer'] ?? $q['correct_answer'] ?? $q['correctAnswer'] ?? '';
                    if ($eq($map[(string) $i] ?? '', $corr)) $correct++;
                }
                if ($gradable === 0) return ['manual' => false, 'ratio' => 0.0];
                return ['manual' => false, 'ratio' => $correct / $gradable];
            }
            case 'look_and_read': {
                $list = !empty($data['questions']) ? $data['questions']
                      : ($data['items'] ?? ($cfg['questions'] ?? $cfg['items'] ?? []));
                $gradable = 0; $correct = 0;
                foreach ($list as $i => $q) {
                    if (!empty($q['isExample']) || !empty($q['is_example'])) continue;
                    $gradable++;
                    $corrRaw = strtolower((string) ($q['correctAnswer'] ?? $q['correct_answer'] ?? ''));
                    $corrTrue = in_array($corrRaw, ['tick', 'true', 'yes', '1'], true);
                    $rawVal = strtolower((string) ($map[(string) $i] ?? ''));
                    $answered = $rawVal !== '';
                    $studentTrue = in_array($rawVal, ['true', 'tick', 'yes', '1'], true);
                    if ($answered && $studentTrue === $corrTrue) $correct++;
                }
                if ($gradable === 0) return ['manual' => false, 'ratio' => 0.0];
                return ['manual' => false, 'ratio' => $correct / $gradable];
            }
            case 'look_read_write': {
                $list = !empty($data['questions']) ? $data['questions']
                      : ($data['items'] ?? ($cfg['questions'] ?? $cfg['items'] ?? []));
                $gradable = 0; $correct = 0;
                foreach ($list as $i => $q) {
                    if (!empty($q['isExample']) || !empty($q['is_example'])) continue;
                    $qType = $q['question_type'] ?? $q['questionType'] ?? '';
                    if ($qType === 'free_write') continue; // tự luận → giáo viên chấm
                    $gradable++;
                    $corr = $q['correct_answer'] ?? $q['correctAnswer'] ?? '';
                    if ($eq($map[(string) $i] ?? '', $corr)) $correct++;
                }
                // Toàn câu tự luận → để giáo viên chấm tay
                if ($gradable === 0) return ['manual' => true, 'ratio' => 0.0];
                return ['manual' => false, 'ratio' => $correct / $gradable];
            }
            default:
                // Nói / viết tự do / dạng chưa hỗ trợ → giáo viên chấm tay
                return ['manual' => true, 'ratio' => 0.0];
        }
    }

    /**
     * Grade submission answers — VSTEP-aware.
     * Skips subjective (writing/speaking) questions and computes per-skill scores for VSTEP.
     *
     * Returns:
     *   ['error' => null|string, 'scorePercentage' => float, 'vstepMeta' => array|null]
     */
    /**
     * Public so that ExamAutoSubmitService (cron / unload / heartbeat-timeout)
     * can reuse the exact same grading logic without duplicating it.
     */
    public function gradeAnswers($answers, $examId, bool $isVstep, array $subjectiveTypes): array
    {
        $totalScore   = 0;
        $maxScore     = 0;
        $skillBuckets = []; // ['listening' => ['correct'=>0,'total'=>0], ...]

        foreach ($answers as $submissionAnswer) {
            $question = Question::with('answers')->find($submissionAnswer->question_id);
            if (!$question || (int) $question->exam_id !== (int) $examId) {
                return ['error' => 'Dữ liệu câu hỏi không hợp lệ cho bài thi này.', 'scorePercentage' => 0, 'vstepMeta' => null];
            }

            $qType    = strtolower($question->qType    ?? '');
            // Resolve skill section (listening/reading/writing/speaking) — chấp nhận
            // cả qSection lẫn qSkill (có exam set chỉ 1 trong 2 cột).
            $qSection = strtolower($question->qSection ?? $question->qSkill ?? '');

            // Subjective check: skip grading for writing/speaking
            $qSkill = strtolower($question->qSkill ?? '');
            $isSubjective = in_array($qType, $subjectiveTypes)
                         || in_array($qSkill,    ['writing', 'speaking'])
                         || ($isVstep && in_array($qSection, ['writing', 'speaking']));

            if ($isSubjective) {
                // Mark as pending manual grading — no points, no wrong
                $submissionAnswer->update(['saIs_correct' => null, 'saPoints_awarded' => null]);
                continue;
            }

            // Kids task: đáp án đúng nằm trong kids_task_config.task_data (không có bảng answers).
            if ($qType === 'kids_task') {
                $maxScore += $question->qPoints;
                $kidsResult = $this->gradeKidsTask($question, $submissionAnswer->saAnswer_text ?? '');

                if ($kidsResult['manual']) {
                    // Dạng nói / viết tự do → chờ giáo viên chấm tay
                    $submissionAnswer->update(['saIs_correct' => null, 'saPoints_awarded' => null]);
                    continue;
                }

                $awarded = round($question->qPoints * $kidsResult['ratio'], 2);
                $submissionAnswer->update([
                    'saIs_correct'     => $kidsResult['ratio'] >= 0.999,
                    'saPoints_awarded' => $awarded,
                ]);
                $totalScore += $awarded;
                continue;
            }

            $correctAnswer = $question->answers->where('aIs_correct', true)->first();
            $maxScore += $question->qPoints;

            // Check if student answer is correct via two strategies:
            // 1. Direct text match (e.g., student sends full answer text)
            // 2. Letter-based MCQ (student sends "A"/"B"/"C"/"D" → map to nth answer by creation order)
            $studentText = trim($submissionAnswer->saAnswer_text ?? '');
            $isCorrect   = false;

            if ($correctAnswer && $this->isCorrectAnswer($studentText, $correctAnswer->aContent)) {
                $isCorrect = true;
            } elseif (preg_match('/^[A-Da-d]$/', $studentText)) {
                $letterIdx = ord(strtoupper($studentText)) - ord('A'); // A=0,B=1,C=2,D=3
                // Prefer aOrder column if present, else fallback to insertion order (aId)
                $firstAnswer    = $question->answers->first();
                $hasOrder       = $firstAnswer && $firstAnswer->aOrder !== null;
                $orderedAnswers = $hasOrder
                    ? $question->answers->sortBy('aOrder')->values()
                    : $question->answers->sortBy('aId')->values();
                $picked = $orderedAnswers->get($letterIdx);
                if ($picked && $picked->aIs_correct) {
                    $isCorrect = true;
                }
            }

            if ($isCorrect) {
                $submissionAnswer->update(['saIs_correct' => true, 'saPoints_awarded' => $question->qPoints]);
                $totalScore += $question->qPoints;
                if ($isVstep && $qSection) {
                    $skillBuckets[$qSection]['correct'] = ($skillBuckets[$qSection]['correct'] ?? 0) + 1;
                    $skillBuckets[$qSection]['total']   = ($skillBuckets[$qSection]['total']   ?? 0) + 1;
                }
            } else {
                $submissionAnswer->update(['saIs_correct' => false, 'saPoints_awarded' => 0]);
                if ($isVstep && $qSection) {
                    $skillBuckets[$qSection]['correct'] = ($skillBuckets[$qSection]['correct'] ?? 0);
                    $skillBuckets[$qSection]['total']   = ($skillBuckets[$qSection]['total']   ?? 0) + 1;
                }
            }
        }

        $scorePercentage = $maxScore > 0 ? round(($totalScore / $maxScore) * 100, 2) : 0;

        // Build VSTEP per-skill meta (0–10 scale, null for subjective)
        $vstepMeta = null;
        if ($isVstep) {
            // Determine which skills exist in the exam by checking ALL questions in exam (not just answered ones)
            // Lấy cả qSection và qSkill rồi merge, vì có exam chỉ set 1 trong 2 cột.
            $sectionSkills = Question::where('exam_id', $examId)
                ->whereNotNull('qSection')
                ->distinct()
                ->pluck('qSection')
                ->map(fn($s) => strtolower($s))
                ->filter()
                ->values()
                ->toArray();
            $skillSkills = Question::where('exam_id', $examId)
                ->whereNotNull('qSkill')
                ->distinct()
                ->pluck('qSkill')
                ->map(fn($s) => strtolower($s))
                ->filter()
                ->values()
                ->toArray();
            $examSkills = array_values(array_unique(array_merge($sectionSkills, $skillSkills)));

            // Initialize skill scores: if skill has no answers, set to 0.0 (not null)
            // Only set to null if skill doesn't exist in exam at all
            $vstepMeta = [
                'listening' => null,
                'reading'   => null,
                'writing'   => null,
                'speaking'  => null,
                'raw_mcq_pct' => $scorePercentage,
            ];

            // Calculate MCQ scores (listening, reading)
            if (in_array('listening', $examSkills)) {
                $vstepMeta['listening'] = isset($skillBuckets['listening'])
                    ? round(($skillBuckets['listening']['correct'] / max(1, $skillBuckets['listening']['total'])) * 10, 2)
                    : 0.0; // Exam has listening but student didn't answer
            }
            if (in_array('reading', $examSkills)) {
                $vstepMeta['reading'] = isset($skillBuckets['reading'])
                    ? round(($skillBuckets['reading']['correct'] / max(1, $skillBuckets['reading']['total'])) * 10, 2)
                    : 0.0; // Exam has reading but student didn't answer
            }

            // Writing and Speaking will be graded later (kept as null for now)
            // They will be updated when AI grading completes

            // Overall score = average of available skill scores (L + R only for now)
            $availableScores = array_filter([$vstepMeta['listening'], $vstepMeta['reading']], function($v) {
                return $v !== null;
            });
            if (count($availableScores) > 0) {
                $scorePercentage = round((array_sum($availableScores) / count($availableScores)) * 10, 2);
            }
        }

        return ['error' => null, 'scorePercentage' => $scorePercentage, 'vstepMeta' => $vstepMeta];
    }

    /**
     * Ẩn đáp án đúng và thêm alias cho frontend trước khi trả dữ liệu đề thi.
     */
    private function prepareExamForFrontend(Exam $exam): Exam
    {
        $exam->questions->each(function ($question) {
            $question->qPassage = $question->qPassage_text;
            $question->qSkill   = $question->qSkill ?? $question->qSection;
            $question->answers->each(function ($answer) {
                unset($answer->aIs_correct);
            });
        });

        return $exam;
    }

    /**
     * Chuẩn bị dữ liệu đề thi trả về cho học viên.
     * - VSTEP skill riêng: trả về cấu trúc parts (passage/audio/instruction + câu hỏi theo part)
     * - VSTEP mixed (full 4 kỹ năng): trả về cấu trúc skills -> parts
     * - Đề thường: trả về flat (questions + contentBlocks)
     */
    private function buildExamData($exam): array
    {
        $base = [
            'eId'               => $exam->eId,
            'eTitle'            => $exam->eTitle,
            'eDescription'      => $exam->eDescription,
            'eType'             => $exam->eType,
            'eSkill'            => $exam->eSkill,
            'eDuration_minutes' => $exam->eDuration_minutes,
        ];

        if ($exam->eType !== 'VSTEP') {
            $base['questions']     = $exam->questions->values();
            $base['contentBlocks'] = $exam->contentBlocks->sortBy('display_order')->values();
            return $base;
        }

        $skill = $exam->eSkill ?? 'mixed';

        if ($skill === 'mixed') {
            $base['vstep_structure'] = $this->buildMixedVstepStructure($exam);
        } else {
            $base['vstep_structure'] = $this->buildSkillVstepStructure($exam, $skill);
        }

        return $base;
    }

    /**
     * Cấu trúc VSTEP cho 1 kỹ năng cụ thể (reading/listening/writing/speaking)
     */
    private function buildSkillVstepStructure($exam, string $skill): array
    {
        $contentBlocks = $exam->contentBlocks->sortBy('display_order');
        $questions     = $exam->questions->sortBy(['qPart', 'qOrder', 'qId']);

        $partNumbers = $questions->pluck('qPart')->unique()->sort()->values();
        $parts = [];

        foreach ($partNumbers as $partNum) {
            $partBlock = $contentBlocks->first(function ($cb) use ($partNum) {
                $meta = $cb->metadata ?? [];
                return ($meta['part_number'] ?? null) == $partNum;
            });

            $partQuestions = $questions->where('qPart', $partNum)->values();

            $partData = [
                'partNumber' => $partNum,
                'partName'   => $partBlock ? ($partBlock->metadata['part_name'] ?? "Part $partNum") : "Part $partNum",
            ];

            if ($skill === 'reading') {
                $partData['passage']   = $partBlock ? $partBlock->content : null;
                $partData['wordCount'] = $partBlock ? ($partBlock->metadata['word_count'] ?? null) : null;
            } elseif ($skill === 'listening') {
                $partData['audioUrl']       = $partBlock ? $partBlock->content : null;
                $partData['audioDuration']  = $partBlock ? ($partBlock->metadata['audio_duration'] ?? null) : null;
                $partData['transcript']     = $partBlock ? ($partBlock->metadata['transcript'] ?? null) : null;
            } elseif ($skill === 'speaking') {
                $partData['instruction'] = $partBlock ? $partBlock->content : null;
                $partData['timeLimit']   = $partBlock ? ($partBlock->metadata['time_limit'] ?? null) : null;
            } elseif ($skill === 'writing') {
                $partData['prompt']    = $partBlock ? $partBlock->content : null;
                $partData['wordCount'] = $partBlock ? ($partBlock->metadata['min_words'] ?? null) : null;
            }

            $partData['questions'] = $partQuestions->map(function ($q) {
                return [
                    'qId'       => $q->qId,
                    'qContent'  => $q->qContent,
                    'qType'     => $q->qType,
                    'qPart'     => $q->qPart,
                    'qOrder'    => $q->qOrder,
                    'qPoints'   => $q->qPoints,
                    'qWord_count'  => $q->qWord_count,
                    'qTime_limit'  => $q->qTime_limit,
                    'answers'   => $q->answers->values(),
                ];
            })->values();

            $parts[] = $partData;
        }

        return ['skill' => $skill, 'parts' => $parts];
    }

    /**
     * Cấu trúc VSTEP full mixed (4 kỹ năng), group theo skill rồi parts
     */
    private function buildMixedVstepStructure($exam): array
    {
        $contentBlocks = $exam->contentBlocks->sortBy('display_order');
        $questions     = $exam->questions->sortBy(['qSkillSection', 'qPart', 'qOrder', 'qId']);

        $skillGroups = $questions->groupBy('qSkillSection');
        $skills = [];

        foreach ($skillGroups as $skill => $skillQuestions) {
            $partNumbers = $skillQuestions->pluck('qPart')->unique()->sort()->values();
            $parts = [];

            foreach ($partNumbers as $partNum) {
                $partBlock = $contentBlocks->first(function ($cb) use ($skill, $partNum) {
                    $meta = $cb->metadata ?? [];
                    return ($meta['skill'] ?? null) === $skill
                        && ($meta['part_number'] ?? null) == $partNum;
                });

                $partQuestions = $skillQuestions->where('qPart', $partNum)->values();

                $partData = [
                    'partNumber' => $partNum,
                    'partName'   => $partBlock ? ($partBlock->metadata['part_name'] ?? "Part $partNum") : "Part $partNum",
                    'blockType'  => $partBlock ? $partBlock->block_type : null,
                    'content'    => $partBlock ? $partBlock->content : null,
                    'metadata'   => $partBlock ? $partBlock->metadata : null,
                    'questions'  => $partQuestions->map(function ($q) {
                        return [
                            'qId'      => $q->qId,
                            'qContent' => $q->qContent,
                            'qType'    => $q->qType,
                            'qPart'    => $q->qPart,
                            'qOrder'   => $q->qOrder,
                            'qPoints'  => $q->qPoints,
                            'answers'  => $q->answers->values(),
                        ];
                    })->values(),
                ];

                $parts[] = $partData;
            }

            $skills[$skill] = ['skill' => $skill, 'parts' => $parts];
        }

        return ['skills' => array_values($skills)];
    }

    /* =====================================================================
     * VSTEP DIRECT EXAM (browse → take without assignment)
     * ===================================================================== */

    private const LISTENING_LAYOUT = [
        1 => ['sectionCount' => 1, 'questionsPerSection' => 8,  'questionStart' => 1,  'sectionLabel' => 'Announcements'],
        2 => ['sectionCount' => 3, 'questionsPerSection' => 4,  'questionStart' => 9,  'sectionLabel' => 'Conversation'],
        3 => ['sectionCount' => 3, 'questionsPerSection' => 5,  'questionStart' => 21, 'sectionLabel' => 'Talk'],
    ];

    /**
     * POST /api/student/exams/{examId}/start-direct
     * Tạo submission cho học viên trực tiếp từ exam ID (không cần assignment)
     */
    public function startDirectExam(Request $request, $examId)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'student') {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 401);
        }

        $exam = Exam::where('eId', $examId)
            ->whereIn('eType', ['VSTEP', 'IELTS'])
            ->where(function ($q) {
                $q->whereNull('eIs_private')->orWhere('eIs_private', false);
            })
            ->first();

        if (!$exam) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy đề thi hoặc đề thi chưa công khai.'], 404);
        }

        $totalSeconds = ($exam->eDuration_minutes ?? 179) * 60;

        // ✅ FIX: ALWAYS check for existing in_progress submission first (idempotent)
        // This handles F5/reload, back-forward navigation, and accidental double-start.
        // Makes API safe to call multiple times - will return the same submission.
        // Timer in frontend uses 'started_at' timestamp from backend to calculate elapsed time.
        $existing = Submission::where('exam_id', $examId)
            ->where('user_id', $user->uId)
            ->whereNull('sSubmit_time')
            ->whereIn('sStatus', ['draft', 'in_progress'])
            ->orderByDesc('sId')
            ->first();

        if ($existing && $request->boolean('fresh')) {
            app(\App\Services\ExamAutoSubmitService::class)
                ->autoSubmit($existing, \App\Services\ExamAutoSubmitService::REASON_RESTART);
            $existing = null;
        }

        if ($existing) {
            // Resume existing submission (F5/reload case)
            $startTime = $existing->sStart_time ?? now();
            $elapsed   = max(0, \Carbon\Carbon::parse($startTime)->diffInSeconds(now(), false));
            $remaining = max(0, $totalSeconds - $elapsed);

            if ($remaining <= 0) {
                $result = app(\App\Services\ExamAutoSubmitService::class)
                    ->autoSubmit($existing, \App\Services\ExamAutoSubmitService::REASON_TIMEOUT);

                return response()->json([
                    'status'  => $result['ok'] ? 'finalized' : 'error',
                    'message' => $result['message'] ?? 'Bài thi đã hết thời gian.',
                    'data'    => $result['data'] ?? [
                        'submissionId' => $existing->sId,
                        'sStatus' => $existing->sStatus,
                    ],
                ], $result['ok'] ? 200 : 500);
            }
            
            // ✅ Load saved answers so frontend can restore them after F5
            $savedAnswers = SubmissionAnswer::where('submission_id', $existing->sId)
                ->get()
                ->mapWithKeys(function ($a) {
                    return [$a->question_id => $a->saAnswer_text];
                });
            
            return response()->json([
                'status' => 'success',
                'data'   => [
                    'submissionId'   => $existing->sId,
                    'started_at'     => $startTime,
                    'total_duration' => $totalSeconds,
                    'time_remaining' => $remaining,
                    'savedAnswers'   => $savedAnswers, // ← NEW: return saved answers
                    // backward-compat (phút)
                    'timeRemaining'  => round($remaining / 60),
                ],
            ]);
        }

        // Fresh start: No existing in_progress submission found

        $submission = Submission::create([
            'exam_id'      => $examId,
            'user_id'      => $user->uId,
            'sStart_time'  => now(),
            'sStatus'      => 'in_progress',
            'last_activity_at' => now(),
        ]);

        return response()->json([
            'status' => 'success',
            'data'   => [
                'submissionId'   => $submission->sId,
                'started_at'     => $submission->sStart_time,
                'total_duration' => $totalSeconds,
                'time_remaining' => $totalSeconds,
                // backward-compat (phút)
                'timeRemaining'  => $exam->eDuration_minutes ?? 179,
            ],
        ]);
    }

    /**
     * POST /api/student/exams/{examId}/discard-active-session
     * Kết thúc phiên IELTS/VSTEP đang làm dở để học viên có thể bắt đầu phiên mới.
     */
    public function discardActiveDirectExamSession(Request $request, $examId)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'student') {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 401);
        }

        $exam = Exam::where('eId', $examId)
            ->whereIn('eType', ['VSTEP', 'IELTS'])
            ->first();

        if (!$exam) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy đề thi.'], 404);
        }

        $submission = Submission::where('exam_id', $examId)
            ->where('user_id', $user->uId)
            ->whereNull('sSubmit_time')
            ->whereIn('sStatus', ['draft', 'in_progress'])
            ->orderByDesc('sId')
            ->first();

        if (!$submission) {
            return response()->json([
                'status' => 'success',
                'data' => ['discarded' => false],
                'message' => 'Không có phiên bài làm đang dở.',
            ]);
        }

        $result = app(\App\Services\ExamAutoSubmitService::class)
            ->autoSubmit($submission, \App\Services\ExamAutoSubmitService::REASON_RESTART);

        return response()->json([
            'status' => $result['ok'] ? 'success' : 'error',
            'data' => [
                'discarded' => $result['ok'],
                'submissionId' => $submission->sId,
                'sStatus' => $result['data']['sStatus'] ?? null,
            ],
            'message' => $result['message'] ?? null,
        ], $result['ok'] ? 200 : 500);
    }

    /**
     * GET /api/student/exams/{examId}/vstep/listening
     */
    public function loadVstepListening(Request $request, $examId)
    {
        $user = $request->user();
        if (!$user || !in_array($user->uRole, ['student', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 401);
        }

        $exam = Exam::where('eId', $examId)
            ->where(function ($q) { $q->whereNull('eIs_private')->orWhere('eIs_private', false); })
            ->with(['contentBlocks' => fn($q) => $q->orderBy('display_order'),
                    'questions'     => fn($q) => $q->orderBy('qPart')->orderBy('qSection_order'),
                    'questions.answers'])
            ->first();

        if (!$exam) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy đề thi.'], 404);
        }

        $parts = [];

        // IELTS lưu listening khác VSTEP: mỗi section = 1 ContentBlock (section_number,
        // section_title, instructions, audio_filename) — KHÔNG có part_number/audio_duration.
        // Detect IELTS và build theo cấu trúc 4 section × 10 câu.
        if (in_array(strtoupper($exam->eType ?? ''), ['IELTS'])) {
            return $this->buildIeltsListeningForVstepPage($exam);
        }

        foreach (self::LISTENING_LAYOUT as $partNumber => $layout) {
            $sectionCount = $layout['sectionCount'];
            $qPerSection  = $layout['questionsPerSection'];

            $partBlocks = $exam->contentBlocks->filter(function ($block) use ($partNumber) {
                $meta = $block->metadata ?? [];
                return isset($meta['part_number']) && $meta['part_number'] == $partNumber && isset($meta['audio_duration']);
            })->values();

            $sections = [];
            for ($s = 1; $s <= $sectionCount; $s++) {
                $block = $partBlocks->first(function ($b) use ($s) {
                    return ($b->metadata['section_number'] ?? 1) == $s;
                });

                $qStart = $layout['questionStart'];
                $sectionQuestions = $exam->questions
                    ->where('qSkill', 'listening')
                    ->where('qPart', $partNumber)
                    ->filter(function ($q) use ($s, $qStart, $qPerSection) {
                        $qSec = $q->qData['section_number'] ?? null;
                        if ($qSec !== null) return $qSec == $s;
                        $qNum    = $q->qData['question_number'] ?? $q->qSection_order ?? 0;
                        $relIdx  = max(0, $qNum - $qStart);
                        $computed = intdiv($relIdx, max(1, $qPerSection)) + 1;
                        return $computed == $s;
                    })
                    ->sortBy('qSection_order')
                    ->values();

                // Regenerate audio URL from filename so stored port/host never causes breakage
                $storedAudio = $block->content ?? '';
                $audioFilename = $storedAudio ? basename(parse_url($storedAudio, PHP_URL_PATH)) : '';
                $freshAudioUrl = $audioFilename ? url('files/audio/' . $audioFilename) : '';

                $sections[] = [
                    'sectionNumber'       => $s,
                    'sectionName'         => $block->metadata['section_title'] ?? $block->metadata['section_name'] ?? "{$layout['sectionLabel']} {$s}",
                    'instructions'        => $block->metadata['instructions'] ?? '',
                    'audioUrl'            => $freshAudioUrl,
                    'audioDuration'       => $block->metadata['audio_duration'] ?? 0,
                    'transcript'          => $block->metadata['transcript'] ?? '',
                    'questionStart'       => $qStart + ($s - 1) * $qPerSection,
                    'questionsPerSection' => $qPerSection,
                    'questions'           => $sectionQuestions->map(fn($q) => [
                        'qId'            => $q->qId,
                        'questionNumber' => $q->qData['question_number'] ?? $q->qSection_order,
                        'questionText'   => $q->qContent,
                        'options'        => $q->qData['options'] ?? (function() use ($q) {
                            $sorted = ($q->answers ?? collect())->sortBy(fn($ans) => $ans->aOrder !== null ? $ans->aOrder : $ans->aId)->values();
                            return [
                                'A' => $sorted[0]->aContent ?? '',
                                'B' => $sorted[1]->aContent ?? '',
                                'C' => $sorted[2]->aContent ?? '',
                                'D' => $sorted[3]->aContent ?? '',
                            ];
                        })(),
                    ])->values()->toArray(),
                ];
            }

            $parts[] = [
                'partNumber'          => $partNumber,
                'partName'            => "Part {$partNumber}",
                'sectionCount'        => $sectionCount,
                'questionsPerSection' => $qPerSection,
                'sections'            => $sections,
            ];
        }

        return response()->json(['status' => 'success', 'data' => ['exam_id' => $exam->eId, 'title' => $exam->eTitle, 'parts' => $parts]]);
    }

    /**
     * Build listening parts cho đề IELTS để hiển thị trên trang VSTEP-style player.
     * IELTS: mỗi ContentBlock audio = 1 section (section_number/section_title/instructions/audio_filename).
     */
    private function buildIeltsListeningForVstepPage(Exam $exam)
    {
        $audioBlocks = $exam->contentBlocks
            ->filter(fn($b) => ($b->block_type ?? '') === 'audio')
            ->sortBy(fn($b) => $b->metadata['section_number'] ?? $b->display_order ?? 0)
            ->values();

        $questionsByPart = $exam->questions
            ->where('qSkill', 'listening')
            ->sortBy('qSection_order')
            ->groupBy('qPart');

        $parts = [];
        $partNumbers = $questionsByPart->keys()->sort()->values();

        foreach ($partNumbers as $partNumber) {
            $block = $audioBlocks->first(function ($b) use ($partNumber) {
                return ($b->metadata['section_number'] ?? null) == $partNumber;
            });
            $meta = $block->metadata ?? [];

            $storedAudio = $block->content ?? '';
            $audioFile   = ($storedAudio ? basename(parse_url($storedAudio, PHP_URL_PATH)) : '')
                ?: ($meta['audio_filename'] ?? '');
            $freshAudio  = $audioFile ? url('files/audio/' . $audioFile) : '';

            $sectionQuestions = $questionsByPart->get($partNumber, collect())
                ->sortBy('qSection_order')
                ->values();

            $sectionTitle = ($meta['section_title'] ?? '')
                ?: ($sectionQuestions->first()->qData['section_title'] ?? '')
                ?: "Part {$partNumber}";

            $sections = [[
                'sectionNumber' => (int) $partNumber,
                'sectionName'   => $sectionTitle,
                'instructions'  => $meta['instructions'] ?? '',
                'audioUrl'      => $freshAudio,
                'audioDuration' => $meta['audio_duration'] ?? 0,
                'transcript'    => $meta['transcript'] ?? '',
                'questions'     => $sectionQuestions->map(fn($q) => [
                    'qId'             => $q->qId,
                    'questionNumber'  => $q->qData['question_number'] ?? $q->qSection_order,
                    'questionText'    => $q->qContent,
                    'taskTitle'       => $q->qData['task_title'] ?? null,
                    'taskInstruction' => $q->qData['task_instruction'] ?? null,
                    'options'         => $q->qData['options'] ?? (function () use ($q) {
                        $sorted = ($q->answers ?? collect())->sortBy(fn($a) => $a->aOrder !== null ? $a->aOrder : $a->aId)->values();
                        return [
                            'A' => $sorted[0]->aContent ?? '',
                            'B' => $sorted[1]->aContent ?? '',
                            'C' => $sorted[2]->aContent ?? '',
                            'D' => $sorted[3]->aContent ?? '',
                        ];
                    })(),
                ])->values()->toArray(),
            ]];

            $parts[] = [
                'partNumber'          => (int) $partNumber,
                'partName'            => $sectionTitle,
                'sectionCount'        => 1,
                'questionsPerSection' => $sectionQuestions->count(),
                'sections'            => $sections,
            ];
        }

        return response()->json(['status' => 'success', 'data' => ['exam_id' => $exam->eId, 'title' => $exam->eTitle, 'parts' => $parts]]);
    }

    /**
     * GET /api/student/exams/{examId}/vstep/reading
     */
    public function loadVstepReading(Request $request, $examId)
    {
        $user = $request->user();
        if (!$user || !in_array($user->uRole, ['student', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 401);
        }

        $exam = Exam::where('eId', $examId)
            ->where(function ($q) { $q->whereNull('eIs_private')->orWhere('eIs_private', false); })
            ->with(['contentBlocks' => fn($q) => $q->orderBy('display_order'),
                    'questions'     => fn($q) => $q->orderBy('qPart')->orderBy('qSection_order'),
                    'questions.answers'])
            ->first();

        if (!$exam) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy đề thi.'], 404);
        }

        $parts = [];
        for ($i = 1; $i <= 4; $i++) {
            $partQuestions = $exam->questions->where('qPart', $i)->where('qSkill', 'reading')->values();
            $contentBlock  = $exam->contentBlocks->first(function ($block) use ($i) {
                $metadata = $block->metadata ?? [];
                return isset($metadata['part_number']) && $metadata['part_number'] == $i && isset($metadata['word_count']);
            });

            $parts[] = [
                'partNumber' => $i,
                'partName'   => $contentBlock->metadata['part_name'] ?? "Part $i",
                'passage'    => $contentBlock->content ?? '',
                'wordCount'  => $contentBlock->metadata['word_count'] ?? 0,
                'questions'  => $partQuestions->map(fn($q) => [
                    'qId'            => $q->qId,
                    'questionNumber' => $q->qData['question_number'] ?? $q->qSection_order,
                    'questionText'   => $q->qContent,
                    'options'        => $q->qData['options'] ?? (function() use ($q) {
                        $sorted = ($q->answers ?? collect())->sortBy(fn($ans) => $ans->aOrder !== null ? $ans->aOrder : $ans->aId)->values();
                        return [
                            'A' => $sorted[0]->aContent ?? '',
                            'B' => $sorted[1]->aContent ?? '',
                            'C' => $sorted[2]->aContent ?? '',
                            'D' => $sorted[3]->aContent ?? '',
                        ];
                    })(),
                ])->toArray(),
            ];
        }

        return response()->json(['status' => 'success', 'data' => ['exam_id' => $exam->eId, 'title' => $exam->eTitle, 'parts' => $parts]]);
    }

    /**
     * GET /api/student/exams/{examId}/vstep/writing
     */
    public function loadVstepWriting(Request $request, $examId)
    {
        $user = $request->user();
        if (!$user || !in_array($user->uRole, ['student', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 401);
        }

        $exam = Exam::where('eId', $examId)
            ->where(function ($q) { $q->whereNull('eIs_private')->orWhere('eIs_private', false); })
            ->with(['contentBlocks' => fn($q) => $q->orderBy('display_order'),
                    'questions'     => fn($q) => $q->orderBy('qPart')])
            ->first();

        if (!$exam) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy đề thi.'], 404);
        }

        $tasks = [];
        for ($i = 1; $i <= 2; $i++) {
            $taskQuestion = $exam->questions
                ->filter(fn($q) => $q->qPart == $i && strtolower($q->qSkill ?? $q->qSection ?? '') === 'writing')
                ->first();
            $contentBlock = $exam->contentBlocks->where('metadata.task_number', $i)->first();
            if ($taskQuestion && $contentBlock) {
                $tasks[] = [
                    'taskNumber' => $i,
                    'taskName'   => $contentBlock->metadata['task_name'] ?? "Task $i",
                    'prompt'     => $contentBlock->content ?? '',
                    'wordCount'  => $contentBlock->metadata['word_count'] ?? [150, 250],
                    'timeLimit'  => $contentBlock->metadata['time_limit'] ?? 20,
                    'questionId' => $taskQuestion->qId,
                ];
            }
        }

        return response()->json(['status' => 'success', 'data' => ['exam_id' => $exam->eId, 'title' => $exam->eTitle, 'tasks' => $tasks]]);
    }

    /**
     * GET /api/student/exams/{examId}/vstep/speaking
     */
    public function loadVstepSpeaking(Request $request, $examId)
    {
        $user = $request->user();
        if (!$user || !in_array($user->uRole, ['student', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 401);
        }

        $exam = Exam::where('eId', $examId)
            ->where(function ($q) { $q->whereNull('eIs_private')->orWhere('eIs_private', false); })
            ->with(['contentBlocks' => fn($q) => $q->orderBy('display_order'),
                    'questions'     => fn($q) => $q->where('qSkill', 'speaking')->orderBy('qPart')->orderBy('qSection_order')])
            ->first();

        if (!$exam) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy đề thi.'], 404);
        }

        $parts = [];
        for ($i = 1; $i <= 3; $i++) {
            $contentBlock = $exam->contentBlocks->first(function ($block) use ($i) {
                $metadata = $block->metadata ?? [];
                return isset($metadata['part_number']) && $metadata['part_number'] == $i
                    && (isset($metadata['part1Data']) || isset($metadata['part2Data']) || isset($metadata['part3Data']));
            });

            if (!$contentBlock) {
                $parts[] = ['partNumber' => $i, 'partName' => "Part $i", 'timeLimit' => $i === 1 ? 3 : ($i === 2 ? 4 : 5)];
                continue;
            }

            $partData = [
                'partNumber' => $i,
                'partName'   => $contentBlock->metadata['part_name'] ?? "Part $i",
                'timeLimit'  => $contentBlock->metadata['time_limit'] ?? 3,
            ];

            if (isset($contentBlock->metadata['part1Data']))      $partData['part1Data'] = $contentBlock->metadata['part1Data'];
            elseif (isset($contentBlock->metadata['part2Data']))  $partData['part2Data'] = $contentBlock->metadata['part2Data'];
            elseif (isset($contentBlock->metadata['part3Data']))  $partData['part3Data'] = $contentBlock->metadata['part3Data'];

            $parts[] = $partData;
        }

        return response()->json(['status' => 'success', 'data' => ['exam_id' => $exam->eId, 'title' => $exam->eTitle, 'parts' => $parts]]);
    }

    // ════════════════════════════════════════════════════════════════════
    //  IELTS — Student Loading APIs
    //  Mirror the VSTEP variants but use IELTS structure: 4 sections × 10
    //  for Listening, 3 passages × 13/13/14 for Reading, 2 tasks for
    //  Writing, 3 parts (Part 2 = cue card) for Speaking.
    // ════════════════════════════════════════════════════════════════════

    /**
     * Resolve & load the IELTS exam for a student/teacher viewer.
     * Throws 404 if exam not found, returns the model otherwise.
     *
     * Lưu ý: Teacher có thể xem cả đề private/draft của chính họ
     * (dùng cho preview / xem thử). Student chỉ thấy đề công khai.
     */
    private function findIeltsExamForLoad($examId)
    {
        $user = request()->user();
        // Admin & teacher đều được xem đề private/draft (chỉ xem trước, không thi)
        $isTeacher = $user && in_array($user->uRole, ['teacher', 'admin']);

        $query = Exam::where('eId', $examId)->where('eType', 'IELTS');

        if (!$isTeacher) {
            // Student: chỉ load đề công khai
            $query->where(function ($q) {
                $q->whereNull('eIs_private')->orWhere('eIs_private', false);
            });
        }
        // Teacher: được phép xem cả đề private (kể cả draft) — dùng cho xem thử

        return $query
            ->with([
                'contentBlocks' => fn($q) => $q->orderBy('display_order'),
                'questions'     => fn($q) => $q->orderBy('qPart')->orderBy('qSection_order'),
                'questions.answers',
            ])
            ->first();
    }

    /**
     * GET /api/student/exams/{examId}/ielts/listening
     * Returns 4 sections × 10 questions, each with audio (one play only).
     */
    public function loadIeltsListening(Request $request, $examId)
    {
        $user = $request->user();
        if (!$user || !in_array($user->uRole, ['student', 'teacher', 'admin'])) {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 401);
        }

        $exam = $this->findIeltsExamForLoad($examId);
        if (!$exam) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy đề thi IELTS.'], 404);
        }

        $sections = [];
        $isTeacher = in_array($user->uRole, ['teacher', 'admin']);
        for ($sectionNumber = 1; $sectionNumber <= 4; $sectionNumber++) {
            // Find audio block for this section
            $block = $exam->contentBlocks->first(function ($b) use ($sectionNumber) {
                $meta = $b->metadata ?? [];
                return ($b->block_type === 'audio')
                    && (($meta['section_number'] ?? null) == $sectionNumber);
            });

            $blockMeta = $block ? ($block->metadata ?? []) : [];

            // Regenerate audio URL from real stored URL (not metadata.audio_filename
            // which holds the user's original upload name — file thực trên disk dùng
            // tên hashed do server tạo). Chỉ fallback sang metadata khi block.content rỗng.
            $storedAudio   = $block ? ($block->content ?? '') : '';
            $audioFilename = ($storedAudio ? basename(parse_url($storedAudio, PHP_URL_PATH)) : '')
                ?: ($blockMeta['audio_filename'] ?? '');
            $freshAudioUrl = $audioFilename ? url('files/audio/' . $audioFilename) : '';

            $sectionQuestions = $exam->questions
                ->where('qSkill', 'listening')
                ->where('qPart', $sectionNumber)
                ->sortBy('qSection_order')
                ->values();

            $sections[] = [
                'sectionNumber' => $sectionNumber,
                'sectionName'   => $blockMeta['section_title'] ?? $blockMeta['section_name'] ?? "Section {$sectionNumber}",
                'audioUrl'      => $freshAudioUrl,
                'audioDuration' => $blockMeta['audio_duration'] ?? 0,
                'questionStart' => ($sectionNumber - 1) * 10 + 1,
                'questionsPerSection' => 10,
                'instructions'  => $blockMeta['instructions'] ?? '',
                'context'       => $blockMeta['context'] ?? '',
                'transcript'    => $isTeacher ? ($blockMeta['transcript'] ?? '') : null,
                'questionType'  => $blockMeta['question_type'] ?? 'multiple_choice',
                'questions'     => $sectionQuestions->map(fn($q) => $this->serializeIeltsQuestion($q, $isTeacher))->values()->toArray(),
            ];
        }

        return response()->json([
            'status' => 'success',
            'data'   => [
                'exam_id'      => $exam->eId,
                'title'        => $exam->eTitle,
                'testType'     => $exam->ielts_test_type ?? 'Academic',
                'totalQuestions' => 40,
                'duration'     => $exam->eDuration_minutes ?? 40,
                'sections'     => $sections,
            ],
        ]);
    }

    /**
     * GET /api/student/exams/{examId}/ielts/reading
     * Returns 3 passages × ~13–14 questions (40 total).
     */
    public function loadIeltsReading(Request $request, $examId)
    {
        $user = $request->user();
        if (!$user || !in_array($user->uRole, ['student', 'teacher', 'admin'])) {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 401);
        }

        $exam = $this->findIeltsExamForLoad($examId);
        if (!$exam) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy đề thi IELTS.'], 404);
        }

        $passages = [];
        $isTeacher = in_array($user->uRole, ['teacher', 'admin']);
        $runningQNumber = 1;
        for ($passageNumber = 1; $passageNumber <= 3; $passageNumber++) {
            $block = $exam->contentBlocks->first(function ($b) use ($passageNumber) {
                $meta = $b->metadata ?? [];
                return ($b->block_type === 'passage')
                    && (($meta['part_number'] ?? null) == $passageNumber);
            });

            $passageQuestions = $exam->questions
                ->where('qSkill', 'reading')
                ->where('qPart', $passageNumber)
                ->sortBy('qSection_order')
                ->values();

            $count = $passageQuestions->count();
            $questionStart = $runningQNumber;

            $passages[] = [
                'passageNumber' => $passageNumber,
                'passageName'   => "Passage {$passageNumber}",
                'title'         => $block->metadata['passage_title'] ?? '',
                'body'          => $block->content ?? '',
                'wordCount'     => $block->metadata['word_count'] ?? 0,
                'questionStart' => $questionStart,
                'questionEnd'   => $questionStart + max(0, $count - 1),
                'questions'     => $passageQuestions->map(fn($q) => $this->serializeIeltsQuestion($q, $isTeacher))->values()->toArray(),
            ];

            $runningQNumber += $count;
        }

        return response()->json([
            'status' => 'success',
            'data'   => [
                'exam_id'        => $exam->eId,
                'title'          => $exam->eTitle,
                'testType'       => $exam->ielts_test_type ?? 'Academic',
                'totalQuestions' => 40,
                'duration'       => 60,
                'passages'       => $passages,
            ],
        ]);
    }

    /**
     * GET /api/student/exams/{examId}/ielts/writing
     * Returns 2 tasks (Task 1 + Task 2). Academic Task 1 carries chart image.
     */
    public function loadIeltsWriting(Request $request, $examId)
    {
        $user = $request->user();
        if (!$user || !in_array($user->uRole, ['student', 'teacher', 'admin'])) {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 401);
        }

        $exam = $this->findIeltsExamForLoad($examId);
        if (!$exam) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy đề thi IELTS.'], 404);
        }

        $tasks = [];
        for ($taskNumber = 1; $taskNumber <= 2; $taskNumber++) {
            $block = $exam->contentBlocks->first(function ($b) use ($taskNumber) {
                $meta = $b->metadata ?? [];
                return ($b->block_type === 'instruction')
                    && (($meta['part_number'] ?? null) == $taskNumber)
                    && (isset($meta['image_url']) || isset($meta['tone']) || isset($meta['chart_type']) || isset($meta['essay_type']));
            });
            $question = $exam->questions
                ->where('qSkill', 'writing')
                ->where('qPart', $taskNumber)
                ->first();

            if (!$question) continue;

            $tasks[] = [
                'taskNumber' => $taskNumber,
                'taskName'   => "Task {$taskNumber}",
                'prompt'     => $block->content ?? '',
                'imageUrl'   => $block->metadata['image_url'] ?? null,
                'tone'       => $block->metadata['tone'] ?? null,
                'chartType'  => $block->metadata['chart_type'] ?? null,
                'essayType'  => $block->metadata['essay_type'] ?? null,
                'minWords'   => $taskNumber === 1 ? 150 : 250,
                'recommendedMinutes' => $taskNumber === 1 ? 20 : 40,
                'questionId' => $question->qId,
            ];
        }

        return response()->json([
            'status' => 'success',
            'data'   => [
                'exam_id'  => $exam->eId,
                'title'    => $exam->eTitle,
                'testType' => $exam->ielts_test_type ?? 'Academic',
                'duration' => 60,
                'tasks'    => $tasks,
            ],
        ]);
    }

    /**
     * GET /api/student/exams/{examId}/ielts/speaking
     * Returns 3 parts (Part 1 questions, Part 2 cue card, Part 3 questions).
     */
    public function loadIeltsSpeaking(Request $request, $examId)
    {
        $user = $request->user();
        if (!$user || !in_array($user->uRole, ['student', 'teacher', 'admin'])) {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 401);
        }

        $exam = $this->findIeltsExamForLoad($examId);
        if (!$exam) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy đề thi IELTS.'], 404);
        }

        $parts = [];
        for ($partNumber = 1; $partNumber <= 3; $partNumber++) {
            $block = $exam->contentBlocks->first(function ($b) use ($partNumber) {
                $meta = $b->metadata ?? [];
                return ($b->block_type === 'instruction')
                    && (($meta['part_number'] ?? null) == $partNumber)
                    && (isset($meta['cue_card']) || $partNumber !== 2);
            });

            $partQuestions = $exam->questions
                ->where('qSkill', 'speaking')
                ->where('qPart', $partNumber)
                ->sortBy('qSection_order')
                ->values();

            $partData = [
                'partNumber' => $partNumber,
                'partName'   => "Part {$partNumber}",
                'recommendedMinutes' => $partNumber === 1 ? 5 : ($partNumber === 2 ? 4 : 5),
            ];

            if ($partNumber === 2) {
                $cueCard = $block->metadata['cue_card'] ?? null;
                $partData['cueCard'] = $cueCard ?: [
                    'topic'   => $partQuestions->first()->qContent ?? '',
                    'bullets' => [],
                ];
                $partData['questionId'] = $partQuestions->first()->qId ?? null;
                $partData['prepSeconds'] = 60;  // 1 min prep (IELTS standard)
                $partData['speakSeconds'] = 120; // 1-2 min speak
            } else {
                $partData['questions'] = $partQuestions->map(fn($q) => [
                    'qId'      => $q->qId,
                    'order'    => $q->qSection_order,
                    'topic'    => $q->qData['topic'] ?? null,
                    'text'     => $q->qContent,
                ])->values()->toArray();
            }

            $parts[] = $partData;
        }

        return response()->json([
            'status' => 'success',
            'data'   => [
                'exam_id'  => $exam->eId,
                'title'    => $exam->eTitle,
                'testType' => $exam->ielts_test_type ?? 'Academic',
                'duration' => 14, // upper bound 11-14 min
                'parts'    => $parts,
            ],
        ]);
    }

    /**
     * Serialize a question from DB into shape used by IELTS student UI.
     * Handles MCQ, fill-blank, TFNG/YNNG, completion, matching, etc.
     *
     * @param mixed $q Question model
     * @param bool  $includeAnswer When true (teacher mode), keeps correct_answer in `data`.
     */
    private function serializeIeltsQuestion($q, bool $includeAnswer = false): array
    {
        $qData = $q->qData ?? [];
        $type  = (string) ($q->qType ?? 'multiple_choice');

        // Chỉ MCQ-style mới có options. Các dạng "completion" / "short answer" /
        // "labelling" dùng input text — KHÔNG được build options A/B/C/D từ
        // bảng answers, vì records trong đó là variants đáp án đúng (không phải
        // lựa chọn để chọn). Nếu build sẽ ra dropdown vô nghĩa cho student.
        $mcqTypes = [
            'multiple_choice',
            'multiple_choice_multi',
            'mcq',
            'true_false_not_given',
            'yes_no_not_given',
            'matching',
            'matching_headings',
            'matching_features',
            'matching_information',
            'matching_sentence_endings',
        ];
        $isMcq = in_array($type, $mcqTypes, true);

        // Build MCQ options if available
        $options = $qData['options'] ?? null;

        // Lọc options rác: import cũ hay để {A:null,B:null,C:null,D:null} —
        // toàn giá trị null/rỗng. Coi như KHÔNG có options thật.
        if (is_array($options)) {
            $nonEmpty = array_filter($options, fn($v) => $v !== null && trim((string) $v) !== '');
            $options = count($nonEmpty) > 0 ? $nonEmpty : null;
        }

        if ($isMcq && !$options && $q->relationLoaded('answers')) {
            $sorted = $q->answers->sortBy(fn($a) => $a->aOrder !== null ? $a->aOrder : $a->aId)->values();
            if ($sorted->count() >= 2) {
                $options = [];
                $letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                foreach ($sorted as $idx => $ans) {
                    if (!isset($letters[$idx])) break;
                    $options[$letters[$idx]] = $ans->aContent;
                }
            }
        }
        // Word-bank completion cũng dùng dropdown chọn từ danh sách → giữ options.
        $isWordBank = !empty($qData['use_word_bank']);
        // Đảm bảo: nếu type không phải MCQ và không phải word-bank thì luôn null
        // (kể cả qData lỡ có options sót lại từ import cũ).
        if (!$isMcq && !$isWordBank) {
            $options = null;
        }

        $extraData = $includeAnswer
            ? $qData
            : array_diff_key($qData, ['correct_answer' => 1]);

        return [
            'qId'            => $q->qId,
            'questionNumber' => $qData['question_number'] ?? $q->qSection_order,
            'questionType'   => $type,
            'questionText'   => $q->qContent,
            'options'        => $options,
            'data'           => $extraData,
        ];
    }

    /**
     * POST /api/student/submissions/{submissionId}/speaking/{partNumber}/upload
     * Upload student speaking audio recording for a given part.
     */
    public function uploadSpeakingAudio(Request $request, $submissionId, $partNumber)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'student') {
            return response()->json(['status' => 'error', 'message' => 'Không có quyền truy cập.'], 401);
        }

        $submission = Submission::where('sId', $submissionId)
            ->where('user_id', $user->uId)
            ->first();

        if (!$submission) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy bài làm.'], 404);
        }

        if (!in_array($submission->sStatus, ['in_progress', 'graded', 'auto_submitted'])) {
            return response()->json(['status' => 'error', 'message' => 'Bài làm không ở trạng thái hợp lệ.'], 400);
        }

        $validator = Validator::make($request->all(), [
            'audio' => 'required|file|mimes:webm,ogg,mp4,wav,m4a,aac|max:102400', // 100 MB
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'error', 'message' => 'File âm thanh không hợp lệ.', 'errors' => $validator->errors()], 400);
        }

        $file      = $request->file('audio');
        $ext       = $file->getClientOriginalExtension() ?: 'webm';
        $filename  = "speaking_{$submissionId}_part{$partNumber}." . $ext;
        $path      = $file->storeAs('speaking-recordings', $filename, 'public');
        $publicUrl = \Storage::disk('public')->url($path);

        // Merge audio URL into sGemini_feedback JSON (no schema change needed)
        $feedback = [];
        try { $feedback = json_decode($submission->sGemini_feedback ?? '{}', true) ?: []; } catch (\Exception $e) {}
        $feedback['speaking_audio'][(int) $partNumber] = $publicUrl;
        $submission->update(['sGemini_feedback' => json_encode($feedback)]);

        // Also create/update SubmissionAnswer placeholder row for this speaking question
        $question = Question::where('exam_id', $submission->exam_id)
            ->where(function($query) {
                $query->whereRaw('LOWER(qSkill) = ?', ['speaking'])
                      ->orWhereRaw('LOWER(qSection) = ?', ['speaking']);
            })
            ->where('qPart', (int) $partNumber)
            ->first();
            
        if ($question) {
            SubmissionAnswer::updateOrCreate(
                [
                    'submission_id' => $submission->sId,
                    'question_id' => $question->qId,
                ],
                [
                    'saAnswer_text' => $publicUrl,
                    'saReview_status' => 'pending',
                ]
            );
        }

        return response()->json([
            'status' => 'success',
            'data'   => ['url' => $publicUrl, 'submissionId' => $submissionId, 'partNumber' => $partNumber],
        ]);
    }

    /**
     * POST /api/student/exams/{examId}/checkin-photo
     * Upload exam check-in photo (taken in the pre-exam lobby modal).
     * Stores under storage/public/checkin-photos/{userId}_{examId}.jpg
     */
    public function uploadCheckinPhoto(Request $request, $examId)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'student') {
            return response()->json(['status' => 'error', 'message' => 'Không có quyền truy cập.'], 401);
        }

        $validator = Validator::make($request->all(), [
            'photo' => 'required|file|mimes:jpeg,jpg,png,webp|max:10240',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'error', 'message' => 'File ảnh không hợp lệ.', 'errors' => $validator->errors()], 400);
        }

        $file     = $request->file('photo');
        $ext      = $file->getClientOriginalExtension() ?: 'jpg';
        $filename = "checkin_{$user->uId}_{$examId}_" . time() . ".{$ext}";
        $path     = $file->storeAs('checkin-photos', $filename, 'public');
        $url      = \Storage::disk('public')->url($path);

        return response()->json([
            'status' => 'success',
            'data'   => ['url' => $url, 'examId' => $examId],
        ]);
    }

    /**
     * GET /api/student/exams/browse
     * Duyệt tất cả đề thi VSTEP/IELTS công khai dành cho học viên người lớn
     */
    public function browseExams(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'student') {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 401);
        }

        $type = $request->query('type');
        $skill = $request->query('skill');     // listening|reading|writing|speaking
        $testType = $request->query('test_type'); // Academic | "General Training"

        $query = Exam::withCount('questions')
            ->whereIn('eType', ['VSTEP', 'IELTS'])
            ->where('eStatus', 'published')
            ->where(function ($q) {
                $q->whereNull('age_group')
                  ->orWhereIn('age_group', ['adults', 'all']);
            })
            ->where(function ($q) {
                $q->whereNull('eIs_private')->orWhere('eIs_private', false);
            })
            ->orderBy('eCreated_at', 'desc');

        if ($type && in_array(strtoupper($type), ['VSTEP', 'IELTS'])) {
            $query->where('eType', strtoupper($type));
        }

        if ($skill && in_array(strtolower($skill), ['listening', 'reading', 'writing', 'speaking'])) {
            $skillLower = strtolower($skill);
            $query->where(function ($q) use ($skillLower) {
                $q->where(function ($sub) use ($skillLower) {
                    $sub->where('eType', 'IELTS')->where('ielts_skill', $skillLower);
                })->orWhere(function ($sub) use ($skillLower) {
                    $sub->where('eType', 'VSTEP')->where('eSkill', $skillLower);
                });
            });
        }

        if ($testType && in_array($testType, ['Academic', 'General Training'])) {
            $query->where('ielts_test_type', $testType);
        }

        $exams = $query->get()->map(function ($exam) {
            return [
                'id'              => $exam->eId,
                'title'           => $exam->eTitle,
                'type'            => $exam->eType,
                'skill'           => $exam->eSkill,
                'ielts_skill'     => $exam->ielts_skill,
                'ielts_test_type' => $exam->ielts_test_type,
                'scope'           => $exam->eScope ?: ($exam->eSkill === 'mixed' ? 'full' : 'skill'),
                'part_type'       => $exam->ePart_type,
                'part_number'     => $exam->ePart_number,
                'duration'        => $exam->eDuration_minutes,
                'description'     => $exam->eDescription,
                'age_group'       => $exam->age_group,
                'questions_count' => $exam->questions_count,
                'created_at'      => $exam->eCreated_at,
            ];
        });

        return response()->json(['status' => 'success', 'data' => $exams]);
    }

    /**
     * GET /api/student/exams/browse-kids
     * Duyệt TẤT CẢ đề Cambridge YL (age_group=kids) đã publish — kèm cờ is_assigned
     * và trạng thái bài làm (pending/in_progress/completed) cho từng đề.
     */
    public function browseKidsExams(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'student') {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 401);
        }

        $exams = Exam::withCount('questions')
            ->where('age_group', 'kids')
            ->where('eStatus', 'published')
            ->orderBy('eCreated_at', 'desc')
            ->get();

        if ($exams->isEmpty()) {
            return response()->json(['status' => 'success', 'data' => []]);
        }

        // Assignments của học viên (cá nhân + lớp) → map theo exam_id
        $classIds = $user->class_id ? [$user->class_id] : [];
        $assignments = TestAssignment::where(function ($q) use ($user, $classIds) {
                $q->where(function ($qq) use ($user) {
                    $qq->where('taTarget_type', 'student')->where('taTarget_id', $user->uId);
                })->orWhere(function ($qq) use ($classIds) {
                    $qq->where('taTarget_type', 'class')->whereIn('taTarget_id', $classIds);
                });
            })
            ->orderByDesc('taId')
            ->get()
            ->keyBy('exam_id');

        // Submissions của học viên cho các đề kids → group theo exam_id
        $examIds = $exams->pluck('eId')->all();
        $submissions = Submission::where('user_id', $user->uId)
            ->whereIn('exam_id', $examIds)
            ->orderByDesc('sId')
            ->get()
            ->groupBy('exam_id');

        $data = $exams->map(function ($exam) use ($assignments, $submissions) {
            $assignment = $assignments->get($exam->eId);
            $subs       = $submissions->get($exam->eId, collect());
            $inProgress = $subs->firstWhere('sStatus', 'in_progress');
            $finished   = $subs->first(fn($s) => in_array($s->sStatus, ['submitted', 'graded', 'auto_submitted']));

            if ($inProgress) {
                $subStatus = 'in_progress';
            } elseif ($finished) {
                $subStatus = 'completed';
            } else {
                $subStatus = 'pending';
            }
            $relevant = $inProgress ?? $finished;

            return [
                'id'                => $exam->eId,
                'title'             => $exam->eTitle,
                'type'              => $exam->eType,
                'skill'             => $exam->eSkill,
                'scope'             => $exam->eScope ?: ($exam->eSkill === 'mixed' ? 'full' : 'skill'),
                'part_type'         => $exam->ePart_type,
                'part_number'       => $exam->ePart_number,
                'duration'          => $exam->eDuration_minutes,
                'description'       => $exam->eDescription,
                'age_group'         => $exam->age_group,
                'questions_count'   => $exam->questions_count,
                'created_at'        => $exam->eCreated_at,
                'is_assigned'       => (bool) $assignment,
                'assignment_id'     => $assignment ? $assignment->taId : null,
                'submission_status' => $subStatus,
                'submission_id'     => $relevant ? $relevant->sId : null,
                'score'             => $finished ? (float) $finished->sScore : null,
            ];
        });

        return response()->json(['status' => 'success', 'data' => $data]);
    }

    /**
     * POST /api/student/exams/{examId}/start-kids
     * Bắt đầu (hoặc resume) đề Cambridge YL trực tiếp từ examId — KHÔNG cần assignment.
     * Trả về cùng shape với start(): { submissionId, exam, savedAnswers, timeRemaining }.
     */
    public function startKidsExamDirect(Request $request, $examId)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'student') {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 401);
        }

        $exam = Exam::with(['questions.answers', 'contentBlocks'])
            ->where('eId', $examId)
            ->where('age_group', 'kids')
            ->where('eStatus', 'published')
            ->first();

        if (!$exam) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy bài thi.'], 404);
        }

        $duration = $exam->eDuration_minutes ?? 30;

        // Resume nếu có bài đang làm dở (direct → assignment_id null)
        $existing = Submission::with('answers')
            ->where('user_id', $user->uId)
            ->where('exam_id', $examId)
            ->whereNull('assignment_id')
            ->where('sStatus', 'in_progress')
            ->orderByDesc('sId')
            ->first();

        if ($existing) {
            $timeElapsed   = now()->diffInMinutes($existing->sStart_time);
            $timeRemaining = max(0, $duration - $timeElapsed);
            $submission    = $existing;
            $savedAnswers  = $existing->answers;
        } else {
            $attemptsUsed = Submission::where('user_id', $user->uId)
                ->where('exam_id', $examId)
                ->whereNull('assignment_id')
                ->count();
            $submission = Submission::create([
                'user_id'     => $user->uId,
                'exam_id'     => $exam->eId,
                'sAttempt'    => $attemptsUsed + 1,
                'sStart_time' => now(),
                'sStatus'     => 'in_progress',
                'last_activity_at' => now(),
            ]);
            $timeRemaining = $duration;
            $savedAnswers  = collect();
        }

        $exam = $this->prepareExamForFrontend($exam);

        return response()->json([
            'status' => 'success',
            'data'   => [
                'submissionId'  => $submission->sId,
                'sStart_time'   => $submission->sStart_time,
                'timeRemaining' => $timeRemaining,
                'exam'          => $this->buildExamData($exam),
                'savedAnswers'  => $savedAnswers,
            ],
        ]);
    }

    /**
     * GET /api/student/exams/browse-teens
     * Duyệt TẤT CẢ đề dành cho học viên teens (age_group=teens) đã publish — kèm cờ is_assigned
     * và trạng thái bài làm (pending/in_progress/completed) cho từng đề.
     *
     * Quy ước (theo yêu cầu): giáo viên publish đề teens là học viên teen thấy luôn
     * (không bắt buộc phải "giao" mới hiển thị). Việc "giao riêng" chỉ gắn thêm nhãn.
     */
    public function browseTeensExams(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'student') {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 401);
        }

        $exams = Exam::withCount('questions')
            ->where('age_group', 'teens')
            ->where('eStatus', 'published')
            // Ẩn VSTEP (chỉ dành cho adults) cho chắc chắn
            ->where('eType', '!=', 'VSTEP')
            ->where(function ($q) {
                $q->whereNull('eIs_private')->orWhere('eIs_private', false);
            })
            ->orderBy('eCreated_at', 'desc')
            ->get();

        if ($exams->isEmpty()) {
            return response()->json(['status' => 'success', 'data' => []]);
        }

        // Assignments của học viên (cá nhân + lớp) → map theo exam_id
        $classIds = $user->class_id ? [$user->class_id] : [];
        $assignments = TestAssignment::where(function ($q) use ($user, $classIds) {
                $q->where(function ($qq) use ($user) {
                    $qq->where('taTarget_type', 'student')->where('taTarget_id', $user->uId);
                })->orWhere(function ($qq) use ($classIds) {
                    $qq->where('taTarget_type', 'class')->whereIn('taTarget_id', $classIds);
                });
            })
            ->orderByDesc('taId')
            ->get()
            ->keyBy('exam_id');

        // Submissions của học viên cho các đề này → group theo exam_id
        $examIds = $exams->pluck('eId')->all();
        $submissions = Submission::where('user_id', $user->uId)
            ->whereIn('exam_id', $examIds)
            ->orderByDesc('sId')
            ->get()
            ->groupBy('exam_id');

        $data = $exams->map(function ($exam) use ($assignments, $submissions) {
            $assignment = $assignments->get($exam->eId);
            $subs       = $submissions->get($exam->eId, collect());
            $inProgress = $subs->firstWhere('sStatus', 'in_progress');
            $finished   = $subs->first(fn($s) => in_array($s->sStatus, ['submitted', 'graded', 'auto_submitted']));

            if ($inProgress) {
                $subStatus = 'in_progress';
            } elseif ($finished) {
                $subStatus = 'completed';
            } else {
                $subStatus = 'pending';
            }
            $relevant = $inProgress ?? $finished;

            return [
                'id'                => $exam->eId,
                'title'             => $exam->eTitle,
                'type'              => $exam->eType,
                'skill'             => $exam->eSkill,
                'scope'             => $exam->eScope ?: ($exam->eSkill === 'mixed' ? 'full' : 'skill'),
                'part_type'         => $exam->ePart_type,
                'part_number'       => $exam->ePart_number,
                'duration'          => $exam->eDuration_minutes,
                'description'       => $exam->eDescription,
                'age_group'         => $exam->age_group,
                'questions_count'   => $exam->questions_count,
                'created_at'        => $exam->eCreated_at,
                'is_assigned'       => (bool) $assignment,
                'assignment_id'     => $assignment ? $assignment->taId : null,
                'deadline'          => $assignment ? $assignment->taDeadline : null,
                'submission_status' => $subStatus,
                'submission_id'     => $relevant ? $relevant->sId : null,
                'score'             => $finished ? (float) $finished->sScore : null,
            ];
        });

        return response()->json(['status' => 'success', 'data' => $data]);
    }

    /**
     * POST /api/student/exams/{examId}/start-teens
     * Bắt đầu (hoặc resume) đề teens trực tiếp từ examId — KHÔNG cần assignment.
     * Trả về cùng shape với start(): { submissionId, exam, savedAnswers, timeRemaining }.
     */
    public function startTeensExamDirect(Request $request, $examId)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'student') {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 401);
        }

        $exam = Exam::with(['questions.answers', 'contentBlocks'])
            ->where('eId', $examId)
            ->where('age_group', 'teens')
            ->where('eStatus', 'published')
            ->where('eType', '!=', 'VSTEP')
            ->first();

        if (!$exam) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy bài thi.'], 404);
        }

        $duration = $exam->eDuration_minutes ?? 30;

        // Resume nếu có bài đang làm dở (direct → assignment_id null)
        $existing = Submission::with('answers')
            ->where('user_id', $user->uId)
            ->where('exam_id', $examId)
            ->whereNull('assignment_id')
            ->where('sStatus', 'in_progress')
            ->orderByDesc('sId')
            ->first();

        if ($existing) {
            $timeElapsed   = now()->diffInMinutes($existing->sStart_time);
            $timeRemaining = max(0, $duration - $timeElapsed);
            $submission    = $existing;
            $savedAnswers  = $existing->answers;
        } else {
            $attemptsUsed = Submission::where('user_id', $user->uId)
                ->where('exam_id', $examId)
                ->whereNull('assignment_id')
                ->count();
            $submission = Submission::create([
                'user_id'     => $user->uId,
                'exam_id'     => $exam->eId,
                'sAttempt'    => $attemptsUsed + 1,
                'sStart_time' => now(),
                'sStatus'     => 'in_progress',
                'last_activity_at' => now(),
            ]);
            $timeRemaining = $duration;
            $savedAnswers  = collect();
        }

        $exam = $this->prepareExamForFrontend($exam);

        return response()->json([
            'status' => 'success',
            'data'   => [
                'submissionId'  => $submission->sId,
                'sStart_time'   => $submission->sStart_time,
                'timeRemaining' => $timeRemaining,
                'exam'          => $this->buildExamData($exam),
                'savedAnswers'  => $savedAnswers,
            ],
        ]);
    }
}

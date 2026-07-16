<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Models\TestAssignment;
use App\Models\Exam;
use App\Models\Classes;
use App\Models\User;
use App\Services\PushNotificationService;

class TestAssignmentController extends Controller
{
    /**
     * GET /api/teacher/classes/{id}/assignments
     * Liệt kê các bài đã giao cho một lớp + số bài đã nộp.
     */
    public function byClass(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || !in_array($user->uRole, ['teacher', 'admin'])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $assignments = TestAssignment::with('exam')
            ->where('taTarget_type', 'class')
            ->where('taTarget_id', $id)
            ->orderByDesc('taCreated_at')
            ->get()
            ->map(function ($a) {
                return [
                    'taId'             => $a->taId,
                    'exam_id'          => $a->exam_id,
                    'exam_title'       => $a->exam->eTitle ?? null,
                    'taDeadline'       => $a->taDeadline,
                    'taStart_time'     => $a->taStart_time,
                    'taInstructions'   => $a->taInstructions,
                    'submission_count' => \App\Models\Submission::where('assignment_id', $a->taId)
                        ->whereIn('sStatus', ['submitted', 'graded'])
                        ->distinct('user_id')->count('user_id'),
                ];
            });

        return response()->json([
            'status' => 'success',
            'data'   => $assignments,
        ]);
    }

    /**
     * @OA\Post(
     *     path="/teacher/exams/{examId}/assign",
     *     tags={"Assignments"},
     *     summary="Assign exam to class or student",
     *     description="Assign an exam to a class or individual student",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="examId",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"taTarget_type","taTarget_id","taDeadline"},
     *             @OA\Property(property="taTarget_type", type="string", enum={"class","student"}, example="class"),
     *             @OA\Property(property="taTarget_id", type="integer", example=1),
     *             @OA\Property(property="taDeadline", type="string", format="date-time", example="2026-04-30T23:59:59"),
     *             @OA\Property(property="taMax_attempt", type="integer", example=3),
     *             @OA\Property(property="taInstructions", type="string", example="Complete within time limit")
     *         )
     *     ),
     *     @OA\Response(response=201, description="Exam assigned successfully"),
     *     @OA\Response(response=400, description="Validation error")
     * )
     * 
     * POST /api/teacher/exams/{examId}/assign
     * Gán bài thi cho lớp hoặc học viên
     */
    public function assign(Request $request, $examId)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        // Đề thi là tài sản chung — mọi giáo viên đều giao được, không phân biệt người tạo.
        $exam = Exam::where('eId', $examId)->first();

        if (!$exam) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài thi.'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'taTarget_type' => 'required|in:class,student',
            'taTarget_id' => 'required|integer',
            'age_group' => 'nullable|in:kids,teens,adults',
            'taDeadline' => 'nullable|date',
            'taStart_time' => 'nullable|date',
            'taNotify_before_minutes' => 'nullable|integer|min:0|max:10080',
            'taInstructions' => 'nullable|string|max:2000',
            'taMax_attempt' => 'nullable|integer|min:1',
            'taIs_public' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        // Lấy age_group từ exam (nguồn chính), fallback request. null/'all' = phổ quát.
        $rawAgeGroup = $exam->age_group ?? $request->age_group ?? null;
        $requiredAgeGroup = ($rawAgeGroup && $rawAgeGroup !== 'all') ? $rawAgeGroup : null;

        // Validate target exists + age_group khớp (nếu có)
        if ($request->taTarget_type === 'class') {
            $target = Classes::find($request->taTarget_id);
            if (!$target) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Không tìm thấy lớp học.'
                ], 404);
            }

            $classAgeGroup = $target->age_group ?? null;
            if ($requiredAgeGroup && $classAgeGroup && $classAgeGroup !== 'all' && $classAgeGroup !== $requiredAgeGroup) {
                return response()->json([
                    'status' => 'error',
                    'message' => "Lớp '{$target->cName}' thuộc nhóm '{$classAgeGroup}', không khớp với bài thi (nhóm '{$requiredAgeGroup}')."
                ], 422);
            }
        } else {
            $target = User::where('uId', $request->taTarget_id)
                         ->where('uRole', 'student')
                         ->whereNull('uDeleted_at')
                         ->first();
            if (!$target) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Không tìm thấy học viên.'
                ], 404);
            }

            $studentAgeGroup = $target->age_group ?? null;
            if ($requiredAgeGroup && $studentAgeGroup && $studentAgeGroup !== 'all' && $studentAgeGroup !== $requiredAgeGroup) {
                return response()->json([
                    'status' => 'error',
                    'message' => "Học viên '{$target->uName}' thuộc nhóm '{$studentAgeGroup}', không khớp với bài thi (nhóm '{$requiredAgeGroup}')."
                ], 422);
            }
        }

        $assignment = TestAssignment::create([
            'exam_id' => $examId,
            'taTarget_type' => $request->taTarget_type,
            'taTarget_id' => $request->taTarget_id,
            'taDeadline' => $request->taDeadline,
            'taStart_time' => $request->taStart_time,
            'taNotify_before_minutes' => $request->taNotify_before_minutes,
            'taInstructions' => $request->taInstructions,
            'taMax_attempt' => $request->taMax_attempt ?? 1,
            'taIs_public' => $request->taIs_public ?? false,
            'taCreated_at' => now(),
        ]);

        // Send push notifications to assigned students
        try {
            $pushService = new PushNotificationService();
            $deadlineText = $request->taDeadline
                ? ' · Hạn: ' . \Carbon\Carbon::parse($request->taDeadline)->format('d/m/Y')
                : '';

            if ($request->taTarget_type === 'class') {
                $studentIds = User::where('class_id', $request->taTarget_id)
                    ->where('uRole', 'student')
                    ->whereNull('uDeleted_at')
                    ->pluck('uId')
                    ->toArray();
            } else {
                $studentIds = [$request->taTarget_id];
            }

            $pushService->sendToUsers($studentIds, '📚 Bài tập mới', $exam->eTitle . $deadlineText, [
                'url' => '/hoc-vien/bai-tap',
            ]);
        } catch (\Exception $e) {
            \Log::warning('Push notification failed on assign: ' . $e->getMessage());
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'assignmentId' => $assignment->taId
            ]
        ]);
    }

    /**
     * @OA\Get(
     *     path="/teacher/assignments",
     *     tags={"Assignments"},
     *     summary="Get test assignments",
     *     description="Get list of test assignments with optional filters",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="exam_id",
     *         in="query",
     *         required=false,
     *         @OA\Schema(type="integer"),
     *         description="Filter by exam ID"
     *     ),
     *     @OA\Parameter(
     *         name="target_type",
     *         in="query",
     *         required=false,
     *         @OA\Schema(type="string", enum={"class","student"}),
     *         description="Filter by target type"
     *     ),
     *     @OA\Response(response=200, description="Assignments retrieved successfully"),
     *     @OA\Response(response=401, description="Unauthorized")
     * )
     * 
     * GET /api/teacher/assignments
     * Lấy danh sách phân công bài thi (có filter)
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

        $query = TestAssignment::with(['exam']);

        // Filter by exam_id
        if ($request->has('exam_id')) {
            $query->where('exam_id', $request->exam_id);
        }

        // Filter by target_type
        if ($request->has('target_type')) {
            $query->where('taTarget_type', $request->target_type);
        }

        // Filter by target_id
        if ($request->has('target_id')) {
            $query->where('taTarget_id', $request->target_id);
        }

        $assignments = $query->orderBy('taCreated_at', 'desc')->get();

        // Bổ sung target_name + thống kê hoàn thành cho mỗi assignment.
        $assignments->transform(function ($assignment) {
            $targetStudents = $this->getTargetStudents($assignment);
            $totalStudents = $targetStudents->count();

            $completedCount = \App\Models\Submission::where('assignment_id', $assignment->taId)
                ->whereIn('user_id', $targetStudents->pluck('uId'))
                ->whereIn('sStatus', ['submitted', 'graded'])
                ->distinct('user_id')
                ->count('user_id');

            if ($assignment->taTarget_type === 'class') {
                $cls = Classes::find($assignment->taTarget_id);
                $targetName = $cls->cName ?? ('Lớp #' . $assignment->taTarget_id);
            } else {
                $stu = User::where('uId', $assignment->taTarget_id)->first();
                $targetName = $stu->uName ?? ('Học viên #' . $assignment->taTarget_id);
            }

            $assignment->setAttribute('target_name', $targetName);
            $assignment->setAttribute('total_students', $totalStudents);
            $assignment->setAttribute('completed_students', $completedCount);
            $assignment->setAttribute('completion_rate', $totalStudents > 0
                ? round(($completedCount / $totalStudents) * 100)
                : 0);

            return $assignment;
        });

        return response()->json([
            'status' => 'success',
            'data' => $assignments
        ]);
    }

    /**
     * @OA\Delete(
     *     path="/teacher/assignments/{id}",
     *     tags={"Assignments"},
     *     summary="Delete test assignment",
     *     description="Delete a test assignment",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=200, description="Assignment deleted successfully"),
     *     @OA\Response(response=404, description="Assignment not found")
     * )
     * 
     * DELETE /api/teacher/assignments/{id}
     * Xóa phân công bài thi
     */
    /**
     * Update assignment
     * PUT /api/teacher/assignments/{id}
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $assignment = TestAssignment::where('taId', $id)
                                    ->whereHas('exam', function($q) use ($user) {
                                        $q->whereNotNull('eId'); // Đề dùng chung: mọi GV truy cập được
                                    })
                                    ->first();

        if (!$assignment) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy phân công bài thi.'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'taDeadline' => 'nullable|date|after:now',
            'taInstructions' => 'nullable|string',
            'taMax_attempts' => 'nullable|integer|min:1',
            'taIs_mandatory' => 'nullable|boolean',
            'taShow_results' => 'nullable|boolean',
            'taAllow_review' => 'nullable|boolean',
            'add_students' => 'nullable|array',
            'add_students.*' => 'exists:users,uId',
            'remove_students' => 'nullable|array',
            'remove_students.*' => 'exists:users,uId',
            'add_classes' => 'nullable|array',
            'add_classes.*' => 'exists:classes,cId',
            'remove_classes' => 'nullable|array',
            'remove_classes.*' => 'exists:classes,cId',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        // Update basic fields
        if ($request->has('taDeadline')) {
            $assignment->taDeadline = $request->taDeadline;
        }
        if ($request->has('taInstructions')) {
            $assignment->taInstructions = $request->taInstructions;
        }
        if ($request->has('taMax_attempts')) {
            $assignment->taMax_attempts = $request->taMax_attempts;
        }
        if ($request->has('taIs_mandatory')) {
            $assignment->taIs_mandatory = $request->taIs_mandatory;
        }
        if ($request->has('taShow_results')) {
            $assignment->taShow_results = $request->taShow_results;
        }
        if ($request->has('taAllow_review')) {
            $assignment->taAllow_review = $request->taAllow_review;
        }

        $assignment->save();

        // Handle student additions/removals
        if ($request->has('add_students')) {
            foreach ($request->add_students as $studentId) {
                // Check if already assigned
                $exists = \DB::table('test_assignment_students')
                    ->where('assignment_id', $assignment->taId)
                    ->where('student_id', $studentId)
                    ->exists();
                
                if (!$exists) {
                    \DB::table('test_assignment_students')->insert([
                        'assignment_id' => $assignment->taId,
                        'student_id' => $studentId,
                        'created_at' => now(),
                        'updated_at' => now()
                    ]);
                }
            }
        }

        if ($request->has('remove_students')) {
            \DB::table('test_assignment_students')
                ->where('assignment_id', $assignment->taId)
                ->whereIn('student_id', $request->remove_students)
                ->delete();
        }

        // Handle class additions/removals
        if ($request->has('add_classes')) {
            foreach ($request->add_classes as $classId) {
                $exists = \DB::table('test_assignment_classes')
                    ->where('assignment_id', $assignment->taId)
                    ->where('class_id', $classId)
                    ->exists();
                
                if (!$exists) {
                    \DB::table('test_assignment_classes')->insert([
                        'assignment_id' => $assignment->taId,
                        'class_id' => $classId,
                        'created_at' => now(),
                        'updated_at' => now()
                    ]);
                }
            }
        }

        if ($request->has('remove_classes')) {
            \DB::table('test_assignment_classes')
                ->where('assignment_id', $assignment->taId)
                ->whereIn('class_id', $request->remove_classes)
                ->delete();
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Cập nhật phân công bài thi thành công.',
            'data' => $assignment->load(['exam', 'students', 'classes'])
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $assignment = TestAssignment::where('taId', $id)
                                    ->whereHas('exam', function($q) use ($user) {
                                        $q->whereNotNull('eId'); // Đề dùng chung: mọi GV truy cập được
                                    })
                                    ->first();

        if (!$assignment) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy phân công bài thi.'
            ], 404);
        }

        $assignment->delete();

        return response()->json([
            'status' => 'success',
            'data' => [
                'message' => 'Xóa phân công bài thi thành công'
            ]
        ]);
    }

    /**
     * GET /api/teacher/assignments/{id}/progress
     * Theo dõi tiến độ làm bài của assignment
     */
    /**
     * @OA\Get(
     *     path="/teacher/assignments/{id}/progress",
     *     tags={"Assignments"},
     *     summary="Get assignment progress",
     *     description="Get detailed progress of who completed and who hasn't for an assignment",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=200, description="Assignment progress retrieved successfully"),
     *     @OA\Response(response=404, description="Assignment not found")
     * )
     */
    public function progress(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $assignment = TestAssignment::where('taId', $id)
                                    ->with(['exam'])
                                    ->whereHas('exam', function($q) use ($user) {
                                        $q->whereNotNull('eId'); // Đề dùng chung: mọi GV truy cập được
                                    })
                                    ->first();

        if (!$assignment) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy phân công bài thi.'
            ], 404);
        }

        // Get target students
        $targetStudents = $this->getTargetStudents($assignment);
        
        // Get submissions for this assignment.
        // Sap xep theo sId giam dan de khi hoc vien nop NHIEU LAN, keyBy('user_id')
        // ben duoi giu lai PHIEN MOI NHAT mot cach xac dinh (deterministic) — tranh
        // truong hop diem/trang thai hien ra ngau nhien giua cac lan nop.
        $submissions = \App\Models\Submission::where('assignment_id', $id)
                                            ->with('user')
                                            ->orderByDesc('sId')
                                            ->get();

        // Build progress data
        $completed = [];
        $notCompleted = [];
        // keyBy giu ban ghi DAU TIEN cho moi user_id -> vi da orderByDesc(sId),
        // day chinh la phien nop moi nhat cua hoc vien do.
        $submissionMap = $submissions->keyBy('user_id');

        foreach ($targetStudents as $student) {
            $studentData = [
                'uId' => $student->uId,
                'uName' => $student->uName,
                'uPhone' => $student->uPhone,
            ];

            if (isset($submissionMap[$student->uId])) {
                $submission = $submissionMap[$student->uId];
                $studentData['submission'] = [
                    'sId' => $submission->sId,
                    'sScore' => $submission->sScore,
                    'sStatus' => $submission->sStatus,
                    'sSubmit_time' => $submission->sSubmit_time,
                    'sAttempt' => $submission->sAttempt,
                ];
                $completed[] = $studentData;
            } else {
                $notCompleted[] = $studentData;
            }
        }

        // Calculate statistics
        $totalStudents = count($targetStudents);
        $completedCount = count($completed);
        $completionRate = $totalStudents > 0 ? round(($completedCount / $totalStudents) * 100, 2) : 0;

        // Check deadline status
        $isOverdue = $assignment->taDeadline && now() > $assignment->taDeadline;
        $timeRemaining = $assignment->taDeadline ? $assignment->taDeadline->diffForHumans() : null;

        return response()->json([
            'status' => 'success',
            'data' => [
                'assignment' => [
                    'taId' => $assignment->taId,
                    'exam' => [
                        'eId' => $assignment->exam->eId,
                        'eTitle' => $assignment->exam->eTitle,
                        'eType' => $assignment->exam->eType,
                        'eDuration_minutes' => $assignment->exam->eDuration_minutes,
                    ],
                    'taTarget_type' => $assignment->taTarget_type,
                    'taTarget_id' => $assignment->taTarget_id,
                    'taDeadline' => $assignment->taDeadline,
                    'taMax_attempt' => $assignment->taMax_attempt,
                    'is_overdue' => $isOverdue,
                    'time_remaining' => $timeRemaining,
                ],
                'statistics' => [
                    'total_students' => $totalStudents,
                    'completed_count' => $completedCount,
                    'not_completed_count' => $totalStudents - $completedCount,
                    'completion_rate' => $completionRate,
                ],
                'completed' => $completed,
                'not_completed' => $notCompleted,
            ]
        ]);
    }

    /**
     * POST /api/teacher/assignments/bulk
     * Giao bài hàng loạt cho nhiều lớp/học sinh
     */
    /**
     * @OA\Post(
     *     path="/teacher/assignments/bulk",
     *     tags={"Assignments"},
     *     summary="Bulk assign exam",
     *     description="Assign an exam to multiple classes or students at once",
     *     security={{"bearerAuth":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"exam_id","targets"},
     *             @OA\Property(property="exam_id", type="integer", example=1),
     *             @OA\Property(
     *                 property="targets",
     *                 type="array",
     *                 @OA\Items(
     *                     @OA\Property(property="type", type="string", enum={"class","student"}),
     *                     @OA\Property(property="id", type="integer")
     *                 )
     *             ),
     *             @OA\Property(property="taDeadline", type="string", format="date-time"),
     *             @OA\Property(property="taMax_attempt", type="integer", example=3)
     *         )
     *     ),
     *     @OA\Response(response=201, description="Bulk assignment completed"),
     *     @OA\Response(response=400, description="Validation error")
     * )
     */
    public function bulkAssign(Request $request)
        {
            $user = $request->user();

            if (!$user || $user->uRole !== 'teacher') {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Bạn không có quyền truy cập.'
                ], 401);
            }

            $validator = Validator::make($request->all(), [
                'exam_id'          => 'required|integer',
                'age_group'        => 'nullable|in:kids,teens,adults',
                'targets'          => 'required|array|min:1',
                'targets.*.type'   => 'required|in:class,student',
                'targets.*.id'     => 'required|integer',
                'taDeadline'       => 'nullable|date',
                'taStart_time'     => 'nullable|date',
                'taNotify_before_minutes' => 'nullable|integer|min:0|max:10080',
                'taInstructions'   => 'nullable|string|max:2000',
                'taMax_attempt'    => 'nullable|integer|min:1',
                'taIs_public'      => 'nullable|boolean',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Dữ liệu không hợp lệ.',
                    'errors' => $validator->errors()
                ], 400);
            }

            // Đề thi là tài sản chung — mọi giáo viên đều giao được.
            $exam = Exam::where('eId', $request->exam_id)->first();

            if (!$exam) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Không tìm thấy bài thi.'
                ], 404);
            }

            // Ưu tiên age_group từ exam, fallback request body (legacy).
            // null hoặc 'all' → đề dùng chung mọi nhóm tuổi (không ép age_group).
            $rawAgeGroup = $exam->age_group ?? $request->age_group ?? null;
            $requiredAgeGroup = ($rawAgeGroup && $rawAgeGroup !== 'all') ? $rawAgeGroup : null;

            $results = [
                'success_count' => 0,
                'errors'        => [],
                'assignments'   => [],
            ];

            foreach ($request->targets as $target) {
                try {
                    if ($target['type'] === 'class') {
                        $targetEntity = Classes::find($target['id']);
                        if (!$targetEntity) {
                            $results['errors'][] = "Lớp học ID {$target['id']} không tồn tại.";
                            continue;
                        }

                        // Validate age_group của lớp — chỉ check khi đề có nhóm cụ thể.
                        $classAgeGroup = $targetEntity->age_group ?? null;
                        if ($requiredAgeGroup && $classAgeGroup && $classAgeGroup !== 'all' && $classAgeGroup !== $requiredAgeGroup) {
                            $results['errors'][] = "Lớp '{$targetEntity->cName}' thuộc nhóm '{$classAgeGroup}', không khớp với bài thi (nhóm '{$requiredAgeGroup}').";
                            continue;
                        }

                    } else {
                        $targetEntity = User::where('uId', $target['id'])
                                           ->where('uRole', 'student')
                                           ->whereNull('uDeleted_at')
                                           ->first();
                        if (!$targetEntity) {
                            $results['errors'][] = "Học viên ID {$target['id']} không tồn tại.";
                            continue;
                        }

                        // Validate age_group của học viên — chỉ check khi đề có nhóm cụ thể.
                        $studentAgeGroup = $targetEntity->age_group ?? null;
                        if ($requiredAgeGroup && $studentAgeGroup && $studentAgeGroup !== 'all' && $studentAgeGroup !== $requiredAgeGroup) {
                            $results['errors'][] = "Học viên '{$targetEntity->uName}' thuộc nhóm '{$studentAgeGroup}', không khớp với bài thi (nhóm '{$requiredAgeGroup}').";
                            continue;
                        }
                    }

                    // Check duplicate
                    $existingAssignment = TestAssignment::where('exam_id', $request->exam_id)
                                                       ->where('taTarget_type', $target['type'])
                                                       ->where('taTarget_id', $target['id'])
                                                       ->first();

                    if ($existingAssignment) {
                        $results['errors'][] = "Đã giao bài cho {$target['type']} ID {$target['id']}.";
                        continue;
                    }

                    $assignment = TestAssignment::create([
                        'exam_id'        => $request->exam_id,
                        'taTarget_type'  => $target['type'],
                        'taTarget_id'    => $target['id'],
                        'taDeadline'     => $request->taDeadline,
                        'taStart_time'   => $request->taStart_time,
                        'taNotify_before_minutes' => $request->taNotify_before_minutes,
                        'taInstructions' => $request->taInstructions,
                        'taMax_attempt'  => $request->taMax_attempt ?? 1,
                        'taIs_public'    => $request->taIs_public ?? false,
                        'taCreated_at'   => now(),
                    ]);

                    $results['assignments'][] = [
                        'assignment_id' => $assignment->taId,
                        'target_type'   => $target['type'],
                        'target_id'     => $target['id'],
                        'target_name'   => $target['type'] === 'class' ? $targetEntity->cName : $targetEntity->uName,
                        'age_group'     => $requiredAgeGroup,
                    ];

                    $results['success_count']++;

                } catch (\Exception $e) {
                    $results['errors'][] = "Lỗi khi giao bài cho {$target['type']} ID {$target['id']}: " . $e->getMessage();
                }
            }

            // Gửi push thông báo "bài tập mới" cho học viên thuộc các đối tượng vừa giao.
            try {
                $studentIds = [];
                foreach ($results['assignments'] as $a) {
                    if ($a['target_type'] === 'class') {
                        $ids = User::where('class_id', $a['target_id'])
                            ->where('uRole', 'student')
                            ->whereNull('uDeleted_at')
                            ->pluck('uId')->toArray();
                        $studentIds = array_merge($studentIds, $ids);
                    } else {
                        $studentIds[] = $a['target_id'];
                    }
                }
                $studentIds = array_values(array_unique($studentIds));

                if (!empty($studentIds)) {
                    $deadlineText = $request->taDeadline
                        ? ' · Hạn: ' . \Carbon\Carbon::parse($request->taDeadline)->format('d/m/Y H:i')
                        : '';
                    (new PushNotificationService())->sendToUsers(
                        $studentIds,
                        '📚 Bài tập mới',
                        $exam->eTitle . $deadlineText,
                        ['url' => '/hoc-vien/bai-tap']
                    );
                }
            } catch (\Exception $e) {
                \Log::warning('Push notification failed on bulkAssign: ' . $e->getMessage());
            }

            return response()->json([
                'status'  => 'success',
                'data'    => $results,
                'message' => "Đã giao bài thành công cho {$results['success_count']} đối tượng."
            ], 201);
        }


    /**
     * GET /api/teacher/assignments/{id}/reminders
     * Gửi nhắc nhở deadline
     */
    /**
     * @OA\Post(
     *     path="/teacher/assignments/{id}/reminders",
     *     tags={"Assignments"},
     *     summary="Send deadline reminders",
     *     description="Send deadline reminders to students who haven't completed the assignment",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=200, description="Reminders sent successfully"),
     *     @OA\Response(response=404, description="Assignment not found")
     * )
     */
    public function sendReminders(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $assignment = TestAssignment::where('taId', $id)
                                    ->with(['exam'])
                                    ->whereHas('exam', function($q) use ($user) {
                                        $q->whereNotNull('eId'); // Đề dùng chung: mọi GV truy cập được
                                    })
                                    ->first();

        if (!$assignment) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy phân công bài thi.'
            ], 404);
        }

        $message = $request->input('message');

        // Get students who haven't fully completed (no submission yet OR still in_progress)
        $targetStudents     = $this->getTargetStudents($assignment);
        $finishedStudentIds = \App\Models\Submission::where('assignment_id', $id)
            ->whereIn('sStatus', ['submitted', 'graded'])
            ->pluck('user_id');
        $incompleteStudents = $targetStudents->whereNotIn('uId', $finishedStudentIds);

        $remindersSent = 0;
        $incompleteStudentIds = [];
        foreach ($incompleteStudents as $student) {
            // Refresh the existing active reminder if any, otherwise create new.
            \App\Models\AssignmentReminder::updateOrCreate(
                [
                    'assignment_id' => $assignment->taId,
                    'student_id'    => $student->uId,
                    'dismissed_at'  => null,
                ],
                [
                    'teacher_id' => $user->uId,
                    'message'    => $message,
                    'read_at'    => null,
                    'updated_at' => now(),
                ]
            );
            $incompleteStudentIds[] = $student->uId;
            $remindersSent++;
        }

        // Send push notifications to incomplete students
        if (!empty($incompleteStudentIds)) {
            try {
                $pushService = new PushNotificationService();
                $deadlineText = $assignment->taDeadline
                    ? ' · Hạn: ' . \Carbon\Carbon::parse($assignment->taDeadline)->format('d/m/Y')
                    : '';
                $pushService->sendToUsers(
                    $incompleteStudentIds,
                    '⏰ Nhắc nhở bài tập',
                    $assignment->exam->eTitle . $deadlineText,
                    ['url' => '/hoc-vien/bai-tap']
                );
            } catch (\Exception $e) {
                \Log::warning('Push notification failed on reminder: ' . $e->getMessage());
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Reminders sent successfully',
            'data' => [
                'reminders_sent'   => $remindersSent,
                'assignment_title' => $assignment->exam->eTitle,
                'deadline'         => $assignment->taDeadline,
                'message_text'     => $message,
            ]
        ]);
    }

    /**
     * GET /api/teacher/assignments/statistics
     * Thống kê tổng quan assignments
     */
    /**
     * @OA\Get(
     *     path="/teacher/assignments/statistics",
     *     tags={"Assignments"},
     *     summary="Get assignment statistics",
     *     description="Get overall statistics for teacher's assignments",
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(response=200, description="Statistics retrieved successfully"),
     *     @OA\Response(response=401, description="Unauthorized")
     * )
     */
    public function statistics(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $assignments = TestAssignment::with(['exam'])
                                     ->whereHas('exam', function($q) use ($user) {
                                         $q->whereNotNull('eId'); // Đề dùng chung: mọi GV truy cập được
                                     })
                                     ->orderBy('taCreated_at', 'desc')
                                     ->get();

        $totalAssignments = $assignments->count();
        $classAssignments = $assignments->where('taTarget_type', 'class')->count();
        $studentAssignments = $assignments->where('taTarget_type', 'student')->count();
        $withDeadlines = $assignments->whereNotNull('taDeadline')->count();
        $thisWeekCount = $assignments->filter(function($a) {
            return $a->taCreated_at >= now()->startOfWeek();
        })->count();

        // Build per-assignment submission stats
        $allSubmittedCount = 0;
        $allStudentCount = 0;
        $completionRates = [];
        $assignmentsList = [];
        $ageGroupNotSubmitted = ['kids' => 0, 'teens' => 0, 'adults' => 0];

        foreach ($assignments as $assignment) {
            $targetStudents = $this->getTargetStudents($assignment);
            $studentCount = $targetStudents->count();

            $submissions = \App\Models\Submission::where('assignment_id', $assignment->taId)
                ->whereIn('sStatus', ['submitted', 'graded'])
                ->get();

            $submittedCount = $submissions->count();

            // Track not-submitted per age group
            $submittedIds = $submissions->pluck('user_id')->toArray();
            foreach ($targetStudents as $student) {
                if (!in_array($student->uId, $submittedIds)) {
                    $ag = $student->age_group ?? 'adults';
                    $key = in_array($ag, ['kids', 'teens', 'adults']) ? $ag : 'adults';
                    $ageGroupNotSubmitted[$key]++;
                }
            }
            $completionRate = $studentCount > 0 ? round(($submittedCount / $studentCount) * 100, 1) : 0;
            $avgScore = $submissions->whereNotNull('sScore')->avg('sScore');

            $isOverdue = $assignment->taDeadline && now() > $assignment->taDeadline;

            // Target name
            $targetName = '—';
            if ($assignment->taTarget_type === 'class') {
                $class = \App\Models\Classes::find($assignment->taTarget_id);
                $targetName = $class ? $class->cName : 'Lớp không tìm thấy';
            } else {
                $student = \App\Models\User::find($assignment->taTarget_id);
                $targetName = $student ? $student->uName : 'HS không tìm thấy';
            }

            $allStudentCount += $studentCount;
            $allSubmittedCount += $submittedCount;
            if ($studentCount > 0) {
                $completionRates[] = $completionRate;
            }

            $assignmentsList[] = [
                'id'              => $assignment->taId,
                'exam_title'      => $assignment->exam->eTitle ?? 'Unknown',
                'exam_type'       => $assignment->exam->eType ?? null,
                'target_type'     => $assignment->taTarget_type,
                'target_name'     => $targetName,
                'deadline'        => $assignment->taDeadline ? $assignment->taDeadline->toIso8601String() : null,
                'is_overdue'      => $isOverdue,
                'student_count'   => $studentCount,
                'submitted_count' => $submittedCount,
                'completion_rate' => $completionRate,
                'avg_score'       => $avgScore ? round($avgScore, 2) : null,
                'created_at'      => $assignment->taCreated_at ? $assignment->taCreated_at->toDateString() : null,
            ];
        }

        $avgCompletionRate = count($completionRates) > 0
            ? round(array_sum($completionRates) / count($completionRates), 1)
            : 0;

        $overdueCount = collect($assignmentsList)->where('is_overdue', true)->count();

        // By month (last 6 months)
        $byMonth = [];
        for ($i = 5; $i >= 0; $i--) {
            $month = now()->subMonths($i);
            $label = 'T' . $month->month;
            $count = $assignments->filter(function($a) use ($month) {
                return $a->taCreated_at &&
                       $a->taCreated_at->month == $month->month &&
                       $a->taCreated_at->year == $month->year;
            })->count();
            $byMonth[] = ['month' => $label, 'count' => $count];
        }

        // Submission trends (last 30 days) — daily submission count + rate
        $allAssignmentIds = $assignments->pluck('taId')->toArray();
        $submissionTrends = [];
        for ($i = 29; $i >= 0; $i--) {
            $day = now()->subDays($i);
            $dateStr = $day->toDateString();
            $count = \App\Models\Submission::whereIn('assignment_id', $allAssignmentIds)
                ->whereIn('sStatus', ['submitted', 'graded'])
                ->whereDate('sSubmit_time', $dateStr)
                ->count();
            $submissionTrends[] = [
                'date'  => $day->format('d/m'),
                'count' => $count,
                'rate'  => $allStudentCount > 0 ? round(($count / $allStudentCount) * 100, 1) : 0,
            ];
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'overview' => [
                    'total_assignments'    => $totalAssignments,
                    'avg_completion_rate'  => $avgCompletionRate,
                    'overdue_count'        => $overdueCount,
                    'this_week_count'      => $thisWeekCount,
                    'total_students'       => $allStudentCount,
                    'total_submitted'      => $allSubmittedCount,
                    'class_assignments'    => $classAssignments,
                    'student_assignments'  => $studentAssignments,
                    'with_deadlines'       => $withDeadlines,
                ],
                'by_month'            => $byMonth,
                'submission_trends'   => $submissionTrends,
                'by_target_type'   => [
                    'class'   => $classAssignments,
                    'student' => $studentAssignments,
                ],
                'by_age_group' => [
                    ['name' => 'Kids',   'key' => 'kids',   'not_submitted' => $ageGroupNotSubmitted['kids']],
                    ['name' => 'Teens',  'key' => 'teens',  'not_submitted' => $ageGroupNotSubmitted['teens']],
                    ['name' => 'Adults', 'key' => 'adults', 'not_submitted' => $ageGroupNotSubmitted['adults']],
                ],
                'assignments_list' => $assignmentsList,
            ]
        ]);
    }

    /**
     * Helper method to get target students for an assignment
     */
    private function getTargetStudents($assignment)
    {
        if ($assignment->taTarget_type === 'class') {
            // class_enrollments table was dropped; students now have class_id directly on users table
            return User::where('class_id', $assignment->taTarget_id)
            ->where('uRole', 'student')
            ->whereNull('uDeleted_at')
            ->get();
        } else {
            // Single student
            return User::where('uId', $assignment->taTarget_id)
                      ->where('uRole', 'student')
                      ->whereNull('uDeleted_at')
                      ->get();
        }
    }
}

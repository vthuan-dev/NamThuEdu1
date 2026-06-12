<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use App\Models\Classes;
use App\Models\ClassEnrollment;
use App\Models\ClassTransfer;
use App\Models\ClassAnnouncement;
use App\Models\ClassGoal;
use App\Models\ClassHandoverRequest;
use App\Models\TestAssignment;
use App\Models\Course;
use App\Models\User;
use App\Services\PushNotificationService;

class ClassController extends Controller
{
    /**
     * Helper: lấy lớp thuộc sở hữu của giáo viên hiện tại hoặc trả null.
     * Admin được phép truy cập mọi lớp.
     */
    private function ownedClassOrNull($user, $id)
    {
        $query = Classes::where('cId', $id);
        if ($user->uRole !== 'admin') {
            $query->where('cTeacher_id', $user->uId);
        }
        return $query->first();
    }

    /**
     * Helper: đếm số học viên thực tế của lớp (nguồn chính = users.class_id).
     */
    private function liveStudentCount($classId): int
    {
        return User::where('class_id', $classId)
            ->where('uRole', 'student')
            ->whereNull('uDeleted_at')
            ->count();
    }

    /**
     * @OA\Get(
     *     path="/teacher/classes",
     *     tags={"Classes"},
     *     summary="Get teacher classes",
     *     description="Get list of classes for authenticated teacher with enrollment statistics",
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(
     *         response=200,
     *         description="Classes retrieved successfully"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
     * 
     * GET /api/teacher/classes
     * Lấy danh sách lớp học của teacher với thống kê
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

        $classes = Classes::where('cTeacher_id', $user->uId)
                         ->orderBy('cCreated_at', 'desc')
                         ->get();

        // Lấy danh sách lớp đang có yêu cầu bàn giao chờ xử lý.
        $pendingClassIds = ClassHandoverRequest::where('status', 'pending')
            ->whereIn('class_id', $classes->pluck('cId'))
            ->pluck('class_id')
            ->flip();

        // Add stats for each class
        $classesWithStats = $classes->map(function($class) use ($pendingClassIds) {
            $count = $this->liveStudentCount($class->cId);
            return [
                'cId' => $class->cId,
                'cName' => $class->cName,
                'cDescription' => $class->cDescription,
                'cStatus' => $class->cStatus,
                'age_group' => $class->age_group,
                'max_students' => $class->max_students,
                'current_student_count' => $count,
                'is_full' => $class->max_students ? $count >= $class->max_students : false,
                'has_pending_handover' => $pendingClassIds->has($class->cId),
                'cCreated_at' => $class->cCreated_at,
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => $classesWithStats
        ]);
    }

    /**
     * @OA\Post(
     *     path="/teacher/classes",
     *     tags={"Classes"},
     *     summary="Create new class",
     *     description="Create a new class (teacher only)",
     *     security={{"bearerAuth":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"cName"},
     *             @OA\Property(property="cName", type="string", example="Advanced English Class"),
     *             @OA\Property(property="cDescription", type="string", example="Advanced level English course"),
     *             @OA\Property(property="cStatus", type="string", example="active")
     *         )
     *     ),
     *     @OA\Response(
     *         response=201,
     *         description="Class created successfully"
     *     ),
     *     @OA\Response(
     *         response=400,
     *         description="Validation error"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
     * 
     * POST /api/teacher/classes
     * Tạo lớp học mới
     */
    public function store(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'description' => 'nullable|string|max:1000',
            'age_group' => 'required|in:kids,teens,adults',
            'max_students' => 'required|integer|min:1|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        $class = Classes::create([
            'cName' => $request->name,
            'cTeacher_id' => $user->uId,
            'cDescription' => $request->description,
            'age_group' => $request->age_group,
            'max_students' => $request->max_students,
            'current_student_count' => 0,
            'cStatus' => 'active',
        ]);

        return response()->json([
            'status' => 'success',
            'data' => $class,
            'message' => 'Tạo lớp học thành công.'
        ], 201);
    }

    /**
     * GET /api/teacher/classes/{id}
     * Lấy chi tiết lớp học với danh sách học viên
     */
    /**
     * @OA\Get(
     *     path="/teacher/classes/{id}",
     *     tags={"Classes"},
     *     summary="Get class details",
     *     description="Get detailed information about a specific class including enrolled students",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer"),
     *         example=1
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Class details retrieved successfully"
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Class not found"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
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

        $class = Classes::where('cId', $id)
                       ->where('cTeacher_id', $user->uId)
                       ->first();

        if (!$class) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy lớp học.'
            ], 404);
        }

        // Get students in this class
        $students = User::where('uRole', 'student')
                       ->where('class_id', $id)
                       ->whereNull('uDeleted_at')
                       ->get(['uId', 'uName', 'uPhone', 'uDoB', 'age_group', 'avatar_url']);

        $announcements = ClassAnnouncement::where('class_id', $id)
            ->orderByDesc('is_pinned')
            ->orderByDesc('created_at')
            ->get();

        $goals = ClassGoal::where('class_id', $id)
            ->orderByRaw("FIELD(status,'active','completed','cancelled')")
            ->orderBy('target_date')
            ->get();

        $assignments = TestAssignment::with('exam')
            ->where('taTarget_type', 'class')
            ->where('taTarget_id', $id)
            ->orderByDesc('taCreated_at')
            ->get()
            ->map(function ($a) {
                return [
                    'taId' => $a->taId,
                    'exam_id' => $a->exam_id,
                    'exam_title' => $a->exam->eTitle ?? null,
                    'taDeadline' => $a->taDeadline,
                    'taStart_time' => $a->taStart_time,
                    'submission_count' => \App\Models\Submission::where('assignment_id', $a->taId)
                        ->whereIn('sStatus', ['submitted', 'graded'])
                        ->distinct('user_id')->count('user_id'),
                ];
            });

        $pendingHandover = ClassHandoverRequest::where('class_id', $id)
            ->where('status', 'pending')
            ->first();

        return response()->json([
            'status' => 'success',
            'data' => [
                'class' => $class,
                'students' => $students,
                'student_count' => $students->count(),
                'announcements' => $announcements,
                'goals' => $goals,
                'assignments' => $assignments,
                'pending_handover' => $pendingHandover,
            ]
        ]);
    }

    /**
     * PUT /api/teacher/classes/{id}
     * Cập nhật thông tin lớp học
     */
    /**
     * @OA\Put(
     *     path="/teacher/classes/{id}",
     *     tags={"Classes"},
     *     summary="Update class",
     *     description="Update class information",
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
     *             @OA\Property(property="cName", type="string", example="Advanced English Class"),
     *             @OA\Property(property="cDescription", type="string", example="Advanced level English course"),
     *             @OA\Property(property="cStatus", type="string", enum={"active", "inactive"}, example="active"),
     *             @OA\Property(property="course", type="integer", example=1)
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Class updated successfully"
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Class not found"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
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

        $class = Classes::where('cId', $id)
                       ->where('cTeacher_id', $user->uId)
                       ->first();

        if (!$class) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy lớp học.'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:100',
            'description' => 'nullable|string|max:1000',
            'age_group' => 'sometimes|required|in:kids,teens,adults',
            'max_students' => 'sometimes|required|integer|min:1|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        // R2.4: đổi age_group khi lớp đang có HV khác độ tuổi → chặn.
        if ($request->has('age_group') && $request->age_group !== $class->age_group) {
            $mismatch = User::where('class_id', $id)
                ->where('uRole', 'student')
                ->whereNull('uDeleted_at')
                ->where('age_group', '!=', $request->age_group)
                ->exists();
            if ($mismatch) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Lớp đang có học viên không cùng độ tuổi; vui lòng chuyển học viên trước khi đổi độ tuổi lớp.'
                ], 409);
            }
        }

        // R2.5: max_students không nhỏ hơn sĩ số hiện tại.
        if ($request->has('max_students')) {
            $current = $this->liveStudentCount($id);
            if ($request->max_students < $current) {
                return response()->json([
                    'status' => 'error',
                    'message' => "Sĩ số tối đa không được nhỏ hơn số học viên hiện tại ({$current})."
                ], 409);
            }
        }

        $updateData = [];
        if ($request->has('name')) $updateData['cName'] = $request->name;
        if ($request->has('description')) $updateData['cDescription'] = $request->description;
        if ($request->has('age_group')) $updateData['age_group'] = $request->age_group;
        if ($request->has('max_students')) $updateData['max_students'] = $request->max_students;

        $class->update($updateData);

        return response()->json([
            'status' => 'success',
            'data' => $class,
            'message' => 'Cập nhật lớp học thành công.'
        ]);
    }

    /**
     * DELETE /api/teacher/classes/{id}
     * Xóa lớp học (soft delete)
     */
    /**
     * @OA\Delete(
     *     path="/teacher/classes/{id}",
     *     tags={"Classes"},
     *     summary="Delete class",
     *     description="Delete a class (soft delete)",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Class deleted successfully"
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Class not found"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
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

        $class = Classes::where('cId', $id)
                       ->where('cTeacher_id', $user->uId)
                       ->first();

        if (!$class) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy lớp học.'
            ], 404);
        }

        // R2.8: lớp đang chờ bàn giao → không cho xóa.
        $hasPending = ClassHandoverRequest::where('class_id', $id)
            ->where('status', 'pending')->exists();
        if ($hasPending) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lớp đang chờ bàn giao; không thể xóa.'
            ], 409);
        }

        // R2.7: còn học viên → 409 trừ khi force=true (gỡ hết HV rồi xóa).
        $count = $this->liveStudentCount($id);
        if ($count > 0) {
            if (!$request->boolean('force')) {
                return response()->json([
                    'status' => 'error',
                    'message' => "Lớp còn {$count} học viên; vui lòng chuyển hoặc xóa học viên khỏi lớp trước khi xóa lớp."
                ], 409);
            }
            User::where('class_id', $id)->where('uRole', 'student')->update(['class_id' => null]);
            ClassEnrollment::where('class_id', $id)->delete();
        }

        $class->delete();

        return response()->json([
            'status' => 'success',
            'data' => [
                'message' => 'Xóa lớp học thành công'
            ]
        ]);
    }

    /**
     * POST /api/teacher/classes/{id}/enroll
     * Ghi danh học viên vào lớp (đơn lẻ hoặc hàng loạt)
     */
    /**
     * @OA\Post(
     *     path="/teacher/classes/{id}/enroll",
     *     tags={"Classes"},
     *     summary="Enroll students to class",
     *     description="Enroll multiple students to a class",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer"),
     *         example=1
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"student_ids"},
     *             @OA\Property(
     *                 property="student_ids",
     *                 type="array",
     *                 @OA\Items(type="integer"),
     *                 example={2, 3, 4}
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Students enrolled successfully"
     *     ),
     *     @OA\Response(
     *         response=400,
     *         description="Validation error"
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Class not found"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
     */
    public function enroll(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $class = Classes::where('cId', $id)
                       ->where('cTeacher_id', $user->uId)
                       ->first();

        if (!$class) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy lớp học.'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'student_ids' => 'required|array',
            'student_ids.*' => 'required|integer|exists:users,uId',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        $successCount = 0;
        $errors = [];
        $liveCount = $this->liveStudentCount($id);

        DB::beginTransaction();
        try {
            foreach ($request->student_ids as $studentId) {
                // Check if student exists and has role='student'
                $student = User::where('uId', $studentId)
                              ->where('uRole', 'student')
                              ->whereNull('uDeleted_at')
                              ->first();

                if (!$student) {
                    $errors[] = "Học viên ID {$studentId} không tồn tại hoặc không phải là học viên.";
                    continue;
                }

                // Đã ở trong lớp này rồi.
                if ((int) $student->class_id === (int) $id) {
                    $errors[] = "Học viên {$student->uName} đã ở trong lớp này.";
                    continue;
                }

                // R3.3: độ tuổi phải khớp lớp.
                if ($class->age_group && $student->age_group && $student->age_group !== $class->age_group) {
                    $errors[] = "Học viên {$student->uName} không cùng độ tuổi với lớp.";
                    continue;
                }

                // R3.4: không vượt sĩ số tối đa.
                if ($class->max_students && $liveCount >= $class->max_students) {
                    $errors[] = "Lớp đã đầy ({$class->max_students}).";
                    break;
                }

                // Nguồn chính: users.class_id. Giữ ClassEnrollment để tương thích cũ.
                $student->class_id = $id;
                $student->save();

                if (!ClassEnrollment::where('class_id', $id)->where('student_id', $studentId)->exists()) {
                    ClassEnrollment::create([
                        'class_id' => $id,
                        'student_id' => $studentId,
                    ]);
                }

                $liveCount++;
                $successCount++;
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'data' => [
                    'enrolled_count' => $successCount,
                    'errors' => $errors
                ],
                'message' => "Đã ghi danh {$successCount} học viên thành công."
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi hệ thống khi ghi danh học viên.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /api/teacher/classes/{fromId}/transfer/{toId}
     * Chuyển học viên giữa các lớp
     */
    /**
     * @OA\Post(
     *     path="/teacher/classes/{fromId}/transfer/{toId}",
     *     tags={"Classes"},
     *     summary="Transfer students between classes",
     *     description="Transfer multiple students from one class to another",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="fromId",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer"),
     *         example=1
     *     ),
     *     @OA\Parameter(
     *         name="toId",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer"),
     *         example=2
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"student_ids"},
     *             @OA\Property(
     *                 property="student_ids",
     *                 type="array",
     *                 @OA\Items(type="integer"),
     *                 example={2, 3, 4}
     *             ),
     *             @OA\Property(property="reason", type="string", example="Học viên yêu cầu chuyển lớp"),
     *             @OA\Property(property="notes", type="string", example="Ghi chú thêm về việc chuyển lớp")
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Students transferred successfully"
     *     ),
     *     @OA\Response(
     *         response=400,
     *         description="Validation error"
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Class not found"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
     */
    public function transferStudents(Request $request, $fromId, $toId)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        // Validate classes exist and belong to teacher
        $fromClass = Classes::where('cId', $fromId)
                           ->where('cTeacher_id', $user->uId)
                           ->first();

        $toClass = Classes::where('cId', $toId)
                         ->where('cTeacher_id', $user->uId)
                         ->first();

        if (!$fromClass || !$toClass) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy lớp học hoặc bạn không có quyền truy cập.'
            ], 404);
        }

        if ($fromId == $toId) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không thể chuyển học viên trong cùng một lớp.'
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'student_ids' => 'required|array|min:1',
            'student_ids.*' => 'required|integer|exists:users,uId',
            'reason' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        $successCount = 0;
        $errors = [];

        // Remove transaction to avoid savepoint issues in tests
        try {
            foreach ($request->student_ids as $studentId) {
                // Check if student exists and has role='student'
                $student = User::where('uId', $studentId)
                              ->where('uRole', 'student')
                              ->whereNull('uDeleted_at')
                              ->first();

                if (!$student) {
                    $errors[] = "Học viên ID {$studentId} không tồn tại hoặc không phải là học viên.";
                    continue;
                }

                // Check if student is enrolled in from_class
                $fromEnrollment = ClassEnrollment::where('class_id', $fromId)
                                                ->where('student_id', $studentId)
                                                ->first();

                if (!$fromEnrollment) {
                    $errors[] = "Học viên {$student->uName} không có trong lớp nguồn.";
                    continue;
                }

                // Check if student is already in to_class
                $toEnrollment = ClassEnrollment::where('class_id', $toId)
                                              ->where('student_id', $studentId)
                                              ->exists();

                if ($toEnrollment) {
                    $errors[] = "Học viên {$student->uName} đã có trong lớp đích.";
                    continue;
                }

                // Perform transfer
                // 1. Remove from source class
                ClassEnrollment::where('class_id', $fromId)
                              ->where('student_id', $studentId)
                              ->delete();

                // 2. Add to destination class
                ClassEnrollment::create([
                    'class_id' => $toId,
                    'student_id' => $studentId,
                ]);

                // 3. Log transfer
                ClassTransfer::create([
                    'student_id' => $studentId,
                    'from_class_id' => $fromId,
                    'to_class_id' => $toId,
                    'teacher_id' => $user->uId,
                    'reason' => $request->reason,
                    'notes' => $request->notes,
                    'transferred_at' => now(),
                ]);

                $successCount++;
            }

            return response()->json([
                'status' => 'success',
                'data' => [
                    'transferred_count' => $successCount,
                    'errors' => $errors,
                    'from_class' => $fromClass->cName,
                    'to_class' => $toClass->cName,
                ],
                'message' => "Đã chuyển {$successCount} học viên thành công từ lớp '{$fromClass->cName}' sang lớp '{$toClass->cName}'."
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi hệ thống khi chuyển học viên.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /api/teacher/classes/{id}/transfer-history
     * Xem lịch sử chuyển lớp của một lớp học
     */
    /**
     * @OA\Get(
     *     path="/teacher/classes/{id}/transfer-history",
     *     tags={"Classes"},
     *     summary="Get class transfer history",
     *     description="Get transfer history for a specific class (both incoming and outgoing transfers)",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer"),
     *         example=1
     *     ),
     *     @OA\Parameter(
     *         name="days",
     *         in="query",
     *         required=false,
     *         @OA\Schema(type="integer", default=30),
     *         example=30
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Transfer history retrieved successfully"
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Class not found"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
     */
    public function transferHistory(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $class = Classes::where('cId', $id)
                       ->where('cTeacher_id', $user->uId)
                       ->first();

        if (!$class) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy lớp học.'
            ], 404);
        }

        $days = $request->get('days', 30);

        // Get transfers involving this class
        $transfers = ClassTransfer::with(['student', 'fromClass', 'toClass', 'teacher'])
                                 ->byClass($id)
                                 ->recent($days)
                                 ->orderBy('transferred_at', 'desc')
                                 ->get();

        $transferHistory = $transfers->map(function($transfer) use ($id) {
            return [
                'id' => $transfer->id,
                'student' => [
                    'id' => $transfer->student->uId,
                    'name' => $transfer->student->uName,
                    'email' => $transfer->student->uEmail,
                ],
                'from_class' => [
                    'id' => $transfer->fromClass->cId,
                    'name' => $transfer->fromClass->cName,
                ],
                'to_class' => [
                    'id' => $transfer->toClass->cId,
                    'name' => $transfer->toClass->cName,
                ],
                'teacher' => [
                    'id' => $transfer->teacher->uId,
                    'name' => $transfer->teacher->uName,
                ],
                'reason' => $transfer->reason,
                'notes' => $transfer->notes,
                'transferred_at' => $transfer->transferred_at,
                'direction' => $transfer->from_class_id == $id ? 'outgoing' : 'incoming',
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => [
                'class' => [
                    'id' => $class->cId,
                    'name' => $class->cName,
                ],
                'transfers' => $transferHistory,
                'summary' => [
                    'total_transfers' => $transfers->count(),
                    'incoming' => $transfers->where('to_class_id', $id)->count(),
                    'outgoing' => $transfers->where('from_class_id', $id)->count(),
                    'period_days' => $days,
                ],
            ]
        ]);
    }

    /**
     * DELETE /api/teacher/classes/{id}/students/{studentId}
     * Xóa học viên khỏi lớp
     */
    /**
     * @OA\Delete(
     *     path="/teacher/classes/{id}/students/{studentId}",
     *     tags={"Classes"},
     *     summary="Remove student from class",
     *     description="Remove a student from a class",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer"),
     *         example=1
     *     ),
     *     @OA\Parameter(
     *         name="studentId",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer"),
     *         example=2
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Student removed successfully"
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Class or student not found"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
     */
    public function removeStudent(Request $request, $id, $studentId)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $class = Classes::where('cId', $id)
                       ->where('cTeacher_id', $user->uId)
                       ->first();

        if (!$class) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy lớp học.'
            ], 404);
        }

        $student = User::where('uId', $studentId)->where('uRole', 'student')->first();

        $inClass = $student && (int) $student->class_id === (int) $id;
        $hasEnrollment = ClassEnrollment::where('class_id', $id)
                                   ->where('student_id', $studentId)
                                   ->exists();

        if (!$inClass && !$hasEnrollment) {
            return response()->json([
                'status' => 'error',
                'message' => 'Học viên không có trong lớp này.'
            ], 404);
        }

        if ($inClass) {
            $student->class_id = null;
            $student->save();
        }

        // Delete using composite key
        ClassEnrollment::where('class_id', $id)
                      ->where('student_id', $studentId)
                      ->delete();

        $studentName = $student->uName ?? ('#' . $studentId);

        return response()->json([
            'status' => 'success',
            'data' => [
                'message' => "Đã xóa học viên {$studentName} khỏi lớp {$class->cName}."
            ]
        ]);
    }

    /**
     * GET /api/teacher/classes/statistics
     * Thống kê tổng quan về các lớp học
     */
    /**
     * @OA\Get(
     *     path="/teacher/classes/statistics",
     *     tags={"Classes"},
     *     summary="Get class statistics",
     *     description="Get overall statistics for teacher's classes",
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(
     *         response=200,
     *         description="Statistics retrieved successfully"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
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

        $classes = Classes::where('cTeacher_id', $user->uId)->get();
        
        // Count students by class_id in users table
        $totalStudents = User::where('uRole', 'student')
                            ->whereIn('class_id', $classes->pluck('cId'))
                            ->whereNull('uDeleted_at')
                            ->count();

        $statistics = [
            'total_classes' => $classes->count(),
            'active_classes' => $classes->where('cStatus', 'active')->count(),
            'total_students' => $totalStudents,
            'classes_by_age_group' => [
                'kids' => $classes->where('age_group', 'kids')->count(),
                'teens' => $classes->where('age_group', 'teens')->count(),
                'adults' => $classes->where('age_group', 'adults')->count(),
            ],
            'average_class_size' => $classes->count() > 0 ? round($totalStudents / $classes->count(), 1) : 0,
            'classes' => $classes->map(function($class) {
                return [
                    'id' => $class->cId,
                    'name' => $class->cName,
                    'age_group' => $class->age_group,
                    'current_students' => $class->current_student_count,
                    'max_students' => $class->max_students,
                    'is_full' => $class->is_full,
                ];
            }),
        ];

        return response()->json([
            'status' => 'success',
            'data' => $statistics
        ]);
    }

    /**
     * POST /api/teacher/classes/{id}/handover-request
     * Giáo viên gửi yêu cầu bàn giao lớp lên admin.
     */
    public function requestHandover(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $class = Classes::where('cId', $id)
                       ->where('cTeacher_id', $user->uId)
                       ->first();

        if (!$class) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy lớp học.'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'nullable|string|max:500',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        // R7.2: chỉ một pending mỗi lớp.
        $existing = ClassHandoverRequest::where('class_id', $id)
            ->where('status', 'pending')->exists();
        if ($existing) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lớp này đã có yêu cầu bàn giao đang chờ xử lý.'
            ], 409);
        }

        $req = ClassHandoverRequest::create([
            'class_id'        => $id,
            'from_teacher_id' => $user->uId,
            'status'          => 'pending',
            'reason'          => $request->reason,
        ]);

        // R7.3: thông báo tới tất cả admin (push fire-and-forget).
        try {
            $adminIds = User::where('uRole', 'admin')->whereNull('uDeleted_at')->pluck('uId')->toArray();
            if (!empty($adminIds)) {
                (new PushNotificationService())->sendToUsers(
                    $adminIds,
                    '📦 Yêu cầu bàn giao lớp',
                    "GV {$user->uName} xin bàn giao lớp \"{$class->cName}\".",
                    ['url' => '/admin/ban-giao-lop']
                );
            }
        } catch (\Exception $e) {
            \Log::warning('Handover request push failed: ' . $e->getMessage());
        }

        return response()->json([
            'status' => 'success',
            'data' => $req,
            'message' => 'Đã gửi yêu cầu bàn giao lớp tới quản trị viên.'
        ], 201);
    }

    /**
     * DELETE /api/teacher/classes/{id}/handover-request
     * Giáo viên hủy yêu cầu bàn giao đang chờ của chính mình.
     */
    public function cancelHandover(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $req = ClassHandoverRequest::where('class_id', $id)
            ->where('from_teacher_id', $user->uId)
            ->where('status', 'pending')
            ->first();

        if (!$req) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy yêu cầu bàn giao đang chờ.'
            ], 404);
        }

        $req->status = 'cancelled';
        $req->resolved_at = now();
        $req->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Đã hủy yêu cầu bàn giao.'
        ]);
    }
}

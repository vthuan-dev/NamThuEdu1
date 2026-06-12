<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Models\StudentGoal;
use App\Models\User;
use App\Models\Classes;
use App\Models\ClassCoTeacher;
use App\Services\StudentGoalAnalysisService;

class StudentGoalController extends Controller
{
    /**
     * Giáo viên có quyền quản lý mục tiêu của học viên này không?
     * (Học viên thuộc lớp do GV làm chủ hoặc đồng quản lý; admin: luôn được.)
     */
    private function canManage($user, ?User $student): bool
    {
        if (!$student) return false;
        if ($user->uRole === 'admin') return true;

        $classId = $student->class_id;
        if (!$classId) {
            // Không thuộc lớp nào: cho phép nếu GV là người tạo học viên (nếu có cột).
            return isset($student->uCreated_by) && (int) $student->uCreated_by === (int) $user->uId;
        }
        $class = Classes::where('cId', $classId)->first();
        if (!$class) return false;
        if ((int) $class->cTeacher_id === (int) $user->uId) return true;
        return ClassCoTeacher::teacherCanAccess($classId, $user->uId);
    }

    private function guardTeacher(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array($user->uRole, ['teacher', 'admin'])) {
            return null;
        }
        return $user;
    }

    private function findStudent($studentId): ?User
    {
        return User::where('uId', $studentId)->where('uRole', 'student')->whereNull('uDeleted_at')->first();
    }

    /**
     * GET /teacher/students/{id}/goal
     */
    public function show(Request $request, $id)
    {
        $user = $this->guardTeacher($request);
        if (!$user) return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 403);

        $student = $this->findStudent($id);
        if (!$this->canManage($user, $student)) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy học viên hoặc bạn không quản lý học viên này.'], 404);
        }

        $goal = StudentGoal::where('student_id', $id)->first();
        return response()->json(['status' => 'success', 'data' => $goal]);
    }

    /**
     * PUT /teacher/students/{id}/goal  — đặt/cập nhật mục tiêu.
     */
    public function upsert(Request $request, $id)
    {
        $user = $this->guardTeacher($request);
        if (!$user) return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 403);

        $student = $this->findStudent($id);
        if (!$this->canManage($user, $student)) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy học viên hoặc bạn không quản lý học viên này.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'target_level' => 'required|string|max:50',
            'target_skill' => 'nullable|in:overall,listening,reading,writing,speaking',
            'exam_type'    => 'nullable|string|max:30',
            'target_date'  => 'nullable|date',
            'note'         => 'nullable|string|max:1000',
            'status'       => 'nullable|in:active,achieved,cancelled',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'error', 'message' => 'Dữ liệu không hợp lệ.', 'errors' => $validator->errors()], 400);
        }

        $goal = StudentGoal::updateOrCreate(
            ['student_id' => (int) $id],
            [
                'teacher_id'   => $user->uId,
                'target_level' => $request->target_level,
                'target_skill' => $request->target_skill,
                'exam_type'    => $request->exam_type,
                'target_date'  => $request->target_date,
                'note'         => $request->note,
                'status'       => $request->status ?: 'active',
            ]
        );

        return response()->json(['status' => 'success', 'data' => $goal, 'message' => 'Đã lưu mục tiêu cho học viên.']);
    }

    /**
     * DELETE /teacher/students/{id}/goal
     */
    public function destroy(Request $request, $id)
    {
        $user = $this->guardTeacher($request);
        if (!$user) return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 403);

        $student = $this->findStudent($id);
        if (!$this->canManage($user, $student)) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy học viên hoặc bạn không quản lý học viên này.'], 404);
        }

        StudentGoal::where('student_id', $id)->delete();
        return response()->json(['status' => 'success', 'message' => 'Đã xóa mục tiêu.']);
    }

    /**
     * POST /teacher/students/{id}/goal/analyze — chạy phân tích AI.
     */
    public function analyze(Request $request, $id, StudentGoalAnalysisService $service)
    {
        $user = $this->guardTeacher($request);
        if (!$user) return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 403);

        $student = $this->findStudent($id);
        if (!$this->canManage($user, $student)) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy học viên hoặc bạn không quản lý học viên này.'], 404);
        }

        $goal = StudentGoal::where('student_id', $id)->first();
        if (!$goal) {
            return response()->json(['status' => 'error', 'message' => 'Chưa đặt mục tiêu cho học viên này.'], 400);
        }

        $analysis = $service->analyze($goal);

        return response()->json([
            'status' => 'success',
            'data' => [
                'analysis' => $analysis,
                'analyzed_at' => $goal->ai_analyzed_at,
            ],
            'message' => ($analysis['error'] ?? false) ? 'Phân tích AI tạm thời chưa sẵn sàng.' : 'Đã phân tích tiến độ bằng AI.'
        ]);
    }
}

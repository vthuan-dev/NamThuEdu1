<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Models\Classes;
use App\Models\ClassGoal;
use Carbon\Carbon;

class ClassGoalController extends Controller
{
    private function ownedClassOrNull($user, $classId)
    {
        $query = Classes::where('cId', $classId);
        if ($user->uRole !== 'admin') {
            $query->where('cTeacher_id', $user->uId);
        }
        return $query->first();
    }

    private function guard(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array($user->uRole, ['teacher', 'admin'])) {
            return null;
        }
        return $user;
    }

    /**
     * GET /api/teacher/classes/{classId}/goals
     */
    public function index(Request $request, $classId)
    {
        $user = $this->guard($request);
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 403);
        }

        $class = $this->ownedClassOrNull($user, $classId);
        if (!$class) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy lớp học.'], 404);
        }

        $goals = ClassGoal::where('class_id', $classId)
            ->orderByRaw("FIELD(status,'active','completed','cancelled')")
            ->orderBy('target_date')
            ->get();

        return response()->json(['status' => 'success', 'data' => $goals]);
    }

    /**
     * POST /api/teacher/classes/{classId}/goals
     */
    public function store(Request $request, $classId)
    {
        $user = $this->guard($request);
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 403);
        }

        $class = $this->ownedClassOrNull($user, $classId);
        if (!$class) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy lớp học.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'goal_title'   => 'required|string|max:150',
            'target_date'  => 'required|date',
            'target_level' => 'nullable|string|max:10',
            'description'  => 'nullable|string|max:1000',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        // R6.2: target_date phải ở tương lai.
        if (Carbon::parse($request->target_date)->startOfDay()->lte(Carbon::today())) {
            return response()->json([
                'status' => 'error',
                'message' => 'Ngày mục tiêu phải ở tương lai.'
            ], 400);
        }

        $goal = ClassGoal::create([
            'class_id'     => $classId,
            'teacher_id'   => $user->uId,
            'goal_title'   => $request->goal_title,
            'target_date'  => $request->target_date,
            'target_level' => $request->target_level,
            'description'  => $request->description,
            'status'       => 'active',
        ]);

        return response()->json([
            'status' => 'success',
            'data' => $goal,
            'message' => 'Đã tạo mục tiêu cho lớp.'
        ], 201);
    }

    /**
     * PUT /api/teacher/classes/{classId}/goals/{id}
     */
    public function update(Request $request, $classId, $id)
    {
        $user = $this->guard($request);
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 403);
        }

        $class = $this->ownedClassOrNull($user, $classId);
        if (!$class) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy lớp học.'], 404);
        }

        $goal = ClassGoal::where('id', $id)->where('class_id', $classId)->first();
        if (!$goal) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy mục tiêu.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'goal_title'   => 'sometimes|required|string|max:150',
            'target_date'  => 'sometimes|required|date',
            'target_level' => 'nullable|string|max:10',
            'description'  => 'nullable|string|max:1000',
            'status'       => 'nullable|in:active,completed,cancelled',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        if ($request->has('target_date')
            && Carbon::parse($request->target_date)->startOfDay()->lte(Carbon::today())) {
            return response()->json([
                'status' => 'error',
                'message' => 'Ngày mục tiêu phải ở tương lai.'
            ], 400);
        }

        foreach (['goal_title', 'target_date', 'target_level', 'description', 'status'] as $field) {
            if ($request->has($field)) {
                $goal->{$field} = $request->{$field};
            }
        }
        $goal->save();

        return response()->json([
            'status' => 'success',
            'data' => $goal,
            'message' => 'Đã cập nhật mục tiêu.'
        ]);
    }

    /**
     * DELETE /api/teacher/classes/{classId}/goals/{id}
     */
    public function destroy(Request $request, $classId, $id)
    {
        $user = $this->guard($request);
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 403);
        }

        $class = $this->ownedClassOrNull($user, $classId);
        if (!$class) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy lớp học.'], 404);
        }

        $goal = ClassGoal::where('id', $id)->where('class_id', $classId)->first();
        if (!$goal) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy mục tiêu.'], 404);
        }

        $goal->delete();

        return response()->json(['status' => 'success', 'message' => 'Đã xóa mục tiêu.']);
    }
}

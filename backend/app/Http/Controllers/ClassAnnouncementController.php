<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Models\Classes;
use App\Models\ClassAnnouncement;
use App\Models\User;
use App\Services\PushNotificationService;

class ClassAnnouncementController extends Controller
{
    /**
     * Lấy lớp thuộc sở hữu giáo viên (admin xem được tất cả) hoặc null.
     */
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
     * GET /api/teacher/classes/{classId}/announcements
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

        $announcements = ClassAnnouncement::where('class_id', $classId)
            ->orderByDesc('is_pinned')
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['status' => 'success', 'data' => $announcements]);
    }

    /**
     * POST /api/teacher/classes/{classId}/announcements
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
            'title'     => 'required|string|max:150',
            'content'   => 'required|string|max:2000',
            'priority'  => 'nullable|in:normal,important,urgent',
            'is_pinned' => 'nullable|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        $announcement = ClassAnnouncement::create([
            'class_id'   => $classId,
            'teacher_id' => $user->uId,
            'title'      => $request->title,
            'content'    => $request->content,
            'priority'   => $request->priority ?? 'normal',
            'is_pinned'  => $request->boolean('is_pinned'),
        ]);

        // R5.2: important/urgent → đẩy Web Push cho học viên trong lớp.
        if (in_array($announcement->priority, ['important', 'urgent'])) {
            $this->pushToClassStudents($classId, $announcement);
        }

        return response()->json([
            'status' => 'success',
            'data' => $announcement,
            'message' => 'Đã đăng thông báo.'
        ], 201);
    }

    /**
     * PUT /api/teacher/classes/{classId}/announcements/{id}
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

        $announcement = ClassAnnouncement::where('id', $id)->where('class_id', $classId)->first();
        if (!$announcement) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy thông báo.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'title'     => 'sometimes|required|string|max:150',
            'content'   => 'sometimes|required|string|max:2000',
            'priority'  => 'nullable|in:normal,important,urgent',
            'is_pinned' => 'nullable|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        if ($request->has('title'))     $announcement->title = $request->title;
        if ($request->has('content'))   $announcement->content = $request->content;
        if ($request->has('priority'))  $announcement->priority = $request->priority;
        if ($request->has('is_pinned')) $announcement->is_pinned = $request->boolean('is_pinned');
        $announcement->save();

        return response()->json([
            'status' => 'success',
            'data' => $announcement,
            'message' => 'Đã cập nhật thông báo.'
        ]);
    }

    /**
     * DELETE /api/teacher/classes/{classId}/announcements/{id}
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

        $announcement = ClassAnnouncement::where('id', $id)->where('class_id', $classId)->first();
        if (!$announcement) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy thông báo.'], 404);
        }

        $announcement->delete();

        return response()->json(['status' => 'success', 'message' => 'Đã xóa thông báo.']);
    }

    private function pushToClassStudents($classId, ClassAnnouncement $announcement): void
    {
        try {
            $studentIds = User::where('class_id', $classId)
                ->where('uRole', 'student')
                ->whereNull('uDeleted_at')
                ->pluck('uId')->toArray();
            if (empty($studentIds)) {
                return;
            }
            $icon = $announcement->priority === 'urgent' ? '🚨' : '📢';
            $preview = mb_substr(strip_tags($announcement->content), 0, 120);
            (new PushNotificationService())->sendToUsers(
                $studentIds,
                $icon . ' ' . $announcement->title,
                $preview,
                ['url' => '/hoc-vien/thong-bao']
            );
        } catch (\Exception $e) {
            \Log::warning('Class announcement push failed: ' . $e->getMessage());
        }
    }
}

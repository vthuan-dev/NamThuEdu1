<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use App\Models\Classes;
use App\Models\ClassHandoverRequest;
use App\Models\User;
use App\Services\PushNotificationService;

class AdminHandoverController extends Controller
{
    private function guardAdmin(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'admin') {
            return null;
        }
        return $user;
    }

    /**
     * GET /api/admin/handover-requests?status=
     */
    public function index(Request $request)
    {
        if (!$this->guardAdmin($request)) {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 403);
        }

        $query = ClassHandoverRequest::with(['class', 'fromTeacher', 'receivingTeacher']);
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        // Pending lên đầu, rồi theo thời gian tạo mới nhất.
        $requests = $query->orderByRaw("FIELD(status,'pending','approved','rejected','cancelled')")
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($r) {
                return [
                    'id'         => $r->id,
                    'class_id'   => $r->class_id,
                    'request_type' => $r->request_type ?? 'handover',
                    'class_name' => $r->class->cName ?? ('Lớp #' . $r->class_id),
                    'from_teacher' => [
                        'id'   => $r->from_teacher_id,
                        'name' => $r->fromTeacher->uName ?? null,
                    ],
                    'receiving_teacher' => $r->receiving_teacher_id ? [
                        'id'   => $r->receiving_teacher_id,
                        'name' => $r->receivingTeacher->uName ?? null,
                    ] : null,
                    'reason'     => $r->reason,
                    'admin_note' => $r->admin_note,
                    'status'     => $r->status,
                    'created_at' => $r->created_at,
                    'resolved_at' => $r->resolved_at,
                ];
            });

        return response()->json(['status' => 'success', 'data' => $requests]);
    }

    /**
     * POST /api/admin/handover-requests/{id}/approve
     */
    public function approve(Request $request, $id)
    {
        if (!$this->guardAdmin($request)) {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 403);
        }

        $req = ClassHandoverRequest::find($id);
        if (!$req) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy yêu cầu.'], 404);
        }
        if ($req->status !== 'pending') {
            return response()->json(['status' => 'error', 'message' => 'Yêu cầu này đã được xử lý.'], 409);
        }

        $class = Classes::find($req->class_id);
        if (!$class) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy lớp học.'], 404);
        }

        // ── Yêu cầu XÓA lớp ──────────────────────────────────────
        if (($req->request_type ?? 'handover') === 'deletion') {
            $fromTeacherId = $req->from_teacher_id;
            $className = $class->cName;

            DB::transaction(function () use ($class, $req) {
                // Gỡ học viên khỏi lớp và xóa enrollment trước khi xóa lớp.
                User::where('class_id', $class->cId)->where('uRole', 'student')->update(['class_id' => null]);
                \App\Models\ClassEnrollment::where('class_id', $class->cId)->delete();
                $req->status = 'approved';
                $req->resolved_at = now();
                $req->save();
                $class->delete();
            });

            try {
                (new PushNotificationService())->sendToUser(
                    (int) $fromTeacherId,
                    '🗑️ Yêu cầu xóa lớp đã được duyệt',
                    "Lớp \"{$className}\" đã được xóa.",
                    ['url' => '/giao-vien/lop-hoc']
                );
            } catch (\Exception $e) {
                \Log::warning('Deletion approve push failed: ' . $e->getMessage());
            }

            return response()->json(['status' => 'success', 'message' => "Đã xóa lớp \"{$className}\"."]);
        }

        // ── Yêu cầu BÀN GIAO lớp ─────────────────────────────────
        $validator = Validator::make($request->all(), [
            'receiving_teacher_id' => 'required|integer',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Vui lòng chọn giáo viên tiếp nhận.',
                'errors' => $validator->errors()
            ], 400);
        }

        $receivingId = (int) $request->receiving_teacher_id;
        if ($receivingId === (int) $req->from_teacher_id) {
            return response()->json(['status' => 'error', 'message' => 'Giáo viên tiếp nhận phải khác giáo viên hiện tại.'], 400);
        }

        $receiving = User::where('uId', $receivingId)->where('uRole', 'teacher')->whereNull('uDeleted_at')->first();
        if (!$receiving) {
            return response()->json(['status' => 'error', 'message' => 'Người tiếp nhận phải là giáo viên.'], 400);
        }

        $previousOwnerId = $class->cTeacher_id;

        DB::transaction(function () use ($class, $req, $receivingId) {
            $class->cTeacher_id = $receivingId;
            $class->save();

            $req->status = 'approved';
            $req->receiving_teacher_id = $receivingId;
            $req->resolved_at = now();
            $req->save();
        });

        // Notify cả 2 giáo viên (fire-and-forget).
        try {
            (new PushNotificationService())->sendToUsers(
                array_filter([$previousOwnerId, $receivingId]),
                '📦 Bàn giao lớp đã được duyệt',
                "Lớp \"{$class->cName}\" đã được bàn giao cho GV {$receiving->uName}.",
                ['url' => '/giao-vien/lop-hoc']
            );
        } catch (\Exception $e) {
            \Log::warning('Handover approve push failed: ' . $e->getMessage());
        }

        return response()->json([
            'status' => 'success',
            'message' => "Đã bàn giao lớp cho GV {$receiving->uName}."
        ]);
    }

    /**
     * POST /api/admin/handover-requests/{id}/reject
     */
    public function reject(Request $request, $id)
    {
        if (!$this->guardAdmin($request)) {
            return response()->json(['status' => 'error', 'message' => 'Bạn không có quyền truy cập.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'admin_note' => 'nullable|string|max:500',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        $req = ClassHandoverRequest::find($id);
        if (!$req) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy yêu cầu bàn giao.'], 404);
        }
        if ($req->status !== 'pending') {
            return response()->json(['status' => 'error', 'message' => 'Yêu cầu này đã được xử lý.'], 409);
        }

        $req->status = 'rejected';
        $req->admin_note = $request->admin_note;
        $req->resolved_at = now();
        $req->save();

        // Notify giáo viên gửi.
        try {
            $class = Classes::find($req->class_id);
            (new PushNotificationService())->sendToUser(
                (int) $req->from_teacher_id,
                '📦 Yêu cầu bàn giao bị từ chối',
                "Yêu cầu bàn giao lớp \"" . ($class->cName ?? '') . "\" đã bị từ chối.",
                ['url' => '/giao-vien/lop-hoc']
            );
        } catch (\Exception $e) {
            \Log::warning('Handover reject push failed: ' . $e->getMessage());
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Đã từ chối yêu cầu bàn giao.'
        ]);
    }
}

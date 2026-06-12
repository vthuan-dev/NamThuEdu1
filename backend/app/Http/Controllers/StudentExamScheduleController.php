<?php

namespace App\Http\Controllers;

use App\Models\StudentExamSchedule;
use App\Models\User;
use App\Services\PushNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Lịch thi / lịch trình ôn luyện do giáo viên đặt cho học viên.
 *
 * - Giáo viên: CRUD lịch thi cho từng học viên.
 * - Học viên: xem các lịch thi sắp tới (dùng cho popup nhắc nhở trên dashboard).
 */
class StudentExamScheduleController extends Controller
{
    /* ===================== TEACHER ===================== */

    /**
     * GET /api/teacher/students/{id}/exam-schedules
     * Danh sách lịch thi của một học viên.
     */
    public function index(Request $request, $studentId)
    {
        if (!$this->isTeacher($request)) {
            return $this->forbidden();
        }

        $student = $this->findStudent($studentId);
        if (!$student) {
            return $this->notFound();
        }

        $schedules = StudentExamSchedule::with('teacher:uId,uName')
            ->where('student_id', $studentId)
            ->orderBy('exam_date', 'asc')
            ->get()
            ->map(fn ($s) => $this->transform($s));

        return response()->json([
            'status' => 'success',
            'data'   => $schedules,
        ]);
    }

    /**
     * POST /api/teacher/students/{id}/exam-schedules
     */
    public function store(Request $request, $studentId)
    {
        if (!$this->isTeacher($request)) {
            return $this->forbidden();
        }

        $student = $this->findStudent($studentId);
        if (!$student) {
            return $this->notFound();
        }

        $validator = Validator::make($request->all(), [
            'title'     => 'required|string|max:200',
            'exam_type' => 'nullable|string|max:50',
            'exam_date' => 'required|date',
            'exam_time' => 'nullable|date_format:H:i',
            'location'  => 'nullable|string|max:255',
            'note'      => 'nullable|string|max:2000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $schedule = StudentExamSchedule::create([
            'student_id' => $studentId,
            'teacher_id' => $request->user()->uId,
            'title'      => $request->title,
            'exam_type'  => $request->exam_type,
            'exam_date'  => $request->exam_date,
            'exam_time'  => $request->exam_time,
            'location'   => $request->location,
            'note'       => $request->note,
        ]);

        // Push tới học viên để hiện ngay (nếu đang online); chuông cũng tự cập nhật
        // qua /student/notifications (block lịch thi) khi học viên login / poll.
        try {
            $dateText = \Carbon\Carbon::parse($request->exam_date)->format('d/m/Y')
                . ($request->exam_time ? ' lúc ' . substr($request->exam_time, 0, 5) : '');
            (new PushNotificationService())->sendToUser(
                (int) $studentId,
                '📅 Bạn có lịch thi mới',
                $request->title . ' — ngày thi ' . $dateText,
                ['url' => '/hoc-vien']
            );
        } catch (\Exception $e) {
            \Log::warning('Exam schedule push failed: ' . $e->getMessage());
        }

        return response()->json([
            'status'  => 'success',
            'message' => 'Đã tạo lịch thi cho học viên.',
            'data'    => $this->transform($schedule->load('teacher:uId,uName')),
        ], 201);
    }

    /**
     * PUT /api/teacher/exam-schedules/{id}
     */
    public function update(Request $request, $id)
    {
        if (!$this->isTeacher($request)) {
            return $this->forbidden();
        }

        $schedule = StudentExamSchedule::find($id);
        if (!$schedule) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy lịch thi.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'title'     => 'sometimes|required|string|max:200',
            'exam_type' => 'sometimes|nullable|string|max:50',
            'exam_date' => 'sometimes|required|date',
            'exam_time' => 'sometimes|nullable|date_format:H:i',
            'location'  => 'sometimes|nullable|string|max:255',
            'note'      => 'sometimes|nullable|string|max:2000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $schedule->fill($request->only(['title', 'exam_type', 'exam_date', 'exam_time', 'location', 'note']));
        $schedule->save();

        return response()->json([
            'status'  => 'success',
            'message' => 'Đã cập nhật lịch thi.',
            'data'    => $this->transform($schedule->load('teacher:uId,uName')),
        ]);
    }

    /**
     * DELETE /api/teacher/exam-schedules/{id}
     */
    public function destroy(Request $request, $id)
    {
        if (!$this->isTeacher($request)) {
            return $this->forbidden();
        }

        $schedule = StudentExamSchedule::find($id);
        if (!$schedule) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy lịch thi.'], 404);
        }

        $schedule->delete();

        return response()->json([
            'status'  => 'success',
            'message' => 'Đã xóa lịch thi.',
        ]);
    }

    /* ===================== STUDENT ===================== */

    /**
     * GET /api/student/exam-schedules
     * Các lịch thi sắp tới (từ hôm nay trở đi) của học viên đang đăng nhập.
     */
    public function myUpcoming(Request $request)
    {
        $studentId = $request->user()->uId;

        $schedules = StudentExamSchedule::with('teacher:uId,uName')
            ->where('student_id', $studentId)
            ->whereDate('exam_date', '>=', now()->toDateString())
            ->orderBy('exam_date', 'asc')
            ->get()
            ->map(fn ($s) => $this->transform($s));

        return response()->json([
            'status' => 'success',
            'data'   => [
                'schedules' => $schedules,
                'count'     => $schedules->count(),
            ],
        ]);
    }

    /* ===================== HELPERS ===================== */

    private function isTeacher(Request $request): bool
    {
        $user = $request->user();
        return $user && $user->uRole === 'teacher';
    }

    private function findStudent($id)
    {
        return User::where('uId', $id)
            ->where('uRole', 'student')
            ->whereNull('uDeleted_at')
            ->first();
    }

    private function forbidden()
    {
        return response()->json([
            'status'  => 'error',
            'message' => 'Bạn không có quyền thực hiện hành động này.',
        ], 403);
    }

    private function notFound()
    {
        return response()->json([
            'status'  => 'error',
            'message' => 'Không tìm thấy học viên.',
        ], 404);
    }

    private function transform(StudentExamSchedule $s): array
    {
        $examDate = $s->exam_date ? \Carbon\Carbon::parse($s->exam_date) : null;
        $daysUntil = $examDate ? (int) now()->startOfDay()->diffInDays($examDate->copy()->startOfDay(), false) : null;

        return [
            'id'         => $s->id,
            'student_id' => $s->student_id,
            'title'      => $s->title,
            'exam_type'  => $s->exam_type,
            'exam_date'  => $examDate ? $examDate->toDateString() : null,
            'exam_time'  => $s->exam_time ? substr($s->exam_time, 0, 5) : null,
            'location'   => $s->location,
            'note'       => $s->note,
            'days_until' => $daysUntil,
            'is_urgent'  => $daysUntil !== null && $daysUntil >= 0 && $daysUntil <= 3,
            'teacher_name' => $s->teacher->uName ?? null,
            'created_at' => $s->created_at,
        ];
    }
}

<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use App\Models\AdminSetting;
use App\Models\AdminNotification;
use App\Models\User;

class AdminSystemController extends Controller
{
    /**
     * GET /admin/system/health
     * Trả các chỉ số sức khỏe hệ thống ĐO ĐƯỢC THẬT từ server:
     *  - PHP version, memory usage, disk usage
     *  - DB: kết nối OK + latency (ms) + tổng số bản ghi vài bảng chính
     *  - Driver: cache / queue / session
     *  - Pending queue jobs (nếu dùng database queue)
     */
    public function systemHealth(Request $request)
    {
        // ── Disk ──
        $diskTotal = @disk_total_space(base_path()) ?: 0;
        $diskFree  = @disk_free_space(base_path()) ?: 0;
        $diskUsed  = max(0, $diskTotal - $diskFree);
        $diskPct   = $diskTotal > 0 ? round(($diskUsed / $diskTotal) * 100, 1) : 0;

        // ── Memory (PHP process) ──
        $memUsage = memory_get_usage(true);
        $memPeak  = memory_get_peak_usage(true);
        $memLimitRaw = ini_get('memory_limit');
        $memLimit = $this->parseBytes($memLimitRaw);
        $memPct   = $memLimit > 0 ? round(($memUsage / $memLimit) * 100, 1) : 0;

        // ── Database: ping + latency + counts ──
        $dbOk = false;
        $dbLatency = null;
        $counts = [];
        try {
            $start = microtime(true);
            DB::select('SELECT 1');
            $dbLatency = round((microtime(true) - $start) * 1000, 2); // ms
            $dbOk = true;

            foreach (['users' => 'users', 'exams' => 'exams', 'submissions' => 'submissions'] as $label => $table) {
                try {
                    $counts[$label] = DB::table($table)->count();
                } catch (\Throwable $e) {
                    $counts[$label] = null;
                }
            }
        } catch (\Throwable $e) {
            $dbOk = false;
        }

        // ── Queue: pending jobs (chỉ khi database queue) ──
        $pendingJobs = null;
        try {
            if (config('queue.default') === 'database') {
                $pendingJobs = DB::table('jobs')->count();
            }
        } catch (\Throwable $e) {
            $pendingJobs = null;
        }

        // Trạng thái tổng: healthy nếu DB OK và disk < 90%
        $overall = ($dbOk && $diskPct < 90) ? 'healthy' : ($dbOk ? 'warning' : 'critical');

        return response()->json([
            'status' => 'success',
            'data'   => [
                'overall'   => $overall,
                'timestamp' => now()->toISOString(),
                'app' => [
                    'php_version'  => PHP_VERSION,
                    'laravel'      => app()->version(),
                    'environment'  => config('app.env'),
                    'debug'        => (bool) config('app.debug'),
                ],
                'disk' => [
                    'total_bytes' => $diskTotal,
                    'free_bytes'  => $diskFree,
                    'used_bytes'  => $diskUsed,
                    'used_percent'=> $diskPct,
                ],
                'memory' => [
                    'usage_bytes' => $memUsage,
                    'peak_bytes'  => $memPeak,
                    'limit'       => $memLimitRaw,
                    'used_percent'=> $memPct,
                ],
                'database' => [
                    'connected'  => $dbOk,
                    'latency_ms' => $dbLatency,
                    'counts'     => $counts,
                ],
                'drivers' => [
                    'cache'   => config('cache.default'),
                    'queue'   => config('queue.default'),
                    'session' => config('session.driver'),
                ],
                'queue' => [
                    'pending_jobs' => $pendingJobs,
                ],
            ],
        ]);
    }

    /**
     * Parse "128M" / "1G" / "512K" -> bytes.
     */
    private function parseBytes($val): int
    {
        $val = trim((string) $val);
        if ($val === '' || $val === '-1') {
            return 0; // không giới hạn
        }
        $unit = strtolower($val[strlen($val) - 1]);
        $num  = (int) $val;
        switch ($unit) {
            case 'g': $num *= 1024 * 1024 * 1024; break;
            case 'm': $num *= 1024 * 1024; break;
            case 'k': $num *= 1024; break;
        }
        return $num;
    }

    /**
     * Lấy danh sách cài đặt
     */
    public function getSettings(Request $request)
    {
        $stored = AdminSetting::all()->pluck('value', 'key')->toArray();

        // Map default + kiểu dữ liệu cho từng setting.
        // Khi thêm setting mới: thêm 1 dòng ở đây + 1 dòng trong updateSettings().
        $defaults = [
            'autoRefresh'       => true,
            'refreshInterval'   => 30,
            'emailAlert'        => false,
            'alertEmail'        => '',
            'maintenanceMode'   => false,
            'allowRegistration' => true,
            'maxLoginAttempts'  => 5,
            'examAutoApprove'   => true,  // Mặc định tự động duyệt đề thi
            'blogAutoApprove'   => true,  // Mặc định tự động duyệt bài viết
        ];

        $boolKeys = ['autoRefresh', 'emailAlert', 'maintenanceMode', 'allowRegistration', 'examAutoApprove', 'blogAutoApprove'];
        $intKeys  = ['refreshInterval', 'maxLoginAttempts'];

        $settings = [];
        foreach ($defaults as $key => $default) {
            if (!array_key_exists($key, $stored)) {
                $settings[$key] = $default;
                continue;
            }

            $raw = $stored[$key];
            if (in_array($key, $boolKeys, true)) {
                $settings[$key] = filter_var($raw, FILTER_VALIDATE_BOOLEAN);
            } elseif (in_array($key, $intKeys, true)) {
                $settings[$key] = (int) $raw;
            } else {
                $settings[$key] = (string) $raw;
            }
        }

        return response()->json([
            'status' => 'success',
            'data' => $settings
        ]);
    }

    /**
     * Cập nhật cài đặt admin (whitelist).
     *
     * SECURITY: Trước đây hàm này lấy `$request->except(['_token','_method'])`
     * và ghi BẤT KỲ key/value nào vào bảng `admin_settings` — đây là một dạng
     * mass-assignment: caller có thể trồng các key tuỳ ý (poison cấu hình,
     * gài feature flag, hoặc chèn key mà code khác đọc trong tương lai).
     *
     * Giờ chỉ chấp nhận các key được khai báo tường minh trong $allowedRules,
     * mỗi key có rule validate riêng. Key không nằm trong whitelist sẽ bị
     * loại và trả về trong field `rejected` để FE/dev nhìn thấy.
     *
     * Lưu ý: nội dung pháp lý (legal_vi/legal_en) đi qua endpoint
     * updateLegalContent() riêng, KHÔNG dùng hàm này.
     */
    public function updateSettings(Request $request)
    {
        // Whitelist tường minh: tên key => rule validate.
        // Khi cần thêm setting mới: thêm 1 dòng ở đây + cập nhật getSettings().
        $allowedRules = [
            'autoRefresh'       => 'sometimes|boolean',
            'refreshInterval'   => 'sometimes|integer|min:5|max:600',
            'emailAlert'        => 'sometimes|boolean',
            'alertEmail'        => 'sometimes|nullable|email|max:255',
            'maintenanceMode'   => 'sometimes|boolean',
            'allowRegistration' => 'sometimes|boolean',
            'maxLoginAttempts'  => 'sometimes|integer|min:3|max:20',
            'examAutoApprove'   => 'sometimes|boolean',  // Auto-approve exam toggle
            'blogAutoApprove'   => 'sometimes|boolean',  // Auto-approve blog toggle
        ];

        $allowedKeys = array_keys($allowedRules);
        $rawPayload  = $request->except(['_token', '_method']);

        // Tách phần hợp lệ vs phần bị reject (để báo cho client biết).
        $payload  = array_intersect_key($rawPayload, array_flip($allowedKeys));
        $rejected = array_values(array_diff(array_keys($rawPayload), $allowedKeys));

        $validator = Validator::make($payload, $allowedRules);
        if ($validator->fails()) {
            return response()->json([
                'status'   => 'error',
                'message'  => 'Dữ liệu cài đặt không hợp lệ.',
                'errors'   => $validator->errors(),
                'rejected' => $rejected,
            ], 422);
        }

        if (empty($payload)) {
            return response()->json([
                'status'   => 'error',
                'message'  => 'Không có cài đặt hợp lệ nào được gửi. Các key được hỗ trợ: '
                    . implode(', ', $allowedKeys),
                'rejected' => $rejected,
            ], 422);
        }

        foreach ($payload as $key => $value) {
            AdminSetting::updateOrCreate(
                ['key' => $key],
                ['value' => is_bool($value) ? ($value ? 'true' : 'false') : (string) $value]
            );
        }

        return response()->json([
            'status'   => 'success',
            'message'  => 'Cập nhật cài đặt thành công.',
            'rejected' => $rejected,
        ]);
    }

    /**
     * Lấy nội dung pháp lý (public, không cần auth)
     */
    public function getLegalContent(Request $request)
    {
        $vi = AdminSetting::where('key', 'legal_vi')->value('value');
        $en = AdminSetting::where('key', 'legal_en')->value('value');

        return response()->json([
            'status' => 'success',
            'data' => [
                'legal_vi' => $vi ? json_decode($vi, true) : null,
                'legal_en' => $en ? json_decode($en, true) : null,
            ]
        ]);
    }

    /**
     * Lấy danh sách thông báo admin (có phân trang).
     *
     * Query params:
     *   - page     (int, default 1)
     *   - per_page (int, default 20, clamp 1..100)
     *
     * Backward compatibility: response giữ shape {status, data: [...]} cho
     * client cũ (NotificationDropdown, AdminLayout, AdminNotificationsPage)
     * vốn chỉ unwrap `data` và đọc nguyên array. Client mới có thể đọc thêm
     * `meta.{current_page,last_page,per_page,total}` để hiển thị phân trang.
     *
     * Trước đây hardcode take(50) — không an toàn khi bảng admin_notifications
     * lớn dần (đọc 50 row mỗi lần mở dropdown, không có cách lấy trang sau).
     */
    public function getNotifications(Request $request)
    {
        $perPage = (int) $request->input('per_page', 20);
        if ($perPage < 1) {
            $perPage = 20;
        }
        if ($perPage > 100) {
            $perPage = 100;
        }

        $paginator = AdminNotification::orderBy('created_at', 'desc')
            ->paginate($perPage);

        // Map sang shape UI quen thuộc (giữ nguyên field cũ).
        $mapped = collect($paginator->items())->map(function ($n) {
            return [
                'id'      => $n->id,
                'title'   => $n->title,
                'body'    => $n->body,
                'is_read' => (bool) $n->is_read,
                'time'    => $n->created_at ? $n->created_at->diffForHumans() : 'Vừa xong',
            ];
        });

        return response()->json([
            'status' => 'success',
            'data'   => $mapped,
            'meta'   => [
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
            ],
        ]);
    }

    /**
     * GET /admin/system/recent-activity
     * Trả các sự kiện hoạt động THẬT từ DB (không mock), dùng cho dropdown thông báo realtime:
     *  - submission : học viên nộp bài
     *  - exam       : giáo viên tạo đề mới
     *  - student    : giáo viên tạo học viên mới
     * Mỗi item có timestamp ISO (ts) để client so sánh & phát âm thanh khi có cái mới.
     */
    public function recentActivity(Request $request)
    {
        $limit = (int) $request->input('limit', 8);
        $limit = ($limit > 0 && $limit <= 30) ? $limit : 8;

        $items = [];

        // ── Học viên nộp bài ──
        try {
            $submissions = DB::table('submissions')
                ->whereNotNull('sSubmit_time')
                ->leftJoin('users', 'submissions.user_id', '=', 'users.uId')
                ->leftJoin('exams', 'submissions.exam_id', '=', 'exams.eId')
                ->orderByDesc('submissions.sSubmit_time')
                ->take($limit)
                ->get([
                    'submissions.sId as id',
                    'submissions.sSubmit_time as ts',
                    'users.uName as student_name',
                    'exams.eTitle as exam_title',
                ]);

            foreach ($submissions as $s) {
                $items[] = [
                    'id'    => 'submission-' . $s->id,
                    'type'  => 'submission',
                    'title' => 'Học viên nộp bài',
                    'body'  => trim(($s->student_name ?: 'Học viên') . ' · ' . ($s->exam_title ?: 'Bài thi')),
                    'ts'    => (string) $s->ts,
                    'link'  => '/admin/content/exams',
                ];
            }
        } catch (\Throwable $e) { /* bảng có thể chưa tồn tại */ }

        // ── Giáo viên tạo đề mới ──
        try {
            $exams = DB::table('exams')
                ->leftJoin('users', 'exams.eTeacher_id', '=', 'users.uId')
                ->orderByDesc('exams.eCreated_at')
                ->take($limit)
                ->get([
                    'exams.eId as id',
                    'exams.eTitle as title',
                    'exams.eCreated_at as ts',
                    'users.uName as teacher_name',
                ]);

            foreach ($exams as $e) {
                $items[] = [
                    'id'    => 'exam-' . $e->id,
                    'type'  => 'exam',
                    'title' => 'Đề thi mới',
                    'body'  => trim(($e->title ?: 'Đề thi') . ($e->teacher_name ? ' · GV ' . $e->teacher_name : '')),
                    'ts'    => (string) $e->ts,
                    'link'  => '/admin/content/exams',
                ];
            }
        } catch (\Throwable $e) { /* ignore */ }

        // ── Giáo viên tạo học viên mới ──
        try {
            $students = DB::table('users')
                ->where('uRole', 'student')
                ->whereNull('uDeleted_at')
                ->orderByDesc('uCreated_at')
                ->take($limit)
                ->get([
                    'uId as id',
                    'uName as name',
                    'uPhone as phone',
                    'uCreated_at as ts',
                ]);

            foreach ($students as $st) {
                $items[] = [
                    'id'    => 'student-' . $st->id,
                    'type'  => 'student',
                    'title' => 'Học viên mới',
                    'body'  => trim(($st->name ?: $st->phone ?: 'Học viên') . ($st->phone ? ' · ' . $st->phone : '')),
                    'ts'    => (string) $st->ts,
                    'link'  => '/admin/students',
                ];
            }
        } catch (\Throwable $e) { /* ignore */ }

        // Sắp xếp tất cả theo thời gian giảm dần, cắt lấy $limit
        usort($items, function ($a, $b) {
            return strcmp((string) $b['ts'], (string) $a['ts']);
        });
        $items = array_slice($items, 0, $limit);

        return response()->json([
            'status' => 'success',
            'data'   => $items,
        ]);
    }

    /**
     * Đánh dấu đã đọc
     */
    public function markNotificationRead($id)
    {
        $notification = AdminNotification::find($id);
        if ($notification) {
            $notification->is_read = true;
            $notification->save();
        }
        return response()->json([
            'status' => 'success'
        ]);
    }

    /**
     * GET /admin/profile
     * Lấy thông tin hồ sơ admin hiện tại
     */
    public function getProfile(Request $request)
    {
        $user = $request->user();
        // Dùng `uId` (primaryKey thực) thay vì `$user->id`. Trước đây
        // `$user->id` trả về null vì bảng `users` không có cột `id`.
        // User model có thêm accessor `getIdAttribute()` alias về uId
        // để các caller cũ (vd: routes/channels.php) tiếp tục hoạt động,
        // nhưng ở code mới hãy luôn dùng `uId` cho rõ.
        return response()->json([
            'status' => 'success',
            'data' => [
                'id'         => $user->uId,
                'name'       => $user->uName ?? $user->name ?? 'Administrator',
                'phone'      => $user->uPhone ?? $user->phone ?? '',
                'email'      => $user->uEmail ?? $user->email ?? '',
                'role'       => $user->uRole ?? $user->role ?? 'admin',
                'created_at' => $user->created_at ? $user->created_at->format('d/m/Y') : null,
                'last_login' => $user->last_login ?? null,
            ]
        ]);
    }

    /**
     * PUT /admin/profile
     * Cập nhật tên hiển thị và email
     */
    public function updateProfile(Request $request)
    {
        $request->validate([
            'name'  => 'nullable|string|max:100',
            'email' => 'nullable|email|max:150',
            'phone' => 'nullable|string|max:20',
        ]);

        $user = $request->user();
        if ($request->filled('name')) {
            $user->uName = $request->name;
        }
        if ($request->filled('email')) {
            $user->uEmail = $request->email;
        }
        if ($request->filled('phone')) {
            // Kiểm tra trùng lặp SĐT với tài khoản khác
            $existing = User::where('uPhone', $request->phone)
                            ->where('uId', '!=', $user->uId)
                            ->whereNull('uDeleted_at')
                            ->first();
            if ($existing) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Số điện thoại này đã được sử dụng bởi tài khoản khác.'
                ], 400);
            }
            $user->uPhone = $request->phone;
        }
        $user->save();

        return response()->json([
            'status'  => 'success',
            'message' => 'Cập nhật hồ sơ thành công',
            'data'    => [
                'name'  => $user->uName ?? $user->name,
                'email' => $user->uEmail ?? $user->email,
                'phone' => $user->uPhone ?? $user->phone,
            ]
        ]);
    }

    /**
     * GET /admin/profile/sessions
     * Danh sách phiên đăng nhập (Sanctum tokens)
     */
    public function getSessions(Request $request)
    {
        $user    = $request->user();
        $current = $user->currentAccessToken();
        $tokens  = $user->tokens()->orderByDesc('last_used_at')->take(20)->get();

        $data = $tokens->map(function ($token) use ($current, $request) {
            $deviceName = $token->name;
            $isCurrent = $current && $token->id === $current->id;

            if ($deviceName === 'auth_token' || empty($deviceName)) {
                if ($isCurrent) {
                    $ua = $request->userAgent() ?? '';
                    $browser = 'Unknown Browser';
                    $os = 'Unknown OS';
                    if (preg_match('/(Edg|OPR|Chrome|Firefox|Safari|MSIE|Trident)/i', $ua, $bm)) {
                        $browserMap = ['Edg' => 'Edge', 'OPR' => 'Opera', 'Trident' => 'IE'];
                        $browser = $browserMap[$bm[1]] ?? ucfirst($bm[1]);
                    }
                    if (preg_match('/(iPhone|iPad|Android|Windows|Macintosh|Linux|Ubuntu)/i', $ua, $om)) {
                        $osMap = ['Macintosh' => 'macOS', 'iPhone' => 'iPhone', 'iPad' => 'iPad'];
                        $os = $osMap[$om[1]] ?? ucfirst($om[1]);
                    }
                    $deviceName = "$browser trên $os";
                } else {
                    $deviceName = 'Thiết bị khác (chưa rõ)';
                }
            }

            return [
                'id'           => $token->id,
                'name'         => $deviceName,
                'is_current'   => $isCurrent,
                'created_at'   => $token->created_at ? $token->created_at->diffForHumans() : null,
                'last_used_at' => $token->last_used_at ? $token->last_used_at->diffForHumans() : 'Chưa sử dụng',
            ];
        });

        return response()->json([
            'status' => 'success',
            'data'   => $data,
        ]);
    }

    /**
     * DELETE /admin/profile/sessions/{id}
     * Thu hồi một phiên đăng nhập cụ thể
     */
    public function revokeSession(Request $request, $id)
    {
        $user    = $request->user();
        $current = $user->currentAccessToken();

        if ($id == $current->id) {
            return response()->json(['status' => 'error', 'message' => 'Không thể thu hồi phiên hiện tại'], 400);
        }

        $user->tokens()->where('id', $id)->delete();

        return response()->json(['status' => 'success', 'message' => 'Đã thu hồi phiên đăng nhập']);
    }

    /**
     * DELETE /admin/profile/sessions
     * Thu hồi tất cả phiên trừ phiên hiện tại
     */
    public function revokeAllSessions(Request $request)
    {
        $user    = $request->user();
        $current = $user->currentAccessToken();

        $user->tokens()->where('id', '!=', $current->id)->delete();

        return response()->json(['status' => 'success', 'message' => 'Đã thu hồi tất cả phiên khác']);
    }
}

<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Gác cổng phân quyền ở tầng KHAI BÁO ROUTE.
 *
 * Vì sao cần: phân quyền của hệ này nằm ở middleware 'role:{role}' gắn trên từng
 * nhóm route. Chỉ cần một route bị đặt ra ngoài nhóm là nó rơi xuống mức "chỉ cần
 * đăng nhập", và mọi tài khoản — kể cả học viên — gọi được. Đã xảy ra thật với
 * nhóm /test/* (TestExamController hardcode eTeacher_id=1, học viên tạo được đề
 * đứng tên giáo viên id 1). Lỗi kiểu này không có test nào bắt được vì route vẫn
 * trả 200 cho đúng vai trò mà nó phục vụ.
 *
 * Test này KHÔNG gọi route. Nó đọc bảng route và assert bất biến:
 *   mọi route api/* có auth phải có role check, TRỪ danh sách tự-phục-vụ dưới đây.
 *
 * Khi thêm route mới mà test này đỏ: đừng thêm vào allowlist theo phản xạ. Hãy
 * hỏi "route này có phải ai đăng nhập cũng được gọi không?". Nếu không, đặt nó
 * vào nhóm role tương ứng.
 */
class RolePermissionMatrixTest extends TestCase
{
    /**
     * Các route CỐ Ý chỉ cần đăng nhập, không phân vai trò.
     *
     * Tiêu chí để có mặt ở đây: endpoint chỉ tác động lên CHÍNH chủ token
     * (đọc/sửa hồ sơ của mình, đổi mật khẩu của mình, thu hồi phiên của mình).
     * Chúng lấy user từ $request->user() nên không thể chạm tới người khác.
     */
    private const SELF_SERVICE_ROUTES = [
        'api/logout',

        // Push notification: gắn subscription vào chính chủ token.
        'api/push/subscribe',
        'api/push/unsubscribe',

        // Hồ sơ / thiết lập của chính mình.
        'api/user/profile',
        'api/user/avatar',
        'api/user/change-password',
        'api/user/notification-settings',
        'api/user/request-delete',
        'api/user/cancel-delete',
        'api/user/age-group',
        'api/user/theme-preference',

        // Phiên đăng nhập của chính mình. logoutSession lọc theo
        // $user->tokens() nên không thu hồi được token người khác.
        'api/user/sessions',
        'api/user/sessions/{id}',
    ];

    /**
     * Middleware của route ở dạng chuỗi.
     *
     * gatherMiddleware() trả TÊN ALIAS như khai báo trong routes/api.php
     * ('auth:sanctum', 'role:teacher'), KHÔNG phải tên class. Bản đầu của test này
     * tìm 'Authenticate' nên bỏ qua mọi route và pass rỗng. Kiểm cả hai dạng để
     * không vỡ nếu sau này có chỗ gắn trực tiếp class.
     */
    private function middlewareOf($route): string
    {
        return implode(',', $route->gatherMiddleware());
    }

    private function requiresAuth(string $middleware): bool
    {
        return strpos($middleware, 'auth:sanctum') !== false
            || strpos($middleware, 'Authenticate') !== false;
    }

    private function hasRoleCheck(string $middleware): bool
    {
        return strpos($middleware, 'role:') !== false
            || strpos($middleware, 'CheckRole') !== false
            || strpos($middleware, 'CheckAdmin') !== false;
    }

    /** @test */
    public function every_authenticated_api_route_declares_a_role_check(): void
    {
        $offenders = [];

        foreach (Route::getRoutes() as $route) {
            $uri = $route->uri();
            if (strpos($uri, 'api/') !== 0) {
                continue;
            }

            $middleware = $this->middlewareOf($route);

            // Route công khai (login, health, blog…) không thuộc phạm vi test này.
            if (!$this->requiresAuth($middleware)) {
                continue;
            }

            if ($this->hasRoleCheck($middleware)) {
                continue;
            }

            if (in_array($uri, self::SELF_SERVICE_ROUTES, true)) {
                continue;
            }

            $offenders[] = sprintf('%s %s', implode('|', $route->methods()), $uri);
        }

        $this->assertSame(
            [],
            $offenders,
            "Route có auth nhưng KHÔNG phân vai trò (mọi user đăng nhập đều gọi được):\n  "
            . implode("\n  ", $offenders)
            . "\n\nĐặt route vào nhóm role:{teacher|student|admin}, hoặc nếu nó chỉ tác động"
            . "\nlên chính chủ token thì thêm vào SELF_SERVICE_ROUTES kèm lý do."
        );
    }

    /** @test */
    public function the_removed_test_routes_are_gone(): void
    {
        $uris = [];
        foreach (Route::getRoutes() as $route) {
            $uris[] = $route->uri();
        }

        // Nhóm này từng cho học viên tạo đề đứng tên giáo viên id 1.
        // Nếu ai đó thêm lại, test này đỏ.
        $this->assertNotContains('api/test/exams', $uris);
        $this->assertNotContains('api/test/exams/{id}', $uris);
        $this->assertNotContains('api/test/upload/audio', $uris);
        $this->assertNotContains('api/test/upload/image', $uris);
    }

    /** @test */
    public function role_prefix_matches_the_declared_role_middleware(): void
    {
        // Prefix URI và role trong middleware phải khớp. Lệch nhau nghĩa là
        // /api/teacher/* lại đòi role:student — hoặc ngược lại, tệ hơn: /api/admin/*
        // chỉ đòi role:teacher.
        $expected = [
            'api/teacher/' => 'teacher',
            'api/student/' => 'student',
            'api/admin/'   => 'admin',
        ];

        $mismatches = [];

        foreach (Route::getRoutes() as $route) {
            $uri = $route->uri();

            foreach ($expected as $prefix => $role) {
                if (strpos($uri, $prefix) !== 0) {
                    continue;
                }

                $middleware = $this->middlewareOf($route);

                $ok = strpos($middleware, 'role:' . $role) !== false
                    || strpos($middleware, 'CheckRole:' . $role) !== false
                    || ($role === 'admin' && strpos($middleware, 'CheckAdmin') !== false);

                if (!$ok) {
                    $mismatches[] = sprintf('%s %s → %s', implode('|', $route->methods()), $uri, $middleware);
                }
            }
        }

        $this->assertSame(
            [],
            $mismatches,
            "Prefix URI không khớp role middleware:\n  " . implode("\n  ", $mismatches)
        );
    }
}

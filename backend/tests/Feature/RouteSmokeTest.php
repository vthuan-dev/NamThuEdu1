<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * SMOKE TEST — gọi thật mọi route GET không tham số và ghi nhận cái nào trả 500.
 *
 * Audit tĩnh (route/model/validation) chỉ bắt được lỗi khai báo. Lỗi kiểu "gọi cột
 * không tồn tại", "truy cập property trên null", "relation sai" chỉ hiện khi code
 * THỰC SỰ chạy. Test này đi qua đúng middleware thật với token thật.
 *
 * Không assert gì — nó CHỈ liệt kê. Mục đích là phát hiện, không phải gác cổng.
 */
class RouteSmokeTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function list_get_routes_returning_server_errors(): void
    {
        $teacher = User::factory()->create(['uRole' => 'teacher']);
        $student = User::factory()->create(['uRole' => 'student', 'age_group' => 'teens']);
        $admin   = User::factory()->create(['uRole' => 'admin']);

        $tokens = [
            'teacher' => $teacher->createToken('t')->plainTextToken,
            'student' => $student->createToken('t')->plainTextToken,
            'admin'   => $admin->createToken('t')->plainTextToken,
        ];

        $failures = [];
        $checked = 0;

        foreach (Route::getRoutes() as $route) {
            if (!in_array('GET', $route->methods(), true)) continue;

            $uri = $route->uri();
            if (strpos($uri, 'api/') !== 0) continue;
            if (strpos($uri, '{') !== false) continue;      // cần tham số, bỏ qua
            if (strpos($uri, 'api/documentation') === 0) continue;

            // Chọn role phù hợp theo prefix để không bị 403 che mất 500 thật.
            $role = 'teacher';
            if (strpos($uri, 'api/student/') === 0) $role = 'student';
            elseif (strpos($uri, 'api/admin/') === 0) $role = 'admin';

            $checked++;

            try {
                $res = $this->withHeaders([
                    'Authorization' => 'Bearer ' . $tokens[$role],
                    'Accept' => 'application/json',
                ])->getJson('/' . $uri);

                // Không dùng $res->status(): route trả file (StreamedResponse) không
                // có method đó, và bản trước của test này đã báo động giả vì thế.
                $status = $res->baseResponse->getStatusCode();

                if ($status >= 500) {
                    $body = null;
                    try { $body = $res->json(); } catch (\Throwable $ignore) {}
                    $msg = is_array($body)
                        ? (($body['error'] ?? null) ?: ($body['message'] ?? '?'))
                        : '?';
                    $failures[] = sprintf("  [%d] GET /%s (%s)\n        %s",
                        $status, $uri, $role,
                        substr(preg_replace('/\s+/', ' ', (string) $msg), 0, 180));
                }
            } catch (\Throwable $e) {
                $failures[] = sprintf("  [EX] GET /%s (%s)\n        %s",
                    $uri, $role,
                    substr(preg_replace('/\s+/', ' ', $e->getMessage()), 0, 180));
            }

        }

        fwrite(STDERR, "\n" . str_repeat('=', 74) . "\n");
        fwrite(STDERR, "SMOKE: {$checked} route GET không tham số\n");
        fwrite(STDERR, str_repeat('=', 74) . "\n");

        if (empty($failures)) {
            fwrite(STDERR, "OK - khong co route nao tra 5xx\n");
        } else {
            fwrite(STDERR, count($failures) . " route tra 5xx:\n");
            fwrite(STDERR, implode("\n", $failures) . "\n");
        }

        $this->assertTrue(true);
    }
}

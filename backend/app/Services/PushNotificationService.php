<?php

namespace App\Services;

use App\Models\PushSubscription;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

class PushNotificationService
{
    private WebPush $webPush;
    private bool $enabled = true;

    public function __construct()
    {
        // Windows requires OPENSSL_CONF to be set for EC key operations (VAPID JWT signing)
        if (PHP_OS_FAMILY === 'Windows' && !getenv('OPENSSL_CONF')) {
            $candidates = [
                'C:\\php\\extras\\ssl\\openssl.cnf',
                'C:\\xampp\\php\\extras\\ssl\\openssl.cnf',
                'C:\\wamp64\\bin\\php\\php7.4.33\\extras\\ssl\\openssl.cnf',
            ];
            foreach ($candidates as $path) {
                if (file_exists($path)) {
                    putenv('OPENSSL_CONF=' . $path);
                    break;
                }
            }
        }

        $publicKey  = env('VAPID_PUBLIC_KEY');
        $privateKey = env('VAPID_PRIVATE_KEY');

        // Không cấu hình VAPID (vd môi trường test) → tắt push, no-op an toàn.
        if (empty($publicKey) || empty($privateKey)) {
            $this->enabled = false;
            return;
        }

        $auth = [
            'VAPID' => [
                'subject'    => env('VAPID_SUBJECT', 'mailto:admin@namthu.edu.vn'),
                'publicKey'  => $publicKey,
                'privateKey' => $privateKey,
            ],
        ];

        $this->webPush = new WebPush($auth);
        $this->webPush->setReuseVAPIDHeaders(true);
        $this->webPush->setAutomaticPadding(false);
    }

    /**
     * Send push notification to a single user (by uId).
     */
    public function sendToUser(int $userId, string $title, string $body, array $data = []): void
    {
        if (!$this->enabled) {
            Log::info("[Push] Bỏ qua — VAPID chưa cấu hình (user {$userId}).");
            return;
        }

        $subscriptions = PushSubscription::where('user_id', $userId)->get();

        if ($subscriptions->isEmpty()) {
            Log::info("[Push] No subscriptions for user {$userId} — student chưa bật/đăng ký thông báo.");
            return;
        }

        foreach ($subscriptions as $sub) {
            $subscription = Subscription::create([
                'endpoint'        => $sub->endpoint,
                'keys'            => [
                    'p256dh' => $sub->p256dh_key,
                    'auth'   => $sub->auth_key,
                ],
            ]);

            $payload = json_encode([
                'title' => $title,
                'body'  => $body,
                'icon'  => '/favicon.png',
                'badge' => '/favicon.png',
                'data'  => $data,
            ]);

            $this->webPush->queueNotification($subscription, $payload);
        }

        foreach ($this->webPush->flush() as $report) {
            $endpoint = $report->getRequest()->getUri()->__toString();

            if ($report->isSuccess()) {
                Log::info("[Push] Sent OK to user {$userId} (endpoint: {$endpoint})");
                continue;
            }

            if ($report->isSubscriptionExpired()) {
                Log::warning("[Push] Subscription expired, removing (user {$userId}): {$endpoint}");
                PushSubscription::where('endpoint', $endpoint)->delete();
                continue;
            }

            // Any other failure: log the reason so we can diagnose (bad key, 4xx, etc.)
            Log::error("[Push] Failed to send to user {$userId} (endpoint: {$endpoint}): " . $report->getReason());
        }
    }

    /**
     * Send push notification to multiple users at once.
     */
    public function sendToUsers(array $userIds, string $title, string $body, array $data = []): void
    {
        foreach ($userIds as $userId) {
            $this->sendToUser((int) $userId, $title, $body, $data);
        }
    }
}

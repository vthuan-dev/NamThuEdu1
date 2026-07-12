<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CorsMiddleware
{
    /**
     * Handle an incoming request.
     *
     * Reflect only allowlisted origins. Never echo arbitrary Origin with
     * Access-Control-Allow-Credentials: true (CWE-942).
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next)
    {
        $requestOrigin = $request->headers->get('Origin');
        $allowedOrigins = $this->allowedOrigins();

        // Public static assets can be embedded cross-origin without credentials.
        $isStorage = str_starts_with($request->path(), 'storage/');

        $allowOrigin = null;
        $allowCredentials = false;

        if ($isStorage) {
            $allowOrigin = '*';
            $allowCredentials = false;
        } elseif ($requestOrigin && in_array($requestOrigin, $allowedOrigins, true)) {
            $allowOrigin = $requestOrigin;
            $allowCredentials = true;
        }

        if ($request->getMethod() === 'OPTIONS') {
            $response = response('', 204);
            return $this->applyCorsHeaders($response, $allowOrigin, $allowCredentials);
        }

        $response = $next($request);
        return $this->applyCorsHeaders($response, $allowOrigin, $allowCredentials);
    }

    /**
     * Origins permitted to call the API with credentials.
     *
     * @return array<int, string>
     */
    private function allowedOrigins(): array
    {
        // Runtime config (may be overridden by EnvironmentServiceProvider from namthuedu.php)
        $configured = config('cors.allowed_origins', []);
        // Defense-in-depth baseline — never rely solely on env-specific overrides.
        $baseline = [
            'https://namthuedu.vn',
            'https://www.namthuedu.vn',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:8000',
            'http://127.0.0.1:8000',
        ];

        return array_values(array_unique(array_filter(array_merge(
            is_array($configured) ? $configured : [],
            $baseline
        ))));
    }

    /**
     * @param  \Illuminate\Http\Response|\Illuminate\Http\JsonResponse|\Symfony\Component\HttpFoundation\Response  $response
     * @return \Illuminate\Http\Response|\Illuminate\Http\JsonResponse|\Symfony\Component\HttpFoundation\Response
     */
    private function applyCorsHeaders($response, ?string $allowOrigin, bool $allowCredentials)
    {
        if ($allowOrigin !== null) {
            $response->headers->set('Access-Control-Allow-Origin', $allowOrigin);
            $response->headers->set(
                'Access-Control-Allow-Credentials',
                ($allowCredentials && $allowOrigin !== '*') ? 'true' : 'false'
            );
            // Required when ACAO is not "*": help caches vary by Origin.
            $response->headers->set('Vary', 'Origin', false);
        }

        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        $response->headers->set(
            'Access-Control-Allow-Headers',
            'Content-Type, Authorization, X-Requested-With, Accept, Origin, Range'
        );
        $response->headers->set(
            'Access-Control-Expose-Headers',
            'Authorization, Content-Type, X-Requested-With, Content-Range, Accept-Ranges'
        );
        $response->headers->set('Access-Control-Max-Age', '86400');

        return $response;
    }
}
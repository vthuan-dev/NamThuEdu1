<?php

return [

    /*
    |--------------------------------------------------------------------------
    | NamThuEdu Application Configuration
    |--------------------------------------------------------------------------
    |
    | This file contains configuration specific to NamThuEdu application
    | including feature flags, rate limits, and environment-specific settings.
    |
    */

    'app' => [
        'name' => config('app.name', 'Nam Thu Edu API'),
        'timezone' => config('app.timezone', 'Asia/Ho_Chi_Minh'),
        'frontend_url' => config('app.url', 'http://localhost:3000'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Feature Flags
    |--------------------------------------------------------------------------
    |
    | Control feature availability across different environments
    |
    */
    'features' => [
        'registration_enabled' => true,
        'otp_enabled' => true,
        'ai_grading_enabled' => false,
        'exam_templates_enabled' => true,
    ],

    /*
    |--------------------------------------------------------------------------
    | Rate Limiting Configuration
    |--------------------------------------------------------------------------
    |
    | Configure rate limits for different endpoints and actions
    | More relaxed limits for development, stricter for production
    |
    */
    'rate_limits' => [
        'login' => env('APP_ENV') === 'production' ? 5 : 10,
        'otp' => env('APP_ENV') === 'production' ? 3 : 5,
        'api' => env('APP_ENV') === 'production' ? 60 : 120,
    ],

    /*
    |--------------------------------------------------------------------------
    | SMS/OTP Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for SMS and OTP providers based on environment
    |
    */
    'sms' => [
        'provider' => in_array(env('APP_ENV'), ['local', 'development']) ? 'mock' : 'esms',
        'providers' => [
            'esms' => [
                'api_key' => null,
                'secret_key' => null,
                'brandname' => 'NAMTHUEDU',
                'url' => 'https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/',
            ],
            'twilio' => [
                'sid' => null,
                'token' => null,
                'verify_sid' => null,
            ],
            'aws_sns' => [
                'region' => 'ap-southeast-1',
            ],
        ],
        'otp' => [
            'length' => 6,
            'expiry_minutes' => 5,
            'max_attempts' => env('APP_ENV') === 'production' ? 3 : 5,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Development Tools Configuration
    |--------------------------------------------------------------------------
    |
    | Enable/disable development and debugging tools based on environment
    |
    */
    'dev_tools' => [
        'telescope_enabled' => in_array(env('APP_ENV'), ['local', 'development', 'staging']),
        'debugbar_enabled' => in_array(env('APP_ENV'), ['local', 'development']),
        'query_log_enabled' => in_array(env('APP_ENV'), ['local', 'development']),
    ],

    /*
    |--------------------------------------------------------------------------
    | Security Configuration
    |--------------------------------------------------------------------------
    |
    | Security-related settings based on environment
    |
    */
    'security' => [
        // Single source of truth consumed by EnvironmentServiceProvider → cors.allowed_origins.
        // Keep production on namthuedu.vn (not .com). Local must include both localhost and 127.0.0.1.
        'cors_allowed_origins' => array_values(array_unique(array_filter(array_merge(
            // Always allow production frontends (safe even in local when testing against prod FE)
            [
                'https://namthuedu.vn',
                'https://www.namthuedu.vn',
            ],
            // Staging
            env('APP_ENV') === 'staging' ? [
                'https://staging.namthuedu.vn',
            ] : [],
            // Local / development frontends
            in_array(env('APP_ENV'), ['local', 'development', null, ''], true) || env('APP_ENV') !== 'production' ? [
                'http://localhost:5173',
                'http://127.0.0.1:5173',
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                'http://localhost:8000',
                'http://127.0.0.1:8000',
            ] : [],
            // Optional comma-separated override from .env: CORS_ALLOWED_ORIGINS=https://a.com,https://b.com
            array_filter(array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', ''))))
        )))),
        'jwt_secret' => null,
        'session_secure' => in_array(env('APP_ENV'), ['staging', 'production']),
        'force_https' => env('APP_ENV') === 'production',
    ],

    /*
    |--------------------------------------------------------------------------
    | File Upload Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for file uploads and storage
    |
    */
    'uploads' => [
        'max_file_size' => 10 * 1024 * 1024, // 10MB
        'allowed_extensions' => ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'mp3', 'wav'],
        'exam_media_path' => 'exams/media',
        'user_avatars_path' => 'users/avatars',
    ],

    /*
    |--------------------------------------------------------------------------
    | Exam Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for exam system
    |
    */
    'exams' => [
        'default_duration_minutes' => 60,
        'max_duration_minutes' => 180,
        'auto_submit_buffer_minutes' => 5,
        'question_types' => [
            'multiple_choice',
            'fill_blank',
            'true_false',
            'matching',
            'matching_lines',
            'coloring',
            'short_answer',
            'essay',
            'speaking_identification',
            'speaking_comparison',
            'multiple_choice_cloze',
            'word_completion',
            'open_cloze',
            'information_transfer',
            'short_writing'
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Monitoring & Analytics
    |--------------------------------------------------------------------------
    |
    | Configuration for monitoring and analytics services
    |
    */
    'monitoring' => [
        'sentry_dsn' => null,
        'google_analytics_id' => null,
    ],

    /*
    |--------------------------------------------------------------------------
    | Database Configuration per Environment
    |--------------------------------------------------------------------------
    |
    | Different database settings based on environment
    |
    */
    'database' => [
        'strict_mode' => in_array(env('APP_ENV'), ['staging', 'production']),
        'query_log' => in_array(env('APP_ENV'), ['local', 'development']),
        'connection_timeout' => env('APP_ENV') === 'production' ? 60 : 30,
    ],

    /*
    |--------------------------------------------------------------------------
    | Cache Configuration per Environment
    |--------------------------------------------------------------------------
    |
    | Different cache settings based on environment
    |
    */
    'cache' => [
        'default_driver' => in_array(env('APP_ENV'), ['staging', 'production']) ? 'redis' : 'file',
        'default_ttl' => env('APP_ENV') === 'production' ? 3600 : (env('APP_ENV') === 'staging' ? 1800 : 300),
        'config_cache' => in_array(env('APP_ENV'), ['staging', 'production']),
        'redis_enabled' => in_array(env('APP_ENV'), ['staging', 'production']),
    ],

    /*
    |--------------------------------------------------------------------------
    | Logging Configuration per Environment
    |--------------------------------------------------------------------------
    |
    | Different logging settings based on environment
    |
    */
    'logging' => [
        'level' => env('APP_ENV') === 'production' ? 'error' : (env('APP_ENV') === 'staging' ? 'info' : 'debug'),
        'channel' => in_array(env('APP_ENV'), ['staging', 'production']) ? 'daily' : 'single',
        'days' => env('APP_ENV') === 'production' ? 14 : 7,
    ],

    /*
    |--------------------------------------------------------------------------
    | Mail Configuration per Environment
    |--------------------------------------------------------------------------
    |
    | Different mail settings based on environment
    |
    */
    'mail' => [
        'driver' => in_array(env('APP_ENV'), ['local', 'development']) ? 'log' : 'smtp',
        'from_address' => env('APP_ENV') === 'production' 
            ? 'noreply@namthuedu.com' 
            : (env('APP_ENV') === 'staging' 
                ? 'staging@namthuedu.com' 
                : 'dev@namthuedu.local'
            ),
    ],

];
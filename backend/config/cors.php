<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'docs/*', 'api-docs.json', 'storage/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        'https://namthuedu.vn',
        'https://www.namthuedu.vn',
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => ['Authorization', 'Content-Type', 'X-Requested-With', 'Content-Range', 'Accept-Ranges'],

    'max_age' => 0,

    'supports_credentials' => true,

];

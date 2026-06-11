<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Environment Configuration
    |--------------------------------------------------------------------------
    |
    | This file contains environment-specific configurations that help
    | manage different deployment environments (dev, staging, production)
    |
    */

    'current' => env('APP_ENV', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Environment Definitions
    |--------------------------------------------------------------------------
    |
    | Define characteristics and settings for each environment
    |
    */

    'environments' => [
        'local' => [
            'name' => 'Local Development',
            'debug' => true,
            'log_level' => 'debug',
            'cache_config' => false,
            'optimize' => false,
        ],
        'development' => [
            'name' => 'Development Server',
            'debug' => true,
            'log_level' => 'debug',
            'cache_config' => false,
            'optimize' => false,
        ],
        'staging' => [
            'name' => 'Staging Environment',
            'debug' => false,
            'log_level' => 'info',
            'cache_config' => true,
            'optimize' => true,
        ],
        'production' => [
            'name' => 'Production Environment',
            'debug' => false,
            'log_level' => 'error',
            'cache_config' => true,
            'optimize' => true,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Environment Helpers
    |--------------------------------------------------------------------------
    |
    | Helper methods to check current environment
    |
    */

    'is_local' => in_array(env('APP_ENV', 'local'), ['local', 'development'], true),

    'is_staging' => env('APP_ENV') === 'staging',

    'is_production' => env('APP_ENV') === 'production',

    'is_testing' => env('APP_ENV') === 'testing',

    /*
    |--------------------------------------------------------------------------
    | Database Configuration per Environment
    |--------------------------------------------------------------------------
    |
    | Different database settings for each environment
    |
    */

    'database' => [
        'local' => [
            'strict_mode' => false,
            'query_log' => true,
        ],
        'development' => [
            'strict_mode' => false,
            'query_log' => true,
        ],
        'staging' => [
            'strict_mode' => true,
            'query_log' => false,
        ],
        'production' => [
            'strict_mode' => true,
            'query_log' => false,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Cache Configuration per Environment
    |--------------------------------------------------------------------------
    |
    | Different cache settings for each environment
    |
    */

    'cache' => [
        'local' => [
            'default_ttl' => 60, // 1 minute
            'config_cache' => false,
        ],
        'development' => [
            'default_ttl' => 300, // 5 minutes
            'config_cache' => false,
        ],
        'staging' => [
            'default_ttl' => 3600, // 1 hour
            'config_cache' => true,
        ],
        'production' => [
            'default_ttl' => 3600, // 1 hour
            'config_cache' => true,
        ],
    ],

];
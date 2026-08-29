<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Models\Course;
use App\Models\Classes;
use App\Models\Exam;
use App\Models\TestAssignment;
use App\Models\Submission;
use App\Models\Post;
use App\Models\Category;

/**
 * @OA\Tag(
 *     name="System Reports",
 *     description="Admin system reports and analytics API endpoints"
 * )
 */
class SystemReportController extends Controller
{
    /**
     * @OA\Get(
     *     path="/admin/reports/dashboard",
     *     tags={"System Reports"},
     *     summary="Get admin dashboard overview",
     *     description="Get comprehensive system overview for admin dashboard",
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(response=200, description="Dashboard data retrieved successfully"),
     *     @OA\Response(response=403, description="Access denied")
     * )
     * 
     * GET /api/admin/reports/dashboard
     * Tổng quan hệ thống cho dashboard admin
     */
    public function dashboard(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ quản trị viên mới có quyền truy cập.'
            ], 403);
        }

        // Users Overview
        $usersOverview = $this->getUsersOverview();
        
        // Courses Overview
        $coursesOverview = $this->getCoursesOverview();
        
        // Exams Overview
        $examsOverview = $this->getExamsOverview();
        
        // System Activity
        $systemActivity = $this->getSystemActivity();
        
        // Performance Metrics
        $performanceMetrics = $this->getPerformanceMetrics();

        return response()->json([
            'status' => 'success',
            'data' => [
                'users' => $usersOverview,
                'courses' => $coursesOverview,
                'exams' => $examsOverview,
                'activity' => $systemActivity,
                'performance' => $performanceMetrics,
                'generated_at' => now()->toISOString()
            ]
        ]);
    }

    /**
     * @OA\Get(
     *     path="/admin/reports/users",
     *     tags={"System Reports"},
     *     summary="Get detailed user statistics",
     *     description="Get comprehensive user statistics and analytics",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="period",
     *         in="query",
     *         description="Time period (7d, 30d, 90d, 1y)",
     *         @OA\Schema(type="string", enum={"7d", "30d", "90d", "1y"})
     *     ),
     *     @OA\Response(response=200, description="User statistics retrieved successfully")
     * )
     * 
     * GET /api/admin/reports/users
     * Thống kê chi tiết người dùng
     */
    public function userStatistics(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ quản trị viên mới có quyền truy cập.'
            ], 403);
        }

        $period = $request->get('period', '30d');
        $days = $this->getPeriodDays($period);

        // Basic statistics
        $totalUsers = User::whereNull('uDeleted_at')->count();
        $activeUsers = User::where('uStatus', 'active')->whereNull('uDeleted_at')->count();
        $newUsers = User::where('uCreated_at', '>=', now()->subDays($days))
                       ->whereNull('uDeleted_at')
                       ->count();

        // Users by role
        $usersByRole = User::whereNull('uDeleted_at')
                          ->selectRaw('uRole, COUNT(*) as count')
                          ->groupBy('uRole')
                          ->pluck('count', 'uRole');

        // Registration trend
        $registrationTrend = $this->getRegistrationTrend($days);

        // Activity statistics
        $activityStats = $this->getUserActivityStats($days);

        // Geographic distribution (if available)
        $geographicStats = $this->getGeographicStats();

        return response()->json([
            'status' => 'success',
            'data' => [
                'overview' => [
                    'total_users' => $totalUsers,
                    'active_users' => $activeUsers,
                    'new_users' => $newUsers,
                    'active_rate' => $totalUsers > 0 ? round(($activeUsers / $totalUsers) * 100, 2) : 0,
                ],
                'by_role' => $usersByRole,
                'registration_trend' => $registrationTrend,
                'activity' => $activityStats,
                'geographic' => $geographicStats,
                'period' => $period
            ]
        ]);
    }

    /**
     * @OA\Get(
     *     path="/admin/reports/courses",
     *     tags={"System Reports"},
     *     summary="Get detailed course statistics",
     *     description="Get comprehensive course statistics and analytics",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="period",
     *         in="query",
     *         description="Time period (7d, 30d, 90d, 1y)",
     *         @OA\Schema(type="string", enum={"7d", "30d", "90d", "1y"})
     *     ),
     *     @OA\Response(response=200, description="Course statistics retrieved successfully")
     * )
     * 
     * GET /api/admin/reports/courses
     * Thống kê chi tiết khóa học
     */
    public function courseStatistics(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ quản trị viên mới có quyền truy cập.'
            ], 403);
        }

        $period = $request->get('period', '30d');
        $days = $this->getPeriodDays($period);

        // Basic course statistics
        $totalCourses = Course::count();
        $activeCourses = Course::where('cStatus', 'active')->count();
        $newCourses = Course::where('cCreated_at', '>=', now()->subDays($days))->count();

        // Courses by type
        $coursesByType = Course::selectRaw('cType, COUNT(*) as count')
                              ->groupBy('cType')
                              ->pluck('count', 'cType');

        // Enrollment statistics
        $totalEnrollments = DB::table('course_enrollments')->count();
        $newEnrollments = DB::table('course_enrollments')
                            ->where('enrolled_at', '>=', now()->subDays($days))
                            ->count();

        // Popular courses
        $popularCourses = Course::withCount('enrollments')
                               ->orderByDesc('enrollments_count')
                               ->limit(10)
                               ->get()
                               ->map(function($course) {
                                   return [
                                       'course_name' => $course->cName,
                                       'enrollments' => $course->enrollments_count,
                                       'type' => $course->cType
                                   ];
                               });

        // Revenue statistics (if applicable)
        $revenueStats = $this->getCourseRevenueStats($days);

        // Course creation trend
        $creationTrend = $this->getCourseCreationTrend($days);

        return response()->json([
            'status' => 'success',
            'data' => [
                'overview' => [
                    'total_courses' => $totalCourses,
                    'active_courses' => $activeCourses,
                    'new_courses' => $newCourses,
                    'total_enrollments' => $totalEnrollments,
                    'new_enrollments' => $newEnrollments,
                ],
                'by_type' => $coursesByType,
                'popular_courses' => $popularCourses,
                'revenue' => $revenueStats,
                'creation_trend' => $creationTrend,
                'period' => $period
            ]
        ]);
    }

    /**
     * @OA\Get(
     *     path="/admin/reports/activity",
     *     tags={"System Reports"},
     *     summary="Get system activity report",
     *     description="Get detailed system activity and usage analytics",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="period",
     *         in="query",
     *         description="Time period (7d, 30d, 90d, 1y)",
     *         @OA\Schema(type="string", enum={"7d", "30d", "90d", "1y"})
     *     ),
     *     @OA\Response(response=200, description="Activity report retrieved successfully")
     * )
     * 
     * GET /api/admin/reports/activity
     * Báo cáo hoạt động hệ thống
     */
    public function activityReport(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ quản trị viên mới có quyền truy cập.'
            ], 403);
        }

        $period = $request->get('period', '30d');
        $days = $this->getPeriodDays($period);

        // Test activity
        $testActivity = $this->getTestActivity($days);

        // Content activity
        $contentActivity = $this->getContentActivity($days);

        // User engagement
        $userEngagement = $this->getUserEngagement($days);

        // System usage patterns
        $usagePatterns = $this->getUsagePatterns($days);

        // Peak hours analysis
        $peakHours = $this->getPeakHoursAnalysis($days);

        return response()->json([
            'status' => 'success',
            'data' => [
                'tests' => $testActivity,
                'content' => $contentActivity,
                'engagement' => $userEngagement,
                'usage_patterns' => $usagePatterns,
                'peak_hours' => $peakHours,
                'period' => $period
            ]
        ]);
    }

    /**
     * @OA\Get(
     *     path="/admin/reports/trends",
     *     tags={"System Reports"},
     *     summary="Get usage trends analysis",
     *     description="Get detailed usage trends and predictive analytics",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="period",
     *         in="query",
     *         description="Time period (30d, 90d, 6m, 1y)",
     *         @OA\Schema(type="string", enum={"30d", "90d", "6m", "1y"})
     *     ),
     *     @OA\Response(response=200, description="Trends analysis retrieved successfully")
     * )
     * 
     * GET /api/admin/reports/trends
     * Phân tích xu hướng sử dụng
     */
    public function trendsAnalysis(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ quản trị viên mới có quyền truy cập.'
            ], 403);
        }

        $period = $request->get('period', '90d');
        $days = $this->getPeriodDays($period);

        // Growth trends
        $growthTrends = $this->getGrowthTrends($days);

        // Usage trends
        $usageTrends = $this->getUsageTrends($days);

        // Performance trends
        $performanceTrends = $this->getPerformanceTrends($days);

        // Seasonal patterns
        $seasonalPatterns = $this->getSeasonalPatterns($days);

        // Predictions (simple linear regression)
        $predictions = $this->generatePredictions($days);
        $timeline = $this->getAdminTimeline($days);
        $serverMetrics = $this->getServerHealthMetrics();

        return response()->json([
            'status' => 'success',
            'data' => [
                'growth' => $growthTrends,
                'usage' => $usageTrends,
                'performance' => $performanceTrends,
                'seasonal' => $seasonalPatterns,
                'predictions' => $predictions,
                'timeline' => $timeline,
                'server_metrics' => $serverMetrics,
                'period' => $period
            ]
        ]);
    }

    /**
     * @OA\Get(
     *     path="/admin/reports/export",
     *     tags={"System Reports"},
     *     summary="Export system reports",
     *     description="Export comprehensive system reports in various formats",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="type",
     *         in="query",
     *         description="Report type",
     *         @OA\Schema(type="string", enum={"dashboard", "users", "courses", "activity", "trends"})
     *     ),
     *     @OA\Parameter(
     *         name="format",
     *         in="query",
     *         description="Export format",
     *         @OA\Schema(type="string", enum={"json", "csv", "pdf"})
     *     ),
     *     @OA\Parameter(
     *         name="period",
     *         in="query",
     *         description="Time period",
     *         @OA\Schema(type="string", enum={"7d", "30d", "90d", "1y"})
     *     ),
     *     @OA\Response(response=200, description="Report exported successfully")
     * )
     * 
     * GET /api/admin/reports/export
     * Xuất báo cáo hệ thống
     */
    public function exportReport(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ quản trị viên mới có quyền truy cập.'
            ], 403);
        }

        $type = $request->get('type', 'dashboard');
        $format = $request->get('format', 'json');
        $period = $request->get('period', '30d');

        // Get report data based on type
        $reportData = $this->getReportData($type, $period);

        // Generate export based on format
        switch ($format) {
            case 'csv':
                return $this->exportToCsv($reportData, $type);
            case 'pdf':
                return $this->exportToPdf($reportData, $type);
            default:
                return response()->json([
                    'status' => 'success',
                    'data' => $reportData,
                    'export_info' => [
                        'type' => $type,
                        'format' => $format,
                        'period' => $period,
                        'generated_at' => now()->toISOString()
                    ]
                ]);
        }
    }

    /* ========================================
     * PRIVATE HELPER METHODS
     * ======================================== */

    private function getUsersOverview()
    {
        $totalUsers = User::whereNull('uDeleted_at')->count();
        $activeUsers = User::where('uStatus', 'active')->whereNull('uDeleted_at')->count();
        $newUsersToday = User::whereDate('uCreated_at', today())->whereNull('uDeleted_at')->count();
        $newUsersThisWeek = User::where('uCreated_at', '>=', now()->subDays(7))->whereNull('uDeleted_at')->count();

        return [
            'total' => $totalUsers,
            'active' => $activeUsers,
            'new_today' => $newUsersToday,
            'new_this_week' => $newUsersThisWeek,
            'active_rate' => $totalUsers > 0 ? round(($activeUsers / $totalUsers) * 100, 2) : 0,
        ];
    }

    private function getCoursesOverview()
    {
        $totalCourses = Course::count();
        $activeCourses = Course::where('cStatus', 'active')->count();
        $totalEnrollments = DB::table('course_enrollments')->count();
        $newEnrollmentsToday = DB::table('course_enrollments')->whereDate('enrolled_at', today())->count();

        return [
            'total' => $totalCourses,
            'active' => $activeCourses,
            'total_enrollments' => $totalEnrollments,
            'new_enrollments_today' => $newEnrollmentsToday,
            'avg_enrollments_per_course' => $totalCourses > 0 ? round($totalEnrollments / $totalCourses, 2) : 0,
        ];
    }

    private function getExamsOverview()
    {
        $totalExams = Exam::count();
        $publicExams = Exam::where('eIs_private', false)->count();
        $totalSubmissions = Submission::count();
        $newSubmissionsToday = Submission::whereDate('sSubmit_time', today())->count();

        return [
            'total' => $totalExams,
            'public' => $publicExams,
            'total_submissions' => $totalSubmissions,
            'new_submissions_today' => $newSubmissionsToday,
            'avg_submissions_per_exam' => $totalExams > 0 ? round($totalSubmissions / $totalExams, 2) : 0,
        ];
    }

    private function getSystemActivity()
    {
        $today = today();
        $yesterday = $today->copy()->subDay();

        return [
            'logins_today' => $this->getLoginsCount($today),
            'logins_yesterday' => $this->getLoginsCount($yesterday),
            'tests_taken_today' => Submission::whereDate('sSubmit_time', $today)->count(),
            'posts_created_today' => Post::whereDate('pCreated_at', $today)->count(),
            'courses_created_today' => Course::whereDate('cCreated_at', $today)->count(),
        ];
    }

    private function getPerformanceMetrics()
    {
        // Average test scores.
        // `sScore` là cột điểm thật; `sTotal_score` rỗng 100% trên production nên
        // chỉ số này trước đây luôn hiện 0.
        $avgScore = Submission::whereNotNull('sScore')->avg('sScore');
        
        // Completion rates
        $totalAssignments = TestAssignment::count();
        $completedAssignments = TestAssignment::whereHas('submissions')->count();
        $completionRate = $totalAssignments > 0 ? round(($completedAssignments / $totalAssignments) * 100, 2) : 0;

        return [
            'avg_test_score' => round($avgScore ?? 0, 2),
            'assignment_completion_rate' => $completionRate,
            'system_uptime' => '99.9%', // This would come from monitoring system
        ];
    }

    private function getPeriodDays($period)
    {
        switch ($period) {
            case '7d': return 7;
            case '30d': return 30;
            case '90d': return 90;
            case '6m': return 180;
            case '1y': return 365;
            default: return 30;
        }
    }

    private function getRegistrationTrend($days)
    {
        $trend = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $date = now()->subDays($i)->toDateString();
            $count = User::whereDate('uCreated_at', $date)->whereNull('uDeleted_at')->count();
            $trend[] = [
                'date' => $date,
                'registrations' => $count
            ];
        }
        return $trend;
    }

    private function getUserActivityStats($days)
    {
        // This would require login tracking table
        return [
            'daily_active_users' => User::where('uStatus', 'active')->count(), // Simplified
            'weekly_active_users' => User::where('uStatus', 'active')->count(), // Simplified
            'monthly_active_users' => User::where('uStatus', 'active')->count(), // Simplified
        ];
    }

    private function getGeographicStats()
    {
        // This would require location data in users table
        return [
            'top_countries' => [
                ['country' => 'Vietnam', 'users' => User::count()],
            ]
        ];
    }

    private function getCourseRevenueStats($days)
    {
        // This would require payment/revenue tracking
        return [
            'total_revenue' => 0,
            'revenue_this_period' => 0,
            'avg_revenue_per_course' => 0,
        ];
    }

    private function getCourseCreationTrend($days)
    {
        $trend = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $date = now()->subDays($i)->toDateString();
            $count = Course::whereDate('cCreated_at', $date)->count();
            $trend[] = [
                'date' => $date,
                'courses_created' => $count
            ];
        }
        return $trend;
    }

    private function getTestActivity($days)
    {
        $totalTests = TestAssignment::where('created_at', '>=', now()->subDays($days))->count();
        $completedTests = Submission::where('sSubmit_time', '>=', now()->subDays($days))->count();

        return [
            'tests_assigned' => $totalTests,
            'tests_completed' => $completedTests,
            'completion_rate' => $totalTests > 0 ? round(($completedTests / $totalTests) * 100, 2) : 0,
        ];
    }

    private function getContentActivity($days)
    {
        return [
            'posts_created' => Post::where('pCreated_at', '>=', now()->subDays($days))->count(),
            'posts_approved' => Post::where('pApproved_at', '>=', now()->subDays($days))->count(),
            'exams_created' => Exam::where('eCreated_at', '>=', now()->subDays($days))->count(),
        ];
    }

    private function getUserEngagement($days)
    {
        // This would require more detailed tracking
        return [
            'avg_session_duration' => '25 minutes', // Placeholder
            'bounce_rate' => '15%', // Placeholder
            'pages_per_session' => 8.5, // Placeholder
        ];
    }

    private function getUsagePatterns($days)
    {
        $peakHours = $this->getPeakHoursAnalysis($days);
        $peakHour = collect($peakHours)->sortByDesc('activity_level')->first();

        $peakDay = Submission::where('sSubmit_time', '>=', now()->subDays($days))
            ->selectRaw('DAYNAME(sSubmit_time) as day_name, COUNT(*) as total')
            ->groupBy('day_name')
            ->orderByDesc('total')
            ->first();

        $testsCount = Submission::where('sSubmit_time', '>=', now()->subDays($days))->count();
        $contentCount = Post::where('pCreated_at', '>=', now()->subDays($days))->count()
            + Exam::where('eCreated_at', '>=', now()->subDays($days))->count();
        $enrollCount = DB::table('course_enrollments')
            ->where('enrolled_at', '>=', now()->subDays($days))
            ->count();

        $mostUsedFeature = 'Test Taking';
        if ($contentCount > $testsCount && $contentCount >= $enrollCount) {
            $mostUsedFeature = 'Content Creation';
        } elseif ($enrollCount > $testsCount && $enrollCount > $contentCount) {
            $mostUsedFeature = 'Course Enrollment';
        }

        return [
            'peak_usage_day' => $peakDay->day_name ?? 'N/A',
            'peak_usage_hour' => ($peakHour['hour'] ?? '00:00'),
            'most_used_feature' => $mostUsedFeature,
        ];
    }

    private function getPeakHoursAnalysis($days)
    {
        $hourly = Submission::where('sSubmit_time', '>=', now()->subDays($days))
            ->selectRaw('HOUR(sSubmit_time) as hour, COUNT(*) as total')
            ->groupBy('hour')
            ->pluck('total', 'hour');

        $hours = [];
        for ($i = 0; $i < 24; $i++) {
            $hours[] = [
                'hour' => sprintf('%02d:00', $i),
                'activity_level' => (int) ($hourly[$i] ?? 0)
            ];
        }
        return $hours;
    }

    private function getGrowthTrends($days)
    {
        $recentWindow = max(1, intdiv($days, 2));
        $previousStart = now()->subDays($days);
        $recentStart = now()->subDays($recentWindow);

        $usersRecent = User::where('uCreated_at', '>=', $recentStart)->whereNull('uDeleted_at')->count();
        $usersPrevious = User::whereBetween('uCreated_at', [$previousStart, $recentStart])->whereNull('uDeleted_at')->count();

        $coursesRecent = Course::where('cCreated_at', '>=', $recentStart)->count();
        $coursesPrevious = Course::whereBetween('cCreated_at', [$previousStart, $recentStart])->count();

        $engRecent = Submission::where('sSubmit_time', '>=', $recentStart)->count();
        $engPrevious = Submission::whereBetween('sSubmit_time', [$previousStart, $recentStart])->count();

        return [
            'user_growth_rate' => $this->calculateGrowthRate($usersRecent, $usersPrevious),
            'course_growth_rate' => $this->calculateGrowthRate($coursesRecent, $coursesPrevious),
            'engagement_growth_rate' => $this->calculateGrowthRate($engRecent, $engPrevious),
        ];
    }

    private function getUsageTrends($days)
    {
        return [
            'test_taking_trend' => 'increasing',
            'course_enrollment_trend' => 'stable',
            'content_creation_trend' => 'increasing',
        ];
    }

    private function getPerformanceTrends($days)
    {
        return [
            'avg_score_trend' => 'improving',
            'completion_rate_trend' => 'stable',
            'user_satisfaction_trend' => 'improving',
        ];
    }

    private function getSeasonalPatterns($days)
    {
        return [
            'peak_season' => 'September - December',
            'low_season' => 'June - August',
            'seasonal_variance' => '35%',
        ];
    }

    private function generatePredictions($days)
    {
        $dailyUsers = User::where('uCreated_at', '>=', now()->subDays($days))
            ->whereNull('uDeleted_at')
            ->count() / max(1, $days);
        $dailyCourses = Course::where('cCreated_at', '>=', now()->subDays($days))->count() / max(1, $days);
        $dailyTests = Submission::where('sSubmit_time', '>=', now()->subDays($days))->count() / max(1, $days);

        return [
            'next_month_users' => (int) round(User::whereNull('uDeleted_at')->count() + ($dailyUsers * 30)),
            'next_month_courses' => (int) round(Course::count() + ($dailyCourses * 30)),
            'next_month_tests' => (int) round(Submission::count() + ($dailyTests * 30)),
        ];
    }

    private function getLoginsCount($date)
    {
        return Submission::whereDate('sSubmit_time', $date)->count()
            + User::whereDate('uCreated_at', $date)->whereNull('uDeleted_at')->count();
    }

    private function getAdminTimeline($days)
    {
        $timeline = [];

        for ($i = $days - 1; $i >= 0; $i--) {
            $date = now()->subDays($i)->toDateString();
            $timeline[] = [
                'date' => $date,
                'new_users' => User::whereDate('uCreated_at', $date)->whereNull('uDeleted_at')->count(),
                'submissions' => Submission::whereDate('sSubmit_time', $date)->count(),
                'new_enrollments' => DB::table('course_enrollments')->whereDate('enrolled_at', $date)->count(),
                'posts_created' => Post::whereDate('pCreated_at', $date)->count(),
            ];
        }

        return $timeline;
    }

    private function getServerHealthMetrics()
    {
        $dbStart = microtime(true);
        DB::select('SELECT 1');
        $dbLatencyMs = round((microtime(true) - $dbStart) * 1000, 2);

        $load = function_exists('sys_getloadavg') ? sys_getloadavg() : null;
        $cpuLoad = is_array($load) ? (float) ($load[0] ?? 0) : 0;
        $cpuCores = $this->getCpuCores();
        $cpuPercent = (int) max(0, min(100, round(($cpuLoad / max(1, $cpuCores)) * 100)));

        $memoryLimitMb = $this->toMb((string) ini_get('memory_limit'));
        $memoryUsageMb = memory_get_usage(true) / 1024 / 1024;
        $ramPercent = $memoryLimitMb > 0
            ? (int) max(0, min(100, round(($memoryUsageMb / $memoryLimitMb) * 100)))
            : 0;

        $diskTotal = @disk_total_space(base_path()) ?: 0;
        $diskFree = @disk_free_space(base_path()) ?: 0;
        $diskUsedPercent = $diskTotal > 0
            ? (int) max(0, min(100, round((($diskTotal - $diskFree) / $diskTotal) * 100)))
            : 0;

        $activeUsers = User::where('uStatus', 'active')->whereNull('uDeleted_at')->count();
        $todayTraffic = $this->getLoginsCount(today());
        $networkPercent = (int) max(0, min(100, round(($todayTraffic / max(1, $activeUsers)) * 100)));

        return [
            'cpu' => $cpuPercent,
            'ram' => $ramPercent,
            'disk' => $diskUsedPercent,
            'network' => $networkPercent,
            'db_latency_ms' => $dbLatencyMs,
            'uptime' => $this->getPerformanceMetrics()['system_uptime'] ?? 'N/A',
        ];
    }

    private function calculateGrowthRate($current, $previous)
    {
        if ((int) $previous === 0) {
            return (int) $current > 0 ? 100 : 0;
        }

        return round((($current - $previous) / $previous) * 100, 2);
    }

    private function getCpuCores()
    {
        $cores = (int) @shell_exec('nproc 2>/dev/null');
        return $cores > 0 ? $cores : 4;
    }

    private function toMb(string $memoryLimit): int
    {
        $value = trim($memoryLimit);
        if ($value === '' || $value === '-1') {
            return 0;
        }

        $number = (int) $value;
        $unit = strtolower(substr($value, -1));

        switch ($unit) {
            case 'g':
                return $number * 1024;
            case 'k':
                return (int) round($number / 1024);
            case 'm':
                return $number;
            default:
                return (int) round($number / 1024 / 1024);
        }
    }

    private function getReportData($type, $period)
    {
        $request = request();
        $request->merge(['period' => $period]);

        switch ($type) {
            case 'users':
                return $this->userStatistics($request)->getData()->data;
            case 'courses':
                return $this->courseStatistics($request)->getData()->data;
            case 'activity':
                return $this->activityReport($request)->getData()->data;
            case 'trends':
                return $this->trendsAnalysis($request)->getData()->data;
            default:
                return $this->dashboard($request)->getData()->data;
        }
    }

    /**
     * Flatten any nested array/object into "dot.notation" => scalar map
     * for CSV export.
     */
    private function flattenForCsv($data, $prefix = '')
    {
        $rows = [];
        if (!is_array($data) && !is_object($data)) {
            $rows[$prefix !== '' ? $prefix : 'value'] = is_bool($data) ? ($data ? 'true' : 'false') : (string) $data;
            return $rows;
        }
        $arr = is_object($data) ? (array) $data : $data;
        foreach ($arr as $k => $v) {
            $key = $prefix === '' ? (string) $k : $prefix . '.' . $k;
            if (is_array($v) || is_object($v)) {
                $rows = array_merge($rows, $this->flattenForCsv($v, $key));
            } else {
                $rows[$key] = is_bool($v) ? ($v ? 'true' : 'false') : (string) ($v ?? '');
            }
        }
        return $rows;
    }

    private function exportToCsv($data, $type)
    {
        $flat = $this->flattenForCsv($data);
        $filename = 'report_' . $type . '_' . date('Ymd_His') . '.csv';

        $headers = [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control'       => 'no-store, no-cache',
        ];

        $callback = function () use ($flat, $type) {
            $out = fopen('php://output', 'w');
            // BOM for Excel UTF-8
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['type', $type]);
            fputcsv($out, ['generated_at', now()->toDateTimeString()]);
            fputcsv($out, []);
            fputcsv($out, ['key', 'value']);
            foreach ($flat as $k => $v) {
                fputcsv($out, [$k, $v]);
            }
            fclose($out);
        };

        return response()->stream($callback, 200, $headers);
    }

    private function exportToPdf($data, $type)
    {
        // PDF export — fallback to JSON until a PDF library is added.
        return response()->json([
            'status' => 'success',
            'message' => 'PDF export sẽ được implement trong phiên bản sau',
            'data' => $data,
            'type' => $type,
        ]);
    }
}

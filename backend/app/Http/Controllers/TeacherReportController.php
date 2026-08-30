<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Models\Classes;
use App\Models\Exam;
use App\Models\Submission;
use App\Support\ScoreScale;

/**
 * @OA\Tag(
 *     name="Teacher Reports",
 *     description="Teacher reports and analytics API endpoints"
 * )
 */
class TeacherReportController extends Controller
{
    /**
     * @OA\Get(
     *     path="/teacher/reports/overview",
     *     tags={"Teacher Reports"},
     *     summary="Get teacher reports overview",
     *     description="Get comprehensive reports overview for teacher",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="period",
     *         in="query",
     *         description="Time period (7days, 30days, 90days, year)",
     *         @OA\Schema(type="string", enum={"7days", "30days", "90days", "year"})
     *     ),
     *     @OA\Response(response=200, description="Reports overview retrieved successfully"),
     *     @OA\Response(response=401, description="Unauthorized")
     * )
     * 
     * GET /api/teacher/reports/overview
     * Tổng quan báo cáo cho giáo viên
     */
    public function overview(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $period = $request->get('period', '30days');
        $days = $this->getPeriodDays($period);
        $startDate = now()->subDays($days);

        // Get teacher's students (via class_id)
        $teacherClasses = Classes::where('cTeacher_id', $user->uId)->pluck('cId');
        $studentIds = User::whereIn('class_id', $teacherClasses)
                         ->where('uRole', 'student')
                         ->whereNull('uDeleted_at')
                         ->pluck('uId');

        // Get teacher's exams
        $teacherExams = Exam::where('eTeacher_id', $user->uId)->pluck('eId');

        // Overview metrics
        $overview = $this->getOverviewMetrics($user, $teacherClasses, $studentIds, $teacherExams, $startDate);

        // Activity timeline
        $activityTimeline = $this->getActivityTimeline($teacherExams, $studentIds, $days);

        // Exams by type
        $examsByType = $this->getExamsByType($teacherExams);

        // Top classes
        $topClasses = $this->getTopClasses($teacherClasses, $teacherExams, $days);

        // Top students
        $topStudents = $this->getTopStudents($studentIds, $teacherExams, $days);

        // Classes need attention
        $classesNeedAttention = $this->getClassesNeedAttention($teacherClasses, $teacherExams);

        // Score trend
        $scoreTrend = $this->getScoreTrend($teacherExams, 7);

        // P1: At-risk students (need intervention)
        $atRiskStudents = $this->getAtRiskStudents($studentIds, $teacherExams);

        // P1: Học viên trễ hạn — assignment đã quá hạn nhưng chưa nộp / chưa hoàn thành
        $overdueStudents = $this->getOverdueStudents($user->uId, $teacherClasses, $teacherExams);

        // P2: Top classes by improvement rate (current half vs previous half of period)
        $topImprovingClasses = $this->getTopImprovingClasses($teacherClasses, $teacherExams, $days);

        // P2: Skill weakness — only VSTEP/IELTS/Cambridge subjective + objective skills
        $skillBreakdown = $this->getSkillBreakdown($teacherExams, $startDate);

        // Auto-generated insights
        $insights = $this->generateInsights($overview, $classesNeedAttention, $scoreTrend);

        return response()->json([
            'status' => 'success',
            'data' => [
                'period' => $period,
                'overview' => $overview,
                'activity_timeline' => $activityTimeline,
                'exams_by_type' => $examsByType,
                'top_classes' => $topClasses,
                'top_students' => $topStudents,
                'classes_need_attention' => $classesNeedAttention,
                'at_risk_students' => $atRiskStudents,
                'overdue_students' => $overdueStudents,
                'top_improving_classes' => $topImprovingClasses,
                'skill_breakdown' => $skillBreakdown,
                'score_trend' => $scoreTrend,
                'insights' => $insights,
                'generated_at' => now()->toISOString()
            ]
        ]);
    }

    /**
     * @OA\Get(
     *     path="/teacher/students/progress",
     *     tags={"Teacher Reports"},
     *     summary="Get all students progress",
     *     description="Get detailed progress for all students across all classes",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="class_id",
     *         in="query",
     *         description="Filter by class ID (optional)",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Parameter(
     *         name="search",
     *         in="query",
     *         description="Search by student name",
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Parameter(
     *         name="sort_by",
     *         in="query",
     *         description="Sort field",
     *         @OA\Schema(type="string", enum={"name", "score", "progress", "attendance"})
     *     ),
     *     @OA\Parameter(
     *         name="sort_order",
     *         in="query",
     *         description="Sort order",
     *         @OA\Schema(type="string", enum={"asc", "desc"})
     *     ),
     *     @OA\Response(response=200, description="Students progress retrieved successfully")
     * )
     * 
     * GET /api/teacher/students/progress
     * Báo cáo tiến độ tất cả học sinh
     */
    public function studentsProgress(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        // Get query parameters
        $classId = $request->get('class_id');
        $search = $request->get('search');
        $sortBy = $request->get('sort_by', 'name');
        $sortOrder = $request->get('sort_order', 'asc');

        // Get teacher's classes
        $teacherClasses = Classes::where('cTeacher_id', $user->uId)->pluck('cId');

        // Build students query
        $studentsQuery = User::whereIn('class_id', $teacherClasses)
                            ->where('uRole', 'student')
                            ->whereNull('uDeleted_at');

        // Apply filters
        if ($classId) {
            $studentsQuery->where('class_id', $classId);
        }

        if ($search) {
            $studentsQuery->where('uName', 'like', '%' . $search . '%');
        }

        $students = $studentsQuery->get();

        // Get teacher's exams
        $teacherExams = Exam::where('eTeacher_id', $user->uId)->pluck('eId');

        // Calculate progress for each student
        $studentProgress = [];
        $totalTests = $teacherExams->count();

        foreach ($students as $student) {
            $class = Classes::find($student->class_id);
            
            // Get submissions
            // `with('exam')` là bắt buộc: ScoreScale phải đọc eType và
            // thpt_config của đề để biết sScore đang ở thang nào.
            $submissions = Submission::with('exam')
                                    ->where('user_id', $student->uId)
                                    ->whereIn('exam_id', $teacherExams)
                                    ->get();

            $gradedSubmissions = $submissions->where('sStatus', 'graded');
            $testsCompleted = $gradedSubmissions->count();
            // Quy về thang 10 trước khi tính trung bình. Cộng thẳng sScore sẽ
            // trộn phần trăm (đề GENERAL) với hệ 10 (đề THPT).
            $avgScore = ScoreScale::averageTen($gradedSubmissions) ?? 0;

            // Calculate attendance rate (mock for now - would need attendance table)
            $attendanceRate = $testsCompleted > 0 ? min(95, 70 + ($testsCompleted * 2)) : 0;

            // Calculate trend
            $recentSubmissions = $gradedSubmissions->where('sSubmit_time', '>=', now()->subDays(15));
            $olderSubmissions = $gradedSubmissions->where('sSubmit_time', '<', now()->subDays(15));

            $recentAvg = ScoreScale::averageTen($recentSubmissions) ?? 0;
            $olderAvg = ScoreScale::averageTen($olderSubmissions) ?? 0;
            
            $trend = 'stable';
            $trendValue = 0;
            
            if ($recentAvg > 0 && $olderAvg > 0) {
                $trendValue = round($recentAvg - $olderAvg, 1);
                if ($trendValue > 0.5) {
                    $trend = 'up';
                } elseif ($trendValue < -0.5) {
                    $trend = 'down';
                }
            }

            // Last activity
            $lastSubmission = $submissions->max('sSubmit_time');
            $lastActivity = 'Chưa có hoạt động';
            
            if ($lastSubmission) {
                $diffInHours = now()->diffInHours($lastSubmission);
                if ($diffInHours < 1) {
                    $lastActivity = 'Vừa xong';
                } elseif ($diffInHours < 24) {
                    $lastActivity = $diffInHours . ' giờ trước';
                } else {
                    $diffInDays = now()->diffInDays($lastSubmission);
                    $lastActivity = $diffInDays . ' ngày trước';
                }
            }

            $studentProgress[] = [
                'uId' => $student->uId,
                'uName' => $student->uName,
                'uEmail' => $student->uEmail,
                'uPhone' => $student->uPhone,
                'uAvatar' => $student->uAvatar,
                'uClass_id' => $student->class_id,
                'className' => $class ? $class->cName : 'N/A',
                'testsCompleted' => $testsCompleted,
                'totalTests' => $totalTests,
                'avgScore' => round($avgScore, 1),
                'attendanceRate' => $attendanceRate,
                'lastActivity' => $lastActivity,
                'lastActivityDate' => $lastSubmission ? $lastSubmission->toISOString() : null,
                'scoreTrend' => $trend,
                'scoreTrendValue' => $trendValue
            ];
        }

        // Sort students
        usort($studentProgress, function($a, $b) use ($sortBy, $sortOrder) {
            $aValue = $a[$sortBy] ?? 0;
            $bValue = $b[$sortBy] ?? 0;
            
            if ($sortBy === 'name' || $sortBy === 'uName') {
                $aValue = $a['uName'];
                $bValue = $b['uName'];
                $result = strcmp($aValue, $bValue);
            } elseif ($sortBy === 'score') {
                $result = $b['avgScore'] <=> $a['avgScore'];
            } elseif ($sortBy === 'progress') {
                $aProgress = $a['totalTests'] > 0 ? ($a['testsCompleted'] / $a['totalTests']) : 0;
                $bProgress = $b['totalTests'] > 0 ? ($b['testsCompleted'] / $b['totalTests']) : 0;
                $result = $bProgress <=> $aProgress;
            } elseif ($sortBy === 'attendance') {
                $result = $b['attendanceRate'] <=> $a['attendanceRate'];
            } else {
                $result = 0;
            }
            
            return $sortOrder === 'asc' ? $result : -$result;
        });

        // Calculate summary statistics
        $totalStudents = count($studentProgress);
        $avgScore = $totalStudents > 0 ? collect($studentProgress)->avg('avgScore') : 0;
        $completionRate = $totalStudents > 0 && $totalTests > 0 
            ? (collect($studentProgress)->sum('testsCompleted') / ($totalStudents * $totalTests)) * 100 
            : 0;
        $avgAttendance = $totalStudents > 0 ? collect($studentProgress)->avg('attendanceRate') : 0;

        // Calculate changes (mock data - would need historical tracking)
        $changes = [
            'students' => 12,
            'score' => 0.3,
            'completion' => 5,
            'attendance' => 2
        ];

        return response()->json([
            'status' => 'success',
            'data' => [
                'summary' => [
                    'totalStudents' => $totalStudents,
                    'avgScore' => round($avgScore, 1),
                    'completionRate' => round($completionRate, 0),
                    'avgAttendance' => round($avgAttendance, 0),
                    'changes' => $changes
                ],
                'students' => $studentProgress
            ]
        ]);
    }

    /**
     * @OA\Get(
     *     path="/teacher/reports/student-progress",
     *     tags={"Teacher Reports"},
     *     summary="Get student progress report",
     *     description="Get detailed student progress for a class",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="class_id",
     *         in="query",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Parameter(
     *         name="period",
     *         in="query",
     *         @OA\Schema(type="string", enum={"7days", "30days", "90days"})
     *     ),
     *     @OA\Response(response=200, description="Student progress retrieved successfully")
     * )
     * 
     * GET /api/teacher/reports/student-progress
     * Báo cáo tiến độ học viên
     */
    public function studentProgress(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $classId = $request->get('class_id');
        $period = $request->get('period', '30days');
        $days = $this->getPeriodDays($period);

        // Verify teacher owns this class
        $class = Classes::where('cId', $classId)
                       ->where('cTeacher_id', $user->uId)
                       ->first();

        if (!$class) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy lớp học.'
            ], 404);
        }

        // Get students in class
        $students = User::where('class_id', $classId)
                       ->where('uRole', 'student')
                       ->whereNull('uDeleted_at')
                       ->get();

        $teacherExams = Exam::where('eTeacher_id', $user->uId)->pluck('eId');

        $studentProgress = [];
        foreach ($students as $student) {
            $submissions = Submission::with('exam')
                                    ->where('user_id', $student->uId)
                                    ->whereIn('exam_id', $teacherExams)
                                    ->where('sSubmit_time', '>=', now()->subDays($days))
                                    ->get();

            $gradedSubmissions = $submissions->where('sStatus', 'graded');
            $avgScore = ScoreScale::averageTen($gradedSubmissions) ?? 0;

            $studentProgress[] = [
                'student_id' => $student->uId,
                'student_name' => $student->uName,
                'total_submissions' => $submissions->count(),
                'avg_score' => round($avgScore, 1),
                'progress_trend' => $this->calculateTrend($student->uId, $teacherExams, $days),
                'last_submission' => $submissions->max('sSubmit_time'),
                'completion_rate' => $this->calculateCompletionRate($student->uId, $teacherExams, $days)
            ];
        }

        // Sort by avg_score desc
        usort($studentProgress, function($a, $b) {
            return $b['avg_score'] <=> $a['avg_score'];
        });

        return response()->json([
            'status' => 'success',
            'data' => [
                'class_info' => [
                    'class_id' => $class->cId,
                    'class_name' => $class->cName,
                    'total_students' => $students->count()
                ],
                'students' => $studentProgress,
                'class_avg_score' => round(collect($studentProgress)->avg('avg_score'), 1),
                'class_completion_rate' => round(collect($studentProgress)->avg('completion_rate'), 1)
            ]
        ]);
    }

    /* ========================================
     * PRIVATE HELPER METHODS
     * ======================================== */

    private function getPeriodDays($period)
    {
        switch ($period) {
            case '7days': return 7;
            case '30days': return 30;
            case '90days': return 90;
            case 'year': return 365;
            default: return 30;
        }
    }

    private function getOverviewMetrics($user, $teacherClasses, $studentIds, $teacherExams, $startDate)
    {
        $totalStudents = $studentIds->count();
        $totalClasses = $teacherClasses->count();
        $totalExams = $teacherExams->count();

        $submissions = Submission::with('exam')
                                ->whereIn('exam_id', $teacherExams)
                                ->where('sSubmit_time', '>=', $startDate)
                                ->get();

        $totalSubmissions = $submissions->count();
        $gradedSubmissions = $submissions->where('sStatus', 'graded');
        $avgScore = ScoreScale::averageTen($gradedSubmissions) ?? 0;

        // Calculate growth (compare with previous period)
        $previousPeriodStart = $startDate->copy()->subDays($startDate->diffInDays(now()));
        $previousSubmissions = Submission::with('exam')
                                        ->whereIn('exam_id', $teacherExams)
                                        ->whereBetween('sSubmit_time', [$previousPeriodStart, $startDate])
                                        ->get();

        $previousAvgScore = ScoreScale::averageTen($previousSubmissions->where('sStatus', 'graded')) ?? 0;

        return [
            'total_students' => $totalStudents,
            'total_classes' => $totalClasses,
            'total_exams' => $totalExams,
            'total_submissions' => $totalSubmissions,
            'avg_score' => round($avgScore, 1),
            'growth' => [
                'students' => 0, // Would need historical data
                'classes' => 0,
                'exams' => 0,
                'submissions' => $totalSubmissions - $previousSubmissions->count(),
                'avg_score' => round($avgScore - $previousAvgScore, 1)
            ]
        ];
    }

    private function getActivityTimeline($teacherExams, $studentIds, $days)
    {
        $timeline = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $date = now()->subDays($i)->toDateString();
            
            $daySubmissions = Submission::whereIn('exam_id', $teacherExams)
                                       ->whereDate('sSubmit_time', $date)
                                       ->get();

            $timeline[] = [
                'date' => $date,
                'submissions' => $daySubmissions->count(),
                'graded' => $daySubmissions->where('sStatus', 'graded')->count(),
                'active_students' => $daySubmissions->pluck('user_id')->unique()->count()
            ];
        }

        return $timeline;
    }

    private function getExamsByType($teacherExams)
    {
        $exams = Exam::whereIn('eId', $teacherExams)->get();
        
        $byType = [
            'vstep' => 0,
            'cambridge' => 0,
            'ielts' => 0,
            'toefl' => 0,
            'other' => 0
        ];

        foreach ($exams as $exam) {
            $type = strtolower($exam->eType ?? 'other');
            if (isset($byType[$type])) {
                $byType[$type]++;
            } else {
                $byType['other']++;
            }
        }

        return $byType;
    }

    private function getTopClasses($teacherClasses, $teacherExams, $days)
    {
        $classes = Classes::whereIn('cId', $teacherClasses)->get();
        $topClasses = [];

        foreach ($classes as $class) {
            $studentIds = User::where('class_id', $class->cId)
                             ->where('uRole', 'student')
                             ->whereNull('uDeleted_at')
                             ->pluck('uId');

            $submissions = Submission::with('exam')
                                    ->whereIn('exam_id', $teacherExams)
                                    ->whereIn('user_id', $studentIds)
                                    ->where('sSubmit_time', '>=', now()->subDays($days))
                                    ->get();

            $gradedSubmissions = $submissions->where('sStatus', 'graded');
            $pendingCount = $submissions->whereIn('sStatus', ['submitted', 'partially_graded'])->count();

            $topClasses[] = [
                'class_id' => $class->cId,
                'class_name' => $class->cName,
                'total_submissions' => $submissions->count(),
                'avg_score' => round(ScoreScale::averageTen($gradedSubmissions) ?? 0, 1),
                'pending_count' => $pendingCount
            ];
        }

        // Sort by total_submissions desc
        usort($topClasses, function($a, $b) {
            return $b['total_submissions'] <=> $a['total_submissions'];
        });

        return array_slice($topClasses, 0, 5);
    }

    private function getTopStudents($studentIds, $teacherExams, $days)
    {
        $students = User::whereIn('uId', $studentIds)->get();
        $topStudents = [];

        foreach ($students as $student) {
            $submissions = Submission::with('exam')
                                    ->where('user_id', $student->uId)
                                    ->whereIn('exam_id', $teacherExams)
                                    ->where('sSubmit_time', '>=', now()->subDays($days))
                                    ->where('sStatus', 'graded')
                                    ->get();

            if ($submissions->count() > 0) {
                $class = Classes::find($student->class_id);
                
                $topStudents[] = [
                    'student_id' => $student->uId,
                    'student_name' => $student->uName,
                    'class_name' => $class ? $class->cName : 'N/A',
                    'total_submissions' => $submissions->count(),
                    'avg_score' => round(ScoreScale::averageTen($submissions) ?? 0, 1)
                ];
            }
        }

        // Sort by avg_score desc
        usort($topStudents, function($a, $b) {
            return $b['avg_score'] <=> $a['avg_score'];
        });

        return array_slice($topStudents, 0, 10);
    }

    private function getClassesNeedAttention($teacherClasses, $teacherExams)
    {
        $classes = Classes::whereIn('cId', $teacherClasses)->get();
        $needAttention = [];

        foreach ($classes as $class) {
            $studentIds = User::where('class_id', $class->cId)
                             ->where('uRole', 'student')
                             ->whereNull('uDeleted_at')
                             ->pluck('uId');

            $submissions = Submission::with('exam')
                                    ->whereIn('exam_id', $teacherExams)
                                    ->whereIn('user_id', $studentIds)
                                    ->get();

            $pendingCount = $submissions->whereIn('sStatus', ['submitted', 'partially_graded'])->count();
            $gradedSubmissions = $submissions->where('sStatus', 'graded');
            // Ngưỡng "điểm TB thấp" dưới đây là 7.0 — chỉ đúng khi điểm đã quy
            // về thang 10. Trước đây trung bình đề GENERAL là phần trăm nên
            // mọi lớp có điểm > 7% đều thoát ngưỡng này.
            $avgScore = ScoreScale::averageTen($gradedSubmissions) ?? 0;

            $reason = '';
            if ($pendingCount > 10) {
                $reason = 'Nhiều bài chờ chấm';
            } elseif ($avgScore < 7.0 && $avgScore > 0) {
                $reason = 'Điểm TB thấp';
            } elseif ($submissions->where('sSubmit_time', '>=', now()->subDays(7))->count() === 0) {
                $reason = 'Không có hoạt động gần đây';
            }

            if ($reason) {
                $needAttention[] = [
                    'class_id' => $class->cId,
                    'class_name' => $class->cName,
                    'pending_count' => $pendingCount,
                    'avg_score' => round($avgScore, 1),
                    'reason' => $reason
                ];
            }
        }

        // Sort by pending_count desc
        usort($needAttention, function($a, $b) {
            return $b['pending_count'] <=> $a['pending_count'];
        });

        return array_slice($needAttention, 0, 5);
    }

    private function getScoreTrend($teacherExams, $days)
    {
        $trend = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $date = now()->subDays($i)->toDateString();
            
            // Phải lấy bản ghi về rồi quy đổi, không dùng ->avg() ở tầng SQL:
            // thang điểm nằm trong `exams.eType`/`thpt_config` nên SQL không biết
            // sScore đang là phần trăm hay hệ 10.
            $daySubmissions = Submission::with('exam')
                                 ->whereIn('exam_id', $teacherExams)
                                 ->whereDate('sSubmit_time', $date)
                                 ->where('sStatus', 'graded')
                                 ->get();
            $avgScore = ScoreScale::averageTen($daySubmissions) ?? 0;

            $trend[] = [
                'date' => $date,
                'avg_score' => round($avgScore, 1)
            ];
        }

        return $trend;
    }

    private function generateInsights($overview, $classesNeedAttention, $scoreTrend)
    {
        $insights = [];

        // Warning: Classes with many pending submissions
        foreach ($classesNeedAttention as $class) {
            if ($class['pending_count'] > 10) {
                $insights[] = [
                    'type' => 'warning',
                    'icon' => 'alert-circle',
                    'message' => "Lớp {$class['class_name']} có {$class['pending_count']} bài chờ chấm - cần ưu tiên"
                ];
            }
        }

        // Success: Score improvement
        if (count($scoreTrend) >= 2) {
            $latestScore = end($scoreTrend)['avg_score'];
            $previousScore = $scoreTrend[count($scoreTrend) - 2]['avg_score'];
            $improvement = $latestScore - $previousScore;

            if ($improvement > 0.3) {
                $insights[] = [
                    'type' => 'success',
                    'icon' => 'trending-up',
                    'message' => "Điểm TB tăng " . round($improvement, 1) . " so với ngày trước"
                ];
            } elseif ($improvement < -0.3) {
                $insights[] = [
                    'type' => 'warning',
                    'icon' => 'trending-down',
                    'message' => "Điểm TB giảm " . round(abs($improvement), 1) . " so với ngày trước"
                ];
            }
        }

        // Info: Overall stats
        $insights[] = [
            'type' => 'info',
            'icon' => 'users',
            'message' => "Tổng {$overview['total_students']} học viên trong {$overview['total_classes']} lớp học"
        ];

        return $insights;
    }

    private function calculateTrend($studentId, $teacherExams, $days)
    {
        $halfDays = intdiv($days, 2);
        
        $recentScore = ScoreScale::averageTen(
            Submission::with('exam')
                ->where('user_id', $studentId)
                ->whereIn('exam_id', $teacherExams)
                ->where('sSubmit_time', '>=', now()->subDays($halfDays))
                ->where('sStatus', 'graded')
                ->get()
        ) ?? 0;

        $previousScore = ScoreScale::averageTen(
            Submission::with('exam')
                ->where('user_id', $studentId)
                ->whereIn('exam_id', $teacherExams)
                ->whereBetween('sSubmit_time', [now()->subDays($days), now()->subDays($halfDays)])
                ->where('sStatus', 'graded')
                ->get()
        ) ?? 0;

        if ($recentScore > $previousScore + 0.5) {
            return 'improving';
        } elseif ($recentScore < $previousScore - 0.5) {
            return 'declining';
        } else {
            return 'stable';
        }
    }

    private function calculateCompletionRate($studentId, $teacherExams, $days)
    {
        $totalAssignments = Submission::where('user_id', $studentId)
                                     ->whereIn('exam_id', $teacherExams)
                                     ->where('sSubmit_time', '>=', now()->subDays($days))
                                     ->count();

        $completedAssignments = Submission::where('user_id', $studentId)
                                         ->whereIn('exam_id', $teacherExams)
                                         ->where('sSubmit_time', '>=', now()->subDays($days))
                                         ->where('sStatus', 'graded')
                                         ->count();

        if ($totalAssignments === 0) {
            return 0;
        }

        return round(($completedAssignments / $totalAssignments) * 100, 0);
    }

    /**
     * P1: At-risk students — học viên cần can thiệp.
     * Reasons: low_score (3 bài gần nhất TB <5), inactive (>14d không hoạt động),
     *          declining_trend (3 bài gần nhất TB thấp hơn trước >0.5).
     *
     * "Hoạt động" được tính là MAX(lần nộp bài cuối, lần đăng nhập cuối).
     * Học viên đăng nhập trong vòng 5 phút sẽ được coi là đang online (is_online=true)
     * và được loại khỏi reason 'inactive' kể cả khi lâu không nộp bài.
     */
    private function getAtRiskStudents($studentIds, $teacherExams)
    {
        if ($studentIds->isEmpty() || $teacherExams->isEmpty()) {
            return [];
        }

        $students = User::whereIn('uId', $studentIds)
                        ->whereNull('uDeleted_at')
                        ->get();
        $atRisk = [];
        $onlineThresholdMin = 5; // <=5 minutes since last login => considered online

        foreach ($students as $student) {
            $allSubmissions = Submission::where('user_id', $student->uId)
                ->whereIn('exam_id', $teacherExams)
                ->orderBy('sSubmit_time', 'desc')
                ->get();

            $reasons = [];

            // Last submission time
            $lastSubmission = $allSubmissions->first();
            $lastSubmitAt = $lastSubmission ? $lastSubmission->sSubmit_time : null;

            // Last login time (from users.uLast_login)
            $lastLoginAt = $student->uLast_login ?: null;

            // Effective last activity = max(submission, login)
            $lastActiveAt = null;
            if ($lastSubmitAt && $lastLoginAt) {
                $lastActiveAt = strtotime($lastSubmitAt) > strtotime($lastLoginAt) ? $lastSubmitAt : $lastLoginAt;
            } else {
                $lastActiveAt = $lastSubmitAt ?: $lastLoginAt;
            }

            $daysSinceActive = $lastActiveAt ? now()->diffInDays($lastActiveAt) : null;

            // Online status: login trong vòng 5 phút
            $isOnline = false;
            if ($lastLoginAt) {
                $minutesSinceLogin = now()->diffInMinutes($lastLoginAt);
                $isOnline = $minutesSinceLogin <= $onlineThresholdMin;
            }

            // Reason: inactive (>14 days) — bỏ qua nếu đang online
            if (!$isOnline && ($daysSinceActive === null || $daysSinceActive > 14)) {
                $reasons[] = 'inactive';
            }

            // Last 3 graded submissions
            // Ngưỡng low_score (< 5.0) và declining_trend (> 0.5) là ngưỡng hệ 10,
            // nên phải quy đổi trước khi so. Đề GENERAL lưu phần trăm nên trước
            // đây học viên 30% vẫn được coi là an toàn.
            $recentGraded = $allSubmissions->where('sStatus', 'graded')->take(3);
            $recentAvg = $recentGraded->count() >= 3 ? ScoreScale::averageTen($recentGraded) : null;

            // Reason: low_score (TB 3 bài gần nhất < 5.0)
            if ($recentAvg !== null && $recentAvg < 5.0) {
                $reasons[] = 'low_score';
            }

            // Reason: declining_trend
            $olderGraded = $allSubmissions->where('sStatus', 'graded')->slice(3, 3);
            $olderAvg = $olderGraded->count() >= 2 ? ScoreScale::averageTen($olderGraded) : null;
            if ($recentAvg !== null && $olderAvg !== null && ($olderAvg - $recentAvg) > 0.5) {
                $reasons[] = 'declining_trend';
            }

            if (count($reasons) === 0) continue;

            $class = Classes::find($student->class_id);
            $atRisk[] = [
                'student_id'         => $student->uId,
                'student_name'       => $student->uName,
                'avatar_url'         => $student->avatar_url,
                'class_name'         => $class ? $class->cName : 'N/A',
                'avg_score_recent_3' => $recentAvg !== null ? round($recentAvg, 1) : null,
                'last_activity_at'   => $lastActiveAt ? (string) $lastActiveAt : null,
                'last_login_at'      => $lastLoginAt ? (string) $lastLoginAt : null,
                'is_online'          => $isOnline,
                'days_inactive'      => $daysSinceActive,
                'reasons'            => $reasons,
            ];
        }

        // Sort: low_score first, then inactive, then declining; tie-break by lowest recent avg
        usort($atRisk, function ($a, $b) {
            $scoreA = $a['avg_score_recent_3'] ?? 999;
            $scoreB = $b['avg_score_recent_3'] ?? 999;
            return $scoreA <=> $scoreB;
        });

        return array_slice($atRisk, 0, 10);
    }

    /**
     * P2: Top classes by improvement — chia period làm 2 nửa, tính chênh lệch điểm TB.
     * Loại các lớp có < 5 bài graded trong 1 nửa để tránh kết quả không đáng tin.
     */
    private function getTopImprovingClasses($teacherClasses, $teacherExams, $days)
    {
        if ($teacherClasses->isEmpty() || $teacherExams->isEmpty()) {
            return [];
        }

        $classes = Classes::whereIn('cId', $teacherClasses)->get();
        $halfDays = intdiv($days, 2);
        $midPoint = now()->subDays($halfDays);
        $startPoint = now()->subDays($days);
        $result = [];

        foreach ($classes as $class) {
            $studentIds = User::where('class_id', $class->cId)
                ->where('uRole', 'student')
                ->whereNull('uDeleted_at')
                ->pluck('uId');
            if ($studentIds->isEmpty()) continue;

            $firstHalf = Submission::with('exam')
                ->whereIn('exam_id', $teacherExams)
                ->whereIn('user_id', $studentIds)
                ->where('sStatus', 'graded')
                ->whereBetween('sSubmit_time', [$startPoint, $midPoint])
                ->get();

            $secondHalf = Submission::with('exam')
                ->whereIn('exam_id', $teacherExams)
                ->whereIn('user_id', $studentIds)
                ->where('sStatus', 'graded')
                ->where('sSubmit_time', '>=', $midPoint)
                ->get();

            // Min sample size to be reliable
            if ($firstHalf->count() < 5 || $secondHalf->count() < 5) continue;

            // Quy về thang 10 — không thì mức "tiến bộ" của lớp chỉ phản ánh việc
            // lớp đó chuyển từ làm đề THPT (hệ 10) sang đề GENERAL (phần trăm).
            $avgFirst = round(ScoreScale::averageTen($firstHalf) ?? 0, 2);
            $avgSecond = round(ScoreScale::averageTen($secondHalf) ?? 0, 2);
            $improvement = round($avgSecond - $avgFirst, 1);

            $result[] = [
                'class_id'         => $class->cId,
                'class_name'       => $class->cName,
                'student_count'    => $studentIds->count(),
                'first_half_avg'   => $avgFirst,
                'second_half_avg'  => $avgSecond,
                'improvement'      => $improvement,
                'submission_count' => $firstHalf->count() + $secondHalf->count(),
            ];
        }

        // Sort by improvement desc, tie-break by submission_count desc
        usort($result, function ($a, $b) {
            if ($a['improvement'] === $b['improvement']) {
                return $b['submission_count'] <=> $a['submission_count'];
            }
            return $b['improvement'] <=> $a['improvement'];
        });

        return array_slice($result, 0, 5);
    }

    /**
     * P2: Skill breakdown — điểm TB từng skill (Listening / Reading / Writing / Speaking).
     * Chỉ tính trên submission đã chấm trong period, dựa trên submission_answers + questions.qSkill.
     */
    private function getSkillBreakdown($teacherExams, $startDate)
    {
        if ($teacherExams->isEmpty()) {
            return [
                'listening' => ['avg_score' => null, 'submission_count' => 0],
                'reading'   => ['avg_score' => null, 'submission_count' => 0],
                'writing'   => ['avg_score' => null, 'submission_count' => 0],
                'speaking'  => ['avg_score' => null, 'submission_count' => 0],
            ];
        }

        // For VSTEP exams, the per-skill scores are already in sGemini_feedback.vstep_scores
        // For others, fall back to mean of saPoints_awarded grouped by question.qSkill.
        $skills = ['listening', 'reading', 'writing', 'speaking'];
        $result = [];

        // Submissions in period that are graded
        $submissions = Submission::whereIn('exam_id', $teacherExams)
            ->where('sStatus', 'graded')
            ->where('sSubmit_time', '>=', $startDate)
            ->get();

        foreach ($skills as $sk) {
            $scores = [];
            foreach ($submissions as $sub) {
                $raw = $sub->sGemini_feedback;
                if (is_string($raw)) $raw = json_decode($raw, true);
                $vstepScore = $raw['vstep_scores'][$sk] ?? null;
                if (is_numeric($vstepScore)) {
                    $scores[] = (float) $vstepScore;
                }
            }

            $result[$sk] = [
                'avg_score'        => count($scores) > 0 ? round(array_sum($scores) / count($scores), 1) : null,
                'submission_count' => count($scores),
            ];
        }

        return $result;
    }

    /**
     * P1: Học viên trễ hạn — đề thi đã giao có deadline mà chưa nộp.
     * Quét test_assignments mà:
     *  - exam_id thuộc giáo viên này
     *  - taDeadline đã qua (hoặc sắp tới trong 24h cũng cảnh báo)
     *  - học viên chưa có submission cho exam này (hoặc submission chưa graded)
     */
    private function getOverdueStudents($teacherId, $teacherClasses, $teacherExams)
    {
        if ($teacherExams->isEmpty()) return [];

        // 1) Lấy mọi assignment có deadline thuộc đề của giáo viên này
        $assignments = DB::table('test_assignments')
            ->whereIn('exam_id', $teacherExams)
            ->whereNotNull('taDeadline')
            ->get();

        if ($assignments->isEmpty()) return [];

        $now = now();
        $rows = [];

        foreach ($assignments as $a) {
            // 2) Resolve target -> list student ids
            if ($a->taTarget_type === 'class') {
                if (!$teacherClasses->contains($a->taTarget_id)) continue;
                $targetStudentIds = User::where('class_id', $a->taTarget_id)
                    ->where('uRole', 'student')
                    ->whereNull('uDeleted_at')
                    ->pluck('uId');
            } else {
                // 'student' target
                $stu = User::where('uId', $a->taTarget_id)
                    ->where('uRole', 'student')
                    ->whereNull('uDeleted_at')
                    ->whereIn('class_id', $teacherClasses)
                    ->first();
                if (!$stu) continue;
                $targetStudentIds = collect([$stu->uId]);
            }

            $deadline = strtotime($a->taDeadline);
            $isOverdue = $deadline < $now->getTimestamp();
            $hoursLate = $isOverdue ? floor(($now->getTimestamp() - $deadline) / 3600) : 0;
            $hoursLeft = !$isOverdue ? floor(($deadline - $now->getTimestamp()) / 3600) : 0;

            // Only flag overdue (or due within 24h) cases
            if (!$isOverdue && $hoursLeft > 24) continue;

            // 3) For each student, check submission existence
            foreach ($targetStudentIds as $sid) {
                $hasSubmission = Submission::where('user_id', $sid)
                    ->where('exam_id', $a->exam_id)
                    ->whereIn('sStatus', ['graded', 'submitted', 'partially_graded', 'ai_graded'])
                    ->exists();

                if ($hasSubmission) continue;

                $student = User::find($sid);
                if (!$student) continue;
                $exam = Exam::find($a->exam_id);
                $class = Classes::find($student->class_id);

                $rows[] = [
                    'student_id'    => $student->uId,
                    'student_name'  => $student->uName,
                    'avatar_url'    => $student->avatar_url,
                    'class_name'    => $class ? $class->cName : '—',
                    'exam_id'       => $a->exam_id,
                    'exam_title'    => $exam ? $exam->eTitle : '—',
                    'deadline'      => $a->taDeadline,
                    'is_overdue'    => $isOverdue,
                    'hours_late'    => $isOverdue ? $hoursLate : null,
                    'hours_left'    => !$isOverdue ? $hoursLeft : null,
                ];
            }
        }

        // Sort: overdue first (longest late at top), then due-soon
        usort($rows, function ($a, $b) {
            if ($a['is_overdue'] !== $b['is_overdue']) {
                return $a['is_overdue'] ? -1 : 1;
            }
            if ($a['is_overdue']) {
                return $b['hours_late'] <=> $a['hours_late'];
            }
            return $a['hours_left'] <=> $b['hours_left'];
        });

        return array_slice($rows, 0, 10);
    }
}

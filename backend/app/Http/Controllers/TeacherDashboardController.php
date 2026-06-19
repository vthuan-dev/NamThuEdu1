<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\TestWebSocketService;
use App\Models\Submission;
use App\Models\TestAssignment;
use Carbon\Carbon;
use Illuminate\Support\Facades\Redis;

/**
 * @OA\Tag(
 *     name="Teacher Dashboard",
 *     description="Real-time teacher dashboard and monitoring API endpoints"
 * )
 */
class TeacherDashboardController extends Controller
{
    /**
     * @OA\Get(
     *     path="/teacher/dashboard/student-stats",
     *     tags={"Teacher Dashboard"},
     *     summary="Get student statistics for teacher",
     *     description="Get student counts and statistics for student management page",
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(response=200, description="Student statistics retrieved successfully")
     * )
     */
    public function getStudentStats(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Unauthorized'
            ], 401);
        }

        // Class system đã deprecated — count toàn bộ student trong hệ thống
        // (giáo viên hiện không còn "lớp riêng", hệ thống dùng age_group).
        $studentBase = \App\Models\User::where('uRole', 'student')
            ->whereNull('uDeleted_at');

        // Total students
        $totalStudents = (clone $studentBase)->count();

        // Active students (status = active)
        $activeStudents = (clone $studentBase)->where('uStatus', 'active')->count();

        // Inactive students (status = inactive)
        $inactiveStudents = (clone $studentBase)->where('uStatus', 'inactive')->count();

        // New students this month
        $newStudentsThisMonth = (clone $studentBase)
            ->whereMonth('uCreated_at', now()->month)
            ->whereYear('uCreated_at', now()->year)
            ->count();

        // Calculate changes (compare with last month)
        $beforeThisMonth = function ($query) {
            $query->where(function ($q) {
                $q->whereYear('uCreated_at', '<', now()->year);
            })->orWhere(function ($q) {
                $q->whereYear('uCreated_at', '=', now()->year)
                  ->whereMonth('uCreated_at', '<', now()->month);
            });
        };

        $totalStudentsLastMonth = (clone $studentBase)->where($beforeThisMonth)->count();

        $activeStudentsLastMonth = (clone $studentBase)
            ->where('uStatus', 'active')
            ->where($beforeThisMonth)
            ->count();

        $inactiveStudentsLastMonth = (clone $studentBase)
            ->where('uStatus', 'inactive')
            ->where($beforeThisMonth)
            ->count();

        $newStudentsLastMonth = (clone $studentBase)
            ->whereMonth('uCreated_at', now()->subMonth()->month)
            ->whereYear('uCreated_at', now()->subMonth()->year)
            ->count();
            
        // Calculate percentage changes
        $totalChange = $totalStudentsLastMonth > 0 
            ? round((($totalStudents - $totalStudentsLastMonth) / $totalStudentsLastMonth) * 100, 1) 
            : ($totalStudents > 0 ? 100 : 0);
            
        $activeChange = $activeStudentsLastMonth > 0 
            ? round((($activeStudents - $activeStudentsLastMonth) / $activeStudentsLastMonth) * 100, 1) 
            : ($activeStudents > 0 ? 100 : 0);
            
        $inactiveChange = $inactiveStudentsLastMonth > 0 
            ? round((($inactiveStudents - $inactiveStudentsLastMonth) / $inactiveStudentsLastMonth) * 100, 1) 
            : ($inactiveStudents > 0 ? 100 : 0);
            
        $newStudentsChange = $newStudentsLastMonth > 0 
            ? round((($newStudentsThisMonth - $newStudentsLastMonth) / $newStudentsLastMonth) * 100, 1) 
            : ($newStudentsThisMonth > 0 ? 100 : 0);

        return response()->json([
            'status' => 'success',
            'data' => [
                'total_students' => $totalStudents,
                'total_change' => $totalChange,
                'active_students' => $activeStudents,
                'active_change' => $activeChange,
                'inactive_students' => $inactiveStudents,
                'inactive_change' => $inactiveChange,
                'new_students_this_month' => $newStudentsThisMonth,
                'new_students_change' => $newStudentsChange,
            ]
        ]);
    }

    /**
     * @OA\Get(
     *     path="/teacher/dashboard/overview",
     *     tags={"Teacher Dashboard"},
     *     summary="Get dashboard overview statistics",
     *     description="Get comprehensive dashboard statistics including counts, performance, and activities",
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(response=200, description="Dashboard overview retrieved successfully")
     * )
     */
    public function getDashboardOverview(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Unauthorized'
            ], 401);
        }

        // Get counts
        $totalCourses = \App\Models\Course::where('cTeacher', $user->uId)->count();
        $totalClasses = \App\Models\Classes::where('cTeacher_id', $user->uId)->count();
        $totalExams = \App\Models\Exam::where('eTeacher_id', $user->uId)->count();
        
        // Get total students - đếm số học viên distinct đã từng dùng exam của
        // teacher này (có submission >= 60s). Không phụ thuộc class vì hệ
        // thống mới student không thuộc class cố định, chỉ thuộc age_group.
        $teacherExamIdsForCount = \App\Models\Exam::where('eTeacher_id', $user->uId)->pluck('eId');
        $totalStudents = Submission::whereIn('exam_id', $teacherExamIdsForCount)
            ->whereNotNull('sStart_time')
            ->where(function ($q) {
                $q->whereRaw('TIMESTAMPDIFF(SECOND, sStart_time, sSubmit_time) >= 60')
                  ->orWhere(function ($q2) {
                      $q2->whereNull('sSubmit_time')
                         ->whereRaw('TIMESTAMPDIFF(SECOND, sStart_time, NOW()) >= 60');
                  });
            })
            ->distinct('user_id')
            ->count('user_id');

        // Get this month's new items
        $newCoursesThisMonth = \App\Models\Course::where('cTeacher', $user->uId)
            ->whereMonth('cCreateAt', now()->month)
            ->count();
        
        $newClassesThisMonth = \App\Models\Classes::where('cTeacher_id', $user->uId)
            ->whereMonth('cCreated_at', now()->month)
            ->count();
            
        $newStudentsThisMonth = \App\Models\User::where('uRole', 'student')
            ->whereNull('uDeleted_at')
            ->whereMonth('uCreated_at', now()->month)
            ->count();
            
        $newExamsThisMonth = \App\Models\Exam::where('eTeacher_id', $user->uId)
            ->whereMonth('eCreated_at', now()->month)
            ->count();

        // Get today's classes (assignments with deadline today)
        $classesToday = \App\Models\TestAssignment::whereIn('exam_id',
            \App\Models\Exam::where('eTeacher_id', $user->uId)->pluck('eId')
        )
            ->whereDate('taDeadline', today())
            ->count();

        // Get pending grading
        $pendingGrading = Submission::whereIn('exam_id',
            \App\Models\Exam::where('eTeacher_id', $user->uId)->pluck('eId')
        )
            ->where('sStatus', 'submitted')
            ->whereNull('sGraded_time')
            ->count();

        // Get deadlines this week
        $deadlinesThisWeek = \App\Models\TestAssignment::whereIn('exam_id',
            \App\Models\Exam::where('eTeacher_id', $user->uId)->pluck('eId')
        )
            ->whereBetween('taDeadline', [now()->startOfWeek(), now()->endOfWeek()])
            ->count();

        // Calculate average score
        $avgScore = Submission::whereIn('exam_id',
            \App\Models\Exam::where('eTeacher_id', $user->uId)->pluck('eId')
        )
            ->where('sStatus', 'graded')
            ->whereNotNull('sScore')
            ->avg('sScore');

        // Calculate score improvement (compare last 2 weeks)
        $lastWeekAvg = Submission::whereIn('exam_id',
            \App\Models\Exam::where('eTeacher_id', $user->uId)->pluck('eId')
        )
            ->where('sStatus', 'graded')
            ->whereBetween('sSubmit_time', [now()->subWeeks(2), now()->subWeek()])
            ->avg('sScore');
            
        $thisWeekAvg = Submission::whereIn('exam_id',
            \App\Models\Exam::where('eTeacher_id', $user->uId)->pluck('eId')
        )
            ->where('sStatus', 'graded')
            ->whereBetween('sSubmit_time', [now()->subWeek(), now()])
            ->avg('sScore');

        $scoreImprovement = $lastWeekAvg > 0 ? round((($thisWeekAvg - $lastWeekAvg) / $lastWeekAvg) * 100, 1) : 0;

        // ── Assignment & submission stats ──────────────────────────────────
        // Lấy id các đề của giáo viên này
        $teacherExamIds = \App\Models\Exam::where('eTeacher_id', $user->uId)->pluck('eId');

        // Tổng số bài đã giao (TestAssignment của các đề thuộc teacher)
        $totalAssignments = \App\Models\TestAssignment::whereIn('exam_id', $teacherExamIds)->count();

        // Số bài giao trong tháng này (cho metric +X)
        $newAssignmentsThisMonth = \App\Models\TestAssignment::whereIn('exam_id', $teacherExamIds)
            ->whereMonth('taCreated_at', now()->month)
            ->count();

        // Tính expected submissions theo logic mới (không có khái niệm class
        // cố định). Giả định mỗi assignment được giao cho TẤT CẢ học viên
        // active hiện có (vì hệ thống mới chia theo age_group).
        // - target_type=student: 1 user
        // - target_type=class:   tất cả student active (fallback chung)
        $assignments = \App\Models\TestAssignment::whereIn('exam_id', $teacherExamIds)
            ->select('taId', 'taTarget_type', 'taTarget_id')
            ->get();

        $allActiveStudentsCount = \App\Models\User::where('uRole', 'student')
            ->whereNull('uDeleted_at')
            ->where('uStatus', 'active')
            ->count();

        $expectedSubmissions = 0;
        foreach ($assignments as $asg) {
            if ($asg->taTarget_type === 'student') {
                $expectedSubmissions += 1;
            } else {
                // Mọi target khác (class cũ, all, age_group...) → fallback
                $expectedSubmissions += $allActiveStudentsCount;
            }
        }

        // Số lượt thực sự đã làm (có assignment_id, status submitted hoặc graded)
        $completedSubmissions = Submission::whereIn('exam_id', $teacherExamIds)
            ->whereNotNull('assignment_id')
            ->whereIn('sStatus', ['submitted', 'graded'])
            ->count();

        // Số chưa làm = expected - completed (clamp >= 0)
        $pendingSubmissions = max(0, $expectedSubmissions - $completedSubmissions);

        // Tỉ lệ hoàn thành (%)
        $completionRate = $expectedSubmissions > 0
            ? round(($completedSubmissions / $expectedSubmissions) * 100, 1)
            : 0;

        return response()->json([
            'status' => 'success',
            'data' => [
                'total_courses' => $totalCourses,
                'total_classes' => $totalClasses,
                'total_students' => $totalStudents,
                'total_exams' => $totalExams,
                'new_courses_this_month' => $newCoursesThisMonth,
                'new_classes_this_month' => $newClassesThisMonth,
                'new_students_this_month' => $newStudentsThisMonth,
                'new_exams_this_month' => $newExamsThisMonth,
                'classes_today' => $classesToday,
                'pending_grading' => $pendingGrading,
                'deadlines_this_week' => $deadlinesThisWeek,
                'average_score' => round($avgScore ?? 0, 1),
                'score_improvement' => $scoreImprovement,
                // ── New: assignment / submission metrics ──
                'total_assignments' => $totalAssignments,
                'new_assignments_this_month' => $newAssignmentsThisMonth,
                'expected_submissions' => $expectedSubmissions,
                'completed_submissions' => $completedSubmissions,
                'pending_submissions' => $pendingSubmissions,
                'completion_rate' => $completionRate,
            ]
        ]);
    }

    /**
     * @OA\Get(
     *     path="/teacher/dashboard/performance-data",
     *     tags={"Teacher Dashboard"},
     *     summary="Get weekly performance data",
     *     description="Get student performance data for the last 6 weeks",
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(response=200, description="Performance data retrieved successfully")
     * )
     */
    public function getPerformanceData(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Unauthorized'
            ], 401);
        }

        $examIds = \App\Models\Exam::where('eTeacher_id', $user->uId)->pluck('eId');
        
        $performanceData = [];
        
        for ($i = 5; $i >= 0; $i--) {
            $weekStart = now()->subWeeks($i)->startOfWeek();
            $weekEnd = now()->subWeeks($i)->endOfWeek();
            
            $submissions = Submission::whereIn('exam_id', $examIds)
                ->where('sStatus', 'graded')
                ->whereBetween('sSubmit_time', [$weekStart, $weekEnd])
                ->get();

            $weekLabel = 'T' . (6 - $i);
            
            $performanceData[] = [
                'week' => $weekLabel,
                'average' => round($submissions->avg('sScore') ?? 0, 1),
                'listening' => round($submissions->where('exam.eType', 'listening')->avg('sScore') ?? 0, 1),
                'reading' => round($submissions->where('exam.eType', 'reading')->avg('sScore') ?? 0, 1),
                'writing' => round($submissions->where('exam.eType', 'writing')->avg('sScore') ?? 0, 1),
            ];
        }

        return response()->json([
            'status' => 'success',
            'data' => $performanceData
        ]);
    }

    /**
     * @OA\Get(
     *     path="/teacher/dashboard/recent-activities",
     *     tags={"Teacher Dashboard"},
     *     summary="Get recent activities",
     *     description="Get recent teacher activities (exams created, assignments, grading)",
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(response=200, description="Recent activities retrieved successfully")
     * )
     */
    public function getRecentActivities(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Unauthorized'
            ], 401);
        }

        $activities = [];

        // Recent exams created
        $recentExams = \App\Models\Exam::where('eTeacher_id', $user->uId)
            ->orderBy('eCreated_at', 'desc')
            ->limit(2)
            ->get();
            
        foreach ($recentExams as $exam) {
            $activities[] = [
                'id' => 'exam_' . $exam->eId,
                'type' => 'created',
                'detail' => $exam->eTitle,
                'time' => now()->diffInHours($exam->eCreated_at),
                'timeUnit' => 'hoursAgo',
                'timestamp' => $exam->eCreated_at,
                'color' => '#2563EB',
                'bg' => '#EFF6FF',
            ];
        }

        // Recent assignments
        $recentAssignments = \App\Models\TestAssignment::whereIn('exam_id',
            \App\Models\Exam::where('eTeacher_id', $user->uId)->pluck('eId')
        )
            ->orderBy('taCreated_at', 'desc')
            ->limit(2)
            ->get();
            
        foreach ($recentAssignments as $assignment) {
            // Class system deprecated — chỉ hiện label chung "Học viên" cho mọi target.
            $targetLabel = 'Học viên';
            
            $activities[] = [
                'id' => 'assignment_' . $assignment->id,
                'type' => 'assigned',
                'detail' => $targetLabel,
                'time' => now()->diffInHours($assignment->taCreated_at),
                'timeUnit' => 'hoursAgo',
                'timestamp' => $assignment->taCreated_at,
                'color' => '#10B981',
                'bg' => '#F0FDF4',
            ];
        }

        // Recent grading
        $recentGrading = Submission::whereIn('exam_id',
            \App\Models\Exam::where('eTeacher_id', $user->uId)->pluck('eId')
        )
            ->where('sStatus', 'graded')
            ->whereNotNull('sGraded_time')
            ->whereDate('sGraded_time', '>=', now()->subDays(2))
            ->count();
            
        if ($recentGrading > 0) {
            $activities[] = [
                'id' => 'grading_recent',
                'type' => 'graded',
                'detail' => (string)$recentGrading,
                'detailType' => 'submissions',
                'time' => '',
                'timeUnit' => 'yesterday',
                'timestamp' => now()->subDay(),
                'color' => '#F59E0B',
                'bg' => '#FFFBEB',
            ];
        }

        // Sort by timestamp and limit to 4
        usort($activities, function($a, $b) {
            return $b['timestamp'] <=> $a['timestamp'];
        });
        
        $activities = array_slice($activities, 0, 4);

        return response()->json([
            'status' => 'success',
            'data' => $activities
        ]);
    }

    /**
     * @OA\Get(
     *     path="/teacher/dashboard/top-students",
     *     tags={"Teacher Dashboard"},
     *     summary="Get top 5 most active students",
     *     description="Top học viên có nhiều submission nhất 30 ngày qua, kèm điểm trung bình",
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(response=200, description="OK")
     * )
     */
    public function getTopStudents(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'teacher') {
            return response()->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $teacherExamIds = \App\Models\Exam::where('eTeacher_id', $user->uId)->pluck('eId');
        if ($teacherExamIds->isEmpty()) {
            return response()->json(['status' => 'success', 'data' => []]);
        }

        // Top 5 user_id có nhiều submission nhất trong 30 ngày qua
        // — chỉ tính submission có start_time và đã thực sự làm > 60s (loại "mở thử")
        $rows = Submission::whereIn('exam_id', $teacherExamIds)
            ->where('sStart_time', '>=', now()->subDays(30))
            ->whereNotNull('sStart_time')
            ->where(function ($q) {
                $q->whereRaw('TIMESTAMPDIFF(SECOND, sStart_time, sSubmit_time) >= 60')
                  ->orWhere(function ($q2) {
                      $q2->whereNull('sSubmit_time')
                         ->whereRaw('TIMESTAMPDIFF(SECOND, sStart_time, NOW()) >= 60');
                  });
            })
            ->select('user_id', \DB::raw('COUNT(*) as submission_count'), \DB::raw('AVG(sScore) as avg_score'))
            ->groupBy('user_id')
            ->orderByDesc('submission_count')
            ->take(5)
            ->get();

        if ($rows->isEmpty()) {
            return response()->json(['status' => 'success', 'data' => []]);
        }

        $userIds = $rows->pluck('user_id')->toArray();
        $users = \App\Models\User::whereIn('uId', $userIds)
            ->whereNull('uDeleted_at')
            ->get(['uId', 'uName', 'avatar_url', 'age_group'])
            ->keyBy('uId');

        $maxCount = (int) $rows->max('submission_count');

        $data = $rows->map(function ($r) use ($users, $maxCount) {
            $u = $users->get($r->user_id);
            if (!$u) return null;
            $count = (int) $r->submission_count;
            return [
                'user_id'          => $u->uId,
                'name'             => $u->uName,
                'avatar'           => $u->avatar_url,
                'age_group'        => $u->age_group, // adults | teen | kids
                'submission_count' => $count,
                'avg_score'        => $r->avg_score !== null ? round((float) $r->avg_score / 10, 1) : null,
                'progress_pct'     => $maxCount > 0 ? (int) round(($count / $maxCount) * 100) : 0,
            ];
        })->filter()->values();

        return response()->json(['status' => 'success', 'data' => $data]);
    }

    /**
     * @OA\Get(
     *     path="/teacher/dashboard/activity-chart",
     *     tags={"Teacher Dashboard"},
     *     summary="Get daily submissions + average score for last 14 days",
     *     description="Trả về data cho biểu đồ cột (số bài nộp / ngày) + đường (điểm TB / ngày) trong 14 ngày gần nhất.",
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(response=200, description="OK")
     * )
     */
    public function getActivityChart(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'teacher') {
            return response()->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $mode = $request->input('mode', '7d'); // 'today' | '7d' | '30d'
        if (!in_array($mode, ['today', '7d', '30d'], true)) {
            $mode = '7d';
        }

        // CHỈ tính bài thi VSTEP full skill (mixed) — đề thi chính thức tổng hợp
        // 4 kỹ năng. Loại bỏ các đề lẻ (listening/reading/writing/speaking riêng)
        // và các đề loại khác (IELTS, Kids, Practice).
        $teacherExamIds = \App\Models\Exam::where('eTeacher_id', $user->uId)
            ->where('eType', 'VSTEP')
            ->where('eSkill', 'mixed')
            ->pluck('eId');

        // ────────────────────────────────────────────────────────────
        // Mode "today": group theo GIỜ trong ngày hôm nay (24 buckets)
        // ────────────────────────────────────────────────────────────
        if ($mode === 'today') {
            $startOfDay = now()->startOfDay();
            $endOfDay   = now()->endOfDay();

            $buckets = [];
            for ($h = 0; $h < 24; $h++) {
                $buckets[$h] = [
                    'date'        => $startOfDay->copy()->addHours($h)->format('Y-m-d H:00'),
                    'label'       => sprintf('%02dh', $h),
                    'weekday'     => $startOfDay->isoFormat('dd'),
                    'submissions' => 0,
                    'avg_score'   => null,
                    'students'    => 0,
                ];
            }

            if ($teacherExamIds->isNotEmpty()) {
                $rows = Submission::whereIn('exam_id', $teacherExamIds)
                    ->whereNotNull('sStart_time')
                    ->whereBetween('sStart_time', [$startOfDay, $endOfDay])
                    ->where(function ($q) {
                        $q->whereRaw('TIMESTAMPDIFF(SECOND, sStart_time, sSubmit_time) >= 60')
                          ->orWhere(function ($q2) {
                              $q2->whereNull('sSubmit_time')
                                 ->whereRaw('TIMESTAMPDIFF(SECOND, sStart_time, NOW()) >= 60');
                          });
                    })
                    ->selectRaw('HOUR(sStart_time) as h, COUNT(*) as cnt, AVG(sScore) as avg_score, COUNT(DISTINCT user_id) as students')
                    ->groupBy('h')
                    ->get();

                foreach ($rows as $r) {
                    $h = (int) $r->h;
                    if (!isset($buckets[$h])) continue;
                    $buckets[$h]['submissions'] = (int) $r->cnt;
                    $buckets[$h]['students']    = (int) $r->students;
                    $buckets[$h]['avg_score']   = $r->avg_score !== null
                        ? round((float) $r->avg_score / 10, 1)
                        : null;
                }
            }

            $values     = array_values($buckets);
            $total      = array_sum(array_column($values, 'submissions'));
            $allScores  = array_filter(array_column($values, 'avg_score'), function ($v) { return $v !== null; });
            $overallAvg = !empty($allScores) ? round(array_sum($allScores) / count($allScores), 1) : null;
            $peakBucket = collect($values)->sortByDesc('submissions')->first();

            return response()->json([
                'status' => 'success',
                'data'   => $values,
                'meta'   => [
                    'mode'              => 'today',
                    'total_submissions' => $total,
                    'overall_avg_score' => $overallAvg,
                    'peak_day'          => $peakBucket,
                    'days'              => 1,
                ],
            ]);
        }

        // ────────────────────────────────────────────────────────────
        // Mode "7d" / "30d": group theo NGÀY
        // ────────────────────────────────────────────────────────────
        $days = $mode === '30d' ? 30 : 7;

        $buckets = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $date = now()->subDays($i)->startOfDay();
            $buckets[$date->format('Y-m-d')] = [
                'date'         => $date->format('Y-m-d'),
                'label'        => $date->format('d/m'),
                'weekday'      => $date->isoFormat('dd'),
                'submissions'  => 0,
                'avg_score'    => null,
                'students'     => 0,
            ];
        }

        if ($teacherExamIds->isEmpty()) {
            return response()->json(['status' => 'success', 'data' => array_values($buckets)]);
        }

        $start = now()->subDays($days - 1)->startOfDay();

        $rows = Submission::whereIn('exam_id', $teacherExamIds)
            ->whereNotNull('sStart_time')
            ->where('sStart_time', '>=', $start)
            ->where(function ($q) {
                $q->whereRaw('TIMESTAMPDIFF(SECOND, sStart_time, sSubmit_time) >= 60')
                  ->orWhere(function ($q2) {
                      $q2->whereNull('sSubmit_time')
                         ->whereRaw('TIMESTAMPDIFF(SECOND, sStart_time, NOW()) >= 60');
                  });
            })
            ->selectRaw('DATE(sStart_time) as d, COUNT(*) as cnt, AVG(sScore) as avg_score, COUNT(DISTINCT user_id) as students')
            ->groupBy('d')
            ->get();

        foreach ($rows as $r) {
            $key = (string) $r->d;
            if (!isset($buckets[$key])) continue;
            $buckets[$key]['submissions'] = (int) $r->cnt;
            $buckets[$key]['students']    = (int) $r->students;
            $buckets[$key]['avg_score']   = $r->avg_score !== null
                ? round((float) $r->avg_score / 10, 1)
                : null;
        }

        $total = array_sum(array_column($buckets, 'submissions'));
        $allScores = array_filter(array_column($buckets, 'avg_score'), function ($v) { return $v !== null; });
        $overallAvg = !empty($allScores) ? round(array_sum($allScores) / count($allScores), 1) : null;
        $peakDay = collect($buckets)->sortByDesc('submissions')->first();

        return response()->json([
            'status' => 'success',
            'data'   => array_values($buckets),
            'meta'   => [
                'mode'              => $mode,
                'total_submissions' => $total,
                'overall_avg_score' => $overallAvg,
                'peak_day'          => $peakDay,
                'days'              => $days,
            ],
        ]);
    }

    /**
     * Return all submitted attempts for the current Vietnam calendar day,
     * grouped by normalized exam type and student age group.
     */
    public function getTodaySubmissionsByType(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'teacher') {
            return response()->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $timezone = 'Asia/Ho_Chi_Minh';
        $today = Carbon::now($timezone);
        $startUtc = $today->copy()->startOfDay()->utc();
        $endUtc = $today->copy()->addDay()->startOfDay()->utc();

        $rows = Submission::query()
            ->join('exams', 'exams.eId', '=', 'submissions.exam_id')
            ->join('users', 'users.uId', '=', 'submissions.user_id')
            ->where('users.uRole', 'student')
            ->whereIn('users.age_group', ['adults', 'teens', 'kids'])
            ->whereNotNull('submissions.sSubmit_time')
            ->where('submissions.sSubmit_time', '>=', $startUtc->format('Y-m-d H:i:s'))
            ->where('submissions.sSubmit_time', '<', $endUtc->format('Y-m-d H:i:s'))
            ->selectRaw(
                'exams.eType as exam_type, exams.age_group as exam_age_group, '
                . 'users.age_group as student_age_group, COUNT(*) as submission_count'
            )
            ->groupBy('exams.eType', 'exams.age_group', 'users.age_group')
            ->get();

        $groups = [];
        foreach ($rows as $row) {
            [$key, $label, $order] = $this->normalizeDashboardExamType(
                (string) $row->exam_type,
                (string) $row->exam_age_group
            );

            if (!isset($groups[$key])) {
                $groups[$key] = [
                    'exam_type' => $key,
                    'label' => $label,
                    'adults' => 0,
                    'teens' => 0,
                    'kids' => 0,
                    'total' => 0,
                    '_order' => $order,
                ];
            }

            $ageGroup = (string) $row->student_age_group;
            $count = (int) $row->submission_count;
            $groups[$key][$ageGroup] += $count;
            $groups[$key]['total'] += $count;
        }

        $data = collect(array_values($groups))
            ->sortBy([['_order', 'asc'], ['label', 'asc']])
            ->map(function (array $group) {
                unset($group['_order']);
                return $group;
            })
            ->values();

        $meta = [
            'total' => (int) $data->sum('total'),
            'adults' => (int) $data->sum('adults'),
            'teens' => (int) $data->sum('teens'),
            'kids' => (int) $data->sum('kids'),
            'date' => $today->format('Y-m-d'),
            'timezone' => $timezone,
        ];

        return response()->json([
            'status' => 'success',
            'data' => $data,
            'meta' => $meta,
        ]);
    }

    private function normalizeDashboardExamType(string $examType, string $examAgeGroup): array
    {
        $type = strtoupper(trim($examType));
        $ageGroup = strtolower(trim($examAgeGroup));

        if ($type === 'VSTEP') return ['vstep', 'VSTEP', 10];
        if (str_starts_with($type, 'IELTS')) return ['ielts', 'IELTS', 20];
        if ($type === 'THPT') return ['thpt', 'THPT', 30];
        if ($ageGroup === 'kids' || in_array($type, ['STARTERS', 'MOVERS', 'FLYERS'], true)) {
            return ['cambridge_yle', 'Cambridge YLE', 40];
        }
        if ($ageGroup === 'teens' && $type === 'GENERAL') {
            return ['teens', 'Đề Teens', 50];
        }

        return ['general', 'General', 60];
    }

    /**
     * @OA\Get(
     *     path="/teacher/dashboard/test-statistics/{examId}",
     *     tags={"Teacher Dashboard"},
     *     summary="Get real-time test statistics",
     *     description="Get live statistics for ongoing tests",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="examId",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=200, description="Statistics retrieved successfully")
     * )
     */
    public function getTestStatistics(Request $request, $examId)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Unauthorized'
            ], 401);
        }

        // If examId is 0, return dashboard overview
        if ($examId == 0) {
            return $this->getDashboardOverview($request);
        }

        $stats = TestWebSocketService::getTestStatistics($examId);

        return response()->json([
            'status' => 'success',
            'data' => $stats
        ]);
    }

    /**
     * @OA\Get(
     *     path="/teacher/dashboard/active-sessions",
     *     tags={"Teacher Dashboard"},
     *     summary="Get active test sessions",
     *     description="Get list of currently active test sessions with connection status",
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(response=200, description="Active sessions retrieved successfully")
     * )
     */
    public function getActiveSessions(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Unauthorized'
            ], 401);
        }

        // Get active submissions for teacher's exams
        $activeSessions = Submission::with(['user', 'exam', 'assignment'])
            ->whereHas('exam', function($query) use ($user) {
                $query->where('eTeacher_id', $user->uId);
            })
            ->where('sStatus', 'in_progress')
            ->get()
            ->map(function($submission) {
                $connectionKey = "test_session:{$submission->sId}";
                
                return [
                    'submission_id' => $submission->sId,
                    'student' => [
                        'id' => $submission->user->uId,
                        'name' => $submission->user->uName,
                        'phone' => $submission->user->uPhone
                    ],
                    'exam' => [
                        'id' => $submission->exam->eId,
                        'title' => $submission->exam->eTitle
                    ],
                    'start_time' => $submission->sStart_time,
                    'time_elapsed' => now()->diffInMinutes($submission->sStart_time),
                    'time_remaining' => max(0, $submission->exam->eDuration_minutes - now()->diffInMinutes($submission->sStart_time)),
                    'connection_status' => [
                        'connected' => Redis::hget($connectionKey, 'connected') === 'true',
                        'last_seen' => Redis::hget($connectionKey, 'last_seen'),
                        'connection_count' => Redis::hget($connectionKey, 'connection_count') ?: 0,
                        'disconnection_count' => Redis::hget($connectionKey, 'disconnection_count') ?: 0,
                        'answers_count' => Redis::hget($connectionKey, 'answers_count') ?: 0
                    ]
                ];
            });

        return response()->json([
            'status' => 'success',
            'data' => $activeSessions
        ]);
    }

    /**
     * @OA\Post(
     *     path="/teacher/dashboard/send-message",
     *     tags={"Teacher Dashboard"},
     *     summary="Send message to student during test",
     *     description="Send real-time message to student via WebSocket",
     *     security={{"bearerAuth":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"submission_id", "message"},
     *             @OA\Property(property="submission_id", type="integer", example=123),
     *             @OA\Property(property="message", type="string", example="Chúc bạn làm bài tốt!")
     *         )
     *     ),
     *     @OA\Response(response=200, description="Message sent successfully")
     * )
     */
    public function sendMessageToStudent(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Unauthorized'
            ], 401);
        }

        $request->validate([
            'submission_id' => 'required|integer|exists:submissions,sId',
            'message' => 'required|string|max:500'
        ]);

        $submission = Submission::with(['exam', 'user'])
            ->where('sId', $request->submission_id)
            ->whereHas('exam', function($query) use ($user) {
                $query->where('eTeacher_id', $user->uId);
            })
            ->first();

        if (!$submission) {
            return response()->json([
                'status' => 'error',
                'message' => 'Submission not found or not authorized'
            ], 404);
        }

        // Send message via WebSocket
        broadcast(new \App\Events\TestSessionEvent(
            $submission->sId,
            $submission->user_id,
            'teacher_message',
            [
                'message' => $request->message,
                'teacher_name' => $user->uName,
                'timestamp' => now()->toISOString()
            ]
        ));

        return response()->json([
            'status' => 'success',
            'message' => 'Message sent to student successfully'
        ]);
    }

    /**
     * @OA\Get(
     *     path="/teacher/dashboard/connection-logs/{submissionId}",
     *     tags={"Teacher Dashboard"},
     *     summary="Get connection logs for a test session",
     *     description="Get detailed connection history for troubleshooting",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="submissionId",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=200, description="Connection logs retrieved successfully")
     * )
     */
    public function getConnectionLogs(Request $request, $submissionId)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Unauthorized'
            ], 401);
        }

        $submission = Submission::with(['exam', 'user'])
            ->where('sId', $submissionId)
            ->whereHas('exam', function($query) use ($user) {
                $query->where('eTeacher_id', $user->uId);
            })
            ->first();

        if (!$submission) {
            return response()->json([
                'status' => 'error',
                'message' => 'Submission not found or not authorized'
            ], 404);
        }

        $connectionKey = "test_session:{$submissionId}";
        $connectionData = Redis::hgetall($connectionKey);

        return response()->json([
            'status' => 'success',
            'data' => [
                'submission_id' => $submissionId,
                'student' => [
                    'name' => $submission->user->uName,
                    'phone' => $submission->user->uPhone
                ],
                'connection_history' => $connectionData,
                'current_status' => [
                    'connected' => ($connectionData['connected'] ?? 'false') === 'true',
                    'last_activity' => $connectionData['last_seen'] ?? null,
                    'total_connections' => $connectionData['connection_count'] ?? 0,
                    'total_disconnections' => $connectionData['disconnection_count'] ?? 0,
                    'answers_submitted' => $connectionData['answers_count'] ?? 0
                ]
            ]
        ]);
    }
}

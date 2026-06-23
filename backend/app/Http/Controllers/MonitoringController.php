<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Submission;
use App\Models\Exam;
use App\Models\Classes;
use Carbon\Carbon;

class MonitoringController extends Controller
{
    /**
     * GET /teacher/dashboard/active-sessions
     * Danh sách học viên đang thi (sStatus = in_progress)
     */
    public function activeSessions(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'teacher') {
            return response()->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $query = Submission::with([
                'user:uId,uName,uEmail',
                'exam:eId,eTitle,eType,eDuration_minutes,eTeacher_id',
                'answers:saId,submission_id,question_id',
                'exam.questions:qId,exam_id',
                'assignment:taId,taTarget_type,taTarget_id',
            ])
            ->where('sStatus', 'in_progress')
            ->whereHas('exam', function ($q) use ($user) {
                $q->where('eTeacher_id', $user->uId);
            });

        // Filter by exam
        if ($request->filled('exam_id')) {
            $query->where('exam_id', $request->exam_id);
        }

        // Filter by class (via assignment)
        if ($request->filled('class_id')) {
            $query->whereHas('assignment', function ($q) use ($request) {
                $q->where('taTarget_type', 'class')->where('taTarget_id', $request->class_id);
            });
        }

        $sessions = $query->orderBy('sStart_time', 'asc')->get();

        $now = Carbon::now();

        $data = $sessions->map(function ($s) use ($now) {
            $startedAt  = $s->sStart_time ? Carbon::parse($s->sStart_time) : $now;
            $elapsed    = (int) $startedAt->diffInMinutes($now);
            $duration   = (int) ($s->exam->eDuration_minutes ?? $s->exam->eDuration ?? 0);
            $remaining  = $duration > 0 ? max(0, $duration - $elapsed) : null;

            // Skip ghost sessions: past their duration by more than 30 minutes
            if ($duration > 0 && $elapsed > $duration + 30) {
                return null;
            }

            $totalQ    = $s->exam->questions->count();
            $answered  = $s->answers->count();
            $progress  = $totalQ > 0 ? round(($answered / $totalQ) * 100) : 0;

            $uName  = $s->user->uName ?? 'Unknown';
            $words  = preg_split('/\s+/', trim($uName));
            $avatar = strtoupper(mb_substr(end($words), 0, 2));

            $className = null;
            if ($s->assignment && $s->assignment->taTarget_type === 'class') {
                $cls = Classes::find($s->assignment->taTarget_id);
                $className = $cls ? $cls->cName : null;
            }

            return [
                'id'         => $s->sId,
                'student'    => [
                    'id'     => $s->user->uId ?? null,
                    'name'   => $uName,
                    'avatar' => $avatar,
                ],
                'exam' => [
                    'id'    => $s->exam->eId ?? null,
                    'title' => $s->exam->eTitle ?? '—',
                    'type'  => $s->exam->eType  ?? 'General',
                ],
                'class_name'  => $className,
                'started_at'  => $startedAt->toIso8601String(),
                'elapsed_min' => $elapsed,
                'remaining_min' => $remaining,
                'answered'    => $answered,
                'total'       => $totalQ,
                'progress_pct'=> $progress,
            ];
        });

        return response()->json(['status' => 'success', 'data' => $data->filter()->values()]);
    }

    /**
     * GET /teacher/dashboard/recent-starts
     * Học viên bắt đầu đề thi thật (không phải luyện tập) trong 30 phút gần nhất
     */
    public function recentStarts(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'teacher') {
            return response()->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $since = Carbon::now()->subMinutes(30);

        $sessions = Submission::with([
                'user:uId,uName',
                'exam:eId,eTitle,eType,ePurpose,eTeacher_id',
            ])
            ->where('sStatus', 'in_progress')
            ->where('sStart_time', '>=', $since)
            ->whereHas('exam', function ($q) use ($user) {
                $q->where('eTeacher_id', $user->uId)
                  ->where(function ($q2) {
                      $q2->whereNull('ePurpose')
                         ->orWhere('ePurpose', '!=', 'practice');
                  });
            })
            ->orderBy('sStart_time', 'desc')
            ->limit(20)
            ->get();

        $now = Carbon::now();

        $data = $sessions->map(function ($s) use ($now) {
            $startedAt = $s->sStart_time ? Carbon::parse($s->sStart_time) : $now;
            $uName     = $s->user->uName ?? 'Unknown';
            $words     = preg_split('/\s+/', trim($uName));
            $avatar    = strtoupper(mb_substr(end($words), 0, 2));

            return [
                'id'          => $s->sId,
                'student_name'=> $uName,
                'avatar'      => $avatar,
                'exam_title'  => $s->exam->eTitle ?? '—',
                'exam_type'   => $s->exam->eType  ?? 'General',
                'started_at'  => $startedAt->toIso8601String(),
                'elapsed_min' => (int) $startedAt->diffInMinutes($now),
            ];
        });

        return response()->json(['status' => 'success', 'data' => $data]);
    }

    /**
     * GET /teacher/dashboard/exams-ready
     * Đề đã hoàn thiện (published) nhưng CHƯA được giao cho lớp/học viên nào
     * → gợi ý giáo viên "công bố / giao đề" để học viên có thể vào thi.
     *
     * Áp dụng cho MỌI loại đề (THPT, IELTS, VSTEP, Kids, General...) vì chỉ
     * dựa trên eStatus + có TestAssignment hay chưa. Đề là tài sản chung nên
     * liệt kê tất cả đề published chưa giao, không giới hạn người tạo.
     */
    public function examsReadyToPublish(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'teacher') {
            return response()->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $exams = Exam::query()
            ->select('eId', 'eTitle', 'eType', 'eStatus', 'ePurpose', 'eCreated_at', 'eTeacher_id')
            ->whereIn('eStatus', ['published', 'active'])
            // Bỏ qua đề luyện tập — chỉ quan tâm đề thi cần giao
            ->where(function ($q) {
                $q->whereNull('ePurpose')->orWhere('ePurpose', '!=', 'practice');
            })
            // Chưa có assignment nào (chưa giao cho lớp/học viên)
            ->whereDoesntHave('testAssignments')
            ->orderByDesc('eCreated_at')
            ->limit(20)
            ->get();

        $data = $exams->map(function ($e) {
            return [
                'id'         => $e->eId,
                'exam_title' => $e->eTitle ?? '—',
                'exam_type'  => $e->eType ?? 'General',
                'created_at' => optional($e->eCreated_at)->toIso8601String(),
            ];
        });

        return response()->json(['status' => 'success', 'data' => $data]);
    }

    /**
     * POST /teacher/dashboard/cleanup-expired
     * Force-submit ghost sessions that are past their exam duration (> 30 min overtime)
     */
    public function cleanupExpired(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'teacher') {
            return response()->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $now     = Carbon::now();
        $cleaned = 0;

        $sessions = Submission::with('exam:eId,eDuration_minutes,eTeacher_id')
            ->where('sStatus', 'in_progress')
            ->whereHas('exam', function ($q) use ($user) {
                $q->where('eTeacher_id', $user->uId)
                  ->where('eDuration_minutes', '>', 0);
            })
            ->get();

        foreach ($sessions as $s) {
            $duration = (int) ($s->exam->eDuration_minutes ?? 0);
            if ($duration <= 0) continue;
            $elapsed = (int) Carbon::parse($s->sStart_time)->diffInMinutes($now);
            if ($elapsed > $duration + 30) {
                $s->sStatus      = 'submitted';
                $s->sSubmit_time = Carbon::parse($s->sStart_time)->addMinutes($duration);
                $s->save();
                $cleaned++;
            }
        }

        return response()->json(['status' => 'success', 'cleaned' => $cleaned]);
    }

    /**
     * GET /teacher/dashboard/statistics?period=24h|7d|30d
     */
    public function statistics(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'teacher') {
            return response()->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $period = $request->get('period', '7d');
        $now    = Carbon::now();

        switch ($period) {
            case '24h':
                $since     = $now->copy()->subHours(24);
                $groupBy   = 'hour';
                $labels    = collect(range(0, 23))->map(fn ($h) =>
                    $now->copy()->subHours(23 - $h)->format('H:00')
                );
                break;
            case '30d':
                $since     = $now->copy()->subDays(30);
                $groupBy   = 'day';
                $labels    = collect(range(0, 29))->map(fn ($d) =>
                    $now->copy()->subDays(29 - $d)->format('d/m')
                );
                break;
            default: // 7d
                $since     = $now->copy()->subDays(7);
                $groupBy   = 'day';
                $labels    = collect(range(0, 6))->map(fn ($d) =>
                    $now->copy()->subDays(6 - $d)->format('d/m')
                );
        }

        $myExamIds = Exam::where('eTeacher_id', $user->uId)->pluck('eId');

        $submissions = Submission::with(['exam:eId,eTitle,eType,ePurpose', 'user:uId,uName'])
            ->whereIn('exam_id', $myExamIds)
            ->whereNotNull('sStart_time')
            ->where('sStart_time', '>=', $since)
            ->whereNotIn('sStatus', ['draft'])
            ->get();

        // Summary
        $examSessions     = $submissions->filter(fn ($s) => !in_array($s->exam->ePurpose ?? '', ['practice', 'review']))->count();
        $practiceSessions = $submissions->filter(fn ($s) => in_array($s->exam->ePurpose ?? '', ['practice', 'review']))->count();
        $totalSessions    = $submissions->count();
        $completed        = $submissions->filter(fn ($s) => !in_array($s->sStatus, ['in_progress', 'draft']))->count();
        $completionRate   = $totalSessions > 0 ? round(($completed / $totalSessions) * 100) : 0;
        $uniqueStudents   = $submissions->pluck('user_id')->unique()->count();

        $scores     = $submissions->filter(fn ($s) => $s->sScore !== null)->pluck('sScore');
        $avgScore   = $scores->count() > 0 ? round($scores->avg(), 1) : null;

        // Timeline
        $timeline = $labels->map(function ($label) use ($submissions, $groupBy, $now) {
            $examCount = $submissions->filter(function ($s) use ($label, $groupBy, $now) {
                $t = Carbon::parse($s->sStart_time);
                $lbl = $groupBy === 'hour' ? $t->format('H:00') : $t->format('d/m');
                return $lbl === $label && !in_array($s->exam->ePurpose ?? '', ['practice', 'review']);
            })->count();

            $practiceCount = $submissions->filter(function ($s) use ($label, $groupBy) {
                $t = Carbon::parse($s->sStart_time);
                $lbl = $groupBy === 'hour' ? $t->format('H:00') : $t->format('d/m');
                return $lbl === $label && in_array($s->exam->ePurpose ?? '', ['practice', 'review']);
            })->count();

            return ['label' => $label, 'exam' => $examCount, 'practice' => $practiceCount];
        })->values();

        // Top students
        $topStudents = $submissions->groupBy('user_id')->map(function ($group) {
            $first       = $group->first();
            $uName       = $first->user->uName ?? 'Unknown';
            $words       = preg_split('/\s+/', trim($uName));
            $avatar      = strtoupper(mb_substr(end($words), 0, 2));
            $examCount   = $group->filter(fn ($s) => !in_array($s->exam->ePurpose ?? '', ['practice', 'review']))->count();
            $practCount  = $group->filter(fn ($s) => in_array($s->exam->ePurpose ?? '', ['practice', 'review']))->count();
            return [
                'id'             => $first->user->uId ?? null,
                'name'           => $uName,
                'avatar'         => $avatar,
                'exam_count'     => $examCount,
                'practice_count' => $practCount,
                'total'          => $group->count(),
            ];
        })->sortByDesc('total')->take(10)->values();

        // Top exams
        $topExams = $submissions->groupBy('exam_id')->map(function ($group) {
            $first    = $group->first();
            $attempts = $group->count();
            $done     = $group->filter(fn ($s) => !in_array($s->sStatus, ['in_progress', 'draft']))->count();
            return [
                'id'              => $first->exam->eId ?? null,
                'title'           => $first->exam->eTitle ?? '—',
                'type'            => $first->exam->eType  ?? 'General',
                'purpose'         => $first->exam->ePurpose ?? 'exam',
                'attempts'        => $attempts,
                'completion_rate' => $attempts > 0 ? round(($done / $attempts) * 100) : 0,
            ];
        })->sortByDesc('attempts')->take(10)->values();

        return response()->json([
            'status' => 'success',
            'data'   => [
                'period'   => $period,
                'summary'  => [
                    'total_sessions'    => $totalSessions,
                    'exam_sessions'     => $examSessions,
                    'practice_sessions' => $practiceSessions,
                    'completion_rate'   => $completionRate,
                    'avg_score'         => $avgScore,
                    'unique_students'   => $uniqueStudents,
                ],
                'timeline'     => $timeline,
                'top_students' => $topStudents,
                'top_exams'    => $topExams,
            ],
        ]);
    }

    /**
     * GET /teacher/dashboard/monitoring-stats
     * Stats: active now, total today, completion rate, etc.
     */
    public function stats(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'teacher') {
            return response()->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $myExamIds = Exam::where('eTeacher_id', $user->uId)->pluck('eId');

        $today = Carbon::today();

        $activeNow = Submission::whereIn('exam_id', $myExamIds)
            ->where('sStatus', 'in_progress')
            ->count();

        $submittedToday = Submission::whereIn('exam_id', $myExamIds)
            ->whereNotIn('sStatus', ['draft', 'in_progress'])
            ->whereDate('sSubmit_time', $today)
            ->count();

        $startedToday = Submission::whereIn('exam_id', $myExamIds)
            ->where('sStatus', 'in_progress')
            ->whereDate('sStart_time', $today)
            ->count();

        $todaySessions = $submittedToday + $startedToday;

        $completedToday = Submission::whereIn('exam_id', $myExamIds)
            ->whereIn('sStatus', ['graded', 'ai_graded', 'partially_graded', 'submitted'])
            ->whereDate('sSubmit_time', $today)
            ->count();

        $completionRate = $todaySessions > 0
            ? round(($completedToday / $todaySessions) * 100)
            : 0;

        return response()->json([
            'status' => 'success',
            'data'   => [
                'active_now'       => $activeNow,
                'total_today'      => $todaySessions,
                'completion_rate'  => $completionRate,
                'connected'        => $activeNow,
            ],
        ]);
    }
    /**
     * GET /teacher/dashboard/recent-submissions
     * Bài đã nộp (assigned) trong 2 giờ gần nhất — dùng cho bell notification GV
     */
    public function recentSubmissions(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'teacher') {
            return response()->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $since = Carbon::now()->subHours(2);

        $submissions = Submission::with([
                'user:uId,uName,age_group',
                'exam:eId,eTitle,eType,eTeacher_id',
            ])
            ->whereNotNull('assignment_id')
            ->whereIn('sStatus', ['submitted', 'grading_subjective', 'partially_graded'])
            ->where('sSubmit_time', '>=', $since)
            ->whereHas('exam', function ($q) use ($user) {
                $q->where('eTeacher_id', $user->uId);
            })
            ->orderBy('sSubmit_time', 'desc')
            ->limit(20)
            ->get();

        $now = Carbon::now();

        $data = $submissions->map(function ($s) use ($now) {
            $submittedAt = $s->sSubmit_time ? Carbon::parse($s->sSubmit_time) : $now;
            $uName       = $s->user->uName ?? 'Unknown';
            $words       = preg_split('/\s+/', trim($uName));
            $avatar      = strtoupper(mb_substr(end($words), 0, 2));

            $ageGroup    = $s->user->age_group ?? '';
            $ageLabels = ['kids' => 'Trẻ em', 'teens' => 'Thiếu niên', 'adults' => 'Người lớn'];
            $ageLabel  = $ageLabels[strtolower($ageGroup)] ?? $ageGroup;

            return [
                'id'             => $s->sId,
                'student_name'   => $uName,
                'avatar'         => $avatar,
                'age_group'      => strtolower($ageGroup),
                'age_label'      => $ageLabel,
                'exam_title'     => $s->exam->eTitle ?? '—',
                'exam_type'      => $s->exam->eType  ?? 'General',
                'submitted_at'   => $submittedAt->toIso8601String(),
                'elapsed_min'    => (int) $submittedAt->diffInMinutes($now),
                'auto_submitted' => !is_null($s->auto_submit_reason),
            ];
        });

        return response()->json(['status' => 'success', 'data' => $data]);
    }
}

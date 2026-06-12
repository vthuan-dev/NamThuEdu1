<?php

namespace App\Http\Controllers;

use App\Models\Submission;
use Illuminate\Http\Request;

class StudentAnalyticsController extends Controller
{
    public function overview(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'student') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $query = Submission::where(function ($q) use ($user) {
                $q->where('user_id', $user->uId)
                  ->orWhere('sStudent_id', $user->uId);
            })
            ->whereIn('sStatus', ['graded', 'auto_submitted']);

        $all = $query->get();
        $scores = $all->pluck('sScore')->filter(fn($s) => $s !== null)->map(fn($s) => (float)$s)->values();

        return response()->json([
            'status' => 'success',
            'data' => [
                'total_submissions' => $all->count(),
                'average_score' => $scores->count() ? round($scores->avg(), 2) : 0,
                'highest_score' => $scores->count() ? $scores->max() : 0,
                'lowest_score' => $scores->count() ? $scores->min() : 0,
                'recent_10_avg' => $scores->take(-10)->count() ? round($scores->take(-10)->avg(), 2) : 0,
            ],
        ]);
    }

    public function skills(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'student') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $submissions = Submission::with('exam')
            ->where(function ($q) use ($user) {
                $q->where('user_id', $user->uId)
                  ->orWhere('sStudent_id', $user->uId);
            })
            ->whereIn('sStatus', ['graded', 'auto_submitted'])
            ->get();

        $skills = ['listening', 'reading', 'writing', 'speaking'];
        $result = [];
        foreach ($skills as $skill) {
            $skillSubs = $submissions->filter(function ($s) use ($skill) {
                return $s->exam && strtolower((string)$s->exam->eSkill) === $skill && $s->sScore !== null;
            });
            $scores = $skillSubs->pluck('sScore')->map(fn($s) => (float)$s);
            $result[$skill] = [
                'attempts' => $skillSubs->count(),
                'average_score' => $scores->count() ? round($scores->avg(), 2) : 0,
                'best_score' => $scores->count() ? $scores->max() : 0,
            ];
        }

        return response()->json([
            'status' => 'success',
            'data' => $result,
        ]);
    }

    /**
     * GET /student/analytics/today
     * Tổng thời gian học trong ngày hôm nay (phút) để hiển thị "Mục tiêu hôm nay".
     * Tính từ các submission có hoạt động trong ngày: ưu tiên (sSubmit_time - sStart_time),
     * fallback cho bài đang làm dở là (now - sStart_time).
     */
    public function today(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'student') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $startOfDay = now()->startOfDay();
        $endOfDay   = now()->endOfDay();

        $submissions = Submission::where(function ($q) use ($user) {
                $q->where('user_id', $user->uId)
                  ->orWhere('sStudent_id', $user->uId);
            })
            ->whereNotNull('sStart_time')
            ->where(function ($q) use ($startOfDay, $endOfDay) {
                $q->whereBetween('sSubmit_time', [$startOfDay, $endOfDay])
                  ->orWhereBetween('sStart_time', [$startOfDay, $endOfDay]);
            })
            ->get();

        $minutes = 0;
        $sessions = 0;
        foreach ($submissions as $s) {
            $start = $s->sStart_time ? \Carbon\Carbon::parse($s->sStart_time) : null;
            if (!$start) {
                continue;
            }
            $end = $s->sSubmit_time ? \Carbon\Carbon::parse($s->sSubmit_time) : now();
            // Chỉ cộng phần thời gian rơi vào hôm nay
            $effectiveStart = $start->greaterThan($startOfDay) ? $start : $startOfDay;
            if ($end->lessThanOrEqualTo($effectiveStart)) {
                continue;
            }
            $minutes += $effectiveStart->diffInMinutes($end, true);
            $sessions++;
        }

        $dailyGoal = (int) ($user->daily_goal_minutes ?: 30); // phút/ngày — giáo viên đặt cho từng học viên, fallback 30
        $minutes = (int) round($minutes);

        return response()->json([
            'status' => 'success',
            'data' => [
                'today_minutes'   => $minutes,
                'daily_goal'      => $dailyGoal,
                'goal_percentage' => $dailyGoal > 0 ? min(100, (int) round(($minutes / $dailyGoal) * 100)) : 0,
                'sessions'        => $sessions,
            ],
        ]);
    }

    public function weaknesses(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'student') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $submissions = Submission::with('exam')
            ->where(function ($q) use ($user) {
                $q->where('user_id', $user->uId)
                  ->orWhere('sStudent_id', $user->uId);
            })
            ->whereIn('sStatus', ['graded', 'auto_submitted'])
            ->get();

        $skills = ['listening', 'reading', 'writing', 'speaking'];
        $skillAverages = collect($skills)->map(function ($skill) use ($submissions) {
            $scores = $submissions->filter(function ($s) use ($skill) {
                return $s->exam && strtolower((string)$s->exam->eSkill) === $skill && $s->sScore !== null;
            })->pluck('sScore')->map(fn($s) => (float)$s);
            return [
                'skill' => $skill,
                'average_score' => $scores->count() ? round($scores->avg(), 2) : 0,
                'attempts' => $scores->count(),
            ];
        })->sortBy('average_score')->values();

        return response()->json([
            'status' => 'success',
            'data' => [
                'weakest_skills' => $skillAverages->take(2)->values(),
                'all_skills' => $skillAverages,
            ],
        ]);
    }

    public function history(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->uRole !== 'student') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $rows = Submission::with('exam')
            ->where(function ($q) use ($user) {
                $q->where('user_id', $user->uId)
                  ->orWhere('sStudent_id', $user->uId);
            })
            ->whereIn('sStatus', ['graded', 'auto_submitted'])
            ->orderByDesc('sSubmit_time')
            ->paginate($request->get('per_page', 20));

        $history = collect($rows->items())->map(function ($s) {
            return [
                'submission_id' => $s->sId,
                'score' => $s->sScore,
                'submitted_at' => $s->sSubmit_time,
                'exam' => $s->exam ? [
                    'id' => $s->exam->eId,
                    'title' => $s->exam->eTitle,
                    'skill' => $s->exam->eSkill,
                ] : null,
            ];
        })->values();

        return response()->json([
            'status' => 'success',
            'data' => [
                'history' => $history,
                'pagination' => [
                    'current_page' => $rows->currentPage(),
                    'last_page' => $rows->lastPage(),
                    'per_page' => $rows->perPage(),
                    'total' => $rows->total(),
                ],
            ],
        ]);
    }
}

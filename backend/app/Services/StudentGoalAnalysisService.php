<?php

namespace App\Services;

use App\Models\Submission;
use App\Models\StudentGoal;
use App\Models\StudentGoalAnalysis;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

/**
 * Phân tích tiến độ học viên so với mục tiêu (VD: B2) bằng Groq LLM.
 *
 * Luồng:
 *   1. gatherPerformance(): gom điểm tổng, theo từng kỹ năng (L/R/W/S),
 *      lịch sử bài thi gần đây, xu hướng.
 *   2. analyze(): dựng prompt mạnh → gọi Groq → trả JSON có cấu trúc và cache.
 *
 * Config: GROQ_API_KEY, GROQ_MODEL trong .env (đã dùng cho chấm điểm).
 */
class StudentGoalAnalysisService
{
    private const LLM_URL = 'https://api.groq.com/openai/v1/chat/completions';
    private const SKILLS  = ['listening', 'reading', 'writing', 'speaking'];

    /**
     * Gom dữ liệu hiệu suất của học viên để feed cho AI.
     */
    public function gatherPerformance(int $studentId): array
    {
        $subs = Submission::with('exam')
            ->where(function ($q) use ($studentId) {
                $q->where('user_id', $studentId)->orWhere('sStudent_id', $studentId);
            })
            ->whereIn('sStatus', ['graded', 'auto_submitted'])
            ->whereNotNull('sScore')
            ->orderByDesc('sSubmit_time')
            ->limit(200)
            ->get();

        $scores = $subs->pluck('sScore')->map(fn ($s) => (float) $s);

        // Thống kê theo kỹ năng.
        $bySkill = [];
        foreach (self::SKILLS as $skill) {
            $skillSubs = $subs->filter(fn ($s) => $s->exam && strtolower((string) $s->exam->eSkill) === $skill);
            $sc = $skillSubs->pluck('sScore')->map(fn ($s) => (float) $s);
            $recent = $sc->take(5)->values()->all();
            $bySkill[$skill] = [
                'attempts'       => $sc->count(),
                'average'        => $sc->count() ? round($sc->avg(), 2) : null,
                'best'           => $sc->count() ? round($sc->max(), 2) : null,
                'latest'         => $sc->count() ? round($sc->first(), 2) : null,
                'recent_scores'  => $recent,
            ];
        }

        // Lịch sử 15 bài gần nhất (đủ để AI thấy xu hướng).
        $recentHistory = $subs->take(15)->map(function ($s) {
            return [
                'date'   => $s->sSubmit_time ? Carbon::parse($s->sSubmit_time)->toDateString() : null,
                'exam'   => $s->exam->eTitle ?? ('Đề #' . $s->exam_id),
                'skill'  => $s->exam->eSkill ?? null,
                'type'   => $s->exam->eType ?? null,
                'target_level' => $s->exam->eTarget_level ?? null,
                'score'  => round((float) $s->sScore, 2),
                'max'    => $s->exam->eTotal_score ?? 10,
            ];
        })->values()->all();

        // Xu hướng: so trung bình 5 bài gần nhất với 5 bài trước đó.
        $recent5 = $scores->take(5);
        $prev5   = $scores->slice(5, 5);
        $trend = 'không đủ dữ liệu';
        if ($recent5->count() && $prev5->count()) {
            $diff = $recent5->avg() - $prev5->avg();
            $trend = $diff > 0.3 ? 'đang tiến bộ' : ($diff < -0.3 ? 'đang giảm' : 'ổn định');
        }

        return [
            'total_attempts' => $subs->count(),
            'overall_average' => $scores->count() ? round($scores->avg(), 2) : null,
            'overall_best'    => $scores->count() ? round($scores->max(), 2) : null,
            'recent_average'  => $recent5->count() ? round($recent5->avg(), 2) : null,
            'trend'           => $trend,
            'by_skill'        => $bySkill,
            'recent_history'  => $recentHistory,
        ];
    }

    /**
     * Lấy tóm tắt các lần phân tích trước (mới nhất trước) để AI hiểu quá khứ.
     */
    public function recentAnalyses(int $studentId, int $limit = 3): array
    {
        return StudentGoalAnalysis::where('student_id', $studentId)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(function ($a) {
                $an = $a->analysis ?? [];
                return [
                    'date'                  => optional($a->created_at)->toDateString(),
                    'progress_percent'      => $a->overall_progress_percent,
                    'current_level'         => $a->current_level_estimate,
                    'on_track'              => $a->on_track,
                    'top_weaknesses'        => array_slice($an['weaknesses'] ?? [], 0, 3),
                    'recommended_actions'   => array_slice($an['priority_actions'] ?? [], 0, 3),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Phân tích mục tiêu bằng AI; trả mảng kết quả (đã cache vào goal).
     */
    public function analyze(StudentGoal $goal): array
    {
        $student = User::where('uId', $goal->student_id)->first();
        $perf = $this->gatherPerformance($goal->student_id);

        if (($perf['total_attempts'] ?? 0) === 0) {
            $fallback = [
                'has_data' => false,
                'summary' => 'Học viên chưa có bài thi nào được chấm. Hãy giao một vài đề để hệ thống có dữ liệu phân tích tiến độ.',
                'current_level_estimate' => null,
                'overall_progress_percent' => 0,
                'on_track' => null,
                'skills' => [],
                'weaknesses' => [],
                'priority_actions' => ['Giao đề đầu vào để xác định trình độ hiện tại của học viên.'],
                'estimated_sessions_to_goal' => null,
                'encouragement' => 'Bắt đầu hành trình chinh phục mục tiêu nào!',
            ];
            $goal->ai_analysis = $fallback;
            $goal->ai_analyzed_at = now();
            $goal->save();
            return $fallback;
        }

        $payload = [
            'student_name' => $student->uName ?? 'Học viên',
            'goal' => [
                'target_level'  => $goal->target_level,
                'target_skill'  => $goal->target_skill ?: 'overall',
                'exam_type'     => $goal->exam_type,
                'target_date'   => optional($goal->target_date)->toDateString(),
                'today'         => now()->toDateString(),
                'teacher_note'  => $goal->note,
            ],
            'performance' => $perf,
            'previous_analyses' => $this->recentAnalyses($goal->student_id, 3),
        ];

        $system = $this->buildSystemPrompt();
        $user = "Dữ liệu học viên (JSON):\n" . json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
            . "\n\nHãy phân tích và trả về DUY NHẤT một JSON theo đúng schema đã quy định.";

        $result = $this->callGroq($system, $user);

        if (empty($result)) {
            // Giữ phân tích cũ nếu có; nếu không, trả lỗi mềm.
            $result = $goal->ai_analysis ?: [
                'has_data' => true,
                'summary' => 'Hiện chưa phân tích được bằng AI (dịch vụ bận). Vui lòng thử lại sau.',
                'skills' => [],
                'weaknesses' => [],
                'priority_actions' => [],
            ];
            $result['error'] = true;
            return $result;
        }

        $result['has_data'] = true;
        $goal->ai_analysis = $result;
        $goal->ai_analyzed_at = now();
        $goal->save();

        // Lưu lịch sử phân tích để truy xuất + nạp lại cho AI lần sau.
        try {
            StudentGoalAnalysis::create([
                'student_id'               => $goal->student_id,
                'goal_id'                  => $goal->id,
                'target_level'             => $goal->target_level,
                'overall_progress_percent' => is_numeric($result['overall_progress_percent'] ?? null)
                    ? max(0, min(100, (int) round($result['overall_progress_percent']))) : null,
                'current_level_estimate'   => $result['current_level_estimate'] ?? null,
                'on_track'                 => array_key_exists('on_track', $result) ? $result['on_track'] : null,
                'analysis'                 => $result,
                'performance_snapshot'     => $perf,
            ]);
        } catch (\Exception $e) {
            Log::warning('StudentGoalAnalysis history save failed: ' . $e->getMessage());
        }

        return $result;
    }

    private function buildSystemPrompt(): string
    {
        return <<<PROMPT
Bạn là CHUYÊN GIA KHẢO THÍ tiếng Anh cấp cao, am hiểu sâu khung CEFR (A1–C2), IELTS (band 0–9), VSTEP (bậc 1–6 ↔ A1–C1) và thi THPT. Bạn phân tích dữ liệu kết quả luyện thi của học viên để đánh giá tiến độ tới một mục tiêu cụ thể (VD: B2) và đưa ra tư vấn HÀNH ĐỘNG cho giáo viên.

NGUYÊN TẮC:
- Điểm bài thi (score) theo thang của từng đề (max kèm theo, thường 0–10; nếu là IELTS thì là band 0–9). Hãy quy đổi hợp lý về khung CEFR khi ước lượng trình độ.
- Bám sát DỮ LIỆU được cung cấp; KHÔNG bịa số liệu. Nếu một kỹ năng chưa có bài làm, ghi rõ "chưa có dữ liệu" và đề xuất cho luyện kỹ năng đó.
- Đối chiếu trình độ hiện tại với mục tiêu: nêu RÕ còn thiếu bao nhiêu, thiếu kỹ năng nào, cần làm gì để đạt.
- Văn phong tiếng Việt, ngắn gọn, thực dụng, dành cho giáo viên. Mỗi gạch đầu dòng là một ý hành động cụ thể (không chung chung).
- Tham chiếu mốc CEFR ↔ điểm để ước lượng: ví dụ thang /10: A2≈4–5, B1≈5.5–6.5, B2≈7–8, C1≈8.5–9.5 (điều chỉnh theo loại đề nếu cần).
- Nếu có trường "previous_analyses" (các lần phân tích trước, mới nhất trước): hãy SO SÁNH theo thời gian — ghi nhận đã tiến bộ/chững lại ở đâu so với lần trước, kiểm tra các "recommended_actions" trước đó đã có kết quả chưa, và NÂNG CẤP lời khuyên (không lặp lại y hệt). Nếu tiến bộ rõ, hãy động viên cụ thể; nếu giậm chân, đề xuất hướng khác.

CHỈ TRẢ VỀ MỘT JSON HỢP LỆ (không markdown, không giải thích ngoài JSON) theo schema:
{
  "current_level_estimate": "string (VD: B1, hoặc 'B1+')",
  "overall_progress_percent": number (0-100, mức độ đạt mục tiêu hiện tại),
  "on_track": boolean (có đang đi đúng lộ trình tới mục tiêu/đúng hạn không),
  "gap_summary": "string (1-2 câu: còn cách mục tiêu bao xa, điều cốt lõi cần cải thiện)",
  "skills": [
    {
      "skill": "listening|reading|writing|speaking",
      "current_score": number|null,
      "current_level": "string|null (CEFR ước lượng cho kỹ năng)",
      "target_hint": "string (mức cần đạt cho kỹ năng này để chạm mục tiêu)",
      "status": "achieved|on_track|behind|no_data",
      "gap_note": "string (còn thiếu gì ở kỹ năng này)"
    }
  ],
  "weaknesses": ["string (điểm yếu cụ thể, ưu tiên giảm dần)"],
  "priority_actions": ["string (việc cần làm ngay, cụ thể: dạng bài, kỹ năng, tần suất)"],
  "estimated_sessions_to_goal": number|null (ước lượng số buổi/đề luyện cần thêm để đạt),
  "encouragement": "string (1 câu động viên ngắn cho học viên)"
}
PROMPT;
    }

    private function callGroq(string $system, string $user): array
    {
        $apiKey = config('services.groq.api_key');
        if (!$apiKey) {
            Log::warning('StudentGoalAnalysis: GROQ_API_KEY not set');
            return [];
        }

        try {
            $resp = Http::withToken($apiKey)
                ->withOptions(['verify' => config('services.groq.verify_ssl', true)])
                ->timeout(45)
                ->post(self::LLM_URL, [
                    'model' => env('GROQ_MODEL', 'llama-3.3-70b-versatile'),
                    'temperature' => 0.3,
                    'max_tokens' => 1500,
                    'response_format' => ['type' => 'json_object'],
                    'messages' => [
                        ['role' => 'system', 'content' => $system],
                        ['role' => 'user', 'content' => $user],
                    ],
                ]);

            if (!$resp->successful()) {
                Log::error('StudentGoalAnalysis Groq HTTP ' . $resp->status() . ': ' . $resp->body());
                return [];
            }

            $content = $resp->json('choices.0.message.content');
            if (!$content) {
                return [];
            }
            $parsed = json_decode($content, true);
            return is_array($parsed) ? $parsed : [];
        } catch (\Exception $e) {
            Log::error('StudentGoalAnalysis Groq error: ' . $e->getMessage());
            return [];
        }
    }
}

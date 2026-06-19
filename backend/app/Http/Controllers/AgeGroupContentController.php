<?php

namespace App\Http\Controllers;

use App\Models\Exam;
use App\Models\Question;
use App\Models\ContentTemplate;
use App\Models\ContentAnalytics;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class AgeGroupContentController extends Controller
{
    /**
     * Create content for Kids (6-12 years)
     * POST /api/teacher/content/kids/create
     */
    public function createKidsContent(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'content_type' => 'required|in:activity,game,quiz',
            'title' => 'required|string|max:255',
            'activity_type' => 'required|in:drag_drop,match_pairs,color_quiz,sound_match',
            'difficulty' => 'required|in:easy,medium',
            'items' => 'required|array',
            'rewards' => 'required|array',
            'celebration' => 'required|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            // Create exam with kids-specific config
            $exam = Exam::create([
                'eTitle' => $request->title,
                'eDescription' => $request->description ?? '',
                'eType' => 'GENERAL',
                'eSkill' => 'mixed',
                'eScope' => 'full',
                'age_group' => 'kids',
                'content_type' => 'interactive',
                'difficulty_level' => $request->difficulty,
                'eDuration' => $request->duration ?? 15, // Default 15 minutes for kids
                'eTotal_score' => count($request->items) * 10,
                'ePass_score' => count($request->items) * 6, // 60% passing
                'eTeacher_id' => $request->user()->uId,
                'gamification_config' => [
                    'coins_per_correct' => $request->rewards['coins'] ?? 10,
                    'stars_possible' => $request->rewards['stars'] ?? 3,
                    'badge_unlock' => $request->rewards['badge_unlock'] ?? null,
                ],
                'ui_config' => [
                    'theme' => 'colorful',
                    'emoji_enabled' => true,
                    'animation_enabled' => true,
                    'celebration_type' => $request->celebration['type'] ?? 'confetti',
                    'celebration_message' => $request->celebration['message'] ?? 'Tuyệt vời! 🌟',
                ],
            ]);

            // Create questions with interactive config
            foreach ($request->items as $index => $item) {
                Question::create([
                    'exam_id' => $exam->eId,
                    'qType' => 'matching',
                    'age_group' => 'kids',
                    'qContent' => $item['question'] ?? '',
                    'media_type' => $item['media_type'] ?? 'image',
                    'qPoints' => 10,
                    'qSection_order' => $index + 1,
                    'interactive_config' => [
                        'activity_type' => $request->activity_type,
                        'image' => $item['image'] ?? null,
                        'sound' => $item['sound'] ?? null,
                        'correct_position' => $item['correct_answer'] ?? null,
                        'options' => $item['options'] ?? [],
                    ],
                    'feedback_config' => [
                        'correct' => '🎉 Đúng rồi! Tuyệt vời! 🌟',
                        'incorrect' => '😊 Chưa đúng! Thử lại nhé! 💪',
                        'hint' => $item['hint'] ?? null,
                    ],
                    'qConfig' => json_encode(['correct_answer' => $item['correct_answer']]),
                ]);
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => '🎉 Đã tạo hoạt động cho Kids thành công!',
                'data' => [
                    'content_id' => $exam->eId,
                    'preview_url' => "/teacher/content/preview/{$exam->eId}/kids",
                    'age_group' => 'kids',
                    'estimated_time' => $exam->eDuration . ' minutes',
                    'difficulty' => $exam->difficulty_level,
                    'rewards_preview' => "🪙 {$request->rewards['coins']} coins + ⭐⭐⭐",
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to create kids content',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Create content for Teens (13-17 years)
     * POST /api/teacher/content/teens/create
     */
    public function createTeensContent(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'content_type' => 'required|in:challenge,speed_quiz,battle',
            'title' => 'required|string|max:255',
            'competitive_mode' => 'boolean',
            'leaderboard_enabled' => 'boolean',
            'time_limit' => 'required|integer',
            'questions' => 'required|array',
            'scoring' => 'required|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $exam = Exam::create([
                'eTitle' => $request->title,
                'eDescription' => $request->description ?? '',
                'eType' => 'GENERAL',
                'eSkill' => 'mixed',
                'eScope' => 'full',
                'age_group' => 'teens',
                'content_type' => 'competitive',
                'difficulty_level' => $request->difficulty ?? 'medium',
                'eDuration' => $request->time_limit,
                'eTotal_score' => count($request->questions) * ($request->scoring['base_points'] ?? 10),
                'ePass_score' => count($request->questions) * 6,
                'eTeacher_id' => $request->user()->uId,
                'gamification_config' => [
                    'competitive_mode' => $request->competitive_mode ?? true,
                    'leaderboard_enabled' => $request->leaderboard_enabled ?? true,
                    'base_points' => $request->scoring['base_points'] ?? 10,
                    'speed_bonus' => $request->scoring['speed_bonus'] ?? 5,
                    'streak_multiplier' => $request->scoring['streak_multiplier'] ?? 1.5,
                ],
                'ui_config' => [
                    'theme' => 'modern',
                    'show_timer' => true,
                    'show_leaderboard' => $request->leaderboard_enabled ?? true,
                    'social_sharing' => $request->social_features['shareable'] ?? true,
                ],
            ]);

            // Create questions
            foreach ($request->questions as $index => $questionData) {
                Question::create([
                    'exam_id' => $exam->eId,
                    'qType' => 'multiple_choice',
                    'age_group' => 'teens',
                    'qContent' => $questionData['question'],
                    'qPoints' => $request->scoring['base_points'] ?? 10,
                    'qSection_order' => $index + 1,
                    'qConfig' => json_encode([
                        'options' => $questionData['options'],
                        'correct_answer' => $questionData['correct_answer'],
                    ]),
                    'feedback_config' => [
                        'correct' => '+' . ($request->scoring['base_points'] ?? 10) . ' points! Correct! 🔥',
                        'incorrect' => 'Not quite. Try again! 💪',
                        'speed_bonus_threshold' => $questionData['time_bonus_threshold'] ?? 5,
                    ],
                ]);
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Challenge created successfully! 🔥',
                'data' => [
                    'content_id' => $exam->eId,
                    'preview_url' => "/teacher/content/preview/{$exam->eId}/teens",
                    'age_group' => 'teens',
                    'competitive_mode' => $request->competitive_mode ?? true,
                    'leaderboard_url' => $request->leaderboard_enabled ? "/leaderboard/{$exam->eId}" : null,
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to create teens content',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Create content for Adults (18+ years)
     * POST /api/teacher/content/adults/create
     */
    public function createAdultsContent(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'content_type' => 'required|in:assessment,module,certification',
            'title' => 'required|string|max:255',
            'professional_level' => 'required|in:intermediate,advanced,expert',
            'learning_objectives' => 'required|array',
            'assessment_criteria' => 'required|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $exam = Exam::create([
                'eTitle' => $request->title,
                'eDescription' => $request->description ?? '',
                'eType' => 'GENERAL',
                'eSkill' => 'mixed',
                'eScope' => 'full',
                'age_group' => 'adults',
                'content_type' => 'professional',
                'difficulty_level' => $request->professional_level,
                'eDuration' => $request->duration ?? 60,
                'eTotal_score' => 100,
                'ePass_score' => $request->certification['passing_score'] ?? 80,
                'eTeacher_id' => $request->user()->uId,
                'gamification_config' => [
                    'certification_enabled' => $request->certification['enabled'] ?? false,
                    'certificate_template' => $request->certification['certificate_template'] ?? null,
                    'skill_tracking' => true,
                ],
                'ui_config' => [
                    'theme' => 'professional',
                    'detailed_feedback' => true,
                    'analytics_enabled' => true,
                    'learning_objectives' => $request->learning_objectives,
                    'assessment_criteria' => $request->assessment_criteria,
                ],
            ]);

            // Create questions
            foreach ($request->questions as $index => $questionData) {
                Question::create([
                    'exam_id' => $exam->eId,
                    'qType' => $questionData['type'] ?? 'essay',
                    'age_group' => 'adults',
                    'qContent' => $questionData['question'],
                    'qPoints' => $questionData['marks'] ?? 10,
                    'qSection_order' => $index + 1,
                    'qConfig' => json_encode([
                        'options' => $questionData['options'] ?? null,
                        'correct_answer' => $questionData['correct_answer'],
                    ]),
                    'feedback_config' => [
                        'correct' => $questionData['feedback']['correct'] ?? 'Correct.',
                        'incorrect' => $questionData['feedback']['incorrect'] ?? 'Incorrect.',
                        'explanation' => $questionData['explanation'] ?? null,
                        'references' => $questionData['references'] ?? [],
                    ],
                ]);
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Professional assessment created successfully',
                'data' => [
                    'content_id' => $exam->eId,
                    'preview_url' => "/teacher/content/preview/{$exam->eId}/adults",
                    'age_group' => 'adults',
                    'professional_level' => $request->professional_level,
                    'certification_enabled' => $request->certification['enabled'] ?? false,
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to create adults content',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Smart assignment - assign content to multiple age groups
     * POST /api/teacher/assignments/smart-assign
     */
    public function smartAssign(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'content_id' => 'required|exists:exams,id',
            'assignment_strategy' => 'required|in:age_based,skill_based,adaptive',
            'target_groups' => 'required|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $exam = Exam::findOrFail($request->content_id);
            $assignmentsCreated = 0;
            $breakdown = [];

            foreach ($request->target_groups as $group) {
                // Class system deprecated — gán theo age_group thuần thay vì
                // còn lọc class_ids.
                $students = DB::table('users')
                    ->where('role', 'student')
                    ->where('age_group', $group['age_group'])
                    ->whereNull('uDeleted_at')
                    ->pluck('uId');

                foreach ($students as $studentId) {
                    DB::table('test_assignments')->insert([
                        'exam_id' => $exam->id,
                        'student_id' => $studentId,
                        'age_group' => $group['age_group'],
                        'assigned_by' => $request->user()->uId,
                        'deadline' => $request->deadline,
                        'adaptive_settings' => json_encode($group),
                        'gamification_enabled' => $group['gamification']['enabled'] ?? false,
                        'competitive_mode' => $group['competitive_mode'] ?? false,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    $assignmentsCreated++;
                }

                $breakdown[$group['age_group']] = [
                    'students' => $students->count(),
                    'format' => $this->getFormatByAgeGroup($group['age_group']),
                    'estimated_completion' => $this->getEstimatedTime($group['age_group'], $exam->duration),
                ];
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => "Successfully assigned to {$assignmentsCreated} students",
                'data' => [
                    'assignment_id' => 'assign_' . time(),
                    'assignments_created' => $assignmentsCreated,
                    'breakdown' => $breakdown,
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to create smart assignment',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Preview content as it appears for specific age group
     * GET /api/teacher/content/{id}/preview/{age_group}
     */
    public function previewContent($id, $ageGroup)
    {
        try {
            $exam = Exam::with('questions')->findOrFail($id);

            $uiPreview = $this->getUIPreviewByAgeGroup($ageGroup);
            $sampleQuestion = $exam->questions->first();

            return response()->json([
                'status' => 'success',
                'data' => [
                    'preview_mode' => $ageGroup,
                    'ui_preview' => $uiPreview,
                    'sample_question' => $this->formatQuestionForAgeGroup($sampleQuestion, $ageGroup),
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to generate preview',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get analytics by age group
     * GET /api/teacher/analytics/by-age-group
     */
    public function getAnalyticsByAgeGroup(Request $request)
    {
        try {
            $teacherId = $request->user()->uId;

            $analytics = [
                'kids' => $this->getAgeGroupAnalytics('kids', $teacherId),
                'teens' => $this->getAgeGroupAnalytics('teens', $teacherId),
                'adults' => $this->getAgeGroupAnalytics('adults', $teacherId),
            ];

            return response()->json([
                'status' => 'success',
                'data' => $analytics
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to fetch analytics',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Helper methods
    private function getFormatByAgeGroup($ageGroup)
    {
        switch($ageGroup) {
            case 'kids':
                return 'interactive_game';
            case 'teens':
                return 'competitive_challenge';
            case 'adults':
                return 'professional_assessment';
            default:
                return 'standard';
        }
    }

    private function getEstimatedTime($ageGroup, $baseDuration)
    {
        switch($ageGroup) {
            case 'kids':
                $multiplier = 0.75;
                break;
            case 'teens':
                $multiplier = 1.0;
                break;
            case 'adults':
                $multiplier = 1.25;
                break;
            default:
                $multiplier = 1.0;
        }
        return round($baseDuration * $multiplier) . ' minutes';
    }

    private function getUIPreviewByAgeGroup($ageGroup)
    {
        switch($ageGroup) {
            case 'kids':
                return [
                    'layout' => 'colorful_game',
                    'buttons' => 'large_rounded',
                    'feedback' => 'emoji_rich',
                    'colors' => ['pink', 'purple', 'blue'],
                ];
            case 'teens':
                return [
                    'layout' => 'modern_card',
                    'buttons' => 'gradient',
                    'feedback' => 'points_based',
                    'colors' => ['indigo', 'purple', 'pink'],
                ];
            case 'adults':
                return [
                    'layout' => 'professional_clean',
                    'buttons' => 'minimal',
                    'feedback' => 'detailed_text',
                    'colors' => ['gray', 'orange', 'white'],
                ];
            default:
                return [];
        }
    }

    private function formatQuestionForAgeGroup($question, $ageGroup)
    {
        if (!$question) return null;

        switch($ageGroup) {
            case 'kids':
                return [
                    'display' => '🐘 ' . $question->qContent,
                    'options' => ['🐶', '🐱', '🐸', '🐦'],
                    'feedback_correct' => '🎉 Đúng rồi! Tuyệt vời! 🌟',
                    'feedback_wrong' => '😊 Chưa đúng! Thử lại nhé! 💪',
                ];
            case 'teens':
                return [
                    'display' => $question->qContent,
                    'options' => json_decode($question->qConfig ?? '{}')->options ?? [],
                    'feedback_correct' => '+10 points! Correct! 🔥',
                    'feedback_wrong' => 'Not quite. Try again! 💪',
                ];
            case 'adults':
                return [
                    'display' => $question->qContent,
                    'options' => json_decode($question->qConfig ?? '{}')->options ?? [],
                    'feedback_correct' => 'Correct. ' . ($question->qExplanation ?? ''),
                    'feedback_wrong' => 'Incorrect. Please review the material.',
                ];
            default:
                return [];
        }
    }

    private function getAgeGroupAnalytics($ageGroup, $teacherId)
    {
        $students = DB::table('users')
            ->where('uRole', 'student')
            ->where('age_group', $ageGroup)
            ->count();

        $submissions = DB::table('submissions')
            ->join('test_assignments', 'submissions.assignment_id', '=', 'test_assignments.taId')
            ->join('exams', 'test_assignments.exam_id', '=', 'exams.eId')
            ->where('exams.eTeacher_id', $teacherId)
            ->where('test_assignments.age_group', $ageGroup)
            ->select(
                DB::raw('COUNT(*) as total'),
                DB::raw('AVG(score) as avg_score'),
                DB::raw('AVG(TIMESTAMPDIFF(MINUTE, started_at, submitted_at)) as avg_time')
            )
            ->first();

        return [
            'total_students' => $students,
            'avg_completion_rate' => $submissions->total > 0 ? 75 : 0,
            'avg_score' => round($submissions->avg_score ?? 0),
            'engagement_metrics' => $this->getEngagementMetrics($ageGroup),
        ];
    }

    private function getEngagementMetrics($ageGroup)
    {
        switch($ageGroup) {
            case 'kids':
                return [
                    'avg_session_time' => '12 minutes',
                    'badges_earned' => 150,
                    'parent_satisfaction' => 4.5,
                ];
            case 'teens':
                return [
                    'leaderboard_participation' => 90,
                    'challenges_completed' => 45,
                    'social_shares' => 120,
                ];
            case 'adults':
                return [
                    'goal_completion' => 80,
                    'certification_rate' => 70,
                    'study_efficiency' => 0.92,
                ];
            default:
                return [];
        }
    }
}

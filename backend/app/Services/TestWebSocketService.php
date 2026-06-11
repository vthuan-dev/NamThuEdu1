<?php

namespace App\Services;

use App\Events\TestSessionEvent;
use App\Events\TeacherMonitorEvent;
use App\Models\Submission;
use App\Models\SubmissionAnswer;
use App\Models\TestAssignment;
use App\Models\Question;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Redis;

class TestWebSocketService
{
    /**
     * Handle student connection to test session
     */
    public static function handleConnection($submissionId, $userId)
    {
        try {
            // Lưu thông tin connection với Redis
            $connectionKey = "test_session:{$submissionId}";
            Redis::hset($connectionKey, [
                'user_id' => $userId,
                'connected' => true,
                'connected_at' => now()->toISOString(),
                'last_seen' => now()->toISOString(),
                'connection_count' => Redis::hincrby($connectionKey, 'connection_count', 1)
            ]);
            Redis::expire($connectionKey, 7200); // 2 hours

            // Broadcast connection event
            broadcast(new TestSessionEvent($submissionId, $userId, 'connected', [
                'message' => 'Kết nối thành công đến phiên thi',
                'connection_quality' => 'good'
            ]));

            // Notify teacher
            self::notifyTeacher($submissionId, 'student_connected', [
                'student_id' => $userId,
                'submission_id' => $submissionId
            ]);

            Log::info("Student connected to test session", [
                'submission_id' => $submissionId,
                'user_id' => $userId
            ]);
        } catch (\Throwable $e) {
            // Real-time (Redis/broadcast) là tính năng phụ — KHÔNG được chặn việc vào thi.
            Log::warning("WebSocket connect degraded (Redis/broadcast unavailable)", [
                'submission_id' => $submissionId,
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Handle student disconnection (cúp điện, mất mạng)
     */
    public static function handleDisconnection($submissionId, $userId)
    {
        $connectionKey = "test_session:{$submissionId}";
        
        // Update connection status
        Redis::hset($connectionKey, [
            'connected' => false,
            'disconnected_at' => now()->toISOString(),
            'disconnection_count' => Redis::hincrby($connectionKey, 'disconnection_count', 1)
        ]);

        // Calculate disconnection duration for analysis
        $connectedAt = Redis::hget($connectionKey, 'connected_at');
        $duration = $connectedAt ? now()->diffInSeconds($connectedAt) : 0;

        // Broadcast disconnection event
        broadcast(new TestSessionEvent($submissionId, $userId, 'disconnected', [
            'message' => 'Mất kết nối - có thể do cúp điện hoặc mất mạng',
            'disconnected_at' => now()->toISOString(),
            'session_duration' => $duration
        ]));

        // Notify teacher about disconnection
        self::notifyTeacher($submissionId, 'student_disconnected', [
            'student_id' => $userId,
            'submission_id' => $submissionId,
            'duration' => $duration
        ]);

        Log::warning("Student disconnected from test session", [
            'submission_id' => $submissionId,
            'user_id' => $userId,
            'session_duration' => $duration
        ]);
    }

    /**
     * Handle real-time answer saving with enhanced features
     */
    public static function handleAnswerUpdate($submissionId, $userId, $questionId, $answerText)
    {
        try {
            $submission = Submission::where('sId', $submissionId)
                ->where('user_id', $userId)
                ->with('exam')
                ->first();

            if (!$submission || $submission->sStatus !== 'in_progress') {
                return ['success' => false, 'message' => 'Submission is not available for updates'];
            }

            $question = Question::where('qId', $questionId)
                ->where('exam_id', $submission->exam_id)
                ->first();

            if (!$question) {
                return ['success' => false, 'message' => 'Question is invalid for this submission'];
            }

            // Lưu câu trả lời
            $submissionAnswer = SubmissionAnswer::updateOrCreate(
                [
                    'submission_id' => $submissionId,
                    'question_id' => $question->qId,
                ],
                [
                    'saAnswer_text' => $answerText,
                ]
            );

            // Update activity tracking
            $connectionKey = "test_session:{$submissionId}";
            Redis::hset($connectionKey, [
                'last_seen' => now()->toISOString(),
                'last_answer_time' => now()->toISOString(),
                'answers_count' => Redis::hincrby($connectionKey, 'answers_count', 1)
            ]);

            // Broadcast answer saved event với confirmation
            broadcast(new TestSessionEvent($submissionId, $userId, 'answer_saved', [
                'question_id' => $question->qId,
                'saved_at' => now()->toISOString(),
                'message' => '✓ Câu trả lời đã được lưu',
                'answer_number' => Redis::hget($connectionKey, 'answers_count')
            ]));

            return ['success' => true, 'message' => 'Answer saved successfully'];

        } catch (\Exception $e) {
            Log::error("Failed to save answer via WebSocket", [
                'submission_id' => $submissionId,
                'question_id' => $questionId,
                'error' => $e->getMessage()
            ]);

            // Broadcast error event
            broadcast(new TestSessionEvent($submissionId, $userId, 'answer_save_failed', [
                'question_id' => $questionId,
                'error' => 'Không thể lưu câu trả lời. Vui lòng thử lại.',
                'retry_suggested' => true
            ]));

            return ['success' => false, 'message' => 'Failed to save answer'];
        }
    }

    /**
     * Send enhanced time sync to client
     */
    public static function sendTimeSync($submissionId, $userId)
    {
        try {
            $submission = Submission::with('exam')->find($submissionId);

            if (!$submission) {
                return;
            }

            $timeElapsed = now()->diffInMinutes($submission->sStart_time);
            $timeRemaining = max(0, $submission->exam->eDuration_minutes - $timeElapsed);

            // Warning thresholds
            $warningLevel = 'normal';
            if ($timeRemaining <= 5) {
                $warningLevel = 'critical';
            } elseif ($timeRemaining <= 15) {
                $warningLevel = 'warning';
            }

            broadcast(new TestSessionEvent($submissionId, $userId, 'time_sync', [
                'server_time' => now()->toISOString(),
                'time_remaining_minutes' => $timeRemaining,
                'time_elapsed_minutes' => $timeElapsed,
                'warning_level' => $warningLevel,
                'auto_submit_in' => $timeRemaining <= 1 ? ($timeRemaining * 60) : null
            ]));

            // Auto-submit warning
            if ($timeRemaining <= 5 && $timeRemaining > 0) {
                broadcast(new TestSessionEvent($submissionId, $userId, 'auto_submit_warning', [
                    'message' => "⚠️ Còn {$timeRemaining} phút! Bài thi sẽ tự động nộp khi hết thời gian.",
                    'minutes_remaining' => $timeRemaining
                ]));
            }
        } catch (\Throwable $e) {
            Log::warning("WebSocket time-sync degraded (Redis/broadcast unavailable)", [
                'submission_id' => $submissionId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Handle reconnection with enhanced recovery
     */
    public static function handleReconnection($submissionId, $userId)
    {
        try {
            $submission = Submission::with(['exam', 'answers'])->find($submissionId);

            if (!$submission || $submission->sStatus !== 'in_progress') {
                broadcast(new TestSessionEvent($submissionId, $userId, 'reconnection_failed', [
                    'message' => 'Không thể kết nối lại - bài thi không còn hoạt động'
                ]));
                return;
            }

            // Check if test expired
            $timeElapsed = now()->diffInMinutes($submission->sStart_time);
            $timeRemaining = $submission->exam->eDuration_minutes - $timeElapsed;

            if ($timeRemaining <= 0) {
                broadcast(new TestSessionEvent($submissionId, $userId, 'test_expired', [
                    'message' => 'Bài thi đã hết thời gian và sẽ được tự động nộp'
                ]));
                return;
            }

            // Update connection status
            $connectionKey = "test_session:{$submissionId}";
            Redis::hset($connectionKey, [
                'connected' => true,
                'reconnected_at' => now()->toISOString(),
                'last_seen' => now()->toISOString(),
                'reconnection_count' => Redis::hincrby($connectionKey, 'reconnection_count', 1)
            ]);

            // Get disconnection info
            $disconnectedAt = Redis::hget($connectionKey, 'disconnected_at');
            $offlineDuration = $disconnectedAt ? now()->diffInSeconds($disconnectedAt) : 0;

            // Successful reconnection with recovery data
            broadcast(new TestSessionEvent($submissionId, $userId, 'reconnected', [
                'message' => '✓ Kết nối lại thành công! Tiếp tục làm bài.',
                'time_remaining_minutes' => $timeRemaining,
                'offline_duration_seconds' => $offlineDuration,
                'saved_answers' => $submission->answers->map(function($answer) {
                    return [
                        'question_id' => $answer->question_id,
                        'answer_text' => $answer->saAnswer_text
                    ];
                }),
                'recovery_successful' => true
            ]));

            // Notify teacher about reconnection
            self::notifyTeacher($submissionId, 'student_reconnected', [
                'student_id' => $userId,
                'submission_id' => $submissionId,
                'offline_duration' => $offlineDuration
            ]);

            Log::info("Student reconnected to test session", [
                'submission_id' => $submissionId,
                'user_id' => $userId,
                'time_remaining' => $timeRemaining,
                'offline_duration' => $offlineDuration
            ]);
        } catch (\Throwable $e) {
            // Real-time (Redis/broadcast) là tính năng phụ — KHÔNG được chặn việc vào thi.
            Log::warning("WebSocket reconnect degraded (Redis/broadcast unavailable)", [
                'submission_id' => $submissionId,
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Monitor connection quality and detect issues
     */
    public static function monitorConnectionQuality($submissionId, $userId)
    {
        $connectionKey = "test_session:{$submissionId}";
        $disconnectionCount = Redis::hget($connectionKey, 'disconnection_count') ?: 0;
        $reconnectionCount = Redis::hget($connectionKey, 'reconnection_count') ?: 0;

        // Detect unstable connection
        if ($disconnectionCount > 3) {
            broadcast(new TestSessionEvent($submissionId, $userId, 'connection_unstable', [
                'message' => '⚠️ Kết nối không ổn định. Vui lòng kiểm tra mạng internet.',
                'disconnection_count' => $disconnectionCount,
                'suggestion' => 'Hãy đảm bảo kết nối internet ổn định để tránh mất dữ liệu.'
            ]));
        }
    }

    /**
     * Check for inactive sessions and handle them
     */
    public static function checkInactiveSessions()
    {
        $activeSubmissions = Submission::where('sStatus', 'in_progress')->get();
        
        foreach ($activeSubmissions as $submission) {
            $connectionKey = "test_session:{$submission->sId}";
            $lastSeen = Redis::hget($connectionKey, 'last_seen');
            
            if (!$lastSeen) {
                continue; // No WebSocket session
            }

            $inactiveMinutes = now()->diffInMinutes($lastSeen);
            
            // Cảnh báo nếu không hoạt động > 10 phút
            if ($inactiveMinutes > 10) {
                broadcast(new TestSessionEvent($submission->sId, $submission->user_id, 'inactive_warning', [
                    'message' => '⚠️ Phát hiện thời gian không hoạt động dài',
                    'inactive_minutes' => $inactiveMinutes,
                    'suggestion' => 'Vui lòng tiếp tục làm bài để tránh tự động nộp bài.'
                ]));
            }

            // Tự động nộp nếu không hoạt động > 30 phút
            if ($inactiveMinutes > 30) {
                self::autoSubmitInactiveTest($submission);
            }
        }
    }

    /**
     * Auto-submit inactive test
     */
    private static function autoSubmitInactiveTest($submission)
    {
        broadcast(new TestSessionEvent($submission->sId, $submission->user_id, 'auto_submit_inactive', [
            'message' => 'Bài thi được tự động nộp do không hoạt động quá lâu.',
            'reason' => 'inactive_timeout'
        ]));

        // Call the auto-submit logic from StudentTestController
        // This would need to be refactored to a service
    }

    /**
     * Notify teacher about student activities
     */
    private static function notifyTeacher($submissionId, $eventType, $data)
    {
        $submission = Submission::with(['assignment.exam', 'user'])->find($submissionId);
        
        if (!$submission || !$submission->assignment) {
            return;
        }

        // Find teacher from exam
        $teacherId = $submission->assignment->exam->teacher_id ?? null;
        
        if ($teacherId) {
            broadcast(new TeacherMonitorEvent($teacherId, $eventType, array_merge($data, [
                'student_name' => $submission->user->uName,
                'exam_title' => $submission->assignment->exam->eTitle,
                'timestamp' => now()->toISOString()
            ])));
        }
    }

    /**
     * Get real-time statistics for teacher dashboard
     */
    public static function getTestStatistics($examId)
    {
        $submissions = Submission::where('exam_id', $examId)
                                ->where('sStatus', 'in_progress')
                                ->get();

        $stats = [
            'total_active' => $submissions->count(),
            'connected_count' => 0,
            'disconnected_count' => 0,
            'average_progress' => 0,
            'connection_issues' => 0
        ];

        foreach ($submissions as $submission) {
            $connectionKey = "test_session:{$submission->sId}";
            $connected = Redis::hget($connectionKey, 'connected');
            $disconnectionCount = Redis::hget($connectionKey, 'disconnection_count') ?: 0;

            if ($connected === 'true') {
                $stats['connected_count']++;
            } else {
                $stats['disconnected_count']++;
            }

            if ($disconnectionCount > 2) {
                $stats['connection_issues']++;
            }
        }

        return $stats;
    }
}

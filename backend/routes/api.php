<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\CourseController;
use App\Http\Controllers\BlogController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ClassController;
use App\Http\Controllers\ExamController;
use App\Http\Controllers\IeltsExamController;
use App\Http\Controllers\ExamTemplateController;
use App\Http\Controllers\TestAssignmentController;
use App\Http\Controllers\GradingController;
use App\Http\Controllers\TeacherReportController;
use App\Http\Controllers\StudentTestController;
use App\Http\Controllers\TestController;
use App\Http\Controllers\SystemReportController;
use App\Http\Controllers\PracticeController;
use App\Http\Controllers\AgeGroupController;
use App\Http\Controllers\StudentProfileController;
use App\Http\Controllers\StudentCourseController;
use App\Http\Controllers\StudentPracticeController;
use App\Http\Controllers\StudentGamificationController;
use App\Http\Controllers\TestGamificationController;
use App\Http\Controllers\GamificationTestController;
use App\Http\Controllers\StudentAnalyticsController;
use App\Http\Controllers\FileUploadController;
use App\Http\Controllers\GeminiPdfController;
use App\Http\Controllers\AgeGroupContentController;
use App\Http\Controllers\AdminSystemController;
use App\Http\Controllers\MonitoringController;
use App\Http\Controllers\PushController;
use App\Http\Controllers\ExamHighlightController;
use App\Http\Controllers\ClassAnnouncementController;
use App\Http\Controllers\ClassGoalController;
use App\Http\Controllers\AdminHandoverController;
use App\Http\Controllers\StudentExamScheduleController;
use App\Http\Controllers\StudentExamSessionController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

/* ========= PUSH NOTIFICATIONS ========= */
Route::get('/push/vapid-public-key', [PushController::class, 'vapidPublicKey']);
Route::middleware(['auth:sanctum', 'maintenance'])->group(function () {
    Route::post('/push/subscribe', [PushController::class, 'subscribe']);
    Route::delete('/push/unsubscribe', [PushController::class, 'unsubscribe']);
});

/* ========= ADDRESS PROXY (public) ========= */
Route::get('/address/provinces', [AddressProxyController::class, 'provinces']);
Route::get('/address/provinces/{code}/communes', [AddressProxyController::class, 'communes']);

/* ========= AUTH ========= */
Route::post('/login', [AuthController::class, 'login']);
// Route::post('/register', [AuthController::class, 'register']); // DISABLED: Students cannot self-register
Route::post('/refresh', [AuthController::class, 'refresh']);
Route::post('/users/accept', [AuthController::class, 'accept']);
Route::post('/users/reset-password', [AuthController::class, 'resetPassword']);

/* ========= PUBLIC ENDPOINTS ========= */
Route::get('/tests', [TestController::class, 'index']); // Public test list

// Simple test endpoint
Route::get('/test', function () {
    return response()->json([
        'status' => 'success',
        'message' => 'NamThu Education API is working!',
        'version' => '1.0.0',
        'timestamp' => now()->toISOString(),
        'documentation' => url('/docs')
    ]);
});

// Health check endpoint
Route::get('/health', function () {
    return response()->json([
        'status' => 'healthy',
        'service' => 'NamThu Education API',
        'timestamp' => now()->toISOString(),
        'uptime' => 'OK'
    ]);
});

// Public categories (không cần auth)
Route::get('/categories', [CategoryController::class, 'index']);

// Public legal content (không cần auth)
Route::get('/legal-content', [AdminSystemController::class, 'getLegalContent']);
Route::get('/public/courses', [CourseController::class, 'publicCourses']);

// Public blog endpoints (no auth required)
Route::get('/public/posts', [BlogController::class, 'publicIndex']);
Route::get('/public/posts/{slug}', [BlogController::class, 'publicShow']);

// Public news feed (Google News proxy, cached 15 minutes)
Route::get('/public/news', [\App\Http\Controllers\NewsController::class, 'index']);
Route::get('/public/stats', function () {
    return response()->json([
        'status' => 'success',
        'data' => [
            'students' => \App\Models\User::where('uRole', 'student')
                            ->where('uStatus', 'active')
                            ->whereNull('uDeleted_at')
                            ->count(),
            'teachers' => \App\Models\User::where('uRole', 'teacher')
                            ->where('uStatus', 'active')
                            ->whereNull('uDeleted_at')
                            ->count(),
            'courses'  => \App\Models\Course::where('cStatus', 'active')->count(),
            'exams'    => \App\Models\Exam::where('eStatus', 'published')->count(),
        ]
    ]);
});

// Test upload endpoint (gated behind auth to prevent public access)
Route::middleware(['auth:sanctum', 'maintenance'])->group(function () {
    Route::post('/test/upload/audio', [FileUploadController::class, 'uploadAudio']);
    Route::post('/test/upload/image', [FileUploadController::class, 'uploadImage']);

    // Test Exam Routes (dev only — requires auth)
    Route::post('/test/exams', [App\Http\Controllers\TestExamController::class, 'store']);
    Route::get('/test/exams/{id}', [App\Http\Controllers\TestExamController::class, 'show']);
    Route::put('/test/exams/{id}', [App\Http\Controllers\TestExamController::class, 'update']);
});

/* ========= AUTHENTICATED ROUTES ========= */
Route::middleware(['auth:sanctum', 'maintenance'])->group(function () {
    
    // Logout
    Route::post('/logout', [AuthController::class, 'logout']);
    
    /* ======== AGE GROUP & THEME ROUTES ========= */
    Route::prefix('user')->group(function () {
        Route::get('/profile', [UserController::class, 'getProfile']);
        Route::put('/profile', [UserController::class, 'updateProfile']);
        Route::post('/avatar', [UserController::class, 'uploadAvatar']);
        Route::delete('/avatar', [UserController::class, 'removeAvatar']);
        Route::post('/change-password', [UserController::class, 'changePassword']);
        Route::get('/sessions', [UserController::class, 'getSessions']);
        Route::delete('/sessions/{id}', [UserController::class, 'logoutSession']);
        Route::post('/request-delete', [UserController::class, 'requestDeleteAccount']);
        Route::post('/cancel-delete', [UserController::class, 'cancelDeleteAccount']);
        Route::get('/notification-settings', [UserController::class, 'getNotificationSettings']);
        Route::put('/notification-settings', [UserController::class, 'updateNotificationSettings']);
        Route::get('/age-group', [AgeGroupController::class, 'getAgeGroup']);
        Route::post('/age-group', [AgeGroupController::class, 'updateAgeGroup']);
        Route::get('/theme-preference', [AgeGroupController::class, 'getThemePreference']);
        Route::post('/theme-preference', [AgeGroupController::class, 'updateThemePreference']);
    });
    
    /* ======== TEACHER ROUTES ========= */
    Route::middleware('role:teacher')->prefix('teacher')->group(function () {
        
        // Course Management
        Route::get('/courses', [CourseController::class, 'index']);
        Route::post('/courses', [CourseController::class, 'store']);
        Route::get('/courses/{id}', [CourseController::class, 'show']);
        Route::put('/courses/{id}', [CourseController::class, 'update']);
        Route::delete('/courses/{id}', [CourseController::class, 'destroy']);
        
        // Course Enrollment Management
        Route::get('/courses/{id}/students', [CourseController::class, 'getStudents']);
        Route::post('/courses/{id}/enroll', [CourseController::class, 'enrollStudent']);
        Route::delete('/courses/{courseId}/students/{studentId}', [CourseController::class, 'removeStudent']);
        Route::get('/courses/{id}/statistics', [CourseController::class, 'getStatistics']);
        
        // Student Management
        Route::get('/students', [UserController::class, 'teacherStudents']);
        Route::get('/students/deleted', [UserController::class, 'getDeletedStudents']); // Get deleted students
        Route::get('/student/check-phone', [UserController::class, 'checkPhoneUnique']);
        Route::get('/student/{id}', [UserController::class, 'getStudentById']);
        Route::post('/student', [UserController::class, 'storeStudent']);
        Route::put('/student/{id}', [UserController::class, 'update']);
        Route::post('/student/{id}', [UserController::class, 'update']); // _method=PUT spoofing for file uploads
        Route::delete('/student/{id}', [UserController::class, 'destroyStudent']); // Soft delete
        Route::post('/student/{id}/restore', [UserController::class, 'restoreStudent']); // Restore deleted

        // Lịch thi / lịch trình ôn luyện của học viên
        Route::get('/students/{id}/exam-schedules', [StudentExamScheduleController::class, 'index']);
        Route::post('/students/{id}/exam-schedules', [StudentExamScheduleController::class, 'store']);
        Route::put('/exam-schedules/{id}', [StudentExamScheduleController::class, 'update']);
        Route::delete('/exam-schedules/{id}', [StudentExamScheduleController::class, 'destroy']);
        Route::post('/student/{id}/reset-password', [UserController::class, 'resetStudentPassword']); // Reset password
        Route::delete('/student/{id}/permanent', [UserController::class, 'permanentDeleteStudent']); // Permanent delete
        Route::get('/students/statistics', [UserController::class, 'studentStatistics']);
        Route::get('/students/export', [UserController::class, 'exportStudents']);
        
        // Blog Management
        Route::get('/blogs', [BlogController::class, 'index']);
        Route::get('/blogs/statistics', [BlogController::class, 'statistics']); // Must be before {id}
        Route::post('/blogs', [BlogController::class, 'store']);
        Route::get('/blogs/{id}', [BlogController::class, 'show']);
        Route::put('/blogs/{id}', [BlogController::class, 'update']);
        Route::delete('/blogs/{id}', [BlogController::class, 'destroy']);
        
        // Blog Types Management
        Route::get('/blog-types', [BlogController::class, 'getBlogTypes']);
        Route::post('/blog-types', [BlogController::class, 'createBlogType']);
        
        // Categories
        Route::get('/categories', [CategoryController::class, 'index']);
        
        // ─── Class Management (Teacher Class Management feature) ─────────
        // Lớp do giáo viên sở hữu: CRUD, học viên, giao đề, thông báo, mục
        // tiêu, bàn giao. users.class_id là nguồn membership chính.
        Route::get('/classes', [ClassController::class, 'index']);
        Route::post('/classes', [ClassController::class, 'store']);
        Route::get('/classes/statistics', [ClassController::class, 'statistics']);
        Route::get('/classes/{id}', [ClassController::class, 'show']);
        Route::put('/classes/{id}', [ClassController::class, 'update']);
        Route::delete('/classes/{id}', [ClassController::class, 'destroy']);
        Route::post('/classes/{id}/enroll', [ClassController::class, 'enroll']);
        Route::post('/classes/{fromId}/transfer/{toId}', [ClassController::class, 'transferStudents']);
        Route::get('/classes/{id}/transfer-history', [ClassController::class, 'transferHistory']);
        Route::delete('/classes/{id}/students/{studentId}', [ClassController::class, 'removeStudent']);

        // Giao đề cho lớp (liệt kê assignment theo lớp)
        Route::get('/classes/{id}/assignments', [TestAssignmentController::class, 'byClass']);

        // Thông báo của lớp
        Route::get('/classes/{classId}/announcements', [ClassAnnouncementController::class, 'index']);
        Route::post('/classes/{classId}/announcements', [ClassAnnouncementController::class, 'store']);
        Route::put('/classes/{classId}/announcements/{id}', [ClassAnnouncementController::class, 'update']);
        Route::delete('/classes/{classId}/announcements/{id}', [ClassAnnouncementController::class, 'destroy']);

        // Mục tiêu của lớp
        Route::get('/classes/{classId}/goals', [ClassGoalController::class, 'index']);
        Route::post('/classes/{classId}/goals', [ClassGoalController::class, 'store']);
        Route::put('/classes/{classId}/goals/{id}', [ClassGoalController::class, 'update']);
        Route::delete('/classes/{classId}/goals/{id}', [ClassGoalController::class, 'destroy']);

        // Bàn giao lớp (giáo viên gửi/hủy yêu cầu)
        Route::post('/classes/{id}/handover-request', [ClassController::class, 'requestHandover']);
        Route::delete('/classes/{id}/handover-request', [ClassController::class, 'cancelHandover']);

        // Xem lại & hủy yêu cầu (bàn giao + xóa lớp) của giáo viên
        Route::get('/class-requests', [ClassController::class, 'myRequests']);
        Route::post('/class-requests/{id}/cancel', [ClassController::class, 'cancelRequest']);

        // Cộng tác: mời giáo viên khác cùng quản lý lớp (co-teaching)
        Route::get('/colleagues', [ClassController::class, 'colleagues']);
        Route::post('/classes/{id}/co-teachers', [ClassController::class, 'inviteCoTeacher']);
        Route::delete('/classes/{id}/co-teachers/{coId}', [ClassController::class, 'removeCoTeacher']);
        Route::get('/co-teacher-invitations', [ClassController::class, 'myCoTeacherInvitations']);
        Route::post('/co-teacher-invitations/{coId}/respond', [ClassController::class, 'respondCoTeacherInvitation']);

        // Mục tiêu học viên + phân tích tiến độ bằng AI (Groq)
        Route::get('/students/{id}/goal', [\App\Http\Controllers\StudentGoalController::class, 'show']);
        Route::put('/students/{id}/goal', [\App\Http\Controllers\StudentGoalController::class, 'upsert']);
        Route::delete('/students/{id}/goal', [\App\Http\Controllers\StudentGoalController::class, 'destroy']);
        Route::post('/students/{id}/goal/analyze', [\App\Http\Controllers\StudentGoalController::class, 'analyze']);

        
        // Practice Sessions Routes
        Route::prefix('practice-sessions')->group(function () {
            Route::get('/', [PracticeController::class, 'index']);
            Route::post('/topic-based', [PracticeController::class, 'createTopicBased']);
            Route::post('/template-based', [PracticeController::class, 'createTemplateBased']);
            Route::post('/random', [PracticeController::class, 'createRandom']);
            Route::get('/statistics', [PracticeController::class, 'statistics']);
            Route::get('/{id}', [PracticeController::class, 'show']);
            Route::put('/{id}', [PracticeController::class, 'update']);
            Route::delete('/{id}', [PracticeController::class, 'destroy']);
        });
        
        // Templates for practice
        Route::get('/templates', [PracticeController::class, 'getTemplates']);

        // Exam Management
        Route::get('/exams', [ExamController::class, 'index']);
        Route::post('/exams', [ExamController::class, 'store']);
        Route::get('/exams/{id}', [ExamController::class, 'show']);
        Route::put('/exams/{id}', [ExamController::class, 'update']);
        Route::delete('/exams/{id}', [ExamController::class, 'destroy']);
        Route::post('/exams/{id}/questions', [ExamController::class, 'addQuestions']);
        Route::put('/exams/{examId}/questions/{questionId}', [ExamController::class, 'updateQuestion']);
        Route::delete('/exams/{examId}/questions/{questionId}', [ExamController::class, 'deleteQuestion']);
        Route::get('/exams/{id}/sections', [ExamController::class, 'sections']);
        Route::post('/exams/{id}/clone', [ExamController::class, 'clone']);
        Route::get('/exams/{id}/preview', [ExamController::class, 'preview']);
        Route::post('/exams/{id}/publish', [ExamController::class, 'publish']);
        
        // VSTEP-specific routes
        // Reading
        Route::post('/exams/{examId}/vstep/parts/{partNumber}', [ExamController::class, 'saveVstepPart']);
        Route::post('/exams/{examId}/vstep/publish', [ExamController::class, 'publishVstepExam']);
        Route::get('/exams/{examId}/vstep/load', [ExamController::class, 'loadVstepExam']);
        
        // IELTS-specific routes
        Route::post('/ielts/parse-pdf', [GeminiPdfController::class, 'parsePdf']); // Gemini PDF → JSON
        // VSTEP: Gemini PDF → JSON (Listening/Reading/Writing) cho import đề full
        Route::post('/vstep/parse-pdf', [GeminiPdfController::class, 'parseVstepPdf']);
        // VSTEP: text (PDF thuần / Word đã trích xuất) → JSON, nhẹ hơn parse-pdf
        Route::post('/vstep/parse-text', [GeminiPdfController::class, 'parseVstepText']);
        Route::post('/ielts/diarize-transcript', [GeminiPdfController::class, 'diarizeTranscript']); // Gemini phân tách speaker A/B
        Route::post('/ielts/transcribe-audio', [GeminiPdfController::class, 'transcribeAudio']); // Groq Whisper STT (server-side, nhanh)
        Route::post('/ielts/suggest-answers', [GeminiPdfController::class, 'suggestIeltsAnswers']); // Groq gợi ý đáp án từ transcript/passage
        Route::post('/exams/{examId}/ielts/listening/sections/{sectionNumber}/audio', [ExamController::class, 'uploadIeltsListeningAudio']);
        Route::post('/exams/{examId}/ielts/listening/sections/{sectionNumber}/question-image', [ExamController::class, 'uploadIeltsListeningQuestionImage']);

        // ── IELTS exam CRUD (NEW: 1 đề = 1 skill) ──────────────────────────────
        Route::post('/exams/ielts',                       [IeltsExamController::class, 'createDraft']);
        Route::put('/exams/{examId}/ielts',               [IeltsExamController::class, 'updateDraft']);
        Route::post('/exams/{examId}/ielts/publish',      [IeltsExamController::class, 'publish']);
        Route::get('/exams/{examId}/ielts/draft',         [IeltsExamController::class, 'getDraft']);

        // ── THPT exam CRUD (Vietnamese university entrance format) ─────────────
        Route::post('/exams/thpt',                        [\App\Http\Controllers\ThptExamController::class, 'createDraft']);
        Route::put('/exams/{examId}/thpt',                [\App\Http\Controllers\ThptExamController::class, 'updateDraft']);
        Route::get('/exams/{examId}/thpt/draft',          [\App\Http\Controllers\ThptExamController::class, 'getDraft']);
        Route::post('/exams/{examId}/thpt/publish',       [\App\Http\Controllers\ThptExamController::class, 'publish']);
        Route::delete('/exams/{examId}/thpt/draft',       [\App\Http\Controllers\ThptExamController::class, 'discardDraft']);
        Route::get('/exams/{examId}/thpt/versions',       [\App\Http\Controllers\ThptExamController::class, 'listVersions']);

        // ── Teens Listening / Speaking exam (relational, AI-graded speaking) ────
        Route::post('/exams/teens',                        [\App\Http\Controllers\TeensExamController::class, 'store']);
        
        // Listening
        Route::post('/exams/{examId}/vstep/listening/parts/{partNumber}', [ExamController::class, 'saveVstepListeningPart']);
        // New section-based endpoints (Part 1: 8 sections, Part 2/3: 3 sections each)
        Route::post('/exams/{examId}/vstep/listening/parts/{partNumber}/sections/{sectionNumber}/audio', [ExamController::class, 'saveVstepListeningSectionAudio']);
        Route::post('/exams/{examId}/vstep/listening/parts/{partNumber}/sections/{sectionNumber}', [ExamController::class, 'saveVstepListeningSection']);
        // Legacy single-audio endpoint (kept for backwards compat)
        Route::post('/exams/{examId}/vstep/listening/parts/{partNumber}/audio', [ExamController::class, 'saveVstepListeningAudio']);
        Route::post('/exams/{examId}/vstep/listening/publish', [ExamController::class, 'publishVstepListeningExam']);
        Route::get('/exams/{examId}/vstep/listening/load', [ExamController::class, 'loadVstepListeningExam']);
        
        // Writing
        Route::post('/exams/{examId}/vstep/writing/tasks/{taskNumber}', [ExamController::class, 'saveVstepWritingTask']);
        Route::post('/exams/{examId}/vstep/writing/publish', [ExamController::class, 'publishVstepWritingExam']);
        Route::get('/exams/{examId}/vstep/writing/load', [ExamController::class, 'loadVstepWritingExam']);
        
        // Speaking
        Route::post('/exams/{examId}/vstep/speaking/parts/{partNumber}', [ExamController::class, 'saveVstepSpeakingPart']);
        Route::post('/exams/{examId}/vstep/speaking/publish', [ExamController::class, 'publishVstepSpeakingExam']);
        Route::get('/exams/{examId}/vstep/speaking/load', [ExamController::class, 'loadVstepSpeakingExam']);
        
        // Exam Import from JSON (Gemini AI)
        Route::post('/exams/import', [App\Http\Controllers\ExamImportController::class, 'import']);
        Route::post('/exams/import/validate', [App\Http\Controllers\ExamImportController::class, 'validateImport']);
        
        // Kids Exam Management
        Route::prefix('kids-exams')->group(function () {
            // Get exam types and task types
            Route::get('/types', [App\Http\Controllers\KidsExamController::class, 'getExamTypes']);
            Route::get('/task-types', [App\Http\Controllers\KidsExamController::class, 'getTaskTypes']);
            Route::get('/task-types/{code}', [App\Http\Controllers\KidsExamController::class, 'getTaskType']);
            
            // CRUD operations
            Route::get('/', [App\Http\Controllers\KidsExamController::class, 'index']);
            Route::post('/', [App\Http\Controllers\KidsExamController::class, 'store']);
            Route::get('/{id}', [App\Http\Controllers\KidsExamController::class, 'show']);
            Route::put('/{id}', [App\Http\Controllers\KidsExamController::class, 'update']);
            Route::delete('/{id}', [App\Http\Controllers\KidsExamController::class, 'destroy']);
            
            // Question management
            Route::post('/{examId}/questions', [App\Http\Controllers\KidsExamController::class, 'addQuestion']);
            Route::put('/{examId}/questions/{questionId}', [App\Http\Controllers\KidsExamController::class, 'updateQuestion']);
            Route::delete('/{examId}/questions/{questionId}', [App\Http\Controllers\KidsExamController::class, 'deleteQuestion']);
            
            // Media upload
            Route::post('/media/upload', [App\Http\Controllers\KidsExamController::class, 'uploadMedia']);
            Route::get('/{examId}/media', [App\Http\Controllers\KidsExamController::class, 'getExamMedia']);
            Route::delete('/media/{id}', [App\Http\Controllers\KidsExamController::class, 'deleteMedia']);
        });
        
        // Exam Templates
        Route::get('/exam-templates', [App\Http\Controllers\ExamTemplateController::class, 'index']);
        Route::get('/exam-templates/{category}', [App\Http\Controllers\ExamTemplateController::class, 'byCategory']);
        Route::get('/exam-templates/{id}', [App\Http\Controllers\ExamTemplateController::class, 'show']);
        Route::get('/exam-templates/{id}/sections', [App\Http\Controllers\ExamTemplateController::class, 'sections']);
        Route::post('/exams/from-template/{templateId}', [App\Http\Controllers\ExamTemplateController::class, 'createFromTemplate']);
        
        // File Upload Routes  
        Route::post('/upload/audio', [FileUploadController::class, 'uploadAudio']);
        Route::post('/upload/image', [FileUploadController::class, 'uploadImage']);
        Route::delete('/upload/file', [FileUploadController::class, 'deleteFile']);
        
        // Test Management
        Route::post('/tests/upload', [TestController::class, 'upload']);
        
        // NOTE: Previously a nested `Route::middleware('admin')` block lived
        // here exposing /teacher/users CRUD. It was unreachable by design
        // (outer role:teacher requires uRole==='teacher', inner admin
        // middleware requires uRole==='admin') and the canonical admin user
        // CRUD already lives under the `role:admin` group below at
        // /admin/users. Block removed to eliminate dead code and prevent
        // future foot-guns where the inner middleware could be relaxed
        // and silently grant teachers admin-style endpoints.
        
        // Test Assignment
        Route::post('/exams/{examId}/assign', [TestAssignmentController::class, 'assign']);
        Route::get('/assignments', [TestAssignmentController::class, 'index']);
        Route::put('/assignments/{id}', [TestAssignmentController::class, 'update']);
        Route::delete('/assignments/{id}', [TestAssignmentController::class, 'destroy']);
        Route::get('/assignments/{id}/progress', [TestAssignmentController::class, 'progress']);
        Route::post('/assignments/bulk', [TestAssignmentController::class, 'bulkAssign']);
        Route::post('/assignments/{id}/reminders', [TestAssignmentController::class, 'sendReminders']);
        Route::get('/assignments/statistics', [TestAssignmentController::class, 'statistics']);
        
        // VSTEP exam structure (for teacher review mode)
        Route::get('/exams/{examId}/vstep/listening', [StudentTestController::class, 'loadVstepListening']);
        Route::get('/exams/{examId}/vstep/reading',   [StudentTestController::class, 'loadVstepReading']);
        Route::get('/exams/{examId}/vstep/writing',   [StudentTestController::class, 'loadVstepWriting']);
        Route::get('/exams/{examId}/vstep/speaking',  [StudentTestController::class, 'loadVstepSpeaking']);

        // IELTS exam structure (for teacher preview/review)
        Route::get('/exams/{examId}/ielts/listening', [StudentTestController::class, 'loadIeltsListening']);
        Route::get('/exams/{examId}/ielts/reading',   [StudentTestController::class, 'loadIeltsReading']);
        Route::get('/exams/{examId}/ielts/writing',   [StudentTestController::class, 'loadIeltsWriting']);
        Route::get('/exams/{examId}/ielts/speaking',  [StudentTestController::class, 'loadIeltsSpeaking']);

        // Live Monitoring
        Route::get('/dashboard/active-sessions', [MonitoringController::class, 'activeSessions']);
        Route::get('/dashboard/monitoring-stats', [MonitoringController::class, 'stats']);
        Route::get('/dashboard/recent-starts',   [MonitoringController::class, 'recentStarts']);
        Route::get('/dashboard/recent-submissions', [MonitoringController::class, 'recentSubmissions']);
        Route::get('/dashboard/exams-ready',      [MonitoringController::class, 'examsReadyToPublish']);
        Route::post('/dashboard/cleanup-expired',  [MonitoringController::class, 'cleanupExpired']);
        Route::get('/dashboard/statistics',        [MonitoringController::class, 'statistics']);

        // Grading
        Route::get('/submissions', [GradingController::class, 'index']);
        Route::get('/submissions/{id}', [GradingController::class, 'show']);
        Route::post('/submissions/{id}/grade', [GradingController::class, 'grade']);
        Route::post('/submissions/{id}/auto-grade', [GradingController::class, 'autoGrade']);
        Route::post('/submissions/{id}/detailed-grade', [GradingController::class, 'detailedGrade']);
        Route::post('/questions/{questionId}/override-correct-answer', [GradingController::class, 'overrideCorrectAnswer']);
        Route::get('/classes/{classId}/report', [GradingController::class, 'classReport']);
        Route::get('/grading/statistics', [GradingController::class, 'gradingStatistics']);

        // AI-Assisted Grading Review
        Route::post('/submissions/{id}/ai-grade',                     [App\Http\Controllers\GradingReviewController::class, 'triggerAiGrade']);
        Route::get ('/submissions/{id}/ai-status',                    [App\Http\Controllers\GradingReviewController::class, 'aiStatus']);
        Route::post('/submissions/{id}/answers/{ansId}/regrade',       [App\Http\Controllers\GradingReviewController::class, 'regradeAnswer']);
        Route::post('/submissions/{id}/answers/{ansId}/accept-ai',     [App\Http\Controllers\GradingReviewController::class, 'acceptAi']);
        Route::post('/submissions/{id}/answers/{ansId}/teacher-grade', [App\Http\Controllers\GradingReviewController::class, 'teacherGrade']);
        Route::post('/submissions/{id}/save-all',                     [App\Http\Controllers\GradingReviewController::class, 'saveAll']);
        Route::get ('/submissions/{id}/grading-history',               [App\Http\Controllers\GradingReviewController::class, 'history']);

        // THPT (Teens) teacher grading — payload-based, tách khỏi luồng VSTEP/IELTS
        Route::get ('/thpt-submissions/{id}/grading', [App\Http\Controllers\ThptGradingController::class, 'show']);
        Route::post('/thpt-submissions/{id}/grading', [App\Http\Controllers\ThptGradingController::class, 'save']);

        // Teacher Reports
        Route::get('/reports/overview', [TeacherReportController::class, 'overview']);
        Route::get('/reports/student-progress', [TeacherReportController::class, 'studentProgress']);
        Route::get('/students/progress', [TeacherReportController::class, 'studentsProgress']); // NEW: All students progress
        
        // Real-time Dashboard & Monitoring
        Route::get('/dashboard/overview', [App\Http\Controllers\TeacherDashboardController::class, 'getDashboardOverview']);
        Route::get('/dashboard/student-stats', [App\Http\Controllers\TeacherDashboardController::class, 'getStudentStats']);
        Route::get('/dashboard/performance-data', [App\Http\Controllers\TeacherDashboardController::class, 'getPerformanceData']);
        Route::get('/dashboard/recent-activities', [App\Http\Controllers\TeacherDashboardController::class, 'getRecentActivities']);
        Route::get('/dashboard/top-students', [App\Http\Controllers\TeacherDashboardController::class, 'getTopStudents']);
        Route::get('/dashboard/activity-chart', [App\Http\Controllers\TeacherDashboardController::class, 'getActivityChart']);
        Route::get('/dashboard/today-submissions-by-type', [App\Http\Controllers\TeacherDashboardController::class, 'getTodaySubmissionsByType']);

        // Teacher activity log (FE-driven audit feed)
        Route::get('/activity-log',  [App\Http\Controllers\TeacherActivityLogController::class, 'index']);
        Route::post('/activity-log', [App\Http\Controllers\TeacherActivityLogController::class, 'store']);
        Route::get('/dashboard/test-statistics/{examId}', [App\Http\Controllers\TeacherDashboardController::class, 'getTestStatistics']);
        // Route::get('/dashboard/active-sessions', [...]) // replaced by MonitoringController
        Route::post('/dashboard/send-message', [App\Http\Controllers\TeacherDashboardController::class, 'sendMessageToStudent']);
        Route::get('/dashboard/connection-logs/{submissionId}', [App\Http\Controllers\TeacherDashboardController::class, 'getConnectionLogs']);
        
        // Age-Group Content Management (NEW)
        Route::prefix('content')->group(function () {
            Route::post('/kids/create', [AgeGroupContentController::class, 'createKidsContent']);
            Route::post('/teens/create', [AgeGroupContentController::class, 'createTeensContent']);
            Route::post('/adults/create', [AgeGroupContentController::class, 'createAdultsContent']);
            Route::get('/{id}/preview/{ageGroup}', [AgeGroupContentController::class, 'previewContent']);
        });
        
        // Smart Assignment (NEW)
        Route::post('/assignments/smart-assign', [AgeGroupContentController::class, 'smartAssign']);
        
        // Analytics by Age Group (NEW)
        Route::get('/analytics/by-age-group', [AgeGroupContentController::class, 'getAnalyticsByAgeGroup']);
    });
    
    /* ======== STUDENT ROUTES ========= */
    Route::middleware('role:student')->prefix('student')->group(function () {
        // Exam browser (VSTEP/IELTS public exams for adults)
        Route::get('/exams/browse', [StudentTestController::class, 'browseExams']);

        // Kids exam browser — TẤT CẢ đề Cambridge YL đã publish (kèm cờ is_assigned)
        Route::get('/exams/browse-kids', [StudentTestController::class, 'browseKidsExams']);

        // Teens exam browser — TẤT CẢ đề teens đã publish (kèm cờ is_assigned)
        Route::get('/exams/browse-teens', [StudentTestController::class, 'browseTeensExams']);
        // Kids direct exam (start/resume by exam ID without assignment)
        Route::post('/exams/{examId}/start-kids', [StudentTestController::class, 'startKidsExamDirect']);

        // Teens direct exam (start/resume by exam ID without assignment)
        Route::post('/exams/{examId}/start-teens', [StudentTestController::class, 'startTeensExamDirect']);

        // VSTEP direct exam (start by exam ID without assignment)
        Route::post('/exams/{examId}/discard-active-session', [StudentTestController::class, 'discardActiveDirectExamSession']);
        Route::post('/exams/{examId}/start-direct',   [StudentTestController::class, 'startDirectExam']);
        Route::get('/exams/{examId}/vstep/listening', [StudentTestController::class, 'loadVstepListening']);
        Route::get('/exams/{examId}/vstep/reading',   [StudentTestController::class, 'loadVstepReading']);
        Route::get('/exams/{examId}/vstep/writing',   [StudentTestController::class, 'loadVstepWriting']);
        Route::get('/exams/{examId}/vstep/speaking',  [StudentTestController::class, 'loadVstepSpeaking']);

        // IELTS direct exam (load by skill — same `start-direct` endpoint reused for session creation)
        Route::get('/exams/{examId}/ielts/detail',    [IeltsExamController::class, 'studentDetail']);
        Route::get('/exams/{examId}/ielts/listening', [StudentTestController::class, 'loadIeltsListening']);
        Route::get('/exams/{examId}/ielts/reading',   [StudentTestController::class, 'loadIeltsReading']);
        Route::get('/exams/{examId}/ielts/writing',   [StudentTestController::class, 'loadIeltsWriting']);
        Route::get('/exams/{examId}/ielts/speaking',  [StudentTestController::class, 'loadIeltsSpeaking']);

        // ── THPT exam (Vietnamese university entrance) ──────────────────────────
        Route::get('/thpt-exams/{examId}',                        [\App\Http\Controllers\ThptExamController::class, 'getForStudent']);
        Route::post('/thpt-exams/{examId}/start',                 [\App\Http\Controllers\ThptExamController::class, 'startSubmission']);
        Route::post('/thpt-exams/{examId}/submit',                [\App\Http\Controllers\ThptExamController::class, 'submitAnswers']);
        Route::get('/thpt-submissions/{submissionId}/result',     [\App\Http\Controllers\ThptExamController::class, 'getResult']);

        // Exam comments (bình luận / thảo luận đề thi)
        Route::get('/exams/{examId}/comments',          [\App\Http\Controllers\ExamCommentController::class, 'index']);
        Route::post('/exams/{examId}/comments',         [\App\Http\Controllers\ExamCommentController::class, 'store']);
        Route::delete('/exams/{examId}/comments/{id}',  [\App\Http\Controllers\ExamCommentController::class, 'destroy']);

        Route::post('/submissions/{submissionId}/speaking/{partNumber}/upload', [StudentTestController::class, 'uploadSpeakingAudio'])->where(['submissionId' => '[0-9]+', 'partNumber' => '[0-9]+']);
        Route::post('/exams/{examId}/checkin-photo', [StudentTestController::class, 'uploadCheckinPhoto'])->where('examId', '[0-9]+');

        // Test Taking — specific routes FIRST (before parametric /tests/{id})
        Route::get('/tests', [StudentTestController::class, 'index']);
        Route::get('/tests/in-progress', [StudentTestController::class, 'inProgressTests']);
        Route::get('/tests/upcoming', [StudentTestController::class, 'upcomingTests']);
        // Parametric routes — constrain {id} to digits to avoid matching string slugs
        Route::get('/tests/{id}', [StudentTestController::class, 'show'])->where('id', '[0-9]+');
        Route::get('/tests/{id}/resume', [StudentTestController::class, 'resume'])->where('id', '[0-9]+');
        Route::post('/tests/{id}/start', [StudentTestController::class, 'start'])->where('id', '[0-9]+');
        Route::post('/tests/{submissionId}/answer', [StudentTestController::class, 'answer'])->where('submissionId', '[0-9]+')->middleware('throttle:120,1');
        Route::post('/tests/{submissionId}/answers/bulk', [StudentTestController::class, 'bulkAnswer'])->where('submissionId', '[0-9]+')->middleware('throttle:30,1');
        Route::post('/tests/{submissionId}/submit', [StudentTestController::class, 'submit'])->where('submissionId', '[0-9]+')->middleware('throttle:30,1');

        // ── Auto-save / Auto-submit session endpoints ──────────────────────────
        // Idempotent endpoints used by the 5-layer defense-in-depth system.
        // - draft     : debounced server-side save of in-progress answers (1.5s/5s)
        // - heartbeat : keep last_activity_at fresh (cron uses this for inactivity)
        // - auto-submit: called via navigator.sendBeacon on pagehide/visibilitychange
        Route::post('/tests/{submissionId}/draft',       [StudentExamSessionController::class, 'draft'])->where('submissionId', '[0-9]+')->middleware('throttle:240,1');
        Route::post('/tests/{submissionId}/heartbeat',   [StudentExamSessionController::class, 'heartbeat'])->where('submissionId', '[0-9]+')->middleware('throttle:120,1');
        Route::post('/tests/{submissionId}/auto-submit', [StudentExamSessionController::class, 'autoSubmit'])->where('submissionId', '[0-9]+')->middleware('throttle:30,1');

        // Other dashboard endpoints
        Route::get('/recommendations/practice', [StudentTestController::class, 'practiceRecommendations']);
        Route::get('/notifications', [StudentTestController::class, 'getNotifications']);
        Route::put('/notifications/read-all', [StudentTestController::class, 'markAllNotificationsRead']);
        Route::put('/notifications/{id}/read', [StudentTestController::class, 'markNotificationRead']);
        Route::delete('/notifications/{id}', [StudentTestController::class, 'deleteNotification']);

        // Teacher reminders (student-facing)
        Route::get('/reminders', [StudentTestController::class, 'getReminders']);
        Route::put('/reminders/{id}/read', [StudentTestController::class, 'markReminderRead']);
        Route::delete('/reminders/{id}', [StudentTestController::class, 'dismissReminder']);

        // Mục tiêu lớp gần nhất (countdown trên dashboard)
        Route::get('/class-goals/next', [StudentTestController::class, 'nextClassGoal']);

        // Lịch thi sắp tới do giáo viên đặt (dùng cho popup nhắc nhở)
        Route::get('/exam-schedules', [StudentExamScheduleController::class, 'myUpcoming']);

        
        // WebSocket Real-time Features
        Route::post('/websocket/connect', [App\Http\Controllers\TestWebSocketController::class, 'connect']);
        Route::post('/websocket/answer', [App\Http\Controllers\TestWebSocketController::class, 'saveAnswer'])->middleware('throttle:180,1');
        Route::post('/websocket/reconnect', [App\Http\Controllers\TestWebSocketController::class, 'reconnect']);
        Route::post('/websocket/sync-time', [App\Http\Controllers\TestWebSocketController::class, 'syncTime']);
        
        // Submission History & Results Analysis
        Route::get('/submissions', [StudentTestController::class, 'submissions']);
        Route::get('/submissions/{id}', [StudentTestController::class, 'submissionDetail']);
        Route::get('/submissions/{id}/grading-status', [StudentTestController::class, 'getGradingStatus']);
        Route::get('/submissions/{id}/answers', [StudentTestController::class, 'submissionAnswers']);
        Route::get('/submissions/{id}/compare', [StudentTestController::class, 'compareSubmission']);
        
        // Learning Progress & Analytics
        Route::get('/progress', [StudentTestController::class, 'progress']);
        
        // Profile & Settings
        Route::get('/profile', [StudentProfileController::class, 'getProfile']);
        Route::put('/profile', [StudentProfileController::class, 'updateProfile']);
        Route::post('/profile/avatar', [StudentProfileController::class, 'uploadAvatar']);
        Route::delete('/profile/avatar', [StudentProfileController::class, 'deleteAvatar']);
        Route::put('/profile/password', [StudentProfileController::class, 'changePassword']);
        Route::get('/profile/sessions', [StudentProfileController::class, 'getSessions']);
        Route::delete('/profile/sessions/{id}', [StudentProfileController::class, 'revokeSession']);
        Route::delete('/profile/sessions', [StudentProfileController::class, 'revokeAllSessions']);
        Route::get('/settings', [StudentProfileController::class, 'getSettings']);
        Route::put('/settings', [StudentProfileController::class, 'updateSettings']);

        // Exam Highlights & Vocab
        Route::get('/exams/{examId}/highlights', [ExamHighlightController::class, 'getHighlights']);
        Route::post('/exams/{examId}/highlights', [ExamHighlightController::class, 'saveHighlight']);
        Route::delete('/exams/{examId}/highlights/{highlightId}', [ExamHighlightController::class, 'deleteHighlight']);
        Route::get('/exams/{examId}/vocab', [ExamHighlightController::class, 'getVocab']);
        Route::post('/exams/{examId}/vocab', [ExamHighlightController::class, 'saveVocab']);
        Route::delete('/exams/{examId}/vocab/{vocabId}', [ExamHighlightController::class, 'deleteVocab']);
        
        // Courses & Classes
        Route::get('/courses', [StudentCourseController::class, 'getCourses']);
        Route::get('/courses/{id}', [StudentCourseController::class, 'getCourseDetail']);
        Route::get('/courses/{id}/materials', [StudentCourseController::class, 'getMaterials']);
        Route::get('/classes', [StudentCourseController::class, 'getClasses']);
        Route::get('/classes/{id}', [StudentCourseController::class, 'getClassDetail']);
        Route::get('/schedule', [StudentCourseController::class, 'getSchedule']);
        
        // Practice & Self-study — specific routes FIRST
        Route::get('/practice', [StudentPracticeController::class, 'index']);
        Route::get('/practice/topics', [StudentPracticeController::class, 'getTopics']);
        Route::get('/practice/questions', [StudentPracticeController::class, 'getQuestions']);
        Route::get('/practice/history', [StudentPracticeController::class, 'history']);
        Route::post('/practice/sessions', [StudentPracticeController::class, 'createSession']);
        Route::post('/practice/sessions/{submissionId}/answer', [StudentPracticeController::class, 'answer'])->where('submissionId', '[0-9]+');
        Route::post('/practice/sessions/{submissionId}/complete', [StudentPracticeController::class, 'complete'])->where('submissionId', '[0-9]+');
        // Parametric routes — constrain {id} to digits
        Route::get('/practice/{id}', [StudentPracticeController::class, 'show'])->where('id', '[0-9]+');
        Route::post('/practice/{id}/start', [StudentPracticeController::class, 'start'])->where('id', '[0-9]+');
        Route::post('/practice/{submissionId}/answer', [StudentPracticeController::class, 'answer'])->where('submissionId', '[0-9]+');
        Route::post('/practice/{submissionId}/complete', [StudentPracticeController::class, 'complete'])->where('submissionId', '[0-9]+');
        
        // Gamification & Rewards
        Route::prefix('gamification')->group(function () {
            Route::get('/overview', [StudentGamificationController::class, 'getOverview']);
            Route::get('/coins', [StudentGamificationController::class, 'getCoins']);
            Route::get('/badges', [StudentGamificationController::class, 'getBadges']);
            Route::get('/achievements', [StudentGamificationController::class, 'getAchievements']);
            Route::get('/stats', [StudentGamificationController::class, 'getStats']);
            Route::get('/streak', [StudentGamificationController::class, 'getStreak']);
            Route::get('/leaderboard', [StudentGamificationController::class, 'getLeaderboard']);
        });
        
        // Lesson/Exam/Practice Completion (with Gamification)
        Route::post('/lessons/{lessonId}/complete', [App\Http\Controllers\StudentLessonController::class, 'completeLesson']);
        Route::post('/exams/{examId}/submit', [App\Http\Controllers\StudentExamController::class, 'submitExam']);
        Route::post('/practice/complete', [App\Http\Controllers\StudentPracticeController::class, 'completePractice']);
        Route::get('/practice/{submissionId}/result', [StudentPracticeController::class, 'result']);

        // Gamification Test Routes (for testing integration)
        Route::prefix('test/gamification')->group(function () {
            Route::post('/lesson-complete', [TestGamificationController::class, 'testLessonCompletion']);
            Route::post('/exam-complete', [TestGamificationController::class, 'testExamCompletion']);
        });

        // Analytics
        Route::get('/analytics/overview', [StudentAnalyticsController::class, 'overview']);
        Route::get('/analytics/skills', [StudentAnalyticsController::class, 'skills']);
        Route::get('/analytics/today', [StudentAnalyticsController::class, 'today']);
        Route::get('/analytics/weaknesses', [StudentAnalyticsController::class, 'weaknesses']);
        Route::get('/analytics/history', [StudentAnalyticsController::class, 'history']);
    });
    
    /* ======== ADMIN ROUTES ========= */
    Route::middleware(['role:admin', 'admin.audit'])->prefix('admin')->group(function () {

        // ── Audit log (real audit trail của hành động admin) ──
        Route::get('/activity-logs',       [\App\Http\Controllers\AdminActivityLogController::class, 'index']);
        Route::get('/activity-logs/stats', [\App\Http\Controllers\AdminActivityLogController::class, 'stats']);

        // ── Exam Preview (kiểm duyệt) — admin xem đúng UI học viên sẽ thấy khi thi.
        // Tái dùng các controller load có sẵn; admin bỏ qua owner-filter (xem mọi đề).
        Route::get('/exams/{examId}/preview/kids',              [\App\Http\Controllers\KidsExamController::class, 'show']);
        Route::get('/exams/{examId}/preview/vstep/listening',   [ExamController::class, 'loadVstepListeningExam']);
        Route::get('/exams/{examId}/preview/vstep/reading',     [ExamController::class, 'loadVstepExam']);
        Route::get('/exams/{examId}/preview/vstep/writing',     [ExamController::class, 'loadVstepWritingExam']);
        Route::get('/exams/{examId}/preview/vstep/speaking',    [ExamController::class, 'loadVstepSpeakingExam']);
        Route::get('/exams/{examId}/preview/ielts/draft',       [IeltsExamController::class, 'getDraft']);
        Route::get('/exams/{examId}/preview/thpt/draft',        [\App\Http\Controllers\ThptExamController::class, 'getDraft']);

        // Demo làm bài IELTS (admin xem thử UI học viên — chỉ xem, không lưu).
        // Tái dùng loader của StudentTestController (đã cho phép role admin).
        Route::get('/exams/{examId}/preview/ielts/listening',   [StudentTestController::class, 'loadIeltsListening']);
        Route::get('/exams/{examId}/preview/ielts/reading',     [StudentTestController::class, 'loadIeltsReading']);
        Route::get('/exams/{examId}/preview/ielts/writing',     [StudentTestController::class, 'loadIeltsWriting']);
        Route::get('/exams/{examId}/preview/ielts/speaking',    [StudentTestController::class, 'loadIeltsSpeaking']);

        // User Management - View All Users
        Route::get('/users', [UserController::class, 'adminUsers']);
        Route::post('/users', [UserController::class, 'adminCreateUser']);
        Route::get('/users/export', [UserController::class, 'adminExportUsers']);
        Route::get('/users/locked', [UserController::class, 'lockedUsers']);
        Route::post('/users/bulk-action', [UserController::class, 'bulkUserAction']);
        // Rate-limit: 5 lần/phút mỗi user. Lý do: bulk-import có thể chèn tới
        // 1000 users/lượt (xem UserController::bulkImportUsers, max:1000) — là
        // endpoint nặng nhất trong admin area. Nếu spam (vô tình script lặp,
        // hoặc cố tình DOS), DB và mailer/queue sẽ ngộp. throttle:5,1 đủ rộng
        // cho thao tác hợp lệ (admin hiếm khi import liên tục), nhưng chặn
        // được abuse. Key của throttle middleware mặc định là user id (đã
        // authenticated qua sanctum), nên 5/phút là per-user.
        Route::post('/users/bulk-import', [UserController::class, 'bulkImportUsers'])
            ->middleware('throttle:5,1');
        Route::post('/users/{id}/change-role', [UserController::class, 'changeUserRole']);
        Route::post('/users/{id}/lock', [UserController::class, 'lockUser']);
        Route::post('/users/{id}/unlock', [UserController::class, 'unlockUser']);
        Route::post('/users/{id}/reset-password', [UserController::class, 'adminResetPassword']);
        Route::get('/users/{id}', [UserController::class, 'adminUserDetail']);
        Route::put('/users/{id}', [UserController::class, 'adminUpdateUser']);
        Route::delete('/users/{id}', [UserController::class, 'adminDeleteUser']);
        Route::get('/classes/assignments', [UserController::class, 'adminClassAssignments']);
        Route::get('/classes/assignment-teachers', [UserController::class, 'adminAssignmentTeachers']);
        Route::put('/classes/{id}/assign-teacher', [UserController::class, 'adminAssignTeacherToClass']);
        // Quản lý lớp (admin xem chi tiết, gỡ học viên, xóa lớp)
        Route::get('/classes/{id}/detail', [UserController::class, 'adminClassDetail']);
        Route::delete('/classes/{id}', [UserController::class, 'adminDeleteClass']);
        Route::delete('/classes/{id}/students/{studentId}', [UserController::class, 'adminRemoveStudentFromClass']);

        // Bàn giao lớp (admin xử lý yêu cầu)
        Route::get('/handover-requests', [AdminHandoverController::class, 'index']);
        Route::post('/handover-requests/{id}/approve', [AdminHandoverController::class, 'approve']);
        Route::post('/handover-requests/{id}/reject', [AdminHandoverController::class, 'reject']);
        Route::get('/students/new-registrations', [UserController::class, 'adminStudentNewRegistrations']);
        Route::get('/students/complaints', [UserController::class, 'adminStudentComplaints']);
        Route::post('/students/complaints/{id}/resolve', [UserController::class, 'resolveStudentComplaint']);

        // Role Management
        Route::get('/roles/statistics', [UserController::class, 'roleStatistics']);

        // System Statistics
        Route::get('/statistics/overview', [UserController::class, 'systemOverview']);
        Route::get('/statistics/activity', [UserController::class, 'userActivity']);

        // Export & Reports
        Route::get('/reports/user-activity', [UserController::class, 'userActivityReport']);
        
        // Content Management - Blog Moderation
        Route::get('/posts', [BlogController::class, 'adminPosts']);
        Route::get('/posts/pending', [BlogController::class, 'pendingPosts']);
        Route::get('/posts/{id}', [BlogController::class, 'adminPostDetail']);
        Route::post('/posts/{id}/approve', [BlogController::class, 'approvePost']);
        Route::post('/posts/{id}/reject', [BlogController::class, 'rejectPost']);
        Route::delete('/posts/{id}', [BlogController::class, 'adminDeletePost']);
        
        // Category Management
        Route::get('/categories', [CategoryController::class, 'adminCategories']);
        Route::post('/categories', [CategoryController::class, 'adminCreateCategory']);
        Route::put('/categories/{id}', [CategoryController::class, 'adminUpdateCategory']);
        Route::delete('/categories/{id}', [CategoryController::class, 'adminDeleteCategory']);
        Route::post('/courses', [CourseController::class, 'adminCreateCourse']);
        
        // Exam Template Management
        Route::get('/exam-templates', [ExamTemplateController::class, 'adminTemplates']);
        Route::post('/exam-templates', [ExamTemplateController::class, 'adminCreateTemplate']);
        Route::put('/exam-templates/{id}', [ExamTemplateController::class, 'adminUpdateTemplate']);
        Route::delete('/exam-templates/{id}', [ExamTemplateController::class, 'adminDeleteTemplate']);
        Route::post('/exam-templates/{id}/activate', [ExamTemplateController::class, 'activateTemplate']);
        Route::post('/exam-templates/{id}/deactivate', [ExamTemplateController::class, 'deactivateTemplate']);
        
        // Exam Moderation
        Route::get('/exams', [ExamController::class, 'adminExams']);
        Route::get('/exams/pending', [ExamController::class, 'pendingExams']);
        Route::get('/exams/statistics', [ExamController::class, 'examStatistics']);
        Route::get('/exams/{id}', [ExamController::class, 'adminExamDetail']);
        Route::post('/exams/{id}/approve', [ExamController::class, 'approveExam']);
        Route::post('/exams/{id}/reject', [ExamController::class, 'rejectExam']);
        Route::delete('/exams/{id}', [ExamController::class, 'adminDeleteExam']);
        
        // Statistics
        Route::get('/content/statistics', [BlogController::class, 'contentStatistics']);
        Route::get('/templates/statistics', [ExamTemplateController::class, 'templateStatistics']);
        // Admin Profile
        Route::prefix('profile')->group(function () {
            Route::get('/',          [AdminSystemController::class, 'getProfile']);
            Route::put('/',          [AdminSystemController::class, 'updateProfile']);
            Route::get('/sessions',  [AdminSystemController::class, 'getSessions']);
            Route::delete('/sessions/{id}', [AdminSystemController::class, 'revokeSession']);
            Route::delete('/sessions',      [AdminSystemController::class, 'revokeAllSessions']);
        });

        // System Settings & Notifications
        Route::prefix('system')->group(function () {
            Route::get('/health', [AdminSystemController::class, 'systemHealth']);
            Route::get('/settings', [AdminSystemController::class, 'getSettings']);
            Route::post('/settings', [AdminSystemController::class, 'updateSettings']);
            Route::get('/notifications', [AdminSystemController::class, 'getNotifications']);
            Route::get('/recent-activity', [AdminSystemController::class, 'recentActivity']);
            Route::post('/notifications/{id}/read', [AdminSystemController::class, 'markNotificationRead']);
        });

        // System Reports & Analytics
        Route::prefix('reports')->group(function () {
            Route::get('/dashboard', [SystemReportController::class, 'dashboard']);
            Route::get('/users', [SystemReportController::class, 'userStatistics']);
            Route::get('/courses', [SystemReportController::class, 'courseStatistics']);
            Route::get('/activity', [SystemReportController::class, 'activityReport']);
            Route::get('/trends', [SystemReportController::class, 'trendsAnalysis']);
            Route::get('/export', [SystemReportController::class, 'exportReport']);
        });
    });
});

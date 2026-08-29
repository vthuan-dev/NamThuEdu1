<?php

namespace Tests\Feature;

use App\Jobs\GradeThptSpeakingJob;
use App\Jobs\GradeThptWritingJob;
use App\Models\Exam;
use App\Models\Submission;
use App\Models\User;
use App\Services\VstepGradingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Điểm tổng do giáo viên tự nhập là quyết định của con người. Không đường tự động nào
 * được ghi đè nó.
 *
 * Dự án có BỐN chỗ ghi `sScore`, mỗi chỗ là một đường mất điểm riêng:
 *
 *   1. getResult()               — chấm lại mỗi lần học viên xem điểm
 *   2. GradeThptWritingJob       — AI chấm Viết, chạy trong queue
 *   3. GradeThptSpeakingJob      — AI chấm Nói, chạy trong queue
 *   4. startSubmission() timeout — tự nộp khi hết giờ
 *
 * Hai job đặc biệt nguy hiểm: chúng chạy bất đồng bộ nên có thể tới SAU khi giáo viên
 * đã chấm tay (nộp → job xếp hàng → queue chậm → giáo viên chấm → job ghi đè). Và đề
 * Viết/Nói chính là loại bắt buộc chấm tay, nên xác suất gặp cao.
 *
 * QUAN TRỌNG: các test này PHẢI thực sự chạy tới đoạn ghi điểm. Bản đầu tôi viết
 * `try { handle() } catch {}` và cả 3 test vẫn xanh khi bỏ bản sửa — vì job return
 * sớm do không có dữ liệu Viết/Nói, chưa bao giờ chạm tới dòng ghi `sScore`. Test
 * xanh mà không kiểm được gì. Nay dùng service giả để job đi hết luồng.
 */
class TeacherScoreProtectionTest extends TestCase
{
    use RefreshDatabase;

    /** Điểm giáo viên đã phát hành. */
    private const TEACHER_SCORE = 9.8;

    /** Điểm AI giả trả về — thấp hơn hẳn để thấy rõ nếu bị ghi đè. */
    private const FAKE_AI_SCORE = 3.0;

    private function makeSubmission(bool $withTeacherOverride, string $sectionType): Submission
    {
        $teacher = User::factory()->create(['uRole' => 'teacher']);
        $student = User::factory()->create(['uRole' => 'student', 'age_group' => 'teens']);

        $config = [
            'version' => '2.0',
            'level' => 'THPT',
            'scale_max' => 10,
            'sections' => [[
                'id' => 's_sub',
                'type' => $sectionType,
                'title' => ucfirst($sectionType),
                'instructions' => '',
                'items' => [[
                    'question_number' => 1,
                    'prompt' => 'Viết một đoạn văn về sở thích của bạn.',
                ]],
            ]],
        ];

        $exam = Exam::factory()->create([
            'eType' => 'THPT',
            'eStatus' => 'published',
            'eTeacher_id' => $teacher->uId,
            'thpt_config' => $config,
        ]);

        $result = [
            'raw_score' => 0,
            'raw_score_max' => 0,
            'scale_max' => 10,
            'scaled_score' => 0,
            'sections' => [],
        ];
        if ($withTeacherOverride) {
            $result['teacher_override_score'] = self::TEACHER_SCORE;
        }

        $sub = Submission::create([
            'user_id' => $student->uId,
            'exam_id' => $exam->eId,
            'sStatus' => 'graded',
            'sScore' => $withTeacherOverride ? self::TEACHER_SCORE : 0,
            'sStart_time' => now()->subHour(),
            'sSubmit_time' => now()->subMinutes(30),
            'sGraded_time' => now(),
            'submission_payload' => [
                // Bài viết đủ dài (>30 ký tự) để job KHÔNG đi vào nhánh "quá ngắn".
                'answers' => ['q1' => 'Tôi rất thích đọc sách vào mỗi buổi tối trước khi đi ngủ vì nó giúp tôi thư giãn.'],
                'exam_snapshot' => ['version' => 1, 'config' => $config],
                'result' => $result,
            ],
        ]);

        if ($sectionType === 'speaking') {
            // Job Nói return sớm nếu không có audio.
            $sub->sGemini_feedback = json_encode([
                'speaking_audio' => ['1' => 'https://example.test/audio/1.webm'],
            ]);
            $sub->save();
        }

        return $sub;
    }

    /**
     * Service giả: luôn trả điểm thấp, không gọi mạng. Nếu bản sửa không hoạt động,
     * điểm này sẽ ghi đè điểm giáo viên và test thấy ngay.
     */
    private function bindFakeGradingService(): void
    {
        $fake = new class extends VstepGradingService {
            public function __construct() {}

            public function gradeSingleWritingTask(int $taskNum, string $taskPrompt, string $studentResponse): array
            {
                return [
                    'score' => TeacherScoreProtectionTest::fakeAiScore(),
                    'feedback' => 'fake',
                    'suggestions' => [],
                    'criteria' => [],
                    'criterion_comments' => [],
                ];
            }

            public function gradeSpeakingAudio(string $audioUrl, string $context = '', int $partNum = 1): array
            {
                return [
                    'score' => TeacherScoreProtectionTest::fakeAiScore(),
                    'feedback' => 'fake',
                    'suggestions' => [],
                ];
            }
        };

        $this->app->instance(VstepGradingService::class, $fake);
    }

    public static function fakeAiScore(): float
    {
        return self::FAKE_AI_SCORE;
    }

    /**
     * @test
     * Job chấm Viết chạy sau khi giáo viên đã chấm → không được hạ điểm.
     */
    public function the_writing_ai_job_does_not_overwrite_a_teacher_score(): void
    {
        $this->bindFakeGradingService();
        $sub = $this->makeSubmission(true, 'writing');

        $this->app->call([new GradeThptWritingJob((int) $sub->sId), 'handle']);

        $fresh = Submission::find($sub->sId);
        $payload = $fresh->submission_payload;

        // Chứng minh job ĐÃ chạy hết luồng, không return sớm.
        $this->assertNotEmpty(
            $payload['result']['writing']['parts'] ?? [],
            'Job phải chấm xong phần Viết — nếu rỗng thì test không kiểm được gì.'
        );

        $this->assertEquals(
            self::TEACHER_SCORE,
            (float) $fresh->sScore,
            'Job chấm Viết KHÔNG được ghi đè điểm giáo viên.'
        );
    }

    /**
     * @test
     * Job chấm Nói chạy sau khi giáo viên đã chấm → không được hạ điểm.
     */
    public function the_speaking_ai_job_does_not_overwrite_a_teacher_score(): void
    {
        $this->bindFakeGradingService();
        $sub = $this->makeSubmission(true, 'speaking');

        $this->app->call([new GradeThptSpeakingJob((int) $sub->sId), 'handle']);

        $fresh = Submission::find($sub->sId);
        $payload = $fresh->submission_payload;

        $this->assertNotEmpty(
            $payload['result']['speaking']['parts'] ?? [],
            'Job phải chấm xong phần Nói — nếu rỗng thì test không kiểm được gì.'
        );

        $this->assertEquals(
            self::TEACHER_SCORE,
            (float) $fresh->sScore,
            'Job chấm Nói KHÔNG được ghi đè điểm giáo viên.'
        );
    }

    /**
     * @test
     * ĐỐI CHỨNG: không có điểm giáo viên thì điểm AI vẫn phải được ghi như trước.
     *
     * Thiếu test này, một bản "sửa" chặn hết mọi đường ghi điểm cũng sẽ xanh, trong
     * khi thực tế đã làm chết việc chấm tự động.
     */
    public function the_writing_ai_job_still_writes_the_score_when_no_teacher_graded(): void
    {
        $this->bindFakeGradingService();
        $sub = $this->makeSubmission(false, 'writing');

        $this->app->call([new GradeThptWritingJob((int) $sub->sId), 'handle']);

        $fresh = Submission::find($sub->sId);

        $this->assertEquals(
            self::FAKE_AI_SCORE,
            (float) $fresh->sScore,
            'Không có điểm giáo viên thì điểm AI PHẢI được ghi.'
        );
    }

    /**
     * @test
     * Điểm AI vẫn phải lưu được trong payload để màn hình chấm hiển thị, dù không
     * dùng làm điểm tổng.
     */
    public function the_ai_score_is_still_recorded_in_the_payload_for_the_teacher_to_see(): void
    {
        $this->bindFakeGradingService();
        $sub = $this->makeSubmission(true, 'writing');

        $this->app->call([new GradeThptWritingJob((int) $sub->sId), 'handle']);

        $payload = Submission::find($sub->sId)->submission_payload;

        $this->assertEquals(
            self::FAKE_AI_SCORE,
            (float) ($payload['result']['writing']['score'] ?? -1),
            'Điểm AI phải còn trong payload để giáo viên đối chiếu.'
        );
        $this->assertEquals(
            self::TEACHER_SCORE,
            (float) ($payload['result']['teacher_override_score'] ?? -1),
            'Điểm giáo viên phải còn nguyên trong payload.'
        );
    }
}

<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Exam;
use App\Models\Submission;
use App\Models\TestAssignment;
use Illuminate\Foundation\Testing\RefreshDatabase;

class ThptExamTest extends TestCase
{
    use RefreshDatabase;

    protected $teacher;
    protected $teacherToken;
    protected $student;
    protected $studentToken;

    protected function setUp(): void
    {
        parent::setUp();
        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
        $this->teacherToken = $this->teacher->createToken('test')->plainTextToken;

        $this->student = User::factory()->create(['uRole' => 'student', 'age_group' => 'teens']);
        $this->studentToken = $this->student->createToken('test')->plainTextToken;
    }

    private function teacherHeader(): array
    {
        return ['Authorization' => 'Bearer ' . $this->teacherToken];
    }

    private function studentHeader(): array
    {
        return ['Authorization' => 'Bearer ' . $this->studentToken];
    }

    /**
     * Tạo một config section-based đầy đủ các dạng để test grading.
     */
    private function sampleConfig(): array
    {
        return [
            'version' => '2.0',
            'level' => 'THPT',
            'total_duration_minutes' => 60,
            'scale_max' => 10,
            'sections' => [
                // phonetics — single answer
                [
                    'id' => 's_phon', 'type' => 'phonetics', 'variant' => 'pronunciation', 'points_per_question' => 1,
                    'title' => 'Pronunciation', 'instructions' => '',
                    'items' => [
                        ['question_number' => 1, 'correct_id' => 'C', 'words' => [
                            ['id' => 'A', 'text' => 'cats'], ['id' => 'B', 'text' => 'books'],
                            ['id' => 'C', 'text' => 'dogs'], ['id' => 'D', 'text' => 'maps'],
                        ]],
                    ],
                ],
                // mc_questions — single answer
                [
                    'id' => 's_mc', 'type' => 'mc_questions', 'variant' => 'grammar', 'points_per_question' => 1,
                    'title' => 'Grammar', 'instructions' => '',
                    'items' => [
                        ['question_number' => 2, 'prompt' => 'She ___ here.', 'correct_id' => 'B', 'options' => [
                            ['id' => 'A', 'text' => 'live'], ['id' => 'B', 'text' => 'lives'],
                            ['id' => 'C', 'text' => 'living'], ['id' => 'D', 'text' => 'lived'],
                        ]],
                    ],
                ],
                // word_form — text answer with accepted_answers
                [
                    'id' => 's_wf', 'type' => 'word_form', 'points_per_question' => 1,
                    'title' => 'Word form', 'instructions' => '',
                    'items' => [
                        ['question_number' => 3, 'sentence' => 'She is ___', 'root_word' => 'CREATE',
                         'accepted_answers' => ['creative'], 'case_sensitive' => false],
                    ],
                ],
                // tf_group — boolean statements
                [
                    'id' => 's_tf', 'type' => 'tf_group', 'points_per_question' => 1,
                    'title' => 'TF', 'instructions' => '',
                    'items' => [
                        ['question_number' => 4, 'context' => 'Some notice', 'context_style' => 'notice', 'statements' => [
                            ['id' => '4-1', 'text' => 'A', 'correct' => true],
                            ['id' => '4-2', 'text' => 'B', 'correct' => false],
                        ]],
                    ],
                ],
                // matching
                [
                    'id' => 's_match', 'type' => 'matching', 'points_per_question' => 1,
                    'title' => 'Matching', 'instructions' => '',
                    'items' => [
                        ['question_number' => 5, 'list_1' => ['a', 'b', 'c', 'd'],
                         'list_2' => ['1', '2', '3', '4', '5', '6'],
                         'answers' => ['1' => 'A', '2' => 'B', '3' => 'C', '4' => 'D']],
                    ],
                ],
                // open_cloze — text answer
                [
                    'id' => 's_open', 'type' => 'open_cloze', 'points_per_question' => 1,
                    'title' => 'Open cloze', 'instructions' => '',
                    'passage' => 'We (6) ____ here.',
                    'blanks' => [
                        ['question_number' => 6, 'accepted_answers' => ['live', 'stay'], 'case_sensitive' => false],
                    ],
                ],
            ],
        ];
    }

    /* ========================== TEACHER ============================= */

    /** @test */
    public function teacher_can_create_thpt_draft()
    {
        $response = $this->withHeaders($this->teacherHeader())
            ->postJson('/api/teacher/exams/thpt', [
                'eTitle' => 'Đề THPT thử',
                'eDescription' => 'mô tả',
                'age_group' => 'teens',
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('status', 'success');
        $this->assertNotNull($response->json('data.eId'));

        $this->assertDatabaseHas('exams', [
            'eTitle' => 'Đề THPT thử',
            'eType' => 'THPT',
            'eSkill' => 'mixed',
            'eScope' => 'full',
            'age_group' => 'teens',
            'eStatus' => 'draft',
        ]);
    }

    /** @test */
    public function teacher_can_update_thpt_draft_config()
    {
        $createRes = $this->withHeaders($this->teacherHeader())
            ->postJson('/api/teacher/exams/thpt', ['eTitle' => 'X']);
        $examId = $createRes->json('data.eId');

        $response = $this->withHeaders($this->teacherHeader())
            ->putJson("/api/teacher/exams/{$examId}/thpt", [
                'eTitle' => 'Đã sửa',
                'thpt_config' => $this->sampleConfig(),
            ]);

        $response->assertStatus(200);
        $exam = Exam::find($examId);
        $this->assertEquals('Đã sửa', $exam->eTitle);
        $this->assertEquals('2.0', $exam->thpt_config['version']);
        $this->assertCount(6, $exam->thpt_config['sections']);
    }

    /** @test */
    public function teacher_can_get_draft()
    {
        $createRes = $this->withHeaders($this->teacherHeader())
            ->postJson('/api/teacher/exams/thpt', ['eTitle' => 'Draft']);
        $examId = $createRes->json('data.eId');

        $response = $this->withHeaders($this->teacherHeader())
            ->getJson("/api/teacher/exams/{$examId}/thpt/draft");

        $response->assertStatus(200);
        $response->assertJsonPath('data.eTitle', 'Draft');
        $response->assertJsonPath('data.thpt_config.version', '2.0');
    }

    /** @test */
    public function teacher_cannot_publish_empty_exam()
    {
        $createRes = $this->withHeaders($this->teacherHeader())
            ->postJson('/api/teacher/exams/thpt', ['eTitle' => 'Empty']);
        $examId = $createRes->json('data.eId');

        $response = $this->withHeaders($this->teacherHeader())
            ->postJson("/api/teacher/exams/{$examId}/thpt/publish");

        $response->assertStatus(422);
        $response->assertJsonPath('status', 'error');
    }

    /** @test */
    public function teacher_can_publish_valid_exam()
    {
        $createRes = $this->withHeaders($this->teacherHeader())
            ->postJson('/api/teacher/exams/thpt', ['eTitle' => 'Valid']);
        $examId = $createRes->json('data.eId');

        $this->withHeaders($this->teacherHeader())
            ->putJson("/api/teacher/exams/{$examId}/thpt", [
                'thpt_config' => $this->sampleConfig(),
            ]);

        $response = $this->withHeaders($this->teacherHeader())
            ->postJson("/api/teacher/exams/{$examId}/thpt/publish");

        $response->assertStatus(200);
        $this->assertEquals('published', Exam::find($examId)->eStatus);
    }

    /** @test */
    public function student_cannot_access_teacher_endpoints()
    {
        $response = $this->withHeaders($this->studentHeader())
            ->postJson('/api/teacher/exams/thpt', ['eTitle' => 'Hack']);
        // route bị chặn bởi role middleware (403) hoặc controller (401)
        $this->assertContains($response->status(), [401, 403]);
    }

    /* ========================== STUDENT ============================= */

    /**
     * Đề THPT đã publish. Mặc định giao luôn cho học viên (không giới hạn lượt)
     * vì `/thpt-exams/{id}` và `/start` giờ áp policy assigned_only — học viên
     * chưa được giao thì nhận 403 chứ không vào được đề.
     *
     * $assignToStudent = false: dùng cho các test kiểm tra chính policy đó.
     */
    private function publishSampleExam(bool $assignToStudent = true): int
    {
        $exam = Exam::create([
            'eTitle' => 'Đề công bố',
            'eType' => 'THPT',
            'eSkill' => 'reading',
            'eDuration_minutes' => 60,
            'eStatus' => 'published',
            'ePurpose' => 'exam',
            'eTeacher_id' => $this->teacher->uId,
            'age_group' => 'teens',
            'thpt_config' => $this->sampleConfig(),
        ]);

        if ($assignToStudent) {
            // taMax_attempt = 0 → không giới hạn, nên các test không liên quan
            // tới lượt vẫn chạy như trước.
            $this->assignToStudent($exam->eId, 0);
        }

        return $exam->eId;
    }

    /**
     * Config có tf_group + matching bị bỏ trống một phần — đúng như dữ liệu thật
     * mà factory tạo ra (makeTfItem: 4 mệnh đề, makeMatchingItem: 4/6 dòng).
     */
    private function partiallyFilledConfig(): array
    {
        return [
            'version' => '2.0',
            'level' => 'THPT',
            'total_duration_minutes' => 60,
            'scale_max' => 10,
            'sections' => [
                [
                    'id' => 's_tf', 'type' => 'tf_group', 'points_per_question' => 1,
                    'title' => 'TF', 'instructions' => '',
                    'items' => [
                        ['question_number' => 1, 'context' => 'Notice', 'context_style' => 'notice', 'statements' => [
                            ['id' => '1-1', 'text' => 'Mệnh đề một', 'correct' => true],
                            ['id' => '1-2', 'text' => '', 'correct' => false],
                            ['id' => '1-3', 'text' => 'Mệnh đề ba', 'correct' => false],
                            ['id' => '1-4', 'text' => '', 'correct' => false],
                        ]],
                    ],
                ],
                [
                    'id' => 's_match', 'type' => 'matching', 'points_per_question' => 1,
                    'title' => 'Matching', 'instructions' => '',
                    'items' => [
                        ['question_number' => 2,
                         'list_1' => ['Câu một', 'Câu hai', '', ''],
                         'list_2' => ['Đáp A', 'Đáp B', '', '', '', ''],
                         'answers' => ['1' => 'A', '2' => 'B', '3' => 'A', '4' => 'A']],
                    ],
                ],
            ],
        ];
    }

    private function publishConfig(array $config): int
    {
        return Exam::create([
            'eTitle' => 'Đề một phần',
            'eType' => 'THPT',
            'eSkill' => 'reading',
            'eDuration_minutes' => 60,
            'eStatus' => 'published',
            'ePurpose' => 'exam',
            'eTeacher_id' => $this->teacher->uId,
            'age_group' => 'teens',
            'thpt_config' => $config,
        ])->eId;
    }

    /** @test */
    public function empty_statements_and_rows_are_not_counted_in_the_max_score()
    {
        $examId = $this->publishConfig($this->partiallyFilledConfig());
        $this->assignToStudent($examId, 0);

        $start = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", []);
        $sid = $start->json('data.submission_id');

        // Trả lời ĐÚNG mọi thứ học viên thực sự nhìn thấy: 2 mệnh đề + 2 dòng nối.
        $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/submit", [
                'submission_id' => $sid,
                'answers' => [
                    'q1.s1' => true,
                    'q1.s3' => false,
                    'q2.1' => 'A',
                    'q2.2' => 'B',
                ],
                'final' => true,
            ])->assertStatus(200);

        $res = $this->withHeaders($this->studentHeader())
            ->getJson("/api/student/thpt-submissions/{$sid}/result");
        $res->assertStatus(200);

        // Trước khi fix: mệnh đề/dòng rỗng vẫn cộng vào điểm tối đa, mà học viên
        // không thấy nên không trả lời → tính sai. Đúng hết 4 mà ra 4/8.
        $this->assertEquals(4, $res->json('data.result.raw_score_max'));
        $this->assertEquals(4, $res->json('data.result.raw_score'));
    }

    /** @test */
    public function answer_keys_keep_their_original_index_after_filtering()
    {
        $examId = $this->publishConfig($this->partiallyFilledConfig());
        $this->assignToStudent($examId, 0);

        $start = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", []);
        $sid = $start->json('data.submission_id');

        $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/submit", [
                'submission_id' => $sid,
                'answers' => ['q1.s1' => true, 'q1.s3' => false, 'q2.1' => 'A', 'q2.2' => 'B'],
                'final' => true,
            ]);

        $keys = array_keys(
            $this->withHeaders($this->studentHeader())
                ->getJson("/api/student/thpt-submissions/{$sid}/result")
                ->json('data.result.correct_answers')
        );

        // Mệnh đề thứ 3 phải giữ khoá .s3, KHÔNG được dồn thành .s2 — đánh số lại
        // sẽ làm lệch mọi bài đã chấm trước đó.
        $this->assertContains('q1.s1', $keys);
        $this->assertContains('q1.s3', $keys);
        $this->assertNotContains('q1.s2', $keys);
        $this->assertNotContains('q1.s4', $keys);
        $this->assertNotContains('q2.3', $keys);
    }

    /** @test */
    public function a_matching_question_with_only_two_rows_can_be_published()
    {
        $createRes = $this->withHeaders($this->teacherHeader())
            ->postJson('/api/teacher/exams/thpt', ['eTitle' => 'Match']);
        $examId = $createRes->json('data.eId');

        $config = $this->partiallyFilledConfig();
        // Chỉ có đáp án cho 2 dòng đã nhập; 2 dòng rỗng không có đáp án.
        $config['sections'][1]['items'][0]['answers'] = ['1' => 'A', '2' => 'B'];

        $this->withHeaders($this->teacherHeader())
            ->putJson("/api/teacher/exams/{$examId}/thpt", ['thpt_config' => $config]);

        // Trước khi fix: validation đòi đủ 4 khoá ('1'..'4') nên bài chỉ dùng 2
        // dòng KHÔNG THỂ publish, dù giáo viên đã nối đủ mọi dòng có nội dung.
        $this->withHeaders($this->teacherHeader())
            ->postJson("/api/teacher/exams/{$examId}/thpt/publish")
            ->assertStatus(200);

        $this->assertEquals('published', Exam::find($examId)->eStatus);
    }

    /** @test */
    public function publish_still_requires_an_answer_for_every_filled_matching_row()
    {
        $createRes = $this->withHeaders($this->teacherHeader())
            ->postJson('/api/teacher/exams/thpt', ['eTitle' => 'Match bad']);
        $examId = $createRes->json('data.eId');

        $config = $this->partiallyFilledConfig();
        // Dòng 2 CÓ nội dung nhưng thiếu đáp án → vẫn phải bị chặn.
        $config['sections'][1]['items'][0]['answers'] = ['1' => 'A'];

        $this->withHeaders($this->teacherHeader())
            ->putJson("/api/teacher/exams/{$examId}/thpt", ['thpt_config' => $config]);

        $this->withHeaders($this->teacherHeader())
            ->postJson("/api/teacher/exams/{$examId}/thpt/publish")
            ->assertStatus(422);
    }

    /** @test */
    public function publish_is_rejected_when_the_answer_points_at_an_empty_choice()
    {
        $createRes = $this->withHeaders($this->teacherHeader())
            ->postJson('/api/teacher/exams/thpt', ['eTitle' => 'Bad key']);
        $examId = $createRes->json('data.eId');

        $config = $this->sampleConfig();
        // Chọn đáp án đúng là D rồi xoá nội dung D — trước khi fix vẫn publish
        // được, và KHÔNG học viên nào có thể đúng câu đó.
        $config['sections'][1]['items'][0]['correct_id'] = 'D';
        $config['sections'][1]['items'][0]['options'][3]['text'] = '';

        $this->withHeaders($this->teacherHeader())
            ->putJson("/api/teacher/exams/{$examId}/thpt", ['thpt_config' => $config]);

        $res = $this->withHeaders($this->teacherHeader())
            ->postJson("/api/teacher/exams/{$examId}/thpt/publish");

        $res->assertStatus(422);
        $this->assertStringContainsString('chưa có nội dung', json_encode($res->json(), JSON_UNESCAPED_UNICODE));
    }

    /** @test */
    public function student_gets_exam_without_answers()
    {
        $examId = $this->publishSampleExam();

        $response = $this->withHeaders($this->studentHeader())
            ->getJson("/api/student/thpt-exams/{$examId}");

        $response->assertStatus(200);
        $config = $response->json('data.thpt_config');

        // Đáp án phải bị strip
        $phon = collect($config['sections'])->firstWhere('id', 's_phon');
        $this->assertArrayNotHasKey('correct_id', $phon['items'][0]);

        $tf = collect($config['sections'])->firstWhere('id', 's_tf');
        $this->assertArrayNotHasKey('correct', $tf['items'][0]['statements'][0]);

        $match = collect($config['sections'])->firstWhere('id', 's_match');
        $this->assertArrayNotHasKey('answers', $match['items'][0]);

        $open = collect($config['sections'])->firstWhere('id', 's_open');
        $this->assertArrayNotHasKey('accepted_answers', $open['blanks'][0]);
    }

    /** @test */
    public function student_cannot_access_unpublished_exam()
    {
        $exam = Exam::create([
            'eTitle' => 'Nháp',
            'eType' => 'THPT',
            'eSkill' => 'reading',
            'eDuration_minutes' => 60,
            'eStatus' => 'draft',
            'eTeacher_id' => $this->teacher->uId,
            'thpt_config' => $this->sampleConfig(),
        ]);

        $response = $this->withHeaders($this->studentHeader())
            ->getJson("/api/student/thpt-exams/{$exam->eId}");

        // Đề chưa publish trả 409 + thông báo rõ ràng (KHÔNG phải 404 "không
        // tìm thấy đề") để giáo viên/học viên hiểu vì sao bài đã giao mà không
        // mở được. Hành vi này được chốt ở AssignPublishedOnlyTest.
        $response->assertStatus(409);
        $this->assertStringContainsString('chưa được giáo viên xuất bản', $response->json('message'));
    }

    /** @test */
    public function student_can_start_submission()
    {
        $examId = $this->publishSampleExam();

        $response = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", []);

        $response->assertStatus(200);
        $this->assertNotNull($response->json('data.submission_id'));
        $this->assertFalse($response->json('data.resumed'));

        $this->assertDatabaseHas('submissions', [
            'exam_id' => $examId,
            'user_id' => $this->student->uId,
            'sStatus' => 'in_progress',
        ]);
    }

    /** @test */
    public function start_resumes_existing_in_progress_submission()
    {
        $examId = $this->publishSampleExam();

        $first = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", []);
        $firstId = $first->json('data.submission_id');

        $second = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", []);

        $this->assertEquals($firstId, $second->json('data.submission_id'));
        $this->assertTrue($second->json('data.resumed'));
        $this->assertDatabaseCount('submissions', 1);
    }

    /**
     * Giao đề cho chính học viên trong test với số lượt tối đa cụ thể.
     * $deadline = null → mặc định còn hạn (3 ngày nữa).
     * $startTime = null → không đặt giờ mở (làm được ngay).
     */
    private function assignToStudent(
        int $examId,
        int $maxAttempt,
        $deadline = null,
        $startTime = null
    ): TestAssignment {
        return TestAssignment::create([
            'exam_id' => $examId,
            'taTarget_type' => 'student',
            'taTarget_id' => $this->student->uId,
            'taDeadline' => $deadline ?? now()->addDays(3),
            'taStart_time' => $startTime,
            'taMax_attempt' => $maxAttempt,
            'taCreated_at' => now(),
        ]);
    }

    /** @test */
    public function start_is_blocked_before_the_assignment_opens()
    {
        $examId = $this->publishSampleExam(false);
        // GV đặt mở làm bài ngày mai.
        $this->assignToStudent($examId, 1, now()->addDays(2), now()->addDay());

        $res = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", []);

        // Trước khi fix: taStart_time không được kiểm tra ở bất kỳ đâu → vào
        // thi được ngay dù đề hẹn mở ngày hôm sau.
        $res->assertStatus(403);
        $this->assertStringContainsString('chưa mở', $res->json('message'));
        $this->assertDatabaseCount('submissions', 0);
    }

    /** @test */
    public function start_is_blocked_after_the_deadline()
    {
        $examId = $this->publishSampleExam(false);
        $this->assignToStudent($examId, 1, now()->subDay());

        $res = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", []);

        // Trước khi fix: THPT không kiểm tra taDeadline ở đâu cả (chỉ dùng để sắp
        // thứ tự ưu tiên assignment) → đề quá hạn vẫn vào thi bình thường.
        $res->assertStatus(403);
        $this->assertStringContainsString('hết hạn', $res->json('message'));
        $this->assertDatabaseCount('submissions', 0);
    }

    /** @test */
    public function an_in_progress_session_can_still_be_resumed_after_the_deadline()
    {
        $examId = $this->publishSampleExam(false);
        $assignment = $this->assignToStudent($examId, 1, now()->addMinutes(5));

        $start = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [
                'assignment_id' => $assignment->taId,
            ]);
        $start->assertStatus(200);
        $sid = $start->json('data.submission_id');

        // Deadline trôi qua GIỮA lúc đang làm bài.
        $assignment->taDeadline = now()->subMinute();
        $assignment->save();

        // Phải vẫn mở lại được để nộp nốt — gate deadline đặt SAU nhánh resume.
        // Không tạo lỗ hỏng: lượt này đã bị tính vào pool từ lúc tạo.
        $resume = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [
                'assignment_id' => $assignment->taId,
            ]);

        $resume->assertStatus(200);
        $this->assertTrue($resume->json('data.resumed'));
        $this->assertEquals($sid, $resume->json('data.submission_id'));

        // Nhưng nộp xong thì không được bắt đầu lượt mới nữa.
        $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/submit", [
                'submission_id' => $sid,
                'answers' => ['q1' => 'C'],
                'final' => true,
            ])->assertStatus(200);

        $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [
                'assignment_id' => $assignment->taId,
            ])->assertStatus(403);
    }

    /** @test */
    public function start_is_blocked_when_assignment_attempt_limit_reached()
    {
        $examId = $this->publishSampleExam();
        $assignment = $this->assignToStudent($examId, 1);

        $start = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [
                'assignment_id' => $assignment->taId,
            ]);
        $start->assertStatus(200);
        $sid = $start->json('data.submission_id');

        $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/submit", [
                'submission_id' => $sid,
                'answers' => ['q1' => 'C'],
                'final' => true,
            ])->assertStatus(200);

        // Đã dùng 1/1 lượt → không được tạo phiên mới nữa.
        $again = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [
                'assignment_id' => $assignment->taId,
            ]);

        $again->assertStatus(403);
        $this->assertStringContainsString('1 lần', $again->json('message'));
        $this->assertDatabaseCount('submissions', 1);
    }

    /** @test */
    public function start_still_resumes_in_progress_session_when_limit_is_one()
    {
        $examId = $this->publishSampleExam();
        $assignment = $this->assignToStudent($examId, 1);

        $first = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [
                'assignment_id' => $assignment->taId,
            ]);
        $first->assertStatus(200);

        // Reload trang giữa lúc đang thi: phải resume, KHÔNG bị gate chặn.
        $second = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [
                'assignment_id' => $assignment->taId,
            ]);

        $second->assertStatus(200);
        $this->assertTrue($second->json('data.resumed'));
        $this->assertEquals($first->json('data.submission_id'), $second->json('data.submission_id'));
    }

    /** @test */
    public function start_allows_second_attempt_when_limit_is_two()
    {
        $examId = $this->publishSampleExam();
        $assignment = $this->assignToStudent($examId, 2);

        $first = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [
                'assignment_id' => $assignment->taId,
            ]);
        $sid = $first->json('data.submission_id');

        $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/submit", [
                'submission_id' => $sid,
                'answers' => ['q1' => 'C'],
                'final' => true,
            ])->assertStatus(200);

        $second = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [
                'assignment_id' => $assignment->taId,
            ]);

        $second->assertStatus(200);
        $this->assertFalse($second->json('data.resumed'));
        $this->assertEquals(2, Submission::find($second->json('data.submission_id'))->sAttempt);
        $this->assertDatabaseCount('submissions', 2);
    }

    /** @test */
    public function restart_is_rejected_when_no_spare_attempt_left()
    {
        $examId = $this->publishSampleExam();
        $assignment = $this->assignToStudent($examId, 1);

        $start = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [
                'assignment_id' => $assignment->taId,
            ]);
        $start->assertStatus(200);
        $sid = $start->json('data.submission_id');

        // Trước khi fix: restart hard-delete submission → bộ đếm lượt về 0 →
        // học viên đọc hết đề rồi làm lại vô hạn. Giờ phải bị từ chối.
        $restart = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [
                'assignment_id' => $assignment->taId,
                'restart' => true,
            ]);

        $restart->assertStatus(403);
        // Phiên đang làm PHẢI còn nguyên — không được huỷ rồi mới chặn.
        $this->assertEquals('in_progress', Submission::find($sid)->sStatus);
        $this->assertDatabaseCount('submissions', 1);
    }

    /** @test */
    public function restart_consumes_an_attempt_instead_of_resetting_the_counter()
    {
        $examId = $this->publishSampleExam();
        $assignment = $this->assignToStudent($examId, 2);

        $first = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [
                'assignment_id' => $assignment->taId,
            ]);
        $firstId = $first->json('data.submission_id');

        // Còn lượt dư → restart được. Phiên cũ bị void (KHÔNG xoá) nên vẫn đếm.
        $restart = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [
                'assignment_id' => $assignment->taId,
                'restart' => true,
            ]);
        $restart->assertStatus(200);

        $voided = Submission::find($firstId);
        $this->assertEquals('auto_submitted', $voided->sStatus);
        $this->assertEquals('restart', $voided->auto_submit_reason);
        $this->assertDatabaseCount('submissions', 2);

        // Đã tiêu 2/2 lượt → restart lần nữa bị chặn.
        $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [
                'assignment_id' => $assignment->taId,
                'restart' => true,
            ])->assertStatus(403);
    }

    /** @test */
    public function resume_is_scoped_to_the_requested_assignment()
    {
        $examId = $this->publishSampleExam();
        $assignmentA = $this->assignToStudent($examId, 1);
        $assignmentB = $this->assignToStudent($examId, 1);

        $startA = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [
                'assignment_id' => $assignmentA->taId,
            ]);
        $sidA = $startA->json('data.submission_id');

        // Mở assignment B: trước khi fix sẽ resume phiên của A (resume không lọc
        // assignment_id) → bài nộp ghi vào pool A, pool B vẫn 0 lượt.
        $startB = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [
                'assignment_id' => $assignmentB->taId,
            ]);

        $startB->assertStatus(200);
        $this->assertNotEquals($sidA, $startB->json('data.submission_id'));
        $this->assertEquals(
            $assignmentB->taId,
            Submission::find($startB->json('data.submission_id'))->assignment_id
        );
    }

    /** @test */
    public function start_ignores_an_assignment_belonging_to_another_student()
    {
        $examId = $this->publishSampleExam();
        $mine = $this->assignToStudent($examId, 1);

        $other = User::create([
            'uName' => 'Học viên khác',
            'uPhone' => '0900000123',
            'uPassword' => bcrypt('secret'),
            'uRole' => 'student',
            'age_group' => 'teens',
        ]);
        $foreign = TestAssignment::create([
            'exam_id' => $examId,
            'taTarget_type' => 'student',
            'taTarget_id' => $other->uId,
            'taDeadline' => now()->addDays(3),
            'taMax_attempt' => 5,
            'taCreated_at' => now(),
        ]);

        // Dùng hết lượt của assignment CỦA MÌNH.
        $start = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [
                'assignment_id' => $mine->taId,
            ]);
        $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/submit", [
                'submission_id' => $start->json('data.submission_id'),
                'answers' => ['q1' => 'C'],
                'final' => true,
            ])->assertStatus(200);

        // Mượn taId của học viên khác (max 5 lượt) để né giới hạn → phải bị bỏ
        // qua, rơi về assignment của mình và bị chặn.
        $borrowed = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [
                'assignment_id' => $foreign->taId,
            ]);

        $borrowed->assertStatus(403);
        $this->assertDatabaseCount('submissions', 1);
    }

    /** @test */
    public function start_requires_an_assignment()
    {
        // Đề đã publish nhưng CHƯA giao cho học viên này: đoán URL
        // /hoc-vien/lam-bai-thpt/{id} không được làm bài. Trước khi fix thì
        // được, và vì không có assignment nên cũng không có giới hạn lượt.
        $examId = $this->publishSampleExam(false);

        $response = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", []);

        $response->assertStatus(403);
        $this->assertEquals('assigned_only', $response->json('policy'));
        $this->assertDatabaseCount('submissions', 0);
    }

    /** @test */
    public function get_for_student_requires_an_assignment()
    {
        $examId = $this->publishSampleExam(false);

        $response = $this->withHeaders($this->studentHeader())
            ->getJson("/api/student/thpt-exams/{$examId}");

        $response->assertStatus(403);
        $this->assertEquals('assigned_only', $response->json('policy'));
    }

    /** @test */
    public function restart_after_the_deadline_is_blocked_but_keeps_the_session()
    {
        $examId = $this->publishSampleExam(false);
        // Còn hạn khi bắt đầu, hết hạn giữa lúc đang làm.
        $assignment = $this->assignToStudent($examId, 1, now()->addMinutes(5));

        $start = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", []);
        $start->assertStatus(200);
        $sid = $start->json('data.submission_id');
        // Assignment quá hạn vẫn phải được gắn vào submission, nếu không thì lượt
        // rơi vào nhóm assignment_id NULL và pool lượt mất hiệu lực.
        $this->assertEquals($assignment->taId, Submission::find($sid)->assignment_id);

        $assignment->taDeadline = now()->subMinute();
        $assignment->save();

        // Làm lại từ đầu = bắt đầu lượt mới → phải bị chặn sau hạn chót, và phiên
        // đang làm PHẢI còn nguyên để học viên nộp nốt.
        $restart = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [
                'restart' => true,
            ]);

        $restart->assertStatus(403);
        $this->assertEquals('in_progress', Submission::find($sid)->sStatus);
        $this->assertDatabaseCount('submissions', 1);
    }

    /** @test */
    public function autosave_does_not_grade()
    {
        $examId = $this->publishSampleExam();
        $start = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", []);
        $sid = $start->json('data.submission_id');

        $response = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/submit", [
                'submission_id' => $sid,
                'answers' => ['q1' => 'C'],
                'final' => false,
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.sStatus', 'in_progress');
        $this->assertNull(Submission::find($sid)->sScore);
    }

    /** @test */
    public function final_submit_grades_all_correct_as_full_marks()
    {
        $examId = $this->publishSampleExam();
        $start = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", []);
        $sid = $start->json('data.submission_id');

        $perfectAnswers = [
            'q1' => 'C',            // phonetics
            'q2' => 'B',            // mc
            'q3' => 'creative',     // word_form (text)
            'q4.s1' => true,        // tf
            'q4.s2' => false,       // tf
            'q5.1' => 'A', 'q5.2' => 'B', 'q5.3' => 'C', 'q5.4' => 'D', // matching
            'q6' => 'live',         // open cloze
        ];

        $response = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/submit", [
                'submission_id' => $sid,
                'answers' => $perfectAnswers,
                'final' => true,
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.sStatus', 'graded');

        $submission = Submission::find($sid);
        // Tổng 9 mục: q1,q2,q3,q4.s1,q4.s2,q5.1-4,q6 = 9 → max 9 → scale 10
        $this->assertEquals(10.0, (float) $submission->sScore);
    }

    /** @test */
    public function grading_handles_partial_and_synonym_answers()
    {
        $examId = $this->publishSampleExam();
        $start = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", []);
        $sid = $start->json('data.submission_id');

        // 5/9 đúng: q1 sai, q2 đúng, q3 đúng (case-insensitive), q4 đúng cả 2,
        // q5 chỉ 1 đúng (q5.1=A), q6 đúng bằng synonym 'stay'
        $answers = [
            'q1' => 'A',            // sai
            'q2' => 'B',            // đúng
            'q3' => 'CREATIVE',     // đúng (case-insensitive)
            'q4.s1' => true,        // đúng
            'q4.s2' => false,       // đúng
            'q5.1' => 'A',          // đúng
            'q5.2' => 'X',          // sai
            'q6' => 'stay',         // đúng (synonym)
        ];

        $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/submit", [
                'submission_id' => $sid,
                'answers' => $answers,
                'final' => true,
            ]);

        $resultRes = $this->withHeaders($this->studentHeader())
            ->getJson("/api/student/thpt-submissions/{$sid}/result");

        $resultRes->assertStatus(200);
        $result = $resultRes->json('data.result');

        // Đúng: q2,q3,q4.s1,q4.s2,q5.1,q6 = 6 / tổng 10 (q1 + q2 + q3 + q4.s1 + q4.s2 + q5.1-4 + q6)
        $this->assertEquals(6, $result['raw_score']);
        $this->assertEquals(10, $result['raw_score_max']);
        $this->assertEqualsWithDelta(round(6 / 10 * 10, 2), $result['scaled_score'], 0.01);
    }

    /** @test */
    public function result_contains_correct_answer_key_for_review()
    {
        $examId = $this->publishSampleExam();
        $start = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", []);
        $sid = $start->json('data.submission_id');

        $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/submit", [
                'submission_id' => $sid,
                'answers' => ['q1' => 'C'],
                'final' => true,
            ]);

        $resultRes = $this->withHeaders($this->studentHeader())
            ->getJson("/api/student/thpt-submissions/{$sid}/result");

        $correct = $resultRes->json('data.result.correct_answers');
        $this->assertEquals('C', $correct['q1']);
        $this->assertEquals('B', $correct['q2']);
        $this->assertTrue($correct['q4.s1']);
        $this->assertFalse($correct['q4.s2']);
        $this->assertEquals('A', $correct['q5.1']);

        // và config trả về cho review vẫn chứa đáp án (để hiển thị)
        $this->assertNotNull($resultRes->json('data.thpt_config'));
    }

    /** @test */
    public function student_cannot_get_result_before_grading()
    {
        $examId = $this->publishSampleExam();
        $start = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", []);
        $sid = $start->json('data.submission_id');

        $response = $this->withHeaders($this->studentHeader())
            ->getJson("/api/student/thpt-submissions/{$sid}/result");

        $response->assertStatus(400);
    }

    /** @test */
    public function student_cannot_access_another_students_result()
    {
        $examId = $this->publishSampleExam();
        $start = $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/start", []);
        $sid = $start->json('data.submission_id');
        $this->withHeaders($this->studentHeader())
            ->postJson("/api/student/thpt-exams/{$examId}/submit", [
                'submission_id' => $sid, 'answers' => ['q1' => 'C'], 'final' => true,
            ]);

        // student khác (dùng actingAs để tránh bug auth caching giữa các request)
        $other = User::factory()->create(['uRole' => 'student']);

        $this->assertNotEquals($this->student->uId, $other->uId);

        $response = $this->actingAs($other, 'sanctum')
            ->getJson("/api/student/thpt-submissions/{$sid}/result");

        $response->assertStatus(404);
    }

    /* ========================== VERSIONING ============================ */

    /** @test */
    public function updating_published_exam_writes_to_draft_not_live_config()
    {
        $examId = $this->publishSampleExam();
        $liveConfig = Exam::find($examId)->thpt_config;

        // Build draft mới khác với live: đổi title 1 statement
        $newConfig = $this->sampleConfig();
        $newConfig['sections'][0]['items'][0]['statements'][0]['text'] = 'Đã sửa cho version 2';

        $this->withHeaders($this->teacherHeader())
            ->putJson("/api/teacher/exams/{$examId}/thpt", [
                'eTitle' => 'Tên đã sửa',
                'thpt_config' => $newConfig,
            ])
            ->assertStatus(200)
            ->assertJsonPath('data.has_draft', true);

        $exam = Exam::find($examId);

        // Title vẫn được update (đổi title không liên quan grading)
        $this->assertEquals('Tên đã sửa', $exam->eTitle);

        // thpt_config GIỮ NGUYÊN — không bị đè
        $this->assertEquals($liveConfig, $exam->thpt_config);

        // thpt_draft_config có data mới
        $this->assertNotNull($exam->thpt_draft_config);
        $this->assertEquals(
            'Đã sửa cho version 2',
            $exam->thpt_draft_config['sections'][0]['items'][0]['statements'][0]['text']
        );
    }

    /** @test */
    public function publish_again_rotates_version_and_archives_old_config()
    {
        $examId = $this->publishSampleExam();

        // Version 1 đã set qua publishSampleExam? Helper chưa set version → set thủ công
        Exam::where('eId', $examId)->update(['thpt_version' => 1]);

        $newConfig = $this->sampleConfig();
        $newConfig['sections'][0]['items'][0]['statements'][0]['text'] = 'Statement v2';

        // Lưu draft
        $this->withHeaders($this->teacherHeader())
            ->putJson("/api/teacher/exams/{$examId}/thpt", [
                'thpt_config' => $newConfig,
            ])
            ->assertStatus(200);

        // Publish lại
        $response = $this->withHeaders($this->teacherHeader())
            ->postJson("/api/teacher/exams/{$examId}/thpt/publish", []);

        $response->assertStatus(200)
            ->assertJsonPath('data.live_version', 2)
            ->assertJsonPath('data.versions_count', 1);

        $exam = Exam::find($examId);

        $this->assertEquals(2, $exam->thpt_version);
        $this->assertNull($exam->thpt_draft_config);
        // Live config giờ là config mới
        $this->assertEquals(
            'Statement v2',
            $exam->thpt_config['sections'][0]['items'][0]['statements'][0]['text']
        );
        // Versions array có v1 cũ
        $this->assertCount(1, $exam->thpt_versions);
        $this->assertEquals(1, $exam->thpt_versions[0]['version']);
    }

    /** @test */
    public function student_starts_submission_snapshots_current_config()
    {
        $examId = $this->publishSampleExam();
        Exam::where('eId', $examId)->update(['thpt_version' => 1]);

        $response = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/thpt-exams/{$examId}/start", []);

        $response->assertStatus(200);
        $sid = $response->json('data.submission_id');
        $sub = Submission::find($sid);
        $payload = $sub->submission_payload;

        $this->assertArrayHasKey('exam_snapshot', $payload);
        $this->assertEquals(1, $payload['exam_snapshot']['version']);
        $this->assertNotNull($payload['exam_snapshot']['config']);

        // Verify snapshot lưu đúng: title của TF group section khớp
        $tfSection = $this->findSectionByType($payload['exam_snapshot']['config'], 'tf_group');
        $this->assertNotNull($tfSection);
        $this->assertEquals('TF', $tfSection['title']);
    }

    /** @test */
    public function grading_uses_submission_snapshot_not_live_config_after_republish()
    {
        $examId = $this->publishSampleExam();
        Exam::where('eId', $examId)->update(['thpt_version' => 1]);

        // Student start submission ở version 1
        $startRes = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/thpt-exams/{$examId}/start", []);
        $sid = $startRes->json('data.submission_id');

        // Teacher publish version 2 với đáp án TF flip ngược.
        $newConfig = $this->sampleConfig();
        foreach ($newConfig['sections'] as $sIdx => $sec) {
            if (($sec['type'] ?? '') !== 'tf_group') continue;
            foreach ($sec['items'] as $iIdx => $item) {
                foreach ($item['statements'] as $stIdx => $st) {
                    $newConfig['sections'][$sIdx]['items'][$iIdx]['statements'][$stIdx]['correct']
                        = !$st['correct'];
                }
            }
        }

        $this->actingAs($this->teacher, 'sanctum')
            ->putJson("/api/teacher/exams/{$examId}/thpt", ['thpt_config' => $newConfig])
            ->assertStatus(200);
        $this->actingAs($this->teacher, 'sanctum')
            ->postJson("/api/teacher/exams/{$examId}/thpt/publish", [])
            ->assertStatus(200);

        // Verify exam giờ đã ở version 2
        $exam = Exam::find($examId);
        $this->assertEquals(2, $exam->thpt_version);

        // Student final submit với đáp án TỪ VERSION 1 (đề snapshot trong submission)
        $snapshot = $this->sampleConfig();      // = version 1 config
        $answersFromV1 = $this->buildPerfectAnswers($snapshot);

        $finalRes = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/student/thpt-exams/{$examId}/submit", [
                'submission_id' => $sid,
                'answers' => $answersFromV1,
                'final' => true,
            ]);
        $finalRes->assertStatus(200);

        // Grade phải dùng snapshot v1 → student trả lời đúng v1 thì được full mark
        $sub = Submission::find($sid);
        $this->assertEquals('graded', $sub->sStatus);
        $this->assertEquals(10, (float) $sub->sScore);
    }

    /** @test */
    public function teacher_can_discard_draft_and_revert_to_live()
    {
        $examId = $this->publishSampleExam();
        Exam::where('eId', $examId)->update(['thpt_version' => 1]);

        // Save draft
        $newConfig = $this->sampleConfig();
        $newConfig['sections'][0]['items'][0]['statements'][0]['text'] = 'Bỏ tôi đi';
        $this->withHeaders($this->teacherHeader())
            ->putJson("/api/teacher/exams/{$examId}/thpt", ['thpt_config' => $newConfig]);

        $this->assertNotNull(Exam::find($examId)->thpt_draft_config);

        // Discard
        $this->withHeaders($this->teacherHeader())
            ->deleteJson("/api/teacher/exams/{$examId}/thpt/draft")
            ->assertStatus(200);

        $exam = Exam::find($examId);
        $this->assertNull($exam->thpt_draft_config);
        // Live config không đổi
        $this->assertEquals(1, $exam->thpt_version);
    }

    /** @test */
    public function get_draft_returns_draft_config_when_exists()
    {
        $examId = $this->publishSampleExam();

        $newConfig = $this->sampleConfig();
        $newConfig['sections'][0]['items'][0]['statements'][0]['text'] = 'Draft text';
        $this->withHeaders($this->teacherHeader())
            ->putJson("/api/teacher/exams/{$examId}/thpt", ['thpt_config' => $newConfig]);

        $response = $this->withHeaders($this->teacherHeader())
            ->getJson("/api/teacher/exams/{$examId}/thpt/draft");

        $response->assertStatus(200)
            ->assertJsonPath('data._is_owner', true)
            ->assertJsonPath('data._has_draft', true)
            ->assertJsonPath(
                'data.thpt_config.sections.0.items.0.statements.0.text',
                'Draft text'
            );
    }

    /** Helper: tìm section đầu tiên theo type. */
    private function findSectionByType(array $config, string $type): ?array
    {
        foreach ($config['sections'] ?? [] as $sec) {
            if (($sec['type'] ?? null) === $type) return $sec;
        }
        return null;
    }

    /**
     * Helper: build đáp án full điểm. Key format match đúng với gradeSubmission:
     *  - "q{n}"        cho single-answer (mc, phonetics, word_form, cloze)
     *  - "q{n}.s{idx}" cho tf_group statements (1-indexed)
     *  - "q{n}.{key}"  cho matching (key = '1','2','3','4')
     */
    private function buildPerfectAnswers(array $config): array
    {
        $answers = [];
        foreach ($config['sections'] ?? [] as $sec) {
            $type = $sec['type'] ?? null;
            switch ($type) {
                case 'phonetics':
                case 'mc_questions':
                case 'error_identification':
                case 'mc_cloze':
                    foreach ($sec['items'] ?? $sec['blanks'] ?? [] as $item) {
                        $qn = $item['question_number'] ?? '?';
                        $answers["q{$qn}"] = $item['correct_id'] ?? 'A';
                    }
                    break;
                case 'word_form':
                case 'sentence_transformation':
                case 'word_bank_cloze':
                case 'open_cloze':
                    $list = $sec['items'] ?? $sec['blanks'] ?? [];
                    foreach ($list as $item) {
                        $qn = $item['question_number'] ?? '?';
                        $answers["q{$qn}"] = $item['accepted_answers'][0] ?? '';
                    }
                    break;
                case 'tf_group':
                    foreach ($sec['items'] ?? [] as $item) {
                        $qn = $item['question_number'] ?? '?';
                        foreach ($item['statements'] ?? [] as $idx => $st) {
                            $answers["q{$qn}.s" . ($idx + 1)] = (bool) ($st['correct'] ?? false);
                        }
                    }
                    break;
                case 'matching':
                    foreach ($sec['items'] ?? [] as $item) {
                        $qn = $item['question_number'] ?? '?';
                        foreach (($item['answers'] ?? []) as $key => $letter) {
                            $answers["q{$qn}.{$key}"] = $letter;
                        }
                    }
                    break;
                case 'reading_mixed':
                    foreach ($sec['items'] ?? [] as $sub) {
                        $kind = $sub['kind'] ?? null;
                        $qn = $sub['question_number'] ?? '?';
                        if ($kind === 'tf_group') {
                            foreach ($sub['statements'] ?? [] as $idx => $st) {
                                $answers["q{$qn}.s" . ($idx + 1)] = (bool) ($st['correct'] ?? false);
                            }
                        } elseif ($kind === 'mc') {
                            $answers["q{$qn}"] = $sub['correct_id'] ?? 'A';
                        } elseif ($kind === 'sentence_insertion') {
                            $answers["q{$qn}"] = $sub['correct_marker'] ?? 'A';
                        }
                    }
                    break;
            }
        }
        return $answers;
    }
}

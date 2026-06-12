<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Exam;
use App\Models\Submission;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Feature tests cho trang chấm điểm giáo viên Teens THPT
 * (ThptGradingController + overlay teacher_* trong ThptExamController@getResult).
 *
 * THPT lưu toàn bộ chấm trong submission_payload + sGemini_feedback, KHÔNG dùng
 * bảng submission_answers. Tests seed sẵn payload (mirror những gì
 * GradeThptSpeakingJob sinh ra) thay vì chạy job thật.
 *
 * Bao phủ Correctness Properties 1–9 của design.md.
 */
class ThptGradingTest extends TestCase
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

    /* ============================================================
     |  Helpers — dựng đề + submission THPT realistic
     * ===========================================================*/

    /**
     * Config section-based: 1 phần khách quan (mc_questions) + 1 phần Nói.
     */
    private function thptConfig(bool $withSpeaking = true): array
    {
        $sections = [
            [
                'id' => 's_mc', 'type' => 'mc_questions', 'points_per_question' => 1,
                'title' => 'Grammar', 'instructions' => '',
                'items' => [
                    ['question_number' => 1, 'prompt' => 'She ___ here.', 'correct_id' => 'B', 'options' => [
                        ['id' => 'A', 'text' => 'live'], ['id' => 'B', 'text' => 'lives'],
                        ['id' => 'C', 'text' => 'living'], ['id' => 'D', 'text' => 'lived'],
                    ]],
                    ['question_number' => 2, 'prompt' => 'They ___ books.', 'correct_id' => 'A', 'options' => [
                        ['id' => 'A', 'text' => 'read'], ['id' => 'B', 'text' => 'reads'],
                        ['id' => 'C', 'text' => 'reading'], ['id' => 'D', 'text' => 'reader'],
                    ]],
                ],
            ],
        ];

        if ($withSpeaking) {
            $sections[] = [
                'id' => 's_speak', 'type' => 'speaking', 'title' => 'Speaking', 'instructions' => '',
                'items' => [
                    ['question_number' => 21, 'prompt' => 'Talk about your hometown.'],
                    ['question_number' => 22, 'prompt' => 'Describe your favourite hobby.'],
                ],
            ];
        }

        return [
            'version' => '2.0',
            'level' => 'THPT',
            'total_duration_minutes' => 60,
            'scale_max' => 10,
            'sections' => $sections,
        ];
    }

    /**
     * Tạo đề THPT đã publish thuộc về 1 giáo viên.
     */
    private function makeExam(?int $teacherId = null, bool $withSpeaking = true): Exam
    {
        return Exam::create([
            'eTitle' => 'Đề THPT số 3',
            'eType' => 'THPT',
            'eSkill' => 'reading',
            'eDuration_minutes' => 60,
            'eStatus' => 'published',
            'ePurpose' => 'exam',
            'eTeacher_id' => $teacherId ?? $this->teacher->uId,
            'age_group' => 'teens',
            'thpt_config' => $this->thptConfig($withSpeaking),
        ]);
    }

    /**
     * Dựng submission THPT đã chấm (mirror output GradeThptSpeakingJob).
     *
     * Options:
     *  - withSpeaking (bool, default true): đề có phần Nói.
     *  - aiParts (bool, default true): đã có node AI trong result.speaking.parts.
     *  - withAudio (bool, default true): có sGemini_feedback.speaking_audio.
     *  - status (string, default 'graded').
     *  - userId (int|null): chủ submission (default this->student).
     *
     * Điểm khách quan thuần = 8.0 (raw 8/10). AI Nói: q21=7.0, q22=6.0 → avg 6.5.
     * scaled_score (job blend) = (8.0 + 6.5) / 2 = 7.25.
     */
    private function makeSubmission(Exam $exam, array $opts = []): Submission
    {
        $withSpeaking = $opts['withSpeaking'] ?? true;
        $aiParts      = $opts['aiParts'] ?? true;
        $withAudio    = $opts['withAudio'] ?? true;
        $status       = $opts['status'] ?? 'graded';
        $userId       = $opts['userId'] ?? $this->student->uId;

        $config = $exam->thpt_config;

        // q1 đúng (B), q2 sai (chọn X)
        $answers = ['q1' => 'B', 'q2' => 'X'];
        $correctAnswers = ['q1' => 'B', 'q2' => 'A'];

        $resultSections = [
            [
                'section_id' => 's_mc', 'type' => 'mc_questions', 'title' => 'Grammar',
                'correct_count' => 1, 'total_count' => 2, 'raw_score' => 8, 'raw_max' => 10,
            ],
        ];

        $result = [
            'raw_score' => 8,
            'raw_score_max' => 10,
            'scale_max' => 10,
            'sections' => $resultSections,
            'correct_answers' => $correctAnswers,
            'scaled_score' => 8.0,
            'scaled_score_objective' => 8.0,
        ];

        $gemini = [];

        if ($withSpeaking) {
            if ($aiParts) {
                $parts = [
                    'q21' => [
                        'score' => 7.0,
                        'pronunciation_score' => 6.5,
                        'content_score' => 7.5,
                        'feedback' => 'Good attempt with clear ideas.',
                        'suggestions' => ['Speak more slowly', 'Use linking words'],
                        'transcript' => 'My hometown is a small town near the sea.',
                    ],
                    'q22' => [
                        'score' => 6.0,
                        'pronunciation_score' => 5.5,
                        'content_score' => 6.5,
                        'feedback' => 'Needs more detail and examples.',
                        'suggestions' => ['Add concrete examples'],
                        'transcript' => 'I like reading books in my free time.',
                    ],
                ];
                $aiAvg = 6.5; // (7.0 + 6.0) / 2
                $result['speaking'] = ['score' => $aiAvg, 'scale_max' => 10, 'parts' => $parts];
                $result['scaled_score'] = round((8.0 + $aiAvg) / 2, 2); // 7.25
            }

            if ($withAudio) {
                $gemini['speaking_audio'] = [
                    '21' => 'https://example.com/audio/q21.webm',
                    '22' => 'https://example.com/audio/q22.webm',
                ];
            }
        }

        return Submission::create([
            'user_id' => $userId,
            'exam_id' => $exam->eId,
            'sAttempt' => 1,
            'sStart_time' => now()->subMinutes(30),
            'sSubmit_time' => now()->subMinutes(5),
            'sGraded_time' => now()->subMinutes(5),
            'sScore' => $result['scaled_score'] ?? 8.0,
            'sStatus' => $status,
            'sGemini_feedback' => !empty($gemini) ? json_encode($gemini) : null,
            'submission_payload' => [
                'answers' => $answers,
                'exam_snapshot' => [
                    'version' => 1,
                    'snapshot_at' => now()->toIso8601String(),
                    'config' => $config,
                    'eDuration_minutes' => 60,
                ],
                'result' => $result,
            ],
        ]);
    }

    /** Lấy node parts['q{n}'] tươi từ DB. */
    private function freshPart(int $sid, string $key): ?array
    {
        $payload = Submission::find($sid)->submission_payload ?? [];
        return $payload['result']['speaking']['parts'][$key] ?? null;
    }

    /* ============================================================
     |  5.1 — show: chuẩn hoá & đồng bộ nguồn với học viên (Property 6)
     * ===========================================================*/

    /** @test */
    public function show_normalizes_speaking_questions_and_matches_student_source()
    {
        $exam = $this->makeExam();
        $sub  = $this->makeSubmission($exam);

        $res = $this->actingAs($this->teacher, 'sanctum')
            ->getJson("/api/teacher/thpt-submissions/{$sub->sId}/grading");

        $res->assertStatus(200);
        $res->assertJsonPath('status', 'success');
        $res->assertJsonPath('data.ai_speaking_pending', false);

        $questions = $res->json('data.subjective_questions');
        $this->assertCount(2, $questions);

        $q21 = collect($questions)->firstWhere('question_number', 21);
        $this->assertNotNull($q21);
        $this->assertSame('speaking', $q21['skill']);
        $this->assertSame('ai_graded', $q21['status']);
        $this->assertEquals(7.0, $q21['ai']['score']);
        $this->assertEquals(6.5, $q21['ai']['criteria']['pronunciation']);
        $this->assertEquals(7.5, $q21['ai']['criteria']['content']);
        $this->assertSame('Good attempt with clear ideas.', $q21['ai']['feedback']);
        $this->assertCount(2, $q21['ai']['suggestions']);
        $this->assertSame('My hometown is a small town near the sea.', $q21['ai']['transcript']);
        $this->assertStringContainsString('q21.webm', $q21['audio_url']);
        $this->assertNull($q21['teacher']);
        $this->assertSame('Talk about your hometown.', $q21['prompt']);

        // Property 6: ai.score == result.speaking.parts.q{n}.score (nguồn học viên dùng)
        $studentRes = $this->actingAs($this->student, 'sanctum')
            ->getJson("/api/student/thpt-submissions/{$sub->sId}/result");
        $studentRes->assertStatus(200);
        $studentPartScore = $studentRes->json('data.result.speaking.parts.q21.score');
        $this->assertEquals($q21['ai']['score'], $studentPartScore);
    }

    /* ============================================================
     |  5.2 — show: ai_pending & objective-only
     * ===========================================================*/

    /** @test */
    public function show_marks_ai_pending_when_audio_present_but_parts_empty()
    {
        $exam = $this->makeExam();
        // Có audio nhưng chưa có node AI trong parts (Job chưa chạy xong)
        $sub  = $this->makeSubmission($exam, ['aiParts' => false, 'withAudio' => true]);

        $res = $this->withHeaders($this->teacherHeader())
            ->getJson("/api/teacher/thpt-submissions/{$sub->sId}/grading");

        $res->assertStatus(200);
        $res->assertJsonPath('data.ai_speaking_pending', true);

        $q21 = collect($res->json('data.subjective_questions'))->firstWhere('question_number', 21);
        $this->assertSame('ai_pending', $q21['status']);
        $this->assertNull($q21['ai']);
        $this->assertStringContainsString('q21.webm', $q21['audio_url']);
    }

    /** @test */
    public function show_returns_empty_subjective_for_objective_only_exam()
    {
        $exam = $this->makeExam(null, false);                 // không có phần Nói
        $sub  = $this->makeSubmission($exam, ['withSpeaking' => false]);

        $res = $this->withHeaders($this->teacherHeader())
            ->getJson("/api/teacher/thpt-submissions/{$sub->sId}/grading");

        $res->assertStatus(200);
        $this->assertSame([], $res->json('data.subjective_questions'));
        $res->assertJsonPath('data.ai_speaking_pending', false);
    }

    /* ============================================================
     |  5.3 — save không ghi đè field AI (Property 1)
     * ===========================================================*/

    /** @test */
    public function save_does_not_overwrite_ai_fields()
    {
        $exam = $this->makeExam();
        $sub  = $this->makeSubmission($exam);

        $res = $this->withHeaders($this->teacherHeader())
            ->postJson("/api/teacher/thpt-submissions/{$sub->sId}/grading", [
                'questions' => [
                    ['question_number' => 21, 'teacher_score' => 8.5],
                ],
                'publish' => false,
            ]);

        $res->assertStatus(200);

        $node = $this->freshPart($sub->sId, 'q21');
        // Field AI giữ nguyên
        $this->assertEquals(7.0, $node['score']);
        $this->assertEquals(6.5, $node['pronunciation_score']);
        $this->assertEquals(7.5, $node['content_score']);
        $this->assertSame('Good attempt with clear ideas.', $node['feedback']);
        $this->assertSame('My hometown is a small town near the sea.', $node['transcript']);
        // teacher_score được ghi cạnh field AI
        $this->assertEquals(8.5, $node['teacher_score']);
        $this->assertEquals($this->teacher->uId, $node['teacher_reviewed_by']);
    }

    /* ============================================================
     |  5.4 — biên điểm 0–10 (Property 2)
     * ===========================================================*/

    /** @test */
    public function save_rejects_out_of_range_scores_without_db_write()
    {
        $exam = $this->makeExam();
        $sub  = $this->makeSubmission($exam);

        foreach ([11, -1] as $bad) {
            $res = $this->withHeaders($this->teacherHeader())
                ->postJson("/api/teacher/thpt-submissions/{$sub->sId}/grading", [
                    'questions' => [
                        ['question_number' => 21, 'teacher_score' => $bad],
                    ],
                    'publish' => false,
                ]);

            $res->assertStatus(422);

            // Không có teacher_score nào được ghi vào DB
            $node = $this->freshPart($sub->sId, 'q21');
            $this->assertArrayNotHasKey('teacher_score', $node);
        }
    }

    /* ============================================================
     |  5.5 — publish: recompute + status + teacher-preferred blend
     |        (Properties 3, 5, 7)
     * ===========================================================*/

    /** @test */
    public function publish_recomputes_total_prefers_teacher_and_sets_status()
    {
        $exam = $this->makeExam();
        $sub  = $this->makeSubmission($exam);

        // Override q21 lên 8.0 (AI = 7.0). q22 giữ AI = 6.0.
        // Effective speaking avg = (8.0 + 6.0) / 2 = 7.0
        // Blend cuối = (objective 8.0 + 7.0) / 2 = 7.5
        $res = $this->actingAs($this->teacher, 'sanctum')
            ->postJson("/api/teacher/thpt-submissions/{$sub->sId}/grading", [
                'questions' => [
                    ['question_number' => 21, 'teacher_score' => 8.0],
                ],
                'overall_teacher_feedback' => 'Bài làm tốt.',
                'publish' => true,
            ]);

        $res->assertStatus(200);
        $res->assertJsonPath('data.sStatus', 'graded');
        $this->assertEquals(7.5, $res->json('data.sScore'));
        $this->assertEquals(7.5, $res->json('data.scaled_score'));
        $this->assertEquals(7.0, $res->json('data.speaking_score'));

        $sub->refresh();
        $this->assertSame('graded', $sub->sStatus);
        $this->assertNotNull($sub->teacher_reviewed_at);
        $this->assertSame('Bài làm tốt.', $sub->sTeacher_feedback);
        $this->assertEquals(7.5, (float) $sub->sScore);

        // Property 5: sScore == result.scaled_score == blend(objective, eff speaking avg)
        $payload = $sub->submission_payload;
        $this->assertEquals(7.5, (float) $payload['result']['scaled_score']);
        $this->assertEquals((float) $sub->sScore, (float) $payload['result']['scaled_score']);
        // Property 7 / 3: q22 (chưa override) vẫn dùng AI score cho effective
        $this->assertEquals(7.0, (float) $payload['result']['speaking']['score']);
        // teacher_score q21 ưu tiên hơn AI
        $this->assertEquals(8.0, $payload['result']['speaking']['parts']['q21']['teacher_score']);
        $this->assertEquals(7.0, $payload['result']['speaking']['parts']['q21']['score']);
    }

    /* ============================================================
     |  5.6 — getResult overlay teacher_* (Property 4)
     * ===========================================================*/

    /** @test */
    public function student_result_overlays_teacher_score_and_feedback_after_publish()
    {
        $exam = $this->makeExam();
        $sub  = $this->makeSubmission($exam);

        $this->actingAs($this->teacher, 'sanctum')
            ->postJson("/api/teacher/thpt-submissions/{$sub->sId}/grading", [
                'questions' => [
                    [
                        'question_number' => 21,
                        'teacher_score' => 9.0,
                        'teacher_criteria' => ['pronunciation' => 8.0, 'content' => 9.5],
                        'teacher_feedback' => 'Phát âm tốt, nội dung phong phú.',
                    ],
                ],
                'publish' => true,
            ])
            ->assertStatus(200);

        $studentRes = $this->actingAs($this->student, 'sanctum')
            ->getJson("/api/student/thpt-submissions/{$sub->sId}/result");

        $studentRes->assertStatus(200);
        $q21 = $studentRes->json('data.result.speaking.parts.q21');

        // Property 4: học viên thấy điểm/nhận xét giáo viên
        $this->assertEquals(9.0, $q21['score']);
        $this->assertSame('Phát âm tốt, nội dung phong phú.', $q21['feedback']);
        $this->assertEquals(8.0, $q21['pronunciation_score']);
        $this->assertEquals(9.5, $q21['content_score']);
        $this->assertSame('teacher', $q21['graded_by']);
        // Field AI gốc trong DB vẫn nguyên (overlay chỉ lúc đọc)
        $this->assertEquals(7.0, $this->freshPart($sub->sId, 'q21')['score']);
    }

    /* ============================================================
     |  5.7 — quyền truy cập (Property 8)
     * ===========================================================*/

    /** @test */
    public function access_control_rejects_non_owner_unauth_and_student()
    {
        $exam = $this->makeExam();                            // owner = this->teacher
        $sub  = $this->makeSubmission($exam);

        $before = Submission::find($sub->sId)->submission_payload;

        // 1) Chưa đăng nhập → 401 (thực hiện TRƯỚC khi set bất kỳ auth nào)
        $this->getJson("/api/teacher/thpt-submissions/{$sub->sId}/grading")
            ->assertStatus(401);

        // 2) Giáo viên khác (không phải chủ đề) → 403
        $otherTeacher = User::factory()->create(['uRole' => 'teacher']);

        $this->actingAs($otherTeacher, 'sanctum')
            ->getJson("/api/teacher/thpt-submissions/{$sub->sId}/grading")
            ->assertStatus(403);

        $this->actingAs($otherTeacher, 'sanctum')
            ->postJson("/api/teacher/thpt-submissions/{$sub->sId}/grading", [
                'questions' => [['question_number' => 21, 'teacher_score' => 5.0]],
                'publish' => true,
            ])
            ->assertStatus(403);

        // 3) Học viên gọi endpoint giáo viên → 401/403
        $studentResp = $this->actingAs($this->student, 'sanctum')
            ->getJson("/api/teacher/thpt-submissions/{$sub->sId}/grading");
        $this->assertContains($studentResp->status(), [401, 403]);

        // DB không đổi sau các yêu cầu bị từ chối
        $after = Submission::find($sub->sId)->submission_payload;
        $this->assertEquals($before, $after);
        $this->assertSame('graded', Submission::find($sub->sId)->sStatus);
    }

    /* ============================================================
     |  5.8 — draft save (publish=false) giữ nguyên sStatus (Property 9)
     * ===========================================================*/

    /** @test */
    public function draft_save_persists_overrides_without_changing_status()
    {
        $exam = $this->makeExam();
        $sub  = $this->makeSubmission($exam);

        $statusBefore = $sub->sStatus;
        $this->assertNull($sub->teacher_reviewed_at);

        $res = $this->withHeaders($this->teacherHeader())
            ->postJson("/api/teacher/thpt-submissions/{$sub->sId}/grading", [
                'questions' => [
                    ['question_number' => 21, 'teacher_score' => 8.0],
                ],
                'overall_teacher_feedback' => 'Nháp tạm.',
                'publish' => false,
            ]);

        $res->assertStatus(200);

        $sub->refresh();
        // sStatus không đổi, teacher_reviewed_at vẫn null (chưa phát hành)
        $this->assertSame($statusBefore, $sub->sStatus);
        $this->assertNull($sub->teacher_reviewed_at);
        // teacher_* + nhận xét tổng quát vẫn được lưu
        $this->assertEquals(8.0, $this->freshPart($sub->sId, 'q21')['teacher_score']);
        $this->assertSame('Nháp tạm.', $sub->sTeacher_feedback);
    }
}

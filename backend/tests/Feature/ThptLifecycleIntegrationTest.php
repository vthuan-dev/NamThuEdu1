<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * INTEGRATION — đi hết vòng đời một đề THPT qua ĐÚNG các API mà web thật gọi.
 *
 * Khác với ThptExamTest (dựng Exam/TestAssignment bằng factory rồi test từng
 * endpoint riêng lẻ), test này KHÔNG chạm DB để dựng dữ liệu nghiệp vụ. Mọi bước
 * đều qua HTTP:
 *
 *   GV tạo lớp → thêm học viên → tạo nháp đề → lưu nội dung → publish
 *      → giao bài → HV thấy bài → bắt đầu → nộp → xem điểm
 *      → GV thấy bài trong danh sách chấm → chấm → HV thấy điểm đã chấm
 *
 * Lý do cần: các lỗi nghiêm trọng nhất tìm được trong dự án này đều nằm ở CHỖ NỐI
 * giữa hai bước (giao bài xong nhưng học viên không thấy; chấm xong nhưng danh sách
 * không trả về; publish xong nhưng đáp án trỏ vào ô rỗng). Test từng endpoint riêng
 * lẻ không bắt được loại đó.
 */
class ThptLifecycleIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private $teacher;
    private $teacherToken;
    private $student;
    private $studentToken;

    protected function setUp(): void
    {
        parent::setUp();

        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
        $this->teacherToken = $this->teacher->createToken('t')->plainTextToken;

        $this->student = User::factory()->create([
            'uRole' => 'student',
            'age_group' => 'teens',
        ]);
        $this->studentToken = $this->student->createToken('t')->plainTextToken;
    }

    /**
     * Header của giáo viên.
     *
     * `forgetGuards()` là BẮT BUỘC ở đây. Cả test chạy trong MỘT tiến trình, nên
     * sau request đầu tiên guard đã giữ lại user vừa xác thực và request sau dù gửi
     * token khác vẫn được coi là user cũ → middleware `role:` trả 403 gây hiểu nhầm
     * là lỗi phân quyền. Web thật không gặp vì mỗi request là một tiến trình riêng.
     */
    private function asTeacher(): array
    {
        $this->app['auth']->forgetGuards();

        return ['Authorization' => 'Bearer ' . $this->teacherToken];
    }

    /** Xem giải thích `forgetGuards()` ở asTeacher(). */
    private function asStudent(): array
    {
        $this->app['auth']->forgetGuards();

        return ['Authorization' => 'Bearer ' . $this->studentToken];
    }

    /**
     * Config nhỏ nhưng đủ 3 dạng chấm khác nhau: chọn 1 đáp án, nhập chữ, và
     * mệnh đề Đúng/Sai (dạng có khoá theo vị trí `.s{i}`).
     */
    private function config(): array
    {
        return [
            'version' => '2.0',
            'level' => 'THPT',
            'total_duration_minutes' => 30,
            'scale_max' => 10,
            'sections' => [
                [
                    'id' => 's_mc', 'type' => 'mc_questions', 'points_per_question' => 1,
                    'title' => 'Grammar', 'instructions' => '',
                    'items' => [
                        ['question_number' => 1, 'prompt' => 'She ___ here.', 'correct_id' => 'B', 'options' => [
                            ['id' => 'A', 'text' => 'live'],
                            ['id' => 'B', 'text' => 'lives'],
                            ['id' => 'C', 'text' => 'living'],
                            ['id' => 'D', 'text' => 'lived'],
                        ]],
                    ],
                ],
                [
                    'id' => 's_wf', 'type' => 'word_form', 'points_per_question' => 1,
                    'title' => 'Word form', 'instructions' => '',
                    'items' => [
                        ['question_number' => 2, 'sentence' => 'She is ___', 'root_word' => 'CREATE',
                         'accepted_answers' => ['creative'], 'case_sensitive' => false],
                    ],
                ],
                [
                    'id' => 's_tf', 'type' => 'tf_group', 'points_per_question' => 1,
                    'title' => 'True/False', 'instructions' => '',
                    'items' => [
                        ['question_number' => 3, 'context' => 'A notice', 'context_style' => 'notice',
                         'statements' => [
                             ['id' => '3-1', 'text' => 'First claim', 'correct' => true],
                             ['id' => '3-2', 'text' => 'Second claim', 'correct' => false],
                         ]],
                    ],
                ],
            ],
        ];
    }

    /**
     * @test
     * Vòng đời đầy đủ, mọi bước qua API thật. Đây là test quan trọng nhất của file.
     */
    public function a_thpt_exam_goes_from_draft_to_graded_result_entirely_through_the_api(): void
    {
        /* 1. GV tạo lớp qua API và thêm học viên vào lớp ------------------- */

        $classRes = $this->withHeaders($this->asTeacher())
            ->postJson('/api/teacher/classes', [
                'name' => 'Teens A1',
                'description' => 'Integration',
                'age_group' => 'teens',
                'max_students' => 20,
            ]);
        $classRes->assertStatus(201);
        $classId = $classRes->json('data.cId') ?? $classRes->json('data.id');
        $this->assertNotNull($classId, 'store() phải trả về id của lớp vừa tạo.');

        $this->withHeaders($this->asTeacher())
            ->postJson("/api/teacher/classes/{$classId}/enroll", [
                'student_ids' => [$this->student->uId],
            ])
            ->assertStatus(200);

        // users.class_id là nguồn dữ liệu chính — xác nhận ghi danh có hiệu lực thật.
        $this->assertEquals($classId, (int) $this->student->fresh()->class_id);

        /* 2. GV tạo nháp đề, lưu nội dung, publish ------------------------- */

        $draftRes = $this->withHeaders($this->asTeacher())
            ->postJson('/api/teacher/exams/thpt', [
                'eTitle' => 'THPT Integration',
                'age_group' => 'teens',
            ]);
        $draftRes->assertStatus(200);
        $examId = $draftRes->json('data.eId');
        $this->assertNotNull($examId);

        $this->withHeaders($this->asTeacher())
            ->putJson("/api/teacher/exams/{$examId}/thpt", ['thpt_config' => $this->config()])
            ->assertStatus(200);

        $this->withHeaders($this->asTeacher())
            ->postJson("/api/teacher/exams/{$examId}/thpt/publish")
            ->assertStatus(200);

        /* 3. GV giao bài cho LỚP ------------------------------------------ */

        $assignRes = $this->withHeaders($this->asTeacher())
            ->postJson("/api/teacher/exams/{$examId}/assign", [
                'taTarget_type' => 'class',
                'taTarget_id' => $classId,
                'taMax_attempt' => 1,
            ]);
        $assignRes->assertStatus(200);

        /* 4. HV mở được đề (assigned_only phải cho qua) -------------------- */

        $this->withHeaders($this->asStudent())
            ->getJson("/api/student/thpt-exams/{$examId}")
            ->assertStatus(200);

        /* 5. HV bắt đầu làm bài ------------------------------------------- */

        $startRes = $this->withHeaders($this->asStudent())
            ->postJson("/api/student/thpt-exams/{$examId}/start", []);
        $startRes->assertStatus(200);
        $submissionId = $startRes->json('data.submission_id');
        $this->assertNotNull($submissionId);

        /* 6. HV nộp: câu 1 đúng, câu 2 sai, câu 3 đúng 1 nửa -------------- */

        // `final => true` là bắt buỘc: không có cờ này thì endpoint chỉ LƯU NHÁP
        // (bài vẫn `in_progress`, chưa chấm, chưa tính là đã nộp).
        $this->withHeaders($this->asStudent())
            ->postJson("/api/student/thpt-exams/{$examId}/submit", [
                'submission_id' => $submissionId,
                'final' => true,
                'answers' => [
                    'q1' => 'B',            // đúng
                    'q2' => 'creator',      // sai (accepted: creative)
                    'q3.s1' => true,        // đúng
                    'q3.s2' => true,        // sai (correct = false)
                ],
            ])
            ->assertStatus(200);

        /* 7. HV xem kết quả ---------------------------------------------- */

        $resultRes = $this->withHeaders($this->asStudent())
            ->getJson("/api/student/thpt-submissions/{$submissionId}/result");
        $resultRes->assertStatus(200);

        // Điểm nằm trong `data.result`, không phải ngay dưới `data`.
        // 4 ô đáp án: q1, q2, q3.s1, q3.s2 → tối đa 4, đúng 2 (q1 và q3.s1).
        $this->assertEquals(4, $resultRes->json('data.result.raw_score_max'));
        $this->assertEquals(2, $resultRes->json('data.result.raw_score'));

        /* 8. Bài phải XUẤT HIỆN trong danh sách chấm của GV ---------------- */

        $listRes = $this->withHeaders($this->asTeacher())
            ->getJson('/api/teacher/submissions');
        $listRes->assertStatus(200);

        $ids = collect($listRes->json('data') ?? [])
            ->pluck('sId')
            ->map(function ($v) { return (int) $v; })
            ->all();

        // Đây chính là lớp lỗi đã sửa ở d17b3c1: GV có quyền chấm nhưng query danh
        // sách không trả về, nên bài "biến mất" khỏi màn hình chấm.
        $this->assertContains(
            (int) $submissionId,
            $ids,
            'Bài của học viên trong lớp GV quản lý PHẢI có trong danh sách chấm.'
        );

        /* 9. GV mở màn hình chấm THPT và ghi điểm ------------------------- */

        $this->withHeaders($this->asTeacher())
            ->getJson("/api/teacher/thpt-submissions/{$submissionId}/grading")
            ->assertStatus(200);

        $this->withHeaders($this->asTeacher())
            ->postJson("/api/teacher/thpt-submissions/{$submissionId}/grading", [
                'teacher_override_score' => 8.5,
                'overall_teacher_feedback' => 'Khá tốt.',
                'publish' => true,
            ])
            ->assertStatus(200);

        /* 10. HV thấy điểm GV đã chấm ------------------------------------ */

        $finalRes = $this->withHeaders($this->asStudent())
            ->getJson("/api/student/thpt-submissions/{$submissionId}/result");
        $finalRes->assertStatus(200);

        $this->assertEquals('graded', Submission::find($submissionId)->sStatus);
        $this->assertEquals(8.5, (float) Submission::find($submissionId)->sScore);
    }

    /**
     * @test
     * HỒI QUY: điểm giáo viên tự nhập không được biến mất khi học viên xem kết quả.
     *
     * Lỗi gốc: `getResult()` luôn chấm lại phần khách quan rồi `save()`. Với đề toàn
     * trắc nghiệm, nhánh đó gán `sScore = điểm máy` nên chỉ cần học viên mở trang
     * kết quả là điểm giáo viên bị ghi đè NGAY TRONG DB. Không có SoftDeletes nên
     * điểm cũ không lấy lại được.
     *
     * Test này cố tình cho học viên làm SAI (điểm máy = 0) rồi giáo viên chấm 9.0,
     * sau đó đọc kết quả HAI LẦN — lỗi cũ sẽ làm điểm rơi về 0 ngay lần đầu.
     */
    public function a_teacher_override_score_survives_the_student_reading_the_result(): void
    {
        [, $submissionId] = $this->publishAssignAndStart(1);

        $this->withHeaders($this->asStudent())
            ->postJson('/api/student/thpt-exams/' . Submission::find($submissionId)->exam_id . '/submit', [
                'submission_id' => $submissionId,
                'final' => true,
                'answers' => ['q1' => 'A'],   // sai → điểm máy 0
            ])
            ->assertStatus(200);

        $this->assertEquals(0.0, (float) Submission::find($submissionId)->sScore);

        $this->withHeaders($this->asTeacher())
            ->postJson("/api/teacher/thpt-submissions/{$submissionId}/grading", [
                'teacher_override_score' => 9.0,
                'publish' => true,
            ])
            ->assertStatus(200);

        $this->assertEquals(9.0, (float) Submission::find($submissionId)->sScore);

        // Học viên xem kết quả — đây là hành động đã xoá điểm giáo viên.
        $read1 = $this->withHeaders($this->asStudent())
            ->getJson("/api/student/thpt-submissions/{$submissionId}/result");
        $read1->assertStatus(200);

        $this->assertEquals(
            9.0,
            (float) Submission::find($submissionId)->sScore,
            'Điểm giáo viên PHẢI còn nguyên trong DB sau khi học viên xem kết quả.'
        );
        $this->assertEquals(9.0, (float) $read1->json('data.result.scaled_score'));

        // Đọc lần hai: phải ổn định, không trôi dần về điểm máy.
        $read2 = $this->withHeaders($this->asStudent())
            ->getJson("/api/student/thpt-submissions/{$submissionId}/result");
        $this->assertEquals(9.0, (float) $read2->json('data.result.scaled_score'));
        $this->assertEquals(9.0, (float) Submission::find($submissionId)->sScore);

        // Điểm máy vẫn phải truy được để màn hình chấm so sánh.
        $this->assertEquals(0.0, (float) $read2->json('data.result.scaled_score_objective'));
    }

    /**
     * @test
     * Hết lượt thì không vào lại được — kiểm qua API thật thay vì gọi hàm nội bộ.
     */
    public function a_student_cannot_start_a_second_attempt_when_the_limit_is_one(): void
    {
        [$examId, $submissionId] = $this->publishAssignAndStart(1);

        $this->withHeaders($this->asStudent())
            ->postJson("/api/student/thpt-exams/{$examId}/submit", [
                'submission_id' => $submissionId,
                'final' => true,
                'answers' => ['q1' => 'B'],
            ])
            ->assertStatus(200);

        $this->withHeaders($this->asStudent())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [])
            ->assertStatus(403);
    }

    /**
     * @test
     * Học viên KHÔNG được giao đề thì không mở và không thi được, dù đề đã publish.
     * Đây là quyết định nghiệp vụ đã chốt: chỉ học viên được giao mới xem và thi.
     */
    public function an_unassigned_student_can_neither_open_nor_start_a_published_exam(): void
    {
        $examId = $this->publishExam();

        $this->withHeaders($this->asStudent())
            ->getJson("/api/student/thpt-exams/{$examId}")
            ->assertStatus(403);

        $this->withHeaders($this->asStudent())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [])
            ->assertStatus(403);
    }

    /**
     * @test
     * Chưa tới giờ mở thì chưa được thi, dù đã được giao.
     */
    public function a_student_cannot_start_before_the_scheduled_open_time(): void
    {
        $examId = $this->publishExam();

        $this->withHeaders($this->asTeacher())
            ->postJson("/api/teacher/exams/{$examId}/assign", [
                'taTarget_type' => 'student',
                'taTarget_id' => $this->student->uId,
                'taStart_time' => now()->addDay()->toIso8601String(),
                'taMax_attempt' => 1,
            ])
            ->assertStatus(200);

        $this->withHeaders($this->asStudent())
            ->postJson("/api/student/thpt-exams/{$examId}/start", [])
            ->assertStatus(403);
    }

    /**
     * @test
     * Giáo viên KHÔNG quản lý lớp của học viên thì không được mở bài chấm.
     */
    public function a_teacher_from_another_class_cannot_open_the_grading_screen(): void
    {
        [, $submissionId] = $this->publishAssignAndStart(1);

        $outsider = User::factory()->create(['uRole' => 'teacher']);
        $outsiderToken = $outsider->createToken('t')->plainTextToken;

        $this->app['auth']->forgetGuards();
        $this->withHeaders(['Authorization' => 'Bearer ' . $outsiderToken])
            ->getJson("/api/teacher/thpt-submissions/{$submissionId}/grading")
            ->assertStatus(403);
    }

    /**
     * @test
     * Không cho giao đề còn nháp: học viên sẽ thấy bài nhưng không mở được đề.
     */
    public function an_unpublished_exam_cannot_be_assigned(): void
    {
        $draftRes = $this->withHeaders($this->asTeacher())
            ->postJson('/api/teacher/exams/thpt', ['eTitle' => 'Still a draft']);
        $examId = $draftRes->json('data.eId');

        $this->withHeaders($this->asTeacher())
            ->postJson("/api/teacher/exams/{$examId}/assign", [
                'taTarget_type' => 'student',
                'taTarget_id' => $this->student->uId,
            ])
            ->assertStatus(422);
    }

    /* ----------------------------- helpers ----------------------------- */

    private function publishExam(): int
    {
        $draftRes = $this->withHeaders($this->asTeacher())
            ->postJson('/api/teacher/exams/thpt', [
                'eTitle' => 'THPT ' . uniqid(),
                'age_group' => 'teens',
            ]);
        $examId = $draftRes->json('data.eId');

        $this->withHeaders($this->asTeacher())
            ->putJson("/api/teacher/exams/{$examId}/thpt", ['thpt_config' => $this->config()])
            ->assertStatus(200);

        $this->withHeaders($this->asTeacher())
            ->postJson("/api/teacher/exams/{$examId}/thpt/publish")
            ->assertStatus(200);

        return (int) $examId;
    }

    /**
     * Publish → giao cho chính học viên → bắt đầu. Trả [examId, submissionId].
     */
    private function publishAssignAndStart(int $maxAttempt): array
    {
        $examId = $this->publishExam();

        // Gán học viên vào một lớp của GV để quyền chấm có hiệu lực.
        $class = Classes::factory()->create([
            'cTeacher_id' => $this->teacher->uId,
            'age_group' => 'teens',
        ]);
        $this->student->class_id = $class->cId;
        $this->student->save();

        $this->withHeaders($this->asTeacher())
            ->postJson("/api/teacher/exams/{$examId}/assign", [
                'taTarget_type' => 'student',
                'taTarget_id' => $this->student->uId,
                'taMax_attempt' => $maxAttempt,
            ])
            ->assertStatus(200);

        $startRes = $this->withHeaders($this->asStudent())
            ->postJson("/api/student/thpt-exams/{$examId}/start", []);
        $startRes->assertStatus(200);

        return [$examId, $startRes->json('data.submission_id')];
    }
}

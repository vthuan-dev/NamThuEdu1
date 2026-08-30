<?php

namespace Tests\Feature;

use App\Models\Classes;
use App\Models\Exam;
use App\Models\Submission;
use App\Models\TestAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Vì sao học viên nộp bài mà giáo viên không thấy trong /giao-vien/cham-diem.
 *
 * GradingController::applyTeacherSubmissionAccess chỉ cho giáo viên thấy bài nộp
 * qua 4 nhánh, mà cả 4 đều dựa vào một trong hai thứ: giáo viên SỞ HỮU đề
 * (exams.eTeacher_id), hoặc học viên THUỘC LỚP giáo viên quản lý (users.class_id).
 *
 * Không có nhánh nào dựa vào "ai là người giao đề" — bảng test_assignments không
 * lưu người giao (cột taTeacher_id có trong schema nhưng không chỗ nào ghi vào).
 */
class TeacherSeesSubmissionTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $assigner;
    private User $student;

    protected function setUp(): void
    {
        parent::setUp();

        // Giáo viên tạo đề, đề nằm trong ngân hàng dùng chung.
        $this->owner = User::factory()->create(['uRole' => 'teacher', 'uName' => 'GV tạo đề']);
        // Giáo viên khác, người thực sự giao đề cho học viên.
        $this->assigner = User::factory()->create(['uRole' => 'teacher', 'uName' => 'GV giao đề']);
        // Học viên do giáo viên tạo qua form Thêm học viên — storeStudent KHÔNG gán
        // class_id (xem UserController L584-585 "Class system đã deprecated").
        $this->student = User::factory()->create([
            'uRole' => 'student',
            'age_group' => 'teens',
            'class_id' => null,
        ]);
    }

    private function makeExam(User $owner): Exam
    {
        return Exam::create([
            'eTitle' => 'HSG-GRAMMAR-U123',
            'eType' => 'THPT',
            'eSkill' => 'reading',
            'eDuration_minutes' => 37,
            'eStatus' => 'published',
            'eTeacher_id' => $owner->uId,
            'age_group' => 'teens',
        ]);
    }

    private function submitFor(Exam $exam, ?TestAssignment $assignment): Submission
    {
        return Submission::create([
            'user_id' => $this->student->uId,
            'exam_id' => $exam->eId,
            'assignment_id' => $assignment ? $assignment->taId : null,
            'sAttempt' => 1,
            'sStatus' => 'graded',
            'sScore' => 5,
            'sSubmit_time' => now(),
        ]);
    }

    private function assign(Exam $exam, ?User $assigner = null): TestAssignment
    {
        return TestAssignment::create([
            'exam_id' => $exam->eId,
            'taTeacher_id' => $assigner ? $assigner->uId : null,
            'taTarget_type' => 'student',
            'taTarget_id' => $this->student->uId,
            'taMax_attempt' => 1,
            'taCreated_at' => now(),
        ]);
    }

    private function queueFor(User $teacher, string $source = 'assigned'): array
    {
        $res = $this->actingAs($teacher, 'sanctum')
            ->getJson('/api/teacher/submissions?source=' . $source);

        $res->assertStatus(200);

        return $res->json('data');
    }

    /** Mốc so sánh: giáo viên chủ đề luôn thấy bài, kể cả khi học viên không có lớp. */
    public function test_exam_owner_sees_the_submission(): void
    {
        $exam = $this->makeExam($this->owner);
        $this->submitFor($exam, $this->assign($exam));

        $this->assertCount(1, $this->queueFor($this->owner));
    }

    /**
     * ĐÂY LÀ LỖI ĐÃ SỬA. Giáo viên giao đề từ ngân hàng dùng chung cho học viên
     * không có lớp: đề không phải của họ (nhánh 1 sai), học viên không có lớp
     * (nhánh 2/3/4 tắt). Chỉ nhánh 5 — "assignment do chính tôi giao" — cứu được.
     */
    public function test_assigner_sees_submission_even_when_exam_is_not_theirs_and_student_has_no_class(): void
    {
        $exam = $this->makeExam($this->owner);
        $this->submitFor($exam, $this->assign($exam, $this->assigner));

        $this->assertCount(1, $this->queueFor($this->assigner));
    }

    /**
     * Ranh giới quyền: nhánh 5 chỉ mở cho ĐÚNG người đã giao, không mở cho mọi
     * giáo viên. Giáo viên thứ ba không liên quan vẫn không thấy gì.
     */
    public function test_an_unrelated_teacher_still_sees_nothing(): void
    {
        $stranger = User::factory()->create(['uRole' => 'teacher', 'uName' => 'GV khac']);

        $exam = $this->makeExam($this->owner);
        $this->submitFor($exam, $this->assign($exam, $this->assigner));

        $this->assertCount(0, $this->queueFor($stranger));
    }

    /**
     * Assignment tạo TRƯỚC thay đổi này có taTeacher_id NULL nên nhánh 5 không cứu
     * được. Test này ghi lại giới hạn đó tường minh để không ai tưởng dữ liệu cũ
     * cũng đã được vá.
     */
    public function test_legacy_assignment_without_assigner_remains_invisible(): void
    {
        $exam = $this->makeExam($this->owner);
        $this->submitFor($exam, $this->assign($exam, null));

        $this->assertCount(0, $this->queueFor($this->assigner));
    }

    /** Cùng kịch bản nhưng học viên có lớp của giáo viên đó → thấy bình thường. */
    public function test_assigner_sees_submission_once_student_belongs_to_their_class(): void
    {
        $class = Classes::create([
            'cName' => 'Teens 1',
            'cTeacher_id' => $this->assigner->uId,
            'age_group' => 'teens',
        ]);
        $this->student->class_id = $class->cId;
        $this->student->save();

        $exam = $this->makeExam($this->owner);
        $this->submitFor($exam, $this->assign($exam));

        $this->assertCount(1, $this->queueFor($this->assigner));
    }

    /**
     * Nguyên nhân thứ hai, nhẹ hơn: bài nộp không có assignment_id vẫn thấy được
     * nhưng nằm ở tab "Tự luyện", nên giáo viên nhìn tab "Đề đã giao" thì tưởng mất.
     */
    public function test_submission_without_assignment_lands_in_the_practice_tab(): void
    {
        $exam = $this->makeExam($this->owner);
        $this->submitFor($exam, null);

        $this->assertCount(0, $this->queueFor($this->owner, 'assigned'));
        $this->assertCount(1, $this->queueFor($this->owner, 'practice'));
    }

    /** Người giao đề giờ được ghi lại — căn cứ của nhánh 5. */
    public function test_assignment_records_who_created_it(): void
    {
        $exam = $this->makeExam($this->owner);
        $assignment = $this->assign($exam, $this->assigner);

        $fresh = TestAssignment::where('taId', $assignment->taId)->first();

        $this->assertSame((int) $this->assigner->uId, (int) $fresh->taTeacher_id);
    }
}

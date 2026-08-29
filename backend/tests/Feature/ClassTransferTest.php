<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Classes;
use App\Models\ClassEnrollment;
use App\Models\ClassTransfer;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Chuyển lớp học viên.
 *
 * Trước đây tính năng này KHÔNG BAO GIỜ chạy được: ClassTransfer::create() truyền
 * 'teacher_id' nhưng $fillable của model không có khoá đó → Eloquent lọc bỏ → cột
 * NOT NULL không default → SQLSTATE 1364 → 500.
 */
class ClassTransferTest extends TestCase
{
    use RefreshDatabase;

    protected $teacher;
    protected $student;
    protected $fromClass;
    protected $toClass;

    protected function setUp(): void
    {
        parent::setUp();

        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
        $this->fromClass = Classes::factory()->create([
            'cTeacher_id' => $this->teacher->uId,
        ]);
        $this->toClass = Classes::factory()->create([
            'cTeacher_id' => $this->teacher->uId,
        ]);
        $this->student = User::factory()->create([
            'uRole' => 'student',
            'class_id' => $this->fromClass->cId,
        ]);
        ClassEnrollment::create([
            'class_id' => $this->fromClass->cId,
            'student_id' => $this->student->uId,
        ]);
    }

    private function transfer(array $payload = [])
    {
        $token = $this->teacher->createToken('test')->plainTextToken;

        return $this->withHeaders(['Authorization' => 'Bearer ' . $token])
            ->postJson(
                "/api/teacher/classes/{$this->fromClass->cId}/transfer/{$this->toClass->cId}",
                $payload + ['student_ids' => [$this->student->uId]]
            );
    }

    /** @test */
    public function a_student_can_be_transferred_between_classes()
    {
        $this->transfer(['reason' => 'Level adjustment'])->assertStatus(200);

        $this->assertDatabaseHas('class_enrollments', [
            'class_id' => $this->toClass->cId,
            'student_id' => $this->student->uId,
        ]);
        $this->assertDatabaseMissing('class_enrollments', [
            'class_id' => $this->fromClass->cId,
            'student_id' => $this->student->uId,
        ]);
    }

    /** @test */
    public function transferring_updates_the_class_id_on_the_user_record()
    {
        $this->transfer()->assertStatus(200);

        // users.class_id là nguồn dữ liệu chính — bài giao, quyền chấm của GV và sĩ
        // số đều đọc cột này. Trước đây transfer bỏ sót nên học viên đã chuyển vẫn
        // thuộc lớp cũ ở mọi chỗ đó.
        $this->assertEquals(
            $this->toClass->cId,
            (int) $this->student->fresh()->class_id
        );
    }

    /** @test */
    public function the_transfer_is_logged_with_the_acting_teacher_and_notes()
    {
        $this->transfer(['reason' => 'Level adjustment', 'notes' => 'Ghi chú nội bộ'])
            ->assertStatus(200);

        $log = ClassTransfer::where('student_id', $this->student->uId)->first();

        $this->assertNotNull($log);
        $this->assertEquals($this->teacher->uId, (int) $log->teacher_id);
        $this->assertEquals($this->fromClass->cId, (int) $log->from_class_id);
        $this->assertEquals($this->toClass->cId, (int) $log->to_class_id);
        // notes cũng từng bị $fillable lọc bỏ nên âm thầm không được lưu.
        $this->assertEquals('Ghi chú nội bộ', $log->notes);
    }

    /** @test */
    public function a_student_only_linked_by_class_id_can_still_be_transferred()
    {
        // Học viên được gán lớp qua users.class_id mà chưa có bản ghi ở bảng phụ
        // (admin gán, hoặc import). Trước đây bị báo "không có trong lớp nguồn".
        ClassEnrollment::where('class_id', $this->fromClass->cId)
            ->where('student_id', $this->student->uId)
            ->delete();

        $this->transfer()->assertStatus(200);

        $this->assertEquals(
            $this->toClass->cId,
            (int) $this->student->fresh()->class_id
        );
    }

    /** @test */
    public function transferring_into_the_same_class_is_rejected()
    {
        $token = $this->teacher->createToken('test')->plainTextToken;

        $this->withHeaders(['Authorization' => 'Bearer ' . $token])
            ->postJson(
                "/api/teacher/classes/{$this->fromClass->cId}/transfer/{$this->fromClass->cId}",
                ['student_ids' => [$this->student->uId]]
            )
            ->assertStatus(400);
    }

    /** @test */
    public function a_teacher_cannot_transfer_out_of_a_class_they_do_not_own()
    {
        $otherTeacher = User::factory()->create(['uRole' => 'teacher']);
        $foreignClass = Classes::factory()->create([
            'cTeacher_id' => $otherTeacher->uId,
        ]);
        $token = $this->teacher->createToken('test')->plainTextToken;

        $this->withHeaders(['Authorization' => 'Bearer ' . $token])
            ->postJson(
                "/api/teacher/classes/{$foreignClass->cId}/transfer/{$this->toClass->cId}",
                ['student_ids' => [$this->student->uId]]
            )
            ->assertStatus(404);
    }
}

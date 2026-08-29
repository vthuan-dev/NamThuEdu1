<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Course;
use App\Models\Category;
use App\Models\Classes;
use App\Models\ClassEnrollment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;

class ClassApiTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected $teacher;
    protected $student;

    protected function setUp(): void
    {
        parent::setUp();
        $this->artisan('migrate:fresh');

        $this->teacher = User::factory()->create(['uRole' => 'teacher']);

        // Đặt age_group rõ ràng: enroll() từ chối học viên lệch độ tuổi với lớp.
        $this->student = User::factory()->create([
            'uRole' => 'student',
            'age_group' => 'teens',
        ]);
    }

    /** @test */
    public function teacher_can_create_class()
    {
        // First create a category and course
        $category = Category::create(['caName' => 'IELTS']);
        
        $course = Course::factory()->create([
            'cTeacher' => $this->teacher->uId,
            'cCategory' => $category->caId,
        ]);

        $token = $this->teacher->createToken('test-token')->plainTextToken;

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token,
        ])->postJson('/api/teacher/classes', [
            // API nhận name/description/age_group/max_students — KHÔNG phải tên cột
            // DB (cName/cDescription/cStatus). Test cũ gửi tên cột nên luôn 400.
            'name' => 'IELTS 7.0 Class',
            'description' => 'Advanced IELTS preparation',
            'age_group' => 'teens',
            'max_students' => 30,
        ]);

        // 201 Created — đúng chuẩn REST cho việc tạo mới.
        $response->assertStatus(201);

        $this->assertDatabaseHas('classes', [
            'cName' => 'IELTS 7.0 Class',
            'cTeacher_id' => $this->teacher->uId,
        ]);
    }

    /** @test */
    public function teacher_can_enroll_student_to_class()
    {
        // ClassesFactory không set age_group (→ NULL) nên phải đặt rõ, không thì
        // enroll() chặn vì lệch độ tuổi và test không kiểm được luồng ghi danh.
        $class = Classes::factory()->create([
            'cTeacher_id' => $this->teacher->uId,
            'age_group' => 'teens',
        ]);

        $token = $this->teacher->createToken('test-token')->plainTextToken;

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token,
        ])->postJson("/api/teacher/classes/{$class->cId}/enroll", [
            'student_ids' => [$this->student->uId],
        ]);

        $response->assertStatus(200);

        // users.class_id là nguồn dữ liệu chính; ClassEnrollment chỉ giữ để tương
        // thích cũ. UserFactory tự gán student vào một lớp mặc định, nên đây là
        // kiểm tra class_id ĐÃ ĐỔI sang lớp mới.
        $this->assertEquals(
            $class->cId,
            (int) $this->student->fresh()->class_id
        );

        $this->assertDatabaseHas('class_enrollments', [
            'class_id' => $class->cId,
            'student_id' => $this->student->uId,
        ]);
    }

    /** @test */
    public function teacher_can_transfer_students_between_classes()
    {
        $fromClass = Classes::factory()->create([
            'cTeacher_id' => $this->teacher->uId,
        ]);

        $toClass = Classes::factory()->create([
            'cTeacher_id' => $this->teacher->uId,
        ]);

        ClassEnrollment::create([
            'class_id' => $fromClass->cId,
            'student_id' => $this->student->uId,
        ]);

        $token = $this->teacher->createToken('test-token')->plainTextToken;

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token,
        ])->postJson("/api/teacher/classes/{$fromClass->cId}/transfer/{$toClass->cId}", [
            'student_ids' => [$this->student->uId],
            'reason' => 'Level adjustment',
        ]);

        $response->assertStatus(200);

        $this->assertDatabaseHas('class_enrollments', [
            'class_id' => $toClass->cId,
            'student_id' => $this->student->uId,
        ]);

        $this->assertDatabaseHas('class_transfers', [
            'from_class_id' => $fromClass->cId,
            'to_class_id' => $toClass->cId,
            'student_id' => $this->student->uId,
            // teacher_id từng bị $fillable lọc bỏ → INSERT thiếu cột NOT NULL → 500.
            'teacher_id' => $this->teacher->uId,
        ]);
    }

    /** @test */
    public function teacher_can_view_class_statistics()
    {
        $class = Classes::factory()->create([
            'cTeacher_id' => $this->teacher->uId,
        ]);

        ClassEnrollment::factory()->count(5)->create([
            'class_id' => $class->cId,
        ]);

        $token = $this->teacher->createToken('test-token')->plainTextToken;

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token,
        ])->getJson('/api/teacher/classes/statistics');

        $response->assertStatus(200)
                 ->assertStatus(200);
    }

    /** @test */
    public function teacher_can_remove_student_from_class()
    {
        $class = Classes::factory()->create([
            'cTeacher_id' => $this->teacher->uId,
        ]);

        ClassEnrollment::create([
            'class_id' => $class->cId,
            'student_id' => $this->student->uId,
        ]);

        $token = $this->teacher->createToken('test-token')->plainTextToken;

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token,
        ])->deleteJson("/api/teacher/classes/{$class->cId}/students/{$this->student->uId}");

        $response->assertStatus(200);

        $this->assertDatabaseMissing('class_enrollments', [
            'class_id' => $class->cId,
            'student_id' => $this->student->uId,
        ]);
    }
}

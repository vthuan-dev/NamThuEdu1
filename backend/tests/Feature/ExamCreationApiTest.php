<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Smoke test toàn bộ API TẠO ĐỀ THI (mọi loại: GENERAL, VSTEP, IELTS, THPT,
 * Kids, Import). Mục tiêu: phát hiện endpoint nào trả 500 / sai schema.
 *
 * Auth: actingAs(teacher, 'sanctum'). Tất cả route dưới /api/teacher.
 */
class ExamCreationApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $teacher;

    protected function setUp(): void
    {
        parent::setUp();
        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
    }

    private function as()
    {
        return $this->actingAs($this->teacher, 'sanctum');
    }

    // ── GENERAL ───────────────────────────────────────────────

    /** @test */
    public function tao_de_general_co_ban(): void
    {
        $res = $this->as()->postJson('/api/teacher/exams', [
            'eTitle'            => 'Đề GENERAL test',
            'eType'             => 'GENERAL',
            'eSkill'            => 'reading',
            'eDuration_minutes' => 30,
        ]);
        $res->assertStatus(200)->assertJsonPath('status', 'success');
        $this->assertDatabaseHas('exams', ['eTitle' => 'Đề GENERAL test', 'eTeacher_id' => $this->teacher->uId]);
    }

    /** @test */
    public function tao_de_general_kem_cau_hoi_va_publish(): void
    {
        $create = $this->as()->postJson('/api/teacher/exams', [
            'eTitle' => 'GENERAL publish', 'eType' => 'GENERAL', 'eSkill' => 'reading', 'eDuration_minutes' => 30,
        ]);
        $examId = $create->json('data.eId');
        $this->assertNotNull($examId);

        $add = $this->as()->postJson("/api/teacher/exams/{$examId}/questions", [
            'questions' => [[
                'qContent' => 'What is 2+2?',
                'qPoints'  => 1,
                'answers'  => [
                    ['aContent' => '4', 'aIs_correct' => true],
                    ['aContent' => '3', 'aIs_correct' => false],
                ],
            ]],
        ]);
        $add->assertStatus(201)->assertJsonPath('data.added_questions_count', 1);

        $publish = $this->as()->postJson("/api/teacher/exams/{$examId}/publish", []);
        $publish->assertStatus(200)->assertJsonPath('status', 'success');
    }

    /** @test */
    public function add_questions_thieu_dap_an_dung_tra_400(): void
    {
        $examId = $this->as()->postJson('/api/teacher/exams', [
            'eTitle' => 'X', 'eType' => 'GENERAL', 'eSkill' => 'reading', 'eDuration_minutes' => 30,
        ])->json('data.eId');

        $this->as()->postJson("/api/teacher/exams/{$examId}/questions", [
            'questions' => [[
                'qContent' => 'No correct?', 'qPoints' => 1,
                'answers' => [['aContent' => 'a', 'aIs_correct' => false]],
            ]],
        ])->assertStatus(400);
    }

    // ── IMPORT ────────────────────────────────────────────────

    /** @test */
    public function import_de_thi(): void
    {
        $res = $this->as()->postJson('/api/teacher/exams/import', [
            'eTitle'            => 'Đề import',
            'eType'             => 'GENERAL',
            'eSkill'            => 'reading',
            'eDuration_minutes' => 40,
            'questions'         => [[
                'qContent' => 'Q1',
                'qPoints'  => 1,
                'answers'  => [
                    ['aContent' => 'A', 'aIs_correct' => true],
                    ['aContent' => 'B', 'aIs_correct' => false],
                ],
            ]],
        ]);
        $res->assertStatus(201)->assertJsonPath('data.questions_count', 1);
    }

    // ── VSTEP ─────────────────────────────────────────────────

    /** @test */
    public function tao_de_vstep_va_luu_part(): void
    {
        $examId = $this->as()->postJson('/api/teacher/exams', [
            'eTitle' => 'VSTEP Reading', 'eType' => 'VSTEP', 'eSkill' => 'reading', 'eDuration_minutes' => 60,
        ])->json('data.eId');
        $this->assertNotNull($examId);

        $part = $this->as()->postJson("/api/teacher/exams/{$examId}/vstep/parts/1", [
            'partName'  => 'Part 1',
            'passage'   => 'This is a reading passage about testing.',
            'wordCount' => 8,
            'questions' => [[
                'questionNumber' => 1,
                'questionText'   => 'What is this about?',
                'options'        => ['A' => 'Testing', 'B' => 'Cooking', 'C' => 'Sports', 'D' => 'Music'],
                'correctAnswer'  => 'A',
            ]],
        ]);
        $part->assertStatus(200)->assertJsonPath('data.questions_saved', 1);
    }

    // ── IELTS ─────────────────────────────────────────────────

    /** @test */
    public function tao_va_cap_nhat_draft_ielts(): void
    {
        $create = $this->as()->postJson('/api/teacher/exams/ielts', [
            'eTitle'          => 'IELTS Listening test',
            'ielts_test_type' => 'Academic',
            'ielts_skill'     => 'listening',
        ]);
        $create->assertStatus(200)->assertJsonPath('status', 'success');
        $examId = $create->json('data.eId');
        $this->assertNotNull($examId);
        $this->assertDatabaseHas('exams', ['eId' => $examId, 'eType' => 'IELTS', 'eStatus' => 'draft']);

        $update = $this->as()->putJson("/api/teacher/exams/{$examId}/ielts", [
            'eTitle' => 'IELTS Listening updated',
        ]);
        $update->assertStatus(200);
    }

    // ── THPT ──────────────────────────────────────────────────

    /** @test */
    public function tao_draft_thpt_va_doc_lai(): void
    {
        $create = $this->as()->postJson('/api/teacher/exams/thpt', [
            'eTitle' => 'THPT Tiếng Anh 2026',
        ]);
        $create->assertStatus(200)->assertJsonPath('status', 'success');
        $examId = $create->json('data.eId');
        $this->assertDatabaseHas('exams', ['eId' => $examId, 'eType' => 'THPT', 'eStatus' => 'draft']);

        $this->as()->getJson("/api/teacher/exams/{$examId}/thpt/draft")
            ->assertStatus(200)
            ->assertJsonPath('data.eId', $examId);
    }

    // ── KIDS ──────────────────────────────────────────────────

    /** @test */
    public function tao_de_kids_va_them_cau_hoi(): void
    {
        if (!Schema::hasTable('kids_exam_templates') || !Schema::hasTable('kids_task_definitions')) {
            $this->markTestSkipped('Bảng kids definitions không tồn tại.');
        }

        DB::table('kids_exam_templates')->insert([
            'code' => 'yle_starters',
            'name' => 'Cambridge YLE Starters',
            'config' => json_encode([
                'level' => 'Pre A1', 'age_range' => '6-8', 'vocabulary_size' => 350,
                'skills' => ['listening', 'reading', 'speaking'],
                'parts' => [],
            ]),
            'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('kids_task_definitions')->insert([
            'code' => 'look_and_read',
            'name' => 'Look and Read',
            'definition' => json_encode([
                'skill' => 'reading', 'icon' => '📖', 'instructions' => 'Nhìn và đọc',
            ]),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $create = $this->as()->postJson('/api/teacher/kids-exams', [
            'eTitle'         => 'Kids Starters test',
            'exam_type_code' => 'yle_starters',
        ]);
        $create->assertStatus(201);
        $examId = $create->json('exam.eId');
        $this->assertNotNull($examId);

        $add = $this->as()->postJson("/api/teacher/kids-exams/{$examId}/questions", [
            'task_type_code' => 'look_and_read',
            'task_data'      => ['items' => [['word' => 'cat', 'image' => 'cat.png']]],
            'qContent'       => 'Match the words',
        ]);
        $add->assertStatus(201);
    }

    // ── AUTH GUARD ────────────────────────────────────────────

    /** @test */
    public function khong_phai_teacher_bi_chan(): void
    {
        $student = User::factory()->create(['uRole' => 'student']);
        $this->actingAs($student, 'sanctum')
            ->postJson('/api/teacher/exams', [
                'eTitle' => 'X', 'eType' => 'GENERAL', 'eSkill' => 'reading', 'eDuration_minutes' => 30,
            ])
            ->assertStatus(403);
    }
}

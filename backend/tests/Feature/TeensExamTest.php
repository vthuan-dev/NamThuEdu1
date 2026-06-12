<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Exam;
use App\Models\Question;
use App\Models\Answer;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Teens Listening / Speaking exam creation (TeensExamController).
 */
class TeensExamTest extends TestCase
{
    use RefreshDatabase;

    protected User $teacher;

    protected function setUp(): void
    {
        parent::setUp();
        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
    }

    /** @test */
    public function teacher_tao_de_listening_voi_audio_va_trac_nghiem(): void
    {
        $payload = [
            'skill'             => 'listening',
            'eTitle'            => 'Listening Unit 1',
            'eDuration_minutes' => 20,
            'groups'            => [[
                'audio_url' => 'https://cdn.example.com/audio1.mp3',
                'questions' => [[
                    'qContent' => 'What is the topic?',
                    'options'  => [
                        ['content' => 'Family',  'isCorrect' => true],
                        ['content' => 'Travel',  'isCorrect' => false],
                        ['content' => 'Sport',   'isCorrect' => false],
                    ],
                ]],
            ]],
        ];

        $res = $this->actingAs($this->teacher, 'sanctum')
            ->postJson('/api/teacher/exams/teens', $payload);

        $res->assertStatus(200)->assertJsonPath('data.skill', 'listening');
        $examId = $res->json('data.eId');

        $exam = Exam::find($examId);
        $this->assertNotNull($exam);
        $this->assertSame('teens', $exam->age_group);
        $this->assertSame('listening', $exam->eSkill);

        $q = Question::where('exam_id', $examId)->first();
        $this->assertNotNull($q);
        $this->assertSame('listening', strtolower($q->qSkill));
        $this->assertSame('https://cdn.example.com/audio1.mp3', $q->qMedia_url);
        $this->assertSame(3, Answer::where('question_id', $q->qId)->count());
        $this->assertSame(1, Answer::where('question_id', $q->qId)->where('aIs_correct', true)->count());
    }

    /** @test */
    public function tao_de_listening_thieu_dap_an_dung_bi_tu_choi(): void
    {
        $payload = [
            'skill'  => 'listening',
            'eTitle' => 'Bad listening',
            'groups' => [[
                'audio_url' => null,
                'questions' => [[
                    'qContent' => 'No correct option?',
                    'options'  => [
                        ['content' => 'A', 'isCorrect' => false],
                        ['content' => 'B', 'isCorrect' => false],
                    ],
                ]],
            ]],
        ];

        $this->actingAs($this->teacher, 'sanctum')
            ->postJson('/api/teacher/exams/teens', $payload)
            ->assertStatus(400);
    }

    /** @test */
    public function teacher_tao_de_speaking(): void
    {
        $payload = [
            'skill'  => 'speaking',
            'eTitle' => 'Speaking — hobbies',
            'parts'  => [
                ['qContent' => 'Talk about your hobby.', 'prepSeconds' => 30, 'speakSeconds' => 120],
                ['qContent' => 'Describe your best friend.', 'prepSeconds' => 20, 'speakSeconds' => 90],
            ],
        ];

        $res = $this->actingAs($this->teacher, 'sanctum')
            ->postJson('/api/teacher/exams/teens', $payload);

        $res->assertStatus(200)->assertJsonPath('data.skill', 'speaking');
        $examId = $res->json('data.eId');

        $exam = Exam::find($examId);
        $this->assertSame('speaking', $exam->eSkill);
        $this->assertSame('teens', $exam->age_group);

        $questions = Question::where('exam_id', $examId)->orderBy('qPart')->get();
        $this->assertCount(2, $questions);
        $this->assertSame('speaking', strtolower($questions[0]->qSkill));
        $this->assertSame('speaking', strtolower($questions[0]->qType));
        $this->assertSame(1, (int) $questions[0]->qPart);
        // qData lưu thời gian chuẩn bị / nói
        $this->assertSame(120, (int) ($questions[0]->qData['speakSeconds'] ?? 0));
    }

    /** @test */
    public function hoc_vien_khong_duoc_tao_de_teens(): void
    {
        $student = User::factory()->create(['uRole' => 'student']);
        // Route teacher được middleware role chặn → 403 (hoặc 401 ở fallback controller).
        $res = $this->actingAs($student, 'sanctum')
            ->postJson('/api/teacher/exams/teens', ['skill' => 'speaking', 'eTitle' => 'x', 'parts' => [['qContent' => 'y']]]);
        $this->assertContains($res->status(), [401, 403]);
    }
}

<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Exam;
use Laravel\Sanctum\Sanctum;
use Illuminate\Foundation\Testing\RefreshDatabase;

class IeltsModularExamTest extends TestCase
{
    use RefreshDatabase;

    protected $teacher;
    protected $student;

    protected function setUp(): void
    {
        parent::setUp();
        $this->teacher = User::factory()->teacher()->create();
        $this->student = User::factory()->student()->create();
    }

    private function createDraft(string $skill): Exam
    {
        return Exam::create([
            'eTitle' => "Draft IELTS {$skill}",
            'eType' => 'IELTS',
            'eSkill' => $skill,
            'eTeacher_id' => $this->teacher->uId,
            'ielts_skill' => $skill,
            'ielts_test_type' => 'Academic',
            'eStatus' => 'draft',
        ]);
    }

    /** @test */
    public function teacher_can_publish_modular_listening_exam_with_only_1_section()
    {
        Sanctum::actingAs($this->teacher);
        $exam = $this->createDraft('listening');

        $questions = [];
        for ($q = 1; $q <= 10; $q++) {
            $questions[] = [
                'questionNumber' => $q,
                'questionType' => 'multiple-choice',
                'questionText' => "Listening Section 1 Question {$q}",
                'options' => ['A' => 'Opt A', 'B' => 'Opt B', 'C' => 'Opt C', 'D' => 'Opt D'],
                'correctAnswer' => 'A',
            ];
        }

        $sections = [
            [
                'sectionNumber' => 1,
                'audioUrl' => 'https://example.com/sec1.mp3',
                'audioFileName' => 'sec1.mp3',
                'transcript' => 'Section 1 transcript',
                'questions' => $questions,
            ],
        ];

        $res = $this->postJson("/api/teacher/exams/{$exam->eId}/ielts/publish", [
            'ielts_test_type' => 'Academic',
            'ielts_skill' => 'listening',
            'ielts_data' => ['sections' => $sections],
            'play_modes' => [
                'practice_enabled' => true,
                'full_test_enabled' => true,
            ],
        ]);

        $res->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.questions_count', 10);

        $exam->refresh();
        $this->assertSame('published', $exam->eStatus);
        $this->assertSame(10, $exam->eDuration_minutes, 'Duration for 1 listening section must be 10 minutes');
        $this->assertSame(1, $exam->contentBlocks->count());
        $this->assertSame(10, $exam->questions->count());

        // Student loads exam: should only have 1 section, no dummy sections 2, 3, 4
        Sanctum::actingAs($this->student);
        $studentRes = $this->getJson("/api/student/exams/{$exam->eId}/ielts/listening");

        $studentRes->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.totalQuestions', 10)
            ->assertJsonPath('data.duration', 10);

        $loadedSections = $studentRes->json('data.sections');
        $this->assertCount(1, $loadedSections, 'Student must only receive 1 section');
        $this->assertSame(1, $loadedSections[0]['sectionNumber']);
        $this->assertCount(10, $loadedSections[0]['questions']);
    }

    /** @test */
    public function teacher_can_publish_modular_reading_exam_with_only_1_passage()
    {
        Sanctum::actingAs($this->teacher);
        $exam = $this->createDraft('reading');

        $questions = [];
        for ($q = 1; $q <= 13; $q++) {
            $questions[] = [
                'questionNumber' => $q,
                'questionType' => 'multiple-choice',
                'questionText' => "Reading Passage 1 Question {$q}",
                'options' => ['A' => 'A', 'B' => 'B', 'C' => 'C', 'D' => 'D'],
                'correctAnswer' => 'B',
            ];
        }

        $passages = [
            [
                'passageNumber' => 1,
                'title' => 'Passage 1 Title',
                'body' => 'Passage 1 reading content lorem ipsum dolor sit amet...',
                'questions' => $questions,
            ],
        ];

        $res = $this->postJson("/api/teacher/exams/{$exam->eId}/ielts/publish", [
            'ielts_test_type' => 'Academic',
            'ielts_skill' => 'reading',
            'ielts_data' => ['passages' => $passages],
            'play_modes' => [
                'practice_enabled' => true,
                'full_test_enabled' => true,
            ],
        ]);

        $res->assertStatus(200)->assertJsonPath('status', 'success');

        $exam->refresh();
        $this->assertSame('published', $exam->eStatus);
        $this->assertSame(20, $exam->eDuration_minutes, 'Duration for 1 passage must be 20 minutes');
        $this->assertSame(13, $exam->questions->count());

        // Student loads reading exam: must only have 1 passage
        Sanctum::actingAs($this->student);
        $studentRes = $this->getJson("/api/student/exams/{$exam->eId}/ielts/reading");

        $studentRes->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.totalQuestions', 13)
            ->assertJsonPath('data.duration', 20);

        $loadedPassages = $studentRes->json('data.passages');
        $this->assertCount(1, $loadedPassages, 'Student must only receive 1 passage');
        $this->assertSame(1, $loadedPassages[0]['passageNumber']);
    }

    /** @test */
    public function teacher_can_publish_modular_writing_exam_with_only_task1()
    {
        Sanctum::actingAs($this->teacher);
        $exam = $this->createDraft('writing');

        $tasks = [
            [
                'taskNumber' => 1,
                'prompt' => 'Summarise the information by selecting and reporting the main features...',
                'minWords' => 150,
            ],
        ];

        $res = $this->postJson("/api/teacher/exams/{$exam->eId}/ielts/publish", [
            'ielts_test_type' => 'Academic',
            'ielts_skill' => 'writing',
            'ielts_data' => ['tasks' => $tasks],
            'play_modes' => [
                'practice_enabled' => true,
                'full_test_enabled' => true,
            ],
        ]);

        $res->assertStatus(200)->assertJsonPath('status', 'success');

        $exam->refresh();
        $this->assertSame('published', $exam->eStatus);
        $this->assertSame(20, $exam->eDuration_minutes, 'Duration for Task 1 must be 20 minutes');

        // Student loads writing exam
        Sanctum::actingAs($this->student);
        $studentRes = $this->getJson("/api/student/exams/{$exam->eId}/ielts/writing");

        $studentRes->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.duration', 20);

        $this->assertCount(1, $studentRes->json('data.tasks'));
    }

    /** @test */
    public function teacher_can_publish_modular_speaking_exam_with_only_part1()
    {
        Sanctum::actingAs($this->teacher);
        $exam = $this->createDraft('speaking');

        $parts = [
            [
                'partNumber' => 1,
                'questions' => [
                    ['text' => 'What is your name?'],
                    ['text' => 'Do you work or are you a student?'],
                ],
            ],
        ];

        $res = $this->postJson("/api/teacher/exams/{$exam->eId}/ielts/publish", [
            'ielts_test_type' => 'Academic',
            'ielts_skill' => 'speaking',
            'ielts_data' => ['parts' => $parts],
            'play_modes' => [
                'practice_enabled' => true,
                'full_test_enabled' => true,
            ],
        ]);

        $res->assertStatus(200)->assertJsonPath('status', 'success');

        $exam->refresh();
        $this->assertSame('published', $exam->eStatus);
        $this->assertSame(5, $exam->eDuration_minutes, 'Duration for Part 1 speaking must be 5 minutes');

        // Student loads speaking exam
        Sanctum::actingAs($this->student);
        $studentRes = $this->getJson("/api/student/exams/{$exam->eId}/ielts/speaking");

        $studentRes->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.duration', 5);

        $loadedParts = $studentRes->json('data.parts');
        $this->assertCount(1, $loadedParts, 'Student must only receive Part 1');
        $this->assertSame(1, $loadedParts[0]['partNumber']);
    }
}

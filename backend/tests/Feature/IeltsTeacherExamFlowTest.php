<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Exam;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Test bộ flow tạo đề IELTS theo concept đúng (1 đề = 1 skill).
 *
 * Endpoints:
 *   POST   /api/teacher/exams/ielts                    createDraft
 *   PUT    /api/teacher/exams/{id}/ielts               updateDraft
 *   POST   /api/teacher/exams/{id}/ielts/publish       publish
 *   GET    /api/teacher/exams/{id}/ielts/draft         getDraft
 */
class IeltsTeacherExamFlowTest extends TestCase
{
    use RefreshDatabase;

    /** @var User */
    protected $teacher;
    /** @var string */
    protected $token;

    protected function setUp(): void
    {
        parent::setUp();
        $this->teacher = User::factory()->teacher()->create();
        $this->token = $this->teacher->createToken('test')->plainTextToken;
    }

    private function authHeader(): array
    {
        return ['Authorization' => 'Bearer ' . $this->token];
    }

    // ─────────────────────────────────────────────────────────────────────
    //  createDraft
    // ─────────────────────────────────────────────────────────────────────

    /** @test */
    public function teacher_can_create_listening_draft()
    {
        $response = $this->withHeaders($this->authHeader())
            ->postJson('/api/teacher/exams/ielts', [
                'eTitle' => 'IELTS Academic - Listening Practice',
                'ielts_test_type' => 'Academic',
                'ielts_skill' => 'listening',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $examId = $response->json('data.eId');
        $this->assertNotNull($examId, 'createDraft must return eId');

        $exam = Exam::find($examId);
        $this->assertNotNull($exam);
        $this->assertSame('IELTS', $exam->eType);
        $this->assertSame('skill', $exam->eScope);
        $this->assertNull($exam->ePart_type);
        $this->assertNull($exam->ePart_number);
        $this->assertSame('Academic', $exam->ielts_test_type);
        $this->assertSame('listening', $exam->ielts_skill);
        $this->assertSame('draft', $exam->eStatus);
        $this->assertSame(40, (int) $exam->eDuration_minutes);
        $this->assertSame($this->teacher->uId, (int) $exam->eTeacher_id);
    }

    /** @test */
    public function teacher_can_create_drafts_for_each_of_4_skills_with_correct_default_durations()
    {
        $expectedDurations = [
            'listening' => 40,
            'reading'   => 60,
            'writing'   => 60,
            'speaking'  => 14,
        ];

        foreach ($expectedDurations as $skill => $minutes) {
            $response = $this->withHeaders($this->authHeader())
                ->postJson('/api/teacher/exams/ielts', [
                    'eTitle' => "IELTS - {$skill}",
                    'ielts_test_type' => 'Academic',
                    'ielts_skill' => $skill,
                ]);
            $response->assertStatus(200);

            $exam = Exam::find($response->json('data.eId'));
            $this->assertSame(
                $minutes,
                (int) $exam->eDuration_minutes,
                "Default duration for {$skill} must be {$minutes}m"
            );
            $this->assertSame($skill, $exam->ielts_skill);
            $this->assertSame('skill', $exam->eScope);
        }
    }

    /** @test */
    public function teacher_can_create_ielts_full_draft_as_one_exam_id()
    {
        $response = $this->withHeaders($this->authHeader())
            ->postJson('/api/teacher/exams/ielts', [
                'eTitle' => 'IELTS Academic - Full Test',
                'ielts_test_type' => 'Academic',
                'ielts_skill' => 'mixed',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $exam = Exam::find($response->json('data.eId'));
        $this->assertNotNull($exam);
        $this->assertSame('IELTS', $exam->eType);
        $this->assertSame('mixed', $exam->eSkill);
        $this->assertSame('full', $exam->eScope);
        $this->assertNull($exam->ielts_skill);
        $this->assertSame(['listening', 'reading', 'writing', 'speaking'], $exam->ielts_config['available_skills']);
        $this->assertSame(174, (int) $exam->eDuration_minutes);
    }

    /** @test */
    public function create_draft_rejects_invalid_skill()
    {
        $response = $this->withHeaders($this->authHeader())
            ->postJson('/api/teacher/exams/ielts', [
                'eTitle' => 'Invalid skill',
                'ielts_test_type' => 'Academic',
                'ielts_skill' => 'grammar',
            ]);
        $response->assertStatus(400)
            ->assertJsonPath('status', 'error');
    }

    /** @test */
    public function create_draft_rejects_invalid_test_type()
    {
        $response = $this->withHeaders($this->authHeader())
            ->postJson('/api/teacher/exams/ielts', [
                'eTitle' => 'Invalid type',
                'ielts_test_type' => 'Foundation',
                'ielts_skill' => 'reading',
            ]);
        $response->assertStatus(400);
    }

    /** @test */
    public function create_draft_requires_title()
    {
        $response = $this->withHeaders($this->authHeader())
            ->postJson('/api/teacher/exams/ielts', [
                'ielts_test_type' => 'Academic',
                'ielts_skill' => 'listening',
            ]);
        $response->assertStatus(400);
    }

    /** @test */
    public function create_draft_supports_general_training_for_reading_and_writing()
    {
        foreach (['reading', 'writing'] as $skill) {
            $response = $this->withHeaders($this->authHeader())
                ->postJson('/api/teacher/exams/ielts', [
                    'eTitle' => "GT - {$skill}",
                    'ielts_test_type' => 'General Training',
                    'ielts_skill' => $skill,
                ]);
            $response->assertStatus(200);

            $exam = Exam::find($response->json('data.eId'));
            $this->assertSame('General Training', $exam->ielts_test_type);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    //  updateDraft
    // ─────────────────────────────────────────────────────────────────────

    /** @test */
    public function teacher_can_update_draft_title_and_save_skill_data()
    {
        $exam = $this->createIeltsDraft('listening');

        $payload = [
            'eTitle' => 'Updated Title',
            'eDescription' => 'New description',
            'ielts_data' => [
                'sections' => [
                    ['sectionNumber' => 1, 'audioUrl' => 'https://x/a.mp3', 'questions' => []],
                ],
            ],
        ];

        $response = $this->withHeaders($this->authHeader())
            ->putJson("/api/teacher/exams/{$exam->eId}/ielts", $payload);

        $response->assertStatus(200)->assertJsonPath('status', 'success');

        $exam->refresh();
        $this->assertSame('Updated Title', $exam->eTitle);
        $this->assertSame('New description', $exam->eDescription);

        // ielts_data được lưu vào ielts_config['draft_data']
        $config = $exam->ielts_config;
        $this->assertIsArray($config);
        $this->assertArrayHasKey('draft_data', $config);
        $this->assertEquals(
            $payload['ielts_data'],
            $config['draft_data']
        );
    }

    /** @test */
    public function update_draft_merges_ielts_config_without_dropping_existing_keys()
    {
        $exam = $this->createIeltsDraft('listening');

        // First update sets play_modes
        $this->withHeaders($this->authHeader())
            ->putJson("/api/teacher/exams/{$exam->eId}/ielts", [
                'ielts_config' => ['play_modes' => ['practice_enabled' => false]],
            ])
            ->assertStatus(200);

        // Second update saves ielts_data — must NOT erase play_modes
        $this->withHeaders($this->authHeader())
            ->putJson("/api/teacher/exams/{$exam->eId}/ielts", [
                'ielts_data' => ['sections' => []],
            ])
            ->assertStatus(200);

        $exam->refresh();
        $config = $exam->ielts_config;
        $this->assertArrayHasKey('play_modes', $config, 'play_modes must persist');
        $this->assertSame(false, $config['play_modes']['practice_enabled']);
        $this->assertArrayHasKey('draft_data', $config);
    }

    /** @test */
    public function update_draft_returns_404_when_exam_belongs_to_other_teacher()
    {
        $otherTeacher = User::factory()->teacher()->create();
        $exam = Exam::create([
            'eTitle' => 'Other teacher exam',
            'eType' => 'IELTS',
            'eSkill' => 'listening',
            'eDuration_minutes' => 40,
            'eTeacher_id' => $otherTeacher->uId,
            'ielts_skill' => 'listening',
            'ielts_test_type' => 'Academic',
            'eStatus' => 'draft',
        ]);

        $response = $this->withHeaders($this->authHeader())
            ->putJson("/api/teacher/exams/{$exam->eId}/ielts", [
                'eTitle' => 'Hijack',
            ]);
        $response->assertStatus(404);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  getDraft
    // ─────────────────────────────────────────────────────────────────────

    /** @test */
    public function teacher_can_fetch_their_draft()
    {
        $exam = $this->createIeltsDraft('reading');
        // Save some data to draft
        $this->withHeaders($this->authHeader())
            ->putJson("/api/teacher/exams/{$exam->eId}/ielts", [
                'ielts_data' => [
                    'passages' => [
                        ['passageNumber' => 1, 'title' => 'X', 'body' => 'Y', 'questions' => []],
                    ],
                ],
            ]);

        $response = $this->withHeaders($this->authHeader())
            ->getJson("/api/teacher/exams/{$exam->eId}/ielts/draft");

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.eId', $exam->eId)
            ->assertJsonPath('data.ielts_skill', 'reading')
            ->assertJsonPath('data.ielts_test_type', 'Academic')
            ->assertJsonPath('data.eStatus', 'draft');

        $this->assertNotNull(
            $response->json('data.ielts_data'),
            'getDraft must return saved draft data'
        );
        $this->assertEquals(
            'X',
            $response->json('data.ielts_data.passages.0.title')
        );
    }

    /** @test */
    public function get_draft_returns_404_for_non_existent_or_foreign_exam()
    {
        $response = $this->withHeaders($this->authHeader())
            ->getJson('/api/teacher/exams/999999/ielts/draft');
        $response->assertStatus(404);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  publish — happy path
    // ─────────────────────────────────────────────────────────────────────

    /** @test */
    public function teacher_can_publish_listening_exam_with_4_sections()
    {
        $exam = $this->createIeltsDraft('listening');

        $sections = [];
        for ($s = 1; $s <= 4; $s++) {
            $questions = [];
            for ($q = 1; $q <= 10; $q++) {
                $questions[] = [
                    'questionNumber' => ($s - 1) * 10 + $q,
                    'questionType' => 'multiple-choice',
                    'questionText' => "Q text s{$s} q{$q}",
                    'options' => ['A' => 'a', 'B' => 'b', 'C' => 'c', 'D' => 'd'],
                    'correctAnswer' => 'A',
                ];
            }
            $sections[] = [
                'sectionNumber' => $s,
                'audioUrl' => "https://example.com/section{$s}.mp3",
                'audioFileName' => "section{$s}.mp3",
                'transcript' => "transcript {$s}",
                'questions' => $questions,
            ];
        }

        $response = $this->withHeaders($this->authHeader())
            ->postJson("/api/teacher/exams/{$exam->eId}/ielts/publish", [
                'ielts_test_type' => 'Academic',
                'ielts_skill' => 'listening',
                'ielts_data' => ['sections' => $sections],
                'play_modes' => [
                    'practice_enabled' => true,
                    'full_test_enabled' => true,
                    'time_limit_options' => [null, 10, 20, 30],
                ],
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.skill', 'listening')
            ->assertJsonPath('data.test_type', 'Academic');

        $this->assertSame(40, (int) $response->json('data.questions_count'));

        $exam->refresh();
        $this->assertSame('published', $exam->eStatus);
        $this->assertSame('listening', $exam->ielts_skill);
        $this->assertSame(4, $exam->contentBlocks->count());
        $this->assertSame(40, $exam->questions->count());
        // Each MCQ → 4 answers
        $this->assertSame(40 * 4, \App\Models\Answer::whereIn(
            'question_id',
            $exam->questions->pluck('qId')
        )->count());
    }

    /** @test */
    public function teacher_can_publish_reading_exam_with_3_passages()
    {
        $exam = $this->createIeltsDraft('reading');
        $passages = [];
        $counts = [13, 13, 14];
        $offset = 0;
        foreach ($counts as $idx => $count) {
            $questions = [];
            for ($i = 1; $i <= $count; $i++) {
                $questions[] = [
                    'questionNumber' => $offset + $i,
                    'questionType' => 'true-false-not-given',
                    'questionText' => "Statement {$i}",
                    'correctAnswer' => 'TRUE',
                ];
            }
            $offset += $count;
            $passages[] = [
                'passageNumber' => $idx + 1,
                'title' => "Passage " . ($idx + 1),
                'body' => str_repeat('lorem ipsum ', 100),
                'wordCount' => 200,
                'questions' => $questions,
            ];
        }

        $response = $this->withHeaders($this->authHeader())
            ->postJson("/api/teacher/exams/{$exam->eId}/ielts/publish", [
                'ielts_test_type' => 'Academic',
                'ielts_skill' => 'reading',
                'ielts_data' => ['passages' => $passages],
                'play_modes' => ['practice_enabled' => true, 'full_test_enabled' => true],
            ]);

        $response->assertStatus(200);
        $this->assertSame(40, (int) $response->json('data.questions_count'));

        $exam->refresh();
        $this->assertSame(3, $exam->contentBlocks->count());
        $this->assertSame(40, $exam->questions->count());
    }

    /** @test */
    public function teacher_can_publish_writing_exam_with_2_tasks()
    {
        $exam = $this->createIeltsDraft('writing');
        $payload = [
            'ielts_test_type' => 'Academic',
            'ielts_skill' => 'writing',
            'ielts_data' => [
                'tasks' => [
                    ['taskNumber' => 1, 'prompt' => 'Describe the chart...', 'chartType' => 'bar'],
                    ['taskNumber' => 2, 'prompt' => 'Some people think...', 'essayType' => 'opinion'],
                ],
            ],
            'play_modes' => ['practice_enabled' => true, 'full_test_enabled' => true],
        ];

        $response = $this->withHeaders($this->authHeader())
            ->postJson("/api/teacher/exams/{$exam->eId}/ielts/publish", $payload);
        $response->assertStatus(200);

        $exam->refresh();
        $this->assertSame(2, $exam->questions->count());
        $this->assertSame('essay', $exam->questions->first()->qType);
    }

    /** @test */
    public function teacher_can_publish_speaking_exam_with_3_parts_including_cue_card()
    {
        $exam = $this->createIeltsDraft('speaking');

        $payload = [
            'ielts_test_type' => 'Academic',
            'ielts_skill' => 'speaking',
            'ielts_data' => [
                'parts' => [
                    [
                        'partNumber' => 1,
                        'questions' => [
                            ['text' => 'Where are you from?', 'topic' => 'Hometown'],
                            ['text' => 'Do you like your job?', 'topic' => 'Work'],
                        ],
                    ],
                    [
                        'partNumber' => 2,
                        'cueCard' => [
                            'topic' => 'Describe a memorable journey',
                            'bullets' => ['Where', 'When', 'Who with', 'Why memorable'],
                            'followUp' => 'Will you go again?',
                        ],
                    ],
                    [
                        'partNumber' => 3,
                        'questions' => [
                            ['text' => 'How has travel changed?'],
                            ['text' => 'What are benefits of travel?'],
                        ],
                    ],
                ],
            ],
            'play_modes' => ['practice_enabled' => true, 'full_test_enabled' => true],
        ];

        $response = $this->withHeaders($this->authHeader())
            ->postJson("/api/teacher/exams/{$exam->eId}/ielts/publish", $payload);
        $response->assertStatus(200);

        $exam->refresh();
        // 2 (Part 1) + 1 (Part 2 cue card) + 2 (Part 3) = 5
        $this->assertSame(5, $exam->questions->count());

        $part2Question = $exam->questions->where('qPart', 2)->first();
        $this->assertNotNull($part2Question);
        $this->assertArrayHasKey('cue_card', $part2Question->qData);
        $this->assertSame(
            'Describe a memorable journey',
            $part2Question->qData['cue_card']['topic']
        );
    }

    // ─────────────────────────────────────────────────────────────────────
    //  publish — validation
    // ─────────────────────────────────────────────────────────────────────

    /** @test */
    public function publish_rejects_when_no_play_mode_enabled()
    {
        $exam = $this->createIeltsDraft('listening');

        $response = $this->withHeaders($this->authHeader())
            ->postJson("/api/teacher/exams/{$exam->eId}/ielts/publish", [
                'ielts_test_type' => 'Academic',
                'ielts_skill' => 'listening',
                'ielts_data' => ['sections' => [['sectionNumber' => 1, 'questions' => []]]],
                'play_modes' => [
                    'practice_enabled' => false,
                    'full_test_enabled' => false,
                ],
            ]);

        $response->assertStatus(400)->assertJsonPath('status', 'error');
    }

    /** @test */
    public function publish_rejects_when_no_section_or_passage_or_task_or_part()
    {
        $cases = [
            ['skill' => 'listening', 'data' => ['sections' => []]],
            ['skill' => 'reading',   'data' => ['passages' => []]],
            ['skill' => 'writing',   'data' => ['tasks' => []]],
            ['skill' => 'speaking',  'data' => ['parts' => []]],
        ];

        foreach ($cases as $case) {
            $exam = $this->createIeltsDraft($case['skill']);
            $response = $this->withHeaders($this->authHeader())
                ->postJson("/api/teacher/exams/{$exam->eId}/ielts/publish", [
                    'ielts_test_type' => 'Academic',
                    'ielts_skill' => $case['skill'],
                    'ielts_data' => $case['data'],
                    'play_modes' => ['practice_enabled' => true, 'full_test_enabled' => true],
                ]);
            $response->assertStatus(400)
                ->assertJsonPath('status', 'error');
        }
    }

    /** @test */
    public function publish_rejects_when_skill_missing()
    {
        $exam = $this->createIeltsDraft('listening');
        $response = $this->withHeaders($this->authHeader())
            ->postJson("/api/teacher/exams/{$exam->eId}/ielts/publish", [
                'ielts_test_type' => 'Academic',
                'ielts_data' => ['sections' => [['sectionNumber' => 1, 'questions' => []]]],
            ]);
        $response->assertStatus(400);
    }

    /** @test */
    public function publish_rejects_invalid_test_type()
    {
        $exam = $this->createIeltsDraft('listening');
        $response = $this->withHeaders($this->authHeader())
            ->postJson("/api/teacher/exams/{$exam->eId}/ielts/publish", [
                'ielts_test_type' => 'INVALID',
                'ielts_skill' => 'listening',
                'ielts_data' => ['sections' => []],
            ]);
        $response->assertStatus(400);
    }

    /** @test */
    public function publish_returns_404_for_foreign_exam()
    {
        $other = User::factory()->teacher()->create();
        $exam = Exam::create([
            'eTitle' => 'Foreign',
            'eType' => 'IELTS',
            'eSkill' => 'listening',
            'eDuration_minutes' => 40,
            'eTeacher_id' => $other->uId,
            'ielts_skill' => 'listening',
            'ielts_test_type' => 'Academic',
            'eStatus' => 'draft',
        ]);

        $response = $this->withHeaders($this->authHeader())
            ->postJson("/api/teacher/exams/{$exam->eId}/ielts/publish", [
                'ielts_test_type' => 'Academic',
                'ielts_skill' => 'listening',
                'ielts_data' => ['sections' => [['sectionNumber' => 1, 'questions' => []]]],
            ]);
        $response->assertStatus(404);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  publish — idempotency
    // ─────────────────────────────────────────────────────────────────────

    /** @test */
    public function publishing_twice_does_not_create_duplicate_blocks()
    {
        $exam = $this->createIeltsDraft('writing');
        $payload = [
            'ielts_test_type' => 'Academic',
            'ielts_skill' => 'writing',
            'ielts_data' => [
                'tasks' => [
                    ['taskNumber' => 1, 'prompt' => 'P1', 'chartType' => 'bar'],
                    ['taskNumber' => 2, 'prompt' => 'P2', 'essayType' => 'opinion'],
                ],
            ],
            'play_modes' => ['practice_enabled' => true, 'full_test_enabled' => true],
        ];

        $this->withHeaders($this->authHeader())
            ->postJson("/api/teacher/exams/{$exam->eId}/ielts/publish", $payload)
            ->assertStatus(200);

        $this->withHeaders($this->authHeader())
            ->postJson("/api/teacher/exams/{$exam->eId}/ielts/publish", $payload)
            ->assertStatus(200);

        $exam->refresh();
        $this->assertSame(2, $exam->contentBlocks->count(), 'Re-publish must clear-and-rebuild');
        $this->assertSame(2, $exam->questions->count());
    }

    // ─────────────────────────────────────────────────────────────────────
    //  Helpers
    // ─────────────────────────────────────────────────────────────────────

    private function createIeltsDraft(string $skill): Exam
    {
        $response = $this->withHeaders($this->authHeader())
            ->postJson('/api/teacher/exams/ielts', [
                'eTitle' => "IELTS draft - {$skill}",
                'ielts_test_type' => 'Academic',
                'ielts_skill' => $skill,
            ]);
        $response->assertStatus(200);
        return Exam::find($response->json('data.eId'));
    }
}

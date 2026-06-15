<?php

namespace App\Services;

use App\Models\Exam;
use App\Models\Question;
use App\Models\Answer;

class IELTSService
{
    /**
     * Get IELTS standard structure (Official format 2024)
     */
    public static function getStandardStructure()
    {
        return [
            'listening' => [
                'duration' => 30, // + 10 minutes transfer time = 40 total
                'total_questions' => 40,
                'parts' => [
                    [
                        'part' => 1,
                        'name' => 'Social Context - Conversation',
                        'questions' => 10,
                        'description' => 'Conversation between two people in everyday social context (e.g. booking accommodation)',
                        'context' => 'social',
                        'speakers' => 2,
                        'question_types' => ['form_completion', 'note_completion', 'table_completion', 'short_answer']
                    ],
                    [
                        'part' => 2,
                        'name' => 'Social Context - Monologue',
                        'questions' => 10,
                        'description' => 'Monologue in everyday social context (e.g. speech about local facilities, guided tour)',
                        'context' => 'social',
                        'speakers' => 1,
                        'question_types' => ['multiple_choice', 'matching', 'plan_map_diagram_labelling', 'form_completion']
                    ],
                    [
                        'part' => 3,
                        'name' => 'Educational Context - Conversation',
                        'questions' => 10,
                        'description' => 'Conversation between up to 4 people in educational/training context (e.g. student discussion)',
                        'context' => 'educational',
                        'speakers' => '2-4',
                        'question_types' => ['multiple_choice', 'matching', 'flow_chart_completion', 'sentence_completion']
                    ],
                    [
                        'part' => 4,
                        'name' => 'Academic Context - Lecture',
                        'questions' => 10,
                        'description' => 'Monologue on academic subject (e.g. university lecture, academic presentation)',
                        'context' => 'academic',
                        'speakers' => 1,
                        'question_types' => ['sentence_completion', 'summary_completion', 'note_completion', 'multiple_choice']
                    ]
                ]
            ],
            'reading' => [
                'academic' => [
                    'duration' => 60,
                    'total_questions' => 40,
                    'passages' => 3,
                    'parts' => [
                        [
                            'passage' => 1,
                            'name' => 'Passage 1',
                            'questions' => [13, 14], // Usually 13-14 questions
                            'description' => 'Text from books, journals, magazines, newspapers for general interest',
                            'word_count' => [750, 900],
                            'difficulty' => 'easier',
                            'topics' => ['general_interest', 'factual', 'descriptive']
                        ],
                        [
                            'passage' => 2,
                            'name' => 'Passage 2',
                            'questions' => [13, 14],
                            'description' => 'Text related to work issues (training manuals, job descriptions, staff development)',
                            'word_count' => [750, 900],
                            'difficulty' => 'medium',
                            'topics' => ['work_related', 'training', 'professional']
                        ],
                        [
                            'passage' => 3,
                            'name' => 'Passage 3',
                            'questions' => [13, 14],
                            'description' => 'Text on academic topics suitable for undergraduate students',
                            'word_count' => [750, 900],
                            'difficulty' => 'harder',
                            'topics' => ['academic', 'research', 'analytical']
                        ]
                    ],
                    'question_types' => [
                        'multiple_choice',
                        'identifying_information', // True/False/Not Given
                        'identifying_writers_views', // Yes/No/Not Given
                        'matching_information',
                        'matching_headings',
                        'matching_features',
                        'matching_sentence_endings',
                        'sentence_completion',
                        'summary_completion',
                        'note_completion',
                        'table_completion',
                        'flow_chart_completion',
                        'diagram_label_completion',
                        'short_answer'
                    ]
                ],
                'general' => [
                    'duration' => 60,
                    'total_questions' => 40,
                    'sections' => 3,
                    'parts' => [
                        [
                            'section' => 1,
                            'name' => 'Social Survival',
                            'questions' => 14,
                            'description' => 'Texts relevant to basic linguistic survival in English-speaking countries',
                            'text_types' => ['advertisements', 'notices', 'timetables', 'brochures', 'leaflets'],
                            'difficulty' => 'easier',
                            'context' => 'everyday_life'
                        ],
                        [
                            'section' => 2,
                            'name' => 'Workplace Survival',
                            'questions' => 13,
                            'description' => 'Texts related to workplace survival in English-speaking countries',
                            'text_types' => ['job_descriptions', 'contracts', 'training_materials', 'staff_handbooks'],
                            'difficulty' => 'medium',
                            'context' => 'workplace'
                        ],
                        [
                            'section' => 3,
                            'name' => 'General Reading',
                            'questions' => 13,
                            'description' => 'More complex and lengthy texts on topics of general interest',
                            'text_types' => ['newspapers', 'magazines', 'books', 'reports'],
                            'difficulty' => 'harder',
                            'context' => 'general_interest'
                        ]
                    ],
                    'question_types' => [
                        'multiple_choice',
                        'identifying_information', // True/False/Not Given
                        'matching_information',
                        'matching_headings',
                        'sentence_completion',
                        'summary_completion',
                        'short_answer',
                        'table_completion',
                        'note_completion'
                    ]
                ]
            ],
            'writing' => [
                'academic' => [
                    'duration' => 60,
                    'total_tasks' => 2,
                    'tasks' => [
                        [
                            'task' => 1,
                            'name' => 'Academic Task 1 - Data Description',
                            'description' => 'Describe, summarise or explain visual information (graph, table, chart, diagram, map, process)',
                            'min_words' => 150,
                            'suggested_time' => 20,
                            'weight' => 33.33, // 1/3 of writing score
                            'type' => 'ielts_academic_task1',
                            'visual_types' => ['line_graph', 'bar_chart', 'pie_chart', 'table', 'diagram', 'map', 'process', 'multiple_charts']
                        ],
                        [
                            'task' => 2,
                            'name' => 'Academic Task 2 - Essay',
                            'description' => 'Write an essay in response to point of view, argument or problem (discursive essay)',
                            'min_words' => 250,
                            'suggested_time' => 40,
                            'weight' => 66.67, // 2/3 of writing score
                            'type' => 'ielts_academic_task2',
                            'essay_types' => ['opinion', 'discussion', 'problem_solution', 'advantages_disadvantages', 'two_part_question']
                        ]
                    ]
                ],
                'general' => [
                    'duration' => 60,
                    'total_tasks' => 2,
                    'tasks' => [
                        [
                            'task' => 1,
                            'name' => 'General Task 1 - Letter Writing',
                            'description' => 'Write a letter requesting information or explaining a situation (personal, semi-formal or formal)',
                            'min_words' => 150,
                            'suggested_time' => 20,
                            'weight' => 33.33,
                            'type' => 'ielts_general_task1',
                            'letter_types' => ['personal', 'semi_formal', 'formal'],
                            'purposes' => ['complaint', 'request', 'apology', 'invitation', 'application', 'explanation']
                        ],
                        [
                            'task' => 2,
                            'name' => 'General Task 2 - Essay',
                            'description' => 'Write an essay in response to point of view, argument or problem (same as Academic)',
                            'min_words' => 250,
                            'suggested_time' => 40,
                            'weight' => 66.67,
                            'type' => 'ielts_general_task2',
                            'essay_types' => ['opinion', 'discussion', 'problem_solution', 'advantages_disadvantages']
                        ]
                    ]
                ]
            ],
            'speaking' => [
                'duration' => [11, 14], // 11-14 minutes total
                'total_parts' => 3,
                'format' => 'face_to_face_interview',
                'parts' => [
                    [
                        'part' => 1,
                        'name' => 'Introduction and Interview',
                        'duration' => [4, 5],
                        'description' => 'General questions about yourself, home, family, work, studies and familiar topics',
                        'type' => 'ielts_speaking_part1',
                        'question_count' => [4, 6],
                        'topics' => ['home_accommodation', 'family', 'work_studies', 'interests_hobbies', 'hometown', 'daily_routine'],
                        'question_style' => 'short_answers'
                    ],
                    [
                        'part' => 2,
                        'name' => 'Long Turn (Cue Card)',
                        'duration' => [3, 4],
                        'description' => 'Speak for 1-2 minutes on a given topic after 1 minute preparation time',
                        'type' => 'ielts_speaking_part2',
                        'preparation_time' => 60, // 1 minute
                        'speaking_time' => [60, 120], // 1-2 minutes
                        'follow_up_questions' => [1, 2],
                        'cue_card_structure' => [
                            'main_topic',
                            'bullet_points_4',
                            'explain_why_important'
                        ]
                    ],
                    [
                        'part' => 3,
                        'name' => 'Two-way Discussion',
                        'duration' => [4, 5],
                        'description' => 'Discussion of more abstract ideas and issues related to Part 2 topic',
                        'type' => 'ielts_speaking_part3',
                        'question_types' => ['opinion', 'speculation', 'comparison', 'evaluation', 'analysis'],
                        'complexity' => 'abstract_conceptual',
                        'question_style' => 'extended_answers'
                    ]
                ]
            ]
        ];
    }

    /**
     * Get IELTS band scores (0-9 scale)
     */
    public static function getBandDescriptors()
    {
        return [
            9 => ['level' => 'Expert User', 'description' => 'Fully operational command of the language'],
            8 => ['level' => 'Very Good User', 'description' => 'Fully operational command with occasional inaccuracies'],
            7 => ['level' => 'Good User', 'description' => 'Operational command with occasional inaccuracies'],
            6 => ['level' => 'Competent User', 'description' => 'Generally effective command despite inaccuracies'],
            5 => ['level' => 'Modest User', 'description' => 'Partial command, copes with overall meaning'],
            4 => ['level' => 'Limited User', 'description' => 'Basic competence limited to familiar situations'],
            3 => ['level' => 'Extremely Limited User', 'description' => 'Conveys general meaning in familiar situations'],
            2 => ['level' => 'Intermittent User', 'description' => 'Great difficulty understanding spoken and written English'],
            1 => ['level' => 'Non User', 'description' => 'Essentially no ability to use the language'],
            0 => ['level' => 'Did not attempt', 'description' => 'No assessable information provided']
        ];
    }

    /**
     * Calculate IELTS overall band score
     */
    public static function calculateOverallBand($sectionScores)
    {
        // IELTS uses 0-9 band scale
        // Overall band = average of 4 skills, rounded to nearest 0.5
        $totalScore = 0;
        $sectionCount = 0;

        foreach ($sectionScores as $section => $score) {
            $totalScore += $score;
            $sectionCount++;
        }

        if ($sectionCount === 0) return 0;

        $averageScore = $totalScore / $sectionCount;
        
        // Round to nearest 0.5
        $overallBand = round($averageScore * 2) / 2;
        
        // Ensure within valid range
        $overallBand = max(0, min(9, $overallBand));

        return [
            'overall_band' => $overallBand,
            'section_scores' => $sectionScores,
            'band_descriptor' => self::getBandDescriptors()[$overallBand] ?? null
        ];
    }

    /**
     * Validate IELTS exam structure
     */
    public static function validateExamStructure(Exam $exam, $version = 'academic')
    {
        $errors = [];
        $structure = self::getStandardStructure();

        if (!in_array($exam->eType, ['IELTS', 'IELTS_ACADEMIC', 'IELTS_GENERAL'])) {
            return ['This is not an IELTS exam'];
        }

        // Check total duration (165 minutes = 30+60+60+15)
        $totalDuration = $exam->eDuration_minutes;
        $expectedDuration = 165;
        
        if ($totalDuration !== $expectedDuration) {
            $errors[] = "Total duration should be {$expectedDuration} minutes, got {$totalDuration}";
        }

        // Check questions by section
        $questionsBySection = $exam->questions->groupBy('qSection');
        
        // Listening validation
        $listeningQuestions = $questionsBySection->get('Listening', collect());
        if ($listeningQuestions->count() !== 40) {
            $errors[] = "Listening should have 40 questions, got " . $listeningQuestions->count();
        }

        // Reading validation
        $readingQuestions = $questionsBySection->get('Reading', collect());
        if ($readingQuestions->count() !== 40) {
            $errors[] = "Reading should have 40 questions, got " . $readingQuestions->count();
        }

        // Writing validation
        $writingQuestions = $questionsBySection->get('Writing', collect());
        if ($writingQuestions->count() !== 2) {
            $errors[] = "Writing should have 2 tasks, got " . $writingQuestions->count();
        }

        // Speaking validation
        $speakingQuestions = $questionsBySection->get('Speaking', collect());
        if ($speakingQuestions->count() !== 3) {
            $errors[] = "Speaking should have 3 parts, got " . $speakingQuestions->count();
        }

        return $errors;
    }

    /**
     * Get sample questions for IELTS sections
     */
    public static function getSampleQuestions($section, $part = null, $version = 'academic')
    {
        $samples = [
            'listening' => [
                'part1' => [
                    'content' => 'You will hear a conversation between a customer and a travel agent.',
                    'audio_script' => 'Customer: I\'d like to book a holiday to Australia. Agent: Certainly, when would you like to travel?',
                    'question_type' => 'form_completion',
                    'questions' => [
                        'Destination: ________',
                        'Departure date: ________',
                        'Number of passengers: ________'
                    ]
                ],
                'part2' => [
                    'content' => 'You will hear a talk about a local museum.',
                    'question_type' => 'multiple_choice',
                    'questions' => [
                        'The museum is open: A) Every day B) Weekdays only C) Weekends only'
                    ]
                ]
            ],
            'reading' => [
                'academic' => [
                    'passage' => 'Climate change represents one of the most significant challenges facing humanity in the 21st century...',
                    'questions' => [
                        ['type' => 'multiple_choice', 'question' => 'The main cause of climate change is:'],
                        ['type' => 'true_false_not_given', 'question' => 'All scientists agree on climate change causes.'],
                        ['type' => 'matching_headings', 'question' => 'Match the heading to paragraph B.']
                    ]
                ],
                'general' => [
                    'text' => 'LIBRARY OPENING HOURS: Monday-Friday: 9am-8pm, Saturday: 9am-5pm, Sunday: Closed',
                    'questions' => [
                        ['type' => 'multiple_choice', 'question' => 'When is the library closed?'],
                        ['type' => 'short_answer', 'question' => 'What time does the library close on Friday?']
                    ]
                ]
            ],
            'writing' => [
                'academic_task1' => [
                    'prompt' => 'The chart below shows the percentage of households in owned and rented accommodation in England and Wales between 1918 and 2011. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
                    'type' => 'chart_description',
                    'min_words' => 150
                ],
                'academic_task2' => [
                    'prompt' => 'Some people think that universities should provide graduates with the knowledge and skills needed in the workplace. Others think that the true function of a university should be to give access to knowledge for its own sake, regardless of whether the course is useful to an employer. What, in your opinion, should be the main function of a university?',
                    'type' => 'argumentative_essay',
                    'min_words' => 250
                ],
                'general_task1' => [
                    'prompt' => 'You recently bought a piece of equipment for your kitchen but it did not work. You phoned the shop but no action was taken. Write a letter to the shop manager.',
                    'type' => 'formal_letter',
                    'min_words' => 150
                ]
            ],
            'speaking' => [
                'part1' => [
                    'topics' => ['Work/Studies', 'Hometown', 'Accommodation'],
                    'sample_questions' => [
                        'What do you do? Do you work or are you a student?',
                        'Where are you from?',
                        'Do you live in a house or apartment?'
                    ]
                ],
                'part2' => [
                    'cue_card' => 'Describe a memorable journey you have made.',
                    'points' => [
                        'Where you went',
                        'How you travelled',
                        'Who you went with',
                        'And explain why this journey was memorable'
                    ],
                    'preparation_time' => 60,
                    'speaking_time' => 120
                ],
                'part3' => [
                    'topic' => 'Travel and Tourism',
                    'sample_questions' => [
                        'How has travel changed in recent years?',
                        'What are the benefits of international travel?',
                        'Do you think space tourism will become popular?'
                    ]
                ]
            ]
        ];

        return $samples[$section] ?? [];
    }

    /**
     * Get IELTS question types by section
     */
    public static function getQuestionTypes()
    {
        return [
            'listening' => [
                'form_completion',
                'note_completion', 
                'table_completion',
                'flow_chart_completion',
                'summary_completion',
                'sentence_completion',
                'multiple_choice',
                'matching',
                'plan_map_diagram_labelling',
                'short_answer'
            ],
            'reading' => [
                'multiple_choice',
                'identifying_information', // True/False/Not Given
                'identifying_writers_views', // Yes/No/Not Given
                'matching_information',
                'matching_headings',
                'matching_features',
                'matching_sentence_endings',
                'sentence_completion',
                'summary_completion',
                'note_completion',
                'table_completion',
                'flow_chart_completion',
                'diagram_label_completion',
                'short_answer'
            ],
            'writing' => [
                'ielts_academic_task1', // Charts, graphs, diagrams
                'ielts_academic_task2', // Essay
                'ielts_general_task1',  // Letter
                'ielts_general_task2'   // Essay
            ],
            'speaking' => [
                'ielts_speaking_part1', // Introduction & Interview
                'ielts_speaking_part2', // Long Turn
                'ielts_speaking_part3'  // Discussion
            ]
        ];
    }

    /**
     * Parse and publish IELTS exam data into content_blocks, questions, and answers tables.
     * Ensure SOLID principles, DRY, and proper error handling.
     *
     * @param Exam $exam
     * @param string $testType
     * @param array $data
     * @return array
     * @throws \Exception
     */
    public static function publishIeltsExam(Exam $exam, string $testType, array $data)
    {
        return \Illuminate\Support\Facades\DB::transaction(function () use ($exam, $testType, $data) {
            try {
                self::clearExistingExamData($exam);
                self::updateExamMetadata($exam, $testType, $data);

                $total = 0;
                $total += self::saveListeningSections($exam, $data['listening']['sections'] ?? []);
                $total += self::saveReadingPassages($exam, $data['reading']['passages'] ?? []);
                $total += self::saveWritingTasks($exam, $data['writing']['tasks'] ?? []);
                $total += self::saveSpeakingParts($exam, $data['speaking']['parts'] ?? []);

                return [
                    'success' => true,
                    'total_questions' => $total,
                ];
            } catch (\Throwable $e) {
                \Log::error('IELTSService::publishIeltsExam failed', [
                    'exam_id' => $exam->eId,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
                // Re-throw so DB::transaction rolls back, controller can format response
                throw $e;
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Configuration constants (DRY)
    // ─────────────────────────────────────────────────────────────────────

    /** Map frontend kebab-case question types to DB snake_case enums */
    private const QUESTION_TYPE_MAP = [
        'multiple-choice'        => 'multiple_choice',
        'fill-in-the-blank'      => 'fill_blank',
        'fill-blank'             => 'fill_blank',
        'true-false-not-given'   => 'true_false_not_given',
        'yes-no-not-given'       => 'yes_no_not_given',
        'short-answer'           => 'short_answer',
        'sentence-completion'    => 'sentence_completion',
        'summary-completion'     => 'summary_completion',
        'matching-headings'      => 'matching_headings',
        'matching-information'   => 'matching_information',
        'matching-features'      => 'matching_features',
        'matching-sentence-endings' => 'matching_sentence_endings',
        'note-completion'        => 'note_completion',
        'form-completion'        => 'form_completion',
        'table-completion'       => 'table_completion',
        'flow-chart-completion'  => 'flow_chart_completion',
        'diagram-labelling'      => 'diagram_labelling',
        'plan-map-diagram'       => 'plan_map_diagram',
        'matching'               => 'matching',
    ];

    /** Writing task config (min words, recommended minutes) by task number */
    private const WRITING_TASK_CONFIG = [
        1 => ['min_words' => 150, 'minutes' => 20],
        2 => ['min_words' => 250, 'minutes' => 40],
    ];

    /** MCQ option letters */
    private const MCQ_LETTERS = ['A', 'B', 'C', 'D'];

    // ─────────────────────────────────────────────────────────────────────
    // Pre-publish cleanup & metadata update (SRP)
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Remove existing content blocks, questions, answers so we can rebuild
     * from scratch. This is destructive and runs inside the publish transaction.
     */
    private static function clearExistingExamData(Exam $exam): void
    {
        $exam->contentBlocks()->delete();
        foreach ($exam->questions as $q) {
            $q->answers()->delete();
            $q->delete();
        }
    }

    /**
     * Persist IELTS metadata + flip exam to published state.
     */
    private static function updateExamMetadata(Exam $exam, string $testType, array $data): void
    {
        $moderationStatus = Exam::resolveModerationStatus();
        $exam->update([
            'ielts_test_type' => $testType,
            'ielts_config'    => $data,
            'eStatus'         => $moderationStatus,
            'eIs_private'     => $moderationStatus !== 'published',
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Skill-specific savers (one method per skill — Open/Closed)
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Save 4 listening sections (each with audio + transcript + 10 MCQs typically).
     * Returns number of questions saved.
     */
    private static function saveListeningSections(Exam $exam, array $sections): int
    {
        $count = 0;
        foreach ($sections as $section) {
            $sectionNumber = (int) ($section['sectionNumber'] ?? 1);
            $sectionTitle  = (string) ($section['sectionTitle'] ?? ($section['sectionName'] ?? ''));
            $sectionInstruction = (string) ($section['sectionInstruction'] ?? ($section['instructions'] ?? ''));

            $block = \App\Models\ContentBlock::create([
                'exam_id'       => $exam->eId,
                'block_type'    => 'audio',
                'content'       => $section['audioUrl'] ?? '',
                'metadata'      => [
                    'section_number' => $sectionNumber,
                    'section_title'  => $sectionTitle,
                    'instructions'   => $sectionInstruction,
                    'audio_filename' => $section['audioFileName'] ?? '',
                    'transcript'     => $section['transcript'] ?? '',
                ],
                'display_order' => $sectionNumber,
            ]);

            $count += self::saveQuestionsForBlock(
                $exam,
                $block,
                $section['questions'] ?? [],
                'listening',
                'listening',
                $sectionNumber,
                $sectionTitle
            );
        }
        return $count;
    }

    /**
     * Save 3 reading passages (each with body + 13–14 questions of mixed types).
     */
    private static function saveReadingPassages(Exam $exam, array $passages): int
    {
        $count = 0;
        foreach ($passages as $passage) {
            $passageNumber = (int) ($passage['passageNumber'] ?? 1);

            $block = \App\Models\ContentBlock::create([
                'exam_id'       => $exam->eId,
                'block_type'    => 'passage',
                'content'       => $passage['body'] ?? '',
                'metadata'      => [
                    'part_number'    => $passageNumber,
                    'part_name'      => "Passage {$passageNumber}",
                    'passage_title'  => $passage['title'] ?? '',
                    'word_count'     => (int) ($passage['wordCount'] ?? 0),
                ],
                'display_order' => $passageNumber,
            ]);

            $count += self::saveQuestionsForBlock(
                $exam,
                $block,
                $passage['questions'] ?? [],
                'reading',
                'Reading',
                $passageNumber
            );
        }
        return $count;
    }

    /**
     * Save 2 writing tasks (Task 1 + Task 2). Each task = 1 question of type 'essay'.
     */
    private static function saveWritingTasks(Exam $exam, array $tasks): int
    {
        $count = 0;
        foreach ($tasks as $task) {
            $taskNumber = (int) ($task['taskNumber'] ?? 1);
            $config = self::WRITING_TASK_CONFIG[$taskNumber] ?? self::WRITING_TASK_CONFIG[2];

            $block = \App\Models\ContentBlock::create([
                'exam_id'       => $exam->eId,
                'block_type'    => 'instruction',
                'content'       => $task['prompt'] ?? '',
                'metadata'      => [
                    'part_number'    => $taskNumber,
                    'part_name'      => "Task {$taskNumber}",
                    'image_url'      => $task['imageUrl'] ?? null,
                    'image_filename' => $task['imageFileName'] ?? null,
                    'tone'           => $task['tone'] ?? null,
                    'chart_type'     => $task['chartType'] ?? null,
                    'essay_type'     => $task['essayType'] ?? null,
                    'model_answer'   => $task['modelAnswer'] ?? null,
                ],
                'display_order' => $taskNumber,
            ]);

            Question::create([
                'exam_id'          => $exam->eId,
                'content_block_id' => $block->id,
                'qContent'         => "IELTS Writing Task {$taskNumber}",
                'qType'            => 'essay',
                'qSkill'           => 'writing',
                'qSection'         => 'Writing',
                'qPart'            => $taskNumber,
                'qSection_order'   => $taskNumber,
                'qPoints'          => 9,
                'qData'            => [
                    'task_number'         => $taskNumber,
                    'min_words'           => $config['min_words'],
                    'recommended_minutes' => $config['minutes'],
                    'tone'                => $task['tone'] ?? null,
                    'chart_type'          => $task['chartType'] ?? null,
                    'essay_type'          => $task['essayType'] ?? null,
                    'model_answer'        => $task['modelAnswer'] ?? null,
                ],
            ]);
            $count++;
        }
        return $count;
    }

    /**
     * Save 3 speaking parts (Interview / Long turn / Discussion).
     * Part 1 & 3: list of questions. Part 2: cue card stored as single question.
     */
    private static function saveSpeakingParts(Exam $exam, array $parts): int
    {
        $count = 0;
        foreach ($parts as $part) {
            $partNumber = (int) ($part['partNumber'] ?? 1);
            $cueCard    = $part['cueCard'] ?? null;
            $isCueCardPart = ($partNumber === 2 && is_array($cueCard));

            $block = \App\Models\ContentBlock::create([
                'exam_id'       => $exam->eId,
                'block_type'    => 'instruction',
                'content'       => $isCueCardPart
                    ? (string) ($cueCard['topic'] ?? '')
                    : "IELTS Speaking Part {$partNumber}",
                'metadata'      => [
                    'part_number' => $partNumber,
                    'part_name'   => "Part {$partNumber}",
                    'cue_card'    => $cueCard,
                ],
                'display_order' => $partNumber,
            ]);

            if ($isCueCardPart) {
                Question::create([
                    'exam_id'          => $exam->eId,
                    'content_block_id' => $block->id,
                    'qContent'         => (string) ($cueCard['topic'] ?? ''),
                    'qType'            => 'speaking',
                    'qSkill'           => 'speaking',
                    'qSection'         => 'Speaking',
                    'qPart'            => 2,
                    'qSection_order'   => 1,
                    'qPoints'          => 9,
                    'qData'            => [
                        'part_number' => 2,
                        'cue_card'    => $cueCard,
                    ],
                ]);
                $count++;
                continue;
            }

            // Part 1 / Part 3: regular question list
            $questions = $part['questions'] ?? [];
            foreach ($questions as $idx => $qVal) {
                $qText = trim((string) ($qVal['text'] ?? ''));
                if ($qText === '') continue;

                Question::create([
                    'exam_id'          => $exam->eId,
                    'content_block_id' => $block->id,
                    'qContent'         => $qText,
                    'qType'            => 'speaking',
                    'qSkill'           => 'speaking',
                    'qSection'         => 'Speaking',
                    'qPart'            => $partNumber,
                    'qSection_order'   => $idx + 1,
                    'qPoints'          => 9,
                    'qData'            => [
                        'part_number' => $partNumber,
                        'topic'       => $qVal['topic'] ?? null,
                    ],
                ]);
                $count++;
            }
        }
        return $count;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Generic question persister (shared by Listening + Reading) — DRY
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Persist a list of objective questions (MCQ / TFNG / fill-blank / etc.)
     * tied to a content block. Used by both Listening and Reading.
     */
    private static function saveQuestionsForBlock(
        Exam $exam,
        \App\Models\ContentBlock $block,
        array $questions,
        string $skill,
        string $sectionName,
        int $partNumber,
        string $sectionTitle = ''
    ): int {
        $count = 0;
        foreach ($questions as $qVal) {
            $qNum   = (int) ($qVal['questionNumber'] ?? 1);
            $rawType = (string) ($qVal['questionType'] ?? 'multiple-choice');
            $qType  = self::normalizeQuestionType($rawType);
            $qText  = (string) ($qVal['questionText'] ?? '');
            $options = $qVal['options'] ?? null;
            $correctAnswer = (string) ($qVal['correctAnswer'] ?? '');
            // Optional shared task metadata (for grouped questions in IELTS Listening/Reading)
            $taskTitle = (string) ($qVal['taskTitle'] ?? '');
            $taskInstruction = (string) ($qVal['taskInstruction'] ?? '');
            // IELTS-specific: giới hạn từ (completion) + số đáp án cần chọn (Choose TWO…)
            $wordLimit = (string) ($qVal['wordLimit'] ?? '');
            $selectCount = (int) ($qVal['selectCount'] ?? 1);
            $useWordBank = (bool) ($qVal['useWordBank'] ?? false);
            // Image-completion: shared group image URL
            $taskImage = (string) ($qVal['taskImage'] ?? '');
            $taskImageFileName = (string) ($qVal['taskImageFileName'] ?? '');

            $question = Question::create([
                'exam_id'          => $exam->eId,
                'content_block_id' => $block->id,
                'qContent'         => $qText,
                'qType'            => $qType,
                'qSkill'           => $skill,
                'qSection'         => $sectionName,
                'qPart'            => $partNumber,
                'qSection_order'   => $qNum,
                'qPoints'          => 1,
                'qData'            => array_filter([
                    'question_number'     => $qNum,
                    'options'             => $options,
                    'correct_answer'      => $correctAnswer,
                    'section_title'       => $sectionTitle !== '' ? $sectionTitle : null,
                    'task_title'          => $taskTitle !== '' ? $taskTitle : null,
                    'task_instruction'    => $taskInstruction !== '' ? $taskInstruction : null,
                    'word_limit'          => $wordLimit !== '' ? $wordLimit : null,
                    'select_count'        => $selectCount > 1 ? $selectCount : null,
                    'use_word_bank'       => $useWordBank ? true : null,
                    'task_image'          => $taskImage !== '' ? $taskImage : null,
                    'task_image_file_name'=> $taskImageFileName !== '' ? $taskImageFileName : null,
                ], fn ($v) => $v !== null),
            ]);

            self::createAnswersForQuestion($question, $qType, $options, $correctAnswer);
            $count++;
        }
        return $count;
    }

    /**
     * Create Answer rows for a question. MCQ → 4 rows (A/B/C/D); other types → 1 row.
     */
    private static function createAnswersForQuestion(
        Question $question,
        string $qType,
        $options,
        string $correctAnswer
    ): void {
        // Multi-select MCQ ("A,C") → 1 row gộp, chấm theo tập hợp ở gradeAnswers.
        if ($qType === 'multiple_choice' && strpos($correctAnswer, ',') !== false) {
            Answer::create([
                'question_id' => $question->qId,
                'aContent'    => strtoupper(str_replace(' ', '', $correctAnswer)),
                'aIs_correct' => true,
            ]);
            return;
        }

        if ($qType === 'multiple_choice' && is_array($options)) {
            foreach (self::MCQ_LETTERS as $idx => $letter) {
                Answer::create([
                    'question_id' => $question->qId,
                    'aContent'    => (string) ($options[$letter] ?? ''),
                    'aIs_correct' => (strtoupper($correctAnswer) === $letter),
                ]);
            }
            return;
        }

        Answer::create([
            'question_id' => $question->qId,
            'aContent'    => $correctAnswer,
            'aIs_correct' => true,
        ]);
    }

    /**
     * Normalize frontend question type slug → DB enum value.
     * Falls back to original (lowercased, hyphens→underscores) when unmapped.
     */
    private static function normalizeQuestionType(string $rawType): string
    {
        $key = strtolower(trim($rawType));
        if (isset(self::QUESTION_TYPE_MAP[$key])) {
            return self::QUESTION_TYPE_MAP[$key];
        }
        // Generic fallback: kebab → snake
        return str_replace('-', '_', $key);
    }
}
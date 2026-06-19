<?php

namespace App\Services;

use App\Models\Exam;
use App\Models\Question;
use App\Models\Answer;
use App\Models\PracticeSession;
use App\Models\QuestionBank;
use App\Models\ExamTemplate;
use Illuminate\Support\Facades\DB;

class PracticeService
{
    /**
     * Tạo bài ôn tập theo chủ đề
     */
    public static function createTopicBasedPractice($data)
    {
        DB::beginTransaction();
        
        try {
            // Tạo practice session
            $practiceSession = PracticeSession::create([
                'ps_title' => $data['title'],
                'ps_description' => $data['description'] ?? null,
                'ps_type' => 'topic_based',
                'ps_purpose' => $data['purpose'] ?? 'practice',
                'ps_target_skill' => $data['skill'],
                'ps_topic' => $data['topic'],
                'ps_difficulty' => $data['difficulty'] ?? 'medium',
                'ps_duration_minutes' => $data['duration'] ?? 30,
                'ps_question_count' => $data['question_count'] ?? 10,
                'ps_teacher_id' => $data['teacher_id'],
                'ps_config' => $data['config'] ?? null,
            ]);

            // Tạo exam tương ứng
            $exam = Exam::create([
                'eTitle' => $data['title'],
                'eDescription' => $data['description'] ?? null,
                'eType' => $data['exam_type'] ?? 'GENERAL',
                'eSkill' => $data['skill'],
                'eScope' => 'skill',
                'ePurpose' => $data['purpose'] ?? 'practice',
                'eTopic' => $data['topic'],
                'eDifficulty' => $data['difficulty'] ?? 'medium',
                'eTeacher_id' => $data['teacher_id'],
                'eDuration_minutes' => $data['duration'] ?? 30,
                'eIs_private' => $data['is_private'] ?? true,
                'eSource_type' => 'template',
            ]);

            // Cập nhật practice session với exam_id
            $practiceSession->update(['ps_exam_id' => $exam->eId]);

            // Tạo câu hỏi dựa trên chủ đề
            $questions = self::generateQuestionsByTopic($data);
            self::addQuestionsToExam($exam->eId, $questions);

            DB::commit();

            return [
                'practice_session' => $practiceSession,
                'exam' => $exam,
                'questions_count' => count($questions)
            ];

        } catch (\Exception $e) {
            DB::rollback();
            throw $e;
        }
    }

    /**
     * Tạo bài ôn từ template
     */
    public static function createTemplateBasedPractice($data)
    {
        DB::beginTransaction();
        
        try {
            $template = ExamTemplate::findOrFail($data['template_id']);
            
            $practiceSession = PracticeSession::create([
                'ps_title' => $data['title'] ?? "Ôn tập {$template->template_name}",
                'ps_description' => $data['description'] ?? "Bài ôn tập dựa trên template {$template->template_name}",
                'ps_type' => 'template_based',
                'ps_purpose' => $data['purpose'] ?? 'practice',
                'ps_target_skill' => $data['skill'] ?? 'listening',
                'ps_difficulty' => $data['difficulty'] ?? 'medium',
                'ps_duration_minutes' => $data['duration'] ?? $template->total_duration_minutes,
                'ps_question_count' => $data['question_count'] ?? 20,
                'ps_teacher_id' => $data['teacher_id'],
                'ps_config' => array_merge($data['config'] ?? [], ['template_id' => $template->id]),
            ]);

            // Tạo exam từ template
            // Map template_code to valid eType enum
            $validTypes = ['VSTEP', 'IELTS', 'GENERAL', 'STARTERS', 'MOVERS', 'FLYERS', 'KET', 'PET', 'FCE', 'CAE', 'CPE', 'TOEFL_IBT', 'PTE_ACADEMIC', 'APTIS'];
            $templateCode = strtoupper(explode('_', $template->template_code)[0]);
            $eType = in_array($templateCode, $validTypes) ? $templateCode : 'GENERAL';

            $exam = Exam::create([
                'template_id' => $template->id,
                'eTitle' => $practiceSession->ps_title,
                'eDescription' => $practiceSession->ps_description,
                'eType' => $eType,
                'eSkill' => $data['skill'] ?? 'listening',
                'eScope' => 'skill',
                'ePurpose' => 'practice',
                'eDifficulty' => $data['difficulty'] ?? 'medium',
                'eTeacher_id' => $data['teacher_id'],
                'eDuration_minutes' => $practiceSession->ps_duration_minutes,
                'eIs_private' => true,
                'eSource_type' => 'template',
            ]);

            $practiceSession->update(['ps_exam_id' => $exam->eId]);

            // Tạo câu hỏi từ template
            $questions = self::generateQuestionsFromTemplate($template, $data);
            self::addQuestionsToExam($exam->eId, $questions);

            DB::commit();

            return [
                'practice_session' => $practiceSession,
                'exam' => $exam,
                'template' => $template,
                'questions_count' => count($questions)
            ];

        } catch (\Exception $e) {
            DB::rollback();
            throw $e;
        }
    }

    /**
     * Tạo bài ôn ngẫu nhiên
     */
    public static function createRandomPractice($data)
    {
        DB::beginTransaction();
        
        try {
            $practiceSession = PracticeSession::create([
                'ps_title' => $data['title'] ?? 'Bài ôn tập ngẫu nhiên',
                'ps_description' => $data['description'] ?? 'Bài ôn tập với câu hỏi ngẫu nhiên',
                'ps_type' => 'random',
                'ps_purpose' => $data['purpose'] ?? 'practice',
                'ps_target_skill' => $data['skill'] ?? null,
                'ps_difficulty' => $data['difficulty'] ?? 'mixed',
                'ps_duration_minutes' => $data['duration'] ?? 30,
                'ps_question_count' => $data['question_count'] ?? 15,
                'ps_teacher_id' => $data['teacher_id'],
                'ps_config' => $data['config'] ?? null,
            ]);

            $exam = Exam::create([
                'eTitle' => $practiceSession->ps_title,
                'eDescription' => $practiceSession->ps_description,
                'eType' => $data['exam_type'] ?? 'GENERAL',
                'eSkill' => $data['skill'] ?? 'listening',
                'eScope' => 'skill',
                'ePurpose' => 'practice',
                'eDifficulty' => $data['difficulty'] ?? 'mixed',
                'eTeacher_id' => $data['teacher_id'],
                'eDuration_minutes' => $practiceSession->ps_duration_minutes,
                'eIs_private' => true,
                'eSource_type' => 'template',
            ]);

            $practiceSession->update(['ps_exam_id' => $exam->eId]);

            // Tạo câu hỏi ngẫu nhiên
            $questions = self::generateRandomQuestions($data);
            self::addQuestionsToExam($exam->eId, $questions);

            DB::commit();

            return [
                'practice_session' => $practiceSession,
                'exam' => $exam,
                'questions_count' => count($questions)
            ];

        } catch (\Exception $e) {
            DB::rollback();
            throw $e;
        }
    }

    /**
     * Tạo câu hỏi theo chủ đề
     */
    private static function generateQuestionsByTopic($data)
    {
        $questions = [];
        $questionCount = $data['question_count'] ?? 10;
        $skill = $data['skill'];
        $topic = $data['topic'];
        $difficulty = $data['difficulty'] ?? 'medium';

        // Sample questions based on topic and skill
        $questionTemplates = self::getQuestionTemplatesByTopic($skill, $topic, $difficulty);
        
        for ($i = 1; $i <= $questionCount; $i++) {
            $template = $questionTemplates[array_rand($questionTemplates)];
            
            $questions[] = [
                'content' => str_replace('{number}', $i, $template['content']),
                'type' => $template['type'],
                'section' => $template['section'],
                'points' => 1,
                'difficulty' => $difficulty,
                'answers' => $template['answers']
            ];
        }

        return $questions;
    }

    /**
     * Tạo câu hỏi từ template
     */
    private static function generateQuestionsFromTemplate($template, $data)
    {
        $questions = [];
        $sections = json_decode($template->sections, true);
        $questionCount = $data['question_count'] ?? 20;
        $targetSkill = $data['skill'] ?? null;

        $questionsPerSection = intval($questionCount / count($sections));
        
        foreach ($sections as $section) {
            // Skip if targeting specific skill and this section doesn't match
            if ($targetSkill && strtolower($section['name']) !== strtolower($targetSkill)) {
                continue;
            }

            $sectionQuestions = min($questionsPerSection, $section['questions']);
            
            for ($i = 1; $i <= $sectionQuestions; $i++) {
                $questions[] = [
                    'content' => "Sample {$section['name']} question {$i} for {$template->template_name}",
                    'type' => 'multiple_choice',
                    'section' => $section['name'],
                    'points' => 1,
                    'difficulty' => $data['difficulty'] ?? 'medium',
                    'answers' => [
                        ['content' => 'Option A', 'is_correct' => true],
                        ['content' => 'Option B', 'is_correct' => false],
                        ['content' => 'Option C', 'is_correct' => false],
                        ['content' => 'Option D', 'is_correct' => false],
                    ]
                ];
            }
        }

        return $questions;
    }

    /**
     * Tạo câu hỏi ngẫu nhiên
     */
    private static function generateRandomQuestions($data)
    {
        $questions = [];
        $questionCount = $data['question_count'] ?? 15;
        $skills = ['listening', 'reading', 'writing', 'speaking'];
        $difficulties = ['easy', 'medium', 'hard'];

        for ($i = 1; $i <= $questionCount; $i++) {
            $skill = $data['skill'] ?? $skills[array_rand($skills)];
            $difficulty = $data['difficulty'] === 'mixed' ? $difficulties[array_rand($difficulties)] : ($data['difficulty'] ?? 'medium');
            
            $questions[] = [
                'content' => "Random {$skill} question {$i}",
                'type' => 'multiple_choice',
                'section' => ucfirst($skill),
                'points' => 1,
                'difficulty' => $difficulty,
                'answers' => [
                    ['content' => 'Option A', 'is_correct' => true],
                    ['content' => 'Option B', 'is_correct' => false],
                    ['content' => 'Option C', 'is_correct' => false],
                    ['content' => 'Option D', 'is_correct' => false],
                ]
            ];
        }

        return $questions;
    }

    /**
     * Thêm câu hỏi vào exam
     */
    private static function addQuestionsToExam($examId, $questions)
    {
        foreach ($questions as $index => $questionData) {
            $question = Question::create([
                'exam_id' => $examId,
                'qContent' => $questionData['content'],
                'qType' => $questionData['type'],
                'qSection' => $questionData['section'],
                'qSection_order' => $index + 1,
                'qPoints' => $questionData['points'],
                'qDifficulty' => $questionData['difficulty'],
            ]);

            // Thêm answers
            foreach ($questionData['answers'] as $answerData) {
                Answer::create([
                    'question_id' => $question->qId,
                    'aContent' => $answerData['content'],
                    'aIs_correct' => $answerData['is_correct'],
                ]);
            }
        }
    }

    /**
     * Lấy template câu hỏi theo chủ đề
     */
    private static function getQuestionTemplatesByTopic($skill, $topic, $difficulty)
    {
        // Sample question templates - in real implementation, this would come from database
        $templates = [
            'listening' => [
                'grammar' => [
                    [
                        'content' => 'Listen to the audio and choose the correct grammar form in question {number}.',
                        'type' => 'multiple_choice',
                        'section' => 'Listening - Grammar',
                        'answers' => [
                            ['content' => 'Present simple', 'is_correct' => true],
                            ['content' => 'Present continuous', 'is_correct' => false],
                            ['content' => 'Past simple', 'is_correct' => false],
                            ['content' => 'Future simple', 'is_correct' => false],
                        ]
                    ]
                ],
                'vocabulary' => [
                    [
                        'content' => 'Listen and choose the word that best fits the context in question {number}.',
                        'type' => 'multiple_choice',
                        'section' => 'Listening - Vocabulary',
                        'answers' => [
                            ['content' => 'Appropriate word', 'is_correct' => true],
                            ['content' => 'Wrong word 1', 'is_correct' => false],
                            ['content' => 'Wrong word 2', 'is_correct' => false],
                            ['content' => 'Wrong word 3', 'is_correct' => false],
                        ]
                    ]
                ]
            ],
            'reading' => [
                'comprehension' => [
                    [
                        'content' => 'Read the passage and answer question {number} about the main idea.',
                        'type' => 'multiple_choice',
                        'section' => 'Reading - Comprehension',
                        'answers' => [
                            ['content' => 'Main idea', 'is_correct' => true],
                            ['content' => 'Supporting detail', 'is_correct' => false],
                            ['content' => 'Unrelated info', 'is_correct' => false],
                            ['content' => 'Opposite meaning', 'is_correct' => false],
                        ]
                    ]
                ]
            ]
        ];

        return $templates[$skill][$topic] ?? [
            [
                'content' => 'Sample {skill} question {number} about {topic}.',
                'type' => 'multiple_choice',
                'section' => ucfirst($skill),
                'answers' => [
                    ['content' => 'Correct answer', 'is_correct' => true],
                    ['content' => 'Wrong answer 1', 'is_correct' => false],
                    ['content' => 'Wrong answer 2', 'is_correct' => false],
                    ['content' => 'Wrong answer 3', 'is_correct' => false],
                ]
            ]
        ];
    }

    /**
     * Lấy thống kê bài ôn tập
     */
    public static function getPracticeStatistics($teacherId, $filters = [])
    {
        $query = PracticeSession::where('ps_teacher_id', $teacherId);

        if (isset($filters['type'])) {
            $query->where('ps_type', $filters['type']);
        }

        if (isset($filters['skill'])) {
            $query->where('ps_target_skill', $filters['skill']);
        }

        if (isset($filters['purpose'])) {
            $query->where('ps_purpose', $filters['purpose']);
        }

        $sessions = $query->with('exam')->get();

        return [
            'total_sessions' => $sessions->count(),
            'by_type' => $sessions->groupBy('ps_type')->map->count(),
            'by_skill' => $sessions->groupBy('ps_target_skill')->map->count(),
            'by_purpose' => $sessions->groupBy('ps_purpose')->map->count(),
            'by_difficulty' => $sessions->groupBy('ps_difficulty')->map->count(),
            'total_questions' => $sessions->sum('ps_question_count'),
            'avg_duration' => $sessions->avg('ps_duration_minutes'),
        ];
    }
}

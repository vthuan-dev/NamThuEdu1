<?php

namespace Tests\Unit;

use Tests\TestCase;
use App\Models\Exam;
use App\Models\Question;
use App\Models\Answer;
use App\Models\SubmissionAnswer;
use App\Models\User;
use App\Http\Controllers\StudentTestController;
use Illuminate\Foundation\Testing\RefreshDatabase;

class TeensGradingTest extends TestCase
{
    use RefreshDatabase;

    private $controller;

    protected function setUp(): void
    {
        parent::setUp();
        $this->controller = new StudentTestController();
    }

    private function createTeacher()
    {
        return User::create([
            'uName' => 'Test Teacher',
            'uEmail' => 'teacher@test.com',
            'uPhone' => '0123456789',
            'uPassword' => bcrypt('password'),
            'uRole' => 'teacher',
            'age_group' => 'teens',
        ]);
    }

    /** @test */
    public function test_thpt_full_test_with_only_speaking_answered()
    {
        $teacher = $this->createTeacher();
        
        // Create THPT Full Test exam with all 4 skills
        $exam = Exam::create([
            'eTitle' => 'THPT Full Test',
            'eType' => 'THPT',
            'eSkill' => 'mixed',  // mixed = full test with all skills
            'eDuration_minutes' => 120,
            'eTotal_score' => 100,
            'eTeacher_id' => $teacher->uId,
        ]);

        // Create questions for all 4 skills
        $listeningQ = Question::create([
            'exam_id' => $exam->eId,
            'qSection' => 'listening',
            'qType' => 'multiple_choice',
            'qContent' => 'Listening question 1',
            'qPoints' => 1,
        ]);
        Answer::create(['question_id' => $listeningQ->qId, 'aContent' => 'A', 'aIs_correct' => true]);

        $readingQ = Question::create([
            'exam_id' => $exam->eId,
            'qSection' => 'reading',
            'qType' => 'multiple_choice',
            'qContent' => 'Reading question 1',
            'qPoints' => 1,
        ]);
        Answer::create(['question_id' => $readingQ->qId, 'aContent' => 'B', 'aIs_correct' => true]);

        $writingQ = Question::create([
            'exam_id' => $exam->eId,
            'qSection' => 'writing',
            'qType' => 'essay',
            'qContent' => 'Writing question 1',
            'qPoints' => 1,
        ]);

        $speakingQ = Question::create([
            'exam_id' => $exam->eId,
            'qSection' => 'speaking',
            'qType' => 'speaking',
            'qContent' => 'Speaking question 1',
            'qPoints' => 1,
        ]);

        // Student only answers Speaking (via audio - not graded yet)
        $answers = collect([
            new SubmissionAnswer(['question_id' => $speakingQ->qId, 'saAnswer_text' => 'audio_url']),
        ]);

        // Call gradeAnswers
        $result = $this->controller->gradeAnswers($answers, $exam->eId, true, ['essay', 'writing', 'speaking']);

        // Assertions
        $this->assertNull($result['error']);
        $this->assertNotNull($result['vstepMeta']);
        
        // Listening and Reading should be 0.0 (exist in exam but not answered)
        $this->assertEquals(0.0, $result['vstepMeta']['listening']);
        $this->assertEquals(0.0, $result['vstepMeta']['reading']);
        
        // Writing and Speaking should be null (pending AI grading)
        $this->assertNull($result['vstepMeta']['writing']);
        $this->assertNull($result['vstepMeta']['speaking']);
    }

    /** @test */
    public function test_thpt_full_test_with_all_skills_answered()
    {
        $teacher = $this->createTeacher();
        
        // Create THPT Full Test exam
        $exam = Exam::create([
            'eTitle' => 'THPT Full Test',
            'eType' => 'THPT',
            'eSkill' => 'mixed',
            'eDuration_minutes' => 120,
            'eTeacher_id' => $teacher->uId,
        ]);

        // Create questions for all 4 skills (2 questions each for L/R)
        $listeningQ1 = Question::create([
            'exam_id' => $exam->eId,
            'qSection' => 'listening',
            'qType' => 'multiple_choice',
            'qContent' => 'Listening Q1',
            'qPoints' => 1,
        ]);
        Answer::create(['question_id' => $listeningQ1->qId, 'aContent' => 'A', 'aIs_correct' => true]);

        $listeningQ2 = Question::create([
            'exam_id' => $exam->eId,
            'qSection' => 'listening',
            'qType' => 'multiple_choice',
            'qContent' => 'Listening Q2',
            'qPoints' => 1,
        ]);
        Answer::create(['question_id' => $listeningQ2->qId, 'aContent' => 'B', 'aIs_correct' => true]);

        $readingQ1 = Question::create([
            'exam_id' => $exam->eId,
            'qSection' => 'reading',
            'qType' => 'multiple_choice',
            'qContent' => 'Reading Q1',
            'qPoints' => 1,
        ]);
        Answer::create(['question_id' => $readingQ1->qId, 'aContent' => 'C', 'aIs_correct' => true]);

        $readingQ2 = Question::create([
            'exam_id' => $exam->eId,
            'qSection' => 'reading',
            'qType' => 'multiple_choice',
            'qContent' => 'Reading Q2',
            'qPoints' => 1,
        ]);
        Answer::create(['question_id' => $readingQ2->qId, 'aContent' => 'D', 'aIs_correct' => true]);

        // Student answers all MCQ correctly
        $answers = collect([
            new SubmissionAnswer(['question_id' => $listeningQ1->qId, 'saAnswer_text' => 'A']),
            new SubmissionAnswer(['question_id' => $listeningQ2->qId, 'saAnswer_text' => 'B']),
            new SubmissionAnswer(['question_id' => $readingQ1->qId, 'saAnswer_text' => 'C']),
            new SubmissionAnswer(['question_id' => $readingQ2->qId, 'saAnswer_text' => 'D']),
        ]);

        $result = $this->controller->gradeAnswers($answers, $exam->eId, true, ['essay', 'writing', 'speaking']);

        $this->assertNull($result['error']);
        
        // Both L/R should be 10.0 (100% correct)
        $this->assertEquals(10.0, $result['vstepMeta']['listening']);
        $this->assertEquals(10.0, $result['vstepMeta']['reading']);
        
        // W/S are null (no questions for them in this exam)
        $this->assertNull($result['vstepMeta']['writing']);
        $this->assertNull($result['vstepMeta']['speaking']);
    }

    /** @test */
    public function test_thpt_reading_only_exam()
    {
        $teacher = $this->createTeacher();
        
        // Create THPT Reading only exam
        $exam = Exam::create([
            'eTitle' => 'THPT Reading',
            'eType' => 'THPT',
            'eSkill' => 'reading',
            'eDuration_minutes' => 60,
            'eTeacher_id' => $teacher->uId,
        ]);

        // Create only reading questions
        $readingQ1 = Question::create([
            'exam_id' => $exam->eId,
            'qSection' => 'reading',
            'qType' => 'multiple_choice',
            'qContent' => 'Reading Q1',
            'qPoints' => 1,
        ]);
        Answer::create(['question_id' => $readingQ1->qId, 'aContent' => 'A', 'aIs_correct' => true]);

        $readingQ2 = Question::create([
            'exam_id' => $exam->eId,
            'qSection' => 'reading',
            'qType' => 'multiple_choice',
            'qContent' => 'Reading Q2',
            'qPoints' => 1,
        ]);
        Answer::create(['question_id' => $readingQ2->qId, 'aContent' => 'B', 'aIs_correct' => true]);

        // Student answers 1 correct, 1 wrong
        $answers = collect([
            new SubmissionAnswer(['question_id' => $readingQ1->qId, 'saAnswer_text' => 'A']), // correct
            new SubmissionAnswer(['question_id' => $readingQ2->qId, 'saAnswer_text' => 'C']), // wrong
        ]);

        $result = $this->controller->gradeAnswers($answers, $exam->eId, true, ['essay', 'writing', 'speaking']);

        $this->assertNull($result['error']);
        
        // Reading should be 5.0 (50% correct -> 5/10)
        $this->assertEquals(5.0, $result['vstepMeta']['reading']);
        
        // Other skills should be null (not in exam)
        $this->assertNull($result['vstepMeta']['listening']);
        $this->assertNull($result['vstepMeta']['writing']);
        $this->assertNull($result['vstepMeta']['speaking']);
    }

    /** @test */
    public function test_thpt_listening_reading_exam_with_only_listening_answered()
    {
        $teacher = $this->createTeacher();
        
        // Create THPT exam with L+R
        $exam = Exam::create([
            'eTitle' => 'THPT L+R',
            'eType' => 'THPT',
            'eSkill' => 'mixed',
            'eDuration_minutes' => 90,
            'eTeacher_id' => $teacher->uId,
        ]);

        // Create listening questions
        $listeningQ = Question::create([
            'exam_id' => $exam->eId,
            'qSection' => 'listening',
            'qType' => 'multiple_choice',
            'qContent' => 'Listening Q1',
            'qPoints' => 1,
        ]);
        Answer::create(['question_id' => $listeningQ->qId, 'aContent' => 'A', 'aIs_correct' => true]);

        // Create reading questions
        $readingQ = Question::create([
            'exam_id' => $exam->eId,
            'qSection' => 'reading',
            'qType' => 'multiple_choice',
            'qContent' => 'Reading Q1',
            'qPoints' => 1,
        ]);
        Answer::create(['question_id' => $readingQ->qId, 'aContent' => 'B', 'aIs_correct' => true]);

        // Student only answers Listening
        $answers = collect([
            new SubmissionAnswer(['question_id' => $listeningQ->qId, 'saAnswer_text' => 'A']),
        ]);

        $result = $this->controller->gradeAnswers($answers, $exam->eId, true, ['essay', 'writing', 'speaking']);

        $this->assertNull($result['error']);
        
        // Listening should be 10.0 (100% correct)
        $this->assertEquals(10.0, $result['vstepMeta']['listening']);
        
        // Reading should be 0.0 (exists in exam but not answered)
        $this->assertEquals(0.0, $result['vstepMeta']['reading']);
        
        // W/S should be null (not in exam)
        $this->assertNull($result['vstepMeta']['writing']);
        $this->assertNull($result['vstepMeta']['speaking']);
    }

    /** @test */
    public function test_thpt_listening_only_exam()
    {
        $teacher = $this->createTeacher();
        
        // Create THPT Listening only exam
        $exam = Exam::create([
            'eTitle' => 'THPT Listening',
            'eType' => 'THPT',
            'eSkill' => 'listening',
            'eDuration_minutes' => 40,
            'eTeacher_id' => $teacher->uId,
        ]);

        // Create 3 listening questions
        $listeningQ1 = Question::create([
            'exam_id' => $exam->eId,
            'qSection' => 'listening',
            'qType' => 'multiple_choice',
            'qContent' => 'Listening Q1',
            'qPoints' => 1,
        ]);
        Answer::create(['question_id' => $listeningQ1->qId, 'aContent' => 'A', 'aIs_correct' => true]);

        $listeningQ2 = Question::create([
            'exam_id' => $exam->eId,
            'qSection' => 'listening',
            'qType' => 'true_false',
            'qContent' => 'Listening Q2',
            'qPoints' => 1,
        ]);
        Answer::create(['question_id' => $listeningQ2->qId, 'aContent' => 'true', 'aIs_correct' => true]);

        $listeningQ3 = Question::create([
            'exam_id' => $exam->eId,
            'qSection' => 'listening',
            'qType' => 'multiple_choice',
            'qContent' => 'Listening Q3',
            'qPoints' => 1,
        ]);
        Answer::create(['question_id' => $listeningQ3->qId, 'aContent' => 'C', 'aIs_correct' => true]);

        // Student answers 2 correct, 1 wrong
        $answers = collect([
            new SubmissionAnswer(['question_id' => $listeningQ1->qId, 'saAnswer_text' => 'A']), // correct
            new SubmissionAnswer(['question_id' => $listeningQ2->qId, 'saAnswer_text' => 'true']), // correct
            new SubmissionAnswer(['question_id' => $listeningQ3->qId, 'saAnswer_text' => 'B']), // wrong
        ]);

        $result = $this->controller->gradeAnswers($answers, $exam->eId, true, ['essay', 'writing', 'speaking']);

        $this->assertNull($result['error']);
        
        // Listening should be 6.67 (2/3 correct)
        $this->assertEqualsWithDelta(6.67, $result['vstepMeta']['listening'], 0.1);
        
        // Other skills should be null (not in exam)
        $this->assertNull($result['vstepMeta']['reading']);
        $this->assertNull($result['vstepMeta']['writing']);
        $this->assertNull($result['vstepMeta']['speaking']);
    }

    /** @test */
    public function test_thpt_grammar_vocabulary_section()
    {
        $teacher = $this->createTeacher();
        
        // Create THPT exam with grammar/vocab section
        $exam = Exam::create([
            'eTitle' => 'THPT Grammar & Vocabulary',
            'eType' => 'THPT',
            'eSkill' => 'reading', // Grammar is part of reading skill
            'eDuration_minutes' => 30,
            'eTeacher_id' => $teacher->uId,
        ]);

        // Create grammar questions
        $grammarQ1 = Question::create([
            'exam_id' => $exam->eId,
            'qSection' => 'reading',
            'qType' => 'multiple_choice',
            'qContent' => 'Grammar Q1',
            'qPoints' => 1,
        ]);
        Answer::create(['question_id' => $grammarQ1->qId, 'aContent' => 'has been', 'aIs_correct' => true]);

        $grammarQ2 = Question::create([
            'exam_id' => $exam->eId,
            'qSection' => 'reading',
            'qType' => 'multiple_choice',
            'qContent' => 'Grammar Q2',
            'qPoints' => 1,
        ]);
        Answer::create(['question_id' => $grammarQ2->qId, 'aContent' => 'however', 'aIs_correct' => true]);

        // Student answers both correctly
        $answers = collect([
            new SubmissionAnswer(['question_id' => $grammarQ1->qId, 'saAnswer_text' => 'has been']),
            new SubmissionAnswer(['question_id' => $grammarQ2->qId, 'saAnswer_text' => 'however']),
        ]);

        $result = $this->controller->gradeAnswers($answers, $exam->eId, true, ['essay', 'writing', 'speaking']);

        $this->assertNull($result['error']);
        
        // Reading should be 10.0 (100% correct)
        $this->assertEquals(10.0, $result['vstepMeta']['reading']);
        
        // Other skills should be null (not in exam)
        $this->assertNull($result['vstepMeta']['listening']);
        $this->assertNull($result['vstepMeta']['writing']);
        $this->assertNull($result['vstepMeta']['speaking']);
    }
}

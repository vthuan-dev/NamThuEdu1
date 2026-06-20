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

class KidsGradingTest extends TestCase
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
            'age_group' => 'kids',
        ]);
    }

    /** @test */
    public function test_cambridge_yle_starters_full_test_with_only_speaking_answered()
    {
        $teacher = $this->createTeacher();
        
        // Create Cambridge YLE Starters Full Test exam with all 4 skills
        $exam = Exam::create([
            'eTitle' => 'Cambridge YLE Starters Full Test',
            'eType' => 'GENERAL',
            'eSkill' => 'mixed',  // mixed = full test with all skills
            'eDuration_minutes' => 60,
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
    public function test_cambridge_yle_movers_full_test_with_all_skills_answered()
    {
        $teacher = $this->createTeacher();
        
        // Create Cambridge YLE Movers Full Test exam
        $exam = Exam::create([
            'eTitle' => 'Cambridge YLE Movers Full Test',
            'eType' => 'GENERAL',
            'eSkill' => 'mixed',
            'eDuration_minutes' => 90,
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
        Answer::create(['question_id' => $readingQ2->qId, 'aContent' => 'yes', 'aIs_correct' => true]);

        // Student answers all MCQ correctly
        $answers = collect([
            new SubmissionAnswer(['question_id' => $listeningQ1->qId, 'saAnswer_text' => 'A']),
            new SubmissionAnswer(['question_id' => $listeningQ2->qId, 'saAnswer_text' => 'B']),
            new SubmissionAnswer(['question_id' => $readingQ1->qId, 'saAnswer_text' => 'C']),
            new SubmissionAnswer(['question_id' => $readingQ2->qId, 'saAnswer_text' => 'yes']),
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
    public function test_cambridge_yle_flyers_reading_only_exam()
    {
        $teacher = $this->createTeacher();
        
        // Create Cambridge YLE Flyers Reading only exam
        $exam = Exam::create([
            'eTitle' => 'Cambridge YLE Flyers Reading',
            'eType' => 'GENERAL',
            'eSkill' => 'reading',
            'eDuration_minutes' => 40,
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
        Answer::create(['question_id' => $readingQ1->qId, 'aContent' => 'dragon', 'aIs_correct' => true]);

        $readingQ2 = Question::create([
            'exam_id' => $exam->eId,
            'qSection' => 'reading',
            'qType' => 'multiple_choice',
            'qContent' => 'Reading Q2',
            'qPoints' => 1,
        ]);
        Answer::create(['question_id' => $readingQ2->qId, 'aContent' => 'castle', 'aIs_correct' => true]);

        // Student answers 1 correct, 1 wrong
        $answers = collect([
            new SubmissionAnswer(['question_id' => $readingQ1->qId, 'saAnswer_text' => 'dragon']), // correct
            new SubmissionAnswer(['question_id' => $readingQ2->qId, 'saAnswer_text' => 'house']), // wrong
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
    public function test_kids_listening_reading_exam_with_only_listening_answered()
    {
        $teacher = $this->createTeacher();
        
        // Create Kids exam with L+R
        $exam = Exam::create([
            'eTitle' => 'Starters L+R',
            'eType' => 'GENERAL',
            'eSkill' => 'mixed',
            'eDuration_minutes' => 45,
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
    public function test_kids_listening_only_exam()
    {
        $teacher = $this->createTeacher();
        
        // Create Kids Listening only exam
        $exam = Exam::create([
            'eTitle' => 'Movers Listening',
            'eType' => 'GENERAL',
            'eSkill' => 'listening',
            'eDuration_minutes' => 25,
            'eTeacher_id' => $teacher->uId,
        ]);

        // Create 4 listening questions (different types)
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
            'qType' => 'fill_blank',
            'qContent' => 'Listening Q2',
            'qPoints' => 1,
        ]);
        Answer::create(['question_id' => $listeningQ2->qId, 'aContent' => 'red', 'aIs_correct' => true]);

        $listeningQ3 = Question::create([
            'exam_id' => $exam->eId,
            'qSection' => 'listening',
            'qType' => 'multiple_choice',
            'qContent' => 'Listening Q3',
            'qPoints' => 1,
        ]);
        Answer::create(['question_id' => $listeningQ3->qId, 'aContent' => 'line1-line2', 'aIs_correct' => true]);

        $listeningQ4 = Question::create([
            'exam_id' => $exam->eId,
            'qSection' => 'listening',
            'qType' => 'true_false',
            'qContent' => 'Listening Q4',
            'qPoints' => 1,
        ]);
        Answer::create(['question_id' => $listeningQ4->qId, 'aContent' => 'yes', 'aIs_correct' => true]);

        // Student answers 3 correct, 1 wrong
        $answers = collect([
            new SubmissionAnswer(['question_id' => $listeningQ1->qId, 'saAnswer_text' => 'A']), // correct
            new SubmissionAnswer(['question_id' => $listeningQ2->qId, 'saAnswer_text' => 'red']), // correct
            new SubmissionAnswer(['question_id' => $listeningQ3->qId, 'saAnswer_text' => 'line1-line3']), // wrong
            new SubmissionAnswer(['question_id' => $listeningQ4->qId, 'saAnswer_text' => 'yes']), // correct
        ]);

        $result = $this->controller->gradeAnswers($answers, $exam->eId, true, ['essay', 'writing', 'speaking']);

        $this->assertNull($result['error']);
        
        // Listening should be 7.5 (3/4 correct)
        $this->assertEquals(7.5, $result['vstepMeta']['listening']);
        
        // Other skills should be null (not in exam)
        $this->assertNull($result['vstepMeta']['reading']);
        $this->assertNull($result['vstepMeta']['writing']);
        $this->assertNull($result['vstepMeta']['speaking']);
    }
}

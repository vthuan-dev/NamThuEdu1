<?php

namespace Database\Seeders;

use App\Models\Exam;
use App\Models\User;
use App\Models\ClassModel;
use App\Models\TestAssignment;
use Illuminate\Database\Seeder;

/**
 * ThptNationalExamSeeder — Đề Tiếng Anh THPT Quốc gia (hoàn chỉnh 50 câu / 60 phút).
 *
 * Bám sát cấu trúc đề thi tốt nghiệp THPT môn Tiếng Anh:
 *   - Ngữ âm (phát âm) — 2 câu
 *   - Trọng âm — 2 câu
 *   - Trắc nghiệm ngữ pháp / từ vựng — 10 câu
 *   - Giao tiếp — 2 câu
 *   - Đồng nghĩa — 2 câu
 *   - Trái nghĩa — 2 câu
 *   - Đọc điền trắc nghiệm (cloze) — 5 câu
 *   - Đọc hiểu đoạn 1 — 5 câu
 *   - Đọc hiểu đoạn 2 — 7 câu
 *   - Tìm lỗi sai — 3 câu
 *   - Câu gần nghĩa nhất — 5 câu
 *   - Kết hợp câu — 2 câu
 *   - Bổ sung ngữ pháp / từ vựng — 3 câu
 *   Tổng: 50 câu.
 *
 * Nội dung do hệ thống tự soạn theo chuẩn THPT QG (không sao chép nguyên đề có bản quyền).
 *
 * Run: php artisan db:seed --class=ThptNationalExamSeeder
 */
class ThptNationalExamSeeder extends Seeder
{
    public function run(): void
    {
        $teacher = User::where('uEmail', 'testteacher@example.com')->whereNull('uDeleted_at')->first()
            ?? User::where('uRole', 'teacher')->whereNull('uDeleted_at')->first();

        if (!$teacher) {
            $this->command->warn('Không tìm thấy teacher nào — bỏ qua seed.');
            return;
        }

        $config = $this->buildConfig();

        $exam = Exam::updateOrCreate(
            ['eTitle' => 'Đề thi Tiếng Anh THPT Quốc gia (Đề luyện hoàn chỉnh)'],
            [
                'eDescription' => 'Đề luyện thi tốt nghiệp THPT môn Tiếng Anh — 50 câu trắc nghiệm, 60 phút, đầy đủ các dạng theo cấu trúc đề thi chính thức.',
                'eType' => 'THPT',
                'eSkill' => 'reading',
                'eDuration_minutes' => 60,
                'eStatus' => 'published',
                'ePurpose' => 'exam',
                'eDifficulty' => 'medium',
                'eTeacher_id' => $teacher->uId,
                'eIs_private' => false,
                'age_group' => 'teens',
                'thpt_config' => $config,
            ]
        );

        $this->command->info("✅ Seeded THPT exam ID={$exam->eId} — {$exam->eTitle}");

        // Gán cho lớp teens (nếu có) để học viên thấy trong "Giáo viên giao".
        $class = ClassModel::where('age_group', 'teens')->first();
        if ($class) {
            TestAssignment::firstOrCreate(
                [
                    'exam_id'       => $exam->eId,
                    'taTarget_type' => 'class',
                    'taTarget_id'   => $class->cId,
                ],
                [
                    'taDeadline'    => now()->addDays(30),
                    'taMax_attempt' => 5,
                    'taIs_public'   => true,
                ]
            );
            $this->command->info("   📌 Đã giao cho lớp teens: {$class->cName}");
        }
    }

    private function buildConfig(): array
    {
        return [
            'version' => '2.0',
            'level' => 'THPT',
            'school' => 'Đề luyện THPT Quốc gia',
            'total_duration_minutes' => 60,
            'scale_max' => 10,
            'sections' => [
                $this->pronunciation(),     // Q1-2
                $this->stress(),            // Q3-4
                $this->grammarVocab(),      // Q5-14
                $this->communication(),     // Q15-16
                $this->synonym(),           // Q17-18
                $this->antonym(),           // Q19-20
                $this->cloze(),             // Q21-25
                $this->reading1(),          // Q26-30
                $this->reading2(),          // Q31-37
                $this->errorId(),           // Q38-40
                $this->closestMeaning(),    // Q41-45
                $this->combination(),       // Q46-47
                $this->extraGrammar(),      // Q48-50
            ],
        ];
    }

    // ── Q1-2 — Ngữ âm (phát âm) ──────────────────────────────────────────────
    private function pronunciation(): array
    {
        return [
            'id' => 'sec_pron',
            'type' => 'phonetics',
            'variant' => 'pronunciation',
            'points_per_question' => 1,
            'title' => 'Mark the letter A, B, C, or D to indicate the word whose underlined part differs from the other three in pronunciation.',
            'instructions' => 'Chọn từ có phần gạch chân được phát âm khác với những từ còn lại.',
            'items' => [
                [
                    'question_number' => 1,
                    'words' => [
                        ['id' => 'A', 'text' => 'walked', 'underline' => 'ed'],
                        ['id' => 'B', 'text' => 'stopped', 'underline' => 'ed'],
                        ['id' => 'C', 'text' => 'wanted', 'underline' => 'ed'],
                        ['id' => 'D', 'text' => 'watched', 'underline' => 'ed'],
                    ],
                    'correct_id' => 'C',
                    'explanation' => '"wanted" /ɪd/; còn lại /t/.',
                ],
                [
                    'question_number' => 2,
                    'words' => [
                        ['id' => 'A', 'text' => 'cats', 'underline' => 's'],
                        ['id' => 'B', 'text' => 'books', 'underline' => 's'],
                        ['id' => 'C', 'text' => 'maps', 'underline' => 's'],
                        ['id' => 'D', 'text' => 'pens', 'underline' => 's'],
                    ],
                    'correct_id' => 'D',
                    'explanation' => '"pens" /z/; còn lại /s/.',
                ],
            ],
        ];
    }

    // ── Q3-4 — Trọng âm ──────────────────────────────────────────────────────
    private function stress(): array
    {
        return [
            'id' => 'sec_stress',
            'type' => 'phonetics',
            'variant' => 'stress',
            'points_per_question' => 1,
            'title' => 'Mark the letter A, B, C, or D to indicate the word that differs from the other three in the position of primary stress.',
            'instructions' => 'Chọn từ có trọng âm chính rơi vào vị trí khác với những từ còn lại.',
            'items' => [
                [
                    'question_number' => 3,
                    'words' => [
                        ['id' => 'A', 'text' => 'comfortable'],
                        ['id' => 'B', 'text' => 'interesting'],
                        ['id' => 'C', 'text' => 'important'],
                        ['id' => 'D', 'text' => 'difficult'],
                    ],
                    'correct_id' => 'C',
                    'explanation' => '"important" trọng âm âm 2; còn lại âm 1.',
                ],
                [
                    'question_number' => 4,
                    'words' => [
                        ['id' => 'A', 'text' => 'develop'],
                        ['id' => 'B', 'text' => 'remember'],
                        ['id' => 'C', 'text' => 'consider'],
                        ['id' => 'D', 'text' => 'recommend'],
                    ],
                    'correct_id' => 'D',
                    'explanation' => '"recommend" trọng âm âm 3; còn lại âm 2.',
                ],
            ],
        ];
    }

    // ── Helper dựng câu trắc nghiệm ──────────────────────────────────────────
    private function mc(int $n, string $prompt, array $opts, string $correct, ?string $exp = null): array
    {
        $options = [];
        foreach (['A', 'B', 'C', 'D'] as $i => $letter) {
            $options[] = ['id' => $letter, 'text' => $opts[$i]];
        }
        $item = [
            'question_number' => $n,
            'prompt' => $prompt,
            'options' => $options,
            'correct_id' => $correct,
        ];
        if ($exp) {
            $item['explanation'] = $exp;
        }
        return $item;
    }

    // ── Q5-14 — Trắc nghiệm ngữ pháp / từ vựng ───────────────────────────────
    private function grammarVocab(): array
    {
        return [
            'id' => 'sec_grammar',
            'type' => 'mc_questions',
            'variant' => 'general',
            'points_per_question' => 1,
            'title' => 'Mark the letter A, B, C, or D to indicate the correct answer to each of the following questions.',
            'instructions' => 'Chọn phương án đúng (A, B, C hoặc D) để hoàn thành mỗi câu.',
            'items' => [
                $this->mc(5, 'By the time we arrived at the cinema, the film ____ already.',
                    ['started', 'has started', 'had started', 'was starting'], 'C',
                    'Quá khứ hoàn thành cho hành động xảy ra trước một mốc trong quá khứ.'),
                $this->mc(6, 'If I ____ you, I would accept the job offer immediately.',
                    ['am', 'was', 'were', 'had been'], 'C',
                    'Câu điều kiện loại 2: If + were.'),
                $this->mc(7, 'She is interested ____ learning foreign languages.',
                    ['on', 'in', 'at', 'with'], 'B',
                    '"interested in" — cụm cố định.'),
                $this->mc(8, 'The new shopping mall ____ next to the central park last year.',
                    ['built', 'was built', 'has built', 'is built'], 'B',
                    'Bị động quá khứ đơn: was built.'),
                $this->mc(9, 'Neither the teacher nor the students ____ satisfied with the result.',
                    ['was', 'were', 'is', 'has been'], 'B',
                    'Neither...nor: động từ chia theo chủ ngữ gần nhất "students".'),
                $this->mc(10, 'You ____ wear a helmet when riding a motorbike; it is the law.',
                    ['can', 'might', 'must', 'would'], 'C',
                    '"must" diễn tả nghĩa vụ bắt buộc.'),
                $this->mc(11, 'The book ____ I borrowed from the library is really interesting.',
                    ['who', 'whom', 'which', 'whose'], 'C',
                    '"which" thay cho vật làm tân ngữ.'),
                $this->mc(12, 'We had a ____ holiday in Da Nang last summer.',
                    ['memory', 'memorable', 'memorize', 'memorably'], 'B',
                    'Cần tính từ bổ nghĩa cho "holiday".'),
                $this->mc(13, 'He suggested ____ a meeting to discuss the new project.',
                    ['hold', 'to hold', 'holding', 'held'], 'C',
                    '"suggest + V-ing".'),
                $this->mc(14, 'The harder you study, ____ results you will achieve.',
                    ['the good', 'the better', 'the best', 'better'], 'B',
                    'Cấu trúc so sánh kép: the + comparative.'),
            ],
        ];
    }

    // ── Q15-16 — Giao tiếp ───────────────────────────────────────────────────
    private function communication(): array
    {
        return [
            'id' => 'sec_comm',
            'type' => 'mc_questions',
            'variant' => 'communication',
            'points_per_question' => 1,
            'title' => 'Mark the letter A, B, C, or D to indicate the most suitable response to complete each of the following exchanges.',
            'instructions' => 'Chọn câu đáp lại phù hợp nhất để hoàn thành đoạn hội thoại.',
            'items' => [
                $this->mc(15, 'Lan: "Congratulations on passing your driving test!" — Minh: "____"',
                    ['Never mind.', 'Thank you very much.', "It's my pleasure.", 'Yes, of course.'], 'B',
                    'Đáp lại lời chúc mừng bằng lời cảm ơn.'),
                $this->mc(16, 'Tom: "Do you mind if I open the window?" — Anna: "____"',
                    ['Yes, let\'s do it.', 'No, not at all.', "Yes, I'd love to.", 'No, thank you.'], 'B',
                    '"Do you mind if...?" — đồng ý trả lời "No, not at all."'),
            ],
        ];
    }

    // ── Q17-18 — Đồng nghĩa ──────────────────────────────────────────────────
    private function synonym(): array
    {
        return [
            'id' => 'sec_syn',
            'type' => 'mc_questions',
            'variant' => 'synonym',
            'points_per_question' => 1,
            'title' => 'Mark the letter A, B, C, or D to indicate the word(s) CLOSEST in meaning to the underlined word(s) in each of the following questions.',
            'instructions' => 'Chọn từ/cụm từ gần nghĩa nhất với phần gạch chân.',
            'items' => [
                $this->mc(17, 'The committee decided to <u>postpone</u> the meeting until next week.',
                    ['cancel', 'hold', 'delay', 'attend'], 'C',
                    '"postpone" = "delay" (hoãn lại).'),
                $this->mc(18, 'Her <u>diligent</u> attitude towards work impressed her boss.',
                    ['lazy', 'hard-working', 'careless', 'cheerful'], 'B',
                    '"diligent" = "hard-working" (chăm chỉ).'),
            ],
        ];
    }

    // ── Q19-20 — Trái nghĩa ──────────────────────────────────────────────────
    private function antonym(): array
    {
        return [
            'id' => 'sec_ant',
            'type' => 'mc_questions',
            'variant' => 'antonym',
            'points_per_question' => 1,
            'title' => 'Mark the letter A, B, C, or D to indicate the word(s) OPPOSITE in meaning to the underlined word(s) in each of the following questions.',
            'instructions' => 'Chọn từ/cụm từ trái nghĩa với phần gạch chân.',
            'items' => [
                $this->mc(19, 'The instructions were so <u>obscure</u> that nobody could follow them.',
                    ['unclear', 'clear', 'difficult', 'strange'], 'B',
                    '"obscure" (mơ hồ) trái nghĩa với "clear".'),
                $this->mc(20, 'He is well known for his <u>generous</u> donations to charity.',
                    ['kind', 'wealthy', 'mean', 'helpful'], 'C',
                    '"generous" (hào phóng) trái nghĩa với "mean" (keo kiệt).'),
            ],
        ];
    }

    // ── Q21-25 — Đọc điền trắc nghiệm (cloze) ────────────────────────────────
    private function cloze(): array
    {
        $passage = "Volunteering has become increasingly popular among young people in Vietnam. Many students spend their free time taking part (21) ____ community activities such as cleaning up beaches, teaching children in remote areas, or helping the elderly. These activities not only benefit society but also help young volunteers (22) ____ valuable life skills. Through volunteering, they learn how to work in teams, communicate effectively, and solve problems. (23) ____, volunteering allows them to understand the difficulties that disadvantaged people face every day. As a result, they become more responsible and (24) ____ towards others. Schools and universities are now encouraging students to join volunteer programs, believing that such experiences will (25) ____ them well for their future careers.";

        return [
            'id' => 'sec_cloze',
            'type' => 'mc_cloze',
            'points_per_question' => 1,
            'title' => 'Read the following passage and mark the letter A, B, C, or D to indicate the correct word or phrase that best fits each of the numbered blanks from 21 to 25.',
            'instructions' => 'Đọc đoạn văn và chọn phương án đúng cho mỗi chỗ trống.',
            'passage' => $passage,
            'blanks' => [
                $this->blank(21, ['on', 'in', 'at', 'of'], 'B', '"take part in" — cụm cố định.'),
                $this->blank(22, ['develop', 'reduce', 'avoid', 'waste'], 'A', 'Phát triển kỹ năng sống.'),
                $this->blank(23, ['However', 'Therefore', 'Moreover', 'Otherwise'], 'C', '"Moreover" — bổ sung ý.'),
                $this->blank(24, ['selfish', 'sympathetic', 'aggressive', 'careless'], 'B', '"sympathetic" — biết cảm thông.'),
                $this->blank(25, ['prepare', 'prevent', 'prefer', 'present'], 'A', '"prepare somebody for" — chuẩn bị.'),
            ],
        ];
    }

    private function blank(int $n, array $opts, string $correct, ?string $exp = null): array
    {
        $options = [];
        foreach (['A', 'B', 'C', 'D'] as $i => $letter) {
            $options[] = ['id' => $letter, 'text' => $opts[$i]];
        }
        $b = ['question_number' => $n, 'options' => $options, 'correct_id' => $correct];
        if ($exp) {
            $b['explanation'] = $exp;
        }
        return $b;
    }

    // ── Q26-30 — Đọc hiểu đoạn 1 ─────────────────────────────────────────────
    private function reading1(): array
    {
        $passage = "Online learning has transformed the way students access education around the world. Instead of sitting in traditional classrooms, learners can now study from home using computers and the internet. This form of learning offers great flexibility, as students can choose when and where to study. It is especially useful for those who live far from schools or who have busy schedules.\n\n"
                 . "However, online learning also has its drawbacks. Without face-to-face interaction, some students feel isolated and find it hard to stay motivated. Technical problems, such as poor internet connection, can also interrupt lessons. Moreover, online learning requires a high level of self-discipline, which not all students possess.\n\n"
                 . "Despite these challenges, experts believe that online learning will continue to grow. With improvements in technology and teaching methods, it is likely to become an essential part of education in the future, working alongside traditional classroom learning rather than replacing it completely.";

        return [
            'id' => 'sec_read1',
            'type' => 'reading_mixed',
            'points_per_question' => 1,
            'title' => 'Read the following passage and mark the letter A, B, C, or D to indicate the correct answer to each of the questions from 26 to 30.',
            'instructions' => 'Đọc đoạn văn và trả lời các câu hỏi 26-30.',
            'passage' => $passage,
            'items' => [
                $this->rmc(26, 'What is the passage mainly about?',
                    ['The history of traditional classrooms', 'The advantages and disadvantages of online learning', 'How to fix internet connection problems', 'Why schools should be closed'], 'B'),
                $this->rmc(27, 'According to paragraph 1, online learning is especially useful for students who ____.',
                    ['dislike using computers', 'live close to their schools', 'have busy schedules', 'prefer traditional classrooms'], 'C'),
                $this->rmc(28, 'The word "drawbacks" in paragraph 2 is closest in meaning to ____.',
                    ['benefits', 'disadvantages', 'methods', 'results'], 'B'),
                $this->rmc(29, 'Which of the following is NOT mentioned as a problem of online learning?',
                    ['Feeling isolated', 'Technical problems', 'Lack of self-discipline', 'High tuition fees'], 'D'),
                $this->rmc(30, 'What can be inferred from the last paragraph?',
                    ['Online learning will completely replace traditional classrooms.', 'Online learning will disappear in the future.', 'Online learning and traditional learning will exist together.', 'Technology will make learning more difficult.'], 'C'),
            ],
        ];
    }

    // ── Q31-37 — Đọc hiểu đoạn 2 (dài hơn) ───────────────────────────────────
    private function reading2(): array
    {
        $passage = "Plastic pollution has become one of the most serious environmental problems of our time. Every year, millions of tonnes of plastic waste end up in the oceans, threatening marine life and damaging delicate ecosystems. Sea creatures such as turtles, fish, and birds often mistake plastic for food, which can cause injury or death. In addition, tiny pieces of plastic, known as microplastics, have been found in the water we drink and the food we eat.\n\n"
                 . "The main cause of this crisis is the overuse of single-use plastic products, such as bags, straws, and bottles. These items are convenient and cheap, but they are used only once before being thrown away. Because plastic takes hundreds of years to break down, it accumulates in landfills and natural environments at an alarming rate.\n\n"
                 . "Fortunately, people around the world are beginning to take action. Many countries have banned or taxed single-use plastic bags, while companies are developing eco-friendly alternatives made from paper or plant-based materials. Individuals can also make a difference by reducing their plastic consumption, reusing containers, and recycling whenever possible.\n\n"
                 . "Experts emphasize that solving the plastic problem requires the cooperation of governments, businesses, and individuals. Although the challenge is enormous, small changes in daily habits, when adopted by millions of people, can have a powerful and lasting impact on the health of our planet.";

        return [
            'id' => 'sec_read2',
            'type' => 'reading_mixed',
            'points_per_question' => 1,
            'title' => 'Read the following passage and mark the letter A, B, C, or D to indicate the correct answer to each of the questions from 31 to 37.',
            'instructions' => 'Đọc đoạn văn và trả lời các câu hỏi 31-37.',
            'passage' => $passage,
            'items' => [
                $this->rmc(31, 'What is the best title for the passage?',
                    ['The Benefits of Plastic', 'Plastic Pollution and Possible Solutions', 'How to Make Plastic Bags', 'The History of Recycling'], 'B'),
                $this->rmc(32, 'According to paragraph 1, why is plastic dangerous to sea creatures?',
                    ['It makes the water warmer.', 'They mistake it for food.', 'It changes the colour of the sea.', 'It makes them swim faster.'], 'B'),
                $this->rmc(33, 'The word "they" in paragraph 2 refers to ____.',
                    ['oceans', 'single-use plastic products', 'landfills', 'companies'], 'B'),
                $this->rmc(34, 'The word "accumulates" in paragraph 2 is closest in meaning to ____.',
                    ['disappears', 'builds up', 'breaks down', 'floats away'], 'B'),
                $this->rmc(35, 'Which of the following is mentioned as an action against plastic pollution?',
                    ['Producing more plastic bottles', 'Banning single-use plastic bags', 'Throwing plastic into the sea', 'Using more straws'], 'B'),
                $this->rmc(36, 'According to the passage, solving the plastic problem requires ____.',
                    ['only government action', 'only individual effort', 'cooperation of governments, businesses, and individuals', 'no action at all'], 'C'),
                $this->rmc(37, 'What is the writer\'s attitude in the last paragraph?',
                    ['Hopeful that small changes can help', 'Certain that nothing can be done', 'Angry at businesses', 'Indifferent to the problem'], 'A'),
            ],
        ];
    }

    private function rmc(int $n, string $prompt, array $opts, string $correct, ?string $exp = null): array
    {
        $options = [];
        foreach (['A', 'B', 'C', 'D'] as $i => $letter) {
            $options[] = ['id' => $letter, 'text' => $opts[$i]];
        }
        $item = [
            'kind' => 'mc',
            'question_number' => $n,
            'prompt' => $prompt,
            'options' => $options,
            'correct_id' => $correct,
        ];
        if ($exp) {
            $item['explanation'] = $exp;
        }
        return $item;
    }

    // ── Q38-40 — Tìm lỗi sai ─────────────────────────────────────────────────
    private function errorId(): array
    {
        return [
            'id' => 'sec_error',
            'type' => 'error_identification',
            'points_per_question' => 1,
            'title' => 'Mark the letter A, B, C, or D to indicate the underlined part that needs correction in each of the following questions.',
            'instructions' => 'Chọn phần gạch chân (A, B, C hoặc D) cần được sửa cho đúng.',
            'items' => [
                [
                    'question_number' => 38,
                    'sentence' => 'My sister, together with her friends, are going to the concert tonight.',
                    'segments' => [
                        ['id' => 'A', 'text' => 'together with'],
                        ['id' => 'B', 'text' => 'are going'],
                        ['id' => 'C', 'text' => 'to the'],
                        ['id' => 'D', 'text' => 'tonight'],
                    ],
                    'correct_id' => 'B',
                    'explanation' => '"together with" không đổi số; chủ ngữ là "My sister" → "is going".',
                ],
                [
                    'question_number' => 39,
                    'sentence' => 'She has been working here since ten years, so she knows the job very well.',
                    'segments' => [
                        ['id' => 'A', 'text' => 'has been working'],
                        ['id' => 'B', 'text' => 'since'],
                        ['id' => 'C', 'text' => 'so'],
                        ['id' => 'D', 'text' => 'very well'],
                    ],
                    'correct_id' => 'B',
                    'explanation' => 'Khoảng thời gian "ten years" dùng "for", không dùng "since".',
                ],
                [
                    'question_number' => 40,
                    'sentence' => 'The more you practise speaking English, the confident you become.',
                    'segments' => [
                        ['id' => 'A', 'text' => 'The more'],
                        ['id' => 'B', 'text' => 'practise'],
                        ['id' => 'C', 'text' => 'the confident'],
                        ['id' => 'D', 'text' => 'become'],
                    ],
                    'correct_id' => 'C',
                    'explanation' => 'So sánh kép: "the more confident".',
                ],
            ],
        ];
    }

    // ── Q41-45 — Câu gần nghĩa nhất ──────────────────────────────────────────
    private function closestMeaning(): array
    {
        return [
            'id' => 'sec_closest',
            'type' => 'mc_questions',
            'variant' => 'general',
            'points_per_question' => 1,
            'title' => 'Mark the letter A, B, C, or D to indicate the sentence that is closest in meaning to each of the following questions.',
            'instructions' => 'Chọn câu gần nghĩa nhất với câu cho sẵn.',
            'items' => [
                $this->mc(41, '"I haven\'t seen this film before," said Mai.',
                    ['Mai said she hasn\'t seen that film before.', 'Mai said she hadn\'t seen that film before.', 'Mai said she didn\'t see that film before.', 'Mai said she wouldn\'t see that film before.'], 'B',
                    'Lời nói gián tiếp: present perfect → past perfect.'),
                $this->mc(42, 'It is necessary for you to finish the report today.',
                    ['You may finish the report today.', 'You can finish the report today.', 'You must finish the report today.', 'You should have finished the report today.'], 'C',
                    '"It is necessary" = "must".'),
                $this->mc(43, 'He started learning English five years ago.',
                    ['He has learned English for five years.', 'He learned English five years ago.', 'He will learn English in five years.', 'He had learned English for five years.'], 'A',
                    '"started ... ago" → present perfect "for".'),
                $this->mc(44, 'They couldn\'t go on a picnic because of the heavy rain.',
                    ['The heavy rain prevented them from going on a picnic.', 'The heavy rain made them go on a picnic.', 'They went on a picnic despite the heavy rain.', 'Because they went on a picnic, it rained heavily.'], 'A',
                    '"prevent somebody from doing" diễn đạt nguyên nhân cản trở.'),
                $this->mc(45, '"You should study harder, Tom," said the teacher.',
                    ['The teacher ordered Tom to study harder.', 'The teacher advised Tom to study harder.', 'The teacher allowed Tom to study harder.', 'The teacher reminded Tom to study harder.'], 'B',
                    '"should" → lời khuyên "advised somebody to do".'),
            ],
        ];
    }

    // ── Q46-47 — Kết hợp câu ─────────────────────────────────────────────────
    private function combination(): array
    {
        return [
            'id' => 'sec_combine',
            'type' => 'mc_questions',
            'variant' => 'general',
            'points_per_question' => 1,
            'title' => 'Mark the letter A, B, C, or D to indicate the sentence that best combines each pair of sentences in the following questions.',
            'instructions' => 'Chọn câu kết hợp đúng nhất hai câu cho sẵn.',
            'items' => [
                $this->mc(46, 'The weather was bad. We decided to cancel the trip.',
                    ['Although the weather was bad, we decided to cancel the trip.', 'Because of the bad weather, we decided to cancel the trip.', 'The weather was bad so that we cancelled the trip.', 'In spite of the bad weather, we cancelled the trip.'], 'B',
                    'Quan hệ nguyên nhân — kết quả: "Because of".'),
                $this->mc(47, 'She is very intelligent. She can solve the problem easily.',
                    ['She is too intelligent to solve the problem easily.', 'She is so intelligent that she can solve the problem easily.', 'She is intelligent enough so she can solve the problem.', 'Such intelligent is she that she can solve the problem.'], 'B',
                    'Cấu trúc "so + adj + that".'),
            ],
        ];
    }

    // ── Q48-50 — Bổ sung ngữ pháp / từ vựng ──────────────────────────────────
    private function extraGrammar(): array
    {
        return [
            'id' => 'sec_extra',
            'type' => 'mc_questions',
            'variant' => 'general',
            'points_per_question' => 1,
            'title' => 'Mark the letter A, B, C, or D to indicate the correct answer to each of the following questions.',
            'instructions' => 'Chọn phương án đúng để hoàn thành mỗi câu.',
            'items' => [
                $this->mc(48, 'I look forward to ____ from you soon.',
                    ['hear', 'hearing', 'heard', 'be heard'], 'B',
                    '"look forward to + V-ing".'),
                $this->mc(49, 'The factory ____ down due to financial difficulties last month.',
                    ['closed', 'was closed', 'has closed', 'closes'], 'B',
                    'Bị động quá khứ: was closed.'),
                $this->mc(50, 'Not until she got home ____ that she had left her bag at the office.',
                    ['she realized', 'did she realize', 'she did realize', 'realized she'], 'B',
                    'Đảo ngữ với "Not until": trợ động từ đảo lên trước chủ ngữ.'),
            ],
        ];
    }
}

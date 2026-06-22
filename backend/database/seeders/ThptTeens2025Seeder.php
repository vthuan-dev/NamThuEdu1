<?php

namespace Database\Seeders;

use App\Models\Exam;
use App\Models\User;
use App\Models\ClassModel;
use App\Models\TestAssignment;
use Illuminate\Database\Seeder;

/**
 * ThptTeens2025Seeder
 *
 * Seed 1 đề THPT Quốc gia môn Tiếng Anh HOÀN CHỈNH theo format thi tốt nghiệp
 * THPT từ 2025 (Chương trình GDPT 2018):
 *   - 40 câu trắc nghiệm / 50 phút / 0.25 điểm mỗi câu (thang 10)
 *   - Trọng tâm ĐỌC HIỂU & sử dụng ngôn ngữ trong ngữ cảnh:
 *       • Câu 1-6, 7-12 : Điền từ/cụm từ vào văn bản (mc_cloze) — 12 câu
 *       • Câu 13-17     : Sắp xếp hội thoại/đoạn văn (matching)  — 5 câu
 *       • Câu 18-22     : Điền câu/cụm từ dài vào văn bản (mc_cloze) — 5 câu
 *       • Câu 23-30     : Đọc hiểu bài 1 (reading_mixed)        — 8 câu
 *       • Câu 31-40     : Đọc hiểu bài 2 (reading_mixed)        — 10 câu
 *
 * Nội dung do team tự soạn theo ĐÚNG cấu trúc đề minh hoạ 2025 (không sao chép
 * nguyên văn đề chính thức của Bộ GD&ĐT), dùng cho mục đích demo/luyện tập.
 *
 * Đề gán age_group = 'teens' + eType = 'THPT' + published nên học viên teens
 * thấy trong "Đề thi" và làm qua /hoc-vien/lam-bai-thpt/{examId}.
 *
 * Run: php artisan db:seed --class=ThptTeens2025Seeder
 */
class ThptTeens2025Seeder extends Seeder
{
    public function run(): void
    {
        // 1. Giáo viên (ưu tiên GV teens demo, fallback teacher bất kỳ)
        $teacher = User::where('uPhone', '0905550001')->whereNull('uDeleted_at')->first()
            ?? User::where('uRole', 'teacher')->whereNull('uDeleted_at')->first();

        if (!$teacher) {
            $this->command->warn('⚠️  Không tìm thấy giáo viên nào — hãy chạy TeensExamSeeder trước. Bỏ qua.');
            return;
        }

        // 2. Tạo / cập nhật đề
        $exam = Exam::updateOrCreate(
            ['eTitle' => 'THPT QG 2025 - Tiếng Anh (Đề minh hoạ hoàn chỉnh)'],
            [
                'eDescription'      => 'Đề thi tốt nghiệp THPT môn Tiếng Anh theo cấu trúc 2025: 40 câu trắc nghiệm, 50 phút, trọng tâm đọc hiểu và sử dụng ngôn ngữ trong ngữ cảnh.',
                'eType'             => 'THPT',
                'eSkill'            => 'reading',
                'eDuration_minutes' => 50,
                'eStatus'           => 'published',
                'ePurpose'          => 'exam',
                'eDifficulty'       => 'medium',
                'eTeacher_id'       => $teacher->uId,
                'eIs_private'       => false,
                'age_group'         => 'teens',
                'eTotal_score'      => 10,
                'ePass_score'       => 5,
                'thpt_config'       => $this->buildConfig(),
            ]
        );

        $this->command->info("✅ Seeded THPT exam ID={$exam->eId} — {$exam->eTitle}");

        // 3. (Tuỳ chọn) Gán cho lớp teens demo nếu có — để hiện trong "Bài tập được giao"
        $teensClass = ClassModel::where('age_group', 'teens')->first();
        if ($teensClass) {
            TestAssignment::firstOrCreate(
                [
                    'exam_id'       => $exam->eId,
                    'taTarget_type' => 'class',
                    'taTarget_id'   => $teensClass->cId,
                ],
                [
                    'taDeadline'    => now()->addDays(30),
                    'taMax_attempt' => 3,
                    'taIs_public'   => true,
                ]
            );
            $this->command->info("   ✓ Đã gán đề cho lớp teens: {$teensClass->cName}");
        }

        $this->command->info('   🧑 Học viên teens demo: 0907770001 / password123 (nếu đã chạy TeensExamSeeder)');
        $this->command->info('   📝 40 câu / 50 phút / thang điểm 10');
    }

    private function buildConfig(): array
    {
        return [
            'version'                => '2.0',
            'level'                  => 'THPT',
            'school'                 => 'Bộ GD&ĐT (mô phỏng 2025)',
            'total_duration_minutes' => 50,
            'scale_max'              => 10,
            'sections'               => [
                $this->section1Cloze(),       // Q1-6
                $this->section2Cloze(),       // Q7-12
                $this->section3Arrange(),     // Q13-17
                $this->section4SentenceCloze(), // Q18-22
                $this->section5Reading(),     // Q23-30
                $this->section6Reading(),     // Q31-40
            ],
        ];
    }

    // ─── PART 1: Điền từ vào email/thông báo (Q1-6) ────────────────────────────
    private function section1Cloze(): array
    {
        return [
            'id'                  => 'sec_p1',
            'type'                => 'mc_cloze',
            'points_per_question' => 0.25,
            'title'               => 'PART 1 - Questions 1-6',
            'instructions'        => 'Read the following email and choose the best option (A, B, C or D) for each blank.',
            'passage' => "Dear Mr. Carter,\n\n"
                . "I am writing to (1) ____ for the position of Summer Camp Assistant advertised on your website. "
                . "I am a high school student who is really (2) ____ in working with younger children. "
                . "Last year, I (3) ____ as a volunteer at a local sports club, where I helped to organise weekend activities. "
                . "I believe this experience has (4) ____ me the skills needed for the job. "
                . "I am available throughout July and August and can start (5) ____ notice. "
                . "I would be grateful for the (6) ____ to discuss my application in an interview.\n\n"
                . "Yours sincerely,\nLan Nguyen",
            'blanks' => [
                ['question_number' => 1, 'correct_id' => 'B', 'options' => [
                    ['id' => 'A', 'text' => 'ask'],
                    ['id' => 'B', 'text' => 'apply'],
                    ['id' => 'C', 'text' => 'request'],
                    ['id' => 'D', 'text' => 'order'],
                ]],
                ['question_number' => 2, 'correct_id' => 'A', 'options' => [
                    ['id' => 'A', 'text' => 'interested'],
                    ['id' => 'B', 'text' => 'interesting'],
                    ['id' => 'C', 'text' => 'interest'],
                    ['id' => 'D', 'text' => 'interestingly'],
                ]],
                ['question_number' => 3, 'correct_id' => 'C', 'options' => [
                    ['id' => 'A', 'text' => 'work'],
                    ['id' => 'B', 'text' => 'have worked'],
                    ['id' => 'C', 'text' => 'worked'],
                    ['id' => 'D', 'text' => 'am working'],
                ]],
                ['question_number' => 4, 'correct_id' => 'D', 'options' => [
                    ['id' => 'A', 'text' => 'taken'],
                    ['id' => 'B', 'text' => 'made'],
                    ['id' => 'C', 'text' => 'done'],
                    ['id' => 'D', 'text' => 'given'],
                ]],
                ['question_number' => 5, 'correct_id' => 'A', 'options' => [
                    ['id' => 'A', 'text' => 'at short'],
                    ['id' => 'B', 'text' => 'in short'],
                    ['id' => 'C', 'text' => 'on short'],
                    ['id' => 'D', 'text' => 'by short'],
                ]],
                ['question_number' => 6, 'correct_id' => 'B', 'options' => [
                    ['id' => 'A', 'text' => 'possibility'],
                    ['id' => 'B', 'text' => 'opportunity'],
                    ['id' => 'C', 'text' => 'occasion'],
                    ['id' => 'D', 'text' => 'permission'],
                ]],
            ],
        ];
    }

    // ─── PART 2: Điền từ vào bài báo ngắn (Q7-12) ──────────────────────────────
    private function section2Cloze(): array
    {
        return [
            'id'                  => 'sec_p2',
            'type'                => 'mc_cloze',
            'points_per_question' => 0.25,
            'title'               => 'PART 2 - Questions 7-12',
            'instructions'        => 'Read the following passage and choose the best option (A, B, C or D) for each blank.',
            'passage' => "Many teenagers today spend a large part of their day online. While the internet offers "
                . "endless (7) ____ for learning and entertainment, it can also be a source of stress. "
                . "Experts (8) ____ that young people should set clear limits on their screen time. "
                . "Spending time outdoors, (9) ____, has been shown to improve both mood and concentration. "
                . "Instead of scrolling through social media, students are (10) ____ to take regular breaks and "
                . "get some fresh air. A short walk can help the brain (11) ____ information more effectively. "
                . "In the long (12) ____, a healthy balance between online and offline life is the key to well-being.",
            'blanks' => [
                ['question_number' => 7, 'correct_id' => 'C', 'options' => [
                    ['id' => 'A', 'text' => 'chances'],
                    ['id' => 'B', 'text' => 'ways'],
                    ['id' => 'C', 'text' => 'opportunities'],
                    ['id' => 'D', 'text' => 'choices'],
                ]],
                ['question_number' => 8, 'correct_id' => 'A', 'options' => [
                    ['id' => 'A', 'text' => 'recommend'],
                    ['id' => 'B', 'text' => 'refuse'],
                    ['id' => 'C', 'text' => 'remind'],
                    ['id' => 'D', 'text' => 'reply'],
                ]],
                ['question_number' => 9, 'correct_id' => 'B', 'options' => [
                    ['id' => 'A', 'text' => 'therefore'],
                    ['id' => 'B', 'text' => 'on the other hand'],
                    ['id' => 'C', 'text' => 'as a result'],
                    ['id' => 'D', 'text' => 'for example'],
                ]],
                ['question_number' => 10, 'correct_id' => 'D', 'options' => [
                    ['id' => 'A', 'text' => 'encouraging'],
                    ['id' => 'B', 'text' => 'encourage'],
                    ['id' => 'C', 'text' => 'encouragement'],
                    ['id' => 'D', 'text' => 'encouraged'],
                ]],
                ['question_number' => 11, 'correct_id' => 'A', 'options' => [
                    ['id' => 'A', 'text' => 'process'],
                    ['id' => 'B', 'text' => 'produce'],
                    ['id' => 'C', 'text' => 'protect'],
                    ['id' => 'D', 'text' => 'promote'],
                ]],
                ['question_number' => 12, 'correct_id' => 'C', 'options' => [
                    ['id' => 'A', 'text' => 'way'],
                    ['id' => 'B', 'text' => 'time'],
                    ['id' => 'C', 'text' => 'run'],
                    ['id' => 'D', 'text' => 'period'],
                ]],
            ],
        ];
    }

    // ─── PART 3: Sắp xếp hội thoại / nối câu (Q13-17) ──────────────────────────
    private function section3Arrange(): array
    {
        return [
            'id'                  => 'sec_p3',
            'type'                => 'matching',
            'points_per_question' => 0.25,
            'title'               => 'PART 3 - Questions 13-17',
            'instructions'        => 'Match each item (1-4) in column 1 with a suitable response/ending (A-F) in column 2 to make a meaningful exchange or sentence.',
            'items' => [
                [
                    'question_number' => 13,
                    'list_1' => [
                        'Would you like to join us for dinner tonight?',
                        'How was your weekend in the countryside?',
                        "I'm really sorry I'm late.",
                        'Could you tell me the way to the station?',
                    ],
                    'list_2' => [
                        "That's all right. Don't worry about it.",
                        "I'd love to, but I have to study.",
                        'It was wonderful and very relaxing.',
                        'Go straight ahead and turn left.',
                        'No, I have never been there.',
                        "You're welcome.",
                    ],
                    'answers' => ['1' => 'B', '2' => 'C', '3' => 'A', '4' => 'D'],
                ],
                [
                    'question_number' => 14,
                    'list_1' => [
                        'Hard though she tried,',
                        'No sooner had the film started',
                        'Only after the storm had passed',
                        'Such was his determination',
                    ],
                    'list_2' => [
                        'than the power went out.',
                        'she could not solve the puzzle.',
                        'did the rescue team set off.',
                        'that nothing could stop him.',
                        'because the room was very quiet.',
                        'unless they leave early.',
                    ],
                    'answers' => ['1' => 'B', '2' => 'A', '3' => 'C', '4' => 'D'],
                ],
                [
                    'question_number' => 15,
                    'list_1' => [
                        'Reducing single-use plastic',
                        'A balanced diet',
                        'Regular physical exercise',
                        'Reading books every day',
                    ],
                    'list_2' => [
                        'helps the body stay strong and healthy.',
                        'can protect the ocean from pollution.',
                        'provides the body with essential nutrients.',
                        'broadens the mind and improves vocabulary.',
                        'is harmful to the environment.',
                        'causes a lot of traffic in the city.',
                    ],
                    'answers' => ['1' => 'B', '2' => 'C', '3' => 'A', '4' => 'D'],
                ],
                [
                    'question_number' => 16,
                    'list_1' => [
                        'If I had known about the test,',
                        'Were I in your position,',
                        'Had it not been for his help,',
                        'Provided that you work hard,',
                    ],
                    'list_2' => [
                        'I would have studied harder.',
                        'I would accept the offer.',
                        'we would have failed the project.',
                        'you will pass the exam easily.',
                        'she will be very surprised.',
                        'they would have arrived on time.',
                    ],
                    'answers' => ['1' => 'A', '2' => 'B', '3' => 'C', '4' => 'D'],
                ],
                [
                    'question_number' => 17,
                    'list_1' => [
                        'The scientist,',
                        'This is the village',
                        'I still remember the day',
                        'She is the only student',
                    ],
                    'list_2' => [
                        'whose research won the prize, gave a speech.',
                        'where my grandparents used to live.',
                        'when we first met at school.',
                        'who has finished all the tasks.',
                        'which is famous for its handicrafts.',
                        'that I bought last week.',
                    ],
                    'answers' => ['1' => 'A', '2' => 'B', '3' => 'C', '4' => 'D'],
                ],
            ],
        ];
    }

    // ─── PART 4: Điền câu/cụm từ dài vào văn bản (Q18-22) ──────────────────────
    private function section4SentenceCloze(): array
    {
        return [
            'id'                  => 'sec_p4',
            'type'                => 'mc_cloze',
            'points_per_question' => 0.25,
            'title'               => 'PART 4 - Questions 18-22',
            'instructions'        => 'Read the passage and choose the option (A, B, C or D) that best fits each numbered blank.',
            'passage' => "Volunteering has become increasingly popular among Vietnamese students. "
                . "(18) ____. They help clean up beaches, teach children in remote areas, and support the elderly. "
                . "For many young people, volunteering is not just about helping others. "
                . "(19) ____, because they learn teamwork, communication and problem-solving skills. "
                . "Of course, balancing study and volunteer work can be challenging. "
                . "(20) ____. However, with good time management, most students find it rewarding. "
                . "Schools also play an important role. (21) ____. "
                . "As a result, the number of student volunteers keeps growing every year. "
                . "(22) ____, and this spirit of giving makes the community stronger.",
            'blanks' => [
                ['question_number' => 18, 'correct_id' => 'C', 'options' => [
                    ['id' => 'A', 'text' => 'Most of them prefer to stay at home during the holidays'],
                    ['id' => 'B', 'text' => 'Volunteering is usually paid quite well in big cities'],
                    ['id' => 'C', 'text' => 'Every year, thousands of them take part in community projects'],
                    ['id' => 'D', 'text' => 'Few teachers are willing to support these activities'],
                ]],
                ['question_number' => 19, 'correct_id' => 'A', 'options' => [
                    ['id' => 'A', 'text' => 'It also benefits the volunteers themselves'],
                    ['id' => 'B', 'text' => 'It often makes them feel bored and tired'],
                    ['id' => 'C', 'text' => 'It has nothing to do with personal growth'],
                    ['id' => 'D', 'text' => 'It is mainly a way to earn extra money'],
                ]],
                ['question_number' => 20, 'correct_id' => 'B', 'options' => [
                    ['id' => 'A', 'text' => 'Nobody really cares about their free time'],
                    ['id' => 'B', 'text' => 'Some students struggle to find enough hours in the day'],
                    ['id' => 'C', 'text' => 'The projects are always cancelled at the last minute'],
                    ['id' => 'D', 'text' => 'Teachers forbid them from joining any clubs'],
                ]],
                ['question_number' => 21, 'correct_id' => 'D', 'options' => [
                    ['id' => 'A', 'text' => 'They discourage students from leaving the classroom'],
                    ['id' => 'B', 'text' => 'They charge a high fee for every activity'],
                    ['id' => 'C', 'text' => 'They rarely mention volunteering to their students'],
                    ['id' => 'D', 'text' => 'Many of them organise regular charity events'],
                ]],
                ['question_number' => 22, 'correct_id' => 'A', 'options' => [
                    ['id' => 'A', 'text' => 'More and more people are inspired to take action'],
                    ['id' => 'B', 'text' => 'Fewer people believe in helping one another'],
                    ['id' => 'C', 'text' => 'The trend is expected to disappear soon'],
                    ['id' => 'D', 'text' => 'Volunteering brings no real value to society'],
                ]],
            ],
        ];
    }

    // ─── PART 5: Đọc hiểu bài 1 (Q23-30) ───────────────────────────────────────
    private function section5Reading(): array
    {
        $passage = "The concept of the \"15-minute city\" has gained attention among urban planners around the world. "
            . "The idea is simple: residents should be able to reach most of their daily needs - such as shops, schools, "
            . "parks and workplaces - within a 15-minute walk or bike ride from home. Supporters argue that this model "
            . "reduces traffic, cuts air pollution and builds stronger local communities.\n\n"
            . "In a traditional city, neighbourhoods are often separated by function. People live in one area, work in "
            . "another and shop in a third, which forces them to rely heavily on cars. The 15-minute city challenges this "
            . "design by mixing homes, offices and services together. As a result, streets become livelier and people "
            . "spend less time commuting.\n\n"
            . "Critics, however, point out several difficulties. Rebuilding existing cities is expensive and slow. "
            . "Moreover, some worry that house prices in well-designed neighbourhoods may rise sharply, pushing poorer "
            . "families out. Despite these concerns, several cities, including Paris and Melbourne, have already begun to "
            . "apply the idea, hoping to create a healthier and more sustainable way of urban living.";

        return [
            'id'                  => 'sec_p5',
            'type'                => 'reading_mixed',
            'points_per_question' => 0.25,
            'title'               => 'PART 5 - Questions 23-30',
            'instructions'        => 'Read the passage and answer questions 23-30.',
            'passage'             => $passage,
            'items' => [
                ['kind' => 'mc', 'question_number' => 23, 'correct_id' => 'B',
                    'prompt' => 'What is the main idea of the passage?',
                    'options' => [
                        ['id' => 'A', 'text' => 'Why cars are necessary in modern cities'],
                        ['id' => 'B', 'text' => 'A new model of urban planning and its debates'],
                        ['id' => 'C', 'text' => 'How to reduce house prices in big cities'],
                        ['id' => 'D', 'text' => 'The history of Paris and Melbourne'],
                    ]],
                ['kind' => 'mc', 'question_number' => 24, 'correct_id' => 'C',
                    'prompt' => 'According to paragraph 1, in a 15-minute city, residents can reach daily needs by',
                    'options' => [
                        ['id' => 'A', 'text' => 'driving a car for 15 minutes'],
                        ['id' => 'B', 'text' => 'taking a long train journey'],
                        ['id' => 'C', 'text' => 'walking or cycling for a short time'],
                        ['id' => 'D', 'text' => 'flying to another district'],
                    ]],
                ['kind' => 'mc', 'question_number' => 25, 'correct_id' => 'A',
                    'prompt' => 'The word "this model" in paragraph 1 refers to',
                    'options' => [
                        ['id' => 'A', 'text' => 'the 15-minute city'],
                        ['id' => 'B', 'text' => 'air pollution'],
                        ['id' => 'C', 'text' => 'traffic jams'],
                        ['id' => 'D', 'text' => 'local communities'],
                    ]],
                ['kind' => 'mc', 'question_number' => 26, 'correct_id' => 'D',
                    'prompt' => 'According to paragraph 2, traditional cities force people to',
                    'options' => [
                        ['id' => 'A', 'text' => 'live close to their workplaces'],
                        ['id' => 'B', 'text' => 'walk everywhere they go'],
                        ['id' => 'C', 'text' => 'avoid shopping in other areas'],
                        ['id' => 'D', 'text' => 'depend a lot on cars'],
                    ]],
                ['kind' => 'mc', 'question_number' => 27, 'correct_id' => 'B',
                    'prompt' => 'The word "livelier" in paragraph 2 is closest in meaning to',
                    'options' => [
                        ['id' => 'A', 'text' => 'quieter'],
                        ['id' => 'B', 'text' => 'more active'],
                        ['id' => 'C', 'text' => 'more dangerous'],
                        ['id' => 'D', 'text' => 'emptier'],
                    ]],
                ['kind' => 'mc', 'question_number' => 28, 'correct_id' => 'C',
                    'prompt' => 'Which of the following is mentioned as a concern of critics?',
                    'options' => [
                        ['id' => 'A', 'text' => 'Cars will become cheaper'],
                        ['id' => 'B', 'text' => 'People will walk too much'],
                        ['id' => 'C', 'text' => 'House prices may rise sharply'],
                        ['id' => 'D', 'text' => 'Streets will be too quiet'],
                    ]],
                ['kind' => 'mc', 'question_number' => 29, 'correct_id' => 'A',
                    'prompt' => 'It can be inferred from the passage that the author is',
                    'options' => [
                        ['id' => 'A', 'text' => 'cautiously optimistic about the idea'],
                        ['id' => 'B', 'text' => 'completely against the idea'],
                        ['id' => 'C', 'text' => 'not interested in city planning'],
                        ['id' => 'D', 'text' => 'sure the idea will fail'],
                    ]],
                ['kind' => 'mc', 'question_number' => 30, 'correct_id' => 'D',
                    'prompt' => 'Which cities are mentioned as already applying the idea?',
                    'options' => [
                        ['id' => 'A', 'text' => 'London and Tokyo'],
                        ['id' => 'B', 'text' => 'New York and Berlin'],
                        ['id' => 'C', 'text' => 'Hanoi and Bangkok'],
                        ['id' => 'D', 'text' => 'Paris and Melbourne'],
                    ]],
            ],
        ];
    }

    // ─── PART 6: Đọc hiểu bài 2 (Q31-40) ───────────────────────────────────────
    private function section6Reading(): array
    {
        $passage = "For centuries, honeybees have played a vital role in agriculture. As they move from flower to flower "
            . "collecting nectar, they transfer pollen, allowing plants to produce fruits and seeds. It is estimated that "
            . "about one third of the food we eat depends, directly or indirectly, on pollination by bees and other insects.\n\n"
            . "In recent decades, however, bee populations in many parts of the world have been declining. Scientists "
            . "believe that several factors are responsible. The widespread use of pesticides can poison bees or weaken "
            . "their immune systems. The loss of wild flowers, caused by the expansion of farmland and cities, reduces the "
            . "food available to them. In addition, a tiny parasite known as the Varroa mite attacks bee colonies and "
            . "spreads diseases.\n\n"
            . "The decline of bees is not only an environmental problem but also an economic one. Farmers who grow crops "
            . "such as apples, almonds and coffee rely on bees to guarantee a good harvest. Without enough pollinators, "
            . "yields fall and food prices may rise.\n\n"
            . "Fortunately, people are taking action. Many farmers are reducing their use of harmful chemicals and planting "
            . "flowers along the edges of their fields. City dwellers are setting up beehives on rooftops and in gardens. "
            . "Such small efforts, when combined, can make a real difference in protecting these remarkable insects.";

        return [
            'id'                  => 'sec_p6',
            'type'                => 'reading_mixed',
            'points_per_question' => 0.25,
            'title'               => 'PART 6 - Questions 31-40',
            'instructions'        => 'Read the passage and answer questions 31-40.',
            'passage'             => $passage,
            'items' => [
                ['kind' => 'mc', 'question_number' => 31, 'correct_id' => 'C',
                    'prompt' => 'What is the passage mainly about?',
                    'options' => [
                        ['id' => 'A', 'text' => 'How to start a beekeeping business'],
                        ['id' => 'B', 'text' => 'The life cycle of a honeybee'],
                        ['id' => 'C', 'text' => 'The importance of bees and the threats they face'],
                        ['id' => 'D', 'text' => 'Different types of fruit trees'],
                    ]],
                ['kind' => 'mc', 'question_number' => 32, 'correct_id' => 'B',
                    'prompt' => 'According to paragraph 1, bees help plants by',
                    'options' => [
                        ['id' => 'A', 'text' => 'eating harmful insects'],
                        ['id' => 'B', 'text' => 'transferring pollen between flowers'],
                        ['id' => 'C', 'text' => 'producing honey for farmers'],
                        ['id' => 'D', 'text' => 'protecting them from the sun'],
                    ]],
                ['kind' => 'mc', 'question_number' => 33, 'correct_id' => 'D',
                    'prompt' => 'About how much of our food depends on pollination?',
                    'options' => [
                        ['id' => 'A', 'text' => 'All of it'],
                        ['id' => 'B', 'text' => 'A half'],
                        ['id' => 'C', 'text' => 'A quarter'],
                        ['id' => 'D', 'text' => 'About one third'],
                    ]],
                ['kind' => 'mc', 'question_number' => 34, 'correct_id' => 'A',
                    'prompt' => 'Which of the following is NOT mentioned as a cause of bee decline?',
                    'options' => [
                        ['id' => 'A', 'text' => 'Climate change and rising sea levels'],
                        ['id' => 'B', 'text' => 'The use of pesticides'],
                        ['id' => 'C', 'text' => 'The loss of wild flowers'],
                        ['id' => 'D', 'text' => 'The Varroa mite'],
                    ]],
                ['kind' => 'mc', 'question_number' => 35, 'correct_id' => 'B',
                    'prompt' => 'The word "them" in paragraph 2 refers to',
                    'options' => [
                        ['id' => 'A', 'text' => 'cities'],
                        ['id' => 'B', 'text' => 'bees'],
                        ['id' => 'C', 'text' => 'pesticides'],
                        ['id' => 'D', 'text' => 'wild flowers'],
                    ]],
                ['kind' => 'mc', 'question_number' => 36, 'correct_id' => 'C',
                    'prompt' => 'According to paragraph 3, the decline of bees may lead to',
                    'options' => [
                        ['id' => 'A', 'text' => 'lower food prices'],
                        ['id' => 'B', 'text' => 'more wild flowers'],
                        ['id' => 'C', 'text' => 'falling crop yields'],
                        ['id' => 'D', 'text' => 'fewer pesticides'],
                    ]],
                ['kind' => 'mc', 'question_number' => 37, 'correct_id' => 'A',
                    'prompt' => 'The word "guarantee" in paragraph 3 is closest in meaning to',
                    'options' => [
                        ['id' => 'A', 'text' => 'ensure'],
                        ['id' => 'B', 'text' => 'destroy'],
                        ['id' => 'C', 'text' => 'delay'],
                        ['id' => 'D', 'text' => 'reduce'],
                    ]],
                ['kind' => 'mc', 'question_number' => 38, 'correct_id' => 'D',
                    'prompt' => 'Which crop is given as an example in paragraph 3?',
                    'options' => [
                        ['id' => 'A', 'text' => 'Rice'],
                        ['id' => 'B', 'text' => 'Wheat'],
                        ['id' => 'C', 'text' => 'Corn'],
                        ['id' => 'D', 'text' => 'Almonds'],
                    ]],
                ['kind' => 'mc', 'question_number' => 39, 'correct_id' => 'B',
                    'prompt' => 'According to the last paragraph, what are city dwellers doing to help?',
                    'options' => [
                        ['id' => 'A', 'text' => 'Using more chemicals'],
                        ['id' => 'B', 'text' => 'Setting up beehives on rooftops and in gardens'],
                        ['id' => 'C', 'text' => 'Cutting down all the flowers'],
                        ['id' => 'D', 'text' => 'Moving to the countryside'],
                    ]],
                ['kind' => 'mc', 'question_number' => 40, 'correct_id' => 'A',
                    'prompt' => 'What is the tone of the final paragraph?',
                    'options' => [
                        ['id' => 'A', 'text' => 'Hopeful'],
                        ['id' => 'B', 'text' => 'Angry'],
                        ['id' => 'C', 'text' => 'Hopeless'],
                        ['id' => 'D', 'text' => 'Indifferent'],
                    ]],
            ],
        ];
    }
}

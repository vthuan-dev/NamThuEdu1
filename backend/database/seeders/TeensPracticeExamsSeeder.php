<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\Exam;
use App\Models\Question;
use App\Models\Answer;

/**
 * TeensPracticeExamsSeeder
 *
 * Seed 15 đề LUYỆN TẬP nhỏ cho học viên TEENS (13–17), nội dung + đáp án THẬT.
 * Mỗi đề là 1 part nhỏ (~10 câu) tập trung 1 chủ điểm (grammar / vocabulary /
 * reading). Dùng format GENERAL (objective) → chấm điểm tự động, hợp engine teens.
 *
 * Đề được:
 *  - published + public (eIs_private=false, age_group='teens')
 *  - gán (assignment individual) cho MỌI học viên teens hiện có → ai login cũng thấy
 *
 * Chạy:  php artisan db:seed --class=TeensPracticeExamsSeeder
 */
class TeensPracticeExamsSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('🌱 Seeding TEENS practice exams (real content)...');

        // 1. Giáo viên đứng tên đề (reuse nếu có)
        $teacher = User::where('uRole', 'teacher')->whereNull('uDeleted_at')->first()
            ?? User::firstOrCreate(
                ['uPhone' => '0905550001'],
                [
                    'uName'     => 'GV Teens Demo',
                    'uPassword' => Hash::make('password123'),
                    'uRole'     => 'teacher',
                    'uStatus'   => 'active',
                    'uGender'   => 1,
                ]
            );

        $exams = $this->examBank();
        $createdExamIds = [];

        foreach ($exams as $def) {
            $exam = Exam::firstOrCreate(
                ['eTitle' => $def['title']],
                [
                    'eDescription'      => $def['description'],
                    'eType'             => 'GENERAL',
                    'eSkill'            => 'mixed',
                    'ePurpose'          => 'exam',
                    'eDifficulty'       => $def['difficulty'],
                    'eTeacher_id'       => $teacher->uId,
                    'eDuration_minutes' => $def['duration'],
                    'eTotal_score'      => 100,
                    'ePass_score'       => 50,
                    'eIs_private'       => false,
                    'eSource_type'      => 'manual',
                    'eStatus'           => 'published',
                    'age_group'         => 'teens',
                ]
            );

            if ($exam->questions()->count() === 0) {
                $pointEach = (int) round(100 / max(1, count($def['questions'])));
                foreach ($def['questions'] as $i => $q) {
                    $question = Question::create([
                        'exam_id'        => $exam->eId,
                        'qContent'       => $q['content'],
                        'qType'          => $q['type'],
                        'qSection'       => $q['section'],
                        'qSkill'         => $q['section'],
                        'qSection_order' => $i + 1,
                        'qPoints'        => $pointEach,
                        'qDifficulty'    => $def['difficulty'],
                        'qPassage_text'  => $q['passage'] ?? null,
                    ]);

                    if (!empty($q['options'])) {
                        // multiple_choice / true_false
                        foreach ($q['options'] as $idx => $optText) {
                            Answer::create([
                                'question_id' => $question->qId,
                                'aContent'    => $optText,
                                'aIs_correct' => $idx === ($q['correct'] ?? -1),
                            ]);
                        }
                    } elseif (isset($q['answer'])) {
                        // fill_blank / short_answer
                        Answer::create([
                            'question_id' => $question->qId,
                            'aContent'    => $q['answer'],
                            'aIs_correct' => true,
                        ]);
                    }
                }
                $this->command->info("   ✓ {$def['title']} (" . count($def['questions']) . ' câu)');
            } else {
                $this->command->info("   • {$def['title']} đã có câu hỏi, bỏ qua");
            }

            $createdExamIds[] = $exam->eId;
        }

        // Không auto-giao bài (assignment). Đề published + age_group=teens là teens
        // đã thấy trong thư viện đề để luyện tập. Việc "giao bài" (kèm deadline/nhắc)
        // do giáo viên chủ động làm trên UI khi cần.

        $this->command->info('✅ Done. Tổng ' . count($createdExamIds) . ' đề luyện tập teens (published).');
    }

    /** Helper: dựng 1 câu trắc nghiệm. */
    private function mc(string $section, string $content, array $options, int $correct): array
    {
        return ['type' => 'multiple_choice', 'section' => $section, 'content' => $content, 'options' => $options, 'correct' => $correct];
    }

    /** Helper: câu đúng/sai. */
    private function tf(string $section, string $content, bool $isTrue): array
    {
        return ['type' => 'true_false', 'section' => $section, 'content' => $content, 'options' => ['True', 'False'], 'correct' => $isTrue ? 0 : 1];
    }

    /** Helper: điền từ. */
    private function fb(string $section, string $content, string $answer): array
    {
        return ['type' => 'fill_blank', 'section' => $section, 'content' => $content, 'answer' => $answer];
    }

    /**
     * 15 đề luyện tập teens — nội dung + đáp án thật.
     */
    private function examBank(): array
    {
        return array_merge(
            $this->grammarExams(),
            $this->vocabExams(),
            $this->readingExams()
        );
    }

    /** ───────── GRAMMAR (6 đề) ───────── */
    private function grammarExams(): array
    {
        return [
            [
                'title' => 'Luyện tập: Present Simple (Hiện tại đơn)',
                'description' => 'Chia động từ thì hiện tại đơn, thêm s/es, câu phủ định và nghi vấn.',
                'difficulty' => 'easy', 'duration' => 15,
                'questions' => [
                    $this->mc('grammar', 'She ___ to school every morning.', ['go', 'goes', 'going', 'went'], 1),
                    $this->mc('grammar', 'They ___ football on Sundays.', ['plays', 'play', 'playing', 'played'], 1),
                    $this->mc('grammar', 'My father ___ coffee every day.', ['drink', 'drinks', 'drinking', 'drank'], 1),
                    $this->mc('grammar', 'He ___ like vegetables.', ["doesn't", "don't", "isn't", "aren't"], 0),
                    $this->mc('grammar', '___ you live near here?', ['Does', 'Do', 'Are', 'Is'], 1),
                    $this->mc('grammar', 'Water ___ at 100 degrees Celsius.', ['boil', 'boils', 'boiling', 'boiled'], 1),
                    $this->mc('grammar', 'We usually ___ dinner at 7 p.m.', ['has', 'have', 'having', 'had'], 1),
                    $this->fb('grammar', 'Complete: My sister ___ (study) English at school.', 'studies'),
                    $this->tf('grammar', 'Correct? — "He watch TV every night."', false),
                    $this->mc('grammar', 'The sun ___ in the east.', ['rise', 'rises', 'rising', 'rose'], 1),
                ],
            ],
            [
                'title' => 'Luyện tập: Past Simple (Quá khứ đơn)',
                'description' => 'Động từ quá khứ đơn — quy tắc và bất quy tắc, câu phủ định/nghi vấn.',
                'difficulty' => 'easy', 'duration' => 15,
                'questions' => [
                    $this->mc('grammar', 'Yesterday I ___ to the cinema.', ['go', 'went', 'gone', 'going'], 1),
                    $this->mc('grammar', 'She ___ her homework last night.', ['do', 'did', 'does', 'done'], 1),
                    $this->mc('grammar', 'They ___ a great time at the party.', ['have', 'had', 'has', 'having'], 1),
                    $this->mc('grammar', 'He ___ not call me last week.', ['did', 'do', 'does', 'was'], 0),
                    $this->mc('grammar', '___ you see the match yesterday?', ['Do', 'Did', 'Was', 'Were'], 1),
                    $this->mc('grammar', 'We ___ in Hanoi in 2019.', ['live', 'lived', 'lives', 'living'], 1),
                    $this->mc('grammar', 'The film ___ at 8 o\'clock.', ['start', 'started', 'starts', 'starting'], 1),
                    $this->fb('grammar', 'Complete: She ___ (buy) a new phone last month.', 'bought'),
                    $this->tf('grammar', 'Correct? — "I seen him yesterday."', false),
                    $this->mc('grammar', 'They ___ to London two years ago.', ['move', 'moved', 'moves', 'moving'], 1),
                ],
            ],
            [
                'title' => 'Luyện tập: Present Continuous (Hiện tại tiếp diễn)',
                'description' => 'Cấu trúc am/is/are + V-ing, hành động đang diễn ra.',
                'difficulty' => 'easy', 'duration' => 12,
                'questions' => [
                    $this->mc('grammar', 'Look! The baby ___ .', ['cry', 'cries', 'is crying', 'cried'], 2),
                    $this->mc('grammar', 'They ___ TV at the moment.', ['watch', 'watches', 'are watching', 'watched'], 2),
                    $this->mc('grammar', 'I ___ for the bus now.', ['wait', 'am waiting', 'waits', 'waited'], 1),
                    $this->mc('grammar', 'She ___ a book right now.', ['read', 'reads', 'is reading', 'reading'], 2),
                    $this->mc('grammar', 'We ___ dinner at the moment.', ['have', 'are having', 'has', 'had'], 1),
                    $this->mc('grammar', 'Listen! Someone ___ the piano.', ['play', 'plays', 'is playing', 'played'], 2),
                    $this->fb('grammar', 'Complete: He ___ (run) in the park now.', 'is running'),
                    $this->tf('grammar', 'Correct? — "They is playing games."', false),
                    $this->mc('grammar', 'What ___ you ___ now?', ['do / do', 'are / doing', 'is / doing', 'do / doing'], 1),
                    $this->mc('grammar', 'The students ___ a test now.', ['take', 'are taking', 'takes', 'took'], 1),
                ],
            ],
            [
                'title' => 'Luyện tập: Comparatives & Superlatives (So sánh)',
                'description' => 'So sánh hơn và so sánh nhất của tính từ.',
                'difficulty' => 'medium', 'duration' => 15,
                'questions' => [
                    $this->mc('grammar', 'This book is ___ than that one.', ['interesting', 'more interesting', 'most interesting', 'interestinger'], 1),
                    $this->mc('grammar', 'Mount Everest is the ___ mountain in the world.', ['high', 'higher', 'highest', 'most high'], 2),
                    $this->mc('grammar', 'My bag is ___ than yours.', ['heavy', 'heavier', 'heaviest', 'more heavy'], 1),
                    $this->mc('grammar', 'She is the ___ student in the class.', ['good', 'better', 'best', 'goodest'], 2),
                    $this->mc('grammar', 'A car is ___ than a bicycle.', ['fast', 'faster', 'fastest', 'more fast'], 1),
                    $this->mc('grammar', 'This is the ___ film I have ever seen.', ['bad', 'worse', 'worst', 'baddest'], 2),
                    $this->mc('grammar', 'English is ___ than Maths, in my opinion.', ['easy', 'easier', 'easiest', 'more easy'], 1),
                    $this->fb('grammar', 'Complete: Today is ___ (hot) than yesterday.', 'hotter'),
                    $this->tf('grammar', 'Correct? — "She is more taller than me."', false),
                    $this->mc('grammar', 'It was the ___ day of my life.', ['happy', 'happier', 'happiest', 'most happy'], 2),
                ],
            ],
            [
                'title' => 'Luyện tập: Prepositions (Giới từ in/on/at)',
                'description' => 'Giới từ chỉ thời gian và nơi chốn: in, on, at.',
                'difficulty' => 'medium', 'duration' => 12,
                'questions' => [
                    $this->mc('grammar', 'I was born ___ 2010.', ['in', 'on', 'at', 'to'], 0),
                    $this->mc('grammar', 'We have English ___ Monday.', ['in', 'on', 'at', 'to'], 1),
                    $this->mc('grammar', 'The film starts ___ 8 o\'clock.', ['in', 'on', 'at', 'to'], 2),
                    $this->mc('grammar', 'There is a clock ___ the wall.', ['in', 'on', 'at', 'to'], 1),
                    $this->mc('grammar', 'She lives ___ Da Nang.', ['in', 'on', 'at', 'to'], 0),
                    $this->mc('grammar', 'See you ___ the weekend!', ['in', 'on', 'at', 'of'], 2),
                    $this->mc('grammar', 'The keys are ___ the table.', ['in', 'on', 'at', 'to'], 1),
                    $this->fb('grammar', 'Complete: My birthday is ___ July.', 'in'),
                    $this->tf('grammar', 'Correct? — "I get up at 6 a.m."', true),
                    $this->mc('grammar', 'He is waiting ___ the bus stop.', ['in', 'on', 'at', 'to'], 2),
                ],
            ],
            [
                'title' => 'Luyện tập: Articles (Mạo từ a/an/the)',
                'description' => 'Cách dùng mạo từ a, an, the và trường hợp không dùng mạo từ.',
                'difficulty' => 'medium', 'duration' => 12,
                'questions' => [
                    $this->mc('grammar', 'I saw ___ elephant at the zoo.', ['a', 'an', 'the', '-'], 1),
                    $this->mc('grammar', 'She is ___ honest girl.', ['a', 'an', 'the', '-'], 1),
                    $this->mc('grammar', '___ sun is very bright today.', ['A', 'An', 'The', '-'], 2),
                    $this->mc('grammar', 'He plays ___ guitar very well.', ['a', 'an', 'the', '-'], 2),
                    $this->mc('grammar', 'I had ___ apple for breakfast.', ['a', 'an', 'the', '-'], 1),
                    $this->mc('grammar', 'We go to ___ school by bus.', ['a', 'an', 'the', '-'], 3),
                    $this->mc('grammar', 'There is ___ university near my house.', ['a', 'an', 'the', '-'], 0),
                    $this->fb('grammar', 'Complete: I want to be ___ engineer. (a/an)', 'an'),
                    $this->tf('grammar', 'Correct? — "He is a best student in class."', false),
                    $this->mc('grammar', 'Could you pass me ___ salt, please?', ['a', 'an', 'the', '-'], 2),
                ],
            ],
        ];
    }

    /** ───────── VOCABULARY (5 đề) ───────── */
    private function vocabExams(): array
    {
        return [
            [
                'title' => 'Từ vựng: Family & Friends',
                'description' => 'Từ vựng về gia đình, người thân và bạn bè.',
                'difficulty' => 'easy', 'duration' => 12,
                'questions' => [
                    $this->mc('vocabulary', 'Your mother\'s sister is your ___.', ['uncle', 'aunt', 'cousin', 'niece'], 1),
                    $this->mc('vocabulary', 'Your father\'s father is your ___.', ['grandmother', 'grandfather', 'brother', 'son'], 1),
                    $this->mc('vocabulary', 'A boy who has the same parents as you is your ___.', ['sister', 'brother', 'cousin', 'father'], 1),
                    $this->mc('vocabulary', 'The opposite of "old" (people) is ___.', ['young', 'new', 'small', 'short'], 0),
                    $this->mc('vocabulary', 'Your aunt\'s children are your ___.', ['nieces', 'nephews', 'cousins', 'siblings'], 2),
                    $this->mc('vocabulary', 'A person you study with and like is a ___.', ['stranger', 'friend', 'teacher', 'boss'], 1),
                    $this->mc('vocabulary', 'Your parents\' parents are your ___.', ['grandparents', 'children', 'relatives', 'neighbours'], 0),
                    $this->fb('vocabulary', 'Your brother\'s wife is your sister-in-___.', 'law'),
                    $this->tf('vocabulary', 'A "twin" means two children born at the same time.', true),
                    $this->mc('vocabulary', 'A married woman is a ___.', ['wife', 'husband', 'widow', 'single'], 0),
                ],
            ],
            [
                'title' => 'Từ vựng: Food & Drinks',
                'description' => 'Từ vựng về đồ ăn, thức uống và bữa ăn.',
                'difficulty' => 'easy', 'duration' => 12,
                'questions' => [
                    $this->mc('vocabulary', 'We eat ___ in the morning.', ['dinner', 'breakfast', 'lunch', 'supper'], 1),
                    $this->mc('vocabulary', 'A ___ is a yellow fruit.', ['apple', 'banana', 'grape', 'cherry'], 1),
                    $this->mc('vocabulary', 'We use a ___ to eat soup.', ['fork', 'knife', 'spoon', 'plate'], 2),
                    $this->mc('vocabulary', 'Milk comes from a ___.', ['hen', 'cow', 'pig', 'sheep'], 1),
                    $this->mc('vocabulary', 'Which one is a vegetable?', ['orange', 'carrot', 'mango', 'lemon'], 1),
                    $this->mc('vocabulary', 'The opposite of "sweet" is ___.', ['salty', 'bitter', 'sour', 'spicy'], 2),
                    $this->mc('vocabulary', 'We drink ___ when we are thirsty.', ['bread', 'water', 'rice', 'meat'], 1),
                    $this->fb('vocabulary', 'A hot drink made from coffee beans is ___.', 'coffee'),
                    $this->tf('vocabulary', 'Beef is meat from a cow.', true),
                    $this->mc('vocabulary', 'A place where you buy bread is a ___.', ['butcher', 'bakery', 'library', 'pharmacy'], 1),
                ],
            ],
            [
                'title' => 'Từ vựng: School & Subjects',
                'description' => 'Từ vựng về trường học, môn học và đồ dùng học tập.',
                'difficulty' => 'easy', 'duration' => 12,
                'questions' => [
                    $this->mc('vocabulary', 'We study numbers in ___.', ['History', 'Maths', 'Music', 'Art'], 1),
                    $this->mc('vocabulary', 'We use a ___ to write on the board.', ['pen', 'chalk', 'ruler', 'book'], 1),
                    $this->mc('vocabulary', 'A person who teaches is a ___.', ['student', 'teacher', 'doctor', 'driver'], 1),
                    $this->mc('vocabulary', 'We study about the past in ___.', ['Geography', 'History', 'Biology', 'Physics'], 1),
                    $this->mc('vocabulary', 'We draw pictures in ___ class.', ['Art', 'Maths', 'English', 'PE'], 0),
                    $this->mc('vocabulary', 'A ___ is where you borrow books.', ['canteen', 'library', 'gym', 'lab'], 1),
                    $this->mc('vocabulary', 'We do experiments in the ___.', ['playground', 'laboratory', 'office', 'hall'], 1),
                    $this->fb('vocabulary', 'The subject about living things is ___.', 'Biology'),
                    $this->tf('vocabulary', '"PE" means Physical Education.', true),
                    $this->mc('vocabulary', 'We use a ___ to measure a straight line.', ['rubber', 'ruler', 'sharpener', 'glue'], 1),
                ],
            ],
            [
                'title' => 'Từ vựng: Jobs & Work',
                'description' => 'Từ vựng về nghề nghiệp và nơi làm việc.',
                'difficulty' => 'medium', 'duration' => 12,
                'questions' => [
                    $this->mc('vocabulary', 'A person who flies a plane is a ___.', ['driver', 'pilot', 'sailor', 'guard'], 1),
                    $this->mc('vocabulary', 'A ___ helps sick people.', ['teacher', 'doctor', 'farmer', 'cook'], 1),
                    $this->mc('vocabulary', 'A person who cooks food in a restaurant is a ___.', ['waiter', 'chef', 'host', 'cleaner'], 1),
                    $this->mc('vocabulary', 'A ___ puts out fires.', ['police officer', 'firefighter', 'nurse', 'guard'], 1),
                    $this->mc('vocabulary', 'A person who fixes cars is a ___.', ['mechanic', 'engineer', 'architect', 'plumber'], 0),
                    $this->mc('vocabulary', 'A ___ grows crops and raises animals.', ['farmer', 'baker', 'tailor', 'miner'], 0),
                    $this->mc('vocabulary', 'A person who designs buildings is an ___.', ['architect', 'artist', 'actor', 'author'], 0),
                    $this->fb('vocabulary', 'A person who teaches at university is a ___ (begins with "l").', 'lecturer'),
                    $this->tf('vocabulary', 'A "vet" is a doctor for animals.', true),
                    $this->mc('vocabulary', 'A ___ serves food to customers.', ['waiter', 'chef', 'farmer', 'pilot'], 0),
                ],
            ],
            [
                'title' => 'Từ vựng: Synonyms & Antonyms',
                'description' => 'Từ đồng nghĩa và trái nghĩa thường gặp.',
                'difficulty' => 'medium', 'duration' => 12,
                'questions' => [
                    $this->mc('vocabulary', 'Choose a synonym for "big".', ['small', 'large', 'tiny', 'short'], 1),
                    $this->mc('vocabulary', 'Choose an antonym for "happy".', ['glad', 'sad', 'joyful', 'pleased'], 1),
                    $this->mc('vocabulary', 'Choose a synonym for "fast".', ['slow', 'quick', 'late', 'lazy'], 1),
                    $this->mc('vocabulary', 'Choose an antonym for "begin".', ['start', 'open', 'finish', 'create'], 2),
                    $this->mc('vocabulary', 'Choose a synonym for "beautiful".', ['ugly', 'pretty', 'plain', 'dark'], 1),
                    $this->mc('vocabulary', 'Choose an antonym for "difficult".', ['hard', 'tough', 'easy', 'complex'], 2),
                    $this->mc('vocabulary', 'Choose a synonym for "smart".', ['silly', 'clever', 'slow', 'weak'], 1),
                    $this->fb('vocabulary', 'The opposite of "buy" is ___.', 'sell'),
                    $this->tf('vocabulary', '"Tiny" and "huge" are antonyms.', true),
                    $this->mc('vocabulary', 'Choose a synonym for "rich".', ['poor', 'wealthy', 'cheap', 'broke'], 1),
                ],
            ],
        ];
    }

    /** ───────── READING (4 đề) ───────── */
    private function readingExams(): array
    {
        $p1 = "Minh is a 14-year-old student in Ho Chi Minh City. Every morning, he gets up at 6 o'clock and has breakfast with his family. He goes to school by bike because his school is only two kilometres away. Minh's favourite subject is English, and he wants to be an English teacher in the future. After school, he often plays badminton with his friends and helps his mother cook dinner.";

        $p2 = "The blue whale is the largest animal that has ever lived on Earth. It can grow up to 30 metres long and weigh as much as 200 tonnes. Despite its huge size, the blue whale eats tiny sea creatures called krill. In summer, a blue whale can eat up to four tonnes of krill in one day. Sadly, blue whales are now an endangered species because of hunting in the past and pollution in the oceans.";

        $p3 = "Lan and her family went on a trip to Da Lat last weekend. They left home early on Saturday morning and arrived in the afternoon. The weather in Da Lat was cool and pleasant. On the first day, they visited a beautiful flower garden and took many photos. The next day, they went to a local market and bought some strawberries and warm clothes. Lan enjoyed the trip very much and hopes to come back next year.";

        $p4 = "Many teenagers today spend too much time on their smartphones. They use phones to chat with friends, play games, and watch videos. While phones can be useful for learning and staying in touch, using them too much can be harmful. It can cause eye problems, poor sleep, and less time for exercise. Experts say that teenagers should limit screen time to about two hours a day and spend more time on outdoor activities.";

        return [
            [
                'title' => 'Đọc hiểu: A Day in Minh\'s Life',
                'description' => 'Đoạn văn về sinh hoạt hằng ngày + câu hỏi đọc hiểu.',
                'difficulty' => 'easy', 'duration' => 15,
                'questions' => [
                    array_merge($this->mc('reading', 'How old is Minh?', ['12', '13', '14', '15'], 2), ['passage' => $p1]),
                    array_merge($this->mc('reading', 'How does Minh go to school?', ['by bus', 'by bike', 'on foot', 'by car'], 1), ['passage' => $p1]),
                    array_merge($this->mc('reading', 'What is Minh\'s favourite subject?', ['Maths', 'English', 'History', 'Art'], 1), ['passage' => $p1]),
                    array_merge($this->mc('reading', 'What does Minh want to be?', ['a doctor', 'an engineer', 'an English teacher', 'a pilot'], 2), ['passage' => $p1]),
                    array_merge($this->mc('reading', 'What time does Minh get up?', ['5 o\'clock', '6 o\'clock', '7 o\'clock', '8 o\'clock'], 1), ['passage' => $p1]),
                    array_merge($this->tf('reading', 'Minh helps his mother cook dinner.', true), ['passage' => $p1]),
                    array_merge($this->tf('reading', 'Minh\'s school is far from his house.', false), ['passage' => $p1]),
                    array_merge($this->mc('reading', 'What sport does Minh play after school?', ['football', 'badminton', 'tennis', 'swimming'], 1), ['passage' => $p1]),
                ],
            ],
            [
                'title' => 'Đọc hiểu: The Blue Whale',
                'description' => 'Đoạn văn khoa học về cá voi xanh + câu hỏi.',
                'difficulty' => 'medium', 'duration' => 15,
                'questions' => [
                    array_merge($this->mc('reading', 'What is the blue whale?', ['the fastest animal', 'the largest animal ever', 'the smallest whale', 'a kind of fish'], 1), ['passage' => $p2]),
                    array_merge($this->mc('reading', 'How long can a blue whale grow?', ['up to 20 m', 'up to 30 m', 'up to 40 m', 'up to 10 m'], 1), ['passage' => $p2]),
                    array_merge($this->mc('reading', 'What does the blue whale eat?', ['fish', 'krill', 'plants', 'birds'], 1), ['passage' => $p2]),
                    array_merge($this->mc('reading', 'How much krill can it eat in one day in summer?', ['one tonne', 'two tonnes', 'four tonnes', 'ten tonnes'], 2), ['passage' => $p2]),
                    array_merge($this->tf('reading', 'The blue whale is an endangered species.', true), ['passage' => $p2]),
                    array_merge($this->tf('reading', 'Krill are large sea animals.', false), ['passage' => $p2]),
                    array_merge($this->mc('reading', 'Which is a reason blue whales are endangered?', ['too much food', 'ocean pollution', 'cold weather', 'too many babies'], 1), ['passage' => $p2]),
                    array_merge($this->fb('reading', 'A blue whale can weigh as much as ___ tonnes.', '200'), ['passage' => $p2]),
                ],
            ],
            [
                'title' => 'Đọc hiểu: A Trip to Da Lat',
                'description' => 'Đoạn văn kể chuyến đi du lịch + câu hỏi.',
                'difficulty' => 'easy', 'duration' => 15,
                'questions' => [
                    array_merge($this->mc('reading', 'Where did Lan\'s family go?', ['Da Nang', 'Da Lat', 'Hanoi', 'Hue'], 1), ['passage' => $p3]),
                    array_merge($this->mc('reading', 'When did they leave home?', ['Friday night', 'Saturday morning', 'Sunday morning', 'Saturday afternoon'], 1), ['passage' => $p3]),
                    array_merge($this->mc('reading', 'How was the weather in Da Lat?', ['hot and dry', 'cool and pleasant', 'rainy', 'windy'], 1), ['passage' => $p3]),
                    array_merge($this->mc('reading', 'What did they visit on the first day?', ['a market', 'a flower garden', 'a museum', 'a beach'], 1), ['passage' => $p3]),
                    array_merge($this->mc('reading', 'What did they buy at the market?', ['shoes and bags', 'strawberries and warm clothes', 'books', 'toys'], 1), ['passage' => $p3]),
                    array_merge($this->tf('reading', 'Lan enjoyed the trip.', true), ['passage' => $p3]),
                    array_merge($this->tf('reading', 'They arrived in Da Lat in the morning.', false), ['passage' => $p3]),
                    array_merge($this->fb('reading', 'Lan hopes to come back ___ year.', 'next'), ['passage' => $p3]),
                ],
            ],
            [
                'title' => 'Đọc hiểu: Teenagers and Smartphones',
                'description' => 'Đoạn văn nghị luận về dùng điện thoại + câu hỏi.',
                'difficulty' => 'medium', 'duration' => 15,
                'questions' => [
                    array_merge($this->mc('reading', 'What is the main topic of the passage?', ['video games', 'teenagers and smartphones', 'school subjects', 'sports'], 1), ['passage' => $p4]),
                    array_merge($this->mc('reading', 'What do teenagers use phones for?', ['only studying', 'chatting, gaming, and watching videos', 'only calling', 'nothing'], 1), ['passage' => $p4]),
                    array_merge($this->mc('reading', 'Which is NOT a harmful effect mentioned?', ['eye problems', 'poor sleep', 'better grades', 'less exercise'], 2), ['passage' => $p4]),
                    array_merge($this->mc('reading', 'How many hours of screen time do experts suggest?', ['about one hour', 'about two hours', 'about four hours', 'no limit'], 1), ['passage' => $p4]),
                    array_merge($this->tf('reading', 'Phones can be useful for learning.', true), ['passage' => $p4]),
                    array_merge($this->tf('reading', 'Experts say teenagers should use phones all day.', false), ['passage' => $p4]),
                    array_merge($this->mc('reading', 'What should teenagers do more, according to experts?', ['play more games', 'outdoor activities', 'watch more videos', 'sleep less'], 1), ['passage' => $p4]),
                    array_merge($this->fb('reading', 'Using phones too much can cause ___ sleep.', 'poor'), ['passage' => $p4]),
                ],
            ],
        ];
    }
}

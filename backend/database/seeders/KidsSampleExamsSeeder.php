<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * KidsSampleExamsSeeder
 *
 * Seed 10 đề mẫu cho học viên Kids (Cambridge YLE: Starters/Movers/Flyers),
 * đầy đủ nội dung + ẢNH MINH HOẠ thật (dùng CDN Twemoji — luôn tải được,
 * đồng bộ, miễn phí) cho các dạng bài có hình.
 *
 * - Idempotent: bỏ qua đề đã tồn tại theo eTitle → chạy lại nhiều lần an toàn,
 *   chỉ thêm đề mới, không xoá/đụng dữ liệu hiện có.
 * - Theo đúng format của CompleteKidsExamSeeder (bảng questions: qType=kids_task,
 *   kids_task_config={task_type_id}, qData JSON) để player render đúng.
 *
 * Ảnh: Twemoji 14.0.2 qua jsDelivr CDN — URL theo codepoint emoji, ổn định.
 */
class KidsSampleExamsSeeder extends Seeder
{
    private int $teacherId;
    /** @var array<string,int> code => id */
    private array $tt = [];
    private ?int $starters = null;
    private ?int $movers = null;
    private ?int $flyers = null;

    /** Ảnh emoji (Twemoji) theo codepoint — luôn hiển thị được. */
    private function img(string $hex): string
    {
        return "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/{$hex}.png";
    }

    /** Audio mẫu ổn định (để player Listening không lỗi khi phát). */
    private string $sampleAudio = 'https://cdn.jsdelivr.net/gh/anars/blank-audio/2-seconds-of-silence.mp3';

    public function run(): void
    {
        $this->teacherId = (int) (DB::table('users')->where('uRole', 'teacher')->value('uId') ?? 1);
        $this->tt = DB::table('kids_task_definitions')->pluck('id', 'code')->toArray();
        $this->starters = DB::table('kids_exam_types')->where('code', 'yle_starters')->value('id');
        $this->movers   = DB::table('kids_exam_types')->where('code', 'yle_movers')->value('id');
        $this->flyers   = DB::table('kids_exam_types')->where('code', 'yle_flyers')->value('id');

        if (empty($this->tt)) {
            echo "⚠️  Bảng kids_task_definitions rỗng — chạy KidsTaskTypesSeeder trước.\n";
            return;
        }

        echo "🧒 Seeding 10 đề mẫu Kids (có ảnh minh hoạ)...\n\n";

        $this->exam1();
        $this->exam2();
        $this->exam3();
        $this->exam4();
        $this->exam5();
        $this->exam6();
        $this->exam7();
        $this->exam8();
        $this->exam9();
        $this->exam10();

        echo "\n✅ Hoàn tất seed đề mẫu Kids.\n";
    }

    // ─── Helpers ────────────────────────────────────────────────────────────
    private function makeExam(string $title, string $desc, string $skill, ?int $typeId, int $duration, int $total): ?int
    {
        if (DB::table('exams')->where('eTitle', $title)->exists()) {
            echo "  ↷ Bỏ qua (đã có): {$title}\n";
            return null;
        }
        $id = DB::table('exams')->insertGetId([
            'eTitle' => $title,
            'eDescription' => $desc,
            'kids_exam_config' => json_encode(['kids_exam_type_id' => $typeId]),
            'age_group' => 'kids',
            'eType' => 'GENERAL',
            'eSkill' => $skill,
            'eDuration_minutes' => $duration,
            'eTotal_score' => $total,
            'ePass_score' => (int) ceil($total / 2),
            'eTeacher_id' => $this->teacherId,
            'eStatus' => 'published',
            'eCreated_at' => now(),
        ]);
        echo "  ✓ Tạo: {$title} (#{$id})\n";
        return $id;
    }

    private function q(int $examId, string $taskCode, int $part, array $data, int $points = 5): void
    {
        $taskId = $this->tt[$taskCode] ?? null;
        if (!$taskId) {
            echo "    ⚠️  Thiếu task type '{$taskCode}' — bỏ qua câu.\n";
            return;
        }
        DB::table('questions')->insert([
            'exam_id' => $examId,
            'qContent' => '',
            'qType' => 'kids_task',
            'kids_task_config' => json_encode(['task_type_id' => $taskId]),
            'qPart' => $part,
            'qSubPart' => null,
            'qOrder' => 1,
            'qData' => json_encode($data),
            'qPoints' => $points,
            'qCreated_at' => now(),
        ]);
    }

    /** listen_and_tick: 1 câu = {question, options:[{id,image_url}], correct_answer} */
    private function tick(string $question, array $opts, string $correct): array
    {
        return ['question' => $question, 'options' => $opts, 'correct_answer' => $correct];
    }

    private function opt(string $id, string $hex): array
    {
        return ['id' => $id, 'image_url' => $this->img($hex)];
    }

    // ─── 10 đề ──────────────────────────────────────────────────────────────

    /** 1. Starters – Animals (Listening: listen & tick) */
    private function exam1(): void
    {
        $e = $this->makeExam(
            'Kids Starters – Animals Around Us (Listening)',
            'Nghe và chọn hình con vật đúng. Có hình minh hoạ cho mỗi đáp án.',
            'listening', $this->starters, 15, 5
        );
        if (!$e) return;
        $this->q($e, 'listen_and_tick', 1, [
            'audio_url' => $this->sampleAudio,
            'questions' => [
                $this->tick('Which animal says "meow"?', [$this->opt('A', '1f408'), $this->opt('B', '1f415'), $this->opt('C', '1f41f')], 'A'),
                $this->tick('Which animal can fly?', [$this->opt('A', '1f407'), $this->opt('B', '1f426'), $this->opt('C', '1f438')], 'B'),
                $this->tick('Which animal is the biggest?', [$this->opt('A', '1f418'), $this->opt('B', '1f407'), $this->opt('C', '1f41f')], 'A'),
                $this->tick('Which animal lives in water?', [$this->opt('A', '1f415'), $this->opt('B', '1f41f'), $this->opt('C', '1f412')], 'B'),
                $this->tick('Which animal says "woof"?', [$this->opt('A', '1f408'), $this->opt('B', '1f415'), $this->opt('C', '1f437')], 'B'),
            ],
        ], 5);
    }

    /** 2. Starters – Food (Reading: word bank + definition) */
    private function exam2(): void
    {
        $e = $this->makeExam(
            'Kids Starters – Yummy Food (Reading & Writing)',
            'Điền từ vào chỗ trống và ghép từ với định nghĩa. Chủ đề đồ ăn.',
            'reading', $this->starters, 20, 10
        );
        if (!$e) return;
        $this->q($e, 'word_bank_fill', 1, [
            'text' => 'I like fruit. I eat an __1__ and a __2__. For lunch I have __3__ and __4__. After dinner I want __5__.',
            'word_bank' => ['apple', 'banana', 'rice', 'fish', 'ice cream', 'cake'],
            'gaps' => [
                ['gap_number' => 1, 'correct_word' => 'apple'],
                ['gap_number' => 2, 'correct_word' => 'banana'],
                ['gap_number' => 3, 'correct_word' => 'rice'],
                ['gap_number' => 4, 'correct_word' => 'fish'],
                ['gap_number' => 5, 'correct_word' => 'ice cream'],
            ],
        ], 5);
        $this->q($e, 'word_definition_matching', 2, [
            'words' => [
                ['word' => 'apple', 'definition' => 'A round red or green fruit.'],
                ['word' => 'milk', 'definition' => 'A white drink that comes from cows.'],
                ['word' => 'bread', 'definition' => 'We make sandwiches with this.'],
                ['word' => 'banana', 'definition' => 'A long yellow fruit.'],
                ['word' => 'cake', 'definition' => 'A sweet food we eat at birthdays.'],
            ],
        ], 5);
    }

    /** 3. Starters – Colours & Toys (Listening) */
    private function exam3(): void
    {
        $e = $this->makeExam(
            'Kids Starters – Toys & Things (Listening)',
            'Nghe và chọn hình đúng về đồ vật quen thuộc.',
            'listening', $this->starters, 15, 5
        );
        if (!$e) return;
        $this->q($e, 'listen_and_tick', 1, [
            'audio_url' => $this->sampleAudio,
            'questions' => [
                $this->tick('Which one can you read?', [$this->opt('A', '1f4d6'), $this->opt('B', '26bd'), $this->opt('C', '1f697')], 'A'),
                $this->tick('Which one can you kick?', [$this->opt('A', '1f4d6'), $this->opt('B', '26bd'), $this->opt('C', '270f')], 'B'),
                $this->tick('Which one do you write with?', [$this->opt('A', '270f'), $this->opt('B', '1f392'), $this->opt('C', '26bd')], 'A'),
                $this->tick('Which one carries your books?', [$this->opt('A', '1f550'), $this->opt('B', '1f392'), $this->opt('C', '1f4d6')], 'B'),
                $this->tick('Which one tells the time?', [$this->opt('A', '1f550'), $this->opt('B', '1f333'), $this->opt('C', '26bd')], 'A'),
            ],
        ], 5);
    }

    /** 4. Starters – At the Park (Reading: look&read + look,read&write) */
    private function exam4(): void
    {
        $e = $this->makeExam(
            'Kids Starters – A Day at the Park (Reading & Writing)',
            'Nhìn tranh và đọc câu, chọn Yes/No; rồi viết câu trả lời ngắn.',
            'reading', $this->starters, 20, 10
        );
        if (!$e) return;
        $this->q($e, 'look_and_read', 1, [
            'image_url' => 'https://picsum.photos/seed/parkscene/800/450',
            'statements' => [
                ['text' => 'Children are playing in the park.', 'correct_answer' => 'yes'],
                ['text' => 'There is snow on the ground.', 'correct_answer' => 'no'],
                ['text' => 'The sun is shining.', 'correct_answer' => 'yes'],
                ['text' => 'A dog is sleeping on the grass.', 'correct_answer' => 'yes'],
                ['text' => 'It is night time.', 'correct_answer' => 'no'],
            ],
        ], 5);
        $this->q($e, 'look_read_write', 2, [
            'shared_image_url' => 'https://picsum.photos/seed/parkscene/800/450',
            'questions' => [
                ['question' => 'Where are the children?', 'correct_answer' => 'park'],
                ['question' => 'What is the weather like?', 'correct_answer' => 'sunny'],
                ['question' => 'What animal is on the grass?', 'correct_answer' => 'dog'],
                ['question' => 'Is it day or night?', 'correct_answer' => 'day'],
                ['question' => 'Are the children happy?', 'correct_answer' => 'yes'],
            ],
        ], 5);
    }

    /** 5. Movers – Around the Town (Reading: cloze + dialogue) */
    private function exam5(): void
    {
        $e = $this->makeExam(
            'Kids Movers – Around the Town (Reading & Writing)',
            'Chọn từ đúng điền vào đoạn văn và ghép câu hỏi - câu trả lời.',
            'reading', $this->movers, 25, 12
        );
        if (!$e) return;
        $this->q($e, 'cloze_test', 1, [
            'text' => 'Last Sunday, we __1__ to the town. We __2__ a new bag at the shop. Mum __3__ a coffee. Then we __4__ home by bus. It __5__ a nice day.',
            'gaps' => [
                ['gap_id' => 1, 'options' => ['go', 'went', 'going'], 'correct_answer' => 'went'],
                ['gap_id' => 2, 'options' => ['buy', 'bought', 'buying'], 'correct_answer' => 'bought'],
                ['gap_id' => 3, 'options' => ['have', 'had', 'has'], 'correct_answer' => 'had'],
                ['gap_id' => 4, 'options' => ['come', 'came', 'coming'], 'correct_answer' => 'came'],
                ['gap_id' => 5, 'options' => ['is', 'was', 'were'], 'correct_answer' => 'was'],
            ],
        ], 5);
        $this->q($e, 'dialogue_matching', 2, [
            'dialogues' => [
                ['question' => 'Where is the library?', 'options' => [['id' => 'A', 'text' => "It's next to the school."], ['id' => 'B', 'text' => 'I like reading.'], ['id' => 'C', 'text' => 'At nine o\'clock.']], 'correct_answer' => 'A'],
                ['question' => 'How do we go to town?', 'options' => [['id' => 'A', 'text' => 'It is sunny.'], ['id' => 'B', 'text' => 'By bus.'], ['id' => 'C', 'text' => 'A red bag.']], 'correct_answer' => 'B'],
                ['question' => 'What time does the shop open?', 'options' => [['id' => 'A', 'text' => 'In the town.'], ['id' => 'B', 'text' => 'My mum.'], ['id' => 'C', 'text' => 'At eight o\'clock.']], 'correct_answer' => 'C'],
            ],
        ], 7);
    }

    /** 6. Movers – Transport (Listening) */
    private function exam6(): void
    {
        $e = $this->makeExam(
            'Kids Movers – How We Travel (Listening)',
            'Nghe và chọn phương tiện giao thông đúng. Có hình minh hoạ.',
            'listening', $this->movers, 15, 5
        );
        if (!$e) return;
        $this->q($e, 'listen_and_tick', 1, [
            'audio_url' => $this->sampleAudio,
            'questions' => [
                $this->tick('Which one flies in the sky?', [$this->opt('A', '2708'), $this->opt('B', '1f697'), $this->opt('C', '1f6b2')], 'A'),
                $this->tick('Which one runs on rails?', [$this->opt('A', '1f68c'), $this->opt('B', '1f686'), $this->opt('C', '26f5')], 'B'),
                $this->tick('Which one has two wheels?', [$this->opt('A', '1f697'), $this->opt('B', '1f6b2'), $this->opt('C', '1f68c')], 'B'),
                $this->tick('Which one goes on water?', [$this->opt('A', '26f5'), $this->opt('B', '2708'), $this->opt('C', '1f686')], 'A'),
                $this->tick('Which one takes many people on roads?', [$this->opt('A', '1f6b2'), $this->opt('B', '1f68c'), $this->opt('C', '26f5')], 'B'),
            ],
        ], 5);
    }

    /** 7. Movers – Nature & Weather (Reading: word bank + definition) */
    private function exam7(): void
    {
        $e = $this->makeExam(
            'Kids Movers – Nature & Weather (Reading & Writing)',
            'Điền từ về thiên nhiên, thời tiết và ghép từ với định nghĩa.',
            'reading', $this->movers, 20, 10
        );
        if (!$e) return;
        $this->q($e, 'word_bank_fill', 1, [
            'text' => 'In the morning the __1__ is bright. After the rain we see a __2__. Birds sit in the tall __3__. I pick a pretty __4__. At night I look at a __5__.',
            'word_bank' => ['sun', 'rainbow', 'tree', 'flower', 'star', 'cloud'],
            'gaps' => [
                ['gap_number' => 1, 'correct_word' => 'sun'],
                ['gap_number' => 2, 'correct_word' => 'rainbow'],
                ['gap_number' => 3, 'correct_word' => 'tree'],
                ['gap_number' => 4, 'correct_word' => 'flower'],
                ['gap_number' => 5, 'correct_word' => 'star'],
            ],
        ], 5);
        $this->q($e, 'word_definition_matching', 2, [
            'words' => [
                ['word' => 'rain', 'definition' => 'Water that falls from the clouds.'],
                ['word' => 'sun', 'definition' => 'It is hot and bright in the sky in the day.'],
                ['word' => 'tree', 'definition' => 'A tall plant with leaves and branches.'],
                ['word' => 'snow', 'definition' => 'Soft white ice that falls when it is cold.'],
                ['word' => 'wind', 'definition' => 'Air that moves and can blow your hat away.'],
            ],
        ], 5);
    }

    /** 8. Flyers – School Life (Reading: cloze + dialogue) */
    private function exam8(): void
    {
        $e = $this->makeExam(
            'Kids Flyers – My School Life (Reading & Writing)',
            'Đoạn văn điền từ và ghép hội thoại — trình độ Flyers.',
            'reading', $this->flyers, 25, 14
        );
        if (!$e) return;
        $this->q($e, 'cloze_test', 1, [
            'text' => 'My favourite day at school __1__ Monday. We __2__ science and we __3__ many experiments. At break time I __4__ with my friends. After lunch we __5__ a story and the teacher __6__ us a song. I always __7__ school.',
            'gaps' => [
                ['gap_id' => 1, 'options' => ['is', 'are', 'be'], 'correct_answer' => 'is'],
                ['gap_id' => 2, 'options' => ['study', 'studies', 'studying'], 'correct_answer' => 'study'],
                ['gap_id' => 3, 'options' => ['do', 'did', 'does'], 'correct_answer' => 'do'],
                ['gap_id' => 4, 'options' => ['play', 'plays', 'played'], 'correct_answer' => 'play'],
                ['gap_id' => 5, 'options' => ['read', 'reads', 'reading'], 'correct_answer' => 'read'],
                ['gap_id' => 6, 'options' => ['teach', 'teaches', 'taught'], 'correct_answer' => 'teaches'],
                ['gap_id' => 7, 'options' => ['enjoy', 'enjoys', 'enjoying'], 'correct_answer' => 'enjoy'],
            ],
        ], 7);
        $this->q($e, 'dialogue_matching', 2, [
            'dialogues' => [
                ['question' => 'What is your favourite subject?', 'options' => [['id' => 'A', 'text' => 'I like science best.'], ['id' => 'B', 'text' => 'At eight o\'clock.'], ['id' => 'C', 'text' => 'In my bag.']], 'correct_answer' => 'A'],
                ['question' => 'Who is your teacher?', 'options' => [['id' => 'A', 'text' => 'It is maths.'], ['id' => 'B', 'text' => 'Her name is Ms Lan.'], ['id' => 'C', 'text' => 'On Monday.']], 'correct_answer' => 'B'],
                ['question' => 'When does school finish?', 'options' => [['id' => 'A', 'text' => 'By bike.'], ['id' => 'B', 'text' => 'A new pen.'], ['id' => 'C', 'text' => 'At four o\'clock.']], 'correct_answer' => 'C'],
                ['question' => 'How do you go to school?', 'options' => [['id' => 'A', 'text' => 'I walk with my sister.'], ['id' => 'B', 'text' => 'I like English.'], ['id' => 'C', 'text' => 'Yes, I do.']], 'correct_answer' => 'A'],
            ],
        ], 7);
    }

    /** 9. Starters – Speaking practice (picture questions + look&read) */
    private function exam9(): void
    {
        $e = $this->makeExam(
            'Kids Starters – Talk About Pictures (Speaking)',
            'Nhìn hình và trả lời câu hỏi của giám khảo; có hình minh hoạ.',
            'speaking', $this->starters, 10, 10
        );
        if (!$e) return;
        $this->q($e, 'picture_questions', 1, [
            'questions' => [
                ['image_url' => $this->img('1f415'), 'question' => 'What is this animal?', 'sample_answer' => "It's a dog."],
                ['image_url' => $this->img('1f34e'), 'question' => 'What fruit is this?', 'sample_answer' => "It's an apple."],
                ['image_url' => $this->img('26bd'), 'question' => 'What can you do with this?', 'sample_answer' => 'I can play football.'],
                ['image_url' => $this->img('1f3e0'), 'question' => 'What is this?', 'sample_answer' => "It's a house."],
                ['image_url' => $this->img('2600'), 'question' => 'What is this in the sky?', 'sample_answer' => "It's the sun."],
            ],
        ], 5);
        $this->q($e, 'look_and_read', 2, [
            'image_url' => 'https://picsum.photos/seed/kidsroom/800/450',
            'statements' => [
                ['text' => 'There is a bed in the room.', 'correct_answer' => 'yes'],
                ['text' => 'The room is outside.', 'correct_answer' => 'no'],
                ['text' => 'There is a window.', 'correct_answer' => 'yes'],
                ['text' => 'A car is in the room.', 'correct_answer' => 'no'],
                ['text' => 'The room has a light.', 'correct_answer' => 'yes'],
            ],
        ], 5);
    }

    /** 10. Movers – Daily Routine (Reading: look,read&write + definition) */
    private function exam10(): void
    {
        $e = $this->makeExam(
            'Kids Movers – My Daily Routine (Reading & Writing)',
            'Nhìn tranh, đọc câu hỏi và viết câu trả lời ngắn; ghép từ - định nghĩa.',
            'reading', $this->movers, 20, 10
        );
        if (!$e) return;
        $this->q($e, 'look_read_write', 1, [
            'shared_image_url' => 'https://picsum.photos/seed/morning/800/450',
            'questions' => [
                ['question' => 'What does the boy do in the morning?', 'correct_answer' => 'wake up'],
                ['question' => 'What does he eat for breakfast?', 'correct_answer' => 'bread'],
                ['question' => 'How does he go to school?', 'correct_answer' => 'bike'],
                ['question' => 'What does he do after school?', 'correct_answer' => 'homework'],
                ['question' => 'When does he go to bed?', 'correct_answer' => 'night'],
            ],
        ], 5);
        $this->q($e, 'word_definition_matching', 2, [
            'words' => [
                ['word' => 'breakfast', 'definition' => 'The first meal you eat in the morning.'],
                ['word' => 'homework', 'definition' => 'School work you do at home.'],
                ['word' => 'clock', 'definition' => 'It tells you the time.'],
                ['word' => 'teacher', 'definition' => 'A person who helps you learn at school.'],
                ['word' => 'weekend', 'definition' => 'Saturday and Sunday.'],
            ],
        ], 5);
    }
}

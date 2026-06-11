<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

/**
 * KidsAllTaskTypesSeeder
 *
 * Tạo 1 đề Kids DEMO phủ ĐỦ 25 dạng task (mỗi dạng 1 sub-part riêng để dễ verify
 * từng cái trên trang làm bài học viên).
 *
 * QUAN TRỌNG: shape `kids_task_config` được seed KHỚP với shape API thật tạo ra
 *   kids_task_config = { task_type, task_name, skill, instructions, task_data: {...} }
 * và `task_data` khớp với field mà các component học viên ĐỌC (qua extractTaskData).
 *
 * Chạy:  php artisan db:seed --class=KidsAllTaskTypesSeeder
 */
class KidsAllTaskTypesSeeder extends Seeder
{
    private const TITLE = '🌈 Kids DEMO — Đủ Dạng Đề (All Task Types)';
    private string $audio = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

    private function img(string $seed): string
    {
        return "https://picsum.photos/seed/{$seed}/640/420";
    }

    public function run(): void
    {
        $teacherId = DB::table('users')->where('uRole', 'teacher')->value('uId') ?? 1;
        $startersId = \Illuminate\Support\Facades\Schema::hasTable('kids_exam_types')
            ? DB::table('kids_exam_types')->where('code', 'yle_starters')->value('id')
            : null;
        $now = Carbon::now();

        // ── Idempotent: xoá đề demo cũ + câu hỏi của nó ───────────────────────
        $oldIds = DB::table('exams')->where('eTitle', self::TITLE)->pluck('eId');
        if ($oldIds->isNotEmpty()) {
            DB::table('questions')->whereIn('exam_id', $oldIds)->delete();
            DB::table('exams')->whereIn('eId', $oldIds)->delete();
        }

        $examId = DB::table('exams')->insertGetId([
            'eTitle'            => self::TITLE,
            'eDescription'      => 'Đề mẫu để kiểm tra giao diện làm bài cho TẤT CẢ dạng câu hỏi Kids. Mỗi sub-part là 1 dạng.',
            'kids_exam_config'  => json_encode(['kids_exam_type_id' => $startersId]),
            'age_group'         => 'kids',
            'eType'             => 'GENERAL',
            'eSkill'            => 'mixed',
            'eDuration_minutes' => 60,
            'eTotal_score'      => 100,
            'ePass_score'       => 50,
            'eTeacher_id'       => $teacherId,
            'eStatus'           => 'published',
            'eCreated_at'       => $now,
        ]);

        $order = 0;

        // ============================ PART 1 — LISTENING ============================
        $this->q($examId, 'listen_and_draw_lines', 1, 1, ++$order, 'listening',
            'Nghe và nối tên với người trong tranh. Kéo thả tên vào đúng vị trí.', [
            'matchingMode' => 'drag-to-image',
            'audioUrl'     => $this->audio,
            'imageUrl'     => $this->img('draw-scene'),
            'items' => [
                ['name' => 'Tom',  'hotspot' => ['x' => 24, 'y' => 32], 'labelPosition' => ['x' => 8,  'y' => 10]],
                ['name' => 'Lucy', 'hotspot' => ['x' => 68, 'y' => 38], 'labelPosition' => ['x' => 92, 'y' => 14]],
                ['name' => 'Ben',  'hotspot' => ['x' => 46, 'y' => 72], 'labelPosition' => ['x' => 50, 'y' => 96]],
            ],
        ]);

        $this->q($examId, 'listen_and_draw_lines', 1, 2, ++$order, 'listening',
            'Nghe và nối tên với hoạt động (chọn từ danh sách).', [
            'matchingMode' => 'drag-to-list',
            'audioUrl'     => $this->audio,
            'items' => [
                ['name' => 'Tom',  'targetLabel' => 'playing tennis'],
                ['name' => 'Lucy', 'targetLabel' => 'reading a book'],
                ['name' => 'Ben',  'targetLabel' => 'riding a bike'],
            ],
        ]);

        $this->q($examId, 'listen_and_tick', 1, 3, ++$order, 'listening',
            'Nghe và đánh dấu (✓) đáp án đúng A, B hoặc C.', [
            'audioUrl' => $this->audio,
            'items' => [
                ['questionText' => 'What is Tom doing?', 'correctAnswer' => 'B', 'options' => [
                    ['id' => 'A', 'imageUrl' => $this->img('tick-1a')],
                    ['id' => 'B', 'imageUrl' => $this->img('tick-1b')],
                    ['id' => 'C', 'imageUrl' => $this->img('tick-1c')],
                ]],
                ['questionText' => 'Where is the cat?', 'correctAnswer' => 'A', 'options' => [
                    ['id' => 'A', 'imageUrl' => $this->img('tick-2a')],
                    ['id' => 'B', 'imageUrl' => $this->img('tick-2b')],
                    ['id' => 'C', 'imageUrl' => $this->img('tick-2c')],
                ]],
            ],
        ]);

        $this->q($examId, 'listen_and_write', 1, 4, ++$order, 'listening',
            'Nghe và viết câu trả lời vào ô trống.', [
            'audioUrl'  => $this->audio,
            'imageUrl'  => $this->img('lw-form'),
            'questions' => [
                ['question' => "The girl's name is ___",       'correct_answer' => 'Sara'],
                ['question' => 'She is ___ years old.',         'correct_answer' => '8'],
                ['question' => 'Her favourite animal is a ___', 'correct_answer' => 'dog'],
            ],
        ]);

        $this->q($examId, 'listen_colour_write', 1, 5, ++$order, 'listening',
            'Nghe và tô màu / viết theo hướng dẫn.', [
            'audioUrl' => $this->audio,
            'imageUrl' => $this->img('colour-garden'),
            'items' => [
                ['object' => 'the bird',   'text' => 'Colour the bird',   'correct_colour' => 'red'],
                ['object' => 'the flower', 'text' => 'Colour the flower', 'correct_colour' => 'yellow'],
                ['object' => 'the car',    'text' => 'Colour the car',    'correct_colour' => 'blue'],
            ],
        ]);

        $this->q($examId, 'listening_letter_match', 1, 6, ++$order, 'listening',
            'Nghe và nối mỗi người với chữ cái (A–F) đúng.', [
            'audioUrl' => $this->audio,
            'items' => [
                ['name' => 'Tom',  'image_url' => $this->img('llm-tom'),  'correct_letter' => 'C'],
                ['name' => 'Lucy', 'image_url' => $this->img('llm-lucy'), 'correct_letter' => 'A'],
                ['name' => 'Ben',  'image_url' => $this->img('llm-ben'),  'correct_letter' => 'B'],
            ],
            'options' => [
                ['letter' => 'A', 'image_url' => $this->img('llm-a')],
                ['letter' => 'B', 'image_url' => $this->img('llm-b')],
                ['letter' => 'C', 'image_url' => $this->img('llm-c')],
            ],
        ]);

        // ====================== PART 2 — READING & WRITING ======================
        $this->q($examId, 'look_and_read', 2, 1, ++$order, 'reading',
            'Nhìn tranh, đọc câu và đánh dấu ✓ (đúng) hoặc ✗ (sai).', [
            'answer_format' => 'tick_cross',
            'sharedImageUrl' => $this->img('lr-park'),
            'items' => [
                ['statement' => 'There is a dog in the park.', 'correctAnswer' => 'tick'],
                ['statement' => 'The boy is swimming.',         'correctAnswer' => 'cross'],
                ['statement' => 'The sun is shining.',          'correctAnswer' => 'tick'],
            ],
        ]);

        $this->q($examId, 'look_and_read', 2, 2, ++$order, 'reading',
            'Nhìn tranh, đọc câu và chọn Yes / No.', [
            'answer_format' => 'yes_no',
            'sharedImageUrl' => $this->img('lr-room'),
            'items' => [
                ['statement' => 'The cat is on the bed.', 'correctAnswer' => 'tick'],
                ['statement' => 'There are two windows.', 'correctAnswer' => 'cross'],
            ],
        ]);

        $this->q($examId, 'look_read_write', 2, 3, ++$order, 'reading',
            'Nhìn tranh, đọc câu hỏi và viết câu trả lời MỘT TỪ.', [
            'shared_image_url' => $this->img('lrw-bedroom'),
            'questions' => [
                ['question' => 'What colour is the bed?', 'question_type' => 'complete', 'hint_prefix' => 'It is', 'correct_answer' => 'blue'],
                ['question' => 'How many toys are there?', 'question_type' => 'answer', 'hint_prefix' => '', 'correct_answer' => 'five'],
                ['question' => 'Where is the cat?', 'question_type' => 'answer', 'hint_prefix' => '', 'correct_answer' => 'chair'],
            ],
        ]);

        $this->q($examId, 'word_bank_fill', 2, 4, ++$order, 'reading',
            'Chọn từ trong ngân hàng để điền vào chỗ trống.', [
            'text' => 'My name is Tom. I live in a big __1__. I have a __2__ and a __3__. Every day I go to __4__ and play with my __5__.',
            'mainImageUrl' => $this->img('wbf-home'),
            'has_images_in_bank' => false,
            'word_bank' => ['house', 'cat', 'dog', 'school', 'friends', 'car'],
            'gaps' => [
                ['gap_number' => 1, 'correct_word' => 'house'],
                ['gap_number' => 2, 'correct_word' => 'cat'],
                ['gap_number' => 3, 'correct_word' => 'dog'],
                ['gap_number' => 4, 'correct_word' => 'school'],
                ['gap_number' => 5, 'correct_word' => 'friends'],
            ],
        ]);

        $this->q($examId, 'cloze_test', 2, 5, ++$order, 'reading',
            'Đọc đoạn văn và chọn từ đúng cho mỗi chỗ trống.', [
            'text' => 'Tom __1__ a cat. The cat __2__ black and white. Tom __3__ his cat every day.',
            'questions' => [
                ['gap_number' => 1, 'options' => ['has', 'have', 'had'],          'correct_answer' => 'has'],
                ['gap_number' => 2, 'options' => ['is', 'are', 'am'],             'correct_answer' => 'is'],
                ['gap_number' => 3, 'options' => ['feed', 'feeds', 'feeding'],    'correct_answer' => 'feeds'],
            ],
        ]);

        $this->q($examId, 'open_cloze', 2, 6, ++$order, 'reading',
            'Đọc đoạn văn và TỰ viết từ còn thiếu (1 từ mỗi chỗ).', [
            'text' => 'My sister and I like animals. We __1__ a dog. It __2__ very friendly. We play __3__ it every afternoon.',
            'gaps' => [
                ['gap_number' => 1, 'hint' => 'have/has', 'correct_answer' => 'have'],
                ['gap_number' => 2, 'hint' => 'be',       'correct_answer' => 'is'],
                ['gap_number' => 3, 'hint' => 'preposition', 'correct_answer' => 'with'],
            ],
        ]);

        $this->q($examId, 'dialogue_matching', 2, 7, ++$order, 'reading',
            'Nối mỗi câu hỏi/câu nói với câu trả lời phù hợp.', [
            'questions' => [
                ['question' => 'How are you?',          'correct_answer' => "I'm fine, thanks."],
                ['question' => 'What is your name?',    'correct_answer' => 'My name is Anna.'],
                ['question' => 'Where do you live?',    'correct_answer' => 'I live in Hanoi.'],
            ],
            'distractors' => ['It is raining.', 'I am ten years old.'],
        ]);

        $this->q($examId, 'word_definition_matching', 2, 8, ++$order, 'reading',
            'Nối mỗi định nghĩa với từ đúng trong ngân hàng từ.', [
            'word_bank' => ['teacher', 'kitchen', 'rain', 'doctor', 'library'],
            'questions' => [
                ['definition' => 'A person who helps you when you are sick.', 'correct_answer' => 'doctor'],
                ['definition' => 'The room where you cook food.',             'correct_answer' => 'kitchen'],
                ['definition' => 'Water that falls from the sky.',            'correct_answer' => 'rain'],
            ],
        ]);

        $this->q($examId, 'reading_comprehension', 2, 9, ++$order, 'reading',
            'Đọc đoạn văn và trả lời câu hỏi.', [
            'passage' => 'Sam is a young boy. He lives near the sea. Every summer he swims with his friends and builds sandcastles on the beach. His favourite food is ice cream.',
            'questions' => [
                ['question' => 'Where does Sam live?', 'type' => 'multiple_choice', 'options' => ['Near the sea', 'In the mountains', 'In a big city'], 'correct_answer' => 'Near the sea'],
                ['question' => "What is Sam's favourite food?", 'type' => 'multiple_choice', 'options' => ['Cake', 'Ice cream', 'Pizza'], 'correct_answer' => 'Ice cream'],
            ],
        ]);

        $this->q($examId, 'story_completion', 2, 10, ++$order, 'reading',
            'Đọc phần đầu câu chuyện và viết tiếp.', [
            'story_beginning' => 'One sunny morning, Mia found a small kitten in her garden. The kitten was hungry, so she...',
            'min_words' => 20,
        ]);

        $this->q($examId, 'unscramble_words', 2, 11, ++$order, 'reading',
            'Sắp xếp các chữ cái thành từ đúng theo tranh.', [
            'items' => [
                ['image_url' => $this->img('un-cat'),  'scrambled_word' => 'tac',  'correct_answer' => 'cat'],
                ['image_url' => $this->img('un-dog'),  'scrambled_word' => 'god',  'correct_answer' => 'dog'],
                ['image_url' => $this->img('un-book'), 'scrambled_word' => 'koob', 'correct_answer' => 'book'],
            ],
        ]);

        // ====================== PART 3 — SPEAKING / PICTURE ======================
        $this->q($examId, 'object_placement', 3, 1, ++$order, 'speaking',
            'Nhìn tranh và đặt/chỉ vị trí các đồ vật theo yêu cầu.', [
            'imageUrl' => $this->img('op-room'),
            'items' => [
                ['object' => 'ball',   'instruction' => 'Put the ball under the table.'],
                ['object' => 'book',   'instruction' => 'Put the book on the shelf.'],
            ],
        ]);

        $this->q($examId, 'picture_questions', 3, 2, ++$order, 'speaking',
            'Nhìn tranh và trả lời các câu hỏi.', [
            'imageUrl' => $this->img('pq-market'),
            'questions' => [
                ['question' => 'What can you see in the picture?', 'correct_answer' => ''],
                ['question' => 'How many people are there?',       'correct_answer' => ''],
            ],
        ]);

        $this->q($examId, 'picture_card_questions', 3, 3, ++$order, 'speaking',
            'Nhìn các thẻ tranh và nói về chúng.', [
            'cards' => [
                ['imageUrl' => $this->img('pc-apple'),  'text' => 'apple'],
                ['imageUrl' => $this->img('pc-banana'), 'text' => 'banana'],
                ['imageUrl' => $this->img('pc-orange'), 'text' => 'orange'],
            ],
        ]);

        $this->q($examId, 'information_exchange', 3, 4, ++$order, 'speaking',
            'Nhìn tranh và hỏi–đáp thông tin với bạn.', [
            'imageUrl' => $this->img('ie-park'),
            'questions' => [
                ['question' => 'What is the weather like?'],
                ['question' => 'What are the children doing?'],
            ],
        ]);

        $this->q($examId, 'picture_story_narration', 3, 5, ++$order, 'speaking',
            'Nhìn các tranh theo thứ tự và kể lại câu chuyện.', [
            'images' => [
                ['url' => $this->img('psn-1'), 'label' => '1'],
                ['url' => $this->img('psn-2'), 'label' => '2'],
                ['url' => $this->img('psn-3'), 'label' => '3'],
                ['url' => $this->img('psn-4'), 'label' => '4'],
            ],
        ], 'Hãy kể lại câu chuyện dựa trên 4 bức tranh.');

        $this->q($examId, 'picture_story_writing', 3, 6, ++$order, 'speaking',
            'Nhìn các tranh và viết một câu chuyện ngắn (20–50 từ).', [
            'images' => [
                ['url' => $this->img('psw-1')],
                ['url' => $this->img('psw-2')],
                ['url' => $this->img('psw-3')],
            ],
            'min_words' => 20,
            'max_words' => 50,
        ]);

        $this->q($examId, 'picture_sentence_writing', 3, 7, ++$order, 'speaking',
            'Nhìn mỗi tranh và viết một câu mô tả.', [
            'images' => [
                ['url' => $this->img('pse-1')],
                ['url' => $this->img('pse-2')],
                ['url' => $this->img('pse-3')],
            ],
            'min_words' => 5,
        ]);

        $this->q($examId, 'find_differences', 3, 8, ++$order, 'speaking',
            'So sánh hai bức tranh và tìm điểm khác nhau.', [
            'images' => [
                ['url' => $this->img('fd-a'), 'label' => 'Picture A'],
                ['url' => $this->img('fd-b'), 'label' => 'Picture B'],
            ],
        ], 'Tìm 5 điểm khác nhau giữa hai bức tranh.');

        $this->q($examId, 'odd_one_out', 3, 9, ++$order, 'speaking',
            'Chọn bức tranh khác biệt và giải thích vì sao.', [
            'images' => [
                ['url' => $this->img('ooo-1'), 'label' => 'apple'],
                ['url' => $this->img('ooo-2'), 'label' => 'banana'],
                ['url' => $this->img('ooo-3'), 'label' => 'car'],
                ['url' => $this->img('ooo-4'), 'label' => 'orange'],
            ],
        ], 'Đồ vật nào không cùng nhóm với các đồ vật còn lại?');

        $total = DB::table('questions')->where('exam_id', $examId)->count();
        echo "✅ Seeded demo exam #{$examId} với {$total} câu (đủ 25 dạng task).\n";
        echo "   Tiêu đề: " . self::TITLE . "\n";
    }

    /**
     * Tạo 1 câu hỏi kids với kids_task_config khớp shape API thật.
     */
    private function q(int $examId, string $type, int $part, int $subPart, int $order, string $skill, string $instructions, array $taskData, string $qContent = ''): void
    {
        DB::table('questions')->insert([
            'exam_id'          => $examId,
            'qContent'         => $qContent,
            'qType'            => 'kids_task',
            'qPart'            => $part,
            'qSubPart'         => $subPart,
            'qOrder'           => $order,
            'qPoints'          => 5,
            'kids_task_config' => json_encode([
                'task_type'    => $type,
                'task_name'    => $type,
                'skill'        => $skill,
                'instructions' => $instructions,
                'task_data'    => $taskData,
            ]),
            'qCreated_at'      => now(),
        ]);
    }
}

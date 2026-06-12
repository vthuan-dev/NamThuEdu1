<?php

namespace Database\Seeders;

use App\Models\Exam;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Seed đề "Nghe & Nói" cho học viên Teens (định dạng tổng hợp / THPT, có
 * section listening + speaking). Speaking được AI chấm qua GradeThptSpeakingJob.
 *
 * Run: php artisan db:seed --class=TeensListeningSpeakingSeeder
 *
 * Lưu ý: audio_url là mẫu công khai để demo; giáo viên có thể vào sửa đề và
 * upload audio thật của mình.
 */
class TeensListeningSpeakingSeeder extends Seeder
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
            ['eTitle' => 'Teens - Luyện Nghe & Nói (Demo)'],
            [
                'eDescription' => 'Đề tổng hợp cho Teens: phần Nghe (audio + trắc nghiệm, tự chấm) và phần Nói (ghi âm, AI chấm). Audio nghe là mẫu demo — giáo viên có thể thay bằng audio của mình.',
                'eType' => 'THPT',
                'eSkill' => 'listening',
                'eDuration_minutes' => 20,
                'eStatus' => 'published',
                'ePurpose' => 'exam',
                'eDifficulty' => 'easy',
                'eTeacher_id' => $teacher->uId,
                'eIs_private' => false,
                'age_group' => 'teens',
                'thpt_version' => 1,
                'thpt_config' => $config,
            ]
        );

        $this->command->info("✅ Seeded Teens Listening+Speaking exam ID={$exam->eId} — {$exam->eTitle}");
    }

    private function buildConfig(): array
    {
        return [
            'version' => '2.0',
            'level' => 'OTHER',
            'total_duration_minutes' => 20,
            'scale_max' => 10,
            'sections' => [
                $this->listeningSection(),
                $this->speakingSection(),
            ],
        ];
    }

    private function listeningSection(): array
    {
        return [
            'id' => 'sec_listen_1',
            'type' => 'listening',
            'points_per_question' => 1,
            'title' => 'PART 1 - Listening',
            'instructions' => 'Listen to the short talk about a school trip, then choose the best answer (A/B/C/D) for each question.',
            // Audio mẫu công khai để demo — giáo viên thay bằng audio thật khi cần.
            'audio_url' => 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            'transcript' => "Good morning, everyone. This is a reminder about our school trip to the Science Museum next Friday. The bus will leave from the main gate at 8 a.m., so please arrive by 7:45. Don't forget to bring your lunch and a bottle of water. The weather will be sunny, so a hat is a good idea. We will be back at school by 4 p.m. Have a great trip!",
            'items' => [
                [
                    'question_number' => 1,
                    'prompt' => 'Where are the students going on the trip?',
                    'options' => [
                        ['id' => 'A', 'text' => 'To the zoo'],
                        ['id' => 'B', 'text' => 'To the Science Museum'],
                        ['id' => 'C', 'text' => 'To the beach'],
                        ['id' => 'D', 'text' => 'To the library'],
                    ],
                    'correct_id' => 'B',
                    'explanation' => 'The talk says the trip is to the Science Museum.',
                ],
                [
                    'question_number' => 2,
                    'prompt' => 'What time should the students arrive?',
                    'options' => [
                        ['id' => 'A', 'text' => 'By 7:45 a.m.'],
                        ['id' => 'B', 'text' => 'By 8:30 a.m.'],
                        ['id' => 'C', 'text' => 'By 9:00 a.m.'],
                        ['id' => 'D', 'text' => 'By 4:00 p.m.'],
                    ],
                    'correct_id' => 'A',
                    'explanation' => 'Students should arrive by 7:45 because the bus leaves at 8 a.m.',
                ],
                [
                    'question_number' => 3,
                    'prompt' => 'What should the students bring?',
                    'options' => [
                        ['id' => 'A', 'text' => 'A laptop'],
                        ['id' => 'B', 'text' => 'A football'],
                        ['id' => 'C', 'text' => 'Lunch and water'],
                        ['id' => 'D', 'text' => 'A textbook'],
                    ],
                    'correct_id' => 'C',
                    'explanation' => 'They are told to bring lunch and a bottle of water.',
                ],
                [
                    'question_number' => 4,
                    'prompt' => 'What time will they return to school?',
                    'options' => [
                        ['id' => 'A', 'text' => 'At 2 p.m.'],
                        ['id' => 'B', 'text' => 'At 3 p.m.'],
                        ['id' => 'C', 'text' => 'At 4 p.m.'],
                        ['id' => 'D', 'text' => 'At 5 p.m.'],
                    ],
                    'correct_id' => 'C',
                    'explanation' => 'They will be back at school by 4 p.m.',
                ],
            ],
        ];
    }

    private function speakingSection(): array
    {
        return [
            'id' => 'sec_speak_1',
            'type' => 'speaking',
            'points_per_question' => 1,
            'title' => 'PART 2 - Speaking',
            'instructions' => 'Bạn sẽ ghi âm câu trả lời cho mỗi đề. Có thời gian chuẩn bị trước khi nói. Bài nói được AI chấm điểm.',
            'items' => [
                [
                    'question_number' => 5,
                    'prompt' => 'Talk about your favourite hobby. You should say what it is, when you do it, and why you enjoy it.',
                    'prep_seconds' => 30,
                    'speak_seconds' => 90,
                ],
                [
                    'question_number' => 6,
                    'prompt' => 'Describe a place you would like to visit. Explain where it is, what you can do there, and why you want to go.',
                    'prep_seconds' => 30,
                    'speak_seconds' => 90,
                ],
            ],
        ];
    }
}

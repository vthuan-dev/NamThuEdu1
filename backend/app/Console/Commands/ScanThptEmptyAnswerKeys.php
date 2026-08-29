<?php

namespace App\Console\Commands;

use App\Http\Controllers\ThptExamController;
use App\Models\Exam;
use App\Models\Submission;
use Illuminate\Console\Command;

/**
 * CHỈ ĐỌC — lệnh này không sửa, không xoá gì.
 *
 * Validation thêm ở 1265cec chặn `correct_id` trỏ vào phương án có text rỗng,
 * nhưng chỉ chạy lúc publish TỪ ĐÓ VỀ SAU. Đề đã publish trước đó vẫn còn nguyên
 * lỗi: câu đó KHÔNG học viên nào có thể trả lời đúng, và không có gì hiện ra cho
 * tới khi xem điểm.
 *
 * Lệnh duyệt lại đề bằng CHÍNH validateThptConfig() của ThptExamController (gọi
 * qua Reflection) để kết quả không bao giờ lệch khỏi gate lúc publish, rồi lọc
 * riêng lớp lỗi "đáp án trỏ vào phương án chưa có nội dung".
 *
 * Ngoại lệ đề dạng ảnh (tất cả phương án đều rỗng → không lọc) đã nằm trong hàm
 * gốc nên tự động được tôn trọng.
 *
 * Usage:
 *   php artisan thpt:scan-empty-answers
 *   php artisan thpt:scan-empty-answers --status=published,pending
 *   php artisan thpt:scan-empty-answers --json=storage/app/thpt-scan.json
 */
class ScanThptEmptyAnswerKeys extends Command
{
    protected $signature = 'thpt:scan-empty-answers
        {--status=published : Trạng thái đề cần quét, phân cách bằng dấu phẩy}
        {--json= : Ghi kết quả đầy đủ ra file JSON}
        {--all-errors : Liệt kê luôn đề chỉ có lỗi validation khác}';

    protected $description = 'CHỈ ĐỌC: tìm đề THPT có đáp án đúng trỏ vào phương án chưa có nội dung';

    /** Khớp message trong ThptExamController::validateThptConfig(). */
    private const MARKER = 'trỏ vào phương án chưa có nội dung';

    public function handle(): int
    {
        $statuses = array_values(array_filter(array_map(
            'trim',
            explode(',', (string) $this->option('status'))
        )));

        if (empty($statuses)) {
            $this->error('--status không được để trống.');
            return self::FAILURE;
        }

        $validate = $this->makeValidator();

        $this->info('🔍 CHỈ ĐỌC — quét đề THPT trạng thái: ' . implode(', ', $statuses));

        $exams = Exam::query()
            ->where('eType', 'THPT')
            ->whereIn('eStatus', $statuses)
            ->whereNotNull('thpt_config')
            ->with('teacher:uId,uName')
            ->orderBy('eId')
            ->get(['eId', 'eTitle', 'eStatus', 'eTeacher_id', 'thpt_config']);

        $this->line("Có {$exams->count()} đề THPT trong phạm vi quét.");

        if ($exams->isEmpty()) {
            return self::SUCCESS;
        }

        // Số bài đã làm theo từng đề — để biết lỗi đã ảnh hưởng bao nhiêu học viên.
        $submissionCounts = Submission::query()
            ->whereIn('exam_id', $exams->pluck('eId'))
            ->selectRaw('exam_id, COUNT(*) as total')
            ->groupBy('exam_id')
            ->pluck('total', 'exam_id');

        $affected = [];
        $otherOnly = 0;

        foreach ($exams as $exam) {
            $errors = $validate($exam->thpt_config);
            if (empty($errors)) {
                continue;
            }

            $emptyAnswer = $this->pick($errors, true);

            if (empty($emptyAnswer)) {
                $otherOnly++;
                if (!$this->option('all-errors')) {
                    continue;
                }
            }

            $affected[] = [
                'exam_id'      => (int) $exam->eId,
                'title'        => (string) $exam->eTitle,
                'status'       => (string) $exam->eStatus,
                'teacher'      => optional($exam->teacher)->uName,
                'teacher_id'   => $exam->eTeacher_id === null ? null : (int) $exam->eTeacher_id,
                'submissions'  => (int) ($submissionCounts[$exam->eId] ?? 0),
                'empty_answer' => $emptyAnswer,
                'other_errors' => $this->pick($errors, false),
            ];
        }

        $this->report($affected, $otherOnly);
        $this->maybeWriteJson($affected, $statuses);

        return self::SUCCESS;
    }

    /**
     * Tách error theo lớp lỗi: $wanted=true lấy lỗi đáp án rỗng, false lấy phần còn lại.
     */
    private function pick(array $errors, bool $wanted): array
    {
        $marker = self::MARKER;

        return array_values(array_filter($errors, function ($e) use ($marker, $wanted) {
            return (strpos((string) $e, $marker) !== false) === $wanted;
        }));
    }

    /**
     * Dùng lại chính validateThptConfig() của controller thay vì viết lại điều kiện.
     * Hàm đó là `private` nên phải qua Reflection — đổi lại, scan không thể lệch khỏi
     * gate lúc publish khi ai đó sửa hàm gốc.
     */
    private function makeValidator(): callable
    {
        $controller = new ThptExamController();
        $method = new \ReflectionMethod(ThptExamController::class, 'validateThptConfig');
        $method->setAccessible(true);

        return function ($config) use ($controller, $method) {
            if (!is_array($config)) {
                return [];
            }

            return (array) $method->invoke($controller, $config);
        };
    }

    private function report(array $affected, int $otherOnly): void
    {
        $withEmpty = array_values(array_filter($affected, function ($a) {
            return !empty($a['empty_answer']);
        }));

        if (empty($withEmpty)) {
            $this->info('✅ Không có đề nào có đáp án trỏ vào phương án rỗng.');
        } else {
            $questions = 0;
            $submissions = 0;
            foreach ($withEmpty as $a) {
                $questions += count($a['empty_answer']);
                $submissions += $a['submissions'];
            }

            $this->newLine();
            $this->error(sprintf(
                '⚠ %d đề / %d câu có đáp án trỏ vào phương án rỗng — %d bài đã làm trên các đề này.',
                count($withEmpty),
                $questions,
                $submissions
            ));

            $this->table(
                ['eId', 'Trạng thái', 'Đề', 'Giáo viên', 'Câu lỗi', 'Bài đã làm'],
                array_map(function ($a) {
                    return [
                        $a['exam_id'],
                        $a['status'],
                        mb_strimwidth((string) $a['title'], 0, 42, '…'),
                        $a['teacher'] === null ? '(không rõ)' : $a['teacher'],
                        count($a['empty_answer']),
                        $a['submissions'],
                    ];
                }, $withEmpty)
            );

            foreach ($withEmpty as $a) {
                $this->newLine();
                $this->line("  <fg=yellow>#{$a['exam_id']}</> {$a['title']}");
                foreach ($a['empty_answer'] as $e) {
                    $this->line('    - ' . $e);
                }
            }
        }

        if ($otherOnly > 0) {
            $this->newLine();
            $this->warn(
                "Ngoài ra {$otherOnly} đề có lỗi validation KHÁC (thiếu đáp án, thiếu đoạn văn…)"
                . ($this->option('all-errors') ? ':' : ' — thêm --all-errors để xem.')
            );
        }

        if (!$this->option('all-errors')) {
            return;
        }

        foreach ($affected as $a) {
            if (!empty($a['empty_answer']) || empty($a['other_errors'])) {
                continue;
            }
            $this->newLine();
            $this->line("  <fg=cyan>#{$a['exam_id']}</> [{$a['status']}] {$a['title']}"
                . " — {$a['submissions']} bài đã làm");
            foreach ($a['other_errors'] as $e) {
                $this->line('    - ' . $e);
            }
        }
    }

    private function maybeWriteJson(array $affected, array $statuses): void
    {
        $path = (string) $this->option('json');
        if ($path === '') {
            return;
        }

        $dir = dirname($path);
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        file_put_contents($path, json_encode([
            'scanned_at' => now()->toIso8601String(),
            'statuses'   => $statuses,
            'marker'     => self::MARKER,
            'exams'      => $affected,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        $this->info("📄 Đã ghi kết quả ra {$path}");
    }
}

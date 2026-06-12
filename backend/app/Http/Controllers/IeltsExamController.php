<?php

namespace App\Http\Controllers;

use App\Models\Exam;
use App\Services\IELTSService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;

/**
 * IeltsExamController — quản lý đề IELTS theo concept đúng:
 *   • 1 đề = 1 skill (listening | reading | writing | speaking)
 *   • Có 2 chế độ chơi: practice (chọn sections) + full test (làm liên tục)
 *   • Không có "full 4 skills" trong 1 record exam
 *
 * Endpoints:
 *   Teacher:
 *     POST   /api/teacher/exams/ielts                    Tạo draft mới
 *     PUT    /api/teacher/exams/{id}/ielts               Update draft
 *     POST   /api/teacher/exams/{id}/ielts/publish       Publish (single-skill)
 *     GET    /api/teacher/exams/{id}/ielts/draft         Lấy draft data
 *
 *   Student:
 *     GET    /api/student/exams/{id}/ielts/detail        Trang detail (cho StudentIeltsExamDetail)
 */
class IeltsExamController extends Controller
{
    private const ALLOWED_SKILLS = ['listening', 'reading', 'writing', 'speaking'];
    private const ALLOWED_TEST_TYPES = ['Academic', 'General Training'];

    private const DEFAULT_DURATIONS = [
        'listening' => 40,  // 30' nghe + 10' chuyển đáp án (chuẩn IELTS)
        'reading' => 60,
        'writing' => 60,
        'speaking' => 14,
    ];

    private const DEFAULT_TOTAL_QUESTIONS = [
        'listening' => 40,
        'reading' => 40,
        'writing' => 2,
        'speaking' => 3,
    ];

    private const DEFAULT_PARTS_COUNT = [
        'listening' => 4,
        'reading' => 3,
        'writing' => 2,
        'speaking' => 3,
    ];

    /* ============================================================
     |  TEACHER endpoints
     * ===========================================================*/

    /**
     * Tạo draft đề IELTS mới (1 skill).
     * POST /api/teacher/exams/ielts
     */
    public function createDraft(Request $request)
    {
        $user = Auth::user();
        if (!$user) {
            return $this->errorResponse('Bạn không có quyền truy cập.', 401);
        }

        $validator = Validator::make($request->all(), [
            'eTitle' => 'required|string|max:255',
            'eDescription' => 'nullable|string',
            'ielts_test_type' => 'required|string|in:Academic,General Training',
            'ielts_skill' => 'required|string|in:' . implode(',', self::ALLOWED_SKILLS),
            'eDifficulty' => 'nullable|string',
            'age_group' => 'nullable|in:kids,teens,adults,all',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ.', 400, $validator->errors());
        }

        $skill = $request->input('ielts_skill');
        $testType = $request->input('ielts_test_type');

        $exam = Exam::create([
            'eTitle' => $request->input('eTitle'),
            'eDescription' => $request->input('eDescription', ''),
            'eType' => 'IELTS',  // Single value, phân biệt AC/GT bằng ielts_test_type
            'eSkill' => ucfirst($skill),
            'ielts_test_type' => $testType,
            'ielts_skill' => $skill,
            'eDuration_minutes' => self::DEFAULT_DURATIONS[$skill],
            'eStatus' => 'draft',
            'ePurpose' => 'exam',
            'eDifficulty' => $request->input('eDifficulty', 'medium'),
            'eTeacher_id' => $user->uId,
            'age_group' => $request->input('age_group', 'all'),
            'ielts_config' => [
                'test_type' => $testType,
                'skill' => $skill,
                'play_modes' => $this->defaultPlayModes(),
            ],
        ]);

        return response()->json([
            'status' => 'success',
            'data' => [
                'eId' => $exam->eId,
                'message' => 'Đã tạo draft IELTS exam',
            ],
        ]);
    }

    /**
     * Update draft (lưu nội dung sections + play_modes).
     * PUT /api/teacher/exams/{id}/ielts
     */
    public function updateDraft(Request $request, $examId)
    {
        $user = Auth::user();
        $exam = Exam::where('eId', $examId)
            ->where('eTeacher_id', $user->uId)
            ->first();

        if (!$exam) {
            return $this->errorResponse('Không tìm thấy đề thi.', 404);
        }

        if (!$this->isIeltsExam($exam)) {
            return $this->errorResponse('Đề này không phải IELTS.', 400);
        }

        $validator = Validator::make($request->all(), [
            'eTitle' => 'sometimes|string|max:255',
            'eDescription' => 'sometimes|nullable|string',
            'ielts_test_type' => 'sometimes|string|in:Academic,General Training',
            'ielts_config' => 'sometimes|array',
            'ielts_data' => 'sometimes|array',
            'age_group' => 'sometimes|in:kids,teens,adults,all',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ.', 400, $validator->errors());
        }

        // Update metadata
        $updates = $request->only(['eTitle', 'eDescription']);

        if ($request->has('age_group')) {
            $updates['age_group'] = $request->input('age_group');
        }

        if ($request->has('ielts_test_type')) {
            $testType = $request->input('ielts_test_type');
            $updates['ielts_test_type'] = $testType;
            // Giữ eType = 'IELTS' (enum không có _ACADEMIC/_GENERAL)
        }

        // Merge ielts_config (giữ nguyên những field không update)
        if ($request->has('ielts_config')) {
            $existingConfig = $exam->ielts_config ?? [];
            $newConfig = $request->input('ielts_config');
            $updates['ielts_config'] = array_merge($existingConfig, $newConfig);
        }

        // Lưu draft data (chưa publish nên chỉ stash vào ielts_config['draft_data'])
        if ($request->has('ielts_data')) {
            $config = $updates['ielts_config'] ?? ($exam->ielts_config ?? []);
            $config['draft_data'] = $request->input('ielts_data');
            $updates['ielts_config'] = $config;
        }

        $exam->update($updates);

        return response()->json([
            'status' => 'success',
            'data' => [
                'eId' => $exam->eId,
                'message' => 'Đã lưu draft',
            ],
        ]);
    }

    /**
     * Publish đề IELTS (single skill).
     * POST /api/teacher/exams/{id}/ielts/publish
     *
     * Body:
     *   {
     *     "ielts_test_type": "Academic" | "General Training",
     *     "ielts_skill": "listening",
     *     "ielts_data": { "sections": [...] | "passages": [...] | "tasks": [...] | "parts": [...] },
     *     "play_modes": { "practice_enabled": true, "full_test_enabled": true, "time_limit_options": [...] }
     *   }
     */
    public function publish(Request $request, $examId)
    {
        $user = Auth::user();
        $exam = Exam::where('eId', $examId)
            ->where('eTeacher_id', $user->uId)
            ->first();

        if (!$exam) {
            return $this->errorResponse('Không tìm thấy đề thi.', 404);
        }

        $validator = Validator::make($request->all(), [
            'ielts_test_type' => 'required|string|in:Academic,General Training',
            'ielts_skill' => 'required|string|in:' . implode(',', self::ALLOWED_SKILLS),
            'ielts_data' => 'required|array',
            'play_modes' => 'sometimes|array',
            'play_modes.practice_enabled' => 'sometimes|boolean',
            'play_modes.full_test_enabled' => 'sometimes|boolean',
            'play_modes.time_limit_options' => 'sometimes|array',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ.', 400, $validator->errors());
        }

        $testType = $request->input('ielts_test_type');
        $skill = $request->input('ielts_skill');
        $data = $request->input('ielts_data');
        $playModes = $request->input('play_modes', $this->defaultPlayModes());

        // Validate ít nhất 1 mode được bật
        if (!($playModes['practice_enabled'] ?? false) && !($playModes['full_test_enabled'] ?? false)) {
            return $this->errorResponse(
                'Phải bật ít nhất 1 chế độ chơi (Practice hoặc Full test).',
                400
            );
        }

        // Validate có ít nhất 1 section/passage/task/part
        if (!$this->hasContent($skill, $data)) {
            return $this->errorResponse(
                'Đề thi phải có ít nhất 1 ' . $this->sectionWordFor($skill) . ' với câu hỏi.',
                400
            );
        }

        // Câu CÓ LỰA CHỌN (trắc nghiệm/TFNG/matching…) chưa chọn → tự điền "A".
        // Câu NHẬP TAY (điền từ/hoàn thành câu) thiếu đáp án → CHẶN xuất bản.
        if (in_array($skill, ['listening', 'reading'], true)) {
            [$data, $missing] = $this->fillIeltsChoiceAndFindMissing($data);
            if (!empty($missing)) {
                $shown = implode(', ', array_slice($missing, 0, 20)) . (count($missing) > 20 ? '…' : '');
                return $this->errorResponse(
                    "Không thể xuất bản: câu {$shown} dạng tự nhập (điền từ / hoàn thành câu) chưa có đáp án. Vui lòng nhập đáp án cho các câu này trước khi xuất bản.",
                    422
                );
            }
        }

        try {
            // Wrap data theo format mà IELTSService expect (full structure với 4 skills)
            // Vì service hiện tại dùng publishIeltsExam(exam, testType, fullData)
            // Chỉ truyền skill mình đang publish, các skill khác để rỗng
            $wrappedData = [
                'listening' => $skill === 'listening' ? ['sections' => $data['sections'] ?? $data] : ['sections' => []],
                'reading'   => $skill === 'reading'   ? ['passages' => $data['passages'] ?? $data] : ['passages' => []],
                'writing'   => $skill === 'writing'   ? ['tasks' => $data['tasks'] ?? $data]      : ['tasks' => []],
                'speaking'  => $skill === 'speaking'  ? ['parts' => $data['parts'] ?? $data]      : ['parts' => []],
            ];

            $result = IELTSService::publishIeltsExam($exam, $testType, $wrappedData);

            // Update thêm các field single-skill specific (publishIeltsExam đã set published)
            $exam->update([
                'eType' => 'IELTS',  // Giữ đúng enum
                'eSkill' => ucfirst($skill),
                'ielts_test_type' => $testType,
                'ielts_skill' => $skill,
                'eDuration_minutes' => self::DEFAULT_DURATIONS[$skill],
                'ielts_config' => array_merge($exam->ielts_config ?? [], [
                    'test_type' => $testType,
                    'skill' => $skill,
                    'play_modes' => $playModes,
                ]),
            ]);

            return response()->json([
                'status' => 'success',
                'data' => [
                    'message' => 'Xuất bản đề IELTS thành công',
                    'exam_id' => $exam->eId,
                    'questions_count' => $result['total_questions'] ?? 0,
                    'skill' => $skill,
                    'test_type' => $testType,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('IeltsExamController::publish failed', [
                'exam_id' => $exam->eId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->errorResponse('Xuất bản thất bại: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Lấy draft data (cho teacher quay lại edit).
     * GET /api/teacher/exams/{id}/ielts/draft
     */
    public function getDraft(Request $request, $examId)
    {
        $user = Auth::user();
        $isAdmin = $user && $user->uRole === 'admin';
        $exam = Exam::where('eId', $examId)
            ->when(!$isAdmin, fn($q) => $q->where('eTeacher_id', $user->uId))
            ->with(['contentBlocks', 'questions.answers'])
            ->first();

        if (!$exam) {
            return $this->errorResponse('Không tìm thấy đề thi.', 404);
        }

        if (!$this->isIeltsExam($exam)) {
            return $this->errorResponse('Đề này không phải IELTS.', 400);
        }

        $config = $exam->ielts_config ?? [];

        // Ưu tiên draft_data (do user gõ chưa publish). Nếu trống (đề đã publish hoặc
        // import từ chỗ khác) → reconstruct từ contentBlocks + questions thật trong DB.
        $ieltsData = $config['draft_data'] ?? null;
        if (!$ieltsData) {
            $ieltsData = $this->reconstructIeltsDraftFromExam($exam);
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'eId' => $exam->eId,
                'eTitle' => $exam->eTitle,
                'eDescription' => $exam->eDescription,
                'eStatus' => $exam->eStatus,
                'eDuration_minutes' => $exam->eDuration_minutes,
                'ielts_test_type' => $exam->ielts_test_type,
                'ielts_skill' => $exam->ielts_skill,
                'ielts_config' => $config,
                'ielts_data' => $ieltsData,
                'age_group' => $exam->age_group ?? 'all',
            ],
        ]);
    }

    /**
     * Reconstruct draft data (cho editor frontend) từ contentBlocks + questions
     * trong DB. Dùng khi exam đã publish hoặc import xong nhưng `draft_data`
     * trong ielts_config không có.
     */
    private function reconstructIeltsDraftFromExam(Exam $exam): array
    {
        $skill = strtolower((string) ($exam->ielts_skill ?? ''));

        // LISTENING: 4 sections
        if ($skill === 'listening') {
            $sections = [];
            for ($n = 1; $n <= 4; $n++) {
                $block = $exam->contentBlocks->first(function ($b) use ($n) {
                    return ($b->block_type === 'audio')
                        && (($b->metadata['section_number'] ?? null) == $n);
                });
                $meta = $block ? ($block->metadata ?? []) : [];

                // Lấy audio URL từ content (đã chứa filename hash thật trên disk)
                $storedAudio = $block ? ($block->content ?? '') : '';
                $audioFile = $storedAudio
                    ? basename(parse_url($storedAudio, PHP_URL_PATH))
                    : ($meta['audio_filename'] ?? '');
                $audioUrl = $audioFile ? url('files/audio/' . $audioFile) : '';

                $questions = $exam->questions
                    ->where('qSkill', 'listening')
                    ->where('qPart', $n)
                    ->sortBy(fn($q) => ($q->qData['question_number'] ?? $q->qSection_order))
                    ->values()
                    ->map(function ($q) {
                        $data = $q->qData ?? [];
                        $options = $data['options'] ?? null;
                        // Fallback build options từ answers nếu qData không có
                        if (!$options && $q->relationLoaded('answers') && $q->answers->count() >= 2) {
                            $options = [];
                            $letters = ['A', 'B', 'C', 'D', 'E', 'F'];
                            $sorted = $q->answers->sortBy(fn($a) => $a->aOrder ?? $a->aId)->values();
                            foreach ($sorted as $idx => $ans) {
                                if (!isset($letters[$idx])) break;
                                $options[$letters[$idx]] = $ans->aContent;
                            }
                        }
                        return [
                            'id'             => 's' . ($q->qPart ?? 1) . '-q' . ($data['question_number'] ?? $q->qSection_order),
                            'questionNumber' => $data['question_number'] ?? $q->qSection_order,
                            // Normalize underscore→hyphen để match dropdown options frontend
                            'questionType'   => str_replace('_', '-', (string) ($q->qType ?? 'multiple-choice')),
                            'questionText'   => $q->qContent ?? '',
                            'options'        => $options ?: ['A' => '', 'B' => '', 'C' => '', 'D' => ''],
                            'correctAnswer'  => $data['correct_answer'] ?? '',
                            'taskInstruction'=> $data['task_instruction'] ?? '',
                            'wordLimit'      => $data['word_limit'] ?? '',
                            'selectCount'    => $data['select_count'] ?? 1,
                            'useWordBank'    => $data['use_word_bank'] ?? false,
                        ];
                    })
                    ->toArray();

                $sections[] = [
                    'sectionNumber'      => $n,
                    'sectionTitle'       => $meta['section_title'] ?? '',
                    'sectionInstruction' => $meta['instructions'] ?? '',
                    'audioUrl'           => $audioUrl,
                    'audioFileName'      => $meta['audio_filename'] ?? $audioFile,
                    'transcript'         => $meta['transcript'] ?? '',
                    'questions'          => $questions,
                ];
            }
            return ['sections' => $sections];
        }

        // READING: passages
        if ($skill === 'reading') {
            $passages = [];
            $textBlocks = $exam->contentBlocks
                ->filter(fn($b) => in_array($b->block_type, ['text', 'passage']))
                ->sortBy(fn($b) => $b->metadata['passage_number'] ?? $b->display_order ?? 0)
                ->values();
            foreach ($textBlocks as $block) {
                $meta = $block->metadata ?? [];
                $passageNum = $meta['passage_number'] ?? ($block->display_order ?? 1);
                $questions = $exam->questions
                    ->where('qSkill', 'reading')
                    ->where('qPart', $passageNum)
                    ->sortBy(fn($q) => ($q->qData['question_number'] ?? $q->qSection_order))
                    ->values()
                    ->map(function ($q) {
                        $data = $q->qData ?? [];
                        return [
                            'id'             => 'p' . ($q->qPart ?? 1) . '-q' . ($data['question_number'] ?? $q->qSection_order),
                            'questionNumber' => $data['question_number'] ?? $q->qSection_order,
                            'questionType'   => str_replace('_', '-', (string) ($q->qType ?? 'multiple-choice')),
                            'questionText'   => $q->qContent ?? '',
                            'options'        => $data['options'] ?? ['A' => '', 'B' => '', 'C' => '', 'D' => ''],
                            'correctAnswer'  => $data['correct_answer'] ?? '',
                            'taskInstruction'=> $data['task_instruction'] ?? '',
                            'wordLimit'      => $data['word_limit'] ?? '',
                            'selectCount'    => $data['select_count'] ?? 1,
                        ];
                    })
                    ->toArray();
                $passages[] = [
                    'passageNumber'      => $passageNum,
                    'passageTitle'       => $meta['passage_title'] ?? '',
                    'passageText'        => $block->content ?? '',
                    'passageInstruction' => $meta['instructions'] ?? '',
                    'questions'          => $questions,
                ];
            }
            return ['passages' => $passages];
        }

        // WRITING / SPEAKING: trả config tối thiểu (editor có thể tự fill default)
        if ($skill === 'writing' || $skill === 'speaking') {
            $key = $skill === 'writing' ? 'tasks' : 'parts';
            return [$key => $config[$skill][$key] ?? []];
        }

        return [];
    }

    /* ============================================================
     |  STUDENT endpoints
     * ===========================================================*/

    /**
     * Trang detail cho học viên (như study4.com).
     * GET /api/student/exams/{id}/ielts/detail
     *
     * Trả về metadata + sections + play_modes (KHÔNG trả nội dung câu hỏi).
     * Học viên sẽ vào URL khác để làm bài, lúc đó mới load full content.
     *
     * Tối ưu: chỉ load count + grouping, không load full data.
     */
    public function studentDetail(Request $request, $examId)
    {
        // Light query — không eager load relations nặng
        $exam = Exam::where('eId', $examId)
            ->where('eStatus', 'published')
            ->first([
                'eId', 'eTitle', 'eDescription', 'eType', 'eSkill',
                'eDuration_minutes', 'ielts_test_type', 'ielts_skill', 'ielts_config',
            ]);

        if (!$exam) {
            return $this->errorResponse('Không tìm thấy đề thi hoặc chưa xuất bản.', 404);
        }

        if (!$this->isIeltsExam($exam)) {
            return $this->errorResponse('Đề này không phải IELTS.', 400);
        }

        $skill = $exam->ielts_skill ?: $this->detectSkillFromExam($exam);
        $testType = $exam->ielts_test_type ?: 'Academic';
        $config = $exam->ielts_config ?? [];
        $playModes = $config['play_modes'] ?? $this->defaultPlayModes();

        // Aggregate query: lấy sections + question count trong 1 query
        $sections = $this->buildSectionsLight($exam->eId, $skill);
        $totalQuestions = array_sum(array_column($sections, 'questionCount'));

        return response()->json([
            'status' => 'success',
            'data' => [
                'eId' => $exam->eId,
                'eTitle' => $exam->eTitle,
                'eDescription' => $exam->eDescription,
                'eType' => $exam->eType,
                'eSkill' => ucfirst($skill),
                'eDuration_minutes' => $exam->eDuration_minutes ?: self::DEFAULT_DURATIONS[$skill],
                'ielts_test_type' => $testType,
                'ielts_skill' => $skill,
                'ielts_config' => $config,
                'totalQuestions' => $totalQuestions ?: self::DEFAULT_TOTAL_QUESTIONS[$skill],
                'totalParts' => count($sections) ?: self::DEFAULT_PARTS_COUNT[$skill],
                'sections' => $sections,
                'participants' => $this->countParticipants($exam->eId),
                'commentsCount' => $this->countComments($exam->eId),
                'playMode' => $playModes,
            ],
        ]);
    }

    /* ============================================================
     |  Helpers
     * ===========================================================*/

    private function defaultPlayModes(): array
    {
        return [
            'practice_enabled' => true,
            'full_test_enabled' => true,
            'time_limit_options' => [null, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75],
        ];
    }

    private function isIeltsExam(Exam $exam): bool
    {
        return in_array($exam->eType, ['IELTS', 'IELTS_ACADEMIC', 'IELTS_GENERAL'], true);
    }

    private function detectSkillFromExam(Exam $exam): string
    {
        $skill = strtolower($exam->eSkill ?? '');
        return in_array($skill, self::ALLOWED_SKILLS, true) ? $skill : 'listening';
    }

    private function sectionWordFor(string $skill): string
    {
        switch ($skill) {
            case 'reading':  return 'passage';
            case 'writing':  return 'task';
            case 'speaking': return 'part';
            default:         return 'section';
        }
    }

    private function hasContent(string $skill, array $data): bool
    {
        switch ($skill) {
            case 'listening': $key = 'sections';  break;
            case 'reading':   $key = 'passages';  break;
            case 'writing':   $key = 'tasks';     break;
            case 'speaking':  $key = 'parts';     break;
            default:          $key = 'sections';
        }

        $items = $data[$key] ?? (is_array($data) ? $data : []);
        return is_array($items) && count($items) > 0;
    }

    /**
     * Với câu Listening/Reading chưa có đáp án:
     *  - Dạng CÓ LỰA CHỌN (multiple choice, TFNG, yes/no, matching, heading…) → tự điền "A".
     *  - Dạng NHẬP TAY (completion, short answer, labelling…) → gom vào danh sách thiếu để CHẶN.
     * Trả về [data đã điền, danh sách số câu còn thiếu đáp án nhập tay].
     */
    private function fillIeltsChoiceAndFindMissing(array $data): array
    {
        $isChoice = function ($qtype): bool {
            $t = strtolower(str_replace([' ', '-'], '_', (string) $qtype));
            foreach (['multiple_choice', 'choice', 'true_false', 'tfng', 'identifying_information', 'yes_no', 'matching', 'heading'] as $kw) {
                if (strpos($t, $kw) !== false) return true;
            }
            return false;
        };
        $missing = [];
        $walk = function (&$node) use (&$walk, &$missing, $isChoice) {
            if (!is_array($node)) return;
            foreach ($node as $key => &$val) {
                if ($key === 'questions' && is_array($val)) {
                    foreach ($val as &$q) {
                        if (!is_array($q)) continue;
                        if (trim((string) ($q['correctAnswer'] ?? '')) !== '') continue;
                        if ($isChoice($q['questionType'] ?? '')) {
                            $q['correctAnswer'] = 'A'; // chọn đại đáp án đầu
                        } else {
                            $missing[] = $q['questionNumber'] ?? '?';
                        }
                    }
                    unset($q);
                }
                if (is_array($val)) $walk($val);
            }
            unset($val);
        };
        $walk($data);
        return [$data, $missing];
    }

    /**
     * Build sections preview LIGHT — chỉ dùng aggregate query (không load full questions).
     * Nhanh hơn 5-10x so với buildSectionsPreview cũ.
     */
    private function buildSectionsLight(int $examId, string $skill): array
    {
        // Lấy content blocks (audio/passage) — chỉ field cần thiết
        $blocks = \DB::table('content_blocks')
            ->where('exam_id', $examId)
            ->orderBy('display_order')
            ->get(['id', 'metadata', 'display_order']);

        if ($blocks->isEmpty()) return [];

        // Aggregate count + question types của từng block trong 1 query
        $blockIds = $blocks->pluck('id')->toArray();
        $statsByBlock = \DB::table('questions')
            ->whereIn('content_block_id', $blockIds)
            ->select('content_block_id', \DB::raw('COUNT(*) as cnt'), \DB::raw("GROUP_CONCAT(DISTINCT qType) as types"))
            ->groupBy('content_block_id')
            ->get()
            ->keyBy('content_block_id');

        $sections = [];
        foreach ($blocks as $i => $block) {
            $meta = is_string($block->metadata) ? json_decode($block->metadata, true) : (array)$block->metadata;
            $sectionNumber = $meta['section_number'] ?? $meta['part'] ?? ($i + 1);
            $stats = $statsByBlock->get($block->id);

            $types = [];
            if ($stats && $stats->types) {
                $types = array_values(array_filter(array_map(
                    fn ($t) => $this->formatQuestionType(trim($t)),
                    explode(',', $stats->types)
                )));
            }

            $sections[] = [
                'index' => (int) $sectionNumber,
                'name' => $this->sectionDisplayName($skill, (int) $sectionNumber, $meta ?: []),
                'questionCount' => $stats ? (int) $stats->cnt : 0,
                'questionTypes' => $types,
            ];
        }

        return $sections;
    }

    /**
     * Build preview sections từ exam đã publish (đọc từ content_blocks + questions).
     */
    private function buildSectionsPreview(Exam $exam, string $skill): array
    {
        $blocks = $exam->contentBlocks->sortBy('display_order');
        $questions = $exam->questions;

        $sections = [];
        foreach ($blocks as $block) {
            $blockMeta = $block->metadata ?? [];
            $sectionNumber = $blockMeta['section_number'] ?? $blockMeta['part'] ?? null;

            // Lọc questions thuộc section này
            $sectionQuestions = $questions->filter(function ($q) use ($block, $sectionNumber) {
                if (isset($q->qPart) && $sectionNumber !== null) {
                    return (int)$q->qPart === (int)$sectionNumber;
                }
                return $q->content_block_id == $block->id;
            });

            $questionTypes = $sectionQuestions
                ->pluck('qType')
                ->filter()
                ->unique()
                ->map(fn($t) => $this->formatQuestionType((string)$t))
                ->values()
                ->toArray();

            $sections[] = [
                'index' => $sectionNumber ?? (count($sections) + 1),
                'name' => $this->sectionDisplayName($skill, $sectionNumber ?? count($sections) + 1, $blockMeta),
                'questionCount' => $sectionQuestions->count(),
                'questionTypes' => $questionTypes,
            ];
        }

        return $sections;
    }

    private function sectionDisplayName(string $skill, int $num, array $meta): string
    {
        if (!empty($meta['section_title'])) {
            return $meta['section_title'];
        }
        if (!empty($meta['title'])) {
            return $meta['title'];
        }
        switch ($skill) {
            case 'listening': return "Recording {$num}";
            case 'reading':   return "Passage {$num}";
            case 'writing':   return "Task {$num}";
            case 'speaking':  return "Part {$num}";
            default:          return "Section {$num}";
        }
    }

    private function formatQuestionType(string $type): string
    {
        return ucwords(str_replace(['_', '-'], ' ', $type));
    }

    private function countParticipants(int $examId): int
    {
        try {
            // Đếm số user khác nhau đã thực sự thi/luyện đề này > 1 phút.
            // - Đã submit: sSubmit_time - sStart_time >= 60s
            // - Đang làm: now() - sStart_time >= 60s (chưa submit nhưng đã ngồi > 1p)
            // → đảm bảo không count user mở thử rồi tắt ngay.
            return \App\Models\Submission::where('exam_id', $examId)
                ->whereNotNull('sStart_time')
                ->where(function ($q) {
                    $q->whereRaw('TIMESTAMPDIFF(SECOND, sStart_time, sSubmit_time) >= 60')
                      ->orWhere(function ($q2) {
                          $q2->whereNull('sSubmit_time')
                             ->whereRaw('TIMESTAMPDIFF(SECOND, sStart_time, NOW()) >= 60');
                      });
                })
                ->distinct('user_id')
                ->count('user_id');
        } catch (\Throwable $e) {
            return 0;
        }
    }

    /**
     * Tổng số bình luận của 1 đề (gồm cả top-level + replies, đã bỏ deleted).
     */
    private function countComments(int $examId): int
    {
        try {
            return \App\Models\ExamComment::where('exam_id', $examId)
                ->where('is_deleted', false)
                ->count();
        } catch (\Throwable $e) {
            return 0;
        }
    }

    private function errorResponse(string $message, int $status = 400, $errors = null)
    {
        $payload = ['status' => 'error', 'message' => $message];
        if ($errors !== null) {
            $payload['errors'] = $errors;
        }
        return response()->json($payload, $status);
    }
}

/**
 * THPT / THCS — Đề thi Tiếng Anh phổ thông Việt Nam (linh hoạt theo section).
 *
 * Một đề = nhiều "section" động (không cố định 4 part).
 * Mỗi section có `type` quyết định dạng câu hỏi + payload riêng.
 *
 * Hỗ trợ các dạng phổ biến trong đề THCS/THPT/Đầu vào ĐH:
 *  - phonetics            Ngữ âm (phát âm / trọng âm)
 *  - mc_questions         Trắc nghiệm (ngữ pháp / từ vựng / đồng-trái nghĩa / giao tiếp)
 *  - word_form            Chia dạng từ
 *  - mc_cloze             Đọc điền trắc nghiệm
 *  - word_bank_cloze      Điền từ cho sẵn (ngân hàng từ)
 *  - open_cloze           Điền 1 từ tự do
 *  - error_identification Tìm lỗi sai
 *  - sentence_transformation  Viết lại câu
 *  - tf_group             Đúng/Sai theo context
 *  - reading_mixed        Đọc hiểu hỗn hợp (TF + MC + Sentence Insertion)
 *  - matching             Nối (1-4) → (A-F)
 */

// ── Shared ─────────────────────────────────────────────────────────────────
export interface ThptOption {
  id: string; // 'A' | 'B' | 'C' | 'D' ...
  text: string;
}

export interface ThptTfStatement {
  id: string;
  text: string;
  correct: boolean;
  explanation?: string;
}

export type SectionType =
  | 'phonetics'
  | 'mc_questions'
  | 'word_form'
  | 'mc_cloze'
  | 'word_bank_cloze'
  | 'open_cloze'
  | 'error_identification'
  | 'sentence_transformation'
  | 'tf_group'
  | 'reading_mixed'
  | 'matching'
  | 'listening'
  | 'speaking'
  | 'writing';

interface BaseSection {
  /** id ổn định để React key + reorder */
  id: string;
  type: SectionType;
  title: string;
  instructions: string;
  /** điểm mỗi câu (mặc định 1) */
  points_per_question?: number;
}

// ── 1. Phonetics (pronunciation / stress) ────────────────────────────────
export interface PhoneticsItem {
  question_number: number;
  /**
   * mỗi từ là 1 lựa chọn; `underline` là phần được đánh dấu (nghiêng + gạch chân).
   * `underlineStart` là vị trí bắt đầu của phần đó trong `text` (để định vị chính xác
   * khi cùng 1 chuỗi con xuất hiện nhiều lần, vd "in" trong "interesting").
   */
  words: Array<{ id: string; text: string; underline?: string; underlineStart?: number }>;
  correct_id: string; // từ "khác biệt"
  explanation?: string;
}
export interface PhoneticsSection extends BaseSection {
  type: 'phonetics';
  variant: 'pronunciation' | 'stress';
  items: PhoneticsItem[];
}

// ── 2. Multiple-choice questions (grammar/vocab/synonym/antonym/communication)
export interface McQuestionItem {
  question_number: number;
  prompt: string;
  options: ThptOption[];
  correct_id: string;
  explanation?: string;
}
export interface McQuestionsSection extends BaseSection {
  type: 'mc_questions';
  variant: 'grammar' | 'vocabulary' | 'synonym' | 'antonym' | 'communication' | 'general';
  items: McQuestionItem[];
}

// ── 3. Word form ──────────────────────────────────────────────────────────
export interface WordFormItem {
  question_number: number;
  /** câu có placeholder "____" hoặc "(1) ____" */
  sentence: string;
  root_word: string; // từ gốc trong ngoặc (BEAUTY)
  accepted_answers: string[];
  case_sensitive?: boolean;
  explanation?: string;
}
export interface WordFormSection extends BaseSection {
  type: 'word_form';
  items: WordFormItem[];
}

// ── 4. MC cloze (đọc điền trắc nghiệm) ────────────────────────────────────
export interface McClozeBlank {
  question_number: number;
  options: ThptOption[];
  correct_id: string;
  explanation?: string;
}
export interface McClozeSection extends BaseSection {
  type: 'mc_cloze';
  passage: string; // chứa "(1) ____"
  blanks: McClozeBlank[];
}

// ── 5. Word bank cloze (điền từ cho sẵn) ──────────────────────────────────
export interface WordBankBlank {
  question_number: number;
  accepted_answers: string[];
  case_sensitive?: boolean;
  explanation?: string;
}
export interface WordBankClozeSection extends BaseSection {
  type: 'word_bank_cloze';
  passage: string;
  word_bank: string[];
  blanks: WordBankBlank[];
}

// ── 6. Open cloze (điền 1 từ tự do) ───────────────────────────────────────
export interface OpenClozeBlank {
  question_number: number;
  accepted_answers: string[];
  case_sensitive?: boolean;
  explanation?: string;
}
export interface OpenClozeSection extends BaseSection {
  type: 'open_cloze';
  passage: string;
  blanks: OpenClozeBlank[];
}

// ── 7. Error identification (tìm lỗi sai) ─────────────────────────────────
export interface ErrorIdItem {
  question_number: number;
  /** câu đầy đủ; segments là các phần gạch chân A-D */
  segments: ThptOption[];
  /** context optional (phần text quanh segment) */
  sentence?: string;
  correct_id: string; // segment có lỗi
  explanation?: string;
}
export interface ErrorIdSection extends BaseSection {
  type: 'error_identification';
  items: ErrorIdItem[];
}

// ── 8. Sentence transformation (viết lại câu) ─────────────────────────────
export interface TransformationItem {
  question_number: number;
  original: string;
  lead_in?: string;     // phần mở đầu cho sẵn (vd "It is...")
  prompt_word?: string; // từ bắt buộc dùng
  accepted_answers: string[];
  explanation?: string;
}
export interface TransformationSection extends BaseSection {
  type: 'sentence_transformation';
  items: TransformationItem[];
}

// ── 9. TF group (Đúng/Sai theo context) ───────────────────────────────────
export interface TfGroupItem {
  question_number: number;
  context: string;
  context_style?: 'notice' | 'message' | 'ad' | 'email' | 'paragraph';
  statements: ThptTfStatement[];
}
export interface TfGroupSection extends BaseSection {
  type: 'tf_group';
  items: TfGroupItem[];
}

// ── 10. Reading mixed ─────────────────────────────────────────────────────
export type ReadingMixedItem =
  | {
      kind: 'tf_group';
      question_number: number;
      context_paragraph_ref?: string;
      statements: ThptTfStatement[];
    }
  | {
      kind: 'mc';
      question_number: number;
      prompt: string;
      options: ThptOption[];
      correct_id: string;
      explanation?: string;
    }
  | {
      kind: 'sentence_insertion';
      question_number: number;
      prompt: string;
      sentence_to_insert: string;
      correct_marker: 'A' | 'B' | 'C' | 'D';
      explanation?: string;
    };
export interface ReadingMixedSection extends BaseSection {
  type: 'reading_mixed';
  passage: string;
  items: ReadingMixedItem[];
}

// ── 11. Matching ──────────────────────────────────────────────────────────
export interface MatchingItem {
  question_number: number;
  list_1: string[];
  list_2: string[];
  answers: Record<string, string>;
  explanation?: string;
}
export interface MatchingSection extends BaseSection {
  type: 'matching';
  items: MatchingItem[];
}

// ── 12. Listening (audio + trắc nghiệm / điền chỗ trống) ──────────────────
/**
 * Listening item:
 *  - kind 'mc' (default, backward-compatible): trắc nghiệm A–D
 *  - kind 'fill_blank': nghe → điền từ/cụm, tự chấm theo accepted_answers
 */
export interface ListeningItem {
  question_number: number;
  /** default 'mc' khi thiếu (đề cũ) */
  kind?: 'mc' | 'fill_blank';
  prompt: string;
  // kind=mc
  options?: ThptOption[];
  correct_id?: string;
  // kind=fill_blank
  accepted_answers?: string[];
  case_sensitive?: boolean;
  explanation?: string;
}
export interface ListeningSection extends BaseSection {
  type: 'listening';
  audio_url: string;
  transcript?: string;
  /**
   * Ảnh đề nguyên khối (form/note) — nếu có thì HS xem layout 2 cột:
   * trái = ảnh đề, phải = câu trả lời (giống IELTS).
   */
  task_image?: string;
  /** 'image_block' khi GV chọn dạng nghe + ảnh đề */
  layout?: 'default' | 'image_block';
  items: ListeningItem[];
}

// ── 13. Speaking (đề nói — ghi âm, AI chấm) ───────────────────────────────
export interface SpeakingItem {
  question_number: number;
  prompt: string;
  prep_seconds?: number;
  speak_seconds?: number;
}
export interface SpeakingSection extends BaseSection {
  type: 'speaking';
  items: SpeakingItem[];
}

// ── 14. Writing (viết đoạn / bài văn — giáo viên chấm tay) ────────────────
export interface WritingItem {
  question_number: number;
  /** Đề bài cho học viên */
  prompt: string;
  /** Gợi ý số từ tối thiểu (UI soft-hint, không hard-block) */
  min_words?: number;
  /** Gợi ý số từ tối đa */
  max_words?: number;
  /** Ghi chú / rubric ngắn cho GV — ẩn với HV khi thi */
  guidance?: string;
}
export interface WritingSection extends BaseSection {
  type: 'writing';
  items: WritingItem[];
}

// ── Union ───────────────────────────────────────────────────────────────────
export type ThptSection =
  | PhoneticsSection
  | McQuestionsSection
  | WordFormSection
  | McClozeSection
  | WordBankClozeSection
  | OpenClozeSection
  | ErrorIdSection
  | TransformationSection
  | TfGroupSection
  | ReadingMixedSection
  | MatchingSection
  | ListeningSection
  | SpeakingSection
  | WritingSection;

// ── Full config ──────────────────────────────────────────────────────────
export interface ThptConfig {
  version: '2.0';
  level?: 'THCS' | 'THPT' | 'DGNL' | 'OTHER'; // cấp độ đề
  school?: string;                            // tên trường/sở (optional)
  total_duration_minutes: number;
  scale_max: number;
  show_explanation?: boolean;                 // Hiển thị giải thích đáp án khi học viên xem lại kết quả (mặc định true)
  sections: ThptSection[];
}

// ── Submission ────────────────────────────────────────────────────────────
/**
 * Answer key conventions:
 *  - single-answer (mc, phonetics, error, cloze blank, word_form, transformation): "q{n}" → string|...
 *  - tf statements: "q{n}.s{i}" → boolean
 *  - matching rows: "q{n}.{i}" → letter
 */
export type ThptAnswers = Record<string, boolean | string>;

// ── Result/Review ─────────────────────────────────────────────────────────
export interface ThptResultSectionStat {
  section_id: string;
  type: SectionType;
  title: string;
  correct_count: number;
  total_count: number;
  raw_score: number;
  raw_max: number;
}

export interface ThptResult {
  raw_score: number;
  raw_score_max: number;
  scaled_score: number;
  scale_max: number;
  sections: ThptResultSectionStat[];
  correct_answers: ThptAnswers;
}

// ── API ───────────────────────────────────────────────────────────────────
export interface CreateThptExamRequest {
  eTitle: string;
  eDescription?: string;
  age_group?: 'kids' | 'teens' | 'adults' | 'all';
  thpt_config?: Partial<ThptConfig>;
}

export interface UpdateThptExamRequest {
  eTitle?: string;
  eDescription?: string;
  age_group?: 'kids' | 'teens' | 'adults' | 'all';
  thpt_config?: ThptConfig;
}

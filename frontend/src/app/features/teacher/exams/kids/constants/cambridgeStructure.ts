// Cambridge YLE Parts Structure — Blueprint chuẩn 2018 (nguồn: cambridgeenglish.org)
// Mỗi part được GÁN SẴN dạng bài đúng chuẩn (taskType). Giáo viên không cần chọn lại,
// chỉ click vào part để vào thẳng editor. Vẫn có thể "Đổi dạng bài" nếu muốn tùy biến.
//
// description = nhãn tiếng Việt của dạng bài (hiển thị ở sidebar Step 2)
// taskType   = mã editor tương ứng (xem KidsTaskTypesSeeder)

export interface CambridgePart {
  partNumber: number;
  name: string;
  description: string; // nhãn dạng bài chuẩn (vd "Nghe & nối")
  taskType: string;    // mã editor được gán sẵn theo blueprint
}

export interface CambridgeSkillStructure {
  name: string;
  icon: string;
  totalParts: number;
  duration: string;
  parts: CambridgePart[];
}

export interface CambridgeLevelStructure {
  listening: CambridgeSkillStructure;
  reading_writing: CambridgeSkillStructure;
  speaking: CambridgeSkillStructure;
}

export const CAMBRIDGE_PARTS_STRUCTURE: Record<string, CambridgeLevelStructure> = {
  starters: {
    listening: {
      name: 'NGHE',
      icon: '🎧',
      totalParts: 4,
      duration: '~20 phút',
      parts: [
        { partNumber: 1, name: 'Part 1', description: 'Nghe & nối', taskType: 'listen_and_draw_lines' },
        { partNumber: 2, name: 'Part 2', description: 'Nghe & viết tên/số', taskType: 'listen_and_write' },
        { partNumber: 3, name: 'Part 3', description: 'Nghe & chọn tranh', taskType: 'listen_and_tick' },
        { partNumber: 4, name: 'Part 4', description: 'Nghe & tô màu', taskType: 'listen_colour_write' },
      ],
    },
    reading_writing: {
      name: 'ĐỌC VÀ VIẾT',
      icon: '📖',
      totalParts: 5,
      duration: '20 phút',
      parts: [
        { partNumber: 1, name: 'Part 1', description: 'Đúng/Sai theo tranh', taskType: 'look_and_read' },
        { partNumber: 2, name: 'Part 2', description: 'Yes/No về bức tranh', taskType: 'look_and_read' },
        { partNumber: 3, name: 'Part 3', description: 'Sắp xếp chữ cái', taskType: 'unscramble_words' },
        { partNumber: 4, name: 'Part 4', description: 'Điền từ từ ngân hàng', taskType: 'word_bank_fill' },
        { partNumber: 5, name: 'Part 5', description: 'Trả lời theo truyện tranh', taskType: 'look_read_write' },
      ],
    },
    speaking: {
      name: 'NÓI',
      icon: '🗣️',
      totalParts: 4,
      duration: '3-5 phút',
      parts: [
        { partNumber: 1, name: 'Part 1', description: 'Đặt thẻ vào tranh', taskType: 'object_placement' },
        { partNumber: 2, name: 'Part 2', description: 'Trả lời câu hỏi về tranh', taskType: 'picture_questions' },
        { partNumber: 3, name: 'Part 3', description: 'Hỏi-đáp về thẻ hình', taskType: 'picture_card_questions' },
        { partNumber: 4, name: 'Part 4', description: 'Câu hỏi cá nhân', taskType: 'picture_questions' },
      ],
    },
  },

  movers: {
    listening: {
      name: 'NGHE',
      icon: '🎧',
      totalParts: 5,
      duration: '~25 phút',
      parts: [
        { partNumber: 1, name: 'Part 1', description: 'Nghe & nối', taskType: 'listen_and_draw_lines' },
        { partNumber: 2, name: 'Part 2', description: 'Nghe & viết', taskType: 'listen_and_write' },
        { partNumber: 3, name: 'Part 3', description: 'Nghe & ghép chữ cái', taskType: 'listening_letter_match' },
        { partNumber: 4, name: 'Part 4', description: 'Nghe & chọn tranh', taskType: 'listen_and_tick' },
        { partNumber: 5, name: 'Part 5', description: 'Nghe & tô màu', taskType: 'listen_colour_write' },
      ],
    },
    reading_writing: {
      name: 'ĐỌC VÀ VIẾT',
      icon: '📖',
      totalParts: 6,
      duration: '30 phút',
      parts: [
        { partNumber: 1, name: 'Part 1', description: 'Ghép từ với định nghĩa', taskType: 'word_definition_matching' },
        { partNumber: 2, name: 'Part 2', description: 'Yes/No về bức tranh', taskType: 'look_and_read' },
        { partNumber: 3, name: 'Part 3', description: 'Hoàn thành hội thoại', taskType: 'dialogue_matching' },
        // BUG FIX (báo cáo lỗi MOVERS, cùng loại lỗi đã sửa cho Flyers ở 4576f7c):
        // mapping cũ lệch một bậc — dạng của Part 5 (story_completion) bị đặt ở
        // Part 4, còn Part 5 bị điền tạm bằng dạng của Part 6 (look_read_write)
        // nên Part 5 ≡ Part 6; mô tả Part 5 còn bị copy từ Starters Part 5.
        // Chọn 1 từ trong hộp từ có hình để điền vào chỗ trống của truyện (6 câu).
        { partNumber: 4, name: 'Part 4', description: 'Điền từ từ hộp từ cho sẵn (có hình)', taskType: 'word_bank_fill' },
        // Đọc truyện dài rồi hoàn thành câu tóm tắt bằng 1-5 từ (7 câu) —
        // KHÔNG có truyện tranh ở part này.
        { partNumber: 5, name: 'Part 5', description: 'Đọc truyện & hoàn thành câu', taskType: 'story_completion' },
        // BUG FIX "Part 6 sai format": A1 Movers R&W có 6 part / 35 câu
        // (6+6+6+6+7+4 — nguồn cambridgeenglish.org). Part 6 là "Look at the
        // picture and read the questions. Write one-word answers" (4 câu, nhìn
        // tranh → viết đáp án ngắn), KHÔNG phải điền từ từ ngân hàng —
        // word_bank_fill thuộc Part 4 (truyện + hộp từ).
        { partNumber: 6, name: 'Part 6', description: 'Nhìn tranh & viết đáp án 1 từ', taskType: 'look_read_write' },
      ],
    },
    speaking: {
      name: 'NÓI',
      icon: '🗣️',
      totalParts: 4,
      duration: '5-7 phút',
      parts: [
        { partNumber: 1, name: 'Part 1', description: 'Tìm điểm khác biệt', taskType: 'find_differences' },
        { partNumber: 2, name: 'Part 2', description: 'Kể chuyện theo tranh', taskType: 'picture_story_narration' },
        { partNumber: 3, name: 'Part 3', description: 'Tìm hình khác loại', taskType: 'odd_one_out' },
        { partNumber: 4, name: 'Part 4', description: 'Câu hỏi cá nhân', taskType: 'picture_questions' },
      ],
    },
  },

  flyers: {
    listening: {
      name: 'NGHE',
      icon: '🎧',
      totalParts: 5,
      duration: '~25 phút',
      parts: [
        { partNumber: 1, name: 'Part 1', description: 'Nghe & nối', taskType: 'listen_and_draw_lines' },
        { partNumber: 2, name: 'Part 2', description: 'Nghe & viết', taskType: 'listen_and_write' },
        { partNumber: 3, name: 'Part 3', description: 'Nghe & ghép chữ cái', taskType: 'listening_letter_match' },
        { partNumber: 4, name: 'Part 4', description: 'Nghe & chọn tranh', taskType: 'listen_and_tick' },
        { partNumber: 5, name: 'Part 5', description: 'Nghe & tô màu', taskType: 'listen_colour_write' },
      ],
    },
    reading_writing: {
      name: 'ĐỌC VÀ VIẾT',
      icon: '📖',
      totalParts: 7,
      duration: '40 phút',
      // BUG FIX (báo cáo lỗi FLYERS): A2 Flyers R&W có 7 part / 44 câu.
      // Mapping cũ sai ở Part 3 (word bank chứ không phải tự điền), Part 4
      // (chọn A/B/C chứ không phải tự điền) và Part 5 (đọc truyện dài chứ
      // không phải truyện tranh).
      parts: [
        // 10 định nghĩa / 15 từ ⇒ nhiều từ hơn số câu (có từ nhiễu).
        { partNumber: 1, name: 'Part 1', description: 'Ghép định nghĩa với từ (có từ nhiễu)', taskType: 'word_definition_matching' },
        // 7 câu, dùng CHUNG 8 lựa chọn A–H.
        { partNumber: 2, name: 'Part 2', description: 'Hoàn thành hội thoại (chọn A–H)', taskType: 'dialogue_matching' },
        // Chọn 1 từ trong hộp ~10-12 từ điền vào chỗ trống của truyện.
        { partNumber: 3, name: 'Part 3', description: 'Điền từ từ hộp từ cho sẵn', taskType: 'word_bank_fill' },
        // Chọn từ đúng A/B/C điền vào chỗ trống (multiple-choice cloze).
        { partNumber: 4, name: 'Part 4', description: 'Chọn từ đúng A/B/C', taskType: 'cloze_test' },
        // Đọc truyện dài rồi hoàn thành câu bằng 1-5 từ.
        { partNumber: 5, name: 'Part 5', description: 'Đọc truyện & hoàn thành câu', taskType: 'story_completion' },
        // Tự nghĩ 1 từ điền vào chỗ trống (không có gợi ý).
        { partNumber: 6, name: 'Part 6', description: 'Tự điền 1 từ vào chỗ trống', taskType: 'open_cloze' },
        { partNumber: 7, name: 'Part 7', description: 'Viết truyện theo tranh', taskType: 'picture_story_writing' },
      ],
    },
    speaking: {
      name: 'NÓI',
      icon: '🗣️',
      totalParts: 4,
      duration: '7-9 phút',
      parts: [
        { partNumber: 1, name: 'Part 1', description: 'Tìm điểm khác biệt', taskType: 'find_differences' },
        { partNumber: 2, name: 'Part 2', description: 'Trao đổi thông tin', taskType: 'information_exchange' },
        { partNumber: 3, name: 'Part 3', description: 'Kể chuyện theo tranh', taskType: 'picture_story_narration' },
        { partNumber: 4, name: 'Part 4', description: 'Câu hỏi cá nhân', taskType: 'picture_questions' },
      ],
    },
  },
};

// Helper: map part (1=listening, 2=reading_writing, 3=speaking) → skill key
const PART_TO_SKILL: Record<number, keyof CambridgeLevelStructure> = {
  1: 'listening',
  2: 'reading_writing',
  3: 'speaking',
};

// Khoá kỹ năng dùng cho phạm vi đề (scope)
export type SkillKey = keyof CambridgeLevelStructure;

// map kỹ năng → partId (1/2/3) và ngược lại
export const SKILL_TO_PART: Record<SkillKey, number> = {
  listening: 1,
  reading_writing: 2,
  speaking: 3,
};

// Nhãn + icon cho từng kỹ năng (dùng ở picker phạm vi & sidebar)
export const SKILL_META: Record<SkillKey, { label: string; icon: string }> = {
  listening: { label: 'Nghe', icon: '🎧' },
  reading_writing: { label: 'Đọc & Viết', icon: '📖' },
  speaking: { label: 'Nói', icon: '🗣️' },
};

export const SKILL_ORDER: SkillKey[] = ['listening', 'reading_writing', 'speaking'];

/** Lấy danh sách part của 1 kỹ năng trong 1 cấp độ (rỗng nếu không hợp lệ). */
export function getSkillParts(examType: string, skill: SkillKey): CambridgePart[] {
  const level = CAMBRIDGE_PARTS_STRUCTURE[examType?.toLowerCase()];
  if (!level || !level[skill]) return [];
  return level[skill].parts;
}

// Nhãn tiếng Việt cho mọi taskType (đồng bộ với KidsTaskTypesSeeder).
// Dùng để hiển thị "đúng dạng bài thực tế" trên sidebar khi giáo viên đổi dạng.
export const TASK_TYPE_LABELS: Record<string, string> = {
  // Listening
  listen_and_draw_lines: 'Nghe & nối',
  listen_and_write: 'Nghe & viết',
  listen_and_tick: 'Nghe & chọn tranh',
  listen_colour_write: 'Nghe & tô màu',
  listen_colour: 'Nghe & tô màu',
  listening_letter_match: 'Nghe & ghép chữ cái',
  // Reading & Writing
  look_and_read: 'Nhìn & đọc',
  look_read_write: 'Nhìn, đọc & viết',
  unscramble_words: 'Sắp xếp chữ cái',
  cloze_test: 'Điền từ vào chỗ trống',
  dialogue_matching: 'Ghép hội thoại',
  story_completion: 'Hoàn thành câu chuyện',
  word_definition_matching: 'Ghép từ với định nghĩa',
  word_bank_fill: 'Điền từ từ ngân hàng',
  reading_comprehension: 'Đọc hiểu',
  open_cloze: 'Tự điền từ',
  picture_story_writing: 'Viết truyện theo tranh',
  picture_sentence_writing: 'Viết câu mô tả tranh',
  // Speaking
  find_differences: 'Tìm điểm khác biệt',
  picture_story_narration: 'Kể chuyện theo tranh',
  odd_one_out: 'Tìm hình khác loại',
  information_exchange: 'Trao đổi thông tin',
  object_placement: 'Đặt thẻ vào tranh',
  picture_questions: 'Trả lời câu hỏi về hình',
  picture_card_questions: 'Hỏi-đáp về thẻ hình',
};

/** Trả nhãn tiếng Việt cho 1 taskType code; fallback chính code nếu chưa có. */
export function getTaskTypeLabel(code?: string | null): string {
  if (!code) return '';
  return TASK_TYPE_LABELS[code] ?? code;
}

/**
 * Lấy taskType chuẩn (blueprint) cho 1 part/subPart của 1 cấp độ.
 * Trả về null nếu không tìm thấy (vd cấp độ không hợp lệ).
 */
export function getBlueprintTaskType(
  examType: string,
  partId: number,
  subPartNumber: number
): string | null {
  const level = CAMBRIDGE_PARTS_STRUCTURE[examType?.toLowerCase()];
  if (!level) return null;
  const skillKey = PART_TO_SKILL[partId];
  if (!skillKey) return null;
  const subPart = level[skillKey].parts.find((p) => p.partNumber === subPartNumber);
  return subPart?.taskType ?? null;
}

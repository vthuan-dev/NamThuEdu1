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
        { partNumber: 4, name: 'Part 4', description: 'Điền chỗ trống trong truyện', taskType: 'story_completion' },
        { partNumber: 5, name: 'Part 5', description: 'Trả lời theo truyện tranh', taskType: 'look_read_write' },
        { partNumber: 6, name: 'Part 6', description: 'Điền từ từ ngân hàng', taskType: 'word_bank_fill' },
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
      parts: [
        { partNumber: 1, name: 'Part 1', description: 'Ghép từ với định nghĩa', taskType: 'word_definition_matching' },
        { partNumber: 2, name: 'Part 2', description: 'Hoàn thành hội thoại', taskType: 'dialogue_matching' },
        { partNumber: 3, name: 'Part 3', description: 'Điền chỗ trống trong truyện', taskType: 'story_completion' },
        { partNumber: 4, name: 'Part 4', description: 'Tự điền từ', taskType: 'open_cloze' },
        { partNumber: 5, name: 'Part 5', description: 'Trả lời theo truyện tranh', taskType: 'look_read_write' },
        { partNumber: 6, name: 'Part 6', description: 'Tự điền từ vào đoạn', taskType: 'open_cloze' },
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

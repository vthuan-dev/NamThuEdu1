import { describe, it, expect, vi } from 'vitest';
import {
  getBlueprintTaskType,
  getSkillParts,
  TASK_TYPE_LABELS,
  SKILL_TO_PART,
  type SkillKey,
} from '../../constants/cambridgeStructure';

vi.mock('@/services/kidsExamApi', () => ({ uploadKidsMedia: vi.fn() }));

/**
 * Bảng blueprint kỳ vọng — liệt kê CẠN 3 cấp độ × 3 kỹ năng.
 * Giá trị đọc trực tiếp từ `constants/cambridgeStructure.ts` (observation-first),
 * CHỈ 2 ô Movers Reading & Writing Part 4/Part 5 mang giá trị MỚI sau khi sửa.
 */
const EXPECTED_BLUEPRINT: Record<string, Record<SkillKey, string[]>> = {
  starters: {
    listening: ['listen_and_draw_lines', 'listen_and_write', 'listen_and_tick', 'listen_colour_write'],
    reading_writing: ['look_and_read', 'look_and_read', 'unscramble_words', 'word_bank_fill', 'look_read_write'],
    speaking: ['object_placement', 'picture_questions', 'picture_card_questions', 'picture_questions'],
  },
  movers: {
    listening: [
      'listen_and_draw_lines',
      'listen_and_write',
      'listening_letter_match',
      'listen_and_tick',
      'listen_colour_write',
    ],
    reading_writing: [
      'word_definition_matching',
      'look_and_read',
      'dialogue_matching',
      'word_bank_fill', // MỚI (trước: story_completion)
      'story_completion', // MỚI (trước: look_read_write)
      'look_read_write',
    ],
    speaking: ['find_differences', 'picture_story_narration', 'odd_one_out', 'picture_questions'],
  },
  flyers: {
    listening: [
      'listen_and_draw_lines',
      'listen_and_write',
      'listening_letter_match',
      'listen_and_tick',
      'listen_colour_write',
    ],
    reading_writing: [
      'word_definition_matching',
      'dialogue_matching',
      'word_bank_fill',
      'cloze_test',
      'story_completion',
      'open_cloze',
      'picture_story_writing',
    ],
    speaking: ['find_differences', 'information_exchange', 'picture_story_narration', 'picture_questions'],
  },
};

/** Các ô thuộc bug condition — được kiểm ở nhóm Fix Checking, không thuộc preservation. */
const isBugConditionCell = (examType: string, skill: SkillKey, partNumber: number) =>
  examType === 'movers' && skill === 'reading_writing' && (partNumber === 4 || partNumber === 5);

const SKILLS: SkillKey[] = ['listening', 'reading_writing', 'speaking'];

describe('Cambridge blueprint — Movers Reading & Writing', () => {
  it('Part 4 là điền từ từ hộp từ cho sẵn (có hình), không phải tự viết', () => {
    expect(getBlueprintTaskType('movers', 2, 4)).toBe('word_bank_fill');
  });

  it('Part 5 là đọc truyện dài & hoàn thành câu tóm tắt', () => {
    expect(getBlueprintTaskType('movers', 2, 5)).toBe('story_completion');
  });

  it('Movers R&W đủ 6 part', () => {
    expect(getSkillParts('movers', 'reading_writing')).toHaveLength(6);
  });

  it('mô tả Part 5 không còn là "truyện tranh" (nhãn copy từ Starters)', () => {
    const part5 = getSkillParts('movers', 'reading_writing').find((p) => p.partNumber === 5);
    expect(part5?.description).not.toMatch(/truyện tranh/i);
  });

  it('Part 5 và Part 6 không còn trùng dạng bài', () => {
    expect(getBlueprintTaskType('movers', 2, 5)).not.toBe(getBlueprintTaskType('movers', 2, 6));
  });

  it('mọi taskType của 6 part đều có nhãn trong TASK_TYPE_LABELS', () => {
    getSkillParts('movers', 'reading_writing').forEach((p) => {
      expect(TASK_TYPE_LABELS).toHaveProperty(p.taskType);
    });
  });
});

describe('Cambridge blueprint — preservation (mọi đầu vào ngoài bug condition)', () => {
  Object.entries(EXPECTED_BLUEPRINT).forEach(([examType, bySkill]) => {
    SKILLS.forEach((skill) => {
      const expectedTaskTypes = bySkill[skill];

      it(`${examType} / ${skill} có đúng ${expectedTaskTypes.length} part`, () => {
        expect(getSkillParts(examType, skill)).toHaveLength(expectedTaskTypes.length);
      });

      expectedTaskTypes.forEach((expectedTaskType, index) => {
        const partNumber = index + 1;
        if (isBugConditionCell(examType, skill, partNumber)) return;

        it(`${examType} / ${skill} / Part ${partNumber} = ${expectedTaskType}`, () => {
          expect(getBlueprintTaskType(examType, SKILL_TO_PART[skill], partNumber)).toBe(expectedTaskType);
          expect(getSkillParts(examType, skill).find((p) => p.partNumber === partNumber)?.taskType).toBe(
            expectedTaskType,
          );
        });
      });
    });
  });

  it('Movers R&W Part 6 giữ mô tả "Nhìn tranh & viết đáp án 1 từ"', () => {
    const part6 = getSkillParts('movers', 'reading_writing').find((p) => p.partNumber === 6);
    expect(part6?.description).toBe('Nhìn tranh & viết đáp án 1 từ');
  });

  it('đầu vào không hợp lệ vẫn trả null / mảng rỗng', () => {
    expect(getBlueprintTaskType('unknown', 2, 4)).toBeNull();
    expect(getSkillParts('unknown', 'reading_writing')).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { renumberSections, renumberConfig, blankConfig, collectQuestionNumbers } from '../sections';
import type { ThptSection, ThptConfig } from '@/types/thpt';

const mc = (nums: number[]): ThptSection =>
  ({
    id: 's_mc',
    type: 'mc_questions',
    variant: 'grammar',
    title: 'Trắc nghiệm',
    instructions: '',
    items: nums.map((n) => ({ question_number: n, prompt: '', options: [], correct_id: 'A' })),
  }) as any;

const openCloze = (nums: number[]): ThptSection =>
  ({
    id: 's_open',
    type: 'open_cloze',
    title: 'Điền từ',
    instructions: '',
    passage: '',
    blanks: nums.map((n) => ({ question_number: n, accepted_answers: ['x'] })),
  }) as any;

const tfGroup = (qn: number, statementCount: number): ThptSection =>
  ({
    id: 's_tf',
    type: 'tf_group',
    title: 'Đúng/Sai',
    instructions: '',
    items: [
      {
        question_number: qn,
        context: '',
        statements: Array.from({ length: statementCount }, (_, i) => ({
          id: `${qn}-${i + 1}`,
          text: '',
          correct: false,
        })),
      },
    ],
  }) as any;

const matching = (qn: number, rows: number): ThptSection =>
  ({
    id: 's_match',
    type: 'matching',
    title: 'Nối câu',
    instructions: '',
    items: [
      {
        question_number: qn,
        list_1: Array.from({ length: rows }, () => ''),
        list_2: ['', '', '', '', '', ''],
        answers: Object.fromEntries(Array.from({ length: rows }, (_, i) => [String(i + 1), 'A'])),
      },
    ],
  }) as any;

describe('renumberSections — số thứ tự câu luôn liên tục từ 1', () => {
  it('đánh số lại liên tục qua nhiều phần', () => {
    const out = renumberSections([mc([5, 9]), openCloze([20, 21])]);
    expect(collectQuestionNumbers(out[0])).toEqual([1, 2]);
    expect(collectQuestionNumbers(out[1])).toEqual([3, 4]);
  });

  it('sau khi XOÁ câu, các câu còn lại được dồn số (bug "xoá câu số không cập nhật")', () => {
    // Ban đầu 1,2,3 → xoá câu giữa còn [1,3]
    const afterDelete = renumberSections([mc([1, 3]), mc([4])]);
    expect(collectQuestionNumbers(afterDelete[0])).toEqual([1, 2]);
    // Phần SAU cũng phải cập nhật lại
    expect(collectQuestionNumbers(afterDelete[1])).toEqual([3]);
  });

  it('THÊM chỗ trống ở phần điền từ → phần tiếp theo dịch số đúng', () => {
    const before = renumberSections([openCloze([1, 2]), mc([3])]);
    expect(collectQuestionNumbers(before[1])).toEqual([3]);

    // giáo viên tự sinh thêm 2 chỗ trống
    const after = renumberSections([openCloze([1, 2, 0, 0]), mc([3])]);
    expect(collectQuestionNumbers(after[0])).toEqual([1, 2, 3, 4]);
    expect(collectQuestionNumbers(after[1])).toEqual([5]);
  });

  it('tf_group chiếm số câu theo số statements (không còn khuyết dải số)', () => {
    const out = renumberSections([tfGroup(1, 4), mc([99])]);
    expect(collectQuestionNumbers(out[0])).toEqual([1]);
    // 4 statements = câu 1..4 → phần sau bắt đầu từ 5
    expect(collectQuestionNumbers(out[1])).toEqual([5]);
  });

  it('matching chiếm số câu theo số dòng cần nối', () => {
    const out = renumberSections([matching(1, 3), mc([50])]);
    expect(collectQuestionNumbers(out[1])).toEqual([4]);
  });

  it('giữ nguyên tham chiếu khi đã đúng số (không tạo dirty giả)', () => {
    const sections = renumberSections([mc([1, 2])]);
    expect(renumberSections(sections)).toBe(sections);
  });

  it('renumberConfig giữ nguyên object khi không có gì đổi', () => {
    const cfg: ThptConfig = { ...blankConfig(), sections: renumberSections([mc([1])]) };
    expect(renumberConfig(cfg)).toBe(cfg);
  });
});

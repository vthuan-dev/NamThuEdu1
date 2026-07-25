import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WordDefinitionMatchingEditor from '../WordDefinitionMatchingEditor';
import DialogueMatchingEditor from '../DialogueMatchingEditor';
import { getBlueprintTaskType, getSkillParts } from '../../constants/cambridgeStructure';

vi.mock('@/services/kidsExamApi', () => ({ uploadKidsMedia: vi.fn() }));

const noop = () => {};

describe('Cambridge blueprint — Flyers Reading & Writing', () => {
  it('đủ 7 part', () => {
    expect(getSkillParts('flyers', 'reading_writing')).toHaveLength(7);
  });

  it('Part 3 là điền từ từ hộp từ cho sẵn (không phải tự viết)', () => {
    expect(getBlueprintTaskType('flyers', 2, 3)).toBe('word_bank_fill');
  });

  it('Part 4 là chọn đáp án A/B/C (không phải tự điền từ)', () => {
    const taskType = getBlueprintTaskType('flyers', 2, 4);
    expect(taskType).toBe('cloze_test');
    expect(taskType).not.toBe('open_cloze');
  });

  it('Part 5 là đọc truyện & hoàn thành câu, mô tả không còn là "truyện tranh"', () => {
    const part5 = getSkillParts('flyers', 'reading_writing').find((p) => p.partNumber === 5);
    expect(part5?.taskType).toBe('story_completion');
    expect(part5?.description).not.toMatch(/truyện tranh/i);
  });

  it('Part 6 vẫn là tự điền 1 từ, Part 7 là viết truyện theo tranh', () => {
    expect(getBlueprintTaskType('flyers', 2, 6)).toBe('open_cloze');
    expect(getBlueprintTaskType('flyers', 2, 7)).toBe('picture_story_writing');
  });

  it('Part 4 và Part 6 không còn trùng dạng bài', () => {
    expect(getBlueprintTaskType('flyers', 2, 4)).not.toBe(getBlueprintTaskType('flyers', 2, 6));
  });
});

describe('Flyers Part 1 — hộp từ nhiều hơn số câu (từ nhiễu)', () => {
  it('lưu được distractor_words và không bắt buộc định nghĩa cho từ nhiễu', () => {
    const onSave = vi.fn();
    render(
      <WordDefinitionMatchingEditor
        onSave={onSave}
        onCancel={noop}
        examId="12"
        questionId={null}
        initialData={{
          title: 'Ghép định nghĩa',
          config: {
            words: [
              { word: 'elephant', definition: 'A big animal with a long nose.' },
              { word: 'rain', definition: 'Water that falls from the clouds.' },
              { word: 'doctor', definition: 'This person helps you when you are ill.' },
              { word: 'kitchen', definition: 'The room where you cook.' },
              { word: 'library', definition: 'A place full of books.' },
            ],
            distractor_words: ['bicycle', 'sunny'],
          },
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Lưu/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0][0];
    expect(payload.config.words).toHaveLength(5);
    expect(payload.config.distractor_words).toEqual(['bicycle', 'sunny']);
    // Số câu tính điểm vẫn bằng số định nghĩa, không tính từ nhiễu.
    expect(payload.points).toBe(5);
  });
});

describe('Flyers Part 2 — 8 lựa chọn A-H dùng chung', () => {
  it('cho phép tới 8 lựa chọn và áp dụng chung cho mọi hội thoại', () => {
    const onSave = vi.fn();
    const options = 'ABCDEFGH'.split('').map((id) => ({ id, text: `Answer ${id}` }));
    render(
      <DialogueMatchingEditor
        onSave={onSave}
        onCancel={noop}
        examId="12"
        questionId={null}
        initialData={{
          title: 'Hoàn thành hội thoại',
          config: {
            shared_options: true,
            dialogues: [
              { question: "What's your name?", options, correct_answer: 'B' },
              { question: 'Where do you live?', options, correct_answer: 'G' },
            ],
          },
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Lưu/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0][0];
    expect(payload.config.dialogues).toHaveLength(2);
    payload.config.dialogues.forEach((d: any) => {
      expect(d.options).toHaveLength(8);
      expect(d.options.map((o: any) => o.id)).toEqual('ABCDEFGH'.split(''));
    });
    expect(payload.config.dialogues[1].correct_answer).toBe('G');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PictureQuestionsEditor from '../PictureQuestionsEditor';
import PictureCardQuestionsEditor from '../PictureCardQuestionsEditor';
import ObjectPlacementEditor from '../ObjectPlacementEditor';
import FindDifferencesEditor from '../FindDifferencesEditor';
import OddOneOutEditor from '../OddOneOutEditor';
import PictureStoryNarrationEditor from '../PictureStoryNarrationEditor';
import { getBlueprintTaskType, getSkillParts } from '../../constants/cambridgeStructure';

vi.mock('@/services/kidsExamApi', () => ({ uploadKidsMedia: vi.fn() }));

/** Đếm số ô tải tệp (mỗi ImageUpload render 1 input[type=file]). */
function fileInputCount() {
  return document.querySelectorAll('input[type="file"]').length;
}

describe('Editor phần Nói — luôn có ô tải ảnh khi tạo mới (bug "không nhập được ảnh")', () => {
  const noop = () => {};

  it('PictureQuestionsEditor có sẵn 1 mục kèm ô tải ảnh', () => {
    render(<PictureQuestionsEditor onSave={noop} onCancel={noop} examId="12" />);
    expect(fileInputCount()).toBeGreaterThan(0);
  });

  it('PictureCardQuestionsEditor có sẵn 1 thẻ kèm ô tải ảnh', () => {
    render(<PictureCardQuestionsEditor onSave={noop} onCancel={noop} examId="12" />);
    expect(fileInputCount()).toBeGreaterThan(0);
  });

  it('ObjectPlacementEditor có sẵn 1 thẻ kèm ô tải ảnh', () => {
    render(<ObjectPlacementEditor onSave={noop} onCancel={noop} examId="12" questionId={null} />);
    // 1 ảnh nền + 1 ảnh thẻ
    expect(fileInputCount()).toBeGreaterThanOrEqual(2);
  });
});

describe('Editor phần Nói — payload có `config` để Step2 lưu được', () => {
  it('FindDifferences trả về config (trước đây chỉ có question_data nên bị chặn)', () => {
    const onSave = vi.fn();
    render(
      <FindDifferencesEditor
        onSave={onSave}
        onCancel={() => {}}
        examId="12"
        questionId={null}
        initialData={{
          title: 'Tìm điểm khác biệt',
          config: {
            image_a_url: 'https://cdn/a.png',
            image_b_url: 'https://cdn/b.png',
            differences: ['con mèo'],
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Lưu/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0][0];
    expect(payload.config).toBeTruthy();
    expect(payload.config.image_a_url).toBe('https://cdn/a.png');
    expect(payload.config.differences).toEqual(['con mèo']);
  });

  it('OddOneOut trả về config', () => {
    const onSave = vi.fn();
    render(
      <OddOneOutEditor
        onSave={onSave}
        onCancel={() => {}}
        examId="12"
        questionId={null}
        initialData={{
          title: 'Tìm hình khác loại',
          config: {
            images: [
              { id: 1, url: 'https://cdn/1.png', category: 'a' },
              { id: 2, url: 'https://cdn/2.png', category: 'a' },
              { id: 3, url: 'https://cdn/3.png', category: 'a' },
              { id: 4, url: 'https://cdn/4.png', category: 'b' },
            ],
            correct_odd_one: 4,
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Lưu/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].config?.images).toHaveLength(4);
  });

  it('PictureStoryNarration trả về config', () => {
    const onSave = vi.fn();
    render(
      <PictureStoryNarrationEditor
        onSave={onSave}
        onCancel={() => {}}
        examId="12"
        questionId={null}
        initialData={{
          title: 'Kể chuyện',
          config: { images: ['https://cdn/1.png', 'https://cdn/2.png', 'https://cdn/3.png'] },
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Lưu/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].config?.images).toHaveLength(3);
  });
});

describe('Cambridge blueprint — Movers Reading & Writing Part 6', () => {
  it('Part 6 không còn là word_bank_fill (đó là dạng của Part 4)', () => {
    const taskType = getBlueprintTaskType('movers', 2, 6);
    expect(taskType).not.toBe('word_bank_fill');
    expect(taskType).toBe('look_read_write');
  });

  it('Movers R&W vẫn đủ 6 part và Part 4 là điền từ từ hộp từ cho sẵn', () => {
    const parts = getSkillParts('movers', 'reading_writing');
    expect(parts).toHaveLength(6);
    expect(parts.find((p) => p.partNumber === 4)?.taskType).toBe('word_bank_fill');
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThptPartNavigator } from '../ThptPartNavigator';
import type { ThptConfig } from '../../types';

/**
 * Panel Tiến độ nằm NGOÀI SectionErrorBoundary → nếu nó crash thì sập cả trang
 * làm bài (mất nút Nộp bài). Test đảm bảo nó chịu được config lỗi:
 * section thiếu `items`/`blanks`/`statements`.
 */
describe('ThptPartNavigator — chịu được config đề thiếu dữ liệu', () => {
  const brokenConfig = {
    version: '2.0',
    total_duration_minutes: 60,
    scale_max: 10,
    sections: [
      // thiếu items hoàn toàn
      { id: 's1', type: 'mc_questions', title: 'Trắc nghiệm', instructions: '' },
      // thiếu blanks
      { id: 's2', type: 'open_cloze', title: 'Điền từ', instructions: '', passage: 'x' },
      // reading_mixed: item tf_group thiếu statements
      {
        id: 's3', type: 'reading_mixed', title: 'Đọc hiểu', instructions: '', passage: '',
        items: [{ kind: 'tf_group', question_number: 102 }],
      },
    ],
  } as unknown as ThptConfig;

  it('render được, không ném lỗi', () => {
    expect(() =>
      render(
        <ThptPartNavigator
          config={brokenConfig}
          answers={{}}
          activeIdx={0}
          onSectionChange={() => {}}
        />,
      ),
    ).not.toThrow();

    expect(screen.getByText('Đọc hiểu')).toBeInTheDocument();
    // Câu 102 vẫn hiện trong lưới tiến độ
    expect(screen.getByTitle('Câu 102')).toBeInTheDocument();
  });

  it('không crash khi sections không phải array', () => {
    const noSections = { version: '2.0', total_duration_minutes: 60, scale_max: 10 } as unknown as ThptConfig;
    expect(() =>
      render(
        <ThptPartNavigator config={noSections} answers={{}} activeIdx={0} onSectionChange={() => {}} />,
      ),
    ).not.toThrow();
  });
});

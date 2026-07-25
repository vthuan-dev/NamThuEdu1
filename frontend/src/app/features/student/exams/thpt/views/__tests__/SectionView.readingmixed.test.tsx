import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionView } from '../SectionView';
import { SectionErrorBoundary } from '../../../../../../../components/exam/SectionErrorBoundary';
import type { ThptSection } from '../../types';

/**
 * Regression tests cho lỗi "vào phần đọc hiểu / bấm tiếp theo / nộp bài báo lỗi".
 *
 * Nguyên nhân: một `reading_mixed` item thiếu field (mc thiếu `options`/`prompt`,
 * tf_group thiếu `statements`) khiến `.map`/`.split` trên `undefined` ném lỗi
 * → sập cả trang làm bài (mất luôn nút Nộp bài).
 *
 * Lỗi cụ thể trước khi fix:
 *   TypeError: Cannot read properties of undefined (reading 'map')
 *   TypeError: Cannot read properties of undefined (reading 'split')
 */
describe('SectionView — reading_mixed với dữ liệu thiếu field (regression)', () => {
  // reading_mixed có passage rỗng → render Body trực tiếp (không split), item cố tình thiếu field.
  const malformedSection = {
    id: 'rm_bad',
    type: 'reading_mixed',
    title: 'Đọc hiểu',
    instructions: '',
    passage: '',
    items: [
      // mc thiếu prompt + options (dữ liệu lỗi từ đề)
      { kind: 'mc', question_number: 102 },
      // tf_group thiếu statements
      { kind: 'tf_group', question_number: 103 },
    ],
  } as unknown as ThptSection;

  it('render được, KHÔNG ném lỗi khi item thiếu options/prompt/statements', () => {
    expect(() =>
      render(
        <SectionView
          section={malformedSection}
          answers={{}}
          onAnswerChange={() => {}}
          mode="taking"
          submissionId={1}
        />,
      ),
    ).not.toThrow();

    // Vẫn hiển thị được số câu 102 & 103 (đã render qua guard, không crash)
    expect(screen.getByText('102')).toBeInTheDocument();
    expect(screen.getByText('103')).toBeInTheDocument();
  });
});

describe('SectionErrorBoundary — chặn crash một phần, giữ nút Nộp bài sống', () => {
  function Boom(): React.ReactElement {
    throw new Error('Cannot read properties of undefined (reading \'map\')');
  }

  it('hiện fallback khi con ném lỗi, các phần khác (nút Nộp bài) vẫn còn', () => {
    // React log error ra console khi boundary bắt — nuốt để log test sạch.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <div>
        <SectionErrorBoundary resetKey="s1" label='phần "Đọc hiểu"'>
          <Boom />
        </SectionErrorBoundary>
        <button type="button">Nộp bài</button>
      </div>,
    );

    // Fallback hiển thị
    expect(screen.getByText(/Không hiển thị được/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();
    // Nút Nộp bài (sibling) vẫn tồn tại → học viên vẫn nộp được
    expect(screen.getByRole('button', { name: /Nộp bài/i })).toBeInTheDocument();

    spy.mockRestore();
  });
});

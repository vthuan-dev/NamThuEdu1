import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionView } from '../SectionView';
import type { ThptSection } from '../../types';

/**
 * Regression: học viên chọn được phương án giáo viên không hề nhập.
 *
 * Mọi factory tạo đề (sections.ts, SectionEditor) khởi tạo ĐỦ 4 phương án A–D
 * với text rỗng, bất kể câu hỏi thực tế có mấy phương án. Renderer map thẳng
 * danh sách đó nên câu chỉ có 3 đáp án vẫn hiện nút "D" trống và bấm được —
 * chọn là chắc chắn sai.
 *
 * Ngoại lệ phải giữ: đề dạng ảnh cố ý để text rỗng (câu hỏi in trên ảnh, bảng
 * bên phải chỉ hiện nhãn A/B/C/D). Lọc sạch thì mất luôn nút chọn.
 */

function renderSection(section: unknown) {
  return render(
    <SectionView
      section={section as ThptSection}
      answers={{}}
      onAnswerChange={() => {}}
      mode="taking"
      submissionId={1}
    />,
  );
}

describe('SectionView — chỉ render phương án giáo viên đã nhập', () => {
  it('listening: câu 3 phương án không hiện nút D trống', () => {
    renderSection({
      id: 'ls1',
      type: 'listening',
      title: 'Nghe hiểu',
      audio_url: 'a.mp3',
      items: [
        {
          question_number: 6,
          kind: 'mc',
          prompt: 'What did the boy buy?',
          options: [
            { id: 'A', text: 'something to wear' },
            { id: 'B', text: 'something to eat' },
            { id: 'C', text: 'something to read' },
            { id: 'D', text: '' },
          ],
          correct_id: 'B',
        },
      ],
    });

    expect(screen.getByText('something to wear')).toBeInTheDocument();
    expect(screen.getByText('something to read')).toBeInTheDocument();
    // Nút D không được tồn tại — đây chính là lỗi đã báo.
    expect(screen.queryByText('D')).not.toBeInTheDocument();
  });

  it('mc_questions: bỏ phương án rỗng ở giữa mà không xê dịch nhãn còn lại', () => {
    renderSection({
      id: 'mc1',
      type: 'mc_questions',
      title: 'Trắc nghiệm',
      items: [
        {
          question_number: 1,
          prompt: 'Choose the best answer.',
          options: [
            { id: 'A', text: 'alpha' },
            { id: 'B', text: '' },
            { id: 'C', text: 'gamma' },
            { id: 'D', text: '' },
          ],
          correct_id: 'C',
        },
      ],
    });

    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('gamma')).toBeInTheDocument();
    // C phải giữ nhãn C, không được tụt xuống thành B.
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.queryByText('B')).not.toBeInTheDocument();
    expect(screen.queryByText('D')).not.toBeInTheDocument();
  });

  it('đề dạng ảnh: TẤT CẢ phương án rỗng thì vẫn giữ đủ nhãn A–D', () => {
    renderSection({
      id: 'ls2',
      type: 'listening',
      title: 'Nghe hiểu',
      audio_url: 'a.mp3',
      items: [
        {
          question_number: 1,
          kind: 'mc',
          prompt: '',
          options: [
            { id: 'A', text: '' },
            { id: 'B', text: '' },
            { id: 'C', text: '' },
            { id: 'D', text: '' },
          ],
          correct_id: 'A',
        },
      ],
    });

    // Nội dung nằm trên ảnh đề → text rỗng là bình thường, phải giữ nút để chọn.
    for (const L of ['A', 'B', 'C', 'D']) {
      expect(screen.getByText(L)).toBeInTheDocument();
    }
  });

  it('phonetics: chỉ hiện các từ đã nhập', () => {
    renderSection({
      id: 'ph1',
      type: 'phonetics',
      title: 'Ngữ âm',
      items: [
        {
          question_number: 1,
          // Dùng bộ so sánh NGUYÊN ÂM, không phải bộ cùng đuôi -ed: bộ cùng đuôi
          // kích hoạt tính năng tự dò đuôi và tách chữ thành nhiều thẻ (before /
          // mark / after) nên getByText không khớp được cả từ.
          words: [
            { id: 'A', text: 'head', underline: '' },
            { id: 'B', text: 'bread', underline: '' },
            { id: 'C', text: 'tea', underline: '' },
            { id: 'D', text: '', underline: '' },
          ],
          correct_id: 'C',
        },
      ],
    });

    expect(screen.getByText('head')).toBeInTheDocument();
    expect(screen.getByText('tea')).toBeInTheDocument();
    expect(screen.queryByText('D')).not.toBeInTheDocument();
  });

  it('matching: dropdown chỉ liệt kê nhãn có thật ở cột phải', () => {
    renderSection({
      id: 'mt1',
      type: 'matching',
      title: 'Nối câu',
      items: [
        {
          question_number: 1,
          list_1: ['Câu một', 'Câu hai', '', ''],
          // Chỉ 3 phương án — trước đây dropdown vẫn liệt kê tới F.
          list_2: ['Đáp A', 'Đáp B', 'Đáp C', '', '', ''],
          answers: { '1': 'A', '2': 'B' },
        },
      ],
    });

    const selects = screen.getAllByRole('combobox');
    // list_1 chỉ có 2 dòng đã nhập → 2 dropdown, không phải 4.
    expect(selects).toHaveLength(2);

    const values = Array.from(selects[0].querySelectorAll('option')).map((o) =>
      (o as HTMLOptionElement).value,
    );
    // Rỗng ('—') + A, B, C. Không được có D/E/F vì cột phải không có.
    expect(values).toEqual(['', 'A', 'B', 'C']);
  });

  it('tf_group: bỏ mệnh đề trống nhưng giữ số thứ tự gốc của mệnh đề còn lại', () => {
    const onChange = vi.fn();
    render(
      <SectionView
        section={{
          id: 'tf1',
          type: 'tf_group',
          title: 'Đúng / Sai',
          items: [
            {
              question_number: 5,
              context: 'Some notice text',
              context_style: 'notice',
              statements: [
                { id: 's1', text: 'Mệnh đề một', correct: true },
                { id: 's2', text: '', correct: false },
                { id: 's3', text: 'Mệnh đề ba', correct: false },
                { id: 's4', text: '', correct: false },
              ],
            },
          ],
        } as unknown as ThptSection}
        answers={{}}
        onAnswerChange={onChange}
        mode="taking"
        submissionId={1}
      />,
    );

    expect(screen.getByText('Mệnh đề một')).toBeInTheDocument();
    expect(screen.getByText('Mệnh đề ba')).toBeInTheDocument();
    // Chỉ 2 mệnh đề được render (mỗi mệnh đề 2 nút Đúng/Sai).
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });
});

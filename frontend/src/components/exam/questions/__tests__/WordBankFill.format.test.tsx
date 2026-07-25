import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WordBankFill } from '../WordBankFill';

/**
 * Regression Part 4 (Starters R&W): "bị lỗi khi highlight và màu".
 * Giáo viên bấm In đậm (**text**) / Tô màu (<mark ...>) trong editor; trước fix
 * phía học viên render bằng dangerouslySetInnerHTML nên **text** hiện ra thô
 * (và HTML thô tiềm ẩn XSS).
 */
describe('WordBankFill — render định dạng in đậm / tô màu cho học viên', () => {
  // extractTaskData đọc dữ liệu bài Kids từ `kids_task_config`.
  const makeQuestion = (text: string) =>
    ({
      qId: 1,
      qType: 'word_bank_fill',
      qContent: 'kids_task',
      kids_task_config: {
        task_type: 'word_bank_fill',
        config: { text, word_bank: [{ word: 'dog' }], items: [] },
        text,
      },
    }) as any;

  it('in đậm **text** thành <strong>, không hiện dấu **', () => {
    render(
      <WordBankFill question={makeQuestion('I have a **cat** here.')} mode="student" answer={{}} onAnswer={() => {}} />,
    );

    const strong = screen.getByText('cat');
    expect(strong.tagName.toLowerCase()).toBe('strong');
    // Không còn dấu ** lộ ra cho học viên
    expect(document.body.textContent).not.toContain('**');
  });

  it('tô màu <mark> render thành thẻ mark với đúng màu nền', () => {
    render(
      <WordBankFill
        question={makeQuestion('Look at the <mark style="background-color: #fef08a">sun</mark>.')}
        mode="student"
        answer={{}}
        onAnswer={() => {}}
      />,
    );

    const mark = screen.getByText('sun');
    expect(mark.tagName.toLowerCase()).toBe('mark');
    expect(document.body.textContent).not.toContain('<mark');
  });

  it('không thực thi HTML thô độc hại từ nội dung đề', () => {
    render(
      <WordBankFill
        question={makeQuestion('<img src=x onerror="alert(1)"> hello')}
        mode="student"
        answer={{}}
        onAnswer={() => {}}
      />,
    );

    // Chuỗi được hiển thị như text, không tạo ra thẻ img thật
    expect(document.querySelector('img[onerror]')).toBeNull();
  });
});

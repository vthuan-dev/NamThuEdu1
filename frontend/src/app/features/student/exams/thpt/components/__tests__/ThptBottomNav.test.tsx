/**
 * ThptBottomNav — nút Nộp bài phải với tới được ở MỌI phần.
 *
 * Bối cảnh: trước đây nút Nộp bài nằm trong nhánh `else` của `isLast`, nên ở mọi
 * phần không phải phần cuối nó không tồn tại trên DOM. Học viên làm xong nhưng
 * đang đứng ở phần giữa thì không có cách nào nộp. Đó là báo lỗi "thiếu nút nộp
 * bài". Bộ test này khoá lại hành vi để không tái diễn.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThptBottomNav } from '../ThptBottomNav';

const baseProps = {
  activePart: 0,
  totalParts: 5,
  canPrev: false,
  canNext: true,
  onPrev: () => {},
  onNext: () => {},
  onSubmit: () => {},
};

describe('ThptBottomNav — nút Nộp bài', () => {
  /** Đây là hồi quy chính. */
  it('hiện ở phần ĐẦU, không chỉ ở phần cuối', () => {
    render(<ThptBottomNav {...baseProps} activePart={0} totalParts={5} />);

    expect(screen.getByRole('button', { name: /Nộp bài/ })).toBeInTheDocument();
  });

  it('hiện ở phần GIỮA', () => {
    render(<ThptBottomNav {...baseProps} activePart={2} totalParts={5} />);

    expect(screen.getByRole('button', { name: /Nộp bài/ })).toBeInTheDocument();
  });

  it('hiện ở phần CUỐI', () => {
    render(<ThptBottomNav {...baseProps} activePart={4} totalParts={5} canNext={false} />);

    expect(screen.getByRole('button', { name: /Nộp bài/ })).toBeInTheDocument();
  });

  /** Đề chỉ có một phần: vừa là phần đầu vừa là phần cuối. */
  it('hiện khi đề chỉ có một phần', () => {
    render(<ThptBottomNav {...baseProps} activePart={0} totalParts={1} canNext={false} />);

    expect(screen.getByRole('button', { name: /Nộp bài/ })).toBeInTheDocument();
  });

  it('gọi onSubmit khi bấm', async () => {
    const onSubmit = vi.fn();
    render(<ThptBottomNav {...baseProps} activePart={1} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: /Nộp bài/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  /** Chặn nộp hai lần khi request đầu chưa xong. */
  it('bị khoá khi đang nộp', () => {
    render(<ThptBottomNav {...baseProps} isSubmitting />);

    expect(screen.getByRole('button', { name: /Nộp bài/ })).toBeDisabled();
  });
});

describe('ThptBottomNav — điều hướng phần', () => {
  it('ẩn nút Phần tiếp ở phần cuối', () => {
    render(<ThptBottomNav {...baseProps} activePart={4} totalParts={5} canNext={false} />);

    expect(screen.queryByRole('button', { name: 'Phần tiếp' })).not.toBeInTheDocument();
  });

  it('hiện nút Phần tiếp khi chưa tới phần cuối', () => {
    render(<ThptBottomNav {...baseProps} activePart={1} totalParts={5} />);

    expect(screen.getByRole('button', { name: 'Phần tiếp' })).toBeInTheDocument();
  });

  it('khoá nút Phần trước ở phần đầu', () => {
    render(<ThptBottomNav {...baseProps} activePart={0} canPrev={false} />);

    expect(screen.getByRole('button', { name: 'Phần trước' })).toBeDisabled();
  });

  it('gọi onPrev và onNext', async () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(
      <ThptBottomNav {...baseProps} activePart={2} canPrev onPrev={onPrev} onNext={onNext} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Phần trước' }));
    await userEvent.click(screen.getByRole('button', { name: 'Phần tiếp' }));

    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

describe('ThptBottomNav — ô giữa mở bảng Tiến độ', () => {
  /**
   * Trên mobile cột Tiến độ bị ẩn, nên ô giữa là đường duy nhất để mở nó.
   */
  it('gọi onOpenProgress khi bấm ô giữa', async () => {
    const onOpenProgress = vi.fn();
    render(
      <ThptBottomNav
        {...baseProps}
        onOpenProgress={onOpenProgress}
        answeredCount={12}
        totalQuestions={40}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /12\/40 câu/ }));

    expect(onOpenProgress).toHaveBeenCalledTimes(1);
  });

  it('hiện số câu đã trả lời', () => {
    render(
      <ThptBottomNav
        {...baseProps}
        activePart={1}
        onOpenProgress={() => {}}
        answeredCount={12}
        totalQuestions={40}
      />,
    );

    expect(screen.getByText(/Phần 2\/5 · 12\/40 câu/)).toBeInTheDocument();
  });

  /**
   * Không truyền onOpenProgress (desktop, đã có sidebar) thì ô giữa chỉ là nhãn,
   * không được là nút — tránh thêm một điểm dừng tab vô nghĩa cho bàn phím.
   */
  it('ô giữa không phải nút khi không có onOpenProgress', () => {
    render(<ThptBottomNav {...baseProps} activePart={1} />);

    expect(screen.getByText('Phần 2 / 5')).toBeInTheDocument();
    // Chỉ còn Phần trước, Phần tiếp, Nộp bài.
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  /** answeredCount = 0 là giá trị thật, không được coi là "chưa có dữ liệu". */
  it('hiện 0/40 chứ không ẩn khi chưa trả lời câu nào', () => {
    render(
      <ThptBottomNav
        {...baseProps}
        onOpenProgress={() => {}}
        answeredCount={0}
        totalQuestions={40}
      />,
    );

    expect(screen.getByText(/0\/40 câu/)).toBeInTheDocument();
  });
});

/**
 * IeltsBottomNav — lưới câu phải tiếp cận được trên mobile.
 *
 * Bối cảnh: lưới 40 ô số câu nằm trong một dải cuộn ngang, mỗi ô 24px — dưới
 * ngưỡng touch target 44px và phải cuộn tìm. Khi ẩn dải đó dưới `md` thì học
 * viên mobile mất hẳn đường nhảy câu, nên phải có bottom sheet thay thế.
 * Bộ test này khoá lại: nút mở sheet tồn tại, sheet render đủ số câu với ô đủ
 * lớn, và nút Nộp bài không bao giờ biến mất.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IeltsBottomNav, type QuestionMeta } from '../IeltsBottomNav';

/** 8 câu chia hai nhóm — đủ để kiểm việc gom nhóm mà không làm test chậm. */
function makeQuestions(count = 8): QuestionMeta[] {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    qId: 100 + i,
    groupIndex: i < count / 2 ? 0 : 1,
    groupLabel: i < count / 2 ? 'Recording 1' : 'Recording 2',
  }));
}

const baseProps = {
  questions: makeQuestions(),
  answers: {} as Record<number, any>,
  flagged: {} as Record<number, boolean>,
  onJump: () => {},
};

/**
 * Lưới câu desktop và lưới trong sheet cùng render `title="Câu N…"`. Cả hai
 * đều nằm trên DOM (chỉ ẩn/hiện bằng breakpoint Tailwind, mà jsdom không áp
 * dụng CSS), nên mọi truy vấn theo số câu phải khoanh vùng trong sheet.
 */
function sheet() {
  return within(screen.getByRole('dialog'));
}

describe('IeltsBottomNav — nút Nộp bài', () => {
  it('hiện mặc định', () => {
    render(<IeltsBottomNav {...baseProps} />);

    expect(screen.getByRole('button', { name: /Nộp bài/ })).toBeInTheDocument();
  });

  it('gọi onSubmit khi bấm', async () => {
    const onSubmit = vi.fn();
    render(<IeltsBottomNav {...baseProps} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: /Nộp bài/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  /** `canSubmit=false` là cổng "chưa khoanh hết" — disable, không phải ẩn.
      Ẩn nút thì học viên không biết vì sao không nộp được. */
  it('vẫn hiện nhưng bị disable khi canSubmit=false', () => {
    render(<IeltsBottomNav {...baseProps} canSubmit={false} />);

    expect(screen.getByRole('button', { name: /Nộp bài/ })).toBeDisabled();
  });

  it('ẩn khi hideSubmit=true (chế độ xem lại)', () => {
    render(<IeltsBottomNav {...baseProps} hideSubmit />);

    expect(screen.queryByRole('button', { name: /Nộp bài/ })).not.toBeInTheDocument();
  });
});

describe('IeltsBottomNav — bottom sheet lưới câu (mobile)', () => {
  /** Hồi quy chính: lưới desktop bị ẩn dưới `md`, nên phải có đường khác. */
  it('có nút mở sheet hiển thị tiến độ', () => {
    render(<IeltsBottomNav {...baseProps} answers={{ 100: 'A', 101: 'B' }} />);

    expect(screen.getByRole('button', { name: /2\/8/ })).toBeInTheDocument();
  });

  it('sheet đóng lúc đầu', () => {
    render(<IeltsBottomNav {...baseProps} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('mở sheet thì render đủ mọi câu', async () => {
    render(<IeltsBottomNav {...baseProps} />);

    await userEvent.click(screen.getByRole('button', { name: /0\/8/ }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Mỗi câu một nút, kèm title mô tả — dùng title để không lẫn với số khác.
    for (let n = 1; n <= 8; n++) {
      expect(sheet().getByTitle(new RegExp(`^Câu ${n}(\\D|$)`))).toBeInTheDocument();
    }
  });

  it('sheet gom câu theo nhóm', async () => {
    render(<IeltsBottomNav {...baseProps} />);

    await userEvent.click(screen.getByRole('button', { name: /0\/8/ }));

    expect(screen.getByText('Recording 1')).toBeInTheDocument();
    expect(screen.getByText('Recording 2')).toBeInTheDocument();
  });

  /** Ô số phải đủ lớn để bấm — đây là lý do tồn tại của sheet. */
  it('ô số câu trong sheet dùng min-h-11 (44px)', async () => {
    render(<IeltsBottomNav {...baseProps} />);

    await userEvent.click(screen.getByRole('button', { name: /0\/8/ }));

    expect(sheet().getByTitle(/^Câu 1(\D|$)/).className).toContain('min-h-11');
  });

  it('bấm số câu thì nhảy tới câu đó và đóng sheet', async () => {
    const onJump = vi.fn();
    render(<IeltsBottomNav {...baseProps} onJump={onJump} />);

    await userEvent.click(screen.getByRole('button', { name: /0\/8/ }));
    await userEvent.click(sheet().getByTitle(/^Câu 3(\D|$)/));

    expect(onJump).toHaveBeenCalledTimes(1);
    expect(onJump.mock.calls[0][0]).toMatchObject({ number: 3 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('đóng được bằng nút Đóng', async () => {
    render(<IeltsBottomNav {...baseProps} />);

    await userEvent.click(screen.getByRole('button', { name: /0\/8/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /** Câu đã trả lời và câu gắn cờ phải phân biệt được trong sheet. */
  it('phân biệt câu đã trả lời và câu gắn cờ', async () => {
    render(
      <IeltsBottomNav
        {...baseProps}
        answers={{ 100: 'A' }}
        flagged={{ 101: true }}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /1\/8/ }));

    expect(sheet().getByTitle(/^Câu 1 — đã trả lời/)).toBeInTheDocument();
    expect(sheet().getByTitle(/^Câu 2 — đã gắn cờ/)).toBeInTheDocument();
  });
});

describe('IeltsBottomNav — điều hướng trước/tiếp', () => {
  it('disable nút Trước ở câu đầu', () => {
    render(<IeltsBottomNav {...baseProps} canPrev={false} />);

    expect(screen.getByRole('button', { name: 'Câu trước' })).toBeDisabled();
  });

  it('disable nút Tiếp ở câu cuối', () => {
    render(<IeltsBottomNav {...baseProps} canNext={false} />);

    expect(screen.getByRole('button', { name: 'Câu tiếp' })).toBeDisabled();
  });
});

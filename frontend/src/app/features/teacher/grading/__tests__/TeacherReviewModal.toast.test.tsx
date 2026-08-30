/**
 * Toast xác nhận sau khi giáo viên bấm "Xác nhận & Lưu".
 *
 * Trước đây modal đóng lại im lặng: giáo viên không biết thao tác đã ăn chưa,
 * và khi duyệt liên tiếp nhiều bài thì không biết vừa duyệt bài nào. Toast phải
 * nêu ID bài nộp + tên học viên + điểm theo THANG HIỂN THỊ của đề.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const postMock = vi.fn();
const navigateMock = vi.fn();
const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};

vi.mock('../../../../../services/api', () => ({
  api: { post: (...args: unknown[]) => postMock(...args) },
}));

vi.mock('../../../../../contexts/ToastContext', () => ({
  useToastContext: () => toastMock,
}));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => navigateMock };
});

// i18n: trả về chính key để bấm nút theo tên key, không phụ thuộc file dịch.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import { TeacherReviewModal } from '../TeacherReviewModal';

/** Đề GENERAL: sScore lưu dạng phần trăm, hiển thị trên thang 10. */
function generalSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: '4821',
    studentName: 'Lê Nhu Mỹ',
    studentAvatar: 'MY',
    examTitle: 'Đọc hiểu: Teenagers and Smartphones',
    examType: 'GENERAL',
    submissionTime: new Date('2026-08-13T18:58:00Z'),
    status: 'graded',
    score: 37.5,
    maxScore: 100,
    scaleMax: null,
    attemptNumber: 1,
    ...overrides,
  } as any;
}

function renderModal(submission: any) {
  return render(
    <TeacherReviewModal
      submission={submission}
      open
      onClose={() => {}}
      onReviewed={() => {}}
    />,
  );
}

const clickConfirm = () =>
  fireEvent.click(screen.getByRole('button', { name: /confirmSave/i }));

describe('TeacherReviewModal — toast xác nhận đã duyệt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postMock.mockResolvedValue({ data: { status: 'success' } });
  });

  it('nêu ID bài nộp và tên học viên khi duyệt y nguyên điểm AI', async () => {
    renderModal(generalSubmission());
    clickConfirm();

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledTimes(1));
    const msg = toastMock.success.mock.calls[0][0] as string;
    expect(msg).toContain('#4821');
    expect(msg).toContain('Lê Nhu Mỹ');
  });

  it('điểm trong toast theo thang hiển thị của đề, không phải giá trị thô', async () => {
    renderModal(generalSubmission());
    clickConfirm();

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledTimes(1));
    const msg = toastMock.success.mock.calls[0][0] as string;
    // 37.5% ⇒ 3.75/10. Không được hiện 37.50 (giá trị thô đang lưu trong DB).
    expect(msg).toContain('3.75/10');
    expect(msg).not.toContain('37.50');
  });

  it('không hiện toast khi lưu thất bại', async () => {
    postMock.mockRejectedValue({ response: { data: { message: 'Bùm' } } });
    renderModal(generalSubmission());
    clickConfirm();

    await waitFor(() => expect(screen.getByText('Bùm')).toBeInTheDocument());
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('bài chưa có điểm thì toast nói rõ chưa có điểm thay vì NaN', async () => {
    renderModal(generalSubmission({ score: undefined }));
    clickConfirm();

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledTimes(1));
    const msg = toastMock.success.mock.calls[0][0] as string;
    expect(msg).toContain('#4821');
    expect(msg).not.toContain('NaN');
  });
});

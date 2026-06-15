import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SaveStatusIndicator } from './SaveStatusIndicator';
import { OfflineBanner } from './OfflineBanner';
import { ResumeExamModal } from './ResumeExamModal';
import { MultiTabWarning } from './MultiTabWarning';

describe('SaveStatusIndicator', () => {
  it('ẩn khi idle và chưa lưu', () => {
    const { container } = render(<SaveStatusIndicator status="idle" />);
    expect(container.firstChild).toBeNull();
  });

  it('hiển thị "Đang lưu" khi saving', () => {
    render(<SaveStatusIndicator status="saving" pendingCount={2} />);
    expect(screen.getByText(/Đang lưu 2 câu/)).toBeInTheDocument();
  });

  it('hiển thị "Đã lưu lúc" khi saved', () => {
    render(<SaveStatusIndicator status="saved" lastSavedAt={new Date()} />);
    expect(screen.getByText(/Đã lưu lúc/)).toBeInTheDocument();
  });

  it('hiển thị lỗi khi error', () => {
    render(<SaveStatusIndicator status="error" />);
    expect(screen.getByText(/Lưu lỗi/)).toBeInTheDocument();
  });
});

describe('OfflineBanner', () => {
  it('ẩn khi online', () => {
    const { container } = render(<OfflineBanner online={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('hiển thị cảnh báo khi offline', () => {
    render(<OfflineBanner online={false} pendingCount={3} />);
    expect(screen.getByText(/Mất kết nối/)).toBeInTheDocument();
    expect(screen.getByText(/3 câu chờ đồng bộ/)).toBeInTheDocument();
  });
});

describe('ResumeExamModal', () => {
  it('ẩn khi draft null', () => {
    const { container } = render(
      <ResumeExamModal draft={null} open={false} onResume={vi.fn()} onDiscard={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('hiển thị đúng draft info và gọi onResume', () => {
    const onResume = vi.fn();
    const onDiscard = vi.fn();
    const draft = {
      submissionId: 5,
      examId: 2,
      role: 'kids' as const,
      examType: 'KIDS',
      startedAtServer: new Date().toISOString(),
      durationMinutes: 30,
      answers: { '0': 'a', '1': 'b' } as Record<string, unknown>,
      serverSyncedAt: null,
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    render(<ResumeExamModal draft={draft} open={true} onResume={onResume} onDiscard={onDiscard} />);
    expect(screen.getByText(/Bài thi đang dở/)).toBeInTheDocument();
    expect(screen.getByText(/2 câu/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Tiếp tục bài thi'));
    expect(onResume).toHaveBeenCalledWith(draft);
  });

  it('gọi onDiscard khi bấm Bắt đầu lại', () => {
    const onDiscard = vi.fn();
    const draft = {
      submissionId: 5,
      examId: 2,
      role: 'kids' as const,
      examType: 'KIDS',
      startedAtServer: new Date().toISOString(),
      durationMinutes: 30,
      answers: {} as Record<string, unknown>,
      serverSyncedAt: null,
      updatedAt: new Date().toISOString(),
      version: 1,
    };
    render(<ResumeExamModal draft={draft} open={true} onResume={vi.fn()} onDiscard={onDiscard} />);
    fireEvent.click(screen.getByText('Bắt đầu lại'));
    expect(onDiscard).toHaveBeenCalled();
  });
});

describe('MultiTabWarning', () => {
  it('ẩn khi không có tab khác', () => {
    const { container } = render(<MultiTabWarning hasOtherTab={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('hiển thị cảnh báo và cho dismiss', () => {
    render(<MultiTabWarning hasOtherTab={true} position="floating" />);
    expect(screen.getByText(/Phát hiện tab khác/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Tôi hiểu'));
    expect(screen.queryByText(/Phát hiện tab khác/)).not.toBeInTheDocument();
  });
});

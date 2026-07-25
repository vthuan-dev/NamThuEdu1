import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManageAssignmentsModal } from '../ManageAssignmentsModal';
import { api } from '@/services/api';

// Mock service API + toast context
vi.mock('@/services/api', () => ({
  api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/contexts/ToastContext', () => ({
  useToastContext: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}));

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('ManageAssignmentsModal — sửa yêu cầu bài đã giao (bug #1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockResolvedValue({
      data: {
        data: [
          {
            taId: 77,
            taTarget_type: 'student',
            taTarget_id: 5,
            target_name: 'Nguyễn Văn A',
            taDeadline: '2026-12-31 23:59:00',
            taStart_time: null,
            taMax_attempt: 1,
            taNotify_before_minutes: 30,
            taInstructions: 'cũ',
            total_students: 1,
            completed_students: 0,
          },
        ],
      },
    });
    mockApi.put.mockResolvedValue({ data: { status: 'success' } });
  });

  it('liệt kê phân công đã giao và cho phép sửa số lần làm + lưu (gọi PUT đúng payload)', async () => {
    render(
      <ManageAssignmentsModal open examId={555} examTitle="Đề THPT" onClose={() => {}} />,
    );

    // Nạp danh sách theo đúng exam_id
    await waitFor(() => expect(mockApi.get).toHaveBeenCalledWith('/teacher/assignments?exam_id=555'));
    expect(await screen.findByText('Nguyễn Văn A')).toBeInTheDocument();

    // Mở form sửa
    fireEvent.click(screen.getByRole('button', { name: /Sửa/i }));

    // Đổi số lần làm 1 → 3
    const maxAttemptInput = screen.getByDisplayValue('1') as HTMLInputElement;
    fireEvent.change(maxAttemptInput, { target: { value: '3' } });

    // Lưu
    fireEvent.click(screen.getByRole('button', { name: /Lưu/i }));

    await waitFor(() => expect(mockApi.put).toHaveBeenCalledTimes(1));
    const [url, payload] = mockApi.put.mock.calls[0];
    expect(url).toBe('/teacher/assignments/77');
    expect(payload.taMax_attempt).toBe(3);
    expect(payload.taInstructions).toBe('cũ');
    // Sau khi lưu thì reload danh sách
    await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(2));
  });
});

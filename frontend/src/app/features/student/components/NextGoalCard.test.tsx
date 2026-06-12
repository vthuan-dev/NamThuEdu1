/**
 * Unit tests cho NextGoalCard.
 * - Ẩn hoàn toàn khi không có mục tiêu (data null).
 * - Hiển thị tên mục tiêu + số ngày còn lại khi có data.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const next = vi.fn();

vi.mock('../../../../services/classMgmtApi', () => ({
  studentGoalApi: { next: () => next() },
}));

import { NextGoalCard } from './NextGoalCard';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NextGoalCard', () => {
  it('không render gì khi không có mục tiêu', async () => {
    next.mockResolvedValue({ status: 'success', data: null });
    const { container } = render(<NextGoalCard ageGroup="teens" />);
    // Chờ effect xử lý xong
    await waitFor(() => expect(next).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it('hiển thị tên mục tiêu và số ngày còn lại', async () => {
    next.mockResolvedValue({
      status: 'success',
      data: {
        id: 1,
        goal_title: 'Thi VSTEP B2',
        target_date: '2026-12-01',
        target_level: 'B2',
        days_remaining: 12,
      },
    });
    render(<NextGoalCard ageGroup="adults" />);
    expect(await screen.findByText(/Thi VSTEP B2/)).toBeInTheDocument();
    expect(await screen.findByText(/còn 12 ngày/)).toBeInTheDocument();
  });
});

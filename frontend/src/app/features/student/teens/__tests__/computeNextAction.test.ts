import { describe, it, expect } from 'vitest';
import { computeNextAction } from '../TeensDashboard';
import type { InProgressTest, UpcomingTest } from '@/services/studentApi';

/**
 * Regression cho bug "vào trực tiếp ở trang chủ thì bị báo lỗi".
 *
 * API trả `id` = eId của đề và `assignment_id` riêng (KHÔNG có `exam_id`).
 * Trước khi fix, nhánh "start" dựng URL bằng `exam_id ?? assignment_id` → rơi về
 * assignment_id, dùng NHẦM làm examId → getForStudent 404.
 * URL đúng phải chứa `id` (eId) làm examId, và assignment_id nằm ở query.
 */
describe('computeNextAction — route THPT dùng đúng examId (regression bug trang chủ)', () => {
  it('upcoming THPT: dùng t.id (eId) làm examId, assignment_id ở query', () => {
    const upcoming: UpcomingTest[] = [
      {
        id: 555,            // eId của đề
        assignment_id: 999, // id phân công (KHÁC eId)
        title: 'Đề THPT',
        type: 'THPT',
        skill: 'mixed',
        deadline: '2026-12-31 23:59:59',
        duration: 60,
        is_urgent: false,
        days_until: 3,
      },
    ];

    const action = computeNextAction([], upcoming);

    expect(action?.kind).toBe('start');
    expect(action?.routeUrl).toBe('/hoc-vien/lam-bai-thpt/555?assignmentId=999');
    // Không được dùng nhầm assignment_id (999) làm examId
    expect(action?.routeUrl).not.toContain('lam-bai-thpt/999');
  });

  it('resume THPT: dùng t.id (eId) làm examId', () => {
    const inProgress: InProgressTest[] = [
      {
        id: 555,
        submission_id: 12,
        assignment_id: 999,
        title: 'Đề THPT',
        type: 'THPT',
        skill: 'mixed',
        time_remaining: 30,
        total_duration: 60,
        started_at: '2026-07-24 08:00:00',
      },
    ];

    const action = computeNextAction(inProgress, []);

    expect(action?.kind).toBe('resume');
    expect(action?.routeUrl).toBe('/hoc-vien/lam-bai-thpt/555');
  });
});

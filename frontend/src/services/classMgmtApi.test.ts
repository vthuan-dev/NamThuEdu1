/**
 * Unit tests cho classMgmtApi / adminHandoverApi / studentGoalApi.
 * Mock module './api' (axios instance) và xác nhận mỗi method gọi đúng
 * endpoint + HTTP method, đồng thời unwrap `.data` từ response.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const del = vi.fn();

vi.mock('./api', () => ({
  api: {
    get: (...a: any[]) => get(...a),
    post: (...a: any[]) => post(...a),
    put: (...a: any[]) => put(...a),
    delete: (...a: any[]) => del(...a),
  },
}));

import { classMgmtApi, adminHandoverApi, studentGoalApi } from './classMgmtApi';

const ok = (data: any) => Promise.resolve({ data });

beforeEach(() => {
  vi.clearAllMocks();
  get.mockReturnValue(ok({ status: 'success', data: [] }));
  post.mockReturnValue(ok({ status: 'success' }));
  put.mockReturnValue(ok({ status: 'success' }));
  del.mockReturnValue(ok({ status: 'success' }));
});

describe('classMgmtApi - classes', () => {
  it('list gọi GET /teacher/classes và unwrap data', async () => {
    get.mockReturnValue(ok({ status: 'success', data: [{ cId: 1 }] }));
    const res = await classMgmtApi.list();
    expect(get).toHaveBeenCalledWith('/teacher/classes');
    expect(res.data).toEqual([{ cId: 1 }]);
  });

  it('get gọi GET /teacher/classes/:id', async () => {
    await classMgmtApi.get(7);
    expect(get).toHaveBeenCalledWith('/teacher/classes/7');
  });

  it('create gọi POST /teacher/classes với payload', async () => {
    const payload = { name: 'A', age_group: 'teens', max_students: 30 };
    await classMgmtApi.create(payload);
    expect(post).toHaveBeenCalledWith('/teacher/classes', payload);
  });

  it('update gọi PUT /teacher/classes/:id', async () => {
    await classMgmtApi.update(3, { name: 'B' });
    expect(put).toHaveBeenCalledWith('/teacher/classes/3', { name: 'B' });
  });

  it('remove không force gọi DELETE không query', async () => {
    await classMgmtApi.remove(5);
    expect(del).toHaveBeenCalledWith('/teacher/classes/5');
  });

  it('remove force=true thêm ?force=true', async () => {
    await classMgmtApi.remove(5, true);
    expect(del).toHaveBeenCalledWith('/teacher/classes/5?force=true');
  });
});

describe('classMgmtApi - roster', () => {
  it('enroll gọi POST /enroll với student_ids', async () => {
    await classMgmtApi.enroll(2, [10, 11]);
    expect(post).toHaveBeenCalledWith('/teacher/classes/2/enroll', { student_ids: [10, 11] });
  });

  it('removeStudent gọi DELETE đúng path', async () => {
    await classMgmtApi.removeStudent(2, 10);
    expect(del).toHaveBeenCalledWith('/teacher/classes/2/students/10');
  });
});

describe('classMgmtApi - announcements & goals', () => {
  it('createAnnouncement gọi POST đúng path', async () => {
    const body = { title: 'T', content: 'C', priority: 'important' };
    await classMgmtApi.createAnnouncement(4, body);
    expect(post).toHaveBeenCalledWith('/teacher/classes/4/announcements', body);
  });

  it('deleteAnnouncement gọi DELETE đúng path', async () => {
    await classMgmtApi.deleteAnnouncement(4, 9);
    expect(del).toHaveBeenCalledWith('/teacher/classes/4/announcements/9');
  });

  it('createGoal gọi POST đúng path', async () => {
    const body = { goal_title: 'VSTEP', target_date: '2026-12-01' };
    await classMgmtApi.createGoal(4, body);
    expect(post).toHaveBeenCalledWith('/teacher/classes/4/goals', body);
  });

  it('deleteGoal gọi DELETE đúng path', async () => {
    await classMgmtApi.deleteGoal(4, 2);
    expect(del).toHaveBeenCalledWith('/teacher/classes/4/goals/2');
  });
});

describe('classMgmtApi - handover (teacher)', () => {
  it('requestHandover gọi POST với reason', async () => {
    await classMgmtApi.requestHandover(8, 'bận');
    expect(post).toHaveBeenCalledWith('/teacher/classes/8/handover-request', { reason: 'bận' });
  });

  it('cancelHandover gọi DELETE đúng path', async () => {
    await classMgmtApi.cancelHandover(8);
    expect(del).toHaveBeenCalledWith('/teacher/classes/8/handover-request');
  });
});

describe('adminHandoverApi', () => {
  it('list không status → params rỗng', async () => {
    await adminHandoverApi.list();
    expect(get).toHaveBeenCalledWith('/admin/handover-requests', { params: {} });
  });

  it('list có status → truyền params.status', async () => {
    await adminHandoverApi.list('pending');
    expect(get).toHaveBeenCalledWith('/admin/handover-requests', { params: { status: 'pending' } });
  });

  it('approve gọi POST với receiving_teacher_id', async () => {
    await adminHandoverApi.approve(3, 99);
    expect(post).toHaveBeenCalledWith('/admin/handover-requests/3/approve', { receiving_teacher_id: 99 });
  });

  it('reject gọi POST với admin_note', async () => {
    await adminHandoverApi.reject(3, 'không');
    expect(post).toHaveBeenCalledWith('/admin/handover-requests/3/reject', { admin_note: 'không' });
  });
});

describe('studentGoalApi', () => {
  it('next gọi GET /student/class-goals/next', async () => {
    get.mockReturnValue(ok({ status: 'success', data: { id: 1, days_remaining: 5 } }));
    const res = await studentGoalApi.next();
    expect(get).toHaveBeenCalledWith('/student/class-goals/next');
    expect(res.data.days_remaining).toBe(5);
  });
});

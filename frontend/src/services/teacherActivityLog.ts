/**
 * Teacher activity log helper — gọi mỗi khi giáo viên hoàn tất một action
 * (tạo đề, sửa, giao bài, chấm điểm, thêm học viên, đăng bài...).
 *
 * Cách dùng:
 *   import { logTeacherActivity } from '@/services/teacherActivityLog';
 *   await logTeacherActivity({
 *     action: 'exam.create',
 *     entity_type: 'exam',
 *     entity_id: exam.eId,
 *     detail: 'Tạo đề thi VSTEP B2 Mock',
 *     meta: { type: 'VSTEP', skill: 'mixed' },
 *   });
 *
 * Best-effort: errors được nuốt — KHÔNG throw để tránh break flow chính.
 */

import { api } from './api';

export type TeacherActivityAction =
  // Exam
  | 'exam.create'
  | 'exam.update'
  | 'exam.delete'
  | 'exam.duplicate'
  | 'exam.import'
  // Assignment
  | 'assignment.create'
  | 'assignment.update'
  | 'assignment.delete'
  // Grading
  | 'grading.complete'
  | 'grading.review'
  // Student
  | 'student.add'
  | 'student.update'
  | 'student.delete'
  | 'student.restore'
  | 'student.import'
  | 'student.exam_schedule.create'
  // Blog
  | 'blog.create'
  | 'blog.update'
  | 'blog.delete'
  | 'blog.publish'
  // Profile / settings
  | 'profile.update'
  | 'password.change'
  // Generic fallback
  | 'other';

export interface ActivityLogPayload {
  action: TeacherActivityAction;
  entity_type?: 'exam' | 'student' | 'assignment' | 'submission' | 'blog' | 'other' | null;
  entity_id?: number | null;
  detail?: string;
  meta?: Record<string, unknown>;
}

export interface TeacherActivityLog {
  id: number;
  teacher_id: number;
  action: TeacherActivityAction;
  entity_type: string | null;
  entity_id: number | null;
  detail: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Ghi 1 log. Best-effort — nuốt error để không cản trở flow chính.
 */
export async function logTeacherActivity(payload: ActivityLogPayload): Promise<void> {
  try {
    await api.post('/teacher/activity-log', payload);
  } catch (err) {
    // silently fail — chỉ là feed UX
    if (import.meta.env.DEV) {
      console.warn('[activity-log] failed:', err);
    }
  }
}

/**
 * Lấy danh sách log gần nhất của teacher hiện tại.
 */
export async function fetchTeacherActivityLogs(limit = 20): Promise<TeacherActivityLog[]> {
  try {
    const { data } = await api.get('/teacher/activity-log', { params: { limit } });
    if (data?.status === 'success' && Array.isArray(data.data)) {
      return data.data as TeacherActivityLog[];
    }
  } catch (err) {
    console.error('[activity-log] fetch failed:', err);
  }
  return [];
}

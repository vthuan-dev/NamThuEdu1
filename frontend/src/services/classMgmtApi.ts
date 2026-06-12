import { api } from './api';

/**
 * Service cho tính năng Teacher Class Management.
 * Gọi trực tiếp api (axios) — trả về body { status, data, message }.
 */

export interface ClassItem {
  cId: number;
  cName: string;
  cDescription?: string | null;
  cStatus: string;
  age_group: 'kids' | 'teens' | 'adults';
  max_students: number;
  current_student_count: number;
  is_full: boolean;
  has_pending_handover?: boolean;
  cCreated_at?: string;
}

export interface ClassStudent {
  uId: number;
  uName: string;
  uPhone?: string;
  age_group?: string;
  avatar_url?: string | null;
}

export interface ClassAnnouncement {
  id: number;
  class_id: number;
  title: string;
  content: string;
  priority: 'normal' | 'important' | 'urgent';
  is_pinned: boolean;
  created_at: string;
}

export interface ClassGoal {
  id: number;
  class_id: number;
  goal_title: string;
  target_date: string;
  target_level?: string | null;
  description?: string | null;
  status: 'active' | 'completed' | 'cancelled';
}

export interface ClassAssignmentRow {
  taId: number;
  exam_id: number;
  exam_title: string | null;
  taDeadline: string | null;
  taStart_time: string | null;
  submission_count: number;
}

export interface HandoverRequest {
  id: number;
  class_id: number;
  class_name: string;
  from_teacher: { id: number; name: string | null };
  receiving_teacher: { id: number; name: string | null } | null;
  reason: string | null;
  admin_note: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
  resolved_at: string | null;
}

export const classMgmtApi = {
  // ── Classes ───────────────────────────────────────────────
  list: () => api.get('/teacher/classes').then(r => r.data),
  get: (id: number) => api.get(`/teacher/classes/${id}`).then(r => r.data),
  create: (data: { name: string; age_group: string; description?: string; max_students: number }) =>
    api.post('/teacher/classes', data).then(r => r.data),
  update: (id: number, data: Partial<{ name: string; age_group: string; description: string; max_students: number }>) =>
    api.put(`/teacher/classes/${id}`, data).then(r => r.data),
  remove: (id: number, force = false) =>
    api.delete(`/teacher/classes/${id}${force ? '?force=true' : ''}`).then(r => r.data),

  // ── Roster ────────────────────────────────────────────────
  enroll: (id: number, studentIds: number[]) =>
    api.post(`/teacher/classes/${id}/enroll`, { student_ids: studentIds }).then(r => r.data),
  removeStudent: (id: number, studentId: number) =>
    api.delete(`/teacher/classes/${id}/students/${studentId}`).then(r => r.data),

  // ── Assignments ───────────────────────────────────────────
  assignments: (id: number) => api.get(`/teacher/classes/${id}/assignments`).then(r => r.data),

  // ── Announcements ─────────────────────────────────────────
  announcements: (classId: number) =>
    api.get(`/teacher/classes/${classId}/announcements`).then(r => r.data),
  createAnnouncement: (classId: number, data: { title: string; content: string; priority?: string; is_pinned?: boolean }) =>
    api.post(`/teacher/classes/${classId}/announcements`, data).then(r => r.data),
  deleteAnnouncement: (classId: number, id: number) =>
    api.delete(`/teacher/classes/${classId}/announcements/${id}`).then(r => r.data),

  // ── Goals ─────────────────────────────────────────────────
  goals: (classId: number) => api.get(`/teacher/classes/${classId}/goals`).then(r => r.data),
  createGoal: (classId: number, data: { goal_title: string; target_date: string; target_level?: string; description?: string }) =>
    api.post(`/teacher/classes/${classId}/goals`, data).then(r => r.data),
  deleteGoal: (classId: number, id: number) =>
    api.delete(`/teacher/classes/${classId}/goals/${id}`).then(r => r.data),

  // ── Handover (teacher) ────────────────────────────────────
  requestHandover: (id: number, reason?: string) =>
    api.post(`/teacher/classes/${id}/handover-request`, { reason }).then(r => r.data),
  cancelHandover: (id: number) =>
    api.delete(`/teacher/classes/${id}/handover-request`).then(r => r.data),

  // ── Enrollable students (dùng danh sách học viên của GV) ──
  availableStudents: () => api.get('/teacher/students', { params: { per_page: 500 } }).then(r => r.data),
};

export const adminHandoverApi = {
  list: (status?: string) =>
    api.get('/admin/handover-requests', { params: status ? { status } : {} }).then(r => r.data),
  approve: (id: number, receivingTeacherId: number) =>
    api.post(`/admin/handover-requests/${id}/approve`, { receiving_teacher_id: receivingTeacherId }).then(r => r.data),
  reject: (id: number, adminNote?: string) =>
    api.post(`/admin/handover-requests/${id}/reject`, { admin_note: adminNote }).then(r => r.data),
  teachers: () => api.get('/admin/classes/assignment-teachers').then(r => r.data),
};

export const studentGoalApi = {
  next: () => api.get('/student/class-goals/next').then(r => r.data),
};

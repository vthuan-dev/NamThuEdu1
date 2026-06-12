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
  pending_request_type?: 'handover' | 'deletion' | null;
  pending_request_id?: number | null;
  is_owner?: boolean;
  cCreated_at?: string;
}

export interface ClassRequest {
  id: number;
  request_type: 'handover' | 'deletion';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reason?: string | null;
  admin_note?: string | null;
  class: { cId: number; cName: string | null; age_group?: string | null };
  created_at?: string;
  resolved_at?: string | null;
}

export interface CoTeacher {
  id: number;
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  type?: 'co_teach' | 'transfer';
  message?: string | null;
  teacher: { uId: number; uName: string | null; uPhone?: string | null; avatar_url?: string | null };
  invited_by?: string | null;
  created_at?: string;
}

export interface Colleague {
  uId: number;
  uName: string;
  uPhone?: string | null;
  avatar_url?: string | null;
}

export interface CoTeacherInvitation {
  id: number;
  type?: 'co_teach' | 'transfer';
  message?: string | null;
  invited_by?: string | null;
  class: { cId: number; cName: string | null; age_group?: string | null };
  created_at?: string;
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
  request_type?: 'handover' | 'deletion';
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

  // ── Xem lại & hủy yêu cầu (bàn giao + xóa lớp) ────────────
  myRequests: (status?: string) =>
    api.get('/teacher/class-requests', { params: status ? { status } : {} }).then(r => r.data),
  cancelRequest: (id: number) =>
    api.post(`/teacher/class-requests/${id}/cancel`).then(r => r.data),

  // ── Co-teaching: mời GV khác cùng quản lý lớp ─────────────
  colleagues: () => api.get('/teacher/colleagues').then(r => r.data),
  inviteCoTeacher: (classId: number, teacherId: number, message?: string, type: 'co_teach' | 'transfer' = 'co_teach') =>
    api.post(`/teacher/classes/${classId}/co-teachers`, { teacher_id: teacherId, message, type }).then(r => r.data),
  removeCoTeacher: (classId: number, coId: number) =>
    api.delete(`/teacher/classes/${classId}/co-teachers/${coId}`).then(r => r.data),
  myCoTeacherInvitations: () =>
    api.get('/teacher/co-teacher-invitations').then(r => r.data),
  respondCoTeacherInvitation: (coId: number, action: 'accept' | 'decline') =>
    api.post(`/teacher/co-teacher-invitations/${coId}/respond`, { action }).then(r => r.data),

  // ── Enrollable students (dùng danh sách học viên của GV) ──
  availableStudents: () => api.get('/teacher/students', { params: { per_page: 500 } }).then(r => r.data),
};

export const adminHandoverApi = {
  list: (status?: string) =>
    api.get('/admin/handover-requests', { params: status ? { status } : {} }).then(r => r.data),
  approve: (id: number, receivingTeacherId?: number) =>
    api.post(`/admin/handover-requests/${id}/approve`, receivingTeacherId ? { receiving_teacher_id: receivingTeacherId } : {}).then(r => r.data),
  reject: (id: number, adminNote?: string) =>
    api.post(`/admin/handover-requests/${id}/reject`, { admin_note: adminNote }).then(r => r.data),
  teachers: () => api.get('/admin/classes/assignment-teachers').then(r => r.data),
};

export const studentGoalApi = {
  next: () => api.get('/student/class-goals/next').then(r => r.data),
};

// ── Teacher: mục tiêu từng học viên + phân tích AI ────────────
export interface GoalSkillAnalysis {
  skill: string;
  current_score?: number | null;
  current_level?: string | null;
  target_hint?: string;
  status?: 'achieved' | 'on_track' | 'behind' | 'no_data' | string;
  gap_note?: string;
}

export interface GoalAnalysis {
  has_data?: boolean;
  error?: boolean;
  summary?: string;
  gap_summary?: string;
  current_level_estimate?: string | null;
  overall_progress_percent?: number;
  on_track?: boolean | null;
  skills?: GoalSkillAnalysis[];
  weaknesses?: string[];
  priority_actions?: string[];
  estimated_sessions_to_goal?: number | null;
  encouragement?: string;
}

export interface StudentGoalData {
  id?: number;
  student_id?: number;
  target_level: string;
  target_skill?: string | null;
  exam_type?: string | null;
  target_date?: string | null;
  note?: string | null;
  status?: 'active' | 'achieved' | 'cancelled';
  ai_analysis?: GoalAnalysis | null;
  ai_analyzed_at?: string | null;
}

export const teacherStudentGoalApi = {
  get: (studentId: number) =>
    api.get(`/teacher/students/${studentId}/goal`).then(r => r.data),
  upsert: (studentId: number, data: Partial<StudentGoalData>) =>
    api.put(`/teacher/students/${studentId}/goal`, data).then(r => r.data),
  remove: (studentId: number) =>
    api.delete(`/teacher/students/${studentId}/goal`).then(r => r.data),
  analyze: (studentId: number) =>
    api.post(`/teacher/students/${studentId}/goal/analyze`).then(r => r.data),
};

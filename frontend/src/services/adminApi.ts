import { api } from "./api";
import type { ApiResponse } from "../types/index";

export interface AdminUser {
  uId?: number;
  id?: number;
  uName?: string;
  name?: string;
  uPhone?: string;
  phone?: string;
  uRole?: "student" | "teacher" | "admin";
  role?: "student" | "teacher" | "admin";
  uStatus?: "active" | "inactive";
  status?: "active" | "inactive";
  uCreated_at?: string;
  created_at?: string;
  avatar_url?: string | null;
  avatar?: string | null;
  age_group?: "kids" | "teens" | "adults" | string | null;
}

export interface AdminCategory {
  cId?: number;
  caId?: number;
  cName?: string;
  caName?: string;
  cDescription?: string;
  caDescription?: string;
  cType?: "VSTEP" | "IELTS" | "GENERAL" | string;
  caType?: "VSTEP" | "IELTS" | "GENERAL" | string;
}

export interface AdminPost {
  pId?: number;
  id?: number;
  pTitle?: string;
  title?: string;
  pStatus?: "pending" | "draft" | "active" | "inactive";
  status?: "pending" | "draft" | "active" | "inactive";
  pType?: string;
  pCreated_at?: string;
  created_at?: string;
  author?: { uName?: string; name?: string };
}

export interface AdminExam {
  eId?: number;
  id?: number;
  eTitle?: string;
  title?: string;
  eType?: string;
  eSkill?: string;
  eStatus?: string;
  eIs_private?: boolean;
  eCreated_at?: string;
  created_at?: string;
  teacher?: { uName?: string; name?: string };
  questions_count?: number;
  // Age-group classification fields
  age_group?: "kids" | "teens" | "adults" | string | null;
  content_type?: string | null;
  difficulty_level?: string | null;
  eTarget_level?: string | null;
  eDifficulty?: string | null;
  eDescription?: string | null;
  eDuration?: number | string | null;
  eDuration_minutes?: number | string | null;
  // IELTS-specific
  ielts_test_type?: string | null;
  ielts_skill?: string | null;
}

export interface AdminActivityLogItem {
  id: number;
  admin_id: number;
  admin_name: string;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  detail: string | null;
  method: string | null;
  path: string | null;
  ip: string | null;
  status_code: number | null;
  meta: Record<string, unknown> | null;
  created_at: string | null;
}

export interface AdminActivityLogStats {
  total: number;
  errors: number;
  last_7_days: number;
  by_action: Array<{ action: string; count: number }>;
  by_admin: Array<{ admin_id: number; admin_name: string; count: number }>;
}

export interface AdminSystemHealth {
  overall: "healthy" | "warning" | "critical";
  timestamp: string;
  app: { php_version: string; laravel: string; environment: string; debug: boolean };
  disk: { total_bytes: number; free_bytes: number; used_bytes: number; used_percent: number };
  memory: { usage_bytes: number; peak_bytes: number; limit: string; used_percent: number };
  database: { connected: boolean; latency_ms: number | null; counts: Record<string, number | null> };
  drivers: { cache: string; queue: string; session: string };
  queue: { pending_jobs: number | null };
}

export interface DashboardReportData {
  users: Record<string, unknown>;
  courses: Record<string, unknown>;  exams: Record<string, unknown>;
  activity: Record<string, unknown>;
  performance: Record<string, unknown>;
  generated_at: string;
}

export interface AdminAssignmentTeacher {
  id: number;
  name: string;
  phone: string;
  status: "active" | "inactive";
  assigned_classes: number;
}

export interface AdminClassAssignment {
  class_id: number;
  class_name: string;
  class_status: "active" | "inactive";
  description?: string | null;
  teacher: {
    id: number;
    name: string;
    phone: string;
    status: "active" | "inactive";
  } | null;
  course: {
    id: number;
    name: string;
    status?: string | null;
  } | null;
  student_count: number;
  created_at?: string;
}

export interface AdminStudentRegistrationItem {
  id: number;
  name: string | null;
  phone: string;
  status: "active" | "inactive";
  address?: string | null;
  created_at?: string;
  last_login?: string | null;
}

export interface AdminClassMember {
  id: number;
  name: string;
  phone: string;
  status: "active" | "inactive";
  avatar_url?: string | null;
  age_group?: string | null;
  joined_at?: string | null;
}

export interface AdminClassCoTeacher {
  id: number;
  teacher: { id: number; name: string; phone: string; avatar_url?: string | null } | null;
  invited_by?: string | null;
  status: "accepted" | "pending" | string;
  responded_at?: string | null;
}

export interface AdminClassDetail {
  class_id: number;
  class_name: string;
  description?: string | null;
  status: "active" | "inactive" | string;
  age_group?: string | null;
  created_at?: string;
  teacher: { id: number; name: string; phone: string; status: string; avatar_url?: string | null } | null;
  course: { id: number; name: string; status?: string | null } | null;
  co_teachers: AdminClassCoTeacher[];
  students: AdminClassMember[];
  student_count: number;
  pending_request?: { id: number; type: string; reason?: string | null; created_at?: string } | null;
}

export interface AdminCreateCoursePayload {
  course_name: string;
  teacher_id: number;
  category_id: number;
  max_students: number;
  time: string;
  schedule: string;
  start_date: string;
  end_date: string;
  status: "draft" | "active" | "ongoing" | "complete";
  description?: string;
}

const unwrap = <T>(payload: ApiResponse<T>): T => payload.data;

export const adminApi = {
  async getUsers(params?: { role?: string; status?: string; search?: string }) {
    const response = await api.get<ApiResponse<{ data?: AdminUser[] } | AdminUser[]>>("/admin/users", {
      params: { paginate: "false", ...params },
    });
    const raw = unwrap(response.data);
    return Array.isArray(raw) ? raw : raw.data || [];
  },

  async lockUser(userId: number) {
    return api.post<ApiResponse<unknown>>(`/admin/users/${userId}/lock`);
  },

  async unlockUser(userId: number) {
    return api.post<ApiResponse<unknown>>(`/admin/users/${userId}/unlock`);
  },

  async createUser(payload: {
    name: string;
    phone: string;
    password: string;
    role: "student" | "teacher" | "admin";
    status?: "active" | "inactive";
    age_group?: "kids" | "teens" | "adults" | string;
  }) {
    const response = await api.post<ApiResponse<unknown>>("/admin/users", payload);
    return response.data;
  },

  async getRoleStatistics() {
    const response = await api.get<ApiResponse<Record<string, { active: number; inactive: number; total: number }>>>(
      "/admin/roles/statistics"
    );
    return unwrap(response.data);
  },

  async bulkUserAction(payload: {
    action: "lock" | "unlock" | "activate" | "deactivate" | "delete" | "restore" | "change_role";
    user_ids: number[];
    role?: "student" | "teacher" | "admin";
    reason?: string;
  }) {
    const response = await api.post<ApiResponse<{ changed?: number; skipped?: Array<{ user_id: number; reason: string }> }>>(
      "/admin/users/bulk-action",
      payload,
    );
    return unwrap(response.data);
  },

  async changeUserRole(userId: number, role: "student" | "teacher" | "admin") {
    const response = await api.post<ApiResponse<unknown>>(`/admin/users/${userId}/change-role`, { role });
    return response.data;
  },

  async getSystemOverview() {
    const response = await api.get<ApiResponse<Record<string, unknown>>>("/admin/statistics/overview");
    return unwrap(response.data);
  },

  async getUserActivity() {
    const response = await api.get<ApiResponse<Record<string, number>>>("/admin/statistics/activity");
    return unwrap(response.data);
  },

  async getUserActivityReport(period = 30) {
    const response = await api.get<ApiResponse<{ report_data: Record<string, unknown>; generated_at: string }>>(
      "/admin/reports/user-activity",
      { params: { period } }
    );
    return unwrap(response.data);
  },

  async getDashboardReport() {
    const response = await api.get<ApiResponse<DashboardReportData>>("/admin/reports/dashboard");
    return unwrap(response.data);
  },

  async getUsersReport(period: "7d" | "30d" | "90d" | "1y" = "30d") {
    const response = await api.get<ApiResponse<Record<string, unknown>>>("/admin/reports/users", {
      params: { period },
    });
    return unwrap(response.data);
  },

  async getCoursesReport(period: "7d" | "30d" | "90d" | "1y" = "30d") {
    const response = await api.get<ApiResponse<Record<string, unknown>>>("/admin/reports/courses", {
      params: { period },
    });
    return unwrap(response.data);
  },

  async getActivityReport(period: "7d" | "30d" | "90d" | "1y" = "30d") {
    const response = await api.get<ApiResponse<Record<string, unknown>>>("/admin/reports/activity", {
      params: { period },
    });
    return unwrap(response.data);
  },

  async getTrendsReport(period: "30d" | "90d" | "6m" | "1y" = "90d") {
    const response = await api.get<ApiResponse<Record<string, unknown>>>("/admin/reports/trends", {
      params: { period },
    });
    return unwrap(response.data);
  },

  async exportReport(params?: {
    type?: "dashboard" | "users" | "courses" | "activity" | "trends";
    format?: "json" | "csv" | "pdf";
    period?: "7d" | "30d" | "90d" | "1y";
  }) {
    const response = await api.get<ApiResponse<Record<string, unknown>>>("/admin/reports/export", { params });
    return response.data;
  },

  /**
   * Download CSV export and trigger browser save.
   * Returns the filename so callers can show feedback.
   */
  async downloadReportCsv(params: {
    type: "dashboard" | "users" | "courses" | "activity" | "trends";
    period?: "7d" | "30d" | "90d" | "1y";
  }) {
    const response = await api.get("/admin/reports/export", {
      params: { ...params, format: "csv" },
      responseType: "blob",
    });
    const blob = response.data as Blob;
    const filename = `report_${params.type}_${new Date().toISOString().slice(0, 10)}.csv`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return filename;
  },

  async getContentStatistics() {
    const response = await api.get<ApiResponse<Record<string, unknown>>>("/admin/content/statistics");
    return unwrap(response.data);
  },

  async getLockedUsers() {
    const response = await api.get<ApiResponse<{ locked_users?: AdminUser[]; total_locked?: number }>>(
      "/admin/users/locked"
    );
    const data = unwrap(response.data);
    return data.locked_users || [];
  },

  async getCategories() {
    const response = await api.get<ApiResponse<AdminCategory[]>>("/admin/categories");
    return unwrap(response.data) || [];
  },

  async createCategory(payload: { cName: string; cDescription?: string; cType?: "VSTEP" | "IELTS" | "GENERAL" }) {
    const response = await api.post<ApiResponse<unknown>>("/admin/categories", payload);
    return response.data;
  },

  async updateCategory(id: number, payload: { cName?: string; cDescription?: string; cType?: "VSTEP" | "IELTS" | "GENERAL" }) {
    const response = await api.put<ApiResponse<unknown>>(`/admin/categories/${id}`, payload);
    return response.data;
  },

  async deleteCategory(id: number) {
    const response = await api.delete<ApiResponse<unknown>>(`/admin/categories/${id}`);
    return response.data;
  },

  async getPosts(params?: { status?: string; search?: string }) {
    const response = await api.get<ApiResponse<AdminPost[]>>("/admin/posts", {
      params: { paginate: "false", ...params },
    });
    return unwrap(response.data) || [];
  },

  async getPendingPosts() {
    const response = await api.get<ApiResponse<AdminPost[]>>("/admin/posts/pending");
    return unwrap(response.data) || [];
  },

  async approvePost(postId: number) {
    return api.post<ApiResponse<unknown>>(`/admin/posts/${postId}/approve`);
  },

  async rejectPost(postId: number, reason: string) {
    return api.post<ApiResponse<unknown>>(`/admin/posts/${postId}/reject`, { reason });
  },

  async deletePost(postId: number) {
    return api.delete<ApiResponse<unknown>>(`/admin/posts/${postId}`);
  },

  async getExams(params?: { search?: string; type?: string; skill?: string }) {
    const response = await api.get<ApiResponse<AdminExam[]>>("/admin/exams", {
      params: { paginate: "false", ...params },
    });
    return unwrap(response.data) || [];
  },

  async getPendingExams() {
    const response = await api.get<ApiResponse<AdminExam[]>>("/admin/exams/pending");
    return unwrap(response.data) || [];
  },

  async getExamStatistics() {
    const response = await api.get<ApiResponse<Record<string, unknown>>>("/admin/exams/statistics");
    return unwrap(response.data);
  },

  async approveExam(examId: number) {
    return api.post<ApiResponse<unknown>>(`/admin/exams/${examId}/approve`);
  },

  async rejectExam(examId: number, reason: string) {
    return api.post<ApiResponse<unknown>>(`/admin/exams/${examId}/reject`, { reason });
  },

  async deleteExam(examId: number) {
    return api.delete<ApiResponse<unknown>>(`/admin/exams/${examId}`);
  },

  async getTeacherClassAssignments(params?: { search?: string; status?: "active" | "inactive"; teacher_id?: number }) {
    const response = await api.get<ApiResponse<{ data?: AdminClassAssignment[] } | AdminClassAssignment[]>>(
      "/admin/classes/assignments",
      {
        params: { paginate: "false", ...params },
      }
    );
    const raw = unwrap(response.data);
    return Array.isArray(raw) ? raw : raw.data || [];
  },

  async getTeacherAssignmentCandidates() {
    const response = await api.get<ApiResponse<{ teachers?: AdminAssignmentTeacher[] }>>("/admin/classes/assignment-teachers");
    return unwrap(response.data).teachers || [];
  },

  async reassignClassTeacher(classId: number, teacherId: number) {
    const response = await api.put<ApiResponse<unknown>>(`/admin/classes/${classId}/assign-teacher`, {
      teacher_id: teacherId,
    });
    return response.data;
  },

  // ── Quản lý lớp (chi tiết, gỡ học viên, xóa lớp) ──
  async getClassDetail(classId: number) {
    const response = await api.get<ApiResponse<AdminClassDetail>>(`/admin/classes/${classId}/detail`);
    return unwrap(response.data);
  },

  async deleteClass(classId: number) {
    const response = await api.delete<ApiResponse<unknown>>(`/admin/classes/${classId}`);
    return response.data;
  },

  async removeStudentFromClass(classId: number, studentId: number) {
    const response = await api.delete<ApiResponse<unknown>>(`/admin/classes/${classId}/students/${studentId}`);
    return response.data;
  },

  async getStudentNewRegistrations(params?: {
    period_days?: number;
    search?: string;
    status?: "active" | "inactive";
  }) {
    const response = await api.get<ApiResponse<{ summary?: Record<string, number>; data?: AdminStudentRegistrationItem[] }>>(
      "/admin/students/new-registrations",
      { params: { paginate: "false", ...params } }
    );
    const raw = unwrap(response.data);
    return {
      summary: raw.summary || {},
      items: raw.data || [],
    };
  },

  async createCourse(payload: AdminCreateCoursePayload) {
    const response = await api.post<ApiResponse<unknown>>("/admin/courses", payload);
    return response.data;
  },

  // Settings
  async getSettings() {
    const response = await api.get<ApiResponse<Record<string, unknown>>>("/admin/system/settings");
    return unwrap(response.data);
  },

  async updateSettings(payload: Record<string, unknown>) {
    const response = await api.post<ApiResponse<unknown>>("/admin/system/settings", payload);
    return response.data;
  },

  async getAdminProfile() {
    const response = await api.get<ApiResponse<{
      id: number; name: string; phone: string; email: string;
      role: string; created_at: string | null; last_login: string | null;
    }>>("/admin/profile");
    return unwrap(response.data);
  },

  async updateAdminProfile(payload: { name?: string; email?: string; phone?: string }) {
    const response = await api.put<ApiResponse<{ name: string; email: string; phone: string }>>("/admin/profile", payload);
    return unwrap(response.data);
  },

  async getAdminSessions() {
    const response = await api.get<ApiResponse<Array<{
      id: number; name: string; is_current: boolean;
      created_at: string; last_used_at: string;
    }>>>("/admin/profile/sessions");
    return unwrap(response.data) || [];
  },

  async revokeSession(id: number) {
    const response = await api.delete<ApiResponse<unknown>>(`/admin/profile/sessions/${id}`);
    return response.data;
  },

  async revokeAllSessions() {
    const response = await api.delete<ApiResponse<unknown>>("/admin/profile/sessions");
    return response.data;
  },

  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string) {
    const response = await api.post<ApiResponse<unknown>>("/user/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
      new_password_confirmation: confirmPassword,
    });
    return response.data;
  },

  // Legal content
  async getLegalContent() {
    const response = await api.get<ApiResponse<{ legal_vi: unknown; legal_en: unknown }>>("/admin/system/settings");
    const data = unwrap(response.data) as Record<string, unknown>;
    return {
      legal_vi: data.legal_vi ? JSON.parse(data.legal_vi as string) : null,
      legal_en: data.legal_en ? JSON.parse(data.legal_en as string) : null,
    };
  },

  async updateLegalContent(lang: "vi" | "en", content: unknown) {
    const key = `legal_${lang}`;
    const response = await api.post<ApiResponse<unknown>>("/admin/system/settings", {
      [key]: JSON.stringify(content),
    });
    return response.data;
  },

  // Notifications
  async getNotifications() {
    const response = await api.get<ApiResponse<Array<{ id: number; title: string; body: string; is_read: boolean; time: string }>>>("/admin/system/notifications");
    return unwrap(response.data) || [];
  },

  // Hoạt động gần đây THẬT (HS nộp bài, GV tạo đề, GV tạo HV) — cho dropdown realtime
  async getRecentActivity(params?: { limit?: number }) {
    const response = await api.get<ApiResponse<Array<{
      id: string;
      type: "submission" | "exam" | "student";
      title: string;
      body: string;
      ts: string;
      link: string;
    }>>>("/admin/system/recent-activity", { params });
    return unwrap(response.data) || [];
  },

  async markNotificationRead(id: number) {
    const response = await api.post<ApiResponse<unknown>>(`/admin/system/notifications/${id}/read`);
    return response.data;
  },

  // ── Audit log (real audit trail) ──
  async getActivityLogs(params?: {
    action?: string;
    entity_type?: string;
    admin_id?: number;
    search?: string;
    from_date?: string;
    to_date?: string;
    per_page?: number;
    page?: number;
  }) {
    const response = await api.get<ApiResponse<{ data?: AdminActivityLogItem[]; current_page?: number; last_page?: number; total?: number } | AdminActivityLogItem[]>>(
      "/admin/activity-logs",
      { params },
    );
    return unwrap(response.data);
  },

  async getActivityLogStats() {
    const response = await api.get<ApiResponse<AdminActivityLogStats>>("/admin/activity-logs/stats");
    return unwrap(response.data);
  },

  // ── System health (real measurable metrics) ──
  async getSystemHealth() {
    const response = await api.get<ApiResponse<AdminSystemHealth>>("/admin/system/health");
    return unwrap(response.data);
  },
};

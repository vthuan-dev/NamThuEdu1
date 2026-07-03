import { api } from './api';
import { getAuthToken } from '../utils/authStorage';

export interface TestAssignment {
  assignment_id: number;
  exam_id: number;
  exam_title: string;
  exam_type: string;
  exam_skill: string;
  exam_format?: string;
  exam_duration: number;
  total_questions: number;
  max_score: number;
  start_time: string;
  end_time: string;
  deadline?: string | null;
  is_urgent: boolean;
  time_remaining: string;
  attempts_allowed: number;
  attempts_used: number;
  status: 'pending' | 'in_progress' | 'completed';
  // Status-specific
  submission_id?: number | null;
  score?: number | null;
  submitted_at?: string | null;
}

export interface InProgressTest {
  id: number;
  submission_id: number;
  assignment_id: number | null;
  title: string;
  type: string;
  skill: string;
  time_remaining: number;
  total_duration: number;
  started_at: string;
  answered_questions?: number;
  total_questions?: number;
}

export interface TeacherReminder {
  id: number;
  assignment_id: number;
  exam_id: number;
  title: string;
  type: string;
  skill: string;
  duration: number;
  deadline: string;
  days_until: number | null;
  is_urgent: boolean;
  message: string | null;
  teacher_name: string | null;
  sent_at: string;
  read_at: string | null;
}

export interface ExamSchedule {
  id: number;
  student_id: number;
  title: string;
  exam_type: string | null;
  exam_date: string;       // YYYY-MM-DD
  exam_time: string | null; // HH:mm
  location: string | null;
  note: string | null;
  days_until: number | null;
  is_urgent: boolean;
  teacher_name: string | null;
  created_at: string;
}

export interface UpcomingTest {
  id: number;
  assignment_id: number;
  title: string;
  type: string;
  skill: string;
  deadline: string;
  duration: number;
  is_urgent: boolean;
  days_until: number;
}

export interface TodayActivity {
  today_minutes: number;
  daily_goal: number;
  goal_percentage: number;
  sessions: number;
}

export interface Submission {
  sId: number;
  sScore: number;
  sStatus: string;
  sSubmit_time: string;
  sGraded_time: string | null;
  sAttempt: number;
  sTime_taken: number;
  exam: {
    eId: number;
    eTitle: string;
    eType: string;
    eSkill: string;
    eTotal_questions: number;
    eMax_score: number;
  };
  stats?: {
    correct_answers: number;
    total_questions: number;
    accuracy: number;
    grade: string;
    rank_in_class: number;
    total_students: number;
  };
}

export interface ProgressData {
  overview: {
    total_tests: number;
    average_score: number;
    highest_score: number;
    lowest_score: number;
    recent_score: number;
  };
  trends: {
    recent_scores: Array<{
      date: string;
      score: number;
      exam_title: string;
      exam_type: string;
      exam_skill: string;
    }>;
  };
  skill_analysis: {
    skills_breakdown: Array<{
      skill: string;
      skill_name: string;
      count: number;
      average_score: number;
      highest_score: number;
      lowest_score: number;
      mastery_level: string;
    }>;
  };
}

type TestsResponse = {
  status: string;
  data: {
    pending: TestAssignment[];
    in_progress: TestAssignment[];
    completed: TestAssignment[];
  };
};

export interface BrowseExam {
  id: number;
  title: string;
  type: 'VSTEP' | 'IELTS';
  skill: string;
  ielts_skill?: string | null;
  ielts_test_type?: string | null;
  scope?: 'full' | 'skill' | 'part' | string;
  part_type?: string | null;
  part_number?: number | null;
  duration: number;
  description: string | null;
  age_group: string | null;
  questions_count: number;
  created_at: string;
}

export interface BrowseKidsExam {
  id: number;
  title: string;
  type: string;
  skill: string;
  scope?: 'full' | 'skill' | 'part' | string;
  part_type?: string | null;
  part_number?: number | null;
  duration: number;
  description: string | null;
  age_group: string | null;
  questions_count: number;
  created_at: string;
  is_assigned: boolean;
  assignment_id: number | null;
  submission_status: 'pending' | 'in_progress' | 'completed';
  submission_id: number | null;
  score: number | null;
}

export interface BrowseTeensExam {
  id: number;
  title: string;
  type: string;
  skill: string;
  scope?: 'full' | 'skill' | 'part' | string;
  part_type?: string | null;
  part_number?: number | null;
  duration: number;
  description: string | null;
  age_group: string | null;
  questions_count: number;
  created_at: string;
  is_assigned: boolean;
  assignment_id: number | null;
  deadline: string | null;
  submission_status: 'pending' | 'in_progress' | 'completed';
  submission_id: number | null;
  score: number | null;
}

/**
 * Một câu trả lời gửi kèm các endpoint /draft và /auto-submit.
 * Tuỳ dạng đề mà chỉ một trong các trường giá trị được set.
 */
export interface DraftAnswer {
  question_id: number;
  answer_id?: number | null;
  answer_text?: string | null;
  saAnswer_text?: string | null;
}

export type AutoSubmitReason = 'unload' | 'timeout' | 'manual_force';

export const studentApi = {
  // Tests — always real backend
  getTests: (params?: { status?: string; type?: string; skill?: string }) =>
    api.get<TestsResponse>('/student/tests', { params }),

  getTestDetail: (id: number) =>
    api.get(`/student/tests/${id}`),

  startTest: (id: number) =>
    api.post(`/student/tests/${id}/start`),

  resumeTest: (id: number) =>
    api.get(`/student/tests/${id}/resume`),

  connectTestWebsocket: (submissionId: number) =>
    api.post('/student/websocket/connect', { submission_id: submissionId }),

  reconnectTestWebsocket: (submissionId: number) =>
    api.post('/student/websocket/reconnect', { submission_id: submissionId }),

  syncTestTime: (submissionId: number) =>
    api.post('/student/websocket/sync-time', { submission_id: submissionId }),

  // Submissions — always real backend
  getSubmissions: (params?: { limit?: number; sort?: string; status?: string }) =>
    api.get<{ status: string; data: { submissions: Submission[] } }>('/student/submissions', { params }),

  getSubmissionDetail: (id: number) =>
    api.get(`/student/submissions/${id}`),

  getAnswers: (id: number) =>
    api.get(`/student/submissions/${id}/answers`),

  getGradingStatus: (id: number) =>
    api.get(`/student/submissions/${id}/grading-status`),

  compareSubmission: (id: number) =>
    api.get(`/student/submissions/${id}/compare`),

  // Progress — always real backend
  getProgress: () =>
    api.get<{ status: string; data: ProgressData }>('/student/progress'),

  // Answer
  saveAnswer: (submissionId: number, data: { question_id: number; answer_id?: number; answer_text?: string; saAnswer_text?: string }) =>
    api.post(`/student/tests/${submissionId}/answer`, data),

  // Bulk save answers (used to force-flush all local answers before submit)
  bulkSaveAnswers: (submissionId: number, answers: Array<{ question_id: number; saAnswer_text: string }>) =>
    api.post(`/student/tests/${submissionId}/answers/bulk`, { answers }),

  submitTest: (submissionId: number) =>
    api.post(`/student/tests/${submissionId}/submit`),

  // ─── Auto-save / auto-submit (defense-in-depth, Phase 2) ────────────────
  /**
   * Batch upsert nhiều đáp án trong một request. Idempotent.
   * BE cập nhật `last_activity_at = now()` và trả về `timeRemaining` server-truth.
   */
  saveDraft: (submissionId: number, answers: DraftAnswer[]) =>
    api.post<{
      status: string;
      savedCount: number;
      serverTime: string;
      timeRemaining: number;
    }>(`/student/tests/${submissionId}/draft`, { answers }),

  /**
   * Best-effort lưu nháp khi rời/đóng tab. Không await được, chỉ đảm bảo trình
   * duyệt enqueue request nếu còn cho phép network trong unload/pagehide.
   */
  saveDraftOnUnload: (submissionId: number, answers: DraftAnswer[]): boolean => {
    if (!answers.length) return true;
    try {
      const baseUrl =
        (import.meta.env.VITE_API_URL as string | undefined) ||
        (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
        '';
      const url = `${baseUrl}/student/tests/${submissionId}/draft`;
      const token = getAuthToken();
      const body = JSON.stringify({ answers });

      if (typeof fetch === 'function') {
        try {
          void fetch(url, {
            method: 'POST',
            keepalive: true,
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body,
          }).catch(() => undefined);
          return true;
        } catch {
          /* fall through */
        }
      }

      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const beaconUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
        const blob = new Blob([body], { type: 'application/json' });
        return navigator.sendBeacon(beaconUrl, blob);
      }
      return false;
    } catch (err) {
      console.warn('[studentApi.saveDraftOnUnload] failed', err);
      return false;
    }
  },

  /**
   * Ping nhỏ để cập nhật `last_activity_at`. Trả về `timeRemaining`,
   * `serverTime` để FE hiệu chỉnh đồng hồ. BE tự auto-submit nếu hết giờ.
   */
  heartbeat: (submissionId: number) =>
    api.post<{
      status: string;
      timeRemaining: number;
      serverTime: string;
    }>(`/student/tests/${submissionId}/heartbeat`),

  /**
   * Mục tiêu của `pagehide` / `visibilitychange === hidden`.
   *
   * Ưu tiên `fetch(..., { keepalive: true })` để giữ được header Authorization
   * (sendBeacon không gửi custom headers). Fallback sang `navigator.sendBeacon`
   * với token đính kèm dạng query khi `keepalive` không khả dụng.
   *
   * Trả về `true` nếu đã enqueue thành công (không đảm bảo BE xử lý xong).
   */
  autoSubmitOnUnload: (
    submissionId: number,
    payload: { reason: AutoSubmitReason; answers?: DraftAnswer[] },
  ): boolean => {
    try {
      const baseUrl =
        (import.meta.env.VITE_API_URL as string | undefined) ||
        (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
        '';
      const url = `${baseUrl}/student/tests/${submissionId}/auto-submit`;
      const token = getAuthToken();
      const body = JSON.stringify(payload);

      // Đường ưu tiên: fetch keepalive — preserved trên Chromium/Firefox/Safari.
      if (typeof fetch === 'function') {
        try {
          void fetch(url, {
            method: 'POST',
            keepalive: true,
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body,
          }).catch(() => undefined);
          return true;
        } catch {
          /* fall through */
        }
      }

      // Fallback: sendBeacon — không có custom headers, token đi qua query.
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const beaconUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
        const blob = new Blob([body], { type: 'application/json' });
        return navigator.sendBeacon(beaconUrl, blob);
      }
      return false;
    } catch (err) {
      console.warn('[studentApi.autoSubmitOnUnload] failed', err);
      return false;
    }
  },

  // Practice
  getPracticeTopics: () =>
    api.get('/student/practice/topics'),

  getPracticeQuestions: (params: { topic_id?: number; skill?: string; difficulty?: string; count?: number }) =>
    api.get('/student/practice/questions', { params }),

  createPracticeSession: (data: { topic_id?: number; question_count: number; difficulty?: string }) =>
    api.post('/student/practice/sessions', data),

  savePracticeAnswer: (sessionId: number, data: { question_id: number; answer_id?: number; answer_text?: string }) =>
    api.post(`/student/practice/sessions/${sessionId}/answer`, data),

  completePracticeSession: (sessionId: number) =>
    api.post(`/student/practice/sessions/${sessionId}/complete`),

  // Notifications
  getNotifications: (params?: { page?: number; per_page?: number; urgent?: boolean; limit?: number }) =>
    api.get('/student/notifications', { params }),

  markNotificationRead: (id: number) =>
    api.put(`/student/notifications/${id}/read`),

  markAllNotificationsRead: () =>
    api.put('/student/notifications/read-all'),

  deleteNotification: (id: number) =>
    api.delete(`/student/notifications/${id}`),

  // Teacher reminders
  getReminders: () =>
    api.get('/student/reminders'),

  markReminderRead: (id: number) =>
    api.put(`/student/reminders/${id}/read`),

  dismissReminder: (id: number) =>
    api.delete(`/student/reminders/${id}`),

  // Lịch thi sắp tới do giáo viên đặt (popup nhắc nhở trên dashboard)
  getExamSchedules: () =>
    api.get<{ status: string; data: { schedules: ExamSchedule[]; count: number } }>(
      '/student/exam-schedules'
    ),

  // Dashboard specific APIs
  getInProgressTests: () =>
    api.get<{ status: string; data: InProgressTest[] }>('/student/tests/in-progress'),

  getUpcomingTests: (params?: { days?: number }) =>
    api.get<{ status: string; data: UpcomingTest[] }>('/student/tests/upcoming', { params }),

  // Daily activity (for "Mục tiêu hôm nay" ring)
  getTodayActivity: () =>
    api.get<{ status: string; data: TodayActivity }>('/student/analytics/today'),

  getLeaderboard: (params?: { limit?: number }) =>
    api.get('/student/gamification/leaderboard', { params }),

  getGamificationOverview: () =>
    api.get('/student/gamification/overview'),

  getStreak: () =>
    api.get('/student/gamification/streak'),

  getSessions: () =>
    api.get('/student/profile/sessions'),

  revokeSession: (id: number) =>
    api.delete(`/student/profile/sessions/${id}`),

  revokeAllSessions: () =>
    api.delete('/student/profile/sessions'),

  getAchievements: () =>
    api.get('/student/gamification/achievements'),

  getPracticeRecommendations: () =>
    api.get('/student/recommendations/practice'),

  // Profile
  getProfile: () =>
    api.get('/student/profile'),

  updateProfile: (data: any) =>
    api.put('/student/profile', data),

  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post('/student/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  changePassword: (data: { current_password: string; new_password: string; new_password_confirmation: string }) =>
    api.put('/student/profile/password', data),

  // Settings
  getSettings: () =>
    api.get('/student/settings'),

  updateSettings: (data: any) =>
    api.put('/student/settings', data),

  // Exam browser — public VSTEP/IELTS exams for adults
  browseExams: (params?: { type?: 'VSTEP' | 'IELTS' }) =>
    api.get<{ status: string; data: BrowseExam[] }>('/student/exams/browse', { params }),

  // Kids exam browser — TẤT CẢ đề Cambridge YL đã publish (kèm cờ is_assigned)
  browseKidsExams: () =>
    api.get<{ status: string; data: BrowseKidsExam[] }>('/student/exams/browse-kids'),

  // Teens exam browser — TẤT CẢ đề teens đã publish (kèm cờ is_assigned)
  browseTeensExams: () =>
    api.get<{ status: string; data: BrowseTeensExam[] }>('/student/exams/browse-teens'),

  // Kids direct exam — start/resume by exam ID (no assignment needed)
  startKidsExamDirect: (examId: number) =>
    api.post(`/student/exams/${examId}/start-kids`),

  // Teens direct exam — start/resume by exam ID (no assignment needed)
  startTeensExamDirect: (examId: number) =>
    api.post(`/student/exams/${examId}/start-teens`),

  // VSTEP/IELTS direct exam — start by exam ID (no assignment needed)
  // For IELTS practice mode, pass `practiceScope` so backend persists scope to
  // submission_payload — that way "Tiếp tục bài đang làm" rebuilds the right
  // URL (?mode=practice&sections=...&time=...) instead of falling back to
  // full_test (which would render all questions and grade incorrectly).
  startDirectVstepExam: (
    examId: number,
    resume = false,
    fresh = false,
    practiceScope?: { skill: string; sections: number[]; time: number | null } | null,
  ) =>
    api.post<{ status: string; data: { submissionId: number; timeRemaining: number; time_remaining?: number; started_at?: string; total_duration?: number; sStatus?: string; practice_scope?: { skill: string; sections: number[]; time: number | null } | null } }>(
      `/student/exams/${examId}/start-direct${resume || fresh ? `?${new URLSearchParams({ ...(resume ? { resume: '1' } : {}), ...(fresh ? { fresh: '1' } : {}) }).toString()}` : ''}`,
      practiceScope ? { practice_scope: practiceScope } : {},
    ),

  loadStudentVstepListening: (examId: number) =>
    api.get(`/student/exams/${examId}/vstep/listening`),

  loadStudentVstepReading: (examId: number) =>
    api.get(`/student/exams/${examId}/vstep/reading`),

  loadStudentVstepWriting: (examId: number) =>
    api.get(`/student/exams/${examId}/vstep/writing`),

  loadStudentVstepSpeaking: (examId: number) =>
    api.get(`/student/exams/${examId}/vstep/speaking`),

  // ─── IELTS student loading APIs ────────────────────────────────────────
  loadStudentIeltsListening: (examId: number) =>
    api.get(`/student/exams/${examId}/ielts/listening`),

  loadStudentIeltsReading: (examId: number) =>
    api.get(`/student/exams/${examId}/ielts/reading`),

  loadStudentIeltsWriting: (examId: number) =>
    api.get(`/student/exams/${examId}/ielts/writing`),

  loadStudentIeltsSpeaking: (examId: number) =>
    api.get(`/student/exams/${examId}/ielts/speaking`),

  uploadCheckinPhoto: (examId: number, blob: Blob) => {
    const form = new FormData();
    form.append('photo', blob, `checkin_${examId}.jpg`);
    return api.post(`/student/exams/${examId}/checkin-photo`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  uploadSpeakingAudio: (submissionId: number, partNumber: number, blob: Blob) => {
    const form = new FormData();
    form.append('audio', blob, `speaking_${submissionId}_part${partNumber}.webm`);
    return api.post(`/student/submissions/${submissionId}/speaking/${partNumber}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Reading Highlights
  getHighlights: (examId: number, partNumber: number) =>
    api.get(`/student/exams/${examId}/highlights`, { params: { part: partNumber } }),

  saveHighlight: (examId: number, data: {
    skill: string;
    part_number: number;
    start_offset: number;
    end_offset: number;
    color: string;
    selected_text: string;
  }) => api.post(`/student/exams/${examId}/highlights`, data),

  deleteHighlight: (examId: number, highlightId: number) =>
    api.delete(`/student/exams/${examId}/highlights/${highlightId}`),

  // Vocab Notes
  getVocab: (examId: number) =>
    api.get(`/student/exams/${examId}/vocab`),

  saveVocab: (examId: number, word: string, context?: string) =>
    api.post(`/student/exams/${examId}/vocab`, { word, context }),

  deleteVocab: (examId: number, vocabId: number) =>
    api.delete(`/student/exams/${examId}/vocab/${vocabId}`),
};

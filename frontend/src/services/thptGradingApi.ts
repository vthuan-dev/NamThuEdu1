import { api } from './api';

/**
 * THPT (Teens) teacher grading API client.
 *
 * Backend endpoints (under /teacher/):
 *   GET  /thpt-submissions/:id/grading   → normalized grading payload
 *   POST /thpt-submissions/:id/grading   → save teacher overrides / publish
 *
 * THPT stores all grading inside `submission_payload` + `sGemini_feedback`
 * (NOT the `submission_answers` table), so this is fully separate from the
 * VSTEP/IELTS grading flow.
 */

// ─── Shared score / criteria types ──────────────────────────────────────────
export interface Criteria {
  pronunciation?: number | null;
  content?: number | null;
}

export interface AiResult {
  score: number | null;
  criteria: Criteria;
  feedback: string | null;
  suggestions: string[];
  transcript?: string | null;
  /** Writing AI: 4 tiêu chí chi tiết (Task Response, Coherence, Lexical, Grammar) */
  criteria_detail?: Record<string, number | null> | null;
  criterion_comments?: Record<string, string | null> | null;
  word_count?: number | null;
}

export interface TeacherResult {
  score: number | null;
  criteria: Criteria;
  feedback: string | null;
  reviewed_at?: string | null;
}

export type SubjectiveStatus = 'ai_graded' | 'ai_pending' | 'no_ai';

export interface SubjectiveQuestion {
  question_number: number;
  skill: 'speaking' | 'writing';
  prompt: string;
  audio_url: string | null;
  /** Bài viết / text học viên (writing); speaking thường null */
  student_answer?: string | null;
  status: SubjectiveStatus;
  ai: AiResult | null;
  teacher: TeacherResult | null;
}

// ─── Objective question kinds ───────────────────────────────────────────────
export interface McqOption {
  id: string;
  text: string;
  underline?: string;
  /** Vị trí bắt đầu phần đánh dấu trong `text` (để định vị chính xác khi lặp chuỗi con). */
  underlineStart?: number;
}

export interface McqQuestion {
  question_number: number;
  key: string;
  kind: 'mcq';
  prompt: string | null;
  options: McqOption[];
  student_answer: string | null;
  correct_answer: string | null;
  is_correct: boolean;
  /** Chỉ có với câu ngữ âm: 'pronunciation' | 'stress'. Dùng để quyết định tự dò đuôi. */
  variant?: string;
}

export interface TextQuestion {
  question_number: number;
  key: string;
  kind: 'text';
  prompt: string | null;
  options: never[];
  student_answer: string | null;
  correct_answer: string;
  accepted_answers: string[];
  is_correct: boolean;
  root_word?: string | null;
  lead_in?: string | null;
  prompt_word?: string | null;
}

export interface TfStatement {
  key: string;
  text: string;
  student_answer: boolean | null;
  correct_answer: boolean;
  is_correct: boolean;
}

export interface TfGroupQuestion {
  question_number: number;
  kind: 'tf_group';
  context?: string;
  context_style?: string | null;
  context_paragraph_ref?: string | null;
  statements: TfStatement[];
}

export interface MatchingRow {
  key: string;
  index: number;
  text: string;
  student_answer: string | null;
  correct_answer: string | null;
  is_correct: boolean;
}

export interface MatchingQuestion {
  question_number: number;
  kind: 'matching';
  list_1: string[];
  list_2: string[];
  rows: MatchingRow[];
}

export interface SentenceInsertionQuestion {
  question_number: number;
  key: string;
  kind: 'sentence_insertion';
  prompt: string;
  sentence_to_insert: string;
  markers: string[];
  student_answer: string | null;
  correct_answer: string | null;
  is_correct: boolean;
}

export type ObjectiveQuestion =
  | McqQuestion
  | TextQuestion
  | TfGroupQuestion
  | MatchingQuestion
  | SentenceInsertionQuestion;

export interface SectionScore {
  correct_count: number;
  total_count: number;
  raw_score: number;
  raw_max: number;
}

export interface GradingSection {
  section_id: string | null;
  type: string;
  title: string;
  instructions: string | null;
  kind: 'objective' | 'subjective';
  score: SectionScore | null;
  passage?: string | null;
  audio_url?: string | null;
  word_bank?: string[];
  questions: ObjectiveQuestion[] | SubjectiveQuestion[];
}

export interface ObjectiveSummary {
  raw_score: number | null;
  raw_score_max: number | null;
  scaled_score: number | null;
  scale_max: number | null;
}

export interface GradingData {
  submission_id: number;
  exam: { id: number | null; title: string | null; type: string | null };
  student: {
    id: number | null;
    name: string | null;
    phone?: string | null;
    email?: string | null;
    gender?: boolean | null;
    address?: string | null;
    dob?: string | null;
    class_name?: string | null;
    age_group?: string | null;
  };
  submitted_at: string | null;
  status: string | null;
  ai_speaking_pending: boolean;
  objective: ObjectiveSummary;
  overall_teacher_feedback: string | null;
  current_total: number | null;
  /** Điểm tổng ghi đè của giáo viên (nếu đã lưu trước đó). */
  teacher_override_score?: number | null;
  answers: Record<string, unknown>;
  correct_answers: Record<string, unknown>;
  answer_overrides?: Record<string, boolean>;
  correct_overrides?: Record<string, string>;
  subjective_questions: SubjectiveQuestion[];
  sections: GradingSection[];
  // Present only on save() response:
  sScore?: number | null;
  speaking_score?: number | null;
  scaled_score?: number | null;
}

export interface SaveQuestionPayload {
  question_number: number;
  teacher_score: number;
  teacher_criteria?: { pronunciation?: number; content?: number };
  teacher_feedback?: string;
}

export interface SaveGradingBody {
  questions: SaveQuestionPayload[];
  overall_teacher_feedback?: string;
  /** Điểm tổng ghi đè (0–10). null/undefined = không ghi đè (dùng điểm tự động). */
  teacher_override_score?: number | null;
  publish: boolean;
  answer_overrides?: Record<string, boolean>;
  correct_overrides?: Record<string, string>;
  objective_raw_score?: number | null;
  objective_raw_max?: number | null;
  objective_scaled_score?: number | null;
}

export const thptGradingApi = {
  getGrading: async (submissionId: number): Promise<GradingData> => {
    const r = await api.get(`/teacher/thpt-submissions/${submissionId}/grading`);
    return r.data?.data;
  },

  saveGrading: async (submissionId: number, body: SaveGradingBody): Promise<GradingData> => {
    const r = await api.post(`/teacher/thpt-submissions/${submissionId}/grading`, body);
    return r.data?.data;
  },
};

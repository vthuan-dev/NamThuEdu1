/**
 * TypeScript Type Definitions for Teacher API
 * Comprehensive interfaces for all teacher-related data structures
 */

import type { ApiResponse, PaginatedResponse } from './index';

export type { ApiResponse, PaginatedResponse };

// ============================================================================
// Error Types
// ============================================================================

/** Shape của response lỗi validation 400 (Laravel: message + errors map). */
export interface ValidationError {
  message?: string;
  errors?: Record<string, string[]>;
}

// ============================================================================
// Course Types
// ============================================================================

export interface EnrollmentStats {
  current_students: number;
  max_students: number;
  available_slots: number;
  is_full: boolean;
}

export interface Course {
  id: number;
  courseName: string;
  numberOfStudent: number;
  time: string;
  category: string;
  schedule: string;
  startDate: string;
  endDate: string;
  description: string;
  courseType: string;
  enrollment_stats: EnrollmentStats;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCourseRequest {
  courseName: string;
  numberOfStudent: number;
  time: string;
  category: string;
  schedule: string;
  startDate: string;
  endDate: string;
  description: string;
  courseType: string;
}

export interface UpdateCourseRequest extends Partial<CreateCourseRequest> {}

export interface EnrollStudentRequest {
  student_id: number;
  fee_paid: boolean;
  enrollment_date?: string;
}

export interface CourseStatistics {
  total_courses: number;
  active_courses: number;
  total_enrollments: number;
  average_students_per_course: number;
}

// ============================================================================
// Class Types
// ============================================================================

export interface ClassEnrollmentStats {
  total_students: number;
  active_students: number;
}

export interface Class {
  id: number;
  cName: string;
  cDescription: string;
  cStatus: 'active' | 'inactive' | 'completed';
  course: Course;
  enrollment_stats: ClassEnrollmentStats;
  created_at?: string;
  updated_at?: string;
}

export interface CreateClassRequest {
  cName: string;
  cDescription: string;
  cStatus: 'active' | 'inactive' | 'completed';
  course_id: number;
}

export interface UpdateClassRequest extends Partial<CreateClassRequest> {}

export interface TransferStudentsRequest {
  from_class_id: number;
  to_class_id: number;
  student_ids: number[];
  reason: string;
  notes?: string;
}

export interface TransferHistory {
  id: number;
  from_class: Class;
  to_class: Class;
  student: Student;
  reason: string;
  notes?: string;
  direction: 'incoming' | 'outgoing';
  transferred_at: string;
}

export type ClassTransferHistory = TransferHistory;

export interface EnrollStudentsRequest {
  student_ids: number[];
}

export interface ClassStatistics {
  total_classes: number;
  active_classes: number;
  total_students: number;
  average_students_per_class: number;
}

// ============================================================================
// Student Types
// ============================================================================

export interface Student {
  id: number;
  studentName: string;
  studentPhone: string;
  studentDoB: string;
  studentAddress: string;
  studentGender: 'male' | 'female' | 'other';
  studentStatus: 'active' | 'inactive';
  classId: number;
  class?: Class;
  created_at?: string;
  updated_at?: string;
}

export interface CreateStudentRequest {
  studentName: string;
  studentPhone: string;
  studentDoB: string;
  studentAddress: string;
  studentGender: 'male' | 'female' | 'other';
  studentStatus: 'active' | 'inactive';
  classId: number;
}

export interface UpdateStudentRequest extends Partial<CreateStudentRequest> {}

export interface BulkImportResult {
  success_count: number;
  errors: Array<{
    row: number;
    data: any;
    errors: string[];
  }>;
}

export interface StudentStatistics {
  total_students: number;
  active_students: number;
  inactive_students: number;
  gender_distribution: {
    male: number;
    female: number;
    other: number;
  };
  age_groups: {
    [key: string]: number;
  };
  by_class: Array<{
    class_id: number;
    class_name: string;
    student_count: number;
  }>;
}

// ============================================================================
// Exam Types
// ============================================================================

export interface Answer {
  aId: number;
  aContent: string;
  aIs_correct: boolean;
  aOrder?: number;
}

export interface Question {
  qId: number;
  qContent: string;
  qType: 'multiple_choice' | 'true_false' | 'fill_blank' | 'essay' | 'short_answer' | 
         'listening_multiple_choice' | 'listening_fill_blank' | 'listening_matching' |
         'reading_multiple_choice' | 'reading_true_false' | 'reading_matching' |
         'writing_essay' | 'writing_short_answer' | 'speaking_response';
  qPoints: number;
  qMedia_url?: string;
  qTranscript?: string;
  qExplanation?: string;
  qListen_limit?: number;
  qOrder?: number;
  answers: Answer[];
}

export interface Exam {
  eId: number;
  eTitle: string;
  eDescription: string;
  eType: string;
  eSkill: 'listening' | 'reading' | 'writing' | 'speaking' | 'mixed';
  eScope?: 'full' | 'skill' | 'part';
  ePart_type?: string | null;
  ePart_number?: number | null;
  eDuration_minutes: number;
  eIs_private: boolean;
  eSource_type: 'manual' | 'template' | 'imported';
  eStatus?: 'draft' | 'published' | 'archived';
  questions: Question[];
  created_at?: string;
  updated_at?: string;
}

export interface CreateExamRequest {
  eTitle: string;
  eDescription: string;
  eType: string;
  eSkill: 'listening' | 'reading' | 'writing' | 'speaking' | 'mixed';
  eScope?: 'full' | 'skill' | 'part';
  ePart_type?: string | null;
  ePart_number?: number | null;
  eDuration_minutes: number;
  eIs_private: boolean;
  eSource_type?: 'manual' | 'template' | 'imported';
  age_group?: 'kids' | 'teens' | 'adults' | 'all';
}

export interface UpdateExamRequest extends Partial<CreateExamRequest> {}

export interface AddQuestionsRequest {
  questions: Array<{
    qContent: string;
    qType: Question['qType'];
    qPoints: number;
    qMedia_url?: string;
    qTranscript?: string;
    qExplanation?: string;
    qListen_limit?: number;
    qOrder?: number;
    answers: Array<{
      aContent: string;
      aIs_correct: boolean;
      aOrder?: number;
    }>;
  }>;
}

export interface ExamSection {
  skill: string;
  questions: Question[];
  total_points: number;
}

// ============================================================================
// Exam Template Types
// ============================================================================

export interface ExamTemplate {
  id: number;
  name: string;
  description: string;
  category: 'cambridge' | 'ielts' | 'vstep' | 'custom';
  level: string;
  duration_minutes: number;
  sections: TemplateSection[];
  created_at?: string;
}

export interface TemplateSection {
  id: number;
  skill: string;
  question_count: number;
  total_points: number;
}

export interface CreateFromTemplateRequest {
  template_id: number;
  title: string;
  description: string;
  customize_duration?: boolean;
  custom_duration_minutes?: number;
}

// ============================================================================
// Assignment Types
// ============================================================================

export interface TestAssignment {
  taId: number;
  taTarget_type: 'class' | 'student';
  taTarget_id: number;
  taDeadline: string;
  taMax_attempt: number;
  taIs_public: boolean;
  exam: Exam;
  completion_rate: number;
  is_overdue: boolean;
  time_remaining: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateAssignmentRequest {
  exam_id: number;
  target_type: 'class' | 'student';
  target_id: number;
  deadline: string;
  max_attempt: number;
  is_public: boolean;
}

export interface BulkAssignRequest {
  exam_id: number;
  targets: Array<{
    target_type: 'class' | 'student';
    target_id: number;
  }>;
  deadline: string;
  max_attempt: number;
  is_public: boolean;
}

export interface AssignmentProgress {
  assignment: TestAssignment;
  completed: Array<{
    student: Student;
    submission: Submission;
  }>;
  not_completed: Student[];
}

export interface AssignmentStatistics {
  total_assignments: number;
  active_assignments: number;
  overdue_assignments: number;
  average_completion_rate: number;
}

// ============================================================================
// Submission & Grading Types
// ============================================================================

export interface SubmissionAnswer {
  saId: number;
  saAnswer_text: string;
  saScore: number;
  saFeedback: string | null;
  question: Question;
}

export interface Submission {
  sId: number;
  sScore: number;
  sStatus: 'submitted' | 'graded' | 'partially_graded' | 'in_progress';
  sSubmit_time: string;
  sGraded_time: string | null;
  sAttempt: number;
  sTime_taken: number;
  sTeacher_feedback: string | null;
  user: Student;
  exam: Exam;
  answers: SubmissionAnswer[];
}

export interface GradeSubmissionRequest {
  score: number;
  feedback?: string;
  teacher_feedback?: string;
  question_scores?: Array<{
    question_id: number;
    score: number;
    feedback?: string;
  }>;
}

export interface DetailedGradeRequest {
  question_grades: Array<{
    question_id: number;
    score: number;
    feedback: string;
  }>;
  overall_feedback: string;
  strengths: string[];
  improvements: string[];
}

export interface ClassReport {
  class: Class;
  exam: Exam;
  statistics: {
    total_submissions: number;
    average_score: number;
    pass_rate: number;
    score_distribution: {
      [range: string]: number;
    };
  };
  student_rankings: Array<{
    rank: number;
    student: Student;
    score: number;
    submission_time: string;
  }>;
}

export interface GradingStatistics {
  total_submissions: number;
  graded_submissions: number;
  pending_submissions: number;
  average_grading_time: number;
  auto_graded_count: number;
  manual_graded_count: number;
}

// ============================================================================
// Monitoring Types
// ============================================================================

export interface ActiveSession {
  submission_id: number;
  user: {
    uId: number;
    uName: string;
    uPhone: string;
  };
  exam: {
    eId: number;
    eTitle: string;
    total_questions?: number;
  };
  connection_status: 'connected' | 'disconnected';
  last_seen: string;
  time_elapsed: number;
  time_remaining: number;
  answers_count: number;
  connection_count: number;
  disconnection_count: number;
}

export interface ConnectionLog {
  id: number;
  submission_id: number;
  event_type: 'connect' | 'disconnect' | 'reconnect';
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
}

export interface TestStatistics {
  exam_id?: number;
  exam_title?: string;
  total_active_sessions: number;
  total_completed: number;
  average_progress: number;
  average_time_taken: number;
  // Dashboard stats
  total_courses?: number;
  new_courses_this_month?: number;
  total_classes?: number;
  new_classes_this_month?: number;
  total_students?: number;
  new_students_this_month?: number;
  total_exams?: number;
  new_exams_this_month?: number;
  classes_today?: number;
  pending_grading?: number;
  deadlines_this_week?: number;
  average_score?: number;
  score_improvement?: number;
  // RealtimeStats
  total_started?: number;
  in_progress?: number;
  completed?: number;
  average_time_spent?: string;
  active_students_over_time?: Array<{ time: string; count: number }>;
  questions_distribution?: Array<{ range: string; count: number }>;
  connection_status?: Array<{ name: string; value: number; color: string }>;
  question_analysis?: any[];
  student_progress?: any[];
}

export interface SendMessageRequest {
  submission_id: number;
  message: string;
}

// ============================================================================
// Practice Session Types
// ============================================================================

export interface PracticeSession {
  id: number;
  type: 'topic_based' | 'template_based' | 'random';
  topic?: string;
  template_id?: number;
  question_count: number;
  duration_minutes: number;
  created_at: string;
}

export interface CreateTopicPracticeRequest {
  topic: string;
  skill: string;
  question_count: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface CreateTemplatePracticeRequest {
  template_id: number;
  customize_duration?: boolean;
  custom_duration_minutes?: number;
}

export interface CreateRandomPracticeRequest {
  skill: string;
  question_count: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface PracticeStatistics {
  total_sessions: number;
  by_type: {
    topic_based: number;
    template_based: number;
    random: number;
  };
  average_duration: number;
}

// ============================================================================
// Blog & Content Types
// ============================================================================

export interface Post {
  id: number;
  title: string;
  content: string;
  excerpt?: string;
  category_id: number;
  category?: Category;
  author_id: number;
  status: 'draft' | 'published' | 'archived';
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
}

export interface CreatePostRequest {
  title: string;
  content: string;
  excerpt?: string;
  category_id: number;
  status: 'draft' | 'published';
}

export interface UpdatePostRequest extends Partial<CreatePostRequest> {}

// ============================================================================
// Report Types
// ============================================================================

export interface DashboardReport {
  overview: {
    total_students: number;
    total_courses: number;
    total_exams: number;
    total_submissions: number;
  };
  recent_activity: Array<{
    type: string;
    description: string;
    timestamp: string;
  }>;
  trends: {
    student_growth: number;
    submission_rate: number;
    average_score: number;
  };
}

export interface UserStatistics {
  period: '7d' | '30d' | '90d' | '1y';
  user_id: number;
  total_submissions: number;
  average_score: number;
  progress_trend: Array<{
    date: string;
    score: number;
  }>;
  skill_breakdown: {
    listening: number;
    reading: number;
    writing: number;
    speaking: number;
  };
}

export interface ActivityReport {
  period: '7d' | '30d' | '90d' | '1y';
  total_activities: number;
  by_type: {
    [key: string]: number;
  };
  timeline: Array<{
    date: string;
    count: number;
  }>;
}

export interface ExportReportRequest {
  type: 'students' | 'courses' | 'submissions' | 'grades';
  format: 'json' | 'csv' | 'pdf';
  period?: '7d' | '30d' | '90d' | '1y';
  filters?: Record<string, any>;
}

// ============================================================================
// Additional Request/Response Types
// ============================================================================

export interface CreateQuestionRequest {
  qContent: string;
  qType: string;
  qPoints: number;
  qMedia_url?: string;
  qTranscript?: string;
  qExplanation?: string;
  qListen_limit?: number;
  answers: Array<{
    aContent: string;
    aIs_correct: boolean;
  }>;
}

export interface UpdateQuestionRequest extends Partial<CreateQuestionRequest> {}

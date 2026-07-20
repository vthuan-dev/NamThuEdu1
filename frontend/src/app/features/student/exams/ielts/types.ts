/**
 * IELTS student exam — shared types.
 *
 * Mirrors the JSON shape returned by `loadIeltsListening/Reading/Writing/Speaking`
 * in `StudentTestController.php`.
 */

export type IeltsSkill = "listening" | "reading" | "writing" | "speaking";
export type IeltsTestType = "Academic" | "General Training";

// ─── Question types ────────────────────────────────────────────────────────
export type IeltsQuestionType =
  | "multiple_choice"
  | "true_false_not_given"
  | "yes_no_not_given"
  | "matching"
  | "matching_headings"
  | "matching_information"
  | "matching_features"
  | "matching_sentence_endings"
  | "sentence_completion"
  | "summary_completion"
  | "note_completion"
  | "form_completion"
  | "table_completion"
  | "flow_chart_completion"
  | "short_answer"
  | "diagram_labelling"
  | "plan_map_diagram"
  | "image_completion"
  | "image-completion"
  | "essay"
  | "speaking";

export interface IeltsQuestion {
  qId: number;
  questionNumber: number;
  questionType: IeltsQuestionType;
  questionText: string;
  /** A/B/C/D options, only for MCQ-like types */
  options?: Record<string, string> | null;
  /** Extra metadata (without correct_answer): e.g. word_limit, choices for matching */
  data?: Record<string, any>;
  explanation?: string;
}

// ─── Listening ─────────────────────────────────────────────────────────────
export interface IeltsListeningSection {
  sectionNumber: 1 | 2 | 3 | 4;
  sectionName: string;
  audioUrl: string;
  audioDuration: number;
  questionStart: number;
  questionsPerSection: number;
  /** Instructions như "Complete the form below. Write NO MORE THAN TWO WORDS..." */
  instructions?: string;
  /** Context (e.g. "Conversation in everyday social context") */
  context?: string;
  /** Transcript — chỉ teacher thấy */
  transcript?: string | null;
  /** Loại câu hỏi: form_completion / note_completion / multiple_choice... */
  questionType?: string;
  questions: IeltsQuestion[];
}

export interface IeltsListeningPayload {
  exam_id: number;
  title: string;
  testType: IeltsTestType;
  totalQuestions: number;
  duration: number;
  sections: IeltsListeningSection[];
}

// ─── Reading ───────────────────────────────────────────────────────────────
export interface IeltsReadingPassage {
  passageNumber: 1 | 2 | 3;
  passageName: string;
  title: string;
  body: string;
  wordCount: number;
  questionStart: number;
  questionEnd: number;
  questions: IeltsQuestion[];
}

export interface IeltsReadingPayload {
  exam_id: number;
  title: string;
  testType: IeltsTestType;
  totalQuestions: number;
  duration: number;
  passages: IeltsReadingPassage[];
}

// ─── Writing ───────────────────────────────────────────────────────────────
export interface IeltsWritingTask {
  taskNumber: 1 | 2;
  taskName: string;
  prompt: string;
  imageUrl: string | null;
  /** Letter tone for General Training Task 1: 'formal' | 'semi-formal' | 'informal' */
  tone: string | null;
  /** Chart type for Academic Task 1: 'bar' | 'line' | 'pie' | 'table' | 'process' | 'map' */
  chartType: string | null;
  /** Essay type for Task 2 */
  essayType: string | null;
  minWords: number;
  recommendedMinutes: number;
  questionId: number;
  explanation?: string;
}

export interface IeltsWritingPayload {
  exam_id: number;
  title: string;
  testType: IeltsTestType;
  duration: number;
  tasks: IeltsWritingTask[];
}

// ─── Speaking ──────────────────────────────────────────────────────────────
export interface IeltsCueCard {
  topic: string;
  bullets: string[];
}

export interface IeltsSpeakingQuestionItem {
  qId: number;
  order: number;
  topic: string | null;
  text: string;
  explanation?: string;
}

export interface IeltsSpeakingPart {
  partNumber: 1 | 2 | 3;
  partName: string;
  recommendedMinutes: number;
  questions?: IeltsSpeakingQuestionItem[]; // Part 1 & 3
  cueCard?: IeltsCueCard;                  // Part 2 only
  questionId?: number;                     // Part 2 only
  prepSeconds?: number;                    // Part 2 only
  speakSeconds?: number;                   // Part 2 only
  explanation?: string;
}

export interface IeltsSpeakingPayload {
  exam_id: number;
  title: string;
  testType: IeltsTestType;
  duration: number;
  parts: IeltsSpeakingPart[];
}

// ─── Student answer storage ────────────────────────────────────────────────
export type AnswerValue = string | string[] | null;
export type AnswerMap = Record<number, AnswerValue>; // keyed by qId

// ─── Skill-specific timer config (in minutes) ──────────────────────────────
export const IELTS_SKILL_TIME: Record<IeltsSkill, number> = {
  listening: 30, // + 2 min check
  reading:   60,
  writing:   60,
  speaking:  14,
};

export const IELTS_TIMER_THRESHOLDS = {
  warning: 5 * 60, // 5 minutes
  danger:  60,     // 1 minute
};

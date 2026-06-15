// IELTS official exam structure (idp.com / britishcouncil)
// Used by IELTS editors to scaffold sections, durations, question counts,
// and band-score conversion logic.

export type IeltsSkill = "listening" | "reading" | "writing" | "speaking";
export type IeltsTestType = "Academic" | "General Training";

export interface IeltsPart {
  /** 1-indexed section/part number */
  part: number;
  /** Display name e.g. "Section 1", "Passage 1", "Task 1" */
  name: string;
  /** Number of questions/tasks in this part */
  questions: number;
  /** Short description for teachers */
  description: string;
  /** Optional minimum word count for Writing tasks */
  minWords?: number;
  /** Optional time recommended for this part */
  recommendedMinutes?: number;
}

export interface IeltsSkillStructure {
  name: string;
  /** Total minutes for this skill */
  duration: number;
  /** Total number of questions/tasks */
  totalQuestions: number;
  /** Whether structure is identical for Academic/General */
  sameForBothTestTypes: boolean;
  parts: IeltsPart[];
  /** Assessment criteria (mainly for Writing/Speaking) */
  assessmentCriteria?: string[];
  /** For Writing/Reading: differences between Academic vs General */
  variants?: {
    Academic: any;
    "General Training": any;
  };
}

export const IELTS_STRUCTURE: Record<IeltsSkill, IeltsSkillStructure> = {
  listening: {
    name: "Listening",
    duration: 40, // 30 phút nghe + 10 phút chuyển đáp án (chuẩn IELTS thực tế)
    totalQuestions: 40,
    sameForBothTestTypes: true,
    parts: [
      {
        part: 1,
        name: "Section 1",
        questions: 10,
        description: "Conversation in everyday social context (e.g. booking accommodation)",
      },
      {
        part: 2,
        name: "Section 2",
        questions: 10,
        description: "Monologue in everyday social context (e.g. tour guide speech)",
      },
      {
        part: 3,
        name: "Section 3",
        questions: 10,
        description: "Conversation in educational/training context (e.g. tutor + student)",
      },
      {
        part: 4,
        name: "Section 4",
        questions: 10,
        description: "Monologue on academic subject (e.g. university lecture)",
      },
    ],
  },
  reading: {
    name: "Reading",
    duration: 60,
    totalQuestions: 40,
    sameForBothTestTypes: false,
    variants: {
      Academic: "3 long academic texts (books, journals, magazines, newspapers)",
      "General Training":
        "Section 1: short everyday texts. Section 2: workplace texts. Section 3: longer general-interest text.",
    },
    parts: [
      {
        part: 1,
        name: "Passage 1",
        questions: 13,
        description: "Academic / everyday context (700–900 words)",
      },
      {
        part: 2,
        name: "Passage 2",
        questions: 13,
        description: "Academic / workplace context (700–900 words)",
      },
      {
        part: 3,
        name: "Passage 3",
        questions: 14,
        description: "Long academic text / general-interest topic (900–1100 words)",
      },
    ],
  },
  writing: {
    name: "Writing",
    duration: 60,
    totalQuestions: 2,
    sameForBothTestTypes: false,
    variants: {
      Academic: {
        task_1: "Describe visual info (chart, table, process, map) — 150 words minimum",
        task_2: "Essay — 250 words minimum",
      },
      "General Training": {
        task_1: "Write a letter (formal/semi-formal/informal) — 150 words minimum",
        task_2: "Essay — 250 words minimum",
      },
    },
    assessmentCriteria: [
      "Task Achievement / Task Response",
      "Coherence and Cohesion",
      "Lexical Resource",
      "Grammatical Range and Accuracy",
    ],
    parts: [
      {
        part: 1,
        name: "Task 1",
        questions: 1,
        description: "Letter / chart / report (~20 minutes)",
        minWords: 150,
        recommendedMinutes: 20,
      },
      {
        part: 2,
        name: "Task 2",
        questions: 1,
        description: "Essay (~40 minutes)",
        minWords: 250,
        recommendedMinutes: 40,
      },
    ],
  },
  speaking: {
    name: "Speaking",
    duration: 14, // 11–14 min, take upper bound
    totalQuestions: 3,
    sameForBothTestTypes: true,
    assessmentCriteria: [
      "Fluency and Coherence",
      "Lexical Resource",
      "Grammatical Range and Accuracy",
      "Pronunciation",
    ],
    parts: [
      {
        part: 1,
        name: "Part 1 — Introduction & Interview",
        questions: 1,
        description: "General questions about familiar topics (4–5 min)",
        recommendedMinutes: 5,
      },
      {
        part: 2,
        name: "Part 2 — Long Turn (Cue Card)",
        questions: 1,
        description: "Speak 1–2 min after 1 min preparation (3–4 min)",
        recommendedMinutes: 4,
      },
      {
        part: 3,
        name: "Part 3 — Discussion",
        questions: 1,
        description: "Two-way discussion related to Part 2 topic (4–5 min)",
        recommendedMinutes: 5,
      },
    ],
  },
};

// Band scale (0–9, step 0.5)
export const IELTS_BAND = {
  range: [0, 9] as [number, number],
  step: 0.5,
  /** average across 4 sections, rounded to nearest 0.5 */
  calculate: (scores: number[]): number | null => {
    const valid = scores.filter((s) => typeof s === "number" && !isNaN(s));
    if (valid.length === 0) return null;
    const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
    return Math.round(avg * 2) / 2;
  },
};

// IELTS Reading question types (most common)
export const IELTS_READING_QUESTION_TYPES = [
  { value: "multiple-choice", label: "Multiple choice (MCQ)" },
  { value: "true-false-not-given", label: "True / False / Not Given" },
  { value: "yes-no-not-given", label: "Yes / No / Not Given" },
  { value: "matching-headings", label: "Matching headings" },
  { value: "matching-information", label: "Matching information" },
  { value: "matching-features", label: "Matching features" },
  { value: "matching-sentence-endings", label: "Matching sentence endings" },
  { value: "sentence-completion", label: "Sentence completion" },
  { value: "summary-completion", label: "Summary / Note / Table / Flow-chart completion" },
  { value: "short-answer", label: "Short-answer questions" },
  { value: "diagram-labelling", label: "Diagram label completion" },
] as const;

// IELTS Listening question types (similar to Reading + audio specifics)
export const IELTS_LISTENING_QUESTION_TYPES = [
  { value: "multiple-choice", label: "Multiple choice (MCQ)" },
  { value: "form-completion", label: "Form completion" },
  { value: "note-completion", label: "Note completion" },
  { value: "table-completion", label: "Table completion" },
  { value: "flow-chart-completion", label: "Flow-chart completion" },
  { value: "summary-completion", label: "Summary completion" },
  { value: "sentence-completion", label: "Sentence completion" },
  { value: "short-answer", label: "Short-answer" },
  { value: "matching", label: "Matching" },
  { value: "plan-map-diagram", label: "Plan / map / diagram labelling" },
  { value: "image-completion", label: "🖼 Image / Table (upload ảnh đề)" },
] as const;

// Speaking Part 2 — typical Cue Card prompt structure
export const SPEAKING_CUE_CARD_TEMPLATE = {
  topic: "Describe a [person/place/object/event/experience].",
  bullets: [
    "Who/What it is",
    "When/Where you encountered it",
    "What happened / What you did",
    "And explain why it was important to you",
  ],
};

import { useState, useEffect, useMemo, type ReactElement } from "react";
import {
  BookOpen,
  Save,
  CheckCircle2,
  FileText,
  ListChecks,
  Trash2,
  Plus,
  Layers,
  X,
  Image as ImageIcon,
  Upload,
  ZoomIn,
  Loader2,
} from "lucide-react";
import { IELTS_STRUCTURE, IELTS_READING_QUESTION_TYPES, type IeltsTestType } from "../structure";
import { api } from "../../../../../../services/api";
import { useToastContext } from "../../../../../../contexts/ToastContext";
import { RichTextInput } from "../../../../../../components/ui/RichTextInput";

// ─── Types ───────────────────────────────────────────────────────────────
interface ReadingQuestion {
  id: string;
  questionText: string;
  /** Đáp án đúng. Multi-select lưu "A,C". Completion có thể lưu biến thể "20th/twentieth". */
  correctAnswer: string;
  /** Chỉ dùng cho MCQ — mỗi câu có bộ A/B/C/D… riêng. */
  options?: Record<string, string>;
  explanation?: string;
}

interface ReadingGroup {
  id: string;
  /** Dạng câu áp cho cả nhóm (multiple-choice, matching-features, …). */
  questionType: string;
  /** Chỉ dẫn của nhóm ("Classify the following as typical of…"). */
  instruction: string;
  /** Danh sách lựa chọn dùng chung — chỉ cho các dạng matching. */
  choices?: Record<string, string>;
  /** MCQ: số đáp án cần chọn (1 = chọn 1; 2 = "Choose TWO letters"…). */
  selectCount?: number;
  /** Completion/short-answer: giới hạn từ ("ONE WORD", "NO MORE THAN TWO WORDS"…). */
  wordLimit?: string;
  /** Completion: dùng word bank (chọn từ danh sách cho sẵn) thay vì gõ tự do. */
  useWordBank?: boolean;
  /** Ảnh sơ đồ/đề bài dùng chung của nhóm (diagram-labelling, v.v.) */
  taskImage?: string;
  /** Tên file ảnh gốc */
  taskImageFileName?: string;
  questions: ReadingQuestion[];
}

interface ReadingPassage {
  passageNumber: 1 | 2 | 3;
  title: string;
  body: string;
  wordCount: number;
  groups: ReadingGroup[];
}

interface Props {
  examId?: string;
  testType: IeltsTestType;
  initialData?: any;
  onSave: (data: any) => void;
  isFullTest?: boolean;
}

const PASSAGE_INFOS: Record<
  1 | 2 | 3,
  { name: string; desc: string; detail: string }
> = {
  1: {
    name: "Passage 1",
    desc: "Chủ đề phổ thông",
    detail: "Văn bản trích từ sách báo, tạp chí về chủ đề thường thức (750-900 từ, ~13 câu).",
  },
  2: {
    name: "Passage 2",
    desc: "Đời sống / Công sở",
    detail: "Văn bản liên quan đến công việc, đào tạo, nghiệp vụ hoặc tài liệu xã hội (750-900 từ, ~13 câu).",
  },
  3: {
    name: "Passage 3",
    desc: "Chuyên sâu học thuật",
    detail: "Văn bản học thuật mang tính phân tích, nghiên cứu chuyên sâu (800-1000 từ, ~14 câu).",
  },
};

// ─── Constants ─────────────────────────────────────────────────────────────
const MATCHING_TYPES = [
  "matching-headings",
  "matching-information",
  "matching-features",
  "matching-sentence-endings",
] as const;

const TRUE_FALSE_TYPES = ["true-false-not-given", "yes-no-not-given"];

// Các dạng điền từ — có giới hạn từ + chấp nhận biến thể đáp án.
const COMPLETION_TYPES = [
  "sentence-completion",
  "summary-completion",
  "short-answer",
  "diagram-labelling",
];

const TYPE_HINTS: Record<string, string> = {
  "multiple-choice": "Mỗi câu có bộ lựa chọn A/B/C/D riêng. Chọn số đáp án cần chọn ở phần cài đặt nhóm.",
  "true-false-not-given": "Thông tin Đúng / Sai / Không có trong bài.",
  "yes-no-not-given": "Quan điểm tác giả: Yes / No / Not Given.",
  "matching-headings": "Ghép tiêu đề (đánh số La Mã i, ii, iii) cho các đoạn — chọn từ danh sách chung.",
  "matching-information": "Tìm đoạn chứa thông tin — chọn chữ cái đoạn (A, B, C…).",
  "matching-features": "Phân loại mệnh đề vào nhóm A/B/C dùng chung.",
  "matching-sentence-endings": "Nối nửa câu với phần kết thúc đúng (A, B, C…).",
  "sentence-completion": "Điền từ còn thiếu. Đáp án có thể nhiều biến thể, ngăn bằng dấu /.",
  "summary-completion": "Điền vào summary / note / table / flow-chart. Biến thể ngăn bằng dấu /.",
  "short-answer": "Trả lời ngắn bằng từ/cụm từ trong bài. Biến thể ngăn bằng dấu /.",
  "diagram-labelling": "Điền nhãn cho sơ đồ. Biến thể ngăn bằng dấu /.",
};

const LETTER_SYMBOLS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const ROMAN_SYMBOLS = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];

const WORD_LIMIT_OPTIONS = [
  "",
  "ONE WORD ONLY",
  "ONE WORD AND/OR A NUMBER",
  "NO MORE THAN TWO WORDS",
  "NO MORE THAN TWO WORDS AND/OR A NUMBER",
  "NO MORE THAN THREE WORDS",
  "NO MORE THAN THREE WORDS AND/OR A NUMBER",
];

const isMatchingType = (t: string) =>
  (MATCHING_TYPES as readonly string[]).includes(t);
const isCompletionType = (t: string) => COMPLETION_TYPES.includes(t);
// Matching headings dùng số La Mã; các matching khác dùng chữ cái.
const symbolsFor = (t: string) =>
  t === "matching-headings" ? ROMAN_SYMBOLS : LETTER_SYMBOLS;

function labelForType(value: string): string {
  return (
    IELTS_READING_QUESTION_TYPES.find((t) => t.value === value)?.label ?? value
  );
}

function countWords(text: string): number {
  if (!text) return 0;
  const plainText = text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;|&#xA0;/gi, " ")
    .replace(/[\u00A0\u202F\u2007\u00AD\u200B\u200C\u200D\u2060\uFEFF]/g, " ")
    .trim();
  return plainText.split(/\s+/).filter(Boolean).length;
}

let uidCounter = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${uidCounter++}`;

// ─── Builders / normalizers ─────────────────────────────────────────────────
function emptyQuestion(type: string): ReadingQuestion {
  return {
    id: uid("q"),
    questionText: "",
    correctAnswer: "",
    options: (type === "multiple-choice" || type === "multiple-choice-group") ? { A: "", B: "", C: "", D: "" } : undefined,
  };
}

function defaultChoices(type: string): Record<string, string> {
  const syms = symbolsFor(type).slice(0, 3);
  const obj: Record<string, string> = {};
  syms.forEach((s) => (obj[s] = ""));
  return obj;
}

function emptyGroup(type = "multiple-choice"): ReadingGroup {
  return {
    id: uid("g"),
    questionType: type,
    instruction: "",
    choices: isMatchingType(type) ? defaultChoices(type) : undefined,
    selectCount: (type === "multiple-choice" || type === "multiple-choice-group") ? 1 : undefined,
    wordLimit: isCompletionType(type) ? "" : undefined,
    taskImage: "",
    taskImageFileName: "",
    questions: [emptyQuestion(type)],
  };
}

function toQuestion(raw: any, type: string): ReadingQuestion {
  return {
    id: raw.id || uid("q"),
    questionText: raw.questionText || "",
    correctAnswer: raw.correctAnswer || "",
    options:
      (type === "multiple-choice" || type === "multiple-choice-group")
        ? raw.options && typeof raw.options === "object"
          ? { A: "", B: "", C: "", D: "", ...raw.options }
          : { A: "", B: "", C: "", D: "" }
        : undefined,
    explanation: raw.explanation || raw.qExplanation || "",
  };
}

/**
 * Suy ra danh sách nhóm từ mảng câu hỏi phẳng (đề cũ / import).
 * Gom các câu liền nhau cùng questionType + cùng chỉ dẫn + cùng ảnh.
 */
function deriveGroups(questions: any[]): ReadingGroup[] {
  const groups: ReadingGroup[] = [];
  for (const q of questions || []) {
    const type = q.questionType || "multiple-choice";
    const instr = q.taskInstruction || q.task_instruction || "";
    const taskImg = q.taskImage || q.task_image || "";
    const last = groups[groups.length - 1];
    const isGroupedMcq = type === "multiple-choice-group";
    const maxGroupSize = isGroupedMcq ? (last?.selectCount === 3 ? 3 : 2) : Infinity;

    // Với multiple-choice-group: không gom nếu nhóm trước đã đủ 2 hoặc 3 câu, hoặc đề bài khác nhau
    const canMerge =
      last &&
      last.questionType === type &&
      last.instruction === instr &&
      (last.taskImage || "") === taskImg &&
      (!isGroupedMcq || (
        last.questions.length < maxGroupSize &&
        (!q.questionText || !last.questions[0]?.questionText || q.questionText === last.questions[0]?.questionText)
      ));

    if (canMerge) {
      last.questions.push(toQuestion(q, type));
      if (
        isMatchingType(type) &&
        q.options &&
        (!last.choices || Object.keys(last.choices).length === 0)
      ) {
        last.choices = { ...q.options };
      }
    } else {
      groups.push({
        id: uid("g"),
        questionType: type,
        instruction: instr,
        taskImage: taskImg,
        taskImageFileName: q.taskImageFileName || q.task_image_file_name || "",
        choices: isMatchingType(type)
          ? q.options
            ? { ...q.options }
            : defaultChoices(type)
          : undefined,
        selectCount: (type === "multiple-choice" || type === "multiple-choice-group") ? (q.selectCount || 1) : undefined,
        wordLimit: isCompletionType(type) ? q.wordLimit || q.word_limit || "" : undefined,
        questions: [toQuestion(q, type)],
      });
    }
  }
  return groups;
}

function normalizeGroup(raw: any): ReadingGroup {
  const type = raw.questionType || "multiple-choice";
  return {
    id: raw.id || uid("g"),
    questionType: type,
    instruction: raw.instruction || "",
    selectCount: (type === "multiple-choice" || type === "multiple-choice-group") ? raw.selectCount || 1 : undefined,
    wordLimit: isCompletionType(type) ? raw.wordLimit || "" : undefined,
    useWordBank: isCompletionType(type) ? !!raw.useWordBank : undefined,
    taskImage: raw.taskImage || raw.task_image || "",
    taskImageFileName: raw.taskImageFileName || raw.task_image_file_name || "",
    choices:
      isMatchingType(type) || (isCompletionType(type) && raw.useWordBank)
        ? raw.choices && Object.keys(raw.choices).length
          ? { ...raw.choices }
          : defaultChoices(type)
        : undefined,
    questions: Array.isArray(raw.questions) && raw.questions.length
      ? raw.questions.map((q: any) => toQuestion(q, type))
      : [emptyQuestion(type)],
  };
}

function buildPassages(initialData: any): ReadingPassage[] {
  const arr = initialData?.passages;
  const existingMap = new Map<number, any>();
  if (Array.isArray(arr)) {
    arr.forEach((p: any, i: number) => {
      const num = Number(p?.passageNumber) || (i + 1);
      existingMap.set(num, p);
    });
  }

  return ([1, 2, 3] as const).map((n) => {
    const p = existingMap.get(n);
    if (p) {
      const body = p.body || p.passageText || "";
      const rawGroups =
        Array.isArray(p.groups) && p.groups.length
          ? p.groups.map(normalizeGroup)
          : deriveGroups(p.questions || []);

      // Tách bất kỳ nhóm multiple-choice-group nào có > 3 câu thành các nhóm 2 câu chuẩn
      const groups: ReadingGroup[] = [];
      rawGroups.forEach((g) => {
        if (g.questionType === "multiple-choice-group" && g.questions.length > 3) {
          for (let qi = 0; qi < g.questions.length; qi += 2) {
            groups.push({
              ...g,
              id: uid("g"),
              questions: g.questions.slice(qi, qi + 2),
            });
          }
        } else {
          groups.push(g);
        }
      });
      return {
        passageNumber: n,
        title: p.title || p.passageTitle || "",
        body,
        wordCount: p.wordCount || countWords(body),
        groups,
      };
    }
    return {
      passageNumber: n,
      title: "",
      body: "",
      wordCount: 0,
      groups: [],
    };
  });
}

/**
 * Flatten passages → payload backend (giữ `groups` để mở lại + `questions`
 * phẳng đã đánh số liên tục cho backend lưu DB).
 */
function flattenPassages(passages: ReadingPassage[]) {
  let n = 0;
  return passages.map((p) => {
    const questions: any[] = [];
    p.groups.forEach((g) => {
      const matching = isMatchingType(g.questionType);
      const wordBank = isCompletionType(g.questionType) && !!g.useWordBank;
        g.questions.forEach((q) => {
          n += 1;
          questions.push({
            id: q.id,
            questionNumber: n,
            questionType: g.questionType,
            questionText: q.questionText,
            taskInstruction: g.instruction || "",
            // Matching + word-bank completion đều dùng choices dùng chung làm options.
            options: matching || wordBank ? g.choices : q.options,
            correctAnswer: q.correctAnswer,
            wordLimit: g.wordLimit || "",
            selectCount: g.questionType === "multiple-choice-group" ? undefined : (g.selectCount || 1),
            useWordBank: wordBank,
            taskImage: g.taskImage || "",
            taskImageFileName: g.taskImageFileName || "",
            explanation: q.explanation || "",
          });
        });
    });
    return {
      passageNumber: p.passageNumber,
      title: p.title,
      body: p.body,
      wordCount: p.wordCount,
      groups: p.groups,
      questions,
    };
  });
}

// ─── Main editor ─────────────────────────────────────────────────────────────
export function IeltsReadingEditor({
  examId,
  initialData,
  onSave,
  testType,
  isFullTest = false,
}: Props) {
  const { success } = useToastContext();
  const [passages, setPassages] = useState<ReadingPassage[]>(() =>
    buildPassages(initialData)
  );

  const [activePassages, setActivePassages] = useState<Set<1 | 2 | 3>>(() => {
    if (isFullTest) return new Set<1 | 2 | 3>([1, 2, 3]);
    if (initialData?.passages?.length) {
      const activeNums = initialData.passages
        .filter((p: any, idx: number) => {
          if (idx === 0 || p.passageNumber === 1) return true;
          const hasBody = !!p.body?.trim() || !!p.passageText?.trim();
          const hasQs = (p.questions?.length > 0) || (p.groups?.length > 0);
          const hasTitle = !!p.title?.trim() || !!p.passageTitle?.trim();
          return hasBody || hasQs || hasTitle;
        })
        .map((p: any) => p.passageNumber as 1 | 2 | 3)
        .filter((n: number) => n >= 1 && n <= 3);
      if (activeNums.length) return new Set<1 | 2 | 3>(activeNums);
    }
    return new Set<1 | 2 | 3>([1]);
  });

  const [activePassage, setActivePassage] = useState<1 | 2 | 3>(() => {
    if (initialData?.passages?.length) {
      const first = initialData.passages[0]?.passageNumber;
      if (first >= 1 && first <= 3) return first as 1 | 2 | 3;
    }
    return 1;
  });

  const addPassage = (n: 1 | 2 | 3) => {
    setActivePassages((prev) => new Set(prev).add(n));
    setActivePassage(n);
  };

  const removePassage = (n: 1 | 2 | 3) => {
    setActivePassages((prev) => {
      const next = new Set(prev);
      next.delete(n);
      if (activePassage === n) {
        const remaining = [...next].sort((a, b) => a - b);
        setActivePassage((remaining[0] ?? 1) as 1 | 2 | 3);
      }
      return next;
    });
  };

  const current = passages.find((p) => p.passageNumber === activePassage)!;
  const currentIdx = passages.findIndex((p) => p.passageNumber === activePassage);
  const partInfo = IELTS_STRUCTURE.reading.parts[activePassage - 1];

  const passageStartNumbers = useMemo(() => {
    const res: number[] = [];
    let run = 1;
    passages.forEach((p) => {
      res.push(run);
      run += p.groups.reduce((s, g) => s + g.questions.length, 0);
    });
    return res;
  }, [passages]);

  const passageStart = passageStartNumbers[currentIdx] ?? 1;
  const groupStartNumbers = useMemo(() => {
    let acc = passageStart;
    return current.groups.map((g) => {
      const s = acc;
      acc += g.questions.length;
      return s;
    });
  }, [current.groups, passageStart]);

  const passageQuestionCount = current.groups.reduce(
    (s, g) => s + g.questions.length,
    0
  );

  // ── Mutations ──────────────────────────────────────────────────────────
  const updatePassage = (n: number, patch: Partial<ReadingPassage>) => {
    setPassages((prev) =>
      prev.map((p) => (p.passageNumber === n ? { ...p, ...patch } : p))
    );
  };

  const mutateGroups = (
    pNum: number,
    fn: (groups: ReadingGroup[]) => ReadingGroup[]
  ) => {
    setPassages((prev) =>
      prev.map((p) =>
        p.passageNumber === pNum ? { ...p, groups: fn([...p.groups]) } : p
      )
    );
  };

  const addGroup = (pNum: number) =>
    mutateGroups(pNum, (groups) => [...groups, emptyGroup()]);

  const removeGroup = (pNum: number, gIdx: number) =>
    mutateGroups(pNum, (groups) => groups.filter((_, i) => i !== gIdx));

  const updateGroup = (pNum: number, gIdx: number, patch: Partial<ReadingGroup>) =>
    mutateGroups(pNum, (groups) => {
      const g = { ...groups[gIdx], ...patch };
      if (patch.questionType && patch.questionType !== groups[gIdx].questionType) {
        const t = patch.questionType;
        g.choices = isMatchingType(t)
          ? g.choices && Object.keys(g.choices).length
            ? g.choices
            : defaultChoices(t)
          : undefined;
        if (t === "multiple-choice-group") {
          g.selectCount = undefined;
          const defaultOptions = { A: "", B: "", C: "", D: "", E: "" };
          const q0 = g.questions[0];
          const baseOpts =
            q0?.options && Object.keys(q0.options).length >= 5
              ? q0.options
              : defaultOptions;
          const q1 = g.questions[1] ?? {
            id: `rq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            questionText: q0?.questionText || "",
            options: { ...baseOpts },
            correctAnswer: "B",
          };
          g.questions = [
            {
              ...q0,
              options: { ...baseOpts },
              correctAnswer: q0?.correctAnswer?.trim() || "A",
            },
            {
              ...q1,
              options: { ...baseOpts },
              correctAnswer: q1.correctAnswer?.trim() || "B",
            },
          ];
        } else {
          g.selectCount = t === "multiple-choice" ? 1 : undefined;
          g.questions = g.questions.map((q) => ({
            ...q,
            options:
              t === "multiple-choice"
                ? q.options ?? { A: "", B: "", C: "", D: "" }
                : undefined,
            correctAnswer: "",
          }));
        }
      }
      // Bật/tắt word bank cho dạng completion.
      if (patch.useWordBank !== undefined && !patch.questionType) {
        if (patch.useWordBank) {
          g.choices =
            g.choices && Object.keys(g.choices).length
              ? g.choices
              : defaultChoices(g.questionType);
        } else {
          g.choices = undefined;
          // Đáp án cũ (chữ cái) không còn nghĩa khi tắt word bank.
          g.questions = g.questions.map((q) => ({ ...q, correctAnswer: "" }));
        }
      }
      groups[gIdx] = g;
      return groups;
    });

  const addQuestion = (pNum: number, gIdx: number) =>
    mutateGroups(pNum, (groups) => {
      const g = groups[gIdx];
      groups[gIdx] = {
        ...g,
        questions: [...g.questions, emptyQuestion(g.questionType)],
      };
      return groups;
    });

  const removeQuestion = (pNum: number, gIdx: number, qIdx: number) =>
    mutateGroups(pNum, (groups) => {
      const g = groups[gIdx];
      groups[gIdx] = {
        ...g,
        questions: g.questions.filter((_, i) => i !== qIdx),
      };
      return groups;
    });

  const setGroupSize = (pNum: number, gIdx: number, newSize: number) =>
    mutateGroups(pNum, (groups) => {
      const g = groups[gIdx];
      if (g.questionType !== "multiple-choice-group") return groups;
      const curQuestions = [...g.questions];
      const q0 = curQuestions[0];
      const baseOpts = q0?.options ?? { A: "", B: "", C: "", D: "", E: "" };
      const baseText = q0?.questionText ?? "";
      const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
      if (newSize > curQuestions.length) {
        while (curQuestions.length < newSize) {
          const nextIdx = curQuestions.length;
          curQuestions.push({
            id: `rq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            questionText: baseText,
            options: { ...baseOpts },
            correctAnswer: letters[nextIdx] ?? "",
          });
        }
      } else if (newSize < curQuestions.length) {
        curQuestions.splice(newSize);
      }
      groups[gIdx] = { ...g, questions: curQuestions };
      return groups;
    });

  const splitGroup = (pNum: number, gIdx: number) =>
    mutateGroups(pNum, (groups) => {
      const g = groups[gIdx];
      if (!g || g.questions.length <= 2) return groups;
      const firstChunk = g.questions.slice(0, 2);
      const secondChunk = g.questions.slice(2);
      const g1: ReadingGroup = { ...g, questions: firstChunk };
      const g2: ReadingGroup = {
        ...g,
        id: uid("g"),
        questions: secondChunk,
      };
      const nextGroups = [...groups];
      nextGroups.splice(gIdx, 1, g1, g2);
      return nextGroups;
    });

  const setGroupAnswers = (pNum: number, gIdx: number, selectedLetters: string[]) =>
    mutateGroups(pNum, (groups) => {
      const g = groups[gIdx];
      if (g.questionType !== "multiple-choice-group") return groups;
      const questions = g.questions.map((q, idx) => ({
        ...q,
        correctAnswer: selectedLetters[idx] ?? "",
      }));
      groups[gIdx] = { ...g, questions };
      return groups;
    });

  const updateQuestion = (
    pNum: number,
    gIdx: number,
    qIdx: number,
    patch: Partial<ReadingQuestion>
  ) =>
    mutateGroups(pNum, (groups) => {
      const g = groups[gIdx];
      const questions = [...g.questions];
      if (g.questionType === "multiple-choice-group") {
        if (qIdx === 0 && (patch.questionText !== undefined || patch.options !== undefined)) {
          const updatedQ0 = { ...questions[0], ...patch };
          questions[0] = updatedQ0;
          for (let i = 1; i < questions.length; i++) {
            questions[i] = {
              ...questions[i],
              ...(patch.options !== undefined ? { options: { ...patch.options } } : {}),
              ...(patch.questionText !== undefined ? { questionText: patch.questionText } : {}),
            };
          }
        } else {
          questions[qIdx] = { ...questions[qIdx], ...patch };
        }
      } else {
        questions[qIdx] = { ...questions[qIdx], ...patch };
      }
      groups[gIdx] = { ...g, questions };
      return groups;
    });

  useEffect(() => {
    const wc = countWords(current.body);
    if (wc !== current.wordCount) {
      updatePassage(current.passageNumber, { wordCount: wc });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.body]);

  useEffect(() => {
    onSave({
      passages: flattenPassages(
        passages.filter((p) => activePassages.has(p.passageNumber))
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passages, activePassages]);

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-emerald-50/50 border border-emerald-200 p-3 text-xs text-emerald-700">
        <strong>{testType}:</strong>{" "}
        {testType === "Academic"
          ? "3 đoạn văn học thuật từ sách báo, tạp chí (700–1100 từ mỗi đoạn)."
          : "Section 1: văn bản đời sống. Section 2: văn bản công sở. Section 3: bài đọc dài về chủ đề chung."}
        {" "}Mỗi passage chia thành các <strong>nhóm câu hỏi</strong> — mỗi nhóm 1 dạng câu + chỉ dẫn riêng.
      </div>

      {/* Passage tabs */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex flex-wrap items-stretch divide-x divide-gray-100">
          {passages
            .filter((p) => activePassages.has(p.passageNumber))
            .map((p, idx) => {
              const isActive = p.passageNumber === activePassage;
              const qCount = p.groups.reduce((s, g) => s + g.questions.length, 0);
              const hasBody = p.body.trim().length > 50;
              const start = passageStartNumbers[idx] ?? 1;
              const canRemove = !isFullTest && activePassages.size > 1;

              return (
                <div
                  key={p.passageNumber}
                  className="relative flex items-center flex-1 min-w-[180px]"
                  style={{
                    background: isActive ? "#ECFDF5" : "#FFFFFF",
                    borderBottom: isActive ? "3px solid #10B981" : "3px solid transparent",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActivePassage(p.passageNumber)}
                    className="flex-1 px-4 py-3 text-left transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-xs font-bold"
                        style={{ color: isActive ? "#047857" : "#6B7280" }}
                      >
                        Passage {p.passageNumber}
                      </span>
                      {hasBody && qCount > 0 && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-gray-500">
                      <FileText className="w-3 h-3" />
                      <span className={hasBody ? "text-emerald-600 font-medium" : ""}>
                        {hasBody ? `${p.wordCount} từ` : "Chưa có text"}
                      </span>
                      <span className="text-gray-300">·</span>
                      <span>
                        {qCount > 0 ? `Câu ${start}–${start + qCount - 1}` : "0 câu"}
                      </span>
                    </div>
                  </button>
                  {canRemove && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePassage(p.passageNumber);
                      }}
                      title={`Bỏ Passage ${p.passageNumber}`}
                      className="mr-2 p-1 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}

          {/* Nút thêm passage (chỉ ở đề đơn kỹ năng) */}
          {!isFullTest &&
            ([1, 2, 3] as const)
              .filter((n) => !activePassages.has(n))
              .map((n) => {
                const info = PASSAGE_INFOS[n];
                return (
                  <div key={`add-pass-${n}`} className="group relative flex items-center">
                    <button
                      type="button"
                      onClick={() => addPassage(n)}
                      className="flex items-center gap-2 m-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors whitespace-nowrap cursor-pointer text-left"
                    >
                      <Plus className="w-4 h-4 text-emerald-500" />
                      <div>
                        <div className="font-semibold text-xs text-gray-700 group-hover:text-emerald-600">
                          + Thêm Passage {n}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          ~13 câu · 20 phút
                        </div>
                      </div>
                    </button>
                    {/* Tooltip khi hover */}
                    <div className="pointer-events-none absolute top-full left-0 z-50 mt-1 w-64 origin-top-left scale-95 opacity-0 transition-all duration-150 group-hover:scale-100 group-hover:opacity-100">
                      <div className="rounded-xl bg-gray-900 px-3.5 py-2.5 text-left shadow-xl ring-1 ring-black/5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                          <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
                          Passage {n} - {info.desc}
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-gray-300">
                          {info.detail}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2 border-t border-white/10 pt-1.5 text-[10px] text-gray-400">
                          <span>📄 Bài đọc 700-1100 từ</span>
                          <span>⏱ ~20 phút</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
        </div>
      </div>

      {/* Passage editor */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              {partInfo.name}
            </h3>
            <p className="text-xs text-gray-500 mt-1">{partInfo.description}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-emerald-600 tabular-nums">
              {current.wordCount}
              <span className="text-sm text-gray-400 font-normal"> từ</span>
            </p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">
              khuyến nghị 700–1100
            </p>
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
            Tiêu đề bài đọc
          </label>
          <input
            type="text"
            value={current.title}
            onChange={(e) => updatePassage(activePassage, { title: e.target.value })}
            placeholder={`VD: ${
              activePassage === 1 ? "The History of Coffee" : activePassage === 2 ? "Modern Architecture" : "Climate Change Research"
            }`}
            className="w-full px-3 py-2 text-sm font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
            Nội dung bài đọc
          </label>
          <textarea
            value={current.body}
            onChange={(e) => updatePassage(activePassage, { body: e.target.value })}
            placeholder="Dán nội dung bài đọc IELTS Reading vào đây..."
            rows={14}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 leading-relaxed font-serif"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            {current.wordCount < 700 && current.wordCount > 0 && (
              <span className="text-amber-600 font-medium">
                Bài đọc hơi ngắn ({current.wordCount} từ). Khuyến nghị ≥ 700 từ.
              </span>
            )}
            {current.wordCount >= 700 && current.wordCount <= 1100 && (
              <span className="text-emerald-600 font-medium">
                Độ dài phù hợp ({current.wordCount} từ).
              </span>
            )}
            {current.wordCount > 1100 && (
              <span className="text-amber-600 font-medium">
                Bài đọc hơi dài ({current.wordCount} từ).
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Question groups */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            Nhóm câu hỏi
          </h4>
          <span className="text-xs text-gray-500">
            {current.groups.length} nhóm · {passageQuestionCount} câu
          </span>
        </div>

        {current.groups.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
            <Layers className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-3">
              Chưa có nhóm câu hỏi nào. Mỗi nhóm là một dạng câu (vd Matching features,
              True/False/Not Given…) với chỉ dẫn riêng.
            </p>
            <button
              type="button"
              onClick={() => addGroup(activePassage)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Thêm nhóm câu hỏi
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {current.groups.map((g, gIdx) => (
              <GroupCard
                key={g.id}
                group={g}
                startNumber={groupStartNumbers[gIdx]}
                passageNumber={activePassage}
                examId={examId}
                onChange={(patch) => updateGroup(activePassage, gIdx, patch)}
                onRemove={() => removeGroup(activePassage, gIdx)}
                onSetGroupSize={(size) => setGroupSize(activePassage, gIdx, size)}
                onSetGroupAnswers={(letters) => setGroupAnswers(activePassage, gIdx, letters)}
                onAddQuestion={() => addQuestion(activePassage, gIdx)}
                onRemoveQuestion={(qIdx) => removeQuestion(activePassage, gIdx, qIdx)}
                onSplitGroup={() => splitGroup(activePassage, gIdx)}
                onChangeQuestion={(qIdx, patch) =>
                  updateQuestion(activePassage, gIdx, qIdx, patch)
                }
              />
            ))}

            <button
              type="button"
              onClick={() => addGroup(activePassage)}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Thêm nhóm câu hỏi
            </button>
          </div>
        )}
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-end bg-white rounded-2xl border border-gray-200 p-4 sticky bottom-0">
        <button
          type="button"
          onClick={() => {
            const activePassageList = flattenPassages(
              passages.filter((p) => activePassages.has(p.passageNumber))
            );
            onSave({ passages: activePassageList });
            success("Đã cập nhật nội dung Reading");
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-all cursor-pointer shadow-sm hover:shadow"
        >
          <Save className="w-4 h-4" />
          Lưu Reading
        </button>
      </div>
    </div>
  );
}

// ─── Reading Image Block ───────────────────────────────────────────────────
function ReadingImageBlock({
  taskImage,
  taskImageFileName,
  startNumber,
  endNumber,
  passageNumber,
  examId,
  onChange,
}: {
  taskImage?: string;
  taskImageFileName?: string;
  startNumber: number;
  endNumber: number;
  passageNumber: number;
  examId?: string;
  onChange: (patch: { taskImage: string; taskImageFileName: string }) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const handleUpload = async (file: File) => {
    if (!examId) {
      alert("Vui lòng đợi bài thi được tạo trước khi upload ảnh");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("passage", String(passageNumber));
      const res = await api.post(
        `/teacher/exams/${examId}/ielts/reading/passages/${passageNumber}/question-image`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const url = res.data?.image_url || res.data?.data?.image_url || URL.createObjectURL(file);
      onChange({ taskImage: url, taskImageFileName: file.name });
    } catch {
      const url = URL.createObjectURL(file);
      onChange({ taskImage: url, taskImageFileName: file.name });
    } finally {
      setUploading(false);
    }
  };

  const rangeLabel = startNumber === endNumber ? `Câu ${startNumber}` : `Câu ${startNumber}–${endNumber}`;

  return (
    <div
      className="rounded-xl border-2 border-dashed border-emerald-400/80 bg-emerald-50/40 p-4 space-y-3 outline-none focus:border-emerald-500 focus:bg-emerald-50/70 transition-colors"
      tabIndex={0}
      onPaste={(e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith("image/")) {
            e.preventDefault();
            const blob = items[i].getAsFile();
            if (blob) handleUpload(blob);
            return;
          }
        }
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 uppercase tracking-wide">
          <ImageIcon className="w-4 h-4 text-emerald-600" />
          Ảnh sơ đồ / Diagram — {rangeLabel}
        </div>
        <span className="text-[11px] font-medium text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
          Dán Ctrl+V hoặc chọn file
        </span>
      </div>

      {taskImage ? (
        <div className="space-y-2">
          <div className="relative group max-w-xl mx-auto">
            <img
              src={taskImage}
              alt="Diagram preview"
              className="max-w-full max-h-[300px] w-auto object-contain mx-auto rounded-lg border border-emerald-200 bg-white shadow-xs cursor-zoom-in"
              onClick={() => setZoomed(true)}
            />
            <button
              type="button"
              onClick={() => setZoomed(true)}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-white/90 text-emerald-700 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-white"
              title="Phóng to sơ đồ"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-emerald-200/60">
            <span className="text-[11px] text-gray-500 truncate flex-1" title={taskImageFileName}>
              {taskImageFileName || "Ảnh sơ đồ đã upload"}
            </span>
            <div className="flex items-center gap-3">
              <label className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer">
                Đổi ảnh khác
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                />
              </label>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={() => onChange({ taskImage: "", taskImageFileName: "" })}
                className="text-[11px] font-semibold text-rose-500 hover:text-rose-700 cursor-pointer"
              >
                Xoá ảnh
              </button>
            </div>
          </div>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-2 py-6 cursor-pointer hover:bg-emerald-50/80 rounded-lg transition-all border border-emerald-200/50 bg-white/60">
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">Đang tải ảnh lên...</span>
            </>
          ) : (
            <>
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <Upload className="w-4 h-4" />
              </div>
              <div className="text-center">
                <span className="text-xs font-bold text-emerald-800 block">
                  Kéo thả ảnh sơ đồ vào đây hoặc bấm để chọn file
                </span>
                <span className="text-[11px] text-gray-500 block mt-0.5">
                  Hỗ trợ PNG, JPG, WEBP, PDF (tối đa 20MB) — hoặc bấm phím <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px]">Ctrl+V</kbd> để dán ảnh
                </span>
              </div>
            </>
          )}
          <input
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            }}
          />
        </label>
      )}

      {zoomed && taskImage && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomed(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-xl overflow-hidden shadow-2xl p-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 px-2 border-b border-gray-200 mb-2">
              <span className="text-xs font-bold text-gray-700">
                Sơ đồ {rangeLabel} (Passage {passageNumber})
              </span>
              <button
                type="button"
                onClick={() => setZoomed(false)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={taskImage}
              alt="Diagram zoomed"
              className="max-w-full max-h-[75vh] object-contain mx-auto rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Group card ──────────────────────────────────────────────────────────────
function GroupCard({
  group,
  startNumber,
  passageNumber,
  examId,
  onChange,
  onRemove,
  onSetGroupSize,
  onSetGroupAnswers,
  onAddQuestion,
  onRemoveQuestion,
  onChangeQuestion,
}: {
  group: ReadingGroup;
  startNumber: number;
  passageNumber: number;
  examId?: string;
  onChange: (patch: Partial<ReadingGroup>) => void;
  onRemove: () => void;
  onSetGroupSize?: (size: number) => void;
  onSetGroupAnswers?: (letters: string[]) => void;
  onSplitGroup?: () => void;
  onAddQuestion: () => void;
  onRemoveQuestion: (qIdx: number) => void;
  onChangeQuestion: (qIdx: number, patch: Partial<ReadingQuestion>) => void;
}) {
  const [showImageUpload, setShowImageUpload] = useState(false);
  const matching = isMatchingType(group.questionType);
  const isGroupedMcq = group.questionType === "multiple-choice-group";
  const completion = isCompletionType(group.questionType);
  const isDiagram = group.questionType === "diagram-labelling";
  const hasImage = !!group.taskImage && group.taskImage.trim() !== "";
  const endNumber = startNumber + group.questions.length - 1;
  const hint = TYPE_HINTS[group.questionType];

  const groupSelectedLetters = isGroupedMcq
    ? group.questions.map((item) => item.correctAnswer?.trim().toUpperCase()).filter(Boolean)
    : [];

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-xs font-bold text-emerald-700">
            Câu {startNumber}
            {group.questions.length > 1 ? `–${endNumber}` : ""}
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
            title="Xoá nhóm này"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Xoá nhóm
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={group.questionType}
            onChange={(e) => onChange({ questionType: e.target.value })}
            className="text-xs font-semibold px-2 py-1.5 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {IELTS_READING_QUESTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          {/* Grouped MCQ (Choose TWO/THREE): Quy mô nhóm xác định số câu và số đáp án */}
          {isGroupedMcq && (
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-white px-2.5 py-1 rounded-md border border-emerald-300 shadow-xs">
                <span className="font-semibold">Quy mô nhóm:</span>
                <select
                  value={group.questions.length >= 3 ? 3 : 2}
                  onChange={(e) => onSetGroupSize?.(Number(e.target.value))}
                  className="px-2 py-0.5 border border-gray-300 rounded text-xs bg-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value={2}>2 câu (Choose TWO - 2 điểm)</option>
                  <option value={3}>3 câu (Choose THREE - 3 điểm)</option>
                </select>
              </label>
              {group.questions.length > 2 && onSplitGroup && (
                <button
                  type="button"
                  onClick={onSplitGroup}
                  className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-semibold border border-emerald-300 transition-colors cursor-pointer"
                  title="Tách nhóm này thành các nhóm 2 câu riêng"
                >
                  ✂️ Tách thành các nhóm 2 câu
                </button>
              )}
            </div>
          )}

          {/* Completion: giới hạn từ */}
          {completion && (
            <label className="flex items-center gap-1.5 text-[11px] text-gray-600">
              Giới hạn từ:
              <select
                value={group.wordLimit ?? ""}
                onChange={(e) => onChange({ wordLimit: e.target.value })}
                className="px-2 py-1 border border-gray-300 rounded-md bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {WORD_LIMIT_OPTIONS.map((w) => (
                  <option key={w} value={w}>
                    {w === "" ? "Không giới hạn" : w}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Completion: bật word bank (chọn từ danh sách cho sẵn) */}
          {completion && (
            <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={!!group.useWordBank}
                onChange={(e) => onChange({ useWordBank: e.target.checked })}
                className="w-3.5 h-3.5 accent-emerald-500"
              />
              Dùng word bank (chọn từ danh sách)
            </label>
          )}
        </div>
        {hint && <p className="text-[11px] text-gray-400 italic mt-1">{hint}</p>}

        <textarea
          value={group.instruction}
          onChange={(e) => onChange({ instruction: e.target.value })}
          placeholder="Chỉ dẫn của nhóm (vd: Classify the following as typical of… / Write the correct letter A, B or C)"
          rows={2}
          className="mt-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none bg-white"
        />

        {/* Sơ đồ / Image Block cho nhóm câu hỏi */}
        {(isDiagram || hasImage || showImageUpload) && (
          <div className="mt-3">
            <ReadingImageBlock
              taskImage={group.taskImage}
              taskImageFileName={group.taskImageFileName}
              startNumber={startNumber}
              endNumber={endNumber}
              passageNumber={passageNumber}
              examId={examId}
              onChange={(patch) => {
                onChange(patch);
                if (!patch.taskImage) setShowImageUpload(false);
              }}
            />
          </div>
        )}

        {/* Nút đính kèm ảnh cho các dạng câu hỏi khác nếu chưa mở block */}
        {!isDiagram && !hasImage && !showImageUpload && (
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => setShowImageUpload(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              + Đính kèm ảnh sơ đồ / biểu đồ cho nhóm này
            </button>
          </div>
        )}
      </div>

      {(matching || (completion && group.useWordBank)) && (
        <div className="px-4 pt-3">
          <MatchingChoicesPanel
            choices={group.choices ?? defaultChoices(group.questionType)}
            symbols={symbolsFor(group.questionType)}
            title={
              matching ? "Danh sách lựa chọn dùng chung" : "Word bank (danh sách từ)"
            }
            onChange={(next) => onChange({ choices: next })}
          />
        </div>
      )}

      <div className="p-4 space-y-2">
        {group.questions.map((q, qIdx) => {
          const isFollower = isGroupedMcq && qIdx > 0;
          const isLead = isGroupedMcq && qIdx === 0;

          return (
            <QuestionRow
              key={q.id}
              number={startNumber + qIdx}
              question={q}
              groupType={group.questionType}
              choices={group.choices}
              useWordBank={!!group.useWordBank}
              canRemove={!isGroupedMcq && group.questions.length > 1}
              isGroupedMcq={isGroupedMcq}
              isGroupedMcqLead={isLead}
              isGroupedMcqFollower={isFollower}
              leadNumber={startNumber}
              groupEndNumber={endNumber}
              groupSize={group.questions.length}
              groupSelectedLetters={groupSelectedLetters}
              onGroupAnswersChange={(letters) => onSetGroupAnswers?.(letters)}
              onChange={(patch) => onChangeQuestion(qIdx, patch)}
              onRemove={() => onRemoveQuestion(qIdx)}
            />
          );
        })}

        {!isGroupedMcq && (
          <button
            type="button"
            onClick={onAddQuestion}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer mt-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Thêm câu vào nhóm
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Question row ──────────────────────────────────────────────────────────────
function QuestionRow({
  number,
  question,
  groupType,
  choices,
  useWordBank,
  canRemove,
  isGroupedMcq,
  isGroupedMcqLead,
  isGroupedMcqFollower,
  leadNumber,
  groupEndNumber,
  groupSize,
  groupSelectedLetters = [],
  onGroupAnswersChange,
  onChange,
  onRemove,
}: {
  number: number;
  question: ReadingQuestion;
  groupType: string;
  choices?: Record<string, string>;
  useWordBank?: boolean;
  canRemove: boolean;
  isGroupedMcq?: boolean;
  isGroupedMcqLead?: boolean;
  isGroupedMcqFollower?: boolean;
  leadNumber?: number;
  groupEndNumber?: number;
  groupSize?: number;
  groupSelectedLetters?: string[];
  onGroupAnswersChange?: (letters: string[]) => void;
  onChange: (patch: Partial<ReadingQuestion>) => void;
  onRemove: () => void;
}) {
  const isSingleMcq = groupType === "multiple-choice";
  const isTrueFalse = TRUE_FALSE_TYPES.includes(groupType);
  const matching = isMatchingType(groupType);
  const wordBank = isCompletionType(groupType) && !!useWordBank;
  const choiceKeys = Object.keys(choices ?? {});
  const matchingKeys = choiceKeys;

  // MCQ: các key đáp án hiện có (A,B,C…) của câu này / nhóm này.
  const currentOptionKeys = Object.keys(question.options ?? {})
    .filter((k) => /^[A-Za-z]$/.test(k))
    .sort();
  const optionKeys = (isSingleMcq || isGroupedMcq)
    ? (currentOptionKeys.length >= 2 ? currentOptionKeys : ["A", "B", "C", "D"])
    : currentOptionKeys;

  const currentOptions: Record<string, string> = { ...(question.options ?? {}) };
  optionKeys.forEach((k) => {
    if (currentOptions[k] === undefined) {
      currentOptions[k] = "";
    }
  });

  // Thêm 1 đáp án (chữ cái kế tiếp). Tối đa 8 (A–H) đủ cho Choose THREE.
  const addOption = () => {
    const nextLetter = LETTER_SYMBOLS[optionKeys.length];
    if (!nextLetter) return;
    onChange({
      options: { ...currentOptions, [nextLetter]: "" },
    });
  };

  // Xóa 1 đáp án → đánh lại chữ cái liên tục + map lại đáp án đúng
  const removeOption = (keyToRemove: string) => {
    if (optionKeys.length <= 2) return;
    const remaining = optionKeys.filter((k) => k !== keyToRemove);
    const nextOptions: Record<string, string> = {};
    const remap: Record<string, string> = {};
    remaining.forEach((oldKey, i) => {
      const newKey = LETTER_SYMBOLS[i];
      nextOptions[newKey] = currentOptions[oldKey] ?? "";
      remap[oldKey] = newKey;
    });

    if (isGroupedMcqLead) {
      const nextGroupAnswers = groupSelectedLetters
        .filter((l) => l !== keyToRemove)
        .map((l) => remap[l] ?? l)
        .sort();
      onGroupAnswersChange?.(nextGroupAnswers);
      onChange({ options: nextOptions });
    } else {
      const nextAnswer =
        remap[question.correctAnswer] ??
        (question.correctAnswer === keyToRemove ? "" : question.correctAnswer);
      onChange({
        options: nextOptions,
        correctAnswer: nextAnswer || "",
      });
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 p-3 hover:border-emerald-300 transition-all">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
          {number}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start gap-2">
            {isGroupedMcqFollower ? (
              <div className="flex-1 min-w-0 text-xs text-emerald-800 italic bg-emerald-50/60 border border-dashed border-emerald-300 p-2.5 rounded-lg flex items-center gap-2">
                <span>
                  ℹ️ Đề bài và các lựa chọn A–{LETTER_SYMBOLS[optionKeys.length - 1] || "E"} được kế thừa từ{" "}
                  <strong>Câu {leadNumber}</strong>
                </span>
              </div>
            ) : (
              <RichTextInput
                value={question.questionText}
                onChange={(html) => onChange({ questionText: html })}
                placeholder="Nội dung câu hỏi (statement / question)..."
                className="flex-1 min-w-0"
              />
            )}
            {canRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer flex-shrink-0"
                title="Xoá câu này"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {matching || wordBank ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                Đáp án đúng:
              </span>
              {matchingKeys.length > 0 ? (
                <select
                  value={question.correctAnswer}
                  onChange={(e) => onChange({ correctAnswer: e.target.value })}
                  className="flex-1 max-w-xs px-3 py-2 text-sm border border-emerald-200 bg-emerald-50/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">— Chọn đáp án —</option>
                  {matchingKeys.map((k) => (
                    <option key={k} value={k}>
                      {k}
                      {choices && choices[k] ? ` — ${choices[k]}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-amber-600 italic">
                  Hãy nhập danh sách lựa chọn ở khung phía trên trước.
                </span>
              )}
            </div>
          ) : isGroupedMcq ? (
            isGroupedMcqFollower ? (
              // Câu thành viên trong nhóm Choose TWO/THREE: hiển thị banner kế thừa & nút đổi nhanh đáp án nếu muốn
              <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 bg-emerald-50/60 text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[11px]">
                    Thuộc nhóm {leadNumber}–{groupEndNumber}
                  </span>
                  <span className="text-gray-700">
                    Kế thừa đề bài & lựa chọn A–{LETTER_SYMBOLS[optionKeys.length - 1] || "E"} từ{" "}
                    <strong>Câu {leadNumber}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">Đáp án của câu này:</span>
                  <div className="flex items-center gap-1">
                    {optionKeys.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => onChange({ correctAnswer: k })}
                        className={`w-7 h-7 rounded text-xs font-bold transition-all cursor-pointer flex items-center justify-center border ${
                          question.correctAnswer === k
                            ? "bg-emerald-600 border-emerald-700 text-white shadow-xs font-extrabold"
                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                        }`}
                        title={`Gán đáp án ${k} cho câu ${number}`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              // Câu đầu của nhóm Choose TWO/THREE: hiển thị bộ checkbox để tích đủ số lượng đáp án
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 text-xs">
                  <span className="font-semibold text-emerald-950">
                    Tích chọn đúng {groupSize} đáp án cho nhóm câu {leadNumber}–{groupEndNumber} (Choose {groupSize === 2 ? "TWO" : groupSize === 3 ? "THREE" : `${groupSize}`}):
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded font-bold text-xs ${
                      groupSelectedLetters.length === groupSize
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-amber-100 text-amber-800 border border-amber-300"
                    }`}
                  >
                    Đã chọn {groupSelectedLetters.length}/{groupSize} đáp án
                  </span>
                </div>

                {(groupSize ?? 2) > 3 && (
                  <div className="p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    ⚠️ Nhóm này đang gồm {groupSize} câu (vượt chuẩn Cambridge IELTS 2-3 câu). Hãy bấm nút &quot;Tách thành các nhóm 2 câu&quot; ở trên để chia nhỏ.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {optionKeys.map((k) => {
                    const isChecked = groupSelectedLetters.includes(k);
                    return (
                      <label
                        key={k}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-md border text-xs cursor-pointer transition-all"
                        style={{
                          background: isChecked ? "#ECFDF5" : "#FFFFFF",
                          borderColor: isChecked ? "#10B981" : "#E5E7EB",
                          boxShadow: isChecked ? "0 1px 2px rgba(16, 185, 129, 0.1)" : undefined,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            let next = [...groupSelectedLetters];
                            if (next.includes(k)) {
                              next = next.filter((x) => x !== k);
                            } else {
                              if (next.length >= (groupSize ?? 2)) {
                                return;
                              }
                              next.push(k);
                            }
                            next.sort();
                            onGroupAnswersChange?.(next);
                          }}
                          className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                        />
                        <span className="font-bold text-gray-800">{k}.</span>
                        <input
                          type="text"
                          value={question.options?.[k] ?? ""}
                          onChange={(e) =>
                            onChange({
                              options: { ...(question.options ?? {}), [k]: e.target.value },
                            })
                          }
                          placeholder={`Đáp án ${k}`}
                          className="flex-1 bg-transparent text-xs outline-none"
                        />
                        {optionKeys.length > 2 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              removeOption(k);
                            }}
                            className="p-0.5 rounded text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-all cursor-pointer flex-shrink-0"
                            title="Xoá đáp án (áp dụng cho cả nhóm)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </label>
                    );
                  })}
                </div>

                {optionKeys.length < LETTER_SYMBOLS.length && (
                  <button
                    type="button"
                    onClick={addOption}
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Thêm đáp án ({LETTER_SYMBOLS[optionKeys.length]})
                  </button>
                )}
              </div>
            )
          ) : isSingleMcq ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {optionKeys.map((k) => {
                  const checked = question.correctAnswer === k;
                  return (
                    <label
                      key={k}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-gray-200 hover:border-emerald-300 transition-all cursor-pointer text-xs"
                      style={{
                        background: checked ? "#ECFDF5" : "#FFFFFF",
                        borderColor: checked ? "#86EFAC" : "#E5E7EB",
                      }}
                    >
                      <input
                        type="radio"
                        name={`correct-${question.id}`}
                        checked={checked}
                        onChange={() => onChange({ correctAnswer: k })}
                        className="w-3.5 h-3.5 accent-emerald-500"
                      />
                      <span className="font-bold text-gray-700">{k}.</span>
                      <input
                        type="text"
                        value={currentOptions[k] ?? ""}
                        onChange={(e) =>
                          onChange({
                            options: { ...currentOptions, [k]: e.target.value },
                          })
                        }
                        placeholder={`Đáp án ${k}`}
                        className="flex-1 bg-transparent text-xs outline-none"
                      />
                      {optionKeys.length > 2 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            removeOption(k);
                          }}
                          className="p-0.5 rounded text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-all cursor-pointer flex-shrink-0"
                          title="Xoá đáp án này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </label>
                  );
                })}
              </div>
              {optionKeys.length < LETTER_SYMBOLS.length && (
                <button
                  type="button"
                  onClick={addOption}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm đáp án
                </button>
              )}
            </div>
          ) : isTrueFalse ? (
            <div className="flex flex-wrap gap-2">
              {(groupType === "true-false-not-given"
                ? ["TRUE", "FALSE", "NOT GIVEN"]
                : ["YES", "NO", "NOT GIVEN"]
              ).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChange({ correctAnswer: opt })}
                  className="px-3 py-1.5 rounded-md border text-xs font-bold transition-all cursor-pointer"
                  style={{
                    background: question.correctAnswer === opt ? "#10B981" : "#FFFFFF",
                    color: question.correctAnswer === opt ? "#FFFFFF" : "#6B7280",
                    borderColor: question.correctAnswer === opt ? "#10B981" : "#E5E7EB",
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <input
              type="text"
              value={question.correctAnswer}
              onChange={(e) => onChange({ correctAnswer: e.target.value })}
              placeholder="Đáp án đúng (dùng / để thêm biến thể, vd: twentieth/20th)..."
              className="w-full px-3 py-2 text-sm border border-emerald-200 bg-emerald-50/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          )}

          {/* Explanation (Optional) */}
          <div className="mt-2 pt-2 border-t border-gray-100">
            <input
              type="text"
              value={question.explanation || ""}
              onChange={(e) => onChange({ explanation: e.target.value })}
              placeholder="Giải thích đáp án (Không bắt buộc)..."
              className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Matching choices panel ──────────────────────────────────────────────────
/**
 * Khung "Danh sách lựa chọn (dùng chung)" cho 1 nhóm câu matching.
 * `symbols` quyết định ký hiệu: A/B/C cho phần lớn, i/ii/iii cho matching headings.
 */
function MatchingChoicesPanel({
  choices,
  symbols,
  title = "Danh sách lựa chọn dùng chung",
  onChange,
}: {
  choices: Record<string, string>;
  symbols: string[];
  title?: string;
  onChange: (next: Record<string, string>) => void;
}) {
  const keys = Object.keys(choices);

  const setLabel = (key: string, value: string) => {
    onChange({ ...choices, [key]: value });
  };

  const addChoice = () => {
    const nextKey = symbols[keys.length];
    if (!nextKey) return;
    onChange({ ...choices, [nextKey]: "" });
  };

  const removeChoice = (key: string) => {
    // Xoá rồi re-label theo đúng hệ ký hiệu (A.. hoặc i..).
    const remaining = keys.filter((k) => k !== key).map((k) => choices[k]);
    const rebuilt: Record<string, string> = {};
    remaining.forEach((val, i) => {
      rebuilt[symbols[i]] = val;
    });
    onChange(rebuilt);
  };

  return (
    <div className="rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-bold text-emerald-800">
            {title}
          </span>
        </div>
        <span className="text-[11px] text-gray-500">
          Áp dụng cho tất cả câu trong nhóm
        </span>
      </div>

      <div className="space-y-1.5">
        {keys.map((k) => (
          <div key={k} className="flex items-center gap-2">
            <span className="min-w-6 h-6 px-1.5 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
              {k}
            </span>
            <input
              type="text"
              value={choices[k]}
              onChange={(e) => setLabel(k, e.target.value)}
              placeholder={`Nội dung lựa chọn ${k}`}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
            {keys.length > 2 && (
              <button
                type="button"
                onClick={() => removeChoice(k)}
                className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                title="Xoá lựa chọn này"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {keys.length < symbols.length && (
        <button
          type="button"
          onClick={addChoice}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Thêm lựa chọn
        </button>
      )}
    </div>
  );
}

export default IeltsReadingEditor;

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
} from "lucide-react";
import { IELTS_STRUCTURE, IELTS_READING_QUESTION_TYPES, type IeltsTestType } from "../structure";

// ─── Types ───────────────────────────────────────────────────────────────
interface ReadingQuestion {
  id: string;
  questionText: string;
  /** Đáp án đúng. Multi-select lưu "A,C". Completion có thể lưu biến thể "20th/twentieth". */
  correctAnswer: string;
  /** Chỉ dùng cho MCQ — mỗi câu có bộ A/B/C/D… riêng. */
  options?: Record<string, string>;
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
}

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
  return text.trim().split(/\s+/).filter(Boolean).length;
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
  };
}

/**
 * Suy ra danh sách nhóm từ mảng câu hỏi phẳng (đề cũ / import).
 * Gom các câu liền nhau cùng questionType + cùng chỉ dẫn.
 */
function deriveGroups(questions: any[]): ReadingGroup[] {
  const groups: ReadingGroup[] = [];
  for (const q of questions || []) {
    const type = q.questionType || "multiple-choice";
    const instr = q.taskInstruction || q.task_instruction || "";
    const last = groups[groups.length - 1];
    if (last && last.questionType === type && last.instruction === instr) {
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
        choices: isMatchingType(type)
          ? q.options
            ? { ...q.options }
            : defaultChoices(type)
          : undefined,
        selectCount: (type === "multiple-choice" || type === "multiple-choice-group") ? 1 : undefined,
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
  if (Array.isArray(arr) && arr.length) {
    return arr.map((p: any, i: number) => {
      const body = p.body || p.passageText || "";
      const groups =
        Array.isArray(p.groups) && p.groups.length
          ? p.groups.map(normalizeGroup)
          : deriveGroups(p.questions || []);
      return {
        passageNumber: (p.passageNumber || i + 1) as 1 | 2 | 3,
        title: p.title || p.passageTitle || "",
        body,
        wordCount: p.wordCount || countWords(body),
        groups,
      };
    });
  }
  return [1, 2, 3].map((n) => ({
    passageNumber: n as 1 | 2 | 3,
    title: "",
    body: "",
    wordCount: 0,
    groups: [],
  }));
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
          selectCount: g.selectCount || 1,
          useWordBank: wordBank,
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
export function IeltsReadingEditor({ initialData, onSave, testType }: Props) {
  const [passages, setPassages] = useState<ReadingPassage[]>(() =>
    buildPassages(initialData)
  );
  const [activePassage, setActivePassage] = useState<1 | 2 | 3>(1);

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
        g.selectCount = (t === "multiple-choice" || t === "multiple-choice-group") ? 1 : undefined;
        g.wordLimit = isCompletionType(t) ? "" : undefined;
        g.useWordBank = isCompletionType(t) ? false : undefined;
        g.questions = g.questions.map((q) => ({
          ...q,
          options:
            (t === "multiple-choice" || t === "multiple-choice-group")
              ? q.options ?? { A: "", B: "", C: "", D: "" }
              : undefined,
          correctAnswer: "",
        }));
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

  const updateQuestion = (
    pNum: number,
    gIdx: number,
    qIdx: number,
    patch: Partial<ReadingQuestion>
  ) =>
    mutateGroups(pNum, (groups) => {
      const g = groups[gIdx];
      const questions = [...g.questions];
      questions[qIdx] = { ...questions[qIdx], ...patch };
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
    onSave({ passages: flattenPassages(passages) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passages]);

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
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          {passages.map((p, idx) => {
            const isActive = p.passageNumber === activePassage;
            const qCount = p.groups.reduce((s, g) => s + g.questions.length, 0);
            const hasBody = p.body.trim().length > 50;
            const start = passageStartNumbers[idx] ?? 1;
            return (
              <button
                key={p.passageNumber}
                type="button"
                onClick={() => setActivePassage(p.passageNumber)}
                className="px-4 py-3 text-left transition-all cursor-pointer"
                style={{
                  background: isActive ? "#ECFDF5" : "#FFFFFF",
                  borderBottom: isActive ? "3px solid #10B981" : "3px solid transparent",
                }}
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
                onChange={(patch) => updateGroup(activePassage, gIdx, patch)}
                onRemove={() => removeGroup(activePassage, gIdx)}
                onAddQuestion={() => addQuestion(activePassage, gIdx)}
                onRemoveQuestion={(qIdx) => removeQuestion(activePassage, gIdx, qIdx)}
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
          onClick={() => onSave({ passages: flattenPassages(passages) })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          Lưu Reading
        </button>
      </div>
    </div>
  );
}

// ─── Group card ──────────────────────────────────────────────────────────────
function GroupCard({
  group,
  startNumber,
  onChange,
  onRemove,
  onAddQuestion,
  onRemoveQuestion,
  onChangeQuestion,
}: {
  group: ReadingGroup;
  startNumber: number;
  onChange: (patch: Partial<ReadingGroup>) => void;
  onRemove: () => void;
  onAddQuestion: () => void;
  onRemoveQuestion: (qIdx: number) => void;
  onChangeQuestion: (qIdx: number, patch: Partial<ReadingQuestion>) => void;
}) {
  const matching = isMatchingType(group.questionType);
  const isMcq = group.questionType === "multiple-choice" || group.questionType === "multiple-choice-group";
  const completion = isCompletionType(group.questionType);
  const endNumber = startNumber + group.questions.length - 1;
  const hint = TYPE_HINTS[group.questionType];

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

          {/* MCQ: số đáp án cần chọn */}
          {isMcq && (
            <label className="flex items-center gap-1.5 text-[11px] text-gray-600">
              Số đáp án chọn:
              <select
                value={group.selectCount ?? 1}
                onChange={(e) => onChange({ selectCount: Number(e.target.value) })}
                className="px-2 py-1 border border-gray-300 rounded-md bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={1}>1 (chọn 1)</option>
                <option value={2}>2 (Choose TWO)</option>
                <option value={3}>3 (Choose THREE)</option>
              </select>
            </label>
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
        {group.questions.map((q, qIdx) => (
          <QuestionRow
            key={q.id}
            number={startNumber + qIdx}
            question={q}
            groupType={group.questionType}
            choices={group.choices}
            selectCount={group.selectCount ?? 1}
            useWordBank={!!group.useWordBank}
            canRemove={group.questions.length > 1}
            onChange={(patch) => onChangeQuestion(qIdx, patch)}
            onRemove={() => onRemoveQuestion(qIdx)}
          />
        ))}

        <button
          type="button"
          onClick={onAddQuestion}
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer mt-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Thêm câu vào nhóm
        </button>
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
  selectCount,
  useWordBank,
  canRemove,
  onChange,
  onRemove,
}: {
  number: number;
  question: ReadingQuestion;
  groupType: string;
  choices?: Record<string, string>;
  selectCount: number;
  useWordBank?: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<ReadingQuestion>) => void;
  onRemove: () => void;
}) {
  const isMcq = groupType === "multiple-choice" || groupType === "multiple-choice-group";
  const isMultiMcq = isMcq && selectCount > 1;
  const isTrueFalse = TRUE_FALSE_TYPES.includes(groupType);
  const matching = isMatchingType(groupType);
  // Completion dùng word bank → chọn đáp án từ danh sách (dropdown như matching).
  const wordBank = isCompletionType(groupType) && !!useWordBank;
  const choiceKeys = Object.keys(choices ?? {});
  const matchingKeys = choiceKeys;

  // Multi-select MCQ: correctAnswer lưu "A,C" → set tiện thao tác.
  const selectedSet = new Set(
    (question.correctAnswer || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const toggleMulti = (k: string) => {
    const next = new Set(selectedSet);
    if (next.has(k)) next.delete(k);
    else {
      if (next.size >= selectCount) return; // không vượt quá số cần chọn
      next.add(k);
    }
    onChange({ correctAnswer: Array.from(next).sort().join(",") });
  };

  // MCQ: các key đáp án hiện có (A,B,C…) của RIÊNG câu này.
  const optionKeys = Object.keys(question.options ?? {})
    .filter((k) => /^[A-Za-z]$/.test(k))
    .sort();

  // Thêm 1 đáp án (chữ cái kế tiếp). Tối đa 8 (A–H) đủ cho Choose THREE.
  const addOption = () => {
    const nextLetter = LETTER_SYMBOLS[optionKeys.length];
    if (!nextLetter) return;
    onChange({
      options: { ...(question.options ?? {}), [nextLetter]: "" },
    });
  };

  // Xóa 1 đáp án → đánh lại chữ cái liên tục + map lại correctAnswer
  // (hỗ trợ cả multi-select "A,C"). Giữ tối thiểu 2 đáp án.
  const removeOption = (keyToRemove: string) => {
    if (optionKeys.length <= 2) return;
    const remaining = optionKeys.filter((k) => k !== keyToRemove);
    const nextOptions: Record<string, string> = {};
    const remap: Record<string, string> = {};
    remaining.forEach((oldKey, i) => {
      const newKey = LETTER_SYMBOLS[i];
      nextOptions[newKey] = question.options?.[oldKey] ?? "";
      remap[oldKey] = newKey;
    });
    const nextAnswer = (question.correctAnswer || "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .filter((p) => p !== keyToRemove)
      .map((p) => remap[p] ?? p)
      .join(",");
    onChange({
      options: nextOptions,
      correctAnswer: isMultiMcq ? nextAnswer : nextAnswer || "",
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 p-3 hover:border-emerald-300 transition-all">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
          {number}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start gap-2">
            <textarea
              value={question.questionText}
              onChange={(e) => onChange({ questionText: e.target.value })}
              placeholder="Nội dung câu hỏi (statement / question)..."
              rows={2}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
            />
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
          ) : isMcq && question.options ? (
            <>
              {isMultiMcq && (
                <p className="text-[11px] text-emerald-600 font-medium">
                  Chọn đúng {selectCount} đáp án ({selectedSet.size}/{selectCount} đã chọn)
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {optionKeys.map((k) => {
                  const checked = isMultiMcq
                    ? selectedSet.has(k)
                    : question.correctAnswer === k;
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
                        type={isMultiMcq ? "checkbox" : "radio"}
                        name={`correct-${question.id}`}
                        checked={checked}
                        onChange={() =>
                          isMultiMcq ? toggleMulti(k) : onChange({ correctAnswer: k })
                        }
                        className="w-3.5 h-3.5 accent-emerald-500"
                      />
                      <span className="font-bold text-gray-700">{k}.</span>
                      <input
                        type="text"
                        value={question.options![k] ?? ""}
                        onChange={(e) =>
                          onChange({
                            options: { ...question.options!, [k]: e.target.value },
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
            </>
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

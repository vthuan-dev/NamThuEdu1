import { useState, useEffect, useRef, memo, useCallback } from "react";
import {
  Headphones,
  Upload,
  Trash2,
  Volume2,
  Loader2,
  CheckCircle2,
  Wand2,
  Image as ImageIcon,
  ZoomIn,
} from "lucide-react";
import { IELTS_STRUCTURE, IELTS_LISTENING_QUESTION_TYPES, type IeltsTestType } from "../structure";
import { api } from "../../../../../../services/api";
import { transcribeAudio as transcribeGroq } from "../../../../../../services/groqApi";
import { transcribeLocal } from "../../../../../../services/whisperLocal";
import { RichTextInput } from "../../../../../../components/ui/RichTextInput";

interface ListeningQuestion {
  id: string;
  questionNumber: number;
  questionType: string;
  questionText: string;
  /** Tiêu đề/chủ đề dùng chung cho 1 nhóm câu (vd "Items"). */
  taskTitle?: string;
  /** Câu hỏi/chỉ dẫn dùng chung của nhóm (vd "Where does the speaker decide to put items in? Write A, B or C."). */
  taskInstruction?: string;
  /** Form-completion editor: raw free-form text typed by teacher. */
  formText?: string;
  options?: Record<string, string>;
  correctAnswer: string;
  /** MCQ: số đáp án cần chọn (1 = chọn 1; 2 = "Choose TWO letters"…). Dùng chung cả nhóm. */
  selectCount?: number;
  /** Completion/short-answer: giới hạn từ ("ONE WORD ONLY"…). Dùng chung cả nhóm. */
  wordLimit?: string;
  /** Completion: dùng word bank (chọn từ danh sách cho sẵn). Dùng chung cả nhóm. */
  useWordBank?: boolean;
  /** Image-completion: URL ảnh đề thi (dùng chung cả nhóm). */
  taskImage?: string;
  taskImageFileName?: string;
}

const isImageCompletion = (t: string) => t === "image-completion";
const isFormCompletion = (t: string) => t === "form-completion";

// Các dạng điền từ trong Listening — có giới hạn từ + word bank.
const LISTENING_COMPLETION_TYPES = [
  "form-completion",
  "note-completion",
  "table-completion",
  "flow-chart-completion",
  "summary-completion",
  "sentence-completion",
  "short-answer",
];
const isListeningCompletion = (t: string) => LISTENING_COMPLETION_TYPES.includes(t);
const isListeningMatching = (t: string) => (t || "").includes("matching");
const WORD_LIMIT_OPTS = [
  "",
  "ONE WORD ONLY",
  "ONE WORD AND/OR A NUMBER",
  "NO MORE THAN TWO WORDS",
  "NO MORE THAN TWO WORDS AND/OR A NUMBER",
  "NO MORE THAN THREE WORDS",
];

const QUESTION_TYPE_GUIDES: Record<string, { title: string; steps: string[]; note?: string }> = {
  "multiple-choice": {
    title: "Hướng dẫn soạn câu Trắc nghiệm (MCQ chọn 1 đáp án):",
    steps: [
      "Bước 1: Nhập nội dung câu hỏi riêng biệt cho từng câu vào ô <strong>'Nội dung câu hỏi...'</strong>.",
      "Bước 2: Sử dụng nút <strong>'+ Thêm đáp án'</strong> để tạo các lựa chọn lựa từ A đến D (hoặc tối đa H). Bấm biểu tượng <strong>'Thùng rác'</strong> bên cạnh mỗi lựa chọn để xóa bớt đáp án thừa.",
      "Bước 3: Click chọn nút Radio tròn tương ứng để đặt chữ cái đó làm đáp án đúng duy nhất của câu hỏi.",
    ],
    note: "* Học viên sẽ nhìn thấy câu hỏi kèm danh sách đáp án, và chọn câu trả lời tương ứng tại menu điền đáp án bên phải.",
  },
  "multiple-choice-group": {
    title: "Hướng dẫn soạn câu MCQ chọn nhiều đáp án (Choose TWO/THREE):",
    steps: [
      "Bước 1: Đảm bảo chọn loại <em>Multiple choice (Choose TWO/THREE)</em> cho các câu thuộc nhóm câu hỏi này (ví dụ: câu 17 và câu 18 là cùng một nhóm).",
      "Bước 2 (Tại câu đầu nhóm): Nhập đề bài lớn chung của nhóm câu hỏi (VD: <em>'Which TWO things does Heather explain about kilns?'</em>). Nhập các lựa chọn bằng cách bấm <strong>'+ Thêm đáp án'</strong> (ví dụ A đến E). Tích chọn đáp án đúng thứ nhất (ví dụ: dòng A).",
      "Bước 3 (Tại các câu tiếp theo của nhóm): Bộ lựa chọn A-E sẽ tự động ẩn đi và kế thừa hoàn toàn từ câu đầu nhóm để giữ giao diện gọn gàng. Bạn chỉ cần click chọn đáp án đúng tiếp theo tại hàng nút chữ cái <strong>[A] [B] [C] [D] [E]</strong> (ví dụ chọn C cho câu 18).",
    ],
    note: "* Học viên sẽ nhìn thấy 1 bảng câu hỏi gộp duy nhất bên trái (Câu 17–18) và điền đáp án vào các ô tương ứng bên phải. Hệ thống tự động chấm chéo không phân biệt thứ tự học viên điền.",
  },
  "form-completion": {
    title: "Hướng dẫn soạn Form completion (Điền biểu mẫu):",
    steps: [
      "Bước 1: Soạn toàn bộ biểu mẫu trong khung nhập liệu lớn <strong>'Nội dung form'</strong>.",
      "Bước 2: Tại mỗi chỗ trống cần học viên điền, hãy gõ ít nhất 3 dấu gạch dưới liên tiếp <strong>'___'</strong>. Hệ thống sẽ tự động quét số lượng '___' để sinh ra các câu hỏi tương ứng bên dưới.",
      "Bước 3: Với mỗi câu hỏi được tự động sinh ra ở dưới, hãy điền đáp án đúng vào ô <strong>'Đáp án đúng'</strong>.",
      "Bước 4: Thiết lập giới hạn từ (VD: <em>ONE WORD AND/OR A NUMBER</em>) và bật checkbox <strong>'Dùng word bank'</strong> nếu muốn học viên chọn từ danh sách từ cho sẵn thay vì tự gõ.",
    ],
    note: "* Ví dụ form: <em>Name: ___1___ / Phone: ___2___</em>. Hệ thống sẽ sinh câu 1 và câu 2 để học viên điền.",
  },
  "note-completion": {
    title: "Hướng dẫn soạn Note completion (Hoàn thành ghi chú):",
    steps: [
      "Bước 1: Soạn nội dung từng câu ghi chú riêng biệt, ví dụ: <em>'The local museum reopened in ___'</em>.",
      "Bước 2: Nhập từ/cụm từ đáp án chính xác vào ô <strong>'Đáp án đúng'</strong> phía dưới.",
      "Bước 3: Cấu hình giới hạn từ phù hợp (VD: <em>NO MORE THAN TWO WORDS</em>) ở phần cài đặt.",
    ],
  },
  "table-completion": {
    title: "Hướng dẫn soạn Table completion (Hoàn thành bảng):",
    steps: [
      "Bước 1: Soạn nội dung ô/hàng của bảng tương ứng với từng câu, ví dụ: <em>'Location: ___'</em>.",
      "Bước 2: Nhập đáp án đúng tương ứng cho câu đó vào ô <strong>'Đáp án đúng'</strong>.",
    ],
  },
  "flow-chart-completion": {
    title: "Hướng dẫn soạn Flow-chart completion (Hoàn thành sơ đồ tiến trình):",
    steps: [
      "Bước 1: Soạn nội dung mô tả bước tiến trình của câu hỏi tương ứng.",
      "Bước 2: Nhập đáp án đúng chính xác cần điền vào ô <strong>'Đáp án đúng'</strong>.",
    ],
  },
  "summary-completion": {
    title: "Hướng dẫn soạn Summary completion (Hoàn thành bản tóm tắt):",
    steps: [
      "Bước 1: Soạn nội dung đoạn tóm tắt chứa dấu trống <strong>'___'</strong> tương ứng với câu hỏi.",
      "Bước 2: Nhập từ/cụm từ đáp án chính xác vào ô <strong>'Đáp án đúng'</strong>.",
    ],
  },
  "sentence-completion": {
    title: "Hướng dẫn soạn Sentence completion (Hoàn thành câu):",
    steps: [
      "Bước 1: Soạn nội dung câu chưa hoàn chỉnh có chứa ô trống <strong>'___'</strong>.",
      "Bước 2: Nhập đáp án đúng chính xác cần điền vào ô <strong>'Đáp án đúng'</strong>.",
    ],
  },
  "short-answer": {
    title: "Hướng dẫn soạn Short-answer (Trả lời ngắn):",
    steps: [
      "Bước 1: Nhập câu hỏi ngắn cần trả lời, ví dụ: <em>'What is the maximum weight allowance?'</em>.",
      "Bước 2: Nhập từ/cụm từ chính xác được chấp nhận làm câu trả lời vào ô <strong>'Đáp án đúng'</strong>.",
    ],
  },
  "matching": {
    title: "Hướng dẫn soạn câu Matching (Nối chéo / Ghép cặp):",
    steps: [
      "Bước 1 (Tại câu đầu nhóm): Soạn danh sách các lựa chọn để ghép (ví dụ A: Name 1, B: Name 2...) tại khung <strong>'Bảng lựa chọn'</strong>.",
      "Bước 2 (Tại từng câu hỏi): Nhập tên mục cần ghép (ví dụ: tên một người, địa điểm...).",
      "Bước 3: Tại từng câu hỏi, chọn chữ cái tương ứng đúng (A, B, C...) từ dropdown đáp án.",
    ],
    note: "* Học viên sẽ thấy một bảng lựa chọn chung phía trên và các dropdown điền đáp án tương ứng ở từng câu.",
  },
  "plan-map-diagram": {
    title: "Hướng dẫn soạn Plan / Map / Diagram labelling (Nhãn sơ đồ/bản đồ):",
    steps: [
      "Bước 1: Nhập nhãn hoặc mô tả câu hỏi cần dán nhãn tương ứng trên sơ đồ/bản đồ.",
      "Bước 2: Điền đáp án đúng tương ứng với sơ đồ.",
    ],
  },
  "image-completion": {
    title: "Hướng dẫn soạn câu hỏi kèm hình ảnh (Image / Table):",
    steps: [
      "Bước 1: Tải lên hình ảnh đề bài chứa bản đồ/bảng biểu (ảnh này sẽ dùng chung cho toàn bộ nhóm câu hỏi).",
      "Bước 2: Tại từng câu hỏi được tự động sinh ra ở dưới, giáo viên chỉ cần nhập câu trả lời đúng tương ứng với nhãn/chỗ trống trên ảnh đề đã tải lên.",
    ],
  },
};

type ParsedInlineForm = {
  questions: Array<{
    questionNumber: number;
    questionText: string;
  }>;
};

function parseInlineFormText(text: string, startQuestionNumber: number): ParsedInlineForm {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const questions: ParsedInlineForm["questions"] = [];

  lines.forEach((line) => {
    const blankMatches = line.match(/_{3,}/g) ?? [];
    if (blankMatches.length === 0) return;
    blankMatches.forEach(() => {
      questions.push({
        questionNumber: startQuestionNumber + questions.length,
        questionText: line,
      });
    });
  });

  return { questions };
}

function buildInlineFormText(questions: ListeningQuestion[]): string {
  const rawFormText = questions.find((q) => q.formText != null)?.formText;
  if (rawFormText != null) return rawFormText;

  const lines: string[] = [];
  questions.forEach((q) => {
    if (!q.questionText.trim()) return;
    lines.push(q.questionText);
  });

  return lines.join("\n");
}

interface ListeningSection {
  sectionNumber: 1 | 2 | 3 | 4;
  sectionTitle?: string;
  sectionInstruction?: string;
  audioUrl: string;
  audioFileName: string;
  transcript: string;
  questions: ListeningQuestion[];
}

interface Props {
  examId?: string;
  testType: IeltsTestType;
  initialData?: any;
  onSave: (data: any) => void;
}

const buildEmptySection = (n: 1 | 2 | 3 | 4): ListeningSection => {
  const start = (n - 1) * 10 + 1;
  return {
    sectionNumber: n,
    sectionTitle: "",
    sectionInstruction: "",
    audioUrl: "",
    audioFileName: "",
    transcript: "",
    questions: Array.from({ length: 10 }, (_, i) => ({
      id: `s${n}-q${start + i}`,
      questionNumber: start + i,
      questionType: "multiple-choice",
      questionText: "",
      options: { A: "", B: "", C: "", D: "" },
      correctAnswer: "A",
    })),
  };
};

export function IeltsListeningEditor({ examId, initialData, onSave }: Props) {
  const [sections, setSections] = useState<ListeningSection[]>(() => {
    const empty = [1, 2, 3, 4].map((n) => buildEmptySection(n as 1 | 2 | 3 | 4));
    if (!initialData?.sections) return empty;
    // Normalize incoming sections để tránh field null gây React warning
    // (vd transcript=null từ backend → textarea phàn nàn).
    return empty.map((emptySec) => {
      const incoming = initialData.sections.find(
        (s: any) => s.sectionNumber === emptySec.sectionNumber
      );
      if (!incoming) return emptySec;
      return {
        ...emptySec,
        ...incoming,
        sectionTitle: incoming.sectionTitle ?? "",
        sectionInstruction: incoming.sectionInstruction ?? "",
        audioUrl: incoming.audioUrl ?? "",
        audioFileName: incoming.audioFileName ?? "",
        transcript: incoming.transcript ?? "",
        questions: (incoming.questions ?? emptySec.questions).map((q: any) => {
          const qType = q.questionType ?? "multiple-choice";
          const isMcq = qType === "multiple-choice" || qType === "multiple-choice-group";
          const imgComp = isImageCompletion(qType);
          const correctAnswer = q.correctAnswer ?? (isMcq ? "A" : "");
          return {
            ...q,
            questionText: q.questionText ?? "",
            taskTitle: q.taskTitle ?? "",
            taskInstruction: q.taskInstruction ?? "",
            taskImage: q.taskImage ?? "",
            taskImageFileName: q.taskImageFileName ?? "",
            correctAnswer: isMcq && !correctAnswer.trim() ? "A" : correctAnswer,
            options: imgComp ? undefined : (q.options ?? { A: "", B: "", C: "", D: "" }),
          };
        }),
      };
    });
  });
  const [activeSection, setActiveSection] = useState<1 | 2 | 3 | 4>(1);
  const [uploadingSection, setUploadingSection] = useState<number | null>(null);
  // Tập các section đang transcribe — Set để nhiều section chạy SONG SONG.
  const [transcribingSections, setTranscribingSections] = useState<Set<number>>(new Set());
  const [modelLoadingPct, setModelLoadingPct] = useState<number | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [enableDiarization, setEnableDiarization] = useState(true);
  const autoSaveTimerRef = useRef<number | null>(null);

  const markTranscribing = useCallback((n: number, on: boolean) => {
    setTranscribingSections((prev) => {
      const next = new Set(prev);
      on ? next.add(n) : next.delete(n);
      return next;
    });
  }, []);

  const current = sections.find((s) => s.sectionNumber === activeSection)!;
  const partInfo = IELTS_STRUCTURE.listening.parts[activeSection - 1];

  const updateSection = useCallback(
    (n: number, patch: Partial<ListeningSection>) => {
      setSections((prev) =>
        prev.map((s) => (s.sectionNumber === n ? { ...s, ...patch } : s))
      );
    },
    []
  );

  const updateQuestion = useCallback(
    (secNum: number, qIdx: number, patch: Partial<ListeningQuestion>) => {
      setSections((prev) =>
        prev.map((s) => {
          if (s.sectionNumber !== secNum) return s;
          const questions = [...s.questions];
          questions[qIdx] = { ...questions[qIdx], ...patch };
          return { ...s, questions };
        })
      );
    },
    []
  );

  /**
   * Một "nhóm" = dải câu LIỀN NHAU cùng questionType trong 1 section.
   * Khi sửa cài đặt dùng chung của nhóm (instruction, options, wordLimit,
   * selectCount, useWordBank) → áp cho mọi câu trong đúng nhóm đó (không phải
   * toàn section). Trả về [start, end] của nhóm chứa qIdx.
   */
  const groupRangeOf = useCallback(
    (questions: ListeningQuestion[], qIdx: number): [number, number] => {
      const type = questions[qIdx]?.questionType;
      let start = qIdx;
      let end = qIdx;
      while (start - 1 >= 0 && questions[start - 1].questionType === type) start--;
      while (end + 1 < questions.length && questions[end + 1].questionType === type) end++;
      return [start, end];
    },
    []
  );

  const patchGroupAt = useCallback(
    (secNum: number, qIdx: number, patch: Partial<ListeningQuestion>) => {
      setSections((prev) =>
        prev.map((s) => {
          if (s.sectionNumber !== secNum) return s;
          const [start, end] = groupRangeOf(s.questions, qIdx);
          return {
            ...s,
            questions: s.questions.map((q, i) =>
              i >= start && i <= end ? { ...q, ...patch } : q
            ),
          };
        })
      );
    },
    [groupRangeOf]
  );

  /**
   * Thêm 1 đáp án (option) cho MCQ — áp cho cả nhóm. Chữ cái kế tiếp theo
   * số option hiện có (A,B,C,D → E). correctAnswer không đổi.
   */
  const addOptionAt = useCallback(
    (secNum: number, qIdx: number) => {
      const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
      setSections((prev) =>
        prev.map((s) => {
          if (s.sectionNumber !== secNum) return s;
          const [start, end] = groupRangeOf(s.questions, qIdx);
          const base = s.questions[start].options || {};
          const keys = Object.keys(base).filter((k) => /^[A-Za-z]$/.test(k)).sort();
          if (keys.length >= LETTERS.length) return s;
          const nextLetter = LETTERS[keys.length];
          return {
            ...s,
            questions: s.questions.map((q, i) =>
              // Mỗi câu GIỮ NGUYÊN text riêng, chỉ thêm chữ cái mới (rỗng).
              i >= start && i <= end
                ? { ...q, options: { ...(q.options || {}), [nextLetter]: "" } }
                : q
            ),
          };
        })
      );
    },
    [groupRangeOf]
  );

  /**
   * Xóa 1 đáp án (option) cho MCQ — áp cho cả nhóm. Sau khi xóa sẽ ĐÁNH LẠI
   * chữ cái liên tục (A,B,C…) tránh lỗ hổng, đồng thời cập nhật correctAnswer
   * của TỪNG câu trong nhóm theo mapping mới (hỗ trợ cả multi-select "A,C").
   * Mỗi câu giữ NGUYÊN text riêng của mình (Q17.A khác Q18.A).
   */
  const removeOptionAt = useCallback(
    (secNum: number, qIdx: number, keyToRemove: string) => {
      const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
      setSections((prev) =>
        prev.map((s) => {
          if (s.sectionNumber !== secNum) return s;
          const [start, end] = groupRangeOf(s.questions, qIdx);
          const base = s.questions[start].options || {};
          const keys = Object.keys(base).filter((k) => /^[A-Za-z]$/.test(k)).sort();
          if (keys.length <= 2) return s; // giữ tối thiểu 2 đáp án

          // Mapping chữ cái cũ → mới (dựa trên cấu trúc key của nhóm).
          const remaining = keys.filter((k) => k !== keyToRemove);
          const remap: Record<string, string> = {};
          remaining.forEach((oldKey, i) => {
            remap[oldKey] = LETTERS[i];
          });

          const remapAnswer = (ans: string): string => {
            const parts = (ans || "")
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean);
            const mapped = parts
              .filter((p) => p !== keyToRemove)
              .map((p) => remap[p] ?? p);
            return mapped.join(",");
          };

          return {
            ...s,
            questions: s.questions.map((q, i) => {
               if (i < start || i > end) return q;
               const isMcq = q.questionType === "multiple-choice" || q.questionType === "multiple-choice-group";
              // Dựng lại options của TỪNG câu, giữ text riêng theo mapping.
              const qKeys = Object.keys(q.options || {})
                .filter((k) => /^[A-Za-z]$/.test(k))
                .sort();
              const qRemaining = qKeys.filter((k) => k !== keyToRemove);
              const nextOptions: Record<string, string> = {};
              qRemaining.forEach((oldKey, idx) => {
                nextOptions[LETTERS[idx]] = (q.options as any)?.[oldKey] ?? "";
              });
              const nextAnswer = remapAnswer(q.correctAnswer);
              return {
                ...q,
                options: nextOptions,
                // MCQ chọn 1: nếu đáp án đúng bị xóa → về A; multi/khác giữ mapping.
                correctAnswer:
                  isMcq && (q.selectCount ?? 1) <= 1
                    ? nextAnswer || "A"
                    : nextAnswer,
              };
            }),
          };
        })
      );
    },
    [groupRangeOf]
  );

  const applyInlineFormText = useCallback(
    (secNum: number, qIdx: number, formText: string) => {
      setSections((prev) =>
        prev.map((s) => {
          if (s.sectionNumber !== secNum) return s;

          const sectionStart = (secNum - 1) * 10 + 1;
          const sectionEnd = sectionStart + 9;
          const [currentGroupStart, currentGroupEnd] = groupRangeOf(s.questions, qIdx);
          const startQuestionNumber = s.questions[currentGroupStart]?.questionNumber ?? sectionStart;
          const parsed = parseInlineFormText(formText, startQuestionNumber);
          const parsedByNumber = new Map(parsed.questions.map((q) => [q.questionNumber, q]));
          const start = currentGroupStart;
          const end = Math.min(
            sectionEnd - sectionStart,
            parsed.questions.length > 0 ? start + parsed.questions.length - 1 : start
          );

          return {
            ...s,
            questions: s.questions.map((q, i) => {
              if (i < start) return q;
              if (i > end && i <= currentGroupEnd) {
                return {
                  ...q,
                  questionType: "multiple-choice",
                  questionText: "",
                  taskInstruction: "",
                  formText: undefined,
                  wordLimit: undefined,
                  useWordBank: undefined,
                  correctAnswer: "A",
                  options: { A: "", B: "", C: "", D: "" },
                };
              }
              if (i > end) return q;
              const item = parsedByNumber.get(q.questionNumber);
              return {
                ...q,
                questionType: "form-completion",
                questionText: item ? item.questionText : "",
                formText,
                wordLimit: q.wordLimit || "ONE WORD AND/OR A NUMBER",
                options: undefined,
              };
            }),
          };
        })
      );
    },
    [groupRangeOf]
  );

  const changeQuestionType = useCallback(
    (secNum: number, qIdx: number, newType: string) => {
      setSections((prev) =>
        prev.map((s) => {
          if (s.sectionNumber !== secNum) return s;

          const normalizeForType = (q: ListeningQuestion): ListeningQuestion => ({
            ...q,
            questionType: newType,
            selectCount: undefined,
            wordLimit: newType === "form-completion" ? "ONE WORD AND/OR A NUMBER" : undefined,
            useWordBank: undefined,
            taskImage: isImageCompletion(newType) ? q.taskImage : undefined,
            taskImageFileName: isImageCompletion(newType) ? q.taskImageFileName : undefined,
            correctAnswer:
              (newType === "multiple-choice" || newType === "multiple-choice-group") && !q.correctAnswer?.trim()
                ? "A"
                : "",
            options: isListeningMatching(newType)
              ? (q.options && Object.keys(q.options).length ? q.options : { A: "", B: "", C: "" })
              : (newType === "multiple-choice" || newType === "multiple-choice-group")
                ? (q.options ?? { A: "", B: "", C: "", D: "" })
                : undefined,
          });

          return {
            ...s,
            questions: s.questions.map((q, i) => {
              return i === qIdx ? normalizeForType(q) : q;
            }),
          };
        })
      );
    },
    []
  );

  const handleAudioUpload = async (file: File) => {
    if (!examId) {
      alert("Vui lòng đợi exam được tạo trước khi upload audio");
      return;
    }
    setUploadingSection(activeSection);
    let uploadedUrl = "";
    try {
      const fd = new FormData();
      fd.append("audio", file);
      fd.append("section", String(activeSection));
      const res = await api.post(
        `/teacher/exams/${examId}/ielts/listening/sections/${activeSection}/audio`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      uploadedUrl = res.data?.audio_url || res.data?.data?.audio_url || "";
      if (uploadedUrl) {
        updateSection(activeSection, { audioUrl: uploadedUrl, audioFileName: file.name });
      }
    } catch (err: any) {
      console.error("Audio upload failed:", err);
      // Fallback: dùng object URL local — vẫn cho transcribe được
      uploadedUrl = URL.createObjectURL(file);
      updateSection(activeSection, { audioUrl: uploadedUrl, audioFileName: file.name });
    } finally {
      setUploadingSection(null);
    }

    // Auto STT: nếu section chưa có transcript thì tự động chạy
    const currentTranscript = sections.find((s) => s.sectionNumber === activeSection)?.transcript || "";
    if (!currentTranscript.trim()) {
      void runTranscribe(file, activeSection);
    }
  };

  /**
   * Chạy Speech-to-Text. Ưu tiên Groq Whisper (whisper-large-v3-turbo) — nhanh,
   * không tốn RAM trình duyệt. Fallback Whisper LOCAL (transformers.js) khi Groq lỗi.
   *
   * Nếu enableDiarization = true: sau khi có text, gửi lên backend Groq LLM
   * để phân tách speaker A/B dựa trên ngữ nghĩa (chính xác hơn pitch).
   */
  const runTranscribe = async (file: File, sectionNum: 1 | 2 | 3 | 4) => {
    markTranscribing(sectionNum, true);
    setTranscribeError(null);
    let lastUpdate = 0;
    let lastPctRef = -1;
    try {
      const onProgress = (info: any) => {
        if (info.status === "progress" && typeof info.progress === "number") {
          const pct = Math.round(info.progress);
          const now = Date.now();
          if (pct !== lastPctRef && now - lastUpdate > 100) {
            lastPctRef = pct;
            lastUpdate = now;
            setModelLoadingPct(pct);
          }
        } else if (info.status === "done" || info.status === "ready") {
          setModelLoadingPct(null);
        }
      };

      // Step 1: STT. Ưu tiên Groq Whisper (whisper-large-v3-turbo) — nhanh vài
      // giây, không tải model ~40MB vào trình duyệt, không tốn RAM (tránh lỗi
      // std::bad_alloc của Whisper local). Nếu Groq lỗi → fallback Whisper-in-browser.
      let rawText = "";
      try {
        const groqFile =
          file instanceof File ? file : new File([file], "audio.mp3", { type: "audio/mpeg" });
        rawText = (await transcribeGroq(groqFile, "en")).trim();
      } catch (groqErr: any) {
        console.warn("Groq STT failed, fallback to in-browser Whisper:", groqErr?.message);
        rawText = (await transcribeLocal(file, { language: "en", onProgress })).trim();
      }
      setModelLoadingPct(null);

      if (!rawText) {
        setTranscribeError("Không nhận được transcript. Vui lòng nhập thủ công.");
        return;
      }

      // Step 2: Diarize nếu bật (gọi Groq qua backend)
      let finalText = rawText;
      if (enableDiarization && rawText.split(/\s+/).length > 10) {
        try {
          const res = await api.post("/teacher/ielts/diarize-transcript", {
            transcript: rawText,
            max_speakers: 2,
          });
          const lines = res.data?.data?.speaker_lines;
          if (Array.isArray(lines) && lines.length > 0) {
            // Kiểm tra có thật sự > 1 speaker
            const hasBoth = lines.some((l: string) => l.startsWith("A:")) &&
                            lines.some((l: string) => l.startsWith("B:"));
            if (hasBoth) {
              finalText = lines.join("\n");
            }
          }
        } catch (dErr: any) {
          // Groq fail → vẫn dùng raw text, không block user
          console.warn("Diarize failed, using raw transcript:", dErr?.message);
        }
      }

      updateSection(sectionNum, { transcript: finalText });
    } catch (err: any) {
      console.error("Transcribe failed:", err);
      setModelLoadingPct(null);
      setTranscribeError(
        err?.message?.includes("scale")
          ? "Model AI gặp sự cố tương thích. Vui lòng nhập transcript thủ công."
          : err?.message || "Không thể tự động chuyển audio thành text. Vui lòng nhập thủ công."
      );
    } finally {
      markTranscribing(sectionNum, false);
    }
  };

  /**
   * Cho phép user chủ động re-run STT từ audio đã upload (re-fetch file qua URL).
   */
  const handleManualTranscribe = async () => {
    if (!current.audioUrl) return;
    markTranscribing(activeSection, true);
    setTranscribeError(null);
    try {
      const resp = await fetch(current.audioUrl);
      const blob = await resp.blob();
      const fileName = current.audioFileName || "audio.mp3";
      const file = new File([blob], fileName, { type: blob.type || "audio/mpeg" });
      await runTranscribe(file, activeSection);
    } catch (err: any) {
      console.error("Manual transcribe failed:", err);
      setTranscribeError("Không thể tải lại file audio. Vui lòng upload lại.");
      markTranscribing(activeSection, false);
    }
  };


  const completedSections = sections.filter(
    (s) => s.audioUrl && s.questions.some((q) => q.questionText.trim())
  ).length;

  // Debounced auto-save: chờ 1.5s sau lần cuối cùng sections thay đổi.
  // Không save khi đang transcribe để tránh spam HTTP + lag giao diện.
  useEffect(() => {
    // Bỏ qua khi đang xử lý STT (bất kỳ section nào) — transcript update nhiều lần
    if (transcribingSections.size > 0) return;

    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      onSave({ sections });
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, transcribingSections]);

  // Section đang xem có đang transcribe không (dùng cho UI nút/banner).
  const isActiveTranscribing = transcribingSections.has(activeSection);

  return (
    <div className="space-y-5">
      {/* ── Section tabs ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-4 divide-x divide-gray-100">
          {sections.map((s) => {
            const isActive = s.sectionNumber === activeSection;
            const hasAudio = !!s.audioUrl;
            const filledQs = s.questions.filter((q) =>
              q.questionType === "image-completion"
                ? (q.correctAnswer ?? "").trim() !== ""
                : q.questionText.trim()
            ).length;
            const isSecTranscribing = transcribingSections.has(s.sectionNumber);
            return (
              <button
                key={s.sectionNumber}
                type="button"
                onClick={() => setActiveSection(s.sectionNumber)}
                className="px-4 py-3 text-left transition-all cursor-pointer relative"
                style={{
                  background: isActive ? "#EFF6FF" : "#FFFFFF",
                  borderBottom: isActive ? "3px solid #2563EB" : "3px solid transparent",
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-xs font-bold"
                    style={{ color: isActive ? "#1D4ED8" : "#6B7280" }}
                  >
                    Section {s.sectionNumber}
                  </span>
                  {isSecTranscribing ? (
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  ) : hasAudio && filledQs === 10 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : null}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-gray-500">
                  <Volume2 className="w-3 h-3" />
                  <span className={hasAudio ? "text-emerald-600 font-medium" : ""}>
                    {hasAudio ? "Audio ✓" : "Cần audio"}
                  </span>
                  <span className="text-gray-300">·</span>
                  {isSecTranscribing ? (
                    <span className="text-blue-600 font-medium">Đang nhận dạng…</span>
                  ) : (
                    <span>{filledQs}/10 câu</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Section header ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Headphones className="w-4 h-4 text-blue-600" />
              {partInfo.name}
            </h3>
            <p className="text-xs text-gray-500 mt-1">{partInfo.description}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-600 tabular-nums">
              {current.questions.filter((q) => q.questionText.trim()).length}
              <span className="text-sm text-gray-400 font-normal">/10</span>
            </p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">
              câu hoàn thành
            </p>
          </div>
        </div>

        {/* Toggle tiêu đề part tùy chỉnh — tách riêng */}
        <div className="flex items-center gap-2 mb-3">
          <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!current.sectionTitle}
              onChange={(e) => {
                const on = e.target.checked;
                updateSection(activeSection, { sectionTitle: on ? (partInfo?.name ?? "") : "" });
              }}
              className="w-3.5 h-3.5 accent-blue-500"
            />
            <span className={current.sectionTitle ? "text-blue-600 font-medium" : ""}>
              {current.sectionTitle ? "Hiển thị tiêu đề part tùy chỉnh" : "Hiển thị tiêu đề part tùy chỉnh"}
            </span>
          </label>
        </div>

        {/* Tiêu đề part (chủ đề) — chỉ hiện khi bật toggle */}
        {!!current.sectionTitle && (
          <div className="mb-4 rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Tiêu đề part (chủ đề)
              </span>
            </div>
            <div className="p-3">
              <input
                type="text"
                value={current.sectionTitle || ""}
                onChange={(e) =>
                  updateSection(activeSection, { sectionTitle: e.target.value })
                }
                placeholder="VD: Restaurant recommendations, Pottery class..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
              />
            </div>
          </div>
        )}

        {/* Yêu cầu đề (instruction) */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
            Yêu cầu đề (instruction)
          </label>
          <textarea
            value={current.sectionInstruction || ""}
            onChange={(e) =>
              updateSection(activeSection, { sectionInstruction: e.target.value })
            }
            rows={2}
            placeholder="VD: Complete the notes below. Write ONE WORD ONLY for each answer."
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all resize-y"
          />
          <p className="mt-1 text-[11px] text-gray-400">
            Hiển thị cho học viên ở banner "Yêu cầu" trước mỗi part. Sao chép đúng dòng yêu cầu trong đề.
          </p>
        </div>

        {/* Audio upload */}
        <div
          className="rounded-xl p-4 border-2 border-dashed transition-all"
          style={{
            background: current.audioUrl ? "#F0FDF4" : "#F9FAFB",
            borderColor: current.audioUrl ? "#86EFAC" : "#E5E7EB",
          }}
        >
          {current.audioUrl ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Volume2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {current.audioFileName || "audio.mp3"}
                </p>
                <audio src={current.audioUrl} controls className="w-full mt-2 h-8" />
              </div>
              <button
                type="button"
                onClick={() =>
                  updateSection(activeSection, { audioUrl: "", audioFileName: "" })
                }
                className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-3 py-6 cursor-pointer hover:bg-gray-50 rounded-lg transition-all">
              {uploadingSection === activeSection ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Đang upload...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">
                    Tải lên audio cho Section {activeSection}
                  </span>
                  <span className="text-xs text-gray-400">(.mp3, .wav, .m4a)</span>
                </>
              )}
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAudioUpload(f);
                }}
              />
            </label>
          )}
        </div>

        {/* Transcript (optional) */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
              Transcript (tuỳ chọn)
            </label>
            <div className="flex items-center gap-2">
              {/* Toggle diarization 2-speaker */}
              <label className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-gray-600 hover:text-gray-900 cursor-pointer select-none transition-colors">
                <input
                  type="checkbox"
                  checked={enableDiarization}
                  onChange={(e) => setEnableDiarization(e.target.checked)}
                  className="w-3 h-3 cursor-pointer accent-blue-600"
                />
                <span>Tách giọng A/B</span>
              </label>
              {current.audioUrl && (
                <button
                  type="button"
                  onClick={handleManualTranscribe}
                  disabled={isActiveTranscribing}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {isActiveTranscribing ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Đang nhận dạng...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3 h-3" />
                      {current.transcript ? "Tạo lại từ audio" : "Tự động chuyển audio → text"}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          <textarea
            value={current.transcript ?? ""}
            onChange={(e) =>
              updateSection(activeSection, { transcript: e.target.value })
            }
            placeholder={
              isActiveTranscribing
                ? "Đang nhận dạng giọng nói, vui lòng chờ..."
                : "Dán transcript của audio vào đây để hỗ trợ chấm điểm... (hoặc upload audio để tự động tạo)"
            }
            rows={4}
            disabled={isActiveTranscribing}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none disabled:bg-gray-50 disabled:text-gray-400"
          />
          {/* Status banner — gộp loading + error vào 1 block, không gây giật khi mount/unmount.
              Dùng will-change để tối ưu re-paint, fixed height để không layout-shift textarea phía trên. */}
          {(isActiveTranscribing || transcribeError) && (
            <div
              className={`mt-2 flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] border ${
                transcribeError
                  ? "bg-rose-50/80 text-rose-700 border-rose-200"
                  : "bg-blue-50/70 text-blue-700 border-blue-100"
              }`}
            >
              {isActiveTranscribing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    {modelLoadingPct !== null && modelLoadingPct < 100 ? (
                      <div className="flex items-center gap-2">
                        <span className="font-medium tabular-nums">
                          Đang tải Whisper model lần đầu… {modelLoadingPct}%
                        </span>
                        <div
                          className="flex-1 max-w-[200px] h-1.5 bg-blue-100 rounded-full overflow-hidden"
                          aria-hidden
                        >
                          <div
                            className="h-full bg-blue-500"
                            style={{
                              width: `${modelLoadingPct}%`,
                              transition: "width 200ms linear",
                              willChange: "width",
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="font-medium">Whisper AI đang xử lý audio…</span>
                    )}
                  </div>
                </>
              ) : transcribeError ? (
                <>
                  <span className="text-rose-500 flex-shrink-0">⚠</span>
                  <span className="flex-1 min-w-0 leading-snug">{transcribeError}</span>
                  <button
                    type="button"
                    onClick={() => setTranscribeError(null)}
                    className="flex-shrink-0 text-rose-600 hover:text-rose-800 text-xs font-semibold cursor-pointer"
                    aria-label="Đóng"
                  >
                    ✕
                  </button>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* ── Questions ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h4 className="text-sm font-bold text-gray-900">
            Câu hỏi {(activeSection - 1) * 10 + 1} – {activeSection * 10}
          </h4>
          <span className="text-xs text-gray-500">10 câu / section</span>
        </div>

        <div className="space-y-3">
          {current.questions.map((q, idx) => {
            let groupStart = idx;
            let groupEnd = idx;
            while (
              groupStart - 1 >= 0 &&
              current.questions[groupStart - 1].questionType === q.questionType
            ) {
              groupStart--;
            }
            while (
              groupEnd + 1 < current.questions.length &&
              current.questions[groupEnd + 1].questionType === q.questionType
            ) {
              groupEnd++;
            }
            const isGroupStart = idx === groupStart;
            const groupSize = groupEnd - groupStart + 1;
            const groupQuestions = current.questions.slice(groupStart, groupEnd + 1);
            const isImgCompStart = isGroupStart && isImageCompletion(q.questionType);
            return (
              <>
                {isImgCompStart && (
                  <ImageTaskBlock
                    key={`img-${q.id}`}
                    question={q}
                    groupSize={groupSize}
                    sectionNumber={activeSection}
                    examId={examId}
                    onPatchGroup={patchGroupAt}
                  />
                )}
                <ListeningQuestionRow
                  key={q.id}
                  question={q}
                  sectionNumber={activeSection}
                  index={idx}
                  isGroupStart={isGroupStart}
                  groupSize={groupSize}
                  groupStartNumber={current.questions[groupStart].questionNumber}
                  groupEndNumber={current.questions[groupEnd].questionNumber}
                  groupPosition={
                    groupSize <= 1
                      ? "single"
                      : idx === groupStart
                        ? "start"
                        : idx === groupEnd
                          ? "end"
                          : "middle"
                  }
                  examId={examId}
                  onPatch={updateQuestion}
                  onPatchGroup={patchGroupAt}
                  onApplyInlineFormText={applyInlineFormText}
                  onChangeQuestionType={changeQuestionType}
                  onAddOption={addOptionAt}
                  onRemoveOption={removeOptionAt}
                  groupQuestions={groupQuestions}
                />
              </>
            );
          })}
        </div>
      </div>

      {/* ── Bottom progress ─────────────────────────────────── */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 p-4 sticky bottom-0">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-1">
            {sections.map((s) => {
              const done =
                !!s.audioUrl && s.questions.every((q) =>
                  isImageCompletion(q.questionType) ? !!q.correctAnswer.trim() : !!q.questionText.trim()
                );
              return (
                <div
                  key={s.sectionNumber}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white"
                  style={{
                    background: done
                      ? "#10B981"
                      : s.sectionNumber === activeSection
                      ? "#2563EB"
                      : "#E5E7EB",
                    color: done || s.sectionNumber === activeSection ? "#FFF" : "#6B7280",
                  }}
                >
                  {s.sectionNumber}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-600 font-medium">
            {completedSections}/4 sections hoàn thành
          </p>
        </div>
        <p className="text-xs text-gray-400">
          Dùng nút <span className="font-semibold text-gray-600">Lưu nháp</span> hoặc{" "}
          <span className="font-semibold text-gray-600">Xuất bản</span> ở thanh trên cùng để lưu.
        </p>
      </div>

    </div>
  );
}

// ─── Question row ─────────────────────────────────────────────────────────
// Memoized: chỉ re-render khi question thay đổi.
// Dùng (sectionNumber, index, onPatch stable) để tránh tạo callback mới mỗi parent render.
const ListeningQuestionRow = memo(function ListeningQuestionRow({
  question,
  sectionNumber,
  index,
  isGroupStart = false,
  groupSize = 1,
  groupStartNumber,
  groupEndNumber,
  groupPosition = "single",
  groupQuestions = [],
  examId,
  onPatch,
  onPatchGroup,
  onApplyInlineFormText,
  onChangeQuestionType,
  onAddOption,
  onRemoveOption,
}: {
  question: ListeningQuestion;
  sectionNumber: number;
  index: number;
  /** True nếu đây là câu ĐẦU của một nhóm (dải liền nhau cùng dạng) → hiện cài đặt dùng chung. */
  isGroupStart?: boolean;
  /** Số câu trong nhóm (để hiển thị "Câu N–M"). */
  groupSize?: number;
  groupStartNumber?: number;
  groupEndNumber?: number;
  groupPosition?: "single" | "start" | "middle" | "end";
  groupQuestions?: ListeningQuestion[];
  examId?: string;
  onPatch: (secNum: number, qIdx: number, patch: Partial<ListeningQuestion>) => void;
  onPatchGroup?: (secNum: number, qIdx: number, patch: Partial<ListeningQuestion>) => void;
  onApplyInlineFormText: (secNum: number, qIdx: number, formText: string) => void;
  onChangeQuestionType: (secNum: number, qIdx: number, newType: string) => void;
  onAddOption?: (secNum: number, qIdx: number) => void;
  onRemoveOption?: (secNum: number, qIdx: number, key: string) => void;
}) {
  const isMcq = question.questionType === "multiple-choice" || question.questionType === "multiple-choice-group";
  const isMatching = isListeningMatching(question.questionType);
  const completion = isListeningCompletion(question.questionType);
  const isImgCompletion = isImageCompletion(question.questionType);
  const isInlineForm = isFormCompletion(question.questionType);
  const isGrouped = groupSize > 1;
  const groupLabel = isGrouped
    ? `Nhóm ${groupStartNumber ?? question.questionNumber}–${groupEndNumber ?? question.questionNumber}`
    : "";
  const groupAccent = isInlineForm
    ? {
        border: "#93C5FD",
        bg: "#EFF6FF",
        softBg: "#DBEAFE",
        text: "#1D4ED8",
      }
    : {
        border: "#C7D2FE",
        bg: "#F5F3FF",
        softBg: "#EDE9FE",
        text: "#5B21B6",
      };
  const wordBank = completion && !!question.useWordBank;
  const selectCount = question.selectCount ?? 1;
  const isMultiMcq = isMcq && selectCount > 1;
  const handleChange = (patch: Partial<ListeningQuestion>) => onPatch(sectionNumber, index, patch);
  const handleGroup = (patch: Partial<ListeningQuestion>) =>
    (onPatchGroup ?? ((s, _i, p) => onPatch(s, index, p)))(sectionNumber, index, patch);
  const [showGuide, setShowGuide] = useState(false);
  const formText = buildInlineFormText(groupQuestions.length ? groupQuestions : [question]);
  const formBlankCount = (formText.match(/_{3,}/g) ?? []).length;
  const formTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isGroupStart || !isInlineForm || !formTextareaRef.current) return;
    const textarea = formTextareaRef.current;
    const maxHeight = 520;

    textarea.style.height = "auto";
    const nextHeight = Math.min(maxHeight, Math.max(220, textarea.scrollHeight));
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [formText, isGroupStart, isInlineForm]);

  const optionKeys = Object.keys(question.options || {})
    .filter((k) => /^[A-Za-z]+$/.test(k))
    .sort();
  const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
  // Multi-select MCQ lưu "A,C".
  const selectedSet = new Set(
    (question.correctAnswer || "").split(",").map((s) => s.trim()).filter(Boolean)
  );
  const toggleMulti = (k: string) => {
    const next = new Set(selectedSet);
    if (next.has(k)) next.delete(k);
    else {
      if (next.size >= selectCount) return;
      next.add(k);
    }
    handleChange({ correctAnswer: Array.from(next).sort().join(",") });
  };
  return (
    <div
      className={[
        "rounded-xl border p-3 transition-all relative",
        isGrouped ? "hover:shadow-sm" : "border-gray-200 hover:border-blue-300",
      ].join(" ")}
      style={
        isGrouped
          ? {
              borderColor: groupAccent.border,
              background: groupAccent.bg,
              boxShadow: isGroupStart ? `inset 4px 0 0 ${groupAccent.border}` : undefined,
            }
          : undefined
      }
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
          {question.questionNumber}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {/* ── Question type selector + group controls ── */}
          <div className="flex flex-wrap items-center gap-2">
            {isGrouped && (
              <span
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold"
                style={{ background: groupAccent.softBg, color: groupAccent.text }}
                title={
                  isGroupStart
                    ? "Câu đầu nhóm: chỉnh cài đặt áp dụng cho cả nhóm"
                    : `Câu này thuộc ${groupLabel}; cài đặt chung nằm ở câu ${groupStartNumber}`
                }
              >
                {groupPosition === "start"
                  ? `${groupLabel} · đầu nhóm`
                  : groupPosition === "end"
                    ? `${groupLabel} · cuối nhóm`
                    : groupLabel}
              </span>
            )}
            <select
              value={question.questionType}
              onChange={(e) => {
                const newType = e.target.value;
                onChangeQuestionType(sectionNumber, index, newType);
              }}
              className="text-xs font-medium px-2 py-1 border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {IELTS_LISTENING_QUESTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            {/* Cài đặt dùng chung của nhóm — chỉ hiện ở câu đầu nhóm */}
            {isGroupStart && isMcq && (
              <label className="flex items-center gap-1.5 text-[11px] text-gray-600">
                Số đáp án chọn:
                <select
                  value={selectCount}
                  onChange={(e) =>
                    handleGroup({
                      selectCount: Number(e.target.value) > 1 ? Number(e.target.value) : undefined,
                    })
                  }
                  className="px-2 py-1 border border-gray-300 rounded-md bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>1 (chọn 1)</option>
                  <option value={2}>2 (Choose TWO)</option>
                  <option value={3}>3 (Choose THREE)</option>
                </select>
              </label>
            )}
            {isGroupStart && completion && (
              <>
                <label className="flex items-center gap-1.5 text-[11px] text-gray-600">
                  Giới hạn từ:
                  <select
                    value={question.wordLimit ?? ""}
                    onChange={(e) =>
                      handleGroup({ wordLimit: e.target.value || undefined })
                    }
                    className="px-2 py-1 border border-gray-300 rounded-md bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {WORD_LIMIT_OPTS.map((w) => (
                      <option key={w} value={w}>
                        {w === "" ? "Không giới hạn" : w}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!question.useWordBank}
                    onChange={(e) => {
                      const on = e.target.checked;
                      handleGroup({
                        useWordBank: on || undefined,
                        options: on
                          ? question.options && Object.keys(question.options).length
                            ? question.options
                            : { A: "", B: "", C: "", D: "" }
                          : undefined,
                        ...(on ? {} : { correctAnswer: "" }),
                      });
                    }}
                    className="w-3.5 h-3.5 accent-blue-500"
                  />
                  Dùng word bank
                </label>
              </>
            )}
            {isGrouped && !isGroupStart && (
              <span className="text-[11px] text-gray-500">
                Dùng cài đặt chung ở câu {groupStartNumber}
              </span>
            )}
            {QUESTION_TYPE_GUIDES[question.questionType] && (
              <button
                type="button"
                onClick={() => setShowGuide(prev => !prev)}
                className="inline-flex items-center gap-1 px-2 py-1.5 border border-blue-200 rounded-md bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 cursor-pointer transition-all ml-auto"
              >
                ℹ️ {showGuide ? "Ẩn hướng dẫn" : "Hiện hướng dẫn"}
              </button>
            )}
          </div>

          {showGuide && QUESTION_TYPE_GUIDES[question.questionType] && (() => {
            const guide = QUESTION_TYPE_GUIDES[question.questionType];
            return (
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-900 space-y-1.5 animate-fadeIn">
                <p className="font-bold text-blue-800 flex items-center gap-1">
                  {guide.title}
                </p>
                <ul className="list-disc pl-4 space-y-1 text-gray-700">
                  {guide.steps.map((step, idx) => (
                    <li key={idx} dangerouslySetInnerHTML={{ __html: step }} />
                  ))}
                </ul>
                {question.questionType === "multiple-choice-group" && (
                  <div className="mt-2 pt-2 border-t border-blue-100/50">
                    <p className="font-semibold text-blue-800 mb-1">Giao diện học viên khi làm bài sẽ trông như thế này:</p>
                    <img
                      src="/images/ielts_student_grouped_mcq_ui.png"
                      alt="Student MCQ Group UI Preview"
                      className="rounded border border-blue-200 shadow-sm max-w-[280px] sm:max-w-[400px] h-auto"
                    />
                  </div>
                )}
                {guide.note && (
                  <p className="text-[10px] text-gray-500 italic mt-1 border-t border-blue-100/50 pt-1">
                    {guide.note}
                  </p>
                )}
              </div>
            );
          })()}

          {!isImgCompletion && (
            !isInlineForm && (
              <RichTextInput
                value={question.questionText}
                onChange={(html) => handleChange({ questionText: html })}
                placeholder={isMatching ? "Tên mục cần ghép (vd: kettle, alarm clock...)" : "Nội dung câu hỏi..."}
                className="w-full"
              />
            )
          )}

          {isGroupStart && isInlineForm && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="block text-[11px] font-bold uppercase tracking-wide text-blue-700">
                  Nội dung form - mỗi ___ là một câu
                </label>
                <span className="text-[11px] text-blue-600 font-semibold">
                  {formBlankCount > 0
                    ? `${formBlankCount} chỗ trống → câu ${question.questionNumber}–${question.questionNumber + formBlankCount - 1}`
                    : "Chưa có chỗ trống ___"}
                </span>
              </div>
              <textarea
                ref={formTextareaRef}
                value={formText}
                onChange={(e) => onApplyInlineFormText(sectionNumber, index, e.target.value)}
                rows={8}
                placeholder={`Enquiry about joining Youth Council\n\nAge: 18\nCurrently staying in a ___ during the week\nPostal address: 217, ___ Street, Stamford, Lincs\nPostcode: ___`}
                className="w-full min-h-[220px] px-3 py-2 text-sm border border-blue-200 rounded-lg bg-white font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
              <p className="text-[11px] text-blue-700">
                Giáo viên nhập/xóa tự do tại đây. Hệ thống chỉ nhận dạng mỗi ___ là một câu; chữ trước/sau ___ được giữ làm label cho học viên.
              </p>
            </div>
          )}

          {/* Chỉ dẫn chung của nhóm — hiện 1 lần ở câu đầu nhóm, áp cho mọi dạng (trừ image-completion tự có zone riêng phía trên) */}
          {isGroupStart && !isImgCompletion && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-indigo-700 mb-1">
                Chỉ dẫn chung của nhóm (áp dụng cho cả nhóm)
              </label>
              <textarea
                value={question.taskInstruction || ""}
                onChange={(e) => handleGroup({ taskInstruction: e.target.value })}
                rows={2}
                placeholder="VD: Complete the notes below. Write ONE WORD ONLY. / Choose the correct letter, A, B or C."
                className="w-full px-3 py-2 text-sm border border-indigo-200 rounded-lg bg-indigo-50/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
              />
            </div>
          )}

          {/* Image-completion: chỉ cần ô đáp án đúng, đơn giản */}
          {isImgCompletion && (
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-amber-700 flex-shrink-0">Đáp án đúng:</span>
              <input
                type="text"
                value={question.correctAnswer}
                onChange={(e) => handleChange({ correctAnswer: e.target.value })}
                placeholder="Nhập đáp án đúng..."
                className="flex-1 px-3 py-2 text-sm border border-amber-200 bg-amber-50/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          )}

          {!isImgCompletion && (isMatching || wordBank) ? (
            <div className="space-y-2">
              {/* Bảng lựa chọn / word bank dùng chung — chỉ hiện ở câu đầu nhóm */}
              {isGroupStart && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 space-y-2.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-indigo-700 mb-1">
                    {isMatching
                      ? "Bảng lựa chọn (A, B, C…) — nghĩa của từng chữ cái"
                      : "Word bank (danh sách từ A, B, C…)"}
                  </label>
                  <div className="space-y-1.5">
                    {optionKeys.map((k) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {k}
                        </span>
                        <input
                          type="text"
                          value={(question.options as any)?.[k] || ""}
                          onChange={(e) =>
                            handleGroup({
                              options: { ...(question.options || {}), [k]: e.target.value } as any,
                            })
                          }
                          placeholder={isMatching ? `Nghĩa của ${k}` : `Từ/cụm cho ${k}`}
                          className="flex-1 px-2.5 py-1.5 text-sm border border-indigo-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {optionKeys.length > 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = { ...(question.options || {}) } as Record<string, string>;
                              delete next[k];
                              handleGroup({ options: next });
                            }}
                            className="p-1 rounded-md text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-all cursor-pointer flex-shrink-0"
                            title="Xoá lựa chọn"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {optionKeys.length < LETTERS.length && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextLetter = LETTERS[optionKeys.length];
                        handleGroup({
                          options: { ...(question.options || {}), [nextLetter]: "" } as any,
                        });
                      }}
                      className="mt-2 text-[12px] font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      + Thêm lựa chọn
                    </button>
                  )}
                </div>
              )}

              {/* Đáp án: chọn chữ cái khớp với mục này */}
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-gray-500 flex-shrink-0">Đáp án đúng:</span>
                <select
                  value={question.correctAnswer}
                  onChange={(e) => handleChange({ correctAnswer: e.target.value })}
                  className="flex-1 px-3 py-2 text-sm border border-emerald-200 bg-emerald-50/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">-- Chọn chữ cái --</option>
                  {optionKeys.map((k) => (
                    <option key={k} value={k}>
                      {k}{(question.options as any)?.[k] ? ` — ${(question.options as any)[k]}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : isMcq && question.options ? (
            isMultiMcq ? (
              isGrouped && !isGroupStart ? (
                // Câu sau trong nhóm multi-select: chỉ hiện hàng nút chữ cái gọn
                // để tick chọn nhiều đáp án đúng (tối đa selectCount). Text đáp án
                // A/B/C/D đã nhập 1 lần ở câu đầu nhóm nên KHÔNG lặp lại ở đây.
                <div className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-gray-50/50">
                  <span className="text-xs font-semibold text-gray-600 mr-2">
                    Đáp án đúng cho câu {question.questionNumber} (chọn {selectCount}):
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {optionKeys.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggleMulti(k)}
                        className={`w-8 h-8 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center border ${
                          selectedSet.has(k)
                            ? "bg-emerald-500 border-emerald-600 text-white shadow-sm font-extrabold"
                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
              <div className="space-y-1.5">
                <p className="text-[11px] text-gray-500">
                  Chọn đúng {selectCount} đáp án (Choose {selectCount === 2 ? "TWO" : "THREE"}):
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {optionKeys.map((k) => (
                    <label
                      key={k}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md border text-xs cursor-pointer transition-all"
                      style={{
                        background: selectedSet.has(k) ? "#ECFDF5" : "#FFFFFF",
                        borderColor: selectedSet.has(k) ? "#86EFAC" : "#E5E7EB",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSet.has(k)}
                        onChange={() => toggleMulti(k)}
                        className="w-3.5 h-3.5 accent-emerald-500"
                      />
                      <span className="font-bold text-gray-700">{k}.</span>
                      <input
                        type="text"
                        value={(question.options as any)![k] || ""}
                        onChange={(e) =>
                          handleChange({
                            options: { ...question.options!, [k]: e.target.value } as any,
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
                            onRemoveOption?.(sectionNumber, index, k);
                          }}
                          className="p-0.5 rounded text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-all cursor-pointer flex-shrink-0"
                          title="Xoá đáp án (áp dụng cho cả nhóm)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </label>
                  ))}
                </div>
                {optionKeys.length < LETTERS.length && (
                  <button
                    type="button"
                    onClick={() => onAddOption?.(sectionNumber, index)}
                    className="text-[12px] font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    + Thêm đáp án
                  </button>
                )}
              </div>
              )
            ) : (
              <div className="space-y-2">
                {isGrouped && !isGroupStart ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-gray-50/50">
                    <span className="text-xs font-semibold text-gray-600 mr-2">Đáp án đúng cho câu {question.questionNumber}:</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {optionKeys.map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => handleChange({ correctAnswer: k })}
                          className={`w-8 h-8 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center border ${
                            question.correctAnswer === k
                              ? "bg-emerald-500 border-emerald-600 text-white shadow-sm font-extrabold"
                              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(question.options).filter((k) => k.length === 1) as string[])
                        .sort()
                        .map((k) => (
                        <label
                          key={k}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-gray-200 hover:border-blue-300 transition-all cursor-pointer text-xs"
                          style={{
                            background: question.correctAnswer === k ? "#ECFDF5" : "#FFFFFF",
                            borderColor: question.correctAnswer === k ? "#86EFAC" : "#E5E7EB",
                          }}
                        >
                          <input
                            type="radio"
                            name={`correct-${question.id}`}
                            checked={question.correctAnswer === k}
                            onChange={() => handleChange({ correctAnswer: k })}
                            className="w-3.5 h-3.5 accent-emerald-500"
                          />
                          <span className="font-bold text-gray-700">{k}.</span>
                          <input
                            type="text"
                            value={(question.options as any)![k] || ""}
                            onChange={(e) =>
                              handleChange({
                                options: { ...question.options!, [k]: e.target.value } as any,
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
                                onRemoveOption?.(sectionNumber, index, k);
                              }}
                              className="p-0.5 rounded text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-all cursor-pointer flex-shrink-0"
                              title="Xoá đáp án (áp dụng cho cả nhóm)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </label>
                      ))}
                    </div>
                    {optionKeys.length < LETTERS.length && (
                      <button
                        type="button"
                        onClick={() => onAddOption?.(sectionNumber, index)}
                        className="text-[12px] font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer mt-1"
                      >
                        + Thêm đáp án
                      </button>
                    )}
                  </>
                )}
              </div>
            )
          ) : !isImgCompletion ? (
            <div className="space-y-1">
              {question.wordLimit && (
                <p className="text-[11px] text-gray-500 italic">{question.wordLimit}</p>
              )}
              <input
                type="text"
                value={question.correctAnswer}
                onChange={(e) => handleChange({ correctAnswer: e.target.value })}
                placeholder="Đáp án đúng (vd: TRUE / FALSE / NOT GIVEN, hoặc từ khóa)..."
                className="w-full px-3 py-2 text-sm border border-emerald-200 bg-emerald-50/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});

// ─── Image task block (standalone, above the question rows) ───────────────
// Rendered separately at group-start so teachers understand the image is
// shared across the whole image-completion group, not just question 1.
const ImageTaskBlock = memo(function ImageTaskBlock({
  question,
  groupSize = 1,
  sectionNumber,
  examId,
  onPatchGroup,
}: {
  question: ListeningQuestion;
  groupSize?: number;
  sectionNumber: number;
  examId?: string;
  onPatchGroup: (secNum: number, qIdx: number, patch: Partial<ListeningQuestion>) => void;
}) {
  const [imageUploading, setImageUploading] = useState(false);
  const [imageZoomed, setImageZoomed] = useState(false);
  const handleGroup = (patch: Partial<ListeningQuestion>) =>
    onPatchGroup(sectionNumber, (question.questionNumber - 1) % 10, patch);

  const handleImageUpload = async (file: File) => {
    if (!examId) {
      alert("Vui lòng đợi exam được tạo trước khi upload ảnh");
      return;
    }
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("section", String(sectionNumber));
      const res = await api.post(
        `/teacher/exams/${examId}/ielts/listening/sections/${sectionNumber}/question-image`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const url = res.data?.image_url || res.data?.data?.image_url || URL.createObjectURL(file);
      handleGroup({ taskImage: url, taskImageFileName: file.name });
    } catch {
      const url = URL.createObjectURL(file);
      handleGroup({ taskImage: url, taskImageFileName: file.name });
    } finally {
      setImageUploading(false);
    }
  };

  const firstNum = question.questionNumber;
  const lastNum = firstNum + groupSize - 1;
  const rangeLabel = groupSize > 1 ? `${firstNum}–${lastNum}` : `${firstNum}`;

  return (
    <div
      className="rounded-xl border-2 border-dashed border-amber-400 bg-amber-50/50 p-4 space-y-3 outline-none focus:border-amber-500 focus:bg-amber-50/70"
      tabIndex={0}
      onPaste={(e) => {
        e.preventDefault();
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
            const blob = items[i].getAsFile();
            if (blob) handleImageUpload(blob);
            return;
          }
        }
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-wide">
          <ImageIcon className="w-4 h-4" />
          Ảnh đề chung — Câu {rangeLabel}
        </div>
        {groupSize > 1 && (
          <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
            Nhóm {groupSize} câu
          </span>
        )}
      </div>

      {question.taskImage ? (
        <div className="space-y-2">
          <div className="relative group">
            <img
              src={question.taskImage}
              alt="Question image"
              className="max-w-full max-h-[320px] w-auto object-contain mx-auto rounded-lg border border-amber-200 cursor-zoom-in"
              onClick={() => setImageZoomed(true)}
            />
            <button
              type="button"
              onClick={() => setImageZoomed(true)}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-white/80 text-amber-700 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="Phóng to"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500 truncate flex-1">{question.taskImageFileName}</span>
            <button
              type="button"
              onClick={() => handleGroup({ taskImage: "", taskImageFileName: "" })}
              className="text-[11px] font-semibold text-rose-500 hover:text-rose-700 cursor-pointer whitespace-nowrap"
            >
              Đổi ảnh
            </button>
          </div>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 py-5 cursor-pointer hover:bg-amber-50 rounded-lg transition-all">
          {imageUploading ? (
            <><Loader2 className="w-4 h-4 animate-spin text-amber-600" /><span className="text-sm text-amber-700">Đang upload...</span></>
          ) : (
            <><Upload className="w-4 h-4 text-amber-400" /><span className="text-sm font-medium text-amber-700">Upload ảnh đề (jpg, png, pdf...) hoặc paste (Ctrl+V)</span></>
          )}
          <input
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
          />
        </label>
      )}
      {imageZoomed && question.taskImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setImageZoomed(false)}
        >
          <img
            src={question.taskImage}
            alt="Question image zoomed"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
});

export default IeltsListeningEditor;

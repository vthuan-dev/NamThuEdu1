/**
 * IELTS Listening — student view (4 sections × 10 Q = 40 total).
 * Layout giống study4.com:
 *   ┌─ Audio bar (top, full width) ────────────────────────────┐
 *   │ [Recording 1] [Recording 2] [Recording 3] [Recording 4]  │
 *   │ ▶ ━━━━━━━━━━━━━━━━━━ 00:00 / 00:00  🔊 ━━ ⚙          │
 *   ├─ 2-col body ─────────────────────────────────────────────┤
 *   │ Form/Context (left)        │  Q1 [____]  Q2 [____] ...  │
 *   │ Insurance Co.              │                             │
 *   │ Type: Vehicle              │                             │
 *   │ Policy: ___1___            │                             │
 *   └──────────────────────────────────────────────────────────┘
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Check, Info, Lightbulb } from "lucide-react";
import type {
  IeltsListeningPayload,
  IeltsListeningSection,
  IeltsQuestion,
  AnswerMap,
} from "../types";
import { IeltsAudioOnce } from "../components/IeltsAudioOnce";
import { type QuestionMeta } from "../components/IeltsBottomNav";
import { IeltsQuestionNavigator } from "../components/IeltsQuestionNavigator";

interface IeltsListeningViewProps {
  payload: IeltsListeningPayload;
  answers: AnswerMap;
  flagged: Record<number, boolean>;
  onAnswer: (qId: number, value: any) => void;
  onToggleFlag: (qId: number) => void;
  onSubmit: () => void;
  onAllSectionsDone?: () => void;
  timeLeft?: number;
  showTimer?: boolean;
  /** Preview mode: navigator có thể kéo được */
  draggableNavigator?: boolean;
  /** Preview mode: ẩn nút Bỏ qua */
  previewMode?: boolean;
}

type Phase = "section" | "review";

export function IeltsListeningView({
  payload,
  answers,
  flagged,
  onAnswer,
  onSubmit,
  onAllSectionsDone,
  timeLeft,
  showTimer,
  draggableNavigator = false,
  previewMode = false,
}: IeltsListeningViewProps) {
  const [phase, setPhase] = useState<Phase>("section");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [audioStartedAt, setAudioStartedAt] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sections = payload.sections ?? [];
  const currentSection: IeltsListeningSection | undefined = sections[sectionIndex];

  const allMeta: QuestionMeta[] = useMemo(() => {
    const out: QuestionMeta[] = [];
    sections.forEach((sec, sIdx) => {
      sec.questions.forEach((q) => {
        out.push({
          number: q.questionNumber,
          qId: q.qId,
          groupIndex: sIdx,
          groupLabel: sec.sectionName,
        });
      });
    });
    return out.sort((a, b) => a.number - b.number);
  }, [sections]);

  const handleSectionEnded = () => {
    if (sectionIndex < sections.length - 1) {
      setSectionIndex((i) => i + 1);
      setAudioStartedAt(Date.now());
    } else {
      setPhase("review");
      onAllSectionsDone?.();
    }
  };

  const jumpToQuestion = (q: QuestionMeta) => {
    if (phase === "review" || q.groupIndex === sectionIndex) {
      setSectionIndex(q.groupIndex);
      requestAnimationFrame(() => {
        const el = document.getElementById(`ielts-q-${q.qId}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  };

  if (!currentSection) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center text-gray-500">
        Đang tải dữ liệu đề thi…
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-white flex flex-col" ref={containerRef}>
      {/* ── Sticky header: section tabs + audio player ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1170px] mx-auto px-4">
          {/* Section tabs row */}
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
            {sections.map((sec, idx) => {
              const isActive = idx === sectionIndex;
              const answered = sec.questions.filter(q => (answers[q.qId] ?? "") !== "").length;
              const total = sec.questions.length;
              const allDone = answered === total && total > 0;

              return (
                <button
                  key={sec.sectionNumber}
                  type="button"
                  onClick={() => {
                    setSectionIndex(idx);
                    setAudioStartedAt(Date.now());
                  }}
                  className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
                    isActive
                      ? "border-orange-500 text-orange-600"
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
                  }`}
                >
                  {/* Status dot */}
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
                      allDone
                        ? "bg-green-500"
                        : answered > 0
                          ? "bg-orange-400"
                          : isActive
                            ? "bg-orange-300"
                            : "bg-gray-300"
                    }`}
                  />
                  <span>Recording {sec.sectionNumber}</span>
                  <span
                    className={`text-xs tabular-nums font-normal ${
                      isActive ? "text-orange-400" : "text-gray-400"
                    }`}
                  >
                    {answered}/{total}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Audio player row */}
          <div className="pt-3 pb-3">
            {currentSection.audioUrl ? (
              <IeltsAudioOnce
                key={`audio-${currentSection.sectionNumber}-${audioStartedAt}`}
                src={currentSection.audioUrl}
                autoPlay
                onEnded={handleSectionEnded}
              />
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <span className="text-amber-500">⚠</span>
                Không có file audio cho section này.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Body 2-cols (max-width 1170px theo study4) ── */}
      <div className="flex-1 max-w-[1170px] w-full mx-auto px-3 py-6 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* ── LEFT: form/context (cuộn theo trang) ── */}
          <div className="space-y-4">
            <SectionInstructions section={currentSection} />
            <FormContent section={currentSection} />
          </div>

          {/* ── RIGHT: answer input boxes (sticky + cuộn riêng khi dài) ── */}
          <div className="lg:sticky lg:top-[200px] lg:max-h-[calc(100vh-260px)] lg:overflow-y-auto lg:pr-1 space-y-2">
            {currentSection.questions.map((q) => {
              const num = q.questionNumber;
              const value = (answers[q.qId] ?? "") as string;
              const hasAnswer = value.trim().length > 0;
              const selectCount = Number((q.data?.select_count as number) ?? 1);
              const isMulti =
                selectCount > 1 && q.options && Object.keys(q.options).length > 0;
              return (
                <div
                  key={q.qId}
                  id={`ielts-q-${q.qId}`}
                  className="flex items-center gap-2.5"
                >
                  <span
                    className={`flex-shrink-0 w-8 h-8 rounded-md font-semibold text-sm flex items-center justify-center transition-colors ${
                      hasAnswer
                        ? "bg-[#FF6B35] text-white"
                        : "bg-[#f8f9fa] text-[#677788] border border-[#e0e0e0]"
                    }`}
                  >
                    {num}
                  </span>
                  {isMulti ? (
                    <MultiAnswerSelect
                      value={value}
                      options={q.options as Record<string, string>}
                      selectCount={selectCount}
                      onChange={(v) => onAnswer(q.qId, v)}
                    />
                  ) : q.options && Object.keys(q.options).length > 0 ? (
                    <AnswerDropdown
                      value={value}
                      options={q.options as Record<string, string>}
                      onChange={(v) => onAnswer(q.qId, v)}
                    />
                  ) : (
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => onAnswer(q.qId, e.target.value)}
                      onFocus={() => highlightQuestionRow(num)}
                      placeholder="Nhập câu trả lời..."
                      className="flex-1 px-3 py-2 rounded-md border border-[#e0e0e0] text-[15px] bg-white focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-orange-100 transition-colors"
                    />
                  )}
                </div>
              );
            })}

            {/* Skip button — ẩn trong preview mode */}
            {!previewMode && (
              <button
                type="button"
                onClick={handleSectionEnded}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#677788] hover:text-[#FF6B35] transition-colors cursor-pointer"
              >
                Bỏ qua sang{" "}
                {sectionIndex < sections.length - 1
                  ? `Recording ${sectionIndex + 2}`
                  : "phần ôn lại"}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <IeltsQuestionNavigator
        questions={allMeta}
        answers={answers}
        flagged={flagged}
        activeGroupIndex={sectionIndex}
        onJump={jumpToQuestion}
        timeLeft={timeLeft}
        showTimer={showTimer}
        onSubmit={onSubmit}
        hideSubmit={draggableNavigator}
      />
    </div>
  );
}

// ─── FormContent ─────────────────────────────────────────────────────────
/**
 * Rung nhẹ label câu hỏi tương ứng (#ielts-row-{num}) khi học viên focus vào
 * ô nhập đáp án — giúp dễ nhận biết đang trả lời câu nào.
 */
function highlightQuestionRow(num: number): void {
  const el = document.getElementById(`ielts-row-${num}`);
  if (!el) return;
  el.classList.remove("ielts-row-shake");
  void el.offsetWidth; // force reflow để animation chạy lại
  el.classList.add("ielts-row-shake");
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  const onEnd = () => {
    el.classList.remove("ielts-row-shake");
    el.removeEventListener("animationend", onEnd);
  };
  el.addEventListener("animationend", onEnd);
}

/**
 * Wrapper: tách câu MATCHING (cần hiện bảng nghĩa A/B/C) khỏi phần còn lại.
 * Matching trước đây bị nhét vào form-render nên học viên chỉ thấy item +
 * dropdown, KHÔNG thấy "A = …, B = …" → không hiểu chọn gì. Giờ render riêng:
 *   • Một bảng nghĩa (legend) dùng chung hiện 1 lần.
 *   • Danh sách item đánh số rõ ràng.
 * Các segment giữ đúng thứ tự câu để không xáo trộn đề.
 */
function FormContent({ section }: { section: IeltsListeningSection }) {
  const classify = (q: IeltsQuestion): "image" | "form" | "matching" | "mcq" | "other" => {
    const type = normalizeQuestionType(q.questionType);
    if (type === "image_completion") return "image";
    if (type === "form_completion") return "form";
    const hasOptions = !!q.options && Object.keys(q.options).length > 0;
    if (type.includes("matching") && hasOptions) return "matching";
    if (hasOptions && (type.includes("multiple") || type.includes("choice")))
      return "mcq";
    return "other";
  };

  const segments: { kind: "image" | "form" | "matching" | "mcq" | "other"; questions: IeltsQuestion[] }[] = [];
  section.questions.forEach((q) => {
    const kind = classify(q);
    const last = segments[segments.length - 1];
    if (last && last.kind === kind) {
      last.questions.push(q);
    } else {
      segments.push({ kind, questions: [q] });
    }
  });

  return (
    <div className="space-y-4">
      {segments.map((seg, i) =>
        seg.kind === "image" ? (
          <ImageCompletionBlock key={`seg-i-${i}`} questions={seg.questions} />
        ) : seg.kind === "form" ? (
          <FormCompletionBlock key={`seg-f-${i}`} questions={seg.questions} section={section} />
        ) : seg.kind === "matching" ? (
          <MatchingBlock key={`seg-m-${i}`} questions={seg.questions} section={section} />
        ) : seg.kind === "mcq" ? (
          <McqBlock key={`seg-q-${i}`} questions={seg.questions} section={section} />
        ) : (
          <NonMatchingContent
            key={`seg-n-${i}`}
            questions={seg.questions}
            section={section}
          />
        )
      )}
    </div>
  );
}

/**
 * Render nhóm câu FORM-COMPLETION đúng dạng biểu mẫu: giữ tiêu đề/ngữ cảnh,
 * label theo từng dòng và chip số câu ngay vị trí blank. Ô nhập vẫn nằm ở
 * panel bên phải để không phá layout làm bài hiện tại.
 */
function FormCompletionBlock({
  questions,
  section,
}: {
  questions: IeltsQuestion[];
  section: IeltsListeningSection;
}) {
  const first = questions[0]?.questionNumber;
  const last = questions[questions.length - 1]?.questionNumber;
  const range = first === last ? `${first}` : `${first}–${last}`;
  const title =
    (questions[0]?.data?.taskTitle as string) ||
    (questions[0]?.data?.task_title as string) ||
    "";
  const instruction =
    (questions[0]?.data?.taskInstruction as string) ||
    (questions[0]?.data?.task_instruction as string) ||
    "";
  const context = section.context || "";

  return (
    <div className="rounded-xl border border-orange-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-baseline gap-2 px-4 py-2.5 bg-orange-50/70 border-b border-orange-100">
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-100 text-[#FF6B35] text-xs font-bold">
          Câu {range}
        </span>
        <h3 className="text-sm font-bold text-gray-900">
          {title || "Complete the form below"}
        </h3>
      </div>

      <div className="p-4 space-y-3">
        {instruction && instruction !== section.instructions && (
          <p className="text-sm font-semibold text-[#FF6B35] italic whitespace-pre-wrap">
            {instruction}
          </p>
        )}
        {context && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[14px] leading-[1.6] text-gray-800 whitespace-pre-wrap">
            {context}
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          {questions.map((q) => {
            const text = cleanQuestionText(q.questionText || "", q.questionNumber);
            return (
              <div
                key={q.qId}
                id={`ielts-row-${q.questionNumber}`}
                className="px-4 py-3 border-b border-gray-100 last:border-b-0 text-[15px] leading-[1.8] text-[#1a1a1a] whitespace-pre-wrap"
              >
                {renderInlineBlanks(text, q.questionNumber, true)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Render nhóm câu IMAGE-COMPLETION: hiện ảnh đề + danh sách số câu bên trái.
 * Học viên nhìn ảnh và điền đáp án vào ô bên phải (panel điều hướng).
 */
function ImageCompletionBlock({ questions }: { questions: IeltsQuestion[] }) {
  const [zoomed, setZoomed] = useState(false);
  const taskImage = (questions[0]?.data?.task_image as string) || (questions[0]?.data?.taskImage as string) || "";
  const firstNum = questions[0]?.questionNumber;
  const lastNum  = questions[questions.length - 1]?.questionNumber;
  const range    = firstNum === lastNum ? `${firstNum}` : `${firstNum}–${lastNum}`;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/30 overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200">
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-bold">
          Câu {range}
        </span>
        <span className="text-[11px] text-amber-700 font-medium">Xem ảnh đề và điền vào ô bên phải</span>
      </div>
      {taskImage ? (
        <div className="p-3">
          <img
            src={taskImage}
            alt="Question page"
            className="w-full rounded-md border border-amber-200 cursor-zoom-in"
            onClick={() => setZoomed(true)}
            title="Nhấp để phóng to"
          />
          {zoomed && (
            <div
              className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 cursor-zoom-out"
              onClick={() => setZoomed(false)}
            >
              <img
                src={taskImage}
                alt="Question page zoomed"
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 py-6 text-center text-sm text-amber-600 italic">
          Giáo viên chưa upload ảnh đề cho phần này.
        </div>
      )}
      <ul className="divide-y divide-amber-100 border-t border-amber-200">
        {questions.map((q) => (
          <li key={q.qId} id={`ielts-row-${q.questionNumber}`}
            className="flex items-center gap-2 px-4 py-2">
            <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200">
              {q.questionNumber}
            </span>
            {q.questionText && (
              <span className="text-[13px] text-gray-700 whitespace-pre-wrap">{q.questionText}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Render nhóm câu MATCHING: hiện bảng nghĩa (legend) A/B/C dùng chung + danh
 * sách item đánh số. Item nào liên tiếp có CÙNG legend thì gom chung 1 bảng.
 */
function MatchingBlock({
  questions,
  section,
}: {
  questions: IeltsQuestion[];
  section: IeltsListeningSection;
}) {
  // Gom item theo legend (options) giống nhau — thường cả nhóm 7-10 dùng chung.
  const groups: {
    legend: Record<string, string>;
    title?: string;
    instruction?: string;
    items: IeltsQuestion[];
  }[] = [];
  questions.forEach((q) => {
    const legendKey = JSON.stringify(q.options || {});
    const last = groups[groups.length - 1];
    if (last && JSON.stringify(last.legend) === legendKey) {
      last.items.push(q);
    } else {
      groups.push({
        legend: (q.options || {}) as Record<string, string>,
        title:
          (q.data?.taskTitle as string) || (q.data?.task_title as string) || undefined,
        instruction:
          (q.data?.taskInstruction as string) ||
          (q.data?.task_instruction as string) ||
          undefined,
        items: [q],
      });
    }
  });

  return (
    <div className="space-y-3">
      {groups.map((g, gi) => {
        const first = g.items[0].questionNumber;
        const last = g.items[g.items.length - 1].questionNumber;
        const range = first === last ? `${first}` : `${first}–${last}`;
        return (
          <div
            key={`mg-${gi}`}
            className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm"
          >
            <div className="flex items-baseline gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-100 text-[#FF6B35] text-xs font-bold">
                Câu {range}
              </span>
              {g.title && (
                <h3 className="text-sm font-bold text-gray-900">{g.title}</h3>
              )}
            </div>

            {g.instruction && g.instruction !== section.instructions && (
              <p className="px-4 pt-2.5 text-xs font-semibold text-[#FF6B35] italic">
                {g.instruction}
              </p>
            )}

            {/* Bảng nghĩa (legend) dùng chung — hiện rõ A/B/C nghĩa là gì */}
            <div className="mx-4 my-2.5 rounded-md border border-orange-100 bg-orange-50/40 divide-y divide-orange-100/70">
              {Object.entries(g.legend).map(([letter, meaning]) => (
                <div key={letter} className="flex items-start gap-2.5 px-3 py-1.5">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded bg-[#FF6B35] text-white text-xs font-bold">
                    {letter}
                  </span>
                  <span className="text-[14px] leading-snug text-[#1a1a1a] pt-0.5">
                    {meaning}
                  </span>
                </div>
              ))}
            </div>

            {/* Danh sách item cần ghép — số câu rõ ràng đầu mỗi dòng */}
            <ul className="divide-y divide-gray-100 border-t border-gray-100">
              {g.items.map((q) => (
                <li
                  key={q.qId}
                  id={`ielts-row-${q.questionNumber}`}
                  className="flex items-center gap-2.5 px-4 py-2.5"
                >
                  <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded bg-[#fff0eb] text-[#FF6B35] font-bold text-xs border border-[#ffc1ad]">
                    {q.questionNumber}
                  </span>
                  <span className="text-[15px] leading-relaxed text-[#1a1a1a] whitespace-pre-wrap">
                    {cleanQuestionText((q.questionText || "").trim(), q.questionNumber)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Render nhóm câu TRẮC NGHIỆM (MCQ): mỗi câu hiện số thứ tự + đề bài + các
 * lựa chọn A/B/C. Trước đây MCQ lẫn trong form-render nên không hiện được số
 * câu (không có blank ___) → học viên thấy dropdown bên phải mà không biết
 * ứng với câu nào. Giờ render rõ ràng từng câu.
 */
function McqBlock({
  questions,
  section,
}: {
  questions: IeltsQuestion[];
  section: IeltsListeningSection;
}) {
  return (
    <div className="space-y-3">
      {(() => {
        let lastTitle: string | undefined;
        return questions.map((q) => {
          const title =
            (q.data?.taskTitle as string) ||
            (q.data?.task_title as string) ||
            undefined;
          const instruction =
            (q.data?.taskInstruction as string) ||
            (q.data?.task_instruction as string) ||
            undefined;
          const showTitle = !!title && title !== lastTitle;
          if (title) lastTitle = title;
          const stem = cleanQuestionText(
            (q.questionText || "").trim(),
            q.questionNumber
          );

          return (
            <div
              key={q.qId}
              id={`ielts-row-${q.questionNumber}`}
              className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm"
            >
              {showTitle && (
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900 whitespace-pre-wrap">{title}</h3>
                </div>
              )}

              {instruction && instruction !== section.instructions && (
                <p className="px-4 pt-2.5 text-xs font-semibold text-[#FF6B35] italic whitespace-pre-wrap">
                  {instruction}
                </p>
              )}

              {/* Số câu + đề bài */}
              <div className="flex items-start gap-2.5 px-4 py-2.5">
                <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded bg-[#fff0eb] text-[#FF6B35] font-bold text-xs border border-[#ffc1ad]">
                  {q.questionNumber}
                </span>
                <span className="text-[15px] leading-relaxed text-[#1a1a1a] font-medium whitespace-pre-wrap">
                  {stem}
                </span>
              </div>

              {/* Các lựa chọn A/B/C — chỉ để đọc, học viên chọn ở dropdown bên phải */}
              {q.options && (
                <ul className="px-4 pb-3 space-y-1">
                  {Object.entries(q.options).map(([letter, text]) => (
                    <li key={letter} className="flex items-start gap-2.5">
                      <span className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded bg-gray-100 text-[#677788] text-xs font-bold">
                        {letter}
                      </span>
                      <span className="text-[14px] leading-snug text-[#1a1a1a] pt-0.5">
                        {text}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        });
      })()}
    </div>
  );
}

/**
 * Render phần KHÔNG phải matching bên trái — auto detect 2 layouts:
 *   • Tabular (table_completion, form, note): các câu có prefix "Subject — facet"
 *     → group consecutive câu cùng subject thành 1 card. Mỗi card = 1 entry,
 *     facets stacked theo dòng. Đọc theo entry tự nhiên hơn flat list.
 *   • Flat (sentence_completion, MCQ multi-letter): giữ render cũ — group theo
 *     stem chung khi nhiều câu cùng prompt.
 */
function NonMatchingContent({
  questions,
  section,
}: {
  questions: IeltsQuestion[];
  section: IeltsListeningSection;
}) {
  // Parse từng câu thành { prefix, rest } để có thể group theo prefix subject
  const parsed = useMemo(() => {
    return questions.map((q) => {
      const text = cleanQuestionText((q.questionText || "").trim(), q.questionNumber);
      const split = splitEntryPrefix(text);
      return {
        qId: q.qId,
        questionNumber: q.questionNumber,
        prefix: split.prefix,
        rest: split.rest,
        title:
          (q.data?.taskTitle as string) ||
          (q.data?.task_title as string) ||
          undefined,
        instruction:
          (q.data?.taskInstruction as string) ||
          (q.data?.task_instruction as string) ||
          undefined,
      };
    });
  }, [questions]);

  // Detect tabular: ≥50% câu có prefix "Subject — facet" + tối thiểu 3 câu để có ý nghĩa
  const useTabular = useMemo(() => {
    if (parsed.length < 3) return false;
    const withPrefix = parsed.filter((p) => p.prefix !== null).length;
    return withPrefix >= parsed.length * 0.5;
  }, [parsed]);

  type EntryGroup = {
    key: string;
    prefix: string | null;
    title?: string;
    instruction?: string;
    /** Khi entry không có prefix dạng "Subject —", nhưng row đầu là dạng
     *  "The 5 (name of third restaurant)" → render thành subject với blank chip */
    subjectPlaceholder?: { number: number; text: string };
    items: { number: number; text: string }[];
  };

  const entryGroups: EntryGroup[] = useMemo(() => {
    if (!useTabular) return [];
    const result: EntryGroup[] = [];
    parsed.forEach((p) => {
      const last = result[result.length - 1];
      const sameEntry =
        last &&
        last.prefix === p.prefix &&
        last.title === p.title &&
        p.prefix !== null;
      if (sameEntry) {
        last.items.push({ number: p.questionNumber, text: p.rest });
      } else {
        result.push({
          key: `entry-${p.qId}`,
          prefix: p.prefix,
          title: p.title,
          instruction: p.instruction,
          items: [{ number: p.questionNumber, text: p.rest }],
        });
      }
    });

    // Post-process: merge entry "lẻ loi" (1 item, không có prefix subject, text
    // chứa blank ___N___ kiểu "The 5 (name of third restaurant)") vào entry kế
    // tiếp như SUBJECT của entry đó. Nó thường là tên thứ N được ẩn đi để
    // student điền.
    const merged: EntryGroup[] = [];
    for (let i = 0; i < result.length; i++) {
      const cur = result[i];
      const next = result[i + 1];
      const isLooseSubject =
        !cur.prefix &&
        cur.items.length === 1 &&
        next &&
        next.prefix !== null;

      if (isLooseSubject) {
        // Đẩy item này lên đầu next như subject placeholder
        const subjectText = cur.items[0].text;
        const subjectNumber = cur.items[0].number;
        merged.push({
          ...next,
          key: cur.key,
          // Subject là text gốc — sẽ render với chip blank inline
          prefix: null,
          subjectPlaceholder: { number: subjectNumber, text: subjectText },
        });
        i++; // skip next vì đã merge
      } else {
        merged.push(cur);
      }
    }
    return merged;
  }, [parsed, useTabular]);

  // ─── Tabular render: stacked cards, mỗi card = 1 entry ─────────────────
  if (useTabular) {
    return (
      <div className="space-y-3">
        {(() => {
          // Không lặp lại cùng 1 taskTitle ở mọi card (vd "ANNUAL WULLABALLOO
          // CONFERENCE" trước đây hiện ở từng mốc giờ → rối). Chỉ hiện 1 lần đầu.
          let lastTitle: string | undefined;
          return entryGroups.map((g) => {
            const showTitle = !!g.title && g.title !== lastTitle;
            if (g.title) lastTitle = g.title;
            return (
              <div
                key={g.key}
                className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm"
              >
                {/* Optional task title — chỉ hiện 1 lần cho nhóm cùng title */}
                {showTitle && (
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 whitespace-pre-wrap">{g.title}</h3>
                  </div>
                )}

                {/* Entry header (subject) — hiện 1 trong 2:
                      • prefix: tên entry plain text (vd "The Junction")
                      • subjectPlaceholder: row có blank (vd "The [5]") */}
                {(g.prefix || g.subjectPlaceholder) && (
                  <div className="px-4 py-2.5 bg-orange-50/50 border-b border-orange-100/80">
                    {g.prefix ? (
                      <span className="text-[15px] font-bold text-gray-900 whitespace-pre-wrap">
                        {g.prefix}
                      </span>
                    ) : g.subjectPlaceholder ? (
                      <span
                        id={`ielts-row-${g.subjectPlaceholder.number}`}
                        className="text-[15px] font-bold text-gray-900 whitespace-pre-wrap"
                      >
                        {renderInlineBlanks(
                          g.subjectPlaceholder.text,
                          g.subjectPlaceholder.number,
                          true
                        )}
                      </span>
                    ) : null}
                  </div>
                )}

                {/* Optional task instruction */}
                {g.instruction && g.instruction !== section.instructions && (
                  <p className="px-4 pt-2 text-xs font-semibold text-[#FF6B35] italic whitespace-pre-wrap">
                    {g.instruction}
                  </p>
                )}

                {/* Facets — mỗi facet là 1 dòng, KHÔNG hiện chip số ở left
                    (input box bên phải đã có số rõ rồi → tránh trùng lặp) */}
                <ul className="divide-y divide-gray-100">
                  {g.items.map((item) => (
                    <li
                      key={item.number}
                      id={`ielts-row-${item.number}`}
                      className="px-4 py-2.5 text-[15px] leading-relaxed text-[#1a1a1a] whitespace-pre-wrap"
                    >
                      {renderInlineBlanks(item.text, item.number, true)}
                    </li>
                  ))}
                </ul>
              </div>
            );
          });
        })()}
      </div>
    );
  }

  // ─── Flat render: group theo stem (cho MCQ multi-letter, sentence completion) ──
  type StemGroup = {
    key: string;
    title?: string;
    instruction?: string;
    stem: string;
    questions: { number: number; content: string }[];
  };

  const stemGroups: StemGroup[] = (() => {
    const result: StemGroup[] = [];
    parsed.forEach((p) => {
      // Khi không tabular, render full text (kèm prefix nếu có)
      const full = p.prefix ? `${p.prefix} — ${p.rest}` : p.rest;
      const stem = full.trim();
      const last = result[result.length - 1];
      const sameStem =
        last && last.stem === stem && last.title === p.title && stem.length > 0;
      if (sameStem) {
        last.questions.push({ number: p.questionNumber, content: stem });
      } else {
        result.push({
          key: `stem-${p.qId}`,
          title: p.title,
          instruction: p.instruction,
          stem,
          questions: [{ number: p.questionNumber, content: stem }],
        });
      }
    });
    return result;
  })();

  return (
    <div className="space-y-5 text-[17px] leading-[1.7] text-[#1a1a1a]">
      {(() => {
        // Track title đã render để KHÔNG lặp lại cùng 1 taskTitle cho mọi câu
        // (vd "Moving Company Service Report" trước đây hiện 6 lần → rất rối).
        let lastTitle: string | undefined;
        return stemGroups.map((g) => {
          const isGroup = g.questions.length > 1;
          const first = g.questions[0].number;
          const last = g.questions[g.questions.length - 1].number;
          const range = isGroup ? `${first}–${last}` : `${first}`;
          const showTitle = !!g.title && g.title !== lastTitle;
          if (g.title) lastTitle = g.title;

          return (
            <div key={g.key} className="space-y-2">
              {showTitle && (
                <h3 className="text-center text-lg font-bold text-gray-900 pb-1">
                  {g.title}
                </h3>
              )}

              {g.instruction && g.instruction !== section.instructions && (
                <p className="text-sm font-semibold text-[#FF6B35] italic whitespace-pre-wrap">
                  {g.instruction}
                </p>
              )}

              {isGroup && (
                <div className="flex items-baseline gap-2 pb-1 border-b border-gray-200">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-100 text-[#FF6B35] text-xs font-bold">
                    Câu {range}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({g.questions.length} câu trả lời)
                  </span>
                </div>
              )}

              <div className="whitespace-pre-wrap">{renderInlineBlanks(g.stem, first)}</div>

              {isGroup && (
                <p className="text-sm text-gray-500 italic">
                  → Trả lời cho câu {g.questions.map((q) => q.number).join(", ")}
                </p>
              )}
            </div>
          );
        });
      })()}
    </div>
  );
}

/**
 * Dọn questionText do Gemini đôi khi để lẫn số câu vào text:
 *   "Set lunch costs 9 £ ___ per person"  → "Set lunch costs £ ___ per person"
 *   "Portions probably of 10 ___ size"    → "Portions probably of ___ size"
 *   "...electric 39 ___ , or, by ___"      → giữ blank cuối, bỏ "39" lẫn giữa
 * Heuristic: xoá số đứng ngay TRƯỚC ___ nếu số đó trùng/khớp số câu
 * (hoặc là 1 số nguyên đứng sát blank — vốn là artefact của số thứ tự câu).
 */
function cleanQuestionText(text: string, questionNumber: number): string {
  let out = text;
  // 1) Xoá "<num> ___" → "___" khi num là số nguyên đứng ngay trước blank
  //    (đây gần như luôn là số thứ tự câu bị OCR/AI kéo vào)
  out = out.replace(/(^|\s)\d{1,3}\s+(_{2,})/g, "$1$2");
  // 2) Xoá số câu đứng đầu chuỗi: "31 ___ was..." đã xử lý ở trên;
  //    còn trường hợp "9 £ ___" → số 9 cách £ rồi mới tới blank
  out = out.replace(new RegExp(`(^|\\s)${questionNumber}\\s+(?=[£$€%]|\\b)`, "g"), "$1");
  // 3) Gom space thừa (giữ nguyên xuống dòng để preserve format)
  out = out.replace(/ {2,}/g, " ").trim();
  return out;
}

/**
 * Tách prefix subject "X — Y" hoặc "X – Y" (em-dash / en-dash).
 * Chỉ match em-dash/en-dash, KHÔNG match hyphen "-" vì hyphen hay dùng cho
 * compound words như "limited-edition", dễ false-positive.
 *
 *   "The Junction — Good for people..."   → { prefix: "The Junction", rest: "Good for people..." }
 *   "The 5 (name of third restaurant)"     → { prefix: null, rest: "The 5 (name of third restaurant)" }
 *   "Family Name: Mackinlay"               → { prefix: null, rest: "Family Name: Mackinlay" }
 */
function splitEntryPrefix(text: string): { prefix: string | null; rest: string } {
  // Subject < 60 ký tự (tên + space). Lazy match để chỉ lấy phần đầu.
  const m = text.match(/^([^—–\n]{1,60}?)\s+[—–]\s+(.+)$/s);
  if (m) {
    const prefix = m[1].trim();
    // Loại bỏ false-positive: nếu prefix bắt đầu bằng số đơn lẻ (vd "1 — text") thì không phải subject
    if (/^\d+$/.test(prefix)) {
      return { prefix: null, rest: text };
    }
    return { prefix, rest: m[2].trim() };
  }
  return { prefix: null, rest: text };
}

/**
 * Replace ___N___ patterns trong text với inline blank styling kiểu study4.
 * Ví dụ: "Policy #: ___1___" → "Policy #: [1]"
 *
 * @param noFallbackChip Khi true: nếu text không có inline pattern thì KHÔNG
 *   thêm chip fallback đầu dòng (dùng cho tabular row vì đã có chip ở left).
 *   Thay vào đó: nếu text kết thúc bằng `:` thì append chip ở cuối — vị trí
 *   tự nhiên cho câu trả lời.
 */
function renderInlineBlanks(
  text: string,
  fallbackNum: number,
  noFallbackChip = false
) {
  const parts: React.ReactNode[] = [];
  // Match cả 2 dạng:
  //   • ___N___  → chip có số N (Gemini import)
  //   • ___      → chip dùng fallbackNum (mỗi câu thường = 1 blank)
  const regex = /_{2,}\s*(\d+)\s*_{2,}|_{2,}/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let foundAny = false;
  let blankIdx = 0;

  while ((m = regex.exec(text)) !== null) {
    foundAny = true;
    if (m.index > lastIndex) {
      parts.push(text.slice(lastIndex, m.index));
    }
    // Group 1 nếu có số trong ___N___; ngược lại dùng fallbackNum + blankIdx
    // (để khi 1 row có nhiều ___ thì các chip vẫn có số khác nhau).
    const num = m[1] ? parseInt(m[1], 10) : fallbackNum + blankIdx;
    parts.push(
      <span
        key={`blank-${m.index}`}
        className="inline-flex items-center justify-center min-w-[32px] h-6 px-2 mx-1 rounded bg-[#fff0eb] text-[#FF6B35] font-semibold text-xs border border-[#ffc1ad]"
      >
        {num}
      </span>
    );
    lastIndex = m.index + m[0].length;
    blankIdx++;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (foundAny) return <span className="whitespace-pre-wrap">{parts}</span>;

  // Không có inline pattern
  if (noFallbackChip) {
    // Nếu kết thúc bằng dấu hai chấm → append chip cuối (vị trí blank tự nhiên)
    const trimmed = text.replace(/\s+$/, "");
    if (/[:：]$/.test(trimmed)) {
      return (
        <span className="whitespace-pre-wrap">
          {trimmed}{" "}
          <span className="inline-flex items-center justify-center min-w-[32px] h-6 px-2 mx-1 rounded bg-[#fff0eb] text-[#FF6B35] font-semibold text-xs border border-[#ffc1ad]">
            {fallbackNum}
          </span>
        </span>
      );
    }
    // Còn lại: render text raw, student nhìn input bên phải để biết câu nào
    return <span className="whitespace-pre-wrap">{text}</span>;
  }

  // Fallback (mode flat list cũ): chip + text
  return (
    <div className="flex items-start gap-2">
      <span className="inline-flex flex-shrink-0 w-6 h-6 rounded bg-[#fff0eb] text-[#FF6B35] font-semibold text-xs items-center justify-center mt-0.5 border border-[#ffc1ad]">
        {fallbackNum}
      </span>
      <span className="whitespace-pre-wrap">{text}</span>
    </div>
  );
}


// ─── Custom dropdown for multiple-choice answers ─────────────────────────────
// Hiển thị "A. text..." khi mở; click 1 lần là chọn xong (không cần native select).
interface AnswerDropdownProps {
  value: string;
  options: Record<string, string>;
  onChange: (v: string) => void;
}

function AnswerDropdown({ value, options, onChange }: AnswerDropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const selectedText = value ? options[value] : "";

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full h-10 pl-3 pr-9 rounded-md border text-left text-[15px] bg-white transition-colors flex items-center ${
          open
            ? "border-[#FF6B35] ring-2 ring-orange-100"
            : "border-[#e0e0e0] hover:border-[#FF6B35]"
        }`}
      >
        {value ? (
          <span className="flex items-center gap-2 truncate">
            <span className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded bg-[#FF6B35] text-white text-xs font-bold">
              {value}
            </span>
            <span className="truncate text-[#1a1a1a]">{selectedText}</span>
          </span>
        ) : (
          <span className="text-[#9ca3af]">-- Chọn đáp án --</span>
        )}
        <ChevronDown
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#677788] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 left-0 right-0 rounded-lg border border-[#e0e0e0] bg-white shadow-lg max-h-64 overflow-y-auto py-1">
          {Object.entries(options).map(([letter, text]) => {
            const isSelected = value === letter;
            return (
              <button
                key={letter}
                type="button"
                onClick={() => {
                  onChange(isSelected ? "" : letter);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-orange-50 text-[#FF6B35] hover:bg-orange-100"
                    : "text-[#1a1a1a] hover:bg-gray-100 hover:text-[#1a1a1a]"
                }`}
              >
                <span
                  className={`flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${
                    isSelected
                      ? "bg-[#FF6B35] text-white"
                      : "bg-gray-100 text-[#677788]"
                  }`}
                >
                  {letter}
                </span>
                <span className="flex-1 leading-snug">{text}</span>
                {isSelected && (
                  <Check className="flex-shrink-0 w-4 h-4 text-[#FF6B35]" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Multi-select answer (Choose TWO/THREE letters) ──────────────────────────
// Lưu đáp án dạng "A,C" (sắp xếp). Giới hạn số lượng = selectCount.
interface MultiAnswerSelectProps {
  value: string;
  options: Record<string, string>;
  selectCount: number;
  onChange: (v: string) => void;
}

function MultiAnswerSelect({
  value,
  options,
  selectCount,
  onChange,
}: MultiAnswerSelectProps) {
  const selected = new Set(
    (value || "").split(",").map((s) => s.trim()).filter(Boolean)
  );
  const toggle = (letter: string) => {
    const next = new Set(selected);
    if (next.has(letter)) {
      next.delete(letter);
    } else {
      if (next.size >= selectCount) return; // không vượt quá số cho phép
      next.add(letter);
    }
    onChange(Array.from(next).sort().join(","));
  };
  return (
    <div className="flex-1 space-y-1">
      <p className="text-[11px] text-[#677788]">
        Chọn {selectCount} đáp án ({selected.size}/{selectCount})
      </p>
      <div className="flex flex-col gap-1">
        {Object.entries(options).map(([letter, text]) => {
          const isSelected = selected.has(letter);
          const atLimit = !isSelected && selected.size >= selectCount;
          return (
            <button
              key={letter}
              type="button"
              onClick={() => toggle(letter)}
              disabled={atLimit}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md border transition-colors cursor-pointer ${
                isSelected
                  ? "border-[#FF6B35] bg-orange-50 text-[#FF6B35]"
                  : atLimit
                    ? "border-[#e0e0e0] bg-gray-50 text-gray-300 cursor-not-allowed"
                    : "border-[#e0e0e0] bg-white text-[#1a1a1a] hover:border-[#FF6B35]"
              }`}
            >
              <span
                className={`flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${
                  isSelected ? "bg-[#FF6B35] text-white" : "bg-gray-100 text-[#677788]"
                }`}
              >
                {letter}
              </span>
              <span className="flex-1 leading-snug">{text}</span>
              {isSelected && <Check className="flex-shrink-0 w-4 h-4 text-[#FF6B35]" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
// Hiển thị yêu cầu rõ ràng trước mỗi section: loại câu hỏi + instruction +
// tip cụ thể theo loại để student không bị sai format.
const QUESTION_TYPE_META: Record<
  string,
  { label: string; tip: string }
> = {
  form_completion: {
    label: "Hoàn thành biểu mẫu",
    tip: "Điền từ/số vào chỗ trống dựa trên audio. Chú ý số từ tối đa cho mỗi ô.",
  },
  note_completion: {
    label: "Hoàn thành ghi chú",
    tip: "Điền vào chỗ trống của ghi chú. Giữ nguyên dạng từ nghe được, không paraphrase.",
  },
  table_completion: {
    label: "Hoàn thành bảng",
    tip: "Điền các ô trống trong bảng theo thứ tự hàng/cột.",
  },
  sentence_completion: {
    label: "Hoàn thành câu",
    tip: "Điền từ vào chỗ trống để câu có nghĩa hoàn chỉnh, đúng ngữ pháp.",
  },
  summary_completion: {
    label: "Hoàn thành tóm tắt",
    tip: "Điền từ vào đoạn tóm tắt. Có thể cần paraphrase ý nghe được.",
  },
  multiple_choice: {
    label: "Trắc nghiệm",
    tip: "Chọn 1 đáp án đúng nhất (A / B / C / D). Click vào ô để mở danh sách.",
  },
  short_answer: {
    label: "Trả lời ngắn",
    tip: "Trả lời ngắn gọn theo đúng số từ giới hạn. Không viết câu hoàn chỉnh.",
  },
  matching: {
    label: "Nối / Ghép cặp",
    tip: "Chọn đáp án từ danh sách để ghép với từng câu hỏi.",
  },
  diagram_labelling: {
    label: "Gán nhãn sơ đồ",
    tip: "Điền từ vào các vị trí được đánh số trên sơ đồ.",
  },
  plan_map_diagram: {
    label: "Bản đồ / Sơ đồ",
    tip: "Chọn vị trí đúng trên bản đồ theo audio.",
  },
};

function normalizeQuestionType(type: unknown): string {
  return String(type || "").toLowerCase().replace(/-/g, "_");
}

/** Highlight từ-khóa-quan-trọng trong instruction text (NO MORE THAN, ONE WORD ONLY...) */
function HighlightedInstructions({ text }: { text: string }) {
  // Pattern: "NO MORE THAN N WORDS", "ONE WORD ONLY", "TWO WORDS AND/OR A NUMBER"...
  const pattern =
    /(NO MORE THAN [A-Z\-\s]+(?:WORDS?|NUMBERS?)(?:\s+AND(?:\/OR)?\s+A\s+NUMBER)?|ONE WORD ONLY|ONE WORD AND\/OR A NUMBER|TWO WORDS AND\/OR A NUMBER|THREE WORDS AND\/OR A NUMBER|TWO WORDS ONLY|THREE WORDS ONLY|A NUMBER ONLY)/g;
  const parts = text.split(pattern);
  return (
    <p className="text-[15px] leading-[1.6] text-[#1F2937] whitespace-pre-wrap">
      {parts.map((part, i) =>
        part && pattern.test(part) ? (
          <span
            key={i}
            className="font-bold text-[#FF6B35] bg-orange-50 px-1 rounded"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

function SectionInstructions({ section }: { section: IeltsListeningSection }) {
  const qType = normalizeQuestionType(section.questionType);
  const meta = QUESTION_TYPE_META[qType];
  const startQ = section.questionStart;
  const endQ = startQ + section.questionsPerSection - 1;
  // Tiêu đề part — chỉ hiện nếu là tiêu đề chủ đề thật (không phải "Section N"/"Recording N")
  const rawTitle = (section.sectionName ?? "").trim();
  const isGenericTitle = /^(section|recording|part)\s*\d+$/i.test(rawTitle);
  const partTitle = rawTitle && !isGenericTitle ? rawTitle : "";

  return (
    <div className="rounded-xl border border-orange-200/70 bg-white shadow-sm overflow-hidden">
      {/* Header — soft, subtle accent */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-orange-50/60 border-b border-orange-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#FF6B35]/10 text-[#FF6B35] flex items-center justify-center">
            <Info className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#FF6B35]">
              {partTitle ? "Chủ đề" : "Yêu cầu"}
            </p>
            {partTitle ? (
              <p className="text-sm font-bold text-gray-900 leading-tight truncate">
                {partTitle}
                {meta && (
                  <span className="ml-1.5 font-normal text-gray-400">
                    · {meta.label}
                  </span>
                )}
              </p>
            ) : (
              meta && (
                <p className="text-sm font-bold text-gray-900 leading-tight truncate">
                  {meta.label}
                </p>
              )
            )}
          </div>
        </div>
        <span className="flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-md bg-white border border-orange-200 text-xs font-semibold text-[#FF6B35]">
          Câu {startQ}–{endQ}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {section.instructions ? (
          <HighlightedInstructions text={section.instructions} />
        ) : (
          <p className="text-sm text-gray-600 italic">
            Nghe audio và hoàn thành các câu hỏi {startQ}–{endQ}.
          </p>
        )}

        {meta?.tip && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-white border border-orange-100">
            <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-700 leading-relaxed">
              <span className="font-semibold text-gray-900">Mẹo:</span> {meta.tip}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * IELTS Listening — CBT view (mô phỏng giao diện thi thật trên máy).
 *
 * Dùng chung cho cả PRACTICE và FULL TEST mode (chỉ khác audio + banner tip):
 *   • practiceMode=true  → audio cho seek/replay tự do, banner tip "Pro tips"
 *   • practiceMode=false → audio one-time only, banner tip ngắn (CBT thật)
 *
 * Layout:
 *   • Body 1 cột, max-width 1100px (giống British Council CBT)
 *   • Bỏ section tabs — audio tự đẩy section qua onEnded
 *   • Học viên gõ đáp án INLINE ngay tại vị trí blank `___`
 *   • Hiển thị từng section một (current section only)
 *
 * Thiết kế UX:
 *   • Header sticky: "Part X — instructions" + audio bar
 *   • Body cuộn, từng câu là 1 card có đánh số rõ ở góc trái
 *   • Câu MCQ: radio A/B/C/D inline dưới stem
 *   • Câu completion: text có blank `___N___` được render thành <input>
 *
 * Reuse logic từ IeltsListeningView:
 *   • Parsing prefix/rest, tabular detection, cleanQuestionText, splitEntryPrefix
 *   • Audio component, navigator, submit dialog (dùng cùng IeltsAudioOnce)
 */
import { useMemo, useState, useCallback } from "react";
import { ArrowRight, Headphones, Lightbulb } from "lucide-react";
import type {
  IeltsListeningPayload,
  IeltsListeningSection,
  AnswerMap,
} from "../types";
import { IeltsAudioOnce } from "../components/IeltsAudioOnce";
import { type QuestionMeta } from "../components/IeltsBottomNav";
import { IeltsQuestionNavigator } from "../components/IeltsQuestionNavigator";

interface Props {
  payload: IeltsListeningPayload;
  answers: AnswerMap;
  flagged: Record<number, boolean>;
  onAnswer: (qId: number, value: any) => void;
  onToggleFlag: (qId: number) => void;
  onSubmit: () => void;
  timeLeft?: number;
  showTimer?: boolean;
  /**
   * `true`  → practice mode: audio cho phép pause/seek/replay, banner Pro tips.
   * `false` → full test (CBT) mode: audio one-time, banner tip ngắn.
   * Default: false (CBT giả lập thi thật).
   */
  practiceMode?: boolean;
  /** Review mode: mở khóa tất cả section, ẩn legend gắn cờ trong navigator */
  reviewMode?: boolean;
  /** Map qId → đáp án đúng (dùng cho review mode) */
  correctAnswers?: Record<number, string>;
  /** Map qId → boolean: kết quả chấm của server. Dùng để tô màu thay so sánh text */
  isCorrectMap?: Record<number, boolean>;
}

export function IeltsListeningFullTestView({
  payload,
  answers,
  flagged,
  onAnswer,
  onToggleFlag,
  onSubmit,
  timeLeft,
  showTimer,
  practiceMode = false,
  reviewMode = false,
  correctAnswers = {} as Record<number, string>,
  isCorrectMap = {} as Record<number, boolean>,
}: Props) {
  const sections = payload.sections ?? [];
  // Review mode: mở khóa tất cả sections ngay từ đầu
  const [sectionIdx, setSectionIdx] = useState(() => reviewMode ? Math.max(0, (payload.sections ?? []).length - 1) : 0);
  const [audioStartedAt, setAudioStartedAt] = useState<number | null>(null);
  const currentSection: IeltsListeningSection | undefined = sections[sectionIdx];

  // Build flat list of all questions cho navigator (1–40)
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
    if (sectionIdx < sections.length - 1) {
      const nextIdx = sectionIdx + 1;
      setSectionIdx(nextIdx);
      setAudioStartedAt(Date.now());
      // Scroll xuống đầu section mới sau khi DOM cập nhật
      requestAnimationFrame(() => {
        const nextSec = sections[nextIdx];
        if (nextSec) {
          const el = document.getElementById(`ielts-ft-section-${nextSec.sectionNumber}`);
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }
  };

  const jumpToQuestion = (q: QuestionMeta) => {
    // Cho phép jump tới mọi câu trong section đã unlock (≤ sectionIdx).
    // IELTS CBT thật cho học viên xem lại/sửa đáp án các part đã nghe xong.
    if (q.groupIndex <= sectionIdx) {
      requestAnimationFrame(() => {
        const el = document.getElementById(`ielts-ft-q-${q.qId}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        const input = el?.querySelector<HTMLInputElement>("input,select,textarea");
        input?.focus();
      });
    }
  };

  // Các section đã unlock (đã phát hoặc đang phát) — render tất cả trong body
  const visibleSections = sections.slice(0, sectionIdx + 1);

  if (!currentSection) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center text-gray-500">
        Đang tải dữ liệu đề thi…
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-white flex flex-col">
      {/* ── Sticky header: section info + audio (KHÔNG có tab section) ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1100px] mx-auto px-4 py-1.5">
          {/* Section heading row */}
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-blue-50 text-blue-700 flex-shrink-0">
              <Headphones className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
                Part {currentSection.sectionNumber} of {sections.length}
              </p>
              <p className="text-sm font-bold text-gray-900 truncate">
                {currentSection.sectionName}
              </p>
            </div>
            {/* Part buttons */}
            <div className="flex items-center gap-1.5">
              {sections.map((sec, i) => {
                const isDone    = i < sectionIdx;
                const isCurrent = i === sectionIdx;
                const isLocked  = !reviewMode && i > sectionIdx;
                const canClick  = reviewMode || i <= sectionIdx;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!canClick}
                    onClick={() => setSectionIdx(i)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
                      isCurrent
                        ? "bg-orange-100 text-orange-700 border border-orange-300"
                        : isDone
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                          : isLocked
                            ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                            : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100 cursor-pointer"
                    }`}
                  >
                    {isDone && <span className="mr-1">✓</span>}
                    Part {sec.sectionNumber}{sec.sectionName ? ` · ${sec.sectionName}` : ""}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audio player — practice cho seek/replay, full_test one-time */}
          {currentSection.audioUrl ? (
            <IeltsAudioOnce
              key={`audio-${currentSection.sectionNumber}-${audioStartedAt}`}
              src={currentSection.audioUrl}
              autoPlay={!reviewMode}
              onEnded={handleSectionEnded}
              lockAfterEnd={!practiceMode}
            />
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <span className="text-amber-500">⚠</span>
              Không có file audio cho section này.
            </div>
          )}
        </div>
      </div>

      {/* ── Body 1 cột — render TẤT CẢ section đã unlock (≤ sectionIdx) ── */}
      <div className="flex-1 max-w-[1100px] w-full mx-auto px-4 sm:px-6 py-6 pb-32">
        {/* Tip banner — Pro tips cho practice, tip ngắn cho full test (chỉ hiện ở đầu trang) */}
        {practiceMode ? (
          <div className="mb-5 p-3 rounded-lg border border-emerald-200 bg-emerald-50/60">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600" />
              <div className="text-[13px] leading-relaxed text-emerald-900">
                <b>Pro tips luyện tập:</b> Bạn có thể tạm dừng, tua lại, hoặc nghe lại
                audio thoải mái. Hãy gõ đáp án trực tiếp vào ô trống trong câu hỏi và
                kiểm tra chính tả trước khi nộp bài.
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-5 flex items-start gap-2 text-xs text-gray-500">
            <Lightbulb className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
            <span>
              Bài nghe phát <b>1 lần duy nhất</b>. Các phần đã nghe xong vẫn có thể xem lại và sửa đáp án.
            </span>
          </div>
        )}

        {/* Render chỉ section đang active (tab switch, không scroll) */}
        <section
          key={`sec-${currentSection.sectionNumber}`}
          id={`ielts-ft-section-${currentSection.sectionNumber}`}
        >
          {/* Section heading */}
          <div className="flex items-center gap-3 mb-4 pb-2 border-b-2 border-orange-300">
            <span className="flex items-center justify-center w-8 h-8 rounded-md text-xs font-bold bg-orange-500 text-white">
              {currentSection.sectionNumber}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide font-bold text-gray-500">
                Part {currentSection.sectionNumber}
                <span className="ml-2 text-orange-600 normal-case">
                  {reviewMode ? "· xem lại" : "· đang nghe"}
                </span>
              </p>
              <p className="text-sm font-bold text-gray-900 truncate">{currentSection.sectionName}</p>
            </div>
            <span className="text-xs text-gray-400 tabular-nums flex-shrink-0">
              Q{currentSection.questions[0]?.questionNumber}–
              {currentSection.questions[currentSection.questions.length - 1]?.questionNumber}
            </span>
          </div>

          {/* Instructions banner */}
          {currentSection.instructions && (
            <div className="mb-5 p-4 rounded-lg border-2 border-orange-200 bg-orange-50/40">
              <p className="text-[11px] uppercase tracking-wide text-orange-700 font-bold mb-1">
                Questions {currentSection.questions[0]?.questionNumber}–
                {currentSection.questions[currentSection.questions.length - 1]?.questionNumber}
              </p>
              <HighlightedInstructions text={currentSection.instructions} />
            </div>
          )}

          {/* Questions body */}
          <SectionBody
            section={currentSection}
            answers={answers}
            onAnswer={onAnswer}
            correctAnswers={correctAnswers}
            isCorrectMap={isCorrectMap}
            reviewMode={reviewMode}
          />
        </section>

        {/* Skip button → next section (chỉ hiện khi có section sau) */}
        {sectionIdx < sections.length - 1 && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleSectionEnded}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-orange-600 transition-colors cursor-pointer"
            >
              Bỏ qua sang Part {currentSection.sectionNumber + 1}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <IeltsQuestionNavigator
        questions={allMeta}
        answers={answers}
        flagged={flagged}
        activeGroupIndex={sectionIdx}
        onJump={jumpToQuestion}
        timeLeft={timeLeft}
        showTimer={showTimer}
        onSubmit={onSubmit}
        currentGroupOnly={!reviewMode}
        onToggleFlag={reviewMode ? undefined : onToggleFlag}
        reviewMode={reviewMode}
        correctAnswers={correctAnswers}
        isCorrectMap={isCorrectMap}
      />
    </div>
  );
}

// ─── Section body — chọn render mode tự động ─────────────────────────────
function SectionBody({
  section,
  answers,
  onAnswer,
  correctAnswers = {},
  isCorrectMap = {},
  reviewMode = false,
}: {
  section: IeltsListeningSection;
  answers: AnswerMap;
  onAnswer: (qId: number, value: any) => void;
  correctAnswers?: Record<number, string>;
  isCorrectMap?: Record<number, boolean>;
  reviewMode?: boolean;
}) {
  const allImgCompletion = section.questions.every(
    (q) => q.questionType === "image-completion" || q.questionType === "image_completion"
  );
  const hasImgCompletion = section.questions.some(
    (q) => q.questionType === "image-completion" || q.questionType === "image_completion"
  );
  const allMcq = !hasImgCompletion && section.questions.every(
    (q) => q.options && Object.keys(q.options).length > 0
  );

  if (allImgCompletion) {
    return <ImageCompletionBody section={section} answers={answers} onAnswer={onAnswer} correctAnswers={correctAnswers} isCorrectMap={isCorrectMap} reviewMode={reviewMode} />;
  }
  if (allMcq) {
    return <McqBody section={section} answers={answers} onAnswer={onAnswer} correctAnswers={correctAnswers} isCorrectMap={isCorrectMap} reviewMode={reviewMode} />;
  }
  return <CompletionBody section={section} answers={answers} onAnswer={onAnswer} correctAnswers={correctAnswers} isCorrectMap={isCorrectMap} reviewMode={reviewMode} />;
}

// ─── Image-completion body ─────────────────────────────────────────────────
function ImageCompletionBody({
  section,
  answers,
  onAnswer,
  correctAnswers = {},
  isCorrectMap = {},
  reviewMode = false,
}: {
  section: IeltsListeningSection;
  answers: AnswerMap;
  onAnswer: (qId: number, value: any) => void;
  correctAnswers?: Record<number, string>;
  isCorrectMap?: Record<number, boolean>;
  reviewMode?: boolean;
}) {
  const [zoomed, setZoomed] = useState(false);
  const taskImage = (section.questions[0]?.data?.task_image as string)
    || (section.questions[0]?.data?.taskImage as string) || "";

  const handleZoom = useCallback(() => setZoomed(true), []);
  const handleUnzoom = useCallback(() => setZoomed(false), []);

  return (
    <div className="space-y-4">
      {/* ── Image ── */}
      {taskImage ? (
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50/30 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">
              Xem ảnh đề bên dưới rồi điền đáp án vào các ô
            </span>
          </div>
          <div className="p-3">
            <img
              src={taskImage}
              alt="Question page"
              className="w-full rounded-lg border border-amber-200 cursor-zoom-in"
              onClick={handleZoom}
              title="Nhấp để phóng to"
            />
          </div>
          {zoomed && (
            <div
              className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 cursor-zoom-out"
              onClick={handleUnzoom}
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
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-5 text-center text-sm text-amber-700 italic">
          Giáo viên chưa upload ảnh đề cho phần này.
        </div>
      )}

      {/* ── Numbered answer inputs ── */}
      <div className="space-y-2">
        {section.questions.map((q) => {
          const value = (answers[q.qId] ?? "") as string;
          const answered = value.trim().length > 0;
          const isCorrect = reviewMode && answered && (
            q.qId in isCorrectMap
              ? isCorrectMap[q.qId]
              : value.trim().toLowerCase() === (correctAnswers[q.qId] ?? "").trim().toLowerCase()
          );
          const isWrong = reviewMode && answered && !isCorrect;
          return (
            <div
              key={q.qId}
              id={`ielts-ft-q-${q.qId}`}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                isCorrect ? "border-emerald-300 bg-emerald-50/40" :
                isWrong   ? "border-red-300 bg-red-50/40" :
                "border-gray-200 bg-white shadow-sm"
              }`}
            >
              <span className={`flex-shrink-0 w-8 h-8 rounded-md text-white text-sm font-bold flex items-center justify-center ${
                isCorrect ? "bg-emerald-500" : isWrong ? "bg-red-500" : "bg-orange-500"
              }`}>
                {q.questionNumber}
              </span>
              {q.questionText && (
                <span className="text-[14px] text-gray-700 flex-shrink-0 whitespace-pre-wrap">{q.questionText}</span>
              )}
              <input
                type="text"
                value={value}
                onChange={(e) => !reviewMode && onAnswer(q.qId, e.target.value)}
                placeholder={`Câu ${q.questionNumber}`}
                disabled={reviewMode}
                className={`flex-1 px-3 py-1.5 text-[14px] rounded-md border outline-none transition-colors ${
                  reviewMode
                    ? isCorrect ? "border-emerald-300 bg-emerald-50 text-emerald-700 font-semibold"
                      : isWrong  ? "border-red-300 bg-red-50 text-red-700 font-semibold"
                      : "border-gray-200 bg-gray-50 text-gray-500"
                    : "border-orange-300 bg-orange-50/60 text-orange-800 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                }`}
              />
              {isWrong && correctAnswers[q.qId] && (
                <span className="flex-shrink-0 text-[12px] font-bold text-emerald-700 whitespace-nowrap">
                  ✓ {correctAnswers[q.qId]}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MCQ body ────────────────────────────────────────────────────────────
function McqBody({
  section,
  answers,
  onAnswer,
  correctAnswers = {},
  isCorrectMap = {},
  reviewMode = false,
}: {
  section: IeltsListeningSection;
  answers: AnswerMap;
  onAnswer: (qId: number, value: any) => void;
  correctAnswers?: Record<number, string>;
  isCorrectMap?: Record<number, boolean>;
  reviewMode?: boolean;
}) {
  return (
    <div className="space-y-5">
      {section.questions.map((q) => {
        const answered = answers[q.qId] != null && String(answers[q.qId]).trim() !== "";
        // Dùng server-graded isCorrectMap; fallback text-compare nếu chưa có
        const isCorrectQ = reviewMode && answered && (
          q.qId in isCorrectMap
            ? isCorrectMap[q.qId]
            : String(answers[q.qId]).toLowerCase() === (correctAnswers[q.qId] ?? "").toLowerCase()
        );
        const isWrongQ = reviewMode && answered && !isCorrectQ;
        return (
          <div
            key={q.qId}
            id={`ielts-ft-q-${q.qId}`}
            className={`rounded-lg border p-4 shadow-sm ${
              isCorrectQ ? "border-emerald-300 bg-emerald-50/40" :
              isWrongQ   ? "border-red-300 bg-red-50/40" :
              "border-gray-200 bg-white"
            }`}
          >
            <div className="flex items-start gap-3 mb-3">
              <span className={`flex-shrink-0 w-7 h-7 rounded-md text-white text-sm font-bold flex items-center justify-center ${
                isCorrectQ ? "bg-emerald-500" : isWrongQ ? "bg-red-500" : "bg-orange-500"
              }`}>
                {q.questionNumber}
              </span>
              <p className="flex-1 text-[15px] leading-relaxed text-gray-900 whitespace-pre-wrap">
                {cleanQuestionText(q.questionText, q.questionNumber)}
              </p>
            </div>
            {q.options && (() => {
              const selectCount = Number((q.data?.select_count as number) ?? 1);
              const isMulti = selectCount > 1;
              const selSet = new Set(
                String(answers[q.qId] ?? "").split(",").map((s) => s.trim()).filter(Boolean)
              );
              const corrSet = new Set(
                String(correctAnswers[q.qId] ?? "").split(",").map((s) => s.trim()).filter(Boolean)
              );
              const toggleMulti = (letter: string) => {
                if (reviewMode) return;
                const next = new Set(selSet);
                if (next.has(letter)) next.delete(letter);
                else {
                  if (next.size >= selectCount) return;
                  next.add(letter);
                }
                onAnswer(q.qId, Array.from(next).sort().join(","));
              };
              return (
                <div className="ml-10 space-y-2">
                  {isMulti && !reviewMode && (
                    <p className="text-[11px] text-gray-500">
                      Chọn {selectCount} đáp án ({selSet.size}/{selectCount})
                    </p>
                  )}
                  {Object.entries(q.options!).map(([letter, text]) => {
                    const selected = isMulti ? selSet.has(letter) : answers[q.qId] === letter;
                    const isOptCorrect = reviewMode && (isMulti ? corrSet.has(letter) : letter === correctAnswers[q.qId]);
                    const isOptWrong   = reviewMode && selected && !isOptCorrect;
                    return (
                      <label
                        key={letter}
                        className={`flex items-start gap-3 p-2.5 rounded-md border transition-colors ${
                          isOptCorrect ? "border-emerald-400 bg-emerald-50 cursor-default" :
                          isOptWrong   ? "border-red-400 bg-red-50 cursor-default" :
                          selected     ? "border-orange-400 bg-orange-50 cursor-default" :
                          reviewMode   ? "border-gray-200 bg-white cursor-default opacity-60" :
                          "border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer"
                        }`}
                      >
                        <input
                          type={isMulti ? "checkbox" : "radio"}
                          name={`q-${q.qId}`}
                          value={letter}
                          checked={selected}
                          onChange={() =>
                            isMulti ? toggleMulti(letter) : (!reviewMode && onAnswer(q.qId, letter))
                          }
                          disabled={reviewMode}
                          className="mt-0.5 w-4 h-4 text-orange-600"
                        />
                        <span className="flex-1 text-sm text-gray-800">
                          <b className="mr-1.5">{letter}</b>
                          {text}
                        </span>
                        {isOptCorrect && <span className="text-emerald-600 font-bold text-xs flex-shrink-0">✓</span>}
                      </label>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}

// ─── Completion body — render inline blank thành <input> ─────────────────
function CompletionBody({
  section,
  answers,
  onAnswer,
  correctAnswers = {},
  isCorrectMap = {},
  reviewMode = false,
}: {
  section: IeltsListeningSection;
  answers: AnswerMap;
  onAnswer: (qId: number, value: any) => void;
  correctAnswers?: Record<number, string>;
  isCorrectMap?: Record<number, boolean>;
  reviewMode?: boolean;
}) {
  // Parse từng câu thành { prefix, rest } để có thể group entry
  const parsed = useMemo(() => {
    return section.questions.map((q) => {
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
      };
    });
  }, [section.questions]);

  // Detect tabular: ≥50% câu có prefix "Subject — facet"
  const useTabular = useMemo(() => {
    if (parsed.length < 3) return false;
    const withPrefix = parsed.filter((p) => p.prefix !== null).length;
    return withPrefix >= parsed.length * 0.5;
  }, [parsed]);

  // ─── Tabular: group theo prefix subject ──────────────────────────────
  if (useTabular) {
    type Group = {
      key: string;
      prefix: string | null;
      title?: string;
      items: { qId: number; number: number; text: string }[];
    };
    const groups: Group[] = [];
    parsed.forEach((p) => {
      const last = groups[groups.length - 1];
      if (last && last.prefix === p.prefix && last.title === p.title && p.prefix !== null) {
        last.items.push({ qId: p.qId, number: p.questionNumber, text: p.rest });
      } else {
        groups.push({
          key: `g-${p.qId}`,
          prefix: p.prefix,
          title: p.title,
          items: [{ qId: p.qId, number: p.questionNumber, text: p.rest }],
        });
      }
    });

    return (
      <div className="space-y-4">
        {groups.map((g) => (
          <div
            key={g.key}
            className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
          >
            {g.title && (
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 whitespace-pre-wrap">{g.title}</h3>
              </div>
            )}
            {g.prefix && (
              <div className="px-4 py-2.5 bg-orange-50/40 border-b border-orange-100/60">
                <span className="text-[15px] font-bold text-gray-900 whitespace-pre-wrap">{g.prefix}</span>
              </div>
            )}
            <ul className="divide-y divide-gray-100">
              {g.items.map((item) => (
                <li
                  key={item.qId}
                  id={`ielts-ft-q-${item.qId}`}
                  className="px-4 py-3 flex items-start gap-3"
                >
                  <span className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-md bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
                    {item.number}
                  </span>
                  <div className="flex-1 text-[15px] leading-[1.7] text-gray-900 whitespace-pre-wrap">
                    {renderInlineInput(
                      item.text,
                      item.qId,
                      item.number,
                      answers[item.qId] as string,
                      (v) => onAnswer(item.qId, v),
                      reviewMode,
                      correctAnswers[item.qId],
                      isCorrectMap
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  // ─── Flat list — mỗi câu là 1 dòng ───────────────────────────────────
  return (
    <div className="space-y-3">
      {parsed.map((p) => (
        <div
          key={p.qId}
          id={`ielts-ft-q-${p.qId}`}
          className="flex items-start gap-3 px-4 py-3 rounded-lg border border-gray-200 bg-white shadow-sm"
        >
          <span className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-md bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
            {p.questionNumber}
          </span>
          <div className="flex-1 text-[15px] leading-[1.7] text-gray-900 whitespace-pre-wrap">
            {renderInlineInput(
              p.prefix ? `${p.prefix} — ${p.rest}` : p.rest,
              p.qId,
              p.questionNumber,
              answers[p.qId] as string,
              (v) => onAnswer(p.qId, v),
              reviewMode,
              correctAnswers[p.qId],
              isCorrectMap
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Inline input renderer ───────────────────────────────────────────────
/**
 * Tách text thành phần text + input ngay tại blank.
 * Match cả `___N___` (có số) lẫn `___` (raw) — ô đầu tiên gắn với qId hiện tại.
 * Nếu có nhiều blank trong cùng 1 text → blank thứ 2+ chỉ là visual placeholder
 * (không có input thật, vì 1 qId = 1 đáp án). IELTS gần như luôn 1 blank/câu.
 */
function renderInlineInput(
  text: string,
  qId: number,
  questionNumber: number,
  value: string | undefined,
  onChange: (v: string) => void,
  reviewMode: boolean = false,
  correctAnswer: string = "",
  isCorrectMap: Record<number, boolean> = {}
) {
  const answered = value != null && value.trim() !== "";
  // Ưu tiên server-graded isCorrectMap; fallback text-compare nếu chưa có entry
  const isCorrect = reviewMode && answered && (
    qId in isCorrectMap
      ? isCorrectMap[qId]
      : correctAnswer !== "" && value!.trim().toLowerCase() === correctAnswer.trim().toLowerCase()
  );
  const isWrong = reviewMode && answered && !isCorrect;

  const inputCls = reviewMode
    ? isCorrect
      ? "inline-block min-w-[120px] max-w-[260px] mx-1 px-2 py-1 text-sm font-semibold text-emerald-700 bg-emerald-50 border-b-2 border-emerald-500 outline-none rounded-sm"
      : isWrong
        ? "inline-block min-w-[120px] max-w-[260px] mx-1 px-2 py-1 text-sm font-semibold text-red-700 bg-red-50 border-b-2 border-red-400 outline-none rounded-sm"
        : "inline-block min-w-[120px] max-w-[260px] mx-1 px-2 py-1 text-sm font-semibold text-gray-500 bg-gray-50 border-b-2 border-gray-300 outline-none rounded-sm"
    : "inline-block min-w-[120px] max-w-[260px] mx-1 px-2 py-1 text-sm font-semibold text-orange-700 placeholder:text-orange-400/60 bg-orange-50/60 border-b-2 border-orange-400 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none rounded-sm transition-colors";

  const tailCls = reviewMode
    ? isCorrect
      ? "ml-2 inline-block min-w-[160px] max-w-[260px] px-2 py-1 text-sm font-semibold text-emerald-700 bg-emerald-50 border-b-2 border-emerald-500 outline-none rounded-sm"
      : isWrong
        ? "ml-2 inline-block min-w-[160px] max-w-[260px] px-2 py-1 text-sm font-semibold text-red-700 bg-red-50 border-b-2 border-red-400 outline-none rounded-sm"
        : "ml-2 inline-block min-w-[160px] max-w-[260px] px-2 py-1 text-sm font-semibold text-gray-500 bg-gray-50 border-b-2 border-gray-300 outline-none rounded-sm"
    : "ml-2 inline-block min-w-[160px] max-w-[260px] px-2 py-1 text-sm font-semibold text-orange-700 placeholder:text-orange-400/60 bg-orange-50/60 border-b-2 border-orange-400 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none rounded-sm transition-colors";

  const parts: React.ReactNode[] = [];
  const regex = /_{2,}\s*(\d+)?\s*_{2,}|_{2,}/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let inputPlaced = false;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) {
      parts.push(<span key={`t-${m.index}`} className="whitespace-pre-wrap">{text.slice(lastIndex, m.index)}</span>);
    }
    if (!inputPlaced) {
      parts.push(
        <input
          key={`i-${qId}`}
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={String(questionNumber)}
          disabled={reviewMode}
          className={inputCls}
        />
      );
      // Hiển thị đáp án đúng cạnh ô nếu học viên trả lời sai
      if (isWrong && correctAnswer) {
        parts.push(
          <span key={`ca-${qId}`} className="ml-1.5 text-[12px] font-bold text-emerald-700 whitespace-nowrap">
            ✓ {correctAnswer}
          </span>
        );
      }
      inputPlaced = true;
    } else {
      parts.push(
        <span
          key={`p-${m.index}`}
          className="inline-block min-w-[60px] mx-1 border-b-2 border-gray-300"
        >
          &nbsp;
        </span>
      );
    }
    lastIndex = m.index + m[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(<span key="tail" className="whitespace-pre-wrap">{text.slice(lastIndex)}</span>);
  }

  if (!inputPlaced) {
    parts.push(
      <input
        key={`i-${qId}-tail`}
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Câu ${questionNumber}`}
        disabled={reviewMode}
        className={tailCls}
      />
    );
    if (isWrong && correctAnswer) {
      parts.push(
        <span key={`ca-${qId}-tail`} className="ml-1.5 text-[12px] font-bold text-emerald-700 whitespace-nowrap">
          ✓ {correctAnswer}
        </span>
      );
    }
  }

  return <span className="whitespace-pre-wrap">{parts}</span>;
}

// ─── Helpers (copy từ IeltsListeningView để tự chứa) ─────────────────────

function cleanQuestionText(text: string, questionNumber: number): string {
  let out = text;
  out = out.replace(/(^|\s)\d{1,3}\s+(_{2,})/g, "$1$2");
  out = out.replace(new RegExp(`(^|\\s)${questionNumber}\\s+(?=[£$€%]|\\b)`, "g"), "$1");
  out = out.replace(/ {2,}/g, " ").trim();
  return out;
}

function splitEntryPrefix(text: string): { prefix: string | null; rest: string } {
  const m = text.match(/^([^—–\n]{1,60}?)\s+[—–]\s+(.+)$/s);
  if (m) {
    const prefix = m[1].trim();
    if (/^\d+$/.test(prefix)) {
      return { prefix: null, rest: text };
    }
    return { prefix, rest: m[2].trim() };
  }
  return { prefix: null, rest: text };
}

function HighlightedInstructions({ text }: { text: string }) {
  const pattern =
    /(NO MORE THAN [A-Z\-\s]+(?:WORDS?|NUMBERS?)(?:\s+AND(?:\/OR)?\s+A\s+NUMBER)?|ONE WORD ONLY|ONE WORD AND\/OR A NUMBER|TWO WORDS AND\/OR A NUMBER|THREE WORDS AND\/OR A NUMBER|TWO WORDS ONLY|THREE WORDS ONLY|A NUMBER ONLY)/g;
  const parts = text.split(pattern);
  return (
    <p className="text-[14px] leading-[1.6] text-gray-800 whitespace-pre-wrap">
      {parts.map((part, i) =>
        part && pattern.test(part) ? (
          <span key={i} className="font-bold text-orange-700 bg-orange-100/60 px-1 rounded">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

export default IeltsListeningFullTestView;

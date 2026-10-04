/**
 * IELTS Reading — student view (3 passages × ~13–14 Q = 40 total).
 *
 * Layout (matches CD-IELTS):
 *  • Tab bar at top: Passage 1 / 2 / 3 — student can switch freely
 *  • Split view: passage on the left (scrollable), questions on the right
 *  • 60 minutes total, no automatic skill end (managed by parent timer)
 */
import { useMemo, useState, useEffect } from "react";
import { FileText, ZoomIn, X, Image as ImageIcon } from "lucide-react";
import { PassageSplitLayout } from "../../../components/PassageSplitLayout";
import type { IeltsReadingPayload, AnswerMap, IeltsQuestion } from "../types";
import { IeltsQuestionRenderer } from "../components/IeltsQuestionRenderer";
import { GroupedChooseManyBlock } from "../components/GroupedChooseManyBlock";
import { type QuestionMeta } from "../components/IeltsBottomNav";
import { IeltsQuestionNavigator } from "../components/IeltsQuestionNavigator";

type QuestionSlot =
  | { type: "single"; question: IeltsQuestion; index: number }
  | { type: "group"; questions: IeltsQuestion[]; startIndex: number };

function isGroupMcqType(rawType?: string): boolean {
  const s = (rawType || "").toLowerCase().replace(/[-_]/g, "");
  return s === "multiplechoicegroup";
}

function areGroupMembers(qA: IeltsQuestion, qB: IeltsQuestion): boolean {
  if (!isGroupMcqType(qA.questionType) || !isGroupMcqType(qB.questionType)) {
    return false;
  }
  const instrA = (qA as any).data?.task_instruction || (qA as any).taskInstruction || "";
  const instrB = (qB as any).data?.task_instruction || (qB as any).taskInstruction || "";
  if (instrA !== instrB) {
    return false;
  }
  const imgA = (qA as any).data?.task_image || (qA as any).taskImage || "";
  const imgB = (qB as any).data?.task_image || (qB as any).taskImage || "";
  if (imgA !== imgB) {
    return false;
  }
  const textA = (qA.questionText || "").trim();
  const textB = (qB.questionText || "").trim();
  if (textA && textB && textA !== textB) {
    return false;
  }
  return true;
}

function groupPassageQuestions(questions: IeltsQuestion[]): QuestionSlot[] {
  const slots: QuestionSlot[] = [];
  let i = 0;
  while (i < questions.length) {
    const q = questions[i];
    if (isGroupMcqType(q.questionType)) {
      const group: IeltsQuestion[] = [q];
      let j = i + 1;
      while (j < questions.length && areGroupMembers(q, questions[j])) {
        group.push(questions[j]);
        j++;
      }
      if (group.length > 1) {
        slots.push({ type: "group", questions: group, startIndex: i });
        i = j;
        continue;
      }
    }
    slots.push({ type: "single", question: q, index: i });
    i++;
  }
  return slots;
}
import { HighlightablePassage } from "../../../components/HighlightablePassage";
import { useTextHighlight } from "../../../../../../hooks/exam/useTextHighlight";

interface IeltsReadingViewProps {
  payload: IeltsReadingPayload;
  answers: AnswerMap;
  flagged: Record<number, boolean>;
  onAnswer: (qId: number, value: any) => void;
  onToggleFlag: (qId: number) => void;
  onSubmit: () => void;
  timeLeft?: number;
  showTimer?: boolean;
  /** Preview mode: navigator có thể kéo được */
  draggableNavigator?: boolean;
  reviewMode?: boolean;
  submissionId?: number;
  hideSubmit?: boolean;
  correctAnswers?: Record<number, string>;
  isCorrectMap?: Record<number, boolean>;
  explanations?: Record<number, string>;
}

function ReadingDiagramBlock({
  taskImage,
  rangeLabel,
}: {
  taskImage: string;
  rangeLabel: string;
}) {
  const [zoomed, setZoomed] = useState(false);

  return (
    <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50/40 p-3 shadow-xs">
      <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-blue-100">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold">
            {rangeLabel}
          </span>
          <span className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
            Sơ đồ / Diagram
          </span>
        </div>
        <button
          type="button"
          onClick={() => setZoomed(true)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
        >
          <ZoomIn className="w-3.5 h-3.5" />
          Phóng to
        </button>
      </div>

      <div className="relative group max-w-full overflow-hidden rounded-lg bg-white border border-blue-100 p-1">
        <img
          src={taskImage}
          alt={`Diagram ${rangeLabel}`}
          className="max-h-[360px] w-auto max-w-full mx-auto object-contain cursor-zoom-in rounded transition-transform group-hover:scale-[1.01]"
          onClick={() => setZoomed(true)}
          title="Bấm vào ảnh để xem toàn màn hình"
        />
      </div>

      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomed(false)}
        >
          <div
            className="relative max-w-5xl max-h-[92vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 px-2 border-b border-gray-200 mb-2">
              <span className="text-sm font-bold text-gray-800">
                Sơ đồ {rangeLabel}
              </span>
              <button
                type="button"
                onClick={() => setZoomed(false)}
                className="p-1 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={taskImage}
              alt={`Diagram zoomed ${rangeLabel}`}
              className="max-w-full max-h-[80vh] object-contain mx-auto rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function IeltsReadingView({
  payload,
  answers,
  flagged,
  onAnswer,
  onToggleFlag,
  onSubmit,
  timeLeft,
  showTimer,
  draggableNavigator = false,
  reviewMode = false,
  submissionId,
  hideSubmit = false,
  correctAnswers = {},
  isCorrectMap = {},
  explanations = {},
}: IeltsReadingViewProps) {
  const passages = payload.passages ?? [];
  const [activeIdx, setActiveIdx] = useState(0);
  const [mobileTab, setMobileTab] = useState<'question' | 'passage'>('question');
  
  // Reset tab về 'question' khi chuyển Passage
  useEffect(() => {
    setMobileTab('question');
  }, [activeIdx]);

  const currentPassage = passages[activeIdx];

  // Text highlighting cho passage hiện tại
  const highlightHook = useTextHighlight({
    submissionId: submissionId || 0,
    passageId: currentPassage?.passageNumber || 0,
    enabled: !reviewMode && !!submissionId,
  });

  const allMeta: QuestionMeta[] = useMemo(() => {
    const out: QuestionMeta[] = [];
    passages.forEach((p, idx) => {
      p.questions.forEach((q) => {
        out.push({
          number: q.questionNumber,
          qId: q.qId,
          groupIndex: idx,
          groupLabel: p.passageName,
        });
      });
    });
    return out.sort((a, b) => a.number - b.number);
  }, [passages]);

  const jumpToQuestion = (q: QuestionMeta) => {
    setActiveIdx(q.groupIndex);
    requestAnimationFrame(() => {
      const el = document.getElementById(`ielts-q-${q.qId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  if (!currentPassage) {
    return (
      <div className="p-8 text-center text-gray-500">
        No passages available for this exam.
      </div>
    );
  }

  const questionSlots = useMemo(() => {
    if (!currentPassage) return [];
    return groupPassageQuestions(currentPassage.questions);
  }, [currentPassage]);

  const currentAnswered = currentPassage.questions.filter(
    (q) => answers[q.qId] != null && answers[q.qId] !== ""
  ).length;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F5F5F5] flex flex-col">
      {/* Passage tab bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            {passages.map((p, idx) => {
              const active = idx === activeIdx;
              const answered = p.questions.filter(
                (q) => answers[q.qId] != null && answers[q.qId] !== ""
              ).length;
              const correctCount = p.questions.filter((q) => {
                if (q.qId in isCorrectMap) return isCorrectMap[q.qId];
                const a = answers[q.qId];
                const ca = correctAnswers[q.qId];
                return a != null && ca != null && String(a).trim().toLowerCase() === String(ca).trim().toLowerCase();
              }).length;

              return (
                <button
                  key={p.passageNumber}
                  type="button"
                  onClick={() => setActiveIdx(idx)}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white text-gray-700 hover:bg-blue-50 border border-gray-200"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Passage {p.passageNumber}</span>
                  <span className={`ml-1 px-1.5 rounded text-[10px] tabular-nums font-bold ${
                    reviewMode
                      ? active
                        ? "bg-white/20 text-white"
                        : "bg-emerald-100 text-emerald-800"
                      : active
                        ? "bg-white/20 text-white"
                        : answered === p.questions.length
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                  }`}>
                    {reviewMode ? `${correctCount}/${p.questions.length} đúng` : `${answered}/${p.questions.length}`}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="hidden sm:block text-xs text-gray-500">
            Q{currentPassage.questionStart}–Q{currentPassage.questionEnd}
            {currentPassage.wordCount > 0 && (
              <span className="ml-2 text-gray-400">· ~{currentPassage.wordCount} words</span>
            )}
          </div>
        </div>
      </div>

      {/* 2-col split: passage | questions */}
      <div className="flex-1 px-4 py-4 max-w-7xl w-full mx-auto">
        <PassageSplitLayout
          mobileActiveTab={mobileTab}
          onMobileTabChange={setMobileTab}
          passageTitle={currentPassage.passageName}
          passageSubtitle={currentPassage.title ? <span className="italic">{currentPassage.title}</span> : undefined}
          passageContent={
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <HighlightablePassage
                html={currentPassage.body}
                highlights={highlightHook.highlights}
                selectedColor={highlightHook.selectedColor}
                onAddHighlight={highlightHook.addHighlight}
                onRemoveHighlight={highlightHook.removeHighlight}
                onSelectColor={highlightHook.setSelectedColor}
                colors={highlightHook.colors}
                enabled={!reviewMode && !!submissionId}
              />
            </div>
          }
          questionsTitle={`Questions ${currentPassage.questionStart}-${currentPassage.questionEnd}`}
          questionsHeaderExtra={
            <div className="text-xs font-medium">
              {reviewMode ? (
                <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {currentPassage.questions.filter((q) => {
                    if (q.qId in isCorrectMap) return isCorrectMap[q.qId];
                    const a = answers[q.qId];
                    const ca = correctAnswers[q.qId];
                    return a != null && ca != null && String(a).trim().toLowerCase() === String(ca).trim().toLowerCase();
                  }).length} / {currentPassage.questions.length} câu đúng
                </span>
              ) : (
                <span className="text-gray-500">
                  {currentAnswered} / {currentPassage.questions.length} answered
                </span>
              )}
            </div>
          }
          questionsBodyClassName="space-y-3"
          questionsContent={
            <>
              {questionSlots.map((slot) => {
                if (slot.type === "group") {
                  const firstQ = slot.questions[0];
                  const lastQ = slot.questions[slot.questions.length - 1];

                  const taskImg =
                    (firstQ as any).data?.task_image || (firstQ as any).taskImage || "";
                  const prevTaskImg =
                    slot.startIndex > 0
                      ? (currentPassage.questions[slot.startIndex - 1] as any).data?.task_image ||
                        (currentPassage.questions[slot.startIndex - 1] as any).taskImage ||
                        ""
                      : "";
                  const showImage = !!taskImg && taskImg !== prevTaskImg;
                  const rangeLabel = `Câu ${firstQ.questionNumber}–${lastQ.questionNumber}`;

                  return (
                    <div key={`group-${firstQ.qId}`} className="space-y-3">
                      {showImage && (
                        <ReadingDiagramBlock
                          taskImage={taskImg}
                          rangeLabel={rangeLabel}
                        />
                      )}
                      <GroupedChooseManyBlock
                        questions={slot.questions}
                        answers={answers}
                        onAnswer={onAnswer}
                        flagged={flagged}
                        onToggleFlag={onToggleFlag}
                        reviewMode={reviewMode}
                        correctAnswers={correctAnswers}
                        isCorrectMap={isCorrectMap}
                        explanations={explanations}
                      />
                    </div>
                  );
                }

                const q = slot.question;
                const idx = slot.index;
                const instr = (q as any).data?.task_instruction || "";
                const prevInstr =
                  idx > 0
                    ? (currentPassage.questions[idx - 1] as any).data?.task_instruction || ""
                    : null;
                const showInstruction = instr && instr !== prevInstr;

                const taskImg = (q as any).data?.task_image || (q as any).taskImage || "";
                const prevTaskImg =
                  idx > 0
                    ? (currentPassage.questions[idx - 1] as any).data?.task_image ||
                      (currentPassage.questions[idx - 1] as any).taskImage ||
                      ""
                    : "";
                const showImage = !!taskImg && taskImg !== prevTaskImg;

                let rangeLabel = `Câu ${q.questionNumber}`;
                if (showImage) {
                  let groupCount = 1;
                  for (let j = idx + 1; j < currentPassage.questions.length; j++) {
                    const nextImg =
                      (currentPassage.questions[j] as any).data?.task_image ||
                      (currentPassage.questions[j] as any).taskImage ||
                      "";
                    if (nextImg === taskImg) {
                      groupCount++;
                    } else {
                      break;
                    }
                  }
                  if (groupCount > 1) {
                    rangeLabel = `Câu ${q.questionNumber}–${q.questionNumber + groupCount - 1}`;
                  }
                }

                const qExplanation =
                  explanations[q.qId] || q.explanation || (q as any).qExplanation;
                const enrichedQ = qExplanation ? { ...q, explanation: qExplanation } : q;

                return (
                  <div key={q.qId} id={`ielts-q-${q.qId}`}>
                    {showInstruction && (
                      <div className="mb-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-900 leading-relaxed whitespace-pre-line">
                        {instr}
                      </div>
                    )}
                    {showImage && (
                      <ReadingDiagramBlock
                        taskImage={taskImg}
                        rangeLabel={rangeLabel}
                      />
                    )}
                    <IeltsQuestionRenderer
                      question={enrichedQ}
                      answer={answers[q.qId] ?? null}
                      onAnswer={onAnswer}
                      flagged={!!flagged[q.qId]}
                      onToggleFlag={onToggleFlag}
                      reviewMode={reviewMode}
                      correctAnswer={correctAnswers[q.qId]}
                      isCorrect={isCorrectMap[q.qId]}
                    />
                  </div>
                );
              })}
            </>
          }
          tone="blue"
        />
      </div>

      <IeltsQuestionNavigator
        questions={allMeta}
        answers={answers}
        flagged={flagged}
        activeGroupIndex={activeIdx}
        onJump={jumpToQuestion}
        timeLeft={reviewMode ? undefined : timeLeft}
        showTimer={reviewMode ? false : showTimer}
        onSubmit={onSubmit}
        hideSubmit={hideSubmit || draggableNavigator || reviewMode}
        reviewMode={reviewMode}
        correctAnswers={correctAnswers}
        isCorrectMap={isCorrectMap}
      />
    </div>
  );
}

/**
 * IELTS Reading — student view (3 passages × ~13–14 Q = 40 total).
 *
 * Layout (matches CD-IELTS):
 *  • Tab bar at top: Passage 1 / 2 / 3 — student can switch freely
 *  • Split view: passage on the left (scrollable), questions on the right
 *  • 60 minutes total, no automatic skill end (managed by parent timer)
 */
import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { PassageSplitLayout } from "../../../components/PassageSplitLayout";
import type { IeltsReadingPayload, AnswerMap } from "../types";
import { IeltsQuestionRenderer } from "../components/IeltsQuestionRenderer";
import { type QuestionMeta } from "../components/IeltsBottomNav";
import { IeltsQuestionNavigator } from "../components/IeltsQuestionNavigator";

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
}: IeltsReadingViewProps) {
  const passages = payload.passages ?? [];
  const [activeIdx, setActiveIdx] = useState(0);

  const currentPassage = passages[activeIdx];

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
                    active
                      ? "bg-white/20 text-white"
                      : answered === p.questions.length
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-500"
                  }`}>
                    {answered}/{p.questions.length}
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
          passageTitle={currentPassage.passageName}
          passageSubtitle={currentPassage.title ? <span className="italic">{currentPassage.title}</span> : undefined}
          passageHtml={currentPassage.body}
          questionsTitle={`Questions ${currentPassage.questionStart}-${currentPassage.questionEnd}`}
          questionsHeaderExtra={
            <div className="text-xs text-gray-500">
                {currentAnswered} / {currentPassage.questions.length} answered
            </div>
          }
          questionsBodyClassName="space-y-3"
          questionsContent={
            <>
              {currentPassage.questions.map((q, idx) => {
                const instr = (q as any).data?.task_instruction || "";
                const prevInstr =
                  idx > 0
                    ? (currentPassage.questions[idx - 1] as any).data
                        ?.task_instruction || ""
                    : null;
                const showInstruction = instr && instr !== prevInstr;
                return (
                  <div key={q.qId} id={`ielts-q-${q.qId}`}>
                    {showInstruction && (
                      <div className="mb-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-900 leading-relaxed whitespace-pre-line">
                        {instr}
                      </div>
                    )}
                    <IeltsQuestionRenderer
                      question={q}
                      answer={answers[q.qId] ?? null}
                      onAnswer={onAnswer}
                      flagged={!!flagged[q.qId]}
                      onToggleFlag={onToggleFlag}
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
        hideSubmit={draggableNavigator || reviewMode}
      />
    </div>
  );
}

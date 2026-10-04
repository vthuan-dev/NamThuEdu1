import React, { useMemo } from "react";
import { Flag, Check, X, Info } from "lucide-react";
import type { IeltsQuestion, AnswerValue, AnswerMap } from "../types";
import { RichText } from "../../../../../../components/ui/RichText";

export interface GroupedChooseManyBlockProps {
  questions: IeltsQuestion[];
  answers: AnswerMap;
  onAnswer: (qId: number, value: AnswerValue) => void;
  flagged: Record<number, boolean>;
  onToggleFlag: (qId: number) => void;
  reviewMode?: boolean;
  correctAnswers?: Record<number, string>;
  isCorrectMap?: Record<number, boolean>;
  explanations?: Record<number, string>;
}

export function GroupedChooseManyBlock({
  questions,
  answers,
  onAnswer,
  flagged,
  onToggleFlag,
  reviewMode = false,
  correctAnswers = {},
  isCorrectMap = {},
  explanations = {},
}: GroupedChooseManyBlockProps) {
  const first = questions[0];
  const last = questions[questions.length - 1];
  const selectCount = questions.length;

  const headerTitle = useMemo(() => {
    if (questions.length === 1) {
      return `Question ${first.questionNumber}`;
    }
    if (questions.length === 2) {
      return `Questions ${first.questionNumber} and ${last.questionNumber}`;
    }
    return `Questions ${first.questionNumber}–${last.questionNumber}`;
  }, [questions.length, first.questionNumber, last.questionNumber]);

  // Options gom từ first question (hoặc câu nào có options)
  const options = useMemo(() => {
    for (const q of questions) {
      if (q.options && Object.keys(q.options).length > 0) {
        return q.options;
      }
    }
    return {} as Record<string, string>;
  }, [questions]);

  const optionKeys = useMemo(() => {
    return Object.keys(options)
      .filter((k) => /^[A-Za-z]$/.test(k))
      .sort();
  }, [options]);

  // Instruction (e.g. "Choose TWO letters, A-E.")
  const taskInstruction =
    (first as any).data?.task_instruction || (first as any).taskInstruction || "";

  // Union student selected letters across all questions in this group
  const selectedLetters = useMemo(() => {
    const set = new Set<string>();
    for (const q of questions) {
      const raw = answers[q.qId];
      if (raw != null && String(raw).trim() !== "") {
        String(raw)
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
          .forEach((l) => set.add(l));
      }
    }
    return set;
  }, [questions, answers]);

  // Union correct letters across all questions in this group
  const correctLetters = useMemo(() => {
    const set = new Set<string>();
    for (const q of questions) {
      const raw = correctAnswers?.[q.qId];
      if (raw != null && String(raw).trim() !== "") {
        String(raw)
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
          .forEach((l) => set.add(l));
      }
    }
    return set;
  }, [questions, correctAnswers]);

  // Handle toggling an option and auto-distributing to questions in alphabetical order
  const handleToggle = (letter: string) => {
    if (reviewMode) return;
    const upper = letter.toUpperCase();
    const next = new Set(selectedLetters);

    if (next.has(upper)) {
      next.delete(upper);
    } else {
      if (next.size >= selectCount) {
        // Đã chọn đủ số lượng tối đa -> không cho chọn thêm trừ khi bỏ bớt
        return;
      }
      next.add(upper);
    }

    const sorted = Array.from(next).sort();
    questions.forEach((q, idx) => {
      onAnswer(q.qId, sorted[idx] ?? "");
    });
  };

  // Review mode: tính số câu đúng
  const correctCount = useMemo(() => {
    if (!reviewMode) return 0;
    let cnt = 0;
    for (const q of questions) {
      if (q.qId in isCorrectMap) {
        if (isCorrectMap[q.qId]) cnt++;
      } else {
        const a = String(answers[q.qId] ?? "").trim().toUpperCase();
        if (a && correctLetters.has(a)) {
          cnt++;
        }
      }
    }
    return cnt;
  }, [reviewMode, questions, isCorrectMap, answers, correctLetters]);

  // Unique explanations for this group
  const uniqueExplanations = useMemo(() => {
    if (!reviewMode) return [];
    const list: string[] = [];
    const seen = new Set<string>();
    for (const q of questions) {
      const exp = explanations[q.qId] || q.explanation || (q as any).qExplanation;
      if (exp && exp.trim() && !seen.has(exp.trim())) {
        seen.add(exp.trim());
        list.push(exp.trim());
      }
    }
    return list;
  }, [reviewMode, questions, explanations]);

  const isFull = selectedLetters.size >= selectCount;

  return (
    <div className="relative bg-white border border-gray-200 rounded-xl p-5 shadow-sm transition-all hover:border-gray-300">
      {/* Invisible anchor divs so jumping to any question in navigator scrolls here */}
      {questions.map((q) => (
        <div
          key={q.qId}
          id={`ielts-q-${q.qId}`}
          className="absolute -top-4 left-0 pointer-events-none w-0 h-0"
        />
      ))}

      {/* Top row: Questions X and Y badge + Flags + Counter */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-base text-gray-900 tracking-tight">
            {headerTitle}
          </span>

          {/* Flag buttons per question */}
          <div className="flex items-center gap-1.5">
            {questions.map((q) => {
              const isFlag = !!flagged[q.qId];
              return (
                <button
                  key={q.qId}
                  type="button"
                  onClick={() => onToggleFlag(q.qId)}
                  disabled={reviewMode}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    isFlag
                      ? "bg-amber-100 text-amber-700 border border-amber-300 shadow-xs"
                      : "bg-gray-50 text-gray-500 hover:bg-amber-50 hover:text-amber-600 border border-gray-200"
                  }`}
                  title={
                    isFlag
                      ? `Bỏ cờ câu ${q.questionNumber}`
                      : `Gắn cờ câu ${q.questionNumber}`
                  }
                >
                  <Flag className={`w-3 h-3 ${isFlag ? "fill-current" : ""}`} />
                  <span>{q.questionNumber}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Counter or Review status */}
        <div>
          {reviewMode ? (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                correctCount === selectCount
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : correctCount > 0
                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                  : "bg-red-100 text-red-800 border border-red-300"
              }`}
            >
              {correctCount === selectCount && <Check className="w-3.5 h-3.5" />}
              {correctCount === 0 && <X className="w-3.5 h-3.5" />}
              {correctCount} / {selectCount} câu đúng
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                isFull
                  ? "bg-blue-600 text-white font-bold shadow-xs"
                  : selectedLetters.size > 0
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "bg-gray-100 text-gray-600 border border-gray-200"
              }`}
            >
              <span>
                Đã chọn {selectedLetters.size}/{selectCount}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Task Instruction (e.g. Choose TWO letters, A-E.) */}
      {taskInstruction && (
        <div className="pt-2 text-sm text-gray-700 font-semibold italic flex items-center gap-1.5">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 not-italic" />
          <span>{taskInstruction}</span>
        </div>
      )}

      {/* Question Text */}
      {first.questionText && (
        <div className="text-[15px] font-medium text-gray-900 leading-relaxed pt-1">
          <RichText text={first.questionText} />
        </div>
      )}

      {/* Review Mode Comparison Box */}
      {reviewMode && (
        <div className="p-3.5 rounded-lg border bg-gray-50/80 border-gray-200 text-xs space-y-2.5 my-2">
          {questions.map((q) => {
            const studentAns = String(answers[q.qId] ?? "").trim().toUpperCase();
            const isCorrect =
              q.qId in isCorrectMap
                ? isCorrectMap[q.qId]
                : !!studentAns && correctLetters.has(studentAns);
            const targetAns =
              correctAnswers?.[q.qId] || Array.from(correctLetters).join(", ");

            return (
              <div
                key={q.qId}
                className="flex items-center justify-between gap-3 pb-2 border-b border-gray-200/60 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-900 bg-gray-200/70 px-2 py-0.5 rounded text-[11px]">
                    Câu {q.questionNumber}
                  </span>
                  <span>
                    Bạn chọn:{" "}
                    <strong
                      className={
                        studentAns
                          ? isCorrect
                            ? "text-emerald-700"
                            : "text-red-700"
                          : "text-gray-400"
                      }
                    >
                      {studentAns || "(Chưa làm)"}
                    </strong>
                  </span>
                  <span className="text-gray-300">·</span>
                  <span>
                    Đáp án đúng:{" "}
                    <strong className="text-emerald-700">{targetAns}</strong>
                  </span>
                </div>
                <div>
                  {studentAns ? (
                    isCorrect ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-emerald-600 text-white">
                        ✓ Đúng (1 điểm)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-red-600 text-white">
                        ✕ Sai (0 điểm)
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-amber-500 text-white">
                      Chưa làm (0 điểm)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Options List */}
      <div className="space-y-2 pt-1">
        {optionKeys.map((letter) => {
          const selected = selectedLetters.has(letter);
          const isTarget = correctLetters.has(letter);
          const isStudentRight = reviewMode && selected && isTarget;
          const isStudentWrong = reviewMode && selected && !isTarget;
          const isMissed = reviewMode && !selected && isTarget;
          const isDisabled =
            reviewMode || (!selected && isFull);

          let containerStyle =
            "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/70";
          if (reviewMode) {
            if (isStudentRight) {
              containerStyle =
                "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-300";
            } else if (isStudentWrong) {
              containerStyle = "bg-red-50 border-red-500 ring-2 ring-red-300";
            } else if (isMissed) {
              containerStyle =
                "bg-emerald-50/60 border-emerald-400 ring-1 ring-emerald-300";
            } else {
              containerStyle = "bg-gray-50/40 border-gray-200 opacity-60";
            }
          } else if (selected) {
            containerStyle =
              "bg-blue-50/80 border-blue-500 ring-2 ring-blue-200 shadow-xs";
          } else if (isFull) {
            containerStyle =
              "bg-gray-50/60 border-gray-200 opacity-55 cursor-not-allowed";
          }

          return (
            <label
              key={letter}
              onClick={() => {
                if (!isDisabled || selected) {
                  handleToggle(letter);
                }
              }}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                reviewMode
                  ? "cursor-default"
                  : isDisabled && !selected
                  ? "cursor-not-allowed"
                  : "cursor-pointer"
              } ${containerStyle}`}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => handleToggle(letter)}
                disabled={reviewMode || (!selected && isFull)}
                className="mt-1 w-4 h-4 rounded text-blue-600 accent-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`font-bold text-sm tracking-wide ${
                      isStudentRight || isMissed
                        ? "text-emerald-700"
                        : isStudentWrong
                        ? "text-red-700"
                        : selected
                        ? "text-blue-700 font-extrabold"
                        : "text-gray-900"
                    }`}
                  >
                    {letter}
                  </span>
                  {reviewMode && isStudentRight && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white flex items-center gap-0.5">
                      ✓ Bạn chọn · Đúng
                    </span>
                  )}
                  {reviewMode && isStudentWrong && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white flex items-center gap-0.5">
                      ✕ Bạn chọn · Sai
                    </span>
                  )}
                  {reviewMode && isMissed && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-0.5">
                      ✓ Đáp án đúng
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-800 leading-relaxed flex-1">
                  <RichText text={options[letter]} />
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {/* Explanations in Review Mode */}
      {reviewMode && uniqueExplanations.length > 0 && (
        <div className="mt-3 p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-2">
          <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
            <span>💡</span> Giải thích chi tiết (Explanation)
          </p>
          {uniqueExplanations.map((exp, i) => (
            <div
              key={i}
              className="text-xs text-slate-700 leading-relaxed whitespace-pre-line border-t border-emerald-100/80 pt-2 first:border-t-0 first:pt-0"
            >
              <RichText text={exp} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

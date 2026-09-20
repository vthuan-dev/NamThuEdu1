/**
 * IELTS — Question renderer (smart router by question type).
 *
 * Routes to the appropriate input UI based on `questionType`:
 *  • multiple_choice            → A/B/C/D radio
 *  • true_false_not_given       → 3-button picker
 *  • yes_no_not_given           → 3-button picker
 *  • sentence_completion        → text input (with word limit hint)
 *  • note_completion            → text input
 *  • form_completion            → text input
 *  • table_completion           → text input
 *  • flow_chart_completion      → text input
 *  • summary_completion         → text input or word-bank picker
 *  • short_answer               → text input
 *  • matching                   → dropdown picker
 *  • matching_headings          → dropdown picker (i, ii, iii…)
 *  • matching_information       → dropdown picker (A, B, C…)
 *  • matching_features          → dropdown picker
 *  • matching_sentence_endings  → dropdown picker
 *  • diagram_labelling          → text input
 *  • plan_map_diagram           → dropdown picker
 *
 * All inputs persist to the parent `answers` map keyed by `qId`.
 */
import { Flag } from "lucide-react";
import type { IeltsQuestion, AnswerValue } from "../types";
import { RichText } from "../../../../../../components/ui/RichText";

interface IeltsQuestionRendererProps {
  question: IeltsQuestion;
  answer: AnswerValue;
  onAnswer: (qId: number, value: AnswerValue) => void;
  flagged: boolean;
  onToggleFlag: (qId: number) => void;
  /** When true, inputs are disabled and show correct answer (for review mode) */
  reviewMode?: boolean;
  correctAnswer?: string;
  isCorrect?: boolean;
}

export function IeltsQuestionRenderer({
  question,
  answer,
  onAnswer,
  flagged,
  onToggleFlag,
  reviewMode = false,
  correctAnswer,
  isCorrect,
}: IeltsQuestionRendererProps) {
  const qNum = question.questionNumber;
  const type = question.questionType;
  const data = question.data ?? {};

  const isAnswered = answer != null && String(answer).trim() !== "";
  const computedIsCorrect = typeof isCorrect === "boolean"
    ? isCorrect
    : (isAnswered && correctAnswer != null && String(answer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase());
  const isWrong = isAnswered && !computedIsCorrect;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      {/* Header: number + flag */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold tabular-nums text-white ${
          reviewMode
            ? computedIsCorrect
              ? "bg-emerald-600"
              : isWrong
                ? "bg-red-600"
                : "bg-slate-400"
            : "bg-gray-900"
        }`}>
          {qNum}
        </div>
        <div className="flex-1 text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
          {question.questionText ? <RichText text={question.questionText} /> : <em className="text-gray-400">No prompt</em>}
        </div>
        <button
          type="button"
          onClick={() => onToggleFlag(question.qId)}
          className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
            flagged
              ? "bg-amber-100 text-amber-600"
              : "bg-gray-50 text-gray-400 hover:bg-amber-50 hover:text-amber-500"
          }`}
          title={flagged ? "Unflag" : "Flag for review"}
          disabled={reviewMode}
        >
          <Flag className={`w-3.5 h-3.5 ${flagged ? "fill-current" : ""}`} />
        </button>
      </div>

      {/* Review Mode Comparison Box */}
      {reviewMode && (
        <div className="pl-10 mb-3">
          <div
            className={`p-3 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-3 shadow-xs ${
              computedIsCorrect
                ? "bg-emerald-50/90 border-emerald-300 text-emerald-950"
                : isWrong
                  ? "bg-red-50/90 border-red-300 text-red-950"
                  : "bg-amber-50/90 border-amber-300 text-amber-950"
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {/* Học viên đã chọn */}
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-600">Đáp án của bạn:</span>
                {isAnswered ? (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold text-xs shadow-xs ${
                      computedIsCorrect
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-red-100 text-red-800 border border-red-300"
                    }`}
                  >
                    <span className="font-mono">{String(answer)}</span>
                    {computedIsCorrect ? (
                      <span className="inline-flex items-center gap-0.5 text-emerald-700">✓ (Đúng)</span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-red-700">✕ (Chưa đúng)</span>
                    )}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium text-xs bg-amber-100 text-amber-900 border border-amber-300">
                    ⚠️ Chưa trả lời
                  </span>
                )}
              </div>

              {/* Đáp án đúng (luôn show để so sánh) */}
              {correctAnswer && (
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-600">Đáp án đúng:</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-bold text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
                    <span className="font-mono">{correctAnswer}</span>
                    <span className="text-emerald-700 font-black">✓</span>
                  </span>
                </div>
              )}
            </div>

            {/* Badge trạng thái */}
            <div className="flex-shrink-0">
              {computedIsCorrect ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold text-xs bg-emerald-600 text-white shadow-sm">
                  ✓ Chính xác (+1 điểm)
                </span>
              ) : isWrong ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold text-xs bg-red-600 text-white shadow-sm">
                  ✕ Sai (0 điểm)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold text-xs bg-amber-500 text-white shadow-sm">
                  Chưa làm (0 điểm)
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Word limit hint */}
      {(data.word_limit || data.maxWords) && (
        <div className="mb-2 text-[11px] text-gray-500 italic pl-10">
          {typeof data.word_limit === "string" && data.word_limit
            ? `Write ${data.word_limit} from the passage.`
            : `Write NO MORE THAN ${data.word_limit ?? data.maxWords} WORD${(data.word_limit ?? data.maxWords) > 1 ? "S" : ""} from the passage.`}
        </div>
      )}

      {/* Input */}
      <div className="pl-10">
        {renderInput(type, question, answer, onAnswer, reviewMode, correctAnswer, isCorrect)}
      </div>

      {reviewMode && (question.explanation || (question as any).qExplanation) && (
        <div className="mt-3 p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 ml-10">
          <p className="text-xs font-bold text-emerald-800 mb-1.5 flex items-center gap-1.5">
            <span>💡</span> Giải thích chi tiết (Explanation)
          </p>
          <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
            <RichText text={question.explanation || (question as any).qExplanation} />
          </div>
        </div>
      )}
    </div>
  );
}

function renderInput(
  type: string,
  q: IeltsQuestion,
  answer: AnswerValue,
  onAnswer: (qId: number, value: AnswerValue) => void,
  reviewMode: boolean,
  correctAnswer?: string,
  isCorrect?: boolean,
): React.ReactNode {
  const onChange = (v: AnswerValue) => onAnswer(q.qId, v);
  const data = q.data ?? {};

  // ─── Multiple choice (A/B/C/D) — single or multi-select ───────────────
  if (type === "multiple_choice" && q.options) {
    const letters = Object.keys(q.options);
    const selectCount = Number(data.select_count ?? data.selectCount ?? 1);
    const multi = selectCount > 1;
    // Multi-select: đáp án lưu "A,C". Tách thành Set để thao tác.
    const selectedSet = new Set(
      String(answer ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    const correctSet = new Set(
      String(correctAnswer ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    const toggleMulti = (letter: string) => {
      const next = new Set(selectedSet);
      if (next.has(letter)) next.delete(letter);
      else {
        if (next.size >= selectCount) return;
        next.add(letter);
      }
      onChange(Array.from(next).sort().join(","));
    };
    return (
      <div className="space-y-1.5">
        {multi && (
          <p className="text-[11px] font-semibold text-blue-700 mb-1">
            Choose {selectCount} answers ({selectedSet.size}/{selectCount} selected)
          </p>
        )}
        {letters.map((letter) => {
          const selected = multi ? selectedSet.has(letter) : String(answer ?? "").trim().toUpperCase() === letter.toUpperCase();
          const isTarget = multi ? correctSet.has(letter) : letter.toUpperCase() === (correctAnswer ?? "").trim().toUpperCase();
          const isStudentRight = reviewMode && selected && isTarget;
          const isStudentWrong = reviewMode && selected && !isTarget;

          let labelStyle = "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50";
          if (reviewMode) {
            if (isStudentRight) {
              labelStyle = "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-300";
            } else if (isStudentWrong) {
              labelStyle = "bg-red-50 border-red-500 ring-2 ring-red-300";
            } else if (isTarget) {
              labelStyle = "bg-emerald-50/50 border-emerald-400 ring-1 ring-emerald-300";
            } else {
              labelStyle = "bg-gray-50/50 border-gray-200 opacity-60";
            }
          } else if (selected) {
            labelStyle = "bg-blue-50 border-blue-400 ring-1 ring-blue-200";
          }

          return (
            <label
              key={letter}
              className={`flex items-start gap-2.5 p-2.5 rounded-md border transition-all ${
                reviewMode ? "cursor-default" : "cursor-pointer"
              } ${labelStyle}`}
            >
              <input
                type={multi ? "checkbox" : "radio"}
                name={`q_${q.qId}`}
                value={letter}
                checked={selected}
                onChange={() => (multi ? toggleMulti(letter) : onChange(letter))}
                disabled={reviewMode}
                className="mt-0.5 accent-blue-600"
              />
              <div className="flex items-start gap-2 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`font-bold text-sm ${isStudentRight || isTarget ? "text-emerald-700" : isStudentWrong ? "text-red-700" : "text-gray-900"}`}>
                    {letter}
                  </span>
                  {reviewMode && isStudentRight && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white flex items-center gap-0.5">
                      ✓ Bạn chọn · Đúng
                    </span>
                  )}
                  {reviewMode && isStudentWrong && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white flex items-center gap-0.5">
                      ✕ Bạn chọn · Sai
                    </span>
                  )}
                  {reviewMode && !selected && isTarget && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-0.5">
                      ✓ Đáp án đúng
                    </span>
                  )}
                </div>
                <RichText className="text-sm text-gray-700 leading-relaxed" text={q.options![letter]} />
              </div>
            </label>
          );
        })}
      </div>
    );
  }

  // ─── True/False/Not Given & Yes/No/Not Given ──────────────────────────
  if (type === "true_false_not_given" || type === "yes_no_not_given") {
    const options = type === "true_false_not_given"
      ? ["TRUE", "FALSE", "NOT GIVEN"]
      : ["YES", "NO", "NOT GIVEN"];
    return (
      <div className="flex flex-wrap gap-2.5">
        {options.map((opt) => {
          const selected = String(answer ?? "").trim().toUpperCase() === opt.toUpperCase();
          const isTarget = (correctAnswer ?? "").trim().toUpperCase() === opt.toUpperCase();
          const isStudentRight = reviewMode && selected && isTarget;
          const isStudentWrong = reviewMode && selected && !isTarget;

          let btnStyle = "bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-blue-50";
          if (reviewMode) {
            if (isStudentRight) {
              btnStyle = "bg-emerald-100 border-emerald-500 text-emerald-900 ring-2 ring-emerald-400 font-bold shadow-xs";
            } else if (isStudentWrong) {
              btnStyle = "bg-red-100 border-red-500 text-red-900 ring-2 ring-red-400 font-bold line-through";
            } else if (isTarget) {
              btnStyle = "bg-emerald-50 border-emerald-400 text-emerald-800 ring-1 ring-emerald-300 font-semibold";
            } else {
              btnStyle = "bg-gray-50 border-gray-200 text-gray-400 opacity-60";
            }
          } else if (selected) {
            btnStyle = "bg-blue-600 border-blue-700 text-white shadow-sm";
          }

          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              disabled={reviewMode}
              className={`px-3.5 py-1.5 rounded-md border text-xs tracking-wider transition-all flex items-center gap-1.5 ${
                reviewMode ? "cursor-default" : "cursor-pointer font-bold"
              } ${btnStyle}`}
            >
              <span>{opt}</span>
              {reviewMode && isStudentRight && (
                <>
                  <span className="text-emerald-700 font-black">✓</span>
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-600 text-white font-bold no-underline">
                    Bạn chọn
                  </span>
                </>
              )}
              {reviewMode && isStudentWrong && (
                <>
                  <span className="text-red-600 font-black">✕</span>
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-red-600 text-white font-bold no-underline">
                    Bạn chọn
                  </span>
                </>
              )}
              {reviewMode && !selected && isTarget && (
                <>
                  <span className="text-emerald-700 font-black">✓</span>
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">
                    Đáp án đúng
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // ─── Matching (with provided choices) ─────────────────────────────────
  if (
    type === "matching" ||
    type === "matching_headings" ||
    type === "matching_information" ||
    type === "matching_features" ||
    type === "matching_sentence_endings" ||
    type === "plan_map_diagram"
  ) {
    const choices =
      (q.options as Record<string, string>) ||
      (data.choices as Record<string, string>) ||
      (data.options as Record<string, string>) ||
      {};
    const choiceKeys = Object.keys(choices);
    if (choiceKeys.length > 0) {
      const hasLabels = choiceKeys.some((k) => (choices[k] ?? "").trim() !== "");
      const isSelectAnswered = answer != null && String(answer).trim() !== "";
      const isSelectCorrect = reviewMode && (
        typeof isCorrect === "boolean"
          ? isCorrect
          : isSelectAnswered && correctAnswer != null && String(answer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase()
      );

      return (
        <div className="space-y-2">
          {hasLabels && (
            <ul className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 space-y-1">
              {choiceKeys.map((k) => (
                <li key={k} className="flex gap-2 text-xs text-gray-700">
                  <span className="font-bold text-gray-900">{k}</span>
                  <RichText text={choices[k]} />
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={(answer as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              disabled={reviewMode}
              className={`w-full max-w-xs px-3 py-2 rounded-md border text-sm transition-colors ${
                reviewMode ? "cursor-default" : "cursor-pointer"
              } ${
                reviewMode && isSelectCorrect
                  ? "bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold"
                  : reviewMode && isSelectAnswered && !isSelectCorrect
                    ? "bg-red-50 border-red-400 text-red-900"
                    : reviewMode
                      ? "bg-slate-50 border-slate-300 text-slate-500"
                      : "bg-white border-gray-300 text-gray-900 hover:border-blue-400 focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              }`}
            >
              <option value="">— Choose —</option>
              {choiceKeys.map((k) => (
                <option key={k} value={k}>
                  {choices[k] ? `${k} — ${choices[k]}` : k}
                </option>
              ))}
            </select>
            {reviewMode && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {isSelectCorrect ? (
                  <span className="text-emerald-800 font-bold flex items-center gap-1 bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300">
                    ✓ Bạn chọn: <span className="font-mono">{String(answer)}</span> (Đúng)
                  </span>
                ) : isSelectAnswered ? (
                  <>
                    <span className="text-red-800 font-bold flex items-center gap-1 bg-red-100 px-2.5 py-1 rounded border border-red-300">
                      ✕ Bạn chọn: <span className="font-mono">{String(answer)}</span> (Sai)
                    </span>
                    {correctAnswer && (
                      <span className="text-emerald-800 font-bold flex items-center gap-1 bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300">
                        ✓ Đáp án đúng: <span className="font-mono">{correctAnswer}</span>
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-amber-800 font-medium flex items-center gap-1 bg-amber-100 px-2.5 py-1 rounded border border-amber-300">
                      ⚠️ Chưa chọn
                    </span>
                    {correctAnswer && (
                      <span className="text-emerald-800 font-bold flex items-center gap-1 bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300">
                        ✓ Đáp án đúng: <span className="font-mono">{correctAnswer}</span>
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    // Fallback to text input
  }

  // ─── Word-bank completion (chọn từ danh sách cho sẵn) ─────────────────
  if (data.use_word_bank) {
    const bank =
      (q.options as Record<string, string>) ||
      (data.options as Record<string, string>) ||
      {};
    const bankKeys = Object.keys(bank);
    if (bankKeys.length > 0) {
      const isBankAnswered = answer != null && String(answer).trim() !== "";
      const isBankCorrect = reviewMode && (
        typeof isCorrect === "boolean"
          ? isCorrect
          : isBankAnswered && correctAnswer != null && String(answer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase()
      );

      return (
        <div className="space-y-2">
          <ul className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1">
            {bankKeys.map((k) => (
              <li key={k} className="flex gap-2 text-xs text-gray-700">
                <span className="font-bold text-gray-900">{k}</span>
                <RichText text={bank[k]} />
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={(answer as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              disabled={reviewMode}
              className={`w-full max-w-xs px-3 py-2 rounded-md border text-sm transition-colors ${
                reviewMode ? "cursor-default" : "cursor-pointer"
              } ${
                reviewMode && isBankCorrect
                  ? "bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold"
                  : reviewMode && isBankAnswered && !isBankCorrect
                    ? "bg-red-50 border-red-400 text-red-900"
                    : reviewMode
                      ? "bg-slate-50 border-slate-300 text-slate-500"
                      : "bg-white border-gray-300 text-gray-900 hover:border-blue-400 focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              }`}
            >
              <option value="">— Choose —</option>
              {bankKeys.map((k) => (
                <option key={k} value={k}>
                  {bank[k] ? `${k} — ${bank[k]}` : k}
                </option>
              ))}
            </select>
            {reviewMode && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {isBankCorrect ? (
                  <span className="text-emerald-800 font-bold flex items-center gap-1 bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300">
                    ✓ Bạn chọn: <span className="font-mono">{String(answer)}</span> (Đúng)
                  </span>
                ) : isBankAnswered ? (
                  <>
                    <span className="text-red-800 font-bold flex items-center gap-1 bg-red-100 px-2.5 py-1 rounded border border-red-300">
                      ✕ Bạn chọn: <span className="font-mono">{String(answer)}</span> (Sai)
                    </span>
                    {correctAnswer && (
                      <span className="text-emerald-800 font-bold flex items-center gap-1 bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300">
                        ✓ Đáp án đúng: <span className="font-mono">{correctAnswer}</span>
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-amber-800 font-medium flex items-center gap-1 bg-amber-100 px-2.5 py-1 rounded border border-amber-300">
                      ⚠️ Chưa chọn
                    </span>
                    {correctAnswer && (
                      <span className="text-emerald-800 font-bold flex items-center gap-1 bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300">
                        ✓ Đáp án đúng: <span className="font-mono">{correctAnswer}</span>
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
  }

  // ─── Text input (fill-blank style) ────────────────────────────────────
  // sentence_completion, note_completion, form_completion, table_completion,
  // flow_chart_completion, summary_completion, short_answer, diagram_labelling
  const isInputAnswered = answer != null && String(answer).trim() !== "";
  const isInputCorrect = reviewMode && (
    typeof isCorrect === "boolean"
      ? isCorrect
      : isInputAnswered && correctAnswer != null && String(answer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase()
  );

  return (
    <div className="space-y-2 max-w-md">
      <input
        type="text"
        value={(answer as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={reviewMode}
        placeholder={reviewMode ? "(Không có câu trả lời)" : "Your answer…"}
        className={`w-full px-3 py-2 rounded-md border text-sm transition-colors ${
          reviewMode && isInputCorrect
            ? "bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold"
            : reviewMode && isInputAnswered
              ? "bg-red-50 border-red-400 text-red-900 line-through"
              : reviewMode
                ? "bg-slate-50 border-slate-300 text-slate-500 italic"
                : "bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
        }`}
        autoComplete="off"
        spellCheck={false}
      />
      {reviewMode && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {isInputCorrect ? (
            <span className="text-emerald-800 font-bold flex items-center gap-1 bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300">
              ✓ Bạn trả lời chính xác: <span className="font-mono">{String(answer)}</span>
            </span>
          ) : isInputAnswered ? (
            <>
              <span className="text-red-800 font-bold flex items-center gap-1 bg-red-100 px-2.5 py-1 rounded border border-red-300">
                ✕ Bạn trả lời: <span className="font-mono">{String(answer)}</span> (Sai)
              </span>
              {correctAnswer && (
                <span className="text-emerald-800 font-bold flex items-center gap-1 bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300">
                  ✓ Đáp án đúng: <span className="font-mono">{correctAnswer}</span>
                </span>
              )}
            </>
          ) : (
            <>
              <span className="text-amber-800 font-medium flex items-center gap-1 bg-amber-100 px-2.5 py-1 rounded border border-amber-300">
                ⚠️ Chưa trả lời
              </span>
              {correctAnswer && (
                <span className="text-emerald-800 font-bold flex items-center gap-1 bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300">
                  ✓ Đáp án đúng: <span className="font-mono">{correctAnswer}</span>
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

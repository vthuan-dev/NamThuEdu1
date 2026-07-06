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
}

export function IeltsQuestionRenderer({
  question,
  answer,
  onAnswer,
  flagged,
  onToggleFlag,
  reviewMode = false,
  correctAnswer,
}: IeltsQuestionRendererProps) {
  const qNum = question.questionNumber;
  const type = question.questionType;
  const data = question.data ?? {};

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      {/* Header: number + flag */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-7 h-7 rounded-md bg-gray-900 text-white flex items-center justify-center text-xs font-bold tabular-nums">
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

      {/* Word limit hint */}
      {(data.word_limit || data.maxWords) && (
        <div className="mb-2 text-[11px] text-gray-500 italic">
          {typeof data.word_limit === "string" && data.word_limit
            ? `Write ${data.word_limit} from the passage.`
            : `Write NO MORE THAN ${data.word_limit ?? data.maxWords} WORD${(data.word_limit ?? data.maxWords) > 1 ? "S" : ""} from the passage.`}
        </div>
      )}

      {/* Input */}
      <div className="pl-10">
        {renderInput(type, question, answer, onAnswer, reviewMode, correctAnswer)}
      </div>
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
          const selected = multi ? selectedSet.has(letter) : answer === letter;
          const isCorrect =
            reviewMode && (multi ? correctSet.has(letter) : letter === correctAnswer);
          const isWrong = reviewMode && selected && !isCorrect;
          return (
            <label
              key={letter}
              className={`flex items-start gap-2.5 p-2.5 rounded-md border transition-all cursor-pointer ${
                isCorrect
                  ? "bg-emerald-50 border-emerald-300"
                  : isWrong
                    ? "bg-red-50 border-red-300"
                    : selected
                      ? "bg-blue-50 border-blue-400 ring-1 ring-blue-200"
                      : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
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
                <span className="font-bold text-gray-900 text-sm">{letter}</span>
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
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = answer === opt;
          const isCorrect = reviewMode && opt === correctAnswer;
          const isWrong = reviewMode && selected && !isCorrect;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              disabled={reviewMode}
              className={`px-3.5 py-1.5 rounded-md border text-xs font-bold tracking-wider transition-all cursor-pointer ${
                isCorrect
                  ? "bg-emerald-100 border-emerald-400 text-emerald-700"
                  : isWrong
                    ? "bg-red-100 border-red-400 text-red-700"
                    : selected
                      ? "bg-blue-600 border-blue-700 text-white shadow-sm"
                      : "bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-blue-50"
              }`}
            >
              {opt}
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
      // Có nhãn mô tả (vd "A — The neocortex") → hiện legend cho học viên dễ hiểu.
      const hasLabels = choiceKeys.some((k) => (choices[k] ?? "").trim() !== "");
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
          <select
            value={(answer as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={reviewMode}
            className={`w-full max-w-xs px-3 py-2 rounded-md border text-sm cursor-pointer transition-colors ${
              reviewMode && answer === correctAnswer
                ? "bg-emerald-50 border-emerald-400 text-emerald-900"
                : reviewMode && answer && answer !== correctAnswer
                  ? "bg-red-50 border-red-400 text-red-900"
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
          <select
            value={(answer as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={reviewMode}
            className={`w-full max-w-xs px-3 py-2 rounded-md border text-sm cursor-pointer transition-colors ${
              reviewMode && answer === correctAnswer
                ? "bg-emerald-50 border-emerald-400 text-emerald-900"
                : reviewMode && answer && answer !== correctAnswer
                  ? "bg-red-50 border-red-400 text-red-900"
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
        </div>
      );
    }
  }

  // ─── Text input (fill-blank style) ────────────────────────────────────
  // sentence_completion, note_completion, form_completion, table_completion,
  // flow_chart_completion, summary_completion, short_answer, diagram_labelling
  return (
    <input
      type="text"
      value={(answer as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={reviewMode}
      placeholder="Your answer…"
      className={`w-full max-w-md px-3 py-2 rounded-md border text-sm transition-colors ${
        reviewMode && (answer as string)?.toLowerCase() === (correctAnswer ?? "").toLowerCase()
          ? "bg-emerald-50 border-emerald-400 text-emerald-900"
          : reviewMode && answer
            ? "bg-red-50 border-red-400 text-red-900"
            : "bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
      }`}
      autoComplete="off"
      spellCheck={false}
    />
  );
}

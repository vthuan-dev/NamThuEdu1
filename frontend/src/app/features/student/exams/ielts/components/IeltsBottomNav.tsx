/**
 * IELTS exam — Bottom navigation bar (theme NamThuEdu).
 *
 * Nền trắng, accent orange. Hiển thị:
 *  • Question grid (1-40): đã trả lời (orange) / flagged / current
 *  • Prev / Next
 *  • Submit (gradient orange)
 */
import { ChevronLeft, ChevronRight, Send } from "lucide-react";

export interface QuestionMeta {
  number: number;
  qId: number;
  groupIndex: number;
  groupLabel?: string;
}

interface IeltsBottomNavProps {
  questions: QuestionMeta[];
  answers: Record<number, any>;
  flagged: Record<number, boolean>;
  currentNumber?: number;
  onJump: (q: QuestionMeta) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
  reviewMode?: boolean;
  hideSubmit?: boolean;
  submitLabel?: string;
  /** Cho phép nộp? false = disable button. Mặc định true (back-compat). */
  canSubmit?: boolean;
  /** Tooltip giải thích lý do disable (vd "còn 5 câu") */
  submitTooltip?: string;
}

// ─── Theme ──────────────────────────────────────────────────────────────
const BRAND_PRIMARY = "#FF8C42";
const BRAND_SECONDARY = "#FF6B35";

export function IeltsBottomNav({
  questions,
  answers,
  flagged,
  currentNumber,
  onJump,
  onPrev,
  onNext,
  onSubmit,
  canPrev = true,
  canNext = true,
  hideSubmit = false,
  submitLabel,
  canSubmit = true,
  submitTooltip,
}: IeltsBottomNavProps) {
  const answeredCount = questions.filter((q) => {
    const v = answers[q.qId];
    return v != null && v !== "";
  }).length;

  // Group questions by section (groupIndex) — giống cách VSTEP gom theo Part
  const groups = (() => {
    const map = new Map<number, { index: number; label: string; items: QuestionMeta[] }>();
    questions.forEach((q) => {
      const key = q.groupIndex ?? 0;
      if (!map.has(key)) {
        map.set(key, {
          index: key,
          label: q.groupLabel ?? `Recording ${key + 1}`,
          items: [],
        });
      }
      map.get(key)!.items.push(q);
    });
    return Array.from(map.values()).sort((a, b) => a.index - b.index);
  })();

  return (
    <footer className="sticky bottom-0 z-40 bg-white border-t border-[#e0e0e0] shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
      <div className="max-w-[1170px] mx-auto px-3 sm:px-4 py-2.5 flex flex-col md:flex-row items-center gap-3">
        {/* Question grid — grouped by section (style giống VSTEP) */}
        <div className="flex items-stretch gap-2 w-full md:flex-1 overflow-x-auto py-1 px-0.5 scrollbar-none">
          {groups.map((group) => {
            const groupAnswered = group.items.filter((q) => {
              const v = answers[q.qId];
              return v != null && v !== "";
            }).length;
            // Nhãn gọn: "Section 1" -> "S1", "Recording 2" -> "R2"
            const shortLabel = group.label
              .replace(/Section\s*/i, "S")
              .replace(/Recording\s*/i, "R")
              .replace(/Passage\s*/i, "P");

            return (
              <div key={group.index} className="flex-shrink-0 flex items-center gap-1.5">
                {/* Section label + count (gọn, 1 dòng) */}
                <span className="flex items-baseline gap-0.5 leading-none whitespace-nowrap">
                  <span className="text-[11px] font-bold text-[#FF6B35]">{shortLabel}</span>
                  <span className="text-[9px] text-[#9aa5b1] tabular-nums">
                    {groupAnswered}/{group.items.length}
                  </span>
                </span>

                {/* Buttons */}
                <div className="flex items-center gap-0.5">
                  {group.items.map((q) => {
                    const v = answers[q.qId];
                    const answered = v != null && v !== "";
                    const flag = !!flagged[q.qId];
                    const isCurrent = currentNumber === q.number;

                    const base =
                      "relative flex-shrink-0 w-6 h-6 rounded text-[10px] font-semibold tabular-nums transition-all cursor-pointer flex items-center justify-center";

                    let tone: string;
                    if (flag) {
                      tone = "bg-amber-500 text-white hover:bg-amber-600";
                    } else if (answered) {
                      tone = "bg-[#FF6B35] text-white hover:bg-[#FF8C42]";
                    } else {
                      tone = "bg-[#f1f3f5] text-[#677788] hover:bg-[#e4e7eb]";
                    }
                    const ring = isCurrent ? " ring-2 ring-[#FF8C42]" : "";

                    return (
                      <button
                        key={q.qId}
                        type="button"
                        onClick={() => onJump(q)}
                        className={`${base} ${tone}${ring}`}
                        title={`Câu ${q.number}${flag ? " — đã gắn cờ" : answered ? " — đã trả lời" : ""}`}
                      >
                        {q.number}
                        {flag && answered && (
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 border border-white" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Divider between groups */}
                <span className="w-px h-5 bg-[#e0e0e0]" />
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto flex-shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
          <div className="flex items-center gap-2">
            {/* Prev */}
            <button
              type="button"
              onClick={onPrev}
              disabled={!canPrev}
              className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-semibold text-[#677788] bg-[#f8f9fa] hover:bg-[#efefef] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Trước</span>
            </button>

            {/* Next */}
            <button
              type="button"
              onClick={onNext}
              disabled={!canNext}
              className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-semibold text-[#677788] bg-[#f8f9fa] hover:bg-[#efefef] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <span>Tiếp</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Answered counter */}
            <div className="flex-shrink-0 flex items-center text-xs text-[#677788] font-medium tabular-nums">
              {answeredCount}/{questions.length} câu
            </div>

            {/* Submit */}
            {!hideSubmit && (
              <button
                type="button"
                onClick={onSubmit}
                disabled={!canSubmit}
                title={submitTooltip ?? (canSubmit ? "Nộp bài" : "Cần khoanh hết câu hỏi mới được nộp")}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold transition-all shadow-sm ${
                  canSubmit
                    ? "text-white cursor-pointer hover:shadow-md"
                    : "text-slate-400 bg-slate-100 cursor-not-allowed"
                }`}
                style={canSubmit ? {
                  background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_SECONDARY})`,
                } : undefined}
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitLabel ?? "Nộp bài"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}

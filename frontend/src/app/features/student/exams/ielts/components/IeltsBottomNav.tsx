/**
 * IELTS exam — Bottom navigation bar (theme NamThuEdu).
 *
 * Nền trắng, accent orange. Hiển thị:
 *  • Question grid (1-40): đã trả lời (orange) / flagged / current
 *  • Prev / Next
 *  • Submit (gradient orange)
 *
 * Trên mobile lưới câu chuyển sang bottom sheet: 40 ô số trong một dải
 * cuộn ngang ở đáy màn hình vừa nhỏ (24px, dưới ngưỡng touch 44px) vừa phải
 * cuộn tìm — không dùng được bằng ngón tay.
 */
import { useState } from "react";
import { ChevronLeft, ChevronRight, Send, LayoutGrid, X } from "lucide-react";

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

  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <footer
      className="sticky bottom-0 z-40 bg-white border-t border-[#e0e0e0] shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
      // Tránh home indicator của iPhone đè lên nút Nộp bài.
      style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-[1170px] mx-auto px-3 sm:px-4 py-2.5 flex flex-col md:flex-row items-center gap-3">
        {/* Question grid — ẩn dưới md, thay bằng nút mở bottom sheet. */}
        <div className="hidden md:flex items-stretch gap-2 w-full md:flex-1 overflow-x-auto py-1 px-0.5 scrollbar-none">
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
        <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-3 w-full md:w-auto flex-shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
          <div className="flex items-center gap-2">
            {/* Prev — min-h-11 = 44px, ngưỡng touch target tối thiểu. */}
            <button
              type="button"
              onClick={onPrev}
              disabled={!canPrev}
              aria-label="Câu trước"
              className="flex-shrink-0 inline-flex items-center justify-center gap-1 min-h-11 px-3 rounded-md text-sm font-semibold text-[#677788] bg-[#f8f9fa] hover:bg-[#efefef] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Trước</span>
            </button>

            {/* Next */}
            <button
              type="button"
              onClick={onNext}
              disabled={!canNext}
              aria-label="Câu tiếp"
              className="flex-shrink-0 inline-flex items-center justify-center gap-1 min-h-11 px-3 rounded-md text-sm font-semibold text-[#677788] bg-[#f8f9fa] hover:bg-[#efefef] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <span className="hidden sm:inline">Tiếp</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Mở lưới câu (chỉ mobile) — đường duy nhất tới danh sách câu khi
                lưới ở trên bị ẩn. */}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="md:hidden flex-shrink-0 inline-flex items-center justify-center gap-1.5 min-h-11 px-3 rounded-md text-xs font-bold text-[#FF6B35] bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors cursor-pointer"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="tabular-nums">{answeredCount}/{questions.length}</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Answered counter — ẩn trên mobile vì nút lưới câu đã hiện số này. */}
            <div className="hidden md:flex flex-shrink-0 items-center text-xs text-[#677788] font-medium tabular-nums">
              {answeredCount}/{questions.length} câu
            </div>

            {/* Submit */}
            {!hideSubmit && (
              <button
                type="button"
                onClick={onSubmit}
                disabled={!canSubmit}
                title={submitTooltip ?? (canSubmit ? "Nộp bài" : "Cần khoanh hết câu hỏi mới được nộp")}
                className={`flex-shrink-0 inline-flex items-center justify-center gap-1.5 min-h-11 px-3 sm:px-4 rounded-md text-sm font-bold transition-all shadow-sm ${
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

      {/* Bottom sheet lưới câu (mobile). Ô số 44px thay vì 24px như dải cuộn
          ngang trên desktop — bấm bằng ngón tay được. */}
      {sheetOpen && (
        <div className="md:hidden fixed inset-0 z-[60] flex items-end">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="relative z-10 w-full max-h-[80vh] overflow-y-auto bg-white rounded-t-3xl p-4 shadow-2xl"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            role="dialog"
            aria-modal="true"
            aria-label="Danh sách câu"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900">
                Danh sách câu <span className="text-sm font-medium text-slate-500 tabular-nums">({answeredCount}/{questions.length})</span>
              </h3>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {groups.map((group) => {
              const groupAnswered = group.items.filter((q) => {
                const v = answers[q.qId];
                return v != null && v !== "";
              }).length;
              return (
                <div key={group.index} className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {group.label}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
                      {groupAnswered}/{group.items.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {group.items.map((q) => {
                      const v = answers[q.qId];
                      const answered = v != null && v !== "";
                      const flag = !!flagged[q.qId];
                      const isCurrent = currentNumber === q.number;

                      let tone: string;
                      if (flag) {
                        tone = "bg-amber-500 text-white";
                      } else if (answered) {
                        tone = "bg-[#FF6B35] text-white";
                      } else {
                        tone = "bg-[#f1f3f5] text-[#677788]";
                      }

                      return (
                        <button
                          key={q.qId}
                          type="button"
                          onClick={() => { onJump(q); setSheetOpen(false); }}
                          className={`min-h-11 rounded-lg text-sm font-bold tabular-nums transition-all cursor-pointer ${tone} ${
                            isCurrent ? "ring-2 ring-offset-1 ring-[#FF8C42]" : ""
                          }`}
                          title={`Câu ${q.number}${flag ? " — đã gắn cờ" : answered ? " — đã trả lời" : ""}`}
                        >
                          {q.number}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </footer>
  );
}

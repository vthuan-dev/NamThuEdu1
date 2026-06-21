/**
 * IELTS — right-side question navigator (theme NamThuEdu, style giống VSTEP).
 *
 * Hiển thị dạng panel dock bên phải, gom câu theo section/passage:
 *  • Đã trả lời → cam đặc
 *  • Đã gắn cờ  → hổ phách
 *  • Câu hiện tại / section hiện tại → ring cam
 *  • Có thể thu gọn (collapse) để không che nội dung
 *  • draggable=true → teacher preview mode: kéo được panel tự do
 */
import { useState, useRef, useCallback } from "react";
import { ListChecks, ChevronRight, Send, Clock, GripHorizontal } from "lucide-react";
import type { QuestionMeta } from "./IeltsBottomNav";

interface IeltsQuestionNavigatorProps {
  questions: QuestionMeta[];
  answers: Record<number, any>;
  flagged: Record<number, boolean>;
  /** index của nhóm (section/passage) đang mở */
  activeGroupIndex?: number;
  currentNumber?: number;
  onJump: (q: QuestionMeta) => void;
  /** Thời gian còn lại (giây) — hiện ở đầu panel */
  timeLeft?: number;
  showTimer?: boolean;
  /** Nút nộp bài */
  onSubmit?: () => void;
  /** Cho phép kéo panel (mặc định: true để giống VSTEP) */
  draggable?: boolean;
  /** Ẩn nút "Nộp bài" — dùng cho preview mode */
  hideSubmit?: boolean;
  /** Cho phép bấm Nộp bài? false = disable visual + onSubmit không gọi */
  canSubmit?: boolean;
  /** Tooltip giải thích lý do disable */
  submitTooltip?: string;
  /**
   * `true` → chỉ render câu hỏi thuộc group đang active (`activeGroupIndex`).
   * Dùng cho IELTS Listening CBT: học viên chỉ thấy câu của part hiện tại,
   * các part sau chỉ unlock khi audio chuyển sang. Default: false (hiện tất cả).
   */
  currentGroupOnly?: boolean;
  /**
   * Callback khi học viên double-click vào nút câu trong navigator → toggle flag.
   * Nếu không truyền → double-click bị bỏ qua.
   */
  onToggleFlag?: (qId: number) => void;
  /** Ẩn legend gắn cờ + tip double-click (dùng cho review mode) */
  reviewMode?: boolean;
  /** Map qId → đáp án đúng — dùng để tô xanh/đỏ button trong review mode */
  correctAnswers?: Record<number, string>;
  /** Map qId → boolean: kết quả chấm của server — ưu tiên hơn so sánh text */
  isCorrectMap?: Record<number, boolean>;
}

function formatClock(sec?: number) {
  if (sec == null || sec < 0) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function IeltsQuestionNavigator({
  questions,
  answers,
  flagged,
  activeGroupIndex,
  currentNumber,
  onJump,
  timeLeft,
  showTimer = true,
  onSubmit,
  draggable = true,
  hideSubmit = false,
  canSubmit = true,
  submitTooltip,
  currentGroupOnly = false,
  onToggleFlag,
  reviewMode = false,
  correctAnswers = {} as Record<number, string>,
  isCorrectMap = {} as Record<number, boolean>,
}: IeltsQuestionNavigatorProps) {
  const [open, setOpen] = useState(true);
  const lowTime = timeLeft != null && timeLeft <= 300; // ≤5 phút

  // Draggable state — chỉ dùng khi draggable=true
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startTop: number; startRight: number } | null>(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!draggable) return;
    e.preventDefault();
    const panelEl = (e.currentTarget as HTMLElement).closest('aside') as HTMLElement | null;
    if (!panelEl) return;
    const rect = panelEl.getBoundingClientRect();
    const currentTop = pos?.top ?? rect.top;
    const currentRight = pos?.right ?? (window.innerWidth - rect.right);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startTop: currentTop,
      startRight: currentRight,
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setPos({
        top: Math.max(8, dragRef.current.startTop + dy),
        right: Math.max(8, dragRef.current.startRight - dx),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [draggable, pos]);

  // Gom câu theo nhóm
  const allGroups = (() => {
    const map = new Map<number, { index: number; label: string; items: QuestionMeta[] }>();
    questions.forEach((q) => {
      const key = q.groupIndex ?? 0;
      if (!map.has(key)) {
        map.set(key, {
          index: key,
          label: q.groupLabel ?? `Section ${key + 1}`,
          items: [],
        });
      }
      map.get(key)!.items.push(q);
    });
    return Array.from(map.values()).sort((a, b) => a.index - b.index);
  })();

  // CBT mode (currentGroupOnly): unlock các part đã đi qua + part hiện tại,
  // chỉ khoá các part CHƯA tới (index > activeGroupIndex). Đúng flow IELTS:
  // học viên có thể quay lại xem/sửa đáp án các part đã nghe xong, nhưng
  // không thể "nhảy trước" sang part chưa phát audio.
  const groups = currentGroupOnly && activeGroupIndex != null
    ? allGroups.filter((g) => g.index <= activeGroupIndex)
    : allGroups;
  const lockedGroups = currentGroupOnly && activeGroupIndex != null
    ? allGroups.filter((g) => g.index > activeGroupIndex)
    : [];

  const totalAnswered = questions.filter((q) => {
    const v = answers[q.qId];
    return v != null && v !== "";
  }).length;

  // Nút mở lại khi đã thu gọn
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Mở danh sách câu hỏi"
        className="hidden lg:flex fixed top-1/2 right-0 -translate-y-1/2 z-30 items-center gap-1.5 px-2.5 py-3 rounded-l-xl bg-white border border-r-0 border-[#e0e0e0] shadow-md text-[#FF6B35] hover:bg-[#fff7f2] transition-colors cursor-pointer"
      >
        <ListChecks className="w-4 h-4" />
        <span className="text-xs font-bold tabular-nums">{totalAnswered}/{questions.length}</span>
      </button>
    );
  }

  return (
    <>
      <aside
        className="hidden lg:block fixed z-30"
        style={pos ? { top: pos.top, right: pos.right } : { top: 150, right: 16 }}
      >
        <div className="w-[200px] bg-white border border-[#e0e0e0] rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div
            className={`flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white ${draggable ? 'cursor-move select-none' : ''}`}
            onMouseDown={draggable ? handleDragStart : undefined}
          >
            <div className="flex items-center gap-1.5">
              {draggable && <GripHorizontal className="w-3.5 h-3.5 opacity-70" />}
              <ListChecks className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wide">Danh sách câu</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              title="Thu gọn"
              className="text-white/90 hover:text-white cursor-pointer transition-colors"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Timer + Nộp bài — ẩn toàn bộ trong review mode */}
          {!reviewMode && (showTimer || (onSubmit && !hideSubmit)) && (
            <div className="px-3 pt-3 pb-2.5 border-b border-[#eef0f2] space-y-2.5">
              {/* Submit button — gắn lên đầu khối timer. Dùng emerald để phân biệt với header cam của panel */}
              {onSubmit && !hideSubmit && !reviewMode && (
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={!canSubmit}
                  title={submitTooltip ?? (canSubmit ? "Nộp bài" : "Cần khoanh hết câu hỏi mới được nộp")}
                  className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${
                    canSubmit
                      ? "text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] cursor-pointer shadow-emerald-200/60"
                      : "text-slate-400 bg-slate-100 cursor-not-allowed"
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  Nộp bài
                </button>
              )}

              {/* Timer */}
              {showTimer && (
                <div className="text-center">
                  <p className="text-[11px] text-[#677788] mb-0.5">Thời gian còn lại</p>
                  <div className={`flex items-center justify-center gap-1.5 text-2xl font-bold tabular-nums ${lowTime ? "text-red-600 animate-pulse" : "text-[#1a1a1a]"}`}>
                    <Clock className={`w-5 h-5 ${lowTime ? "text-red-500" : "text-[#FF6B35]"}`} />
                    {formatClock(timeLeft)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Body */}
          <div className="p-3 space-y-3 max-h-[calc(100vh-340px)] overflow-y-auto">
            {groups.map((group) => {
              const groupAnswered = group.items.filter((q) => {
                const v = answers[q.qId];
                return v != null && v !== "";
              }).length;
              const isActiveGroup = activeGroupIndex === group.index;

              return (
                <div key={group.index}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[11px] font-bold ${isActiveGroup ? "text-[#FF6B35]" : "text-[#677788]"}`}>
                      {group.label}
                    </span>
                    <span className="text-[10px] text-[#9aa5b1] tabular-nums">
                      {groupAnswered}/{group.items.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {group.items.map((q) => {
                      const v = answers[q.qId];
                      const answered = v != null && v !== "";
                      const flag = !!flagged[q.qId];
                      const isCurrent = currentNumber === q.number;

                      let tone: string;
                      if (reviewMode) {
                        // Ưu tiên server-graded isCorrectMap; fallback text-compare
                        const ca = correctAnswers[q.qId];
                        const isCorrect = answered && (
                          q.qId in isCorrectMap
                            ? isCorrectMap[q.qId]
                            : ca != null && String(v).trim().toLowerCase() === ca.trim().toLowerCase()
                        );
                        const isWrong = answered && !isCorrect;
                        if (isCorrect) {
                          tone = "bg-emerald-500 text-white hover:bg-emerald-600";
                        } else if (isWrong) {
                          tone = "bg-red-500 text-white hover:bg-red-600";
                        } else {
                          // Chưa trả lời → xám
                          tone = "bg-[#f1f3f5] text-[#677788]";
                        }
                      } else if (flag) {
                        tone = "bg-amber-500 text-white hover:bg-amber-600";
                      } else if (answered) {
                        tone = "bg-[#FF6B35] text-white hover:bg-[#FF8C42]";
                      } else {
                        tone = "bg-[#f1f3f5] text-[#677788] hover:bg-[#e4e7eb]";
                      }
                      const ring = isCurrent ? " ring-2 ring-offset-1 ring-[#FF8C42]" : "";

                      return (
                        <button
                          key={q.qId}
                          type="button"
                          onClick={() => onJump(q)}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onToggleFlag?.(q.qId);
                          }}
                          title={`Câu ${q.number}${flag ? " — đã gắn cờ (double-click bỏ cờ)" : answered ? " — đã trả lời (double-click gắn cờ)" : " — chưa làm (double-click gắn cờ)"}`}
                          className={`relative h-7 rounded text-[11px] font-semibold tabular-nums transition-all cursor-pointer flex items-center justify-center select-none ${tone}${ring}`}
                        >
                          {q.number}
                          {flag && answered && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 border border-white" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Locked groups (CBT mode only) — hiển thị mờ, không click được */}
            {lockedGroups.length > 0 && (
              <div className="pt-2 mt-2 border-t border-dashed border-[#e4e7eb] space-y-2">
                <p className="text-[10px] uppercase tracking-wide text-[#9aa5b1] font-semibold">
                  Chưa mở khoá
                </p>
                {lockedGroups.map((group) => {
                  const start = group.items[0]?.number ?? "?";
                  const end = group.items[group.items.length - 1]?.number ?? "?";
                  return (
                    <div
                      key={`locked-${group.index}`}
                      className="flex items-center justify-between px-2 py-1.5 rounded-md bg-[#f7f8fa] border border-dashed border-[#e4e7eb] opacity-60"
                      title="Phần này sẽ mở khi audio chuyển sang"
                    >
                      <span className="text-[11px] font-medium text-[#9aa5b1] truncate">
                        🔒 {group.label}
                      </span>
                      <span className="text-[10px] text-[#9aa5b1] tabular-nums flex-shrink-0 ml-2">
                        {start}–{end}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer legend — ẩn khi review mode */}
          {!reviewMode && (
            <div className="px-3 py-2 border-t border-[#eef0f2] space-y-1">
              <div className="flex items-center gap-3 text-[10px] text-[#677788]">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#FF6B35]" /> Đã làm
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Gắn cờ
                </span>
              </div>
              {onToggleFlag && (
                <p className="text-[9.5px] text-[#9aa5b1] leading-snug">
                  💡 Nhấn đúp vào số câu để gắn / bỏ cờ
                </p>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Nút Nộp bài đã được nhúng vào panel phía trên — không cần fixed bottom-right nữa */}
    </>
  );
}

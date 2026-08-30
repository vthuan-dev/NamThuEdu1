import { useEffect, useRef } from "react";
import { AlertTriangle, HelpCircle, Trash2, Send, X } from "lucide-react";

/**
 * Sắc thái của hộp xác nhận. Quyết định màu, icon và chữ mặc định trên nút.
 *
 * - `danger`  : mất dữ liệu không lấy lại được (huỷ phiên, xoá phần, xoá bài).
 * - `submit`  : chốt một việc không sửa được nữa (nộp bài).
 * - `warning` : cần chú ý nhưng còn quay lại được (nộp bài rỗng, ghi đè nháp).
 * - `question`: hỏi bình thường, không hệ quả nặng.
 */
export type ConfirmTone = "danger" | "submit" | "warning" | "question";

export interface ConfirmOptions {
  title: string;
  /** Mô tả hệ quả. Nên nói rõ cái gì mất, cái gì không sửa được. */
  message?: string;
  tone?: ConfirmTone;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * Dòng nhấn mạnh hiển thị trong khung riêng — dùng cho hệ quả nghiêm trọng
   * mà học viên dễ đọc vội bỏ qua, ví dụ "Toàn bộ câu trả lời sẽ bị xoá".
   */
  highlight?: string;
}

const TONES: Record<
  ConfirmTone,
  {
    icon: typeof AlertTriangle;
    iconBg: string;
    ring: string;
    confirmBg: string;
    confirmLabel: string;
    highlightBg: string;
    highlightBorder: string;
    highlightText: string;
  }
> = {
  danger: {
    icon: Trash2,
    iconBg: "linear-gradient(135deg, #F87171, #DC2626)",
    ring: "rgba(220,38,38,0.18)",
    confirmBg: "linear-gradient(135deg, #EF4444, #DC2626)",
    confirmLabel: "Xoá",
    highlightBg: "#FEF2F2",
    highlightBorder: "#FECACA",
    highlightText: "#B91C1C",
  },
  submit: {
    icon: Send,
    iconBg: "linear-gradient(135deg, #34D399, #059669)",
    ring: "rgba(5,150,105,0.18)",
    confirmBg: "linear-gradient(135deg, #10B981, #059669)",
    confirmLabel: "Nộp bài",
    highlightBg: "#ECFDF5",
    highlightBorder: "#A7F3D0",
    highlightText: "#047857",
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "linear-gradient(135deg, #FBBF24, #F97316)",
    ring: "rgba(249,115,22,0.18)",
    confirmBg: "linear-gradient(135deg, #F59E0B, #EA580C)",
    confirmLabel: "Tiếp tục",
    highlightBg: "#FFFBEB",
    highlightBorder: "#FDE68A",
    highlightText: "#B45309",
  },
  question: {
    icon: HelpCircle,
    iconBg: "linear-gradient(135deg, #818CF8, #6366F1)",
    ring: "rgba(99,102,241,0.18)",
    confirmBg: "linear-gradient(135deg, #6366F1, #4F46E5)",
    confirmLabel: "Đồng ý",
    highlightBg: "#EEF2FF",
    highlightBorder: "#C7D2FE",
    highlightText: "#4338CA",
  },
};

interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  highlight,
  tone = "question",
  confirmLabel,
  cancelLabel = "Huỷ",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const style = TONES[tone];
  const Icon = style.icon;

  /**
   * Esc để huỷ, và giam focus trong hộp thoại.
   *
   * `window.confirm` được trình duyệt giam focus sẵn; hộp thoại tự vẽ thì không,
   * nên nếu thiếu phần này người dùng bàn phím có thể Tab ra sau lớp nền và bấm
   * vào chính nút vừa mở hộp thoại.
   */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  // Focus nút xác nhận khi mở — khớp hành vi của window.confirm, nơi OK là nút
  // mặc định. Người dùng bàn phím bấm Enter là xong.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => confirmRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Chặn cuộn trang nền khi hộp thoại mở. Trên iOS nếu không chặn thì cuộn
  // trong hộp thoại sẽ "xuyên" xuống trang phía dưới.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      // z-[10000]: phải cao hơn toast (9999), vì hộp thoại đòi trả lời mới đi
      // tiếp được, không thể để một thẻ toast nằm đè lên nút bấm.
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={message ? "confirm-dialog-message" : undefined}
    >
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-[fadeIn_180ms_ease-out]"
        onClick={onCancel}
      />

      <div
        ref={panelRef}
        // Trên mobile là tấm trượt từ đáy (ngón tay với tới nút dễ hơn), từ sm
        // trở lên là hộp giữa màn hình theo lối quen thuộc trên desktop.
        className="relative z-10 w-full sm:max-w-[440px] bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden animate-[confirmIn_240ms_cubic-bezier(0.16,1,0.3,1)]"
        style={{
          boxShadow:
            "0 24px 64px rgba(15,23,42,0.24), 0 2px 8px rgba(15,23,42,0.08)",
          paddingBottom: "max(0px, env(safe-area-inset-bottom))",
        }}
      >
        <div className="h-1" style={{ background: style.iconBg }} />

        <button
          type="button"
          onClick={onCancel}
          aria-label="Đóng"
          className="absolute top-4 right-4 w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4.5 h-4.5" />
        </button>

        <div className="px-5 sm:px-6 pt-6 pb-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: style.iconBg,
              boxShadow: `0 8px 24px ${style.ring}`,
            }}
          >
            <Icon className="w-7 h-7 text-white" strokeWidth={2.4} />
          </div>

          <h2
            id="confirm-dialog-title"
            className="text-lg sm:text-xl font-bold text-slate-900 leading-snug pr-8"
          >
            {title}
          </h2>

          {message && (
            <p
              id="confirm-dialog-message"
              className="mt-2 text-sm text-slate-500 leading-relaxed"
            >
              {message}
            </p>
          )}

          {highlight && (
            <div
              className="mt-4 flex items-start gap-2.5 rounded-xl px-3.5 py-3"
              style={{
                background: style.highlightBg,
                border: `1px solid ${style.highlightBorder}`,
              }}
            >
              <AlertTriangle
                className="w-4 h-4 flex-shrink-0 mt-0.5"
                style={{ color: style.highlightText }}
                strokeWidth={2.5}
              />
              <p
                className="text-[13px] font-semibold leading-snug"
                style={{ color: style.highlightText }}
              >
                {highlight}
              </p>
            </div>
          )}
        </div>

        {/* Nút xác nhận đặt bên phải và nổi bật hơn. `flex-col-reverse` dưới sm
            để nút chính nằm dưới cùng, gần ngón tay nhất. */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 px-5 sm:px-6 pb-5 sm:pb-6">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center min-h-11 px-5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-[0.98]"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center justify-center min-h-11 px-5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-95 active:scale-[0.98]"
            style={{
              background: style.confirmBg,
              boxShadow: `0 6px 18px ${style.ring}`,
            }}
          >
            {confirmLabel ?? style.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

import { Toast, ToastProps } from "./Toast";

interface ToastContainerProps {
  toasts: Omit<ToastProps, "onClose">[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div
      // `left-3 right-3` dưới sm: toast rộng cố định 340px cộng lề 20px mỗi bên
      // là 380px — vượt màn 375px. Trên mobile để nó tự co theo bề ngang.
      // `top` dùng safe-area để không lọt dưới notch.
      className="fixed left-3 right-3 sm:left-5 sm:right-auto z-[9999] flex flex-col items-stretch sm:items-start gap-3 pointer-events-none"
      style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
      role="region"
      aria-label="Thông báo"
      // Screen reader đọc toast mới mà không cần chuyển focus; `polite` để
      // không cắt ngang câu đang đọc.
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 pointer-events-auto w-full sm:w-auto">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onClose={onClose} />
        ))}
      </div>
    </div>
  );
}

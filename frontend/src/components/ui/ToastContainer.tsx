import { Toast, ToastProps } from "./Toast";

interface ToastContainerProps {
  toasts: Omit<ToastProps, "onClose">[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div
      className="fixed top-5 left-5 z-[9999] flex flex-col items-start gap-3 pointer-events-none"
      role="region"
      aria-label="Thông báo"
    >
      <div className="flex flex-col gap-3 pointer-events-auto w-auto">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onClose={onClose} />
        ))}
      </div>
    </div>
  );
}

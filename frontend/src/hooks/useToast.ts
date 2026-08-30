import { useState, useCallback } from "react";
import { ToastType } from "../components/ui/Toast";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

/**
 * Số toast hiển thị cùng lúc.
 *
 * Trước đây ngăn xếp không có giới hạn: mỗi toast cao ~90px, nên chỉ cần 6-7 cái
 * là tràn khỏi màn hình điện thoại và cái mới nhất — thường là cái quan trọng
 * nhất — nằm ngoài vùng nhìn thấy. Giữ 3 cái mới nhất, đẩy cái cũ nhất ra.
 */
const MAX_VISIBLE = 3;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (type: ToastType, message: string, duration: number = 3000) => {
      setToasts((prev) => {
        // Bỏ qua nếu đúng tin nhắn đó đang hiển thị. Hai chỗ cùng báo một lỗi
        // (ví dụ vòng lặp gọi API, mỗi lần lỗi lại toast) thì xếp hai thẻ giống
        // nhau đè lên nhau chỉ gây rối, không thêm thông tin nào.
        if (prev.some((t) => t.type === type && t.message === message)) {
          return prev;
        }

        const id = Math.random().toString(36).substring(2, 9);
        const next = [...prev, { id, type, message, duration }];
        return next.slice(-MAX_VISIBLE);
      });
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback(
    (message: string, duration?: number) => showToast("success", message, duration),
    [showToast]
  );

  const error = useCallback(
    (message: string, duration?: number) => showToast("error", message, duration),
    [showToast]
  );

  const warning = useCallback(
    (message: string, duration?: number) => showToast("warning", message, duration),
    [showToast]
  );

  const info = useCallback(
    (message: string, duration?: number) => showToast("info", message, duration),
    [showToast]
  );

  return {
    toasts,
    removeToast,
    success,
    error,
    warning,
    info,
  };
}

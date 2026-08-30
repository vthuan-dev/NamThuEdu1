import { createContext, useCallback, useContext, useRef, useState } from "react";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import type { ConfirmOptions } from "../components/ui/ConfirmDialog";

/**
 * Xác nhận dạng promise, thay thế `window.confirm`.
 *
 * `window.confirm` trả về boolean đồng bộ, còn hộp thoại React thì không thể —
 * nó phải render rồi đợi người dùng bấm. Bọc trong promise cho phép chỗ gọi giữ
 * gần như nguyên hình dạng cũ:
 *
 *     if (!(await confirm({ title: '...' }))) return;
 *
 * thay cho
 *
 *     if (!window.confirm('...')) return;
 *
 * Nhờ vậy chuyển đổi 36 chỗ gọi không phải viết lại luồng điều khiển, chỉ thêm
 * `await` và làm hàm chứa nó thành `async`.
 */
type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      // Nếu đang có hộp thoại mở mà chỗ khác gọi tiếp, trả false cho cái cũ để
      // promise của nó không bị treo mãi.
      if (resolveRef.current) resolveRef.current(false);
      resolveRef.current = resolve;
      setOptions(opts);
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    setOptions(null);
    const resolve = resolveRef.current;
    resolveRef.current = null;
    resolve?.(value);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={options !== null}
        title={options?.title ?? ""}
        message={options?.message}
        highlight={options?.highlight}
        tone={options?.tone}
        confirmLabel={options?.confirmLabel}
        cancelLabel={options?.cancelLabel}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return ctx;
}

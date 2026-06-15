/**
 * MultiTabWarning
 * ---------------
 * Hiển thị cảnh báo khi BroadcastChannel phát hiện một tab khác cũng đang
 * mở cùng `submissionId`. Đa tab nguy hiểm vì:
 *   - Hai tab cùng gõ → race condition trên localStorage / server queue.
 *   - Tab cũ ẩn lâu có thể trigger pagehide → auto-submit bài đang dở.
 *
 * Quyết định UX:
 *   - Không bắt buộc đóng tab — chỉ cảnh báo nổi (banner / floating chip).
 *   - Cho phép student ấn "Tôi hiểu" để dismiss tạm thời (state local).
 *     Nếu phát hiện tab khác lần nữa → banner sẽ xuất hiện lại.
 *   - 2 variant: `kids` (clay rounded, pastel) và `default` (slate).
 */

import { useEffect, useState } from 'react';

export interface MultiTabWarningProps {
  hasOtherTab: boolean;
  variant?: 'kids' | 'default';
  className?: string;
  /** Vị trí: 'top' (banner full-width) hoặc 'floating' (góc phải). Mặc định 'floating'. */
  position?: 'top' | 'floating';
}

export function MultiTabWarning({
  hasOtherTab,
  variant = 'default',
  className,
  position = 'floating',
}: MultiTabWarningProps) {
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed nếu hasOtherTab vừa bật lại từ false → true
  useEffect(() => {
    if (!hasOtherTab) setDismissed(false);
  }, [hasOtherTab]);

  if (!hasOtherTab || dismissed) return null;

  const isKids = variant === 'kids';

  if (position === 'top') {
    return (
      <div
        role="alert"
        aria-live="polite"
        className={[
          'w-full px-4 py-2.5 flex items-center justify-between gap-3',
          isKids
            ? 'bg-amber-100 border-b-2 border-amber-300 text-amber-900'
            : 'bg-amber-50 border-b border-amber-300 text-amber-900',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <span aria-hidden>⚠️</span>
          <span>
            Bài thi này đang mở ở một tab khác. Hãy đóng các tab cũ để tránh mất câu trả lời.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className={
            isKids
              ? 'px-3 py-1 rounded-full bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-bold transition-colors'
              : 'px-3 py-1 rounded-md bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-medium transition-colors'
          }
        >
          Tôi hiểu
        </button>
      </div>
    );
  }

  // Floating (default)
  return (
    <div
      role="alert"
      aria-live="polite"
      className={[
        'fixed z-50 max-w-sm shadow-lg flex items-start gap-3 p-4',
        'bottom-4 right-4',
        isKids
          ? 'rounded-2xl border-2 border-amber-300 bg-amber-50 text-amber-900'
          : 'rounded-lg border border-amber-300 bg-white text-amber-900',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span aria-hidden className="text-lg leading-none mt-0.5">
        ⚠️
      </span>
      <div className="flex-1 text-sm">
        <p className="font-semibold mb-1">Phát hiện tab khác</p>
        <p className="text-xs leading-relaxed">
          Bài thi này đang mở ở một tab khác. Để tránh trùng/lệch câu trả lời, hãy đóng các tab cũ
          và chỉ giữ tab này.
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className={
            isKids
              ? 'mt-2 px-3 py-1 rounded-full bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-bold transition-colors'
              : 'mt-2 px-3 py-1 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-medium transition-colors'
          }
        >
          Tôi hiểu
        </button>
      </div>
    </div>
  );
}

export default MultiTabWarning;

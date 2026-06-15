/**
 * OfflineBanner
 * -------------
 * Banner đỏ gắn trên đầu trang khi mất kết nối Internet.
 *
 *   - Chỉ render khi `online === false`.
 *   - Hiển thị `pendingCount` để học viên biết bài đang chờ đồng bộ.
 *   - Trấn an: dữ liệu vẫn an toàn ở localStorage, sẽ tự gửi khi online lại.
 *   - 2 variant: `kids` (nét đậm, emoji) và `default` (slate, gọn).
 *   - role="alert" + aria-live cho screen reader.
 */

import { useEffect, useState } from 'react';

export interface OfflineBannerProps {
  online: boolean;
  pendingCount?: number;
  variant?: 'kids' | 'default';
  className?: string;
  /** Khi reconnected, banner stick lại 2s rồi auto ẩn (cho user thấy "Đã kết nối lại"). */
  showReconnected?: boolean;
}

export function OfflineBanner({
  online,
  pendingCount = 0,
  variant = 'default',
  className,
  showReconnected = true,
}: OfflineBannerProps) {
  const [justReconnected, setJustReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      setJustReconnected(false);
      return;
    }
    if (online && wasOffline && showReconnected) {
      setJustReconnected(true);
      const id = window.setTimeout(() => {
        setJustReconnected(false);
        setWasOffline(false);
      }, 2500);
      return () => window.clearTimeout(id);
    }
  }, [online, wasOffline, showReconnected]);

  if (online && !justReconnected) return null;

  const isKids = variant === 'kids';

  if (online && justReconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={[
          isKids
            ? 'w-full px-4 py-2.5 text-center text-sm font-bold rounded-2xl border-2 border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm'
            : 'w-full px-4 py-2 text-center text-sm font-medium border-y border-emerald-200 bg-emerald-50 text-emerald-700',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span aria-hidden>🟢 </span>
        Đã kết nối lại — bài làm đang được đồng bộ.
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={[
        isKids
          ? 'w-full px-4 py-3 rounded-2xl border-2 border-rose-200 bg-rose-50 text-rose-700 shadow-sm'
          : 'w-full px-4 py-2.5 border-y border-rose-200 bg-rose-50 text-rose-700',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-center justify-center gap-2 text-sm font-medium">
        <span aria-hidden className="text-base">
          {isKids ? '📡' : '⚠'}
        </span>
        <span>
          {isKids
            ? 'Mất kết nối Internet. Đừng lo, bài của con vẫn được lưu trên máy.'
            : 'Mất kết nối Internet. Bài làm vẫn được lưu cục bộ.'}
        </span>
        {pendingCount > 0 && (
          <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full bg-rose-200/60 text-rose-800 text-xs font-bold">
            {pendingCount} câu chờ đồng bộ
          </span>
        )}
      </div>
    </div>
  );
}

export default OfflineBanner;

/**
 * SaveStatusIndicator
 * -------------------
 * Pill nhỏ hiển thị trạng thái auto-save kế bên timer.
 *
 *   - idle    → ẩn
 *   - saving  → "⏳ Đang lưu…"
 *   - saved   → "✓ Đã lưu lúc 14:32"
 *   - error   → "⚠ Lưu lỗi · sẽ thử lại"
 *
 * Tính năng:
 *   - Hiển thị `pendingCount` khi đang saving (queue size).
 *   - Cập nhật text "Đã lưu lúc HH:mm" mỗi phút (tránh stale).
 *   - 2 variant: `kids` (rounded clay, pastel) và `default` (slate).
 *   - Có aria-live="polite" cho screen reader.
 */

import { useEffect, useState } from 'react';
import type { SaveStatus } from '../../hooks/exam/useExamSession';

export interface SaveStatusIndicatorProps {
  status: SaveStatus;
  lastSavedAt?: Date | null;
  pendingCount?: number;
  variant?: 'kids' | 'default';
  className?: string;
}

function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function SaveStatusIndicator({
  status,
  lastSavedAt,
  pendingCount = 0,
  variant = 'default',
  className,
}: SaveStatusIndicatorProps) {
  // Force re-render mỗi 30s để chuỗi "Đã lưu lúc HH:mm" không bị lệch
  const [, setTick] = useState(0);
  useEffect(() => {
    if (status !== 'saved') return;
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [status]);

  if (status === 'idle' && !lastSavedAt) return null;

  const isKids = variant === 'kids';
  const baseClass = isKids
    ? 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border-2 transition-all'
    : 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors';

  let toneClass = '';
  let label = '';
  let icon = '';

  if (status === 'saving') {
    toneClass = isKids
      ? 'bg-amber-50 border-amber-200 text-amber-700'
      : 'bg-amber-50 border-amber-200 text-amber-700';
    icon = '⏳';
    label =
      pendingCount > 0
        ? `Đang lưu ${pendingCount} câu…`
        : 'Đang lưu…';
  } else if (status === 'error') {
    toneClass = isKids
      ? 'bg-rose-50 border-rose-200 text-rose-700'
      : 'bg-rose-50 border-rose-200 text-rose-700';
    icon = '⚠';
    label = 'Lưu lỗi · sẽ thử lại';
  } else if (status === 'saved' || (status === 'idle' && lastSavedAt)) {
    toneClass = isKids
      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : 'bg-emerald-50 border-emerald-200 text-emerald-700';
    icon = '✓';
    label = lastSavedAt
      ? `Đã lưu lúc ${formatTime(lastSavedAt)}`
      : 'Đã lưu';
  } else {
    return null;
  }

  return (
    <span
      role="status"
      aria-live="polite"
      className={[baseClass, toneClass, className].filter(Boolean).join(' ')}
    >
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </span>
  );
}

export default SaveStatusIndicator;

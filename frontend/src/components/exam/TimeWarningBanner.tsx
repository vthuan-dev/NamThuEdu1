import React from 'react';
import { Timer, AlertTriangle, Zap } from 'lucide-react';

export type TimeWarningLevel = null | '5min' | '1min' | '10sec';

interface Props {
  level: TimeWarningLevel;
  onDismiss?: () => void;
  timeRemaining: number;
}

/**
 * Banner cảnh báo thời gian — 5min dismissable, 1min/10sec bắt buộc.
 * Giống trang luyện thi uy tín (TOEFL/IELTS online).
 */
export const TimeWarningBanner: React.FC<Props> = ({
  level,
  onDismiss,
  timeRemaining,
}) => {
  if (!level) return null;

  const isUrgent = level === '1min' || level === '10sec';
  const isCritical = level === '10sec';

  const bg = isCritical
    ? 'bg-red-600 text-white'
    : isUrgent
      ? 'bg-amber-500 text-white'
      : 'bg-blue-50 text-blue-800 border border-blue-200';

  const icon = isCritical ? (
    <Zap className="w-5 h-5 animate-pulse" />
  ) : isUrgent ? (
    <AlertTriangle className="w-5 h-5 animate-bounce" />
  ) : (
    <Timer className="w-5 h-5" />
  );

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const messages: Record<string, string> = {
    '5min': 'Còn 5 phút! Hãy kiểm tra lại bài làm.',
    '1min': 'Còn 1 phút! Nộp bài ngay hoặc hệ thống sẽ tự động nộp.',
    '10sec': 'Sắp hết giờ! Đang tự động nộp bài…',
  };

  return (
    <div
      className={`w-full px-4 py-3 flex items-center justify-between gap-3 ${bg} ${isCritical ? 'animate-pulse' : ''}`}
      role="alert"
      aria-live={isCritical ? 'assertive' : 'polite'}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icon}
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">
            {messages[level]}
          </p>
          <p className="text-xs opacity-90">
            Còn lại: {formatTime(timeRemaining)}
          </p>
        </div>
      </div>
      {!isUrgent && onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 text-xs font-medium underline hover:no-underline px-2 py-1 rounded"
          aria-label="Tắt cảnh báo"
        >
          Đã hiểu
        </button>
      )}
    </div>
  );
};

export default TimeWarningBanner;

import { Clock, ChevronLeft, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router';

interface Props {
  examTitle: string;
  totalSeconds: number;       // remaining
  totalDurationSec: number;   // total
  onBack?: () => void;
  hideTimer?: boolean;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export function ThptTopBar({ examTitle, totalSeconds, totalDurationSec, onBack, hideTimer }: Props) {
  const navigate = useNavigate();
  const pct = totalDurationSec > 0 ? (totalSeconds / totalDurationSec) * 100 : 0;
  const danger = totalSeconds > 0 && totalSeconds < 5 * 60; // <5 phút

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
        <button
          type="button"
          onClick={() => (onBack ? onBack() : navigate(-1))}
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
          title="Quay lại"
        >
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-teal-600 flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-900 truncate">{examTitle}</h1>
            <p className="text-[11px] text-slate-500">Đề Tiếng Anh · Thi trên máy tính</p>
          </div>
        </div>

        {!hideTimer && (
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              danger ? 'bg-red-50' : 'bg-teal-50'
            }`}
          >
            <Clock className={`w-4 h-4 ${danger ? 'text-red-600' : 'text-teal-600'}`} />
            <div>
              <div
                className={`text-sm font-bold tabular-nums ${
                  danger ? 'text-red-700' : 'text-teal-700'
                }`}
              >
                {formatTime(Math.max(0, totalSeconds))}
              </div>
              <div className="h-1 w-24 rounded-full bg-white overflow-hidden mt-0.5">
                <div
                  className={`h-full transition-all duration-1000 ${
                    danger ? 'bg-red-500' : 'bg-teal-500'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

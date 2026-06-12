import { ChevronLeft, ChevronRight, Send, Loader2 } from 'lucide-react';

interface Props {
  activePart: number;
  totalParts: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

export function ThptBottomNav({
  activePart,
  totalParts,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onSubmit,
  isSubmitting,
}: Props) {
  const isLast = activePart >= totalParts - 1;
  return (
    <footer className="sticky bottom-0 z-30 bg-white border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Phần trước</span>
        </button>

        <div className="text-xs text-slate-500 font-semibold">
          Phần {activePart + 1} / {totalParts}
        </div>

        {!isLast ? (
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-white transition-colors cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed bg-teal-600 hover:bg-teal-700"
          >
            <span>Phần tiếp</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-white transition-colors cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed bg-orange-500 hover:bg-orange-600"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Nộp bài</span>
          </button>
        )}
      </div>
    </footer>
  );
}

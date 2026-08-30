import { ChevronLeft, ChevronRight, Send, Loader2, ListChecks } from 'lucide-react';

interface Props {
  activePart: number;
  totalParts: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  /** Mở bảng Tiến độ dạng bottom sheet (mobile). Không truyền → ô giữa chỉ là nhãn. */
  onOpenProgress?: () => void;
  /** Số câu đã trả lời / tổng số câu, hiển thị ở ô giữa. */
  answeredCount?: number;
  totalQuestions?: number;
}

/**
 * Thanh điều hướng dưới cùng của trang làm bài THPT.
 *
 * ĐIỂM QUAN TRỌNG: nút "Nộp bài" LUÔN hiển thị, ở mọi phần.
 *
 * Trước đây nút này nằm trong nhánh `else` của `isLast`, nên ở mọi phần không
 * phải phần cuối nó KHÔNG TỒN TẠI trên DOM — chỗ đó là nút "Phần tiếp". Học viên
 * làm xong bài nhưng đang đứng ở phần giữa thì không có cách nào nộp: phải tự
 * đoán rằng mình cần bấm sang phần cuối trước. Đây là nguyên nhân của báo lỗi
 * "thiếu nút nộp bài".
 *
 * Cho nộp ở phần giữa không tạo rủi ro nộp nhầm: `handleSubmit` ở trang cha đã
 * có `window.confirm`, và còn một cảnh báo riêng khi không tìm thấy câu trả lời
 * nào trong bộ nhớ.
 *
 * Trên mobile ô giữa là NÚT mở bảng Tiến độ, vì cột Tiến độ bị ẩn dưới `lg`
 * (trước đây nó nằm sau toàn bộ câu hỏi trong DOM nên học viên phải cuộn hết đề
 * mới tới được — vô dụng đúng lúc cần nhất).
 */
export function ThptBottomNav({
  activePart,
  totalParts,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onSubmit,
  isSubmitting,
  onOpenProgress,
  answeredCount,
  totalQuestions,
}: Props) {
  const isLast = activePart >= totalParts - 1;
  const showProgressCount =
    typeof answeredCount === 'number' && typeof totalQuestions === 'number';

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 shadow-[0_-6px_20px_rgba(15,23,42,0.06)]"
      // env(safe-area-inset-bottom) tránh home indicator của iPhone đè lên nút.
      // Bấm "Nộp bài" mà trúng vùng cử chỉ thì thành trượt ra màn hình chủ.
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-2 sm:pt-3 flex items-center gap-2 sm:gap-3">
        {/* Prev — icon-only trên mobile để nhường chỗ cho nút Nộp bài.
            min-h-11 = 44px, ngưỡng touch target tối thiểu. */}
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="Phần trước"
          className="flex items-center justify-center gap-1.5 min-h-11 px-3 sm:px-4 rounded-lg font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-sm flex-shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Phần trước</span>
        </button>

        {/* Ô giữa: nút mở bảng Tiến độ khi có onOpenProgress, ngược lại chỉ là nhãn. */}
        {onOpenProgress ? (
          <button
            type="button"
            onClick={onOpenProgress}
            className="flex-1 min-w-0 min-h-11 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-slate-700"
          >
            <ListChecks className="w-4 h-4 text-teal-600 flex-shrink-0" />
            <span className="text-xs font-bold truncate">
              Phần {activePart + 1}/{totalParts}
              {showProgressCount && ` · ${answeredCount}/${totalQuestions} câu`}
            </span>
          </button>
        ) : (
          <div className="flex-1 text-center text-xs text-slate-500 font-semibold">
            Phần {activePart + 1} / {totalParts}
          </div>
        )}

        {/* Next — ẩn ở phần cuối vì không còn phần nào để đi tới. */}
        {!isLast && (
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            aria-label="Phần tiếp"
            className="flex items-center justify-center gap-1.5 min-h-11 px-3 sm:px-4 rounded-lg font-semibold text-white transition-colors cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed bg-teal-600 hover:bg-teal-700 flex-shrink-0"
          >
            <span className="hidden sm:inline">Phần tiếp</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Nộp bài — LUÔN hiển thị. Ở phần cuối thì nổi hơn (đầy màu) vì đó là
            hành động mong đợi; ở phần giữa thì nhẹ hơn để không mời gọi bấm sớm,
            nhưng vẫn luôn với tới được. */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className={`flex items-center justify-center gap-1.5 min-h-11 px-3 sm:px-4 rounded-lg font-semibold transition-colors cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ${
            isLast
              ? 'text-white bg-orange-500 hover:bg-orange-600'
              : 'text-orange-700 bg-orange-50 border border-orange-200 hover:bg-orange-100'
          }`}
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span>Nộp bài</span>
        </button>
      </div>
    </footer>
  );
}

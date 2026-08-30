import { useState } from 'react';
import { Clock, ChevronLeft, BookOpen, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router';

interface Props {
  examTitle: string;
  totalSeconds: number;       // remaining
  totalDurationSec: number;   // total
  onBack?: () => void;
  hideTimer?: boolean;
  onRestart?: () => void;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/**
 * Thanh đầu trang làm bài THPT.
 *
 * Trên mobile đây là thanh đầu trang DUY NHẤT: header của layout học viên đã
 * được ẩn khi vào route làm bài (xem utils/examRoutes + TeensLayout), vì trước
 * đây hai thanh xếp chồng nhau ăn ~120px chiều cao trên màn điện thoại.
 *
 * Vì vậy nút Quay lại ở đây là đường ra duy nhất — không được ẩn ở bất kỳ
 * breakpoint nào.
 */
export function ThptTopBar({ examTitle, totalSeconds, totalDurationSec, onBack, hideTimer, onRestart }: Props) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const pct = totalDurationSec > 0 ? (totalSeconds / totalDurationSec) * 100 : 0;
  const danger = totalSeconds > 0 && totalSeconds < 5 * 60; // <5 phút

  return (
    <header
      className="sticky top-0 z-30 bg-white border-b border-slate-200"
      // Khi index.html có viewport-fit=cover, nội dung tràn vào vùng tai thỏ ở
      // chế độ ngang. Đẩy xuống đúng phần an toàn.
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-3 flex items-center gap-2 sm:gap-4">
        {/* Đường ra duy nhất khi header layout đã ẩn — 44px cho touch target. */}
        <button
          type="button"
          onClick={() => (onBack ? onBack() : navigate(-1))}
          className="flex-shrink-0 w-11 h-11 -ml-1 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Quay lại"
          title="Quay lại"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-teal-600 flex-shrink-0 hidden sm:block" />
          <div className="min-w-0">
            <h1 className="text-[13px] sm:text-sm font-bold text-slate-900 truncate">{examTitle}</h1>
            {/* Phụ đề không mang thông tin cần khi đang thi — ẩn trên mobile để
                nhường chiều cao cho đề. */}
            <p className="hidden sm:block text-[11px] text-slate-500">Đề Tiếng Anh · Thi trên máy tính</p>
          </div>
        </div>

        {!hideTimer && (
          <div
            className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg flex-shrink-0 ${
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
              {/* Thanh tiến trình thời gian: ẩn trên mobile, con số đã đủ. */}
              <div className="hidden sm:block h-1 w-24 rounded-full bg-white overflow-hidden mt-0.5">
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

        {/* "Làm lại từ đầu" TIÊU 1 LƯỢT và huỷ phiên đang làm. Để nút này lộ ra
            cạnh đồng hồ trên màn hẹp là mời gọi bấm nhầm, nên trên mobile nó nằm
            trong menu phụ. Confirm ở hàm cha vẫn giữ nguyên. */}
        {onRestart && (
          <>
            <button
              type="button"
              onClick={onRestart}
              className="hidden sm:block text-xs font-bold text-red-600 hover:text-red-700 px-3 py-2 rounded-xl border border-red-200 hover:bg-red-50 cursor-pointer flex-shrink-0 transition-colors"
              title="Hủy phiên hiện tại và làm lại từ đầu"
            >
              Làm lại từ đầu
            </button>

            <div className="relative sm:hidden flex-shrink-0">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="w-11 h-11 -mr-1 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Tùy chọn khác"
                aria-expanded={menuOpen}
              >
                <MoreVertical className="w-5 h-5 text-slate-600" />
              </button>

              {menuOpen && (
                <>
                  {/* Lớp nền để bấm ra ngoài là đóng menu. */}
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl bg-white border border-slate-200 shadow-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onRestart();
                      }}
                      className="w-full text-left px-4 py-3 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      Làm lại từ đầu
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}

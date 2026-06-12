/**
 * DailyMotivationPopup — popup "buff tinh thần" + nhắc nhở, hiện 1 LẦN/NGÀY
 * vào lần đầu học viên mở app trong ngày.
 *
 * - Chỉ hiện 1 lần mỗi ngày (lưu cờ theo userId + ngày vào localStorage).
 * - Lời chào theo buổi + 1 câu động viên xoay vòng theo ngày.
 * - Nếu có lịch thi sắp tới (GV đặt) → hiện nhắc nhở kèm đếm ngược.
 * - Màu nhấn theo role (teal/teens, cam/kids, tím/adults) qua prop accent.
 */
import { useEffect, useState } from 'react';
import { X, Sparkles, CalendarClock, Flame, ArrowRight } from 'lucide-react';
import { getAuthUser } from '../../utils/authStorage';
import { studentApi } from '../../services/studentApi';

const QUOTES = [
  'Mỗi ngày học một chút, tương lai khác một nhiều. Cố lên nhé!',
  'Không cần giỏi ngay, chỉ cần đều đặn mỗi ngày là sẽ tới đích.',
  'Tiếng Anh là cây cầu — bạn đang bước thêm một bước hôm nay rồi đấy!',
  'Sai cũng không sao, quan trọng là bạn vẫn đang tiến lên.',
  'Bộ não thích sự lặp lại. Luyện hôm nay để mai nhớ lâu hơn!',
  'Người giỏi nhất cũng từng là người mới bắt đầu. Bạn làm được!',
  'Một bài tập nhỏ hôm nay = một điểm cao hơn ngày thi.',
  'Kiên trì hơn hôm qua một chút thôi là đủ tuyệt rồi!',
  'Học vì phiên bản tốt hơn của chính mình. Bắt đầu nào!',
  'Thành công là tổng của những nỗ lực nhỏ lặp lại mỗi ngày.',
  'Hôm nay học gì cũng được, miễn là bạn không dừng lại.',
  'Tự tin lên! Mỗi từ mới là một viên gạch xây ước mơ.',
];

interface Props {
  accent?: string;       // màu nhấn chính
  accentMid?: string;    // màu gradient phụ
  accentSoft?: string;   // nền nhạt
}

export function DailyMotivationPopup({
  accent = '#0D9488',
  accentMid = '#14B8A6',
  accentSoft = '#F0FDFA',
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('bạn');
  const [nextExam, setNextExam] = useState<{ title: string; date: string | null; daysUntil: number | null } | null>(null);

  useEffect(() => {
    let user: any = null;
    try { user = getAuthUser(); } catch { user = null; }
    const uid = user?.uId ?? user?.id ?? 'anon';
    const today = new Date().toISOString().slice(0, 10);
    const key = `daily_motiv_${uid}_${today}`;

    // Đã hiện hôm nay rồi → bỏ qua
    if (localStorage.getItem(key)) return;

    setName(user?.uName || user?.name || user?.full_name || 'bạn');

    let cancelled = false;
    const show = () => {
      if (cancelled) return;
      // Chỉ set cờ NGAY KHI popup thực sự bật lên (tránh mất lượt hiện do reload sớm)
      localStorage.setItem(key, '1');
      setOpen(true);
    };

    // Lấy lịch thi gần nhất (nếu có) để nhắc — best-effort, rồi mới hiện popup
    const p = studentApi.getExamSchedules?.();
    if (p && typeof p.then === 'function') {
      p.then((res: any) => {
        const list = res?.data?.data?.schedules ?? [];
        if (!cancelled && Array.isArray(list) && list.length > 0) {
          const s = list[0];
          setNextExam({ title: s.title, date: s.exam_date ?? null, daysUntil: s.days_until ?? null });
        }
      })
        .catch(() => {})
        .finally(() => setTimeout(show, 400));
    } else {
      setTimeout(show, 400);
    }

    return () => { cancelled = true; };
  }, []);

  if (!open) return null;

  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Chào buổi sáng' : hour < 14 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const quote = QUOTES[new Date().getDate() % QUOTES.length];

  const daysText = nextExam?.daysUntil == null ? null
    : nextExam.daysUntil <= 0 ? 'hôm nay'
    : nextExam.daysUntil === 1 ? 'ngày mai'
    : `còn ${nextExam.daysUntil} ngày`;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm"
      onMouseDown={() => setOpen(false)}
    >
      <style>{`
        @keyframes dmPopIn { from { opacity: 0; transform: translateY(14px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
        style={{ animation: 'dmPopIn 0.32s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header gradient */}
        <div className="relative px-6 pt-7 pb-8 text-center overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${accent}, ${accentMid})` }}>
          <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />
          <button
            onClick={() => setOpen(false)}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="relative z-10">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-white/20 flex items-center justify-center mb-3 ring-1 ring-white/30">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <p className="text-white/85 text-sm font-medium">{greeting},</p>
            <h2 className="text-white text-2xl font-extrabold tracking-tight mt-0.5 truncate px-4">{name}! 👋</h2>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Quote */}
          <div className="rounded-2xl p-4 mb-4" style={{ background: accentSoft }}>
            <div className="flex items-start gap-2.5">
              <Flame className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: accent }} />
              <p className="text-[14px] font-medium text-slate-700 leading-relaxed">{quote}</p>
            </div>
          </div>

          {/* Nhắc lịch thi sắp tới */}
          {nextExam && (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3.5 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: accentSoft, color: accent }}>
                <CalendarClock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Lịch thi sắp tới</p>
                <p className="text-sm font-bold text-slate-800 truncate">{nextExam.title}</p>
                {daysText && (
                  <p className="text-xs mt-0.5 font-semibold" style={{ color: accent }}>
                    {daysText}{nextExam.date ? ` · ${new Date(nextExam.date).toLocaleDateString('vi-VN')}` : ''}
                  </p>
                )}
              </div>
            </div>
          )}

          <button
            onClick={() => setOpen(false)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-white text-sm font-bold transition-transform active:scale-[0.98]"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accentMid})` }}
          >
            Bắt đầu học thôi <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default DailyMotivationPopup;

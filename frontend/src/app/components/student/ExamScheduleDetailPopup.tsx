/**
 * ExamScheduleDetailPopup — popup chi tiết lịch thi do giáo viên đặt.
 * Thiết kế tối giản: điểm nhấn là vòng đếm ngược ở giữa, danh sách thông tin
 * dạng hairline gọn gàng. Dùng cho chuông thông báo + luồng GV vừa đặt lịch.
 */
import { createPortal } from 'react-dom';
import { X, CalendarClock, MapPin, Clock, StickyNote, User2, GraduationCap } from 'lucide-react';
import type { ExamSchedule } from '../../../services/studentApi';

interface Props {
  schedule: ExamSchedule;
  onClose: () => void;
  accent?: string;
  accentMid?: string;
  accentSoft?: string;
}

const EXAM_TYPE_LABELS: Record<string, string> = {
  vstep: 'VSTEP',
  ielts: 'IELTS',
  thpt: 'THPT Quốc gia',
  cambridge: 'Cambridge',
  other: 'Khác',
};

function examTypeLabel(t?: string | null) {
  if (!t) return null;
  return EXAM_TYPE_LABELS[t] ?? t.toUpperCase();
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return d;
  }
}

export function ExamScheduleDetailPopup({
  schedule,
  onClose,
  accent = '#7C3AED',
  accentMid = '#8B5CF6',
  accentSoft = '#F5F3FF',
}: Props) {
  const days = schedule.days_until;
  const urgent = days != null && days >= 0 && days <= 3;

  // Màu điểm nhấn: khẩn → đỏ, còn lại theo role
  const focal = urgent ? '#EF4444' : accent;
  const focalSoft = urgent ? '#FEF2F2' : accentSoft;

  // Nội dung đếm ngược: tách số lớn + nhãn nhỏ để làm điểm nhấn
  let bigText = '';
  let smallText = 'cho đến ngày thi';
  if (days == null) {
    bigText = '';
    smallText = '';
  } else if (days <= 0) {
    bigText = 'Hôm nay';
    smallText = 'là ngày thi';
  } else if (days === 1) {
    bigText = 'Ngày mai';
    smallText = 'là ngày thi';
  } else {
    bigText = String(days);
    smallText = 'ngày nữa đến kỳ thi';
  }
  const bigIsNumber = days != null && days > 1;

  const rows = [
    examTypeLabel(schedule.exam_type) ? { icon: GraduationCap, label: 'Kỳ thi', value: examTypeLabel(schedule.exam_type)! } : null,
    { icon: CalendarClock, label: 'Ngày thi', value: fmtDate(schedule.exam_date) },
    schedule.exam_time ? { icon: Clock, label: 'Giờ thi', value: schedule.exam_time.slice(0, 5) } : null,
    schedule.location ? { icon: MapPin, label: 'Địa điểm', value: schedule.location } : null,
    schedule.teacher_name ? { icon: User2, label: 'Giáo viên', value: schedule.teacher_name } : null,
    schedule.note ? { icon: StickyNote, label: 'Ghi chú', value: schedule.note } : null,
  ].filter(Boolean) as { icon: any; label: string; value: string }[];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <style>{`
        @keyframes esPopIn { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes esRing { from { transform: scale(0.6); opacity: 0.5; } to { transform: scale(1); opacity: 0; } }
      `}</style>

      <div
        className="relative w-full max-w-[400px] bg-white rounded-[28px] overflow-hidden"
        style={{ animation: 'esPopIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards', boxShadow: '0 24px 60px -12px rgba(15,23,42,0.30)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Thanh nhấn mảnh trên cùng (minimal accent) */}
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${focal}, ${urgent ? '#FB7185' : accentMid})` }} />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="px-7 pt-7 pb-6">
          {/* Eyebrow */}
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: focal }}>
            Lịch thi sắp tới
          </p>

          {/* ── ĐIỂM NHẤN: vòng đếm ngược ─────────────────────────── */}
          {bigText && (
            <div className="flex justify-center mt-4 mb-1">
              <div className="relative w-28 h-28 flex items-center justify-center">
                {/* Halo nhịp nhàng */}
                <span
                  className="absolute inset-0 rounded-full"
                  style={{ background: focal, animation: 'esRing 2.4s ease-out infinite', opacity: 0.18 }}
                />
                <span className="absolute inset-0 rounded-full" style={{ background: focalSoft }} />
                <span className="absolute inset-[6px] rounded-full bg-white" />
                <div className="relative z-10 flex flex-col items-center justify-center leading-none">
                  <span
                    className={bigIsNumber ? 'font-black tabular-nums' : 'font-extrabold'}
                    style={{ color: focal, fontSize: bigIsNumber ? 44 : 20, letterSpacing: '-0.02em' }}
                  >
                    {bigText}
                  </span>
                  {bigIsNumber && (
                    <span className="text-[11px] font-bold mt-1" style={{ color: focal }}>NGÀY</span>
                  )}
                </div>
              </div>
            </div>
          )}
          <p className="text-center text-xs text-slate-400 font-medium mb-4">{smallText}</p>

          {/* Tiêu đề kỳ thi */}
          <h2 className="text-center text-lg font-extrabold text-slate-900 tracking-tight leading-snug px-2 mb-5 break-words">
            {schedule.title}
          </h2>

          {/* Danh sách thông tin — hairline gọn */}
          <div className="rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-3.5 py-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: accentSoft, color: accent }}
                >
                  <r.icon className="w-[16px] h-[16px]" />
                </div>
                <span className="text-[12px] text-slate-400 font-medium w-[72px] flex-shrink-0">{r.label}</span>
                <span className="text-sm font-semibold text-slate-800 text-right flex-1 break-words">{r.value}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={onClose}
            className="w-full mt-5 inline-flex items-center justify-center px-4 py-3 rounded-2xl text-white text-sm font-bold transition-transform active:scale-[0.98] cursor-pointer"
            style={{ background: focal, boxShadow: `0 8px 20px -6px ${focal}88` }}
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ExamScheduleDetailPopup;

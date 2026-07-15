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
  accent = '#6366F1',
}: Props) {
  const days = schedule.days_until;
  const urgent = days != null && days >= 0 && days <= 3;

  // Bảng màu tối giản: nền mực (ink) làm chủ đạo, chỉ điểm xuyết 1 nét màu mảnh.
  // Khẩn (≤3 ngày) chuyển nét nhấn sang hổ phách để cảnh báo nhẹ nhàng.
  const ink = '#0F172A';
  const accentColor = urgent ? '#D97706' : accent;

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
      `}</style>

      <div
        className="relative w-full max-w-[400px] bg-white rounded-[28px] overflow-hidden"
        style={{ animation: 'esPopIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards', boxShadow: '0 24px 60px -12px rgba(15,23,42,0.30)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="px-7 pt-8 pb-7">
          {/* Eyebrow */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="h-1 w-1 rounded-full" style={{ background: accentColor }} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Lịch thi sắp tới
            </p>
          </div>

          {/* ── ĐIỂM NHẤN: vòng đếm ngược tối giản ───────────────── */}
          {bigText && (
            <div className="flex justify-center mb-1">
              <div className="relative w-[132px] h-[132px]">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="46" fill="none" stroke="#F1F5F9" strokeWidth="4" />
                  <circle
                    cx="50" cy="50" r="46" fill="none"
                    stroke={accentColor} strokeWidth="4" strokeLinecap="round"
                    strokeDasharray="72 289"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                  <span
                    className={bigIsNumber ? 'font-black tabular-nums' : 'font-extrabold'}
                    style={{ color: ink, fontSize: bigIsNumber ? 50 : 21, letterSpacing: '-0.03em' }}
                  >
                    {bigText}
                  </span>
                  {bigIsNumber && (
                    <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400 mt-1.5">NGÀY</span>
                  )}
                </div>
              </div>
            </div>
          )}
          <p className="text-center text-[13px] text-slate-400 font-medium mb-5">{smallText}</p>

          {/* Tiêu đề kỳ thi */}
          <h2 className="text-center text-xl font-extrabold text-slate-900 tracking-tight leading-snug px-2 mb-6 break-words">
            {schedule.title}
          </h2>

          {/* Danh sách thông tin — hairline gọn */}
          <div className="rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-50 text-slate-400">
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
            className="w-full mt-6 inline-flex items-center justify-center px-4 py-3.5 rounded-2xl text-white text-sm font-bold transition-all active:scale-[0.98] cursor-pointer hover:opacity-90"
            style={{ background: ink }}
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

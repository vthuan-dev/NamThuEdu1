/**
 * ExamScheduleDetailPopup — popup chi tiết lịch thi do giáo viên đặt.
 * Hiện khi học viên bấm vào 1 thông báo "Lịch thi: ..." trong chuông.
 * Dùng lại được cho luồng "GV vừa thêm lịch -> hiện popup" sau này.
 */
import { createPortal } from 'react-dom';
import { X, CalendarClock, MapPin, Clock, StickyNote, User2, Sparkles, GraduationCap } from 'lucide-react';
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
  const countdown =
    days == null ? null : days <= 0 ? 'Hôm nay' : days === 1 ? 'Ngày mai' : `Còn ${days} ngày`;
  const urgent = days != null && days >= 0 && days <= 3;

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
        @keyframes esPopIn { from { opacity: 0; transform: translateY(14px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
        style={{ animation: 'esPopIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="relative px-6 pt-7 pb-7 overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${accent}, ${accentMid})` }}
        >
          <div
            className="absolute -top-12 -right-10 w-40 h-40 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #fff, transparent)' }}
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="relative z-10 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center ring-1 ring-white/30 flex-shrink-0">
              <CalendarClock className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white/80 text-[11px] font-bold uppercase tracking-wider">Lịch thi sắp tới</p>
              <h2 className="text-white text-xl font-extrabold tracking-tight leading-snug truncate">
                {schedule.title}
              </h2>
            </div>
          </div>
        </div>

        {/* Countdown badge */}
        {countdown && (
          <div className="px-6 -mt-4 relative z-10">
            <div
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-bold shadow-sm"
              style={{
                background: urgent ? '#FEF2F2' : accentSoft,
                color: urgent ? '#EF4444' : accent,
                border: `1px solid ${urgent ? '#FECACA' : accent + '22'}`,
              }}
            >
              <Sparkles className="w-4 h-4" />
              {countdown}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5 space-y-2.5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: accentSoft, color: accent }}
              >
                <r.icon className="w-[18px] h-[18px]" />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{r.label}</p>
                <p className="text-sm font-bold text-slate-800 capitalize-first break-words">{r.value}</p>
              </div>
            </div>
          ))}

          <button
            onClick={onClose}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-white text-sm font-bold transition-transform active:scale-[0.98] cursor-pointer"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accentMid})` }}
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

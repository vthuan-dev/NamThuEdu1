import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarClock, Clock, MapPin, Sparkles, X, Flame, BookOpen } from "lucide-react";
import { studentApi, type ExamSchedule } from "../../services/studentApi";
import { getAuthUser } from "../../utils/authStorage";

const EXAM_TYPE_LABEL: Record<string, string> = {
  vstep: "VSTEP",
  ielts: "IELTS",
  thpt: "THPT",
  cambridge: "Cambridge",
  other: "Kỳ thi",
};

function formatVnDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * ExamReminderPopup — popup nhắc nhở lịch thi cho học viên.
 *
 * - Tự fetch lịch thi sắp tới khi mount.
 * - Hiển thị 1 lần / ngày / thiết bị (lưu cờ vào localStorage theo ngày).
 * - Thiết kế động viên: gradient ấm, countdown nổi bật, lời nhắn của giáo viên.
 */
export function ExamReminderPopup() {
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [open, setOpen] = useState(false);

  const user = getAuthUser();
  const dismissKey = `examReminderDismissed:${user?.uId ?? "me"}:${todayKey()}`;

  useEffect(() => {
    let mounted = true;

    // Đã đóng popup trong hôm nay rồi thì không hiện lại.
    if (typeof window !== "undefined" && localStorage.getItem(dismissKey)) return;

    (async () => {
      try {
        const res = await studentApi.getExamSchedules();
        if (!mounted) return;
        const data = (res as any)?.data?.data?.schedules;
        const list: ExamSchedule[] = Array.isArray(data) ? data : [];
        if (list.length > 0) {
          setSchedules(list);
          setOpen(true);
        }
      } catch {
        /* silent — không chặn trải nghiệm nếu lỗi mạng */
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    setOpen(false);
    try {
      localStorage.setItem(dismissKey, "1");
    } catch {
      /* ignore */
    }
  };

  if (schedules.length === 0) return null;

  // Lịch gần nhất làm tâm điểm, các lịch còn lại liệt kê phụ.
  const primary = schedules[0];
  const others = schedules.slice(1, 3);
  const days = primary.days_until ?? 0;
  const typeLabel = EXAM_TYPE_LABEL[primary.exam_type ?? "other"] ?? "Kỳ thi";

  const countdownText =
    days <= 0 ? "Hôm nay là ngày thi!" : days === 1 ? "Ngày mai là ngày thi!" : `Còn ${days} ngày nữa thi`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          <motion.div
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            initial={{ scale: 0.9, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
          >
            {/* Banner gradient */}
            <div className="relative bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 px-6 pt-7 pb-12 text-white overflow-hidden">
              {/* Decorative blobs */}
              <div className="absolute -top-8 -right-6 w-32 h-32 rounded-full bg-white/10" />
              <div className="absolute top-10 -left-8 w-24 h-24 rounded-full bg-white/10" />

              <button
                onClick={handleClose}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 transition flex items-center justify-center"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative flex items-center gap-2 text-[12px] font-semibold tracking-wide uppercase text-white/90">
                <Sparkles className="w-4 h-4" />
                Nhắc nhở lịch thi
              </div>

              <div className="relative mt-3 flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-2xl font-extrabold leading-none">{days <= 0 ? "🔥" : days}</span>
                  {days > 0 && <span className="text-[10px] font-medium leading-none mt-0.5">ngày</span>}
                </div>
                <div className="leading-tight">
                  <p className="text-[19px] font-extrabold flex items-center gap-1.5">
                    <Flame className="w-5 h-5" />
                    {countdownText}
                  </p>
                  <p className="text-[13px] text-white/90 mt-0.5">
                    Bạn có lịch <span className="font-semibold">{typeLabel}</span> sắp tới
                  </p>
                </div>
              </div>
            </div>

            {/* Card content — kéo lên đè banner */}
            <div className="px-6 -mt-6 relative">
              <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-4">
                <h3 className="text-[16px] font-bold text-slate-900">{primary.title}</h3>

                <div className="mt-2.5 space-y-1.5 text-[13px] text-slate-600">
                  <p className="flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-orange-500" />
                    <span className="capitalize">{formatVnDate(primary.exam_date)}</span>
                  </p>
                  {primary.exam_time && (
                    <p className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-500" />
                      {primary.exam_time}
                    </p>
                  )}
                  {primary.location && (
                    <p className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-orange-500" />
                      {primary.location}
                    </p>
                  )}
                </div>

                {primary.note && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <p className="text-[12.5px] text-amber-900 italic leading-relaxed">
                      “{primary.note}”
                    </p>
                    {primary.teacher_name && (
                      <p className="text-[11px] text-amber-700/80 mt-1.5 text-right">
                        — {primary.teacher_name}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {others.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                    Lịch thi khác
                  </p>
                  <ul className="space-y-1.5">
                    {others.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between text-[12.5px] text-slate-600 bg-slate-50 rounded-lg px-3 py-2"
                      >
                        <span className="font-medium text-slate-700 truncate">{s.title}</span>
                        <span className="text-slate-400 flex-shrink-0 ml-2">
                          {s.days_until != null && s.days_until >= 0 ? `còn ${s.days_until} ngày` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pt-4 pb-6 mt-3">
              <p className="text-center text-[13px] text-slate-500 mb-3">
                Cố gắng ôn luyện thật tốt nhé! 💪
              </p>
              <button
                onClick={handleClose}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[14px] font-bold flex items-center justify-center gap-2 hover:from-orange-600 hover:to-amber-600 transition shadow-lg shadow-orange-500/25"
              >
                <BookOpen className="w-4 h-4" />
                Đã hiểu, vào ôn luyện
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

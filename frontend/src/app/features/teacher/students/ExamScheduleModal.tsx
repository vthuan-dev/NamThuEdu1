import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  CalendarClock,
  Plus,
  Trash2,
  MapPin,
  Clock,
  StickyNote,
  GraduationCap,
} from "lucide-react";
import { getApiUrl } from "../../../../utils/apiConfig";
import { getAuthToken } from "../../../../utils/authStorage";
import { useToast } from "../../../../hooks/useToast";

// ─── Types ──────────────────────────────────────────────────────────────────
interface ExamSchedule {
  id: number;
  title: string;
  exam_type: string | null;
  exam_date: string; // YYYY-MM-DD
  exam_time: string | null; // HH:mm
  location: string | null;
  note: string | null;
  days_until: number | null;
  is_urgent: boolean;
}

interface ExamScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  toast?: {
    success: (message: string) => void;
    error: (message: string) => void;
    warning: (message: string) => void;
  };
}

const EXAM_TYPES = [
  { value: "vstep", label: "VSTEP" },
  { value: "ielts", label: "IELTS" },
  { value: "thpt", label: "THPT" },
  { value: "cambridge", label: "Cambridge" },
  { value: "other", label: "Khác" },
];

const emptyForm = {
  title: "",
  exam_type: "vstep",
  exam_date: "",
  exam_time: "",
  location: "",
  note: "",
};

function formatVnDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

/**
 * ExamScheduleModal — giáo viên đặt lịch thi / lịch trình ôn luyện cho học viên.
 * Mỗi học viên có thể có nhiều lịch. Học viên sẽ thấy popup nhắc nhở khi vào trang học.
 */
export function ExamScheduleModal({ isOpen, onClose, student, toast: toastProp }: ExamScheduleModalProps) {
  const localToast = useToast();
  const toast = toastProp || {
    success: localToast.success,
    error: localToast.error,
    warning: localToast.warning,
  };

  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const studentId = student?.id;

  const fetchSchedules = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(getApiUrl(`teacher/students/${studentId}/exam-schedules`), {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (res.ok) {
        const result = await res.json();
        setSchedules(Array.isArray(result.data) ? result.data : []);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (isOpen && studentId) {
      setForm(emptyForm);
      fetchSchedules();
    }
  }, [isOpen, studentId, fetchSchedules]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.warning("Vui lòng nhập tên kỳ thi.");
      return;
    }
    if (!form.exam_date) {
      toast.warning("Vui lòng chọn ngày thi.");
      return;
    }

    setSaving(true);
    try {
      const token = getAuthToken();
      const res = await fetch(getApiUrl(`teacher/students/${studentId}/exam-schedules`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          exam_type: form.exam_type,
          exam_date: form.exam_date,
          exam_time: form.exam_time || null,
          location: form.location.trim() || null,
          note: form.note.trim() || null,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setSchedules((prev) =>
          [...prev, result.data].sort((a, b) => a.exam_date.localeCompare(b.exam_date))
        );
        setForm(emptyForm);
        toast.success("Đã thêm lịch thi cho học viên.");
        import("../../../../services/teacherActivityLog").then(({ logTeacherActivity }) => {
          logTeacherActivity({
            action: "student.exam_schedule.create",
            entity_type: "student",
            entity_id: studentId,
            detail: `Đặt lịch thi "${form.title}" cho ${student?.name}`,
            meta: { exam_date: form.exam_date, exam_type: form.exam_type },
          });
        });
      } else {
        const err = await res.json();
        toast.error(err.message || "Không thể thêm lịch thi.");
      }
    } catch {
      toast.error("Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = getAuthToken();
      const res = await fetch(getApiUrl(`teacher/exam-schedules/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (res.ok) {
        setSchedules((prev) => prev.filter((s) => s.id !== id));
        toast.success("Đã xóa lịch thi.");
      } else {
        toast.error("Không thể xóa lịch thi.");
      }
    } catch {
      toast.error("Có lỗi xảy ra. Vui lòng thử lại.");
    }
  };

  const inputCls =
    "w-full h-9 px-3 text-[13px] rounded-lg border border-slate-200 bg-white text-slate-800 " +
    "placeholder:text-slate-400 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            initial={{ scale: 0.96, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 12, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-sm shadow-orange-500/20">
                  <CalendarClock className="w-5 h-5 text-white" />
                </div>
                <div className="leading-tight">
                  <h3 className="text-[15px] font-bold text-slate-900">Lịch thi của học viên</h3>
                  <p className="text-[12px] text-slate-500">{student?.name}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Add form */}
              <form onSubmit={handleAdd} className="space-y-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1">
                    Tên kỳ thi <span className="text-orange-500">*</span>
                  </label>
                  <input
                    className={inputCls}
                    placeholder="VD: Thi VSTEP B2"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-600 mb-1">Loại</label>
                    <select
                      className={inputCls}
                      value={form.exam_type}
                      onChange={(e) => setForm({ ...form, exam_type: e.target.value })}
                    >
                      {EXAM_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-600 mb-1">
                      Ngày thi <span className="text-orange-500">*</span>
                    </label>
                    <input
                      type="date"
                      className={inputCls}
                      value={form.exam_date}
                      onChange={(e) => setForm({ ...form, exam_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-600 mb-1">Giờ thi</label>
                    <input
                      type="time"
                      className={inputCls}
                      value={form.exam_time}
                      onChange={(e) => setForm({ ...form, exam_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-600 mb-1">Địa điểm</label>
                    <input
                      className={inputCls}
                      placeholder="VD: Hội đồng thi ĐH Cần Thơ"
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1">Ghi chú / lời nhắn</label>
                  <textarea
                    rows={2}
                    className={inputCls.replace("h-9", "h-auto py-2") + " resize-none"}
                    placeholder="VD: Cố gắng ôn luyện kỹ phần Listening nhé!"
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full h-10 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[13px] font-semibold flex items-center justify-center gap-2 hover:from-orange-600 hover:to-amber-600 transition disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Thêm lịch thi
                </button>
              </form>

              {/* Existing list */}
              <div>
                <p className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 mb-2">
                  Lịch đã đặt ({schedules.length})
                </p>

                {loading ? (
                  <div className="flex items-center justify-center py-8 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : schedules.length === 0 ? (
                  <div className="text-center py-6 text-[13px] text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    Chưa có lịch thi nào.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {schedules.map((s) => (
                      <li
                        key={s.id}
                        className="group flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-orange-200 transition"
                      >
                        <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <GraduationCap className="w-[18px] h-[18px] text-orange-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[13.5px] font-semibold text-slate-900 truncate">{s.title}</p>
                            {s.is_urgent && (
                              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                Sắp thi
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <CalendarClock className="w-3.5 h-3.5" />
                            {formatVnDate(s.exam_date)}
                            {s.exam_time && (
                              <>
                                <span className="text-slate-300">·</span>
                                <Clock className="w-3.5 h-3.5" />
                                {s.exam_time}
                              </>
                            )}
                            {s.days_until != null && s.days_until >= 0 && (
                              <span className="text-orange-600 font-medium">
                                · còn {s.days_until} ngày
                              </span>
                            )}
                          </p>
                          {s.location && (
                            <p className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5" /> {s.location}
                            </p>
                          )}
                          {s.note && (
                            <p className="text-[12px] text-slate-600 mt-1 flex items-start gap-1.5">
                              <StickyNote className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                              <span className="italic">{s.note}</span>
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="w-8 h-8 rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition flex items-center justify-center flex-shrink-0"
                          title="Xóa lịch thi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

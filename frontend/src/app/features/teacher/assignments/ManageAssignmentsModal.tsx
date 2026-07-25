import { useEffect, useState } from "react";
import {
  X, Loader2, CalendarClock, CalendarCheck, Bell, Pencil, Trash2, Save, Users, UserRound,
} from "lucide-react";
import { api } from "../../../../services/api";
import { useToastContext } from "../../../../contexts/ToastContext";

interface ExistingAssignment {
  taId: number;
  taTarget_type: "class" | "student";
  taTarget_id: number;
  target_name?: string;
  taDeadline?: string | null;
  taStart_time?: string | null;
  taMax_attempt?: number | null;
  taNotify_before_minutes?: number | null;
  taInstructions?: string | null;
  completion_rate?: number;
  total_students?: number;
  completed_students?: number;
}

interface Props {
  open: boolean;
  examId: number;
  examTitle: string;
  onClose: () => void;
}

const NOTIFY_PRESETS = [
  { value: 0, label: "Không" },
  { value: 15, label: "15 phút" },
  { value: 30, label: "30 phút" },
  { value: 60, label: "1 giờ" },
  { value: 1440, label: "1 ngày" },
];

/** ISO/‘Y-m-d H:i:s’ → giá trị cho input datetime-local (giờ local, không giây). */
function toLocalInput(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local → ‘Y-m-d H:i:s’ cho backend (validate:date). */
function toBackend(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

/**
 * ManageAssignmentsModal — Xem & chỉnh sửa các lần đã giao của MỘT đề.
 * Sửa được: mở làm bài, hạn chót, số lần làm, nhắc trước, hướng dẫn. Xóa được phân công.
 * Gọi PUT/DELETE /teacher/assignments/{id}.
 */
export function ManageAssignmentsModal({ open, examId, examTitle, onClose }: Props) {
  const toast = useToastContext();
  const [items, setItems] = useState<ExistingAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Form state cho dòng đang sửa
  const [fStart, setFStart] = useState("");
  const [fDeadline, setFDeadline] = useState("");
  const [fMaxAttempt, setFMaxAttempt] = useState(1);
  const [fNotify, setFNotify] = useState(30);
  const [fInstructions, setFInstructions] = useState("");

  const load = () => {
    setLoading(true);
    api.get(`/teacher/assignments?exam_id=${examId}`)
      .then((res: any) => {
        const raw = res?.data?.data ?? res?.data ?? [];
        setItems(Array.isArray(raw) ? raw : []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    setEditingId(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, examId]);

  const startEdit = (a: ExistingAssignment) => {
    setEditingId(a.taId);
    setFStart(toLocalInput(a.taStart_time));
    setFDeadline(toLocalInput(a.taDeadline));
    setFMaxAttempt(a.taMax_attempt ?? 1);
    setFNotify(a.taNotify_before_minutes ?? 0);
    setFInstructions(a.taInstructions ?? "");
  };

  const save = async (id: number) => {
    if (fStart && fDeadline && new Date(fDeadline).getTime() <= new Date(fStart).getTime()) {
      toast.warning("Hạn chót phải sau thời điểm mở làm bài.");
      return;
    }
    setSavingId(id);
    try {
      await api.put(`/teacher/assignments/${id}`, {
        taStart_time: toBackend(fStart),
        taDeadline: toBackend(fDeadline),
        taMax_attempt: fMaxAttempt,
        taNotify_before_minutes: fNotify || 0,
        taInstructions: fInstructions || null,
      });
      toast.success("Đã cập nhật yêu cầu bài giao.");
      setEditingId(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Cập nhật thất bại.");
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Xóa phân công này? Học viên sẽ không còn thấy bài giao (bài đã nộp vẫn giữ).")) return;
    setDeletingId(id);
    try {
      await api.delete(`/teacher/assignments/${id}`);
      toast.success("Đã xóa phân công.");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Xóa thất bại.");
    } finally {
      setDeletingId(null);
    }
  };

  if (!open) return null;

  const labelCls = "text-[12px] font-medium text-slate-600";
  const inputCls =
    "w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl ring-1 ring-slate-200 w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-slate-900">Các lần đã giao đề này</h2>
            <p className="text-xs text-slate-500 truncate">{examTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">
              Đề này chưa được giao cho ai.
            </div>
          ) : (
            items.map((a) => {
              const isEditing = editingId === a.taId;
              return (
                <div key={a.taId} className="rounded-xl border border-slate-200 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        {a.taTarget_type === "class" ? <Users className="w-4 h-4" /> : <UserRound className="w-4 h-4" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {a.target_name ?? (a.taTarget_type === "class" ? `Lớp #${a.taTarget_id}` : `HV #${a.taTarget_id}`)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {a.completed_students ?? 0}/{a.total_students ?? 0} đã nộp
                          {a.taMax_attempt ? ` · ${a.taMax_attempt} lượt` : ""}
                        </p>
                      </div>
                    </div>
                    {!isEditing && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => startEdit(a)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Sửa
                        </button>
                        <button
                          onClick={() => remove(a.taId)}
                          disabled={deletingId === a.taId}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 transition-colors"
                        >
                          {deletingId === a.taId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Xóa
                        </button>
                      </div>
                    )}
                  </div>

                  {!isEditing ? (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" /> Mở: {a.taStart_time ? new Date(a.taStart_time.replace(" ", "T")).toLocaleString("vi-VN") : "ngay"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarCheck className="w-3 h-3" /> Hạn: {a.taDeadline ? new Date(a.taDeadline.replace(" ", "T")).toLocaleString("vi-VN") : "—"}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className={`${labelCls} flex items-center gap-1.5`}><CalendarClock className="w-3.5 h-3.5 text-indigo-500" /> Mở làm bài</label>
                          <input type="datetime-local" value={fStart} onChange={(e) => setFStart(e.target.value)} className={inputCls} />
                        </div>
                        <div className="space-y-1">
                          <label className={`${labelCls} flex items-center gap-1.5`}><CalendarCheck className="w-3.5 h-3.5 text-indigo-500" /> Hạn chót</label>
                          <input type="datetime-local" value={fDeadline} onChange={(e) => setFDeadline(e.target.value)} className={inputCls} />
                        </div>
                        <div className="space-y-1">
                          <label className={labelCls}>Số lần làm</label>
                          <input type="number" min={1} value={fMaxAttempt} onChange={(e) => setFMaxAttempt(Math.max(1, Number(e.target.value) || 1))} className={inputCls} />
                        </div>
                        <div className="space-y-1">
                          <label className={`${labelCls} flex items-center gap-1.5`}><Bell className="w-3.5 h-3.5 text-indigo-500" /> Nhắc trước</label>
                          <select value={fNotify} onChange={(e) => setFNotify(Number(e.target.value))} className={inputCls}>
                            {NOTIFY_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className={labelCls}>Hướng dẫn</label>
                        <textarea value={fInstructions} onChange={(e) => setFInstructions(e.target.value)} rows={2} className={inputCls} placeholder="Lời nhắn cho học viên..." />
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors">Hủy</button>
                        <button
                          onClick={() => save(a.taId)}
                          disabled={savingId === a.taId || !fDeadline}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                          {savingId === a.taId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Lưu
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

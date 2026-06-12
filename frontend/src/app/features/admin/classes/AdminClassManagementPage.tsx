/**
 * AdminClassManagementPage — "Quản lý lớp" (thay cho "Bàn giao lớp").
 *
 * Admin xem toàn bộ lớp trong hệ thống: chủ lớp, người đồng quản lý (co-teacher),
 * thành viên (học viên), trạng thái; và thực hiện: đổi GV phụ trách, gỡ học viên,
 * xóa lớp. Tab thứ 2 nhúng lại trang xử lý yêu cầu bàn giao & xóa lớp từ giáo viên.
 *
 * Theme: admin slate + amber accent (#F59E0B). Minimal, SVG icon (lucide).
 */
import { useEffect, useMemo, useState } from "react";
import {
  Loader2, Search, GraduationCap, Users, Trash2, Eye, UserCog,
  X, ShieldCheck, Inbox, RefreshCw, CheckCircle2, AlertTriangle,
} from "lucide-react";
import {
  adminApi,
  type AdminClassAssignment,
  type AdminClassDetail,
  type AdminAssignmentTeacher,
} from "../../../../services/adminApi";
import { getFullMediaUrl } from "../../../../utils/mediaUtils";
import { useToastContext } from "../../../../contexts/ToastContext";
import { AdminHandoverPage } from "../handover/AdminHandoverPage";

const AMBER = "#F59E0B";

function initials(name?: string | null) {
  return (name || "?").trim().split(/\s+/).slice(-2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";
}

function Avatar({ name, url, size = 36 }: { name?: string | null; url?: string | null; size?: number }) {
  const src = getFullMediaUrl(url);
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img src={src} alt={name || ""} onError={() => setFailed(true)}
        className="rounded-full object-cover ring-1 ring-slate-200 flex-shrink-0"
        style={{ width: size, height: size }} />
    );
  }
  return (
    <div className="rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
      style={{ width: size, height: size, background: "linear-gradient(135deg,#F59E0B,#D97706)" }}>
      {initials(name)}
    </div>
  );
}

export function AdminClassManagementPage() {
  const toast = useToastContext();
  const [tab, setTab] = useState<"classes" | "requests">("classes");

  const [classes, setClasses] = useState<AdminClassAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [detailId, setDetailId] = useState<number | null>(null);
  const [reassign, setReassign] = useState<AdminClassAssignment | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getTeacherClassAssignments();
      setClasses(res || []);
    } catch {
      toast.error("Không tải được danh sách lớp.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return classes.filter((c) => {
      if (statusFilter !== "all" && c.class_status !== statusFilter) return false;
      if (!q) return true;
      return (
        (c.class_name || "").toLowerCase().includes(q) ||
        (c.teacher?.name || "").toLowerCase().includes(q) ||
        (c.course?.name || "").toLowerCase().includes(q)
      );
    });
  }, [classes, search, statusFilter]);

  const stats = useMemo(() => {
    const total = classes.length;
    const active = classes.filter((c) => c.class_status === "active").length;
    const students = classes.reduce((s, c) => s + (c.student_count || 0), 0);
    return { total, active, students };
  }, [classes]);

  const handleDelete = async (c: AdminClassAssignment) => {
    if (!window.confirm(`Xóa lớp "${c.class_name}"?\n\nToàn bộ học viên sẽ bị gỡ khỏi lớp (tài khoản học viên vẫn giữ). Thao tác KHÔNG thể hoàn tác.`)) return;
    try {
      await adminApi.deleteClass(c.class_id);
      toast.success(`Đã xóa lớp "${c.class_name}".`);
      setClasses((prev) => prev.filter((x) => x.class_id !== c.class_id));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Xóa lớp thất bại.");
    }
  };

  return (
    <div className="p-6 sm:p-8 min-h-screen bg-slate-50">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
          style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)" }}>
          <GraduationCap className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Quản lý lớp học</h1>
          <p className="text-sm text-slate-500">Xem toàn bộ lớp, thành viên, người quản lý — đổi GV, gỡ học viên, xóa lớp</p>
        </div>
        <button onClick={load}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors">
          <RefreshCw className="w-4 h-4" /> Làm mới
        </button>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <StatTile icon={GraduationCap} label="Tổng số lớp" value={stats.total} tint="amber" />
        <StatTile icon={CheckCircle2} label="Đang hoạt động" value={stats.active} tint="emerald" />
        <StatTile icon={Users} label="Tổng học viên" value={stats.students} tint="blue" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <TabBtn active={tab === "classes"} onClick={() => setTab("classes")} icon={GraduationCap} label="Danh sách lớp" />
        <TabBtn active={tab === "requests"} onClick={() => setTab("requests")} icon={Inbox} label="Yêu cầu bàn giao & xóa" />
      </div>

      {tab === "requests" ? (
        <div className="-mx-6 sm:-mx-8 -mb-6 sm:-mb-8">
          <AdminHandoverPage />
        </div>
      ) : (
        <>
          {/* Filter row */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên lớp, giáo viên, khóa học..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-shadow" />
            </div>
            <div className="flex gap-2">
              {(["all", "active", "inactive"] as const).map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors ${statusFilter === s ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"}`}>
                  {s === "all" ? "Tất cả" : s === "active" ? "Hoạt động" : "Ngừng"}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-50 rounded-full mb-4 ring-1 ring-slate-100">
                <GraduationCap className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">Không có lớp nào khớp bộ lọc.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                      <th className="text-left font-semibold px-5 py-3">Lớp học</th>
                      <th className="text-left font-semibold px-5 py-3">GV phụ trách</th>
                      <th className="text-center font-semibold px-5 py-3">Học viên</th>
                      <th className="text-center font-semibold px-5 py-3">Trạng thái</th>
                      <th className="text-right font-semibold px-5 py-3">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((c) => (
                      <tr key={c.class_id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-900">{c.class_name}</p>
                          {c.course?.name && <p className="text-xs text-slate-400 mt-0.5">{c.course.name}</p>}
                        </td>
                        <td className="px-5 py-3">
                          {c.teacher ? (
                            <div className="flex items-center gap-2">
                              <Avatar name={c.teacher.name} size={28} />
                              <div className="min-w-0">
                                <p className="text-slate-700 font-medium truncate">{c.teacher.name}</p>
                                <p className="text-xs text-slate-400">{c.teacher.phone}</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Chưa phân công</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className="inline-flex items-center gap-1 text-slate-700 font-semibold tabular-nums">
                            <Users className="w-3.5 h-3.5 text-slate-400" /> {c.student_count}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${c.class_status === "active" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>
                            {c.class_status === "active" ? "Hoạt động" : "Ngừng"}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <IconBtn title="Xem chi tiết" onClick={() => setDetailId(c.class_id)} icon={Eye} />
                            <IconBtn title="Đổi GV phụ trách" onClick={() => setReassign(c)} icon={UserCog} />
                            <IconBtn title="Xóa lớp" onClick={() => handleDelete(c)} icon={Trash2} danger />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {detailId !== null && (
        <ClassDetailModal classId={detailId} onClose={() => setDetailId(null)} onChanged={load} />
      )}
      {reassign && (
        <ReassignModal cls={reassign} onClose={() => setReassign(null)} onDone={() => { setReassign(null); load(); }} />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${active ? "bg-slate-800 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"}`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

function StatTile({ icon: Icon, label, value, tint }: { icon: any; label: string; value: number; tint: "amber" | "emerald" | "blue" }) {
  const cls = tint === "amber" ? "bg-amber-50 text-amber-600 ring-amber-100"
    : tint === "emerald" ? "bg-emerald-50 text-emerald-600 ring-emerald-100"
    : "bg-blue-50 text-blue-600 ring-blue-100";
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`hidden sm:flex w-10 h-10 rounded-xl items-center justify-center ring-1 ${cls}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{value}</p>
        <p className="text-xs text-slate-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

function IconBtn({ title, onClick, icon: Icon, danger }: { title: string; onClick: () => void; icon: any; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${danger ? "text-slate-400 hover:bg-red-50 hover:text-red-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`}>
      <Icon className="w-4 h-4" />
    </button>
  );
}

// ─── Chi tiết lớp: thành viên + người quản lý ───────────────────────────────
function ClassDetailModal({ classId, onClose, onChanged }: { classId: number; onClose: () => void; onChanged: () => void }) {
  const toast = useToastContext();
  const [data, setData] = useState<AdminClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyStudent, setBusyStudent] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setData(await adminApi.getClassDetail(classId));
    } catch {
      toast.error("Không tải được chi tiết lớp.");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [classId]);

  const removeStudent = async (sid: number, name: string) => {
    if (!window.confirm(`Gỡ học viên "${name}" khỏi lớp? (Tài khoản học viên vẫn giữ)`)) return;
    setBusyStudent(sid);
    try {
      await adminApi.removeStudentFromClass(classId, sid);
      toast.success(`Đã gỡ ${name} khỏi lớp.`);
      setData((d) => d ? { ...d, students: d.students.filter((s) => s.id !== sid), student_count: d.student_count - 1 } : d);
      onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Thao tác thất bại.");
    } finally { setBusyStudent(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl ring-1 ring-black/5 max-h-[88vh] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 truncate">{data?.class_name || "Chi tiết lớp"}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {data?.course?.name ? `${data.course.name} · ` : ""}{data?.student_count ?? 0} học viên
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading || !data ? (
          <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" /></div>
        ) : (
          <div className="px-6 py-5 overflow-y-auto space-y-6">
            {data.pending_request && (
              <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-amber-50 ring-1 ring-amber-200 text-amber-800 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Lớp đang có yêu cầu <b>{data.pending_request.type === "deletion" ? "xóa lớp" : "bàn giao"}</b> chờ xử lý.</span>
              </div>
            )}

            {/* Người quản lý */}
            <section>
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 mb-2.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Người quản lý lớp
              </h3>
              <div className="space-y-2">
                {/* Chủ lớp */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/60 ring-1 ring-amber-100">
                  <Avatar name={data.teacher?.name} url={data.teacher?.avatar_url} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{data.teacher?.name || "Chưa phân công"}</p>
                    <p className="text-xs text-slate-400">{data.teacher?.phone || "—"}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white">Chủ lớp</span>
                </div>
                {/* Co-teachers */}
                {data.co_teachers.map((co) => (
                  <div key={co.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 ring-1 ring-slate-100">
                    <Avatar name={co.teacher?.name} url={co.teacher?.avatar_url} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-700 truncate">{co.teacher?.name || `#${co.id}`}</p>
                      <p className="text-xs text-slate-400">{co.teacher?.phone || "—"}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${co.status === "accepted" ? "bg-teal-50 text-teal-700 ring-teal-200" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>
                      {co.status === "accepted" ? "Đồng quản lý" : "Đang mời"}
                    </span>
                  </div>
                ))}
                {data.co_teachers.length === 0 && (
                  <p className="text-xs text-slate-400 italic px-1">Không có giáo viên đồng quản lý.</p>
                )}
              </div>
            </section>

            {/* Thành viên */}
            <section>
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 mb-2.5">
                <Users className="w-3.5 h-3.5" /> Học viên ({data.students.length})
              </h3>
              {data.students.length === 0 ? (
                <p className="text-xs text-slate-400 italic px-1">Lớp chưa có học viên.</p>
              ) : (
                <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                  {data.students.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors">
                      <Avatar name={s.name} url={s.avatar_url} size={32} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{s.name}</p>
                        <p className="text-xs text-slate-400">{s.phone}</p>
                      </div>
                      {s.age_group && (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{s.age_group}</span>
                      )}
                      <button title="Gỡ khỏi lớp" onClick={() => removeStudent(s.id, s.name)} disabled={busyStudent === s.id}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50">
                        {busyStudent === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Đổi giáo viên phụ trách ────────────────────────────────────────────────
function ReassignModal({ cls, onClose, onDone }: { cls: AdminClassAssignment; onClose: () => void; onDone: () => void }) {
  const toast = useToastContext();
  const [teachers, setTeachers] = useState<AdminAssignmentTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setTeachers(await adminApi.getTeacherAssignmentCandidates());
      } catch {
        toast.error("Không tải được danh sách giáo viên.");
      } finally { setLoading(false); }
    })();
    /* eslint-disable-next-line */
  }, []);

  const filtered = useMemo(
    () => teachers.filter((t) => t.id !== cls.teacher?.id && (t.name || "").toLowerCase().includes(search.toLowerCase())),
    [teachers, search, cls.teacher?.id]
  );

  const submit = async () => {
    if (!selected) { toast.error("Chọn giáo viên phụ trách."); return; }
    setBusy(true);
    try {
      await adminApi.reassignClassTeacher(cls.class_id, selected);
      toast.success("Đã đổi giáo viên phụ trách lớp.");
      onDone();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Thao tác thất bại.");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl ring-1 ring-black/5 max-h-[85vh] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Đổi giáo viên phụ trách</h2>
            <p className="text-xs text-slate-500 mt-0.5">Lớp: <span className="font-semibold text-slate-700">{cls.class_name}</span></p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 flex-1 overflow-hidden flex flex-col">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm giáo viên..."
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-shadow" />
          </div>
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
            {loading ? (
              <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>
            ) : filtered.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">Không có giáo viên phù hợp.</p>
            ) : filtered.map((t, i) => {
              const picked = selected === t.id;
              return (
                <button key={t.id} onClick={() => setSelected(t.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${picked ? "bg-amber-50" : "hover:bg-slate-50"} ${i > 0 ? "border-t border-slate-100" : ""}`}>
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-200 text-slate-600 text-xs font-bold shrink-0">{initials(t.name)}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-800 truncate">{t.name}</span>
                    <span className="block text-xs text-slate-400">{t.assigned_classes} lớp đang phụ trách</span>
                  </span>
                  {picked && <CheckCircle2 className="w-5 h-5 text-amber-600" />}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Hủy</button>
          <button onClick={submit} disabled={!selected || busy}
            className="flex-1 px-4 py-2.5 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)" }}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Xác nhận đổi
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminClassManagementPage;

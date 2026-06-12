import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, Users, FileText, Megaphone, Target, ArrowRightLeft,
  Loader2, AlertCircle, Trash2, Plus, X, UserPlus,
} from "lucide-react";
import {
  classMgmtApi, ClassItem, ClassStudent, ClassAnnouncement, ClassGoal, ClassAssignmentRow,
} from "../../../../services/classMgmtApi";
import { useToastContext } from "../../../../contexts/ToastContext";

type TabKey = "roster" | "assignments" | "announcements" | "goals";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "roster", label: "Học viên", icon: Users },
  { key: "assignments", label: "Giao đề", icon: FileText },
  { key: "announcements", label: "Thông báo", icon: Megaphone },
  { key: "goals", label: "Mục tiêu", icon: Target },
];

export function ClassDetail() {
  const { id } = useParams();
  const classId = Number(id);
  const navigate = useNavigate();
  const toast = useToastContext();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cls, setCls] = useState<ClassItem | null>(null);
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [announcements, setAnnouncements] = useState<ClassAnnouncement[]>([]);
  const [goals, setGoals] = useState<ClassGoal[]>([]);
  const [assignments, setAssignments] = useState<ClassAssignmentRow[]>([]);
  const [pendingHandover, setPendingHandover] = useState<any>(null);
  const [tab, setTab] = useState<TabKey>("roster");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await classMgmtApi.get(classId);
      const d = res.data;
      setCls(d.class);
      setStudents(d.students || []);
      setAnnouncements(d.announcements || []);
      setGoals(d.goals || []);
      setAssignments(d.assignments || []);
      setPendingHandover(d.pending_handover || null);
    } catch (e: any) {
      setError(e?.response?.status === 404 ? "Không tìm thấy lớp học." : "Không thể tải lớp. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="p-8 min-h-screen flex items-center justify-center bg-[#F9FAFB]"><Loader2 className="w-10 h-10 text-[#0D9488] animate-spin" /></div>;
  }
  if (error || !cls) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="text-center bg-white rounded-2xl p-8 border border-red-200">
          <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-3" />
          <p className="text-red-600 font-semibold mb-4">{error}</p>
          <button onClick={() => navigate("/giao-vien/lop-hoc")} className="px-6 py-2 bg-[#0D9488] text-white rounded-xl">Về danh sách lớp</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen bg-[#F9FAFB]">
      <button onClick={() => navigate("/giao-vien/lop-hoc")} className="flex items-center gap-2 text-[#6B7280] hover:text-[#111827] mb-4">
        <ArrowLeft className="w-4 h-4" /> Danh sách lớp
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">{cls.cName}</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            {students.length} học viên · Độ tuổi {cls.age_group}
          </p>
          {pendingHandover && (
            <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
              <ArrowRightLeft className="w-3 h-3" /> Đang chờ admin bàn giao
            </span>
          )}
        </div>
        <HandoverButton classId={classId} pending={!!pendingHandover} onChanged={load} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#E5E7EB] mb-6">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all focus:outline-none focus:ring-2 focus:ring-[#0D9488] rounded-t ${active ? "border-[#0D9488] text-[#0D9488]" : "border-transparent text-[#6B7280] hover:text-[#111827]"}`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "roster" && <RosterTab classId={classId} students={students} onChanged={load} toast={toast} />}
      {tab === "assignments" && <AssignmentsTab assignments={assignments} />}
      {tab === "announcements" && <AnnouncementsTab classId={classId} items={announcements} onChanged={load} toast={toast} />}
      {tab === "goals" && <GoalsTab classId={classId} items={goals} onChanged={load} toast={toast} />}
    </div>
  );
}

// ─── Handover button ──────────────────────────────────────────
function HandoverButton({ classId, pending, onChanged }: { classId: number; pending: boolean; onChanged: () => void }) {
  const toast = useToastContext();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await classMgmtApi.requestHandover(classId, reason);
      toast.success("Đã gửi yêu cầu bàn giao tới admin.");
      setOpen(false); setReason(""); onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Không gửi được yêu cầu.");
    } finally { setBusy(false); }
  };

  const cancel = async () => {
    if (!window.confirm("Hủy yêu cầu bàn giao đang chờ?")) return;
    try {
      await classMgmtApi.cancelHandover(classId);
      toast.success("Đã hủy yêu cầu bàn giao.");
      onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Không hủy được.");
    }
  };

  if (pending) {
    return <button onClick={cancel} className="px-4 py-2.5 border border-amber-300 text-amber-700 rounded-xl font-semibold hover:bg-amber-50">Hủy yêu cầu bàn giao</button>;
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2.5 border border-[#E5E7EB] text-[#374151] rounded-xl font-semibold hover:bg-gray-50">
        <ArrowRightLeft className="w-4 h-4" /> Xin bàn giao lớp
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Xin bàn giao lớp</h2>
              <button onClick={() => setOpen(false)} aria-label="Đóng"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-[#6B7280] mb-3">Yêu cầu sẽ được gửi tới admin để chỉ định giáo viên tiếp nhận.</p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Lý do (không bắt buộc)"
              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]" />
            <div className="flex gap-3 mt-5">
              <button onClick={() => setOpen(false)} className="flex-1 px-4 py-2.5 border border-[#E5E7EB] rounded-xl font-semibold hover:bg-gray-50">Hủy</button>
              <button onClick={submit} disabled={busy} className="flex-1 px-4 py-2.5 bg-[#0D9488] text-white rounded-xl font-semibold hover:bg-[#0F766E] disabled:opacity-60 flex items-center justify-center gap-2">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Gửi yêu cầu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Roster tab ───────────────────────────────────────────────
function RosterTab({ classId, students, onChanged, toast }: any) {
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [available, setAvailable] = useState<any[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [search, setSearch] = useState("");

  const openEnroll = async () => {
    setEnrollOpen(true); setPicked([]); setLoadingAvail(true);
    try {
      const res = await classMgmtApi.availableStudents();
      const list = res?.data?.data || res?.data || [];
      const enrolledIds = new Set(students.map((s: ClassStudent) => s.uId));
      setAvailable((Array.isArray(list) ? list : []).filter((s: any) => !enrolledIds.has(s.uId)));
    } catch {
      toast.error("Không tải được danh sách học viên.");
    } finally { setLoadingAvail(false); }
  };

  const doEnroll = async () => {
    if (picked.length === 0) { toast.error("Chọn ít nhất một học viên."); return; }
    try {
      const res = await classMgmtApi.enroll(classId, picked);
      const errs = res?.data?.errors || [];
      toast.success(`Đã thêm ${res?.data?.enrolled_count ?? 0} học viên.`);
      if (errs.length) toast.warning(errs[0]);
      setEnrollOpen(false); onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Không thêm được học viên.");
    }
  };

  const removeStudent = async (s: ClassStudent) => {
    if (!window.confirm(`Xóa ${s.uName} khỏi lớp?`)) return;
    try {
      await classMgmtApi.removeStudent(classId, s.uId);
      toast.success("Đã xóa học viên khỏi lớp.");
      onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Không xóa được.");
    }
  };

  const filtered = available.filter((s) => (s.uName || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={openEnroll} className="flex items-center gap-2 px-4 py-2.5 bg-[#0D9488] text-white rounded-xl font-semibold hover:bg-[#0F766E]">
          <UserPlus className="w-4 h-4" /> Thêm học viên
        </button>
      </div>
      {students.length === 0 ? (
        <EmptyState icon={Users} text="Lớp chưa có học viên nào." />
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] divide-y">
          {students.map((s: ClassStudent) => (
            <div key={s.uId} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="font-semibold text-[#111827]">{s.uName}</p>
                <p className="text-sm text-[#6B7280]">{s.uPhone}</p>
              </div>
              <button onClick={() => removeStudent(s)} aria-label="Xóa khỏi lớp" className="p-2 hover:bg-red-50 rounded-lg">
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      {enrollOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Thêm học viên vào lớp</h2>
              <button onClick={() => setEnrollOpen(false)} aria-label="Đóng"><X className="w-5 h-5" /></button>
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm học viên..."
              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-xl mb-3 focus:outline-none focus:ring-2 focus:ring-[#0D9488]" />
            <div className="flex-1 overflow-y-auto border border-[#E5E7EB] rounded-xl divide-y">
              {loadingAvail ? (
                <div className="p-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#0D9488]" /></div>
              ) : filtered.length === 0 ? (
                <p className="p-6 text-center text-sm text-[#6B7280]">Không có học viên phù hợp.</p>
              ) : filtered.map((s) => (
                <label key={s.uId} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={picked.includes(s.uId)}
                    onChange={(e) => setPicked(e.target.checked ? [...picked, s.uId] : picked.filter((x) => x !== s.uId))}
                    className="w-4 h-4 text-[#0D9488]" />
                  <span className="flex-1">{s.uName} <span className="text-xs text-[#9CA3AF]">({s.age_group})</span></span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setEnrollOpen(false)} className="flex-1 px-4 py-2.5 border border-[#E5E7EB] rounded-xl font-semibold hover:bg-gray-50">Hủy</button>
              <button onClick={doEnroll} className="flex-1 px-4 py-2.5 bg-[#0D9488] text-white rounded-xl font-semibold hover:bg-[#0F766E]">Thêm ({picked.length})</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Assignments tab ──────────────────────────────────────────
function AssignmentsTab({ assignments }: { assignments: ClassAssignmentRow[] }) {
  if (assignments.length === 0) return <EmptyState icon={FileText} text="Lớp chưa được giao đề nào. Giao đề từ Ngân hàng đề." />;
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] divide-y">
      {assignments.map((a) => (
        <div key={a.taId} className="flex items-center justify-between px-5 py-3">
          <div>
            <p className="font-semibold text-[#111827]">{a.exam_title || `Đề #${a.exam_id}`}</p>
            <p className="text-sm text-[#6B7280]">
              {a.taDeadline ? `Hạn: ${new Date(a.taDeadline).toLocaleDateString("vi-VN")}` : "Không hạn"} · {a.submission_count} bài nộp
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Announcements tab ────────────────────────────────────────
function AnnouncementsTab({ classId, items, onChanged, toast }: any) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("normal");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!title.trim() || !content.trim()) { toast.error("Nhập tiêu đề và nội dung."); return; }
    setBusy(true);
    try {
      await classMgmtApi.createAnnouncement(classId, { title, content, priority });
      toast.success("Đã đăng thông báo.");
      setOpen(false); setTitle(""); setContent(""); setPriority("normal"); onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Không đăng được.");
    } finally { setBusy(false); }
  };

  const remove = async (a: ClassAnnouncement) => {
    if (!window.confirm("Xóa thông báo này?")) return;
    try { await classMgmtApi.deleteAnnouncement(classId, a.id); toast.success("Đã xóa."); onChanged(); }
    catch (e: any) { toast.error(e?.response?.data?.message || "Không xóa được."); }
  };

  const badge = (p: string) => p === "urgent" ? "bg-red-100 text-red-700" : p === "important" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600";

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[#0D9488] text-white rounded-xl font-semibold hover:bg-[#0F766E]">
          <Plus className="w-4 h-4" /> Đăng thông báo
        </button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Megaphone} text="Chưa có thông báo nào." />
      ) : (
        <div className="space-y-3">
          {items.map((a: ClassAnnouncement) => (
            <div key={a.id} className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-[#111827]">{a.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge(a.priority)}`}>{a.priority}</span>
                </div>
                <button onClick={() => remove(a)} aria-label="Xóa thông báo" className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-500" /></button>
              </div>
              <p className="text-sm text-[#374151] whitespace-pre-wrap">{a.content}</p>
              <p className="text-xs text-[#9CA3AF] mt-2">{new Date(a.created_at).toLocaleString("vi-VN")}</p>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Đăng thông báo</h2>
              <button onClick={() => setOpen(false)} aria-label="Đóng"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tiêu đề"
                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]" />
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="Nội dung"
                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]" />
              <select value={priority} onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]">
                <option value="normal">Thường (không đẩy thông báo)</option>
                <option value="important">Quan trọng (đẩy thông báo)</option>
                <option value="urgent">Khẩn (đẩy thông báo)</option>
              </select>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setOpen(false)} className="flex-1 px-4 py-2.5 border border-[#E5E7EB] rounded-xl font-semibold hover:bg-gray-50">Hủy</button>
              <button onClick={create} disabled={busy} className="flex-1 px-4 py-2.5 bg-[#0D9488] text-white rounded-xl font-semibold hover:bg-[#0F766E] disabled:opacity-60 flex items-center justify-center gap-2">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Đăng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Goals tab ────────────────────────────────────────────────
function GoalsTab({ classId, items, onChanged, toast }: any) {
  const [open, setOpen] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [targetLevel, setTargetLevel] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!goalTitle.trim() || !targetDate) { toast.error("Nhập tên mục tiêu và ngày."); return; }
    setBusy(true);
    try {
      await classMgmtApi.createGoal(classId, { goal_title: goalTitle, target_date: targetDate, target_level: targetLevel || undefined });
      toast.success("Đã tạo mục tiêu.");
      setOpen(false); setGoalTitle(""); setTargetDate(""); setTargetLevel(""); onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Không tạo được mục tiêu.");
    } finally { setBusy(false); }
  };

  const remove = async (g: ClassGoal) => {
    if (!window.confirm("Xóa mục tiêu này?")) return;
    try { await classMgmtApi.deleteGoal(classId, g.id); toast.success("Đã xóa."); onChanged(); }
    catch (e: any) { toast.error(e?.response?.data?.message || "Không xóa được."); }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[#0D9488] text-white rounded-xl font-semibold hover:bg-[#0F766E]">
          <Plus className="w-4 h-4" /> Tạo mục tiêu
        </button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Target} text="Chưa có mục tiêu nào. Đặt mục tiêu để nhắc động lực học viên mỗi ngày." />
      ) : (
        <div className="space-y-3">
          {items.map((g: ClassGoal) => {
            const days = Math.ceil((new Date(g.target_date).getTime() - Date.now()) / 86400000);
            return (
              <div key={g.id} className="bg-white rounded-2xl border border-[#E5E7EB] p-5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-[#111827]">{g.goal_title}</h3>
                    {g.target_level && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-700">{g.target_level}</span>}
                    {g.status !== "active" && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">{g.status}</span>}
                  </div>
                  <p className="text-sm text-[#6B7280] mt-1">
                    Ngày mục tiêu: {new Date(g.target_date).toLocaleDateString("vi-VN")}
                    {g.status === "active" && days >= 0 && <span className="text-[#0D9488] font-semibold"> · còn {days} ngày</span>}
                  </p>
                </div>
                <button onClick={() => remove(g)} aria-label="Xóa mục tiêu" className="p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-500" /></button>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Tạo mục tiêu lớp</h2>
              <button onClick={() => setOpen(false)} aria-label="Đóng"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder="VD: Thi VSTEP B2"
                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]" />
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">Ngày mục tiêu</label>
                <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]" />
              </div>
              <input value={targetLevel} onChange={(e) => setTargetLevel(e.target.value)} placeholder="Trình độ mục tiêu (VD: B2) — không bắt buộc"
                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]" />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setOpen(false)} className="flex-1 px-4 py-2.5 border border-[#E5E7EB] rounded-xl font-semibold hover:bg-gray-50">Hủy</button>
              <button onClick={create} disabled={busy} className="flex-1 px-4 py-2.5 bg-[#0D9488] text-white rounded-xl font-semibold hover:bg-[#0F766E] disabled:opacity-60 flex items-center justify-center gap-2">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Tạo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
      <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-100 rounded-full mb-3">
        <Icon className="w-7 h-7 text-gray-400" />
      </div>
      <p className="text-[#6B7280]">{text}</p>
    </div>
  );
}

export default ClassDetail;

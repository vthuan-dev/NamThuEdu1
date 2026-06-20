import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, Users, FileText, Megaphone, Target, ArrowRightLeft,
  Loader2, AlertCircle, Trash2, Plus, UserPlus, Search, Calendar, CheckCircle2, Info,
  UserCog, ShieldCheck, Clock,
} from "lucide-react";
import {
  classMgmtApi, ClassItem, ClassStudent, ClassAnnouncement, ClassGoal, ClassAssignmentRow, CoTeacher, Colleague,
} from "../../../../services/classMgmtApi";
import { useToastContext } from "../../../../contexts/ToastContext";
import {
  ageMeta, Avatar, Modal, Field, inputClass, btnPrimary, btnGhost,
} from "./classMgmtUi";
import { StudentGoalModal } from "./StudentGoalModal";
import { formatVNDate } from "@/utils/dateUtils";

type TabKey = "roster" | "assignments" | "announcements" | "goals" | "coteachers";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "roster", label: "Học viên", icon: Users },
  { key: "assignments", label: "Giao đề", icon: FileText },
  { key: "announcements", label: "Thông báo", icon: Megaphone },
  { key: "goals", label: "Mục tiêu", icon: Target },
  { key: "coteachers", label: "Cộng tác", icon: UserCog },
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
  const [coTeachers, setCoTeachers] = useState<CoTeacher[]>([]);
  const [isOwner, setIsOwner] = useState(true);
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
      setCoTeachers(d.co_teachers || []);
      setIsOwner(d.is_owner !== false);
    } catch (e: any) {
      setError(e?.response?.status === 404 ? "Không tìm thấy lớp học." : "Không thể tải lớp. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="text-center">
          <Loader2 className="w-9 h-9 text-[#0D9488] animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Đang tải lớp học...</p>
        </div>
      </div>
    );
  }
  if (error || !cls) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="text-center bg-white rounded-2xl p-8 border border-red-100 shadow-sm cm-rise">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 font-semibold mb-4">{error}</p>
          <button onClick={() => navigate("/giao-vien/lop-hoc")} className={`${btnPrimary} mx-auto`}>Về danh sách lớp</button>
        </div>
      </div>
    );
  }

  const meta = ageMeta(cls.age_group);

  const counts: Record<TabKey, number> = {
    roster: students.length,
    assignments: assignments.length,
    announcements: announcements.length,
    goals: goals.filter((g) => g.status === "active").length,
    coteachers: coTeachers.filter((c) => c.status === "accepted").length,
  };

  return (
    <div className="p-6 sm:p-8 min-h-screen bg-[#F9FAFB]">
      <button onClick={() => navigate("/giao-vien/lop-hoc")} className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#111827] mb-4 transition-colors group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Danh sách lớp
      </button>

      {/* Class header card — compact */}
      <div className="relative bg-white rounded-2xl border border-[#E5E7EB] shadow-sm pl-5 pr-4 py-3.5 mb-6 cm-rise overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: meta.bar }} />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="hidden sm:flex w-10 h-10 rounded-xl items-center justify-center ring-1 ring-black/5 shrink-0"
              style={{ background: `linear-gradient(135deg, ${meta.bar}1f, ${meta.bar}3d)` }}
            >
              <Users className="w-5 h-5" style={{ color: meta.bar }} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-[#111827] tracking-tight truncate">{cls.cName}</h1>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.pill}`}>{meta.label}</span>
                {pendingHandover && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 cm-dot-pulse" /> Chờ bàn giao
                  </span>
                )}
                {!isOwner && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-[#0F766E] ring-1 ring-teal-200">
                    <UserCog className="w-3 h-3" /> Đồng quản lý
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-[#6B7280] mt-0.5 inline-flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-gray-400" />
                <span><span className="font-semibold text-[#374151] tabular-nums">{students.length}</span>/{cls.max_students} học viên</span>
              </p>
            </div>
          </div>
          {isOwner && <HandoverButton classId={classId} pending={!!pendingHandover} onChanged={load} />}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#E5E7EB] mb-6 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors focus:outline-none ${active ? "text-[#0D9488]" : "text-[#6B7280] hover:text-[#111827]"}`}
            >
              <Icon className="w-4 h-4" /> {t.label}
              {counts[t.key] > 0 && (
                <span className={`ml-0.5 min-w-[20px] px-1.5 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${active ? "bg-teal-50 text-[#0D9488]" : "bg-gray-100 text-gray-500"}`}>
                  {counts[t.key]}
                </span>
              )}
              <span className={`absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-[#0D9488] transition-all duration-300 ${active ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"}`} />
            </button>
          );
        })}
      </div>

      {/* Tab content (re-mounts per tab for a gentle fade-up) */}
      <div key={tab} className="cm-tab-in">
        {tab === "roster" && <RosterTab classId={classId} students={students} max={cls.max_students} ageGroup={cls.age_group} onChanged={load} toast={toast} />}
        {tab === "assignments" && <AssignmentsTab assignments={assignments} />}
        {tab === "announcements" && <AnnouncementsTab classId={classId} items={announcements} onChanged={load} toast={toast} />}
        {tab === "goals" && <GoalsTab classId={classId} items={goals} onChanged={load} toast={toast} />}
        {tab === "coteachers" && <CoTeachersTab classId={classId} items={coTeachers} isOwner={isOwner} onChanged={load} toast={toast} />}
      </div>
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
    return (
      <button onClick={cancel} className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-amber-300 text-amber-700 rounded-xl font-semibold hover:bg-amber-50 active:scale-[0.98] transition-all">
        Hủy yêu cầu bàn giao
      </button>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={`${btnGhost} shrink-0`}>
        <ArrowRightLeft className="w-4 h-4" /> Xin bàn giao lớp
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Xin bàn giao lớp"
        footer={
          <>
            <button onClick={() => setOpen(false)} className={`${btnGhost} flex-1`}>Hủy</button>
            <button onClick={submit} disabled={busy} className={`${btnPrimary} flex-1`}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Gửi yêu cầu
            </button>
          </>
        }
      >
        <div className="text-center mb-5">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-50 to-white ring-1 ring-amber-100 flex items-center justify-center mb-3">
            <ArrowRightLeft className="w-7 h-7 text-amber-600" />
          </div>
          <p className="text-sm text-[#374151] leading-relaxed max-w-sm mx-auto">
            Yêu cầu sẽ được gửi tới <span className="font-semibold text-[#111827]">admin</span> để chỉ định giáo viên tiếp nhận.
            Bạn vẫn quản lý lớp bình thường cho đến khi admin duyệt.
          </p>
        </div>
        <Field label="Lý do bàn giao" hint="Không bắt buộc — nêu lý do giúp admin xử lý nhanh hơn.">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="VD: Chuyển công tác, thay đổi lịch dạy..."
            className={`${inputClass} resize-none`} />
        </Field>
      </Modal>
    </>
  );
}

// ─── Roster tab ───────────────────────────────────────────────
function RosterTab({ classId, students, max, ageGroup, onChanged, toast }: any) {
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [available, setAvailable] = useState<any[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [search, setSearch] = useState("");
  const [goalStudent, setGoalStudent] = useState<{ id: number; name: string } | null>(null);
  const classMeta = ageMeta(ageGroup);

  const openEnroll = async () => {
    setEnrollOpen(true); setPicked([]); setSearch(""); setLoadingAvail(true);
    try {
      const res = await classMgmtApi.availableStudents();
      const list = res?.data?.data || res?.data || [];
      const enrolledIds = new Set(students.map((s: ClassStudent) => s.uId));
      // Một lớp chỉ gồm học viên cùng độ tuổi với lớp — không trộn 2 nhóm role.
      setAvailable(
        (Array.isArray(list) ? list : []).filter(
          (s: any) => !enrolledIds.has(s.uId) && (!ageGroup || s.age_group === ageGroup)
        )
      );
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
  const isFull = students.length >= max;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-[#6B7280]">
          {students.length > 0 ? `${students.length} học viên trong lớp` : ""}
        </p>
        <button onClick={openEnroll} disabled={isFull} className={`${btnPrimary} ${isFull ? "" : ""}`} title={isFull ? "Lớp đã đầy" : ""}>
          <UserPlus className="w-4 h-4" /> Thêm học viên
        </button>
      </div>

      {students.length === 0 ? (
        <EmptyState icon={Users} title="Lớp chưa có học viên" text="Thêm học viên để bắt đầu giao đề và theo dõi tiến độ." />
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
          {students.map((s: ClassStudent, i: number) => (
            <div key={s.uId} className={`flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-gray-50/70 transition-colors ${i > 0 ? "border-t border-gray-100" : ""}`}>
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={s.uName} src={s.avatar_url} />
                <div className="min-w-0">
                  <p className="font-semibold text-[#111827] truncate">{s.uName}</p>
                  <p className="text-sm text-[#6B7280]">{s.uPhone || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setGoalStudent({ id: s.uId, name: s.uName })}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 ring-1 ring-violet-100 transition-colors"
                  title="Đặt mục tiêu & phân tích AI"
                >
                  <Target className="w-3.5 h-3.5" /> Mục tiêu
                </button>
                <button onClick={() => removeStudent(s)} aria-label="Xóa khỏi lớp" className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {goalStudent && (
        <StudentGoalModal
          studentId={goalStudent.id}
          studentName={goalStudent.name}
          open={!!goalStudent}
          onClose={() => setGoalStudent(null)}
        />
      )}

      <Modal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        title="Thêm học viên vào lớp"
        maxWidth="max-w-lg"
        footer={
          <>
            <button onClick={() => setEnrollOpen(false)} className={`${btnGhost} flex-1`}>Hủy</button>
            <button onClick={doEnroll} disabled={picked.length === 0} className={`${btnPrimary} flex-1`}>Thêm ({picked.length})</button>
          </>
        }
      >
        <div className="flex items-start gap-2.5 mb-4 px-3.5 py-3 rounded-xl bg-gradient-to-br from-teal-50 to-white ring-1 ring-teal-100">
          <Info className="w-4 h-4 text-[#0D9488] mt-0.5 shrink-0" />
          <p className="text-sm text-[#374151] leading-relaxed">
            Lớp dành cho học viên <span className={`font-semibold px-1.5 py-0.5 rounded ${classMeta.pill}`}>{classMeta.label}</span>.
            Danh sách chỉ hiển thị học viên cùng độ tuổi — mỗi lớp không trộn nhiều nhóm.
          </p>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm học viên..."
            className={`${inputClass} pl-9`} />
        </div>
        {!loadingAvail && filtered.length > 0 && (() => {
          const filteredIds = filtered.map((s) => s.uId);
          const allPicked = filteredIds.every((id) => picked.includes(id));
          const toggleAll = () =>
            setPicked(allPicked
              ? picked.filter((id) => !filteredIds.includes(id))
              : Array.from(new Set([...picked, ...filteredIds])));
          return (
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs text-[#6B7280]">{filtered.length} học viên{search ? " (đã lọc)" : ""}</span>
              <button onClick={toggleAll} className="text-sm font-semibold text-[#0D9488] hover:text-[#0F766E] transition-colors">
                {allPicked ? "Bỏ chọn tất cả" : "Chọn tất cả"}
              </button>
            </div>
          );
        })()}
        <div className="border border-[#E5E7EB] rounded-xl overflow-hidden max-h-[46vh] overflow-y-auto">
          {loadingAvail ? (
            <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#0D9488]" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-[#6B7280]">
                {search
                  ? "Không tìm thấy học viên phù hợp."
                  : `Không còn học viên ${classMeta.label} nào để thêm.`}
              </p>
            </div>
          ) : filtered.map((s, i) => {
            const checked = picked.includes(s.uId);
            return (
              <label key={s.uId} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${checked ? "bg-teal-50/60" : "hover:bg-gray-50"} ${i > 0 ? "border-t border-gray-100" : ""}`}>
                <input type="checkbox" checked={checked}
                  onChange={(e) => setPicked(e.target.checked ? [...picked, s.uId] : picked.filter((x) => x !== s.uId))}
                  className="w-4 h-4 rounded accent-[#0D9488]" />
                <Avatar name={s.uName} size={32} src={s.avatar_url} />
                <span className="flex-1 text-sm font-medium text-[#111827]">{s.uName}</span>
                {s.uPhone && <span className="text-xs text-[#9CA3AF] tabular-nums">{s.uPhone}</span>}
              </label>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

// ─── Assignments tab ──────────────────────────────────────────
function AssignmentsTab({ assignments }: { assignments: ClassAssignmentRow[] }) {
  if (assignments.length === 0) return <EmptyState icon={FileText} title="Chưa giao đề nào" text="Giao đề cho lớp từ Ngân hàng đề để học viên bắt đầu làm bài." />;
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
      {assignments.map((a, i) => (
        <div key={a.taId} className={`flex items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50/70 transition-colors ${i > 0 ? "border-t border-gray-100" : ""}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-[#0D9488]" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-[#111827] truncate">{a.exam_title || `Đề #${a.exam_id}`}</p>
              <p className="text-sm text-[#6B7280] inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {a.taDeadline ? `Hạn: ${formatVNDate(a.taDeadline)}` : "Không hạn"}
              </p>
            </div>
          </div>
          <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 tabular-nums">
            {a.submission_count} bài nộp
          </span>
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

  const meta = (p: string) =>
    p === "urgent" ? { dot: "bg-red-500", label: "Khẩn", chip: "bg-red-50 text-red-600 ring-red-200" }
    : p === "important" ? { dot: "bg-amber-500", label: "Quan trọng", chip: "bg-amber-50 text-amber-700 ring-amber-200" }
    : { dot: "bg-gray-300", label: "Thường", chip: "bg-gray-100 text-gray-500 ring-gray-200" };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-[#6B7280]">{items.length > 0 ? `${items.length} thông báo` : ""}</p>
        <button onClick={() => setOpen(true)} className={btnPrimary}>
          <Plus className="w-4 h-4" /> Đăng thông báo
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Megaphone} title="Chưa có thông báo" text="Đăng thông báo để gửi thông tin tới toàn bộ học viên trong lớp." />
      ) : (
        <div className="space-y-3">
          {items.map((a: ClassAnnouncement, i: number) => {
            const m = meta(a.priority);
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-[#E5E7EB] p-5 hover:shadow-sm transition-shadow cm-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`w-2 h-2 rounded-full ${m.dot}`} />
                    <h3 className="font-bold text-[#111827]">{a.title}</h3>
                    {a.priority !== "normal" && (
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${m.chip}`}>{m.label}</span>
                    )}
                  </div>
                  <button onClick={() => remove(a)} aria-label="Xóa thông báo" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-[#374151] whitespace-pre-wrap mt-2 leading-relaxed">{a.content}</p>
                <p className="text-xs text-[#9CA3AF] mt-3">{new Date(a.created_at).toLocaleString("vi-VN")}</p>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Đăng thông báo"
        footer={
          <>
            <button onClick={() => setOpen(false)} className={`${btnGhost} flex-1`}>Hủy</button>
            <button onClick={create} disabled={busy} className={`${btnPrimary} flex-1`}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Đăng
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tiêu đề" className={inputClass} />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="Nội dung thông báo..." className={`${inputClass} resize-none`} />
          <Field label="Mức độ ưu tiên" hint="Quan trọng / Khẩn sẽ gửi thông báo đẩy tới học viên.">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}>
              <option value="normal">Thường — không đẩy thông báo</option>
              <option value="important">Quan trọng — đẩy thông báo</option>
              <option value="urgent">Khẩn — đẩy thông báo</option>
            </select>
          </Field>
        </div>
      </Modal>
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
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-[#6B7280]">{items.length > 0 ? `${items.length} mục tiêu` : ""}</p>
        <button onClick={() => setOpen(true)} className={btnPrimary}>
          <Plus className="w-4 h-4" /> Tạo mục tiêu
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Target} title="Chưa có mục tiêu" text="Đặt mục tiêu để hệ thống nhắc động lực học viên mỗi ngày lúc 07:00." />
      ) : (
        <div className="space-y-3">
          {items.map((g: ClassGoal, i: number) => {
            const days = Math.ceil((new Date(g.target_date).getTime() - Date.now()) / 86400000);
            const active = g.status === "active";
            const urgent = active && days >= 0 && days <= 7;
            return (
              <div key={g.id} className="bg-white rounded-2xl border border-[#E5E7EB] p-5 flex items-center justify-between gap-3 hover:shadow-sm transition-shadow cm-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${active ? "bg-teal-50" : "bg-gray-100"}`}>
                    {active ? <Target className="w-5 h-5 text-[#0D9488]" /> : <CheckCircle2 className="w-5 h-5 text-gray-400" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-[#111827] truncate">{g.goal_title}</h3>
                      {g.target_level && <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700 ring-1 ring-teal-200">{g.target_level}</span>}
                      {!active && <span className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-500">{g.status === "completed" ? "Hoàn thành" : "Đã hủy"}</span>}
                    </div>
                    <p className="text-sm text-[#6B7280] mt-1 inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatVNDate(g.target_date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {active && days >= 0 && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums ${urgent ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200" : "bg-teal-50 text-[#0D9488] ring-1 ring-teal-200"}`}>
                      còn {days} ngày
                    </span>
                  )}
                  {active && days < 0 && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 ring-1 ring-red-200">Quá hạn</span>
                  )}
                  <button onClick={() => remove(g)} aria-label="Xóa mục tiêu" className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Tạo mục tiêu lớp"
        footer={
          <>
            <button onClick={() => setOpen(false)} className={`${btnGhost} flex-1`}>Hủy</button>
            <button onClick={create} disabled={busy} className={`${btnPrimary} flex-1`}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Tạo
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Tên mục tiêu *">
            <input autoFocus value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder="VD: Thi VSTEP B2" className={inputClass} />
          </Field>
          <Field label="Ngày mục tiêu *">
            <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Trình độ mục tiêu" hint="Không bắt buộc — VD: B2, IELTS 6.5...">
            <input value={targetLevel} onChange={(e) => setTargetLevel(e.target.value)} placeholder="VD: B2" className={inputClass} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

// ─── Co-teachers tab ──────────────────────────────────────────
function CoTeachersTab({ classId, items, isOwner, onChanged, toast }: any) {
  const [open, setOpen] = useState(false);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [inviteType, setInviteType] = useState<"co_teach" | "transfer">("co_teach");
  const [busy, setBusy] = useState(false);

  const accepted = items.filter((c: CoTeacher) => c.status === "accepted");
  const pending = items.filter((c: CoTeacher) => c.status === "pending");
  const existingIds = new Set(items.map((c: CoTeacher) => c.teacher.uId));

  const openInvite = async () => {
    setOpen(true); setPickedId(null); setMessage(""); setSearch(""); setInviteType("co_teach"); setLoadingList(true);
    try {
      const res = await classMgmtApi.colleagues();
      const list = res?.data || [];
      setColleagues((Array.isArray(list) ? list : []).filter((t: Colleague) => !existingIds.has(t.uId)));
    } catch {
      toast.error("Không tải được danh sách giáo viên.");
    } finally { setLoadingList(false); }
  };

  const invite = async () => {
    if (!pickedId) { toast.error("Chọn một giáo viên để mời."); return; }
    setBusy(true);
    try {
      await classMgmtApi.inviteCoTeacher(classId, pickedId, message || undefined, inviteType);
      toast.success(inviteType === "transfer" ? "Đã gửi lời mời chuyển quyền chủ lớp." : "Đã gửi lời mời cùng quản lý lớp.");
      setOpen(false); onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Không gửi được lời mời.");
    } finally { setBusy(false); }
  };

  const remove = async (c: CoTeacher) => {
    const label = c.status === "accepted" ? "Gỡ giáo viên này khỏi việc cùng quản lý lớp?" : "Thu hồi lời mời này?";
    if (!window.confirm(label)) return;
    try {
      await classMgmtApi.removeCoTeacher(classId, c.id);
      toast.success(c.status === "accepted" ? "Đã gỡ giáo viên." : "Đã thu hồi lời mời.");
      onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Không thực hiện được.");
    }
  };

  const filteredColleagues = colleagues.filter((t) => (t.uName || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex items-start gap-2.5 mb-4 px-3.5 py-3 rounded-xl bg-gradient-to-br from-teal-50 to-white ring-1 ring-teal-100">
        <Info className="w-4 h-4 text-[#0D9488] mt-0.5 shrink-0" />
        <p className="text-sm text-[#374151] leading-relaxed">
          Giáo viên được mời cùng quản lý có thể quản lý học viên, thông báo và mục tiêu của lớp.
          Chỉ <span className="font-semibold">chủ lớp</span> mới mời/gỡ cộng sự và xin bàn giao.
        </p>
      </div>

      {isOwner && (
        <div className="flex justify-end mb-4">
          <button onClick={openInvite} className={btnPrimary}>
            <UserPlus className="w-4 h-4" /> Mời giáo viên
          </button>
        </div>
      )}

      {accepted.length === 0 && pending.length === 0 ? (
        <EmptyState icon={UserCog} title="Chưa có cộng sự" text={isOwner ? "Mời giáo viên khác để cùng quản lý lớp này." : "Lớp này hiện chỉ có chủ lớp quản lý."} />
      ) : (
        <div className="space-y-3">
          {accepted.map((c: CoTeacher) => (
            <div key={c.id} className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex items-center justify-between gap-3 cm-rise">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={c.teacher.uName || "?"} src={c.teacher.avatar_url} />
                <div className="min-w-0">
                  <p className="font-semibold text-[#111827] truncate">{c.teacher.uName}</p>
                  <p className="text-xs text-[#6B7280]">{c.teacher.uPhone || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-[#0F766E] ring-1 ring-teal-200">
                  <ShieldCheck className="w-3.5 h-3.5" /> Đang cùng quản lý
                </span>
                {isOwner && (
                  <button onClick={() => remove(c)} aria-label="Gỡ cộng sự" className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {pending.map((c: CoTeacher) => (
            <div key={c.id} className="bg-white rounded-2xl border border-dashed border-amber-200 p-4 flex items-center justify-between gap-3 cm-rise">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={c.teacher.uName || "?"} src={c.teacher.avatar_url} />
                <div className="min-w-0">
                  <p className="font-semibold text-[#111827] truncate">{c.teacher.uName}</p>
                  {c.message && <p className="text-xs text-[#6B7280] truncate">"{c.message}"</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                  <Clock className="w-3.5 h-3.5" /> {c.type === "transfer" ? "Chờ nhận chuyển lớp" : "Chờ phản hồi"}
                </span>
                {isOwner && (
                  <button onClick={() => remove(c)} aria-label="Thu hồi lời mời" className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Mời giáo viên cùng quản lý"
        maxWidth="max-w-lg"
        footer={
          <>
            <button onClick={() => setOpen(false)} className={`${btnGhost} flex-1`}>Hủy</button>
            <button onClick={invite} disabled={!pickedId || busy} className={`${btnPrimary} flex-1`}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Gửi lời mời
            </button>
          </>
        }
      >
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm giáo viên..." className={`${inputClass} pl-9`} />
        </div>
        <div className="border border-[#E5E7EB] rounded-xl overflow-hidden max-h-[40vh] overflow-y-auto mb-4">
          {loadingList ? (
            <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#0D9488]" /></div>
          ) : filteredColleagues.length === 0 ? (
            <p className="p-8 text-center text-sm text-[#6B7280]">Không còn giáo viên phù hợp để mời.</p>
          ) : filteredColleagues.map((t, i) => {
            const picked = pickedId === t.uId;
            return (
              <button
                key={t.uId}
                onClick={() => setPickedId(t.uId)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${picked ? "bg-teal-50/70" : "hover:bg-gray-50"} ${i > 0 ? "border-t border-gray-100" : ""}`}
              >
                <Avatar name={t.uName} size={32} src={t.avatar_url} />
                <span className="flex-1 text-sm font-medium text-[#111827]">{t.uName}</span>
                {picked && <CheckCircle2 className="w-5 h-5 text-[#0D9488]" />}
              </button>
            );
          })}
        </div>
        <Field label="Lời nhắn" hint="Không bắt buộc — gửi kèm lời mời.">
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="VD: Nhờ thầy/cô hỗ trợ lớp này giúp em..." className={`${inputClass} resize-none`} />
        </Field>
        <div className="mt-4">
          <p className="text-sm font-medium text-[#374151] mb-2">Hình thức</p>
          <div className="space-y-2">
            <label className={`flex items-start gap-3 px-3.5 py-3 rounded-xl border cursor-pointer transition-colors ${inviteType === "co_teach" ? "border-[#0D9488] bg-teal-50/50 ring-1 ring-[#0D9488]/30" : "border-[#E5E7EB] hover:bg-gray-50"}`}>
              <input type="radio" name="inviteType" checked={inviteType === "co_teach"} onChange={() => setInviteType("co_teach")} className="mt-0.5 accent-[#0D9488]" />
              <span>
                <span className="block text-sm font-semibold text-[#111827]">Cùng quản lý lớp</span>
                <span className="block text-xs text-[#6B7280] mt-0.5">Hai giáo viên cùng quản lý. Bạn vẫn là chủ lớp.</span>
              </span>
            </label>
            <label className={`flex items-start gap-3 px-3.5 py-3 rounded-xl border cursor-pointer transition-colors ${inviteType === "transfer" ? "border-amber-400 bg-amber-50/50 ring-1 ring-amber-300" : "border-[#E5E7EB] hover:bg-gray-50"}`}>
              <input type="radio" name="inviteType" checked={inviteType === "transfer"} onChange={() => setInviteType("transfer")} className="mt-0.5 accent-amber-500" />
              <span>
                <span className="block text-sm font-semibold text-[#111827]">Chuyển quyền chủ lớp</span>
                <span className="block text-xs text-[#6B7280] mt-0.5">Khi giáo viên đó chấp nhận, họ trở thành chủ lớp và <span className="font-semibold text-amber-700">bạn sẽ rời lớp</span>. Không cần admin duyệt.</span>
              </span>
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function EmptyState({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 cm-rise">
      <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-50 rounded-full mb-3 ring-1 ring-teal-100">
        <Icon className="w-7 h-7 text-[#0D9488]" />
      </div>
      <h3 className="font-semibold text-[#111827] mb-1">{title}</h3>
      <p className="text-sm text-[#6B7280] max-w-sm mx-auto px-4">{text}</p>
    </div>
  );
}

export default ClassDetail;

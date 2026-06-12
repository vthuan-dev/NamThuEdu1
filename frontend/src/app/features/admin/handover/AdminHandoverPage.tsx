import { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowRightLeft, Check, X, Search, Trash2, Clock, Inbox, User } from "lucide-react";
import { adminHandoverApi, HandoverRequest } from "../../../../services/classMgmtApi";
import { useToastContext } from "../../../../contexts/ToastContext";

const STATUS_TABS = [
  { key: "pending", label: "Chờ xử lý" },
  { key: "approved", label: "Đã duyệt" },
  { key: "rejected", label: "Từ chối" },
  { key: "cancelled", label: "Đã hủy" },
  { key: "", label: "Tất cả" },
];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Chờ xử lý", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  approved:  { label: "Đã duyệt", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  rejected:  { label: "Từ chối", cls: "bg-red-50 text-red-600 ring-red-200" },
  cancelled: { label: "Đã hủy", cls: "bg-slate-100 text-slate-500 ring-slate-200" },
};

function initials(name?: string | null) {
  return (name || "?").trim().split(/\s+/).slice(-2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";
}

export function AdminHandoverPage() {
  const toast = useToastContext();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [items, setItems] = useState<HandoverRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<HandoverRequest | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminHandoverApi.list(statusFilter || undefined);
      setItems(res.data || []);
    } catch {
      toast.error("Không tải được danh sách yêu cầu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  const counts = useMemo(() => {
    const handover = items.filter((r) => r.request_type !== "deletion").length;
    const deletion = items.filter((r) => r.request_type === "deletion").length;
    return { total: items.length, handover, deletion };
  }, [items]);

  const reject = async (r: HandoverRequest) => {
    const what = r.request_type === "deletion" ? "yêu cầu xóa lớp" : "yêu cầu bàn giao lớp";
    if (!window.confirm(`Từ chối ${what} "${r.class_name}"?`)) return;
    setBusyId(r.id);
    try {
      await adminHandoverApi.reject(r.id);
      toast.success("Đã từ chối yêu cầu.");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Thao tác thất bại.");
    } finally { setBusyId(null); }
  };

  const approveDeletion = async (r: HandoverRequest) => {
    if (!window.confirm(`Duyệt xóa lớp "${r.class_name}"? Lớp sẽ bị xóa và gỡ toàn bộ học viên khỏi lớp.`)) return;
    setBusyId(r.id);
    try {
      await adminHandoverApi.approve(r.id);
      toast.success(`Đã xóa lớp "${r.class_name}".`);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Thao tác thất bại.");
    } finally { setBusyId(null); }
  };

  return (
    <div className="p-6 sm:p-8 min-h-screen bg-slate-50">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center shadow-sm">
          <ArrowRightLeft className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Yêu cầu bàn giao &amp; xóa lớp</h1>
          <p className="text-sm text-slate-500">Duyệt bàn giao (chỉ định GV tiếp nhận) và yêu cầu xóa lớp từ giáo viên</p>
        </div>
      </div>

      {/* Quiet summary (chỉ hiện khi đang lọc chờ xử lý) */}
      {statusFilter === "pending" && !loading && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
          <SummaryTile icon={Inbox} label="Đang chờ duyệt" value={counts.total} tone="slate" />
          <SummaryTile icon={ArrowRightLeft} label="Bàn giao" value={counts.handover} tone="indigo" />
          <SummaryTile icon={Trash2} label="Xóa lớp" value={counts.deletion} tone="red" />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all focus:outline-none ${statusFilter === t.key ? "bg-slate-800 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"}`}
          >
            {t.label}
            {statusFilter === t.key && items.length > 0 && (
              <span className="ml-1.5 text-xs opacity-80">({items.length})</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-50 rounded-full mb-4 ring-1 ring-slate-100">
            <Inbox className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-slate-500 font-medium">Không có yêu cầu nào ở mục này.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r, i) => {
            const isDel = r.request_type === "deletion";
            const sm = STATUS_META[r.status] || STATUS_META.pending;
            const busy = busyId === r.id;
            return (
              <div
                key={r.id}
                className="relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden cm-rise"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: isDel ? "#EF4444" : "#6366F1" }} />
                <div className="p-5 pl-6 flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ring-1 ${isDel ? "bg-red-50 text-red-600 ring-red-100" : "bg-indigo-50 text-indigo-600 ring-indigo-100"}`}>
                      {isDel ? <Trash2 className="w-5 h-5" /> : <ArrowRightLeft className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-slate-900">{r.class_name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${isDel ? "bg-red-50 text-red-600 ring-red-200" : "bg-indigo-50 text-indigo-600 ring-indigo-200"}`}>
                          {isDel ? "Xóa lớp" : "Bàn giao"}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${sm.cls}`}>{sm.label}</span>
                      </div>
                      <p className="text-sm text-slate-600 inline-flex items-center gap-1.5">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold">{initials(r.from_teacher.name)}</span>
                        GV gửi: <span className="font-semibold text-slate-800">{r.from_teacher.name || `#${r.from_teacher.id}`}</span>
                      </p>
                      {r.receiving_teacher && (
                        <p className="text-sm text-slate-600 mt-0.5 inline-flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-500" /> Đã giao cho: <span className="font-semibold text-slate-800">{r.receiving_teacher.name}</span>
                        </p>
                      )}
                      {r.reason && (
                        <p className="text-sm text-slate-500 mt-2 px-3 py-2 rounded-lg bg-slate-50 ring-1 ring-slate-100 italic">"{r.reason}"</p>
                      )}
                      {r.admin_note && (
                        <p className="text-xs text-red-500 mt-1.5">Ghi chú admin: {r.admin_note}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-2 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(r.created_at).toLocaleString("vi-VN")}
                      </p>
                    </div>
                  </div>

                  {r.status === "pending" && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => (isDel ? approveDeletion(r) : setApproving(r))}
                        disabled={busy}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 text-white rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-60 ${isDel ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
                      >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {isDel ? "Duyệt xóa" : "Duyệt & chọn GV"}
                      </button>
                      <button
                        onClick={() => reject(r)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:border-red-200 hover:text-red-600 transition-all active:scale-[0.98] disabled:opacity-60"
                      >
                        <X className="w-4 h-4" /> Từ chối
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {approving && (
        <ApproveModal request={approving} onClose={() => setApproving(null)} onDone={() => { setApproving(null); load(); }} />
      )}
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: "slate" | "indigo" | "red" }) {
  const tint = tone === "red" ? "bg-red-50 text-red-600 ring-red-100"
    : tone === "indigo" ? "bg-indigo-50 text-indigo-600 ring-indigo-100"
    : "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`hidden sm:flex w-10 h-10 rounded-xl items-center justify-center ring-1 ${tint}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{value}</p>
        <p className="text-xs text-slate-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

function ApproveModal({ request, onClose, onDone }: { request: HandoverRequest; onClose: () => void; onDone: () => void }) {
  const toast = useToastContext();
  const [teachers, setTeachers] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminHandoverApi.teachers();
        const list = res?.data?.teachers || res?.teachers || res?.data || [];
        setTeachers((Array.isArray(list) ? list : []).map((t: any) => ({ id: t.id ?? t.uId, name: t.name ?? t.uName })));
      } catch {
        toast.error("Không tải được danh sách giáo viên.");
      } finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(
    () => teachers.filter((t) => t.id !== request.from_teacher.id && (t.name || "").toLowerCase().includes(search.toLowerCase())),
    [teachers, search, request.from_teacher.id]
  );

  const approve = async () => {
    if (!selected) { toast.error("Chọn giáo viên tiếp nhận."); return; }
    setBusy(true);
    try {
      await adminHandoverApi.approve(request.id, selected);
      toast.success("Đã bàn giao lớp.");
      onDone();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Thao tác thất bại.");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 cm-backdrop-in" onMouseDown={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl ring-1 ring-black/5 max-h-[85vh] flex flex-col cm-modal-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Chọn giáo viên tiếp nhận</h2>
            <p className="text-xs text-slate-500 mt-0.5">Lớp: <span className="font-semibold text-slate-700">{request.class_name}</span></p>
          </div>
          <button onClick={onClose} aria-label="Đóng" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 flex-1 overflow-hidden flex flex-col">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm giáo viên..."
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:border-slate-400 transition-shadow" />
          </div>
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
            {loading ? (
              <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>
            ) : filtered.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">Không có giáo viên phù hợp.</p>
            ) : filtered.map((t, i) => {
              const picked = selected === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${picked ? "bg-slate-100" : "hover:bg-slate-50"} ${i > 0 ? "border-t border-slate-100" : ""}`}
                >
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-200 text-slate-600 text-xs font-bold shrink-0">{initials(t.name)}</span>
                  <span className="flex-1 text-sm font-medium text-slate-800">{t.name}</span>
                  {picked && <Check className="w-5 h-5 text-emerald-600" />}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Hủy</button>
          <button onClick={approve} disabled={!selected || busy}
            className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Duyệt bàn giao
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminHandoverPage;

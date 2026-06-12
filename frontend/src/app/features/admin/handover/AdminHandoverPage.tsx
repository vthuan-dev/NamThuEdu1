import { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowRightLeft, Check, X, Search } from "lucide-react";
import { adminHandoverApi, HandoverRequest } from "../../../../services/classMgmtApi";
import { useToastContext } from "../../../../contexts/ToastContext";

const STATUS_TABS = [
  { key: "pending", label: "Chờ xử lý" },
  { key: "approved", label: "Đã duyệt" },
  { key: "rejected", label: "Từ chối" },
  { key: "cancelled", label: "Đã hủy" },
  { key: "", label: "Tất cả" },
];

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export function AdminHandoverPage() {
  const toast = useToastContext();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [items, setItems] = useState<HandoverRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<HandoverRequest | null>(null);

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

  const reject = async (r: HandoverRequest) => {
    const what = r.request_type === "deletion" ? "yêu cầu xóa lớp" : "yêu cầu bàn giao lớp";
    if (!window.confirm(`Từ chối ${what} "${r.class_name}"?`)) return;
    try {
      await adminHandoverApi.reject(r.id);
      toast.success("Đã từ chối yêu cầu.");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Thao tác thất bại.");
    }
  };

  const approveDeletion = async (r: HandoverRequest) => {
    if (!window.confirm(`Duyệt xóa lớp "${r.class_name}"? Lớp sẽ bị xóa và gỡ toàn bộ học viên khỏi lớp.`)) return;
    try {
      await adminHandoverApi.approve(r.id);
      toast.success(`Đã xóa lớp "${r.class_name}".`);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Thao tác thất bại.");
    }
  };

  return (
    <div className="p-8 min-h-screen bg-slate-50">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center">
          <ArrowRightLeft className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Yêu cầu bàn giao & xóa lớp</h1>
          <p className="text-sm text-slate-500">Duyệt bàn giao (chỉ định GV tiếp nhận) và yêu cầu xóa lớp</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-slate-400 ${statusFilter === t.key ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-500" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
          <ArrowRightLeft className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Chưa có yêu cầu bàn giao nào.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-slate-900">{r.class_name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.request_type === "deletion" ? "bg-red-50 text-red-600 ring-1 ring-red-200" : "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200"}`}>
                      {r.request_type === "deletion" ? "Xóa lớp" : "Bàn giao"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">GV gửi: <span className="font-semibold">{r.from_teacher.name || `#${r.from_teacher.id}`}</span></p>
                  {r.receiving_teacher && (
                    <p className="text-sm text-slate-600">GV tiếp nhận: <span className="font-semibold">{r.receiving_teacher.name}</span></p>
                  )}
                  {r.reason && <p className="text-sm text-slate-500 mt-1">Lý do: {r.reason}</p>}
                  <p className="text-xs text-slate-400 mt-1">{new Date(r.created_at).toLocaleString("vi-VN")}</p>
                </div>
                {r.status === "pending" && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => r.request_type === "deletion" ? approveDeletion(r) : setApproving(r)}
                      className={`flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-sm font-semibold ${r.request_type === "deletion" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
                    >
                      <Check className="w-4 h-4" /> {r.request_type === "deletion" ? "Duyệt xóa" : "Duyệt"}
                    </button>
                    <button onClick={() => reject(r)} className="flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50">
                      <X className="w-4 h-4" /> Từ chối
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {approving && (
        <ApproveModal request={approving} onClose={() => setApproving(null)} onDone={() => { setApproving(null); load(); }} />
      )}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Chọn giáo viên tiếp nhận</h2>
          <button onClick={onClose} aria-label="Đóng"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-slate-500 mb-3">Lớp: <span className="font-semibold">{request.class_name}</span></p>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm giáo viên..."
            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400" />
        </div>
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl divide-y">
          {loading ? (
            <div className="p-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">Không có giáo viên phù hợp.</p>
          ) : filtered.map((t) => (
            <label key={t.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50">
              <input type="radio" name="recv" checked={selected === t.id} onChange={() => setSelected(t.id)} className="w-4 h-4" />
              <span>{t.name}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-semibold hover:bg-slate-50">Hủy</button>
          <button onClick={approve} disabled={!selected || busy}
            className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Duyệt bàn giao
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminHandoverPage;

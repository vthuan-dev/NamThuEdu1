import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  BookOpenCheck,
  FileEdit,
  Clock,
  RefreshCw,
  Search,
  AlertTriangle,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { adminApi, AdminExam } from "@/services/adminApi";
import { AdminStatsSkeleton } from "../components/AdminPageSkeleton";
import { RejectReasonModal } from "../components/RejectReasonModal";
import { useToastContext } from "@/contexts/ToastContext";
import { ExamCard } from "./ExamCard";
import { ExamQuickViewModal } from "./ExamQuickViewModal";
import { ExamPreviewModal } from "./ExamPreviewModal";
import {
  classifyAgeGroup,
  classifyExamType,
  getExamId,
  getExamTitle,
  getExamTeacher,
  getExamSkill,
  getExamStatus,
  EXAM_TYPE_META,
  type AgeGroupKey,
} from "./examClassify";

/** Tab chính = phân loại đề thi.
 *  Thứ tự cố định, dễ predict cho admin.
 */
type TypeTabKey = "all" | "VSTEP" | "IELTS" | "THPT" | "KIDS" | "CAMBRIDGE" | "GENERAL";
const TYPE_TABS: { key: TypeTabKey; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "VSTEP", label: "VSTEP" },
  { key: "IELTS", label: "IELTS" },
  { key: "THPT", label: "THPT" },
  { key: "KIDS", label: "Cambridge YLE" },
  { key: "CAMBRIDGE", label: "Cambridge" },
  { key: "GENERAL", label: "Khác" },
];

const PAGE_SIZE_OPTIONS = [12, 24, 48];

export function AdminCoursesPage() {
  const toast = useToastContext();
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeTab, setTypeTab] = useState<TypeTabKey>("all");
  const [ageFilter, setAgeFilter] = useState<"all" | AgeGroupKey>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [viewTarget, setViewTarget] = useState<AdminExam | null>(null);
  const [previewTarget, setPreviewTarget] = useState<AdminExam | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminExam | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const loadExams = async () => {
    try {
      setLoading(true);
      setError(null);
      const allExams = await adminApi.getExams();
      setExams(allExams);
    } catch {
      setError("Không tải được danh sách đề thi. Kiểm tra kết nối tới máy chủ rồi thử lại.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, []);

  // Reset về trang 1 khi đổi filter/tab
  useEffect(() => {
    setPage(1);
  }, [typeTab, ageFilter, statusFilter, search, pageSize]);

  // Đếm số đề theo từng loại đề (cho badge trên tab)
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: exams.length };
    exams.forEach((e) => {
      const k = classifyExamType(e).key;
      counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }, [exams]);

  const stats = useMemo(() => {
    const total = exams.length;
    const published = exams.filter((e) => getExamStatus(e) === "published").length;
    const pending = exams.filter((e) => getExamStatus(e) === "pending").length;
    const draft = exams.filter((e) => {
      const s = getExamStatus(e);
      return s !== "published" && s !== "pending";
    }).length;
    return { total, published, pending, draft };
  }, [exams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exams.filter((e) => {
      const matchesSearch =
        !q ||
        getExamTitle(e).toLowerCase().includes(q) ||
        getExamTeacher(e).toLowerCase().includes(q) ||
        classifyExamType(e).label.toLowerCase().includes(q) ||
        getExamSkill(e).toLowerCase().includes(q);
      const matchesType = typeTab === "all" || classifyExamType(e).key === typeTab;
      const matchesAge = ageFilter === "all" || classifyAgeGroup(e) === ageFilter;
      const matchesStatus = statusFilter === "all" || getExamStatus(e) === statusFilter;
      return matchesSearch && matchesType && matchesAge && matchesStatus;
    });
  }, [exams, search, typeTab, ageFilter, statusFilter]);

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, filtered.length);
  const pageItems = filtered.slice(pageStart, pageEnd);

  const handleApprove = async (id: number) => {
    try {
      setBusyId(id);
      await adminApi.approveExam(id);
      toast.success("Duyệt đề thành công!");
      await loadExams();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Duyệt đề thất bại");
    } finally {
      setBusyId(null);
    }
  };

  const submitReject = async (reason: string) => {
    if (!rejectTarget) return;
    const id = getExamId(rejectTarget);
    try {
      setBusyId(id);
      await adminApi.rejectExam(id, reason);
      toast.success("Đã từ chối đề thi!");
      setRejectTarget(null);
      await loadExams();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Từ chối đề thất bại");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: number) => {
    const target = exams.find((e) => getExamId(e) === id);
    const ok = window.confirm(
      `Xóa đề thi "${target ? getExamTitle(target) : `#${id}`}"?\nHành động này không thể hoàn tác.`
    );
    if (!ok) return;
    try {
      setBusyId(id);
      await adminApi.deleteExam(id);
      toast.success("Xóa đề thi thành công!");
      await loadExams();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Xóa đề thi thất bại");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen p-6" style={{ background: "#F8FAFC" }}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý đề thi</h1>
          <p className="text-sm text-slate-500">Ngân hàng đề thi toàn hệ thống</p>
        </div>
        <button
          onClick={loadExams}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Tải lại
        </button>
      </div>

      {/* Stat cards */}
      {loading ? (
        <AdminStatsSkeleton cards={4} />
      ) : (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={<FileText className="h-4 w-4" />} label="Tổng đề thi" value={stats.total} tone="slate" />
          <StatCard icon={<BookOpenCheck className="h-4 w-4" />} label="Đã xuất bản" value={stats.published} tone="emerald" />
          <StatCard icon={<Clock className="h-4 w-4" />} label="Chờ duyệt" value={stats.pending} tone="amber" />
          <StatCard icon={<FileEdit className="h-4 w-4" />} label="Nháp" value={stats.draft} tone="slate" />
        </div>
      )}

      {/* ── Type tabs (primary) ── */}
      <div className="mb-4 border-b border-slate-200">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {TYPE_TABS.map((tab) => {
            const active = typeTab === tab.key;
            const count = typeCounts[tab.key] ?? 0;
            const meta = tab.key !== "all" ? EXAM_TYPE_META[tab.key] : null;
            return (
              <button
                key={tab.key}
                onClick={() => setTypeTab(tab.key)}
                className={`relative inline-flex cursor-pointer items-center gap-2 px-1 pb-3 pt-2 text-sm font-semibold transition-colors ${
                  active ? "text-slate-950" : "text-slate-500 hover:text-slate-800"
                }`}
                aria-pressed={active}
              >
                {meta && <meta.icon className="h-4 w-4" style={{ color: active ? meta.color : "#94A3B8" }} />}
                <span>{tab.label}</span>
                <span
                  className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                    active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {count}
                </span>
                {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-slate-900" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Toolbar: search + filters ── */}
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 md:flex-row md:items-center">
        <label htmlFor="exam-search" className="sr-only">Tìm kiếm đề thi</label>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="exam-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên đề, giáo viên, kỹ năng..."
            aria-label="Tìm kiếm đề thi"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-slate-800 focus:ring-2 focus:ring-slate-100"
          />
        </div>
        <select
          value={ageFilter}
          onChange={(e) => setAgeFilter(e.target.value as "all" | AgeGroupKey)}
          aria-label="Lọc theo nhóm tuổi"
          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-slate-800 focus:ring-2 focus:ring-slate-100"
        >
          <option value="all">Tất cả nhóm tuổi</option>
          <option value="kids">Kids (6-12)</option>
          <option value="teens">Teens (13-17)</option>
          <option value="adults">Adults (18+)</option>
          <option value="other">Chưa phân loại</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Lọc theo trạng thái"
          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-slate-800 focus:ring-2 focus:ring-slate-100"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="published">Đã xuất bản</option>
          <option value="pending">Chờ duyệt</option>
          <option value="draft">Nháp</option>
        </select>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <CardGridSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-100 bg-white py-16">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50">
            <AlertTriangle className="h-7 w-7 text-rose-500" />
          </span>
          <p className="text-sm font-semibold text-slate-900">{error}</p>
          <button
            onClick={loadExams}
            className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" /> Thử lại
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <LayoutGrid className="h-7 w-7 text-slate-300" />
          </span>
          <p className="text-sm font-semibold text-slate-900">Không tìm thấy đề thi</p>
          <p className="mt-1 text-xs text-slate-500">Thử đổi tab, bộ lọc hoặc từ khóa tìm kiếm</p>
        </div>
      ) : (
        <>
          {/* Card grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {pageItems.map((e) => {
              const id = getExamId(e);
              return (
                <ExamCard
                  key={id}
                  exam={e}
                  busy={busyId === id}
                  onView={() => setViewTarget(e)}
                  onApprove={() => handleApprove(id)}
                  onReject={() => setRejectTarget(e)}
                  onDelete={() => handleDelete(id)}
                />
              );
            })}
          </div>

          {/* Pagination */}
          <Pagination
            page={safePage}
            totalPages={totalPages}
            pageStart={pageStart + 1}
            pageEnd={pageEnd}
            total={filtered.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}

      {/* Modals */}
      <ExamQuickViewModal
        exam={viewTarget}
        onClose={() => setViewTarget(null)}
        onPreview={() => viewTarget && setPreviewTarget(viewTarget)}
      />
      <ExamPreviewModal exam={previewTarget} onClose={() => setPreviewTarget(null)} />
      <RejectReasonModal
        open={!!rejectTarget}
        title="Từ chối đề thi"
        subject={rejectTarget ? getExamTitle(rejectTarget) : ""}
        busy={busyId === (rejectTarget ? getExamId(rejectTarget) : 0)}
        onCancel={() => setRejectTarget(null)}
        onConfirm={submitReject}
      />
    </div>
  );
}

// ── Pagination ─────────────────────────────────────────────────────────────
function Pagination({
  page,
  totalPages,
  pageStart,
  pageEnd,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  pageStart: number;
  pageEnd: number;
  total: number;
  pageSize: number;
  onPageChange: (n: number) => void;
  onPageSizeChange: (n: number) => void;
}) {
  // Tạo danh sách số trang hiển thị: luôn có trang 1, hiện tại ± 1, cuối + dấu …
  const pages: (number | "…")[] = useMemo(() => {
    const set = new Set<number>([1, totalPages, page, page - 1, page + 1]);
    const list = Array.from(set).filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
    const out: (number | "…")[] = [];
    list.forEach((n, i) => {
      if (i > 0 && n - (list[i - 1] as number) > 1) out.push("…");
      out.push(n);
    });
    return out;
  }, [page, totalPages]);

  return (
    <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row">
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span>
          Hiển thị <strong className="text-slate-800">{pageStart}-{pageEnd}</strong> / <strong className="text-slate-800">{total}</strong>
        </span>
        <span className="hidden h-3 w-px bg-slate-200 sm:inline-block" />
        <label className="hidden items-center gap-1.5 sm:inline-flex">
          <span>Mỗi trang</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="cursor-pointer rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-700 outline-none focus:border-slate-800"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Trang trước"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1.5 text-xs text-slate-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg px-2 text-xs font-semibold transition-colors ${
                p === page
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Trang sau"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────
type Tone = "slate" | "amber" | "emerald" | "rose";

const TONE_STYLES: Record<Tone, { border: string; bg: string; icon: string; text: string }> = {
  slate: { border: "border-slate-200", bg: "bg-white", icon: "bg-slate-100 text-slate-500", text: "text-slate-900" },
  amber: { border: "border-amber-200", bg: "bg-amber-50", icon: "bg-amber-100 text-amber-700", text: "text-amber-700" },
  emerald: { border: "border-emerald-200", bg: "bg-emerald-50", icon: "bg-emerald-100 text-emerald-700", text: "text-emerald-700" },
  rose: { border: "border-rose-200", bg: "bg-rose-50", icon: "bg-rose-100 text-rose-700", text: "text-rose-700" },
};

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: Tone }) {
  const s = TONE_STYLES[tone];
  return (
    <div className={`flex items-center gap-3 rounded-xl border ${s.border} ${s.bg} px-4 py-3`}>
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${s.icon}`}>{icon}</div>
      <div className="min-w-0">
        <p className={`truncate text-xs ${tone === "slate" ? "text-slate-500" : s.text}`}>{label}</p>
        <p className={`text-lg font-bold leading-tight ${s.text}`}>{value}</p>
      </div>
    </div>
  );
}

// ── Skeleton lưới card (không còn group section) ───────────────────────────
function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 pl-5">
          <span className="absolute left-0 top-0 h-full w-1 animate-pulse bg-slate-200" />
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-200" />
              <div className="space-y-1.5">
                <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
                <div className="h-2.5 w-10 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
            <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-100" />
          </div>
          <div className="mb-3 space-y-1.5">
            <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
          </div>
          <div className="mb-3 flex gap-1.5">
            <div className="h-4 w-14 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-12 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-10 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-16 animate-pulse rounded-full bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

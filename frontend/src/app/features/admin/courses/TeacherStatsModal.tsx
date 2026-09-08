import { useState, useMemo } from "react";
import { X, Search, Users, CheckCircle2, Clock, FileEdit, ArrowRight, Sparkles, RefreshCw } from "lucide-react";
import type { TeacherExamStat } from "@/services/adminApi";
import { getFullMediaUrl } from "@/utils/mediaUtils";

interface Props {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  stats: TeacherExamStat[];
  loading?: boolean;
  onSelectTeacher: (teacherId: number, teacherName?: string) => void;
  onRefresh?: () => void;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TeacherStatsModal({
  open,
  isOpen,
  onClose,
  stats,
  loading = false,
  onSelectTeacher,
  onRefresh,
}: Props) {
  const isVisible = open ?? isOpen ?? false;
  const [search, setSearch] = useState("");

  const filteredStats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stats;
    return stats.filter(
      (t) =>
        t.uName.toLowerCase().includes(q) ||
        (t.uPhone && t.uPhone.toLowerCase().includes(q))
    );
  }, [stats, search]);

  const totalExamsCreated = useMemo(() => {
    return stats.reduce((acc, t) => acc + (Number(t.total_exams) || 0), 0);
  }, [stats]);

  const activeTeachersCount = useMemo(() => {
    return stats.filter((t) => (Number(t.total_exams) || 0) > 0).length;
  }, [stats]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15, 23, 42, 0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100 flex flex-col max-h-[88vh] animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Năng suất tạo đề của Giáo viên</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tổng hợp {stats.length} giáo viên &middot; {totalExamsCreated} đề thi toàn hệ thống
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                title="Tải lại thống kê"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4 bg-slate-50/70 border-b border-slate-100">
          <div className="flex items-center gap-3 rounded-xl bg-white p-3 border border-slate-200/80 shadow-xs">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Users className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Giáo viên đã tạo đề</p>
              <p className="text-lg font-extrabold text-slate-900">
                {activeTeachersCount} <span className="text-xs font-normal text-slate-400">/ {stats.length}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-white p-3 border border-slate-200/80 shadow-xs">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tổng số đề thi</p>
              <p className="text-lg font-extrabold text-emerald-600">{totalExamsCreated}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-white p-3 border border-slate-200/80 shadow-xs">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Trung bình / GV</p>
              <p className="text-lg font-extrabold text-slate-900">
                {activeTeachersCount > 0 ? (totalExamsCreated / activeTeachersCount).toFixed(1) : 0}
              </p>
            </div>
          </div>
        </div>

        {/* Search Toolbar */}
        <div className="px-6 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm giáo viên theo tên, số điện thoại..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs outline-none transition-colors focus:border-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-100"
            />
          </div>
        </div>

        {/* Teacher List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Đang tải dữ liệu giáo viên...</div>
          ) : filteredStats.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">Không tìm thấy giáo viên nào phù hợp</div>
          ) : (
            filteredStats.map((teacher, index) => {
              const avatar = getFullMediaUrl(teacher.avatar_url);
              return (
                <div
                  key={teacher.uId}
                  className="flex items-center justify-between py-3.5 group hover:bg-slate-50/80 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-slate-300 w-5 text-right font-bold">
                      #{index + 1}
                    </span>
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={teacher.uName}
                        className="h-10 w-10 rounded-xl object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white text-xs font-bold">
                        {initials(teacher.uName)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{teacher.uName}</p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{teacher.uPhone || "Chưa có SĐT"}</p>
                    </div>
                  </div>

                  {/* Badges & Actions */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="hidden sm:flex items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200/60">
                        <CheckCircle2 className="h-3 w-3" /> {teacher.published_exams || 0} xuất bản
                      </span>
                      {Number(teacher.pending_exams) > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200/60">
                          <Clock className="h-3 w-3" /> {teacher.pending_exams} chờ
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        <FileEdit className="h-3 w-3" /> {teacher.draft_exams || 0} nháp
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-extrabold text-slate-900">
                        {teacher.total_exams || 0}
                      </span>
                      <span className="text-xs text-slate-400 font-normal"> đề</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectTeacher(teacher.uId, teacher.uName);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      <span>Xem đề</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-500">
            Mẹo: Nhấn vào <strong>Xem đề</strong> để lọc ngay danh sách đề của giáo viên tương ứng
          </p>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

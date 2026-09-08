import { X, User, Layers, ListChecks, FileText, Calendar, Hash, ExternalLink, HelpCircle } from "lucide-react";
import { useEffect } from "react";
import type { AdminExam } from "@/services/adminApi";
import {
  classifyExamType,
  classifyAgeGroup,
  getExamId,
  getExamTitle,
  getExamTeacher,
  getExamSkill,
  getExamLevel,
  getExamCreatedAt,
  getExamStatus,
  statusLabel,
  AGE_GROUP_META,
  formatSkillLabel,
  formatLevelLabel,
  formatExamDateTime,
  getExamQuestionCount,
} from "./examClassify";

interface Props {
  exam: AdminExam | null;
  onClose: () => void;
  /** Mở trang xem trước UI thi (giao diện học viên sẽ thấy). */
  onPreview?: () => void;
}

function formatDate(raw: string): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * ExamQuickViewModal — modal xem nhanh thông tin đề thi (read-only) cho admin.
 */
export function ExamQuickViewModal({ exam, onClose, onPreview }: Props) {
  useEffect(() => {
    if (!exam) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exam, onClose]);

  if (!exam) return null;

  const typeMeta = classifyExamType(exam);
  const ageMeta = AGE_GROUP_META[classifyAgeGroup(exam)];
  const TypeIcon = typeMeta.icon;
  const status = getExamStatus(exam);
  const skill = getExamSkill(exam);
  const level = getExamLevel(exam);
  const isPublished = status === "published";

  const rows: { icon: typeof User; label: string; value: string }[] = [
    { icon: Hash, label: "Mã đề", value: `#${getExamId(exam)}` },
    { icon: User, label: "Giáo viên", value: getExamTeacher(exam) },
    { icon: Layers, label: "Loại đề", value: typeMeta.label },
    { icon: HelpCircle, label: "Số câu hỏi", value: `${getExamQuestionCount(exam)} câu` },
    { icon: ListChecks, label: "Kỹ năng", value: formatSkillLabel(skill, false) || "Tổng hợp" },
    { icon: FileText, label: "Độ khó", value: formatLevelLabel(level, false) || "—" },
    { icon: Calendar, label: "Ngày tạo", value: formatExamDateTime(getExamCreatedAt(exam), false) },
  ];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Chi tiết đề thi ${getExamTitle(exam)}`}
    >
      <style>{`
        @keyframes eqvIn {
          from { opacity: 0; transform: translateY(-12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ animation: "eqvIn 0.18s ease-out forwards", border: "1px solid #E2E8F0" }}
      >
        {/* Header với accent màu theo loại đề */}
        <div className="relative px-6 pb-5 pt-6" style={{ background: typeMeta.softBg }}>
          <div
            className="absolute left-0 top-0 h-1 w-full"
            style={{ background: typeMeta.color }}
          />
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="absolute right-4 top-4 cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/70 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-3">
            <span
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ background: "#FFFFFF", color: typeMeta.color, border: `1px solid ${typeMeta.color}22` }}
            >
              <TypeIcon className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1 pr-6">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                  style={{ background: typeMeta.color }}
                >
                  {typeMeta.label}
                </span>
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                  style={{ background: "#FFFFFF", color: ageMeta.color, border: `1px solid ${ageMeta.color}33` }}
                >
                  {ageMeta.label}
                </span>
              </div>
              <h2 className="text-lg font-bold leading-snug text-slate-900">
                {getExamTitle(exam)}
              </h2>
            </div>
          </div>
        </div>

        {/* Body — bảng thông tin */}
        <div className="px-6 py-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            {rows.map((r) => {
              const RowIcon = r.icon;
              return (
                <div key={r.label} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <RowIcon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-400">{r.label}</dt>
                    <dd className="truncate text-sm font-medium text-slate-800">{r.value}</dd>
                  </div>
                </div>
              );
            })}
          </dl>

          {exam.eDescription && (
            <div className="mt-5 rounded-xl bg-slate-50 p-3.5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Mô tả</p>
              <p className="text-sm leading-relaxed text-slate-600">{exam.eDescription}</p>
            </div>
          )}
        </div>

        {/* Footer — trạng thái + hành động xem trước */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-3.5">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              isPublished
                ? "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                : "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-600/20"
            }`}
          >
            {statusLabel(status)}
          </span>
          {onPreview && (
            <button
              onClick={() => {
                onClose();
                onPreview();
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
            >
              <ExternalLink className="h-4 w-4" />
              Xem trước
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

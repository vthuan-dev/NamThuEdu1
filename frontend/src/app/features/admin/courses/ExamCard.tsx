import { useState, useRef, useEffect } from "react";
import {
  MoreVertical,
  Eye,
  CheckCircle2,
  XCircle,
  Trash2,
  User,
  HelpCircle,
  RefreshCw,
  Calendar,
} from "lucide-react";
import type { AdminExam } from "@/services/adminApi";
import {
  classifyExamType,
  getExamId,
  getExamTitle,
  getExamTeacher,
  getExamTeacherId,
  getExamSkill,
  getExamLevel,
  getExamStatus,
  getExamCreatedAt,
  statusLabel,
  formatSkillLabel,
  formatLevelLabel,
  formatExamDateTime,
  getExamQuestionCount,
} from "./examClassify";

interface Props {
  exam: AdminExam;
  busy?: boolean;
  onView: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  onSelectTeacher?: (teacherId: number, teacherName: string) => void;
}

/**
 * ExamCard — thẻ hiển thị 1 đề thi trong lưới quản lý đề của admin.
 * Accent màu theo loại đề; menu thao tác: Xem nhanh / Duyệt / Từ chối / Xóa.
 */
export function ExamCard({
  exam,
  busy = false,
  onView,
  onApprove,
  onReject,
  onDelete,
  onSelectTeacher,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const typeMeta = classifyExamType(exam);
  const TypeIcon = typeMeta.icon;
  const id = getExamId(exam);
  const title = getExamTitle(exam);
  const skill = getExamSkill(exam);
  const level = getExamLevel(exam);
  const status = getExamStatus(exam);
  const createdAt = getExamCreatedAt(exam);
  const isPublished = status === "published";
  const questionsCount = getExamQuestionCount(exam);

  const runAndClose = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  return (
    <div
      onClick={onView}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60 cursor-pointer"
      style={{ ["--accent" as string]: typeMeta.color }}
    >
      {/* Accent bar trái */}
      <span
        className="absolute left-0 top-0 h-full w-1"
        style={{ background: typeMeta.color }}
        aria-hidden
      />

      <div className="flex flex-1 flex-col p-4 pl-5">
        {/* Header: icon loại + badges + menu */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ background: typeMeta.softBg, color: typeMeta.color }}
            >
              <TypeIcon className="h-5 w-5" />
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-semibold" style={{ color: typeMeta.color }}>
                {typeMeta.label}
              </span>
              <span className="font-mono text-[11px] text-slate-400">#{id}</span>
            </div>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((o) => !o);
              }}
              aria-label={`Thao tác cho ${title}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              disabled={busy}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-9 z-50 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl"
              >
                <button
                  onClick={() => runAndClose(onView)}
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Eye className="h-4 w-4 text-blue-600" />
                  <span>Xem nhanh</span>
                </button>
                {status === 'pending' && (
                  <button
                    onClick={() => runAndClose(onApprove)}
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Duyệt đề</span>
                  </button>
                )}
                {status === 'pending' && (
                  <button
                    onClick={() => runAndClose(onReject)}
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-slate-700 transition-colors hover:bg-amber-50 hover:text-amber-700"
                  >
                    <XCircle className="h-4 w-4 text-amber-600" />
                    <span>Từ chối</span>
                  </button>
                )}
                <div className="my-1.5 h-px bg-slate-100" role="separator" />
                <button
                  onClick={() => runAndClose(onDelete)}
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-rose-700 transition-colors hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Xóa đề thi</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tiêu đề */}
        <div className="mb-3" title={title}>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 transition-colors group-hover:text-[var(--accent)]">
            {title}
          </h3>
        </div>

        {/* Chips: kỹ năng + cấp độ */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {skill && (
            <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
              {formatSkillLabel(skill)}
            </span>
          )}
          {level && (
            <span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
              {formatLevelLabel(level)}
            </span>
          )}
          {typeof questionsCount === "number" && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              <HelpCircle className="h-3 w-3" />
              {questionsCount} câu
            </span>
          )}
        </div>

        {/* Footer: giáo viên + trạng thái + thời gian tạo */}
        <div className="mt-auto border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between gap-2">
            {onSelectTeacher ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const tid = getExamTeacherId(exam);
                  if (tid) {
                    onSelectTeacher(tid, getExamTeacher(exam));
                  }
                }}
                title={`Lọc tất cả đề thi của ${getExamTeacher(exam)}`}
                className="group/teacher flex min-w-0 items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors cursor-pointer text-left"
              >
                <User className="h-3.5 w-3.5 flex-shrink-0 text-slate-400 group-hover/teacher:text-blue-600 transition-colors" />
                <span className="truncate font-medium group-hover/teacher:underline">
                  {getExamTeacher(exam)}
                </span>
              </button>
            ) : (
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                <User className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{getExamTeacher(exam)}</span>
              </span>
            )}
            <span
              className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                isPublished
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {statusLabel(status)}
            </span>
          </div>

          {createdAt && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
              <Calendar className="h-3 w-3 flex-shrink-0 text-slate-400" />
              <span>{formatExamDateTime(createdAt, true)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * ResumeExamModal
 * ---------------
 * Modal hiển thị khi user truy cập trang TestTaking với một submission đã có
 * draft localStorage. Hỏi: "Bạn có bài thi đang dở, tiếp tục từ chỗ cũ?".
 *
 *   - Continue → gọi `onResume(draft)` (hook sẽ merge answers + giữ countdown)
 *   - Discard  → gọi `onDiscard()` (xóa draft localStorage, khởi động lại)
 *
 * Khi `draft` null/undefined → modal ẩn. Tự khóa scroll body khi mở,
 * trap focus đơn giản (escape để đóng = continue mặc định).
 */

import { useEffect, useMemo } from 'react';
import type { ExamDraft } from '../../lib/exam/examDraftStorage';

export interface ResumeExamModalProps {
  draft: ExamDraft | null;
  open: boolean;
  onResume: (draft: ExamDraft) => void;
  onDiscard: () => void;
  variant?: 'kids' | 'default';
}

function formatRelative(updatedAt: string | number): string {
  const ts = typeof updatedAt === 'number' ? updatedAt : Date.parse(updatedAt);
  if (!Number.isFinite(ts)) return 'gần đây';
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'vừa xong';
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const day = Math.floor(hr / 24);
  return `${day} ngày trước`;
}

export function ResumeExamModal({
  draft,
  open,
  onResume,
  onDiscard,
  variant = 'default',
}: ResumeExamModalProps) {
  const answeredCount = useMemo(() => {
    if (!draft) return 0;
    return Object.values(draft.answers).filter((v) => {
      if (v == null) return false;
      if (typeof v === 'string') return v.trim().length > 0;
      if (typeof v === 'object') return Object.keys(v as object).length > 0;
      return true;
    }).length;
  }, [draft]);

  // Khóa scroll body
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc = continue (mặc định an toàn cho học viên)
  useEffect(() => {
    if (!open || !draft) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onResume(draft);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, draft, onResume]);

  if (!open || !draft) return null;

  const isKids = variant === 'kids';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-exam-title"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className={[
          'w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl',
          isKids ? 'border-4 border-rose-100' : 'border border-slate-200',
        ].join(' ')}
        style={{
          animation: 'resumeModalIn 220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <style>{`
          @keyframes resumeModalIn {
            from { opacity: 0; transform: translateY(12px) scale(0.96); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>

        <div className="flex items-start gap-3">
          <div
            className={[
              'flex-shrink-0 rounded-2xl flex items-center justify-center',
              isKids ? 'w-14 h-14 bg-amber-100 text-2xl' : 'w-12 h-12 bg-amber-50 text-xl',
            ].join(' ')}
            aria-hidden
          >
            📝
          </div>
          <div className="flex-1">
            <h2
              id="resume-exam-title"
              className={[
                'font-bold text-slate-900',
                isKids ? 'text-xl' : 'text-lg',
              ].join(' ')}
            >
              Bài thi đang dở
            </h2>
            <p className={['mt-1 text-slate-600', isKids ? 'text-sm' : 'text-sm'].join(' ')}>
              Bạn có một bài thi chưa nộp. Tiếp tục từ chỗ cũ nhé?
            </p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Đã làm</dt>
            <dd className="font-semibold text-slate-900">{answeredCount} câu</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Lưu lần cuối</dt>
            <dd className="font-semibold text-slate-900">{formatRelative(draft.updatedAt)}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onDiscard}
            className={[
              'rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
              'border border-slate-200 text-slate-600 hover:bg-slate-50',
            ].join(' ')}
          >
            Bắt đầu lại
          </button>
          <button
            type="button"
            onClick={() => onResume(draft)}
            autoFocus
            className={[
              'rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all',
              isKids
                ? 'bg-gradient-to-r from-rose-400 to-orange-400 hover:scale-[1.02] active:scale-95 shadow-lg shadow-rose-200'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-md',
            ].join(' ')}
          >
            Tiếp tục bài thi
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResumeExamModal;

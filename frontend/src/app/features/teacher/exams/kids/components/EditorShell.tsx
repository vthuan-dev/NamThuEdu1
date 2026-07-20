import React, { useContext } from 'react';
import { X } from 'lucide-react';
import { KidsExplanationContext } from '../steps/Step2AddQuestions';

/**
 * EditorShell — khung chuẩn dùng chung cho mọi editor dạng bài Kids.
 *
 * Mục tiêu: mọi editor có CÙNG header / instruction / footer, thay vì mỗi
 * file tự vẽ chrome riêng. Phần thân (children) là nội dung riêng của từng dạng.
 *
 * Thiết kế: slate + cam, gọn, chuyên nghiệp (VStep-like).
 */
export interface EditorShellProps {
  /** Tên dạng bài, vd "Nghe và Nối" */
  title: string;
  /** Badge ngữ cảnh, vd "Starters · Listening · Part 1" */
  badge?: string;
  /** Mô tả nhiệm vụ (callout xám nhạt phía trên thân) */
  instruction?: React.ReactNode;
  /** Nội dung riêng của editor */
  children: React.ReactNode;
  /** Nhãn nút lưu (mặc định "Lưu câu hỏi") */
  saveLabel?: string;
  /** Vô hiệu nút lưu khi chưa hợp lệ */
  saveDisabled?: boolean;
  onSave: () => void;
  onCancel: () => void;
}

const EditorShell: React.FC<EditorShellProps> = ({
  title,
  badge,
  instruction,
  children,
  saveLabel = 'Lưu câu hỏi',
  saveDisabled = false,
  onSave,
  onCancel,
}) => {
  const context = useContext(KidsExplanationContext);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-200 px-5 py-3.5">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900">{title}</h3>
          {badge && (
            <span className="mt-0.5 inline-block text-xs font-medium text-slate-500">
              {badge}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="-mr-1 flex-shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label="Đóng"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Instruction callout */}
      {instruction && (
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
          <p className="text-sm leading-relaxed text-slate-600">{instruction}</p>
        </div>
      )}

      {/* Body */}
      <div className="px-5 py-4">
        {children}

        {context && (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Giải thích đáp án (Tùy chọn)
            </label>
            <textarea
              value={context.explanation}
              onChange={(e) => context.setExplanation(e.target.value)}
              placeholder="Giải thích tại sao đáp án của câu hỏi này đúng..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 min-h-[80px]"
            />
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur-sm">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saveDisabled}
          className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
            saveDisabled
              ? 'cursor-not-allowed bg-slate-200 text-slate-400'
              : 'bg-orange-500 text-white hover:bg-orange-600'
          }`}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
};

export default EditorShell;

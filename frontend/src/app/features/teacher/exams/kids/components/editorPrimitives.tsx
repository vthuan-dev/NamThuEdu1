import React, { useState } from 'react';
import { Upload, Trash2, Loader2, Plus } from 'lucide-react';
import { uploadKidsMedia } from '../../../../../../services/kidsExamApi';
import { getFullMediaUrl } from '../../../../../../utils/mediaUtils';

/* ──────────────────────────────────────────────────────────────────────────
 * editorPrimitives — bộ field tái dùng cho mọi editor dạng bài Kids.
 * Hệ màu slate + cam, gọn, nhất quán. Tất cả upload đi qua đây nên dùng
 * ĐÚNG signature: uploadKidsMedia(file, mediaType, examId, questionId).
 * ────────────────────────────────────────────────────────────────────────── */

/* FieldLabel ---------------------------------------------------------------- */
export const FieldLabel: React.FC<{
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}> = ({ children, required, hint }) => (
  <div className="mb-1.5 flex items-baseline justify-between">
    <label className="text-sm font-medium text-slate-700">
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
    {hint && <span className="text-xs text-slate-400">{hint}</span>}
  </div>
);

/* TextField ----------------------------------------------------------------- */
export const TextField: React.FC<
  React.InputHTMLAttributes<HTMLInputElement>
> = ({ className = '', ...props }) => (
  <input
    {...props}
    className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${className}`}
  />
);

/* TextArea ------------------------------------------------------------------ */
export const TextArea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
> = ({ className = '', rows = 3, ...props }) => (
  <textarea
    {...props}
    rows={rows}
    className={`w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${className}`}
  />
);

/* Media upload hook --------------------------------------------------------- */
function useMediaUpload(examId: string | number | null) {
  const [uploading, setUploading] = useState(false);

  const upload = async (
    file: File,
    mediaType: 'image' | 'audio'
  ): Promise<string | null> => {
    if (!examId) {
      alert('Vui lòng tạo đề thi trước khi tải tệp lên!');
      return null;
    }
    setUploading(true);
    try {
      // ĐÚNG signature: (file, mediaType, examId, questionId?)
      const res: any = await uploadKidsMedia(file, mediaType, examId);
      // BUG FIX: backend trả { message, media: { id, url, ... } } — KHÔNG có
      // `url` ở top-level. Trước đây chỉ đọc `res.url` → luôn undefined →
      // `onChange` không bao giờ được gọi → mọi editor dùng ImageUpload/
      // AudioUpload (Sắp xếp từ, các phần Nói, Tìm điểm khác biệt, ...) đều
      // "bấm tải ảnh mà không có gì xảy ra". Đọc cả 2 shape cho chắc.
      const url: string | undefined = res?.media?.url ?? res?.url;
      if (!url) {
        console.error('Upload response missing url:', res);
        alert('Tải tệp lên xong nhưng không nhận được đường dẫn ảnh. Vui lòng thử lại!');
        return null;
      }
      return url;
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Không thể tải tệp lên. Vui lòng thử lại!');
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploading, upload };
}

/* ImageUpload --------------------------------------------------------------- */
export const ImageUpload: React.FC<{
  value: string;
  onChange: (url: string) => void;
  examId: string | number | null;
  /** kích thước thumbnail: 'sm' (80px) | 'lg' (full width) */
  size?: 'sm' | 'lg';
  placeholder?: string;
}> = ({ value, onChange, examId, size = 'lg', placeholder = 'Tải ảnh lên' }) => {
  const { uploading, upload } = useMediaUpload(examId);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file, 'image');
    if (url) onChange(url);
  };

  if (value) {
    return (
      <div className={`relative inline-block ${size === 'lg' ? 'w-full max-w-md' : ''}`}>
        {/* BUG FIX "không tải được ảnh": dữ liệu cũ (và một số API) trả đường
            dẫn tương đối /storage/... — nếu gán thẳng vào src thì ảnh hỏng,
            giáo viên tưởng là upload thất bại. */}
        <img
          src={getFullMediaUrl(value) ?? value}
          alt=""
          className={`rounded-lg border border-slate-200 object-cover ${
            size === 'sm' ? 'h-20 w-20' : 'w-full'
          }`}
        />
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-sm transition-colors hover:bg-red-600"
          aria-label="Xóa ảnh"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <label
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-500 transition-colors hover:border-orange-400 hover:bg-orange-50/40 ${
        size === 'sm' ? 'h-20 w-20' : 'px-6 py-8'
      }`}
    >
      {uploading ? (
        <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
      ) : (
        <>
          <Upload className={size === 'sm' ? 'h-5 w-5' : 'mb-1.5 h-6 w-6'} />
          {size === 'lg' && <span className="text-sm font-medium">{placeholder}</span>}
        </>
      )}
      <input type="file" accept="image/*" onChange={handleFile} className="hidden" disabled={uploading} />
    </label>
  );
};

/* AudioUpload --------------------------------------------------------------- */
export const AudioUpload: React.FC<{
  value: string;
  onChange: (url: string) => void;
  examId: string | number | null;
}> = ({ value, onChange, examId }) => {
  const { uploading, upload } = useMediaUpload(examId);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file, 'audio');
    if (url) onChange(url);
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <audio controls src={getFullMediaUrl(value) ?? value} className="h-9 flex-1" />
        <button
          type="button"
          onClick={() => onChange('')}
          className="flex-shrink-0 rounded-md p-1.5 text-red-500 transition-colors hover:bg-red-50"
          aria-label="Xóa audio"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500 transition-colors hover:border-orange-400 hover:bg-orange-50/40">
      {uploading ? (
        <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
      ) : (
        <>
          <Upload className="h-5 w-5" />
          <span>Tải audio lên</span>
        </>
      )}
      <input type="file" accept="audio/*" onChange={handleFile} className="hidden" disabled={uploading} />
    </label>
  );
};

/* AddItemButton ------------------------------------------------------------- */
export const AddItemButton: React.FC<{
  onClick: () => void;
  label?: string;
}> = ({ onClick, label = 'Thêm mục' }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-orange-400 hover:bg-orange-50/40 hover:text-orange-600"
  >
    <Plus className="h-4 w-4" />
    {label}
  </button>
);

/* ItemCard — khung 1 dòng item có nút xóa inline -------------------------- */
export const ItemCard: React.FC<{
  index: number;
  onRemove: () => void;
  children: React.ReactNode;
}> = ({ index, onRemove, children }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-3">
    <div className="mb-2 flex items-center justify-between">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Mục {index + 1}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
        aria-label="Xóa mục"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
    {children}
  </div>
);

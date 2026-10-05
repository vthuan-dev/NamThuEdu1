import { useState } from 'react';
import { getFullMediaUrl } from '../../../utils/mediaUtils';
import { Plus, Trash2, CheckCircle2, ZoomIn, X, Lightbulb, FileText } from 'lucide-react';

/**
 * FindDifferences — "Tìm điểm khác nhau giữa 2 bức tranh".
 * Hỗ trợ:
 * - Hiển thị 2 hình ảnh A & B so sánh song song, hỗ trợ phóng to chi tiết.
 * - Hiển thị danh sách điểm khác biệt mẫu (tiêu chí chấm bài nói) trong chế độ preview/review.
 * - Hiển thị hướng dẫn chấm bài / giải thích (qExplanation).
 * - Học viên gõ các điểm khác biệt tìm được → lưu { differences: string[] }.
 */
interface Props {
  question: any;
  taskData?: any;
  mode?: 'student' | 'preview' | 'review';
  interactiveMode?: boolean;
  answer?: any;
  userAnswer?: any;
  onAnswer?: (answer: any) => void;
  onAnswerChange?: (answer: any) => void;
}

export function FindDifferences(props: Props) {
  const { question } = props;
  const taskData = props.taskData ?? question?.kids_task_config ?? {};
  const realTaskData = taskData.task_data || taskData;
  const config = taskData.config || realTaskData.config || {};

  const isPreview = props.mode === 'preview';
  const isReview = props.mode === 'review';
  const isTeacherView = isPreview || isReview;
  const interactive = props.mode === 'student' || props.interactiveMode === true;
  const save = props.onAnswer ?? props.onAnswerChange;
  const ans = props.answer ?? props.userAnswer ?? {};

  const [zoomedImage, setZoomedImage] = useState<{ url: string; label: string } | null>(null);

  // Normalize comparison images
  let images: Array<{ url: string; label: string }> = [];

  const rawImages = realTaskData?.images || config?.images || taskData?.images;
  if (Array.isArray(rawImages) && rawImages.length > 0) {
    images = rawImages.map((img: any, idx: number) => {
      const url = typeof img === 'string' ? img : img?.url || img?.src || '';
      const label =
        typeof img === 'object' && img?.label
          ? img.label
          : idx === 0
          ? 'Hình A'
          : idx === 1
          ? 'Hình B'
          : `Hình ${idx + 1}`;
      return { url, label };
    });
  } else {
    const imgA =
      realTaskData?.image_a_url ||
      realTaskData?.imageAUrl ||
      realTaskData?.image_a ||
      config?.image_a_url ||
      config?.imageAUrl ||
      config?.image_a ||
      taskData?.image_a_url ||
      taskData?.imageAUrl;

    const imgB =
      realTaskData?.image_b_url ||
      realTaskData?.imageBUrl ||
      realTaskData?.image_b ||
      config?.image_b_url ||
      config?.imageBUrl ||
      config?.image_b ||
      taskData?.image_b_url ||
      taskData?.imageBUrl;

    if (imgA) images.push({ url: imgA, label: 'Hình A' });
    if (imgB) images.push({ url: imgB, label: 'Hình B' });
  }

  // Model differences (cấu hình bởi giáo viên để chấm bài nói)
  const rawDiffs =
    realTaskData?.differences ||
    config?.differences ||
    taskData?.differences ||
    realTaskData?.question_data?.differences ||
    config?.question_data?.differences;
  const modelDifferences: string[] = Array.isArray(rawDiffs) ? rawDiffs.filter((d: any) => typeof d === 'string' && d.trim().length > 0) : [];

  // Title, Instruction & Explanation
  const title =
    taskData?.task_name ||
    realTaskData?.task_name ||
    question?.qContent ||
    'Tìm điểm khác biệt';

  const instruction =
    taskData?.instructions ||
    realTaskData?.instructions ||
    config?.instructions ||
    'So sánh 2 bức tranh và viết hoặc nói ra những điểm khác nhau em tìm được.';

  const explanation =
    question?.qExplanation ||
    realTaskData?.explanation ||
    config?.explanation;

  // Student inputs
  const current: string[] = Array.isArray(ans?.differences) ? ans.differences : [];
  const suggested = Number(realTaskData?.numberOfDifferences || config?.numberOfDifferences || 0);
  const rows = Math.max(current.length, suggested || 3);
  const values = Array.from({ length: rows }, (_, i) => current[i] ?? '');

  const update = (i: number, v: string) => {
    if (!save) return;
    const next = [...values];
    next[i] = v;
    save({ differences: next });
  };

  const addRow = () => {
    if (!save) return;
    save({ differences: [...values, ''] });
  };

  const removeRow = (i: number) => {
    if (!save) return;
    save({ differences: values.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="space-y-6">
      {/* Banner Tiêu đề & Hướng dẫn */}
      <div className="rounded-2xl bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border-2 border-orange-200 px-5 py-4 shadow-xs">
        <div className="flex items-start gap-3">
          <span className="text-2xl mt-0.5">🔍</span>
          <div className="space-y-1">
            <h3 className="text-orange-950 font-bold text-lg">{title}</h3>
            {instruction && instruction !== title && (
              <p className="text-orange-800 text-sm font-medium">{instruction}</p>
            )}
          </div>
        </div>
      </div>

      {/* 2 Hình ảnh A và B để so sánh */}
      {images.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {images.map((img, idx) => {
            const mediaUrl = getFullMediaUrl(img.url);
            return (
              <div
                key={idx}
                className="group rounded-2xl border-2 border-purple-200 overflow-hidden bg-white shadow-sm hover:shadow-md transition-all flex flex-col"
              >
                <div className="bg-purple-50/80 px-4 py-2.5 border-b border-purple-100 flex items-center justify-between">
                  <span className="font-bold text-purple-900 text-sm flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                      {idx === 0 ? 'A' : idx === 1 ? 'B' : idx + 1}
                    </span>
                    {img.label}
                  </span>
                  {mediaUrl && (
                    <button
                      type="button"
                      onClick={() => setZoomedImage({ url: mediaUrl, label: img.label })}
                      className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-semibold px-2 py-1 rounded-md hover:bg-purple-100/60 transition-colors"
                      title="Xem phóng to"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                      Phóng to
                    </button>
                  )}
                </div>
                <div
                  className="p-3 bg-slate-50/60 flex items-center justify-center min-h-[240px] sm:min-h-[280px] cursor-pointer"
                  onClick={() => mediaUrl && setZoomedImage({ url: mediaUrl, label: img.label })}
                >
                  {mediaUrl ? (
                    <img
                      src={mediaUrl}
                      alt={img.label}
                      className="w-full max-h-[380px] sm:max-h-[420px] object-contain rounded-xl transition-transform group-hover:scale-[1.01]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="text-center text-slate-400 py-12 text-sm">Không tìm thấy ảnh</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-6 text-center text-amber-800">
          <p className="font-bold text-base">⚠️ Chưa có hình ảnh so sánh</p>
          <p className="text-sm mt-1 text-amber-600">
            Vui lòng tải lên Hình A và Hình B trong phần cấu hình câu hỏi.
          </p>
        </div>
      )}

      {/* Danh sách điểm khác biệt mẫu (Dùng để chấm bài nói) - hiển thị trong xem trước hoặc xem lại */}
      {isTeacherView && modelDifferences.length > 0 && (
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/70 p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="font-bold text-emerald-950 text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>Danh sách điểm khác biệt ({modelDifferences.length} điểm - Đáp án / Tiêu chí chấm)</span>
            </h4>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
              Dùng để chấm bài nói
            </span>
          </div>
          <p className="text-xs text-emerald-800">
            Giáo viên dựa vào các điểm khác biệt dưới đây để đối chiếu và chấm phát âm, ngữ pháp hoặc nội dung của thí sinh:
          </p>
          <div className="space-y-2 pt-1">
            {modelDifferences.map((diff, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 bg-white p-3 rounded-xl border border-emerald-200/80 shadow-xs"
              >
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs mt-0.5 shadow-xs">
                  {idx + 1}
                </span>
                <p className="text-slate-800 text-sm font-medium leading-relaxed">{diff}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hướng dẫn chấm & Giải thích */}
      {isTeacherView && explanation && (
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/80 p-4 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <Lightbulb className="w-4 h-4 text-amber-600" />
            <span>Hướng dẫn chấm bài &amp; Giải thích chi tiết:</span>
          </div>
          <p className="text-amber-950 text-sm leading-relaxed pl-6 whitespace-pre-line font-medium">
            {explanation}
          </p>
        </div>
      )}

      {/* Inputs điểm khác biệt cho học sinh */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <p className="font-bold text-slate-700 flex items-center gap-2 text-[15px]">
            <FileText className="w-4 h-4 text-purple-600" />
            {isTeacherView
              ? 'Giao diện làm bài của học sinh (Điểm khác nhau em tìm được):'
              : 'Điểm khác nhau em tìm được:'}
          </p>
          {isTeacherView && (
            <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded">
              Xem thử tương tác
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          {values.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                {i + 1}
              </span>
              <input
                type="text"
                value={v}
                disabled={!interactive}
                onChange={(e) => update(i, e.target.value)}
                placeholder="VD: Bức tranh A có con mèo, bức tranh B không có…"
                className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-2.5 text-[15px] outline-none focus:border-purple-400 transition-colors disabled:bg-slate-50 disabled:text-slate-600"
              />
              {interactive && values.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="flex-shrink-0 p-2 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                  aria-label="Xoá"
                  title="Xoá dòng này"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {interactive && (
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-100 text-purple-700 font-bold text-sm hover:bg-purple-200 transition-colors mt-1 shadow-xs"
          >
            <Plus className="w-4 h-4" /> Thêm dòng
          </button>
        )}
      </div>

      {/* Modal phóng to ảnh */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="relative bg-white rounded-2xl max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <span className="font-bold text-slate-800">{zoomedImage.label}</span>
              <button
                type="button"
                onClick={() => setZoomedImage(null)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex items-center justify-center bg-slate-900/5">
              <img
                src={zoomedImage.url}
                alt={zoomedImage.label}
                className="max-w-full max-h-[78vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

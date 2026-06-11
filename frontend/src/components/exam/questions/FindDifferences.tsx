import { getFullMediaUrl } from '../../../utils/mediaUtils';
import { Plus, Trash2 } from 'lucide-react';

/**
 * FindDifferences — "Tìm điểm khác nhau giữa 2 bức tranh".
 * Học viên gõ các điểm khác biệt tìm được → lưu { differences: string[] }.
 * Nhận cả 2 contract props (bridge bởi QuestionRenderer).
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

  const interactive = props.mode === 'student' || props.interactiveMode === true;
  const save = props.onAnswer ?? props.onAnswerChange;
  const ans = props.answer ?? props.userAnswer ?? {};

  const images: any[] = realTaskData?.images || config?.images || [];
  const instruction =
    realTaskData?.instructions || config?.instructions || question?.qContent ||
    'Nhìn 2 bức tranh và viết những điểm khác nhau em tìm được.';

  // Số ô gợi ý (theo config nếu có), tối thiểu 3.
  const suggested = Number(realTaskData?.numberOfDifferences || config?.numberOfDifferences || 0);
  const current: string[] = Array.isArray(ans?.differences) ? ans.differences : [];
  const rows = Math.max(current.length, suggested || 3);
  const values = Array.from({ length: rows }, (_, i) => current[i] ?? '');

  const update = (i: number, v: string) => {
    if (!interactive || !save) return;
    const next = [...values];
    next[i] = v;
    save({ differences: next });
  };
  const addRow = () => { if (interactive && save) save({ differences: [...values, ''] }); };
  const removeRow = (i: number) => {
    if (!interactive || !save) return;
    save({ differences: values.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-orange-50 border-2 border-orange-200 px-5 py-4">
        <p className="text-orange-900 font-bold text-lg flex items-center gap-2">
          <span className="text-2xl">🔍</span>{instruction}
        </p>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {images.map((img: any, idx: number) => (
            <div key={idx} className="rounded-2xl border-4 border-purple-200 overflow-hidden bg-white">
              <img src={getFullMediaUrl(img.url || img)} alt={`Tranh ${idx + 1}`} className="w-full object-contain" style={{ maxHeight: 240 }} />
              <div className="p-2 text-center font-bold text-slate-600 bg-slate-50">
                {img.label || `Tranh ${idx + 1}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inputs điểm khác biệt */}
      <div className="space-y-2.5">
        <p className="font-bold text-slate-700">✏️ Điểm khác nhau em tìm được:</p>
        {values.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-sm">
              {i + 1}
            </span>
            <input
              type="text"
              value={v}
              disabled={!interactive}
              onChange={(e) => update(i, e.target.value)}
              placeholder="VD: Bức tranh A có con mèo, bức tranh B không có…"
              className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-2.5 text-[15px] outline-none focus:border-purple-400 transition-colors disabled:bg-slate-50"
            />
            {interactive && values.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="flex-shrink-0 p-2 rounded-lg text-rose-500 hover:bg-rose-50"
                aria-label="Xoá"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {interactive && (
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-100 text-purple-700 font-bold text-sm hover:bg-purple-200 transition-colors"
          >
            <Plus className="w-4 h-4" /> Thêm dòng
          </button>
        )}
      </div>
    </div>
  );
}

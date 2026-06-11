import { getFullMediaUrl } from '../../../utils/mediaUtils';

/**
 * ObjectPlacement — "Đặt đồ vật vào đúng vị trí".
 * Player học viên không có hạ tầng kéo–thả → cho mỗi vật chọn vị trí (nếu có
 * danh sách zones) hoặc gõ vị trí. Lưu { [itemIdx]: <zone|text> }.
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

export function ObjectPlacement(props: Props) {
  const { question } = props;
  const taskData = props.taskData ?? question?.kids_task_config ?? {};
  const realTaskData = taskData.task_data || taskData;
  const config = taskData.config || realTaskData.config || {};

  const interactive = props.mode === 'student' || props.interactiveMode === true;
  const save = props.onAnswer ?? props.onAnswerChange;
  const ans = props.answer ?? props.userAnswer ?? {};

  const instructions =
    taskData.instructions || realTaskData.instructions || config.instructions || question?.qContent ||
    'Chọn vị trí đúng cho mỗi đồ vật.';
  const items: any[] = realTaskData?.items || config?.items || [];
  const imageUrl = realTaskData?.imageUrl || realTaskData?.image_url || config?.imageUrl || config?.image_url;

  // Danh sách vị trí (nếu đề cấu hình sẵn) → render dropdown; nếu không → ô nhập text.
  const rawZones: any[] = realTaskData?.zones || config?.zones || realTaskData?.positions || config?.positions || [];
  const zones = rawZones.map((z: any, i: number) =>
    typeof z === 'string' ? { value: z, label: z } : { value: z.id ?? z.value ?? z.label ?? i, label: z.label ?? z.name ?? String(z.id ?? i) }
  );

  const update = (idx: number, v: string) => {
    if (!interactive || !save) return;
    save({ ...ans, [idx]: v });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-purple-50 border-2 border-purple-200 px-5 py-4">
        <p className="text-purple-900 font-bold text-lg flex items-center gap-2">
          <span className="text-2xl">📍</span>{instructions}
        </p>
      </div>

      {imageUrl && (
        <div className="rounded-2xl border-4 border-purple-200 overflow-hidden bg-white">
          <img src={getFullMediaUrl(imageUrl)} alt="Đặt đồ vật" className="w-full h-auto object-contain" style={{ maxHeight: 520 }} />
        </div>
      )}

      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item: any, idx: number) => {
            const itemImageUrl = item.imageUrl || item.image_url || item.image;
            const itemName = item.name || item.text || item.label || `Đồ vật ${idx + 1}`;
            return (
              <div key={idx} className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white p-3">
                {itemImageUrl ? (
                  <img src={getFullMediaUrl(itemImageUrl)} alt={itemName} className="w-16 h-16 object-contain flex-shrink-0 rounded-lg bg-slate-50" />
                ) : (
                  <span className="w-9 h-9 flex-shrink-0 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold">{idx + 1}</span>
                )}
                <span className="font-bold text-slate-700 flex-shrink-0 min-w-[80px]">{itemName}</span>
                {zones.length > 0 ? (
                  <select
                    value={ans?.[idx] ?? ''}
                    disabled={!interactive}
                    onChange={(e) => update(idx, e.target.value)}
                    className="flex-1 rounded-xl border-2 border-slate-200 px-3 py-2.5 text-[15px] outline-none focus:border-purple-400 transition-colors disabled:bg-slate-50"
                  >
                    <option value="">— Chọn vị trí —</option>
                    {zones.map((z, zi) => (
                      <option key={zi} value={String(z.value)}>{z.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={ans?.[idx] ?? ''}
                    disabled={!interactive}
                    onChange={(e) => update(idx, e.target.value)}
                    placeholder="Em đặt ở đâu? (VD: on the table)"
                    className="flex-1 rounded-xl border-2 border-slate-200 px-3.5 py-2.5 text-[15px] outline-none focus:border-purple-400 transition-colors disabled:bg-slate-50"
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl bg-amber-50 border-2 border-amber-200 p-5 text-center text-amber-800 font-medium">
          ⚠️ Câu hỏi này chưa có đồ vật.
        </div>
      )}
    </div>
  );
}

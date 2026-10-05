import { getFullMediaUrl } from '../../../utils/mediaUtils';
import { Lightbulb, MapPin, CheckCircle2 } from 'lucide-react';

/**
 * ObjectPlacement — "Đặt đồ vật vào đúng vị trí".
 * Hỗ trợ:
 * - Ảnh nền chính (base_image_url / imageUrl).
 * - Danh sách đồ vật / thẻ hình (cardImageUrl / imageUrl).
 * - Chọn vị trí hoặc gõ vị trí.
 * - Hiển thị đáp án và toạ độ mục tiêu trong chế độ xem trước (preview/review).
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

  const isPreview = props.mode === 'preview';
  const isReview = props.mode === 'review';
  const isTeacherView = isPreview || isReview;
  const interactive = props.mode === 'student' || props.interactiveMode === true;
  const save = props.onAnswer ?? props.onAnswerChange;
  const ans = props.answer ?? props.userAnswer ?? {};

  const instructions =
    taskData.instructions ||
    realTaskData.instructions ||
    config.instructions ||
    question?.qContent ||
    'Nhìn tranh và đặt đồ vật vào đúng vị trí.';

  const items: any[] = realTaskData?.items || config?.items || [];
  const imageUrl =
    realTaskData?.base_image_url ||
    realTaskData?.baseImageUrl ||
    config?.base_image_url ||
    config?.baseImageUrl ||
    realTaskData?.imageUrl ||
    realTaskData?.image_url ||
    config?.imageUrl ||
    config?.image_url ||
    taskData?.imageUrl ||
    question?.qMedia_url;

  const explanation =
    question?.qExplanation ||
    realTaskData?.explanation ||
    config?.explanation;

  // Danh sách vị trí (zones/positions)
  const rawZones: any[] =
    realTaskData?.zones ||
    config?.zones ||
    realTaskData?.positions ||
    config?.positions ||
    [];

  const zones = rawZones.map((z: any, i: number) =>
    typeof z === 'string'
      ? { value: z, label: z }
      : { value: z.id ?? z.value ?? z.label ?? i, label: z.label ?? z.name ?? String(z.id ?? i) }
  );

  const update = (idx: number, v: string) => {
    if (!interactive || !save) return;
    save({ ...ans, [idx]: v });
  };

  return (
    <div className="space-y-6">
      {/* Banner hướng dẫn */}
      <div className="rounded-2xl bg-purple-50 border-2 border-purple-200 px-5 py-4 shadow-xs">
        <p className="text-purple-900 font-bold text-lg flex items-center gap-2">
          <span className="text-2xl">📍</span>
          <span>{instructions}</span>
        </p>
      </div>

      {/* Ảnh nền bức tranh */}
      {imageUrl ? (
        <div className="rounded-2xl border-2 border-purple-200 overflow-hidden bg-white shadow-xs p-2 flex justify-center">
          <img
            src={getFullMediaUrl(imageUrl) || ''}
            alt="Đặt đồ vật"
            className="w-full max-h-[520px] object-contain rounded-xl"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-6 text-center text-amber-800">
          ⚠️ Chưa có hình ảnh nền cho câu hỏi này.
        </div>
      )}

      {/* Danh sách các đồ vật / thẻ hình cần đặt */}
      {items.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
            <span>🏷️</span> Danh sách đồ vật cần đặt:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((item: any, idx: number) => {
              const itemImageUrl =
                item.cardImageUrl ||
                item.card_image_url ||
                item.imageUrl ||
                item.image_url ||
                item.image;
              const itemName = item.name || item.text || item.label || `Đồ vật ${idx + 1}`;
              const targetCoords =
                item.correctX != null && item.correctY != null
                  ? `(x: ${Math.round(item.correctX)}%, y: ${Math.round(item.correctY)}%)`
                  : null;

              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white p-3.5 shadow-xs hover:border-purple-300 transition-colors"
                >
                  {itemImageUrl ? (
                    <img
                      src={getFullMediaUrl(itemImageUrl) || ''}
                      alt={itemName}
                      className="w-16 h-16 object-contain flex-shrink-0 rounded-xl bg-slate-50 border border-slate-100 p-1"
                    />
                  ) : (
                    <span className="w-10 h-10 flex-shrink-0 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                      {idx + 1}
                    </span>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{itemName}</p>
                    {isTeacherView && (targetCoords || item.correct_zone) && (
                      <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Vị trí đúng: {item.correct_zone || targetCoords}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex-shrink-0 w-44">
                    {zones.length > 0 ? (
                      <select
                        value={ans?.[idx] ?? ''}
                        disabled={!interactive}
                        onChange={(e) => update(idx, e.target.value)}
                        className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-purple-400 transition-colors disabled:bg-slate-50 font-medium"
                      >
                        <option value="">— Chọn vị trí —</option>
                        {zones.map((z, zi) => (
                          <option key={zi} value={String(z.value)}>
                            {z.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={ans?.[idx] ?? ''}
                        disabled={!interactive}
                        onChange={(e) => update(idx, e.target.value)}
                        placeholder="Vị trí đặt…"
                        className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-purple-400 transition-colors disabled:bg-slate-50 font-medium"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-amber-50 border-2 border-amber-200 p-5 text-center text-amber-800 font-medium">
          ⚠️ Câu hỏi này chưa có danh sách đồ vật.
        </div>
      )}

      {/* Hướng dẫn giải thích */}
      {isTeacherView && explanation && (
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/80 p-4 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <Lightbulb className="w-4 h-4 text-amber-600" />
            <span>Hướng dẫn &amp; Giải thích:</span>
          </div>
          <p className="text-amber-950 text-sm leading-relaxed pl-6 whitespace-pre-line font-medium">
            {explanation}
          </p>
        </div>
      )}
    </div>
  );
}

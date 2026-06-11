import { getFullMediaUrl } from '../../../utils/mediaUtils';

/**
 * PictureCardQuestions — "Nhìn thẻ hình và trả lời".
 * Mỗi thẻ có 1 ô nhập câu trả lời → lưu { [cardIdx]: string }.
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

export function PictureCardQuestions(props: Props) {
  const { question } = props;
  const taskData = props.taskData ?? question?.kids_task_config ?? {};
  const realTaskData = taskData.task_data || taskData;
  const config = taskData.config || realTaskData.config || {};

  const interactive = props.mode === 'student' || props.interactiveMode === true;
  const save = props.onAnswer ?? props.onAnswerChange;
  const ans = props.answer ?? props.userAnswer ?? {};

  const cards: any[] = realTaskData?.cards || config?.cards || [];
  const instructions =
    realTaskData?.instructions || config?.instructions || question?.qContent ||
    'Nhìn thẻ hình và viết câu trả lời của em.';

  const update = (idx: number, v: string) => {
    if (!interactive || !save) return;
    save({ ...ans, [idx]: v });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-purple-50 border-2 border-purple-200 px-5 py-4">
        <p className="text-purple-900 font-bold text-lg flex items-center gap-2">
          <span className="text-2xl">🎴</span>{instructions}
        </p>
      </div>

      {cards.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map((card: any, idx: number) => {
            const cardImageUrl = card.imageUrl || card.image_url || card.image;
            const cardText = card.text || card.label || card.name;
            return (
              <div key={idx} className="rounded-2xl border-2 border-purple-200 bg-white p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-purple-500 text-white flex items-center justify-center font-extrabold text-sm">
                    {idx + 1}
                  </span>
                  {cardText && <p className="font-bold text-slate-700">{cardText}</p>}
                </div>
                {cardImageUrl && (
                  <div className="rounded-xl overflow-hidden bg-slate-50 border border-slate-100">
                    <img
                      src={getFullMediaUrl(cardImageUrl)}
                      alt={`Thẻ ${idx + 1}`}
                      className="w-full h-auto object-contain"
                      style={{ maxHeight: 200 }}
                    />
                  </div>
                )}
                <input
                  type="text"
                  value={ans?.[idx] ?? ''}
                  disabled={!interactive}
                  onChange={(e) => update(idx, e.target.value)}
                  placeholder="Câu trả lời của em…"
                  className="w-full rounded-xl border-2 border-slate-200 px-3.5 py-2.5 text-[15px] outline-none focus:border-purple-400 transition-colors disabled:bg-slate-50"
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl bg-amber-50 border-2 border-amber-200 p-5 text-center text-amber-800 font-medium">
          ⚠️ Câu hỏi này chưa có thẻ hình.
        </div>
      )}
    </div>
  );
}

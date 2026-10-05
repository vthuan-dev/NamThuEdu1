import { getFullMediaUrl } from '../../../utils/mediaUtils';
import { Lightbulb, CheckCircle2 } from 'lucide-react';

/**
 * PictureCardQuestions — "Nhìn thẻ hình và trả lời".
 * Mỗi thẻ có 1 ảnh, 1 câu hỏi và ô nhập câu trả lời → lưu { [cardIdx]: string }.
 * Hiển thị câu trả lời mẫu trong chế độ xem trước (preview/review).
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

  const isPreview = props.mode === 'preview';
  const isReview = props.mode === 'review';
  const isTeacherView = isPreview || isReview;
  const interactive = props.mode === 'student' || props.interactiveMode === true;
  const save = props.onAnswer ?? props.onAnswerChange;
  const ans = props.answer ?? props.userAnswer ?? {};

  const cards: any[] = realTaskData?.cards || config?.cards || [];
  const instructions =
    taskData?.instructions ||
    realTaskData?.instructions ||
    config?.instructions ||
    question?.qContent ||
    'Nhìn thẻ hình và trả lời câu hỏi.';

  const explanation =
    question?.qExplanation ||
    realTaskData?.explanation ||
    config?.explanation;

  const update = (idx: number, v: string) => {
    if (!interactive || !save) return;
    save({ ...ans, [idx]: v });
  };

  return (
    <div className="space-y-6">
      {/* Banner hướng dẫn */}
      <div className="rounded-2xl bg-purple-50 border-2 border-purple-200 px-5 py-4 shadow-xs">
        <p className="text-purple-900 font-bold text-lg flex items-center gap-2">
          <span className="text-2xl">🎴</span>
          <span>{instructions}</span>
        </p>
      </div>

      {/* Grid thẻ hình */}
      {cards.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map((card: any, idx: number) => {
            const cardImageUrl = card.imageUrl || card.image_url || card.image;
            const cardQuestion = card.question || card.text || card.label || card.name;
            const sampleAnswer = card.sampleAnswer || card.sample_answer || card.answer;

            return (
              <div
                key={idx}
                className="rounded-2xl border-2 border-purple-200 bg-white p-4 space-y-3 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center font-extrabold text-sm shadow-xs flex-shrink-0">
                      {idx + 1}
                    </span>
                    {cardQuestion && (
                      <p className="font-bold text-slate-800 text-[15px]">{cardQuestion}</p>
                    )}
                  </div>

                  {cardImageUrl && (
                    <div className="rounded-xl overflow-hidden bg-slate-50 border border-slate-100 p-2 flex items-center justify-center min-h-[160px]">
                      <img
                        src={getFullMediaUrl(cardImageUrl) || ''}
                        alt={`Thẻ ${idx + 1}`}
                        className="w-full max-h-[220px] object-contain rounded-lg"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Hiển thị câu trả lời mẫu cho giáo viên */}
                  {isTeacherView && sampleAnswer && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-emerald-900 font-semibold leading-relaxed">
                        Gợi ý đáp án: <span className="font-normal">{sampleAnswer}</span>
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <input
                    type="text"
                    value={ans?.[idx] ?? ''}
                    disabled={!interactive}
                    onChange={(e) => update(idx, e.target.value)}
                    placeholder="Câu trả lời của em…"
                    className="w-full rounded-xl border-2 border-slate-200 px-3.5 py-2.5 text-[15px] outline-none focus:border-purple-400 transition-colors disabled:bg-slate-50 disabled:text-slate-600"
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl bg-amber-50 border-2 border-amber-200 p-5 text-center text-amber-800 font-medium">
          ⚠️ Câu hỏi này chưa có thẻ hình.
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

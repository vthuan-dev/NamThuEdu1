import { getFullMediaUrl } from '../../../utils/mediaUtils';
import { CheckCircle2, Lightbulb } from 'lucide-react';

/**
 * OddOneOut — "Tìm đồ vật khác nhóm".
 *
 * Học viên chọn 1 trong các hình → component lưu { selected: <id|index> }.
 * Nhận cả contract mới (mode/answer/onAnswer) lẫn cũ (interactiveMode/userAnswer/
 * onAnswerChange) do QuestionRenderer bridge.
 */
interface OddOneOutProps {
  question: any;
  taskData?: any;
  mode?: 'student' | 'preview' | 'review';
  interactiveMode?: boolean;
  answer?: any;
  userAnswer?: any;
  onAnswer?: (answer: any) => void;
  onAnswerChange?: (answer: any) => void;
}

export function OddOneOut(props: OddOneOutProps) {
  const { question } = props;
  const taskData = props.taskData ?? question?.kids_task_config ?? {};
  const realTaskData = taskData.task_data || taskData;
  const config = taskData.config || realTaskData.config || {};

  const isPreview = props.mode === 'preview';
  const isReview = props.mode === 'review';
  const isTeacherView = isPreview || isReview;
  const interactive = props.mode === 'student' || props.interactiveMode === true;
  const onPick = props.onAnswer ?? props.onAnswerChange;
  const answerObj = props.answer ?? props.userAnswer ?? {};
  const selected = answerObj?.selected ?? null;

  // Hỗ trợ nhiều shape dữ liệu (images / question_data.images)
  const images: any[] =
    realTaskData?.images ||
    config?.images ||
    realTaskData?.question_data?.images ||
    config?.question_data?.images ||
    [];

  const correctOddOne =
    realTaskData?.correct_odd_one ||
    config?.correct_odd_one ||
    realTaskData?.question_data?.correct_odd_one ||
    config?.question_data?.correct_odd_one;

  const explanation =
    question?.qExplanation ||
    realTaskData?.explanation ||
    config?.explanation;

  const instruction =
    realTaskData?.instructions ||
    config?.instructions ||
    taskData?.instructions ||
    question?.qContent ||
    'Chọn đồ vật khác nhóm với các đồ vật còn lại.';

  const keyOf = (img: any, idx: number) => img?.id ?? idx + 1;

  const handlePick = (img: any, idx: number) => {
    if (!interactive || !onPick) return;
    onPick({ selected: keyOf(img, idx) });
  };

  return (
    <div className="space-y-5">
      {/* Instruction */}
      <div className="rounded-2xl bg-purple-50 border-2 border-purple-200 px-5 py-4">
        <p className="text-purple-900 font-bold text-lg flex items-center gap-2">
          <span className="text-2xl">🧐</span>
          {instruction}
        </p>
        {interactive && (
          <p className="mt-1 text-sm text-purple-500 font-medium">
            Nhấn vào hình em chọn nhé! 👇
          </p>
        )}
      </div>

      {/* Image grid */}
      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {images.map((img: any, idx: number) => {
            const k = keyOf(img, idx);
            const isSelected = selected != null && String(selected) === String(k);
            const isCorrect = isTeacherView && correctOddOne != null && Number(correctOddOne) === Number(k);

            return (
              <button
                key={k}
                type="button"
                onClick={() => handlePick(img, idx)}
                disabled={!interactive}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border-4 bg-white transition-all duration-150 ${
                  interactive ? 'cursor-pointer hover:-translate-y-1 hover:shadow-xl active:scale-[0.98]' : 'cursor-default'
                } ${
                  isCorrect
                    ? 'border-emerald-500 ring-4 ring-emerald-200 shadow-md'
                    : isSelected
                    ? 'border-orange-500 ring-4 ring-orange-200 shadow-lg'
                    : 'border-slate-200 hover:border-purple-300'
                }`}
              >
                {/* Badge số thứ tự */}
                <span
                  className={`absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold text-white shadow ${
                    isCorrect ? 'bg-emerald-600' : isSelected ? 'bg-orange-500' : 'bg-purple-500'
                  }`}
                >
                  {idx + 1}
                </span>

                {/* Badge đáp án đúng trong chế độ giáo viên xem trước */}
                {isCorrect && (
                  <span className="absolute right-2 top-2 z-10 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white shadow">
                    Khác loại
                  </span>
                )}

                {/* Checkmark khi chọn */}
                {!isCorrect && isSelected && (
                  <span className="absolute right-2 top-2 z-10">
                    <CheckCircle2 className="h-7 w-7 text-orange-500 fill-white" />
                  </span>
                )}

                <div className="h-36 sm:h-44 w-full bg-slate-50 flex items-center justify-center overflow-hidden p-2">
                  <img
                    src={getFullMediaUrl(img?.url || img) || ''}
                    alt={`Hình ${idx + 1}`}
                    className="h-full w-full object-contain"
                  />
                </div>

                {(img?.label || img?.category) && (
                  <div className="p-2 text-center text-sm font-bold text-slate-700 bg-slate-50/80 border-t border-slate-100">
                    {img?.label || img?.category}
                    {isTeacherView && img?.category && img?.label && (
                      <span className="block text-xs font-normal text-slate-500">Loại: {img.category}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl bg-amber-50 border-2 border-amber-200 p-5 text-center text-amber-800 font-medium">
          ⚠️ Câu hỏi này chưa có hình.
        </div>
      )}

      {/* Hiển thị đáp án đúng & giải thích cho giáo viên */}
      {isTeacherView && (correctOddOne || explanation) && (
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
          {correctOddOne && (
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Đáp án đúng (Khác loại): Hình {correctOddOne}</span>
            </div>
          )}
          {explanation && (
            <div className="flex items-start gap-2 text-slate-700 text-sm">
              <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed whitespace-pre-line">{explanation}</p>
            </div>
          )}
        </div>
      )}

      {/* Trạng thái đã chọn */}
      {interactive && selected != null && (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 border-2 border-emerald-200 py-2.5 text-emerald-700 font-bold">
          <CheckCircle2 className="h-5 w-5" />
          Em đã chọn hình {selected}. Em có thể đổi nếu muốn!
        </div>
      )}
    </div>
  );
}

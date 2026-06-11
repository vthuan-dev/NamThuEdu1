import { getFullMediaUrl } from '../../../utils/mediaUtils';

/**
 * PictureStoryNarration — "Nhìn tranh và kể chuyện".
 * Học viên gõ câu chuyện của mình → lưu { story: string }.
 * (Tác vụ speaking nhưng cho nhập text để học viên trả lời + đánh dấu đã làm.)
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

export function PictureStoryNarration(props: Props) {
  const { question } = props;
  const taskData = props.taskData ?? question?.kids_task_config ?? {};
  const realTaskData = taskData.task_data || taskData;
  const config = taskData.config || realTaskData.config || {};

  const interactive = props.mode === 'student' || props.interactiveMode === true;
  const save = props.onAnswer ?? props.onAnswerChange;
  const ans = props.answer ?? props.userAnswer ?? {};
  const story = ans?.story ?? '';

  const images: any[] = realTaskData?.images || config?.images || [];
  const instruction =
    realTaskData?.instructions || config?.instructions || question?.qContent ||
    'Nhìn các bức tranh và kể lại câu chuyện bằng tiếng Anh nhé!';

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-pink-50 border-2 border-pink-200 px-5 py-4">
        <p className="text-pink-900 font-bold text-lg flex items-center gap-2">
          <span className="text-2xl">📖</span>{instruction}
        </p>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {images.map((img: any, idx: number) => (
            <div key={idx} className="rounded-2xl border-4 border-purple-200 overflow-hidden bg-white">
              <div className="relative">
                <span className="absolute left-2 top-2 z-10 w-7 h-7 rounded-full bg-purple-500 text-white flex items-center justify-center font-extrabold text-sm shadow">
                  {idx + 1}
                </span>
                <img src={getFullMediaUrl(img.url || img)} alt={`Tranh ${idx + 1}`} className="w-full h-auto object-cover aspect-square" />
              </div>
              {img.label && <div className="p-1.5 text-center text-sm font-bold text-slate-600 bg-slate-50">{img.label}</div>}
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="font-bold text-slate-700 mb-2">✏️ Câu chuyện của em:</p>
        <textarea
          value={story}
          disabled={!interactive}
          onChange={(e) => save && save({ story: e.target.value })}
          placeholder="Em viết câu chuyện theo các bức tranh ở đây…"
          rows={5}
          className="w-full rounded-2xl border-2 border-pink-200 p-4 text-[15px] outline-none focus:border-pink-400 transition-colors disabled:bg-slate-50"
        />
      </div>
    </div>
  );
}

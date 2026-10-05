import { getFullMediaUrl } from '../../../utils/mediaUtils';
import { Lightbulb, BookOpen } from 'lucide-react';

/**
 * PictureStoryNarration — "Nhìn tranh và kể chuyện".
 * Học viên gõ câu chuyện của mình hoặc ghi âm → lưu { story: string }.
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

  const isPreview = props.mode === 'preview';
  const isReview = props.mode === 'review';
  const isTeacherView = isPreview || isReview;
  const interactive = props.mode === 'student' || props.interactiveMode === true;
  const save = props.onAnswer ?? props.onAnswerChange;
  const ans = props.answer ?? props.userAnswer ?? {};
  const story = ans?.story ?? '';

  const images: any[] = realTaskData?.images || config?.images || [];
  const prompts: string[] = realTaskData?.prompts || config?.prompts || [];

  const title =
    taskData?.task_name ||
    realTaskData?.task_name ||
    question?.qContent ||
    'Kể chuyện theo tranh';

  const instruction =
    taskData?.instructions ||
    realTaskData?.instructions ||
    config?.instructions ||
    'Nhìn các bức tranh theo thứ tự và kể lại câu chuyện bằng tiếng Anh nhé!';

  const explanation =
    question?.qExplanation ||
    realTaskData?.explanation ||
    config?.explanation;

  return (
    <div className="space-y-6">
      {/* Banner hướng dẫn */}
      <div className="rounded-2xl bg-gradient-to-r from-pink-50 via-purple-50 to-pink-50 border-2 border-pink-200 px-5 py-4 shadow-xs">
        <div className="flex items-start gap-3">
          <span className="text-2xl mt-0.5">📖</span>
          <div className="space-y-1">
            <h3 className="text-pink-950 font-bold text-lg">{title}</h3>
            {instruction && (
              <p className="text-pink-800 text-sm font-medium">{instruction}</p>
            )}
          </div>
        </div>
      </div>

      {/* Grid tranh câu chuyện */}
      {images.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((img: any, idx: number) => {
            const mediaUrl = getFullMediaUrl(img?.url || img);
            const promptText = prompts[idx] || '';

            return (
              <div
                key={idx}
                className="rounded-2xl border-2 border-purple-200 overflow-hidden bg-white shadow-xs hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="relative bg-slate-50 min-h-[180px] flex items-center justify-center p-2">
                  <span className="absolute left-3 top-3 z-10 w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center font-extrabold text-sm shadow">
                    {idx + 1}
                  </span>
                  <img
                    src={mediaUrl || ''}
                    alt={`Tranh ${idx + 1}`}
                    className="w-full max-h-[220px] object-contain rounded-lg"
                  />
                </div>
                {promptText ? (
                  <div className="p-3 bg-purple-50/70 border-t border-purple-100 flex-1 flex flex-col justify-center">
                    <p className="text-xs font-semibold text-purple-900 leading-snug">
                      💬 {promptText}
                    </p>
                  </div>
                ) : img?.label ? (
                  <div className="p-2 text-center text-xs font-bold text-slate-600 bg-slate-50 border-t border-slate-100">
                    {img.label}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl bg-amber-50 border-2 border-amber-200 p-5 text-center text-amber-800 font-medium">
          ⚠️ Câu hỏi này chưa có tranh câu chuyện.
        </div>
      )}

      {/* Hướng dẫn chấm bài & Giải thích */}
      {isTeacherView && explanation && (
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/80 p-4 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <Lightbulb className="w-4 h-4 text-amber-600" />
            <span>Hướng dẫn chấm bài &amp; Tiêu chí gợi ý:</span>
          </div>
          <p className="text-amber-950 text-sm leading-relaxed pl-6 whitespace-pre-line font-medium">
            {explanation}
          </p>
        </div>
      )}

      {/* Phần làm bài */}
      <div>
        <p className="font-bold text-slate-700 mb-2 flex items-center gap-2 text-[15px]">
          <BookOpen className="w-4 h-4 text-pink-600" />
          {isTeacherView
            ? 'Giao diện làm bài của học sinh (Nội dung kể chuyện):'
            : '✏️ Câu chuyện của em:'}
        </p>
        <textarea
          value={story}
          disabled={!interactive}
          onChange={(e) => save && save({ story: e.target.value })}
          placeholder="Em viết câu chuyện theo các bức tranh ở đây…"
          rows={5}
          className="w-full rounded-2xl border-2 border-pink-200 p-4 text-[15px] outline-none focus:border-pink-400 transition-colors disabled:bg-slate-50 disabled:text-slate-600 shadow-xs"
        />
      </div>
    </div>
  );
}

import { Lightbulb, CheckCircle2, BookOpen } from 'lucide-react';

interface StoryCompletionProps {
  question: any;
  taskData: any;
  mode?: 'student' | 'preview' | 'review';
  interactiveMode?: boolean;
  userAnswer?: any;
  answer?: any;
  onAnswerChange?: (answer: any) => void;
  onAnswer?: (answer: any) => void;
}

export function StoryCompletion(props: StoryCompletionProps) {
  const { question, taskData } = props;
  const realTaskData = taskData.task_data || taskData;
  const config = taskData.config || realTaskData.config || {};

  const isPreview = props.mode === 'preview';
  const isReview = props.mode === 'review';
  const isTeacherView = isPreview || isReview;
  const interactive = props.mode === 'student' || props.interactiveMode === true;
  const onSave = props.onAnswer ?? props.onAnswerChange;
  const userAns = props.answer ?? props.userAnswer ?? {};

  const storyText =
    realTaskData?.story_text ||
    config?.story_text ||
    realTaskData?.story_beginning ||
    config?.story_beginning ||
    realTaskData?.text ||
    config?.text ||
    '';

  const instructions =
    taskData?.instructions ||
    realTaskData?.instructions ||
    config?.instructions ||
    question?.qContent ||
    'Đọc câu chuyện và hoàn thành các câu tóm tắt bên dưới.';

  const rawSentences =
    realTaskData?.completion_sentences ||
    config?.completion_sentences ||
    realTaskData?.sentences ||
    config?.sentences ||
    [];

  const sentences: Array<{ id: string; text: string; correct_answer: string; max_words: number }> =
    Array.isArray(rawSentences) ? rawSentences : [];

  const explanation =
    question?.qExplanation ||
    realTaskData?.explanation ||
    config?.explanation;

  const update = (idx: number, v: string) => {
    if (!interactive || !onSave) return;
    onSave({ ...userAns, [idx]: v });
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="rounded-2xl bg-amber-50 border-2 border-amber-200 px-5 py-4 shadow-xs">
        <p className="text-amber-900 font-bold text-lg flex items-center gap-2">
          <span>📖</span>
          <span>{instructions}</span>
        </p>
      </div>

      {/* Story text */}
      {storyText && storyText !== 'kids_task' && (
        <div className="p-6 bg-white rounded-2xl border-2 border-amber-200 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-amber-950 font-bold text-base">
            <BookOpen className="w-5 h-5 text-amber-600" />
            <span>Nội dung câu chuyện:</span>
          </div>
          <div
            className="text-slate-800 text-[16px] leading-relaxed whitespace-pre-line pl-1"
            dangerouslySetInnerHTML={{ __html: storyText }}
          />
        </div>
      )}

      {/* Completion Sentences (Flyers Part 5 Standard) */}
      {sentences.length > 0 ? (
        <div className="space-y-3 pt-1">
          <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
            <span>✏️</span> Điền từ thích hợp vào chỗ trống để hoàn thành câu:
          </p>
          <div className="space-y-3">
            {sentences.map((sent, idx) => (
              <div
                key={idx}
                className="p-5 bg-white rounded-2xl border-2 border-amber-200 shadow-xs space-y-3"
              >
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                    {idx + 1}
                  </span>
                  <div className="flex-1 space-y-2.5">
                    <p className="text-slate-800 font-medium text-base leading-relaxed">
                      {sent.text}
                    </p>

                    {/* Correct answer display for teachers */}
                    {isTeacherView && sent.correct_answer && (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Đáp án đúng: {sent.correct_answer} (tối đa {sent.max_words || 3} từ)</span>
                      </div>
                    )}

                    <div className="pt-1">
                      <input
                        type="text"
                        className="w-full max-w-lg px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:outline-none text-[15px] font-medium disabled:bg-slate-50 disabled:text-slate-600 transition-colors"
                        placeholder={`Nhập từ còn thiếu (tối đa ${sent.max_words || 3} từ)…`}
                        disabled={!interactive}
                        value={userAns?.[idx] ?? ''}
                        onChange={(e) => update(idx, e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Legacy fallback */
        <div className="p-5 bg-white rounded-2xl border-2 border-amber-200 shadow-xs space-y-2">
          <p className="font-bold text-slate-800 text-sm">✍️ Viết tiếp câu chuyện:</p>
          <textarea
            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:outline-none text-base disabled:bg-slate-50"
            rows={6}
            placeholder="Viết câu chuyện của em…"
            disabled={!interactive}
            value={userAns?.completion || ''}
            onChange={(e) => onSave && onSave({ completion: e.target.value })}
          />
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

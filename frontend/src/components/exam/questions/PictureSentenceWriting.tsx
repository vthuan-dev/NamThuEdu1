import { getFullMediaUrl } from '../../../utils/mediaUtils';
import { Lightbulb, CheckCircle2 } from 'lucide-react';

interface PictureSentenceWritingProps {
  question: any;
  taskData: any;
  mode?: 'student' | 'preview' | 'review';
  interactiveMode?: boolean;
  userAnswer?: any;
  answer?: any;
  onAnswerChange?: (answer: any) => void;
  onAnswer?: (answer: any) => void;
}

export function PictureSentenceWriting(props: PictureSentenceWritingProps) {
  const { question, taskData } = props;
  const realTaskData = taskData.task_data || taskData;
  const config = taskData.config || realTaskData.config || {};

  const isPreview = props.mode === 'preview';
  const isReview = props.mode === 'review';
  const isTeacherView = isPreview || isReview;
  const interactive = props.mode === 'student' || props.interactiveMode === true;
  const onSave = props.onAnswer ?? props.onAnswerChange;
  const userAns = props.answer ?? props.userAnswer ?? {};

  const instructions =
    taskData?.instructions ||
    realTaskData?.instructions ||
    config?.instructions ||
    question?.qContent ||
    'Nhìn tranh và viết câu mô tả tương ứng.';

  const minWords = realTaskData?.min_words || config?.min_words || 5;

  const explanation =
    question?.qExplanation ||
    realTaskData?.explanation ||
    config?.explanation;

  // New editor format: items = [{ id, image_url, prompt, sample_answers }]
  const rawItems = realTaskData?.items || config?.items;
  // Legacy format: images = string[]
  const rawImages = realTaskData?.images || config?.images;

  let items: Array<{ imageUrl: string; prompt: string; sampleAnswers: string[] }> = [];

  if (Array.isArray(rawItems) && rawItems.length > 0) {
    items = rawItems.map((it: any) => ({
      imageUrl: it.image_url || it.imageUrl || it.image || '',
      prompt: it.prompt || it.text || '',
      sampleAnswers: Array.isArray(it.sample_answers)
        ? it.sample_answers
        : Array.isArray(it.sampleAnswers)
        ? it.sampleAnswers
        : it.answer
        ? [it.answer]
        : [],
    }));
  } else if (Array.isArray(rawImages) && rawImages.length > 0) {
    items = rawImages.map((img: any) => ({
      imageUrl: typeof img === 'string' ? img : img.url || img.imageUrl || img.image_url || '',
      prompt: img.prompt || '',
      sampleAnswers: img.sample_answers || [],
    }));
  }

  const update = (idx: number, v: string) => {
    if (!interactive || !onSave) return;
    onSave({ ...userAns, [idx]: v });
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="rounded-2xl bg-teal-50 border-2 border-teal-200 px-5 py-4 shadow-xs">
        <p className="text-teal-900 font-bold text-lg flex items-center gap-2">
          <span>✍️</span>
          <span>{instructions}</span>
        </p>
      </div>

      {/* Items list */}
      {items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((it, idx) => {
            const imgUrl = getFullMediaUrl(it.imageUrl);

            return (
              <div
                key={idx}
                className="rounded-2xl border-2 border-teal-200 bg-white overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="bg-teal-600 text-white px-4 py-2 font-bold text-sm flex items-center justify-between">
                    <span>Câu {idx + 1}</span>
                    {it.prompt && <span className="text-xs font-normal opacity-90">{it.prompt}</span>}
                  </div>

                  {imgUrl && (
                    <div className="p-3 bg-slate-50 flex items-center justify-center min-h-[180px]">
                      <img
                        src={imgUrl}
                        alt={`Tranh câu ${idx + 1}`}
                        className="w-full max-h-[240px] object-contain rounded-xl"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Sample answers for teachers */}
                  {isTeacherView && it.sampleAnswers.length > 0 && (
                    <div className="p-3 bg-emerald-50 border-t border-emerald-200 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Câu trả lời mẫu gợi ý:</span>
                      </div>
                      <ul className="list-disc pl-5 text-xs text-emerald-900 font-medium space-y-0.5">
                        {it.sampleAnswers.filter(Boolean).map((ans, aIdx) => (
                          <li key={aIdx}>{ans}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="p-3.5 bg-white border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-700 mb-1.5">
                    Viết câu mô tả (tối thiểu {minWords} từ):
                  </p>
                  <textarea
                    className="w-full px-3.5 py-2.5 border-2 border-slate-200 rounded-xl focus:border-teal-500 focus:outline-none text-[15px] font-medium resize-none disabled:bg-slate-50 disabled:text-slate-600 transition-colors"
                    rows={3}
                    placeholder={`Viết câu mô tả của em…`}
                    disabled={!interactive}
                    value={userAns?.[idx] || ''}
                    onChange={(e) => update(idx, e.target.value)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-6 bg-amber-50 rounded-2xl border-2 border-amber-300 text-center text-amber-800 font-medium">
          ⚠️ Câu hỏi này chưa có hình ảnh hoặc câu mô tả.
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

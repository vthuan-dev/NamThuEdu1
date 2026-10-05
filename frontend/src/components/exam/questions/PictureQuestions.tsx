import { getFullMediaUrl } from '../../../utils/mediaUtils';
import { Lightbulb, CheckCircle2 } from 'lucide-react';

interface PictureQuestionsProps {
  question: any;
  taskData: any;
  mode?: 'student' | 'preview' | 'review';
  interactiveMode?: boolean;
  userAnswer?: any;
  answer?: any;
  onAnswerChange?: (answer: any) => void;
  onAnswer?: (answer: any) => void;
}

export function PictureQuestions(props: PictureQuestionsProps) {
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
    'Nhìn tranh và trả lời các câu hỏi.';

  const questions =
    realTaskData?.questions ||
    config?.questions ||
    realTaskData?.items ||
    config?.items ||
    [];

  const imageUrl =
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

  const update = (idx: number, v: string) => {
    if (!interactive || !onSave) return;
    onSave({ ...userAns, [idx]: v });
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="rounded-2xl bg-indigo-50 border-2 border-indigo-200 px-5 py-4 shadow-xs">
        <p className="text-indigo-900 font-bold text-lg flex items-center gap-2">
          <span>🖼️</span>
          <span>{instructions}</span>
        </p>
      </div>

      {/* Main Image */}
      {imageUrl && (
        <div className="border-2 border-indigo-200 rounded-2xl overflow-hidden bg-white shadow-xs p-2 flex justify-center">
          <img
            src={getFullMediaUrl(imageUrl) || ''}
            alt="Bức tranh chính"
            className="w-full max-h-[550px] object-contain rounded-xl"
            loading="lazy"
          />
        </div>
      )}

      {/* Questions */}
      {questions.length > 0 ? (
        <div className="space-y-4">
          {questions.map((q: any, idx: number) => {
            const questionText = q.text || q.question || q.questionText || `Câu ${idx + 1}`;
            const questionImageUrl = q.imageUrl || q.image_url || q.image;
            const sampleAnswer = q.sampleAnswer || q.sample_answer || q.answer;

            return (
              <div
                key={idx}
                className="p-5 bg-white rounded-2xl border-2 border-indigo-200 shadow-xs hover:shadow-md transition-shadow space-y-3"
              >
                <div className="flex items-start gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-xs">
                    {idx + 1}
                  </span>
                  <div className="flex-1 space-y-3">
                    {/* Question Image */}
                    {questionImageUrl && (
                      <div className="border border-indigo-200 rounded-xl overflow-hidden bg-slate-50 p-2 max-w-sm">
                        <img
                          src={getFullMediaUrl(questionImageUrl) || ''}
                          alt={`Câu hỏi ${idx + 1}`}
                          className="w-full h-auto max-h-[200px] object-contain rounded-lg"
                        />
                      </div>
                    )}

                    <p className="font-bold text-lg text-slate-800">{questionText}</p>

                    {/* Sample answer in preview mode */}
                    {isTeacherView && sampleAnswer && (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-emerald-900 font-semibold leading-relaxed">
                          Gợi ý đáp án: <span className="font-normal">{sampleAnswer}</span>
                        </p>
                      </div>
                    )}

                    {/* Answer input */}
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none text-[15px] font-medium disabled:bg-slate-50 disabled:text-slate-600 transition-colors"
                      placeholder="Câu trả lời của em…"
                      disabled={!interactive}
                      value={userAns[idx] || ''}
                      onChange={(e) => update(idx, e.target.value)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-6 bg-amber-50 rounded-2xl border-2 border-amber-300 text-center text-amber-800 font-medium">
          ⚠️ Câu hỏi này chưa có danh sách câu hỏi.
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

import { QuestionRendererProps } from '../../../types/exam';
import { extractTaskData } from '../../../utils/examDataExtractor';
import { getFullMediaUrl } from '../../../utils/mediaUtils';
import { Lightbulb, CheckCircle2 } from 'lucide-react';

export function LookAndRead({
  question,
  mode,
  answer = {},
  onAnswer
}: QuestionRendererProps) {
  const taskData = extractTaskData(question);
  const { instructions, imageUrl, questions = [], items = [] } = taskData;
  const isPreview = mode === 'preview';
  const isReview = mode === 'review';
  const isTeacherView = isPreview || isReview;
  const isInteractive = mode === 'student';
  const answerFormat = (taskData as any).answer_format || (taskData as any).answerFormat || taskData.config?.answer_format || 'tick_cross';
  const isYesNo = answerFormat === 'yes_no';
  const trueLabel = isYesNo ? '✔ Yes' : '✓ Đúng';
  const falseLabel = isYesNo ? '✘ No' : '✗ Sai';

  const explanation =
    question?.qExplanation ||
    (taskData as any)?.explanation;

  // Use questions array, fallback to items
  const readingQuestions = questions.length > 0 ? questions : items;

  const handleAnswerSelect = (questionIndex: number, value: boolean) => {
    if (!isInteractive || !onAnswer) return;

    onAnswer({
      ...answer,
      [questionIndex]: value
    });
  };

  // Single source of truth for rendering one statement row
  const renderQuestionCard = (q: any, idx: number) => {
    const questionText = q.text || q.question || q.questionText || q.label || q.statement || `Câu ${idx + 1}`;
    const itemImageUrl = q.imageUrl || q.image_url || q.image;
    const answerValue = answer[idx];
    const isCorrectTrue = isTeacherView && (q.isCorrect === true || q.correctAnswer === true || q.is_correct === true);
    const isCorrectFalse = isTeacherView && (q.isCorrect === false || q.correctAnswer === false || q.is_correct === false);

    return (
      <div key={idx} className="p-5 bg-white rounded-2xl border-2 border-purple-200 shadow-xs hover:shadow-md transition-shadow space-y-3">
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 w-7 h-7 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-xs shadow-xs mt-0.5">
            {idx + 1}
          </span>
          <div className="flex-1 space-y-3 min-w-0">
            {/* Item Image (if exists) */}
            {itemImageUrl && (
              <div className="border border-purple-200 rounded-xl overflow-hidden bg-slate-50 p-2 max-w-sm">
                <img
                  src={getFullMediaUrl(itemImageUrl) || ''}
                  alt={`Question ${idx + 1}`}
                  className="w-full h-auto max-h-[180px] object-contain rounded-lg"
                />
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="font-bold text-base text-slate-800">{questionText}</p>
              {isTeacherView && (isCorrectTrue || isCorrectFalse) && (
                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Đáp án đúng: {isCorrectTrue ? trueLabel : falseLabel}</span>
                </span>
              )}
            </div>

            {/* Tick/Cross or Yes/No buttons */}
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${
                  isInteractive ? 'hover:scale-[1.02] cursor-pointer' : 'cursor-default'
                } ${
                  isCorrectTrue
                    ? 'bg-green-600 text-white border-green-700 shadow-xs'
                    : answerValue === true
                    ? 'bg-green-500 text-white border-green-600 shadow-xs'
                    : 'border-green-300 text-green-900 bg-white hover:bg-green-50'
                }`}
                disabled={!isInteractive}
                onClick={() => handleAnswerSelect(idx, true)}
              >
                {trueLabel} {isCorrectTrue && '✓'}
              </button>
              <button
                type="button"
                className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${
                  isInteractive ? 'hover:scale-[1.02] cursor-pointer' : 'cursor-default'
                } ${
                  isCorrectFalse
                    ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                    : answerValue === false
                    ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                    : 'border-rose-300 text-rose-900 bg-white hover:bg-rose-50'
                }`}
                disabled={!isInteractive}
                onClick={() => handleAnswerSelect(idx, false)}
              >
                {falseLabel} {isCorrectFalse && '✓'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      {instructions && (
        <div className="p-4 bg-purple-50 rounded-2xl border-2 border-purple-200 shadow-xs">
          <p className="text-purple-900 font-bold text-lg flex items-center gap-2">
            <span>📖</span>
            <span>{instructions}</span>
          </p>
        </div>
      )}

      {/* STICKY IMAGE LAYOUT */}
      {imageUrl && readingQuestions.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
          <div className="lg:sticky lg:top-4 h-fit">
            <div className="border-2 border-purple-200 rounded-2xl overflow-hidden bg-white shadow-xs p-2 flex justify-center">
              <img
                src={getFullMediaUrl(imageUrl) || ''}
                alt="Đọc và chọn Đúng/Sai"
                className="w-full h-auto max-h-[500px] object-contain rounded-xl"
                loading="lazy"
              />
            </div>
          </div>

          <div className="space-y-3">
            {readingQuestions.map((q: any, idx: number) => renderQuestionCard(q, idx))}
          </div>
        </div>
      ) : (
        <>
          {imageUrl && (
            <div className="border-2 border-purple-200 rounded-2xl overflow-hidden bg-white shadow-xs p-2 flex justify-center">
              <img
                src={getFullMediaUrl(imageUrl) || ''}
                alt="Question"
                className="w-full h-auto max-h-[450px] object-contain rounded-xl"
                loading="lazy"
              />
            </div>
          )}

          {readingQuestions.length > 0 ? (
            <div className="space-y-3">
              {readingQuestions.map((q: any, idx: number) => renderQuestionCard(q, idx))}
            </div>
          ) : (
            <div className="p-6 bg-amber-50 rounded-2xl border-2 border-amber-300 text-center text-amber-800 font-medium">
              ⚠️ Không tìm thấy câu hỏi cho task này.
            </div>
          )}
        </>
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

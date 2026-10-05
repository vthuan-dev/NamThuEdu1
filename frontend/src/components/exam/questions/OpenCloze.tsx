import { getFullMediaUrl } from '../../../utils/mediaUtils';

interface OpenClozeProps {
  question: any;
  taskData: any;
  interactiveMode: boolean;
  userAnswer?: any;
  onAnswerChange?: (answer: any) => void;
  mode?: string;
}

export function OpenCloze({
  question,
  taskData,
  interactiveMode,
  userAnswer,
  onAnswerChange,
  mode
}: OpenClozeProps) {
  const realTaskData = taskData.task_data || taskData;
  const config = taskData.config || realTaskData.config || {};
  
  const text = realTaskData?.text || config?.text || realTaskData?.story || config?.story;
  const gaps = realTaskData?.gaps || config?.gaps || realTaskData?.questions || config?.questions || [];
  const instructions = realTaskData?.instructions || config?.instructions || question.qContent;
  const imageUrl = realTaskData?.imageUrl || config?.imageUrl || realTaskData?.image_url || config?.image_url || (question as any)?.qMedia_url;
  const explanation = question.qExplanation || (question as any)?.explanation || taskData.explanation || config?.explanation;
  const isTeacherReview = mode === 'preview' || mode === 'review' || !interactiveMode;

  return (
    <div className="space-y-4">
      {/* Instructions */}
      {instructions && (
        <div className="p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
          <p className="text-indigo-900 font-medium text-lg">✍️ {instructions}</p>
        </div>
      )}

      {/* Optional Illustration Image */}
      {imageUrl && (
        <div className="border-4 border-indigo-200 rounded-xl overflow-hidden bg-white shadow-md max-w-xl mx-auto">
          <img 
            src={getFullMediaUrl(imageUrl)} 
            alt="Open Cloze Illustration" 
            className="w-full h-auto object-contain"
            style={{ maxHeight: '400px' }}
          />
        </div>
      )}
      
      {/* Text with gaps - students type their own answers */}
      {text && text !== 'kids_task' && (
        <div className="p-5 bg-white rounded-xl border-3 border-indigo-200 shadow-md">
          <div className="text-gray-700 text-lg leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: text }} />
        </div>
      )}
      
      {/* Gap inputs */}
      {gaps.length > 0 ? (
        <div className="space-y-4">
          {gaps.map((gap: any, idx: number) => {
            const gapNumber = gap.gap_number || gap.gapNumber || gap.gap_id || idx + 1;
            const hint = gap.hint || gap.clue || '';
            const correctAnswers = Array.isArray(gap.correct_answers)
              ? gap.correct_answers.filter(Boolean)
              : gap.correct_answer || gap.correctAnswer || gap.answer
                ? [gap.correct_answer || gap.correctAnswer || gap.answer]
                : [];
            const correctAnswersStr = correctAnswers.join(' / ');
            const defaultAnswer = correctAnswers[0] || '';
            const val = userAnswer?.[gap.gap_id] ?? userAnswer?.[idx] ?? (mode === 'preview' && defaultAnswer ? defaultAnswer : '');
            
            return (
              <div key={idx} className="p-5 bg-white rounded-xl border-3 border-indigo-200 shadow-md">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-10 h-10 bg-indigo-500 text-white rounded-full flex items-center justify-center font-bold">
                    {gapNumber}
                  </span>
                  <div className="flex-1 space-y-2">
                    {hint && (
                      <p className="text-sm text-gray-600">{hint}</p>
                    )}
                    <input
                      type="text"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none text-lg font-medium"
                      placeholder="Nhập câu trả lời..."
                      disabled={!interactiveMode}
                      value={val}
                      onChange={(e) => {
                        if (onAnswerChange) {
                          onAnswerChange({
                            ...userAnswer,
                            [idx]: e.target.value,
                            ...(gap.gap_id !== undefined ? { [gap.gap_id]: e.target.value } : {})
                          });
                        }
                      }}
                    />

                    {/* Preview / Review Answer Key */}
                    {isTeacherReview && correctAnswersStr && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm font-semibold">
                        <span>✓ Đáp án đúng:</span>
                        <span className="font-bold underline">{correctAnswersStr}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-6 bg-yellow-50 rounded-lg border-2 border-yellow-300">
          <p className="text-yellow-800 font-medium">⚠️ Không tìm thấy gaps cho task này</p>
        </div>
      )}

      {/* Explanation */}
      {explanation && (
        <div className="p-4 bg-amber-50 rounded-xl border-2 border-amber-200 text-amber-900 text-sm">
          <p className="font-bold mb-1">💡 Giải thích / Hướng dẫn chấm:</p>
          <p className="whitespace-pre-wrap">{explanation}</p>
        </div>
      )}
    </div>
  );
}

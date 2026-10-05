import { normalizePassageText, sanitizePassageHtml, hasHtmlOrEntities, sanitizeInlineHtml } from '../../../utils/examUtils';
import { getFullMediaUrl } from '../../../utils/mediaUtils';

interface ReadingComprehensionProps {
  question: any;
  taskData: any;
  interactiveMode: boolean;
  userAnswer?: any;
  onAnswerChange?: (answer: any) => void;
  mode?: string;
}

export function ReadingComprehension({
  question,
  taskData,
  interactiveMode,
  userAnswer,
  onAnswerChange,
  mode
}: ReadingComprehensionProps) {
  const realTaskData = taskData.task_data || taskData;
  const config = taskData.config || realTaskData.config || {};
  
  const passage = realTaskData?.passage || config?.passage || realTaskData?.text || config?.text;
  const questions = realTaskData?.questions || config?.questions || [];
  const instructions = realTaskData?.instructions || config?.instructions || question.qContent;
  const imageUrl = realTaskData?.imageUrl || config?.imageUrl || realTaskData?.image_url || config?.image_url || (question as any)?.qMedia_url;
  const explanation = question.qExplanation || (question as any)?.explanation || taskData.explanation || config?.explanation;
  const isTeacherReview = mode === 'preview' || mode === 'review' || !interactiveMode;

  return (
    <div className="space-y-4">
      {/* Instructions */}
      {instructions && (
        <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <p className="text-blue-900 font-medium text-lg">
            📚 {hasHtmlOrEntities(instructions) ? (
              <span dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(instructions) }} />
            ) : (
              instructions
            )}
          </p>
        </div>
      )}

      {/* Reading passage illustration */}
      {imageUrl && (
        <div className="border-4 border-blue-200 rounded-xl overflow-hidden bg-white shadow-md max-w-xl mx-auto">
          <img 
            src={getFullMediaUrl(imageUrl)} 
            alt="Reading Passage Illustration" 
            className="w-full h-auto object-contain"
            style={{ maxHeight: '400px' }}
          />
        </div>
      )}
      
      {/* Reading passage */}
      {passage && passage !== 'kids_task' && (
        <div className="p-5 bg-white rounded-xl border-3 border-blue-200 shadow-md">
          <div
            className="text-gray-700 text-lg leading-relaxed whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: sanitizePassageHtml(normalizePassageText(passage)) }}
          />
        </div>
      )}
      
      {/* Comprehension questions */}
      {questions.length > 0 ? (
        <div className="space-y-4">
          {questions.map((q: any, idx: number) => {
            const questionText = q.text || q.question || q.questionText;
            const options = q.options || [];
            const questionType = q.type || 'multiple_choice';
            const correctAnswer = q.correct_answer || q.correctAnswer || q.answer;
            
            return (
              <div key={idx} className="p-5 bg-white rounded-xl border-3 border-blue-200 shadow-md">
                <p className="font-medium mb-4 text-gray-800 text-lg">
                  {idx + 1}. {hasHtmlOrEntities(questionText) ? (
                    <span dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(questionText) }} />
                  ) : (
                    questionText
                  )}
                </p>
                
                {/* Multiple choice options */}
                {questionType === 'multiple_choice' && options.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {options.map((option: string, optIdx: number) => {
                      const letter = String.fromCharCode(65 + optIdx);
                      const isOptionCorrect = isTeacherReview && (
                        correctAnswer === option || 
                        correctAnswer === letter || 
                        correctAnswer === String(optIdx)
                      );
                      const isSelected = userAnswer?.[idx] === option || (mode === 'preview' && isOptionCorrect);

                      return (
                        <button
                          key={optIdx}
                          className={`px-4 py-3 rounded-lg border-2 text-left font-medium transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-blue-500 text-white border-blue-600'
                              : isOptionCorrect
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-500 font-bold'
                              : 'bg-white text-gray-800 border-blue-300 hover:bg-blue-50'
                          }`}
                          disabled={!interactiveMode}
                          onClick={() => {
                            if (onAnswerChange) {
                              onAnswerChange({
                                ...userAnswer,
                                [idx]: option
                              });
                            }
                          }}
                        >
                          <div>
                            {letter}. {hasHtmlOrEntities(option) ? (
                              <span dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(option) }} />
                            ) : (
                              option
                            )}
                          </div>
                          {isOptionCorrect && (
                            <span className="text-xs px-2 py-0.5 rounded bg-emerald-600 text-white font-bold">
                              ✓ Đáp án đúng
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                
                {/* Short answer */}
                {questionType === 'short_answer' && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg font-medium"
                      placeholder="Nhập câu trả lời..."
                      disabled={!interactiveMode}
                      value={userAnswer?.[idx] || (mode === 'preview' && correctAnswer ? correctAnswer : '')}
                      onChange={(e) => {
                        if (onAnswerChange) {
                          onAnswerChange({
                            ...userAnswer,
                            [idx]: e.target.value
                          });
                        }
                      }}
                    />
                    {isTeacherReview && correctAnswer && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm font-semibold">
                        <span>✓ Đáp án đúng:</span>
                        <span className="font-bold underline">{correctAnswer}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-6 bg-yellow-50 rounded-lg border-2 border-yellow-300">
          <p className="text-yellow-800 font-medium">⚠️ Không tìm thấy questions cho task này</p>
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

import { normalizePassageText, sanitizePassageHtml, hasHtmlOrEntities, sanitizeInlineHtml } from '../../../utils/examUtils';

interface ReadingComprehensionProps {
  question: any;
  taskData: any;
  interactiveMode: boolean;
  userAnswer?: any;
  onAnswerChange?: (answer: any) => void;
}

export function ReadingComprehension({
  question,
  taskData,
  interactiveMode,
  userAnswer,
  onAnswerChange
}: ReadingComprehensionProps) {
  const realTaskData = taskData.task_data || taskData;
  const config = taskData.config || realTaskData.config || {};
  
  const passage = realTaskData?.passage || config?.passage || realTaskData?.text || config?.text;
  const questions = realTaskData?.questions || config?.questions || [];
  const instructions = realTaskData?.instructions || config?.instructions;
  
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
                    {options.map((option: string, optIdx: number) => (
                      <button
                        key={optIdx}
                        className={`px-4 py-3 rounded-lg border-2 text-left font-medium transition-all ${
                          userAnswer?.[idx] === option
                            ? 'bg-blue-500 text-white border-blue-600'
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
                        {String.fromCharCode(65 + optIdx)}. {hasHtmlOrEntities(option) ? (
                          <span dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(option) }} />
                        ) : (
                          option
                        )}
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Short answer */}
                {questionType === 'short_answer' && (
                  <input
                    type="text"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg font-medium"
                    placeholder="Nhập câu trả lời..."
                    disabled={!interactiveMode}
                    value={userAnswer?.[idx] || ''}
                    onChange={(e) => {
                      if (onAnswerChange) {
                        onAnswerChange({
                          ...userAnswer,
                          [idx]: e.target.value
                        });
                      }
                    }}
                  />
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
    </div>
  );
}

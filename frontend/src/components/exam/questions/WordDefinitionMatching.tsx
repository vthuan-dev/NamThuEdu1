interface WordDefinitionMatchingProps {
  question: any;
  taskData: any;
  interactiveMode: boolean;
  userAnswer?: any;
  onAnswerChange?: (answer: any) => void;
}

export function WordDefinitionMatching({
  question,
  taskData,
  interactiveMode,
  userAnswer,
  onAnswerChange
}: WordDefinitionMatchingProps) {
  const realTaskData = taskData.task_data || taskData;
  const config = taskData.config || realTaskData.config || {};

  // Format chuẩn: questions[] + word_bank[]
  let questions = realTaskData?.questions || config?.questions || [];
  let wordBank = realTaskData?.word_bank || config?.word_bank || realTaskData?.wordBank || config?.wordBank || [];

  // Tương thích format editor: words = [{ word, definition }]
  const words = realTaskData?.words || config?.words || [];
  if (questions.length === 0 && Array.isArray(words) && words.length > 0) {
    questions = words.map((w: any) => ({
      definition: w.definition ?? w.text ?? '',
      answer: w.word,
    }));
    if (wordBank.length === 0) {
      wordBank = words.map((w: any) => w.word).filter(Boolean);
    }
  }

  const instructions = realTaskData?.instructions || config?.instructions;
  
  return (
    <div className="space-y-4">
      {/* Instructions */}
      {instructions && (
        <div className="p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
          <p className="text-indigo-900 font-medium text-lg">📚 {instructions}</p>
        </div>
      )}
      
      {/* Word bank */}
      {wordBank.length > 0 && (
        <div className="p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
          <p className="text-sm font-bold text-indigo-900 mb-3">📝 Ngân hàng từ:</p>
          <div className="flex flex-wrap gap-2">
            {wordBank.map((word: string, idx: number) => (
              <span key={idx} className="px-3 py-2 bg-white border-2 border-indigo-300 rounded-lg font-medium text-indigo-900">
                {word}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Questions */}
      {questions.length > 0 ? (
        <div className="space-y-4">
          {questions.map((q: any, idx: number) => {
            const definition = q.definition || q.text || q.questionText;
            const isExample = q.isExample || q.is_example;
            
            return (
              <div key={idx} className="p-5 bg-white rounded-xl border-3 border-indigo-200 shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-indigo-500 text-white rounded-full flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>
                  <div className="flex-1 space-y-3">
                    <p className="font-medium text-lg text-gray-800">
                      {definition}
                      {isExample && <span className="ml-2 text-amber-600 font-bold">📌 (Ví dụ)</span>}
                    </p>
                    
                    {/* Dropdown to select word */}
                    <select
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none text-lg font-medium"
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
                    >
                      <option value="">-- Chọn từ --</option>
                      {wordBank.map((word: string, wordIdx: number) => (
                        <option key={wordIdx} value={word}>
                          {word}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
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

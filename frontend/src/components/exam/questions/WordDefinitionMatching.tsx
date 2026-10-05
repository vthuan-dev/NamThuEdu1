import { getFullMediaUrl } from '../../../utils/mediaUtils';

interface WordDefinitionMatchingProps {
  question: any;
  taskData: any;
  interactiveMode: boolean;
  userAnswer?: any;
  onAnswerChange?: (answer: any) => void;
  mode?: string;
}

export function WordDefinitionMatching({
  question,
  taskData,
  interactiveMode,
  userAnswer,
  onAnswerChange,
  mode
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

  // Từ nhiễu: nằm trong hộp từ nhưng không là đáp án của câu nào
  // (Flyers Part 1: 10 định nghĩa / 15 từ).
  const distractors: string[] =
    realTaskData?.distractor_words ||
    config?.distractor_words ||
    realTaskData?.distractorWords ||
    config?.distractorWords ||
    [];
  if (Array.isArray(distractors) && distractors.length > 0) {
    const existing = new Set(wordBank.map((w: string) => String(w).toLowerCase()));
    distractors.forEach((d) => {
      const val = String(d).trim();
      if (val && !existing.has(val.toLowerCase())) {
        wordBank = [...wordBank, val];
        existing.add(val.toLowerCase());
      }
    });
  }

  const instructions = realTaskData?.instructions || config?.instructions || question.qContent;
  const imageUrl = realTaskData?.imageUrl || config?.imageUrl || realTaskData?.image_url || config?.image_url || (question as any)?.qMedia_url;
  const explanation = question.qExplanation || (question as any)?.explanation || taskData.explanation || config?.explanation;
  const isTeacherReview = mode === 'preview' || mode === 'review' || !interactiveMode;

  return (
    <div className="space-y-4">
      {/* Instructions */}
      {instructions && (
        <div className="p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
          <p className="text-indigo-900 font-medium text-lg">📚 {instructions}</p>
        </div>
      )}

      {/* Optional Illustration Image */}
      {imageUrl && (
        <div className="border-4 border-indigo-200 rounded-xl overflow-hidden bg-white shadow-md max-w-xl mx-auto">
          <img 
            src={getFullMediaUrl(imageUrl)} 
            alt="Word Definition Illustration" 
            className="w-full h-auto object-contain"
            style={{ maxHeight: '350px' }}
          />
        </div>
      )}
      
      {/* Word bank */}
      {wordBank.length > 0 && (
        <div className="p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
          <p className="text-sm font-bold text-indigo-900 mb-3">📝 Ngân hàng từ:</p>
          <div className="flex flex-wrap gap-2">
            {wordBank.map((word: string, idx: number) => (
              <span key={idx} className="px-3 py-2 bg-white border-2 border-indigo-300 rounded-lg font-medium text-indigo-900 shadow-sm">
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
            const correctAnswer = q.answer || q.correct_answer || q.correctAnswer || q.word;
            
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
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none text-lg font-medium bg-white"
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
                    >
                      <option value="">-- Chọn từ --</option>
                      {wordBank.map((word: string, wordIdx: number) => (
                        <option key={wordIdx} value={word}>
                          {word}
                        </option>
                      ))}
                    </select>

                    {/* Preview / Review Answer Key */}
                    {isTeacherReview && correctAnswer && (
                      <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm font-semibold">
                        <span>✓ Đáp án đúng:</span>
                        <span className="font-bold underline">{correctAnswer}</span>
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

import { QuestionRendererProps } from '../../../types/exam';
import { extractTaskData } from '../../../utils/examDataExtractor';
import { getFullMediaUrl } from '../../../utils/mediaUtils';

export function LookReadWrite({
  question,
  mode,
  answer = {},
  onAnswer
}: QuestionRendererProps) {
  const taskData = extractTaskData(question);
  const { instructions, imageUrl, questions = [], items = [] } = taskData;
  const isInteractive = mode === 'student';
  
  const readingQuestions = questions.length > 0 ? questions : items;

  const handleInputChange = (questionIndex: number, value: string) => {
    if (!isInteractive || !onAnswer) return;
    
    onAnswer({
      ...answer,
      [questionIndex]: value
    });
  };

  return (
    <div className="space-y-4">
      {/* Instructions */}
      {instructions && (
        <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
          <p className="text-purple-900 font-medium text-lg">📖 {instructions}</p>
        </div>
      )}
      
      {/* STICKY IMAGE LAYOUT: Image left (sticky) + Questions right (scrollable) */}
      {imageUrl && readingQuestions.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
          {/* Sticky Image Column (LEFT) */}
          <div className="sticky top-4 h-fit">
            <div className="border-4 border-purple-300 rounded-xl overflow-hidden bg-white shadow-lg">
              <img 
                src={getFullMediaUrl(imageUrl)} 
                alt="Nhìn tranh và viết câu trả lời" 
                className="w-full h-auto object-contain"
                style={{ maxHeight: '600px' }}
              />
            </div>
          </div>
          
          {/* Scrollable Questions Column (RIGHT) */}
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {readingQuestions.map((q: any, idx: number) => {
              const questionText = q.text || q.question || q.questionText || q.label || q.statement || `Câu ${idx + 1}`;
              const itemImageUrl = q.imageUrl || q.image_url || q.image;
              const hintPrefix = q.hint_prefix || q.hintPrefix || q.hint || q.clue || q.prefix;
              const suffix = q.suffix;
              const correctAnswer = q.correct_answer || q.correctAnswer || q.answer;
              const isExample = q.is_example || q.isExample;
              
              return (
                <div key={idx} className="p-5 bg-white rounded-xl border-3 border-purple-200 shadow-md hover:shadow-lg transition-shadow">
                  <div className="flex items-start gap-4">
                    <span className="flex-shrink-0 w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <div className="flex-1 space-y-3">
                      {/* Item Image (if exists) */}
                      {itemImageUrl && (
                        <div className="border-3 border-purple-200 rounded-lg overflow-hidden bg-gray-50">
                          <img 
                            src={getFullMediaUrl(itemImageUrl)} 
                            alt={`Question ${idx + 1}`} 
                            className="w-full h-auto object-contain"
                            style={{ maxHeight: '200px' }}
                          />
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-lg text-gray-800">{questionText}</p>
                        {isExample && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            📌 Ví dụ
                          </span>
                        )}
                      </div>
                      
                      {/* Input field with hint/prefix/suffix */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Prefix/hint before input */}
                        {hintPrefix && (
                          <span className="text-gray-700 font-medium text-lg">
                            {hintPrefix}
                          </span>
                        )}
                        
                        {/* Input field with dotted underline */}
                        <div className="relative inline-block min-w-[150px]">
                          <input 
                            type="text" 
                            className="px-3 py-1 border-0 border-b-2 border-dotted border-gray-500 focus:border-purple-600 focus:outline-none text-lg font-medium bg-transparent"
                            placeholder=""
                            disabled={!isInteractive}
                            value={answer[idx] || (mode === 'preview' && correctAnswer ? correctAnswer : '')}
                            onChange={(e) => handleInputChange(idx, e.target.value)}
                            style={{ 
                              borderBottomStyle: 'dotted',
                              borderBottomWidth: '2px',
                              minWidth: '150px'
                            }}
                          />
                        </div>
                        
                        {/* Suffix after input */}
                        {suffix && (
                          <span className="text-gray-700 font-medium text-lg">
                            {suffix}
                          </span>
                        )}
                      </div>

                      {/* Preview / Review Answer Key */}
                      {(mode === 'preview' || mode === 'review') && correctAnswer && (
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
        </div>
      ) : (
        <>
          {/* Fallback: No shared image - show image above questions */}
          {imageUrl && (
            <div className="border-4 border-purple-300 rounded-xl overflow-hidden bg-white shadow-lg">
              <img 
                src={getFullMediaUrl(imageUrl)} 
                alt="Question" 
                className="w-full h-auto object-contain"
                style={{ maxHeight: '500px' }}
              />
            </div>
          )}
          
          {/* Questions */}
          {readingQuestions.length > 0 ? (
            <div className="space-y-4">
              {readingQuestions.map((q: any, idx: number) => {
                const questionText = q.text || q.question || q.questionText || q.label || q.statement || `Câu ${idx + 1}`;
                const itemImageUrl = q.imageUrl || q.image_url || q.image;
                const hintPrefix = q.hint_prefix || q.hintPrefix || q.hint || q.clue || q.prefix;
                const suffix = q.suffix;
                const correctAnswer = q.correct_answer || q.correctAnswer || q.answer;
                const isExample = q.is_example || q.isExample;
                
                return (
                  <div key={idx} className="p-5 bg-white rounded-xl border-3 border-purple-200 shadow-md hover:shadow-lg transition-shadow">
                    <div className="flex items-start gap-4">
                      <span className="flex-shrink-0 w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <div className="flex-1 space-y-3">
                        {/* Item Image */}
                        {itemImageUrl && (
                          <div className="border-3 border-purple-200 rounded-lg overflow-hidden bg-gray-50">
                            <img 
                              src={getFullMediaUrl(itemImageUrl)} 
                              alt={`Question ${idx + 1}`} 
                              className="w-full h-auto object-contain"
                              style={{ maxHeight: '200px' }}
                            />
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-lg text-gray-800">{questionText}</p>
                          {isExample && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                              📌 Ví dụ
                            </span>
                          )}
                        </div>
                        
                        {/* Input field with hint/prefix/suffix */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Prefix/hint before input */}
                          {hintPrefix && (
                            <span className="text-gray-700 font-medium text-lg">
                              {hintPrefix}
                            </span>
                          )}
                          
                          {/* Input field with dotted underline */}
                          <div className="relative inline-block min-w-[150px]">
                            <input 
                              type="text" 
                              className="px-3 py-1 border-0 border-b-2 border-dotted border-gray-500 focus:border-purple-600 focus:outline-none text-lg font-medium bg-transparent"
                              placeholder=""
                              disabled={!isInteractive}
                              value={answer[idx] || (mode === 'preview' && correctAnswer ? correctAnswer : '')}
                              onChange={(e) => handleInputChange(idx, e.target.value)}
                              style={{ 
                                borderBottomStyle: 'dotted',
                                borderBottomWidth: '2px',
                                minWidth: '150px'
                              }}
                            />
                          </div>
                          
                          {/* Suffix after input */}
                          {suffix && (
                            <span className="text-gray-700 font-medium text-lg">
                              {suffix}
                            </span>
                          )}
                        </div>

                        {/* Preview / Review Answer Key */}
                        {(mode === 'preview' || mode === 'review') && correctAnswer && (
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
              <p className="text-yellow-800 font-medium">⚠️ Không tìm thấy câu hỏi cho task này</p>
            </div>
          )}
        </>
      )}

      {/* Explanation */}
      {(question.qExplanation || (question as any)?.explanation || taskData.explanation || taskData.config?.explanation) && (
        <div className="p-4 bg-amber-50 rounded-xl border-2 border-amber-200 text-amber-900 text-sm">
          <p className="font-bold mb-1">💡 Giải thích / Hướng dẫn chấm:</p>
          <p className="whitespace-pre-wrap">
            {question.qExplanation || (question as any)?.explanation || taskData.explanation || taskData.config?.explanation}
          </p>
        </div>
      )}
    </div>
  );
}

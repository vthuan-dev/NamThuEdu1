import { QuestionRendererProps } from '../../../types/exam';
import { extractTaskData } from '../../../utils/examDataExtractor';
import { getFullMediaUrl } from '../../../utils/mediaUtils';
import { renderFormattedText } from '../../../utils/textFormatUtils';

export function WordBankFill({
  question,
  mode,
  answer = {},
  onAnswer
}: QuestionRendererProps) {
  const taskData = extractTaskData(question);
  const instructions = taskData.instructions;
  const imageUrl = taskData.imageUrl;
  const wordBank = (taskData as any).wordBank || (taskData as any).word_bank || [];
  const story = (taskData as any).story;
  const text = (taskData as any).text;
  const questions = taskData.questions || [];
  const items = taskData.items || [];
  
  const isInteractive = mode === 'student';
  
  // Get story text from multiple possible sources
  const storyText = story || text || question.qContent;
  
  // Get questions/items for fill-in-the-blank
  const fillQuestions = questions.length > 0 ? questions : items;

  const handleAnswerChange = (questionIndex: number, value: string) => {
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
          <p className="text-purple-900 font-medium text-lg">✍️ {instructions}</p>
        </div>
      )}
      
      {/* STICKY IMAGE LAYOUT: Image left (sticky) + Story/Questions right (scrollable) */}
      {imageUrl ? (
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
          {/* Sticky Image Column (LEFT) */}
          <div className="sticky top-4 h-fit">
            <div className="border-4 border-purple-300 rounded-xl overflow-hidden bg-white shadow-lg">
              <img 
                src={getFullMediaUrl(imageUrl)} 
                alt="Main Image" 
                className="w-full h-auto object-contain"
                style={{ maxHeight: '600px' }}
              />
            </div>
          </div>
          
          {/* Scrollable Content Column (RIGHT) */}
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {/* Story/Text with gaps */}
            {storyText && storyText !== 'kids_task' && (
              <div className="p-5 bg-white rounded-xl border-3 border-purple-200 shadow-md">
                {/* BUG FIX: trước đây dùng dangerouslySetInnerHTML nên nút "In đậm"
                    của giáo viên (**text**) hiện ra thô cho học viên, và HTML thô
                    tiềm ẩn XSS. renderFormattedText xử lý cả **bold** lẫn <mark>
                    tô màu bằng React element an toàn. */}
                <div className="text-gray-700 text-lg leading-relaxed">
                  {renderFormattedText(String(storyText))}
                </div>
              </div>
            )}
            
            {/* Word Bank */}
            {wordBank.length > 0 && (
              <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                <p className="text-sm font-bold text-purple-900 mb-3">📝 Ngân hàng từ:</p>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {wordBank.map((word: any, idx: number) => {
                    const wordText = word.word || word.text || word;
                    const wordImageUrl = word.imageUrl || word.image_url || word.image;
                    
                    return (
                      <div 
                        key={idx}
                        className="flex flex-col items-center p-3 bg-white border-2 border-purple-300 rounded-lg hover:shadow-md transition-shadow"
                      >
                        {/* Word Image */}
                        {wordImageUrl && (
                          <div className="w-full h-20 mb-2 border-2 border-purple-200 rounded-lg overflow-hidden bg-gray-50">
                            <img 
                              src={getFullMediaUrl(wordImageUrl)} 
                              alt={wordText} 
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )}
                        {/* Word Text */}
                        <span className="font-medium text-purple-900 text-center text-sm">
                          {wordText}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Individual questions (if not using story format) */}
            {fillQuestions.length > 0 && (
              <div className="space-y-4">
                {fillQuestions.map((q: any, idx: number) => {
                  const questionText = q.text || q.question || q.questionText || q.sentence;
                  const hint = q.hint || q.clue || q.prefix || '';
                  const suffix = q.suffix || '';
                  const currentAnswer = answer[idx] || '';
                  
                  return (
                    <div key={idx} className="p-5 bg-white rounded-xl border-3 border-purple-200 shadow-md">
                      <p className="font-medium mb-4 text-gray-800 text-lg">
                        {idx + 1}. {questionText}
                      </p>
                      
                      {/* Input with hint/prefix */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Prefix/hint before input */}
                        {hint && (
                          <span className="text-gray-600 font-medium text-lg">{hint}</span>
                        )}
                        
                        {/* Input field with dotted underline */}
                        <div className="relative flex-1 min-w-[200px]">
                          <input 
                            type="text" 
                            className="w-full px-4 py-2 border-0 border-b-2 border-dotted border-gray-400 focus:border-purple-500 focus:outline-none text-lg font-medium bg-transparent"
                            placeholder=""
                            disabled={!isInteractive}
                            value={currentAnswer}
                            onChange={(e) => handleAnswerChange(idx, e.target.value)}
                            style={{ 
                              borderBottomStyle: 'dotted',
                              borderBottomWidth: '2px'
                            }}
                          />
                        </div>
                        
                        {/* Suffix after input */}
                        {suffix && (
                          <span className="text-gray-600 font-medium text-lg">{suffix}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Warning if no content */}
            {!storyText && fillQuestions.length === 0 && (
              <div className="p-6 bg-yellow-50 rounded-lg border-2 border-yellow-300">
                <p className="text-yellow-800 font-medium">⚠️ Không tìm thấy câu văn hoặc câu hỏi</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* NO IMAGE - Regular vertical layout */
        <>
          {/* Story/Text with gaps */}
          {storyText && storyText !== 'kids_task' && (
            <div className="p-5 bg-white rounded-xl border-3 border-purple-200 shadow-md">
              <div className="text-gray-700 text-lg leading-relaxed">
                {renderFormattedText(String(storyText))}
              </div>
            </div>
          )}
          
          {/* Word Bank */}
          {wordBank.length > 0 && (
            <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
              <p className="text-sm font-bold text-purple-900 mb-3">📝 Ngân hàng từ:</p>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {wordBank.map((word: any, idx: number) => {
                  const wordText = word.word || word.text || word;
                  const wordImageUrl = word.imageUrl || word.image_url || word.image;
                  
                  return (
                    <div 
                      key={idx}
                      className="flex flex-col items-center p-3 bg-white border-2 border-purple-300 rounded-lg hover:shadow-md transition-shadow"
                    >
                      {/* Word Image */}
                      {wordImageUrl && (
                        <div className="w-full h-24 mb-2 border-2 border-purple-200 rounded-lg overflow-hidden bg-gray-50">
                          <img 
                            src={getFullMediaUrl(wordImageUrl)} 
                            alt={wordText} 
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      {/* Word Text */}
                      <span className="font-medium text-purple-900 text-center text-sm">
                        {wordText}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Individual questions (if not using story format) */}
          {fillQuestions.length > 0 && (
            <div className="space-y-4">
              {fillQuestions.map((q: any, idx: number) => {
                const questionText = q.text || q.question || q.questionText || q.sentence;
                const hint = q.hint || q.clue || q.prefix || '';
                const suffix = q.suffix || '';
                const currentAnswer = answer[idx] || '';
                
                return (
                  <div key={idx} className="p-5 bg-white rounded-xl border-3 border-purple-200 shadow-md">
                    <p className="font-medium mb-4 text-gray-800 text-lg">
                      {idx + 1}. {questionText}
                    </p>
                    
                    {/* Input with hint/prefix */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Prefix/hint before input */}
                      {hint && (
                        <span className="text-gray-600 font-medium text-lg">{hint}</span>
                      )}
                      
                      {/* Input field with dotted underline */}
                      <div className="relative flex-1 min-w-[200px]">
                        <input 
                          type="text" 
                          className="w-full px-4 py-2 border-0 border-b-2 border-dotted border-gray-400 focus:border-purple-500 focus:outline-none text-lg font-medium bg-transparent"
                          placeholder=""
                          disabled={!isInteractive}
                          value={currentAnswer}
                          onChange={(e) => handleAnswerChange(idx, e.target.value)}
                          style={{ 
                            borderBottomStyle: 'dotted',
                            borderBottomWidth: '2px'
                          }}
                        />
                      </div>
                      
                      {/* Suffix after input */}
                      {suffix && (
                        <span className="text-gray-600 font-medium text-lg">{suffix}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Warning if no content */}
          {!storyText && fillQuestions.length === 0 && (
            <div className="p-6 bg-yellow-50 rounded-lg border-2 border-yellow-300">
              <p className="text-yellow-800 font-medium">⚠️ Không tìm thấy câu văn hoặc câu hỏi</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

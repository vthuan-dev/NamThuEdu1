import { Volume2 } from 'lucide-react';
import { QuestionRendererProps } from '../../../types/exam';
import { extractTaskData } from '../../../utils/examDataExtractor';
import { getFullMediaUrl } from '../../../utils/mediaUtils';
import { normalizeAudioUrl } from '../../../utils/examUtils';

export function ListenAndWrite({
  question,
  mode,
  answer = {},
  onAnswer
}: QuestionRendererProps) {
  const taskData = extractTaskData(question);
  const { instructions, audioUrl, imageUrl, questions = [], items = [] } = taskData;
  const isInteractive = mode === 'student';
  
  const listeningQuestions = questions.length > 0 ? questions : items;

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
        <div className="p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
          <p className="text-orange-900 font-medium text-lg">🎧 {instructions}</p>
        </div>
      )}
      
      {/* Audio Player */}
      {audioUrl && (
        <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
          <Volume2 className="w-6 h-6 text-orange-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-900">🎵 Audio Instructions</p>
            <audio controls className="w-full mt-2" src={normalizeAudioUrl(getFullMediaUrl(audioUrl) ?? audioUrl)}>
              <source src={normalizeAudioUrl(getFullMediaUrl(audioUrl) ?? audioUrl)} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
          </div>
        </div>
      )}
      
      {/* STICKY IMAGE LAYOUT: Image left (sticky) + Questions right (scrollable) */}
      {imageUrl && listeningQuestions.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
          {/* Sticky Image Column (LEFT) */}
          <div className="sticky top-4 h-fit">
            <div className="border-4 border-orange-300 rounded-xl overflow-hidden bg-white shadow-lg">
              <img 
                src={getFullMediaUrl(imageUrl)} 
                alt="Nghe và điền thông tin" 
                className="w-full h-auto object-contain"
                style={{ maxHeight: '600px' }}
              />
            </div>
          </div>
          
          {/* Scrollable Questions Column (RIGHT) */}
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {listeningQuestions.map((q: any, idx: number) => {
              const questionText = q.text || q.question || q.questionText || q.label || q.field || `Câu ${idx + 1}`;
              const isExample = q.isExample || q.is_example;
              
              return (
                <div key={idx} className={`p-5 bg-white rounded-xl border-3 shadow-md hover:shadow-lg transition-shadow ${
                  isExample ? 'border-amber-300 bg-amber-50' : 'border-orange-200'
                }`}>
                  <div className="flex items-start gap-4">
                    <span className={`flex-shrink-0 w-8 h-8 text-white rounded-full flex items-center justify-center font-bold ${
                      isExample ? 'bg-amber-500' : 'bg-orange-500'
                    }`}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 space-y-3">
                      {isExample && (
                        <span className="inline-block px-3 py-1 bg-amber-200 text-amber-800 rounded-full text-sm font-bold">
                          📌 Ví dụ
                        </span>
                      )}
                      
                      <p className="font-medium text-lg text-gray-800">{questionText}</p>
                      
                      {/* Input field with dotted underline */}
                      <div className="relative">
                        <input 
                          type="text" 
                          className="w-full px-3 py-2 border-0 border-b-2 border-dotted border-gray-500 focus:border-orange-600 focus:outline-none text-lg font-medium bg-transparent"
                          placeholder={isExample ? "(Ví dụ - không tính điểm)" : "Nhập câu trả lời..."}
                          disabled={!isInteractive || isExample}
                          value={answer[idx] || ''}
                          onChange={(e) => handleInputChange(idx, e.target.value)}
                          style={{ 
                            borderBottomStyle: 'dotted',
                            borderBottomWidth: '2px'
                          }}
                        />
                      </div>
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
            <div className="border-4 border-orange-300 rounded-xl overflow-hidden bg-white shadow-lg">
              <img 
                src={getFullMediaUrl(imageUrl)} 
                alt="Question" 
                className="w-full h-auto object-contain"
                style={{ maxHeight: '500px' }}
              />
            </div>
          )}
          
          {/* Questions */}
          {listeningQuestions.length > 0 ? (
            <div className="space-y-4">
              {listeningQuestions.map((q: any, idx: number) => {
                const questionText = q.text || q.question || q.questionText || q.label || q.field || `Câu ${idx + 1}`;
                const isExample = q.isExample || q.is_example;
                
                return (
                  <div key={idx} className={`p-5 bg-white rounded-xl border-3 shadow-md hover:shadow-lg transition-shadow ${
                    isExample ? 'border-amber-300 bg-amber-50' : 'border-orange-200'
                  }`}>
                    <div className="flex items-start gap-4">
                      <span className={`flex-shrink-0 w-8 h-8 text-white rounded-full flex items-center justify-center font-bold ${
                        isExample ? 'bg-amber-500' : 'bg-orange-500'
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="flex-1 space-y-3">
                        {isExample && (
                          <span className="inline-block px-3 py-1 bg-amber-200 text-amber-800 rounded-full text-sm font-bold">
                            📌 Ví dụ
                          </span>
                        )}
                        
                        <p className="font-medium text-lg text-gray-800">{questionText}</p>
                        
                        {/* Input field with dotted underline */}
                        <div className="relative">
                          <input 
                            type="text" 
                            className="w-full px-3 py-2 border-0 border-b-2 border-dotted border-gray-500 focus:border-orange-600 focus:outline-none text-lg font-medium bg-transparent"
                            placeholder={isExample ? "(Ví dụ - không tính điểm)" : "Nhập câu trả lời..."}
                            disabled={!isInteractive || isExample}
                            value={answer[idx] || ''}
                            onChange={(e) => handleInputChange(idx, e.target.value)}
                            style={{ 
                              borderBottomStyle: 'dotted',
                              borderBottomWidth: '2px'
                            }}
                          />
                        </div>
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
    </div>
  );
}

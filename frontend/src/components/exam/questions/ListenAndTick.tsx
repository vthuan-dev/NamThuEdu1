import { Volume2 } from 'lucide-react';
import { QuestionRendererProps } from '../../../types/exam';
import { extractTaskData } from '../../../utils/examDataExtractor';
import { getFullMediaUrl } from '../../../utils/mediaUtils';
import { normalizeAudioUrl } from '../../../utils/examUtils';

export function ListenAndTick({
  question,
  mode,
  answer = {},
  onAnswer
}: QuestionRendererProps) {
  const taskData = extractTaskData(question);
  const { instructions, audioUrl, items = [] } = taskData;
  const isInteractive = mode === 'student';

  const handleOptionSelect = (itemIndex: number, option: string) => {
    if (!isInteractive || !onAnswer) return;
    
    onAnswer({
      ...answer,
      [itemIndex]: option
    });
  };

  return (
    <div className="space-y-4">
      {/* Instructions */}
      {instructions && (
        <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <p className="text-blue-900 font-medium text-lg">{instructions}</p>
        </div>
      )}
      
      {/* Audio */}
      {audioUrl && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <Volume2 className="w-6 h-6 text-blue-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">🎧 Audio Instructions</p>
            <audio controls className="w-full mt-2" src={normalizeAudioUrl(getFullMediaUrl(audioUrl) ?? audioUrl)}>
              <source src={normalizeAudioUrl(getFullMediaUrl(audioUrl) ?? audioUrl)} type="audio/mpeg" />
            </audio>
          </div>
        </div>
      )}
      
      {/* Items with options */}
      {items && Array.isArray(items) && items.length > 0 && (
        <div className="space-y-6">
          {items.map((item: any, idx: number) => (
            <div key={idx} className="p-6 bg-white rounded-xl border-4 border-indigo-200 shadow-lg">
              {/* Question text */}
              <p className="text-xl font-bold text-gray-800 mb-6">
                {idx + 1}. {item.questionText || item.text}
                {item.isExample && <span className="ml-2 text-amber-600">📌 (Ví dụ)</span>}
              </p>
              
              {/* Options A, B, C with checkboxes */}
              <div className="grid grid-cols-3 gap-6">
                {['A', 'B', 'C'].map((option) => {
                  const optionData = item[`option${option}`];
                  const optionImageUrl = optionData?.imageUrl || optionData?.image_url;
                  const isSelected = answer[idx] === option;
                  
                  return (
                    <div 
                      key={option} 
                      className="flex flex-col items-center"
                    >
                      {/* Option letter at top */}
                      <div className="mb-3 font-bold text-2xl text-indigo-600">
                        {option}
                      </div>
                      
                      {/* Image */}
                      {optionImageUrl && (
                        <div className={`border-4 rounded-xl overflow-hidden bg-white shadow-md w-full flex items-center justify-center transition-all ${
                          isSelected ? 'border-green-500' : 'border-gray-300'
                        }`} style={{ minHeight: '150px' }}>
                          <img 
                            src={getFullMediaUrl(optionImageUrl)} 
                            alt={`Option ${option}`} 
                            className="max-w-full max-h-[200px] object-contain"
                          />
                        </div>
                      )}
                      
                      {/* Checkbox below image */}
                      <div 
                        className={`mt-4 cursor-pointer ${isInteractive ? 'hover:scale-110' : ''} transition-transform`}
                        onClick={() => handleOptionSelect(idx, option)}
                      >
                        <div className={`w-10 h-10 rounded-full border-4 flex items-center justify-center transition-all ${
                          isSelected 
                            ? 'bg-green-500 border-green-600' 
                            : 'bg-white border-gray-400'
                        }`}>
                          {isSelected && <span className="text-white text-2xl font-bold">✓</span>}
                        </div>
                      </div>
                      
                      {optionData?.label && (
                        <p className="mt-2 text-sm text-gray-600">{optionData.label}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

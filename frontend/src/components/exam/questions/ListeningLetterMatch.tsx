import { Volume2 } from 'lucide-react';
import { getFullMediaUrl } from '../../../utils/mediaUtils';
import { normalizeAudioUrl } from '../../../utils/examUtils';

interface ListeningLetterMatchProps {
  question: any;
  taskData: any;
  interactiveMode: boolean;
  userAnswer?: any;
  onAnswerChange?: (answer: any) => void;
}

export function ListeningLetterMatch({
  question,
  taskData,
  interactiveMode,
  userAnswer,
  onAnswerChange
}: ListeningLetterMatchProps) {
  const realTaskData = taskData.task_data || taskData;
  const config = taskData.config || realTaskData.config || {};
  
  const items = realTaskData?.items || config?.items || [];
  const instructions = realTaskData?.instructions || config?.instructions;
  const audioUrl = realTaskData?.audioUrl || config?.audioUrl || realTaskData?.audio_url || config?.audio_url;
  
  return (
    <div className="space-y-4">
      {/* Instructions */}
      {instructions && (
        <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <p className="text-blue-900 font-medium text-lg">🎧 {instructions}</p>
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
      
      {/* Letter matching items */}
      {items.length > 0 ? (
        <div className="space-y-4">
          {items.map((item: any, idx: number) => {
            const itemImageUrl = item.imageUrl || item.image_url || item.image;
            const letters = item.letters || [];
            
            return (
              <div key={idx} className="p-5 bg-white rounded-xl border-3 border-blue-200 shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>
                  <div className="flex-1 space-y-3">
                    {/* Item Image */}
                    {itemImageUrl && (
                      <div className="border-3 border-blue-200 rounded-lg overflow-hidden bg-gray-50">
                        <img 
                          src={getFullMediaUrl(itemImageUrl)} 
                          alt={`Item ${idx + 1}`} 
                          className="w-full h-auto object-contain"
                          style={{ maxHeight: '200px' }}
                          onError={(e) => {
                            console.error(`❌ Letter match item ${idx + 1} image failed to load:`, itemImageUrl);
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Letter options */}
                    {letters.length > 0 && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-gray-600 font-medium">Chọn chữ cái:</span>
                        {letters.map((letter: string, letterIdx: number) => (
                          <button
                            key={letterIdx}
                            className={`w-12 h-12 rounded-lg border-2 font-bold text-lg transition-all ${
                              userAnswer?.[idx] === letter
                                ? 'bg-blue-500 text-white border-blue-600'
                                : 'bg-white text-blue-900 border-blue-300 hover:bg-blue-50'
                            }`}
                            disabled={!interactiveMode}
                            onClick={() => {
                              if (onAnswerChange) {
                                onAnswerChange({
                                  ...userAnswer,
                                  [idx]: letter
                                });
                              }
                            }}
                          >
                            {letter}
                          </button>
                        ))}
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
          <p className="text-yellow-800 font-medium">⚠️ Không tìm thấy items cho task này</p>
        </div>
      )}
    </div>
  );
}

import { Volume2 } from 'lucide-react';
import { QuestionRendererProps } from '../../../types/exam';
import { extractTaskData } from '../../../utils/examDataExtractor';
import { getFullMediaUrl } from '../../../utils/mediaUtils';
import { normalizeAudioUrl } from '../../../utils/examUtils';

/**
 * Default fallback renderer for task types that don't have specific components yet
 */
export function DefaultQuestion({ question }: QuestionRendererProps) {
  const taskData = extractTaskData(question);
  const { imageUrl, audioUrl } = taskData;

  return (
    <div className="space-y-4">
      {/* Question Content */}
      {question.qContent && question.qContent !== 'kids_task' && (
        <div className="p-4 bg-white rounded-lg border-2 border-gray-200">
          <div className="text-gray-700 prose max-w-none text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: question.qContent }} />
        </div>
      )}
      
      {/* Show image if available */}
      {imageUrl && (
        <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
          <img 
            src={getFullMediaUrl(imageUrl)} 
            alt="Question" 
            className="w-full h-auto"
          />
        </div>
      )}
      
      {/* Show audio if available */}
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
      
      {/* Show task config if available */}
      {taskData && Object.keys(taskData).length > 0 ? (
        <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <p className="text-sm font-bold text-blue-700 mb-3">🔧 Task Configuration:</p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {Object.entries(taskData).slice(0, 10).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <span className="font-medium text-blue-900 min-w-32">{key}:</span>
                <span className="text-blue-700 break-all">
                  {typeof value === 'object' ? JSON.stringify(value).substring(0, 200) : String(value)}
                </span>
              </div>
            ))}
            {Object.keys(taskData).length > 10 && (
              <p className="text-xs text-blue-600 italic">... và {Object.keys(taskData).length - 10} trường khác</p>
            )}
          </div>
        </div>
      ) : (
        <div className="p-6 bg-yellow-50 rounded-lg border-2 border-yellow-300 text-center">
          <p className="text-yellow-800 font-medium">⚠️ No task configuration data available</p>
          <p className="text-sm text-yellow-700 mt-2">This question may need to be edited to add content</p>
        </div>
      )}
    </div>
  );
}

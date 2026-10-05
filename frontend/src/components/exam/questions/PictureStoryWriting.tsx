import { getFullMediaUrl } from '../../../utils/mediaUtils';

interface PictureStoryWritingProps {
  question: any;
  taskData: any;
  interactiveMode: boolean;
  userAnswer?: any;
  onAnswerChange?: (answer: any) => void;
  mode?: string;
}

export function PictureStoryWriting({
  question,
  taskData,
  interactiveMode,
  userAnswer,
  onAnswerChange,
  mode
}: PictureStoryWritingProps) {
  const realTaskData = taskData.task_data || taskData;
  const config = taskData.config || realTaskData.config || {};
  
  const images = realTaskData?.images || config?.images || realTaskData?.story_images || config?.story_images || [];
  const instructions = realTaskData?.instructions || config?.instructions || question.qContent;
  const minWords = realTaskData?.min_words || config?.min_words || 20;
  const maxWords = realTaskData?.max_words || config?.max_words || 50;
  const sampleStory = realTaskData?.sample_story || config?.sample_story || realTaskData?.sampleStory || config?.sampleStory || realTaskData?.model_answer || config?.model_answer;
  const scoringCriteria = realTaskData?.scoring_criteria || config?.scoring_criteria || { content: 3, language: 3, organization: 2 };
  const explanation = question.qExplanation || (question as any)?.explanation || taskData.explanation || config?.explanation;
  const isTeacherReview = mode === 'preview' || mode === 'review' || !interactiveMode;
  
  return (
    <div className="space-y-4">
      {/* Instructions */}
      {instructions && (
        <div className="p-4 bg-pink-50 rounded-lg border-2 border-pink-200">
          <p className="text-pink-900 font-medium text-lg">📖 {instructions}</p>
        </div>
      )}
      
      {/* Story images in sequence */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {images.map((img: any, idx: number) => {
            const imageUrl = img.url || img.imageUrl || img.image_url || img;
            
            return (
              <div key={idx} className="border-4 border-pink-300 rounded-xl overflow-hidden bg-white shadow-lg">
                <div className="p-2 bg-pink-500 text-white text-center font-bold">
                  {idx + 1}
                </div>
                <img 
                  src={getFullMediaUrl(imageUrl)} 
                  alt={`Story ${idx + 1}`} 
                  className="w-full h-auto object-contain"
                  style={{ maxHeight: '150px' }}
                  onError={() => {
                    console.error(`❌ Story image ${idx + 1} failed to load:`, imageUrl);
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
      
      {/* Writing area */}
      <div className="p-5 bg-white rounded-xl border-3 border-pink-200 shadow-md">
        <p className="text-sm font-bold text-pink-900 mb-3">
          ✍️ Viết câu chuyện ({minWords}-{maxWords} từ):
        </p>
        <textarea
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-pink-500 focus:outline-none text-lg resize-none"
          rows={8}
          placeholder={`Nhìn vào các tranh và viết câu chuyện (${minWords}-${maxWords} từ)...`}
          disabled={!interactiveMode}
          value={userAnswer?.story || (mode === 'preview' && sampleStory ? sampleStory : '')}
          onChange={(e) => {
            if (onAnswerChange) {
              onAnswerChange({
                ...userAnswer,
                story: e.target.value
              });
            }
          }}
        />
        {userAnswer?.story && (
          <p className="text-sm text-gray-600 mt-2 font-medium">
            Số từ: <span className="font-bold text-pink-600">{userAnswer.story.split(/\s+/).filter((w: string) => w).length}</span>
          </p>
        )}
      </div>

      {/* Preview / Teacher Review Section */}
      {isTeacherReview && (
        <div className="space-y-3">
          {sampleStory && (
            <div className="p-4 bg-emerald-50 rounded-xl border-2 border-emerald-200 text-emerald-900 text-sm">
              <p className="font-bold mb-1">📝 Bài mẫu tham khảo:</p>
              <p className="whitespace-pre-wrap leading-relaxed">{sampleStory}</p>
            </div>
          )}

          {scoringCriteria && (
            <div className="p-4 bg-slate-50 rounded-xl border-2 border-slate-200 text-slate-800 text-sm">
              <p className="font-bold mb-2">⚖️ Tiêu chí chấm điểm (Flyers Writing):</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <p className="font-bold text-slate-700">Nội dung (Content):</p>
                  <p className="text-xs text-slate-500 mt-0.5">Tối đa {scoringCriteria.content || 3} điểm</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <p className="font-bold text-slate-700">Ngôn ngữ (Language):</p>
                  <p className="text-xs text-slate-500 mt-0.5">Tối đa {scoringCriteria.language || 3} điểm</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <p className="font-bold text-slate-700">Tổ chức (Organization):</p>
                  <p className="text-xs text-slate-500 mt-0.5">Tối đa {scoringCriteria.organization || 2} điểm</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {images.length === 0 && (
        <div className="p-6 bg-yellow-50 rounded-lg border-2 border-yellow-300">
          <p className="text-yellow-800 font-medium">⚠️ Không tìm thấy story images cho task này</p>
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

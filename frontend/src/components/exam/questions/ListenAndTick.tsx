import { Volume2, CheckCircle2, Lightbulb } from 'lucide-react';
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
  const { instructions, audioUrl, imageUrl, items = [] } = taskData;
  const isPreview = mode === 'preview';
  const isReview = mode === 'review';
  const isTeacherView = isPreview || isReview;
  const isInteractive = mode === 'student';

  const explanation =
    question?.qExplanation ||
    (taskData as any)?.explanation;

  const handleOptionSelect = (itemIndex: number, option: string) => {
    if (!isInteractive || !onAnswer) return;
    
    onAnswer({
      ...answer,
      [itemIndex]: option
    });
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      {instructions && (
        <div className="p-4 bg-blue-50 rounded-2xl border-2 border-blue-200 shadow-xs">
          <p className="text-blue-900 font-bold text-lg flex items-center gap-2">
            <span>🎧</span>
            <span>{instructions}</span>
          </p>
        </div>
      )}
      
      {/* Audio */}
      {audioUrl && (
        <div className="flex items-center gap-3 p-4 bg-blue-50/80 rounded-2xl border-2 border-blue-200 shadow-xs">
          <Volume2 className="w-6 h-6 text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold text-blue-900 uppercase tracking-wide">Audio bài nghe</p>
            <audio controls className="w-full mt-1.5 h-10" src={normalizeAudioUrl(getFullMediaUrl(audioUrl) ?? audioUrl)}>
              <source src={normalizeAudioUrl(getFullMediaUrl(audioUrl) ?? audioUrl)} type="audio/mpeg" />
              Trình duyệt không hỗ trợ audio.
            </audio>
          </div>
        </div>
      )}

      {/* Main image if present */}
      {imageUrl && (
        <div className="rounded-2xl border-2 border-blue-200 overflow-hidden bg-white shadow-xs p-2 flex justify-center">
          <img
            src={getFullMediaUrl(imageUrl) || ''}
            alt="Bức tranh chính"
            className="w-full max-h-[400px] object-contain rounded-xl"
            loading="lazy"
          />
        </div>
      )}
      
      {/* Items with options */}
      {items && Array.isArray(items) && items.length > 0 ? (
        <div className="space-y-6">
          {items.map((item: any, idx: number) => {
            const correctAnswer = item.correctAnswer || item.correct_answer;

            return (
              <div key={idx} className="p-6 bg-white rounded-2xl border-2 border-indigo-200 shadow-xs space-y-4">
                {/* Question text */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                      {idx + 1}
                    </span>
                    <span>{item.questionText || item.text || `Câu hỏi ${idx + 1}`}</span>
                    {item.isExample && <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">📌 Ví dụ mẫu</span>}
                  </p>

                  {isTeacherView && correctAnswer && (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Đáp án đúng: {correctAnswer}</span>
                    </span>
                  )}
                </div>
                
                {/* Options A, B, C with checkboxes */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {['A', 'B', 'C'].map((option) => {
                    const optionData = item[`option${option}`];
                    const optionImageUrl = optionData?.imageUrl || optionData?.image_url || (typeof optionData === 'string' ? optionData : null);
                    const isSelected = answer[idx] === option;
                    const isCorrect = isTeacherView && correctAnswer === option;
                    
                    return (
                      <div 
                        key={option} 
                        className={`flex flex-col items-center p-3 rounded-2xl border-2 transition-all ${
                          isCorrect
                            ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                            : isSelected
                            ? 'border-indigo-500 bg-indigo-50/30 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-indigo-300'
                        }`}
                      >
                        {/* Option letter at top */}
                        <div className="mb-2 font-extrabold text-xl text-indigo-700 flex items-center gap-2">
                          <span>{option}</span>
                          {isCorrect && (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                              Đúng
                            </span>
                          )}
                        </div>
                        
                        {/* Image */}
                        {optionImageUrl && (
                          <div className="rounded-xl overflow-hidden bg-slate-50 w-full flex items-center justify-center min-h-[140px] p-2 border border-slate-100">
                            <img 
                              src={getFullMediaUrl(optionImageUrl) || ''} 
                              alt={`Lựa chọn ${option}`} 
                              className="max-w-full max-h-[180px] object-contain rounded-lg"
                              loading="lazy"
                            />
                          </div>
                        )}
                        
                        {/* Checkbox below image */}
                        <button 
                          type="button"
                          className={`mt-3 cursor-pointer ${isInteractive ? 'hover:scale-105 active:scale-95' : 'cursor-default'} transition-transform flex items-center gap-2`}
                          onClick={() => handleOptionSelect(idx, option)}
                          disabled={!isInteractive}
                        >
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected 
                              ? 'bg-green-500 border-green-600 shadow-xs' 
                              : isCorrect
                              ? 'bg-emerald-100 border-emerald-500'
                              : 'bg-white border-slate-300'
                          }`}>
                            {isSelected && <span className="text-white text-base font-bold">✓</span>}
                            {!isSelected && isCorrect && <span className="text-emerald-700 text-sm font-bold">✓</span>}
                          </div>
                          <span className="text-xs font-bold text-slate-600">Chọn {option}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-6 bg-amber-50 rounded-2xl border-2 border-amber-300 text-center text-amber-800 font-medium">
          ⚠️ Câu hỏi này chưa có danh sách câu hỏi và hình ảnh lựa chọn.
        </div>
      )}

      {/* Hướng dẫn giải thích */}
      {isTeacherView && explanation && (
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/80 p-4 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <Lightbulb className="w-4 h-4 text-amber-600" />
            <span>Hướng dẫn &amp; Giải thích:</span>
          </div>
          <p className="text-amber-950 text-sm leading-relaxed pl-6 whitespace-pre-line font-medium">
            {explanation}
          </p>
        </div>
      )}
    </div>
  );
}

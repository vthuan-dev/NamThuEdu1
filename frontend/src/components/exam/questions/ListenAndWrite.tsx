import { Volume2, CheckCircle2, Lightbulb } from 'lucide-react';
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
  const isPreview = mode === 'preview';
  const isReview = mode === 'review';
  const isTeacherView = isPreview || isReview;
  const isInteractive = mode === 'student';
  
  const listeningQuestions = questions.length > 0 ? questions : items;

  const explanation =
    question?.qExplanation ||
    (taskData as any)?.explanation;

  const handleInputChange = (questionIndex: number, value: string) => {
    if (!isInteractive || !onAnswer) return;
    
    onAnswer({
      ...answer,
      [questionIndex]: value
    });
  };

  const renderQuestionItem = (q: any, idx: number) => {
    const questionText = q.text || q.question || q.questionText || q.label || q.field || `Câu ${idx + 1}`;
    const isExample = q.isExample || q.is_example;
    const correctAnswer = q.correctAnswer || q.correct_answer || q.answer;

    return (
      <div
        key={idx}
        className={`p-5 bg-white rounded-2xl border-2 shadow-xs transition-shadow space-y-3 ${
          isExample ? 'border-amber-300 bg-amber-50/50' : 'border-orange-200'
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex-shrink-0 w-7 h-7 text-white rounded-full flex items-center justify-center font-bold text-xs shadow-xs ${
              isExample ? 'bg-amber-500' : 'bg-orange-600'
            }`}
          >
            {idx + 1}
          </span>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="font-bold text-base text-slate-800">{questionText}</p>
              {isExample && (
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold border border-amber-200">
                  📌 Ví dụ mẫu
                </span>
              )}
              {isTeacherView && !isExample && correctAnswer && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Đáp án đúng: {correctAnswer}</span>
                </span>
              )}
            </div>

            {/* Input field */}
            <div className="pt-1">
              <input
                type="text"
                className="w-full max-w-md px-3 py-2 border-0 border-b-2 border-dotted border-slate-400 focus:border-orange-600 focus:outline-none text-base font-semibold text-slate-800 bg-transparent disabled:text-slate-600"
                placeholder={isExample ? (correctAnswer ? `(Ví dụ: ${correctAnswer})` : '(Ví dụ)') : 'Nhập câu trả lời…'}
                disabled={!isInteractive || isExample}
                value={isExample ? (correctAnswer || '') : (answer[idx] || '')}
                onChange={(e) => handleInputChange(idx, e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      {instructions && (
        <div className="p-4 bg-orange-50 rounded-2xl border-2 border-orange-200 shadow-xs">
          <p className="text-orange-900 font-bold text-lg flex items-center gap-2">
            <span>🎧</span>
            <span>{instructions}</span>
          </p>
        </div>
      )}
      
      {/* Audio Player */}
      {audioUrl && (
        <div className="flex items-center gap-3 p-4 bg-orange-50/80 rounded-2xl border-2 border-orange-200 shadow-xs">
          <Volume2 className="w-6 h-6 text-orange-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold text-orange-900 uppercase tracking-wide">Audio bài nghe</p>
            <audio controls className="w-full mt-1.5 h-10" src={normalizeAudioUrl(getFullMediaUrl(audioUrl) ?? audioUrl)}>
              <source src={normalizeAudioUrl(getFullMediaUrl(audioUrl) ?? audioUrl)} type="audio/mpeg" />
              Trình duyệt không hỗ trợ audio.
            </audio>
          </div>
        </div>
      )}
      
      {/* Layout with Image + Questions */}
      {imageUrl && listeningQuestions.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
          {/* Sticky Image Column (LEFT) */}
          <div className="lg:sticky lg:top-4 h-fit">
            <div className="border-2 border-orange-200 rounded-2xl overflow-hidden bg-white shadow-xs p-2 flex justify-center">
              <img 
                src={getFullMediaUrl(imageUrl) || ''} 
                alt="Nghe và điền thông tin" 
                className="w-full h-auto max-h-[500px] object-contain rounded-xl"
                loading="lazy"
              />
            </div>
          </div>
          
          {/* Questions Column (RIGHT) */}
          <div className="space-y-3">
            {listeningQuestions.map((q: any, idx: number) => renderQuestionItem(q, idx))}
          </div>
        </div>
      ) : (
        <>
          {imageUrl && (
            <div className="border-2 border-orange-200 rounded-2xl overflow-hidden bg-white shadow-xs p-2 flex justify-center">
              <img 
                src={getFullMediaUrl(imageUrl) || ''} 
                alt="Question" 
                className="w-full h-auto max-h-[450px] object-contain rounded-xl"
                loading="lazy"
              />
            </div>
          )}
          
          {listeningQuestions.length > 0 ? (
            <div className="space-y-3">
              {listeningQuestions.map((q: any, idx: number) => renderQuestionItem(q, idx))}
            </div>
          ) : (
            <div className="p-6 bg-amber-50 rounded-2xl border-2 border-amber-300 text-center text-amber-800 font-medium">
              ⚠️ Không tìm thấy câu hỏi cho task này.
            </div>
          )}
        </>
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

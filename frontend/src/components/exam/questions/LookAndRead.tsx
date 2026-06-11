import { QuestionRendererProps } from '../../../types/exam';
import { extractTaskData } from '../../../utils/examDataExtractor';
import { getFullMediaUrl } from '../../../utils/mediaUtils';

export function LookAndRead({
  question,
  mode,
  answer = {},
  onAnswer
}: QuestionRendererProps) {
  const taskData = extractTaskData(question);
  const { instructions, imageUrl, questions = [], items = [] } = taskData;
  const isInteractive = mode === 'student';
  const answerFormat = (taskData as any).answer_format || (taskData as any).answerFormat || taskData.config?.answer_format || 'tick_cross';
  const isYesNo = answerFormat === 'yes_no';
  const trueLabel = isYesNo ? '✔ Yes' : '✓ Đúng';
  const falseLabel = isYesNo ? '✘ No' : '✗ Sai';

  // Use questions array, fallback to items
  const readingQuestions = questions.length > 0 ? questions : items;

  const handleAnswerSelect = (questionIndex: number, value: boolean) => {
    if (!isInteractive || !onAnswer) return;

    onAnswer({
      ...answer,
      [questionIndex]: value
    });
  };

  // Single source of truth for rendering one statement row
  const renderQuestionCard = (q: any, idx: number) => {
    const questionText = q.text || q.question || q.questionText || q.label || q.statement || `Câu ${idx + 1}`;
    const itemImageUrl = q.imageUrl || q.image_url || q.image;
    const answerValue = answer[idx];

    return (
      <div key={idx} className="p-5 bg-white rounded-2xl border-2 border-purple-200 shadow-md hover:shadow-lg transition-shadow">
        <div className="flex items-start gap-4">
          <span className="flex-shrink-0 w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold">
            {idx + 1}
          </span>
          <div className="flex-1 space-y-3 min-w-0">
            {/* Item Image (if exists) */}
            {itemImageUrl && (
              <div className="border-2 border-purple-200 rounded-lg overflow-hidden bg-gray-50">
                <img
                  src={getFullMediaUrl(itemImageUrl)}
                  alt={`Question ${idx + 1}`}
                  className="w-full h-auto object-contain"
                  style={{ maxHeight: '200px' }}
                />
              </div>
            )}

            <p className="font-medium text-lg text-gray-800">{questionText}</p>

            {/* Tick/Cross or Yes/No buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                className={`flex-1 min-w-[120px] px-5 py-3 rounded-xl border-2 font-bold text-lg whitespace-nowrap transition-all ${
                  isInteractive ? 'hover:scale-105 cursor-pointer' : 'cursor-not-allowed'
                } ${
                  answerValue === true
                    ? 'bg-green-500 text-white border-green-600'
                    : 'border-green-400 hover:bg-green-50'
                }`}
                disabled={!isInteractive}
                onClick={() => handleAnswerSelect(idx, true)}
              >
                {trueLabel}
              </button>
              <button
                className={`flex-1 min-w-[120px] px-5 py-3 rounded-xl border-2 font-bold text-lg whitespace-nowrap transition-all ${
                  isInteractive ? 'hover:scale-105 cursor-pointer' : 'cursor-not-allowed'
                } ${
                  answerValue === false
                    ? 'bg-red-500 text-white border-red-600'
                    : 'border-red-400 hover:bg-red-50'
                }`}
                disabled={!isInteractive}
                onClick={() => handleAnswerSelect(idx, false)}
              >
                {falseLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Instructions */}
      {instructions && (
        <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
          <p className="text-purple-900 font-medium text-lg">📖 {instructions}</p>
        </div>
      )}

      {/* STICKY IMAGE LAYOUT: shared image left (sticky) + questions right (scrollable) */}
      {imageUrl && readingQuestions.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-6 items-start">
          {/* Sticky Image Column (LEFT) */}
          <div className="lg:sticky lg:top-4 h-fit min-w-0">
            <div className="border-4 border-purple-300 rounded-2xl overflow-hidden bg-white shadow-lg">
              <img
                src={getFullMediaUrl(imageUrl)}
                alt="Nhìn tranh và đánh dấu đúng/sai"
                className="w-full h-auto object-contain"
                style={{ maxHeight: '600px' }}
              />
            </div>
          </div>

          {/* Scrollable Questions Column (RIGHT) */}
          <div className="space-y-4 min-w-0 lg:max-h-[600px] lg:overflow-y-auto lg:pr-2">
            {readingQuestions.map((q: any, idx: number) => renderQuestionCard(q, idx))}
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
              {readingQuestions.map((q: any, idx: number) => renderQuestionCard(q, idx))}
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

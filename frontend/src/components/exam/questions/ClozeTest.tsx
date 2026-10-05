import { Lightbulb, CheckCircle2 } from 'lucide-react';

interface ClozeTestProps {
  question: any;
  taskData: any;
  mode?: 'student' | 'preview' | 'review';
  interactiveMode?: boolean;
  userAnswer?: any;
  answer?: any;
  onAnswerChange?: (answer: any) => void;
  onAnswer?: (answer: any) => void;
}

export function ClozeTest(props: ClozeTestProps) {
  const { question, taskData } = props;
  const realTaskData = taskData.task_data || taskData;
  const config = taskData.config || realTaskData.config || {};

  const isPreview = props.mode === 'preview';
  const isReview = props.mode === 'review';
  const isTeacherView = isPreview || isReview;
  const interactive = props.mode === 'student' || props.interactiveMode === true;
  const onSave = props.onAnswer ?? props.onAnswerChange;
  const userAns = props.answer ?? props.userAnswer ?? {};

  const text =
    realTaskData?.text ||
    config?.text ||
    realTaskData?.story ||
    config?.story;

  const instructions =
    taskData?.instructions ||
    realTaskData?.instructions ||
    config?.instructions ||
    question?.qContent ||
    'Đọc đoạn văn và chọn từ đúng nhất cho mỗi chỗ trống.';

  const explanation =
    question?.qExplanation ||
    realTaskData?.explanation ||
    config?.explanation;

  // New editor format: gaps = [{ gap_id, options, correct_answer }]
  const rawGaps = realTaskData?.gaps || config?.gaps;
  // Legacy format: questions = [{ gap_number, options, correct_answer }]
  const rawQuestions = realTaskData?.questions || config?.questions;

  let gapList: Array<{ gapId: number | string; options: string[]; correctAnswer: string }> = [];

  if (Array.isArray(rawGaps) && rawGaps.length > 0) {
    gapList = rawGaps.map((g: any) => ({
      gapId: g.gap_id ?? g.id,
      options: g.options || [],
      correctAnswer: g.correct_answer || g.correctAnswer || '',
    }));
  } else if (Array.isArray(rawQuestions) && rawQuestions.length > 0) {
    gapList = rawQuestions.map((q: any, idx: number) => ({
      gapId: q.gap_number || q.gapNumber || idx + 1,
      options: q.options || [],
      correctAnswer: q.correct_answer || q.correctAnswer || q.answer || '',
    }));
  }

  // Story title question
  const storyTitleQuestion =
    realTaskData?.story_title_question ||
    config?.story_title_question;

  const handleSelectOption = (gapId: string | number, option: string) => {
    if (!interactive || !onSave) return;
    onSave({
      ...userAns,
      [gapId]: option,
    });
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="rounded-2xl bg-purple-50 border-2 border-purple-200 px-5 py-4 shadow-xs">
        <p className="text-purple-900 font-bold text-lg flex items-center gap-2">
          <span>📄</span>
          <span>{instructions}</span>
        </p>
      </div>

      {/* Text with gaps */}
      {text && text !== 'kids_task' && (
        <div className="p-6 bg-white rounded-2xl border-2 border-purple-200 shadow-xs">
          <div
            className="text-slate-800 text-[16px] leading-relaxed whitespace-pre-line"
            dangerouslySetInnerHTML={{ __html: text }}
          />
        </div>
      )}

      {/* Gap multiple choice options */}
      {gapList.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
            <span>🔢</span> Lựa chọn từ đúng cho từng chỗ trống:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gapList.map((gap, idx) => {
              const selectedOpt = userAns?.[gap.gapId];

              return (
                <div
                  key={idx}
                  className="p-5 bg-white rounded-2xl border-2 border-purple-200 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-base text-slate-800 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                        {gap.gapId}
                      </span>
                      Chỗ trống ({gap.gapId})
                    </span>

                    {isTeacherView && gap.correctAnswer && (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                        ✓ Đáp án: {gap.correctAnswer}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {gap.options.map((opt, optIdx) => {
                      const isSelected = selectedOpt === opt;
                      const isCorrect = isTeacherView && gap.correctAnswer === opt;

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={!interactive}
                          onClick={() => handleSelectOption(gap.gapId, opt)}
                          className={`px-3 py-2.5 rounded-xl border-2 text-center text-sm font-bold transition-all ${
                            isCorrect
                              ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                              : isSelected
                              ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-purple-300 hover:bg-white'
                          } ${!interactive && !isCorrect ? 'cursor-default' : ''}`}
                        >
                          {String.fromCharCode(65 + optIdx)}. {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-6 bg-amber-50 rounded-2xl border-2 border-amber-300 text-center text-amber-800 font-medium">
          ⚠️ Câu hỏi này chưa có danh sách lựa chọn cho các chỗ trống.
        </div>
      )}

      {/* Câu hỏi chọn tên câu chuyện (nếu có) */}
      {storyTitleQuestion && storyTitleQuestion.options?.length > 0 && (
        <div className="p-5 bg-white rounded-2xl border-2 border-purple-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-800 text-base">
              📖 Chọn tiêu đề phù hợp nhất cho câu chuyện:
            </h4>
            {isTeacherView && storyTitleQuestion.correct_answer && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                ✓ {storyTitleQuestion.correct_answer}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            {storyTitleQuestion.options.map((titleOpt: string, tIdx: number) => {
              const isSelected = userAns?.story_title === titleOpt;
              const isCorrect = isTeacherView && storyTitleQuestion.correct_answer === titleOpt;

              return (
                <button
                  key={tIdx}
                  type="button"
                  disabled={!interactive}
                  onClick={() => handleSelectOption('story_title', titleOpt)}
                  className={`px-4 py-2.5 rounded-xl border-2 text-center text-sm font-bold transition-all ${
                    isCorrect
                      ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                      : isSelected
                      ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-purple-300 hover:bg-white'
                  }`}
                >
                  {String.fromCharCode(65 + tIdx)}. {titleOpt}
                </button>
              );
            })}
          </div>
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

import { Lightbulb, CheckCircle2 } from 'lucide-react';

interface DialogueMatchingProps {
  question: any;
  taskData: any;
  mode?: 'student' | 'preview' | 'review';
  interactiveMode?: boolean;
  userAnswer?: any;
  answer?: any;
  onAnswerChange?: (answer: any) => void;
  onAnswer?: (answer: any) => void;
}

export function DialogueMatching(props: DialogueMatchingProps) {
  const { question, taskData } = props;
  const realTaskData = taskData.task_data || taskData;
  const config = taskData.config || realTaskData.config || {};

  const isPreview = props.mode === 'preview';
  const isReview = props.mode === 'review';
  const isTeacherView = isPreview || isReview;
  const interactive = props.mode === 'student' || props.interactiveMode === true;
  const onSave = props.onAnswer ?? props.onAnswerChange;
  const userAns = props.answer ?? props.userAnswer ?? {};

  const instructions =
    taskData?.instructions ||
    realTaskData?.instructions ||
    config?.instructions ||
    question?.qContent ||
    'Đọc đoạn hội thoại và chọn câu trả lời phù hợp nhất (A-H).';

  const explanation =
    question?.qExplanation ||
    realTaskData?.explanation ||
    config?.explanation;

  // New editor format: dialogues = [{ question, options, correct_answer }]
  const rawDialogues = realTaskData?.dialogues || config?.dialogues;
  // Legacy format: questions + distractors
  const rawQuestions = realTaskData?.questions || config?.questions;
  const distractors: string[] = realTaskData?.distractors || config?.distractors || [];

  let dialogueList: Array<{
    question: string;
    options: Array<{ id: string; text: string }>;
    correctAnswer: string;
  }> = [];

  if (Array.isArray(rawDialogues) && rawDialogues.length > 0) {
    dialogueList = rawDialogues.map((d: any) => ({
      question: d.question || d.text || '',
      options: Array.isArray(d.options)
        ? d.options.map((o: any, idx: number) =>
            typeof o === 'string'
              ? { id: String.fromCharCode(65 + idx), text: o }
              : { id: o.id || String.fromCharCode(65 + idx), text: o.text || '' }
          )
        : [],
      correctAnswer: d.correct_answer || d.correctAnswer || '',
    }));
  } else if (Array.isArray(rawQuestions) && rawQuestions.length > 0) {
    const allOptionsPool = [
      ...rawQuestions.map((q: any) => q.correct_answer || q.correctAnswer),
      ...distractors,
    ]
      .filter(Boolean)
      .map((text: string, idx: number) => ({ id: String.fromCharCode(65 + idx), text }));

    dialogueList = rawQuestions.map((q: any) => ({
      question: q.question || q.text || '',
      options: allOptionsPool,
      correctAnswer: q.correct_answer || q.correctAnswer || '',
    }));
  }

  // Tập hợp danh sách đáp án dùng chung nếu có (để hiển thị bảng A-H ở trên)
  const sharedOptions =
    dialogueList.length > 0 && dialogueList[0].options.length > 0
      ? dialogueList[0].options
      : [];

  const handleSelectAnswer = (dIdx: number, val: string) => {
    if (!interactive || !onSave) return;
    onSave({
      ...userAns,
      [dIdx]: val,
    });
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="rounded-2xl bg-green-50 border-2 border-green-200 px-5 py-4 shadow-xs">
        <p className="text-green-900 font-bold text-lg flex items-center gap-2">
          <span>💬</span>
          <span>{instructions}</span>
        </p>
      </div>

      {/* Bảng các câu trả lời lựa chọn (A - H) */}
      {sharedOptions.length > 0 && (
        <div className="p-5 bg-white rounded-2xl border-2 border-green-200 shadow-xs space-y-3">
          <p className="text-sm font-bold text-green-900 flex items-center gap-1.5">
            <span>📝</span> Danh sách câu trả lời để chọn:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {sharedOptions.map((opt) => (
              <div
                key={opt.id}
                className="px-3.5 py-2.5 bg-green-50/60 border border-green-200 rounded-xl flex items-start gap-2.5 text-sm"
              >
                <span className="w-6 h-6 rounded-full bg-green-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  {opt.id}
                </span>
                <span className="font-semibold text-slate-800 leading-snug">{opt.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danh sách các câu hội thoại */}
      {dialogueList.length > 0 ? (
        <div className="space-y-4">
          {dialogueList.map((d, idx) => {
            const currentSelected = userAns?.[idx] || '';

            return (
              <div
                key={idx}
                className="p-5 bg-white rounded-2xl border-2 border-green-200 shadow-xs space-y-3"
              >
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-green-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                    {idx + 1}
                  </span>
                  <div className="flex-1 space-y-2.5">
                    <p className="font-bold text-base text-slate-800">{d.question}</p>

                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-semibold text-slate-600">Chọn câu đáp:</span>
                      <select
                        value={currentSelected}
                        disabled={!interactive}
                        onChange={(e) => handleSelectAnswer(idx, e.target.value)}
                        className="px-3 py-2 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-800 outline-none focus:border-green-500 bg-white disabled:bg-slate-50 transition-colors"
                      >
                        <option value="">-- Chọn (A-H) --</option>
                        {d.options.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.id}. {opt.text}
                          </option>
                        ))}
                      </select>

                      {/* Hiển thị đáp án đúng cho giáo viên */}
                      {isTeacherView && d.correctAnswer && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Đáp án đúng: {d.correctAnswer}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-6 bg-amber-50 rounded-2xl border-2 border-amber-300 text-center text-amber-800 font-medium">
          ⚠️ Câu hỏi này chưa có danh sách hội thoại.
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

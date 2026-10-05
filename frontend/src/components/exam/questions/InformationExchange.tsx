import { getFullMediaUrl } from '../../../utils/mediaUtils';
import { Lightbulb, MessageSquare, CheckCircle2, HelpCircle } from 'lucide-react';

interface InformationExchangeProps {
  question: any;
  taskData: any;
  mode?: 'student' | 'preview' | 'review';
  interactiveMode?: boolean;
  userAnswer?: any;
  answer?: any;
  onAnswerChange?: (answer: any) => void;
  onAnswer?: (answer: any) => void;
}

export function InformationExchange(props: InformationExchangeProps) {
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
    'Hỏi và trả lời câu hỏi dựa trên thông tin cho sẵn (Information Exchange).';

  const imageUrl =
    realTaskData?.imageUrl ||
    config?.imageUrl ||
    realTaskData?.image_url ||
    config?.image_url ||
    taskData?.imageUrl ||
    question?.qMedia_url;

  const candidateCard =
    realTaskData?.candidateCard ||
    realTaskData?.candidate_card ||
    config?.candidateCard ||
    config?.candidate_card;

  const cardTitle = candidateCard?.title || realTaskData?.cardTitle || config?.cardTitle || '';
  const knownInfo: Array<{ field: string; value: string }> =
    candidateCard?.knownInfo ||
    candidateCard?.known_info ||
    realTaskData?.knownInfo ||
    config?.knownInfo ||
    [];

  const questionsToAsk: string[] =
    candidateCard?.questionsToAsk ||
    candidateCard?.questions_to_ask ||
    realTaskData?.questionsToAsk ||
    config?.questionsToAsk ||
    [];

  const legacyQuestions: any[] = realTaskData?.questions || config?.questions || [];

  const explanation =
    question?.qExplanation ||
    realTaskData?.explanation ||
    config?.explanation;

  const update = (key: string | number, v: string) => {
    if (!interactive || !onSave) return;
    onSave({ ...userAns, [key]: v });
  };

  const hasContent = !!imageUrl || knownInfo.length > 0 || questionsToAsk.length > 0 || legacyQuestions.length > 0;

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-200 px-5 py-4 shadow-xs">
        <p className="text-emerald-900 font-bold text-lg flex items-center gap-2">
          <span>💬</span>
          <span>{instructions}</span>
        </p>
      </div>

      {/* Main Image */}
      {imageUrl && (
        <div className="border-2 border-emerald-200 rounded-2xl overflow-hidden bg-white shadow-xs p-2 flex justify-center">
          <img
            src={getFullMediaUrl(imageUrl) || ''}
            alt="Information Exchange"
            className="w-full max-h-[500px] object-contain rounded-xl"
            loading="lazy"
          />
        </div>
      )}

      {/* Candidate Card (Known Info) */}
      {(cardTitle || knownInfo.length > 0) && (
        <div className="rounded-2xl border-2 border-emerald-200 bg-white overflow-hidden shadow-xs">
          <div className="bg-emerald-600 text-white px-5 py-3 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <h4 className="font-bold text-base">{cardTitle || 'Thông tin thẻ bài (Card Information)'}</h4>
          </div>
          <div className="p-4 divide-y divide-slate-100">
            {knownInfo.map((info, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between gap-4 text-sm">
                <span className="font-bold text-slate-700">{info.field}:</span>
                <span className="font-semibold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
                  {info.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Questions to Ask */}
      {questionsToAsk.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-emerald-600" />
            <span>Các câu hỏi gợi ý cần đặt (Questions to Ask):</span>
          </p>
          <div className="space-y-2.5">
            {questionsToAsk.map((prompt, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border-2 border-emerald-200 bg-white shadow-xs flex items-center gap-3"
              >
                <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                  {idx + 1}
                </span>
                <p className="font-semibold text-slate-800 text-sm flex-1">{prompt}</p>
                {interactive && (
                  <input
                    type="text"
                    className="w-1/2 px-3 py-1.5 border-2 border-slate-200 rounded-lg text-sm font-medium focus:border-emerald-500 focus:outline-none"
                    placeholder="Câu trả lời của học sinh…"
                    value={userAns[`ask_${idx}`] || ''}
                    onChange={(e) => update(`ask_${idx}`, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legacy Questions */}
      {legacyQuestions.length > 0 && (
        <div className="space-y-4">
          {legacyQuestions.map((q: any, idx: number) => {
            const questionText = q.text || q.question || q.questionText;
            return (
              <div key={idx} className="p-5 bg-white rounded-2xl border-2 border-emerald-200 shadow-xs space-y-3">
                <div className="flex items-start gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-xs">
                    {idx + 1}
                  </span>
                  <div className="flex-1 space-y-2">
                    <p className="font-bold text-lg text-slate-800">{questionText}</p>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none text-[15px] font-medium disabled:bg-slate-50 disabled:text-slate-600 transition-colors"
                      placeholder="Nhập câu trả lời…"
                      disabled={!interactive}
                      value={userAns[idx] || ''}
                      onChange={(e) => update(idx, e.target.value)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!hasContent && (
        <div className="p-6 bg-amber-50 rounded-2xl border-2 border-amber-300 text-center text-amber-800 font-medium">
          ⚠️ Câu hỏi này chưa có thông tin thẻ hỏi-đáp.
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

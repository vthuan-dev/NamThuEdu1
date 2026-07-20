import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { studentApi } from '../../../../services/studentApi';
import { extractTaskData } from '../../../../utils/examDataExtractor';
import { parseKidsAnswer } from './player/kidsAnswer';
import { buildReviewRows, MANUAL_REVIEW_TYPES } from './player/kidsAnswerKey';

const BASE = '/hoc-vien';

export function KidsAnswerReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const submissionId = Number(id);

  const { data, isLoading, error } = useQuery({
    queryKey: ['kids-answers', submissionId],
    queryFn: () => studentApi.getAnswers(submissionId),
    enabled: !!submissionId,
  });

  const raw = (data as any)?.data?.data ?? (data as any)?.data;
  const rawItems = raw?.detailed_answers ?? [];
  const items: any[] = Array.isArray(rawItems)
    ? rawItems
    : rawItems && typeof rawItems === 'object'
      ? Object.values(rawItems)
      : [];

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: '#FB7185' }} />
        <p className="text-sm font-bold text-slate-400">Đang tải bài làm của bạn…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-8 text-center shadow-xl">
          <XCircle className="mx-auto h-12 w-12 text-rose-400" />
          <p className="font-bold text-slate-700">Không xem được bài làm.</p>
          <button
            onClick={() => navigate(-1)}
            className="w-full rounded-2xl py-3 font-extrabold text-white"
            style={{ background: 'linear-gradient(135deg,#FB7185,#F97316)' }}
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-2xl p-2.5 transition-colors hover:bg-rose-50"
          style={{ color: '#FB7185' }}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: '#1A1040' }}>
            Bài làm của bạn 🌟
          </h1>
          <p className="text-sm font-semibold text-slate-400">
            {raw?.submission_info?.exam_title ?? ''}
          </p>
        </div>
      </div>

      {/* Tasks */}
      <div className="space-y-4">
        {items.map((item: any, idx: number) => {
          const q = item.question;
          const cfg = q?.kids_task_config;
          const studentAns = item.student_answer;
          const isManualPending = studentAns?.saIs_correct === null || studentAns?.saIs_correct === undefined;

          // Câu không phải kids task → bỏ qua hiển thị chi tiết (hiếm)
          const taskType: string = cfg?.task_type ?? '';
          // Chuẩn hoá task_data (xử lý mọi kiểu lồng config/task_data) để build review.
          const taskData = cfg ? extractTaskData(q) : null;
          const answerMap = parseKidsAnswer(studentAns?.saAnswer_text);
          let rows = taskData ? buildReviewRows(taskType, taskData, answerMap) : [];
          if (studentAns?.saIs_correct === true || studentAns?.saIs_correct === 1) {
            rows = rows.map((r: any) => ({ ...r, isCorrect: true }));
          }
          const isManualType = MANUAL_REVIEW_TYPES.has(taskType);

          return (
            <div
              key={q?.qId ?? idx}
              className="rounded-3xl bg-white p-5"
              style={{ border: '2px solid #F1F5F9', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
            >
              {/* Title */}
              <div className="mb-3 flex items-start gap-3">
                <span
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                  style={{ background: '#FB7185' }}
                >
                  {idx + 1}
                </span>
                <p
                  className="flex-1 text-[15px] font-bold leading-snug"
                  style={{ color: '#1A1040' }}
                  dangerouslySetInnerHTML={{ __html: q?.qContent ?? '' }}
                />
              </div>

              {/* Manual-graded (nói/viết) */}
              {isManualType || rows.length === 0 ? (
                <div className="ml-6 sm:ml-10 space-y-2">
                  {studentAns?.saAnswer_text ? (
                    <div className="rounded-2xl bg-slate-50 p-3 text-[15px] text-slate-700">
                      {answerMap['0'] ?? studentAns.saAnswer_text}
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-slate-400">Bạn chưa trả lời câu này.</p>
                  )}
                  {isManualPending && (
                    <div className="flex items-center gap-2 rounded-2xl bg-amber-50 p-3 text-amber-700">
                      <Clock className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm font-bold">Thầy/cô sẽ chấm phần này cho bạn.</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Auto-graded: bảng từng ô con */
                <div className="ml-6 sm:ml-10 space-y-2">
                  {rows.map((r, ri) => (
                    <div
                      key={ri}
                      className="flex items-center gap-3 rounded-2xl p-3"
                      style={{
                        background: r.isCorrect ? '#F0FFF4' : '#FFF1F2',
                        border: `1.5px solid ${r.isCorrect ? '#BBF7D0' : '#FECDD3'}`,
                      }}
                    >
                      {r.isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500" />
                      ) : (
                        <XCircle className="h-5 w-5 flex-shrink-0 text-rose-500" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-slate-400">{r.label}</p>
                        <p className="text-[15px] font-semibold text-slate-700">
                          {r.student}
                          {!r.isCorrect && (
                            <span className="ml-2 text-emerald-600">→ {r.correct}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Explanation (Optional) */}
              {q?.qExplanation && (
                <div className="ml-6 sm:ml-10 mt-4 rounded-2xl bg-rose-50/50 p-4 border border-rose-100 flex items-start gap-2.5">
                  <span className="text-lg">💡</span>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Giải thích đáp án</p>
                    <p className="text-[14px] font-semibold text-slate-700 leading-relaxed">{q.qExplanation}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default KidsAnswerReview;

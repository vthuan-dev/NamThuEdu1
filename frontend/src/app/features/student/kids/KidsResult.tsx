/**
 * KidsResult — Trang xem điểm vui vẻ cho trẻ 6-12 (Cambridge YL)
 *
 * Khác bản người lớn (ResultDetail): claymorphism, lời khen ngợi theo điểm,
 * vòng tròn điểm to, sao thưởng, và trạng thái "Chờ thầy/cô chấm" thân thiện.
 * Dùng chung studentApi.getSubmissionDetail để lấy dữ liệu.
 */
import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, RefreshCw } from 'lucide-react';
import { studentApi } from '../../../../services/studentApi';
import { usePageTitle } from '../../../../hooks/usePageTitle';
import { extractTaskData } from '../../../../utils/examDataExtractor';
import { getFullMediaUrl } from '../../../../utils/mediaUtils';
import { parseKidsAnswer } from './player/kidsAnswer';
import { buildReviewRows, buildCorrectAnswerMap, MANUAL_REVIEW_TYPES } from './player/kidsAnswerKey';
import { QuestionRenderer } from '../../../../components/exam/QuestionRenderer';

const BASE = '/hoc-vien';

// Khen ngợi theo % điểm
function getPraise(pct: number) {
  if (pct >= 90) return { emoji: '🏆', title: 'Xuất sắc!', msg: 'Em làm bài tuyệt vời lắm!', c: '#059669', bg: 'linear-gradient(135deg,#D1FAE5,#A7F3D0)' };
  if (pct >= 75) return { emoji: '🌟', title: 'Giỏi lắm!', msg: 'Em làm rất tốt, cố lên nhé!', c: '#2563EB', bg: 'linear-gradient(135deg,#DBEAFE,#BFDBFE)' };
  if (pct >= 50) return { emoji: '👍', title: 'Khá tốt!', msg: 'Em đang tiến bộ rồi đấy!', c: '#B45309', bg: 'linear-gradient(135deg,#FEF3C7,#FDE68A)' };
  return { emoji: '💪', title: 'Cố lên nhé!', msg: 'Luyện thêm chút nữa là giỏi ngay!', c: '#E11D48', bg: 'linear-gradient(135deg,#FFE4E6,#FECDD3)' };
}

function KidsScoreRing({ pct, color }: { pct: number; color: string }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="7" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold tabular-nums" style={{ color: '#1A1040' }}>{pct}</span>
        <span className="text-[10px] font-bold text-slate-500">điểm</span>
      </div>
    </div>
  );
}

export function KidsResult() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const submissionId = Number(id);
  usePageTitle('Kết quả của em');

  const { data, isLoading } = useQuery({
    queryKey: ['kids-submission', submissionId],
    queryFn: () => studentApi.getSubmissionDetail(submissionId),
    enabled: !!submissionId,
    refetchInterval: (query) => {
      const s: any = (query.state.data as any)?.data?.data ?? (query.state.data as any)?.data;
      return s?.sStatus && s.sStatus !== 'graded' ? 8000 : false;
    },
  });

  const { data: answersData } = useQuery({
    queryKey: ['kids-answers', submissionId],
    queryFn: () => studentApi.getAnswers(submissionId),
    enabled: !!submissionId,
  });

  const sub = (data as any)?.data?.data ?? (data as any)?.data;
  const raw = (answersData as any)?.data?.data ?? (answersData as any)?.data;
  const rawItems: any[] = Array.isArray(raw?.detailed_answers)
    ? raw?.detailed_answers
    : raw?.detailed_answers && typeof raw?.detailed_answers === 'object'
      ? Object.values(raw?.detailed_answers)
      : Array.isArray(sub?.answers)
        ? sub.answers.map((a: any) => ({ question: a.question ?? {}, student_answer: a }))
        : [];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #FFF1F2 0%, #FFF7ED 50%, #F0FDF4 100%)' }}>
        <div className="text-center space-y-3">
          <div className="text-5xl animate-bounce">🎈</div>
          <p className="text-base font-bold text-rose-500">Đang xem kết quả…</p>
        </div>
      </div>
    );
  }

  const maxScore = typeof sub?.exam?.eMax_score === 'number' ? sub.exam.eMax_score : parseFloat(sub?.exam?.eMax_score) || 100;
  const rawScore = typeof sub?.sScore === 'number' ? sub.sScore : parseFloat(sub?.sScore) || 0;
  const pct = maxScore > 0 ? Math.round((rawScore / maxScore) * 100) : 0;
  const isGraded = sub?.sStatus === 'graded';
  const correct = sub?.answers?.filter((a: any) => a.saIs_correct)?.length ?? 0;
  const totalQ = sub?.exam?.questions?.length ?? sub?.answers?.length ?? 0;
  const praise = getPraise(pct);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #FFF1F2 0%, #FFF7ED 50%, #F0FDF4 100%)' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 sm:pt-5 pb-4 space-y-3">

        <button onClick={() => navigate(`${BASE}/bai-tap`)}
          className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-rose-600 hover:bg-white transition-colors"
          style={{ boxShadow: '0 4px 14px rgba(244,63,94,0.12)' }}>
          <ArrowLeft className="w-4 h-4" /> Về danh sách bài
        </button>

        {!isGraded ? (
          /* ─── Chờ chấm ─────────────────────────────────────────── */
          <section className="rounded-3xl p-7 sm:p-9 text-center"
            style={{ background: 'linear-gradient(135deg,#FFFFFF,#FFF7ED)', boxShadow: '0 12px 40px rgba(251,113,133,0.16)', border: '2px solid rgba(255,255,255,0.9)' }}>
            <div className="text-6xl mb-3">📨</div>
            <h1 className="text-2xl font-extrabold" style={{ color: '#9F1239' }}>Em đã nộp bài rồi!</h1>
            <p className="mt-2 text-sm font-medium text-slate-500 max-w-sm mx-auto">
              Thầy/cô đang chấm bài của em. Khi chấm xong, em sẽ nhận được thông báo
              <span className="inline-flex items-center"> 🔔</span> ngay nhé!
            </p>
            <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold text-amber-700"
              style={{ background: 'rgba(251,191,36,0.15)', border: '1.5px solid rgba(251,191,36,0.3)' }}>
              <Clock className="w-4 h-4 animate-pulse" /> Đang chờ chấm điểm
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            </div>
            <p className="mt-3 text-xs text-slate-400 font-medium">{sub?.exam?.eTitle ?? 'Bài thi'}</p>
          </section>
        ) : (
          /* ─── Đã chấm — compact inline ────────────────────────── */
          <>
            {/* Compact score header */}
            <section className="flex items-center gap-4 rounded-2xl p-4"
              style={{ background: praise.bg, boxShadow: '0 8px 24px rgba(0,0,0,0.06)', border: '2px solid rgba(255,255,255,0.9)' }}>
              <div className="flex-1 min-w-0">
                <div className="text-3xl leading-none mb-1">{praise.emoji}</div>
                <h1 className="text-lg font-extrabold leading-tight" style={{ color: praise.c }}>{praise.title}</h1>
                <p className="text-xs font-bold mt-0.5" style={{ color: praise.c, opacity: 0.85 }}>{praise.msg}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs font-extrabold tabular-nums rounded-lg px-2 py-1" style={{ background: 'rgba(255,255,255,0.7)', color: '#059669' }}>{correct}/{totalQ} đúng 🎯</span>
                  <span className="text-xs font-extrabold tabular-nums rounded-lg px-2 py-1" style={{ background: 'rgba(255,255,255,0.7)', color: '#2563EB' }}>{pct}% ⭐</span>
                </div>
              </div>
              <KidsScoreRing pct={pct} color={praise.c} />
            </section>

            {/* Answer review — real UI for correct answers */}
            <div className="space-y-3">
              {rawItems.map((item: any, idx: number) => {
                const q = item.question;
                const cfg = q?.kids_task_config;
                const studentAns = item.student_answer;
                const taskType: string = cfg?.task_type ?? '';
                const taskData = cfg ? extractTaskData(q) : null;
                const answerMap = parseKidsAnswer(studentAns?.saAnswer_text);
                const rows = taskData ? buildReviewRows(taskType, taskData, answerMap) : [];
                const isManual = MANUAL_REVIEW_TYPES.has(taskType);
                const allCorrect = rows.length > 0 && rows.every((r: any) => r.isCorrect);
                const anyWrong = rows.length > 0 && rows.some((r: any) => !r.isCorrect);
                const summaryColor = anyWrong ? '#E11D48' : allCorrect ? '#059669' : '#64748B';
                const correctAnswer = taskData ? buildCorrectAnswerMap(taskType, taskData) : {};

                return (
                  <div key={q?.qId ?? idx} className="rounded-2xl bg-white overflow-hidden"
                    style={{ border: '1.5px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                    {/* Header */}
                    <div className="flex items-center gap-2 px-3 py-2"
                      style={{ background: allCorrect ? '#F0FFF4' : anyWrong ? '#FFF1F2' : '#F8FAFC' }}>
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                        style={{ background: summaryColor }}>
                        {idx + 1}
                      </span>
                      <span className="text-[11px] font-extrabold" style={{ color: summaryColor }}>
                        {allCorrect ? 'Đúng hết 🎉' : anyWrong ? 'Có câu sai' : 'Chưa chấm'}
                      </span>
                      {rows.length > 0 && (
                        <span className="ml-auto text-[10px] font-extrabold tabular-nums px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(255,255,255,0.8)', color: summaryColor }}>
                          {rows.filter((r: any) => r.isCorrect).length}/{rows.length}
                        </span>
                      )}
                    </div>

                    {/* Body: real component for correct answer, rich card for manual */}
                    <div className="px-3 pb-3 pt-1">
                      {isManual || rows.length === 0 ? (
                        <div className="space-y-2">
                          {/* Instructions */}
                          {taskData?.instructions && (
                            <p className="text-xs font-bold text-slate-500">📋 {taskData.instructions}</p>
                          )}
                          {/* Task image */}
                          {taskData?.imageUrl && (
                            <img src={getFullMediaUrl(taskData.imageUrl)} alt="" className="w-full max-h-36 object-contain rounded-xl bg-slate-50" />
                          )}
                          {/* Audio */}
                          {taskData?.audioUrl && (
                            <audio controls className="w-full h-8" src={getFullMediaUrl(taskData.audioUrl)} />
                          )}
                          {/* Student answer card */}
                          <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 mb-1.5">📝 Bài làm của em</p>
                            {(() => {
                              const ans = studentAns?.saAnswer_text;
                              if (!ans) return <p className="text-xs text-slate-400 italic">Em chưa trả lời câu này.</p>;
                              if (ans.trim().startsWith('{')) {
                                try {
                                  const obj = JSON.parse(ans);
                                  return (
                                    <div className="space-y-1">
                                      {Object.entries(obj).map(([k, v]) => (
                                        <div key={k} className="flex gap-2 text-xs">
                                          <span className="font-bold text-slate-500 flex-shrink-0">{k}:</span>
                                          <span className="text-slate-700">{String(v)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                } catch {
                                  /* fallthrough */
                                }
                              }
                              return <p className="text-xs text-slate-700 whitespace-pre-wrap">{ans}</p>;
                            })()}
                          </div>
                          {/* Pending badge */}
                          <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200">
                            <Clock className="w-3 h-3" /> Thầy/Cô đang chấm phần này
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-[10px] font-bold text-emerald-600 mb-1.5">✓ Đáp án đúng</p>
                          <div className="max-w-lg mx-auto">
                            <QuestionRenderer
                              question={q}
                              mode="preview"
                              answer={correctAnswer}
                              onAnswer={() => {}}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

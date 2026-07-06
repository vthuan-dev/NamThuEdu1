/**
 * KidsResult — Trang xem điểm vui vẻ cho trẻ 6-12 (Cambridge YL)
 *
 * Khác bản người lớn (ResultDetail): claymorphism, lời khen ngợi theo điểm,
 * vòng tròn điểm to, sao thưởng, và trạng thái "Chờ thầy/cô chấm" thân thiện.
 * Dùng chung studentApi.getSubmissionDetail để lấy dữ liệu.
 */
import { useState, useEffect } from 'react';
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
  usePageTitle('Kết quả của bạn');

  const { data, isLoading } = useQuery({
    queryKey: ['kids-submission', submissionId],
    queryFn: () => studentApi.getSubmissionDetail(submissionId),
    enabled: !!submissionId,
    refetchInterval: (query) => {
      const s: any = (query.state.data as any)?.data?.data ?? (query.state.data as any)?.data;
      const done = s?.sStatus === 'graded' || s?.sStatus === 'auto_submitted' || s?.sStatus === 'partially_graded';
      return done ? false : 8000;
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

  // ── Pre-compute câu hỏi nav (trạng thái đúng/sai/chờ) ─────────────────
  const questionNavData = rawItems.map((item: any, idx: number) => {
    const q = item.question;
    const cfg = q?.kids_task_config;
    const taskType: string = cfg?.task_type ?? '';
    const taskData = cfg ? extractTaskData(q) : null;
    const answerText = item.student_answer?.saAnswer_text;
    const hasAnswer = !!(answerText && String(answerText).trim());
    const isManual = MANUAL_REVIEW_TYPES.has(taskType);
    const answerMap = parseKidsAnswer(answerText);
    const rows = taskData ? buildReviewRows(taskType, taskData, answerMap) : [];
    const allCorrect = rows.length > 0 && rows.every((r: any) => r.isCorrect);
    const anyWrong  = rows.length > 0 && rows.some((r: any) => !r.isCorrect);
    const correctCount = rows.filter((r: any) => r.isCorrect).length;
    return { qId: q?.qId ?? idx, idx, allCorrect, anyWrong, rowCount: rows.length, correctCount, hasAnswer, isManual };
  });

  // ── Scroll spy: câu nào đang trong viewport ──────────────────────────
  const [activeQIdx, setActiveQIdx] = useState(0);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    if (questionNavData.length === 0) return;
    const observers: IntersectionObserver[] = [];
    questionNavData.forEach(({ qId, idx }) => {
      const el = document.getElementById(`kq-${qId}`);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveQIdx(idx); },
        { threshold: 0.15, rootMargin: '-70px 0px -55% 0px' }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawItems.length]);

  // ── Tự động cuộn danh sách câu hỏi bên trái để giữ câu đang xem luôn hiện diện ──
  useEffect(() => {
    const activeEl = document.getElementById(`nav-item-${activeQIdx}`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeQIdx]);

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
  const isGraded = sub?.sStatus === 'graded' || sub?.sStatus === 'auto_submitted' || sub?.sStatus === 'partially_graded';
  const correct = sub?.answers?.filter((a: any) => a.saIs_correct)?.length ?? 0;
  const totalQ = sub?.exam?.questions?.length ?? sub?.answers?.length ?? 0;
  const praise = getPraise(pct);

  // Lời nhắn tổng quát của thầy/cô (sTeacher_feedback). Guard JSON + lọc message tự động nộp.
  const rawTeacherFeedback = sub?.sTeacher_feedback;
  const isAutoSubmitMsg = typeof rawTeacherFeedback === 'string' &&
    (rawTeacherFeedback.includes('tự động nộp') || rawTeacherFeedback.includes('auto_submitted'));
  const overallFeedback =
    typeof rawTeacherFeedback === 'string' && rawTeacherFeedback.trim() &&
    !rawTeacherFeedback.trim().startsWith('{') && !isAutoSubmitMsg
      ? rawTeacherFeedback.trim()
      : '';
  const isAutoSubmitted = sub?.sStatus === 'auto_submitted' || sub?.auto_submit_reason;


  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #FFF1F2 0%, #FFF7ED 50%, #F0FDF4 100%)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-5 pb-4 space-y-3">

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
            <h1 className="text-2xl font-extrabold" style={{ color: '#9F1239' }}>Bạn đã nộp bài rồi!</h1>
            <p className="mt-2 text-sm font-medium text-slate-500 max-w-sm mx-auto">
              Thầy/cô đang chấm bài của bạn. Khi chấm xong, bạn sẽ nhận được thông báo
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
            {/* ─── Bố cục 2 cột: trái = khen + nhắn, phải = kết quả ─── */}
            <div className="grid gap-4 sm:grid-cols-[280px_1fr] sm:items-start">

            {/* ─── Cột trái: lời khen + lời nhắn ──────────────────── */}
            <div className="space-y-3 sm:sticky sm:top-16">
            {/* Compact score header */}
            <section className="flex items-center gap-4 rounded-2xl p-4"
              style={{ background: praise.bg, boxShadow: '0 8px 24px rgba(0,0,0,0.06)', border: '2px solid rgba(255,255,255,0.9)' }}>
              <div className="flex-1 min-w-0">
                <div className="text-3xl leading-none mb-1">{praise.emoji}</div>
                <h1 className="text-lg font-extrabold leading-tight" style={{ color: praise.c }}>{praise.title}</h1>
                <p className="text-xs font-bold mt-0.5" style={{ color: praise.c, opacity: 0.85 }}>{praise.msg}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-xs font-extrabold tabular-nums rounded-lg px-2 py-1" style={{ background: 'rgba(255,255,255,0.7)', color: '#059669' }}>{correct}/{totalQ} đúng 🎯</span>
                  <span className="text-xs font-extrabold tabular-nums rounded-lg px-2 py-1" style={{ background: 'rgba(255,255,255,0.7)', color: '#2563EB' }}>{pct}% ⭐</span>
                  {isAutoSubmitted && (
                    <span className="text-xs font-extrabold rounded-lg px-2 py-1" style={{ background: 'rgba(255,255,255,0.7)', color: '#B45309' }}>⏰ Hết giờ tự nộp</span>
                  )}
                </div>
              </div>
              <KidsScoreRing pct={pct} color={praise.c} />
            </section>

            {/* ─── Lời nhắn của thầy/cô ─────────────────────────────── */}
            {overallFeedback && (
              <section className="rounded-2xl p-4"
                style={{ background: 'linear-gradient(135deg,#EEF2FF,#F5F3FF)', border: '2px solid #E0E7FF', boxShadow: '0 6px 18px rgba(99,102,241,0.12)' }}>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xl"
                    style={{ background: 'rgba(255,255,255,0.85)', boxShadow: '0 2px 8px rgba(99,102,241,0.18)' }}>
                    💌
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold" style={{ color: '#4338CA' }}>Lời nhắn của thầy/cô</p>
                    <p className="mt-1 text-sm font-medium leading-relaxed text-slate-700 whitespace-pre-wrap">{overallFeedback}</p>
                  </div>
                </div>
              </section>
            )}

            {/* ─── Danh sách câu hỏi di động (ngang) ──────────────── */}
            {questionNavData.length > 0 && (
              <div className="sm:hidden flex overflow-x-auto gap-2 py-2.5 px-3 sticky top-14 bg-white/95 backdrop-blur-md z-20 rounded-2xl border border-rose-100/60 shadow-md scrollbar-none">
                {questionNavData.map(({ qId, idx, allCorrect, anyWrong, rowCount, correctCount, hasAnswer, isManual }) => {
                  const isActive = activeQIdx === idx;
                  const isSkipped = !hasAnswer;
                  const isCorrectAll = allCorrect;
                  const isPartial = rowCount > 0 && correctCount > 0 && correctCount < rowCount;
                  const isWrongAll = rowCount > 0 && correctCount === 0 && hasAnswer;
                  const isPending = isManual && hasAnswer;

                  let themeColor = '#94A3B8';
                  let themeBg = '#F8FAFC';
                  let badgeBorder = '1.5px solid #CBD5E1';

                  if (isCorrectAll) {
                    themeColor = '#059669';
                    themeBg = '#F0FDF4';
                    badgeBorder = 'none';
                  } else if (isPartial || isPending) {
                    themeColor = '#D97706';
                    themeBg = '#FFFBEB';
                    badgeBorder = 'none';
                  } else if (isWrongAll) {
                    themeColor = '#E11D48';
                    themeBg = '#FFF1F2';
                    badgeBorder = 'none';
                  } else {
                    themeColor = '#94A3B8';
                    themeBg = '#FFFFFF';
                    badgeBorder = '1.5px solid #E2E8F0';
                  }

                  return (
                    <button
                      key={qId}
                      onClick={() => {
                        document.getElementById(`kq-${qId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        setActiveQIdx(idx);
                      }}
                      className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-[13px] transition-all"
                      style={{
                        background: isActive ? themeColor : (isSkipped ? '#F1F5F9' : themeBg),
                        color: isActive ? '#FFFFFF' : (isSkipped ? '#64748B' : themeColor),
                        border: isActive ? `2px solid ${themeColor}` : badgeBorder,
                        boxShadow: isActive ? `0 4px 10px ${themeColor}40` : 'none',
                      }}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ─── Danh sách câu hỏi (scroll spy nav) ──────────────── */}
            {questionNavData.length > 0 && (
              <section className="hidden sm:block rounded-2xl overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.92)', border: '1.5px solid #F1F5F9', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
                {/* Header */}
                <div className="flex items-center gap-2 px-3 py-2.5"
                  style={{ background: 'linear-gradient(90deg,#FFF1F2,#FFF7ED)', borderBottom: '1px solid #FFE4E6' }}>
                  <span className="text-base">📋</span>
                  <p className="text-[11px] font-extrabold" style={{ color: '#9F1239' }}>Danh sách câu hỏi</p>
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                    style={{ background: '#FFF1F2', color: '#E11D48' }}>
                    {questionNavData.length} câu
                  </span>
                </div>
                {/* List */}
                <div className="flex flex-col gap-0.5 p-1.5 max-h-[42vh] overflow-y-auto">
                  {questionNavData.map(({ qId, idx, allCorrect, anyWrong, rowCount, correctCount, hasAnswer, isManual }) => {
                    const isActive = activeQIdx === idx;
                    
                    const isSkipped = !hasAnswer;
                    const isCorrectAll = allCorrect;
                    const isPartial = rowCount > 0 && correctCount > 0 && correctCount < rowCount;
                    const isWrongAll = rowCount > 0 && correctCount === 0 && hasAnswer;
                    const isPending = isManual && hasAnswer;

                    let themeColor = '#94A3B8';
                    let themeBg = '#F8FAFC';
                    let labelText = '';
                    let badgeBg = '#FFFFFF';
                    let badgeTextColor = '#64748B';
                    let badgeBorder = '1.5px solid #CBD5E1';

                    if (isCorrectAll) {
                      themeColor = '#059669';
                      themeBg = '#F0FDF4';
                      badgeBg = '#059669';
                      badgeTextColor = '#FFFFFF';
                      badgeBorder = 'none';
                      labelText = 'Đúng hết 🎉';
                    } else if (isPartial || isPending) {
                      themeColor = '#D97706';
                      themeBg = '#FFFBEB';
                      badgeBg = '#D97706';
                      badgeTextColor = '#FFFFFF';
                      badgeBorder = 'none';
                      labelText = isPending ? 'Chờ chấm ⏳' : `${correctCount}/${rowCount} đúng`;
                    } else if (isWrongAll) {
                      themeColor = '#E11D48';
                      themeBg = '#FFF1F2';
                      badgeBg = '#E11D48';
                      badgeTextColor = '#FFFFFF';
                      badgeBorder = 'none';
                      labelText = `0/${rowCount} đúng ✗`;
                    } else {
                      themeColor = '#94A3B8';
                      themeBg = '#FFFFFF';
                      badgeBg = '#FFFFFF';
                      badgeTextColor = '#64748B';
                      badgeBorder = '1.5px solid #E2E8F0';
                      labelText = 'Không trả lời ✗';
                    }

                    return (
                      <button
                        key={qId}
                        id={`nav-item-${idx}`}
                        onClick={() => {
                          document.getElementById(`kq-${qId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          setActiveQIdx(idx);
                        }}
                        onMouseEnter={() => setHoverIdx(idx)}
                        onMouseLeave={() => setHoverIdx(null)}
                        className="flex items-center gap-2 w-full text-left rounded-xl px-2.5 py-2 transition-all duration-150"
                        style={{
                          background: isActive
                            ? (isSkipped ? '#F1F5F9' : themeBg)
                            : hoverIdx === idx
                              ? (isSkipped ? '#F8FAFC' : themeBg)
                              : 'transparent',
                          border: isActive
                            ? `1.5px solid ${themeColor}`
                            : hoverIdx === idx
                              ? `1.5px solid ${themeColor}40`
                              : '1.5px solid transparent',
                          transform: hoverIdx === idx && !isActive ? 'translateX(2px)' : 'none',
                        }}
                      >
                        {/* Số thứ tự */}
                        <span className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-extrabold"
                          style={{
                            background: badgeBg,
                            color: badgeTextColor,
                            border: badgeBorder,
                            boxShadow: isSkipped ? 'none' : '0 2px 4px rgba(0,0,0,0.05)'
                          }}>
                          {idx + 1}
                        </span>
                        {/* Label trạng thái */}
                        <span className="text-[11px] font-bold truncate flex-1"
                          style={{ color: isActive ? themeColor : '#64748B' }}>
                          Câu {idx + 1} — {labelText}
                        </span>
                        {/* Active indicator */}
                        {isActive && (
                          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
                            style={{ background: themeColor }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Nút Chấp nhận */}
            <button
              onClick={() => navigate(`${BASE}/bai-tap`)}
              className="w-full py-3 px-6 rounded-2xl text-sm font-black text-white transition-all duration-150 active:scale-95 flex items-center justify-center gap-2 hover:brightness-105"
              style={{
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                boxShadow: '0 6px 20px rgba(16,185,129,0.3)',
                border: '2px solid rgba(255,255,255,0.2)'
              }}
            >
              Chấp nhận
            </button>
            </div>
            {/* ─── Hết cột trái ──────────────────────────────────── */}

            {/* ─── Cột phải: kết quả từng câu ────────────────────── */}
            <div className="space-y-3">
              {rawItems.map((item: any, idx: number) => {
                const q = item.question;
                const cfg = q?.kids_task_config;
                const studentAns = item.student_answer;
                const taskType: string = cfg?.task_type ?? '';
                const taskData = cfg ? extractTaskData(q) : null;
                const answerMap = parseKidsAnswer(studentAns?.saAnswer_text);
                let rows = taskData ? buildReviewRows(taskType, taskData, answerMap) : [];
                if (studentAns?.saIs_correct === true || studentAns?.saIs_correct === 1) {
                  rows = rows.map((r: any) => ({ ...r, isCorrect: true }));
                }
                const isManual = MANUAL_REVIEW_TYPES.has(taskType);
                const allCorrect = rows.length > 0 && rows.every((r: any) => r.isCorrect);
                const anyWrong = rows.length > 0 && rows.some((r: any) => !r.isCorrect);
                const hasAnswer = !!(studentAns?.saAnswer_text && String(studentAns.saAnswer_text).trim());
                const summaryColor = anyWrong ? '#F43F5E' : allCorrect ? '#10B981'
                  : !hasAnswer ? '#94A3B8' : '#F59E0B';
                const correctAnswer = taskData ? buildCorrectAnswerMap(taskType, taskData) : {};

                return (
                  <div key={q?.qId ?? idx} id={`kq-${q?.qId ?? idx}`} className="rounded-2xl bg-white overflow-hidden"
                    style={{ border: '1.5px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                    {/* Header */}
                    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100"
                      style={{
                        background: allCorrect
                          ? 'linear-gradient(90deg, #F0FDF4 0%, #FFFFFF 100%)'
                          : anyWrong
                            ? 'linear-gradient(90deg, #FFF1F2 0%, #FFFFFF 100%)'
                            : !hasAnswer
                              ? 'linear-gradient(90deg, #F8FAFC 0%, #FFFFFF 100%)'
                              : 'linear-gradient(90deg, #FFFBEB 0%, #FFFFFF 100%)'
                      }}>
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-xs font-black text-white shadow-sm"
                        style={{ background: summaryColor }}>
                        {idx + 1}
                      </span>
                      <span className="text-[12px] font-black uppercase tracking-wider" style={{ color: summaryColor }}>
                        Câu {idx + 1} — {allCorrect ? 'Đúng hết 🎉'
                          : anyWrong ? 'Có câu sai'
                          : !hasAnswer ? 'Không trả lời ✗'
                          : 'Chờ thầy/cô chấm ⏳'}
                      </span>
                      {rows.length > 0 && (
                        <span className="ml-auto text-[11px] font-extrabold tabular-nums px-2 py-0.5 rounded-lg border"
                          style={{
                            background: 'rgba(255,255,255,0.9)',
                            borderColor: `${summaryColor}30`,
                            color: summaryColor,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                          }}>
                          {rows.filter((r: any) => r.isCorrect).length}/{rows.length} đúng
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
                            <img src={getFullMediaUrl(taskData.imageUrl)} alt="" className="w-full max-h-[60vh] object-contain rounded-xl bg-slate-50" />
                          )}
                          {/* Audio */}
                          {taskData?.audioUrl && (
                            <audio controls className="w-full h-8" src={getFullMediaUrl(taskData.audioUrl)} />
                          )}
                          {/* Student answer card */}
                          <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 mb-1.5">📝 Bài làm của bạn</p>
                            {(() => {
                              const ans = studentAns?.saAnswer_text;
                              if (!ans) return <p className="text-xs text-slate-400 italic">Bạn chưa trả lời câu này.</p>;
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
                          {/* Pending / Not-answered badge */}
                          {!hasAnswer ? (
                            <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200">
                              ✗ Bạn chưa trả lời câu này — 0 điểm
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200">
                              <Clock className="w-3 h-3" /> Thầy/Cô đang chấm phần này
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          {/* ── So sánh bài làm vs đáp án ────────────────── */}
                          {rows.length > 0 && (
                            <div className="mb-2 rounded-xl overflow-hidden border border-slate-100">
                              {/* Header */}
                              <div className="grid grid-cols-2 text-[9px] font-extrabold uppercase tracking-wide"
                                style={{ background: '#F8FAFC' }}>
                                <div className="px-2.5 py-1.5 border-r border-slate-100 text-slate-400">📝 Bài làm của bạn</div>
                                <div className="px-2.5 py-1.5 text-emerald-600">✓ Đáp án đúng</div>
                              </div>
                              {/* Rows */}
                              {rows.map((row: any, ri: number) => (
                                <div key={ri}
                                  className="grid grid-cols-2 border-t border-slate-100 text-xs"
                                  style={{ background: row.isCorrect ? '#F0FFF4' : ri % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                                  {/* Student answer */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-2 border-r border-slate-100 min-w-0">
                                    <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white"
                                      style={{ background: row.isCorrect ? '#059669' : '#E11D48' }}>
                                      {row.isCorrect ? '✓' : '✗'}
                                    </span>
                                    <span className="font-semibold truncate"
                                      style={{ color: row.isCorrect ? '#059669' : '#E11D48' }}>
                                      {!row.student || row.student === '—' ? (
                                        <em className="text-slate-400 font-normal">Bỏ trống</em>
                                      ) : (
                                        row.student
                                      )}
                                    </span>
                                  </div>
                                  {/* Correct answer */}
                                  <div className="flex items-center px-2.5 py-2 min-w-0">
                                    {row.isCorrect ? (
                                      <span className="text-emerald-600 font-semibold truncate">{row.correct}</span>
                                    ) : (
                                      <span className="font-extrabold truncate" style={{ color: '#059669' }}>
                                        {row.correct}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* ── Full question preview — bài làm của em ─── */}
                          <p className="text-[10px] font-bold text-slate-500 mb-1.5">📝 Bài làm của bạn trong bài</p>
                          {/* Override layout của các question component (thiết kế cho trang thi full):
                              - Xoá max-height + overflow-y-auto → không cuộn nội tại
                              - Chuyển grid 2 cột → 1 cột
                              - Bỏ sticky để không bị kẹt */}
                          <style>{`
                            .qr-review [class*="max-h-["] { max-height: none !important; }
                            .qr-review .overflow-y-auto { overflow: visible !important; }
                            .qr-review .sticky { position: relative !important; top: auto !important; }
                            .qr-review [class*="grid-cols-[4"] { grid-template-columns: 1fr !important; }
                            /* Ảnh trong đề vốn thu nhỏ cho trang thi — khi XEM LẠI cho hiển thị to
                               hơn để học viên/phụ huynh nhìn rõ. Bỏ chiều cao cố định, đặt trần theo
                               viewport. Không đụng ảnh dạng lưới vuông (aspect-square giữ tỉ lệ). */
                            .qr-review img:not([class*="aspect-square"]) {
                              height: auto !important;
                              max-height: 60vh !important;
                            }
                          `}</style>
                          {(() => {
                            // studentDisplayMap: bài học sinh, ô trống → hiện placeholder + đáp án đúng
                            const studentDisplayMap: Record<string, string> = { ...answerMap };
                            Object.keys(correctAnswer).forEach(key => {
                              const v = studentDisplayMap[key];
                              if (!v || !String(v).trim()) {
                                const ans = correctAnswer[key] ? ` → ✅ ${correctAnswer[key]}` : '';
                                studentDisplayMap[key] = `✗ Bỏ trống${ans}`;
                              }
                            });
                            return (
                              <div className="qr-review w-full">
                                <QuestionRenderer
                                  question={q}
                                  mode="preview"
                                  answer={studentDisplayMap}
                                  onAnswer={() => {}}
                                />
                              </div>
                            );
                          })()}
                        </>
                      )}

                      {/* Nhận xét riêng của thầy/cô cho câu này */}
                      {studentAns?.saTeacher_feedback &&
                        typeof studentAns.saTeacher_feedback === 'string' &&
                        studentAns.saTeacher_feedback.trim() &&
                        !studentAns.saTeacher_feedback.trim().startsWith('{') && (
                          <div className="mt-2 flex items-start gap-2 rounded-xl px-3 py-2"
                            style={{ background: '#EEF2FF', border: '1px solid #E0E7FF' }}>
                            <span className="text-base leading-none mt-0.5">🗣️</span>
                            <div className="min-w-0">
                              <p className="text-[10px] font-extrabold" style={{ color: '#4338CA' }}>Thầy/cô nhận xét</p>
                              <p className="text-xs font-medium leading-relaxed text-slate-700 whitespace-pre-wrap">{studentAns.saTeacher_feedback.trim()}</p>
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* ─── Hết cột phải ──────────────────────────────────── */}

            </div>
            {/* ─── Hết bố cục 2 cột ──────────────────────────────── */}
          </>
        )}
      </div>
    </div>
  );
}

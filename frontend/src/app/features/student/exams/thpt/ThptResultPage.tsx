import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Loader2, AlertCircle, AlertTriangle, ArrowLeft, Trophy, Clock, Target, Sparkles,
  BookOpen, Headphones, PenLine, Mic, FileText, CheckCircle, XCircle,
} from 'lucide-react';
import { api } from '../../../../../services/api';
import type { ThptAnswers, ThptConfig } from './types';
import { SectionView } from './views/SectionView';

interface SectionStat {
  section_id: string;
  type: string;
  title: string;
  correct_count: number;
  total_count: number;
  raw_score: number;
  raw_max: number;
}

interface ResultData {
  raw_score: number;
  raw_score_max: number;
  scaled_score: number;
  scale_max: number;
  sections: SectionStat[];
  correct_answers: ThptAnswers;
  speaking?: { score: number; scale_max: number; parts: Record<string, any> };
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TEAL = '#0D9488';

// ── Section type meta ─────────────────────────────────────────────────────────
const SECTION_META: Record<string, { label: string; color: string; bg: string; Icon: typeof FileText }> = {
  reading:   { label: 'Đọc hiểu',  color: '#0284C7', bg: '#E0F2FE', Icon: BookOpen   },
  listening: { label: 'Nghe hiểu', color: '#D97706', bg: '#FEF3C7', Icon: Headphones },
  writing:   { label: 'Viết',      color: '#059669', bg: '#D1FAE5', Icon: PenLine    },
  speaking:  { label: 'Nói',       color: '#7C3AED', bg: '#EDE9FE', Icon: Mic        },
  grammar:   { label: 'Ngữ pháp',  color: '#2563EB', bg: '#DBEAFE', Icon: BookOpen   },
  default:   { label: 'Phần thi',  color: '#0D9488', bg: '#CCFBF1', Icon: FileText   },
};
function getSectionMeta(type: string) {
  return SECTION_META[type?.toLowerCase()] ?? SECTION_META.default;
}

// ── Intro loading overlay ─────────────────────────────────────────────────────
function ResultIntroScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(14px)' }}>
      <div className="relative w-14 h-14 mb-4">
        <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
          style={{ borderTopColor: TEAL }} />
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Đang tải kết quả...</p>
      <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Tiếng Anh</p>
    </div>
  );
}

export function ThptResultPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();

  const [showIntro, setShowIntro] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowIntro(false), 3000);
    return () => clearTimeout(t);
  }, []);

  const [examTitle, setExamTitle] = useState('Kết quả');
  const [config, setConfig] = useState<ThptConfig | null>(null);
  const [answers, setAnswers] = useState<ThptAnswers>({});
  const [result, setResult] = useState<ResultData | null>(null);
  const [speakingAudio, setSpeakingAudio] = useState<Record<string, string>>({});
  const [durationSec, setDurationSec] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gradingPending, setGradingPending] = useState(false);
  const [gradingStuck, setGradingStuck] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const pollCountRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    let pollTimer: number | null = null;

    const fetchResult = async () => {
      if (!submissionId) return;
      try {
        const res = await api.get(`/student/thpt-submissions/${submissionId}/result`);
        const data = res.data?.data;
        if (!mounted || !data) {
          setError('Không tải được kết quả.');
          return;
        }
        pollCountRef.current = 0;
        setExamTitle(data.exam_title || 'Đề thi');
        setAnswers(data.answers || {});
        setResult(data.result || null);
        setSpeakingAudio(data.speaking_audio || {});
        setConfig(data.thpt_config || null);
        setDurationSec(data.duration_seconds || 0);
        setGradingPending(false);
        setGradingStuck(false);
        setLoading(false);

        // Nếu đề có Speaking và AI chưa chấm → poll mỗi 8s đến khi xong
        const sections = data?.result?.sections ?? [];
        const hasSpeakingSection = sections.some((s: any) => s.type === 'speaking');
        const speakingScored = !!data?.result?.speaking
          && typeof data.result.speaking.score === 'number';
        if (hasSpeakingSection && !speakingScored) {
          pollTimer = window.setTimeout(fetchResult, 8000);
        }
      } catch (err: any) {
        const status: number | undefined = err?.response?.status;
        const msg: string = err?.response?.data?.message || '';

        // Lỗi terminal (422/403/404...) → KHÔNG poll lại, hiển thị lỗi ngay.
        // Backend tự chấm lại khi đọc kết quả nên 400 "chưa được chấm" gần như
        // không còn xảy ra; chỉ giữ nhánh poll cho tương thích ngược.
        const isStillGrading = status === 400
          && (msg.includes('chưa được chấm') || msg.includes('chưa chấm'));

        if (isStillGrading) {
          pollCountRef.current += 1;
          if (pollCountRef.current > 20) {
            setGradingStuck(true);
            setGradingPending(false);
            setLoading(false);
            return;
          }
          setGradingPending(true);
          setLoading(false);
          pollTimer = window.setTimeout(fetchResult, 6000);
        } else {
          setError(msg || 'Không tải được kết quả.');
          setGradingPending(false);
          setLoading(false);
        }
      }
    };

    void fetchResult();
    return () => {
      mounted = false;
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [submissionId]);

  if (showIntro) return <ResultIntroScreen />;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F0FDFA' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: TEAL }} />
      </div>
    );
  }

  if (gradingPending) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#F0FDFA' }}>
        <div className="max-w-sm w-full rounded-2xl bg-white border border-teal-100 p-8 text-center shadow-sm">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: TEAL }} />
          <p className="text-base font-bold text-slate-800 mb-1">Đang chấm điểm...</p>
          <p className="text-sm text-slate-500">Bài thi của bạn đang được chấm tự động. Vui lòng đợi một chút.</p>
        </div>
      </div>
    );
  }

  if (gradingStuck) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#F0FDFA' }}>
        <div className="max-w-sm w-full rounded-2xl bg-white border border-amber-100 p-8 text-center shadow-sm">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-4" />
          <p className="text-base font-bold text-slate-800 mb-1">Chấm điểm đang bị chậm</p>
          <p className="text-sm text-slate-500 mb-5">Hệ thống chưa thể chấm xong bài thi này. Bạn có thể thử tải lại hoặc quay lại sau.</p>
          <div className="flex items-center justify-center gap-3">
            <button type="button" onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90"
              style={{ background: TEAL }}>
              Tải lại trang
            </button>
            <button type="button" onClick={() => navigate('/hoc-vien')}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors hover:bg-slate-100"
              style={{ border: '1px solid #E2E8F0', color: '#475569' }}>
              Về trang chủ
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error || !result || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#F0FDFA' }}>
        <div className="max-w-sm w-full rounded-2xl bg-white border border-red-100 p-6 text-center shadow-sm">
          <AlertCircle className="w-9 h-9 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-slate-600 mb-4">{error ?? 'Chưa có kết quả.'}</p>
          <button type="button" onClick={() => navigate('/hoc-vien')}
            className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90"
            style={{ background: TEAL }}>
            Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  const totalCorrect   = result.sections.reduce((s, p) => s + p.correct_count, 0);
  const totalQuestions = result.sections.reduce((s, p) => s + p.total_count, 0);
  const accuracy       = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  const activeSection  = config.sections[activeIdx];
  const hasSpeakingSection = result.sections.some((s) => s.type === 'speaking');
  const speakingScored     = !!result.speaking && typeof result.speaking.score === 'number';
  const overallPending     = hasSpeakingSection && !speakingScored;

  const scaledPct = result.scale_max > 0 ? (result.scaled_score / result.scale_max) * 100 : 0;
  const scoreTone = scaledPct >= 70 ? { text: '#059669', label: 'Tốt lắm!' }
    : scaledPct >= 50 ? { text: TEAL,    label: 'Khá tốt' }
    : scaledPct >= 30 ? { text: '#D97706', label: 'Cần cố gắng' }
    :                   { text: '#EF4444', label: 'Tiếp tục luyện tập' };

  return (
    <div className="min-h-screen pb-12" style={{ background: '#F0FDFA' }}>

      {/* ── Top bar ── */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-3">
          <button type="button" onClick={() => navigate('/hoc-vien')}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600 leading-none">Kết quả bài thi</p>
            <h1 className="text-sm font-bold text-slate-800 truncate mt-0.5">{examTitle}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Hero: score + stats ── */}
        <section className="rounded-2xl bg-white overflow-hidden" style={{ border: '1.5px solid #CCFBF1', boxShadow: '0 4px 16px rgba(13,148,136,0.08)' }}>
          {/* Teal accent line */}
          <div className="h-1" style={{ background: `linear-gradient(90deg,${TEAL},#5EEAD4)` }} />

          <div className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">

              {/* Score ring */}
              <div className="relative flex-shrink-0">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#F0FDFA" strokeWidth="8" />
                  <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                    stroke={overallPending ? '#FCD34D' : scoreTone.text}
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    strokeDashoffset={`${2 * Math.PI * 42 * (1 - (overallPending ? 0.5 : scaledPct / 100))}`}
                    style={{ transition: 'stroke-dashoffset 1s ease' }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {overallPending ? (
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#D97706' }} />
                  ) : (
                    <>
                      <span style={{ fontSize: 24, fontWeight: 900, color: scoreTone.text, lineHeight: 1 }}>{result.scaled_score}</span>
                      <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>/{result.scale_max}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Score info */}
              <div className="flex-1 text-center sm:text-left">
                {overallPending ? (
                  <>
                    <p style={{ fontSize: 18, fontWeight: 800, color: '#92400E' }}>Đang chấm phần Nói</p>
                    <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
                      Điểm thô (Trắc nghiệm): {result.raw_score}/{result.raw_score_max}
                    </p>
                    <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-bold"
                      style={{ background: '#FEF3C7', color: '#B45309' }}>
                      <Loader2 className="w-3 h-3 animate-spin" /> AI đang chấm Speaking…
                    </span>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 22, fontWeight: 900, color: '#1F2937', lineHeight: 1.2 }}>
                      {result.scaled_score}
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#9CA3AF' }}>/{result.scale_max} điểm</span>
                    </p>
                    <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: `${scoreTone.text}18`, color: scoreTone.text }}>
                      {scaledPct >= 50 ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {scoreTone.label}
                    </span>
                    <p style={{ fontSize: 11, color: '#6B7280', marginTop: 8 }}>
                      Điểm thô: {result.raw_score}/{result.raw_score_max}
                    </p>
                    {result.speaking && typeof result.speaking.score === 'number' && (
                      <p className="inline-flex items-center gap-1 mt-1" style={{ fontSize: 11, color: '#7C3AED', fontWeight: 700 }}>
                        <Sparkles className="w-3.5 h-3.5" />
                        Nói (AI): {Number(result.speaking.score).toFixed(1)}/{result.speaking.scale_max ?? 10}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Quick stats */}
              <div className="flex sm:flex-col gap-3 sm:gap-2 flex-shrink-0">
                <div className="rounded-xl p-3 text-center min-w-[72px]" style={{ background: '#F0FDFA', border: '1px solid #CCFBF1' }}>
                  <p style={{ fontSize: 18, fontWeight: 900, color: TEAL, lineHeight: 1 }}>{accuracy}%</p>
                  <p style={{ fontSize: 9.5, color: '#6B7280', marginTop: 2 }}>Chính xác</p>
                </div>
                <div className="rounded-xl p-3 text-center min-w-[72px]" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <p style={{ fontSize: 18, fontWeight: 900, color: '#334155', lineHeight: 1 }}>
                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                  </p>
                  <p style={{ fontSize: 9.5, color: '#6B7280', marginTop: 2 }}>Thời gian</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Stats divider row ── */}
          <div className="flex divide-x divide-slate-100 border-t border-slate-100">
            {[
              { label: 'Tổng câu', value: `${totalCorrect}/${totalQuestions}` },
              { label: 'Câu đúng', value: totalCorrect },
              { label: 'Câu sai', value: totalQuestions - totalCorrect },
              { label: 'Số phần', value: result.sections.length },
            ].map(st => (
              <div key={st.label} className="flex-1 py-3 text-center">
                <p style={{ fontSize: 15, fontWeight: 800, color: '#1F2937', lineHeight: 1 }}>{st.value}</p>
                <p style={{ fontSize: 9.5, color: '#9CA3AF', marginTop: 2 }}>{st.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Per-section breakdown ── */}
        <section>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>
            Chi tiết từng phần
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {result.sections.map((sec, idx) => {
              const isActive  = activeIdx === idx;
              const isSpeaking = sec.type === 'speaking';
              const spk = result.speaking;
              const pct = isSpeaking
                ? (spk ? Math.round((Number(spk.score) / (spk.scale_max ?? 10)) * 100) : 0)
                : (sec.total_count > 0 ? Math.round((sec.correct_count / sec.total_count) * 100) : 0);
              const meta = getSectionMeta(sec.type);
              const { Icon } = meta;
              return (
                <button key={sec.section_id ?? idx} type="button" onClick={() => setActiveIdx(idx)}
                  className="rounded-2xl text-left transition-all cursor-pointer overflow-hidden"
                  style={{
                    border: isActive ? `2px solid ${meta.color}` : '1.5px solid #E2E8F0',
                    background: isActive ? `${meta.color}08` : '#fff',
                    boxShadow: isActive ? `0 0 0 3px ${meta.color}20` : '0 1px 4px rgba(0,0,0,0.04)',
                  }}>
                  {/* Type accent */}
                  <div className="px-3 pt-3 pb-2 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: meta.bg }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                    </div>
                    <span className="text-[10px] font-bold truncate" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                  </div>

                  <div className="px-3 pb-3">
                    <p className="text-[11px] font-semibold text-slate-600 truncate mb-1.5">{sec.title}</p>

                    {isSpeaking ? (
                      <div className="flex items-baseline gap-0.5">
                        {spk ? (
                          <>
                            <span style={{ fontSize: 20, fontWeight: 900, color: meta.color, lineHeight: 1 }}>{Number(spk.score).toFixed(1)}</span>
                            <span style={{ fontSize: 10, color: '#9CA3AF' }}>/{spk.scale_max ?? 10}</span>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: '#D97706' }}>
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />Đang chấm
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-0.5">
                        <span style={{ fontSize: 20, fontWeight: 900, color: '#1F2937', lineHeight: 1 }}>{sec.correct_count}</span>
                        <span style={{ fontSize: 10, color: '#9CA3AF' }}>/{sec.total_count} câu</span>
                      </div>
                    )}

                    <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: pct >= 70 ? '#10B981' : pct >= 50 ? meta.color : '#F59E0B' }} />
                    </div>
                    <p style={{ fontSize: 9.5, color: '#9CA3AF', marginTop: 3 }}>
                      {isSpeaking ? (spk ? `${pct}% điểm` : 'AI đang xử lý') : `${pct}% đúng`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Review section ── */}
        {activeSection && (
          <section className="rounded-2xl bg-white overflow-hidden"
            style={{ border: '1.5px solid #E2E8F0', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
              {(() => { const m = getSectionMeta(activeSection.type ?? ''); const I = m.Icon; return (
                <><div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: m.bg }}>
                  <I className="w-3.5 h-3.5" style={{ color: m.color }} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1F2937' }}>{activeSection.title ?? 'Xem lại'}</p></>
              ); })()}
            </div>
            <div className="p-4">
              <SectionView
                key={activeSection.id}
                section={activeSection}
                answers={answers}
                correctAnswers={result.correct_answers}
                correctQuestions={result.correct_questions}
                onAnswerChange={() => {}}
                mode="review"
                speakingParts={result.speaking?.parts}
                speakingAudio={speakingAudio}
              />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}


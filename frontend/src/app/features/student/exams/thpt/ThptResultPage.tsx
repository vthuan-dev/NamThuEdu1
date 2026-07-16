import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Loader2, AlertCircle, ArrowLeft, Sparkles,
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
  correct_questions?: Record<string, boolean>;
  speaking?: { score: number; scale_max: number; parts: Record<string, any> };
  writing?: { score: number; scale_max: number; parts: Record<string, any> };
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
          setLoading(false);
          return;
        }

        // Luôn hiện kết quả khách quan ngay — KHÔNG chặn cả trang vì AI đang chấm.
        setExamTitle(data.exam_title || 'Đề thi');
        setAnswers(data.answers || {});
        setResult(data.result || null);
        setSpeakingAudio(data.speaking_audio || {});
        setConfig(data.thpt_config || null);
        setDurationSec(data.duration_seconds || 0);
        setLoading(false);
        setError(null);

        // Kiểm tra AI chủ quan (Nói/Viết) còn pending không.
        // Dùng config.sections (đầy đủ) thay vì result.sections (có thể thiếu writing/speaking stats).
        const cfgSections = data?.thpt_config?.sections ?? data?.result?.sections ?? [];
        const hasSpeakingSection = cfgSections.some((s: any) => s.type === 'speaking');
        const speakingScored = !!data?.result?.speaking
          && typeof data.result.speaking.score === 'number';
        const hasWritingSection = cfgSections.some((s: any) => s.type === 'writing');
        const writingScored = !!data?.result?.writing
          && typeof data.result.writing.score === 'number';

        const isStillGrading = (hasSpeakingSection && !speakingScored) || (hasWritingSection && !writingScored);

        if (isStillGrading) {
          // KHÔNG reset pollCount khi còn pending — tránh loop vô hạn.
          pollCountRef.current += 1;
          setGradingPending(true);
          if (pollCountRef.current > 30) {
            // ~4 phút (30 * 8s) vẫn chưa xong → dừng poll, vẫn hiện kết quả khách quan.
            setGradingStuck(true);
            return;
          }
          pollTimer = window.setTimeout(fetchResult, 8000);
        } else {
          pollCountRef.current = 0;
          setGradingPending(false);
          setGradingStuck(false);
        }
      } catch (err: any) {
        if (!mounted) return;
        const status: number | undefined = err?.response?.status;
        const msg: string = err?.response?.data?.message || '';

        // 400 "chưa chấm" → poll lại, hiện màn chờ rõ ràng.
        const isStillGrading = status === 400
          && (msg.includes('chưa được chấm') || msg.includes('chưa chấm') || msg.includes('đang trong quá trình'));

        if (isStillGrading) {
          pollCountRef.current += 1;
          if (pollCountRef.current > 30) {
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

  // Chỉ chặn full-page khi CHƯA có dữ liệu kết quả (backend 400 / đang self-heal).
  // Khi đã có điểm khách quan thì luôn render trang kết quả + banner AI pending.
  if (gradingPending && !result) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#F0FDFA' }}>
        <div className="max-w-sm w-full rounded-2xl bg-white border border-teal-100 p-8 text-center shadow-sm">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: TEAL }} />
          <p className="text-base font-bold text-slate-800 mb-1">Đang chấm điểm...</p>
          <p className="text-sm text-slate-500">Hệ thống đang chấm trắc nghiệm. Vui lòng đợi vài giây.</p>
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
  // Cap thời gian hiển thị theo giới hạn của đề: sTime_taken (durationSec) tính
  // bằng now()-start nên có thể lố vài giây khi auto-submit trễ (vd 60:02). Nếu
  // làm >= giới hạn thì hiển thị đúng bằng giới hạn (max), không vượt quá.
  const limitSec = (config.total_duration_minutes ?? 0) * 60;
  const cappedDurationSec = limitSec > 0 ? Math.min(durationSec, limitSec) : durationSec;
  const minutes = Math.floor(cappedDurationSec / 60);
  const seconds = cappedDurationSec % 60;
  const activeSection  = config.sections[activeIdx];
  const cfgSections = config.sections ?? [];
  const hasSpeakingSection = cfgSections.some((s) => s.type === 'speaking')
    || result.sections.some((s) => s.type === 'speaking');
  const speakingScored     = !!result.speaking && typeof result.speaking.score === 'number';
  const hasWritingSection  = cfgSections.some((s) => s.type === 'writing')
    || result.sections.some((s) => s.type === 'writing');
  const writingScored      = !!result.writing && typeof result.writing.score === 'number';
  const speakingPending    = hasSpeakingSection && !speakingScored;
  const writingPending     = hasWritingSection && !writingScored;
  const overallPending     = speakingPending || writingPending;
  const pendingLabels: string[] = [];
  if (speakingPending) pendingLabels.push('Nói');
  if (writingPending) pendingLabels.push('Viết');

  const scaledPct = result.scale_max > 0 ? (result.scaled_score / result.scale_max) * 100 : 0;
  const scoreTone = scaledPct >= 70 ? { text: '#059669', label: 'Tốt lắm!' }
    : scaledPct >= 50 ? { text: TEAL,    label: 'Khá tốt' }
    : scaledPct >= 30 ? { text: '#D97706', label: 'Cần cố gắng' }
    :                   { text: '#EF4444', label: 'Tiếp tục luyện tập' };

  return (
    <div className="min-h-screen pb-12" style={{ background: '#F0FDFA' }}>

      {/* ── Top bar ── */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-3">
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {overallPending && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
            <Loader2 className="w-5 h-5 animate-spin flex-shrink-0 mt-0.5" style={{ color: '#D97706' }} />
            <div>
              <p className="text-sm font-bold text-amber-900">
                AI đang chấm phần {pendingLabels.join(' & ')}
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Điểm trắc nghiệm đã có ngay. Điểm {pendingLabels.join('/')} sẽ tự cập nhật trong khoảng 10–30 giây — không cần nộp lại.
              </p>
            </div>
          </div>
        )}

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
                  <span style={{ fontSize: 24, fontWeight: 900, color: overallPending ? '#D97706' : scoreTone.text, lineHeight: 1 }}>{result.scaled_score}</span>
                  <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>/{result.scale_max}</span>
                </div>
              </div>

              {/* Score info */}
              <div className="flex-1 text-center sm:text-left">
                <>
                  <p style={{ fontSize: 22, fontWeight: 900, color: '#1F2937', lineHeight: 1.2 }}>
                    {result.scaled_score}
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#9CA3AF' }}>/{result.scale_max} điểm</span>
                  </p>
                  {overallPending ? (
                    <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-bold"
                      style={{ background: '#FEF3C7', color: '#B45309' }}>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      AI đang chấm {pendingLabels.join(' & ')}… điểm sẽ cập nhật tự động
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: `${scoreTone.text}18`, color: scoreTone.text }}>
                      {scaledPct >= 50 ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {scoreTone.label}
                    </span>
                  )}
                  <p style={{ fontSize: 11, color: '#6B7280', marginTop: 8 }}>
                    Điểm thô (trắc nghiệm): {result.raw_score}/{result.raw_score_max}
                  </p>
                  {result.speaking && typeof result.speaking.score === 'number' && (
                    <p className="inline-flex items-center gap-1 mt-1" style={{ fontSize: 11, color: '#7C3AED', fontWeight: 700 }}>
                      <Sparkles className="w-3.5 h-3.5" />
                      Nói (AI): {Number(result.speaking.score).toFixed(1)}/{result.speaking.scale_max ?? 10}
                    </p>
                  )}
                  {result.writing && typeof result.writing.score === 'number' && (
                    <p className="inline-flex items-center gap-1 mt-1" style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>
                      <PenLine className="w-3.5 h-3.5" />
                      Viết (AI): {Number(result.writing.score).toFixed(1)}/{result.writing.scale_max ?? 10}
                    </p>
                  )}
                  {writingPending && (
                    <p className="inline-flex items-center gap-1 mt-1" style={{ fontSize: 11, color: '#D97706', fontWeight: 700 }}>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Viết: AI đang chấm…
                    </p>
                  )}
                  {speakingPending && (
                    <p className="inline-flex items-center gap-1 mt-1" style={{ fontSize: 11, color: '#D97706', fontWeight: 700 }}>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Nói: AI đang chấm…
                    </p>
                  )}
                  {gradingStuck && overallPending && (
                    <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
                      Chấm AI đang chậm hơn dự kiến. Điểm trắc nghiệm đã có; bạn có thể tải lại trang sau.
                    </p>
                  )}
                </>
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

          {/* ── Stats strip ── premium, color-coded tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 border-t border-slate-100 pt-4 mt-1">
            {[
              { label: 'Tổng câu', value: `${totalCorrect}/${totalQuestions}`, Icon: FileText,
                color: '#0D9488', bg: 'linear-gradient(135deg,#F0FDFA,#CCFBF1)', ring: '#99F6E4' },
              { label: 'Câu đúng', value: totalCorrect, Icon: CheckCircle,
                color: '#059669', bg: 'linear-gradient(135deg,#ECFDF5,#D1FAE5)', ring: '#A7F3D0' },
              { label: 'Câu sai', value: totalQuestions - totalCorrect, Icon: XCircle,
                color: '#E11D48', bg: 'linear-gradient(135deg,#FFF1F2,#FFE4E6)', ring: '#FECDD3' },
              { label: 'Số phần', value: result.sections.length, Icon: BookOpen,
                color: '#2563EB', bg: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)', ring: '#BFDBFE' },
            ].map(st => (
              <div
                key={st.label}
                className="group relative flex items-center gap-2.5 rounded-2xl px-3 py-2.5 overflow-hidden transition-all duration-300 ease-out hover:-translate-y-0.5"
                style={{ background: st.bg, border: `1px solid ${st.ring}` }}
              >
                {/* Sheen sweep on hover */}
                <span
                  className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"
                  style={{ background: 'linear-gradient(110deg,transparent,rgba(255,255,255,0.55),transparent)' }}
                />
                <div
                  className="relative w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                  style={{ background: `${st.color}1A`, border: `1px solid ${st.color}30` }}
                >
                  <st.Icon className="w-[18px] h-[18px]" style={{ color: st.color }} />
                </div>
                <div className="relative min-w-0 text-left">
                  <p style={{ fontSize: 19, fontWeight: 900, color: st.color, lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {st.value}
                  </p>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#64748B', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {st.label}
                  </p>
                </div>
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
              const isWriting  = sec.type === 'writing';
              const isAiSkill  = isSpeaking || isWriting;
              const spk = result.speaking;
              const wrt = result.writing;
              const aiBlock = isSpeaking ? spk : isWriting ? wrt : null;
              const pct = isAiSkill
                ? (aiBlock ? Math.round((Number(aiBlock.score) / (aiBlock.scale_max ?? 10)) * 100) : 0)
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

                    {isAiSkill ? (
                      <div className="flex items-baseline gap-0.5">
                        {aiBlock ? (
                          <>
                            <span style={{ fontSize: 20, fontWeight: 900, color: meta.color, lineHeight: 1 }}>{Number(aiBlock.score).toFixed(1)}</span>
                            <span style={{ fontSize: 10, color: '#9CA3AF' }}>/{aiBlock.scale_max ?? 10}</span>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: '#D97706' }}>
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />Đang chấm AI
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
                      {isAiSkill ? (aiBlock ? `${pct}% điểm` : 'AI đang xử lý') : `${pct}% đúng`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Review section ── */}
        {activeSection && (() => {
          const m = getSectionMeta(activeSection.type ?? '');
          const I = m.Icon;
          const isSpeaking = activeSection.type === 'speaking';
          const isWriting = activeSection.type === 'writing';
          const isAiSkill = isSpeaking || isWriting;
          const aiBlock = isSpeaking ? result.speaking : isWriting ? result.writing : null;
          const activeStat = result.sections.find((s) => s.section_id === activeSection.id)
            ?? result.sections[activeIdx];
          const objCorrect = activeStat?.correct_count ?? 0;
          const objTotal = activeStat?.total_count ?? 0;
          const aiReady = !!aiBlock && typeof aiBlock.score === 'number';
          const aiPending = isAiSkill && !aiReady;

          return (
            <section
              className="rounded-2xl overflow-hidden bg-white"
              style={{
                border: `1.5px solid ${m.color}33`,
                boxShadow: `0 8px 28px ${m.color}14, 0 1px 4px rgba(15,23,42,0.04)`,
              }}
            >
              {/* Skill color bar */}
              <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${m.color}, ${m.color}88)` }} />

              {/* Header — important context only */}
              <div
                className="px-4 sm:px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
                style={{ borderColor: `${m.color}18`, background: `linear-gradient(180deg, ${m.bg}AA 0%, #ffffff 100%)` }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
                    style={{ background: m.color, color: '#fff' }}
                  >
                    <I className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider text-white"
                        style={{ background: m.color }}
                      >
                        {m.label}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">Xem lại bài làm</span>
                    </div>
                    <h2 className="text-base sm:text-[17px] font-black text-slate-900 truncate mt-1 leading-snug">
                      {activeSection.title ?? 'Chi tiết phần thi'}
                    </h2>
                  </div>
                </div>

                {/* Right status — the important numbers */}
                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                  {isAiSkill ? (
                    aiReady ? (
                      <div
                        className="rounded-2xl px-3.5 py-2 text-white text-center min-w-[76px]"
                        style={{ background: m.color }}
                      >
                        <p className="text-lg font-black leading-none tabular-nums">
                          {Number(aiBlock!.score).toFixed(1)}
                        </p>
                        <p className="text-[10px] font-bold opacity-90 mt-0.5">
                          /{aiBlock!.scale_max ?? 10} điểm
                        </p>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span className="text-xs font-bold">AI đang chấm</span>
                      </div>
                    )
                  ) : (
                    <div className="rounded-2xl px-3.5 py-2 bg-white border border-slate-200 text-center min-w-[76px]">
                      <p className="text-lg font-black leading-none tabular-nums text-slate-900">
                        {objCorrect}<span className="text-slate-400 font-bold text-sm">/{objTotal}</span>
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">câu đúng</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tip strip — only when useful */}
              {(aiPending || (!isAiSkill && objTotal > 0)) && (
                <div
                  className="px-4 sm:px-5 py-2.5 text-xs font-medium border-b flex items-center gap-2"
                  style={{
                    background: aiPending ? '#FFFBEB' : `${m.bg}`,
                    borderColor: aiPending ? '#FDE68A' : `${m.color}22`,
                    color: aiPending ? '#92400E' : m.color,
                  }}
                >
                  {aiPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                      Điểm {m.label.toLowerCase()} sẽ hiện ngay khi AI chấm xong — không cần nộp lại.
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      Màu xanh = đúng · đỏ = sai. Kéo xuống để xem từng câu.
                    </>
                  )}
                </div>
              )}

              {/* Body content */}
              <div className="p-3 sm:p-5 bg-[#FCFDFE]">
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
                  writingParts={result.writing?.parts}
                  hideHeader
                />
              </div>
            </section>
          );
        })()}
      </main>
    </div>
  );
}


import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Loader2, AlertCircle, ArrowLeft, Trophy, Clock, Target, Sparkles } from 'lucide-react';
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

export function ThptResultPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();

  const [examTitle, setExamTitle] = useState('Kết quả');
  const [config, setConfig] = useState<ThptConfig | null>(null);
  const [answers, setAnswers] = useState<ThptAnswers>({});
  const [result, setResult] = useState<ResultData | null>(null);
  const [speakingAudio, setSpeakingAudio] = useState<Record<string, string>>({});
  const [durationSec, setDurationSec] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!submissionId) return;
      try {
        const res = await api.get(`/student/thpt-submissions/${submissionId}/result`);
        const data = res.data?.data;
        if (!mounted || !data) {
          setError('Không tải được kết quả.');
          return;
        }
        setExamTitle(data.exam_title || 'Đề thi');
        setAnswers(data.answers || {});
        setResult(data.result || null);
        setSpeakingAudio(data.speaking_audio || {});
        setConfig(data.thpt_config || null);
        setDurationSec(data.duration_seconds || 0);
        setLoading(false);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Không tải được kết quả.');
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [submissionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (error || !result || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full rounded-2xl bg-white border border-red-200 p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-sm text-slate-600 mb-4">{error ?? 'Chưa có kết quả.'}</p>
          <button
            type="button"
            onClick={() => navigate('/hoc-vien')}
            className="px-4 py-2 rounded-lg bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 transition-colors cursor-pointer"
          >
            Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  const totalCorrect = result.sections.reduce((s, p) => s + p.correct_count, 0);
  const totalQuestions = result.sections.reduce((s, p) => s + p.total_count, 0);
  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  const activeSection = config.sections[activeIdx];

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/hoc-vien')}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900 truncate">{examTitle}</h1>
            <p className="text-xs text-slate-500">Chế độ xem lại</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Score hero */}
        <section className="rounded-2xl p-6 bg-gradient-to-br from-teal-50 via-white to-teal-50 border border-teal-100">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-teal-600 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-10 h-10 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Điểm số</p>
                <p className="text-4xl font-bold text-slate-900">
                  {result.scaled_score}
                  <span className="text-lg text-slate-400">/{result.scale_max}</span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Điểm thô: {result.raw_score}/{result.raw_score_max}</p>
                {result.speaking && typeof result.speaking.score === 'number' && (
                  <p className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 mt-1">
                    <Sparkles className="w-3.5 h-3.5" /> Nói (AI): {Number(result.speaking.score).toFixed(1)}/{result.speaking.scale_max ?? 10}
                  </p>
                )}
              </div>
            </div>
            <Stat icon={<Target className="w-5 h-5 text-emerald-600" />} label="Độ chính xác" value={`${accuracy}%`} sub={`${totalCorrect}/${totalQuestions} câu đúng`} tone="emerald" />
            <Stat icon={<Clock className="w-5 h-5 text-teal-600" />} label="Thời gian" value={`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`} sub="Đã làm bài" tone="blue" />
          </div>
        </section>

        {/* Per-section breakdown */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {result.sections.map((p, idx) => {
            const isActive = activeIdx === idx;
            const isSpeaking = p.type === 'speaking';
            const spk = result.speaking;
            const pct = isSpeaking
              ? (spk ? Math.round((Number(spk.score) / (spk.scale_max ?? 10)) * 100) : 0)
              : (p.total_count > 0 ? Math.round((p.correct_count / p.total_count) * 100) : 0);
            return (
              <button
                key={p.section_id ?? idx}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className={`rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                  isActive ? 'border-teal-400 shadow-sm bg-teal-50' : 'border-slate-200 bg-white hover:border-teal-300'
                }`}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">{p.title}</p>
                {isSpeaking ? (
                  <div className="flex items-baseline gap-1 mt-1">
                    {spk ? (
                      <>
                        <span className="text-2xl font-bold text-slate-900 tabular-nums">{Number(spk.score).toFixed(1)}</span>
                        <span className="text-sm text-slate-400">/{spk.scale_max ?? 10}</span>
                      </>
                    ) : (
                      <span className="text-sm font-semibold text-amber-600">Đang chấm…</span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-bold text-slate-900">{p.correct_count}</span>
                    <span className="text-sm text-slate-400">/{p.total_count}</span>
                  </div>
                )}
                <div className="h-1.5 rounded-full bg-slate-100 mt-2 overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{isSpeaking ? (spk ? `${pct}% điểm` : 'AI đang chấm') : `${pct}% đúng`}</p>
              </button>
            );
          })}
        </section>

        {/* Review */}
        {activeSection && (
          <SectionView
            key={activeSection.id}
            section={activeSection}
            answers={answers}
            correctAnswers={result.correct_answers}
            onAnswerChange={() => {}}
            mode="review"
            speakingParts={result.speaking?.parts}
            speakingAudio={speakingAudio}
          />
        )}
      </main>
    </div>
  );
}

function Stat({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub: string; tone: 'emerald' | 'blue' }) {
  const bg = tone === 'emerald' ? 'bg-emerald-50' : 'bg-teal-50';
  return (
    <div className="rounded-2xl p-4 bg-white border border-slate-200">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>{icon}</div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}

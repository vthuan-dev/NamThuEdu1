/**
 * KidsTestTaking — Trang làm bài thân thiện cho trẻ 6-12 (Cambridge YL)
 *
 * Khác bản người lớn (TestTaking — engine VSTEP 4 kỹ năng):
 * - MỘT câu hỏi mỗi màn hình, chữ to, đáp án dạng thẻ bấm to.
 * - Thanh tiến trình vui, lời động viên, không có tab Listening/Reading/Writing/Speaking.
 * - Vẫn dùng chung API start/save/submit để đồng bộ backend.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Volume2, AlertTriangle, PartyPopper } from 'lucide-react';
import { studentApi } from '../../../../services/studentApi';
import { QuestionRenderer } from '../../../../components/exam/QuestionRenderer';
import { useExamSession } from '../../../../hooks/exam/useExamSession';
import {
  SaveStatusIndicator,
  OfflineBanner,
  MultiTabWarning,
  ResumeExamModal,
  TimeWarningBanner,
} from '../../../../components/exam';
import { examDraftStorage } from '../../../../lib/exam/examDraftStorage';
import { useToast } from '../../../../hooks/useToast';

const BASE = '/hoc-vien';

// Đáp án kids task được lưu dạng chuỗi JSON (saAnswer_text). Parse về object cho QuestionRenderer.
function parseAnswerObject(raw: string | undefined | null): any {
  if (!raw) return {};
  const t = String(raw).trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    try { return JSON.parse(t); } catch { /* ignore */ }
  }
  return {};
}

// ─── Helpers (đồng bộ cách đọc dữ liệu với TestTaking) ────────────────────────
function getQuestionId(q: any): string {
  return String(q?.qId ?? q?.id ?? '');
}

function getOptions(q: any) {
  if (Array.isArray(q?.options)) {
    return q.options.map((opt: any, idx: number) => ({
      id: String(opt?.id ?? idx + 1),
      label: String(opt?.label ?? String.fromCharCode(65 + idx)),
      content: String(opt?.content ?? ''),
      value: String(opt?.id ?? idx + 1),
    }));
  }
  if (Array.isArray(q?.answers)) {
    return q.answers.map((opt: any, idx: number) => ({
      id: String(opt?.aId ?? idx + 1),
      label: String.fromCharCode(65 + idx),
      content: String(opt?.aContent ?? ''),
      value: String(opt?.aContent ?? ''),
    }));
  }
  return [];
}

function mapSavedAnswers(saved: any[] | undefined): Record<string, string> {
  if (!Array.isArray(saved)) return {};
  return saved.reduce<Record<string, string>>((acc, a) => {
    const key = String(a?.question_id ?? '');
    if (key) acc[key] = String(a?.saAnswer_text ?? a?.answer_text ?? '');
    return acc;
  }, {});
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const OPTION_TONES = [
  { bg: 'linear-gradient(135deg,#FFF1F2,#FECDD3)', c: '#E11D48' },
  { bg: 'linear-gradient(135deg,#EFF6FF,#BFDBFE)', c: '#2563EB' },
  { bg: 'linear-gradient(135deg,#F0FFF4,#BBF7D0)', c: '#059669' },
  { bg: 'linear-gradient(135deg,#FEFCE8,#FEF08A)', c: '#B45309' },
];

// ─── Submit confirm ───────────────────────────────────────────────────────────
function KidsSubmitDialog({ open, total, answered, onConfirm, onCancel, loading }:
  { open: boolean; total: number; answered: number; onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  if (!open) return null;
  const left = total - answered;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-3xl p-7 w-full max-w-sm text-center" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="text-5xl mb-3">{left > 0 ? '🤔' : '🎉'}</div>
        <h2 className="text-xl font-extrabold" style={{ color: '#9F1239' }}>
          {left > 0 ? 'Em làm xong chưa nhỉ?' : 'Tuyệt vời!'}
        </h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          {left > 0
            ? `Em còn ${left} câu chưa trả lời. Em muốn nộp bài luôn không?`
            : `Em đã trả lời hết ${total} câu rồi. Nộp bài nhé!`}
        </p>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-3 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
            Làm tiếp
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-3 rounded-2xl font-extrabold text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #FB7185 0%, #F97316 100%)' }}>
            {loading ? 'Đang nộp…' : 'Nộp bài 🚀'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function KidsTestTaking() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const assignmentId = Number(id);
  const toast = useToast();

  const autoStart = useMemo(() => new URLSearchParams(location.search).get('autostart') === '1', [location.search]);
  // direct=1 → `id` là examId, bắt đầu trực tiếp không cần assignment (đề chưa được giao)
  const isDirect = useMemo(() => new URLSearchParams(location.search).get('direct') === '1', [location.search]);
  const querySubmissionId = useMemo(() => {
    const raw = Number(new URLSearchParams(location.search).get('submissionId') ?? 0);
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }, [location.search]);

  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [exam, setExam] = useState<any>(null);
  const [current, setCurrent] = useState(0);
  const [started, setStarted] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resumeDraft, setResumeDraft] = useState<any>(null);
  const [startedAtServer, setStartedAtServer] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startAttemptedRef = useRef(false);

  const session = useExamSession({
    submissionId,
    examId: exam?.id ?? exam?.eId ?? (isDirect ? assignmentId : 0),
    durationMinutes: exam?.eDuration_minutes ?? exam?.exam_duration ?? 30,
    startedAtServer,
    examType: exam?.exam_type ?? 'KIDS',
    role: 'kids',
    // ✅ F5-resistant: KHÔNG auto-submit khi rời/đóng tab. pagehide cũng fire
    // khi F5 → nếu để true, backend nộp & chấm bài, status rời 'in_progress',
    // reload sau đó tạo submission MỚI rỗng → mất hết đáp án. Chỉ lưu nháp.
    enableAutoSubmitOnUnload: false,
    onSubmitted: (res: any) => {
      const sid = res?.data?.data?.submissionId ?? submissionId;
      navigate(`${BASE}/ket-qua/${sid}`);
    },
  });

  const questions: any[] = exam?.questions ?? [];
  const total = questions.length;
  const q = questions[current];
  const qid = q ? getQuestionId(q) : '';
  const kidsConfig = q?.kids_task_config ?? null;
  const kidsTaskData: any = kidsConfig?.task_data ?? null;
  const isKidsTask = !!kidsConfig && !!kidsTaskData;
  const options = q && !isKidsTask ? getOptions(q) : [];
  const isWriting = q && !isKidsTask && options.length === 0;

  const answeredCount = useMemo(() => {
    return Object.entries(session.answers).filter(([_, v]) => {
      if (v == null) return false;
      if (typeof v === 'string') return v.trim() !== '';
      if (typeof v === 'object') return Object.keys(v as object).length > 0;
      return true;
    }).length;
  }, [session.answers]);

  const startMutation = useMutation({
    mutationFn: async () => {
      if (querySubmissionId) {
        return studentApi.resumeTest(assignmentId);
      }
      if (isDirect) {
        return studentApi.startKidsExamDirect(assignmentId);
      }
      const startRes: any = await studentApi.startTest(assignmentId);
      const startData = startRes?.data?.data;
      if (!startData?.exam && startData?.canResume) {
        return studentApi.resumeTest(assignmentId);
      }
      return startRes;
    },
    onSuccess: (res: any) => {
      const data = res?.data?.data;
      const fetchedExam = data?.exam ?? data?.assignment?.exam;
      if (!fetchedExam || !Array.isArray(fetchedExam.questions)) {
        setLoadError('Không tải được bài thi. Em thử lại nhé!');
        return;
      }
      const sid = data?.submissionId ?? querySubmissionId ?? null;
      // ✅ FIX: Use direct timestamp from backend, NOT calculated from timeRemaining
      // Backend returns started_at (or sStart_time) as absolute timestamp
      if (data?.started_at || data?.sStart_time) {
        setStartedAtServer(data.started_at || data.sStart_time);
      } else {
        // Fallback: use current time as start (shouldn't happen in normal flow)
        setStartedAtServer(new Date().toISOString());
      }
      setSubmissionId(sid);
      setExam(fetchedExam);
      if (sid) {
        const restored = mapSavedAnswers(data?.savedAnswers);
        if (Object.keys(restored).length) {
          Object.entries(restored).forEach(([qid, val]) => session.setAnswer(qid, val));
        }
        const draft = examDraftStorage.load(sid);
        if (draft && Object.keys(draft.answers).length > 0) {
          setResumeDraft(draft);
        }
      }
      setStarted(true);
    },
    onError: (err: any) => {
      const msg: string = err?.response?.data?.message ?? '';
      if (msg.includes('hết số lần')) {
        setLoadError('Bạn đã hết số lần làm bài cho bài thi này.');
      } else {
        setLoadError('Không kết nối được. Em tải lại trang nhé!');
      }
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => session.submit(),
    onError: () => setLoadError('Chưa nộp được bài. Em thử lại nhé!'),
  });

  // ✅ FIX: Auto-submit khi hết giờ (KIDS-friendly với emoji động viên)
  useEffect(() => {
    if (session.timeRemaining <= 0 && submissionId && !submitMutation.isPending && started) {
      console.log('[Kids] ⏰ Hết giờ! Auto-submitting...');
      
      // Toast động viên kid-friendly
      toast?.success?.('Hết giờ rồi bạn! Bài thi đã được nộp tự động. Bạn làm rất tốt! 🎉', 5000);
      
      // Gọi submit
      submitMutation.mutate();
    }
  }, [session.timeRemaining, submissionId, submitMutation.isPending, started, submitMutation]);

  // Auto-start when arriving from lobby
  useEffect(() => {
    if (!autoStart || started || startMutation.isPending || startMutation.isError || !!loadError || startAttemptedRef.current) return;
    startAttemptedRef.current = true;
    startMutation.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, started, startMutation.isPending, startMutation.isError, loadError]);

  const { setAnswer } = session;

  const handleAnswer = useCallback((value: string) => {
    if (!q) return;
    setAnswer(qid, value);
  }, [q, qid, setAnswer]);

  // Kids task: QuestionRenderer trả về answer dạng object → truyền raw object cho session.
  // Hook tự JSON.stringify khi gửi lên server.
  const handleKidsAnswer = useCallback((obj: any) => {
    const hasContent = obj && typeof obj === 'object' && Object.values(obj).some((v) => {
      if (v == null) return false;
      if (typeof v === 'string') return v.trim() !== '';
      if (typeof v === 'object') return Object.keys(v as object).length > 0;
      return true;
    });
    if (!q) return;
    setAnswer(qid, hasContent ? obj : '');
  }, [q, qid, setAnswer]);

  const playAudio = () => {
    const url = q?.qMedia_url as string | undefined;
    if (!url) return;
    if (!audioRef.current || audioRef.current.src !== url) audioRef.current = new Audio(url);
    audioRef.current.play().catch(() => undefined);
  };

  // ─── Not started yet ──────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #FFF1F2 0%, #FFF7ED 50%, #F0FDF4 100%)' }}>
        <div className="text-center space-y-4 px-6">
          {loadError ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <p className="text-base font-bold text-slate-700">{loadError}</p>
              {loadError.includes('hết số lần') ? (
                <button onClick={() => navigate(-1)}
                  className="px-6 py-3 rounded-2xl font-extrabold text-white"
                  style={{ background: 'linear-gradient(135deg, #FB7185 0%, #F97316 100%)' }}>
                  Quay lại
                </button>
              ) : (
                <button onClick={() => { setLoadError(null); startMutation.mutate(); }}
                  className="px-6 py-3 rounded-2xl font-extrabold text-white"
                  style={{ background: 'linear-gradient(135deg, #FB7185 0%, #F97316 100%)' }}>
                  Thử lại
                </button>
              )}
            </>
          ) : (
            <>
              <div className="text-5xl animate-bounce">📝</div>
              <p className="text-base font-bold text-rose-500">Đang mở bài thi…</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const progress = total > 0 ? Math.round(((current + 1) / total) * 100) : 0;
  const selected = String(session.answers[qid] ?? '');
  const kidsAnswer = (session.answers[qid] as Record<string, unknown>) ?? {};
  const isLast = current >= total - 1;
  // Kids task (ảnh + cột câu hỏi) cần khung rộng hơn để không bị cắt/scroll ngang.
  const wrap = isKidsTask ? 'max-w-6xl' : 'max-w-3xl';

  return (
    <div className="min-h-screen pb-28" style={{ background: 'linear-gradient(160deg, #FFF1F2 0%, #FFF7ED 50%, #F0FDF4 100%)' }}>
      {/* Top bar */}
      <OfflineBanner online={session.online} pendingCount={session.pendingCount} variant="kids" />
      <TimeWarningBanner
        level={session.warningLevel}
        onDismiss={session.dismissWarning}
        timeRemaining={session.timeRemaining}
      />
      <header className="sticky top-0 z-30" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(14px)', borderBottom: '1.5px solid #FFE4E6' }}>
        <div className={`${wrap} mx-auto px-4 sm:px-6 h-16 flex items-center gap-3`}>
          <span className="text-sm font-extrabold flex-shrink-0" style={{ color: '#9F1239' }}>
            Câu {current + 1}/{total}
          </span>
          <div className="flex-1 h-3 rounded-full bg-rose-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #FB7185, #F97316)' }} />
          </div>
          <SaveStatusIndicator
            status={session.saveStatus}
            lastSavedAt={session.lastSavedAt}
            pendingCount={session.pendingCount}
            variant="kids"
          />
          <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-extrabold tabular-nums"
            style={{ background: session.timeRemaining <= 60 ? '#FEE2E2' : '#EFF6FF', color: session.timeRemaining <= 60 ? '#DC2626' : '#2563EB' }}>
            ⏱ {formatClock(session.timeRemaining)}
          </span>
        </div>
      </header>

      <main className={`${wrap} mx-auto px-4 sm:px-6 pt-3 pb-24`}>
        <section className="rounded-3xl p-4 sm:p-5"
          style={{ background: 'rgba(255,255,255,0.9)', boxShadow: '0 8px 32px rgba(251,113,133,0.12)', border: '2px solid rgba(255,255,255,0.9)' }}>

          {/* Audio (listening) */}
          {q?.qMedia_url && (
            <button onClick={playAudio}
              className="mb-5 inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-white font-extrabold transition-transform hover:scale-[1.02] active:scale-95"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', boxShadow: '0 8px 20px rgba(139,92,246,0.3)' }}>
              <Volume2 className="w-5 h-5" /> Nghe lại
            </button>
          )}

          {/* Optional image */}
          {q?.qImage_url && (
            <img src={q.qImage_url} alt="" className="w-full max-h-52 object-contain rounded-2xl mb-4 bg-slate-50" />
          )}

          {/* Reading passage */}
          {q?.qPassage && (
            <div className="mb-5 rounded-2xl p-4 text-[15px] leading-7 text-slate-700 bg-slate-50 border border-slate-100"
              dangerouslySetInnerHTML={{ __html: q.qPassage }} />
          )}

          {/* Question (đề thường — kids task để component tự render tiêu đề/hướng dẫn) */}
          {!isKidsTask && (
            <h1 className="text-lg sm:text-xl font-extrabold leading-snug" style={{ color: '#1A1040' }}
              dangerouslySetInnerHTML={{ __html: q?.qContent ?? `Câu ${current + 1}` }} />
          )}

          {/* Answers */}
          {isKidsTask ? (
            <div className="mt-1">
              <QuestionRenderer
                question={q}
                mode="student"
                answer={kidsAnswer}
                onAnswer={handleKidsAnswer}
              />
            </div>
          ) : isWriting ? (
            <textarea
              value={selected}
              onChange={e => handleAnswer(e.target.value)}
              placeholder="Em viết câu trả lời ở đây nhé…"
              className="mt-5 w-full min-h-[140px] rounded-2xl border-2 border-rose-100 p-4 text-[15px] outline-none focus:border-rose-300 transition-colors"
            />
          ) : (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {options.map((opt: any, i: number) => {
                const tone = OPTION_TONES[i % OPTION_TONES.length];
                const active = selected === opt.value;
                return (
                  <button key={opt.id} onClick={() => handleAnswer(opt.value)}
                    className="group flex items-center gap-3 rounded-2xl p-4 text-left transition-all duration-150 hover:-translate-y-0.5 active:scale-[0.98]"
                    style={{
                      background: active ? tone.bg : '#fff',
                      border: active ? `2.5px solid ${tone.c}` : '2px solid #F1F5F9',
                      boxShadow: active ? `0 8px 20px ${tone.c}33` : '0 2px 8px rgba(0,0,0,0.04)',
                    }}>
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold flex-shrink-0 text-white"
                      style={{ background: tone.c }}>
                      {opt.label}
                    </span>
                    <span className="flex-1 text-[15px] font-bold" style={{ color: active ? tone.c : '#334155' }}
                      dangerouslySetInnerHTML={{ __html: opt.content }} />
                    {active && <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: tone.c }} />}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 z-30" style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(14px)', borderTop: '1.5px solid #FFE4E6' }}>
        <div className={`${wrap} mx-auto px-4 sm:px-6 py-3 flex items-center gap-3`}>
          <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors disabled:opacity-40">
            <ArrowLeft className="w-4 h-4" /> Trước
          </button>
          <span className="flex-1 text-center text-xs font-bold text-slate-400">
            Đã trả lời {answeredCount}/{total}
          </span>
          {isLast ? (
            <button onClick={() => setShowSubmit(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-extrabold text-white transition-transform hover:scale-[1.02] active:scale-95"
              style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 8px 20px rgba(22,163,74,0.3)' }}>
              <PartyPopper className="w-4 h-4" /> Nộp bài
            </button>
          ) : (
            <button onClick={() => setCurrent(c => Math.min(total - 1, c + 1))}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-extrabold text-white transition-transform hover:scale-[1.02] active:scale-95"
              style={{ background: 'linear-gradient(135deg, #FB7185, #F97316)', boxShadow: '0 8px 20px rgba(251,113,133,0.3)' }}>
              Tiếp <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <KidsSubmitDialog
        open={showSubmit}
        total={total}
        answered={answeredCount}
        onCancel={() => setShowSubmit(false)}
        onConfirm={() => submitMutation.mutate()}
        loading={submitMutation.isPending}
      />
      <ResumeExamModal
        draft={resumeDraft}
        open={!!resumeDraft}
        onResume={(draft) => {
          session.resume(draft);
          setResumeDraft(null);
        }}
        onDiscard={() => {
          if (submissionId) examDraftStorage.clear(submissionId);
          setResumeDraft(null);
        }}
        variant="kids"
      />
      <MultiTabWarning hasOtherTab={session.hasOtherTab} variant="kids" position="floating" />
    </div>
  );
}

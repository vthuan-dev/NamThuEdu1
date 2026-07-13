import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Loader2, AlertCircle } from 'lucide-react';
import { api } from '../../../../../services/api';
import { useToast } from '../../../../../hooks/useToast';
import { useExamSession } from '../../../../../hooks/exam/useExamSession';
import {
  SaveStatusIndicator,
  OfflineBanner,
  MultiTabWarning,
  ResumeExamModal,
  TimeWarningBanner,
} from '../../../../../components/exam';
import { examDraftStorage } from '../../../../../lib/exam/examDraftStorage';
import type { ThptAnswers, ThptConfig } from './types';
import { ThptTopBar } from './components/ThptTopBar';
import { ThptPartNavigator } from './components/ThptPartNavigator';
import { ThptBottomNav } from './components/ThptBottomNav';
import { SectionView } from './views/SectionView';

const AUTOSAVE_INTERVAL_MS = 30_000;

function thptDeadlineKey(examId?: string, submissionId?: number | null) {
  return submissionId ? `thpt_deadline_${submissionId}` : `thpt_deadline_exam_${examId ?? 'unknown'}`;
}

function readThptDeadline(key: string): number | null {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > Date.now() ? value : null;
  } catch {
    return null;
  }
}

export function StudentThptExamPage() {
  const { examId } = useParams<{ examId: string }>();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('assignmentId');
  const navigate = useNavigate();
  const toast = useToast();

  const [examTitle, setExamTitle] = useState('Đề thi');
  const [config, setConfig] = useState<ThptConfig | null>(null);
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<any>(null);
  const [startedAtServer, setStartedAtServer] = useState('');
  const [totalDurationSec, setTotalDurationSec] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const [showActiveSessionModal, setShowActiveSessionModal] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  // useExamSession: localStorage layer (layer 2) + online/hasOtherTab UI only.
  // Server save (layer 3) uses the manual saveDraft interval below because
  // THPT answers use composite string keys incompatible with the default
  // numeric-key serializer in useExamSession.
  const session = useExamSession({
    submissionId,
    examId: examId ? parseInt(examId) : 0,
    durationMinutes: 9999,
    startedAtServer,
    examType: 'THPT',
    role: 'adults',
    enableAutoSubmitOnUnload: true,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!examId) return;
      try {
        const examRes = await api.get(`/student/thpt-exams/${examId}`);
        const examData = examRes.data?.data;
        if (!mounted || !examData) {
          setError('Không tải được đề thi.');
          return;
        }
        setExamTitle(examData.eTitle);
        setConfig(examData.thpt_config);
        const durationMin = examData.eDuration_minutes || 60;
        setTotalDurationSec(durationMin * 60);

        const startRes = await api.post(`/student/thpt-exams/${examId}/start`, {
          assignment_id: assignmentId ? parseInt(assignmentId) : undefined,
        });
        const startData = startRes.data?.data;
        if (!mounted || !startData) return;

        const sid = startData.submission_id;
        const startedAt = startData.sStart_time ? new Date(startData.sStart_time).getTime() : Date.now();
        setStartedAtServer(new Date(startedAt).toISOString());
        setSubmissionId(sid);
        const key = thptDeadlineKey(examId, sid);
        const deadline = readThptDeadline(key) ?? startedAt + durationMin * 60_000;
        localStorage.setItem(key, String(deadline));
        setRemainingSec(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
        const restored = startData.submission_payload?.answers || {};
        Object.entries(restored).forEach(([k, v]) => session.setAnswer(k, v));
        if (sid) {
          const draft = examDraftStorage.load(sid);
          if (draft && Object.keys(draft.answers).length > 0) setResumeDraft(draft);
        }
        if (startData.resumed) {
          setShowActiveSessionModal(true);
        }
        setLoading(false);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Không tải được bài thi.');
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [examId, assignmentId]);

  const handleRestart = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy phiên làm bài hiện tại và làm lại từ đầu? Tất cả câu trả lời của phiên này sẽ bị xóa.")) return;
    try {
      setLoading(true);
      await api.post(`/student/thpt-exams/${examId}/start`, { restart: true });
      if (submissionId) {
        examDraftStorage.clear(submissionId);
        localStorage.removeItem(thptDeadlineKey(examId, submissionId));
      }
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Không thể hủy và khởi động lại bài thi.");
      setLoading(false);
    }
  };

  const handleSubmit = useCallback(async (auto = false) => {
    if (!submissionId || !examId || isSubmitting) return;
    if (!auto && !window.confirm('Bạn chắc chắn muốn nộp bài? Sau khi nộp sẽ không sửa được.')) return;
    setIsSubmitting(true);

    // Cảnh báo nếu state rỗng — trường hợp bug FE wipe answers vô tình.
    if (Object.keys(session.answers).length === 0) {
      const proceed = window.confirm(
        'Hệ thống không thấy câu trả lời nào trong bộ nhớ trình duyệt. Bạn có chắc chắn muốn nộp bài rỗng không?',
      );
      if (!proceed) {
        setIsSubmitting(false);
        return;
      }
    }

    // ⚠️ Retry submit tối đa 3 lần với backoff (mạng yếu → blip).
    let lastErr: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // Flush last answers before final submit
        await saveDraft().catch(() => {});
        await api.post(`/student/thpt-exams/${examId}/submit`, {
          submission_id: submissionId,
          answers: session.answers,
          final: true,
        });
        examDraftStorage.clear(submissionId);
        localStorage.removeItem(thptDeadlineKey(examId, submissionId));
        toast.success('Đã nộp bài thành công!');
        navigate(`/hoc-vien/ket-qua-thpt/${submissionId}`, { replace: true });
        return;
      } catch (err: any) {
        lastErr = err;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }

    // Sau 3 lần vẫn fail
    const msg = lastErr?.response?.data?.message || 'Nộp bài thất bại.';
    if (auto) {
      // Auto-submit do timeout — show alert (không chỉ toast) để user nhìn thấy
      window.alert(
        `${msg}\n\nDữ liệu vẫn được giữ trong trình duyệt. Hãy giữ tab mở và bấm Nộp bài thủ công khi mạng ổn định.`,
      );
    } else {
      toast.error(msg);
    }
    setIsSubmitting(false);
  }, [submissionId, examId, isSubmitting, session.answers, navigate, toast]);

  // Manual countdown (THPT-specific; session.timeRemaining not used here)
  useEffect(() => {
    if (loading || !config || !submissionId) return;
    const key = thptDeadlineKey(examId, submissionId);
    const t = window.setInterval(() => {
      const deadline = Number(localStorage.getItem(key));
      const next = Number.isFinite(deadline) ? Math.max(0, Math.floor((deadline - Date.now()) / 1000)) : 0;
      setRemainingSec(next);
      if (next <= 0) {
        window.clearInterval(t);
        handleSubmit(true).catch(() => {});
      }
    }, 1000);
    return () => window.clearInterval(t);
  }, [loading, config, submissionId, examId, handleSubmit]);

  // Manual server auto-save every 30s via THPT-specific endpoint
  const saveDraft = useCallback(async () => {
    if (!submissionId || !examId) return;
    // Bỏ qua autosave nếu đang nộp (tránh đua với handleSubmit final).
    if (isSubmitting) return;
    // Bỏ qua khi chưa có đáp án nào — tránh gửi {} rỗng khiến BE validate
    // 'answers required' fail (400) và spam request liên tục mỗi 30s.
    const answers = session.answers ?? {};
    if (!answers || Object.keys(answers).length === 0) return;
    try {
      await api.post(`/student/thpt-exams/${examId}/submit`, {
        submission_id: submissionId,
        answers,
        final: false,
      });
    } catch (err) {
      console.warn('[thpt] autosave failed', err);
    }
  }, [submissionId, examId, session.answers, isSubmitting]);

  useEffect(() => {
    if (!submissionId) return;
    const t = window.setInterval(() => void saveDraft(), AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [submissionId, saveDraft]);

  useEffect(() => {
    const onHide = () => void saveDraft();
    window.addEventListener('beforeunload', onHide);
    return () => window.removeEventListener('beforeunload', onHide);
  }, [saveDraft]);

  const onAnswerChange = (key: string, value: boolean | string) => {
    session.setAnswer(key, value);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-3" />
          <p className="text-sm text-slate-600">Đang tải đề thi...</p>
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full rounded-2xl bg-white border border-red-200 p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900 mb-1">Có lỗi xảy ra</h2>
          <p className="text-sm text-slate-600 mb-4">{error ?? 'Không có dữ liệu đề thi.'}</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-lg bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 transition-colors cursor-pointer"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  const activeSection = config.sections[activeIdx];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <OfflineBanner online={session.online} pendingCount={session.pendingCount} />
      <TimeWarningBanner
        level={session.warningLevel}
        onDismiss={session.dismissWarning}
        timeRemaining={session.timeRemaining}
      />
      <ThptTopBar examTitle={examTitle} totalSeconds={remainingSec} totalDurationSec={totalDurationSec} onRestart={handleRestart} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 pt-6 pb-24 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div className="min-w-0">
          {activeSection && (
            <SectionView
              key={activeSection.id}
              section={activeSection}
              answers={session.answers as ThptAnswers}
              onAnswerChange={onAnswerChange}
              submissionId={submissionId}
              mode="taking"
            />
          )}
        </div>

        <ThptPartNavigator config={config} answers={session.answers as ThptAnswers} activeIdx={activeIdx} onSectionChange={setActiveIdx} />
      </main>

      <ThptBottomNav
        activePart={activeIdx}
        totalParts={config.sections.length}
        canPrev={activeIdx > 0}
        canNext={activeIdx < config.sections.length - 1}
        onPrev={() => setActiveIdx((i) => Math.max(0, i - 1))}
        onNext={() => setActiveIdx((i) => Math.min(config.sections.length - 1, i + 1))}
        onSubmit={() => handleSubmit(false)}
        isSubmitting={isSubmitting}
      />
      <SaveStatusIndicator
        status={session.saveStatus}
        lastSavedAt={session.lastSavedAt}
        pendingCount={session.pendingCount}
      />
      <ResumeExamModal
        draft={resumeDraft}
        open={!!resumeDraft}
        onResume={(draft) => { session.resume(draft); setResumeDraft(null); }}
        onDiscard={() => { if (submissionId) examDraftStorage.clear(submissionId); setResumeDraft(null); }}
      />
      <MultiTabWarning hasOtherTab={session.hasOtherTab} position="floating" />
      <ActiveSessionChoiceModal
        open={showActiveSessionModal}
        onContinue={() => setShowActiveSessionModal(false)}
        onRestart={async () => {
          setIsRestarting(true);
          try {
            await handleRestart();
          } finally {
            setIsRestarting(false);
          }
        }}
        isRestarting={isRestarting}
      />
    </div>
  );
}

interface ActiveSessionChoiceModalProps {
  open: boolean;
  onContinue: () => void;
  onRestart: () => void;
  isRestarting: boolean;
}

export function ActiveSessionChoiceModal({ open, onContinue, onRestart, isRestarting }: ActiveSessionChoiceModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200"
        style={{
          animation: 'modalIn 250ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <h3 className="text-lg font-extrabold text-slate-900 mb-2">
          Bạn đang có một phiên làm bài chưa nộp
        </h3>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          Bạn có muốn tiếp tục làm bài thi với các câu trả lời trước đó hay muốn xóa hoàn toàn phiên này để làm lại từ đầu (phiên mới)?
        </p>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onContinue}
            className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-md cursor-pointer"
          >
            Tiếp tục làm bài
          </button>
          <button
            type="button"
            onClick={onRestart}
            disabled={isRestarting}
            className="w-full py-3 px-4 rounded-xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isRestarting ? 'Đang khởi động lại...' : 'Hủy phiên & Làm lại từ đầu'}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes modalIn {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

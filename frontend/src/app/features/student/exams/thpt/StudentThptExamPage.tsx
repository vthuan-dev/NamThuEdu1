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
} from '../../../../../components/exam';
import { examDraftStorage } from '../../../../../lib/exam/examDraftStorage';
import type { ThptAnswers, ThptConfig } from './types';
import { ThptTopBar } from './components/ThptTopBar';
import { ThptPartNavigator } from './components/ThptPartNavigator';
import { ThptBottomNav } from './components/ThptBottomNav';
import { SectionView } from './views/SectionView';

const AUTOSAVE_INTERVAL_MS = 30_000;

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
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        setRemainingSec(Math.max(0, durationMin * 60 - elapsed));
        const restored = startData.submission_payload?.answers || {};
        Object.entries(restored).forEach(([k, v]) => session.setAnswer(k, v));
        if (sid) {
          const draft = examDraftStorage.load(sid);
          if (draft && Object.keys(draft.answers).length > 0) setResumeDraft(draft);
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

  const handleSubmit = useCallback(async (auto = false) => {
    if (!submissionId || !examId || isSubmitting) return;
    if (!auto && !window.confirm('Bạn chắc chắn muốn nộp bài? Sau khi nộp sẽ không sửa được.')) return;
    setIsSubmitting(true);
    try {
      // Flush last answers before final submit
      await saveDraft().catch(() => {});
      await api.post(`/student/thpt-exams/${examId}/submit`, {
        submission_id: submissionId,
        answers: session.answers,
        final: true,
      });
      examDraftStorage.clear(submissionId);
      toast.success('Đã nộp bài thành công!');
      navigate(`/hoc-vien/ket-qua-thpt/${submissionId}`, { replace: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Nộp bài thất bại.');
      setIsSubmitting(false);
    }
  }, [submissionId, examId, isSubmitting, session.answers, navigate, toast]);

  // Manual countdown (THPT-specific; session.timeRemaining not used here)
  useEffect(() => {
    if (loading || !config) return;
    const t = window.setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          window.clearInterval(t);
          handleSubmit(true).catch(() => {});
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [loading, config, handleSubmit]);

  // Manual server auto-save every 30s via THPT-specific endpoint
  const saveDraft = useCallback(async () => {
    if (!submissionId || !examId) return;
    try {
      await api.post(`/student/thpt-exams/${examId}/submit`, {
        submission_id: submissionId,
        answers: session.answers,
        final: false,
      });
    } catch (err) {
      console.warn('[thpt] autosave failed', err);
    }
  }, [submissionId, examId, session.answers]);

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
      <ThptTopBar examTitle={examTitle} totalSeconds={remainingSec} totalDurationSec={totalDurationSec} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
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
    </div>
  );
}

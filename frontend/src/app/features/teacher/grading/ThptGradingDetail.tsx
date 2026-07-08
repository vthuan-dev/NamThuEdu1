import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  Save,
  CheckCircle2,
  XCircle,
  Mic,
  Sparkles,
  Headphones,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  MessageSquare,
  Volume2,
  Pencil,
  X,
  ChevronDown,
  SlidersHorizontal,
  ListChecks,
  Type as TypeIcon,
  GraduationCap,
  BookOpen,
  User,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Clock,
} from 'lucide-react';
import { useToastContext } from '../../../../contexts/ToastContext';
import { RichText } from '../../../../components/ui/RichText';
import { getFullMediaUrl } from '../../../../utils/mediaUtils';
import {
  thptGradingApi,
  type GradingData,
  type GradingSection,
  type SubjectiveQuestion,
  type ObjectiveQuestion,
  type McqQuestion,
  type TextQuestion,
  type TfGroupQuestion,
  type MatchingQuestion,
  type SentenceInsertionQuestion,
  type SaveQuestionPayload,
} from '../../../../services/thptGradingApi';
import { splitPhoneticWord } from '../../../../utils/examUtils';

interface Props {
  submissionId: number;
}

// Per-question editable draft for subjective questions (kept separate from AI data).
interface DraftEntry {
  score: string; // string to allow partial typing; validated on save
  pronunciation: string;
  content: string;
  feedback: string;
  dirty: boolean;
}

// Live-computed score for a single section.
interface SectionLive {
  sid: string;
  title: string;
  type: string;
  kind: 'objective' | 'subjective';
  correct: number;
  total: number;
  scaled: number; // 0..10 tỉ lệ đúng quy về thang 10
  weight: number; // hệ số
  overrideCount: number;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function inRange0to10(raw: string): boolean {
  if (raw.trim() === '') return false;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 10;
}

function scoreToColor(score: number): string {
  return score >= 8 ? '#10B981' : score >= 6.5 ? '#0D9488' : score >= 5 ? '#F59E0B' : '#EF4444';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function ThptGradingDetail({ submissionId }: Props) {
  const navigate = useNavigate();
  const toast = useToastContext();

  const [page, setPage] = useState<'loading' | 'error' | 'ready'>('loading');
  const [data, setData] = useState<GradingData | null>(null);
  const [draft, setDraft] = useState<Record<number, DraftEntry>>({});
  const [overallFeedback, setOverallFeedback] = useState('');
  const [overrideScore, setOverrideScore] = useState('');
  // Có dùng điểm hệ số tự động (true) hay giáo viên nhập tay (false).
  const [autoWeighted, setAutoWeighted] = useState(true);

  // Override đúng/sai từng mục khách quan. Key = `${section_id}-${question_number}` (+ `-s{i}`/`-r{i}`).
  const [answerOverride, setAnswerOverride] = useState<Record<string, boolean>>({});
  // Override ĐÁP ÁN ĐÚNG cho câu MCQ. Key = `${sid}-${qn}` → option id mới.
  const [correctOverride, setCorrectOverride] = useState<Record<string, string>>({});
  // Hệ số từng phần. Key = section id.
  const [weights, setWeights] = useState<Record<string, number>>({});
  // Phần đang đóng/mở.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [weightEditorOpen, setWeightEditorOpen] = useState(false);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tabBarRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Container cuộn nội bộ của trang (header nằm NGOÀI container này nên không trôi).
  const scrollParentRef = useRef<HTMLElement | null>(null);
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);
  // Chiều cao header dính (để bù khi cuộn tới phần).
  const headerRef = useRef<HTMLElement | null>(null);
  // Phần đang hiển thị trong tầm nhìn (để sáng đèn tab tương ứng).
  const [activeSection, setActiveSection] = useState<string | null>(null);
  // Bỏ qua scroll-spy trong lúc đang cuộn tới phần được bấm.
  const isClickScrolling = useRef(false);

  const load = () => {
    setPage('loading');
    thptGradingApi
      .getGrading(submissionId)
      .then((d) => {
        if (!d) {
          setPage('error');
          return;
        }
        setData(d);
        setOverallFeedback(d.overall_teacher_feedback ?? '');
        const hasOverride =
          d.teacher_override_score !== null && d.teacher_override_score !== undefined;
        setOverrideScore(hasOverride ? String(d.teacher_override_score) : '');
        setAutoWeighted(!hasOverride);
        setDraft(buildInitialDraft(d));
        setWeights(buildInitialWeights(d));
        setPage('ready');
      })
      .catch(() => setPage('error'));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  const updateDraft = (qn: number, patch: Partial<DraftEntry>) => {
    setDraft((prev) => ({
      ...prev,
      [qn]: { ...prev[qn], ...patch, dirty: true },
    }));
  };

  const resetToAi = (qn: number, aiScore: number | null, ai: SubjectiveQuestion['ai']) => {
    setDraft((prev) => ({
      ...prev,
      [qn]: {
        score: aiScore !== null && aiScore !== undefined ? String(aiScore) : '',
        pronunciation: ai?.criteria?.pronunciation != null ? String(ai.criteria.pronunciation) : '',
        content: ai?.criteria?.content != null ? String(ai.criteria.content) : '',
        feedback: prev[qn]?.feedback ?? '',
        dirty: false,
      },
    }));
  };

  // Build the subjective questions payload — only those with a usable score.
  const buildQuestionsPayload = (): SaveQuestionPayload[] => {
    const out: SaveQuestionPayload[] = [];
    for (const [qnStr, entry] of Object.entries(draft)) {
      const qn = Number(qnStr);
      if (!inRange0to10(entry.score)) continue;
      const criteria: { pronunciation?: number; content?: number } = {};
      if (inRange0to10(entry.pronunciation)) criteria.pronunciation = Number(entry.pronunciation);
      if (inRange0to10(entry.content)) criteria.content = Number(entry.content);
      out.push({
        question_number: qn,
        teacher_score: Number(entry.score),
        ...(Object.keys(criteria).length ? { teacher_criteria: criteria } : {}),
        ...(entry.feedback.trim() ? { teacher_feedback: entry.feedback.trim() } : {}),
      });
    }
    return out;
  };

  const hasInvalidScore = useMemo(
    () =>
      Object.values(draft).some((e) => e.score.trim() !== '' && !inRange0to10(e.score)) ||
      (overrideScore.trim() !== '' && !inRange0to10(overrideScore)),
    [draft, overrideScore],
  );

  // ── Hiệu lực đúng/sai của 1 mục, có tính cả override đáp án đúng (MCQ) ──────
  const effectiveCorrect = (
    q: ObjectiveQuestion,
    sid: string,
    itemKey: string,
    originalCorrect: boolean,
  ): boolean => {
    // 1) Override đúng/sai trực tiếp (toggle) thắng tất cả.
    if (itemKey in answerOverride) return answerOverride[itemKey];
    // 2) Với MCQ, nếu giáo viên đổi đáp án đúng → so lại với student_answer.
    if (q.kind === 'mcq') {
      const ck = `${sid}-${q.question_number}`;
      if (ck in correctOverride) {
        return String(q.student_answer) === String(correctOverride[ck]);
      }
    }
    return originalCorrect;
  };

  // ── Tính lại điểm từng phần + điểm tổng theo HỆ SỐ (live) ───────────────────
  const recompute = useMemo(() => {
    if (!data) return null;
    const liveSections: SectionLive[] = [];

    for (const section of data.sections) {
      const sid = section.section_id ?? section.type;
      const weight = weights[sid] ?? 0;

      if (section.kind === 'subjective') {
        // Điểm phần Nói/Viết = trung bình điểm hiệu lực (teacher draft → ai).
        const qs = section.questions as SubjectiveQuestion[];
        const scores: number[] = [];
        for (const q of qs) {
          const e = draft[q.question_number];
          if (e && inRange0to10(e.score)) scores.push(Number(e.score));
          else if (q.ai?.score != null) scores.push(q.ai.score);
        }
        const scaled = scores.length ? round2(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        liveSections.push({
          sid,
          title: section.title,
          type: section.type,
          kind: 'subjective',
          correct: scores.length,
          total: qs.length,
          scaled,
          weight,
          overrideCount: qs.filter((q) => draft[q.question_number]?.dirty).length,
        });
        continue;
      }

      // Objective
      let correctItems = 0;
      let itemCount = 0;
      let ovc = 0;
      for (const q of section.questions as ObjectiveQuestion[]) {
        if (q.kind === 'tf_group') {
          q.statements.forEach((s, i) => {
            itemCount++;
            const k = `${sid}-${q.question_number}-s${i}`;
            if (k in answerOverride) ovc++;
            if (effectiveCorrect(q, sid, k, s.is_correct)) correctItems++;
          });
        } else if (q.kind === 'matching') {
          q.rows.forEach((r, i) => {
            itemCount++;
            const k = `${sid}-${q.question_number}-r${i}`;
            if (k in answerOverride) ovc++;
            if (effectiveCorrect(q, sid, k, r.is_correct)) correctItems++;
          });
        } else {
          itemCount++;
          const k = `${sid}-${q.question_number}`;
          if (k in answerOverride) ovc++;
          if (q.kind === 'mcq' && `${sid}-${q.question_number}` in correctOverride) ovc++;
          if (effectiveCorrect(q, sid, k, (q as any).is_correct)) correctItems++;
        }
      }
      const total = section.score?.total_count ?? itemCount;
      const denom = total > 0 ? total : itemCount;
      const scaled = denom > 0 ? round2((correctItems / denom) * 10) : 0;
      liveSections.push({
        sid,
        title: section.title,
        type: section.type,
        kind: 'objective',
        correct: correctItems,
        total: denom,
        scaled,
        weight,
        overrideCount: ovc,
      });
    }

    const totalWeight = liveSections.reduce((a, s) => a + s.weight, 0);
    const weightedTotal =
      totalWeight > 0
        ? round2(liveSections.reduce((a, s) => a + s.scaled * s.weight, 0) / totalWeight)
        : 0;

    return { liveSections, totalWeight, weightedTotal };
  }, [data, answerOverride, correctOverride, weights, draft]);

  // Khi ở chế độ auto → đồng bộ điểm tổng hệ số vào ô override.
  useEffect(() => {
    if (autoWeighted && recompute) {
      setOverrideScore(String(recompute.weightedTotal));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recompute?.weightedTotal, autoWeighted]);

  // Vùng cuộn: tự động tìm container cuộn gần nhất (scrollBodyRef hoặc layout cha)
  useEffect(() => {
    if (page !== 'ready') return;
    if (scrollBodyRef.current) {
      scrollParentRef.current = scrollBodyRef.current.closest('.overflow-y-auto') || scrollBodyRef.current;
    }
  }, [page]);

  // Scroll-spy: sáng đèn tab của phần đang ở đỉnh viewport (lắng nghe scroll trực tiếp).
  useEffect(() => {
    if (page !== 'ready' || !data) return;

    const keys = data.sections.map((s, idx) => s.section_id ?? s.type ?? `s-${idx}`);

    const computeActive = () => {
      if (isClickScrolling.current) return;
      const headerH = headerRef.current?.offsetHeight ?? 140;
      // Ngưỡng = ngay dưới header chính (cộng đệm nhỏ).
      const lineY = headerH + 16;
      let current: string | null = null;
      for (const key of keys) {
        const el = sectionRefs.current[key];
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        // Phần nào có đỉnh đã đi qua ngưỡng (top <= lineY) thì là phần đang xem.
        if (top - lineY <= 0) current = key;
        else break;
      }
      // Trước khi cuộn qua phần đầu tiên → mặc định phần đầu.
      if (!current && keys.length) current = keys[0];
      if (current) setActiveSection((prev) => (prev === current ? prev : current));
    };

    const target: HTMLElement | Window = scrollParentRef.current ?? window;
    computeActive();
    target.addEventListener('scroll', computeActive, { passive: true });
    window.addEventListener('resize', computeActive);
    return () => {
      target.removeEventListener('scroll', computeActive);
      window.removeEventListener('resize', computeActive);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, data]);

  // Tự cuộn tab đang active vào giữa thanh tab (CHỈ cuộn ngang trong thanh tab,
  // không dùng scrollIntoView vì nó cuộn cả trang theo chiều dọc → gây giật).
  useEffect(() => {
    if (!activeSection) return;
    const bar = tabBarRef.current;
    const tab = tabRefs.current[activeSection];
    if (!bar || !tab) return;
    const target = tab.offsetLeft - bar.clientWidth / 2 + tab.clientWidth / 2;
    const max = bar.scrollWidth - bar.clientWidth;
    const next = Math.max(0, Math.min(target, max));
    if (Math.abs(bar.scrollLeft - next) > 1) {
      bar.scrollTo({ left: next, behavior: 'smooth' });
    }
  }, [activeSection]);

  const totalOverrideCount =
    Object.keys(answerOverride).length + Object.keys(correctOverride).length;

  // Toggle đúng/sai 1 mục. Nếu bằng giá trị gốc → xoá override.
  const toggleCorrect = (key: string, value: boolean, original: boolean) => {
    setAutoWeighted(true);
    setAnswerOverride((prev) => {
      const next = { ...prev };
      if (value === original) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  // Đổi đáp án đúng của câu MCQ (giáo viên click option khác).
  const setCorrectAnswer = (sid: string, qn: number, newId: string, originalId: string | null) => {
    setAutoWeighted(true);
    const ck = `${sid}-${qn}`;
    setCorrectOverride((prev) => {
      const next = { ...prev };
      if (String(newId) === String(originalId)) delete next[ck];
      else next[ck] = newId;
      return next;
    });
    // Đổi đáp án đúng → xoá override toggle thủ công của chính câu đó (tính lại tự nhiên).
    setAnswerOverride((prev) => {
      if (!(ck in prev)) return prev;
      const next = { ...prev };
      delete next[ck];
      return next;
    });
  };

  const updateWeight = (sid: string, raw: string) => {
    const n = Number(raw);
    setWeights((prev) => ({ ...prev, [sid]: Number.isFinite(n) && n >= 0 ? n : 0 }));
    setAutoWeighted(true);
  };

  const resetWeights = () => {
    if (data) setWeights(buildInitialWeights(data));
    setAutoWeighted(true);
  };

  const scrollToSection = (sid: string) => {
    const el = sectionRefs.current[sid];
    if (!el) return;
    setActiveSection(sid);
    // Tạm khoá scroll-spy để tránh nhấp nháy khi đang cuộn mượt.
    isClickScrolling.current = true;
    const headerH = headerRef.current?.offsetHeight ?? 140;
    const parent = scrollParentRef.current;
    if (parent) {
      // Cuộn riêng container — không động tới ancestor khác (tránh header nhảy).
      const top =
        el.getBoundingClientRect().top - parent.getBoundingClientRect().top + parent.scrollTop - headerH - 8;
      parent.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    } else {
      const top = el.getBoundingClientRect().top + window.scrollY - headerH - 8;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
    window.setTimeout(() => {
      isClickScrolling.current = false;
    }, 700);
  };

  const doPublish = async () => {
    setConfirmOpen(false);
    const invalid = Object.values(draft).some(
      (e) => e.dirty && e.score.trim() !== '' && !inRange0to10(e.score),
    );
    if (invalid) {
      toast.error('Điểm phải nằm trong khoảng 0–10.');
      return;
    }
    if (overrideScore.trim() !== '' && !inRange0to10(overrideScore)) {
      toast.error('Điểm tổng phải nằm trong khoảng 0–10.');
      return;
    }
    setSaving(true);
    try {
      const res = await thptGradingApi.saveGrading(submissionId, {
        questions: buildQuestionsPayload(),
        overall_teacher_feedback: overallFeedback,
        teacher_override_score: overrideScore.trim() !== '' ? Number(overrideScore) : null,
        publish: true,
      });
      if (res) {
        setData((prev) => (prev ? { ...prev, ...res } : res));
      }
      toast.success('Đã lưu và phát hành kết quả cho học viên.');
      navigate('/giao-vien/cham-diem');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lưu thất bại. Dữ liệu của bạn vẫn được giữ.');
    } finally {
      setSaving(false);
    }
  };

  if (page === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (page === 'error' || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full rounded-2xl bg-white border border-red-200 p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-sm text-slate-600 mb-4">Không tải được dữ liệu chấm điểm.</p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={load}
              className="px-4 py-2 rounded-lg bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 transition-colors cursor-pointer"
            >
              Thử lại
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.history.state && window.history.state.idx > 0) {
                  navigate(-1);
                } else {
                  navigate('/giao-vien/cham-diem');
                }
              }}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 font-semibold text-sm hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  const obj = data.objective;
  const scaleMax = obj.scale_max ?? 10;
  const finalScore = overrideScore.trim() !== '' && inRange0to10(overrideScore)
    ? Number(overrideScore)
    : recompute?.weightedTotal ?? 0;

  return (
    <div ref={rootRef} className="flex-1 flex flex-col bg-slate-50">
      {/* ─── Header (Sticky top) ──────────────────── */}
      <header ref={headerRef} className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="px-6 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (window.history.state && window.history.state.idx > 0) {
                navigate(-1);
              } else {
                navigate('/giao-vien/cham-diem');
              }
            }}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900 truncate">
              {data.exam.title ?? 'Đề THPT'}
            </h1>
            <p className="text-xs text-slate-500 truncate flex items-center gap-2">
              {data.student.name ?? 'Học viên'}
              {data.status === 'graded' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[10px] font-bold">
                  Đã phát hành
                </span>
              )}
              {totalOverrideCount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px] font-bold">
                  {totalOverrideCount} chỉnh sửa chưa lưu
                </span>
              )}
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end mr-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Điểm cuối
            </span>
            <span
              className="text-xl font-extrabold tabular-nums leading-none transition-colors"
              style={{ color: scoreToColor(finalScore) }}
            >
              {finalScore.toFixed(2)}
              <span className="text-xs text-slate-400 font-bold">/{scaleMax}</span>
            </span>
          </div>
          <button
            type="button"
            disabled={saving || hasInvalidScore}
            onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Lưu &amp; phát hành
          </button>
        </div>

        {/* Section navigation tabs */}
        {recompute && recompute.liveSections.length > 1 && (
          <div ref={tabBarRef} className="px-6 pb-2.5 flex items-center gap-2 overflow-x-auto scrollbar-thin">
            {recompute.liveSections.map((s, i) => {
              const isActive = activeSection === s.sid;
              return (
                <button
                  key={s.sid}
                  ref={(el) => {
                    tabRefs.current[s.sid] = el;
                  }}
                  type="button"
                  onClick={() => scrollToSection(s.sid)}
                  aria-current={isActive ? 'true' : undefined}
                  className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-200 cursor-pointer flex-shrink-0 ${
                    isActive
                      ? 'bg-teal-600 border-teal-600 text-white shadow-sm shadow-teal-600/30'
                      : 'bg-slate-50 hover:bg-teal-50 border-slate-200 hover:border-teal-200 text-slate-600 hover:text-teal-700'
                  }`}
                >
                  <span
                    className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold tabular-nums transition-colors ${
                      isActive
                        ? 'bg-white/25 text-white'
                        : 'bg-slate-200 group-hover:bg-teal-200 text-slate-600'
                    }`}
                  >
                    {i + 1}
                  </span>
                  {TYPE_LABEL[s.type] ?? 'Phần'}
                  {s.overrideCount > 0 && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-amber-300' : 'bg-amber-500'}`}
                      title="Có chỉnh sửa"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* ─── Vùng cuộn nội bộ (header ở trên không nằm trong đây) ─────────── */}
      <div ref={scrollBodyRef} className="w-full">
        {/* ─── Body: 2-column layout ───────────────────────────────────────── */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          {/* LEFT: sections */}
          <div className="space-y-6 min-w-0">
            {data.sections.map((section, idx) => {
              const sid = section.section_id ?? `s-${idx}`;
              const live = recompute?.liveSections.find((s) => s.sid === (section.section_id ?? section.type));
              const isCollapsed = collapsed[sid] ?? false;
              return (
                <section
                  key={sid}
                  data-sid={section.section_id ?? section.type}
                  ref={(el) => {
                    sectionRefs.current[section.section_id ?? section.type] = el;
                  }}
                  className="scroll-mt-32"
                >
                  <SectionHeader
                    section={section}
                    live={live}
                    collapsed={isCollapsed}
                    onToggle={() => setCollapsed((p) => ({ ...p, [sid]: !p[sid] }))}
                  />
                  {!isCollapsed && (
                    <div className="mt-4 space-y-4">
                      {section.kind === 'subjective' ? (
                        <SubjectiveSectionGrading
                          section={section}
                          draft={draft}
                          onUpdate={updateDraft}
                          onResetToAi={resetToAi}
                        />
                      ) : (
                        <ObjectiveSectionBody
                          section={section}
                          answerOverride={answerOverride}
                          correctOverride={correctOverride}
                          onToggle={toggleCorrect}
                          onSetCorrect={setCorrectAnswer}
                        />
                      )}
                    </div>
                  )}
                </section>
              );
            })}

            {/* Overall feedback */}
            <section className="rounded-2xl bg-white border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-teal-600" />
                <h2 className="text-sm font-bold text-slate-800">Nhận xét tổng quát</h2>
              </div>
              <textarea
                value={overallFeedback}
                onChange={(e) => setOverallFeedback(e.target.value)}
                rows={4}
                placeholder="Nhận xét chung cho bài làm của học viên…"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-200 resize-y"
              />
            </section>
          </div>

          {/* RIGHT: sticky score dashboard */}
          <aside className="lg:sticky lg:top-20 max-h-[calc(100vh-140px)] overflow-y-auto pr-1 space-y-4 scrollbar-thin">
            <ScoreDashboard
              recompute={recompute}
              scaleMax={scaleMax}
              finalScore={finalScore}
              autoWeighted={autoWeighted}
              overrideScore={overrideScore}
              onOverrideChange={(v) => {
                setOverrideScore(v);
                setAutoWeighted(false);
              }}
              onUseAuto={() => setAutoWeighted(true)}
              weightEditorOpen={weightEditorOpen}
              onToggleWeightEditor={() => setWeightEditorOpen((v) => !v)}
              onWeightChange={updateWeight}
              onResetWeights={resetWeights}
              aiPending={data.ai_speaking_pending}
              objRawScore={obj.raw_score}
              objRawMax={obj.raw_score_max}
              onScrollToSection={scrollToSection}
            />

            {/* Student Info Card */}
            <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <User className="w-4 h-4 text-teal-600" />
                <h2 className="text-sm font-bold text-slate-800">Thông tin học viên</h2>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-400">Họ tên:</span>
                  <span className="font-bold text-slate-800">{data.student.name}</span>
                </div>
                {data.student.class_name && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-400">Lớp:</span>
                    <span className="font-semibold text-slate-700 flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-teal-500" />
                      {data.student.class_name}
                    </span>
                  </div>
                )}
                {data.student.age_group && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-400">Loại học viên:</span>
                    <span className="font-semibold text-slate-700">
                      {data.student.age_group === 'kids'
                        ? 'Thiếu nhi (Kids)'
                        : data.student.age_group === 'teens'
                          ? 'Thiếu niên (Teens)'
                          : data.student.age_group === 'adults'
                            ? 'Người lớn (Adults)'
                            : data.student.age_group}
                    </span>
                  </div>
                )}
                {data.student.gender !== undefined && data.student.gender !== null && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-400">Giới tính:</span>
                    <span className="text-slate-700">
                      {data.student.gender ? 'Nam' : 'Nữ'}
                    </span>
                  </div>
                )}
                {data.student.dob && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-400">Ngày sinh:</span>
                    <span className="text-slate-700 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {(() => {
                        const parts = data.student.dob.split('-');
                        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : data.student.dob;
                      })()}
                      {data.student.dob && (() => {
                        const birthYear = new Date(data.student.dob).getFullYear();
                        const currentYear = new Date().getFullYear();
                        const age = currentYear - birthYear;
                        return age > 0 ? ` (${age} tuổi)` : '';
                      })()}
                    </span>
                  </div>
                )}
                {data.student.phone && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-400">Số điện thoại:</span>
                    <span className="text-slate-700 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {data.student.phone}
                    </span>
                  </div>
                )}
                {data.student.email && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-400">Email:</span>
                    <span className="text-slate-700 flex items-center gap-1 max-w-[180px] truncate" title={data.student.email}>
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {data.student.email}
                    </span>
                  </div>
                )}
                {data.student.address && (
                  <div className="flex flex-col gap-1 pt-1 border-t border-slate-50">
                    <span className="font-medium text-slate-400">Địa chỉ / Quê quán:</span>
                    <span className="text-slate-700 text-xs flex items-start gap-1 leading-relaxed">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                      {data.student.address}
                    </span>
                  </div>
                )}
                {data.submitted_at && (
                  <div className="flex flex-col gap-1 pt-1 border-t border-slate-50">
                    <span className="font-medium text-slate-400">Thời gian nộp bài:</span>
                    <span className="text-slate-700 text-xs flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {(() => {
                        try {
                          const d = new Date(data.submitted_at);
                          return d.toLocaleString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          });
                        } catch {
                          return data.submitted_at;
                        }
                      })()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
        </main>
      </div>

      {confirmOpen && (
        <PublishConfirmDialog
          onCancel={() => setConfirmOpen(false)}
          onConfirm={doPublish}
          saving={saving}
          finalScore={finalScore}
          scaleMax={scaleMax}
        />
      )}
    </div>
  );
}

// ─── Initial draft builder ──────────────────────────────────────────────────
function buildInitialDraft(d: GradingData): Record<number, DraftEntry> {
  const draft: Record<number, DraftEntry> = {};
  const collect = (q: SubjectiveQuestion) => {
    const teacher = q.teacher;
    const ai = q.ai;
    const score =
      teacher?.score != null ? String(teacher.score) : ai?.score != null ? String(ai.score) : '';
    const pron =
      teacher?.criteria?.pronunciation != null
        ? String(teacher.criteria.pronunciation)
        : ai?.criteria?.pronunciation != null
          ? String(ai.criteria.pronunciation)
          : '';
    const content =
      teacher?.criteria?.content != null
        ? String(teacher.criteria.content)
        : ai?.criteria?.content != null
          ? String(ai.criteria.content)
          : '';
    draft[q.question_number] = {
      score,
      pronunciation: pron,
      content,
      feedback: teacher?.feedback ?? '',
      dirty: Boolean(teacher),
    };
  };
  const fromSections = d.sections.flatMap((s) =>
    s.kind === 'subjective' ? (s.questions as SubjectiveQuestion[]) : [],
  );
  const list = fromSections.length ? fromSections : d.subjective_questions ?? [];
  list.forEach(collect);
  return draft;
}

// ─── Initial weights builder ────────────────────────────────────────────────
// Hệ số mặc định = số điểm tối đa (raw_max) của phần khách quan; phần chủ quan = 1.
// Như vậy điểm tổng hệ số ~ khớp công thức gốc (điểm đều theo trọng số câu).
function buildInitialWeights(d: GradingData): Record<string, number> {
  const w: Record<string, number> = {};
  for (const s of d.sections) {
    const sid = s.section_id ?? s.type;
    if (s.kind === 'subjective') {
      w[sid] = 1;
    } else {
      const rawMax = s.score?.raw_max ?? s.score?.total_count ?? 1;
      w[sid] = rawMax > 0 ? round2(rawMax) : 1;
    }
  }
  return w;
}

// ─── Score Dashboard (sticky right panel) ───────────────────────────────────
function ScoreDashboard({
  recompute,
  scaleMax,
  finalScore,
  autoWeighted,
  overrideScore,
  onOverrideChange,
  onUseAuto,
  weightEditorOpen,
  onToggleWeightEditor,
  onWeightChange,
  onResetWeights,
  aiPending,
  objRawScore,
  objRawMax,
  onScrollToSection,
}: {
  recompute: { liveSections: SectionLive[]; totalWeight: number; weightedTotal: number } | null;
  scaleMax: number;
  finalScore: number;
  autoWeighted: boolean;
  overrideScore: string;
  onOverrideChange: (v: string) => void;
  onUseAuto: () => void;
  weightEditorOpen: boolean;
  onToggleWeightEditor: () => void;
  onWeightChange: (sid: string, v: string) => void;
  onResetWeights: () => void;
  aiPending: boolean;
  objRawScore: number | null;
  objRawMax: number | null;
  onScrollToSection?: (sid: string) => void;
}) {
  if (!recompute) return null;
  const { liveSections, totalWeight, weightedTotal } = recompute;
  const overrideInvalid = overrideScore.trim() !== '' && !inRange0to10(overrideScore);

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
      {/* Final score hero */}
      <div className="relative p-5 bg-gradient-to-br from-teal-600 to-teal-700 text-white">
        <div className="flex items-center gap-1.5 mb-2">
          <GraduationCap className="w-4 h-4 opacity-90" />
          <span className="text-[11px] font-bold uppercase tracking-widest opacity-90">
            Điểm tổng kết
          </span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-5xl font-extrabold tabular-nums leading-none">
            {finalScore.toFixed(2)}
          </span>
          <span className="text-lg font-bold opacity-75 mb-0.5">/ {scaleMax}</span>
        </div>
        {autoWeighted ? (
          <p className="text-[11px] mt-2 opacity-90 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Tự động tính theo hệ số từng phần
          </p>
        ) : (
          <p className="text-[11px] mt-2 opacity-90 flex items-center gap-1">
            <Pencil className="w-3 h-3" /> Giáo viên nhập điểm thủ công
          </p>
        )}
        {aiPending && (
          <span className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-lg bg-white/20 text-white text-[11px] font-semibold">
            <Loader2 className="w-3 h-3 animate-spin" /> AI đang chấm phần Nói
          </span>
        )}
      </div>

      {/* Per-section breakdown */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Điểm từng phần
          </h3>
          <button
            type="button"
            onClick={onToggleWeightEditor}
            className={`inline-flex items-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer ${
              weightEditorOpen ? 'text-teal-700' : 'text-slate-400 hover:text-teal-600'
            }`}
          >
            <SlidersHorizontal className="w-3 h-3" /> Hệ số
          </button>
        </div>

        <div className="space-y-2.5">
          {liveSections.map((s) => {
            const contribution =
              totalWeight > 0 ? round2((s.scaled * s.weight) / totalWeight) : 0;
            return (
              <div
                key={s.sid}
                onClick={() => onScrollToSection?.(s.sid)}
                className={`rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 transition-all ${
                  onScrollToSection ? 'cursor-pointer hover:border-teal-300 hover:bg-teal-50/30 hover:shadow-sm' : ''
                }`}
                title="Nhấn để cuộn đến phần này"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-slate-700 truncate flex items-center gap-1.5">
                    {s.kind === 'subjective' ? (
                      <Mic className="w-3 h-3 text-teal-600 flex-shrink-0" />
                    ) : (
                      <ListChecks className="w-3 h-3 text-teal-600 flex-shrink-0" />
                    )}
                    {TYPE_LABEL[s.type] ?? s.title}
                  </span>
                  <span
                    className="text-sm font-bold tabular-nums flex-shrink-0"
                    style={{ color: scoreToColor(s.scaled) }}
                  >
                    {s.scaled.toFixed(2)}
                  </span>
                </div>
                {/* progress */}
                <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden mb-1.5">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min((s.scaled / 10) * 100, 100)}%`,
                      background: scoreToColor(s.scaled),
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span>
                    {s.kind === 'subjective'
                      ? `${s.correct}/${s.total} câu đã chấm`
                      : `${s.correct}/${s.total} đúng`}
                  </span>
                  {weightEditorOpen ? (
                    <div className="flex items-center gap-1">
                      <span>Hệ số</span>
                      <input
                        type="number"
                        min={0}
                        step={0.25}
                        value={s.weight}
                        onChange={(e) => onWeightChange(s.sid, e.target.value)}
                        className="w-14 px-1.5 py-0.5 rounded-md border border-slate-200 text-[11px] font-bold text-slate-700 tabular-nums focus:outline-none focus:ring-1 focus:ring-teal-300"
                      />
                    </div>
                  ) : (
                    <span className="font-bold text-teal-600">
                      đóng góp {contribution.toFixed(2)}đ
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {weightEditorOpen && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
            <span className="text-[11px] text-slate-400">Tổng hệ số: <b className="text-slate-600">{round2(totalWeight)}</b></span>
            <button
              type="button"
              onClick={onResetWeights}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-teal-600 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Mặc định
            </button>
          </div>
        )}

        {/* Manual override */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Pencil className="w-3 h-3 text-teal-600" /> Điểm tổng (ghi đè)
            </label>
            {!autoWeighted && (
              <button
                type="button"
                onClick={onUseAuto}
                className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 transition-colors cursor-pointer"
              >
                Dùng điểm tự động
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={10}
              step={0.25}
              value={overrideScore}
              onChange={(e) => onOverrideChange(e.target.value)}
              placeholder={String(weightedTotal.toFixed(2))}
              className={`w-full rounded-lg border px-3 py-2 text-base font-bold text-slate-800 tabular-nums focus:outline-none focus:ring-2 ${
                overrideInvalid
                  ? 'border-red-300 focus:ring-red-200'
                  : 'border-slate-200 focus:ring-teal-200'
              }`}
            />
            <span className="text-sm text-slate-400 font-bold flex-shrink-0">/ {scaleMax}</span>
          </div>
          {overrideInvalid && (
            <p className="text-[11px] font-semibold text-red-500 mt-1">Điểm phải trong khoảng 0–10</p>
          )}
          <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
            Sửa đáp án hoặc hệ số sẽ tự cập nhật điểm tổng. Nhập tay để ghi đè điểm cuối.
          </p>
          {objRawScore != null && objRawMax != null && (
            <p className="text-[10px] text-slate-400 mt-1">
              Điểm thô khách quan: <b className="text-slate-500">{objRawScore}/{objRawMax}</b>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section header ─────────────────────────────────────────────────────────
const TYPE_LABEL: Record<string, string> = {
  listening: 'Nghe hiểu',
  speaking: 'Nói',
  writing: 'Viết',
  phonetics: 'Ngữ âm',
  mc_questions: 'Trắc nghiệm',
  word_form: 'Chia dạng từ',
  error_identification: 'Tìm lỗi sai',
  mc_cloze: 'Đọc điền',
  word_bank_cloze: 'Điền từ cho sẵn',
  open_cloze: 'Điền từ',
  tf_group: 'Đúng / Sai',
  reading_mixed: 'Đọc hiểu',
  matching: 'Nối câu',
  sentence_transformation: 'Viết lại câu',
};

function SectionHeader({
  section,
  live,
  collapsed,
  onToggle,
}: {
  section: GradingSection;
  live?: SectionLive;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const typeLabel = TYPE_LABEL[section.type] ?? 'Phần thi';
  return (
    <header className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 pl-6">
      <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-teal-600" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-teal-700 mb-1.5">
            {typeLabel}
            {live && live.overrideCount > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px] normal-case tracking-normal">
                {live.overrideCount} chỉnh sửa
              </span>
            )}
          </span>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-snug">
            {section.title}
          </h2>
          {section.instructions && (
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed max-w-2xl">
              {section.instructions}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {live && (
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Điểm phần
              </span>
              <span
                className="text-lg font-bold tabular-nums leading-tight"
                style={{ color: scoreToColor(live.scaled) }}
              >
                {live.scaled.toFixed(2)}
                <span className="text-slate-400 font-normal text-sm">/10</span>
              </span>
              {live.kind === 'objective' && (
                <span className="text-[10px] text-slate-400">{live.correct}/{live.total} đúng</span>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={onToggle}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
            title={collapsed ? 'Mở rộng' : 'Thu gọn'}
          >
            <ChevronDown
              className={`w-4 h-4 text-slate-500 transition-transform ${collapsed ? '-rotate-90' : ''}`}
            />
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── Objective section body ─────────────────────────────────────────────────
type ToggleFn = (key: string, value: boolean, original: boolean) => void;
type SetCorrectFn = (sid: string, qn: number, newId: string, originalId: string | null) => void;

function ObjectiveSectionBody({
  section,
  answerOverride,
  correctOverride,
  onToggle,
  onSetCorrect,
}: {
  section: GradingSection;
  answerOverride: Record<string, boolean>;
  correctOverride: Record<string, string>;
  onToggle: ToggleFn;
  onSetCorrect: SetCorrectFn;
}) {
  const questions = section.questions as ObjectiveQuestion[];
  const sid = section.section_id ?? section.type;
  const hasPassage = !!section.passage;

  const questionList = (
    <>
      {section.word_bank && section.word_bank.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Ngân hàng từ</p>
          <div className="flex flex-wrap gap-2">
            {section.word_bank.map((w, i) => (
              <span key={i} className="px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-sm font-semibold">
                {w}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className={hasPassage ? "space-y-3" : "contents"}>
        {questions.map((q) => (
          <ObjectiveQuestionCard
            key={`${sid}-${q.question_number}`}
            q={q}
            sid={sid}
            answerOverride={answerOverride}
            correctOverride={correctOverride}
            onToggle={onToggle}
            onSetCorrect={onSetCorrect}
          />
        ))}
      </div>
    </>
  );

  return (
    <>
      {section.audio_url && (
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-teal-50 text-teal-700 ring-1 ring-teal-100 flex-shrink-0">
              <Headphones className="w-[18px] h-[18px]" />
            </div>
            <p className="text-[13px] font-semibold text-slate-800">Đoạn ghi âm</p>
          </div>
          <audio controls src={getFullMediaUrl(section.audio_url) ?? undefined} className="w-full h-10" />
        </div>
      )}

      {hasPassage ? (
        /* ── Split layout: passage left | questions right ── */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Left: sticky passage */}
          <div className="lg:sticky lg:top-[80px] rounded-2xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-teal-50 border-b border-teal-100 flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Đoạn văn</span>
            </div>
            <div className="p-5 max-h-[70vh] overflow-y-auto">
              <RichText as="div" className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap" text={section.passage} />
            </div>
          </div>
          {/* Right: questions */}
          <div className="space-y-3">
            {questionList}
          </div>
        </div>
      ) : (
        questionList
      )}
    </>
  );
}

function PassageBox({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5">
      <RichText as="div" className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap" text={text} />
    </div>
  );
}

function QCardShell({
  n,
  children,
  effective,
  changed,
}: {
  n: number;
  children: React.ReactNode;
  effective?: boolean;
  changed?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl bg-white border p-5 transition-colors ${
        changed ? 'border-amber-300 ring-1 ring-amber-100' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-teal-600 text-white text-[13px] font-bold tabular-nums">
          {n}
        </span>
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">Câu {n}</h3>
        {effective !== undefined && (
          <span className="ml-auto">
            {effective ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đúng
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 text-[11px] font-bold">
                <XCircle className="w-3.5 h-3.5" /> Sai
              </span>
            )}
          </span>
        )}
      </div>
      {children}
    </article>
  );
}

// Toggle Đúng/Sai cho 1 mục.
function CorrectToggle({
  effective,
  changed,
  onSet,
}: {
  effective: boolean;
  changed: boolean;
  onSet: (v: boolean) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 flex-shrink-0">
      <button
        type="button"
        onClick={() => onSet(true)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
          effective
            ? 'bg-emerald-500 text-white'
            : 'bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'
        }`}
      >
        <CheckCircle2 className="w-3.5 h-3.5" /> Đúng
      </button>
      <button
        type="button"
        onClick={() => onSet(false)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
          !effective
            ? 'bg-red-500 text-white'
            : 'bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-600'
        }`}
      >
        <XCircle className="w-3.5 h-3.5" /> Sai
      </button>
      {changed && (
        <span className="text-[10px] font-bold text-amber-600 ml-0.5" title="Đã chỉnh">
          ✎
        </span>
      )}
    </div>
  );
}

function ObjectiveQuestionCard({
  q,
  sid,
  answerOverride,
  correctOverride,
  onToggle,
  onSetCorrect,
}: {
  q: ObjectiveQuestion;
  sid: string;
  answerOverride: Record<string, boolean>;
  correctOverride: Record<string, string>;
  onToggle: ToggleFn;
  onSetCorrect: SetCorrectFn;
}) {
  switch (q.kind) {
    case 'mcq':
      return (
        <McqReview
          q={q}
          sid={sid}
          answerOverride={answerOverride}
          correctOverride={correctOverride}
          onToggle={onToggle}
          onSetCorrect={onSetCorrect}
        />
      );
    case 'text':
      return <TextReview q={q} sid={sid} answerOverride={answerOverride} onToggle={onToggle} />;
    case 'tf_group':
      return <TfGroupReview q={q} sid={sid} answerOverride={answerOverride} onToggle={onToggle} />;
    case 'matching':
      return <MatchingReview q={q} sid={sid} answerOverride={answerOverride} onToggle={onToggle} />;
    case 'sentence_insertion':
      return <SentenceInsertionReview q={q} sid={sid} answerOverride={answerOverride} onToggle={onToggle} />;
    default:
      return null;
  }
}

function McqReview({
  q,
  sid,
  answerOverride,
  correctOverride,
  onToggle,
  onSetCorrect,
}: {
  q: McqQuestion;
  sid: string;
  answerOverride: Record<string, boolean>;
  correctOverride: Record<string, string>;
  onToggle: ToggleFn;
  onSetCorrect: SetCorrectFn;
}) {
  const key = `${sid}-${q.question_number}`;
  const effectiveCorrectId =
    key in correctOverride ? correctOverride[key] : q.correct_answer;
  const correctChanged = key in correctOverride;
  // Hiệu lực đúng/sai: ưu tiên toggle, sau đó so student vs đáp án đúng (đã đổi).
  const effective =
    key in answerOverride
      ? answerOverride[key]
      : String(q.student_answer) === String(effectiveCorrectId);
  const changed = key in answerOverride || correctChanged;

  return (
    <QCardShell n={q.question_number} effective={effective} changed={changed}>
      {q.prompt && (
        <RichText as="p" className="text-sm text-slate-800 leading-relaxed font-medium mb-3" text={q.prompt} />
      )}

      <div className="space-y-2">
        {q.options.map((opt) => {
          const picked = String(q.student_answer) === String(opt.id);
          const isCorrect = String(effectiveCorrectId) === String(opt.id);
          const wasOriginalCorrect = String(q.correct_answer) === String(opt.id);
          const border = isCorrect
            ? 'border-emerald-400 bg-emerald-50'
            : picked
              ? 'border-red-400 bg-red-50'
              : 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/40';
          const badge = isCorrect
            ? 'bg-emerald-500 text-white'
            : picked
              ? 'bg-red-500 text-white'
              : 'bg-slate-100 text-slate-500';
          return (
            <button
              type="button"
              key={opt.id}
              onClick={() => onSetCorrect(sid, q.question_number, String(opt.id), q.correct_answer)}
              title="Bấm để đặt làm đáp án đúng"
              className={`w-full text-left flex items-center gap-3 rounded-xl border p-3 transition-colors cursor-pointer ${border}`}
            >
              <span
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${badge}`}
              >
                {opt.id}
              </span>
              <span className="flex-1 min-w-0 text-sm text-slate-800">
                {opt.text ? (() => {
                  // Render phần gạch chân của từ ngữ âm với italic+teal (nhất quán với student view).
                  // Trọng âm: KHÔNG tự dò đuôi ed/s/es — chỉ nhấn khi giáo viên đã đánh dấu.
                  const isStress = q.variant === 'stress';
                  const parts = splitPhoneticWord(opt.text, opt.underline, !isStress, opt.underlineStart);
                  if (!parts.mark) return <RichText text={opt.text} />;
                  return (
                    <>
                      {parts.before}
                      <span className="italic underline underline-offset-2 decoration-2 font-semibold text-teal-700">
                        {parts.mark}
                      </span>
                      {parts.after}
                    </>
                  );
                })() : <span className="text-slate-300">…</span>}
              </span>
              {isCorrect && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 flex-shrink-0">
                  {correctChanged && wasOriginalCorrect === false ? 'ĐÁP ÁN MỚI' : 'ĐÁP ÁN'}
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              )}
              {picked && !isCorrect && <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
              {correctChanged && wasOriginalCorrect && !isCorrect && (
                <span className="text-[10px] font-semibold text-slate-400 flex-shrink-0">đáp án cũ</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          {q.student_answer == null ? (
            <span className="italic">Học viên chưa trả lời câu này.</span>
          ) : (
            <span>
              Học viên chọn: <b className="text-slate-600">{String(q.student_answer)}</b>
            </span>
          )}
          {correctChanged && (
            <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
              <Pencil className="w-3 h-3" /> đã đổi đáp án đúng
            </span>
          )}
        </div>
        <CorrectToggle
          effective={effective}
          changed={key in answerOverride}
          onSet={(v) => onToggle(key, v, String(q.student_answer) === String(effectiveCorrectId))}
        />
      </div>
    </QCardShell>
  );
}

function TextReview({
  q,
  sid,
  answerOverride,
  onToggle,
}: {
  q: TextQuestion;
  sid: string;
  answerOverride: Record<string, boolean>;
  onToggle: ToggleFn;
}) {
  const key = `${sid}-${q.question_number}`;
  const effective = key in answerOverride ? answerOverride[key] : q.is_correct;
  const prompt =
    q.prompt ||
    [q.lead_in, q.prompt_word ? `(dùng từ: ${q.prompt_word})` : '', q.root_word ? `(${q.root_word})` : '']
      .filter(Boolean)
      .join(' ');
  return (
    <QCardShell n={q.question_number} effective={effective} changed={key in answerOverride}>
      {prompt && <RichText as="p" className="text-sm text-slate-800 leading-relaxed font-medium mb-3" text={prompt} />}
      <div className="space-y-2">
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Học viên trả lời
          </p>
          <div
            className={`px-3.5 py-2.5 rounded-xl text-sm border-l-4 ${
              effective
                ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                : 'bg-red-50 border-red-400 text-red-800'
            }`}
          >
            {q.student_answer != null && String(q.student_answer).trim() !== '' ? (
              String(q.student_answer)
            ) : (
              <span className="text-slate-400 italic">(bỏ trống)</span>
            )}
          </div>
        </div>
        {q.accepted_answers.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Đáp án đúng
            </p>
            <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border-l-4 border-emerald-400 text-sm text-emerald-800">
              {q.accepted_answers.join(' / ')}
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end mt-3 pt-3 border-t border-slate-100">
        <CorrectToggle
          effective={effective}
          changed={key in answerOverride}
          onSet={(v) => onToggle(key, v, q.is_correct)}
        />
      </div>
    </QCardShell>
  );
}

function TfGroupReview({
  q,
  sid,
  answerOverride,
  onToggle,
}: {
  q: TfGroupQuestion;
  sid: string;
  answerOverride: Record<string, boolean>;
  onToggle: ToggleFn;
}) {
  return (
    <QCardShell n={q.question_number}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(q.context || q.context_paragraph_ref) && (
          <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-4">
            {q.context_style && (
              <div className="text-[11px] font-bold uppercase tracking-wider text-teal-700 mb-1">
                {q.context_style}
              </div>
            )}
            {q.context_paragraph_ref && (
              <p className="text-xs italic text-slate-500 mb-1">{q.context_paragraph_ref}</p>
            )}
            {q.context && (
              <pre className="whitespace-pre-wrap text-sm text-slate-800 font-mono leading-relaxed">
                {q.context}
              </pre>
            )}
          </div>
        )}
        <div className="space-y-2">
          {q.statements.map((s, i) => {
            const key = `${sid}-${q.question_number}-s${i}`;
            const effective = key in answerOverride ? answerOverride[key] : s.is_correct;
            const studentLabel = s.student_answer == null ? '—' : s.student_answer ? 'Đúng' : 'Sai';
            const correctLabel = s.correct_answer ? 'Đúng' : 'Sai';
            return (
              <div
                key={s.key}
                className={`rounded-lg border p-3 ${
                  effective ? 'border-emerald-300 bg-emerald-50/50' : 'border-red-300 bg-red-50/50'
                }`}
              >
                <p className="text-sm text-slate-800 leading-snug mb-2">{s.text}</p>
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <span className="text-slate-500">
                    Học viên:{' '}
                    <b className={effective ? 'text-emerald-700' : 'text-red-700'}>{studentLabel}</b>
                  </span>
                  <span className="text-slate-500">
                    Đáp án: <b className="text-emerald-700">{correctLabel}</b>
                  </span>
                  <div className="ml-auto">
                    <CorrectToggle
                      effective={effective}
                      changed={key in answerOverride}
                      onSet={(v) => onToggle(key, v, s.is_correct)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </QCardShell>
  );
}

function MatchingReview({
  q,
  sid,
  answerOverride,
  onToggle,
}: {
  q: MatchingQuestion;
  sid: string;
  answerOverride: Record<string, boolean>;
  onToggle: ToggleFn;
}) {
  return (
    <QCardShell n={q.question_number}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          {q.rows.map((row, i) => {
            const key = `${sid}-${q.question_number}-r${i}`;
            const effective = key in answerOverride ? answerOverride[key] : row.is_correct;
            return (
              <div
                key={row.key}
                className={`rounded-lg border p-2.5 ${
                  effective ? 'border-emerald-300 bg-emerald-50/50' : 'border-red-300 bg-red-50/50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-slate-500 w-5 mt-1">{row.index}.</span>
                  <p className="flex-1 text-sm text-slate-800 leading-snug">{row.text}</p>
                  <span
                    className={`w-8 text-sm font-bold text-center rounded-md py-0.5 ${
                      effective ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {row.student_answer || '—'}
                  </span>
                  {!effective && (
                    <span className="text-xs font-bold text-emerald-700 whitespace-nowrap mt-1">
                      ➜ {row.correct_answer}
                    </span>
                  )}
                </div>
                <div className="flex justify-end mt-1.5">
                  <CorrectToggle
                    effective={effective}
                    changed={key in answerOverride}
                    onSet={(v) => onToggle(key, v, row.is_correct)}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3 space-y-2">
          {q.list_2.map((line, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-xs font-bold text-teal-700 w-5 mt-0.5">{LETTERS[i]}.</span>
              <p className="flex-1 text-sm text-slate-700 leading-snug">{line}</p>
            </div>
          ))}
        </div>
      </div>
    </QCardShell>
  );
}

function SentenceInsertionReview({
  q,
  sid,
  answerOverride,
  onToggle,
}: {
  q: SentenceInsertionQuestion;
  sid: string;
  answerOverride: Record<string, boolean>;
  onToggle: ToggleFn;
}) {
  const key = `${sid}-${q.question_number}`;
  const effective = key in answerOverride ? answerOverride[key] : q.is_correct;
  return (
    <QCardShell n={q.question_number} effective={effective} changed={key in answerOverride}>
      {q.prompt && <RichText as="p" className="text-sm text-slate-800 font-medium mb-2" text={q.prompt} />}
      <blockquote className="border-l-4 border-teal-300 pl-3 py-1 italic text-sm text-slate-700 bg-teal-50/40 rounded-r mb-3">
        {q.sentence_to_insert}
      </blockquote>
      <div className="flex items-center gap-2 mb-3">
        {(q.markers.length ? q.markers : ['A', 'B', 'C', 'D']).map((m) => {
          const picked = String(q.student_answer) === m;
          const correct = String(q.correct_answer) === m;
          const cls = correct
            ? 'bg-emerald-500 text-white'
            : picked
              ? 'bg-red-500 text-white'
              : 'bg-white border border-slate-200 text-slate-500';
          return (
            <span key={m} className={`flex-1 py-2 text-sm font-bold rounded-lg text-center ${cls}`}>
              [{m}]
            </span>
          );
        })}
      </div>
      <div className="flex justify-end pt-3 border-t border-slate-100">
        <CorrectToggle
          effective={effective}
          changed={key in answerOverride}
          onSet={(v) => onToggle(key, v, q.is_correct)}
        />
      </div>
    </QCardShell>
  );
}

// ─── Subjective section ─────────────────────────────────────────────────────
function SubjectiveSectionGrading({
  section,
  draft,
  onUpdate,
  onResetToAi,
}: {
  section: GradingSection;
  draft: Record<number, DraftEntry>;
  onUpdate: (qn: number, patch: Partial<DraftEntry>) => void;
  onResetToAi: (qn: number, aiScore: number | null, ai: SubjectiveQuestion['ai']) => void;
}) {
  const questions = section.questions as SubjectiveQuestion[];
  return (
    <>
      {questions.map((q) => (
        <SubjectiveQuestionCard
          key={`${section.section_id}-${q.question_number}`}
          q={q}
          entry={draft[q.question_number]}
          onUpdate={onUpdate}
          onResetToAi={onResetToAi}
        />
      ))}
    </>
  );
}

function SubjectiveQuestionCard({
  q,
  entry,
  onUpdate,
  onResetToAi,
}: {
  q: SubjectiveQuestion;
  entry: DraftEntry | undefined;
  onUpdate: (qn: number, patch: Partial<DraftEntry>) => void;
  onResetToAi: (qn: number, aiScore: number | null, ai: SubjectiveQuestion['ai']) => void;
}) {
  const e = entry ?? { score: '', pronunciation: '', content: '', feedback: '', dirty: false };
  const aiScore = q.ai?.score ?? null;
  const effective = e.score.trim() !== '' && inRange0to10(e.score) ? Number(e.score) : null;

  return (
    <article className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-teal-600 text-white text-[13px] font-bold tabular-nums flex-shrink-0">
            {q.question_number}
          </span>
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">
            Câu {q.question_number} · {q.skill === 'writing' ? 'Viết' : 'Nói'}
          </h3>
        </div>
        {aiScore != null && effective != null && <DiffBadge teacher={effective} ai={aiScore} />}
      </div>

      <div className="px-5 pt-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-teal-50 text-teal-700 ring-1 ring-teal-100 flex-shrink-0">
          <Mic className="w-[18px] h-[18px]" />
        </div>
        <div className="flex-1 min-w-0">
          <RichText as="p" className="text-[15px] font-medium text-slate-800 leading-relaxed" text={q.prompt} />
          <div className="mt-2.5">
            <AudioPlayer url={q.audio_url} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-5">
        <AiReviewPanel q={q} />
        <TeacherOverridePanel q={q} entry={e} onUpdate={onUpdate} onResetToAi={onResetToAi} />
      </div>
    </article>
  );
}

function AiReviewPanel({ q }: { q: SubjectiveQuestion }) {
  const ai = q.ai;
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <Sparkles className="w-3.5 h-3.5 text-teal-600" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">AI đề xuất</span>
      </div>

      {q.status === 'ai_pending' ? (
        <div className="flex items-center gap-2.5 px-4 py-6">
          <Loader2 className="w-4 h-4 animate-spin text-amber-600 flex-shrink-0" />
          <p className="text-sm font-medium text-amber-800">AI đang chấm phần Nói…</p>
        </div>
      ) : !ai ? (
        <div className="flex items-center gap-2.5 px-4 py-6">
          <XCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <p className="text-sm font-medium text-slate-500">Chưa có kết quả AI cho câu này.</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-teal-50/60 to-white border-b border-slate-100">
            <div
              className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 text-white"
              style={{ background: scoreToColor(ai.score ?? 0) }}
            >
              <span className="text-lg font-extrabold leading-none tabular-nums">
                {(ai.score ?? 0).toFixed(1)}
              </span>
              <span className="text-[9px] font-bold opacity-85 mt-0.5">/ 10</span>
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
              {ai.criteria?.pronunciation != null && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600">
                  Phát âm{' '}
                  <b className="text-slate-800 tabular-nums">
                    {Number(ai.criteria.pronunciation).toFixed(1)}
                  </b>
                </span>
              )}
              {ai.criteria?.content != null && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600">
                  Nội dung{' '}
                  <b className="text-slate-800 tabular-nums">{Number(ai.criteria.content).toFixed(1)}</b>
                </span>
              )}
            </div>
          </div>
          <div className="p-4 space-y-3">
            {ai.feedback && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Nhận xét
                </p>
                <p className="text-sm text-slate-700 leading-relaxed">{ai.feedback}</p>
              </div>
            )}
            {ai.suggestions.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Gợi ý cải thiện
                </p>
                <ul className="space-y-1.5">
                  {ai.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                      <span className="leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ai.transcript && (
              <details className="group">
                <summary className="text-[11px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer select-none hover:text-teal-700 transition-colors">
                  Lời học viên đã nói (AI nghe được)
                </summary>
                <p className="mt-1.5 text-sm text-slate-600 italic leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100">
                  “{ai.transcript}”
                </p>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TeacherOverridePanel({
  q,
  entry,
  onUpdate,
  onResetToAi,
}: {
  q: SubjectiveQuestion;
  entry: DraftEntry;
  onUpdate: (qn: number, patch: Partial<DraftEntry>) => void;
  onResetToAi: (qn: number, aiScore: number | null, ai: SubjectiveQuestion['ai']) => void;
}) {
  const qn = q.question_number;
  const hasAi = q.ai?.score != null;
  const scoreInvalid = entry.score.trim() !== '' && !inRange0to10(entry.score);

  return (
    <div className="rounded-xl border border-teal-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-teal-50 border-b border-teal-100">
        <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
          Giáo viên chấm
        </span>
        {hasAi && (
          <button
            type="button"
            onClick={() => onResetToAi(qn, q.ai?.score ?? null, q.ai)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Dùng điểm AI
          </button>
        )}
      </div>
      <div className="p-4 space-y-3.5">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
            Điểm cuối {hasAi ? '(mặc định = AI)' : ''}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={entry.score}
              placeholder={hasAi ? undefined : 'Chưa có đề xuất từ AI'}
              onChange={(ev) => onUpdate(qn, { score: ev.target.value })}
              className={`w-24 px-3 py-1.5 rounded-xl border text-sm font-bold tabular-nums focus:outline-none focus:ring-2 ${
                scoreInvalid
                  ? 'border-red-400 bg-red-50 focus:ring-red-200'
                  : 'border-slate-200 bg-slate-50 focus:ring-teal-200'
              }`}
            />
            <span className="text-sm text-slate-400 font-semibold">/ 10</span>
          </div>
          {scoreInvalid && (
            <p className="text-[11px] text-red-600 font-medium mt-1">Điểm phải trong khoảng 0–10.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <CriteriaInput
            label="Phát âm"
            value={entry.pronunciation}
            onChange={(v) => onUpdate(qn, { pronunciation: v })}
          />
          <CriteriaInput
            label="Nội dung"
            value={entry.content}
            onChange={(v) => onUpdate(qn, { content: v })}
          />
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
            Nhận xét của giáo viên
          </label>
          <textarea
            value={entry.feedback}
            onChange={(ev) => onUpdate(qn, { feedback: ev.target.value })}
            rows={3}
            placeholder="Nhận xét riêng cho câu này…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-200 resize-y"
          />
        </div>
      </div>
    </div>
  );
}

function CriteriaInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const invalid = value.trim() !== '' && !inRange0to10(value);
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
        {label}
      </label>
      <input
        type="number"
        min={0}
        max={10}
        step={0.5}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        className={`w-full px-3 py-1.5 rounded-xl border text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 ${
          invalid
            ? 'border-red-400 bg-red-50 focus:ring-red-200'
            : 'border-slate-200 bg-slate-50 focus:ring-teal-200'
        }`}
      />
    </div>
  );
}

function DiffBadge({ teacher, ai }: { teacher: number; ai: number }) {
  const delta = Math.round((teacher - ai) * 10) / 10;
  if (delta === 0) return null;
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
        up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
      }`}
    >
      {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {up ? '+' : ''}
      {delta.toFixed(1)} so với AI
    </span>
  );
}

function AudioPlayer({ url }: { url: string | null }) {
  const [errored, setErrored] = useState(false);
  const fullUrl = getFullMediaUrl(url);

  if (!url || !fullUrl) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <XCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <p className="text-xs font-medium text-slate-500">Học viên chưa ghi âm câu này.</p>
      </div>
    );
  }

  if (errored) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        <p className="text-xs font-medium text-red-700">Không tải được bản ghi âm.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Volume2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
      <audio controls src={fullUrl} onError={() => setErrored(true)} className="w-full h-9 max-w-md" />
    </div>
  );
}

// ─── Publish confirm dialog ─────────────────────────────────────────────────
function PublishConfirmDialog({
  onCancel,
  onConfirm,
  saving,
  finalScore,
  scaleMax,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  saving: boolean;
  finalScore: number;
  scaleMax: number;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-w-md w-full rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">Phát hành kết quả?</h3>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center justify-center gap-2 mb-4 py-3 rounded-xl bg-teal-50">
            <span className="text-sm font-semibold text-slate-600">Điểm cuối:</span>
            <span
              className="text-2xl font-extrabold tabular-nums"
              style={{ color: scoreToColor(finalScore) }}
            >
              {finalScore.toFixed(2)}
            </span>
            <span className="text-sm font-bold text-slate-400">/ {scaleMax}</span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Học viên sẽ nhận thông báo và thấy điểm cùng nhận xét bạn đã chốt. Bạn vẫn có thể chấm
            lại sau.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 bg-slate-50 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Xác nhận phát hành
          </button>
        </div>
      </div>
    </div>
  );
}

export default ThptGradingDetail;

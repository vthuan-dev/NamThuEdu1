import { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import { useToastContext } from '../../../../contexts/ToastContext';
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

interface Props {
  submissionId: number;
}

// Per-question editable draft, kept separate from AI data.
interface DraftEntry {
  score: string; // string to allow partial typing; validated on save
  pronunciation: string;
  content: string;
  feedback: string;
  dirty: boolean;
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

export function ThptGradingDetail({ submissionId }: Props) {
  const navigate = useNavigate();
  const toast = useToastContext();

  const [page, setPage] = useState<'loading' | 'error' | 'ready'>('loading');
  const [data, setData] = useState<GradingData | null>(null);
  const [draft, setDraft] = useState<Record<number, DraftEntry>>({});
  const [overallFeedback, setOverallFeedback] = useState('');
  const [overrideScore, setOverrideScore] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
        setOverrideScore(
          d.teacher_override_score !== null && d.teacher_override_score !== undefined
            ? String(d.teacher_override_score)
            : '',
        );
        setDraft(buildInitialDraft(d));
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

  // Build the questions payload — only those with a usable score.
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

  const doPublish = async () => {
    setConfirmOpen(false);
    // Validate all entered scores 0–10 (Req 4.3).
    const invalid = Object.values(draft).some((e) => e.dirty && e.score.trim() !== '' && !inRange0to10(e.score));
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
      // Sync back from the server but keep local draft intact for safety.
      if (res) {
        setData((prev) => (prev ? { ...prev, ...res } : res));
      }
      toast.success('Đã lưu và phát hành kết quả cho học viên.');
      navigate('/giao-vien/cham-diem');
    } catch (err: any) {
      // On error, keep draft + overallFeedback intact (Req 6.6).
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
              onClick={() => navigate('/giao-vien/cham-diem')}
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

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/giao-vien/cham-diem')}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900 truncate">{data.exam.title ?? 'Đề THPT'}</h1>
            <p className="text-xs text-slate-500 truncate">
              {data.student.name ?? 'Học viên'}
              {data.status === 'graded' && (
                <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[10px] font-bold">
                  Đã phát hành
                </span>
              )}
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tổng điểm</span>
            <span className="text-lg font-bold text-slate-900 tabular-nums leading-none">
              {data.current_total != null ? Number(data.current_total).toFixed(1) : '—'}
              <span className="text-xs text-slate-400">/{obj.scale_max ?? 10}</span>
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
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Objective summary hero */}
        <section className="rounded-2xl p-5 bg-white border border-slate-200">
          <div className="flex flex-wrap items-center gap-6">
            <ScorePill label="Điểm khách quan" value={obj.scaled_score} max={obj.scale_max ?? 10} />
            <div className="text-sm text-slate-500">
              Điểm thô:{' '}
              <b className="text-slate-700 tabular-nums">
                {obj.raw_score ?? 0}/{obj.raw_score_max ?? 0}
              </b>
            </div>
            {data.ai_speaking_pending && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI đang chấm phần Nói
              </span>
            )}
          </div>

          {/* Điểm tổng ghi đè — giáo viên nhập điểm cuối (0–10), thắng điểm tự động.
              Áp dụng cho mọi đề THPT kể cả đề toàn trắc nghiệm. */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-teal-600" />
              <label className="text-sm font-semibold text-slate-700">Điểm tổng (ghi đè)</label>
            </div>
            <input
              type="number"
              min={0}
              max={10}
              step={0.25}
              value={overrideScore}
              onChange={(e) => setOverrideScore(e.target.value)}
              placeholder={data.current_total != null ? String(Number(data.current_total).toFixed(2)) : 'Tự động'}
              className={`w-28 rounded-lg border px-3 py-1.5 text-sm font-bold text-slate-800 tabular-nums focus:outline-none focus:ring-2 ${
                overrideScore.trim() !== '' && !inRange0to10(overrideScore)
                  ? 'border-red-300 focus:ring-red-200'
                  : 'border-slate-200 focus:ring-teal-200'
              }`}
            />
            <span className="text-xs text-slate-400">/ {obj.scale_max ?? 10}</span>
            {overrideScore.trim() !== '' && (
              <button
                type="button"
                onClick={() => setOverrideScore('')}
                className="text-xs font-semibold text-slate-400 hover:text-teal-600 transition-colors cursor-pointer"
              >
                Dùng điểm tự động
              </button>
            )}
            {overrideScore.trim() !== '' && !inRange0to10(overrideScore) && (
              <span className="text-xs font-semibold text-red-500">Điểm phải trong khoảng 0–10</span>
            )}
            <p className="w-full text-[11px] text-slate-400 mt-0.5">
              Để trống = dùng điểm hệ thống tự chấm. Nhập điểm để ghi đè điểm cuối cho học viên.
            </p>
          </div>
        </section>

        {/* Sections in order */}
        {data.sections.map((section, idx) =>
          section.kind === 'subjective' ? (
            <SubjectiveSectionGrading
              key={section.section_id ?? `s-${idx}`}
              section={section}
              draft={draft}
              onUpdate={updateDraft}
              onResetToAi={resetToAi}
            />
          ) : (
            <ObjectiveSectionReview key={section.section_id ?? `s-${idx}`} section={section} />
          ),
        )}

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
      </main>

      {confirmOpen && (
        <PublishConfirmDialog onCancel={() => setConfirmOpen(false)} onConfirm={doPublish} saving={saving} />
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
      dirty: Boolean(teacher), // already-overridden questions start "dirty"
    };
  };
  // Prefer the structured sections; fall back to flat list.
  const fromSections = d.sections.flatMap((s) =>
    s.kind === 'subjective' ? (s.questions as SubjectiveQuestion[]) : [],
  );
  const list = fromSections.length ? fromSections : d.subjective_questions ?? [];
  list.forEach(collect);
  return draft;
}

// ─── Shared score pill ──────────────────────────────────────────────────────
function ScorePill({ label, value, max }: { label: string; value: number | null; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-14 h-14 rounded-2xl bg-teal-600 flex flex-col items-center justify-center text-white flex-shrink-0">
        <span className="text-lg font-extrabold leading-none tabular-nums">
          {value != null ? Number(value).toFixed(1) : '—'}
        </span>
        <span className="text-[9px] font-bold opacity-85 mt-0.5">/ {max}</span>
      </div>
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
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
  rightSlot,
}: {
  section: GradingSection;
  rightSlot?: React.ReactNode;
}) {
  const typeLabel = TYPE_LABEL[section.type] ?? 'Phần thi';
  return (
    <header className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 pl-6">
      <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-teal-600" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-teal-700 mb-1.5">
            {typeLabel}
          </span>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-snug">{section.title}</h2>
          {section.instructions && (
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed max-w-2xl">{section.instructions}</p>
          )}
        </div>
        {rightSlot}
      </div>
    </header>
  );
}

// ─── Objective section (read-only review) ───────────────────────────────────
function ObjectiveSectionReview({ section }: { section: GradingSection }) {
  const questions = section.questions as ObjectiveQuestion[];
  return (
    <section className="space-y-4">
      <SectionHeader
        section={section}
        rightSlot={
          section.score ? (
            <div className="flex flex-col items-end flex-shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Điểm phần này</span>
              <span className="text-base font-bold text-slate-900 tabular-nums leading-tight">
                {section.score.correct_count}
                <span className="text-slate-400 font-normal text-sm">/{section.score.total_count}</span>
              </span>
            </div>
          ) : undefined
        }
      />

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

      {section.passage && <PassageBox text={section.passage} />}

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

      {questions.map((q) => (
        <ObjectiveQuestionCard key={`${section.section_id}-${q.question_number}`} q={q} />
      ))}
    </section>
  );
}

function PassageBox({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5">
      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{text}</p>
    </div>
  );
}

function QCardShell({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <article className="rounded-2xl bg-white border border-slate-200 p-5">
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-teal-600 text-white text-[13px] font-bold tabular-nums">
          {n}
        </span>
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">Câu {n}</h3>
      </div>
      {children}
    </article>
  );
}

function CorrectnessBadge({ isCorrect }: { isCorrect: boolean }) {
  return isCorrect ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold">
      <CheckCircle2 className="w-3.5 h-3.5" /> Đúng
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 text-[11px] font-bold">
      <XCircle className="w-3.5 h-3.5" /> Sai
    </span>
  );
}

function ObjectiveQuestionCard({ q }: { q: ObjectiveQuestion }) {
  switch (q.kind) {
    case 'mcq':
      return <McqReview q={q} />;
    case 'text':
      return <TextReview q={q} />;
    case 'tf_group':
      return <TfGroupReview q={q} />;
    case 'matching':
      return <MatchingReview q={q} />;
    case 'sentence_insertion':
      return <SentenceInsertionReview q={q} />;
    default:
      return null;
  }
}

function McqReview({ q }: { q: McqQuestion }) {
  return (
    <QCardShell n={q.question_number}>
      <div className="flex items-center justify-between gap-2 mb-3">
        {q.prompt ? (
          <p className="text-sm text-slate-800 leading-relaxed font-medium flex-1">{q.prompt}</p>
        ) : (
          <span />
        )}
        <CorrectnessBadge isCorrect={q.is_correct} />
      </div>
      <div className="space-y-2">
        {q.options.map((opt) => {
          const picked = String(q.student_answer) === String(opt.id);
          const correct = String(q.correct_answer) === String(opt.id);
          const border = correct
            ? 'border-emerald-400 bg-emerald-50'
            : picked
              ? 'border-red-400 bg-red-50'
              : 'border-slate-200';
          const badge = correct
            ? 'bg-emerald-500 text-white'
            : picked
              ? 'bg-red-500 text-white'
              : 'bg-slate-100 text-slate-500';
          return (
            <div key={opt.id} className={`flex items-center gap-3 rounded-xl border p-3 ${border}`}>
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${badge}`}>
                {opt.id}
              </span>
              <span className="flex-1 min-w-0 text-sm text-slate-800">
                {opt.text || <span className="text-slate-300">…</span>}
                {opt.underline && <span className="block text-[11px] text-slate-500">[{opt.underline}]</span>}
              </span>
              {correct && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
              {picked && !correct && <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
            </div>
          );
        })}
      </div>
      {q.student_answer == null && (
        <p className="text-xs text-slate-400 italic mt-2">Học viên chưa trả lời câu này.</p>
      )}
    </QCardShell>
  );
}

function TextReview({ q }: { q: TextQuestion }) {
  const prompt =
    q.prompt ||
    [q.lead_in, q.prompt_word ? `(dùng từ: ${q.prompt_word})` : '', q.root_word ? `(${q.root_word})` : '']
      .filter(Boolean)
      .join(' ');
  return (
    <QCardShell n={q.question_number}>
      <div className="flex items-center justify-between gap-2 mb-3">
        {prompt ? <p className="text-sm text-slate-800 leading-relaxed font-medium flex-1">{prompt}</p> : <span />}
        <CorrectnessBadge isCorrect={q.is_correct} />
      </div>
      <div className="space-y-2">
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Học viên trả lời</p>
          <div
            className={`px-3.5 py-2.5 rounded-xl text-sm border-l-4 ${
              q.is_correct ? 'bg-emerald-50 border-emerald-400 text-emerald-800' : 'bg-red-50 border-red-400 text-red-800'
            }`}
          >
            {q.student_answer != null && String(q.student_answer).trim() !== '' ? (
              String(q.student_answer)
            ) : (
              <span className="text-slate-400 italic">(bỏ trống)</span>
            )}
          </div>
        </div>
        {!q.is_correct && q.accepted_answers.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Đáp án đúng</p>
            <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border-l-4 border-emerald-400 text-sm text-emerald-800">
              {q.accepted_answers.join(' / ')}
            </div>
          </div>
        )}
      </div>
    </QCardShell>
  );
}

function TfGroupReview({ q }: { q: TfGroupQuestion }) {
  return (
    <QCardShell n={q.question_number}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(q.context || q.context_paragraph_ref) && (
          <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-4">
            {q.context_style && (
              <div className="text-[11px] font-bold uppercase tracking-wider text-teal-700 mb-1">{q.context_style}</div>
            )}
            {q.context_paragraph_ref && (
              <p className="text-xs italic text-slate-500 mb-1">{q.context_paragraph_ref}</p>
            )}
            {q.context && (
              <pre className="whitespace-pre-wrap text-sm text-slate-800 font-mono leading-relaxed">{q.context}</pre>
            )}
          </div>
        )}
        <div className="space-y-2">
          {q.statements.map((s) => {
            const studentLabel = s.student_answer == null ? '—' : s.student_answer ? 'Đúng' : 'Sai';
            const correctLabel = s.correct_answer ? 'Đúng' : 'Sai';
            return (
              <div
                key={s.key}
                className={`rounded-lg border p-3 ${
                  s.is_correct ? 'border-emerald-300 bg-emerald-50/50' : 'border-red-300 bg-red-50/50'
                }`}
              >
                <p className="text-sm text-slate-800 leading-snug mb-1.5">{s.text}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500">
                    Học viên: <b className={s.is_correct ? 'text-emerald-700' : 'text-red-700'}>{studentLabel}</b>
                  </span>
                  {!s.is_correct && (
                    <span className="text-emerald-700 font-semibold">➜ Đáp án: {correctLabel}</span>
                  )}
                  {s.is_correct ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-auto" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-600 ml-auto" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </QCardShell>
  );
}

function MatchingReview({ q }: { q: MatchingQuestion }) {
  return (
    <QCardShell n={q.question_number}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          {q.rows.map((row) => (
            <div
              key={row.key}
              className={`rounded-lg border p-2.5 flex items-start gap-2 ${
                row.is_correct ? 'border-emerald-300 bg-emerald-50/50' : 'border-red-300 bg-red-50/50'
              }`}
            >
              <span className="text-xs font-bold text-slate-500 w-5 mt-1">{row.index}.</span>
              <p className="flex-1 text-sm text-slate-800 leading-snug">{row.text}</p>
              <span
                className={`w-8 text-sm font-bold text-center rounded-md py-0.5 ${
                  row.is_correct ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {row.student_answer || '—'}
              </span>
              {!row.is_correct && (
                <span className="text-xs font-bold text-emerald-700 whitespace-nowrap mt-1">➜ {row.correct_answer}</span>
              )}
            </div>
          ))}
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

function SentenceInsertionReview({ q }: { q: SentenceInsertionQuestion }) {
  return (
    <QCardShell n={q.question_number}>
      <div className="flex items-center justify-between gap-2 mb-2">
        {q.prompt ? <p className="text-sm text-slate-800 font-medium flex-1">{q.prompt}</p> : <span />}
        <CorrectnessBadge isCorrect={q.is_correct} />
      </div>
      <blockquote className="border-l-4 border-teal-300 pl-3 py-1 italic text-sm text-slate-700 bg-teal-50/40 rounded-r mb-3">
        {q.sentence_to_insert}
      </blockquote>
      <div className="flex items-center gap-2">
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
    </QCardShell>
  );
}

// ─── Subjective section (AI review + teacher override) ──────────────────────
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
    <section className="space-y-4">
      <SectionHeader section={section} />
      {questions.map((q) => (
        <SubjectiveQuestionCard
          key={`${section.section_id}-${q.question_number}`}
          q={q}
          entry={draft[q.question_number]}
          onUpdate={onUpdate}
          onResetToAi={onResetToAi}
        />
      ))}
    </section>
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
      {/* Card header */}
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

      {/* Prompt + audio */}
      <div className="px-5 pt-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-teal-50 text-teal-700 ring-1 ring-teal-100 flex-shrink-0">
          <Mic className="w-[18px] h-[18px]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-slate-800 leading-relaxed">{q.prompt}</p>
          <div className="mt-2.5">
            <AudioPlayer url={q.audio_url} />
          </div>
        </div>
      </div>

      {/* Two-track panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-5">
        <AiReviewPanel q={q} />
        <TeacherOverridePanel q={q} entry={e} onUpdate={onUpdate} onResetToAi={onResetToAi} />
      </div>
    </article>
  );
}

// ─── AI review panel (read-only) ────────────────────────────────────────────
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
              <span className="text-lg font-extrabold leading-none tabular-nums">{(ai.score ?? 0).toFixed(1)}</span>
              <span className="text-[9px] font-bold opacity-85 mt-0.5">/ 10</span>
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
              {ai.criteria?.pronunciation != null && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600">
                  Phát âm <b className="text-slate-800 tabular-nums">{Number(ai.criteria.pronunciation).toFixed(1)}</b>
                </span>
              )}
              {ai.criteria?.content != null && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600">
                  Nội dung <b className="text-slate-800 tabular-nums">{Number(ai.criteria.content).toFixed(1)}</b>
                </span>
              )}
            </div>
          </div>
          <div className="p-4 space-y-3">
            {ai.feedback && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nhận xét</p>
                <p className="text-sm text-slate-700 leading-relaxed">{ai.feedback}</p>
              </div>
            )}
            {ai.suggestions.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Gợi ý cải thiện</p>
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

// ─── Teacher override panel (editable) ──────────────────────────────────────
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
        <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Giáo viên chấm</span>
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
          {scoreInvalid && <p className="text-[11px] text-red-600 font-medium mt-1">Điểm phải trong khoảng 0–10.</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <CriteriaInput
            label="Phát âm"
            value={entry.pronunciation}
            onChange={(v) => onUpdate(qn, { pronunciation: v })}
          />
          <CriteriaInput label="Nội dung" value={entry.content} onChange={(v) => onUpdate(qn, { content: v })} />
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
      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">{label}</label>
      <input
        type="number"
        min={0}
        max={10}
        step={0.5}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        className={`w-full px-3 py-1.5 rounded-xl border text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 ${
          invalid ? 'border-red-400 bg-red-50 focus:ring-red-200' : 'border-slate-200 bg-slate-50 focus:ring-teal-200'
        }`}
      />
    </div>
  );
}

// ─── Diff badge ─────────────────────────────────────────────────────────────
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

// ─── Audio player ───────────────────────────────────────────────────────────
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
}: {
  onCancel: () => void;
  onConfirm: () => void;
  saving: boolean;
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
          <p className="text-sm text-slate-600 leading-relaxed">
            Học viên sẽ nhận thông báo và thấy điểm cùng nhận xét bạn đã chốt. Bạn vẫn có thể chấm lại sau.
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

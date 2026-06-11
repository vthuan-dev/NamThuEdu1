/**
 * TeensTestTaking — Engine làm bài cho học viên Teens (13–17)
 *
 * Khác bản VSTEP (TestTaking — 4 kỹ năng cứng) và bản Kids (1 câu vui nhộn):
 * - Tông teal/cyan chuyên nghiệp, đồng bộ TeensLayout.
 * - Bố cục 2 cột: nội dung câu hỏi + bảng điều hướng (navigator) cho nhảy câu.
 * - Hỗ trợ ĐA DẠNG dạng câu hỏi: trắc nghiệm, đúng/sai, điền từ, trả lời ngắn,
 *   nối cột (matching), tự luận (essay).
 * - Dùng CHUNG API start/resume/save/submit để đồng bộ backend, không phá luồng.
 *
 * Hợp đồng dữ liệu chấm điểm (backend non-VSTEP):
 * - saAnswer_text được so khớp text với đáp án đúng (aContent), hỗ trợ biến thể "/".
 * - matching: encode "1-b,2-a,3-c" (set-match, không phụ thuộc thứ tự).
 * - essay: lưu lại, giáo viên chấm tay.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Volume2, AlertTriangle,
  Flag, Clock, ListChecks, Loader2, PenLine, Send,
} from 'lucide-react';
import { studentApi } from '../../../../services/studentApi';

const BASE = '/hoc-vien';
const TEAL = '#0D9488';
const TEAL_MID = '#14B8A6';

// ─── Helpers đọc dữ liệu (đồng bộ với TestTaking/KidsTestTaking) ───────────────
function getQuestionId(q: any): string {
  return String(q?.qId ?? q?.id ?? '');
}

function getOptions(q: any) {
  if (Array.isArray(q?.options)) {
    return q.options.map((opt: any, idx: number) => ({
      id: String(opt?.id ?? idx + 1),
      label: String(opt?.label ?? String.fromCharCode(65 + idx)),
      content: String(opt?.content ?? ''),
      value: String(opt?.content ?? opt?.id ?? idx + 1),
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

// Lấy dữ liệu nối cột từ qData (JSON). Hỗ trợ { left:[], right:[] }.
function getMatchingData(q: any): { left: string[]; right: string[] } | null {
  let data = q?.qData;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return null; }
  }
  if (data && Array.isArray(data.left) && Array.isArray(data.right)) {
    return { left: data.left.map(String), right: data.right.map(String) };
  }
  return null;
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

function normType(q: any): string {
  return String(q?.qType ?? '').toLowerCase();
}

const SECTION_LABELS: Record<string, string> = {
  grammar: 'Ngữ pháp',
  vocabulary: 'Từ vựng',
  reading: 'Đọc hiểu',
  listening: 'Nghe',
  writing: 'Viết',
};

function sectionLabel(s?: string): string {
  const key = String(s ?? '').toLowerCase();
  return SECTION_LABELS[key] ?? (s ? s[0].toUpperCase() + s.slice(1) : 'Phần');
}

// ─── Dialog nộp bài ───────────────────────────────────────────────────────────
function SubmitDialog({ open, total, answered, onConfirm, onCancel, loading }:
  { open: boolean; total: number; answered: number; onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  if (!open) return null;
  const left = total - answered;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
        style={{ animation: 'teensPop 0.2s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
        <style>{`@keyframes teensPop { from { opacity:0; transform: scale(0.96) } to { opacity:1; transform: scale(1) } }`}</style>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: left > 0 ? '#FEF3C7' : '#D1FAE5' }}>
            {left > 0 ? <AlertTriangle className="w-5 h-5 text-amber-600" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Nộp bài thi?</h2>
            <p className="text-sm text-slate-500">
              {left > 0
                ? `Bạn còn ${left}/${total} câu chưa trả lời.`
                : `Bạn đã hoàn thành tất cả ${total} câu.`}
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-500 mb-5">Sau khi nộp, bạn không thể chỉnh sửa câu trả lời. Bạn chắc chắn chứ?</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
            Tiếp tục làm
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl font-bold text-white inline-flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})` }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? 'Đang nộp…' : 'Nộp bài'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Renderer cho từng dạng câu hỏi ───────────────────────────────────────────
function QuestionRenderer({ q, value, onChange }:
  { q: any; value: string; onChange: (v: string) => void }) {
  const type = normType(q);
  const options = getOptions(q);

  // Nối cột (matching)
  if (type === 'matching') {
    const md = getMatchingData(q);
    if (md) {
      // value encode dạng "1-b,2-a"; parse thành map {leftIndex: rightLetter}
      const picked: Record<string, string> = {};
      value.split(',').forEach(tok => {
        const [l, r] = tok.split('-');
        if (l && r) picked[l.trim()] = r.trim();
      });
      const setPick = (leftIdx: number, rightLetter: string) => {
        const next = { ...picked, [String(leftIdx + 1)]: rightLetter };
        const encoded = Object.keys(next)
          .sort((a, b) => Number(a) - Number(b))
          .map(k => `${k}-${next[k]}`)
          .join(',');
        onChange(encoded);
      };
      return (
        <div className="mt-5 space-y-3">
          {md.left.map((leftItem, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: TEAL }}>{i + 1}</span>
              <span className="flex-1 text-[15px] font-medium text-slate-800">{leftItem}</span>
              <select
                value={picked[String(i + 1)] ?? ''}
                onChange={e => setPick(i, e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-teal-400 cursor-pointer"
              >
                <option value="">— chọn —</option>
                {md.right.map((r, j) => (
                  <option key={j} value={String.fromCharCode(97 + j)}>
                    {String.fromCharCode(97 + j)}. {r}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      );
    }
  }

  // Tự luận (essay) — không có option
  if (type === 'essay' || type === 'writing' || (options.length === 0 && (type === 'short_writing'))) {
    const words = value.trim() ? value.trim().split(/\s+/).length : 0;
    return (
      <div className="mt-5">
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Viết câu trả lời của bạn ở đây…"
          className="w-full min-h-[200px] rounded-xl border border-slate-200 p-4 text-[15px] leading-relaxed outline-none focus:border-teal-400 transition-colors resize-y"
        />
        <p className="mt-2 text-xs font-medium text-slate-400">{words} từ</p>
      </div>
    );
  }

  // Điền từ / trả lời ngắn
  if (type === 'fill_blank' || type === 'short_answer' || (options.length === 0)) {
    return (
      <div className="mt-5">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 focus-within:border-teal-400 transition-colors">
          <PenLine className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Nhập câu trả lời…"
            className="flex-1 text-[15px] outline-none bg-transparent text-slate-800"
          />
        </div>
      </div>
    );
  }

  // Đúng/Sai
  if (type === 'true_false') {
    return (
      <div className="mt-5 grid grid-cols-2 gap-3">
        {options.map((opt: any) => {
          const active = value === opt.value;
          return (
            <button key={opt.id} onClick={() => onChange(opt.value)}
              className="rounded-xl border-2 p-4 text-center font-bold text-[15px] transition-all"
              style={{
                borderColor: active ? TEAL : '#E2E8F0',
                background: active ? '#F0FDFA' : '#fff',
                color: active ? TEAL : '#475569',
              }}>
              {opt.content}
            </button>
          );
        })}
      </div>
    );
  }

  // Mặc định: trắc nghiệm (single-select)
  return (
    <div className="mt-5 space-y-2.5">
      {options.map((opt: any) => {
        const active = value === opt.value;
        return (
          <button key={opt.id} onClick={() => onChange(opt.value)}
            className="group w-full flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all"
            style={{
              borderColor: active ? TEAL : '#E2E8F0',
              background: active ? '#F0FDFA' : '#fff',
            }}>
            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors"
              style={{
                background: active ? TEAL : '#F1F5F9',
                color: active ? '#fff' : '#64748B',
              }}>
              {opt.label}
            </span>
            <span className="flex-1 text-[15px] font-medium" style={{ color: active ? '#0F2A28' : '#334155' }}
              dangerouslySetInnerHTML={{ __html: opt.content }} />
            {active && <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: TEAL }} />}
          </button>
        );
      })}
    </div>
  );
}

export function TeensTestTaking() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const assignmentId = Number(id);

  const autoStart = useMemo(() => new URLSearchParams(location.search).get('autostart') === '1', [location.search]);
  const direct = useMemo(() => new URLSearchParams(location.search).get('direct') === '1', [location.search]);
  const querySubmissionId = useMemo(() => {
    const raw = Number(new URLSearchParams(location.search).get('submissionId') ?? 0);
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }, [location.search]);

  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [exam, setExam] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [started, setStarted] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const questions: any[] = exam?.questions ?? [];
  const total = questions.length;
  const q = questions[current];
  const qid = q ? getQuestionId(q) : '';

  const answeredCount = useMemo(
    () => Object.keys(answers).filter(k => String(answers[k] ?? '').trim() !== '').length,
    [answers]
  );

  const startMutation = useMutation({
    mutationFn: async () => {
      // Đề tự do (browse, chưa giao) → start trực tiếp bằng examId, không cần assignment.
      if (direct) {
        return studentApi.startTeensExamDirect(assignmentId);
      }
      const startRes: any = await studentApi.startTest(assignmentId);
      const startData = startRes?.data?.data;
      if (!startData?.exam && (startData?.canResume || querySubmissionId)) {
        return studentApi.resumeTest(assignmentId);
      }
      return startRes;
    },
    onSuccess: (res: any) => {
      const data = res?.data?.data;
      const fetchedExam = data?.exam ?? data?.assignment?.exam;
      if (!fetchedExam || !Array.isArray(fetchedExam.questions)) {
        setLoadError('Không tải được bài thi. Vui lòng thử lại.');
        return;
      }
      setSubmissionId(data?.submissionId ?? querySubmissionId ?? null);
      setExam(fetchedExam);
      const restored = mapSavedAnswers(data?.savedAnswers);
      if (Object.keys(restored).length) setAnswers(restored);
      const mins = Number(data?.timeRemaining ?? 0);
      const dur = Number(fetchedExam?.eDuration_minutes ?? fetchedExam?.exam_duration ?? 30);
      setTimeLeft((mins > 0 ? mins : dur) * 60);
      setStarted(true);
    },
    onError: () => setLoadError('Không kết nối được máy chủ. Vui lòng tải lại trang.'),
  });

  const saveAnswerMutation = useMutation({
    mutationFn: (p: { question_id: number; saAnswer_text: string }) =>
      studentApi.saveAnswer(submissionId!, { question_id: p.question_id, saAnswer_text: p.saAnswer_text } as any),
  });

  const submitMutation = useMutation({
    mutationFn: () => studentApi.submitTest(submissionId!),
    onSuccess: (res: any) => {
      const sid = res?.data?.data?.submissionId ?? submissionId;
      navigate(`${BASE}/ket-qua/${sid}`);
    },
    onError: () => setLoadError('Chưa nộp được bài. Vui lòng thử lại.'),
  });

  useEffect(() => {
    if (!autoStart || started || startMutation.isPending) return;
    startMutation.mutate();
  }, [autoStart, started, startMutation]);

  useEffect(() => {
    if (!started || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(s => {
        if (s <= 1) { clearInterval(timer); submitMutation.mutate(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [started, timeLeft, submitMutation]);

  const handleAnswer = useCallback((value: string) => {
    if (!q) return;
    setAnswers(prev => ({ ...prev, [qid]: value }));
    if (submissionId && q?.qId) {
      saveAnswerMutation.mutate({ question_id: Number(q.qId), saAnswer_text: value });
    }
  }, [q, qid, submissionId, saveAnswerMutation]);

  const toggleFlag = useCallback(() => {
    if (!qid) return;
    setFlagged(prev => ({ ...prev, [qid]: !prev[qid] }));
  }, [qid]);

  const playAudio = () => {
    const url = q?.qMedia_url as string | undefined;
    if (!url) return;
    if (!audioRef.current || audioRef.current.src !== url) audioRef.current = new Audio(url);
    audioRef.current.play().catch(() => undefined);
  };

  // ─── Chưa bắt đầu / loading ─────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          {loadError ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <p className="text-base font-semibold text-slate-700">{loadError}</p>
              <button onClick={() => { setLoadError(null); startMutation.mutate(); }}
                className="px-6 py-2.5 rounded-xl font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})` }}>
                Thử lại
              </button>
            </>
          ) : (
            <>
              <Loader2 className="w-9 h-9 mx-auto animate-spin" style={{ color: TEAL }} />
              <p className="text-base font-semibold text-slate-500">Đang mở bài thi…</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const progress = total > 0 ? Math.round(((current + 1) / total) * 100) : 0;
  const selected = answers[qid] ?? '';
  const isLast = current >= total - 1;
  const isFlagged = !!flagged[qid];

  const statusOf = (i: number): 'answered' | 'flagged' | 'current' | 'empty' => {
    const id = getQuestionId(questions[i]);
    if (i === current) return 'current';
    if (flagged[id]) return 'flagged';
    if (String(answers[id] ?? '').trim() !== '') return 'answered';
    return 'empty';
  };

  return (
    <div className="pb-28 lg:pb-8">
      {/* Header */}
      <div className="sticky top-16 z-30 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">{exam?.eTitle ?? 'Bài thi'}</h1>
            <div className="mt-1.5 flex items-center gap-3">
              <div className="flex-1 max-w-xs h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${TEAL}, ${TEAL_MID})` }} />
              </div>
              <span className="text-xs font-semibold text-slate-400">Câu {current + 1}/{total}</span>
            </div>
          </div>
          <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold tabular-nums"
            style={{ background: timeLeft <= 60 ? '#FEE2E2' : '#F0FDFA', color: timeLeft <= 60 ? '#DC2626' : TEAL }}>
            <Clock className="w-4 h-4" /> {formatClock(timeLeft)}
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5">
        {/* Cột nội dung câu hỏi */}
        <main>
          <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-7">
            {/* Section + flag */}
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                style={{ background: '#F0FDFA', color: TEAL }}>
                {sectionLabel(q?.qSection ?? q?.qSkill)}
              </span>
              <button onClick={toggleFlag}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors"
                style={{
                  background: isFlagged ? '#FEF3C7' : '#F8FAFC',
                  color: isFlagged ? '#B45309' : '#94A3B8',
                }}>
                <Flag className="w-3.5 h-3.5" style={isFlagged ? { fill: '#B45309' } : undefined} />
                {isFlagged ? 'Đã đánh dấu' : 'Đánh dấu'}
              </button>
            </div>

            {/* Audio (nghe) */}
            {q?.qMedia_url && (
              <button onClick={playAudio}
                className="mb-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-transform hover:scale-[1.02] active:scale-95"
                style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})` }}>
                <Volume2 className="w-4 h-4" /> Nghe đoạn ghi âm
              </button>
            )}

            {/* Ảnh */}
            {q?.qImage_url && (
              <img src={q.qImage_url} alt="" className="w-full max-h-72 object-contain rounded-xl mb-4 bg-slate-50" />
            )}

            {/* Đoạn đọc */}
            {(q?.qPassage_text || q?.qPassage) && (
              <div className="mb-4 rounded-xl p-4 text-[15px] leading-7 text-slate-700 bg-slate-50 border border-slate-100"
                dangerouslySetInnerHTML={{ __html: q.qPassage_text || q.qPassage }} />
            )}

            {/* Đề bài */}
            <h2 className="text-base sm:text-lg font-bold leading-snug text-slate-900"
              dangerouslySetInnerHTML={{ __html: q?.qContent ?? `Câu ${current + 1}` }} />

            {/* Renderer theo dạng câu */}
            <QuestionRenderer q={q} value={selected} onChange={handleAnswer} />
          </section>

          {/* Điều hướng dưới (desktop) */}
          <div className="hidden lg:flex items-center gap-3 mt-5">
            <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-40">
              <ArrowLeft className="w-4 h-4" /> Câu trước
            </button>
            {isLast ? (
              <button onClick={() => setShowSubmit(true)}
                className="ml-auto inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white transition-transform hover:scale-[1.02] active:scale-95"
                style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})` }}>
                <Send className="w-4 h-4" /> Nộp bài
              </button>
            ) : (
              <button onClick={() => setCurrent(c => Math.min(total - 1, c + 1))}
                className="ml-auto inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white transition-transform hover:scale-[1.02] active:scale-95"
                style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})` }}>
                Câu tiếp <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </main>

        {/* Cột navigator */}
        <aside className="hidden lg:block">
          <div className="sticky top-36 rounded-2xl bg-white border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ListChecks className="w-4 h-4" style={{ color: TEAL }} />
              <span className="text-sm font-bold text-slate-900">Danh sách câu</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((_, i) => {
                const st = statusOf(i);
                const styleByStatus: Record<string, React.CSSProperties> = {
                  current: { background: TEAL, color: '#fff', boxShadow: `0 0 0 3px #CCFBF1` },
                  answered: { background: '#CCFBF1', color: TEAL },
                  flagged: { background: '#FEF3C7', color: '#B45309' },
                  empty: { background: '#F1F5F9', color: '#94A3B8' },
                };
                return (
                  <button key={i} onClick={() => setCurrent(i)}
                    className="aspect-square rounded-lg text-sm font-bold transition-all hover:scale-105"
                    style={styleByStatus[st]}>
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5 text-xs font-medium text-slate-500">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: '#CCFBF1' }} /> Đã trả lời</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: '#FEF3C7' }} /> Đánh dấu xem lại</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: '#F1F5F9' }} /> Chưa làm</div>
            </div>
            <div className="mt-4 text-center text-sm font-semibold text-slate-600">
              Đã làm {answeredCount}/{total} câu
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom bar (mobile) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold text-slate-600 bg-slate-100 disabled:opacity-40">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="flex-1 text-center text-xs font-bold text-slate-400">{answeredCount}/{total} câu</span>
          {isLast ? (
            <button onClick={() => setShowSubmit(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})` }}>
              <Send className="w-4 h-4" /> Nộp
            </button>
          ) : (
            <button onClick={() => setCurrent(c => Math.min(total - 1, c + 1))}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})` }}>
              Tiếp <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <SubmitDialog
        open={showSubmit}
        total={total}
        answered={answeredCount}
        onCancel={() => setShowSubmit(false)}
        onConfirm={() => submitMutation.mutate()}
        loading={submitMutation.isPending}
      />
    </div>
  );
}

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
  Flag, Clock, ListChecks, Loader2, PenLine, Send, Mic, Square, BookOpen, GripVertical, X, Image as ImageIcon, ZoomIn,
} from 'lucide-react';
import { studentApi } from '../../../../services/studentApi';
import { api } from '../../../../services/api';
import { useExamSession } from '../../../../hooks/exam/useExamSession';
import {
  SaveStatusIndicator,
  OfflineBanner,
  MultiTabWarning,
  ResumeExamModal,
  TimeWarningBanner,
} from '../../../../components/exam';
import { examDraftStorage } from '../../../../lib/exam/examDraftStorage';
import { HighlightablePassage } from '../components/HighlightablePassage';
import { useTextHighlight } from '../../../../hooks/exam/useTextHighlight';
import { RichText } from '../../../../components/ui/RichText';

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

// Câu hỏi dạng nói (Speaking) — học viên ghi âm, AI chấm.
function isSpeakingQuestion(q: any): boolean {
  const t = normType(q);
  const sk = String(q?.qSkill ?? q?.qSection ?? '').toLowerCase();
  return t === 'speaking' || sk === 'speaking';
}

// Đoạn đọc của câu (đọc hiểu). Rỗng nếu không phải dạng có bài đọc.
// Hỗ trợ nhiều nguồn vì đề tạo từ nhiều luồng khác nhau lưu bài đọc ở field khác:
//  - cột chuẩn: qPassage_text / qPassage
//  - alias: passage / passage_text / reading_passage / context
//  - lồng trong qData JSON: { passage } / { reading_passage } / { context }
function getPassage(q: any): string {
  const direct =
    q?.qPassage_text ?? q?.qPassage ??
    q?.passage_text ?? q?.passage ??
    q?.reading_passage ?? q?.context;
  if (direct != null && String(direct).trim() !== '') return String(direct).trim();

  let data = q?.qData;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { data = null; }
  }
  if (data && typeof data === 'object') {
    const fromData =
      data.passage ?? data.passage_text ?? data.reading_passage ?? data.context;
    if (fromData != null && String(fromData).trim() !== '') return String(fromData).trim();
  }
  return '';
}


// Ảnh đề chung (Listening image-block, giống IELTS).
// Lưu trong qData.task_image khi GV upload ảnh cho cả group.
function parseQData(q: any): any {
  let data = q?.qData;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { data = null; }
  }
  return data && typeof data === 'object' ? data : {};
}

function getTaskImage(q: any): string {
  if (!q) return '';
  const direct = q?.qImage_url ?? q?.task_image ?? q?.taskImage;
  if (direct != null && String(direct).trim() !== '') return String(direct).trim();
  const data = parseQData(q);
  const fromData = data.task_image ?? data.taskImage ?? data.image_url ?? data.imageUrl;
  if (fromData != null && String(fromData).trim() !== '') return String(fromData).trim();
  return '';
}

function isListeningSkill(q: any): boolean {
  const sk = String(q?.qSkill ?? q?.qSection ?? '').toLowerCase();
  return sk === 'listening';
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
              <RichText text={opt.content} />
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
            <RichText className="flex-1 text-[15px] font-medium" text={opt.content} />
            {active && <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: TEAL }} />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Recorder cho câu Speaking (teens) ────────────────────────────────────────
function TeensSpeakingRecorder({ submissionId, partNumber, prepSeconds, speakSeconds, recorded, onRecorded }:
  { submissionId: number | null; partNumber: number; prepSeconds: number; speakSeconds: number; recorded: boolean; onRecorded: () => void }) {
  type Phase = 'idle' | 'prep' | 'recording' | 'uploading' | 'done';
  const [phase, setPhase] = useState<Phase>(recorded ? 'done' : 'idle');
  const [left, setLeft] = useState(prepSeconds || speakSeconds);
  const [denied, setDenied] = useState(false);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (mrRef.current?.state === 'recording') mrRef.current.stop();
  }, []);

  const countdown = (secs: number, done: () => void) => {
    setLeft(secs);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setLeft((s) => { if (s <= 1) { if (timerRef.current) window.clearInterval(timerRef.current); done(); return 0; } return s - 1; });
    }, 1000);
  };

  const begin = (stream: MediaStream) => {
    chunksRef.current = [];
    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      setPhase('uploading');
      try {
        if (submissionId) await studentApi.uploadSpeakingAudio(submissionId, partNumber, blob);
        setPhase('done');
        onRecorded();
      } catch { setPhase('idle'); }
    };
    mrRef.current = mr;
    mr.start();
    setPhase('recording');
    countdown(speakSeconds, stop);
  };

  const stop = () => { if (timerRef.current) window.clearInterval(timerRef.current); if (mrRef.current?.state === 'recording') mrRef.current.stop(); };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      if (prepSeconds > 0) { setPhase('prep'); countdown(prepSeconds, () => begin(stream)); }
      else begin(stream);
    } catch { setDenied(true); }
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (phase === 'done') {
    return (
      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        <p className="text-sm font-semibold text-emerald-800">Đã ghi âm xong. Bài nói sẽ được AI chấm sau khi nộp.</p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      {denied && (
        <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
          <strong>Không truy cập được micro.</strong> Hãy cấp quyền và tải lại trang.
        </div>
      )}
      {phase === 'idle' && !denied && (
        <button onClick={start}
          className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm transition-transform hover:scale-[1.01] active:scale-95"
          style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})` }}>
          <Mic className="w-4 h-4" /> {prepSeconds > 0 ? `Chuẩn bị ${prepSeconds}s rồi ghi âm` : 'Bắt đầu ghi âm'}
        </button>
      )}
      {(phase === 'prep' || phase === 'recording') && (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-3 py-2">
            <Clock className={`w-5 h-5 ${phase === 'recording' ? 'text-red-600' : 'text-amber-600'}`} />
            <span className={`text-3xl font-black tabular-nums ${phase === 'recording' ? 'text-red-600' : 'text-amber-600'}`}>{fmt(left)}</span>
          </div>
          <p className="text-center text-xs text-slate-500">
            {phase === 'prep' ? 'Đang chuẩn bị — ghi âm sẽ tự bắt đầu khi hết giờ.' : 'Nói tự nhiên — sẽ tự dừng khi hết giờ.'}
          </p>
          {phase === 'recording' && (
            <button onClick={stop} className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold">
              <Square className="w-3.5 h-3.5 fill-current" /> Dừng sớm
            </button>
          )}
        </div>
      )}
      {phase === 'uploading' && (
        <div className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Đang tải bài ghi âm lên…
        </div>
      )}
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
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [current, setCurrent] = useState(0);
  const [started, setStarted] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resumeDraft, setResumeDraft] = useState<any>(null);
  const [startedAtServer, setStartedAtServer] = useState('');
  const [serverRemainingSec, setServerRemainingSec] = useState<number | null>(null);
  const [serverDeadlineAt, setServerDeadlineAt] = useState<string | null>(null);
  const [showActiveSessionModal, setShowActiveSessionModal] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cardRefs = useRef<Record<number, HTMLElement | null>>({});
  const startAttemptedRef = useRef(false);

  // States responsive di động (Mobile responsive)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<'question' | 'passage'>('question');
  const [isMobilePassageModalOpen, setIsMobilePassageModalOpen] = useState(false);

  /**
   * Chiều cao thật của thanh tiêu đề, để tab switcher dính ngay bên dưới nó.
   *
   * Trước đây offset là `top-[120px]` hardcode (64px header layout + 56px tiêu
   * đề). Con số đó sai theo hai cách: header layout nay đã ẩn khi làm bài, và
   * tiêu đề cao hơn 56px khi tên đề xuống hai dòng trên màn hẹp. Đo bằng
   * ResizeObserver nên tự đúng ở mọi bề rộng.
   */
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerH, setHeaderH] = useState(56);
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setHeaderH(el.offsetHeight));
    ro.observe(el);
    setHeaderH(el.offsetHeight);
    return () => ro.disconnect();
  }, [started]);

  // Khi đổi câu hỏi hiện tại, tự động chuyển tab về hiển thị câu hỏi trên mobile
  useEffect(() => {
    setMobileActiveTab('question');
  }, [current]);

  // ─── Navigator nổi kéo-thả được (giống VSTEP) ────────────────────────────────
  // null = vị trí mặc định (góc phải, sticky). Khi user kéo, lưu toạ độ tuyệt đối.
  const [navPos, setNavPos] = useState<{ x: number; y: number } | null>(null);
  const [navDragging, setNavDragging] = useState(false);
  const navDragRef = useRef<{ dx: number; dy: number } | null>(null);

  const onNavDragStart = useCallback((e: React.MouseEvent) => {
    // Chỉ kéo bằng thanh tiêu đề; bỏ qua khi bấm vào nút câu.
    const panel = (e.currentTarget as HTMLElement).closest('[data-nav-panel]') as HTMLElement | null;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    navDragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setNavDragging(true);
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!navDragging) return;
    const onMove = (e: MouseEvent) => {
      if (!navDragRef.current) return;
      const w = 280, h = 360; // kích thước ước lượng để giữ trong viewport
      const x = Math.min(Math.max(8, e.clientX - navDragRef.current.dx), window.innerWidth - w);
      const y = Math.min(Math.max(72, e.clientY - navDragRef.current.dy), window.innerHeight - 80);
      setNavPos({ x, y });
    };
    const onUp = () => { setNavDragging(false); navDragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [navDragging]);

  const session = useExamSession({
    submissionId,
    examId: exam?.id ?? exam?.eId ?? (direct ? assignmentId : 0),
    durationMinutes: exam?.eDuration_minutes ?? exam?.exam_duration ?? 30,
    startedAtServer,
    serverRemainingSec,
    serverDeadlineAt,
    examType: exam?.exam_type ?? 'TEENS',
    role: 'teens',
    // ✅ F5-resistant: KHÔNG auto-submit khi rời/đóng tab (pagehide cũng fire khi F5).
    // Nếu để true, F5 sẽ gọi /auto-submit → backend nộp & chấm bài luôn, status
    // rời khỏi 'in_progress'; reload sau đó tạo submission MỚI rỗng → mất đáp án.
    // Thay vào đó chỉ lưu nháp (saveDraftOnUnload). Việc nộp do nút Nộp, timeout
    // (timer client + cron) hoặc cron phát hiện bỏ thi đảm nhiệm.
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
      if (direct) {
        return studentApi.startTeensExamDirect(assignmentId);
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
        setLoadError('Không tải được bài thi. Vui lòng thử lại.');
        return;
      }
      const sid = data?.submissionId ?? querySubmissionId ?? null;
      // ✅ Timer F5-resistant: dùng sStart_time từ backend (timestamp tuyệt đối).
      // useExamSession tự lưu deadline vào localStorage theo submissionId,
      // nên F5/reload sẽ tính đúng thời gian còn lại mà không cần sessionStorage.
      if (data?.sStart_time || data?.started_at) {
        setStartedAtServer(data.sStart_time || data.started_at);
      } else {
        setStartedAtServer(new Date().toISOString());
      }
      // Sticky remaining — server-truth (giây) để F5/tiếp tục không đếm lại full
      {
        const rem = data?.time_remaining_seconds ?? (typeof data?.timeRemaining === 'number' && data.timeRemaining > 180 ? data.timeRemaining : (typeof data?.timeRemaining === 'number' ? data.timeRemaining * 60 : null));
        setServerRemainingSec(rem != null && Number.isFinite(Number(rem)) ? Number(rem) : null);
        setServerDeadlineAt(data?.deadline_at ?? null);
      }
      setSubmissionId(sid);
      setExam(fetchedExam);
      if (sid) {
        const restored = mapSavedAnswers(data?.savedAnswers);
        if (Object.keys(restored).length) {
          Object.entries(restored).forEach(([qid, val]) => session.setAnswer(qid, val));
        }
        const draft = examDraftStorage.load(sid);
        if (draft && Object.keys(draft.answers).length > 0) setResumeDraft(draft);
      }
      if (data?.resumed) {
        setShowActiveSessionModal(true);
      }
      setStarted(true);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Không kết nối được máy chủ. Vui lòng tải lại trang.';
      setLoadError(msg);
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => session.submit(),
    onError: () => setLoadError('Chưa nộp được bài. Vui lòng thử lại.'),
  });

  // Xoá localStorage deadline khi nộp bài xong (useExamSession tự handle)
  useEffect(() => {
    const examKey = exam?.id ?? exam?.eId ?? assignmentId;
    if (!examKey || !submitMutation.isSuccess) return;
    // useExamSession đã tự xoá deadline trong localStorage — không cần làm thêm
  }, [exam, assignmentId, submitMutation.isSuccess]);

  useEffect(() => {
    if (!autoStart || started || startMutation.isPending || !!loadError || startAttemptedRef.current) return;
    startAttemptedRef.current = true;
    startMutation.mutate();
  }, [autoStart, started, startMutation, loadError]);

  const { setAnswer: setSessionAnswer } = session;

  const handleAnswer = useCallback((value: string) => {
    if (!q) return;
    setSessionAnswer(qid, value);
  }, [q, qid, setSessionAnswer]);

  // Lưu đáp án cho 1 câu bất kỳ (dùng cho danh sách câu chế độ đọc hiểu).
  const setAnswerFor = useCallback((target: any, value: string) => {
    const tid = getQuestionId(target);
    if (!tid) return;
    setSessionAnswer(tid, value);
  }, [setSessionAnswer]);

  const toggleFlag = useCallback(() => {
    if (!qid) return;
    setFlagged(prev => ({ ...prev, [qid]: !prev[qid] }));
  }, [qid]);

  const toggleFlagFor = useCallback((target: any) => {
    const tid = getQuestionId(target);
    if (!tid) return;
    setFlagged(prev => ({ ...prev, [tid]: !prev[tid] }));
  }, []);

  // Cuộn tới câu hiện tại khi chuyển câu (chế độ đọc hiểu — danh sách câu bên phải).
  useEffect(() => {
    if (!started) return;
    const el = cardRefs.current[current];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [current, started]);

  const playAudio = () => {
    const url = q?.qMedia_url as string | undefined;
    if (!url) return;
    if (!audioRef.current || audioRef.current.src !== url) audioRef.current = new Audio(url);
    audioRef.current.play().catch(() => undefined);
  };

  // ─── Chế độ đọc hiểu / Listening image-block:
  // gom các câu cùng đoạn đọc hoặc cùng ảnh đề, hiển thị content cố định
  // bên trái + danh sách câu cuộn bên phải. ──────────────────────────────────
  const passage = q ? getPassage(q) : '';
  const taskImage = q ? getTaskImage(q) : '';
  const isReading = passage.length > 0;
  // Listening có ảnh đề chung → layout nguyên khối (không trộn với reading)
  const isImageBlock = !isReading && taskImage.length > 0 && isListeningSkill(q);
  const isBlockMode = isReading || isImageBlock;
  const groupIndices: number[] = [];
  if (isReading) {
    for (let i = 0; i < total; i++) {
      if (getPassage(questions[i]) === passage) groupIndices.push(i);
    }
  } else if (isImageBlock) {
    const part = Number(q?.qPart ?? 0);
    for (let i = 0; i < total; i++) {
      const qi = questions[i];
      if (getTaskImage(qi) === taskImage && Number(qi?.qPart ?? 0) === part) {
        groupIndices.push(i);
      }
    }
    // Fallback: cùng ảnh (nếu qPart thiếu)
    if (groupIndices.length === 0) {
      for (let i = 0; i < total; i++) {
        if (getTaskImage(questions[i]) === taskImage) groupIndices.push(i);
      }
    }
  }

  // Text highlighting hook for reading passages - MUST be called before early return
  const highlightHook = useTextHighlight({
    submissionId: submissionId || 0,
    passageId: isReading ? groupIndices[0] || 0 : 0,
    enabled: isReading && !!submissionId,
  });

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
  const selected = String(session.answers[qid] ?? '');
  const isLast = current >= total - 1;
  const isFlagged = !!flagged[qid];

  const statusOf = (i: number): 'answered' | 'flagged' | 'current' | 'empty' => {
    const id = getQuestionId(questions[i]);
    if (i === current) return 'current';
    if (flagged[id]) return 'flagged';
    if (String(session.answers[id] ?? '').trim() !== '') return 'answered';
    return 'empty';
  };

  return (
    <div className="pb-28 lg:pb-8">
      <OfflineBanner online={session.online} pendingCount={session.pendingCount} />
      <TimeWarningBanner
        level={session.warningLevel}
        onDismiss={session.dismissWarning}
        timeRemaining={session.timeRemaining}
      />
      {/* Header */}
      {/* Header.
          `top-0` chứ không phải `top-16`: header của layout học viên đã được ẩn
          khi vào route làm bài (xem utils/examRoutes), nên chừa 64px cho nó sẽ
          để hở một dải trắng ở đỉnh khi cuộn. */}
      <div
        ref={headerRef}
        className="sticky top-0 z-30 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 bg-white/90 backdrop-blur-md border-b border-slate-200"
      >
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
          <SaveStatusIndicator
            status={session.saveStatus}
            lastSavedAt={session.lastSavedAt}
            pendingCount={session.pendingCount}
          />
          <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold tabular-nums"
            style={{ background: session.timeRemaining <= 60 ? '#FEE2E2' : '#F0FDFA', color: session.timeRemaining <= 60 ? '#DC2626' : TEAL }}>
            <Clock className="w-4 h-4" /> {formatClock(session.timeRemaining)}
          </span>
        </div>
      </div>

      {/* Tab Switcher cho Mobile (đọc hiểu / ảnh đề listening) */}
      {isBlockMode && (
        // Tab switcher dính NGAY dưới thanh tiêu đề. Trước đây hardcode
        // `top-[120px]` (= 64px header layout + 56px tiêu đề) — sai ngay khi ẩn
        // header, và cũng sai khi tiêu đề xuống hai dòng trên màn hẹp. Đo chiều
        // cao thật thay vì đoán.
        <div
          className="lg:hidden flex border-b border-slate-200 bg-white sticky z-20 -mx-4 px-4"
          style={{ top: headerH }}
        >
          <button 
            onClick={() => setMobileActiveTab('question')}
            className={`flex-1 py-3 text-center text-sm font-bold border-b-2 transition-colors ${mobileActiveTab === 'question' ? 'border-teal-600 text-teal-600 font-extrabold' : 'border-transparent text-slate-500'}`}
          >
            ❓ Câu hỏi làm bài
          </button>
          <button 
            onClick={() => setMobileActiveTab('passage')}
            className={`flex-1 py-3 text-center text-sm font-bold border-b-2 transition-colors ${mobileActiveTab === 'passage' ? 'border-teal-600 text-teal-600 font-extrabold' : 'border-transparent text-slate-500'}`}
          >
            {isImageBlock ? '🖼️ Ảnh đề' : '📖 Đoạn văn đọc hiểu'}
          </button>
        </div>
      )}

      <div className={`mt-5 grid grid-cols-1 gap-4 ${
        isImageBlock
          ? 'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_220px]'
          : 'lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_240px]'
      }`}>
        {/* Cột content block: đoạn đọc HOẶC ảnh đề listening (luôn render để tránh hook order violation) */}
        <section className={`hidden lg:flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[calc(100vh-12rem)] ${!isBlockMode ? 'invisible' : ''}`}>
          <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white flex-shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {isImageBlock ? <ImageIcon className="w-4 h-4 text-teal-600 flex-shrink-0" /> : <BookOpen className="w-4 h-4 text-teal-600 flex-shrink-0" />}
                <h2 className="text-sm font-bold text-slate-900 truncate">
                  {isImageBlock ? 'Ảnh đề' : 'Đọc hiểu'}
                </h2>
                {isImageBlock && groupIndices.length > 0 && (
                  <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                    Câu {groupIndices[0] + 1}–{groupIndices[groupIndices.length - 1] + 1}
                  </span>
                )}
              </div>
              {isImageBlock && taskImage && (
                <a
                  href={taskImage}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors"
                >
                  <ZoomIn className="w-3.5 h-3.5" /> Phóng to
                </a>
              )}
            </div>
          </div>

          {/* Audio sticky trong panel ảnh — luôn thấy khi nghe */}
          {isImageBlock && q?.qMedia_url && (
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/80 flex-shrink-0">
              <button onClick={playAudio}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm shadow-sm transition-transform hover:scale-[1.01] active:scale-95"
                style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})` }}>
                <Volume2 className="w-4 h-4" /> Nghe đoạn ghi âm
              </button>
            </div>
          )}

          <div className={`flex-1 overflow-y-auto min-h-0 ${isImageBlock ? 'p-3 bg-[#F8FAFC]' : 'px-6 py-4'}`}>
            {isImageBlock ? (
              <a href={taskImage} target="_blank" rel="noreferrer" className="block group relative rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                <img
                  src={taskImage}
                  alt="Ảnh đề"
                  className="w-full object-contain max-h-[calc(100vh-16rem)]"
                />
                <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900/55 text-white text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn className="w-3 h-3" /> Mở full
                </span>
              </a>
            ) : (
              <HighlightablePassage
                html={passage}
                highlights={highlightHook.highlights}
                selectedColor={highlightHook.selectedColor}
                onAddHighlight={highlightHook.addHighlight}
                onRemoveHighlight={highlightHook.removeHighlight}
                onSelectColor={highlightHook.setSelectedColor}
                colors={highlightHook.colors}
                enabled={isReading && !!submissionId}
              />
            )}
          </div>
        </section>

        {/* Cột nội dung câu hỏi */}
        <main className="min-w-0">
          <div className="lg:h-[calc(100vh-12rem)] lg:overflow-y-auto lg:space-y-4 space-y-4">
            {/* Đoạn đọc / ảnh đề cho mobile/tablet — hiển thị dựa trên mobileActiveTab */}
            <section className={`lg:hidden bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden ${!isBlockMode || mobileActiveTab !== 'passage' ? 'hidden' : 'block'}`}>
              <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isImageBlock ? <ImageIcon className="w-4 h-4 text-teal-600" /> : <BookOpen className="w-4 h-4 text-teal-600" />}
                    <h2 className="text-sm font-bold text-slate-900">{isImageBlock ? 'Ảnh đề' : 'Đọc hiểu'}</h2>
                  </div>
                  {isImageBlock && taskImage && (
                    <a href={taskImage} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded-lg">
                      <ZoomIn className="w-3.5 h-3.5" /> Phóng to
                    </a>
                  )}
                </div>
              </div>
              <div className={`overflow-y-auto min-h-[50vh] ${isImageBlock ? 'p-3 bg-[#F8FAFC]' : 'px-5 py-4'}`}>
                {isImageBlock ? (
                  <div className="space-y-3">
                    {q?.qMedia_url && (
                      <button onClick={playAudio}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm shadow-sm"
                        style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})` }}>
                        <Volume2 className="w-4 h-4" /> Nghe đoạn ghi âm
                      </button>
                    )}
                    <a href={taskImage} target="_blank" rel="noreferrer" className="block">
                      <img src={taskImage} alt="Ảnh đề" className="w-full object-contain rounded-xl border border-slate-200 bg-white shadow-sm" />
                    </a>
                    <p className="text-center text-[11px] text-slate-400 font-medium">Chạm ảnh để phóng to · chuyển tab Câu hỏi để trả lời</p>
                  </div>
                ) : (
                  <HighlightablePassage
                    html={passage}
                    highlights={highlightHook.highlights}
                    selectedColor={highlightHook.selectedColor}
                    onAddHighlight={highlightHook.addHighlight}
                    onRemoveHighlight={highlightHook.removeHighlight}
                    onSelectColor={highlightHook.setSelectedColor}
                    colors={highlightHook.colors}
                    enabled={isReading && !!submissionId}
                  />
                )}
              </div>
            </section>

            {/* Reading mode questions list */}
            <div className={`${!isBlockMode ? 'hidden' : ''} ${mobileActiveTab === 'question' ? 'block' : 'hidden lg:block'}`}>
              {/* Header cột câu hỏi khi image-block */}
              {isImageBlock && (
                <div className="mb-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-900">Câu hỏi</p>
                    <p className="text-xs text-slate-500 truncate">
                      Xem ảnh bên trái · điền / chọn đáp án bên phải
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-xs font-bold tabular-nums px-2.5 py-1 rounded-full bg-teal-50 text-teal-700">
                    {groupIndices.filter((i) => String(session.answers[getQuestionId(questions[i])] ?? '').trim() !== '').length}/{groupIndices.length} đã làm
                  </span>
                </div>
              )}

              {groupIndices.map((idx) => {
                const gq = questions[idx];
                const gid = getQuestionId(gq);
                const gSelected = String(session.answers[gid] ?? '');
                const gFlagged = !!flagged[gid];
                const isCur = idx === current;
                const gType = normType(gq);
                const isFill = gType === 'fill_blank' || gType === 'short_answer';
                const plainLabel = String(gq?.qContent ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
                const hideLabel = isImageBlock && (!plainLabel || /^(c\u00e2u|cau|q)\s*\d+$/i.test(plainLabel));
                return (
                  <section
                    key={gid || idx}
                    ref={(el) => { cardRefs.current[idx] = el; }}
                    onMouseDown={() => setCurrent(idx)}
                    className={`rounded-2xl bg-white border transition-all scroll-mt-36 ${
                      isImageBlock ? 'p-3.5 sm:p-4 mb-2.5' : 'p-5 sm:p-6'
                    } ${!isCur ? 'hidden lg:block' : 'block'}`}
                    style={{
                      borderColor: isCur ? TEAL : '#E2E8F0',
                      boxShadow: isCur ? '0 0 0 3px #CCFBF1' : undefined,
                      background: isCur && isImageBlock ? '#F0FDFA' : '#fff',
                    }}
                  >
                    <div className={`flex items-center justify-between ${hideLabel && isFill ? 'mb-2' : 'mb-3'}`}>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg text-sm font-bold text-white"
                          style={{ background: isCur ? TEAL : '#0F766E' }}>
                          {idx + 1}
                        </span>
                        {isImageBlock && (
                          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                            {isFill ? 'Điền từ' : 'Trắc nghiệm'}
                          </span>
                        )}
                        {!isImageBlock && (
                          <span className="text-sm font-bold text-slate-700">Câu {idx + 1}</span>
                        )}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); toggleFlagFor(gq); }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors"
                        style={{ background: gFlagged ? '#FEF3C7' : '#F8FAFC', color: gFlagged ? '#B45309' : '#94A3B8' }}>
                        <Flag className="w-3.5 h-3.5" style={gFlagged ? { fill: '#B45309' } : undefined} />
                        {gFlagged ? 'Đã đánh dấu' : 'Đánh dấu'}
                      </button>
                    </div>

                    {/* Audio/ảnh per-câu: ẩn khi đã có image-block chung bên trái */}
                    {!isImageBlock && gq?.qMedia_url && (
                      <button onClick={(e) => { e.stopPropagation(); const a = new Audio(gq.qMedia_url); a.play().catch(() => undefined); }}
                        className="mb-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm"
                        style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})` }}>
                        <Volume2 className="w-4 h-4" /> Nghe đoạn ghi âm
                      </button>
                    )}

                    {!isImageBlock && gq?.qImage_url && (
                      <img src={gq.qImage_url} alt="" className="w-full max-h-72 object-contain rounded-xl mb-4 bg-slate-50" />
                    )}

                    {!hideLabel && (
                      <RichText
                        as="h2"
                        className={`${isImageBlock ? 'text-sm font-semibold' : 'text-base font-bold'} leading-snug text-slate-900 ${isImageBlock ? 'mb-1' : ''}`}
                        text={gq?.qContent ?? `Câu ${idx + 1}`}
                      />
                    )}

                    {/* Fill compact cho image-block: 1 dòng gọn giống IELTS answer sheet */}
                    {isImageBlock && isFill ? (
                      <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100 transition-all">
                        <span className="text-xs font-bold text-slate-400 flex-shrink-0">Q{idx + 1}</span>
                        <input
                          type="text"
                          value={gSelected}
                          onChange={(e) => setAnswerFor(gq, e.target.value)}
                          placeholder="Nhập đáp án…"
                          className="flex-1 text-[15px] outline-none bg-transparent text-slate-800 font-medium"
                        />
                        {gSelected.trim() !== '' && (
                          <CheckCircle2 className="w-4 h-4 text-teal-500 flex-shrink-0" />
                        )}
                      </div>
                    ) : (
                      <QuestionRenderer q={gq} value={gSelected} onChange={(v) => setAnswerFor(gq, v)} />
                    )}
                  </section>
                );
              })}

              {/* Điều hướng dưới (desktop) */}
              <div className="hidden lg:flex items-center gap-3 pt-1">
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
            </div>

            {/* Non-block mode single question (đề cũ / speaking / không ảnh) */}
            <div className={`${isBlockMode ? 'hidden' : ''}`}>
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

            {/* Đề bài */}
            <RichText as="h2" className="text-base sm:text-lg font-bold leading-snug text-slate-900"
              text={q?.qContent ?? `Câu ${current + 1}`} />

            {/* Renderer theo dạng câu */}
            {isSpeakingQuestion(q) ? (
              (() => {
                let sd: any = q?.qData;
                if (typeof sd === 'string') { try { sd = JSON.parse(sd); } catch { sd = {}; } }
                sd = sd || {};
                const prepSeconds = Number(sd.prepSeconds ?? 30);
                const speakSeconds = Number(sd.speakSeconds ?? q?.qTime_limit ?? 120);
                return (
                  <TeensSpeakingRecorder
                    key={qid}
                    submissionId={submissionId}
                    partNumber={Number(q?.qPart ?? current + 1)}
                    prepSeconds={prepSeconds}
                    speakSeconds={speakSeconds}
                    recorded={String(selected).trim() !== ''}
                    onRecorded={() => handleAnswer('[recorded]')}
                  />
                );
              })()
            ) : (
              <QuestionRenderer q={q} value={selected} onChange={handleAnswer} />
            )}
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
            </div>
          </div>
        </main>

        {/* Cột navigator — kéo-thả di chuyển được (giống VSTEP) */}
        <aside
          data-nav-panel
          className={`hidden lg:block ${navPos ? 'fixed z-50' : 'sticky top-36 self-start'} max-h-[calc(100vh-10rem)] overflow-y-auto`}
          style={navPos
            ? { left: navPos.x, top: navPos.y, width: 260, boxShadow: '0 12px 40px rgba(15,23,42,0.18)' }
            : undefined}
        >
          <div className="rounded-2xl bg-white border border-slate-200 p-4">
            <div
              onMouseDown={onNavDragStart}
              className={`flex items-center gap-2 mb-3 -mx-1 px-1 select-none ${navDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              title="Kéo để di chuyển bảng câu"
            >
              <GripVertical className="w-4 h-4 text-slate-300" />
              <ListChecks className="w-4 h-4" style={{ color: TEAL }} />
              <span className="text-sm font-bold text-slate-900">Danh sách câu</span>
              {navPos && (
                <button
                  onClick={() => setNavPos(null)}
                  className="ml-auto text-[11px] font-semibold text-slate-400 hover:text-teal-600 transition-colors"
                  title="Về vị trí mặc định"
                >
                  Ghim lại
                </button>
              )}
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

      {/* Bottom bar (mobile).
          Nút "Nộp" LUÔN hiển thị, giống ThptBottomNav: trước đây nó chỉ có ở câu
          cuối, nên học viên trả lời xong nhưng đang xem lại câu giữa thì không
          có cách nào nộp mà không tự bấm sang câu cuối trước. */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]"
        // Tránh home indicator của iPhone đè lên nút Nộp.
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="px-3 pt-2 flex items-center gap-2">
          <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
            aria-label="Câu trước"
            className="inline-flex items-center justify-center min-h-11 px-3 rounded-xl font-semibold text-slate-600 bg-slate-100 disabled:opacity-40 flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsMobileNavOpen(true)}
            className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 min-h-11 px-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <ListChecks className="w-4 h-4 text-teal-600 flex-shrink-0" />
            <span className="truncate">Câu {current + 1}/{total} ({answeredCount} câu)</span>
          </button>

          {!isLast && (
            <button onClick={() => setCurrent(c => Math.min(total - 1, c + 1))}
              aria-label="Câu tiếp"
              className="inline-flex items-center justify-center min-h-11 px-3 rounded-xl font-bold text-white transition-transform active:scale-95 flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})` }}>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {/* Ở câu cuối thì nút Nộp đầy màu (hành động mong đợi); ở câu giữa thì
              nhẹ hơn để không mời gọi bấm sớm, nhưng vẫn luôn với tới được. */}
          <button
            onClick={() => setShowSubmit(true)}
            className={`inline-flex items-center justify-center gap-1.5 min-h-11 px-3 rounded-xl font-bold transition-transform active:scale-95 flex-shrink-0 ${
              isLast ? 'text-white' : 'text-teal-700 bg-teal-50 border border-teal-200'
            }`}
            style={isLast ? { background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})` } : undefined}
          >
            <Send className="w-4 h-4" /> Nộp
          </button>
        </div>
      </div>

      {/* Nút nổi xem bài đọc nhanh cho mobile */}
      {isBlockMode && mobileActiveTab === 'question' && (
        <button
          onClick={() => setIsMobilePassageModalOpen(true)}
          className="lg:hidden fixed right-4 z-40 w-12 h-12 rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow-lg flex items-center justify-center transition-transform active:scale-90"
          // bottom-20 cũ không tính safe-area nên trên iPhone nút này nằm sát
          // (hoặc đè) thanh dưới. Cộng thêm phần inset.
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
          title={isImageBlock ? 'Xem ảnh đề' : 'Xem đoạn văn'}
        >
          {isImageBlock ? <ImageIcon className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
        </button>
      )}

      {/* Mobile Navigator Drawer (Bottom Sheet) */}
      {isMobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-end justify-center">
          <div className="absolute inset-0" onClick={() => setIsMobileNavOpen(false)} />
          <div className="relative w-full max-h-[80vh] bg-white rounded-t-3xl p-5 shadow-2xl flex flex-col z-10"
            style={{ animation: 'teensSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
            <style>{`@keyframes teensSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
            
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4" onClick={() => setIsMobileNavOpen(false)} />
            
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900">Danh sách câu hỏi</h3>
              </div>
              <button 
                onClick={() => setIsMobileNavOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 pr-1 py-1">
              <div className="grid grid-cols-5 gap-2.5">
                {questions.map((_, i) => {
                  const st = statusOf(i);
                  const styleByStatus: Record<string, React.CSSProperties> = {
                    current: { background: TEAL, color: '#fff', boxShadow: `0 0 0 3px #CCFBF1` },
                    answered: { background: '#CCFBF1', color: TEAL },
                    flagged: { background: '#FEF3C7', color: '#B45309' },
                    empty: { background: '#F1F5F9', color: '#94A3B8' },
                  };
                  return (
                    <button key={i} onClick={() => { setCurrent(i); setIsMobileNavOpen(false); }}
                      className="aspect-square rounded-xl text-sm font-bold transition-all flex items-center justify-center"
                      style={styleByStatus[st]}>
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-[10px] font-semibold text-slate-500">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded" style={{ background: '#CCFBF1' }} /> Đã làm</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded" style={{ background: '#FEF3C7' }} /> Đánh dấu</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded" style={{ background: '#F1F5F9' }} /> Chưa làm</div>
            </div>
            
            <div className="mt-4 text-center text-sm font-bold text-slate-700">
              Đã làm {answeredCount}/{total} câu
            </div>
          </div>
        </div>
      )}

            {/* Mobile Passage / Image Modal (xem nhanh) */}
      {isMobilePassageModalOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg h-[80vh] flex flex-col shadow-2xl overflow-hidden"
            style={{ animation: 'teensPop 0.2s cubic-bezier(0.34, 1, 0.64, 1) forwards' }}>
            <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                {isImageBlock ? <ImageIcon className="w-5 h-5 text-teal-600" /> : <BookOpen className="w-5 h-5 text-teal-600" />}
                <h3 className="text-base font-bold text-slate-900">{isImageBlock ? 'Ảnh đề' : 'Đoạn văn đọc hiểu'}</h3>
              </div>
              <button 
                onClick={() => setIsMobilePassageModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
              {isImageBlock ? (
                <div className="space-y-3">
                  {q?.qMedia_url && (
                    <button onClick={playAudio}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm"
                      style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})` }}>
                      <Volume2 className="w-4 h-4" /> Nghe đoạn ghi âm
                    </button>
                  )}
                  <a href={taskImage} target="_blank" rel="noreferrer">
                    <img src={taskImage} alt="Ảnh đề" className="w-full object-contain rounded-xl border border-slate-100 bg-slate-50" />
                  </a>
                </div>
              ) : (
                <HighlightablePassage
                  html={passage}
                  highlights={highlightHook.highlights}
                  selectedColor={highlightHook.selectedColor}
                  onAddHighlight={highlightHook.addHighlight}
                  onRemoveHighlight={highlightHook.removeHighlight}
                  onSelectColor={highlightHook.setSelectedColor}
                  colors={highlightHook.colors}
                  enabled={isReading && !!submissionId}
                />
              )}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex-shrink-0">
              <button 
                onClick={() => setIsMobilePassageModalOpen(false)}
                className="w-full py-2.5 rounded-xl font-bold text-white text-sm"
                style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})` }}
              >
                Quay lại câu hỏi
              </button>
            </div>
          </div>
        </div>
      )}

<SubmitDialog
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
        onResume={(draft) => { session.resume(draft); setResumeDraft(null); }}
        onDiscard={() => { if (submissionId) examDraftStorage.clear(submissionId); setResumeDraft(null); }}
      />
      <MultiTabWarning hasOtherTab={session.hasOtherTab} position="floating" />
      <ActiveSessionChoiceModal
        open={showActiveSessionModal}
        onContinue={() => setShowActiveSessionModal(false)}
        onRestart={async () => {
          if (!window.confirm("Bạn có chắc chắn muốn hủy phiên làm bài hiện tại và làm lại từ đầu? Tất cả câu trả lời của phiên này sẽ bị xóa.")) return;
          setIsRestarting(true);
          try {
            const examKey = exam?.id ?? exam?.eId ?? assignmentId;
            if (direct) {
              await api.post(`/student/exams/${examKey}/start-teens`, { restart: true });
            } else {
              await api.post(`/student/tests/${assignmentId}/start`, { restart: true });
            }
            if (submissionId) {
              examDraftStorage.clear(submissionId);
              localStorage.removeItem(`teens_deadline_${submissionId}`);
            }
            window.location.reload();
          } catch (err: any) {
            setLoadError(err?.response?.data?.message || "Không thể hủy và khởi động lại bài thi.");
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

function ActiveSessionChoiceModal({ open, onContinue, onRestart, isRestarting }: ActiveSessionChoiceModalProps) {
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

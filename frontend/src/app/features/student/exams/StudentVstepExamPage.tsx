import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router";
import {
  ArrowLeft,
  Headphones,
  BookOpen,
  PenLine,
  Mic,
  Play,
  Pause,
  Clock,
  Eye,
  EyeOff,
  AlertCircle,
  Volume2,
  Volume1,
  VolumeX,
  RotateCcw,
  CheckCircle,
  Send,
  Flag,
  Loader2,
} from "lucide-react";
import { studentApi } from "../../../../services/studentApi";
import { api } from "../../../../services/api";
import { usePageTitle } from "../../../../hooks/usePageTitle";
import { useExamSession } from "../../../../hooks/exam/useExamSession";

/* ============================================================
 *  TYPES (identical to VstepExamPreview)
 * ============================================================ */
type SkillKey = "listening" | "reading" | "writing" | "speaking";
interface Choice { A: string; B: string; C: string; D: string }
interface Q { qId: number; questionNumber: number; questionText: string; options: Choice; correctAnswer?: string }
interface ListeningSection { sectionNumber: number; sectionName: string; instructions?: string; audioUrl: string; audioDuration?: number; transcript?: string; questions: Q[] }
interface ListeningPart { partNumber: number; partName?: string; sections: ListeningSection[] }
interface ReadingPart { partNumber: number; partName?: string; passage: string; questions: Q[] }
interface WritingTask { taskNumber: number; taskName: string; prompt: string; wordCount?: [number, number] | number; timeLimit?: number; questionId?: number }
interface SpeakingPart {
  partNumber: number;
  part1Data?: Array<{ topicName: string; questions: string[] }>;
  part2Data?: { situation: string; solutions: string[]; question: string };
  part3Data?: { mainTopic: string; suggestedIdeas: string[]; followUpQuestions: string[] };
}

/* ============================================================
 *  CONSTANTS
 * ============================================================ */
const STUDENT_BASE_PATH = "/hoc-vien";

const SKILL_META: Record<SkillKey, { label: string; icon: any; color: string; bg: string }> = {
  listening: { label: "Listening", icon: Headphones, color: "text-sky-700",     bg: "bg-sky-100"     },
  reading:   { label: "Reading",   icon: BookOpen,   color: "text-emerald-700", bg: "bg-emerald-100" },
  writing:   { label: "Writing",   icon: PenLine,    color: "text-amber-700",   bg: "bg-amber-100"   },
  speaking:  { label: "Speaking",  icon: Mic,        color: "text-pink-700",    bg: "bg-pink-100"    },
};

const PARTS_PER_SKILL: Record<SkillKey, number[]> = {
  listening: [1, 2, 3],
  reading:   [1, 2, 3, 4],
  writing:   [1, 2],
  speaking:  [1, 2, 3],
};

const SKILL_ORDER: SkillKey[] = ["listening", "reading", "writing", "speaking"];

const SKILL_TIME: Record<SkillKey, number> = {
  listening: 47,
  reading: 60,
  writing: 60,
  speaking: 12,
};

const TOTAL_MINUTES = SKILL_TIME.listening + SKILL_TIME.reading + SKILL_TIME.writing + SKILL_TIME.speaking;

/* ============================================================
 *  SUBMIT DIALOG
 * ============================================================ */
function SubmitDialog({
  open,
  totalMCQ,
  answeredMCQ,
  answeredWriting,
  totalWriting,
  answeredSpeaking,
  totalSpeaking,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  totalMCQ: number;
  answeredMCQ: number;
  answeredWriting: number;
  totalWriting: number;
  answeredSpeaking: number;
  totalSpeaking: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  if (!open) return null;
  const unansweredMCQ  = totalMCQ - answeredMCQ;
  const writingDone    = answeredWriting >= totalWriting && totalWriting > 0;
  const speakingDone   = answeredSpeaking >= totalSpeaking && totalSpeaking > 0;
  const allDone        = unansweredMCQ === 0 && writingDone && speakingDone;
  const skills = [
    { label: "Listening + Reading", done: answeredMCQ, total: totalMCQ, ok: unansweredMCQ === 0 },
    { label: "Writing",             done: answeredWriting, total: totalWriting, ok: writingDone },
    { label: "Speaking",            done: answeredSpeaking, total: totalSpeaking, ok: speakingDone },
  ];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl mx-4 border border-slate-200">
        <div className="flex flex-col items-center text-center gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${allDone ? "bg-emerald-50" : "bg-amber-50"}`}>
            {allDone ? <CheckCircle className="w-8 h-8 text-emerald-500" /> : <AlertCircle className="w-8 h-8 text-amber-500" />}
          </div>
          <div className="w-full">
            <h2 className="text-xl font-bold text-slate-900">
              {allDone ? "Sẵn sàng nộp bài" : "Kiểm tra lại trước khi nộp"}
            </h2>
            <div className="mt-3 space-y-2 text-left">
              {skills.map((s) => (
                <div key={s.label} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                  s.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
                }`}>
                  <span className="font-medium">{s.label}</span>
                  <span className="font-bold">{s.ok ? "✓" : `${s.done}/${s.total}`}</span>
                </div>
              ))}
            </div>
            {!allDone && (
              <p className="mt-3 text-xs text-slate-500">Một số phần chưa hoàn thành. Bạn có chắc muốn nộp bài?</p>
            )}
          </div>
          <div className="flex gap-3 w-full">
            <button onClick={onCancel} disabled={loading}
              className="flex-1 py-3 rounded-xl font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition text-sm">
              Tiếp tục làm
            </button>
            <button onClick={onConfirm} disabled={loading}
              className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition text-sm disabled:opacity-60">
              {loading ? "Đang nộp..." : "Nộp bài"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 *  MAIN COMPONENT
 * ============================================================ */
export function StudentVstepExamPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  /* ── Query params (from ExamLobby flow) ─────────────────── */
  const querySubmissionId = useMemo(() => {
    const raw = Number(new URLSearchParams(location.search).get("submissionId") ?? 0);
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }, [location.search]);

  /* ── Review mode (?review=submissionId) ──────────────────── */
  const reviewSubmissionId = useMemo(() => {
    const v = Number(new URLSearchParams(location.search).get("review") ?? 0);
    return Number.isFinite(v) && v > 0 ? v : null;
  }, [location.search]);
  const reviewMode = reviewSubmissionId !== null;

  usePageTitle(reviewMode ? "Xem lại bài thi VSTEP" : "Làm bài thi VSTEP");

  /* ── Teacher view mode (?teacher=1) ────────────────────── */
  const teacherMode = useMemo(() => new URLSearchParams(location.search).get("teacher") === "1", [location.search]);

  /* ── Correct answers map for review (qId → letter) ─────── */
  const [correctAnswersMap, setCorrectAnswersMap] = useState<Record<number, string>>({});
  const [reviewSpeakingAudio, setReviewSpeakingAudio] = useState<Record<string, string>>({});
  const [reviewSpeakingScore, setReviewSpeakingScore] = useState<number | null>(null);
  type WritingTaskResult = { score: number | null; criteria: Record<string, number | null>; criterion_comments?: Record<string, string | null>; feedback: string; suggestions: string[] };
  type SpeakingPartResult = { score: number | null; criteria: Record<string, number | null>; criterion_comments?: Record<string, string | null>; feedback: string; suggestions: string[]; pronunciation_score?: number; content_score?: number; transcript?: string };
  const [reviewWritingScores, setReviewWritingScores] = useState<{ overall: number | null; tasks: Record<number, number | null>; results: Record<number, WritingTaskResult> }>({ overall: null, tasks: {}, results: {} });
  const [reviewSpeakingResults, setReviewSpeakingResults] = useState<Record<number, SpeakingPartResult>>({});
  const [reviewGradingPending, setReviewGradingPending] = useState(false);
  const [reviewStudentName, setReviewStudentName] = useState<string | null>(null);

  /* ── Start / loading state ──────────────────────────────── */
  const [starting, setStarting] = useState(true);
  const [startError, setStartError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [startedAtServer, setStartedAtServer] = useState('');

  /* ── useExamSession hook (handles timer + auto-save + auto-submit) ── */
  const session = useExamSession({
    submissionId: reviewMode ? null : submissionId,
    examId: examId ? parseInt(examId) : 0,
    durationMinutes: TOTAL_MINUTES,
    startedAtServer,
    examType: 'VSTEP',
    role: 'adults',
    enableAutoSubmitOnUnload: !reviewMode,
    onAutoSubmitted: () => {
      if (!reviewMode && submissionId) {
        navigate(`${STUDENT_BASE_PATH}/lam-bai-vstep/${examId}?review=${submissionId}`);
      }
    },
  });

  /* ── Exam data ──────────────────────────────────────────── */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [examTitle, setExamTitle] = useState("VSTEP Exam");
  const [listeningParts, setListeningParts] = useState<ListeningPart[]>([]);
  const [readingParts, setReadingParts] = useState<ReadingPart[]>([]);
  const [writingTasks, setWritingTasks] = useState<WritingTask[]>([]);
  const [speakingParts, setSpeakingParts] = useState<SpeakingPart[]>([]);

  // Ensure result detail modal is closed in review mode
  useEffect(() => {
    if (reviewMode) {
      window.dispatchEvent(new Event("close-result-modal"));
    }
  }, [reviewMode]);

  /* ── Navigation state ───────────────────────────────────── */
  const [current, setCurrent] = useState<{ skill: SkillKey; partNumber: number }>({ skill: "listening", partNumber: 1 });
  const [maxSkillIdx, setMaxSkillIdx] = useState(0);
  const [visitedParts, setVisitedParts] = useState<Record<SkillKey, Set<number>>>({
    listening: new Set([1]), reading: new Set(), writing: new Set(), speaking: new Set(),
  });

  /* ── localStorage keys (per submission, NOT per exam) ──── */
  const LS_ANSWERS  = submissionId ? `svstep_answers_sid_${submissionId}` : null;
  const LS_WRITING  = submissionId ? `svstep_writing_sid_${submissionId}` : null;

  /* ── Answers state — start EMPTY, restored after submissionId is set ── */
  const [answers, setAnswers] = useState<Record<string, "A" | "B" | "C" | "D">>({});
  const [writingDrafts, setWritingDrafts] = useState<Record<number, string>>({});
  const [speakingDone, setSpeakingDone] = useState<Record<number, boolean>>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});

  /* ── Timer handled by useExamSession (removed duplicate local state) ── */
  const submittedRef = useRef(false);

  /* ── Per-skill timer ─────────────────────────────────────── */
  const [skillTimeLeft, setSkillTimeLeft] = useState(() => SKILL_TIME["listening"] * 60);

  /* ── UI ─────────────────────────────────────────────────── */
  const [bottomVisible, setBottomVisible] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [footerPos, setFooterPos] = useState({ x: 0, y: 0 });
  const footerDragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const onFooterDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    footerDragRef.current = { sx: e.clientX, sy: e.clientY, ox: footerPos.x, oy: footerPos.y };
    const onMove = (ev: MouseEvent) => {
      if (!footerDragRef.current) return;
      setFooterPos({ x: footerDragRef.current.ox + (ev.clientX - footerDragRef.current.sx), y: footerDragRef.current.oy + (ev.clientY - footerDragRef.current.sy) });
    };
    const onUp = () => { footerDragRef.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  /* ── Mark next mount as a "reload" if window unloads (F5) ── */
  useEffect(() => {
    if (!examId) return;
    const RELOAD_FLAG = `svstep_reload_${examId}`;
    const onUnload = () => sessionStorage.setItem(RELOAD_FLAG, "1");
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [examId]);

  /* ── Restore saved answers once submissionId is known ──── */
  useEffect(() => {
    if (!submissionId) return;
    try {
      const saved = localStorage.getItem(`svstep_answers_sid_${submissionId}`);
      if (saved) setAnswers(JSON.parse(saved));
      const savedW = localStorage.getItem(`svstep_writing_sid_${submissionId}`);
      if (savedW) setWritingDrafts(JSON.parse(savedW));
      const savedF = localStorage.getItem(`svstep_flags_sid_${submissionId}`);
      if (savedF) setFlagged(JSON.parse(savedF));
    } catch {}
  }, [submissionId]);

  /* ── Auto-save to localStorage (per submission) ─────────── */
  useEffect(() => { if (LS_ANSWERS) try { localStorage.setItem(LS_ANSWERS, JSON.stringify(answers)); } catch {} }, [answers, LS_ANSWERS]);
  useEffect(() => { if (LS_WRITING) try { localStorage.setItem(LS_WRITING, JSON.stringify(writingDrafts)); } catch {} }, [writingDrafts, LS_WRITING]);
  useEffect(() => { if (submissionId) try { localStorage.setItem(`svstep_flags_sid_${submissionId}`, JSON.stringify(flagged)); } catch {} }, [flagged, submissionId]);

  /* ── Toggle flag on a question ─────────────────────── */
  const toggleFlag = useCallback((qId: number) => {
    setFlagged((prev) => {
      const next = { ...prev };
      if (next[qId]) delete next[qId]; else next[qId] = true;
      return next;
    });
  }, []);

  /* ── Review mode: load submission once (skip start exam) ── */
  useEffect(() => {
    if (!reviewMode || !reviewSubmissionId) return;
    setStarting(false);
    const fetchDetail = teacherMode
      ? api.get(`/teacher/submissions/${reviewSubmissionId}`)
      : studentApi.getSubmissionDetail(reviewSubmissionId);
    fetchDetail
      .then((res: any) => {
        const data = res?.data?.data ?? res?.data;
        if (!data) return;

        // ─── IELTS exam: VSTEP page không thể render đúng (filter A/B/C/D drop
        // text completion answers). Redirect sang route IELTS để render đúng UI.
        const eType = String(data.exam?.eType ?? "").toUpperCase();
        if (eType === "IELTS" && !teacherMode) {
          const skill = String(data.exam?.eSkill ?? "listening").toLowerCase();
          navigate(
            `${STUDENT_BASE_PATH}/lam-bai-ielts/${data.exam_id}/${skill}?review=${reviewSubmissionId}`,
            { replace: true }
          );
          return;
        }

        if (data.user?.uName) setReviewStudentName(data.user.uName);
        if (data.exam?.eTitle) setExamTitle(data.exam.eTitle);
        // Pre-fill student's MCQ answers
        const mcqAnswers: Record<string, "A" | "B" | "C" | "D"> = {};
        const writingMap: Record<number, string> = {};
        for (const a of (data.answers ?? [])) {
          const sec = (a.question?.qSkill ?? a.question?.qSection ?? "").toLowerCase();
          if (sec === "writing") {
            const part = a.question?.qPart ?? 1;
            if (a.saAnswer_text) writingMap[part] = a.saAnswer_text;
          } else if (sec !== "speaking") {
            const letter = a.saAnswer_text as "A" | "B" | "C" | "D";
            if (["A","B","C","D"].includes(letter)) mcqAnswers[a.question_id] = letter;
          }
        }
        setAnswers(mcqAnswers);
        setWritingDrafts(writingMap);
        // Build correct answers map from exam.questions.answers
        const LETTERS = ["A","B","C","D"];
        const cmap: Record<number, string> = {};
        for (const q of (data.exam?.questions ?? [])) {
          const correct = (q.answers ?? []).find((a: any) => a.aIs_correct);
          if (correct) {
            const order = correct.aOrder ?? (q.answers ?? []).indexOf(correct);
            cmap[q.qId] = LETTERS[order] ?? correct.aContent ?? "?";
          }
        }
        setCorrectAnswersMap(cmap);
        // Speaking audio & score from sGemini_feedback
        const feedback = data.sGemini_feedback
          ? (typeof data.sGemini_feedback === 'string' ? JSON.parse(data.sGemini_feedback) : data.sGemini_feedback)
          : {};
        setReviewSpeakingAudio(feedback.speaking_audio ?? {});

        // Detailed speaking results from feedback
        const spResults: Record<number, any> = {};
        for (const [key, val] of Object.entries(feedback.speaking_results ?? {})) {
          const partNum = parseInt(key.replace('part_', ''));
          if (!isNaN(partNum)) {
            spResults[partNum] = { ...val };
          }
        }

        // Override speaking part scores and detailed results with manual/teacher scores from data.answers
        const spTasks: Record<number, number | null> = {};
        for (const a of (data.answers ?? [])) {
          const sec = (a.question?.qSkill ?? a.question?.qSection ?? "").toLowerCase();
          if (sec === "speaking") {
            const part = a.question?.qPart ?? 1;
            const pts = a.saPoints_awarded;
            if (pts !== null && pts !== undefined) {
              const ptsNum = parseFloat(String(pts));
              spTasks[part] = ptsNum;
              if (!spResults[part]) {
                spResults[part] = { criteria: {}, criterion_comments: {}, feedback: "", suggestions: [] };
              }
              spResults[part].score = ptsNum;
            }
          }
        }
        setReviewSpeakingResults(spResults);

        // Compute overall speaking score: prioritize average of manually graded/overridden parts if available
        const spScores = Object.values(spTasks).filter((s) => s !== null) as number[];
        let spScore = feedback.vstep_scores?.speaking ?? data.vstep_meta?.vstep_scores?.speaking ?? null;
        if (spScores.length > 0) {
          spScore = spScores.reduce((sum, s) => sum + s, 0) / spScores.length;
        }
        setReviewSpeakingScore(typeof spScore === 'number' ? Math.round(spScore * 100) / 100 : null);

        // Writing scores: overall + per-task from saPoints_awarded + detailed results
        const wTasks: Record<number, number | null> = {};
        const wResults: Record<number, any> = {};
        for (const a of (data.answers ?? [])) {
          const sec = (a.question?.qSkill ?? a.question?.qSection ?? '').toLowerCase();
          if (sec === 'writing') {
            const part = a.question?.qPart ?? 1;
            const pts = a.saPoints_awarded;
            wTasks[part] = pts !== null && pts !== undefined ? parseFloat(String(pts)) : null;
          }
        }

        // Detailed per-task results from sGemini_feedback.writing_results
        const writingResults = feedback.writing_results ?? {};
        for (const key of Object.keys(writingResults)) {
          const taskNum = parseInt(key.replace('task_', ''));
          if (!isNaN(taskNum)) {
            wResults[taskNum] = { ...writingResults[key] };
          }
        }

        // Override writing task scores with manual/teacher scores from data.answers
        for (const taskNum of Object.keys(wTasks).map(Number)) {
          const score = wTasks[taskNum];
          if (score !== null && score !== undefined) {
            if (!wResults[taskNum]) {
              wResults[taskNum] = { criteria: {}, criterion_comments: {}, feedback: "", suggestions: [] };
            }
            wResults[taskNum].score = score;
          }
        }

        // Compute overall writing score: prioritize average of manually graded/overridden parts if available
        const wScores = Object.values(wTasks).filter((s) => s !== null) as number[];
        let wOverall = feedback.vstep_scores?.writing ?? data.vstep_meta?.vstep_scores?.writing ?? null;
        if (wScores.length > 0) {
          wOverall = wScores.reduce((sum, s) => sum + s, 0) / wScores.length;
        }
        setReviewWritingScores({ overall: typeof wOverall === 'number' ? Math.round(wOverall * 100) / 100 : null, tasks: wTasks, results: wResults });
        // Check if grading is still pending
        const isPending = data.sStatus === 'grading_subjective' ||
          (Object.keys(writingResults).length === 0 && Object.keys(spResults).length === 0);
        setReviewGradingPending(isPending);
        // Unlock all skill navigation
        setMaxSkillIdx(3);
        setVisitedParts({ listening: new Set([1,2,3]), reading: new Set([1,2,3,4]), writing: new Set([1,2]), speaking: new Set([1,2,3]) });
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewMode, reviewSubmissionId, teacherMode]);

  /* ── Review mode: poll grading status until done ────────── */
  useEffect(() => {
    if (!reviewMode || !reviewSubmissionId || !reviewGradingPending || teacherMode) return;
    const poll = setInterval(() => {
      studentApi.getGradingStatus(reviewSubmissionId)
        .then((res: any) => {
          const status = res?.data?.data?.sStatus ?? null;
          if (status === 'graded') {
            setReviewGradingPending(false);
            clearInterval(poll);
            // Reload full review data
            studentApi.getSubmissionDetail(reviewSubmissionId).then((r: any) => {
              const d = r?.data?.data ?? r?.data;
              if (!d) return;
              const fb = d.sGemini_feedback
                ? (typeof d.sGemini_feedback === 'string' ? JSON.parse(d.sGemini_feedback) : d.sGemini_feedback)
                : {};
              const wOverall = fb.vstep_scores?.writing ?? d.vstep_meta?.vstep_scores?.writing ?? null;
              const wTasks: Record<number, number | null> = {};
              const wResults: Record<number, any> = {};
              for (const a of (d.answers ?? [])) {
                const sec = (a.question?.qSkill ?? a.question?.qSection ?? '').toLowerCase();
                if (sec === 'writing') {
                  const part = a.question?.qPart ?? 1;
                  const pts = a.saPoints_awarded;
                  wTasks[part] = pts !== null && pts !== undefined ? parseFloat(String(pts)) : null;
                }
              }
              const wRes = fb.writing_results ?? {};
              for (const key of Object.keys(wRes)) {
                const t = parseInt(key.replace('task_', ''));
                if (!isNaN(t)) wResults[t] = wRes[key];
              }
              setReviewWritingScores({ overall: typeof wOverall === 'number' ? wOverall : null, tasks: wTasks, results: wResults });
              const spRes: Record<number, any> = {};
              for (const [key, val] of Object.entries(fb.speaking_results ?? {})) {
                const p = parseInt(key.replace('part_', ''));
                if (!isNaN(p)) spRes[p] = val;
              }
              setReviewSpeakingResults(spRes);
              const spScore = fb.vstep_scores?.speaking ?? d.vstep_meta?.vstep_scores?.speaking ?? null;
              setReviewSpeakingScore(typeof spScore === 'number' ? spScore : null);
            }).catch(() => {});
          }
        }).catch(() => {});
    }, 8000);
    return () => clearInterval(poll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewMode, reviewSubmissionId, reviewGradingPending]);

  /* ── Step 1: Start direct exam ──────────────────────────── */
  useEffect(() => {
    if (!examId || reviewMode) return;
    setStarting(true);

    // If coming from ExamLobby, submissionId is already in query — skip start
    if (querySubmissionId) {
      setSubmissionId(querySubmissionId);
      setStarting(false);
      return;
    }

    // Detect F5/reload vs SPA-navigation (back to exam page)
    // beforeunload fires only on F5/tab-close, NOT on React Router navigation.
    // So if the flag exists in sessionStorage, this mount was preceded by an unload (=F5).
    const RELOAD_FLAG = `svstep_reload_${examId}`;
    const isReload = sessionStorage.getItem(RELOAD_FLAG) === "1";
    sessionStorage.removeItem(RELOAD_FLAG);

    studentApi.startDirectVstepExam(Number(examId), isReload)
      .then((res: any) => {
        const data = res?.data?.data;
        if (data?.submissionId) {
          setSubmissionId(data.submissionId);
          // Calculate startedAtServer from timeRemaining if available
          const remaining = data.timeRemaining; // minutes from server
          if (typeof remaining === 'number' && remaining >= 0) {
            const elapsedMin = TOTAL_MINUTES - remaining;
            const startMs = Date.now() - (elapsedMin * 60 * 1000);
            setStartedAtServer(new Date(startMs).toISOString());
          } else {
            // Fallback: assume just started
            setStartedAtServer(new Date().toISOString());
          }
        } else {
          setStartError("Không thể khởi tạo bài thi. Vui lòng thử lại.");
        }
      })
      .catch(() => setStartError("Không thể kết nối đến máy chủ. Vui lòng thử lại."))
      .finally(() => setStarting(false));
  }, [examId, querySubmissionId]);

  /* ── Step 2: Load exam data once submissionId is ready ──── */
  useEffect(() => {
    if (!examId || starting || startError) return;
    setLoading(true);
    Promise.allSettled(
      teacherMode ? [
        api.get(`/teacher/exams/${examId}/vstep/listening`),
        api.get(`/teacher/exams/${examId}/vstep/reading`),
        api.get(`/teacher/exams/${examId}/vstep/writing`),
        api.get(`/teacher/exams/${examId}/vstep/speaking`),
      ] : [
        studentApi.loadStudentVstepListening(Number(examId)),
        studentApi.loadStudentVstepReading(Number(examId)),
        studentApi.loadStudentVstepWriting(Number(examId)),
        studentApi.loadStudentVstepSpeaking(Number(examId)),
      ]
    ).then((results) => {
      const [L, R, W, S] = results;
      if (L.status === "fulfilled") {
        const d = (L.value as any)?.data?.data ?? (L.value as any)?.data;
        setExamTitle(d?.title || "VSTEP Exam");
        setListeningParts(d?.parts || []);
      }
      if (R.status === "fulfilled") {
        const d = (R.value as any)?.data?.data ?? (R.value as any)?.data;
        setReadingParts(d?.parts || []);
        if (d?.title) setExamTitle((t) => d.title || t);
      }
      if (W.status === "fulfilled") {
        setWritingTasks(((W.value as any)?.data?.data ?? (W.value as any)?.data)?.tasks || []);
      }
      if (S.status === "fulfilled") {
        setSpeakingParts(((S.value as any)?.data?.data ?? (S.value as any)?.data)?.parts || []);
      }
    })
    .catch((e) => setError(e?.message || "Không thể tải đề thi"))
    .finally(() => setLoading(false));
  }, [examId, starting, startError, reviewMode, teacherMode]);

  /* ── Reset per-skill timer when skill changes ────────────── */
  useEffect(() => {
    setSkillTimeLeft(SKILL_TIME[current.skill] * 60);
  }, [current.skill]);

  /* ── Per-skill countdown ─────────────────────────────────── */
  useEffect(() => {
    const id = setInterval(() => {
      setSkillTimeLeft((t) => {
        if (t <= 1) { clearInterval(id); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [current.skill]);

  /* ── Auto-advance skill when per-skill timer hits 0 ──────── */
  useEffect(() => {
    if (skillTimeLeft > 0) return;
    const skillIdx = SKILL_ORDER.indexOf(current.skill);
    if (skillIdx < SKILL_ORDER.length - 1) {
      const nextSkill = SKILL_ORDER[skillIdx + 1];
      navigate2(nextSkill, PARTS_PER_SKILL[nextSkill][0]);
    } else {
      handleAutoSubmit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillTimeLeft]);

  /* ── Auto-submit on timeout ─────────────────────────────── */
  const handleAutoSubmit = useCallback(() => {
    if (!submissionId || submittedRef.current) return;
    submittedRef.current = true;
    studentApi.submitTest(submissionId)
      .then((res: any) => {
        const sid = res?.data?.data?.submissionId ?? submissionId;
        navigate(`${STUDENT_BASE_PATH}/lam-bai-vstep/${examId}?review=${sid}`);
      })
      .catch(() => navigate(`${STUDENT_BASE_PATH}/lam-bai-vstep/${examId}?review=${submissionId}`));
  }, [submissionId, examId, navigate]);

  /* ── Navigate ───────────────────────────────────────────── */
  const navigate2 = (skill: SkillKey, partNumber: number) => {
    setMaxSkillIdx((prev) => Math.max(prev, SKILL_ORDER.indexOf(skill)));
    setVisitedParts((prev) => ({ ...prev, [skill]: new Set([...prev[skill], partNumber]) }));
    setCurrent({ skill, partNumber });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ── Set MCQ answer + save to backend ────────────────── */
  const setAnswer = useCallback((_questionNumber: number, qId: number, letter: "A" | "B" | "C" | "D") => {
    if (reviewMode) return;
    setAnswers((prev) => ({ ...prev, [qId]: letter }));
    if (submissionId) {
      studentApi.saveAnswer(submissionId, { question_id: qId, saAnswer_text: letter } as any)
        .catch(() => {});
    }
  }, [submissionId, reviewMode]);

  /* ── Save writing answer to backend (on blur) ───────────── */
  const saveWriting = useCallback((questionId: number | undefined, text: string) => {
    if (submissionId && questionId) {
      studentApi.saveAnswer(submissionId, { question_id: questionId, saAnswer_text: text } as any)
        .catch(() => {});
    }
  }, [submissionId]);

  /* ── Submit ─────────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!submissionId) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      // Flush all writing drafts to DB before submitting (in case textarea was never blurred)
      await Promise.all(
        writingTasks.map((task) => {
          const draft = writingDrafts[task.taskNumber] ?? "";
          if (task.questionId && draft.trim()) {
            return studentApi.saveAnswer(submissionId, { question_id: task.questionId, saAnswer_text: draft } as any).catch(() => {});
          }
          return Promise.resolve();
        })
      );
      const res: any = await studentApi.submitTest(submissionId);
      const sid = res?.data?.data?.submissionId ?? submissionId;
      localStorage.removeItem(LS_ANSWERS);
      localStorage.removeItem(LS_WRITING);
      navigate(`${STUDENT_BASE_PATH}/lam-bai-vstep/${examId}?review=${sid}`);
    } catch {
      navigate(`${STUDENT_BASE_PATH}/lam-bai-vstep/${examId}?review=${submissionId}`);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Part completion check ──────────────────────────────── */
  const isPartComplete = (skill: SkillKey, pn: number): boolean => {
    if (skill === "listening") {
      const part = listeningParts.find((p) => p.partNumber === pn);
      if (!part) return false;
      const qs = part.sections.flatMap((s) => s.questions);
      return qs.length > 0 && qs.every((q) => answers[q.qId]);
    }
    if (skill === "reading") {
      const part = readingParts.find((p) => p.partNumber === pn);
      if (!part) return false;
      return part.questions.length > 0 && part.questions.every((q) => answers[q.qId]);
    }
    if (skill === "writing") return !!writingDrafts[pn]?.trim();
    if (skill === "speaking") return reviewMode ? !!reviewSpeakingAudio[String(pn)] : !!speakingDone[pn];
    return false;
  };

  /* ── Stats ──────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const listeningQIds = new Set(
      listeningParts.flatMap((p) => p.sections.flatMap((s) => s.questions.map((q) => q.qId)))
    );
    const readingQIds = new Set(
      readingParts.flatMap((p) => p.questions.map((q) => q.qId))
    );
    const lq = listeningQIds.size;
    const rq = readingQIds.size;
    const wq = writingTasks.length;
    const sq = speakingParts.reduce((sum, p) => {
      let n = 0;
      if (p.part1Data) n += p.part1Data.reduce((s, t) => s + t.questions.length, 0);
      if (p.part2Data) n += 1;
      if (p.part3Data) n += (p.part3Data.followUpQuestions?.length || 0) + 1;
      return sum + n;
    }, 0);
    const answeredListening = Object.keys(answers).filter((k) => listeningQIds.has(Number(k))).length;
    const answeredReading   = Object.keys(answers).filter((k) => readingQIds.has(Number(k))).length;
    const answeredWriting   = Object.values(writingDrafts).filter((v) => v?.trim()).length;
    const answeredSpeaking  = Object.keys(speakingDone).length;
    const totalMCQ  = lq + rq;
    const answeredMCQ = answeredListening + answeredReading;
    return {
      lq, rq, wq, sq, total: lq + rq + wq + sq,
      totalMCQ, answeredMCQ,
      answeredListening, answeredReading, answeredWriting, answeredSpeaking,
    };
  }, [listeningParts, readingParts, writingTasks, speakingParts, answers, writingDrafts, speakingDone]);

  /* ── Skills thực sự có nội dung trong đề (IELTS thường chỉ 1 skill) ────── */
  const skillsInExam = useMemo<SkillKey[]>(() => {
    const present: SkillKey[] = [];
    if (stats.lq > 0) present.push("listening");
    if (stats.rq > 0) present.push("reading");
    if (stats.wq > 0) present.push("writing");
    if (stats.sq > 0) present.push("speaking");
    // Fallback: nếu chưa load được gì thì hiện đủ (tránh footer trống)
    return present.length > 0 ? present : (Object.keys(PARTS_PER_SKILL) as SkillKey[]);
  }, [stats.lq, stats.rq, stats.wq, stats.sq]);

  /* ── Format time ────────────────────────────────────────── */
  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60), ss = s % 60;
    return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  /* ── Next part ──────────────────────────────────────────── */
  const goNext = () => {
    const order: Array<{ skill: SkillKey; part: number }> = [];
    (Object.keys(PARTS_PER_SKILL) as SkillKey[]).forEach((s) => {
      PARTS_PER_SKILL[s].forEach((p) => order.push({ skill: s, part: p }));
    });
    const idx = order.findIndex((o) => o.skill === current.skill && o.part === current.partNumber);
    const next = order[idx + 1];
    if (!next) return;

    // When crossing to a different skill, check for unanswered MCQ questions
    if (!reviewMode && next.skill !== current.skill) {
      // Collect all question IDs for the current MCQ skill
      let unanswered: number[] = [];
      if (current.skill === "listening") {
        const allQs = listeningParts.flatMap((p) => p.sections.flatMap((s) => s.questions));
        unanswered = allQs.filter((q) => !answers[q.qId]).map((q) => q.questionNumber);
      } else if (current.skill === "reading") {
        const allQs = readingParts.flatMap((p) => p.questions);
        unanswered = allQs.filter((q) => !answers[q.qId]).map((q) => q.questionNumber);
      }
      if (unanswered.length > 0) {
        const nums = unanswered.slice(0, 15).join(", ") + (unanswered.length > 15 ? ` ... (${unanswered.length} câu)` : "");
        window.alert(
          `⚠️ Bạn còn ${unanswered.length} câu chưa trả lời trong phần ${SKILL_META[current.skill].label}:\n\nCâu: ${nums}\n\nVui lòng hoàn thành tất cả câu hỏi trước khi chuyển sang phần tiếp theo.`
        );
        return;
      }
      // All answered — confirm skill change (cannot go back)
      const curMeta = SKILL_META[current.skill];
      const nextMeta = SKILL_META[next.skill];
      const ok = window.confirm(
        `✅ Bạn đã hoàn thành "${curMeta.label}".\n\nBạn sắp chuyển sang "${nextMeta.label}". Sau khi chuyển, bạn sẽ KHÔNG THỂ quay lại phần "${curMeta.label}" nữa.\n\nBạn có chắc chắn muốn tiếp tục?`
      );
      if (!ok) return;
    }
    navigate2(next.skill, next.part);
  };

  const isLastPart = (() => {
    const order: Array<{ skill: SkillKey; part: number }> = [];
    (Object.keys(PARTS_PER_SKILL) as SkillKey[]).forEach((s) => {
      PARTS_PER_SKILL[s].forEach((p) => order.push({ skill: s, part: p }));
    });
    const idx = order.findIndex((o) => o.skill === current.skill && o.part === current.partNumber);
    return idx === order.length - 1;
  })();

  /* ── Render content ─────────────────────────────────────── */
  const renderContent = () => {
    if (current.skill === "listening") {
      const part = listeningParts.find((p) => p.partNumber === current.partNumber);
      return <ListeningView part={part} partNumber={current.partNumber} answers={answers} onAnswer={setAnswer} flagged={flagged} onFlag={toggleFlag} reviewMode={reviewMode} correctAnswersMap={correctAnswersMap} />;
    }
    if (current.skill === "reading") {
      const part = readingParts.find((p) => p.partNumber === current.partNumber);
      return <ReadingView part={part} partNumber={current.partNumber} answers={answers} onAnswer={setAnswer} flagged={flagged} onFlag={toggleFlag} reviewMode={reviewMode} correctAnswersMap={correctAnswersMap} examId={examId ? Number(examId) : undefined} />;
    }
    if (current.skill === "writing") {
      const task = writingTasks.find((t) => t.taskNumber === current.partNumber);
      return (
        <WritingView
          task={task}
          taskNumber={current.partNumber}
          value={writingDrafts[current.partNumber] || ""}
          onChange={(v) => { if (!reviewMode) setWritingDrafts((p) => ({ ...p, [current.partNumber]: v })); }}
          onBlur={(v) => { if (!reviewMode) saveWriting(task?.questionId, v); }}
          readOnly={reviewMode}
          reviewScores={reviewMode ? reviewWritingScores : undefined}
          isGradingPending={reviewMode ? reviewGradingPending : false}
        />
      );
    }
    const sp = speakingParts.find((p) => p.partNumber === current.partNumber);
    return (
      <SpeakingView
        part={sp}
        partNumber={current.partNumber}
        examId={examId || ""}
        submissionId={submissionId}
        onComplete={(pn) => setSpeakingDone((prev) => ({ ...prev, [pn]: true }))}
        reviewMode={reviewMode}
        reviewAudioUrl={reviewSpeakingAudio[String(current.partNumber)]}
        reviewSpeakingScore={reviewSpeakingScore}
        reviewSpeakingResults={reviewMode ? reviewSpeakingResults : undefined}
        isGradingPending={reviewMode ? reviewGradingPending : false}
      />
    );
  };

  /* ══════════════════════════════════════════════════════════
   *  LOADING / ERROR STATES
   * ══════════════════════════════════════════════════════════ */
  if (starting || loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-600 font-medium">{starting ? "Đang khởi tạo bài thi..." : "Đang tải đề thi..."}</p>
        </div>
      </div>
    );
  }

  if (startError || error) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 font-semibold mb-4">{startError || error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-700 transition text-sm"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
   *  MAIN RENDER
   * ══════════════════════════════════════════════════════════ */
  const skillMeta = SKILL_META[current.skill];
  const SkillIcon = skillMeta.icon;
  const isUrgent = skillTimeLeft < 300;

  return (
    <div className={teacherMode ? "flex flex-col h-screen overflow-hidden bg-slate-50" : "fixed inset-0 z-50 flex flex-col bg-slate-50"}>
      {/* ─── HEADER ──────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm z-30">
        <div className="px-4 h-14 flex items-center justify-between gap-4">
          {/* LEFT: back + title */}
          <div className="flex items-center gap-3 min-w-0">
            {teacherMode ? (
              <Link
                to="/giao-vien/cham-diem"
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
            ) : (
              <button
                onClick={() => { if (confirm("Bạn có chắc muốn thoát? Tiến độ sẽ được lưu lại.")) navigate(`${STUDENT_BASE_PATH}/de-thi`); }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
            )}
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {teacherMode ? "GV" : "V"}
            </div>
            <div className="hidden md:flex flex-col min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                {teacherMode && reviewStudentName ? `${reviewStudentName} — ` : ""}{examTitle}
              </p>
              <p className="text-xs text-slate-500 leading-tight">
                {teacherMode ? "Xem bài học viên · Chế độ giáo viên" : reviewMode ? "Xem lại bài thi · Học viên" : "Bài thi VSTEP · Học viên"}
              </p>
            </div>
            {/* Current skill badge */}
            <div className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold flex-shrink-0 ${skillMeta.bg} ${skillMeta.color}`}>
              <SkillIcon className="w-3 h-3" />
              {skillMeta.label}
            </div>
          </div>

          {/* CENTER: timer (exam) or review badge */}
          {reviewMode ? (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg border bg-emerald-50 border-emerald-200 flex-shrink-0">
              <Eye className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-bold text-emerald-700">Chế độ xem lại</span>
            </div>
          ) : (
            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border flex-shrink-0 ${
              isUrgent
                ? "bg-red-50 border-red-200 animate-pulse"
                : "bg-sky-50 border-sky-200"
            }`}>
              <Clock className={`w-4 h-4 ${isUrgent ? "text-red-500" : "text-sky-600"}`} />
              <span className={`text-lg font-bold tabular-nums ${isUrgent ? "text-red-600" : "text-sky-700"}`}>
                {fmtTime(skillTimeLeft)}
              </span>
              <span className={`text-[11px] font-medium hidden sm:inline ${isUrgent ? "text-red-400" : "text-sky-400"}`}>
                {skillMeta.label}
              </span>
            </div>
          )}

          {/* RIGHT: answered count + submit (or back in review / teacher actions) */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {teacherMode ? (
              <Link
                to={`/giao-vien/cham-diem/${reviewSubmissionId}`}
                className="group inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-sm font-bold rounded-lg shadow-sm active:scale-[0.97] transition-all duration-200"
              >
                <PenLine className="w-4 h-4 transition-transform group-hover:rotate-12" />
                <span>Chỉnh sửa điểm</span>
              </Link>
            ) : reviewMode ? (
              <button
                onClick={() => navigate(`${STUDENT_BASE_PATH}/ket-qua/${reviewSubmissionId}`)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-slate-600 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 active:scale-[0.97] transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Về kết quả
              </button>
            ) : (
              <>
                <span className="hidden sm:inline-flex items-center text-sm text-slate-600">
                  Đã trả lời&nbsp;<span className="font-bold text-slate-900">{stats.answeredMCQ}</span>/{stats.totalMCQ}
                </span>
                <button
                  onClick={() => setShowSubmit(true)}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-sky-600 text-white text-base font-semibold rounded-lg hover:bg-sky-700 active:scale-[0.97] transition-all shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  Nộp bài
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT + QUESTION NAVIGATOR ──────────────── */}
      <main className="flex-1 overflow-hidden min-h-0 relative">
        <div className="h-full overflow-hidden min-h-0">{renderContent()}</div>
        {(current.skill === "listening" || current.skill === "reading") && (
          <QuestionNavigator
            skill={current.skill}
            currentPart={current.partNumber}
            listeningParts={listeningParts}
            readingParts={readingParts}
            answers={answers}
            flagged={flagged}
            reviewMode={reviewMode}
            correctAnswersMap={correctAnswersMap}
            onJump={(pn, qId) => {
              if (pn !== current.partNumber) navigate2(current.skill, pn);
              setTimeout(() => {
                document.getElementById(`q-${qId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 80);
            }}
          />
        )}
      </main>

      {/* ─── BOTTOM PARTS BAR ─────────────────────────────────── */}
      {bottomVisible && (
        <footer className="flex-shrink-0 bg-white border-t border-slate-200 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] overflow-visible">
          <div className="relative px-8 py-3 flex items-center justify-center gap-6 overflow-visible">
            {skillsInExam.map((s) => {
              const meta = SKILL_META[s];
              const Icon = meta.icon;
              const totalSkillQs =
                s === "listening" ? stats.lq
                : s === "reading" ? stats.rq
                : s === "writing" ? stats.wq
                : stats.sq;
              const sIdx = SKILL_ORDER.indexOf(s);
              const pastSkill = !reviewMode && sIdx < maxSkillIdx;
              return (
                <div key={s} className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className="flex items-center gap-1">
                    {PARTS_PER_SKILL[s].map((pn) => {
                      const isActive = current.skill === s && current.partNumber === pn;
                      const isVisited = visitedParts[s]?.has(pn);
                      const sameSkill = s === current.skill;
                      const canClick = reviewMode || (!pastSkill && (sameSkill || isVisited));
                      const tooltip = !reviewMode && pastSkill
                        ? "Không thể quay lại skill đã hoàn thành"
                        : !reviewMode && (!isVisited && !sameSkill)
                        ? "Nhấn Tiếp tục để chuyển đến phần này"
                        : undefined;
                      return (
                        <div key={pn} className="relative group">
                          <button
                            onClick={() => canClick && navigate2(s, pn)}
                            disabled={!canClick}
                            className={`relative px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                              reviewMode
                                ? (isActive
                                  ? `${meta.bg} ${meta.color} ring-1 ring-slate-400`
                                  : `${meta.bg} ${meta.color} hover:brightness-95 cursor-pointer`)
                                : isActive
                                ? "bg-amber-400 text-slate-900 shadow-sm scale-105"
                                : pastSkill
                                ? `${meta.bg} ${meta.color} opacity-40 cursor-not-allowed`
                                : canClick
                                ? `${meta.bg} ${meta.color} hover:brightness-95 cursor-pointer`
                                : `${meta.bg} ${meta.color} opacity-50 cursor-not-allowed`
                            }`}
                          >
                            Part {pn}
                            {isPartComplete(s, pn) && (
                              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[9px] font-bold leading-none">
                                ✓
                              </span>
                            )}
                          </button>
                          {tooltip && !isActive && (
                            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[200] invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-150">
                              <div className="bg-slate-800 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap shadow-lg">
                                {tooltip}
                              </div>
                              <div className="w-2 h-2 bg-slate-800 rotate-45 mx-auto -mt-1" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const answered = s === 'listening' ? stats.answeredListening
                      : s === 'reading' ? stats.answeredReading
                      : s === 'writing' ? stats.answeredWriting
                      : stats.answeredSpeaking;
                    const pct = totalSkillQs > 0 ? answered / totalSkillQs : 0;
                    const chipColor = pct === 0 ? '' : pct >= 1 ? 'ring-1 ring-emerald-400' : 'ring-1 ring-amber-400';
                    return (
                      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold ${meta.bg} ${meta.color} ${chipColor}`}>
                        <Icon className="w-3 h-3" />
                        {meta.label}
                        <span className="opacity-60">·</span>
                        <span className={pct >= 1 ? 'text-emerald-600 font-bold' : pct > 0 ? 'text-amber-600 font-bold' : ''}>
                          {answered}/{totalSkillQs}
                        </span>
                        <span className="opacity-60">·</span>
                        <span className="opacity-70">{SKILL_TIME[s]}m</span>
                      </div>
                    );
                  })()}
                </div>
              );
            })}

            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 flex-shrink-0">
              <button
                onClick={isLastPart && !reviewMode ? () => setShowSubmit(true) : goNext}
                className={`px-4 py-2 text-white active:scale-[0.97] rounded-md text-sm font-semibold transition-all shadow-sm ${
                  isLastPart && !reviewMode
                    ? "bg-emerald-600 hover:bg-emerald-700 animate-pulse"
                    : "bg-sky-600 hover:bg-sky-700"
                }`}
              >
                {isLastPart && !reviewMode ? "✓ Nộp bài" : "Tiếp tục →"}
              </button>
              <button
                onClick={() => setBottomVisible(false)}
                className="px-3 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1"
                title="Ẩn thanh điều hướng"
              >
                <EyeOff className="w-4 h-4" /> Ẩn
              </button>
            </div>
          </div>
        </footer>
      )}

      {!bottomVisible && (
        <button
          onClick={() => setBottomVisible(true)}
          className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-full shadow-lg hover:bg-slate-800 transition-all text-xs font-medium"
        >
          <Eye className="w-4 h-4" /> Hiện menu
        </button>
      )}

      <SubmitDialog
        open={showSubmit}
        totalMCQ={stats.totalMCQ}
        answeredMCQ={stats.answeredMCQ}
        answeredWriting={stats.answeredWriting}
        totalWriting={stats.wq}
        answeredSpeaking={stats.answeredSpeaking}
        totalSpeaking={PARTS_PER_SKILL.speaking.length}
        onConfirm={handleSubmit}
        onCancel={() => setShowSubmit(false)}
        loading={submitting}
      />
    </div>
  );
}

/* ============================================================
 *  LISTENING VIEW (identical to VstepExamPreview)
 * ============================================================ */
function ListeningView({
  part, partNumber, answers, onAnswer, flagged, onFlag, reviewMode, correctAnswersMap,
}: {
  part?: ListeningPart;
  partNumber: number;
  answers: Record<string, "A" | "B" | "C" | "D">;
  onAnswer: (questionNumber: number, qId: number, l: "A" | "B" | "C" | "D") => void;
  flagged: Record<number, boolean>;
  onFlag: (qId: number) => void;
  reviewMode?: boolean;
  correctAnswersMap?: Record<number, string>;
}) {
  if (!part || !part.sections?.length) return <EmptyState skill="listening" />;

  const PART_INSTRUCTIONS: Record<number, { count: string; type: string; qPer: string }> = {
    1: { count: "EIGHT short recordings",   type: "announcements / short talks", qPer: "one question following each recording" },
    2: { count: "THREE conversations",       type: "conversations between two speakers", qPer: "three questions following each conversation" },
    3: { count: "THREE talks or lectures",   type: "talks or academic lectures",  qPer: "four questions following each talk" },
  };
  const pi = PART_INSTRUCTIONS[partNumber];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
        <PartHeader icon={Headphones} color="sky" title={`Part ${partNumber}`}
          subtitle={part.partName || (partNumber === 1 ? "Announcements" : partNumber === 2 ? "Conversations" : "Talks / Lectures")} />

        <div className="text-[14px] leading-relaxed text-slate-700 space-y-3">
          {partNumber === 1 && (
            <p className="italic">
              You will listen to a number of different recordings and you will have to answer questions based on what you hear.
              All the recordings will be played <strong>ONCE</strong> only.
            </p>
          )}
          {pi && (
            <div className="space-y-1">
              <p className="font-bold text-slate-900 uppercase tracking-wide text-[13px]">PART {partNumber}</p>
              <p className="italic">
                In this part, you will hear <strong>{pi.count}</strong>.
                The recordings will be played <strong>ONCE</strong> only.
                There is {pi.qPer}.
                For each question, choose the correct answer <strong>A</strong>, <strong>B</strong>, <strong>C</strong> or <strong>D</strong>.
              </p>
            </div>
          )}
        </div>

        {part.sections.map((sec) => (
          <section key={sec.sectionNumber} className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">{sec.sectionName || `Section ${sec.sectionNumber}`}</h3>
              <span className="text-xs text-slate-500">
                Câu {sec.questions[0]?.questionNumber}–{sec.questions[sec.questions.length - 1]?.questionNumber}
              </span>
            </div>
            {sec.instructions && (
              <div className="px-5 py-3 bg-sky-50/60 border-b border-sky-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700 mb-0.5">Yêu cầu</p>
                <p className="text-sm text-slate-700 leading-relaxed">{sec.instructions}</p>
              </div>
            )}
            <div className="p-5">
              <div className="sticky top-0 z-10 -mx-5 px-5 py-2 bg-white/95 backdrop-blur-sm border-b border-slate-100">
                <AudioPlayer src={sec.audioUrl} reviewMode={reviewMode} />
              </div>
              <div className="mt-6 space-y-5">
                {sec.questions.map((q) => (
                  <QuestionCard key={q.qId} q={q} selected={answers[q.qId]} onSelect={(l) => onAnswer(q.questionNumber, q.qId, l)} flagged={!!flagged[q.qId]} onToggleFlag={reviewMode ? undefined : () => onFlag(q.qId)} reviewMode={reviewMode} correctAnswer={correctAnswersMap?.[q.qId] as any} />
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
 *  HIGHLIGHT COLORS
 * ============================================================ */
const HIGHLIGHT_COLORS: { key: string; bg: string; label: string }[] = [
  { key: "yellow",  bg: "#FEF08A", label: "Vàng"  },
  { key: "green",   bg: "#BBF7D0", label: "Xanh lá" },
  { key: "blue",    bg: "#BAE6FD", label: "Xanh dương" },
  { key: "pink",    bg: "#FBCFE8", label: "Hồng"  },
  { key: "orange",  bg: "#FED7AA", label: "Cam"   },
];

const COLOR_MAP: Record<string, string> = Object.fromEntries(
  HIGHLIGHT_COLORS.map((c) => [c.key, c.bg])
);

interface HighlightItem {
  id: number;
  start_offset: number;
  end_offset: number;
  color: string;
  selected_text: string;
}

/* ============================================================
 *  HIGHLIGHTABLE PASSAGE
 * ============================================================ */
function HighlightablePassage({
  html,
  examId,
  partNumber,
  reviewMode,
}: {
  html: string;
  examId: number;
  partNumber: number;
  reviewMode?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const [popup, setPopup] = useState<{ x: number; y: number; range: Range } | null>(null);
  /* fixed = viewport coords */
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);

  const [vocabCount, setVocabCount] = useState(0);
  const [vocabList, setVocabList] = useState<{ id: number; word: string; note: string }[]>([]);
  const [showVocab, setShowVocab] = useState(false);

  /* Fetch saved highlights on mount / part change */
  useEffect(() => {
    if (!examId) return;
    studentApi.getHighlights(examId, partNumber)
      .then((res: any) => {
        const data: HighlightItem[] = res?.data?.data ?? [];
        setHighlights(data);
      })
      .catch(() => {});

    studentApi.getVocab(examId)
      .then((res: any) => {
        const data = res?.data?.data ?? [];
        setVocabCount(data.length);
        setVocabList(data);
      })
      .catch(() => {});
  }, [examId, partNumber]);

  /* Stable plain text derived once from original html — normalizes soft line breaks */
  const plainText = useMemo(() => {
    const stripped = html.replace(/<[^>]*>/g, "");
    /* Replace double newlines (paragraph breaks) with a placeholder, collapse single \n into space */
    return stripped
      .replace(/\r\n/g, "\n")
      .replace(/\n{2,}/g, "\x00PARA\x00")   // paragraph break → placeholder
      .replace(/\n/g, " ")                  // mid-sentence \n → space
      .replace(/  +/g, " ")                 // collapse multiple spaces
      .replace(/\x00PARA\x00/g, "\n\n");    // restore paragraph breaks
  }, [html]);

  /* Escape HTML special chars in plain text segments */
  const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /* Build rendered HTML with <mark> tags and paragraph support */
  const renderedHtml = useMemo(() => {
    const toHtml = (s: string) =>
      s.split("\n\n").map((para) => `<p style="font-size:17px;line-height:1.8;margin-bottom:1em">${escHtml(para.trim())}</p>`).join("");

    if (!highlights.length) return toHtml(plainText);

    const sorted = [...highlights].sort((a, b) => a.start_offset - b.start_offset);

    let flat = "";
    let cursor = 0;
    for (const h of sorted) {
      if (h.end_offset <= cursor) continue;
      const start = Math.max(h.start_offset, cursor);
      if (start > cursor) flat += escHtml(plainText.slice(cursor, start));
      const bg = COLOR_MAP[h.color] || "#FEF08A";
      flat += `<mark data-hid="${h.id}" style="background:${bg};border-radius:3px;cursor:pointer;" title="Click để xóa highlight">${escHtml(plainText.slice(start, h.end_offset))}</mark>`;
      cursor = h.end_offset;
    }
    flat += escHtml(plainText.slice(cursor));
    return flat.split("\n\n").map((para) => `<p style="font-size:17px;line-height:1.8;margin-bottom:1em">${para.trim()}</p>`).join("");
  }, [plainText, highlights]);

  /* Click on existing mark to delete */
  const handleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const mark = (e.target as HTMLElement).closest("mark[data-hid]");
    if (!mark) return;
    const hid = Number((mark as HTMLElement).dataset.hid);
    studentApi.deleteHighlight(examId, hid)
      .then(() => setHighlights((prev) => prev.filter((h) => h.id !== hid)))
      .catch(() => {});
  }, [examId]);

  /* Snap a text node offset to nearest word boundary */
  const snapToWord = (node: Node, offset: number, direction: "start" | "end"): [Node, number] => {
    if (node.nodeType !== Node.TEXT_NODE) return [node, offset];
    const text = node.textContent || "";
    if (direction === "start") {
      let i = offset;
      while (i > 0 && /\S/.test(text[i - 1])) i--;
      return [node, i];
    } else {
      let i = offset;
      while (i < text.length && /\S/.test(text[i])) i++;
      return [node, i];
    }
  };

  /* Mouse up: detect selection, snap to word boundaries */
  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (reviewMode) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) { setPopup(null); return; }
    const range = sel.getRangeAt(0);
    if (!containerRef.current?.contains(range.commonAncestorContainer)) { setPopup(null); return; }

    /* Snap start backward and end forward to word edges */
    const [snapStartNode, snapStartOff] = snapToWord(range.startContainer, range.startOffset, "start");
    const [snapEndNode, snapEndOff]     = snapToWord(range.endContainer, range.endOffset, "end");
    try {
      range.setStart(snapStartNode, snapStartOff);
      range.setEnd(snapEndNode, snapEndOff);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) { /* ignore if DOM changed */ }

    if (range.collapsed || !range.toString().trim()) { setPopup(null); return; }

    const rect = range.getBoundingClientRect();
    setPopup({
      x: rect.left + rect.width / 2,
      y: rect.top - 48,
      range,
    });
  }, [reviewMode]);

  /* Get text offset by walking only the article element — avoids badge/popup node interference */
  const getTextOffset = (node: Node, offsetInNode: number): number => {
    const root = articleRef.current ?? containerRef.current!;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let total = 0;
    let current = walker.nextNode();
    while (current) {
      if (current === node) return total + offsetInNode;
      total += (current.textContent || "").length;
      current = walker.nextNode();
    }
    return total + offsetInNode;
  };

  /* Apply highlight for chosen color — optimistic update */
  const applyColor = useCallback((color: string) => {
    if (!popup) return;
    const { range } = popup;
    const sel = window.getSelection();
    const selectedText = range.toString().trim();
    if (!selectedText) { setPopup(null); return; }

    const startOffset = getTextOffset(range.startContainer, range.startOffset);
    const endOffset   = getTextOffset(range.endContainer, range.endOffset);

    sel?.removeAllRanges();
    setPopup(null);

    /* ── Optimistic: add immediately with negative temp id ── */
    const tempId = -(Date.now());
    const optimistic: HighlightItem = { id: tempId, start_offset: startOffset, end_offset: endOffset, color, selected_text: selectedText };
    setHighlights((prev) => [...prev, optimistic]);

    studentApi.saveHighlight(examId, {
      skill: "reading",
      part_number: partNumber,
      start_offset: startOffset,
      end_offset: endOffset,
      color,
      selected_text: selectedText,
    }).then((res: any) => {
      const saved: HighlightItem = res?.data?.data;
      if (saved) {
        /* Replace temp with real id */
        setHighlights((prev) => prev.map((h) => h.id === tempId ? saved : h));
      }
      /* Auto-save vocab word (fire-and-forget) */
      const words = selectedText.trim().split(/\s+/);
      if (words.length <= 5) {
        studentApi.saveVocab(examId, selectedText.trim(), "")
          .then((r: any) => {
            const saved = r?.data?.data;
            setVocabCount((c) => c + 1);
            if (saved) setVocabList((prev) => [...prev, saved]);
          })
          .catch(() => {});
      }
    }).catch(() => {
      /* Rollback on failure */
      setHighlights((prev) => prev.filter((h) => h.id !== tempId));
    });
  }, [popup, examId, partNumber]);

  /* Close popup on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popup && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopup(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [popup]);

  return (
    <div ref={containerRef} className="relative flex-1 overflow-y-auto px-6 py-5 select-text">
      {/* Vocab badge — click to open list */}
      {vocabCount > 0 && (
        <button
          onClick={() => setShowVocab(true)}
          className="absolute top-3 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm z-10 hover:brightness-95 transition-all"
          style={{ background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0" }}
          title="Xem danh sách từ vựng đã lưu"
        >
          📚 {vocabCount} từ vựng
        </button>
      )}

      {/* Vocab list modal */}
      {showVocab && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center"
          style={{ background: "rgba(15,23,42,0.45)" }}
          onClick={() => setShowVocab(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">📚</span>
                <span className="font-semibold text-slate-800">Từ vựng đã lưu</span>
                <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">{vocabList.length}</span>
              </div>
              <button onClick={() => setShowVocab(false)} className="text-slate-400 hover:text-slate-700 text-lg leading-none">&times;</button>
            </div>
            {/* List */}
            <div className="max-h-80 overflow-y-auto px-4 py-3 space-y-2">
              {vocabList.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">Chưa có từ vựng nào</p>
              ) : (
                vocabList.map((v, i) => (
                  <div key={v.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 break-words">{v.word}</p>
                      {v.note && <p className="text-xs text-slate-500 mt-0.5 break-words">{v.note}</p>}
                    </div>
                    <button
                      onClick={() => {
                        studentApi.deleteVocab(examId, v.id).then(() => {
                          setVocabList((prev) => prev.filter((x) => x.id !== v.id));
                          setVocabCount((c) => c - 1);
                        }).catch(() => {});
                      }}
                      className="flex-shrink-0 text-slate-300 hover:text-red-400 text-sm transition-colors"
                      title="Xóa"
                    >&times;</button>
                  </div>
                ))
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-100">
              <p className="text-[11px] text-slate-400 text-center">Từ được tự động lưu khi bôi đen highlight</p>
            </div>
          </div>
        </div>
      )}

      {/* Color picker popup — fixed to viewport so it renders above sticky headers */}
      {popup && (
        <div
          className="fixed z-[9999] flex items-center gap-1 px-2 py-1.5 rounded-xl shadow-xl"
          style={{
            left: popup.x - 90,
            top: popup.y,
            background: "#F8FAFC",
            border: "1.5px solid #E2E8F0",
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
            minWidth: 184,
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="text-[10px] text-slate-500 mr-1 whitespace-nowrap font-medium">Tô màu:</span>
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.key}
              onClick={() => applyColor(c.key)}
              title={c.label}
              className="w-6 h-6 rounded-full border-2 border-slate-200 hover:scale-110 hover:border-slate-400 transition-transform flex-shrink-0 disabled:opacity-50"
              style={{ background: c.bg }}
            />
          ))}
          <button
            onClick={() => { window.getSelection()?.removeAllRanges(); setPopup(null); }}
            className="ml-1 text-slate-400 hover:text-slate-700 text-xs px-1"
            title="Đóng"
          >✕</button>
        </div>
      )}

      <article
        ref={articleRef as React.RefObject<HTMLElement>}
        className="prose max-w-none text-slate-800"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
      />
    </div>
  );
}

/* ============================================================
 *  READING VIEW
 * ============================================================ */
function ReadingView({
  part, partNumber, answers, onAnswer, flagged, onFlag, reviewMode, correctAnswersMap, examId,
}: {
  part?: ReadingPart;
  partNumber: number;
  answers: Record<string, "A" | "B" | "C" | "D">;
  onAnswer: (questionNumber: number, qId: number, l: "A" | "B" | "C" | "D") => void;
  flagged: Record<number, boolean>;
  onFlag: (qId: number) => void;
  reviewMode?: boolean;
  correctAnswersMap?: Record<number, string>;
  examId?: number;
}) {
  if (!part || !part.questions?.length) return <EmptyState skill="reading" />;

  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-[45%_55%] gap-4 p-4 overflow-hidden">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-0">
        <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-emerald-900">Reading Passage — Part {partNumber}</h3>
          </div>
          {part.partName && <span className="text-xs text-emerald-700">{part.partName}</span>}
        </div>
        {examId ? (
          <HighlightablePassage
            html={part.passage || ""}
            examId={examId}
            partNumber={partNumber}
            reviewMode={reviewMode}
          />
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <article
              className="prose prose-sm max-w-none text-slate-800 leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: part.passage || "" }}
            />
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-0">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold text-slate-900">Questions ({part.questions.length})</h3>
          <span className="text-xs text-slate-500">
            {part.questions[0]?.questionNumber}–{part.questions[part.questions.length - 1]?.questionNumber}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {part.questions.map((q) => (
            <QuestionCard key={q.qId} q={q} selected={answers[q.qId]} onSelect={(l) => onAnswer(q.questionNumber, q.qId, l)} flagged={!!flagged[q.qId]} onToggleFlag={reviewMode ? undefined : () => onFlag(q.qId)} reviewMode={reviewMode} correctAnswer={correctAnswersMap?.[q.qId] as any} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 *  WRITING VIEW
 * ============================================================ */
function WritingView({
  task, taskNumber, value, onChange, onBlur, readOnly, reviewScores, isGradingPending,
}: {
  task?: WritingTask;
  taskNumber: number;
  value: string;
  onChange: (v: string) => void;
  onBlur: (v: string) => void;
  readOnly?: boolean;
  reviewScores?: { overall: number | null; tasks: Record<number, number | null>; results: Record<number, { score: number | null; criteria: Record<string, number | null>; criterion_comments?: Record<string, string | null>; feedback: string; suggestions: string[] }> };
  isGradingPending?: boolean;
}) {
  if (!task) return <EmptyState skill="writing" />;

  const wordCount = useMemo(
    () => value.replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length,
    [value]
  );
  const range = Array.isArray(task.wordCount) ? task.wordCount : [0, 0];
  const [minW, maxW] = range as [number, number];
  const inRange = wordCount >= minW && (maxW === 0 || wordCount <= maxW);

  type SegType = "time" | "intro" | "context" | "stimulus" | "task" | "requirement";
  interface Seg { type: SegType; text: string }

  const parsedSegments = useMemo<Seg[]>(() => {
    const paras = (task.prompt || "").split(/\n\s*\n|\n/).map((l) => l.trim()).filter(Boolean);
    const segs: Seg[] = [];
    let stimulusMode = false;
    const ATTRIBUTION = /^(IELTS|Cambridge|British Council|IDP|TEST\s+\d+|Source:|Adapted from|—|–)/i;
    for (const para of paras) {
      if (ATTRIBUTION.test(para)) continue;
      if (/you should spend.{0,40}minute/i.test(para)) { segs.push({ type: "time", text: para }); stimulusMode = false; continue; }
      if (/^(now )?write (an?|the|a) /i.test(para) || /^respond to /i.test(para)) { stimulusMode = false; segs.push({ type: "task", text: para }); continue; }
      if (/you should write|at least \d+|do not include your name|not allowed to use your name|evaluated in terms|your response will be|word limit|\(your response/i.test(para)) { segs.push({ type: "requirement", text: para }); continue; }
      if (!stimulusMode && /read (part|the|an? extract|some) of|here is|below is|the following|look at the/i.test(para)) {
        const prev = segs[segs.length - 1];
        if (prev?.type === "context") segs[segs.length - 1] = { type: "intro", text: prev.text + " " + para };
        else segs.push({ type: "intro", text: para });
        stimulusMode = true;
        continue;
      }
      if (stimulusMode) { segs.push({ type: "stimulus", text: para }); continue; }
      const prev = segs[segs.length - 1];
      if (prev && (prev.type === "task" || prev.type === "requirement") && !/[.!?]$/.test(prev.text)) {
        segs[segs.length - 1] = { type: prev.type, text: prev.text + " " + para };
        continue;
      }
      segs.push({ type: "context", text: para });
    }
    return segs;
  }, [task.prompt]);

  const hasStimulus = parsedSegments.some((s) => s.type === "stimulus");
  type RBlock = { type: SegType; texts: string[] };
  const renderBlocks = parsedSegments.reduce<RBlock[]>((acc, seg) => {
    const last = acc[acc.length - 1];
    if (last && last.type === seg.type && (seg.type === "context" || seg.type === "stimulus")) last.texts.push(seg.text);
    else acc.push({ type: seg.type, texts: [seg.text] });
    return acc;
  }, []);

  const renderTimeLine = (text: string) => text.split(/(\d+\s*minutes?|\d+\s*phút)/i).map((part, i) =>
    /\d+\s*(minutes?|phút)/i.test(part) ? <strong key={i}>{part}</strong> : part
  );

  const renderBlock = (block: RBlock, i: number) => {
    switch (block.type) {
      case "time": return <p key={i} className="text-[14px] italic text-slate-600 leading-relaxed">{renderTimeLine(block.texts[0])}</p>;
      case "context": return !hasStimulus
        ? <div key={i} className="border-l-4 border-blue-500 pl-4 space-y-1.5">{block.texts.map((t, j) => <p key={j} className="text-[15px] italic text-blue-900 leading-relaxed">{t}</p>)}</div>
        : <div key={i} className="space-y-1">{block.texts.map((t, j) => <p key={j} className="text-[15px] text-slate-900 leading-relaxed">{t}</p>)}</div>;
      case "intro": return <p key={i} className="text-[15px] font-bold text-slate-900 leading-relaxed">{block.texts[0]}</p>;
      case "stimulus": return <div key={i} className="border-l-4 border-blue-500 pl-4 space-y-1.5">{block.texts.map((t, j) => <p key={j} className="text-[15px] italic text-blue-900 leading-relaxed">{t}</p>)}</div>;
      case "task": return <p key={i} className="text-[15px] font-bold text-slate-900 leading-relaxed">{block.texts[0]}</p>;
      case "requirement": return <p key={i} className="text-[14px] italic text-slate-500 leading-relaxed">{block.texts[0]}</p>;
      default: return null;
    }
  };

  const renderBoldQuotes = (text: string) =>
    text.split(/('(?:[^']+)')/g).map((part, i) =>
      /^'[^']+'$/.test(part)
        ? <strong key={i} className="font-semibold text-slate-800 not-italic">{part}</strong>
        : part
    );

  const currentResult = reviewScores?.results?.[taskNumber];
  const gradingBanner = isGradingPending && (
    <div className="flex-shrink-0 w-64 bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm">
      <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
      <p className="text-xs font-bold text-amber-700 text-center">AI đang chấm Writing...</p>
      <p className="text-[11px] text-amber-600 text-center">Kết quả sẽ tự động hiện ra khi xong.</p>
    </div>
  );
  const scorePanel = reviewScores && (
    <div className="flex-shrink-0 flex gap-3 items-start sticky top-4">
      {/* criteria + feedback side by side */}
      {currentResult ? (
        <>
          {/* Criteria sub-column */}
          {Object.keys(currentResult.criteria ?? {}).length > 0 && (
            <div className="w-64 flex-shrink-0 bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tiêu chí — Task {taskNumber}</p>
              {Object.entries(currentResult.criteria).map(([name, score]) => {
                const comment = currentResult.criterion_comments?.[name];
                return (
                  <div key={name} className="space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-700 font-medium flex-1 leading-tight">{name}</span>
                      <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${(score ?? 0) >= 7 ? "text-emerald-600" : (score ?? 0) >= 5 ? "text-amber-600" : "text-red-500"}`}>
                        {score !== null ? score.toFixed(1) : "—"}
                      </span>
                    </div>
                    {comment && (
                      <p className="text-[11px] text-slate-500 leading-relaxed italic pl-0.5">{renderBoldQuotes(comment)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Feedback + Suggestions sub-column */}
          {(currentResult.feedback || (currentResult.suggestions ?? []).length > 0) && (
            <div className="w-64 flex-shrink-0 bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              {currentResult.feedback && (
                <div>
                  <p className="text-xs font-bold text-sky-700 uppercase tracking-wider mb-1.5">Nhận xét AI</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{renderBoldQuotes(currentResult.feedback)}</p>
                </div>
              )}
              {currentResult.feedback && (currentResult.suggestions ?? []).length > 0 && (
                <div className="border-t border-slate-100" />
              )}
              {(currentResult.suggestions ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">Gợi ý cải thiện</p>
                  <ul className="space-y-1.5">
                    {currentResult.suggestions.map((s: string, i: number) => (
                      <li key={i} className="text-xs text-slate-700 leading-relaxed flex gap-1.5">
                        <span className="flex-shrink-0 text-emerald-500 font-bold">•</span>
                        <span>{renderBoldQuotes(s)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {!currentResult.feedback && Object.keys(currentResult.criteria ?? {}).length === 0 && (
            <div className="w-64 flex-shrink-0 bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-400 italic">Chưa có nhận xét chi tiết cho Task {taskNumber}.</p>
            </div>
          )}
        </>
      ) : (
        <div className="w-64 flex-shrink-0 bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-xs text-slate-400 italic">Chưa có kết quả AI cho Task {taskNumber}.</p>
          <p className="text-[10px] text-slate-300 mt-1">AI sẽ chấm điểm sau khi bài được xử lý.</p>
        </div>
      )}

      {/* Rightmost: overall score + per-task scores */}
      <div className="w-52 flex-shrink-0 space-y-3">
        <div className="bg-white border border-amber-200 rounded-xl p-4 text-center shadow-sm">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Điểm Writing</p>
          {reviewScores.overall !== null ? (
            <>
              <p className="text-5xl font-bold text-amber-500 tabular-nums">{reviewScores.overall}</p>
              <p className="text-xs text-slate-400 mt-1">/ 10</p>
              <p className="text-[11px] text-slate-500 mt-2">
                {reviewScores.overall >= 8 ? "Xuất sắc 🌟" : reviewScores.overall >= 6.5 ? "Tốt 👍" : reviewScores.overall >= 5 ? "Trung bình" : "Cần cải thiện"}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-400 mt-2 italic">Chưa chấm</p>
          )}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Điểm theo Task</p>
          {([1, 2] as const).map((t) => {
            const ts = reviewScores.tasks[t];
            const isActive = t === taskNumber;
            return (
              <div key={t} className={`flex items-center justify-between px-2 py-1 rounded-lg ${isActive ? "bg-amber-50 ring-1 ring-amber-200" : ""}`}>
                <span className={`text-sm font-medium ${isActive ? "text-amber-700" : "text-slate-600"}`}>Task {t}</span>
                {ts !== null && ts !== undefined && !isNaN(ts) ? (
                  <span className={`text-sm font-bold tabular-nums ${ts >= 7 ? "text-emerald-600" : ts >= 5 ? "text-amber-600" : "text-red-500"}`}>
                    {ts.toFixed(1)} <span className="text-slate-400 font-normal text-xs">/ 10</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 italic">Chưa chấm</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto bg-[#eef0f4]">
      <div className={`mx-auto px-8 py-8 ${reviewScores ? "max-w-[1400px] flex gap-6 items-start" : "max-w-4xl"}`}>
        <div className={`space-y-5 ${reviewScores ? "flex-1 min-w-0" : ""}`}>
          <div className="space-y-4">
            {renderBlocks.map((block, i) => renderBlock(block, i))}
          </div>
          <div className="bg-white border border-slate-300 rounded-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between">
              <span className="text-[14px] font-bold text-slate-800">Your answer:</span>
              <span className={`text-[13px] tabular-nums ${inRange && wordCount > 0 ? "text-emerald-600 font-semibold" : "text-slate-500"}`}>
                Word count: <strong>{wordCount}</strong>
                {minW > 0 && <span className="font-normal text-slate-400"> / {minW}–{maxW}</span>}
              </span>
            </div>
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={(e) => onBlur(e.target.value)}
              readOnly={readOnly}
              placeholder={readOnly ? "Bài viết đã nộp" : "Write your answer here..."}
              className={`w-full px-4 py-3 text-[15px] leading-[1.8] text-slate-800 outline-none resize-none min-h-[320px] placeholder:text-slate-300 ${readOnly ? "bg-slate-50 cursor-default" : ""}`}
            />
          </div>
        </div>
        {scorePanel || gradingBanner}
      </div>
    </div>
  );
}

/* ============================================================
 *  SPEAKING (identical to VstepExamPreview, examId as prop)
 * ============================================================ */
const SPEAKING_TIMES: Record<number, { prepSec: number; recSec: number }> = {
  1: { prepSec: 30, recSec: 3 * 60 },
  2: { prepSec: 60, recSec: 4 * 60 },
  3: { prepSec: 90, recSec: 5 * 60 },
};

const SPEAKING_INSTRUCTIONS: Record<number, { title: string; lines: string[] }> = {
  1: { title: "Part 1 — Social Interaction (3 minutes)", lines: ["In this part, the examiner will ask you some questions about familiar topics.", "Answer each question with at least 2–3 full sentences.", "Try to give reasons or examples to support your ideas."] },
  2: { title: "Part 2 — Solution Discussion (4 minutes)", lines: ["You will be given a situation along with three possible solutions (A, B, C).", "Discuss the advantages and disadvantages of each option.", "Then choose the best option and explain your reasons."] },
  3: { title: "Part 3 — Topic Development (5 minutes)", lines: ["You will be asked to develop a topic in detail.", "Organize your ideas clearly: introduction, main points with examples, conclusion.", "Make sure to address every follow-up question naturally in your talk."] },
};

function playBeep(durationMs = 350, freq = 880, volume = 0.25): Promise<void> {
  return new Promise((resolve) => {
    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = freq; gain.gain.value = volume;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationMs / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + durationMs / 1000);
      osc.onended = () => { ctx.close().catch(() => {}); resolve(); };
    } catch { resolve(); }
  });
}

function LiveMicWaveform({ stream }: { stream: MediaStream | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!stream) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    const audioCtx = new AC();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const buffer = new Uint8Array(analyser.fftSize);
    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(buffer);
      const w = canvas.width, h = canvas.height;
      ctx.fillStyle = "#e5e7eb"; ctx.fillRect(0, 0, w, h);
      ctx.lineWidth = 1.5; ctx.strokeStyle = "#475569"; ctx.beginPath();
      const slice = w / buffer.length; let x = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = buffer[i] / 128.0; const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        x += slice;
      }
      ctx.lineTo(w, h / 2); ctx.stroke();
    };
    draw();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      source.disconnect(); audioCtx.close().catch(() => {});
    };
  }, [stream]);
  return <canvas ref={canvasRef} width={400} height={150} className="w-full h-[150px] bg-slate-200 rounded" />;
}

// Chỉ thông báo NGẮN GỌN học viên đang ở Part mấy + thời gian nói,
// KHÔNG đọc lại toàn bộ đề (đề đã hiển thị trên màn hình) để tiết kiệm thời gian.
function buildSpeakingPrompt(_part: SpeakingPart, partNumber: number): string {
  const PART_NAMES: Record<number, string> = {
    1: "Social Interaction",
    2: "Solution Discussion",
    3: "Topic Development",
  };
  const recSec = SPEAKING_TIMES[partNumber]?.recSec ?? 180;
  const minutes = Math.max(1, Math.round(recSec / 60));
  const name = PART_NAMES[partNumber];
  const intro = name ? `Part ${partNumber}, ${name}.` : `Part ${partNumber}.`;
  return `${intro} You have ${minutes} minute${minutes > 1 ? "s" : ""}. Please read the question on the screen, then start speaking after the beep.`;
}

function formatPartContent(part: SpeakingPart, partNumber: number): React.ReactNode {
  const inst = SPEAKING_INSTRUCTIONS[partNumber];
  const Header = inst && (
    <div className="bg-pink-50 border-l-4 border-pink-400 rounded-r-md px-4 py-3 mb-4">
      <p className="text-[13px] font-bold text-pink-900 mb-1">{inst.title}</p>
      <ul className="text-[13px] text-pink-800 space-y-0.5">
        {inst.lines.map((l, i) => <li key={i} className="flex gap-2"><span className="text-pink-400">•</span><span>{l}</span></li>)}
      </ul>
    </div>
  );
  if (partNumber === 1 && part.part1Data) {
    return (
      <>{Header}<div className="text-[14px] text-slate-700 leading-[1.9]">
        {part.part1Data.map((topic, i) => {
          const linker = i === 0 ? "Let's start with the first topic." : i === 1 ? "Now, let's move on to the next topic." : "Finally, let's talk about another topic.";
          return (<div key={i} className={i > 0 ? "mt-3" : ""}><p className="italic text-slate-500">{linker}</p><p className="font-semibold">{topic.topicName}.</p>{topic.questions.map((q, j) => <p key={j}>- {q}</p>)}</div>);
        })}
      </div></>
    );
  }
  if (partNumber === 2 && part.part2Data) {
    return (
      <>{Header}<div className="text-[14px] text-slate-700 leading-[1.9] space-y-2">
        <p className="italic text-slate-500">Here is the situation:</p>
        <p>{part.part2Data.situation}</p>
        <p className="italic text-slate-500 mt-2">You have three options:</p>
        <div>{part.part2Data.solutions.map((s, i) => <p key={i}>- {String.fromCharCode(65 + i)}. {s}</p>)}</div>
        <p className="font-semibold pt-1">{part.part2Data.question}</p>
      </div></>
    );
  }
  if (partNumber === 3 && part.part3Data) {
    return (
      <>{Header}<div className="text-[14px] text-slate-700 leading-[1.9]">
        <p className="italic text-slate-500">Your topic is:</p>
        <p className="font-semibold mb-1">{part.part3Data.mainTopic}.</p>
        {part.part3Data.suggestedIdeas?.length > 0 && (<><p className="italic text-slate-500 mt-2">Some ideas you may consider:</p><ul>{part.part3Data.suggestedIdeas.map((idea, i) => <li key={i}>- {idea}</li>)}</ul></>)}
        <p className="italic text-slate-500 mt-2">Please address the following questions:</p>
        {part.part3Data.followUpQuestions.map((q, i) => <p key={i}>{i + 1}. {q}</p>)}
      </div></>
    );
  }
  return null;
}

function SpeakingPrepOverlay({ prepSec, partNumber, onDone, onSkip }: { prepSec: number; partNumber: number; onDone: () => void; onSkip: () => void }) {
  const [left, setLeft] = useState(prepSec);
  useEffect(() => {
    setLeft(prepSec);
    const id = setInterval(() => setLeft((s) => { if (s <= 1) { clearInterval(id); onDone(); return 0; } return s - 1; }), 1000);
    return () => clearInterval(id);
  }, [prepSec, partNumber]);
  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center px-6">
      <p className="text-slate-700 text-[15px] text-center max-w-md">Bài thi sẽ được thu âm trực tiếp trên trình duyệt.</p>
      <p className="text-slate-700 text-[15px] text-center mb-8">Vui lòng bật tiếng, cấp quyền thu âm (nếu có).</p>
      <p className="text-pink-600 text-xs font-bold uppercase tracking-widest mb-2">THỜI GIAN CHUẨN BỊ CÒN</p>
      <p className="text-pink-600 text-5xl font-bold tabular-nums">{left} <span className="text-2xl font-semibold">GIÂY</span></p>
      <div className="mt-10 flex gap-3">
        <button onClick={onSkip} className="px-5 py-2 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 transition-colors">Bỏ qua chuẩn bị →</button>
      </div>
      <p className="mt-4 text-[11px] text-slate-400 uppercase tracking-wider">Part {partNumber}</p>
    </div>
  );
}

function SpeakingQuestionScreen({ part, partNumber, submissionId, onComplete, reviewMode }: { part: SpeakingPart; partNumber: number; submissionId: number | null; onComplete?: (pn: number) => void; reviewMode?: boolean }) {
  const times = SPEAKING_TIMES[partNumber] ?? { prepSec: 30, recSec: 180 };
  type Phase = "intro" | "countdown3" | "recording" | "done";
  const [phase, setPhase] = useState<Phase>(reviewMode ? "done" : "intro");
  const [recLeft, setRecLeft] = useState(times.recSec);
  const [count3, setCount3] = useState(3);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [ttsProgress, setTtsProgress] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fmtSec = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const clearTimer = () => { if (timerRef.current) clearInterval(timerRef.current); };
  const partTitle = partNumber === 1 ? "Question 1: Social Interaction (3 minutes): Now, the test begins." : partNumber === 2 ? "Question 2: Solution Discussion (4 minutes)." : "Question 3: Topic Development (5 minutes).";

  useEffect(() => {
    if (reviewMode) { window.speechSynthesis?.cancel(); setPhase("done"); setTtsProgress(0); return; }
    setPhase("intro"); setAudioUrl(null); setTtsProgress(0);
    if (typeof window === "undefined" || !("speechSynthesis" in window)) { setPhase("countdown3"); return; }
    const text = buildSpeakingPrompt(part, partNumber);
    if (!text) { setPhase("countdown3"); return; }
    const total = Math.max(1, text.length);
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "en-US"; utt.rate = 0.95;
    utt.onboundary = (e: SpeechSynthesisEvent) => setTtsProgress(Math.min(1, e.charIndex / total));
    utt.onend = async () => { setTtsProgress(1); await playBeep(); setPhase("countdown3"); };
    utt.onerror = () => setPhase("countdown3");
    window.speechSynthesis.speak(utt);
    return () => { window.speechSynthesis.cancel(); };
  }, [partNumber, reviewMode]);

  useEffect(() => {
    if (phase !== "countdown3") return;
    setCount3(3);
    const id = setInterval(() => setCount3((c) => { if (c <= 1) { clearInterval(id); startRecording(); return 0; } return c - 1; }), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream); chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        setMicStream(null); setPhase("done"); onComplete?.(partNumber);
        // Upload recording to server silently (fire-and-forget)
        if (submissionId) {
          studentApi.uploadSpeakingAudio(submissionId, partNumber, blob).catch(() => {
            // Non-critical — local playback still works even if upload fails
          });
        }
      };
      mr.start(); mediaRef.current = mr; setPhase("recording"); setRecLeft(times.recSec); clearTimer();
      timerRef.current = setInterval(() => setRecLeft((c) => { if (c <= 1) { clearTimer(); mr.stop(); return 0; } return c - 1; }), 1000);
    } catch {
      alert("Không thể truy cập microphone. Vui lòng cho phép quyền ghi âm.");
      setPhase("done");
    }
  };

  const stopRecording = () => { clearTimer(); mediaRef.current?.stop(); };
  const skipIntro = () => { window.speechSynthesis?.cancel(); setPhase("countdown3"); };
  const reset = () => {
    clearTimer(); window.speechSynthesis?.cancel(); mediaRef.current?.stop();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null); setMicStream(null); setPhase("intro"); setTtsProgress(0);
    setTimeout(() => {
      const text = buildSpeakingPrompt(part, partNumber);
      if (!text || !("speechSynthesis" in window)) { setPhase("countdown3"); return; }
      const total = Math.max(1, text.length);
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = "en-US"; utt.rate = 0.95;
      utt.onboundary = (e: SpeechSynthesisEvent) => setTtsProgress(Math.min(1, e.charIndex / total));
      utt.onend = async () => { setTtsProgress(1); await playBeep(); setPhase("countdown3"); };
      utt.onerror = () => setPhase("countdown3");
      window.speechSynthesis.speak(utt);
    }, 100);
  };

  useEffect(() => () => { clearTimer(); window.speechSynthesis?.cancel(); mediaRef.current?.stop(); }, []);

  const isRecording = phase === "recording";
  const showRightPanel = isRecording || phase === "done" || phase === "countdown3";

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {!reviewMode && isRecording && (<div className="flex justify-center mb-5"><div className="bg-red-50 border border-red-200 px-5 py-1.5 rounded-md"><span className="text-2xl font-bold tabular-nums text-red-600">{fmtSec(recLeft)}</span></div></div>)}
      {!reviewMode && phase === "countdown3" && (<div className="flex justify-center mb-5"><div className="bg-amber-50 border border-amber-200 px-5 py-1.5 rounded-md"><span className="text-xs font-semibold text-amber-700 mr-2">Bắt đầu sau</span><span className="text-2xl font-bold tabular-nums text-amber-600">{count3}</span></div></div>)}
      <div className={`grid gap-6 ${!reviewMode && showRightPanel ? "grid-cols-1 md:grid-cols-[1fr_360px]" : "grid-cols-1"}`}>
        <div>
          <p className="font-bold text-slate-900 mb-3">{partTitle.split(":")[0]}: <em className="font-semibold">{partTitle.substring(partTitle.indexOf(":") + 1).trim()}</em></p>
          {!reviewMode && (
            <>
              <div className="bg-slate-100 rounded-full px-4 py-2 flex items-center gap-3 mb-3 max-w-md select-none">
                <div className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center" aria-hidden>
                  {phase === "intro" ? <Pause className="w-3.5 h-3.5 text-slate-700" /> : <Play className="w-3.5 h-3.5 text-slate-700" />}
                </div>
                <div className="flex-1 h-1 bg-slate-300 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-600 transition-[width] duration-200 ease-linear" style={{ width: `${phase === "intro" ? Math.round(ttsProgress * 100) : 100}%` }} />
                </div>
                <Volume2 className="w-4 h-4 text-slate-500" />
              </div>
              <p className="italic text-red-500 text-[12px] mb-4">"Nếu trình duyệt không tự động phát, vui lòng bấm nút Play để nghe câu hỏi."</p>
            </>
          )}
          <div className="text-slate-800">{formatPartContent(part, partNumber)}</div>
          {!reviewMode && audioUrl && (<div className="mt-5"><p className="text-xs font-semibold text-slate-700 mb-2">Bài thu của bạn:</p><audio controls src={audioUrl} className="w-full h-10" /></div>)}
          {!reviewMode && (
            <div className="mt-5 flex gap-2">
              {phase === "recording" && (<button onClick={stopRecording} className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"><Pause className="w-4 h-4" /> Dừng ghi âm</button>)}
              {(phase === "recording" || phase === "done") && (<button onClick={reset} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"><RotateCcw className="w-4 h-4" /> Làm lại</button>)}
            </div>
          )}
        </div>
        {showRightPanel && (
          <div className="flex flex-col items-center">
            <div className="w-full bg-slate-200 rounded-md overflow-hidden">
              {isRecording ? <LiveMicWaveform stream={micStream} /> : <div className="w-full h-[150px] flex items-center justify-center text-slate-400 text-xs">{phase === "countdown3" ? "Chuẩn bị ghi âm..." : "Đã ghi âm xong"}</div>}
            </div>
            {isRecording && (<div className="mt-3 text-center"><p className="text-[11px] font-bold text-red-500 uppercase tracking-wider">Bài nói đang được thu âm trực tiếp</p></div>)}
          </div>
        )}
      </div>
    </div>
  );
}

function SpeakingView({
  part, partNumber, examId, submissionId, onComplete, reviewMode, reviewAudioUrl, reviewSpeakingScore, reviewSpeakingResults, isGradingPending,
}: {
  part?: SpeakingPart;
  partNumber: number;
  examId: string;
  submissionId: number | null;
  onComplete?: (pn: number) => void;
  reviewMode?: boolean;
  reviewAudioUrl?: string;
  reviewSpeakingScore?: number | null;
  reviewSpeakingResults?: Record<number, { score: number | null; criteria: Record<string, number | null>; criterion_comments?: Record<string, string | null>; feedback: string; suggestions: string[]; pronunciation_score?: number; content_score?: number; transcript?: string }>;
  isGradingPending?: boolean;
}) {
  const LS_PREP = `svstep_speaking_prep_${examId}`;
  const [viewPhase, setViewPhase] = useState<"prep" | "questions">(() => {
    try { const done = JSON.parse(localStorage.getItem(LS_PREP) || "{}"); return done[partNumber] ? "questions" : "prep"; } catch { return "prep"; }
  });
  useEffect(() => {
    if (reviewMode) { setViewPhase("questions"); return; }
    try { const done = JSON.parse(localStorage.getItem(LS_PREP) || "{}"); setViewPhase(done[partNumber] ? "questions" : "prep"); } catch { setViewPhase("prep"); }
  }, [partNumber, reviewMode]);
  const finishPrep = () => {
    try { const done = JSON.parse(localStorage.getItem(LS_PREP) || "{}"); done[partNumber] = true; localStorage.setItem(LS_PREP, JSON.stringify(done)); } catch {}
    setViewPhase("questions");
  };

  const renderBoldQuotes = (text: string) =>
    text.split(/('(?:[^']+)')/g).map((part, i) =>
      /^'[^']+'$/.test(part) ? <strong key={i} className="font-semibold text-slate-800 not-italic">{part}</strong> : part
    );

  if (!part) return <EmptyState skill="speaking" />;
  const subtitle = partNumber === 1 ? "Social Interaction" : partNumber === 2 ? "Solution Discussion" : "Topic Development";
  const times = SPEAKING_TIMES[partNumber] ?? { prepSec: 30, recSec: 180 };
  const questionCount = partNumber === 1 ? (part.part1Data?.reduce((s, t) => s + t.questions.length, 0) || 0) : partNumber === 2 ? 1 : 1 + (part.part3Data?.followUpQuestions.length || 0);
  if (!reviewMode && viewPhase === "prep") return <SpeakingPrepOverlay prepSec={times.prepSec} partNumber={partNumber} onDone={finishPrep} onSkip={finishPrep} />;

  const partResult = reviewSpeakingResults?.[partNumber];
  const spGradingBanner = reviewMode && isGradingPending && !partResult && (
    <div className="flex-shrink-0 w-64 bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm sticky top-4">
      <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
      <p className="text-xs font-bold text-amber-700 text-center">AI đang chấm Speaking...</p>
      <p className="text-[11px] text-amber-600 text-center">Kết quả sẽ tự động hiện ra khi xong.</p>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto bg-[#eef0f4]">
      <div className={`mx-auto px-6 pt-4 pb-6 ${reviewMode && (partResult || spGradingBanner) ? "max-w-[1400px] flex gap-4 items-start" : "max-w-4xl space-y-4"}`}>
        {/* Main content column */}
        <div className={reviewMode && partResult ? "flex-1 min-w-0 space-y-4" : ""}>
          <PartHeader icon={Mic} color="pink" title={`Part ${partNumber}`} subtitle={`${subtitle} · ${questionCount} câu`} />
          {reviewMode && (
            <div className="bg-white border border-pink-200 rounded-xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-pink-700 flex items-center gap-2">
                  <Mic className="w-4 h-4" />
                  Bài nói đã nộp — Part {partNumber}
                </span>
                {reviewSpeakingScore !== null && reviewSpeakingScore !== undefined && (
                  <span className="px-3 py-1 rounded-full text-sm font-bold bg-pink-100 text-pink-700">
                    AI chấm: {reviewSpeakingScore}/10
                  </span>
                )}
              </div>
              {reviewAudioUrl ? (
                <audio controls src={reviewAudioUrl} className="w-full rounded-lg" style={{ accentColor: '#EC4899' }} />
              ) : (
                <p className="text-sm text-slate-400 italic">Chưa có bài ghi âm cho phần này.</p>
              )}
              {partResult?.transcript && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Transcript (AI)</p>
                  <p className="text-xs text-slate-700 leading-relaxed italic">{partResult.transcript}</p>
                </div>
              )}
            </div>
          )}
          <SpeakingQuestionScreen part={part} partNumber={partNumber} submissionId={reviewMode ? null : submissionId} onComplete={reviewMode ? undefined : onComplete} reviewMode={reviewMode} />
        </div>

        {/* Grading banner or review panel */}
        {spGradingBanner}
        {reviewMode && partResult && !isGradingPending && (
          <div className="flex-shrink-0 flex gap-3 items-start sticky top-4">
            {/* Criteria column */}
            {Object.keys(partResult.criteria ?? {}).length > 0 && (
              <div className="w-64 bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tiêu chí — Part {partNumber}</p>
                {Object.entries(partResult.criteria).map(([name, score]) => {
                  const comment = partResult.criterion_comments?.[name];
                  return (
                    <div key={name} className="space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-700 font-medium flex-1 leading-tight">{name}</span>
                        <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${(score ?? 0) >= 7 ? "text-emerald-600" : (score ?? 0) >= 5 ? "text-amber-600" : "text-red-500"}`}>
                          {score !== null ? (score as number).toFixed(1) : "—"}
                        </span>
                      </div>
                      {comment && <p className="text-[11px] text-slate-500 leading-relaxed italic pl-0.5">{renderBoldQuotes(comment)}</p>}
                    </div>
                  );
                })}
                {(partResult.pronunciation_score !== undefined || partResult.content_score !== undefined) && (
                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    {partResult.pronunciation_score !== undefined && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Phát âm (Whisper)</span>
                        <span className="font-bold text-slate-600">{partResult.pronunciation_score.toFixed(1)}</span>
                      </div>
                    )}
                    {partResult.content_score !== undefined && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Nội dung (LLM)</span>
                        <span className="font-bold text-slate-600">{partResult.content_score.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Feedback + Suggestions column */}
            <div className="w-64 space-y-3">
              {/* Overall score */}
              <div className="bg-white border border-pink-200 rounded-xl p-4 text-center shadow-sm">
                <p className="text-xs font-bold text-pink-600 uppercase tracking-wider mb-1">Điểm Speaking</p>
                {reviewSpeakingScore !== null && reviewSpeakingScore !== undefined ? (
                  <>
                    <p className="text-4xl font-bold text-pink-500 tabular-nums">{reviewSpeakingScore}</p>
                    <p className="text-xs text-slate-400 mt-1">/ 10</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {reviewSpeakingScore >= 8 ? "Xuất sắc 🌟" : reviewSpeakingScore >= 6.5 ? "Tốt 👍" : reviewSpeakingScore >= 5 ? "Trung bình" : "Cần cải thiện"}
                    </p>
                    <p className="text-[11px] text-pink-400 mt-1 font-medium">Part {partNumber}: {partResult.score?.toFixed(1) ?? "—"} / 10</p>
                  </>
                ) : <p className="text-sm text-slate-400 italic">Chưa chấm</p>}
              </div>

              {/* AI feedback + suggestions */}
              {(partResult.feedback || (partResult.suggestions ?? []).length > 0) && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                  {partResult.feedback && (
                    <div>
                      <p className="text-xs font-bold text-sky-700 uppercase tracking-wider mb-1.5">Nhận xét AI</p>
                      <p className="text-xs text-slate-700 leading-relaxed">{renderBoldQuotes(partResult.feedback)}</p>
                    </div>
                  )}
                  {partResult.feedback && (partResult.suggestions ?? []).length > 0 && <div className="border-t border-slate-100" />}
                  {(partResult.suggestions ?? []).length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">Gợi ý cải thiện</p>
                      <ul className="space-y-1.5">
                        {partResult.suggestions.map((s, i) => (
                          <li key={i} className="text-xs text-slate-700 leading-relaxed flex gap-1.5">
                            <span className="flex-shrink-0 text-emerald-500 font-bold">•</span>
                            <span>{renderBoldQuotes(s)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
 *  SHARED HELPER COMPONENTS
 * ============================================================ */
function PartHeader({ icon: Icon, color, title, subtitle }: { icon: any; color: "sky" | "emerald" | "amber" | "pink"; title: string; subtitle?: string }) {
  const palette: Record<string, { from: string; to: string; border: string; titleColor: string; iconFrom: string; iconTo: string; glow: string }> = {
    sky:     { from: "#0EA5E9", to: "#0284C7", border: "rgba(14,165,233,0.28)", titleColor: "#0C4A6E", iconFrom: "#38BDF8", iconTo: "#0284C7", glow: "rgba(14,165,233,0.18)" },
    emerald: { from: "#10B981", to: "#059669", border: "rgba(16,185,129,0.28)", titleColor: "#064E3B", iconFrom: "#34D399", iconTo: "#059669", glow: "rgba(16,185,129,0.18)" },
    amber:   { from: "#F59E0B", to: "#D97706", border: "rgba(245,158,11,0.28)", titleColor: "#78350F", iconFrom: "#FCD34D", iconTo: "#D97706", glow: "rgba(245,158,11,0.18)" },
    pink:    { from: "#EC4899", to: "#DB2777", border: "rgba(236,72,153,0.28)", titleColor: "#831843", iconFrom: "#F472B6", iconTo: "#DB2777", glow: "rgba(236,72,153,0.18)" },
  };
  const p = palette[color];
  return (
    <div
      className="rounded-xl px-5 py-4 flex items-center gap-3"
      style={{
        background: `linear-gradient(135deg, ${p.from}14 0%, ${p.to}08 100%)`,
        border: `1.5px solid ${p.border}`,
        boxShadow: `0 4px 16px ${p.glow}, inset 0 1px 0 rgba(255,255,255,0.75)`,
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-white flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${p.iconFrom}, ${p.iconTo})`,
          boxShadow: `0 4px 14px ${p.glow}`,
        }}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <h2 className="text-lg font-bold" style={{ color: p.titleColor, letterSpacing: "-0.01em" }}>{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function QuestionNavigator({
  skill, currentPart, listeningParts, readingParts, answers, flagged, onJump, reviewMode, correctAnswersMap,
}: {
  skill: "listening" | "reading";
  currentPart: number;
  listeningParts: ListeningPart[];
  readingParts: ReadingPart[];
  answers: Record<string, "A" | "B" | "C" | "D">;
  flagged: Record<number, boolean>;
  onJump: (partNumber: number, qId: number) => void;
  reviewMode?: boolean;
  correctAnswersMap?: Record<number, string>;
}) {
  const partsData = skill === "listening"
    ? listeningParts.map(p => ({
        partNumber: p.partNumber,
        questions: p.sections.flatMap(s => s.questions),
      }))
    : readingParts.map(p => ({
        partNumber: p.partNumber,
        questions: p.questions,
      }));

  if (partsData.length === 0) return null;

  const accentBg = skill === "listening" ? "bg-sky-50" : "bg-emerald-50";
  const accentText = skill === "listening" ? "text-sky-700" : "text-emerald-700";
  const answeredCls = skill === "listening" ? "bg-sky-500 text-white hover:bg-sky-600" : "bg-emerald-500 text-white hover:bg-emerald-600";

  // Drag-to-move (per-skill position persisted in sessionStorage)
  const POS_KEY = `svstep_navpos_${skill}`;
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try { const v = sessionStorage.getItem(POS_KEY); if (v) return JSON.parse(v); } catch {}
    return { x: 0, y: 0 };
  });
  useEffect(() => {
    try { sessionStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch {}
  }, [pos, POS_KEY]);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: dragRef.current.ox + (ev.clientX - dragRef.current.sx),
        y: dragRef.current.oy + (ev.clientY - dragRef.current.sy),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <aside
      className="hidden lg:block absolute top-3 bottom-3 right-20 w-[210px] overflow-y-auto z-20"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
    >
      <div className="bg-white border border-slate-200 rounded-lg shadow-md overflow-hidden">
      <div
        onMouseDown={onDragStart}
        onDoubleClick={() => setPos({ x: 0, y: 0 })}
        title="Kéo để di chuyển · Double-click để reset vị trí"
        className={`px-3 py-2 ${accentBg} ${accentText} border-b border-slate-200 text-xs font-bold uppercase tracking-wide cursor-move select-none flex items-center justify-between`}
      >
        <span>Danh sách câu — {skill === "listening" ? "Listening" : "Reading"}</span>
        <span className="opacity-50">⋮⋮</span>
      </div>
      <div className="p-3 space-y-4">
        {partsData.map(p => (
          <div key={p.partNumber}>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[11px] font-bold ${currentPart === p.partNumber ? accentText : "text-slate-500"}`}>
                Part {p.partNumber}
              </span>
              <span className="text-[10px] text-slate-400">
                {p.questions.filter(q => answers[q.qId]).length}/{p.questions.length}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {p.questions.map(q => {
                const answered = !!answers[q.qId];
                const isFlagged = !!flagged[q.qId];
                const isCurrentPart = currentPart === p.partNumber;
                const isCorrect = reviewMode && answered && answers[q.qId] === correctAnswersMap?.[q.qId];
                const isWrong  = reviewMode && answered && answers[q.qId] !== correctAnswersMap?.[q.qId];
                const notAnswered = reviewMode && !answered;
                let btnCls: string;
                if (reviewMode) {
                  if (isCorrect)     btnCls = "bg-emerald-500 text-white hover:bg-emerald-600";
                  else if (isWrong)  btnCls = "bg-red-400 text-white hover:bg-red-500";
                  else               btnCls = "bg-slate-100 text-slate-400";
                } else {
                  btnCls = isFlagged
                    ? "bg-orange-500 text-white hover:bg-orange-600"
                    : answered ? answeredCls : "bg-slate-100 text-slate-600 hover:bg-slate-200";
                }
                return (
                  <button
                    key={q.qId}
                    onClick={() => onJump(p.partNumber, q.qId)}
                    title={`Câu ${q.questionNumber}${answered ? ` — đã chọn ${answers[q.qId]}` : ""}${
                      reviewMode
                        ? (isCorrect ? " ✓ Đúng" : isWrong ? ` ✕ Sai (đáp án: ${correctAnswersMap?.[q.qId]})` : " Chưa trả lời")
                        : (isFlagged ? " 🚩 đã gắn cờ" : "")
                    }`}
                    className={`relative h-7 rounded text-[11px] font-semibold transition-all ${btnCls} ${isCurrentPart ? "ring-2 ring-amber-400" : ""}`}
                  >
                    {q.questionNumber}
                    {!reviewMode && isFlagged && answered && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 border border-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      </div>
    </aside>
  );
}

function QuestionCard({ q, selected, onSelect, flagged, onToggleFlag, reviewMode, correctAnswer }: {
  q: Q;
  selected?: "A" | "B" | "C" | "D";
  onSelect: (l: "A" | "B" | "C" | "D") => void;
  flagged?: boolean;
  onToggleFlag?: () => void;
  reviewMode?: boolean;
  correctAnswer?: "A" | "B" | "C" | "D";
}) {
  const letters: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];
  const isAnsweredCorrectly = reviewMode && selected && selected === correctAnswer;
  return (
    <div id={`q-${q.qId}`} className={`border rounded-lg p-4 transition-colors scroll-mt-24 ${
      reviewMode
        ? (isAnsweredCorrectly ? "border-emerald-300 bg-emerald-50/30" : selected ? "border-red-300 bg-red-50/20" : "border-slate-200")
        : (flagged ? "border-orange-400 bg-orange-50/40" : "border-slate-200 hover:border-slate-300")
    }`}>
      <div className="flex items-start gap-3 mb-3">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Question</span>
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            reviewMode
              ? (isAnsweredCorrectly ? "bg-emerald-500 text-white" : selected ? "bg-red-400 text-white" : "bg-slate-400 text-white")
              : "bg-amber-500 text-white"
          }`}>{q.questionNumber}</span>
          <span className="text-slate-400 font-semibold">:</span>
        </div>
        <p className="text-slate-800 font-medium flex-1">{q.questionText}</p>
        {reviewMode && !selected && (
          <span className="flex-shrink-0 text-[10px] font-bold text-slate-400 border border-slate-300 rounded px-1.5 py-0.5 ml-1">Bỏ trống</span>
        )}
        {onToggleFlag && (
          <button
            type="button"
            onClick={onToggleFlag}
            title={flagged ? "Bỏ cờ câu này" : "Gắn cờ để xem lại sau"}
            className={`flex-shrink-0 p-1.5 rounded-md transition-colors ${flagged ? "text-orange-600 bg-orange-100 hover:bg-orange-200" : "text-slate-400 hover:text-orange-500 hover:bg-orange-50"}`}
          >
            <Flag className={`w-4 h-4 ${flagged ? "fill-current" : ""}`} />
          </button>
        )}
      </div>
      <div className="space-y-1.5 ml-10">
        {letters.map((l) => {
          const isSel = selected === l;
          const isCorrect = l === correctAnswer;
          const text = q.options?.[l];
          if (!text) return null;
          // Review mode colours
          let rowCls = "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50";
          let dotCls = "bg-slate-100 text-slate-600";
          if (reviewMode) {
            if (isSel && isCorrect)  { rowCls = "border-emerald-500 bg-emerald-50"; dotCls = "bg-emerald-500 text-white"; }
            else if (isSel && !isCorrect) { rowCls = "border-red-400 bg-red-50";  dotCls = "bg-red-400 text-white"; }
            else if (!isSel && isCorrect) { rowCls = "border-emerald-400 bg-emerald-50/60"; dotCls = "bg-emerald-400 text-white"; }
          } else {
            if (isSel) { rowCls = "border-emerald-500 bg-emerald-50"; dotCls = "bg-emerald-500 text-white"; }
          }
          return (
            <button key={l} onClick={() => reviewMode ? undefined : onSelect(l)} disabled={reviewMode}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left text-sm transition-all ${rowCls}`}
              style={reviewMode ? { cursor: "default" } : { cursor: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%237C3AED' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'/><path d='m15 5 4 4'/></svg>\") 0 20, auto" }}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${dotCls}`}>{l}</span>
              <span className={isSel || (reviewMode && isCorrect) ? "font-medium text-slate-900" : "text-slate-700"}>{text}</span>
              {reviewMode && isCorrect && !isSel && <span className="ml-auto text-[10px] font-bold text-emerald-600 flex-shrink-0">✓ Đáp án</span>}
              {reviewMode && isSel && !isCorrect && <span className="ml-auto text-[10px] font-bold text-red-500 flex-shrink-0">✕ Sai</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function AudioPlayer({ src, reviewMode = false }: { src?: string; reviewMode?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seekRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [played, setPlayed] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const progress = duration ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    // Reset state for new src
    setPlaying(false); setCurrentTime(0); setDuration(0); setPlayed(false); setLoadError(false);
    const onTime    = () => setCurrentTime(a.currentTime);
    const onLoaded  = () => setDuration(a.duration || 0);
    const onEnded   = () => { setPlaying(false); setCurrentTime(0); };
    const onError   = () => { setLoadError(true); console.error("[AudioPlayer] Failed to load:", src); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("durationchange", onLoaded);
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);
    // Force reload so the browser actually fetches the new src
    if (src) a.load();
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("durationchange", onLoaded);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
    };
  }, [src]);

  // Khi component unmount (rời trang/đổi part) → dừng audio đang phát.
  // Đặc biệt cần thiết cho review mode: rời sang skill khác mà audio vẫn chạy là khó chịu.
  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a && !a.paused) {
        try { a.pause(); } catch {}
      }
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    // Review mode: cho phép play/pause/replay tự do
    if (reviewMode) {
      if (a.paused) { a.play(); setPlaying(true); }
      else { a.pause(); setPlaying(false); }
      return;
    }
    // Exam mode: chỉ phát 1 lần
    if (played) return;
    a.play(); setPlaying(true); setPlayed(true);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (played && !reviewMode) return;
    const bar = seekRef.current; const a = audioRef.current;
    if (!bar || !a || !duration) return;
    const rect = bar.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
  };

  const toggleMute = () => { const a = audioRef.current; if (!a) return; const next = !muted; setMuted(next); a.muted = next; };
  const fmt = (s: number) => { if (!isFinite(s)) return "00:00"; return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`; };
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  if (!src) {
    return (<div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3 text-slate-400 text-sm"><div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><Volume2 className="w-5 h-5" /></div>Chưa có audio cho phần này</div>);
  }

  if (loadError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1.5">
        <div className="flex items-center gap-2 text-red-700 text-sm font-semibold">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Không thể tải file audio. Vui lòng liên hệ giáo viên.
        </div>
        <p className="text-[11px] text-red-400 font-mono break-all">{src}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="px-4 py-2.5 flex items-center gap-3">
        <button onClick={toggle} disabled={!reviewMode && played} title={reviewMode ? (playing ? "Tạm dừng" : "Phát") : (played ? "Bài nghe đã phát" : "Phát bài nghe")}
          className={`w-9 h-9 rounded-full text-white flex items-center justify-center transition-all flex-shrink-0 ${(!reviewMode && played) ? "bg-slate-300 cursor-not-allowed" : "bg-slate-900 hover:bg-slate-700 active:scale-95 cursor-pointer"}`}>
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <span className="text-xs font-mono text-slate-500 flex-shrink-0 w-10 text-right">{fmt(currentTime)}</span>
        <div ref={seekRef} onClick={seek} className={`relative flex-1 h-1.5 bg-slate-200 rounded-full group ${(!reviewMode && played) ? "cursor-default" : "cursor-pointer"}`}>
          <div className="absolute inset-y-0 left-0 bg-slate-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-slate-700 rounded-full border-2 border-white shadow opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `${progress}%` }} />
        </div>
        <span className="text-xs font-mono text-slate-400 flex-shrink-0 w-10">{fmt(duration)}</span>
        <button onClick={toggleMute} className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0 cursor-pointer"><VolumeIcon className="w-4 h-4" /></button>
      </div>
      {!reviewMode && !played && (<div className="px-4 py-1.5 bg-amber-50 border-t border-amber-100 flex items-center gap-1.5"><span className="text-[11px] text-amber-600">⚠ Bài nghe phát <strong>1 lần duy nhất</strong> — Nhấn Play khi sẵn sàng.</span></div>)}
    </div>
  );
}

function EmptyState({ skill }: { skill: SkillKey }) {
  const meta = SKILL_META[skill];
  const Icon = meta.icon;
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className={`w-16 h-16 ${meta.bg} rounded-full flex items-center justify-center mx-auto mb-4`}><Icon className={`w-8 h-8 ${meta.color}`} /></div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Chưa có nội dung</h3>
        <p className="text-sm text-slate-500">Phần {meta.label} của đề thi này chưa có dữ liệu được nhập.</p>
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router";
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
  Save,
  AlertCircle,
  Volume2,
  Volume1,
  VolumeX,
  User,
  RotateCcw,
} from "lucide-react";
import {
  loadVstepListeningExam,
  loadVstepExam,
  loadVstepWritingExam,
  loadVstepSpeakingExam,
} from "../../../../services/vstepApi";
import { api } from "../../../../services/api";
import { sanitizePassageHtml } from "../../../../utils/examUtils";
import { RichText } from "../../../../components/ui/RichText";

/* ============================================================
 *  TYPES
 * ============================================================ */
type SkillKey = "listening" | "reading" | "writing" | "speaking";

interface Choice { A: string; B: string; C: string; D: string }
interface Q { questionNumber: number; questionText: string; options: Choice; correctAnswer?: string }
interface ListeningSection { sectionNumber: number; sectionName: string; audioUrl: string; audioDuration?: number; transcript?: string; questions: Q[] }
interface ListeningPart { partNumber: number; partName?: string; sections: ListeningSection[] }
interface ReadingPart { partNumber: number; partName?: string; passage: string; questions: Q[] }
interface WritingTask { taskNumber: number; taskName: string; prompt: string; wordCount?: [number, number] | number; timeLimit?: number }
interface SpeakingPart {
  partNumber: number;
  part1Data?: Array<{ topicName: string; questions: string[] }>;
  part2Data?: { situation: string; solutions: string[]; question: string };
  part3Data?: { mainTopic: string; suggestedIdeas: string[]; followUpQuestions: string[] };
}

/* ============================================================
 *  CONSTANTS — VSTEP B2 chuẩn
 * ============================================================ */
const SKILL_TIME: Record<SkillKey, number> = {
  listening: 47,
  reading: 60,
  writing: 60,
  speaking: 12,
};
const SKILL_META: Record<SkillKey, { label: string; icon: any; color: string; bg: string }> = {
  listening: { label: "Listening", icon: Headphones, color: "text-sky-700", bg: "bg-sky-100" },
  reading:   { label: "Reading",   icon: BookOpen,   color: "text-emerald-700", bg: "bg-emerald-100" },
  writing:   { label: "Writing",   icon: PenLine,    color: "text-amber-700", bg: "bg-amber-100" },
  speaking:  { label: "Speaking",  icon: Mic,        color: "text-pink-700", bg: "bg-pink-100" },
};
const PARTS_PER_SKILL: Record<SkillKey, number[]> = {
  listening: [1, 2, 3],
  reading: [1, 2, 3, 4],
  writing: [1, 2],
  speaking: [1, 2, 3],
};

/* ============================================================
 *  COMPONENT
 * ============================================================ */
export function VstepExamPreview({ admin = false, backTo }: { admin?: boolean; backTo?: string } = {}) {
  const { examId } = useParams();
  const navigate = useNavigate();
  const backPath = backTo || "/giao-vien/de-thi";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examTitle, setExamTitle] = useState("VSTEP Exam");

  const [listeningParts, setListeningParts] = useState<ListeningPart[]>([]);
  const [readingParts, setReadingParts] = useState<ReadingPart[]>([]);
  const [writingTasks, setWritingTasks] = useState<WritingTask[]>([]);
  const [speakingParts, setSpeakingParts] = useState<SpeakingPart[]>([]);

  const SKILL_ORDER: SkillKey[] = ["listening", "reading", "writing", "speaking"];

  // Restore position from localStorage
  const [current, setCurrent] = useState<{ skill: SkillKey; partNumber: number }>(() => {
    try {
      const p = JSON.parse(localStorage.getItem(`vstep_progress_${examId}`) || "{}");
      if (p.skill && p.partNumber) return { skill: p.skill as SkillKey, partNumber: p.partNumber };
    } catch {}
    return { skill: "listening", partNumber: 1 };
  });
  const [maxSkillIdx, setMaxSkillIdx] = useState<number>(() => {
    try {
      const p = JSON.parse(localStorage.getItem(`vstep_progress_${examId}`) || "{}");
      return typeof p.maxSkillIdx === "number" ? p.maxSkillIdx : 0;
    } catch { return 0; }
  });
  const [visitedParts, setVisitedParts] = useState<Record<SkillKey, Set<number>>>(() => {
    try {
      const p = JSON.parse(localStorage.getItem(`vstep_progress_${examId}`) || "{}");
      if (p.visited) {
        return {
          listening: new Set<number>(p.visited.listening || [1]),
          reading:   new Set<number>(p.visited.reading   || []),
          writing:   new Set<number>(p.visited.writing   || []),
          speaking:  new Set<number>(p.visited.speaking  || []),
        };
      }
    } catch {}
    return { listening: new Set([1]), reading: new Set(), writing: new Set(), speaking: new Set() };
  });
  // ── localStorage keys (per exam) ────────────────────────────
  const LS_ANSWERS  = `vstep_answers_${examId}`;
  const LS_WRITING  = `vstep_writing_${examId}`;
  const LS_PROGRESS = `vstep_progress_${examId}`;

  const [answers, setAnswers] = useState<Record<string, "A" | "B" | "C" | "D">>(() => {
    try { return JSON.parse(localStorage.getItem(LS_ANSWERS) || "{}"); } catch { return {}; }
  });
  const [writingDrafts, setWritingDrafts] = useState<Record<number, string>>(() => {
    try { return JSON.parse(localStorage.getItem(LS_WRITING) || "{}"); } catch { return {}; }
  });
  const LS_SPEAKING_DONE = `vstep_speaking_done_${examId}`;
  const [speakingDone, setSpeakingDone] = useState<Record<number, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(LS_SPEAKING_DONE) || "{}"); } catch { return {}; }
  });

  // Auto-save to localStorage whenever answers/drafts/position change
  useEffect(() => {
    try { localStorage.setItem(LS_ANSWERS, JSON.stringify(answers)); } catch {}
  }, [answers]);
  useEffect(() => {
    try { localStorage.setItem(LS_WRITING, JSON.stringify(writingDrafts)); } catch {}
  }, [writingDrafts]);
  useEffect(() => {
    try { localStorage.setItem(LS_SPEAKING_DONE, JSON.stringify(speakingDone)); } catch {}
  }, [speakingDone]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_PROGRESS, JSON.stringify({
        skill: current.skill,
        partNumber: current.partNumber,
        maxSkillIdx,
        visited: {
          listening: [...visitedParts.listening],
          reading:   [...visitedParts.reading],
          writing:   [...visitedParts.writing],
          speaking:  [...visitedParts.speaking],
        },
      }));
    } catch {}
  }, [current, maxSkillIdx, visitedParts]);

  const [timeLeft, setTimeLeft] = useState(() => SKILL_TIME.listening * 60);
  const [bottomVisible, setBottomVisible] = useState(true);

  // Track furthest skill reached + visited parts
  const navigate2 = (skill: SkillKey, partNumber: number) => {
    const idx = SKILL_ORDER.indexOf(skill);
    setMaxSkillIdx((prev) => Math.max(prev, idx));
    setVisitedParts((prev) => ({
      ...prev,
      [skill]: new Set([...prev[skill], partNumber]),
    }));
    setCurrent({ skill, partNumber });
  };

  // Reset the displayed time when switching skill.
  // Preview mode does NOT count down — it just shows the allotted time per skill.
  useEffect(() => {
    setTimeLeft(SKILL_TIME[current.skill] * 60);
  }, [current.skill]);

  // Countdown disabled in preview mode (giáo viên chỉ xem trước, không tính giờ).

  // Guard: đề kids bị route nhầm sang preview VSTEP → chuyển về đúng trang kids.
  useEffect(() => {
    if (!examId) return;
    let cancelled = false;
    (async () => {
      try {
        const res: any = await api.get(`/teacher/exams/${examId}`);
        const ex = res?.data?.data ?? res?.data;
        const ageGroup = String(ex?.age_group ?? '').toLowerCase();
        const eType = String(ex?.eType ?? '').toUpperCase();
        const isKids = ageGroup === 'kids' || eType === 'KIDS' || ex?.kids_exam_config != null;
        if (!cancelled && isKids) {
          navigate(
            admin ? `/admin/de-thi/xem/kids/${examId}` : `/giao-vien/de-thi/${examId}/xem-moi`,
            { replace: true }
          );
        }
      } catch { /* bỏ qua — để luồng VSTEP tự xử lý */ }
    })();
    return () => { cancelled = true; };
  }, [examId, admin, navigate]);

  /* ── Load all 4 skills song song ──────────────────────────── */
  useEffect(() => {
    if (!examId) return;
    const id = String(examId);
    setLoading(true);
    Promise.allSettled([
      loadVstepListeningExam(id, admin),
      loadVstepExam(id, admin),
      loadVstepWritingExam(id, admin),
      loadVstepSpeakingExam(id, admin),
    ])
      .then((results) => {
        const [L, R, W, S] = results;

        if (L.status === "fulfilled") {
          const d = L.value?.data;
          setExamTitle(d?.title || "VSTEP Exam");
          setListeningParts(d?.parts || []);
        }
        if (R.status === "fulfilled") {
          const d = R.value?.data;
          setReadingParts(d?.parts || []);
          if (d?.title) setExamTitle((t) => d.title || t);
        }
        if (W.status === "fulfilled") {
          setWritingTasks(W.value?.data?.tasks || []);
        }
        if (S.status === "fulfilled") {
          setSpeakingParts(S.value?.data?.parts || []);
        }
      })
      .catch((e) => setError(e?.message || "Không thể tải đề thi"))
      .finally(() => setLoading(false));
  }, [examId]);

  /* ── Countdown timer — handled by per-skill useEffect above ── */

  /* ── Part completion check ───────────────────────────────── */
  const isPartComplete = (skill: SkillKey, pn: number): boolean => {
    if (skill === "listening") {
      const part = listeningParts.find((p) => p.partNumber === pn);
      if (!part) return false;
      const qs = part.sections.flatMap((s) => s.questions);
      return qs.length > 0 && qs.every((q) => answers[q.questionNumber]);
    }
    if (skill === "reading") {
      const part = readingParts.find((p) => p.partNumber === pn);
      if (!part) return false;
      return part.questions.length > 0 && part.questions.every((q) => answers[q.questionNumber]);
    }
    if (skill === "writing") {
      return !!writingDrafts[pn]?.trim();
    }
    if (skill === "speaking") {
      return !!speakingDone[pn];
    }
    return false;
  };

  /* ── Stats ────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const lq = listeningParts.reduce(
      (sum, p) => sum + p.sections.reduce((s, sec) => s + (sec.questions?.length || 0), 0),
      0
    );
    const rq = readingParts.reduce((sum, p) => sum + (p.questions?.length || 0), 0);
    const wq = writingTasks.length;
    const sq = speakingParts.reduce((sum, p) => {
      let n = 0;
      if (p.part1Data) n += p.part1Data.reduce((s, t) => s + t.questions.length, 0);
      if (p.part2Data) n += 1;
      if (p.part3Data) n += (p.part3Data.followUpQuestions?.length || 0) + 1;
      return sum + n;
    }, 0);
    const total = lq + rq + wq + sq;
    const answered = Object.keys(answers).length + Object.keys(writingDrafts).filter((k) => writingDrafts[+k]?.trim()).length;
    return { lq, rq, wq, sq, total, answered };
  }, [listeningParts, readingParts, writingTasks, speakingParts, answers, writingDrafts]);

  const setAnswer = (qNum: number, letter: "A" | "B" | "C" | "D") =>
    setAnswers((prev) => ({ ...prev, [qNum]: letter }));

  /* ── Format time ──────────────────────────────────────────── */
  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  /* ── Loading / error states ───────────────────────────────── */
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Đang tải đề thi...</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 mb-3">{error}</p>
          <Link to={backPath} className="text-blue-600 hover:underline">← Quay lại</Link>
        </div>
      </div>
    );
  }

  /* ── Render content theo skill đang chọn ──────────────────── */
  const renderContent = () => {
    if (current.skill === "listening") {
      const part = listeningParts.find((p) => p.partNumber === current.partNumber);
      return (
        <ListeningView
          part={part}
          partNumber={current.partNumber}
          answers={answers}
          onAnswer={setAnswer}
        />
      );
    }
    if (current.skill === "reading") {
      const part = readingParts.find((p) => p.partNumber === current.partNumber);
      return <ReadingView part={part} partNumber={current.partNumber} answers={answers} onAnswer={setAnswer} />;
    }
    if (current.skill === "writing") {
      const task = writingTasks.find((t) => t.taskNumber === current.partNumber);
      return (
        <WritingView
          task={task}
          taskNumber={current.partNumber}
          value={writingDrafts[current.partNumber] || ""}
          onChange={(v) => setWritingDrafts((p) => ({ ...p, [current.partNumber]: v }))}
        />
      );
    }
    const sp = speakingParts.find((p) => p.partNumber === current.partNumber);
    return (
      <SpeakingView
        part={sp}
        partNumber={current.partNumber}
        onComplete={(pn) => setSpeakingDone((prev) => ({ ...prev, [pn]: true }))}
      />
    );
  };

  /* ── Điều hướng next ──────────────────────────────────────── */
  const goNext = () => {
    const order: Array<{ skill: SkillKey; part: number }> = [];
    (Object.keys(PARTS_PER_SKILL) as SkillKey[]).forEach((s) => {
      PARTS_PER_SKILL[s].forEach((p) => order.push({ skill: s, part: p }));
    });
    const idx = order.findIndex((o) => o.skill === current.skill && o.part === current.partNumber);
    const next = order[idx + 1];
    if (next) navigate2(next.skill, next.part);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* ─── HEADER ─────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm z-30">
        <div className="px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(backPath)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Quay lại"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
              <User className="w-4 h-4" />
            </div>
            <div className="hidden md:block min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{examTitle}</p>
              <p className="text-xs text-slate-500 truncate">Chế độ xem trước · Giáo viên</p>
            </div>
          </div>

          {/* Timer — preview mode: hiển thị thời lượng cho phép, KHÔNG đếm ngược */}
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg border bg-slate-50 border-slate-200">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-lg font-bold tabular-nums text-slate-500">{fmtTime(timeLeft)}</span>
            <span className="text-[11px] font-medium hidden sm:inline text-slate-400">
              {SKILL_META[current.skill].label} · Không tính giờ (xem trước)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex text-sm text-slate-600">
              Đã trả lời <span className="font-bold text-slate-900">{stats.answered}</span>/{stats.total}
            </span>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled
              title="Chế độ preview - không nộp được"
            >
              <Save className="w-4 h-4" />
              Nộp bài
            </button>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT ───────────────────────────────────── */}
      <main className="flex-1 overflow-hidden min-h-0">{renderContent()}</main>

      {/* ─── BOTTOM PARTS BAR ───────────────────────────────── */}
      {bottomVisible && (
        <footer className="flex-shrink-0 bg-white border-t border-slate-200 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] overflow-visible">
          <div className="relative px-8 py-3 flex items-center justify-center gap-6 overflow-visible">
            {/* Group skills — căn giữa */}
            {(Object.keys(PARTS_PER_SKILL) as SkillKey[]).map((s) => {
              const meta = SKILL_META[s];
              const Icon = meta.icon;
              const totalSkillQs =
                s === "listening" ? stats.lq
                : s === "reading" ? stats.rq
                : s === "writing" ? stats.wq
                : stats.sq;
              const sIdx = SKILL_ORDER.indexOf(s);
              const lockedByTimer = current.skill === "listening" && timeLeft > 0 && s !== "listening";
              const pastSkill = sIdx < maxSkillIdx;
              return (
                <div key={s} className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className="flex items-center gap-1">
                    {PARTS_PER_SKILL[s].map((pn) => {
                      const isActive = current.skill === s && current.partNumber === pn;
                      const isVisited = visitedParts[s]?.has(pn);
                      const sameSkill = s === current.skill;
                      // Same skill → free navigate; different skill → need visited
                      const canClick = !lockedByTimer && !pastSkill && (sameSkill || isVisited);
                      const tooltip = pastSkill
                        ? "Không thể quay lại skill đã hoàn thành"
                        : lockedByTimer
                        ? "Không thể chuyển skill khi đang nghe"
                        : (!isVisited && !sameSkill)
                        ? "Nhấn Tiếp tục để chuyển đến phần này"
                        : undefined;
                      const showTip = !!tooltip && !isActive;
                      return (
                        <div key={pn} className="relative group">
                          <button
                            onClick={() => canClick && navigate2(s, pn)}
                            disabled={!canClick}
                            className={`relative px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                              isActive
                                ? "bg-amber-400 text-slate-900 shadow-sm"
                                : pastSkill
                                ? `${meta.bg} ${meta.color} opacity-40 cursor-not-allowed`
                                : canClick
                                ? `${meta.bg} ${meta.color} hover:brightness-95`
                                : `${meta.bg} ${meta.color} cursor-not-allowed`
                            }`}
                          >
                            Part {pn}
                            {isPartComplete(s, pn) && (
                              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[9px] font-bold leading-none">
                                ✓
                              </span>
                            )}
                          </button>
                          {showTip && (
                            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[200]
                                            invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-150">
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
                  <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold ${meta.bg} ${meta.color}`}>
                    <Icon className="w-3 h-3" />
                    {meta.label} - {totalSkillQs}
                    <span className="opacity-60">·</span>
                    <span className="opacity-70">{SKILL_TIME[s]}m</span>
                  </div>
                </div>
              );
            })}

            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 flex-shrink-0">
              <button
                onClick={goNext}
                className="px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md text-sm font-semibold transition-colors"
              >
                Tiếp tục
              </button>
              <button
                onClick={() => {
                  if (!confirm("Hoàn tất bài thi thử? Toàn bộ kết quả lưu tạm sẽ bị xóa.")) return;
                  try {
                    localStorage.removeItem(LS_ANSWERS);
                    localStorage.removeItem(LS_WRITING);
                    localStorage.removeItem(LS_PROGRESS);
                    localStorage.removeItem(LS_SPEAKING_DONE);
                    // Also clear speaking prep flags
                    Object.keys(localStorage)
                      .filter((k) => k.startsWith(`vstep_prep_${examId}`))
                      .forEach((k) => localStorage.removeItem(k));
                  } catch {}
                  navigate(backPath);
                }}
                className="px-4 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-md text-sm font-semibold transition-colors"
                title="Hoàn tất và quay lại danh sách đề"
              >
                Xong
              </button>
              <button
                onClick={() => setBottomVisible(false)}
                className="px-3 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1"
              >
                <EyeOff className="w-4 h-4" /> Ẩn menu
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
    </div>
  );
}

/* ============================================================
 *  LISTENING VIEW
 * ============================================================ */
function ListeningView({
  part,
  partNumber,
  answers,
  onAnswer,
}: {
  part?: ListeningPart;
  partNumber: number;
  answers: Record<string, "A" | "B" | "C" | "D">;
  onAnswer: (q: number, l: "A" | "B" | "C" | "D") => void;
}) {
  if (!part || !part.sections?.length) return <EmptyState skill="listening" />;

  // Part-specific instructions
  const PART_INSTRUCTIONS: Record<number, { count: string; type: string; qPer: string }> = {
    1: { count: "EIGHT short recordings",   type: "announcements / short talks", qPer: "one question following each recording" },
    2: { count: "THREE conversations",       type: "conversations between two speakers", qPer: "three questions following each conversation" },
    3: { count: "THREE talks or lectures",   type: "talks or academic lectures",  qPer: "four questions following each talk" },
  };
  const pi = PART_INSTRUCTIONS[partNumber];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        <PartHeader
          icon={Headphones}
          color="sky"
          title={`Part ${partNumber}`}
          subtitle={part.partName || (partNumber === 1 ? "Announcements" : partNumber === 2 ? "Conversations" : "Talks / Lectures")}
        />

        {/* ── VSTEP Listening instructions ───────────────── */}
        <div className="text-[14px] leading-relaxed text-slate-700 space-y-3">
          {/* General instructions — shown only on Part 1 */}
          {partNumber === 1 && (
            <p className="italic">
              You will listen to a number of different recordings and you will have to answer questions based on what you hear.
              There will be time for you to read the questions and check your work.
              All the recordings will be played <strong>ONCE</strong> only.
              While you are listening, you may take notes and choose the correct answer.
            </p>
          )}

          {/* Part-specific instruction */}
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

          {/* Example — only Part 1 */}
          {partNumber === 1 && (
            <div className="space-y-2 mt-1">
              <p className="italic text-slate-700">
                Now, let's listen to the example. On the recording, you might hear:
              </p>
              <div className="border-l-4 border-slate-300 pl-4">
                <p className="italic text-slate-600 text-[13px] leading-relaxed">
                  "Hi there! This is Nam Thu English Center calling to confirm your enrollment for next month's VSTEP B2 preparation course.
                  The course runs every Monday, Wednesday and Friday evening from 6 to 8 p.m. and will last for eight weeks.
                  The tuition fee covers all study materials and two mock tests. Please note that the final exam simulation
                  on the last Saturday is mandatory for all students. Feel free to call us back if you need any further information. Thank you!"
                </p>
              </div>
              <p className="italic text-slate-700">On the screen, you will read:</p>
              <p className="font-medium text-slate-900 text-[14px]">How many mock tests are included in the course fee?</p>
              <div className="space-y-0.5 text-[14px] text-slate-700">
                <p>A. One</p>
                <p className="font-bold text-slate-900">B. Two</p>
                <p>C. Three</p>
                <p>D. Four</p>
              </div>
              <p className="italic text-slate-700">
                The correct answer is <strong>B. Two</strong>
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

            <div className="p-5">
              {/* Sticky audio — dính dưới header khi scroll */}
              <div className="sticky top-0 z-10 -mx-5 px-5 py-2 bg-white/95 backdrop-blur-sm border-b border-slate-100">
                <AudioPlayer src={sec.audioUrl} />
              </div>

              <div className="mt-6 space-y-5">
                {sec.questions.map((q) => (
                  <QuestionCard
                    key={q.questionNumber}
                    q={q}
                    selected={answers[q.questionNumber]}
                    onSelect={(l) => onAnswer(q.questionNumber, l)}
                  />
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
 *  READING VIEW (2 cột)
 * ============================================================ */
function ReadingView({
  part,
  partNumber,
  answers,
  onAnswer,
}: {
  part?: ReadingPart;
  partNumber: number;
  answers: Record<string, "A" | "B" | "C" | "D">;
  onAnswer: (q: number, l: "A" | "B" | "C" | "D") => void;
}) {
  if (!part || !part.questions?.length) return <EmptyState skill="reading" />;

  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-[45%_55%] gap-4 p-4 overflow-hidden">
      {/* LEFT - Passage */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-0">
        <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-emerald-900">Reading Passage — Part {partNumber}</h3>
          </div>
          {part.partName && <span className="text-xs text-emerald-700">{part.partName}</span>}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <article
            className="vstep-passage prose prose-sm max-w-none text-slate-800 leading-relaxed whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: sanitizePassageHtml(part.passage || "") }}
          />
        </div>
      </div>

      {/* RIGHT - Questions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-0">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold text-slate-900">Questions ({part.questions.length})</h3>
          <span className="text-xs text-slate-500">
            {part.questions[0]?.questionNumber}–{part.questions[part.questions.length - 1]?.questionNumber}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {part.questions.map((q) => (
            <QuestionCard
              key={q.questionNumber}
              q={q}
              selected={answers[q.questionNumber]}
              onSelect={(l) => onAnswer(q.questionNumber, l)}
            />
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
  task,
  taskNumber,
  value,
  onChange,
}: {
  task?: WritingTask;
  taskNumber: number;
  value: string;
  onChange: (v: string) => void;
}) {
  if (!task) return <EmptyState skill="writing" />;

  const wordCount = useMemo(
    () =>
      value
        .replace(/<[^>]*>/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length,
    [value]
  );
  const range = Array.isArray(task.wordCount) ? task.wordCount : [0, 0];
  const [minW, maxW] = range as [number, number];
  const inRange = wordCount >= minW && (maxW === 0 || wordCount <= maxW);

  // ── Smart VSTEP prompt parser (v2) ──────────────────────────
  type SegType = "time" | "intro" | "context" | "stimulus" | "task" | "requirement";
  interface Seg { type: SegType; text: string }

  const parsedSegments = useMemo<Seg[]>(() => {
    const paras = (task.prompt || "")
      .split(/\n\s*\n|\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const segs: Seg[] = [];
    let stimulusMode = false;

    // Pre-filter: strip source attribution lines (IELTS, Cambridge, etc.)
    const ATTRIBUTION = /^(IELTS|Cambridge|British Council|IDP|TEST\s+\d+|Source:|Adapted from|—|–)/i;

    for (const para of paras) {
      // Skip attribution / source labels
      if (ATTRIBUTION.test(para)) continue;

      // 1. TIME instruction
      if (/you should spend.{0,40}minute/i.test(para)) {
        segs.push({ type: "time", text: para });
        stimulusMode = false;
        continue;
      }
      // 2. TASK directive — "Write an email/letter/essay/report..."
      if (/^(now )?write (an?|the|a) /i.test(para) || /^respond to /i.test(para)) {
        stimulusMode = false;
        segs.push({ type: "task", text: para });
        continue;
      }
      // 3. REQUIREMENT — word count, name rule, evaluation note
      if (
        /you should write|at least \d+|do not include your name|not allowed to use your name|evaluated in terms|your response will be|word limit|\(your response/i.test(para)
      ) {
        segs.push({ type: "requirement", text: para });
        continue;
      }
      // 4. STIMULUS INTRO — triggers blockquote mode (only once)
      if (
        !stimulusMode &&
        /read (part|the|an? extract|some) of|here is|below is|the following|look at the/i.test(para)
      ) {
        const prev = segs[segs.length - 1];
        if (prev?.type === "context") {
          segs[segs.length - 1] = { type: "intro", text: prev.text + " " + para };
        } else {
          segs.push({ type: "intro", text: para });
        }
        stimulusMode = true;
        continue;
      }
      // 5. In stimulus mode → quoted material
      if (stimulusMode) {
        segs.push({ type: "stimulus", text: para });
        continue;
      }
      // 6. Continuation: previous segment ends mid-sentence → merge
      {
        const prev = segs[segs.length - 1];
        if (prev && (prev.type === "task" || prev.type === "requirement") && !/[.!?]$/.test(prev.text)) {
          segs[segs.length - 1] = { type: prev.type, text: prev.text + " " + para };
          continue;
        }
      }
      // 7. Default → context
      segs.push({ type: "context", text: para });
    }
    return segs;
  }, [task.prompt]);

  // Đề Writing được giáo viên soạn bằng QuillEditor → nội dung là HTML
  // (chứa <p>, <ul>, <strong>, &nbsp;...). Segment-parser bên dưới chỉ xử lý
  // plain-text nên nếu prompt là HTML sẽ hiển thị nguyên thẻ. Phát hiện HTML
  // để render đúng qua sanitizePassageHtml + dangerouslySetInnerHTML.
  const promptIsHtml = /<\/?[a-z][\s\S]*>/i.test(task.prompt || "");

  // Task 1 = has stimulus/intro → blockquote style
  // Task 2 = no stimulus → context in bordered box, task italic
  const hasStimulus = parsedSegments.some((s) => s.type === "stimulus");

  // Group consecutive same-type context/stimulus segments into render blocks
  type RBlock = { type: SegType; texts: string[] };
  const renderBlocks = parsedSegments.reduce<RBlock[]>((acc, seg) => {
    const last = acc[acc.length - 1];
    if (last && last.type === seg.type && (seg.type === "context" || seg.type === "stimulus")) {
      last.texts.push(seg.text);
    } else {
      acc.push({ type: seg.type, texts: [seg.text] });
    }
    return acc;
  }, []);

  // Bold the time value inside the time instruction
  const renderTimeLine = (text: string) => {
    const parts = text.split(/(\d+\s*minutes?|\d+\s*phút)/i);
    return parts.map((part, i) =>
      /\d+\s*(minutes?|phút)/i.test(part)
        ? <strong key={i}>{part}</strong>
        : part
    );
  };

  const renderBlock = (block: RBlock, i: number) => {
    switch (block.type) {
      case "time":
        return (
          <p key={i} className="text-[14px] italic text-slate-600 leading-relaxed">
            {renderTimeLine(block.texts[0])}
          </p>
        );
      case "context":
        // Task 2 (no stimulus): the background passage IS the exam text → blue border
        if (!hasStimulus) {
          return (
            <div key={i} className="border-l-4 border-blue-500 pl-4 space-y-1.5">
              {block.texts.map((t, j) => (
                <p key={j} className="text-[15px] italic text-blue-900 leading-relaxed">{t}</p>
              ))}
            </div>
          );
        }
        // Task 1: plain context before the email quote
        return (
          <div key={i} className="space-y-1">
            {block.texts.map((t, j) => (
              <p key={j} className="text-[15px] text-slate-900 leading-relaxed">{t}</p>
            ))}
          </div>
        );
      case "intro":
        return (
          <p key={i} className="text-[15px] font-bold text-slate-900 leading-relaxed">
            {block.texts[0]}
          </p>
        );
      case "stimulus":
        return (
          <div key={i} className="border-l-4 border-blue-500 pl-4 space-y-1.5">
            {block.texts.map((t, j) => (
              <p key={j} className="text-[15px] italic text-blue-900 leading-relaxed">{t}</p>
            ))}
          </div>
        );
      case "task":
        return (
          <p key={i} className="text-[15px] font-bold text-slate-900 leading-relaxed">
            {block.texts[0]}
          </p>
        );
      case "requirement":
        return (
          <p key={i} className="text-[14px] italic text-slate-500 leading-relaxed">
            {block.texts[0]}
          </p>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#eef0f4]">
      <div className="max-w-3xl mx-auto px-8 py-8 space-y-5">

        {/* ── Prompt — no card, plain on bg ───────────────── */}
        <div className="space-y-4">
          {promptIsHtml ? (
            <article
              className="vstep-writing-prompt prose prose-sm max-w-none text-slate-800 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitizePassageHtml(task.prompt || "") }}
            />
          ) : (
            renderBlocks.map((block, i) => renderBlock(block, i))
          )}
        </div>

        {/* ── Answer area ─────────────────────────────────── */}
        <div className="bg-white border border-slate-300 rounded-sm overflow-hidden">
          {/* Header row */}
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
            placeholder="Write your answer here..."
            className="w-full px-4 py-3 text-[15px] leading-[1.8] text-slate-800 outline-none resize-none min-h-[320px] placeholder:text-slate-300"
          />
        </div>

      </div>
    </div>
  );
}

/* ============================================================
 *  SPEAKING — TIMES PER PART (VSTEP B2 standard)
 * ============================================================ */
const SPEAKING_TIMES: Record<number, { prepSec: number; recSec: number }> = {
  1: { prepSec: 30,  recSec: 3 * 60  }, // 30s prep · 3min record
  2: { prepSec: 60,  recSec: 4 * 60  }, // 60s prep · 4min record
  3: { prepSec: 90,  recSec: 5 * 60  }, // 90s prep · 5min record
};

/* ── Prep full-screen overlay ──────────────────────────── */
function SpeakingPrepOverlay({
  prepSec,
  partNumber,
  onDone,
  onSkip,
}: {
  prepSec: number;
  partNumber: number;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [left, setLeft] = useState(prepSec);
  useEffect(() => {
    setLeft(prepSec);
    const id = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) { clearInterval(id); onDone(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [prepSec, partNumber]);

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center px-6">
      <img
        src="https://luyenthivstep.vn/assets/image/headphone-man.png"
        alt="headphone"
        className="w-24 h-24 mb-6 object-contain"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
      <p className="text-slate-700 text-[15px] text-center max-w-md">
        Bài thi sẽ được thu âm trực tiếp trên trình duyệt.
      </p>
      <p className="text-slate-700 text-[15px] text-center mb-8">
        Vui lòng bật tiếng, cấp quyền thu âm (nếu có).
      </p>
      <p className="text-pink-600 text-xs font-bold uppercase tracking-widest mb-2">
        THỜI GIAN CHUẨN BỊ CÒN
      </p>
      <p className="text-pink-600 text-5xl font-bold tabular-nums">
        {left} <span className="text-2xl font-semibold">GIÂY</span>
      </p>
      <div className="mt-10 flex gap-3">
        <button
          onClick={onSkip}
          className="px-5 py-2 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 transition-colors"
        >
          Bỏ qua chuẩn bị →
        </button>
      </div>
      <p className="mt-4 text-[11px] text-slate-400 uppercase tracking-wider">Part {partNumber}</p>
    </div>
  );
}

/* ── Generate a beep sound via Web Audio API ──────────── */
function playBeep(durationMs = 350, freq = 880, volume = 0.25): Promise<void> {
  return new Promise((resolve) => {
    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = volume;
      // tiny fade in/out to avoid click
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationMs / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
      osc.onended = () => { ctx.close().catch(() => {}); resolve(); };
    } catch { resolve(); }
  });
}

/* ── Live mic waveform (audio intensity from mic) ─────── */
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
      ctx.fillStyle = "#e5e7eb"; // slate-200 bg
      ctx.fillRect(0, 0, w, h);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#475569"; // slate-600
      ctx.beginPath();
      const slice = w / buffer.length;
      let x = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = buffer[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        x += slice;
      }
      ctx.lineTo(w, h / 2);
      ctx.stroke();
    };
    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      source.disconnect();
      audioCtx.close().catch(() => {});
    };
  }, [stream]);

  return (
    <canvas ref={canvasRef} width={400} height={150} className="w-full h-[150px] bg-slate-200 rounded" />
  );
}

/* ── Instruction blocks per part ──────────────────────── */
const SPEAKING_INSTRUCTIONS: Record<number, { title: string; lines: string[] }> = {
  1: {
    title: "Part 1 — Social Interaction (3 minutes)",
    lines: [
      "In this part, the examiner will ask you some questions about familiar topics.",
      "Answer each question with at least 2–3 full sentences.",
      "Try to give reasons or examples to support your ideas.",
    ],
  },
  2: {
    title: "Part 2 — Solution Discussion (4 minutes)",
    lines: [
      "You will be given a situation along with three possible solutions (A, B, C).",
      "Discuss the advantages and disadvantages of each option.",
      "Then choose the best option and explain your reasons.",
    ],
  },
  3: {
    title: "Part 3 — Topic Development (5 minutes)",
    lines: [
      "You will be asked to develop a topic in detail.",
      "Organize your ideas clearly: introduction, main points with examples, conclusion.",
      "Make sure to address every follow-up question naturally in your talk.",
    ],
  },
};

// Shared fallback when teacher hasn't set up part content yet
function MissingPartContent({ partNumber }: { partNumber: number }) {
  const PART_NAMES: Record<number, string> = {
    1: "Social Interaction",
    2: "Solution Discussion",
    3: "Topic Development",
  };
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 px-6 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center">
      <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
        <span className="text-2xl">⚠️</span>
      </div>
      <p className="text-sm font-semibold text-slate-700">
        Nội dung Part {partNumber} ({PART_NAMES[partNumber]}) chưa được nhập.
      </p>
      <p className="text-xs text-slate-500">
        Vui lòng quay lại chỉnh sửa đề thi để nhập nội dung cho part này.
      </p>
    </div>
  );
}

/* ── Format part content as image-3 style text ──────── */
function formatPartContent(part: SpeakingPart, partNumber: number): React.ReactNode {
  const inst = SPEAKING_INSTRUCTIONS[partNumber];
  const Header = inst && (
    <div className="bg-pink-50 border-l-4 border-pink-400 rounded-r-md px-4 py-3 mb-4">
      <p className="text-[13px] font-bold text-pink-900 mb-1">{inst.title}</p>
      <ul className="text-[13px] text-pink-800 space-y-0.5">
        {inst.lines.map((l, i) => (
          <li key={i} className="flex gap-2"><span className="text-pink-400">•</span><span>{l}</span></li>
        ))}
      </ul>
    </div>
  );

  // ── Part 1: Social Interaction ──────────────────────────────────────────
  if (partNumber === 1) {
    if (!part.part1Data || part.part1Data.length === 0) {
      return <>{Header}<MissingPartContent partNumber={1} /></>;
    }
    return (
      <>
        {Header}
        <div className="text-[14px] text-slate-700 leading-[1.9]">
          {part.part1Data.map((topic, i) => {
            const linker = i === 0 ? "Let's start with the first topic." : i === 1 ? "Now, let's move on to the next topic." : "Finally, let's talk about another topic.";
            return (
              <div key={i} className={i > 0 ? "mt-3" : ""}>
                <p className="italic text-slate-500">{linker}</p>
                <p className="font-semibold">{topic.topicName}.</p>
                {topic.questions.map((q, j) => (
                  <p key={j}>- {q}</p>
                ))}
              </div>
            );
          })}
        </div>
      </>
    );
  }

  // ── Part 2: Solution Discussion ─────────────────────────────────────────
  if (partNumber === 2) {
    if (!part.part2Data) {
      return <>{Header}<MissingPartContent partNumber={2} /></>;
    }
    const hasSolutions = part.part2Data.solutions && part.part2Data.solutions.some(s => s && s.trim().length > 0);
    return (
      <>
        {Header}
        <div className="text-[14px] text-slate-700 leading-[1.9] space-y-2">
          {!hasSolutions ? (
            <p className="whitespace-pre-wrap">{part.part2Data.situation}</p>
          ) : (
            <>
              <p className="italic text-slate-500">Here is the situation:</p>
              <p>{part.part2Data.situation}</p>
              <p className="italic text-slate-500 mt-2">You have three options:</p>
              <div>
                {part.part2Data.solutions.map((s, i) => (
                  <p key={i}>- {String.fromCharCode(65 + i)}. {s}</p>
                ))}
              </div>
              {part.part2Data.question && <p className="font-semibold pt-1">{part.part2Data.question}</p>}
            </>
          )}
        </div>
      </>
    );
  }

  // ── Part 3: Topic Development ───────────────────────────────────────────
  if (partNumber === 3) {
    if (!part.part3Data) {
      return <>{Header}<MissingPartContent partNumber={3} /></>;
    }
    return (
      <>
        {Header}
        <div className="text-[14px] text-slate-700 leading-[1.9]">
          <p className="italic text-slate-500">Your topic is:</p>
          <p className="font-semibold mb-1">{part.part3Data.mainTopic}.</p>
          {part.part3Data.suggestedIdeas?.length > 0 && (
            <>
              <p className="italic text-slate-500 mt-2">Some ideas you may consider:</p>
              <ul>
                {part.part3Data.suggestedIdeas.map((idea, i) => (
                  <li key={i}>- {idea}</li>
                ))}
              </ul>
            </>
          )}
          {part.part3Data.followUpQuestions?.length > 0 && (
            <>
              <p className="italic text-slate-500 mt-2">Please address the following questions:</p>
              {part.part3Data.followUpQuestions.map((q, i) => (
                <p key={i}>{i + 1}. {q}</p>
              ))}
            </>
          )}
        </div>
      </>
    );
  }

  // ── Unknown part number fallback ──────────────────────────────────────
  return <MissingPartContent partNumber={partNumber} />;
}

/* ── Build TTS prompt — chỉ thông báo NGẮN GỌN Part + thời gian ──
   KHÔNG đọc lại toàn bộ đề (đề đã hiển thị trên màn hình) để tiết kiệm thời gian. */
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

/* ── Speaking Question Screen — image 3/4 style ───────── */
function SpeakingQuestionScreen({
  part,
  partNumber,
  onComplete,
}: {
  part: SpeakingPart;
  partNumber: number;
  onComplete?: (pn: number) => void;
}) {
  const times = SPEAKING_TIMES[partNumber] ?? { prepSec: 30, recSec: 180 };
  type Phase = "intro" | "countdown3" | "recording" | "done";
  const [phase, setPhase] = useState<Phase>("intro");
  const [recLeft, setRecLeft] = useState(times.recSec);
  const [count3, setCount3] = useState(3);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [ttsProgress, setTtsProgress] = useState(0); // 0..1 during intro
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fmtSec = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const clearTimer = () => { if (timerRef.current) clearInterval(timerRef.current); };

  const partTitle =
    partNumber === 1 ? "Question 1: Social Interaction (3 minutes): Now, the test begins."
    : partNumber === 2 ? "Question 2: Solution Discussion (4 minutes)."
    : "Question 3: Topic Development (5 minutes).";

  // TTS on mount / partNumber change
  useEffect(() => {
    setPhase("intro");
    setAudioUrl(null);
    setTtsProgress(0);
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setPhase("countdown3"); return;
    }
    const text = buildSpeakingPrompt(part, partNumber);
    if (!text) { setPhase("countdown3"); return; }
    const total = Math.max(1, text.length);
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "en-US"; utt.rate = 0.95;
    utt.onboundary = (e: SpeechSynthesisEvent) => {
      setTtsProgress(Math.min(1, e.charIndex / total));
    };
    utt.onend = async () => {
      setTtsProgress(1);
      await playBeep();
      setPhase("countdown3");
    };
    utt.onerror = () => setPhase("countdown3");
    window.speechSynthesis.speak(utt);
    return () => { window.speechSynthesis.cancel(); };
  }, [partNumber]);

  // 3-2-1 countdown → auto record
  useEffect(() => {
    if (phase !== "countdown3") return;
    setCount3(3);
    const id = setInterval(() => {
      setCount3((c) => {
        if (c <= 1) { clearInterval(id); startRecording(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        setMicStream(null);
        setPhase("done");
        onComplete?.(partNumber);
      };
      mr.start();
      mediaRef.current = mr;
      setPhase("recording");
      setRecLeft(times.recSec);
      clearTimer();
      timerRef.current = setInterval(() => {
        setRecLeft((c) => {
          if (c <= 1) { clearTimer(); mr.stop(); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch {
      alert("Không thể truy cập microphone. Vui lòng cho phép quyền ghi âm.");
      setPhase("done");
    }
  };

  const stopRecording = () => { clearTimer(); mediaRef.current?.stop(); };
  const skipIntro = () => { window.speechSynthesis?.cancel(); setPhase("countdown3"); };
  const reset = () => {
    clearTimer();
    window.speechSynthesis?.cancel();
    mediaRef.current?.stop();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setMicStream(null);
    setPhase("intro");
    setTtsProgress(0);
    setTimeout(() => {
      const text = buildSpeakingPrompt(part, partNumber);
      if (!text || !("speechSynthesis" in window)) { setPhase("countdown3"); return; }
      const total = Math.max(1, text.length);
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = "en-US"; utt.rate = 0.95;
      utt.onboundary = (e: SpeechSynthesisEvent) => {
        setTtsProgress(Math.min(1, e.charIndex / total));
      };
      utt.onend = async () => {
        setTtsProgress(1);
        await playBeep();
        setPhase("countdown3");
      };
      utt.onerror = () => setPhase("countdown3");
      window.speechSynthesis.speak(utt);
    }, 100);
  };

  useEffect(() => () => {
    clearTimer();
    window.speechSynthesis?.cancel();
    mediaRef.current?.stop();
  }, []);

  const isRecording = phase === "recording";
  const showRightPanel = isRecording || phase === "done" || phase === "countdown3";

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      {/* Top red recording timer pill */}
      {isRecording && (
        <div className="flex justify-center mb-5">
          <div className="bg-red-50 border border-red-200 px-5 py-1.5 rounded-md">
            <span className="text-2xl font-bold tabular-nums text-red-600">{fmtSec(recLeft)}</span>
          </div>
        </div>
      )}
      {phase === "countdown3" && (
        <div className="flex justify-center mb-5">
          <div className="bg-amber-50 border border-amber-200 px-5 py-1.5 rounded-md">
            <span className="text-xs font-semibold text-amber-700 mr-2">Bắt đầu sau</span>
            <span className="text-2xl font-bold tabular-nums text-amber-600">{count3}</span>
          </div>
        </div>
      )}

      <div className={`grid gap-6 ${showRightPanel ? "grid-cols-1 md:grid-cols-[1fr_360px]" : "grid-cols-1"}`}>
        {/* LEFT — question + audio + text */}
        <div>
          <p className="font-bold text-slate-900 mb-3">
            {partTitle.split(":")[0]}: <em className="font-semibold">{partTitle.substring(partTitle.indexOf(":") + 1).trim()}</em>
          </p>

          {/* Fake audio-player UI for TTS — auto-play, no controls */}
          <div className="bg-slate-100 rounded-full px-4 py-2 flex items-center gap-3 mb-3 max-w-md select-none">
            <div className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center" aria-hidden>
              {phase === "intro"
                ? <Pause className="w-3.5 h-3.5 text-slate-700" />
                : <Play className="w-3.5 h-3.5 text-slate-700" />}
            </div>
            <div className="flex-1 h-1 bg-slate-300 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-600 transition-[width] duration-200 ease-linear"
                style={{
                  width: `${
                    phase === "intro" ? Math.round(ttsProgress * 100) : 100
                  }%`,
                }}
              />
            </div>
            <Volume2 className="w-4 h-4 text-slate-500" />
          </div>

          <p className="italic text-red-500 text-[12px] mb-4">
            "Nếu trình duyệt không tự động phát, vui lòng bấm nút Play để nghe câu hỏi."
          </p>

          {/* Question content */}
          <div className="text-slate-800">
            {formatPartContent(part, partNumber)}
          </div>

          {/* Audio playback after recording */}
          {audioUrl && (
            <div className="mt-5">
              <p className="text-xs font-semibold text-slate-700 mb-2">Bài thu của bạn:</p>
              <audio controls src={audioUrl} className="w-full h-10" />
            </div>
          )}

          {/* Controls */}
          <div className="mt-5 flex gap-2">
            {phase === "recording" && (
              <button onClick={stopRecording}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors">
                <Pause className="w-4 h-4" /> Dừng ghi âm
              </button>
            )}
            {(phase === "recording" || phase === "done") && (
              <button onClick={reset}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
                <RotateCcw className="w-4 h-4" /> Làm lại
              </button>
            )}
          </div>
        </div>

        {/* RIGHT — live waveform when recording */}
        {showRightPanel && (
          <div className="flex flex-col items-center">
            <div className="w-full bg-slate-200 rounded-md overflow-hidden">
              {isRecording ? (
                <LiveMicWaveform stream={micStream} />
              ) : (
                <div className="w-full h-[150px] flex items-center justify-center text-slate-400 text-xs">
                  {phase === "countdown3" ? "Chuẩn bị ghi âm..." : "Đã ghi âm xong"}
                </div>
              )}
            </div>
            {isRecording && (
              <div className="mt-3 text-center">
                <p className="text-[11px] font-bold text-red-500 uppercase tracking-wider">
                  Bài nói đang được thu âm trực tiếp
                </p>
                <p className="text-[11px] text-red-500 uppercase tracking-wider mt-0.5">
                  Vui lòng để ý sóng âm để điều chỉnh mic thu âm
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
 *  SPEAKING VIEW
 * ============================================================ */
function SpeakingView({
  part,
  partNumber,
  onComplete,
}: {
  part?: SpeakingPart;
  partNumber: number;
  onComplete?: (pn: number) => void;
}) {
  const { examId } = useParams();
  const LS_PREP = `vstep_speaking_prep_${examId}`;

  const [viewPhase, setViewPhase] = useState<"prep" | "questions">(() => {
    try {
      const done = JSON.parse(localStorage.getItem(LS_PREP) || "{}");
      return done[partNumber] ? "questions" : "prep";
    } catch { return "prep"; }
  });

  // Reset phase when partNumber changes
  useEffect(() => {
    try {
      const done = JSON.parse(localStorage.getItem(LS_PREP) || "{}");
      setViewPhase(done[partNumber] ? "questions" : "prep");
    } catch { setViewPhase("prep"); }
  }, [partNumber]);

  const finishPrep = () => {
    try {
      const done = JSON.parse(localStorage.getItem(LS_PREP) || "{}");
      done[partNumber] = true;
      localStorage.setItem(LS_PREP, JSON.stringify(done));
    } catch {}
    setViewPhase("questions");
  };

  if (!part) return <EmptyState skill="speaking" />;
  const subtitle = partNumber === 1 ? "Social Interaction" : partNumber === 2 ? "Solution Discussion" : "Topic Development";
  const times = SPEAKING_TIMES[partNumber] ?? { prepSec: 30, recSec: 180 };

  // Question count
  const questionCount =
    partNumber === 1 ? (part.part1Data?.reduce((s, t) => s + t.questions.length, 0) || 0)
    : partNumber === 2 ? 1
    : partNumber === 3 ? 1 + (part.part3Data?.followUpQuestions.length || 0)
    : 0;

  if (viewPhase === "prep") {
    return (
      <SpeakingPrepOverlay
        prepSec={times.prepSec}
        partNumber={partNumber}
        onDone={finishPrep}
        onSkip={finishPrep}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 pt-4">
        <PartHeader
          icon={Mic}
          color="pink"
          title={`Part ${partNumber}`}
          subtitle={`${subtitle} · ${questionCount} câu`}
        />
      </div>
      <SpeakingQuestionScreen part={part} partNumber={partNumber} onComplete={onComplete} />
    </div>
  );
}

/* ============================================================
 *  HELPER COMPONENTS
 * ============================================================ */
function PartHeader({
  icon: Icon,
  color,
  title,
  subtitle,
}: {
  icon: any;
  color: "sky" | "emerald" | "amber" | "pink";
  title: string;
  subtitle?: string;
}) {
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

function QuestionCard({
  q,
  selected,
  onSelect,
}: {
  q: Q;
  selected?: "A" | "B" | "C" | "D";
  onSelect: (l: "A" | "B" | "C" | "D") => void;
}) {
  const letters: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];
  return (
    <div className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Question</span>
          <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">
            {q.questionNumber}
          </span>
          <span className="text-slate-400 font-semibold">:</span>
        </div>
        <RichText as="p" className="text-slate-800 font-medium flex-1" text={q.questionText} />
      </div>
      <div className="space-y-1.5 ml-10">
        {letters.map((l) => {
          const isSel = selected === l;
          const text = q.options?.[l];
          if (!text) return null;
          return (
            <button
              key={l}
              onClick={() => onSelect(l)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left text-sm transition-all ${
                isSel
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  isSel ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {l}
              </span>
              <RichText className={isSel ? "text-emerald-900 font-medium" : "text-slate-700"} text={text} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Audio player style study4.vn ─────────────────────── */
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function AudioPlayer({ src }: { src?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seekRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);
  const [played, setPlayed] = useState(false); // đã play 1 lần chưa

  const progress = duration ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrentTime(a.currentTime);
    const onLoaded = () => setDuration(a.duration || 0);
    const onEnded = () => { setPlaying(false); setCurrentTime(0); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("durationchange", onLoaded);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("durationchange", onLoaded);
      a.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (played) return; // VSTEP: chỉ play 1 lần, không dừng
    a.play();
    setPlaying(true);
    setPlayed(true);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (played) return; // không cho seek sau khi đã play
    const bar = seekRef.current;
    const a = audioRef.current;
    if (!bar || !a || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = ratio * duration;
  };

  const changeVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    setMuted(v === 0);
    if (audioRef.current) {
      audioRef.current.volume = v;
      audioRef.current.muted = v === 0;
    }
  };

  const toggleMute = () => {
    const a = audioRef.current;
    if (!a) return;
    const next = !muted;
    setMuted(next);
    a.muted = next;
  };

  const changeSpeed = (s: number) => {
    setSpeed(s);
    setShowSpeed(false);
    if (audioRef.current) audioRef.current.playbackRate = s;
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return "00:00";
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  if (!src) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3 text-slate-400 text-sm">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
          <Volume2 className="w-5 h-5" />
        </div>
        Chưa có audio cho phần này
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="px-4 py-2.5 flex items-center gap-3">
        {/* Play — chỉ 1 lần theo chuẩn VSTEP */}
        <button
          onClick={toggle}
          disabled={played}
          title={played ? "Bài nghe đã phát" : "Phát bài nghe"}
          className={`w-9 h-9 rounded-full text-white flex items-center justify-center transition-all flex-shrink-0 ${
            played
              ? "bg-slate-300 cursor-not-allowed"
              : "bg-slate-900 hover:bg-slate-700 active:scale-95"
          }`}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        {/* Current time */}
        <span className="text-xs font-mono text-slate-500 flex-shrink-0 w-10 text-right">
          {fmt(currentTime)}
        </span>

        {/* Seek bar */}
        <div
          ref={seekRef}
          onClick={seek}
          className={`relative flex-1 h-1.5 bg-slate-200 rounded-full group ${played ? "cursor-default" : "cursor-pointer"}`}
        >
          <div
            className="absolute inset-y-0 left-0 bg-slate-400 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-slate-700 rounded-full border-2 border-white shadow opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progress}%` }}
          />
        </div>

        {/* Total time */}
        <span className="text-xs font-mono text-slate-400 flex-shrink-0 w-10">
          {fmt(duration)}
        </span>

        {/* Volume icon only */}
        <button onClick={toggleMute} className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
          <VolumeIcon className="w-4 h-4" />
        </button>

      </div>

      {/* Warning — chỉ hiện trước khi play */}
      {!played && (
        <div className="px-4 py-1.5 bg-amber-50 border-t border-amber-100 flex items-center gap-1.5">
          <span className="text-[11px] text-amber-600">
            ⚠ Bài nghe phát <strong>1 lần duy nhất</strong> — Nhấn Play khi sẵn sàng.
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────────── */
function EmptyState({ skill }: { skill: SkillKey }) {
  const meta = SKILL_META[skill];
  const Icon = meta.icon;
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className={`w-16 h-16 ${meta.bg} rounded-full flex items-center justify-center mx-auto mb-4`}>
          <Icon className={`w-8 h-8 ${meta.color}`} />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Chưa có nội dung</h3>
        <p className="text-sm text-slate-500">
          Phần {meta.label} của đề thi này chưa có dữ liệu được nhập.
        </p>
      </div>
    </div>
  );
}

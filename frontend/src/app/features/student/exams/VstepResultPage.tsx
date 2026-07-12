import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Headphones,
  BookOpen,
  PenLine,
  Mic,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Eye,
  Home,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Bot,
  RefreshCw,
} from "lucide-react";
import { studentApi } from "../../../../services/studentApi";

const STUDENT_BASE = "/hoc-vien";

// ── Intro loading screen (3 s frosted overlay before results reveal) ──────────
function ResultIntroScreen({ isIelts }: { isIelts: boolean }) {
  const accent = isIelts ? "#059669" : "#7C3AED";
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(12px)" }}>
      <div className="relative w-16 h-16 mb-5">
        <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
          style={{ borderTopColor: accent }} />
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
        Đang tải kết quả...
      </p>
      <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
        {isIelts ? "IELTS" : "VSTEP"}
      </p>
    </div>
  );
}

// ── Skill config ─────────────────────────────────────────────────────────────
type SkillKey = "listening" | "reading" | "writing" | "speaking";

interface SkillConfig {
  key: SkillKey;
  label: string;
  Icon: typeof Headphones;
  /** Tailwind classes — bg nhạt + text đậm cho icon nhận diện */
  iconBg: string;
  iconText: string;
}

const SKILLS: SkillConfig[] = [
  { key: "listening", label: "Listening", Icon: Headphones, iconBg: "bg-orange-50",  iconText: "text-orange-600" },
  { key: "reading",   label: "Reading",   Icon: BookOpen,   iconBg: "bg-sky-50",     iconText: "text-sky-600" },
  { key: "writing",   label: "Writing",   Icon: PenLine,    iconBg: "bg-emerald-50", iconText: "text-emerald-600" },
  { key: "speaking",  label: "Speaking",  Icon: Mic,        iconBg: "bg-violet-50",  iconText: "text-violet-600" },
];

function bandLabel(avg: number | null): string {
  if (avg === null) return "—";
  if (avg >= 8.5) return "Xuất sắc";
  if (avg >= 7) return "Tốt";
  if (avg >= 5.5) return "Khá";
  if (avg >= 4) return "Trung bình";
  return "Cần cố gắng";
}

/** Định dạng khoảng thời gian làm bài giữa 2 mốc (ms) → "Xh Ym Zs"
 *  - Nếu chênh lệch vượt thời lượng đề (vd start_time lưu sai từ session cũ),
 *    cap về đúng thời lượng cho phép để tránh hiển thị "333 phút" vô lý.
 *  - Cap tối đa 24h cho mọi trường hợp để chắc chắn.
 */
function formatDuration(
  startMs: number,
  endMs: number,
  maxMinutes?: number | null
): string | null {
  let diff = Math.round((endMs - startMs) / 1000);
  if (!isFinite(diff) || diff <= 0) return null;
  const hardCap = (maxMinutes && maxMinutes > 0 ? maxMinutes : 24 * 60) * 60;
  if (diff > hardCap) diff = hardCap;
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (h > 0) return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
  if (m === 0) return `${s} giây`;
  return s === 0 ? `${m} phút` : `${m} phút ${s} giây`;
}

interface StatItem {
  label: string;
  value: string;
  sub?: string;
}

/** Stats hàng ngang, divider thẳng giữa các cột — minimalist. */
function StatsOverview({ items }: { items: StatItem[] }) {
  if (items.length === 0) return null;
  const cols =
    items.length >= 5
      ? "sm:grid-cols-5"
      : items.length >= 4
        ? "sm:grid-cols-4"
        : items.length === 3
          ? "sm:grid-cols-3"
          : "sm:grid-cols-2";
  return (
    <div className={`grid grid-cols-2 ${cols} divide-x divide-y sm:divide-y-0 divide-slate-100`}>
      {items.map((it) => (
        <div key={it.label} className="px-4 py-4 text-center">
          <p className="text-xl font-semibold text-slate-800 tabular-nums leading-none">{it.value}</p>
          <p className="text-[11px] font-medium text-slate-500 mt-1.5 uppercase tracking-wide">
            {it.label}
          </p>
          {it.sub && <p className="text-[10px] text-slate-400 mt-0.5">{it.sub}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function VstepResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const submissionId = Number(id);

  const [showIntro, setShowIntro] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowIntro(false), 3000);
    return () => clearTimeout(t);
  }, []);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const [gradingDoneToast, setGradingDoneToast] = useState(false);
  const [countdown, setCountdown] = useState(8);
  const prevGradingRef = useRef<boolean | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["vstep-submission", submissionId],
    queryFn: () => studentApi.getSubmissionDetail(submissionId),
    enabled: !!submissionId,
    retry: 2,
  });

  const raw = (data as any)?.data?.data ?? (data as any)?.data;
  const vstepMeta = raw?.vstep_meta ?? null;
  const submissionStatus = raw?.sStatus ?? "graded";
  const isGradingSubjective = submissionStatus === "grading_subjective";

  // Poll grading status every 8 s while W+S are still being graded
  const { data: statusPoll } = useQuery({
    queryKey: ["vstep-grading-status", submissionId],
    queryFn: () => studentApi.getGradingStatus(submissionId),
    enabled: !!submissionId && isGradingSubjective,
    refetchInterval: isGradingSubjective ? 8000 : false,
    retry: 1,
  });

  useEffect(() => {
    if (!isGradingSubjective) { setCountdown(8); return; }
    const t = setInterval(() => setCountdown((c) => (c > 1 ? c - 1 : 8)), 1000);
    return () => clearInterval(t);
  }, [isGradingSubjective]);

  const polledStatus = (statusPoll as any)?.data?.data?.sStatus ?? null;
  useEffect(() => {
    if (prevGradingRef.current === true && polledStatus === "graded") {
      setGradingDoneToast(true);
      queryClient.invalidateQueries({ queryKey: ["vstep-submission", submissionId] });
      setTimeout(() => setGradingDoneToast(false), 5000);
    }
    if (polledStatus !== null) prevGradingRef.current = polledStatus === "grading_subjective";
  }, [polledStatus, submissionId, queryClient]);

  const examTitle = raw?.exam?.eTitle ?? "Kết quả bài thi";
  const submitTime = raw?.sSubmit_time ? new Date(raw.sSubmit_time) : null;
  // Detect IELTS to switch scale + band conversion
  const examType = String(raw?.exam?.eType ?? "").toUpperCase();
  const isIelts = examType === "IELTS";
  const maxScore = isIelts ? 9 : 10;
  const scaleSuffix = `/${maxScore}`;

  const polledScores = (statusPoll as any)?.data?.data?.vstep_scores ?? null;
  const baseScores = vstepMeta?.vstep_scores ?? {};
  const scores = polledScores ? { ...baseScores, ...polledScores } : baseScores;

  // Chỉ render skill thực sự có trong đề
  // Ưu tiên: exam_sections từ API > suy từ scores có giá trị > fallback tất cả 4
  const examSections: string[] = useMemo(() => {
    if (vstepMeta?.exam_sections?.length) return vstepMeta.exam_sections;
    // Suy từ scores: skill nào có điểm (kể cả 0) thì render
    const fromScores = Object.entries(scores)
      .filter(([k, v]) => k !== "raw_mcq_pct" && v !== null && v !== undefined)
      .map(([k]) => k);
    if (fromScores.length > 0) return fromScores;
    // Fallback cuối: tất cả 4 kỹ năng
    return ["listening", "reading", "writing", "speaking"];
  }, [vstepMeta, scores]);
  const activeSkills = SKILLS.filter((s) => examSections.includes(s.key));
  const visibleSkills = activeSkills.length > 0 ? activeSkills : SKILLS;
  const isSingleSkill = visibleSkills.length === 1;

  // ── Tính skill nào còn pending (chưa có điểm) — dựa trên FE state, vì backend
  // có thể chưa cập nhật pending_skills kịp lúc poll. Mục tiêu UX: show điểm các
  // skill đã chấm xong NGAY, ẩn overall cho đến khi MỌI skill có điểm.
  const fePendingSkills: SkillKey[] = useMemo(() => {
    return visibleSkills
      .filter((s) => {
        const v = scores[s.key];
        return typeof v !== "number" || isNaN(v);
      })
      .map((s) => s.key);
  }, [visibleSkills, scores]);

  const skillStats = vstepMeta?.skill_stats ?? {};
  // Merge backend pending_skills + FE-derived pending → đầy đủ nhất, dùng cho UI
  const pendingSkills: SkillKey[] = useMemo(() => {
    const bePending = (vstepMeta?.pending_skills ?? []) as SkillKey[];
    const merged = new Set<SkillKey>([...bePending, ...fePendingSkills]);
    return Array.from(merged);
  }, [vstepMeta?.pending_skills, fePendingSkills]);

  // ── Thống kê tổng quan (MCQ: listening + reading) ──────────────────────────
  // Đếm số câu user thực sự ĐÃ TRẢ LỜI (saAnswer_text non-blank), tách theo skill
  // → cho phép practice mode (làm 1 section ~13 câu thay vì full 40) hiển thị
  // đúng "6/13 câu đúng" thay vì "6/40".
  const answers = (raw?.answers ?? []) as any[];
  const skillAnswered = useMemo(() => {
    const out: Record<string, { answered: number; correct: number }> = {
      listening: { answered: 0, correct: 0 },
      reading: { answered: 0, correct: 0 },
    };
    for (const a of answers) {
      const sec = String(a.question?.qSection ?? a.question?.qSkill ?? "").toLowerCase();
      if (!out[sec]) continue;
      const text = a?.saAnswer_text;
      const hasAnswer = text != null && String(text).trim() !== "";
      if (hasAnswer) {
        out[sec].answered++;
        if (a.saIs_correct) out[sec].correct++;
      }
    }
    return out;
  }, [answers]);

  const totalMcqExam =
    (skillStats.listening?.total ?? 0) + (skillStats.reading?.total ?? 0);
  const correctMcq =
    (skillStats.listening?.correct ?? 0) + (skillStats.reading?.correct ?? 0);
  const answeredMcq = skillAnswered.listening.answered + skillAnswered.reading.answered;
  // Không còn "practice mode" chia mẫu số theo số câu đã làm.
  // Reading / Full test luôn hiển thị: số câu đúng / TỔNG câu trong đề.
  // Câu bỏ trống tính là sai (không làm giảm mẫu số).
  const isPracticeMode = false;
  const totalMcq = totalMcqExam > 0 ? totalMcqExam : Math.max(answeredMcq, 0);
  const accuracy = totalMcq > 0 ? Math.round((correctMcq / totalMcq) * 100) : null;

  // ── Recompute scores cho IELTS scale (/9) ─────────────────────────────────
  // Backend vstep_scores tính trên /10. IELTS cần convert sang /9.
  // VSTEP luôn dùng điểm backend trên tổng câu của đề (không scale theo attempted).
  const adjustedScores = useMemo<Record<string, number | null | undefined>>(() => {
    const out: Record<string, number | null | undefined> = { ...scores };
    if (!isIelts) return out;

    const round = (n: number) => Math.round(n * 2) / 2;
    for (const sk of ["listening", "reading", "writing", "speaking"] as const) {
      if (typeof scores[sk] === "number") {
        out[sk] = round((scores[sk] as number) / 10 * maxScore);
      }
    }
    return out;
  }, [scores, isIelts, maxScore]);

  // Use adjusted scores instead of raw backend scores
  const finalScores: Record<string, number | null | undefined> =
    isIelts ? adjustedScores : scores;

  // Overall average: chỉ tính khi MỌI skill được render đã có điểm hợp lệ.
  // Nếu còn bất kỳ skill pending → overallAvg = null (hide until graded).
  const overallAvg = useMemo<number | null>(() => {
    const vals: number[] = [];
    for (const s of visibleSkills) {
      const v = finalScores[s.key];
      if (typeof v !== "number" || isNaN(v)) return null;
      vals.push(v);
    }
    if (vals.length === 0) return null;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    // IELTS round to 0.5; VSTEP round to 1 decimal
    return isIelts ? Math.round(avg * 2) / 2 : Math.round(avg * 10) / 10;
  }, [visibleSkills, finalScores, isIelts]);

  const durationText =
    raw?.sStart_time && raw?.sSubmit_time
      ? formatDuration(
          new Date(raw.sStart_time).getTime(),
          new Date(raw.sSubmit_time).getTime(),
          raw?.exam?.eDuration_minutes ?? raw?.exam?.eDuration ?? null
        )
      : null;
  const answeredCount = answers.filter((answer) => {
    const text = answer?.saAnswer_text;
    return text != null && String(text).trim() !== "";
  }).length;
  const submittedStatuses = new Set(["submitted", "graded", "partially_graded", "grading_subjective"]);
  const hasSubmitted =
    !!raw?.sSubmit_time ||
    submittedStatuses.has(String(submissionStatus ?? "").toLowerCase()) ||
    totalMcq > 0 ||
    answers.length > 0;
  const hasSubmittedSubjective = !!vstepMeta?.writing_submitted || !!vstepMeta?.speaking_submitted;
  const hasPendingSubjective =
    pendingSkills.some((skill) => skill === "writing" || skill === "speaking") ||
    (isGradingSubjective && hasSubmittedSubjective);
  // Nếu đề không có W/S và không có pending → có thể show overall=0 (case không
  // có data). Còn nếu CÒN skill pending (kể cả L/R chưa kịp set), GIỮ null.
  const objectiveOnlyNoScore = hasSubmitted && pendingSkills.length === 0 && overallAvg === null;
  const displayOverall = overallAvg ?? (objectiveOnlyNoScore ? 0 : null);
  const showScorePending = displayOverall === null && (hasPendingSubjective || pendingSkills.length > 0);
  const blankSubmission = hasSubmitted && answeredCount === 0;

  // Stats rõ ràng: tổng câu đề / đã làm / đúng / điểm tổng
  const statsItems: StatItem[] = [];
  if (totalMcq > 0) {
    statsItems.push({
      label: "Tổng câu đề",
      value: String(totalMcq),
      sub: "Listening + Reading",
    });
    statsItems.push({
      label: "Đã làm",
      value: `${answeredMcq}/${totalMcq}`,
      sub: answeredMcq < totalMcq ? `Bỏ trống ${totalMcq - answeredMcq}` : "Hoàn thành",
    });
    statsItems.push({
      label: "Câu đúng",
      value: `${correctMcq}/${totalMcq}`,
      sub: accuracy !== null ? `${accuracy}%` : undefined,
    });
  }
  if (displayOverall !== null && !showScorePending) {
    statsItems.push({
      label: "Điểm tổng",
      value: displayOverall.toFixed(1),
      sub: `${scaleSuffix}${isSingleSkill ? ` · ${visibleSkills[0].label}` : " · Trung bình"}`,
    });
  } else if (showScorePending) {
    statsItems.push({
      label: "Điểm tổng",
      value: "…",
      sub: "Đang chấm",
    });
  }
  if (durationText) {
    statsItems.push({ label: "Thời gian", value: durationText });
  }

  const listeningAnswers = answers
    .filter((a) => (a.question?.qSection ?? "").toLowerCase() === "listening")
    .sort((a, b) => (a.question?.qNumber ?? 0) - (b.question?.qNumber ?? 0));
  const readingAnswers = answers
    .filter((a) => (a.question?.qSection ?? "").toLowerCase() === "reading")
    .sort((a, b) => (a.question?.qNumber ?? 0) - (b.question?.qNumber ?? 0));

  const examQMap = useMemo(() => {
    const map: Record<number, string> = {};
    const LETTERS = ["A", "B", "C", "D"];
    for (const q of (raw?.exam?.questions ?? [])) {
      const correct = (q.answers ?? []).find((a: any) => a.aIs_correct);
      if (correct) {
        const order = correct.aOrder ?? (q.answers ?? []).indexOf(correct);
        map[q.qId] = LETTERS[order] ?? correct.aContent ?? "?";
      }
    }
    return map;
  }, [raw]);

  // ── Helper: Map letter answer to label (TRUE/FALSE/NOT GIVEN) ────────────
  const getAnswerLabel = (questionId: number, letter: string): string | null => {
    const question = (raw?.exam?.questions ?? []).find((q: any) => q.qId === questionId);
    if (!question?.answers) return null;
    
    // Detect if this is TRUE/FALSE/NOT GIVEN question type
    const answerTexts = question.answers.map((a: any) => String(a.aContent ?? "").toUpperCase().trim());
    const isTrueFalseNotGiven = 
      answerTexts.includes("TRUE") || 
      answerTexts.includes("FALSE") || 
      answerTexts.includes("NOT GIVEN");
    
    if (!isTrueFalseNotGiven) return null;
    
    // Find the answer option for this letter
    const LETTERS = ["A", "B", "C", "D"];
    const letterIndex = LETTERS.indexOf(letter.toUpperCase());
    if (letterIndex === -1 || letterIndex >= question.answers.length) return null;
    
    const answer = question.answers[letterIndex];
    return String(answer?.aContent ?? "").toUpperCase().trim();
  };

  // ── Helper: tone của điểm theo band ────────────────────────────────────────
  const scoreTone = (avg: number | null) => {
    if (avg === null) return { text: "text-slate-800", chip: "bg-slate-100 text-slate-600" };
    if (avg >= 7) return { text: "text-emerald-600", chip: "bg-emerald-50 text-emerald-700" };
    if (avg >= 5.5) return { text: "text-sky-600", chip: "bg-sky-50 text-sky-700" };
    if (avg >= 4) return { text: "text-amber-600", chip: "bg-amber-50 text-amber-700" };
    return { text: "text-rose-600", chip: "bg-rose-50 text-rose-700" };
  };
  const tone = scoreTone(displayOverall);
  const formatSkillScore = (skill: SkillKey) => {
    const score = finalScores[skill];
    if (typeof score === "number" && !isNaN(score)) return `Điểm: ${score.toFixed(1)}${scaleSuffix}`;
    if (blankSubmission) return "Không có câu trả lời";
    return "Chưa có điểm";
  };

  // ── Loading / error ────────────────────────────────────────────────────────
  if (showIntro) return <ResultIntroScreen isIelts={pathname.includes("ielts")} />;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (isError || !raw) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-9 h-9 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium mb-4">Không tìm thấy kết quả bài thi.</p>
          <button
            onClick={() => navigate(`${STUDENT_BASE}/de-thi`)}
            className="px-5 py-2.5 bg-slate-800 text-white rounded-lg font-medium text-sm hover:bg-slate-900 transition-colors"
          >
            Về trang đề thi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-5">
      {/* ── Back ────────────────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate(`${STUDENT_BASE}/de-thi`)}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Về trang đề thi
      </button>

      {/* ── Hero card: tiêu đề + điểm + stats — gộp 1 khối, tối giản ──────── */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        {/* Header */}
        <div className="px-6 pt-6 pb-5 text-center border-b border-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Kết quả bài thi
          </p>
          <h1 className="text-base font-semibold text-slate-900 mt-1.5 leading-snug">
            {examTitle}
          </h1>
          {submitTime && (
            <p className="text-[11px] text-slate-400 mt-1">
              Nộp lúc{" "}
              {submitTime.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
              {" · "}
              {submitTime.toLocaleDateString("vi-VN")}
            </p>
          )}
        </div>

        {/* Score */}
        <div className="px-6 py-7 text-center">
          {!showScorePending && displayOverall !== null ? (
            <>
              <div className="flex items-end justify-center gap-1">
                <span className={`text-6xl font-bold tabular-nums leading-none ${tone.text}`}>
                  {displayOverall.toFixed(1)}
                </span>
                <span className="text-xl font-medium text-slate-300 mb-1.5">{scaleSuffix}</span>
              </div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mt-2">
                {isSingleSkill ? `Điểm ${visibleSkills[0].label}` : "Điểm trung bình"}
              </p>
              <span
                className={`mt-3 inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${tone.chip}`}
              >
                {blankSubmission ? "Không có câu trả lời" : bandLabel(displayOverall)}
              </span>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2.5 py-4 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              <span className="text-sm font-medium">
                {hasPendingSubjective ? "Đang chấm Writing & Speaking…" : "Đang tính điểm…"}
              </span>
            </div>
          )}
        </div>

        {/* Stats inline trong cùng card */}
        {statsItems.length > 0 && (
          <div className="border-t border-slate-100">
            <StatsOverview items={statsItems} />
          </div>
        )}
      </div>

      {/* ── AI grading banner ───────────────────────────────────────────────── */}
      {pendingSkills.length > 0 && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3 flex items-start gap-3">
          <Bot className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-violet-800">
              AI đang chấm {pendingSkills.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" & ")}
            </p>
            <p className="text-xs text-violet-700/70 mt-0.5">
              Kết quả sẽ tự động cập nhật. Không cần tải lại trang.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-violet-500 flex-shrink-0">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "2s" }} />
            <span className="text-xs font-medium tabular-nums">{countdown}s</span>
          </div>
        </div>
      )}

      {/* ── Answer overview — grid hiện trạng thái mỗi câu (đã trả lời / bỏ qua) ── */}
      {(listeningAnswers.length > 0 || readingAnswers.length > 0) && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-700">Tổng quan câu trả lời</p>
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Đúng
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-400" /> Sai
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-200 border border-slate-300" /> Bỏ trống
              </span>
            </div>
          </div>

          {[
            { key: "listening", label: "Listening", rows: listeningAnswers },
            { key: "reading",   label: "Reading",   rows: readingAnswers },
          ]
            .filter((g) => g.rows.length > 0)
            .map((g) => {
              // Luôn hiển thị đủ câu trong đề (bỏ trống vẫn hiện)
              const displayRows = g.rows;
              
              const answeredCount = displayRows.filter(
                (r) => r.saAnswer_text != null && String(r.saAnswer_text).trim() !== ""
              ).length;
              const skipped = displayRows.length - answeredCount;
              
              if (displayRows.length === 0) return null;
              
              return (
                <div key={g.key} className="mb-4 last:mb-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-600">{g.label}</span>
                    <span className="text-[11px] text-slate-500 tabular-nums">
                      Đã trả lời {answeredCount}/{displayRows.length}
                      {skipped > 0 && (
                        <span className="ml-2 text-rose-500 font-semibold">
                          · Bỏ trống {skipped}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {displayRows.map((r, idx) => {
                      const num = r.question?.qNumber ?? idx + 1;
                      const text = r.saAnswer_text;
                      const answered = text != null && String(text).trim() !== "";
                      const correct = !!r.saIs_correct;

                      let tone: string;
                      if (!answered) {
                        tone = "bg-slate-100 text-slate-400 border border-slate-200";
                      } else if (correct) {
                        tone = "bg-emerald-500 text-white";
                      } else {
                        tone = "bg-rose-400 text-white";
                      }

                      return (
                        <span
                          key={r.saId ?? `${g.key}-${idx}`}
                          title={
                            !answered
                              ? `Câu ${num}: chưa trả lời`
                              : `Câu ${num}: bạn ${correct ? "trả lời đúng" : "trả lời sai"} — "${text}"`
                          }
                          className={`w-7 h-7 rounded text-[11px] font-semibold tabular-nums flex items-center justify-center cursor-default flex-shrink-0 ${tone}`}
                        >
                          {num}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* ── Skill scores ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        {visibleSkills.map(({ key, label, Icon, iconBg, iconText }) => {
          const stats = skillStats[key] ?? null;
          const isSubjective = key === "writing" || key === "speaking";
          const submitted =
            key === "writing" ? vstepMeta?.writing_submitted :
            key === "speaking" ? vstepMeta?.speaking_submitted : false;
          const rawScore = finalScores[key];
          const hasScore = typeof rawScore === "number" && !isNaN(rawScore);
          const skillPending =
            pendingSkills.includes(key) ||
            (isGradingSubjective && (key === "writing" || key === "speaking") && submitted);
          const resolvedZero =
            !hasScore &&
            !skillPending &&
            hasSubmitted &&
            (!isSubjective || submitted || blankSubmission);
          const score = hasScore ? rawScore : resolvedZero ? 0 : null;
          const isPending = score === null && skillPending;
          const hasDisplayScore = score !== null;

          // Luôn dùng total từ đề (skill_stats.total). Câu bỏ trống = sai.
          const adjustedStats = stats;

          return (
            <div key={key} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${iconText}`} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-800">{label}</p>
                  {!isSubjective && adjustedStats && (
                    <p className="text-xs text-slate-400">
                      {adjustedStats.correct}/{adjustedStats.total} đúng
                      {" · "}
                      Đã làm {skillAnswered[key]?.answered ?? 0}/{adjustedStats.total}
                    </p>
                  )}
                  {isSubjective && isPending && (
                    <p className="text-xs text-slate-400">
                      {submitted ? "AI đang chấm…" : "Chưa có bài nộp"}
                    </p>
                  )}
                  {blankSubmission && score === 0 && (
                    <p className="text-xs text-slate-400">Không có câu trả lời</p>
                  )}
                </div>
              </div>

              {!hasDisplayScore ? (
                <span className="flex items-center gap-1.5 text-slate-400 text-sm">
                  {isPending ? <Clock className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {isPending ? "Chờ chấm" : "Chưa có điểm"}
                </span>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-bold tabular-nums ${scoreTone(score as number).text}`}>
                    {(score as number).toFixed(1)}
                  </span>
                  <span className="text-xs text-slate-400">{scaleSuffix}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Toast: grading done ──────────────────────────────────────────────── */}
      {gradingDoneToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium bg-slate-800">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          Writing & Speaking đã được chấm xong!
        </div>
      )}

      {/* ── Grading status timeline ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-700 mb-4">Trạng thái chấm bài</p>
        <div className="space-y-3">
          {[
            {
              show: true,
              done: true,
              label: "Nộp bài thành công",
              sub: submitTime
                ? `${submitTime.toLocaleDateString("vi-VN")} · ${submitTime.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`
                : undefined,
            },
            {
              show: examSections.includes("listening") || examSections.includes("reading"),
              done: true,
              label: "Chấm trắc nghiệm (Listening & Reading)",
              sub: `${(skillStats.listening?.correct ?? 0) + (skillStats.reading?.correct ?? 0)} câu đúng / ${(skillStats.listening?.total ?? 0) + (skillStats.reading?.total ?? 0)} câu`,
            },
            {
              show: examSections.includes("writing"),
              done: !pendingSkills.includes("writing"),
              label: "Chấm Writing (AI)",
              sub: pendingSkills.includes("writing")
                ? (vstepMeta?.writing_submitted ? "Bài viết đã nộp · AI đang chấm…" : "Chưa có bài nộp")
                : formatSkillScore("writing"),
            },
            {
              show: examSections.includes("speaking"),
              done: !pendingSkills.includes("speaking"),
              label: "Chấm Speaking (AI)",
              sub: pendingSkills.includes("speaking")
                ? (vstepMeta?.speaking_submitted ? "Audio đã upload · AI đang chấm…" : "Chưa có audio")
                : formatSkillScore("speaking"),
            },
          ].filter((s) => s.show).map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {step.done ? (
                  <CheckCircle2 className="w-5 h-5 text-slate-700" />
                ) : (
                  <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                )}
              </div>
              <div>
                <p className={`text-sm font-medium ${step.done ? "text-slate-800" : "text-slate-500"}`}>
                  {step.label}
                </p>
                {step.sub && <p className="text-xs text-slate-400 mt-0.5">{step.sub}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MCQ answer review (collapsible) ──────────────────────────────────── */}
      {[
        { key: "listening", label: "Listening", Icon: Headphones, rows: listeningAnswers },
        { key: "reading",   label: "Reading",   Icon: BookOpen,   rows: readingAnswers },
      ].map(({ key, label, Icon, rows }) => {
        if (rows.length === 0) return null;
        const isOpen = expandedSkill === key;
        const correct = rows.filter((r) => r.saIs_correct).length;
        // Mẫu số = tổng câu trong đề, không phải số câu đã làm
        const total = rows.length;

        return (
          <div key={key} className="rounded-xl overflow-hidden border border-slate-200 bg-white">
            <button
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
              onClick={() => setExpandedSkill(isOpen ? null : key)}
            >
              <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-sm text-slate-800">{label} — Chi tiết đáp án</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {correct}/{total}
                </span>
              </div>
              {isOpen ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {isOpen && (
              <div className="divide-y divide-slate-100 border-t border-slate-100">
                {rows.map((ans, idx) => {
                  const qText = ans.question?.qContent?.replace(/<[^>]*>/g, "").slice(0, 80) ?? `Câu ${idx + 1}`;
                  const correctAns = examQMap[ans.question?.qId] ?? "—";
                  const userAns = ans.saAnswer_text ?? "—";
                  
                  // Get labels for TRUE/FALSE/NOT GIVEN questions
                  const correctLabel = getAnswerLabel(ans.question?.qId, correctAns);
                  const userLabel = getAnswerLabel(ans.question?.qId, userAns);
                  
                  return (
                    <div key={ans.saId ?? idx} className="flex items-start gap-3 px-5 py-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {ans.saIs_correct ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-600 truncate">{qText}</p>
                        <div className="flex gap-3 mt-1 text-xs">
                          <span className="text-slate-500">
                            Bạn chọn:{" "}
                            <span className={`font-semibold ${ans.saIs_correct ? "text-emerald-600" : "text-red-500"}`}>
                              {userAns}
                              {userLabel && <span className="ml-1 text-[10px] opacity-70">({userLabel})</span>}
                            </span>
                          </span>
                          {!ans.saIs_correct && (
                            <span className="text-slate-500">
                              Đáp án: <span className="font-semibold text-emerald-600">
                                {correctAns}
                                {correctLabel && <span className="ml-1 text-[10px] opacity-70">({correctLabel})</span>}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 pb-4">
        {raw?.exam_id && (() => {
          // IELTS dùng route riêng (lam-bai-ielts) vì đáp án là text completion,
          // không phải MCQ A/B/C/D như VSTEP. Mở vào /lam-bai-vstep sẽ render sai
          // (filter A/B/C/D drop hết text → hiển thị "Bỏ trống").
          const isIelts = String(raw?.exam?.eType ?? "").toUpperCase() === "IELTS";
          const skill = String(raw?.exam?.eSkill ?? "listening").toLowerCase();
          const examFormat = String(raw?.exam?.eFormat ?? raw?.exam?.exam_format ?? "").toUpperCase();
          const ieltsSections = Array.isArray(vstepMeta?.exam_sections) ? vstepMeta.exam_sections : [];
          const isIeltsFullReview =
            isIelts &&
            (skill === "full" ||
              skill === "mixed" ||
              examFormat.includes("FULL") ||
              ieltsSections.filter(Boolean).length > 1);
          const reviewUrl = isIelts
            ? isIeltsFullReview
              ? `${STUDENT_BASE}/lam-bai-ielts/${raw.exam_id}?review=${submissionId}`
              : `${STUDENT_BASE}/lam-bai-ielts/${raw.exam_id}/${skill}?review=${submissionId}`
            : `${STUDENT_BASE}/lam-bai-vstep/${raw.exam_id}?review=${submissionId}`;
          return (
            <Link
              to={reviewUrl}
              className="flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm text-white bg-slate-900 hover:bg-slate-800 transition-colors"
            >
              <Eye className="w-4 h-4" />
              Xem lại bài thi (đúng / sai từng câu)
            </Link>
          );
        })()}
        <div className="grid grid-cols-2 gap-3">
          <Link
            to={`${STUDENT_BASE}/dap-an/${submissionId}`}
            className="flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Eye className="w-4 h-4" />
            Đáp án đầy đủ
          </Link>
          <button
            onClick={() => navigate(`${STUDENT_BASE}/de-thi`)}
            className="flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Home className="w-4 h-4" />
            Trang đề thi
          </button>
        </div>
      </div>
    </div>
  );
}

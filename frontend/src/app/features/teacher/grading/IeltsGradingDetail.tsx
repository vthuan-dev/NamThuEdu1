/**
 * IELTS Grading Detail page.
 *
 * Mirrors VSTEP grading workflow but adapted for IELTS:
 *  • Score scale: 0–9 band (steps of 0.5)
 *  • 4 skills: Listening / Reading / Writing / Speaking
 *  • Per-skill structure: 4 sections (L), 3 passages (R), 2 tasks (W), 3 parts (S)
 *  • Writing: 4 criteria rubric (Task Achievement/Response, CC, LR, GRA)
 *  • Speaking: 4 criteria rubric (FC, LR, GRA, Pronunciation)
 *  • Overall band = average of 4 skill bands, rounded to nearest 0.5
 *  • AI grading: same Groq pipeline as VSTEP, but using IELTS rubric
 *
 * Key differences from VSTEP detail:
 *  • Band-score sliders (0-9 step 0.5) instead of 0-10 numbers
 *  • Listening = 4 sections × 10 (not 3 parts)
 *  • Reading   = 3 passages × ~13-14 (not 4 parts)
 *  • Speaking Part 2 has cue card UI
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useToastContext } from "../../../../contexts/ToastContext";
import { api } from "../../../../services/api";
import { gradingApi } from "../../../../services/gradingApi";
import { getFullMediaUrl } from "../../../../utils/mediaUtils";
import {
  ChevronLeft, Save, Loader2, AlertCircle, CheckCircle2,
  Headphones, BookOpen, PenLine, Mic, Award, Sparkles,
  Eye, MessageSquare, Bot,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
type IeltsSkill = "listening" | "reading" | "writing" | "speaking";

interface Question {
  id: string;
  answerId: number;
  number: number;
  part?: number;
  type: string;
  skill?: IeltsSkill;
  text: string;
  studentAnswer: string;
  correctAnswer?: string;
  points: number;
  maxPoints: number;
  isCorrect: boolean | null;
  feedback: string;
  autoGraded: boolean;
  aiScore?: number | null;
  aiFeedback?: string | null;
  aiCriteria?: Record<string, number | null> | null;
  aiCriterionComments?: Record<string, string | null> | null;
  reviewStatus?: "pending" | "accepted" | "modified" | null;
  audioUrl?: string;
  transcript?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const IELTS_SKILLS: Record<IeltsSkill, {
  label: string; color: string; bg: string; border: string; icon: typeof Headphones; subjective: boolean;
}> = {
  listening: { label: "Listening", color: "#0EA5E9", bg: "#E0F2FE", border: "#BAE6FD", icon: Headphones, subjective: false },
  reading:   { label: "Reading",   color: "#10B981", bg: "#D1FAE5", border: "#A7F3D0", icon: BookOpen,   subjective: false },
  writing:   { label: "Writing",   color: "#F59E0B", bg: "#FEF3C7", border: "#FDE68A", icon: PenLine,    subjective: true  },
  speaking:  { label: "Speaking",  color: "#EC4899", bg: "#FCE7F3", border: "#FBCFE8", icon: Mic,        subjective: true  },
};

const BAND_OPTIONS: number[] = (() => {
  const out: number[] = [];
  for (let v = 0; v <= 9; v += 0.5) out.push(v);
  return out;
})();

const roundToHalfBand = (val: number): number => {
  if (isNaN(val)) return 0;
  const clamped = Math.max(0, Math.min(9, val));
  return Math.round(clamped * 2) / 2;
};

const bandColor = (band: number): string => {
  if (band >= 8) return "#059669"; // emerald-600
  if (band >= 6.5) return "#10B981"; // emerald-500
  if (band >= 5) return "#F59E0B"; // amber-500
  if (band >= 3.5) return "#EF4444"; // red-500
  return "#7F1D1D"; // red-900
};

const bandDescriptor = (band: number): string => {
  if (band >= 9) return "Expert user";
  if (band >= 8) return "Very good user";
  if (band >= 7) return "Good user";
  if (band >= 6) return "Competent user";
  if (band >= 5) return "Modest user";
  if (band >= 4) return "Limited user";
  if (band >= 3) return "Extremely limited";
  if (band >= 1) return "Intermittent / Non user";
  return "Did not attempt";
};

// ─── Main Component ──────────────────────────────────────────────────────────
export function IeltsGradingDetail() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const toast = useToastContext();

  const [pageLoading, setPageLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [exam, setExam] = useState({ title: "—", testType: "Academic" });
  const [examId, setExamId] = useState<number | null>(null);
  const [student, setStudent] = useState({ name: "—", id: "" });
  const [submissionMeta, setSubmissionMeta] = useState({
    time: new Date(),
    attemptNumber: 1,
    status: "" as string,
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [overallFeedback, setOverallFeedback] = useState("");

  // Per-skill band overrides (range 0-9 step 0.5)
  const [bandOverrides, setBandOverrides] = useState<Partial<Record<IeltsSkill, string>>>({});
  const [activeSkillTab, setActiveSkillTab] = useState<IeltsSkill | null>(null);

  // Per-answer save state
  const [savingAnswerIds, setSavingAnswerIds] = useState<Record<string, boolean>>({});

  // Vùng cuộn nội bộ (header nằm NGOÀI vùng này nên luôn cố định, không trôi).
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);

  // Khi đổi tab skill → cuộn nội dung về đầu cho gọn.
  useEffect(() => {
    if (scrollBodyRef.current) scrollBodyRef.current.scrollTo({ top: 0 });
  }, [activeSkillTab]);

  // ── Load submission ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!submissionId) return;

    const load = async () => {
      try {
        setPageLoading(true);
        const res = await api.get(`/teacher/submissions/${submissionId}`);
        const d = res.data?.data ?? res.data;

        setExam({
          title: d.exam?.eTitle ?? "—",
          testType: d.exam?.ielts_test_type ?? "Academic",
        });
        setExamId(d.exam?.eId ?? null);
        setStudent({
          name: d.user?.uName ?? "—",
          id: d.user?.uPhone ?? "",
        });
        setSubmissionMeta({
          // Backend `show()` returns the Submission model directly under `data`,
          // so submission fields live on `d` (not `d.submission`). Mirror VSTEP detail.
          time: d.sSubmit_time ? new Date(d.sSubmit_time) : new Date(),
          attemptNumber: d.sAttempt ?? d.sAttempt_number ?? 1,
          status: d.sStatus ?? "",
        });

        // Pre-fill skill bands from sGemini_feedback.ielts_scores
        const raw = (() => {
          try {
            return typeof d.sGemini_feedback === "string"
              ? JSON.parse(d.sGemini_feedback)
              : (d.sGemini_feedback ?? {});
          } catch { return {}; }
        })();
        const ieltsScores = raw?.ielts_scores ?? {};
        const speakingResults = raw?.ielts_speaking_results ?? raw?.speaking_results ?? {};
        const initOverrides: Partial<Record<IeltsSkill, string>> = {};
        (["listening", "reading", "writing", "speaking"] as IeltsSkill[]).forEach((sk) => {
          if (ieltsScores[sk] != null) initOverrides[sk] = String(ieltsScores[sk]);
        });
        setBandOverrides(initOverrides);
        setOverallFeedback(d.sTeacher_feedback ?? "");

        // Map đáp án đúng theo qId từ exam.questions (objective L/R hiển thị "Đáp án: ...")
        const correctByQid: Record<number, string> = {};
        (d.exam?.questions ?? []).forEach((q: any) => {
          const opts = q.answers ?? [];
          const corrects = opts
            .filter((a: any) => a.aIs_correct === true || a.aIs_correct === 1)
            .map((a: any) => String(a.aContent ?? "").trim())
            .filter(Boolean);
          // Fallback: một số dạng điền từ lưu đáp án ở qData.correct_answer
          const fromData = q.qData?.correct_answer ?? q.qData?.answer ?? null;
          if (corrects.length) correctByQid[q.qId] = corrects.join(" / ");
          else if (fromData) correctByQid[q.qId] = String(fromData);
        });

          // Map answers → questions
        const speakingAudioMap = raw?.speaking_audio ?? {};
        const qs: Question[] = (d.answers ?? []).map((sa: any, idx: number): Question => {
          const q = sa.question ?? {};
          // ✅ FIX: fallback qSection → đảm bảo câu hỏi không mất khi qSkill null
          const skill = ((q.qSkill ?? q.qSection ?? "").toLowerCase()) as IeltsSkill;
          const isSubjective = skill === "writing" || skill === "speaking";
          const part = q.qPart ?? 1;
          const rawAnswer = String(sa.saAnswer_text ?? "").trim();
          const looksLikeAudio =
            skill === "speaking" &&
            (/^https?:\/\//i.test(rawAnswer) ||
              /\/storage\//i.test(rawAnswer) ||
              /\.(webm|ogg|mp3|wav|m4a|aac|mp4)(\?|$)/i.test(rawAnswer));
          const fromFeedback =
            speakingAudioMap?.[part] ?? speakingAudioMap?.[String(part)] ?? null;
          const resolvedAudio =
            skill === "speaking"
              ? (looksLikeAudio ? rawAnswer : fromFeedback ? String(fromFeedback) : "")
              : "";

          return {
            id: `q-${q.qId ?? idx}`,
            answerId: sa.saId,
            number: idx + 1,
            part,
            type: q.qType ?? "multiple_choice",
            skill,
            text: q.qContent ?? "",
            studentAnswer: sa.saAnswer_text ?? "",
            correctAnswer: q.correctAnswer ?? correctByQid[q.qId] ?? "",
            points: sa.saPoints_awarded ?? (isSubjective ? (sa.saAi_score ?? 0) : 0),
            maxPoints: isSubjective ? 9 : (q.qPoints ?? 1),
            isCorrect: sa.saIs_correct,
            feedback: sa.saTeacher_feedback ?? sa.saAi_feedback ?? "",
            autoGraded: !isSubjective,
            aiScore: sa.saAi_score ?? null,
            aiFeedback: sa.saAi_feedback ?? null,
            aiCriteria: sa.saAi_criteria?.criteria ?? null,
            aiCriterionComments: sa.saAi_criteria?.criterion_comments ?? null,
            reviewStatus: sa.saReview_status ?? null,
            audioUrl: resolvedAudio
              ? (getFullMediaUrl(resolvedAudio) ?? resolvedAudio)
              : undefined,
            transcript: skill === "speaking"
              ? (speakingResults?.[`part_${part}`]?.transcript ?? undefined)
              : undefined,
          };
        });
        setQuestions(qs);

        // Auto-select first available skill tab
        const availableSkills = (Object.keys(IELTS_SKILLS) as IeltsSkill[]).filter(
          (sk) => qs.some((q) => q.skill === sk)
        );
        if (availableSkills.length > 0) {
          setActiveSkillTab(availableSkills[0]);
        }
      } catch (err: any) {
        toast.error("Không tải được bài làm: " + (err?.response?.data?.message ?? err?.message ?? "lỗi"));
      } finally {
        setPageLoading(false);
      }
    };

    load();
  }, [submissionId]);

  // ── Group by skill ───────────────────────────────────────────────────────
  const ieltsGroups = useMemo(() => {
    const groups: Partial<Record<IeltsSkill, Question[]>> = {};
    for (const q of questions) {
      if (q.skill) {
        groups[q.skill] = groups[q.skill] ?? [];
        groups[q.skill]!.push(q);
      }
    }
    return groups;
  }, [questions]);

  // ── Compute per-skill bands ──────────────────────────────────────────────
  const skillBands = useMemo(() => {
    const result: Record<IeltsSkill, number> = {
      listening: 0, reading: 0, writing: 0, speaking: 0,
    };
    for (const sk of Object.keys(IELTS_SKILLS) as IeltsSkill[]) {
      const overrideStr = bandOverrides[sk] ?? "";
      const override = parseFloat(overrideStr);
      if (!isNaN(override)) {
        result[sk] = roundToHalfBand(override);
        continue;
      }

      const qs = ieltsGroups[sk] ?? [];
      if (qs.length === 0) {
        result[sk] = 0;
        continue;
      }

      if (IELTS_SKILLS[sk].subjective) {
        // Average per-task score (already band 0-9)
        const scores = qs.map((q) => {
          const teacher = q.points;
          const ai = q.aiScore;
          if (typeof teacher === "number" && teacher > 0) return teacher;
          if (typeof ai === "number") return ai;
          return 0;
        });
        result[sk] = roundToHalfBand(scores.reduce((a, b) => a + b, 0) / scores.length);
      } else {
        // Listening / Reading: convert raw correct count → band
        const correct = qs.filter((q) => q.points >= q.maxPoints).length;
        const total = qs.length;
        result[sk] = rawToIeltsBand(correct, total);
      }
    }
    return result;
  }, [ieltsGroups, bandOverrides, questions]);

  const overallBand = useMemo(() => {
    const presentSkills = (Object.keys(IELTS_SKILLS) as IeltsSkill[]).filter(
      (sk) => (ieltsGroups[sk]?.length ?? 0) > 0
    );
    if (presentSkills.length === 0) return 0;
    const sum = presentSkills.reduce((a, sk) => a + skillBands[sk], 0);
    return roundToHalfBand(sum / presentSkills.length);
  }, [ieltsGroups, skillBands]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const updateQuestionPoints = (id: string, pts: number) =>
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, points: pts } : q)));

  const updateQuestionFeedback = (id: string, fb: string) =>
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, feedback: fb } : q)));

  const acceptAiAnswer = async (q: Question) => {
    if (!submissionId || !q.aiScore) return;
    try {
      setSavingAnswerIds((prev) => ({ ...prev, [q.id]: true }));
      await gradingApi.acceptAi(parseInt(submissionId, 10), q.answerId);
      setQuestions((prev) =>
        prev.map((item) =>
          item.id === q.id
            ? { ...item, points: item.aiScore ?? 0, feedback: item.aiFeedback ?? "", reviewStatus: "accepted" }
            : item,
        ),
      );
      toast.success(`Câu ${q.number}: đã chấp nhận điểm AI`);
    } catch (err: any) {
      toast.error("Lỗi: " + (err?.response?.data?.message ?? err?.message));
    } finally {
      setSavingAnswerIds((prev) => ({ ...prev, [q.id]: false }));
    }
  };

  const saveAnswer = async (q: Question) => {
    if (!submissionId) return;
    try {
      setSavingAnswerIds((prev) => ({ ...prev, [q.id]: true }));
      await gradingApi.teacherGrade(parseInt(submissionId, 10), q.answerId, {
        score: q.points,
        feedback: q.feedback,
      });
      setQuestions((prev) =>
        prev.map((item) =>
          item.id === q.id ? { ...item, reviewStatus: "modified" } : item,
        ),
      );
      toast.success(`Câu ${q.number}: đã lưu điểm`);
    } catch (err: any) {
      toast.error("Lỗi: " + (err?.response?.data?.message ?? err?.message));
    } finally {
      setSavingAnswerIds((prev) => ({ ...prev, [q.id]: false }));
    }
  };

  // Lật Đúng/Sai cho câu khách quan (Reading/Listening) khi máy chấm sai.
  const setObjectiveCorrect = async (q: Question, correct: boolean) => {
    if (!submissionId) return;
    const newPoints = correct ? q.maxPoints : 0;
    // Cập nhật lạc quan để band tính lại ngay.
    setQuestions((prev) =>
      prev.map((item) =>
        item.id === q.id
          ? { ...item, points: newPoints, isCorrect: correct, reviewStatus: "modified" }
          : item,
      ),
    );
    try {
      setSavingAnswerIds((prev) => ({ ...prev, [q.id]: true }));
      await gradingApi.teacherGrade(parseInt(submissionId, 10), q.answerId, {
        score: newPoints,
        feedback: q.feedback,
      });
    } catch (err: any) {
      toast.error("Lỗi lưu: " + (err?.response?.data?.message ?? err?.message));
      // Hoàn tác nếu lưu lỗi.
      setQuestions((prev) =>
        prev.map((item) =>
          item.id === q.id ? { ...item, points: q.points, isCorrect: q.isCorrect } : item,
        ),
      );
    } finally {
      setSavingAnswerIds((prev) => ({ ...prev, [q.id]: false }));
    }
  };

  const handleSaveAll = async () => {
    if (!submissionId) return;
    try {
      setSaveLoading(true);

      // Persist any unsaved subjective answers first
      const subjectivePending = questions.filter(
        (q) => (q.skill === "writing" || q.skill === "speaking") && q.points > 0 && q.reviewStatus === "pending"
      );
      for (const q of subjectivePending) {
        try {
          await gradingApi.teacherGrade(parseInt(submissionId, 10), q.answerId, {
            score: q.points,
            feedback: q.feedback,
          });
        } catch { /* skip */ }
      }

      // Build skill_overrides from current state (only include non-empty values)
      const overrides: Record<string, number> = {};
      (["listening", "reading", "writing", "speaking"] as IeltsSkill[]).forEach((sk) => {
        const v = parseFloat(bandOverrides[sk] ?? "");
        if (!isNaN(v)) overrides[sk] = roundToHalfBand(v);
        else overrides[sk] = skillBands[sk];
      });

      await gradingApi.saveAll(parseInt(submissionId, 10), {
        sTeacher_feedback: overallFeedback,
        skill_overrides: overrides,
      });

      toast.success("Đã lưu kết quả chấm điểm IELTS!");
      setTimeout(() => navigate("/giao-vien/cham-diem"), 1200);
    } catch (err: any) {
      toast.error("Lỗi lưu: " + (err?.response?.data?.message ?? err?.message));
    } finally {
      setSaveLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-600">Đang tải bài làm IELTS…</p>
        </div>
      </div>
    );
  }

  const availableSkills = (Object.keys(IELTS_SKILLS) as IeltsSkill[]).filter(
    (sk) => (ieltsGroups[sk]?.length ?? 0) > 0
  );

  // ── Skill-vs-Full detection ───────────────────────────────────────────────
  // Full test = nhiều hơn 1 skill có câu hỏi → overall = trung bình các skill.
  // Single skill (vd: Reading Practice) → "overall" chính là band của skill đó,
  // nên ta đổi nhãn cho đúng UX thay vì gọi "Overall band".
  const singleSkill = availableSkills.length === 1 ? availableSkills[0] : null;
  const isFullTest = availableSkills.length > 1;
  const resultLabel = singleSkill ? `${IELTS_SKILLS[singleSkill].label} band` : "Overall band";
  const isInProgress = submissionMeta.status === "in_progress";

  // ── Empty state: bài chưa nộp / không có câu trả lời ───────────────────────
  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="sticky top-0 z-30 bg-white border-b border-slate-200">
          <div className="px-6 h-14 flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
              aria-label="Back"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wider">IELTS</span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">{exam.testType}</span>
              </div>
              <h1 className="text-base font-bold text-slate-900 truncate">{exam.title}</h1>
              <p className="text-xs text-slate-500 truncate">{student.name}{student.id ? ` · ${student.id}` : ""}</p>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1.5">
            {isInProgress ? "Học viên đang làm bài" : "Chưa có câu trả lời để chấm"}
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            {isInProgress
              ? "Bài thi này chưa được nộp (trạng thái: đang làm bài). Bạn chỉ có thể chấm sau khi học viên bấm nộp bài."
              : "Bài làm này không có dữ liệu câu trả lời. Có thể học viên chưa trả lời câu nào hoặc bài chưa được nộp."}
          </p>
          <button
            type="button"
            onClick={() => navigate("/giao-vien/cham-diem")}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            Về danh sách chấm điểm
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen max-h-screen overflow-hidden flex flex-col bg-slate-50">
      {/* Header - compact (NẰM NGOÀI vùng cuộn → luôn cố định) */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 z-30">
        <div className="px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (window.history.state && window.history.state.idx > 0) {
                  navigate(-1);
                } else {
                  navigate('/giao-vien/cham-diem');
                }
              }}
              className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors flex-shrink-0"
              aria-label="Back"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wider">
                  IELTS
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                  {exam.testType}
                </span>
              </div>
              <h1 className="text-base font-bold text-slate-900 truncate leading-tight">{exam.title}</h1>
              <p className="text-xs text-slate-500 truncate">
                {student.name} {student.id ? `· ${student.id}` : ""} · Lần thử {submissionMeta.attemptNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Overall / single-skill band display */}
            <div className="hidden sm:flex flex-col items-end pr-3 border-r border-slate-200">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{resultLabel}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: bandColor(overallBand) }}>
                  {overallBand.toFixed(1)}
                </span>
                <span className="text-xs text-slate-500">/ 9</span>
              </div>
            </div>

            {examId && (
              <Link
                to={`/giao-vien/xem-ielts/${examId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                title="Xem đề trong tab mới"
              >
                <Eye className="w-3.5 h-3.5" />
                Xem đề
              </Link>
            )}

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saveLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-60 transition-colors cursor-pointer"
            >
              {saveLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saveLoading ? "Đang lưu…" : "Lưu kết quả"}
            </button>
          </div>
        </div>
      </div>

      {/* Skill tab bar — chỉ hiện cho full test (single-skill thì thừa) */}
      {isFullTest && (
        <div className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
          <div className="px-6 py-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {availableSkills.map((sk) => {
                const meta = IELTS_SKILLS[sk];
                const Icon = meta.icon;
                const band = skillBands[sk];
                const isActive = activeSkillTab === sk;
                const count = ieltsGroups[sk]?.length ?? 0;

                return (
                  <button
                    key={sk}
                    type="button"
                    onClick={() => setActiveSkillTab(sk)}
                    aria-current={isActive ? "true" : undefined}
                    className={`group relative flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer text-left ${
                      isActive
                        ? "shadow-md scale-[1.02]"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                    style={isActive ? { backgroundColor: meta.bg, borderColor: meta.color } : undefined}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: meta.color }}
                    >
                      <Icon className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-700 truncate">{meta.label}</div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-bold tabular-nums" style={{ color: bandColor(band) }}>
                          {band.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-slate-400">{count} Q</span>
                      </div>
                    </div>
                    {isActive && (
                      <span
                        className="absolute -bottom-[1px] left-3 right-3 h-0.5 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Vùng cuộn nội bộ (header + tab bar ở trên KHÔNG nằm trong đây) ─── */}
      <div ref={scrollBodyRef} className="flex-1 min-h-0 overflow-y-auto">
        {/* Main grid: questions left, sidebar right */}
        <div className="max-w-7xl mx-auto px-4 py-5 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* LEFT: per-skill questions */}
        <div className="space-y-5">
          {activeSkillTab && (
            <SkillSection
              key={activeSkillTab}
              skill={activeSkillTab}
              questions={ieltsGroups[activeSkillTab] ?? []}
              onUpdatePoints={updateQuestionPoints}
              onUpdateFeedback={updateQuestionFeedback}
              onAcceptAi={acceptAiAnswer}
              onSaveAnswer={saveAnswer}
              onSetCorrect={setObjectiveCorrect}
              savingAnswerIds={savingAnswerIds}
              bandOverride={bandOverrides[activeSkillTab] ?? ""}
              onChangeOverride={(v) =>
                setBandOverrides((prev) => ({ ...prev, [activeSkillTab]: v }))
              }
              computedBand={skillBands[activeSkillTab]}
            />
          )}
        </div>

        {/* RIGHT: overall feedback + summary */}
        <aside className="space-y-4 lg:sticky lg:top-4 self-start">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900">{resultLabel}</h3>
            </div>
            <div className="text-center py-3">
              <div className="text-5xl font-black tabular-nums" style={{ color: bandColor(overallBand) }}>
                {overallBand.toFixed(1)}
              </div>
              <div className="mt-1 text-xs text-slate-500 font-medium">{bandDescriptor(overallBand)}</div>
            </div>
            {isFullTest && (
              <div className="border-t border-slate-100 pt-3 space-y-1.5">
                {availableSkills.map((sk) => (
                  <div key={sk} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{IELTS_SKILLS[sk].label}</span>
                    <span
                      className="font-bold tabular-nums"
                      style={{ color: bandColor(skillBands[sk]) }}
                    >
                      {skillBands[sk].toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-bold text-slate-900">Nhận xét tổng</h3>
            </div>
            <textarea
              value={overallFeedback}
              onChange={(e) => setOverallFeedback(e.target.value)}
              rows={6}
              placeholder="Nhập nhận xét chung cho học viên (band điểm, điểm mạnh, điểm yếu, lời khuyên)..."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900">
            <p className="font-semibold mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Mẹo chấm IELTS
            </p>
            <ul className="space-y-1 text-blue-800">
              <li>· Band 5-7 là phổ biến nhất</li>
              <li>· Band 8+ rất hiếm</li>
              {isFullTest
                ? <li>· Overall = trung bình 4 skills, làm tròn 0.5</li>
                : <li>· Bài 1 kỹ năng: kết quả chính là band của kỹ năng đó</li>}
              <li>· Speaking/Writing: AI đã chấm sẵn khi nộp, bạn chỉ cần xem lại</li>
              <li>· Reading/Listening: bấm Đúng/Sai để chỉnh nếu cần</li>
            </ul>
          </div>
        </aside>
        </div>
      </div>
    </div>
  );
}

// ─── Per-skill section ───────────────────────────────────────────────────────
interface SkillSectionProps {
  skill: IeltsSkill;
  questions: Question[];
  onUpdatePoints: (id: string, pts: number) => void;
  onUpdateFeedback: (id: string, fb: string) => void;
  onAcceptAi: (q: Question) => void;
  onSaveAnswer: (q: Question) => void;
  onSetCorrect: (q: Question, correct: boolean) => void;
  savingAnswerIds: Record<string, boolean>;
  bandOverride: string;
  onChangeOverride: (val: string) => void;
  computedBand: number;
}

function SkillSection({
  skill, questions, onUpdatePoints, onUpdateFeedback,
  onAcceptAi, onSaveAnswer, onSetCorrect, savingAnswerIds,
  bandOverride, onChangeOverride, computedBand,
}: SkillSectionProps) {
  const meta = IELTS_SKILLS[skill];
  const Icon = meta.icon;

  // Group questions by part/section/passage/task
  const partGroups = useMemo(() => {
    const map = new Map<number, Question[]>();
    for (const q of questions) {
      const p = q.part ?? 1;
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(q);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [questions]);

  const partLabel = (partNum: number): string => {
    if (skill === "listening") return `Section ${partNum}`;
    if (skill === "reading") return `Passage ${partNum}`;
    if (skill === "writing") return `Task ${partNum}`;
    if (skill === "speaking") return `Part ${partNum}`;
    return `Part ${partNum}`;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Skill header */}
      <div className="px-5 py-4 border-b border-slate-100" style={{ backgroundColor: meta.bg }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-lg flex items-center justify-center shadow-sm"
              style={{ backgroundColor: meta.color }}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{meta.label}</h2>
              <p className="text-xs text-slate-600">
                {questions.length} câu hỏi · {partGroups.length} {skill === "listening" ? "section" : skill === "reading" ? "passage" : skill === "writing" ? "task" : "part"}
              </p>
            </div>
          </div>

          {/* Band override picker */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-700">Override band:</label>
            <select
              value={bandOverride}
              onChange={(e) => onChangeOverride(e.target.value)}
              className="px-3 py-1.5 text-sm font-bold rounded-md border-2 cursor-pointer transition-colors tabular-nums"
              style={{
                borderColor: meta.color,
                color: bandColor(computedBand),
                backgroundColor: "white",
              }}
            >
              <option value="">Auto ({computedBand.toFixed(1)})</option>
              {BAND_OPTIONS.map((b) => (
                <option key={b} value={b}>{b.toFixed(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Parts */}
      <div className="divide-y divide-slate-100">
        {partGroups.map(([partNum, qs]) => (
          <div key={partNum} className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="px-2.5 py-1 rounded-md text-[11px] font-bold"
                style={{ backgroundColor: meta.bg, color: meta.color }}
              >
                {partLabel(partNum)}
              </div>
              <div className="text-xs text-slate-500">
                Q{qs[0]?.number} – Q{qs[qs.length - 1]?.number} · {qs.length} câu
              </div>
            </div>

            <div className="space-y-3">
              {qs.map((q) => (
                <QuestionRow
                  key={q.id}
                  question={q}
                  isSubjective={meta.subjective}
                  onUpdatePoints={onUpdatePoints}
                  onUpdateFeedback={onUpdateFeedback}
                  onAcceptAi={onAcceptAi}
                  onSaveAnswer={onSaveAnswer}
                  onSetCorrect={onSetCorrect}
                  saving={!!savingAnswerIds[q.id]}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Question row ─────────────────────────────────────────────────────────────
function QuestionRow({
  question, isSubjective, onUpdatePoints, onUpdateFeedback,
  onAcceptAi, onSaveAnswer, onSetCorrect, saving,
}: {
  question: Question;
  isSubjective: boolean;
  onUpdatePoints: (id: string, pts: number) => void;
  onUpdateFeedback: (id: string, fb: string) => void;
  onAcceptAi: (q: Question) => void;
  onSaveAnswer: (q: Question) => void;
  onSetCorrect: (q: Question, correct: boolean) => void;
  saving: boolean;
}) {
  const q = question;
  const hasAi = q.aiScore != null;
  const isCorrect = !isSubjective && q.points >= q.maxPoints;
  const isWrong = !isSubjective && q.points < q.maxPoints && q.studentAnswer;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
      {/* Header row */}
      <div className="flex items-start gap-3 mb-2.5">
        <div
          className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold tabular-nums ${
            isCorrect
              ? "bg-emerald-100 text-emerald-700"
              : isWrong
                ? "bg-red-100 text-red-700"
                : "bg-slate-200 text-slate-700"
          }`}
        >
          {q.number}
        </div>
        <div className="flex-1 min-w-0 text-sm text-slate-900">
          {q.text || <em className="text-slate-400">Câu hỏi không có nội dung</em>}
        </div>
        {q.reviewStatus === "accepted" && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">AI</span>
        )}
        {q.reviewStatus === "modified" && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">Đã sửa</span>
        )}
      </div>

      {/* Student answer (always shown) */}
      <div className="mb-2.5 pl-10">
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
          {q.audioUrl ? "Bài nói của học viên" : "Học viên trả lời"}
        </div>
        {q.audioUrl ? (
          <div className="space-y-2">
            <audio controls preload="none" src={getFullMediaUrl(q.audioUrl) ?? q.audioUrl} className="w-full h-9">
              Trình duyệt không hỗ trợ phát audio.
            </audio>
            {q.transcript && (
              <div className="bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-700 max-h-40 overflow-y-auto whitespace-pre-wrap">
                <span className="font-semibold text-slate-500">Transcript (AI): </span>
                {q.transcript}
              </div>
            )}
          </div>
        ) : isSubjective ? (
          <div className="bg-white border border-slate-200 rounded p-2.5 text-sm text-slate-800 max-h-40 overflow-y-auto whitespace-pre-wrap">
            {q.studentAnswer || <em className="text-slate-400">Để trống</em>}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded p-2 text-sm text-slate-800">
            {q.studentAnswer || <em className="text-slate-400">Để trống</em>}
            {q.correctAnswer && (
              <span className="ml-3 text-xs text-emerald-700">
                · Đáp án: <strong>{q.correctAnswer}</strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Subjective: AI suggestion + teacher override */}
      {isSubjective && (
        <div className="pl-10 space-y-2.5">
          {hasAi && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700">
                  <Bot className="w-3.5 h-3.5" />
                  AI suggestion
                </div>
                <div className="text-2xl font-black text-purple-700 tabular-nums">
                  {q.aiScore!.toFixed(1)}
                </div>
              </div>
              {q.aiFeedback && (
                <p className="text-xs text-purple-900 mb-2">{q.aiFeedback}</p>
              )}
              {q.aiCriteria && (
                <div className="grid grid-cols-2 gap-1 text-[11px] mb-2">
                  {Object.entries(q.aiCriteria).map(([k, v]) => (
                    <div key={k} className="flex justify-between bg-white rounded px-2 py-1">
                      <span className="text-purple-700 truncate">{k}</span>
                      <span className="font-bold text-purple-900 tabular-nums">{v ?? "—"}</span>
                    </div>
                  ))}
                </div>
              )}
              {q.reviewStatus !== "accepted" && (
                <button
                  type="button"
                  onClick={() => onAcceptAi(q)}
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Chấp nhận AI score
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_auto] gap-2 items-end">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Band điểm (0–9)
              </label>
              <select
                value={q.points}
                onChange={(e) => onUpdatePoints(q.id, parseFloat(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-sm font-bold tabular-nums cursor-pointer focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
              >
                {BAND_OPTIONS.map((b) => (
                  <option key={b} value={b}>{b.toFixed(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Nhận xét
              </label>
              <textarea
                value={q.feedback}
                onChange={(e) => onUpdateFeedback(q.id, e.target.value)}
                rows={1}
                placeholder="Nhận xét cho câu này…"
                className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none resize-y"
              />
            </div>
            <button
              type="button"
              onClick={() => onSaveAnswer(q)}
              disabled={saving}
              className="px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50 cursor-pointer transition-colors inline-flex items-center gap-1"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Lưu
            </button>
          </div>
        </div>
      )}

      {/* Objective: toggle Đúng/Sai cho giáo viên sửa khi máy chấm sai */}
      {!isSubjective && (
        <div className="pl-10 flex items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden bg-white">
            <button
              type="button"
              disabled={saving}
              onClick={() => onSetCorrect(q, true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer ${
                isCorrect
                  ? "bg-emerald-600 text-white"
                  : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Đúng
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => onSetCorrect(q, false)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer border-l border-slate-200 ${
                !isCorrect && q.points < q.maxPoints
                  ? "bg-red-600 text-white"
                  : "text-slate-500 hover:bg-red-50 hover:text-red-700"
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Sai
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
            <span className="tabular-nums font-semibold">
              {q.points} / {q.maxPoints}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Convert raw correct count → IELTS band (Listening / Reading 40-question scale).
 * Approximates the official IDP/British Council conversion table.
 */
function rawToIeltsBand(correct: number, total: number): number {
  if (total <= 0) return 0;
  const pct = correct / total;
  if (pct >= 0.975) return 9.0;
  if (pct >= 0.925) return 8.5;
  if (pct >= 0.875) return 8.0;
  if (pct >= 0.800) return 7.5;
  if (pct >= 0.725) return 7.0;
  if (pct >= 0.650) return 6.5;
  if (pct >= 0.575) return 6.0;
  if (pct >= 0.500) return 5.5;
  if (pct >= 0.400) return 5.0;
  if (pct >= 0.325) return 4.5;
  if (pct >= 0.250) return 4.0;
  if (pct >= 0.175) return 3.5;
  if (pct >= 0.100) return 3.0;
  return 2.5;
}

export default IeltsGradingDetail;

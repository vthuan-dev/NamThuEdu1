import { Fragment, useState, useMemo, useEffect, useRef, useLayoutEffect, Suspense } from "react";
import { lazyWithReload } from "../../../../utils/lazyWithReload";
import { api } from "../../../../services/api";
import { getFullMediaUrl } from "../../../../utils/mediaUtils";

// Lazy-load các khung chấm điểm theo loại đề. Bọc lazyWithReload để tự reload
// 1 lần khi chunk 404 (deploy mới đổi hash). Khai báo ở module scope để không
// tạo lại component mỗi lần render (tránh remount + mất state).
const LazyIeltsGrading = lazyWithReload(() => import("./IeltsGradingDetail").then((m) => ({ default: m.IeltsGradingDetail })));
const LazyThptGrading = lazyWithReload(() => import("./ThptGradingDetail").then((m) => ({ default: m.ThptGradingDetail })));
const LazyKidsGrading = lazyWithReload(() => import("./KidsGradingDetail").then((m) => ({ default: m.KidsGradingDetail })));
import { gradingApi } from "../../../../services/gradingApi";
import { KidsAnswerReview } from "./KidsAnswerReview";
import { useTranslation } from "react-i18next";
import { Link, useParams, useNavigate } from "react-router";
import { useToastContext } from "../../../../contexts/ToastContext";
import {
  ChevronRight,
  FileText,
  Clock,
  Hash,
  Save,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ThumbsUp,
  AlertCircle,
  Bot,
  Pencil,
  LayoutList,
  Target,
  Headphones,
  BookOpen,
  PenTool,
  Mic,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Star,
  TrendingUp,
  TrendingDown,
  Trophy,
  Sparkles,
  Award,
  Download,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
type VstepSkill = "listening" | "reading" | "writing" | "speaking";

interface Question {
  id: string;
  answerId: number;      // saId — the submission_answer primary key used by API endpoints
  number: number;
  part?: number;         // VSTEP part number (1, 2, 3 for speaking; 1, 2 for writing)
  type: "multiple_choice" | "essay" | "fill_blank" | "true_false";
  skill?: VstepSkill;
  text: string;
  studentAnswer: string;
  correctAnswer?: string;
  aiScore?: number;      // AI-assigned score for subjective
  points: number;
  pointsAwarded?: number | null;
  maxPoints: number;
  isCorrect?: boolean;
  feedback: string;
  autoGraded: boolean;
  options?: { id: string; letter: string; content: string; isCorrect: boolean }[];
  originalOptions?: { id: string; letter: string; content: string; isCorrect: boolean }[];
  isOverrideKey?: boolean;
  audioUrl?: string;
  kidsTaskConfig?: any;   // cấu hình kids task (task_type, task_data...) để hiển thị bài làm rõ ràng
  explanation?: string;
}

// ─── Skill config ─────────────────────────────────────────────────────────────
const VSTEP_SKILLS: Record<VstepSkill, { labelKey: string; emoji: string; color: string; bg: string; border: string; icon: typeof Headphones; subjective: boolean }> = {
  listening: { labelKey: "teacher.grading.detail.skills.listening", emoji: "🎧", color: "#F59E0B", bg: "#FEF3C7", border: "#FDE68A", icon: Headphones, subjective: false },
  reading:   { labelKey: "teacher.grading.detail.skills.reading",   emoji: "📖", color: "#0EA5E9", bg: "#E0F2FE", border: "#BAE6FD", icon: BookOpen,   subjective: false },
  writing:   { labelKey: "teacher.grading.detail.skills.writing",   emoji: "✍️", color: "#8B5CF6", bg: "#EDE9FE", border: "#DDD6FE", icon: PenTool,    subjective: true  },
  speaking:  { labelKey: "teacher.grading.detail.skills.speaking",  emoji: "�️", color: "#EC4899", bg: "#FCE7F3", border: "#FBCFE8", icon: Mic,        subjective: true  },
};

const Q_TYPE_CONFIG: Record<Question["type"], { labelKey: string; color: string; bg: string; icon: typeof LayoutList }> = {
  multiple_choice: { labelKey: "teacher.grading.detail.questionTypes.multiple_choice", color: "#6366F1", bg: "#EEF2FF", icon: LayoutList },
  essay:           { labelKey: "teacher.grading.detail.questionTypes.essay",           color: "#8B5CF6", bg: "#EDE9FE", icon: Pencil    },
  fill_blank:      { labelKey: "teacher.grading.detail.questionTypes.fill_blank",      color: "#0EA5E9", bg: "#E0F2FE", icon: Hash       },
  true_false:      { labelKey: "teacher.grading.detail.questionTypes.true_false",      color: "#F59E0B", bg: "#FEF3C7", icon: Target     },
};

// ─── Mock VSTEP data ──────────────────────────────────────────────────────────
const MOCK_VSTEP_QUESTIONS: Question[] = [
  // Listening
  { id: "L1", answerId: 0, number: 1, type: "multiple_choice", skill: "listening", text: "What time does the train leave?", studentAnswer: "A. 9:30", correctAnswer: "A. 9:30", points: 1, maxPoints: 1, isCorrect: true, feedback: "", autoGraded: true },
  { id: "L2", answerId: 0, number: 2, type: "multiple_choice", skill: "listening", text: "Where will the speakers meet?", studentAnswer: "B. At the library", correctAnswer: "C. At the café", points: 0, maxPoints: 1, isCorrect: false, feedback: "", autoGraded: true },
  { id: "L3", answerId: 0, number: 3, type: "true_false",      skill: "listening", text: "The woman works at a hospital.", studentAnswer: "True", correctAnswer: "False", points: 0, maxPoints: 1, isCorrect: false, feedback: "", autoGraded: true },
  // Reading
  { id: "R1", answerId: 0, number: 4, type: "multiple_choice", skill: "reading", text: "According to the passage, what is the main cause of deforestation?", studentAnswer: "C. Agricultural expansion", correctAnswer: "C. Agricultural expansion", points: 1, maxPoints: 1, isCorrect: true, feedback: "", autoGraded: true },
  { id: "R2", answerId: 0, number: 5, type: "fill_blank",      skill: "reading", text: "The author uses the word '___' to describe the rapid loss of biodiversity.", studentAnswer: "alarming", correctAnswer: "alarming", points: 1, maxPoints: 1, isCorrect: true, feedback: "", autoGraded: true },
  { id: "R3", answerId: 0, number: 6, type: "true_false",      skill: "reading", text: "The article claims renewable energy is currently more expensive than fossil fuels.", studentAnswer: "False", correctAnswer: "False", points: 1, maxPoints: 1, isCorrect: true, feedback: "", autoGraded: true },
  // Writing (subjective)
  { id: "W1", answerId: 0, number: 7, type: "essay", skill: "writing", text: "Task 1: Describe the graph below about internet usage in Vietnam from 2015–2023. (150–180 words)", studentAnswer: "The graph shows that internet usage in Vietnam has increased significantly over the past 8 years. In 2015, only around 45% of the population had access to the internet. By 2023, this figure had risen to nearly 80%. The most notable growth occurred between 2017 and 2019 when the government invested heavily in infrastructure...", aiScore: 7.5, points: 0, maxPoints: 10, feedback: "", autoGraded: false },
  { id: "W2", answerId: 0, number: 8, type: "essay", skill: "writing", text: "Task 2: Some people believe that technology makes people more isolated. Do you agree or disagree? (250–300 words)", studentAnswer: "Technology has become an integral part of modern life, and many argue that it creates social isolation. While I partially agree with this view, I believe the benefits outweigh the drawbacks when technology is used responsibly...", aiScore: 8.0, points: 0, maxPoints: 10, feedback: "", autoGraded: false },
  // Speaking (subjective)
  { id: "S1", answerId: 0, number: 9, type: "essay", skill: "speaking", text: "Task 1: Talk about your hometown. Describe its location, climate, and what makes it special. (2–3 minutes)", studentAnswer: "[Transcript] My hometown is Da Nang, a coastal city in central Vietnam. It is located between Hue and Hoi An, making it a central hub for tourism. The climate is tropical, with a dry season from May to September and a rainy season from October to April. What makes Da Nang special is its beautiful beaches, particularly My Khe Beach, which is often ranked among the best in Asia...", aiScore: 7.0, points: 0, maxPoints: 10, feedback: "", autoGraded: false },
];

const MOCK_OTHER_QUESTIONS: Question[] = [
  { id: "1", answerId: 0, number: 1, type: "multiple_choice", text: "What is the capital of Vietnam?", studentAnswer: "Hanoi", correctAnswer: "Hanoi", points: 10, maxPoints: 10, isCorrect: true, feedback: "", autoGraded: true },
  { id: "2", answerId: 0, number: 2, type: "essay", text: "Write an essay about the importance of learning English in the modern world. (200-250 words)", studentAnswer: "Learning English is extremely important in today's globalized world. It helps us communicate with people from different countries and opens up many opportunities for career advancement...", points: 0, maxPoints: 20, feedback: "", autoGraded: false },
  { id: "3", answerId: 0, number: 3, type: "fill_blank", text: "I ___ (go) to school every day.", studentAnswer: "go", correctAnswer: "go", points: 5, maxPoints: 5, isCorrect: true, feedback: "", autoGraded: true },
];

// ─── Score bar ────────────────────────────────────────────────────────────────
function MiniScoreBar({ score, max, color }: { score: number; max: number; color: string }) {
  const pct = Math.min((score / max) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-black w-10 text-right" style={{ color }}>{score.toFixed(1)}/10</span>
    </div>
  );
}

// ─── Main Component (VSTEP-specific implementation) ─────────────────────────
function VstepGradingDetailInternal() {
  const { t } = useTranslation();
  const { submissionId } = useParams();
  const toast = useToastContext();
  const navigate = useNavigate();

  // ── Remote state ────────────────────────────────────────────────────────────
  const [pageLoading, setPageLoading] = useState(true);
  const [saveLoading, setSaveLoading]   = useState(false);
  const [exam,       setExam]           = useState({ title: "—", type: "VSTEP" });
  const [student,    setStudent]        = useState({ name: "—", avatar: "??", id: "" });
  const [submission, setSubmission]     = useState({ time: new Date(), attemptNumber: 1 });
  const isVstep = exam.type.toLowerCase().includes("vstep");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [overallFeedback, setOverallFeedback] = useState("");
  const [strengths] = useState<string[]>([]);
  const [improvements] = useState<string[]>([]);

  // Per-skill override scores (VSTEP)
  const [skillScores, setSkillScores]   = useState<Partial<Record<VstepSkill, string>>>({});
  const [skillFeedback, setSkillFeedback] = useState<Partial<Record<VstepSkill, string>>>({});
  const [savingCorrectAnswerIds, setSavingCorrectAnswerIds] = useState<Record<string, boolean>>({});
  const [hoveredSkillButton, setHoveredSkillButton] = useState<string | null>(null);
  // Authoritative total score from DB (sScore field) — avoids frontend recomputation drift
  const [dbScore, setDbScore] = useState<number | null>(null);
  // Track which question cards are in "override answer key" mode (separate from questions state
  // to avoid full-list remount that would cause scroll jump)
  const [overrideKeyIds, setOverrideKeyIds] = useState<Set<string>>(new Set());

  // Preserve scroll position across setQuestions re-renders
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const savedScrollRef = useRef<number>(0);
  const isUpdatingQuestions = useRef(false);

  useLayoutEffect(() => {
    if (isUpdatingQuestions.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = savedScrollRef.current;
      isUpdatingQuestions.current = false;
    }
  });

  const safeSetQuestions: typeof setQuestions = (updater) => {
    // Save scroll position before state update
    if (scrollContainerRef.current) {
      savedScrollRef.current = scrollContainerRef.current.scrollTop;
      isUpdatingQuestions.current = true;
    }
    setQuestions(updater as any);
  };
  // Per-answer editing mode for AI grading review (true = teacher is overriding, false = following AI)
  const [editingAnswerIds, setEditingAnswerIds] = useState<Record<string, boolean>>({});
  // Per-answer saving state — for the "Save" button on each question
  const [savingAnswerIds, setSavingAnswerIds] = useState<Record<string, boolean>>({});
  // Toggle transcript visibility per speaking question (false = hidden by default)
  const [showTranscripts, setShowTranscripts] = useState<Record<string, boolean>>({});
  const [activeSkillTab, setActiveSkillTab] = useState<VstepSkill | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // ── Fetch submission from API ────────────────────────────────────────────
  useEffect(() => {
    if (!submissionId) return;
    setPageLoading(true);
    api.get(`/teacher/submissions/${submissionId}`)
      .then((res: any) => {
        const d = res?.data?.data ?? res?.data;
        if (!d) return;

        // Student
        const uName: string = d.user?.uName ?? "Unknown";
        setStudent({
          name:   uName,
          avatar: uName.split(" ").pop()?.substring(0, 2).toUpperCase() ?? "?",
          id:     String(d.user?.uId ?? ""),
        });

        // Exam
        setExam({ title: d.exam?.eTitle ?? "—", type: d.exam?.eType ?? "General" });

        // Submission meta
        setSubmission({
          time:          d.sSubmit_time ? new Date(d.sSubmit_time) : new Date(),
          attemptNumber: d.sAttempt ?? 1,
        });

        // Overall feedback
        if (d.sTeacher_feedback) setOverallFeedback(d.sTeacher_feedback);

        // Authoritative score from DB
        if (d.sScore !== undefined && d.sScore !== null) setDbScore(Number(d.sScore));

        // NOTE: We intentionally do NOT pre-populate per-skill override scores here.
        // The skill header score is computed dynamically from each task's score
        // (teacher points → AI score). This keeps the header in sync when the teacher
        // grades individual tasks. The skill-level override input stays empty and shows
        // the computed value as a placeholder; teacher may still type to override.

        // Build correct-answer lookup: qId → correct answer content
        const correctMap: Record<number, string> = {};
        const kidsConfigMap: Record<number, any> = {};
        for (const eq of (d.exam?.questions ?? [])) {
          const correct = (eq.answers ?? []).find((a: any) => a.aIs_correct);
          if (correct) correctMap[eq.qId] = correct.aContent;
          if (eq.kids_task_config) kidsConfigMap[eq.qId] = eq.kids_task_config;
        }

        let geminiFeedback: any = {};
        if (d.sGemini_feedback) {
          try {
            geminiFeedback = typeof d.sGemini_feedback === "string"
              ? JSON.parse(d.sGemini_feedback)
              : d.sGemini_feedback;
          } catch (e) {
            console.error("Failed to parse sGemini_feedback", e);
          }
        }

        // Map student answers → Question[]
        const examTypeUpper = String(d.exam?.eType ?? "").toUpperCase();
        // VSTEP/IELTS: objective tính 1 điểm/câu (điểm kỹ năng quy đổi riêng).
        // Các đề khác (Kids/Teens/General): dùng điểm thực của câu hỏi (qPoints/qScore).
        const useRealPoints = !(examTypeUpper.includes("VSTEP") || examTypeUpper.includes("IELTS"));
        const qs: Question[] = (d.answers ?? []).map((sa: any, idx: number) => {
          const q = sa.question ?? {};
          // ✅ FIX: fallback qSection → đảm bảo câu hỏi không mất khi qSkill null
          const skill = ((q.qSkill ?? q.qSection ?? "").toLowerCase()) as VstepSkill;
          const isSubjective = skill === "writing" || skill === "speaking";
          
          let studentAns = sa.saAnswer_text ?? "";
          let audioUrl: string | undefined = undefined;

          if (skill === "speaking") {
            const part = q.qPart ?? 1;
            const rawAnswer = String(sa.saAnswer_text ?? "").trim();
            // Ưu tiên saAnswer_text nếu là URL audio; fallback speaking_audio[part]
            const looksLikeAudio =
              /^https?:\/\//i.test(rawAnswer) ||
              /\/storage\//i.test(rawAnswer) ||
              /\.(webm|ogg|mp3|wav|m4a|aac|mp4)(\?|$)/i.test(rawAnswer);
            const fromFeedback =
              geminiFeedback?.speaking_audio?.[part] ??
              geminiFeedback?.speaking_audio?.[String(part)] ??
              null;
            const resolved = looksLikeAudio ? rawAnswer : (fromFeedback ? String(fromFeedback) : "");
            audioUrl = resolved ? (getFullMediaUrl(resolved) ?? resolved) : undefined;

            const transcript =
              geminiFeedback.speaking_results?.[`part_${part}`]?.transcript ??
              geminiFeedback.ielts_speaking_results?.[`part_${part}`]?.transcript ??
              "";
            studentAns = transcript
              ? `[Transcript] ${transcript}`
              : (looksLikeAudio ? "" : rawAnswer);
          }

          // Retrieve full options (A, B, C, D) from the exam question
          const examQ = (d.exam?.questions ?? []).find((eq: any) => eq.qId === q.qId);
          const letters = ["A", "B", "C", "D"];
          const options = (examQ?.answers ?? []).map((a: any, index: number) => {
            const letter = letters[a.aOrder ?? index] ?? letters[index];
            return {
              id: String(a.aId),
              letter,
              content: a.aContent,
              isCorrect: Boolean(a.aIs_correct),
            };
          });

          // Use sa.saIs_correct (already computed by auto-grader)
          const isCorrect: boolean | undefined = isSubjective
            ? undefined
            : (sa.saIs_correct !== null && sa.saIs_correct !== undefined
               ? Boolean(sa.saIs_correct)
               : undefined);
          return {
            id:            String(q.qId ?? sa.saId ?? idx),
            answerId:      Number(sa.saId),
            number:        idx + 1,
            part:          q.qPart !== undefined && q.qPart !== null ? Number(q.qPart) : undefined,
            type:          isSubjective ? "essay" : "multiple_choice",
            skill,
            text:          q.qContent ?? q.qText ?? "",
            studentAnswer: studentAns,
            correctAnswer: isSubjective ? undefined : correctMap[q.qId],
            aiScore:       sa.saAi_score !== null && sa.saAi_score !== undefined
                             ? Number(sa.saAi_score)
                             : undefined,
            // ⚠️ Default points = teacher's saPoints_awarded → fallback AI score → 0.
            // Quan trọng: với câu chưa teacher chấm (saPoints_awarded null), giữ AI
            // score để KHÔNG ghi đè 0 khi save. Bug cũ: T2 chưa chấm → 0 → save 0.
            points:        Number(sa.saPoints_awarded ?? sa.saAi_score ?? 0),
            pointsAwarded: sa.saPoints_awarded !== null && sa.saPoints_awarded !== undefined ? Number(sa.saPoints_awarded) : null,
            maxPoints:     isSubjective ? 10 : (useRealPoints ? Number(q.qPoints ?? q.qScore ?? 1) : 1),
            isCorrect:     isCorrect as boolean | undefined,
            feedback:      sa.saTeacher_feedback ?? "",
            autoGraded:    !isSubjective,
            options,
            originalOptions: [...options],
            isOverrideKey:  false,
            audioUrl,
            kidsTaskConfig: kidsConfigMap[q.qId] ?? q.kids_task_config ?? undefined,
            explanation:    q.qExplanation ?? "",
          } satisfies Question;
        });
        setQuestions(qs);

        // Auto-select first available skill tab
        const availableSkills = (Object.keys(VSTEP_SKILLS) as VstepSkill[]).filter(
          (sk) => qs.some((q) => q.skill === sk)
        );
        if (availableSkills.length > 0) {
          setActiveSkillTab(availableSkills[0]);
        }
      })
      .catch((err: any) => {
        console.error("Lỗi tải bài chấm điểm:", err);
        toast.error(err?.response?.data?.message || "Không tải được bài chấm điểm. Vui lòng thử lại.");
      })
      .finally(() => setPageLoading(false));
  }, [submissionId]);

  // ── Save handler ────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!submissionId) return;
    setSaveLoading(true);
    const questionScores = questions.map((q) => ({
      question_id:      parseInt(q.id),
      saPoints_awarded: q.points,
    }));
    api.post(`/teacher/submissions/${submissionId}/grade`, {
      questionScores,
      sTeacher_feedback: overallFeedback,
    })
      .then(() => {
        // Log activity (best-effort)
        import("../../../../services/teacherActivityLog").then(({ logTeacherActivity }) => {
          logTeacherActivity({
            action: "grading.complete",
            entity_type: "submission",
            entity_id: Number(submissionId),
            detail: "Chấm điểm bài thi xong",
          });
        });
        toast.success("Đã lưu điểm bài thi thành công!");
        navigate("/giao-vien/cham-diem");
      })
      .catch((err: any) => {
        console.error(err);
        toast.error(err?.response?.data?.message || "Lỗi khi lưu điểm bài thi.");
      })
      .finally(() => setSaveLoading(false));
  };

  const updateSkillScore = (skill: VstepSkill, val: string) => setSkillScores((p) => ({ ...p, [skill]: val }));
  const updateSkillFeedback = (skill: VstepSkill, val: string) => setSkillFeedback((p) => ({ ...p, [skill]: val }));

  const updateQuestionPoints = (id: string, pts: number) =>
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === id) {
          const finalPts = Math.min(pts, q.maxPoints);
          return {
            ...q,
            points: finalPts,
            pointsAwarded: finalPts,
            isCorrect: q.autoGraded ? finalPts > 0 : q.isCorrect,
          };
        }
        return q;
      })
    );
  const updateQuestionFeedback = (id: string, fb: string) =>
    setQuestions((prev) => prev.map((q) => q.id === id ? { ...q, feedback: fb } : q));

  /**
   * Save a single answer's grade to DB.
   *  - If teacher is in "accept AI" mode → call accept-ai endpoint
   *  - If teacher is editing → call teacher-grade endpoint with their score+feedback
   * Updates local state + shows toast.
   */
  const saveAnswer = async (q: Question) => {
    if (!submissionId) return;
    const ansIdNum = q.answerId;
    if (!ansIdNum || Number.isNaN(ansIdNum)) {
      toast.error("ID câu trả lời không hợp lệ.");
      return;
    }

    const isEditing = editingAnswerIds[q.id] === true;
    const hasAi = q.aiScore !== undefined && q.aiScore !== null;

    setSavingAnswerIds((p) => ({ ...p, [q.id]: true }));
    try {
      if (hasAi && !isEditing) {
        // Teacher accepts AI verbatim
        await gradingApi.acceptAi(parseInt(submissionId, 10), ansIdNum);
        // Update local state: set points = aiScore
        setQuestions((prev) => prev.map((item) =>
          item.id === q.id ? { ...item, points: Number(item.aiScore ?? 0), pointsAwarded: Number(item.aiScore ?? 0) } : item
        ));
        toast.success("Đã đồng ý điểm AI và lưu vào hệ thống.");
      } else {
        // Teacher overrides
        await gradingApi.teacherGrade(parseInt(submissionId, 10), ansIdNum, {
          score: Number(q.points || 0),
          feedback: q.feedback || "",
        });
        // points already set via slider/input — update pointsAwarded
        setQuestions((prev) => prev.map((item) =>
          item.id === q.id ? { ...item, pointsAwarded: item.points } : item
        ));
        toast.success("Đã lưu điểm và nhận xét cho câu này.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Lỗi khi lưu điểm. Vui lòng thử lại.");
    } finally {
      setSavingAnswerIds((p) => ({ ...p, [q.id]: false }));
    }
  };

  const changeCorrectOption = (qId: string, newCorrectLetter: string) => {
    // Enter override mode for this question
    setOverrideKeyIds((prev) => { const s = new Set(prev); s.add(qId); return s; });
    safeSetQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const updatedOptions = q.options?.map((opt) => ({
          ...opt,
          isCorrect: opt.letter === newCorrectLetter,
        })) ?? [];
        const matchedOption = updatedOptions.find((o) => o.isCorrect);
        const correctAnswerText = matchedOption ? matchedOption.content : q.correctAnswer;
        const cleanStudentAnswer = q.studentAnswer.replace(/^[A-D]\.\s*/i, "").trim();
        const studentOption = q.options?.find(
          (opt) =>
            opt.letter.toLowerCase() === q.studentAnswer.toLowerCase().trim() ||
            opt.content.toLowerCase().trim() === q.studentAnswer.toLowerCase().trim() ||
            opt.content.toLowerCase().trim() === cleanStudentAnswer.toLowerCase()
        );
        const studentOptionLetter = studentOption ? studentOption.letter : q.studentAnswer;
        const isCorrect = studentOptionLetter.toUpperCase() === newCorrectLetter.toUpperCase();
        const points = isCorrect ? q.maxPoints : 0;
        return { ...q, options: updatedOptions, correctAnswer: correctAnswerText, points, isCorrect };
      })
    );
  };

  const resetToOriginalKey = (qId: string) => {
    // Exit override mode for this question
    setOverrideKeyIds((prev) => { const s = new Set(prev); s.delete(qId); return s; });
    safeSetQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId || !q.originalOptions) return q;
        const originalCorrectOpt = q.originalOptions.find((o) => o.isCorrect);
        const correctAnswerText = originalCorrectOpt ? originalCorrectOpt.content : q.correctAnswer;
        const correctLetter = originalCorrectOpt ? originalCorrectOpt.letter : "";
        const cleanStudentAnswer = q.studentAnswer.replace(/^[A-D]\.\s*/i, "").trim();
        const studentOption = q.options?.find(
          (opt) =>
            opt.letter.toLowerCase() === q.studentAnswer.toLowerCase().trim() ||
            opt.content.toLowerCase().trim() === q.studentAnswer.toLowerCase().trim() ||
            opt.content.toLowerCase().trim() === cleanStudentAnswer.toLowerCase()
        );
        const studentOptionLetter = studentOption ? studentOption.letter : q.studentAnswer;
        const isCorrect = studentOptionLetter.toUpperCase() === correctLetter.toUpperCase();
        const points = isCorrect ? q.maxPoints : 0;
        return { ...q, options: [...q.originalOptions], correctAnswer: correctAnswerText, points, isCorrect };
      })
    );
  };

  const saveOverrideCorrectAnswer = async (qId: string) => {
    const q = questions.find((item) => item.id === qId);
    if (!q || !q.options) return;
    const correctOption = q.options.find((o) => o.isCorrect);
    if (!correctOption) {
      toast.error("Vui lòng chọn một đáp án đúng trước khi lưu.");
      return;
    }
    setSavingCorrectAnswerIds((prev) => ({ ...prev, [qId]: true }));
    try {
      const res: any = await api.post(`/teacher/questions/${qId}/override-correct-answer`, {
        correct_answer_id: parseInt(correctOption.id),
        submission_id: submissionId ? parseInt(submissionId) : null,
      });
      const data = res?.data?.data ?? res?.data;
      if (res?.data?.status === "success" || res?.status === "success" || data) {
        toast.success("Đã lưu đáp án đúng mới vào cơ sở dữ liệu!");
        // Exit override mode
        setOverrideKeyIds((prev) => { const s = new Set(prev); s.delete(qId); return s; });
        const subData = data?.submission;
        if (subData && typeof subData.sScore === "number") {
          setDbScore(subData.sScore);
        }
        safeSetQuestions((prev) =>
          prev.map((item) => {
            if (item.id !== qId) return item;
            return {
              ...item,
              originalOptions: item.options ? [...item.options] : item.originalOptions,
              points: subData ? subData.question_points : item.points,
              isCorrect: subData ? subData.question_is_correct : item.isCorrect,
            };
          })
        );
      } else {
        toast.error("Lỗi khi lưu đáp án đúng.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Lỗi hệ thống khi lưu đáp án.");
    } finally {
      setSavingCorrectAnswerIds((prev) => ({ ...prev, [qId]: false }));
    }
  };

  // Group by skill for VSTEP
  const vstepGroups = useMemo(() => {
    if (!isVstep) return null;
    const groups: Partial<Record<VstepSkill, Question[]>> = {};
    for (const q of questions) {
      if (q.skill) {
        if (!groups[q.skill]) groups[q.skill] = [];
        groups[q.skill]!.push(q);
      }
    }
    return groups;
  }, [questions, isVstep]);

  // Scores
  const totalScore = questions.reduce((s, q) => s + q.points, 0);
  const maxScore   = questions.reduce((s, q) => s + q.maxPoints, 0);
  const gradedCount = questions.filter((q) => q.autoGraded || q.points > 0).length;
  const manualCount = questions.filter((q) => !q.autoGraded && q.points === 0).length;
  const pct = maxScore ? Math.round((totalScore / maxScore) * 100) : 0;
  const scoreColor = pct >= 80 ? "#10B981" : pct >= 60 ? "#F59E0B" : "#EF4444";

  // VSTEP skill computed scores (override → AI → objective sum)
  const vstepSkillScores = useMemo(() => {
    if (!vstepGroups) return {} as Record<VstepSkill, number>;
    const result: Record<string, number> = {};
    for (const sk of Object.keys(VSTEP_SKILLS) as VstepSkill[]) {
      const override = parseFloat(skillScores[sk] ?? "");
      if (!isNaN(override)) { result[sk] = override; continue; }
      const qs = vstepGroups[sk] ?? [];
      if (VSTEP_SKILLS[sk].subjective) {
        // Use average teacher score (if saved) → AI score → 0
        const scores = qs.map((q) => {
          if (q.pointsAwarded !== null && q.pointsAwarded !== undefined) return q.pointsAwarded;
          if (q.aiScore !== undefined) return q.aiScore;
          return null;
        }).filter((v): v is number => v !== null);
        result[sk] = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      } else {
        // Objective: count correct answers / total * 10
        const correct = qs.filter((q) => q.isCorrect === true).length;
        result[sk] = qs.length ? Math.round((correct / qs.length) * 10 * 10) / 10 : 0;
      }
    }
    return result as Record<VstepSkill, number>;
  }, [vstepGroups, skillScores, questions]);

  const vstepTotal = (() => {
    if (!vstepGroups) return 0;
    // Only average over skills that actually have questions in this submission
    const presentSkills = (Object.keys(VSTEP_SKILLS) as VstepSkill[]).filter(
      (sk) => (vstepGroups[sk]?.length ?? 0) > 0
    );
    if (presentSkills.length === 0) return 0;
    const sum = presentSkills.reduce((a, sk) => a + (vstepSkillScores[sk] ?? 0), 0);
    return sum / presentSkills.length;
  })();

  // ── Question card ─────────────────────────────────────────────────────────
  const QuestionCard = ({ question }: { question: Question }) => {
    const qt = Q_TYPE_CONFIG[question.type];
    const QtIcon = qt.icon;
    const isOverrideKey = overrideKeyIds.has(question.id);
    return (
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black" style={{ background: qt.bg, color: qt.color }}>
              {question.number}
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold" style={{ background: qt.bg, color: qt.color }}>
              <QtIcon className="w-3 h-3" />{t(qt.labelKey)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {question.autoGraded ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[11px] font-bold">
                <Bot className="w-3 h-3" />{t("teacher.grading.detail.autoGraded")}
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 text-violet-600 text-[11px] font-bold">
                <Pencil className="w-3 h-3" />{t("teacher.grading.detail.manual")}
              </span>
            )}
            {question.autoGraded && (
              question.isCorrect
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                : <XCircle className="w-4 h-4 text-rose-500" />
            )}
            <span className="text-sm font-black text-slate-700">
              {question.points}<span className="text-slate-300 font-normal text-xs">/{question.maxPoints}</span>
            </span>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-sm font-semibold text-slate-800 leading-relaxed">{question.text}</p>

          {question.kidsTaskConfig ? (
            <KidsAnswerReview
              taskType={question.kidsTaskConfig.task_type}
              taskName={question.kidsTaskConfig.task_name}
              taskData={question.kidsTaskConfig.task_data}
              instructions={question.kidsTaskConfig.instructions}
              studentAnswerRaw={question.studentAnswer}
            />
          ) : question.options && question.options.length > 0 ? (
            <div className="space-y-2 mt-2">
              <div className="flex items-center gap-3 mb-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Các đáp án lựa chọn</p>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 font-bold">👤 HV chọn</span>
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-600 font-bold">✓ Đáp án đúng</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {question.options.map((opt) => {
                  const isSelected = question.studentAnswer === opt.letter || question.studentAnswer === opt.content;
                  const isCorrect = opt.isCorrect;
                  let bgStyle = "bg-slate-50 border-slate-200 text-slate-700";
                  if (isSelected && !isCorrect) {
                    bgStyle = "bg-rose-50 border-rose-400 text-rose-800 border-2";
                  } else if (isSelected && isCorrect) {
                    bgStyle = "bg-emerald-50 border-emerald-400 text-emerald-800 border-2";
                  } else if (isCorrect) {
                    bgStyle = "bg-emerald-50/50 border-emerald-300 text-emerald-700 border-dashed";
                  }
                  const isClickable = isOverrideKey;
                  return (
                    <div 
                      key={opt.id} 
                      onClick={() => {
                        if (isClickable) {
                          changeCorrectOption(question.id, opt.letter);
                        }
                      }}
                      className={`relative flex items-start gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${bgStyle} ${isClickable ? 'cursor-pointer hover:ring-2 hover:ring-orange-400' : ''}`}
                    >
                      <span className={`font-bold flex-shrink-0 ${isClickable ? 'bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded' : ''}`}>{opt.letter}.</span>
                      <span className="leading-snug flex-1">{opt.content}</span>
                      <div className="ml-auto flex flex-col items-end gap-1 flex-shrink-0">
                        {isSelected && (
                          <span className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            👤 HV chọn
                          </span>
                        )}
                        {isCorrect && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 whitespace-nowrap">
                            ✓ Đáp án đúng
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t("teacher.grading.detail.studentAnswer")}</p>
                <div className={`px-4 py-2.5 rounded-xl text-sm border-l-4 ${question.isCorrect === false ? "bg-rose-50 border-rose-400 text-rose-800" : "bg-slate-50 border-violet-400 text-slate-700"}`}>
                  {question.studentAnswer}
                </div>
              </div>

              {question.correctAnswer && question.isCorrect === false && (
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t("teacher.grading.detail.correctAnswer")}</p>
                  <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border-l-4 border-emerald-400 text-sm text-emerald-800">
                    {question.correctAnswer}
                  </div>
                </div>
              )}
            </>
          )}

          {question.explanation && (
            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-xs text-slate-700 font-sans mt-3">
              <span className="font-semibold block mb-1">Dàn ý / Giải thích đáp án:</span>
              <div dangerouslySetInnerHTML={{ __html: question.explanation }} />
            </div>
          )}

          {question.autoGraded ? (
            <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Điểm câu này</p>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={question.maxPoints} step={0.5} value={question.points} onChange={(e) => updateQuestionPoints(question.id, parseFloat(e.target.value) || 0)}
                      className="w-20 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-violet-400" />
                    <span className="text-sm text-slate-400">/ {question.maxPoints}</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Đánh giá kết quả</p>
                    {!isOverrideKey && (
                      <span className="text-[10px] text-slate-400 italic">
                        · Nếu đề thi bị sai đáp án, dùng <span className="text-orange-500 font-semibold">Sửa lại đáp án đúng</span> để chỉnh
                      </span>
                    )}
                  </div>
                  {/* Step guide — chỉ hiện khi chưa vào override mode */}
                  {!isOverrideKey && (
                    <div className="mb-2 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-50 border border-orange-100 text-[11px] text-orange-700">
                      <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-orange-400" />
                      <span>
                        <span className="font-bold">Muốn sửa đáp án đúng?</span>
                        {' '}Nhấn <span className="font-bold text-orange-600 bg-orange-100 px-1 rounded">Sửa lại đáp án đúng</span>
                        {' '}→ Click chọn đáp án đúng (A/B/C/D) →
                        {' '}Nhấn <span className="font-bold text-emerald-600 bg-emerald-50 px-1 rounded">Lưu lại đáp án</span>
                      </span>
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => resetToOriginalKey(question.id)}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ease-out border hover:scale-105 active:scale-[0.98] cursor-pointer ${
                        !isOverrideKey
                          ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 hover:border-indigo-700 hover:shadow-sm"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-700"
                      }`}
                      type="button"
                    >
                      Chấp nhận đáp án đề
                    </button>
                    <button
                      onClick={() => {
                        setOverrideKeyIds((prev) => { const s = new Set(prev); s.add(question.id); return s; });
                      }}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ease-out border hover:scale-105 active:scale-[0.98] cursor-pointer ${
                        isOverrideKey
                          ? "bg-orange-500 text-white border-orange-500 hover:bg-orange-600 hover:border-orange-600 hover:shadow-sm"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-700"
                      }`}
                      type="button"
                    >
                      Sửa lại đáp án đúng
                    </button>
                    {isOverrideKey && (
                      <button
                        onClick={() => saveOverrideCorrectAnswer(question.id)}
                        disabled={savingCorrectAnswerIds[question.id]}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ease-out border bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:scale-105 disabled:scale-100 disabled:opacity-50 flex items-center gap-1.5 shadow-sm active:scale-[0.98] cursor-pointer"
                        type="button"
                      >
                        {savingCorrectAnswerIds[question.id] ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        Lưu lại đáp án
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {isOverrideKey && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-700 leading-relaxed">
                    <span className="font-bold">Đang ở chế độ sửa đáp án.</span>
                    {' '}Click trực tiếp vào ô <span className="font-bold bg-orange-100 text-orange-700 px-1 rounded">A</span> / <span className="font-bold bg-orange-100 text-orange-700 px-1 rounded">B</span> / <span className="font-bold bg-orange-100 text-orange-700 px-1 rounded">C</span> / <span className="font-bold bg-orange-100 text-orange-700 px-1 rounded">D</span> bên trên để chọn đáp án đúng mới.
                    {' '}Sau đó nhấn <span className="font-bold text-emerald-700">Lưu lại đáp án</span> để xác nhận.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {question.aiScore !== undefined && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
                  <Bot className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span className="text-xs text-amber-700">{t("teacher.grading.detail.aiScore")}: <strong>{question.aiScore}/10</strong></span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t("teacher.grading.detail.manual")}</p>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={question.maxPoints} value={question.points} onChange={(e) => updateQuestionPoints(question.id, parseFloat(e.target.value) || 0)}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-violet-400" />
                    <span className="text-sm text-slate-400">/ {question.maxPoints}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t("teacher.grading.detail.quickGrade")}</p>
                  <div className="flex gap-2">
                    <button onClick={() => updateQuestionPoints(question.id, question.maxPoints)} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors">
                      <CheckCircle2 className="w-3.5 h-3.5" />{t("teacher.grading.detail.pass")}
                    </button>
                    <button onClick={() => updateQuestionPoints(question.id, 0)} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-colors">
                      <XCircle className="w-3.5 h-3.5" />{t("teacher.grading.detail.fail")}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t("teacher.grading.detail.questionFeedback")}</p>
            <textarea rows={2} value={question.feedback} onChange={(e) => updateQuestionFeedback(question.id, e.target.value)}
              placeholder={t("teacher.grading.detail.questionFeedbackPlaceholder")}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-slate-300" />
          </div>
        </div>
      </div>
    );
  };

  // ── Listening & Reading: collapsible state ────────────────────────────────
  const [expandedSkills, setExpandedSkills] = useState<Partial<Record<VstepSkill, boolean>>>({});
  const toggleSkill = (sk: VstepSkill) => setExpandedSkills((p) => ({ ...p, [sk]: !p[sk] }));

  // ── VSTEP skill section (rendered inline as JSX, NOT a component, to avoid
  // remount-on-rerender issues that lose focus inside textareas) ──────────
  const renderVstepSkillSection = (skillKey: VstepSkill): React.ReactNode => {
    const sk = VSTEP_SKILLS[skillKey];
    const SkIcon = sk.icon;
    const qs = vstepGroups?.[skillKey] ?? [];
    const computedScore = vstepSkillScores[skillKey] ?? 0;

    // ── Shared skill header ─────────────────────────────────────────────────
    const SkillHeader = ({ extra }: { extra?: React.ReactNode }) => (
      <div className="flex items-center justify-between px-5 py-3.5" style={{ background: sk.bg }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center shadow-sm">
            <SkIcon className="w-5 h-5" style={{ color: sk.color }} />
          </div>
          <div>
            <p className="text-sm font-black" style={{ color: sk.color }}>{t(sk.labelKey)}</p>
            <p className="text-[11px] text-slate-500">{qs.length} {sk.subjective ? t("teacher.grading.detail.taskLabel") : t("teacher.grading.detail.questionsLabel")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {extra}
          <div className="text-right">
            <p className="text-xs text-slate-400">{t("teacher.grading.detail.skillScore")}</p>
            <p className="text-lg font-black" style={{ color: sk.color }}>
              {computedScore.toFixed(1)}<span className="text-xs font-normal text-slate-400">/10</span>
            </p>
          </div>
        </div>
      </div>
    );

    // ══ LISTENING & READING — collapsible ══════════════════════════════════
    if (skillKey === "listening" || skillKey === "reading") {
      const isExpanded = !!expandedSkills[skillKey];
      const correctCount = qs.filter((q) => q.isCorrect).length;
      return (
        <div className="rounded-2xl overflow-hidden border" style={{ borderColor: sk.border }}>
          <SkillHeader
            extra={
              <button
                onClick={() => toggleSkill(skillKey)}
                onMouseEnter={() => setHoveredSkillButton(skillKey)}
                onMouseLeave={() => setHoveredSkillButton(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ease-out hover:scale-105 active:scale-[0.98] shadow-sm hover:shadow-md hover:shadow-black/5 cursor-pointer"
                style={{ 
                  background: hoveredSkillButton === skillKey ? "#ffffff" : "rgba(255, 255, 255, 0.75)", 
                  color: sk.color 
                }}
              >
                {isExpanded ? (
                  <><EyeOff className="w-3.5 h-3.5" />{t("teacher.grading.detail.hideQuestions")}</>
                ) : (
                  <><Eye className="w-3.5 h-3.5" />{t("teacher.grading.detail.showQuestions")}</>
                )}
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            }
          />
          {/* Collapsed summary */}
          {!isExpanded && (
            <div className="px-5 py-3 bg-white border-t border-slate-50 flex items-center gap-3">
              <span className="text-sm font-bold text-slate-700">{t("teacher.grading.detail.correctSummary", { correct: correctCount, total: qs.length })}</span>
              <span className="text-[11px] text-slate-400">{t("teacher.grading.detail.viewHint")}</span>
              <div className="ml-auto flex gap-1.5">
                {qs.map((q) => (
                  <div
                    key={q.id}
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: q.isCorrect ? "#10B981" : q.isCorrect === false ? "#EF4444" : "#E2E8F0" }}
                    title={`${t("teacher.grading.detail.question")} ${q.number}: ${q.isCorrect ? t("teacher.grading.detail.correct") : t("teacher.grading.detail.incorrect")}`}
                  />
                ))}
              </div>
            </div>
          )}
          {/* Expanded questions */}
          {isExpanded && (
            <div className="p-4 space-y-3 bg-white">
              {qs.map((q) => <QuestionCard key={q.id} question={q} />)}
            </div>
          )}
        </div>
      );
    }

    // ══ WRITING & SPEAKING — document reader ════════════════════════════════
    if (skillKey === "writing" || skillKey === "speaking") {
      // Group tasks by part, then sort
      const partGroups = new Map<number, Question[]>();
      for (const q of qs) {
        const p = q.part ?? 1;
        if (!partGroups.has(p)) partGroups.set(p, []);
        partGroups.get(p)!.push(q);
      }
      const sortedParts = Array.from(partGroups.keys()).sort((a, b) => a - b);

      // VSTEP part labels (per official format)
      const partLabels: Record<string, Record<number, string>> = {
        speaking: {
          1: "Social Interaction",
          2: "Solution Discussion",
          3: "Topic Development",
        },
        writing: {
          1: "Email / Letter",
          2: "Essay",
        },
      };

      return (
        <div className="rounded-2xl overflow-clip border" style={{ borderColor: sk.border }}>
          <SkillHeader
            extra={
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/70 text-[11px] font-bold" style={{ color: sk.color }}>
                <Bot className="w-3 h-3" />{t("teacher.grading.detail.subjectiveTag")}
              </span>
            }
          />

          <div className="bg-white">
            {sortedParts.map((partNum, partGroupIdx) => {
              const partQs = partGroups.get(partNum)!;
              const partLabel = partLabels[skillKey]?.[partNum] ?? "";

              return (
                <div key={`part-${partNum}`} className={partGroupIdx > 0 ? "border-t-4 border-slate-100" : ""}>
                  {/* ── Part header — sticky below skill tabs (~62px). Each part header pushes the previous one up as user scrolls into the next part. ── */}
                  <div className="sticky top-[62px] z-10 px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-3 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
                    <div
                      className="px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider text-white"
                      style={{ background: sk.color }}
                    >
                      Part {partNum}
                    </div>
                    {partLabel && (
                      <span className="text-[13px] font-semibold text-slate-700">{partLabel}</span>
                    )}
                    <span className="ml-auto text-[11px] font-medium text-slate-400">
                      {partQs.length} {partQs.length > 1 ? "tasks" : "task"}
                    </span>
                  </div>

                  {/* ── Tasks within this part ────────────────────── */}
                  <div className="divide-y divide-slate-50">
                    {partQs.map((q, idxInPart) => (
                      <div key={q.id} className="px-6 py-6 space-y-5">
                        {/* Task label */}
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black text-white" style={{ background: sk.color }}>
                            {idxInPart + 1}
                          </div>
                          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: sk.color }}>
                            Part {partNum} · Task {idxInPart + 1}
                          </p>
                          {/* Score badges on the right */}
                          <div className="ml-auto flex items-center gap-2">
                            {/* Teacher score badge — shown after teacher saves a grade */}
                            {Number(q.points) > 0 && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-xs font-bold text-emerald-700">GV: {Number(q.points).toFixed(1)}/{q.maxPoints}</span>
                              </div>
                            )}
                            {/* AI score badge — always shown if AI has graded */}
                            {q.aiScore !== undefined && (
                              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${Number(q.points) > 0 ? "bg-slate-50 border-slate-100" : "bg-amber-50 border-amber-100"}`}>
                                <Bot className={`w-3.5 h-3.5 ${Number(q.points) > 0 ? "text-slate-400" : "text-amber-500"}`} />
                                <span className={`text-xs font-bold ${Number(q.points) > 0 ? "text-slate-400 line-through" : "text-amber-700"}`}>AI: {q.aiScore}/{q.maxPoints}</span>
                              </div>
                            )}
                          </div>
                        </div>

                {/* Prompt — Study4-style clean task brief, parses prompt like student exam */}
                {(() => {
                  const text = q.text || "";
                  const timeMatch = text.match(/(\d+)\s*minutes?/i);
                  const wordsMatch = text.match(/(?:at\s+least\s+)?(\d+)(?:\s*[-–—]\s*(\d+))?\s*words?/i);
                  const criteriaMatch = text.match(/(?:evaluated|assessed|graded|judged)[^.]*?(?:terms?\s+of|on|by)\s+([^.]+)/i);

                  const minutes = timeMatch ? timeMatch[1] : null;
                  const wordsRange = wordsMatch ? (wordsMatch[2] ? `${wordsMatch[1]}–${wordsMatch[2]}` : `≥ ${wordsMatch[1]}`) : null;
                  const criteria = criteriaMatch
                    ? criteriaMatch[1].split(/(?:,| and )/i).map((s) => s.trim().replace(/[.\s]+$/, "")).filter(Boolean).slice(0, 5)
                    : [];

                  // ── Smart VSTEP prompt parser (mirrors student exam view) ──
                  type SegType = "time" | "intro" | "context" | "stimulus" | "task" | "requirement";
                  interface Seg { type: SegType; text: string }

                  const paras = text.split(/\n\s*\n|\n/).map((l) => l.trim()).filter(Boolean);
                  const segs: Seg[] = [];
                  let stimulusMode = false;
                  const ATTRIBUTION = /^(IELTS|Cambridge|British Council|IDP|TEST\s+\d+|Source:|Adapted from|—|–)/i;

                  for (const para of paras) {
                    if (ATTRIBUTION.test(para)) continue;
                    if (/you should spend.{0,40}minute/i.test(para)) {
                      segs.push({ type: "time", text: para });
                      stimulusMode = false;
                      continue;
                    }
                    if (/^(now )?write (an?|the|a) /i.test(para) || /^respond to /i.test(para)) {
                      stimulusMode = false;
                      segs.push({ type: "task", text: para });
                      continue;
                    }
                    if (/you should write|at least \d+|do not include your name|not allowed to use your name|evaluated in terms|your response will be|word limit|\(your response/i.test(para)) {
                      segs.push({ type: "requirement", text: para });
                      continue;
                    }
                    if (!stimulusMode && /read (part|the|an? extract|some) of|here is|below is|the following|look at the/i.test(para)) {
                      const prev = segs[segs.length - 1];
                      if (prev?.type === "context") {
                        segs[segs.length - 1] = { type: "intro", text: prev.text + " " + para };
                      } else {
                        segs.push({ type: "intro", text: para });
                      }
                      stimulusMode = true;
                      continue;
                    }
                    if (stimulusMode) {
                      segs.push({ type: "stimulus", text: para });
                      continue;
                    }
                    const prev = segs[segs.length - 1];
                    if (prev && (prev.type === "task" || prev.type === "requirement") && !/[.!?]$/.test(prev.text)) {
                      segs[segs.length - 1] = { type: prev.type, text: prev.text + " " + para };
                      continue;
                    }
                    segs.push({ type: "context", text: para });
                  }

                  // If parser yielded only one segment from a single sentence, try to split inline
                  if (segs.length === 1 && segs[0].type === "context") {
                    const single = segs[0].text;
                    // Split on sentences and re-classify each
                    const sentences = single.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()).filter(Boolean) ?? [single];
                    const newSegs: Seg[] = [];
                    let smode = false;
                    for (const sent of sentences) {
                      if (/you should spend.{0,40}minute/i.test(sent)) { newSegs.push({ type: "time", text: sent }); smode = false; continue; }
                      if (/^(now )?write (an?|the|a) /i.test(sent) || /^respond to /i.test(sent)) { newSegs.push({ type: "task", text: sent }); smode = false; continue; }
                      if (/you should write|at least \d+|do not include your name|not allowed to use your name|evaluated in terms|your response will be|word limit|\(your response/i.test(sent)) {
                        newSegs.push({ type: "requirement", text: sent }); continue;
                      }
                      if (!smode && /read (part|the|an? extract|some) of|here is|below is|the following|look at the|i['']ve just got|she said|she asked/i.test(sent)) {
                        newSegs.push({ type: "intro", text: sent });
                        smode = true; continue;
                      }
                      if (smode) {
                        // continue stimulus until directive
                        if (/^(now )?write |^respond to /i.test(sent)) { newSegs.push({ type: "task", text: sent }); smode = false; continue; }
                        newSegs.push({ type: "stimulus", text: sent });
                        continue;
                      }
                      newSegs.push({ type: "context", text: sent });
                    }
                    if (newSegs.length > 1) {
                      segs.length = 0;
                      segs.push(...newSegs);
                    }
                  }

                  const hasStimulus = segs.some((s) => s.type === "stimulus");

                  // Group consecutive same-type segments
                  type RBlock = { type: SegType; texts: string[] };
                  const renderBlocks = segs.reduce<RBlock[]>((acc, seg) => {
                    const last = acc[acc.length - 1];
                    if (last && last.type === seg.type && (seg.type === "context" || seg.type === "stimulus")) {
                      last.texts.push(seg.text);
                    } else {
                      acc.push({ type: seg.type, texts: [seg.text] });
                    }
                    return acc;
                  }, []);

                  const renderTimeLine = (s: string) => {
                    const parts = s.split(/(\d+\s*minutes?|\d+\s*phút)/i);
                    return parts.map((part, i) =>
                      /\d+\s*(minutes?|phút)/i.test(part) ? <strong key={i}>{part}</strong> : part
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
                        if (!hasStimulus) {
                          return (
                            <div key={i} className="border-l-4 border-blue-500 pl-4 space-y-1.5">
                              {block.texts.map((t, j) => (
                                <p key={j} className="text-[15px] italic text-blue-900 leading-relaxed">{t}</p>
                              ))}
                            </div>
                          );
                        }
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
                    <div className="rounded-lg border border-slate-200 bg-white">
                      {/* Header */}
                      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-500" />
                          <p className="text-[13px] font-semibold text-slate-700">{t("teacher.grading.detail.taskPrompt")}</p>
                        </div>
                        {(minutes || wordsRange) && (
                          <div className="flex items-center gap-3 text-[12px] text-slate-500">
                            {minutes && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span className="font-medium">{minutes} phút</span>
                              </span>
                            )}
                            {minutes && wordsRange && <span className="text-slate-300">·</span>}
                            {wordsRange && (
                              <span className="flex items-center gap-1">
                                <Hash className="w-3.5 h-3.5" />
                                <span className="font-medium">{wordsRange} từ</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Body — segmented like student exam view */}
                      <div className="px-5 py-4 space-y-4">
                        {renderBlocks.map((block, i) => renderBlock(block, i))}
                      </div>

                      {/* Criteria footer */}
                      {criteria.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
                          <span className="text-[12px] font-medium text-slate-500">Tiêu chí chấm:</span>
                          {criteria.map((c, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded border border-slate-200 bg-white text-[12px] font-medium text-slate-700"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Student essay / transcript — Study4-style structured viewer */}
                {(() => {
                  const raw = q.studentAnswer || "";
                  // Strip [Transcript] tag if present (speaking)
                  const cleanText = raw.replace(/^\s*\[transcript\]\s*/i, "").trim();
                  // Split by blank lines OR by single line breaks → paragraphs
                  const paragraphs = cleanText
                    .split(/\n\s*\n|\n/)
                    .map((p) => p.trim())
                    .filter(Boolean);
                  const finalParas = paragraphs.length > 0 ? paragraphs : [cleanText];

                  // Word & char counts
                  const totalWords = cleanText.split(/\s+/).filter(Boolean).length;
                  const totalChars = cleanText.length;
                  const sentenceCount = (cleanText.match(/[.!?]+(?=\s|$)/g) ?? []).length || 1;
                  // Reading time: ~250 wpm
                  const readMinutes = Math.max(1, Math.round(totalWords / 250));

                  // Target words from prompt for status
                  const promptText = q.text || "";
                  const wTarget = promptText.match(/(?:at\s+least\s+)?(\d+)(?:\s*[-–—]\s*(\d+))?\s*words?/i);
                  const minTarget = wTarget ? parseInt(wTarget[1], 10) : 0;
                  const maxTarget = wTarget?.[2] ? parseInt(wTarget[2], 10) : 0;

                  // Determine word count status
                  let wordStatus: { color: string; bg: string; label: string } | null = null;
                  if (minTarget > 0) {
                    if (totalWords < minTarget) {
                      const short = minTarget - totalWords;
                      wordStatus = { color: "#dc2626", bg: "bg-rose-50 border-rose-200", label: `Thiếu ${short} từ` };
                    } else if (maxTarget > 0 && totalWords > maxTarget) {
                      const over = totalWords - maxTarget;
                      wordStatus = { color: "#d97706", bg: "bg-amber-50 border-amber-200", label: `Vượt ${over} từ` };
                    } else {
                      wordStatus = { color: "#059669", bg: "bg-emerald-50 border-emerald-200", label: "Đạt yêu cầu" };
                    }
                  }

                  const isSpeaking = skillKey === "speaking";
                  const isEmpty = !cleanText;

                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          {isSpeaking ? t("teacher.grading.detail.transcript") : t("teacher.grading.detail.studentEssay")}
                        </p>
                        {isSpeaking && (
                          <button
                            onClick={() => setShowTranscripts(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors"
                            style={showTranscripts[q.id]
                              ? { background: '#FCE7F3', borderColor: '#FBCFE8', color: '#EC4899' }
                              : { background: '#F8FAFC', borderColor: '#E2E8F0', color: '#64748B' }
                            }
                          >
                            {showTranscripts[q.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            {showTranscripts[q.id] ? 'Ẩn transcript' : 'Xem transcript AI'}
                          </button>
                        )}
                      </div>

                      {/* Card — for speaking only show when transcript is toggled on */}
                      {isSpeaking && !showTranscripts[q.id] ? (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-5 py-4 flex items-center gap-3">
                          <Eye className="w-4 h-4 text-slate-300 flex-shrink-0" />
                          <p className="text-[13px] text-slate-400 italic">
                            Transcript ẩn. Bấm <span className="font-semibold text-slate-500">"Xem transcript AI"</span> để hiện nội dung được nhận diện từ ghi âm.
                          </p>
                        </div>
                      ) : (
                      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                        {/* Header — stats bar */}
                        <div className="flex items-center justify-between gap-2 flex-wrap px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
                          <div className="flex items-center gap-3 text-[12px] text-slate-600">
                            <span className="flex items-center gap-1">
                              {isSpeaking ? <Mic className="w-3.5 h-3.5" /> : <PenTool className="w-3.5 h-3.5" />}
                              <span className="font-semibold">{isSpeaking ? "Bản ghi" : "Bài viết"}</span>
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="flex items-center gap-1">
                              <Hash className="w-3.5 h-3.5" />
                              <span className="font-medium tabular-nums">{totalWords} từ</span>
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="tabular-nums">{finalParas.length} đoạn</span>
                            <span className="text-slate-300">·</span>
                            <span className="tabular-nums">{sentenceCount} câu</span>
                            <span className="text-slate-300 hidden md:inline">·</span>
                            <span className="hidden md:flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span className="tabular-nums">~{readMinutes} phút đọc</span>
                            </span>
                          </div>
                          {wordStatus && (
                            <span
                              className={`px-2 py-0.5 rounded border text-[12px] font-semibold ${wordStatus.bg}`}
                              style={{ color: wordStatus.color }}
                            >
                              {wordStatus.label}
                            </span>
                          )}
                        </div>

                        {/* Audio Player for Speaking */}
                        {isSpeaking && (
                          <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100">
                            {q.audioUrl ? (
                              <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-semibold text-pink-600 uppercase tracking-wider mb-2">
                                    Bản ghi âm của học viên
                                  </p>
                                  <audio
                                    controls
                                    preload="metadata"
                                    src={q.audioUrl}
                                    className="w-full rounded-lg min-w-0"
                                    style={{ accentColor: "#EC4899" }}
                                  >
                                    Trình duyệt không hỗ trợ phát audio.
                                  </audio>
                                </div>
                                <a
                                  href={q.audioUrl}
                                  download={`speaking-task-${q.number}-${student.name.replace(/\s+/g, "_")}.webm`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-[12px] font-semibold hover:bg-slate-50 hover:border-slate-300 transition-colors self-end"
                                  title="Tải file ghi âm về máy"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Tải về
                                </a>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-slate-400">
                                <Mic className="w-4 h-4" />
                                <p className="text-[13px] italic">Chưa có file ghi âm speaking cho phần này.</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Body */}
                        {isEmpty ? (
                          <div className="px-5 py-8 text-center">
                            <AlertCircle className="w-5 h-5 text-slate-300 mx-auto mb-2" />
                            <p className="text-[13px] text-slate-400 italic">
                              {q.audioUrl
                                ? "Chưa có bản ghi văn bản (Transcript) từ AI."
                                : "Học viên không nộp bài."}
                            </p>
                          </div>
                        ) : (
                          <div className="px-5 py-5 max-h-[600px] overflow-y-auto">
                            <div className="space-y-4">
                              {finalParas.map((para, idx) => {
                                const wordCount = para.split(/\s+/).filter(Boolean).length;
                                return (
                                  <div key={idx} className="group flex gap-3">
                                    {/* Paragraph number gutter */}
                                    <div className="flex-shrink-0 select-none pt-0.5">
                                      <span className="block w-6 h-6 rounded-md bg-slate-100 text-slate-400 text-[11px] font-bold text-center leading-6 group-hover:bg-slate-200 group-hover:text-slate-600 transition-colors">
                                        {idx + 1}
                                      </span>
                                    </div>
                                    {/* Paragraph body */}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[15px] text-slate-800 leading-[1.85] whitespace-pre-wrap">
                                        {para}
                                      </p>
                                      <p className="mt-1 text-[10px] text-slate-300 font-medium tabular-nums">
                                        {wordCount} từ
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Footer — meta */}
                        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between text-[11px] text-slate-400">
                          <span>{totalChars.toLocaleString()} ký tự</span>
                          {minTarget > 0 && (
                            <span>
                              Mục tiêu: <span className="font-semibold text-slate-500">{maxTarget ? `${minTarget}–${maxTarget}` : `≥ ${minTarget}`}</span> từ
                            </span>
                          )}
                        </div>
                      </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── AI Score Badge — kết quả AI chấm ── */}
                {q.aiScore !== undefined && (
                  <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-slate-200 bg-slate-50/60">
                    <div className="flex items-center gap-2.5">
                      <Bot className="w-4 h-4 text-slate-500" />
                      <span className="text-[13px] font-medium text-slate-700">AI đã chấm</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[22px] font-bold text-slate-800 tabular-nums">{q.aiScore.toFixed(1)}</span>
                      <span className="text-[13px] text-slate-400">/ {q.maxPoints}</span>
                    </div>
                  </div>
                )}

                {/* ── Teacher grading panel — option-based ── */}
                {(() => {
                  const isEditing = editingAnswerIds[q.id] === true;
                  const hasAi = q.aiScore !== undefined && q.aiScore !== null;
                  const aiScoreNum = hasAi ? Number(q.aiScore) : 0;
                  const pointsNum = Number(q.points || 0);
                  // Show form when: no AI yet, OR teacher is in editing mode
                  const showForm = !hasAi || isEditing;

                  return (
                <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                  {/* Header with toggle options */}
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="w-4 h-4 text-slate-500" />
                      <p className="text-[13px] font-semibold text-slate-700">Chấm điểm giáo viên</p>
                      {pointsNum > 0 && (
                        <span className="ml-auto flex items-center gap-1 text-[12px] font-medium text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          Đã chấm
                        </span>
                      )}
                    </div>

                    {/* Option buttons */}
                    {hasAi && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            updateQuestionPoints(q.id, aiScoreNum);
                            setEditingAnswerIds((p) => ({ ...p, [q.id]: false }));
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[12px] font-semibold transition-colors ${
                            !isEditing
                              ? "bg-slate-700 border-slate-700 text-white hover:bg-slate-800 hover:border-slate-800"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900"
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Đồng ý với AI ({aiScoreNum.toFixed(1)})
                        </button>
                        <button
                          onClick={() => {
                            setEditingAnswerIds((p) => ({ ...p, [q.id]: true }));
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[12px] font-semibold transition-colors ${
                            isEditing
                              ? "bg-slate-700 border-slate-700 text-white hover:bg-slate-800 hover:border-slate-800"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900"
                          }`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Chấm lại
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Body — chỉ show khi GV chọn "Chấm lại" hoặc chưa có AI score */}
                  {showForm && (
                    <div className="p-4 space-y-4">

                      {/* Score input row */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[12px] font-semibold text-slate-700">
                            Điểm câu này <span className="text-slate-400 font-normal">/ {q.maxPoints}</span>
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number" min={0} max={q.maxPoints} step={0.5}
                              value={q.points || ""}
                              onChange={(e) => updateQuestionPoints(q.id, parseFloat(e.target.value) || 0)}
                              placeholder="0.0"
                              className="w-20 px-2.5 py-1.5 rounded-md border border-slate-300 text-sm font-bold text-slate-800 text-center focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-300 placeholder:text-slate-300 placeholder:font-normal tabular-nums"
                            />
                            <span className="text-sm text-slate-400">/ {q.maxPoints}</span>
                          </div>
                        </div>

                        {/* Slider */}
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={0} max={q.maxPoints} step={0.5}
                            value={pointsNum}
                            onChange={(e) => updateQuestionPoints(q.id, parseFloat(e.target.value) || 0)}
                            className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-slate-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-700 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow"
                          />
                          <span className="text-[13px] font-bold text-slate-700 tabular-nums w-12 text-right">
                            {pointsNum.toFixed(1)}
                          </span>
                        </div>

                        {/* Diff indicator vs AI */}
                        {hasAi && pointsNum > 0 && Math.abs(pointsNum - aiScoreNum) > 0.001 && (
                          <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                            <span className="text-slate-400">So với AI:</span>
                            <span className={`font-bold tabular-nums ${pointsNum > aiScoreNum ? "text-emerald-600" : "text-rose-600"}`}>
                              {pointsNum > aiScoreNum ? "+" : ""}{(pointsNum - aiScoreNum).toFixed(1)}
                            </span>
                          </div>
                        )}

                        {/* Quick presets */}
                        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                          {[0, q.maxPoints * 0.25, q.maxPoints * 0.5, q.maxPoints * 0.75, q.maxPoints].map((preset, i) => (
                            <button
                              key={i}
                              onClick={() => updateQuestionPoints(q.id, preset)}
                              className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold transition-colors tabular-nums ${
                                Math.abs(pointsNum - preset) < 0.001
                                  ? "bg-slate-700 border-slate-700 text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              {preset === 0 ? "0" : preset === q.maxPoints ? `${q.maxPoints}` : preset.toFixed(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="h-px bg-slate-100" />

                      {/* Feedback */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                            Nhận xét
                          </label>
                          <span className="text-[11px] text-slate-400 tabular-nums">{(q.feedback || "").length}/500</span>
                        </div>
                        <textarea
                          rows={3}
                          maxLength={500}
                          value={q.feedback}
                          onChange={(e) => updateQuestionFeedback(q.id, e.target.value)}
                          placeholder="Ghi nhận xét: điểm mạnh, điểm yếu, gợi ý cải thiện..."
                          className="w-full px-3 py-2.5 rounded-md border border-slate-300 text-[14px] text-slate-800 leading-relaxed resize-y focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-300 placeholder:text-slate-400"
                        />

                        {/* Quick templates */}
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Mẫu:</span>
                          {[
                            { label: "👍 Tốt", text: "Bài viết có cấu trúc tốt, ý tưởng rõ ràng." },
                            { label: "✏️ Ngữ pháp", text: "Cần cải thiện ngữ pháp: thì, chủ ngữ-vị ngữ, cấu trúc câu phức." },
                            { label: "📝 Thiếu ý", text: "Thiếu một số ý chính theo yêu cầu đề." },
                            { label: "🎯 Đạt", text: "Đáp ứng đầy đủ yêu cầu, lập luận mạch lạc." },
                          ].map((tpl) => (
                            <button
                              key={tpl.label}
                              onClick={() => {
                                const current = q.feedback || "";
                                const newText = current ? `${current} ${tpl.text}` : tpl.text;
                                updateQuestionFeedback(q.id, newText.slice(0, 500));
                              }}
                              className="px-2 py-0.5 rounded-md border border-slate-200 bg-white text-[11px] font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                            >
                              {tpl.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ── Save button ───────────────────────────────── */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <span className="text-[11px] text-slate-400 mr-auto">
                          Lưu điểm và nhận xét cho câu này vào hệ thống
                        </span>
                        <button
                          onClick={() => saveAnswer(q)}
                          disabled={savingAnswerIds[q.id]}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-slate-700 border border-slate-700 text-white text-[12px] font-semibold hover:bg-slate-800 hover:border-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        >
                          {savingAnswerIds[q.id] ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Đang lưu...</span>
                            </>
                          ) : (
                            <>
                              <Save className="w-3.5 h-3.5" />
                              <span>Lưu điểm câu này</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                        {/* When accepted — show confirmation only (AI already graded, no save needed) */}
                        {hasAi && !isEditing && (
                          <div className="px-4 py-3 flex items-center gap-2 text-[12px] text-slate-500">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            <span>Đã đồng ý với điểm AI. Click "Chấm lại" nếu muốn thay đổi.</span>
                          </div>
                        )}
                      </div>
                        );
                      })()}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // ══ Fallback — flat question list ═══════════════════════════════════════
    return (
      <div className="rounded-2xl overflow-hidden border" style={{ borderColor: sk.border }}>
        <SkillHeader />
        <div className="p-4 space-y-3 bg-white">
          {qs.map((q) => <QuestionCard key={q.id} question={q} />)}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ── Top bar ── */}
      <div className="bg-white border-b border-slate-100 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1.5 text-sm">
          <Link to="/giao-vien/cham-diem" className="text-violet-600 hover:text-violet-700 font-semibold">{t("teacher.grading.detail.breadcrumb")}</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className="text-slate-700 font-semibold">{student.name}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className="text-slate-400 truncate max-w-[240px]">{exam.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (window.history.state && window.history.state.idx > 0) {
                navigate(-1);
              } else {
                navigate('/giao-vien/cham-diem');
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />{t("teacher.grading.detail.back")}
          </button>
          <button
            onClick={handleSave}
            disabled={saveLoading || pageLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-bold hover:from-violet-700 hover:to-purple-700 transition-all shadow-sm shadow-violet-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />{saveLoading ? "Đang lưu..." : t("teacher.grading.detail.saveGrades")}
          </button>
        </div>
      </div>

      {pageLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Đang tải...</span>
          </div>
        </div>
      ) : (
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto" style={{ background: "#EEEEF3" }}>
        <div className="px-6 py-5 space-y-5">

          {/* ── Teacher guide banner ── */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
            <button
              onClick={() => setShowGuide(g => !g)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-100/60 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-blue-800">Hướng dẫn sử dụng trang chấm điểm</p>
                <p className="text-[11px] text-blue-500">{showGuide ? 'Nhấn để thu gọn' : 'Nhấn để xem hướng dẫn chi tiết cho giáo viên'}</p>
              </div>
              {showGuide ? <ChevronUp className="w-4 h-4 text-blue-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-blue-500 flex-shrink-0" />}
            </button>
            {showGuide && (
              <div className="px-4 pb-4 pt-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  {
                    icon: Eye,
                    color: 'text-sky-600', bg: 'bg-sky-50',
                    title: 'Xem bài làm học viên',
                    desc: 'Cuộn xuống để xem từng câu hỏi. Tabs kỹ năng (Ngữ âm, Trắc nghiệm…) giúp điều hướng nhanh.',
                  },
                  {
                    icon: Bot,
                    color: 'text-violet-600', bg: 'bg-violet-50',
                    title: 'Điểm AI tự chấm',
                    desc: 'Các câu trắc nghiệm và writing/speaking đã được AI chấm. Biểu tượng 🤖 = điểm AI. Hãy kiểm tra lại trước khi xác nhận.',
                  },
                  {
                    icon: Pencil,
                    color: 'text-amber-600', bg: 'bg-amber-50',
                    title: 'Chỉnh điểm thủ công',
                    desc: 'Nhấn vào ô điểm cạnh mỗi câu → nhập điểm mới → nhấn "Lưu" để ghi đè điểm AI. Điểm override hiển thị màu cam.',
                  },
                  {
                    icon: Save,
                    color: 'text-emerald-600', bg: 'bg-emerald-50',
                    title: 'Lưu & Phát hành',
                    desc: 'Nhấn nút xanh "Lưu & phát hành" ở góc trên cùng bên phải để lưu toàn bộ thay đổi và thông báo kết quả cho học viên.',
                  },
                  {
                    icon: MessageSquare,
                    color: 'text-rose-600', bg: 'bg-rose-50',
                    title: 'Thêm nhận xét',
                    desc: 'Mỗi câu hỏi writing/speaking có ô nhận xét riêng. Nhận xét sẽ được gửi đến học viên cùng kết quả.',
                  },
                  {
                    icon: ArrowLeft,
                    color: 'text-slate-600', bg: 'bg-slate-100',
                    title: 'Quay lại & Xét duyệt',
                    desc: 'Sau khi xem xong, nhấn "←" để trở về danh sách. Dùng nút "Xét duyệt" ở danh sách để đánh dấu đã hoàn tất.',
                  },
                ].map(({ icon: Icon, color, bg, title, desc }) => (
                  <div key={title} className="flex gap-3 bg-white rounded-xl p-3 border border-blue-100">
                    <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700 mb-0.5">{title}</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Hero card ── */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />
            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white text-xl font-black flex-shrink-0">{student.avatar}</div>
                <div>
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-0.5">{t("teacher.grading.detail.student")}</p>
                  <p className="text-base font-black text-slate-800">{student.name}</p>
                  <p className="text-xs text-slate-400">ID: {student.id}</p>
                </div>
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">{t("teacher.grading.detail.exam")}</p>
                <p className="text-sm font-bold text-slate-800 leading-snug mb-1.5">{exam.title}</p>
                <span className="inline-flex w-fit items-center px-2.5 py-1 rounded-lg bg-violet-100 text-violet-700 text-[11px] font-bold">{exam.type}</span>
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">{t("teacher.grading.detail.submittedAt")}</p>
                <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {submission.time.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
                <span className="inline-flex w-fit items-center px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 text-[11px] font-bold">{t("teacher.grading.detail.attemptLabel")} {submission.attemptNumber}</span>
              </div>
            </div>
          </div>

          {/* ── Main 2-col ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* ── Content (left) ── */}
            <div className="lg:col-span-2 space-y-4">
              {isVstep && vstepGroups ? (
                <>
                  {/* VSTEP Skill Tabs — sticky to top, professional underline style */}
                  <div id="vstep-skill-tabs" className="bg-white rounded-xl border border-slate-200 overflow-hidden sticky top-0 z-20 shadow-sm">
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100">
                      {(Object.keys(VSTEP_SKILLS) as VstepSkill[])
                        .filter((sk) => (vstepGroups[sk]?.length ?? 0) > 0)
                        .map((sk) => {
                          const s = VSTEP_SKILLS[sk];
                          const SIcon = s.icon;
                          const isActive = activeSkillTab === sk;
                          const score = vstepSkillScores[sk] ?? 0;
                          const count = vstepGroups[sk]?.length ?? 0;
                          const hasScore = score > 0;

                          return (
                            <button
                              key={sk}
                              onClick={() => setActiveSkillTab(sk)}
                              type="button"
                              className={`relative group flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                                isActive
                                  ? "bg-slate-50/60"
                                  : "bg-white hover:bg-slate-50/40"
                              }`}
                            >
                              {/* Active indicator — bottom border */}
                              <span
                                className={`absolute left-0 right-0 bottom-0 h-[2px] transition-colors ${
                                  isActive ? "bg-slate-800" : "bg-transparent group-hover:bg-slate-200"
                                }`}
                              />

                              {/* Icon */}
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                                  isActive ? "bg-white border border-slate-200" : "bg-slate-50"
                                }`}
                              >
                                <SIcon className={`w-4 h-4 ${isActive ? "" : "opacity-60"}`} style={{ color: s.color }} />
                              </div>

                              {/* Label + meta */}
                              <div className="flex-1 min-w-0">
                                <p className={`text-[13px] leading-tight ${isActive ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>
                                  {t(s.labelKey)}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[11px] text-slate-400 tabular-nums">
                                    {count} {s.subjective ? "bài" : "câu"}
                                  </span>
                                  {hasScore && (
                                    <>
                                      <span className="text-slate-300">·</span>
                                      <span className={`text-[11px] font-bold tabular-nums ${isActive ? "text-slate-800" : "text-slate-500"}`}>
                                        {score.toFixed(1)}/10
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  {/* Render only active VSTEP skill section */}
                  {activeSkillTab && vstepGroups[activeSkillTab] && (
                    <Fragment key={activeSkillTab}>
                      {renderVstepSkillSection(activeSkillTab)}
                    </Fragment>
                  )}
                </>
              ) : (
                /* Non-VSTEP: flat question list */
                questions.map((q) => <QuestionCard key={q.id} question={q} />)
              )}

              {/* Overall feedback */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-violet-600" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{t("teacher.grading.detail.overallFeedbackTitle")}</h3>
                </div>
                <textarea rows={4} value={overallFeedback} onChange={(e) => setOverallFeedback(e.target.value)}
                  placeholder={t("teacher.grading.detail.overallFeedbackPlaceholder")}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-slate-300 mb-4" />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />{t("teacher.grading.detail.strengths")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {strengths.map((s, i) => <span key={i} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold">{s}</span>)}
                    </div>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />{t("teacher.grading.detail.improvements")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {improvements.map((s, i) => <span key={i} className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold">{s}</span>)}
                    </div>
                  </div>
                </div>
                {/* Save overall feedback button */}
                <div className="flex justify-end mt-4 pt-3 border-t border-slate-100">
                  <button
                    onClick={async () => {
                      if (!submissionId) return;
                      setSaveLoading(true);
                      try {
                        await api.post(`/teacher/submissions/${submissionId}/grade`, {
                          questionScores: [],
                          sTeacher_feedback: overallFeedback,
                        });
                        toast.success("Đã lưu nhận xét chung.");
                      } catch {
                        toast.error("Lỗi khi lưu nhận xét chung.");
                      } finally {
                        setSaveLoading(false);
                      }
                    }}
                    disabled={saveLoading || !overallFeedback.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white text-[13px] font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saveLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Lưu nhận xét chung
                  </button>
                </div>
              </div>
            </div>

            {/* ── Sidebar (right) — Redesigned for English-learning context ── */}
            <div className="lg:col-span-1">
              <div className="sticky top-4 space-y-4">

                {isVstep ? (
                  <>
                    {/* ─── 1. Hero Score Card with CEFR gauge ─── */}
                    {(() => {
                      // Use DB score as authoritative (avoids drift from frontend recomputation)
                      const total = isVstep && dbScore !== null ? dbScore / 10 : vstepTotal;
                      const pctVstep = Math.min((total / 10) * 100, 100);
                      // CEFR mapping (VSTEP scale)
                      const cefr =
                        total >= 8.5 ? { level: "C1", label: "Thành thạo", color: "#7C3AED", bg: "from-violet-50 to-purple-50", ring: "#A78BFA" } :
                        total >= 6.0 ? { level: "B2", label: "Trung cao",  color: "#0EA5E9", bg: "from-sky-50 to-cyan-50",      ring: "#7DD3FC" } :
                        total >= 4.0 ? { level: "B1", label: "Trung bình", color: "#10B981", bg: "from-emerald-50 to-teal-50",  ring: "#6EE7B7" } :
                        total >= 2.0 ? { level: "A2", label: "Sơ cấp",     color: "#F59E0B", bg: "from-amber-50 to-orange-50",  ring: "#FCD34D" } :
                                       { level: "A1", label: "Khởi đầu",   color: "#EF4444", bg: "from-rose-50 to-red-50",      ring: "#FCA5A5" };

                      // SVG circular gauge (radius 56, stroke 10)
                      const R = 56, C_LEN = 2 * Math.PI * R;
                      const dash = (pctVstep / 100) * C_LEN;

                      return (
                        <div className={`relative overflow-hidden bg-gradient-to-br ${cefr.bg} rounded-3xl border border-white/60 p-5 shadow-sm`}>
                          {/* Decorative blob */}
                          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20" style={{ background: cefr.color }} />
                          <div className="relative">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/70 backdrop-blur rounded-full">
                                <Trophy className="w-3.5 h-3.5" style={{ color: cefr.color }} />
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Tổng kết bài thi</span>
                              </div>
                              <div className="px-2 py-0.5 rounded-md text-[10px] font-black text-white shadow-sm" style={{ background: cefr.color }}>
                                VSTEP
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              {/* Circular gauge */}
                              <div className="relative flex-shrink-0">
                                <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
                                  <circle cx="70" cy="70" r={R} stroke="white" strokeWidth="10" fill="none" opacity="0.6" />
                                  <circle
                                    cx="70" cy="70" r={R}
                                    stroke={cefr.color} strokeWidth="10" fill="none"
                                    strokeLinecap="round"
                                    strokeDasharray={`${dash} ${C_LEN}`}
                                    style={{ transition: "stroke-dasharray 1s ease-out" }}
                                  />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <span className="text-3xl font-black leading-none" style={{ color: cefr.color }}>
                                    {total.toFixed(2)}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400 mt-0.5">/ 10.0</span>
                                </div>
                              </div>

                              {/* CEFR badge + meta */}
                              <div className="flex-1 space-y-2">
                                <div>
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Trình độ CEFR</p>
                                  <div className="flex items-baseline gap-1.5 mt-0.5">
                                    <span className="text-3xl font-black" style={{ color: cefr.color }}>{cefr.level}</span>
                                    <span className="text-xs font-semibold text-slate-600">{cefr.label}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-white/60 rounded-lg">
                                  <Sparkles className="w-3 h-3" style={{ color: cefr.color }} />
                                  <span className="text-[10px] font-semibold text-slate-600">
                                    {Math.round(pctVstep)}% mục tiêu C1
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ─── 2. Skill breakdown — 4 kỹ năng ─── */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">4 kỹ năng</p>
                        <span className="text-[10px] text-slate-400 font-medium">Thang điểm 10</span>
                      </div>

                      <div className="space-y-2.5">
                        {(Object.keys(VSTEP_SKILLS) as VstepSkill[]).map((sk) => {
                          const s = VSTEP_SKILLS[sk];
                          const SIcon = s.icon;
                          const score = vstepSkillScores[sk] ?? 0;
                          const pctSk = Math.min((score / 10) * 100, 100);
                          const isOverridden = !!skillScores[sk];
                          const hasQuestions = (vstepGroups?.[sk]?.length ?? 0) > 0;
                          const isActive = activeSkillTab === sk;

                          return (
                            <button
                              key={sk}
                              type="button"
                              disabled={!hasQuestions}
                              onClick={() => {
                                setActiveSkillTab(sk);
                                // Smooth-scroll the skill tabs into view so user lands at the section top
                                setTimeout(() => {
                                  const el = document.getElementById("vstep-skill-tabs");
                                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                                }, 50);
                              }}
                              className={`w-full text-left rounded-lg px-2 py-1.5 -mx-2 transition-colors group ${
                                isActive ? "bg-slate-50" : "hover:bg-slate-50"
                              } ${!hasQuestions ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                              <div className="flex items-center gap-2.5 mb-1.5">
                                <div
                                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ background: s.bg }}
                                >
                                  <SIcon className="w-3.5 h-3.5" style={{ color: s.color }} />
                                </div>
                                <span className={`text-xs font-bold flex-1 ${isActive ? "text-slate-900" : "text-slate-700"}`}>{t(s.labelKey)}</span>
                                {isOverridden && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-600 text-[9px] font-black uppercase tracking-wider">
                                    Đã chỉnh
                                  </span>
                                )}
                                <span className="text-sm font-black tabular-nums" style={{ color: s.color }}>
                                  {score.toFixed(1)}
                                  <span className="text-[10px] font-bold text-slate-300 ml-0.5">/10</span>
                                </span>
                              </div>
                              <div className="h-2 rounded-full overflow-hidden ml-9.5" style={{ background: s.bg, marginLeft: 38 }}>
                                <div
                                  className="h-full rounded-full transition-all duration-700 ease-out"
                                  style={{
                                    width: `${pctSk}%`,
                                    background: `linear-gradient(90deg, ${s.color}, ${s.color}dd)`,
                                  }}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* ─── Strongest / Weakest insight ─── */}
                      {(() => {
                        const skills = (Object.keys(VSTEP_SKILLS) as VstepSkill[]).map((k) => ({
                          key: k,
                          score: vstepSkillScores[k] ?? 0,
                          conf: VSTEP_SKILLS[k],
                        }));
                        const sorted = [...skills].sort((a, b) => b.score - a.score);
                        const best = sorted[0];
                        const worst = sorted[sorted.length - 1];
                        if (!best || !worst || best.score === worst.score) return null;

                        return (
                          <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
                            <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Mạnh nhất</p>
                                <p className="text-[11px] font-bold text-emerald-800 truncate">{t(best.conf.labelKey)}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-xl bg-rose-50 border border-rose-100">
                              <TrendingDown className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <p className="text-[9px] font-black text-rose-600 uppercase tracking-wider">Cần cải thiện</p>
                                <p className="text-[11px] font-bold text-rose-800 truncate">{t(worst.conf.labelKey)}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                ) : (
                  /* ─── Non-VSTEP: classic score display ─── */
                  <div className="bg-white rounded-2xl border border-slate-100 p-5">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4">{t("teacher.grading.detail.scoreSummary")}</p>
                    <div className="text-center mb-5">
                      <div className="text-6xl font-black mb-0.5" style={{ color: scoreColor }}>{(pct / 10).toFixed(1)}</div>
                      <div className="text-sm text-slate-400 mb-3">/ 10 điểm</div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: scoreColor }} />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{pct}% · {totalScore}/{maxScore} điểm thô</p>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: t("teacher.grading.detail.gradedCount"),   value: gradedCount,      color: "#10B981", bg: "#D1FAE5", icon: CheckCircle2 },
                        { label: t("teacher.grading.detail.manualNeeded"),  value: manualCount,      color: "#F59E0B", bg: "#FEF3C7", icon: Clock },
                        { label: t("teacher.grading.detail.totalQuestions"),value: questions.length, color: "#6366F1", bg: "#EEF2FF", icon: Hash },
                        { label: t("teacher.grading.detail.maxScore"),      value: maxScore,         color: "#8B5CF6", bg: "#EDE9FE", icon: FileText },
                      ].map(({ label, value, color, bg, icon: Icon }) => (
                        <div key={label} className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: bg }}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                            <span className="text-xs font-semibold text-slate-700">{label}</span>
                          </div>
                          <span className="text-sm font-black" style={{ color }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ─── 3. Save panel — separate card with status badges ─── */}
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  {/* Mini stats row */}
                  <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50/50">
                    <div className="px-3 py-3 text-center">
                      <p className="text-base font-black text-emerald-600 tabular-nums">{gradedCount}</p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Đã chấm</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-base font-black text-amber-600 tabular-nums">{manualCount}</p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Cần tay</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-base font-black text-slate-700 tabular-nums">{questions.length}</p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Tổng câu</p>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="p-3 space-y-2">
                    {manualCount > 0 ? (
                      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-100">
                        <AlertCircle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                        <p className="text-[10px] font-semibold text-amber-700">
                          Còn <span className="font-black">{manualCount}</span> câu chưa chấm tay
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
                        <Award className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                        <p className="text-[10px] font-semibold text-emerald-700">Sẵn sàng lưu kết quả cuối cùng</p>
                      </div>
                    )}
                    <p className="text-center text-[10px] text-slate-400">{t("teacher.grading.detail.saveReminder")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}


// ─── Smart Router ────────────────────────────────────────────────────────────
// Detects the exam type and renders the appropriate grading detail component.
// Today: VSTEP → VstepGradingDetailInternal (this file), IELTS → IeltsGradingDetail.
// Falls back to VSTEP layout for any other type (Cambridge / Kids / General) since
// it handles generic objective grading reasonably.
export function GradingDetail() {
  const { submissionId } = useParams();
  const [examType, setExamType] = useState<string | null>(null);
  // Đề Kids có thể được tạo dưới eType=GENERAL nhưng câu hỏi mang kids_task_config.
  // Phát hiện theo dữ liệu thật thay vì chỉ dựa eType.
  const [isKids, setIsKids] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!submissionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/teacher/submissions/${submissionId}`);
        const d = res.data?.data ?? res.data ?? {};
        const t = (d.exam?.eType ?? "").toString().toUpperCase();
        // Kids khi: eType là cấp độ Cambridge YL, HOẶC có câu mang kids_task_config.
        const examQuestions = d.exam?.questions ?? [];
        const answers = d.answers ?? [];
        const hasKidsConfig =
          examQuestions.some((q: any) => q?.kids_task_config) ||
          answers.some((sa: any) => sa?.question?.kids_task_config);
        const kidsByType = t === "STARTERS" || t === "MOVERS" || t === "FLYERS";
        if (!cancelled) {
          setExamType(t);
          setIsKids(kidsByType || hasKidsConfig);
        }
      } catch {
        if (!cancelled) setExamType("");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [submissionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (examType === "IELTS") {
    // Lazy-load to avoid pulling IELTS bundle for VSTEP users
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Loading IELTS grading…</div>}>
        <LazyIeltsGrading />
      </Suspense>
    );
  }

  if (examType === "THPT") {
    // Teens THPT grading is payload-based — fully separate from VSTEP/IELTS.
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Đang tải trang chấm điểm…</div>}>
        <LazyThptGrading submissionId={Number(submissionId)} />
      </Suspense>
    );
  }

  if (isKids) {
    // Kids grading: phân loại theo task type, toggle Đúng/Sai từng ô — tách hẳn khung VSTEP.
    // Nhận diện qua kids_task_config nên đề GENERAL chứa câu Kids vẫn vào đúng khung này.
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Đang tải trang chấm điểm…</div>}>
        <LazyKidsGrading />
      </Suspense>
    );
  }

  return <VstepGradingDetailInternal />;
}

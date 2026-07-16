import { useEffect, useState } from "react";
import { getAuthToken } from '../../../../utils/authStorage';
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { TemplateGuide } from "./TemplateGuide";
import { useSidebar } from "../../../../contexts/SidebarContext";
import { useToastContext } from "../../../../contexts/ToastContext";
import { api } from "../../../../services/api";
import {
  ArrowLeft,
  Save,
  Eye,
  Plus,
  Trash2,
  GripVertical,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Check,
  Upload,
  Image as ImageIcon,
  Volume2,
  FileText,
  Info,
  Clock,
  Target,
  HelpCircle,
  Sparkles,
  Globe,
  Lock,
  Settings,
  Calendar,
  Bell,
  X,
  ChevronDown,
  Menu,
  Mic,
  BookOpen,
} from "lucide-react";
import { teacherApi } from "../../../../services/teacherApi";

// VSTEP Structure - 4 Skills, 7 Main Parts
const VSTEP_STRUCTURE = {
  listening: {
    name: "Listening",
    icon: "🎧",
    duration: 40,
    totalQuestions: 35,
    parts: [
      { part: 1, name: "Announcements", questions: 8, description: "Thông báo ngắn" },
      { part: 2, name: "Dialogues", questions: 12, description: "Hội thoại 2-3 người" },
      { part: 3, name: "Lectures", questions: 15, description: "Bài giảng học thuật" },
    ],
  },
  reading: {
    name: "Reading",
    icon: "📖",
    duration: 60,
    totalQuestions: 40,
    parts: [
      { part: 1, name: "Passage 1", questions: 10, description: "Văn bản ngắn (400-500 từ)", wordCount: [400, 500] },
      { part: 2, name: "Passage 2", questions: 10, description: "Văn bản mô tả (400-500 từ)", wordCount: [400, 500] },
      { part: 3, name: "Passage 3", questions: 10, description: "Văn bản lập luận (500-600 từ)", wordCount: [500, 600] },
      { part: 4, name: "Passage 4", questions: 10, description: "Văn bản học thuật (600-700 từ)", wordCount: [600, 700] },
    ],
  },
  writing: {
    name: "Writing",
    icon: "✍️",
    duration: 60,
    totalQuestions: 2,
    parts: [
      { part: 1, name: "Task 1", questions: 1, description: "Letter/Email (120 từ)", minWords: 120 },
      { part: 2, name: "Task 2", questions: 1, description: "Essay (250 từ)", minWords: 250 },
    ],
  },
  speaking: {
    name: "Speaking",
    icon: "🗣️",
    duration: 12,
    totalQuestions: 3,
    parts: [
      { part: 1, name: "Social Interaction", questions: 1, description: "3-6 câu hỏi (3 phút)" },
      { part: 2, name: "Solution Discussion", questions: 1, description: "Chọn giải pháp (4 phút)" },
      { part: 3, name: "Topic Development", questions: 1, description: "Phát triển chủ đề (5 phút)" },
    ],
  },
};

// IELTS Structure - 4 Sections, 165 minutes total
// Source: idp.com / britishcouncil official
const IELTS_STRUCTURE = {
  listening: {
    name: "Listening",
    icon: "🎧",
    duration: 30,
    totalQuestions: 40,
    sameForBothTestTypes: true,
    parts: [
      { part: 1, name: "Section 1", questions: 10, description: "Conversation in everyday social context" },
      { part: 2, name: "Section 2", questions: 10, description: "Monologue in everyday social context" },
      { part: 3, name: "Section 3", questions: 10, description: "Conversation in educational/training context" },
      { part: 4, name: "Section 4", questions: 10, description: "Monologue on academic subject (lecture)" },
    ],
  },
  reading: {
    name: "Reading",
    icon: "📖",
    duration: 60,
    totalQuestions: 40,
    sameForBothTestTypes: false,
    variants: {
      Academic: "3 long academic texts",
      "General Training": "Texts from everyday social/work contexts",
    },
    parts: [
      { part: 1, name: "Passage 1", questions: 13, description: "Academic / everyday context" },
      { part: 2, name: "Passage 2", questions: 13, description: "Academic / workplace context" },
      { part: 3, name: "Passage 3", questions: 14, description: "Long academic text / general interest" },
    ],
  },
  writing: {
    name: "Writing",
    icon: "✍️",
    duration: 60,
    totalQuestions: 2,
    sameForBothTestTypes: false,
    variants: {
      Academic: { task_1: "Describe visual info (chart, table, process, map)", task_2: "Essay" },
      "General Training": { task_1: "Write a letter", task_2: "Essay" },
    },
    assessmentCriteria: [
      "task_achievement_or_task_response",
      "coherence_and_cohesion",
      "lexical_resource",
      "grammatical_range_and_accuracy",
    ],
    parts: [
      { part: 1, name: "Task 1", questions: 1, description: "Letter / report (≥150 words, ~20 min)", minWords: 150 },
      { part: 2, name: "Task 2", questions: 1, description: "Essay (≥250 words, ~40 min)", minWords: 250 },
    ],
  },
  speaking: {
    name: "Speaking",
    icon: "🗣️",
    duration: 14, // 11–14 minutes
    totalQuestions: 3,
    sameForBothTestTypes: true,
    assessmentCriteria: [
      "fluency_and_coherence",
      "lexical_resource",
      "grammatical_range_and_accuracy",
      "pronunciation",
    ],
    parts: [
      { part: 1, name: "Introduction and interview", questions: 1, description: "Introduce yourself, familiar topics (4–5 min)" },
      { part: 2, name: "Long turn", questions: 1, description: "Cue card, speak 1–2 min after 1 min prep (3–4 min)" },
      { part: 3, name: "Discussion", questions: 1, description: "Two-way discussion related to Part 2 (4–5 min)" },
    ],
  },
};

// IELTS official band scale
const IELTS_BAND = {
  range: [0, 9] as [number, number],
  step: 0.5,
  calculation: "average_of_4_section_bands",
  rounding: "rounded_to_nearest_half_band",
};

type ExamType = "VSTEP" | "IELTS" | "Cambridge" | "General" | null;
type ExamSkill = "Listening" | "Reading" | "Writing" | "Speaking" | "Mixed" | null;
type QuestionType =
  | "multiple-choice"
  | "true-false"
  | "fill-blank"
  | "short-answer"
  | "essay"
  | "matching"
  | "listening"
  | "speaking";

interface Question {
  id: string;
  type: QuestionType;
  content: string;
  points: number;
  answers?: { id: string; text: string; isCorrect: boolean }[];
  // VSTEP specific fields
  skill?: string;
  part?: number;
  questionNumber?: number;
  audioUrl?: string;
  audioFileName?: string;
  transcript?: string;
  listenLimit?: number;
  passage?: string;
  minWords?: number;
  prepTime?: number;
  speakTime?: number;
}

const examTypeData = [
  {
    value: "VSTEP",
    icon: "🎯",
    name: "VSTEP",
    description: "Bài thi chuẩn Việt Nam (B1, B2, C1)",
    duration: "145-195 phút",
  },
  {
    value: "IELTS",
    icon: "🌍",
    name: "IELTS",
    description: "Academic / General Training",
    duration: "165 phút",
  },
  {
    value: "Cambridge",
    icon: "📚",
    name: "Cambridge",
    description: "KET, PET, FCE, CAE, CPE",
    duration: "110-235 phút",
  },
  {
    value: "Kids",
    icon: "🎈",
    name: "Kids Exam",
    description: "Cambridge YLE (Starters, Movers, Flyers)",
    duration: "60 phút",
    isKids: true,
  },
  {
    value: "THPT",
    icon: "🎓",
    name: "THPT Quốc Gia",
    description: "Đầu vào Đại học (4 parts × 25 câu)",
    duration: "60 phút",
  },
  {
    value: "General",
    icon: "📄",
    name: "General",
    description: "Đề thi tùy chỉnh",
    duration: "Tùy chọn",
  },
];

const skillData = [
  {
    value: "Mixed",
    icon: "🧩",
    name: "Full 4 kỹ năng",
    description: "Listening + Reading + Writing + Speaking",
    colorClass: "border-violet-600 bg-violet-50",
  },
  { value: "Listening", icon: "🎧", name: "Listening", color: "blue" },
  { value: "Reading", icon: "📖", name: "Reading", color: "green" },
  { value: "Writing", icon: "✍️", name: "Writing", color: "orange" },
  { value: "Speaking", icon: "🗣️", name: "Speaking", color: "purple" },
];

const questionTypes = [
  { value: "multiple-choice", label: "Trắc nghiệm nhiều đáp án", icon: HelpCircle },
  { value: "true-false", label: "Đúng / Sai", icon: CheckCircle2 },
  { value: "fill-blank", label: "Điền vào chỗ trống", icon: FileText },
  { value: "short-answer", label: "Câu trả lời ngắn", icon: FileText },
  { value: "essay", label: "Tự luận", icon: FileText },
  { value: "matching", label: "Nối đáp án", icon: Target },
  { value: "listening", label: "Nghe (có audio)", icon: Volume2 },
  { value: "speaking", label: "Nói (có ghi âm)", icon: Volume2 },
];

// ─── Suggestion helpers ──────────────────────────────────────────────────────
// Generate a default exam title based on type + skill
function suggestExamTitle(type: ExamType, skill: ExamSkill): string {
  if (!type || !skill) return "";
  const skillLabel = skill === "Mixed" ? "Full Test" : `${skill} Practice`;
  switch (type) {
    case "VSTEP":
      return `VSTEP B2 - ${skillLabel}`;
    case "IELTS":
      return skill === "Mixed"
        ? "IELTS Academic - Full Test"
        : `IELTS Academic - ${skill} Practice`;
    case "Cambridge":
      return `Cambridge B2 First - ${skillLabel}`;
    case "General":
    default:
      return `Đề thi ${skillLabel}`;
  }
}

// Generate a default description based on type + skill
function suggestExamDescription(type: ExamType, skill: ExamSkill): string {
  if (!type || !skill) return "";
  if (type === "VSTEP") {
    if (skill === "Mixed") {
      return "Đề thi VSTEP B2 đầy đủ 4 kỹ năng (Listening, Reading, Writing, Speaking) theo chuẩn Bộ Giáo dục. Đề thi bao gồm 80 câu hỏi với thời gian làm bài 172 phút, giúp đánh giá toàn diện năng lực tiếng Anh của thí sinh.";
    }
    if (skill === "Listening") return "Đề thi VSTEP B2 - Kỹ năng Nghe gồm 3 phần với 35 câu hỏi, thời gian 40 phút. Đề thi đánh giá khả năng nghe hiểu thông báo, hội thoại và bài giảng học thuật bằng tiếng Anh.";
    if (skill === "Reading") return "Đề thi VSTEP B2 - Kỹ năng Đọc gồm 4 đoạn văn với 40 câu hỏi, thời gian 60 phút. Đề thi đánh giá khả năng đọc hiểu các văn bản từ cơ bản đến học thuật.";
    if (skill === "Writing") return "Đề thi VSTEP B2 - Kỹ năng Viết gồm 2 phần: Task 1 (viết thư/email tối thiểu 120 từ) và Task 2 (viết luận tối thiểu 250 từ), thời gian 60 phút.";
    if (skill === "Speaking") return "Đề thi VSTEP B2 - Kỹ năng Nói gồm 3 phần: Social Interaction, Solution Discussion và Topic Development, tổng thời gian 12 phút.";
  }
  if (type === "IELTS") {
    if (skill === "Mixed") {
      return "Đề thi IELTS Academic đầy đủ 4 sections (Listening, Reading, Writing, Speaking) theo chuẩn IDP/British Council. Tổng thời gian ~165 phút, thang điểm band 0–9.";
    }
    if (skill === "Listening") return "Đề thi IELTS Listening gồm 4 sections × 10 câu = 40 câu, thời gian 30 phút. Đề thi đánh giá khả năng nghe hiểu trong các tình huống giao tiếp và học thuật.";
    if (skill === "Reading") return "Đề thi IELTS Reading gồm 3 passages với 40 câu hỏi, thời gian 60 phút. Academic: 3 đoạn văn học thuật. General Training: văn bản đời sống và công việc.";
    if (skill === "Writing") return "Đề thi IELTS Writing gồm Task 1 (≥150 từ, ~20 phút) và Task 2 (≥250 từ, ~40 phút), tổng 60 phút. Đánh giá theo 4 tiêu chí: Task Achievement, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy.";
    if (skill === "Speaking") return "Đề thi IELTS Speaking gồm 3 parts (Introduction, Long turn, Discussion), thời gian 11–14 phút. Đánh giá theo 4 tiêu chí: Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation.";
  }
  if (type === "Cambridge") {
    return skill === "Mixed"
      ? "Đề thi Cambridge B2 First (FCE) đầy đủ kỹ năng theo chuẩn Cambridge English."
      : `Đề thi Cambridge B2 First (FCE) - Kỹ năng ${skill}.`;
  }
  return skill === "Mixed"
    ? "Đề thi tiếng Anh tổng quát với đầy đủ 4 kỹ năng."
    : `Đề thi tiếng Anh - Kỹ năng ${skill}.`;
}

export function CreateExam() {
  const navigate = useNavigate();
  const { examId } = useParams();
  const [searchParams] = useSearchParams();
  const { isCollapsed: isSidebarCollapsed } = useSidebar();
  const toast = useToastContext();
  const [currentExamId, setCurrentExamId] = useState<string | null>(examId || null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Step 1: Basic Info
  const [examType, setExamType] = useState<ExamType>(null);
  const [examSkill, setExamSkill] = useState<ExamSkill>(null);
  const [ageGroup, setAgeGroup] = useState<'kids' | 'teens' | 'adults' | 'all'>('all');
  const [examTitle, setExamTitle] = useState("");
  const [examDescription, setExamDescription] = useState("");
  const [duration, setDuration] = useState(60);
  const [durationUnit, setDurationUnit] = useState<"minutes" | "hours">("minutes");
  const [difficulty, setDifficulty] = useState("medium");
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [allowPreview, setAllowPreview] = useState(true);

  useEffect(() => {
    if (examType === "VSTEP" && examSkill === "Mixed") {
      setDuration(172);
      setDurationUnit("minutes");
    } else if (examType === "VSTEP" && examSkill) {
      // Set default duration for individual VSTEP skills
      const skillDurations: Record<string, number> = {
        "Listening": 40,
        "Reading": 60,
        "Writing": 60,
        "Speaking": 12
      };
      const defaultDuration = skillDurations[examSkill] || 60;
      setDuration(defaultDuration);
      setDurationUnit("minutes");
    } else if (examType === "IELTS" && examSkill === "Mixed") {
      // IELTS Full = 30 + 60 + 60 + ~14 ≈ 165 minutes (Speaking usually scheduled separately)
      setDuration(165);
      setDurationUnit("minutes");
    } else if (examType === "IELTS" && examSkill) {
      // Individual IELTS skills (per IDP/British Council official)
      const ieltsSkillDurations: Record<string, number> = {
        "Listening": 30,
        "Reading": 60,
        "Writing": 60,
        "Speaking": 14, // 11-14 minutes, take upper bound
      };
      const defaultDuration = ieltsSkillDurations[examSkill] || 60;
      setDuration(defaultDuration);
      setDurationUnit("minutes");
    }
  }, [examType, examSkill]);

  // Auto-suggest age_group based on exam type
  useEffect(() => {
    if (examType === "Kids" as any) {
      setAgeGroup('kids');
    } else if (examType === "VSTEP") {
      setAgeGroup('adults');
    }
    // IELTS, Cambridge, General → giữ nguyên user chọn (default 'all')
  }, [examType]);

  // Pre-fill from setup wizard query params (?type=...&skill=...&age_group=...)
  useEffect(() => {
    if (examId) return; // edit mode skip
    const t = searchParams.get('type');
    const s = searchParams.get('skill');
    const ag = searchParams.get('age_group');
    if (t && ['VSTEP', 'IELTS', 'Cambridge', 'General'].includes(t)) {
      setExamType(t as ExamType);
    }
    if (s) {
      const cap = s.charAt(0).toUpperCase() + s.slice(1);
      const skillVal = (s === 'mixed' ? 'Mixed' : cap) as ExamSkill;
      setExamSkill(skillVal);
    }
    if (ag && ['kids', 'teens', 'adults', 'all'].includes(ag)) {
      setAgeGroup(ag as typeof ageGroup);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step 2: Questions
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [newQuestionType, setNewQuestionType] = useState<QuestionType | null>(null);

  // VSTEP Mode
  const [vstepCurrentSkill, setVstepCurrentSkill] = useState<"listening" | "reading" | "writing" | "speaking">("listening");
  const [vstepCurrentPart, setVstepCurrentPart] = useState(1);
  const [vstepActiveQuestionNumber, setVstepActiveQuestionNumber] = useState<number>(1);
  const [showVstepMenu, setShowVstepMenu] = useState(false);
  const [audioUploading, setAudioUploading] = useState<{[key: string]: boolean}>({});
  
  // VSTEP Part-level audio (for Listening parts)
  // Format: { "listening-1": { audioUrl: "...", audioFileName: "..." }, "listening-2": {...}, ... }
  const [vstepPartAudio, setVstepPartAudio] = useState<{[key: string]: { audioUrl: string; audioFileName: string }}>({});
  
  // Pagination for questions (2 questions per page)
  const [currentQuestionPage, setCurrentQuestionPage] = useState(1);
  const QUESTIONS_PER_PAGE = 2;
  
  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [draftPromptShown, setDraftPromptShown] = useState(false);
  
  // Save individual question state
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  
  // Track if exam data has been loaded (for URL with examId)
  const [isExamDataLoaded, setIsExamDataLoaded] = useState(false);
  
  // Track if page has been reloaded (to prevent infinite reload loop)
  const [hasReloaded, setHasReloaded] = useState(() => {
    return sessionStorage.getItem('exam-page-reloaded') === 'true';
  });

  // Auto-set vstepCurrentSkill when single skill is selected
  // Mixed (Full 4 skills): DO NOT redirect here — let user fill title/description first
  useEffect(() => {
    if (examType === "VSTEP" && examSkill && examSkill !== "Mixed") {
      // Handle single skills
      setVstepCurrentSkill(examSkill.toLowerCase() as "listening" | "reading" | "writing" | "speaking");
      setVstepCurrentPart(1);
      setVstepActiveQuestionNumber(1);
      
      // Redirect to specialized editor for each skill
      if (examSkill === "Reading") {
        navigate('/giao-vien/de-thi/vstep/reading/tao-moi', { replace: true });
      } else if (examSkill === "Listening") {
        navigate('/giao-vien/de-thi/vstep/listening/tao-moi', { replace: true });
      } else if (examSkill === "Writing") {
        navigate('/giao-vien/de-thi/vstep/writing/tao-moi', { replace: true });
      } else if (examSkill === "Speaking") {
        navigate('/giao-vien/de-thi/vstep/speaking/tao-moi', { replace: true });
      }
    }
  }, [examType, examSkill, navigate]);

  // Reset pagination when changing parts
  useEffect(() => {
    setCurrentQuestionPage(1);
  }, [vstepCurrentSkill, vstepCurrentPart]);

  // Initialize VSTEP questions when type changes to VSTEP
  useEffect(() => {
    if (examType === "VSTEP" && examSkill && questions.length === 0) {
      console.log('🔧 Initializing VSTEP questions for:', examSkill);
      const vstepQuestions: Question[] = [];

      // Determine which skills to initialize
      const skillsToInit = examSkill === "Mixed" 
        ? Object.keys(VSTEP_STRUCTURE) 
        : [examSkill.toLowerCase()];

      skillsToInit.forEach((skillKey) => {
        const skillData = VSTEP_STRUCTURE[skillKey as keyof typeof VSTEP_STRUCTURE];
        if (!skillData) return;

        skillData.parts.forEach((part) => {
          for (let i = 0; i < part.questions; i++) {
            vstepQuestions.push({
              id: `${skillKey}-p${part.part}-q${i + 1}`,
              skill: skillKey,
              part: part.part,
              questionNumber: i + 1,
              type: skillKey === "listening" || skillKey === "reading" ? "multiple-choice" : skillKey === "writing" ? "essay" : "speaking",
              content: "",
              points: skillKey === "writing" || skillKey === "speaking" ? 10 : 1,
              answers: skillKey === "listening" || skillKey === "reading"
                ? [
                    { id: "a", text: "", isCorrect: false },
                    { id: "b", text: "", isCorrect: false },
                    { id: "c", text: "", isCorrect: false },
                    { id: "d", text: "", isCorrect: false },
                  ]
                : undefined,
              listenLimit: skillKey === "listening" ? 1 : undefined,
              minWords: skillKey === "writing" ? (part.part === 1 ? 120 : 250) : undefined,
            });
          }
        });
      });

      console.log('✅ Created', vstepQuestions.length, 'VSTEP questions');
      setQuestions(vstepQuestions);
      
      // Set appropriate title only if user hasn't entered a custom title
      const isAutoGeneratedTitle = !examTitle || 
        examTitle === "VSTEP B2 - Full Test" ||
        examTitle === "VSTEP B2 - Listening Practice" ||
        examTitle === "VSTEP B2 - Reading Practice" ||
        examTitle === "VSTEP B2 - Writing Practice" ||
        examTitle === "VSTEP B2 - Speaking Practice";
      
      if (isAutoGeneratedTitle) {
        if (examSkill === "Mixed") {
          setExamTitle("VSTEP B2 - Full Test");
        } else {
          setExamTitle(`VSTEP B2 - ${examSkill} Practice`);
        }
      }
    }
  }, [examType, examSkill]);

  // Step 3: Preview & Publish
  const [publishOption, setPublishOption] = useState<"now" | "draft" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notifyStudents, setNotifyStudents] = useState(false);
  const [notifyTeachers, setNotifyTeachers] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  const totalQuestions = questions.length;

  const updateQuestionInState = (questionId: string, updater: (question: Question) => Question) => {
    setQuestions((prev) => prev.map((q) => (q.id === questionId ? updater(q) : q)));
    setSelectedQuestion((prev) => (prev && prev.id === questionId ? updater(prev) : prev));
  };

  const normalizeExamType = (type: ExamType) => {
    if (type === "VSTEP") return "VSTEP";
    if (type === "IELTS") return "IELTS";
    return "GENERAL";
  };

  const normalizeExamSkill = (
    skill: ExamSkill
  ): "listening" | "reading" | "writing" | "speaking" | "mixed" => {
    if (!skill) return "reading";
    if (skill === "Mixed") return "mixed";
    return skill.toLowerCase() as "listening" | "reading" | "writing" | "speaking";
  };

  const getExamSkillLabel = (skill: ExamSkill) => {
    if (skill === "Mixed") return "Full 4 kỹ năng";
    return skill || "Chưa chọn";
  };

  const normalizeQuestionType = (type: QuestionType) => {
    if (type === "multiple-choice") return "multiple_choice";
    if (type === "true-false") return "true_false";
    if (type === "fill-blank") return "fill_blank";
    if (type === "short-answer") return "short_answer";
    if (type === "essay") return "essay";
    if (type === "matching") return "reading_matching";
    if (type === "listening") return "listening_multiple_choice";
    if (type === "speaking") return "speaking_response";
    return "multiple_choice";
  };

  const buildAnswers = (question: Question) => {
    const candidates = (question.answers || [])
      .filter((answer) => answer.text.trim().length > 0)
      .map((answer) => ({
        aContent: answer.text.trim(),
        aIs_correct: answer.isCorrect,
      }));

    if (candidates.length === 0) {
      return [{ aContent: "N/A", aIs_correct: true }];
    }

    if (!candidates.some((answer) => answer.aIs_correct)) {
      candidates[0].aIs_correct = true;
    }

    return candidates;
  };

  const persistExam = async (mode: "draft" | "publish") => {
    console.log('🔍 persistExam called:', { mode, examType, examSkill, examTitle, questionsCount: questions.length });
    
    if (!canProceedStep1 || !examType || !examSkill) {
      toast.error("Vui lòng nhập đầy đủ thông tin cơ bản của đề thi");
      console.error('❌ Missing basic info:', { canProceedStep1, examType, examSkill });
      return;
    }

    setIsSaving(true);
    try {
      const durationMinutes = durationUnit === "hours" ? duration * 60 : duration;
      
      console.log('📤 Creating exam with data:', {
        eTitle: examTitle.trim(),
        eType: normalizeExamType(examType),
        eSkill: normalizeExamSkill(examSkill),
        eDuration_minutes: durationMinutes,
      });
      
      const createRes = await teacherApi.exams.create({
        eTitle: examTitle.trim(),
        eDescription: examDescription.trim(),
        eType: normalizeExamType(examType),
        eSkill: normalizeExamSkill(examSkill),
        eDuration_minutes: durationMinutes,
        eIs_private: visibility === "private",
        eSource_type: "manual",
        age_group: ageGroup,
      });

      console.log('✅ Exam created:', createRes);

      const examId =
        (createRes as any)?.data?.examId ??
        (createRes as any)?.data?.eId ??
        (createRes as any)?.data?.id;

      if (!examId) {
        throw new Error("Không lấy được ID đề thi sau khi tạo.");
      }

      console.log('📝 Exam ID:', examId);

      const questionPayload = questions
        .filter((question) => question.content.trim().length > 0)
        .map((question) => ({
          qContent: question.content.trim(),
          qType: normalizeQuestionType(question.type),
          qPoints: Number.isFinite(question.points) && question.points > 0 ? question.points : 1,
          answers: buildAnswers(question),
        }));

      console.log('📋 Questions to save:', questionPayload.length, questionPayload);

      if (questionPayload.length > 0) {
        const addQuestionsRes = await teacherApi.exams.addQuestions(examId, questionPayload);
        console.log('✅ Questions added:', addQuestionsRes);
      }

      const shouldPublishNow = mode === "publish" && publishOption === "now";
      if (shouldPublishNow) {
        await teacherApi.exams.publish(examId);
      }

      if (mode === "publish") {
        if (publishOption === "now") {
          toast.success("Tạo và xuất bản đề thi thành công");
        } else if (publishOption === "schedule") {
          toast.info(
            `Đã lưu đề ở trạng thái nháp. Lên lịch xuất bản${scheduledAt ? ` (${scheduledAt})` : ""} chưa được backend hỗ trợ`
          );
        } else {
          toast.success("Đã tạo đề thi ở trạng thái nháp");
        }
      } else {
        toast.success("Đã lưu nháp đề thi thành công");
      }

      navigate("/giao-vien/de-thi");
    } catch (error: any) {
      console.error('❌ Error saving exam:', error);
      console.error('Error details:', error?.response?.data);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Không thể lưu đề thi. Vui lòng thử lại.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Removed handleSaveDraft - now only publish directly

  const handleAddQuestion = (type: QuestionType) => {
    // For VSTEP mode, calculate question number
    const questionNumber = isVSTEPMode 
      ? vstepCurrentPartQuestions.length + 1 
      : undefined;
    
    const newQuestion: Question = {
      id: `q-${Date.now()}`,
      type,
      content: "",
      points: 1,
      // Add VSTEP-specific fields
      ...(isVSTEPMode && {
        skill: vstepCurrentSkill,
        part: vstepCurrentPart,
        questionNumber,
      }),
      answers:
        type === "multiple-choice" || type === "true-false"
          ? [
              { id: "a1", text: "", isCorrect: false },
              { id: "a2", text: "", isCorrect: false },
            ]
          : undefined,
    };
    setQuestions([...questions, newQuestion]);
    setSelectedQuestion(newQuestion);
    setIsAddingQuestion(false);
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
    if (selectedQuestion?.id === id) {
      setSelectedQuestion(null);
    }
  };

  const handleNextStep = async () => {
    if (currentStep < 3) {
      // VSTEP Full (Mixed): navigate to specialized editor with title/description
      // IMPORTANT: only redirect when examType is explicitly VSTEP. Other types
      // (IELTS, Cambridge, General) with Mixed skill must continue with the
      // generic flow until their dedicated editors are built.
      if (currentStep === 1 && examType === "VSTEP" && examSkill === "Mixed") {
        navigate('/giao-vien/de-thi/vstep/full/tao-moi', {
          replace: true,
          state: { title: examTitle, description: examDescription, duration },
        });
        return;
      }

      // IELTS: route to dedicated editor (Full or single skill)
      if (currentStep === 1 && examType === "IELTS" && examSkill) {
        const skillSlug = examSkill === "Mixed" ? "full" : examSkill.toLowerCase();
        navigate(`/giao-vien/de-thi/ielts/${skillSlug}/tao-moi`, {
          replace: true,
          state: { title: examTitle, description: examDescription, duration },
        });
        return;
      }

      // THPT: route to dedicated creator
      if (currentStep === 1 && (examType as any) === "THPT") {
        navigate(`/giao-vien/de-thi/thpt/tao-moi`, {
          replace: true,
          state: { title: examTitle, description: examDescription },
        });
        return;
      }

      // Create draft exam when moving from Step 1 to Step 2
      if (currentStep === 1 && !currentExamId) {
        try {
          const newExamId = await createDraftExam();
          if (newExamId && !String(newExamId).startsWith('temp_')) {
            navigate(`/giao-vien/de-thi/tao-moi/${newExamId}`, { replace: true });
          }
        } catch (error) {
          console.error('Failed to create draft exam:', error);
        }
      }
      setCurrentStep(currentStep + 1);
      
      if (currentStep === 1) {
        setIsExamDataLoaded(true);
      }
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceedStep1 = examType && examSkill && examTitle && duration > 0;
  const canProceedStep2 = questions.length > 0;
  const canSubmitExam = canProceedStep1 && questions.length > 0;

  // Check if VSTEP mode (both Mixed and single skill)
  const isVSTEPMode = examType === "VSTEP" && examSkill !== null;

  // Auto-focus on active Part button when entering Step 2
  useEffect(() => {
    // Only run when:
    // 1. In Step 2
    // 2. In VSTEP mode
    // 3. Data has been loaded (important for URL with examId)
    if (currentStep === 2 && isVSTEPMode && isExamDataLoaded) {
      // Delay to ensure DOM is fully rendered
      const focusTimer = setTimeout(() => {
        const activePartButton = document.querySelector('.fixed.bottom-0 button.bg-blue-500, .fixed.bottom-0 button.bg-emerald-500, .fixed.bottom-0 button.bg-amber-500, .fixed.bottom-0 button.bg-purple-500');
        
        console.log('🎯 Auto-focus triggered:', {
          currentStep,
          isVSTEPMode,
          isExamDataLoaded,
          vstepCurrentSkill,
          vstepCurrentPart,
          buttonFound: !!activePartButton
        });
        
        if (activePartButton) {
          activePartButton.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest',
            inline: 'center'
          });
          // Add a brief highlight animation
          activePartButton.classList.add('animate-pulse');
          setTimeout(() => {
            activePartButton.classList.remove('animate-pulse');
          }, 1500);
        } else {
          console.warn('⚠️ Active part button not found in DOM');
        }
      }, 500); // Increased delay for page load scenario
      
      return () => clearTimeout(focusTimer);
    }
  }, [currentStep, isVSTEPMode, vstepCurrentSkill, vstepCurrentPart, isExamDataLoaded]);

  // Get VSTEP progress
  const getVSTEPPartProgress = () => {
    const progress: any[] = [];
    if (!isVSTEPMode) return progress;

    // Determine which skills to show progress for
    const skillsToShow = examSkill === "Mixed" 
      ? Object.keys(VSTEP_STRUCTURE)
      : [examSkill.toLowerCase()];

    skillsToShow.forEach((skillKey) => {
      const skillData = VSTEP_STRUCTURE[skillKey as keyof typeof VSTEP_STRUCTURE];
      if (!skillData) return;

      skillData.parts.forEach((part) => {
        const partQuestions = questions.filter((q) => q.skill === skillKey && q.part === part.part);
        const completed = partQuestions.filter((q) => {
          if (!q.content.trim()) return false;
          if (skillKey === "listening" || skillKey === "reading") {
            return q.answers?.some((a) => a.isCorrect && a.text.trim());
          }
          return true;
        }).length;

        progress.push({ skill: skillKey, part: part.part, completed, total: part.questions });
      });
    });

    return progress;
  };

  const vstepProgress = getVSTEPPartProgress();

  // VSTEP: Get current part questions
  const vstepCurrentPartQuestions = isVSTEPMode
    ? questions.filter((q) => q.skill === vstepCurrentSkill && q.part === vstepCurrentPart)
    : [];

  // VSTEP: Update question
  const updateVSTEPQuestion = (questionId: string, updates: Partial<Question>) => {
    setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, ...updates } : q)));
  };

  // Helper: Remove number prefix from question content (e.g., "1. What is..." -> "What is...")
  const removeNumberPrefix = (text: string): string => {
    // Match patterns like "1. ", "10. ", "123. " at the start of the string
    return text.replace(/^\d+\.\s*/, '');
  };

  // Helper: Remove letter prefix from answer options (e.g., "A. Answer" -> "Answer", "D. Option" -> "Option")
  const removeLetterPrefix = (text: string): string => {
    // Match patterns like "A. ", "B. ", "C. ", "D. " (case insensitive) at the start
    return text.replace(/^[A-Da-d]\.\s*/, '');
  };

  // VSTEP: Update answer
  const updateVSTEPAnswer = (questionId: string, answerId: string, content: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === questionId && q.answers) {
          return {
            ...q,
            answers: q.answers.map((a) => (a.id === answerId ? { ...a, text: content } : a)),
          };
        }
        return q;
      })
    );
  };

  // VSTEP: Set correct answer
  const setVSTEPCorrectAnswer = (questionId: string, answerId: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === questionId && q.answers) {
          return {
            ...q,
            answers: q.answers.map((a) => ({ ...a, isCorrect: a.id === answerId })),
          };
        }
        return q;
      })
    );
  };

  // Get skill color classes (soft colors)
  const getSkillColors = (skill: string) => {
    const colors = {
      listening: {
        bg: 'bg-indigo-50',
        border: 'border-indigo-500',
        text: 'text-indigo-700',
        icon: 'bg-indigo-100',
        hover: 'hover:bg-indigo-100',
        active: 'bg-indigo-100 border-indigo-500'
      },
      reading: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-500',
        text: 'text-emerald-700',
        icon: 'bg-emerald-100',
        hover: 'hover:bg-emerald-100',
        active: 'bg-emerald-100 border-emerald-500'
      },
      writing: {
        bg: 'bg-amber-50',
        border: 'border-amber-500',
        text: 'text-amber-700',
        icon: 'bg-amber-100',
        hover: 'hover:bg-amber-100',
        active: 'bg-amber-100 border-amber-500'
      },
      speaking: {
        bg: 'bg-purple-50',
        border: 'border-purple-500',
        text: 'text-purple-700',
        icon: 'bg-purple-100',
        hover: 'hover:bg-purple-100',
        active: 'bg-purple-100 border-purple-500'
      }
    };
    return colors[skill] || colors.listening;
  };

  // VSTEP: Navigate parts
  const allVSTEPParts = isVSTEPMode
    ? (() => {
        const skillsToNav = examSkill === "Mixed" 
          ? Object.keys(VSTEP_STRUCTURE)
          : [examSkill.toLowerCase()];
        
        return skillsToNav.flatMap((skillKey) => {
          const skillData = VSTEP_STRUCTURE[skillKey as keyof typeof VSTEP_STRUCTURE];
          if (!skillData) return [];
          return skillData.parts.map((p) => ({ skill: skillKey, part: p.part }));
        });
      })()
    : [];

  const vstepCurrentPartIndex = allVSTEPParts.findIndex(
    (p) => p.skill === vstepCurrentSkill && p.part === vstepCurrentPart
  );

  const goToNextVSTEPPart = () => {
    if (vstepCurrentPartIndex < allVSTEPParts.length - 1) {
      const next = allVSTEPParts[vstepCurrentPartIndex + 1];
      setVstepCurrentSkill(next.skill as any);
      setVstepCurrentPart(next.part);
      setVstepActiveQuestionNumber(1); // Reset to first question of new part
    }
  };

  // VSTEP: Jump to specific question in current part
  const jumpToVSTEPQuestion = (questionNumber: number) => {
    setVstepActiveQuestionNumber(questionNumber);
    // Scroll to question
    const questionElement = document.getElementById(`vstep-question-${vstepCurrentSkill}-${vstepCurrentPart}-q${questionNumber}`);
    if (questionElement) {
      questionElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  };

  // VSTEP: Handle audio file upload for PART (not individual question)
  const handlePartAudioUpload = async (skill: string, partNumber: number, file: File) => {
    if (!file) {
      toast.error('Vui lòng chọn file audio');
      return;
    }

    // Check file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/ogg'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['mp3', 'wav', 'm4a', 'aac', 'ogg'];
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension || '')) {
      toast.error('Vui lòng chọn file audio hợp lệ (MP3, WAV, M4A, AAC, OGG)');
      console.error('❌ Invalid file type:', file.type, 'Extension:', fileExtension);
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      toast.error('File audio quá lớn. Vui lòng chọn file nhỏ hơn 50MB');
      return;
    }

    const partKey = `${skill}-${partNumber}`;
    setAudioUploading(prev => ({ ...prev, [partKey]: true }));

    try {
      const formData = new FormData();
      formData.append('audio', file, file.name); // Explicitly include filename
      formData.append('questionId', partKey);
      
      console.log('🎵 Uploading part audio:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileExtension: fileExtension,
        skill,
        partNumber,
        partKey,
        formDataEntries: Array.from(formData.entries()).map(([key, value]) => ({
          key,
          value: value instanceof File ? `File: ${value.name} (${value.size} bytes)` : value
        }))
      });
      
      const token = getAuthToken();
      const endpoint = token ? '/teacher/upload/audio' : '/test/upload/audio';
      console.log('📡 Endpoint:', endpoint, '🔑 Has token:', !!token);

      const { data: result, status: respStatus } = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      console.log('📥 Response status:', respStatus, 'data:', result);

      if (result.success) {
        // Store audio at part level
        setVstepPartAudio(prev => ({
          ...prev,
          [partKey]: {
            audioUrl: result.data.audioUrl,
            audioFileName: result.data.originalName
          }
        }));
        
        // Also update all questions in this part with the audio URL (for backward compatibility)
        const partQuestions = questions.filter(q => q.skill === skill && q.part === partNumber);
        partQuestions.forEach(q => {
          updateVSTEPQuestion(q.id, { 
            audioUrl: result.data.audioUrl,
            audioFileName: result.data.originalName 
          });
        });
        
        toast.success('Upload audio thành công!');
      } else {
        // Show detailed error message
        const errorMsg = result.errors 
          ? Object.entries(result.errors).map(([field, msgs]: [string, any]) => 
              `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`
            ).join('\n')
          : result.message || 'Upload failed';
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error('❌ Part audio upload error:', error);
      toast.error(`Lỗi upload audio: ${error.message}`);
    } finally {
      setAudioUploading(prev => ({ ...prev, [partKey]: false }));
    }
  };

  // Save individual question
  const handleSaveQuestion = async (questionId: string) => {
    if (!currentExamId) {
      toast.error('Vui lòng lưu đề thi trước khi lưu câu hỏi');
      return;
    }

    const question = questions.find(q => q.id === questionId);
    if (!question) {
      toast.error('Không tìm thấy câu hỏi');
      return;
    }

    // Validate question content
    if (!question.content || question.content.trim() === '') {
      toast.error('Vui lòng nhập nội dung câu hỏi');
      return;
    }

    // Validate answers for multiple choice questions
    if ((question.skill === 'listening' || question.skill === 'reading') && question.answers) {
      const hasCorrectAnswer = question.answers.some(a => a.isCorrect);
      if (!hasCorrectAnswer) {
        toast.error('Vui lòng chọn đáp án đúng');
        return;
      }
      
      const hasEmptyAnswer = question.answers.some(a => !a.text || a.text.trim() === '');
      if (hasEmptyAnswer) {
        toast.error('Vui lòng điền đầy đủ các đáp án');
        return;
      }
    }

    setSavingQuestionId(questionId);

    try {
      // Here you would call the API to save the individual question
      // For now, we'll just simulate a save
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success(`Đã lưu câu ${question.questionNumber}`);
    } catch (error: any) {
      console.error('❌ Save question error:', error);
      toast.error(`Lỗi lưu câu hỏi: ${error.message}`);
    } finally {
      setSavingQuestionId(null);
    }
  };

  // Auto-save functions
  const createDraftExam = async () => {
    if (currentExamId) return currentExamId; // Already has ID
    
    if (!examSkill) return null; // Need examSkill to create exam
    
    try {
      const normalizedSkill: 'listening' | 'reading' | 'writing' | 'speaking' | 'mixed' = 
        examSkill === "Mixed" ? "mixed" : examSkill.toLowerCase() as 'listening' | 'reading' | 'writing' | 'speaking';
      
      const examData = {
        eTitle: examTitle || `Đề thi ${examType} - ${new Date().toLocaleString('vi-VN')}`,
        eDescription: examDescription || 'Đề thi đang được tạo...',
        eType: examType,
        eSkill: normalizedSkill,
        eDuration_minutes: duration,
        eIs_private: false,
        eSource_type: 'manual' as const,
        age_group: ageGroup,
      };

      // Use teacherApi service instead of direct fetch
      const response = await teacherApi.exams.create(examData);
      console.log('🔍 API Response:', response);
      
      if (response.status === 'success' && response.data) {
        const newExamId = response.data.eId.toString();
        console.log('🔍 Setting currentExamId to:', newExamId);
        setCurrentExamId(newExamId);
        // Clear draft when successfully created
        clearLocalStorageDraft();
        return newExamId;
      } else {
        throw new Error(response.message || 'Failed to create draft exam');
      }
    } catch (error) {
      console.error('Error creating draft exam:', error);
      console.log('🔍 Error details:', error.response?.data || error.message);
      // Generate temporary local ID
      const tempId = 'temp_' + Date.now();
      console.log('🔍 Generated temp ID:', tempId);
      setCurrentExamId(tempId);
      return tempId;
    }
  };

  const generateAutoSaveKey = () => {
    return `exam-draft-${examType}-${examSkill}-${Date.now()}`;
  };

  const saveToLocalStorage = () => {
    try {
      const examData = {
        examType,
        examSkill,
        examTitle,
        examDescription,
        duration,
        durationUnit,
        questions,
        vstepCurrentSkill,
        vstepCurrentPart,
        currentStep,
        timestamp: Date.now()
      };
      
      const key = `exam-draft-current`;
      localStorage.setItem(key, JSON.stringify(examData));
      return true;
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      return false;
    }
  };

  const loadFromLocalStorage = () => {
    try {
      const key = `exam-draft-current`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const examData = JSON.parse(saved);
        // Only restore if less than 24 hours old
        if (Date.now() - examData.timestamp < 24 * 60 * 60 * 1000) {
          return examData;
        }
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
    }
    return null;
  };

  const clearLocalStorageDraft = () => {
    try {
      localStorage.removeItem('exam-draft-current');
      setDraftPromptShown(false); // Reset để có thể hỏi lại nếu có draft mới
    } catch (error) {
      console.error('Failed to clear localStorage draft:', error);
    }
  };

  const saveToServer = async (isDraft = true) => {
    setAutoSaveStatus('saving');
    try {
      const examData = {
        eTitle: examTitle,
        eDescription: examDescription,
        eType: examType,
        eSkill: examSkill.toLowerCase() as 'listening' | 'reading' | 'writing' | 'speaking' | 'mixed',
        eDuration_minutes: duration,
        eIs_private: false,
        eSource_type: 'manual' as const,
        age_group: ageGroup,
      };

      let result;
      if (currentExamId && !currentExamId.startsWith('temp_')) {
        // Update existing exam
        result = await teacherApi.exams.update(parseInt(currentExamId), examData);
      } else {
        // Create new exam
        result = await teacherApi.exams.create(examData);
        // If this was a new exam, store the ID
        if (result.status === 'success' && result.data?.eId) {
          setCurrentExamId(result.data.eId.toString());
        }
      }

      if (result.status === 'success') {
        setAutoSaveStatus('saved');
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        return result;
      } else {
        throw new Error(result.message || 'Server save failed');
      }
    } catch (error) {
      console.error('Auto-save to server failed:', error);
      // Fallback to localStorage
      if (saveToLocalStorage()) {
        setAutoSaveStatus('saved');
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
      } else {
        setAutoSaveStatus('error');
      }
    }
  };

  // Auto-save effect with debounce - DISABLED
  // useEffect(() => {
  //   const autoSaveTimer = setTimeout(() => {
  //     if (hasUnsavedChanges && (examType || examSkill || examTitle || examDescription || questions.length > 0)) {
  //       saveToLocalStorage();
  //       if (navigator.onLine) {
  //         saveToServer(true);
  //       }
  //     }
  //   }, 3000);
  //   return () => clearTimeout(autoSaveTimer);
  // }, [examTitle, examDescription, questions, examType, examSkill, duration, hasUnsavedChanges]);

  // Track changes
  useEffect(() => {
    setHasUnsavedChanges(true);
    setAutoSaveStatus('idle');
  }, [examTitle, examDescription, questions, examType, examSkill, duration, durationUnit]);

  // Load draft on component mount or load existing exam - DRAFT PROMPT DISABLED
  useEffect(() => {
    const loadExam = async () => {
      if (examId) {
        // Auto-reload once when first visiting page with examId
        if (!hasReloaded) {
          sessionStorage.setItem('exam-page-reloaded', 'true');
          window.location.reload();
          return;
        }
        
        // Load existing exam
        try {
          const response = await teacherApi.exams.getById(parseInt(examId));
          
          if (response.status === 'success' && response.data) {
            const exam = response.data;
            // Load exam data
            const loadedExamType = exam.eType as ExamType;
            const loadedExamSkill = (exam.eSkill.charAt(0).toUpperCase() + exam.eSkill.slice(1)) as ExamSkill;
            
            setExamType(loadedExamType);
            setExamSkill(loadedExamSkill);
            setExamTitle(exam.eTitle);
            setExamDescription(exam.eDescription);
            setDuration(exam.eDuration_minutes);
            if ((exam as any).age_group) {
              setAgeGroup((exam as any).age_group);
            }
            setDurationUnit('minutes'); // Backend only stores minutes
            setQuestions((exam.questions || []) as unknown as Question[]);
            
            // Set VSTEP current skill based on loaded exam skill
            if (loadedExamType === "VSTEP") {
              if (loadedExamSkill === "Mixed") {
                setVstepCurrentSkill('listening'); // Start with listening for Mixed
              } else {
                // For single skill, set to that skill
                setVstepCurrentSkill(loadedExamSkill.toLowerCase() as "listening" | "reading" | "writing" | "speaking");
              }
              setVstepCurrentPart(1);
              setCurrentStep(2); // Go directly to Step 2 for editing
            } else {
              setCurrentStep(1); // Other exam types start at Step 1
            }
            
            setCurrentExamId(examId);
            setHasUnsavedChanges(false);
            setLastSaved(exam.updated_at ? new Date(exam.updated_at) : new Date());
            
            // Mark data as loaded - trigger auto-focus
            setTimeout(() => {
              setIsExamDataLoaded(true);
            }, 100); // Small delay to ensure all state updates are done
          }
        } catch (error) {
          console.error('Failed to load exam:', error);
        }
      } else {
        // No examId, creating new exam - mark as loaded immediately
        setIsExamDataLoaded(true);
      }
      // Draft prompt disabled - no longer check for local draft
    };

    loadExam();
    
    // Cleanup: Clear reload flag when component unmounts (user leaves page)
    return () => {
      sessionStorage.removeItem('exam-page-reloaded');
    };
  }, [examId, hasReloaded]);

  // Clear draft when successfully published
  const handleSuccessfulPublish = () => {
    clearLocalStorageDraft();
    setHasUnsavedChanges(false);
    setAutoSaveStatus('saved');
  };

  // Prevent accidental page close - DISABLED
  // useEffect(() => {
  //   const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  //     if (hasUnsavedChanges) {
  //       e.preventDefault();
  //       e.returnValue = 'Bạn có thay đổi chưa được lưu. Bạn có chắc muốn rời khỏi trang?';
  //       return e.returnValue;
  //     }
  //   };
  //   window.addEventListener('beforeunload', handleBeforeUnload);
  //   return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  // }, [hasUnsavedChanges]);

  // VSTEP: Render question editor
  const renderVSTEPQuestionEditor = (question: Question) => {
    const skillData = VSTEP_STRUCTURE[question.skill as keyof typeof VSTEP_STRUCTURE];
    const partData = skillData?.parts.find((p) => p.part === question.part);
    
    // Skill-based colors (soft palette)
    const questionColors = {
      listening: { bg: 'bg-indigo-50', border: 'border-indigo-200', badge: 'bg-indigo-500', text: 'text-indigo-700', ring: 'focus:ring-indigo-500 focus:border-indigo-500' },
      reading: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-500', text: 'text-emerald-700', ring: 'focus:ring-emerald-500 focus:border-emerald-500' },
      writing: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-500', text: 'text-amber-700', ring: 'focus:ring-amber-500 focus:border-amber-500' },
      speaking: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-500', text: 'text-purple-700', ring: 'focus:ring-purple-500 focus:border-purple-500' },
    };
    const colors = questionColors[question.skill as keyof typeof questionColors];

    return (
      <div 
        key={question.id} 
        id={`vstep-question-${question.skill}-${question.part}-q${question.questionNumber}`}
        className={`bg-white rounded-xl border-2 hover:shadow-md transition-all duration-200 overflow-hidden ${
          vstepActiveQuestionNumber === question.questionNumber ? `${colors.border} shadow-md` : 'border-gray-200'
        }`}
      >
        {/* Question Header */}
        <div className={`${colors.bg} border-b-2 ${colors.border} px-6 py-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 ${colors.badge} text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-sm`}>
                {question.questionNumber}
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  Câu {question.questionNumber}
                </div>
                <div className={`text-sm ${colors.text} font-medium mt-0.5`}>
                  {skillData?.icon} {skillData?.name} - Part {question.part}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-4 py-2 bg-white rounded-lg text-sm font-semibold text-gray-700 border border-gray-200">
                {question.points || 1} điểm
              </span>
            </div>
          </div>
        </div>

        {/* Question Body */}
        <div className="p-6 space-y-6">
          {/* Question Content - Hide for Writing (has its own section below) */}
          {question.skill !== "writing" && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Nội dung câu hỏi
              </label>
              <textarea
                value={question.content}
                onChange={(e) => {
                  const cleanedContent = removeNumberPrefix(e.target.value);
                  updateVSTEPQuestion(question.id, { content: cleanedContent });
                }}
                placeholder={`Nhập nội dung câu hỏi ${question.questionNumber}...`}
                className={`w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl ${colors.ring} min-h-[100px] transition-all`}
                rows={4}
              />
            </div>
          )}

          {/* Listening: Transcript only (audio is at Part level) */}
          {question.skill === "listening" && (
            <div className="space-y-4 bg-indigo-50/50 rounded-xl p-6 border border-indigo-100">
              <div className="bg-indigo-100 border border-indigo-300 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-indigo-900 mb-1">
                      🎧 Audio được upload ở cấp độ Part
                    </p>
                    <p className="text-xs text-indigo-700">
                      Tất cả câu hỏi trong Part {question.part} sẽ sử dụng chung 1 file audio. 
                      Vui lòng upload audio ở phần trên cùng của Part.
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  📝 Transcript (chỉ GV xem)
                </label>
                <textarea
                  value={question.transcript || ""}
                  onChange={(e) => updateVSTEPQuestion(question.id, { transcript: e.target.value })}
                  placeholder="Nhập nội dung transcript để GV tham khảo khi chấm bài..."
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 min-h-[60px] transition-all font-mono"
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  💡 Transcript giúp GV kiểm tra nội dung audio và hỗ trợ học viên khuyết tật
                </p>
              </div>
            </div>
          )}

          {/* Reading: Passage (only for first question) */}
          {question.skill === "reading" && question.id.includes("-q1") && (
            <div className="bg-green-50/50 rounded-xl p-5 border border-green-100">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <BookOpen className="w-4 h-4 inline mr-1" />
                📄 Passage {question.part} ({(partData as any)?.wordCount?.[0]}-{(partData as any)?.wordCount?.[1]} từ)
              </label>
              <textarea
                value={question.passage || ""}
                onChange={(e) => {
                  const partQuestions = questions.filter((q) => q.skill === "reading" && q.part === question.part);
                  partQuestions.forEach((pq) => updateVSTEPQuestion(pq.id, { passage: e.target.value }));
                }}
                placeholder={`Nhập văn bản đọc cho Part ${question.part}...`}
                className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 min-h-[150px] font-serif leading-relaxed transition-all"
                rows={8}
              />
              <p className="text-xs text-green-700 mt-2 font-medium bg-green-100 rounded-lg px-3 py-1.5 inline-block">
                ✓ Văn bản này sẽ áp dụng cho tất cả {partData?.questions} câu hỏi trong Part {question.part}
              </p>
            </div>
          )}

          {/* Multiple Choice Answers */}
          {(question.skill === "listening" || question.skill === "reading") && question.answers && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                ✅ Đáp án (chọn 1 đáp án đúng):
              </label>
              {question.answers.map((answer, idx) => (
                <div key={answer.id} className="flex items-center gap-3 group">
                  {/* Correct Answer Label */}
                  {answer.isCorrect && (
                    <span className="text-xs font-semibold text-green-600 whitespace-nowrap">
                      Đáp án đúng
                    </span>
                  )}
                  
                  <div className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all ${
                    answer.isCorrect 
                      ? `${colors.badge} text-white shadow-md` 
                      : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name={`correct-${question.id}`}
                      checked={answer.isCorrect}
                      onChange={() => setVSTEPCorrectAnswer(question.id, answer.id)}
                      className="hidden"
                    />
                    <span className="font-bold text-sm cursor-pointer" onClick={() => setVSTEPCorrectAnswer(question.id, answer.id)}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                  </div>
                  
                  <input
                    type="text"
                    value={answer.text}
                    onChange={(e) => {
                      const cleanedText = removeLetterPrefix(e.target.value);
                      updateVSTEPAnswer(question.id, answer.id, cleanedText);
                    }}
                    placeholder={`Nhập đáp án ${String.fromCharCode(65 + idx)}...`}
                    className={`flex-1 px-3 py-2 text-sm border-2 rounded-lg transition-all ${
                      answer.isCorrect 
                        ? `${colors.border} bg-${question.skill}-50/30 focus:ring-2 focus:ring-${question.skill}-500` 
                        : 'border-gray-200 focus:ring-2 focus:ring-gray-300'
                    }`}
                  />
                  
                  {/* Green Checkmark Icon */}
                  {answer.isCorrect && (
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Writing: Essay prompt */}
          {question.skill === "writing" && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-orange-500 text-white rounded-lg flex items-center justify-center flex-shrink-0">
                    <Info className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-orange-900 mb-1">
                      ✍️ {question.part === 1 ? 'Task 1 - Letter/Email' : 'Task 2 - Essay'} (Tối thiểu {question.minWords} từ)
                    </p>
                    <p className="text-xs text-orange-700">
                      Học viên sẽ đọc đề bài và viết bài luận. Giáo viên chấm điểm thủ công dựa trên tiêu chí đánh giá.
                    </p>
                  </div>
                </div>
              </div>

              {/* Full prompt textarea */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📝 Đề bài Writing (paste toàn bộ nội dung)
                </label>
                <textarea
                  value={question.content}
                  onChange={(e) => updateVSTEPQuestion(question.id, { content: e.target.value })}
                  placeholder={question.part === 1 
                    ? `Ví dụ format đề bài Task 1 (Letter/Email):

You should spend about 20 minutes on this task.

You have received this email from an English-speaking pen friend.

I'm a rock fan. I can listen to rock all day. What about you? What kind of music do you like? What is your favourite song and artist? Please write to tell me more about your music taste.

Write an email to your friend responding to their questions and sharing your music preferences.

You should write at least 120 words. Do not include your name.

Your response will be evaluated in terms of Task Fulfillment, Organization, Vocabulary and Grammar.`
                    : `Ví dụ format đề bài Task 2 (Essay):

You should spend about 40 minutes on this task.

Read the following text from an article about vegetarianism.

Vegetarians tend to avoid consuming meat and fish for the purpose of maintaining good health and due to environmental concerns. It is a fact that several groups of people prefer not to consume any kind of meat or fish, as they believe that being vegetarian brings many benefits for their health and for the world as a whole.

Write an essay for an educated audience discussing your opinions on this viewpoint. Support your answer with specific reasons and relevant examples.

Give reasons and relevant examples from your knowledge or experience.

You should write at least 250 words.

Your response will be evaluated in terms of Task Fulfillment, Organization, Vocabulary and Grammar.`}
                  className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 min-h-[450px] font-serif leading-relaxed transition-all"
                  rows={20}
                />
                <div className="mt-2 space-y-3">
                  {/* Guide box */}
                  <div className="flex items-start gap-2 text-xs text-gray-600 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                    <Info className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-indigo-900 mb-2">💡 Hướng dẫn format đề bài:</p>
                      <div className="space-y-2 text-indigo-800">
                        <div className="bg-white rounded p-2 border border-indigo-200">
                          <p className="font-semibold mb-1">Cách format text:</p>
                          <ul className="space-y-1 text-xs">
                            <li>• <span className="font-mono bg-gray-100 px-1">**text**</span> → <strong>in đậm</strong></li>
                            <li>• <span className="font-mono bg-gray-100 px-1">*text*</span> → <em>in nghiêng</em></li>
                            <li>• <span className="font-mono bg-gray-100 px-1">***text***</span> → <strong><em>đậm + nghiêng</em></strong></li>
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold mb-1">Gợi ý format cho từng phần:</p>
                          <ul className="space-y-1">
                            <li>• Thời gian: <span className="italic">*You should spend about 40 minutes...*</span></li>
                            <li>• Hướng dẫn đọc: <span className="italic">*Read the following text...*</span></li>
                            <li>• Đoạn văn context: <span className="italic">*Vegetarians tend to avoid...*</span></li>
                            <li>• Yêu cầu chính: <span className="font-semibold">**Write an essay for an educated audience...**</span></li>
                            <li>• Hướng dẫn thêm: <span className="italic">*Give reasons and relevant examples...*</span></li>
                            <li>• Số từ + tiêu chí: <span className="italic">*You should write at least 250 words...*</span></li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Preview formatted content */}
                  {question.content && (
                    <div className="bg-white border-2 border-orange-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-orange-200">
                        <Eye className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-semibold text-orange-900">Preview - Học viên sẽ thấy:</span>
                      </div>
                      <div className="prose prose-sm max-w-none space-y-2">
                        {question.content.split('\n').map((line, idx) => {
                          const trimmed = line.trim();
                          if (!trimmed) return <div key={idx} className="h-2"></div>;
                          
                          // Parse markdown-style formatting
                          let formatted = trimmed;
                          
                          // Bold + Italic: ***text***
                          formatted = formatted.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
                          
                          // Bold: **text**
                          formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                          
                          // Italic: *text*
                          formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
                          
                          return (
                            <p 
                              key={idx} 
                              className="text-sm text-gray-800 leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: formatted }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Speaking */}
          {question.skill === "speaking" && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-500 text-white rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-purple-900 mb-1">
                    🎤 Bài thi Speaking - Ghi âm trả lời
                  </p>
                  <p className="text-xs text-purple-700">Học viên sẽ ghi âm câu trả lời. Giáo viên nghe và chấm điểm thủ công sau khi học viên nộp bài.</p>
                </div>
              </div>
            </div>
          )}

          {/* Save Question Button */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={() => handleSaveQuestion(question.id)}
              disabled={savingQuestionId === question.id}
              className={`w-full px-4 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                savingQuestionId === question.id
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : `${colors.badge} text-white hover:opacity-90 shadow-sm hover:shadow-md`
              }`}
            >
              {savingQuestionId === question.id ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Lưu câu hỏi</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-8 py-6">
          <div className="flex items-center gap-4 mb-6">
            <Link
              to="/giao-vien/de-thi/tat-ca"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h1 className="text-3xl font-bold text-gray-900">Tạo đề thi mới</h1>
                {/* Auto-save Status */}
                <div className="flex items-center gap-2">
                  {autoSaveStatus === 'saving' && (
                    <div className="flex items-center gap-2 text-sm text-orange-600">
                      <div className="animate-spin w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full"></div>
                      <span>Đang lưu...</span>
                    </div>
                  )}
                  {autoSaveStatus === 'saved' && lastSaved && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Đã lưu {new Date(lastSaved).toLocaleTimeString('vi-VN')}</span>
                    </div>
                  )}
                  {autoSaveStatus === 'error' && (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.99-.833-2.76 0L4.054 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span>Lỗi lưu</span>
                    </div>
                  )}
                  {hasUnsavedChanges && autoSaveStatus === 'idle' && (
                    <div className="flex items-center gap-2 text-sm text-orange-600">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span>Có thay đổi chưa lưu</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Link to="/giao-vien" className="hover:text-orange-600 transition-colors">
                  Dashboard
                </Link>
                <span>/</span>
                <Link to="/giao-vien/de-thi/tat-ca" className="hover:text-orange-600 transition-colors">
                  Ngân hàng đề
                </Link>
                <span>/</span>
                <span className="text-gray-900 font-medium">Tạo đề mới</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Removed manual save button - only keep auto-save */}
            </div>
          </div>

          {/* Progress Indicator - Hide in VSTEP mode Step 2 */}
          {!(isVSTEPMode && currentStep === 2) && (
            <div className="flex items-center justify-center gap-4">
              {[1, 2, 3].map((step, idx) => (
                <div key={step} className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                        currentStep === step
                          ? "bg-orange-600 text-white shadow-lg shadow-orange-500/30"
                          : currentStep > step
                            ? "bg-green-600 text-white"
                            : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {currentStep > step ? <CheckCircle2 className="w-5 h-5" /> : step}
                    </div>
                    <div className="text-left">
                      <p
                        className={`text-sm font-semibold ${currentStep === step ? "text-orange-600" : "text-gray-600"}`}
                      >
                        Bước {step}
                      </p>
                      <p className="text-xs text-gray-500">
                        {step === 1 && "Thông tin cơ bản"}
                        {step === 2 && "Thêm câu hỏi"}
                        {step === 3 && "Xem trước & Xuất bản"}
                      </p>
                    </div>
                  </div>
                  {step < 3 && (
                    <ChevronRight
                      className={`w-5 h-5 ${currentStep > step ? "text-green-600" : "text-gray-300"}`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Step Content */}
      <div className="px-4 py-6">
        {/* STEP 1: Basic Info */}
        {currentStep === 1 && (
          <div className="space-y-6">
            {/* Exam Type */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Loại đề thi</h3>
              <div className="mb-4 p-3 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-800 leading-relaxed">
                <span className="font-semibold">💡 Hướng dẫn: </span>
                Chọn định dạng đề phù hợp. <b>General</b> dùng cho đề trắc nghiệm tổng hợp (ngữ pháp, từ vựng, đọc hiểu) —
                phù hợp nhất cho học viên Teens. <b>VSTEP/IELTS</b> theo chuẩn 4 kỹ năng, <b>Kids</b> chuyển sang trình tạo đề thiếu nhi riêng.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {examTypeData.map((type: any) => (
                  <button
                    key={type.value}
                    onClick={() => {
                      if (type.isKids) {
                        // Redirect to Kids Exam page
                        navigate('/giao-vien/de-thi/kids/tao-moi');
                      } else {
                        setExamType(type.value as ExamType);
                      }
                    }}
                    className={`p-6 border-2 rounded-xl text-left transition-all duration-200 ${
                      examType === type.value
                        ? "border-orange-600 bg-orange-50 shadow-lg"
                        : "border-gray-200 hover:border-orange-300 hover:bg-orange-50/50"
                    }`}
                  >
                    <div className="text-4xl mb-3">{type.icon}</div>
                    <h4 className="font-bold text-gray-900 mb-1">{type.name}</h4>
                    <p className="text-sm text-gray-600 mb-2">{type.description}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {type.duration}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Exam Skill */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Kỹ năng bài thi</h3>
              <p className="text-sm text-gray-600 mb-4">
                VSTEP full test nên chọn <span className="font-semibold text-violet-700">Full 4 kỹ năng</span>.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {skillData.map((skill) => (
                  <button
                    key={skill.value}
                    onClick={() => setExamSkill(skill.value as ExamSkill)}
                    className={`p-4 border-2 rounded-xl text-center transition-all ${
                      examSkill === skill.value
                        ? ("colorClass" in skill ? skill.colorClass : `border-${skill.color}-600 bg-${skill.color}-50 shadow-lg`)
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="text-3xl mb-2">{skill.icon}</div>
                    <p className="font-semibold text-gray-900">{skill.name}</p>
                    {"description" in skill && (
                      <p className="mt-1 text-xs text-gray-600">{skill.description}</p>
                    )}
                  </button>
                ))}
              </div>

              {examSkill === "Mixed" && examType === "VSTEP" && (
                <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
                  <p className="text-sm font-bold text-violet-800">Format VSTEP Full 4 kỹ năng</p>
                  <p className="mt-1 text-xs text-violet-700">
                    Listening 40' • Reading 60' • Writing 60' • Speaking 12' (~172-180 phút)
                  </p>
                </div>
              )}
              {examSkill === "Mixed" && examType === "IELTS" && (
                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm font-bold text-blue-800">Format IELTS Full Test</p>
                  <p className="mt-1 text-xs text-blue-700">
                    Listening 30' • Reading 60' • Writing 60' • Speaking 11–14' (~165 phút) · Band 0–9
                  </p>
                </div>
              )}
            </div>

            {/* Age Group selector */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Nhóm học viên</h3>
              <p className="text-sm text-gray-600 mb-4">
                Chọn nhóm tuổi mà bài thi này dành cho. Hệ thống sẽ chỉ giao bài cho học viên/lớp đúng nhóm.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { value: 'all', label: 'Mọi nhóm', desc: 'Hiển thị cho tất cả' },
                  { value: 'kids', label: 'Kids', desc: '6-12 tuổi' },
                  { value: 'teens', label: 'Teens', desc: '13-17 tuổi' },
                  { value: 'adults', label: 'Adults', desc: '18+ tuổi' },
                ].map(opt => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setAgeGroup(opt.value as typeof ageGroup)}
                    className={`p-3 border-2 rounded-xl text-center transition-all ${
                      ageGroup === opt.value
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <div className="font-bold text-sm text-gray-900">{opt.label}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Exam Info - Only show when exam type and skill are selected */}
            {examType && examSkill && (() => {
              const titleSuggestion = suggestExamTitle(examType, examSkill);
              const descSuggestion = suggestExamDescription(examType, examSkill);
              const durationLabel = examSkill === "Mixed"
                ? `Tổng thời gian Full Test`
                : `Thời gian khuyến nghị cho ${examSkill}`;

              return (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Header strip */}
                <div className="px-6 py-4 bg-gradient-to-r from-orange-50 to-amber-50/40 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                      <Info className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 leading-tight">Thông tin đề thi</h3>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {examType} · {examSkill === "Mixed" ? "Full 4 kỹ năng" : examSkill} · {duration} phút
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!examTitle.trim()) setExamTitle(titleSuggestion);
                      if (!examDescription.trim()) setExamDescription(descSuggestion);
                    }}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:text-white hover:bg-orange-500 rounded-lg border border-orange-200 hover:border-orange-500 transition-all"
                    title="Tự động điền tên & mô tả"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Tự động điền
                  </button>
                </div>

                <div className="p-6 space-y-5">
              <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-800 leading-relaxed">
                <span className="font-semibold">💡 Hướng dẫn: </span>
                Đặt <b>tên đề</b> rõ ràng để học viên dễ nhận biết. <b>Mô tả</b> giúp nêu mục tiêu/nội dung ôn.
                <b> Thời gian</b> là tổng thời gian làm bài, <b>Độ khó</b> để phân loại — bấm "Tự động điền" để gợi ý nhanh tên & mô tả.
              </div>
              {/* Title */}
              <div>
                <label className="flex items-center justify-between text-sm font-semibold text-gray-700 mb-1.5">
                  <span>Tên đề thi <span className="text-red-500">*</span></span>
                  {!examTitle.trim() && titleSuggestion && (
                    <button
                      type="button"
                      onClick={() => setExamTitle(titleSuggestion)}
                      className="text-[11px] font-semibold text-orange-600 hover:text-orange-700 hover:underline"
                    >
                      Dùng "{titleSuggestion}"
                    </button>
                  )}
                </label>
                <input
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !examTitle.trim() && titleSuggestion) {
                      e.preventDefault();
                      setExamTitle(titleSuggestion);
                    }
                  }}
                  placeholder={titleSuggestion ? `VD: ${titleSuggestion}` : "VD: Đề thi Tiếng Anh - Tháng 4/2026"}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                  maxLength={255}
                />
                <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-2">
                  <span>{examTitle.length}/255 ký tự</span>
                  {!examTitle.trim() && titleSuggestion && (
                    <span className="text-orange-600 font-medium">• Ấn Enter để dùng gợi ý</span>
                  )}
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="flex items-center justify-between text-sm font-semibold text-gray-700 mb-1.5">
                  <span>Mô tả <span className="text-gray-400 font-normal">(tùy chọn)</span></span>
                  {!examDescription.trim() && descSuggestion && (
                    <button
                      type="button"
                      onClick={() => setExamDescription(descSuggestion)}
                      className="text-[11px] font-semibold text-orange-600 hover:text-orange-700 hover:underline"
                    >
                      Dùng gợi ý
                    </button>
                  )}
                </label>
                <textarea
                  value={examDescription}
                  onChange={(e) => setExamDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !examDescription.trim() && descSuggestion && !e.shiftKey) {
                      e.preventDefault();
                      setExamDescription(descSuggestion);
                    }
                  }}
                  rows={4}
                  placeholder={descSuggestion ? `VD: ${descSuggestion.slice(0, 120)}...` : "Mô tả chi tiết về đề thi..."}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none transition-all"
                  maxLength={1000}
                />
                <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-2">
                  <span>{examDescription.length}/1000 ký tự</span>
                  {!examDescription.trim() && descSuggestion && (
                    <span className="text-orange-600 font-medium">• Ấn Enter để dùng gợi ý</span>
                  )}
                </p>
              </div>

              {/* Duration */}
              <div>
                <label className="flex items-center justify-between text-sm font-semibold text-gray-700 mb-1.5">
                  <span>Thời gian làm bài <span className="text-red-500">*</span></span>
                  <span className="text-[11px] font-normal text-gray-500">{durationLabel}</span>
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 max-w-[200px]">
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                      min={1}
                      className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all tabular-nums font-semibold text-gray-900"
                    />
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <select
                    value={durationUnit}
                    onChange={(e) => setDurationUnit(e.target.value as "minutes" | "hours")}
                    className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white font-medium text-gray-700"
                  >
                    <option value="minutes">Phút</option>
                    <option value="hours">Giờ</option>
                  </select>
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Độ khó</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white font-medium text-gray-700 transition-all"
                >
                  <option value="easy">Dễ</option>
                  <option value="medium">Trung bình</option>
                  <option value="hard">Khó</option>
                  <option value="expert">Rất khó</option>
                </select>
              </div>
                </div>
              </div>
              );
            })()}

            {/* Settings - Only show when exam type and skill are selected */}
            {examType && examSkill && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
              <h3 className="text-lg font-bold text-gray-900">Cài đặt</h3>
              <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-800 leading-relaxed">
                <span className="font-semibold">💡 Hướng dẫn: </span>
                <b>Public</b> cho mọi giáo viên thấy & dùng chung; <b>Private</b> chỉ mình bạn.
                Bật <b>"Cho phép xem trước"</b> nếu muốn học viên xem cấu trúc đề trước khi bắt đầu làm.
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Hiển thị
                </label>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer p-4 border-2 rounded-lg transition-all hover:bg-gray-50">
                    <input
                      type="radio"
                      name="visibility"
                      checked={visibility === "public"}
                      onChange={() => setVisibility("public")}
                      className="mt-1 w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 font-semibold text-gray-900">
                        <Globe className="w-5 h-5 text-orange-600" />
                        Public
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Hiển thị cho tất cả giáo viên trong hệ thống
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer p-4 border-2 rounded-lg transition-all hover:bg-gray-50">
                    <input
                      type="radio"
                      name="visibility"
                      checked={visibility === "private"}
                      onChange={() => setVisibility("private")}
                      className="mt-1 w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 font-semibold text-gray-900">
                        <Lock className="w-5 h-5 text-gray-600" />
                        Private
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Chỉ mình tôi có thể xem và sử dụng</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Allow Preview */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="allowPreview"
                  checked={allowPreview}
                  onChange={(e) => setAllowPreview(e.target.checked)}
                  className="mt-1 w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
                <label htmlFor="allowPreview" className="flex-1 cursor-pointer">
                  <p className="font-semibold text-gray-900">Cho phép xem trước</p>
                  <p className="text-sm text-gray-600">
                    Học sinh có thể xem trước đề thi trước khi bắt đầu làm bài
                  </p>
                </label>
              </div>
            </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <Link
                to="/giao-vien/de-thi/tat-ca"
                className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium"
              >
                Hủy
              </Link>
              <button
                onClick={() => canProceedStep1 && handleNextStep()}
                disabled={!canProceedStep1}
                className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all ${
                  canProceedStep1
                    ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/25"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                Tiếp tục
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Questions - Non-VSTEP Mode */}
        {currentStep === 2 && !isVSTEPMode && (
          <div className="space-y-6">
            {/* Questions List */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Danh sách câu hỏi</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {totalQuestions} câu • {totalPoints} điểm
                  </p>
                </div>
                <button
                  onClick={() => setIsAddingQuestion(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-2 font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Thêm câu hỏi
                </button>
              </div>

              {isAddingQuestion && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">Chọn loại câu hỏi</h3>
                    <button
                      onClick={() => setIsAddingQuestion(false)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {questionTypes.map((type) => {
                      const Icon = type.icon;
                      return (
                        <button
                          key={type.value}
                          onClick={() => handleAddQuestion(type.value as QuestionType)}
                          className="p-4 border-2 border-gray-200 rounded-lg hover:border-orange-600 hover:bg-orange-50 transition-all text-left"
                        >
                          <Icon className="w-6 h-6 text-orange-600 mb-2" />
                          <p className="font-semibold text-gray-900">{type.label}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedQuestion && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900">
                      Câu hỏi {questions.findIndex((q) => q.id === selectedQuestion.id) + 1}
                    </h3>
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm font-semibold">
                      {questionTypes.find((t) => t.value === selectedQuestion.type)?.label}
                    </span>
                  </div>

                  {/* Question Content */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nội dung câu hỏi <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Nhập nội dung câu hỏi..."
                      value={selectedQuestion.content}
                      onChange={(e) =>
                        updateQuestionInState(selectedQuestion.id, (question) => ({
                          ...question,
                          content: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all text-sm flex items-center gap-1">
                        <ImageIcon className="w-4 h-4" />
                        Hình ảnh
                      </button>
                      {(selectedQuestion.type === "listening" ||
                        selectedQuestion.type === "speaking") && (
                        <button className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all text-sm flex items-center gap-1">
                          <Volume2 className="w-4 h-4" />
                          Audio
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Points */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Điểm</label>
                    <input
                      type="number"
                      value={selectedQuestion.points}
                      onChange={(e) =>
                        updateQuestionInState(selectedQuestion.id, (question) => ({
                          ...question,
                          points: parseInt(e.target.value || "0", 10) || 0,
                        }))
                      }
                      min={1}
                      className="w-32 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  {/* Answers Section */}
                  {(selectedQuestion.type === "multiple-choice" ||
                    selectedQuestion.type === "true-false") && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-semibold text-gray-700">Đáp án</label>
                        {selectedQuestion.type === "multiple-choice" && (
                          <button
                            onClick={() =>
                              updateQuestionInState(selectedQuestion.id, (question) => ({
                                ...question,
                                answers: [
                                  ...(question.answers || []),
                                  { id: `a-${Date.now()}`, text: "", isCorrect: false },
                                ],
                              }))
                            }
                            className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                          >
                            + Thêm đáp án
                          </button>
                        )}
                      </div>
                      <div className="space-y-3">
                        {selectedQuestion.type === "true-false" ? (
                          <>
                            <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-orange-300">
                              <input
                                type="radio"
                                name="answer"
                                checked={
                                  selectedQuestion.answers?.find((a) => a.text === "Đúng")?.isCorrect === true
                                }
                                onChange={() =>
                                  updateQuestionInState(selectedQuestion.id, (question) => ({
                                    ...question,
                                    answers: [
                                      { id: "a-true", text: "Đúng", isCorrect: true },
                                      { id: "a-false", text: "Sai", isCorrect: false },
                                    ],
                                  }))
                                }
                                className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                              />
                              <span className="font-medium text-gray-900">Đúng</span>
                            </label>
                            <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-orange-300">
                              <input
                                type="radio"
                                name="answer"
                                checked={
                                  selectedQuestion.answers?.find((a) => a.text === "Sai")?.isCorrect === true
                                }
                                onChange={() =>
                                  updateQuestionInState(selectedQuestion.id, (question) => ({
                                    ...question,
                                    answers: [
                                      { id: "a-true", text: "Đúng", isCorrect: false },
                                      { id: "a-false", text: "Sai", isCorrect: true },
                                    ],
                                  }))
                                }
                                className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                              />
                              <span className="font-medium text-gray-900">Sai</span>
                            </label>
                          </>
                        ) : (
                          selectedQuestion.answers?.map((answer, index) => (
                            <div
                              key={answer.id}
                              className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg"
                            >
                              <input
                                type="radio"
                                name="correct-answer"
                                checked={answer.isCorrect}
                                onChange={() =>
                                  updateQuestionInState(selectedQuestion.id, (question) => ({
                                    ...question,
                                    answers: (question.answers || []).map((candidate) => ({
                                      ...candidate,
                                      isCorrect: candidate.id === answer.id,
                                    })),
                                  }))
                                }
                                className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                              />
                              <input
                                type="text"
                                placeholder={`Đáp án ${String.fromCharCode(65 + index)}`}
                                value={answer.text}
                                onChange={(e) =>
                                  updateQuestionInState(selectedQuestion.id, (question) => ({
                                    ...question,
                                    answers: (question.answers || []).map((candidate) =>
                                      candidate.id === answer.id
                                        ? { ...candidate, text: e.target.value }
                                        : candidate
                                    ),
                                  }))
                                }
                                className="flex-1 px-3 py-2 border-0 focus:outline-none"
                              />
                              <button
                                onClick={() =>
                                  updateQuestionInState(selectedQuestion.id, (question) => ({
                                    ...question,
                                    answers: (question.answers || []).filter(
                                      (candidate) => candidate.id !== answer.id
                                    ),
                                  }))
                                }
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => setSelectedQuestion(null)}
                      className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
                    >
                      Hủy
                    </button>
                    <button className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all">
                      Lưu câu hỏi
                    </button>
                    <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all">
                      Lưu & Thêm tiếp
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {!isAddingQuestion && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={handlePrevStep}
                    className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium"
                  >
                    Quay lại
                  </button>
                  <button
                    onClick={handleNextStep}
                    disabled={!canProceedStep2}
                    className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all ${
                      canProceedStep2
                        ? "bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-500/30"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    Tiếp tục
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: VSTEP MODE - Special Layout */}
        {currentStep === 2 && isVSTEPMode && (
          <div 
            className={`fixed right-0 top-[180px] bottom-0 bg-gray-50 flex flex-col z-40 transition-all duration-300 ${
              isSidebarCollapsed ? 'left-20' : 'left-64'
            }`}
          >
            {/* Main Content Area with Sidebar */}
            <div className="flex-1 overflow-hidden flex">
              {/* Left: Question Navigation Grid - Redesigned with soft colors */}
              <div className="w-56 bg-white border-r-2 border-gray-200 overflow-y-auto">
                <div className="p-4 border-b-2 border-gray-100">
                  <h3 className="text-base font-semibold text-gray-900 mb-1">Điều hướng câu hỏi</h3>
                  <p className="text-xs text-gray-600">Part {vstepCurrentPart} • {VSTEP_STRUCTURE[vstepCurrentSkill].parts.find(p => p.part === vstepCurrentPart)?.questions} câu</p>
                </div>
                
                <div className="p-4">
                  {/* Question Grid - Larger buttons with softer colors */}
                  <div className="grid grid-cols-5 gap-2 mb-6">{Array.from({ length: VSTEP_STRUCTURE[vstepCurrentSkill].parts.find(p => p.part === vstepCurrentPart)?.questions || 0 }, (_, i) => {
                      const questionNumber = i + 1;
                      const question = vstepCurrentPartQuestions.find(q => q.questionNumber === questionNumber);
                      const isCompleted = question && question.content.trim() && 
                        (vstepCurrentSkill === "writing" || vstepCurrentSkill === "speaking" || 
                         question.answers?.some(a => a.isCorrect && a.text.trim()));
                      const isActive = vstepActiveQuestionNumber === questionNumber;
                      
                      // Soft color palette for grid buttons
                      const gridColors = {
                        listening: isActive ? 'bg-blue-500 text-white border-blue-500 shadow-md' : isCompleted ? 'bg-blue-50 text-blue-700 border-blue-300 hover:border-blue-400' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300 hover:bg-blue-50',
                        reading: isActive ? 'bg-emerald-500 text-white border-emerald-500 shadow-md' : isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:border-emerald-400' : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-300 hover:bg-emerald-50',
                        writing: isActive ? 'bg-amber-500 text-white border-amber-500 shadow-md' : isCompleted ? 'bg-amber-50 text-amber-700 border-amber-300 hover:border-amber-400' : 'bg-white text-gray-700 border-gray-300 hover:border-amber-300 hover:bg-amber-50',
                        speaking: isActive ? 'bg-purple-500 text-white border-purple-500 shadow-md' : isCompleted ? 'bg-purple-50 text-purple-700 border-purple-300 hover:border-purple-400' : 'bg-white text-gray-700 border-gray-300 hover:border-purple-300 hover:bg-purple-50',
                      };
                      const buttonColor = gridColors[vstepCurrentSkill];
                      
                      return (
                        <button
                          key={questionNumber}
                          onClick={() => jumpToVSTEPQuestion(questionNumber)}
                          className={`relative aspect-square min-w-0 rounded-lg border-2 font-semibold text-sm transition-all ${buttonColor}`}
                        >
                          {questionNumber}
                          {isCompleted && !isActive && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-white text-[10px] shadow-sm">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Legend - Cleaner design */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg shadow-sm ${vstepCurrentSkill === 'listening' ? 'bg-blue-500' : vstepCurrentSkill === 'reading' ? 'bg-emerald-500' : vstepCurrentSkill === 'writing' ? 'bg-amber-500' : 'bg-purple-500'}`}></div>
                      <span className="text-gray-700 font-medium">Đang chọn</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg border-2 ${vstepCurrentSkill === 'listening' ? 'bg-blue-50 border-blue-300' : vstepCurrentSkill === 'reading' ? 'bg-emerald-50 border-emerald-300' : vstepCurrentSkill === 'writing' ? 'bg-amber-50 border-amber-300' : 'bg-purple-50 border-purple-300'}`}></div>
                      <span className="text-gray-700 font-medium">Đã hoàn thành</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg border-2 bg-white border-gray-300"></div>
                      <span className="text-gray-700 font-medium">Chưa hoàn thành</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Main Content - More spacious */}
              <div className="flex-1 overflow-y-auto p-6 pb-32">
                <div className="max-w-7xl mx-auto">{/* Increased from max-w-6xl to max-w-7xl */}
                  {/* Part Info Banner - Redesigned with soft colors, no gradient */}
                  {(() => {
                    const skillData = VSTEP_STRUCTURE[vstepCurrentSkill];
                    const partInfo = skillData.parts.find((p) => p.part === vstepCurrentPart);
                    const partProgress = vstepProgress.find((p) => p.skill === vstepCurrentSkill && p.part === vstepCurrentPart);
                    const progressPercent = partProgress ? Math.round((partProgress.completed / partProgress.total) * 100) : 0;
                    
                    // Soft color palette - no gradients
                    const skillColors = {
                      listening: { 
                        bg: 'bg-blue-50', 
                        border: 'border-blue-500', 
                        text: 'text-blue-900',
                        icon: 'bg-blue-100',
                        badge: 'bg-white text-blue-700 border border-blue-200',
                        progress: 'bg-blue-500'
                      },
                      reading: { 
                        bg: 'bg-emerald-50', 
                        border: 'border-emerald-500', 
                        text: 'text-emerald-900',
                        icon: 'bg-emerald-100',
                        badge: 'bg-white text-emerald-700 border border-emerald-200',
                        progress: 'bg-emerald-500'
                      },
                      writing: { 
                        bg: 'bg-amber-50', 
                        border: 'border-amber-500', 
                        text: 'text-amber-900',
                        icon: 'bg-amber-100',
                        badge: 'bg-white text-amber-700 border border-amber-200',
                        progress: 'bg-amber-500'
                      },
                      speaking: { 
                        bg: 'bg-purple-50', 
                        border: 'border-purple-500', 
                        text: 'text-purple-900',
                        icon: 'bg-purple-100',
                        badge: 'bg-white text-purple-700 border border-purple-200',
                        progress: 'bg-purple-500'
                      },
                    };
                    const colors = skillColors[vstepCurrentSkill as keyof typeof skillColors];
                    
                    return (
                      <div className={`${colors.bg} border-l-4 ${colors.border} rounded-xl p-3 mb-3 shadow-sm`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-10 h-10 ${colors.icon} rounded-lg flex items-center justify-center text-2xl shadow-sm`}>
                              {skillData.icon}
                            </div>
                            <div>
                              <h2 className={`text-base font-bold ${colors.text}`}>
                                {skillData.name} - Part {vstepCurrentPart}
                              </h2>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`${colors.badge} px-2 py-0.5 rounded text-[10px] font-semibold`}>
                                  ⏱ {skillData.duration}p
                                </span>
                                <span className={`${colors.badge} px-2 py-0.5 rounded text-[10px] font-semibold`}>
                                  📝 {partInfo?.questions}
                                </span>
                                <span className="text-xs text-gray-600">{partInfo?.name}</span>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white rounded-lg px-3 py-2 text-center min-w-[80px] border border-gray-200 shadow-sm">
                            <div className={`text-xl font-bold ${colors.text}`}>{partProgress?.completed}<span className="text-sm opacity-60">/{partProgress?.total}</span></div>
                            <div className="text-[10px] text-gray-500 font-medium">{progressPercent}%</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Part-Level Audio Upload (for Listening only) */}
                  {vstepCurrentSkill === "listening" && vstepCurrentPartQuestions.length > 0 && (
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-8 mb-6">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-blue-500 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                          <Volume2 className="w-7 h-7" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-900 mb-2">
                            🎧 Audio cho Part {vstepCurrentPart}
                          </h3>
                          <p className="text-sm text-gray-700 mb-4">
                            {vstepCurrentPart === 1 && "1 file audio chứa 8 thông báo ngắn (Questions 1-8)"}
                            {vstepCurrentPart === 2 && "1 file audio chứa 4 đoạn hội thoại (Questions 9-20)"}
                            {vstepCurrentPart === 3 && "1 file audio chứa 3 bài giảng học thuật (Questions 21-35)"}
                          </p>
                          
                          {(() => {
                            const partKey = `${vstepCurrentSkill}-${vstepCurrentPart}`;
                            const partAudio = vstepPartAudio[partKey];
                            const isUploading = audioUploading[partKey];
                            
                            return (
                              <div className="space-y-4">
                                {/* Upload Button */}
                                {!partAudio && (
                                  <label className="cursor-pointer block">
                                    <div className="flex items-center justify-center w-full h-16 border-2 border-dashed border-blue-400 rounded-xl bg-white hover:bg-blue-50 transition-all">
                                      <input
                                        type="file"
                                        accept="audio/mp3,audio/wav,audio/m4a,audio/aac,audio/ogg"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) handlePartAudioUpload(vstepCurrentSkill, vstepCurrentPart, file);
                                        }}
                                        className="hidden"
                                      />
                                      <div className="flex items-center gap-3 text-blue-600">
                                        {isUploading ? (
                                          <>
                                            <div className="animate-spin w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full"></div>
                                            <span className="text-base font-semibold">Đang upload...</span>
                                          </>
                                        ) : (
                                          <>
                                            <Upload className="w-6 h-6" />
                                            <span className="text-base font-semibold">📁 Upload file audio cho Part {vstepCurrentPart}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </label>
                                )}
                                
                                {/* Audio Preview */}
                                {partAudio && (
                                  <div className="p-5 bg-white rounded-xl border-2 border-blue-300 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-3">
                                        <Volume2 className="w-6 h-6 text-blue-600" />
                                        <span className="text-base font-bold text-gray-800">Audio đã upload</span>
                                      </div>
                                      {partAudio.audioFileName && (
                                        <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-medium">
                                          📂 {partAudio.audioFileName}
                                        </span>
                                      )}
                                    </div>
                                    <audio 
                                      controls 
                                      className="w-full h-12 rounded-lg"
                                      preload="metadata"
                                      crossOrigin="anonymous"
                                    >
                                      <source src={partAudio.audioUrl} type="audio/mpeg" />
                                      <source src={partAudio.audioUrl} type="audio/wav" />
                                      <source src={partAudio.audioUrl} type="audio/mp4" />
                                      Trình duyệt không hỗ trợ audio player
                                    </audio>
                                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-blue-200">
                                      <button 
                                        onClick={() => {
                                          setVstepPartAudio(prev => {
                                            const newState = { ...prev };
                                            delete newState[partKey];
                                            return newState;
                                          });
                                          // Also clear from all questions
                                          vstepCurrentPartQuestions.forEach(q => {
                                            updateVSTEPQuestion(q.id, { audioUrl: '', audioFileName: '' });
                                          });
                                        }}
                                        className="text-sm text-red-600 hover:text-red-800 font-semibold flex items-center gap-1"
                                      >
                                        🗑️ Xóa audio
                                      </button>
                                      <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                                        ✅ Audio sẽ được phát cho tất cả câu hỏi trong Part này
                                      </span>
                                    </div>
                                  </div>
                                )}
                                
                                <p className="text-xs text-gray-600 flex items-center gap-2">
                                  <Info className="w-4 h-4" />
                                  Hỗ trợ: MP3, WAV, M4A, AAC, OGG • Tối đa 50MB
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Questions List - With Pagination */}
                  <div className="space-y-6">
                    {vstepCurrentPartQuestions.length === 0 ? (
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-12 text-center">
                        <div className="text-7xl mb-6">⏳</div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-3">Đang tải câu hỏi...</h3>
                        <p className="text-gray-600 mb-4 text-lg">
                          Vui lòng chờ trong giây lát
                        </p>
                        <div className="inline-flex items-center gap-2 text-sm text-gray-500">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Paginated Questions */}
                        {(() => {
                          const totalPages = Math.ceil(vstepCurrentPartQuestions.length / QUESTIONS_PER_PAGE);
                          const startIndex = (currentQuestionPage - 1) * QUESTIONS_PER_PAGE;
                          const endIndex = startIndex + QUESTIONS_PER_PAGE;
                          const currentPageQuestions = vstepCurrentPartQuestions.slice(startIndex, endIndex);
                          
                          return (
                            <>
                              {currentPageQuestions.map(renderVSTEPQuestionEditor)}
                              
                              {/* Pagination Controls - Compact */}
                              {totalPages > 1 && (
                                <div className="flex items-center justify-between bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-xl p-4 mt-8">
                                  <button
                                    onClick={() => {
                                      if (currentQuestionPage > 1) {
                                        setCurrentQuestionPage(currentQuestionPage - 1);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                      }
                                    }}
                                    disabled={currentQuestionPage === 1}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all ${
                                      currentQuestionPage === 1
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : 'bg-white text-orange-600 hover:bg-orange-100 border-2 border-orange-300 shadow-sm hover:shadow-md'
                                    }`}
                                  >
                                    <ChevronLeft className="w-5 h-5" />
                                    <span>Câu trước</span>
                                  </button>
                                  
                                  <div className="text-center">
                                    <div className="text-lg font-bold text-orange-600">
                                      Câu {startIndex + 1}-{Math.min(endIndex, vstepCurrentPartQuestions.length)} / {vstepCurrentPartQuestions.length}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      Trang {currentQuestionPage}/{totalPages}
                                    </div>
                                  </div>
                                  
                                  <button
                                    onClick={() => {
                                      if (currentQuestionPage < totalPages) {
                                        setCurrentQuestionPage(currentQuestionPage + 1);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                      }
                                    }}
                                    disabled={currentQuestionPage === totalPages}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all ${
                                      currentQuestionPage === totalPages
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : 'bg-white text-orange-600 hover:bg-orange-100 border-2 border-orange-300 shadow-sm hover:shadow-md'
                                    }`}
                                  >
                                    <span>Câu tiếp</span>
                                    <ChevronRight className="w-5 h-5" />
                                  </button>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Navigation - Redesigned with soft colors, no gradients */}
            <div 
              className={`fixed bottom-0 right-0 bg-white border-t-2 border-gray-200 shadow-lg z-50 transition-all duration-300 ${
                isSidebarCollapsed ? 'left-20' : 'left-64'
              }`}
            >
              {/* Part Tabs with Action Buttons - Single Row */}
              <div className="flex items-center justify-between gap-4 px-6 py-3 overflow-x-auto">
                {/* Part Tabs */}
                <div className="flex items-center gap-2 flex-1 overflow-x-auto">
                  {Object.entries(VSTEP_STRUCTURE)
                    .filter(([skill]) => {
                      // If examSkill is "Mixed", show all skills
                      // Otherwise, only show the selected skill
                      if (examSkill === "Mixed") return true;
                      if (!examSkill) return false;
                      return skill === examSkill.toLowerCase();
                    })
                    .map(([skill, skillData]) => {
                    // Soft color palette for tabs - no gradients
                    const skillTabColors = {
                      listening: { 
                        active: 'bg-blue-500 text-white shadow-md border-blue-500',
                        completed: 'bg-blue-50 text-blue-700 border-blue-300 hover:border-blue-400',
                        default: 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300'
                      },
                      reading: { 
                        active: 'bg-emerald-500 text-white shadow-md border-emerald-500',
                        completed: 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:border-emerald-400',
                        default: 'bg-white text-gray-700 border-gray-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
                      },
                      writing: { 
                        active: 'bg-amber-500 text-white shadow-md border-amber-500',
                        completed: 'bg-amber-50 text-amber-700 border-amber-300 hover:border-amber-400',
                        default: 'bg-white text-gray-700 border-gray-300 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300'
                      },
                      speaking: { 
                        active: 'bg-purple-500 text-white shadow-md border-purple-500',
                        completed: 'bg-purple-50 text-purple-700 border-purple-300 hover:border-purple-400',
                        default: 'bg-white text-gray-700 border-gray-300 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300'
                      },
                    };
                    const tabColors = skillTabColors[skill as keyof typeof skillTabColors];

                    return (
                      <div key={skill} className="flex items-center gap-2">
                        {/* Skill Divider */}
                        <div className="flex items-center gap-1.5 mr-1">
                          <span className="text-xl">{skillData.icon}</span>
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {skillData.name}
                          </span>
                        </div>
                        
                        {skillData.parts.map((part) => {
                          const isActive = vstepCurrentSkill === skill && vstepCurrentPart === part.part;
                          const partProgress = vstepProgress.find((p) => p.skill === skill && p.part === part.part);
                          const isCompleted = partProgress && partProgress.completed === partProgress.total;

                          return (
                            <button
                              key={`${skill}-${part.part}`}
                              onClick={() => {
                                setVstepCurrentSkill(skill as any);
                                setVstepCurrentPart(part.part);
                                setVstepActiveQuestionNumber(1);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap relative border-2 ${
                                isActive
                                  ? tabColors.active
                                  : isCompleted
                                    ? tabColors.completed
                                    : tabColors.default
                              }`}
                            >
                              <span className="relative z-10">Part {part.part}</span>
                              {isCompleted && !isActive && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-white text-[10px] shadow-sm">
                                  ✓
                                </span>
                              )}
                            </button>
                          );
                      })}
                      </div>
                    );
                  })}
                </div>

                {/* Action Buttons - Compact */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Menu button for Mixed skill */}
                  {examSkill === "Mixed" && (
                    <button
                      onClick={() => setShowVstepMenu(!showVstepMenu)}
                      className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-50 hover:border-gray-400 flex items-center gap-1.5 transition-all"
                    >
                      <Menu className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{showVstepMenu ? "Đóng" : "Menu"}</span>
                    </button>
                  )}

                  {/* Show different button based on whether at last part */}
                  {vstepCurrentPartIndex >= allVSTEPParts.length - 1 ? (
                    <button
                      onClick={handleNextStep}
                      disabled={!canProceedStep2}
                      className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Hoàn thành</span>
                    </button>
                  ) : (
                    <button
                      onClick={goToNextVSTEPPart}
                      className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <span>Tiếp tục</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Side Menu - Only show for Mixed skill */}
            {showVstepMenu && examSkill === "Mixed" && (
              <div 
                className={`fixed top-[180px] bottom-0 w-96 bg-gradient-to-br from-white to-gray-50 shadow-2xl z-50 overflow-y-auto border-r-2 border-gray-200 transition-all duration-300 ${
                  isSidebarCollapsed ? 'left-20' : 'left-64'
                }`}
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-gray-200">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">📋 Tổng quan</h3>
                      <p className="text-xs text-gray-500 mt-1">VSTEP Full Test - 4 Kỹ năng</p>
                    </div>
                    <button 
                      onClick={() => setShowVstepMenu(false)} 
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>

                  {/* Overall Progress */}
                  <div className="mb-6 p-5 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl text-white shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-sm opacity-90">Tiến độ hoàn thành</h4>
                      <span className="text-2xl">📊</span>
                    </div>
                    <p className="text-4xl font-bold mb-2">
                      {vstepProgress.reduce((sum, p) => sum + p.completed, 0)}<span className="text-xl opacity-75">/{vstepProgress.reduce((sum, p) => sum + p.total, 0)}</span>
                    </p>
                    <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-white transition-all duration-500"
                        style={{ width: `${vstepProgress.reduce((sum, p) => sum + p.total, 0) > 0 ? (vstepProgress.reduce((sum, p) => sum + p.completed, 0) / vstepProgress.reduce((sum, p) => sum + p.total, 0)) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="text-xs mt-2 opacity-90">
                      {vstepProgress.reduce((sum, p) => sum + p.total, 0) > 0 ? Math.round((vstepProgress.reduce((sum, p) => sum + p.completed, 0) / vstepProgress.reduce((sum, p) => sum + p.total, 0)) * 100) : 0}% hoàn thành
                    </p>
                  </div>

                  {/* Skills Navigation */}
                  <div className="space-y-4">
                    {Object.entries(VSTEP_STRUCTURE)
                      .filter(([skill]) => {
                        // If examSkill is "Mixed", show all skills
                        if (examSkill === "Mixed") return true;
                        // For single skill, only show that skill
                        if (examSkill === "Listening") return skill === "listening";
                        if (examSkill === "Reading") return skill === "reading";
                        if (examSkill === "Writing") return skill === "writing";
                        if (examSkill === "Speaking") return skill === "speaking";
                        return false;
                      })
                      .map(([skill, skillData]) => {
                      const skillColors = {
                        listening: { gradient: 'from-orange-500 to-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
                        reading: { gradient: 'from-green-500 to-green-600', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
                        writing: { gradient: 'from-orange-500 to-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
                        speaking: { gradient: 'from-purple-500 to-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
                      };
                      const colors = skillColors[skill as keyof typeof skillColors];
                      const skillProgress = vstepProgress.filter(p => p.skill === skill);
                      const skillCompleted = skillProgress.reduce((sum, p) => sum + p.completed, 0);
                      const skillTotal = skillProgress.reduce((sum, p) => sum + p.total, 0);
                      
                      return (
                        <div key={skill} className={`border-2 ${colors.border} rounded-2xl overflow-hidden shadow-sm`}>
                          <div className={`bg-gradient-to-r ${colors.gradient} text-white p-4`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{skillData.icon}</span>
                                <div>
                                  <h4 className="font-bold">{skillData.name}</h4>
                                  <p className="text-xs opacity-90">⏱ {skillData.duration} phút</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold">{skillCompleted}<span className="text-sm opacity-75">/{skillTotal}</span></div>
                                <div className="text-xs opacity-90">{Math.round((skillCompleted/skillTotal)*100)}%</div>
                              </div>
                            </div>
                          </div>
                          <div className={`${colors.bg} p-3 space-y-2`}>
                            {skillData.parts.map((part) => {
                              const isActive = vstepCurrentSkill === skill && vstepCurrentPart === part.part;
                              const partProgress = vstepProgress.find((p) => p.skill === skill && p.part === part.part);
                              const isPartCompleted = partProgress && partProgress.completed === partProgress.total;
                              
                              return (
                                <button
                                  key={part.part}
                                  onClick={() => {
                                    setVstepCurrentSkill(skill as any);
                                    setVstepCurrentPart(part.part);
                                    setVstepActiveQuestionNumber(1); // Reset to first question
                                    setShowVstepMenu(false);
                                  }}
                                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                    isActive 
                                      ? `bg-gradient-to-r ${colors.gradient} text-white shadow-md` 
                                      : isPartCompleted
                                        ? 'bg-white border-2 border-green-300 text-gray-700 hover:border-green-400'
                                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className={`font-bold ${isActive ? 'text-white' : colors.text}`}>
                                        Part {part.part}
                                      </span>
                                      <span className={`text-xs ${isActive ? 'text-white/80' : 'text-gray-500'}`}>
                                        {part.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-gray-600'}`}>
                                        {partProgress?.completed}/{partProgress?.total}
                                      </span>
                                      {isPartCompleted && !isActive && (
                                        <span className="text-green-500 font-bold">✓</span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Preview & Publish */}
        {currentStep === 3 && (
          <div className="space-y-6">
            {/* Exam Summary - Minimalist Design */}
            <div className="bg-white border-2 border-orange-500 rounded-lg p-5 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{examTitle || "Đề thi chưa đặt tên"}</h2>
                  {examDescription && (
                    <p className="text-sm text-gray-600 mb-3">{examDescription}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-md text-sm font-medium">
                      {examType}
                    </span>
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-md text-sm font-medium">
                      {getExamSkillLabel(examSkill)}
                    </span>
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm font-medium flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {duration} {durationUnit === "minutes" ? "phút" : "giờ"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats Grid - Compact */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-gray-600 text-xs mb-0.5">Câu hỏi</p>
                  <p className="text-2xl font-bold text-gray-900">{totalQuestions}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-gray-600 text-xs mb-0.5">Tổng điểm</p>
                  <p className="text-2xl font-bold text-gray-900">{totalPoints}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-gray-600 text-xs mb-0.5">Độ khó</p>
                  <p className="text-lg font-bold text-gray-900 capitalize">{difficulty}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-gray-600 text-xs mb-0.5">Trạng thái</p>
                  <p className="text-lg font-bold text-orange-600">Xuất bản</p>
                </div>
              </div>

              {/* VSTEP Skills Breakdown - Compact */}
              {examType === "VSTEP" && examSkill && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Chi tiết theo kỹ năng</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(() => {
                      const skillsToShow = examSkill === "Mixed" 
                        ? Object.keys(VSTEP_STRUCTURE)
                        : [examSkill.toLowerCase()];
                      
                      return skillsToShow.map((skillKey) => {
                        const skillData = VSTEP_STRUCTURE[skillKey as keyof typeof VSTEP_STRUCTURE];
                        if (!skillData) return null;
                        
                        const skillQuestions = questions.filter(q => q.skill === skillKey);
                        const skillPoints = skillQuestions.reduce((sum, q) => sum + q.points, 0);
                        
                        return (
                          <div key={skillKey} className="bg-gray-50 border border-gray-200 rounded-lg p-2.5">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-base">{skillData.icon}</span>
                              <span className="font-semibold text-xs text-gray-700">{skillData.name}</span>
                            </div>
                            <div className="text-xl font-bold text-gray-900">{skillQuestions.length}</div>
                            <div className="text-xs text-gray-500">
                              {skillData.parts.length} parts • {skillPoints} điểm
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Questions Preview */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Danh sách câu hỏi</h3>
              
              {/* Group questions by skill for VSTEP */}
              {examType === "VSTEP" && examSkill ? (
                <div className="space-y-6">
                  {/* Determine which skills to show */}
                  {(() => {
                    const skillsToShow = examSkill === "Mixed" 
                      ? Object.keys(VSTEP_STRUCTURE)
                      : [examSkill.toLowerCase()];
                    
                    return skillsToShow.map((skillKey) => {
                      const skillData = VSTEP_STRUCTURE[skillKey as keyof typeof VSTEP_STRUCTURE];
                      if (!skillData) return null;
                      
                      const skillQuestions = questions.filter(q => q.skill === skillKey);
                      if (skillQuestions.length === 0) return null;
                      
                      // Get skill colors
                      const skillColors = {
                        listening: { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-700', badge: 'bg-blue-100' },
                        reading: { bg: 'bg-emerald-50', border: 'border-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-100' },
                        writing: { bg: 'bg-amber-50', border: 'border-amber-500', text: 'text-amber-700', badge: 'bg-amber-100' },
                        speaking: { bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-700', badge: 'bg-purple-100' },
                      };
                      const colors = skillColors[skillKey as keyof typeof skillColors];
                      
                      return (
                        <div key={skillKey} className={`${colors.bg} border-l-4 ${colors.border} rounded-lg p-4`}>
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-2xl">{skillData.icon}</span>
                            <h4 className={`text-lg font-bold ${colors.text}`}>{skillData.name}</h4>
                            <span className={`ml-auto px-3 py-1 ${colors.badge} ${colors.text} rounded-lg text-sm font-semibold`}>
                              {skillQuestions.length} câu
                            </span>
                          </div>
                          
                          {/* Group by parts */}
                          {skillData.parts.map((partInfo) => {
                            const partQuestions = skillQuestions.filter(q => q.part === partInfo.part);
                            if (partQuestions.length === 0) return null;
                            
                            return (
                              <div key={partInfo.part} className="mb-4 last:mb-0">
                                <div className={`px-3 py-2 ${colors.badge} rounded-lg mb-2`}>
                                  <span className={`font-semibold ${colors.text}`}>
                                    Part {partInfo.part}: {partInfo.name}
                                  </span>
                                  <span className={`ml-2 text-sm ${colors.text} opacity-75`}>
                                    ({partQuestions.length}/{partInfo.questions} câu)
                                  </span>
                                </div>
                                
                                <div className="space-y-2 ml-4">
                                  {partQuestions.map((question, qIndex) => (
                                    <div key={question.id} className="p-3 bg-white border border-gray-200 rounded-lg">
                                      <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <span className={`px-2 py-1 ${colors.badge} ${colors.text} rounded text-xs font-semibold`}>
                                            Câu {question.questionNumber || qIndex + 1}
                                          </span>
                                          <span className="text-xs text-gray-500">
                                            {questionTypes.find((t) => t.value === question.type)?.label}
                                          </span>
                                        </div>
                                        <span className="text-sm font-semibold text-gray-900">
                                          {question.points} điểm
                                        </span>
                                      </div>
                                      <p className="text-sm text-gray-700 line-clamp-2">
                                        {question.content || "Chưa có nội dung"}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                // Non-VSTEP: Show all questions in simple list
                <div className="space-y-3">
                  {questions.map((question, index) => (
                    <div key={question.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm font-semibold">
                            Câu {index + 1}
                          </span>
                          <span className="text-sm text-gray-600">
                            {questionTypes.find((t) => t.value === question.type)?.label}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">
                          {question.points} điểm
                        </span>
                      </div>
                      <p className="text-gray-700">{question.content || "Chưa có nội dung"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Publish Options */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
              <h3 className="text-lg font-bold text-gray-900">Tùy chọn xuất bản</h3>

              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer p-4 border-2 rounded-lg transition-all hover:bg-gray-50">
                  <input
                    type="radio"
                    name="publish"
                    checked={publishOption === "now"}
                    onChange={() => setPublishOption("now")}
                    className="mt-1 w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                  />
                  <div>
                    <p className="font-semibold text-gray-900">Xuất bản ngay</p>
                    <p className="text-sm text-gray-600">Đề thi sẽ được xuất bản ngay lập tức</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-4 border-2 rounded-lg transition-all hover:bg-gray-50">
                  <input
                    type="radio"
                    name="publish"
                    checked={publishOption === "draft"}
                    onChange={() => setPublishOption("draft")}
                    className="mt-1 w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                  />
                  <div>
                    <p className="font-semibold text-gray-900">Lưu nháp</p>
                    <p className="text-sm text-gray-600">Lưu đề thi để chỉnh sửa sau</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-4 border-2 rounded-lg transition-all hover:bg-gray-50">
                  <input
                    type="radio"
                    name="publish"
                    checked={publishOption === "schedule"}
                    onChange={() => setPublishOption("schedule")}
                    className="mt-1 w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">Lên lịch xuất bản</p>
                    <p className="text-sm text-gray-600 mb-3">Chọn ngày giờ xuất bản</p>
                    {publishOption === "schedule" && (
                      <div className="flex items-center gap-3">
                        <input
                          type="datetime-local"
                          value={scheduledAt}
                          onChange={(e) => setScheduledAt(e.target.value)}
                          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {/* Notifications */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Thông báo</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyStudents}
                      onChange={(e) => setNotifyStudents(e.target.checked)}
                      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700">Thông báo cho học sinh</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyTeachers}
                      onChange={(e) => setNotifyTeachers(e.target.checked)}
                      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700">Thông báo cho giáo viên khác</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendEmail}
                      onChange={(e) => setSendEmail(e.target.checked)}
                      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700">Gửi email thông báo</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <button
                onClick={handlePrevStep}
                className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium"
              >
                Quay lại
              </button>
              <button
                onClick={() => persistExam("publish")}
                disabled={isSaving || !canSubmitExam}
                className="px-8 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg hover:from-orange-700 hover:to-orange-800 transition-all font-bold shadow-lg shadow-orange-500/50 flex items-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                Xuất bản đề thi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CreateExam;





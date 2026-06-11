import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation, useParams } from "react-router";
import { ArrowLeft, BookOpen, Headphones, PenTool, Mic, CheckCircle2, Save, FileText, Clock, ChevronRight, Loader2, Upload } from "lucide-react";
import { useToastContext } from "../../../../../contexts/ToastContext";
import { useTranslation } from "react-i18next";
import { teacherApi } from "../../../../../services/teacherApi";

// Import the 4 skill components
import { CreateVstepReading } from "./CreateVstepReading";
import { CreateVstepListening } from "./CreateVstepListening";
import { CreateVstepWriting } from "./CreateVstepWriting";
import { CreateVstepSpeaking } from "./CreateVstepSpeaking";
import { VstepImportModal } from "./VstepImportModal";

type SkillType = "reading" | "listening" | "writing" | "speaking";

interface SkillTab {
  id: SkillType;
  name: string;
  icon: any;
  color: string;
  bgColor: string;
  borderColor: string;
  hoverBg: string;
  component: any;
}

export const CreateVstepFull = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { success, error } = useToastContext();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const params = useParams();

  // Nhận title/description từ CreateExam (navigate state)
  const navState = (location.state as { title?: string; description?: string; duration?: number } | null) ?? {};

  // Step 0: basic info | Step 1: skill editing
  // Skip step 0 nếu đã có title từ CreateExam hoặc resume từ URL
  // Support both /sua/:examId (new) and ?id= (legacy)
  const urlExamId = params.examId || searchParams.get("id") || "";
  const isResuming = !!urlExamId && !urlExamId.startsWith("vstep-full-");
  const [step, setStep] = useState<0 | 1>(navState.title || isResuming ? 1 : 0);
  const [isCreating, setIsCreating] = useState(false);

  // Basic info state — pre-populate từ navigation state nếu có
  const [examTitle, setExamTitle] = useState(navState.title || "");
  const [examDescription, setExamDescription] = useState(navState.description || "");
  const [duration, setDuration] = useState(navState.duration || 172);

  const [currentSkill, setCurrentSkill] = useState<SkillType>("listening");
  const [completedSkills, setCompletedSkills] = useState<Set<SkillType>>(new Set());
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Real exam ID from API (after step 0 submit or from navigation state)
  const [realExamId, setRealExamId] = useState<string>(urlExamId || "");

  // Exam ID used in skill components
  const examId = realExamId || urlExamId || `vstep-full-${Date.now()}`;

  // Thứ tự thi VSTEP chuẩn theo Bộ Giáo dục: Listening → Reading → Writing → Speaking
  const SKILL_TABS: SkillTab[] = [
    {
      id: "listening",
      name: t('vstep.full.skills.listening'),
      icon: Headphones,
      color: "text-purple-700",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-600",
      hoverBg: "hover:bg-purple-100",
      component: CreateVstepListening,
    },
    {
      id: "reading",
      name: t('vstep.full.skills.reading'),
      icon: BookOpen,
      color: "text-blue-700",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-600",
      hoverBg: "hover:bg-blue-100",
      component: CreateVstepReading,
    },
    {
      id: "writing",
      name: t('vstep.full.skills.writing'),
      icon: PenTool,
      color: "text-emerald-700",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-600",
      hoverBg: "hover:bg-emerald-100",
      component: CreateVstepWriting,
    },
    {
      id: "speaking",
      name: t('vstep.full.skills.speaking'),
      icon: Mic,
      color: "text-orange-700",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-600",
      hoverBg: "hover:bg-orange-100",
      component: CreateVstepSpeaking,
    },
  ];

  const currentTab = SKILL_TABS.find((tab) => tab.id === currentSkill)!;
  const CurrentComponent = currentTab.component;

  // Tự động tạo exam khi nhận title từ CreateExam (navState) mà chưa có examId
  useEffect(() => {
    if (navState.title && !realExamId && !isResuming) {
      handleCreateExam();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load completed skills from API when exam ID is available
  useEffect(() => {
    const loadCompletedSkills = async () => {
      if (!examId || examId.startsWith("vstep-full-")) return;
      
      setIsLoadingProgress(true);
      try {
        // Load all skills to check which ones have data
        const skillApis = {
          listening: async () => {
            try {
              const response = await import("../../../../../services/vstepApi").then(m => m.loadVstepListeningExam(examId));
              // Listening structure: parts → sections → questions
              const hasQuestions = response.data?.parts?.some((part: any) =>
                (part.sections?.some((sec: any) => sec.questions?.length > 0))
                || (part.questions?.length > 0) // fallback for legacy/flat shape
              );
              return response.status === "success" && hasQuestions;
            } catch {
              return false;
            }
          },
          reading: async () => {
            try {
              const response = await import("../../../../../services/vstepApi").then(m => m.loadVstepExam(examId));
              // Check if any part has actual questions
              const hasQuestions = response.data?.parts?.some((part: any) => 
                part.questions && part.questions.length > 0
              );
              return response.status === "success" && hasQuestions;
            } catch {
              return false;
            }
          },
          writing: async () => {
            try {
              const response = await import("../../../../../services/vstepApi").then(m => m.loadVstepWritingExam(examId));
              // Writing uses tasks instead of parts
              return response.status === "success" && response.data?.tasks?.length > 0;
            } catch {
              return false;
            }
          },
          speaking: async () => {
            try {
              const response = await import("../../../../../services/vstepApi").then(m => m.loadVstepSpeakingExam(examId));
              // Check if any part has actual data (part1Data, part2Data, or part3Data)
              const hasData = response.data?.parts?.some((part: any) => 
                part.part1Data || part.part2Data || part.part3Data
              );
              return response.status === "success" && hasData;
            } catch {
              return false;
            }
          },
        };

        const completed = new Set<SkillType>();
        
        // Check each skill in parallel
        const results = await Promise.all([
          skillApis.listening().then(hasData => ({ skill: "listening" as SkillType, hasData })),
          skillApis.reading().then(hasData => ({ skill: "reading" as SkillType, hasData })),
          skillApis.writing().then(hasData => ({ skill: "writing" as SkillType, hasData })),
          skillApis.speaking().then(hasData => ({ skill: "speaking" as SkillType, hasData })),
        ]);

        results.forEach(({ skill, hasData }) => {
          if (hasData) {
            completed.add(skill);
          }
        });

        setCompletedSkills(completed);
        console.log("✅ Loaded completed skills:", Array.from(completed));
      } catch (err) {
        console.error("Error loading completed skills:", err);
      } finally {
        setIsLoadingProgress(false);
      }
    };

    loadCompletedSkills();
  }, [examId, reloadKey]);

  const handleCreateExam = async () => {
    if (!examTitle.trim()) return;
    setIsCreating(true);
    try {
      const res = await teacherApi.exams.create({
        eTitle: examTitle.trim(),
        eDescription: examDescription.trim() || undefined,
        eType: "VSTEP",
        eSkill: "mixed",
        eDuration_minutes: duration,
        eIs_private: false,
        eSource_type: "manual",
      } as any);
      if (res.status === "success" && res.data) {
        const id = String(res.data.eId);
        setRealExamId(id);
        // Chuyển step NGAY — không để bất kỳ tác vụ phụ nào chặn luồng
        navigate(`/giao-vien/de-thi/vstep/full/sua/${id}`, { replace: true });
        setStep(1);
        success("Đề thi đã được tạo! Bắt đầu nhập nội dung.");
        // Ghi log hoạt động — best-effort, lỗi (vd: load chunk) không được phép
        // làm hỏng việc chuyển step.
        import("../../../../../services/teacherActivityLog")
          .then(({ logTeacherActivity }) => logTeacherActivity({
            action: "exam.create",
            entity_type: "exam",
            entity_id: Number(id),
            detail: `Tạo đề thi VSTEP: ${examTitle.trim()}`,
            meta: { type: "VSTEP", skill: "mixed", duration },
          }))
          .catch(() => { /* bỏ qua lỗi ghi log */ });
      } else {
        throw new Error(res.message || "Không thể tạo đề thi");
      }
    } catch (err: any) {
      error(err.message || "Lỗi khi tạo đề thi, vui lòng thử lại.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSkillComplete = (skill: SkillType) => {
    setCompletedSkills((prev) => {
      const next = new Set([...prev, skill]);
      console.log(`✅ Skill ${skill} marked as completed. Total: ${next.size}/4`);
      success(t('vstep.full.actions.skillCompleted', { skill: skill.toUpperCase() }));
      return next;
    });
  };

  const handlePublishAll = async () => {
    if (completedSkills.size < 4) {
      error(t('vstep.full.actions.completeAll', { completed: completedSkills.size }));
      return;
    }
    try {
      success(t('vstep.full.actions.publishSuccess'));
      // Chuyển sang trang chi tiết đề thi vừa tạo
      if (realExamId && !realExamId.startsWith('vstep-full-')) {
        navigate(`/giao-vien/de-thi/${realExamId}`);
      } else {
        navigate("/giao-vien/de-thi");
      }
    } catch (err: any) {
      error(err.message || t('vstep.full.actions.publishError'));
    }
  };

  const progressPercentage = (completedSkills.size / 4) * 100;

  // ─── Step 0: Thông tin đề thi ──────────────────────────────────────────────
  if (step === 0 && !isResuming) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="px-6 h-14 flex items-center gap-2.5">
            <button
              onClick={() => navigate("/giao-vien/de-thi/tao-moi")}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer group"
              aria-label="Quay lại"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-slate-900" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-slate-800 leading-tight truncate">Tạo đề thi VSTEP Full Test</h1>
              <p className="text-[11px] text-slate-400 leading-tight">Bước 1/2 — Thông tin cơ bản</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 flex items-start justify-center px-4 py-12">
          <div className="w-full max-w-xl space-y-5">

            {/* Tổng quan VSTEP — trung tính, tinh tế */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">VSTEP B1–C1 Full Test</p>
                  <p className="mt-0.5 text-[13px] text-slate-500">Đầy đủ 4 kỹ năng theo chuẩn Bộ Giáo dục</p>
                </div>
              </div>

              {/* Trình tự 4 kỹ năng */}
              <div className="mt-5 grid grid-cols-4 gap-2">
                {SKILL_TABS.map((tab, i) => {
                  const Icon = tab.icon;
                  return (
                    <div
                      key={tab.id}
                      className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 py-3"
                    >
                      <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white">
                        <Icon className="h-4 w-4 text-slate-600" />
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-[9px] font-semibold text-white">
                          {i + 1}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium capitalize text-slate-600">{tab.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Form */}
            <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900">Thông tin đề thi</h2>
                <p className="mt-0.5 text-[13px] text-slate-400">
                  Nhập tiêu đề và thời lượng, sau đó thêm nội dung cho từng kỹ năng.
                </p>
              </div>

              {/* Tên đề thi */}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                  Tên đề thi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !examTitle.trim()) {
                      e.preventDefault();
                      setExamTitle("VSTEP B2 - Full Test");
                    }
                  }}
                  placeholder="VD: VSTEP B2 - Full Test 2026"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                  maxLength={255}
                  autoFocus
                />
                <p className="mt-1.5 text-[11px] text-slate-400">
                  {examTitle.length}/255
                  {!examTitle.trim() && <span className="ml-1.5">· Nhấn Enter để dùng gợi ý</span>}
                </p>
              </div>

              {/* Mô tả */}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                  Mô tả <span className="font-normal text-slate-400">(tùy chọn)</span>
                </label>
                <textarea
                  value={examDescription}
                  onChange={(e) => setExamDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !examDescription.trim()) {
                      e.preventDefault();
                      setExamDescription(
                        "Đề thi VSTEP B2 đầy đủ 4 kỹ năng (Listening, Reading, Writing, Speaking) theo chuẩn Bộ Giáo dục. Gồm 80 câu hỏi với thời gian làm bài 172 phút."
                      );
                    }
                  }}
                  rows={3}
                  placeholder="VD: Đề thi VSTEP B2 đầy đủ 4 kỹ năng theo chuẩn Bộ Giáo dục..."
                  className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                  maxLength={1000}
                />
                <p className="mt-1.5 text-[11px] text-slate-400">
                  {examDescription.length}/1000
                  {!examDescription.trim() && <span className="ml-1.5">· Nhấn Enter để dùng gợi ý</span>}
                </p>
              </div>

              {/* Thời gian */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  Tổng thời gian làm bài
                </label>
                <div className="flex items-center gap-2.5">
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
                    min={1}
                    max={480}
                    className="w-28 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-center text-sm font-semibold text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                  />
                  <span className="text-sm text-slate-600">phút</span>
                  <span className="text-[13px] text-slate-400">· mặc định 172 phút</span>
                </div>
              </div>

              {/* Nút submit */}
              <button
                onClick={handleCreateExam}
                disabled={!examTitle.trim() || isCreating}
                className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-colors duration-200 cursor-pointer
                  ${examTitle.trim() && !isCreating
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : "cursor-not-allowed bg-slate-100 text-slate-400"
                  }`}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tạo đề thi...
                  </>
                ) : (
                  <>
                    Bắt đầu nhập nội dung
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header - compact */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="px-6 h-14 flex items-center justify-between">
          {/* Left: Back + Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => navigate("/giao-vien/de-thi")}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-all cursor-pointer group"
              aria-label={t('vstep.full.actions.back')}
            >
              <ArrowLeft className="w-4 h-4 text-slate-600 group-hover:text-slate-900" />
            </button>
            <div className="min-w-0">
              <h1 className="text-[14px] font-bold text-slate-800 leading-tight truncate">
                {t('vstep.full.title')}
              </h1>
              <p className="text-[11px] text-slate-500 leading-tight truncate">
                {t('vstep.full.subtitle')}
              </p>
            </div>
          </div>

          {/* Right: Import + Progress Indicator */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setShowImportModal(true)}
              disabled={!realExamId || realExamId.startsWith('vstep-full-')}
              className="flex items-center gap-1.5 h-8 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[12px] font-semibold transition-all hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              title="Import nguyên đề (Listening, Reading, Writing)"
            >
              <Upload className="w-3.5 h-3.5" />
              Import đề
            </button>
            <div className="text-right">
              <p className="text-[11px] font-semibold text-slate-700 leading-tight">
                {completedSkills.size}/4 {t('vstep.full.progress.skills')}
              </p>
              <div className="w-36 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-600 transition-all duration-500 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Skill Tabs */}
        <div className="px-6">
          <div className="flex gap-0.5">
            {SKILL_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentSkill === tab.id;
              const isCompleted = completedSkills.has(tab.id);

              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentSkill(tab.id)}
                  className={`
                    relative flex items-center gap-1.5 px-4 py-2 font-medium transition-all duration-200 cursor-pointer text-[12px]
                    ${isActive
                      ? `${tab.color} ${tab.bgColor} border-b-2 ${tab.borderColor}`
                      : `text-gray-600 hover:text-gray-900 ${tab.hoverBg}`
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                  {isCompleted && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content Area - Render current skill component */}
      <div className="flex-1 overflow-hidden min-h-0">
        <CurrentComponent 
          key={`${currentSkill}-${reloadKey}`}
          examId={examId}
          onComplete={() => handleSkillComplete(currentSkill)}
          isFullTest={true}
        />
      </div>

      {/* Import Modal */}
      <VstepImportModal
        open={showImportModal}
        examId={examId}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => { success('Import đề thành công!'); setReloadKey(k => k + 1); }}
      />

      {/* Fixed Bottom Action Bar - Clean & Minimal */}
      <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-gray-200 shadow-lg z-50 transition-all duration-300">
        <div className="px-8 py-2">
          <div className="flex items-center justify-between">
            {/* Left: Progress Summary */}
            <div className="flex items-center gap-6">
              {/* Exam ID Badge */}
              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 bg-gray-100 rounded-lg">
                  <p className="text-xs text-gray-500 font-medium">{t('vstep.full.examId')}</p>
                  <p className="text-sm font-mono text-gray-900">{examId}</p>
                </div>
              </div>

              {/* Progress Summary */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {SKILL_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isCompleted = completedSkills.has(tab.id);
                    
                    return (
                      <div
                        key={tab.id}
                        className={`
                          flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                          ${isCompleted
                            ? `${tab.bgColor} ${tab.color}`
                            : "bg-gray-100 text-gray-400"
                          }
                        `}
                      >
                        <Icon className="w-4 h-4" />
                        {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                    );
                  })}
                </div>
                <div className="h-8 w-px bg-gray-300" />
                <span className="text-sm font-semibold text-gray-700">
                  {completedSkills.size}/4 {t('vstep.full.progress.completed')}
                </span>
              </div>
            </div>

            {/* Right: Publish Button */}
            <button
              onClick={handlePublishAll}
              disabled={completedSkills.size < 4}
              className={`
                flex items-center gap-2.5 px-8 py-3 rounded-lg font-semibold transition-all duration-200 cursor-pointer
                ${completedSkills.size === 4
                  ? "bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 shadow-md hover:shadow-lg"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed"
                }
              `}
            >
              <Save className="w-5 h-5" />
              <span>
                {completedSkills.size === 4
                  ? t('vstep.full.actions.publish')
                  : t('vstep.full.progress.remaining', { count: 4 - completedSkills.size })}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

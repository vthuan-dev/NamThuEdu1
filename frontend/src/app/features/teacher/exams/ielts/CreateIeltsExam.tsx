/**
 * CreateIeltsExam — Trang tạo đề thi IELTS theo concept đúng:
 *   ┌─ 1 đề = 1 SKILL duy nhất (Listening / Reading / Writing / Speaking)
 *   ├─ Có 2 chế độ chơi cho học viên: Practice (chọn sections) + Full test
 *   └─ Không có "Full 4 skills" trong 1 đề
 *
 * UX flow:
 *   1. Teacher chọn loại đề (AC/GT) ở trang trước
 *   2. Vào đây với initialSkill cụ thể
 *   3. Tab "Soạn thảo" — nhập nội dung sections
 *   4. Tab "Xem trước" — preview như học viên thấy
 *   5. Cấu hình play modes (cho phép Practice / Full test)
 *   6. Xuất bản
 *
 * Design system: Professional dashboard
 *   Primary blue #0F4C81 (IELTS official-ish), accent #3B82F6
 *   Typography Inter, spacing 4/8/16/24
 */
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import {
  ArrowLeft,
  Headphones,
  BookOpen,
  PenLine,
  Mic,
  Sparkles,
  Loader2,
  Info,
  Clock,
  Edit3,
  Eye,
  Save as SaveIcon,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { useToastContext } from "../../../../../contexts/ToastContext";
import { api } from "../../../../../services/api";
import {
  IELTS_STRUCTURE,
  type IeltsSkill,
  type IeltsTestType,
} from "./structure";
import { IeltsListeningEditor } from "./editors/IeltsListeningEditor";
import { IeltsReadingEditor } from "./editors/IeltsReadingEditor";
import { IeltsWritingEditor } from "./editors/IeltsWritingEditor";
import { IeltsSpeakingEditor } from "./editors/IeltsSpeakingEditor";
import { IeltsExamStudentPreview } from "./IeltsExamStudentPreview";
import { type PlayModeConfig } from "./components/IeltsPlayModeConfig";

// ─── Theme ────────────────────────────────────────────────────────────────
const IELTS_PRIMARY = "#0F4C81";
const IELTS_ACCENT = "#3B82F6";

// ─── Skill metadata ───────────────────────────────────────────────────────
const SKILL_META: Record<
  IeltsSkill,
  { label: string; icon: any; color: string; bg: string; sectionWord: string }
> = {
  listening: { label: "Listening", icon: Headphones, color: "#2563EB", bg: "#EFF6FF", sectionWord: "Section" },
  reading:   { label: "Reading",   icon: BookOpen,   color: "#10B981", bg: "#ECFDF5", sectionWord: "Passage" },
  writing:   { label: "Writing",   icon: PenLine,    color: "#F97316", bg: "#FFF7ED", sectionWord: "Task" },
  speaking:  { label: "Speaking",  icon: Mic,        color: "#A855F7", bg: "#FAF5FF", sectionWord: "Part" },
};

const DEFAULT_PLAY_MODE: PlayModeConfig = {
  practice_enabled: true,
  full_test_enabled: true,
  time_limit_options: [null, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75],
};

interface CreateIeltsExamProps {
  /** Skill bắt buộc — không có chế độ "full 4 skills". */
  initialSkill?: IeltsSkill;
}

type ViewTab = "edit" | "preview" | "config";

export function CreateIeltsExam({ initialSkill = "listening" }: CreateIeltsExamProps) {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const { success, error } = useToastContext();

  // Skill is FIXED for this exam — không cho switch trong UI
  const skill: IeltsSkill = initialSkill;
  const meta = SKILL_META[skill];
  const SkillIcon = meta.icon;
  const structure = IELTS_STRUCTURE[skill];

  // ── State ───────────────────────────────────────────────────────────────
  const [examId, setExamId] = useState<string | undefined>(params.examId);
  const [examTitle, setExamTitle] = useState<string>(
    (location.state as any)?.title || `IELTS Academic - ${meta.label} Practice`
  );
  const [examDescription] = useState<string>(
    (location.state as any)?.description || ""
  );
  const [testType, setTestType] = useState<IeltsTestType>("Academic");
  const [ageGroup, setAgeGroup] = useState<'kids' | 'teens' | 'adults' | 'all'>('all');
  const [skillData, setSkillData] = useState<any>(null);
  const [playMode, setPlayMode] = useState<PlayModeConfig>(DEFAULT_PLAY_MODE);
  const [activeTab, setActiveTab] = useState<ViewTab>("edit");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // Bump version để force remount editor mỗi khi skillData được thay nguyên cục
  // (sau khi load draft). Editor dùng `useState(() => initialData)` nên
  // không tự sync khi prop initialData đổi → cần key để remount.
  const [editorVersion, setEditorVersion] = useState(0);
  const [showWarnings, setShowWarnings] = useState(true);
  /**
   * Validation chỉ bật sau khi user LOAD DRAFT.
   * Khi user tự nhập thủ công từ đầu thì không spam cảnh báo trong lúc đang nhập.
   * Vẫn block xuất bản nếu thiếu dữ liệu (validate ngay khi click Publish).
   */
  const [validationEnabled, setValidationEnabled] = useState(false);

  // ── Validation ──────────────────────────────────────────────────────────
  const issues = useMemo(
    () => validateIeltsSkillData(skill, skillData),
    [skill, skillData]
  );
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const canPublish = errorCount === 0 && !!skillData;

  // Auto-refresh title khi đổi test type
  useEffect(() => {
    setExamTitle((prev) => {
      const replaced = prev
        .replace(/IELTS\s+(Academic|General(\s+Training)?)/i, `IELTS ${testType}`);
      return replaced === prev && !/IELTS/i.test(prev)
        ? `IELTS ${testType} - ${meta.label} Practice`
        : replaced;
    });
  }, [testType, meta.label]);

  // ── Total stats ─────────────────────────────────────────────────────────
  const totalDuration = structure.duration;
  const totalQuestions = structure.totalQuestions;

  // ── Auto-create draft hoặc fetch draft hiện có ─────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      // Nếu URL có examId → fetch draft data thay vì tạo mới
      if (examId) {
        try {
          const res = await api.get(`/teacher/exams/${examId}/ielts/draft`);
          const data = res.data?.data;
          if (!mounted || !data) return;
          if (data.eTitle) setExamTitle(data.eTitle);
          if (data.ielts_test_type) setTestType(data.ielts_test_type);
          if (data.age_group) setAgeGroup(data.age_group);
          // Restore skill data từ draft → editor sẽ render với initialData
          if (data.ielts_data) {
            setSkillData(data.ielts_data);
            setEditorVersion((v) => v + 1); // force remount để áp dụng data
            setValidationEnabled(true); // có data sẵn → bật validation
          }
          // Restore play modes
          const savedModes = data.ielts_config?.play_modes;
          if (savedModes && typeof savedModes === "object") {
            setPlayMode((prev) => ({ ...prev, ...savedModes }));
          }
          setHasUnsavedChanges(false);
        } catch (err) {
          console.warn("[CreateIeltsExam] failed to fetch draft:", err);
        }
        return;
      }

      // Không có examId → tạo draft mới
      try {
        const res = await api.post("/teacher/exams/ielts", {
          eTitle: examTitle,
          eDescription: examDescription,
          ielts_test_type: testType,
          ielts_skill: skill,
          eScope: "skill",
          eDifficulty: "medium",
          age_group: ageGroup,
        });
        const newId = res.data?.data?.eId || res.data?.eId;
        if (mounted && newId) setExamId(String(newId));
      } catch (err) {
        console.warn("[CreateIeltsExam] failed to create draft:", err);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save skill data (draft) ────────────────────────────────────────────
  // Editors gọi onSave từ useEffect mỗi lần state thay đổi → KHÔNG toast
  // ở đây để tránh spam. Toast chỉ hiển thị khi bấm "Lưu nháp" (backend save).
  const handleSaveSkill = (data: any) => {
    setSkillData(data);
    setHasUnsavedChanges(true);
  };

  // ── Save draft to backend ──────────────────────────────────────────────
  // Nháp = lưu tự do, không chặn dù thiếu gì. Validation chỉ áp dụng cho Xuất bản.
  const handleSaveDraft = async () => {
    if (!examId) return;
    setIsSaving(true);
    try {
      await api.put(`/teacher/exams/${examId}/ielts`, {
        eTitle: examTitle,
        eDescription: examDescription,
        ielts_test_type: testType,
        eScope: "skill",
        age_group: ageGroup,
        ielts_config: {
          test_type: testType,
          skill,
          play_modes: playMode,
        },
        ielts_data: skillData ? { [getDataKey(skill)]: extractSkillItems(skill, skillData) } : null,
      });
      setHasUnsavedChanges(false);
      if (validationEnabled && errorCount > 0) {
        success(`Đã lưu nháp · còn ${errorCount} lỗi cần sửa trước khi xuất bản`);
      } else {
        success("Đã lưu nháp");
      }
      // Sau khi lưu nháp xong → quay về danh sách đề thi
      setTimeout(() => navigate("/giao-vien/de-thi"), 600);
    } catch (err: any) {
      error(err?.response?.data?.message || "Lưu nháp thất bại");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Publish ─────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!examId) {
      error("Chưa có exam ID — không thể xuất bản");
      return;
    }
    if (!skillData) {
      error("Chưa có nội dung — vui lòng nhập đầy đủ trước khi xuất bản");
      setActiveTab("edit");
      setValidationEnabled(true);
      setShowWarnings(true);
      return;
    }
    // BLOCK publish nếu còn error
    if (errorCount > 0) {
      error(`Còn ${errorCount} lỗi cần sửa trước khi xuất bản`);
      setActiveTab("edit");
      setValidationEnabled(true);
      setShowWarnings(true);
      return;
    }
    setIsPublishing(true);
    try {
      await api.post(`/teacher/exams/${examId}/ielts/publish`, {
        ielts_test_type: testType,
        ielts_skill: skill,
        ielts_data: { [getDataKey(skill)]: extractSkillItems(skill, skillData) },
        play_modes: playMode,
      });
      // Log activity (best-effort)
      const { logTeacherActivity } = await import("../../../../../services/teacherActivityLog");
      logTeacherActivity({
        action: "exam.create",
        entity_type: "exam",
        entity_id: Number(examId),
        detail: `Xuất bản đề IELTS: ${examTitle}`,
        meta: { type: "IELTS", skill, test_type: testType },
      });
      success(`Đã xuất bản đề thi "${examTitle}" — học viên có thể làm bài ngay.`);
      setTimeout(() => navigate("/giao-vien/de-thi"), 1200);
    } catch (err: any) {
      error(err?.response?.data?.message || "Không thể xuất bản đề thi");
    } finally {
      setIsPublishing(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#F9FAFB] flex-col">
      {/* ─── Top Bar ───────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between gap-4 px-6 py-3 bg-white border-b border-gray-200 sticky top-0 z-30"
        style={{ borderTopColor: IELTS_PRIMARY, borderTopWidth: 3 }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => navigate("/giao-vien/de-thi/tao-moi")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Quay lại"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>

          <div
            className="flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0"
            style={{ background: meta.bg, color: meta.color }}
          >
            <SkillIcon className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={examTitle}
              onChange={(e) => {
                setExamTitle(e.target.value);
                setHasUnsavedChanges(true);
              }}
              className="text-base font-bold text-gray-900 bg-transparent border-0 outline-none focus:bg-blue-50 focus:px-2 rounded transition-all w-full truncate"
              placeholder="Tên đề thi..."
            />
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 flex-wrap">
              <span
                className="px-1.5 py-0.5 rounded font-bold text-white text-[10px]"
                style={{ background: IELTS_PRIMARY }}
              >
                IELTS
              </span>
              <span className="font-medium" style={{ color: meta.color }}>
                {meta.label}
              </span>
              <span className="text-gray-300">•</span>
              <span className="inline-flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {totalDuration} phút
              </span>
              <span className="text-gray-300">•</span>
              <span>{totalQuestions} câu</span>
              {hasUnsavedChanges && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="text-orange-500 font-medium inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    Chưa lưu
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Test type segmented selector */}
          <div className="hidden md:flex items-center gap-0.5 p-0.5 rounded-lg bg-gray-100">
            {(["Academic", "General Training"] as IeltsTestType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTestType(t);
                  setHasUnsavedChanges(true);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  testType === t
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t === "Academic" ? "Academic" : "General"}
              </button>
            ))}
          </div>

          {/* Age group selector */}
          <div className="hidden md:flex items-center gap-0.5 p-0.5 rounded-lg bg-gray-100" title="Nhóm học viên được phép truy cập đề thi">
            {([
              { value: 'all', label: 'Mọi nhóm' },
              { value: 'teens', label: 'Teens' },
              { value: 'adults', label: 'Adults' },
            ] as { value: typeof ageGroup; label: string }[]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setAgeGroup(opt.value);
                  setHasUnsavedChanges(true);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  ageGroup === opt.value
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving || !examId}
            title={
              validationEnabled && errorCount > 0
                ? `${errorCount} lỗi · ${warningCount} cảnh báo (vẫn lưu được)`
                : validationEnabled && warningCount > 0
                ? `${warningCount} cảnh báo (vẫn lưu được)`
                : "Lưu nháp"
            }
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm relative"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <SaveIcon className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Lưu nháp</span>
            {validationEnabled && errorCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold">
                {errorCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing || !examId || (validationEnabled && !canPublish)}
            title={
              validationEnabled && !canPublish
                ? `Còn ${errorCount} lỗi cần sửa trước khi xuất bản`
                : "Xuất bản đề thi"
            }
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm hover:shadow-md text-sm relative"
            style={{
              background:
                validationEnabled && !canPublish
                  ? "linear-gradient(135deg, #9CA3AF, #6B7280)"
                  : `linear-gradient(135deg, ${IELTS_PRIMARY}, ${IELTS_ACCENT})`,
            }}
          >
            {isPublishing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : validationEnabled && !canPublish ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Xuất bản
            {validationEnabled && errorCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {errorCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ─── View Tabs (Edit / Preview / Config) ────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 sticky top-[65px] z-20">
        <div className="flex items-center gap-1 -mb-px">
          {[
            { key: "edit" as ViewTab, label: "Soạn thảo", icon: Edit3 },
            { key: "preview" as ViewTab, label: "Xem trước (Học viên)", icon: Eye },
            // Tab "Chế độ chơi" đã ẩn — đề 1 skill dùng luôn DEFAULT_PLAY_MODE
            // (Practice + Full test đều bật). Mở lại khi cần tuỳ chỉnh play mode.
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-2 px-4 py-3 border-b-2 transition-all cursor-pointer text-sm font-semibold whitespace-nowrap"
                style={{
                  borderColor: isActive ? IELTS_PRIMARY : "transparent",
                  color: isActive ? IELTS_PRIMARY : "#6B7280",
                }}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Main Area ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {/* Info banner (only on edit tab) */}
          {activeTab === "edit" && (
            <div
              className="mb-5 p-4 rounded-xl flex items-start gap-3"
              style={{
                background: `${meta.color}0A`,
                border: `1px solid ${meta.color}22`,
              }}
            >
              <Info
                className="w-4 h-4 flex-shrink-0 mt-0.5"
                style={{ color: meta.color }}
              />
              <div className="flex-1 text-[13px]">
                <p className="font-bold mb-0.5" style={{ color: meta.color }}>
                  IELTS {testType} • {meta.label} • {totalDuration} phút •{" "}
                  {totalQuestions} {skill === "writing" ? "tasks" : "câu"} •{" "}
                  {structure.parts.length} {meta.sectionWord.toLowerCase()}
                </p>
                <p className="text-gray-600">{getSkillDescription(skill, testType)}</p>
              </div>
            </div>
          )}

          {/* ── EDIT TAB ── */}
          {activeTab === "edit" && (
            <>
              {/* Validation panel: chỉ hiện sau khi import / load draft / click Publish */}
              {validationEnabled && showWarnings && issues.length > 0 && skillData && (
                <ValidationPanel
                  issues={issues}
                  onClose={() => setShowWarnings(false)}
                />
              )}
              {validationEnabled && !showWarnings && issues.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowWarnings(true)}
                  className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                  style={{
                    color: errorCount > 0 ? "#DC2626" : "#D97706",
                    borderColor: errorCount > 0 ? "#FCA5A5" : "#FCD34D",
                  }}
                >
                  {errorCount > 0 ? <AlertCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  Hiện lại {errorCount > 0 && `${errorCount} lỗi`}
                  {errorCount > 0 && warningCount > 0 && " · "}
                  {warningCount > 0 && `${warningCount} cảnh báo`}
                </button>
              )}

              {skill === "listening" && (
                <IeltsListeningEditor
                  key={`listening-${editorVersion}`}
                  examId={examId}
                  testType={testType}
                  initialData={skillData}
                  onSave={handleSaveSkill}
                />
              )}
              {skill === "reading" && (
                <IeltsReadingEditor
                  key={`reading-${editorVersion}`}
                  examId={examId}
                  testType={testType}
                  initialData={skillData}
                  onSave={handleSaveSkill}
                />
              )}
              {skill === "writing" && (
                <IeltsWritingEditor
                  key={`writing-${editorVersion}`}
                  examId={examId}
                  testType={testType}
                  initialData={skillData}
                  onSave={handleSaveSkill}
                />
              )}
              {skill === "speaking" && (
                <IeltsSpeakingEditor
                  key={`speaking-${editorVersion}`}
                  examId={examId}
                  testType={testType}
                  initialData={skillData}
                  onSave={handleSaveSkill}
                />
              )}
            </>
          )}

          {/* ── PREVIEW TAB ── */}
          {activeTab === "preview" && (
            <IeltsExamStudentPreview
              skill={skill}
              testType={testType}
              examTitle={examTitle}
              examDescription={examDescription}
              skillData={skillData}
              playMode={playMode}
            />
          )}
        </div>
      </div>

    </div>
  );
}

// ─── Helper: skill description theo testType ───────────────────────────────
function getSkillDescription(skill: IeltsSkill, testType: IeltsTestType): string {
  const s = IELTS_STRUCTURE[skill];
  if (skill === "listening") {
    return "4 sections × 10 câu. Mỗi section dùng audio riêng, học viên nghe 1 lần khi thi thật.";
  }
  if (skill === "reading") {
    return testType === "Academic"
      ? "3 passages dài (700–1100 từ) — học thuật từ sách/tạp chí khoa học."
      : "3 sections — Section 1 (đời sống), Section 2 (workplace), Section 3 (chủ đề chung).";
  }
  if (skill === "writing") {
    return testType === "Academic"
      ? "Task 1 (≥150 từ): Mô tả chart/graph/diagram. Task 2 (≥250 từ): Essay."
      : "Task 1 (≥150 từ): Viết thư (formal/informal). Task 2 (≥250 từ): Essay.";
  }
  return `3 parts: Interview, Long turn (cue card), Discussion. Đánh giá theo ${s.assessmentCriteria?.length || 4} tiêu chí.`;
}

/** Lấy key data theo skill cho payload backend. */
function getDataKey(skill: IeltsSkill): string {
  switch (skill) {
    case "listening": return "sections";
    case "reading": return "passages";
    case "writing": return "tasks";
    case "speaking": return "parts";
  }
}

/** Extract array items từ skillData (mỗi editor có shape khác). */
function extractSkillItems(skill: IeltsSkill, data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  const key = getDataKey(skill);
  if (Array.isArray(data[key])) return data[key];
  // Fallback: tìm field array đầu tiên
  for (const v of Object.values(data)) {
    if (Array.isArray(v)) return v;
  }
  return [];
}

// ─── Validation ────────────────────────────────────────────────────────────
export interface ValidationIssue {
  /** Severity: "error" block publish, "warning" cho qua được */
  severity: "error" | "warning";
  /** Tên section/passage/task để teacher biết chỗ nào lỗi */
  location: string;
  /** Mô tả lỗi */
  message: string;
}

/** Format range of question numbers như "1-10" hoặc "1, 3, 5" hoặc "1-3, 5, 7-9" */
function formatRanges(nums: number[]): string {
  if (nums.length === 0) return "";
  const sorted = [...nums].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(", ");
}

/** Kiểm tra data có đủ để publish không. Trả về danh sách issue (đã GỘP). */
export function validateIeltsSkillData(skill: IeltsSkill, data: any): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!data) {
    issues.push({ severity: "error", location: "Tổng quát", message: "Chưa có nội dung — vui lòng nhập đề thi" });
    return issues;
  }

  if (skill === "listening") {
    const sections = data.sections || [];
    if (sections.length < 4) {
      issues.push({ severity: "error", location: "Tổng quát", message: `Cần đủ 4 sections (hiện ${sections.length})` });
    }
    sections.forEach((sec: any) => {
      const loc = `Section ${sec.sectionNumber}`;
      if (!sec.audioUrl) {
        issues.push({ severity: "error", location: loc, message: "Chưa upload file audio" });
      }
      if (!sec.transcript || !sec.transcript.trim()) {
        issues.push({ severity: "warning", location: loc, message: "Chưa có transcript (tuỳ chọn — hỗ trợ chấm điểm)" });
      }
      const qs = sec.questions || [];
      if (qs.length < 10) {
        issues.push({ severity: "error", location: loc, message: `Cần đủ 10 câu hỏi (hiện ${qs.length})` });
      }
      // Gom các câu thiếu nội dung / thiếu đáp án thành 1 issue
      const missingText: number[] = [];
      const missingMcqOptions: number[] = [];
      const missingAnswer: number[] = [];
      qs.forEach((q: any) => {
        if (!q.questionText?.trim()) missingText.push(q.questionNumber);
        if (q.questionType === "multiple-choice") {
          const opts = q.options || {};
          const filled = Object.values(opts).filter((v: any) => v && String(v).trim()).length;
          if (filled < 2) missingMcqOptions.push(q.questionNumber);
        }
        if (!q.correctAnswer || !String(q.correctAnswer).trim()) missingAnswer.push(q.questionNumber);
      });
      if (missingText.length) {
        issues.push({
          severity: "error",
          location: loc,
          message: `${missingText.length} câu thiếu nội dung (Câu ${formatRanges(missingText)})`,
        });
      }
      if (missingMcqOptions.length) {
        issues.push({
          severity: "error",
          location: loc,
          message: `${missingMcqOptions.length} câu MCQ thiếu đáp án (cần ≥ 2 lựa chọn) — Câu ${formatRanges(missingMcqOptions)}`,
        });
      }
      if (missingAnswer.length) {
        issues.push({
          severity: "error",
          location: loc,
          message: `${missingAnswer.length} câu chưa có đáp án đúng (Câu ${formatRanges(missingAnswer)})`,
        });
      }
    });
  }

  if (skill === "reading") {
    const passages = data.passages || [];
    if (passages.length < 3) {
      issues.push({ severity: "error", location: "Tổng quát", message: `Cần đủ 3 passages (hiện ${passages.length})` });
    }
    passages.forEach((p: any) => {
      const loc = `Passage ${p.passageNumber}`;
      if (!p.title?.trim()) {
        issues.push({ severity: "warning", location: loc, message: "Chưa có tiêu đề" });
      }
      if (!p.body?.trim()) {
        issues.push({ severity: "error", location: loc, message: "Chưa có nội dung bài đọc" });
      } else if ((p.wordCount || 0) < 200) {
        issues.push({ severity: "warning", location: loc, message: `Bài đọc ngắn (${p.wordCount} từ, IELTS thường 700-900 từ)` });
      }
      const qs = p.questions || [];
      if (qs.length === 0) {
        issues.push({ severity: "error", location: loc, message: "Chưa có câu hỏi nào" });
      }
      const missingText: number[] = [];
      const missingAnswer: number[] = [];
      const missingChoices: number[] = [];
      const matchingSet = [
        "matching-headings",
        "matching-information",
        "matching-features",
        "matching-sentence-endings",
      ];
      qs.forEach((q: any) => {
        if (!q.questionText?.trim()) missingText.push(q.questionNumber);
        if (!q.correctAnswer || !String(q.correctAnswer).trim()) missingAnswer.push(q.questionNumber);
        // Matching: cần định nghĩa danh sách lựa chọn dùng chung (ít nhất 2 mục có nội dung)
        if (matchingSet.includes(q.questionType)) {
          const filled = Object.values(q.options || {}).filter(
            (v: any) => v && String(v).trim()
          ).length;
          if (filled < 2) missingChoices.push(q.questionNumber);
        }
      });
      if (missingText.length) {
        issues.push({
          severity: "error",
          location: loc,
          message: `${missingText.length} câu thiếu nội dung (Câu ${formatRanges(missingText)})`,
        });
      }
      if (missingChoices.length) {
        issues.push({
          severity: "warning",
          location: loc,
          message: `${missingChoices.length} câu matching chưa có danh sách lựa chọn (Câu ${formatRanges(missingChoices)})`,
        });
      }
      if (missingAnswer.length) {
        issues.push({
          severity: "error",
          location: loc,
          message: `${missingAnswer.length} câu chưa có đáp án đúng (Câu ${formatRanges(missingAnswer)})`,
        });
      }
    });
  }

  if (skill === "writing") {
    const tasks = data.tasks || [];
    if (tasks.length < 2) {
      issues.push({ severity: "error", location: "Tổng quát", message: `Cần đủ 2 tasks (hiện ${tasks.length})` });
    }
    tasks.forEach((t: any) => {
      const loc = `Task ${t.taskNumber}`;
      if (!t.prompt?.trim()) {
        issues.push({ severity: "error", location: loc, message: "Chưa có đề bài" });
      } else if (t.prompt.trim().split(/\s+/).length < 20) {
        issues.push({ severity: "warning", location: loc, message: "Đề bài quá ngắn (< 20 từ)" });
      }
      if (t.taskNumber === 1 && ["bar", "line", "pie", "table", "process", "map"].includes(t.chartType) && !t.imageUrl) {
        issues.push({ severity: "warning", location: loc, message: `Task 1 ${t.chartType} thường cần ảnh minh hoạ` });
      }
    });
  }

  if (skill === "speaking") {
    const parts = data.parts || [];
    if (parts.length < 3) {
      issues.push({ severity: "error", location: "Tổng quát", message: `Cần đủ 3 parts (hiện ${parts.length})` });
    }
    parts.forEach((p: any) => {
      const loc = `Part ${p.partNumber}`;
      if (p.partNumber === 2) {
        if (!p.cueCard?.topic?.trim()) {
          issues.push({ severity: "error", location: loc, message: "Cue card chưa có topic" });
        }
        if (!p.cueCard?.bullets || p.cueCard.bullets.filter((b: string) => b?.trim()).length < 3) {
          issues.push({ severity: "warning", location: loc, message: "Cue card nên có ít nhất 3 bullet points" });
        }
      } else {
        const qs = (p.questions || []).filter((q: any) => q.text?.trim());
        const expected = p.partNumber === 1 ? 4 : 3;
        if (qs.length < expected) {
          issues.push({ severity: "error", location: loc, message: `Cần ít nhất ${expected} câu hỏi (hiện ${qs.length})` });
        }
      }
    });
  }

  return issues;
}

// ─── Validation Panel UI ───────────────────────────────────────────────────
function ValidationPanel({
  issues,
  onClose,
}: {
  issues: ValidationIssue[];
  onClose: () => void;
}) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const [showWarningsList, setShowWarningsList] = useState(false);

  // Group by location
  const grouped = (group: ValidationIssue[]) => {
    const map = new Map<string, ValidationIssue[]>();
    group.forEach((i) => {
      const arr = map.get(i.location) || [];
      arr.push(i);
      map.set(i.location, arr);
    });
    return Array.from(map.entries());
  };

  return (
    <div className="mb-5 space-y-3">
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-red-100/50 border-b border-red-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="font-semibold text-red-900 text-sm">
                {errors.length} lỗi cần sửa trước khi xuất bản
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-red-700 hover:underline cursor-pointer"
            >
              Ẩn
            </button>
          </div>
          <div className="divide-y divide-red-100">
            {grouped(errors).map(([loc, items]) => (
              <div key={loc} className="px-4 py-2.5">
                <div className="flex items-start gap-2">
                  <ChevronRight className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-red-900 mb-1">{loc}</p>
                    <ul className="space-y-0.5">
                      {items.map((it, idx) => (
                        <li key={idx} className="text-xs text-red-800 ml-1">
                          • {it.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowWarningsList((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-amber-100/50 border-b border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <p className="font-semibold text-amber-900 text-sm">
                {warnings.length} cảnh báo (vẫn xuất bản được)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-amber-700 font-medium">
                {showWarningsList ? "Ẩn chi tiết" : "Xem chi tiết"}
              </span>
              <ChevronRight
                className="w-4 h-4 text-amber-600 transition-transform"
                style={{ transform: showWarningsList ? "rotate(90deg)" : "rotate(0deg)" }}
              />
            </div>
          </button>
          {showWarningsList && (
            <div className="divide-y divide-amber-100">
              {grouped(warnings).map(([loc, items]) => (
                <div key={loc} className="px-4 py-2.5">
                  <div className="flex items-start gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-amber-900 mb-1">{loc}</p>
                      <ul className="space-y-0.5">
                        {items.map((it, idx) => (
                          <li key={idx} className="text-xs text-amber-800 ml-1">
                            • {it.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
              {errors.length === 0 && (
                <div className="px-4 py-2 bg-amber-50">
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-xs text-amber-700 hover:underline cursor-pointer"
                  >
                    Ẩn toàn bộ cảnh báo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CreateIeltsExam;

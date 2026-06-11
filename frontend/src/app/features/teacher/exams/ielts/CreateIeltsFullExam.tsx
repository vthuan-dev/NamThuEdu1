/**
 * CreateIeltsFullExam — Tạo đề thi IELTS Full Test (cả 4 kỹ năng).
 *
 * Pattern tham khảo: CreateVstepFull.tsx (Step 0 → Step 1 với 4 tab).
 *
 * Kiến trúc:
 *   - Backend hiện ENFORCE 1 IELTS exam = 1 skill.
 *   - Để KHÔNG đụng schema, ta tạo 4 IELTS exam riêng (mỗi skill 1 đề),
 *     nhóm chúng bằng `full_group_id` (UUID) lưu trong `ielts_config`.
 *   - Tái sử dụng nguyên 4 editor có sẵn (Listening/Reading/Writing/Speaking).
 *
 * Flow:
 *   Step 0: Nhập tiêu đề + mô tả + AC/GT + age group.
 *   Step 1: 4 tab — render đúng editor tương ứng. Mỗi skill có badge "✓"
 *           khi đã có data. Footer cố định: "Lưu nháp toàn bộ" + "Xuất bản full test".
 *   Publish: gọi /publish cho từng skill liên tiếp; điều hướng về danh sách đề.
 */
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  ArrowLeft,
  Headphones,
  BookOpen,
  PenLine,
  Mic,
  CheckCircle2,
  Save as SaveIcon,
  Loader2,
  Sparkles,
  ChevronRight,
  Clock,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "../../../../../hooks/useToast";
import { api } from "../../../../../services/api";
import { IELTS_STRUCTURE, type IeltsTestType } from "./structure";
import { IeltsListeningEditor } from "./editors/IeltsListeningEditor";
import { IeltsReadingEditor } from "./editors/IeltsReadingEditor";
import { IeltsWritingEditor } from "./editors/IeltsWritingEditor";
import { IeltsSpeakingEditor } from "./editors/IeltsSpeakingEditor";

// ─── Constants ────────────────────────────────────────────────────────────
const IELTS_PRIMARY = "#0F4C81";
const IELTS_ACCENT = "#3B82F6";

const SKILLS = ["listening", "reading", "writing", "speaking"] as const;
type IeltsSkill = (typeof SKILLS)[number];

interface SkillTabMeta {
  id: IeltsSkill;
  label: string;
  icon: any;
  color: string;
  bg: string;
  border: string;
  hoverBg: string;
}

const SKILL_TABS: SkillTabMeta[] = [
  { id: "listening", label: "Listening", icon: Headphones, color: "#2563EB", bg: "bg-blue-50",    border: "border-blue-600",    hoverBg: "hover:bg-blue-50" },
  { id: "reading",   label: "Reading",   icon: BookOpen,   color: "#10B981", bg: "bg-emerald-50", border: "border-emerald-600", hoverBg: "hover:bg-emerald-50" },
  { id: "writing",   label: "Writing",   icon: PenLine,    color: "#F97316", bg: "bg-orange-50",  border: "border-orange-600",  hoverBg: "hover:bg-orange-50" },
  { id: "speaking",  label: "Speaking",  icon: Mic,        color: "#A855F7", bg: "bg-purple-50",  border: "border-purple-600",  hoverBg: "hover:bg-purple-50" },
];

const DEFAULT_PLAY_MODE = {
  practice_enabled: true,
  full_test_enabled: true,
  time_limit_options: [null, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75] as (number | null)[],
};

// ─── Helpers ─────────────────────────────────────────────────────────────
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function genGroupId(): string {
  // Modern browsers (Chrome 92+, Firefox 95+) hỗ trợ crypto.randomUUID
  if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
    return (crypto as any).randomUUID();
  }
  return "ift-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function getDataKey(skill: IeltsSkill): string {
  switch (skill) {
    case "listening": return "sections";
    case "reading":   return "passages";
    case "writing":   return "tasks";
    case "speaking":  return "parts";
  }
}

function extractSkillItems(skill: IeltsSkill, data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  const key = getDataKey(skill);
  if (Array.isArray(data[key])) return data[key];
  for (const v of Object.values(data)) {
    if (Array.isArray(v)) return v;
  }
  return [];
}

function hasSkillContent(skill: IeltsSkill, data: any): boolean {
  const items = extractSkillItems(skill, data);
  if (items.length === 0) return false;

  // Tối thiểu phải có "thực sự" có nội dung — không chỉ skeleton trống
  return items.some((item: any) => {
    if (skill === "listening") {
      return (item?.questions?.length || 0) > 0 && item?.questions?.some((q: any) => q.questionText?.trim());
    }
    if (skill === "reading") {
      return !!(item?.body?.trim() || item?.passageText?.trim()) && (item?.questions?.length || 0) > 0;
    }
    if (skill === "writing") {
      return !!item?.prompt?.trim();
    }
    if (skill === "speaking") {
      return !!(item?.questions?.length || item?.cueCard?.topic);
    }
    return false;
  });
}

// ─── Component ───────────────────────────────────────────────────────────
export function CreateIeltsFullExam() {
  const navigate = useNavigate();
  const location = useLocation();
  const { success, error } = useToast();

  // Pre-fill từ navigation state nếu có (từ CreateExamSetup)
  const navState = (location.state as { title?: string; description?: string } | null) ?? {};

  // ── Step 0: Form inputs ──
  const [step, setStep] = useState<0 | 1>(0);
  const [title, setTitle] = useState(navState.title || "");
  const [description, setDescription] = useState(navState.description || "");
  const [testType, setTestType] = useState<IeltsTestType>("Academic");
  const [ageGroup, setAgeGroup] = useState<"kids" | "teens" | "adults" | "all">("all");

  // ── Step 1: Editing state ──
  const [groupId] = useState(genGroupId);
  const [examIds, setExamIds] = useState<Record<IeltsSkill, string>>({} as any);
  const [skillData, setSkillData] = useState<Record<IeltsSkill, any>>({} as any);
  const [activeSkill, setActiveSkill] = useState<IeltsSkill>("listening");

  // ── UI state ──
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Auto-create 4 drafts khi nhận title từ navigate state (skip step 0)
  useEffect(() => {
    if (navState.title && !Object.keys(examIds).length && step === 0) {
      handleStartCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completedSkills = useMemo(() => {
    const set = new Set<IeltsSkill>();
    SKILLS.forEach((skill) => {
      if (hasSkillContent(skill, skillData[skill])) set.add(skill);
    });
    return set;
  }, [skillData]);

  const totalDuration = useMemo(
    () => SKILLS.reduce((sum, s) => sum + IELTS_STRUCTURE[s].duration, 0),
    []
  );
  const totalQuestions = useMemo(
    () => SKILLS.reduce((sum, s) => sum + IELTS_STRUCTURE[s].totalQuestions, 0),
    []
  );

  // ── Handlers ──
  const handleStartCreate = async () => {
    if (!title.trim()) return;
    setIsCreating(true);
    try {
      // Tạo song song 4 IELTS draft
      const results = await Promise.all(
        SKILLS.map((skill) =>
          api.post("/teacher/exams/ielts", {
            eTitle: `${title.trim()} - ${capitalize(skill)}`,
            eDescription: description.trim(),
            ielts_test_type: testType,
            ielts_skill: skill,
            eDifficulty: "medium",
            age_group: ageGroup,
          })
        )
      );

      const newIds = {} as Record<IeltsSkill, string>;
      results.forEach((res, i) => {
        const id = String(res.data?.data?.eId || res.data?.eId || "");
        if (!id) throw new Error(`Không lấy được ID cho skill ${SKILLS[i]}`);
        newIds[SKILLS[i]] = id;
      });

      // Đánh dấu group_id vào 4 đề (backend sẽ merge vào ielts_config)
      await Promise.all(
        SKILLS.map((skill) =>
          api.put(`/teacher/exams/${newIds[skill]}/ielts`, {
            ielts_config: {
              full_group_id: groupId,
              full_skill: skill,
              full_test_title: title.trim(),
            },
          })
        )
      );

      setExamIds(newIds);
      setStep(1);
      success("Đã khởi tạo IELTS Full Test — bắt đầu nhập 4 kỹ năng.");
    } catch (err: any) {
      error(err?.response?.data?.message || "Không thể tạo đề thi");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveSkill = (skill: IeltsSkill, data: any) => {
    setSkillData((prev) => ({ ...prev, [skill]: data }));
  };

  const handleSaveDraftAll = async (showToast = true) => {
    if (!Object.keys(examIds).length) return;
    setIsSaving(true);
    try {
      await Promise.all(
        SKILLS.map((skill) => {
          const data = skillData[skill];
          const items = extractSkillItems(skill, data);
          return api.put(`/teacher/exams/${examIds[skill]}/ielts`, {
            eTitle: `${title.trim()} - ${capitalize(skill)}`,
            eDescription: description.trim(),
            ielts_test_type: testType,
            age_group: ageGroup,
            ielts_data: items.length > 0 ? { [getDataKey(skill)]: items } : null,
            ielts_config: {
              full_group_id: groupId,
              full_skill: skill,
              full_test_title: title.trim(),
              play_modes: DEFAULT_PLAY_MODE,
            },
          });
        })
      );
      if (showToast) success("Đã lưu nháp 4 kỹ năng");
    } catch (err: any) {
      if (showToast) error(err?.response?.data?.message || "Lưu nháp thất bại");
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishAll = async () => {
    if (completedSkills.size < 4) {
      error(`Cần hoàn thành đủ 4 kỹ năng. Hiện đã có ${completedSkills.size}/4.`);
      return;
    }
    setIsPublishing(true);
    try {
      // Lưu nháp lần cuối trước khi publish
      await handleSaveDraftAll(false);

      // Publish 4 đề lần lượt
      for (const skill of SKILLS) {
        const items = extractSkillItems(skill, skillData[skill]);
        await api.post(`/teacher/exams/${examIds[skill]}/ielts/publish`, {
          ielts_test_type: testType,
          ielts_skill: skill,
          ielts_data: { [getDataKey(skill)]: items },
          play_modes: DEFAULT_PLAY_MODE,
        });
      }

      // Best-effort: log activity
      try {
        const { logTeacherActivity } = await import("../../../../../services/teacherActivityLog");
        logTeacherActivity({
          action: "exam.create",
          entity_type: "exam",
          entity_id: Number(examIds.listening),
          detail: `Xuất bản đề IELTS Full Test: ${title}`,
          meta: { type: "IELTS_FULL", group_id: groupId, test_type: testType },
        });
      } catch {
        /* ignore */
      }

      success(`Đã xuất bản đề "${title}" — học viên có thể làm bài ngay.`);
      setTimeout(() => navigate("/giao-vien/de-thi"), 1000);
    } catch (err: any) {
      error(err?.response?.data?.message || "Xuất bản thất bại");
    } finally {
      setIsPublishing(false);
    }
  };

  // ─── Render Step 0: Nhập thông tin cơ bản ─────────────────────────
  if (step === 0) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-30" style={{ borderTopColor: IELTS_PRIMARY, borderTopWidth: 3 }}>
          <div className="px-6 h-14 flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate("/giao-vien/de-thi/tao-moi")}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Quay lại"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-slate-800 leading-tight truncate">
                Tạo đề thi IELTS Full Test
              </h1>
              <p className="text-[11px] text-slate-400 leading-tight">
                Bước 1/2 · Thông tin cơ bản
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-start justify-center px-4 py-12">
          <div className="w-full max-w-xl space-y-5">
            {/* Tổng quan IELTS Full */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-start gap-3.5">
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white"
                  style={{ background: IELTS_PRIMARY }}
                >
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">IELTS Full Test (4 kỹ năng)</p>
                  <p className="mt-0.5 text-[13px] text-slate-500">
                    Listening · Reading · Writing · Speaking — chuẩn Cambridge
                  </p>
                </div>
              </div>

              {/* 4 skill preview */}
              <div className="mt-5 grid grid-cols-4 gap-2">
                {SKILL_TABS.map((tab, i) => {
                  const Icon = tab.icon;
                  const struct = IELTS_STRUCTURE[tab.id];
                  return (
                    <div
                      key={tab.id}
                      className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 py-3"
                    >
                      <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white">
                        <Icon className="h-4 w-4" style={{ color: tab.color }} />
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-[9px] font-semibold text-white">
                          {i + 1}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-slate-700">{tab.label}</span>
                      <span className="text-[10px] text-slate-400">{struct.duration}'</span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
                <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>Tổng <strong className="text-slate-900">{totalDuration} phút</strong></span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <span><strong className="text-slate-900">{totalQuestions}</strong> câu/task</span>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900">Thông tin đề thi</h2>
                <p className="mt-0.5 text-[13px] text-slate-400">
                  Nhập tiêu đề, sau đó nhập nội dung cho từng kỹ năng ở bước tiếp theo.
                </p>
              </div>

              {/* Test type AC/GT */}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                  Phiên bản
                </label>
                <div className="flex gap-2">
                  {(["Academic", "General Training"] as IeltsTestType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTestType(t)}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
                        testType === t
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                  Tên đề thi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !title.trim()) {
                      e.preventDefault();
                      setTitle(`IELTS ${testType} - Full Test`);
                    }
                  }}
                  placeholder={`VD: IELTS ${testType} - Full Test 2026`}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                  maxLength={255}
                  autoFocus
                />
                <p className="mt-1.5 text-[11px] text-slate-400">
                  {title.length}/255
                  {!title.trim() && <span className="ml-1.5">· Nhấn Enter để dùng gợi ý</span>}
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                  Mô tả <span className="font-normal text-slate-400">(tùy chọn)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder={`VD: Đề IELTS ${testType} đầy đủ 4 kỹ năng theo chuẩn Cambridge…`}
                  className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                  maxLength={1000}
                />
                <p className="mt-1.5 text-[11px] text-slate-400">{description.length}/1000</p>
              </div>

              {/* Age group */}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                  Đối tượng học viên
                </label>
                <div className="flex gap-2">
                  {([
                    { value: "all", label: "Mọi nhóm" },
                    { value: "teens", label: "Teens" },
                    { value: "adults", label: "Adults" },
                  ] as { value: typeof ageGroup; label: string }[]).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAgeGroup(opt.value)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                        ageGroup === opt.value
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-[12px] text-amber-900">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-600" />
                <span>
                  Hệ thống sẽ tạo 4 đề con theo từng kỹ năng (Listening / Reading / Writing / Speaking),
                  liên kết bằng <strong>cùng một group ID</strong>. Học viên có thể làm full hoặc luyện
                  từng phần.
                </span>
              </div>

              {/* Submit */}
              <button
                type="button"
                onClick={handleStartCreate}
                disabled={!title.trim() || isCreating}
                className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-colors duration-200 cursor-pointer ${
                  title.trim() && !isCreating
                    ? "text-white"
                    : "cursor-not-allowed bg-slate-100 text-slate-400"
                }`}
                style={
                  title.trim() && !isCreating
                    ? { background: `linear-gradient(135deg, ${IELTS_PRIMARY}, ${IELTS_ACCENT})` }
                    : undefined
                }
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tạo 4 đề con...
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

  // ─── Render Step 1: Tab editor cho 4 skill ────────────────────────────
  const activeMeta = SKILL_TABS.find((t) => t.id === activeSkill)!;
  const activeExamId = examIds[activeSkill];
  const progressPct = (completedSkills.size / 4) * 100;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40" style={{ borderTopColor: IELTS_PRIMARY, borderTopWidth: 3 }}>
        <div className="px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => navigate("/giao-vien/de-thi")}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              aria-label="Quay lại"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600" />
            </button>
            <div className="min-w-0">
              <h1 className="text-[14px] font-bold text-slate-800 leading-tight truncate flex items-center gap-1.5">
                <span
                  className="px-1.5 py-0.5 rounded font-bold text-white text-[10px]"
                  style={{ background: IELTS_PRIMARY }}
                >
                  IELTS
                </span>
                {title || "Full Test"}
              </h1>
              <p className="text-[11px] text-slate-500 leading-tight truncate">
                {testType} · {totalDuration} phút · {totalQuestions} câu/task · 4 kỹ năng
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => handleSaveDraftAll(true)}
              disabled={isSaving}
              className="flex items-center gap-1.5 h-8 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SaveIcon className="w-3.5 h-3.5" />}
              Lưu nháp
            </button>

            <div className="text-right">
              <p className="text-[11px] font-semibold text-slate-700 leading-tight">
                {completedSkills.size}/4 kỹ năng
              </p>
              <div className="w-36 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full transition-all duration-500 ease-out"
                  style={{
                    width: `${progressPct}%`,
                    background: `linear-gradient(90deg, ${IELTS_PRIMARY}, ${IELTS_ACCENT})`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Skill tabs */}
        <div className="px-6">
          <div className="flex gap-0.5">
            {SKILL_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSkill === tab.id;
              const isCompleted = completedSkills.has(tab.id);

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSkill(tab.id)}
                  className={`relative flex items-center gap-1.5 px-4 py-2 font-medium transition-all duration-200 cursor-pointer text-[12px] ${
                    isActive ? `${tab.bg} border-b-2 ${tab.border}` : `text-slate-600 hover:text-slate-900 ${tab.hoverBg}`
                  }`}
                  style={isActive ? { color: tab.color } : undefined}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Editor area — render đúng editor theo skill đang active */}
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-6 pb-28">
        <div className="max-w-6xl mx-auto">
          {/* Banner ngữ cảnh skill hiện tại */}
          <div
            className="mb-5 p-4 rounded-xl flex items-start gap-3"
            style={{
              background: `${activeMeta.color}0A`,
              border: `1px solid ${activeMeta.color}22`,
            }}
          >
            <activeMeta.icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: activeMeta.color }} />
            <div className="flex-1 text-[13px]">
              <p className="font-bold mb-0.5" style={{ color: activeMeta.color }}>
                {activeMeta.label} · {IELTS_STRUCTURE[activeSkill].duration} phút ·{" "}
                {IELTS_STRUCTURE[activeSkill].totalQuestions}{" "}
                {activeSkill === "writing" ? "tasks" : "câu"} · {IELTS_STRUCTURE[activeSkill].parts.length} phần
              </p>
              <p className="text-slate-600">
                Đang nhập nội dung kỹ năng <strong>{activeMeta.label}</strong>. Chuyển tab để nhập kỹ năng khác.
                Hệ thống tự lưu state khi bạn gõ.
              </p>
            </div>
          </div>

          {activeSkill === "listening" && (
            <IeltsListeningEditor
              examId={activeExamId}
              testType={testType}
              initialData={skillData.listening}
              onSave={(d) => handleSaveSkill("listening", d)}
            />
          )}
          {activeSkill === "reading" && (
            <IeltsReadingEditor
              examId={activeExamId}
              testType={testType}
              initialData={skillData.reading}
              onSave={(d) => handleSaveSkill("reading", d)}
            />
          )}
          {activeSkill === "writing" && (
            <IeltsWritingEditor
              examId={activeExamId}
              testType={testType}
              initialData={skillData.writing}
              onSave={(d) => handleSaveSkill("writing", d)}
            />
          )}
          {activeSkill === "speaking" && (
            <IeltsSpeakingEditor
              examId={activeExamId}
              testType={testType}
              initialData={skillData.speaking}
              onSave={(d) => handleSaveSkill("speaking", d)}
            />
          )}
        </div>
      </div>

      {/* Fixed bottom action bar */}
      <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-slate-200 shadow-lg z-50">
        <div className="px-8 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                {SKILL_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isCompleted = completedSkills.has(tab.id);
                  return (
                    <div
                      key={tab.id}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isCompleted ? tab.bg : "bg-slate-100 text-slate-400"
                      }`}
                      style={isCompleted ? { color: tab.color } : undefined}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                      {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                  );
                })}
              </div>
              <div className="h-6 w-px bg-slate-300" />
              <span className="text-sm font-semibold text-slate-700">
                {completedSkills.size}/4 hoàn thành
              </span>
            </div>

            <button
              type="button"
              onClick={handlePublishAll}
              disabled={completedSkills.size < 4 || isPublishing}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer ${
                completedSkills.size === 4 && !isPublishing
                  ? "text-white shadow-md hover:shadow-lg"
                  : "bg-slate-200 text-slate-500 cursor-not-allowed"
              }`}
              style={
                completedSkills.size === 4 && !isPublishing
                  ? { background: `linear-gradient(135deg, ${IELTS_PRIMARY}, ${IELTS_ACCENT})` }
                  : undefined
              }
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang xuất bản...
                </>
              ) : completedSkills.size === 4 ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  Xuất bản Full Test
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Còn {4 - completedSkills.size} kỹ năng
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateIeltsFullExam;

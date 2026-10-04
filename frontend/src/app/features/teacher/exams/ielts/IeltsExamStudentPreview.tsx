/**
 * IeltsExamStudentPreview — Preview UI giống trang đề thi study4.com
 *
 * Layout:
 *   ┌─ Hero card ─────────────────────────────┐
 *   │ [tag] [tag]                              │
 *   │ Tên đề thi (h1)                          │
 *   │ [Thông tin đề thi] [Đáp án]              │
 *   │ ⏱ duration | ⓘ N parts | N câu          │
 *   │ Note màu đỏ về scaled score             │
 *   │                                          │
 *   │ Tab: [Luyện tập] [Làm full test]        │
 *   │ ─────────────────                        │
 *   │   [Pro tips banner]                      │
 *   │   ☐ Section 1 (10 câu)                  │
 *   │     [tag dạng câu hỏi]                  │
 *   │   ☐ Section 2 (10 câu)                  │
 *   │     ...                                  │
 *   │   Giới hạn thời gian: [-- --]           │
 *   │   [LUYỆN TẬP]                           │
 *   └─────────────────────────────────────────┘
 *
 * Khi không có data: hiển thị empty state cho từng tab.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Clock,
  Users,
  MessageCircle,
  Lightbulb,
  AlertCircle,
  Lock,
  Layers,
  HelpCircle,
} from "lucide-react";
import type { IeltsSkill, IeltsTestType } from "./structure";
import { IELTS_STRUCTURE } from "./structure";
import type { PlayModeConfig } from "./components/IeltsPlayModeConfig";
import { useToastContext } from "../../../../../contexts/ToastContext";

interface Props {
  skill: IeltsSkill;
  testType: IeltsTestType;
  examTitle: string;
  examDescription?: string;
  /** Skill data đã nhập từ editor — khi null, hiện empty state cho mỗi tab */
  skillData: any;
  playMode: PlayModeConfig;
  /** Khi truyền vào, 2 nút "LUYỆN TẬP" và "BẮT ĐẦU THI" sẽ mở trang demo làm bài. */
  examId?: number | string;
  /** Chế độ admin: điều hướng demo sang route /admin thay vì /giao-vien. */
  admin?: boolean;
  /**
   * Khi truyền vào, nút "LUYỆN TẬP"/"BẮT ĐẦU THI" sẽ gọi callback này
   * để render demo INLINE (không điều hướng route). Ưu tiên hơn navigate.
   */
  onStartDemo?: (selectedIndices?: number[], timeLimitMinutes?: number | null) => void;
}

type ModeTab = "practice" | "full_test";

export function IeltsExamStudentPreview({
  skill,
  testType,
  examTitle,
  skillData,
  playMode,
  examId,
  admin = false,
  onStartDemo,
}: Props) {
  const structure = IELTS_STRUCTURE[skill];
  const navigate = useNavigate();
  const toast = useToastContext();
  const [activeTab, setActiveTab] = useState<ModeTab>(
    playMode.practice_enabled ? "practice" : "full_test"
  );

  // Mở demo làm bài. Ưu tiên callback inline (onStartDemo) — tránh lỗi
  // routing khi nhúng trong iframe/modal. Fallback sang navigate khi standalone.
  const openDemoPlayer = (selectedIndices?: number[], timeLimitMinutes?: number | null) => {
    if (!examId) {
      toast.warning("Tính năng xem thử chỉ khả dụng khi mở từ trang Xem đề thi");
      return;
    }
    toast.info("🔍 Chế độ xem thử · Đáp án sẽ không được lưu");
    if (onStartDemo) {
      onStartDemo(selectedIndices, timeLimitMinutes);
      return;
    }
    const query = new URLSearchParams();
    if (selectedIndices && selectedIndices.length > 0) {
      query.set("sections", selectedIndices.map((i) => i + 1).join(","));
    }
    if (timeLimitMinutes) {
      query.set("time", String(timeLimitMinutes));
    }
    const qStr = query.toString() ? `?${query.toString()}` : "";
    navigate(
      admin
        ? `/admin/de-thi/xem/ielts/${skill}/thu/${examId}${qStr}`
        : `/giao-vien/de-thi/ielts/${skill}/thu/${examId}${qStr}`
    );
  };

  // Lấy danh sách sections từ skillData (mỗi editor có shape khác nhau)
  const sections = useMemo(() => extractSections(skill, skillData, structure), [
    skill,
    skillData,
    structure,
  ]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* ─── Preview banner ─────────────────────────────────────────── */}
      <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <p className="text-xs text-blue-700">
          <b>Đây là chế độ xem trước.</b> Học viên sẽ thấy giao diện chính xác như thế
          này khi vào trang đề thi.
        </p>
      </div>

      {/* ─── Hero card ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        {/* Tags */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Tag>#IELTS {testType}</Tag>
          <Tag>#{capitalize(skill)}</Tag>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-3 break-words">
          {examTitle || "Đề thi chưa có tên"}
        </h1>

        {/* Sub tabs (info / answers) — only display, không click */}
        <div className="flex items-center gap-2 mb-4">
          <SubTab active>Thông tin đề thi</SubTab>
          <SubTab>Đáp án/transcript</SubTab>
        </div>

        {/* Meta line */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700 mb-2">
          <Meta icon={Clock}>
            Thời gian làm bài: <b>{structure.duration} phút</b>
          </Meta>
          <span className="text-gray-300">|</span>
          <Meta icon={Layers}>
            <b>{structure.parts.length}</b> phần thi
          </Meta>
          <span className="text-gray-300">|</span>
          <Meta icon={HelpCircle}>
            <b>{structure.totalQuestions}</b> câu hỏi
          </Meta>
          <span className="text-gray-300">|</span>
          <Meta icon={MessageCircle}>0 bình luận</Meta>
        </div>
        <Meta icon={Users} className="text-sm text-gray-700 mb-3">
          0 người đã luyện tập đề thi này
        </Meta>

        {/* Note */}
        <p className="text-xs italic text-red-500 mb-5">
          Chú ý: để được quy đổi sang scaled score (ví dụ trên thang điểm 9.0 cho
          IELTS), vui lòng chọn chế độ làm <b>FULL TEST</b>.
        </p>

        {/* ─── Mode tabs ──────────────────────────────────────────── */}
        <div className="flex items-center gap-6 border-b border-gray-200 mb-5">
          <ModeTab
            active={activeTab === "practice"}
            disabled={!playMode.practice_enabled}
            onClick={() => setActiveTab("practice")}
          >
            Luyện tập
          </ModeTab>
          <ModeTab
            active={activeTab === "full_test"}
            disabled={!playMode.full_test_enabled}
            onClick={() => setActiveTab("full_test")}
          >
            Làm full test
          </ModeTab>
          <ModeTab disabled>Thảo luận</ModeTab>
        </div>

        {/* ─── Mode content ───────────────────────────────────────── */}
        {activeTab === "practice" && (
          <PracticeModeView
            sections={sections}
            timeLimitOptions={playMode.time_limit_options}
            enabled={playMode.practice_enabled}
            onStart={openDemoPlayer}
          />
        )}

        {activeTab === "full_test" && (
          <FullTestModeView
            duration={structure.duration}
            enabled={playMode.full_test_enabled}
            onStart={openDemoPlayer}
          />
        )}
      </div>
    </div>
  );
}

// ─── Practice Mode View ────────────────────────────────────────────────────
function PracticeModeView({
  sections,
  timeLimitOptions,
  enabled,
  onStart,
}: {
  sections: SectionPreview[];
  timeLimitOptions: (number | null)[];
  enabled: boolean;
  onStart?: (selectedIndices?: number[], timeLimitMinutes?: number | null) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [timeLimit, setTimeLimit] = useState<string>("");

  if (!enabled) return <DisabledMode label="Luyện tập" />;

  const toggle = (idx: number) => {
    const next = new Set(selected);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    setSelected(next);
  };

  const handleSelectAll = () => {
    if (selected.size === sections.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sections.map((_, i) => i)));
    }
  };

  const handleStart = () => {
    if (selected.size === 0) return;
    const timeNum = timeLimit === "" ? null : Number(timeLimit);
    onStart?.(Array.from(selected).sort((a, b) => a - b), timeNum);
  };

  const isAllSelected = sections.length > 0 && selected.size === sections.length;
  const isNoneSelected = selected.size === 0;

  return (
    <>
      {/* Pro tips banner */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-100 mb-5">
        <Lightbulb className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-emerald-800">
          <b>Pro tips:</b> Hình thức luyện tập từng phần và chọn mức thời gian phù
          hợp sẽ giúp bạn tập trung vào giải đúng các câu hỏi thay vì phải chịu áp
          lực hoàn thành bài thi.
        </p>
      </div>

      {/* Section list */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">
            Chọn phần thi bạn muốn làm{" "}
            <span className="text-xs font-normal text-gray-500">
              ({selected.size}/{sections.length} đã chọn)
            </span>
          </p>
          {sections.length > 1 && (
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
            >
              {isAllSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </button>
          )}
        </div>

        {sections.length === 0 ? (
          <EmptyState
            icon={AlertCircle}
            title="Chưa có phần thi nào"
            message="Vui lòng quay lại tab Soạn thảo để thêm sections cho đề này."
          />
        ) : (
          <div className="space-y-2">
            {sections.map((sec, idx) => {
              const isChecked = selected.has(idx);
              return (
                <label
                  key={idx}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                    isChecked
                      ? "border-blue-500 bg-blue-50/40 ring-1 ring-blue-200"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(idx)}
                    className="mt-1 w-4 h-4 rounded text-blue-600 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {sec.name} <span className="text-gray-500 font-normal">({sec.questionCount} câu hỏi)</span>
                    </p>
                    {sec.questionTypes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {sec.questionTypes.map((qt, i) => (
                          <span
                            key={i}
                            className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700"
                          >
                            #[{capitalize(sec.skill)}] {qt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Time limit selector */}
      {timeLimitOptions.length > 0 && (
        <div className="mb-5">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Giới hạn thời gian{" "}
            <span className="font-normal text-gray-500">
              (Để trống để làm bài không giới hạn)
            </span>
          </label>
          <select
            value={timeLimit}
            onChange={(e) => setTimeLimit(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
          >
            <option value="">-- Chọn thời gian --</option>
            {timeLimitOptions.map((opt) => (
              <option key={String(opt)} value={String(opt ?? "")}>
                {opt === null ? "Không giới hạn" : `${opt} phút`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* CTA Button & Validation Hint */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handleStart}
          disabled={isNoneSelected}
          title={isNoneSelected ? "Vui lòng chọn ít nhất 1 phần thi để luyện tập" : undefined}
          className="px-6 py-2.5 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
        >
          LUYỆN TẬP
        </button>
        {isNoneSelected && (
          <span className="text-xs text-amber-600 font-medium flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            Vui lòng chọn ít nhất 1 phần thi để bắt đầu luyện tập
          </span>
        )}
      </div>
    </>
  );
}

// ─── Full Test Mode View ───────────────────────────────────────────────────
function FullTestModeView({
  duration,
  enabled,
  onStart,
}: {
  duration: number;
  enabled: boolean;
  onStart?: () => void;
}) {
  if (!enabled) return <DisabledMode label="Làm full test" />;
  return (
    <>
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 mb-5">
        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-800">
          <b>Sẵn sàng để bắt đầu làm full test?</b> Để đạt được kết quả tốt nhất, bạn
          cần dành ra <b>{duration} phút</b> cho bài test này.
        </p>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="px-6 py-2.5 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
        title={!onStart ? "Chỉ có thể vào làm thử khi xem từ trang đề thi đã lưu" : undefined}
      >
        BẮT ĐẦU THI
      </button>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────
interface SectionPreview {
  name: string;
  skill: string;
  questionCount: number;
  questionTypes: string[];
}

function extractSections(
  skill: IeltsSkill,
  skillData: any,
  structure: any
): SectionPreview[] {
  // Khi chưa có data, return cấu trúc default từ structure
  if (!skillData) {
    return structure.parts.map((p: any) => ({
      name: skill === "listening" ? `Recording ${p.part}` : p.name,
      skill,
      questionCount: p.questions ?? 0,
      questionTypes: [],
    }));
  }

  // Listening: skillData.sections = [{ sectionNumber, audioUrl, questions: [...] }]
  if (skill === "listening") {
    const arr = skillData.sections || [];
    return arr.map((s: any, i: number) => ({
      name: `Recording ${s.sectionNumber ?? i + 1}`,
      skill: "Listening",
      questionCount: (s.questions || []).length,
      questionTypes: uniqueTypes(s.questions || []),
    }));
  }

  // Reading: skillData.passages = [{ title, body, questions }]
  if (skill === "reading") {
    const arr = skillData.passages || skillData.sections || [];
    return arr.map((p: any, i: number) => ({
      name: p.title || `Passage ${i + 1}`,
      skill: "Reading",
      questionCount: (p.questions || []).length,
      questionTypes: uniqueTypes(p.questions || []),
    }));
  }

  // Writing: skillData.tasks = [{ task, prompt }]
  if (skill === "writing") {
    const arr = skillData.tasks || [];
    return arr.map((t: any, i: number) => ({
      name: `Task ${t.task ?? i + 1}`,
      skill: "Writing",
      questionCount: 1,
      questionTypes: [t.type || (i === 0 ? "Essay/Chart" : "Essay")],
    }));
  }

  // Speaking: skillData.parts = [{ part, topics: [...] }]
  if (skill === "speaking") {
    const arr = skillData.parts || skillData.topics || [];
    return arr.map((p: any, i: number) => ({
      name: p.title || `Part ${p.part ?? i + 1}`,
      skill: "Speaking",
      questionCount: (p.questions || p.topics || []).length || 1,
      questionTypes: [],
    }));
  }

  return [];
}

function uniqueTypes(questions: any[]): string[] {
  const set = new Set<string>();
  for (const q of questions) {
    const t = q.type || q.questionType || q.question_type;
    if (t) set.add(formatType(String(t)));
  }
  return Array.from(set);
}

function formatType(t: string): string {
  return t
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Tiny UI primitives ────────────────────────────────────────────────────
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-2 py-1 rounded-md text-[11px] font-medium bg-gray-100 text-gray-700">
      {children}
    </span>
  );
}

function SubTab({
  children,
  active = false,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={`px-3 py-1.5 rounded-md text-xs font-medium ${
        active ? "bg-blue-50 text-blue-700" : "text-gray-500"
      }`}
    >
      {children}
    </span>
  );
}

function ModeTab({
  children,
  active = false,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`pb-2 text-sm font-semibold transition-all relative ${
        disabled
          ? "text-gray-300 cursor-not-allowed"
          : active
            ? "text-blue-600 cursor-pointer"
            : "text-gray-500 hover:text-gray-700 cursor-pointer"
      }`}
    >
      {children}
      {disabled && <Lock className="inline w-3 h-3 ml-1" />}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t" />
      )}
    </button>
  );
}

function Meta({
  icon: Icon,
  children,
  className = "",
}: {
  icon: any;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${className}`}>
      <Icon className="w-4 h-4 text-gray-400" />
      <span>{children}</span>
    </span>
  );
}

function EmptyState({
  icon: Icon,
  title,
  message,
}: {
  icon: any;
  title: string;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4 rounded-lg border border-dashed border-gray-300 bg-gray-50">
      <Icon className="w-8 h-8 text-gray-400 mb-2" />
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <p className="text-xs text-gray-500 mt-1 max-w-xs">{message}</p>
    </div>
  );
}

function DisabledMode({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4 rounded-lg border border-dashed border-gray-300 bg-gray-50">
      <Lock className="w-8 h-8 text-gray-400 mb-2" />
      <p className="text-sm font-semibold text-gray-700">
        Chế độ "{label}" đang tắt
      </p>
      <p className="text-xs text-gray-500 mt-1">
        Vào tab <b>Chế độ chơi</b> để bật chế độ này.
      </p>
    </div>
  );
}

import { useState, useEffect } from "react";
import { PenLine, Save, Image as ImageIcon, Upload, Sparkles, AlertCircle } from "lucide-react";
import { IELTS_STRUCTURE, type IeltsTestType } from "../structure";

interface WritingTask {
  taskNumber: 1 | 2;
  prompt: string;
  imageUrl?: string;
  imageFileName?: string;
  /** For Task 1 General: tone */
  tone?: "formal" | "semi-formal" | "informal";
  /** For Task 1 Academic: chart type */
  chartType?: "bar" | "line" | "pie" | "table" | "process" | "map";
  /** For Task 2: essay type */
  essayType?: "opinion" | "discuss" | "problem-solution" | "advantages-disadvantages";
  modelAnswer?: string;
  explanation?: string;
}

interface Props {
  examId?: string;
  testType: IeltsTestType;
  initialData?: any;
  onSave: (data: any) => void;
}

const buildEmptyTasks = (): WritingTask[] => [
  { taskNumber: 1, prompt: "", chartType: "bar", tone: "semi-formal" },
  { taskNumber: 2, prompt: "", essayType: "opinion" },
];

export function IeltsWritingEditor({ initialData, onSave, testType }: Props) {
  const [tasks, setTasks] = useState<WritingTask[]>(
    () => initialData?.tasks || buildEmptyTasks()
  );
  const [activeTask, setActiveTask] = useState<1 | 2>(1);

  const current = tasks.find((t) => t.taskNumber === activeTask)!;
  const partInfo = IELTS_STRUCTURE.writing.parts[activeTask - 1];

  const updateTask = (n: 1 | 2, patch: Partial<WritingTask>) => {
    setTasks((prev) => prev.map((t) => (t.taskNumber === n ? { ...t, ...patch } : t)));
  };

  useEffect(() => {
    onSave({ tasks });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  return (
    <div className="space-y-5">
      {/* Variant note */}
      <div className="rounded-lg bg-orange-50/50 border border-orange-200 p-3 text-xs text-orange-700">
        <strong>{testType}:</strong>{" "}
        {testType === "Academic"
          ? "Task 1: Mô tả biểu đồ/bảng/bản đồ/quy trình. Task 2: Bài luận."
          : "Task 1: Viết thư (formal/semi-formal/informal). Task 2: Bài luận."}
      </div>

      {/* Task tabs */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-gray-100">
          {tasks.map((t) => {
            const isActive = t.taskNumber === activeTask;
            const filled = t.prompt.trim().length > 20;
            return (
              <button
                key={t.taskNumber}
                type="button"
                onClick={() => setActiveTask(t.taskNumber)}
                className="px-4 py-3 text-left transition-all cursor-pointer"
                style={{
                  background: isActive ? "#FFF7ED" : "#FFFFFF",
                  borderBottom: isActive ? "3px solid #F97316" : "3px solid transparent",
                }}
              >
                <p className="text-sm font-bold" style={{ color: isActive ? "#C2410C" : "#374151" }}>
                  Task {t.taskNumber}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  ≥ {t.taskNumber === 1 ? 150 : 250} từ ·{" "}
                  {filled ? <span className="text-emerald-600 font-medium">Đã có prompt</span> : "Chưa có prompt"}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Task editor */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <PenLine className="w-4 h-4 text-orange-600" />
              {partInfo.name}
            </h3>
            <p className="text-xs text-gray-500 mt-1">{partInfo.description}</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
            ≥ {partInfo.minWords} từ · ~{partInfo.recommendedMinutes} phút
          </span>
        </div>

        {/* Task 1 specific options */}
        {activeTask === 1 && testType === "Academic" && (
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
              Loại visual
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {(["bar", "line", "pie", "table", "process", "map"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => updateTask(1, { chartType: c })}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer capitalize"
                  style={{
                    background: current.chartType === c ? "#F97316" : "#FFFFFF",
                    color: current.chartType === c ? "#FFFFFF" : "#6B7280",
                    borderColor: current.chartType === c ? "#F97316" : "#E5E7EB",
                  }}
                >
                  {c === "bar" ? "Bar chart" : c === "line" ? "Line graph" : c === "pie" ? "Pie chart" : c}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTask === 1 && testType === "General Training" && (
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
              Tone của thư
            </label>
            <div className="flex gap-2">
              {(["formal", "semi-formal", "informal"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => updateTask(1, { tone: t })}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer capitalize"
                  style={{
                    background: current.tone === t ? "#F97316" : "#FFFFFF",
                    color: current.tone === t ? "#FFFFFF" : "#6B7280",
                    borderColor: current.tone === t ? "#F97316" : "#E5E7EB",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Task 2 essay type */}
        {activeTask === 2 && (
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
              Loại bài luận
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { v: "opinion", l: "Opinion (Agree/Disagree)" },
                  { v: "discuss", l: "Discuss both views" },
                  { v: "problem-solution", l: "Problem-Solution" },
                  { v: "advantages-disadvantages", l: "Advantages-Disadvantages" },
                ] as const
              ).map((e) => (
                <button
                  key={e.v}
                  type="button"
                  onClick={() => updateTask(2, { essayType: e.v as any })}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer text-left"
                  style={{
                    background: current.essayType === e.v ? "#F97316" : "#FFFFFF",
                    color: current.essayType === e.v ? "#FFFFFF" : "#6B7280",
                    borderColor: current.essayType === e.v ? "#F97316" : "#E5E7EB",
                  }}
                >
                  {e.l}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Image upload (Task 1 Academic only) */}
        {activeTask === 1 && testType === "Academic" && (
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
              Hình ảnh visual (chart/map/process)
            </label>
            <div
              className="rounded-xl p-4 border-2 border-dashed transition-all"
              style={{
                background: current.imageUrl ? "#FFF7ED" : "#F9FAFB",
                borderColor: current.imageUrl ? "#FDBA74" : "#E5E7EB",
              }}
            >
              {current.imageUrl ? (
                <div className="space-y-2">
                  <img
                    src={current.imageUrl}
                    alt="Visual"
                    className="max-h-64 mx-auto rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => updateTask(1, { imageUrl: "", imageFileName: "" })}
                    className="text-xs text-red-600 hover:underline cursor-pointer"
                  >
                    Xoá ảnh
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-3 py-6 cursor-pointer">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">
                    Tải lên ảnh chart/map/process
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const url = URL.createObjectURL(f);
                        updateTask(1, { imageUrl: url, imageFileName: f.name });
                      }
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        )}

        {/* Prompt */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
            Đề bài (prompt)
          </label>
          <textarea
            value={current.prompt}
            onChange={(e) => updateTask(activeTask, { prompt: e.target.value })}
            placeholder={
              activeTask === 1
                ? testType === "Academic"
                  ? "VD: The chart below shows the percentage of households with internet access in 5 countries from 2000 to 2020. Summarise the information by selecting and reporting the main features..."
                  : "VD: You recently visited a friend's new house. Write a letter to thank them. In your letter:\n• thank them for their hospitality\n• comment on what you liked about the house\n• invite them to visit you"
                : "VD: Some people believe that universities should focus on academic skills. Others believe they should also teach practical skills. Discuss both views and give your opinion."
            }
            rows={6}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
          />
        </div>

        {/* Model answer (optional) */}
        <div className="mt-4">
          <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
            Bài mẫu (tuỳ chọn) <span className="text-gray-400 normal-case">— hỗ trợ AI chấm điểm</span>
          </label>
          <textarea
            value={current.modelAnswer || ""}
            onChange={(e) => updateTask(activeTask, { modelAnswer: e.target.value })}
            placeholder="Bài mẫu band 7-8 để hệ thống tham chiếu khi chấm điểm..."
            rows={4}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none font-serif leading-relaxed"
          />
        </div>

        {/* Explanation (optional) */}
        <div className="mt-4">
          <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
            Dàn ý / Giải thích đáp án (tuỳ chọn)
          </label>
          <textarea
            value={current.explanation || ""}
            onChange={(e) => updateTask(activeTask, { explanation: e.target.value })}
            placeholder="Dàn ý chi tiết hoặc giải thích đáp án..."
            rows={4}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none font-serif leading-relaxed"
          />
        </div>
      </div>

      {/* Assessment criteria reminder */}
      <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <h4 className="text-sm font-bold text-amber-900">4 tiêu chí chấm điểm IELTS Writing</h4>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {IELTS_STRUCTURE.writing.assessmentCriteria?.map((c) => (
            <div
              key={c}
              className="px-3 py-2 bg-white rounded-md border border-amber-200 text-amber-800 font-medium"
            >
              {c}
            </div>
          ))}
        </div>
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-end bg-white rounded-2xl border border-gray-200 p-4 sticky bottom-0">
        <button
          type="button"
          onClick={() => onSave({ tasks })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          Lưu Writing
        </button>
      </div>
    </div>
  );
}

export default IeltsWritingEditor;

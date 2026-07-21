import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router";
import { ArrowLeft, Save, PenTool, FileText, CheckCircle2 } from "lucide-react";
import { useToastContext } from "../../../../../contexts/ToastContext";
import { useTranslation } from "react-i18next";
import { QuillEditor } from "../../../../../components/ui/QuillEditor";
import { saveVstepWritingTask, publishVstepWritingExam, loadVstepWritingExam } from "../../../../../services/vstepApi";

interface WritingTask {
  taskNumber: 1 | 2;
  taskName: string;
  prompt: string;
  wordCount: [number, number];
  timeLimit: number;
  explanation?: string;
}

const VSTEP_WRITING_TASKS = [
  { task: 1, name: "Task 1 - Email/Letter", description: "vstep.writing.tasks.1.description", wordCount: [150, 150] as [number, number], timeLimit: 20 },
  { task: 2, name: "Task 2 - Essay", description: "vstep.writing.tasks.2.description", wordCount: [250, 250] as [number, number], timeLimit: 40 },
];

interface CreateVstepWritingProps {
  examId?: string;
  onComplete?: () => void;
  isFullTest?: boolean;
}

export const CreateVstepWriting = ({ examId: propExamId, onComplete, isFullTest = false }: CreateVstepWritingProps = {}) => {
  const navigate = useNavigate();
  const { success, error } = useToastContext();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams();
  const urlExamId = params.examId || searchParams.get("id");

  const initialExamId = propExamId || urlExamId || `vstep-writing-${Date.now()}`;
  const [examId, setExamId] = useState<string>(initialExamId);
  const [examTitle, setExamTitle] = useState<string>(t('vstep.writing.title'));
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingTask, setSavingTask] = useState<number | null>(null);
  const [currentTask, setCurrentTask] = useState<1 | 2>(1);
  const [savedTasks, setSavedTasks] = useState<Set<number>>(new Set());
  
  const [tasks, setTasks] = useState<WritingTask[]>(
    VSTEP_WRITING_TASKS.map((t) => ({
      taskNumber: t.task as 1 | 2,
      taskName: t.name,
      prompt: "",
      wordCount: t.wordCount,
      timeLimit: t.timeLimit,
    }))
  );

  const currentTaskData = tasks.find((t) => t.taskNumber === currentTask)!;

  useEffect(() => {
    // Priority: propExamId (from Full Test) > URL param > generate new
    const effectiveExamId = propExamId || urlExamId;
    
    if (effectiveExamId) {
      // Update examId state if different
      if (effectiveExamId !== examId) {
        setExamId(effectiveExamId);
      }
      
      // Update URL if not in Full Test mode and URL doesn't have ID (skip if on /sua/:examId route)
      if (!isFullTest && !params.examId && !searchParams.get("id")) {
        setSearchParams({ id: effectiveExamId }, { replace: true });
      }
      
      // Load exam data from API
      console.log("Loading existing exam:", effectiveExamId, "isFullTest:", isFullTest);
      setIsLoading(true);
      loadVstepWritingExam(effectiveExamId)
        .then((response) => {
          if (response.status === "success" && response.data) {
            const examData = response.data;
            setExamTitle(examData.title);
            
            const loadedTasks = examData.tasks.map((task: any) => ({
              taskNumber: task.taskNumber as 1 | 2,
              taskName: task.taskName,
              prompt: task.prompt,
              wordCount: task.wordCount || VSTEP_WRITING_TASKS[task.taskNumber - 1].wordCount,
              timeLimit: task.timeLimit || VSTEP_WRITING_TASKS[task.taskNumber - 1].timeLimit,
              explanation: task.explanation || "",
            }));
            
            setTasks((prev) =>
              prev.map((t) => {
                const loaded = loadedTasks.find((lt: any) => lt.taskNumber === t.taskNumber);
                return loaded || t;
              })
            );

            // Mark tasks already saved (have prompt)
            const newSaved = new Set<number>();
            examData.tasks.forEach((task: any) => {
              if (task.prompt?.trim()) {
                newSaved.add(task.taskNumber);
              }
            });
            setSavedTasks(newSaved);
            
            console.log("✅ Loaded tasks:", loadedTasks.length);
            success(t('vstep.writing.toast.loadSuccess'));
          }
        })
        .catch((err) => {
          console.log("Exam not found or error loading, starting fresh:", err);
        })
        .finally(() => setIsLoading(false));
    } else if (!isFullTest) {
      // No ID anywhere and not in Full Test, add generated ID to URL
      setSearchParams({ id: examId }, { replace: true });
    }
  }, [propExamId]); // Re-run when propExamId changes (important for Full Test)

  const updatePrompt = (content: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.taskNumber === currentTask ? { ...t, prompt: content } : t
      )
    );
  };

  const updateExplanation = (content: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.taskNumber === currentTask ? { ...t, explanation: content } : t
      )
    );
  };

  const handleSaveTask = async (taskNumber: 1 | 2) => {
    const task = tasks.find(t => t.taskNumber === taskNumber);
    if (!task) return;

    if (!task.prompt.trim()) {
      error(t('vstep.writing.toast.noPrompt', { task: taskNumber }));
      return;
    }

    setSavingTask(taskNumber);
    
    try {
      const taskData = {
        taskNumber: task.taskNumber,
        taskName: task.taskName,
        prompt: task.prompt,
        wordCount: task.wordCount,
        timeLimit: task.timeLimit,
        explanation: task.explanation || "",
      };

      await saveVstepWritingTask(examId, taskNumber, taskData);
      success(t('vstep.writing.toast.saveTaskSuccess', { task: taskNumber }));

      // Mark task as saved
      setSavedTasks((prev) => {
        const next = new Set(prev);
        next.add(taskNumber);
        return next;
      });

      // Notify Full Test parent khi lưu thành công
      if (isFullTest && onComplete) {
        onComplete();
      }
    } catch (err: any) {
      error(err.response?.data?.message || t('vstep.writing.toast.saveTaskError', { task: taskNumber }));
    } finally {
      setSavingTask(null);
    }
  };

  const handleSave = async () => {
    // Cho phép xuất bản đề chỉ với 1 task (giáo viên có thể chỉ dạy 1 dạng).
    // Chỉ gửi các task đã nhập prompt; bỏ qua task để trống.
    const filledTasks = tasks.filter((task) => task.prompt.trim());
    if (filledTasks.length === 0) {
      error(t('vstep.writing.toast.missingPrompt', { task: 1 }));
      return;
    }

    setIsSaving(true);
    try {
      const examData = {
        title: examTitle,
        tasks: filledTasks.map(task => ({
          taskNumber: task.taskNumber,
          taskName: task.taskName,
          prompt: task.prompt,
        })),
      };

      await publishVstepWritingExam(examId, examData);
      success(t('vstep.writing.toast.publishSuccess'));
      
      setTimeout(() => {
        navigate("/giao-vien/luyen-tap");
      }, 1500);
    } catch (err: any) {
      error(err.response?.data?.message || t('vstep.writing.toast.publishError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`bg-gray-50 flex flex-col ${isFullTest ? 'h-full' : 'h-screen overflow-hidden'}`}>
      {!isFullTest && (
        <div className="bg-white border-b border-gray-200 flex-shrink-0 z-10">
          <div className="max-w-[1800px] mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate("/giao-vien/de-thi")}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    className="text-2xl font-bold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 -ml-2"
                    placeholder={t('vstep.writing.title')}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {t('vstep.writing.subtitle')}
                    <span className="ml-2 text-xs text-green-600 font-medium">• {t('vstep.writing.examIdLabel')}: {examId}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={isSaving || isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? t('vstep.writing.actions.publishing') : t('vstep.writing.actions.publish')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="max-w-[1800px] mx-auto px-6">
          <div className="flex gap-2 overflow-x-auto">
            {VSTEP_WRITING_TASKS.map((task) => {
              const taskData = tasks.find((t) => t.taskNumber === task.task)!;
              const hasPrompt = taskData.prompt.trim().length > 0;
              const isSaved = savedTasks.has(task.task);

              return (
                <button
                  key={task.task}
                  onClick={() => setCurrentTask(task.task as 1 | 2)}
                  className={`flex items-center gap-3 px-6 py-4 border-b-2 transition-colors whitespace-nowrap ${
                    currentTask === task.task
                      ? "border-blue-600 text-blue-600 bg-blue-50"
                      : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <PenTool className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-semibold">Task {task.task} - {t(task.description)}</div>
                    <div className="text-xs text-gray-500">
                      {task.wordCount[0]} {t('vstep.writing.taskTab.words')} • {task.timeLimit} {t('vstep.writing.taskTab.minutes')}
                    </div>
                  </div>
                  {isSaved ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : hasPrompt ? (
                    <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">{t('vstep.writing.loading')}</p>
            </div>
          </div>
        ) : (
          <div className="max-w-[1600px] mx-auto px-6 py-6 min-h-full">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden min-h-[600px]">
              <div className="p-4 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-gray-900">
                      Task {currentTask} - {t('vstep.writing.prompt.title')}
                    </h2>
                  </div>
                  
                  <button
                    onClick={() => handleSaveTask(currentTask)}
                    disabled={savingTask === currentTask || !currentTaskData.prompt.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingTask === currentTask ? t('vstep.writing.actions.saving') : t('vstep.writing.actions.saveTask')}
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {t(VSTEP_WRITING_TASKS[currentTask - 1].description)} • 
                  {t('vstep.writing.prompt.requirement', { words: currentTaskData.wordCount[0] })} • 
                  {t('vstep.writing.prompt.time', { minutes: currentTaskData.timeLimit })}
                </p>
              </div>
              
              <div className="flex-1 p-4 overflow-hidden">
                <div className="h-full vstep-writing-editor">
                  <QuillEditor
                    value={currentTaskData.prompt}
                    onChange={updatePrompt}
                    theme="snow"
                    placeholder={t('vstep.writing.prompt.placeholder')}
                    modules={{
                      toolbar: [
                        [{ header: [1, 2, 3, false] }],
                        ["bold", "italic", "underline"],
                        [{ list: "ordered" }, { list: "bullet" }],
                        ["link"],
                        ["clean"],
                      ],
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Explanation Editor */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden mt-6 min-h-[300px]">
              <div className="p-4 border-b border-gray-200 flex-shrink-0 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Dàn ý / Giải thích đáp án (Tuỳ chọn)
                </h2>
              </div>
              <div className="flex-1 p-4 overflow-hidden">
                <div className="h-full vstep-writing-editor">
                  <QuillEditor
                    value={currentTaskData.explanation || ""}
                    onChange={updateExplanation}
                    theme="snow"
                    placeholder="Nhập dàn ý chi tiết, từ vựng khuyên dùng, hoặc bài mẫu..."
                    modules={{
                      toolbar: [
                        [{ header: [1, 2, 3, false] }],
                        ["bold", "italic", "underline"],
                        [{ list: "ordered" }, { list: "bullet" }],
                        ["link"],
                        ["clean"],
                      ],
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

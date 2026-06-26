/**
 * KidsGradingDetail — trang chấm điểm dành riêng cho đề Kids
 * (Cambridge Young Learners: STARTERS / MOVERS / FLYERS).
 *
 * Khác với khung VSTEP fallback cũ:
 *  - Phân loại theo TASK TYPE (không ép vào 4 skill listening/reading/writing/speaking).
 *  - Dạng khách quan: chấm sẵn bằng buildReviewRows, mỗi ô có toggle Đúng/Sai cho
 *    giáo viên lật tay; điểm task = tỉ lệ ô đúng × điểm tối đa.
 *  - Dạng chấm tay (MANUAL_REVIEW_TYPES): hiện bài làm + ô nhập điểm + nhận xét.
 *  - Lưu qua gradingApi.teacherGrade theo từng answerId (backend không đổi).
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router";
import {
  ChevronLeft,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  ListChecks,
  FileText,
  Eye,
  Award,
  Sparkles,
  Star,
  ChevronDown,
  Image as ImageIcon,
} from "lucide-react";
import { api } from "../../../../services/api";
import { gradingApi } from "../../../../services/gradingApi";
import { usePageTitle } from "../../../../hooks/usePageTitle";
import { useToastContext } from "../../../../contexts/ToastContext";
import {
  buildReviewRows,
  MANUAL_REVIEW_TYPES,
  type ReviewRow,
} from "../../student/kids/player/kidsAnswerKey";
import { KidsTaskRenderer } from "../../student/kids/player/KidsTaskRenderer";

// Các dạng có ảnh / nối ảnh / audio → mặc định MỞ panel "Bài làm của học viên".
// Dạng thuần chữ (cloze, open_cloze...) mặc định THU cho gọn.
const VISUAL_TASK_TYPES = new Set<string>([
  "listen_and_draw_lines",
  "listening_letter_match",
  "odd_one_out",
  "unscramble_words",
  "picture_sentence_writing",
  "picture_story_writing",
  ...MANUAL_REVIEW_TYPES,
]);

// ─── Types ───────────────────────────────────────────────────────────────────
interface KidsTask {
  id: string;
  answerId: number;
  number: number;
  taskType: string;
  taskName?: string;
  taskData: any;
  instructions?: string;
  studentAnswerRaw: any;
  points: number;          // điểm hiện tại (teacher → 0)
  maxPoints: number;
  feedback: string;
  isManual: boolean;
  skill: string;           // listening | reading | writing | speaking | ""
}

interface ExamMeta {
  title: string;
  type: string;            // STARTERS | MOVERS | FLYERS
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function parseAnswerMap(raw: any): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === "object") {
    const out: Record<string, string> = {};
    for (const k of Object.keys(raw)) out[k] = String(raw[k] ?? "");
    return out;
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return {};
    try {
      const parsed = JSON.parse(s);
      if (parsed && typeof parsed === "object") {
        const out: Record<string, string> = {};
        for (const k of Object.keys(parsed)) out[k] = String(parsed[k] ?? "");
        return out;
      }
    } catch {
      /* không phải JSON → coi như 1 câu trả lời tự do */
    }
    return { "0": s };
  }
  return {};
}

const LEVEL_META: Record<string, { label: string; color: string; bg: string }> = {
  STARTERS: { label: "Starters", color: "#0EA5E9", bg: "#E0F2FE" },
  MOVERS:   { label: "Movers",   color: "#0D9488", bg: "#CCFBF1" },
  FLYERS:   { label: "Flyers",   color: "#7C3AED", bg: "#EDE9FE" },
};

// Nhãn + thứ tự hiển thị các kỹ năng (part). Task không có skill rơi vào "other".
const SKILL_META: Record<string, { label: string; icon: string }> = {
  listening: { label: "Nghe",  icon: "🎧" },
  reading:   { label: "Đọc",   icon: "📖" },
  writing:   { label: "Viết",  icon: "✍️" },
  speaking:  { label: "Nói",   icon: "🗣️" },
  other:     { label: "Khác",  icon: "📝" },
};
const SKILL_ORDER = ["listening", "reading", "writing", "speaking", "other"];
function normalizeSkill(raw: string): string {
  const s = (raw ?? "").toString().toLowerCase().trim();
  return SKILL_META[s] ? s : "other";
}

// Tính điểm task theo tỉ lệ ô đúng × điểm tối đa, làm tròn 0.5.
function scoreFromRows(correctCount: number, total: number, maxPoints: number): number {
  if (total <= 0) return 0;
  const raw = (correctCount / total) * maxPoints;
  return Math.round(raw * 2) / 2;
}

// ─── Main component ──────────────────────────────────────────────────────────
export function KidsGradingDetail() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const toast = useToastContext();
  usePageTitle("Chấm điểm Kids");

  const [pageLoading, setPageLoading] = useState(true);
  const [exam, setExam] = useState<ExamMeta>({ title: "—", type: "" });
  const [studentName, setStudentName] = useState<string>("");
  const [className, setClassName] = useState<string>("");
  const [attemptNumber, setAttemptNumber] = useState<number>(1);
  const [examId, setExamId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<KidsTask[]>([]);
  const [overallFeedback, setOverallFeedback] = useState("");
  const [savingAnswerIds, setSavingAnswerIds] = useState<Record<number, boolean>>({});
  const [saveLoading, setSaveLoading] = useState(false);

  // Override correctness per cell: taskId → boolean[] (theo thứ tự rows)
  const [cellCorrect, setCellCorrect] = useState<Record<string, boolean[]>>({});

  // Kỹ năng (part) đang chọn trên thanh tab. "all" = xem tất cả.
  const [activeSkill, setActiveSkill] = useState<string>("all");

  // ── Load submission ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!submissionId) return;
    setPageLoading(true);
    api.get(`/teacher/submissions/${submissionId}`)
      .then((res: any) => {
        const d = res?.data?.data ?? res?.data;
        if (!d) return;

        setExam({ title: d.exam?.eTitle ?? "—", type: String(d.exam?.eType ?? "").toUpperCase() });
        setExamId(d.exam?.eId ?? d.exam_id ?? null);
        if (d.user?.uName) setStudentName(d.user.uName);
        if (d.user?.class?.cName) setClassName(d.user.class.cName);
        if (d.sAttempt) setAttemptNumber(Number(d.sAttempt));
        if (d.sTeacher_feedback) setOverallFeedback(String(d.sTeacher_feedback));

        // Map kids_task_config theo qId
        const kidsConfigMap: Record<number, any> = {};
        for (const eq of (d.exam?.questions ?? [])) {
          if (eq.kids_task_config) kidsConfigMap[eq.qId] = eq.kids_task_config;
        }

        const mapped: KidsTask[] = (d.answers ?? []).map((sa: any, idx: number) => {
          const q = sa.question ?? {};
          const cfg = kidsConfigMap[q.qId] ?? q.kids_task_config ?? {};
          const taskType = cfg.task_type ?? "";
          const maxPoints = Number(q.qPoints ?? q.qScore ?? 1) || 1;
          return {
            id: String(q.qId ?? sa.saId ?? idx),
            answerId: Number(sa.saId),
            number: idx + 1,
            taskType,
            taskName: cfg.task_name,
            taskData: cfg.task_data,
            instructions: cfg.instructions,
            studentAnswerRaw: sa.saAnswer_text ?? "",
            points: Number(sa.saPoints_awarded ?? 0),
            maxPoints,
            feedback: sa.saTeacher_feedback ?? "",
            isManual: MANUAL_REVIEW_TYPES.has(taskType),
            skill: normalizeSkill(cfg.skill),
          } satisfies KidsTask;
        });
        setTasks(mapped);

        // Khởi tạo cellCorrect từ buildReviewRows cho dạng khách quan
        const initCorrect: Record<string, boolean[]> = {};
        for (const t of mapped) {
          if (t.isManual) continue;
          try {
            const rows = buildReviewRows(t.taskType, t.taskData, parseAnswerMap(t.studentAnswerRaw) as any);
            if (rows.length > 0) initCorrect[t.id] = rows.map((r) => r.isCorrect);
          } catch { /* ignore */ }
        }
        setCellCorrect(initCorrect);
      })
      .catch((err: any) => {
        toast.error(err?.response?.data?.message || "Không tải được bài chấm điểm.");
      })
      .finally(() => setPageLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  // ── Tính điểm tổng (live) ────────────────────────────────────────────────
  const totals = useMemo(() => {
    let earned = 0;
    let max = 0;
    for (const t of tasks) {
      max += t.maxPoints;
      earned += t.points;
    }
    return { earned: Math.round(earned * 100) / 100, max };
  }, [tasks]);

  // ── Gom nhóm theo kỹ năng (part) để dựng thanh tab điều hướng ─────────────
  const skillGroups = useMemo(() => {
    // skill → { tasks, earned, max }
    const map: Record<string, { tasks: KidsTask[]; earned: number; max: number }> = {};
    for (const t of tasks) {
      const sk = t.skill || "other";
      if (!map[sk]) map[sk] = { tasks: [], earned: 0, max: 0 };
      map[sk].tasks.push(t);
      map[sk].earned += t.points;
      map[sk].max += t.maxPoints;
    }
    // Trả về theo thứ tự cố định, chỉ giữ skill có task.
    return SKILL_ORDER.filter((sk) => map[sk]?.tasks.length).map((sk) => ({
      skill: sk,
      label: SKILL_META[sk]?.label ?? sk,
      icon: SKILL_META[sk]?.icon ?? "📝",
      tasks: map[sk].tasks,
      earned: Math.round(map[sk].earned * 100) / 100,
      max: map[sk].max,
    }));
  }, [tasks]);

  // Chỉ hiện tab khi có từ 2 nhóm kỹ năng trở lên.
  const showSkillTabs = skillGroups.length > 1;

  // Danh sách task hiển thị theo tab đang chọn.
  const visibleTasks = useMemo(() => {
    if (!showSkillTabs || activeSkill === "all") return tasks;
    return tasks.filter((t) => (t.skill || "other") === activeSkill);
  }, [tasks, activeSkill, showSkillTabs]);

  // ── Lật Đúng/Sai 1 ô của task khách quan ──────────────────────────────────
  const toggleCell = async (task: KidsTask, rowIndex: number, correct: boolean) => {
    const prevArr = cellCorrect[task.id] ?? [];
    const nextArr = [...prevArr];
    nextArr[rowIndex] = correct;
    const correctCount = nextArr.filter(Boolean).length;
    const newScore = scoreFromRows(correctCount, nextArr.length, task.maxPoints);

    // Cập nhật lạc quan
    setCellCorrect((p) => ({ ...p, [task.id]: nextArr }));
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, points: newScore } : t)));

    try {
      setSavingAnswerIds((p) => ({ ...p, [task.answerId]: true }));
      await gradingApi.teacherGrade(Number(submissionId), task.answerId, {
        score: newScore,
        feedback: task.feedback,
      });
    } catch (err: any) {
      toast.error("Lỗi lưu: " + (err?.response?.data?.message ?? err?.message));
      // Hoàn tác
      setCellCorrect((p) => ({ ...p, [task.id]: prevArr }));
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, points: task.points } : t)));
    } finally {
      setSavingAnswerIds((p) => ({ ...p, [task.answerId]: false }));
    }
  };

  // ── Cập nhật điểm/nhận xét cho task chấm tay (local) ──────────────────────
  const setManualPoints = (taskId: string, pts: number) =>
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, points: pts } : t)));
  const setTaskFeedback = (taskId: string, fb: string) =>
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, feedback: fb } : t)));

  // ── Lưu 1 task (manual) ────────────────────────────────────────────────────
  const saveTask = async (task: KidsTask) => {
    try {
      setSavingAnswerIds((p) => ({ ...p, [task.answerId]: true }));
      await gradingApi.teacherGrade(Number(submissionId), task.answerId, {
        score: task.points,
        feedback: task.feedback,
      });
      toast.success(`Câu ${task.number}: đã lưu`);
    } catch (err: any) {
      toast.error("Lỗi: " + (err?.response?.data?.message ?? err?.message));
    } finally {
      setSavingAnswerIds((p) => ({ ...p, [task.answerId]: false }));
    }
  };

  // ── Lưu tất cả + nhận xét chung ────────────────────────────────────────────
  const handleSaveAll = async () => {
    if (!submissionId) return;
    setSaveLoading(true);
    try {
      // Lưu lần lượt các task (đảm bảo điểm + nhận xét mới nhất)
      for (const t of tasks) {
        await gradingApi.teacherGrade(Number(submissionId), t.answerId, {
          score: t.points,
          feedback: t.feedback,
        });
      }
      await gradingApi.saveAll(Number(submissionId), { sTeacher_feedback: overallFeedback });
      toast.success("Đã lưu kết quả chấm điểm.");
    } catch (err: any) {
      toast.error("Lỗi: " + (err?.response?.data?.message ?? err?.message));
    } finally {
      setSaveLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  const level = LEVEL_META[exam.type] ?? { label: exam.type || "Kids", color: "#0D9488", bg: "#CCFBF1" };
  const pct = totals.max > 0 ? Math.round((totals.earned / totals.max) * 100) : 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-50">
      {/* ── Header (ngoài vùng cuộn → cố định) ── */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 z-30">
        <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors flex-shrink-0"
              aria-label="Back"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: level.bg, color: level.color }}
                >
                  {level.label}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
                  Kids
                </span>
              </div>
              <h1 className="text-base font-bold text-slate-900 truncate leading-tight">{exam.title}</h1>
              <p className="text-xs text-slate-500 truncate">
                {studentName}{className ? ` · ${className}` : ""} · Lần thử {attemptNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden sm:flex flex-col items-end pr-3 border-r border-slate-200">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Điểm</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tabular-nums leading-none text-emerald-600">
                  {totals.earned}
                </span>
                <span className="text-xs text-slate-500">/ {totals.max}</span>
              </div>
            </div>

            {examId && (
              <Link
                to={`/giao-vien/xem-kids/${examId}`}
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

      {/* ── Vùng cuộn ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-5 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          {/* LEFT: danh sách task */}
          <div className="space-y-4">
            {/* Thanh tab điều hướng theo kỹ năng — chỉ hiện khi đề có ≥2 nhóm */}
            {showSkillTabs && (
              <div className="bg-white border border-slate-200 rounded-xl p-1.5 flex items-center gap-1 flex-wrap shadow-sm sticky top-0 z-20">
                <button
                  type="button"
                  onClick={() => setActiveSkill("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    activeSkill === "all"
                      ? "bg-slate-800 text-white"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  Tất cả
                  <span className="ml-1.5 tabular-nums opacity-70">
                    {totals.earned}/{totals.max}
                  </span>
                </button>
                {skillGroups.map((g) => (
                  <button
                    key={g.skill}
                    type="button"
                    onClick={() => setActiveSkill(g.skill)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      activeSkill === g.skill
                        ? "bg-slate-800 text-white"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    <span className="mr-1">{g.icon}</span>
                    {g.label}
                    <span className="ml-1.5 tabular-nums opacity-70">
                      {g.earned}/{g.max}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {tasks.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
                Bài làm này chưa có câu trả lời để chấm.
              </div>
            )}
            {visibleTasks.map((task) => (
              <KidsTaskCard
                key={task.id}
                task={task}
                rowsCorrect={cellCorrect[task.id]}
                saving={!!savingAnswerIds[task.answerId]}
                onToggleCell={(rowIndex, correct) => toggleCell(task, rowIndex, correct)}
                onChangePoints={(pts) => setManualPoints(task.id, pts)}
                onChangeFeedback={(fb) => setTaskFeedback(task.id, fb)}
                onSave={() => saveTask(task)}
                levelColor={level.color}
              />
            ))}
          </div>

          {/* RIGHT: tổng kết */}
          <aside className="space-y-4 lg:sticky lg:top-4 self-start">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Award className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900">Tổng kết</h3>
              </div>
              <div className="text-center py-3">
                <div className="text-4xl font-black tabular-nums text-emerald-600">{totals.earned}</div>
                <div className="text-sm text-slate-400 font-semibold">trên {totals.max} điểm · {pct}%</div>
              </div>
              <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <p className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" /> Nhận xét chung
              </p>
              <textarea
                rows={4}
                value={overallFeedback}
                onChange={(e) => setOverallFeedback(e.target.value)}
                placeholder="Nhận xét tổng quát cho học viên…"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder:text-slate-300"
              />
            </div>

            <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-900">
              <p className="font-semibold mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Mẹo chấm Kids
              </p>
              <ul className="space-y-1 text-sky-800">
                <li>· Dạng khách quan đã chấm sẵn — bấm Đúng/Sai để chỉnh</li>
                <li>· Dạng viết/nói/vẽ: nhập điểm và nhận xét tay</li>
                <li>· Điểm tổng tự cập nhật khi bạn chỉnh từng câu</li>
                <li>· Nhớ bấm "Lưu kết quả" khi xong</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// ─── Task card ───────────────────────────────────────────────────────────────
function KidsTaskCard({
  task, rowsCorrect, saving, onToggleCell, onChangePoints, onChangeFeedback, onSave, levelColor,
}: {
  task: KidsTask;
  rowsCorrect?: boolean[];
  saving: boolean;
  onToggleCell: (rowIndex: number, correct: boolean) => void;
  onChangePoints: (pts: number) => void;
  onChangeFeedback: (fb: string) => void;
  onSave: () => void;
  levelColor: string;
}) {
  // Build rows cho dạng khách quan (chỉ để lấy label/student/correct; trạng thái đúng dùng rowsCorrect)
  const rows: ReviewRow[] = useMemo(() => {
    if (task.isManual) return [];
    try {
      return buildReviewRows(task.taskType, task.taskData, parseAnswerMap(task.studentAnswerRaw) as any);
    } catch {
      return [];
    }
  }, [task.isManual, task.taskType, task.taskData, task.studentAnswerRaw]);

  const correctCount = (rowsCorrect ?? rows.map((r) => r.isCorrect)).filter(Boolean).length;

  // Bài làm tự do cho dạng chấm tay
  const manualText = useMemo(() => {
    if (!task.isManual) return "";
    const raw = task.studentAnswerRaw;
    if (typeof raw === "string" && !raw.trim().startsWith("{")) return raw;
    const map = parseAnswerMap(raw);
    return Object.values(map).filter(Boolean).join("\n");
  }, [task.isManual, task.studentAnswerRaw]);

  // Panel "Bài làm của học viên": dạng trực quan (ảnh/nối/audio) mặc định mở.
  const isVisual = VISUAL_TASK_TYPES.has(task.taskType);
  const [showWork, setShowWork] = useState(isVisual);
  const studentAnswerMap = useMemo(
    () => parseAnswerMap(task.studentAnswerRaw),
    [task.studentAnswerRaw]
  );

  // Map khóa đáp án → đúng/sai (theo nguồn sự thật rowsCorrect mà giáo viên chỉnh).
  // Renderer dùng để tô màu nhãn trên ảnh khớp với bảng Đúng/Sai bên dưới.
  const gradeOverrides = useMemo(() => {
    const out: Record<string, boolean> = {};
    rows.forEach((r, i) => {
      if (r.key == null) return;
      out[r.key] = rowsCorrect?.[i] ?? r.isCorrect;
    });
    return out;
  }, [rows, rowsCorrect]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100" style={{ background: `${levelColor}0D` }}>
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 text-white"
            style={{ background: levelColor }}
          >
            {task.number}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">
              {task.taskName || task.taskType || "Câu hỏi"}
            </p>
            {task.isManual && (
              <span className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Cần giáo viên chấm</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
          {!task.isManual && rows.length > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
              Đúng {correctCount}/{rows.length}
            </span>
          )}
          <span className="text-sm font-black text-slate-700 tabular-nums">
            {task.points}<span className="text-slate-300 font-normal text-xs">/{task.maxPoints}</span>
          </span>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {task.instructions && (
          <p className="text-xs text-slate-500">{task.instructions}</p>
        )}

        {/* ── Panel: Bài làm của học viên (ảnh / nối ảnh / audio) ── */}
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowWork((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <ImageIcon className="w-3.5 h-3.5" /> Bài làm của học viên
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${showWork ? "rotate-180" : ""}`}
            />
          </button>
          {showWork && (
            <div className="p-4 bg-white">
              <KidsTaskRenderer
                taskType={task.taskType}
                taskData={task.taskData}
                answer={studentAnswerMap}
                onChange={() => {}}
                readOnly
                gradeOverrides={gradeOverrides}
              />
            </div>
          )}
        </div>

        {/* ── Dạng khách quan: bảng + toggle Đúng/Sai từng ô ── */}
        {!task.isManual && rows.length > 0 && (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-2 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1"><ListChecks className="w-3 h-3" /> Nội dung</span>
              <span className="text-right">Học viên</span>
              <span className="text-right">Đáp án</span>
              <span className="text-center">Chấm</span>
            </div>
            <div className="divide-y divide-slate-100">
              {rows.map((r, i) => {
                const isCorrect = rowsCorrect?.[i] ?? r.isCorrect;
                return (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center px-4 py-2.5 text-sm">
                    <span className="text-slate-700 truncate" title={r.label}>{r.label}</span>
                    <span className={`text-right font-semibold ${isCorrect ? "text-emerald-600" : "text-rose-600"}`}>
                      {r.student}
                    </span>
                    <span className="text-right font-semibold text-slate-500">{r.correct}</span>
                    <div className="flex justify-center">
                      <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden bg-white">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => onToggleCell(i, true)}
                          className={`inline-flex items-center px-2 py-1 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer ${
                            isCorrect ? "bg-emerald-600 text-white" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-700"
                          }`}
                          title="Đúng"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => onToggleCell(i, false)}
                          className={`inline-flex items-center px-2 py-1 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer border-l border-slate-200 ${
                            !isCorrect ? "bg-rose-600 text-white" : "text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                          }`}
                          title="Sai"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Dạng khách quan nhưng không build được rows: fallback ── */}
        {!task.isManual && rows.length === 0 && (
          <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
            Không đọc được chi tiết đáp án. Bạn có thể chấm điểm thủ công bên dưới.
          </div>
        )}

        {/* ── Dạng chấm tay: bài làm + điểm + nhận xét ── */}
        {task.isManual && (
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Bài làm của học viên
            </p>
            {manualText ? (
              <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {manualText}
              </div>
            ) : (
              <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
                Học viên chưa trả lời hoặc bài làm cần chấm trực tiếp.
              </div>
            )}
          </div>
        )}

        {/* ── Khối chấm điểm chung (manual: nhập điểm; objective: hiện điểm tự tính) ── */}
        <div className="flex flex-wrap items-end gap-4 pt-3 border-t border-slate-100">
          {task.isManual ? (
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Điểm câu này</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={task.maxPoints}
                  step={0.5}
                  value={task.points}
                  onChange={(e) => onChangePoints(Math.min(task.maxPoints, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-20 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                <span className="text-sm text-slate-400">/ {task.maxPoints}</span>
                {/* Nút nhanh: Đạt = full điểm, Chưa đạt = 0 điểm */}
                <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden bg-white ml-1">
                  <button
                    type="button"
                    onClick={() => onChangePoints(task.maxPoints)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                      task.points >= task.maxPoints && task.maxPoints > 0
                        ? "bg-emerald-600 text-white"
                        : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-700"
                    }`}
                    title="Cho điểm tối đa"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đạt
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangePoints(0)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer border-l border-slate-200 ${
                      task.points === 0
                        ? "bg-rose-600 text-white"
                        : "text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                    }`}
                    title="Cho 0 điểm"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Chưa đạt
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Star className="w-4 h-4 text-amber-400" />
              <span>Điểm tự tính theo số ô đúng: <strong className="text-slate-800">{task.points}/{task.maxPoints}</strong></span>
            </div>
          )}

          <div className="flex-1 min-w-[200px]">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nhận xét</p>
            <input
              type="text"
              value={task.feedback}
              onChange={(e) => onChangeFeedback(e.target.value)}
              placeholder="Nhận xét cho câu này…"
              className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder:text-slate-300"
            />
          </div>

          {task.isManual && (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-60 transition-colors cursor-pointer"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Lưu
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default KidsGradingDetail;

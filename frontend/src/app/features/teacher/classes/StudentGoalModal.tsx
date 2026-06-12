import { useEffect, useState } from "react";
import {
  Loader2, Sparkles, Target, TrendingUp, AlertTriangle, CheckCircle2,
  ListChecks, Trash2, Clock, History,
} from "lucide-react";
import {
  teacherStudentGoalApi, StudentGoalData, GoalAnalysis,
} from "../../../../services/classMgmtApi";
import { Modal, Field, inputClass, btnPrimary, btnGhost } from "./classMgmtUi";
import { useToastContext } from "../../../../contexts/ToastContext";

const SKILL_LABEL: Record<string, string> = {
  overall: "Tổng quát", listening: "Nghe", reading: "Đọc", writing: "Viết", speaking: "Nói",
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  achieved: { label: "Đạt", cls: "bg-teal-50 text-teal-700 ring-teal-200" },
  on_track: { label: "Đúng lộ trình", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  behind: { label: "Cần cải thiện", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  no_data: { label: "Chưa có dữ liệu", cls: "bg-gray-100 text-gray-500 ring-gray-200" },
};

export function StudentGoalModal({
  studentId, studentName, open, onClose,
}: { studentId: number; studentName: string; open: boolean; onClose: () => void }) {
  const toast = useToastContext();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [exists, setExists] = useState(false);

  const [targetLevel, setTargetLevel] = useState("");
  const [targetSkill, setTargetSkill] = useState("overall");
  const [examType, setExamType] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [note, setNote] = useState("");

  const [analysis, setAnalysis] = useState<GoalAnalysis | null>(null);
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setAnalysis(null);
    teacherStudentGoalApi.get(studentId)
      .then((res: any) => {
        const g: StudentGoalData | null = res?.data?.goal || null;
        setHistory(res?.data?.history || []);
        if (g) {
          setExists(true);
          setTargetLevel(g.target_level || "");
          setTargetSkill(g.target_skill || "overall");
          setExamType(g.exam_type || "");
          setTargetDate(g.target_date ? String(g.target_date).slice(0, 10) : "");
          setNote(g.note || "");
          setAnalysis(g.ai_analysis || null);
          setAnalyzedAt(g.ai_analyzed_at || null);
        } else {
          setExists(false);
          setTargetLevel(""); setTargetSkill("overall"); setExamType(""); setTargetDate(""); setNote("");
        }
      })
      .catch(() => toast.error("Không tải được mục tiêu."))
      .finally(() => setLoading(false));
  }, [open, studentId]);

  const save = async () => {
    if (!targetLevel.trim()) { toast.error("Nhập mục tiêu (VD: B2)."); return; }
    setSaving(true);
    try {
      await teacherStudentGoalApi.upsert(studentId, {
        target_level: targetLevel, target_skill: targetSkill,
        exam_type: examType || undefined, target_date: targetDate || undefined, note: note || undefined,
      });
      setExists(true);
      toast.success("Đã lưu mục tiêu.");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Lưu thất bại.");
    } finally { setSaving(false); }
  };

  const analyze = async () => {
    if (!exists) { toast.error("Hãy lưu mục tiêu trước khi phân tích."); return; }
    setAnalyzing(true);
    try {
      const res = await teacherStudentGoalApi.analyze(studentId);
      const a = res?.data?.analysis || null;
      const at = res?.data?.analyzed_at || new Date().toISOString();
      setAnalysis(a);
      setAnalyzedAt(at);
      if (a && !a.error) {
        setHistory((prev) => [{
          id: Date.now(),
          date: at,
          progress_percent: a.overall_progress_percent ?? null,
          current_level: a.current_level_estimate ?? null,
          on_track: a.on_track ?? null,
          summary: a.gap_summary || a.summary || null,
        }, ...prev]);
        toast.success("Đã phân tích bằng AI.");
      } else {
        toast.warning("AI tạm thời bận, thử lại sau.");
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Phân tích thất bại.");
    } finally { setAnalyzing(false); }
  };

  const removeGoal = async () => {
    if (!window.confirm("Xóa mục tiêu của học viên này?")) return;
    try {
      await teacherStudentGoalApi.remove(studentId);
      setExists(false); setAnalysis(null); setAnalyzedAt(null);
      setTargetLevel(""); setTargetSkill("overall"); setExamType(""); setTargetDate(""); setNote("");
      toast.success("Đã xóa mục tiêu.");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Không xóa được.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Mục tiêu & tiến độ — ${studentName}`}
      maxWidth="max-w-2xl"
      footer={
        <>
          <button onClick={onClose} className={`${btnGhost} flex-1`}>Đóng</button>
          <button onClick={save} disabled={saving} className={`${btnPrimary} flex-1`}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Lưu mục tiêu
          </button>
        </>
      }
    >
      {loading ? (
        <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#0D9488]" /></div>
      ) : (
        <div className="space-y-5">
          {/* Form mục tiêu */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Mục tiêu *" hint="VD: B2, IELTS 6.5, VSTEP B2">
              <input value={targetLevel} onChange={(e) => setTargetLevel(e.target.value)} placeholder="B2" className={inputClass} />
            </Field>
            <Field label="Kỹ năng trọng tâm">
              <select value={targetSkill} onChange={(e) => setTargetSkill(e.target.value)} className={inputClass}>
                <option value="overall">Tổng quát</option>
                <option value="listening">Nghe</option>
                <option value="reading">Đọc</option>
                <option value="writing">Viết</option>
                <option value="speaking">Nói</option>
              </select>
            </Field>
            <Field label="Khung thi">
              <select value={examType} onChange={(e) => setExamType(e.target.value)} className={inputClass}>
                <option value="">Không chỉ định</option>
                <option value="VSTEP">VSTEP</option>
                <option value="IELTS">IELTS</option>
                <option value="THPT">THPT</option>
                <option value="GENERAL">Tổng quát</option>
              </select>
            </Field>
            <Field label="Hạn mục tiêu">
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={inputClass} />
            </Field>
          </div>
          <Field label="Ghi chú cho AI" hint="Không bắt buộc — bối cảnh giúp AI tư vấn sát hơn.">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </Field>

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              onClick={analyze}
              disabled={analyzing || !exists}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 active:scale-[0.98] disabled:opacity-50 transition-all"
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Phân tích bằng AI
            </button>
            {exists && (
              <button onClick={removeGoal} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" /> Xóa mục tiêu
              </button>
            )}
          </div>

          {/* Kết quả phân tích */}
          {analysis && <AnalysisView analysis={analysis} analyzedAt={analyzedAt} targetLevel={targetLevel} />}

          {/* Lịch sử phân tích (AI dùng để so sánh tiến bộ) */}
          {history.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-[#111827] mb-2 inline-flex items-center gap-1.5">
                <History className="w-4 h-4 text-gray-400" /> Lịch sử phân tích ({history.length})
              </p>
              <div className="space-y-2">
                {history.slice(0, 8).map((h) => (
                  <div key={h.id} className="flex items-start gap-3 rounded-xl bg-gray-50 ring-1 ring-gray-100 px-3.5 py-2.5">
                    <div className="text-center shrink-0 w-12">
                      <p className="text-base font-bold text-[#111827] tabular-nums leading-none">{h.progress_percent ?? "–"}<span className="text-[10px] font-normal">%</span></p>
                      {h.current_level && <p className="text-[10px] text-gray-500 mt-0.5">{h.current_level}</p>}
                    </div>
                    <div className="min-w-0 flex-1">
                      {h.summary && <p className="text-xs text-[#374151] line-clamp-2">{h.summary}</p>}
                      <p className="text-[10px] text-gray-400 mt-0.5">{h.date ? new Date(h.date).toLocaleString("vi-VN") : ""}</p>
                    </div>
                    {h.on_track !== null && h.on_track !== undefined && (
                      <span className={`shrink-0 mt-0.5 w-2 h-2 rounded-full ${h.on_track ? "bg-teal-500" : "bg-amber-500"}`} title={h.on_track ? "Đúng lộ trình" : "Cần tăng tốc"} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function AnalysisView({ analysis, analyzedAt, targetLevel }: { analysis: GoalAnalysis; analyzedAt: string | null; targetLevel: string }) {
  if (analysis.has_data === false) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800">
        {analysis.summary}
      </div>
    );
  }
  const pct = Math.max(0, Math.min(100, analysis.overall_progress_percent ?? 0));
  const onTrack = analysis.on_track;
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-gradient-to-br from-violet-50/40 to-white p-5 space-y-4 cm-rise">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-600" />
          <span className="text-sm font-bold text-[#111827]">Phân tích AI</span>
          {analyzedAt && <span className="text-xs text-gray-400">· {new Date(analyzedAt).toLocaleString("vi-VN")}</span>}
        </div>
        {onTrack !== null && onTrack !== undefined && (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${onTrack ? "bg-teal-50 text-teal-700 ring-teal-200" : "bg-amber-50 text-amber-700 ring-amber-200"}`}>
            {onTrack ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {onTrack ? "Đúng lộ trình" : "Cần tăng tốc"}
          </span>
        )}
      </div>

      {/* Tiến độ tổng */}
      <div>
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="inline-flex items-center gap-1.5 text-[#374151]">
            <Target className="w-4 h-4 text-violet-600" /> Tiến độ tới mục tiêu <span className="font-semibold">{targetLevel}</span>
          </span>
          <span className="font-bold text-[#111827] tabular-nums">{pct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 cm-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        {analysis.current_level_estimate && (
          <p className="text-xs text-[#6B7280] mt-1.5">Trình độ ước lượng hiện tại: <span className="font-semibold text-[#374151]">{analysis.current_level_estimate}</span></p>
        )}
      </div>

      {(analysis.gap_summary || analysis.summary) && (
        <p className="text-sm text-[#374151] leading-relaxed">{analysis.gap_summary || analysis.summary}</p>
      )}

      {/* Bảng kỹ năng */}
      {analysis.skills && analysis.skills.length > 0 && (
        <div className="space-y-2">
          {analysis.skills.map((s, i) => {
            const m = STATUS_META[s.status || "no_data"] || STATUS_META.no_data;
            return (
              <div key={i} className="flex items-start justify-between gap-3 rounded-xl bg-white ring-1 ring-gray-100 px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#111827]">{SKILL_LABEL[s.skill] || s.skill}</span>
                    {s.current_score != null && <span className="text-xs text-gray-500 tabular-nums">{s.current_score}{s.current_level ? ` · ${s.current_level}` : ""}</span>}
                  </div>
                  {s.gap_note && <p className="text-xs text-[#6B7280] mt-0.5">{s.gap_note}</p>}
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${m.cls}`}>{m.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Điểm yếu */}
      {analysis.weaknesses && analysis.weaknesses.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-[#111827] mb-1.5 inline-flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-amber-500" /> Điểm yếu</p>
          <ul className="space-y-1">
            {analysis.weaknesses.map((w, i) => (
              <li key={i} className="text-sm text-[#374151] flex gap-2"><span className="text-amber-500">•</span><span>{w}</span></li>
            ))}
          </ul>
        </div>
      )}

      {/* Hành động ưu tiên */}
      {analysis.priority_actions && analysis.priority_actions.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-[#111827] mb-1.5 inline-flex items-center gap-1.5"><ListChecks className="w-4 h-4 text-[#0D9488]" /> Cần làm để đạt mục tiêu</p>
          <ul className="space-y-1">
            {analysis.priority_actions.map((a, i) => (
              <li key={i} className="text-sm text-[#374151] flex gap-2"><span className="text-[#0D9488]">→</span><span>{a}</span></li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {analysis.estimated_sessions_to_goal != null && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-semibold ring-1 ring-indigo-100">
            <Clock className="w-4 h-4" /> ~{analysis.estimated_sessions_to_goal} buổi luyện nữa
          </span>
        )}
        {analysis.encouragement && (
          <span className="inline-flex items-center gap-1.5 text-sm text-[#0F766E]">
            <TrendingUp className="w-4 h-4" /> {analysis.encouragement}
          </span>
        )}
      </div>
    </div>
  );
}

export default StudentGoalModal;

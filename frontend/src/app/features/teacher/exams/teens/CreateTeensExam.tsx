/**
 * CreateTeensExam — Tạo đề Listening / Speaking cho học viên Teens.
 *
 * Route: /giao-vien/de-thi/teens/:skill/tao-moi  (skill = listening | speaking)
 *
 * - Listening: mỗi nhóm = 1 audio + nhiều câu trắc nghiệm (tự chấm).
 * - Speaking: nhiều "part", mỗi part = 1 đề nói (học viên ghi âm → AI chấm).
 *
 * Lưu qua POST /teacher/exams/teens (TeensExamController) — tạo Exam + Question
 * quan hệ, dùng lại player teens + hạ tầng chấm AI sẵn có.
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft, Save, Plus, Trash2, Headphones, Mic, Upload, Loader2,
  CheckCircle2, Volume2, AlertTriangle,
} from "lucide-react";
import { useToast } from "../../../../../hooks/useToast";
import { api } from "../../../../../services/api";

const TEAL = "#0D9488";
const TEAL_MID = "#14B8A6";

let _uid = 0;
const uid = () => `t${Date.now()}_${_uid++}`;

interface Option { id: string; content: string; isCorrect: boolean }
interface LQuestion { id: string; qContent: string; options: Option[] }
interface LGroup { id: string; audioUrl: string; uploading: boolean; questions: LQuestion[] }
interface SPart { id: string; qContent: string; prepSeconds: number; speakSeconds: number }

const newOption = (): Option => ({ id: uid(), content: "", isCorrect: false });
const newLQuestion = (): LQuestion => ({ id: uid(), qContent: "", options: [newOption(), newOption(), newOption(), newOption()] });
const newLGroup = (): LGroup => ({ id: uid(), audioUrl: "", uploading: false, questions: [newLQuestion()] });
const newSPart = (): SPart => ({ id: uid(), qContent: "", prepSeconds: 30, speakSeconds: 120 });

const btnPrimary = "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60";
const inputCls = "w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[15px] outline-none focus:border-teal-400 transition-colors";

export function CreateTeensExam() {
  const { skill: skillParam } = useParams<{ skill: string }>();
  const skill: "listening" | "speaking" = skillParam === "speaking" ? "speaking" : "listening";
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(skill === "speaking" ? 15 : 30);
  const [groups, setGroups] = useState<LGroup[]>([newLGroup()]);
  const [parts, setParts] = useState<SPart[]>([newSPart()]);
  const [saving, setSaving] = useState(false);

  const isListening = skill === "listening";
  const accent = isListening ? "#0EA5E9" : "#EC4899";
  const SkillIcon = isListening ? Headphones : Mic;

  const totalQuestions = useMemo(
    () => (isListening ? groups.reduce((s, g) => s + g.questions.length, 0) : parts.length),
    [isListening, groups, parts]
  );

  // ─── Listening mutators ───────────────────────────────────────────────
  const updateGroup = (gid: string, fn: (g: LGroup) => LGroup) =>
    setGroups((prev) => prev.map((g) => (g.id === gid ? fn(g) : g)));

  const uploadAudio = async (gid: string, file: File) => {
    updateGroup(gid, (g) => ({ ...g, uploading: true }));
    try {
      const fd = new FormData();
      fd.append("audio", file, file.name);
      fd.append("questionId", `teens-listening-${gid}`);
      const token = localStorage.getItem("auth_token");
      const endpoint = token ? "/teacher/upload/audio" : "/test/upload/audio";
      const { data: result } = await api.post(endpoint, fd, { headers: { "Content-Type": "multipart/form-data" } });
      if (result.success && result.data?.audioUrl) {
        updateGroup(gid, (g) => ({ ...g, audioUrl: result.data.audioUrl, uploading: false }));
        success("Đã tải audio lên.");
      } else {
        throw new Error(result.message || "Upload thất bại");
      }
    } catch (e: any) {
      updateGroup(gid, (g) => ({ ...g, uploading: false }));
      error(`Lỗi tải audio: ${e?.message || "Không xác định"}`);
    }
  };

  const addGroup = () => setGroups((p) => [...p, newLGroup()]);
  const removeGroup = (gid: string) => setGroups((p) => (p.length > 1 ? p.filter((g) => g.id !== gid) : p));
  const addQuestion = (gid: string) => updateGroup(gid, (g) => ({ ...g, questions: [...g.questions, newLQuestion()] }));
  const removeQuestion = (gid: string, qid: string) =>
    updateGroup(gid, (g) => ({ ...g, questions: g.questions.length > 1 ? g.questions.filter((q) => q.id !== qid) : g.questions }));
  const updateQuestion = (gid: string, qid: string, fn: (q: LQuestion) => LQuestion) =>
    updateGroup(gid, (g) => ({ ...g, questions: g.questions.map((q) => (q.id === qid ? fn(q) : q)) }));

  // ─── Speaking mutators ────────────────────────────────────────────────
  const updatePart = (pid: string, fn: (p: SPart) => SPart) =>
    setParts((prev) => prev.map((p) => (p.id === pid ? fn(p) : p)));
  const addPart = () => setParts((p) => [...p, newSPart()]);
  const removePart = (pid: string) => setParts((p) => (p.length > 1 ? p.filter((x) => x.id !== pid) : p));

  // ─── Validate + Save ──────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!title.trim()) return "Vui lòng nhập tên đề thi.";
    if (isListening) {
      for (let gi = 0; gi < groups.length; gi++) {
        const g = groups[gi];
        for (let qi = 0; qi < g.questions.length; qi++) {
          const q = g.questions[qi];
          if (!q.qContent.trim()) return `Phần ${gi + 1}, câu ${qi + 1}: chưa nhập câu hỏi.`;
          const filled = q.options.filter((o) => o.content.trim());
          if (filled.length < 2) return `Phần ${gi + 1}, câu ${qi + 1}: cần ít nhất 2 lựa chọn.`;
          if (!q.options.some((o) => o.isCorrect && o.content.trim())) return `Phần ${gi + 1}, câu ${qi + 1}: chưa chọn đáp án đúng.`;
        }
      }
    } else {
      for (let pi = 0; pi < parts.length; pi++) {
        if (!parts[pi].qContent.trim()) return `Part ${pi + 1}: chưa nhập đề nói.`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { error(err); return; }
    setSaving(true);
    try {
      const body: any = {
        skill,
        eTitle: title.trim(),
        eDescription: description.trim(),
        eDuration_minutes: duration,
      };
      if (isListening) {
        body.groups = groups.map((g) => ({
          audio_url: g.audioUrl || null,
          questions: g.questions.map((q) => ({
            qContent: q.qContent.trim(),
            options: q.options.filter((o) => o.content.trim()).map((o) => ({ content: o.content.trim(), isCorrect: o.isCorrect })),
          })),
        }));
      } else {
        body.parts = parts.map((p) => ({
          qContent: p.qContent.trim(),
          prepSeconds: p.prepSeconds,
          speakSeconds: p.speakSeconds,
        }));
      }
      const { data } = await api.post("/teacher/exams/teens", body);
      success(data?.data?.message || "Đã tạo đề thi thành công.");
      navigate("/giao-vien/de-thi");
    } catch (e: any) {
      error(e?.response?.data?.message || "Không tạo được đề thi. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-5 sm:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${accent}1A` }}>
            <SkillIcon className="w-5 h-5" style={{ color: accent }} />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900">
              Tạo đề {isListening ? "Listening" : "Speaking"} — Teens
            </h1>
            <p className="text-sm text-slate-500">
              {isListening ? "Audio + câu hỏi trắc nghiệm (tự chấm)" : "Đề nói — học viên ghi âm, AI chấm điểm"}
            </p>
          </div>
        </div>

        {/* Meta */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tên đề thi *</label>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={isListening ? "VD: Listening Unit 5 — Family" : "VD: Speaking — Talk about your hobbies"} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Thời gian (phút)</label>
              <input type="number" min={1} max={300} className={inputCls} value={duration}
                onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))} />
            </div>
            <div className="flex items-end">
              <span className="text-sm text-slate-500">Tổng số {isListening ? "câu" : "part"}: <b className="text-slate-800">{totalQuestions}</b></span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mô tả (tuỳ chọn)</label>
            <textarea className={inputCls + " resize-y min-h-[64px]"} value={description}
              onChange={(e) => setDescription(e.target.value)} placeholder="Hướng dẫn ngắn cho học viên…" />
          </div>
        </div>

        {/* Listening builder */}
        {isListening ? (
          <div className="space-y-4">
            {groups.map((g, gi) => (
              <div key={g.id} className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-slate-900">Phần {gi + 1}</h2>
                  {groups.length > 1 && (
                    <button onClick={() => removeGroup(g.id)} className="text-rose-500 hover:text-rose-600 inline-flex items-center gap-1 text-sm font-medium">
                      <Trash2 className="w-4 h-4" /> Xoá phần
                    </button>
                  )}
                </div>

                {/* Audio */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Audio cho phần này</label>
                  {g.audioUrl ? (
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                      <Volume2 className="w-4 h-4 text-emerald-600" />
                      <audio controls src={g.audioUrl} className="h-8 flex-1" />
                      <button onClick={() => updateGroup(g.id, (x) => ({ ...x, audioUrl: "" }))} className="text-slate-400 hover:text-rose-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-4 cursor-pointer hover:border-teal-300 transition-colors text-sm font-medium text-slate-500">
                      {g.uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {g.uploading ? "Đang tải lên…" : "Chọn file audio (mp3, m4a, wav…)"}
                      <input type="file" accept="audio/*" className="hidden" disabled={g.uploading}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAudio(g.id, f); e.currentTarget.value = ""; }} />
                    </label>
                  )}
                </div>

                {/* Questions */}
                <div className="space-y-4">
                  {g.questions.map((q, qi) => (
                    <div key={q.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-slate-700">Câu {qi + 1}</span>
                        {g.questions.length > 1 && (
                          <button onClick={() => removeQuestion(g.id, q.id)} className="text-slate-400 hover:text-rose-500">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <input className={inputCls + " mb-3 bg-white"} value={q.qContent}
                        onChange={(e) => updateQuestion(g.id, q.id, (x) => ({ ...x, qContent: e.target.value }))}
                        placeholder="Nội dung câu hỏi…" />
                      <div className="space-y-2">
                        {q.options.map((opt, oi) => (
                          <div key={opt.id} className="flex items-center gap-2">
                            <button type="button"
                              onClick={() => updateQuestion(g.id, q.id, (x) => ({ ...x, options: x.options.map((o) => ({ ...o, isCorrect: o.id === opt.id })) }))}
                              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                              style={{ background: opt.isCorrect ? TEAL : "#E2E8F0", color: opt.isCorrect ? "#fff" : "#64748B" }}
                              title="Chọn làm đáp án đúng">
                              {opt.isCorrect ? <CheckCircle2 className="w-4 h-4" /> : String.fromCharCode(65 + oi)}
                            </button>
                            <input className={inputCls + " bg-white py-2"} value={opt.content}
                              onChange={(e) => updateQuestion(g.id, q.id, (x) => ({ ...x, options: x.options.map((o) => (o.id === opt.id ? { ...o, content: e.target.value } : o)) }))}
                              placeholder={`Lựa chọn ${String.fromCharCode(65 + oi)}`} />
                            {q.options.length > 2 && (
                              <button onClick={() => updateQuestion(g.id, q.id, (x) => ({ ...x, options: x.options.filter((o) => o.id !== opt.id) }))}
                                className="text-slate-300 hover:text-rose-500 flex-shrink-0">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {q.options.length < 6 && (
                        <button onClick={() => updateQuestion(g.id, q.id, (x) => ({ ...x, options: [...x.options, newOption()] }))}
                          className="mt-2 text-sm font-medium text-teal-600 hover:text-teal-700 inline-flex items-center gap-1">
                          <Plus className="w-3.5 h-3.5" /> Thêm lựa chọn
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button onClick={() => addQuestion(g.id)}
                  className="mt-4 w-full py-2.5 rounded-xl border border-dashed border-slate-200 text-sm font-semibold text-slate-500 hover:border-teal-300 hover:text-teal-600 transition-colors inline-flex items-center justify-center gap-1.5">
                  <Plus className="w-4 h-4" /> Thêm câu hỏi
                </button>
              </div>
            ))}
            <button onClick={addGroup}
              className="w-full py-3 rounded-2xl border border-dashed border-teal-200 bg-teal-50/40 text-sm font-bold text-teal-700 hover:bg-teal-50 transition-colors inline-flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Thêm phần (audio mới)
            </button>
          </div>
        ) : (
          /* Speaking builder */
          <div className="space-y-4">
            {parts.map((p, pi) => (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-slate-900">Part {pi + 1}</h2>
                  {parts.length > 1 && (
                    <button onClick={() => removePart(p.id)} className="text-rose-500 hover:text-rose-600 inline-flex items-center gap-1 text-sm font-medium">
                      <Trash2 className="w-4 h-4" /> Xoá part
                    </button>
                  )}
                </div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Đề nói *</label>
                <textarea className={inputCls + " resize-y min-h-[90px] mb-3"} value={p.qContent}
                  onChange={(e) => updatePart(p.id, (x) => ({ ...x, qContent: e.target.value }))}
                  placeholder="VD: Describe your favourite hobby. You should say what it is, when you do it, and why you enjoy it." />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Chuẩn bị (giây)</label>
                    <input type="number" min={0} max={600} className={inputCls} value={p.prepSeconds}
                      onChange={(e) => updatePart(p.id, (x) => ({ ...x, prepSeconds: Math.max(0, Number(e.target.value) || 0) }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Thời gian nói (giây)</label>
                    <input type="number" min={10} max={1200} className={inputCls} value={p.speakSeconds}
                      onChange={(e) => updatePart(p.id, (x) => ({ ...x, speakSeconds: Math.max(10, Number(e.target.value) || 10) }))} />
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addPart}
              className="w-full py-3 rounded-2xl border border-dashed border-pink-200 bg-pink-50/40 text-sm font-bold text-pink-700 hover:bg-pink-50 transition-colors inline-flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Thêm part
            </button>
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Phần Speaking sẽ được chấm tự động bằng AI (phát âm + nội dung). Giáo viên có thể xem lại và điều chỉnh điểm trong trang chấm điểm.</span>
            </div>
          </div>
        )}

        {/* Save bar */}
        <div className="sticky bottom-0 mt-6 -mx-5 sm:-mx-8 px-5 sm:px-8 py-4 bg-[#F9FAFB]/90 backdrop-blur border-t border-slate-200">
          <div className="max-w-3xl mx-auto flex items-center justify-end gap-3">
            <button onClick={() => navigate(-1)} className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50">
              Huỷ
            </button>
            <button onClick={handleSave} disabled={saving} className={btnPrimary}
              style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})` }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Đang lưu…" : "Tạo đề thi"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

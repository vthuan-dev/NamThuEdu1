import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Headphones,
  BookOpen,
  PenTool,
  Mic,
  CheckCircle2,
  Loader2,
  Bot,
  UserCheck,
  MessageSquare,
  BarChart3,
  Clock,
  AlertTriangle,
  ListChecks,
  ArrowRight,
  Award,
} from "lucide-react";
import { api } from "../../../../services/api";
import {
  parseVstepScores,
  calcVstepAvg,
  isVstepExam,
  getSubmissionDisplayScore,
  type SubmissionScoreUpdate,
} from "../../../../utils/gradeHelpers";

interface ReviewSubmission {
  id: string;
  studentName: string;
  studentAvatar: string;
  examTitle: string;
  examType: string;
  submissionTime: Date;
  status: string;
  score?: number;
  maxScore: number;
  attemptNumber: number;
  sGemini_feedback?: string;
  sTeacher_feedback?: string;
  teacher_reviewed_at?: string;
}

interface Props {
  submission: ReviewSubmission | null;
  open: boolean;
  onClose: () => void;
  /** Called after a successful save. The update object lets the parent sync its list immediately. */
  onReviewed: (update: SubmissionScoreUpdate) => void;
}

// ─── Skill config ──────────────────────────────────────────────────────────
const SKILLS = [
  { key: "listening", labelKey: "teacher.grading.detail.skills.listening", icon: Headphones, color: "#F59E0B", bg: "#FEF3C7", weight: 25 },
  { key: "reading",   labelKey: "teacher.grading.detail.skills.reading",   icon: BookOpen,   color: "#0EA5E9", bg: "#E0F2FE", weight: 25 },
  { key: "writing",   labelKey: "teacher.grading.detail.skills.writing",   icon: PenTool,    color: "#8B5CF6", bg: "#EDE9FE", weight: 25 },
  { key: "speaking",  labelKey: "teacher.grading.detail.skills.speaking",  icon: Mic,        color: "#EC4899", bg: "#FCE7F3", weight: 25 },
] as const;

// ─── Score ring ─────────────────────────────────────────────────────────────
interface ScoreRingProps {
  score: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}

function ScoreRing({ score, max = 10, size = 52, strokeWidth = 4, color }: ScoreRingProps) {
  const pct = Math.min((score / max) * 100, 100);
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s cubic-bezier(.4,0,.2,1)" }}
      />
    </svg>
  );
}

// ─── Main Modal ─────────────────────────────────────────────────────────────
export function TeacherReviewModal({ submission, open, onClose, onReviewed }: Props) {
  const { t } = useTranslation();
  const aiScores = parseVstepScores(submission?.sGemini_feedback);

  const navigate = useNavigate();

  const [scores, setScores] = useState<Record<string, string>>({});
  const [totalInput, setTotalInput] = useState("");   // tổng điểm cho đề không theo 4 kỹ năng (Kids/General/Cambridge)
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Remember initial AI-filled values to detect whether teacher actually changed anything
  const initialScoresRef = useRef<Record<string, string>>({});
  const initialTotalRef = useRef<string>("");

  useEffect(() => {
    if (!submission) return;
    const initial: Record<string, string> = {};
    SKILLS.forEach(({ key }) => {
      const ai = aiScores[key as keyof typeof aiScores];
      initial[key] = ai !== null ? String(Number(ai).toFixed(1)) : "";
    });
    initialScoresRef.current = initial;  // snapshot for dirty-check
    setScores(initial);

    // Tổng điểm hiện tại (đề Kids/General/Cambridge dùng tổng điểm thay vì 4 kỹ năng)
    const totalStr = submission.score !== undefined && submission.score !== null ? String(submission.score) : "";
    initialTotalRef.current = totalStr;
    setTotalInput(totalStr);

    setFeedback(submission.sTeacher_feedback ?? "");
    setError(null);
  }, [submission?.id]);

  const hasAiScores = Object.values(aiScores).some((v) => v !== null);

  const isVstep = submission
    ? isVstepExam(submission.examType, submission.examTitle)
    : false;

  // Chế độ chấm theo 4 kỹ năng (VSTEP) vs theo tổng điểm (Kids/General/Cambridge...).
  const skillMode = isVstep;

  const aiTotalScore = calcVstepAvg(aiScores);

  // totalOverride is computed BEFORE displayScore so both panels share one source
  const totalOverride = (() => {
    const vals = SKILLS.map(({ key }) => parseFloat(scores[key] ?? ""));
    if (vals.some(isNaN)) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  })();

  // Left card: always raw AI score from DB — same source as the queue list
  const displayData = submission
    ? getSubmissionDisplayScore({
        examType: submission.examType,
        examTitle: submission.examTitle,
        sGemini_feedback: submission.sGemini_feedback, // raw, never rounded
        score: submission.score,
        maxScore: submission.maxScore,
      })
    : null;

  const displayScore = displayData ? displayData.value.toFixed(2) : "—";
  const displayMaxScore = displayData ? displayData.max : (submission?.maxScore ?? 10);

  // Mở trang chấm chi tiết từng câu (đặc biệt hữu ích cho đề Kids / Cambridge).
  const goToDetail = () => {
    if (!submission) return;
    onClose();
    navigate(`/giao-vien/cham-diem/${submission.id}`);
  };


  const handleSave = async () => {
    if (!submission) return;
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        feedback,
        sTeacher_feedback: feedback,
      };

      let rawScore: number | undefined;

      if (skillMode) {
        // ── VSTEP: chấm theo 4 kỹ năng ──
        // Only send score if teacher actually changed an input (avoid drift from toFixed(1) rounding)
        const scoresDirty = SKILLS.some(({ key }) => scores[key] !== initialScoresRef.current[key]);
        rawScore = (scoresDirty && totalOverride !== null)
          ? Math.round(totalOverride * 10)
          : undefined;
        if (rawScore !== undefined) {
          payload.score = rawScore;
        }

        // Send individual skill overrides so they are persisted in database
        if (scoresDirty) {
          payload.skill_overrides = {
            listening: scores.listening ? parseFloat(scores.listening) : null,
            reading: scores.reading ? parseFloat(scores.reading) : null,
            writing: scores.writing ? parseFloat(scores.writing) : null,
            speaking: scores.speaking ? parseFloat(scores.speaking) : null,
          };
        }
      } else {
        // ── Kids / General / Cambridge: chấm theo tổng điểm ──
        const trimmed = totalInput.trim();
        const totalDirty = trimmed !== initialTotalRef.current.trim();
        if (totalDirty && trimmed !== "") {
          const parsed = parseFloat(trimmed);
          if (!isNaN(parsed)) {
            // Kẹp trong khoảng [0, max] để tránh điểm vượt khung.
            rawScore = Math.max(0, Math.min(displayMaxScore, parsed));
            payload.score = rawScore;
          }
        }
      }

      await api.post(`/teacher/submissions/${submission.id}/grade`, payload);

      const now = new Date().toISOString();
      onReviewed({
        id: submission.id,
        rawScore,
        sTeacher_feedback: feedback,
        sGemini_feedback: submission.sGemini_feedback,
        teacher_reviewed_at: now,
      });
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? t("teacher.grading.reviewModal.saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && submission && (
        <motion.div
          className="fixed inset-0 z-[300] flex items-center justify-center px-4 py-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center border border-violet-100/50">
                  <UserCheck className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-850 tracking-tight">{t("teacher.grading.reviewModal.submitTitle")}</h2>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">{submission.examTitle}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors border border-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body — 2 columns */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">

                {/* ─── LEFT: AI results ─── */}
                <div className="p-6 md:p-8 space-y-6">
                  {/* Student info */}
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50/60 border border-slate-100">
                    <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-750 border border-violet-100/50 flex items-center justify-center font-bold text-base flex-shrink-0 shadow-sm">
                      {submission.studentAvatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 text-base truncate leading-snug">{submission.studentName}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          {submission.submissionTime.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-100/30">
                          {t("teacher.grading.queuePage.attempt")} {submission.attemptNumber}
                        </span>
                        {submission.status && (
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${
                            submission.status === "graded" 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100/50" 
                              : "bg-amber-50 text-amber-700 border-amber-100/50"
                          }`}>
                            {submission.status === "graded" ? t("teacher.grading.statsPage.graded") : t("teacher.grading.statsPage.pendingGrading")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 bg-white border border-slate-100 px-4 py-3 rounded-2xl shadow-sm min-w-[90px] flex flex-col justify-center items-center gap-0.5">
                      <p className="text-[9px] text-slate-400 font-bold tracking-widest uppercase leading-none">Hiện tại</p>
                      <p className="text-2xl font-black text-slate-800 leading-none mt-0.5">{displayScore}</p>
                      <p className="text-[9px] text-slate-400 font-bold tracking-wide uppercase">/ {displayMaxScore}</p>
                    </div>
                  </div>

                  {/* AI scores */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-amber-600" />
                      </div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("teacher.grading.reviewModal.aiScore")}</span>
                    </div>

                    {!skillMode ? (
                      <div
                        role="button"
                        onClick={goToDetail}
                        className="rounded-2xl bg-white border border-slate-100 p-5 flex items-center justify-between gap-4 shadow-sm hover:bg-slate-50/80 hover:border-violet-200 transition-all cursor-pointer group w-full text-left"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-16 h-16 rounded-2xl bg-violet-50 border border-violet-100 flex flex-col items-center justify-center flex-shrink-0 group-hover:bg-violet-100/50 transition-colors">
                            <span className="text-xl font-black text-violet-700 leading-none">{displayScore}</span>
                            <span className="text-[9px] font-bold text-violet-400 mt-1">/ {displayMaxScore}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-700 group-hover:text-violet-700 transition-colors">Điểm hệ thống chấm</p>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                              Đề dạng chấm theo từng câu/từng phần. Nhấp để mở trang chấm chi tiết xem đáp án và chỉnh điểm từng câu.
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                      </div>
                    ) : hasAiScores ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {SKILLS.map(({ key, labelKey, icon: Icon, color, weight }) => {
                          const n = aiScores[key as keyof typeof aiScores];
                          return (
                            <div
                              key={key}
                              className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:border-slate-200/80 transition-all duration-200"
                            >
                              <div className="relative flex-shrink-0">
                                {n !== null ? (
                                  <>
                                    <ScoreRing score={n} max={10} color={color} size={52} strokeWidth={4} />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <span className="text-sm font-bold text-slate-800">{n.toFixed(1)}</span>
                                    </div>
                                  </>
                                ) : (
                                  <div className="w-[52px] h-[52px] rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center">
                                    <span className="text-xs text-slate-400">N/A</span>
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Icon className="w-4 h-4 text-slate-400" />
                                  <span className="text-sm font-bold text-slate-700 truncate leading-none">{t(labelKey)}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-slate-400">/ 10</span>
                                  <span className="px-1.5 py-0.5 rounded bg-slate-50 text-[10px] text-slate-400 border border-slate-100 font-semibold leading-none">
                                    Hệ số: {weight}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 py-10 flex flex-col items-center justify-center gap-2.5">
                        <BarChart3 className="w-9 h-9 text-slate-350" />
                        <p className="text-sm font-medium text-slate-500">{t("teacher.grading.reviewModal.noAiScore")}</p>
                        <p className="text-xs text-slate-400">{t("teacher.grading.reviewModal.onlyTotal")} {submission.score ?? "—"}/{submission.maxScore}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ─── RIGHT: Teacher override ─── */}
                <div className="p-6 md:p-8 space-y-6 bg-slate-50/20">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center">
                        <UserCheck className="w-4 h-4 text-violet-600" />
                      </div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("teacher.grading.reviewModal.adjustScore")}</span>
                    </div>

                    {skillMode ? (
                    <div className="space-y-3">
                      {SKILLS.map(({ key, labelKey, icon: Icon }) => {
                        const aiN = aiScores[key as keyof typeof aiScores];
                        return (
                          <div key={key} className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 text-slate-400">
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-bold text-slate-600 w-14 flex-shrink-0">{t(labelKey)}</span>
                            <div className="flex-1 relative">
                              <input
                                type="number"
                                min={0}
                                max={10}
                                step={0.1}
                                value={scores[key] ?? ""}
                                onChange={(e) => setScores((prev) => ({ ...prev, [key]: e.target.value }))}
                                placeholder={aiN !== null ? `AI: ${aiN.toFixed(1)}` : "—"}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-semibold text-slate-800 placeholder:text-slate-400"
                              />
                            </div>
                            <span className="text-xs text-slate-400 w-8 text-right flex-shrink-0">/ 10</span>
                          </div>
                        );
                      })}
                    </div>
                    ) : (
                    <div className="space-y-4">
                      <button
                        type="button"
                        onClick={goToDetail}
                        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white transition-colors group cursor-pointer shadow-sm shadow-violet-200 active:scale-[0.99]"
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <ListChecks className="w-4 h-4 text-white" />
                          Chấm chi tiết từng câu
                        </span>
                        <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-all" />
                      </button>
                      <p className="text-[11.5px] text-slate-500 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                        Đề thi này được chấm điểm theo từng câu/từng phần để đảm bảo tính nhất quán với đáp án của học viên. Vui lòng mở trang chấm chi tiết để xem bài làm và điều chỉnh điểm.
                      </p>
                    </div>
                    )}
                  </div>

                  {/* Feedback */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("teacher.grading.reviewModal.feedback")}</span>
                    </div>
                    <textarea
                      rows={4}
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder={t("teacher.grading.reviewModal.feedbackPlaceholder")}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm resize-none focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all placeholder:text-slate-400 text-slate-700 leading-relaxed font-medium"
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-100">
                      <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                      <p className="text-xs font-semibold text-rose-700">{error}</p>
                    </div>
                  )}

                  {/* CTA */}
                  <div className="space-y-3">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-650/15 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                    >
                      {saving ? (
                        <><Loader2 className="w-4.5 h-4.5 animate-spin" /> {t("teacher.grading.reviewModal.saving")}</>
                      ) : (
                        <><CheckCircle2 className="w-4.5 h-4.5" /> {t("teacher.grading.reviewModal.confirmSave")}</>
                      )}
                    </button>

                    <p className="text-center text-[11px] font-medium text-slate-400">
                      {t("teacher.grading.reviewModal.afterConfirm")} <strong className="text-slate-500">{t("teacher.grading.reviewModal.statusReviewed")}</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

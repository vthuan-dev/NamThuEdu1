import { useParams, useNavigate, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Eye,
  TrendingUp,
  Clock,
  CheckCircle,
  ArrowLeft,
  BookOpen,
  Headphones,
  PenTool,
  Mic,
  User,
  Calendar,
  Award,
} from "lucide-react";
import { studentApi } from "../../../../services/studentApi";
import { usePageTitle } from "../../../../hooks/usePageTitle";

const PRIMARY = "#0ea5e9"; // Sky Blue
const STUDENT_BASE_PATH = "/hoc-vien";

// ─── Score Circle ─────────────────────────────────────────────────────────────
function ScoreCircle({ score: rawScore, maxScore: rawMaxScore = 100, isVstep }: { score: number | string; maxScore?: number | string; isVstep?: boolean }) {
  const score = typeof rawScore === "number" ? rawScore : parseFloat(rawScore) || 0;
  const maxScore = typeof rawMaxScore === "number" ? rawMaxScore : parseFloat(rawMaxScore) || 100;
  const circumference = 2 * Math.PI * 54;
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const offset = circumference - (percentage / 100) * circumference;
  
  // Clean color: Slate for low scores, Sky Blue for pass/medium, Emerald for high scores
  const color = percentage >= 80 ? "#10B981" : percentage >= 50 ? PRIMARY : "#EF4444";

  // Always display scaled to 10-point system to match the teacher's grading page
  const displayScore = maxScore > 0 ? (score / maxScore) * 10 : 0;

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="#F1F5F9" strokeWidth="6" />
        <circle
          cx="60" cy="60" r="54" fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span style={{ fontSize: 32, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>
          {isVstep ? displayScore.toFixed(1) : displayScore.toFixed(2)}
        </span>
        <span style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
          / 10
        </span>
      </div>
    </div>
  );
}

function getGrade(score: number, maxScore: number = 100) {
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (percentage >= 80) return { label: "Xuất sắc", color: "#047857", bg: "#D1FAE5", border: "#A7F3D0" };
  if (percentage >= 50) return { label: "Đạt", color: "#1E3A8A", bg: "#DBEAFE", border: "#BFDBFE" };
  return { label: "Chưa đạt", color: "#991B1B", bg: "#FEE2E2", border: "#FCA5A5" };
}

export function ResultDetail({ modalSubmissionId }: { modalSubmissionId?: number }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const submissionId = modalSubmissionId ?? Number(id);

  usePageTitle("Kết quả làm bài");

  const { data, isLoading } = useQuery({
    queryKey: ["submission", submissionId],
    queryFn: () => studentApi.getSubmissionDetail(submissionId),
    enabled: !!submissionId,
    // Tự refetch mỗi 8s khi đang chờ AI chấm — để cập nhật điểm Speaking ngay
    // khi job xong, user không cần F5.
    refetchInterval: (query) => {
      const status = String((query.state.data as any)?.data?.data?.sStatus ?? '').toLowerCase();
      return status === 'grading_subjective' || status === 'partially_graded' ? 8000 : false;
    },
  });

  const submission = (data as any)?.data?.data ?? (data as any)?.data;
  const vstepMeta = submission?.vstep_meta;
  const isVstep = vstepMeta?.is_vstep;
  const vstepScores = vstepMeta?.vstep_scores || {};
  const examId = submission?.exam_id ?? submission?.exam?.eId;
  const examType = String(submission?.exam?.eType ?? "").toUpperCase();

  const getSkillReviewUrl = (key: string) => {
    if (examType === "IELTS" && examId) {
      return `${STUDENT_BASE_PATH}/lam-bai-ielts/${examId}/${key}?review=${submissionId}`;
    }
    return `${STUDENT_BASE_PATH}/dap-an/${submissionId}`;
  };

  const scoreRaw = isVstep ? (vstepMeta?.overall_avg ?? 0) : (submission?.sScore ?? 0);
  const score = typeof scoreRaw === "number" ? scoreRaw : parseFloat(scoreRaw) || 0;
  const maxScore = isVstep ? 10 : (typeof submission?.exam?.eMax_score === "number" ? submission.exam.eMax_score : parseFloat(submission?.exam?.eMax_score) || 100);

  // ⚠️ "Đang chấm" detection — chung cho cả VSTEP/IELTS/Teens speaking:
  // - VSTEP/IELTS: backend trả overall_avg=null khi còn skill chưa chấm
  // - Teens/general: sStatus = grading_subjective khi AI đang chấm speaking
  const submissionStatusLower = String(submission?.sStatus ?? "").toLowerCase();
  const isAwaitingAi = submissionStatusLower === "grading_subjective" || submissionStatusLower === "partially_graded";
  const overallPending = isVstep
    ? (vstepMeta?.overall_avg === null || vstepMeta?.overall_avg === undefined)
    : isAwaitingAi;

  const vstepBand = vstepMeta?.vstep_band;
  let grade = getGrade(score, maxScore);
  if (isVstep) {
    if (vstepBand === 'C1') {
      grade = { label: "Bậc 5 (C1)", color: "#047857", bg: "#D1FAE5", border: "#A7F3D0" };
    } else if (vstepBand === 'B2') {
      grade = { label: "Bậc 4 (B2)", color: "#1E3A8A", bg: "#DBEAFE", border: "#BFDBFE" };
    } else if (vstepBand === 'B1') {
      grade = { label: "Bậc 3 (B1)", color: "#B45309", bg: "#FEF3C7", border: "#FDE68A" };
    } else if (vstepBand) {
      grade = { label: `Bậc 2 (${vstepBand})`, color: "#991B1B", bg: "#FEE2E2", border: "#FCA5A5" };
    } else {
      grade = { label: "Chờ chấm", color: "#64748B", bg: "#F1F5F9", border: "#E2E8F0" };
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 rounded-full animate-spin"
          style={{ borderColor: "#F5F3FF", borderTopColor: PRIMARY }} />
      </div>
    );
  }

  const answeredCorrect = submission?.answers?.filter((a: any) => a.saIs_correct)?.length ?? 0;
  const totalAnswered = submission?.answers?.length ?? 0;
  const totalQuestions = submission?.exam?.questions?.length ?? totalAnswered;
  const assignmentId = submission?.assignment_id;

  // Dynamically group sections from questions and answers
  const sections: Record<string, { correct: number; total: number; pointsEarned: number; pointsTotal: number }> = {};
  
  submission?.exam?.questions?.forEach((q: any) => {
    const secName = q.qSection || q.qSkill || "Khác";
    const normalizedName = secName.charAt(0).toUpperCase() + secName.slice(1);
    if (!sections[normalizedName]) {
      sections[normalizedName] = { correct: 0, total: 0, pointsEarned: 0, pointsTotal: 0 };
    }
    sections[normalizedName].total++;
    sections[normalizedName].pointsTotal += Number(q.qPoints) || 0;
  });

  submission?.answers?.forEach((ans: any) => {
    const q = ans.question;
    if (q) {
      const secName = q.qSection || q.qSkill || "Khác";
      const normalizedName = secName.charAt(0).toUpperCase() + secName.slice(1);
      if (!sections[normalizedName]) {
        sections[normalizedName] = { correct: 0, total: 0, pointsEarned: 0, pointsTotal: 0 };
      }
      if (ans.saIs_correct) {
        sections[normalizedName].correct++;
      }
      sections[normalizedName].pointsEarned += Number(ans.saPoints_awarded) || 0;
    }
  });

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return "";
    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) return timeStr;
      return date.toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="py-2 max-w-4xl mx-auto space-y-4 animate-fadeIn">
      {/* Back Button */}
      {!modalSubmissionId && (
        <button onClick={() => navigate(`${STUDENT_BASE_PATH}/bai-tap`)}
          className="flex items-center gap-2 text-sm font-semibold transition-colors hover:opacity-85 text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" /> Về danh sách bài tập
        </button>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Left Column: Score Card */}
        <div className="bg-slate-50/30 backdrop-blur-sm rounded-3xl p-5 flex flex-col items-center justify-center space-y-4 border border-slate-100"
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
          <div className="text-center">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Điểm số tổng quan</h2>
          </div>
          
          {overallPending ? (
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center border-4 border-amber-200">
                <Clock className="w-10 h-10 text-amber-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-amber-700">AI đang chấm</p>
                <p className="text-[11px] text-slate-500 mt-1">Điểm sẽ hiện sau ít phút</p>
              </div>
            </div>
          ) : (
            <ScoreCircle score={score} maxScore={maxScore} isVstep={isVstep} />
          )}
          
          <div className="text-center">
            <span className="px-4 py-1.5 rounded-full text-xs font-black border tracking-wider shadow-sm transition-all hover:scale-105"
              style={{
                background: overallPending ? "#FEF3C7" : grade.bg,
                color: overallPending ? "#B45309" : grade.color,
                borderColor: overallPending ? "#FDE68A" : grade.border,
              }}>
              {overallPending ? "Đang chấm bài" : grade.label}
            </span>
          </div>

          {/* Accuracy */}
          <div className="w-full pt-5 border-t border-slate-100/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 font-bold">Độ chính xác</span>
              <span className="text-xs font-black text-slate-800">
                {totalQuestions > 0 ? Math.round((answeredCorrect / totalQuestions) * 100) : 0}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F1F5F9" }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${totalQuestions > 0 ? (answeredCorrect / totalQuestions) * 100 : 0}%`,
                  background: `linear-gradient(90deg, ${PRIMARY}, #0284c7)`,
                }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-right font-medium">
              Đúng {answeredCorrect}/{totalQuestions} câu
            </p>
          </div>
        </div>

        {/* Right Column: Details & Stats & Actions */}
        <div className="md:col-span-2 bg-white rounded-3xl p-5 flex flex-col justify-between border border-slate-100"
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>

          {/* Header Info */}
          <div className="space-y-2">
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase text-slate-400 bg-slate-100">
              {submission?.exam?.eType ?? "BÀI THI"}
            </span>
            <h1 className="font-black text-slate-900 leading-snug tracking-tight" style={{ fontSize: 20 }}>
              {submission?.exam?.eTitle ?? "Bài thi"}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
              {submission?.sSubmit_time && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Nộp lúc {formatTime(submission?.sSubmit_time)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                {submission?.teacher_reviewed_at && submission?.exam?.teacher?.uName
                  ? <>Chấm bởi <span className="text-slate-500 font-semibold">{submission.exam.teacher.uName}</span></>
                  : <>Chấm bởi <span className="text-slate-500 font-semibold">Hệ thống</span></>
                }
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 my-4">
            {[
              { icon: CheckCircle, label: "Số câu đúng", value: `${answeredCorrect}/${totalQuestions}` },
              { icon: Clock, label: "Trạng thái", value: submission?.sStatus === "graded" ? "Đã chấm" : "Đã nộp" },
              { icon: TrendingUp, label: "Lần làm bài", value: `Lần thứ ${submission?.sAttempt ?? 1}` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-3.5 bg-slate-50 border border-slate-100 flex flex-col gap-2">
                <s.icon className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-slate-800 font-black text-sm">{s.value}</p>
                  <p className="text-slate-400 text-[10px] font-medium mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Action */}
          <div className="pt-4 border-t border-slate-100">
            <Link to={`${STUDENT_BASE_PATH}/dap-an/${submissionId}`}
              onClick={() => window.dispatchEvent(new Event("close-result-modal"))}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white bg-[#0ea5e9] hover:bg-[#0284c7] active:scale-[0.99] transition-all"
            >
              <Eye className="w-4 h-4" /> Xem đáp án chi tiết
            </Link>
          </div>

        </div>

      </div>

      {/* Detailed Information & Part/Skill Scores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* General Details Card */}
        <div className="bg-white rounded-3xl p-5 space-y-3 border border-slate-100"
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Thông tin chi tiết</h3>
          </div>
          <div className="space-y-3">
            {[
              { icon: User, label: "Học viên", value: submission?.user?.uName ?? "Chưa cập nhật" },
              { icon: Clock, label: "Ngày làm bài", value: submission?.sSubmit_time ? formatTime(submission?.sSubmit_time) : "—" },
              { icon: Calendar, label: "Ngày chấm", value: submission?.sGraded_time || submission?.teacher_reviewed_at ? formatTime(submission?.sGraded_time || submission?.teacher_reviewed_at) : "Chưa chấm điểm" },
              {
                icon: Award,
                label: "Người chấm",
                value: submission?.teacher_reviewed_at && submission?.exam?.teacher?.uName
                  ? submission.exam.teacher.uName
                  : "Hệ thống",
              },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-50/60 text-xs">
                  <div className="flex items-center gap-2 text-slate-400 font-bold">
                    <Icon className="w-3.5 h-3.5 text-slate-350 flex-shrink-0" />
                    <span>{item.label}:</span>
                  </div>
                  <span className="text-slate-700 font-bold text-right truncate max-w-[160px]" title={item.value}>
                    {item.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scores/Parts Details Card */}
        <div className="md:col-span-2 bg-white rounded-3xl p-5 space-y-3 border border-slate-100"
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Điểm số từng phần</h3>
          </div>
          
          {isVstep ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { key: "listening", label: "Kỹ năng Nghe", icon: Headphones,
                  val: vstepScores.listening,
                  correct: vstepMeta?.skill_stats?.listening?.correct,
                  total: vstepMeta?.skill_stats?.listening?.total },
                { key: "reading",   label: "Kỹ năng Đọc",  icon: BookOpen,
                  val: vstepScores.reading,
                  correct: vstepMeta?.skill_stats?.reading?.correct,
                  total: vstepMeta?.skill_stats?.reading?.total },
                { key: "writing",   label: "Kỹ năng Viết", icon: PenTool,
                  val: vstepScores.writing,  correct: null, total: null },
                { key: "speaking",  label: "Kỹ năng Nói",  icon: Mic,
                  val: vstepScores.speaking, correct: null, total: null },
              ] as const)
                .filter((s) => {
                  const sections: string[] = vstepMeta?.exam_sections ?? [];
                  return sections.length === 0 || sections.includes(s.key);
                })
                .map((s) => {
                const Icon = s.icon;
                const isPending = s.val === null || s.val === undefined;
                const skillUrl = getSkillReviewUrl(s.key);
                return (
                  <Link
                    key={s.key}
                    to={skillUrl}
                    onClick={() => modalSubmissionId && window.dispatchEvent(new Event("close-result-modal"))}
                    className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 hover:border-slate-200 flex items-center gap-3.5 transition-colors group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-white border border-slate-100 flex items-center justify-center flex-shrink-0 group-hover:border-slate-200">
                      <Icon className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{s.label}</p>
                      <div className="mt-0.5 flex items-baseline justify-between gap-2">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Chờ chấm
                          </span>
                        ) : (
                          <p className="text-sm font-black text-slate-800">
                            {Number(s.val).toFixed(1)}<span className="text-[10px] text-slate-400 font-normal">/10.0</span>
                          </p>
                        )}
                        {s.correct != null && s.total != null && s.total > 0 && (
                          <span className="text-[10px] text-slate-500 font-semibold">
                            Đúng {s.correct}/{s.total}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-slate-300 group-hover:text-slate-400 text-xs">›</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {Object.keys(sections).length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Không tìm thấy phần kiểm tra riêng biệt nào</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(sections).map(([name, stat]) => (
                    <div key={name} className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wide">{name}</h4>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">Số câu đúng: {stat.correct}/{stat.total}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-extrabold text-slate-800">{stat.pointsEarned.toFixed(1)} / {stat.pointsTotal.toFixed(1)}</p>
                        <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Điểm</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

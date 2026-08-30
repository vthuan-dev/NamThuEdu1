import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle,
  XCircle,
  MinusCircle,
  ArrowLeft,
  Filter,
} from "lucide-react";
import { studentApi } from "../../../../services/studentApi";

const PRIMARY = "#0EA5E9";
const PRIMARY_LIGHT = "#E0F2FE";

type FilterType = "all" | "correct" | "wrong" | "unanswered";

export function AnswerReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const submissionId = Number(id);
  const [filter, setFilter] = useState<FilterType>("all");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["answers", submissionId],
    queryFn: () => studentApi.getAnswers(submissionId),
    enabled: !!submissionId,
  });

  const rawData = (data as any)?.data?.data ?? (data as any)?.data;
  const examType = String(rawData?.submission_info?.exam_type ?? "").toUpperCase();
  const isVstep = examType === "VSTEP";
  const isIelts = examType === "IELTS";
  const isThpt = examType === "THPT";
  // VSTEP/IELTS/THPT đều có UI review riêng → AnswerReview chỉ là trung gian redirect.
  // THPT lưu bài trong submission_payload (không phải submission_answers), nên UI
  // review chung sẽ rỗng → phải chuyển sang trang kết quả THPT chuyên biệt.
  const shouldRedirect = isVstep || isIelts || isThpt;
  const examId = rawData?.submission_info?.exam_id;

  // Ensure modal is closed on mount
  useEffect(() => {
    window.dispatchEvent(new Event("close-result-modal"));
  }, []);

  useEffect(() => {
    // THPT chỉ cần submissionId (trang kết quả tự tải payload theo submission).
    if (isThpt && submissionId) {
      window.dispatchEvent(new Event("close-result-modal"));
      navigate(`/hoc-vien/ket-qua-thpt/${submissionId}`, { replace: true });
      return;
    }
    if (shouldRedirect && examId && submissionId) {
      window.dispatchEvent(new Event("close-result-modal"));
      const ieltsSkill = String(rawData?.submission_info?.exam_skill ?? "listening").toLowerCase();
      if (isIelts) {
        navigate(`/hoc-vien/lam-bai-ielts/${examId}/${ieltsSkill}?review=${submissionId}`, { replace: true });
      } else {
        navigate(`/hoc-vien/lam-bai-vstep/${examId}?review=${submissionId}`, { replace: true });
      }
    }
  }, [shouldRedirect, isIelts, isThpt, examId, submissionId, navigate, rawData]);

  const rawItems = rawData?.detailed_answers ?? (Array.isArray(rawData) ? rawData : []);
  const items: any[] = Array.isArray(rawItems)
    ? rawItems
    : (rawItems && typeof rawItems === "object" ? Object.values(rawItems) : []);

  const filtered = items.filter((item) => {
    if (filter === "correct") return item.student_answer?.saIs_correct === true;
    if (filter === "wrong") return item.student_answer?.saIs_correct === false && item.student_answer !== null;
    if (filter === "unanswered") return !item.student_answer;
    return true;
  });

  const correctCount = items.filter((i) => i.student_answer?.saIs_correct).length;
  const wrongCount = items.filter((i) => i.student_answer && !i.student_answer.saIs_correct).length;
  const unansweredCount = items.filter((i) => !i.student_answer).length;

  const filterBtns: { key: FilterType; label: string; count: number; color: string }[] = [
    { key: "all", label: "Tất cả", count: items.length, color: "#6B7280" },
    { key: "correct", label: "Đúng", count: correctCount, color: "#10B981" },
    { key: "wrong", label: "Sai", count: wrongCount, color: "#EF4444" },
    { key: "unanswered", label: "Chưa trả lời", count: unansweredCount, color: "#F59E0B" },
  ];

  // Scroll detection for current question
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight / 2;
      let newCurrent = 0;

      for (let i = 0; i < filtered.length; i++) {
        const el = questionRefs.current[i];
        if (el) {
          const rect = el.getBoundingClientRect();
          const absoluteTop = rect.top + window.scrollY;
          if (absoluteTop <= scrollPosition) {
            newCurrent = i;
          }
        }
      }

      setCurrentQuestion(newCurrent);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => window.removeEventListener("scroll", handleScroll);
  }, [filtered]);

  const scrollToQuestion = (index: number) => {
    const el = questionRefs.current[index];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setCurrentQuestion(index);
    }
  };

  useEffect(() => {
    const activeBtn = document.getElementById(`mb-nav-item-${currentQuestion}`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [currentQuestion]);

  if (isLoading || shouldRedirect) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 rounded-full animate-spin"
          style={{ borderColor: PRIMARY_LIGHT, borderTopColor: PRIMARY }} />
        {shouldRedirect && (
          <p className="text-sm font-semibold text-slate-500 animate-pulse">
            Đang chuyển hướng sang giao diện xem lại bài thi {isIelts ? "IELTS" : "VSTEP"}...
          </p>
        )}
      </div>
    );
  }

  if (error) {
    const errorMsg = (error as any)?.response?.data?.message || (error as any)?.message || "Đã xảy ra lỗi khi tải đáp án.";
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center border border-red-100 shadow-xl space-y-6">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
            <XCircle className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1F1344" }}>Không thể xem đáp án</h2>
            <p style={{ fontSize: 14, color: "#6B7280" }}>{errorMsg}</p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="w-full py-3 rounded-2xl font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${PRIMARY}, #38BDF8)` }}
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6 py-4 sm:py-6 px-3 sm:px-4 max-w-7xl mx-auto">
      {/* Sidebar - Question list */}
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-6 space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Danh sách câu hỏi</h3>
            <p className="text-xs text-slate-500 mb-4">Tổng: {filtered.length} câu</p>
            <div className="grid grid-cols-5 gap-2">
              {filtered.map((item: any, idx: number) => {
                const studentAns = item.student_answer;
                const isCorrect = studentAns?.saIs_correct === true;
                const isWrong = studentAns && !isCorrect;
                const isUnanswered = !studentAns;
                const isCurrent = idx === currentQuestion;

                const bgColor = isCorrect ? "#10B981" : isWrong ? "#EF4444" : isUnanswered ? "#F59E0B" : "#E5E7EB";
                const textColor = isCorrect || isWrong || isUnanswered ? "#fff" : "#6B7280";

                return (
                  <button
                    key={idx}
                    onClick={() => scrollToQuestion(idx)}
                    className={`aspect-square rounded-lg text-xs font-bold transition-all hover:opacity-80 ${
                      isCurrent ? "ring-2 ring-offset-1" : ""
                    }`}
                    style={{
                      background: bgColor,
                      color: textColor,
                      ...(isCurrent ? { ringColor: PRIMARY } : {}),
                    }}
                    title={`Câu ${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 mb-2">Chú thích</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ background: "#10B981" }}></div>
                <span className="text-slate-600">Đúng</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ background: "#EF4444" }}></div>
                <span className="text-slate-600">Sai</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ background: "#F59E0B" }}></div>
                <span className="text-slate-600">Chưa trả lời</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate("/hoc-vien/bai-tap")}
            className="w-full px-4 py-2.5 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${PRIMARY}, #38BDF8)` }}
          >
            Chấp nhận
          </button>
        </div>
      </aside>

      {/* Main content */}
      {/* Main content. `min-w-0` là bắt buộc: mặc định flex item không co nhỏ
          hơn nội dung, nên một chuỗi dài không có khoảng trắng trong đề bài sẽ
          đẩy cả cột rộng ra và tạo cuộn ngang toàn trang. */}
      <div className="flex-1 min-w-0 max-w-3xl space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="p-2 rounded-xl transition-colors hover:bg-sky-50"
            style={{ color: PRIMARY }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1F1344" }}>Xem đáp án</h1>
            <p style={{ fontSize: 13, color: "#9CA3AF" }}>
              {correctCount}/{items.length} câu đúng · Submission #{submissionId}
            </p>
          </div>
        </div>

        {/* Mobile Question Navigator.
            `top-0` thay vì `top-[52px]`: 52px là chiều cao header của một layout
            cụ thể, mà trang này dùng chung cho cả ba nhóm tuổi với ba layout
            khác nhau — số cứng đó sai ở ít nhất hai trong ba trường hợp. */}
        {filtered.length > 0 && (
          <div className="lg:hidden flex overflow-x-auto gap-2 py-2 px-1 sticky top-0 bg-white/95 backdrop-blur z-15 border-b border-slate-100 shadow-sm mb-3 scrollbar-none">
            {filtered.map((item: any, idx: number) => {
              const studentAns = item.student_answer;
              const isCorrect = studentAns?.saIs_correct === true;
              const isWrong = studentAns && !isCorrect;
              const isUnanswered = !studentAns;
              const isCurrent = idx === currentQuestion;

              const bgColor = isCorrect ? "#10B981" : isWrong ? "#EF4444" : isUnanswered ? "#F59E0B" : "#E5E7EB";
              const textColor = isCorrect || isWrong || isUnanswered ? "#fff" : "#6B7280";

              return (
                <button
                  key={idx}
                  id={`mb-nav-item-${idx}`}
                  onClick={() => scrollToQuestion(idx)}
                  title={`Câu ${idx + 1}`}
                  // 40px thay vì 32px: các ô sát nhau trong dải cuộn ngang nên
                  // ngón tay dễ bấm lệch sang câu bên cạnh.
                  className={`w-10 h-10 rounded-lg flex-shrink-0 text-xs font-bold transition-all ${
                    isCurrent ? "ring-2 ring-offset-1" : ""
                  }`}
                  style={{
                    background: bgColor,
                    color: textColor,
                    ...(isCurrent ? { ringColor: PRIMARY } : {}),
                  }}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        )}

      {/* Score summary bar */}
      <div className="rounded-2xl p-4 bg-white flex items-center gap-4 flex-wrap"
        style={{ border: "1.5px solid #F0EEFF" }}>
        {[
          { val: correctCount, label: "Đúng", color: "#10B981", bg: "#D1FAE5" },
          { val: wrongCount, label: "Sai", color: "#EF4444", bg: "#FEE2E2" },
          { val: unansweredCount, label: "Bỏ qua", color: "#F59E0B", bg: "#FEF3C7" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: s.bg }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.val}</span>
            <span style={{ fontSize: 12, color: s.color }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {filterBtns.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: filter === f.key ? PRIMARY : "#F3F4F6",
              color: filter === f.key ? "#fff" : "#6B7280",
            }}>
            <Filter className="w-3 h-3" />
            {f.label}
            <span className="px-1.5 py-0.5 rounded-lg text-xs"
              style={{
                background: filter === f.key ? "rgba(255,255,255,0.25)" : "#E5E7EB",
                color: filter === f.key ? "#fff" : "#374151",
              }}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Question list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Không có câu nào trong bộ lọc này</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item: any, idx: number) => {
            const q = item.question;
            const studentAns = item.student_answer;
            const correctAns = item.correct_answer;
            const isCorrect = studentAns?.saIs_correct === true;
            const isWrong = studentAns && !isCorrect;
            const isUnanswered = !studentAns;

            const statusColor = isCorrect ? "#10B981" : isWrong ? "#EF4444" : "#F59E0B";
            const statusBg = isCorrect ? "#D1FAE5" : isWrong ? "#FEE2E2" : "#FEF3C7";
            const StatusIcon = isCorrect ? CheckCircle : isWrong ? XCircle : MinusCircle;

            return (
              <div
                key={q?.qId ?? idx}
                ref={(el) => { questionRefs.current[idx] = el; }}
                className="rounded-2xl p-5 bg-white"
                style={{
                  border: `1.5px solid ${isCorrect ? "#D1FAE5" : isWrong ? "#FECACA" : "#FDE68A"}`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}>
                {/* Question header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-sm"
                    style={{ background: statusColor }}>
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusIcon className="w-4 h-4" style={{ color: statusColor }} />
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: statusBg, color: statusColor }}>
                        {isCorrect ? "Đúng" : isWrong ? "Sai" : "Chưa trả lời"}
                      </span>
                      <span className="text-xs" style={{ color: "#9CA3AF" }}>
                        {q?.qPoints ?? 0} điểm
                      </span>
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#1F1344", lineHeight: 1.6 }}
                      dangerouslySetInnerHTML={{ __html: q?.qContent ?? "" }} />
                  </div>
                </div>

                {/* Answer rows */}
                <div className="space-y-2 ml-10">
                  {/* All options */}
                  {(item.all_options ?? []).map((opt: any, oi: number) => {
                    const isStudentChoice = studentAns?.saAnswer_text === opt.aContent;
                    const isCorrectOpt = correctAns?.aContent === opt.aContent;
                    let optBg = "#F9FAFB";
                    let optBorder = "#E5E7EB";
                    let optColor = "#374151";
                    if (isCorrectOpt) { optBg = "#D1FAE5"; optBorder = "#10B981"; optColor = "#065F46"; }
                    else if (isStudentChoice && !isCorrectOpt) { optBg = "#FEE2E2"; optBorder = "#EF4444"; optColor = "#991B1B"; }

                    return (
                      <div key={opt.aId} className="flex items-center gap-3 p-3 rounded-xl"
                        style={{ background: optBg, border: `1.5px solid ${optBorder}` }}>
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: optBorder, color: "#fff" }}>
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <p style={{ fontSize: 14, color: optColor, fontWeight: isCorrectOpt || isStudentChoice ? 600 : 400 }}>
                          {opt.aContent}
                        </p>
                        <div className="ml-auto flex items-center gap-1 flex-shrink-0">
                          {isCorrectOpt && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                          {isStudentChoice && !isCorrectOpt && <XCircle className="w-4 h-4 text-red-500" />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {q?.qExplanation && (
                  <div className="ml-10 mt-3 p-3 rounded-xl"
                    style={{ background: PRIMARY_LIGHT, border: `1px solid ${PRIMARY}20` }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, marginBottom: 4 }}>💡 Giải thích</p>
                    <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{q.qExplanation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}

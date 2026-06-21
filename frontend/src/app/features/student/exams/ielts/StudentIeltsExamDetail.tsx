/**
 * StudentIeltsExamDetail — Trang chi tiết đề IELTS cho học viên (giống study4.com).
 *
 * Học viên thấy:
 *   • Hero: tags, title, meta (duration, parts, questions, comments)
 *   • 2 sub-tabs: "Thông tin đề thi" | "Đáp án/transcript" (chỉ unlock sau khi nộp)
 *   • Mode tabs: "Luyện tập" | "Làm full test" | "Thảo luận"
 *   • Practice mode: chọn sections + thời gian → start practice
 *   • Full test mode: confirmation → start full test
 *
 * URL: /hoc-vien/de-thi/ielts/:examId
 * Khi click "LUYỆN TẬP" → /hoc-vien/lam-bai-ielts/:examId?sections=1,2&time=30
 * Khi click "BẮT ĐẦU THI" → /hoc-vien/lam-bai-ielts/:examId/<skill>
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  Clock,
  Users,
  MessageCircle,
  Lightbulb,
  AlertCircle,
  Lock,
  Layers,
  HelpCircle,
  Loader2,
  Headphones,
  BookOpen,
  PenLine,
  Mic,
  ArrowLeft,
} from "lucide-react";
import { api } from "../../../../../services/api";
import { usePageTitle } from "../../../../../hooks/usePageTitle";
import { ExamComments } from "./components/ExamComments";

// ─── Types ───────────────────────────────────────────────────────────────
type IeltsSkill = "listening" | "reading" | "writing" | "speaking";
type IeltsTestType = "Academic" | "General Training";
type ModeTab = "practice" | "full_test" | "discussion";

interface SectionInfo {
  index: number;
  name: string;
  questionCount: number;
  questionTypes: string[];
}

interface IeltsExamDetailData {
  examId: number;
  title: string;
  description?: string;
  testType: IeltsTestType;
  skill: IeltsSkill;
  scope: "full" | "single";
  availableSkills: IeltsSkill[];
  duration: number;
  totalQuestions: number;
  totalParts: number;
  participants: number;
  commentsCount: number;
  sections: SectionInfo[];
  playMode: {
    practice_enabled: boolean;
    full_test_enabled: boolean;
    time_limit_options: (number | null)[];
  };
  activeSession?: {
    submissionId: number;
    started_at: string;
    deadline_at?: string;
    server_time?: string;
    time_remaining_seconds: number;
    duration_seconds: number;
    answered_count: number;
  } | null;
}

const SKILL_META: Record<IeltsSkill, { label: string; icon: any; color: string; bg: string }> = {
  listening: { label: "Listening", icon: Headphones, color: "#2563EB", bg: "#EFF6FF" },
  reading:   { label: "Reading",   icon: BookOpen,   color: "#10B981", bg: "#ECFDF5" },
  writing:   { label: "Writing",   icon: PenLine,    color: "#F97316", bg: "#FFF7ED" },
  speaking:  { label: "Speaking",  icon: Mic,        color: "#A855F7", bg: "#FAF5FF" },
};

// ─── Component ───────────────────────────────────────────────────────────
export function StudentIeltsExamDetail() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  usePageTitle("Đề thi IELTS");

  const [data, setData] = useState<IeltsExamDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<ModeTab>(() => {
    // Init from query param (?tab=discussion) — dùng cho deeplink từ notification
    const tab = searchParams.get("tab");
    return tab === "discussion" ? "discussion" : "practice";
  });
  const [slowConnection, setSlowConnection] = useState(false);
  const [retryCounter, setRetryCounter] = useState(0);

  // Sync activeMode khi URL search params đổi — quan trọng khi user đang ở
  // trang detail rồi click 1 noti khác cùng exam (component không remount,
  // useState init chỉ chạy 1 lần). Phải watch searchParams trực tiếp.
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "discussion" && activeMode !== "discussion") {
      setActiveMode("discussion");
    }
  }, [searchParams]);

  const handleRetry = () => {
    setRetryCounter((n) => n + 1);
  };

  useEffect(() => {
    if (!examId) {
      setErrorMsg("Thiếu mã đề thi");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    // Show "loading too long" warning sau 5s để user biết là server chậm
    const slowWarningTimer = window.setTimeout(() => {
      if (!cancelled) setSlowConnection(true);
    }, 5000);

    (async () => {
      try {
        setLoading(true);
        setSlowConnection(false);
        setErrorMsg(null);

        const res = await api.get(`/student/exams/${examId}/ielts/detail`, {
          signal: controller.signal,
          timeout: 15000, // cap 15s riêng cho endpoint này
        });
        if (cancelled) return;

        const raw = res.data?.data || res.data;
        const parsed = parseExamData(raw);
        setData(parsed);
        // Chỉ override mode nếu user KHÔNG có deeplink ?tab=discussion
        // (tránh ghi đè khi user click noti vào tab Thảo luận)
        const requestedTab = searchParams.get("tab");
        if (requestedTab !== "discussion") {
          setActiveMode(parsed.playMode.practice_enabled ? "practice" : "full_test");
        }
      } catch (err: any) {
        if (cancelled) return;
        // Phân biệt rõ các loại lỗi để user dễ hiểu
        if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return;
        if (err?.code === "ECONNABORTED" || /timeout/i.test(err?.message || "")) {
          setErrorMsg("Server phản hồi quá chậm. Vui lòng thử lại.");
        } else if (err?.response?.status === 404) {
          setErrorMsg("Không tìm thấy đề thi này (có thể đã bị xóa hoặc chưa xuất bản).");
        } else if (err?.response?.status === 401 || err?.response?.status === 403) {
          setErrorMsg("Bạn không có quyền truy cập đề thi này.");
        } else {
          setErrorMsg(err?.response?.data?.message || err?.message || "Không thể tải thông tin đề thi");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          window.clearTimeout(slowWarningTimer);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(slowWarningTimer);
    };
  }, [examId, retryCounter]);

  // ── Loading / Error states ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600">Đang tải đề thi...</p>
          {slowConnection && (
            <div className="mt-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-xs text-amber-700">
                Server phản hồi chậm hơn bình thường. Bạn có thể chờ thêm hoặc{" "}
                <button
                  type="button"
                  onClick={handleRetry}
                  className="font-semibold underline hover:no-underline cursor-pointer"
                >
                  thử lại
                </button>
                .
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-gray-900 mb-2">
            Không thể tải đề thi
          </h1>
          <p className="text-sm text-gray-600 mb-4">{errorMsg}</p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleRetry}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Thử lại
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 rounded-lg bg-white text-gray-700 border border-gray-300 font-semibold text-sm hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <DetailContent data={data} activeMode={activeMode} setActiveMode={setActiveMode} />;
}

// ─── Detail Content ──────────────────────────────────────────────────────
function DetailContent({
  data,
  activeMode,
  setActiveMode,
}: {
  data: IeltsExamDetailData;
  activeMode: ModeTab;
  setActiveMode: (m: ModeTab) => void;
}) {
  const navigate = useNavigate();
  const meta = SKILL_META[data.skill];
  const SkillIcon = meta.icon;
  const [activeSession, setActiveSession] = useState(data.activeSession ?? null);
  const [discardingSession, setDiscardingSession] = useState(false);

  // Đọc practice scope đã lưu (nếu có) khi học viên đã chọn 1 section + thời gian
  // và đang có phiên dở → "Tiếp tục bài đang làm" phải giữ NGUYÊN scope đó,
  // KHÔNG fallback sang full_test (sẽ render hết 40 câu, chấm sai).
  const savedScope = readIeltsPracticeScope(data.examId, data.skill);
  const continueUrl = (() => {
    if (data.scope === "full") return `/hoc-vien/lam-bai-ielts/${data.examId}`;
    const base = `/hoc-vien/lam-bai-ielts/${data.examId}/${data.skill}`;
    if (savedScope && savedScope.sections.length > 0) {
      const params = new URLSearchParams();
      params.set("mode", "practice");
      params.set("sections", savedScope.sections.join(","));
      if (savedScope.time) params.set("time", String(savedScope.time));
      return `${base}?${params.toString()}`;
    }
    return `${base}?mode=full_test`;
  })();
  const hasBlockingSession = !!activeSession;
  const handleDiscardSession = async () => {
    try {
      setDiscardingSession(true);
      await api.post(`/student/exams/${data.examId}/discard-active-session`);
      data.availableSkills.forEach((skill) => clearIeltsLocalDeadlines(data.examId, skill));
      // Practice scope cũng phải clear, không thì lần start mới ăn lại scope cũ
      data.availableSkills.forEach((skill) => clearIeltsPracticeScope(data.examId, skill));
      setActiveSession(null);
    } finally {
      setDiscardingSession(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top back nav */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Quay lại"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0"
              style={{ background: meta.bg, color: meta.color }}
            >
              <SkillIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">IELTS {data.testType}</p>
              <p className="text-sm font-semibold text-gray-900 truncate">
                {meta.label}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* ── Hero card ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-block px-2 py-1 rounded-md text-[11px] font-medium bg-gray-100 text-gray-700">
              #IELTS {data.testType}
            </span>
            <span className="inline-block px-2 py-1 rounded-md text-[11px] font-medium bg-gray-100 text-gray-700">
              #{capitalize(data.skill)}
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 break-words">
            {data.title}
          </h1>

          {/* Sub-tabs (locked) */}
          <div className="flex items-center gap-2 mb-4">
            <SubTab active>Thông tin đề thi</SubTab>
            <SubTab locked>Đáp án/transcript</SubTab>
          </div>

          {/* Meta line */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700 mb-2">
            <Meta icon={Clock}>
              Thời gian làm bài: <b>{data.duration} phút</b>
            </Meta>
            <span className="text-gray-300">|</span>
            <Meta icon={Layers}>
              <b>{data.totalParts}</b> phần thi
            </Meta>
            <span className="text-gray-300">|</span>
            <Meta icon={HelpCircle}>
              <b>{data.totalQuestions}</b> câu hỏi
            </Meta>
            <span className="text-gray-300">|</span>
            <Meta icon={MessageCircle}>{data.commentsCount} bình luận</Meta>
          </div>
          <Meta icon={Users} className="text-sm text-gray-700 mb-3">
            <b>{data.participants.toLocaleString("vi-VN")}</b> người đã luyện tập đề thi này
          </Meta>

          <p className="text-xs italic text-red-500 mb-5">
            Chú ý: để được quy đổi sang scaled score (ví dụ trên thang điểm 9.0 cho
            IELTS), vui lòng chọn chế độ làm <b>FULL TEST</b>.
          </p>

          {activeSession && (
            <ActiveSessionChoice
              session={activeSession}
              totalQuestions={data.totalQuestions}
              onContinue={() => navigate(continueUrl)}
              onDiscardSession={handleDiscardSession}
              discardLoading={discardingSession}
            />
          )}

          {/* Mode tabs */}
          <div className="flex items-center gap-6 border-b border-gray-200 mb-5">
            <ModeTabBtn
              active={activeMode === "practice"}
              disabled={!data.playMode.practice_enabled}
              onClick={() => setActiveMode("practice")}
            >
              Luyện tập
            </ModeTabBtn>
            <ModeTabBtn
              active={activeMode === "full_test"}
              disabled={!data.playMode.full_test_enabled}
              onClick={() => setActiveMode("full_test")}
            >
              Làm full test
            </ModeTabBtn>
            <ModeTabBtn
              active={activeMode === "discussion"}
              onClick={() => setActiveMode("discussion")}
            >
              Thảo luận
            </ModeTabBtn>
          </div>

          {/* Mode content */}
          {activeMode === "practice" && (
            <PracticeMode data={data} blockedByActiveSession={hasBlockingSession} />
          )}

          {activeMode === "full_test" && (
            <FullTestMode data={data} blockedByActiveSession={hasBlockingSession} />
          )}

          {activeMode === "discussion" && (
            <ExamComments
              examId={data.examId}
              currentUserId={(() => {
                try {
                  const u = localStorage.getItem("user");
                  return u ? JSON.parse(u)?.uId : undefined;
                } catch { return undefined; }
              })()}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Practice Mode ───────────────────────────────────────────────────────
function PracticeMode({
  data,
  blockedByActiveSession = false,
}: {
  data: IeltsExamDetailData;
  blockedByActiveSession?: boolean;
}) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [timeLimit, setTimeLimit] = useState<string>("");
  const [userPickedTime, setUserPickedTime] = useState(false);

  if (!data.playMode.practice_enabled) {
    return <DisabledState label="Luyện tập" />;
  }

  const toggle = (idx: number) => {
    const next = new Set(selected);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    setSelected(next);
  };

  // Gợi ý thời gian theo CHUẨN IELTS (chỉ khi user chưa tự chọn).
  // Listening 40' (full 4 part) · Reading 60' (full 3 passage) · Writing 60' (2 task) · Speaking ~14'.
  // Khi chọn lẻ part: chia tỷ lệ theo full duration.
  const suggestedTime = (() => {
    if (selected.size === 0 || data.totalParts === 0) return "";
    const fullByskill: Record<string, number> = {
      listening: 40,
      reading: 60,
      writing: 60,
      speaking: 14,
    };
    const full = fullByskill[data.skill] ?? 30;
    if (selected.size >= data.totalParts) return String(full);
    // Chia đều theo số part chọn, làm tròn lên nearest 5'
    const per = full / data.totalParts;
    const total = Math.ceil((per * selected.size) / 5) * 5;
    return String(Math.max(5, total));
  })();

  // Tự cập nhật suggestedTime khi user chưa override
  useEffect(() => {
    if (!userPickedTime) setTimeLimit(suggestedTime);
  }, [suggestedTime, userPickedTime]);

  const handleStart = () => {
    if (blockedByActiveSession) return;
    if (selected.size === 0) return;
    const sortedSections = Array.from(selected).sort((a, b) => a - b);
    const sectionsParam = sortedSections.join(",");
    const params = new URLSearchParams();
    params.set("mode", "practice");
    params.set("sections", sectionsParam);
    if (timeLimit) params.set("time", timeLimit);
    // Lưu scope để khi student F5 / out-vào lại bấm "Tiếp tục bài đang làm"
    // vẫn render đúng N section đã chọn (không bị reset thành full 40 câu).
    saveIeltsPracticeScope(data.examId, data.skill, {
      sections: sortedSections,
      time: timeLimit ? Number(timeLimit) : null,
    });
    navigate(`/hoc-vien/lam-bai-ielts/${data.examId}/${data.skill}?${params.toString()}`);
  };

  return (
    <>
      <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-100 mb-5">
        <Lightbulb className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-emerald-800">
          <b>Pro tips:</b> Hình thức luyện tập từng phần và chọn mức thời gian phù hợp
          sẽ giúp bạn tập trung vào giải đúng các câu hỏi thay vì phải chịu áp lực
          hoàn thành bài thi.
        </p>
      </div>

      <div className="mb-5">
        <p className="text-sm font-semibold text-gray-900 mb-3">
          Chọn phần thi bạn muốn làm
        </p>
        <div className="space-y-2">
          {data.sections.map((sec) => (
            <label
              key={sec.index}
              className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer transition-all"
            >
              <input
                type="checkbox"
                checked={selected.has(sec.index)}
                onChange={() => toggle(sec.index)}
                className="mt-1 w-4 h-4 rounded text-blue-600 cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {sec.name}{" "}
                  <span className="text-gray-500 font-normal">({sec.questionCount} câu hỏi)</span>
                </p>
                {sec.questionTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {sec.questionTypes.map((qt, i) => (
                      <span
                        key={i}
                        className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700"
                      >
                        #[{capitalize(data.skill)}] {qt}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>

      {data.playMode.time_limit_options.length > 0 && (
        <div className="mb-5">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Giới hạn thời gian{" "}
            <span className="font-normal text-gray-500">
              (Để trống để làm bài không giới hạn)
            </span>
          </label>
          <select
            value={timeLimit}
            onChange={(e) => { setTimeLimit(e.target.value); setUserPickedTime(true); }}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
          >
            <option value="">-- Chọn thời gian --</option>
            {data.playMode.time_limit_options.map((opt) => (
              <option key={String(opt)} value={String(opt ?? "")}>
                {opt === null ? "Không giới hạn" : `${opt} phút`}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handleStart}
          disabled={selected.size === 0 || blockedByActiveSession}
          title={blockedByActiveSession ? "Vui lòng xóa phiên bài làm đang dở trước khi bắt đầu phiên mới." : undefined}
          className="px-6 py-2.5 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
        >
          LUYỆN TẬP
        </button>
        {blockedByActiveSession && (
          <span className="text-xs font-medium text-amber-700">
            Đang có phiên bài làm dở. Hãy tiếp tục hoặc xóa phiên trước khi luyện tập phần mới.
          </span>
        )}
      </div>
    </>
  );
}

// ─── Full Test Mode ──────────────────────────────────────────────────────
function FullTestMode({
  data,
  blockedByActiveSession = false,
}: {
  data: IeltsExamDetailData;
  blockedByActiveSession?: boolean;
}) {
  const navigate = useNavigate();

  if (!data.playMode.full_test_enabled) {
    return <DisabledState label="Làm full test" />;
  }

  const handleStart = () => {
    if (blockedByActiveSession) return;
    // Khi chuyển sang full test, phải clear practice scope cũ (nếu có) để
    // tránh lần "Tiếp tục bài đang làm" sau đó render nhầm scope practice.
    clearIeltsPracticeScope(data.examId, data.skill);
    navigate(
      data.scope === "full"
        ? `/hoc-vien/lam-bai-ielts/${data.examId}`
        : `/hoc-vien/lam-bai-ielts/${data.examId}/${data.skill}?mode=full_test`
    );
  };

  return (
    <>
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 mb-5">
        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-800">
          <b>Sẵn sàng để bắt đầu làm full test?</b> Để đạt được kết quả tốt nhất, bạn
          cần dành ra <b>{data.duration} phút</b> cho bài test này.
        </p>
      </div>
      <button
        type="button"
        onClick={handleStart}
        disabled={blockedByActiveSession}
        title={blockedByActiveSession ? "Vui lòng xóa phiên bài làm đang dở trước khi bắt đầu phiên mới." : undefined}
        className="px-6 py-2.5 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
      >
        BẮT ĐẦU THI
      </button>
    </>
  );
}

function ActiveSessionChoice({
  session,
  totalQuestions,
  onContinue,
  onDiscardSession,
  discardLoading,
}: {
  session: NonNullable<IeltsExamDetailData["activeSession"]>;
  totalQuestions: number;
  onContinue: () => void;
  onDiscardSession: () => void;
  discardLoading: boolean;
}) {
  const [remainingSeconds, setRemainingSeconds] = useState(() => getSessionRemainingSeconds(session, Date.now()));

  useEffect(() => {
    const receivedAt = Date.now();
    setRemainingSeconds(getSessionRemainingSeconds(session, receivedAt));
    const timer = window.setInterval(() => {
      setRemainingSeconds(getSessionRemainingSeconds(session, receivedAt));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  const answeredText = totalQuestions > 0
    ? `Đã trả lời ${session.answered_count}/${totalQuestions} câu`
    : `Đã trả lời ${session.answered_count} câu`;

  return (
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-white px-2 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200">
              Có phiên đang làm
            </span>
            <span className="text-xs font-semibold text-amber-900">
              Còn {formatRemaining(remainingSeconds)}
            </span>
            <span className="text-xs text-amber-700">
              {answeredText}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            Bạn có thể tiếp tục bài làm dang dở. Muốn bắt đầu phiên mới, hãy xóa phiên bài làm hiện tại trước.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700"
          >
            Tiếp tục bài đang làm
          </button>
          <button
            type="button"
            onClick={onDiscardSession}
            disabled={discardLoading}
            className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:cursor-wait disabled:opacity-70"
          >
            {discardLoading ? "Đang xóa phiên..." : "Xóa phiên bài làm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Discussion Mode (placeholder) ──────────────────────────────────────
function DiscussionMode() {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      <MessageCircle className="w-10 h-10 text-gray-300 mb-2" />
      <p className="text-sm font-semibold text-gray-700">Chưa có bình luận</p>
      <p className="text-xs text-gray-500 mt-1">
        Hãy là người đầu tiên thảo luận về đề thi này.
      </p>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function parseExamData(raw: any): IeltsExamDetailData {
  // Parse từ response API — cần backend trả về đúng format
  const config = raw.ielts_config || {};
  const rawSkill = String(raw.ielts_skill || raw.eSkill || raw.skill || "listening").toLowerCase();
  const scope: "full" | "single" = raw.scope === "full" || rawSkill === "mixed" ? "full" : "single";
  const playMode = {
    ...(config.play_modes || {
    practice_enabled: true,
    full_test_enabled: true,
    // Theo chuẩn IELTS: Listening 40' · Reading 60' · Writing 60' · Speaking 11–14'
    time_limit_options: [null, 5, 10, 15, 20, 30, 40, 45, 60],
    }),
    practice_enabled: scope === "full" ? false : (config.play_modes?.practice_enabled ?? true),
  };
  const isIeltsSkill = (value: string): value is IeltsSkill =>
    ["listening", "reading", "writing", "speaking"].includes(value);
  const normalizedRawSkill: IeltsSkill = isIeltsSkill(rawSkill) ? rawSkill : "listening";
  const availableSkills = Array.isArray(raw.available_skills) && raw.available_skills.length
    ? raw.available_skills
        .map((item: unknown) => String(item).toLowerCase())
        .filter(isIeltsSkill)
    : scope === "full"
      ? ["listening", "reading", "writing", "speaking"]
      : [normalizedRawSkill];
  const skill: IeltsSkill = scope === "full" ? (availableSkills[0] ?? "listening") : normalizedRawSkill;
  const testType: IeltsTestType =
    raw.ielts_test_type ||
    (raw.eType === "IELTS_GENERAL" ? "General Training" : "Academic");

  return {
    examId: raw.eId || raw.id,
    title: raw.eTitle || raw.title || "Đề thi IELTS",
    description: raw.eDescription || raw.description,
    testType,
    skill,
    scope,
    availableSkills,
    duration: raw.eDuration_minutes || raw.duration || 60,
    totalQuestions: raw.totalQuestions || raw.total_questions || 0,
    totalParts: raw.totalParts || raw.total_parts || (raw.sections?.length || 0),
    participants: raw.participants || 0,
    commentsCount: raw.commentsCount || raw.comments_count || 0,
    sections: parseSections(raw.sections || raw.ielts_data?.[skill] || []),
    playMode,
    activeSession: raw.activeSession ?? raw.active_session ?? null,
  };
}

function formatRemaining(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  if (minutes > 0) return `${minutes} phút ${seconds.toString().padStart(2, "0")} giây`;
  return `${seconds} giây`;
}

function getSessionRemainingSeconds(
  session: NonNullable<IeltsExamDetailData["activeSession"]>,
  clientReceivedAt: number
): number {
  const deadlineMs = session.deadline_at ? new Date(session.deadline_at).getTime() : NaN;
  if (Number.isFinite(deadlineMs)) {
    const serverMs = session.server_time ? new Date(session.server_time).getTime() : NaN;
    const clockSkewMs = Number.isFinite(serverMs) ? serverMs - clientReceivedAt : 0;
    return Math.max(0, Math.round((deadlineMs - (Date.now() + clockSkewMs)) / 1000));
  }
  return Math.max(0, Math.floor(session.time_remaining_seconds));
}

function clearIeltsLocalDeadlines(examId: number, skill: IeltsSkill) {
  if (typeof window === "undefined") return;
  const exact = `ielts_deadline_${examId}_${skill}`;
  const practicePrefix = `${exact}_practice_`;
  try {
    localStorage.removeItem(exact);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(practicePrefix)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* storage unavailable */
  }
}

// ─── Practice scope persistence (for resume to keep selected sections) ──
type IeltsPracticeScope = { sections: number[]; time: number | null };
const ieltsPracticeScopeKey = (examId: number, skill: IeltsSkill) =>
  `ielts_practice_scope_${examId}_${skill}`;

function saveIeltsPracticeScope(examId: number, skill: IeltsSkill, scope: IeltsPracticeScope) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ieltsPracticeScopeKey(examId, skill), JSON.stringify(scope));
  } catch {
    /* storage unavailable */
  }
}

function readIeltsPracticeScope(examId: number, skill: IeltsSkill): IeltsPracticeScope | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ieltsPracticeScopeKey(examId, skill));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IeltsPracticeScope;
    if (!Array.isArray(parsed?.sections)) return null;
    const sections = parsed.sections
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (sections.length === 0) return null;
    const time = typeof parsed.time === "number" && parsed.time > 0 ? parsed.time : null;
    return { sections, time };
  } catch {
    return null;
  }
}

function clearIeltsPracticeScope(examId: number, skill: IeltsSkill) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ieltsPracticeScopeKey(examId, skill));
  } catch {
    /* storage unavailable */
  }
}

function parseSections(raw: any): SectionInfo[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : raw.sections || raw.passages || raw.tasks || raw.parts || [];
  return arr.map((s: any, i: number) => ({
    index: s.sectionNumber ?? s.section_number ?? s.part ?? i + 1,
    name: s.name || s.title || `Phần ${i + 1}`,
    questionCount: (s.questions || []).length || s.questionCount || 0,
    questionTypes: extractQuestionTypes(s.questions || []),
  }));
}

function extractQuestionTypes(questions: any[]): string[] {
  const set = new Set<string>();
  for (const q of questions) {
    const t = q.type || q.questionType || q.question_type;
    if (t) set.add(formatType(String(t)));
  }
  return Array.from(set);
}

function formatType(t: string): string {
  return t.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── UI primitives ───────────────────────────────────────────────────────
function SubTab({
  children,
  active = false,
  locked = false,
}: {
  children: React.ReactNode;
  active?: boolean;
  locked?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium ${
        active ? "bg-blue-50 text-blue-700" : "text-gray-500"
      } ${locked ? "opacity-60" : ""}`}
    >
      {children}
      {locked && <Lock className="w-3 h-3" />}
    </span>
  );
}

function ModeTabBtn({
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
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Icon className="w-4 h-4 text-gray-400" />
      <span>{children}</span>
    </span>
  );
}

function DisabledState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4 rounded-lg border border-dashed border-gray-300 bg-gray-50">
      <Lock className="w-8 h-8 text-gray-400 mb-2" />
      <p className="text-sm font-semibold text-gray-700">
        Chế độ "{label}" chưa được mở
      </p>
      <p className="text-xs text-gray-500 mt-1">
        Giáo viên chưa bật chế độ này cho đề thi.
      </p>
    </div>
  );
}

export default StudentIeltsExamDetail;

/**
 * IELTS — Student exam page (orchestrator).
 *
 * Routes by URL:
 *  • /hoc-vien/lam-bai-ielts/:examId           → Full IELTS test (sequence: L → R → W → S)
 *  • /hoc-vien/lam-bai-ielts/:examId/listening → Listening only
 *  • /hoc-vien/lam-bai-ielts/:examId/reading   → Reading only
 *  • /hoc-vien/lam-bai-ielts/:examId/writing   → Writing only
 *  • /hoc-vien/lam-bai-ielts/:examId/speaking  → Speaking only
 *
 * Manages:
 *  • Test session (submissionId from `start-direct`)
 *  • Global timer (per skill or full)
 *  • Answer state + auto-save (debounced) → POST /api/student/tests/:submissionId/answer
 *  • Submit dialog → POST /api/student/tests/:submissionId/submit
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate, useParams, useSearchParams } from "react-router";
import { Loader2, AlertCircle, Headphones } from "lucide-react";
import { studentApi } from "../../../../../services/studentApi";
import { api } from "../../../../../services/api";
import { usePageTitle } from "../../../../../hooks/usePageTitle";
import { useToastContext } from "../../../../../contexts/ToastContext";
import { useExamSession } from "../../../../../hooks/exam/useExamSession";
import {
  SaveStatusIndicator,
  OfflineBanner,
  MultiTabWarning,
  TimeWarningBanner,
} from "../../../../../components/exam";
import { examDraftStorage } from "../../../../../lib/exam/examDraftStorage";

import { IeltsTopBar } from "./components/IeltsTopBar";
import { IeltsSubmitDialog } from "./components/IeltsSubmitDialog";

import { IeltsListeningFullTestView } from "./views/IeltsListeningFullTestView";
import { IeltsReadingView } from "./views/IeltsReadingView";
import { IeltsWritingView } from "./views/IeltsWritingView";
import { IeltsSpeakingView } from "./views/IeltsSpeakingView";

import type {
  IeltsSkill,
  AnswerMap,
  IeltsListeningPayload,
  IeltsReadingPayload,
  IeltsWritingPayload,
  IeltsSpeakingPayload,
  IELTS_SKILL_TIME,
} from "./types";
import { IELTS_SKILL_TIME as TIMES } from "./types";

interface StudentIeltsExamPageProps {
  /** Force a specific skill (used for skill-only routes) */
  skill?: IeltsSkill;
  /** Full test mode runs all 4 skills sequentially */
  fullTest?: boolean;
}

function applyPracticeScope(
  rawPayload: any,
  skill: IeltsSkill,
  sectionNumbers: Set<number> | null,
  practiceTimeMinutes: number | null
) {
  if (!rawPayload) return rawPayload;
  const scoped = { ...rawPayload };

  if (practiceTimeMinutes) {
    scoped.duration = practiceTimeMinutes;
  }

  if (!sectionNumbers) return scoped;

  if (skill === "listening" && Array.isArray(scoped.sections)) {
    const originalTotalParts = scoped.sections.length;
    const sections = scoped.sections.filter((section: IeltsListeningPayload["sections"][number]) =>
      sectionNumbers.has(Number(section.sectionNumber))
    );
    if (sections.length > 0) {
      scoped.sections = sections;
      scoped.totalParts = originalTotalParts;
      scoped.totalQuestions = sections.reduce(
        (sum: number, section: IeltsListeningPayload["sections"][number]) => sum + (section.questions?.length ?? 0),
        0
      );
    }
  }

  if (skill === "reading" && Array.isArray(scoped.passages)) {
    const originalTotalParts = scoped.passages.length;
    const passages = scoped.passages.filter((passage: IeltsReadingPayload["passages"][number]) =>
      sectionNumbers.has(Number(passage.passageNumber))
    );
    if (passages.length > 0) {
      scoped.passages = passages;
      scoped.totalParts = originalTotalParts;
      scoped.totalQuestions = passages.reduce(
        (sum: number, passage: IeltsReadingPayload["passages"][number]) => sum + (passage.questions?.length ?? 0),
        0
      );
    }
  }

  if (skill === "writing" && Array.isArray(scoped.tasks)) {
    const originalTotalParts = scoped.tasks.length;
    const tasks = scoped.tasks.filter((task: IeltsWritingPayload["tasks"][number]) =>
      sectionNumbers.has(Number(task.taskNumber))
    );
    if (tasks.length > 0) {
      scoped.tasks = tasks;
      scoped.totalParts = originalTotalParts;
    }
  }

  if (skill === "speaking" && Array.isArray(scoped.parts)) {
    const originalTotalParts = scoped.parts.length;
    const parts = scoped.parts.filter((part: IeltsSpeakingPayload["parts"][number]) =>
      sectionNumbers.has(Number(part.partNumber))
    );
    if (parts.length > 0) {
      scoped.parts = parts;
      scoped.totalParts = originalTotalParts;
    }
  }

  return scoped;
}

function buildIeltsDeadlineKey(
  examId: number,
  skill: IeltsSkill,
  isPracticeMode: boolean,
  sectionNumbers: Set<number> | null
): string {
  if (!isPracticeMode) return `ielts_deadline_${examId}_${skill}`;
  const scope = sectionNumbers
    ? Array.from(sectionNumbers).sort((a, b) => a - b).join("-")
    : "all";
  return `ielts_deadline_${examId}_${skill}_practice_${scope}`;
}

function readDeadline(key: string): number | null {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > Date.now() ? value : null;
  } catch {
    return null;
  }
}

function writeDeadline(key: string, deadline: number) {
  try {
    localStorage.setItem(key, String(deadline));
  } catch {
    /* storage unavailable */
  }
}

function clearDeadline(key: string | null) {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

export function StudentIeltsExamPage({ skill, fullTest = false }: StudentIeltsExamPageProps) {
  const { examId: examIdParam } = useParams<{ examId: string }>();
  const examId = Number(examIdParam);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToastContext();
  const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const user = userStr ? JSON.parse(userStr) : null;

  // Mode CBT thật (full test) vs PRACTICE (luyện tập).
  const isFullSkillMode = searchParams.get("mode") === "full_test";
  const isTimedTestMode = fullTest || isFullSkillMode;
  const isPracticeMode = searchParams.get("mode") === "practice" && !isTimedTestMode;
  const practiceSectionNumbers = useMemo(() => {
    if (!isPracticeMode) return null;
    const raw = searchParams.get("sections") ?? "";
    const values = raw
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v) && v > 0);
    return values.length ? new Set(values) : null;
  }, [isPracticeMode, searchParams]);
  const practiceTimeMinutes = useMemo(() => {
    if (!isPracticeMode) return null;
    const value = Number(searchParams.get("time") ?? 0);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [isPracticeMode, searchParams]);

  // ─── Review mode (?review=submissionId) ─────────────────────────────
  const reviewSubmissionId = useMemo(() => {
    const v = Number(searchParams.get("review") ?? 0);
    return Number.isFinite(v) && v > 0 ? v : null;
  }, [searchParams]);
  const reviewMode = reviewSubmissionId !== null;
  const [correctAnswers, setCorrectAnswers] = useState<Record<number, string>>({});
  /** Map qId → boolean: kết quả chấm của server (saIs_correct). Dùng thay cho so sánh text ở client */
  const [isCorrectMap, setIsCorrectMap] = useState<Record<number, boolean>>({});
  const [availableSkills, setAvailableSkills] = useState<IeltsSkill[] | null>(skill ? [skill] : null);

  usePageTitle(reviewMode ? "Xem lại bài IELTS" : "IELTS Test");

  // Resolve effective skill ordering for full test
  const skillSequence: IeltsSkill[] = useMemo(() => {
    if (skill) return [skill];
    if (fullTest) return availableSkills?.length ? availableSkills : ["listening", "reading", "writing", "speaking"];
    return ["listening"]; // default fallback
  }, [skill, fullTest, availableSkills]);

  const [skillIdx, setSkillIdx] = useState(0);
  const currentSkill = skillSequence[skillIdx];

  useEffect(() => {
    if (skill || !examId || !fullTest) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/student/exams/${examId}/ielts/detail`);
        if (cancelled) return;
        const raw = res.data?.data || res.data;
        const fromApi = Array.isArray(raw?.available_skills)
          ? raw.available_skills
              .map((item: string) => String(item).toLowerCase())
              .filter((item: string) => ["listening", "reading", "writing", "speaking"].includes(item)) as IeltsSkill[]
          : [];
        const rawSkill = String(raw?.ielts_skill || raw?.eSkill || raw?.skill || "").toLowerCase();
        if (fromApi.length > 0) {
          setAvailableSkills(fromApi);
        } else if (["listening", "reading", "writing", "speaking"].includes(rawSkill)) {
          setAvailableSkills([rawSkill as IeltsSkill]);
        }
      } catch {
        // Fallback giữ thứ tự chuẩn để không chặn bài thi nếu detail endpoint lỗi tạm thời.
      }
    })();
    return () => { cancelled = true; };
  }, [examId, fullTest, skill]);

  useEffect(() => {
    if (skillIdx >= skillSequence.length) {
      setSkillIdx(Math.max(0, skillSequence.length - 1));
    }
  }, [skillIdx, skillSequence.length]);

  // Session
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [startedAtServer, setStartedAtServer] = useState('');

  const session = useExamSession({
    submissionId: reviewMode ? null : submissionId,
    examId,
    durationMinutes: 9999,
    startedAtServer,
    examType: 'IELTS',
    role: 'adults',
    enableAutoSubmitOnUnload: false,
    serializeAnswerForServer: (qid, value) => {
      const questionId = Number(qid);
      if (!Number.isFinite(questionId) || value == null) return null;
      return { question_id: questionId, saAnswer_text: String(value) };
    },
  });

  // Skill payload (loaded per skill)
  const [payload, setPayload] = useState<any>(null);
  const [payloadLoading, setPayloadLoading] = useState(false);

  // Answer state (local for display; session.setAnswer handles save layers)
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});

  // Timer (in seconds) — neo theo deadline tuyệt đối (wall-clock) để bền vững
  // qua F5/đóng-mở tab. timeLeft chỉ là giá trị hiển thị, nguồn chân lý là deadlineRef.
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<number | null>(null);
  const deadlineRef = useRef<number | null>(null); // epoch ms khi hết giờ
  const deadlineKeyRef = useRef<string | null>(null);
  const serverRemainingRef = useRef<number | null>(null); // giây còn lại từ server lúc start

  // Submit
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [forceSubmit, setForceSubmit] = useState(false);
  // Timeout flow — overlay "đang nộp tự động" + chống double trigger
  const [timeUp, setTimeUp] = useState(false);
  const timeUpHandledRef = useRef(false);
  const leavePromptActiveRef = useRef(false);
  const sessionSetAnswerRef = useRef(session.setAnswer);
  const restoreToastShownRef = useRef(false);

  useEffect(() => {
    sessionSetAnswerRef.current = session.setAnswer;
  }, [session.setAnswer]);

  // ─── 1) Start the exam session ────────────────────────────────────────
  useEffect(() => {
    if (!examId) {
      setSessionError("Invalid exam ID.");
      setSessionLoading(false);
      return;
    }

    // Review mode: bỏ qua start-direct, dùng submissionId từ URL
    if (reviewMode && reviewSubmissionId) {
      setSubmissionId(reviewSubmissionId);
      setSessionLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await studentApi.startDirectVstepExam(examId, true);
        if (cancelled) return;
        const responseStatus = String(res.data?.status ?? "").toLowerCase();
        const startData: any = res.data?.data;
        const sId = startData?.submissionId;
        if (!sId) throw new Error("No submission ID returned.");
        if (responseStatus === "finalized" || (startData?.sStatus && startData.sStatus !== "in_progress")) {
          navigate(`/hoc-vien/ket-qua-ielts/${sId}`, { replace: true });
          return;
        }
        setSubmissionId(sId);
        // Neo deadline theo thời gian còn lại thật từ server (giây)
        const remainingSec = startData?.time_remaining;
        if (typeof remainingSec === "number" && remainingSec >= 0) {
          serverRemainingRef.current = remainingSec;
        }
        // ✅ FIX: Use direct timestamp from backend, NOT calculated from time_remaining
        if (startData?.started_at) {
          setStartedAtServer(startData.started_at);
        } else {
          // Fallback if backend doesn't return started_at (shouldn't happen)
          setStartedAtServer(new Date().toISOString());
        }
        
        const restored: AnswerMap = {};

        // ✅ NEW: Restore saved answers from backend (F5 case)
        if (startData?.savedAnswers) {
          for (const [qId, answerText] of Object.entries(startData.savedAnswers)) {
            restored[parseInt(qId)] = String(answerText);
          }
        }

        // ⚠️ Push backend savedAnswers vào session.setAnswer để force-flush khi
        // submit cũng có chúng (nếu chỉ ở local state thì doSubmit re-push qua
        // saveDraft sẽ KHÔNG có). Việc push này cũng cập nhật pendingQueueRef.
        if (Object.keys(restored).length > 0) {
          Object.entries(restored).forEach(([qId, val]) => {
            const numericQid = Number(qId);
            sessionSetAnswerRef.current(Number.isFinite(numericQid) ? numericQid : qId, val);
          });
        }

        // Kiểm tra draft localStorage và tự khôi phục, không mở modal.
        const draft = examDraftStorage.load(sId);
        const draftAnswers = draft?.answers ?? {};
        const draftCount = Object.keys(draftAnswers).length;
        if (draftCount > 0) {
          Object.entries(draftAnswers).forEach(([qId, value]) => {
            const numericQid = Number(qId);
            sessionSetAnswerRef.current(Number.isFinite(numericQid) ? numericQid : qId, value);
          });
        }

        const mergedAnswers = { ...restored, ...draftAnswers } as AnswerMap;
        const restoredCount = Object.keys(mergedAnswers).length;
        if (restoredCount > 0) {
          setAnswers(mergedAnswers);
          // Only show toast once per session
          if (!restoreToastShownRef.current) {
            toast.info(`Đã khôi phục ${restoredCount} câu trả lời trong bài làm dang dở.`, 3500);
            restoreToastShownRef.current = true;
          }
        }
        setSessionLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setSessionError(e?.response?.data?.message ?? e?.message ?? "Failed to start exam session.");
        setSessionLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [examId, navigate, reviewMode, reviewSubmissionId, toast]);

  // ─── 1b) Review mode: load submission để pre-fill answers + correct map ──
  useEffect(() => {
    if (!reviewMode || !reviewSubmissionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await studentApi.getSubmissionDetail(reviewSubmissionId);
        if (cancelled) return;
        const data = (res as any)?.data?.data ?? (res as any)?.data;
        if (!data) return;

        // Pre-fill text completion answers + build saIs_correct map
        const filled: AnswerMap = {};
        const isCorrectBuild: Record<number, boolean> = {};
        for (const a of (data.answers ?? [])) {
          if (a.question_id != null && a.saAnswer_text != null) {
            filled[a.question_id] = a.saAnswer_text;
          }
          if (a.question_id != null && a.saIs_correct != null) {
            isCorrectBuild[a.question_id] = !!a.saIs_correct;
          }
        }
        setAnswers(filled);
        setIsCorrectMap(isCorrectBuild);

        // Build correct answers map — priority:
        // 1) answers table with aIs_correct=1 (MCQ & completion with stored options)
        // 2) qData.correct_answer / qData.answer / qData.correctAnswer
        //    (used by PDF-imported IELTS text-completion questions)
        const cmap: Record<number, string> = {};
        for (const q of (data.exam?.questions ?? [])) {
          const correct = (q.answers ?? []).find((x: any) => x.aIs_correct);
          if (correct && correct.aContent != null) {
            cmap[q.qId] = String(correct.aContent);
          } else {
            const qd: Record<string, any> = q.qData ?? {};
            const ca = qd.correct_answer ?? qd.answer ?? qd.correctAnswer ?? qd.correct ?? null;
            if (ca != null && String(ca).trim() !== "") {
              cmap[q.qId] = String(ca).trim();
            }
          }
        }
        setCorrectAnswers(cmap);
      } catch {
        // Lặng lẽ — payload vẫn load để xem câu hỏi
      }
    })();
    return () => { cancelled = true; };
  }, [reviewMode, reviewSubmissionId]);

  // ─── 2) Load payload when skill changes ───────────────────────────────
  useEffect(() => {
    if (!submissionId || !currentSkill) return;
    let cancelled = false;
    setPayloadLoading(true);
    setPayload(null);

    const loaders: Record<IeltsSkill, (id: number) => Promise<any>> = {
      listening: (id) => studentApi.loadStudentIeltsListening(id),
      reading:   (id) => studentApi.loadStudentIeltsReading(id),
      writing:   (id) => studentApi.loadStudentIeltsWriting(id),
      speaking:  (id) => studentApi.loadStudentIeltsSpeaking(id),
    };

    loaders[currentSkill](examId)
      .then((res: any) => {
        if (cancelled) return;
        const data = applyPracticeScope(res.data?.data, currentSkill, practiceSectionNumbers, practiceTimeMinutes);
        setPayload(data);

        // Review mode: không cần neo deadline / timer — chỉ load câu hỏi
        if (reviewMode) {
          deadlineRef.current = null;
          setTimeLeft(0);
          return;
        }

        // ─── Neo deadline tuyệt đối (bền vững qua F5/đóng tab) ───
        // Key riêng theo exam + skill để mỗi skill có deadline riêng.
        const dlKey = buildIeltsDeadlineKey(examId, currentSkill, isPracticeMode, practiceSectionNumbers);
        deadlineKeyRef.current = dlKey;
        const totalSec = (data?.duration ?? TIMES[currentSkill]) * 60;
        const now = Date.now();

        let deadline: number | null = null;
        const stored = readDeadline(dlKey);
        if (stored) {
          // Đã có deadline lưu trước đó và còn hạn → tiếp tục đếm từ đó
          deadline = stored;
        } else if (!isPracticeMode && serverRemainingRef.current != null && serverRemainingRef.current > 0) {
          // Lần đầu / resume: dùng thời gian còn lại thật từ server
          deadline = now + serverRemainingRef.current * 1000;
        } else if (localStorage.getItem(dlKey) == null) {
          // Fallback: chưa có gì → đặt theo duration đầy đủ
          deadline = now + totalSec * 1000;
        } else {
          // stored tồn tại nhưng đã hết hạn → hết giờ
          deadline = now;
        }

        deadlineRef.current = deadline;
        writeDeadline(dlKey, deadline);
        setTimeLeft(Math.max(0, Math.round((deadline - now) / 1000)));
      })
      .catch((e: any) => {
        if (cancelled) return;
        setSessionError(e?.response?.data?.message ?? e?.message ?? "Failed to load skill data.");
      })
      .finally(() => !cancelled && setPayloadLoading(false));

    return () => { cancelled = true; };
  }, [submissionId, currentSkill, examId, isPracticeMode, practiceSectionNumbers, practiceTimeMinutes]);

  // ─── 3) Timer tick ────────────────────────────────────────────────────
  // Tính theo deadline tuyệt đối (wall-clock) → reload/đóng-mở tab vẫn đúng.
  useEffect(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (reviewMode) return;
    if (!payload || deadlineRef.current == null) return;

    const tick = () => {
      const remain = Math.max(0, Math.round((deadlineRef.current! - Date.now()) / 1000));
      setTimeLeft(remain);
      if (remain <= 0) {
        if (timerRef.current) window.clearInterval(timerRef.current);
        handleTimeUp();
      }
    };

    tick(); // chạy ngay để cập nhật đúng sau khi tab được mở lại
    timerRef.current = window.setInterval(tick, 1000);
    return () => { timerRef.current && window.clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  // ─── 4) Answer handler — dual-write: local display + session save layers
  const handleAnswer = useCallback((qId: number, value: any) => {
    if (reviewMode) return;
    setAnswers((prev) => ({ ...prev, [qId]: value }));
    session.setAnswer(qId, value);
  }, [reviewMode, session.setAnswer]);

  const handleToggleFlag = useCallback((qId: number) => {
    setFlagged((prev) => ({ ...prev, [qId]: !prev[qId] }));
  }, []);

  // ─── 5) Submit current skill or full ──────────────────────────────────
  const totalQuestions = useMemo(() => {
    if (!payload) return 0;
    if (currentSkill === "listening") return (payload as IeltsListeningPayload).totalQuestions ?? 0;
    if (currentSkill === "reading")   return (payload as IeltsReadingPayload).totalQuestions ?? 0;
    if (currentSkill === "writing")   return (payload as IeltsWritingPayload).tasks?.length ?? 0;
    if (currentSkill === "speaking")  return (payload as IeltsSpeakingPayload).parts?.length ?? 0;
    return 0;
  }, [payload, currentSkill]);

  const answeredCount = useMemo(() => {
    if (!payload) return 0;
    let count = 0;
    if (currentSkill === "listening") {
      (payload as IeltsListeningPayload).sections.forEach((s) =>
        s.questions.forEach((q) => answers[q.qId] != null && answers[q.qId] !== "" && count++)
      );
    } else if (currentSkill === "reading") {
      (payload as IeltsReadingPayload).passages.forEach((p) =>
        p.questions.forEach((q) => answers[q.qId] != null && answers[q.qId] !== "" && count++)
      );
    } else if (currentSkill === "writing") {
      (payload as IeltsWritingPayload).tasks.forEach((t) => {
        const txt = (answers[t.questionId] as string) ?? "";
        if (txt.trim().length >= t.minWords) count++;
      });
    }
    return count;
  }, [answers, payload, currentSkill]);

  const flaggedCount = useMemo(() => Object.values(flagged).filter(Boolean).length, [flagged]);
  const shouldWarnBeforeLeave = !reviewMode && !submitting && !timeUp && answeredCount > 0;

  // ── Đủ điều kiện nộp bài? ─────────────────────────────────
  // Yêu cầu: phải khoanh hết câu (Listening/Reading) hoặc viết đủ độ dài
  // tối thiểu (Writing). Nếu chưa đủ → nút Nộp bài DISABLED.
  const submitGate = useMemo(() => {
    const remain = Math.max(0, totalQuestions - answeredCount);
    if (remain === 0 || totalQuestions === 0) {
      return { canSubmit: true, tooltip: "Sẵn sàng nộp bài" };
    }
    return {
      canSubmit: false,
      tooltip: `Còn ${remain} câu chưa hoàn thành — không thể nộp bài`,
    };
  }, [totalQuestions, answeredCount]);

  const routeBlocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!shouldWarnBeforeLeave) return false;
    const current = `${currentLocation.pathname}${currentLocation.search}`;
    const next = `${nextLocation.pathname}${nextLocation.search}`;
    return current !== next;
  });

  useEffect(() => {
    if (routeBlocker.state !== "blocked" || leavePromptActiveRef.current) return;
    leavePromptActiveRef.current = true;

    void (async () => {
      const saved = await session.flushNow().then(() => true).catch(() => false);
      const ok = window.confirm(
        saved
          ? "Bạn đang làm bài và đáp án tạm thời đã được lưu. Bạn có chắc muốn rời khỏi trang làm bài không?"
          : "Bạn đang làm bài nhưng hệ thống chưa xác nhận lưu đáp án mới nhất. Bạn vẫn muốn rời khỏi trang làm bài không?"
      );
      if (ok) {
        routeBlocker.proceed();
      } else {
        routeBlocker.reset();
      }
      leavePromptActiveRef.current = false;
    })();
  }, [routeBlocker, session, shouldWarnBeforeLeave]);

  const handleRequestSubmit = () => {
    // Gate guard: nếu còn câu chưa khoanh, KHÔNG mở dialog, show toast.
    if (!submitGate.canSubmit) {
      toast.warning(submitGate.tooltip, 3500);
      return;
    }
    setSubmitOpen(true);
  };

  // ─── Hết giờ: tự động nộp → thông báo → rời trang (không giữ user ở lại) ──
  const handleTimeUp = useCallback(async () => {
    if (timeUpHandledRef.current) return;
    timeUpHandledRef.current = true;

    setSubmitOpen(false);
    setTimeUp(true);

    // Dọn deadline đã lưu
    clearDeadline(deadlineKeyRef.current ?? buildIeltsDeadlineKey(examId, currentSkill, isPracticeMode, practiceSectionNumbers));
    deadlineRef.current = null;

    const isLastSkill = !fullTest || skillIdx >= skillSequence.length - 1;

    if (isLastSkill) {
      // Dùng session.submit() để force-flush + retry chunk + submit (atomic).
      // Nếu fail → thông báo rõ ràng và CHO PHÉP user thử lại (không tự navigate).
      let submitOk = false;
      try {
        if (submissionId) {
          await session.submit();
          submitOk = true;
        }
      } catch (err) {
        console.error('[IELTS] timeout submit failed', err);
      }

      if (submitOk) {
        // Hết giờ + nộp ok → clear practice scope cho session sau không dính
        try { localStorage.removeItem(`ielts_practice_scope_${examId}_${currentSkill}`); } catch {}
        toast.warning("Đã hết thời gian làm bài. Bài thi của bạn đã được nộp tự động.", 5000);
        setTimeout(() => {
          if (submissionId) {
            navigate(`/hoc-vien/ket-qua-ielts/${submissionId}`, { replace: true });
          } else {
            navigate("/hoc-vien/de-thi", { replace: true });
          }
        }, 1200);
      } else {
        // Submit thất bại — KHÔNG navigate. Cho user retry bằng nút submit thủ công.
        timeUpHandledRef.current = false;
        setTimeUp(false);
        setSubmitOpen(true);
        toast.error(
          "Hết giờ nhưng nộp bài thất bại do mạng. Hãy bấm Nộp bài lại — dữ liệu vẫn còn trong trình duyệt.",
          8000,
        );
      }
    } else {
      // Full test: hết giờ skill này → chuyển skill kế tiếp
      toast.info("Hết giờ phần này. Chuyển sang phần thi tiếp theo.", 4000);
      await session.flushNow().catch(() => {});
      serverRemainingRef.current = null;
      timeUpHandledRef.current = false;
      setTimeUp(false);
      setSkillIdx((i) => i + 1);
      setAnswers({});
      setFlagged({});
    }
  }, [examId, currentSkill, submissionId, fullTest, skillIdx, skillSequence.length, navigate, toast, isPracticeMode, practiceSectionNumbers, session]);

  const handleConfirmSubmit = async () => {
    if (!submissionId) return;
    try {
      setSubmitting(true);

      // Xoá deadline của skill vừa nộp để lần làm mới không dính giờ cũ
      clearDeadline(deadlineKeyRef.current ?? buildIeltsDeadlineKey(examId, currentSkill, isPracticeMode, practiceSectionNumbers));
      deadlineRef.current = null;
      // Nộp xong → clear practice scope đã lưu để session sau không bị
      // resume nhầm scope cũ.
      try { localStorage.removeItem(`ielts_practice_scope_${examId}_${currentSkill}`); } catch {}

      // If this is part of a full test, advance to next skill instead of leaving
      if (fullTest && skillIdx < skillSequence.length - 1) {
        await session.flushNow().catch(() => {});
        serverRemainingRef.current = null; // skill kế tiếp sẽ neo deadline riêng
        setSkillIdx((i) => i + 1);
        setAnswers({});
        setFlagged({});
        setSubmitOpen(false);
        setForceSubmit(false);
        setSubmitting(false);
        return;
      }

      // Single-skill / last skill: dùng session.submit() — force-flush + retry +
      // submit atomically. Nếu user huỷ trong confirm dialog (do save fail), throw.
      await session.submit();

      // Single-skill: navigate to results
      navigate(`/hoc-vien/ket-qua-ielts/${submissionId}`);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Submit failed. Please try again.";
      alert(`${msg}\n\nDữ liệu vẫn được giữ trong trình duyệt — bạn có thể thử nộp lại sau ít phút.`);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── RENDER STATES ────────────────────────────────────────────────────

  // Hết giờ — overlay toàn màn hình trong lúc nộp + điều hướng
  if (timeUp) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-orange-100 animate-in zoom-in-95 duration-200">
          <div className="px-6 pt-7 pb-6 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] flex items-center justify-center shadow-lg shadow-orange-200 mb-4">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Đã hết thời gian</h2>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">
              Bài thi của bạn đang được nộp tự động.
              <br />
              Hệ thống sẽ chuyển bạn sang trang kết quả.
            </p>
            <div className="flex items-center justify-center gap-2 mt-5 text-[#FF6B35]">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-semibold">Đang nộp bài…</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-red-200 rounded-xl p-6 max-w-md w-full shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Không thể bắt đầu bài thi</h2>
          </div>
          <p className="text-sm text-gray-700 mb-4">{sessionError}</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  if (sessionLoading || payloadLoading || !payload) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FFF7F2] to-[#F5F5F5] flex items-center justify-center p-4">
        <div className="text-center">
          {/* Brand badge */}
          <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] flex items-center justify-center shadow-lg shadow-orange-200">
            <Headphones className="w-7 h-7 text-white" />
          </div>
          {/* Spinner */}
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-[#FF6B35]" />
          <p className="text-[15px] font-semibold text-[#1a1a1a]">
            {sessionLoading ? "Đang khởi tạo phiên thi…" : "Đang tải câu hỏi…"}
          </p>
          <p className="text-sm text-[#677788] mt-1">Vui lòng chờ trong giây lát</p>
        </div>
      </div>
    );
  }

  const sectionLabel = (() => {
    const titles: Record<IeltsSkill, string> = {
      listening: "Listening",
      reading: "Reading",
      writing: "Writing",
      speaking: "Speaking",
    };
    return `IELTS ${titles[currentSkill]} · ${payload.title ?? ""}`;
  })();

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <OfflineBanner online={session.online} pendingCount={session.pendingCount} />
      {!reviewMode && (
        <TimeWarningBanner
          level={session.warningLevel}
          onDismiss={session.dismissWarning}
          timeRemaining={session.timeRemaining}
        />
      )}
      <IeltsTopBar
        candidateName={(user?.uName as string) ?? "Candidate"}
        testId={`#${examId}`}
        sectionLabel={sectionLabel}
      />

      {/* Review mode banner */}
      {reviewMode && (
        <div className="bg-[#f8fafb] border-b border-[#e2e8f0] py-2 px-4 text-sm text-[#475569] flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
          <span>Chế độ xem lại — đáp án đã được điền sẵn từ bài nộp</span>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="ml-3 px-2.5 py-0.5 rounded border border-[#cbd5e1] text-xs text-[#334155] hover:bg-[#e2e8f0] transition-colors cursor-pointer"
          >
            ← Về kết quả
          </button>
        </div>
      )}

      {currentSkill === "listening" && (
        <IeltsListeningFullTestView
          payload={payload as IeltsListeningPayload}
          answers={answers}
          flagged={flagged}
          onAnswer={handleAnswer}
          onToggleFlag={handleToggleFlag}
          onSubmit={reviewMode ? () => {} : handleRequestSubmit}
          timeLeft={reviewMode ? undefined : timeLeft}
          showTimer={!reviewMode}
          practiceMode={reviewMode || !isTimedTestMode}
          reviewMode={reviewMode}
          correctAnswers={correctAnswers}
          isCorrectMap={isCorrectMap}
        />
      )}
      {currentSkill === "reading" && (
        <IeltsReadingView
          payload={payload as IeltsReadingPayload}
          answers={answers}
          flagged={flagged}
          onAnswer={handleAnswer}
          onToggleFlag={handleToggleFlag}
          onSubmit={reviewMode ? () => {} : handleRequestSubmit}
          timeLeft={reviewMode ? undefined : timeLeft}
          showTimer={!reviewMode}
          reviewMode={reviewMode}
          submissionId={submissionId || undefined}
        />
      )}
      {currentSkill === "writing" && (
        <IeltsWritingView
          payload={payload as IeltsWritingPayload}
          answers={answers}
          onAnswer={handleAnswer}
          onSubmit={reviewMode ? () => {} : handleRequestSubmit}
          reviewMode={reviewMode}
        />
      )}
      {currentSkill === "speaking" && (
        <IeltsSpeakingView
          payload={payload as IeltsSpeakingPayload}
          submissionId={submissionId}
          onSubmit={reviewMode ? () => {} : handleRequestSubmit}
          reviewMode={reviewMode}
        />
      )}

      {!reviewMode && (
        <IeltsSubmitDialog
          open={submitOpen}
          totalQuestions={totalQuestions}
          answeredCount={answeredCount}
          flaggedCount={flaggedCount}
          isSubmitting={submitting}
          onCancel={() => { setSubmitOpen(false); setForceSubmit(false); }}
          onConfirm={handleConfirmSubmit}
          forceSubmit={forceSubmit}
        />
      )}
      {!reviewMode && (
        <>
          <div className="fixed bottom-4 right-4 z-50">
            <SaveStatusIndicator status={session.saveStatus} lastSavedAt={session.lastSavedAt} pendingCount={session.pendingCount} />
          </div>
          <MultiTabWarning hasOtherTab={session.hasOtherTab} position="floating" />
        </>
      )}
    </div>
  );
}

export default StudentIeltsExamPage;

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { 
  AlertTriangle, BookOpen, CheckCircle, Mic, Pause, Play, Square, 
  RotateCcw, ChevronRight, Volume2, FileText, Bookmark, BookmarkCheck 
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router";
import { studentApi } from "../../../../services/studentApi";
import { IntroScreen } from "./components/IntroScreen";
import { useTranslation } from "react-i18next";
import { useExamSession } from "../../../../hooks/exam/useExamSession";
import {
  SaveStatusIndicator,
  OfflineBanner,
  MultiTabWarning,
  ResumeExamModal,
  TimeWarningBanner,
} from "../../../../components/exam";
import { examDraftStorage } from "../../../../lib/exam/examDraftStorage";

// VSTEP Structure - 4 Skills, 7 Parts
const VSTEP_STRUCTURE = {
  listening: {
    name: "Listening",
    icon: "🎧",
    color: "#3B82F6",
    lightBg: "#DBEAFE",
    parts: [
      { part: 1, name: "Announcements", questions: 8 },
      { part: 2, name: "Dialogues", questions: 12 },
      { part: 3, name: "Lectures", questions: 15 },
    ],
  },
  reading: {
    name: "Reading",
    icon: "📖",
    color: "#10B981",
    lightBg: "#D1FAE5",
    parts: [
      { part: 1, name: "Passage 1", questions: 10 },
      { part: 2, name: "Passage 2", questions: 10 },
      { part: 3, name: "Passage 3", questions: 10 },
      { part: 4, name: "Passage 4", questions: 10 },
    ],
  },
  writing: {
    name: "Writing",
    icon: "✍️",
    color: "#F59E0B",
    lightBg: "#FEF3C7",
    parts: [
      { part: 1, name: "Task 1", questions: 1, minWords: 150 },
      { part: 2, name: "Task 2", questions: 1, minWords: 250 },
    ],
  },
  speaking: {
    name: "Speaking",
    icon: "🗣️",
    color: "#8B5CF6",
    lightBg: "#EDE9FE",
    parts: [
      { part: 1, name: "Social Interaction", questions: 1 },
      { part: 2, name: "Solution Discussion", questions: 1 },
      { part: 3, name: "Topic Development", questions: 1 },
    ],
  },
};

type SkillType = keyof typeof VSTEP_STRUCTURE;

const STUDENT_BASE_PATH = "/hoc-vien";

function mapSavedAnswers(savedAnswers: any[]): Record<string, string> {
  if (!Array.isArray(savedAnswers)) return {};
  const map: Record<string, string> = {};
  savedAnswers.forEach((a: any) => {
    const qid = String(a?.question_id ?? a?.qId ?? "");
    const val = String(a?.saAnswer_text ?? a?.answer_text ?? a?.answer_id ?? "");
    if (qid && val) map[qid] = val;
  });
  return map;
}

function formatClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function getQuestionId(question: any): string {
  return String(question?.qId ?? question?.id ?? "");
}

function getQuestionSkill(question: any): string {
  return String(question?.qSkill ?? question?.skill ?? "reading").toLowerCase();
}

function getQuestionPart(question: any): number {
  return Number(question?.qPart ?? question?.part ?? 1);
}

function getOptions(question: any) {
  if (Array.isArray(question?.options)) {
    return question.options.map((opt: any, idx: number) => ({
      id: String(opt?.id ?? idx + 1),
      label: String(opt?.label ?? String.fromCharCode(65 + idx)),
      content: String(opt?.content ?? ""),
      value: String(opt?.id ?? idx + 1),
    }));
  }

  if (Array.isArray(question?.answers)) {
    return question.answers.map((opt: any, idx: number) => ({
      id: String(opt?.aId ?? idx + 1),
      label: String.fromCharCode(65 + idx),
      content: String(opt?.aContent ?? ""),
      value: String(opt?.aContent ?? ""),
    }));
  }

  return [];
}

// Submit Dialog Component
function SubmitDialog({
  open,
  total,
  answered,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  total: number;
  answered: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  if (!open) return null;
  const unanswered = total - answered;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl mx-4" style={{ border: "1.5px solid #7C3AED20" }}>
        <div className="flex flex-col items-center text-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: unanswered > 0 ? "#FEF3C7" : "#D1FAE5" }}
          >
            {unanswered > 0 ? (
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            ) : (
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            )}
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1F1344" }}>
              {unanswered > 0 ? "Còn câu chưa trả lời" : "Sẵn sàng nộp bài"}
            </h2>
            <p className="mt-2" style={{ fontSize: 14, color: "#6B7280" }}>
              {unanswered > 0
                ? `Bạn còn ${unanswered} câu chưa trả lời. Bạn có chắc muốn nộp bài?`
                : `Bạn đã trả lời ${answered}/${total} câu. Nộp bài ngay?`}
            </p>
          </div>
          <div className="flex gap-3 w-full">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 py-3 rounded-xl font-semibold transition hover:bg-gray-200"
              style={{ background: "#F3F4F6", color: "#374151", fontSize: 15 }}
            >
              Tiếp tục làm
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 py-3 rounded-xl font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: "#7C3AED", fontSize: 15 }}
            >
              {loading ? "Đang nộp..." : "Nộp bài"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TestTakingVSTEP() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const assignmentId = Number(id);

  const querySubmissionId = useMemo(() => {
    const raw = Number(new URLSearchParams(location.search).get("submissionId") ?? 0);
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }, [location.search]);

  // State
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exam, setExam] = useState<any>(null);
  const [startedAtServer, setStartedAtServer] = useState('');

  const session = useExamSession({
    submissionId,
    examId: exam?.id ?? exam?.eId ?? 0,
    durationMinutes: exam?.eDuration_minutes ?? exam?.exam_duration ?? 179,
    startedAtServer,
    examType: exam?.exam_type ?? 'VSTEP',
    role: 'adults',
    onSubmitted: (res: any) => {
      const sid = res?.data?.data?.submissionId ?? submissionId;
      navigate(`${STUDENT_BASE_PATH}/ket-qua/${sid}`);
    },
  });
  const { setAnswer: setSessionAnswer } = session;

  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [currentSkill, setCurrentSkill] = useState<SkillType>("listening");
  const [currentPart, setCurrentPart] = useState(1);
  const [showSubmit, setShowSubmit] = useState(false);
  const [started, setStarted] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<any>(null);
  const [speakingMediaMap, setSpeakingMediaMap] = useState<Record<string, { url?: string; recording: boolean }>>({});
  const [recordingQuestionId, setRecordingQuestionId] = useState<string | null>(null);
  const [speakingUploadStatus, setSpeakingUploadStatus] = useState<Record<string, 'idle' | 'uploading' | 'uploaded' | 'error'>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);

  const questions = exam?.questions ?? [];

  // Get questions for current skill and part
  const currentPartQuestions = useMemo(
    () => questions.filter((q: any) => getQuestionSkill(q) === currentSkill && getQuestionPart(q) === currentPart),
    [questions, currentSkill, currentPart]
  );

  // Calculate answered count
  const answeredCount = useMemo(() => {
    return Object.entries(session.answers).filter(([_, v]) => {
      if (v == null) return false;
      if (typeof v === 'string') return v.trim() !== '';
      if (typeof v === 'object') return Object.keys(v as object).length > 0;
      return true;
    }).length;
  }, [session.answers]);

  // Get answered count per part
  const getPartAnsweredCount = (skill: SkillType, part: number) => {
    const partQuestions = questions.filter((q: any) => getQuestionSkill(q) === skill && getQuestionPart(q) === part);
    return partQuestions.filter((q: any) => {
      const qid = getQuestionId(q);
      return String(session.answers[qid] ?? "").trim() !== "";
    }).length;
  };

  // Handle answer change
  const handleAnswerChange = (question: any, value: string) => {
    const qKey = getQuestionId(question);
    if (!qKey) return;

    setSessionAnswer(qKey, value);
  };

  // Toggle bookmark
  const toggleBookmark = (questionId: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  // Navigate to skill/part
  const goToSkillPart = (skill: SkillType, part: number) => {
    setCurrentSkill(skill);
    setCurrentPart(part);
  };

  // Cleanup media on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      Object.values(speakingMediaMap).forEach((media) => {
        if (media.url && media.url.startsWith('blob:')) URL.revokeObjectURL(media.url);
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSpeakingRecording = async (partNumber: number, partQuestions: any[]) => {
    const partKey = `speaking-part-${partNumber}`;
    if (recordingQuestionId) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      mediaChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          mediaChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(mediaChunksRef.current, { type: "audio/webm" });
        const localUrl = URL.createObjectURL(blob);

        setSpeakingMediaMap((prev) => {
          const old = prev[partKey]?.url;
          if (old && old.startsWith('blob:')) URL.revokeObjectURL(old);
          return { ...prev, [partKey]: { url: localUrl, recording: false } };
        });
        setRecordingQuestionId(null);
        setSpeakingUploadStatus((prev) => ({ ...prev, [partKey]: 'uploading' }));

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }

        if (!submissionId) {
          setSpeakingUploadStatus((prev) => ({ ...prev, [partKey]: 'error' }));
          return;
        }

        try {
          const res: any = await studentApi.uploadSpeakingAudio(submissionId, partNumber, blob);
          const publicUrl: string = res?.data?.data?.url ?? '';
          if (!publicUrl) throw new Error('No URL returned');
          URL.revokeObjectURL(localUrl);
          setSpeakingMediaMap((prev) => ({ ...prev, [partKey]: { url: publicUrl, recording: false } }));
          setSpeakingUploadStatus((prev) => ({ ...prev, [partKey]: 'uploaded' }));
          // Mark all questions in this part as answered
          partQuestions.forEach((q: any) => { setSessionAnswer(getQuestionId(q), '[recorded]'); });
        } catch {
          setSpeakingUploadStatus((prev) => ({ ...prev, [partKey]: 'error' }));
        }
      };

      setSpeakingMediaMap((prev) => ({ ...prev, [partKey]: { ...prev[partKey], recording: true } }));
      setRecordingQuestionId(partKey);
      recorder.start();
    } catch {
      alert("Vui lòng cho phép quyền truy cập microphone để ghi âm.");
    }
  };

  const stopSpeakingRecording = (partKey: string) => {
    if (recordingQuestionId !== partKey) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const playSpeakingAudio = (qid: string) => {
    const url = speakingMediaMap[qid]?.url;
    if (!url) return;
    const a = new Audio(url);
    a.play().catch(() => undefined);
  };

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: () => session.submit(),
    onSuccess: (res: any) => {
      const sid = res?.data?.data?.submissionId ?? submissionId;
      navigate(`${STUDENT_BASE_PATH}/ket-qua/${sid}`);
    },
    onError: () => {
      alert("Lỗi nộp bài. Đang chuyển đến trang kết quả...");
      navigate(`${STUDENT_BASE_PATH}/ket-qua/${submissionId ?? 999}`);
    },
  });

  // Timer effect

  // Start / resume real exam from backend
  const startMutation = useMutation({
    mutationFn: async () => {
      if (querySubmissionId) {
        return studentApi.resumeTest(assignmentId);
      }
      const startRes: any = await studentApi.startTest(assignmentId);
      const startData = startRes?.data?.data;
      if (!startData?.exam && startData?.canResume) {
        return studentApi.resumeTest(assignmentId);
      }
      return startRes;
    },
    onSuccess: (res: any) => {
      const data = res?.data?.data;
      const rawExam = data?.exam ?? data?.assignment?.exam;
      if (!rawExam) {
        setLoadError("Không thể tải dữ liệu bài thi. Vui lòng thử lại.");
        return;
      }
      const sid = data?.submissionId ?? querySubmissionId ?? null;
      const remainingSec = Number(data?.timeRemaining ?? 0);
      const durSec = Number(rawExam?.eDuration_minutes ?? 179) * 60;
      setStartedAtServer(new Date(Date.now() - (durSec - remainingSec) * 1000).toISOString());
      setExam(rawExam);
      setSubmissionId(sid);
      if (sid) {
        const restored = mapSavedAnswers(data?.savedAnswers);
        if (Object.keys(restored).length > 0) {
          Object.entries(restored).forEach(([qid, val]) => session.setAnswer(qid, val));
        }
        const draft = examDraftStorage.load(sid);
        if (draft && Object.keys(draft.answers).length > 0) setResumeDraft(draft);
      }
      setStarted(true);
    },
    onError: () => {
      setLoadError("Không thể kết nối đến máy chủ. Vui lòng tải lại trang.");
    },
  });

  useEffect(() => {
    if (!started && !startMutation.isPending && !loadError) {
      startMutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!started) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        {loadError ? (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <p className="text-base font-semibold text-gray-800">{loadError}</p>
            <button
              onClick={() => { setLoadError(null); startMutation.mutate(); }}
              className="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-sm hover:bg-purple-700 transition"
            >
              Thử lại
            </button>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto" style={{ borderColor: "#EDE9FE", borderTopColor: "#7C3AED" }} />
            <p className="text-sm text-slate-500">Đang tải bài thi...</p>
          </div>
        )}
      </div>
    );
  }

  const skillData = VSTEP_STRUCTURE[currentSkill];

  return (
    <div className="min-h-screen bg-gray-100">
      <OfflineBanner online={session.online} pendingCount={session.pendingCount} />
      <TimeWarningBanner
        level={session.warningLevel}
        onDismiss={session.dismissWarning}
        timeRemaining={session.timeRemaining}
      />
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-white border-b border-gray-200 px-4 lg:px-6 shadow-sm">
        <div className="h-full max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-semibold text-gray-800">{exam?.eTitle}</span>
          </div>

          <div className="flex items-center gap-4">
            <SaveStatusIndicator
              status={session.saveStatus}
              lastSavedAt={session.lastSavedAt}
              pendingCount={session.pendingCount}
            />
            <div className="text-sm text-gray-600">
              Đã trả lời: <span className="font-bold text-gray-900">{answeredCount}/{questions.length}</span>
            </div>
            <div className="px-4 py-1.5 rounded-lg bg-blue-500 text-white font-mono font-bold text-lg">
              {formatClock(session.timeRemaining)}
            </div>
            <button
              onClick={() => setShowSubmit(true)}
              className="px-4 py-2 rounded-lg bg-purple-600 text-white font-bold text-sm hover:bg-purple-700 transition"
            >
              Nộp bài
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-8 px-4 lg:px-8">
        <div className="max-w-[1600px] mx-auto">
          {/* Skill Tabs */}
          <div className="bg-white rounded-t-xl border border-gray-200 border-b-0 p-4">
            <div className="flex gap-2 overflow-x-auto">
              {(Object.keys(VSTEP_STRUCTURE) as SkillType[]).map((skill) => {
                const data = VSTEP_STRUCTURE[skill];
                const isActive = currentSkill === skill;
                return (
                  <button
                    key={skill}
                    onClick={() => goToSkillPart(skill, 1)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition whitespace-nowrap"
                    style={{
                      background: isActive ? data.lightBg : "#F9FAFB",
                      color: isActive ? data.color : "#6B7280",
                      border: `2px solid ${isActive ? data.color : "transparent"}`,
                    }}
                  >
                    <span className="text-lg">{data.icon}</span>
                    <span>{data.name.toUpperCase()}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Part Tabs */}
          <div className="bg-white border-x border-gray-200 p-4 border-t border-gray-100">
            <div className="flex gap-2 overflow-x-auto">
              {skillData.parts.map((partData) => {
                const isActive = currentPart === partData.part;
                const answeredInPart = getPartAnsweredCount(currentSkill, partData.part);
                const totalInPart = partData.questions;

                return (
                  <button
                    key={partData.part}
                    onClick={() => setCurrentPart(partData.part)}
                    className="flex flex-col items-start px-4 py-2.5 rounded-lg font-semibold text-sm transition min-w-[140px]"
                    style={{
                      background: isActive ? skillData.lightBg : "#FFFFFF",
                      border: `2px solid ${isActive ? skillData.color : "#E5E7EB"}`,
                      color: isActive ? skillData.color : "#374151",
                    }}
                  >
                    <span>Part {partData.part}</span>
                    <span className="text-xs font-normal text-gray-500">
                      {answeredInPart}/{totalInPart} câu
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Area */}
          <div className="bg-white rounded-b-xl border border-gray-200 p-6 lg:p-8">
            <div className="flex gap-6">
              {/* Main Content */}
              <div className="flex-1">
                {/* Part Banner */}
                <div 
                  className="rounded-lg p-4 mb-6"
                  style={{ background: skillData.lightBg, borderLeft: `4px solid ${skillData.color}` }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{skillData.icon}</span>
                    <div>
                      <h2 className="font-bold text-lg" style={{ color: skillData.color }}>
                        {skillData.name} - Part {currentPart}
                      </h2>
                      <p className="text-sm text-gray-600">
                        {skillData.parts.find(p => p.part === currentPart)?.name} • {currentPartQuestions.length} câu hỏi
                      </p>
                    </div>
                  </div>
                </div>

                {/* Speaking: combined part-level recording block */}
                {currentSkill === "speaking" && currentPartQuestions.length > 0 && (() => {
                  const partKey = `speaking-part-${currentPart}`;
                  const isRecording = recordingQuestionId === partKey;
                  const uploadStatus = speakingUploadStatus[partKey];
                  return (
                    <div className="border border-gray-200 rounded-xl p-6 bg-white space-y-5 mb-6">
                      <div>
                        <h3 className="text-base font-bold text-gray-800 mb-1">Part {currentPart} — Câu hỏi</h3>
                        <p className="text-xs text-gray-500 mb-4">Đọc kỹ các câu hỏi, sau đó ghi âm một lần cho toàn bộ phần này.</p>
                        <div className="space-y-2 pl-2 border-l-2 border-purple-200">
                          {currentPartQuestions.map((q: any, i: number) => (
                            <p key={getQuestionId(q)} className="text-sm text-gray-700">
                              <span className="font-semibold text-purple-600 mr-2">{i + 1}.</span>
                              <span dangerouslySetInnerHTML={{ __html: q.qContent ?? '' }} />
                            </p>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg flex-wrap">
                        {isRecording ? (
                          <button
                            onClick={() => stopSpeakingRecording(partKey)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700 transition font-semibold"
                          >
                            <Square className="w-4 h-4" /> Dừng ghi âm
                          </button>
                        ) : (
                          <button
                            onClick={() => startSpeakingRecording(currentPart, currentPartQuestions)}
                            disabled={!!recordingQuestionId || uploadStatus === 'uploading'}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-purple-600 hover:bg-purple-700 transition font-semibold disabled:opacity-50"
                          >
                            <Mic className="w-4 h-4" /> {uploadStatus === 'uploaded' ? 'Ghi âm lại' : 'Bắt đầu ghi âm'}
                          </button>
                        )}
                        <button
                          onClick={() => playSpeakingAudio(partKey)}
                          disabled={!speakingMediaMap[partKey]?.url || uploadStatus === 'uploading'}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-slate-700 hover:bg-slate-800 transition font-semibold disabled:opacity-50"
                        >
                          <Play className="w-4 h-4" /> Nghe lại
                        </button>
                        <p className="w-full text-xs mt-1" style={{
                          color: uploadStatus === 'uploaded' ? '#16A34A'
                            : uploadStatus === 'error' ? '#DC2626'
                            : '#6B7280'
                        }}>
                          {isRecording
                            ? '🔴 Đang ghi âm...'
                            : uploadStatus === 'uploading'
                            ? '⏳ Đang tải lên máy chủ...'
                            : uploadStatus === 'uploaded'
                            ? '✓ Đã tải lên. Bài nói sẽ được AI chấm điểm sau khi nộp.'
                            : uploadStatus === 'error'
                            ? '⚠ Lỗi tải lên. Hãy ghi âm lại.'
                            : speakingMediaMap[partKey]?.url
                            ? 'Bạn có thể ghi âm lại.'
                            : 'Nhấn để bắt đầu ghi âm.'}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Questions */}
                <div className="space-y-6">
                  {currentPartQuestions.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      Không có câu hỏi trong phần này
                    </div>
                  ) : (
                    currentPartQuestions.map((question: any, index: number) => {
                      const qKey = getQuestionId(question);
                      const selected = String(session.answers[qKey] ?? "");
                      const isBookmarked = bookmarks.has(qKey);

                      // Render based on skill type
                      if (currentSkill === "listening" || currentSkill === "reading") {
                        const options = getOptions(question);
                        return (
                          <div key={qKey || index} className="border border-gray-200 rounded-lg p-5">
                            <div className="flex items-start justify-between mb-3">
                              <h3 
                                className="text-base font-bold text-gray-800 flex-1" 
                                dangerouslySetInnerHTML={{ __html: question.qContent ?? `Question ${index + 1}` }} 
                              />
                              <button
                                onClick={() => toggleBookmark(qKey)}
                                className="ml-3 p-1.5 rounded hover:bg-gray-100 transition"
                              >
                                {isBookmarked ? (
                                  <BookmarkCheck className="w-5 h-5 text-amber-500" />
                                ) : (
                                  <Bookmark className="w-5 h-5 text-gray-400" />
                                )}
                              </button>
                            </div>
                            <div className="space-y-2">
                              {options.map((opt: any) => (
                                <label
                                  key={opt.id}
                                  className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition"
                                  style={{
                                    background: selected === opt.value ? skillData.lightBg : "#F9FAFB",
                                    border: `2px solid ${selected === opt.value ? skillData.color : "#E5E7EB"}`,
                                  }}
                                >
                                  <input
                                    type="radio"
                                    className="mt-1"
                                    checked={selected === opt.value}
                                    onChange={() => handleAnswerChange(question, opt.value)}
                                  />
                                  <span dangerouslySetInnerHTML={{ __html: `${opt.label}. ${opt.content}` }} />
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      if (currentSkill === "writing") {
                        const minWords = question.qWord_count || 150;
                        const wordCount = selected.trim().split(/\s+/).filter(Boolean).length;

                        return (
                          <div key={qKey || index} className="border border-gray-200 rounded-lg p-5">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h3 className="text-base font-bold text-gray-800 mb-2">
                                  Task {currentPart}
                                </h3>
                                <p className="text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: question.qContent }} />
                              </div>
                              <button
                                onClick={() => toggleBookmark(qKey)}
                                className="ml-3 p-1.5 rounded hover:bg-gray-100 transition"
                              >
                                {isBookmarked ? (
                                  <BookmarkCheck className="w-5 h-5 text-amber-500" />
                                ) : (
                                  <Bookmark className="w-5 h-5 text-gray-400" />
                                )}
                              </button>
                            </div>
                            <div className="mb-2 text-sm">
                              <span className={wordCount >= minWords ? "text-green-600 font-semibold" : "text-gray-600"}>
                                {wordCount} từ
                              </span>
                              <span className="text-gray-400"> / {minWords} từ tối thiểu</span>
                            </div>
                            <textarea
                              value={selected}
                              onChange={(e) => handleAnswerChange(question, e.target.value)}
                              className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                              placeholder="Nhập câu trả lời của bạn..."
                            />
                          </div>
                        );
                      }

                      if (currentSkill === "speaking") {
                        // Speaking renders as a single part-level block — skip individual question cards
                        // (the combined view is rendered before this map, see below)
                        return null;
                      }

                      return null;
                    })
                  )}
                </div>
              </div>

              {/* Question Navigator Sidebar */}
              <div className="w-64 flex-shrink-0">
                <div className="sticky top-24 border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h3 className="font-bold text-sm text-gray-800 mb-3">Danh sách câu hỏi</h3>
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {currentPartQuestions.map((q: any, idx: number) => {
                      const qid = getQuestionId(q);
                      const isAnswered = String(session.answers[qid] ?? "").trim() !== "";
                      const isBookmarked = bookmarks.has(qid);

                      return (
                        <button
                          key={qid}
                          className="w-10 h-10 rounded-lg font-semibold text-sm transition relative"
                          style={{
                            background: isAnswered ? "#10B981" : "#E5E7EB",
                            color: isAnswered ? "#FFFFFF" : "#6B7280",
                          }}
                        >
                          {idx + 1}
                          {isBookmarked && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-green-500" />
                      <span className="text-gray-600">Đã trả lời</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-gray-300" />
                      <span className="text-gray-600">Chưa trả lời</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-amber-500" />
                      <span className="text-gray-600">Đánh dấu</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Submit Dialog */}
      <SubmitDialog
        open={showSubmit}
        total={questions.length}
        answered={answeredCount}
        onConfirm={() => submitMutation.mutate()}
        onCancel={() => setShowSubmit(false)}
        loading={submitMutation.isPending}
      />
      <ResumeExamModal
        draft={resumeDraft}
        open={!!resumeDraft}
        onResume={(draft) => { session.resume(draft); setResumeDraft(null); }}
        onDiscard={() => { if (submissionId) examDraftStorage.clear(submissionId); setResumeDraft(null); }}
      />
      <MultiTabWarning hasOtherTab={session.hasOtherTab} position="floating" />
    </div>
  );
}

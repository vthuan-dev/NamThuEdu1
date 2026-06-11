import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Camera, Mic, Volume2, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { studentApi } from "@/services/studentApi";

const BRAND = "#7C3AED";
const STUDENT_BASE_PATH = "/hoc-vien";

type ExamLobbyInfo = {
  title: string;
  durationMinutes: number | null;
  examType: string | null;
};

export function ExamLobby() {
  const { id } = useParams<{ id: string }>();
  const assignmentId = Number(id ?? 0);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [speakerReady, setSpeakerReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [loadingExam, setLoadingExam] = useState(true);
  const [startingExam, setStartingExam] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [examId, setExamId] = useState<number | null>(null);
  const [examInfo, setExamInfo] = useState<ExamLobbyInfo>({
    title: t("student.examLobby.defaultTitle"),
    durationMinutes: null,
    examType: null,
  });

  const applyStreamToPreview = (stream: MediaStream) => {
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => undefined);
    }
  };

  const requestCameraOnly = async (silent = false) => {
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      applyStreamToPreview(cameraStream);
      setCameraReady(true);
      return true;
    } catch {
      setCameraReady(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (!silent) {
        alert(t("student.examLobby.alertCameraMicPermission"));
      }
      return false;
    }
  };

  const requestMicOnly = async (silent = false) => {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicReady(true);
      micStream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      setMicReady(false);
      if (!silent) {
        alert(t("student.examLobby.alertMicPermission"));
      }
      return false;
    }
  };

  const requestCameraAndMic = async (silent = false) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatusMessage(t("student.examLobby.mediaUnsupported"));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      applyStreamToPreview(stream);
      setCameraReady(true);
      setMicReady(true);
      setStatusMessage(t("student.examLobby.permissionGranted"));
    } catch {
      const [cameraOk, micOk] = await Promise.all([
        requestCameraOnly(true),
        requestMicOnly(true),
      ]);
      if (cameraOk && micOk) {
        setStatusMessage(t("student.examLobby.permissionGranted"));
      } else {
        setStatusMessage(t("student.examLobby.permissionRequired"));
        if (!silent) {
          alert(t("student.examLobby.alertCameraMicPermission"));
        }
      }
    }
  };

  const loadExamInfo = async () => {
    if (!assignmentId) {
      setLoadingExam(false);
      return;
    }

    try {
      setLoadingExam(true);
      const res: any = await studentApi.getTestDetail(assignmentId);
      const data = res?.data?.data;
      const assignment = data?.assignment ?? data;
      const exam = assignment?.exam ?? data?.exam;
      const title =
        exam?.eTitle ??
        assignment?.exam_title ??
        data?.exam_title ??
        t("student.examLobby.defaultTitle");
      const duration = Number(
        exam?.eDuration_minutes ??
          assignment?.exam_duration ??
          data?.exam_duration ??
          0
      );

      const examType = String(
        exam?.eType ?? assignment?.exam_type ?? data?.exam_type ?? ""
      ) || null;
      setExamId(Number(exam?.eId ?? assignment?.exam_id ?? data?.exam_id ?? 0) || null);
      setExamInfo({
        title: String(title),
        durationMinutes: duration > 0 ? duration : null,
        examType,
      });
    } catch {
      setStatusMessage(t("student.examLobby.loadExamFailed"));
    } finally {
      setLoadingExam(false);
    }
  };

  useEffect(() => {
    // Đã bỏ màn chờ kiểm tra thiết bị (camera/mic) — không xin quyền nữa.
    loadExamInfo();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Bỏ màn chờ: tự động vào thẳng làm bài cho MỌI loại đề (không kiểm tra thiết bị).
  const autoStartedRef = useRef(false);
  const [autoStarting, setAutoStarting] = useState(false);
  useEffect(() => {
    if (loadingExam || autoStartedRef.current || !assignmentId) return;

    autoStartedRef.current = true;
    setAutoStarting(true);
    (async () => {
      try {
        // Dừng mọi stream camera/mic (nếu lỡ có) vì đã bỏ luồng kiểm tra thiết bị.
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        const startRes: any = await studentApi.startTest(assignmentId);
        const sid = Number(startRes?.data?.data?.submissionId ?? 0);
        if (!sid) throw new Error("missing-submission-id");

        // Kết nối real-time là tùy chọn — không được chặn vào thi.
        try {
          await studentApi.connectTestWebsocket(sid);
        } catch {
          try { await studentApi.reconnectTestWebsocket(sid); } catch { /* real-time optional */ }
        }

        const typeStr = String(examInfo.examType ?? "").toUpperCase();
        const titleStr = examInfo.title.toLowerCase();
        const isIelts = typeStr === "IELTS" || titleStr.includes("ielts");
        const isVstep = typeStr === "VSTEP" || titleStr.includes("vstep");
        const routeId = examId ?? assignmentId;

        if (isIelts) {
          navigate(`${STUDENT_BASE_PATH}/lam-bai-ielts/${routeId}?submissionId=${sid}`, { replace: true });
        } else if (isVstep) {
          navigate(`${STUDENT_BASE_PATH}/lam-bai-vstep/${routeId}?submissionId=${sid}`, { replace: true });
        } else {
          navigate(`${STUDENT_BASE_PATH}/lam-bai/${assignmentId}?autostart=1&submissionId=${sid}`, { replace: true });
        }
      } catch {
        // Nếu tự động vào bài thất bại → hiện thông báo (không còn lobby thiết bị).
        autoStartedRef.current = false;
        setAutoStarting(false);
        setStatusMessage(t("student.examLobby.sessionFailed"));
      }
    })();
  }, [loadingExam, examInfo.examType, examInfo.title, examId, assignmentId, navigate, t]);

  const enableCamera = async () => {
    const cameraOk = await requestCameraOnly(false);
    if (cameraOk) {
      if (micReady) {
        setStatusMessage(t("student.examLobby.permissionGranted"));
      } else {
        setStatusMessage(t("student.examLobby.permissionRequired"));
      }
    }
  };

  const testSpeaker = async () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      oscillator.connect(gain);
      gain.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.6);
      setSpeakerReady(true);
    } catch {
      setSpeakerReady(false);
    }
  };

  const testMic = async () => {
    try {
      setRecording(true);
      const micOk = await requestMicOnly(false);
      if (!micOk) throw new Error("mic-failed");
      window.setTimeout(() => {
        setMicReady(true);
        setRecording(false);
      }, 1500);
    } catch {
      setMicReady(false);
      setRecording(false);
      alert(t("student.examLobby.alertMicPermission"));
    }
  };

  const canEnter = cameraReady && speakerReady && micReady && !startingExam && !loadingExam;
  const readyCount = Number(cameraReady) + Number(speakerReady) + Number(micReady);
  const readinessPercent = Math.round((readyCount / 3) * 100);

  const handleEnterExam = async () => {
    if (!assignmentId) return;

    if (!cameraReady || !micReady) {
      alert(t("student.examLobby.alertCameraMicPermission"));
      return;
    }

    if (!speakerReady) {
      alert(t("student.examLobby.alertSpeakerRequired"));
      return;
    }

    try {
      setStartingExam(true);
      setStatusMessage(t("student.examLobby.startingSession"));

      const startRes: any = await studentApi.startTest(assignmentId);
      const startData = startRes?.data?.data ?? {};
      const sid = Number(startData?.submissionId ?? 0);

      if (!sid) {
        throw new Error("missing-submission-id");
      }

      try {
        await studentApi.connectTestWebsocket(sid);
      } catch {
        try { await studentApi.reconnectTestWebsocket(sid); } catch { /* real-time optional */ }
      }
      setStatusMessage(t("student.examLobby.sessionConnected"));
      const isVstep =
        String(examInfo.examType ?? "").toUpperCase() === "VSTEP" ||
        examInfo.title.toLowerCase().includes("vstep");
      const routeId = isVstep && examId ? examId : assignmentId;
      navigate(
        isVstep
          ? `${STUDENT_BASE_PATH}/lam-bai-vstep/${routeId}?submissionId=${sid}`
          : `${STUDENT_BASE_PATH}/lam-bai/${assignmentId}?autostart=1&submissionId=${sid}`
      );
    } catch {
      setStatusMessage(t("student.examLobby.sessionFailed"));
      alert(t("student.examLobby.alertSessionFailed"));
    } finally {
      setStartingExam(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[#F8FAFC] px-3 md:px-6 py-5 md:py-8">
      <div className="pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full bg-[#DBEAFE] blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-24 -right-12 h-80 w-80 rounded-full bg-[#FFE8D6] blur-3xl opacity-70" />

      {!statusMessage ? (
        <div className="relative max-w-[640px] mx-auto mt-24 flex flex-col items-center justify-center gap-4 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#2563EB]" />
          <p className="text-lg font-bold text-[#1E293B]">{t("student.examLobby.startingSession")}</p>
        </div>
      ) : (
        <div className="relative max-w-[480px] mx-auto mt-24 flex flex-col items-center justify-center gap-4 text-center rounded-3xl border-2 border-[#FECACA] bg-white p-8">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <p className="text-lg font-bold text-[#1E293B]">{statusMessage}</p>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`${STUDENT_BASE_PATH}/bai-tap`)}
              className="px-5 py-2.5 rounded-xl border-2 border-slate-200 font-bold text-slate-600 hover:bg-slate-50">
              {t("common.back")}
            </button>
            <button onClick={() => { setStatusMessage(""); autoStartedRef.current = false; loadExamInfo(); }}
              className="px-5 py-2.5 rounded-xl font-bold text-white" style={{ background: "linear-gradient(90deg,#7C3AED,#2563EB)" }}>
              Thử lại
            </button>
          </div>
        </div>
      )}
      {false && (
      <div className="relative max-w-[1360px] mx-auto rounded-[32px] border-[3px] border-[#BFDBFE] bg-white p-4 md:p-8 shadow-[0_18px_60px_rgba(15,23,42,0.12)]">
        <button
          onClick={() => navigate(`${STUDENT_BASE_PATH}/bai-tap`)}
          className="mb-4 inline-flex items-center gap-2 rounded-xl border-2 border-[#BFDBFE] bg-white px-3 py-2 text-sm font-bold text-[#1D4ED8] transition-colors hover:bg-[#EFF6FF]"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("common.back")}
        </button>

        <div className="rounded-[24px] border-[3px] border-[#DBEAFE] bg-gradient-to-r from-[#EFF6FF] to-[#F8FAFC] px-4 py-5 md:px-7 md:py-6">
          <div className="flex flex-col gap-4 md:gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-[#2563EB]">{t("student.examLobby.title")}</p>
              <h1 className="mt-1 text-2xl md:text-4xl font-black text-[#0F172A] leading-tight">{examInfo.title}</h1>
              <p className="mt-2 text-sm md:text-[15px] font-medium text-slate-600">{t("student.examLobby.subtitle")}</p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl border-2 border-[#93C5FD] bg-white px-4 py-2">
              <ClockIcon />
              <p className="text-sm font-bold text-[#1E3A8A]">
                {examInfo.durationMinutes
                  ? t("student.examLobby.duration", { minutes: examInfo.durationMinutes })
                  : t("student.examLobby.loadingExam")}
              </p>
            </div>
          </div>
        </div>

        {(loadingExam || statusMessage) && (
          <div className="mt-4 rounded-2xl border-2 px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 bg-white"
            style={{
              borderColor: loadingExam ? "#BFDBFE" : cameraReady && micReady ? "#BBF7D0" : "#FDE68A",
              color: loadingExam ? "#1D4ED8" : cameraReady && micReady ? "#15803D" : "#92400E",
            }}
          >
            {loadingExam ? <Loader2 className="w-4 h-4 animate-spin" /> : cameraReady && micReady ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{loadingExam ? t("student.examLobby.loadingExam") : statusMessage}</span>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 xl:grid-cols-12 gap-5">
          <section className="xl:col-span-3 rounded-3xl border-2 border-[#E2E8F0] bg-white p-5">
            <div className="w-10 h-10 rounded-2xl bg-[#DBEAFE] text-[#1D4ED8] font-black flex items-center justify-center">1</div>
            <h3 className="mt-3 text-[22px] leading-tight font-black text-[#1E293B]">{t("student.examLobby.sectionExamStructure")}</h3>
            <ul className="mt-4 text-[15px] leading-7 text-slate-600 font-medium space-y-1">
              <li>{t("student.examLobby.skill1")}</li>
              <li>{t("student.examLobby.skill2")}</li>
              <li>{t("student.examLobby.skill3")}</li>
              <li>{t("student.examLobby.skill4")}</li>
            </ul>
          </section>

          <section className="xl:col-span-5 rounded-3xl border-[3px] border-[#93C5FD] bg-gradient-to-b from-[#EFF6FF] to-white p-5 shadow-[0_14px_30px_rgba(37,99,235,0.16)]">
            <div className="w-10 h-10 rounded-2xl bg-[#DBEAFE] text-[#1D4ED8] font-black flex items-center justify-center">2</div>
            <h3 className="mt-3 text-[22px] leading-tight font-black text-[#1E293B]">{t("student.examLobby.sectionDeviceCheck")}</h3>

            <div className="mt-4 rounded-2xl border-2 border-[#CBD5E1] bg-[#F1F5F9] p-3">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-64 object-cover rounded-xl bg-[#CBD5E1]" />
              <button
                onClick={enableCamera}
                className="mt-3 w-full py-3 rounded-xl text-white font-extrabold text-[15px] transition-transform hover:scale-[1.01]"
                style={{ background: `linear-gradient(90deg, ${BRAND}, #2563EB)` }}
              >
                <span className="inline-flex items-center gap-2">
                  <Camera className="w-4 h-4" /> {t("student.examLobby.enableCamera")}
                </span>
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={testSpeaker} className="py-3 rounded-xl bg-white border-2 border-slate-200 hover:border-[#93C5FD] text-slate-700 text-sm font-bold transition-colors">
                <span className="inline-flex items-center gap-2">
                  <Volume2 className="w-4 h-4" /> {t("student.examLobby.testSpeaker")}
                </span>
              </button>
              <button onClick={testMic} className="py-3 rounded-xl bg-white border-2 border-slate-200 hover:border-[#93C5FD] text-slate-700 text-sm font-bold transition-colors">
                <span className="inline-flex items-center gap-2">
                  <Mic className="w-4 h-4" /> {recording ? t("student.examLobby.recording") : t("student.examLobby.testMic")}
                </span>
              </button>
            </div>
          </section>

          <section className="xl:col-span-4 rounded-3xl border-2 border-[#E2E8F0] bg-white p-5">
            <div className="w-10 h-10 rounded-2xl bg-[#DBEAFE] text-[#1D4ED8] font-black flex items-center justify-center">3</div>
            <h3 className="mt-3 text-[22px] leading-tight font-black text-[#1E293B]">{t("student.examLobby.sectionReady")}</h3>

            <div className="mt-3 rounded-2xl border-2 border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <p className="text-xs uppercase tracking-[0.2em] font-extrabold text-slate-500">Readiness</p>
              <div className="mt-2 h-3 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#2563EB] to-[#10B981] transition-all duration-300" style={{ width: `${readinessPercent}%` }} />
              </div>
              <p className="mt-2 text-sm font-bold text-slate-700">{readyCount}/3 thiết bị sẵn sàng</p>
            </div>

            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-xl px-3 py-2.5 bg-slate-50 border-2 border-slate-200 font-semibold">
                <span>{t("student.examLobby.camera")}</span>
                {cameraReady ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />}
              </div>
              <div className="flex items-center justify-between rounded-xl px-3 py-2.5 bg-slate-50 border-2 border-slate-200 font-semibold">
                <span>{t("student.examLobby.speaker")}</span>
                {speakerReady ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />}
              </div>
              <div className="flex items-center justify-between rounded-xl px-3 py-2.5 bg-slate-50 border-2 border-slate-200 font-semibold">
                <span>{t("student.examLobby.microphone")}</span>
                {micReady ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />}
              </div>
            </div>

            <button
              onClick={handleEnterExam}
              disabled={!canEnter}
              className="mt-4 w-full py-3.5 rounded-xl text-white font-black text-[15px] transition-transform hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
              style={{ background: canEnter ? "linear-gradient(90deg,#16A34A,#22C55E)" : "#94A3B8" }}
            >
              {startingExam ? t("student.examLobby.connecting") : t("student.examLobby.enterExam")}
            </button>
          </section>
        </div>
      </div>
      )}
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

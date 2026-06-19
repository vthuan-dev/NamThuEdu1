import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Clock,
  FileText,
  Search,
  Play,
  GraduationCap,
  AlertCircle,
  Headphones,
  PenTool,
  Mic,
  Layers,
  ChevronRight,
  Sparkles,
  Trophy,
  X,
  Camera,
  Volume2,
  Square,
  RotateCcw,
  CheckCircle2,
  Loader2,
  Upload,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { studentApi, BrowseExam } from "../../../../services/studentApi";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const PURPLE       = "#7C3AED";
const PURPLE_MID   = "#8B5CF6";
const PURPLE_LIGHT = "#EDE9FE";
const VSTEP_COLOR  = "#0EA5E9";
const VSTEP_DARK   = "#0369A1";
const VSTEP_BG     = "#E0F2FE";
const IELTS_COLOR  = "#10B981";
const IELTS_DARK   = "#065F46";
const IELTS_BG     = "#D1FAE5";

type TabType = "ALL" | "VSTEP" | "IELTS";
type SortType = "default" | "title_asc" | "title_desc" | "duration_asc" | "duration_desc" | "recent_attempt";
type DurationFilter = "all" | "short" | "long" | "attempted" | "unattempted";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Highlights occurrences of `query` inside `text` with a yellow mark. */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            style={{ background: '#FDE68A', color: '#78350F', borderRadius: 3, padding: '0 2px', fontWeight: 700 }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

const SKILLS = [
  { key: "listening", label: "Nghe",  icon: Headphones, color: "#F59E0B" },
  { key: "reading",   label: "Đọc",   icon: BookOpen,   color: "#0EA5E9" },
  { key: "writing",   label: "Viết",  icon: PenTool,    color: "#8B5CF6" },
  { key: "speaking",  label: "Nói",   icon: Mic,        color: "#EC4899" },
];

// ─── Pre-Exam Confirmation Modal ──────────────────────────────────────────────
function PreExamModal({
  open,
  onClose,
  exam,
  examPath,
  typeColor,
}: {
  open: boolean;
  onClose: () => void;
  exam: BrowseExam;
  examPath: string;
  typeColor: string;
}) {
  const navigate = useNavigate();

  // Fetch real-time user profile from backend when modal is open
  const { data: profileData } = useQuery({
    queryKey: ["student", "profile"],
    queryFn: () => studentApi.getProfile(),
    enabled: open,
    staleTime: 60_000,
  });
  const profile = (profileData as any)?.data?.data ?? (profileData as any)?.data ?? null;

  // Fallback to localStorage if API hasn't resolved yet
  const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const localUser = userStr ? (() => { try { return JSON.parse(userStr); } catch { return null; } })() : null;

  const fullName = profile?.name ?? profile?.uName ?? localUser?.name ?? localUser?.uName ?? "Học viên";
  const accountCode = profile?.phone ?? profile?.uPhone ?? localUser?.phone ?? localUser?.uPhone ?? "";
  const examCode = `EXAM${String(exam.id).padStart(6, "0")}`;

  // Audio test
  const [recState, setRecState] = useState<"idle" | "recording" | "recorded">("idle");
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const TTS_SAMPLE = "This is a sound test. Let's prepare for the exam. Please make sure your speakers are working properly. If you can hear this message clearly, your audio is ready. Good luck on your test.";

  const playTtsSample = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(TTS_SAMPLE);
    utt.lang = "en-US";
    utt.rate = 0.92;
    utt.pitch = 1;
    utt.onstart = () => setTtsPlaying(true);
    utt.onend = () => setTtsPlaying(false);
    utt.onerror = () => setTtsPlaying(false);
    window.speechSynthesis.speak(utt);
  };

  const stopTts = () => {
    window.speechSynthesis?.cancel();
    setTtsPlaying(false);
  };

  // Camera/photo capture
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [camStatus, setCamStatus] = useState<"loading" | "ready" | "blocked">("loading");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");

  // useCallback ref: attach stream to video element as soon as it mounts
  const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && camStreamRef.current) {
      node.srcObject = camStreamRef.current;
      node.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setCamStatus("loading");
      return;
    }
    let cancelled = false;
    setCamStatus("loading");
    // Start camera preview (best-effort, optional)
    navigator.mediaDevices?.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        camStreamRef.current = stream;
        // Attach to video element if already mounted
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setCamStatus("ready");
      })
      .catch(() => { if (!cancelled) setCamStatus("blocked"); });
    return () => {
      cancelled = true;
      window.speechSynthesis?.cancel();
      setTtsPlaying(false);
      camStreamRef.current?.getTracks().forEach((t) => t.stop());
      camStreamRef.current = null;
      setPhoto(null);
      setUploadStatus("idle");
      try { mrRef.current?.stop(); } catch {}
      mrRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const takePhoto = () => {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 640;
    canvas.height = v.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(v, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    setPhoto(dataUrl);
    setUploadStatus("uploading");
    // Convert dataURL to Blob and upload
    canvas.toBlob((blob) => {
      if (!blob) { setUploadStatus("error"); return; }
      studentApi.uploadCheckinPhoto(exam.id, blob)
        .then(() => setUploadStatus("done"))
        .catch(() => setUploadStatus("error"));
    }, "image/jpeg", 0.88);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        setRecState("recorded");
      };
      mr.start();
      mrRef.current = mr;
      setRecState("recording");
      // Auto-stop after 10s
      setTimeout(() => { if (mr.state === "recording") mr.stop(); }, 10000);
    } catch {
      alert("Không thể truy cập microphone. Vui lòng cấp quyền ghi âm.");
    }
  };

  const stopRecording = () => mrRef.current?.stop();
  const resetRecording = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setRecState("idle");
  };

  const skillRows = [
    { label: "Kỹ năng 1: NGHE",  parts: 3, mins: 47 },
    { label: "Kỹ năng 2: ĐỌC",   parts: 4, mins: 60 },
    { label: "Kỹ năng 3: VIẾT",  parts: 2, mins: 60 },
    { label: "Kỹ năng 4: NÓI",   parts: 3, mins: 12 },
  ];

  const goExam = () => {
    onClose();
    navigate(examPath);
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-6 pb-10 overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />

          {/* Panel */}
          <motion.div
            className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800 truncate pr-4">{exam.title}</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-center text-[13px] text-slate-500 py-2 bg-slate-50 border-b border-slate-100">
              Vui lòng cấp quyền sử dụng micro cho trình duyệt trước khi thi.
            </p>

            {/* Top: Camera + student info */}
            <div className="px-6 pt-5 pb-4 flex justify-center">
            <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-6 items-start w-full max-w-lg">
              <div>
                <div className="w-[180px] h-[135px] bg-slate-100 rounded-md overflow-hidden border border-slate-200 relative">
                  {photo ? (
                    <img src={photo} alt="capture" className="w-full h-full object-cover" />
                  ) : (
                    <video ref={videoCallbackRef} className="w-full h-full object-cover" muted playsInline />
                  )}
                  {camStatus !== "ready" && !photo && (
                    <div className="absolute inset-0 flex items-center justify-center text-center text-[11px] text-slate-500 px-2 bg-slate-100">
                      {camStatus === "loading" ? "Đang khởi tạo camera..." : "Camera không khả dụng"}
                    </div>
                  )}
                </div>
                <button
                  onClick={photo ? () => { setPhoto(null); setUploadStatus("idle"); } : takePhoto}
                  disabled={camStatus !== "ready" && !photo}
                  className="mt-2 w-[180px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {photo ? "Chụp lại" : "Chụp hình"}
                </button>
                {/* Upload status indicator */}
                {uploadStatus === "uploading" && (
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] text-sky-600">
                    <Loader2 className="w-3 h-3 animate-spin" /> Đang lưu ảnh...
                  </div>
                )}
                {uploadStatus === "done" && (
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" /> Ảnh đã được lưu
                  </div>
                )}
                {uploadStatus === "error" && (
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] text-rose-500">
                    <AlertCircle className="w-3 h-3" /> Lưu ảnh thất bại
                  </div>
                )}
              </div>
              <div className="space-y-1.5 text-[13px] text-slate-700">
                <p><span className="text-slate-500">Họ tên:</span> <strong>{fullName}</strong></p>
                <p><span className="text-slate-500">Tài khoản:</span> <strong>{accountCode}</strong></p>
                <p><span className="text-slate-500">Mã lượt thi:</span> <strong>{examCode}</strong></p>
              </div>
            </div>
            </div>

            {/* 3-column grid */}
            <div className="px-6 pb-6 pt-2 grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-slate-100">
              {/* 1 — Cấu trúc */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">1</span>
                  <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-700">Cấu trúc bài thi</h3>
                </div>
                <ul className="space-y-1.5 text-[13px] text-slate-700">
                  {skillRows.map((s) => (
                    <li key={s.label}>
                      <span className="font-semibold text-rose-500">{s.label}</span> – {s.parts} phần ({s.mins} phút)
                    </li>
                  ))}
                </ul>
              </div>

              {/* 2 — Audio test */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">2</span>
                  <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-700">Kiểm tra âm thanh</h3>
                </div>
                <p className="text-[12px] text-slate-600 mb-2">- Bước 1: Nghe đoạn audio mẫu bên dưới.</p>
                <div className="flex items-center gap-2 mb-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <button
                    onClick={ttsPlaying ? stopTts : playTtsSample}
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                      ttsPlaying ? "bg-rose-500 hover:bg-rose-600" : "bg-sky-500 hover:bg-sky-600"
                    }`}
                  >
                    {ttsPlaying
                      ? <Square className="w-3 h-3 fill-white text-white" />
                      : <Play className="w-3 h-3 fill-white text-white ml-0.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-slate-700 truncate">Sound test sample</p>
                    <p className="text-[10px] text-slate-400">{ttsPlaying ? "Đang phát..." : "Nhấn ▶ để nghe"}</p>
                  </div>
                  <Volume2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                </div>
                <p className="text-[12px] text-slate-600">- Bước 2: Đặt mic sát miệng.</p>
                <p className="text-[12px] text-slate-600 mb-2">- Bước 3: Bấm "Thu âm" → sau đó "Nghe lại".</p>
                <div className="flex gap-2">
                  {recState === "idle" && (
                    <button onClick={startRecording} className="px-3 py-1.5 rounded-md bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold inline-flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5" /> Thu âm
                    </button>
                  )}
                  {recState === "recording" && (
                    <button onClick={stopRecording} className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 animate-pulse">
                      <Square className="w-3.5 h-3.5 fill-white" /> Dừng
                    </button>
                  )}
                  {recState === "recorded" && recordedUrl && (
                    <>
                      <audio controls src={recordedUrl} className="flex-1 h-8" />
                      <button onClick={resetRecording} className="px-2 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 3 — Notes + CTA */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">3</span>
                  <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-700">Lưu ý</h3>
                </div>
                <ul className="space-y-1.5 text-[12px] text-slate-600 mb-4">
                  <li>- Khi hết thời gian mỗi kỹ năng, hệ thống tự động chuyển tiếp.</li>
                  <li>- Bấm "TIẾP TỤC" để sang part hoặc kỹ năng kế tiếp.</li>
                  <li className="text-rose-500 font-semibold">- Bài thi sẽ là thật, không thể làm lại.</li>
                </ul>
                <button
                  onClick={goExam}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white text-sm font-bold uppercase tracking-wider transition-all shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Nhận đề
                </button>
                <p className="text-center text-[12px] text-slate-500 mt-3">
                  hoặc <button onClick={onClose} className="text-sky-600 hover:underline">quay lại</button>
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ─── Device detection ───────────────────────────────────────────────────────
function isMobileDevice(): boolean {
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || "";
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
  const isTouchSmall = navigator.maxTouchPoints > 1 && window.innerWidth < 1024;
  return mobileRegex.test(ua) || isTouchSmall;
}

const formatTimeAgo = (timestamp: number) => {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(timestamp).toLocaleDateString("vi-VN");
};

// ─── Exam Card ────────────────────────────────────────────────────────────────
function ExamCard({
  exam,
  idx,
  highlight = '',
  recentAttemptTime,
}: {
  exam: BrowseExam;
  idx: number;
  highlight?: string;
  recentAttemptTime?: number;
}) {
  const isVstep    = exam.type === "VSTEP";
  const isIelts    = exam.type === "IELTS";
  const typeColor  = isVstep ? VSTEP_COLOR  : IELTS_COLOR;
  const typeDark   = isVstep ? VSTEP_DARK   : IELTS_DARK;
  const typeBg     = isVstep ? VSTEP_BG     : IELTS_BG;
  const examPath   = isIelts
    ? `/hoc-vien/de-thi/ielts/${exam.id}`        // Trang detail (chọn mode practice/full test)
    : `/hoc-vien/lam-bai-vstep/${exam.id}`;
  const scope = (exam.scope || (exam.skill === "mixed" ? "full" : "skill")).toLowerCase();
  const scopeLabel = scope === "full" ? "Full test" : scope === "part" ? "Part" : "Skill";
  const visibleSkills = scope === "full"
    ? SKILLS
    : SKILLS.filter((item) => item.key === (exam.ielts_skill || exam.skill || "").toLowerCase());
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [mobileBlocked, setMobileBlocked] = useState(false);

  const handleStartExam = () => {
    if (isMobileDevice()) {
      setMobileBlocked(true);
      return;
    }
    // IELTS: skip pre-exam modal, navigate thẳng vào trang detail (Practice/Full test selector)
    if (isIelts) {
      navigate(examPath);
      return;
    }
    // VSTEP: hiện pre-exam modal (camera/mic check)
    setShowModal(true);
  };

  return (
    <div
      className="group relative flex flex-col rounded-3xl bg-white overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
      style={{
        border: "1.5px solid #F0F0F8",
        boxShadow: "0 2px 12px rgba(124,58,237,0.06)",
      }}
    >
      {/* ── Gradient card header ── */}
      <div
        className="relative px-5 pt-5 pb-4 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${typeColor}18 0%, ${PURPLE}10 100%)`,
        }}
      >
        {/* Decorative orb */}
        <div
          className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20"
          style={{ background: `radial-gradient(circle, ${typeColor}, transparent)` }}
        />

        {/* Type + number badge row */}
        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide"
              style={{
                background: typeBg,
                color: typeDark,
                border: `1px solid ${typeColor}30`,
              }}
            >
              <Sparkles className="w-3 h-3" />
              {exam.type}
            </span>
            {recentAttemptTime && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Vừa làm {formatTimeAgo(recentAttemptTime)}
              </span>
            )}
          </div>
          <span
            className="text-xs font-bold opacity-40"
            style={{ color: PURPLE }}
          >
            #{String(idx + 1).padStart(2, "0")}
          </span>
        </div>

        {/* Title */}
        <h3
          className="font-extrabold leading-snug line-clamp-2 relative z-10 mb-2"
          style={{ fontSize: 16, color: "#1A1040", letterSpacing: "-0.01em" }}
        >
          <Highlight text={exam.title} query={highlight} />
        </h3>

        {/* Skill chips */}
        <div className="flex items-center gap-1.5 flex-wrap relative z-10">
          {visibleSkills.map(({ key, label, icon: Icon, color }) => (
            <span
              key={key}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: "#fff", color, border: `1px solid ${color}30` }}
            >
              <Icon className="w-2.5 h-2.5" />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-white border border-slate-800">
            {scopeLabel}{exam.part_number ? ` ${exam.part_number}` : ""}
          </span>
        </div>
      </div>

      {/* ── Card body ── */}
      <div className="px-5 py-3 flex-1 flex flex-col gap-2">
        {/* Description */}
        {exam.description ? (
          <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
            <Highlight text={exam.description} query={highlight} />
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic">Đề thi toàn kỹ năng VSTEP chuẩn Bộ GD&ĐT</p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-auto pt-1">
          {exam.duration > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              {exam.duration} phút
            </span>
          )}
          {exam.questions_count > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <FileText className="w-3.5 h-3.5 text-gray-400" />
              {exam.questions_count} câu hỏi
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 text-xs font-semibold" style={{ color: typeColor }}>
            <Trophy className="w-3 h-3" />
            {scopeLabel}
          </span>
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="px-5 pb-5">
        <button
          type="button"
          onClick={handleStartExam}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-bold text-sm text-white transition-all duration-200 group-hover:gap-3"
          style={{
            background: `linear-gradient(135deg, ${typeColor} 0%, ${PURPLE_MID} 100%)`,
            boxShadow: `0 4px 14px ${typeColor}45`,
          }}
        >
          <Play className="w-4 h-4 fill-white" />
          Bắt đầu làm bài
          <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      </div>
      {/* Mobile blocked dialog */}
      {mobileBlocked && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          onClick={() => setMobileBlocked(false)}
        >
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📵</span>
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-2">Không hỗ trợ thiết bị di động</h3>
            <p className="text-sm text-slate-500 mb-5">
              Bài thi VSTEP yêu cầu sử dụng <strong>máy tính (PC / Laptop)</strong> để đảm bảo chất lượng âm thanh và trải nghiệm thi tốt nhất.
            </p>
            <button
              onClick={() => setMobileBlocked(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-700 transition-colors"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
      <PreExamModal
        open={showModal}
        onClose={() => setShowModal(false)}
        exam={exam}
        examPath={examPath}
        typeColor={typeColor}
      />
    </div>
  );
}

// ─── Skeleton Card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-3xl bg-white overflow-hidden animate-pulse" style={{ border: "1.5px solid #F0F0F8" }}>
      <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-50" />
      <div className="p-5 space-y-3">
        <div className="h-3 bg-gray-100 rounded-full w-3/4" />
        <div className="h-3 bg-gray-100 rounded-full w-1/2" />
        <div className="h-10 bg-gray-100 rounded-2xl mt-4" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const RECENT_KEY = 'ebrs'; // exam browser recent searches

export function StudentExamBrowser() {
  const [activeTab, setActiveTab]       = useState<TabType>("ALL");
  const [search, setSearch]             = useState("");
  const [sortBy, setSortBy]             = useState<SortType>("default");
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("all");
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
    catch { return []; }
  });

  // Debounced search — filter only 280ms after user stops typing
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 280);
    return () => clearTimeout(t);
  }, [search]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: '/' or Ctrl+K → focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key === 'k')) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const addRecent = useCallback((q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    setRecentSearches((prev) => {
      const updated = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, 6);
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeRecent = useCallback((q: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((s) => s !== q);
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearAllRecents = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_KEY);
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setSearch('');
      setShowDropdown(false);
      inputRef.current?.blur();
    }
    if (e.key === 'Enter' && search.trim().length >= 2) {
      addRecent(search.trim());
      setShowDropdown(false);
    }
  };

  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["student", "exams-browse", activeTab],
    queryFn: () =>
      studentApi.browseExams(activeTab !== "ALL" ? { type: activeTab } : undefined),
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  // Background-prefetch the other two tabs so switching tabs is instant
  useEffect(() => {
    const tabs: Array<"VSTEP" | "IELTS"> = ["VSTEP", "IELTS"];
    tabs.forEach((tab) => {
      queryClient.prefetchQuery({
        queryKey: ["student", "exams-browse", tab],
        queryFn: () => studentApi.browseExams({ type: tab }),
        staleTime: 5 * 60 * 1000,
      });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const exams: BrowseExam[] = data?.data?.data ?? [];

  const { data: submissionsRes } = useQuery({
    queryKey: ["student", "submissions-all"],
    queryFn: () => studentApi.getSubmissions(),
    staleTime: 5 * 60 * 1000,
  });
  const submissions = submissionsRes?.data?.data?.submissions ?? [];

  const recentAttemptsMap = useMemo(() => {
    const map = new Map<number, number>();
    submissions.forEach((s: any) => {
      const examId = s.exam?.eId;
      if (!examId) return;
      const time = new Date(s.sSubmit_time).getTime();
      const existing = map.get(examId);
      if (!existing || time > existing) {
        map.set(examId, time);
      }
    });
    return map;
  }, [submissions]);

  const filtered = exams
    .filter((e) =>
      debouncedSearch.trim() === "" ||
      e.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (e.description ?? "").toLowerCase().includes(debouncedSearch.toLowerCase())
    )
    .filter((e) => {
      if (durationFilter === "short") return e.duration > 0 && e.duration <= 90;
      if (durationFilter === "long")  return e.duration > 90;
      if (durationFilter === "attempted") return recentAttemptsMap.has(e.id);
      if (durationFilter === "unattempted") return !recentAttemptsMap.has(e.id);
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "title_asc")      return a.title.localeCompare(b.title);
      if (sortBy === "title_desc")     return b.title.localeCompare(a.title);
      if (sortBy === "duration_asc")   return a.duration - b.duration;
      if (sortBy === "duration_desc")  return b.duration - a.duration;
      if (sortBy === "recent_attempt") {
        const timeA = recentAttemptsMap.get(a.id) ?? 0;
        const timeB = recentAttemptsMap.get(b.id) ?? 0;
        if (timeA !== timeB) return timeB - timeA;
        return b.id - a.id;
      }
      return 0;
    });

  const vstepCount = exams.filter((e) => e.type === "VSTEP").length;
  const ieltsCount = exams.filter((e) => e.type === "IELTS").length;

  // ─── Phân trang: 12 đề / trang ───────────────────────────────────────────
  const PAGE_SIZE = 12;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [activeTab, debouncedSearch, sortBy, durationFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const tabs: { key: TabType; label: string; count: number; color: string; bg: string }[] = [
    { key: "ALL",   label: "Tất cả", count: exams.length, color: PURPLE,      bg: PURPLE_LIGHT },
    { key: "VSTEP", label: "VSTEP",  count: vstepCount,   color: VSTEP_COLOR, bg: VSTEP_BG },
    { key: "IELTS", label: "IELTS",  count: ieltsCount,   color: IELTS_COLOR, bg: IELTS_BG },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#F8F7FF" }}>

      {/* ══ Hero Header ══════════════════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, #1E0B4B 0%, #3B1B8F 45%, #1D4ED8 100%)`,
        }}
      >
        {/* Background orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #A78BFA, transparent)", transform: "translateY(-50%)" }} />
          <div className="absolute bottom-0 right-1/4 w-72 h-72 rounded-full opacity-15"
            style={{ background: "radial-gradient(circle, #60A5FA, transparent)", transform: "translateY(40%)" }} />
        </div>

        <div className="relative z-10 px-8 lg:px-16 py-10">
          {/* Title block */}
          <div className="flex items-start gap-4 mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
              style={{ background: "linear-gradient(135deg, #A78BFA, #7C3AED)" }}
            >
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-purple-300 text-sm font-semibold tracking-widest uppercase mb-1">
                Ngân hàng đề thi
              </p>
              <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight">
                Đề thi VSTEP &amp; IELTS
              </h1>
              <p className="text-purple-200 text-sm mt-1 font-medium">
                Đề thi full 4 kỹ năng · Chuẩn định dạng quốc tế · Dành cho học viên người lớn
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { label: "Tổng đề thi",   value: exams.length, color: "#A78BFA" },
              { label: "VSTEP",          value: vstepCount,   color: VSTEP_COLOR },
              { label: "IELTS",          value: ieltsCount,   color: IELTS_COLOR },
            ].map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                <span
                  className="text-xl font-extrabold"
                  style={{ color: s.color }}
                >
                  {isLoading ? "—" : s.value}
                </span>
                <span className="text-xs font-semibold text-purple-200">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ Filter / Search Bar ═══════════════════════════════════════════════════ */}
      <div
        className="sticky top-0 z-20 px-8 lg:px-16 py-3"
        style={{
          background: "rgba(248,247,255,0.92)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid #EDE9FE",
        }}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors duration-200"
              style={{ color: showDropdown || search ? PURPLE : '#9CA3AF' }}
            />
            <input
              ref={inputRef}
              type="text"
              placeholder="Tìm kiếm đề thi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 180)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-10 py-2.5 rounded-xl outline-none text-sm font-medium transition-all duration-200"
              style={{
                paddingRight: search ? 36 : 64,
                background: "#fff",
                border: `1.5px solid ${showDropdown || search ? PURPLE : '#DDD6FE'}`,
                color: "#1A1040",
                boxShadow: showDropdown || search
                  ? `0 0 0 3px ${PURPLE}18, 0 1px 4px rgba(124,58,237,0.06)`
                  : '0 1px 4px rgba(124,58,237,0.06)',
              }}
            />
            {/* Clear button */}
            {search ? (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); setSearch(''); inputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full transition-all duration-150 hover:scale-110"
                style={{ background: '#E5E7EB' }}
              >
                <X className="w-3 h-3 text-gray-500" />
              </button>
            ) : (
              /* Keyboard shortcut hint */
              <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none select-none">
                <kbd className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#F3F4F6', color: '#9CA3AF', border: '1px solid #E5E7EB', fontFamily: 'monospace' }}>
                  /
                </kbd>
              </span>
            )}

            {/* Recent searches dropdown */}
            {showDropdown && !search && recentSearches.length > 0 && (
              <div
                className="absolute top-full left-0 right-0 mt-1.5 rounded-xl overflow-hidden z-50"
                style={{ background: '#fff', border: '1.5px solid #DDD6FE', boxShadow: '0 8px 24px rgba(124,58,237,0.12)' }}
              >
                <div className="flex items-center justify-between px-3.5 pt-2.5 pb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Tìm kiếm gần đây
                  </span>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); clearAllRecents(); }}
                    className="text-[10px] font-semibold text-slate-400 hover:text-red-400 transition-colors"
                  >
                    Xóa tất cả
                  </button>
                </div>
                {recentSearches.map((q) => (
                  <div
                    key={q}
                    className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-purple-50 cursor-pointer transition-colors group"
                    onMouseDown={(e) => { e.preventDefault(); setSearch(q); addRecent(q); setShowDropdown(false); }}
                  >
                    <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#C4B5FD' }} />
                    <span className="flex-1 text-sm text-slate-700 font-medium truncate">{q}</span>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); removeRecent(q); }}
                      className="w-5 h-5 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-slate-200"
                    >
                      <X className="w-3 h-3 text-slate-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tab switcher */}
          <div
            className="flex items-center gap-1 p-1 rounded-xl flex-shrink-0"
            style={{ background: "#fff", border: "1.5px solid #DDD6FE" }}
          >
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 active:scale-95 ${
                    active ? "" : "hover:bg-purple-50 hover:text-purple-600"
                  }`}
                  style={{
                    background: active ? tab.color : "transparent",
                    color: active ? "#fff" : "#6B7280",
                    boxShadow: active ? `0 2px 10px ${tab.color}50` : "none",
                  }}
                >
                  {tab.label}
                  {!isLoading && tab.count > 0 && (
                    <span
                      className="text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 font-bold"
                      style={{
                        background: active ? "rgba(255,255,255,0.22)" : tab.bg,
                        color: active ? "#fff" : tab.color,
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Duration & Attempt filter */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            {([
              { key: "all",   label: "Tất cả" },
              { key: "short", label: "≤ 90 phút" },
              { key: "long",  label: "> 90 phút" },
              { key: "attempted", label: "Đã làm" },
              { key: "unattempted", label: "Chưa làm" },
            ] as { key: DurationFilter; label: string }[]).map((d) => (
              <button
                key={d.key}
                onClick={() => setDurationFilter(d.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-95 ${
                  durationFilter === d.key
                    ? "text-white shadow-sm"
                    : "bg-white text-gray-500 border-purple-200 hover:border-purple-400 hover:text-purple-600 hover:-translate-y-0.5 hover:shadow-sm"
                }`}
                style={durationFilter === d.key ? {
                  background: PURPLE,
                  borderColor: PURPLE,
                } : undefined}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortType)}
              className="pl-2 pr-6 py-1.5 rounded-lg text-xs font-semibold outline-none appearance-none cursor-pointer transition-all border border-purple-200 hover:border-purple-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95"
              style={{
                background: "#fff",
                color: sortBy !== "default" ? PURPLE : "#6B7280",
              }}
            >
              <option value="default">Mặc định</option>
              <option value="recent_attempt">Vừa làm (Gần nhất)</option>
              <option value="title_asc">Tên A → Z</option>
              <option value="title_desc">Tên Z → A</option>
              <option value="duration_asc">Thời gian ↑</option>
              <option value="duration_desc">Thời gian ↓</option>
            </select>
          </div>
        </div>
      </div>

      {/* ══ Content ═══════════════════════════════════════════════════════════════ */}
      <div className="px-8 lg:px-16 py-8">
        {/* Results meta */}
        {!isLoading && !isError && filtered.length > 0 && (
          <p className="text-sm text-gray-500 mb-6">
            Hiển thị{" "}
            <span className="font-bold" style={{ color: PURPLE }}>
              {filtered.length}
            </span>{" "}
            đề thi {activeTab !== "ALL" && <span className="font-semibold">{activeTab}</span>}
          </p>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : isError ? (
          <div
            className="flex flex-col items-center justify-center py-24 gap-4 rounded-3xl"
            style={{ background: "#FEF2F2", border: "1.5px solid #FECACA" }}
          >
            <AlertCircle className="w-12 h-12 text-red-400" />
            <p className="font-bold text-red-600 text-lg">Không thể tải danh sách đề thi</p>
            <p className="text-sm text-red-400">Vui lòng kiểm tra kết nối và thử lại.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ background: PURPLE_LIGHT }}
            >
              <FileText className="w-10 h-10" style={{ color: PURPLE }} />
            </div>
            <p className="font-bold text-gray-700 text-lg">
              {search ? "Không tìm thấy đề thi phù hợp" : "Chưa có đề thi nào"}
            </p>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_MID})` }}
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {paged.map((exam, idx) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                idx={(pageSafe - 1) * PAGE_SIZE + idx}
                highlight={debouncedSearch}
                recentAttemptTime={recentAttemptsMap.get(exam.id)}
              />
            ))}
          </div>
        )}

        {/* ── Phân trang ── */}
        {!isLoading && !isError && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-1.5 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pageSafe <= 1}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              ← Trước
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className="min-w-[38px] h-[38px] rounded-lg text-sm font-bold transition-colors"
                style={p === pageSafe
                  ? { background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_MID})`, color: "#fff" }
                  : { background: "#fff", border: "1px solid #E2E8F0", color: "#475569" }}>
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={pageSafe >= totalPages}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Sau →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

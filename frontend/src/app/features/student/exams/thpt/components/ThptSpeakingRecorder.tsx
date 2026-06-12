/**
 * ThptSpeakingRecorder — ghi âm câu trả lời Nói trong đề THPT/tổng hợp.
 * Upload audio qua studentApi.uploadSpeakingAudio (lưu vào sGemini_feedback.speaking_audio
 * theo question_number); AI chấm chạy nền sau khi nộp.
 */
import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Clock, Loader2, CheckCircle2 } from 'lucide-react';
import { studentApi } from '../../../../../../services/studentApi';

const TEAL = '#0D9488';
const TEAL_DARK = '#0F766E';

interface Props {
  submissionId: number | null;
  questionNumber: number;
  prompt: string;
  prepSeconds: number;
  speakSeconds: number;
  recorded: boolean;
  onRecorded: () => void;
  /** Khoá khi đề khác đang được ghi âm — mỗi lần chỉ làm 1 đề. */
  disabled?: boolean;
  /** Báo cho cha biết đề này đang bận (prep/recording/uploading) hay không. */
  onActiveChange?: (busy: boolean) => void;
}

export function ThptSpeakingRecorder({ submissionId, questionNumber, prompt, prepSeconds, speakSeconds, recorded, onRecorded, disabled, onActiveChange }: Props) {
  type Phase = 'idle' | 'prep' | 'recording' | 'uploading' | 'done';
  const [phase, setPhase] = useState<Phase>(recorded ? 'done' : 'idle');
  const [left, setLeft] = useState(prepSeconds || speakSeconds);
  const [denied, setDenied] = useState(false);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  // Báo trạng thái bận cho phần cha (để khoá các đề còn lại — 1 lần làm 1 đề).
  useEffect(() => {
    onActiveChange?.(phase === 'prep' || phase === 'recording' || phase === 'uploading');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (mrRef.current?.state === 'recording') mrRef.current.stop();
  }, []);

  // Đếm ngược an toàn: KHÔNG gọi done() bên trong updater của setLeft (tránh
  // race khiến thời gian nói bị nhảy về 0 → ghi âm dừng ngay khi vừa bắt đầu).
  const countdown = (secs: number, done: () => void) => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    let remaining = Math.max(1, Math.round(secs));
    setLeft(remaining);
    timerRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        setLeft(0);
        done();
      } else {
        setLeft(remaining);
      }
    }, 1000);
  };

  const begin = (stream: MediaStream) => {
    chunksRef.current = [];
    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      setPhase('uploading');
      try {
        if (submissionId) await studentApi.uploadSpeakingAudio(submissionId, questionNumber, blob);
        setPhase('done');
        onRecorded();
      } catch { setPhase('idle'); }
    };
    mrRef.current = mr;
    mr.start();
    setPhase('recording');
    countdown(speakSeconds, stop);
  };

  const stop = () => { if (timerRef.current) window.clearInterval(timerRef.current); if (mrRef.current?.state === 'recording') mrRef.current.stop(); };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      if (prepSeconds > 0) { setPhase('prep'); countdown(prepSeconds, () => begin(stream)); }
      else begin(stream);
    } catch { setDenied(true); }
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-teal-50 text-teal-700 ring-1 ring-teal-100 flex-shrink-0">
          <Mic className="w-[18px] h-[18px]" />
        </div>
        <p className="flex-1 text-[15px] font-medium text-slate-800 leading-relaxed">{prompt}</p>
      </div>

      {phase === 'done' ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-emerald-800">Đã ghi âm xong. Bài nói sẽ được AI chấm sau khi nộp.</p>
        </div>
      ) : (
        <>
          {denied && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
              <strong>Không truy cập được micro.</strong> Hãy cấp quyền và tải lại trang.
            </div>
          )}
          {phase === 'idle' && !denied && (
            <button onClick={start} disabled={disabled}
              className={`w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors ${
                disabled
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'text-white active:scale-[0.99] cursor-pointer'
              }`}
              style={disabled ? undefined : { background: TEAL }}
              onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = TEAL_DARK; }}
              onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = TEAL; }}>
              <Mic className="w-4 h-4" />
              {disabled
                ? 'Hoàn thành đề đang làm trước đã'
                : prepSeconds > 0 ? `Chuẩn bị ${prepSeconds}s rồi ghi âm` : 'Bắt đầu ghi âm'}
            </button>
          )}
          {(phase === 'prep' || phase === 'recording') && (
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-3">
              <div className="flex items-center justify-center gap-3">
                {phase === 'recording'
                  ? <span className="relative flex w-3 h-3"><span className="animate-ping absolute inline-flex w-full h-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full w-3 h-3 bg-red-500" /></span>
                  : <Clock className="w-5 h-5 text-amber-500" />}
                <span className={`text-3xl font-extrabold tabular-nums ${phase === 'recording' ? 'text-red-600' : 'text-amber-600'}`}>{fmt(left)}</span>
              </div>
              <p className="text-center text-xs text-slate-500">
                {phase === 'prep' ? 'Đang chuẩn bị — ghi âm sẽ tự bắt đầu khi hết giờ.' : 'Nói tự nhiên — sẽ tự dừng khi hết giờ.'}
              </p>
              {phase === 'recording' && (
                <button onClick={stop} className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors active:scale-[0.99]">
                  <Square className="w-3.5 h-3.5 fill-current" /> Dừng sớm
                </button>
              )}
            </div>
          )}
          {phase === 'uploading' && (
            <div className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang tải bài ghi âm lên…
            </div>
          )}
        </>
      )}
    </div>
  );
}

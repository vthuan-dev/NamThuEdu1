/**
 * ThptSpeakingRecorder — ghi âm câu trả lời Nói trong đề THPT/tổng hợp.
 * Upload audio qua studentApi.uploadSpeakingAudio (lưu vào sGemini_feedback.speaking_audio
 * theo question_number); AI chấm chạy nền sau khi nộp.
 */
import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Clock, Loader2, CheckCircle2 } from 'lucide-react';
import { studentApi } from '../../../../../../services/studentApi';

const BLUE = '#2563EB';

interface Props {
  submissionId: number | null;
  questionNumber: number;
  prompt: string;
  prepSeconds: number;
  speakSeconds: number;
  recorded: boolean;
  onRecorded: () => void;
}

export function ThptSpeakingRecorder({ submissionId, questionNumber, prompt, prepSeconds, speakSeconds, recorded, onRecorded }: Props) {
  type Phase = 'idle' | 'prep' | 'recording' | 'uploading' | 'done';
  const [phase, setPhase] = useState<Phase>(recorded ? 'done' : 'idle');
  const [left, setLeft] = useState(prepSeconds || speakSeconds);
  const [denied, setDenied] = useState(false);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (mrRef.current?.state === 'recording') mrRef.current.stop();
  }, []);

  const countdown = (secs: number, done: () => void) => {
    setLeft(secs);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setLeft((s) => { if (s <= 1) { if (timerRef.current) window.clearInterval(timerRef.current); done(); return 0; } return s - 1; });
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
    <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3">
      <p className="text-sm font-medium text-slate-800 leading-relaxed">{prompt}</p>

      {phase === 'done' ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <p className="text-sm font-semibold text-emerald-800">Đã ghi âm xong. Bài nói sẽ được AI chấm sau khi nộp.</p>
        </div>
      ) : (
        <>
          {denied && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              <strong>Không truy cập được micro.</strong> Hãy cấp quyền và tải lại trang.
            </div>
          )}
          {phase === 'idle' && !denied && (
            <button onClick={start}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm transition-transform hover:scale-[1.01] active:scale-95"
              style={{ background: BLUE }}>
              <Mic className="w-4 h-4" /> {prepSeconds > 0 ? `Chuẩn bị ${prepSeconds}s rồi ghi âm` : 'Bắt đầu ghi âm'}
            </button>
          )}
          {(phase === 'prep' || phase === 'recording') && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-3 py-2">
                <Clock className={`w-5 h-5 ${phase === 'recording' ? 'text-red-600' : 'text-amber-600'}`} />
                <span className={`text-3xl font-black tabular-nums ${phase === 'recording' ? 'text-red-600' : 'text-amber-600'}`}>{fmt(left)}</span>
              </div>
              <p className="text-center text-xs text-slate-500">
                {phase === 'prep' ? 'Đang chuẩn bị — ghi âm sẽ tự bắt đầu khi hết giờ.' : 'Nói tự nhiên — sẽ tự dừng khi hết giờ.'}
              </p>
              {phase === 'recording' && (
                <button onClick={stop} className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold">
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

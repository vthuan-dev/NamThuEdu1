/**
 * KidsExamLobby — Phòng chờ thân thiện cho trẻ 6-12 (Cambridge YL)
 *
 * Khác bản người lớn (ExamLobby): KHÔNG check camera/mic/loa, không proctoring.
 * Chỉ hiện thông tin bài thi vui vẻ + nút "Bắt đầu" to, rõ. Bấm là vào làm bài.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Clock, ListChecks, Loader2, Sparkles, Play } from 'lucide-react';
import { studentApi } from '../../../../services/studentApi';

const BASE = '/hoc-vien';

type LobbyInfo = { title: string; durationMinutes: number | null; totalQuestions: number | null };

export function KidsExamLobby() {
  const { id } = useParams<{ id: string }>();
  const assignmentId = Number(id ?? 0);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState<LobbyInfo>({ title: 'Bài thi của bạn', durationMinutes: null, totalQuestions: null });

  useEffect(() => {
    if (!assignmentId) { setLoading(false); return; }
    let alive = true;
    (async () => {
      try {
        const res: any = await studentApi.getTestDetail(assignmentId);
        const data = res?.data?.data;
        const assignment = data?.assignment ?? data;
        const exam = assignment?.exam ?? data?.exam;
        if (!alive) return;
        setInfo({
          title: String(exam?.eTitle ?? assignment?.exam_title ?? data?.exam_title ?? 'Bài thi của bạn'),
          durationMinutes: Number(exam?.eDuration_minutes ?? assignment?.exam_duration ?? data?.exam_duration ?? 0) || null,
          totalQuestions: Number(exam?.questions?.length ?? assignment?.total_questions ?? data?.total_questions ?? 0) || null,
        });
      } catch {
        if (alive) setError('Không tải được bài thi. Bạn thử lại nhé!');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [assignmentId]);

  const handleStart = async () => {
    if (!assignmentId || starting) return;
    try {
      setStarting(true);
      setError('');
      const startRes: any = await studentApi.startTest(assignmentId);
      const sid = Number(startRes?.data?.data?.submissionId ?? 0);
      if (!sid) throw new Error('missing-submission-id');
      try { await studentApi.connectTestWebsocket(sid); }
      catch { try { await studentApi.reconnectTestWebsocket(sid); } catch { /* non-fatal */ } }
      navigate(`${BASE}/lam-bai/${assignmentId}?autostart=1&submissionId=${sid}`);
    } catch {
      setError('Chưa bắt đầu được. Bạn thử lại sau một chút nhé!');
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #FFF1F2 0%, #FFF7ED 50%, #F0FDF4 100%)' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-10">
        <button
          onClick={() => navigate(`${BASE}/bai-tap`)}
          className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-rose-600 hover:bg-white transition-colors"
          style={{ boxShadow: '0 4px 14px rgba(244,63,94,0.12)' }}
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại
        </button>

        <section className="relative overflow-hidden rounded-3xl p-6 sm:p-9 text-center"
          style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF7ED 100%)', boxShadow: '0 12px 40px rgba(251,113,133,0.16)', border: '2px solid rgba(255,255,255,0.9)' }}>
          <div className="absolute -top-12 -right-8 w-44 h-44 rounded-full opacity-40 pointer-events-none" style={{ background: 'radial-gradient(circle, #FED7AA, transparent)' }} />
          <div className="absolute -bottom-14 -left-8 w-44 h-44 rounded-full opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle, #FECDD3, transparent)' }} />

          <div className="relative z-10">
            <div className="text-6xl mb-3 animate-bounce">🎯</div>
            <p className="text-xs font-extrabold text-rose-400 uppercase tracking-widest">Sẵn sàng làm bài</p>

            {loading ? (
              <div className="py-10 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-rose-400" />
                <p className="text-sm font-bold text-rose-500">Đang chuẩn bị bài thi…</p>
              </div>
            ) : (
              <>
                <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold leading-tight" style={{ color: '#9F1239' }}>
                  {info.title}
                </h1>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                  {info.totalQuestions != null && (
                    <span className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold"
                      style={{ background: 'linear-gradient(135deg,#EFF6FF,#BFDBFE)', color: '#2563EB', border: '2px solid rgba(255,255,255,0.85)' }}>
                      <ListChecks className="w-4 h-4" /> {info.totalQuestions} câu
                    </span>
                  )}
                  {info.durationMinutes != null && (
                    <span className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold"
                      style={{ background: 'linear-gradient(135deg,#F0FFF4,#BBF7D0)', color: '#059669', border: '2px solid rgba(255,255,255,0.85)' }}>
                      <Clock className="w-4 h-4" /> {info.durationMinutes} phút
                    </span>
                  )}
                </div>

                <div className="mt-6 rounded-2xl px-5 py-4 text-left mx-auto max-w-md"
                  style={{ background: 'rgba(251,146,60,0.10)', border: '1.5px solid rgba(251,146,60,0.22)' }}>
                  <p className="flex items-center gap-2 text-sm font-bold text-orange-700">
                    <Sparkles className="w-4 h-4 flex-shrink-0" /> Mẹo nhỏ cho bạn
                  </p>
                  <p className="text-xs sm:text-sm text-orange-700/80 mt-1 leading-relaxed font-medium">
                    Đọc kỹ từng câu, chọn đáp án bạn nghĩ là đúng. Không sao nếu chưa chắc —
                    cứ cố gắng hết sức nhé! 💪
                  </p>
                </div>

                {error && (
                  <p className="mt-4 text-sm font-bold text-red-500">{error}</p>
                )}

                <button
                  onClick={handleStart}
                  disabled={starting}
                  className="mt-7 w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-10 py-4 rounded-2xl text-white text-lg font-extrabold transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
                  style={{ background: 'linear-gradient(135deg, #FB7185 0%, #F97316 100%)', boxShadow: '0 10px 28px rgba(251,113,133,0.4)' }}
                >
                  {starting
                    ? (<><Loader2 className="w-5 h-5 animate-spin" /> Đang vào…</>)
                    : (<><Play className="w-5 h-5 fill-white" /> Bắt đầu làm bài</>)}
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

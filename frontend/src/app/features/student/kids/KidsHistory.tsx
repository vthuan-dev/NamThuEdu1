/**
 * KidsHistory — Lịch sử làm bài (Cambridge YL)
 *
 * Định hướng thiết kế (senior, không "AI-gen"):
 * - KHÔNG dùng emoji, KHÔNG icon thư viện (lucide), KHÔNG gradient cầu vồng.
 * - Bảng màu kỷ luật: nền stone ấm + 1 accent rose duy nhất; điểm số mã hoá
 *   bằng vòng tròn tiến độ SVG tự vẽ (bespoke), nhãn bằng chữ.
 * - Meta dạng typographic, phân tách bằng dấu chấm giữa (·).
 * - Hiệu ứng vào trang fade-up so le, easing tuỳ chỉnh.
 * Dữ liệu: studentApi.getSubmissions (lịch sử nộp bài thật).
 */
import { useMemo } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { studentApi, type Submission } from '../../../../services/studentApi';
import { usePageTitle } from '../../../../hooks/usePageTitle';

const BASE = '/hoc-vien';
const ACCENT = '#E11D48'; // rose-600 — accent duy nhất

// Ẩn bài người lớn (kids chỉ thấy Cambridge YL)
function isAdultExam(s: Submission): boolean {
  const t = (String(s.exam?.eType ?? '') + ' ' + String(s.exam?.eTitle ?? '')).toLowerCase();
  return t.includes('vstep') || t.includes('ielts') || t.includes('toeic');
}

function isGraded(s: Submission): boolean {
  const st = String(s.sStatus ?? '').toLowerCase();
  return !!s.sGraded_time || st === 'graded' || st === 'completed';
}

// Mã hoá thành tích bằng tông màu trầm (muted), nhãn bằng chữ — không emoji.
function band(accuracy: number): { label: string; c: string } {
  if (accuracy >= 90) return { label: 'Xuất sắc', c: '#047857' };       // emerald-700
  if (accuracy >= 75) return { label: 'Tốt lắm', c: ACCENT };           // rose (brand)
  if (accuracy >= 50) return { label: 'Khá', c: '#B45309' };            // amber-700
  return { label: 'Cần luyện thêm', c: '#78716C' };                     // stone-500
}

function fmtDate(s: string): string {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Vòng tròn điểm tự vẽ — thay cho huy hiệu emoji. */
function ScoreRing({ value, color, pending }: { value: number; color: string; pending?: boolean }) {
  const r = 21;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.max(0, Math.min(100, value)) / 100) * circ;
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" className="flex-shrink-0" aria-hidden>
      <circle cx="29" cy="29" r={r} fill="none" stroke="#EFEDEA" strokeWidth="4.5" />
      {!pending && (
        <circle
          cx="29" cy="29" r={r} fill="none" stroke={color} strokeWidth="4.5"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 29 29)"
        />
      )}
      <text
        x="29" y="30" textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: pending ? 18 : 15, fontWeight: 800, fill: pending ? '#A8A29E' : '#1C1917' }}
      >
        {pending ? '·' : value}
      </text>
    </svg>
  );
}

export function KidsHistory() {
  usePageTitle('Lịch sử của em');

  const { data, isLoading } = useQuery({
    queryKey: ['student', 'submissions', 'kids-history'],
    queryFn: () => studentApi.getSubmissions({ sort: 'recent' }),
  });

  const subs = useMemo(() => {
    // Backend trả về Laravel paginator → mảng nằm ở data.data.data (không phải .submissions)
    const rawData = (data as any)?.data?.data;
    const list: Submission[] = Array.isArray(rawData)
      ? rawData
      : (rawData?.data ?? rawData?.submissions ?? []);
    return (list ?? []).filter(s => !isAdultExam(s));
  }, [data]);

  const stats = useMemo(() => {
    const graded = subs.filter(isGraded);
    const avg = graded.length
      ? Math.round(graded.reduce((sum, s) => sum + (s.stats?.accuracy ?? 0), 0) / graded.length)
      : 0;
    const best = graded.reduce((m, s) => Math.max(m, s.stats?.accuracy ?? 0), 0);
    return { done: subs.length, avg, best };
  }, [subs]);

  return (
    <div className="min-h-[100dvh]" style={{ background: '#FAFAF9' }}>
      {/* Keyframes cục bộ cho hiệu ứng vào trang */}
      <style>{`
        @keyframes kidsHistoryRise {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .kh-rise { animation: kidsHistoryRise 640ms cubic-bezier(0.22,0.61,0.36,1) both; }
      `}</style>

      <div className="max-w-3xl mx-auto px-5 sm:px-6 pt-10 sm:pt-14 pb-16">

        {/* ─── Header (editorial, không icon) ─────────────────── */}
        <header className="kh-rise mb-8 sm:mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
            Hồ sơ học tập
          </p>
          <h1 className="mt-2 text-3xl sm:text-[2.5rem] font-extrabold tracking-tight leading-none text-stone-900">
            Lịch sử của em
          </h1>
          <p className="mt-3 text-[15px] text-stone-500 leading-relaxed">
            Tất cả bài em đã làm, kèm điểm và thành tích — chạm vào để xem lại.
          </p>
        </header>

        {/* ─── Summary (typographic, hairline dividers) ───────── */}
        {!isLoading && stats.done > 0 && (
          <div
            className="kh-rise mb-9 grid grid-cols-3 rounded-2xl bg-white"
            style={{ boxShadow: '0 1px 2px rgba(28,25,23,0.04), 0 12px 32px -16px rgba(28,25,23,0.12)', animationDelay: '60ms' }}
          >
            {[
              { label: 'Bài đã làm', value: String(stats.done) },
              { label: 'Điểm trung bình', value: `${stats.avg}%` },
              { label: 'Cao nhất', value: `${stats.best}%` },
            ].map((s, i) => (
              <div
                key={s.label}
                className="px-5 py-5 text-center"
                style={i > 0 ? { borderLeft: '1px solid #F0EEEC' } : undefined}
              >
                <p className="text-2xl sm:text-[1.75rem] font-extrabold tracking-tight text-stone-900 leading-none">
                  {s.value}
                </p>
                <p className="mt-2 text-[12px] font-medium text-stone-500">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ─── List ───────────────────────────────────────────── */}
        {isLoading ? (
          <div className="space-y-3.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-[92px] rounded-2xl bg-white animate-pulse"
                style={{ boxShadow: '0 12px 32px -20px rgba(28,25,23,0.18)' }} />
            ))}
          </div>
        ) : subs.length === 0 ? (
          <div className="kh-rise flex flex-col items-center text-center rounded-3xl bg-white px-8 py-16"
            style={{ boxShadow: '0 1px 2px rgba(28,25,23,0.04), 0 24px 60px -30px rgba(28,25,23,0.18)' }}>
            {/* Minh hoạ line-art tự vẽ thay cho emoji */}
            <svg width="92" height="92" viewBox="0 0 92 92" fill="none" aria-hidden className="mb-6">
              <rect x="20" y="30" width="44" height="54" rx="8" stroke="#E7E5E4" strokeWidth="2.5" transform="rotate(-7 42 57)" />
              <rect x="28" y="22" width="44" height="54" rx="8" fill="#FFFFFF" stroke="#D6D3D1" strokeWidth="2.5" />
              <line x1="37" y1="38" x2="63" y2="38" stroke="#E7E5E4" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="37" y1="48" x2="58" y2="48" stroke="#E7E5E4" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="62" cy="60" r="11" fill="none" stroke={ACCENT} strokeWidth="2.5" />
              <path d="M62 55 v6 l4 3" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h3 className="text-lg font-extrabold text-stone-900">Chưa có bài nào trong lịch sử</h3>
            <p className="mt-2 max-w-sm text-[14px] text-stone-500 leading-relaxed">
              Khi em hoàn thành bài thầy cô giao, kết quả sẽ được lưu lại tại đây.
            </p>
            <Link
              to={`${BASE}/bai-tap`}
              className="group mt-7 inline-flex items-center gap-3 rounded-full pl-6 pr-2 py-2 text-[14px] font-semibold text-white transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
              style={{ background: ACCENT }}
            >
              Xem bài thi của em
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/15 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
                  <path d="M3 7.5h8M7.5 4l3.5 3.5L7.5 11" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>
          </div>
        ) : (
          <div className="space-y-3.5">
            {subs.map((s, idx) => {
              const graded = isGraded(s);
              const accuracy = s.stats?.accuracy ?? 0;
              const b = band(accuracy);
              const meta = [
                fmtDate(s.sSubmit_time),
                s.sTime_taken > 0 ? `${Math.round(s.sTime_taken / 60)} phút` : null,
                s.exam?.eSkill ? String(s.exam.eSkill) : null,
              ].filter(Boolean) as string[];

              return (
                <Link
                  key={s.sId}
                  to={`${BASE}/ket-qua/${s.sId}`}
                  className="kh-rise group flex items-center gap-4 sm:gap-5 rounded-2xl bg-white px-4 sm:px-5 py-4 transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5"
                  style={{
                    boxShadow: '0 1px 2px rgba(28,25,23,0.04), 0 14px 34px -22px rgba(28,25,23,0.16)',
                    animationDelay: `${Math.min(idx, 8) * 55}ms`,
                  }}
                >
                  <ScoreRing value={accuracy} color={b.c} pending={!graded} />

                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] sm:text-base font-bold text-stone-900 truncate">
                      {s.exam?.eTitle ?? 'Bài thi'}
                    </h3>
                    <p className="mt-1 text-[12.5px] text-stone-500 truncate">
                      {meta.map((m, i) => (
                        <span key={i}>
                          {i > 0 && <span className="mx-1.5 text-stone-300">·</span>}
                          <span className={i === 2 ? 'capitalize' : undefined}>{m}</span>
                        </span>
                      ))}
                    </p>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    {graded ? (
                      <span className="text-[13px] font-semibold" style={{ color: b.c }}>{b.label}</span>
                    ) : (
                      <span className="text-[12.5px] font-medium text-stone-400">Đang chấm</span>
                    )}
                  </div>

                  {/* Mũi tên tự vẽ — gợi ý điều hướng */}
                  <svg
                    width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden
                    className="flex-shrink-0 text-stone-300 transition-[transform,color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:text-stone-500"
                  >
                    <path d="M5.5 3.5L10 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

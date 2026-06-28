/**
 * KidsHistory — Lịch sử bài thi của em (Cambridge YL)
 *
 * Phong cách "kids" đồng bộ với KidsTests:
 *  - Nền gradient rose → orange → green dịu mắt
 *  - Hero card lớn có nhân vật ngộ nghĩnh tổng kết thành tích
 *  - 3 thẻ thống kê đầy màu (số bài / TB / cao nhất) với icon gradient
 *  - Bộ lọc nhanh dạng pill: tất cả / xuất sắc / cần luyện thêm / đang chấm
 *  - Card lịch sử có huy hiệu sao theo điểm, hiệu ứng hover nhẹ
 *  - Empty state đáng yêu (line-art tự vẽ + CTA)
 *
 * Dữ liệu: studentApi.getSubmissions (lịch sử nộp bài thật).
 * Backend trả Laravel paginator → list nằm ở data.data.data.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  History, Trophy, Target, ListChecks, Clock, Calendar,
  Sparkles, Star, RotateCcw, BookOpenCheck, ChevronRight, Hourglass,
} from 'lucide-react';
import { studentApi, type Submission } from '../../../../services/studentApi';
import { usePageTitle } from '../../../../hooks/usePageTitle';

const BASE = '/hoc-vien';

type Filter = 'all' | 'excellent' | 'practice' | 'pending';

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Ẩn bài người lớn (kids chỉ thấy Cambridge YL). */
function isAdultExam(s: Submission): boolean {
  const t = (String(s.exam?.eType ?? '') + ' ' + String(s.exam?.eTitle ?? '')).toLowerCase();
  return t.includes('vstep') || t.includes('ielts') || t.includes('toeic');
}

function isGraded(s: Submission): boolean {
  const st = String(s.sStatus ?? '').toLowerCase();
  return !!s.sGraded_time || st === 'graded' || st === 'completed';
}

/** Phân loại thành tích theo % accuracy → label + màu + emoji + số sao. */
function band(accuracy: number): {
  label: string; bg: string; soft: string; emoji: string; stars: number;
} {
  if (accuracy >= 90) return { label: 'Xuất sắc',      bg: '#10B981', soft: '#D1FAE5', emoji: '🏆', stars: 3 };
  if (accuracy >= 75) return { label: 'Giỏi',          bg: '#F59E0B', soft: '#FEF3C7', emoji: '⭐', stars: 2 };
  if (accuracy >= 50) return { label: 'Khá',           bg: '#FB7185', soft: '#FFE4E6', emoji: '👍', stars: 1 };
  return                   { label: 'Cần luyện thêm', bg: '#94A3B8', soft: '#F1F5F9', emoji: '💪', stars: 0 };
}

function fmtDate(s: string): string {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Score donut: vòng tròn điểm tươi sáng ─────────────────────────────────
function ScoreDonut({ value, color, pending }: { value: number; color: string; pending?: boolean }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const offset = circ - (v / 100) * circ;
  return (
    <div className="relative flex-shrink-0">
      <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden>
        <defs>
          <linearGradient id={`donut-${color.replace('#', '')}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.85" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx="34" cy="34" r={r} fill="#fff" stroke="#FFE4E6" strokeWidth="5" />
        {!pending && (
          <circle
            cx="34" cy="34" r={r} fill="none"
            stroke={`url(#donut-${color.replace('#', '')})`}
            strokeWidth="5" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            transform="rotate(-90 34 34)"
            style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.22,0.61,0.36,1)' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        {pending ? (
          <Hourglass className="w-5 h-5 text-slate-400" />
        ) : (
          <>
            <span className="text-base font-extrabold text-slate-900">{v}</span>
            <span className="text-[9px] font-bold text-slate-400 mt-0.5">điểm</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Hàng sao thành tích ───────────────────────────────────────────────────
function StarRow({ count }: { count: number }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[0, 1, 2].map(i => (
        <Star
          key={i} className="w-3 h-3"
          style={{
            color: i < count ? '#F59E0B' : '#E5E7EB',
            fill:  i < count ? '#F59E0B' : 'transparent',
          }}
        />
      ))}
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, suffix, gradient,
}: {
  icon: React.ReactNode; label: string; value: string | number;
  suffix?: string; gradient: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-3xl border-2 border-rose-100 p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md"
        style={{ background: gradient }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-extrabold text-slate-900 leading-none">{value}</span>
          {suffix && <span className="text-sm font-bold text-slate-400">{suffix}</span>}
        </div>
        <p className="text-xs font-semibold text-slate-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

// ─── Filter pill ───────────────────────────────────────────────────────────
function FilterPill({
  active, onClick, children, count, activeStyle,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
  count?: number; activeStyle: { bg: string; shadow: string };
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-extrabold transition-all whitespace-nowrap"
      style={active
        ? { background: activeStyle.bg, color: '#fff', boxShadow: activeStyle.shadow }
        : { background: '#fff', color: '#64748B', border: '2px solid #FFE4E6' }}
    >
      {children}
      {typeof count === 'number' && (
        <span
          className="text-[11px] rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 font-extrabold"
          style={active ? { background: 'rgba(255,255,255,0.25)' } : { background: '#FFE4E6', color: '#E11D48' }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export function KidsHistory() {
  usePageTitle('Lịch sử của bạn');
  const [filter, setFilter] = useState<Filter>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['student', 'submissions', 'kids-history'],
    // Backend (StudentTestController::submissions) chỉ nhận: per_page, status,
    // exam_id, from_date, to_date, sort_by, sort_order. Mặc định đã sort
    // theo sSubmit_time desc nên không cần truyền tham số ở đây.
    queryFn: () => studentApi.getSubmissions(),
  });

  const subs = useMemo(() => {
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
    const excellent = graded.filter(s => (s.stats?.accuracy ?? 0) >= 90).length;
    const practice  = graded.filter(s => (s.stats?.accuracy ?? 0) < 50).length;
    const pendingCount = subs.length - graded.length;
    return { done: subs.length, avg, best, excellent, practice, pendingCount };
  }, [subs]);

  const visible = useMemo(() => {
    return subs.filter(s => {
      const graded = isGraded(s);
      const acc = s.stats?.accuracy ?? 0;
      if (filter === 'excellent') return graded && acc >= 90;
      if (filter === 'practice')  return graded && acc < 50;
      if (filter === 'pending')   return !graded;
      return true;
    });
  }, [subs, filter]);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #FFF1F2 0%, #FFF7ED 45%, #F0FDF4 100%)' }}>
      <style>{`
        @keyframes kidsHistRise {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .kh-rise { animation: kidsHistRise 540ms cubic-bezier(0.22,0.61,0.36,1) both; }
        @keyframes kidsHistBob {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-6px); }
        }
      `}</style>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-10 space-y-5">

        {/* ─── Header ──────────────────────────────────────────── */}
        <header className="kh-rise flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md"
            style={{ background: 'linear-gradient(135deg, #FB7185, #F97316)' }}
          >
            <History className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">
              Lịch sử của bạn 📚
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Tất cả những bài bạn đã thi — chạm vào để xem lại nhé!
            </p>
          </div>
        </header>

        {/* ─── Hero kèm số liệu nhanh khi có bài ─────────────── */}
        {!isLoading && stats.done > 0 && (
          <div
            className="kh-rise relative overflow-hidden rounded-3xl p-5 sm:p-6"
            style={{
              background: 'linear-gradient(135deg, #FB7185 0%, #F97316 100%)',
              boxShadow: '0 12px 32px -12px rgba(251,113,133,0.45)',
              animationDelay: '60ms',
            }}
          >
            {/* trang trí */}
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
            <div className="absolute top-3 right-4" style={{ animation: 'kidsHistBob 3s ease-in-out infinite' }}>
              <Sparkles className="w-6 h-6 text-yellow-200" />
            </div>

            <div className="relative flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0"
                style={{ animation: 'kidsHistBob 3s ease-in-out infinite' }}>
                <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-200" fill="#FCD34D" />
              </div>
              <div className="text-white">
                <p className="text-xs sm:text-sm font-bold text-white opacity-90">Bạn đã hoàn thành</p>
                <p className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
                  {stats.done} bài thi 🎉
                </p>
                <p className="text-xs sm:text-sm text-white opacity-90 mt-1">
                  {stats.excellent > 0
                    ? `Tuyệt vời, có ${stats.excellent} bài xuất sắc! Cố lên nhé! 💖`
                    : 'Cố gắng thêm để đạt thành tích cao nhé! 💖'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── Stat cards ─────────────────────────────────────── */}
        {!isLoading && stats.done > 0 && (
          <div className="kh-rise grid grid-cols-1 sm:grid-cols-3 gap-3" style={{ animationDelay: '120ms' }}>
            <StatCard
              icon={<ListChecks className="w-6 h-6 text-white" />}
              label="Tổng số bài"
              value={stats.done}
              gradient="linear-gradient(135deg, #FB7185, #F97316)"
            />
            <StatCard
              icon={<Target className="w-6 h-6 text-white" />}
              label="Điểm trung bình"
              value={stats.avg}
              suffix="%"
              gradient="linear-gradient(135deg, #8B5CF6, #6366F1)"
            />
            <StatCard
              icon={<Trophy className="w-6 h-6 text-white" />}
              label="Điểm cao nhất"
              value={stats.best}
              suffix="%"
              gradient="linear-gradient(135deg, #10B981, #059669)"
            />
          </div>
        )}

        {/* ─── Filter pills ───────────────────────────────────── */}
        {!isLoading && stats.done > 0 && (
          <div className="kh-rise flex items-center gap-2 overflow-x-auto pb-1" style={{ animationDelay: '180ms' }}>
            <FilterPill
              active={filter === 'all'} onClick={() => setFilter('all')}
              count={stats.done}
              activeStyle={{ bg: 'linear-gradient(135deg, #FB7185, #F97316)', shadow: '0 6px 16px rgba(251,113,133,0.35)' }}
            >
              <Sparkles className="w-4 h-4" /> Tất cả
            </FilterPill>
            <FilterPill
              active={filter === 'excellent'} onClick={() => setFilter('excellent')}
              count={stats.excellent}
              activeStyle={{ bg: 'linear-gradient(135deg, #10B981, #059669)', shadow: '0 6px 16px rgba(16,185,129,0.35)' }}
            >
              <Trophy className="w-4 h-4" /> Xuất sắc
            </FilterPill>
            <FilterPill
              active={filter === 'practice'} onClick={() => setFilter('practice')}
              count={stats.practice}
              activeStyle={{ bg: 'linear-gradient(135deg, #8B5CF6, #6366F1)', shadow: '0 6px 16px rgba(139,92,246,0.35)' }}
            >
              <Target className="w-4 h-4" /> Cần luyện
            </FilterPill>
            {stats.pendingCount > 0 && (
              <FilterPill
                active={filter === 'pending'} onClick={() => setFilter('pending')}
                count={stats.pendingCount}
                activeStyle={{ bg: 'linear-gradient(135deg, #F59E0B, #D97706)', shadow: '0 6px 16px rgba(245,158,11,0.35)' }}
              >
                <Hourglass className="w-4 h-4" /> Đang chấm
              </FilterPill>
            )}
          </div>
        )}

        {/* ─── List ────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-3xl bg-white border-2 border-rose-100 animate-pulse" />
            ))}
          </div>
        ) : subs.length === 0 ? (
          <EmptyHistory />
        ) : visible.length === 0 ? (
          <EmptyFilter />
        ) : (
          <div className="space-y-3">
            {visible.map((s, idx) => {
              const graded = isGraded(s);
              const accuracy = s.stats?.accuracy ?? 0;
              const b = band(accuracy);
              const minutes = s.sTime_taken > 0 ? Math.round(s.sTime_taken / 60) : 0;

              return (
                <Link
                  key={s.sId}
                  to={`${BASE}/ket-qua/${s.sId}`}
                  className="kh-rise group flex items-center gap-3 sm:gap-4 bg-white rounded-3xl border-2 border-rose-100 p-3 sm:p-4 transition-all hover:shadow-lg hover:-translate-y-0.5 hover:border-rose-200"
                  style={{ animationDelay: `${Math.min(idx, 8) * 55 + 200}ms` }}
                >
                  <ScoreDonut value={accuracy} color={b.bg} pending={!graded} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                        {s.exam?.eTitle ?? 'Bài thi'}
                      </h3>
                      {graded && b.stars > 0 && <StarRow count={b.stars} />}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5 flex-wrap">
                      {s.sSubmit_time && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {fmtDate(s.sSubmit_time)}
                        </span>
                      )}
                      {minutes > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {minutes} phút
                        </span>
                      )}
                      {s.exam?.eSkill && (
                        <span className="capitalize text-slate-400 font-semibold">
                          {String(s.exam.eSkill)}
                        </span>
                      )}
                      {s.stats?.total_questions ? (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <ListChecks className="w-3.5 h-3.5" />
                          {s.stats.correct_answers}/{s.stats.total_questions}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* badge band + làm lại */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {graded ? (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold whitespace-nowrap"
                        style={{ background: b.soft, color: b.bg }}
                      >
                        <span>{b.emoji}</span> {b.label}
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold whitespace-nowrap"
                        style={{ background: '#FEF3C7', color: '#B45309' }}
                      >
                        <Hourglass className="w-3 h-3" /> Đang chấm
                      </span>
                    )}

                    {graded && s.exam?.eId && (
                      <span
                        className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <RotateCcw className="w-3 h-3" /> Làm lại
                      </span>
                    )}
                  </div>

                  <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-rose-400" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty: chưa có lịch sử nào ────────────────────────────────────────────
function EmptyHistory() {
  return (
    <div className="kh-rise text-center py-14 bg-white rounded-3xl border-2 border-rose-100">
      <div className="mx-auto mb-4 flex items-center justify-center" style={{ animation: 'kidsHistBob 3s ease-in-out infinite' }}>
        <svg width="160" height="150" viewBox="0 0 160 150" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Chưa có lịch sử">
          <circle cx="80" cy="78" r="60" fill="#FFF1F2" />
          <circle cx="80" cy="78" r="60" fill="url(#khGlow)" fillOpacity="0.5" />
          {/* tia nắng */}
          <g stroke="#FCD34D" strokeWidth="4" strokeLinecap="round">
            <line x1="80" y1="6" x2="80" y2="16" />
            <line x1="132" y1="20" x2="125" y2="28" />
            <line x1="28" y1="20" x2="35" y2="28" />
          </g>
          {/* ngôi sao */}
          <path d="M34 96l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#FB7185" />
          <path d="M128 60l2.5 5 5.5.8-4 4 .9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-4 5.5-.8z" fill="#34D399" />
          {/* cuốn sách (lịch sử) */}
          <rect x="46" y="58" width="68" height="56" rx="10" fill="url(#khBook)" />
          <rect x="46" y="58" width="68" height="56" rx="10" stroke="#fff" strokeWidth="3" />
          <line x1="80" y1="58" x2="80" y2="114" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
          {/* dòng kẻ */}
          <line x1="54" y1="74" x2="74" y2="74" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
          <line x1="54" y1="84" x2="70" y2="84" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
          <line x1="86" y1="74" x2="106" y2="74" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
          <line x1="86" y1="84" x2="102" y2="84" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
          <defs>
            <linearGradient id="khBook" x1="46" y1="58" x2="114" y2="114" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FB923C" />
              <stop offset="1" stopColor="#F97316" />
            </linearGradient>
            <radialGradient id="khGlow" cx="0" cy="0" r="1" gradientTransform="translate(80 78) rotate(90) scale(60)" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FED7AA" />
              <stop offset="1" stopColor="#FED7AA" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      </div>
      <h3 className="text-lg font-extrabold text-slate-800">Chưa có bài thi nào trong lịch sử</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
        Khi em hoàn thành một bài thi, kết quả sẽ được lưu lại tại đây nhé!
      </p>
      <Link
        to={`${BASE}/bai-tap`}
        className="inline-flex items-center gap-2 mt-5 px-5 py-3 rounded-2xl text-sm font-extrabold text-white transition-transform hover:scale-[1.02] active:scale-95"
        style={{ background: 'linear-gradient(135deg, #FB7185 0%, #F97316 100%)' }}
      >
        <BookOpenCheck className="w-4 h-4" /> Đi làm bài thi 🚀
      </Link>
    </div>
  );
}

// ─── Empty: bộ lọc trống ───────────────────────────────────────────────────
function EmptyFilter() {
  return (
    <div className="text-center py-12 bg-white rounded-3xl border-2 border-rose-100">
      <div className="text-5xl mb-3">🔍</div>
      <h3 className="text-base font-extrabold text-slate-800">Không có bài nào ở mục này</h3>
      <p className="text-sm text-slate-500 mt-1">Thử chọn mục khác xem nhé!</p>
    </div>
  );
}

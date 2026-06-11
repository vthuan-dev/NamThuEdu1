/**
 * TeensHistory — Trang "Lịch sử thi" cho học viên Teens (13–17).
 *
 * Tông teal/cyan đồng bộ TeensLayout (khác bản Adults tông tím).
 * Hiển thị toàn bộ bài đã làm: lọc theo kết quả + tìm kiếm + sắp xếp,
 * gom theo tháng, mỗi thẻ mở thẳng trang kết quả.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Clock, Search, CalendarDays, ChevronRight, Loader2, PenLine,
  CheckCircle2, TrendingUp, Star, BarChart2, Trophy, Target,
} from 'lucide-react';
import { studentApi } from '../../../../services/studentApi';
import { formatDate } from '../../../../utils/formatters';

const BASE = '/hoc-vien';
const TEAL = '#0D9488';
const TEAL_MID = '#14B8A6';
const PASS_THRESHOLD = 0.5; // teen-friendly: đạt khi ≥ 50%

const toNum = (v: any) => Number(v ?? 0);

type ResultFilter = 'all' | 'pass' | 'fail';
type SortMode = 'newest' | 'oldest' | 'highest' | 'lowest';

function statusChip(status: string) {
  switch (status) {
    case 'graded':             return { label: 'Đã chấm',      color: '#059669', bg: '#D1FAE5' };
    case 'grading_subjective': return { label: 'Đang chấm…',   color: '#D97706', bg: '#FEF3C7' };
    case 'submitted':          return { label: 'Đã nộp',       color: '#0D9488', bg: '#CCFBF1' };
    case 'partially_graded':   return { label: 'Chấm một phần',color: '#7C3AED', bg: '#EDE9FE' };
    case 'auto_submitted':     return { label: 'Tự nộp',       color: '#0891B2', bg: '#CFFAFE' };
    case 'in_progress':        return { label: 'Đang làm',     color: '#6B7280', bg: '#F3F4F6' };
    default:                   return { label: status ?? '—',  color: '#6B7280', bg: '#F3F4F6' };
  }
}

function timeTaken(start?: string, end?: string): string | null {
  if (!start || !end) return null;
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (diff <= 0) return null;
  const m = Math.floor(diff / 60), s = diff % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h${m % 60}p`;
  if (m > 0) return `${m}p${s ? ` ${s}s` : ''}`;
  return `${s}s`;
}

function monthLabel(dateStr?: string): string {
  if (!dateStr) return 'Không rõ ngày';
  const d = new Date(dateStr);
  return `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
}

export function TeensHistory() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  const { data, isLoading } = useQuery({
    queryKey: ['student', 'submissions', 'all'],
    queryFn: () => studentApi.getSubmissions({}),
  });

  const raw = (data as any)?.data?.data;
  const all: any[] = Array.isArray(raw) ? raw : (raw?.data ?? raw?.submissions ?? []);

  // ─── Thống kê ───────────────────────────────────────────────────────────────
  const submitted = all.filter(s => s.sStatus !== 'in_progress');
  const passed = submitted.filter(s => {
    const max = toNum(s.exam?.eMax_score ?? 100);
    return max > 0 && toNum(s.sScore) / max >= PASS_THRESHOLD;
  }).length;
  const passRate = submitted.length > 0 ? Math.round((passed / submitted.length) * 100) : 0;
  const avgScore = submitted.length > 0
    ? submitted.reduce((sum, s) => sum + toNum(s.sScore), 0) / submitted.length : 0;
  const best = submitted.reduce((b: any, s) => {
    const pct = toNum(s.sScore) / Math.max(toNum(s.exam?.eMax_score ?? 100), 1);
    const bp = b ? toNum(b.sScore) / Math.max(toNum(b.exam?.eMax_score ?? 100), 1) : 0;
    return pct > bp ? s : b;
  }, null);
  const bestScore = best ? toNum(best.sScore) : 0;

  // ─── Lọc + sắp xếp ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => all
    .filter(s => {
      const max = toNum(s.exam?.eMax_score ?? 100);
      const pct = max > 0 ? toNum(s.sScore) / max : 0;
      if (resultFilter === 'pass' && pct < PASS_THRESHOLD) return false;
      if (resultFilter === 'fail' && (pct >= PASS_THRESHOLD || s.sStatus === 'in_progress')) return false;
      if (search.trim() && !s.exam?.eTitle?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortMode === 'newest' || sortMode === 'oldest') {
        const ta = new Date(a.sSubmit_time ?? a.sStart_time ?? 0).getTime();
        const tb = new Date(b.sSubmit_time ?? b.sStart_time ?? 0).getTime();
        return sortMode === 'newest' ? tb - ta : ta - tb;
      }
      return sortMode === 'highest'
        ? toNum(b.sScore) - toNum(a.sScore)
        : toNum(a.sScore) - toNum(b.sScore);
    }), [all, resultFilter, search, sortMode]);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    filtered.forEach(s => {
      const key = monthLabel(s.sSubmit_time ?? s.sStart_time);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return [...map.entries()];
  }, [filtered]);

  const hasFilter = search.trim() !== '' || resultFilter !== 'all';

  const stats = [
    { label: 'Tổng bài', value: all.length, icon: BarChart2, color: TEAL, bg: '#CCFBF1' },
    { label: 'Đã làm', value: submitted.length, icon: CheckCircle2, color: '#0891B2', bg: '#CFFAFE' },
    { label: 'Điểm TB', value: avgScore > 0 ? avgScore.toFixed(1) : '—', icon: TrendingUp, color: '#2563EB', bg: '#DBEAFE' },
    { label: 'Cao nhất', value: bestScore > 0 ? bestScore.toFixed(1) : '—', icon: Star, color: '#D97706', bg: '#FEF3C7' },
  ];

  return (
    <div className="pb-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl mt-5"
        style={{ background: `linear-gradient(135deg, #0F766E 0%, ${TEAL} 50%, ${TEAL_MID} 100%)` }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-10 left-1/3 w-60 h-60 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #99F6E4, transparent)' }} />
          <div className="absolute bottom-0 right-10 w-44 h-44 rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, #A5F3FC, transparent)', transform: 'translateY(40%)' }} />
        </div>
        <div className="relative z-10 px-6 sm:px-8 py-7">
          <div className="flex items-center gap-3.5 mb-5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)' }}>
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-teal-100 text-[11px] font-bold tracking-widest uppercase">Hành trình học tập</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">Lịch sử làm bài</h1>
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {stats.map(s => (
              <div key={s.label} className="flex items-center gap-2 px-3.5 py-2 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.18)' }}>
                <span className="text-lg font-extrabold text-white">{s.value}</span>
                <span className="text-xs font-semibold text-teal-100">{s.label}</span>
              </div>
            ))}
            {submitted.length > 0 && (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.18)' }}>
                <Target className="w-4 h-4 text-emerald-200" />
                <span className="text-sm font-extrabold text-white">{passRate}%</span>
                <span className="text-xs font-semibold text-teal-100">đạt</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm bài đã làm…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none bg-white border border-slate-200 focus:border-teal-400 transition-colors"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white border border-slate-200">
            {(['all', 'pass', 'fail'] as ResultFilter[]).map(key => (
              <button key={key} onClick={() => setResultFilter(key)}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                style={{
                  background: resultFilter === key ? TEAL : 'transparent',
                  color: resultFilter === key ? '#fff' : '#64748B',
                }}>
                {key === 'all' ? 'Tất cả' : key === 'pass' ? 'Đạt' : 'Chưa đạt'}
              </button>
            ))}
          </div>
          <select
            value={sortMode}
            onChange={e => setSortMode(e.target.value as SortMode)}
            className="px-3 py-2.5 rounded-xl text-sm font-semibold outline-none cursor-pointer bg-white border border-slate-200 text-slate-600"
          >
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="highest">Điểm cao</option>
            <option value="lowest">Điểm thấp</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="mt-5">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl h-[88px] animate-pulse"
                style={{ background: 'linear-gradient(90deg,#F0FDFA,#CCFBF1,#F0FDFA)' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl bg-white py-16 text-center border border-slate-200">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: '#CCFBF1' }}>
              <Trophy className="w-8 h-8" style={{ color: TEAL }} />
            </div>
            <p className="font-bold text-slate-700 mb-1">
              {hasFilter ? 'Không có bài nào khớp bộ lọc' : 'Chưa có bài nào'}
            </p>
            <p className="text-sm text-slate-400 mb-5">
              {hasFilter ? 'Thử đổi từ khóa hoặc bộ lọc khác' : 'Làm bài đầu tiên để bắt đầu hành trình nhé!'}
            </p>
            {hasFilter ? (
              <button onClick={() => { setSearch(''); setResultFilter('all'); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: TEAL }}>
                Xoá bộ lọc
              </button>
            ) : (
              <button onClick={() => navigate(`${BASE}/bai-tap`)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white text-sm"
                style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})` }}>
                Đến bài tập <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([month, items]) => (
              <div key={month}>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="w-3.5 h-3.5" style={{ color: TEAL_MID }} />
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: TEAL_MID }}>{month}</span>
                  <div className="flex-1 h-px bg-teal-100" />
                  <span className="text-[11px] text-teal-400">{items.length} bài</span>
                </div>

                <div className="space-y-2.5">
                  {items.map((s: any) => {
                    const score = toNum(s.sScore);
                    const max = toNum(s.exam?.eMax_score ?? 100);
                    const pct = max > 0 ? Math.round((score / max) * 100) : 0;
                    const status = statusChip(s.sStatus);
                    const isVstep = String(s.exam?.eType ?? '').toUpperCase() === 'VSTEP';
                    const isPending = s.sStatus === 'grading_subjective';
                    const isInProg = s.sStatus === 'in_progress';
                    const isPass = !isInProg && !isPending && max > 0 && score / max >= PASS_THRESHOLD;
                    const took = timeTaken(s.sStart_time, s.sSubmit_time);

                    const onClick = () => {
                      if (isInProg) {
                        navigate(isVstep
                          ? `${BASE}/lam-bai-vstep/${s.exam?.eId}?submissionId=${s.sId}`
                          : `${BASE}/lam-bai/${s.exam?.eId}?autostart=1&submissionId=${s.sId}`);
                        return;
                      }
                      navigate(isVstep ? `${BASE}/ket-qua-vstep/${s.sId}` : `${BASE}/ket-qua/${s.sId}`);
                    };

                    const badgeBg = isInProg ? '#F1F5F9'
                      : isPending ? '#FEF3C7'
                      : isPass ? 'linear-gradient(135deg,#0D9488,#14B8A6)'
                      : 'linear-gradient(135deg,#F43F5E,#FB7185)';

                    return (
                      <button key={s.sId} onClick={onClick}
                        className="w-full text-left rounded-2xl bg-white overflow-hidden border border-slate-200 hover:border-teal-300 hover:shadow-[0_4px_16px_rgba(13,148,136,0.10)] transition-all">
                        {isInProg && <div className="h-0.5" style={{ background: `linear-gradient(90deg,${TEAL},${TEAL_MID})` }} />}
                        <div className="flex items-center gap-3 p-3.5">
                          {/* Score badge */}
                          <div className="w-[56px] h-[56px] rounded-xl flex-shrink-0 flex flex-col items-center justify-center"
                            style={{ background: badgeBg }}>
                            {isPending ? (
                              <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#D97706' }} />
                            ) : isInProg ? (
                              <>
                                <PenLine className="w-4 h-4 text-slate-400" />
                                <span className="text-[7px] font-extrabold text-slate-400 mt-0.5 tracking-wide">LÀM DỞ</span>
                              </>
                            ) : (
                              <>
                                <span className="text-[17px] font-extrabold text-white leading-none">{score.toFixed(0)}</span>
                                <span className="text-[8px] font-bold text-white/85 mt-0.5">{pct}%</span>
                              </>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold truncate text-[14px] text-slate-800 leading-tight">
                              {s.exam?.eTitle ?? 'Bài thi'}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
                                style={{ background: status.bg, color: status.color }}>
                                {status.label}
                              </span>
                              {!isInProg && !isPending && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                                  style={{ background: isPass ? '#D1FAE5' : '#FFE4E6', color: isPass ? '#059669' : '#E11D48' }}>
                                  {isPass ? 'Đạt' : 'Chưa đạt'}
                                </span>
                              )}
                              {took && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400">
                                  <Clock className="w-3 h-3" />{took}
                                </span>
                              )}
                              {(s.sSubmit_time || s.sStart_time) && (
                                <span className="text-[10px] text-slate-400">{formatDate(s.sSubmit_time ?? s.sStart_time)}</span>
                              )}
                            </div>

                            {/* Progress bar */}
                            {!isInProg && !isPending && max > 0 && (
                              <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-slate-100">
                                <div className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${pct}%`, background: isPass ? `linear-gradient(90deg,${TEAL},${TEAL_MID})` : 'linear-gradient(90deg,#F43F5E,#FB7185)' }} />
                              </div>
                            )}
                          </div>

                          <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

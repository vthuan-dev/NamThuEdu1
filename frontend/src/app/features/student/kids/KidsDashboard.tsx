import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Play, ArrowRight, Flame, ChevronRight, AlertCircle, Headphones, BookOpen, PenLine, Mic, Sparkles } from 'lucide-react';
import { api } from '../../../../services/api';
import { studentApi } from '../../../../services/studentApi';
import { usePageTitle, PAGE_TITLES } from '../../../../hooks/usePageTitle';
import { NextGoalCard } from '../components/NextGoalCard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GamificationData {
  coins: { total: number };
  stats: {
    lessons_completed: number;
    exams_taken: number;
    total_points: number;
    average_score: number;
    study_time_minutes: number;
  };
  streak: { current: number; longest: number };
  badges: { earned: number };
  achievements: { completed: number; total: number };
}

interface TestItem {
  assignment_id: number;
  exam_title: string;
  exam_type: string;
  exam_skill: string;
  exam_duration: number;
  total_questions: number;
  attempts_allowed: number;
  attempts_used: number;
  is_urgent: boolean;
  status: 'pending' | 'in_progress' | 'completed';
  submission_id?: number;
}

// ─── Cambridge YL filtering ──────────────────────────────────────────────────
// Kids chỉ thấy Cambridge Young Learners. VSTEP/IELTS/TOEIC ẩn (dành cho teens/adults).

type CambridgeLevel = 'starters' | 'movers' | 'flyers' | 'other';

function detectLevel(examType: string, examTitle: string): CambridgeLevel {
  const t = (examType + ' ' + examTitle).toLowerCase();
  if (t.includes('starter') || t.includes('pre a1')) return 'starters';
  if (t.includes('mover')   || /\ba1\b/.test(t))     return 'movers';
  if (t.includes('flyer')   || /\ba2\b/.test(t))     return 'flyers';
  return 'other';
}

function isKidsExam(test: TestItem): boolean {
  const t = (test.exam_type + ' ' + test.exam_title).toLowerCase();
  if (t.includes('vstep') || t.includes('ielts') || t.includes('toeic')) return false;
  return true;
}

const LEVEL_META: Record<Exclude<CambridgeLevel, 'other'>, { label: string; sub: string; tone: string; dot: string }> = {
  starters: { label: 'Starters', sub: 'Pre A1', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200',  dot: 'bg-emerald-500' },
  movers:   { label: 'Movers',   sub: 'A1',     tone: 'bg-sky-50 text-sky-700 ring-sky-200',              dot: 'bg-sky-500' },
  flyers:   { label: 'Flyers',   sub: 'A2',     tone: 'bg-violet-50 text-violet-700 ring-violet-200',     dot: 'bg-violet-500' },
};

const SKILL_META: Record<string, { label: string; Icon: any }> = {
  listening: { label: 'Nghe',    Icon: Headphones },
  reading:   { label: 'Đọc',     Icon: BookOpen },
  writing:   { label: 'Viết',    Icon: PenLine },
  speaking:  { label: 'Nói',     Icon: Mic },
};

function getSkillMeta(skill: string) {
  return SKILL_META[skill?.toLowerCase()] ?? { label: skill || 'Tổng hợp', Icon: BookOpen };
}

// ─── Claymorphism design tokens ──────────────────────────────────────────────
const CLAY_STARTERS = {
  bg:     'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)',
  shadow: '0 8px 24px rgba(16,185,129,0.22), 0 2px 8px rgba(16,185,129,0.10)',
  text:   '#065F46', badge: '#10B981', badgeBg: 'rgba(209,250,229,0.7)',
};
const CLAY_MOVERS = {
  bg:     'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)',
  shadow: '0 8px 24px rgba(59,130,246,0.22), 0 2px 8px rgba(59,130,246,0.10)',
  text:   '#1E3A8A', badge: '#3B82F6', badgeBg: 'rgba(219,234,254,0.7)',
};
const CLAY_FLYERS = {
  bg:     'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)',
  shadow: '0 8px 24px rgba(139,92,246,0.22), 0 2px 8px rgba(139,92,246,0.10)',
  text:   '#4C1D95', badge: '#8B5CF6', badgeBg: 'rgba(237,233,254,0.7)',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const ClaySection = ({ title, subtitle, emoji, action, children, accentColor }:
  { title: string; subtitle?: string; emoji?: string; action?: React.ReactNode; children: React.ReactNode; accentColor?: string }) => (
  <section className="rounded-3xl p-5 sm:p-6" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(251,113,133,0.10), 0 2px 8px rgba(0,0,0,0.04)', border: '2px solid rgba(255,255,255,0.9)' }}>
    <header className="flex items-start sm:items-center justify-between gap-3 sm:gap-4 mb-5">
      <div className="min-w-0">
        <h2 className="text-base sm:text-lg font-extrabold tracking-tight" style={{ color: accentColor || '#1A1040' }}>
          {emoji && <span className="mr-1.5">{emoji}</span>}{title}
        </h2>
        {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </header>
    {children}
  </section>
);

const ExamCard = ({ test }: { test: TestItem }) => {
  const level = detectLevel(test.exam_type, test.exam_title);
  const clay = level === 'starters' ? CLAY_STARTERS : level === 'movers' ? CLAY_MOVERS : level === 'flyers' ? CLAY_FLYERS : null;
  const skill = getSkillMeta(test.exam_skill);
  const canStart = test.attempts_used < test.attempts_allowed;
  const inProgress = test.status === 'in_progress';

  return (
    <article className="group rounded-2xl p-4 sm:p-5 transition-all duration-200 hover:-translate-y-1 active:scale-[0.98]"
      style={{
        background: clay?.bg ?? 'linear-gradient(135deg, #FFF1F2, #FFE4E6)',
        boxShadow: clay?.shadow ?? '0 8px 24px rgba(244,63,94,0.18)',
        border: '2px solid rgba(255,255,255,0.8)',
      }}>
      {/* Top row: level badge + urgent */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded-full"
          style={{ background: clay?.badgeBg ?? 'rgba(255,255,255,0.6)', color: clay?.text ?? '#9F1239', backdropFilter: 'blur(8px)' }}>
          {level !== 'other' ? LEVEL_META[level as Exclude<CambridgeLevel,'other'>].label : test.exam_type}
          {level !== 'other' && <span className="text-[10px] opacity-70 ml-1">· {LEVEL_META[level as Exclude<CambridgeLevel,'other'>].sub}</span>}
        </span>
        {test.is_urgent && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-white/70 px-2 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3" />Sắp hết hạn
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm sm:text-base font-extrabold mb-3 line-clamp-2 leading-snug min-h-[2.75rem]" style={{ color: clay?.text ?? '#9F1239' }}>
        {test.exam_title}
      </h3>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-[11px] font-semibold mb-3" style={{ color: clay?.text ?? '#9F1239', opacity: 0.7 }}>
        <span className="inline-flex items-center gap-1.5">
          <skill.Icon className="w-3.5 h-3.5" />{skill.label}
        </span>
        <span>{test.exam_duration} phút</span>
        <span>{test.total_questions} câu</span>
      </div>

      {/* Attempts bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.4)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${test.attempts_allowed > 0 ? (test.attempts_used/test.attempts_allowed)*100 : 0}%`, background: clay?.badge ?? '#F43F5E' }} />
        </div>
        <span className="text-[10px] font-bold flex-shrink-0" style={{ color: clay?.text ?? '#9F1239' }}>{test.attempts_used}/{test.attempts_allowed} lượt</span>
      </div>

      {/* Action */}
      <Link
        to={canStart ? `/hoc-vien/phong-cho/${test.assignment_id}` : '#'}
        onClick={e => !canStart && e.preventDefault()}
        className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-extrabold transition-all"
        style={canStart
          ? { background: clay?.badge ?? '#F43F5E', color: '#fff', boxShadow: `0 4px 12px ${clay?.badge ?? '#F43F5E'}55` }
          : { background: 'rgba(255,255,255,0.4)', color: 'rgba(0,0,0,0.3)', cursor: 'not-allowed' }}
      >
        <Play className="w-4 h-4 fill-white" />
        {inProgress ? 'Tiếp tục' : 'Bắt đầu'}
      </Link>
    </article>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function KidsDashboard() {
  usePageTitle(PAGE_TITLES.STUDENT_KIDS_DASHBOARD);
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const [gamificationData, setGamificationData] = useState<GamificationData | null>(null);
  const [tests, setTests] = useState<TestItem[]>([]);
  const [recentResults, setRecentResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [gamiRes, testsRes, subRes] = await Promise.allSettled([
          api.get('/student/gamification/overview'),
          studentApi.getTests({ status: 'pending' }),
          studentApi.getSubmissions({ limit: 3, sort: 'recent' }),
        ]);

        if (gamiRes.status === 'fulfilled' && gamiRes.value.data.status === 'success') {
          setGamificationData(gamiRes.value.data.data);
        }
        if (testsRes.status === 'fulfilled') {
          const raw = (testsRes.value as any).data?.data;
          const pending = (raw?.pending || []).map((t: any) => ({ ...t, status: 'pending' }));
          const inProg  = (raw?.in_progress || []).map((t: any) => ({ ...t, status: 'in_progress' }));
          setTests([...inProg, ...pending].filter(isKidsExam).slice(0, 6));
        }
        if (subRes.status === 'fulfilled') {
          const subs = (subRes.value as any).data?.data?.submissions || [];
          setRecentResults(subs.slice(0, 3));
        }
      } catch (err) {
        console.error('KidsDashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(160deg, #FFF1F2 0%, #FFF7ED 50%, #F0FDF4 100%)' }}>
        <div className="text-center space-y-4">
          <div className="text-5xl animate-bounce">🎈</div>
          <p className="text-base font-bold text-rose-500">Đang tải bảng điều khiển…</p>
        </div>
      </div>
    );
  }

  const d = gamificationData;
  const coins    = d?.coins.total ?? 0;
  const streak   = d?.streak.current ?? 0;
  const avgScore = Math.round(d?.stats.average_score ?? 0);
  const examsCount = d?.stats.exams_taken ?? 0;

  // Filter: kids chỉ thấy Cambridge YL — ẩn VSTEP/IELTS/TOEIC
  const kidsTests = tests.filter(isKidsExam);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #FFF1F2 0%, #FFF7ED 50%, #F0FDF4 100%)' }}>

      {/* ─── Greeting + Stats (light, hợp header trắng) ───────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-5 pb-8">

        <section className="relative overflow-hidden rounded-3xl p-5 sm:p-7"
          style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF7ED 100%)', boxShadow: '0 8px 32px rgba(251,113,133,0.12)', border: '2px solid rgba(255,255,255,0.9)' }}>
          {/* Decorative blobs */}
          <div className="absolute -top-10 -right-6 w-40 h-40 rounded-full opacity-40 pointer-events-none" style={{ background: 'radial-gradient(circle, #FED7AA, transparent)' }} />
          <div className="absolute -bottom-12 left-1/3 w-36 h-36 rounded-full opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle, #FECDD3, transparent)' }} />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div>
              <p className="text-xs font-extrabold text-rose-400 uppercase tracking-widest mb-1">🎮 Trang chủ Kids</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight" style={{ color: '#9F1239' }}>
                Xin chào, {user?.uName?.split(' ').slice(-1)[0] || 'bạn'} 👋
              </h1>
              <p className="text-sm font-semibold text-orange-500/80 mt-1">Cambridge Young Learners ⭐</p>
              {streak > 0 && (
                <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full"
                  style={{ background: 'rgba(251,146,60,0.14)', border: '1.5px solid rgba(251,146,60,0.25)' }}>
                  <Flame className="w-4 h-4 text-orange-500" fill="#FB923C" />
                  <span className="text-xs font-bold text-orange-700">{streak} ngày học liên tiếp — tuyệt vời! 🌟</span>
                </div>
              )}
            </div>

            {/* Stat bubbles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { icon: '🔥', label: 'Streak',  value: streak,          c: '#E11D48', bg: 'linear-gradient(135deg,#FFF1F2,#FECDD3)' },
                { icon: '🪙', label: 'Coins',   value: coins,           c: '#B45309', bg: 'linear-gradient(135deg,#FEFCE8,#FEF08A)' },
                { icon: '📊', label: 'Điểm TB', value: `${avgScore}%`,  c: '#2563EB', bg: 'linear-gradient(135deg,#EFF6FF,#BFDBFE)' },
                { icon: '📝', label: 'Đã thi',  value: examsCount,      c: '#059669', bg: 'linear-gradient(135deg,#F0FFF4,#BBF7D0)' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl px-3.5 py-2.5 min-w-[84px]"
                  style={{ background: s.bg, border: '2px solid rgba(255,255,255,0.85)', boxShadow: '0 4px 14px rgba(0,0,0,0.05)' }}>
                  <div className="text-lg leading-none">{s.icon}</div>
                  <div className="text-lg font-extrabold tabular-nums leading-none mt-1.5" style={{ color: s.c }}>{s.value}</div>
                  <div className="text-[10px] font-bold mt-0.5" style={{ color: s.c, opacity: 0.7 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Nội dung ──────────────────────────────────────────── */}

        {/* 🎯 Mục tiêu sắp tới của lớp */}
        <NextGoalCard ageGroup="kids" />


        {/* ─── Bài thi được giao ───────────────────────────────── */}
        <ClaySection
          title="Bài thi của bạn"
          emoji="📚"
          subtitle={kidsTests.length > 0 ? `${kidsTests.length} bài đang chờ bạn làm` : undefined}
          accentColor="#9F1239"
          action={
            <Link to="/hoc-vien/bai-tap"
                  className="inline-flex items-center gap-1 text-sm font-extrabold text-rose-600 hover:text-rose-700">
              Xem tất cả<ChevronRight className="w-4 h-4" />
            </Link>
          }
        >
          {kidsTests.length === 0 ? (
            <div className="relative text-center py-12 px-6 rounded-2xl" style={{ background: 'linear-gradient(135deg, #FFF1F2, #FFE4E6)', border: '2px solid rgba(255,255,255,0.8)' }}>
              <div className="text-5xl mb-3">🎯</div>
              <p className="text-base font-extrabold text-rose-800">Chưa có bài thi nào</p>
              <p className="text-sm text-rose-600/80 mt-1 max-w-sm mx-auto font-medium">
                Khi thầy/cô giao bài Starters, Movers hoặc Flyers — sẽ hiện ở đây.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {kidsTests.map(test => <ExamCard key={test.assignment_id} test={test} />)}
            </div>
          )}
        </ClaySection>

        {/* ─── Lộ trình Cambridge ──────────────────────────────── */}
        <ClaySection
          title="Lộ trình Cambridge Young Learners"
          emoji="🌈"
          subtitle="Ba cấp độ tăng dần — Starters đến Flyers"
          accentColor="#065F46"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([
              { lv: 'starters' as const, clay: CLAY_STARTERS, emoji: '🌱', desc: 'Bước đầu làm quen tiếng Anh. Từ vựng cơ bản, câu chào hỏi, hình ảnh.' },
              { lv: 'movers'   as const, clay: CLAY_MOVERS,   emoji: '🚀', desc: 'Mở rộng vốn từ và cấu trúc câu. Đọc hiểu đoạn văn ngắn, viết câu đơn giản.' },
              { lv: 'flyers'   as const, clay: CLAY_FLYERS,   emoji: '⭐', desc: 'Vận dụng tiếng Anh trong nhiều tình huống. Đọc đoạn văn dài, viết đoạn ngắn.' },
            ]).map(({ lv, clay, emoji: em, desc }, i) => {
              const meta = LEVEL_META[lv];
              return (
                <div key={lv} className="rounded-2xl p-5 transition-all hover:-translate-y-1"
                  style={{ background: clay.bg, boxShadow: clay.shadow, border: '2px solid rgba(255,255,255,0.8)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded-full"
                      style={{ background: clay.badgeBg, color: clay.text, backdropFilter: 'blur(8px)' }}>
                      {meta.sub}
                    </span>
                    <span className="text-xl">{em}</span>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: clay.badge }}>Bước {i + 1}</p>
                  <h3 className="text-base font-extrabold mb-2" style={{ color: clay.text }}>{meta.label}</h3>
                  <p className="text-xs leading-relaxed font-medium" style={{ color: clay.text, opacity: 0.75 }}>{desc}</p>
                </div>
              );
            })}
          </div>
        </ClaySection>

        {/* ─── Kết quả gần đây ────────────────────────────────── */}
        {recentResults.length > 0 && (
          <ClaySection
            title="Kết quả gần đây"
            emoji="🏅"
            accentColor="#92400E"
            action={
              <Link to="/hoc-vien/lich-su"
                    className="inline-flex items-center gap-1 text-sm font-extrabold text-rose-600 hover:text-rose-700">
                Xem tất cả<ChevronRight className="w-4 h-4" />
              </Link>
            }
          >
            <div className="space-y-3">
              {recentResults.map((sub: any) => {
                const score = Math.round(sub.sScore ?? 0);
                const skill = getSkillMeta(sub.exam?.eSkill || '');
                const isGreat = score >= 80;
                const isOk    = score >= 60;
                const clay = isGreat ? CLAY_STARTERS : isOk ? CLAY_MOVERS : CLAY_FLYERS;
                return (
                  <Link
                    key={sub.sId}
                    to={`/hoc-vien/ket-qua/${sub.sId}`}
                    className="flex items-center gap-3 sm:gap-4 p-3 rounded-2xl transition-all hover:-translate-y-0.5 active:scale-[0.97]"
                    style={{ background: clay.bg, boxShadow: clay.shadow, border: '2px solid rgba(255,255,255,0.8)' }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/40">
                      <skill.Icon className="w-4 h-4" style={{ color: clay.badge }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold truncate" style={{ color: clay.text }}>{sub.exam?.eTitle || 'Bài thi'}</p>
                      <p className="text-xs font-semibold mt-0.5 truncate" style={{ color: clay.text, opacity: 0.7 }}>{skill.label} · {sub.exam?.eTotal_questions || 0} câu</p>
                    </div>
                    <div className="text-lg font-extrabold tabular-nums flex-shrink-0" style={{ color: clay.badge }}>{score}%</div>
                    <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: clay.badge, opacity: 0.7 }} />
                  </Link>
                );
              })}
            </div>
          </ClaySection>
        )}

      </div>
    </div>
  );
}


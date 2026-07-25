import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import {
  BarChart3, BookOpenCheck, Target, TrendingUp,
  Flame, ArrowRight, Play, CheckCircle2, ChevronRight, Sparkles,
  AlertCircle, Bell, X, ClipboardList, Mic, Headphones, PenLine,
} from 'lucide-react';
import { api } from '../../../../services/api';
import {
  studentApi,
  type InProgressTest,
  type UpcomingTest,
  type TeacherReminder,
  type TestAssignment,
  type TodayActivity,
} from '../../../../services/studentApi';
import { usePageTitle, PAGE_TITLES } from '../../../../hooks/usePageTitle';
import { ExamNewsFeed } from './components/ExamNewsFeed';
import { NextGoalCard } from '../components/NextGoalCard';

// ─── Design tokens (Teal/Cyan — Teens theme, distinct from Adults' purple) ──────
const INDIGO       = '#0D9488';
const INDIGO_MID   = '#14B8A6';
const INDIGO_LIGHT = '#F0FDFA';

// ─── Types ────────────────────────────────────────────────────────────────────
interface GamificationData {
  coins: { total: number; lifetime: number; spent: number; };
  stats: {
    lessons_completed: number;
    exams_taken: number;
    practice_sessions: number;
    total_points: number;
    average_score: number;
    study_time_minutes: number;
  };
  streak: { current: number; longest: number; last_activity: string | null; total_active_days: number; };
  badges: { earned: number; };
  achievements: { completed: number; total: number; percentage: number; };
}

// ─── Teens exam filter ────────────────────────────────────────────────────────
function isTeensExam(a: TestAssignment): boolean {
  const t = (a.exam_type + ' ' + a.exam_title).toLowerCase();
  // Loại bỏ VSTEP (chỉ adults)
  if (t.includes('vstep')) return false;
  // THPT, IELTS, GENERAL, Kids đều OK cho teens
  return true;
}

function isThptExam(a: TestAssignment): boolean {
  return (a.exam_type || '').toUpperCase() === 'THPT';
}

function buildExamRouteUrl(opts: { examType?: string; assignmentId?: number; examId?: number; submissionId?: number; }): string {
  const t = (opts.examType || '').toUpperCase();
  if (t === 'THPT') {
    const examId = opts.examId ?? opts.assignmentId;
    const sid = opts.submissionId ? `?submissionId=${opts.submissionId}` : '';
    return `/hoc-vien/lam-bai-thpt/${examId}${sid}`;
  }
  const target = opts.assignmentId ?? opts.examId;
  const sid = opts.submissionId ? `?autostart=1&submissionId=${opts.submissionId}` : '';
  return `/hoc-vien/lam-bai/${target}${sid}`;
}

// ─── Next-action model ────────────────────────────────────────────────────────
type NextAction =
  | { kind: 'resume'; id: number; submissionId: number; examType: string; title: string; skill: string; minutesLeft: number; totalDuration: number; answeredQuestions: number; totalQuestions: number; routeUrl: string; }
  | { kind: 'start'; assignmentId: number; examType: string; title: string; skill: string; durationMin: number; isUrgent: boolean; daysUntil: number; routeUrl: string; }
  | null;

export function computeNextAction(inProgress: InProgressTest[], upcoming: UpcomingTest[]): NextAction {
  const valid = inProgress.filter(t => Math.round(Number(t.time_remaining) || 0) > 0);
  if (valid.length > 0) {
    const t = valid[0];
    const isThpt = (t.type || '').toUpperCase() === 'THPT';
    return {
      kind: 'resume', id: t.id, submissionId: t.submission_id, examType: t.type || '',
      title: t.title || 'Bài thi', skill: t.skill || '',
      minutesLeft: Math.max(0, Math.round(Number(t.time_remaining) || 0)),
      totalDuration: Number(t.total_duration) || 0,
      answeredQuestions: Math.max(0, Number(t.answered_questions) || 0),
      totalQuestions: Math.max(0, Number(t.total_questions) || 0),
      routeUrl: isThpt
        ? `/hoc-vien/lam-bai-thpt/${(t as any).exam_id ?? t.id}`
        : `/hoc-vien/lam-bai/${t.assignment_id ?? t.id}?autostart=1&submissionId=${t.submission_id}`,
    };
  }
  if (upcoming.length > 0) {
    const t = upcoming[0];
    const isThpt = (t.type || '').toUpperCase() === 'THPT';
    return {
      kind: 'start', assignmentId: t.assignment_id, examType: t.type || '',
      title: t.title || 'Bài thi', skill: t.skill || '',
      durationMin: Number(t.duration) || 0, isUrgent: Boolean(t.is_urgent),
      daysUntil: Number(t.days_until) || 0,
      // BUG FIX: `UpcomingTest` không có trường `exam_id`; `t.id` mới là eId của
      // đề (backend trả `'id' => $exam->eId`). Trước đây fallback về
      // `t.assignment_id` khiến URL dùng NHẦM assignmentId làm examId →
      // getForStudent 404 "Không tìm thấy đề thi" khi vào thẳng từ trang chủ.
      routeUrl: isThpt
        ? `/hoc-vien/lam-bai-thpt/${(t as any).exam_id ?? t.id}?assignmentId=${t.assignment_id}`
        : `/hoc-vien/phong-cho/${t.assignment_id}`,
    };
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function formatDeadline(deadline: string | null | undefined, daysUntil: number) {
  if (daysUntil <= 0) return 'Hết hạn hôm nay';
  if (daysUntil === 1) return 'Còn 1 ngày';
  if (daysUntil <= 7) return `Còn ${daysUntil} ngày`;
  if (!deadline) return `Còn ${daysUntil} ngày`;
  try {
    return `Hạn: ${new Date(deadline).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  } catch { return `Còn ${daysUntil} ngày`; }
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const ProgressRow = ({ label, current, total }: { label: string; current: number; total: number }) => {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-xs tabular-nums" style={{ color: INDIGO_MID }}>{current}/{total}</span>
      </div>
      <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: INDIGO_LIGHT }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${INDIGO}, ${INDIGO_MID})` }} />
      </div>
    </div>
  );
};

const KeyValue = ({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) => (
  <div className="flex justify-between items-center py-1.5">
    <span className="text-sm text-slate-600">{label}</span>
    <span className={`text-sm font-semibold tabular-nums ${highlight ? 'text-teal-700' : 'text-slate-900'}`}>{value}</span>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export function TeensDashboard() {
  usePageTitle(PAGE_TITLES.STUDENT_TEENS_DASHBOARD ?? 'Trang chủ — Teens');
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const [gam, setGam] = useState<GamificationData | null>(null);
  const [inProgress, setInProgress] = useState<InProgressTest[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingTest[]>([]);
  const [reminders, setReminders] = useState<TeacherReminder[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<TestAssignment[]>([]);
  const [skillStats, setSkillStats] = useState<Record<string, { attempts: number; average_score: number; best_score: number }> | null>(null);
  const [today, setToday] = useState<TodayActivity | null>(null);
  const [showAllAssignments, setShowAllAssignments] = useState(false);
  const [dismissingId, setDismissingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [gamRes, inProgRes, upcomingRes, remindersRes, testsRes, skillsRes, todayRes] = await Promise.allSettled([
          api.get('/student/gamification/overview'),
          studentApi.getInProgressTests(),
          studentApi.getUpcomingTests({ days: 30 }),
          studentApi.getReminders(),
          studentApi.getTests({ status: 'pending' }),
          api.get('/student/analytics/skills'),
          studentApi.getTodayActivity(),
        ]);
        if (!mounted) return;
        if (gamRes.status === 'fulfilled' && gamRes.value?.data?.status === 'success') {
          setGam(gamRes.value.data.data);
        } else {
          setError('Không thể tải dữ liệu tổng quan. Vui lòng thử lại.');
        }
        if (inProgRes.status === 'fulfilled' && inProgRes.value?.data?.status === 'success') {
          setInProgress(inProgRes.value.data.data || []);
        }
        if (upcomingRes.status === 'fulfilled' && upcomingRes.value?.data?.status === 'success') {
          setUpcoming(upcomingRes.value.data.data || []);
        }
        if (remindersRes.status === 'fulfilled' && (remindersRes.value as any)?.data?.status === 'success') {
          const payload = (remindersRes.value as any).data.data;
          setReminders(Array.isArray(payload?.reminders) ? payload.reminders : []);
        }
        if (testsRes.status === 'fulfilled') {
          const d = (testsRes.value as any)?.data?.data;
          const list = Array.isArray(d?.pending) ? d.pending : [];
          setPendingAssignments(list.filter(isTeensExam));
        }
        if (skillsRes.status === 'fulfilled' && (skillsRes.value as any)?.data?.status === 'success') {
          setSkillStats((skillsRes.value as any).data.data || null);
        }
        if (todayRes.status === 'fulfilled' && (todayRes.value as any)?.data?.status === 'success') {
          setToday((todayRes.value as any).data.data || null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ─── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full animate-pulse" style={{ background: '#F0FDFA', minHeight: '100vh' }}>
        <div className="h-48" style={{ background: 'linear-gradient(135deg, #134E4A 0%, #0F766E 45%, #14B8A6 100%)' }} />
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-white border border-teal-100" />
            ))}
          </div>
          <div className="h-48 rounded-3xl bg-white border border-teal-100" />
        </div>
      </div>
    );
  }

  // ─── Derived values ────────────────────────────────────────────────────────
  const studyHours    = Math.round((gam?.stats.study_time_minutes || 0) / 60);
  const overallProgress = gam ? Math.min(100, ((gam.stats.lessons_completed + gam.stats.exams_taken) / 70) * 100) : 0;
  const nextAction    = computeNextAction(inProgress, upcoming);
  const completedCount = gam?.stats.exams_taken || 0;
  const ctaLabel      = nextAction?.kind === 'resume' ? 'Tiếp tục' : 'Bắt đầu';
  const eyebrow       = nextAction?.kind === 'resume' ? 'Tiếp tục bài thi' : 'Bài thi tiếp theo';
  const fullName      = user?.uName || user?.name || '';
  const firstName     = fullName.trim() ? fullName.trim().split(/\s+/).slice(-1)[0] : 'bạn';
  const streak        = gam?.streak.current || 0;
  const isNewUser     = !gam || (gam.stats.lessons_completed === 0 && gam.stats.exams_taken === 0 && studyHours === 0);

  // ─── Reminder items ────────────────────────────────────────────────────────
  type ReminderItem = {
    key: string; reminderId: number | null; assignmentId: number;
    title: string; type: string; skill: string; duration: number | null;
    deadline: string | null; daysUntil: number; isUrgent: boolean;
    fromTeacher: boolean; teacherName: string | null; message: string | null;
  };
  const teacherItems: ReminderItem[] = reminders.map(r => ({
    key: `r-${r.id}`, reminderId: r.id, assignmentId: r.assignment_id,
    title: r.title || 'Bài thi', type: r.type || '', skill: r.skill || '',
    duration: r.duration ?? null, deadline: r.deadline, daysUntil: Number(r.days_until ?? 999),
    isUrgent: Boolean(r.is_urgent), fromTeacher: true, teacherName: r.teacher_name, message: r.message,
  }));
  const teacherAssignmentIds = new Set(teacherItems.map(i => i.assignmentId));
  const upcomingItems: ReminderItem[] = upcoming
    .filter(t => !teacherAssignmentIds.has(t.assignment_id) && Number(t.days_until ?? 999) <= 7)
    .map(t => ({
      key: `u-${t.assignment_id}`, reminderId: null, assignmentId: t.assignment_id,
      title: t.title || 'Bài thi', type: t.type || '', skill: t.skill || '',
      duration: t.duration ?? null, deadline: t.deadline, daysUntil: Number(t.days_until ?? 999),
      isUrgent: Boolean(t.is_urgent), fromTeacher: false, teacherName: null, message: null,
    }));
  const allReminderItems = [...teacherItems, ...upcomingItems].sort((a, b) => {
    if (a.fromTeacher !== b.fromTeacher) return a.fromTeacher ? -1 : 1;
    return a.daysUntil - b.daysUntil;
  });
  const visibleReminders = allReminderItems.slice(0, 3);
  const totalReminders = allReminderItems.length;

  const handleDismiss = async (item: ReminderItem) => {
    if (!item.reminderId) return;
    setDismissingId(item.reminderId);
    try {
      await studentApi.dismissReminder(item.reminderId);
      setReminders(prev => prev.filter(r => r.id !== item.reminderId));
    } catch { /* silent */ } finally { setDismissingId(null); }
  };

  const handleResetSession = async (examId: number, type: string, submissionId: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy phiên làm bài hiện tại và làm lại từ đầu? Mọi câu trả lời chưa nộp sẽ bị xóa.')) return;
    setIsResetting(true);
    try {
      const typeUpper = String(type || '').toUpperCase();
      if (typeUpper === 'THPT') {
        await api.post(`/student/thpt-exams/${examId}/start`, { restart: true });
        localStorage.removeItem(`thpt_deadline_${submissionId}`);
      } else if (typeUpper === 'VSTEP' || typeUpper === 'IELTS') {
        await api.post(`/student/exams/${examId}/discard-active-session`);
        localStorage.removeItem(`ielts_deadline_${submissionId}`);
      } else if (typeUpper === 'KIDS') {
        await api.post(`/student/exams/${examId}/start-kids`, { restart: true });
        localStorage.removeItem(`kids_deadline_${submissionId}`);
      } else if (typeUpper === 'TEENS') {
        await api.post(`/student/exams/${examId}/start-teens`, { restart: true });
        localStorage.removeItem(`teens_deadline_${submissionId}`);
      }
      window.location.reload();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Không thể hủy phiên làm bài. Vui lòng thử lại.');
    } finally {
      setIsResetting(false);
    }
  };

  const SKILL_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    listening: { label: 'Listening', color: 'text-blue-700',    bg: 'bg-blue-50',    icon: Headphones },
    reading:   { label: 'Reading',   color: 'text-emerald-700', bg: 'bg-emerald-50', icon: BookOpenCheck },
    writing:   { label: 'Writing',   color: 'text-violet-700',  bg: 'bg-violet-50',  icon: PenLine },
    speaking:  { label: 'Speaking',  color: 'text-orange-700',  bg: 'bg-orange-50',  icon: Mic },
    mixed:     { label: 'Full Test', color: 'text-slate-700',   bg: 'bg-slate-100',  icon: ClipboardList },
  };

  return (
    <div className="w-full" style={{ background: '#F5F3FF', minHeight: '100vh' }}>

      {/* ══ Hero Header ══════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #134E4A 0%, #0F766E 45%, #14B8A6 100%)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-80 h-80 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #5EEAD4, transparent)', transform: 'translateY(-50%)' }} />
          <div className="absolute bottom-0 right-1/3 w-64 h-64 rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, #2DD4BF, transparent)', transform: 'translateY(40%)' }} />
        </div>
        <div className="relative z-10 px-6 sm:px-8 lg:px-10 py-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <p className="text-teal-200 text-xs font-bold tracking-widest uppercase mb-1">Trang chủ</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                {getGreeting()}, {firstName} 👋
              </h1>
              <p className="text-teal-100 text-sm mt-1">
                {streak > 0
                  ? <><span className="font-bold text-yellow-300">{streak} ngày</span> học liên tiếp — tuyệt vời!</>
                  : 'Hãy bắt đầu hôm nay và xây dựng thói quen học tập.'}
              </p>
            </div>
            {/* Daily Goal ring */}
            {(() => {
              const DAILY_GOAL_MIN = today?.daily_goal || 30;
              const todayMinutes = today?.today_minutes || 0;
              const pct = today?.goal_percentage ?? Math.min(100, (todayMinutes / DAILY_GOAL_MIN) * 100);
              const RADIUS = 26; const CIRC = 2 * Math.PI * RADIUS;
              const dash = (pct / 100) * CIRC;
              return (
                <div className="flex items-center gap-4 pl-3 pr-5 py-3 rounded-2xl flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 8px 32px -8px rgba(0,0,0,0.3)' }}>
                  <div className="relative w-14 h-14 flex-shrink-0">
                    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 60 60">
                      <circle cx="30" cy="30" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
                      <circle cx="30" cy="30" r={RADIUS} fill="none" stroke="url(#tdGrad)" strokeWidth="3.5"
                        strokeLinecap="round" strokeDasharray={`${dash} ${CIRC}`}
                        style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
                      <defs>
                        <linearGradient id="tdGrad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#FCD34D" />
                          <stop offset="100%" stopColor="#F97316" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                      <span className="text-[14px] font-extrabold text-white tabular-nums">{Math.round(pct)}</span>
                      <span className="text-[8px] font-semibold text-white/50 mt-0.5">%</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 leading-none">
                    <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/55">Mục tiêu hôm nay</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-extrabold text-white tabular-nums leading-none">{todayMinutes}</span>
                      <span className="text-xs font-medium text-white/55 leading-none">/ {DAILY_GOAL_MIN} phút</span>
                    </div>
                    {streak > 0 ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Flame className="w-3 h-3" style={{ color: '#FB923C' }} strokeWidth={2.6} fill="#FB923C" fillOpacity={0.25} />
                        <span className="text-[10px] font-semibold text-orange-200/90 tabular-nums leading-none">{streak} ngày liên tiếp</span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-medium text-white/40 leading-none mt-0.5">Bắt đầu chuỗi học</span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
          {isNewUser ? (
            <div className="flex items-center gap-3 flex-wrap">
              <Link to="/hoc-vien/bai-tap"
                className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)' }}>
                <Play className="w-4 h-4 fill-white" />Bắt đầu bài thi đầu tiên<ChevronRight className="w-4 h-4" />
              </Link>
              <Link to="/hoc-vien/luyen-tap"
                className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-semibold text-teal-100 hover:text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}>
                Luyện tập thử
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { label: 'Tiến độ',      value: `${Math.round(overallProgress)}%`,              color: '#5EEAD4' },
                { label: 'Bài hoàn thành', value: gam?.stats.lessons_completed || 0,            color: '#34D399' },
                { label: 'Điểm TB',      value: `${Math.round(gam?.stats.average_score || 0)}%`, color: '#60A5FA' },
                { label: 'Giờ học',      value: `${studyHours}h`,                                color: '#FBBF24' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <span className="text-lg font-extrabold tabular-nums" style={{ color: s.color }}>{s.value}</span>
                  <span className="text-xs font-semibold text-teal-100">{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ Main content ═════════════════════════════════════════════════════════ */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-rose-200 bg-rose-50">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-rose-900">Có lỗi xảy ra</p>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
            <button onClick={() => window.location.reload()}
              className="text-xs font-semibold text-rose-700 hover:text-rose-900 underline underline-offset-2 flex-shrink-0">
              Tải lại
            </button>
          </div>
        )}

        {/* Mục tiêu lớp sắp tới */}
        <NextGoalCard ageGroup="teens" />

        {/* Quick Actions */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { icon: ClipboardList, label: 'Bài tập',   sub: pendingAssignments.length > 0 ? `${pendingAssignments.length} đang chờ` : 'Bài được giao', href: '/hoc-vien/bai-tap',  color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
            { icon: BookOpenCheck, label: 'Luyện tập', sub: 'Ôn luyện theo kỹ năng',   href: '/hoc-vien/luyen-tap', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
            { icon: TrendingUp,    label: 'Tiến độ',   sub: 'Xem lịch sử học',         href: '/hoc-vien/tien-do',   color: INDIGO,    bg: INDIGO_LIGHT, border: '#99F6E4' },
            { icon: Target,        label: 'Lịch sử',   sub: 'Kết quả bài đã làm',      href: '/hoc-vien/lich-su',   color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD' },
          ] as const).map(a => {
            const Icon = a.icon;
            return (
              <Link key={a.label} to={a.href}
                className="flex items-center gap-3 p-4 rounded-2xl bg-white hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.97]"
                style={{ border: `1.5px solid ${a.border}`, boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: a.bg }}>
                  <Icon className="w-5 h-5" style={{ color: a.color }} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 leading-tight">{a.label}</p>
                  <p className="text-xs text-slate-500 leading-tight truncate">{a.sub}</p>
                </div>
                <ChevronRight className="w-4 h-4 ml-auto flex-shrink-0 text-slate-300" />
              </Link>
            );
          })}
        </section>

        {/* Main grid: left 3/5 + right 2/5 */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* LEFT */}
          <div className="lg:col-span-3 space-y-6">

            {/* Next test card */}
            {nextAction ? (
              <section className="relative rounded-3xl overflow-hidden group hover:-translate-y-0.5 transition-all duration-300"
                style={{ border: nextAction.kind === 'resume' ? '1.5px solid #FECACA' : '1.5px solid #CCFBF1', boxShadow: nextAction.kind === 'resume' ? '0 4px 24px rgba(239,68,68,0.15)' : '0 4px 24px rgba(13,148,136,0.10)' }}>
                {nextAction.kind === 'resume' && (
                  <div className="flex items-center gap-2 px-4 py-2 animate-pulse" style={{ background: '#FEF2F2' }}>
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500 flex-shrink-0" style={{ boxShadow: '0 0 0 3px rgba(239,68,68,0.25)' }} />
                    <span className="text-[12px] font-bold text-red-700">⏱ Bài thi đang chạy — đồng hồ vẫn đếm!</span>
                    <span className="ml-auto text-[12px] font-extrabold tabular-nums" style={{ color: '#DC2626' }}>Còn {nextAction.minutesLeft} phút</span>
                  </div>
                )}
                <div className="relative px-6 pt-6 pb-5 overflow-hidden"
                  style={{ background: nextAction.kind === 'resume' ? 'linear-gradient(135deg, #FEF2F2, #FFF1F2)' : `linear-gradient(135deg, ${INDIGO}18, #14B8A610)` }}>
                  <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-20 pointer-events-none"
                    style={{ background: nextAction.kind === 'resume' ? 'radial-gradient(circle, #EF4444, transparent)' : `radial-gradient(circle, ${INDIGO}, transparent)` }} />
                  <div className="relative z-10 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
                      style={{ background: nextAction.kind === 'resume' ? 'linear-gradient(135deg, #EF4444, #F97316)' : `linear-gradient(135deg, ${INDIGO}, ${INDIGO_MID})` }}>
                      <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[11px] font-bold tracking-widest uppercase"
                          style={{ color: nextAction.kind === 'resume' ? '#DC2626' : INDIGO_MID }}>{eyebrow}</p>
                        {nextAction.kind === 'start' && nextAction.isUrgent && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                            <AlertCircle className="w-3 h-3" /> Sắp hết hạn
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-extrabold leading-snug truncate" style={{ color: '#0F2A28' }}>{nextAction.title}</h3>
                    </div>
                  </div>
                </div>
                <div className="bg-white px-6 py-4 flex items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {nextAction.examType && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full font-semibold text-[11px]"
                        style={{ background: nextAction.kind === 'resume' ? '#FEE2E2' : INDIGO_LIGHT, color: nextAction.kind === 'resume' ? '#DC2626' : INDIGO }}>
                        {nextAction.examType}
                      </span>
                    )}
                    {nextAction.skill && nextAction.skill !== 'mixed' && <span className="text-slate-500 capitalize">{nextAction.skill}</span>}
                    {nextAction.kind === 'resume' && nextAction.totalQuestions > 0 && (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[11px] px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Đã làm {nextAction.answeredQuestions}/{nextAction.totalQuestions} câu
                      </span>
                    )}
                    {nextAction.kind === 'start' && nextAction.durationMin > 0 && <span className="text-slate-500">{nextAction.durationMin} phút</span>}
                    {nextAction.kind === 'start' && nextAction.daysUntil > 0 && (
                      <span className="font-semibold" style={{ color: nextAction.daysUntil <= 2 ? '#EF4444' : '#94A3B8' }}>Hạn còn {nextAction.daysUntil} ngày</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {nextAction.kind === 'resume' && (
                      <button
                        type="button"
                        onClick={() => handleResetSession(nextAction.id, nextAction.examType, nextAction.submissionId)}
                        disabled={isResetting}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                      >
                        Làm lại từ đầu
                      </button>
                    )}
                    <Link to={nextAction.routeUrl}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white flex-shrink-0 transition-all hover:gap-3 active:scale-[0.97]"
                      style={{ background: nextAction.kind === 'resume' ? 'linear-gradient(135deg, #EF4444, #F97316)' : `linear-gradient(135deg, ${INDIGO}, ${INDIGO_MID})`, boxShadow: nextAction.kind === 'resume' ? '0 4px 14px rgba(239,68,68,0.4)' : `0 4px 14px ${INDIGO}45` }}>
                      <Play className="w-3.5 h-3.5 fill-white" />{ctaLabel}<ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </section>
            ) : (
              <section className="relative rounded-3xl overflow-hidden"
                style={{ border: isNewUser ? '1.5px solid #DBEAFE' : '1.5px solid #CCFBF1', boxShadow: '0 2px 12px rgba(13,148,136,0.07)' }}>
                {isNewUser ? (
                  <div className="px-6 py-8 text-center" style={{ background: 'linear-gradient(135deg, #EFF6FF, #EEF2FF)' }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      style={{ background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO_MID})` }}>
                      <Play className="w-7 h-7 text-white fill-white ml-0.5" />
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900">Sẵn sàng cho bài thi đầu tiên?</h3>
                    <p className="text-sm text-slate-500 mt-1">Khám phá các bài thi tiếng Anh được giao bởi giáo viên.</p>
                    <div className="flex items-center justify-center gap-3 mt-5">
                      <Link to="/hoc-vien/bai-tap"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white transition-all"
                        style={{ background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO_MID})`, boxShadow: `0 4px 14px ${INDIGO}35` }}>
                        Xem bài tập <ChevronRight className="w-4 h-4" />
                      </Link>
                      <Link to="/hoc-vien/luyen-tap"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                        style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0' }}>
                        Luyện tập thử
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="px-6 py-8 text-center" style={{ background: `linear-gradient(135deg, ${INDIGO_LIGHT}, #E0F2FE)` }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      style={{ background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO_MID})` }}>
                      <CheckCircle2 className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-base font-extrabold" style={{ color: '#0F2A28' }}>Bạn đã hoàn thành tất cả bài thi</h3>
                    <p className="text-sm text-slate-500 mt-1">{completedCount > 0 ? `Đã hoàn thành ${completedCount} bài. Tiếp tục luyện tập!` : 'Hãy luyện tập để giữ vững kiến thức.'}</p>
                    <Link to="/hoc-vien/luyen-tap"
                      className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-2xl text-sm font-bold text-white transition-all"
                      style={{ background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO_MID})`, boxShadow: `0 4px 14px ${INDIGO}40` }}>
                      Đi đến luyện tập <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                )}
              </section>
            )}

            {/* Progress section */}
            <section className="rounded-3xl overflow-hidden hover:-translate-y-0.5 transition-all duration-300"
              style={{ border: '1.5px solid #CCFBF1', boxShadow: '0 2px 12px rgba(13,148,136,0.07)' }}>
              <div className="relative px-6 py-5 overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${INDIGO}18, #14B8A610)` }}>
                <div className="absolute -top-5 -right-5 w-24 h-24 rounded-full opacity-20 pointer-events-none"
                  style={{ background: `radial-gradient(circle, ${INDIGO_MID}, transparent)` }} />
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO_MID})` }}>
                      <TrendingUp className="w-[18px] h-[18px] text-white" strokeWidth={2.2} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: INDIGO_MID }}>Tổng quan</p>
                      <h2 className="text-sm font-extrabold leading-tight" style={{ color: '#0F2A28' }}>Tiến độ học tập</h2>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full" style={{ background: INDIGO_LIGHT, color: INDIGO }}>Tháng này</span>
                </div>
              </div>
              <div className="bg-white px-6 py-5">
                {isNewUser ? (
                  <div className="flex flex-col items-center text-center py-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: INDIGO_LIGHT }}>
                      <Target className="w-5 h-5" style={{ color: INDIGO }} strokeWidth={2} />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">Hoàn thành bài đầu tiên để mở khóa tiến độ</p>
                    <p className="text-xs text-slate-400 mt-1">Tiến độ của bạn sẽ hiển thị tại đây</p>
                    <Link to="/hoc-vien/bai-tap"
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all"
                      style={{ background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO_MID})` }}>
                      Bắt đầu ngay <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <ProgressRow label="Hoàn thành khóa học"    current={gam?.stats.lessons_completed || 0}  total={50} />
                    <ProgressRow label="Bài đánh giá đã làm"   current={gam?.stats.exams_taken || 0}        total={20} />
                    <ProgressRow label="Phiên luyện tập"       current={gam?.stats.practice_sessions || 0}  total={30} />
                    <ProgressRow label="Thành tích đã mở khóa" current={gam?.achievements.completed || 0}   total={gam?.achievements.total || 10} />
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-2 space-y-5">

            {/* Reminders */}
            {visibleReminders.length > 0 && (
              <section className="rounded-3xl overflow-hidden"
                style={{ background: '#fff', border: '1.5px solid #CCFBF1', boxShadow: '0 4px 24px rgba(13,148,136,0.10)' }}>
                <div className="relative flex items-center justify-between px-5 py-3.5 overflow-hidden"
                  style={{ background: `linear-gradient(135deg, #134E4A, ${INDIGO})` }}>
                  <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-25 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, #5EEAD4, transparent)' }} />
                  <div className="relative z-10 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(165,180,252,0.25)' }}>
                      <Bell className="w-3.5 h-3.5 text-teal-100" strokeWidth={2.5} />
                    </div>
                    <span className="text-sm font-semibold text-white leading-tight">
                      {teacherItems.length > 0 ? 'Giáo viên nhắc nhở' : 'Bài tập sắp đến hạn'}
                    </span>
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold"
                      style={{ background: 'rgba(255,255,255,0.22)', color: '#fff' }}>{totalReminders}</span>
                  </div>
                  <Link to="/hoc-vien/bai-tap"
                    className="relative z-10 text-[11px] font-medium text-teal-100 hover:text-white transition-colors flex items-center gap-0.5">
                    Tất cả <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="py-0.5">
                  {visibleReminders.map((item, idx) => {
                    const isUrgent = item.isUrgent || item.daysUntil <= 1;
                    const isWarn   = !isUrgent && item.daysUntil <= 3;
                    const isDismissing = dismissingId === item.reminderId;
                    const accentColor = isUrgent ? '#EF4444' : isWarn ? '#F97316' : INDIGO_MID;
                    const ctaBg = isUrgent ? '#EF4444' : `linear-gradient(135deg, ${INDIGO}, ${INDIGO_MID})`;
                    return (
                      <div key={item.key}
                        className="group relative flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors duration-150"
                        style={{ borderBottom: idx < visibleReminders.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                        <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                          style={{ background: accentColor, opacity: isUrgent || isWarn ? 1 : 0.35 }} />
                        <div className="flex-1 min-w-0 pl-1">
                          <p className="text-[13px] font-semibold text-slate-800 truncate leading-snug">{item.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {item.type && <span className="text-[11px] text-slate-400">{item.type}</span>}
                            {item.duration ? <span className="text-[11px] text-slate-300">· {item.duration}ph</span> : null}
                            <span className="text-[11px] font-semibold ml-1" style={{ color: accentColor }}>
                              {formatDeadline(item.deadline, item.daysUntil)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Link to={`/hoc-vien/phong-cho/${item.assignmentId}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white transition-all hover:opacity-90 active:scale-95"
                            style={{ background: ctaBg }}>
                            Làm bài <ArrowRight className="w-3 h-3" />
                          </Link>
                          {item.fromTeacher && item.reminderId && (
                            <button onClick={() => handleDismiss(item)} disabled={isDismissing}
                              className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center text-slate-300 hover:text-slate-500 disabled:opacity-30 rounded-md hover:bg-slate-100">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <div className="space-y-4">
              {/* Skill breakdown */}
              <section className="rounded-3xl overflow-hidden hover:-translate-y-0.5 transition-all duration-300"
                style={{ border: '1.5px solid #CCFBF1', boxShadow: '0 2px 12px rgba(13,148,136,0.07)' }}>
                <div className="relative px-4 py-3.5 overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${INDIGO}18, #14B8A610)` }}>
                  <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-20 pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${INDIGO_MID}, transparent)` }} />
                  <div className="relative z-10 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO_MID})` }}>
                      <BarChart3 className="w-3.5 h-3.5 text-white" strokeWidth={2.2} />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold tracking-widest uppercase" style={{ color: INDIGO_MID }}>Kỹ năng</p>
                      <h2 className="text-xs font-extrabold leading-tight" style={{ color: '#0F2A28' }}>Điểm theo kỹ năng</h2>
                    </div>
                  </div>
                </div>
                <div className="bg-white px-4 py-3 space-y-2.5">
                  {([
                    { key: 'listening', label: 'Listening', icon: Headphones,    color: '#3B82F6', bg: '#EFF6FF' },
                    { key: 'reading',   label: 'Reading',   icon: BookOpenCheck, color: '#10B981', bg: '#ECFDF5' },
                    { key: 'writing',   label: 'Writing',   icon: PenLine,       color: '#8B5CF6', bg: '#F3E8FF' },
                    { key: 'speaking',  label: 'Speaking',  icon: Mic,           color: '#F97316', bg: '#FFF7ED' },
                  ] as const).map(s => {
                    const Icon = s.icon;
                    const stat = skillStats?.[s.key];
                    const score = Math.round(stat?.average_score || 0);
                    const attempts = stat?.attempts || 0;
                    return (
                      <div key={s.key} className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
                          <Icon className="w-3.5 h-3.5" style={{ color: s.color }} strokeWidth={2.2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-[11px] font-semibold text-slate-700 leading-tight">{s.label}</span>
                            <span className="text-[11px] font-bold tabular-nums"
                              style={{ color: attempts > 0 ? s.color : '#CBD5E1' }}>
                              {attempts > 0 ? `${score}%` : '—'}
                            </span>
                          </div>
                          <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${attempts > 0 ? score : 0}%`, background: s.color }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(!skillStats || Object.values(skillStats).every(s => (s?.attempts || 0) === 0)) && (
                    <p className="text-[10px] text-slate-400 text-center pt-1 leading-tight">Làm bài thi để xem điểm theo kỹ năng</p>
                  )}
                </div>
              </section>

              {/* Streak */}
              <section className="rounded-3xl overflow-hidden hover:-translate-y-0.5 transition-all duration-300"
                style={{ border: '1.5px solid #CCFBF1', boxShadow: '0 2px 12px rgba(13,148,136,0.07)' }}>
                <div className="relative px-4 py-3.5 overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${INDIGO}18, #14B8A610)` }}>
                  <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-20 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, #FBBF24, transparent)' }} />
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}>
                        <Flame className="w-3.5 h-3.5 text-white" strokeWidth={2.2} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold tracking-widest uppercase" style={{ color: INDIGO_MID }}>Hoạt động</p>
                        <h2 className="text-xs font-extrabold leading-tight" style={{ color: '#0F2A28' }}>Đều đặn</h2>
                      </div>
                    </div>
                    {streak > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#92400E' }}>🔥{streak}</span>
                    )}
                  </div>
                </div>
                <div className="bg-white px-4 py-1.5 divide-y divide-slate-100">
                  <KeyValue label="Hiện tại"  value={`${streak} ngày`}                        highlight={streak > 0} />
                  <KeyValue label="Dài nhất"  value={`${gam?.streak.longest || 0} ngày`} />
                  <KeyValue label="Tổng ngày" value={gam?.streak.total_active_days || 0} />
                </div>
              </section>

              {/* Tip */}
              <section className="rounded-3xl overflow-hidden"
                style={{ background: '#FFFDF0', border: '1.5px solid #FEF3C7', boxShadow: '0 2px 12px rgba(251,191,36,0.10)' }}>
                <div className="px-5 py-5">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#FEF3C7' }}>
                      <Sparkles className="w-4 h-4" style={{ color: '#D97706' }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: '#92400E' }}>Mẹo cho bạn</p>
                      <p className="text-xs leading-relaxed mt-1" style={{ color: '#A16207' }}>
                        Học <span className="font-bold" style={{ color: '#92400E' }}>30 phút mỗi ngày</span> hiệu quả hơn 4 tiếng cuối tuần. Hãy đặt lời nhắc cố định mỗi ngày.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* News feed: kỳ thi THPT Quốc gia - moved to bottom */}
        <ExamNewsFeed topic="thpt-quoc-gia" limit={8} />

      </div>
    </div>
  );
}

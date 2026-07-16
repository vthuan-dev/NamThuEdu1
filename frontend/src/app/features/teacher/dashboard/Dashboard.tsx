import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { usePageTitle, PAGE_TITLES } from "../../../../hooks/usePageTitle";
import { api } from "../../../../services/api";
import { getAuthUser } from "../../../../utils/authStorage";
import { usePageHeader } from "../../../../contexts/TeacherHeaderContext";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  FileText,
  TrendingUp,
  FileEdit,
  GraduationCap,
  Send,
  BarChart2,
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
  ClipboardList,
  ListChecks,
  Activity,
  CalendarDays,
  Plus,
  ArrowRight,
} from "lucide-react";

// Fallback data removed — now using real activity logs from API

const ACTION_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; label: string }> = {
  'exam.create':       { icon: FileEdit, color: '#2563EB', bg: '#EFF6FF', label: 'Tạo đề thi' },
  'exam.update':       { icon: FileEdit, color: '#6366F1', bg: '#EEF2FF', label: 'Sửa đề thi' },
  'exam.delete':       { icon: FileText, color: '#EF4444', bg: '#FEF2F2', label: 'Xoá đề thi' },
  'exam.duplicate':    { icon: FileText, color: '#8B5CF6', bg: '#F5F3FF', label: 'Nhân bản đề' },
  'exam.import':       { icon: FileText, color: '#0891B2', bg: '#ECFEFF', label: 'Import đề' },
  'assignment.create': { icon: Send, color: '#10B981', bg: '#F0FDF4', label: 'Giao bài' },
  'grading.complete':  { icon: CheckCircle2, color: '#F59E0B', bg: '#FFFBEB', label: 'Chấm điểm' },
  'grading.review':    { icon: CheckCircle2, color: '#F59E0B', bg: '#FFFBEB', label: 'Xem lại điểm' },
  'student.add':       { icon: Users, color: '#10B981', bg: '#F0FDF4', label: 'Thêm học viên' },
  'student.update':    { icon: Users, color: '#6366F1', bg: '#EEF2FF', label: 'Sửa học viên' },
  'student.delete':    { icon: Users, color: '#EF4444', bg: '#FEF2F2', label: 'Xoá học viên' },
  'student.import':    { icon: Users, color: '#0891B2', bg: '#ECFEFF', label: 'Import học viên' },
  'blog.create':       { icon: FileEdit, color: '#8B5CF6', bg: '#F5F3FF', label: 'Nháp bài viết' },
  'blog.publish':      { icon: FileEdit, color: '#10B981', bg: '#F0FDF4', label: 'Đăng bài' },
  'profile.update':    { icon: GraduationCap, color: '#6366F1', bg: '#EEF2FF', label: 'Cập nhật hồ sơ' },
};

interface SubmissionTypePoint {
  exam_type: string;
  label: string;
  adults: number;
  teens: number;
  kids: number;
  total: number;
}

interface SubmissionTypeMeta {
  total: number;
  adults: number;
  teens: number;
  kids: number;
  date: string;
  timezone: string;
}

export function Dashboard() {
  usePageTitle(PAGE_TITLES.TEACHER_DASHBOARD);
  const { t } = useTranslation();
  const navigate = useNavigate();

  usePageHeader({
    breadcrumb: [t("breadcrumb.dashboard"), t("breadcrumb.home")],
    action: { label: t("header.new"), onClick: () => navigate("/giao-vien/de-thi/tao-moi") },
  });
  const [mounted, setMounted] = useState(false);

  const user = getAuthUser();
  const userName = (user?.name as string) || (user?.uName as string) || 'Teacher';
  const userAvatar = (user?.avatar_url as string) || (user?.avatar as string) || '';

  // Build full avatar URL with fallback
  const heroAvatarUrl = (() => {
    if (!userAvatar) return '';
    if (userAvatar.startsWith('http://') || userAvatar.startsWith('https://')) return userAvatar;
    const baseUrl = (import.meta.env.VITE_API_URL as string ?? '')
      .replace(/\/api\/?$/, '')
      .replace(/\/$/, '');
    if (!baseUrl) return '';
    return userAvatar.startsWith('/') ? `${baseUrl}${userAvatar}` : `${baseUrl}/${userAvatar}`;
  })();
  const userInitials = userName
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Fetch dashboard statistics with 30-second polling
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [chartData, setChartData] = useState<SubmissionTypePoint[]>([]);
  const [chartMeta, setChartMeta] = useState<SubmissionTypeMeta | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState(false);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [activityLogsLoading, setActivityLogsLoading] = useState(true);

  // Fetch teacher activity logs (từ activity-log API)
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const { fetchTeacherActivityLogs } = await import("../../../../services/teacherActivityLog");
        const logs = await fetchTeacherActivityLogs(10);
        setActivityLogs(logs);
      } catch (err) {
        console.error('Error fetching activity logs:', err);
      } finally {
        setActivityLogsLoading(false);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const { data: result } = await api.get('/teacher/dashboard/overview');
        if (result.status === 'success') {
          setDashboardStats(result.data);
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchDashboardStats();
    const interval = setInterval(fetchDashboardStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Fetch today's submitted attempts by exam type and student age group.
  useEffect(() => {
    let cancelled = false;
    const fetchChart = async () => {
      try {
        const { data: result } = await api.get('/teacher/dashboard/today-submissions-by-type');
        if (!cancelled && result.status === 'success') {
          setChartData(result.data || []);
          setChartMeta(result.meta || null);
          setChartError(false);
        }
      } catch (error) {
        console.error('Error fetching activity chart:', error);
        if (!cancelled) setChartError(true);
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    };

    setChartLoading(true);
    fetchChart();
    const interval = setInterval(fetchChart, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t('teacher.dashboard.time.morning') : hour < 18 ? t('teacher.dashboard.time.afternoon') : t('teacher.dashboard.time.evening');
  const greetingEmoji = hour < 12 ? "☀️" : hour < 18 ? "🌤️" : "🌙";

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const stats = [
    {
      icon: Users,
      label: "Học viên đang theo học",
      value: statsLoading ? "..." : (dashboardStats?.total_students?.toString() || "0"),
      subtitle: statsLoading
        ? ""
        : `+${dashboardStats?.new_students_this_month || 0} trong tháng`,
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-500",
      href: "/giao-vien/students",
      delay: "0ms",
    },
    {
      icon: FileText,
      label: "Đề thi đã tạo",
      value: statsLoading ? "..." : (dashboardStats?.total_exams?.toString() || "0"),
      subtitle: statsLoading
        ? ""
        : `+${dashboardStats?.new_exams_this_month || 0} trong tháng`,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
      href: "/giao-vien/de-thi",
      delay: "80ms",
    },
    {
      icon: ClipboardList,
      label: "Bài đã giao",
      value: statsLoading ? "..." : (dashboardStats?.total_assignments?.toString() || "0"),
      subtitle: statsLoading
        ? ""
        : `+${dashboardStats?.new_assignments_this_month || 0} trong tháng`,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
      href: "/giao-vien/de-thi",
      delay: "160ms",
    },
  ];

  // Card thứ 4 (Lượt làm bài) có layout đặc biệt — tách riêng để render UI khác
  const submissionsStat = {
    completed: Number(dashboardStats?.completed_submissions ?? 0),
    expected: Number(dashboardStats?.expected_submissions ?? 0),
    pending: Number(dashboardStats?.pending_submissions ?? 0),
    rate: Number(dashboardStats?.completion_rate ?? 0),
  };

  const quickActions = [
    {
      icon: FileEdit,
      titleKey: "dashboard.quickActions.createExam",
      descKey: "dashboard.quickActions.createExamDesc",
      href: "/giao-vien/de-thi/tao-moi",
      primary: true,
    },
    {
      icon: GraduationCap,
      titleKey: "dashboard.quickActions.cambridgeTemplate",
      descKey: "dashboard.quickActions.cambridgeTemplateDesc",
      href: "/mau-de-cambridge",
      primary: false,
    },
    {
      icon: Send,
      titleKey: "dashboard.quickActions.assignTest",
      descKey: "dashboard.quickActions.assignTestDesc",
      href: "/giao-vien/de-thi",
      primary: false,
    },
    {
      icon: BarChart2,
      titleKey: "dashboard.quickActions.viewReports",
      descKey: "dashboard.quickActions.viewReportsDesc",
      href: "/cham-diem",
      primary: false,
    },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto bg-[#F9FAFB]">
        {/* ── Hero Banner ── */}
        <div
          className="relative border-b border-gray-200 bg-white px-8 py-6 overflow-hidden"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 400ms ease, transform 400ms ease",
          }}
        >
          {/* Subtle gradient blob background */}
          <div
            className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full opacity-40"
            style={{
              background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0) 70%)",
            }}
          />

          <div className="relative flex items-center justify-between gap-6 flex-wrap">
            {/* LEFT: Avatar + Greeting + Name */}
            <div className="flex items-center gap-4 min-w-0">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {heroAvatarUrl ? (
                  <img
                    src={heroAvatarUrl}
                    alt={userName}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-md"
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-base font-bold border-2 border-white shadow-md"
                    style={{ background: "linear-gradient(135deg,#6366F1,#4338CA)" }}
                  >
                    {userInitials}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" />
              </div>

              {/* Text */}
              <div className="min-w-0">
                <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5 mb-0.5">
                  <CalendarDays className="w-3 h-3" />
                  <span>{greetingEmoji}</span>
                  <span>{greeting}</span>
                  <span className="text-slate-300">·</span>
                  <span className="capitalize">
                    {new Date().toLocaleDateString("vi-VN", {
                      weekday: "long",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </span>
                </p>
                <h1 className="text-slate-900 text-[22px] font-bold tracking-tight leading-tight truncate">
                  {userName}
                </h1>
                <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[10px] font-bold tracking-wide uppercase">
                  <GraduationCap className="w-3 h-3" />
                  Giáo viên
                </span>
              </div>
            </div>

            {/* RIGHT: Mini stat tiles + Primary CTA */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <HeroStatTile
                icon={Clock}
                value={statsLoading ? "..." : (dashboardStats?.classes_today ?? 0).toString()}
                label="Buổi hôm nay"
                tone="indigo"
              />
              <HeroStatTile
                icon={AlertCircle}
                value={statsLoading ? "..." : (dashboardStats?.pending_grading ?? 0).toString()}
                label="Cần chấm"
                tone="amber"
                pulse={(dashboardStats?.pending_grading ?? 0) > 0}
                onClick={() => navigate("/giao-vien/cham-diem")}
              />
              <HeroStatTile
                icon={CheckCircle2}
                value={statsLoading ? "..." : (dashboardStats?.deadlines_this_week ?? 0).toString()}
                label="Deadline tuần"
                tone="emerald"
              />

              {/* Divider */}
              <div className="w-px h-10 bg-gray-200 mx-1 hidden md:block" />

              {/* Primary CTA */}
              <button
                onClick={() => navigate("/giao-vien/de-thi/tao-moi")}
                className="group flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl pl-4 pr-3.5 h-11 transition-all hover:-translate-y-0.5 hover:shadow-lg shadow-slate-900/10"
                style={{ fontSize: "13px", fontWeight: 600 }}
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
                Tạo đề mới
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Stats Cards (compact) ── */}
        <div className="px-8 pt-6 mb-6">
          <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2">
            {/* 3 metric cards: Học viên / Đề thi / Bài đã giao */}
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <button
                  key={stat.label}
                  type="button"
                  onClick={() => navigate(stat.href)}
                  className="group flex items-center gap-3 text-left bg-white rounded-xl px-4 py-3 border border-gray-200 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer"
                  style={{
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? "translateY(0)" : "translateY(8px)",
                    transition: `opacity 350ms ease ${stat.delay}, transform 350ms ease ${stat.delay}`,
                  }}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${stat.iconBg}`}>
                    <Icon className={`w-4 h-4 ${stat.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-slate-900 tabular-nums" style={{ fontSize: "20px", fontWeight: 700, lineHeight: "1" }}>
                        {stat.value}
                      </span>
                      {stat.subtitle && (
                        <span className="text-emerald-600 text-[10px] font-semibold whitespace-nowrap">
                          {stat.subtitle.replace(" trong tháng", "")}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 mt-0.5 truncate text-[12px] font-medium">
                      {stat.label}
                    </p>
                  </div>
                </button>
              );
            })}

            {/* Card 4: Lượt làm bài — compact với progress bar */}
            <button
              type="button"
              onClick={() => navigate("/giao-vien/cham-diem")}
              className="group flex items-center gap-3 text-left bg-white rounded-xl px-4 py-3 border border-gray-200 hover:border-emerald-200 hover:shadow-sm transition-all cursor-pointer"
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? "translateY(0)" : "translateY(8px)",
                transition: "opacity 350ms ease 240ms, transform 350ms ease 240ms",
              }}
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <ListChecks className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1 tabular-nums">
                  <span className="text-slate-900" style={{ fontSize: "20px", fontWeight: 700, lineHeight: "1" }}>
                    {statsLoading ? "..." : submissionsStat.completed}
                  </span>
                  <span className="text-slate-400 text-[13px] font-semibold">
                    /{statsLoading ? "..." : submissionsStat.expected}
                  </span>
                  <span className="ml-auto text-emerald-600 text-[10px] font-bold">
                    {statsLoading ? "" : `${submissionsStat.rate}%`}
                  </span>
                </div>
                <p className="text-slate-500 mt-0.5 truncate text-[12px] font-medium">
                  Lượt làm bài
                </p>
                {!statsLoading && submissionsStat.expected > 0 && (
                  <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, submissionsStat.rate)}%` }}
                    />
                  </div>
                )}
                <p className="text-[10px] text-slate-400 mt-1 font-normal leading-tight block">
                  Số bài đã nộp / tổng số bài đã giao
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* ── Bento Grid ── */}
        <div className="px-8 pb-6">
          <div
            className="grid gap-5 mb-5"
            style={{ gridTemplateColumns: "1fr 380px" }}
          >
            {/* ── Today's submissions by exam type and student group ── */}
            <div
              className="bg-white rounded-2xl p-6 shadow-sm"
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? "translateY(0)" : "translateY(16px)",
                transition: "opacity 500ms ease 300ms, transform 500ms ease 300ms",
              }}
            >
              <div className="flex items-start justify-between mb-5 gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <Activity className="w-3.5 h-3.5 text-indigo-500" />
                    </div>
                    <h3 className="text-[#111827]" style={{ fontSize: "16px", fontWeight: 700 }}>
                      Bài thi học viên đã nộp hôm nay
                    </h3>
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-bold tracking-wide">
                      TOÀN HỆ THỐNG
                    </span>
                  </div>
                  <p className="text-[#9CA3AF]" style={{ fontSize: "12px" }}>
                    Số lượt nộp theo loại đề và nhóm học viên · Giờ Việt Nam
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 flex-shrink-0">
                  {chartMeta?.date
                    ? chartMeta.date.split("-").reverse().join("/")
                    : "Hôm nay"}
                </span>
              </div>

              {/* Summary chips */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <ChartSummaryChip
                  label="Tổng lượt nộp"
                  value={chartLoading ? "..." : (chartMeta?.total ?? 0).toString()}
                  accentClass="bg-indigo-500"
                />
                <ChartSummaryChip
                  label="Adults"
                  value={chartLoading ? "..." : (chartMeta?.adults ?? 0).toString()}
                  accentClass="bg-blue-500"
                />
                <ChartSummaryChip
                  label="Teens"
                  value={chartLoading ? "..." : (chartMeta?.teens ?? 0).toString()}
                  accentClass="bg-emerald-500"
                />
                <ChartSummaryChip
                  label="Kids"
                  value={chartLoading ? "..." : (chartMeta?.kids ?? 0).toString()}
                  accentClass="bg-orange-500"
                />
              </div>

              {/* Chart */}
              <div className="h-[280px] -ml-2">
                {chartLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
                  </div>
                ) : chartError ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
                      <AlertCircle className="w-6 h-6 text-red-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">Không thể tải thống kê</p>
                    <p className="text-xs text-gray-400 mt-1">Hệ thống sẽ tự động thử lại sau 60 giây.</p>
                  </div>
                ) : chartData.length === 0 || chartData.every((d) => d.total === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                      <BarChart2 className="w-6 h-6 text-gray-300" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">Hôm nay chưa có bài nộp</p>
                    <p className="text-xs text-gray-400 mt-1 max-w-xs">
                      Biểu đồ sẽ cập nhật khi học viên thuộc nhóm Adults, Teens hoặc Kids nộp bài.
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 16, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#F3F4F6" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "#6B7280", fontSize: 11 }}
                        axisLine={{ stroke: "#E5E7EB" }}
                        tickLine={false}
                        interval={0}
                      />
                      <YAxis
                        tick={{ fill: "#9CA3AF", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                        width={32}
                        domain={[0, (dataMax: number) => Math.max(2, Math.ceil(dataMax * 1.15))]}
                      />
                      <Tooltip
                        content={<SubmissionTypeTooltip />}
                        cursor={{ fill: "rgba(99, 102, 241, 0.05)" }}
                      />
                      <Bar dataKey="adults" name="Adults" fill="#3B82F6" radius={[5, 5, 0, 0]} maxBarSize={26} />
                      <Bar dataKey="teens" name="Teens" fill="#10B981" radius={[5, 5, 0, 0]} maxBarSize={26} />
                      <Bar dataKey="kids" name="Kids" fill="#F97316" radius={[5, 5, 0, 0]} maxBarSize={26} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-between gap-4 mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                    Adults
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    Teens
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="w-2.5 h-2.5 rounded-sm bg-orange-500" />
                    Kids
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">Tự động cập nhật mỗi 60 giây</span>
              </div>
            </div>

            {/* ── Activity Feed (từ teacher_activity_logs) ── */}
            <div
              className="bg-white rounded-2xl p-6 shadow-sm flex flex-col"
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? "translateY(0)" : "translateY(16px)",
                transition: "opacity 500ms ease 380ms, transform 500ms ease 380ms",
              }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3
                  className="text-[#111827]"
                  style={{ fontSize: "17px", fontWeight: 700 }}
                >
                  Hoạt động gần đây
                </h3>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto" style={{ maxHeight: 360 }}>
                {activityLogsLoading ? (
                  <div className="space-y-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="flex items-start gap-3 p-3 animate-pulse">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex-shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-40 bg-gray-100 rounded" />
                          <div className="h-2 w-20 bg-gray-50 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : activityLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-2">
                      <Sparkles className="w-5 h-5 text-gray-300" />
                    </div>
                    <p className="text-xs font-semibold text-gray-600">Chưa có hoạt động</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Bắt đầu tạo đề thi, thêm học viên...</p>
                  </div>
                ) : (
                  activityLogs.map((log) => (
                    <ActivityLogItem key={log.id} log={log} />
                  ))
                )}
              </div>

              {/* Bottom summary */}
              <div className="mt-4 pt-3 border-t border-[#F3F4F6] flex items-center justify-between">
                <span className="text-[#9CA3AF]" style={{ fontSize: "11px" }}>
                  {activityLogs.length > 0
                    ? `${activityLogs.length} hành động gần nhất`
                    : "Tự động ghi lại khi bạn thao tác"}
                </span>
                <span
                  className="flex items-center gap-1 text-slate-400"
                  style={{ fontSize: "11px", fontWeight: 500 }}
                >
                  <TrendingUp className="w-3 h-3" />
                  Log tự động
                </span>
              </div>
            </div>
          </div>

          {/* ── Quick Actions Row ── */}
          <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2">
            {quickActions.map((action, i) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.titleKey}
                  onClick={() => navigate(action.href)}
                  className="relative group text-left bg-white rounded-xl p-5 border border-gray-200 hover:border-indigo-200 hover:shadow-sm transition-all duration-200"
                  style={{
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? "translateY(0)" : "translateY(12px)",
                    transition: `opacity 400ms ease ${i * 80 + 400}ms, transform 400ms ease ${i * 80 + 400}ms`,
                  }}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-4 ${action.primary ? 'bg-orange-500' : 'bg-indigo-50'}`}>
                    <Icon className={`w-4 h-4 ${action.primary ? 'text-white' : 'text-indigo-400'}`} />
                  </div>
                  <p className="text-slate-800 mb-1" style={{ fontSize: "14px", fontWeight: 600 }}>
                    {t(action.titleKey)}
                  </p>
                  <p className="text-slate-400" style={{ fontSize: "12px" }}>
                    {t(action.descKey)}
                  </p>
                  <ArrowUpRight className="absolute top-4 right-4 w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── Helper: Hero stat tile (mini metric card với icon trái, value/label phải) ─
function HeroStatTile({
  icon: Icon,
  value,
  label,
  tone,
  pulse = false,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
  tone: "indigo" | "amber" | "emerald";
  pulse?: boolean;
  onClick?: () => void;
}) {
  const toneStyles = {
    indigo: {
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-500",
      hoverBorder: "hover:border-indigo-200",
    },
    amber: {
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
      hoverBorder: "hover:border-amber-200",
    },
    emerald: {
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-500",
      hoverBorder: "hover:border-emerald-200",
    },
  }[tone];

  const isClickable = !!onClick;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      className={`relative flex items-center gap-2.5 bg-white border border-gray-200 rounded-xl pl-2.5 pr-3.5 py-2 transition-all ${
        isClickable
          ? `cursor-pointer hover:-translate-y-0.5 hover:shadow-sm ${toneStyles.hoverBorder}`
          : "cursor-default"
      }`}
    >
      <div className={`relative w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${toneStyles.iconBg}`}>
        <Icon className={`w-3.5 h-3.5 ${toneStyles.iconColor}`} />
        {pulse && (
          <span className="absolute -top-0.5 -right-0.5 flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-75" />
            <span className="relative w-2 h-2 rounded-full bg-amber-500" />
          </span>
        )}
      </div>
      <div className="text-left leading-none">
        <p className="text-slate-900 text-[15px] font-bold tabular-nums">{value}</p>
        <p className="text-slate-500 text-[10px] font-medium mt-0.5">{label}</p>
      </div>
    </button>
  );
}

// ─── Helper: ActivityLogItem (từng hàng trong feed) ──────────────────────
function relativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = Date.now();
  const diff = Math.max(0, now - d.getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Hôm qua";
  if (days < 7) return `${days} ngày trước`;
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function ActivityLogItem({ log }: { log: any }) {
  const config = ACTION_CONFIG[log.action] || {
    icon: Sparkles,
    color: "#6B7280",
    bg: "#F9FAFB",
    label: log.action,
  };
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 p-2.5 rounded-xl transition-colors hover:bg-indigo-50/40 cursor-default">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: config.bg }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#374151] leading-snug truncate" style={{ fontSize: "12px", fontWeight: 500 }}>
          {log.detail || config.label}
        </p>
        <p className="text-[#9CA3AF] mt-0.5" style={{ fontSize: "10px" }}>
          {relativeTime(log.created_at)}
        </p>
      </div>
    </div>
  );
}

// ─── Helper: Chart summary chip ──────────────────────────────────────────
function ChartSummaryChip({
  label,
  value,
  accentClass,
}: {
  label: string;
  value: string;
  accentClass: string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
      <span className={`w-1 h-8 rounded-full ${accentClass} flex-shrink-0`} />
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide truncate">
          {label}
        </p>
        <p className="text-[14px] font-bold text-slate-900 tabular-nums truncate">
          {value}
        </p>
      </div>
    </div>
  );
}

// ─── Helper: grouped submission chart tooltip ────────────────────────────
function SubmissionTypeTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const point: SubmissionTypePoint | undefined = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2.5 min-w-[170px]">
      <p className="text-[12px] font-bold text-slate-800 mb-2">{label}</p>
      {([
        ["Adults", point.adults, "bg-blue-500"],
        ["Teens", point.teens, "bg-emerald-500"],
        ["Kids", point.kids, "bg-orange-500"],
      ] as const).map(([group, count, color]) => (
        <div key={group} className="flex items-center justify-between gap-5 text-[12px] mt-1">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className={`w-2 h-2 rounded-sm ${color}`} />
            {group}
          </span>
          <span className="font-bold text-slate-900 tabular-nums">{count}</span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-5 text-[12px] mt-2 pt-1.5 border-t border-gray-100">
        <span className="font-semibold text-slate-600">Tổng lượt nộp</span>
        <span className="font-bold text-indigo-600 tabular-nums">{point.total}</span>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { usePageTitle, PAGE_TITLES } from "../../../../hooks/usePageTitle";
import {
  GraduationCap,
  Users,
  BookOpen,
  FileText,
  Activity,
  AlertTriangle,
  ChevronRight,
  Database,
  Cpu,
  HardDrive,
  Wifi,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { adminApi } from "@/services/adminApi";
import { AdminPageSkeleton } from "../components/AdminPageSkeleton";

type RoleStats = Record<string, { active: number; inactive: number; total: number }>;

export function AdminDashboard() {
  usePageTitle(PAGE_TITLES.ADMIN_DASHBOARD);
  const { t } = useTranslation();
  const d = "admin.dashboard";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [roleStats, setRoleStats] = useState<RoleStats>({});
  const [contentStats, setContentStats] = useState<Record<string, unknown> | null>(null);
  const [examStats, setExamStats] = useState<Record<string, unknown> | null>(null);
  const [lockedUsers, setLockedUsers] = useState(0);
  const [trendsReport, setTrendsReport] = useState<Record<string, unknown> | null>(null);
  const [systemHealth, setSystemHealth] = useState<Record<string, unknown> | null>(null);
  const [trafficPeriod, setTrafficPeriod] = useState<"7d" | "30d" | "90d">("7d");
  const [trafficData, setTrafficData] = useState<{ label: string; visits: number; users: number }[]>([]);
  const [trafficLoading, setTrafficLoading] = useState(false);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return t(`${d}.greetMorning`);
    if (h < 18) return t(`${d}.greetAfternoon`);
    return t(`${d}.greetEvening`);
  }, [t]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [dashboardData, roleStatsData, contentStatsData, examStatsData, lockedUsersData, trendsData, healthData] = await Promise.all([
          adminApi.getDashboardReport(),
          adminApi.getRoleStatistics(),
          adminApi.getContentStatistics(),
          adminApi.getExamStatistics(),
          adminApi.getLockedUsers(),
          adminApi.getTrendsReport("30d"),
          adminApi.getSystemHealth().catch(() => null),
        ]);
        setDashboard(dashboardData as unknown as Record<string, unknown>);
        setRoleStats(roleStatsData);
        setContentStats(contentStatsData);
        setExamStats(examStatsData);
        setLockedUsers(lockedUsersData.length);
        setTrendsReport(trendsData);
        setSystemHealth(healthData as unknown as Record<string, unknown> | null);
      } catch {
        setError(t(`${d}.loadError`));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadTraffic = async () => {
      setTrafficLoading(true);
      try {
        const periodMap: Record<string, string> = { "7d": "30d", "30d": "30d", "90d": "90d" };
        const res = await adminApi.getTrendsReport((periodMap[trafficPeriod] ?? "30d") as "30d" | "90d" | "1y" | "6m");
        const raw = res as Record<string, unknown>;
        if (Array.isArray(raw?.timeline) && (raw.timeline as unknown[]).length > 0) {
          const arr = raw.timeline as Array<Record<string, unknown>>;
          const sliceCount = trafficPeriod === "7d" ? 7 : trafficPeriod === "30d" ? 30 : 90;
          const sliced = arr.slice(-sliceCount);
          setTrafficData(sliced.map((p) => ({
            label: String(p.date ?? "").slice(5),
            visits: Number(p.submissions ?? 0),
            users:  Number(p.new_users ?? 0),
          })));
        } else {
          setTrafficData([]);
        }
      } catch {
        setTrafficData([]);
      } finally {
        setTrafficLoading(false);
      }
    };
    loadTraffic();
  }, [trafficPeriod]);

  const cards = useMemo(
    () => [
      {
        label: t(`${d}.cards.teachers`),
        value: roleStats.teacher?.total ?? 0,
        sub: t(`${d}.cards.teachersSub`, { count: roleStats.teacher?.active ?? 0 }),
        icon: GraduationCap,
        color: "#2563EB",
        bg: "#EFF6FF",
        border: "#BFDBFE",
      },
      {
        label: t(`${d}.cards.students`),
        value: roleStats.student?.total ?? 0,
        sub: t(`${d}.cards.studentsSub`, { count: (dashboard?.users as Record<string, unknown> | undefined)?.new_this_week ?? 0 }),
        icon: Users,
        color: "#10B981",
        bg: "#ECFDF5",
        border: "#A7F3D0",
      },
      {
        label: t(`${d}.cards.courses`),
        value: (dashboard?.courses as Record<string, unknown> | undefined)?.total ?? 0,
        sub: t(`${d}.cards.coursesSub`, { count: (dashboard?.courses as Record<string, unknown> | undefined)?.total_enrollments ?? 0 }),
        icon: BookOpen,
        color: "#8B5CF6",
        bg: "#F5F3FF",
        border: "#DDD6FE",
      },
      {
        label: t(`${d}.cards.submissions`),
        value: (dashboard?.activity as Record<string, unknown> | undefined)?.tests_taken_today ?? 0,
        sub: t(`${d}.cards.submissionsSub`, { count: examStats?.total_exams ?? 0 }),
        icon: FileText,
        color: "#F59E0B",
        bg: "#FFFBEB",
        border: "#FDE68A",
      },
    ],
    [dashboard, examStats, roleStats]
  );


  const postTypeBars = useMemo(() => {
    const byType = (contentStats?.by_type as Record<string, number> | undefined) || {};
    const colors = ["#2563EB", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444"];
    return Object.entries(byType)
      .slice(0, 5)
      .map(([name, value], idx) => ({ name, students: value, color: colors[idx % colors.length] }));
  }, [contentStats]);

  const recentActivities = useMemo(
    () => [
      {
        id: 1,
        text: t(`${d}.activity.submissions`, { count: (dashboard?.activity as Record<string, unknown> | undefined)?.tests_taken_today ?? 0 }),
        time: t(`${d}.realtime`),
        color: "#2563EB",
      },
      {
        id: 2,
        text: t(`${d}.activity.posts`, { count: (dashboard?.activity as Record<string, unknown> | undefined)?.posts_created_today ?? 0 }),
        time: t(`${d}.realtime`),
        color: "#10B981",
      },
      {
        id: 3,
        text: t(`${d}.activity.enrollments`, { count: (dashboard?.courses as Record<string, unknown> | undefined)?.new_enrollments_today ?? 0 }),
        time: t(`${d}.realtime`),
        color: "#8B5CF6",
      },
      {
        id: 4,
        text: t(`${d}.activity.pendingPosts`, { count: contentStats?.pending_posts ?? 0 }),
        time: t(`${d}.realtime`),
        color: "#F59E0B",
      },
    ],
    [contentStats, dashboard]
  );

  const pendingAlerts = useMemo(
    () => [
      { id: 1, text: t(`${d}.alerts.posts`, { count: contentStats?.pending_posts ?? 0 }), severity: "warning", path: "/admin/content/posts" },
      { id: 2, text: t(`${d}.alerts.exams`, { count: examStats?.pending_exams ?? 0 }), severity: "info", path: "/admin/content/exams" },
      { id: 3, text: t(`${d}.alerts.lockedUsers`, { count: lockedUsers }), severity: "danger", path: "/admin/students" },
      {
        id: 4,
        text: t(`${d}.alerts.completionRate`, { rate: (dashboard?.performance as Record<string, unknown> | undefined)?.assignment_completion_rate ?? 0 }),
        severity: "info",
        path: "/admin/users?tab=students",
      },
    ],
    [contentStats, dashboard, examStats, lockedUsers]
  );

  const serverMetrics = useMemo(
    () => {
      // Ưu tiên số đo thật từ /admin/system/health; fallback trends khi không có
      const disk = (systemHealth?.disk as Record<string, unknown> | undefined);
      const memory = (systemHealth?.memory as Record<string, unknown> | undefined);
      const db = (systemHealth?.database as Record<string, unknown> | undefined);

      const diskPct = Number(disk?.used_percent ?? 0);
      const memPct  = Number(memory?.used_percent ?? 0);
      const dbLatency = Number(db?.latency_ms ?? 0);
      // DB latency 0–200ms map sang 0–100% để hiển thị thanh
      const dbPct = Math.min(100, Math.round((dbLatency / 200) * 100));
      const queuePending = Number((systemHealth?.queue as Record<string, unknown> | undefined)?.pending_jobs ?? 0);
      // Queue 0–50 jobs map sang 0–100% (capped)
      const queuePct = Math.min(100, Math.round((queuePending / 50) * 100));

      return [
        { label: "Memory (PHP)", val: memPct,   icon: Cpu,      color: "#10B981", suffix: "%" },
        { label: "DB latency",   val: dbPct,    icon: Database, color: "#F59E0B", suffix: `${dbLatency}ms` },
        { label: "Disk",         val: diskPct,  icon: HardDrive, color: "#EF4444", suffix: "%" },
        { label: "Queue",        val: queuePct, icon: Wifi,     color: "#8B5CF6", suffix: `${queuePending} jobs` },
      ];
    },
    [systemHealth]
  );

  if (loading) return <AdminPageSkeleton />;

  if (error) {
    return (
      <div className="min-h-screen p-6" style={{ background: "#F8FAFC" }}>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "#F1F5F9" }}>
      {/* ── Page header ── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p style={{ fontSize: 12, color: "#94A3B8", fontWeight: 500 }}>{greeting}{t(`${d}.greetSuffix`)}</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em", marginTop: 2 }}>
            {t(`${d}.title`)}
          </h1>
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{t(`${d}.subtitle`)}</p>
        </div>
      </div>

      {/* ── Stat cards (compact) ── */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl bg-white px-4 py-3 flex items-center gap-3"
            style={{ border: `1px solid ${card.border}`, boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0" style={{ background: `${card.color}15` }}>
              <card.icon className="h-5 w-5" style={{ color: card.color }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <p style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{String(card.value)}</p>
                <p className="truncate" style={{ fontSize: 11, color: "#10B981", fontWeight: 600 }}>{card.sub}</p>
              </div>
              <p className="truncate" style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Content area ── */}
      <div>

      <div className="mb-4 grid grid-cols-12 gap-4">
        <div className="col-span-8 rounded-2xl p-6" style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#F8FAFC" }}>
                <Activity className="h-4 w-4" style={{ color: "#0F172A" }} />
              </div>
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", lineHeight: 1 }}>Lượt truy cập hệ thống</h2>
                {trafficData.length > 0 && (() => {
                  const total = trafficData.reduce((s, p) => s + p.visits, 0);
                  const half = Math.floor(trafficData.length / 2);
                  const prev = trafficData.slice(0, half).reduce((s, p) => s + p.visits, 0);
                  const curr = trafficData.slice(half).reduce((s, p) => s + p.visits, 0);
                  const pct = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0;
                  return (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span style={{ fontSize: 12, color: "#64748B" }}>
                        Tổng <strong style={{ color: "#0F172A" }}>{total.toLocaleString()}</strong> lượt
                      </span>
                      {pct !== 0 && (
                        <span className="rounded px-1.5 py-0.5"
                          style={{ fontSize: 10, fontWeight: 700, background: pct > 0 ? "#F0FDF4" : "#FEF2F2", color: pct > 0 ? "#10B981" : "#EF4444" }}>
                          {pct > 0 ? "↑" : "↓"}{Math.abs(pct)}%
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            {/* Period toggle */}
            <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              {(["7d", "30d", "90d"] as const).map((p) => {
                const labels = { "7d": "7 ngày", "30d": "30 ngày", "90d": "3 tháng" };
                const active = trafficPeriod === p;
                return (
                  <button key={p} onClick={() => setTrafficPeriod(p)}
                    className="rounded-lg px-3 py-1.5 transition-all"
                    style={{
                      fontSize: 12, fontWeight: active ? 600 : 400,
                      background: active ? "#0F172A" : "transparent",
                      color: active ? "#FFFFFF" : "#64748B",
                    }}>
                    {labels[p]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chart */}
          {trafficLoading ? (
            <div className="flex items-center justify-center" style={{ height: 180 }}>
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#F59E0B] border-t-transparent" />
            </div>
          ) : trafficData.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2" style={{ height: 180 }}>
              <Activity className="h-8 w-8" style={{ color: "#E2E8F0" }} />
              <p style={{ fontSize: 13, color: "#94A3B8" }}>Chưa có dữ liệu truy cập</p>
            </div>
          ) : (
            /* Time-series area chart — submissions + new users */
            <>
              <div className="flex items-center gap-4 mb-2">
                <span className="flex items-center gap-1" style={{ fontSize: 11, color: "#64748B" }}>
                  <span className="inline-block h-2 w-5 rounded-full" style={{ background: "#0F172A" }} /> Bài nộp
                </span>
                <span className="flex items-center gap-1" style={{ fontSize: 11, color: "#64748B" }}>
                  <span className="inline-block h-2 w-5 rounded-full" style={{ background: "#10B981" }} /> Người dùng mới
                </span>
              </div>
              <ResponsiveContainer width="100%" height={164}>
                <AreaChart data={trafficData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradVisits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0F172A" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#0F172A" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false}
                    interval={trafficPeriod === "90d" ? 9 : trafficPeriod === "30d" ? 4 : 0} />
                  <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                    labelStyle={{ color: "#0F172A", fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="visits" name="Bài nộp" stroke="#0F172A" strokeWidth={2}
                    fill="url(#gradVisits)" dot={false} activeDot={{ r: 4, fill: "#F59E0B", stroke: "#fff", strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="users" name="Người dùng mới" stroke="#10B981" strokeWidth={2}
                    fill="url(#gradUsers)" dot={false} activeDot={{ r: 4, fill: "#10B981", stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        <div className="col-span-4 rounded-2xl p-5" style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#EFF6FF" }}>
                <FileText className="h-4 w-4" style={{ color: "#2563EB" }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Bài viết</span>
            </div>
            <Link to="/admin/content/posts" className="flex items-center gap-0.5 transition-colors hover:text-blue-600"
              style={{ fontSize: 11, color: "#94A3B8" }}>
              Xem tất cả <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Total + status pills */}
          {(() => {
            const total = Number(contentStats?.total_posts ?? postTypeBars.reduce((s, b) => s + b.students, 0));
            const pending = Number(contentStats?.pending_posts ?? 0);
            const published = total - pending;
            return (
              <>
                <div className="mb-4">
                  <p style={{ fontSize: 32, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{total}</p>
                  <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>tổng số bài viết</p>
                </div>
                <div className="flex gap-2 mb-5">
                  <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 flex-1"
                    style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#065F46", lineHeight: 1 }}>{published}</p>
                      <p style={{ fontSize: 10, color: "#10B981" }}>Đã duyệt</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 flex-1"
                    style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#92400E", lineHeight: 1 }}>{pending}</p>
                      <p style={{ fontSize: 10, color: "#F59E0B" }}>Chờ duyệt</p>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

          {/* Type breakdown */}
          {postTypeBars.length > 0 && (
            <div className="space-y-2.5">
              <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Phân loại</p>
              {postTypeBars.map((bar) => {
                const VI_LABELS: Record<string, string> = {
                  teaching: "Giảng dạy", grammar: "Ngữ pháp", tips: "Mẹo học",
                  vocabulary: "Từ vựng", pronunciation: "Phát âm", listening: "Nghe",
                  reading: "Đọc hiểu", writing: "Viết", speaking: "Nói",
                  news: "Tin tức", general: "Tổng hợp", exercise: "Bài tập",
                  review: "Ôn tập", other: "Khác",
                };
                const label = VI_LABELS[bar.name?.toLowerCase()] ?? bar.name;
                const max = Math.max(...postTypeBars.map((b) => b.students), 1);
                const pct = Math.round((bar.students / max) * 100);
                return (
                  <div key={bar.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{bar.students}</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "#F1F5F9" }}>
                      <div className="h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: bar.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-6 rounded-2xl p-6" style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" style={{ color: "#0F172A" }} />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>{t(`${d}.recentActivity`)}</h2>
            </div>
          </div>
          <div className="space-y-3">
            {recentActivities.map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full" style={{ background: a.color }} />
                <div className="min-w-0 flex-1">
                  <p style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{a.text}</p>
                  <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-6 rounded-2xl p-6" style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" style={{ color: "#F59E0B" }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>{t(`${d}.alertsTitle`)}</h2>
          </div>
          <div className="space-y-2.5">
            {pendingAlerts.map((alert) => (
              <Link key={alert.id} to={alert.path} className="flex items-start gap-3 rounded-xl border p-3 transition-all" style={{ background: "#F8FAFC", borderColor: "#E2E8F0" }}>
                <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#F59E0B]" />
                <p style={{ fontSize: 13, color: "#334155", fontWeight: 500, flex: 1 }}>{alert.text}</p>
                <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
              </Link>
            ))}
          </div>
        </div>

      </div>

      {/* ── Server metrics row ── */}
      <div className="mt-4 grid grid-cols-4 gap-4">
        {serverMetrics.map(({ label, val, icon: Icon, color, suffix }) => (
          <div key={label} className="rounded-2xl p-4 bg-white" style={{ border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${color}15` }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{suffix}</span>
            </div>
            <div className="h-1.5 rounded-full" style={{ background: "#F1F5F9" }}>
              <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${val}%`, background: color }} />
            </div>
            <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 6, fontWeight: 500 }}>{label}</p>
          </div>
        ))}
      </div>

      </div>
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePageTitle, PAGE_TITLES } from "../../../../hooks/usePageTitle";
import {
  ClipboardList,
  Trophy,
  ChevronRight,
  Clock,
  TrendingUp,
  Play,
  AlertCircle,
  Target,
  BookOpen,
  BarChart2,
  ArrowRight,
} from "lucide-react";
import { studentApi } from "../../../../services/studentApi";
import { getSkillColor, getSkillIcon, getSkillName } from "../../../../utils/skillHelpers";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { PracticeRecommendations } from "../../../components/student/dashboard";

// ─── Color tokens ──────────────────────────────────────────────────────────────
const PRIMARY = "#0EA5E9"; // Sky Blue
const PRIMARY_LIGHT = "#E0F2FE"; // Light Sky
const STUDENT_BASE_PATH = "/hoc-vien";

// ─── Quick Action Card ────────────────────────────────────────────────────────
interface QuickAction {
  label: string;
  sub: string;
  icon: React.ElementType;
  path: string;
  gradient: string;
  iconBg: string;
  textColor: string;
}

function QuickActionCard({ action }: { action: QuickAction }) {
  const Icon = action.icon;
  return (
    <Link
      to={action.path}
      className="group flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 cursor-pointer"
      style={{
        background: "#FFFFFF",
        border: "1.5px solid #F0EEFF",
        boxShadow: "0 2px 12px rgba(124,58,237,0.06)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.boxShadow =
          "0 8px 28px rgba(14,165,233,0.14)";
        (e.currentTarget as HTMLElement).style.borderColor = `${PRIMARY}40`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.boxShadow =
          "0 2px 12px rgba(124,58,237,0.06)";
        (e.currentTarget as HTMLElement).style.borderColor = "#F0EEFF";
      }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: action.iconBg }}
      >
        <Icon className="w-6 h-6" style={{ color: action.textColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 15, fontWeight: 700, color: "#1F1344" }}>
          {action.label}
        </p>
        <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
          {action.sub}
        </p>
      </div>
      <ArrowRight
        className="w-4 h-4 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-1"
        style={{ color: "#D1D5DB" }}
      />
    </Link>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gray-200 ${className}`}
      style={{ opacity: 0.6 }}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function StudentDashboard() {
  const { t } = useTranslation();
  usePageTitle(PAGE_TITLES.STUDENT_DASHBOARD);

  // Fetch data
  const { data: testsData, isLoading: testsLoading } = useQuery({
    queryKey: ["student", "tests", "pending"],
    queryFn: () => studentApi.getTests({ status: "pending" }),
  });
  const { data: progressData, isLoading: progressLoading } = useQuery({
    queryKey: ["student", "progress"],
    queryFn: () => studentApi.getProgress(),
  });

  // NEW: Fetch dashboard-specific data
  const { data: recommendationsData, isLoading: recommendationsLoading } = useQuery({
    queryKey: ["student", "recommendations", "practice"],
    queryFn: () => studentApi.getPracticeRecommendations(),
  });

  const [greeting] = useState(() => {
    const h = new Date().getHours();
    if (h < 12) return t("student.dashboard.greeting.morning");
    if (h < 18) return t("student.dashboard.greeting.afternoon");
    return t("student.dashboard.greeting.evening");
  });

  // Transform data
  const pendingAssignments =
    (testsData as any)?.data?.data?.pending?.map((a: any) => ({
      id: a.assignment_id,
      examId: a.exam_id,
      title: a.exam_title,
      subject: getSkillName(a.exam_skill),
      due: a.time_remaining,
      urgent: a.is_urgent,
      color: getSkillColor(a.exam_skill),
      icon: getSkillIcon(a.exam_skill),
    })) || [];

  const progress = (progressData as any)?.data?.data;
  // Dùng Array.isArray thay cho `?.map`/`?.slice`: backend đôi khi trả object ({})
  // thay vì mảng — khi đó optional chaining KHÔNG chặn và .map/.slice sẽ crash trang.
  const skillsBreakdownRaw = progress?.skill_analysis?.skills_breakdown;
  const skillData = Array.isArray(skillsBreakdownRaw)
    ? skillsBreakdownRaw.map((s: any) => ({
        skill: s.skill_name,
        score: Number(s.average_score || 0),
      }))
    : [];
  const recentScoresRaw = progress?.trends?.recent_scores;
  const chartData = Array.isArray(recentScoresRaw)
    ? recentScoresRaw.slice(-7).map((s: any, i: number) => ({
        week: `T${i + 1}`,
        score: Number(s.score || 0),
      }))
    : [];

  const stats = {
    pendingTests: pendingAssignments.length,
    averageScore: Number(progress?.overview?.average_score || 0),
    totalTests: Number(progress?.overview?.total_tests || 0),
    recentScore: Number(progress?.overview?.recent_score || 0),
  };

  const isLoading = testsLoading || progressLoading;

  // Transform new dashboard data with safe array checks
  const recommendationsArray = (recommendationsData as any)?.data?.data;
  const practiceRecommendations = Array.isArray(recommendationsArray)
    ? recommendationsArray.map((r: any) => ({
        id: r.id,
        title: r.title,
        reason: r.reason,
        skill: r.skill,
        duration: r.duration,
        questionCount: r.question_count,
        difficulty: r.difficulty,
        link: r.link,
      }))
    : [];

  // Debug: Log API responses in development
  if (import.meta.env.DEV) {
    console.log('Dashboard API responses:', {
      recommendations: recommendationsData,
    });
  }

  const quickActions: QuickAction[] = [
    {
      label: "Làm bài tập",
      sub: `${stats.pendingTests} bài đang chờ`,
      icon: ClipboardList,
      path: "/bai-tap",
      gradient: `linear-gradient(135deg, #E0F2FE, #BAE6FD)`,
      iconBg: PRIMARY_LIGHT,
      textColor: PRIMARY,
    },
    {
      label: "Luyện tập ngay",
      sub: "Nghe · Đọc · Viết · Nói",
      icon: Target,
      path: "/luyen-tap",
      gradient: "linear-gradient(135deg, #ECFDF5, #D1FAE5)",
      iconBg: "#D1FAE5",
      textColor: "#059669",
    },
    {
      label: "Xem tiến độ",
      sub: `${stats.averageScore.toFixed(1)} điểm TB`,
      icon: BarChart2,
      path: "/tien-do",
      gradient: "linear-gradient(135deg, #EFF6FF, #DBEAFE)",
      iconBg: "#DBEAFE",
      textColor: "#2563EB",
    },
    {
      label: "Lịch sử bài thi",
      sub: `${stats.totalTests} bài đã hoàn thành`,
      icon: Trophy,
      path: "/lich-su",
      gradient: "linear-gradient(135deg, #FFFBEB, #FEF3C7)",
      iconBg: "#FEF3C7",
      textColor: "#D97706",
    },
  ];

  return (
    <>
      <div className="py-6 space-y-6 max-w-[1600px] mx-auto">
      {/* ─── Hero Welcome Section (clean) ───────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 md:p-8 shadow-lg shadow-indigo-600/10"
        style={{
          background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #8B5CF6 100%)",
        }}
      >
        <div
          className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-20"
          style={{ background: "rgba(255,255,255,0.3)" }}
        />
        <div
          className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full opacity-10"
          style={{ background: "rgba(255,255,255,0.5)" }}
        />

        <div className="relative">
          <p className="text-white/70 font-medium mb-1" style={{ fontSize: 14 }}>
            {greeting} 👋
          </p>
          <h1
            className="text-white font-extrabold leading-tight"
            style={{ fontSize: 26, letterSpacing: "-0.03em" }}
          >
            {isLoading ? "Xin chào..." : "Học viên"}
          </h1>
          <p className="text-white/70 mt-2" style={{ fontSize: 14 }}>
            Hôm nay bạn có{" "}
            <strong className="text-white">{stats.pendingTests}</strong> bài tập đang chờ
            {stats.averageScore > 0 && (
              <>
                {" · "}
                Điểm TB{" "}
                <strong className="text-white">{stats.averageScore.toFixed(1)}</strong>
              </>
            )}
          </p>
        </div>
      </div>

      {/* ─── Quick Actions ───────────────────────────────────────────────────── */}
      <div>
        <h2 className="font-bold mb-3" style={{ fontSize: 17, color: "#1F1344" }}>
          Truy cập nhanh
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <QuickActionCard key={action.path} action={action} />
          ))}
        </div>
      </div>

      {/* ─── Main Grid: Pending + Skill Radar ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Pending Assignments — col 8 */}
        <div
          className="lg:col-span-8 rounded-2xl p-6 bg-white"
          style={{
            border: "1.5px solid #F0EEFF",
            boxShadow: "0 2px 12px rgba(124,58,237,0.06)",
          }}
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: PRIMARY_LIGHT }}
              >
                <ClipboardList className="w-4 h-4" style={{ color: PRIMARY }} />
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1F1344" }}>
                Bài tập đang chờ
              </h2>
              {stats.pendingTests > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
                  style={{ background: "#EF4444" }}
                >
                  {stats.pendingTests}
                </span>
              )}
            </div>
            <Link
              to={`${STUDENT_BASE_PATH}/bai-tap`}
              className="flex items-center gap-1 text-sm font-semibold transition-colors"
              style={{ color: PRIMARY }}
            >
              Xem tất cả <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : pendingAssignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                style={{ background: PRIMARY_LIGHT }}
              >
                <BookOpen className="w-7 h-7" style={{ color: PRIMARY }} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#1F1344" }}>
                Chưa có bài tập
              </p>
              <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>
                Giáo viên chưa giao bài. Thử luyện tập tự do nhé!
              </p>
              <Link
                to={`${STUDENT_BASE_PATH}/luyen-tap`}
                className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: PRIMARY }}
              >
                Luyện tập ngay
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingAssignments.slice(0, 4).map((a: any) => {
                const Icon = a.icon;
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-4 p-4 rounded-xl transition-all duration-200 border cursor-pointer"
                    style={{ borderColor: "#F0EEFF", background: "#FAFAFE" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = `${PRIMARY}40`;
                      (e.currentTarget as HTMLElement).style.background = PRIMARY_LIGHT;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "#F0EEFF";
                      (e.currentTarget as HTMLElement).style.background = "#FAFAFE";
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${a.color}18` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: a.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="truncate font-semibold"
                        style={{ fontSize: 14, color: "#1F1344" }}
                      >
                        {a.title}
                      </p>
                      <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
                        {a.subject}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        {a.urgent ? (
                          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                        )}
                        <span
                          style={{
                            fontSize: 12,
                            color: a.urgent ? "#EF4444" : "#9CA3AF",
                            fontWeight: a.urgent ? 600 : 400,
                          }}
                        >
                          {a.due}
                        </span>
                      </div>
                      <Link
                        to={`${STUDENT_BASE_PATH}/lam-bai/${a.examId}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-bold transition-opacity hover:opacity-90"
                        style={{ background: a.color }}
                      >
                        <Play className="w-3 h-3" />
                        Làm bài
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Skill Radar — col 4 */}
        <div
          className="lg:col-span-4 rounded-2xl p-6 bg-white"
          style={{
            border: "1.5px solid #F0EEFF",
            boxShadow: "0 2px 12px rgba(124,58,237,0.06)",
          }}
        >
          <div className="flex items-center gap-2.5 mb-1">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: PRIMARY_LIGHT }}
            >
              <Target className="w-4 h-4" style={{ color: PRIMARY }} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1F1344" }}>
              Kỹ năng
            </h2>
          </div>
          <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>
            Phân tích 4 kỹ năng IELTS của bạn
          </p>

          {isLoading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : skillData.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              Chưa có dữ liệu kỹ năng
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={190}>
                <RadarChart data={skillData}>
                  <PolarGrid stroke="#EDE9FE" />
                  <PolarAngleAxis
                    dataKey="skill"
                    tick={{ fontSize: 10, fill: "#6B7280" }}
                  />
                  <Radar
                    name="Điểm"
                    dataKey="score"
                    stroke={PRIMARY}
                    fill={PRIMARY}
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>

              {skillData.length >= 2 && (
                <div className="space-y-2.5 mt-2">
                  {[
                    {
                      label: "Tốt nhất",
                      data: skillData.reduce(
                        (max: any, s: any) =>
                          s.score > max.score ? s : max
                      ),
                      color: "#10B981",
                      bg: "#D1FAE5",
                    },
                    {
                      label: "Cần cải thiện",
                      data: skillData.reduce(
                        (min: any, s: any) =>
                          s.score < min.score ? s : min
                      ),
                      color: "#EF4444",
                      bg: "#FEE2E2",
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p style={{ fontSize: 11, color: "#9CA3AF" }}>
                          {s.label}
                        </p>
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#1F1344",
                          }}
                        >
                          {s.data.skill}
                        </p>
                      </div>
                      <span
                        className="px-2.5 py-1 rounded-lg text-sm font-bold"
                        style={{ background: s.bg, color: s.color }}
                      >
                        {Math.round(s.data.score)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─── Bottom: Progress Chart (full-width) ─────────────────────────────── */}
      <div
        className="rounded-2xl p-6 bg-white"
        style={{
          border: "1.5px solid #F0EEFF",
          boxShadow: "0 2px 12px rgba(124,58,237,0.06)",
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: PRIMARY_LIGHT }}
            >
              <TrendingUp className="w-4 h-4" style={{ color: PRIMARY }} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1F1344" }}>
              Tiến độ học tập
            </h2>
          </div>
          {chartData.length > 1 && (
            <span
              className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: "#D1FAE5", color: "#065F46" }}
            >
              <TrendingUp className="w-3 h-3" />+
              {(
                chartData[chartData.length - 1].score - chartData[0].score
              ).toFixed(1)}{" "}
              điểm
            </span>
          )}
        </div>

        {isLoading || chartData.length === 0 ? (
          <Skeleton className="h-36 w-full rounded-xl" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="primaryGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#F3F4F6"
                vertical={false}
              />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: `1px solid ${PRIMARY}30`,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke={PRIMARY}
                strokeWidth={2.5}
                fill="url(#primaryGrad)"
                dot={{ fill: PRIMARY, r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ─── NEW: Practice Recommendations ───────────────────────────────────── */}
      <PracticeRecommendations
        recommendations={practiceRecommendations}
        isLoading={recommendationsLoading}
      />
    </div>
    </>
  );
}

import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  Target,
  Star,
  Award,
  BarChart2,
} from "lucide-react";
import { studentApi } from "../../../../services/studentApi";
import { getSkillColor } from "../../../../utils/skillHelpers";
import { studentRolePalette } from "../../../../utils/studentRoleTheme";
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

const PAL = studentRolePalette();
const PRIMARY = PAL.accent;
const PRIMARY_MID = PAL.accentMid;
const PRIMARY_LIGHT = PAL.accentLight;

const masteryLabel: Record<string, { label: string; color: string; bg: string }> = {
  expert: { label: "Thành thạo", color: "#10B981", bg: "#D1FAE5" },
  advanced: { label: "Nâng cao", color: PRIMARY, bg: PRIMARY_LIGHT },
  intermediate: { label: "Trung cấp", color: "#F59E0B", bg: "#FEF3C7" },
  beginner: { label: "Cơ bản", color: "#EF4444", bg: "#FEE2E2" },
};

export function Progress() {
  const { data, isLoading } = useQuery({
    queryKey: ["student", "progress"],
    queryFn: () => studentApi.getProgress(),
  });

  const progress = (data as any)?.data?.data;
  const overview = progress?.overview ?? {};
  const skillsBreakdown = progress?.skill_analysis?.skills_breakdown ?? [];
  const recentScores = progress?.trends?.recent_scores ?? [];

  const chartData = recentScores.slice(-10).map((s: any, i: number) => ({
    week: `T${i + 1}`,
    score: s.score ?? 0,
    skill: s.exam_skill,
  }));

  const radarData = skillsBreakdown.map((s: any) => ({
    skill: s.skill_name ?? s.skill,
    score: s.average_score ?? 0,
  }));

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ background: PAL.bg }}>
        <div style={{ background: PAL.hero }}>
          <div className="px-8 lg:px-16 py-10">
            <div className="animate-pulse">
              <div className="h-3 w-32 rounded-full mb-3" style={{ background: "rgba(255,255,255,0.2)" }} />
              <div className="h-8 w-56 rounded-xl mb-2" style={{ background: "rgba(255,255,255,0.2)" }} />
              <div className="h-3 w-72 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
            </div>
          </div>
        </div>
        <div className="px-8 lg:px-16 py-8 animate-pulse space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-28 rounded-2xl bg-purple-50" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 h-64 rounded-2xl bg-purple-50" />
            <div className="lg:col-span-5 h-64 rounded-2xl bg-purple-50" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: PAL.bg }}>

      {/* ══ Hero */}
      <div className="relative overflow-hidden"
        style={{ background: PAL.hero }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/3 w-80 h-80 rounded-full opacity-20"
            style={{ background: `radial-gradient(circle, ${PAL.orb}, transparent)`, transform: "translateY(-50%)" }} />
          <div className="absolute bottom-0 right-1/4 w-56 h-56 rounded-full opacity-15"
            style={{ background: `radial-gradient(circle, ${PAL.orb}, transparent)`, transform: "translateY(40%)" }} />
        </div>
        <div className="relative z-10 px-8 lg:px-16 py-10">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
              style={{ background: PAL.iconGrad }}>
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-widest uppercase mb-1" style={{ color: PAL.label }}>Kết quả học tập</p>
              <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight">Tiến độ</h1>
              <p className="text-sm mt-1 font-medium" style={{ color: PAL.sub }}>Phân tích kết quả và kỹ năng của bạn</p>
            </div>
          </div>
          {/* Stat chips */}
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { label: "Tổng bài thi", value: overview.total_tests ?? 0, color: PAL.label },
              { label: "Điểm TB", value: Number(overview.average_score ?? 0).toFixed(1), color: "#FCD34D" },
              { label: "Cao nhất", value: Number(overview.highest_score ?? 0).toFixed(1), color: "#86EFAC" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}>
                <span className="text-xl font-extrabold" style={{ color: s.color }}>{s.value}</span>
                <span className="text-xs font-semibold text-purple-200">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ Content */}
      <div className="px-8 lg:px-16 py-8 space-y-6">

      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Tổng bài thi",   value: overview.total_tests ?? 0,                         icon: BarChart2,  color: PRIMARY,    bg: PRIMARY_LIGHT },
          { label: "Điểm trung bình", value: Number(overview.average_score  ?? 0).toFixed(1), icon: TrendingUp, color: PRIMARY_MID, bg: "#F5F3FF" },
          { label: "Điểm cao nhất",  value: Number(overview.highest_score ?? 0).toFixed(1), icon: Star,       color: "#10B981",  bg: "#D1FAE5" },
          { label: "Điểm gần nhất",  value: Number(overview.recent_score  ?? 0).toFixed(1), icon: Award,      color: "#F59E0B",  bg: "#FEF3C7" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl p-4 bg-white hover:-translate-y-0.5 transition-all duration-200"
            style={{ border: "1.5px solid #F0F0F8", boxShadow: "0 2px 12px rgba(124,58,237,0.07)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
              style={{ background: card.bg }}>
              <card.icon className="w-4 h-4" style={{ color: card.color }} />
            </div>
            <p style={{ fontSize: 24, fontWeight: 900, color: "#1A1040", lineHeight: 1 }}>{card.value}</p>
            <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>{card.label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Trend Chart — col 7 */}
        <div className="lg:col-span-7 rounded-2xl p-5 bg-white"
          style={{ border: "1.5px solid #F0F0F8", boxShadow: "0 2px 12px rgba(124,58,237,0.06)" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: PRIMARY_LIGHT }}>
              <TrendingUp className="w-4 h-4" style={{ color: PRIMARY }} />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1F1344" }}>Điểm theo thời gian</h2>
          </div>
          {chartData.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Chưa có dữ liệu</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="progressGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${PRIMARY}30`, fontSize: 12 }} />
                <Area type="monotone" dataKey="score" stroke={PRIMARY} strokeWidth={2.5}
                  fill="url(#progressGrad)"
                  dot={{ fill: PRIMARY, r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Radar Chart — col 5 */}
        <div className="lg:col-span-5 rounded-2xl p-5 bg-white"
          style={{ border: "1.5px solid #F0F0F8", boxShadow: "0 2px 12px rgba(124,58,237,0.06)" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: PRIMARY_LIGHT }}>
              <Target className="w-4 h-4" style={{ color: PRIMARY }} />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1F1344" }}>Radar kỹ năng</h2>
          </div>
          {radarData.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Chưa có dữ liệu</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#EDE9FE" />
                <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: "#6B7280" }} />
                <Radar name="Điểm" dataKey="score" stroke={PRIMARY} fill={PRIMARY} fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Skill Breakdown */}
      {skillsBreakdown.length > 0 && (
        <div className="rounded-2xl p-5 bg-white" style={{ border: "1.5px solid #F0F0F8", boxShadow: "0 2px 12px rgba(124,58,237,0.06)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1F1344", marginBottom: 16 }}>
            Chi tiết kỹ năng
          </h2>
          <div className="space-y-4">
            {skillsBreakdown.map((s: any) => {
              const color = getSkillColor(s.skill);
              const mastery = masteryLabel[s.mastery_level ?? "beginner"] ?? masteryLabel.beginner;
              return (
                <div key={s.skill}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1F1344" }}>
                        {s.skill_name ?? s.skill}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: mastery.bg, color: mastery.color }}>
                        {mastery.label}
                      </span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color }}>
                      {Number(s.average_score ?? 0).toFixed(1)}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "#F3F4F6" }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${s.average_score ?? 0}%`, background: `linear-gradient(90deg, ${color}, ${color}BB)` }} />
                  </div>
                  <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                    {s.count ?? 0} bài · Cao nhất: {Number(s.highest_score ?? 0).toFixed(1)} · Thấp nhất: {Number(s.lowest_score ?? 0).toFixed(1)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

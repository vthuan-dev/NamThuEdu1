import {
  FileText,
  CheckCircle2,
  Clock,
  TrendingUp,
  FileSearch,
  Loader2,
  AlertCircle,
  Timer,
  Headphones,
  BookOpen,
  PenTool,
  Mic,
  Flame,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useGradingStats } from "@/hooks/useGradingStats";
import { getAssetUrl } from "@/utils/apiConfig";

const SKILL_META: Record<string, { label: string; color: string; icon: typeof Headphones }> = {
  listening: { label: "Nghe",   color: "#F59E0B", icon: Headphones },
  reading:   { label: "Đọc",    color: "#0EA5E9", icon: BookOpen },
  writing:   { label: "Viết",   color: "#8B5CF6", icon: PenTool },
  speaking:  { label: "Nói",    color: "#EC4899", icon: Mic },
};

export function GradingStats() {
  const { data: statsData, loading, error } = useGradingStats();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Đang tải thống kê...</p>
        </div>
      </div>
    );
  }

  if (error || !statsData) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-6 flex items-center justify-center">
        <div className="text-center bg-white rounded-xl p-8 border border-red-200">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <p className="text-red-600 font-semibold mb-2">{error || "Không thể tải dữ liệu"}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  // Completion rate
  const completionRate =
    statsData.total_submissions > 0 ? statsData.grading_completion_rate : 0;

  // Average grading time → display as readable
  const avgGradingMin = statsData.average_grading_time ?? 0;
  const avgGradingDisplay =
    avgGradingMin <= 0 ? "—" :
    avgGradingMin < 60 ? `${avgGradingMin.toFixed(0)} phút` :
    `${(avgGradingMin / 60).toFixed(1)} giờ`;

  // Bar: scores by exam type
  const scoresByType = Object.entries(statsData.scores_by_exam_type || {}).map(
    ([type, data]: [string, any]) => ({
      name:
        type === "listening" ? "Nghe" :
        type === "reading" ? "Đọc" :
        type === "writing" ? "Viết" :
        type === "speaking" ? "Nói" :
        type,
      score: data.average_score || 0,
    })
  );

  // Bar: score distribution
  const scoreDistData = Object.entries(statsData.score_dist || {}).map(
    ([range, count]) => ({
      range,
      count: count as number,
    })
  );

  // Skill distribution (count of submissions per skill in graded set)
  const skillEntries = Object.entries(statsData.by_skill || {}) as Array<
    [keyof typeof SKILL_META, number]
  >;
  const totalBySkill = skillEntries.reduce((s, [, c]) => s + c, 0);

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Thống kê chấm bài</h1>
        <p className="text-gray-600">
          Tổng quan hoạt động chấm điểm và phân tích kết quả
        </p>
      </div>

      {/* Top KPI cards — 5 columns */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {/* Total submissions */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-200 hover:shadow-sm transition-all">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mb-3">
            <FileText className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-sm text-gray-600 mb-1">Tổng bài nộp</p>
          <p className="text-2xl font-bold text-gray-900">{statsData.total_submissions}</p>
        </div>

        {/* Graded */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-200 hover:shadow-sm transition-all">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-sm text-gray-600 mb-1">Đã chấm</p>
          <p className="text-2xl font-bold text-gray-900">{statsData.graded_submissions}</p>
        </div>

        {/* Pending */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-200 hover:shadow-sm transition-all">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-sm text-gray-600 mb-1">Chờ chấm</p>
          <p className="text-2xl font-bold text-gray-900">{statsData.pending_submissions}</p>
        </div>

        {/* Completion rate */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-200 hover:shadow-sm transition-all">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-sm text-gray-600 mb-1">Hoàn thành</p>
          <p className="text-2xl font-bold text-gray-900">{completionRate.toFixed(1)}%</p>
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all"
              style={{ width: `${Math.min(completionRate, 100)}%` }}
            />
          </div>
        </div>

        {/* Avg grading time */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-200 hover:shadow-sm transition-all">
          <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center mb-3">
            <Timer className="w-5 h-5 text-violet-600" />
          </div>
          <p className="text-sm text-gray-600 mb-1">TG chấm TB</p>
          <p className="text-2xl font-bold text-gray-900">{avgGradingDisplay}</p>
        </div>
      </div>

      {/* Main charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Most Active Students — 2/3 */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 hover:border-indigo-200 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Học viên hoạt động năng nổ nhất
            </h3>
            <span className="text-[11px] text-gray-400 font-medium">Sắp xếp theo số bài nộp</span>
          </div>

          {(() => {
            const active = statsData.most_active_students ?? [];
            if (active.length === 0) {
              return (
                <p className="text-sm text-gray-400 italic text-center py-12">
                  Chưa có học viên nào nộp bài
                </p>
              );
            }

            // LineChart data: each student is a point on the line
            const chartData = active.map((s, idx) => ({
              idx,
              submissions: s.submissions,
              student: s,
            }));

            // Custom dot — render the student's avatar instead of a circle
            const AvatarDot = (props: any) => {
              const { cx, cy, payload, index } = props;
              if (cx === undefined || cy === undefined) return null;
              const s = payload.student;
              const avatarSrc = s.avatar_url
                ? getAssetUrl(s.avatar_url)
                : "/images/default-avatar.png";
              const size = 36;
              const r = size / 2;
              const rankColor =
                index === 0 ? "#F59E0B" :
                index === 1 ? "#94A3B8" :
                index === 2 ? "#FB923C" : null;

              return (
                <g style={{ cursor: "pointer" }}>
                  {/* Outer hover ring (handled by recharts via activeDot) */}
                  <defs>
                    <clipPath id={`avatar-clip-${index}`}>
                      <circle cx={cx} cy={cy} r={r - 2} />
                    </clipPath>
                  </defs>
                  {/* White ring background */}
                  <circle cx={cx} cy={cy} r={r} fill="#fff" stroke="#E2E8F0" strokeWidth={1.5} />
                  {/* Avatar image clipped to circle */}
                  <image
                    href={avatarSrc}
                    x={cx - r + 2}
                    y={cy - r + 2}
                    width={size - 4}
                    height={size - 4}
                    clipPath={`url(#avatar-clip-${index})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                  {/* Rank badge for top 3 */}
                  {rankColor && (
                    <>
                      <circle cx={cx + r - 4} cy={cy - r + 4} r={7} fill={rankColor} stroke="#fff" strokeWidth={1.5} />
                      <text
                        x={cx + r - 4}
                        y={cy - r + 4}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={9}
                        fontWeight={900}
                        fill="#fff"
                      >
                        {index + 1}
                      </text>
                    </>
                  )}
                </g>
              );
            };

            // Custom active dot — slightly bigger ring on hover
            const ActiveAvatarDot = (props: any) => {
              const { cx, cy } = props;
              if (cx === undefined || cy === undefined) return null;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={22}
                  fill="none"
                  stroke="#6366F1"
                  strokeWidth={2}
                  strokeOpacity={0.6}
                />
              );
            };

            // Custom tooltip shows full name + meta
            const StudentTooltip = ({ active: tipActive, payload }: any) => {
              if (!tipActive || !payload?.length) return null;
              const s = payload[0].payload.student;
              return (
                <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
                  <p className="font-bold text-slate-900 mb-1">{s.name}</p>
                  <div className="space-y-0.5 text-slate-600">
                    <p>
                      <span className="text-slate-400">Bài nộp:</span>{" "}
                      <span className="font-semibold text-indigo-600 tabular-nums">{s.submissions}</span>
                    </p>
                    {s.graded > 0 && (
                      <p>
                        <span className="text-slate-400">Đã chấm:</span>{" "}
                        <span className="font-semibold text-emerald-600 tabular-nums">{s.graded}</span>
                      </p>
                    )}
                    {s.avg_score > 0 && (
                      <p>
                        <span className="text-slate-400">Điểm TB:</span>{" "}
                        <span className="font-semibold text-amber-600 tabular-nums">{s.avg_score}</span>
                        <span className="text-slate-400">/10</span>
                      </p>
                    )}
                  </div>
                </div>
              );
            };

            return (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData} margin={{ top: 30, right: 30, left: 10, bottom: 30 }}>
                  <defs>
                    <linearGradient id="activeStudentLine" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6366F1" />
                      <stop offset="100%" stopColor="#A78BFA" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis
                    dataKey="idx"
                    tick={({ x, y, payload }) => {
                      const s = chartData[payload.value]?.student;
                      if (!s) return <g />;
                      return (
                        <text
                          x={x}
                          y={y + 12}
                          textAnchor="middle"
                          fill="#64748B"
                          fontSize={11}
                          fontWeight={500}
                        >
                          {s.name.split(" ").pop()}
                        </text>
                      );
                    }}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fill: "#94A3B8", fontSize: 11 }}
                    allowDecimals={false}
                    label={{
                      value: "Số bài nộp",
                      angle: -90,
                      position: "insideLeft",
                      style: { fill: "#94A3B8", fontSize: 11 },
                    }}
                  />
                  <Tooltip content={<StudentTooltip />} cursor={{ stroke: "#E2E8F0", strokeWidth: 1 }} />
                  <Line
                    type="monotone"
                    dataKey="submissions"
                    stroke="url(#activeStudentLine)"
                    strokeWidth={2.5}
                    dot={<AvatarDot />}
                    activeDot={<ActiveAvatarDot />}
                  />
                </LineChart>
              </ResponsiveContainer>
            );
          })()}
        </div>

        {/* Completion ring — 1/3 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:border-indigo-200 hover:shadow-sm transition-all flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-semibold text-gray-900">Tiến độ chấm</h3>
            <span className="text-[11px] text-gray-400 font-medium">Tổng quan</span>
          </div>
          <p className="text-[12px] text-gray-500 mb-4">Tỷ lệ bài đã chấm trên tổng nộp</p>

          {(() => {
            const total = statsData.total_submissions;
            const graded = statsData.graded_submissions;
            const pending = statsData.pending_submissions;
            const pct = total > 0 ? (graded / total) * 100 : 0;

            // SVG progress ring math
            const size = 200;
            const stroke = 14;
            const radius = (size - stroke) / 2;
            const circumference = 2 * Math.PI * radius;
            const dashOffset = circumference - (pct / 100) * circumference;

            // Status hint based on completion
            const hint =
              pct >= 90 ? { label: "Xuất sắc", color: "#10B981", bg: "bg-emerald-50", text: "text-emerald-700" } :
              pct >= 60 ? { label: "Đang tốt", color: "#0EA5E9", bg: "bg-sky-50",     text: "text-sky-700" } :
              pct >= 30 ? { label: "Cần đẩy",  color: "#F59E0B", bg: "bg-amber-50",   text: "text-amber-700" } :
                          { label: "Còn nhiều", color: "#EF4444", bg: "bg-rose-50",   text: "text-rose-700" };

            return (
              <>
                {/* Progress ring */}
                <div className="flex items-center justify-center mb-4 flex-1">
                  <div className="relative" style={{ width: size, height: size }}>
                    <svg width={size} height={size} className="-rotate-90">
                      <defs>
                        <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#6366F1" />
                          <stop offset="100%" stopColor="#10B981" />
                        </linearGradient>
                      </defs>
                      {/* Track */}
                      <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="#F1F5F9"
                        strokeWidth={stroke}
                      />
                      {/* Progress */}
                      <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="url(#ringGradient)"
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
                      />
                    </svg>
                    {/* Center text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-black text-gray-900 leading-none tabular-nums">
                        {pct.toFixed(0)}
                        <span className="text-xl">%</span>
                      </span>
                      <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wider mt-1">
                        Hoàn thành
                      </span>
                      <span
                        className={`mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${hint.bg} ${hint.text}`}
                      >
                        {hint.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stat tiles */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="px-3 py-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Đã chấm</span>
                    </div>
                    <p className="text-xl font-black text-emerald-700 tabular-nums leading-tight">{graded}</p>
                  </div>
                  <div className="px-3 py-2.5 rounded-lg bg-amber-50/60 border border-amber-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Chờ chấm</span>
                    </div>
                    <p className="text-xl font-black text-amber-700 tabular-nums leading-tight">{pending}</p>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Second row: Bar charts + Skill distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Scores by exam type */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:border-indigo-200 hover:shadow-sm transition-all">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Điểm TB theo loại đề</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={scoresByType}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" tick={{ fill: "#6B7280", fontSize: 12 }} />
              <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="score" fill="#6366F1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Score distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:border-indigo-200 hover:shadow-sm transition-all">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Phân bổ điểm</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={scoreDistData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="range" tick={{ fill: "#6B7280", fontSize: 12 }} />
              <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="count" fill="#10B981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Skill distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:border-indigo-200 hover:shadow-sm transition-all">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Phân bổ kỹ năng</h3>
          <div className="space-y-3 mt-2">
            {skillEntries.map(([skill, count]) => {
              const meta = SKILL_META[skill];
              if (!meta) return null;
              const Icon = meta.icon;
              const pct = totalBySkill > 0 ? (count / totalBySkill) * 100 : 0;
              return (
                <div key={skill}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: meta.color + "20" }}
                      >
                        <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                      </div>
                      <span className="text-sm font-semibold text-gray-700">{meta.label}</span>
                    </div>
                    <div className="text-sm tabular-nums">
                      <span className="font-bold text-gray-900">{count}</span>
                      <span className="text-gray-400 text-xs ml-1">bài</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: meta.color }}
                    />
                  </div>
                </div>
              );
            })}
            {totalBySkill === 0 && (
              <p className="text-sm text-gray-400 italic text-center py-6">Chưa có dữ liệu</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Streak leaderboard — học viên duy trì chuỗi học liên tục */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-orange-200 hover:shadow-sm transition-all">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              Chuỗi học liên tục
            </h3>
            <span className="text-[11px] text-gray-400 font-medium">Học đều mỗi ngày</span>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {(statsData.student_streaks ?? []).length === 0 && (
                <p className="text-sm text-gray-400 italic text-center py-4">
                  Chưa có học viên nào duy trì chuỗi học
                </p>
              )}
              {(statsData.student_streaks ?? []).map((s, idx) => {
                const rankColor =
                  idx === 0 ? "from-amber-400 to-orange-500" :
                  idx === 1 ? "from-slate-300 to-slate-400" :
                  idx === 2 ? "from-orange-300 to-orange-400" :
                  "from-indigo-100 to-indigo-200";
                const rankText = idx < 3 ? "text-white" : "text-indigo-700";
                const isHot = s.current_streak >= 3;

                return (
                  <div
                    key={s.user_id ?? idx}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      isHot
                        ? "bg-orange-50/40 border-orange-100 hover:bg-orange-50/70"
                        : "bg-gray-50 border-transparent hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Rank badge */}
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 bg-gradient-to-br ${rankColor} ${rankText}`}
                      >
                        {idx + 1}
                      </div>
                      {/* Avatar */}
                      <img
                        src={s.avatar_url ? getAssetUrl(s.avatar_url) : "/images/default-avatar.png"}
                        alt={s.name}
                        className="w-9 h-9 rounded-full object-cover bg-slate-100 border border-slate-200 flex-shrink-0"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.src.endsWith("/images/default-avatar.png")) {
                            target.src = "/images/default-avatar.png";
                          }
                        }}
                      />
                      {/* Name + meta */}
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                        <p className="text-xs text-gray-500">
                          {s.active_days} ngày học · kỷ lục{" "}
                          <span className="font-semibold text-slate-700">{s.longest_streak}</span> ngày
                        </p>
                      </div>
                    </div>
                    {/* Current streak badge */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <Flame
                        className={`w-4 h-4 ${
                          s.current_streak >= 7 ? "text-orange-500" :
                          s.current_streak >= 3 ? "text-amber-500" :
                          s.current_streak >= 1 ? "text-orange-300" :
                          "text-slate-300"
                        }`}
                      />
                      <span
                        className={`text-lg font-black tabular-nums ${
                          s.current_streak >= 3 ? "text-orange-600" :
                          s.current_streak >= 1 ? "text-amber-600" :
                          "text-slate-400"
                        }`}
                      >
                        {s.current_streak}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">ngày</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pending by exam */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-indigo-200 hover:shadow-sm transition-all">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileSearch className="w-5 h-5 text-orange-600" />
              Đề chờ chấm nhiều nhất
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {statsData.pending_by_exam.length === 0 && (
                <p className="text-sm text-gray-400 italic text-center py-4">
                  Không còn đề nào đang chờ chấm
                </p>
              )}
              {statsData.pending_by_exam.map((exam, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{exam.title}</p>
                    <p className="text-xs text-gray-500">{exam.type}</p>
                  </div>
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm font-bold flex-shrink-0 ml-2">
                    {exam.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

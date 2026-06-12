import { Trophy, Medal, Star, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "../../../../services/studentApi";
import { studentRolePalette } from "../../../../utils/studentRoleTheme";

const PAL = studentRolePalette();
const PRIMARY = PAL.accent;
const PRIMARY_LIGHT = PAL.accentLight;

type LeaderboardRow = {
  rank: number;
  name: string;
  xp: number;
  score: number;
  streak: number;
  isMe?: boolean;
};

export function StudentLeaderboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["student", "gamification", "leaderboard"],
    queryFn: () => studentApi.getLeaderboard({ limit: 10 }),
  });

  const payload = (data as any)?.data?.data;
  const topRaw: any[] = payload?.top ?? [];
  const me = payload?.me ?? {};
  const rank = me.rank ?? 1;
  const totalUsers = me.total_students ?? topRaw.length;
  const avg = topRaw.find((r: any) => r.is_me)?.average_score ?? 0;

  const rows: LeaderboardRow[] = topRaw.map((r: any) => ({
    rank: r.rank,
    name: r.is_me ? "Bạn" : r.name,
    xp: r.total_points,
    score: r.average_score,
    streak: r.streak,
    isMe: Boolean(r.is_me),
  }));

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ background: PAL.bg }}>
        <div style={{ background: PAL.hero }}>
          <div className="px-8 lg:px-16 py-10 animate-pulse">
            <div className="h-3 w-28 rounded-full mb-3" style={{ background: "rgba(255,255,255,0.2)" }} />
            <div className="h-8 w-56 rounded-xl mb-2" style={{ background: "rgba(255,255,255,0.2)" }} />
            <div className="h-3 w-72 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
          </div>
        </div>
        <div className="px-8 lg:px-16 py-8 animate-pulse space-y-3">
          {[1,2,3,4,5].map(k => <div key={k} className="h-16 rounded-2xl bg-purple-50" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: PAL.bg }}>

      {/* Hero */}
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
              style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.25)" }}>
              <Trophy className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-widest uppercase mb-1" style={{ color: PAL.label }}>Thứ hạng</p>
              <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight">Bảng xếp hạng</h1>
              <p className="text-sm mt-1 font-medium" style={{ color: PAL.sub }}>Theo dõi vị trí và bứt phá thứ hạng mỗi tuần</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Xếp hạng của bạn", value: `#${rank}`, color: "#FCD34D" },
              { label: "Tổng học viên", value: totalUsers, color: PAL.sub },
              { label: "Điểm TB", value: Number(avg).toFixed(1), color: "#86EFAC" },
              { label: "Mục tiêu tuần", value: "Top 10", color: "#FDBA74" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.18)" }}>
                <span className="text-lg font-extrabold" style={{ color: s.color }}>{s.value}</span>
                <span className="text-xs font-semibold text-purple-200">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-8 lg:px-16 py-8 space-y-5">
      <div className="rounded-2xl bg-white p-4" style={{ border: "1.5px solid #F0F0F8", boxShadow: "0 2px 12px rgba(124,58,237,0.06)" }}>
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={`${row.rank}-${row.name}`}
              className="flex items-center gap-3 rounded-xl p-3"
              style={{
                background: row.isMe ? PRIMARY_LIGHT : "#F9FAFB",
                border: row.isMe ? `1px solid ${PRIMARY}55` : "1px solid #F3F4F6",
              }}
            >
              <div className="w-10 flex items-center justify-center">
                {row.rank === 1 && <Trophy className="w-5 h-5 text-yellow-500" />}
                {row.rank === 2 && <Medal className="w-5 h-5 text-slate-500" />}
                {row.rank === 3 && <Medal className="w-5 h-5 text-amber-700" />}
                {row.rank > 3 && <span className="font-bold text-slate-500">#{row.rank}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 truncate">{row.name}</p>
                <p className="text-xs text-slate-500">Streak {row.streak} ngày</p>
              </div>
              <div className="text-right">
                <p className="font-extrabold text-slate-800">{row.xp} XP</p>
                <p className="text-xs text-slate-500 flex items-center justify-end gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-500" /> {row.score}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}


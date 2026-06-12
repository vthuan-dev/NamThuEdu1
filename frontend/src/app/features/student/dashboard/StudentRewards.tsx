import { Award, Gift, Sparkles, Lock, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "../../../../services/studentApi";
import { studentRolePalette } from "../../../../utils/studentRoleTheme";

const PAL = studentRolePalette();
const PURPLE = PAL.accent;

export function StudentRewards() {
  const { data: gamiData, isLoading: gamiLoading } = useQuery({
    queryKey: ["student", "gamification", "overview"],
    queryFn: () => studentApi.getGamificationOverview(),
  });

  const { data: achieveData, isLoading: achieveLoading } = useQuery({
    queryKey: ["student", "gamification", "achievements"],
    queryFn: () => studentApi.getAchievements(),
  });

  const isLoading = gamiLoading || achieveLoading;
  const xp = Number((gamiData as any)?.data?.data?.stats?.total_points ?? 0);
  const achievementsRaw: any[] = (achieveData as any)?.data?.data?.achievements ?? [];
  const completedCount = (achieveData as any)?.data?.data?.completed ?? 0;
  const totalCount = (achieveData as any)?.data?.data?.total ?? 0;

  if (isLoading) {
    return (
      <div className="py-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-36 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="py-6 space-y-5">
      <div
        className="rounded-3xl p-6"
        style={{
          background: "linear-gradient(135deg, #F5F3FF 0%, #EEF2FF 100%)",
          border: "1.5px solid #E9D5FF",
        }}
      >
        <div className="flex items-center gap-3">
          <Gift className="w-7 h-7" style={{ color: PURPLE }} />
          <h1 className="text-2xl font-extrabold text-slate-800">Phần thưởng học tập</h1>
        </div>
        <p className="text-sm text-slate-500 mt-2">Tích lũy XP để mở khóa badge, giao diện và ưu đãi học tập.</p>
        <div className="mt-4 rounded-2xl bg-white p-4 border border-purple-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">XP hiện tại</p>
            <p className="text-3xl font-black text-slate-800">{xp.toLocaleString()} XP</p>
          </div>
          {totalCount > 0 && (
            <div className="text-right">
              <p className="text-xs text-slate-500">Thành tựu</p>
              <p className="text-xl font-black" style={{ color: PURPLE }}>{completedCount}/{totalCount}</p>
            </div>
          )}
        </div>
      </div>

      {achievementsRaw.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center border border-gray-100">
          <Award className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-slate-500">Chưa có thành tựu nào. Hãy bắt đầu học!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {achievementsRaw.map((achievement: any) => {
            const unlocked = Boolean(achievement.is_completed);
            const pct = Number(achievement.progress_percentage ?? 0);
            return (
              <div
                key={achievement.id}
                className="rounded-2xl p-4 bg-white"
                style={{
                  border: unlocked ? `1.5px solid ${PURPLE}55` : "1.5px solid #E5E7EB",
                  boxShadow: unlocked ? "0 8px 24px rgba(124,58,237,0.10)" : "none",
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                    style={{ background: unlocked ? PAL.accentLight : "#F3F4F6" }}
                  >
                    {achievement.icon ? (
                      <span>{achievement.icon}</span>
                    ) : unlocked ? (
                      <Award className="w-5 h-5" style={{ color: PURPLE }} />
                    ) : (
                      <Lock className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">{achievement.name}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{achievement.description}</p>
                    {!unlocked && (
                      <div className="mt-2">
                        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: PURPLE }}
                          />
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{Math.round(pct)}% hoàn thành</p>
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      {achievement.coin_reward > 0 && (
                        <span className="text-xs font-semibold px-2 py-1 rounded-md bg-amber-50 text-amber-700">
                          +{achievement.coin_reward} coins
                        </span>
                      )}
                      {unlocked ? (
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đã đạt
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" /> Chưa đạt
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


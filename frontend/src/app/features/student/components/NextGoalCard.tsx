import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import { studentGoalApi } from "../../../../services/classMgmtApi";

interface NextGoal {
  id: number;
  goal_title: string;
  target_date: string;
  target_level?: string | null;
  days_remaining: number;
}

const THEMES: Record<string, { from: string; to: string; accent: string }> = {
  kids: { from: "#FEF3C7", to: "#FDE68A", accent: "#D97706" },
  teens: { from: "#CCFBF1", to: "#99F6E4", accent: "#0D9488" },
  adults: { from: "#EDE9FE", to: "#DDD6FE", accent: "#7C3AED" },
};

/**
 * Card đếm ngược mục tiêu lớp gần nhất. Ẩn nếu học viên không có mục tiêu.
 * @param ageGroup quyết định theme màu (kids/teens/adults).
 */
export function NextGoalCard({ ageGroup = "adults" }: { ageGroup?: "kids" | "teens" | "adults" }) {
  const [goal, setGoal] = useState<NextGoal | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    studentGoalApi.next()
      .then((res) => { if (alive) setGoal(res?.data || null); })
      .catch(() => {})
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  if (!loaded || !goal) return null;

  const theme = THEMES[ageGroup] || THEMES.adults;

  return (
    <div
      className="rounded-2xl p-5 border flex items-center gap-4 mb-6"
      style={{ background: `linear-gradient(135deg, ${theme.from}, ${theme.to})`, borderColor: `${theme.accent}33` }}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: theme.accent }}>
        <Target className="w-6 h-6 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: theme.accent }}>Mục tiêu sắp tới của lớp</p>
        <h3 className="text-lg font-bold text-slate-800 truncate">
          {goal.goal_title}{goal.target_level ? ` (${goal.target_level})` : ""}
        </h3>
        <p className="text-sm text-slate-600">
          Ngày {new Date(goal.target_date).toLocaleDateString("vi-VN")}
          {goal.days_remaining >= 0 && (
            <span className="font-semibold" style={{ color: theme.accent }}> · còn {goal.days_remaining} ngày</span>
          )}
        </p>
      </div>
    </div>
  );
}

export default NextGoalCard;

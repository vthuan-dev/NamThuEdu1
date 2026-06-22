import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Trophy,
  Clock,
  ChevronRight,
  BarChart2,
  CheckCircle,
  BookOpen,
  Headphones,
  PenLine,
  Mic,
  Star,
  TrendingUp,
  FileText,
  Loader2,
  Search,
  Play,
  Timer,
  CalendarDays,
  SlidersHorizontal,
  Target,
  Zap,
} from "lucide-react";
import { studentApi } from "../../../../services/studentApi";
import { formatDate } from "../../../../utils/formatters";

const PURPLE     = "#7C3AED";
const PURPLE_MID = "#8B5CF6";
const BASE       = "/hoc-vien";

/* ── Helpers ──────────────────────────────────────────────── */
const toNum = (v: any) => Number(v ?? 0);

function getCEFR(score: number, maxScore?: number): { label: string; color: string; bg: string; gradient: string } {
  const max = maxScore && maxScore > 0 ? maxScore : 100;
  const pct = (score / max) * 100;
  if (pct >= 80) return { label: "C1", color: "#059669", bg: "#D1FAE5", gradient: "linear-gradient(135deg,#059669,#10B981)" };
  if (pct >= 60) return { label: "B2", color: "#2563EB", bg: "#DBEAFE", gradient: "linear-gradient(135deg,#1D4ED8,#3B82F6)" };
  if (pct >= 40) return { label: "B1", color: "#7C3AED", bg: "#EDE9FE", gradient: "linear-gradient(135deg,#6D28D9,#8B5CF6)" };
  if (pct >= 20) return { label: "A2", color: "#D97706", bg: "#FEF3C7", gradient: "linear-gradient(135deg,#B45309,#F59E0B)" };
  return              { label: "A1", color: "#6B7280", bg: "#F3F4F6", gradient: "linear-gradient(135deg,#4B5563,#9CA3AF)" };
}

/* ── Dummy fallback data ──────────────────────────────────── */
const DUMMY: any[] = [
  { sId:1, sScore:"28.00", sStatus:"graded",             sAttempt:1, sStart_time:"2026-04-28T08:00:00Z", sSubmit_time:"2026-04-28T09:30:00Z", sTime_taken:5400,
    exam:{ eId:101, eTitle:"VSTEP B2 - Full Test",     eType:"VSTEP", eSkill:"mixed",     eTotal_questions:40, eMax_score:40, eDuration:120 } },
  { sId:2, sScore:"0.00",  sStatus:"in_progress",        sAttempt:1, sStart_time:"2026-04-28T14:00:00Z", sSubmit_time:null,                   sTime_taken:1800,
    exam:{ eId:101, eTitle:"VSTEP B2 - Full Test",     eType:"VSTEP", eSkill:"mixed",     eTotal_questions:40, eMax_score:40, eDuration:120 } },
  { sId:3, sScore:"18.50", sStatus:"grading_subjective", sAttempt:1, sStart_time:"2026-04-27T09:00:00Z", sSubmit_time:"2026-04-27T11:00:00Z", sTime_taken:7200,
    exam:{ eId:102, eTitle:"VSTEP B2 - Listening",    eType:"VSTEP", eSkill:"listening", eTotal_questions:30, eMax_score:30, eDuration:40  } },
  { sId:4, sScore:"22.00", sStatus:"graded",             sAttempt:2, sStart_time:"2026-04-25T10:00:00Z", sSubmit_time:"2026-04-25T11:30:00Z", sTime_taken:5400,
    exam:{ eId:103, eTitle:"VSTEP B1 - Reading",      eType:"VSTEP", eSkill:"reading",   eTotal_questions:30, eMax_score:30, eDuration:60  } },
  { sId:5, sScore:"0.00",  sStatus:"in_progress",        sAttempt:1, sStart_time:"2026-04-22T07:00:00Z", sSubmit_time:null,                   sTime_taken:600,
    exam:{ eId:104, eTitle:"VSTEP B2 - Practice Test",eType:"VSTEP", eSkill:"mixed",     eTotal_questions:40, eMax_score:40, eDuration:120 } },
  { sId:6, sScore:"8.00",  sStatus:"graded",             sAttempt:1, sStart_time:"2026-04-20T09:00:00Z", sSubmit_time:"2026-04-20T09:45:00Z", sTime_taken:2700,
    exam:{ eId:105, eTitle:"VSTEP B2 - Writing",      eType:"VSTEP", eSkill:"writing",   eTotal_questions:2,  eMax_score:20, eDuration:60  } },
];

function getStatusChip(status: string) {
  switch (status) {
    case "graded":             return { label: "Đã chấm",       color: "#059669", bg: "#D1FAE5" };
    case "grading_subjective": return { label: "Đang chấm...",  color: "#D97706", bg: "#FEF3C7" };
    case "submitted":          return { label: "Đã nộp",        color: "#2563EB", bg: "#DBEAFE" };
    case "partially_graded":   return { label: "Chấm một phần", color: "#7C3AED", bg: "#EDE9FE" };
    case "auto_submitted":     return { label: "Tự nộp",        color: "#0891B2", bg: "#CFFAFE" };
    case "in_progress":        return { label: "Đang làm",      color: "#6B7280", bg: "#F3F4F6" };
    default:                   return { label: status ?? "—",   color: "#6B7280", bg: "#F3F4F6" };
  }
}

const SKILL_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  listening: { label: "Listening", icon: Headphones, color: "#0284C7", bg: "#E0F2FE" },
  reading:   { label: "Reading",   icon: BookOpen,   color: "#059669", bg: "#D1FAE5" },
  writing:   { label: "Writing",   icon: PenLine,    color: "#D97706", bg: "#FEF3C7" },
  speaking:  { label: "Speaking",  icon: Mic,        color: "#DB2777", bg: "#FCE7F3" },
  vstep:     { label: "VSTEP",     icon: FileText,   color: "#7C3AED", bg: "#EDE9FE" },
};

function getSkillMeta(skill?: string, type?: string) {
  if (type?.toUpperCase() === "VSTEP") return SKILL_META.vstep;
  const s = skill?.toLowerCase();
  if (!s || s === "mixed" || s === "all") return SKILL_META.vstep;
  return SKILL_META[s] ?? { label: skill ?? "Bài thi", icon: FileText, color: "#6B7280", bg: "#F3F4F6" };
}

function getTimeDiff(start?: string, end?: string): string | null {
  if (!start || !end) return null;
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (diff <= 0) return null;
  const m = Math.floor(diff / 60), s = diff % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}p`;
  if (m > 0) return `${m}p ${s}s`;
  return `${s}s`;
}

function getMonthLabel(dateStr?: string): string {
  if (!dateStr) return "Không rõ ngày";
  const d = new Date(dateStr);
  return `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
}

type SkillFilter  = "all" | "listening" | "reading" | "writing" | "speaking" | "vstep";
type ResultFilter = "all" | "pass" | "fail";
type SortMode     = "newest" | "oldest" | "highest" | "lowest";

/* ── Sparkline ─────────────────────────────────────────────── */
function TrendSparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null;
  const max = Math.max(...scores, 1);
  const W = 200, H = 56;
  const step = W / (scores.length - 1);
  const pts = scores.map((v, i) => `${i * step},${H - (v / max) * (H - 4)}`).join(" ");
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" fill="none">
      <polyline points={pts} stroke={PURPLE_MID} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`0,${H} ${pts} ${W},${H}`} fill="url(#sp-fill)" />
      {scores.map((v, i) => (
        <circle key={i} cx={i * step} cy={H - (v / max) * (H - 4)} r="3" fill={PURPLE} />
      ))}
      <defs>
        <linearGradient id="sp-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={PURPLE_MID} stopOpacity="0.18" />
          <stop offset="100%" stopColor={PURPLE_MID} stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Component ─────────────────────────────────────────────── */
export function TestHistory() {
  const navigate = useNavigate();
  const [skillFilter, setSkillFilter]   = useState<SkillFilter>("all");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [search, setSearch]             = useState("");
  const [sortMode, setSortMode]         = useState<SortMode>("newest");

  const { data, isLoading } = useQuery({
    queryKey: ["student", "submissions", "all"],
    queryFn: () => studentApi.getSubmissions({}),
  });

  const rawData       = (data as any)?.data?.data;
  const apiList: any[] = Array.isArray(rawData) ? rawData : (rawData?.data ?? rawData?.submissions ?? []);
  const allSubmissions  = apiList.length > 0 ? apiList : DUMMY;

  /* ── Stats ── */
  const submitted  = allSubmissions.filter(s => s.sStatus !== "in_progress");
  const totalTests = allSubmissions.length;
  const passed     = submitted.filter(s => {
    const max = toNum(s.exam?.eMax_score ?? 100);
    return max > 0 && toNum(s.sScore) / max >= 0.6;
  }).length;
  const passRate   = submitted.length > 0 ? Math.round(passed / submitted.length * 100) : 0;
  const avgScore   = submitted.length > 0
    ? submitted.reduce((sum, s) => sum + toNum(s.sScore), 0) / submitted.length : 0;
  const bestEntry  = submitted.reduce((best: any, s) => {
    const pct = toNum(s.sScore) / Math.max(toNum(s.exam?.eMax_score ?? 100), 1);
    return pct > (best ? toNum(best.sScore) / Math.max(toNum(best.exam?.eMax_score ?? 100), 1) : 0) ? s : best;
  }, null);
  const bestScore  = bestEntry ? toNum(bestEntry.sScore) : 0;
  const bestMax    = bestEntry ? toNum(bestEntry.exam?.eMax_score ?? 100) : 100;

  /* CEFR distribution */
  const cefrDist = useMemo(() => {
    const d: Record<string, number> = { C1: 0, B2: 0, B1: 0, A2: 0, A1: 0 };
    submitted.forEach(s => { const c = getCEFR(toNum(s.sScore), s.exam?.eMax_score); d[c.label]++; });
    return d;
  }, [submitted]);

  /* Recent scores for sparkline */
  const recentScores = useMemo(() =>
    submitted.slice(0, 10).map(s => {
      const max = toNum(s.exam?.eMax_score ?? 100);
      return max > 0 ? Math.round(toNum(s.sScore) / max * 100) : 0;
    }).reverse()
  , [submitted]);

  /* Filter + sort */
  const filtered = useMemo(() => allSubmissions
    .filter(s => {
      const skill = s.exam?.eSkill?.toLowerCase();
      const type  = s.exam?.eType?.toUpperCase();
      if (skillFilter === "vstep" && type !== "VSTEP" && skill !== "mixed") return false;
      if (skillFilter !== "all" && skillFilter !== "vstep" && skill !== skillFilter) return false;
      const max = toNum(s.exam?.eMax_score ?? 100);
      const pct = max > 0 ? toNum(s.sScore) / max : 0;
      if (resultFilter === "pass" && pct < 0.6)  return false;
      if (resultFilter === "fail" && pct >= 0.6)  return false;
      if (search.trim() && !s.exam?.eTitle?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortMode === "newest" || sortMode === "oldest") {
        const ta = new Date(a.sSubmit_time ?? a.sStart_time ?? 0).getTime();
        const tb = new Date(b.sSubmit_time ?? b.sStart_time ?? 0).getTime();
        return sortMode === "newest" ? tb - ta : ta - tb;
      }
      return sortMode === "highest"
        ? toNum(b.sScore) - toNum(a.sScore)
        : toNum(a.sScore) - toNum(b.sScore);
    }), [allSubmissions, skillFilter, resultFilter, search, sortMode]);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    filtered.forEach(s => {
      const key = getMonthLabel(s.sSubmit_time ?? s.sStart_time);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return [...map.entries()];
  }, [filtered]);

  const skillFilters = [
    { key: "all"       as SkillFilter, label: "Tất cả",    icon: BarChart2  },
    { key: "vstep"     as SkillFilter, label: "VSTEP",     icon: FileText   },
    { key: "listening" as SkillFilter, label: "Listening", icon: Headphones },
    { key: "reading"   as SkillFilter, label: "Reading",   icon: BookOpen   },
    { key: "writing"   as SkillFilter, label: "Writing",   icon: PenLine    },
    { key: "speaking"  as SkillFilter, label: "Speaking",  icon: Mic        },
  ];

  const avgMax = submitted.length > 0
    ? submitted.reduce((sum, s) => sum + toNum(s.exam?.eMax_score ?? 100), 0) / submitted.length
    : 100;

  return (
    <div className="min-h-screen" style={{ background: "#F8F7FF" }}>

      {/* ══ Hero ═ softer purple, not too dark */}
      <div className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #4C1D95 0%, #6D28D9 45%, #7C3AED 100%)" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/3 w-72 h-72 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #C4B5FD, transparent)", transform: "translateY(-50%)" }} />
          <div className="absolute bottom-0 right-1/4 w-52 h-52 rounded-full opacity-15"
            style={{ background: "radial-gradient(circle, #A5B4FC, transparent)", transform: "translateY(40%)" }} />
        </div>
        <div className="relative z-10 px-8 lg:px-16 py-10">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
                style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.25)" }}>
                <Trophy className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-purple-200 text-sm font-semibold tracking-widest uppercase mb-1">Kết quả của bạn</p>
                <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight">Lịch sử bài thi</h1>
                <p className="text-purple-200 text-sm mt-1 font-medium">Toàn bộ bài thi và kết quả của bạn</p>
              </div>
            </div>
          </div>
          {/* Stat chips */}
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { label: "Tổng bài", value: totalTests, color: "#DDD6FE" },
              { label: "Đã nộp", value: submitted.length, color: "#FCD34D" },
              { label: "Điểm TB", value: avgScore.toFixed(1), color: "#86EFAC" },
              { label: "Cao nhất", value: bestScore > 0 ? bestScore.toFixed(1) : "—", color: "#FDBA74" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.18)" }}>
                <span className="text-lg font-extrabold" style={{ color: s.color }}>{s.value}</span>
                <span className="text-xs font-semibold text-purple-200">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ Content */}
      <div className="px-8 lg:px-16 py-8 space-y-5">

      {/* ── Stats strip ── */}
      <div className="rounded-2xl bg-white flex divide-x divide-[#F0EEFF]"
        style={{ border: "1.5px solid #F0F0F8", boxShadow: "0 2px 10px rgba(124,58,237,0.06)" }}>

        {/* Total */}
        <div className="flex-1 flex items-center gap-3 px-4 py-3.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#EDE9FE" }}>
            <BarChart2 className="w-3.5 h-3.5" style={{ color: PURPLE }} />
          </div>
          <div className="min-w-0">
            <p style={{ fontSize: 20, fontWeight: 900, color: "#1F1344", lineHeight: 1 }}>{totalTests}</p>
            <p style={{ fontSize: 10.5, color: "#9CA3AF", marginTop: 2 }}>Tổng bài thi</p>
            <p style={{ fontSize: 10, color: PURPLE_MID, fontWeight: 600, marginTop: 1 }}>{submitted.length} đã nộp</p>
          </div>
        </div>

        {/* Pass */}
        <div className="flex-1 flex items-center gap-3 px-4 py-3.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: passRate >= 50 ? "#D1FAE5" : "#F3F4F6" }}>
            <CheckCircle className="w-3.5 h-3.5" style={{ color: passRate >= 50 ? "#059669" : "#9CA3AF" }} />
          </div>
          <div className="min-w-0">
            <p style={{ fontSize: 20, fontWeight: 900, color: "#1F1344", lineHeight: 1 }}>{passed}</p>
            <p style={{ fontSize: 10.5, color: "#9CA3AF", marginTop: 2 }}>Đạt ≥ 60%</p>
            <p style={{ fontSize: 10, fontWeight: 600, marginTop: 1, color: passRate >= 50 ? "#059669" : "#9CA3AF" }}>
              {passRate}% tỷ lệ đạt
            </p>
          </div>
        </div>

        {/* Avg */}
        <div className="flex-1 flex items-center gap-3 px-4 py-3.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#DBEAFE" }}>
            <TrendingUp className="w-3.5 h-3.5" style={{ color: "#2563EB" }} />
          </div>
          <div className="min-w-0 flex-1">
            <p style={{ fontSize: 20, fontWeight: 900, color: "#1F1344", lineHeight: 1 }}>
              {avgScore.toFixed(1)}
              <span style={{ fontSize: 11, fontWeight: 500, color: "#9CA3AF" }}> /{Math.round(avgMax)}</span>
            </p>
            <p style={{ fontSize: 10.5, color: "#9CA3AF", marginTop: 2 }}>Điểm trung bình</p>
            <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: "#DBEAFE" }}>
              <div className="h-full rounded-full" style={{
                width: `${avgMax > 0 ? Math.min(avgScore / avgMax * 100, 100) : 0}%`,
                background: "linear-gradient(90deg,#2563EB,#60A5FA)"
              }} />
            </div>
          </div>
        </div>

        {/* Best */}
        <div className="flex-1 flex items-center gap-3 px-4 py-3.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#FEF3C7" }}>
            <Star className="w-3.5 h-3.5" style={{ color: "#D97706" }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p style={{ fontSize: 20, fontWeight: 900, color: "#1F1344", lineHeight: 1 }}>
                {bestScore > 0 ? bestScore.toFixed(1) : "—"}
              </p>
              {bestScore > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: getCEFR(bestScore, bestMax).bg, color: getCEFR(bestScore, bestMax).color }}>
                  {getCEFR(bestScore, bestMax).label}
                </span>
              )}
            </div>
            <p style={{ fontSize: 10.5, color: "#9CA3AF", marginTop: 2 }}>Điểm cao nhất</p>
            <p style={{ fontSize: 10, color: "#D97706", fontWeight: 600, marginTop: 1 }}>kỷ lục cá nhân</p>
          </div>
        </div>
      </div>

      {/* ── 2-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── LEFT: search + filter + list ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Search + Sort */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm kiếm bài thi..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{ border: "1.5px solid #E9E3FF", background: "#FAFAFE", color: "#1F1344" }}
                onFocus={e => (e.target.style.borderColor = PURPLE)}
                onBlur={e  => (e.target.style.borderColor = "#E9E3FF")}
              />
            </div>
            <div className="relative">
              <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "#9CA3AF" }} />
              <select
                value={sortMode}
                onChange={e => setSortMode(e.target.value as SortMode)}
                className="pl-8 pr-3 py-2.5 rounded-xl text-sm font-semibold outline-none cursor-pointer appearance-none"
                style={{ border: "1.5px solid #E9E3FF", background: "#FAFAFE", color: "#6B7280", minWidth: 148 }}>
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
                <option value="highest">Điểm cao nhất</option>
                <option value="lowest">Điểm thấp nhất</option>
              </select>
            </div>
          </div>

          {/* Filter card */}
          <div className="rounded-2xl bg-white p-1"
            style={{ border: "1.5px solid #E8E4F9", boxShadow: "0 2px 8px rgba(124,58,237,0.05)" }}>
            <div className="flex items-center gap-1 p-1">
              {skillFilters.map(f => {
                const Icon = f.icon;
                const active = skillFilter === f.key;
                return (
                  <button key={f.key} onClick={() => setSkillFilter(f.key)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all flex-1 justify-center"
                    style={{
                      background: active ? PURPLE : "transparent",
                      color: active ? "#fff" : "#9CA3AF",
                      boxShadow: active ? "0 2px 8px rgba(124,58,237,0.3)" : "none",
                    }}>
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden md:inline">{f.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="mx-3" style={{ height: 1, background: "#F0EEFF" }} />
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="flex items-center gap-1">
                {(["all", "pass", "fail"] as ResultFilter[]).map(key => (
                  <button key={key} onClick={() => setResultFilter(key)}
                    className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: resultFilter === key ? "#1F1344" : "transparent",
                      color: resultFilter === key ? "#fff" : "#9CA3AF",
                    }}>
                    {key === "all" ? "Tất cả" : key === "pass" ? "Đạt" : "Chưa đạt"}
                  </button>
                ))}
              </div>
              {(search || skillFilter !== "all" || resultFilter !== "all") && (
                <button onClick={() => { setSearch(""); setSkillFilter("all"); setResultFilter("all"); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "#FEE2E2", color: "#DC2626" }}>
                  ✕ Xoá lọc
                </button>
              )}
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl overflow-hidden h-[84px] animate-pulse"
                  style={{ background: "linear-gradient(90deg,#F5F3FF,#EDE9FE,#F5F3FF)" }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl bg-white py-16 text-center" style={{ border: "1.5px solid #F0F0F8" }}>
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "#EDE9FE" }}>
                <Trophy className="w-8 h-8" style={{ color: PURPLE }} />
              </div>
              <p className="font-bold text-slate-700 mb-1">
                {search ? `Không tìm thấy "${search}"` : "Chưa có bài thi nào"}
              </p>
              <p className="text-sm text-slate-400 mb-5">
                {search ? "Thử từ khóa khác" : "Hoàn thành bài thi đầu tiên để xem lịch sử"}
              </p>
              {!search && (
                <Link to={`${BASE}/de-thi`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white text-sm hover:opacity-90"
                  style={{ background: PURPLE }}>
                  Xem đề thi <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(([month, items]) => (
                <div key={month}>
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarDays className="w-3.5 h-3.5" style={{ color: PURPLE_MID }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: PURPLE_MID, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {month}
                    </span>
                    <div className="flex-1 h-px" style={{ background: "#EDE9FE" }} />
                    <span style={{ fontSize: 11, color: "#C4B5FD" }}>{items.length} bài</span>
                  </div>

                  <div className="space-y-2">
                    {items.map((s: any) => {
                      const score     = toNum(s.sScore);
                      const examMax   = toNum(s.exam?.eMax_score ?? 100);
                      const scorePct  = examMax > 0 ? (score / examMax) * 100 : 0;
                      const cefr      = getCEFR(score, examMax);
                      const status    = getStatusChip(s.sStatus);
                      const skillMeta = getSkillMeta(s.exam?.eSkill, s.exam?.eType);
                      const SkillIcon = skillMeta.icon;
                      const examType  = s.exam?.eType?.toUpperCase();
                      const isVstep   = examType === "VSTEP";
                      const isIelts   = examType === "IELTS";
                      const isThpt    = examType === "THPT";
                      const isPending = s.sStatus === "grading_subjective";
                      const isInProg  = s.sStatus === "in_progress";
                      const timeDiff  = getTimeDiff(s.sStart_time, s.sSubmit_time);
                      const durationSec = toNum(s.exam?.eDuration ?? 0) * 60;
                      const completePct = isInProg && durationSec > 0
                        ? Math.min(Math.round(toNum(s.sTime_taken) / durationSec * 100), 99)
                        : null;

                      const resultUrl = isThpt
                        ? `${BASE}/ket-qua-thpt/${s.sId}`
                        : isVstep
                        ? `${BASE}/ket-qua-vstep/${s.sId}`
                        : isIelts
                        ? `${BASE}/ket-qua-ielts/${s.sId}`
                        : `${BASE}/ket-qua/${s.sId}`;
                      const resumeUrl = isVstep
                        ? `${BASE}/lam-bai-vstep/${s.exam?.eId}?submissionId=${s.sId}`
                        : `${BASE}/lam-bai/${s.exam?.eId}`;

                      return (
                        <div key={s.sId} className="rounded-2xl bg-white overflow-hidden"
                          style={{
                            border: `1.5px solid ${isInProg ? "#EDE9FE" : "#F0EEFF"}`,
                            boxShadow: isInProg ? "0 2px 12px rgba(124,58,237,0.08)" : "0 1px 6px rgba(124,58,237,0.03)",
                          }}>

                          {isInProg && (
                            <div className="h-0.5" style={{ background: `linear-gradient(90deg,${PURPLE},${PURPLE_MID})` }} />
                          )}

                          <div className="flex items-center gap-3.5 p-3.5">
                            {/* Score badge — enlarged, shows X.X / max / CEFR */}
                            <div className="w-[72px] h-[72px] rounded-2xl flex-shrink-0 flex flex-col items-center justify-center"
                              style={{
                                background: isPending || isInProg ? "#F5F3FF" : cefr.gradient,
                                boxShadow: isPending || isInProg ? "none" : `0 6px 16px ${cefr.color}40`,
                              }}>
                              {isPending ? (
                                <>
                                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: PURPLE }} />
                                  <span style={{ fontSize: 7, color: PURPLE, fontWeight: 800, marginTop: 4 }}>ĐANG CHẤM</span>
                                </>
                              ) : isInProg ? (
                                <>
                                  <PenLine className="w-4 h-4" style={{ color: PURPLE_MID }} />
                                  <span style={{ fontSize: 7, color: PURPLE_MID, fontWeight: 800, letterSpacing: "0.04em", marginTop: 3 }}>LÀM DỞ</span>
                                </>
                              ) : (
                                <>
                                  <span style={{ fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                                    {score % 1 === 0 ? score.toFixed(0) : score.toFixed(1)}
                                  </span>
                                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.65)", fontWeight: 600, lineHeight: 1.2 }}>
                                    /{examMax}
                                  </span>
                                  <span className="mt-1 px-2 py-0.5 rounded-full"
                                    style={{ fontSize: 8, fontWeight: 800, color: "#fff", letterSpacing: "0.05em", background: "rgba(255,255,255,0.22)" }}>
                                    {cefr.label}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-bold truncate" style={{ fontSize: 13.5, color: "#1F1344", lineHeight: 1.3 }}>
                                {s.exam?.eTitle ?? "Bài thi"}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold"
                                  style={{ background: skillMeta.bg, color: skillMeta.color }}>
                                  <SkillIcon className="w-2.5 h-2.5" />{skillMeta.label}
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
                                  style={{ background: status.bg, color: status.color }}>
                                  {status.label}
                                </span>
                              </div>

                              {/* Score row — prominent */}
                              {!isPending && !isInProg && examMax > 0 && (
                                <div className="mt-2">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span style={{ fontSize: 15, fontWeight: 900, color: cefr.color, lineHeight: 1 }}>
                                      {score.toFixed(1)}
                                    </span>
                                    <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>/ {examMax} điểm</span>
                                    <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold"
                                      style={{ background: cefr.bg, color: cefr.color }}>
                                      {Math.round(scorePct)}%
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                      style={{ background: cefr.bg, color: cefr.color }}>
                                      {cefr.label}
                                    </span>
                                  </div>
                                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F0EEFF" }}>
                                    <div className="h-full rounded-full transition-all duration-700"
                                      style={{ width: `${Math.min(scorePct, 100)}%`, background: cefr.gradient }} />
                                  </div>
                                </div>
                              )}

                              {/* VSTEP 4-skill breakdown */}
                              {isVstep && !isPending && !isInProg && (() => {
                                const fb = s.sGemini_feedback;
                                const vs = fb?.vstep_scores ?? fb?.scores;
                                if (!vs) return null;
                                const skills = [
                                  { key: "listening", label: "L", color: "#0284C7" },
                                  { key: "reading",   label: "R", color: "#059669" },
                                  { key: "writing",   label: "W", color: "#D97706" },
                                  { key: "speaking",  label: "S", color: "#DB2777" },
                                ];
                                const hasAny = skills.some(sk => vs[sk.key] != null);
                                if (!hasAny) return null;
                                return (
                                  <div className="flex items-center gap-1 mt-1.5">
                                    {skills.map(sk => (
                                      <span key={sk.key} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold"
                                        style={{ background: `${sk.color}18`, color: sk.color, border: `1px solid ${sk.color}30` }}>
                                        {sk.label}: {vs[sk.key] != null ? Number(vs[sk.key]).toFixed(1) : "—"}
                                      </span>
                                    ))}
                                  </div>
                                );
                              })()}

                              {/* Meta row */}
                              <div className="flex items-center gap-3 mt-1.5">
                                {(s.sSubmit_time ?? s.sStart_time) && (
                                  <span className="inline-flex items-center gap-1" style={{ fontSize: 10, color: "#B0AACC" }}>
                                    <Clock className="w-2.5 h-2.5" />
                                    {formatDate(s.sSubmit_time ?? s.sStart_time)}
                                  </span>
                                )}
                                {timeDiff && (
                                  <span className="inline-flex items-center gap-1" style={{ fontSize: 10, color: "#B0AACC" }}>
                                    <Timer className="w-2.5 h-2.5" />{timeDiff}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Action */}
                            {isInProg ? (
                              <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                                {completePct !== null && (
                                  <span style={{ fontSize: 10, color: PURPLE_MID, fontWeight: 700 }}>
                                    {completePct}% hoàn thành
                                  </span>
                                )}
                                <button onClick={() => navigate(resumeUrl)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 active:scale-95"
                                  style={{ background: `linear-gradient(135deg,${PURPLE},${PURPLE_MID})`, boxShadow: "0 2px 8px rgba(124,58,237,0.35)" }}>
                                  <Play className="w-3 h-3 fill-white" />
                                  Tiếp tục
                                </button>
                              </div>
                            ) : (
                              <Link to={resultUrl}
                                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110"
                                style={{ background: "#F5F3FF" }}>
                                <ChevronRight className="w-4 h-4" style={{ color: PURPLE_MID }} />
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT Sidebar ── */}
        <div className="space-y-4">

          {/* CEFR Breakdown */}
          <div className="rounded-2xl bg-white p-5" style={{ border: "1.5px solid #F0F0F8", boxShadow: "0 2px 10px rgba(124,58,237,0.06)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4" style={{ color: PURPLE }} />
              <p style={{ fontSize: 13, fontWeight: 700, color: "#1F1344" }}>Phân bố CEFR</p>
            </div>
            {submitted.length === 0 ? (
              <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "12px 0" }}>Chưa có dữ liệu</p>
            ) : (
              <div className="space-y-2.5">
                {[
                  { label: "C1", color: "#059669", bg: "#D1FAE5" },
                  { label: "B2", color: "#2563EB", bg: "#DBEAFE" },
                  { label: "B1", color: "#7C3AED", bg: "#EDE9FE" },
                  { label: "A2", color: "#D97706", bg: "#FEF3C7" },
                  { label: "A1", color: "#6B7280", bg: "#F3F4F6" },
                ].map(lvl => {
                  const count = cefrDist[lvl.label] ?? 0;
                  const width = submitted.length > 0 ? (count / submitted.length) * 100 : 0;
                  return (
                    <div key={lvl.label} className="flex items-center gap-2.5">
                      <span className="w-8 text-center text-xs font-bold rounded-md py-0.5 flex-shrink-0"
                        style={{ background: lvl.bg, color: lvl.color }}>{lvl.label}</span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#F3F4F6" }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${width}%`, background: lvl.color }} />
                      </div>
                      <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, minWidth: 14, textAlign: "right" }}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Score trend sparkline */}
          {recentScores.length >= 2 && (
            <div className="rounded-2xl bg-white p-5" style={{ border: "1.5px solid #F0F0F8", boxShadow: "0 2px 10px rgba(124,58,237,0.06)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4" style={{ color: "#D97706" }} />
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1F1344" }}>Xu hướng điểm số</p>
              </div>
              <TrendSparkline scores={recentScores} />
              <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 6 }}>
                {recentScores.length} bài gần nhất (% so với max)
              </p>
            </div>
          )}

          {/* Tips card */}
          <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg,#EDE9FE,#F5F3FF)", border: "1.5px solid #DDD6FE" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: PURPLE, marginBottom: 6 }}>💡 Gợi ý luyện tập</p>
            <p style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.6 }}>
              {submitted.length === 0
                ? "Hoàn thành bài thi đầu tiên để nhận gợi ý cá nhân hóa."
                : avgScore / (avgMax || 100) < 0.4
                  ? "Điểm còn thấp — hãy thử luyện Listening hàng ngày để tăng phản xạ."
                  : avgScore / (avgMax || 100) < 0.6
                    ? "Đang tiến bộ tốt! Tập trung vào Reading để đẩy điểm lên B1."
                    : "Điểm ổn định ở B1/B2 — hãy thử Full Test để chinh phục B2!"}
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { usePageTitle, PAGE_TITLES } from "../../../../hooks/usePageTitle";
import {
  Search,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  Award,
  ChevronDown,
  UserCheck,
  Bot,
  Inbox,
  RefreshCw,
} from "lucide-react";
import { Header } from "../../../components/shared/Header";
import { useHideTeacherHeader } from "../../../../contexts/TeacherHeaderContext";
import { api } from "../../../../services/api";
import { getAssetUrl } from "../../../../utils/apiConfig";
import { TeacherReviewModal } from "./TeacherReviewModal";
import { getSubmissionDisplayScore, type SubmissionScoreUpdate } from "../../../../utils/gradeHelpers";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Submission {
  id: string;
  studentName: string;
  studentAvatar: string;
  studentAvatarUrl?: string | null;
  examTitle: string;
  examType: string;
  examId: string;
  classId: string;
  className: string;
  ageGroup: string; // kids | teens | adults | ''
  submissionTime: Date;
  status: "submitted" | "graded" | "partially_graded" | "grading_subjective";
  score?: number;
  maxScore: number;
  attemptNumber: number;
  sGemini_feedback?: string;
  sTeacher_feedback?: string;
  teacher_reviewed_at?: string;
  sGraded_time?: string;
  gradedTime?: Date;
}

type ReviewTab = "all" | "pending" | "reviewed";

const STATUS_COLORS: Record<string, { color: string; dot: string }> = {
  submitted:           { color: "bg-orange-100 text-orange-700 border-orange-200",  dot: "#F97316" },
  graded:              { color: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "#10B981" },
  partially_graded:    { color: "bg-sky-100 text-sky-700 border-sky-200",           dot: "#0EA5E9" },
  grading_subjective:  { color: "bg-amber-100 text-amber-700 border-amber-200",     dot: "#F59E0B" },
  in_progress:         { color: "bg-slate-100 text-slate-500 border-slate-200",    dot: "#94A3B8" },
};

const formatTime = (date: Date) =>
  date.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// ─── Animated dots ─────────────────────────────────────────────────────────────
function AnimatedDots() {
  return (
    <span className="inline-flex gap-[2px] ml-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] h-[3px] rounded-full bg-amber-500 inline-block"
          style={{ animation: `dotBounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
      <style>{`
        @keyframes dotBounce {
          0%, 80%, 100% { opacity: 0.2; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function GradingQueue() {
  usePageTitle(PAGE_TITLES.TEACHER_GRADING);
  useHideTeacherHeader();
  const { t } = useTranslation();

  const STATUS_CONFIG = useMemo<Record<string, { label: string; color: string; dot: string }>>(() => ({
    submitted:           { label: t("teacher.grading.status.submitted"),        ...STATUS_COLORS.submitted },
    graded:              { label: t("teacher.grading.status.graded"),            ...STATUS_COLORS.graded },
    partially_graded:    { label: t("teacher.grading.status.partiallyGraded"),   ...STATUS_COLORS.partially_graded },
    grading_subjective:  { label: t("teacher.grading.status.gradingSubjective"), ...STATUS_COLORS.grading_subjective },
    in_progress:         { label: t("teacher.grading.status.inProgress"),        ...STATUS_COLORS.in_progress },
  }), [t]);

  const [searchQuery, setSearchQuery]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterExam, setFilterExam]     = useState("");   // theo đề thi (examId)
  const [filterClass, setFilterClass]   = useState("");   // theo lớp (classId)
  const [filterRole, setFilterRole]     = useState("");   // theo role học viên (age_group)
  const [sourceTab, setSourceTab]       = useState<'assigned' | 'practice'>('assigned');
  const [reviewTab, setReviewTab]       = useState<ReviewTab>("all");
  const [sortField, setSortField] = useState<'score' | 'time' | 'gradedTime' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [submissions, setSubmissions]   = useState<Submission[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<Submission | null>(null);
  const [lastUpdated, setLastUpdated]   = useState<Date | null>(null);
  const [changedIds, setChangedIds]     = useState<Set<string>>(new Set());
  const [isPolling, setIsPolling]       = useState(false);
  const pollingRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevDataRef    = useRef<Submission[]>([]);

  const mapRaw = (sub: any): Submission => ({
    id: String(sub.sId),
    studentName: sub.user?.uName || "Unknown",
    studentAvatar: (sub.user?.uName ?? "?").split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase(),
    studentAvatarUrl: sub.user?.avatar_url ?? null,
    examTitle: sub.exam?.eTitle || "—",
    examType: sub.exam?.eType || "General",
    examId: String(sub.exam?.eId ?? sub.sExam_id ?? ""),
    classId: String(sub.user?.class_id ?? sub.user?.class?.cId ?? ""),
    className: sub.user?.class?.cName ?? "",
    ageGroup: (sub.user?.age_group ?? "").toLowerCase(),
    submissionTime: new Date(sub.sSubmit_time ?? sub.sStart_time ?? Date.now()),
    status: sub.sStatus,
    score: sub.sScore !== undefined && sub.sScore !== null ? Number(sub.sScore) : undefined,
    maxScore: sub.exam?.eTotal_score ?? 100,
    attemptNumber: sub.sAttempt ?? 1,
    sGemini_feedback: sub.sGemini_feedback,
    sTeacher_feedback: sub.sTeacher_feedback,
    teacher_reviewed_at: sub.teacher_reviewed_at,
    sGraded_time: sub.sGraded_time,
    gradedTime: sub.sGraded_time ? new Date(sub.sGraded_time) : (sub.teacher_reviewed_at ? new Date(sub.teacher_reviewed_at) : undefined),
  });

  const fetchSubmissions = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsPolling(true);
    if (!silent) setError(null);
    try {
      const params: Record<string, string> = { source: sourceTab };
      if (filterStatus) params.status = filterStatus;
      const { data: result } = await api.get("/teacher/submissions", { params });
      if (result.status === "success") {
        const raw: any[] = Array.isArray(result.data) ? result.data : result.data?.data ?? [];
        const mapped = raw.map(mapRaw);

        if (silent && prevDataRef.current.length > 0) {
          const updated = new Set<string>();
          mapped.forEach((ns) => {
            const prev = prevDataRef.current.find((ps) => ps.id === ns.id);
            if (!prev || prev.status !== ns.status) updated.add(ns.id);
          });
          // new submissions not in prev
          mapped.forEach((ns) => {
            if (!prevDataRef.current.find((ps) => ps.id === ns.id)) updated.add(ns.id);
          });
          if (updated.size > 0) {
            setChangedIds(updated);
            setTimeout(() => setChangedIds(new Set()), 4000);
          }
        }

        prevDataRef.current = mapped;
        setSubmissions(mapped);
        setLastUpdated(new Date());
      } else {
        if (!silent) setError(t("teacher.grading.queuePage.loadError"));
      }
    } catch {
      if (!silent) setError(t("teacher.grading.queuePage.dataError"));
    } finally {
      if (!silent) setLoading(false);
      else setIsPolling(false);
    }
  }, [filterStatus, sourceTab]);

  useEffect(() => {
    fetchSubmissions(false);
    pollingRef.current = setInterval(() => fetchSubmissions(true), 20_000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [fetchSubmissions]);

  // ─── Derived stats & filtered list ────────────────────────────────────────
  const pendingReview  = submissions.filter((s) => !s.teacher_reviewed_at);
  const reviewedList   = submissions.filter((s) => !!s.teacher_reviewed_at);

  const stats = {
    total:        submissions.length,
    pending:      pendingReview.length,
    reviewed:     reviewedList.length,
    reviewRate:   submissions.length ? Math.round((reviewedList.length / submissions.length) * 100) : 0,
  };

  const baseList = reviewTab === "pending" ? pendingReview : reviewTab === "reviewed" ? reviewedList : submissions;

  // ─── Tùy chọn cho bộ lọc (rút gọn từ dữ liệu đã tải) ───────────────────────
  const examOptions = useMemo(() => {
    const map = new Map<string, string>();
    submissions.forEach((s) => { if (s.examId) map.set(s.examId, s.examTitle); });
    return Array.from(map, ([id, title]) => ({ id, title }));
  }, [submissions]);

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    submissions.forEach((s) => { if (s.classId) map.set(s.classId, s.className || `Lớp ${s.classId}`); });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [submissions]);

  const roleOptions = useMemo(() => {
    const labels: Record<string, string> = { kids: "Trẻ em", teens: "Thiếu niên", adults: "Người lớn" };
    const set = new Set<string>();
    submissions.forEach((s) => { if (s.ageGroup) set.add(s.ageGroup); });
    return Array.from(set, (key) => ({ key, label: labels[key] ?? key }));
  }, [submissions]);

  const filtered = useMemo(() => baseList.filter((s) => {
    if (filterExam && s.examId !== filterExam) return false;
    if (filterClass && s.classId !== filterClass) return false;
    if (filterRole && s.ageGroup !== filterRole) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.studentName.toLowerCase().includes(q) || s.examTitle.toLowerCase().includes(q);
  }), [baseList, searchQuery, filterExam, filterClass, filterRole]);

  const handleSort = (field: 'score' | 'time' | 'gradedTime') => {
    if (sortField === field) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedAndFiltered = useMemo(() => {
    let list = [...filtered];
    if (sortField === "score") {
      list.sort((a, b) => {
        const scoreA = a.score !== undefined ? a.score / (a.maxScore / 10) : -1;
        const scoreB = b.score !== undefined ? b.score / (b.maxScore / 10) : -1;
        return sortDirection === "asc" ? scoreA - scoreB : scoreB - scoreA;
      });
    } else if (sortField === "time") {
      list.sort((a, b) => {
        const timeA = a.submissionTime.getTime();
        const timeB = b.submissionTime.getTime();
        return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
      });
    } else if (sortField === "gradedTime") {
      list.sort((a, b) => {
        const timeA = a.gradedTime ? a.gradedTime.getTime() : 0;
        const timeB = b.gradedTime ? b.gradedTime.getTime() : 0;
        return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
      });
    }
    return list;
  }, [filtered, sortField, sortDirection]);

  const TABS: { key: ReviewTab; label: string; count: number; icon: typeof Clock }[] = [
    { key: "all",      label: t("teacher.grading.queuePage.tabs.all"),      count: submissions.length, icon: Inbox },
    { key: "pending",  label: t("teacher.grading.queuePage.tabs.pending"),   count: stats.pending,     icon: Clock },
    { key: "reviewed", label: t("teacher.grading.queuePage.tabs.reviewed"),  count: stats.reviewed,    icon: CheckCircle2 },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header breadcrumb={[t("breadcrumb.dashboard"), t("breadcrumb.grading")]} />

      <div className="flex-1 overflow-y-auto" style={{ background: "#EEEEF3" }}>
        <div className="px-8 py-6 space-y-5">

          {/* ── Stats ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: t("teacher.grading.queuePage.statsCards.total"),      showBar: false, value: stats.total,              icon: Inbox,       color: "#6366F1", bg: "#EEF2FF" },
              { label: t("teacher.grading.queuePage.statsCards.pending"),    showBar: false, value: stats.pending,            icon: Clock,       color: "#F59E0B", bg: "#FEF3C7" },
              { label: t("teacher.grading.queuePage.statsCards.reviewed"),   showBar: false, value: stats.reviewed,           icon: UserCheck,   color: "#10B981", bg: "#D1FAE5" },
              { label: t("teacher.grading.queuePage.statsCards.reviewRate"), showBar: true,  value: `${stats.reviewRate}%`,   icon: Award,       color: "#8B5CF6", bg: "#EDE9FE" },
            ].map(({ label, value, showBar, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white rounded-xl border border-slate-100 px-3.5 py-3 hover:shadow-sm transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                    <Icon className="w-[18px] h-[18px]" style={{ color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-500 text-[11px] truncate">{label}</p>
                    <p className="text-xl font-bold text-slate-800 leading-tight">{value}</p>
                  </div>
                </div>
                {showBar && (
                  <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${stats.reviewRate}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Toolbar: tabs + search + filter ── */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            {/* Source tabs: Đề đã giao / Tự luyện */}
            <div className="flex items-center gap-0 px-5 pt-3 border-b border-slate-100">
              {([{ key: 'assigned', label: 'Đề đã giao', color: 'violet' }, { key: 'practice', label: 'Tự luyện', color: 'slate' }] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setSourceTab(key); setReviewTab('all'); }}
                  className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
                    sourceTab === key
                      ? 'border-violet-600 text-violet-700'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {label}
                  {key === 'assigned' && (
                    <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      sourceTab === 'assigned' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'
                    }`}>{submissions.length}</span>
                  )}
                </button>
              ))}
            </div>
            {/* Review sub-tabs */}
            <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-100">
              {TABS.map(({ key, label, count, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setReviewTab(key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-lg text-sm font-semibold transition-all border-b-2 ${
                    reviewTab === key
                      ? "border-violet-600 text-violet-700 bg-violet-50"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    reviewTab === key ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-500"
                  }`}>{count}</span>
                </button>
              ))}
              <div className="ml-auto pb-2 flex items-center gap-3">
                {lastUpdated && (
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    {isPolling && <RefreshCw className="w-3 h-3 animate-spin text-violet-400" />}
                    {t("teacher.grading.queuePage.updatedAt")} {lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                )}
                <button
                  onClick={() => fetchSubmissions(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> {t("teacher.grading.queuePage.refresh")}
                </button>
              </div>
            </div>

            {/* Search + filter */}
            <div className="flex items-center flex-wrap gap-3 px-5 py-3">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={t("teacher.grading.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>

              {/* Lọc theo đề thi */}
              <div className="relative">
                <select
                  value={filterExam}
                  onChange={(e) => setFilterExam(e.target.value)}
                  className="pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 appearance-none max-w-[180px] truncate"
                  title="Lọc theo đề thi"
                >
                  <option value="">Tất cả đề thi</option>
                  {examOptions.map((e) => (
                    <option key={e.id} value={e.id}>{e.title}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>

              {/* Lọc theo lớp */}
              <div className="relative">
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 appearance-none max-w-[160px] truncate"
                  title="Lọc theo lớp"
                >
                  <option value="">Tất cả lớp</option>
                  {classOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>

              {/* Lọc theo role học viên */}
              <div className="relative">
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 appearance-none"
                  title="Lọc theo nhóm học viên"
                >
                  <option value="">Tất cả học viên</option>
                  {roleOptions.map((r) => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>

              {/* Lọc theo trạng thái */}
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 appearance-none"
                >
                  <option value="">{t("teacher.grading.allStatuses")}</option>
                  <option value="submitted">{t("teacher.grading.status.submitted")}</option>
                  <option value="graded">{t("teacher.grading.status.graded")}</option>
                  <option value="partially_graded">{t("teacher.grading.status.partiallyGraded")}</option>
                  <option value="grading_subjective">{t("teacher.grading.status.gradingSubjective")}</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>

              {/* Xóa bộ lọc */}
              {(filterExam || filterClass || filterRole || filterStatus || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterExam(""); setFilterClass(""); setFilterRole("");
                    setFilterStatus(""); setSearchQuery("");
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-violet-600 hover:bg-violet-50 transition-colors"
                >
                  Xóa lọc
                </button>
              )}
            </div>
          </div>

          {/* ── Loading / Error ── */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 rounded-full border-3 border-violet-200 border-t-violet-600 animate-spin" />
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* ── Table ── */}
          {!loading && !error && (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 select-none">
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {t("teacher.grading.table.student")}
                    </th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {t("teacher.grading.table.exam")}
                    </th>
                    <th 
                      onClick={() => handleSort("time")}
                      className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      <div className="flex items-center gap-1">
                        <span>{t("teacher.grading.table.submissionTime")}</span>
                        {sortField === "time" ? (
                          <span className="text-violet-600 font-bold">{sortDirection === "asc" ? "▲" : "▼"}</span>
                        ) : (
                          <span className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
                        )}
                      </div>
                    </th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {t("teacher.grading.table.status")}
                    </th>
                    <th 
                      onClick={() => handleSort("score")}
                      className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      <div className="flex items-center gap-1">
                        <span>{t("teacher.grading.table.aiScore")}</span>
                        {sortField === "score" ? (
                          <span className="text-violet-600 font-bold">{sortDirection === "asc" ? "▲" : "▼"}</span>
                        ) : (
                          <span className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("gradedTime")}
                      className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      <div className="flex items-center gap-1">
                        <span>{t("teacher.grading.table.gradedAt")}</span>
                        {sortField === "gradedTime" ? (
                          <span className="text-violet-600 font-bold">{sortDirection === "asc" ? "▲" : "▼"}</span>
                        ) : (
                          <span className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
                        )}
                      </div>
                    </th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {t("teacher.grading.table.review")}
                    </th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {t("teacher.grading.table.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sortedAndFiltered.map((sub) => {
                    const cfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.submitted;
                    const isReviewed = !!sub.teacher_reviewed_at;
                    const isChanged = changedIds.has(sub.id);
                    return (
                      <tr
                        key={sub.id}
                        className={`transition-all duration-700 group ${
                          isChanged
                            ? "bg-amber-50 ring-1 ring-inset ring-amber-200"
                            : "hover:bg-slate-50/70"
                        }`}
                      >
                        {/* Student */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={sub.studentAvatarUrl ? getAssetUrl(sub.studentAvatarUrl) : "/images/default-avatar.png"}
                              alt={sub.studentName}
                              className="w-9 h-9 rounded-full object-cover bg-slate-100 border border-slate-200 flex-shrink-0"
                              onError={(e) => {
                                // Fallback to bundled default avatar if remote image fails
                                const target = e.currentTarget;
                                if (!target.src.endsWith("/images/default-avatar.png")) {
                                  target.src = "/images/default-avatar.png";
                                }
                              }}
                            />
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{sub.studentName}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-xs text-slate-400">{t("teacher.grading.queuePage.attempt")} {sub.attemptNumber}</span>
                                {sub.className && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-600">{sub.className}</span>
                                )}
                                {sub.ageGroup && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-600">
                                    {sub.ageGroup === "kids" ? "Trẻ em" : sub.ageGroup === "teens" ? "Thiếu niên" : sub.ageGroup === "adults" ? "Người lớn" : sub.ageGroup}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        {/* Exam */}
                        <td className="px-5 py-4 max-w-[200px]">
                          <p className="text-sm font-semibold text-slate-800 truncate">{sub.examTitle}</p>
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-700">{sub.examType}</span>
                        </td>
                        {/* Time */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <p className="text-sm text-slate-600">{formatTime(sub.submissionTime)}</p>
                        </td>
                        {/* Status */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                sub.status === "submitted" ? "animate-pulse" : ""
                              }`}
                              style={{ background: cfg.dot }}
                            />
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            {isChanged && (
                              <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-white text-[9px] font-bold uppercase tracking-wide">
                                {t("teacher.grading.table.new")}
                              </span>
                            )}
                          </div>
                          {sub.status === "grading_subjective" && (
                            <div className="flex items-center gap-1 mt-1">
                              <Bot className="w-3 h-3 text-amber-500" />
                              <span className="text-[10px] text-amber-600 flex items-center animate-pulse">
                                {t("teacher.grading.queuePage.aiProcessing")}
                              </span>
                            </div>
                          )}
                        </td>
                        {/* AI score */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          {(() => {
                            const ds = getSubmissionDisplayScore(sub);
                            return ds ? (
                              <span className="text-sm font-bold text-slate-800">
                                {ds.value.toFixed(2)}<span className="text-slate-400 font-normal text-xs">/{ds.max}</span>
                              </span>
                            ) : (
                              <span className="text-slate-300 text-sm">—</span>
                            );
                          })()}
                        </td>
                        {/* Graded time */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          {sub.gradedTime ? (
                            <p className="text-sm text-slate-600">{formatTime(sub.gradedTime)}</p>
                          ) : (
                            <span className="text-slate-300 text-sm">—</span>
                          )}
                        </td>
                        {/* Review status */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          {isReviewed ? (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              <span className="text-xs font-semibold text-emerald-600">{t("teacher.grading.queuePage.reviewed")}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-amber-400" />
                              <span className="text-xs font-semibold text-amber-600">{t("teacher.grading.queuePage.pendingReview")}</span>
                            </div>
                          )}
                        </td>
                        {/* Actions */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Link
                              to={
                                sub.examType?.toLowerCase().includes("vstep") && sub.examId
                                  ? `/giao-vien/xem-vstep/${sub.examId}?review=${sub.id}&teacher=1`
                                  : `/giao-vien/cham-diem/${sub.id}`
                              }
                              className="p-2 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 transition-colors"
                              title={t("teacher.grading.viewDetail")}
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => setReviewTarget(sub)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                isReviewed
                                  ? "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                  : "bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-200"
                              }`}
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              {isReviewed ? t("teacher.grading.queuePage.reviewAgain") : t("teacher.grading.queuePage.review")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Empty state */}
              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <Inbox className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-semibold">{t("teacher.grading.queuePage.empty.title")}</p>
                  <p className="text-slate-400 text-sm">{t("teacher.grading.queuePage.empty.subtitle")}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      <TeacherReviewModal
        submission={reviewTarget}
        open={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        onReviewed={(update: SubmissionScoreUpdate) => {
          setSubmissions((prev) =>
            prev.map((s) => {
              if (s.id !== update.id) return s;
              return {
                ...s,
                // Apply new score if teacher changed it
                ...(update.rawScore !== undefined ? { score: update.rawScore } : {}),
                sTeacher_feedback: update.sTeacher_feedback ?? s.sTeacher_feedback,
                sGemini_feedback:  update.sGemini_feedback  ?? s.sGemini_feedback,
                teacher_reviewed_at: update.teacher_reviewed_at,
                status: "graded" as const,
              };
            })
          );
          setReviewTarget(null);
        }}
      />
    </div>
  );
}

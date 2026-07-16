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
  HelpCircle,
  ClipboardCheck,
  BookOpenCheck,
  CheckSquare,
  Loader2,
  Trash2,
} from "lucide-react";
import { Header } from "../../../components/shared/Header";
import { useHideTeacherHeader } from "../../../../contexts/TeacherHeaderContext";
import { useToastContext } from "../../../../contexts/ToastContext";
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
  questionsCount: number;
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
                @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fadeIn 200ms ease-out forwards;
        }
        .animate-scale-in {
          animation: scaleIn 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
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
  const toast = useToastContext();

  const STATUS_CONFIG = useMemo<Record<string, { label: string; color: string; dot: string }>>(() => ({
    submitted:           { label: t("teacher.grading.status.submitted"),        ...STATUS_COLORS.submitted },
    graded:              { label: t("teacher.grading.status.graded"),            ...STATUS_COLORS.graded },
    partially_graded:    { label: t("teacher.grading.status.partiallyGraded"),   ...STATUS_COLORS.partially_graded },
    grading_subjective:  { label: t("teacher.grading.status.gradingSubjective"), ...STATUS_COLORS.grading_subjective },
    in_progress:         { label: t("teacher.grading.status.inProgress"),        ...STATUS_COLORS.in_progress },
  }), [t]);

  const [searchQuery, setSearchQuery]   = useState("");
  const [selectedStudentName, setSelectedStudentName] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;
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
  // Sau 3s hiện note nhỏ nhắc giáo viên rê chuột vào icon để xem hướng dẫn.
  const [showHint, setShowHint]         = useState(false);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);
  const [bulkMessage, setBulkMessage]   = useState<string | null>(null);
  const pollingRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevDataRef    = useRef<Submission[]>([]);

  useEffect(() => {
    const showTimer = setTimeout(() => setShowHint(true), 3000);
    const hideTimer = setTimeout(() => setShowHint(false), 9000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const mapRaw = (sub: any): Submission => ({
    id: String(sub.sId),
    studentName: sub.user?.uName || "Unknown",
    studentAvatar: (sub.user?.uName ?? "?").split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase(),
    studentAvatarUrl: sub.user?.avatar_url ?? null,
    examTitle: sub.exam?.eTitle || "—",
    examType: sub.exam?.eType || "General",
    examId: String(sub.exam?.eId ?? sub.sExam_id ?? ""),
    questionsCount: Number(sub.questions_count ?? 0),
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

  // For practice tab: no review workflow — always show all
  const baseList = sourceTab === 'practice'
    ? submissions
    : (reviewTab === "pending" ? pendingReview : reviewTab === "reviewed" ? reviewedList : submissions);

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

    // Group submissions by student
  const studentList = useMemo(() => {
    const map = new Map<string, {
      studentName: string;
      studentAvatar: string;
      studentAvatarUrl: string | null;
      ageGroup: string;
      submissions: Submission[];
    }>();

    sortedAndFiltered.forEach((sub) => {
      const key = sub.studentName;
      if (!map.has(key)) {
        map.set(key, {
          studentName: sub.studentName,
          studentAvatar: sub.studentAvatar,
          studentAvatarUrl: sub.studentAvatarUrl || null,
          ageGroup: sub.ageGroup,
          submissions: [],
        });
      }
      map.get(key)!.submissions.push(sub);
    });

    return Array.from(map.values());
  }, [sortedAndFiltered]);

  // Automatically select the first student or update active selection
  useEffect(() => {
    if (studentList.length > 0) {
      if (!selectedStudentName || !studentList.some((s) => s.studentName === selectedStudentName)) {
        setSelectedStudentName(studentList[0].studentName);
      }
    } else {
      setSelectedStudentName(null);
    }
  }, [studentList, selectedStudentName]);

  const selectedStudentData = useMemo(() => {
    return studentList.find((s) => s.studentName === selectedStudentName) || null;
  }, [studentList, selectedStudentName]);

    const selectedStudentSubmissions = useMemo(() => {
    return selectedStudentData?.submissions || [];
  }, [selectedStudentData]);

  // Reset page when selection or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStudentName, sourceTab, searchQuery, filterExam, filterClass, filterRole]);

  const totalItems = selectedStudentSubmissions.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedSubmissions = useMemo(() => {
    return selectedStudentSubmissions.slice(startIndex, endIndex);
  }, [selectedStudentSubmissions, startIndex, endIndex]);

  // Multi-select: chọn NHIỀU bài cùng lúc trên tab giao bài.
  // Ưu tiên bài chờ duyệt; vẫn cho chọn bài đã duyệt nếu giáo viên muốn phê duyệt lại.
  const selectableSubs = useMemo(() => {
    if (sourceTab !== "assigned") return [] as Submission[];
    return selectedStudentSubmissions;
  }, [selectedStudentSubmissions, sourceTab]);

  const pendingSelectableSubs = useMemo(
    () => selectableSubs.filter((s) => !s.teacher_reviewed_at),
    [selectableSubs]
  );

  // Chỉ đếm các id đang còn trong danh sách hiện tại (tránh count ảo khi filter)
  const selectedVisibleIds = useMemo(
    () => selectableSubs.map((s) => s.id).filter((id) => selectedIds.has(id)),
    [selectableSubs, selectedIds]
  );
  const selectedCount = selectedVisibleIds.length;

  const allVisibleSelected =
    selectableSubs.length > 0 && selectableSubs.every((s) => selectedIds.has(s.id));
  const someVisibleSelected =
    !allVisibleSelected && selectableSubs.some((s) => selectedIds.has(s.id));

  const toggleSelect = (id: string, checked?: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const shouldSelect = checked ?? !next.has(id);
      if (shouldSelect) next.add(id);
      else next.delete(id);
      return next;
    });
    setBulkMessage(null);
  };

  const toggleSelectAll = (checked?: boolean) => {
    const shouldSelect = checked ?? !allVisibleSelected;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shouldSelect) {
        // Thêm toàn bộ dòng đang hiển thị (giữ các lựa chọn ngoài filter nếu còn)
        selectableSubs.forEach((s) => next.add(s.id));
      } else {
        // Bỏ chọn toàn bộ dòng đang hiển thị
        selectableSubs.forEach((s) => next.delete(s.id));
      }
      return next;
    });
    setBulkMessage(null);
  };

  // Chỉ clear khi đổi tab nguồn / tab duyệt — KHÔNG clear khi gõ search
  useEffect(() => {
    setSelectedIds(new Set());
    setBulkMessage(null);
  }, [sourceTab, reviewTab]);

  // Dọn id không còn tồn tại sau khi data reload
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const valid = new Set(submissions.map((s) => s.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [submissions]);

  const handleBulkApprove = async () => {
    if (selectedCount === 0 || bulkApproving) return;

    // Chỉ gửi các id đang visible + thuộc tab hiện tại
    const ids = selectedVisibleIds;
    const pendingCount = ids.filter((id) => {
      const s = submissions.find((x) => x.id === id);
      return s && !s.teacher_reviewed_at;
    }).length;

    const msg =
      pendingCount === ids.length
        ? `Phê duyệt ${ids.length} bài đã chọn? Điểm hiện tại / điểm AI sẽ được giữ nguyên.`
        : `Phê duyệt ${ids.length} bài đã chọn (${pendingCount} chờ duyệt, ${ids.length - pendingCount} đã duyệt trước đó)? Điểm hiện tại / điểm AI sẽ được giữ nguyên.`;

    if (!window.confirm(msg)) return;

    setBulkApproving(true);
    setBulkMessage(null);
    try {
      const { data: result } = await api.post("/teacher/submissions/bulk-approve", {
        submission_ids: ids.map((id) => Number(id)),
      });
      if (result.status === "success") {
        const approvedIds: number[] = result.data?.approved_ids ?? [];
        const reviewedAt: string =
          result.data?.teacher_reviewed_at ?? new Date().toISOString();
        const approvedSet = new Set(approvedIds.map(String));
        setSubmissions((prev) =>
          prev.map((s) =>
            approvedSet.has(s.id)
              ? {
                  ...s,
                  status: "graded" as const,
                  teacher_reviewed_at: reviewedAt,
                  gradedTime: s.gradedTime ?? new Date(reviewedAt),
                }
              : s
          )
        );
        // Bỏ chọn các bài vừa duyệt; giữ lại bài bị skip (nếu có)
        setSelectedIds((prev) => {
          const next = new Set(prev);
          approvedSet.forEach((id) => next.delete(id));
          return next;
        });
        const skipped = result.data?.skipped?.length ?? 0;
        setBulkMessage(
          skipped > 0
            ? `Đã phê duyệt ${approvedIds.length} bài. Bỏ qua ${skipped} bài không hợp lệ.`
            : `Đã phê duyệt ${approvedIds.length} bài làm.`
        );
        setTimeout(() => setBulkMessage(null), 4000);
      } else {
        setBulkMessage(result.message || "Không thể phê duyệt hàng loạt.");
      }
    } catch (err: any) {
      setBulkMessage(err?.response?.data?.message || "Lỗi khi phê duyệt hàng loạt.");
        } finally {
      setBulkApproving(false);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Submission | null>(null);

    const handleDeleteSubmission = async (id: string) => {
    try {
      setDeletingId(id);
      const res = await api.delete(`/teacher/submissions/${id}`);
      if (res.data?.status === "success") {
        // Cập nhật state local
        setSubmissions((prev) => prev.filter((s) => s.id !== id));
        // Bỏ chọn nếu đang chọn trong danh sách bulk approve
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.success("Đã xóa kết quả bài làm của học sinh thành công.");
      } else {
        toast.error(res.data?.message || "Đã xảy ra lỗi khi xóa bài làm.");
      }
    } catch (err: any) {
      console.error("Delete submission error:", err);
      toast.error(err.response?.data?.message || "Lỗi hệ thống khi xóa bài làm.");
    } finally {
      setDeletingId(null);
    }
  };

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
            {(sourceTab === 'practice'
              ? [
                  { label: 'Tổng bài tự luyện', showBar: false, value: stats.total,  icon: Inbox,   color: "#6366F1", bg: "#EEF2FF" },
                  { label: 'Đã chấm',           showBar: false, value: submissions.filter(s => ['graded','partially_graded'].includes(s.status)).length, icon: CheckCircle2, color: "#10B981", bg: "#D1FAE5" },
                  { label: 'Chờ chấm',          showBar: false, value: submissions.filter(s => s.status === 'submitted').length, icon: Clock, color: "#F59E0B", bg: "#FEF3C7" },
                  { label: 'Đang chấm AI',       showBar: false, value: submissions.filter(s => s.status === 'grading_subjective').length, icon: Award, color: "#8B5CF6", bg: "#EDE9FE" },
                ]
              : [
                  { label: t("teacher.grading.queuePage.statsCards.total"),      showBar: false, value: stats.total,              icon: Inbox,       color: "#6366F1", bg: "#EEF2FF" },
                  { label: t("teacher.grading.queuePage.statsCards.pending"),    showBar: false, value: stats.pending,            icon: Clock,       color: "#F59E0B", bg: "#FEF3C7" },
                  { label: t("teacher.grading.queuePage.statsCards.reviewed"),   showBar: false, value: stats.reviewed,           icon: UserCheck,   color: "#10B981", bg: "#D1FAE5" },
                  { label: t("teacher.grading.queuePage.statsCards.reviewRate"), showBar: true,  value: `${stats.reviewRate}%`,   icon: Award,       color: "#8B5CF6", bg: "#EDE9FE" },
                ]
            ).map(({ label, value, showBar, icon: Icon, color, bg }) => (
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
          <div className="bg-white rounded-2xl border border-slate-100">
            {/* Source tabs: Đề đã giao / Tự luyện + refresh inline */}
            <div className="relative z-10 flex items-center gap-0 px-5 pt-2 border-b border-slate-100 group/tabguide">
              {([
                { key: 'assigned', label: 'Đề đã giao', hint: 'GV giao — cần chấm' },
                { key: 'practice', label: 'Tự luyện',   hint: 'HV tự ôn tập' },
              ] as const).map(({ key, label, hint }) => (
                <button
                  key={key}
                  onClick={() => { setSourceTab(key); setReviewTab('all'); setSubmissions([]); setLoading(true); }}
                  className={`flex flex-col items-start px-4 py-2 border-b-2 transition-all ${
                    sourceTab === key
                      ? 'border-violet-600'
                      : 'border-transparent hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm transition-all ${
                      sourceTab === key
                        ? 'font-extrabold text-violet-700'
                        : 'font-medium text-slate-400 hover:text-slate-600'
                    }`}>{label}</span>
                    {sourceTab === key && !loading && submissions.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700">
                        {submissions.length}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] mt-0.5 transition-all ${
                    sourceTab === key ? 'text-violet-400' : 'text-slate-300'
                  }`}>{hint}</span>
                </button>
              ))}
              {/* Hover guide icon */}
              <div className="relative ml-1 pb-1 group/helpicon" onMouseEnter={() => setShowHint(false)}>
                <button type="button" className={`relative w-5 h-5 flex items-center justify-center transition-colors ${showHint ? 'text-violet-500' : 'text-slate-300 hover:text-violet-500'}`}>
                  <HelpCircle className="w-4 h-4" />
                  <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
                  </span>
                </button>

                {/* Note nhắc nhở — tự hiện sau 3s, ẩn khi hover vào icon */}
                {showHint && (
                  <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 whitespace-nowrap">
                    <div className="relative bg-violet-600 text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg shadow-lg animate-bounce">
                      Rê chuột vào để xem hướng dẫn
                      <span className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-violet-600" />
                    </div>
                  </div>
                )}
                {/* Popover */}
                <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 hidden group-hover/helpicon:block w-[320px]">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                    <div className="px-4 py-3 bg-violet-50 border-b border-violet-100">
                      <p className="text-xs font-bold text-violet-700 uppercase tracking-wider">Hướng dẫn — Danh sách chấm điểm</p>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <ClipboardCheck className="w-4 h-4 text-violet-600" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 mb-0.5">Đề đã giao</p>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Bài làm từ đề GV giao. Cách chấm tuỳ loại câu hỏi:
                          </p>
                          <ul className="mt-1.5 space-y-1 text-[11px] text-slate-500">
                            <li className="flex items-start gap-1.5">
                              <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                              <span><span className="font-semibold text-slate-600">Trắc nghiệm / có đáp án sẵn</span> — hệ thống tự chấm ngay, không cần AI.</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                              <span><span className="font-semibold text-violet-600">Writing / Speaking</span> — AI chấm tự động. GV cần <span className="font-semibold text-violet-600">Xét duyệt</span> để kiểm tra lại, thêm nhận xét và xác nhận.</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <BookOpenCheck className="w-4 h-4 text-sky-600" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 mb-0.5">Tự luyện</p>
                          <p className="text-[11px] text-slate-500 leading-relaxed">Bài làm từ đề học viên tự luyện tập ngoài giờ. <span className="font-semibold text-sky-600">Không cần xét duyệt</span> — chỉ theo dõi tiến độ và xem chi tiết bài làm khi cần.</p>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-[10px] text-slate-400 leading-relaxed">💡 <span className="font-semibold">Mẹo:</span> Nhấn vào từng tab để chuyển danh sách. Nhấn <span className="font-semibold">👁 Xem chi tiết</span> để xem toàn bộ bài làm, hoặc <span className="font-semibold">Xét duyệt</span> để xem lại và xác nhận điểm.</p>
                      </div>
                    </div>
                  </div>
                  {/* Arrow */}
                  <div className="flex justify-center -mt-px">
                    <div className="border-4 border-transparent border-b-white" style={{ marginTop: -7 }} />
                  </div>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2 pb-1">
                {lastUpdated && (
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    {isPolling && <RefreshCw className="w-3 h-3 animate-spin text-violet-400" />}
                    {t("teacher.grading.queuePage.updatedAt")} {lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                )}
                <button
                  onClick={() => fetchSubmissions(false)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> {t("teacher.grading.queuePage.refresh")}
                </button>
              </div>
            </div>
            {/* Review sub-tabs — only for assigned */}
            {sourceTab === 'assigned' && (
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
              </div>
            )}
            {/* Practice tab: simple count line */}
            {sourceTab === 'practice' && (
              <div className="px-5 py-2.5 border-b border-slate-100 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Tất cả bài tự luyện</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">{submissions.length}</span>
              </div>
            )}

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

          {/* ── Split Layout: Students List (Left) & Submissions List (Right) ── */}
          {!loading && !error && (
            <div className="flex flex-col lg:flex-row gap-6 items-start">
                            {/* Left Panel: Student List Sidebar (320px) */}
              <div className="w-full lg:w-[320px] lg:flex-shrink-0 bg-white border border-slate-100 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  Danh sách học sinh ({studentList.length})
                </p>
                <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin">
                  {studentList.map((stu) => {
                    const isSelected = stu.studentName === selectedStudentName;
                    const pendingCount = sourceTab === 'assigned'
                      ? stu.submissions.filter((s) => !s.teacher_reviewed_at).length
                      : 0;
                    return (
                      <button
                        key={stu.studentName}
                        type="button"
                        onClick={() => setSelectedStudentName(stu.studentName)}
                        className={`group relative flex items-center gap-3 text-left p-3.5 rounded-xl border transition-all duration-200 active:scale-[0.99] overflow-hidden cursor-pointer ${
                          isSelected
                            ? "bg-violet-50/60 border-violet-200 shadow-sm pl-4"
                            : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/40 hover:translate-x-0.5"
                        }`}
                      >
                        {isSelected && (
                          <span className="absolute left-0 top-3.5 bottom-3.5 w-1 bg-violet-600 rounded-r-full" />
                        )}
                        {/* Student avatar */}
                        <div className="relative flex-shrink-0">
                          {stu.studentAvatarUrl ? (
                            <img
                              src={getAssetUrl(stu.studentAvatarUrl)}
                              alt={stu.studentName}
                              className="w-10 h-10 rounded-full object-cover border border-slate-100 bg-slate-50"
                              onError={(e) => {
                                const target = e.currentTarget;
                                if (!target.src.endsWith("/images/default-avatar.png")) {
                                  target.src = "/images/default-avatar.png";
                                }
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm">
                              {stu.studentAvatar}
                            </div>
                          )}
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                            stu.ageGroup === 'kids' ? 'bg-rose-500' : stu.ageGroup === 'teens' ? 'bg-sky-500' : 'bg-violet-500'
                          }`} title={stu.ageGroup} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{stu.studentName}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {stu.submissions.length} bài thi · <span className="capitalize">{stu.ageGroup === "kids" ? "Trẻ em" : stu.ageGroup === "teens" ? "Thiếu niên" : stu.ageGroup === "adults" ? "Người lớn" : stu.ageGroup}</span>
                          </p>
                        </div>
                        {pendingCount > 0 ? (
                          <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-extrabold text-[10px] flex-shrink-0 animate-pulse">
                            {pendingCount}
                          </span>
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {studentList.length === 0 && (
                    <div className="text-center py-10 bg-white border border-slate-100 rounded-xl">
                      <p className="text-sm text-slate-400 font-medium">Không tìm thấy học sinh</p>
                    </div>
                  )}
                </div>
              </div>

                            {/* Right Panel: Student Submissions Detail (flex-1) */}
              <div className="flex-1 w-full bg-white rounded-2xl border border-slate-100 p-5 lg:p-6 overflow-hidden shadow-sm">
                {selectedStudentData ? (
                  <div key={selectedStudentName} className="flex flex-col gap-5 animate-fade-in-up">
                                        {/* Header: Student Info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-slate-800">{selectedStudentData.studentName}</h2>
                        <p className="text-xs text-slate-500 mt-1">
                          Nhóm tuổi: <span className="capitalize font-semibold text-slate-600">{selectedStudentData.ageGroup === "kids" ? "Trẻ em" : selectedStudentData.ageGroup === "teens" ? "Thiếu niên" : selectedStudentData.ageGroup === "adults" ? "Người lớn" : selectedStudentData.ageGroup}</span> ·
                          Tổng bài nộp: <span className="font-semibold text-slate-600">{selectedStudentData.submissions.length}</span>
                        </p>
                      </div>

                      {/* Compact Bulk approval actions */}
                      {sourceTab === "assigned" && (
                        <div className="flex flex-wrap items-center gap-2">
                          {pendingSelectableSubs.length > 0 && selectedCount === 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedIds(new Set(pendingSelectableSubs.map((s) => s.id)));
                                setBulkMessage(null);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-violet-700 bg-violet-50 border border-violet-100 hover:bg-violet-150 transition-all active:scale-95 cursor-pointer"
                            >
                              <CheckSquare className="w-3.5 h-3.5" />
                              Chọn tất cả chờ duyệt ({pendingSelectableSubs.length})
                            </button>
                          )}

                          {selectedCount > 0 && (
                            <div className="flex items-center gap-2 bg-violet-50/80 border border-violet-200 px-2.5 py-1 rounded-xl shadow-sm">
                              <span className="text-xs font-bold text-violet-700">
                                Đã chọn {selectedCount} bài
                              </span>
                              <button
                                type="button"
                                onClick={handleBulkApprove}
                                disabled={bulkApproving}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-extrabold hover:bg-violet-700 disabled:opacity-60 shadow-sm transition-all active:scale-95 cursor-pointer"
                              >
                                {bulkApproving ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <UserCheck className="w-3 h-3" />
                                )}
                                Duyệt
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedIds(new Set())}
                                disabled={bulkApproving}
                                className="px-2 py-1 rounded-lg text-xs font-bold text-slate-500 hover:bg-white transition-all cursor-pointer"
                                title="Bỏ chọn tất cả"
                              >
                                Bỏ chọn
                              </button>
                            </div>
                          )}

                          {bulkMessage && (
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-xl animate-fade-in-up">
                              {bulkMessage}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Table of Submissions */}
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 select-none">
                            {sourceTab === "assigned" && (
                              <th className="px-4 py-3 w-12 rounded-tl-2xl">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed accent-violet-600"
                                  checked={allVisibleSelected}
                                  ref={(el) => {
                                    if (el) el.indeterminate = someVisibleSelected;
                                  }}
                                  disabled={selectableSubs.length === 0 || bulkApproving}
                                  onChange={(e) => toggleSelectAll(e.target.checked)}
                                  aria-label="Chọn nhiều bài"
                                />
                              </th>
                            )}
                            <th className={`px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider ${sourceTab !== "assigned" ? "rounded-tl-2xl" : ""}`}>
                              {t("teacher.grading.table.exam")}
                            </th>
                            <th
                              onClick={() => handleSort("time")}
                              className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
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
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                              {t("teacher.grading.table.status")}
                            </th>
                            <th
                              onClick={() => handleSort("score")}
                              className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
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
                              className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
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
                            {sourceTab === 'assigned' && (
                              <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                {t("teacher.grading.table.review")}
                              </th>
                            )}
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider rounded-tr-2xl">
                              {t("teacher.grading.table.actions")}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {paginatedSubmissions.map((sub) => {
                            const cfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.submitted;
                            const isReviewed = !!sub.teacher_reviewed_at;
                            const isChanged = changedIds.has(sub.id);
                            const isSelected = selectedIds.has(sub.id);
                            return (
                              <tr
                                key={sub.id}
                                className={`transition-all duration-700 group ${
                                  isSelected
                                    ? "bg-violet-50/70"
                                    : isChanged
                                    ? "bg-amber-50 ring-1 ring-inset ring-amber-200"
                                    : "hover:bg-slate-50/70"
                                }`}
                              >
                                {sourceTab === "assigned" && (
                                  <td className="px-4 py-3.5">
                                    <input
                                      type="checkbox"
                                      className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer disabled:opacity-40 accent-violet-600"
                                      checked={isSelected}
                                      disabled={bulkApproving}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        toggleSelect(sub.id, e.target.checked);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      title={
                                        isSelected
                                          ? "Bỏ chọn bài này"
                                          : isReviewed
                                            ? "Chọn để phê duyệt lại"
                                            : "Chọn để phê duyệt"
                                      }
                                      aria-label={`Chọn bài của ${sub.studentName}`}
                                    />
                                  </td>
                                )}
                                                                <td className="px-4 py-3.5">
                                  <Link
                                    to={
                                      sub.examType?.toLowerCase().includes("vstep") && sub.examId
                                        ? `/giao-vien/xem-vstep/${sub.examId}?review=${sub.id}&teacher=1`
                                        : `/giao-vien/cham-diem/${sub.id}`
                                    }
                                    className="font-semibold text-slate-800 line-clamp-2 max-w-[200px] hover:text-violet-600 hover:underline transition-colors block cursor-pointer"
                                    title="Click để xem chi tiết bài làm & sửa điểm"
                                  >
                                    {sub.examTitle}
                                  </Link>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold uppercase">
                                      {sub.examType}
                                    </span>
                                    {sub.className && (
                                      <span className="text-[10px] text-slate-400">
                                        Lớp: {sub.className}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 text-xs text-slate-500 font-medium whitespace-nowrap">
                                  {formatTime(sub.submissionTime)}
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                                      {cfg.label}
                                      {sub.status === "grading_subjective" && <AnimatedDots />}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5">
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
                                <td className="px-4 py-3.5 text-xs text-slate-500 font-medium whitespace-nowrap">
                                  {sub.gradedTime ? formatTime(sub.gradedTime) : "—"}
                                </td>
                                {sourceTab === 'assigned' && (
                                  <td className="px-4 py-3.5">
                                    {isReviewed ? (
                                      <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-lg">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Đã duyệt
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-amber-600 font-bold text-xs bg-amber-50 px-2 py-1 rounded-lg">
                                        <Clock className="w-3.5 h-3.5" />
                                        Chờ duyệt
                                      </span>
                                    )}
                                  </td>
                                )}
                                                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-2">
                                    {/* Eye: view detail */}
                                    <div className="relative group/tip">
                                      <Link
                                        to={
                                          sub.examType?.toLowerCase().includes("vstep") && sub.examId
                                            ? `/giao-vien/xem-vstep/${sub.examId}?review=${sub.id}&teacher=1`
                                            : `/giao-vien/cham-diem/${sub.id}`
                                        }
                                        className="p-2 rounded-xl bg-sky-50 text-sky-600 hover:bg-sky-100 transition-all active:scale-95 block cursor-pointer"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </Link>
                                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tip:flex flex-col items-center z-50">
                                        <div className="bg-slate-800 text-white text-[11px] rounded-lg px-3 py-2 whitespace-nowrap shadow-xl text-center leading-snug">
                                          <p className="font-semibold">Xem chi tiết bài làm</p>
                                          <p className="text-slate-300 mt-0.5">Kiểm tra đáp án, chấm và sửa điểm</p>
                                        </div>
                                        <div className="border-4 border-transparent border-t-slate-800" />
                                      </div>
                                    </div>

                                                                        {/* Review button */}
                                    <div className="relative group/rev">
                                      <button
                                        type="button"
                                        onClick={() => setReviewTarget(sub)}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                          sourceTab !== 'assigned'
                                            ? "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
                                            : isReviewed
                                            ? "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                            : "bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-200"
                                        }`}
                                      >
                                        <UserCheck className="w-3.5 h-3.5" />
                                        {isReviewed ? t("teacher.grading.queuePage.reviewAgain") : t("teacher.grading.queuePage.review")}
                                      </button>
                                    </div>

                                                                        {/* Delete button */}
                                    <div className="relative group/del">
                                      <button
                                        type="button"
                                        disabled={deletingId === sub.id}
                                        onClick={() => setDeleteTarget(sub)}
                                        className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                                        title="Xóa vĩnh viễn kết quả bài làm"
                                      >
                                        {deletingId === sub.id ? (
                                          <Loader2 className="w-4.5 h-4.5 animate-spin" />
                                        ) : (
                                          <Trash2 className="w-4 h-4" />
                                        )}
                                      </button>
                                                                            <div className="pointer-events-none absolute bottom-full right-0 mb-2 hidden group-hover/del:flex flex-col items-end z-50">
                                        <div className="bg-slate-800 text-white text-[11px] rounded-lg px-3 py-2 whitespace-nowrap shadow-xl text-right leading-snug">
                                          <p className="font-semibold text-rose-400">Xóa kết quả bài làm</p>
                                          <p className="text-slate-300 mt-0.5">Xóa vĩnh viễn khỏi tài khoản HS & GV</p>
                                        </div>
                                        <div className="border-4 border-transparent border-t-slate-800 mr-3" />
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                                                </tbody>
                      </table>
                    </div>
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
                        <p className="text-xs text-slate-500 font-medium">
                          Hiển thị <span className="font-semibold text-slate-700">{startIndex + 1}</span> - <span className="font-semibold text-slate-700">{Math.min(endIndex, totalItems)}</span> trên <span className="font-semibold text-slate-700">{totalItems}</span> bài
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          >
                            Trước
                          </button>
                          {Array.from({ length: totalPages }).map((_, idx) => {
                            const p = idx + 1;
                            const isCurrent = p === currentPage;
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setCurrentPage(p)}
                                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  isCurrent
                                    ? "bg-violet-600 text-white shadow-sm"
                                    : "text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200"
                                }`}
                              >
                                {p}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          >
                            Sau
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Inbox className="w-12 h-12 text-slate-300 mb-3" />
                    <p className="text-sm font-semibold text-slate-500">Chưa chọn học sinh</p>
                    <p className="text-xs text-slate-400 mt-1">Chọn một học sinh từ danh sách bên trái để xem bài làm</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

            {/* Review Modal */}
            {/* Custom Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 max-w-md w-full shadow-2xl p-6 flex flex-col gap-4 animate-scale-in">
            {/* Header Red Circle Warning Icon */}
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0 mx-auto">
              <AlertCircle className="w-6 h-6 animate-pulse" />
            </div>

            {/* Modal Content */}
            <div className="text-center">
              <h3 className="text-md font-bold text-slate-800">Xác nhận xóa bài làm</h3>
              <p className="text-xs text-slate-500 mt-2">
                Bạn có chắc chắn muốn xóa vĩnh viễn kết quả bài làm:
              </p>
              <p className="text-sm font-bold text-violet-600 mt-1.5 line-clamp-2" title={deleteTarget.examTitle}>
                "{deleteTarget.examTitle}"
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Học sinh: <span className="font-semibold text-slate-600">{deleteTarget.studentName}</span>
              </p>

              {/* Warning box */}
              <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3.5 text-left mt-4 text-[11px] leading-relaxed text-rose-800 space-y-1">
                <p className="font-bold text-rose-700 uppercase tracking-wider mb-1">Cảnh báo quan trọng:</p>
                <p>• Kết quả sẽ biến mất hoàn toàn trên cả tài khoản của Giáo viên và Học sinh.</p>
                <p>• Lượt làm bài sẽ được hoàn trả, cho phép học sinh làm lại đề.</p>
                <p className="font-bold">• Hành động này KHÔNG THỂ HOÀN TÁC.</p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={deletingId === deleteTarget.id}
                onClick={async () => {
                  await handleDeleteSubmission(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-bold shadow-sm shadow-rose-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {deletingId === deleteTarget.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Đang xóa...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Xác nhận xóa
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
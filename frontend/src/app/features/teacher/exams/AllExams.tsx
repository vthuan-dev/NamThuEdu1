import { useState, useEffect } from "react";
import { Link } from "react-router";
import { usePageTitle, PAGE_TITLES } from "../../../../hooks/usePageTitle";
import {
  FileText,
  Plus,
  Search,
  AlertCircle,
  Edit,
  Trash2,
  Eye,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Layers,
  Baby,
  GraduationCap,
  BookOpen,
  Check,
  CheckSquare,
  Square,
  X,
  User,
  Users,
  MoreVertical,
  Send,
} from "lucide-react";
import { getKidsExams, deleteKidsExam } from "../../../../services/kidsExamApi";
import { api } from "../../../../services/api";
import { useToastContext } from "../../../../contexts/ToastContext";
import {
  getVstepFullExams,
  getIeltsFullExams,
  getAdultExams,
} from "../../../../services/examGroupsApi";
import { AssignModal, type AssignExam } from "../assignments/AssignModal";
import { formatVNDate } from "@/utils/dateUtils";

interface KidsExam {
  eId: number;
  eTitle: string;
  eDescription: string | null;
  eDuration: number | null;
  eStatus: string;
  eCreated_at: string;
  eUpdated_at?: string | null;
  updated_at?: string | null;
  eType?: string;
  eSkill?: string;
  ielts_skill?: string;
  ielts_test_type?: string;
  age_group?: string;
  kids_exam_config?: {
    exam_type: string;
    mode: string;
    level: string;
    age_range: string;
  };
  thpt_config?: {
    sections?: Array<{
      type?: string;
      items?: Array<unknown>;
      blanks?: Array<unknown>;
    }>;
  } | null;
  questions?: any[];
  _group?: "vstep" | "ielts" | "adult" | "kids" | "teens";
  _is_owner?: boolean;
  _owner_name?: string;
  eTeacher_id?: number;
  eIs_private?: boolean;
}

export function AllExams() {
  usePageTitle(PAGE_TITLES.TEACHER_EXAMS);
  const toast = useToastContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exams, setExams] = useState<KidsExam[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterAgeGroup, setFilterAgeGroup] = useState<string>("all");
  const [filterOwner, setFilterOwner] = useState<"all" | "mine" | "others">("all");
  const [filterStatus, setFilterStatus] = useState<"published" | "draft">("published");
  const [sortBy, setSortBy] = useState<"updated_desc" | "created_desc" | "created_asc" | "title_asc">("updated_desc");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [assignExams, setAssignExams] = useState<AssignExam[] | null>(null);
  const itemsPerPage = 20;

  // Toggle chọn 1 exam
  const toggleSelect = (examId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(examId)) {
        next.delete(examId);
      } else {
        next.add(examId);
      }
      return next;
    });
  };

  // Bỏ chọn tất cả
  const clearSelection = () => setSelectedIds(new Set());

  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch 4 nhóm song song:
      // 1. VSTEP Full (đề đầy đủ 4 kỹ năng)
      // 2. IELTS Full (đề đầy đủ 4 sections)
      // 3. Adult (General, Business, TOEIC...)
      // 4. Kids (YLE Starters/Movers/Flyers)
      // 5. Teens (để trống cho sau)
      const [vstepRes, ieltsRes, adultRes, kidsRes, teensRes] = await Promise.all([
        getVstepFullExams().catch(() => []),
        getIeltsFullExams().catch(() => []),
        getAdultExams().catch(() => []),
        getKidsExams().catch(() => []),
        api.get("/teacher/exams", { params: { group: "teens" } })
          .then((r) => r.data?.data || []).catch(() => []),
      ]);

      const vstepList: KidsExam[] = Array.isArray(vstepRes) ? vstepRes : [];
      const ieltsList: KidsExam[] = Array.isArray(ieltsRes) ? ieltsRes : [];
      const adultList: KidsExam[] = Array.isArray(adultRes) ? adultRes : [];
      const kidsList: KidsExam[] = Array.isArray(kidsRes) ? kidsRes : [];
      const teensList: KidsExam[] = Array.isArray(teensRes) ? teensRes : [];

      // Gắn nhãn group cho từng exam (để dùng cho filter/stats)
      const tagged = [
        ...vstepList.map((e) => ({ ...e, _group: "vstep" as const })),
        ...ieltsList.map((e) => ({ ...e, _group: "ielts" as const })),
        ...adultList.map((e) => ({ ...e, _group: "adult" as const })),
        ...kidsList.map((e) => ({ ...e, _group: "kids" as const })),
        ...teensList.map((e) => ({ ...e, _group: "teens" as const })),
      ];

      // Dedup theo eId — 1 đề có thể xuất hiện ở nhiều endpoint (vd vừa adult/vstep
      // vừa kids do eType='GENERAL'+age_group='kids'). Ưu tiên giữ bản KIDS để
      // route Sửa/Xem đúng và tránh trùng key React.
      const isKidsTagged = (e: any) =>
        e?.age_group === "kids" || e?._group === "kids" || Boolean(e?.kids_exam_config);
      const byId = new Map<number, (typeof tagged)[number]>();
      for (const e of tagged) {
        const existing = byId.get(e.eId);
        if (!existing) { byId.set(e.eId, e); continue; }
        if (isKidsTagged(e) && !isKidsTagged(existing)) byId.set(e.eId, e);
      }
      const deduped = Array.from(byId.values());

      // Lọc bỏ exam không hợp lệ + sort theo ngày tạo
      const merged = deduped
        .filter((e) => e && e.eId && e.eTitle)
        .sort(
          (a, b) =>
            new Date(b.eCreated_at.replace(' ', 'T') + '+07:00').getTime() -
            new Date(a.eCreated_at.replace(' ', 'T') + '+07:00').getTime()
        );
      setExams(merged);
    } catch (err: any) {
      console.error("Failed to load exams:", err);
      setError(err.message || "Không thể tải danh sách đề thi");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (examId: number) => {
    try {
      const exam = exams.find((e) => e.eId === examId);
      if (!exam) {
        // Đề thi không tồn tại trong danh sách local → xóa khỏi UI
        setExams((prev) => prev.filter((e) => e.eId !== examId));
        setDeleteConfirm(null);
        // Vẫn refetch để đồng bộ
        await loadExams();
        return;
      }

      // Xác định endpoint dựa trên age_group hoặc kids_exam_config
      // QUAN TRỌNG: backend trả kids_exam_config = null cho đề non-kids, nên
      // KHÔNG dùng `!== undefined` (null !== undefined = true → route nhầm sang
      // endpoint kids → xóa thất bại 404 → đề "sống lại"). Phải dùng Boolean()
      // + _group tag để nhận diện kids chính xác.
      const isKidsExam =
        (exam as any)._group === "kids" ||
        (exam as any).age_group === "kids" ||
        Boolean(exam.kids_exam_config);

      if (isKidsExam) {
        await deleteKidsExam(examId);
      } else {
        // VSTEP / IELTS / General ...
        await api.delete(`/teacher/exams/${examId}`);
      }

      // Cập nhật local state ngay
      setExams((prev) => prev.filter((e) => e.eId !== examId));
      setDeleteConfirm(null);

      // Log activity (best-effort)
      import("../../../../services/teacherActivityLog").then(({ logTeacherActivity }) => {
        logTeacherActivity({
          action: "exam.delete",
          entity_type: "exam",
          entity_id: examId,
          detail: `Xoá đề thi: ${exam.eTitle}`,
          meta: { type: (exam as any).eType },
        });
      });

      // ✅ Toast thành công
      toast.success(`Đã xóa đề thi "${exam.eTitle}" thành công!`);

      // Refetch để đảm bảo đồng bộ với server (loại bỏ các đề thi khác đã bị xóa trước)
      await loadExams();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        // Đề thi đã bị xóa trước đó → xóa khỏi UI + refetch để đồng bộ các đề thi khác
        setExams((prev) => prev.filter((e) => e.eId !== examId));
        setDeleteConfirm(null);
        toast.info("Đề thi đã được xóa trước đó - đang đồng bộ danh sách");
        // Refetch quan trọng: các đề thi khác đã xóa trên server sẽ bị loại bỏ
        await loadExams();
      } else {
        toast.error(
          "Không thể xóa đề thi: " + (err.response?.data?.message || err.message)
        );
      }
    }
  };

  // Xóa nhiều exam
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const targetExams = exams.filter((e) => selectedIds.has(e.eId));
    let successCount = 0;
    let failCount = 0;

    for (const exam of targetExams) {
      const isKidsExam =
        (exam as any)._group === "kids" ||
        (exam as any).age_group === "kids" ||
        Boolean(exam.kids_exam_config);
      try {
        if (isKidsExam) {
          await deleteKidsExam(exam.eId);
        } else {
          await api.delete(`/teacher/exams/${exam.eId}`);
        }
        successCount++;
        setExams((prev) => prev.filter((e) => e.eId !== exam.eId));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(exam.eId);
          return next;
        });
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 404) {
          // đã bị xóa trước đó
          successCount++;
          setExams((prev) => prev.filter((e) => e.eId !== exam.eId));
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(exam.eId);
            return next;
          });
        } else {
          failCount++;
        }
      }
    }

    setBulkDeleting(false);
    setBulkDeleteConfirm(false);

    if (failCount > 0) {
      toast.warning(
        `Đã xóa ${successCount} đề thi. ${failCount} đề thi xóa thất bại.`
      );
    } else {
      toast.success(`Đã xóa thành công ${successCount} đề thi!`);
    }

    // Refetch để đồng bộ
    await loadExams();
  };

  // Filter exams - đã move lên trên (trước stats)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
    // Clear selection khi filter thay đổi để tránh xóa nhầm
    setSelectedIds(new Set());
    setOpenMenuId(null);
  }, [searchQuery, filterType, filterAgeGroup, filterOwner, filterStatus]);

  // Đóng dropdown menu khi click ra ngoài
  useEffect(() => {
    if (openMenuId === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-card-menu]")) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  // Validate exam tồn tại khi mount - lọc bỏ exam không hợp lệ khỏi state
  useEffect(() => {
    setExams((prev) =>
      prev.filter((e) => e && e.eId && e.eTitle)
    );
  }, []);

  // Calculate stats by age group - ưu tiên dùng _group tag từ API
  // Mapping (chỉ có 3 nhóm học viên thực tế: kids / teens / adults):
  //   Kids   → "kids" (Trẻ em 6-12)
  //   Teens  → "teens" (Học sinh 13-17)
  //   Adult / VSTEP / IELTS → "adults" (Sinh viên + người trưởng thành)
  const getAgeGroup = (exam: KidsExam & { _group?: string }) => {
    if (exam._group === "kids") return "kids";
    if (exam._group === "teens") return "teens";
    // VSTEP, IELTS, Adult, General... đều thuộc adults
    if (exam._group === "vstep" || exam._group === "ielts" || exam._group === "adult") {
      return "adults";
    }

    // Fallback: check kids_exam_config / age_range
    const ageRange = exam.kids_exam_config?.age_range || "all";
    if (ageRange === "kids" || ageRange.includes("6-8") || ageRange.includes("8-11") || ageRange.includes("9-12")) return "kids";
    if (ageRange === "teens" || ageRange.includes("13-17")) return "teens";
    if (ageRange === "adults" || ageRange.includes("18+") || ageRange.includes("university") || ageRange === "professionals" || ageRange.includes("working")) return "adults";
    return "all";
  };

  // ── Predicates tách riêng để badge nhóm tuổi KHỚP CHÍNH XÁC với danh sách ──
  const matchesSearchFn = (exam: KidsExam) =>
    exam.eTitle.toLowerCase().includes(searchQuery.toLowerCase());

  const matchesTypeFn = (exam: KidsExam & { _group?: string }) => {
    if (filterType === "all") return true;
    const kidsType = exam.kids_exam_config?.exam_type;
    const eType = (exam.eType || "").toLowerCase();
    const group = exam._group;
    const filterLower = filterType.toLowerCase();
    if (kidsType && kidsType.toLowerCase() === filterLower) return true;
    if (eType === filterLower) return true;
    if (
      (filterLower === "vstep" && (group === "vstep" || eType === "vstep")) ||
      (filterLower === "ielts" && (group === "ielts" || eType === "ielts"))
    ) return true;
    return false;
  };

  const matchesAgeFn = (exam: KidsExam & { _group?: string }) => {
    if (filterAgeGroup === "all") return true;
    const examAgeGroup = getAgeGroup(exam);
    if (examAgeGroup === "all") return true; // chưa phân loại → match mọi filter
    return examAgeGroup === filterAgeGroup;
  };

  const matchesOwnerFn = (exam: KidsExam) => {
    if (filterOwner === "mine") return exam._is_owner === true;
    if (filterOwner === "others") return exam._is_owner === false;
    return true;
  };

  const matchesStatusFn = (exam: KidsExam) => {
    // eStatus có thể là 'draft', 'published', 'active', 'inactive', 'archived'
    const status = (exam.eStatus || "").toLowerCase();
    if (filterStatus === "draft") return status === "draft";
    return status === "published" || status === "active";
  };

  // Base cho badge nhóm tuổi: áp MỌI filter trừ nhóm tuổi → bấm "Người lớn" hiện đúng số trên badge
  const ageStatsBase = exams.filter(e =>
    matchesSearchFn(e) && matchesTypeFn(e) && matchesOwnerFn(e) && matchesStatusFn(e)
  );

  const filteredExams = exams.filter(e =>
    matchesSearchFn(e) && matchesTypeFn(e) && matchesAgeFn(e) && matchesOwnerFn(e) && matchesStatusFn(e)
  );

  // Sort filtered exams theo lựa chọn của user.
  // updated_desc = vừa chỉnh sửa gần nhất (mặc định, dùng updated_at fallback created_at)
  filteredExams.sort((a, b) => {
    const ts = (e: KidsExam) => {
      if (sortBy === "title_asc") return 0;
      const u = e.eUpdated_at || e.updated_at;
      const c = e.eCreated_at;
      const src = sortBy === "updated_desc" ? u || c : c;
      return src ? new Date(src.replace(' ', 'T') + '+07:00').getTime() : 0;
    };
    if (sortBy === "title_asc") {
      return (a.eTitle || "").localeCompare(b.eTitle || "", "vi");
    }
    const tA = ts(a);
    const tB = ts(b);
    return sortBy === "created_asc" ? tA - tB : tB - tA;
  });

  const stats = {
    total: exams.length,
    ageTotal: ageStatsBase.length,
    kids: ageStatsBase.filter(e => getAgeGroup(e) === "kids").length,
    teens: ageStatsBase.filter(e => getAgeGroup(e) === "teens").length,
    adults: ageStatsBase.filter(e => getAgeGroup(e) === "adults").length,
    mine: exams.filter(e => e._is_owner === true).length,
    others: exams.filter(e => e._is_owner === false).length,
    draft: exams.filter(e => (e.eStatus || "").toLowerCase() === "draft").length,
    published: exams.filter(e => {
      const s = (e.eStatus || "").toLowerCase();
      return s === "published" || s === "active";
    }).length,
  };

  // Pagination - lọc thêm lần nữa để chắc chắn không có exam không hợp lệ
  const totalPages = Math.ceil(filteredExams.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedExams = filteredExams
    .filter((exam) => exam && exam.eId && exam.eTitle)
    .slice(startIndex, endIndex);

  // Get exam type display info
  const getExamTypeInfo = (exam: KidsExam) => {
    const examType = exam.kids_exam_config?.exam_type;
    const types: Record<string, { label: string; color: string }> = {
      yle_starters: { label: "Starters", color: "#EA580C" },
      yle_movers: { label: "Movers", color: "#F97316" },
      yle_flyers: { label: "Flyers", color: "#FB923C" },
      ielts: { label: "IELTS", color: "#3B82F6" },
      toefl: { label: "TOEFL", color: "#8B5CF6" },
      toeic: { label: "TOEIC", color: "#10B981" },
      business: { label: "Business", color: "#F59E0B" },
      general: { label: "Tổng hợp", color: "#6B7280" },
    };
    if (examType && types[examType.toLowerCase()]) return types[examType.toLowerCase()];

    // Fallback theo eType (VSTEP, IELTS, GENERAL...)
    if (exam.eType === "VSTEP") {
      const skill = (exam.eSkill || "").toLowerCase();
      if (skill === "mixed") return { label: "VSTEP Full", color: "#7C3AED" };
      if (skill === "listening") return { label: "VSTEP Listening", color: "#0EA5E9" };
      if (skill === "reading") return { label: "VSTEP Reading", color: "#10B981" };
      if (skill === "writing") return { label: "VSTEP Writing", color: "#F59E0B" };
      if (skill === "speaking") return { label: "VSTEP Speaking", color: "#EC4899" };
      return { label: "VSTEP", color: "#7C3AED" };
    }
    if (exam.eType === "IELTS") return { label: "IELTS", color: "#3B82F6" };
    if (examType) return { label: examType, color: "#6B7280" };
    return { label: "Chưa phân loại", color: "#6B7280" };
  };

  // Đếm câu hỏi tuỳ theo loại đề. THPT lưu trong thpt_config.sections[],
  // các loại khác có quan hệ Question hoặc backend trả questions_count.
  const countExamQuestions = (exam: KidsExam): number => {
    const eType = (exam.eType || "").toUpperCase();

    // THPT: đếm từ thpt_config.sections[]
    if (eType === "THPT" && exam.thpt_config?.sections) {
      let total = 0;
      for (const sec of exam.thpt_config.sections) {
        if (sec?.items?.length) total += sec.items.length;
        else if (sec?.blanks?.length) total += sec.blanks.length;
      }
      if (total > 0) return total;
    }

    // Default: questions_count từ backend, fallback questions[].length
    return (exam as any).questions_count ?? exam.questions?.length ?? 0;
  };

  // Đường dẫn chỉnh sửa tuỳ theo loại đề
  const getEditLink = (exam: KidsExam) => {
    const eType = (exam.eType || "").toUpperCase();
    const group = (exam as any)._group || "";

    // IELTS: detect qua eType hoặc _group, cần biết skill để route đúng
    if (eType === "IELTS" || group === "ielts") {      const skill = (
        exam.ielts_skill ||
        (exam.eSkill || "").toLowerCase()
      ).toLowerCase();
      const validSkills = ["listening", "reading", "writing", "speaking"];
      const s = validSkills.includes(skill) ? skill : "listening";
      return `/giao-vien/de-thi/ielts/${s}/edit/${exam.eId}`;
    }

    // THPT — đề ĐGNL/THPT cấp 2-3 (eType=THPT, lưu trong thpt_config)
    if (eType === "THPT" || group === "thpt") {
      return `/giao-vien/de-thi/thpt/${exam.eId}/sua`;
    }

    // Kids — phải kiểm tra "truthy" (backend trả null cho non-Kids,
    // không phải undefined → tránh false-positive)
    const isKidsExam =
      (exam as any).age_group === "kids" ||
      Boolean(exam.kids_exam_config) ||
      eType === "KIDS";
    if (isKidsExam) {
      return `/giao-vien/de-thi/kids/tao-moi/${exam.eId}`;
    }

    // VSTEP
    if (eType === "VSTEP" || group === "vstep") {
      const skill = (exam.eSkill || "").toLowerCase();
      if (skill === "mixed") return `/giao-vien/de-thi/vstep/full/sua/${exam.eId}`;
      if (skill && ["listening", "reading", "writing", "speaking"].includes(skill))
        return `/giao-vien/de-thi/vstep/${skill}/sua/${exam.eId}`;
      return `/giao-vien/de-thi/${exam.eId}`;
    }

    return `/giao-vien/de-thi/${exam.eId}`;
  };

  // Đường dẫn preview tuỳ theo loại đề
  // Đề THPT/Kids preview thực chất mở editor (route /sua hoặc /tao-moi), nên nút
  // nên ghi "Xem và sửa" thay vì "Xem chi tiết".
  const isEditorPreview = (exam: KidsExam) => {
    const eType = (exam.eType || "").toUpperCase();
    const group = (exam as any)._group || "";
    // Kids giờ dùng trang xem chung (read-only), KHÔNG mở editor → không phải editor preview.
    if (eType === "THPT" || group === "thpt") return true;
    return false;
  };

  const getPreviewLink = (exam: KidsExam) => {
    const eType = (exam.eType || "").toUpperCase();
    const group = (exam as any)._group || "";

    // Kids ưu tiên TRƯỚC mọi loại khác: đề kids có thể bị lưu eType='VSTEP'/'GENERAL'
    // hoặc lọt nhầm nhóm vstep/adult → phải chặn ở đây để không mở preview VSTEP.
    // Dùng trang xem chung (ExamPlayer + QuestionRenderer) — render đủ dạng kids,
    // KHÔNG mở editor (editor strict shape, dễ crash với dữ liệu cũ/seed).
    const isKidsExam =
      (exam as any).age_group === "kids" ||
      Boolean(exam.kids_exam_config) ||
      eType === "KIDS";
    if (isKidsExam) {
      return `/giao-vien/de-thi/${exam.eId}/xem-moi`;
    }

    // IELTS preview: cần skill để route đúng
    if (eType === "IELTS" || group === "ielts") {
      const skill = (
        exam.ielts_skill ||
        (exam.eSkill || "").toLowerCase()
      ).toLowerCase();
      const validSkills = ["listening", "reading", "writing", "speaking"];
      const s = validSkills.includes(skill) ? skill : "listening";
      return `/giao-vien/de-thi/ielts/${s}/xem/${exam.eId}`;
    }

    if (eType === "VSTEP" || group === "vstep") {
      return `/giao-vien/de-thi/${exam.eId}/vstep`;
    }

    // THPT — dùng chung editor (có thể chỉ xem). Trang preview riêng chưa có,
    // legacy /de-thi/:id/xem không hiểu thpt_config nên hiện "0 câu hỏi".
    if (eType === "THPT" || group === "thpt") {
      return `/giao-vien/de-thi/thpt/${exam.eId}/sua`;
    }

    // GENERAL / đề trắc nghiệm tổng hợp (teens luyện tập…) → preview danh sách câu hỏi.
    return `/giao-vien/de-thi/${exam.eId}/xem-de`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F9FAFB]">
      {/* Header - sticky, clean */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <nav className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                <Link to="/giao-vien" className="hover:text-gray-900 transition-colors">
                  Dashboard
                </Link>
                <span className="text-gray-300">/</span>
                <span className="text-gray-700">Ngân hàng đề thi</span>
              </nav>
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-gray-500" strokeWidth={2} />
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight truncate">
                  Ngân hàng đề thi
                </h1>
              </div>
            </div>
            <Link
              to="/giao-vien/de-thi/tao-moi"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors flex-shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Tạo đề mới
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-14 h-14 border-4 border-gray-200 border-t-orange-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-sm text-gray-600">Đang tải dữ liệu...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-900">Có lỗi xảy ra</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Stats & Age Group Filter - Clean grid layout */}
        {!loading && !error && (() => {
          const groups = [
            { key: "all" as const, label: "Tất cả", icon: Layers, count: stats.ageTotal, hint: "Toàn bộ đề thi" },
            { key: "kids" as const, label: "Trẻ em", icon: Baby, count: stats.kids, hint: "6-12 tuổi" },
            { key: "teens" as const, label: "Học sinh", icon: BookOpen, count: stats.teens, hint: "13-17 tuổi" },
            { key: "adults" as const, label: "Người lớn", icon: GraduationCap, count: stats.adults, hint: "18+ tuổi" },
          ];

          return (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-100">
                <h2 className="text-xs font-semibold text-gray-700">Lọc theo nhóm tuổi học viên</h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
                {groups.map(({ key, label, icon: Icon, count, hint }) => {
                  const isActive = filterAgeGroup === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setFilterAgeGroup(key)}
                      className={`relative px-4 py-2.5 text-left transition-colors cursor-pointer ${
                        isActive ? "bg-gray-50" : "hover:bg-gray-50/60"
                      }`}
                    >
                      {isActive && (
                        <span className="absolute top-0 left-0 right-0 h-0.5 bg-gray-900" />
                      )}
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className={`w-3.5 h-3.5 ${isActive ? "text-gray-900" : "text-gray-400"}`} strokeWidth={2} />
                        <span className={`text-xs font-medium ${isActive ? "text-gray-900" : "text-gray-600"}`}>
                          {label}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-xl font-bold tabular-nums leading-none ${
                          isActive ? "text-gray-900" : "text-gray-700"
                        }`}>
                          {count}
                        </span>
                        <span className="text-[11px] text-gray-400">đề · {hint}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Refined Search & Filters - Inline Design */}
        {!loading && !error && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="space-y-3">
              {/* Search bar */}
              <div className="relative">
                <Search className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm theo tên đề thi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm bg-white placeholder-gray-400 transition-shadow"
                />
              </div>
              
              {/* Filters - Inline */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-gray-600">Lọc theo:</span>

                {/* Owner Filter Tabs */}
                <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                  <button
                    onClick={() => setFilterOwner("all")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      filterOwner === "all"
                        ? "bg-white text-orange-600 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    title="Hiển thị đề của bạn và đề public của giáo viên khác"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Tất cả
                    <span className="ml-1 text-[10px] font-mono opacity-70">({stats.total})</span>
                  </button>
                  <button
                    onClick={() => setFilterOwner("mine")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      filterOwner === "mine"
                        ? "bg-white text-orange-600 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    Của tôi
                    <span className="ml-1 text-[10px] font-mono opacity-70">({stats.mine})</span>
                  </button>
                  <button
                    onClick={() => setFilterOwner("others")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      filterOwner === "others"
                        ? "bg-white text-orange-600 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    title="Đề công khai từ các giáo viên khác trong hệ thống"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Từ giáo viên khác
                    <span className="ml-1 text-[10px] font-mono opacity-70">({stats.others})</span>
                  </button>
                </div>

                {/* Status Filter Tabs (Đã xuất bản / Nháp) — luôn chọn 1 trong 2 */}
                <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                  <button
                    onClick={() => setFilterStatus("published")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      filterStatus === "published"
                        ? "bg-white text-emerald-600 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    title="Đề đã xuất bản, học viên có thể làm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Đã xuất bản
                    <span className="ml-1 text-[10px] font-mono opacity-70">({stats.published})</span>
                  </button>
                  <button
                    onClick={() => setFilterStatus("draft")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      filterStatus === "draft"
                        ? "bg-white text-amber-600 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    title="Đề nháp đang soạn dở (thiếu file/câu hỏi/đáp án)"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Nháp
                    <span className="ml-1 text-[10px] font-mono opacity-70">({stats.draft})</span>
                  </button>
                </div>
                
                {/* Age Group Filter */}
                <select
                  value={filterAgeGroup}
                  onChange={(e) => setFilterAgeGroup(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-xs bg-white font-medium text-gray-700 cursor-pointer hover:border-gray-400 transition-colors"
                >
                  <option value="all">Tất cả nhóm tuổi</option>
                  <option value="kids">Trẻ em (6-12)</option>
                  <option value="teens">Học sinh (13-17)</option>
                  <option value="adults">Sinh viên / Người đi làm (18+)</option>
                </select>
                
                {/* Exam Type Filter */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-xs bg-white font-medium text-gray-700 cursor-pointer hover:border-gray-400 transition-colors"
                >
                  <option value="all">Tất cả loại đề</option>

                  {/* Kids exam types */}
                  {(filterAgeGroup === "all" || filterAgeGroup === "kids") && (
                    <optgroup label="Trẻ em (Cambridge YLE)">
                      <option value="yle_starters">Starters (6-8)</option>
                      <option value="yle_movers">Movers (8-11)</option>
                      <option value="yle_flyers">Flyers (9-12)</option>
                    </optgroup>
                  )}

                  {/* Teens — THCS / THPT / ĐGNL */}
                  {(filterAgeGroup === "all" || filterAgeGroup === "teens") && (
                    <optgroup label="Học sinh (THCS / THPT / ĐGNL)">
                      <option value="thpt">THPT / Đánh giá năng lực</option>
                    </optgroup>
                  )}

                  {/* Adults — chứng chỉ quốc tế */}
                  {(filterAgeGroup === "all" || filterAgeGroup === "adults") && (
                    <optgroup label="Sinh viên / Người đi làm">
                      <option value="vstep">VSTEP</option>
                      <option value="ielts">IELTS</option>
                      <option value="cambridge">Cambridge (KET / PET / FCE…)</option>
                      <option value="toefl">TOEFL</option>
                      <option value="toeic">TOEIC</option>
                    </optgroup>
                  )}

                  {/* General — dùng được cho teens & adults */}
                  {filterAgeGroup !== "kids" && (
                    <optgroup label="Khác">
                      <option value="general">Đề tổng hợp</option>
                    </optgroup>
                  )}
                </select>

                {/* Sort dropdown */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-xs bg-white font-medium text-gray-700 cursor-pointer hover:border-gray-400 transition-colors"
                  title="Sắp xếp"
                >
                  <option value="updated_desc">Vừa chỉnh sửa</option>
                  <option value="created_desc">Mới tạo nhất</option>
                  <option value="created_asc">Cũ nhất</option>
                  <option value="title_asc">Tên A → Z</option>
                </select>
                
                {/* Clear filters */}
                {(filterAgeGroup !== "all" || filterType !== "all" || filterOwner !== "all") && (
                  <button 
                    onClick={() => { setFilterAgeGroup("all"); setFilterType("all"); setFilterOwner("all"); }}
                    className="text-xs text-orange-600 hover:text-orange-700 font-semibold ml-auto transition-colors"
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>
              
              {/* Results count */}
              <div className="text-xs text-gray-600 pt-2 border-t border-gray-100">
                Hiển thị <span className="font-semibold text-gray-900">{filteredExams.length}</span> đề thi
              </div>
            </div>
          </div>
        )}

        {/* Bulk Action Bar — ẩn ở trạng thái mặc định cho gọn, chỉ hiện khi đã chọn ≥1 đề */}
        {!loading && !error && selectedIds.size > 0 && (
          <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-2.5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  // Chỉ select đề của chính mình (không thể bulk delete đề của giáo viên khác)
                  const ownedPageExams = paginatedExams.filter((e) => e._is_owner !== false);
                  const pageIds = ownedPageExams.map((e) => e.eId);
                  if (pageIds.length === 0) return;
                  const allSelected = pageIds.every((id) => selectedIds.has(id));
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (allSelected) {
                      pageIds.forEach((id) => next.delete(id));
                    } else {
                      pageIds.forEach((id) => next.add(id));
                    }
                    return next;
                  });
                }}
                className="group flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-orange-600 rounded-lg hover:bg-orange-50 transition-colors cursor-pointer"
              >
                {(() => {
                  const ownedExams = paginatedExams.filter((e) => e._is_owner !== false);
                  const allOwnedSelected = ownedExams.length > 0 && ownedExams.every((e) => selectedIds.has(e.eId));
                  return (
                    <>
                      {allOwnedSelected ? (
                        <CheckSquare className="w-4 h-4 text-orange-600" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400 group-hover:text-orange-500" />
                      )}
                      <span>
                        {allOwnedSelected ? "Bỏ chọn tất cả" : "Chọn tất cả trang này"}
                      </span>
                    </>
                  );
                })()}
              </button>
              {selectedIds.size > 0 && (
                <span className="text-xs text-gray-500">
                  • Đã chọn{" "}
                  <span className="font-semibold text-orange-600">
                    {selectedIds.size}
                  </span>{" "}
                  đề thi
                </span>
              )}
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={clearSelection}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Hủy chọn
                </button>
                <button
                  onClick={() => setBulkDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa {selectedIds.size} đề thi
                </button>
              </div>
            )}
          </div>
        )}

        {/* Refined Exam Cards Grid */}
        {!loading && !error && paginatedExams.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedExams.map((exam) => {
              if (!exam || !exam.eId || !exam.eTitle) return null;
              const typeInfo = getExamTypeInfo(exam);
              const isSelected = selectedIds.has(exam.eId);
              const isOwner = exam._is_owner !== false;
              return (
                <div
                  key={exam.eId}
                  onClick={(e) => {
                    if (!isOwner) return;
                    const target = e.target as HTMLElement;
                    if (
                      !target.closest("a") &&
                      !target.closest("button") &&
                      !target.closest("input")
                    ) {
                      toggleSelect(exam.eId);
                    }
                  }}
                  className={`group relative bg-white rounded-xl border transition-all duration-200 flex flex-col h-full ${
                    isOwner ? "cursor-pointer" : ""
                  } ${
                    isSelected
                      ? "border-gray-900 ring-2 ring-gray-900/5 shadow-md"
                      : "border-gray-200 hover:border-gray-300 hover:shadow-lg hover:-translate-y-0.5"
                  }`}
                >
                  {/* Wrapper clip cho blob + stripe để không tràn ra ngoài card */}
                  <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                    {/* Decorative gradient blob theo type color */}
                    <div
                      className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-30"
                      style={{ background: `radial-gradient(circle, ${typeInfo.color}, transparent 70%)` }}
                      aria-hidden="true"
                    />
                    {/* Selection indicator stripe */}
                    {isSelected && (
                      <span className="absolute top-0 left-0 right-0 h-0.5 bg-gray-900" />
                    )}
                  </div>

                  {/* Card body */}
                  <div className="relative p-4 flex-1 flex flex-col">
                    {/* Top row: checkbox/owner-badge + status */}
                    <div className="flex items-center justify-between gap-2 mb-3 min-h-[24px]">
                      {isOwner ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(exam.eId);
                          }}
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 ${
                            isSelected
                              ? "bg-gray-900 border-gray-900"
                              : "bg-white/80 border-gray-300 hover:border-gray-500"
                          }`}
                          aria-label={isSelected ? "Bỏ chọn" : "Chọn đề thi"}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </button>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100 max-w-[140px]"
                          title={`Đề công khai từ ${exam._owner_name || "giáo viên khác"}`}
                        >
                          <Users className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{exam._owner_name || "Giáo viên khác"}</span>
                        </span>
                      )}

                      <div className="flex items-center gap-1.5">
                        {exam.eStatus === "draft" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                            <span className="w-1 h-1 rounded-full bg-amber-500" />
                            Nháp
                          </span>
                        )}
                        {(exam.eStatus === "published" || exam.eStatus === "active") && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <span className="w-1 h-1 rounded-full bg-emerald-500" />
                            Đã xuất bản
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-gray-400">#{exam.eId}</span>
                      </div>
                    </div>

                    {/* Type badge with subtle accent */}
                    <div className="mb-2.5">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border"
                        style={{
                          backgroundColor: `${typeInfo.color}10`,
                          color: typeInfo.color,
                          borderColor: `${typeInfo.color}30`,
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: typeInfo.color }}
                        />
                        {typeInfo.label}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-[15px] font-semibold text-gray-900 leading-snug line-clamp-2 mb-1.5 transition-colors group-hover:text-gray-700">
                      {exam.eTitle}
                    </h3>

                    {/* Description — luôn reserve chỗ (min-height) để các thẻ thẳng hàng
                        dù có hay không có mô tả */}
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-3 min-h-[2rem]">
                      {exam.eDescription || ""}
                    </p>

                    {/* Meta row: questions · duration · date */}
                    <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-auto">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-gray-400" />
                        {countExamQuestions(exam)} câu
                      </span>
                      {exam.eDuration && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {exam.eDuration} phút
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 ml-auto">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {formatVNDate(exam.eCreated_at.replace(' ', 'T') + '+07:00')}
                      </span>
                    </div>
                  </div>

                  {/* Actions footer — đồng nhất cả owner và non-owner.
                      Đề nháp → đổi nút thành "Sửa" để tránh dẫn vào trang preview chưa hoàn chỉnh */}
                  <div className="relative flex items-center gap-2 px-4 py-2.5 bg-gray-50/80 backdrop-blur-sm border-t border-gray-100 rounded-b-xl">
                    {isOwner && exam.eStatus === "draft" ? (
                      <Link
                        to={getEditLink(exam)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors bg-amber-600 text-white hover:bg-amber-700"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Tiếp tục chỉnh sửa
                      </Link>
                    ) : (
                      <Link
                        to={getPreviewLink(exam)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors bg-gray-900 text-white hover:bg-gray-800"
                      >
                        {isEditorPreview(exam) ? (
                          <>
                            <Edit className="w-3.5 h-3.5" />
                            Xem và sửa
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            Xem chi tiết
                          </>
                        )}
                      </Link>
                    )}

                    {/* Giao đề — chỉ cho đề đã xuất bản (không phải nháp) */}
                    {exam.eStatus !== "draft" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssignExams([
                            { eId: exam.eId, eTitle: exam.eTitle, eType: exam.eType, ageGroup: getAgeGroup(exam) },
                          ]);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors bg-indigo-600 text-white hover:bg-indigo-700 whitespace-nowrap"
                        title="Giao đề cho học viên"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Giao đề
                      </button>
                    )}

                    {isOwner && (
                      <div className="relative" data-card-menu>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === exam.eId ? null : exam.eId);
                          }}
                          className="inline-flex items-center justify-center w-8 h-8 text-gray-500 bg-white border border-gray-200 rounded-md hover:bg-gray-100 hover:text-gray-900 hover:border-gray-300 transition-colors cursor-pointer"
                          title="Tùy chọn"
                          aria-label="Tùy chọn khác"
                          aria-expanded={openMenuId === exam.eId}
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {openMenuId === exam.eId && (
                          <div
                            className="absolute bottom-full right-0 mb-1.5 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Ẩn "Chỉnh sửa" trong dropdown khi nút chính đã là "Tiếp tục chỉnh sửa" (draft) */}
                            {exam.eStatus !== "draft" && (
                              <Link
                                to={getEditLink(exam)}
                                onClick={() => setOpenMenuId(null)}
                                className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors cursor-pointer"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                Chỉnh sửa
                              </Link>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                setDeleteConfirm(exam.eId);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Xóa đề thi
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Refined Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">{startIndex + 1}-{Math.min(endIndex, filteredExams.length)}</span> trong tổng số <span className="font-medium text-gray-900">{filteredExams.length}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === 1
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Trước
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    const showPage = 
                      page === 1 || 
                      page === totalPages || 
                      (page >= currentPage - 1 && page <= currentPage + 1);
                    
                    const showEllipsis = 
                      (page === currentPage - 2 && currentPage > 3) ||
                      (page === currentPage + 2 && currentPage < totalPages - 2);

                    if (showEllipsis) {
                      return (
                        <span key={page} className="px-2 text-gray-400">
                          ...
                        </span>
                      );
                    }

                    if (!showPage) return null;

                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-9 h-9 rounded-md text-sm font-medium transition-colors ${
                          currentPage === page
                            ? "bg-gray-900 text-white"
                            : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === totalPages
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Sau
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
        )}

        {/* Refined Empty State */}
        {!loading && !error && filteredExams.length === 0 && (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery || filterType !== "all" ? "Không tìm thấy đề thi" : "Chưa có đề thi nào"}
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              {searchQuery || filterType !== "all" || filterAgeGroup !== "all"
                ? "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm"
                : "Hãy tạo đề thi đầu tiên của bạn"
              }
            </p>
            {!searchQuery && filterType === "all" && filterAgeGroup === "all" && (
              <Link
                to="/giao-vien/de-thi/tao-moi"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors text-sm font-medium cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Tạo đề thi đầu tiên
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 p-4 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative bg-white rounded-xl p-6 max-w-md w-full shadow-xl border border-gray-200">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-red-600" strokeWidth={2.25} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Xác nhận xóa đề thi
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Bạn có chắc chắn muốn xóa đề thi này?
                  <span className="block mt-1 text-red-600 font-medium">
                    Hành động này không thể hoàn tác.
                  </span>
                </p>
              </div>
            </div>

            {/* Warning info box */}
            <div className="mb-5 px-3 py-2 bg-red-50 border border-red-100 rounded-md">
              <div className="flex items-center gap-2 text-xs text-red-700">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Đề thi và tất cả câu hỏi sẽ bị xóa vĩnh viễn</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Xóa đề thi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 p-4 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative bg-white rounded-xl p-6 max-w-md w-full shadow-xl border border-gray-200">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-6 h-6 text-red-600" strokeWidth={2.25} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Xóa {selectedIds.size} đề thi?
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Bạn đang chọn xóa{" "}
                  <span className="font-bold text-red-600">
                    {selectedIds.size}
                  </span>{" "}
                  đề thi cùng lúc.
                  <span className="block mt-1 text-red-600 font-medium">
                    Hành động này không thể hoàn tác.
                  </span>
                </p>
              </div>
            </div>

            <div className="mb-5 px-3 py-2.5 bg-red-50 border border-red-100 rounded-md max-h-40 overflow-y-auto">
              <div className="text-xs text-red-700 font-medium mb-2">
                Danh sách đề thi sẽ bị xóa:
              </div>
              <ul className="space-y-1">
                {Array.from(selectedIds).map((id) => {
                  const exam = exams.find((e) => e.eId === id);
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-2 text-xs text-red-700"
                    >
                      <span className="w-1 h-1 bg-red-500 rounded-full" />
                      <span className="font-mono text-red-500">#{id}</span>
                      <span className="truncate">
                        {exam?.eTitle || "(không tồn tại)"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setBulkDeleteConfirm(false)}
                disabled={bulkDeleting}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Hủy
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {bulkDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Xóa {selectedIds.size} đề thi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal — giao đề cho học viên (từ card "Giao đề") */}
      <AssignModal
        open={assignExams !== null}
        exams={assignExams ?? []}
        onClose={() => setAssignExams(null)}
        onAssigned={() => setAssignExams(null)}
      />
    </div>
  );
}

import { useState, useEffect } from "react";
import { Link } from "react-router";
import { teacherApi } from "../../../../services/teacherApi";
import { usePageTitle, PAGE_TITLES } from "../../../../hooks/usePageTitle";
import { formatVNDate } from "@/utils/dateUtils";
import {
  FileText,
  Plus,
  LayoutTemplate,
  Search,
  X,
  Grid3x3,
  List,
  ChevronDown,
  Clock,
  HelpCircle,
  Eye,
  Edit,
  Copy,
  Trash2,
  MoreVertical, 
  Users,
  Target,
  Calendar,
  Send,
  Download,
  Archive,
  TrendingUp,
  BarChart3,
  CheckCircle2,
  BookOpen,
  Headphones,
  Pen,
  MessageSquare,
  Activity,
} from "lucide-react";

interface Exam {
  id: string;
  title: string;
  description: string;
  type: "VSTEP" | "IELTS" | "Cambridge" | "General";
  skill: string;
  duration: number;
  questions: number;
  points: number;
  status: "Draft" | "Published" | "Private" | "Pending";
  source: "Manual" | "Template" | "Upload";
  createdAt: string;
  modifiedAt: string;
  createdFrom?: string;
  assignments: number;
  submissions: number;
  avgScore: number;
  completionRate: number;
  avgTimeSpent: number;
  // Internal fields để route Sửa/Xem đúng
  _eType?: string;
  _eSkill?: string;
  _eScope?: string;
  _ielts_skill?: string;
  _eId?: number;
}

/**
 * Map eStatus từ backend sang status UI.
 * Backend dùng: 'draft' | 'published' | 'active' | 'inactive' | 'archived' | 'private'
 */
/** Đếm số câu hỏi của đề, có xét THPT (lưu trong thpt_config.sections[]). */
function countExamQuestionsFor(exam: any): number {
  const eType = (exam?.eType || "").toUpperCase();
  if (eType === "THPT" && exam?.thpt_config?.sections) {
    let total = 0;
    for (const sec of exam.thpt_config.sections) {
      if (sec?.items?.length) total += sec.items.length;
      else if (sec?.blanks?.length) total += sec.blanks.length;
    }
    if (total > 0) return total;
  }
  return exam?.questions_count ?? exam?.questionsCount ?? exam?.questions?.length ?? 0;
}

function deriveStatus(exam: any): "Draft" | "Published" | "Private" | "Pending" {
  const s = (exam.eStatus || "").toLowerCase();
  // Đề chưa có câu hỏi → luôn là Nháp (không thể giao/làm bài).
  if (countExamQuestionsFor(exam) === 0 && s !== "pending") return "Draft";
  if (s === "published" || s === "active") return "Published";
  if (s === "pending") return "Pending";
  if (s === "private") return "Private";
  if (exam.eIs_private === true) return "Private";
  if (exam.eIs_published === true) return "Published";
  return "Draft";
}

const typeColors: Record<string, string> = {
  VSTEP: "bg-orange-100 text-orange-700 border-orange-200",
  IELTS: "bg-green-100 text-green-700 border-green-200",
  Cambridge: "bg-purple-100 text-purple-700 border-purple-200",
  General: "bg-gray-100 text-gray-700 border-gray-200",
  THPT: "bg-blue-100 text-blue-700 border-blue-200",
  KIDS: "bg-orange-100 text-orange-700 border-orange-200",
};

const skillIcons: Record<string, typeof Headphones> = {
  Listening: Headphones,
  Reading: BookOpen,
  Writing: Pen,
  Speaking: MessageSquare,
};

/** Lấy icon kỹ năng an toàn — fallback BookOpen khi skill lạ (Mixed/Full/etc.) */
const getSkillIcon = (skill: string) => skillIcons[skill] ?? BookOpen;

const skillColors: Record<string, string> = {
  Listening: "text-orange-600",
  Reading: "text-green-600",
  Writing: "text-orange-600",
  Speaking: "text-purple-600",
};

const typeColorsFallback = "bg-gray-100 text-gray-700 border-gray-200";
const skillColorFallback = "text-gray-600";

const statusColors: Record<string, string> = {
  Draft: "bg-orange-100 text-orange-700",
  Published: "bg-green-100 text-green-700",
  Pending: "bg-blue-100 text-blue-700",
  Private: "bg-gray-100 text-gray-700",
};

export function MyExams() {
  usePageTitle(PAGE_TITLES.TEACHER_EXAMS_MY);
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterSkill, setFilterSkill] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Real data from API
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch exams from API
  useEffect(() => {
    const fetchExams = async () => {
      try {
        setLoading(true);
        const response = await teacherApi.exams.getAll();
        if (response.status === 'success' && response.data) {
          // Transform API data to match our Exam interface
          const transformedExams: Exam[] = response.data
            .map((exam: any) => ({
              id: String(exam.eId || exam.id),
              title: exam.eTitle || exam.title || "Untitled Exam",
              description: exam.eDescription || exam.description || "",
              type: (exam.eType || exam.type || "General").toUpperCase() as "VSTEP" | "IELTS" | "Cambridge" | "General",
              skill: capitalizeFirst(exam.eSkill || exam.skill || "reading"),
              duration: exam.eDuration_minutes || exam.duration || 60,
              questions: exam.questions_count || exam.questionsCount || 0,
              points: exam.total_points || exam.totalPoints || 100,
              status: deriveStatus(exam),
              source: (exam.eSource_type || exam.sourceType || "manual") === "manual" ? "Manual" : 
                      (exam.eSource_type || exam.sourceType) === "template" ? "Template" : "Upload",
              createdAt: exam.created_at || exam.createdAt || new Date().toISOString(),
              modifiedAt: exam.updated_at || exam.updatedAt || new Date().toISOString(),
              createdFrom: exam.template_name || exam.templateName,
              assignments: exam.assignments_count || exam.assignmentsCount || 0,
              submissions: exam.submissions_count || exam.submissionsCount || 0,
              avgScore: exam.avg_score || exam.avgScore || 0,
              completionRate: exam.completion_rate || exam.completionRate || 0,
              avgTimeSpent: exam.avg_time_spent || exam.avgTimeSpent || 0,
              // Lưu thêm field gốc để route Sửa/Xem đúng loại đề
              _eType: exam.eType,
              _eSkill: exam.eSkill,
              _eScope: exam.eScope,
              _ielts_skill: exam.ielts_skill,
              _eId: exam.eId,
            }))
            // Hiện tất cả đề của tôi: đã xuất bản, nháp, riêng tư
            // (bỏ filter cũ chỉ hiện published có questions)
            ;
          setExams(transformedExams);
        }
      } catch (err: any) {
        console.error("Error fetching exams:", err);
        setError(err.message || "Failed to load exams");
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, []);

  // Helper function to capitalize first letter
  const capitalizeFirst = (str: string): string => {
    if (!str) return "Reading";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  // Filter by tab
  const filterByTab = (exam: Exam) => {
    if (activeTab === "all") return true;
    if (activeTab === "published") return exam.status === "Published" || exam.status === "Pending";
    if (activeTab === "draft") return exam.status === "Draft";
    if (activeTab === "private") return exam.status === "Private";
    return true;
  };

  // Filter exams
  const filteredExams = exams
    .filter((exam) => {
      const matchesTab = filterByTab(exam);
      const matchesSearch = exam.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || exam.type === filterType;
      const matchesSkill = filterSkill === "all" || exam.skill === filterSkill;
      return matchesTab && matchesSearch && matchesType && matchesSkill;
    })
    .sort((a, b) => {
      if (sortBy === "recent") return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
      if (sortBy === "name") return a.title.localeCompare(b.title);
      if (sortBy === "most-used") return b.assignments - a.assignments;
      if (sortBy === "highest-score") return b.avgScore - a.avgScore;
      return 0;
    });

  // Tab counts
  const allCount = exams.length;
  const publishedCount = exams.filter((e) => e.status === "Published").length;
  const draftCount = exams.filter((e) => e.status === "Draft").length;
  const privateCount = exams.filter((e) => e.status === "Private").length;

  const clearFilters = () => {
    setFilterType("all");
    setFilterSkill("all");
    setSearchTerm("");
    setSortBy("recent");
  };

  // Handle delete exam
  const handleDeleteClick = (exam: Exam) => {
    setExamToDelete(exam);
    setShowDeleteModal(true);
    setShowActionMenu(null);
  };

  const confirmDelete = async () => {
    if (!examToDelete) return;
    
    setIsDeleting(true);
    try {
      await teacherApi.exams.delete(Number(examToDelete.id));
      
      // Remove from local state
      setExams((prev) => prev.filter((e) => e.id !== examToDelete.id));
      
      // Show success message (if you have toast)
      alert("Đã xóa đề thi thành công!");
      
      setShowDeleteModal(false);
      setExamToDelete(null);
    } catch (error: any) {
      console.error("Error deleting exam:", error);
      alert(error.message || "Không thể xóa đề thi. Vui lòng thử lại!");
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setExamToDelete(null);
  };

  // Build edit URL theo loại đề
  const getEditUrl = (exam: Exam): string => {
    const eType = (exam._eType || exam.type || "").toUpperCase();
    if (eType === "IELTS") {
      const scope = (exam._eScope || "").toLowerCase();
      const skill = (exam._ielts_skill || exam._eSkill || exam.skill || "").toLowerCase();
      if (scope === "full" || skill === "mixed" || skill === "full") {
        return `/giao-vien/de-thi/ielts/full/edit/${exam.id}`;
      }
      const validSkills = ["listening", "reading", "writing", "speaking"];
      const s = validSkills.includes(skill) ? skill : "listening";
      return `/giao-vien/de-thi/ielts/${s}/sua/${exam.id}`;
    }
    if (eType === "VSTEP") {
      const skill = (exam.skill || "").toLowerCase();
      if (["listening", "reading", "writing", "speaking"].includes(skill)) {
        return `/giao-vien/de-thi/vstep/${skill}/sua/${exam.id}`;
      }
      return `/giao-vien/de-thi/${exam.id}/chinh-sua`;
    }
    return `/giao-vien/de-thi/${exam.id}/chinh-sua`;
  };

  // Build preview URL theo loại đề
  const getPreviewUrl = (exam: Exam): string => {
    const eType = (exam._eType || exam.type || "").toUpperCase();
    if (eType === "IELTS") {
      const scope = (exam._eScope || "").toLowerCase();
      const skill = (exam._ielts_skill || exam._eSkill || exam.skill || "").toLowerCase();
      if (scope === "full" || skill === "mixed" || skill === "full") {
        return `/giao-vien/de-thi/ielts/full/edit/${exam.id}`;
      }
      const validSkills = ["listening", "reading", "writing", "speaking"];
      const s = validSkills.includes(skill) ? skill : "listening";
      return `/giao-vien/de-thi/ielts/${s}/xem/${exam.id}`;
    }
    if (eType === "VSTEP") {
      return `/giao-vien/de-thi/${exam.id}/vstep`;
    }
    return `/giao-vien/de-thi/${exam.id}/xem`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-amber-50/20 to-orange-50/10">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Đề thi của tôi</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Link to="/giao-vien" className="hover:text-orange-600 transition-colors">
                  Dashboard
                </Link>
                <span>/</span>
                <Link to="/giao-vien/de-thi/tat-ca" className="hover:text-orange-600 transition-colors">
                  Ngân hàng đề
                </Link>
                <span>/</span>
                <span className="text-gray-900 font-medium">Đề thi của tôi</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/giao-vien/de-thi/mau-de"
                className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all flex items-center gap-2 font-medium"
              >
                <LayoutTemplate className="w-4 h-4" />
                Từ mẫu đề
              </Link>
              <Link
                to="/giao-vien/de-thi/import"
                className="px-4 py-2.5 bg-white border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50 transition-all flex items-center gap-2 font-medium"
              >
                <Download className="w-4 h-4" />
                Import PDF
              </Link>
              <Link
                to="/giao-vien/de-thi/tao-moi"
                className="px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all flex items-center gap-2 font-medium shadow-lg shadow-orange-500/30"
              >
                <Plus className="w-4 h-4" />
                Tạo đề mới
              </Link>
              <div className="flex items-center gap-1 ml-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded transition-all ${
                    viewMode === "grid"
                      ? "bg-white text-orange-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Grid3x3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded transition-all ${
                    viewMode === "list"
                      ? "bg-white text-orange-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
              activeTab === "all"
                ? "bg-orange-600 text-white shadow-lg shadow-orange-500/30"
                : "bg-white text-gray-700 border border-gray-200 hover:border-orange-300 hover:bg-orange-50"
            }`}
          >
            Tất cả
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === "all" ? "bg-white/20" : "bg-gray-100"
              }`}
            >
              {allCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("published")}
            className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
              activeTab === "published"
                ? "bg-green-600 text-white shadow-lg shadow-green-500/30"
                : "bg-white text-gray-700 border border-gray-200 hover:border-green-300 hover:bg-green-50"
            }`}
          >
            Đã xuất bản
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === "published" ? "bg-white/20" : "bg-gray-100"
              }`}
            >
              {publishedCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("draft")}
            className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
              activeTab === "draft"
                ? "bg-orange-600 text-white shadow-lg shadow-orange-500/30"
                : "bg-white text-gray-700 border border-gray-200 hover:border-orange-300 hover:bg-orange-50"
            }`}
          >
            Bản nháp
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === "draft" ? "bg-white/20" : "bg-gray-100"
              }`}
            >
              {draftCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("private")}
            className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
              activeTab === "private"
                ? "bg-gray-600 text-white shadow-lg shadow-gray-500/30"
                : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            Riêng tư
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === "private" ? "bg-white/20" : "bg-gray-100"
              }`}
            >
              {privateCount}
            </span>
          </button>
        </div>

        {/* Secondary Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm theo tên đề thi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="appearance-none px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white cursor-pointer text-sm"
                >
                  <option value="all">Tất cả loại</option>
                  <option value="VSTEP">VSTEP</option>
                  <option value="IELTS">IELTS</option>
                  <option value="Cambridge">Cambridge</option>
                  <option value="General">General</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={filterSkill}
                  onChange={(e) => setFilterSkill(e.target.value)}
                  className="appearance-none px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white cursor-pointer text-sm"
                >
                  <option value="all">Tất cả kỹ năng</option>
                  <option value="Listening">Listening</option>
                  <option value="Reading">Reading</option>
                  <option value="Writing">Writing</option>
                  <option value="Speaking">Speaking</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white cursor-pointer text-sm"
                >
                  <option value="recent">Mới nhất</option>
                  <option value="name">Tên A-Z</option>
                  <option value="most-used">Dùng nhiều nhất</option>
                  <option value="highest-score">Điểm cao nhất</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {(filterType !== "all" || filterSkill !== "all" || searchTerm || sortBy !== "recent") && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedExams.length > 0 && (
          <div className="bg-orange-600 text-white rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{selectedExams.length} đề thi đã chọn</span>
              <div className="flex items-center gap-2">
                <button className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium">
                  Xuất bản
                </button>
                <button className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium">
                  Lưu trữ
                </button>
                <button className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium">
                  Xuất file
                </button>
                <button className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium">
                  Xóa
                </button>
                <button
                  onClick={() => setSelectedExams([])}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Exam Cards Grid */}
        {viewMode === "grid" ? (
          loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Đang tải đề thi...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <p className="text-red-600 mb-2">Lỗi tải dữ liệu</p>
              <p className="text-sm text-red-500">{error}</p>
            </div>
          ) : filteredExams.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center col-span-full">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Chưa có đề thi nào</h3>
              <p className="text-gray-600 mb-4">Bắt đầu tạo đề thi đầu tiên của bạn</p>
              <Link
                to="/giao-vien/de-thi/tao-moi"
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all"
              >
                <Plus className="w-4 h-4" />
                Tạo đề mới
              </Link>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredExams.map((exam) => {
              const SkillIcon = getSkillIcon(exam.skill);
              return (
                <div
                  key={exam.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 group"
                >
                  {/* Card Header */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedExams.includes(exam.id)}
                          onChange={() => {
                            setSelectedExams((prev) =>
                              prev.includes(exam.id)
                                ? prev.filter((id) => id !== exam.id)
                                : [...prev, exam.id]
                            );
                          }}
                          className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                        />
                        <span
                          className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold border ${typeColors[exam.type] ?? typeColorsFallback}`}
                        >
                          {exam.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <SkillIcon className={`w-5 h-5 ${skillColors[exam.skill] ?? skillColorFallback}`} />
                        <div className="relative">
                          <button
                            onClick={() =>
                              setShowActionMenu(showActionMenu === exam.id ? null : exam.id)
                            }
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-600" />
                          </button>
                          {showActionMenu === exam.id && (
                            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg w-48 py-2 z-10">
                              <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                                <Eye className="w-4 h-4" />
                                Xem trước
                              </button>
                              <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                                <Copy className="w-4 h-4" />
                                Sao chép
                              </button>
                              <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                                <Send className="w-4 h-4" />
                                Giao cho lớp
                              </button>
                              <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4" />
                                Xem thống kê
                              </button>
                              <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                                <Download className="w-4 h-4" />
                                Xuất PDF
                              </button>
                              <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                                <Archive className="w-4 h-4" />
                                Lưu trữ
                              </button>
                              <hr className="my-2" />
                              <button 
                                onClick={() => handleDeleteClick(exam)}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                                Xóa
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <h3 className="text-base font-bold text-gray-900 mb-1.5 line-clamp-2">
                      {exam.title}
                    </h3>
                    <p className="text-xs text-gray-600 line-clamp-2 mb-2">{exam.description}</p>
                    {exam.createdFrom && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <LayoutTemplate className="w-3 h-3" />
                        <span>Từ mẫu: {exam.createdFrom}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{exam.duration} phút</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>{exam.questions} câu</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Target className="w-3.5 h-3.5" />
                        <span>{exam.points} điểm</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatVNDate(exam.modifiedAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-md text-xs font-semibold ${statusColors[exam.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {exam.status === "Draft"
                          ? "Bản nháp"
                          : exam.status === "Published"
                            ? "Đã xuất bản"
                            : exam.status === "Pending"
                              ? "Chờ duyệt"
                              : "Riêng tư"}
                      </span>
                    </div>

                    {exam.submissions > 0 && (
                      <>
                        <div className="pt-3 border-t border-gray-100 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">Đã giao</span>
                            <span className="font-semibold text-gray-900">
                              {exam.assignments} lớp
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">Bài nộp</span>
                            <span className="font-semibold text-gray-900">{exam.submissions}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">Điểm TB</span>
                            <div className="flex items-center gap-1">
                              <span className="font-semibold text-gray-900">{exam.avgScore}/100</span>
                              {exam.avgScore >= 75 && (
                                <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">Hoàn thành</span>
                            <span className="font-semibold text-gray-900">
                              {exam.completionRate}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">Thời gian TB</span>
                            <span className="font-semibold text-gray-900">
                              {exam.avgTimeSpent}/{exam.duration} phút
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="px-4 pb-4 flex items-center gap-2">
                    <Link
                      to={getPreviewUrl(exam)}
                      className="flex-1 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all text-center text-xs font-medium"
                    >
                      Xem chi tiết
                    </Link>
                    <Link
                      to={getEditUrl(exam)}
                      className="flex-1 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-center text-xs font-medium"
                    >
                      Chỉnh sửa
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
          )
        ) : (
          /* List View */
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Tên đề thi
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Loại
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Đã giao
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Bài nộp
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Điểm TB
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Sửa lần cuối
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredExams.map((exam) => {
                    const SkillIcon = getSkillIcon(exam.skill);
                    return (
                      <tr key={exam.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedExams.includes(exam.id)}
                            onChange={() => {
                              setSelectedExams((prev) =>
                                prev.includes(exam.id)
                                  ? prev.filter((id) => id !== exam.id)
                                  : [...prev, exam.id]
                              );
                            }}
                            className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            to={getPreviewUrl(exam)}
                            className="font-semibold text-gray-900 hover:text-orange-600 transition-colors flex items-center gap-2"
                          >
                            <SkillIcon className={`w-4 h-4 ${skillColors[exam.skill] ?? skillColorFallback}`} />
                            <span>{exam.title}</span>
                          </Link>
                          {exam.createdFrom && (
                            <p className="text-xs text-gray-500 mt-1">Từ: {exam.createdFrom}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-semibold border ${typeColors[exam.type] ?? typeColorsFallback}`}
                          >
                            {exam.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                          {exam.assignments} lớp
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                          {exam.submissions}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-semibold text-gray-900">
                              {exam.avgScore}
                            </span>
                            {exam.avgScore >= 75 && (
                              <TrendingUp className="w-4 h-4 text-green-600" />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-semibold ${statusColors[exam.status] ?? "bg-gray-100 text-gray-700"}`}>
                            {exam.status === "Draft"
                              ? "Bản nháp"
                              : exam.status === "Published"
                                ? "Đã xuất bản"
                                : exam.status === "Pending"
                                  ? "Chờ duyệt"
                                  : "Riêng tư"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatVNDate(exam.modifiedAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              to={getPreviewUrl(exam)}
                              className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                              title="Xem chi tiết"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <Link
                              to={getEditUrl(exam)}
                              className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                              title="Chỉnh sửa"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            <button
                              className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                              title="Thống kê"
                            >
                              <BarChart3 className="w-4 h-4" />
                            </button>
                            <button
                              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredExams.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                <FileText className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                {activeTab === "all" ? "Bạn chưa tạo đề thi nào" : "Không có đề thi nào"}
              </h3>
              <p className="text-gray-600">
                {activeTab === "all"
                  ? "Hãy bắt đầu bằng cách tạo đề thi mới hoặc chọn từ mẫu đề có sẵn."
                  : "Không có đề thi nào trong danh mục này."}
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link
                  to="/giao-vien/de-thi/tao-moi"
                  className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all font-medium inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Tạo đề mới
                </Link>
                <Link
                  to="/giao-vien/de-thi/mau-de"
                  className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium inline-flex items-center gap-2"
                >
                  <LayoutTemplate className="w-4 h-4" />
                  Chọn từ mẫu đề
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && examToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Xác nhận xóa đề thi</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Hành động này không thể hoàn tác</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-800 font-medium mb-2">
                  ⚠️ Bạn có chắc chắn muốn xóa đề thi này?
                </p>
                <div className="space-y-1 text-sm text-orange-700">
                  <p><span className="font-semibold">Tên đề:</span> {examToDelete.title}</p>
                  <p><span className="font-semibold">Loại:</span> {examToDelete.type} - {examToDelete.skill}</p>
                  <p><span className="font-semibold">Số câu hỏi:</span> {examToDelete.questions} câu</p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  <strong>Lưu ý:</strong> Khi xóa đề thi, tất cả dữ liệu liên quan sẽ bị xóa vĩnh viễn bao gồm:
                </p>
                <ul className="list-disc list-inside text-sm text-red-700 mt-2 space-y-1">
                  <li>Toàn bộ câu hỏi và đáp án</li>
                  <li>Lịch sử giao bài (nếu có)</li>
                  <li>Kết quả làm bài của học viên (nếu có)</li>
                </ul>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-end gap-3">
              <button
                onClick={cancelDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-medium shadow-lg shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Đang xóa...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Xác nhận xóa
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

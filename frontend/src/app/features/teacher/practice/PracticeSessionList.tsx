import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { usePageTitle, PAGE_TITLES } from "../../../../hooks/usePageTitle";
import {
  Plus,
  Search,
  Filter,
  Grid3x3,
  List,
  BookOpen,
  FileText,
  Shuffle,
  Headphones,
  Book,
  PenTool,
  Mic,
  Clock,
  Users,
  BarChart3,
  Edit,
  Eye,
  Trash2,
  Copy,
  Send,
  MoreVertical,
  TrendingUp,
  CheckCircle,
  Calendar,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { usePracticeSessions } from "@/hooks/usePracticeSessions";
import { usePageHeader } from "@/contexts/TeacherHeaderContext";
import { formatVNDate } from "@/utils/dateUtils";

type PracticeType = "topic_based" | "template_based" | "random" | "skill_based" | "custom";
type Skill = "listening" | "reading" | "writing" | "speaking";
type Difficulty = "easy" | "medium" | "hard" | "mixed";
type Purpose = "review" | "practice" | "drill" | "mock_test" | "homework";

export function PracticeSessionList() {
  usePageTitle(PAGE_TITLES.TEACHER_PRACTICE);
  usePageHeader({ breadcrumb: ["Dashboard", "Luyện tập"] });
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSkill, setFilterSkill] = useState<string>("all");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [filterPurpose, setFilterPurpose] = useState<string>("all");

  // Use custom hook
  const { sessions, statistics, loading, error, refetch } = usePracticeSessions({
    type: filterType,
    skill: filterSkill,
    purpose: filterPurpose,
    difficulty: filterDifficulty,
  });

  const getTypeConfig = (type: PracticeType) => {
    const configs = {
      topic_based: { label: "Theo chủ đề", color: "purple", icon: BookOpen, badgeClass: "bg-purple-100 text-purple-700" },
      template_based: { label: "Template", color: "blue", icon: FileText, badgeClass: "bg-blue-100 text-blue-700" },
      random: { label: "Ngẫu nhiên", color: "orange", icon: Shuffle, badgeClass: "bg-orange-100 text-orange-700" },
      skill_based: { label: "Theo kỹ năng", color: "green", icon: BarChart3, badgeClass: "bg-green-100 text-green-700" },
      custom: { label: "Tùy chỉnh", color: "gray", icon: Edit, badgeClass: "bg-gray-100 text-gray-700" },
    };
    return configs[type] || configs.custom;
  };

  const getSkillConfig = (skill: Skill) => {
    const configs = {
      listening: { label: "Listening", color: "blue", icon: Headphones, textClass: "text-blue-600" },
      reading: { label: "Reading", color: "green", icon: Book, textClass: "text-green-600" },
      writing: { label: "Writing", color: "amber", icon: PenTool, textClass: "text-amber-600" },
      speaking: { label: "Speaking", color: "red", icon: Mic, textClass: "text-red-600" },
    };
    return configs[skill];
  };

  const getDifficultyConfig = (difficulty: Difficulty) => {
    const configs = {
      easy: { label: "Dễ", color: "green", stars: 1, badgeClass: "bg-green-100 text-green-700" },
      medium: { label: "Trung bình", color: "amber", stars: 2, badgeClass: "bg-amber-100 text-amber-700" },
      hard: { label: "Khó", color: "red", stars: 3, badgeClass: "bg-red-100 text-red-700" },
      mixed: { label: "Hỗn hợp", color: "gray", stars: 0, badgeClass: "bg-gray-100 text-gray-700" },
    };
    return configs[difficulty];
  };

  const getPurposeLabel = (purpose: Purpose) => {
    const labels = {
      review: "Ôn tập",
      practice: "Luyện tập",
      drill: "Rèn luyện",
      mock_test: "Thi thử",
      homework: "Bài tập về nhà",
    };
    return labels[purpose];
  };

  // Client-side search filtering
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const matchesSearch = session.ps_title.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [sessions, searchTerm]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Đang tải bài luyện tập...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl p-8 border border-red-100 shadow-sm">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <p className="text-slate-700 font-semibold mb-1">Lỗi khi tải dữ liệu</p>
          <p className="text-slate-400 text-sm mb-4">{error}</p>
          <button
            onClick={refetch}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 px-6">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Bài luyện tập</h1>
            <p className="text-sm text-slate-500 mt-0.5">Quản lý và tạo bài luyện tập cho học sinh</p>
          </div>
          <button
            onClick={() => navigate('/giao-vien/luyen-tap/tao-moi')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-medium shadow-sm hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg,#4F46E5,#4338CA)' }}
          >
            <Plus className="w-4 h-4" />
            Tạo bài luyện tập
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Bài luyện tập', value: statistics?.total ?? sessions.length, icon: FileText, bg: 'bg-indigo-50', ic: 'text-indigo-600', val: 'text-indigo-700' },
            { label: 'Đang hoạt động', value: statistics?.active_count ?? 0, icon: CheckCircle, bg: 'bg-emerald-50', ic: 'text-emerald-600', val: 'text-emerald-700' },
            { label: 'Bài mới tạo', value: statistics?.recent_count ?? 0, icon: Calendar, bg: 'bg-purple-50', ic: 'text-purple-600', val: 'text-purple-700' },
            { label: 'Loại khác nhau', value: statistics?.by_type ? Object.keys(statistics.by_type).length : 0, icon: TrendingUp, bg: 'bg-orange-50', ic: 'text-orange-500', val: 'text-orange-600' },
          ].map((card, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-200 hover:shadow-sm transition-all">
              <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                <card.icon className={`w-[18px] h-[18px] ${card.ic}`} />
              </div>
              <p className={`text-2xl font-bold ${card.val}`}>{card.value}</p>
              <p className="text-xs font-semibold text-slate-600 mt-0.5">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm bài luyện tập..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
              />
            </div>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="all">Tất cả loại</option>
              <option value="topic_based">Theo chủ đề</option>
              <option value="template_based">Template</option>
              <option value="random">Ngẫu nhiên</option>
              <option value="skill_based">Theo kỹ năng</option>
            </select>
            <select value={filterSkill} onChange={(e) => setFilterSkill(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="all">Tất cả kỹ năng</option>
              <option value="listening">Listening</option>
              <option value="reading">Reading</option>
              <option value="writing">Writing</option>
              <option value="speaking">Speaking</option>
            </select>
            <select value={filterPurpose} onChange={(e) => setFilterPurpose(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="all">Mục đích</option>
              <option value="review">Ôn tập</option>
              <option value="practice">Luyện tập</option>
              <option value="drill">Rèn luyện</option>
              <option value="mock_test">Thi thử</option>
              <option value="homework">BTVN</option>
            </select>
            <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="all">Độ khó</option>
              <option value="easy">Dễ</option>
              <option value="medium">TB</option>
              <option value="hard">Khó</option>
            </select>
            <div className="ml-auto flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
              <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}><Grid3x3 className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}><List className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {/* Sessions Grid */}
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
          {filteredSessions.map((session) => {
            const typeConfig = getTypeConfig(session.ps_type as PracticeType);
            const skillConfig = session.ps_target_skill ? getSkillConfig(session.ps_target_skill as Skill) : null;
            const difficultyConfig = session.ps_difficulty ? getDifficultyConfig(session.ps_difficulty as Difficulty) : null;
            const TypeIcon = typeConfig.icon;
            const SkillIcon = skillConfig?.icon;
            const assignCount = session.assignment_count ?? 0;

            return (
              <div
                key={session.ps_id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-indigo-200 hover:shadow-md transition-all duration-200 group"
              >
                <div className="p-5 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`px-2.5 py-1 ${typeConfig.badgeClass} text-xs font-semibold rounded-md flex items-center gap-1`}>
                          <TypeIcon className="w-3 h-3" />
                          {typeConfig.label}
                        </span>
                        {!session.ps_is_active && (
                          <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs font-medium rounded-md">Không hoạt động</span>
                        )}
                        {assignCount > 0 && (
                          <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-xs font-semibold rounded-md">
                            {assignCount} lần giao
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2">
                        {session.ps_title}
                      </h3>
                      {session.ps_description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">{session.ps_description}</p>
                      )}
                    </div>
                    <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0">
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>

                  {/* Meta badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {skillConfig && SkillIcon && (
                      <div className={`flex items-center gap-1 ${skillConfig.textClass} text-xs font-medium`}>
                        <SkillIcon className="w-3.5 h-3.5" />
                        {skillConfig.label}
                      </div>
                    )}
                    {difficultyConfig && (
                      <span className={`px-2 py-0.5 ${difficultyConfig.badgeClass} text-xs font-semibold rounded-md`}>
                        {difficultyConfig.label}
                      </span>
                    )}
                    {session.ps_purpose && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-md">
                        {getPurposeLabel(session.ps_purpose as Purpose)}
                      </span>
                    )}
                  </div>

                  {/* Details row */}
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {session.ps_duration_minutes && (
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{session.ps_duration_minutes} phút</span>
                    )}
                    {session.ps_question_count && (
                      <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{session.ps_question_count} câu</span>
                    )}
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatVNDate(session.ps_created_at)}</span>
                  </div>

                  {/* Exam link */}
                  {session.exam && (
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Đề thi liên kết</span>
                      <span className="text-xs font-semibold text-indigo-600 truncate ml-2 max-w-[180px]">{session.exam.eTitle}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    <button
                      onClick={() => navigate(`/giao-vien/luyen-tap/${session.ps_id}`)}
                      className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors flex items-center justify-center"
                      title="Xem chi tiết"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => session.exam && navigate(`/giao-vien/bai-tap/giao-moi?exam_id=${session.exam.eId}`)}
                      disabled={!session.exam}
                      className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
                        session.exam
                          ? 'bg-orange-50 hover:bg-orange-100 text-orange-600'
                          : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                      }`}
                      title={session.exam ? 'Giao bài cho học sinh' : 'Không có đề thi liên kết'}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors flex items-center justify-center"
                      title="Sao chép"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/giao-vien/luyen-tap/${session.ps_id}/chinh-sua`)}
                      className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors flex items-center justify-center"
                      title="Chỉnh sửa"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredSessions.length === 0 && (
          <div className="text-center py-14 bg-white rounded-xl border border-gray-200">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 rounded-full mb-4">
              <Search className="w-7 h-7 text-indigo-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-800 mb-1">Không tìm thấy bài luyện tập</h3>
            <p className="text-sm text-slate-400 mb-5">Thử thay đổi bộ lọc hoặc tạo bài luyện tập mới</p>
            <button
              onClick={() => navigate('/giao-vien/luyen-tap/tao-moi')}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Tạo bài luyện tập đầu tiên
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
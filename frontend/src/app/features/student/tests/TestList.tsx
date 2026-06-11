import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePageTitle, PAGE_TITLES } from "../../../../hooks";
import {
  ClipboardList,
  Clock,
  AlertCircle,
  Play,
  Search,
  CheckCircle,
  ArrowRight,
  BookOpen,
  Target,
  Layers,
  FileCheck,
  Grid3x3,
  List,
  TrendingUp,
  Award,
  Zap,
  Calendar,
  Filter,
  X,
} from "lucide-react";
import { studentApi } from "../../../../services/studentApi";
import { getAuthUser } from "../../../../utils/authStorage";
import { getSkillColor, getSkillIcon } from "../../../../utils/skillHelpers";

type TestStatus = 'all' | 'pending' | 'in_progress' | 'completed';
type TestType = 'all' | 'IELTS' | 'VSTEP' | 'TOEIC';
type TestFormat = 'all' | 'FULL_4_SKILLS' | 'MINI_MOCK' | 'DIAGNOSTIC';
type ViewMode = 'grid' | 'list';

// Theme palettes — kids gets rose/pink (matches KidsLayout), others get sky/cyan
const THEME_KIDS    = { PRIMARY: '#F43F5E', PRIMARY_LIGHT: '#FFE4E6', PRIMARY_MID: '#FB7185', ACCENT: '#EC4899', ACCENT_LIGHT: '#FCE7F3' };
const THEME_DEFAULT = { PRIMARY: '#7C3AED', PRIMARY_LIGHT: '#EDE9FE', PRIMARY_MID: '#8B5CF6', ACCENT: '#7C3AED', ACCENT_LIGHT: '#EDE9FE' };
const STUDENT_BASE_PATH = "/hoc-vien";

function mergeVstepIntoSingleTest(items: any[]) {
  const vstepItems = items.filter((t) => String(t.exam_type || "").toUpperCase() === "VSTEP");
  if (vstepItems.length <= 1) return items;

  const nonVstep = items.filter((t) => String(t.exam_type || "").toUpperCase() !== "VSTEP");
  const status = vstepItems.some((t) => t.status === "in_progress")
    ? "in_progress"
    : vstepItems.some((t) => t.status === "pending")
    ? "pending"
    : "completed";

  const merged = {
    ...vstepItems[0],
    assignment_id: vstepItems[0]?.assignment_id,
    submission_id: vstepItems.find((t) => t.submission_id)?.submission_id,
    exam_title: "VSTEP Full Skills Test",
    exam_type: "VSTEP",
    exam_skill: "listening",
    exam_duration: vstepItems.reduce((sum, t) => sum + Number(t.exam_duration || 0), 0) || 179,
    total_questions: vstepItems.reduce((sum, t) => sum + Number(t.total_questions || 0), 0) || 80,
    attempts_allowed: Math.max(...vstepItems.map((t) => Number(t.attempts_allowed || 1))),
    attempts_used: Math.max(...vstepItems.map((t) => Number(t.attempts_used || 0))),
    is_urgent: vstepItems.some((t) => Boolean(t.is_urgent)),
    status,
  };

  return [...nonVstep, merged];
}

function getFormatMeta(format?: string) {
  const key = String(format || 'FULL_4_SKILLS').toUpperCase();
  if (key === 'MINI_MOCK') {
    return { label: 'Mini Mock', icon: Layers, color: '#06B6D4', bg: '#CFFAFE' };
  }
  if (key === 'DIAGNOSTIC') {
    return { label: 'Diagnostic', icon: Target, color: '#F59E0B', bg: '#FEF3C7' };
  }
  return { label: 'Full 4 Skills', icon: FileCheck, color: '#0EA5E9', bg: '#E0F2FE' };
}

export function TestList() {
  const { t } = useTranslation();
  usePageTitle(PAGE_TITLES.STUDENT_TESTS);
  const [status, setStatus] = useState<TestStatus>('pending');
  const [type, setType] = useState<TestType>('all');
  const [format, setFormat] = useState<TestFormat>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['student', 'tests', status, type],
    queryFn: () => studentApi.getTests({ 
      status: status === 'all' ? undefined : status,
      type: type === 'all' ? undefined : type,
    }),
  });

  // Hide VSTEP/IELTS/TOEIC for kids (Cambridge YL audience).
  // Dùng getAuthUser() để đọc CẢ localStorage lẫn sessionStorage (login không "ghi nhớ").
  const authUser = getAuthUser();
  const ageGroup = (authUser?.age_group ?? authUser?.ageGroup ?? '') as string;
  const isKids = ageGroup === 'kids';

  // Theme palette switches based on age group
  const { PRIMARY, PRIMARY_LIGHT, PRIMARY_MID, ACCENT } = isKids ? THEME_KIDS : THEME_DEFAULT;

  // URL base — kids dùng chung namespace /hoc-vien như các nhóm khác
  const BASE = STUDENT_BASE_PATH;

  const isAdultLevelExam = (t: any) => {
    const s = String(t.exam_type || '').toLowerCase() + ' ' + String(t.exam_title || '').toLowerCase();
    return s.includes('vstep') || s.includes('ielts') || s.includes('toeic');
  };

  const allTests = (data as any)?.data?.data;
  const filterKids = (arr: any[]) => (isKids ? arr.filter((t: any) => !isAdultLevelExam(t)) : arr);

  const pending    = filterKids((allTests?.pending     || []).map((t: any) => ({ ...t, status: 'pending'     })));
  const inProgress = filterKids((allTests?.in_progress || []).map((t: any) => ({ ...t, status: 'in_progress' })));
  const completed  = filterKids((allTests?.completed   || []).map((t: any) => ({ ...t, status: 'completed'   })));

  const normalizedTests = mergeVstepIntoSingleTest([...pending, ...inProgress, ...completed]);

  const currentTests = status === 'all'
    ? normalizedTests
    : normalizedTests.filter((t: any) => t.status === status);

  const filteredTests = currentTests.filter(test => {
    const bySearch = search ? test.exam_title.toLowerCase().includes(search.toLowerCase()) : true;
    const byFormat = format === 'all' ? true : String(test.exam_format || 'FULL_4_SKILLS').toUpperCase() === format;
    return bySearch && byFormat;
  });

  const tabs = [
    { key: 'all', label: 'Tất cả', count: normalizedTests.length, icon: ClipboardList },
    { key: 'pending', label: 'Chưa làm', count: normalizedTests.filter((x: any) => x.status === 'pending').length, icon: Clock },
    { key: 'in_progress', label: 'Đang làm', count: normalizedTests.filter((x: any) => x.status === 'in_progress').length, icon: Play },
    { key: 'completed', label: 'Hoàn thành', count: normalizedTests.filter((x: any) => x.status === 'completed').length, icon: CheckCircle },
  ];

  // Calculate stats
  const stats = {
    total: normalizedTests.length,
    pending: normalizedTests.filter((x: any) => x.status === 'pending').length,
    urgent: normalizedTests.filter((x: any) => x.is_urgent && x.status !== 'completed').length,
    completed: normalizedTests.filter((x: any) => x.status === 'completed').length,
  };

  const hasActiveFilters = type !== 'all' || format !== 'all' || search !== '';

  return (
    <div className="min-h-screen" style={{ background: "#F8F7FF" }}>

      {/* ══ Hero ══════════════════════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1E0B4B 0%, #3B1B8F 45%, #1D4ED8 100%)" }}
      >
        {/* Orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/3 w-80 h-80 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #A78BFA, transparent)", transform: "translateY(-50%)" }} />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full opacity-15"
            style={{ background: "radial-gradient(circle, #60A5FA, transparent)", transform: "translateY(40%)" }} />
        </div>

        <div className="relative z-10 px-8 lg:px-16 py-10">
          {/* Title + view toggle */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
                style={{ background: "linear-gradient(135deg, #7C3AED, #8B5CF6)" }}>
                <ClipboardList className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-purple-300 text-sm font-semibold tracking-widest uppercase mb-1">Bài tập được giao</p>
                <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight">Bài tập của tôi</h1>
                <p className="text-purple-200 text-sm mt-1 font-medium">Quản lý và hoàn thành các bài tập được giao</p>
              </div>
            </div>
            {/* View toggle */}
            <div className="flex items-center gap-1 p-1 rounded-xl flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>
              <button onClick={() => setViewMode('grid')}
                className="p-2.5 rounded-lg transition-all"
                style={{ background: viewMode === 'grid' ? "rgba(255,255,255,0.25)" : "transparent", color: "#fff" }}>
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('list')}
                className="p-2.5 rounded-lg transition-all"
                style={{ background: viewMode === 'list' ? "rgba(255,255,255,0.25)" : "transparent", color: "#fff" }}>
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { label: "Tổng bài tập", value: stats.total,     color: "#7DD3FC" },
              { label: "Chưa làm",    value: stats.pending,   color: "#FCD34D" },
              { label: "Cần gấp",     value: stats.urgent,    color: "#FCA5A5" },
              { label: "Hoàn thành",  value: stats.completed, color: "#86EFAC" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}>
                <span className="text-xl font-extrabold" style={{ color: s.color }}>
                  {isLoading ? "—" : s.value}
                </span>
                <span className="text-xs font-semibold text-purple-200">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ Sticky Filter Bar ═════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-20 px-8 lg:px-16 py-3"
        style={{ background: "rgba(248,247,255,0.93)", backdropFilter: "blur(16px)", borderBottom: "1px solid #DDD6FE" }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Status tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl flex-shrink-0"
            style={{ background: "#fff", border: "1.5px solid #DDD6FE" }}>
            {tabs.map(tab => {
              const Icon = tab.icon;
              const active = status === tab.key;
              return (
                <button key={tab.key} onClick={() => setStatus(tab.key as TestStatus)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-bold transition-all duration-200"
                  style={{
                    background: active ? PRIMARY : "transparent",
                    color: active ? "#fff" : "#6B7280",
                    boxShadow: active ? `0 2px 10px ${PRIMARY}50` : "none",
                  }}>
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {!isLoading && tab.count > 0 && (
                    <span className="text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 font-bold"
                      style={{
                        background: active ? "rgba(255,255,255,0.22)" : PRIMARY_LIGHT,
                        color: active ? "#fff" : PRIMARY,
                      }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Tìm kiếm bài tập..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl outline-none text-sm font-medium"
              style={{ background: "#fff", border: "1.5px solid #DDD6FE", color: "#1A1040",
                boxShadow: "0 1px 4px rgba(124,58,237,0.08)" }} />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <select value={type} onChange={(e) => setType(e.target.value as TestType)}
              className="px-3 py-2.5 rounded-xl outline-none text-sm font-semibold cursor-pointer"
              style={{ background: "#fff", border: "1.5px solid #DDD6FE", color: type !== 'all' ? PRIMARY : "#374151" }}>
              <option value="all">Tất cả loại</option>
              <option value="IELTS">IELTS</option>
              <option value="VSTEP">VSTEP</option>
              <option value="TOEIC">TOEIC</option>
            </select>
            <select value={format} onChange={(e) => setFormat(e.target.value as TestFormat)}
              className="px-3 py-2.5 rounded-xl outline-none text-sm font-semibold cursor-pointer"
              style={{ background: "#fff", border: "1.5px solid #DDD6FE", color: format !== 'all' ? PRIMARY : "#374151" }}>
              <option value="all">Tất cả dạng</option>
              <option value="FULL_4_SKILLS">Full 4 Skills</option>
              <option value="MINI_MOCK">Mini Mock</option>
              <option value="DIAGNOSTIC">Diagnostic</option>
            </select>
            {hasActiveFilters && (
              <button onClick={() => { setType('all'); setFormat('all'); setSearch(''); }}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-sm transition-all hover:bg-red-50"
                style={{ color: "#EF4444", border: "1.5px solid #FEE2E2", background: "#fff" }}>
                <X className="w-3.5 h-3.5" />
                Xóa
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ══ Content ═══════════════════════════════════════════════════════════ */}
      <div className="px-8 lg:px-16 py-8">
        {/* Results count */}
        {!isLoading && (
          <p className="text-sm text-gray-500 mb-6">
            Hiển thị{" "}
            <span className="font-bold" style={{ color: PRIMARY }}>{filteredTests.length}</span>{" "}
            bài tập{hasActiveFilters && " (đã lọc)"}
          </p>
        )}

      {/* Main Content */}
      {isLoading ? (
        <div className={viewMode === 'grid' 
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5"
          : "space-y-4"}>
          {[1,2,3,4,5,6,7,8].map((i) => (
            <div key={i} className={`animate-pulse ${viewMode === 'grid' ? "h-80" : "h-32"}`} 
                 style={{ background: "#F9FAFB", borderRadius: 24, border: "2px solid #EDE9FE" }}>
              <div className="animate-pulse h-full" />
            </div>
          ))}
        </div>
      ) : filteredTests.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-3xl" style={{ border: "2px dashed #E5E7EB" }}>
           <div className="w-24 h-24 rounded-3xl mx-auto flex items-center justify-center mb-6"
                style={{ background: `linear-gradient(135deg, ${PRIMARY_LIGHT}, #C7D2FE)` }}>
              <CheckCircle className="w-12 h-12" style={{ color: PRIMARY }} />
           </div>
           <h3 style={{ fontSize: 22, fontWeight: 900, color: "#1F1344", marginBottom: 8 }}>
             {hasActiveFilters ? "Không tìm thấy bài tập" : "Tuyệt vời! Không còn bài tập nào"}
           </h3>
           <p style={{ fontSize: 15, color: "#9CA3AF", marginBottom: 24 }}>
             {hasActiveFilters 
               ? "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm"
               : "Hãy thử luyện tập thêm để nâng cao kỹ năng nhé"}
           </p>
           {hasActiveFilters && (
             <button
               onClick={() => {
                 setType('all');
                 setFormat('all');
                 setSearch('');
               }}
               className="px-6 py-3 rounded-xl font-bold transition-opacity hover:opacity-90"
               style={{ background: PRIMARY, color: "#fff" }}
             >
               Xóa bộ lọc
             </button>
           )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
           {filteredTests.map((test) => {
              const formatMeta = getFormatMeta(test.exam_format);
              const Icon = formatMeta.icon;
              const color = formatMeta.color;
              const isUrgent = test.is_urgent;
              const canStart = test.attempts_used < test.attempts_allowed;
              const isCompleted = test.status === 'completed';
              const progress = test.attempts_allowed > 0 ? (test.attempts_used / test.attempts_allowed) * 100 : 0;

              return (
                <div
                  key={test.assignment_id}
                  className="group relative flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
                >
                  <div className="flex flex-col flex-1 p-5">
                    {/* Title */}
                    <h3 className="text-lg font-bold text-gray-900 line-clamp-2 leading-snug mb-3 min-h-[56px]">
                      {test.exam_title}
                    </h3>

                    {/* Stats row - inline với icons */}
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 text-sm text-gray-600 mb-1.5">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {test.exam_duration} phút
                      </span>
                      <span className="text-gray-300">|</span>
                      <span className="inline-flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-gray-400" />
                        {test.attempts_used}/{test.attempts_allowed}
                      </span>
                    </div>

                    {/* Sub stats */}
                    <p className="text-sm text-gray-600 mb-4">
                      {test.exam_skill && (
                        <span className="capitalize">{test.exam_skill}</span>
                      )}
                      {test.exam_skill && ' | '}
                      <span className="font-medium">{test.total_questions} câu hỏi</span>
                    </p>

                    {/* Hashtag tags */}
                    <div className="flex flex-wrap gap-2 mb-5">
                      <span className="px-3 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                        #{test.exam_type}
                      </span>
                      {test.exam_skill && (
                        <span className="px-3 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 capitalize">
                          #{test.exam_skill}
                        </span>
                      )}
                      {isUrgent && !isCompleted && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium bg-red-50 text-red-600">
                          <AlertCircle className="w-3 h-3" />
                          Gấp
                        </span>
                      )}
                    </div>

                    {/* Progress (only when started) */}
                    {test.attempts_allowed > 0 && progress > 0 && progress < 100 && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-gray-500">Tiến độ</span>
                          <span className="text-xs font-bold text-blue-600">{Math.round(progress)}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    )}

                    {/* Action button - outline style "Chi tiết" - pinned to bottom */}
                    <div className="mt-auto pt-2">
                      {isCompleted ? (
                        <Link
                          to={`${BASE}/ket-qua/${test.submission_id}`}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-green-500 text-green-600 text-sm font-semibold hover:bg-green-50 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Xem kết quả
                        </Link>
                      ) : (
                        <Link
                          to={`${BASE}/phong-cho/${test.assignment_id}`}
                          onClick={(e) => !canStart && e.preventDefault()}
                          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-blue-500 text-blue-600 text-sm font-semibold transition-colors ${
                            canStart ? 'hover:bg-blue-50' : 'opacity-50 cursor-not-allowed'
                          }`}
                        >
                          {test.attempts_used > 0 ? 'Tiếp tục làm' : 'Chi tiết'}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
           })}
        </div>
      ) : (
        /* List View */
        <div className="space-y-4">
           {filteredTests.map((test) => {
              const formatMeta = getFormatMeta(test.exam_format);
              const Icon = formatMeta.icon;
              const color = formatMeta.color;
              const isUrgent = test.is_urgent;
              const canStart = test.attempts_used < test.attempts_allowed;
              const isCompleted = test.status === 'completed';
              const progress = test.attempts_allowed > 0 ? (test.attempts_used / test.attempts_allowed) * 100 : 0;

              return (
                <div key={test.assignment_id}
                     className="relative bg-white rounded-2xl p-5 transition-all duration-300 group"
                     style={{
                        border: "1.5px solid #F0F0F8",
                        boxShadow: "0 2px 12px rgba(124,58,237,0.06)"
                     }}
                     onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = `0 8px 24px rgba(124,58,237,0.12)`;
                        e.currentTarget.style.borderColor = `rgba(124,58,237,0.22)`;
                     }}
                     onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = "0 2px 12px rgba(124,58,237,0.06)";
                        e.currentTarget.style.borderColor = "#F0F0F8";
                     }}>
                  
                  <div className="flex items-center gap-5">
                    {/* Icon */}
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ background: `${color}15` }}>
                      <Icon className="w-7 h-7" style={{ color }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold truncate mb-1" style={{ fontSize: 17, color: "#1F1344" }}>
                            {test.exam_title}
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold" 
                                  style={{ background: formatMeta.bg, color: color }}>
                              {formatMeta.label}
                            </span>
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold" 
                                  style={{ background: "#F3F4F6", color: "#4B5563" }}>
                              {test.exam_type}
                            </span>
                            {isUrgent && !isCompleted && (
                              <span className="px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                                    style={{ background: "#FEF2F2", color: "#DC2626" }}>
                                <AlertCircle className="w-3 h-3" />
                                URGENT
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Stats Row */}
                      <div className="flex items-center gap-6 text-sm mt-3">
                        <span className="flex items-center gap-1.5 font-medium" style={{ color: "#6B7280" }}>
                          <ClipboardList className="w-4 h-4" />
                          {test.total_questions} câu
                        </span>
                        <span className="flex items-center gap-1.5 font-medium" style={{ color: "#6B7280" }}>
                          <Clock className="w-4 h-4" />
                          {test.exam_duration} phút
                        </span>
                        <span className="flex items-center gap-1.5 font-medium" style={{ color: "#6B7280" }}>
                          <BookOpen className="w-4 h-4" />
                          {test.attempts_used}/{test.attempts_allowed} lần
                        </span>
                      </div>

                      {/* Progress Bar */}
                      {test.attempts_allowed > 0 && (
                        <div className="mt-3">
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#E5E7EB" }}>
                            <div className="h-full rounded-full transition-all"
                                 style={{ 
                                   width: `${progress}%`,
                                   background: `linear-gradient(90deg, ${color}, ${color}CC)`
                                 }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="flex-shrink-0">
                      {isCompleted ? (
                        <Link to={`${BASE}/ket-qua/${test.submission_id}`}
                              className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all hover:scale-105"
                              style={{ background: "#F0FDF4", color: "#16A34A" }}>
                           <CheckCircle className="w-5 h-5" />
                           Xem kết quả
                        </Link>
                      ) : (
                        <Link to={`${BASE}/phong-cho/${test.assignment_id}`}
                              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all ${canStart ? 'hover:scale-105' : 'opacity-50 cursor-not-allowed'}`}
                              style={{ background: color, color: "#fff" }}
                              onClick={(e) => !canStart && e.preventDefault()}>
                           <Play className="w-5 h-5 fill-current" />
                           {test.attempts_used > 0 ? "Tiếp tục" : "Làm bài"}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
           })}
        </div>
      )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
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
  Ban,
  CalendarX,
  Timer,
  HelpCircle,
  RotateCcw,
  ChevronRight,
  Sparkles,
  Trophy,
  FileText,
  Volume2,
  Mic,
  PenLine,
} from "lucide-react";
import { studentApi } from "../../../../services/studentApi";
import { getAuthUser } from "../../../../utils/authStorage";
import { getSkillColor, getSkillIcon } from "../../../../utils/skillHelpers";

type TestStatus = 'all' | 'pending' | 'in_progress' | 'completed' | 'overdue';
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

function isOverdue(test: any): boolean {
  if (!test.deadline) return false;
  if (test.status === 'completed') return false;
  return new Date(test.deadline) < new Date();
}

function getOverdueDays(deadline: string): number {
  const diff = Date.now() - new Date(deadline).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatDeadline(deadline: string): string {
  const d = new Date(deadline);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const PURPLE     = '#7C3AED';
const PURPLE_MID = '#8B5CF6';

function getExamTypeMeta(type?: string): { color: string; dark: string; bg: string; light: string } {
  const t = String(type || '').toUpperCase();
  if (t === 'VSTEP')  return { color: '#0EA5E9', dark: '#0369A1', bg: '#E0F2FE', light: '#F0F9FF' };
  if (t === 'IELTS')  return { color: '#10B981', dark: '#065F46', bg: '#D1FAE5', light: '#ECFDF5' };
  if (t === 'TOEIC')  return { color: '#F59E0B', dark: '#92400E', bg: '#FEF3C7', light: '#FFFBEB' };
  if (t === 'THPT')   return { color: '#EF4444', dark: '#991B1B', bg: '#FEE2E2', light: '#FFF5F5' };
  return { color: PURPLE, dark: '#5B21B6', bg: '#EDE9FE', light: '#F5F3FF' };
}

function getSkillChips(skill?: string, format?: string): { label: string; Icon: any; color: string }[] {
  const s = String(skill || '').toLowerCase();
  const f = String(format || '').toUpperCase();
  if (s === 'mixed' || f === 'FULL_4_SKILLS') return [];
  if (s === 'listening') return [{ label: 'Nghe', Icon: Volume2, color: '#0EA5E9' }];
  if (s === 'reading')   return [{ label: 'Đọc', Icon: BookOpen, color: '#10B981' }];
  if (s === 'writing')   return [{ label: 'Viết', Icon: PenLine, color: '#8B5CF6' }];
  if (s === 'speaking')  return [{ label: 'Nói', Icon: Mic, color: '#F59E0B' }];
  return [];
}

function getDaysRemaining(deadline: string): number {
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function getStatusMeta(status: string): { label: string; color: string; bg: string } {
  if (status === 'in_progress') return { label: 'Đang làm', color: '#0EA5E9', bg: '#E0F2FE' };
  if (status === 'completed')   return { label: 'Hoàn thành', color: '#10B981', bg: '#D1FAE5' };
  return { label: 'Chưa làm', color: PURPLE, bg: '#EDE9FE' };
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
  const resultUrlFor = (test: any) => {
    const examType = String(test?.exam_type ?? "").toUpperCase();
    const submissionId = test?.submission_id;
    if (examType === "THPT") return `${BASE}/ket-qua-thpt/${submissionId}`;
    if (examType === "VSTEP") return `${BASE}/ket-qua-vstep/${submissionId}`;
    if (examType === "IELTS") return `${BASE}/ket-qua-ielts/${submissionId}`;
    return `${BASE}/ket-qua/${submissionId}`;
  };

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

  const overdueTests = normalizedTests.filter((t: any) => isOverdue(t));

  const currentTests = status === 'all'
    ? normalizedTests
    : status === 'overdue'
    ? overdueTests
    : normalizedTests.filter((t: any) => t.status === status && !isOverdue(t));

  const filteredTests = currentTests.filter(test => {
    const bySearch = search ? test.exam_title.toLowerCase().includes(search.toLowerCase()) : true;
    const byFormat = format === 'all' ? true : String(test.exam_format || 'FULL_4_SKILLS').toUpperCase() === format;
    return bySearch && byFormat;
  });

  const tabs = [
    { key: 'all',         label: 'Tất cả',     count: normalizedTests.length,                                                                       icon: ClipboardList, accent: false },
    { key: 'pending',     label: 'Chưa làm',   count: normalizedTests.filter((x: any) => x.status === 'pending' && !isOverdue(x)).length,              icon: Clock,         accent: false },
    { key: 'in_progress', label: 'Đang làm',   count: normalizedTests.filter((x: any) => x.status === 'in_progress' && !isOverdue(x)).length,          icon: Play,          accent: false },
    { key: 'completed',   label: 'Hoàn thành', count: normalizedTests.filter((x: any) => x.status === 'completed').length,                               icon: CheckCircle,   accent: false },
    { key: 'overdue',     label: 'Quá hạn',    count: overdueTests.length,                                                                              icon: CalendarX,     accent: true  },
  ];

  // Calculate stats
  const stats = {
    total: normalizedTests.length,
    pending: normalizedTests.filter((x: any) => x.status === 'pending').length,
    urgent: normalizedTests.filter((x: any) => x.is_urgent && x.status !== 'completed').length,
    completed: normalizedTests.filter((x: any) => x.status === 'completed').length,
    overdue: overdueTests.length,
  };

  const hasActiveFilters = type !== 'all' || format !== 'all' || search !== '';

  // ─── Phân trang: 10 bài / trang ───────────────────────────────────────────
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [status, type, format, search]);
  const totalPages = Math.max(1, Math.ceil(filteredTests.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pagedTests = filteredTests.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

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
              ...(stats.overdue > 0 ? [{ label: "Quá hạn", value: stats.overdue, color: "#FDA4AF" }] : []),
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
          <div className="flex items-center gap-1 p-1 rounded-xl flex-shrink-0 overflow-x-auto max-w-full scrollbar-none"
            style={{ background: "#fff", border: "1.5px solid #DDD6FE" }}>
            {tabs.map(tab => {
              const Icon = tab.icon;
              const active = status === tab.key;
              const isOverdueTab = tab.key === 'overdue';
              const tabBg = active ? (isOverdueTab ? '#DC2626' : PRIMARY) : 'transparent';
              const tabColor = active ? '#fff' : (isOverdueTab ? '#DC2626' : '#6B7280');
              return (
                <button key={tab.key} onClick={() => setStatus(tab.key as TestStatus)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-bold transition-all duration-200"
                  style={{
                    background: tabBg,
                    color: tabColor,
                    boxShadow: active ? `0 2px 10px ${isOverdueTab ? '#DC262650' : PRIMARY + '50'}` : 'none',
                    border: !active && isOverdueTab && tab.count > 0 ? '1.5px solid #FECACA' : 'none',
                  }}>
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {!isLoading && tab.count > 0 && (
                    <span className="text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 font-bold"
                      style={{
                        background: active ? 'rgba(255,255,255,0.22)' : (isOverdueTab ? '#FEE2E2' : PRIMARY_LIGHT),
                        color: active ? '#fff' : (isOverdueTab ? '#DC2626' : PRIMARY),
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
          ? "grid grid-cols-2 lg:grid-cols-4 gap-4"
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
           {pagedTests.map((test, idx) => {
              const formatMeta = getFormatMeta(test.exam_format);
              const Icon = formatMeta.icon;
              const color = formatMeta.color;
              const isUrgent = test.is_urgent;
              const testIsOverdue = isOverdue(test);
              const canStart = !testIsOverdue && test.attempts_used < test.attempts_allowed;
              const isCompleted = test.status === 'completed';
              const progress = test.attempts_allowed > 0 ? (test.attempts_used / test.attempts_allowed) * 100 : 0;
              const overdueDays = testIsOverdue && test.deadline ? getOverdueDays(test.deadline) : 0;

              if (testIsOverdue) {
                const skillChipsOD = getSkillChips(test.exam_skill, test.exam_format);
                const isFullTestOD = skillChipsOD.length === 0;
                return (
                  <div key={test.assignment_id}
                    className="group relative flex flex-col rounded-3xl bg-white overflow-hidden transition-all duration-300"
                    style={{ border: '1.5px solid #FECACA', boxShadow: '0 2px 12px #DC262615' }}
                  >
                    {/* ── Gradient header (red theme) ── */}
                    <div className="relative px-5 pt-5 pb-4 overflow-hidden"
                      style={{ background: 'linear-gradient(135deg, #DC262618 0%, #7C3AED10 100%)' }}
                    >
                      {/* Decorative orb */}
                      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20"
                        style={{ background: 'radial-gradient(circle, #DC2626, transparent)' }} />

                      {/* Type + status + index */}
                      <div className="flex items-center justify-between mb-3 relative z-10">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                            style={{ background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A530' }}>
                            <Sparkles className="w-3 h-3" />
                            {test.exam_type}
                          </span>
                          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                            style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                            <CalendarX className="w-2.5 h-2.5" />
                            Quá hạn
                          </span>
                        </div>
                        <span className="text-xs font-bold opacity-40" style={{ color: '#DC2626' }}>
                          #{String(idx + 1).padStart(2, '0')}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="font-extrabold leading-snug line-clamp-2 relative z-10 mb-2"
                        style={{ fontSize: 15, color: '#1A1040', letterSpacing: '-0.01em' }}>
                        {test.exam_title}
                      </h3>

                      {/* Skill chips + overdue days chip */}
                      <div className="flex items-center gap-1.5 flex-wrap relative z-10">
                        {isFullTestOD ? (
                          <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold text-white shadow-sm"
                            style={{ background: 'linear-gradient(135deg, #FF6B6B 0%, #845EF7 100%)' }}>
                            Full test
                          </span>
                        ) : skillChipsOD.map(({ label, Icon: SIcon, color: sc }) => (
                          <span key={label} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                            style={{ background: '#fff', color: sc, border: `1px solid ${sc}30` }}>
                            <SIcon className="w-2.5 h-2.5" />
                            {label}
                          </span>
                        ))}
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                          style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                          <CalendarX className="w-2.5 h-2.5" />
                          {overdueDays === 0 ? 'Hôm nay' : `${overdueDays} ngày trước`}
                        </span>
                      </div>
                    </div>

                    {/* ── Body ── */}
                    <div className="px-5 py-3 flex-1 flex flex-col gap-2">
                      {test.deadline && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                          style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                          <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#DC2626' }} />
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#7F1D1D' }}>Hạn nộp</p>
                            <p className="text-xs font-bold" style={{ color: '#B91C1C' }}>{formatDeadline(test.deadline)}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-auto pt-1 flex-wrap">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {test.exam_duration} phút
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                          <FileText className="w-3.5 h-3.5 text-gray-400" />
                          {test.total_questions} câu hỏi
                        </span>
                        <span className="ml-auto flex items-center gap-1 text-xs font-semibold" style={{ color: '#9CA3AF' }}>
                          <RotateCcw className="w-3 h-3" />
                          {test.attempts_used}/{test.attempts_allowed} lần
                        </span>
                      </div>
                      <div className="h-1 w-full rounded-full" style={{ background: '#FEE2E2' }} />
                    </div>

                    {/* ── CTA: quá hạn — không cho làm free ── */}
                    <div className="px-5 pb-5">
                      <div className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-bold text-sm cursor-not-allowed"
                        style={{ background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FECACA' }}>
                        <CalendarX className="w-4 h-4" />
                        Đã quá hạn — không thể làm
                      </div>
                    </div>
                  </div>
                );
              }

              {
                const typeMeta   = getExamTypeMeta(test.exam_type);
                const statusMeta = getStatusMeta(test.status);
                const attemptsLeft = Math.max(0, test.attempts_allowed - test.attempts_used);
                const skillChips = getSkillChips(test.exam_skill, test.exam_format);
                const isFullTest = skillChips.length === 0;
                const daysLeft   = test.deadline && !isCompleted ? getDaysRemaining(test.deadline) : null;
                return (
                  <div
                    key={test.assignment_id}
                    className="group relative flex flex-col rounded-3xl bg-white overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                    style={{ border: '1.5px solid #F0F0F8', boxShadow: `0 2px 12px ${typeMeta.color}10` }}
                  >
                    {/* ── Gradient card header (matches ExamCard) ── */}
                    <div className="relative px-5 pt-5 pb-4 overflow-hidden"
                      style={{ background: `linear-gradient(135deg, ${typeMeta.color}18 0%, ${PURPLE}10 100%)` }}
                    >
                      {/* Decorative orb */}
                      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20"
                        style={{ background: `radial-gradient(circle, ${typeMeta.color}, transparent)` }} />

                      {/* Type badge + status badge + index */}
                      <div className="flex items-center justify-between mb-3 relative z-10">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide"
                            style={{ background: typeMeta.bg, color: typeMeta.dark, border: `1px solid ${typeMeta.color}30` }}>
                            <Sparkles className="w-3 h-3" />
                            {test.exam_type}
                          </span>
                          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                            style={{ background: statusMeta.bg, color: statusMeta.color, border: `1px solid ${statusMeta.color}30` }}>
                            {test.status === 'in_progress' ? <Play className="w-2.5 h-2.5 fill-current" /> :
                             test.status === 'completed'   ? <CheckCircle className="w-2.5 h-2.5" /> :
                                                             <Clock className="w-2.5 h-2.5" />}
                            {statusMeta.label}
                          </span>
                        </div>
                        <span className="text-xs font-bold opacity-40 relative z-10" style={{ color: PURPLE }}>
                          #{String(idx + 1).padStart(2, '0')}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="font-extrabold leading-snug line-clamp-2 relative z-10 mb-2"
                        style={{ fontSize: 16, color: '#1A1040', letterSpacing: '-0.01em' }}>
                        {test.exam_title}
                      </h3>

                      {/* Skill chips */}
                      <div className="flex items-center gap-1.5 flex-wrap relative z-10">
                        {isFullTest ? (
                          <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold text-white shadow-sm"
                            style={{ background: 'linear-gradient(135deg, #FF6B6B 0%, #845EF7 100%)' }}>
                            Full test
                          </span>
                        ) : skillChips.map(({ label, Icon, color }) => (
                          <span key={label} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                            style={{ background: '#fff', color, border: `1px solid ${color}30` }}>
                            <Icon className="w-2.5 h-2.5" />
                            {label}
                          </span>
                        ))}
                        {/* Deadline chip in header */}
                        {daysLeft !== null && daysLeft <= 7 && (
                          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                            style={{
                              background: daysLeft <= 2 ? '#FEF2F2' : '#FFF7ED',
                              color: daysLeft <= 2 ? '#DC2626' : '#D97706',
                              border: `1px solid ${daysLeft <= 2 ? '#FECACA' : '#FDE68A'}`,
                            }}>
                            <Calendar className="w-2.5 h-2.5" />
                            {daysLeft <= 0 ? 'Hôm nay' : `Còn ${daysLeft} ngày`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ── Card body ── */}
                    <div className="px-5 py-3 flex-1 flex flex-col gap-2">
                      {/* Deadline row (full date) */}
                      {test.deadline && !isCompleted && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                          style={{ background: isUrgent ? '#FEF3C7' : '#F9FAFB', border: `1px solid ${isUrgent ? '#FDE68A' : '#E5E7EB'}` }}>
                          <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isUrgent ? '#D97706' : '#9CA3AF' }} />
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: isUrgent ? '#92400E' : '#6B7280' }}>
                              {isUrgent ? '⚠️ Hạn nộp — Cần gấp!' : 'Hạn nộp'}
                            </p>
                            <p className="text-xs font-bold" style={{ color: isUrgent ? '#B45309' : '#374151' }}>
                              {formatDeadline(test.deadline)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Stats row */}
                      <div className="flex items-center gap-3 mt-auto pt-1 flex-wrap">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {test.exam_duration} phút
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                          <FileText className="w-3.5 h-3.5 text-gray-400" />
                          {test.total_questions} câu hỏi
                        </span>
                        <span className="ml-auto flex items-center gap-1 text-xs font-semibold" style={{ color: attemptsLeft === 0 ? '#EF4444' : typeMeta.color }}>
                          <RotateCcw className="w-3 h-3" />
                          {attemptsLeft > 0
                            ? `Còn ${attemptsLeft}/${test.attempts_allowed} lượt`
                            : 'Hết lượt'}
                        </span>
                      </div>

                      {/* Attempts progress */}
                      {test.attempts_allowed > 0 && (
                        <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: typeMeta.bg }}>
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${progress}%`, background: attemptsLeft === 0 ? '#EF4444' : typeMeta.color }} />
                        </div>
                      )}
                    </div>

                    {/* ── CTA ── */}
                    <div className="px-5 pb-5">
                      {isCompleted ? (
                        <Link to={resultUrlFor(test)}
                          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-bold text-sm transition-all duration-200 group-hover:gap-3"
                          style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: '#fff', boxShadow: '0 4px 14px #10B98145' }}>
                          <CheckCircle className="w-4 h-4" />
                          Xem kết quả
                          <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                        </Link>
                      ) : canStart ? (
                        <Link to={`${BASE}/phong-cho/${test.assignment_id}`}
                          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-bold text-sm text-white transition-all duration-200 group-hover:gap-3"
                          style={{ background: `linear-gradient(135deg, ${typeMeta.color} 0%, ${PURPLE_MID} 100%)`, boxShadow: `0 4px 14px ${typeMeta.color}45` }}>
                          <Play className="w-4 h-4 fill-white" />
                          {test.status === 'in_progress' ? 'Tiếp tục làm' : 'Bắt đầu làm bài'}
                          <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                        </Link>
                      ) : (
                        <div className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-bold text-sm cursor-not-allowed"
                          style={{ background: '#F3F4F6', color: '#9CA3AF' }}>
                          Hết lượt thi
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
           })}
        </div>
      ) : (
        /* List View */
        <div className="space-y-4">
           {pagedTests.map((test) => {
              const formatMeta = getFormatMeta(test.exam_format);
              const Icon = formatMeta.icon;
              const color = formatMeta.color;
              const isUrgent = test.is_urgent;
              const testIsOverdue = isOverdue(test);
              const canStart = !testIsOverdue && test.attempts_used < test.attempts_allowed;
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
                            {testIsOverdue && (
                              <span className="px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                                    style={{ background: "#FEE2E2", color: "#B91C1C" }}>
                                <Ban className="w-3 h-3" />
                                Quá hạn
                              </span>
                            )}
                            {isUrgent && !isCompleted && !testIsOverdue && (
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
                        <Link to={resultUrlFor(test)}
                              className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all hover:scale-105"
                              style={{ background: "#F0FDF4", color: "#16A34A" }}>
                           <CheckCircle className="w-5 h-5" />
                           Xem kết quả
                        </Link>
                      ) : testIsOverdue ? (
                        <div className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold cursor-not-allowed"
                              style={{ background: "#FEE2E2", color: "#B91C1C", border: "1px solid #FECACA" }}>
                          <CalendarX className="w-5 h-5" />
                          Đã quá hạn
                        </div>
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

      {/* ══ Pager ═══════════════════════════════════════════════════════════ */}
      {!isLoading && filteredTests.length > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-1.5 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={pageSafe <= 1}
            className="px-3.5 py-2 rounded-lg text-sm font-bold bg-white border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ borderColor: "#DDD6FE", color: "#6B7280" }}>
            ← Trước
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className="min-w-[38px] h-[38px] rounded-lg text-sm font-bold border transition-colors"
              style={p === pageSafe
                ? { background: PRIMARY, color: "#fff", borderColor: PRIMARY }
                : { background: "#fff", borderColor: "#DDD6FE", color: "#475569" }}>
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={pageSafe >= totalPages}
            className="px-3.5 py-2 rounded-lg text-sm font-bold bg-white border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ borderColor: "#DDD6FE", color: "#6B7280" }}>
            Sau →
          </button>
        </div>
      )}
      </div>
    </div>
  );
}

import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, Filter, RefreshCw, Bell, Users, BookOpen, Clock,
  CheckCircle2, AlertCircle, CheckCircle, ChevronRight, X,
  Calendar, Award, Send, ArrowUpDown, UserCheck, AlertTriangle,
  PlayCircle, HelpCircle, Sparkles, Phone, Mail
} from 'lucide-react';
import { teacherApi } from '@/services/teacherApi';
import { useToastContext } from '@/contexts/ToastContext';

interface AssignmentItem {
  taId: number;
  exam_id: number;
  exam?: {
    eId: number;
    eTitle: string;
    eType?: string;
    eSkill?: string;
    eDuration_minutes?: number;
    eDuration?: number;
    questions_count?: number;
  };
  taTarget_type: 'class' | 'student';
  taTarget_id: number;
  target_name?: string;
  taCreated_at?: string;
  taStart_time?: string;
  taDeadline?: string;
  taMax_attempt?: number;
  taInstructions?: string;
  total_students?: number;
  completed_students?: number;
  in_progress_students?: number;
  not_started_students?: number;
  is_overdue?: boolean;
  is_upcoming?: boolean;
  is_active?: boolean;
  can_send_reminder?: boolean;
  completion_rate?: number;
}

interface StudentProgressData {
  uId: number;
  uName: string;
  uEmail?: string;
  uPhone?: string;
  avatar_url?: string;
  status: 'completed' | 'in_progress' | 'pending' | 'not_started';
  submission?: {
    sId: number;
    sScore?: number | null;
    sStatus: string;
    sSubmit_time?: string;
    sGraded_time?: string;
    sAttempt?: number;
  } | null;
}

export function TeacherAssignmentManagement({ onSelectSubmission }: { onSelectSubmission?: (subId: number) => void }) {
  const toast = useToastContext();
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [targetFilter, setTargetFilter] = useState<'all' | 'class' | 'student'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'overdue' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'deadline' | 'completion'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  // Selected assignment for detail progress modal
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<{
    assignment: any;
    statistics: any;
    completed: StudentProgressData[];
    in_progress: StudentProgressData[];
    not_completed: StudentProgressData[];
  } | null>(null);

  const [activeDetailTab, setActiveDetailTab] = useState<'not_completed' | 'completed'>('not_completed');
  const [sendingReminder, setSendingReminder] = useState<number | 'all' | null>(null);

  // Reset current page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, targetFilter, statusFilter, sortBy]);

  // Load assignments
  const loadAssignments = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res: any = await teacherApi.assignments.getAll();
      const list = res?.data ?? res ?? [];
      setAssignments(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('Failed to load assignments:', err);
      toast.error('Không thể tải danh sách đề đã giao: ' + (err.message || 'Lỗi kết nối'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  // Load assignment detail progress
  const openDetailModal = async (id: number) => {
    setSelectedAssignmentId(id);
    setDetailLoading(true);
    try {
      const res: any = await teacherApi.assignments.getProgress(id);
      const data = res?.data ?? res;
      setDetailData(data);
      // Auto-switch to not_completed if there are incomplete students, otherwise completed
      if (data?.not_completed?.length > 0) {
        setActiveDetailTab('not_completed');
      } else {
        setActiveDetailTab('completed');
      }
    } catch (err: any) {
      console.error('Failed to load assignment progress:', err);
      toast.error('Không thể tải tiến độ làm bài: ' + (err.message || 'Lỗi'));
      setSelectedAssignmentId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Send reminders
  const handleSendReminder = async (assignmentId: number, studentId?: number) => {
    setSendingReminder(studentId ?? 'all');
    try {
      const res: any = await teacherApi.assignments.sendReminders(assignmentId, studentId ? { student_id: studentId } : undefined);
      toast.success(res?.message || (studentId ? 'Đã gửi nhắc nhở tới học viên.' : 'Đã gửi nhắc nhở cho tất cả học viên chưa làm bài.'));
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi gửi nhắc nhở.';
      toast.error(msg);
    } finally {
      setSendingReminder(null);
    }
  };

  // Filtered & sorted assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter((item) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const titleMatch = item.exam?.eTitle?.toLowerCase().includes(q);
        const targetMatch = item.target_name?.toLowerCase().includes(q);
        const typeMatch = item.exam?.eType?.toLowerCase().includes(q);
        if (!titleMatch && !targetMatch && !typeMatch) return false;
      }

      // Target type
      if (targetFilter !== 'all' && item.taTarget_type !== targetFilter) {
        return false;
      }

      // Status
      if (statusFilter === 'active' && item.is_overdue) return false;
      if (statusFilter === 'overdue' && !item.is_overdue) return false;
      if (statusFilter === 'completed' && (item.completion_rate ?? 0) < 100) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'newest') {
        const tA = new Date(a.taCreated_at || 0).getTime();
        const tB = new Date(b.taCreated_at || 0).getTime();
        return tB - tA;
      }
      if (sortBy === 'deadline') {
        const dA = a.taDeadline ? new Date(a.taDeadline).getTime() : Infinity;
        const dB = b.taDeadline ? new Date(b.taDeadline).getTime() : Infinity;
        return dA - dB;
      }
      if (sortBy === 'completion') {
        return (b.completion_rate ?? 0) - (a.completion_rate ?? 0);
      }
      return 0;
    });
  }, [assignments, search, targetFilter, statusFilter, sortBy]);

  // Paginated assignments
  const totalPages = Math.ceil(filteredAssignments.length / ITEMS_PER_PAGE);
  const paginatedAssignments = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAssignments.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAssignments, currentPage, ITEMS_PER_PAGE]);

  // Overall statistics
  const stats = useMemo(() => {
    const total = assignments.length;
    const active = assignments.filter((a) => !a.is_overdue).length;
    const overdue = assignments.filter((a) => a.is_overdue).length;
    const avgCompletion = total > 0
      ? Math.round(assignments.reduce((acc, a) => acc + (a.completion_rate ?? 0), 0) / total)
      : 0;

    return { total, active, overdue, avgCompletion };
  }, [assignments]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Không giới hạn';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getDeadlineBadge = (item: AssignmentItem) => {
    if (!item.taDeadline) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
          <Clock className="w-3 h-3" /> Không có hạn
        </span>
      );
    }
    const deadline = new Date(item.taDeadline);
    const now = new Date();
    const isPast = now > deadline;

    if (isPast) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 ring-1 ring-rose-200">
          <AlertCircle className="w-3 h-3" /> Đã hết hạn
        </span>
      );
    }

    const diffHours = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (diffHours <= 24) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-200">
          <Clock className="w-3 h-3 text-amber-500" /> Còn {Math.max(1, Math.round(diffHours))} giờ
        </span>
      );
    }

    const diffDays = Math.round(diffHours / 24);
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
        <Clock className="w-3 h-3 text-emerald-500" /> Còn {diffDays} ngày
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Stats Overview ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Tổng số đợt giao đề', value: stats.total, icon: BookOpen, color: '#6366F1', bg: '#EEF2FF' },
          { label: 'Đang diễn ra (Còn hạn)', value: stats.active, icon: Clock, color: '#10B981', bg: '#D1FAE5' },
          { label: 'Đã hết hạn nộp', value: stats.overdue, icon: AlertTriangle, color: '#F59E0B', bg: '#FEF3C7' },
          { label: 'Tỷ lệ nộp bài trung bình', value: `${stats.avgCompletion}%`, icon: Award, color: '#8B5CF6', bg: '#EDE9FE', showBar: true },
        ].map((s, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-sm transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
                <s.icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-slate-500 text-xs font-medium truncate">{s.label}</p>
                <p className="text-xl font-bold text-slate-800 leading-tight mt-0.5">{s.value}</p>
              </div>
            </div>
            {s.showBar && (
              <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-violet-600 transition-all duration-500" style={{ width: `${stats.avgCompletion}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Toolbar: Search, Filters, Sort ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm theo tên đề thi, lớp học, học viên..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Target Type Filter */}
            <select
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 cursor-pointer"
            >
              <option value="all">Tất cả đối tượng</option>
              <option value="class">👥 Giao theo Lớp</option>
              <option value="student">👤 Giao cho Cá nhân</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">🟢 Đang mở (Còn hạn)</option>
              <option value="overdue">🔴 Đã hết hạn</option>
              <option value="completed">✨ Hoàn thành 100%</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 cursor-pointer"
            >
              <option value="newest">📅 Mới nhất</option>
              <option value="deadline">⏰ Hạn nộp gần nhất</option>
              <option value="completion">📊 Tỷ lệ nộp bài</option>
            </select>

            {/* Refresh */}
            <button
              onClick={() => loadAssignments(true)}
              disabled={refreshing}
              className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
              title="Làm mới"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-violet-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Assignment List ── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <RefreshCw className="w-8 h-8 text-violet-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-600 text-sm font-medium">Đang tải danh sách đề đã giao...</p>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-violet-500">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Không tìm thấy đợt giao đề nào</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
            {search || targetFilter !== 'all' || statusFilter !== 'all'
              ? 'Thử thay đổi từ khóa tìm kiếm hoặc bỏ bớt bộ lọc.'
              : 'Bạn chưa giao đề nào cho lớp hoặc học viên. Hãy vào mục Ngân hàng đề để giao bài tập mới.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginatedAssignments.map((item) => {
              const total = item.total_students || 0;
              const completed = item.completed_students || 0;
              const inProgress = item.in_progress_students || 0;
              const notStarted = Math.max(0, total - completed - inProgress);
              const rate = item.completion_rate ?? (total > 0 ? Math.round((completed / total) * 100) : 0);
              const isTargetClass = item.taTarget_type === 'class';
              const canRemind = item.can_send_reminder && notStarted + inProgress > 0;

              return (
                <div
                  key={item.taId}
                  className="bg-white rounded-2xl border border-slate-200/80 hover:border-violet-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group"
                >
                  <div className="p-5 space-y-4">
                    {/* Top Bar: Exam Type & Deadline Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-violet-100 text-violet-700 tracking-wide uppercase">
                          {item.exam?.eType || 'ĐỀ THI'}
                        </span>
                        {item.exam?.eSkill && (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600">
                            {item.exam.eSkill}
                          </span>
                        )}
                      </div>
                      <div>{getDeadlineBadge(item)}</div>
                    </div>

                    {/* Exam Title */}
                    <div>
                      <h3 className="text-[15px] font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-violet-700 transition-colors">
                        {item.exam?.eTitle || 'Đề không có tiêu đề'}
                      </h3>
                    </div>

                    {/* Target Info */}
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isTargetClass ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {isTargetClass ? <Users className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">{isTargetClass ? 'Giao cho Lớp' : 'Giao cho Học viên'}</p>
                        <p className="font-bold text-slate-800 truncate">{item.target_name || (isTargetClass ? `Lớp #${item.taTarget_id}` : `Học viên #${item.taTarget_id}`)}</p>
                      </div>
                      <span className="text-xs font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200/60">
                        {total} HV
                      </span>
                    </div>

                    {/* Progress Bar & Breakdown */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-600">Tiến độ nộp bài:</span>
                        <span className="font-bold text-violet-700">{completed}/{total} HV ({rate}%)</span>
                      </div>

                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                        {completed > 0 && (
                          <div
                            style={{ width: `${(completed / total) * 100}%` }}
                            className="bg-emerald-500 transition-all duration-300"
                            title={`Đã nộp: ${completed} HV`}
                          />
                        )}
                        {inProgress > 0 && (
                          <div
                            style={{ width: `${(inProgress / total) * 100}%` }}
                            className="bg-amber-400 transition-all duration-300"
                            title={`Đang làm: ${inProgress} HV`}
                          />
                        )}
                        {notStarted > 0 && (
                          <div
                            style={{ width: `${(notStarted / total) * 100}%` }}
                            className="bg-slate-200 transition-all duration-300"
                            title={`Chưa làm: ${notStarted} HV`}
                          />
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Đã nộp: <b>{completed}</b>
                        </span>
                        {inProgress > 0 && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Đang làm: <b>{inProgress}</b>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" /> Chưa làm: <b>{notStarted}</b>
                        </span>
                      </div>
                    </div>

                    {/* Deadline & Time Info */}
                    <div className="text-[11px] text-slate-500 space-y-0.5 border-t border-slate-100 pt-2.5">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Thời gian giao:</span>
                        <span className="font-medium text-slate-700">{formatDate(item.taCreated_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Hạn nộp bài:</span>
                        <span className="font-semibold text-slate-800">{formatDate(item.taDeadline)}</span>
                      </div>
                      {item.taMax_attempt && item.taMax_attempt > 1 && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Số lần làm tối đa:</span>
                          <span className="font-medium text-slate-700">{item.taMax_attempt} lần</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => openDetailModal(item.taId)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-violet-50 text-violet-700 border border-violet-200/80 hover:border-violet-300 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                      Xem tiến độ ({completed}/{total})
                    </button>

                    <button
                      onClick={() => handleSendReminder(item.taId)}
                      disabled={!canRemind || sendingReminder === 'all'}
                      title={!item.can_send_reminder ? 'Đề thi đã hết hạn, không thể gửi nhắc nhở' : notStarted + inProgress === 0 ? 'Tất cả học viên đã nộp bài' : 'Gửi thông báo nhắc nhở đến tất cả học viên chưa làm'}
                      className={`inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        canRemind
                          ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm cursor-pointer active:scale-95'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      <Bell className={`w-3.5 h-3.5 ${sendingReminder === 'all' ? 'animate-bounce' : ''}`} />
                      <span>Nhắc nhở {notStarted + inProgress > 0 ? `(${notStarted + inProgress})` : ''}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Pagination Controls ── */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mt-4">
              <p className="text-xs text-slate-500 font-medium">
                Hiển thị <span className="font-semibold text-slate-700">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span className="font-semibold text-slate-700">{Math.min(currentPage * ITEMS_PER_PAGE, filteredAssignments.length)}</span> trên <span className="font-semibold text-slate-700">{filteredAssignments.length}</span> đợt giao
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  Trước
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const p = idx + 1;
                  if (totalPages > 7) {
                    if (p !== 1 && p !== totalPages && Math.abs(p - currentPage) > 1) {
                      if (p === 2 && currentPage > 3) return <span key={p} className="px-1 text-slate-400 text-xs">...</span>;
                      if (p === totalPages - 1 && currentPage < totalPages - 2) return <span key={p} className="px-1 text-slate-400 text-xs">...</span>;
                      return null;
                    }
                  }
                  const isCurrent = p === currentPage;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Detail Progress Modal ── */}
      {selectedAssignmentId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-500/30 text-violet-300 uppercase tracking-wider">
                    {detailData?.assignment?.exam?.eType || 'ĐỀ THI'}
                  </span>
                  <span className="text-slate-300 text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Hạn: {formatDate(detailData?.assignment?.taDeadline)}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white truncate">
                  {detailData?.assignment?.exam?.eTitle || 'Chi tiết tiến độ giao đề'}
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Đối tượng: <b className="text-white">{detailData?.assignment?.target_name}</b> ({detailData?.statistics?.total_students || 0} học viên)
                </p>
              </div>

              <button
                onClick={() => { setSelectedAssignmentId(null); setDetailData(null); }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            {detailLoading || !detailData ? (
              <div className="p-16 text-center">
                <RefreshCw className="w-8 h-8 text-violet-600 animate-spin mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">Đang tải tiến độ học viên...</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto flex flex-col">
                {/* Stats Header in Modal */}
                <div className="grid grid-cols-3 gap-3 p-5 bg-slate-50 border-b border-slate-100">
                  <div className="bg-white p-3 rounded-xl border border-slate-200/70 text-center">
                    <p className="text-xs text-slate-500">Đã nộp bài</p>
                    <p className="text-xl font-bold text-emerald-600 mt-0.5">
                      {detailData.statistics?.completed_count || 0} <span className="text-xs font-normal text-slate-400">HV</span>
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200/70 text-center">
                    <p className="text-xs text-slate-500">Đang làm dở</p>
                    <p className="text-xl font-bold text-amber-600 mt-0.5">
                      {detailData.statistics?.in_progress_count || 0} <span className="text-xs font-normal text-slate-400">HV</span>
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200/70 text-center">
                    <p className="text-xs text-slate-500">Chưa làm bài</p>
                    <p className="text-xl font-bold text-slate-700 mt-0.5">
                      {detailData.not_completed.filter((s) => s.status !== 'in_progress').length} <span className="text-xs font-normal text-slate-400">HV</span>
                    </p>
                  </div>
                </div>

                {/* Sub-tabs & Bulk Action */}
                <div className="px-5 pt-3 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap bg-white sticky top-0 z-10">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveDetailTab('not_completed')}
                      className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                        activeDetailTab === 'not_completed'
                          ? 'border-violet-600 text-violet-700'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      Chưa hoàn thành ({detailData.not_completed?.length || 0})
                    </button>
                    <button
                      onClick={() => setActiveDetailTab('completed')}
                      className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                        activeDetailTab === 'completed'
                          ? 'border-violet-600 text-violet-700'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Đã nộp bài ({detailData.completed?.length || 0})
                    </button>
                  </div>

                  {/* Bulk Reminder Button */}
                  {activeDetailTab === 'not_completed' && detailData.not_completed?.length > 0 && (
                    <button
                      onClick={() => handleSendReminder(selectedAssignmentId)}
                      disabled={!detailData.assignment?.can_send_reminder || sendingReminder === 'all'}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all mb-2 ${
                        detailData.assignment?.can_send_reminder
                          ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      <Bell className={`w-3.5 h-3.5 ${sendingReminder === 'all' ? 'animate-spin' : ''}`} />
                      Nhắc nhở tất cả bạn chưa nộp ({detailData.not_completed.length})
                    </button>
                  )}
                </div>

                {/* Students List in Tab */}
                <div className="p-5 flex-1 divide-y divide-slate-100">
                  {activeDetailTab === 'not_completed' ? (
                    detailData.not_completed.length === 0 ? (
                      <div className="py-12 text-center">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                        <p className="text-base font-bold text-slate-800">Tất cả học viên đã hoàn thành!</p>
                        <p className="text-xs text-slate-500 mt-1">Không còn học viên nào chưa nộp bài.</p>
                      </div>
                    ) : (
                      detailData.not_completed.map((student) => {
                        const isInProgress = student.status === 'in_progress';
                        return (
                          <div key={student.uId} className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 font-bold flex items-center justify-center flex-shrink-0 text-xs">
                                {student.uName?.charAt(0)?.toUpperCase() || 'H'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">{student.uName}</p>
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                  {student.uPhone && (
                                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {student.uPhone}</span>
                                  )}
                                  {student.uEmail && (
                                    <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3" /> {student.uEmail}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                isInProgress
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {isInProgress ? 'Đang làm dở...' : 'Chưa làm'}
                              </span>

                              <button
                                onClick={() => handleSendReminder(selectedAssignmentId, student.uId)}
                                disabled={!detailData.assignment?.can_send_reminder || sendingReminder === student.uId}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  detailData.assignment?.can_send_reminder
                                    ? 'bg-white hover:bg-amber-50 text-amber-700 border border-amber-300 cursor-pointer hover:shadow-sm'
                                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                }`}
                              >
                                <Bell className={`w-3 h-3 ${sendingReminder === student.uId ? 'animate-spin text-amber-600' : ''}`} />
                                Nhắc nhở
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )
                  ) : (
                    detailData.completed.length === 0 ? (
                      <div className="py-12 text-center">
                        <Clock className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                        <p className="text-base font-bold text-slate-800">Chưa có học viên nào nộp bài</p>
                        <p className="text-xs text-slate-500 mt-1">Các bài làm đã nộp sẽ được thống kê và hiển thị điểm số tại đây.</p>
                      </div>
                    ) : (
                      detailData.completed.map((student) => {
                        const sub = student.submission;
                        const score = sub?.sScore !== null && sub?.sScore !== undefined ? Number(sub.sScore).toFixed(2) : '--';

                        return (
                          <div key={student.uId} className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center flex-shrink-0 text-xs">
                                {student.uName?.charAt(0)?.toUpperCase() || 'H'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">{student.uName}</p>
                                <p className="text-xs text-slate-400">
                                  Nộp lúc: {formatDate(sub?.sSubmit_time)} {sub?.sAttempt ? `(Lần ${sub.sAttempt})` : ''}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-xs text-slate-400 font-medium">Điểm số</p>
                                <p className="text-base font-black text-emerald-600">{score}</p>
                              </div>

                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                sub?.sStatus === 'graded'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : sub?.sStatus === 'grading_subjective'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {sub?.sStatus === 'graded' ? 'Đã chấm' : sub?.sStatus === 'grading_subjective' ? 'Chấm tự luận' : 'Đã nộp'}
                              </span>

                              {sub?.sId && onSelectSubmission && (
                                <button
                                  onClick={() => {
                                    setSelectedAssignmentId(null);
                                    onSelectSubmission(sub.sId);
                                  }}
                                  className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 font-bold text-xs rounded-lg border border-violet-200 transition-colors cursor-pointer"
                                >
                                  Xem bài làm
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => { setSelectedAssignmentId(null); setDetailData(null); }}
                className="px-5 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

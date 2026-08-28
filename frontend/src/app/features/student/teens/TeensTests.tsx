/**
 * TeensTests — Trang "Bài tập" cho học viên Teens (13–17)
 *
 * CHỈ hiển thị đề đã được giáo viên giao (assignment qua getTests).
 * Không browse full bank teens/THPT.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Clock, ListChecks, Search, Play, RotateCcw,
  Sparkles, Gift, ClipboardList, BookOpen, AlertTriangle,
  Headphones, Mic, PenLine, FileText, ArrowRight, CheckCircle,
  CalendarDays, Zap,
} from 'lucide-react';
import { studentApi } from '../../../../services/studentApi';
import { usePageTitle, PAGE_TITLES } from '../../../../hooks/usePageTitle';
import { getVNTimestamp, isWithinLastHours } from '@/utils/dateUtils';

const BASE = '/hoc-vien';
const TEAL = '#0D9488';
const TEAL_MID = '#14B8A6';

type Status = 'pending' | 'in_progress' | 'completed';

const SKILL_LABELS: Record<string, string> = {
  mixed: 'Tổng hợp', grammar: 'Ngữ pháp', vocabulary: 'Từ vựng',
  reading: 'Đọc hiểu', listening: 'Nghe', writing: 'Viết', speaking: 'Nói',
};
function skillLabel(s?: string) {
  const k = String(s ?? '').toLowerCase();
  return SKILL_LABELS[k] ?? (s ? s[0].toUpperCase() + s.slice(1) : '');
}

// Định dạng ngày xuất bản đề: dd/MM/yyyy (giờ VN)
function formatPublishDate(raw?: string | null): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Icon theo kỹ năng — dùng cho ô icon nhã nhặn trên thẻ.
function skillIcon(s?: string) {
  switch (String(s ?? '').toLowerCase()) {
    case 'listening': return Headphones;
    case 'speaking': return Mic;
    case 'writing': return PenLine;
    case 'reading': return BookOpen;
    default: return FileText;
  }
}

interface TeensExamItem {
  key: string;
  examId: number;
  title: string;
  type?: string;
  skill?: string;
  scope?: string;
  partNumber?: number | null;
  duration?: number;
  questions?: number;
  status: Status;
  submissionId: number | null;
  assignmentId: number | null;
  isAssigned: boolean;
  deadline?: string | null;
  createdAt?: string | null;
  /** Thời điểm giáo viên giao (taCreated_at → start_time). */
  assignedAt?: string | null;
  /** Số lượt đã dùng (đếm submission theo assignment). */
  attemptsUsed?: number | null;
  /** Số lượt tối đa GV cấu hình. <= 0 hoặc null = không giới hạn. */
  attemptsAllowed?: number | null;
}

// ─── Card ──────────────────────────────────────────────────────────────────────
function ExamCard({ item, showAssignedBadge }: { item: TeensExamItem; showAssignedBadge: boolean }) {
  const SkillIcon = skillIcon(item.skill);
  const normalizedScope = String(item.scope || (item.skill === 'mixed' ? 'full' : 'skill')).toLowerCase();
  const scopeLabel = normalizedScope === 'full' ? 'Full test' : normalizedScope === 'part' ? `Part ${item.partNumber ?? ''}`.trim() : 'Skill';

  // Hết hạn = đề được giao có deadline đã qua. Khi đó "hạ cấp" về đề tự do:
  // bỏ ràng buộc assignment, chỉ còn 1 nút "Làm bài" (làm mới qua đường direct).
  const isExpired = !!item.deadline && item.isAssigned && new Date(item.deadline).getTime() < Date.now();
  const effectiveAssigned = item.isAssigned && !isExpired;

  // Khi hết hạn, ép trạng thái card về "pending" để chỉ hiện nút "Làm bài"
  // (ẩn Kết quả + Làm lại); xem kết quả cũ chuyển sang tab Lịch sử.
  const isCompleted = !isExpired && item.status === 'completed';
  const inProgress = item.status === 'in_progress';

  const dot = isCompleted ? '#10B981' : inProgress ? '#F59E0B' : '#94A3B8';
  const statusText = isCompleted ? 'Hoàn thành' : inProgress ? 'Đang làm' : 'Chưa làm';

  // Đề "tổng hợp" (THPT-config: có cả Nghe/Nói/Đọc…) dùng player riêng theo
  // thpt_config; các đề thường (questions[]) dùng engine teens cũ.
  const isThpt = String(item.type ?? '').toUpperCase() === 'THPT';

  // Assigned-only: luôn đi qua assignment khi có assignmentId.
  // Không fallback free direct (backend đã chặn start-teens nếu chưa được giao).
  const startTo = isThpt
    ? (item.assignmentId
      ? `${BASE}/lam-bai-thpt/${item.examId}?assignmentId=${item.assignmentId}`
      : `${BASE}/bai-tap`)
    : (item.assignmentId
      ? `${BASE}/phong-cho/${item.assignmentId}`
      : `${BASE}/bai-tap`);

  // Làm lại vẫn qua assignment để tôn trọng số lần / phòng chờ
  const redoTo = isThpt
    ? (item.assignmentId
      ? `${BASE}/lam-bai-thpt/${item.examId}?assignmentId=${item.assignmentId}`
      : `${BASE}/bai-tap`)
    : (item.assignmentId
      ? `${BASE}/phong-cho/${item.assignmentId}`
      : `${BASE}/bai-tap`);

  const isNewAssign = isWithinLastHours(item.assignedAt, 1);

  // Số lượt làm bài của đề được giao. allowed <= 0 (hoặc null) = không giới hạn.
  // Backend (ThptExamController::startSubmission + StudentTestController::start)
  // chặn tạo phiên mới khi hết lượt; ở đây chỉ ẩn nút để học viên không bấm
  // vào rồi nhận lỗi 403.
  const attemptsUsed = item.attemptsUsed ?? 0;
  const attemptsAllowed = item.attemptsAllowed ?? 0;
  const hasAttemptsLeft = attemptsAllowed <= 0 || attemptsUsed < attemptsAllowed;
  // Bài đang làm dở luôn được vào tiếp (backend resume trước khi gate lượt).
  const canStartNewAttempt = !effectiveAssigned || hasAttemptsLeft || inProgress;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl bg-white ring-1 ring-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:ring-teal-300/70 hover:shadow-[0_12px_26px_-14px_rgba(13,148,136,0.3)]">
      {isNewAssign && (
        <span
          className="absolute top-3 -right-7 rotate-45 z-20 bg-gradient-to-r from-rose-500 to-orange-500 text-white text-[9px] font-extrabold uppercase tracking-wider px-8 py-0.5 shadow-md animate-pulse"
          title="Giáo viên vừa giao trong 1 giờ gần đây"
        >
          Mới
        </span>
      )}
      {/* Orb trang trí — hình tròn mờ tông teal/cyan, đậm hơn khi hover (đồng bộ thẻ adults) */}
      <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-40 group-hover:opacity-70 transition-opacity duration-300 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.35), transparent 70%)' }} />
      <div className="absolute -bottom-10 -left-6 w-24 h-24 rounded-full opacity-25 group-hover:opacity-45 transition-opacity duration-300 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.28), transparent 70%)' }} />

      {/* Dải nhấn teal mảnh phía trên, hiện rõ hơn khi hover */}
      <span className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-teal-500/60 via-teal-400 to-cyan-400/60 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative flex flex-col flex-1 p-3.5">
        {/* Hàng đầu: icon + trạng thái */}
        <div className="flex items-center justify-between">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-teal-50 text-teal-700 ring-1 ring-teal-100 flex-shrink-0">
            <SkillIcon className="w-4 h-4" />
          </div>
          {inProgress ? (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold flex-shrink-0 rounded-full px-2 py-0.5 text-rose-600 bg-rose-50 ring-1 ring-rose-200 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Làm dở
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-slate-500 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
              {statusText}
            </span>
          )}
        </div>

        {/* Title — chiếm trọn chiều ngang */}
        <h3 className="text-[13px] font-bold text-slate-900 leading-snug line-clamp-2 min-h-[34px] tracking-[-0.01em] mt-2.5">
          {item.title}
        </h3>

        {/* Nhãn phạm vi + GV giao + kỹ năng */}
        <div className="flex items-center flex-wrap gap-1 mt-2">
          <span className="inline-flex items-center text-[10px] font-semibold text-teal-700 bg-teal-50 rounded px-1.5 py-0.5">
            {scopeLabel}
          </span>
          {item.skill && (
            <span className="inline-flex items-center text-[10px] font-semibold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
              {skillLabel(item.skill)}
            </span>
          )}
          {showAssignedBadge && effectiveAssigned && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">
              <Gift className="w-2.5 h-2.5" /> GV giao
            </span>
          )}
          {isWithinLastHours(item.assignedAt, 1) && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-white rounded-full px-2 py-0.5 shadow-sm animate-pulse"
              style={{ background: 'linear-gradient(135deg, #F43F5E 0%, #F97316 100%)', boxShadow: '0 2px 8px rgba(244,63,94,0.35)' }}
              title="Giáo viên vừa giao trong 1 giờ gần đây"
            >
              <Zap className="w-2.5 h-2.5 fill-current" />
              Mới giao
            </span>
          )}
        </div>

        {/* Meta: thời lượng · số câu · ngày xuất bản — gộp một hàng */}
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-400 mt-2">
          {!!item.duration && item.duration > 0 && (
            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> <span className="tabular-nums">{item.duration}</span>p</span>
          )}
          {!!item.questions && item.questions > 0 && (
            <span className="inline-flex items-center gap-1"><ListChecks className="w-3 h-3" /> <span className="tabular-nums">{item.questions}</span> câu</span>
          )}
          {formatPublishDate(item.createdAt) && (
            <span className="inline-flex items-center gap-1" title="Ngày giáo viên xuất bản đề">
              <CalendarDays className="w-3 h-3" /> <span className="tabular-nums">{formatPublishDate(item.createdAt)}</span>
            </span>
          )}
        </div>

        {/* Số lượt làm bài — chỉ với đề giáo viên giao còn hiệu lực */}
        {effectiveAssigned && attemptsAllowed > 0 && (
          <div className="flex items-center flex-wrap gap-1.5 mt-2">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700 bg-violet-50 rounded px-1.5 py-0.5"
              title="Số lượt làm bài giáo viên cho phép"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span className="tabular-nums">{attemptsUsed}/{attemptsAllowed}</span> lượt
            </span>
            {!hasAttemptsLeft && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 rounded px-1.5 py-0.5">
                <AlertTriangle className="w-2.5 h-2.5" /> Hết lượt
              </span>
            )}
          </div>
        )}

        {/* Action */}
        <div className="mt-3">
          {isCompleted && item.submissionId ? (
            <div className="flex items-center gap-2">
              {/* Hết lượt → không hiện "Làm lại" (backend sẽ trả 403) */}
              {canStartNewAttempt && (
                <Link to={redoTo}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-slate-700 bg-white ring-1 ring-slate-200 transition-all hover:ring-teal-300 hover:text-teal-700 active:scale-[0.98]">
                  <RotateCcw className="w-3.5 h-3.5" /> Làm lại
                </Link>
              )}
              <Link to={`${BASE}/ket-qua/${item.submissionId}`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-white transition-all active:scale-[0.98]"
                style={{ background: TEAL }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#0B7E74')}
                onMouseLeave={(e) => (e.currentTarget.style.background = TEAL)}>
                <CheckCircle className="w-3.5 h-3.5" /> Kết quả
              </Link>
            </div>
          ) : canStartNewAttempt ? (
            <Link to={startTo}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-all active:scale-[0.98] shadow-[0_5px_14px_-8px_rgba(13,148,136,0.6)]"
              style={{ background: TEAL }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#0B7E74')}
              onMouseLeave={(e) => (e.currentTarget.style.background = TEAL)}>
              {inProgress ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white" />}
              {inProgress ? 'Làm tiếp' : 'Bắt đầu'}
              <ArrowRight className="w-3.5 h-3.5 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title="Bạn đã dùng hết số lượt làm bài giáo viên cho phép"
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-slate-400 bg-slate-100 ring-1 ring-slate-200 cursor-not-allowed"
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Đã hết lượt làm bài
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function TeensTests() {
  usePageTitle(PAGE_TITLES.STUDENT_TESTS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'duration' | 'questions'>('newest');

  // Chỉ đề giáo viên giao
  const { data: assignedData, isLoading: assignedLoading } = useQuery({
    queryKey: ['student', 'tests', 'teens-assigned'],
    queryFn: () => studentApi.getTests({}),
  });

    const assignedExams: TeensExamItem[] = useMemo(() => {
    const groups = (assignedData as any)?.data?.data;
    if (!groups) return [];
    const map = (arr: any[], s: Status) => (arr || []).map((t: any) => ({
      key: `asg-${t.assignment_id}`,
      examId: t.exam_id,
      title: t.exam_title,
      type: t.exam_type,
      skill: t.exam_skill,
      scope: t.scope ?? (String(t.exam_skill ?? '').toLowerCase() === 'mixed' ? 'full' : 'skill'),
      partNumber: t.part_number ?? null,
      duration: t.exam_duration,
      questions: t.total_questions,
      status: s,
      submissionId: t.submission_id ?? null,
      assignmentId: t.assignment_id ?? null,
      isAssigned: true,
      deadline: t.deadline ?? null,
      createdAt: t.created_at ?? t.exam_created_at ?? null,
      // API map taCreated_at → start_time
      assignedAt: t.assigned_at ?? t.start_time ?? t.created_at ?? null,
      // Lượt làm bài: backend /student/tests trả attempts_used + attempts_allowed
      // (attempts_allowed = taMax_attempt của assignment).
      attemptsUsed: t.attempts_used ?? 0,
      attemptsAllowed: t.attempts_allowed ?? 0,
    }));
    const isPastDeadline = (d?: string | null) => !!d && new Date(d).getTime() < Date.now();
    return [
      ...map(groups.in_progress, 'in_progress'),
      ...map(groups.pending, 'pending'),
      ...map(groups.completed, 'completed'),
    ].filter((t) => !isPastDeadline(t.deadline));
  }, [assignedData]);

  const source = assignedExams;
  const isLoading = assignedLoading;

  const visible = useMemo(() => {
    let result = source;

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((t) => String(t.title ?? '').toLowerCase().includes(q));
    }

    // Sort items
    const sorted = [...result];
    if (sortBy === 'newest') {
      sorted.sort(
        (a, b) =>
          getVNTimestamp(b.assignedAt || b.createdAt) - getVNTimestamp(a.assignedAt || a.createdAt)
          || b.examId - a.examId,
      );
    } else if (sortBy === 'duration') {
      sorted.sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0));
    } else if (sortBy === 'questions') {
      sorted.sort((a, b) => (b.questions ?? 0) - (a.questions ?? 0));
    }

    return sorted;
  }, [source, search, statusFilter, sortBy]);

  // ─── Phân trang: 12 bài / trang ───────────────────────────────────────────
  const PAGE_SIZE = 12;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, statusFilter, sortBy]);
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = useMemo(
    () => visible.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE),
    [visible, pageSafe]
  );

  // Badge phải khớp CHÍNH XÁC với danh sách hiển thị trong tab "Giáo viên giao"
  // (assignedExams đã loại các bài quá hạn deadline). Nếu đếm từ allExams sẽ lệch.
  const assignedCount = assignedExams.length;
  const stats = {
    total: assignedExams.length,
    pending: assignedExams.filter((e) => e.status === 'pending').length,
    inProgress: assignedExams.filter((e) => e.status === 'in_progress').length,
    completed: assignedExams.filter((e) => e.status === 'completed').length,
  };

  return (
    <div className="min-h-screen" style={{ background: '#F0FDFA' }}>
      {/* ══ Hero ══════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #134E4A 0%, #0F766E 45%, #14B8A6 100%)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-80 h-80 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #5EEAD4, transparent)', transform: 'translateY(-50%)' }} />
          <div className="absolute bottom-0 right-1/3 w-64 h-64 rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, #2DD4BF, transparent)', transform: 'translateY(40%)' }} />
        </div>
        <div className="relative z-10 px-6 sm:px-8 lg:px-10 py-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-teal-200 text-xs font-bold tracking-widest uppercase mb-1">Bài được giao</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">Bài giáo viên giao</h1>
              <p className="text-teal-100 text-sm mt-1">Chỉ hiện bài giáo viên đã giao cho bạn — chọn một bài để bắt đầu nhé!</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { label: 'Tổng số đề', value: stats.total, color: '#99F6E4' },
              { label: 'Chưa làm', value: stats.pending, color: '#FCD34D' },
              { label: 'Đang làm', value: stats.inProgress, color: '#FDBA74' },
              { label: 'Hoàn thành', value: stats.completed, color: '#86EFAC' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}>
                <span className="text-xl font-extrabold tabular-nums" style={{ color: s.color }}>
                  {assignedLoading ? '—' : s.value}
                </span>
                <span className="text-xs font-semibold text-teal-100">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ Toolbar ════════════════════════════════════════════════════════════ */}
      <div className="px-6 sm:px-8 lg:px-10 py-5 max-w-[1600px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          {/* Assigned-only badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)', boxShadow: '0 4px 14px rgba(79,70,229,0.3)' }}>
            <Gift className="w-4 h-4" /> Giáo viên giao
            {assignedCount > 0 && (
              <span className="text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 font-bold"
                style={{ background: 'rgba(255,255,255,0.25)' }}>
                {assignedCount}
              </span>
            )}
          </div>

          {/* Bộ lọc trạng thái */}
          <div className="relative flex-shrink-0">
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="pl-3 pr-8 py-2.5 rounded-xl text-sm font-bold border border-slate-200 bg-white text-slate-600 outline-none cursor-pointer focus:border-teal-300 transition-colors appearance-none"
              style={{ minWidth: '150px' }}
            >
              <option value="all">⏳ Trạng thái: Tất cả</option>
              <option value="pending">📖 Chưa làm</option>
              <option value="in_progress">⏱️ Đang làm dở</option>
              <option value="completed">✅ Hoàn thành</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</div>
          </div>

          {/* Sắp xếp */}
          <div className="relative flex-shrink-0">
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="pl-3 pr-8 py-2.5 rounded-xl text-sm font-bold border border-slate-200 bg-white text-slate-600 outline-none cursor-pointer focus:border-teal-300 transition-colors appearance-none"
              style={{ minWidth: '160px' }}
            >
              <option value="newest">📅 Mới nhất</option>
              <option value="duration">⏱️ Thời gian (nhiều trước)</option>
              <option value="questions">📝 Số câu hỏi (nhiều trước)</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</div>
          </div>

          {/* Search */}
          <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Tìm đề…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium outline-none focus:border-teal-300 transition-colors"
              style={{ background: '#fff', border: '1px solid #E2E8F0', color: '#0F172A' }} />
          </div>
        </div>

        {/* ══ List ════════════════════════════════════════════════════════════ */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-44 rounded-xl animate-pulse bg-white border border-slate-200" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <div className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-5"
              style={{ background: '#CCFBF1' }}>
              <Gift className="w-10 h-10" style={{ color: TEAL }} />
            </div>
            <h3 className="text-lg font-extrabold text-slate-800">
              {search ? 'Không tìm thấy bài nào' : 'Chưa có bài giáo viên giao'}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {search ? 'Thử từ khóa khác nhé!' : 'Khi thầy cô giao bài, bài sẽ hiện ở đây.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paged.map((t) => (
              <ExamCard key={t.key} item={t} showAssignedBadge={false} />
            ))}
          </div>
        )}

        {/* ══ Pager ════════════════════════════════════════════════════════════ */}
        {!isLoading && visible.length > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-1.5 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pageSafe <= 1}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              ← Trước
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className="min-w-[38px] h-[38px] rounded-lg text-sm font-bold transition-colors"
                style={p === pageSafe
                  ? { background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})`, color: '#fff' }
                  : { background: '#fff', border: '1px solid #E2E8F0', color: '#475569' }}>
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={pageSafe >= totalPages}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Sau →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

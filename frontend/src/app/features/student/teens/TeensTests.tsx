/**
 * TeensTests — Trang "Bài tập" cho học viên Teens (13–17)
 *
 * 2 chế độ xem (tab):
 *  1. "Tất cả bài tập"  → browseTeensExams: LẤY HẾT đề teens đã publish.
 *                         Đề được giáo viên giao riêng có gắn nhãn "Cô giao".
 *                         Đề tự do thì làm trực tiếp (direct=1, không cần assignment).
 *  2. "Giáo viên giao"  → getTests: chỉ các đề thầy cô giao (assignment) + trạng thái.
 *
 * Style: teal/slate chuyên nghiệp — đồng bộ TeensLayout/TeensDashboard.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Clock, ListChecks, Search, CheckCircle2, Play, RotateCcw,
  Sparkles, Gift, ClipboardList, BookOpen, AlertTriangle,
} from 'lucide-react';
import { studentApi } from '../../../../services/studentApi';
import { usePageTitle, PAGE_TITLES } from '../../../../hooks/usePageTitle';

const BASE = '/hoc-vien';
const TEAL = '#0D9488';
const TEAL_MID = '#14B8A6';

type Tab = 'all' | 'assigned';
type Status = 'pending' | 'in_progress' | 'completed';

const STATUS_META: Record<Status, { label: string; c: string; soft: string }> = {
  pending:     { label: 'Chưa làm',   c: '#0F766E', soft: '#CCFBF1' },
  in_progress: { label: 'Đang làm',   c: '#B45309', soft: '#FEF3C7' },
  completed:   { label: 'Hoàn thành', c: '#059669', soft: '#D1FAE5' },
};

const SKILL_LABELS: Record<string, string> = {
  mixed: 'Tổng hợp', grammar: 'Ngữ pháp', vocabulary: 'Từ vựng',
  reading: 'Đọc hiểu', listening: 'Nghe', writing: 'Viết', speaking: 'Nói',
};
function skillLabel(s?: string) {
  const k = String(s ?? '').toLowerCase();
  return SKILL_LABELS[k] ?? (s ? s[0].toUpperCase() + s.slice(1) : '');
}

interface TeensExamItem {
  key: string;
  examId: number;
  title: string;
  skill?: string;
  duration?: number;
  questions?: number;
  status: Status;
  submissionId: number | null;
  assignmentId: number | null;
  isAssigned: boolean;
  deadline?: string | null;
}

// ─── Card ──────────────────────────────────────────────────────────────────────
function ExamCard({ item, showAssignedBadge }: { item: TeensExamItem; showAssignedBadge: boolean }) {
  const meta = STATUS_META[item.status] ?? STATUS_META.pending;
  const isCompleted = item.status === 'completed';
  const inProgress = item.status === 'in_progress';

  // Đề được giao → vào "phòng chờ" qua assignmentId (teens tự skip vào làm bài).
  // Đề tự do     → làm trực tiếp bằng examId (direct=1).
  const startTo = item.isAssigned && item.assignmentId
    ? `${BASE}/phong-cho/${item.assignmentId}`
    : `${BASE}/lam-bai/${item.examId}?autostart=1&direct=1`;

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-slate-200 p-5 transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-teal-200">
      {/* Status + assigned badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
          style={{ background: meta.soft, color: meta.c }}>
          {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : inProgress ? <RotateCcw className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
          {meta.label}
        </span>
        {showAssignedBadge && item.isAssigned && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold"
            style={{ background: '#EEF2FF', color: '#4F46E5' }}>
            <Gift className="w-3.5 h-3.5" /> Cô giao
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-base font-bold text-slate-900 leading-snug line-clamp-2 min-h-[44px]">
        {item.title}
      </h3>

      {/* Meta */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 mt-2 mb-4">
        {!!item.duration && item.duration > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" /> {item.duration} phút
          </span>
        )}
        {!!item.questions && item.questions > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <ListChecks className="w-4 h-4 text-slate-400" /> {item.questions} câu
          </span>
        )}
        {item.skill && (
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-400">
            <BookOpen className="w-4 h-4" /> {skillLabel(item.skill)}
          </span>
        )}
      </div>

      {/* Action */}
      <div className="mt-auto">
        {isCompleted && item.submissionId ? (
          <Link to={`${BASE}/ket-qua/${item.submissionId}`}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors">
            <CheckCircle2 className="w-4 h-4" /> Xem kết quả
          </Link>
        ) : (
          <Link to={startTo}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white transition-transform hover:scale-[1.01] active:scale-95"
            style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})` }}>
            <Play className="w-4 h-4 fill-white" /> {inProgress ? 'Làm tiếp' : 'Bắt đầu'}
          </Link>
        )}
      </div>
    </div>
  );
}

export function TeensTests() {
  usePageTitle(PAGE_TITLES.STUDENT_TESTS);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');

  // Tab "Tất cả" — luôn lấy hết đề teens đã publish
  const { data: browseData, isLoading: browseLoading } = useQuery({
    queryKey: ['student', 'tests', 'teens-browse'],
    queryFn: () => studentApi.browseTeensExams(),
  });

  // Tab "Giáo viên giao" — chỉ đề được gán
  const { data: assignedData, isLoading: assignedLoading } = useQuery({
    queryKey: ['student', 'tests', 'teens-assigned'],
    queryFn: () => studentApi.getTests({}),
    enabled: tab === 'assigned',
  });

  const allExams: TeensExamItem[] = useMemo(() => {
    const list = (browseData as any)?.data?.data ?? [];
    return list.map((e: any) => ({
      key: `exam-${e.id}`,
      examId: e.id,
      title: e.title,
      skill: e.skill,
      duration: e.duration,
      questions: e.questions_count,
      status: (e.submission_status ?? 'pending') as Status,
      submissionId: e.submission_id ?? null,
      assignmentId: e.assignment_id ?? null,
      isAssigned: !!e.is_assigned,
      deadline: e.deadline ?? null,
    }));
  }, [browseData]);

  const assignedExams: TeensExamItem[] = useMemo(() => {
    const groups = (assignedData as any)?.data?.data;
    if (!groups) return [];
    const map = (arr: any[], s: Status) => (arr || []).map((t: any) => ({
      key: `asg-${t.assignment_id}`,
      examId: t.exam_id,
      title: t.exam_title,
      skill: t.exam_skill,
      duration: t.exam_duration,
      questions: t.total_questions,
      status: s,
      submissionId: t.submission_id ?? null,
      assignmentId: t.assignment_id ?? null,
      isAssigned: true,
      deadline: t.deadline ?? null,
    }));
    return [
      ...map(groups.in_progress, 'in_progress'),
      ...map(groups.pending, 'pending'),
      ...map(groups.completed, 'completed'),
    ];
  }, [assignedData]);

  const source = tab === 'all' ? allExams : assignedExams;
  const isLoading = tab === 'all' ? browseLoading : assignedLoading;

  const visible = useMemo(() => {
    if (!search.trim()) return source;
    const q = search.toLowerCase();
    return source.filter((t) => String(t.title ?? '').toLowerCase().includes(q));
  }, [source, search]);

  const assignedCount = allExams.filter((e) => e.isAssigned).length;
  const stats = {
    total: allExams.length,
    pending: allExams.filter((e) => e.status === 'pending').length,
    inProgress: allExams.filter((e) => e.status === 'in_progress').length,
    completed: allExams.filter((e) => e.status === 'completed').length,
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
              <p className="text-teal-200 text-xs font-bold tracking-widest uppercase mb-1">Bài tập</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">Bài tập của tôi</h1>
              <p className="text-teal-100 text-sm mt-1">Đề thầy cô đăng và giao cho bạn — chọn một bài để bắt đầu nhé!</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { label: 'Tổng bài tập', value: stats.total,      color: '#99F6E4' },
              { label: 'Chưa làm',     value: stats.pending,    color: '#FCD34D' },
              { label: 'Đang làm',     value: stats.inProgress, color: '#FDBA74' },
              { label: 'Hoàn thành',   value: stats.completed,  color: '#86EFAC' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}>
                <span className="text-xl font-extrabold tabular-nums" style={{ color: s.color }}>
                  {browseLoading ? '—' : s.value}
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
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-white border border-slate-200">
            <button onClick={() => setTab('all')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={tab === 'all'
                ? { background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})`, color: '#fff', boxShadow: `0 4px 14px ${TEAL}40` }
                : { background: 'transparent', color: '#64748B' }}>
              <Sparkles className="w-4 h-4" /> Tất cả bài tập
            </button>
            <button onClick={() => setTab('assigned')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={tab === 'assigned'
                ? { background: 'linear-gradient(135deg, #4F46E5, #6366F1)', color: '#fff', boxShadow: '0 4px 14px rgba(79,70,229,0.3)' }
                : { background: 'transparent', color: '#64748B' }}>
              <Gift className="w-4 h-4" /> Giáo viên giao
              {assignedCount > 0 && (
                <span className="text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 font-bold"
                  style={tab === 'assigned' ? { background: 'rgba(255,255,255,0.25)' } : { background: '#EEF2FF', color: '#4F46E5' }}>
                  {assignedCount}
                </span>
              )}
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Tìm bài tập…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium outline-none focus:border-teal-300 transition-colors"
              style={{ background: '#fff', border: '1px solid #E2E8F0', color: '#0F172A' }} />
          </div>
        </div>

        {/* ══ List ════════════════════════════════════════════════════════════ */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-52 rounded-2xl animate-pulse bg-white border border-slate-200" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <div className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-5"
              style={{ background: '#CCFBF1' }}>
              {tab === 'assigned'
                ? <Gift className="w-10 h-10" style={{ color: TEAL }} />
                : <AlertTriangle className="w-10 h-10" style={{ color: TEAL }} />}
            </div>
            <h3 className="text-lg font-extrabold text-slate-800">
              {search ? 'Không tìm thấy bài nào' : tab === 'assigned' ? 'Chưa có bài cô giao riêng' : 'Chưa có bài tập nào'}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {search ? 'Thử từ khóa khác nhé!' : tab === 'assigned'
                ? 'Khi thầy cô giao bài riêng, bài sẽ hiện ở đây.'
                : 'Thầy cô chưa đăng bài tập nào. Hãy quay lại sau nhé!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
            {visible.map((t) => (
              <ExamCard key={t.key} item={t} showAssignedBadge={tab === 'all'} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

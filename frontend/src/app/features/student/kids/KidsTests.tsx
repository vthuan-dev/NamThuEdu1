/**
 * KidsTests — Trang "Bài thi của em" cho trẻ 6-12 (Cambridge YL)
 *
 * 2 chế độ xem (tab):
 *  1. "Tất cả bài thi"  → browseKidsExams: LUÔN lấy hết đề Cambridge YL đã publish.
 *                         Đề được giao có gắn nhãn "Cô giao"; đề tự do thì làm trực tiếp.
 *  2. "Cô giao cho em"  → getTests: chỉ các đề thầy cô giao (assignment) + trạng thái.
 *
 * Style: tươi sáng, bo tròn lớn, emoji, 1 điểm nhấn rose/cam — đúng tinh thần kids.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Clock, ListChecks, Search, CheckCircle2, Play, RotateCcw, Sparkles, Gift, BookOpenCheck,
  CalendarClock, Repeat2, AlertTriangle, Headphones, BookOpen, PenLine, Mic, Shuffle, ArrowRight,
} from 'lucide-react';
import { studentApi } from '../../../../services/studentApi';
import { usePageTitle, PAGE_TITLES } from '../../../../hooks/usePageTitle';

const BASE = '/hoc-vien';

type Tab = 'all' | 'assigned';
type Status = 'pending' | 'in_progress' | 'completed';

const STATUS_META: Record<Status, { label: string; c: string; soft: string }> = {
  pending:     { label: 'Chưa làm',   c: '#E11D48', soft: '#FFE4E6' },
  in_progress: { label: 'Đang làm',   c: '#B45309', soft: '#FEF3C7' },
  completed:   { label: 'Hoàn thành', c: '#059669', soft: '#D1FAE5' },
};

// ─── Khu luyện tập (gộp từ trang Luyện tập cũ) ───────────────────────────────
// Hiển thị NGAY DƯỚI danh sách bài thi để học viên không phải chuyển tab.
const PRACTICE_SKILLS = [
  { key: 'nghe', Icon: Headphones, label: 'Nghe', desc: 'Nghe và làm theo hướng dẫn.', link: `${BASE}/ky-nang/listening`, bg: 'linear-gradient(135deg, #FFF0F0, #FECDD3)', icon: '#E11D48', shadow: '0 8px 20px rgba(225,29,72,0.18)', emoji: '👂' },
  { key: 'đọc',  Icon: BookOpen,   label: 'Đọc',  desc: 'Đọc chuyện ngắn, hình ảnh vui.', link: `${BASE}/ky-nang/reading`,   bg: 'linear-gradient(135deg, #EFF6FF, #BFDBFE)', icon: '#2563EB', shadow: '0 8px 20px rgba(37,99,235,0.18)', emoji: '📖' },
  { key: 'viết', Icon: PenLine,    label: 'Viết', desc: 'Viết câu đơn giản, đúng chính tả.', link: `${BASE}/ky-nang/writing`, bg: 'linear-gradient(135deg, #F0FFF4, #BBF7D0)', icon: '#059669', shadow: '0 8px 20px rgba(5,150,105,0.18)', emoji: '✏️' },
  { key: 'nói',  Icon: Mic,        label: 'Nói',  desc: 'Nói theo mẫu, phát âm chuẩn.', link: `${BASE}/ky-nang/speaking`,  bg: 'linear-gradient(135deg, #FEFCE8, #FEF08A)', icon: '#B45309', shadow: '0 8px 20px rgba(180,83,9,0.15)', emoji: '🎤' },
] as const;

const PRACTICE_MODES = [
  { Icon: Shuffle,   label: 'Luyện ngẫu nhiên',    desc: '10 câu tổng hợp nhiều chủ đề', link: `${BASE}/luyen-tap/random?count=10`, bg: 'linear-gradient(135deg,#FFF1F2,#FFE4E6)', icon: '#E11D48' },
  { Icon: RotateCcw, label: 'Ôn lại bài sai',      desc: 'Làm lại câu em đã sai gần đây', link: `${BASE}/luyen-tap/mistakes`,         bg: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)', icon: '#2563EB' },
  { Icon: Sparkles,  label: 'Khám phá chủ đề mới', desc: 'Học từ vựng theo chủ đề mới',   link: `${BASE}/luyen-tap/new`,              bg: 'linear-gradient(135deg,#F0FFF4,#DCFCE7)', icon: '#059669' },
] as const;

// Khối luyện tập tự do — đặt dưới danh sách bài thi.
function KidsPracticeBlock() {
  return (
    <section className="mt-2 rounded-3xl p-5 sm:p-6"
      style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(251,113,133,0.10), 0 2px 8px rgba(0,0,0,0.04)', border: '2px solid rgba(255,255,255,0.9)' }}>
      {/* Tiêu đề khu luyện tập */}
      <header className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md"
          style={{ background: 'linear-gradient(135deg, #34D399, #10B981)' }}>
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 leading-tight">Luyện tập tự do 🎲</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Học một chút mỗi ngày — không tính điểm, thoải mái thử sức!</p>
        </div>
      </header>

      {/* 4 kỹ năng */}
      <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-2">💪 4 Kỹ năng</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {PRACTICE_SKILLS.map(s => (
          <Link key={s.label} to={s.link}
            className="group rounded-2xl p-4 transition-all duration-200 hover:-translate-y-1 active:scale-[0.97]"
            style={{ background: s.bg, boxShadow: s.shadow, border: '2px solid rgba(255,255,255,0.85)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/40 backdrop-blur-sm">
                <s.Icon className="w-5 h-5" style={{ color: s.icon }} />
              </div>
              <span className="text-xl">{s.emoji}</span>
            </div>
            <h3 className="text-sm font-extrabold mb-1" style={{ color: s.icon }}>{s.label}</h3>
            <p className="text-xs font-medium mb-3 leading-relaxed line-clamp-2" style={{ color: s.icon, opacity: 0.7 }}>{s.desc}</p>
            <div className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-white/50" style={{ color: s.icon }}>
              Bắt đầu <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>

      {/* 3 cách luyện */}
      <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-2">🎯 Cách luyện</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PRACTICE_MODES.map(m => (
          <Link key={m.label} to={m.link}
            className="group flex items-start gap-3 rounded-2xl p-4 transition-all duration-200 hover:-translate-y-1 active:scale-[0.97]"
            style={{ background: m.bg, boxShadow: `0 6px 18px ${m.icon}22`, border: '2px solid rgba(255,255,255,0.85)' }}>
            <div className="w-10 h-10 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <m.Icon className="w-5 h-5" style={{ color: m.icon }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold" style={{ color: m.icon }}>{m.label}</p>
              <p className="text-xs font-medium mt-0.5 leading-snug" style={{ color: m.icon, opacity: 0.75 }}>{m.desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 flex-shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" style={{ color: m.icon, opacity: 0.7 }} />
          </Link>
        ))}
      </div>
    </section>
  );
}

// Định dạng hạn nộp ngắn gọn, thân thiện với trẻ: "20/12 lúc 17:00".
function formatKidsDeadline(d: string): string {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} lúc ${hh}:${mi}`;
}

// Card chung cho cả 2 tab. Điều hướng phụ thuộc trạng thái + đề có được giao hay không.
function ExamCard({
  title, skill, scope, partNumber, duration, questions, status, submissionId, assignmentId, examId,
  isAssigned, showAssignedBadge, deadline, attemptsUsed, attemptsAllowed, submittedAt,
}: {
  title: string; skill?: string; scope?: string; partNumber?: number | null; duration?: number; questions?: number;
  status: Status; submissionId: number | null; assignmentId: number | null;
  examId: number; isAssigned: boolean; showAssignedBadge: boolean; deadline?: string | null;
  attemptsUsed?: number | null; attemptsAllowed?: number | null;
  submittedAt?: string | null;
}) {
  // Hết hạn = đề được giao có deadline đã qua. Khi đó "hạ cấp" về đề tự do:
  // bỏ ràng buộc assignment, chỉ còn 1 nút "Làm bài" (làm mới qua đường direct).
  const isExpired = !!deadline && isAssigned && new Date(deadline).getTime() < Date.now();
  const effectiveAssigned = isAssigned && !isExpired;

  // Đề tự luyện tự do (isAssigned === false) đã làm xong hơn 1 ngày (24 giờ) → reset về chưa làm
  const isFreePracticeAndOld = !isAssigned && status === 'completed' && submittedAt && (
    Date.now() - new Date(submittedAt).getTime() > 24 * 60 * 60 * 1000
  );

  // Chỉ reset trạng thái về 'pending' (Chưa làm) nếu là đề tự luyện tự do quá 24h.
  // Đề giáo viên giao thì giữ nguyên trạng thái gốc của học viên, kể cả khi hết hạn!
  const effectiveStatus = isFreePracticeAndOld ? 'pending' : status;

  const meta = STATUS_META[effectiveStatus] ?? STATUS_META.pending;
  const normalizedScope = String(scope || (skill === 'mixed' ? 'full' : 'skill')).toLowerCase();
  const scopeLabel = normalizedScope === 'full' ? 'Full test' : normalizedScope === 'part' ? `Part ${partNumber ?? ''}`.trim() : 'Skill';

  // Điều kiện để hiện Kết quả / Làm lại:
  // - Trạng thái gốc phải là completed
  // - Chưa quá 24h đối với đề tự luyện tự do
  // - Chưa hết hạn nộp đối với đề giáo viên giao
  const isCompleted = status === 'completed' && !isFreePracticeAndOld && !isExpired;
  const inProgress = status === 'in_progress' && !isExpired;

  // Số lần làm của bài giáo viên giao. allowed <= 0 (hoặc null) = không giới hạn.
  const used = attemptsUsed ?? 0;
  const allowed = attemptsAllowed ?? 0;
  const hasAttemptsLeft = allowed <= 0 || used < allowed;

  // Link "Bắt đầu / Tiếp tục":
  //  - được giao & còn hạn → vào phòng chờ qua assignmentId (tôn trọng giới hạn lượt)
  //  - tự do / hết hạn      → làm trực tiếp bằng examId (direct=1)
  const startTo = effectiveAssigned && assignmentId
    ? `${BASE}/phong-cho/${assignmentId}`
    : `${BASE}/lam-bai/${examId}?autostart=1&direct=1`;

  // "Làm lại":
  //  - đề được giao & còn hạn → đi qua phòng chờ (đếm vào số lần làm của bài giao)
  //  - đề tự do                → direct, làm mới thoải mái
  const redoTo = effectiveAssigned && assignmentId
    ? `${BASE}/phong-cho/${assignmentId}`
    : `${BASE}/lam-bai/${examId}?autostart=1&direct=1`;

  return (
    <div className="flex flex-col bg-white rounded-3xl border-2 border-rose-100 p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 hover:border-rose-200">
      {/* Status + skill */}
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
          style={{ background: meta.soft, color: meta.c }}>
          {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : inProgress ? <RotateCcw className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
          {meta.label}
        </span>
        {showAssignedBadge && effectiveAssigned && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold"
            style={{ background: '#EDE9FE', color: '#7C3AED' }}>
            <Gift className="w-3.5 h-3.5" /> Giáo viên giao
          </span>
        )}
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold"
          style={{ background: '#FFF7ED', color: '#C2410C' }}>
          {scopeLabel}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-base font-extrabold text-slate-900 leading-snug line-clamp-2 min-h-[44px]">
        {title}
      </h3>

      {/* Meta */}
      <div className="flex items-center gap-4 text-sm text-slate-500 mt-2 mb-3">
        {!!duration && duration > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" /> {duration} phút
          </span>
        )}
        {!!questions && questions > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <ListChecks className="w-4 h-4 text-slate-400" /> {questions} câu
          </span>
        )}
        {skill && (
          <span className="capitalize text-slate-400 font-semibold">{skill}</span>
        )}
      </div>

      {/* Thông tin bài giáo viên giao: hạn nộp + số lần làm — hiện rõ cho học viên */}
      {effectiveAssigned && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {deadline && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
              <CalendarClock className="w-3.5 h-3.5" /> Hạn: {formatKidsDeadline(deadline)}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold"
            style={{ background: '#F5F3FF', color: '#7C3AED' }}>
            <Repeat2 className="w-3.5 h-3.5" />
            {allowed > 0 ? `${used}/${allowed} lần` : `Đã làm ${used} lần`}
          </span>
          {allowed > 0 && !hasAttemptsLeft && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: '#FEF2F2', color: '#DC2626' }}>
              <AlertTriangle className="w-3.5 h-3.5" /> Hết lượt
            </span>
          )}
        </div>
      )}

      {/* Action */}
      <div className="mt-auto">
        {isCompleted && submissionId ? (
          <div className="flex items-center gap-2">
            <Link to={`${BASE}/ket-qua/${submissionId}`}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-sm font-extrabold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors">
              <CheckCircle2 className="w-4 h-4" /> Kết quả 🌟
            </Link>
            {/* Làm lại: đề tự do luôn cho phép; đề giao chỉ khi còn lượt */}
            {(!effectiveAssigned || hasAttemptsLeft) && (
              <Link to={redoTo}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-sm font-extrabold text-white transition-transform hover:scale-[1.02] active:scale-95"
                style={{ background: 'linear-gradient(135deg, #FB7185 0%, #F97316 100%)' }}>
                <RotateCcw className="w-4 h-4" /> Làm lại 🔄
              </Link>
            )}
          </div>
        ) : (
          <Link to={startTo}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-extrabold text-white transition-transform hover:scale-[1.02] active:scale-95"
            style={{ background: 'linear-gradient(135deg, #FB7185 0%, #F97316 100%)' }}>
            <Play className="w-4 h-4 fill-white" /> {inProgress ? 'Làm tiếp 💪' : 'Bắt đầu 🚀'}
          </Link>
        )}
      </div>
    </div>
  );
}

export function KidsTests() {
  usePageTitle(PAGE_TITLES.STUDENT_TESTS);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');

  // Tab "Tất cả" — luôn lấy hết đề kids
  const { data: browseData, isLoading: browseLoading } = useQuery({
    queryKey: ['student', 'tests', 'kids-browse'],
    queryFn: () => studentApi.browseKidsExams(),
  });

  // Tab "Cô giao" — chỉ đề được gán
  const { data: assignedData, isLoading: assignedLoading } = useQuery({
    queryKey: ['student', 'tests', 'kids-assigned'],
    queryFn: () => studentApi.getTests({}),
    enabled: tab === 'assigned',
  });

  const isPastDeadline = useCallback((d: string | null | undefined) => {
    if (!d) return false;
    return new Date(d) < new Date();
  }, []);

  const allExams = useMemo(() => {
    const list = (browseData as any)?.data?.data ?? [];
    const mapped = list.map((e: any) => ({
      key: `exam-${e.id}`,
      examId: e.id,
      title: e.title,
      skill: e.skill,
      scope: e.scope,
      partNumber: e.part_number ?? null,
      duration: e.duration,
      questions: e.questions_count,
      status: (e.submission_status ?? 'pending') as Status,
      submissionId: e.submission_id ?? null,
      assignmentId: e.assignment_id ?? null,
      isAssigned: !!e.is_assigned,
      deadline: e.deadline ?? null,
      attemptsUsed: e.attempts_used ?? null,
      attemptsAllowed: e.attempts_allowed ?? null,
      submittedAt: e.submitted_at ?? null,
    }));

    // Bài giáo viên giao ĐÃ làm xong (còn hạn) → quản lý ở tab "Giáo viên giao",
    // không hiện lại ở tab "Tất cả" nữa. Bài giao quá hạn coi như đề tự do (giữ lại).
    const filtered = mapped.filter((e: any) => {
      const expired = isPastDeadline(e.deadline);
      const assignedActive = e.isAssigned && !expired;
      return !(assignedActive && e.status === 'completed');
    });

    // Đẩy bài giáo viên giao (còn hạn, chưa xong) lên ĐẦU để học viên dễ thấy.
    const priority = (e: any) => (e.isAssigned && !isPastDeadline(e.deadline) ? 0 : 1);
    return filtered.sort((a: any, b: any) => priority(a) - priority(b));
  }, [browseData, isPastDeadline]);

  const assignedExams = useMemo(() => {
    const groups = (assignedData as any)?.data?.data;
    if (!groups) return [];
    const isAdult = (title: string) => {
      const s = String(title ?? '').toLowerCase();
      return s.includes('vstep') || s.includes('ielts') || s.includes('toeic');
    };
    const map = (arr: any[], s: Status) => (arr || []).map((t: any) => ({
      key: `asg-${t.assignment_id}`,
      examId: t.exam_id,
      title: t.exam_title,
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
      attemptsUsed: t.attempts_used ?? null,
      attemptsAllowed: t.attempts_allowed ?? null,
      submittedAt: t.submitted_at ?? null,
    }));
    return [
      ...map(groups.pending, 'pending'),
      ...map(groups.in_progress, 'in_progress'),
      ...map(groups.completed, 'completed'),
    ].filter((t: any) => !isAdult(t.title) && !isPastDeadline(t.deadline));
  }, [assignedData, isPastDeadline]);

  const source = tab === 'all' ? allExams : assignedExams;
  const isLoading = tab === 'all' ? browseLoading : assignedLoading;

  const visible = useMemo(() => {
    if (!search.trim()) return source;
    const q = search.toLowerCase();
    return source.filter((t: any) => String(t.title ?? '').toLowerCase().includes(q));
  }, [source, search]);

  // ─── Phân trang: 12 bài / trang ───────────────────────────────────────────
  const PAGE_SIZE = 12;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [tab, search]);
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = useMemo(
    () => visible.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE),
    [visible, pageSafe]
  );

  const assignedCount = useMemo(() => {
    const groups = (assignedData as any)?.data?.data;
    if (!groups) return 0;
    return [
      ...(groups.pending || []),
      ...(groups.in_progress || []),
      ...(groups.completed || []),
    ].filter((t: any) => !isPastDeadline(t.deadline)).length;
  }, [assignedData, isPastDeadline]);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #FFF1F2 0%, #FFF7ED 45%, #F0FDF4 100%)' }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-10 space-y-5">

        {/* ─── Header (tiêu đề + thanh tìm kiếm) ──────────────── */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md"
              style={{ background: 'linear-gradient(135deg, #FB7185, #F97316)' }}>
              <BookOpenCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">Bài thi của bạn 🎒</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Chọn một bài thi và bắt đầu khám phá nhé!</p>
            </div>
          </div>

          {/* 🔎 Thanh tìm kiếm "kẹo ngọt" — gradient icon pill + glow khi focus */}
          <div className="relative w-full sm:w-72 lg:w-80 group">
            {/* Vầng sáng nhẹ phía sau khi focus */}
            <div
              className="absolute inset-0 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none -z-0"
              style={{
                background: 'linear-gradient(135deg, rgba(251,113,133,0.18), rgba(249,115,22,0.18))',
                filter: 'blur(14px)',
              }}
            />
            {/* Icon pill */}
            <div
              className="absolute left-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center pointer-events-none transition-transform group-focus-within:scale-105"
              style={{
                background: 'linear-gradient(135deg, #FB7185, #F97316)',
                boxShadow: '0 4px 10px rgba(251,113,133,0.35)',
              }}
            >
              <Search className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <input
              type="text"
              placeholder="Tìm bài thi…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="relative w-full pl-12 pr-4 py-3 rounded-2xl text-sm font-semibold outline-none transition-all focus:ring-4"
              style={{
                background: '#fff',
                border: '2px solid #FFE4E6',
                color: '#1E293B',
                boxShadow: '0 4px 16px rgba(251,113,133,0.08)',
                ['--tw-ring-color' as any]: 'rgba(251,113,133,0.18)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#FB7185';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(251,113,133,0.18)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#FFE4E6';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(251,113,133,0.08)';
              }}
            />
          </div>
        </header>

        {/* ─── Tabs ────────────────────────────────────────────── */}
        <div className="flex items-center">
          <div className="flex items-center gap-2 p-1 rounded-2xl bg-white/70 border-2 border-rose-100">
            <button
              onClick={() => setTab('all')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold transition-all"
              style={tab === 'all'
                ? { background: 'linear-gradient(135deg, #FB7185, #F97316)', color: '#fff', boxShadow: '0 6px 16px rgba(251,113,133,0.35)' }
                : { background: 'transparent', color: '#64748B' }}
            >
              <Sparkles className="w-4 h-4" /> Tất cả bài thi
            </button>
            <button
              onClick={() => setTab('assigned')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold transition-all"
              style={tab === 'assigned'
                ? { background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', color: '#fff', boxShadow: '0 6px 16px rgba(139,92,246,0.35)' }
                : { background: 'transparent', color: '#64748B' }}
            >
              <Gift className="w-4 h-4" /> Giáo viên giao
              {assignedCount > 0 && (
                <span className="text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 font-bold"
                  style={tab === 'assigned' ? { background: 'rgba(255,255,255,0.25)' } : { background: '#EDE9FE', color: '#7C3AED' }}>
                  {assignedCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ─── List ────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 rounded-3xl animate-pulse bg-white border-2 border-rose-100" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border-2 border-rose-100">
            <div className="mx-auto mb-4 flex items-center justify-center" style={{ animation: 'kidsEmptyFloat 3s ease-in-out infinite' }}>
              <style>{`@keyframes kidsEmptyFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
              <svg width="160" height="150" viewBox="0 0 160 150" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Chưa có bài thi">
                {/* nền tròn mềm */}
                <circle cx="80" cy="78" r="60" fill="#FFF1F2" />
                <circle cx="80" cy="78" r="60" fill="url(#kidsGlow)" fillOpacity="0.5" />
                {/* tia nắng */}
                <g stroke="#FCD34D" strokeWidth="4" strokeLinecap="round">
                  <line x1="80" y1="6" x2="80" y2="16" />
                  <line x1="132" y1="20" x2="125" y2="28" />
                  <line x1="28" y1="20" x2="35" y2="28" />
                </g>
                {/* ngôi sao */}
                <path d="M34 96l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#FB7185" />
                <path d="M128 60l2.5 5 5.5.8-4 4 .9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-4 5.5-.8z" fill="#34D399" />
                {/* thùng sách (thân nhân vật) */}
                <rect x="46" y="62" width="68" height="50" rx="14" fill="url(#kidsBox)" />
                <rect x="46" y="62" width="68" height="50" rx="14" stroke="#fff" strokeWidth="3" />
                {/* nắp mở */}
                <path d="M44 64c0-7 6-12 13-12h46c7 0 13 5 13 12l-6 4H50z" fill="#FDBA74" />
                {/* mắt + má + miệng cười */}
                <circle cx="68" cy="86" r="4.5" fill="#7C2D12" />
                <circle cx="92" cy="86" r="4.5" fill="#7C2D12" />
                <circle cx="60" cy="94" r="3.5" fill="#FDA4AF" fillOpacity="0.8" />
                <circle cx="100" cy="94" r="3.5" fill="#FDA4AF" fillOpacity="0.8" />
                <path d="M72 96c3 4 13 4 16 0" stroke="#7C2D12" strokeWidth="3" strokeLinecap="round" fill="none" />
                <defs>
                  <linearGradient id="kidsBox" x1="46" y1="62" x2="114" y2="112" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FB923C" />
                    <stop offset="1" stopColor="#F97316" />
                  </linearGradient>
                  <radialGradient id="kidsGlow" cx="0" cy="0" r="1" gradientTransform="translate(80 78) rotate(90) scale(60)" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FED7AA" />
                    <stop offset="1" stopColor="#FED7AA" stopOpacity="0" />
                  </radialGradient>
                </defs>
              </svg>
            </div>
            <h3 className="text-lg font-extrabold text-slate-800">
              {search ? 'Không tìm thấy bài nào' : tab === 'assigned' ? 'Chưa có bài cô giao' : 'Chưa có bài thi nào'}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {search ? 'Thử từ khóa khác nhé!' : tab === 'assigned'
                ? 'Khi thầy cô giao bài, bài sẽ hiện ở đây nhé!'
                : 'Hãy quay lại sau nhé!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paged.map((t: any) => (
              <ExamCard
                key={t.key}
                title={t.title}
                skill={t.skill}
                scope={t.scope}
                partNumber={t.partNumber}
                duration={t.duration}
                questions={t.questions}
                status={t.status}
                submissionId={t.submissionId}
                assignmentId={t.assignmentId}
                examId={t.examId}
                isAssigned={t.isAssigned}
                showAssignedBadge={tab === 'all'}
                deadline={t.deadline}
                attemptsUsed={t.attemptsUsed}
                attemptsAllowed={t.attemptsAllowed}
                submittedAt={t.submittedAt}
              />
            ))}
          </div>
        )}

        {/* ─── Phân trang ──────────────────────────────────────── */}
        {!isLoading && visible.length > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pageSafe <= 1}
              className="px-4 py-2.5 rounded-full text-sm font-extrabold text-slate-600 bg-white border-2 border-rose-100 hover:border-rose-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              ← Trước
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className="min-w-[42px] h-[42px] rounded-full text-sm font-extrabold transition-transform active:scale-95"
                style={p === pageSafe
                  ? { background: 'linear-gradient(135deg, #FB7185, #F97316)', color: '#fff', boxShadow: '0 4px 12px rgba(251,113,133,0.35)' }
                  : { background: '#fff', border: '2px solid #FFE4E6', color: '#475569' }}>
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={pageSafe >= totalPages}
              className="px-4 py-2.5 rounded-full text-sm font-extrabold text-slate-600 bg-white border-2 border-rose-100 hover:border-rose-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Sau →
            </button>
          </div>
        )}

        {/* ─── Khu luyện tập tự do (chỉ ở tab "Tất cả") ─────────── */}
        {tab === 'all' && !isLoading && <KidsPracticeBlock />}
      </div>
    </div>
  );
}

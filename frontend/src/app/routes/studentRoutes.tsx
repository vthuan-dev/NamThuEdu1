import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, RouteObject, useLocation, useParams, useRouteError } from 'react-router';
import { ProtectedRoute } from '../../components/auth';
import { StudentLayout } from '../layouts/StudentLayout';
import { KidsLayout } from '../layouts/KidsLayout';
import { TeensLayout } from '../layouts/TeensLayout';
import { UnderConstruction } from '../components/shared';
import { StudentProtectedRoute } from './StudentProtectedRoute';
import { refreshAuthUserFromServer } from '../../utils/authStorage';
import { WaitingForClass } from '../features/student/WaitingForClass';

// ─── Age Group Dashboards ─────────────────────────────────────────────────────
const KidsDashboard = lazy(() =>
  import('../features/student/kids/KidsDashboard').then(m => ({ default: m.KidsDashboard })));
const KidsPractice = lazy(() =>
  import('../features/student/kids/KidsPractice').then(m => ({ default: m.KidsPractice })));
const KidsExamLobby = lazy(() =>
  import('../features/student/kids/KidsExamLobby').then(m => ({ default: m.KidsExamLobby })));
const KidsTestTaking = lazy(() =>
  import('../features/student/kids/KidsTestTaking').then(m => ({ default: m.KidsTestTaking })));
const KidsResult = lazy(() =>
  import('../features/student/kids/KidsResult').then(m => ({ default: m.KidsResult })));
const KidsSettings = lazy(() =>
  import('../features/student/kids/KidsSettings').then(m => ({ default: m.KidsSettings })));
const KidsTests = lazy(() =>
  import('../features/student/kids/KidsTests').then(m => ({ default: m.KidsTests })));
const KidsHistory = lazy(() =>
  import('../features/student/kids/KidsHistory').then(m => ({ default: m.KidsHistory })));
const KidsAnswerReview = lazy(() =>
  import('../features/student/kids/KidsAnswerReview').then(m => ({ default: m.KidsAnswerReview })));
const TeensDashboard = lazy(() =>
  import('../features/student/teens/TeensDashboard').then(m => ({ default: m.TeensDashboard })));
const TeensTestTaking = lazy(() =>
  import('../features/student/teens/TeensTestTaking').then(m => ({ default: m.TeensTestTaking })));
const TeensTests = lazy(() =>
  import('../features/student/teens/TeensTests').then(m => ({ default: m.TeensTests })));
const TeensHistory = lazy(() =>
  import('../features/student/teens/TeensHistory').then(m => ({ default: m.TeensHistory })));
const AdultsDashboard = lazy(() =>
  import('../features/student/adults/AdultsDashboard').then(m => ({ default: m.AdultsDashboard })));

// ─── Existing pages ───────────────────────────────────────────────────────────
const TestList = lazy(() =>
  import('../features/student/tests/TestList').then(m => ({ default: m.TestList })));
const PracticeList = lazy(() =>
  import('../features/student/practice/PracticeList').then(m => ({ default: m.PracticeList })));
const PracticeSession = lazy(() =>
  import('../features/student/practice/PracticeSession').then(m => ({ default: m.PracticeSession })));
const NotificationList = lazy(() =>
  import('../features/student/notifications/NotificationList').then(m => ({ default: m.NotificationList })));
const StudentLeaderboard = lazy(() =>
  import('../features/student/dashboard/StudentLeaderboard').then(m => ({ default: m.StudentLeaderboard })));
const StudentRewards = lazy(() =>
  import('../features/student/dashboard/StudentRewards').then(m => ({ default: m.StudentRewards })));
const StudentSchedule = lazy(() =>
  import('../features/student/dashboard/StudentSchedule').then(m => ({ default: m.StudentSchedule })));

const StudentExamBrowser = lazy(() =>
  import('../features/student/exams/StudentExamBrowser').then(m => ({ default: m.StudentExamBrowser })));
const StudentVstepExamPage = lazy(() =>
  import('../features/student/exams/StudentVstepExamPage').then(m => ({ default: m.StudentVstepExamPage })));
const VstepResultPage = lazy(() =>
  import('../features/student/exams/VstepResultPage').then(m => ({ default: m.VstepResultPage })));
const StudentIeltsExamPage = lazy(() =>
  import('../features/student/exams/ielts/StudentIeltsExamPage').then(m => ({ default: m.StudentIeltsExamPage })));
const StudentIeltsExamDetail = lazy(() =>
  import('../features/student/exams/ielts/StudentIeltsExamDetail').then(m => ({ default: m.StudentIeltsExamDetail })));

// THPT pages
const StudentThptExamPage = lazy(() =>
  import('../features/student/exams/thpt/StudentThptExamPage').then(m => ({ default: m.StudentThptExamPage })));
const ThptResultPage = lazy(() =>
  import('../features/student/exams/thpt/ThptResultPage').then(m => ({ default: m.ThptResultPage })));

// ─── New pages (gap-filled) ───────────────────────────────────────────────────
const TestTaking = lazy(() =>
  import('../features/student/test-taking/TestTaking').then(m => ({ default: m.TestTaking })));
const ExamLobby = lazy(() =>
  import('../features/student/test-taking/ExamLobby').then(m => ({ default: m.ExamLobby })));
const ResultDetail = lazy(() =>
  import('../features/student/test-taking/ResultDetail').then(m => ({ default: m.ResultDetail })));
const AnswerReview = lazy(() =>
  import('../features/student/test-taking/AnswerReview').then(m => ({ default: m.AnswerReview })));
const TestHistory = lazy(() =>
  import('../features/student/tests/TestHistory').then(m => ({ default: m.TestHistory })));
const Progress = lazy(() =>
  import('../features/student/dashboard/Progress').then(m => ({ default: m.Progress })));
const Profile = lazy(() =>
  import('../features/student/dashboard/Profile').then(m => ({ default: m.Profile })));
const Settings = lazy(() =>
  import('../features/student/settings').then(m => ({ default: m.Settings })));

// ─── Loading fallback ─────────────────────────────────────────────────────────
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div
      className="w-10 h-10 border-4 rounded-full animate-spin"
      style={{ borderColor: '#EDE9FE', borderTopColor: '#7C3AED' }}
    />
  </div>
);

// ─── Route error boundary ──────────────────────────────────────────────────────
// Bắt lỗi "Failed to fetch dynamically imported module" — xảy ra khi deploy mới
// đổi hash file chunk mà trình duyệt còn giữ index.html cũ. Tự reload 1 lần để
// nạp lại index mới; nếu vẫn lỗi thì hiện UI thân thiện thay vì màn hình trắng.
function RouteErrorBoundary() {
  const error = useRouteError() as any;
  const msg = String(error?.message ?? error ?? '');
  const isChunkError = /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError|error loading dynamically/i.test(msg);

  useEffect(() => {
    if (isChunkError && !sessionStorage.getItem('chunk_reload_attempted')) {
      sessionStorage.setItem('chunk_reload_attempted', '1');
      window.location.reload();
    }
  }, [isChunkError]);

  if (isChunkError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-6">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto">
            <div className="w-6 h-6 border-3 rounded-full animate-spin" style={{ borderColor: '#CCFBF1', borderTopColor: '#0D9488' }} />
          </div>
          <p className="text-base font-semibold text-slate-700">Đang cập nhật phiên bản mới…</p>
          <button
            onClick={() => { sessionStorage.removeItem('chunk_reload_attempted'); window.location.reload(); }}
            className="px-5 py-2.5 rounded-xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#0D9488,#14B8A6)' }}
          >
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <div className="text-center space-y-3">
        <p className="text-base font-semibold text-slate-700">Đã có lỗi xảy ra khi tải trang.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 rounded-xl font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#0D9488,#14B8A6)' }}
        >
          Tải lại trang
        </button>
      </div>
    </div>
  );
}

function LegacyStudentRedirect() {
  const location = useLocation();
  const target = `${location.pathname.replace(/^\/hoc-sinh/, '/hoc-vien')}${location.search}${location.hash}`;
  return <Navigate to={target} replace />;
}

/**
 * Render dashboard phù hợp theo age_group của học viên hiện tại.
 * Kids → redirect sang URL kids riêng (vì layout khác hoàn toàn).
 * Teens / Adults → render dashboard tương ứng dưới StudentLayout chung.
 * Mặc định / chưa phân nhóm → StudentDashboard cũ.
 */
// Đọc age_group từ session đăng nhập — CẦN đọc cả localStorage (remember=true)
// LẪN sessionStorage (remember=false). Nếu chỉ đọc localStorage, học viên không
// tích "ghi nhớ" sẽ bị mất age_group → rơi vào dashboard mặc định (sai nhóm tuổi).
function getSessionAgeGroup(): string | undefined {
  const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
  try { return raw ? (JSON.parse(raw) as { age_group?: string }).age_group : undefined; } catch { return undefined; }
}

function AdaptiveDashboard() {
  const ageGroup = getSessionAgeGroup();

  if (ageGroup === 'kids') {
    return <Suspense fallback={<LoadingFallback />}><KidsDashboard /></Suspense>;
  }
  if (ageGroup === 'teens') {
    return <Suspense fallback={<LoadingFallback />}><TeensDashboard /></Suspense>;
  }
  return <Suspense fallback={<LoadingFallback />}><AdultsDashboard /></Suspense>;
}

// Kids xem KidsPractice; còn lại xem PracticeList chung.
function AdaptivePractice() {
  const ageGroup = getSessionAgeGroup();
  if (ageGroup === 'kids') {
    return <Suspense fallback={<LoadingFallback />}><KidsPractice /></Suspense>;
  }
  return <Suspense fallback={<LoadingFallback />}><PracticeList /></Suspense>;
}

function isKidsUser() {
  const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
  try { return raw ? JSON.parse(raw)?.age_group === 'kids' : false; } catch { return false; }
}

function isTeensUser() {
  const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
  try { return raw ? JSON.parse(raw)?.age_group === 'teens' : false; } catch { return false; }
}

// Phòng chờ: kids dùng bản đơn giản (không proctoring); teens BỎ phòng chờ
// (không proctoring camera/mic) → vào thẳng trang làm bài; còn lại dùng ExamLobby.
function TeensLobbySkip() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/hoc-vien/lam-bai/${id}?autostart=1`} replace />;
}

function AdaptiveExamLobby() {
  if (isTeensUser()) return <TeensLobbySkip />;
  return (
    <Suspense fallback={<LoadingFallback />}>
      {isKidsUser() ? <KidsExamLobby /> : <ExamLobby />}
    </Suspense>
  );
}

// Làm bài: kids dùng bản 1 câu/màn hình, teens dùng engine đa dạng dạng câu, còn lại dùng engine VSTEP chung.
function AdaptiveTestTaking() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      {isKidsUser() ? <KidsTestTaking /> : isTeensUser() ? <TeensTestTaking /> : <TestTaking />}
    </Suspense>
  );
}

// Xem điểm: kids dùng bản vui vẻ, còn lại dùng ResultDetail chung.
function AdaptiveResult() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      {isKidsUser() ? <KidsResult /> : <ResultDetail />}
    </Suspense>
  );
}

// Cài đặt: kids dùng bản thân thiện, còn lại dùng Settings chung.
function AdaptiveSettings() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      {isKidsUser() ? <KidsSettings /> : <Settings />}
    </Suspense>
  );
}

// Bài thi được giao: kids dùng bản sạch/nhẹ, teens dùng bản browse + giao, còn lại dùng TestList chung.
function AdaptiveTests() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      {isKidsUser() ? <KidsTests /> : isTeensUser() ? <TeensTests /> : <TestList />}
    </Suspense>
  );
}

// Lịch sử làm bài: kids dùng bản sạch/nhẹ, còn lại dùng TestHistory chung.
function AdaptiveHistory() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      {isKidsUser() ? <KidsHistory /> : isTeensUser() ? <TeensHistory /> : <TestHistory />}
    </Suspense>
  );
}

// Xem lại đáp án: kids dùng bản thân thiện hiển thị từng ô con, còn lại dùng AnswerReview chung.
function AdaptiveAnswerReview() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      {isKidsUser() ? <KidsAnswerReview /> : <AnswerReview />}
    </Suspense>
  );
}

// Redirect /hoc-vien/teens/* → /hoc-vien/*
function TeensRedirect() {
  const location = useLocation();
  const newPath = location.pathname.replace(/^\/hoc-vien\/teens/, '/hoc-vien');
  return <Navigate to={newPath + location.search} replace />;
}

// Redirect /hoc-vien/kids/* → /hoc-vien/* (giữ bookmark cũ)
function KidsRedirect() {
  const location = useLocation();
  const newPath = location.pathname.replace(/^\/hoc-vien\/kids/, '/hoc-vien');
  return <Navigate to={newPath + location.search} replace />;
}

// Auto-detect layout from age_group — ưu tiên dữ liệu THẬT từ server.
// Khi vào khu vực học viên, gọi /user/profile để đồng bộ age_group/role mới nhất
// từ DB rồi mới render (localStorage chỉ là cache tạm tránh nhấp nháy).
function AdaptiveStudentLayout() {
  const [, bump] = useState(0);
  useEffect(() => {
    refreshAuthUserFromServer().then((u) => { if (u) bump((v) => v + 1); });
  }, []);

  const ageGroup = getSessionAgeGroup();
  if (ageGroup === 'kids') return <KidsLayout />;
  if (ageGroup === 'teens') return <TeensLayout />;
  return <StudentLayout />;
}

// Protected Student Layout
function ProtectedStudentLayout() {
  return (
    <ProtectedRoute requiredRole="student">
      <AdaptiveStudentLayout />
    </ProtectedRoute>
  );
}


// Protected Adults Layout (uses shared StudentLayout)
function ProtectedAdultsLayout() {
  return (
    <ProtectedRoute requiredRole="student">
      <StudentProtectedRoute ageGroup="adults">
        <StudentLayout />
      </StudentProtectedRoute>
    </ProtectedRoute>
  );
}

// ─── Routes ───────────────────────────────────────────────────────────────────
export const studentRoutes: RouteObject = {
  path: '/hoc-vien',
  element: <ProtectedStudentLayout />,
  errorElement: <RouteErrorBoundary />,
  children: [
    {
      index: true,
      element: <AdaptiveDashboard />,
    },
    // Adult/professional endpoints (alias dưới /hoc-vien)
    {
      path: 'khoa-hoc',
      element: <Suspense fallback={<LoadingFallback />}><TestList /></Suspense>,
    },
    {
      path: 'thong-ke',
      element: <Suspense fallback={<LoadingFallback />}><Progress /></Suspense>,
    },
    {
      path: 'muc-tieu',
      element: <Suspense fallback={<LoadingFallback />}><UnderConstruction /></Suspense>,
    },
    {
      path: 'chung-chi',
      element: <Suspense fallback={<LoadingFallback />}><UnderConstruction /></Suspense>,
    },
    {
      path: 'cho-xep-lop',
      element: <WaitingForClass />,
    },
    // Exam routes
    {
      path: 'de-thi',
      element: <Suspense fallback={<LoadingFallback />}><StudentExamBrowser /></Suspense>,
    },
    // Legacy routes (shared functionality)
    {
      path: 'bai-tap',
      element: <AdaptiveTests />,
    },
    {
      path: 'luyen-tap',
      element: <AdaptivePractice />,
    },
    {
      path: 'luyen-tap/:id',
      element: <Suspense fallback={<LoadingFallback />}><PracticeSession /></Suspense>,
    },
    {
      path: 'luyen-tap/random',
      element: <Suspense fallback={<LoadingFallback />}><PracticeSession /></Suspense>,
    },
    {
      path: 'luyen-tap/mistakes',
      element: <Suspense fallback={<LoadingFallback />}><PracticeSession /></Suspense>,
    },
    {
      path: 'luyen-tap/new',
      element: <Suspense fallback={<LoadingFallback />}><PracticeSession /></Suspense>,
    },
    {
      path: 'luyen-tap/custom',
      element: <Suspense fallback={<LoadingFallback />}><PracticeSession /></Suspense>,
    },
    {
      path: 'phong-cho/:id',
      element: <AdaptiveExamLobby />,
    },
    {
      path: 'lam-bai/:id',
      element: <AdaptiveTestTaking />,
    },
    {
      path: 'lam-bai-vstep/:examId',
      element: <Suspense fallback={<LoadingFallback />}><StudentVstepExamPage /></Suspense>,
    },
    // ─── IELTS exam routes (full test + per-skill) ─────────────────────
    {
      path: 'de-thi/ielts/:examId',
      element: <Suspense fallback={<LoadingFallback />}><StudentIeltsExamDetail /></Suspense>,
    },
    {
      path: 'lam-bai-ielts/:examId',
      element: <Suspense fallback={<LoadingFallback />}><StudentIeltsExamPage fullTest /></Suspense>,
    },
    {
      path: 'lam-bai-ielts/:examId/listening',
      element: <Suspense fallback={<LoadingFallback />}><StudentIeltsExamPage skill="listening" /></Suspense>,
    },
    {
      path: 'lam-bai-ielts/:examId/reading',
      element: <Suspense fallback={<LoadingFallback />}><StudentIeltsExamPage skill="reading" /></Suspense>,
    },
    {
      path: 'lam-bai-ielts/:examId/writing',
      element: <Suspense fallback={<LoadingFallback />}><StudentIeltsExamPage skill="writing" /></Suspense>,
    },
    {
      path: 'lam-bai-ielts/:examId/speaking',
      element: <Suspense fallback={<LoadingFallback />}><StudentIeltsExamPage skill="speaking" /></Suspense>,
    },
    // ─── THPT exam routes ──────────────────────────────────────────────
    {
      path: 'lam-bai-thpt/:examId',
      element: <Suspense fallback={<LoadingFallback />}><StudentThptExamPage /></Suspense>,
    },
    {
      path: 'ket-qua-thpt/:submissionId',
      element: <Suspense fallback={<LoadingFallback />}><ThptResultPage /></Suspense>,
    },
    {
      path: 'ket-qua/:id',
      element: <AdaptiveResult />,
    },
    {
      path: 'ket-qua-vstep/:id',
      element: <Suspense fallback={<LoadingFallback />}><VstepResultPage /></Suspense>,
    },
    {
      path: 'dap-an/:id',
      element: <AdaptiveAnswerReview />,
    },
    {
      path: 'lich-su',
      element: <AdaptiveHistory />,
    },
    {
      path: 'tien-do',
      element: <Suspense fallback={<LoadingFallback />}><Progress /></Suspense>,
    },
    {
      path: 'ho-so',
      element: <Suspense fallback={<LoadingFallback />}><Profile /></Suspense>,
    },
    {
      path: 'cai-dat',
      element: <AdaptiveSettings />,
    },
    {
      path: 'bang-xep-hang',
      element: <Suspense fallback={<LoadingFallback />}><StudentLeaderboard /></Suspense>,
    },
    {
      path: 'phan-thuong',
      element: <Suspense fallback={<LoadingFallback />}><StudentRewards /></Suspense>,
    },
    {
      path: 'lich-hoc',
      element: <Suspense fallback={<LoadingFallback />}><StudentSchedule /></Suspense>,
    },
    {
      path: 'thong-bao',
      element: <Suspense fallback={<LoadingFallback />}><NotificationList /></Suspense>,
    },
    {
      path: '*',
      Component: UnderConstruction,
    },
  ],
};

// ─── KIDS ROUTES — redirect /hoc-vien/kids/* → /hoc-vien/* ────────────────────
// Kids giờ dùng chung namespace /hoc-vien (auth tự nhận age_group để render
// KidsLayout + KidsDashboard). Giữ block này để redirect bookmark cũ.
export const kidsRoutes: RouteObject = {
  path: '/hoc-vien/kids',
  children: [
    { index: true, element: <Navigate to="/hoc-vien" replace /> },
    { path: '*',   element: <KidsRedirect /> },
  ],
};

// ─── TEENS ROUTES — redirect /hoc-vien/teens/* → /hoc-vien/* ──────────────────────
export const teensRoutes: RouteObject = {
  path: '/hoc-vien/teens',
  children: [
    { index: true, element: <Navigate to="/hoc-vien" replace /> },
    { path: '*',   element: <TeensRedirect /> },
  ],
};

// ─── ADULTS ROUTES (18+ tuổi) ─────────────────────────────────────────────────
export const adultsRoutes: RouteObject = {
  path: '/hoc-vien/adults',
  element: <ProtectedAdultsLayout />,
  children: [
    {
      index: true,
      element: <Suspense fallback={<LoadingFallback />}><AdultsDashboard /></Suspense>,
    },
    {
      path: 'courses',
      element: <Suspense fallback={<LoadingFallback />}><TestList /></Suspense>,
    },
    {
      path: 'de-thi',
      element: <Suspense fallback={<LoadingFallback />}><StudentExamBrowser /></Suspense>,
    },
    {
      path: 'analytics',
      element: <Suspense fallback={<LoadingFallback />}><Progress /></Suspense>,
    },
    {
      path: 'goals',
      element: <Suspense fallback={<LoadingFallback />}><UnderConstruction /></Suspense>,
    },
    {
      path: 'certifications',
      element: <Suspense fallback={<LoadingFallback />}><UnderConstruction /></Suspense>,
    },
    {
      path: 'schedule',
      element: <Suspense fallback={<LoadingFallback />}><StudentSchedule /></Suspense>,
    },
    {
      path: 'settings',
      element: <Suspense fallback={<LoadingFallback />}><Settings /></Suspense>,
    },
    {
      path: '*',
      element: <Navigate to="/hoc-vien/adults" replace />,
    },
  ],
};

export const studentLegacyRoutes: RouteObject = {
  path: '/hoc-sinh/*',
  element: <LegacyStudentRedirect />,
};

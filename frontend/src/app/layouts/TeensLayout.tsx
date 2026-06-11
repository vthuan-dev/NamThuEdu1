import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { usePushNotification } from '../../hooks/usePushNotification';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { NotificationPermissionBanner } from '../../components/NotificationPermissionBanner';
import { PwaInstallBanner } from '../../components/PwaInstallBanner';
import { ResultDetail } from '../features/student/test-taking/ResultDetail';
import { studentApi } from '../../services/studentApi';
import { logout } from '../../services/authApi';
import { LogoutOverlay } from '../../components/shared/LogoutOverlay';
import {
  Home, BookOpen, TrendingUp,
  LogOut, Menu, X, Bell, Clock, User, ChevronDown,
} from 'lucide-react';

// ─── Teens theme tokens (Teal/Cyan — distinct from Adults' purple) ───────────
const TEAL = '#0D9488';
const TEAL_MID = '#14B8A6';

type NavItem = { icon: any; label: string; path: string; badge?: number };

const NavLink = ({
  icon: Icon, label, isActive, onClick, badge,
}: {
  icon: any; label: string; isActive: boolean; onClick: () => void; badge?: number;
}) => (
  <button
    onClick={onClick}
    className={`
      group relative flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium
      transition-all duration-200 ease-out whitespace-nowrap
      ${isActive
        ? 'text-teal-700 bg-white shadow-sm ring-1 ring-slate-200'
        : 'text-slate-600 hover:text-teal-700 hover:bg-white/70 hover:-translate-y-0.5'}
    `}
  >
    <Icon
      className={`w-[17px] h-[17px] flex-shrink-0 transition-all duration-200 ease-out
        ${isActive ? 'text-teal-700' : 'text-slate-400 group-hover:text-teal-600 group-hover:scale-110 group-hover:-rotate-6'}`}
    />
    <span>{label}</span>
    {badge && badge > 0 && (
      <span className="ml-0.5 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
    {/* Hover underline indicator */}
    {!isActive && (
      <span className="pointer-events-none absolute left-3 right-3 bottom-1 h-[2px] rounded-full bg-teal-500 origin-left scale-x-0 transition-transform duration-200 ease-out group-hover:scale-x-100" />
    )}
  </button>
);

const MobileNavLink = ({
  icon: Icon, label, isActive, onClick, badge,
}: {
  icon: any; label: string; isActive: boolean; onClick: () => void; badge?: number;
}) => (
  <button
    onClick={onClick}
    className={`
      relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13px] font-medium
      transition-colors duration-150
      ${isActive
        ? 'text-teal-700 bg-teal-50'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}
    `}
  >
    <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-teal-700' : 'text-slate-400'}`} />
    <span className="flex-1 text-left">{label}</span>
    {badge && badge > 0 && (
      <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </button>
);

export function TeensLayout() {
  const push = usePushNotification();
  const pwa = usePwaInstall();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);  const profileRef = useRef<HTMLDivElement>(null);
  const [activeSubmissionId, setActiveSubmissionId] = useState<number | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Basic user info from localStorage (for name, role — always available synchronously)
  const localUserStr = localStorage.getItem('user');
  const localUser = localUserStr ? JSON.parse(localUserStr) : null;

  // Fetch profile from API to get avatar_url directly from DB (single source of truth)
  const { data: profileData } = useQuery({
    queryKey: ['student', 'profile'],
    queryFn: () => studentApi.getProfile(),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
  const profileFromApi: any = (profileData as any)?.data?.data ?? (profileData as any)?.data ?? null;

  // Merge: API profile overwrites localStorage for avatar/name
  const user = profileFromApi || localUser;
  const initial = (user?.uName || 'B')[0]?.toUpperCase() || 'B';
  const avatarUrl: string | null = profileFromApi?.avatar_url || localUser?.avatar_url || localUser?.avatar || null;

  useEffect(() => {
    setActiveSubmissionId(null);
  }, [location.pathname, location.search]);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    if (!profileOpen) return;
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [profileOpen]);

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const subId = (e as CustomEvent).detail?.submissionId;
      if (subId) setActiveSubmissionId(subId);
    };
    const handleClose = () => setActiveSubmissionId(null);
    window.addEventListener('open-result-modal', handleOpen);
    window.addEventListener('close-result-modal', handleClose);
    return () => {
      window.removeEventListener('open-result-modal', handleOpen);
      window.removeEventListener('close-result-modal', handleClose);
    };
  }, []);

  useEffect(() => {
    if (!activeSubmissionId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setActiveSubmissionId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeSubmissionId]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setMenuOpen(false);
    setProfileOpen(false);
    try {
      await logout();
    } finally {
      setTimeout(() => navigate('/dang-nhap', { replace: true }), 900);
    }
  };

  const navItems: NavItem[] = [
    { icon: Home,       label: 'Trang chủ',    path: '/hoc-vien' },
    { icon: BookOpen,   label: 'Bài tập',       path: '/hoc-vien/bai-tap' },
    { icon: Clock,      label: 'Lịch sử thi',   path: '/hoc-vien/lich-su' },
    { icon: TrendingUp, label: 'Tiến độ',        path: '/hoc-vien/tien-do' },
  ];

  const systemItems: NavItem[] = [
    { icon: User, label: 'Hồ sơ', path: '/hoc-vien/ho-so' },
  ];

  const isActive = (path: string) =>
    path === '/hoc-vien'
      ? location.pathname === '/hoc-vien'
      : location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(160deg, #F0FDFA 0%, #ECFEFF 40%, #F8FAFC 100%)' }}
    >
      <LogoutOverlay show={loggingOut} />
      <NotificationPermissionBanner push={push} />
      <PwaInstallBanner pwa={pwa} />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Brand */}
            <button
              onClick={() => navigate('/hoc-vien')}
              className="flex items-center gap-3 flex-shrink-0 group cursor-pointer select-none"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center relative overflow-hidden transition-all duration-300 ease-out group-hover:scale-105 group-hover:shadow-[0_0_15px_rgba(13,148,136,0.35)]"
                style={{
                  background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})`,
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                }}
              >
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out"
                  style={{ pointerEvents: 'none' }}
                />
                <BookOpen className="w-[18px] h-[18px] text-white transition-transform duration-500 ease-out group-hover:rotate-[-6deg] group-hover:scale-110" />
              </div>
              <div className="hidden sm:flex flex-col justify-center leading-none text-left">
                <span
                  className="transition-colors duration-300 ease-out group-hover:text-teal-700"
                  style={{ fontSize: 17, fontWeight: 900, color: '#0F2A28', letterSpacing: '-0.025em' }}
                >
                  NamThu<span style={{ color: TEAL, textShadow: '0 0 10px rgba(13,148,136,0.12)' }}>Edu</span>
                </span>
                <span
                  className="tracking-widest uppercase transition-colors duration-300 ease-out group-hover:text-teal-600"
                  style={{ fontSize: 8.5, color: '#8B95A5', fontWeight: 700, marginTop: 2.5, letterSpacing: '0.08em' }}
                >
                  Học viên
                </span>
              </div>
            </button>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1 p-1 rounded-2xl border border-slate-200 bg-slate-50/80">
              {navItems.map(item => (
                <NavLink
                  key={item.path}
                  icon={item.icon}
                  label={item.label}
                  isActive={isActive(item.path)}
                  onClick={() => navigate(item.path)}
                  badge={item.badge}
                />
              ))}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Notification (moved slightly left with margin) */}
              <button
                onClick={() => navigate('/hoc-vien/thong-bao')}
                className="hidden sm:flex items-center justify-center w-9 h-9 mr-1 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-slate-100 transition-colors"
                aria-label="Thông báo"
              >
                <Bell className="w-[18px] h-[18px]" />
              </button>

              {/* Profile dropdown */}
              <div
                className="relative"
                ref={profileRef}
                onMouseEnter={() => setProfileOpen(true)}
                onMouseLeave={() => setProfileOpen(false)}
              >
                <button
                  onClick={() => setProfileOpen(o => !o)}
                  className="flex items-center gap-1.5 flex-shrink-0 rounded-full p-0.5 pr-1.5 hover:bg-slate-100 transition-colors"
                  aria-label="Tài khoản"
                  aria-expanded={profileOpen}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={user?.uName || 'Avatar'} className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200" />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ring-1 ring-slate-200"
                      style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})` }}
                    >
                      {initial}
                    </div>
                  )}
                  <ChevronDown className={`hidden sm:block w-4 h-4 text-slate-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown menu */}
                {profileOpen && (
                  <div className="absolute right-0 top-full pt-2 w-56 z-50">
                    <div
                      className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden"
                      style={{ animation: 'profileDropIn 0.16s ease-out forwards' }}
                    >
                    <style>{`
                      @keyframes profileDropIn {
                        from { opacity: 0; transform: translateY(-6px) scale(0.98); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                      }
                    `}</style>

                    {/* User info header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={user?.uName || 'Avatar'} className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200" />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ring-1 ring-slate-200"
                          style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})` }}
                        >
                          {initial}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-900 truncate">{user?.uName || 'Học viên'}</p>
                        <p className="text-[11px] text-slate-400">Học viên · Teens</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="p-1.5">
                      <button
                        onClick={() => { setProfileOpen(false); navigate('/hoc-vien/ho-so'); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium text-slate-700 hover:bg-slate-100 hover:text-teal-700 transition-colors"
                      >
                        <User className="w-[18px] h-[18px] text-slate-400" />
                        <span>Hồ sơ của tôi</span>
                      </button>
                      <button
                        onClick={() => { setProfileOpen(false); handleLogout(); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      >
                        <LogOut className="w-[18px] h-[18px] text-slate-400" />
                        <span>Đăng xuất</span>
                      </button>
                    </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Toggle menu"
              >
                {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-3 py-4 space-y-0.5 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400 font-semibold px-3 mb-2">
              Học tập
            </p>
            {navItems.map(item => (
              <MobileNavLink
                key={item.path}
                icon={item.icon}
                label={item.label}
                isActive={isActive(item.path)}
                onClick={() => { navigate(item.path); setMenuOpen(false); }}
                badge={item.badge}
              />
            ))}

            <div className="my-3 mx-3 h-px bg-slate-100" />

            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400 font-semibold px-3 mb-2">
              Hệ thống
            </p>
            {systemItems.map(item => (
              <MobileNavLink
                key={item.path}
                icon={item.icon}
                label={item.label}
                isActive={isActive(item.path)}
                onClick={() => { navigate(item.path); setMenuOpen(false); }}
              />
            ))}

            <div className="my-3 mx-3 h-px bg-slate-100" />

            <MobileNavLink
              icon={LogOut}
              label="Đăng xuất"
              isActive={false}
              onClick={handleLogout}
            />
          </div>
        )}
      </header>

      {/* Overlay for mobile menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 top-16 bg-slate-900/30 z-30 lg:hidden backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0" style={{ paddingBottom: '80px' }}>
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-8">
          <Outlet />
        </div>
      </main>

      {/* Result Detail Modal */}
      {activeSubmissionId !== null && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setActiveSubmissionId(null)}
        >
          <style>{`
            @keyframes scaleUpTeens {
              from { opacity: 0; transform: scale(0.96); }
              to { opacity: 1; transform: scale(1); }
            }
          `}</style>
          <div
            className="relative bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200/50 p-6 md:p-8"
            onClick={e => e.stopPropagation()}
            style={{ animation: 'scaleUpTeens 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
          >
            <button
              onClick={() => setActiveSubmissionId(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all z-10 cursor-pointer"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="pt-2">
              <ResultDetail modalSubmissionId={activeSubmissionId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

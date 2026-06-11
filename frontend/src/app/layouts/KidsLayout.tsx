/**
 * Kids Layout - Giao diện dành cho trẻ em (6-12 tuổi)
 *
 * Đặc điểm:
 * - Thanh điều hướng NGANG ở trên cùng (sticky), dùng chung desktop + mobile
 * - Header trắng glassmorphism làm khung trung tính cho nội dung nhiều màu
 * - Màu sắc tươi sáng, active state dạng pill rose-cam
 * - Navigation đơn giản, an toàn cho trẻ em
 */

import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { usePushNotification } from '../../hooks/usePushNotification';
import { NotificationPermissionBanner } from '../../components/NotificationPermissionBanner';
import {
  Home,
  ClipboardList,
  Sparkles,
  History,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { NotificationDropdown } from '../components/student/NotificationDropdown';
import { LogoutOverlay } from '../../components/shared/LogoutOverlay';
import { logout } from '../../services/authApi';
import { getAuthUser } from '../../utils/authStorage';

type NavItem = { icon: any; label: string; path: string };

export function KidsLayout() {
  const push = usePushNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const readUser = () => getAuthUser();

  const [user, setUser] = useState<any>(readUser);

  // Đồng bộ avatar khi học viên đổi ảnh (AccountInfoCard phát sự kiện này).
  useEffect(() => {
    const sync = () => setUser(readUser());
    window.addEventListener('user-profile-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('user-profile-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const avatarUrl: string | null = user?.avatar_url || user?.avatar || null;

  // Tên hiển thị — dữ liệu đăng nhập dùng key khác nhau tùy nguồn, nên dò nhiều khả năng.
  const displayName: string =
    user?.uName || user?.name || user?.full_name || user?.fullName || 'Bạn';

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setMenuOpen(false);
    try {
      await logout();
    } finally {
      // Cho animation chạy trọn vẹn rồi mới chuyển trang
      setTimeout(() => navigate('/dang-nhap', { replace: true }), 900);
    }
  };

  const navItems: NavItem[] = [
    { icon: Home,          label: 'Trang chủ',  path: '/hoc-vien' },
    { icon: ClipboardList, label: 'Bài thi',    path: '/hoc-vien/bai-tap' },
    { icon: Sparkles,      label: 'Luyện tập',  path: '/hoc-vien/luyen-tap' },
    { icon: History,       label: 'Lịch sử',    path: '/hoc-vien/lich-su' },
    { icon: Settings,      label: 'Cài đặt',    path: '/hoc-vien/cai-dat' },
  ];

  const initial = (user?.uName || 'B')[0]?.toUpperCase() || 'B';

  // Trang chủ khớp chính xác; các mục khác giữ active khi vào trang con.
  const isActive = (path: string) =>
    path === '/hoc-vien'
      ? location.pathname === path
      : location.pathname.startsWith(path);

  const go = (path: string) => {
    navigate(path);
    setMenuOpen(false);
  };

  return (
    <div className="kids-scope min-h-screen" style={{ background: 'linear-gradient(160deg, #FFF1F2 0%, #FFF7ED 50%, #F0FDF4 100%)' }}>
      <LogoutOverlay show={loggingOut} />
      <NotificationPermissionBanner push={push} />

      {/* ─── Top Header (sticky, ngang) ──────────────────────────────── */}
      <header
        className="sticky top-0 z-40"
        style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1.5px solid #FFE4E6',
          boxShadow: '0 4px 20px rgba(251,113,133,0.08)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-4">

            {/* Brand / User — bấm để về Trang chủ */}
            <button
              onClick={() => go('/hoc-vien')}
              className="flex items-center gap-3 min-w-0 group"
              aria-label="Về trang chủ"
            >
              <div
                className="relative w-10 h-10 rounded-2xl text-white flex items-center justify-center text-lg font-extrabold flex-shrink-0 overflow-hidden transition-transform group-hover:scale-105 group-active:scale-95"
                style={{ background: 'linear-gradient(135deg, #FB7185 0%, #F97316 100%)', boxShadow: '0 4px 12px rgba(251,113,133,0.35)' }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={user?.uName || 'Avatar'} className="w-full h-full object-cover" />
                ) : (
                  initial
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
              </div>
              <div className="min-w-0 text-left hidden sm:block">
                <p className="text-[11px] font-semibold text-slate-400 leading-tight">Xin chào,</p>
                <p className="text-[15px] font-extrabold text-rose-500 truncate leading-tight">{displayName}</p>
              </div>
            </button>

            {/* Nav pills ngang — desktop */}
            <nav className="hidden lg:flex items-center gap-1.5 flex-1 justify-center">
              {navItems.map(item => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => go(item.path)}
                    className={`
                      inline-flex items-center gap-2 px-4 py-2 rounded-full text-[14px] font-bold
                      transition-all duration-150 active:scale-[0.97]
                      ${active
                        ? 'bg-rose-500 text-white'
                        : 'text-slate-600 hover:bg-rose-50 hover:text-rose-700'}
                    `}
                    style={active ? { boxShadow: '0 4px 12px rgba(244,63,94,0.30)' } : undefined}
                  >
                    <item.icon className="w-[17px] h-[17px] flex-shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Phải: Chuông thông báo + Logout (desktop) + Hamburger (mobile) */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Chuông thông báo — để trẻ nhận báo khi giáo viên chấm xong */}
              <NotificationDropdown />

              <button
                onClick={handleLogout}
                className="hidden lg:inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-[14px] font-bold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-[17px] h-[17px]" />
                <span>Đăng xuất</span>
              </button>

              <button
                onClick={() => setMenuOpen(v => !v)}
                className="lg:hidden p-2.5 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
                aria-label="Mở menu"
                aria-expanded={menuOpen}
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown nav */}
        {menuOpen && (
          <div className="lg:hidden border-t border-rose-100" style={{ background: 'rgba(255,255,255,0.96)' }}>
            <nav className="max-w-6xl mx-auto px-4 py-3 space-y-1">
              {navItems.map(item => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => go(item.path)}
                    className={`
                      w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[15px] font-bold
                      transition-all duration-150 active:scale-[0.98]
                      ${active
                        ? 'bg-rose-500 text-white'
                        : 'text-slate-600 hover:bg-rose-50 hover:text-rose-700'}
                    `}
                    style={active ? { boxShadow: '0 4px 12px rgba(244,63,94,0.30)' } : undefined}
                  >
                    <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[15px] font-bold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-[18px] h-[18px] text-slate-400" />
                <span>Đăng xuất</span>
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* ─── Main Content (full width) ───────────────────────────────── */}
      <main className="min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
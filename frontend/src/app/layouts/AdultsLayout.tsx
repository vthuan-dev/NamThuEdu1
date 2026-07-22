/**
 * Adults Layout — Sidebar dành cho người đi làm (18+)
 *
 * Nguyên tắc UI/UX:
 *  - Restrained accent: cam chỉ dùng cho active indicator (thanh trái + soft bg + text)
 *  - Hierarchy rõ: brand → sections (Khám phá / Phát triển / Hệ thống) → user card pinned bottom
 *  - Nhóm nav theo nhóm chức năng, có label uppercase tracking-wider
 *  - Active state: 3px accent left border + bg-orange-50/80 + text-orange-700
 *  - Hover state: bg-slate-50 (không giật mắt)
 *  - User card pinned bottom với avatar, role/class chip, và logout icon-only
 *  - Mobile: drawer trượt, backdrop có blur nhẹ
 *  - Body cuộn an toàn (overflow-y-auto), pinned card không bị che
 */

import { useState } from 'react';
import { Outlet, useNavigate, useLocation, NavLink } from 'react-router';
import { usePushNotification } from '../../hooks/usePushNotification';
import { NotificationPermissionBanner } from '../../components/NotificationPermissionBanner';
import { logout } from '../../services/authApi';
import { getAuthUser } from '../../utils/authStorage';
import { getFullMediaUrl } from '../../utils/mediaUtils';
import { LogoutOverlay } from '../../components/shared/LogoutOverlay';
import { ExamReminderPopup } from '../../components/student/ExamReminderPopup';
import { DailyMotivationPopup } from '../../components/student/DailyMotivationPopup';
import {
  Home,
  BookOpen,
  BarChart3,
  Target,
  Calendar,
  Settings,
  LogOut,
  Menu,
  X,
  Award,
  GraduationCap,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type NavItem = {
  icon: typeof Home;
  label: string;
  path: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Khám phá',
    items: [
      { icon: Home,      label: 'Trang chủ',  path: '/hoc-vien/adults' },
      { icon: BookOpen,  label: 'Khóa học',   path: '/hoc-vien/adults/courses' },
      { icon: BarChart3, label: 'Thống kê',   path: '/hoc-vien/adults/analytics' },
      { icon: Target,    label: 'Mục tiêu',   path: '/hoc-vien/adults/goals' },
    ],
  },
  {
    title: 'Phát triển',
    items: [
      { icon: Award,    label: 'Chứng chỉ', path: '/hoc-vien/adults/certifications' },
      { icon: Calendar, label: 'Lịch học',  path: '/hoc-vien/adults/schedule' },
    ],
  },
  {
    title: 'Hệ thống',
    items: [
      { icon: Settings, label: 'Cài đặt', path: '/hoc-vien/adults/settings' },
    ],
  },
];

// ─── Sidebar item ─────────────────────────────────────────────────────────────

function SidebarItem({
  item,
  isActive,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      className={`
        relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
        transition-colors duration-150 outline-none
        focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-1
        ${isActive
          ? 'bg-orange-50/80 text-orange-700'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
      `}
      aria-current={isActive ? 'page' : undefined}
    >
      {/* Active indicator bar */}
      <span
        aria-hidden
        className={`
          absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-orange-500
          transition-opacity duration-150
          ${isActive ? 'opacity-100' : 'opacity-0'}
        `}
      />
      <Icon
        className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${
          isActive ? 'text-orange-600' : 'text-slate-400 group-hover:text-slate-600'
        }`}
        strokeWidth={isActive ? 2.25 : 2}
      />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function AdultsLayout() {
  const push = usePushNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const user = getAuthUser() as {
    uName?: string;
    class?: { cName?: string; name?: string } | null;
    avatar_url?: string | null;
    avatar?: string | null;
  } | null;

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setSidebarOpen(false);
    try {
      await logout();
    } finally {
      setTimeout(() => navigate('/dang-nhap', { replace: true }), 900);
    }
  };

  const closeMobileSidebar = () => setSidebarOpen(false);

  const initial = (user?.uName || 'H')[0]?.toUpperCase() || 'H';
  const className = user?.class?.cName || user?.class?.name || 'Lớp Adults';
  const avatarUrl: string | null = getFullMediaUrl(user?.avatar_url || user?.avatar || null);

  return (
    <div className="min-h-screen bg-slate-50">
      <LogoutOverlay show={loggingOut} />
      <NotificationPermissionBanner push={push} />
      {/* ─── Mobile Top Bar ──────────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-sm">
              <GraduationCap className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-bold text-slate-900 tracking-tight">NamThu Edu</span>
          </div>
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="w-9 h-9 rounded-lg text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors flex items-center justify-center"
            aria-label={sidebarOpen ? 'Đóng menu' : 'Mở menu'}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <div className="flex">
        {/* ─── Sidebar ─────────────────────────────────────────── */}
        <aside
          className={`
            fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50
            w-72 lg:w-64 h-screen
            bg-white border-r border-slate-200
            flex flex-col
            transform transition-transform duration-300 ease-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          {/* Brand header */}
          <div className="px-5 h-16 flex items-center border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-sm shadow-orange-500/20">
                <GraduationCap className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
              </div>
              <div className="leading-tight">
                <p className="text-[13px] font-bold text-slate-900 tracking-tight">NamThu Edu</p>
                <p className="text-[11px] text-slate-500">Học viên · Người đi làm</p>
              </div>
            </div>
          </div>

          {/* Nav (scrollable) */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
            {NAV_GROUPS.map(group => (
              <div key={group.title}>
                <p className="px-3 mb-1.5 text-[10.5px] font-semibold tracking-[0.08em] uppercase text-slate-400">
                  {group.title}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map(item => (
                    <li key={item.path}>
                      <SidebarItem
                        item={item}
                        isActive={location.pathname === item.path}
                        onNavigate={closeMobileSidebar}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* User card pinned bottom */}
          <div className="border-t border-slate-100 p-3 flex-shrink-0">
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors group">
              {/* Avatar */}
              <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={(user?.uName as string) || 'Avatar'} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-sm font-bold">{initial}</span>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 leading-tight">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {user?.uName || 'Học viên'}
                </p>
                <p className="text-xs text-slate-500 truncate">{className}</p>
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-8 h-8 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 active:bg-rose-100 transition-colors flex items-center justify-center flex-shrink-0"
                aria-label="Đăng xuất"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* ─── Mobile backdrop ─────────────────────────────────── */}
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Đóng menu"
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-200"
            onClick={closeMobileSidebar}
          />
        )}

        {/* ─── Main content ────────────────────────────────────── */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
      <ExamReminderPopup />
      <DailyMotivationPopup accent="#7C3AED" accentMid="#8B5CF6" accentSoft="#F5F3FF" />
    </div>
  );
}
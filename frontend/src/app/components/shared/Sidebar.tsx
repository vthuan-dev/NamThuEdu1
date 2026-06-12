import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { logout } from "../../../services/authApi";
import { api } from "../../../services/api";
import { getAuthToken, getAuthUser } from "../../../utils/authStorage";
import { getFullMediaUrl } from "../../../utils/mediaUtils";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  FileText,
  GraduationCap,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface SubMenuItem {
  name: string;
  href: string;
}

interface MenuItem {
  name: string;
  href?: string;
  icon: any;
  badge?: string | number;
  indicator?: "active" | "pending";
  submenu?: SubMenuItem[];
}

const navigationData: MenuItem[] = [
  { 
    name: "dashboard", 
    href: "/giao-vien", 
    icon: LayoutDashboard 
  },
  {
    name: "students",
    icon: Users,
    submenu: [
      { name: "manageStudents", href: "/giao-vien/students" },
      { name: "addStudent", href: "/giao-vien/students/them-moi" },
    ],
  },
  {
    name: "classes",
    href: "/giao-vien/lop-hoc",
    icon: GraduationCap,
  },
  {
    name: "examBank",
    icon: FileText,
    submenu: [
      { name: "allExams", href: "/giao-vien/de-thi" },
      { name: "createExam", href: "/giao-vien/de-thi/tao-moi" },
    ],
  },
  {
    name: "grading",
    icon: CheckCircle2,
    submenu: [
      { name: "pendingGrading", href: "/giao-vien/cham-diem" },
      { name: "gradingStats", href: "/giao-vien/cham-diem/thong-ke" },
    ],
  },
  {
    name: "blog",
    icon: FileText,
    submenu: [
      { name: "allPosts", href: "/giao-vien/bai-viet" },
      { name: "createPost", href: "/giao-vien/bai-viet/tao-moi" },
      { name: "categories", href: "/giao-vien/bai-viet/danh-muc" },
      { name: "contentStats", href: "/giao-vien/bai-viet/thong-ke" },
    ],
  },
  {
    name: "reports",
    href: "/giao-vien/bao-cao",
    icon: BarChart3,
  },
  {
    name: "settings",
    href: "/giao-vien/cai-dat",
    icon: Settings,
  },
];

export function Sidebar({ isCollapsed, onToggle }: { isCollapsed: boolean; onToggle: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [pendingGradingCount, setPendingGradingCount] = useState<number>(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPendingGrading = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const res = await api.get('/teacher/dashboard/overview');
      const count = res.data?.data?.pending_grading ?? 0;
      setPendingGradingCount(count);
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    fetchPendingGrading();
    pollingRef.current = setInterval(fetchPendingGrading, 30_000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const user = getAuthUser();
  const userName = (user?.name as string) || (user?.uName as string) || 'Teacher';
  const userPhone = (user?.phone as string) || (user?.uPhone as string) || '';
  const userEmail = `${userPhone}@namthuedu.com`;
  const userAvatar = (user?.avatar_url as string) || (user?.avatar as string) || '';
  
  // Helper function to get full avatar URL (robust: fallback từ VITE_API_URL nếu thiếu base)
  const getAvatarUrl = (avatar: string) => getFullMediaUrl(avatar) || '';
  
  // Generate initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };
  const userInitials = getInitials(userName);
  
  // State to track avatar updates - with loading state
  const [avatarLoading, setAvatarLoading] = useState(true);
  const [currentAvatar, setCurrentAvatar] = useState(getAvatarUrl(userAvatar));
  
  // Listen for storage changes to update avatar
  useEffect(() => {
    const handleStorageChange = () => {
      const updatedUser = getAuthUser();
      const newAvatar = (updatedUser?.avatar_url as string) || (updatedUser?.avatar as string) || '';
      const newAvatarUrl = getAvatarUrl(newAvatar);
      if (newAvatarUrl !== currentAvatar) {
        setAvatarLoading(true); // Reset loading state
        setCurrentAvatar(newAvatarUrl);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom event from Settings page
    window.addEventListener('avatarUpdated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('avatarUpdated', handleStorageChange);
    };
  }, [currentAvatar]);

  const handleLogout = async () => {
    await logout();
    navigate("/giao-vien/dang-nhap", { replace: true });
  };

  // Auto-expand menu if current route matches
  const getCurrentExpandedMenu = (): string | null => {
    for (const item of navigationData) {
      if (item.submenu) {
        const isOnSubmenuPage = item.submenu.some((sub) =>
          sub?.href ? location.pathname.startsWith(sub.href) : false
        );
        if (isOnSubmenuPage) {
          return item.name;
        }
      }
    }
    return null;
  };

  // Set initial expanded menu on mount or location change
  useEffect(() => {
    const currentMenu = getCurrentExpandedMenu();
    if (currentMenu && !expandedMenu) {
      setExpandedMenu(currentMenu);
    }
  }, [location]);

  const toggleMenu = (menuName: string) => {
    setExpandedMenu(expandedMenu === menuName ? null : menuName);
  };

  const isMenuActive = (item: MenuItem): boolean => {
    if (item.href && location.pathname === item.href) return true;
    if (item.submenu) {
      return item.submenu.some((sub) =>
        sub?.href ? location.pathname.startsWith(sub.href) : false
      );
    }
    return false;
  };

  const isSubmenuActive = (href: string): boolean => {
    // Only exact match - no parent matching at all
    return location.pathname === href;
  };

  const renderMenuItem = (item: MenuItem) => {
    const isActive = isMenuActive(item);
    const isExpanded = expandedMenu === item.name;
    const Icon = item.icon;
    const hasSubmenu = item.submenu && item.submenu.length > 0;

    if (hasSubmenu) {
      return (
        <div key={item.name}>
          <button
            onClick={() => toggleMenu(item.name)}
            className={`w-full flex items-center gap-2.5 rounded-xl transition-all duration-150 relative group text-sm font-medium ${
              isCollapsed ? 'px-2.5 py-2.5 justify-center' : 'px-3 py-2.5'
            } ${
              isActive
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
            }`}
            title={isCollapsed ? t(`nav.${item.name}`) : undefined}
          >
            {isActive && !isCollapsed && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-indigo-600" />
            )}
            <Icon className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && (
              <>
                <span className="flex-1 text-left">{t(`nav.${item.name}`)}</span>
                {item.indicator === "active" && (
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                )}
                {item.name === 'grading' && pendingGradingCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500 text-white animate-pulse">
                    {pendingGradingCount > 99 ? '99+' : pendingGradingCount}
                  </span>
                )}
                {item.name !== 'grading' && item.badge && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-600">
                    {item.badge}
                  </span>
                )}
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </>
            )}
            {isCollapsed && item.name === 'grading' && pendingGradingCount > 0 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold">
                {pendingGradingCount > 99 ? '9+' : pendingGradingCount}
              </div>
            )}
            {isCollapsed && item.name !== 'grading' && item.badge && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center text-white text-[9px] font-bold">
                {item.badge}
              </div>
            )}
            {isCollapsed && item.indicator === "active" && (
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full" />
            )}
          </button>

          {/* Submenu */}
          {!isCollapsed && (
            <div
              className="overflow-hidden transition-all duration-300"
              style={{
                maxHeight: isExpanded ? "400px" : "0",
                opacity: isExpanded ? 1 : 0,
              }}
            >
              <div className="ml-4 pl-3 border-l border-indigo-200 space-y-0.5 py-1">
                {item.submenu?.map((subItem) => {
                  const isSubActive = isSubmenuActive(subItem.href);
                  return (
                    <Link
                      key={subItem.name}
                      to={subItem.href}
                      className={`block px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                        isSubActive
                          ? "bg-indigo-100 text-indigo-700 font-semibold"
                          : "text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 font-medium"
                      }`}
                    >
                      {t(`nav.${subItem.name}`)}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.name}
        to={item.href!}
        className={`flex items-center gap-2.5 rounded-xl transition-all duration-150 relative text-sm font-medium ${
          isCollapsed ? 'px-2.5 py-2.5 justify-center' : 'px-3 py-2.5'
        } ${
          isActive
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
        }`}
        title={isCollapsed ? t(`nav.${item.name}`) : undefined}
      >
        {isActive && !isCollapsed && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-indigo-600" />
        )}
        <Icon className="w-4 h-4 flex-shrink-0" />
        {!isCollapsed && <span className="flex-1">{t(`nav.${item.name}`)}</span>}
      </Link>
    );
  };

  return (
    <div
      className={`h-screen flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out relative ${
        isCollapsed ? 'w-[80px]' : 'w-[260px]'
      }`}
      style={{ background: '#F5F7FF' }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4" style={{ borderBottom: '1px solid #E0E7FF' }}>
        <Link to="/giao-vien" className="flex items-center gap-2.5 overflow-hidden cursor-pointer hover:opacity-85 transition-opacity">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#4F46E5,#4338CA)' }}>
            <BookOpen className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col leading-none">
              <span className="text-slate-800 text-[15px] font-bold tracking-tight">{t("appName")}</span>
              <span className="text-indigo-400 text-[11px] font-medium mt-0.5">Teacher Portal</span>
            </div>
          )}
        </Link>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer hover:bg-indigo-100"
          title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
          type="button"
        >
          {isCollapsed
            ? <ChevronRight className="w-4 h-4 text-slate-400 pointer-events-none" />
            : <ChevronLeft className="w-4 h-4 text-slate-400 pointer-events-none" />}
        </button>
      </div>

      {/* User Profile */}
      {!isCollapsed ? (
        <div className="px-3 py-3" style={{ borderBottom: '1px solid #E0E7FF' }}>
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl cursor-default" style={{ background: '#EEF2FF' }}>
            <div className="relative w-9 h-9 flex-shrink-0">
              {currentAvatar && avatarLoading && (
                <div 
                  className="absolute inset-0 rounded-full animate-pulse border-2 border-indigo-200" 
                  style={{ background: 'linear-gradient(135deg,#E0E7FF,#C7D2FE)' }}
                />
              )}
              {currentAvatar ? (
                <img
                  src={currentAvatar}
                  alt={userName}
                  loading="eager"
                  decoding="async"
                  className="w-9 h-9 rounded-full object-cover border-2 border-indigo-200"
                  style={{ 
                    opacity: avatarLoading ? 0 : 1,
                    transition: 'opacity 150ms ease-in',
                    position: 'absolute',
                    inset: 0
                  }}
                  onLoad={() => setAvatarLoading(false)}
                  onError={() => {
                    setAvatarLoading(false);
                    setCurrentAvatar('');
                  }}
                />
              ) : (
                <div 
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-indigo-200" 
                  style={{ background: 'linear-gradient(135deg,#6366F1,#4338CA)' }}
                >
                  {userInitials}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-800 text-sm font-semibold truncate leading-tight">{userName}</p>
              <p className="text-indigo-400 text-[11px] flex items-center gap-1 mt-0.5">
                <GraduationCap className="w-3 h-3 flex-shrink-0" />
                Giáo viên
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-center py-3" style={{ borderBottom: '1px solid #E0E7FF' }}>
          <div className="relative w-9 h-9">
            {currentAvatar && avatarLoading && (
              <div 
                className="absolute inset-0 rounded-full animate-pulse border-2 border-indigo-200" 
                style={{ background: 'linear-gradient(135deg,#E0E7FF,#C7D2FE)' }}
              />
            )}
            {currentAvatar ? (
              <img
                src={currentAvatar}
                alt={userName}
                loading="eager"
                decoding="async"
                className="w-9 h-9 rounded-full object-cover border-2 border-indigo-200"
                title={userName}
                style={{ 
                  opacity: avatarLoading ? 0 : 1,
                  transition: 'opacity 150ms ease-in',
                  position: 'absolute',
                  inset: 0
                }}
                onLoad={() => setAvatarLoading(false)}
                onError={() => {
                  setAvatarLoading(false);
                  setCurrentAvatar('');
                }}
              />
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-indigo-200"
                style={{ background: 'linear-gradient(135deg,#6366F1,#4338CA)' }}
                title={userName}
              >
                {userInitials}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-5">
        <div>
          {!isCollapsed && <p className="px-2 mb-1 text-[10px] font-semibold text-indigo-400 uppercase tracking-widest">Main</p>}
          {renderMenuItem(navigationData[0])}
        </div>
        <div>
          {!isCollapsed && <p className="px-2 mb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Teaching</p>}
          <div className="space-y-0.5">
            {navigationData.slice(1, 2).map((item) => renderMenuItem(item))}
          </div>
        </div>
        <div>
          {!isCollapsed && <p className="px-2 mb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Assessment</p>}
          <div className="space-y-0.5">
            {navigationData.slice(2, 4).map((item) => renderMenuItem(item))}
          </div>
        </div>
        <div>
          {!isCollapsed && <p className="px-2 mb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Content</p>}
          <div className="space-y-0.5">
            {navigationData.slice(4, 6).map((item) => renderMenuItem(item))}
          </div>
        </div>
        <div className="h-px bg-indigo-100" />
        <div className="space-y-0.5">
          {renderMenuItem(navigationData[6])}
        </div>
      </nav>

      {/* Logout */}
      <div className="px-3 py-3" style={{ borderTop: '1px solid #E0E7FF' }}>
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title={isCollapsed ? 'Đăng xuất' : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span>Đăng xuất</span>}
        </button>
      </div>
    </div>
  );
}

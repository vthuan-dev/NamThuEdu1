import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { logout } from "../../../services/authApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { studentApi } from "../../../services/studentApi";
import {
  Home,
  ClipboardList,
  Bell,
  User,
  LogOut,
  Settings,
  Flame,
  BookOpen,
  BarChart2,
  ChevronDown,
  Zap,
  Menu,
  X,
  TrendingUp,
  History,
  Trophy,
} from "lucide-react";
import { NotificationDropdown } from "./NotificationDropdown";

// ─── Color tokens (Student = Purple) ──────────────────────────────────────────
const PURPLE = "#7C3AED";
const PURPLE_LIGHT = "#EDE9FE";
const PURPLE_MID = "#8B5CF6";
const STUDENT_BASE_PATH = "/hoc-vien";

const studentPath = (suffix = "") => `${STUDENT_BASE_PATH}${suffix}`;

// ─── Route prefetch map ────────────────────────────────────────────────────────
// Triggered on hover/focus so the lazy chunk is warmed in browser cache before
// the user actually clicks → near-instant navigation.
const prefetchMap: Record<string, () => Promise<unknown>> = {
  [studentPath("/bai-tap")]:        () => import("../../features/student/tests/TestList"),
  [studentPath("/de-thi")]:         () => import("../../features/student/exams/StudentExamBrowser"),
  [studentPath("/luyen-tap")]:      () => import("../../features/student/practice/PracticeList"),
  [studentPath("/tien-do")]:        () => import("../../features/student/dashboard/Progress"),
  [studentPath("/lich-su")]:        () => import("../../features/student/tests/TestHistory"),
  [studentPath("/bang-xep-hang")]:  () => import("../../features/student/dashboard/StudentLeaderboard"),
  [studentPath("/ho-so")]:          () => import("../../features/student/dashboard/Profile"),
  [studentPath("/cai-dat")]:        () => import("../../features/student/settings"),
};

const prefetched = new Set<string>();
const prefetchRoute = (path: string) => {
  if (prefetched.has(path)) return;
  const fn = prefetchMap[path];
  if (!fn) return;
  prefetched.add(path);
  fn().catch(() => prefetched.delete(path));
};

// ─── Data prefetch callbacks (API) ────────────────────────────────────────────
// These are invoked alongside prefetchRoute on hover to warm the React Query
// cache before the user navigates. Each function receives `queryClient`.
type QC = import("@tanstack/react-query").QueryClient;
const dataPrefetchMap: Record<string, (qc: QC) => void> = {
  [studentPath("/de-thi")]: (qc) => {
    const opts = { staleTime: 5 * 60 * 1000 };
    qc.prefetchQuery({ queryKey: ["student", "exams-browse", "ALL"],   queryFn: () => studentApi.browseExams(undefined),         ...opts });
    qc.prefetchQuery({ queryKey: ["student", "exams-browse", "VSTEP"], queryFn: () => studentApi.browseExams({ type: "VSTEP" }), ...opts });
    qc.prefetchQuery({ queryKey: ["student", "exams-browse", "IELTS"], queryFn: () => studentApi.browseExams({ type: "IELTS" }), ...opts });
  },
};

export function StudentNavbar() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [scrolled, setScrolled] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const profileHoverTimeout = useState<ReturnType<typeof setTimeout> | null>(null);

  const { data: streakData } = useQuery({
    queryKey: ["student", "streak", "navbar"],
    queryFn: () => studentApi.getStreak(),
    staleTime: 5 * 60 * 1000,
  });
  const currentStreak: number = (streakData as any)?.data?.data?.current_streak ?? 0;

  const { data: profileData } = useQuery({
    queryKey: ["student", "profile"],
    queryFn: () => studentApi.getProfile(),
    staleTime: 10 * 60 * 1000,
  });
  const profile = (profileData as any)?.data?.data ?? (profileData as any)?.data;
  const avatarUrl: string | null = profile?.avatar_url ?? null;
  const displayName: string = profile?.uName ?? '';
  const initials: string = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'H';

  const handleLogout = async () => {
    await logout();
    navigate("/dang-nhap", { replace: true });
  };

  // Scroll-aware glassmorphism
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close profile menu on outside click
  useEffect(() => {
    if (!profileMenuOpen) return;
    const close = () => setProfileMenuOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [profileMenuOpen]);

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // Idle-time prefetch — warm chunks for likely-next routes so the very first
  // navigation also feels instant (not only ones the user has hovered).
  useEffect(() => {
    const TOP_ROUTES = [
      studentPath("/bai-tap"),
      studentPath("/de-thi"),
    ];
    const ric: any = (window as any).requestIdleCallback;
    const schedule = ric
      ? (cb: () => void) => ric(cb, { timeout: 2500 })
      : (cb: () => void) => setTimeout(cb, 1500);
    const handle = schedule(() => {
      TOP_ROUTES.forEach(prefetchRoute);
      // Also warm the exam data cache during idle so first visit has data ready
      queryClient.prefetchQuery({
        queryKey: ["student", "exams-browse", "ALL"],
        queryFn: () => studentApi.browseExams(undefined),
        staleTime: 5 * 60 * 1000,
      });
    });
    return () => {
      const cic: any = (window as any).cancelIdleCallback;
      if (cic && ric) cic(handle);
      else clearTimeout(handle as any);
    };
  }, []);

  const navItems = [
    { path: studentPath(), label: t("student.nav.dashboard"), exact: true },
    { path: studentPath("/bai-tap"), label: t("student.nav.tests"), exact: false },
    { path: studentPath("/de-thi"), label: "\u0110\u1ec1 thi", exact: false },
    { path: studentPath("/lich-su"), label: t("student.nav.history"), exact: false },
  ];

  // Bottom nav items (mobile)
  const bottomNavItems = [
    { path: studentPath(), label: t("student.nav.dashboard"), icon: Home, exact: true },
    { path: studentPath("/bai-tap"), label: t("student.nav.tests"), icon: ClipboardList, exact: false },
    { path: studentPath("/de-thi"), label: "Đề thi", icon: BookOpen, exact: false },
  ];

  const isActive = (path: string, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const changeLanguage = (lng: string) => i18n.changeLanguage(lng);

  const sidebarItems = [
    { path: studentPath(),                 label: t("student.nav.dashboard"),         icon: Home,          exact: true },
    { path: studentPath("/bai-tap"),       label: t("student.nav.tests"),              icon: ClipboardList, exact: false },
    { path: studentPath("/de-thi"),        label: "Đề thi",                            icon: BookOpen,      exact: false },
    { path: studentPath("/lich-su"),       label: t("student.nav.history"),            icon: History,       exact: false },
    { path: studentPath("/bang-xep-hang"),label: "Bảng xếp hạng",                    icon: Trophy,        exact: false },
    { path: studentPath("/ho-so"),         label: t("student.nav.profile.myProfile"),  icon: User,          exact: false },
    { path: studentPath("/cai-dat"),       label: t("student.nav.profile.settings"),   icon: Settings,      exact: false },
  ];

  return (
    <>
      {/* ─── Top Navbar ─────────────────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 transition-all duration-300"
        style={{
          background: scrolled
            ? "rgba(245,243,255,0.88)"
            : "rgba(250,249,255,1)",
          backdropFilter: scrolled ? "blur(18px)" : "blur(0px)",
          WebkitBackdropFilter: scrolled ? "blur(18px)" : "blur(0px)",
          borderBottom: scrolled
            ? "1px solid rgba(124,58,237,0.18)"
            : "1px solid rgba(124,58,237,0.10)",
          boxShadow: scrolled
            ? "0 4px 32px rgba(124,58,237,0.13)"
            : "0 1px 12px rgba(124,58,237,0.07)",
        }}
      >
        {/* ── Top accent gradient ── */}
        <div
          style={{
            height: 3,
            background: `linear-gradient(90deg, ${PURPLE} 0%, #A78BFA 55%, #60A5FA 100%)`,
          }}
        />
        <div className="w-full px-5 py-2">
          <div className="flex items-center justify-between">

            {/* ── Left: Hamburger + Logo ── */}
            <div className="flex items-center gap-2">

            {/* Hamburger */}
            <button
              onClick={(e) => { e.stopPropagation(); setSidebarOpen(true); }}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-purple-50"
              aria-label="Mở menu"
            >
              <Menu className="w-5 h-5" style={{ color: PURPLE }} />
            </button>

            {/* ── Logo ── */}
            <Link
              to={studentPath()}
              className="flex items-center gap-3 group cursor-pointer select-none"
              style={{ textDecoration: "none" }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center relative overflow-hidden transition-all duration-300 ease-out group-hover:scale-105 group-hover:shadow-[0_0_15px_rgba(124,58,237,0.35)]"
                style={{
                  background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_MID})`,
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                }}
              >
                {/* Micro-shine reflection effect */}
                <div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" 
                  style={{ pointerEvents: "none" }}
                />
                
                <BookOpen className="w-[18px] h-[18px] text-white transition-transform duration-500 ease-out group-hover:rotate-[-6deg] group-hover:scale-110" />
              </div>
              <div className="flex flex-col justify-center leading-none">
                <span
                  className="transition-colors duration-300 ease-out group-hover:text-purple-700"
                  style={{
                    fontSize: 17,
                    fontWeight: 900,
                    color: "#1F1344",
                    letterSpacing: "-0.025em",
                  }}
                >
                  NamThu
                  <span 
                    className="transition-all duration-300 ease-out"
                    style={{ 
                      color: PURPLE,
                      textShadow: "0 0 10px rgba(124,58,237,0.1)",
                    }}
                  >Edu</span>
                </span>
                <span
                  className="tracking-widest uppercase transition-colors duration-300 ease-out group-hover:text-purple-500"
                  style={{ 
                    fontSize: 8.5, 
                    color: "#8B95A5", 
                    fontWeight: 700,
                    marginTop: 2.5,
                    letterSpacing: "0.08em",
                  }}
                >
                  {t("student.nav.profile.student")}
                </span>
              </div>
            </Link>
            </div>{/* end left group */}

            {/* ── Desktop Nav Links ── */}
            <div
              className="hidden md:flex items-center gap-0.5 rounded-2xl p-1"
              style={{
                background: "linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)",
                border: "1.5px solid rgba(124,58,237,0.22)",
                boxShadow: "0 4px 18px rgba(124,58,237,0.13), inset 0 1px 0 rgba(255,255,255,0.85)",
              }}
            >
              <style>{`
                .student-nav-link {
                  position: relative;
                }
                .student-nav-link:not(.active-nav)::after {
                  content: '';
                  position: absolute;
                  bottom: 4px;
                  left: 12px;
                  right: 12px;
                  height: 2px;
                  border-radius: 2px;
                  background: ${PURPLE};
                  transform: scaleX(0);
                  transform-origin: left center;
                  transition: transform 0.22s cubic-bezier(0.4,0,0.2,1);
                }
                .student-nav-link:not(.active-nav):hover::after {
                  transform: scaleX(1);
                }
                .student-nav-link:not(.active-nav):hover {
                  color: ${PURPLE} !important;
                }
              `}</style>
              {navItems.map((item) => {
                const active = isActive(item.path, item.exact);
                const handlePrefetch = () => { prefetchRoute(item.path); dataPrefetchMap[item.path]?.(queryClient); };
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onMouseEnter={handlePrefetch}
                    onFocus={handlePrefetch}
                    onTouchStart={handlePrefetch}
                    className={`student-nav-link px-4 py-1.5 transition-all duration-200 rounded-xl whitespace-nowrap${active ? " active-nav" : ""}`}
                    style={{
                      fontSize: 13,
                      fontWeight: active ? 700 : 500,
                      color: active ? "#fff" : "#6B7280",
                      background: active
                        ? `linear-gradient(135deg, ${PURPLE}, ${PURPLE_MID})`
                        : "transparent",
                      boxShadow: active ? `0 2px 10px ${PURPLE}40` : "none",
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* ── Right Section ── */}
            <div className="flex items-center gap-2">

              {/* Streak badge */}
              {currentStreak > 0 && (
                <div className="relative group hidden sm:flex">
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-default"
                    style={{
                      background: "linear-gradient(135deg, #F97316, #FBBF24)",
                      boxShadow: "0 2px 10px rgba(249,115,22,0.38)",
                    }}
                  >
                    <Flame className="w-3.5 h-3.5 text-white" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                      {currentStreak}
                    </span>
                  </div>
                  {/* Tooltip */}
                  <div
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 rounded-2xl px-3.5 py-3 text-xs pointer-events-none
                      opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-[200]"
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #FFEDD5",
                      boxShadow: "0 8px 24px rgba(249,115,22,0.12), 0 2px 8px rgba(0,0,0,0.06)",
                    }}
                  >
                    {/* Arrow up */}
                    <div
                      className="absolute bottom-full left-1/2 -translate-x-1/2"
                      style={{
                        width: 0, height: 0,
                        borderLeft: "6px solid transparent",
                        borderRight: "6px solid transparent",
                        borderBottom: "6px solid #FFEDD5",
                      }}
                    />
                    <p style={{ fontWeight: 700, color: "#EA580C", marginBottom: 4, fontSize: 12 }}>
                      🔥 Chuỗi {currentStreak} ngày liên tiếp!
                    </p>
                    <p style={{ color: "#78716C", lineHeight: 1.55, marginBottom: 8 }}>
                      Đăng nhập mỗi ngày để duy trì chuỗi. Bỏ 1 ngày là mất chuỗi và bắt đầu lại từ đầu.
                    </p>
                    <p
                      style={{
                        fontWeight: 600,
                        fontSize: 11,
                        lineHeight: 1.5,
                        padding: "6px 8px",
                        borderRadius: 8,
                        background: "linear-gradient(135deg, #FFF7ED, #FEF3C7)",
                        border: "1px solid #FDE68A",
                        color: "#92400E",
                        animation: "pulseText 2s ease-in-out infinite",
                      }}
                    >
                      ✨ Cố gắng duy trì việc học tập để đạt kết quả tốt!
                    </p>
                    <style>{`
                      @keyframes pulseText {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.7; }
                      }
                    `}</style>
                  </div>
                </div>
              )}



              {/* Notifications dropdown */}
              <NotificationDropdown />

              {/* Profile dropdown */}
              <div
                className="relative"
                onMouseEnter={() => {
                  if (profileHoverTimeout[0]) clearTimeout(profileHoverTimeout[0]);
                  setProfileMenuOpen(true);
                }}
                onMouseLeave={() => {
                  const t = setTimeout(() => setProfileMenuOpen(false), 120);
                  profileHoverTimeout[1](t);
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setProfileMenuOpen((p) => !p);
                  }}
                  className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl transition-colors duration-200 hover:bg-purple-50"
                >
                  {/* Avatar with gradient ring */}
                  <div
                    className="rounded-full p-[2px]"
                    style={{
                      background: `linear-gradient(135deg, ${PURPLE}, #A78BFA, #60A5FA)`,
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden"
                      style={{
                        background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_MID})`,
                        border: "2px solid white",
                      }}
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                      ) : initials}
                    </div>
                  </div>
                  <ChevronDown
                    className="w-3.5 h-3.5 hidden md:block transition-transform duration-200"
                    style={{
                      color: "#6B7280",
                      transform: profileMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  />
                </button>

                {/* Dropdown */}
                <AnimatePresence>
                {profileMenuOpen && (
                  <motion.div
                    key="profile-dropdown"
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 380, damping: 28, mass: 0.6 }}
                    className="absolute right-0 mt-2 w-52 rounded-2xl shadow-xl border overflow-hidden"
                    style={{
                      background: "#FFFFFF",
                      borderColor: "#E5E7EB",
                      boxShadow: "0 20px 48px rgba(124,58,237,0.15), 0 4px 12px rgba(0,0,0,0.08)",
                      transformOrigin: "top right",
                    }}
                  >
                    {/* Header */}
                    <div
                      className="px-4 py-3"
                      style={{
                        background: `linear-gradient(135deg, ${PURPLE_LIGHT}, #DDD6FE)`,
                        borderBottom: `1px solid ${PURPLE}20`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="rounded-full p-[2px]"
                          style={{
                            background: `linear-gradient(135deg, ${PURPLE}, #A78BFA, #60A5FA)`,
                          }}
                        >
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-base overflow-hidden"
                            style={{
                              background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_MID})`,
                              border: "2px solid white",
                            }}
                          >
                            {avatarUrl ? (
                              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                            ) : initials}
                          </div>
                        </div>
                        <div>
                          <p
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: "#1F1344",
                            }}
                          >
                            {t("student.nav.profile.student")}
                          </p>
                          <p style={{ fontSize: 11, color: "#7C3AED" }}>
                            1,240 XP · 7 {t("student.nav.streak.days")}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Menu items */}
                    <div className="p-2">
                      <Link
                        to={studentPath("/ho-so")}
                        onMouseEnter={() => prefetchRoute(studentPath("/ho-so"))}
                        onFocus={() => prefetchRoute(studentPath("/ho-so"))}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-purple-50"
                        style={{ fontSize: 14, color: "#374151" }}
                      >
                        <User
                          className="w-4 h-4"
                          style={{ color: PURPLE }}
                        />
                        {t("student.nav.profile.myProfile")}
                      </Link>
                      <div
                        className="my-1.5 mx-1"
                        style={{
                          height: 1,
                          background: "#F3F4F6",
                        }}
                      />
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-red-50"
                        style={{ fontSize: 14, color: "#EF4444" }}
                      >
                        <LogOut className="w-4 h-4" />
                        {t("student.nav.profile.logout")}
                      </button>
                    </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* ─── Left Sidebar Drawer ─────────────────────────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[99]"
            style={{ background: "rgba(15,5,40,0.45)", backdropFilter: "blur(4px)" }}
            onClick={() => setSidebarOpen(false)}
          />

          {/* Drawer panel */}
          <div
            className="fixed top-0 left-0 h-full z-[100] flex flex-col"
            style={{
              width: 280,
              background: "#fff",
              boxShadow: "4px 0 40px rgba(124,58,237,0.18)",
              animation: "slideInLeft 0.22s ease",
            }}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ background: `linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)`, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <Link to={studentPath()} className="flex items-center gap-2.5" onClick={() => setSidebarOpen(false)}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)" }}>
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
                  NamThu<span style={{ color: "#C4B5FD" }}>Edu</span>
                </span>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Nav items */}
            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path, item.exact);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onMouseEnter={() => prefetchRoute(item.path)}
                    onFocus={() => prefetchRoute(item.path)}
                    onTouchStart={() => prefetchRoute(item.path)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150"
                    style={{
                      background: active ? `linear-gradient(135deg, ${PURPLE}, ${PURPLE_MID})` : "transparent",
                      color: active ? "#fff" : "#374151",
                      fontWeight: active ? 700 : 500,
                      fontSize: 14,
                      boxShadow: active ? `0 2px 10px ${PURPLE}40` : "none",
                    }}
                  >
                    <Icon className="w-4.5 h-4.5 flex-shrink-0" style={{ width: 18, height: 18, color: active ? "#fff" : PURPLE }} />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-3 pb-6 pt-2" style={{ borderTop: "1px solid #F0EEFF" }}>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-red-50"
                style={{ fontSize: 14, color: "#EF4444", fontWeight: 600 }}
              >
                <LogOut className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                {t("student.nav.profile.logout")}
              </button>
            </div>
          </div>

          <style>{`
            @keyframes slideInLeft {
              from { transform: translateX(-100%); opacity: 0; }
              to   { transform: translateX(0);     opacity: 1; }
            }
          `}</style>
        </>
      )}

      {/* ─── Mobile Bottom Navigation ─────────────────────────────────────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50"
        style={{
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderTop: "1px solid rgba(124,58,237,0.12)",
          boxShadow: "0 -4px 24px rgba(124,58,237,0.08)",
        }}
      >
        <div className="flex items-center justify-around px-2 py-2">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path, item.exact);
            return (
              <Link
                key={item.path}
                to={item.path}
                onTouchStart={() => prefetchRoute(item.path)}
                className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-200"
                style={{
                  color: active ? PURPLE : "#9CA3AF",
                  background: active ? PURPLE_LIGHT : "transparent",
                  minWidth: 56,
                }}
              >
                <Icon
                  className="w-5 h-5"
                  style={{
                    color: active ? PURPLE : "#9CA3AF",
                    strokeWidth: active ? 2.5 : 1.8,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: active ? 700 : 500,
                    lineHeight: 1,
                  }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
        {/* Safe area for iPhone */}
        <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </nav>
    </>
  );
}

import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router";
import { Bell, Plus, ChevronRight, User, Settings, LogOut, ChevronDown, BookOpen, ExternalLink, Send, Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { logout } from "../../../services/authApi";
import { api } from "../../../services/api";
import { getAuthUser } from "../../../utils/authStorage";
import { useNotificationSound } from "../../../hooks/useNotificationSound";

interface HeaderProps {
  breadcrumb: string | string[];
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ExamNotification {
  id: number;
  student_name: string;
  avatar: string;
  exam_title: string;
  exam_type: string;
  started_at: string;
  elapsed_min: number;
  seenAt: number;
}

/** Đề đã hoàn thiện nhưng chưa giao cho lớp/học viên — gợi ý công bố. */
interface ExamReadyNotification {
  id: number;
  exam_title: string;
  exam_type: string;
  created_at: string;
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w.charAt(0)).join("").toUpperCase().slice(0, 2);
}

function fmtAgo(min: number): string {
  if (min === 0) return "vừa xong";
  if (min < 60) return `${min} phút trước`;
  return `${Math.floor(min / 60)}h ${min % 60}m trước`;
}

export function Header({ breadcrumb, action }: HeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const crumbs = Array.isArray(breadcrumb) ? breadcrumb : [breadcrumb];

  const [profileOpen, setProfileOpen]   = useState(false);
  const [bellOpen, setBellOpen]         = useState(false);
  const [notifications, setNotifications] = useState<ExamNotification[]>([]);
  const [examsReady, setExamsReady]     = useState<ExamReadyNotification[]>([]);
  const [unread, setUnread]             = useState(0);
  const profileRef  = useRef<HTMLDivElement>(null);
  const bellRef     = useRef<HTMLDivElement>(null);
  const bellCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenIdsRef  = useRef<Set<number> | null>(null);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sound and Student Notification Hooks
  const { playSound, isSoundEnabled, toggleSound } = useNotificationSound();
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  const [newStudents, setNewStudents] = useState<any[]>([]);
  const seenStudentIdsRef = useRef<Set<number> | null>(null);

  const handleToggleSound = () => {
    const next = toggleSound();
    setSoundOn(next);
  };

  const user     = getAuthUser();
  const userName = (user?.name as string) || (user?.uName as string) || "Giáo viên";
  const userRole = (user?.role as string) || (user?.uRole as string) || "";
  const userAvatar = (user?.avatar_url as string) || (user?.avatar as string) || "";
  
  // Helper function to get full avatar URL
  const getAvatarUrl = (avatar: string) => {
    if (!avatar) return '';
    // If already a full URL, return as is
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      return avatar;
    }
    // If relative path, prepend backend URL from .env
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    if (!baseUrl) {
      console.error('VITE_API_BASE_URL is not defined in .env');
      return '';
    }
    return avatar.startsWith('/') ? `${baseUrl}${avatar}` : `${baseUrl}/${avatar}`;
  };
  
  // State to track avatar updates
  const [currentAvatar, setCurrentAvatar] = useState(getAvatarUrl(userAvatar));
  
  // Listen for storage changes to update avatar
  useEffect(() => {
    const handleStorageChange = () => {
      const updatedUser = getAuthUser();
      const newAvatar = (updatedUser?.avatar_url as string) || (updatedUser?.avatar as string) || '';
      setCurrentAvatar(getAvatarUrl(newAvatar));
    };
    
    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom event from Settings page
    window.addEventListener('avatarUpdated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('avatarUpdated', handleStorageChange);
    };
  }, []);

  const fetchRecentStarts = () => {
    if (userRole !== "teacher") return;
    api.get("/teacher/dashboard/recent-starts")
      .then((res: any) => {
        const items: Omit<ExamNotification, "seenAt">[] = res?.data?.data ?? res?.data ?? [];
        if (!Array.isArray(items)) return;

        if (seenIdsRef.current === null) {
          seenIdsRef.current = new Set(items.map((i) => i.id));
          const veryNew = items.filter((i) => i.elapsed_min < 5);
          if (veryNew.length > 0) {
            setNotifications(veryNew.map((i) => ({ ...i, seenAt: Date.now() })));
            setUnread(veryNew.length);
          }
          return;
        }

        const newOnes = items.filter((i) => !seenIdsRef.current!.has(i.id));
        if (newOnes.length === 0) return;

        newOnes.forEach((i) => seenIdsRef.current!.add(i.id));

        setNotifications((prev) => [
          ...newOnes.map((i) => ({ ...i, seenAt: Date.now() })),
          ...prev,
        ].slice(0, 20));
        setUnread((c) => c + newOnes.length);
        playSound();
      })
      .catch(() => {});
  };

  /** Đề đã hoàn thiện nhưng chưa giao — gợi ý công bố cho học viên. */
  const fetchExamsReady = () => {
    if (userRole !== "teacher") return;
    api.get("/teacher/dashboard/exams-ready")
      .then((res: any) => {
        const items: ExamReadyNotification[] = res?.data?.data ?? res?.data ?? [];
        if (!Array.isArray(items)) return;
        setExamsReady((prev) => {
          // Tăng badge nếu xuất hiện đề mới chưa giao so với lần trước
          const prevIds = new Set(prev.map((e) => e.id));
          const fresh = items.filter((e) => !prevIds.has(e.id));
          if (fresh.length > 0 && prev.length > 0) {
            setUnread((c) => c + fresh.length);
            playSound();
          }
          return items;
        });
      })
      .catch(() => {});
  };

  /** Fetch new students created recently */
  const fetchNewStudents = () => {
    if (userRole !== "teacher") return;
    api.get("/teacher/students", { params: { per_page: 5, sort_by: "uCreated_at", sort_order: "desc" } })
      .then((res: any) => {
        const items = res?.data?.data?.data ?? [];
        if (!Array.isArray(items)) return;

        if (seenStudentIdsRef.current === null) {
          seenStudentIdsRef.current = new Set(items.map((s: any) => s.uId));
          return;
        }

        const newOnes = items.filter((s: any) => !seenStudentIdsRef.current!.has(s.uId));
        if (newOnes.length === 0) return;

        newOnes.forEach((s: any) => seenStudentIdsRef.current!.add(s.uId));

        setNewStudents((prev) => [
          ...newOnes,
          ...prev,
        ].slice(0, 10));
        setUnread((c) => c + newOnes.length);
        playSound();
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchRecentStarts();
    fetchExamsReady();
    fetchNewStudents();
    pollRef.current = setInterval(() => {
      fetchRecentStarts();
      fetchExamsReady();
      fetchNewStudents();
    }, 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    const syncUserProfile = async () => {
      try {
        const rawUser = localStorage.getItem('user') || sessionStorage.getItem('user');
        if (!rawUser) return;
        const parsedUser = JSON.parse(rawUser);
        
        if (!parsedUser.avatar_url && !parsedUser.avatar) {
          const { data: res } = await api.get('/user/profile');
          if (res.status === 'success' && res.data) {
            const updatedUser = {
              ...parsedUser,
              avatar_url: res.data.avatar_url,
              avatar: res.data.avatar_url,
            };
            const isLocal = localStorage.getItem('user') !== null;
            const storage = isLocal ? localStorage : sessionStorage;
            storage.setItem('user', JSON.stringify(updatedUser));
            
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new Event('avatarUpdated'));
          }
        }
      } catch (err) {
        console.error('Error syncing user profile:', err);
      }
    };
    
    syncUserProfile();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (bellRef.current   && !bellRef.current.contains(e.target as Node))   setBellOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleBellClick = () => {
    setBellOpen((p) => !p);
    setUnread(0);
  };

  const cancelBellClose = () => {
    if (bellCloseTimerRef.current) {
      clearTimeout(bellCloseTimerRef.current);
      bellCloseTimerRef.current = null;
    }
  };

  const scheduleBellClose = () => {
    cancelBellClose();
    bellCloseTimerRef.current = setTimeout(() => {
      setBellOpen(false);
      bellCloseTimerRef.current = null;
    }, 150);
  };

  const openBell = () => {
    cancelBellClose();
    setBellOpen(true);
    setUnread(0);
  };

  const handleProfileClick = () => {
    setProfileOpen((p) => !p);
  };

  const cancelProfileClose = () => {
    if (profileCloseTimerRef.current) {
      clearTimeout(profileCloseTimerRef.current);
      profileCloseTimerRef.current = null;
    }
  };

  const scheduleProfileClose = () => {
    cancelProfileClose();
    profileCloseTimerRef.current = setTimeout(() => {
      setProfileOpen(false);
      profileCloseTimerRef.current = null;
    }, 150);
  };

  const openProfile = () => {
    cancelProfileClose();
    setProfileOpen(true);
  };

  useEffect(() => {
    return () => {
      if (bellCloseTimerRef.current) clearTimeout(bellCloseTimerRef.current);
      if (profileCloseTimerRef.current) clearTimeout(profileCloseTimerRef.current);
    };
  }, []);

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    navigate("/giao-vien/dang-nhap", { replace: true });
  };

  return (
    <div className="sticky top-0 z-40 h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 min-w-0">
        {crumbs.map((crumb, index) => (
          <span key={index} className="flex items-center gap-1.5">
            {index > 0 && <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />}
            <span
              className={`transition-colors ${
                index === crumbs.length - 1
                  ? "text-slate-800 font-semibold text-[14px] truncate"
                  : "text-slate-400 hover:text-indigo-600 font-medium text-[13px] cursor-pointer"
              }`}
            >
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {action && (
          <Button
            onClick={action.onClick}
            className="group bg-slate-900 hover:bg-slate-800 text-white h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all hover:-translate-y-0.5 hover:shadow-sm shadow-slate-900/10"
            style={{ fontSize: "12px", fontWeight: 600 }}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            {action.label}
          </Button>
        )}

        {/* Notification Sound Toggle */}
        <button
          onClick={handleToggleSound}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
            soundOn
              ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              : "text-slate-300 hover:bg-slate-100 hover:text-slate-400"
          }`}
          title={soundOn ? "Tắt âm thanh" : "Bật âm thanh"}
        >
          {soundOn ? (
            <Volume2 className="w-[15px] h-[15px]" />
          ) : (
            <VolumeX className="w-[15px] h-[15px]" />
          )}
        </button>

        {/* Bell Notification */}
        <div
          className="relative"
          ref={bellRef}
          onMouseEnter={openBell}
          onMouseLeave={scheduleBellClose}
        >
          <button
            onClick={handleBellClick}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all relative ${
              unread > 0
                ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
            aria-label={t("header.notifications")}
          >
            <Bell className={`w-[15px] h-[15px] ${unread > 0 ? "animate-pulse" : ""}`} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 border border-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          <div
            onMouseEnter={cancelBellClose}
            onMouseLeave={scheduleBellClose}
            className={`absolute right-0 top-full z-50 pt-2 transition-all duration-200 origin-top-right ${
              bellOpen ? "opacity-100 translate-y-0 visible" : "opacity-0 -translate-y-1 invisible pointer-events-none"
            }`}
          >
            <div className="w-80 bg-white rounded-xl border border-slate-200 shadow-lg shadow-slate-200/60 overflow-hidden">
              {/* Section: Học viên mới */}
              {newStudents.length > 0 && (
                <div className="border-b border-slate-100">
                  <div className="px-4 py-2.5 flex items-center justify-between bg-blue-50/60">
                    <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">Học viên mới tạo</p>
                    <Link
                      to="/giao-vien/hoc-vien"
                      onClick={() => setBellOpen(false)}
                      className="text-[10px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      Quản lý <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-50">
                    {newStudents.map((s) => (
                      <Link
                        key={`student-${s.uId}`}
                        to="/giao-vien/hoc-vien"
                        onClick={() => setBellOpen(false)}
                        className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-blue-50/40 transition-colors cursor-pointer"
                      >
                        <div className="w-7 h-7 bg-gradient-to-tr from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white flex-shrink-0 mt-0.5 text-[10px] font-bold overflow-hidden">
                          {s.avatar_url ? (
                            <img
                              src={getAvatarUrl(s.avatar_url)}
                              alt={s.uName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            getInitials(s.uName)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-700 leading-snug">
                            <span className="font-semibold text-slate-900 truncate block">{s.uName}</span>
                            <span className="text-slate-500">vừa được đăng ký học viên mới</span>
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                              {s.age_group || "general"}
                            </span>
                            <span className="text-[10px] text-slate-400">{s.uPhone}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Section: Đề sẵn sàng công bố cho học viên */}
              {examsReady.length > 0 && (
                <div className="border-b border-slate-100">
                  <div className="px-4 py-2.5 flex items-center justify-between bg-emerald-50/60">
                    <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Đề sẵn sàng công bố</p>
                    <Link
                      to="/giao-vien/de-thi"
                      onClick={() => setBellOpen(false)}
                      className="text-[10px] font-semibold text-emerald-600 hover:underline flex items-center gap-1"
                    >
                      Quản lý đề <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
                    {examsReady.slice(0, 6).map((e) => (
                      <Link
                        key={`ready-${e.id}`}
                        to="/giao-vien/bai-tap/giao-moi"
                        onClick={() => setBellOpen(false)}
                        className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-emerald-50/40 transition-colors cursor-pointer"
                      >
                        <div className="w-7 h-7 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-full flex items-center justify-center text-white flex-shrink-0 mt-0.5">
                          <Send className="w-3 h-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-700 leading-snug">
                            <span className="font-medium text-slate-900 truncate block">{e.exam_title}</span>
                            <span className="text-slate-500">đã hoàn thiện — giao cho học viên để bắt đầu thi</span>
                          </p>
                          <span className="inline-block mt-1 text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {e.exam_type}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Học viên vừa bắt đầu thi</p>
                {notifications.length > 0 && (
                  <Link
                    to="/giao-vien/giam-sat-truc-tiep"
                    onClick={() => setBellOpen(false)}
                    className="text-[10px] font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    Xem tất cả <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-7 text-slate-400">
                    <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                      <Bell className="w-4 h-4 text-slate-400 opacity-60" />
                    </div>
                    <p className="text-xs font-medium text-slate-500">Chưa có thông báo mới</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Tự động cập nhật mỗi 30 giây</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={`${n.id}-${n.seenAt}`} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-indigo-50/40 transition-colors cursor-pointer">
                      <div className="w-7 h-7 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">
                        {n.avatar || getInitials(n.student_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 leading-snug">
                          <span className="font-semibold text-slate-900">{n.student_name}</span>
                          <span className="text-slate-500"> bắt đầu làm </span>
                          <span className="font-medium text-slate-800 truncate block mt-0.5">{n.exam_title}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                            {n.exam_type}
                          </span>
                          <span className="text-[10px] text-slate-400">{fmtAgo(n.elapsed_min)}</span>
                        </div>
                      </div>
                      <BookOpen className="w-3 h-3 text-slate-300 flex-shrink-0 mt-1" />
                    </div>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/60">
                  <Link
                    to="/giao-vien/giam-sat-truc-tiep"
                    onClick={() => setBellOpen(false)}
                    className="text-[11px] text-indigo-600 font-bold hover:underline flex items-center justify-center gap-1"
                  >
                    Mở trang giám sát trực tiếp <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Profile Dropdown */}
        <div
          className="relative"
          ref={profileRef}
          onMouseEnter={openProfile}
          onMouseLeave={scheduleProfileClose}
        >
          <button
            onClick={handleProfileClick}
            className={`group flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 transition-all ${
              profileOpen ? "bg-indigo-50" : "hover:bg-slate-100"
            }`}
          >
            {currentAvatar ? (
              <img
                src={currentAvatar}
                alt={userName}
                className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ${currentAvatar ? 'hidden' : ''}`} style={{ background: 'linear-gradient(135deg,#6366F1,#4338CA)' }}>
              {getInitials(userName)}
            </div>
            <span className="text-slate-700 hidden md:block max-w-[110px] truncate" style={{ fontSize: "12.5px", fontWeight: 600 }}>
              {userName}
            </span>
            <ChevronDown
              className={`w-3 h-3 text-slate-400 transition-transform ${profileOpen ? "rotate-180 text-indigo-600" : ""}`}
            />
          </button>

          {profileOpen && (
            <div
              onMouseEnter={cancelProfileClose}
              onMouseLeave={scheduleProfileClose}
              className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl border border-slate-200 shadow-lg shadow-slate-200/60 z-50 overflow-hidden origin-top-right"
            >
              <div className="px-4 py-2.5 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-800 truncate">{userName}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-semibold uppercase tracking-wider">Giáo viên</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { setProfileOpen(false); navigate("/giao-vien/cai-dat?tab=profile"); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-indigo-700 transition-colors text-left group"
                >
                  <User className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 flex-shrink-0" />
                  Hồ sơ cá nhân
                </button>
                <button
                  onClick={() => { setProfileOpen(false); navigate("/giao-vien/cai-dat"); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-indigo-700 transition-colors text-left group"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 flex-shrink-0" />
                  Cài đặt
                </button>
              </div>
              <div className="border-t border-slate-100 py-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-[13px] font-semibold text-rose-600 hover:bg-rose-50/60 transition-colors text-left"
                >
                  <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
                  Đăng xuất
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

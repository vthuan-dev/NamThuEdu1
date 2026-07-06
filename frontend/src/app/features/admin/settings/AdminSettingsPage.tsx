import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import {
  User,
  Lock,
  Shield,
  MonitorSmartphone,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  RefreshCw,
  Mail,
  Calendar,
  Clock,
  Palette,
  Edit2,
  X,
  Save,
  SlidersHorizontal,
  ShieldCheck,
  Bell,
  Wrench,
  AlertTriangle,
  UserPlus,
  Smartphone,
  Trash2,
  Camera,
  Phone,
} from "lucide-react";
import { adminApi } from "@/services/adminApi";
import { AdminSettingsSkeleton } from "../components/AdminPageSkeleton";

/* ── avatar gradient presets ── */
const AVATAR_PRESETS = [
  { id: "amber",  gradient: "linear-gradient(135deg,#F59E0B,#EF4444)",  label: "Hổ phách" },
  { id: "blue",   gradient: "linear-gradient(135deg,#2563EB,#7C3AED)",  label: "Đại dương" },
  { id: "green",  gradient: "linear-gradient(135deg,#10B981,#0284C7)",  label: "Ngọc bích" },
  { id: "purple", gradient: "linear-gradient(135deg,#8B5CF6,#EC4899)",  label: "Hoàng gia" },
  { id: "red",    gradient: "linear-gradient(135deg,#EF4444,#F97316)",  label: "San hô" },
  { id: "teal",   gradient: "linear-gradient(135deg,#0D9488,#2563EB)",  label: "Lục bảo" },
];
const LS_AVATAR = "admin_avatar_color";
const getStoredAvatar = () => localStorage.getItem(LS_AVATAR) ?? "amber";

/* ── session device icon heuristic ── */
function DeviceIcon({ name }: { name: string }) {
  const lower = (name ?? "").toLowerCase();
  if (lower.includes("mobile") || lower.includes("phone")) return <Smartphone className="h-4.5 w-4.5 text-slate-500" />;
  return <MonitorSmartphone className="h-4.5 w-4.5 text-slate-500" />;
}

/* ── toast notification ── */
function Toast({ msg, type }: { msg: string; type: "ok" | "err" }) {
  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 shadow-2xl"
      style={{
        background: type === "ok" ? "#0F172A" : "#FEF2F2",
        border: `1px solid ${type === "ok" ? "#334155" : "#FECACA"}`,
        minWidth: 260,
        animation: "fadeInUp 250ms cubic-bezier(0.16, 1, 0.3, 1)"
      }}
    >
      {type === "ok" ? (
        <Check className="h-4 w-4 flex-shrink-0" style={{ color: "#10B981" }} />
      ) : (
        <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: "#EF4444" }} />
      )}
      <span style={{ fontSize: 13, color: type === "ok" ? "#F8FAFC" : "#EF4444", fontWeight: 500 }}>
        {msg}
      </span>
    </div>
  );
}

type Settings = {
  autoRefresh: boolean;
  refreshInterval: number;
  emailAlert: boolean;
  alertEmail: string;
  maintenanceMode: boolean;
  allowRegistration: boolean;
  maxLoginAttempts: number;
  examAutoApprove: boolean;  // Tự động duyệt đề thi
  blogAutoApprove: boolean;  // Tự động duyệt bài viết
};

const DEFAULTS: Settings = {
  autoRefresh: true,
  refreshInterval: 30,
  emailAlert: false,
  alertEmail: "",
  maintenanceMode: false,
  allowRegistration: true,
  maxLoginAttempts: 5,
  examAutoApprove: true,  // Mặc định auto-approve
  blogAutoApprove: true,  // Mặc định auto-approve bài viết
};

type Session = {
  id: number;
  name: string;
  is_current: boolean;
  created_at: string;
  last_used_at: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function AdminSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as "profile" | "security" | "sessions" | "system") || "profile";

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── 1. Profile State ── */
  const [profile, setProfile] = useState<{ name: string; phone: string; email: string; role: string; created_at: string | null } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [avatarId, setAvatarId] = useState(getStoredAvatar);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  /* ── 2. Security State ── */
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  /* ── 3. Sessions State ── */
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [revokeAllLoading, setRevokeAllLoading] = useState(false);

  /* ── 4. System Settings State ── */
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [initial, setInitial] = useState<Settings>(DEFAULTS);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const showToast = useCallback((msg: string, type: "ok" | "err") => {
    setToast({ msg, type });
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      // Load Profile
      const prof = await adminApi.getAdminProfile().catch(() => ({
        name: "Administrator",
        phone: "0900000000",
        email: "admin@namthu.edu.vn",
        role: "admin",
        created_at: null,
      }));
      setProfile(prof);
      setEditName(prof.name || "");
      setEditEmail(prof.email || "");
      setEditPhone(prof.phone || "");

      // Load Settings
      const sys = await adminApi.getSettings().catch(() => DEFAULTS);
      const merged: Settings = {
        autoRefresh: sys.autoRefresh !== undefined ? Boolean(sys.autoRefresh) : DEFAULTS.autoRefresh,
        refreshInterval: sys.refreshInterval !== undefined ? Number(sys.refreshInterval) : DEFAULTS.refreshInterval,
        emailAlert: sys.emailAlert !== undefined ? Boolean(sys.emailAlert) : DEFAULTS.emailAlert,
        alertEmail: sys.alertEmail !== undefined ? String(sys.alertEmail) : DEFAULTS.alertEmail,
        maintenanceMode: sys.maintenanceMode !== undefined ? Boolean(sys.maintenanceMode) : DEFAULTS.maintenanceMode,
        allowRegistration: sys.allowRegistration !== undefined ? Boolean(sys.allowRegistration) : DEFAULTS.allowRegistration,
        maxLoginAttempts: sys.maxLoginAttempts !== undefined ? Number(sys.maxLoginAttempts) : DEFAULTS.maxLoginAttempts,
        examAutoApprove: sys.examAutoApprove !== undefined ? Boolean(sys.examAutoApprove) : DEFAULTS.examAutoApprove,
        blogAutoApprove: sys.blogAutoApprove !== undefined ? Boolean(sys.blogAutoApprove) : DEFAULTS.blogAutoApprove,
      };
      setSettings(merged);
      setInitial(merged);

      // Load Sessions
      const sess = await adminApi.getAdminSessions().catch(() => []);
      setSessions(sess);
    } catch (err) {
      console.error("Lỗi đồng bộ dữ liệu cài đặt", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
    return () => {
      if (toastRef.current) clearTimeout(toastRef.current);
    };
  }, [loadAllData]);

  const handleTabChange = (tab: "profile" | "security" | "sessions" | "system") => {
    setSearchParams({ tab });
  };

  /* ── Avatar Presets Selection ── */
  const pickAvatar = (id: string) => {
    setAvatarId(id);
    localStorage.setItem(LS_AVATAR, id);
    window.dispatchEvent(new Event("admin_avatar_changed"));
    setAvatarPickerOpen(false);
    showToast("Đã đổi màu đại diện", "ok");
  };

  /* ── Save Profile ── */
  const handleSaveProfile = async () => {
    setEditLoading(true);
    try {
      const updated = await adminApi.updateAdminProfile({ name: editName, email: editEmail, phone: editPhone });
      if (updated) {
        setProfile((p) => p ? { ...p, name: updated.name, email: updated.email, phone: updated.phone } : p);
      }
      showToast("Cập nhật hồ sơ thành công", "ok");
      setEditMode(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Không thể cập nhật hồ sơ";
      showToast(msg, "err");
    } finally {
      setEditLoading(false);
    }
  };

  /* ── Password change ── */
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (!pwCurrent) {
      setPwError("Vui lòng nhập mật khẩu hiện tại.");
      return;
    }
    if (pwNew.length < 8) {
      setPwError("Mật khẩu mới phải từ 8 ký tự trở lên.");
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError("Mật khẩu xác nhận không trùng khớp.");
      return;
    }
    setPwLoading(true);
    try {
      await adminApi.changePassword(pwCurrent, pwNew, pwConfirm);
      showToast("Đổi mật khẩu thành công", "ok");
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Đổi mật khẩu thất bại.";
      setPwError(msg);
    } finally {
      setPwLoading(false);
    }
  };

  /* ── Revoke Session ── */
  const handleRevokeSession = async (id: number) => {
    setRevokingId(id);
    try {
      await adminApi.revokeSession(id);
      setSessions((s) => s.filter((x) => x.id !== id));
      showToast("Đã thu hồi phiên hoạt động thành công", "ok");
    } catch {
      showToast("Không thể thu hồi phiên", "err");
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllOther = async () => {
    setRevokeAllLoading(true);
    try {
      await adminApi.revokeAllSessions();
      setSessions((s) => s.filter((x) => x.is_current));
      showToast("Đã thu hồi tất cả phiên đăng nhập khác", "ok");
    } catch {
      showToast("Thu hồi phiên thất bại", "err");
    } finally {
      setRevokeAllLoading(false);
    }
  };

  /* ── System settings updates ── */
  const isDirty = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(initial);
  }, [settings, initial]);

  const setSystemValue = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaveState("idle");
    setErrorMsg(null);
  };

  // Auto-save boolean toggles immediately (better UX for switches)
  const toggleSystemValue = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const next = { ...settings, [key]: value } as Settings;
    setSettings(next);
    setSaveState("saving");
    setErrorMsg(null);
    try {
      await adminApi.updateSettings({
        autoRefresh: next.autoRefresh,
        refreshInterval: next.refreshInterval,
        emailAlert: next.emailAlert,
        alertEmail: next.alertEmail.trim(),
        maintenanceMode: next.maintenanceMode,
        allowRegistration: next.allowRegistration,
        maxLoginAttempts: next.maxLoginAttempts,
        examAutoApprove: next.examAutoApprove,
        blogAutoApprove: next.blogAutoApprove,
      });
      setInitial(next);
      setSaveState("saved");
      showToast("Đã lưu cài đặt", "ok");
    } catch (err: any) {
      console.error("Lỗi khi lưu cài đặt", err);
      setSettings((prev) => ({ ...prev, [key]: settings[key] })); // revert
      setSaveState("error");
      setErrorMsg("Không thể lưu cấu hình. Vui lòng thử lại.");
      showToast("Lưu thất bại", "err");
    }
  };

  const emailInvalid =
    settings.emailAlert &&
    settings.alertEmail.trim() !== "" &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.alertEmail.trim());

  const handleSaveSystemSettings = async () => {
    if (emailInvalid) return;
    setSaveState("saving");
    try {
      await adminApi.updateSettings({
        autoRefresh: settings.autoRefresh,
        refreshInterval: settings.refreshInterval,
        emailAlert: settings.emailAlert,
        alertEmail: settings.alertEmail.trim(),
        maintenanceMode: settings.maintenanceMode,
        allowRegistration: settings.allowRegistration,
        maxLoginAttempts: settings.maxLoginAttempts,
        examAutoApprove: settings.examAutoApprove,
        blogAutoApprove: settings.blogAutoApprove,
      });
      setInitial(settings);
      setSaveState("saved");
      showToast("Đã lưu các cài đặt hệ thống", "ok");
    } catch (err) {
      console.error("Lỗi khi lưu cài đặt hệ thống", err);
      setSaveState("error");
      setErrorMsg("Không thể lưu cấu hình hệ thống. Vui lòng thử lại.");
    }
  };

  const handleResetSystemSettings = () => {
    setSettings(initial);
    setSaveState("idle");
    setErrorMsg(null);
  };

  /* Password strength */
  const pwStrength = pwNew.length === 0 ? 0 : pwNew.length < 6 ? 1 : pwNew.length < 10 ? 2 : 3;
  const pwStrengthLabel = ["", "Yếu", "Trung bình", "Mạnh"];
  const pwStrengthColor = ["", "#DC2626", "#D97706", "#059669"];

  const avatarGradient = AVATAR_PRESETS.find((p) => p.id === avatarId)?.gradient ?? AVATAR_PRESETS[0].gradient;
  const joinDate = profile?.created_at ?? new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const otherSessions = sessions.filter((s) => !s.is_current);

  return (
    <div className="min-h-screen p-6" style={{ background: "#F8FAFC" }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Thiết lập chung</h1>
        <p className="text-sm text-slate-500">Quản lý tài khoản cá nhân và cấu hình vận hành hệ thống</p>
      </div>

      {loading ? (
        <AdminSettingsSkeleton />
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row">
          
          {/* ── LEFT TAB NAVIGATION ── */}
          <div className="w-full shrink-0 flex flex-col lg:w-56">
            
            {/* Unified Sidebar Box (Profile Header + Tabs) */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300">
              
              {/* Profile Header Block */}
              <div className="border-b border-slate-100 p-3.5 bg-slate-50/50 relative">
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <div 
                      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-sm font-black text-white shadow-sm transition-all duration-200 hover:scale-105"
                      style={{ background: avatarGradient }}
                      onClick={() => setAvatarPickerOpen(!avatarPickerOpen)}
                    >
                      {profile?.name
                        ? profile.name
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((w) => w[0].toUpperCase())
                            .join("")
                        : "AD"}
                    </div>
                    {/* Status pulse dot directly on top right corner of avatar */}
                    <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white"></span>
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold text-slate-800 truncate leading-snug">
                      {profile?.name || "Administrator"}
                    </h2>
                    <p className="text-xs text-amber-600 font-semibold truncate mt-0.5">Super Admin</p>
                  </div>
                </div>

                {avatarPickerOpen && (
                  <div className="absolute left-full top-0 ml-3 z-50 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl w-52">
                    <p className="mb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Chọn bảng màu</p>
                    <div className="grid grid-cols-3 gap-2">
                      {AVATAR_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => pickAvatar(preset.id)}
                          className="flex flex-col items-center gap-1 rounded-xl p-1.5 transition-colors hover:bg-slate-50"
                        >
                          <div className="h-7 w-7 rounded-lg" style={{ background: preset.gradient }} />
                          <span className="text-[9px] text-slate-500 font-medium">{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Tab Navigation List */}
              <div className="divide-y divide-slate-100/60">
                {[
                  { id: "profile",  icon: User,              label: "Tài khoản",         desc: "Thông tin hiển thị",  color: "#2563EB" },
                  { id: "security", icon: Lock,              label: "Bảo mật",           desc: "Đổi mật khẩu",       color: "#0D9488" },
                  { id: "sessions", icon: MonitorSmartphone, label: "Phiên đăng nhập",   desc: "Thiết bị kết nối",     color: "#8B5CF6" },
                  { id: "system",   icon: SlidersHorizontal, label: "Cấu hình hệ thống", desc: "Tham số vận hành",    color: "#F59E0B" },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id as any)}
                      className="relative group/btn flex w-full items-center gap-3 px-4 py-3.5 text-left transition-all duration-200 hover:bg-slate-50/75"
                      style={{
                        background: isActive ? "#F8FAFC" : "transparent"
                      }}
                    >
                      {/* Active left indicator strip */}
                      <div 
                        className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full transition-transform duration-200 ${
                          isActive ? "scale-y-100" : "scale-y-0"
                        }`}
                        style={{ backgroundColor: tab.color }}
                      />
                      
                      <div 
                        className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 group-hover/btn:scale-105"
                        style={{ background: isActive ? `${tab.color}15` : "#F1F5F9" }}
                      >
                        <tab.icon className="h-4 w-4 transition-colors duration-200" style={{ color: isActive ? tab.color : "#64748B" }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-bold truncate transition-colors duration-200 ${isActive ? "text-slate-900" : "text-slate-650 group-hover/btn:text-slate-900"}`}>{tab.label}</p>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{tab.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

            </div>
          </div>

          {/* ── RIGHT PANEL CONTENT ── */}
          <div className="flex-1 min-w-0 max-w-4xl">
            
            {/* ── PROFILE TAB ── */}
            {activeTab === "profile" && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                
                {/* Header */}
                <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Thông tin tài khoản</h2>
                    <p className="text-xs text-slate-500">Quản lý thông tin hiển thị cơ bản của bạn</p>
                  </div>
                  {!editMode ? (
                    <button
                      onClick={() => setEditMode(true)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-100"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Chỉnh sửa
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setEditMode(false); setEditName(profile?.name || ""); setEditEmail(profile?.email || ""); setEditPhone(profile?.phone || ""); }}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={editLoading}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {editLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Lưu thay đổi
                      </button>
                    </div>
                  )}
                </div>

                {/* Visual Banner Cover */}
                <div className="relative h-28 w-full rounded-xl overflow-hidden mb-6"
                  style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" }}>
                  {/* Glowing graphic elements */}
                  <div className="absolute inset-0 opacity-[0.04]"
                    style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "20px 20px" }} />
                  <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full opacity-30 blur-2xl transition-all duration-300"
                    style={{ background: avatarGradient }} />
                  <div className="absolute -left-10 -bottom-10 w-36 h-36 rounded-full opacity-20 blur-2xl bg-blue-500" />
                  
                  {/* Info overlaid on the banner */}
                  <div className="absolute bottom-4 left-5 flex items-center gap-4">
                    <div className="relative group">
                      <div 
                        className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-black text-white shadow-md border-2 border-white cursor-pointer transition-transform hover:scale-105"
                        style={{ background: avatarGradient }}
                        onClick={() => setAvatarPickerOpen(!avatarPickerOpen)}
                      >
                        {profile?.name
                          ? profile.name
                              .split(" ")
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((w) => w[0].toUpperCase())
                              .join("")
                          : "AD"}
                      </div>
                      {/* camera edit icon hover overlay */}
                      <div 
                        className="absolute inset-0 bg-black/45 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
                        onClick={() => setAvatarPickerOpen(!avatarPickerOpen)}
                      >
                        <Camera className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white leading-tight">
                        {profile?.name || "Administrator"}
                      </h3>
                      <p className="text-[11px] text-slate-350 font-medium flex items-center gap-1.5 mt-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Super Admin · Hoạt động
                      </p>
                    </div>
                  </div>

                  {avatarPickerOpen && (
                    <div className="absolute left-5 top-20 z-50 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl w-52 animate-fadeIn">
                      <p className="mb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Chọn bảng màu</p>
                      <div className="grid grid-cols-3 gap-2">
                        {AVATAR_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => pickAvatar(preset.id)}
                            className="flex flex-col items-center gap-1 rounded-xl p-1.5 transition-colors hover:bg-slate-50"
                          >
                            <div className="h-7 w-7 rounded-lg" style={{ background: preset.gradient }} />
                            <span className="text-[9px] text-slate-500 font-medium">{preset.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Form fields Grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  
                  {/* Name field */}
                  <div className="group relative rounded-xl border border-slate-100 bg-slate-50/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm hover:border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Tên hiển thị</label>
                        {editMode ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition-all duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 focus:bg-white mt-1.5"
                          />
                        ) : (
                          <p className="text-sm font-semibold text-slate-850 mt-0.5">{profile?.name || "Administrator"}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Email field */}
                  <div className="group relative rounded-xl border border-slate-100 bg-slate-50/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm hover:border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-emerald-50 group-hover:text-emerald-600">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Địa chỉ Email</label>
                        {editMode ? (
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 focus:bg-white mt-1.5"
                          />
                        ) : (
                          <p className="text-sm font-semibold text-slate-850 mt-0.5">{profile?.email || "—"}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Phone field */}
                  <div className="group relative rounded-xl border border-slate-100 bg-slate-50/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm hover:border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-violet-50 group-hover:text-violet-600">
                        <Phone className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Số điện thoại</label>
                        {editMode ? (
                          <input
                            type="text"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition-all duration-200 focus:border-violet-500 focus:ring-4 focus:ring-violet-50 focus:bg-white mt-1.5"
                          />
                        ) : (
                          <p className="text-sm font-semibold text-slate-850 mt-0.5">{profile?.phone || "—"}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Joined Date field */}
                  <div className="group relative rounded-xl border border-slate-100 bg-slate-50/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm hover:border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-amber-50 group-hover:text-amber-600">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Ngày gia nhập</label>
                        <p className="text-sm font-semibold text-slate-550 mt-0.5 flex items-center gap-1.5">
                          {joinDate}
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* ── SECURITY TAB ── */}
            {activeTab === "security" && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-900">Bảo mật tài khoản</h2>
                  <p className="text-xs text-slate-500">Cập nhật mật khẩu định kỳ để bảo vệ tài khoản quản trị</p>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4">
                  {pwError && (
                    <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      <AlertCircle className="h-4.5 w-4.5 flex-shrink-0 text-rose-500" />
                      {pwError}
                    </div>
                  )}

                  <div className="space-y-4">
                    {[
                      { id: "current", label: "Mật khẩu hiện tại", val: pwCurrent, set: setPwCurrent },
                      { id: "new",     label: "Mật khẩu mới",      val: pwNew,     set: setPwNew },
                      { id: "confirm", label: "Xác nhận mật khẩu mới", val: pwConfirm, set: setPwConfirm },
                    ].map(({ id, label, val, set }) => (
                      <div key={id} className="max-w-md">
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-650">{label}</label>
                        <div className="relative">
                          <input
                            type={showPw[id] ? "text" : "password"}
                            value={val}
                            onChange={(e) => set(e.target.value)}
                            placeholder={`Nhập ${label.toLowerCase()}`}
                            className="w-full rounded-xl border border-slate-200 bg-slate-55 px-4 py-2.5 pr-10 text-sm text-slate-800 outline-none transition-all focus:border-emerald-500 focus:bg-emerald-50/10 focus:ring-1 focus:ring-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPw((p) => ({ ...p, [id]: !p[id] }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showPw[id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {pwNew.length > 0 && (
                    <div className="max-w-md">
                      <div className="mb-1.5 flex gap-1">
                        {[1, 2, 3].map((n) => (
                          <div
                            key={n}
                            className="h-1.5 flex-1 rounded-full transition-all duration-300"
                            style={{ background: n <= pwStrength ? pwStrengthColor[pwStrength] : "#E2E8F0" }}
                          />
                        ))}
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: pwStrengthColor[pwStrength] }}>
                        Độ mạnh: {pwStrengthLabel[pwStrength]}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end pt-3">
                    <button
                      type="submit"
                      disabled={pwLoading}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {pwLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
                      {pwLoading ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── ACTIVE SESSIONS TAB ── */}
            {activeTab === "sessions" && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Thiết bị đang hoạt động</h2>
                    <p className="text-xs text-slate-500">Danh sách các phiên làm việc của tài khoản này từ các thiết bị khác nhau</p>
                  </div>
                  {otherSessions.length > 0 && (
                    <button
                      onClick={handleRevokeAllOther}
                      disabled={revokeAllLoading}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Đăng xuất các thiết bị khác
                    </button>
                  )}
                </div>

                {sessionsLoading ? (
                  <div className="space-y-4 py-4 animate-pulse">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-14 rounded-xl bg-slate-100" />
                    ))}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {sessions.map((session) => (
                      <div key={session.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100">
                          <DeviceIcon name={session.name} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-800 truncate">{session.name}</p>
                            {session.is_current && (
                              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-bold text-emerald-600">
                                Thiết bị này
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Tạo: {session.created_at} · Sử dụng cuối: {session.last_used_at}
                          </p>
                        </div>
                        {!session.is_current && (
                          <button
                            onClick={() => handleRevokeSession(session.id)}
                            disabled={revokingId === session.id}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                          >
                            {revokingId === session.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Thu hồi"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── SYSTEM SETTINGS TAB ── */}
            {activeTab === "system" && (
              <div className="space-y-5">
                
                {/* Save status notification bar */}
                {errorMsg && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0 text-rose-500" />
                    {errorMsg}
                  </div>
                )}

                {/* Grid controls */}
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  
                  {/* Operations Card */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-3 border-b border-slate-50 pb-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                        <Wrench className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">Bảo trì & Đăng ký</h3>
                        <p className="text-[10px] text-slate-400">Kiểm soát quyền truy cập công cộng</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Maintenance mode */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <label className="text-sm font-semibold text-slate-800">Chế độ bảo trì</label>
                          <p className="text-xs text-slate-400 leading-normal">Tạm khóa và ngăn học viên, giáo viên đăng nhập hệ thống</p>
                        </div>
                        <button
                          type="button"
                          disabled={saveState === "saving"}
                          onClick={() => toggleSystemValue("maintenanceMode", !settings.maintenanceMode)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${
                            settings.maintenanceMode ? "bg-amber-600" : "bg-slate-200"
                          }`}
                        >
                          <span className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
                            settings.maintenanceMode ? "translate-x-[16px]" : "translate-x-[2px]"
                          }`} />
                        </button>
                      </div>
                      
                      {settings.maintenanceMode && (
                        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700 flex items-start gap-2">
                          <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-amber-500 mt-0.5" />
                          <p className="leading-normal">
                            <strong>Chú ý:</strong> Chế độ bảo trì đang bật. Chỉ tài khoản Quản trị viên (Admin) mới có quyền truy cập ứng dụng.
                          </p>
                        </div>
                      )}

                      {/* Exam Auto Approve */}
                      <div className="flex items-start justify-between gap-4 pt-2">
                        <div className="flex-1">
                          <label className="text-sm font-semibold text-slate-800">Tự động duyệt đề thi</label>
                          <p className="text-xs text-slate-400 leading-normal">Khi GV tạo đề mới sẽ tự động xuất bản, ngược lại cần Admin phê duyệt</p>
                        </div>
                        <button
                          type="button"
                          disabled={saveState === "saving"}
                          onClick={() => toggleSystemValue("examAutoApprove", !settings.examAutoApprove)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${
                            settings.examAutoApprove ? "bg-emerald-600" : "bg-slate-300"
                          }`}
                        >
                          <span className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
                            settings.examAutoApprove ? "translate-x-[16px]" : "translate-x-[2px]"
                          }`} />
                        </button>
                      </div>
                      
                      {!settings.examAutoApprove && (
                        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700 flex items-start gap-2">
                          <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-amber-500 mt-0.5" />
                          <p className="leading-normal">
                            <strong>Chú ý:</strong> Chế độ duyệt thủ công đang bật. Đề thi của giáo viên sẽ ở trạng thái "Chờ duyệt" cho đến khi Admin phê duyệt.
                          </p>
                        </div>
                      )}

                      {/* Blog Auto Approve */}
                      <div className="flex items-start justify-between gap-4 pt-2">
                        <div className="flex-1">
                          <label className="text-sm font-semibold text-slate-800">Tự động duyệt bài viết</label>
                          <p className="text-xs text-slate-400 leading-normal">Khi GV gửi duyệt bài viết sẽ tự động xuất bản, ngược lại cần Admin phê duyệt</p>
                        </div>
                        <button
                          type="button"
                          disabled={saveState === "saving"}
                          onClick={() => toggleSystemValue("blogAutoApprove", !settings.blogAutoApprove)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${
                            settings.blogAutoApprove ? "bg-emerald-600" : "bg-slate-300"
                          }`}
                        >
                          <span className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
                            settings.blogAutoApprove ? "translate-x-[16px]" : "translate-x-[2px]"
                          }`} />
                        </button>
                      </div>

                      {!settings.blogAutoApprove && (
                        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700 flex items-start gap-2">
                          <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-amber-500 mt-0.5" />
                          <p className="leading-normal">
                            <strong>Chú ý:</strong> Chế độ duyệt thủ công đang bật. Bài viết của giáo viên sẽ ở trạng thái "Chờ duyệt" cho đến khi Admin phê duyệt.
                          </p>
                        </div>
                      )}

                      {/* Max login attempts */}
                      <div className="flex items-center justify-between gap-4 pt-2">
                        <div className="flex-1">
                          <label className="text-sm font-semibold text-slate-800">Số lần đăng nhập sai tối đa</label>
                          <p className="text-xs text-slate-400">Khóa tài khoản tạm thời nếu vượt quá giới hạn</p>
                        </div>
                        <input
                          type="number"
                          min={3}
                          max={20}
                          value={settings.maxLoginAttempts}
                          onChange={(e) => setSystemValue("maxLoginAttempts", Math.min(20, Math.max(3, Number(e.target.value) || 3)))}
                          className="w-16 rounded-xl border border-slate-200 px-2.5 py-1.5 text-right text-sm font-semibold text-slate-800 outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Refresh Settings Card */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-3 border-b border-slate-50 pb-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <RefreshCw className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">Chu kỳ Refresh & Tải lại</h3>
                        <p className="text-[10px] text-slate-400">Đồng bộ dữ liệu trên trang giám sát</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Auto refresh */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <label className="text-sm font-semibold text-slate-800">Tự động cập nhật số liệu</label>
                          <p className="text-xs text-slate-400 leading-normal">Tự động gọi API đồng bộ dữ liệu giám sát thi ở dashboard giáo viên</p>
                        </div>
                        <button
                          type="button"
                          disabled={saveState === "saving"}
                          onClick={() => toggleSystemValue("autoRefresh", !settings.autoRefresh)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${
                            settings.autoRefresh ? "bg-blue-600" : "bg-slate-200"
                          }`}
                        >
                          <span className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
                            settings.autoRefresh ? "translate-x-[16px]" : "translate-x-[2px]"
                          }`} />
                        </button>
                      </div>

                      {/* Refresh interval */}
                      <div className="flex items-center justify-between gap-4 pt-2">
                        <div className="flex-1">
                          <label className="text-sm font-semibold text-slate-800">Chu kỳ đồng bộ</label>
                          <p className="text-xs text-slate-400">Khoảng thời gian tự động reload (tính bằng giây)</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={5}
                            max={600}
                            disabled={!settings.autoRefresh}
                            value={settings.refreshInterval}
                            onChange={(e) => setSystemValue("refreshInterval", Math.min(600, Math.max(5, Number(e.target.value) || 5)))}
                            className="w-20 rounded-xl border border-slate-200 px-2.5 py-1.5 text-right text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-450"
                          />
                          <span className="text-xs text-slate-400">giây</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mail & Alerts Card (Spans full width) */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                    <div className="mb-4 flex items-center gap-3 border-b border-slate-50 pb-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">Email Cảnh báo Hệ thống</h3>
                        <p className="text-[10px] text-slate-400">Nhận báo cáo lỗi máy chủ tự động qua email</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Email Alert Enable */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <label className="text-sm font-semibold text-slate-800">Bật thông báo email</label>
                          <p className="text-xs text-slate-400 leading-normal">Gửi mail thông báo trực tiếp khi có sự cố cơ sở dữ liệu hoặc máy chủ</p>
                        </div>
                        <button
                          type="button"
                          disabled={saveState === "saving"}
                          onClick={() => toggleSystemValue("emailAlert", !settings.emailAlert)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${
                            settings.emailAlert ? "bg-blue-600" : "bg-slate-200"
                          }`}
                        >
                          <span className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
                            settings.emailAlert ? "translate-x-[16px]" : "translate-x-[2px]"
                          }`} />
                        </button>
                      </div>

                      {/* Alert Email Input */}
                      {settings.emailAlert && (
                        <div className="pt-2 max-w-md">
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Email người nhận cảnh báo</label>
                          <input
                            type="email"
                            value={settings.alertEmail}
                            onChange={(e) => setSystemValue("alertEmail", e.target.value)}
                            placeholder="alert-admin@namthu.edu.vn"
                            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-semibold outline-none transition-colors ${
                              emailInvalid ? "border-rose-300 focus:border-rose-500" : "border-slate-200 focus:border-blue-500"
                            }`}
                          />
                          {emailInvalid && (
                            <p className="mt-1 text-xs text-rose-600">Vui lòng cung cấp một email hợp lệ.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Floating save actions bar when system settings are dirty */}
                {isDirty && (
                  <div className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-md backdrop-blur-sm animate-fadeIn">
                    <p className="text-xs font-medium text-slate-700">Bạn có thay đổi chưa lưu trong cấu hình hệ thống.</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleResetSystemSettings}
                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={handleSaveSystemSettings}
                        disabled={saveState === "saving" || emailInvalid}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {saveState === "saving" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Lưu cấu hình
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}

export default AdminSettingsPage;

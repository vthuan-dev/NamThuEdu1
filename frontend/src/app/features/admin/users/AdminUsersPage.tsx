import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import {
  Lock, Search, Shield, Unlock, Users, Trash2, UserCog, X, CheckSquare, Square,
  UserPlus, GraduationCap, Phone, CheckCircle2, XCircle, RefreshCw, AlertCircle, Check, Eye, EyeOff
} from "lucide-react";
import { adminApi, AdminUser } from "@/services/adminApi";
import { AdminTableSkeleton } from "../components/AdminPageSkeleton";
import { getFullMediaUrl } from "@/utils/mediaUtils";
import { AdminCredentialsModal } from "./AdminCredentialsModal";

type AgeFilter = "all" | "kids" | "teens" | "adults";
type StatusFilter = "all" | "active" | "inactive";
type BulkAction = "lock" | "unlock" | "delete" | "change_role";

function displayName(user: AdminUser) {
  return user.uName || user.name || "N/A";
}

function displayPhone(user: AdminUser) {
  return user.uPhone || user.phone || "N/A";
}

function displayRole(user: AdminUser) {
  return user.uRole || user.role || "student";
}

function displayStatus(user: AdminUser) {
  return user.uStatus || user.status || "inactive";
}

function displayId(user: AdminUser) {
  return user.uId || user.id || 0;
}

function displayAvatar(user: AdminUser) {
  return getFullMediaUrl(user.avatar_url || user.avatar);
}

/** Lấy 2 ký tự đầu để hiển thị avatar fallback */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const GRADIENTS = [
  "linear-gradient(135deg, #3B82F6, #8B5CF6)", // Blue to Violet
  "linear-gradient(135deg, #10B981, #3B82F6)", // Emerald to Blue
  "linear-gradient(135deg, #F59E0B, #EF4444)", // Amber to Red
  "linear-gradient(135deg, #EC4899, #8B5CF6)", // Pink to Violet
  "linear-gradient(135deg, #06B6D4, #3B82F6)", // Cyan to Blue
];
const pickGradient = (id: number) => GRADIENTS[id % GRADIENTS.length];

const COOLDOWN_MS = 5 * 60 * 1000;
function fmtCooldown(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Classification = {
  label: string;
  className: string;
};

/**
 * Phân loại hiển thị ở cột "Phân loại":
 * - Học viên (student) → nhóm tuổi: Thiếu nhi / Thiếu niên / Người lớn
 * - Giáo viên / Quản trị → giữ nhãn vai trò
 */
function classify(user: AdminUser): Classification {
  const role = displayRole(user);

  if (role === "teacher") {
    return { label: "Giáo viên", className: "bg-sky-100 text-sky-700 border border-sky-200" };
  }
  if (role === "admin") {
    return { label: "Quản trị", className: "bg-purple-100 text-purple-700 border border-purple-200" };
  }

  // student → dựa vào age_group
  const ag = (user.age_group || "").toString().toLowerCase();
  switch (ag) {
    case "kids":
      return { label: "Thiếu nhi", className: "bg-pink-100 text-pink-700 border border-pink-200" };
    case "teens":
      return { label: "Thiếu niên", className: "bg-amber-100 text-amber-700 border border-amber-200" };
    default:
      return { label: "Người lớn", className: "bg-emerald-100 text-emerald-700 border border-emerald-200" };
  }
}

/** Chuẩn hoá age_group về 3 nhóm để lọc */
function normalizeAgeGroup(user: AdminUser): "kids" | "teens" | "adults" {
  const ag = (user.age_group || "").toString().toLowerCase();
  if (ag === "kids") return "kids";
  if (ag === "teens") return "teens";
  return "adults";
}

/* ── Modal xác nhận khoá giáo viên ── */
function ConfirmLockModal({
  teacher,
  onConfirm,
  onCancel,
}: {
  teacher: AdminUser;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const name = displayName(teacher);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(2px)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.18)", border: "1px solid #E2E8F0" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: "#FEF2F2" }}
          >
            <Lock className="h-5 w-5 animate-pulse" style={{ color: "#EF4444" }} />
          </div>
          <div>
            <p className="font-bold text-slate-900" style={{ fontSize: 15 }}>Xác nhận khoá tài khoản</p>
            <p className="text-xs text-slate-400" style={{ fontSize: 12 }}>Hành động này sẽ chặn đăng nhập</p>
          </div>
        </div>
        <p className="text-slate-600 mb-4" style={{ fontSize: 13, lineHeight: 1.65 }}>
          Bạn có chắc muốn khoá tài khoản giáo viên <strong className="text-slate-950">{name}</strong>?
          Họ sẽ <strong>không thể đăng nhập</strong> cho đến khi được mở khoá.
        </p>
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-5 border border-amber-200"
          style={{ background: "#FFFBEB" }}
        >
          <div className="h-3.5 w-3.5 flex-shrink-0 rounded-full bg-amber-500 animate-pulse" />
          <p className="text-amber-800" style={{ fontSize: 11 }}>
            Sau khi khoá, cần chờ <strong>5 phút</strong> trước khi có thể khoá lại giáo viên này.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl py-2.5 text-xs font-medium border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
          >
            Huỷ bỏ
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl py-2.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors flex items-center justify-center gap-1.5"
          >
            <Lock className="h-3.5 w-3.5" /> Khoá tài khoản
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Toast notification overlay ── */
function Toast({ msg, type }: { msg: string; type: "ok" | "err" }) {
  return (
    <div
      className="fixed top-5 right-5 z-[9999] flex items-center gap-2.5 rounded-xl px-4 py-3 shadow-xl"
      style={{
        background: type === "ok" ? "#ECFDF5" : "#FEF2F2",
        border: `1px solid ${type === "ok" ? "#A7F3D0" : "#FECACA"}`,
      }}
    >
      {type === "ok" ? (
        <Check className="h-4.5 w-4.5 text-emerald-600" />
      ) : (
        <AlertCircle className="h-4.5 w-4.5 text-rose-600" />
      )}
      <span className="text-xs font-semibold" style={{ color: type === "ok" ? "#065F46" : "#991B1B" }}>
        {msg}
      </span>
    </div>
  );
}

export function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "teachers" ? "teachers" : "students";

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [ageGroup, setAgeGroup] = useState<AgeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const [busyId, setBusyId] = useState<number | null>(null);
  const [roleStats, setRoleStats] = useState<Record<string, { active: number; inactive: number; total: number }> | null>(null);

  // Bulk selection state (Only for student tab)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null);
  const [pendingRole, setPendingRole] = useState<"student" | "teacher" | "admin">("student");

  // Creation modal state
  const [showCreate, setShowCreate] = useState(false);
  const [cRole, setCRole] = useState<"student" | "teacher" | "admin">("student");
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cPass, setCPass] = useState("");
  const [cAgeGroup, setCAgeGroup] = useState<"kids" | "teens" | "adults">("kids");
  const [cStatus, setCStatus] = useState<"active" | "inactive">("active");
  const [showPass, setShowPass] = useState(false);
  const [creating, setCreating] = useState(false);
  const [modalDone, setModalDone] = useState(false);

  // Credentials modal state
  const [showCredentials, setShowCredentials] = useState(false);
  const [createdUser, setCreatedUser] = useState<{
    name: string;
    phone: string;
    password: string;
    role: "student" | "teacher" | "admin";
    id?: number;
  } | null>(null);

  // Phone duplication check states
  const [debouncedPhone, setDebouncedPhone] = useState("");
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSuccess, setPhoneSuccess] = useState(false);

  // Teacher lock cooldown state
  const [confirmTarget, setConfirmTarget] = useState<AdminUser | null>(null);
  const [lockHistory, setLockHistory] = useState<Record<number, number>>({});
  const [now, setNow] = useState(Date.now());

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: "ok" | "err") => {
    setToast({ msg, type });
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  // Update ticker for cooldown timer
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const getCooldownMs = (id: number) => {
    const ts = lockHistory[id];
    if (!ts) return 0;
    return Math.max(0, COOLDOWN_MS - (now - ts));
  };

  const resetFilters = () => {
    setSearch("");
    setAgeGroup("all");
    setStatus("all");
    setSelectedIds(new Set());
    setBulkResult(null);
    setPendingAction(null);
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const role = activeTab === "teachers" ? "teacher" : "student";
      const data = await adminApi.getUsers({ role });
      setUsers(data);
      setSelectedIds(new Set());

      // Fetch statistics for badges
      try {
        const stats = await adminApi.getRoleStatistics();
        setRoleStats(stats);
      } catch (err) {
        console.error("Failed to load statistics", err);
      }
    } catch {
      setError(activeTab === "teachers" ? "Không tải được danh sách giáo viên." : "Không tải được danh sách học viên.");
    } finally {
      setLoading(false);
    }
  };

  // Trigger reload when active tab changes
  useEffect(() => {
    resetFilters();
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Debounce cPhone value (400ms delay)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedPhone(cPhone.trim());
    }, 400);
    return () => clearTimeout(handler);
  }, [cPhone]);

  // Perform duplicate check on debouncedPhone
  useEffect(() => {
    if (!debouncedPhone) {
      setPhoneError(null);
      setPhoneSuccess(false);
      setCheckingPhone(false);
      return;
    }

    const isDigitsOnly = /^[0-9]+$/.test(debouncedPhone);
    if (!isDigitsOnly) {
      setPhoneError("Số điện thoại chỉ được chứa chữ số.");
      setPhoneSuccess(false);
      setCheckingPhone(false);
      return;
    }

    if (debouncedPhone.length < 10) {
      setPhoneError("Số điện thoại phải có tối thiểu 10 chữ số.");
      setPhoneSuccess(false);
      setCheckingPhone(false);
      return;
    }

    const verifyPhoneUniqueness = async () => {
      try {
        setCheckingPhone(true);
        setPhoneError(null);
        setPhoneSuccess(false);

        // Fetch users matching the search string (no role constraint)
        const matchUsers = await adminApi.getUsers({ search: debouncedPhone });
        
        // Check if there is an exact match for the phone number
        const matched = matchUsers.find(
          (u) =>
            (u.phone && u.phone.trim() === debouncedPhone) ||
            (u.uPhone && u.uPhone.trim() === debouncedPhone)
        );

        if (matched) {
          const roleLabel =
            displayRole(matched) === "teacher"
              ? "Giáo viên"
              : displayRole(matched) === "admin"
              ? "Quản trị viên"
              : "Học viên";
          const ownerName = displayName(matched);
          setPhoneError(`Số điện thoại đã được đăng ký bởi ${roleLabel}: "${ownerName}"`);
          setPhoneSuccess(false);
        } else {
          setPhoneError(null);
          setPhoneSuccess(true);
        }
      } catch (err) {
        console.error("Lỗi kiểm tra số điện thoại", err);
      } finally {
        setCheckingPhone(false);
      }
    };

    verifyPhoneUniqueness();
  }, [debouncedPhone]);

  // Client-side filtering
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const role = activeTab === "teachers" ? "teacher" : "student";
    return users.filter((u) => {
      const matchRole = displayRole(u) === role;
      const matchSearch =
        !q ||
        displayName(u).toLowerCase().includes(q) ||
        displayPhone(u).toLowerCase().includes(q);
      const matchAge =
        activeTab === "teachers" ||
        ageGroup === "all" ||
        normalizeAgeGroup(u) === ageGroup;
      const matchStatus = status === "all" || displayStatus(u) === status;

      return matchRole && matchSearch && matchAge && matchStatus;
    });
  }, [users, search, ageGroup, status, activeTab]);

  // Fallback statistics if roleStats is not loaded
  const fallbackStats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => displayStatus(u) === "active").length;
    const locked = total - active;
    return { total, active, locked };
  }, [users]);

  const stats = useMemo(() => {
    const key = activeTab === "teachers" ? "teacher" : "student";
    if (roleStats && roleStats[key]) {
      const s = roleStats[key];
      return {
        total: s.total,
        active: s.active,
        locked: s.inactive,
      };
    }
    return fallbackStats;
  }, [roleStats, fallbackStats, activeTab]);

  // Tab Badge counts
  const studentCountBadge = roleStats?.student?.total ?? 0;
  const teacherCountBadge = roleStats?.teacher?.total ?? 0;

  // Bulk Actions handlers (Students tab only)
  const allFilteredIds = useMemo(() => filtered.map(displayId).filter(Boolean) as number[], [filtered]);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredIds));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runBulkAction = async () => {
    if (!pendingAction || selectedIds.size === 0) return;
    const userIds = Array.from(selectedIds);
    const confirmMsg =
      pendingAction === "delete"
        ? `Xoá ${userIds.length} học viên đã chọn? Hành động này không thể hoàn tác.`
        : pendingAction === "change_role"
        ? `Chuyển ${userIds.length} học viên sang vai trò "${pendingRole}"?`
        : `Xác nhận thao tác ${pendingAction === "lock" ? "khoá" : "mở khoá"} cho ${userIds.length} học viên?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setBulkBusy(true);
      setBulkResult(null);
      const res = await adminApi.bulkUserAction({
        action: pendingAction,
        user_ids: userIds,
        role: pendingAction === "change_role" ? pendingRole : undefined,
      });
      const changed = res?.changed ?? 0;
      const skipped = res?.skipped?.length ?? 0;
      setBulkResult({
        ok: true,
        msg: `Đã xử lý thành công ${changed} học viên${skipped > 0 ? `, bỏ qua ${skipped} học viên` : ""}.`,
      });
      setPendingAction(null);
      await loadUsers();
    } catch {
      setBulkResult({ ok: false, msg: "Thao tác hàng loạt thất bại." });
      showToast("Lỗi khi thực hiện thao tác hàng loạt", "err");
    } finally {
      setBulkBusy(false);
    }
  };

  // Row Lock/Unlock handler
  const executeLock = async (user: AdminUser, action: "lock" | "unlock") => {
    const id = displayId(user);
    if (!id) return;
    setConfirmTarget(null);
    setBusyId(id);
    try {
      if (action === "lock") {
        await adminApi.lockUser(id);
        if (displayRole(user) === "teacher") {
          setLockHistory((prev) => ({ ...prev, [id]: Date.now() }));
        }
        showToast("Đã khóa tài khoản thành công", "ok");
      } else {
        await adminApi.unlockUser(id);
        showToast("Đã mở khóa tài khoản thành công", "ok");
      }
      await loadUsers();
    } catch {
      showToast("Thao tác khóa/mở khóa thất bại", "err");
    } finally {
      setBusyId(null);
    }
  };

  const handleLockBtn = (user: AdminUser) => {
    const id = displayId(user);
    if (!id) return;
    const isActive = displayStatus(user) === "active";

    if (!isActive) {
      executeLock(user, "unlock");
      return;
    }

    if (displayRole(user) === "teacher") {
      const rem = getCooldownMs(id);
      if (rem > 0) {
        showToast(`Cần chờ thêm ${fmtCooldown(rem)} để có thể khoá lại giáo viên này`, "err");
        return;
      }
      setConfirmTarget(user);
    } else {
      if (window.confirm(`Xác nhận khoá tài khoản học viên ${displayName(user)}?`)) {
        executeLock(user, "lock");
      }
    }
  };

  // Modal reset & creation logic
  const generateRandomPassword = () => {
    // Generate 8-character random password (letters + numbers)
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const openModal = () => {
    const randomPassword = generateRandomPassword();
    
    setCRole(activeTab === "teachers" ? "teacher" : "student");
    setCName("");
    setCPhone("");
    setCPass(randomPassword); // Auto-generate random password
    setCAgeGroup("kids");
    setCStatus("active");
    setModalDone(false);
    setShowPass(true); // Show password by default

    // Clear validation states
    setDebouncedPhone("");
    setCheckingPhone(false);
    setPhoneError(null);
    setPhoneSuccess(false);

    setShowCreate(true);
  };

  const resetModal = () => {
    setShowCreate(false);
    setModalDone(false);

    // Clear validation states
    setDebouncedPhone("");
    setCheckingPhone(false);
    setPhoneError(null);
    setPhoneSuccess(false);
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName.trim()) {
      showToast("Vui lòng nhập họ tên", "err");
      return;
    }
    if (!cPhone.trim()) {
      showToast("Vui lòng nhập số điện thoại", "err");
      return;
    }
    if (cPhone.trim().length < 10) {
      showToast("Số điện thoại không hợp lệ (tối thiểu 10 chữ số)", "err");
      return;
    }
    if (phoneError || checkingPhone) {
      showToast("Vui lòng nhập số điện thoại hợp lệ và không trùng lặp", "err");
      return;
    }
    if (!cPass.trim()) {
      showToast("Vui lòng nhập mật khẩu", "err");
      return;
    }
    if (cPass.trim().length < 6) {
      showToast("Mật khẩu phải tối thiểu 6 ký tự", "err");
      return;
    }

    setCreating(true);
    try {
      const result = await adminApi.createUser({
        name: cName.trim(),
        phone: cPhone.trim(),
        password: cPass,
        role: cRole,
        status: cStatus,
        age_group: cRole === "student" ? cAgeGroup : undefined,
      });

      if (result.status === 'success' && result.data) {
        // Close creation modal
        setShowCreate(false);
        setModalDone(false);
        
        // Set created user data for credentials modal
        setCreatedUser({
          name: cName.trim(),
          phone: cPhone.trim(),
          password: result.data.password || cPass,
          role: cRole,
          id: result.data.id,
        });
        
        // Show credentials modal
        setShowCredentials(true);
        
        showToast("Tạo tài khoản người dùng thành công", "ok");
        await loadUsers();
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || "Tạo tài khoản thất bại";
      showToast(errMsg, "err");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen p-6" style={{ background: "#F8FAFC" }}>
      {/* ── Header ── */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-slate-400 font-semibold tracking-wider uppercase mb-1" style={{ fontSize: 10 }}>
            Hệ thống quản lý
          </p>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Người dùng</h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý thông tin và tài khoản của học viên & giáo viên</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadUsers}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </button>
          <button
            onClick={openModal}
            className="flex items-center gap-1.5 cursor-pointer rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-2.5 text-sm font-bold text-white transition-all transform hover:scale-[1.02] shadow-sm hover:shadow"
          >
            <UserPlus className="h-4.5 w-4.5" />
            {activeTab === "teachers" ? "Thêm giáo viên" : "Thêm học viên"}
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="mb-6 border-b border-slate-200">
        <div className="flex gap-6">
          <button
            onClick={() => setSearchParams({ tab: "students" })}
            className={`pb-3 text-sm font-semibold relative transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "students" ? "text-slate-950" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Users className="h-4.5 w-4.5" />
            Học viên
            {studentCountBadge > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 border border-slate-200 font-bold">
                {studentCountBadge}
              </span>
            )}
            {activeTab === "students" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-950 rounded-full animate-fadeIn" />
            )}
          </button>
          <button
            onClick={() => setSearchParams({ tab: "teachers" })}
            className={`pb-3 text-sm font-semibold relative transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "teachers" ? "text-slate-950" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <GraduationCap className="h-4.5 w-4.5" />
            Giáo viên
            {teacherCountBadge > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 border border-slate-200 font-bold">
                {teacherCountBadge}
              </span>
            )}
            {activeTab === "teachers" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-950 rounded-full animate-fadeIn" />
            )}
          </button>
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
            <Users className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 font-medium">
              {activeTab === "teachers" ? "Tổng số giáo viên" : "Tổng số học viên"}
            </p>
            <p className="text-xl font-extrabold leading-tight text-slate-900 mt-0.5">{stats.total}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-emerald-700 font-semibold">Đang hoạt động</p>
            <p className="text-xl font-extrabold leading-tight text-emerald-800 mt-0.5">{stats.active}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 border border-amber-200">
            <Lock className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-amber-700 font-semibold">
              {activeTab === "teachers" ? "Không hoạt động" : "Đã khóa"}
            </p>
            <p className="text-xl font-extrabold leading-tight text-amber-800 mt-0.5">{stats.locked}</p>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={activeTab === "teachers" ? "Tìm giáo viên theo tên, số điện thoại..." : "Tìm học viên theo tên, số điện thoại..."}
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition-all focus:border-slate-800 focus:ring-4 focus:ring-slate-100"
            />
          </div>
          {activeTab === "students" ? (
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value as AgeFilter)}
              className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-all focus:border-slate-800 bg-white"
            >
              <option value="all">Tất cả nhóm tuổi</option>
              <option value="kids">Thiếu nhi (Kids)</option>
              <option value="teens">Thiếu niên (Teens)</option>
              <option value="adults">Người lớn (Adults)</option>
            </select>
          ) : (
            <div className="hidden md:block" /> // Spacer column for grid layout alignment
          )}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-all focus:border-slate-800 bg-white"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Active (Hoạt động)</option>
            <option value="inactive">Inactive (Khóa)</option>
          </select>
        </div>
      </div>

      {/* ── Bulk Actions Toolbar (Students tab only) ── */}
      {activeTab === "students" && selectedIds.size > 0 && (
        <div
          className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 shadow-sm animate-fadeIn"
          style={{ background: "#F0F9FF", borderColor: "#BAE6FD" }}
        >
          <span className="text-sm font-bold text-sky-800">
            Đã chọn {selectedIds.size} học viên
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPendingAction("lock")}
              disabled={bulkBusy}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 border border-amber-200 transition-colors hover:bg-amber-200 disabled:opacity-60"
            >
              <Lock className="h-3.5 w-3.5" /> Khoá
            </button>
            <button
              onClick={() => setPendingAction("unlock")}
              disabled={bulkBusy}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 transition-colors hover:bg-emerald-200 disabled:opacity-60"
            >
              <Unlock className="h-3.5 w-3.5" /> Mở khoá
            </button>
            <button
              onClick={() => setPendingAction("change_role")}
              disabled={bulkBusy}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 border border-blue-200 transition-colors hover:bg-blue-200 disabled:opacity-60"
            >
              <UserCog className="h-3.5 w-3.5" /> Đổi vai trò
            </button>
            <button
              onClick={() => setPendingAction("delete")}
              disabled={bulkBusy}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 border border-rose-200 transition-colors hover:bg-rose-200 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" /> Xoá
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-2 flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-white border border-transparent hover:border-slate-200"
            >
              <X className="h-3.5 w-3.5" /> Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {/* ── Bulk Actions Confirm Panel ── */}
      {activeTab === "students" && pendingAction && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm animate-fadeIn">
          <span className="text-sm font-semibold text-amber-800">
            Xác nhận thao tác: {pendingAction === "change_role" ? "Đổi vai trò" : pendingAction === "lock" ? "Khoá" : pendingAction === "unlock" ? "Mở khoá" : "Xoá"} cho {selectedIds.size} học viên?
          </span>
          {pendingAction === "change_role" && (
            <select
              value={pendingRole}
              onChange={(e) => setPendingRole(e.target.value as any)}
              className="cursor-pointer rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-amber-500"
            >
              <option value="student">student (Học viên)</option>
              <option value="teacher">teacher (Giáo viên)</option>
              <option value="admin">admin (Quản trị)</option>
            </select>
          )}
          <div className="flex gap-2">
            <button
              onClick={runBulkAction}
              disabled={bulkBusy}
              className="cursor-pointer rounded-lg bg-amber-600 hover:bg-amber-700 px-4 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-60"
            >
              {bulkBusy ? "Đang xử lý..." : "Xác nhận"}
            </button>
            <button
              onClick={() => setPendingAction(null)}
              disabled={bulkBusy}
              className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {bulkResult && (
        <div
          className={`mb-3 rounded-lg px-4 py-2 text-xs font-semibold border ${
            bulkResult.ok ? "bg-emerald-50 text-emerald-700 border-emerald-150" : "bg-rose-50 text-rose-700 border-rose-150"
          }`}
        >
          {bulkResult.msg}
        </div>
      )}

      {/* ── Table / Grid Layout ── */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <AdminTableSkeleton rows={7} cols={activeTab === "students" ? 6 : 5} />
        ) : error ? (
          <div className="p-8 text-center text-rose-600 font-semibold">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 border border-slate-200">
              <Users className="h-6 w-6 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-400">
              {search || status !== "all" || ageGroup !== "all" ? "Không tìm thấy người dùng phù hợp" : "Danh sách trống"}
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[860px] border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-left text-xs uppercase tracking-wider text-slate-400 font-bold">
                {activeTab === "students" ? (
                  <th className="w-12 px-5 py-3.5 text-center">
                    <button
                      onClick={toggleSelectAll}
                      aria-label="Chọn tất cả"
                      className="cursor-pointer text-slate-400 hover:text-slate-800 transition-colors"
                    >
                      {allSelected ? (
                        <CheckSquare className="h-4.5 w-4.5 text-slate-800" />
                      ) : someSelected ? (
                        <CheckSquare className="h-4.5 w-4.5 opacity-60 text-slate-800" />
                      ) : (
                        <Square className="h-4.5 w-4.5" />
                      )}
                    </button>
                  </th>
                ) : (
                  <th className="w-14 px-5 py-3.5 text-center">ID</th>
                )}
                <th className="px-5 py-3.5">{activeTab === "teachers" ? "Giáo viên" : "Học viên"}</th>
                <th className="px-5 py-3.5">Số điện thoại</th>
                {activeTab === "students" && <th className="px-5 py-3.5">Phân loại</th>}
                <th className="px-5 py-3.5">Trạng thái</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((u) => {
                const id = displayId(u);
                const isActive = displayStatus(u) === "active";
                const isLocking = busyId === id;
                const checked = selectedIds.has(id);
                const avatarUrl = displayAvatar(u);
                const name = displayName(u);

                return (
                  <tr
                    key={id}
                    className={`transition-colors duration-100 ${
                      checked ? "bg-slate-50/70" : "hover:bg-slate-50/40"
                    }`}
                  >
                    {activeTab === "students" ? (
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => toggleSelectOne(id)}
                          aria-label={`Chọn học viên ${name}`}
                          className="cursor-pointer text-slate-400 hover:text-slate-800 transition-colors"
                        >
                          {checked ? (
                            <CheckSquare className="h-4.5 w-4.5 text-slate-900" />
                          ) : (
                            <Square className="h-4.5 w-4.5" />
                          )}
                        </button>
                      </td>
                    ) : (
                      <td className="px-5 py-3.5 text-center text-xs font-semibold text-slate-400">
                        #{id}
                      </td>
                    )}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={name}
                            className="h-9 w-9 flex-shrink-0 rounded-xl object-cover border border-slate-150 transform hover:scale-[1.08] transition-transform"
                            onError={(e) => {
                              const img = e.currentTarget;
                              img.style.display = "none";
                              const fb = img.nextElementSibling as HTMLElement | null;
                              if (fb) fb.style.display = "flex";
                            }}
                          />
                        ) : null}
                        <div
                          className="h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-white text-xs font-bold"
                          style={{
                            background: pickGradient(id),
                            display: avatarUrl ? "none" : "flex",
                          }}
                        >
                          {initials(name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate">{name}</p>
                          {u.created_at && (
                            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                              Tham gia {new Date(u.created_at).toLocaleDateString("vi-VN")}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 font-medium">
                      {displayPhone(u)}
                    </td>
                    {activeTab === "students" && (
                      <td className="px-5 py-3.5">
                        {(() => {
                          const c = classify(u);
                          return (
                            <span
                              className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-bold ${c.className}`}
                            >
                              {c.label}
                            </span>
                          );
                        })()}
                      </td>
                    )}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                          isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-250"
                        }`}
                      >
                        <div
                          className={`h-1.5 w-1.5 rounded-full ${
                            isActive ? "bg-emerald-600" : "bg-rose-600"
                          }`}
                        />
                        {isActive ? "Hoạt động" : "Khóa"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {(() => {
                        const cooldownMs = activeTab === "teachers" && isActive ? getCooldownMs(id) : 0;
                        const inCooldown = cooldownMs > 0;
                        const disabled = isLocking || inCooldown;
                        const isUnlock = !isActive;

                        const btnBg = isUnlock ? "#ECFDF5" : inCooldown ? "#F8FAFC" : "#FEF2F2";
                        const btnColor = isUnlock ? "#059669" : inCooldown ? "#94A3B8" : "#DC2626";
                        const btnBorder = isUnlock ? "#A7F3D0" : inCooldown ? "#E2E8F0" : "#FCA5A5";

                        return (
                          <button
                            onClick={() => handleLockBtn(u)}
                            disabled={disabled}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold border transition-all transform hover:scale-[1.03]"
                            style={{
                              background: btnBg,
                              color: btnColor,
                              borderColor: btnBorder,
                              opacity: isLocking ? 0.6 : 1,
                              cursor: inCooldown ? "not-allowed" : "pointer",
                            }}
                          >
                            {isLocking ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : isUnlock ? (
                              <Unlock className="h-3.5 w-3.5" />
                            ) : inCooldown ? (
                              <RefreshCw className="h-3.5 w-3.5" />
                            ) : (
                              <Lock className="h-3.5 w-3.5" />
                            )}
                            {isLocking ? "..." : isUnlock ? "Mở khoá" : inCooldown ? fmtCooldown(cooldownMs) : "Khoá"}
                          </button>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* ── Footer ── */}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs font-semibold text-slate-400">
              Hiển thị <strong className="text-slate-800">{filtered.length}</strong> / {users.length} {activeTab === "teachers" ? "giáo viên" : "học viên"}
            </span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold text-slate-400">{stats.active} đang hoạt động</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Create User Modal (Unified) ── */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) resetModal();
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white overflow-hidden animate-modalIn"
            style={{
              boxShadow: "0 25px 60px rgba(15,23,42,0.22)",
              border: "1px solid #EEF2F6",
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950">
                  <UserPlus className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-900 leading-tight">Thêm người dùng mới</p>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Tạo tài khoản truy cập hệ thống</p>
                </div>
              </div>
              <button
                onClick={resetModal}
                className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors text-slate-400 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5">
              {modalDone ? (
                <div className="flex flex-col items-center text-center py-6 animate-fadeIn">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200 mb-4">
                    <CheckCircle2 className="h-7 w-7 text-emerald-600 animate-bounce" />
                  </div>
                  <p className="text-base font-extrabold text-slate-900">Tạo tài khoản thành công</p>
                  <p className="text-xs text-slate-500 mt-2 px-2 leading-relaxed">
                    Tài khoản {cRole === "teacher" ? "Giáo viên" : "Học viên"} <strong className="text-slate-900">{cName}</strong> đã được tạo và có thể đăng nhập bằng SĐT ngay.
                  </p>
                  <div className="mt-6 flex gap-2 w-full">
                    <button
                      onClick={() => {
                        setModalDone(false);
                        setCName("");
                        setCPhone("");
                        setCPass("");
                        setCAgeGroup("kids");
                        setCStatus("active");
                      }}
                      className="flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 py-2.5 text-xs font-bold text-white transition-colors flex"
                    >
                      <UserPlus className="h-4 w-4" /> Tạo thêm
                    </button>
                    <button
                      onClick={resetModal}
                      className="flex-1 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={onCreate} className="space-y-4">
                  {/* Segmented control for Role selection */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
                      Vai trò người dùng
                    </label>
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setCRole("student")}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          cRole === "student"
                            ? "bg-white text-slate-900 shadow-sm border border-slate-150"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Học viên
                      </button>
                      <button
                        type="button"
                        onClick={() => setCRole("teacher")}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          cRole === "teacher"
                            ? "bg-white text-slate-900 shadow-sm border border-slate-150"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Giáo viên
                      </button>
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                      Họ tên <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        value={cName}
                        onChange={(e) => setCName(e.target.value)}
                        placeholder="Ví dụ: Nguyễn Văn A"
                        className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none transition-all bg-slate-50 focus:border-slate-800 focus:bg-white focus:ring-4 focus:ring-slate-100"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                      Số điện thoại <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        value={cPhone}
                        onChange={(e) => setCPhone(e.target.value)}
                        placeholder="Ví dụ: 0900123456"
                        type="tel"
                        className={`w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none transition-all bg-slate-50 focus:bg-white focus:ring-4 ${
                          phoneError
                            ? "border-rose-350 focus:border-rose-500 focus:ring-rose-50"
                            : phoneSuccess
                            ? "border-emerald-350 focus:border-emerald-500 focus:ring-emerald-50"
                            : "border-slate-200 focus:border-slate-800 focus:ring-slate-100"
                        }`}
                      />
                    </div>
                    {/* Live Duplication Checking feedback */}
                    <div className="min-h-[20px] mt-1 text-[11px] font-semibold">
                      {checkingPhone && (
                        <p className="text-slate-500 animate-pulse flex items-center gap-1.5">
                          <RefreshCw className="h-3 w-3 animate-spin" /> Đang kiểm tra số điện thoại...
                        </p>
                      )}
                      {!checkingPhone && phoneError && (
                        <p className="text-rose-600 animate-shake animate-slideDown flex items-center gap-1.5">
                          <XCircle className="h-3.5 w-3.5" /> {phoneError}
                        </p>
                      )}
                      {!checkingPhone && phoneSuccess && (
                        <p className="text-emerald-600 animate-slideDown flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Số điện thoại hợp lệ (chưa trùng).
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                      Mật khẩu đăng nhập <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        type={showPass ? "text" : "password"}
                        value={cPass}
                        onChange={(e) => setCPass(e.target.value)}
                        placeholder="Tối thiểu 6 ký tự"
                        className="w-full rounded-lg border border-slate-200 pl-9 pr-10 py-2 text-sm outline-none transition-all bg-slate-50 focus:border-slate-800 focus:bg-white focus:ring-4 focus:ring-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Age group (only for Student role) */}
                  {cRole === "student" && (
                    <div className="animate-fadeIn">
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                        Phân loại học viên
                      </label>
                      <select
                        value={cAgeGroup}
                        onChange={(e) => setCAgeGroup(e.target.value as any)}
                        className="w-full cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-all bg-slate-50 focus:border-slate-800 focus:bg-white focus:ring-4 focus:ring-slate-100"
                      >
                        <option value="kids">Thiếu nhi (Kids)</option>
                        <option value="teens">Thiếu niên (Teens)</option>
                        <option value="adults">Người lớn (Adults)</option>
                      </select>
                    </div>
                  )}

                  {/* Initial status */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                      Trạng thái ban đầu
                    </label>
                    <div className="flex gap-2">
                      {(["active", "inactive"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setCStatus(s)}
                          className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 flex-1 transition-all cursor-pointer border text-xs"
                          style={{
                            borderColor: cStatus === s ? (s === "active" ? "#A7F3D0" : "#FCA5A5") : "#E2E8F0",
                            background: cStatus === s ? (s === "active" ? "#ECFDF5" : "#FEF2F2") : "#FFF",
                            fontWeight: cStatus === s ? 700 : 500,
                            color: cStatus === s ? (s === "active" ? "#065F46" : "#991B1B") : "#64748B",
                          }}
                        >
                          <div
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: s === "active" ? "#10B981" : "#EF4444" }}
                          />
                          {s === "active" ? "Hoạt động ngay" : "Tạm khóa"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={resetModal}
                      className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors flex-1 cursor-pointer"
                    >
                      Huỷ
                    </button>
                    <button
                      type="submit"
                      disabled={creating || checkingPhone || !!phoneError}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 px-4 py-2.5 text-xs font-bold text-white transition-colors flex-[2] disabled:opacity-60 cursor-pointer"
                    >
                      {creating ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="h-3.5 w-3.5" />
                      )}
                      {creating ? "Đang tạo..." : "Tạo tài khoản"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Lock Teacher Modal ── */}
      {confirmTarget && (
        <ConfirmLockModal
          teacher={confirmTarget}
          onConfirm={() => executeLock(confirmTarget, "lock")}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      {/* ── Toast notifications ── */}
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* ── Credentials Modal ── */}
      {createdUser && (
        <AdminCredentialsModal
          isOpen={showCredentials}
          onClose={() => {
            setShowCredentials(false);
            setCreatedUser(null);
          }}
          userData={createdUser}
          onPasswordReset={(newPassword) => {
            if (createdUser) {
              setCreatedUser({ ...createdUser, password: newPassword });
            }
          }}
        />
      )}

      {/* ── Animation presets ── */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 180ms ease-out forwards;
        }
        .animate-modalIn {
          animation: modalIn 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-shake {
          animation: shake 0.22s ease-in-out;
        }
        .animate-slideDown {
          animation: slideDown 0.18s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

export default AdminUsersPage;

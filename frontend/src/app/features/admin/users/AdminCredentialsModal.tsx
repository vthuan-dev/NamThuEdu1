import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Eye, EyeOff, Check, Clock, RotateCcw, KeyRound, ShieldCheck, AlertTriangle } from "lucide-react";
import { adminApi } from "../../../../services/adminApi";

interface AdminCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** "create" = sau khi tạo user, "reset" = reset password user hiện có */
  mode?: "create" | "reset";
  userData: {
    name: string;
    phone: string;
    password: string;
    role: "student" | "teacher" | "admin";
    id?: number;
  };
  onPasswordReset?: (newPassword: string) => void;
}

const ROLE_LABEL: Record<"student" | "teacher" | "admin", string> = {
  student: "Học viên",
  teacher: "Giáo viên",
  admin: "Quản trị viên",
};

export function AdminCredentialsModal({
  isOpen,
  onClose,
  userData,
  onPasswordReset,
  mode = "create",
}: AdminCredentialsModalProps) {
  const [timeLeft, setTimeLeft] = useState(10);
  const [showPassword, setShowPassword] = useState(true);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [currentPassword, setCurrentPassword] = useState(userData.password);
  const [confirmReset, setConfirmReset] = useState(false);

  // Sync khi userData.password đổi (sau khi reset từ ngoài)
  useEffect(() => {
    setCurrentPassword(userData.password);
  }, [userData.password]);

  // Countdown 10s tự động ẩn password
  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(10);
      setShowPassword(true);
      setCopiedPhone(false);
      setCopiedPassword(false);
      setConfirmReset(false);
      return;
    }
    if (!currentPassword) return;

    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setShowPassword(false);
          clearInterval(t);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [isOpen, currentPassword]);

  const copy = async (text: string, type: "phone" | "password") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "phone") {
        setCopiedPhone(true);
        setTimeout(() => setCopiedPhone(false), 1800);
      } else {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 1800);
      }
    } catch {
      // ignore
    }
  };

  const handleReset = async () => {
    if (!userData.id) return;
    setIsResetting(true);
    try {
      const result = await adminApi.resetUserPassword(userData.id);
      if (result.status === "success" && result.data?.new_password) {
        const np = result.data.new_password;
        setCurrentPassword(np);
        onPasswordReset?.(np);
        setShowPassword(true);
        setTimeLeft(10);
        setConfirmReset(false);
      }
    } catch (err) {
      console.error("Reset password failed", err);
      alert("Không reset được mật khẩu. Vui lòng thử lại.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(2px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white"
            style={{
              boxShadow: "0 20px 60px rgba(15,23,42,0.18)",
              border: "1px solid #E2E8F0",
            }}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* ── Header ── */}
            <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900">
                  {mode === "reset" ? (
                    <KeyRound className="h-5 w-5 text-white" />
                  ) : (
                    <ShieldCheck className="h-5 w-5 text-white" />
                  )}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">
                    {mode === "reset" ? "Reset mật khẩu" : "Tạo tài khoản thành công"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {ROLE_LABEL[userData.role]} • {userData.name}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ── Body ── */}
            <div className="px-6 py-5 space-y-4">
              {/* Phone (Username) */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Tên đăng nhập
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-slate-900">
                    {userData.phone}
                  </div>
                  <button
                    onClick={() => copy(userData.phone, "phone")}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
                      copiedPhone
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {copiedPhone ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedPhone ? "Đã copy" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Mật khẩu
                  </label>
                  {currentPassword && showPassword && timeLeft > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      <Clock className="h-3 w-3" />
                      Ẩn sau {timeLeft}s
                    </span>
                  )}
                </div>

                {isResetting ? (
                  <div className="px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2.5 text-sm text-slate-600">
                    <RotateCcw className="h-4 w-4 animate-spin text-slate-500" />
                    Đang tạo mật khẩu mới…
                  </div>
                ) : currentPassword && showPassword ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-slate-900 flex items-center justify-between">
                      <span>{currentPassword}</span>
                      <button
                        onClick={() => setShowPassword(false)}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                        aria-label="Ẩn mật khẩu"
                      >
                        <EyeOff className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => copy(currentPassword, "password")}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
                        copiedPassword
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-slate-900 border-slate-900 text-white hover:bg-slate-800"
                      }`}
                    >
                      {copiedPassword ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedPassword ? "Đã copy" : "Copy"}
                    </button>
                  </div>
                ) : currentPassword && !showPassword ? (
                  <div className="px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2.5">
                    <EyeOff className="h-4 w-4 text-slate-400" />
                    <p className="flex-1 text-sm text-slate-600">Mật khẩu đã ẩn vì lý do bảo mật</p>
                    <button
                      onClick={() => setShowPassword(true)}
                      className="text-xs font-medium text-slate-700 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Hiện
                    </button>
                  </div>
                ) : (
                  <div className="px-3.5 py-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Chưa reset mật khẩu. Nhấn nút bên dưới để tạo mật khẩu ngẫu nhiên mới.
                      <br />
                      <span className="text-amber-700">Mật khẩu cũ sẽ bị thay thế và không khôi phục được.</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Reset Action */}
              {userData.id && (
                <div>
                  {confirmReset ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                      <p className="text-xs font-semibold text-rose-800 mb-2">
                        Xác nhận tạo mật khẩu mới?
                      </p>
                      <p className="text-[11px] text-rose-700 mb-3 leading-relaxed">
                        Mật khẩu hiện tại của <strong>{userData.name}</strong> sẽ bị thay thế ngay lập tức.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleReset}
                          disabled={isResetting}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <RotateCcw className={`h-3.5 w-3.5 ${isResetting ? "animate-spin" : ""}`} />
                          {isResetting ? "Đang tạo…" : "Xác nhận reset"}
                        </button>
                        <button
                          onClick={() => setConfirmReset(false)}
                          disabled={isResetting}
                          className="px-3 py-2 rounded-lg border border-rose-200 bg-white text-rose-700 text-xs font-semibold hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          Huỷ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmReset(true)}
                      disabled={isResetting}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <RotateCcw className="h-4 w-4" />
                      {currentPassword ? "Tạo mật khẩu khác" : "Reset mật khẩu"}
                    </button>
                  )}
                </div>
              )}

              {/* Lưu ý — gọn, ít màu */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
                <p className="text-[11px] font-semibold text-slate-700 mb-1">Lưu ý</p>
                <ul className="text-[11px] text-slate-600 space-y-1 leading-relaxed">
                  <li>• Mật khẩu chỉ hiển thị 1 lần. Hãy copy và gửi cho người dùng ngay.</li>
                  <li>• Người dùng nên đổi mật khẩu sau lần đăng nhập đầu tiên.</li>
                </ul>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex justify-end px-6 py-3.5 bg-slate-50 border-t border-slate-100">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

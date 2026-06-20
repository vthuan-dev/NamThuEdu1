import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Eye, EyeOff, CheckCircle2, Clock, RotateCcw } from "lucide-react";
import { adminApi } from "../../../../services/adminApi";

interface AdminCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: "create" | "reset"; // "create" = after creating user, "reset" = reset existing user password
  userData: {
    name: string;
    phone: string;
    password: string;
    role: "student" | "teacher" | "admin";
    id?: number;
  };
  onPasswordReset?: (newPassword: string) => void;
}

export function AdminCredentialsModal({ isOpen, onClose, userData, onPasswordReset, mode = "create" }: AdminCredentialsModalProps) {
  const [timeLeft, setTimeLeft] = useState(10);
  const [showPassword, setShowPassword] = useState(true);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState(userData.password);

  // Sync currentPassword when userData changes (e.g., after reset)
  useEffect(() => {
    setCurrentPassword(userData.password);
  }, [userData.password]);

  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(10);
      setShowPassword(true);
      setCopiedPhone(false);
      setCopiedPassword(false);
      return;
    }

    // In "reset" mode, auto-trigger reset on open if no password yet
    if (mode === "reset" && !currentPassword) {
      handleResetPassword();
      return;
    }

    // Countdown timer
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setShowPassword(false);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode]);

  const handleCopy = async (text: string, type: 'phone' | 'password') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'phone') {
        setCopiedPhone(true);
        setTimeout(() => setCopiedPhone(false), 2000);
      } else {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleResetPassword = async () => {
    if (!userData.id) return;
    
    setIsResettingPassword(true);
    
    try {
      const result = await adminApi.resetUserPassword(userData.id);
      if (result.status === 'success' && result.data?.new_password) {
        const newPassword = result.data.new_password;
        
        // Update local password display
        setCurrentPassword(newPassword);
        if (onPasswordReset) {
          onPasswordReset(newPassword);
        }
        
        // Show password and restart timer
        setShowPassword(true);
        setTimeLeft(10);
        
        // Start countdown
        const timer = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              setShowPassword(false);
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Lỗi khi reset mật khẩu');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const getRoleLabel = () => {
    switch (userData.role) {
      case "teacher": return "Giáo viên";
      case "admin": return "Quản trị viên";
      default: return "Học viên";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-white/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl"
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className={`p-6 text-white ${mode === "reset" ? "bg-gradient-to-r from-[#7C3AED] to-[#DB2777]" : "bg-gradient-to-r from-[#6366F1] to-[#8B5CF6]"}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    {mode === "reset" ? (
                      <RotateCcw className="w-6 h-6" />
                    ) : (
                      <CheckCircle2 className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">
                      {mode === "reset" ? "Reset mật khẩu" : "Tạo tài khoản thành công!"}
                    </h2>
                    <p className="text-sm text-white/90">
                      {mode === "reset" ? "Tạo mật khẩu mới ngẫu nhiên" : "Thông tin đăng nhập người dùng"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* User Info */}
              <div className="mb-6 p-4 bg-[#F0F9FF] rounded-lg border border-[#BAE6FD]">
                <p className="text-sm text-[#0369A1] mb-1">{getRoleLabel()}</p>
                <p className="text-lg font-bold text-[#111827]">{userData.name}</p>
              </div>

              {/* Login Credentials */}
              <div className="space-y-4">
                {/* Phone Number (Username) */}
                <div>
                  <label className="block text-sm font-medium text-[#6B7280] mb-2">
                    Tên đăng nhập (Số điện thoại)
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg font-mono text-[#111827]">
                      {userData.phone}
                    </div>
                    <button
                      onClick={() => handleCopy(userData.phone, 'phone')}
                      className={`px-4 py-3 rounded-lg transition-colors font-medium flex items-center gap-2 ${
                        copiedPhone
                          ? 'bg-[#10B981] text-white'
                          : 'bg-[#6366F1] text-white hover:bg-[#4F46E5]'
                      }`}
                    >
                      {copiedPhone ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Đã copy
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-[#6B7280]">
                      Mật khẩu
                    </label>
                    {showPassword && timeLeft > 0 && (
                      <div className="flex items-center gap-1 text-[#6366F1] text-sm font-medium">
                        <Clock className="w-4 h-4" />
                        <span>Ẩn sau {timeLeft}s</span>
                      </div>
                    )}
                  </div>
                  
                  {isResettingPassword ? (
                    <div className="px-4 py-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg flex items-center gap-3">
                      <RotateCcw className="w-5 h-5 text-[#3B82F6] animate-spin" />
                      <p className="text-sm font-medium text-[#1D4ED8]">Đang tạo mật khẩu mới...</p>
                    </div>
                  ) : currentPassword && showPassword ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg font-mono text-[#111827] flex items-center justify-between">
                        <span>{currentPassword}</span>
                        <button
                          onClick={() => setShowPassword(false)}
                          className="text-[#6B7280] hover:text-[#111827]"
                        >
                          <EyeOff className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        onClick={() => handleCopy(currentPassword, 'password')}
                        className={`px-4 py-3 rounded-lg transition-colors font-medium flex items-center gap-2 ${
                          copiedPassword
                            ? 'bg-[#10B981] text-white'
                            : 'bg-[#6366F1] text-white hover:bg-[#4F46E5]'
                        }`}
                      >
                        {copiedPassword ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Đã copy
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  ) : currentPassword && !showPassword ? (
                    <div className="px-4 py-3 bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg flex items-center gap-3">
                      <EyeOff className="w-5 h-5 text-[#DC2626]" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#DC2626]">Mật khẩu đã bị ẩn</p>
                        <p className="text-xs text-[#991B1B]">Vì lý do bảo mật, mật khẩu chỉ hiển thị 1 lần</p>
                      </div>
                      <button
                        onClick={() => setShowPassword(true)}
                        className="px-3 py-1.5 bg-[#DC2626] text-white rounded-lg hover:bg-[#B91C1C] text-sm font-medium flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        Hiện
                      </button>
                    </div>
                  ) : (
                    <div className="px-4 py-3 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg flex items-center gap-3">
                      <RotateCcw className="w-5 h-5 text-[#6B7280]" />
                      <p className="text-sm text-[#6B7280]">Chưa có mật khẩu — nhấn Reset để tạo mới</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Reset Password Section */}
              {userData.id && (
                <div className="mt-4">
                  <button
                    onClick={handleResetPassword}
                    disabled={isResettingPassword}
                    className={`w-full px-4 py-3 text-white rounded-lg transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                      mode === "reset"
                        ? "bg-gradient-to-r from-[#7C3AED] to-[#DB2777] hover:from-[#6D28D9] hover:to-[#BE185D]"
                        : "bg-gradient-to-r from-[#F59E0B] to-[#F97316] hover:from-[#D97706] hover:to-[#EA580C]"
                    }`}
                  >
                    <RotateCcw className={`w-4 h-4 ${isResettingPassword ? 'animate-spin' : ''}`} />
                    {isResettingPassword ? 'Đang tạo mật khẩu mới...' : 'Reset mật khẩu (tạo mật khẩu mới ngẫu nhiên)'}
                  </button>
                  <p className="text-xs text-[#6B7280] mt-2 text-center">
                    {mode === "reset"
                      ? "Tạo mật khẩu ngẫu nhiên mới cho người dùng này"
                      : "Khi người dùng quên mật khẩu, bạn có thể reset về mật khẩu ngẫu nhiên mới"}
                  </p>
                </div>
              )}

              {/* Warning Message */}
              <div className="mt-6 p-4 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#F59E0B] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#92400E] mb-1">
                      Lưu ý quan trọng
                    </p>
                    <ul className="text-xs text-[#92400E] space-y-1">
                      <li>• Hãy copy và gửi thông tin đăng nhập cho người dùng ngay</li>
                      <li>• Mật khẩu chỉ hiển thị 1 lần duy nhất vì lý do bảo mật</li>
                      <li>• Người dùng nên đổi mật khẩu sau lần đăng nhập đầu tiên</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#E5E7EB] flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-[#6366F1] text-white rounded-lg hover:bg-[#4F46E5] transition-colors font-medium"
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

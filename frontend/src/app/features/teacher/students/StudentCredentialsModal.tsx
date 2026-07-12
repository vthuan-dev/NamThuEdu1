import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Eye, EyeOff, CheckCircle2, Clock, RotateCcw, KeyRound } from "lucide-react";
import { getApiUrl } from "../../../../utils/apiConfig";
import { getAuthToken } from "../../../../utils/authStorage";

interface StudentCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** "create" = after create, "reset" = view/reset existing student */
  mode?: "create" | "reset";
  studentData: {
    name: string;
    phone: string;
    password: string;
    id?: number;
  };
  onPasswordReset?: (newPassword: string) => void;
}

export function StudentCredentialsModal({
  isOpen,
  onClose,
  studentData,
  onPasswordReset,
  mode = "create",
}: StudentCredentialsModalProps) {
  const [timeLeft, setTimeLeft] = useState(10);
  const [showPassword, setShowPassword] = useState(true);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState(studentData.password || "");
  const [confirmReset, setConfirmReset] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync password from parent when modal opens / password changes
  useEffect(() => {
    setCurrentPassword(studentData.password || "");
  }, [studentData.password, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(10);
      setShowPassword(true);
      setCopiedPhone(false);
      setCopiedPassword(false);
      setConfirmReset(false);
      setErrorMsg(null);
      return;
    }

    if (!currentPassword) {
      setShowPassword(false);
      return;
    }

    setShowPassword(true);
    setTimeLeft(10);

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
  }, [isOpen, currentPassword]);

  const handleCopy = async (text: string, type: "phone" | "password") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "phone") {
        setCopiedPhone(true);
        setTimeout(() => setCopiedPhone(false), 2000);
      } else {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleResetPassword = async () => {
    if (!studentData.id) return;

    setIsResettingPassword(true);
    setErrorMsg(null);

    try {
      const token = getAuthToken();
      // No body needed — backend defaults to "user123"
      const response = await fetch(getApiUrl(`teacher/student/${studentData.id}/reset-password`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({}),
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok && result.status === "success") {
        const newPassword = result.data?.new_password || "user123";
        setCurrentPassword(newPassword);
        onPasswordReset?.(newPassword);
        setShowPassword(true);
        setTimeLeft(10);
        setConfirmReset(false);
      } else {
        setErrorMsg(result.message || "Không thể reset mật khẩu");
      }
    } catch (error) {
      console.error("Error resetting password:", error);
      setErrorMsg("Lỗi khi reset mật khẩu");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const title =
    mode === "reset"
      ? "Thông tin đăng nhập học viên"
      : "Tạo tài khoản thành công!";
  const subtitle =
    mode === "reset"
      ? "Xem lại / reset mật khẩu học viên"
      : "Thông tin đăng nhập học viên";

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
            <div className="bg-gradient-to-r from-[#EA580C] to-[#F97316] p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    {mode === "reset" ? (
                      <KeyRound className="w-6 h-6" />
                    ) : (
                      <CheckCircle2 className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{title}</h2>
                    <p className="text-sm text-white/90">{subtitle}</p>
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
              {/* Student Name */}
              <div className="mb-6 p-4 bg-[#FFF7ED] rounded-lg border border-[#FDBA74]">
                <p className="text-sm text-[#C2410C] mb-1">Học viên</p>
                <p className="text-lg font-bold text-[#111827]">{studentData.name}</p>
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
                      {studentData.phone}
                    </div>
                    <button
                      onClick={() => handleCopy(studentData.phone, "phone")}
                      className={`px-4 py-3 rounded-lg transition-colors font-medium flex items-center gap-2 ${
                        copiedPhone
                          ? "bg-[#10B981] text-white"
                          : "bg-[#EA580C] text-white hover:bg-[#C2410C]"
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
                    {currentPassword && showPassword && timeLeft > 0 && (
                      <div className="flex items-center gap-1 text-[#EA580C] text-sm font-medium">
                        <Clock className="w-4 h-4" />
                        <span>Ẩn sau {timeLeft}s</span>
                      </div>
                    )}
                  </div>

                  {isResettingPassword ? (
                    <div className="px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg flex items-center gap-2 text-sm text-[#6B7280]">
                      <RotateCcw className="w-4 h-4 animate-spin" />
                      Đang reset mật khẩu về user123…
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
                        onClick={() => handleCopy(currentPassword, "password")}
                        className={`px-4 py-3 rounded-lg transition-colors font-medium flex items-center gap-2 ${
                          copiedPassword
                            ? "bg-[#10B981] text-white"
                            : "bg-[#EA580C] text-white hover:bg-[#C2410C]"
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
                        <p className="text-xs text-[#991B1B]">
                          Có thể hiện lại hoặc reset về user123
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setShowPassword(true);
                          setTimeLeft(10);
                        }}
                        className="px-3 py-1.5 bg-[#DC2626] text-white rounded-lg hover:bg-[#B91C1C] text-sm font-medium flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        Hiện lại
                      </button>
                    </div>
                  ) : (
                    <div className="px-4 py-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg text-sm text-[#92400E]">
                      Chưa có mật khẩu để xem. Nhấn reset để đặt về{" "}
                      <span className="font-semibold">user123</span>.
                    </div>
                  )}
                </div>
              </div>

              {errorMsg && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {errorMsg}
                </div>
              )}

              {/* Reset Password Section */}
              {studentData.id && (
                <div className="mt-4">
                  {confirmReset ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-semibold text-amber-900 mb-1">
                        Xác nhận reset mật khẩu?
                      </p>
                      <p className="text-xs text-amber-800 mb-3">
                        Mật khẩu của <strong>{studentData.name}</strong> sẽ được đặt về{" "}
                        <strong>user123</strong>.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleResetPassword}
                          disabled={isResettingPassword}
                          className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#F59E0B] to-[#F97316] text-white rounded-lg hover:from-[#D97706] hover:to-[#EA580C] transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <RotateCcw className={`w-4 h-4 ${isResettingPassword ? "animate-spin" : ""}`} />
                          {isResettingPassword ? "Đang reset..." : "Xác nhận → user123"}
                        </button>
                        <button
                          onClick={() => setConfirmReset(false)}
                          disabled={isResettingPassword}
                          className="px-4 py-2.5 border border-amber-200 bg-white text-amber-800 rounded-lg text-sm font-medium"
                        >
                          Huỷ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setConfirmReset(true)}
                        disabled={isResettingPassword}
                        className="w-full px-4 py-3 bg-gradient-to-r from-[#F59E0B] to-[#F97316] text-white rounded-lg hover:from-[#D97706] hover:to-[#EA580C] transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RotateCcw className={`w-4 h-4 ${isResettingPassword ? "animate-spin" : ""}`} />
                        Reset mật khẩu về &quot;user123&quot;
                      </button>
                      <p className="text-xs text-[#6B7280] mt-2 text-center">
                        Khi học viên quên mật khẩu, bạn có thể reset về mật khẩu mặc định và xem lại
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Warning Message */}
              <div className="mt-6 p-4 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#F59E0B] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#92400E] mb-1">Lưu ý quan trọng</p>
                    <ul className="text-xs text-[#92400E] space-y-1">
                      <li>• Hãy copy và gửi thông tin đăng nhập cho học viên ngay</li>
                      <li>• Reset sẽ đặt mật khẩu về <strong>user123</strong></li>
                      <li>• Học viên nên đổi mật khẩu sau lần đăng nhập đầu tiên</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#E5E7EB] flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-[#EA580C] text-white rounded-lg hover:bg-[#C2410C] transition-colors font-medium"
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

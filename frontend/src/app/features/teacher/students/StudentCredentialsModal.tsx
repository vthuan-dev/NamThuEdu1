import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Eye, EyeOff, CheckCircle2, Clock, RotateCcw } from "lucide-react";
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
      : "Tạo tài khoản thành công";
  const subtitle =
    mode === "reset"
      ? "Xem lại hoặc reset mật khẩu học viên"
      : "Thông tin đăng nhập của học viên";

  /*
   * Thiết kế tối giản:
   *  - Bỏ dải gradient cam ở header, bỏ khung cam quanh tên học viên, bỏ khung
   *    vàng "Lưu ý" và khung đỏ khi ẩn mật khẩu. Bản cũ dùng 5 màu nền khác nhau
   *    (cam / vàng / đỏ / xám / xanh) khiến mắt không biết nhìn đâu trước.
   *  - Nền xám trung tính cho các ô dữ liệu, chữ đậm nhạt để phân cấp.
   *  - Chỉ giữ ĐÚNG MỘT chỗ dùng màu nhấn: nút "Đã hiểu". Các nút phụ (Copy,
   *    Reset) chuyển sang dạng viền để không cạnh tranh với nút chính.
   *  - Màu chỉ còn mang nghĩa: xanh = vừa copy xong, đỏ = lỗi.
   */
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            className="bg-white rounded-xl max-w-md w-full overflow-hidden border border-slate-200 shadow-xl"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-credentials-title"
          >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-slate-100">
              <div>
                <h2
                  id="student-credentials-title"
                  className="text-base font-semibold text-slate-900"
                >
                  {title}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Đóng"
                className="-mr-1.5 -mt-1 w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5">
              {/* Tên học viên — một dòng thông tin, không cần khung riêng */}
              <div className="pb-4 mb-4 border-b border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Học viên</p>
                <p className="text-[15px] font-semibold text-slate-900">{studentData.name}</p>
              </div>

              <div className="space-y-4">
                {/* ── Tên đăng nhập ───────────────────────────────────────── */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Tên đăng nhập (Số điện thoại)
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-slate-900">
                      {studentData.phone}
                    </div>
                    <button
                      onClick={() => handleCopy(studentData.phone, "phone")}
                      aria-label="Copy số điện thoại"
                      className="px-3 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-sm font-medium flex items-center gap-1.5 flex-shrink-0"
                    >
                      {copiedPhone ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="text-emerald-700">Đã copy</span>
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

                {/* ── Mật khẩu ────────────────────────────────────────────── */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-500">Mật khẩu</label>
                    {currentPassword && showPassword && timeLeft > 0 && (
                      <span className="flex items-center gap-1 text-xs text-slate-400 tabular-nums">
                        <Clock className="w-3.5 h-3.5" />
                        Ẩn sau {timeLeft}s
                      </span>
                    )}
                  </div>

                  {isResettingPassword ? (
                    <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-sm text-slate-500">
                      <RotateCcw className="w-4 h-4 animate-spin" />
                      Đang reset mật khẩu…
                    </div>
                  ) : currentPassword && showPassword ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-slate-900 flex items-center justify-between gap-2">
                        <span>{currentPassword}</span>
                        <button
                          onClick={() => setShowPassword(false)}
                          aria-label="Ẩn mật khẩu"
                          className="text-slate-400 hover:text-slate-700 transition-colors"
                        >
                          <EyeOff className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        onClick={() => handleCopy(currentPassword, "password")}
                        aria-label="Copy mật khẩu"
                        className="px-3 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-sm font-medium flex items-center gap-1.5 flex-shrink-0"
                      >
                        {copiedPassword ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span className="text-emerald-700">Đã copy</span>
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
                    /* Ẩn mật khẩu là hành vi bình thường của tính năng, không phải
                       lỗi — nên dùng màu trung tính thay cho nền đỏ như bản cũ. */
                    <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm text-slate-500">
                        <EyeOff className="w-4 h-4 text-slate-400" />
                        Đã ẩn để bảo mật
                      </span>
                      <button
                        onClick={() => {
                          setShowPassword(true);
                          setTimeLeft(10);
                        }}
                        className="text-sm font-medium text-slate-700 hover:text-slate-900 flex items-center gap-1 flex-shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Hiện lại
                      </button>
                    </div>
                  ) : (
                    <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500">
                      Chưa có mật khẩu để xem. Nhấn reset để đặt về{" "}
                      <span className="font-mono text-slate-700">user123</span>.
                    </div>
                  )}
                </div>
              </div>

              {errorMsg && <p className="mt-3 text-sm text-red-600">{errorMsg}</p>}

              {/* ── Reset mật khẩu (hành động phụ → nút dạng viền) ────────── */}
              {studentData.id && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  {confirmReset ? (
                    <div>
                      <p className="text-sm text-slate-700 mb-3">
                        Đặt lại mật khẩu của{" "}
                        <strong className="font-semibold">{studentData.name}</strong> về{" "}
                        <span className="font-mono text-slate-900">user123</span>?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleResetPassword}
                          disabled={isResettingPassword}
                          className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <RotateCcw
                            className={`w-3.5 h-3.5 ${isResettingPassword ? "animate-spin" : ""}`}
                          />
                          {isResettingPassword ? "Đang reset…" : "Xác nhận"}
                        </button>
                        <button
                          onClick={() => setConfirmReset(false)}
                          disabled={isResettingPassword}
                          className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                          Huỷ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmReset(true)}
                      disabled={isResettingPassword}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset mật khẩu về mặc định
                    </button>
                  )}
                </div>
              )}

              {/* Gộp 3 gạch đầu dòng của bản cũ thành một câu ngắn */}
              <p className="mt-4 text-xs text-slate-500 leading-relaxed">
                Hãy gửi thông tin này cho học viên và nhắc các em đổi mật khẩu sau lần
                đăng nhập đầu tiên.
              </p>
            </div>

            {/* ── Footer: đúng một nút chính dùng màu nhấn ──────────────── */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-[#EA580C] text-white rounded-lg hover:bg-[#C2410C] transition-colors text-sm font-medium"
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

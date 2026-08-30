import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  onClose: (id: string) => void;
}

// Mặc định 3000ms cho khớp `useToast.showToast` — trước đây chỗ này để 3500ms,
// nên khi gọi mà không truyền duration thì thanh tiến trình và hiệu ứng shimmer
// chạy theo 3500ms trong khi toast bị xoá ở 3000ms: thanh chưa đầy đã mất.
export function Toast({ id, type, message, duration = 3000, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onClose(id), 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(id), 300);
  };

  const config = {
    success: {
      icon: <CheckCircle2 className="w-5 h-5" strokeWidth={2.5} />,
      iconBg: "bg-gradient-to-br from-emerald-400 to-green-600",
      iconRing: "ring-emerald-200",
      title: "Thành công",
      glow: "shadow-emerald-500/20",
    },
    error: {
      icon: <XCircle className="w-5 h-5" strokeWidth={2.5} />,
      iconBg: "bg-gradient-to-br from-red-500 to-rose-600",
      iconRing: "ring-red-200",
      title: "Lỗi",
      glow: "shadow-red-500/20",
    },
    warning: {
      icon: <AlertCircle className="w-5 h-5" strokeWidth={2.5} />,
      iconBg: "bg-gradient-to-br from-amber-400 to-orange-500",
      iconRing: "ring-amber-200",
      title: "Cảnh báo",
      glow: "shadow-amber-500/20",
    },
    info: {
      icon: <Info className="w-5 h-5" strokeWidth={2.5} />,
      iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
      iconRing: "ring-blue-200",
      title: "Thông báo",
      glow: "shadow-blue-500/20",
    },
  };

  const style = config[type];

  return (
    <div
      className={`
        relative overflow-hidden
        bg-white/95 backdrop-blur-md
        rounded-2xl border border-gray-200/80
        shadow-xl ${style.glow}
        transition-all duration-300 ease-out
        w-full sm:w-auto sm:min-w-[340px] sm:max-w-[420px]
        ${isExiting
          ? "animate-[slideOutLeft_300ms_ease-in_forwards] opacity-0 -translate-x-12"
          : "animate-[slideInLeft_400ms_cubic-bezier(0.16,1,0.3,1)]"
        }
      `}
      role={type === "error" ? "alert" : "status"}
    >
      {/* Animated gradient top bar */}
      <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden">
        <div className={`h-full ${style.iconBg} opacity-90`} />
        <div
          className={`absolute top-0 left-0 h-full bg-gradient-to-r from-white/0 via-white/60 to-white/0 w-1/3`}
          style={{
            animation: `shimmer ${duration}ms linear forwards`,
          }}
        />
      </div>

      {/* Progress bar (bottom) */}
      <div className="absolute bottom-0 left-0 h-0.5 bg-gray-100 w-full overflow-hidden">
        <div
          className={`h-full ${style.iconBg}`}
          style={{
            animation: `shrink ${duration}ms linear forwards`,
            transformOrigin: "left",
          }}
        />
      </div>

      <div className="flex items-start gap-3 p-4 pt-5">
        {/* Icon with pulse ring */}
        <div className="relative flex-shrink-0">
          <div
            className={`absolute inset-0 ${style.iconBg} rounded-2xl opacity-30 animate-ping`}
            style={{ animationDuration: "2s" }}
          />
          <div
            className={`relative w-10 h-10 ${style.iconBg} text-white rounded-2xl flex items-center justify-center shadow-lg ring-4 ${style.iconRing}`}
          >
            {style.icon}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm font-bold text-gray-900 leading-tight">
            {style.title}
          </p>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all active:scale-90"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

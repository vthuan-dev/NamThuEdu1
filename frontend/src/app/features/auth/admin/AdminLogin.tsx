import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { login } from "../../../../services/authApi";
import { setAuthData, clearAuthData } from "../../../../utils/authStorage";
import { Eye, EyeOff, AlertCircle, AlertTriangle } from "lucide-react";
import "../../../../styles/loginAnimations.css";

function AdminLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const maintenanceMsg = searchParams.get('message');
  const isMaintenance = searchParams.get('maintenance') === '1';

  const [error, setError] = useState<string | null>(maintenanceMsg);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [toast, setToast] = useState<{msg: string; show: boolean} | null>(null);
  const [sysStats, setSysStats] = useState<{ students: number; teachers: number; courses: number; exams: number } | null>(null);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [now, setNow] = useState<string>("");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setNow(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    import("../../../../services/api").then(({ api }) => {
      api.get<{ status: string; data: { students: number; teachers: number; courses: number; exams: number } }>("/public/stats")
        .then(r => setSysStats(r.data.data))
        .catch(() => {});
      api.get("/health")
        .then(() => setServerOk(true))
        .catch(() => setServerOk(false));
    });
  }, []);

  useEffect(() => {
    if (isMaintenance && maintenanceMsg) {
      setToast({ msg: decodeURIComponent(maintenanceMsg), show: true });
      const timer = setTimeout(() => {
        setToast(prev => prev ? { ...prev, show: false } : null);
      }, 5000);
      const clearTimer = setTimeout(() => setToast(null), 5500);
      return () => {
        clearTimeout(timer);
        clearTimeout(clearTimer);
      };
    }
  }, [isMaintenance, maintenanceMsg]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Dọn phiên admin cũ TRƯỚC khi đăng nhập để không lẫn dữ liệu người trước.
    clearAuthData('admin');

    try {
      const response = await login({ phone: phone.trim(), password });
      const { access_token, user } = response.data;
      if (user.role !== "admin") {
        clearAuthData('admin');
        setError(t("auth.adminLogin.errors.notAdmin"));
        return;
      }
      // setAuthData tự chọn ô lưu theo user.role, và tự chọn localStorage hay
      // sessionStorage theo rememberMe.
      setAuthData(access_token, user as unknown as Record<string, unknown>, rememberMe);
      
      // Success animation sequence
      setLoginSuccess(true);
      
      // Wait for success animation to complete
      setTimeout(() => {
        setFadeOut(true);
      }, 800);
      
      // Navigate after fade out
      setTimeout(() => {
        navigate("/admin");
      }, 1100);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || t("auth.adminLogin.errors.failed"));
      } else {
        setError(t("auth.adminLogin.errors.failed"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const p = "auth.adminLogin.panel";
  const modules = t(`${p}.modules`, { returnObjects: true }) as Array<{ label: string; sub?: string; tag: string; tagOffline?: string }>;

  const metrics = [
    {
      label: modules && modules[0] ? modules[0].label : "USERS",
      value: sysStats ? sysStats.students.toLocaleString() : "—",
      sub: sysStats ? t(`${p}.statsUsers`, { students: sysStats.students.toLocaleString(), teachers: sysStats.teachers }) : t(`${p}.loading`),
    },
    {
      label: modules && modules[1] ? modules[1].label : "PLATFORM",
      value: sysStats ? String(sysStats.courses) : "—",
      sub: sysStats ? t(`${p}.statsCourses`, { courses: sysStats.courses, exams: sysStats.exams }) : t(`${p}.loading`),
    },
    {
      label: modules && modules[2] ? modules[2].label : "SECURITY",
      value: "RBAC",
      sub: modules && modules[2] && modules[2].sub ? modules[2].sub : "JWT · RBAC · HTTPS",
    },
    {
      label: modules && modules[3] ? modules[3].label : "PERFORMANCE",
      value: serverOk === null ? "…" : serverOk ? "200" : "503",
      sub: serverOk === null ? t(`${p}.checking`) : serverOk ? t(`${p}.apiOnline`) : t(`${p}.apiOffline`),
    },
  ];

  return (
    <div 
      className="min-h-screen flex bg-zinc-50 font-sans text-zinc-900 selection:bg-zinc-200 relative"
      style={{
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 300ms ease-out"
      }}
    >
      {/* Maintenance Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[9999] flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg transition-all duration-500 ${
            toast.show ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
          }`}
          style={{ maxWidth: 380 }}
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-bold text-amber-800">Hệ thống đang bảo trì</p>
            <p className="text-xs text-amber-700">{toast.msg}</p>
          </div>
        </div>
      )}
      {/* Success Overlay */}
      {loginSuccess && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            animation: "fadeIn 300ms ease-out"
          }}
        >
          <div className="flex flex-col items-center gap-4">
            {/* Animated Checkmark */}
            <div 
              className="relative"
              style={{
                width: "80px",
                height: "80px",
                animation: "scaleIn 400ms ease-out"
              }}
            >
              <svg viewBox="0 0 80 80" className="w-full h-full">
                {/* Circle */}
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="4"
                  style={{
                    strokeDasharray: "226",
                    strokeDashoffset: "226",
                    animation: "drawCircle 600ms ease-out forwards"
                  }}
                />
                {/* Checkmark */}
                <path
                  d="M 25 40 L 35 50 L 55 30"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    strokeDasharray: "50",
                    strokeDashoffset: "50",
                    animation: "drawCheck 400ms ease-out 300ms forwards"
                  }}
                />
              </svg>
            </div>
            
            {/* Success Text */}
            <div 
              className="text-center"
              style={{
                animation: "fadeInUp 400ms ease-out 400ms both"
              }}
            >
              <h3 className="text-xl font-bold text-gray-900 mb-1">
                {t("auth.adminLogin.successTitle")}
              </h3>
              <p className="text-sm text-gray-500">
                {t("auth.adminLogin.successRedirecting")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── LEFT — Minimalist Dashboard ─── */}
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-950 text-zinc-400 p-12 flex-col justify-between relative overflow-hidden">
        {/* Deep Tech Backgrounds */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-zinc-900/60 via-zinc-950 to-zinc-950 pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.015] pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(255, 255, 255, 1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 1) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-zinc-900 ring-1 ring-zinc-800/80 flex items-center justify-center shadow-inner shadow-white/5">
              <span className="text-zinc-50 font-medium text-sm tracking-tighter">NE</span>
            </div>
            <div>
              <p className="text-zinc-50 font-medium text-[13px] tracking-tight leading-tight">{t(`${p}.appName`)}</p>
              <p className="font-mono text-[9px] text-zinc-500 tracking-widest uppercase mt-0.5">{t(`${p}.consoleName`)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-zinc-600 tracking-widest">v2.4.0</span>
          </div>
        </div>

        {/* Middle Content */}
        <div className="relative z-10 max-w-[420px] mt-16 mb-auto">
          <h1 className="text-[2rem] font-medium text-zinc-50 tracking-tight leading-tight mb-5">
            {t(`${p}.heroTitle`)}{" "}
            <span className="text-zinc-500 font-normal">{t(`${p}.heroHighlight`)}</span>
          </h1>
          <p className="text-[13px] text-zinc-400 leading-relaxed">
            {t(`${p}.heroDesc`)}
          </p>

          <div className="grid grid-cols-2 gap-x-8 gap-y-12 mt-16">
            {metrics.map((m, i) => (
              <div key={i} className="flex flex-col border-l border-zinc-800/60 pl-4 py-0.5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">{m.label}</p>
                <p className="text-[1.75rem] font-medium text-zinc-50 tabular-nums tracking-tight leading-none mb-1.5">{m.value}</p>
                <p className="text-[11px] text-zinc-500 truncate">{m.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="relative z-10 flex items-center justify-between border-t border-zinc-800/60 pt-6 mt-12 font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
          <p>© {new Date().getFullYear()} {t(`${p}.appName`)}</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${serverOk ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"}`} />
              {serverOk ? "API SECURE" : "API OFFLINE"}
            </span>
            <span className="opacity-50">·</span>
            <span className="tabular-nums opacity-80">{now}</span>
          </div>
        </div>
      </div>

      {/* ─── RIGHT — Login Form ─── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile Header */}
          <div className="lg:hidden mb-12">
            <p className="font-medium text-lg tracking-tight text-zinc-900">{t(`${p}.appName`)}</p>
          </div>

          <div className="mb-10 space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
              {t("auth.adminLogin.title")}
            </h2>
            <p className="text-sm text-zinc-500">
              {t("auth.adminLogin.subtitle")}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded bg-red-50 text-red-800 text-[13px] flex items-start gap-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="leading-relaxed">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="phone" className="block text-[13px] font-medium text-zinc-700">
                {t("auth.adminLogin.phone")}
              </label>
              <input
                type="text"
                id="phone"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-white border border-zinc-200 rounded text-sm outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all placeholder:text-zinc-400"
                placeholder={t("auth.adminLogin.phonePlaceholder")}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-[13px] font-medium text-zinc-700">
                {t("auth.adminLogin.password")}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 pr-10 bg-white border border-zinc-200 rounded text-sm outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all placeholder:text-zinc-400"
                  placeholder={t("auth.adminLogin.passwordPlaceholder")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                />
                <span className="text-[13px] text-zinc-600 group-hover:text-zinc-900 transition-colors">
                  {t("auth.adminLogin.rememberMe")}
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-zinc-900 text-white py-2.5 rounded text-[13px] font-medium hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>{t("auth.adminLogin.authenticating")}</span>
                </>
              ) : (
                <span>{t("auth.adminLogin.loginButton")}</span>
              )}
            </button>
          </form>

          <p className="mt-8 text-[12px] text-zinc-500 text-center max-w-[280px] mx-auto leading-relaxed">
            {t("auth.adminLogin.securityText")}
          </p>
        </div>
      </div>
    </div>
  );
}

export { AdminLogin };
export default AdminLogin;

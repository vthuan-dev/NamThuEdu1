/**
 * Teacher Login Component
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { login } from '../../../../services/authApi';
import { Eye, EyeOff, Phone, Lock, BookOpen, ShieldOff, X, AlertTriangle } from 'lucide-react';
import { Header } from '../../public/components/Header';
import { setAuthData, getRememberedPhone, clearAuthData } from '../../../../utils/authStorage';
import { usePageTitle, PAGE_TITLES } from '../../../../hooks/usePageTitle';
import '../../../../styles/loginAnimations.css';

export function TeacherLogin() {
  usePageTitle(PAGE_TITLES.TEACHER_LOGIN, true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const maintenanceMsg = searchParams.get('message');
  const isMaintenance = searchParams.get('maintenance') === '1';

  useEffect(() => {
    const savedPhone = getRememberedPhone('teacher');
    if (savedPhone) {
      setPhone(savedPhone);
      setRememberMe(true);
    }
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(maintenanceMsg);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [lockedToast, setLockedToast] = useState(false);
  const [toast, setToast] = useState<{msg: string; show: boolean} | null>(null);
  const lockedToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const showLockedToast = () => {
    setLockedToast(true);
    if (lockedToastTimer.current) clearTimeout(lockedToastTimer.current);
    lockedToastTimer.current = setTimeout(() => setLockedToast(false), 6000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // CRITICAL FIX: Clear all old auth data BEFORE logging in to prevent user confusion
    clearAuthData();

    try {
      const response = await login({ phone: phone.trim(), password });
      const { access_token, user } = response.data;

      if (user.role !== 'teacher') {
        clearAuthData();
        setError(t('auth.teacherLogin.errorWrongRole'));
        setIsLoading(false);
        return;
      }

      setAuthData(access_token, user as unknown as Record<string, unknown>, rememberMe);
      
      // Success animation sequence
      setLoginSuccess(true);
      
      // Wait for success animation to complete
      setTimeout(() => {
        setFadeOut(true);
      }, 800);
      
      // Navigate after fade out
      setTimeout(() => {
        navigate('/giao-vien');
      }, 1100);
      
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status  = err.response?.status;
        const msg     = err.response?.data?.message ?? '';
        const isLocked =
          status === 403 ||
          msg.toLowerCase().includes('kho\u00e1') ||
          msg.toLowerCase().includes('locked') ||
          msg.toLowerCase().includes('inactive');

        if (isLocked) {
          showLockedToast();
          setError(null);
        } else {
          setError(msg || t('auth.teacherLogin.errorDefault'));
        }
      } else {
        setError(t('auth.teacherLogin.errorDefault'));
      }
      setPassword('');
      setIsLoading(false);
    }
  };

  return (
    <div
      className="w-full min-h-screen flex flex-col relative"
      style={{ 
        background: 'linear-gradient(145deg, #FFF7ED 0%, #FFEDD5 100%)',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 300ms ease-out'
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
      {/* ── Locked account toast ── */}
      {lockedToast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 flex items-start gap-3 rounded-2xl px-5 py-4 shadow-2xl"
          style={{
            transform: 'translateX(-50%)',
            background: '#1E293B',
            border: '1px solid #334155',
            maxWidth: 420,
            width: 'calc(100vw - 32px)',
            animation: 'fadeInUp 250ms ease-out',
          }}
        >
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: '#EF4444', marginTop: 1 }}>
            <ShieldOff className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC', marginBottom: 3 }}>Tài khoản đã bị khoá</p>
            <p style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.55 }}>
              Tài khoản của bạn hiện không thể đăng nhập. Vui lòng liên hệ quản trị viên để được hỗ trợ mở khoá.
            </p>
            <p style={{ fontSize: 11, color: '#F97316', marginTop: 6, fontWeight: 500 }}>📞 Hotline: 0776 818 160</p>
          </div>
          <button onClick={() => setLockedToast(false)} className="flex-shrink-0 mt-1">
            <X className="h-4 w-4" style={{ color: '#64748B' }} />
          </button>
        </div>
      )}
      {/* Success Overlay */}
      {loginSuccess && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            animation: 'fadeIn 300ms ease-out'
          }}
        >
          <div className="flex flex-col items-center gap-4">
            {/* Animated Checkmark */}
            <div 
              className="relative"
              style={{
                width: '80px',
                height: '80px',
                animation: 'scaleIn 400ms ease-out'
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
                    strokeDasharray: '226',
                    strokeDashoffset: '226',
                    animation: 'drawCircle 600ms ease-out forwards'
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
                    strokeDasharray: '50',
                    strokeDashoffset: '50',
                    animation: 'drawCheck 400ms ease-out 300ms forwards'
                  }}
                />
              </svg>
            </div>
            
            {/* Success Text */}
            <div 
              className="text-center"
              style={{
                animation: 'fadeInUp 400ms ease-out 400ms both'
              }}
            >
              <h3 className="text-xl font-bold text-gray-900 mb-1">
                {t('auth.teacherLogin.successTitle')}
              </h3>
              <p className="text-sm text-gray-500">
                {t('auth.teacherLogin.successRedirecting')}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Full-width Header */}
      <Header />

      {/* Content row */}
      <div className="flex flex-1 bg-white">

        {/* LEFT: Image panel */}
        <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] items-center justify-end pr-4 pl-8 py-8">
          <div className="overflow-hidden" style={{ maxWidth: '645px', width: '100%', borderRadius: '40px' }}>
            {/*
              Cùng lý do như trang đăng nhập học viên: PNG gốc 1857 KB.
              WebP còn 88 KB (màn thường) / 172 KB (Retina), giảm ~95%.
              Khung ở trang này rộng 645px nên `sizes` khai theo đúng số đó.
            */}
            <picture>
              <source
                type="image/webp"
                srcSet="/images/form-login-gv-770.webp 770w, /images/form-login-gv-1540.webp 1540w"
                sizes="(min-width: 1280px) 645px, 52vw"
              />
              <img
                src="/images/form-login-gv.png"
                alt="NamThuEdu - Cổng dành cho giáo viên"
                className="w-full h-auto block"
                width={1254}
                height={1254}
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </picture>
          </div>
        </div>

        {/* RIGHT: Form panel */}
        <div className="flex-1 flex flex-col items-start justify-center px-6 py-10 lg:px-10 xl:px-14">

          <div className="w-full max-w-[460px]">

            {/* Heading */}
            <h1 className="text-3xl font-extrabold text-gray-900 mb-1">{t('auth.teacherLogin.title')}</h1>
            <p className="text-gray-500 text-sm mb-8">{t('auth.teacherLogin.subtitle')}</p>

            {/* Maintenance notification */}
            {isMaintenance && maintenanceMsg && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 animate-fadeIn">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm font-bold text-amber-800">Hệ thống đang bảo trì</p>
                  <p className="text-xs text-amber-700 mt-0.5">{decodeURIComponent(maintenanceMsg)}</p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {t('auth.teacherLogin.phoneLabel')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    autoFocus
                    placeholder={t('auth.teacherLogin.phonePlaceholder')}
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {t('auth.teacherLogin.passwordLabel')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder={t('auth.teacherLogin.passwordPlaceholder')}
                    className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500 transition-colors cursor-pointer"
                    style={{ transition: 'color 0.2s' }}
                  >
                    <span
                      key={showPassword ? 'off' : 'on'}
                      style={{
                        display: 'inline-flex',
                        animation: 'eyeToggle 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
                      }}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </span>
                    <style>{`
                      @keyframes eyeToggle {
                        0%   { opacity: 0; transform: scale(0.5) rotate(-15deg); }
                        100% { opacity: 1; transform: scale(1) rotate(0deg); }
                      }
                    `}</style>
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={() => setRememberMe(v => !v)}
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer ${
                      rememberMe ? 'bg-orange-500' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                      rememberMe ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </div>
                  <span className="text-sm text-gray-600">{t('auth.teacherLogin.rememberMe')}</span>
                </label>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 font-bold text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm"
                style={{
                  background: isLoading ? '#94A3B8' : 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                  boxShadow: isLoading ? 'none' : '0 4px 14px rgba(234, 88, 12, 0.40)',
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(234, 88, 12, 0.45)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(234, 88, 12, 0.40)';
                  }
                }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t('auth.teacherLogin.loggingIn')}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    {t('auth.teacherLogin.loginButton')}
                  </span>
                )}
              </button>
            </form>

            {/* Footer note */}
            <p className="mt-6 text-xs text-center text-gray-400">
              {t('auth.teacherLogin.supportNote')}&nbsp;
              <span className="text-orange-500 font-medium">0776 818 160</span>
            </p>

            {/* Cross-link to student */}
            <p className="mt-4 text-sm text-center text-gray-500">
              {t('auth.teacherLogin.isStudent')}&nbsp;
              <Link to="/dang-nhap" className="text-orange-500 font-semibold hover:underline">
                {t('auth.teacherLogin.studentLoginLink')}
              </Link>
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}

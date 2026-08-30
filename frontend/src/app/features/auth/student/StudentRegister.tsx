/**
 * Enhanced Registration Component
 * 
 * Student registration with improved UX, progress indicator, and animations
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useThemeContext } from '../../../../contexts/ThemeContext';
import { register, RegisterFormData } from '../../../../services/authApi';
import { setAuthData } from '../../../../utils/authStorage';
import { usePageTitle, PAGE_TITLES } from '../../../../hooks/usePageTitle';
import { CheckCircle2, Sparkles, User, Phone, Mail, Lock, Eye, EyeOff } from 'lucide-react';

export function StudentRegister() {
  const navigate = useNavigate();
  const { syncWithAuth } = useThemeContext();
  const { t } = useTranslation();
  usePageTitle(PAGE_TITLES.REGISTER);

  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    phone: '',
    email: '',
    password: '',
    password_confirmation: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    setIsLoading(true);

    try {
      const response = await register(formData);
      const { access_token, user } = response.data;

      // setAuthData ghi cả token, role VÀ user vào ô riêng của vai trò. Trước đây
      // chỉ ghi auth_token + auth_role, thiếu 'user' nên ProtectedRoute không đọc
      // được vai trò và đẩy người vừa đăng ký về lại trang đăng nhập.
      setAuthData(access_token, user as unknown as Record<string, unknown>, true);
      syncWithAuth(user);
      
      // Show success step briefly
      setStep(2);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      navigate('/hoc-vien');
    } catch (err: any) {
      if (err.response?.data?.errors) {
        setFieldErrors(err.response.data.errors);
      }
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full flex items-center justify-center p-2 md:p-4">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-orange-200/40 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-100/40 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>

      <div className="relative w-full max-w-md">
        {step === 1 ? (
          <div className="bg-white rounded-3xl border border-orange-100 p-8 shadow-xl animate-fadeInUp">
            {/* Progress Indicator */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="flex items-center gap-2">
                 <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 flex items-center justify-center text-white text-sm font-bold shadow-lg">
                  1
                </div>
                 <span className="text-slate-700 text-sm font-medium">{t('auth.register.progress.step1')}</span>
              </div>
               <div className="w-12 h-0.5 bg-orange-100" />
              <div className="flex items-center gap-2">
                 <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-300 text-sm font-bold">
                  2
                </div>
                 <span className="text-slate-400 text-sm font-medium">{t('auth.register.progress.step2')}</span>
              </div>
            </div>

            {/* Header */}
            <div className="text-center mb-8">
               <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-full border border-orange-100 mb-4">
                 <Sparkles className="w-4 h-4 text-orange-500" />
                 <span className="text-sm text-orange-700 font-medium">{t('auth.register.createAccount')}</span>
              </div>
               <h2 className="text-3xl font-bold text-slate-900 mb-2">
                {t('auth.register.title')}
              </h2>
               <p className="text-slate-600">
                {t('auth.register.subtitleJourney')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name Input */}
              <div>
                 <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-2">
                  {t('auth.register.name')} <span className="text-red-400">{t('auth.register.required')}</span>
                </label>
                <div className="relative">
                   <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-300" />
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className={`w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur-sm border ${
                      fieldErrors.name ? 'border-red-500' : 'border-white/20'
                     } rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-300 transition-all`}
                    placeholder={t('auth.common.namePlaceholder')}
                  />
                </div>
                {fieldErrors.name && (
                  <p className="mt-1 text-sm text-red-300 flex items-center gap-1">
                    <span>⚠️</span> {fieldErrors.name[0]}
                  </p>
                )}
              </div>

              {/* Phone Input */}
              <div>
                 <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 mb-2">
                  {t('auth.register.phone')} <span className="text-red-400">{t('auth.register.required')}</span>
                </label>
                <div className="relative">
                   <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-300" />
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className={`w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur-sm border ${
                      fieldErrors.phone ? 'border-red-500' : 'border-white/20'
                     } rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-300 transition-all`}
                    placeholder={t('auth.common.phonePlaceholder')}
                  />
                </div>
                {fieldErrors.phone && (
                  <p className="mt-1 text-sm text-red-300 flex items-center gap-1">
                    <span>⚠️</span> {fieldErrors.phone[0]}
                  </p>
                )}
              </div>

              {/* Optional Email Input */}
              <div>
                 <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                  {t('auth.register.emailOptional')}
                </label>
                <div className="relative">
                   <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-300" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email || ''}
                    onChange={handleChange}
                    className={`w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur-sm border ${
                      fieldErrors.email ? 'border-red-500' : 'border-white/20'
                     } rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-300 transition-all`}
                    placeholder={t('auth.common.emailPlaceholder')}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="mt-1 text-sm text-red-300 flex items-center gap-1">
                    <span>⚠️</span> {fieldErrors.email[0]}
                  </p>
                )}
              </div>

              {/* Password Input */}
              <div>
                 <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">
                  {t('auth.register.password')} <span className="text-red-400">{t('auth.register.required')}</span>
                </label>
                <div className="relative">
                   <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-300" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                    className={`w-full pl-12 pr-12 py-3 bg-white/10 backdrop-blur-sm border ${
                      fieldErrors.password ? 'border-red-500' : 'border-white/20'
                     } rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-300 transition-all`}
                    placeholder={t('auth.common.passwordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                     className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-300 hover:text-orange-500 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="mt-1 text-sm text-red-300 flex items-center gap-1">
                    <span>⚠️</span> {fieldErrors.password[0]}
                  </p>
                )}
                 <p className="mt-1 text-xs text-slate-500">{t('auth.register.minPassword')}</p>
              </div>

              {/* Confirm Password Input */}
              <div>
                 <label htmlFor="password_confirmation" className="block text-sm font-semibold text-slate-700 mb-2">
                  {t('auth.register.confirmPassword')} <span className="text-red-400">{t('auth.register.required')}</span>
                </label>
                <div className="relative">
                   <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-300" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="password_confirmation"
                    name="password_confirmation"
                    value={formData.password_confirmation}
                    onChange={handleChange}
                    required
                    minLength={6}
                    className={`w-full pl-12 pr-12 py-3 bg-white/10 backdrop-blur-sm border ${
                      fieldErrors.password_confirmation ? 'border-red-500' : 'border-white/20'
                     } rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-300 transition-all`}
                    placeholder={t('auth.common.passwordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                     className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-300 hover:text-orange-500 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {fieldErrors.password_confirmation && (
                  <p className="mt-1 text-sm text-red-300 flex items-center gap-1">
                    <span>⚠️</span> {fieldErrors.password_confirmation[0]}
                  </p>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl animate-shake">
                  <p className="text-red-200 text-sm flex items-center gap-2">
                    <span>⚠️</span> {error}
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-orange-400 to-amber-400 text-white font-bold rounded-xl hover:shadow-2xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>{t('auth.register.processing')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('auth.register.registerButton')}</span>
                    <Sparkles className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {/* Login Link */}
            <div className="mt-6 text-center">
              <p className="text-slate-600">
                {t('auth.register.hasAccount')}{' '}
                <Link 
                  to="/dang-nhap" 
                  className="text-orange-600 font-bold hover:text-orange-700 transition-colors underline"
                >
                  {t('auth.register.loginNow')}
                </Link>
              </p>
            </div>
          </div>
        ) : (
          // Success Step
          <div className="bg-white rounded-3xl border border-orange-100 p-12 shadow-xl text-center animate-fadeInUp">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
             <h3 className="text-3xl font-bold text-slate-900 mb-3">{t('auth.register.success.title')}</h3>
             <p className="text-slate-600 mb-6">{t('auth.register.success.redirecting')}</p>
             <div className="w-48 h-2 bg-orange-50 rounded-full overflow-hidden mx-auto">
               <div className="h-full bg-gradient-to-r from-orange-400 to-amber-400 animate-loading-bar" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

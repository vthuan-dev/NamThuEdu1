import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Camera, CheckCircle2, GraduationCap, Phone } from 'lucide-react';
import { AccountInfoCard } from '../account/AccountInfoCard';
import { PasswordChangeCard } from '../account/PasswordChangeCard';
import { SecurityCard } from '../account/SecurityCard';
import { usePageTitle, PAGE_TITLES } from '../../../../hooks/usePageTitle';
import { studentApi } from '../../../../services/studentApi';
import { getFullMediaUrl } from '../../../../utils/mediaUtils';

type ProfileData = {
  uId: number;
  uName: string;
  uPhone: string;
  uGender: 0 | 1 | boolean | null;
  uAddress: string | null;
  uDoB: string | null;
  bio: string | null;
  avatar_url: string | null;
  age_group?: string;
};

const initialsFrom = (name: string) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts[parts.length - 1][0]!.toUpperCase();
};

const scrollToCard = () => {
  document.getElementById('account-info-body')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

export function Profile() {
  usePageTitle(PAGE_TITLES.STUDENT_PROFILE);

  const { data } = useQuery({
    queryKey: ['student', 'profile'],
    queryFn: () => studentApi.getProfile(),
  });
  const profile: ProfileData | undefined =
    (data as any)?.data?.data ?? (data as any)?.data;

  // ─── Completeness calculation ────────────────────────────────
  const { pct, filled, total, missingLabels } = useMemo(() => {
    const fields: Array<{ key: string; label: string; filled: boolean }> = [
      { key: 'avatar',  label: 'Ảnh đại diện',  filled: !!profile?.avatar_url },
      { key: 'name',    label: 'Họ và tên',     filled: !!profile?.uName?.trim() },
      { key: 'phone',   label: 'Số điện thoại', filled: !!profile?.uPhone?.trim() },
      { key: 'gender',  label: 'Giới tính',     filled: profile?.uGender !== null && profile?.uGender !== undefined },
      { key: 'dob',     label: 'Ngày sinh',     filled: !!profile?.uDoB },
      { key: 'address', label: 'Địa chỉ',       filled: !!profile?.uAddress?.trim() },
      { key: 'bio',     label: 'Giới thiệu',    filled: !!profile?.bio?.trim() },
    ];
    const filledFields = fields.filter((f) => f.filled);
    const f = filledFields.length;
    const t = fields.length;
    return {
      pct: Math.round((f / t) * 100),
      filled: f,
      total: t,
      missingLabels: fields.filter((x) => !x.filled).map((x) => x.label),
    };
  }, [profile]);

  // ─── Ring geometry ───────────────────────────────────────────
  const RADIUS = 30;
  const CIRC = 2 * Math.PI * RADIUS;
  const dash = (pct / 100) * CIRC;

  const name = profile?.uName?.trim() || 'Học viên';

  // ─── Màu theo độ tuổi: mỗi role học viên 1 màu đặc trưng ──────
  // kids = cam, teens = teal, adults = tím. Fallback localStorage khi profile chưa kịp tải.
  const lsAge = (() => {
    try { return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}')?.age_group; }
    catch { return undefined; }
  })();
  const age = String(profile?.age_group ?? lsAge ?? 'adults').toLowerCase();
  const THEMES: Record<string, any> = {
    kids: {
      bg: '#FFF7ED',
      hero: 'linear-gradient(135deg, #7C2D12 0%, #C2410C 45%, #F97316 100%)',
      orb: '#FDBA74', avatar: 'linear-gradient(135deg, #FDBA74 0%, #EA580C 100%)',
      accent: '#EA580C', accentDeep: '#C2410C', rail: '#F97316',
      label: '#FED7AA', sub: '#FFEDD5',
      chipBg: 'rgba(253,186,116,0.20)', chipText: '#FFEDD5', chipBorder: 'rgba(253,186,116,0.32)',
      avatarShadow: '0 12px 32px -8px rgba(234,88,12,0.45), 0 0 0 3px rgba(255,255,255,0.12)',
    },
    teens: {
      bg: '#F0FDFA',
      hero: 'linear-gradient(135deg, #134E4A 0%, #0F766E 45%, #14B8A6 100%)',
      orb: '#5EEAD4', avatar: 'linear-gradient(135deg, #5EEAD4 0%, #0D9488 100%)',
      accent: '#0D9488', accentDeep: '#0F766E', rail: '#0D9488',
      label: '#99F6E4', sub: '#CCFBF1',
      chipBg: 'rgba(94,234,212,0.18)', chipText: '#CCFBF1', chipBorder: 'rgba(94,234,212,0.32)',
      avatarShadow: '0 12px 32px -8px rgba(13,148,136,0.45), 0 0 0 3px rgba(255,255,255,0.12)',
    },
    adults: {
      bg: '#F8F7FF',
      hero: 'linear-gradient(135deg, #1E0B4B 0%, #4C1D95 45%, #6D28D9 100%)',
      orb: '#A78BFA', avatar: 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)',
      accent: '#7C3AED', accentDeep: '#6D28D9', rail: '#7C3AED',
      label: '#C4B5FD', sub: '#DDD6FE',
      chipBg: 'rgba(167,139,250,0.20)', chipText: '#DDD6FE', chipBorder: 'rgba(167,139,250,0.30)',
      avatarShadow: '0 12px 32px -8px rgba(124,58,237,0.45), 0 0 0 3px rgba(255,255,255,0.12)',
    },
  };
  const T = THEMES[age] ?? THEMES.adults;

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>

      {/* ══ Hero ════════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden"
        style={{ background: T.hero }}
      >
        {/* Decorative orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/4 w-72 h-72 rounded-full opacity-20"
            style={{ background: `radial-gradient(circle, ${T.orb}, transparent)`, transform: 'translateY(-50%)' }} />
          <div className="absolute bottom-0 left-1/3 w-56 h-56 rounded-full opacity-15"
            style={{ background: `radial-gradient(circle, ${T.orb}, transparent)`, transform: 'translateY(40%)' }} />
        </div>

        <div className="relative z-10 px-6 sm:px-8 lg:px-12 py-8">
          <p className="text-[11px] font-bold tracking-[0.18em] uppercase mb-5" style={{ color: T.label }}>Hồ sơ của tôi</p>

          <div className="flex items-center gap-5 sm:gap-6 flex-wrap">
            {/* ── Avatar with camera overlay ── */}
            <button
              type="button"
              onClick={scrollToCard}
              className="relative group flex-shrink-0 focus:outline-none"
              aria-label="Đổi ảnh đại diện"
            >
              <div
                className="w-[88px] h-[88px] rounded-2xl overflow-hidden flex items-center justify-center text-white text-3xl font-extrabold transition-transform duration-300 group-hover:scale-[1.03]"
                style={{
                  background: T.avatar,
                  boxShadow: T.avatarShadow,
                }}
              >
                {profile?.avatar_url ? (
                  <img src={getFullMediaUrl(profile.avatar_url) ?? undefined} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span>{initialsFrom(name)}</span>
                )}
              </div>
              {/* Camera overlay */}
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110"
                style={{ background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.18)' }}>
                <Camera className="w-4 h-4" style={{ color: T.accentDeep }} strokeWidth={2.4} />
              </div>
            </button>

            {/* ── Identity ── */}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight truncate">
                {name}
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                  style={{ background: T.chipBg, color: T.chipText, border: `1px solid ${T.chipBorder}` }}>
                  <GraduationCap className="w-3 h-3" strokeWidth={2.4} />
                  Học viên
                </span>
                {profile?.uPhone && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: T.sub }}>
                    <Phone className="w-3 h-3" strokeWidth={2.4} />
                    {profile.uPhone}
                  </span>
                )}
              </div>
              <p className="text-xs mt-2 leading-relaxed max-w-md" style={{ color: T.sub, opacity: 0.85 }}>
                {pct === 100
                  ? 'Hồ sơ của bạn đã hoàn thiện — sẵn sàng cho mọi tính năng.'
                  : `Hồ sơ chưa đầy đủ — bổ sung ${missingLabels.length} mục để mở khóa hết tính năng.`}
              </p>
            </div>

            {/* ── Profile completeness ring ── */}
            <button
              type="button"
              onClick={scrollToCard}
              className="flex items-center gap-4 pl-4 pr-5 py-3.5 rounded-2xl flex-shrink-0 transition-all duration-200 hover:-translate-y-0.5 focus:outline-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.10)',
                boxShadow: '0 8px 32px -8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
              }}
            >
              {/* Ring */}
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 68 68">
                  <circle cx="34" cy="34" r={RADIUS} fill="none"
                    stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                  <circle cx="34" cy="34" r={RADIUS} fill="none"
                    stroke={pct === 100 ? 'url(#completeFull)' : 'url(#completePartial)'}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${CIRC}`}
                    style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
                  <defs>
                    <linearGradient id="completePartial" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#FCD34D" />
                      <stop offset="100%" stopColor="#F97316" />
                    </linearGradient>
                    <linearGradient id="completeFull" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#86EFAC" />
                      <stop offset="100%" stopColor="#10B981" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  {pct === 100 ? (
                    <CheckCircle2 className="w-6 h-6" style={{ color: '#34D399' }} strokeWidth={2.4} />
                  ) : (
                    <div className="flex items-baseline">
                      <span className="text-base font-extrabold text-white tabular-nums leading-none">{pct}</span>
                      <span className="text-[9px] font-semibold text-white/55 ml-0.5">%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Meta */}
              <div className="flex flex-col gap-1 leading-none text-left">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/55">
                  Hồ sơ hoàn thiện
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-lg font-extrabold text-white tabular-nums leading-none">{filled}</span>
                  <span className="text-xs font-medium text-white/55 leading-none">/ {total} mục</span>
                </div>
                <span className="text-[10px] font-medium leading-none mt-1" style={{ color: T.sub, opacity: 0.85 }}>
                  {pct === 100 ? 'Đã đầy đủ' : `Còn thiếu ${missingLabels.length} mục`}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ══ Content ═════════════════════════════════════════════ */}
      <div className="w-full px-4 sm:px-8 lg:px-12 py-8">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* LEFT — main: Account info (wider column) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 px-1">
              <span className="inline-block w-1 h-4 rounded-full" style={{ background: T.rail }} />
              <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-slate-500">
                Thông tin cá nhân
              </p>
            </div>
            <AccountInfoCard />
          </div>

          {/* RIGHT — sidebar: Security stack */}
          <aside className="lg:col-span-1 space-y-4">
            <div className="flex items-center gap-2 px-1">
              <span className="inline-block w-1 h-4 rounded-full" style={{ background: '#F59E0B' }} />
              <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-slate-500">
                Bảo mật &amp; tài khoản
              </p>
            </div>
            <div className="lg:sticky lg:top-4 space-y-4">
              <PasswordChangeCard />
              <SecurityCard defaultExpanded={false} />
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}

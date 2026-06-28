/**
 * KidsSettings — Trang cài đặt thân thiện cho trẻ 6-12 (Cambridge YL)
 *
 * Khác bản người lớn (Settings — tông indigo/tím): dùng claymorphism rose/cam
 * đồng bộ với KidsDashboard/KidsPractice. Tái sử dụng AccountInfoCard +
 * PasswordChangeCard (đã có logic avatar/địa chỉ/đổi mật khẩu) để giữ chức năng.
 */
import { useState, type ComponentType, type CSSProperties } from 'react';
import { User, ShieldCheck } from 'lucide-react';
import { AccountInfoCard } from '../account/AccountInfoCard';
import { PasswordChangeCard } from '../account/PasswordChangeCard';
import { usePageTitle } from '../../../../hooks/usePageTitle';

type Tab = 'profile' | 'security';

const TABS: {
  id: Tab;
  label: string;
  short: string;
  emoji: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  desc: string;
  clay: { bg: string; c: string };
}[] = [
  { id: 'profile',  label: 'Thông tin của bạn', short: 'Thông tin', emoji: '🧒', icon: User,        desc: 'Tên, ngày sinh, ảnh đại diện của bạn', clay: { bg: 'linear-gradient(135deg,#FFF1F2,#FECDD3)', c: '#E11D48' } },
  { id: 'security', label: 'Mật khẩu',          short: 'Mật khẩu',  emoji: '🔒', icon: ShieldCheck, desc: 'Đổi mật khẩu để giữ tài khoản an toàn', clay: { bg: 'linear-gradient(135deg,#EFF6FF,#BFDBFE)', c: '#2563EB' } },
];

export function KidsSettings() {
  usePageTitle('Cài đặt của bạn');
  const [tab, setTab] = useState<Tab>('profile');
  const activeTab = TABS.find(t => t.id === tab)!;

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #FFF1F2 0%, #FFF7ED 50%, #F0FDF4 100%)' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-10 space-y-5">

        {/* ─── Greeting ────────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-3xl p-5 sm:p-7"
          style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF7ED 100%)', boxShadow: '0 8px 32px rgba(251,113,133,0.12)', border: '2px solid rgba(255,255,255,0.9)' }}>
          <div className="absolute -top-10 -right-6 w-40 h-40 rounded-full opacity-40 pointer-events-none" style={{ background: 'radial-gradient(circle, #FED7AA, transparent)' }} />
          <div className="absolute -bottom-12 left-1/3 w-36 h-36 rounded-full opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle, #FECDD3, transparent)' }} />
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl"
              style={{ background: 'linear-gradient(135deg, #FB7185 0%, #F97316 100%)', boxShadow: '0 8px 20px rgba(251,113,133,0.35)' }}>
              ⚙️
            </div>
            <div>
              <p className="text-xs font-extrabold text-rose-400 uppercase tracking-widest">Tài khoản</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight" style={{ color: '#9F1239' }}>
                Cài đặt của bạn
              </h1>
              <p className="text-sm font-semibold text-orange-500/80 mt-0.5">Cập nhật thông tin và mật khẩu nhé!</p>
            </div>
          </div>
        </section>

        {/* ─── Clay Tab bar ────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {TABS.map(({ id, label, short, emoji, icon: Icon, clay }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="group flex items-center gap-3 rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                style={{
                  background: active ? clay.bg : '#fff',
                  border: active ? `2.5px solid ${clay.c}` : '2px solid #F1F5F9',
                  boxShadow: active ? `0 8px 20px ${clay.c}33` : '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/60 backdrop-blur-sm text-lg">
                  {emoji}
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon className="w-4 h-4 flex-shrink-0" style={{ color: active ? clay.c : '#94A3B8' }} />
                  <span className="text-sm font-extrabold truncate" style={{ color: active ? clay.c : '#475569' }}>
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{short}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* ─── Description strip ────────────────────────────────── */}
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl"
          style={{ background: activeTab.clay.bg, border: '2px solid rgba(255,255,255,0.85)' }}>
          <span className="text-lg">{activeTab.emoji}</span>
          <div>
            <p className="text-sm font-extrabold" style={{ color: activeTab.clay.c }}>{activeTab.label}</p>
            <p className="text-xs font-medium" style={{ color: activeTab.clay.c, opacity: 0.75 }}>{activeTab.desc}</p>
          </div>
        </div>

        {/* ─── Content (tái sử dụng card đã có) ─────────────────── */}
        <div className="kids-settings-cards">
          {tab === 'profile'  && <AccountInfoCard  defaultExpanded />}
          {tab === 'security' && <PasswordChangeCard defaultExpanded />}
        </div>

      </div>
    </div>
  );
}

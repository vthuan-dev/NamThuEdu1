/**
 * studentRoleTheme — màu đặc trưng theo lứa học viên.
 *
 * Mỗi role 1 màu riêng để nhận diện:
 *  - kids   → cam (orange)
 *  - teens  → teal
 *  - adults → tím (purple)  ← mặc định
 *
 * Dùng cho các trang DÙNG CHUNG (Hồ sơ, Tiến độ, Xếp hạng, Thông báo, Phần thưởng…)
 * để banner/hero đổi màu đúng theo role thay vì luôn tím.
 */
export type RoleKey = 'kids' | 'teens' | 'adults';

export interface RolePalette {
  key: RoleKey;
  bg: string;          // nền trang
  hero: string;        // gradient hero/banner
  orb: string;         // màu quầng trang trí
  accent: string;      // màu nhấn chính
  accentMid: string;   // màu nhấn vừa (gradient/chart)
  accentDeep: string;  // màu nhấn đậm (hover)
  accentLight: string; // nền nhạt cho chip/icon tile
  iconGrad: string;    // gradient cho ô icon
  label: string;       // chữ nhãn nhỏ trên hero (sáng)
  sub: string;         // chữ phụ trên hero (sáng)
}

const PALETTES: Record<RoleKey, RolePalette> = {
  kids: {
    key: 'kids',
    bg: '#FFF7ED',
    hero: 'linear-gradient(135deg, #7C2D12 0%, #C2410C 45%, #F97316 100%)',
    orb: '#FDBA74',
    accent: '#EA580C',
    accentMid: '#FB923C',
    accentDeep: '#C2410C',
    accentLight: '#FFEDD5',
    iconGrad: 'linear-gradient(135deg, #F97316, #EA580C)',
    label: '#FED7AA',
    sub: '#FFEDD5',
  },
  teens: {
    key: 'teens',
    bg: '#F0FDFA',
    hero: 'linear-gradient(135deg, #134E4A 0%, #0F766E 45%, #14B8A6 100%)',
    orb: '#5EEAD4',
    accent: '#0D9488',
    accentMid: '#14B8A6',
    accentDeep: '#0F766E',
    accentLight: '#CCFBF1',
    iconGrad: 'linear-gradient(135deg, #0D9488, #14B8A6)',
    label: '#99F6E4',
    sub: '#CCFBF1',
  },
  adults: {
    key: 'adults',
    bg: '#F8F7FF',
    hero: 'linear-gradient(135deg, #4C1D95 0%, #6D28D9 45%, #7C3AED 100%)',
    orb: '#A78BFA',
    accent: '#7C3AED',
    accentMid: '#8B5CF6',
    accentDeep: '#6D28D9',
    accentLight: '#EDE9FE',
    iconGrad: 'linear-gradient(135deg, #7C3AED, #8B5CF6)',
    label: '#C4B5FD',
    sub: '#DDD6FE',
  },
};

/** Đọc age_group từ tham số (nếu có) hoặc từ localStorage/sessionStorage. */
export function getStudentRole(ageGroup?: string | null): RoleKey {
  let a = ageGroup;
  if (!a) {
    try {
      a = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}')?.age_group;
    } catch {
      a = undefined;
    }
  }
  const s = String(a || 'adults').toLowerCase();
  return s === 'kids' ? 'kids' : s === 'teens' ? 'teens' : 'adults';
}

export function studentRolePalette(ageGroup?: string | null): RolePalette {
  return PALETTES[getStudentRole(ageGroup)];
}

import { Page, expect } from '@playwright/test';

/**
 * Shared E2E helpers for NamThuEdu.
 *
 * App chạy với VITE_USE_MOCK_DATA=true → đa số trang render được mà không cần
 * backend. Khi cần "đăng nhập", ta seed localStorage auth state để bypass form
 * (token mock) + điều hướng trực tiếp. Nếu test cần luồng login thật, dùng
 * `loginViaForm`.
 */

export const SCREENSHOT_DIR = 'e2e/screenshots';

export type Role = 'student-teens' | 'student-kids' | 'student-adults' | 'teacher' | 'admin';

interface SeedUser {
  token: string;
  role: 'student' | 'teacher' | 'admin';
  user: Record<string, unknown>;
}

const USERS: Record<Role, SeedUser> = {
  'student-teens': {
    token: 'e2e-mock-token-teens',
    role: 'student',
    user: { id: 9001, name: 'Teen An', phone: '0907770001', role: 'student', age_group: 'teens', class_id: 1, theme_preference: 'modern' },
  },
  'student-kids': {
    token: 'e2e-mock-token-kids',
    role: 'student',
    user: { id: 9002, name: 'Bé Minh', phone: '0901234567', role: 'student', age_group: 'kids', class_id: 1, theme_preference: 'colorful' },
  },
  'student-adults': {
    token: 'e2e-mock-token-adults',
    role: 'student',
    user: { id: 9003, name: 'Anh Hùng', phone: '0903456789', role: 'student', age_group: 'adults', class_id: 1, theme_preference: 'professional' },
  },
  teacher: {
    token: 'e2e-mock-token-teacher',
    role: 'teacher',
    user: { id: 8001, name: 'GV Demo', phone: '0905550001', role: 'teacher' },
  },
  admin: {
    token: 'e2e-mock-token-admin',
    role: 'admin',
    user: { id: 7001, name: 'Admin Demo', phone: '0900000000', role: 'admin' },
  },
};

/**
 * Seed auth state vào localStorage trước khi app load (addInitScript).
 *
 * Phải ghi khoá CÓ tiền tố vai trò (`teacher_auth_token`…) đúng như
 * utils/authStorage.ts sinh ra. Lý do: addInitScript chạy trước khi bundle app
 * khởi động, tức trước khi authStorage thay Storage.prototype, nên khoá không
 * tiền tố sẽ không được gắn tiền tố hộ. Ghi cả bộ không tiền tố kèm `auth_role`
 * để nhánh dự phòng tương thích ngược trong readScoped cũng chấp nhận được.
 */
export async function seedAuth(page: Page, role: Role): Promise<void> {
  const u = USERS[role];
  await page.addInitScript(
    ([token, roleName, userJson]) => {
      const r = roleName as string;
      localStorage.setItem(`${r}_auth_token`, token as string);
      localStorage.setItem(`${r}_auth_role`, r);
      localStorage.setItem(`${r}_user`, userJson as string);
      // Bộ không tiền tố: chỉ để tương thích code cũ còn đọc trực tiếp.
      localStorage.setItem('auth_token', token as string);
      localStorage.setItem('auth_role', r);
      localStorage.setItem('user', userJson as string);
    },
    [u.token, u.role, JSON.stringify(u.user)] as const,
  );
}

/** Đăng nhập học viên qua form thật (cần backend live). */
export async function loginViaForm(page: Page, phone: string, password: string): Promise<void> {
  await page.goto('/dang-nhap');
  await page.fill('input[name="phone"]', phone);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
}

/** Chụp screenshot full-page có namespacing theo flow. */
export async function snap(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: true });
}

/** Bật prefers-reduced-motion để test animation guard. */
export async function withReducedMotion(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

/** Assert không có horizontal scroll (responsive). */
export async function assertNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
  expect(overflow, 'Trang không được tràn ngang (horizontal scroll)').toBeLessThanOrEqual(2);
}

/** Chờ app React mount xong (root có nội dung). */
export async function waitForApp(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root && root.children.length > 0;
  }, { timeout: 20_000 }).catch(() => {});
}

/**
 * Điều hướng an toàn: dùng 'domcontentloaded' thay vì 'load' vì landing page
 * có particles/long-poll khiến event 'load' không bao giờ firing → timeout.
 */
export async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root && root.children.length > 0;
  }, { timeout: 20_000 }).catch(() => {});
}

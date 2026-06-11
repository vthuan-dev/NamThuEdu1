import { test, expect } from '@playwright/test';
import { snap, gotoApp, seedAuth, assertNoHorizontalScroll } from '../utils/helpers';

/**
 * PHASE 5.4 — Teacher portal (toàn bộ màn chính).
 * Seed auth teacher → vào từng route thật (từ teacherRoutes.tsx).
 */
test.describe('Teacher portal', () => {
  test.beforeEach(async ({ page }) => { await seedAuth(page, 'teacher'); });

  const pages: Array<{ path: string; name: string }> = [
    { path: '/giao-vien',                    name: 'teacher-dashboard' },
    { path: '/giao-vien/students',           name: 'teacher-students' },
    { path: '/giao-vien/students/them-moi',  name: 'teacher-student-add' },
    { path: '/giao-vien/khoa-hoc',           name: 'teacher-courses' },
    { path: '/giao-vien/de-thi',             name: 'teacher-exams' },
    { path: '/giao-vien/de-thi/tao-moi',     name: 'teacher-exam-create-setup' },
    { path: '/giao-vien/de-thi/mau-de',      name: 'teacher-exam-templates' },
    { path: '/giao-vien/luyen-tap',          name: 'teacher-practice' },
    { path: '/giao-vien/cham-diem',          name: 'teacher-grading-queue' },
    { path: '/giao-vien/cham-diem/thong-ke', name: 'teacher-grading-stats' },
    { path: '/giao-vien/giam-sat-truc-tiep', name: 'teacher-monitoring' },
    { path: '/giao-vien/bai-viet',           name: 'teacher-blog' },
    { path: '/giao-vien/bai-viet/danh-muc',  name: 'teacher-blog-categories' },
    { path: '/giao-vien/bao-cao',            name: 'teacher-reports' },
    { path: '/giao-vien/cai-dat',            name: 'teacher-settings' },
  ];

  for (const p of pages) {
    test(`renders ${p.name}`, async ({ page }) => {
      await gotoApp(page, p.path);
      await expect(page.locator('#root')).not.toBeEmpty();
      await snap(page, p.name);
    });
  }

  test('teacher dashboard has no horizontal scroll', async ({ page }) => {
    await gotoApp(page, '/giao-vien');
    await assertNoHorizontalScroll(page);
  });
});

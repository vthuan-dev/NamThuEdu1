import { test, expect } from '@playwright/test';
import { snap, gotoApp, seedAuth, assertNoHorizontalScroll } from '../utils/helpers';

/**
 * PHASE 5.5 — Admin portal (toàn bộ màn từ adminRoutes.tsx).
 */
test.describe('Admin portal', () => {
  test.beforeEach(async ({ page }) => { await seedAuth(page, 'admin'); });

  const pages: Array<{ path: string; name: string }> = [
    { path: '/admin',                            name: 'admin-dashboard' },
    { path: '/admin/teachers',                   name: 'admin-teachers' },
    { path: '/admin/teachers/assignments',       name: 'admin-teacher-assignments' },
    { path: '/admin/students',                   name: 'admin-students' },
    { path: '/admin/students/new-registrations', name: 'admin-student-registrations' },
    { path: '/admin/students/complaints',        name: 'admin-student-complaints' },
    { path: '/admin/courses',                    name: 'admin-courses' },
    { path: '/admin/content/posts',              name: 'admin-posts' },
    { path: '/admin/content/exams',              name: 'admin-exams' },
    { path: '/admin/system/activity-logs',       name: 'admin-activity-logs' },
    { path: '/admin/system/audit-logs',          name: 'admin-audit-logs' },
    { path: '/admin/notifications',              name: 'admin-notifications' },
    { path: '/admin/settings',                   name: 'admin-settings' },
    { path: '/admin/profile',                    name: 'admin-profile' },
  ];

  for (const p of pages) {
    test(`renders ${p.name}`, async ({ page }) => {
      await gotoApp(page, p.path);
      await expect(page.locator('#root')).not.toBeEmpty();
      await snap(page, p.name);
    });
  }

  test('admin dashboard has no horizontal scroll', async ({ page }) => {
    await gotoApp(page, '/admin');
    await assertNoHorizontalScroll(page);
  });
});

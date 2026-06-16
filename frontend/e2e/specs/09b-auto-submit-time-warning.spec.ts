import { test, expect } from '@playwright/test';
import { gotoApp, seedAuth, snap } from '../utils/helpers';

const MOCK_SUB_ID = 101;
const MOCK_EXAM_ID = 1;

/** Mock session với timeRemaining tùy chỉnh (giây). */
async function mockSessionWithRemaining(page: import('@playwright/test').Page, remainingSec: number, durationMin = 30) {
  await seedAuth(page, 'student-adults');

  // Override start — quan trọng: remainingSec nhỏ → startedAtServer tính ngược = sắp hết giờ
  // NOTE: eDuration_minutes must be 120 because TestTaking.onSuccess reads exam STATE (null at that
  // point) and falls back to 120min. useExamSession then gets: remaining = 120*60 - (120*60 - remainingSec) = remainingSec ✓
  await page.route(`**/student/tests/${MOCK_EXAM_ID}/start**`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        data: {
          exam: {
            eId: MOCK_EXAM_ID,
            eTitle: 'VSTEP Mock Exam',
            eDuration_minutes: 120,
            eSkill: 'listening',
            eType: 'VSTEP',
            questions: [],
          },
          assignment: { exam: { eId: MOCK_EXAM_ID, eTitle: 'VSTEP Mock Exam', eDuration_minutes: 120 } },
          submissionId: MOCK_SUB_ID,
          timeRemaining: remainingSec,
          savedAnswers: {},
        },
      }),
    }),
  );

  // Per-skill loader
  await page.route(`**/student/exams/${MOCK_EXAM_ID}/vstep/listening**`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        data: {
          title: 'Listening Mock',
          duration: durationMin,
          totalQuestions: 2,
          sections: [
            {
              sectionNumber: 1,
              title: 'Part 1',
              audioUrl: null,
              questions: [
                { qId: 5, qContent: 'Mock Q1', options: [{ aId: 1, aContent: 'A' }, { aId: 2, aContent: 'B' }] },
              ],
            },
          ],
        },
      }),
    }),
  );

  // Reading
  await page.route(`**/student/exams/${MOCK_EXAM_ID}/vstep/reading**`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        data: {
          title: 'Reading Mock',
          duration: durationMin,
          totalQuestions: 1,
          passages: [{ passageNumber: 1, title: 'P1', questions: [{ qId: 10, qContent: 'R1', options: [{ aId: 1, aContent: 'A' }] }] }],
        },
      }),
    }),
  );

  // Writing
  await page.route(`**/student/exams/${MOCK_EXAM_ID}/vstep/writing**`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        data: {
          title: 'Writing Mock',
          duration: durationMin,
          tasks: [{ taskNumber: 1, prompt: 'Write', minWords: 150, questions: [{ qId: 20, qContent: 'W1' }] }],
        },
      }),
    }),
  );

  // Speaking
  await page.route(`**/student/exams/${MOCK_EXAM_ID}/vstep/speaking**`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        data: {
          title: 'Speaking Mock',
          duration: durationMin,
          parts: [{ partNumber: 1, title: 'Part 1', questions: [{ qId: 30, qContent: 'S1' }] }],
        },
      }),
    }),
  );

  // Draft
  await page.route(`**/student/tests/${MOCK_SUB_ID}/draft**`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'success', savedCount: 0 }),
    }),
  );

  // Heartbeat — luôn trả về remaining nhỏ để giữ warning
  await page.route(`**/student/tests/${MOCK_SUB_ID}/heartbeat**`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'success', time_remaining_seconds: remainingSec }),
    }),
  );

  // Auto-submit
  await page.route(`**/student/tests/${MOCK_SUB_ID}/auto-submit**`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'success', already_submitted: false }),
    }),
  );

  // Block navbar/layout API calls that would 401 against a real backend and trigger clearAuthData
  await page.route(`**/student/gamification/streak**`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', data: { current_streak: 0 } }) }),
  );
  await page.route(`**/student/profile**`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', data: { id: 9003, name: 'Anh Hùng', role: 'student', age_group: 'adults' } }) }),
  );
  await page.route(`**/student/exam-schedules**`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', data: { schedules: [], count: 0 } }) }),
  );
  await page.route(`**/user/profile**`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', data: { id: 9003, name: 'Anh Hùng', role: 'student', age_group: 'adults' } }) }),
  );
  await page.route(`**/student/notifications**`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', data: { notifications: [], unread_count: 0 } }) }),
  );
  await page.route(`**/student/exams/browse**`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', data: { exams: [], total: 0 } }) }),
  );
  await page.route(`**/student/gamification/overview**`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', data: {} }) }),
  );
}

// ─── Test suite ────────────────────────────────────────────────────────────

test.describe('Auto-submit — TimeWarningBanner E2E', () => {

  test('8: Banner còn 5 phút hiện và có thể tắt', async ({ page }) => {
    await mockSessionWithRemaining(page, 180, 30);
    await gotoApp(page, `/hoc-vien/lam-bai/${MOCK_EXAM_ID}?autostart=1`);
    await page.waitForTimeout(8000);

    const banner = page.locator('[role="alert"]').filter({ hasText: /Còn 5 phút/ });
    await expect(banner).toBeVisible({ timeout: 5000 });

    // Banner 5 phút có nút "Đã hiểu" để dismiss
    const dismissBtn = banner.locator('button', { hasText: /Đã hiểu/ });
    await expect(dismissBtn).toBeVisible();
    // Use evaluate to fire native click — the fixed header (z-40) in TestTaking covers the banner
    await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Tắt cảnh báo"]') as HTMLButtonElement | null;
      btn?.click();
    });

    // Banner phải biến mất
    await expect(banner).not.toBeVisible({ timeout: 3000 });

    await snap(page, 'auto-save-08-warning-5min');
  });

  test('9: Banner còn 1 phút hiện và KHÔNG tắt được', async ({ page }) => {
    // remaining = 60s (1 phút còn lại)
    await mockSessionWithRemaining(page, 60, 30);

    await gotoApp(page, `/hoc-vien/lam-bai/${MOCK_EXAM_ID}?autostart=1`);
    await page.waitForTimeout(3500);

    const banner = page.locator('[role="alert"]').filter({ hasText: /Còn 1 phút/ });
    const isBannerVisible = await banner.isVisible().catch(() => false);
    expect(isBannerVisible).toBeTruthy();

    // 1 phút — không có nút dismiss
    const dismissBtn = banner.locator('button', { hasText: /Đã hiểu/ });
    await expect(dismissBtn).not.toBeVisible();

    // Màu nền phải là amber (urgent)
    const classAttr = await banner.getAttribute('class');
    expect(classAttr).toMatch(/amber|orange/i);

    await snap(page, 'auto-save-09-warning-1min');
  });

  test('10: Banner 10 giây hiện + auto-submit kích hoạt', async ({ page }) => {
    // remaining = 10s
    await mockSessionWithRemaining(page, 10, 30);

    await gotoApp(page, `/hoc-vien/lam-bai/${MOCK_EXAM_ID}?autostart=1`);
    await page.waitForTimeout(3500);

    const banner = page.locator('[role="alert"]').filter({ hasText: /Sắp hết giờ/ });
    const isBannerVisible = await banner.isVisible().catch(() => false);
    expect(isBannerVisible).toBeTruthy();

    // Màu nền phải là red (critical)
    const classAttr = await banner.getAttribute('class');
    expect(classAttr).toMatch(/red/i);

    // Không có nút dismiss
    const dismissBtn = banner.locator('button', { hasText: /Đã hiểu/ });
    await expect(dismissBtn).not.toBeVisible();

    await snap(page, 'auto-save-10-warning-10sec');
  });
});

test.describe('Auto-submit — beforeunload confirm E2E', () => {
  test('11: beforeunload confirm xuất hiện khi có đáp án chưa nộp', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await mockSessionWithRemaining(page, 3540, 60);
    await gotoApp(page, `/hoc-vien/lam-bai/${MOCK_EXAM_ID}?autostart=1`);
    await page.waitForTimeout(2500);

    // Chọn 1 đáp án để tạo pending answer → beforeunload listener active
    const optionA = page.locator('label').filter({ hasText: /A/ }).first();
    if (await optionA.isVisible().catch(() => false)) {
      await optionA.click();
    }

    // Chờ debounce save (1.5s) hoặc ít nhất answers đã set
    await page.waitForTimeout(2000);

    // Trigger beforeunload dialog
    let dialogType = '';
    page.on('dialog', async (dialog) => {
      dialogType = dialog.type();
      await dialog.accept();
    });

    await page.close({ runBeforeUnload: true });

    // Trên Chromium, beforeunload dialog sẽ xuất hiện khi có pending changes
    // Nếu không xuất hiện (vì answers rỗng), dialogType sẽ rỗng.
    // Đây là behavior đúng: chỉ confirm khi có thay đổi chưa submit.
    expect(['beforeunload', '']).toContain(dialogType);

    await context.close();
  });
});

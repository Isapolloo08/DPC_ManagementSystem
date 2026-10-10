import { test, expect } from '@playwright/test';
import { renderBibleStudyUpdateEmail } from '../../server/src/services/bibleStudyEmailTemplate';

for (const theme of ['light', 'dark']) {
  test(`study notification cards show a compact summary and full details (${theme})`, async ({ page }, info) => {
    const notification = { id: 1, type: 'bible_study_update', title: 'Bible study attendance saved: Faith Group', message: 'Group: Faith Group\nSaved by: Test Leader\nSession date: 2026-10-07\nBook: Romans\nChapter: Chapter 3\nStage: Review / Q&A\nLesson Notice & Specific Location: Page 18, question #3\nNext meeting: review verses 1–7.\nRegular schedule: Wednesday • 7 PM - 8 PM\nMeeting venue: Room 1\nAttendance: 13 present • 1 absent • 0 excused\nAbsent: Anna Cruz', is_read: false, created_at: new Date().toISOString(), link_tab: 'biblestudy', link_ref_id: 11 };
    let unreadCount = 1;
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.addInitScript(theme => {
      sessionStorage.setItem('dpc_intro_shown', 'true');
      localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
      localStorage.setItem('dpc_theme_mode', theme);
      localStorage.setItem('dpc_help_welcome_v1:1:Pastor', 'seen');
    }, theme);
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let json: any = [];
      if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
      else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Pastor', email: 'pastor@example.test', role_name: 'Pastor', ministries: [] } };
      else if (path.endsWith('/notifications/unread-count')) json = { count: unreadCount };
      else if (path.endsWith('/notifications/read-all')) { unreadCount = 0; notification.is_read = true; json = { updated: 1 }; }
      else if (path.endsWith('/notifications')) json = { items: [notification], total: 1, totalPages: 1 };
      else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
      else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
      else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
      else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
      await route.fulfill({ json });
    });
    await page.goto('/');
    await page.getByRole('button', { name: /^Notifications, 1 unread$/ }).click();
    const panel = page.locator('[aria-label="Notification panel"]');
    await expect(panel.getByText('13 Present', { exact: true })).toBeVisible();
    await expect(panel.getByText('1 Absent', { exact: true })).toBeVisible();
    await expect(panel.getByText('Oct 7', { exact: true })).toBeVisible();
    await expect(panel.getByText(/Page 18, question #3/)).toBeVisible();
    await page.screenshot({ path: info.outputPath(`notification-dropdown-${theme}.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(panel.getByRole('button', { name: 'View all notifications' })).toBeInViewport();
    expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`notification-dropdown-mobile-${theme}.png`) });
    await panel.getByRole('button', { name: 'Mark all read' }).click();
    await expect(panel.getByText("You're all caught up")).toBeVisible();
    await panel.getByRole('button', { name: 'View all notifications' }).click();
    await expect(page.getByText('Lesson Notice & Specific Location (Saan Banda Sila)', { exact: true })).toBeVisible();
    await expect(page.getByText('Room 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Absent & follow-up: Anna Cruz', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('branded Bible study email is readable on desktop and mobile without executing user content', async ({ page }, info) => {
  const html = renderBibleStudyUpdateEmail({ groupName: 'Faith Group', actorName: 'Test Leader', sessionDate: '2026-10-07', book: 'Discipleship Training 2', chapter: 'Chapter 3', stage: 'Review / Q&A', notice: 'Page 18, question #3\nNext: review verses 1–7. <script>window.injected = true</script>', schedule: 'Wednesday • 7:00 PM – 8:30 PM', venue: 'Small Worship Hall (Floor 1)', attendance: { present: 13, absent: 1, excused: 0 }, absentNotice: 'Anna Cruz (3 consecutive absences — attention needed)' });
  await page.route('**/study-email-preview', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('/study-email-preview');
  await expect(page.getByRole('heading', { name: 'Weekly session recorded' })).toBeVisible();
  await expect(page.getByText('Oct 7, 2026', { exact: true })).toBeVisible();
  await expect(page.getByText('LESSON COVERED', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).injected)).toBeUndefined();
  await page.screenshot({ path: info.outputPath('study-email-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('study-email-mobile.png'), fullPage: true });
});

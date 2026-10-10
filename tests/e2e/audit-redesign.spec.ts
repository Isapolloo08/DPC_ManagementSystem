import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

for (const theme of ['light', 'dark']) {
  test(`audit filters combine operators, roles, actions and Philippine dates (${theme})`, async ({ page }, info) => {
    await page.clock.setFixedTime(new Date('2026-10-09T17:00:00Z'));
    const logs = [
      { id: 1, user_name: 'Test Leader', user_email: 'leader@example.test', role_name: 'Leader', action: 'UPDATE_PROGRESS', target_table: 'bible_study_groups', target_id: 11, details: 'Updated Romans chapter progress', created_at: '2026-10-09T16:30:00Z' },
      { id: 2, user_name: 'Test Pastor', user_email: 'pastor@example.test', role_name: 'Pastor', action: 'CREATE', target_table: 'members', target_id: 2, details: 'Registered Grace Reyes', created_at: '2026-10-09T15:50:00Z' },
      { id: 3, user_name: 'Test Admin', user_email: 'admin@example.test', role_name: 'Admin', action: 'DELETE', target_table: 'duty_teams', target_id: 3, details: 'Archived service team', created_at: '2026-09-30T08:00:00Z' },
    ];
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(theme => {
      sessionStorage.setItem('dpc_intro_shown', 'true');
      localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
      localStorage.setItem('dpc_theme_mode', theme);
      localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
    }, theme);
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let json: any = [];
      if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
      else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Admin', email: 'admin@example.test', role_name: 'Admin', ministries: [] } };
      else if (path.endsWith('/audit')) json = logs;
      else if (path.endsWith('/notifications')) json = { items: [], total: 0, totalPages: 1 };
      else if (path.endsWith('/notifications/unread-count')) json = { count: 0 };
      else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
      else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
      else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
      else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
      await route.fulfill({ json });
    });
    await page.goto('/');
    await page.locator('aside').getByTitle('System Audit Logs', { exact: true }).click();
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(3);
    await page.getByLabel('Audit operator', { exact: true }).selectOption('Test Leader');
    await page.getByLabel('Audit role', { exact: true }).selectOption('Leader');
    await page.getByLabel('Audit action', { exact: true }).selectOption('UPDATE_PROGRESS');
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText('Updated Romans chapter progress');
    await page.getByLabel('Audit action', { exact: true }).selectOption('CREATE');
    await expect(page.getByText('No matching audit records found')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await page.getByLabel('Audit time period').selectOption('TODAY');
    await expect(rows).toHaveCount(1); // Manila Oct 10; an Oct 9 event inside the last 24h is excluded.
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await page.getByLabel('Audit from date').fill('2026-09-30');
    await page.getByLabel('Audit to date').fill('2026-10-09');
    await expect(rows).toHaveCount(2);
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
    const download = await downloadEvent;
    const csv = await readFile((await download.path())!, 'utf8');
    expect(csv).toContain('Registered Grace Reyes');
    expect(csv).not.toContain('Updated Romans chapter progress');
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await page.getByRole('button', { name: 'Newest First', exact: true }).click();
    await expect(rows.first()).toContainText('Archived service team');
    await page.screenshot({ path: info.outputPath(`audit-${theme}.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByLabel('Audit operator', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`audit-mobile-${theme}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}

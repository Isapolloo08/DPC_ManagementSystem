import { test, expect } from '@playwright/test';
test.use({ timezoneId: 'Asia/Manila' });

for (const theme of ['light', 'dark']) {
  test(`celebrations filters, forms and responsive layout (${theme})`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    const writes: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-06T04:00:00Z'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(theme => {
      sessionStorage.setItem('dpc_intro_shown', 'true');
      localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
      localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
      localStorage.setItem('dpc_theme_mode', theme);
    }, theme);
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) writes.push(path);
      let json: any = [];
      if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
      else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Admin', email: 'admin@example.test', username: 'admin', role_name: 'Admin', ministries: [] } };
      else if (path.endsWith('/ministries')) json = [{ id: 1, name: 'Youth' }];
      else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
      else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
      else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
      else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
      else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
      else if (path.endsWith('/events/recurring-sunday-cycle')) {
        const year = Number(url.searchParams.get('year'));
        json = { year, available_years: [2025, 2026, 2027, 2028], total_annual_events: 2, events: [
          { id: 1, title: 'Youth Harvest and Campus Commissioning Sunday', month: 2, week_pattern: '3rd_sunday', target_ministry_name: 'Youth', color: '#d97706', is_active: true, projected_date: `${year}-02-15`, projected_formatted: `February 15, ${year}`, description: 'Celebrate our students and pray for their campuses.' },
          { id: 2, title: 'Christmas Thanksgiving Celebration', month: 12, week_pattern: 'last_sunday', target_ministry_name: 'Church-wide', color: '#4f46e5', is_active: true, projected_date: `${year}-12-27`, projected_formatted: `December 27, ${year}`, is_synced_to_calendar: true },
        ] };
      } else if (path.endsWith('/events')) json = [{ id: 3, title: 'Youth retreat', start_time: '2026-10-16T08:00:00', end_time: '2026-10-18T16:00:00', ministry_name: 'Youth', location: 'Retreat center', description: 'Three days of fellowship.' }];
      await route.fulfill({ json });
    });
    await page.goto('/');
    await page.locator('aside').getByTitle('Events & Celebrations', { exact: true }).click();
    const workspace = page.locator('.celebrations-page');
    await expect(workspace.getByRole('heading', { name: 'Events and Celebrations', exact: true })).toBeVisible();
    await expect(workspace.locator('.celebrations-month')).toHaveCount(12);
    await expect(workspace.locator('.celebration-card')).toHaveCount(3);
    await workspace.getByRole('button', { name: '2027', exact: true }).click();
    await expect(workspace.getByRole('heading', { name: '2027 at a glance' })).toBeVisible();
    await expect(workspace.locator('.celebration-card')).toHaveCount(2);
    await workspace.getByRole('button', { name: '2026', exact: true }).click();
    await workspace.getByRole('button', { name: /One-Time Events/ }).click();
    await expect(workspace.locator('.celebration-card')).toHaveCount(1);
    await workspace.getByRole('button', { name: 'Q1', exact: true }).click();
    await expect(workspace.getByText('No Events or Celebrations Found')).toBeVisible();
    await workspace.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await workspace.getByRole('textbox', { name: 'Search events and celebrations' }).fill('Christmas');
    await expect(workspace.locator('.celebration-card')).toHaveCount(1);
    await workspace.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await workspace.getByRole('combobox', { name: 'Filter by ministry' }).selectOption('Youth');
    await expect(workspace.locator('.celebration-card')).toHaveCount(2);
    await workspace.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await workspace.getByTitle('Edit Celebration', { exact: true }).first().click();
    await expect(page.locator('[data-guide="celebration-form"]')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await workspace.getByRole('button', { name: 'Add Event / Celebration', exact: true }).click();
    await expect(page.locator('[data-guide="celebration-form"]')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await workspace.getByRole('button', { name: 'Schedule on Calendar', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await workspace.getByRole('heading', { name: 'Events and Celebrations', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`${theme}-desktop.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(workspace.getByRole('button', { name: 'Add Event / Celebration', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await workspace.getByRole('heading', { name: 'Events and Celebrations', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`${theme}-mobile.png`), fullPage: true });
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
  });
}

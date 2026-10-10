import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'Asia/Manila' });
for (const theme of ['light', 'dark']) test(`history starts at all recorded dates and types remain distinct (${theme})`, async ({ page }, info) => {
  const requests: URLSearchParams[] = [];
  const csvRequests: URLSearchParams[] = [];
  await page.addInitScript(theme => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('dpc_theme_mode', theme);
    localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
  }, theme);
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/attendance-log/export.csv')) {
      csvRequests.push(url.searchParams);
      return route.fulfill({ contentType: 'text/csv', body: 'Member,Event\nJuan Santos,Church Anniversary' });
    }
    let json: unknown = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Admin', role_name: 'Admin', ministries: [] } };
    else if (path.endsWith('/groups')) json = [{ id: 11, name: 'Faith Group', leader_name: 'Pastor' }];
    else if (path.endsWith('/events')) json = [
      { id: 21, title: 'Church Anniversary', start_time: '2020-01-01T10:00:00+08:00' },
      { id: 22, title: 'Youth Fellowship', start_time: '2020-02-01T10:00:00+08:00' },
      { id: 23, title: 'Future Event', start_time: '2099-01-01T10:00:00+08:00' },
    ];
    else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
    else if (path.endsWith('/attendance-log')) {
      requests.push(url.searchParams);
      json = { rows: [{ logType: url.searchParams.get('type') || 'bible_study', logDate: '2020-01-01', memberName: 'Juan Santos', memberId: 1, ministryName: 'Youth', groupName: 'Faith Group', status: 'present' }], total: 1, summary: { total: 1, present: 1, absent: 0, excused: 0 } };
    }
    await route.fulfill({ json });
  });
  await page.goto('/');
  await page.locator('aside').getByTitle('Attendance Log', { exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Juan Santos', exact: true })).toBeVisible();
  const today = await page.locator('[data-guide="log-to"]').inputValue();
  expect(requests.at(-1)?.get('from')).toBeNull();
  expect(requests.at(-1)?.get('to')).toBe(today);
  const filters = page.locator('[data-guide="log-type"]');
  await expect(filters.getByRole('button', { name: 'All attendance', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await filters.getByRole('button', { name: 'Events', exact: true }).click();
  await expect.poll(() => requests.at(-1)?.get('type')).toBe('event');
  const eventSelect = page.getByLabel('Event', { exact: true });
  await expect(eventSelect).toBeVisible();
  await expect(eventSelect.locator('option')).toHaveCount(3);
  await expect(eventSelect.locator('option[value="23"]')).toHaveCount(0);
  await eventSelect.selectOption('21');
  await expect.poll(() => requests.at(-1)?.get('eventId')).toBe('21');
  await expect(page.getByRole('cell', { name: 'Juan Santos', exact: true })).toBeVisible();
  const requestCount = requests.length;
  const panel = page.getByRole('region', { name: 'Attendance filters' });
  await page.getByRole('button', { name: 'Collapse filters', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Expand filters', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(eventSelect).toBeHidden();
  await expect(panel).toContainText('Church Anniversary');
  await page.getByRole('button', { name: 'Expand filters', exact: true }).press('Enter');
  await expect(eventSelect).toHaveValue('21');
  await expect(eventSelect).toBeVisible();
  expect(requests.length).toBe(requestCount);
  const csvDownload = page.waitForEvent('download');
  await page.locator('[data-guide="log-csv"]').click();
  await csvDownload;
  expect(csvRequests.at(-1)?.get('eventId')).toBe('21');
  const pdfDownload = page.waitForEvent('download');
  await page.locator('[data-guide="log-pdf"]').click();
  await pdfDownload;
  expect(requests.find(request => request.get('pageSize') === '5000')?.get('eventId')).toBe('21');
  await filters.getByRole('button', { name: 'Sunday Service', exact: true }).click();
  await expect.poll(() => requests.at(-1)?.get('type')).toBe('sunday_service');
  expect(requests.at(-1)?.get('eventId')).toBeNull();
  await filters.getByRole('button', { name: 'All attendance', exact: true }).click();
  await page.locator('[data-guide="log-group"]').selectOption('11');
  await expect.poll(() => requests.at(-1)?.get('type')).toBe('bible_study');
  await expect.poll(() => requests.at(-1)?.get('groupId')).toBe('11');
  await filters.getByRole('button', { name: 'Events', exact: true }).click();
  await expect(eventSelect).toHaveValue('all');
  await expect.poll(() => requests.at(-1)?.get('groupId')).toBeNull();
  await page.locator('[data-guide="log-to"]').fill('2099-12-31');
  await expect(page.locator('[data-guide="log-to"]')).toHaveValue(today);
  await page.screenshot({ path: info.outputPath('attendance-history.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await filters.scrollIntoViewIfNeeded();
  await expect(filters.getByRole('button', { name: 'Events', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('attendance-history-mobile.png') });
  await page.getByRole('button', { name: 'Collapse filters', exact: true }).click();
  await expect(filters).toBeHidden();
  await panel.scrollIntoViewIfNeeded();
  expect((await panel.boundingBox())!.height).toBeLessThan(110);
  await page.screenshot({ path: info.outputPath('attendance-history-collapsed.png') });
  await panel.getByRole('button', { name: 'Reset Filters', exact: true }).click();
  await expect.poll(() => requests.at(-1)?.get('type')).toBeNull();
  await expect(panel).toContainText('All attendance');
  await expect(filters).toBeHidden();
  await page.getByRole('button', { name: 'Expand filters', exact: true }).click();
  await expect(filters.getByRole('button', { name: 'All attendance', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

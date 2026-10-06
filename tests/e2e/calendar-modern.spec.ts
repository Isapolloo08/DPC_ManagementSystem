import { test, expect, type Page } from '@playwright/test';
test.use({ timezoneId: 'Asia/Manila' });

async function prepare(page: Page, theme: string, withOverflow = false) {
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
    const path = new URL(route.request().url()).pathname;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) writes.push(path);
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Admin', email: 'admin@example.test', username: 'admin', role_name: 'Admin', ministries: [] } };
    else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [
      { id: 1, first_name: 'January', last_name: 'Celebrant', birth_month: 1, birth_day: 1, turning_age: 23 },
      { id: 2, first_name: 'October', last_name: 'Celebrant', birth_month: 10, birth_day: 12, turning_age: 25 },
    ], counts: {} };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
    else if (path.endsWith('/duty/schedule') || path.endsWith('/dishwashing/schedule')) json = { schedule: [] };
    else if (path.endsWith('/events')) json = [
      { id: 1, title: 'Community prayer evening', start_time: '2026-10-06T18:00:00', end_time: '2026-10-06T19:30:00', location: 'Main sanctuary', description: 'An evening of prayer for our community.', ministry_name: 'All-Church' },
      { id: 2, title: 'Youth retreat', start_time: '2026-10-16T08:00:00', end_time: '2026-10-18T16:00:00', location: 'Retreat center', description: 'Three days of fellowship.' },
      ...(withOverflow ? [
        { id: 3, title: 'Long gathering', start_time: '2026-10-16T08:00:00', end_time: '2026-10-19T16:00:00' },
        { id: 4, title: 'Second four-day gathering', start_time: '2026-10-16T08:00:00', end_time: '2026-10-19T16:00:00' },
        { id: 5, title: 'Third four-day gathering', start_time: '2026-10-16T08:00:00', end_time: '2026-10-19T16:00:00' },
        { id: 6, title: 'Different time gathering', start_time: '2026-10-16T09:00:00', end_time: '2026-10-19T17:00:00' },
      ] : []),
    ];
    else if (path.endsWith('/groups')) json = [{ id: 1, name: 'Romans study', leader_name: 'Grace Reyes', meeting_day: 'Wednesday', meeting_time: '7:00 PM - 8:30 PM', location: 'Fellowship hall', members: [], status: 'active' }];
    await route.fulfill({ json });
  });
  await page.goto('/');
  await page.locator('aside').getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Church calendar', exact: true })).toBeVisible();
  return { errors, writes };
}

test('matching four-day events share a bar; shorter ranges and different times stay separate', async ({ page }, testInfo) => {
  const { errors, writes } = await prepare(page, 'dark', true);
  const groupedBars = page.locator('.calendar-span[data-schedule-count="3"]');
  await expect(groupedBars).toHaveCount(2);
  const bar = groupedBars.first();
  await expect(bar).toContainText('3 activities');
  await expect(bar).toHaveCSS('grid-column-start', '6');
  await expect(bar).toHaveCSS('grid-column-end', '8');
  await expect(groupedBars.last()).toHaveCSS('grid-column-start', '1');
  await expect(groupedBars.last()).toHaveCSS('grid-column-end', '3');
  await expect(page.locator('.calendar-span').filter({ hasText: 'Youth retreat' })).toHaveCount(2);
  await expect(page.locator('.calendar-span').filter({ hasText: 'Different time gathering' })).toHaveCount(2);
  await bar.click();
  const dialog = page.getByRole('dialog', { name: 'Activities with this schedule' });
  for (const name of ['Long gathering', 'Second four-day gathering', 'Third four-day gathering']) {
    await expect(dialog.getByRole('button', { name: new RegExp(name) })).toHaveCount(1);
  }
  await expect(dialog).not.toContainText('Youth retreat');
  await expect(dialog).not.toContainText('Different time gathering');
  await page.screenshot({ path: testInfo.outputPath('matching-schedules.png') });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(bar).toBeFocused();
  await bar.click();
  await dialog.getByRole('button', { name: /Second four-day gathering/ }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.calendar-details')).toContainText('Second four-day gathering');
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});

test('Bible study recurrence follows December and the next year on the correct Manila weekday', async ({ page }) => {
  const { errors } = await prepare(page, 'dark');
  const workspace = page.locator('.church-calendar');
  await workspace.getByRole('button', { name: /Bible Study Groups/ }).click();
  await workspace.getByRole('button', { name: 'Next month', exact: true }).click();
  await workspace.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(workspace.getByRole('heading', { name: 'December 2026' })).toBeVisible();
  const cells = workspace.locator('.calendar-week');
  const decemberSessions = workspace.locator('button[data-kind="bible_study"]');
  await expect(decemberSessions).toHaveCount(5);
  for (const date of [2, 9, 16, 23, 30]) {
    const week = cells.filter({ has: page.getByRole('button', { name: `Wed, Dec ${date}, 2026, 1 activities`, exact: true }) });
    await expect(week.locator('.grid-cols-7.flex-1 > div').nth(3).getByRole('button', { name: 'Romans study', exact: true })).toBeVisible();
  }
  await workspace.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(workspace.getByRole('heading', { name: 'January 2027' })).toBeVisible();
  const januarySessions = workspace.locator('button[data-kind="bible_study"]');
  await expect(januarySessions).toHaveCount(6); // Dec 30 and Feb 3 padding + Jan 6, 13, 20, 27.
  const firstJanuaryWeek = cells.filter({ has: page.getByRole('button', { name: 'Wed, Jan 6, 2027, 1 activities', exact: true }) });
  await firstJanuaryWeek.getByRole('button', { name: 'Romans study', exact: true }).click();
  await expect(workspace.locator('.calendar-details')).toContainText('Wed, Jan 6, 2027');
  expect(errors).toEqual([]);
});
for (const theme of ['light', 'dark']) {
  test(`modern calendar preserves selection, filters, navigation and responsive layout (${theme})`, async ({ page }, testInfo) => {
    const { errors, writes } = await prepare(page, theme);
    const workspace = page.locator('.church-calendar');
    const details = workspace.locator('.calendar-details');
    await expect(details).toContainText('Community prayer evening');
    await expect(details).not.toContainText('January Celebrant');
    const calendar = page.getByRole('region', { name: 'Monthly calendar' });
    await calendar.getByRole('button', { name: /Youth retreat/ }).first().focus();
    await page.keyboard.press('Enter');
    await expect(details).toContainText('Three days of fellowship');
    await calendar.getByRole('button', { name: /October Celebrant/ }).click();
    await expect(details).toContainText('October Celebrant');
    await expect(details.getByRole('button', { name: 'Send Birthday Blessing' })).toBeVisible();
    await workspace.getByRole('button', { name: /Bible Study Groups/ }).click();
    await expect(details).toContainText('Romans study');
    await expect(calendar.getByRole('button', { name: /Community prayer evening/ })).toHaveCount(0);
    await workspace.getByLabel('Search activities').fill('no matching activity');
    await expect(details).toContainText('No activity selected');
    await workspace.getByLabel('Clear activity search').click();
    await workspace.getByRole('button', { name: /All Activities/ }).click();
    await workspace.getByRole('button', { name: 'Next month', exact: true }).click();
    await expect(workspace.getByRole('heading', { name: 'November 2026' })).toBeVisible();
    await workspace.getByRole('button', { name: 'Today', exact: true }).click();
    await expect(workspace.getByRole('heading', { name: 'October 2026' })).toBeVisible();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);
      await workspace.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`modern-calendar-${theme}-${width}.png`), fullPage: true });
    }
    await workspace.getByRole('button', { name: 'Agenda', exact: true }).click();
    await expect(calendar).not.toBeVisible();
    await expect(workspace.getByText('Community prayer evening', { exact: true }).first()).toBeVisible();
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
  });
}

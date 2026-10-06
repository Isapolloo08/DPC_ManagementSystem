import { test, expect, type Page } from '@playwright/test';
import { parseBusySchedule, parseScheduleTime, suggestBibleStudySchedules, WEEKDAYS } from '../../client/src/utils/bibleStudyScheduleSuggestions';

test('schedule parser handles picker abbreviations, multiple slots, ranges and overnight work', () => {
  const schedule = parseBusySchedule('M-W 8:00 AM - 5:00 PM, Th-F 1:00 PM - 5:00 PM');
  expect(schedule.complete).toBe(true);
  expect(schedule.slots.map(slot => slot.day)).toEqual([0, 2, 3, 4]);
  expect(parseBusySchedule('MWF 08:00 - 12:00, TTH 13:00 - 17:00').slots.map(slot => slot.day)).toEqual([0, 2, 4, 1, 3]);
  expect(parseBusySchedule('Mon-Fri 8:00 AM - 5:00 PM').slots).toHaveLength(5);
  expect(parseBusySchedule('Sat-Sun 8:00 AM - 5:00 PM').slots.map(slot => slot.day)).toEqual([5, 6]);
  expect(parseBusySchedule('Sun 10:00 PM - 6:00 AM').slots).toEqual([
    { day: 6, start: 1320, end: 1440 }, { day: 0, start: 0, end: 360 },
  ]);
  expect(parseBusySchedule('Mon, Wed 8:00 AM – 12:00 PM').complete).toBe(true);
  expect(parseScheduleTime('12:00 AM')).toBe(0);
  expect(parseScheduleTime('12:00 PM')).toBe(720);
});

test('missing, malformed and partly unreadable schedules never imply availability', () => {
  for (const value of ['', 'Flexible', 'Mon 99:00 AM - 5:00 PM', 'Mon 8:60 AM - 5:00 PM', 'Mon 8:00 AM - 8:00 AM']) {
    expect(parseBusySchedule(value).complete).toBe(false);
  }
  expect(parseBusySchedule('Mon 8:00 AM - 5:00 PM; rotating shifts').complete).toBe(false);
  const options = { duration: 60, days: ['Monday'], start: 1020, end: 1200 };
  const results = suggestBibleStudySchedules([
    { id: 1, name: 'Recorded', class_schedule: 'Mon 8:00 AM - 5:00 PM' },
    { id: 2, name: 'Unknown' },
    { id: 3, name: 'Partial', class_schedule: 'Tue 8:00 AM - 5:00 PM; rotating shifts' },
  ], null, options);
  expect(results[0].clear.map(member => member.id)).toEqual([1]);
  expect(results[0].unknown.map(member => member.id)).toEqual([2, 3]);
  expect(suggestBibleStudySchedules([{ id: 1, name: 'Unknown' }], null, options)).toEqual([]);
});

test('ranking maximizes attendance, avoids leader conflicts and produces distinct options', () => {
  const results = suggestBibleStudySchedules([
    { id: 1, name: 'Alice', class_schedule: 'Daily 8:00 AM - 5:00 PM' },
    { id: 2, name: 'Bob', class_schedule: 'Mon 5:00 PM - 7:00 PM' },
  ], { id: 3, name: 'Leader', class_schedule: 'Mon 5:00 PM - 6:30 PM' },
  { duration: 90, days: WEEKDAYS, start: 1020, end: 1260 });
  expect(results).toHaveLength(5);
  expect(results[0]).toMatchObject({ day: 'Monday', start: 1140, end: 1230 });
  for (const [index, suggestion] of results.entries()) {
    expect(suggestion.clear).toHaveLength(2);
    for (const other of results.slice(index + 1)) {
      expect(suggestion.day !== other.day || suggestion.end <= other.start || other.end <= suggestion.start).toBe(true);
    }
  }
  expect(suggestBibleStudySchedules([{ id: 1, name: 'Alice', class_schedule: 'Daily 8:00 AM - 5:00 PM' }],
    { id: 3, name: 'Leader', class_schedule: 'Daily 5:00 PM - 9:00 PM' },
    { duration: 90, days: WEEKDAYS, start: 1020, end: 1260 })).toEqual([]);
});

async function prepare(page: Page, theme: string) {
  const writes: { path: string; body: any }[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(theme => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
    localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
    localStorage.setItem('dpc_theme_mode', theme);
  }, theme);
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
      writes.push({ path, body: route.request().postDataJSON() });
      return route.fulfill({ json: { id: 100, message: 'Saved' } });
    }
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Admin', email: 'admin@example.test', username: 'admin', role_name: 'Admin', ministries: [] } };
    else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
    else if (path.endsWith('/study-topics')) json = { topics: [] };
    else if (path.endsWith('/lookups')) json = [{ id: 1, name: url.searchParams.get('type') === 'event_location' ? 'Room 1' : 'General', is_active: true }];
    else if (path.endsWith('/users')) json = [{ id: 8, name: 'Test Leader', role_name: 'Leader', member_id: 4 }];
    else if (path.endsWith('/members')) json = [
      { id: 1, first_name: 'Alice', last_name: 'Member', class_schedule: 'Daily 8:00 AM - 5:00 PM' },
      { id: 2, first_name: 'Bob', last_name: 'Member', class_schedule: 'Mon 5:00 PM - 7:00 PM' },
      { id: 3, first_name: 'Unknown', last_name: 'Member', class_schedule: null },
      { id: 4, first_name: 'Test', last_name: 'Leader', class_schedule: 'Mon 5:00 PM - 6:30 PM' },
    ];
    await route.fulfill({ json });
  });
  await page.goto('/');
  await page.getByTitle('Bible Study Groups', { exact: true }).click();
  await page.getByRole('button', { name: 'New Bible Study Group', exact: true }).click();
  const form = page.locator('[data-modal-panel]').filter({ has: page.getByRole('heading', { name: 'Create New Bible Study Small Group' }) });
  await form.locator('[data-guide="group-leader"]').fill('Test Leader');
  await form.getByRole('button', { name: 'Test Leader Leader', exact: true }).click();
  return { form, writes, errors };
}

for (const theme of ['light', 'dark']) {
  test(`create group schedule popup applies a draft and detects member changes (${theme})`, async ({ page }, testInfo) => {
    const { form, writes, errors } = await prepare(page, theme);
    const trigger = form.getByRole('button', { name: 'Find Best Schedule', exact: true });
    await expect(trigger).toBeDisabled();
    const search = form.locator('[data-guide="group-members"]');
    for (const name of ['Alice Member', 'Bob Member', 'Unknown Member']) {
      await search.fill(name);
      await form.getByText(name, { exact: true }).click();
    }
    await trigger.click();
    const popup = page.getByRole('dialog', { name: 'Find Best Schedule' });
    await expect(popup.locator('li')).toHaveCount(5);
    await expect(popup.locator('li').first()).toContainText('Monday, 7:00 PM');
    await expect(popup.locator('li').first()).toContainText('2 no recorded conflict · 0 with conflicts · 1 unknown');
    await popup.locator('li').first().getByText('View member details').click();
    await expect(popup.locator('li').first()).toContainText('Unknown / unreadable schedule: Unknown Member');
    await popup.getByLabel('Latest end').fill('17:30');
    await expect(popup.getByRole('alert')).toContainText('long enough');
    await popup.getByLabel('Latest end').fill('21:00');
    await page.keyboard.press('Escape');
    await expect(popup).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const bounds = await popup.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path: testInfo.outputPath(`suggestions-${theme}-${width}.png`) });
    }
    await popup.getByRole('button', { name: 'Use this schedule', exact: true }).first().click();
    await expect(popup).not.toBeVisible();
    await expect(form.locator('[data-guide="group-schedule"] select')).toHaveValue('Monday');
    expect(writes).toEqual([]);
    await form.getByRole('button', { name: 'Clear All', exact: true }).click();
    await expect(form.getByRole('status')).toContainText('Check schedule suggestions again');
    await search.fill('Alice Member');
    await form.getByText('Alice Member', { exact: true }).click();
    await form.getByPlaceholder('e.g. Young Professionals Book of Romans').fill('New Suggested Group');
    await form.getByRole('button', { name: 'Create Small Group', exact: true }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toMatchObject({ path: '/api/groups', body: { meeting_day: 'Monday', meeting_time: '7:00 PM - 8:30 PM', member_ids: [1] } });
    expect(errors).toEqual([]);
  });
}

test('unknown schedules show an empty result and preferences remain editable', async ({ page }) => {
  const { form, writes } = await prepare(page, 'light');
  await form.locator('[data-guide="group-members"]').fill('Unknown Member');
  await form.getByText('Unknown Member', { exact: true }).click();
  await form.getByRole('button', { name: 'Find Best Schedule', exact: true }).click();
  const popup = page.getByRole('dialog', { name: 'Find Best Schedule' });
  await expect(popup).toContainText('No reliable suggestions');
  await expect(popup.getByRole('button', { name: 'Use this schedule' })).toHaveCount(0);
  await popup.getByLabel('Session duration').selectOption('60');
  for (const checkbox of await popup.getByRole('checkbox').all()) await checkbox.uncheck();
  await expect(popup).toContainText('Select at least one preferred day');
  await popup.getByRole('button', { name: 'Close', exact: true }).click();
  expect(writes).toEqual([]);
});

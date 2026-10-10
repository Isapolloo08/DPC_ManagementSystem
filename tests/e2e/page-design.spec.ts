import { test, expect, type Page } from '@playwright/test';

test.use({ timezoneId: 'Asia/Manila', trace: 'off', launchOptions: { args: ['--disable-gpu'] } });

const pages = [
  ['Planned visits', 'Planned visits'], ['System Dashboard', 'Good afternoon, Preview.'],
  ['Members & Families', 'Members & Family Directory'], ['Attendance Live', 'Worship Service Attendance'],
  ['Attendance Log', 'Attendance Log'], ['Service Calendar', 'Service Calendar'],
  ['Bible Study Groups', 'Bible Study & Discipleship Groups'], ['My Bible Study Group', 'My Bible Study Group'],
  ['Curriculum Books/Topics', 'Topics & Books of Study'], ['Daily Bible Reading', 'Read Through the Entire Bible in 1 Year'],
  ['Saturday Duty Roster', 'Saturday Duty Roster & Rotating Teams'], ['Dishwashing Roster', 'Sunday Dishwashing & Kitchen Care'],
  ['Calendar', 'Church calendar'], ['Events & Celebrations', 'Events and Celebrations'],
  ['Announcements', 'Church Communications & Bulletins'], ['Analytics & Trends', 'Ministry Health & Growth Insights'],
  ['User Management', 'User Accounts & Role Permissions'], ['System Audit Logs', 'Security & Audit Trail'],
  ['Settings & Backups', 'System Settings & Lookups'], ['Notifications', 'Notifications'],
  ['My Profile & Settings', 'Preview User'],
] as const;
const group = { id: 11, name: 'Faith Group', leader_id: 1, leader_name: 'Preview User', members: [], status: 'active', category: 'General', ministry_id: 1, curriculum: 'Faith Foundations', meeting_day: 'Wednesday', meeting_time: '7:00 PM', location: 'Room 1', max_capacity: 12 };

async function prepare(page: Page, theme = 'light', role = 'Admin') {
  const errors: string[] = [], writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-09T14:00:00+08:00'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(({ theme, role }) => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('dpc_theme_mode', theme);
    localStorage.setItem(`dpc_help_welcome_v1:1:${role}`, 'seen');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
  }, { theme, role });
  const gates = new Map<string, { promise: Promise<void>; release: () => void }>();
  const state = {
    errors, writes,
    hold(path: string) { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); gates.set(path, { promise, release }); },
    release(path: string) { const gate = gates.get(path); gates.delete(path); gate?.release(); },
  };
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (gates.has(path)) await gates.get(path)!.promise;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
      writes.push(path); return route.fulfill({ status: 400, json: { error: 'Preview must not write records' } });
    }
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Preview User', email: 'preview@example.test', username: 'preview', role_name: role, ministries: [] } };
    else if (path.endsWith('/ministries')) json = [{ id: 1, name: 'Junior Adult', min_age: 36, max_age: 55, color: '#64748b', member_count: 0 }];
    else if (path.endsWith('/roles')) json = ['Admin', 'Pastor', 'Coordinator', 'Leader', 'Volunteer', 'Member', 'IT Admin'].map((name, i) => ({ id: i + 1, name, description: name }));
    else if (path.endsWith('/groups/mine')) json = [group];
    else if (path.endsWith('/reports/dashboard')) json = { metrics: { total_active_members: 0, total_households: 0, unenrolled_members_count: 0, upcoming_events_count: 0 }, ministry_breakdown: [] };
    else if (path.endsWith('/reports/growth-insights')) json = { baptisms: [], attendance_trends: [], groups_list: [], summary: {} };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0, total: 0, totalPages: 1 };
    else if (path.endsWith('/auth/profile-activity')) json = { attendanceCount: 0, groupsLed: [], groupsAttended: [], dutiesAssigned: [] };
    else if (path.endsWith('/planned-visits')) json = { items: [], total: 0, page: 1, totalPages: 1 };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], monthly_distribution: [], counts: { today: 0, this_week: 0, this_month: 0, next_30_days: 0 } };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: { total_qualified: 0, pending_nomination: 0 } };
    else if (path.endsWith('/duty/schedule') || path.endsWith('/dishwashing/schedule')) json = { schedule: [], total_teams: 0 };
    else if (path.endsWith('/services')) json = { services: [] };
    else if (path.endsWith('/attendance-log')) json = { rows: [], total: 0, summary: { total: 0, present: 0, absent: 0, excused: 0 } };
    else if (path.endsWith('/study-topics')) json = { topics: [], all: [], summary: {}, total: 0 };
    else if (path.endsWith('/events/recurring-sunday-cycle')) json = { events: [], year: 2026, summary: {} };
    else if (path.endsWith('/backup/summary')) json = { totalStats: {}, yearlyBreakdown: [] };
    else if (/\/groups\/\d+\/attendance-monitor$/.test(path)) json = { summary: {}, sessions: [], members: [] };
    await route.fulfill({ json });
  });
  await page.goto('/');
  await expect(page.locator(role === 'Admin' ? 'main .church-overview' : 'main [data-page-header]')).toBeVisible();
  return state;
}

async function navigate(page: Page, label: string) {
  if (await page.getByRole('button', { name: 'Toggle navigation menu' }).isVisible()) await page.getByRole('button', { name: 'Toggle navigation menu' }).click();
  await page.locator('aside').getByRole('button', { name: label, exact: true }).click();
}

for (const theme of ['light', 'dark']) {
  test(`system pages keep their intended headers on desktop and mobile in ${theme}`, async ({ page }, info) => {
    test.setTimeout(180_000);
    const state = await prepare(page, theme);
    for (const [label, title] of pages) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await navigate(page, label);
      const header = page.locator(label === 'System Dashboard' ? 'main .church-overview' : 'main [data-page-header]');
      await expect(header).toHaveCount(1);
      await expect(header.getByRole('heading', { name: title, exact: true })).toBeVisible();
      if (label !== 'System Dashboard' && label !== 'System Audit Logs') {
      await expect(header).toHaveCSS('background-color', theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(17, 26, 44)');
      await expect(header.locator('h1')).toHaveCSS('font-weight', '600');
      await expect(header.locator('h1')).toHaveCSS('font-size', label === 'Curriculum Books/Topics' ? '26px' : '30px');
      await expect(header.locator('h1')).toHaveCSS('color', theme === 'light' ? 'rgb(16, 24, 40)' : 'rgb(242, 244, 247)');
      }
      if (label === 'System Audit Logs') {
        await expect(header).toHaveClass(/bg-indigo-950/);
        await expect(header.locator('h1')).toHaveCSS('font-size', '24px');
        await expect(header.locator('h1')).toHaveCSS('color', 'rgb(255, 255, 255)');
      }
      await expect(page.locator('main .skeleton-box')).toHaveCount(0);
      if (['Members & Families', 'Attendance Live', 'User Management', 'Analytics & Trends', 'Bible Study Groups'].includes(label)) await page.screenshot({ path: info.outputPath(`${label.replaceAll(" ", "-")}-${theme}.png`) });
      await page.setViewportSize({ width: 390, height: 844 });
      const bounds = await header.boundingBox();
      expect(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 391, label).toBeTruthy();
      for (const tabs of await page.locator('main .page-tabs').all()) {
        const box = await tabs.boundingBox();
        expect(box && box.x >= 0 && box.x + box.width <= 391, `${label} tabs`).toBeTruthy();
      }
      for (const button of await header.getByRole('button').all()) {
        const box = await button.boundingBox();
        expect(box && box.x >= 0 && box.x + box.width <= 391, `${label} action`).toBeTruthy();
      }
      if (['Members & Families', 'Bible Study Groups', 'Settings & Backups', 'My Profile & Settings'].includes(label)) await page.screenshot({ path: info.outputPath(`${label.replaceAll(' ', '-')}-mobile-${theme}.png`) });
    }
    expect(state.errors).toEqual([]);
    expect(state.writes).toEqual([]);
  });
}

const pendingPages = [
  ['Members & Families', '/api/members'], ['Bible Study Groups', '/api/groups'], ['Curriculum Books/Topics', '/api/study-topics'],
  ['Saturday Duty Roster', '/api/duty/schedule'], ['Dishwashing Roster', '/api/dishwashing/schedule'],
  ['Announcements', '/api/communications/announcements'], ['Analytics & Trends', '/api/reports/growth-insights'],
  ['User Management', '/api/users'], ['System Audit Logs', '/api/audit'], ['Settings & Backups', '/api/settings/lookups'],
  ['Calendar', '/api/events'], ['My Bible Study Group', '/api/groups/mine'], ['Planned visits', '/api/planned-visits'],
  ['Notifications', '/api/notifications'], ['Service Calendar', '/api/services'], ['Events & Celebrations', '/api/events/recurring-sunday-cycle'],
] as const;

test('data pages show themed skeletons until their requests resolve', async ({ page }, info) => {
  test.setTimeout(180_000);
  const state = await prepare(page, 'dark');
  for (const [label, path] of pendingPages) {
    state.hold(path);
    await navigate(page, label);
    await expect(page.locator('main .skeleton-box').first(), label).toBeVisible();
    const skeleton = page.locator('main .skeleton-box').first();
    expect(await skeleton.evaluate(element => getComputedStyle(element, '::after').animationName)).toBe('none');
    await expect(page.locator('main [aria-busy="true"]').first(), label).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label} loading on mobile`).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    if (label === 'Members & Families') await page.screenshot({ path: info.outputPath('members-loading-dark.png') });
    if (label === 'Service Calendar') {
      await page.locator('[data-guide="service-month"]').click();
      await expect(page.getByRole('status', { name: 'Loading calendar...' })).toBeVisible();
    }
    state.release(path);
    await expect(page.locator('main .skeleton-box'), label).toHaveCount(0);
    await expect(page.locator('main [data-page-header]')).toBeVisible();
  }
  state.hold('/api/auth/profile-activity');
  await navigate(page, 'My Profile & Settings');
  await page.locator('[data-guide="profile-activity"]').click();
  await expect(page.getByRole('status', { name: 'Loading church activity...' })).toBeVisible();
  state.release('/api/auth/profile-activity');
  await expect(page.locator('main .skeleton-box')).toHaveCount(0);
  expect(state.errors).toEqual([]);
  expect(state.writes).toEqual([]);
});

test('summary filters work with the keyboard and progress reflects the recorded values', async ({ page }) => {
  const state = await prepare(page, 'dark');
  await navigate(page, 'User Management');
  const roleCard = page.locator('main .stat-card-action').filter({ hasText: 'Super Admin' });
  await expect(roleCard).toHaveAttribute('aria-pressed', 'false');
  await roleCard.focus();
  await page.keyboard.press('Enter');
  await expect(roleCard).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Space');
  await expect(roleCard).toHaveAttribute('aria-pressed', 'false');
  await navigate(page, 'Bible Study Groups');
  const activeGroups = page.locator('main .stat-card-action').filter({ hasText: 'Active Small Groups' });
  await activeGroups.focus();
  await page.keyboard.press('Enter');
  await expect(activeGroups).toHaveAttribute('aria-pressed', 'true');
  await navigate(page, 'Analytics & Trends');
  const progress = page.getByRole('progressbar', { name: 'New Member Retention' });
  await expect(progress).toHaveAttribute('aria-valuenow', '0');
  await expect(progress.locator('span')).toHaveCSS('width', '0px');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(state.errors).toEqual([]);
  expect(state.writes).toEqual([]);
});

for (const role of ['Leader', 'Volunteer']) {
  test(`${role} dashboard has the shared header and initial skeleton`, async ({ page }) => {
    const state = await prepare(page, 'light', role);
    await expect(page.locator('main [data-page-header]')).toBeVisible();
    const endpoint = role === 'Leader' ? '/api/groups' : '/api/duty/schedule';
    state.hold(endpoint);
    await page.reload();
    await expect(page.locator('main .skeleton-box').first()).toBeVisible();
    state.release(endpoint);
    await expect(page.locator('main [data-page-header]')).toBeVisible();
    await expect(page.locator('main .skeleton-box')).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    const box = await page.locator('main [data-page-header]').boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 391).toBeTruthy();
    expect(state.errors).toEqual([]);
  });
}

for (const theme of ['light', 'dark']) {
  test(`populated dishwashing cards stay readable and wrap long names in ${theme}`, async ({ page }, info) => {
    const state = await prepare(page, theme);
    const name = 'Pastor Admin/Pastor Admin/Mark Andrie M. Remot';
    const contact = 'pastor.administrator.long.contact@example.test';
    const notes = 'Plates & cutlery pre-rinse, washing & sanitizing, drying & storage, kitchen counter cleanup.';
    const team = { id: 1, name, cycle_mode: 'biblestudy_group', biblestudy_group_ids: [1, 2, 3], color: '#0284c7', order_seq: 1, leader_name: 'Pastor Administrator', leader_contact: contact, tasks_checklist: notes, members_count: 9, volunteers_count: 9, members: Array.from({ length: 9 }, (_, i) => ({ id: i + 1, member_id: i + 1, first_name: `Volunteer ${i + 1}`, last_name: 'Santos', role: 'Member' })) };
    const schedule = Array.from({ length: 16 }, (_, i) => ({ duty_date: new Date(Date.UTC(2026, 9, 11 + i * 7)).toISOString().slice(0, 10), date_formatted: `Sunday, week ${i + 1}`, week_number: i + 1, is_this_sunday: i === 0, is_next_sunday: i === 1, status: i === 0 ? 'on_duty' : 'scheduled', notes, team }));
    await page.route('**/api/dishwashing/**', route => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/teams') ? [team] : { schedule, total_teams: 1, thisSunday: schedule[0], nextSunday: schedule[1], cycle_interval_weeks: 1 } }));
    await navigate(page, 'Dishwashing Roster');
    const spotlight = page.locator('[data-dishwashing-spotlight]'), queue = page.locator('[data-dishwashing-queue]');
    await expect(spotlight.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(page.getByText('Every week', { exact: true })).toBeVisible();
    await expect(spotlight.getByText('9 Members Assigned', { exact: true })).toBeVisible();
    for (const text of [notes, contact, 'Crew Leader / Contact', 'Volunteer Crew', schedule[0].date_formatted]) {
      const ratio = await spotlight.getByText(text, { exact: true }).evaluate(element => {
        const rgb = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
        const luminance = (channels: number[]) => channels.map(channel => {
          const c = channel / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
        }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
        let parent: Element | null = element;
        while (parent && getComputedStyle(parent).backgroundColor === 'rgba(0, 0, 0, 0)') parent = parent.parentElement;
        const ink = luminance(rgb(getComputedStyle(element).color)), background = luminance(rgb(getComputedStyle(parent!).backgroundColor));
        return (Math.max(ink, background) + .05) / (Math.min(ink, background) + .05);
      });
      expect(ratio, text).toBeGreaterThanOrEqual(4.5);
    }
    await page.screenshot({ path: info.outputPath(`dishwashing-desktop-${theme}.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const element of [spotlight.locator('h2'), spotlight.getByText(contact), queue.locator('h4')]) {
      expect(await element.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
    await spotlight.screenshot({ path: info.outputPath(`dishwashing-mobile-${theme}.png`) });
    await spotlight.getByRole('button', { name: 'Swap Turn', exact: true }).click();
    await expect(page.getByText('Swap Sunday Dishwashing Turn', { exact: true })).toBeVisible();
    expect(state.errors).toEqual([]);
    expect(state.writes).toEqual([]);
  });
}

import { test, expect, type Page } from '@playwright/test';

test.use({ timezoneId: 'Asia/Manila', launchOptions: { args: ['--disable-gpu'] } });

const roster = [{
  member_id: 1, first_name: 'Juan', last_name: 'Santos', birthdate: '1985-04-15',
  gender: 'Male', member_status: 'active', ministry_id: 1, ministry_name: 'Junior Adult',
  ministry_color: '#4A5568', household_id: 1, household_name: 'Santos Household',
  attendance_id: null, checked_in_at: null, checked_out_at: null, security_code: null,
  attendance_notes: null, is_present: 0, attendance_status: 'unmarked',
}];

async function prepare(page: Page, theme = 'light') {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(theme => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
    localStorage.setItem('dpc_theme_mode', theme);
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
  }, theme);
  const pending = new Map<string, { promise: Promise<void>; release: () => void }>();
  const state = {
    errors, failLog: false,
    hold(path: string) {
      let release!: () => void;
      pending.set(path, { promise: new Promise<void>(resolve => { release = resolve; }), release });
    },
    release(path: string) {
      const gate = pending.get(path);
      pending.delete(path);
      gate?.release();
    },
  };
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const gate = pending.get(path);
    if (gate) await gate.promise;
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Design Preview', role_name: 'Admin', ministries: [] } };
    else if (path.endsWith('/ministries')) json = [{ id: 1, name: 'Junior Adult', min_age: 36, max_age: 55 }];
    else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
    else if (path.endsWith('/attendance/roster')) json = roster;
    else if (path.endsWith('/events')) json = [{ id: 1, title: 'Church Anniversary', start_time: '2026-10-11T10:00:00+08:00', end_time: '2026-10-11T12:00:00+08:00', location: 'DPC' }];
    else if (path.endsWith('/events/1/attendance-roster')) json = { attendees: roster.map(item => ({ ...item, status: 'registered' })) };
    else if (path.endsWith('/attendance-log')) {
      if (state.failLog) return route.fulfill({ status: 503, json: { error: 'Attendance history unavailable' } });
      const status = new URL(route.request().url()).searchParams.get('status') || 'present';
      json = {
        rows: [{ logType: 'bible_study', logDate: '2026-10-07', memberId: 1, memberName: 'Juan Santos', ministryName: 'Junior Adult', groupName: 'Faith Group', status, recordedAt: '2026-10-07T11:00:00Z' }],
        total: 1, summary: { total: 1, present: status === 'present' ? 1 : 0, absent: status === 'absent' ? 1 : 0, excused: 0 },
      };
    }
    await route.fulfill({ json });
  });
  await page.goto('/');
  return state;
}

async function navigate(page: Page, title: string) {
  if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Toggle navigation menu' }).click();
  await page.locator('aside').getByTitle(title, { exact: true }).click();
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const theme of ['light', 'dark']) {
  for (const mobile of [false, true]) {
    test(`attendance uses matching cards and skeletons in ${theme}${mobile ? ' on mobile' : ' on desktop'}`, async ({ page }, info) => {
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      const state = await prepare(page, theme);
      state.hold('/api/attendance/roster');
      await navigate(page, 'Attendance Live');
      const main = page.locator('main');
      await expect(main.getByText('Loading attendance...', { exact: true })).toHaveCount(1);
      await expect(main.locator('.skeleton-box').first()).toBeVisible();
      expect(await main.locator('.skeleton-box').first().evaluate(element => getComputedStyle(element, '::after').animationName)).toBe('none');
      await noOverflow(page);
      await page.screenshot({ path: info.outputPath('live-loading.png') });
      state.release('/api/attendance/roster');
      await expect(main.getByRole('heading', { name: 'Worship Service Attendance', exact: true })).toBeVisible();
      await expect(main.locator('.skeleton-box')).toHaveCount(0);
      await expect(main.getByLabel('Attendance summary', { exact: true })).toBeVisible();
      await expect(page.locator('aside').getByTitle('Attendance Live', { exact: true })).toHaveAttribute('aria-current', 'page');
      for (const title of ['Service Calendar', 'My Bible Study Group', 'Curriculum Books/Topics']) {
        const button = page.locator('aside').getByTitle(title, { exact: true });
        await expect(button).toHaveText(title);
        await expect(button.locator('span').last()).toHaveCSS('text-overflow', 'clip');
      }
      await main.locator('[data-guide="attendance-service"]').click();
      await expect(main.getByText('Recent Past Services', { exact: true })).toBeVisible();
      await noOverflow(page);
      await main.locator('[data-guide="attendance-service"]').click();
      await page.screenshot({ path: info.outputPath('live-loaded.png') });

      // Service changes hide the previous date's records until the new roster arrives.
      state.hold('/api/attendance/roster');
      await main.getByTitle('Previous Sunday Service', { exact: true }).click();
      await expect(main.getByText('Loading attendance records...', { exact: true })).toHaveCount(1);
      await expect(main.locator('[data-guide="attendance-service"]')).toBeVisible();
      state.release('/api/attendance/roster');
      await expect(main.locator('.skeleton-box')).toHaveCount(0);

      state.hold('/api/events');
      await main.locator('[data-guide="attendance-event"]').click();
      await expect(main.getByText('Loading church events...', { exact: true })).toHaveCount(1);
      await page.screenshot({ path: info.outputPath('event-loading.png') });
      state.release('/api/events');
      await expect(main.locator('[data-guide="event-attendance-event"]')).toHaveValue('1');
      await expect(main.locator('.skeleton-box')).toHaveCount(0);
      await noOverflow(page);
      await page.screenshot({ path: info.outputPath('event-loaded.png') });

      state.hold('/api/attendance-log');
      await navigate(page, 'Attendance Log');
      await expect(main.getByRole('heading', { name: 'Attendance Log', exact: true })).toBeVisible();
      await expect(main.getByText('Loading attendance records...', { exact: true })).toHaveCount(1);
      await expect(main.locator('[data-guide="log-status"]')).toBeEnabled();
      await expect(main.locator('[data-guide="log-csv"]')).toBeDisabled();
      await noOverflow(page);
      await page.screenshot({ path: info.outputPath('log-loading.png') });
      state.release('/api/attendance-log');
      await expect(main.locator('tbody')).toContainText('Juan Santos');
      await expect(main.locator('.skeleton-box')).toHaveCount(0);
      await expect(main.locator('[data-guide="log-csv"]')).toBeEnabled();
      await page.screenshot({ path: info.outputPath('log-loaded.png') });

      state.hold('/api/attendance-log');
      await main.locator('[data-guide="log-status"]').selectOption('absent');
      await expect(main.getByText('Loading attendance records...', { exact: true })).toHaveCount(1);
      await expect(main.locator('[data-guide="log-status"]')).toHaveValue('absent');
      state.release('/api/attendance-log');
      await expect(main.locator('tbody')).toContainText('Absent');
      await expect(main.locator('.skeleton-box')).toHaveCount(0);
      await noOverflow(page);
      expect(state.errors).toEqual([]);
    });
  }
}

test('attendance history failure ends loading and Retry restores records', async ({ page }) => {
  const state = await prepare(page);
  state.failLog = true;
  await navigate(page, 'Attendance Log');
  const main = page.locator('main');
  await expect(main.getByText('Attendance history unavailable', { exact: true })).toBeVisible();
  await expect(main.locator('.skeleton-box')).toHaveCount(0);
  state.failLog = false;
  state.hold('/api/attendance-log');
  await main.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(main.getByText('Loading attendance records...', { exact: true })).toHaveCount(1);
  state.release('/api/attendance-log');
  await expect(main.locator('tbody')).toContainText('Juan Santos');
  await expect(main.locator('.skeleton-box')).toHaveCount(0);
  expect(state.errors).toEqual([]);
});

test('changing log filters during a pending request keeps skeletons until the latest response', async ({ page }) => {
  const state = await prepare(page);
  state.hold('/api/attendance-log');
  await navigate(page, 'Attendance Log');
  const main = page.locator('main');
  await expect(main.getByText('Loading attendance records...', { exact: true })).toHaveCount(1);
  const nextRequest = page.waitForRequest(request => request.url().includes('/attendance-log?') && request.url().includes('status=absent'));
  await main.locator('[data-guide="log-status"]').selectOption('absent');
  await nextRequest;
  await expect(main.getByText('Loading attendance records...', { exact: true })).toHaveCount(1);
  await expect(main.getByText('No attendance records found', { exact: true })).toHaveCount(0);
  state.release('/api/attendance-log');
  await expect(main.locator('tbody')).toContainText('Absent');
  await expect(main.locator('.skeleton-box')).toHaveCount(0);
  expect(state.errors).toEqual([]);
});

test('a slower previous service response cannot replace the newest roster', async ({ page }) => {
  const state = await prepare(page);
  await navigate(page, 'Attendance Live');
  const main = page.locator('main');
  await expect(main.locator('tbody')).toContainText('Juan Santos');
  let releaseOlder!: () => void;
  const olderGate = new Promise<void>(resolve => { releaseOlder = resolve; });
  let reads = 0;
  let olderUrl = '';
  await page.route('**/api/attendance/roster?*', async route => {
    const older = ++reads === 1;
    if (older) {
      olderUrl = route.request().url();
      await olderGate;
    }
    await route.fulfill({ json: roster.map(item => ({ ...item, first_name: older ? 'Older' : 'Newest' })) });
  });
  await main.getByTitle('Previous Sunday Service', { exact: true }).click();
  await expect.poll(() => reads).toBe(1);
  await expect(main.getByText('Loading attendance records...', { exact: true })).toHaveCount(1);
  await main.getByTitle('Previous Sunday Service', { exact: true }).click();
  await expect(main.locator('tbody')).toContainText('Newest Santos');
  const olderResponse = page.waitForResponse(response => response.url() === olderUrl);
  releaseOlder();
  await (await olderResponse).finished();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(main.locator('tbody')).toContainText('Newest Santos');
  await expect(main.locator('tbody')).not.toContainText('Older Santos');
  expect(state.errors).toEqual([]);
});

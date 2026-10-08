import { test, expect, type Page, type Route } from '@playwright/test';

test.use({ timezoneId: 'Asia/Manila' });
const visit = { id: 1, receipt_id: 'preview-1', full_name: 'Preview Visitor', visit_date: '2026-10-11',
  party: 'Just me', status: 'New', created_at: '2026-10-08T08:00:00Z', updated_at: '2026-10-08T08:00:00Z',
  bringing_children: false, child_age_groups: [], email: null, phone: null, questions: '',
  consent_at: '2026-10-08T08:00:00Z', staff_notes: '' };

async function prepare(page: Page, theme = 'dark') {
  const errors: string[] = [];
  const unexpectedWrites: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(theme => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
    localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
    localStorage.setItem('dpc_theme_mode', theme);
  }, theme);
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
      unexpectedWrites.push(path);
      await route.abort();
      return;
    }
    let json: unknown = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Preview Admin', role_name: 'Admin', ministries: [] } };
    else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
    else if (path.endsWith('/duty/schedule') || path.endsWith('/dishwashing/schedule')) json = { schedule: [] };
    else if (path.endsWith('/planned-visits')) json = { items: [visit], page: 1, totalPages: 1, total: 1 };
    else if (path.endsWith('/planned-visits/1')) json = visit;
    await route.fulfill({ json });
  });
  await page.goto('/');
  await expect(page.locator('aside')).toBeVisible();
  await expect(page.getByRole('status', { name: 'System activity' })).not.toBeVisible();
  return { errors, unexpectedWrites };
}

async function hold(page: Page, pattern: string, finish: (route: Route) => Promise<void>) {
  let release!: () => void;
  let markStarted!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { markStarted = resolve; });
  await page.route(pattern, async route => {
    markStarted();
    await gate;
    await finish(route);
  });
  return { started, release };
}

for (const theme of ['light', 'dark']) {
  test(`updates show shared activity above the page and clear after completion (${theme})`, async ({ page }, testInfo) => {
    const checks = await prepare(page, theme);
    await page.locator('aside').getByRole('button', { name: /Planned visits/ }).click();
    await page.getByRole('button', { name: 'View visit for Preview Visitor' }).click();
    await page.getByLabel('Staff notes').fill('Preview note');
    const pending = await hold(page, '**/api/planned-visits/1', async route => {
      expect(route.request().method()).toBe('PATCH');
      await route.fulfill({ json: { message: 'Updated' } });
    });
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await pending.started;
    const activity = page.getByRole('status', { name: 'System activity' });
    await expect(activity).toContainText('Updating records…');
    await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath(`system-activity-${theme}.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await activity.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth;
    })).toBe(true);
    expect(await page.locator('.global-operation-progress').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
    pending.release();
    await expect(page.getByText('Visit updated.', { exact: true })).toBeVisible();
    await expect(activity).not.toBeVisible();
    expect(checks.errors).toEqual([]);
    expect(checks.unexpectedWrites).toEqual([]);
  });
}

test('an error clears shared activity and leaves the form available for retry', async ({ page }) => {
  const checks = await prepare(page);
  await page.locator('aside').getByRole('button', { name: /Planned visits/ }).click();
  await page.getByRole('button', { name: 'View visit for Preview Visitor' }).click();
  const pending = await hold(page, '**/api/planned-visits/1', route => route.fulfill({ status: 400, json: { error: 'Preview save failed' } }));
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await pending.started;
  await expect(page.getByRole('status', { name: 'System activity' })).toContainText('Updating records…');
  pending.release();
  await expect(page.getByRole('alert')).toContainText('Preview save failed');
  await expect(page.getByRole('status', { name: 'System activity' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeEnabled();
  expect(checks.errors).toEqual([]);
  expect(checks.unexpectedWrites).toEqual([]);
});

test('overlapping requests keep the write visible until every operation finishes', async ({ page }) => {
  const checks = await prepare(page);
  const write = await hold(page, '**/api/members/101', route => route.fulfill({ json: { message: 'Updated' } }));
  const read = await hold(page, '**/api/groups?*', route => route.fulfill({ json: [] }));
  await page.evaluate(async () => {
    const modulePath = '/src/api.ts';
    const { api } = await import(modulePath);
    void api.updateMember(101, { first_name: 'Preview' });
    void api.getGroups({ search: 'preview' });
  });
  await Promise.all([write.started, read.started]);
  const activity = page.getByRole('status', { name: 'System activity' });
  await expect(activity).toContainText('Updating records…');
  await expect(activity).toContainText('2 operations running');
  write.release();
  await expect(activity).toContainText('Loading Bible study groups…');
  await expect(activity).toContainText('Please wait while this finishes.');
  read.release();
  await expect(activity).not.toBeVisible();
  expect(checks.errors).toEqual([]);
  expect(checks.unexpectedWrites).toEqual([]);
});

test('cancelled requests remove activity without affecting later requests', async ({ page }) => {
  const checks = await prepare(page);
  const pending = await hold(page, '**/api/attendance-log?*', route => route.fulfill({ json: {} }));
  await page.evaluate(async () => {
    const modulePath = '/src/api.ts';
    const { api } = await import(modulePath);
    const controller = new AbortController();
    (window as any).__abortPreview = () => controller.abort();
    void api.getAttendanceLog({ search: 'abort-preview' }, controller.signal).catch(() => {});
  });
  await pending.started;
  await expect(page.getByRole('status', { name: 'System activity' })).toContainText('Loading attendance records…');
  await page.evaluate(() => (window as any).__abortPreview());
  await expect(page.getByRole('status', { name: 'System activity' })).not.toBeVisible();
  pending.release();
  expect(checks.errors).toEqual([]);
  expect(checks.unexpectedWrites).toEqual([]);
});

test('the activity remains active throughout a failed read and its retry', async ({ page }) => {
  const checks = await prepare(page);
  let release!: () => void;
  let markRetry!: () => void;
  let attempts = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const retried = new Promise<void>(resolve => { markRetry = resolve; });
  await page.route('**/api/backup/summary', async route => {
    attempts++;
    if (attempts === 1) { await route.fulfill({ status: 503, json: { error: 'Temporary failure' } }); return; }
    markRetry();
    await gate;
    await route.fulfill({ json: { success: true, totalStats: {}, yearlyBreakdown: [] } });
  });
  await page.evaluate(async () => {
    const modulePath = '/src/api.ts';
    const { api } = await import(modulePath);
    void api.getBackupSummary();
  });
  await retried;
  const activity = page.getByRole('status', { name: 'System activity' });
  await expect(activity).toContainText('Loading backup records…');
  await expect(activity).toContainText('Please wait while this finishes.');
  release();
  await expect(activity).not.toBeVisible();
  expect(attempts).toBe(2);
  expect(checks.errors).toEqual([]);
  expect(checks.unexpectedWrites).toEqual([]);
});

test('CSV downloads also show activity until the export response is ready', async ({ page }) => {
  const checks = await prepare(page);
  const pending = await hold(page, '**/api/attendance-log/export.csv*', route => route.fulfill({ contentType: 'text/csv', body: 'name,status\nPreview,present\n' }));
  await page.evaluate(async () => {
    const modulePath = '/src/api.ts';
    const { api } = await import(modulePath);
    void api.exportAttendanceLogCsv();
  });
  await pending.started;
  await expect(page.getByRole('status', { name: 'System activity' })).toContainText('Preparing attendance export…');
  pending.release();
  await expect(page.getByRole('status', { name: 'System activity' })).not.toBeVisible();
  expect(checks.errors).toEqual([]);
  expect(checks.unexpectedWrites).toEqual([]);
});

test('PDF generation keeps its status visible until the report downloads', async ({ page }) => {
  const checks = await prepare(page);
  const report = { rows: [{ id: 1, logType: 'sunday_service', logDate: '2026-10-04',
    memberName: 'Preview Member', ministryName: 'Youth', status: 'present', recordedAt: '2026-10-04T02:00:00Z' }],
    total: 1, summary: { total: 1, present: 1, absent: 0, excused: 0 } };
  await page.route('**/api/attendance-log?*', route => route.fulfill({ json: report }));
  await page.locator('aside').getByRole('button', { name: /Attendance Log/ }).click();
  const exportButton = page.getByRole('button', { name: 'Export PDF', exact: true });
  await expect(exportButton).toBeEnabled();
  const pending = await hold(page, '**/api/attendance-log?*', route => route.fulfill({ json: report }));
  const downloaded = page.waitForEvent('download');
  await exportButton.click();
  await pending.started;
  await expect(page.getByRole('status', { name: 'System activity' })).toContainText('Generating PDF report…');
  await expect(exportButton).toBeDisabled();
  pending.release();
  expect((await downloaded).suggestedFilename()).toMatch(/attendance-log.*\.pdf$/);
  await expect(page.getByRole('status', { name: 'System activity' })).not.toBeVisible();
  await expect(exportButton).toBeEnabled();
  expect(checks.errors).toEqual([]);
  expect(checks.unexpectedWrites).toEqual([]);
});

test('server connection checks show activity above their modal', async ({ page }) => {
  const checks = await prepare(page);
  await page.keyboard.press('Control+p');
  const pending = await hold(page, '**/api/health', route => route.fulfill({ json: { service: 'Preview server' } }));
  await page.getByRole('button', { name: 'Test Connection', exact: true }).click();
  await pending.started;
  await expect(page.getByRole('status', { name: 'System activity' })).toContainText('Testing server connection…');
  pending.release();
  await expect(page.getByText('Connected to Database Server!', { exact: false })).toBeVisible();
  await expect(page.getByRole('status', { name: 'System activity' })).not.toBeVisible();
  expect(checks.errors).toEqual([]);
  expect(checks.unexpectedWrites).toEqual([]);
});

for (const action of [
  { name: 'deletion', path: '/members/101', method: 'DELETE', message: 'Deleting records…' },
  { name: 'backup', path: '/backup/export', method: 'POST', message: 'Generating backup…' },
  { name: 'restore', path: '/backup/restore', method: 'POST', message: 'Restoring database…' },
  { name: 'cloud push', path: '/cloud-sync/push', method: 'POST', message: 'Uploading records to cloud…' },
  { name: 'cloud pull', path: '/cloud-sync/pull', method: 'POST', message: 'Downloading cloud records…' },
]) {
  test(`${action.name} shows its transaction status and clears on completion`, async ({ page }) => {
    const checks = await prepare(page);
    const pending = await hold(page, `**/api${action.path}`, async route => {
      expect(route.request().method()).toBe(action.method);
      await route.fulfill({ json: { success: true, message: 'Preview complete' } });
    });
    await page.evaluate(async name => {
      const modulePath = '/src/api.ts';
      const { api } = await import(modulePath);
      if (name === 'deletion') void api.deleteMember(101);
      if (name === 'backup') void api.exportBackup('all', 'preview-password');
      if (name === 'restore') void api.restoreBackup({ tables: {} }, 'merge', 'preview-password');
      if (name === 'cloud push') void api.pushToCloud();
      if (name === 'cloud pull') void api.pullFromCloud();
    }, action.name);
    await pending.started;
    const activity = page.getByRole('status', { name: 'System activity' });
    await expect(activity).toContainText(action.message);
    await expect(activity).not.toContainText('preview-password');
    pending.release();
    await expect(activity).not.toBeVisible();
    expect(checks.errors).toEqual([]);
    expect(checks.unexpectedWrites).toEqual([]);
  });
}

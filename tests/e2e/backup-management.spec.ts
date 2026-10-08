import { test, expect, type Page } from '@playwright/test';

test.use({ timezoneId: 'Asia/Manila' });
const summary = {
  success: true, generatedAt: '2026-10-08T10:00:00Z',
  totalStats: { members: 80, attendance: 74, events: 6, duty_schedules: 3, dishwashing_roster: 2, audit_logs: 311 },
  yearlyBreakdown: [2026, 2025].map(year => ({ year, attendance: 37, events: 3, dutySchedules: 2,
    dishwashingRoster: 1, announcements: 2, notifications: 4, membersCreated: 40, totalRecords: 49 })),
};
const cloud = { configured: true, connected: true, cloudHost: 'cloud.example.test',
  lastSyncedAt: '2026-10-08T06:47:34Z', lastSyncedBy: 'Test Administrator', lastSyncDirection: 'push', comparison: [] };

async function prepare(page: Page, theme = 'dark', options: { empty?: boolean; failure?: boolean; cloud?: string } = {}) {
  const errors: string[] = [];
  const writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-08T10:00:00Z'));
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
      writes.push(path);
      await route.abort();
      return;
    }
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Administrator', role_name: 'Admin', ministries: [] } };
    else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
    else if (path.endsWith('/duty/schedule') || path.endsWith('/dishwashing/schedule')) json = { schedule: [] };
    else if (path.endsWith('/backup/summary')) {
      if (options.failure) { await route.fulfill({ status: 503, json: { error: 'Overview temporarily unavailable' } }); return; }
      json = options.empty ? { ...summary, yearlyBreakdown: [] } : summary;
    } else if (path.endsWith('/cloud-sync/status')) {
      if (options.cloud === 'unavailable') { await route.fulfill({ status: 503, json: { error: 'Cloud unavailable' } }); return; }
      json = options.cloud === 'offline' ? { ...cloud, connected: false }
        : options.cloud === 'setup' ? { ...cloud, connected: false, configured: false, lastSyncedAt: null } : cloud;
    } else if (path.includes('/backup/year-details/')) json = { success: true, year: Number(path.split('/').pop()), tables: { attendance: [{ id: 1, member_name: 'Preview Member', checked_in_at: '2025-10-08T08:00:00' }], events: [], duty_schedules: [], dishwashing_roster: [], announcements: [], notifications: [], members_created: [] } };
    await route.fulfill({ json });
  });
  await page.goto('/');
  await page.locator('aside').getByRole('button', { name: /Settings & Backups/ }).click();
  await page.getByRole('button', { name: 'Backup & Data Management', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Backup & Data Management', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Backup and data workspace' })).toBeVisible();
  return { errors, writes };
}

for (const theme of ['light', 'dark']) {
  test(`backup workspace is compact, singular, responsive, and keyboard accessible (${theme})`, async ({ page }, testInfo) => {
    const { errors, writes } = await prepare(page, theme);
    const workspace = page.getByRole('region', { name: 'Backup and data workspace' });
    await expect(workspace).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'System Settings & Dropdowns' })).toHaveCount(0);
    await expect(workspace.getByText('Connected', { exact: true })).toBeVisible();
    const create = workspace.getByRole('button', { name: 'Create backup', exact: true });
    const bounds = await create.boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThan(1000);
    await page.screenshot({ path: testInfo.outputPath(`backup-${theme}-desktop.png`) });
    await workspace.screenshot({ path: testInfo.outputPath(`backup-${theme}-workspace.png`) });
    await create.click();
    await expect(page.getByRole('dialog', { name: 'Generate Full Database Backup' })).toBeVisible();
    await page.keyboard.press('Escape');
    await workspace.getByLabel('What would you like to back up?').selectOption('2025');
    await create.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Generate Backup — Year 2025' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Download/ })).toBeDisabled();
    await dialog.getByLabel('Account password').fill('temporary-preview');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(create).toBeFocused();
    await create.click();
    await expect(dialog.getByLabel('Account password')).toHaveValue('');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await workspace.getByRole('button', { name: 'Choose backup file' }).click();
    await expect(page.getByRole('dialog', { name: 'Restore Database from Backup' })).toBeVisible();
    await page.keyboard.press('Escape');
    await workspace.getByRole('button', { name: 'Inspect 2025 records' }).click();
    const inspector = page.getByRole('dialog', { name: 'Data Inspector — Year 2025' });
    await expect(inspector).toBeVisible();
    await inspector.getByRole('button', { name: 'Backup Year' }).click();
    await expect(inspector).not.toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await workspace.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(create).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`backup-${theme}-mobile.png`) });
    await create.click();
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(panel => panel.scrollWidth <= panel.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`backup-dialog-${theme}-mobile.png`) });
    await page.keyboard.press('Escape');
    await workspace.getByRole('button', { name: 'Choose backup file' }).click();
    const restore = page.getByRole('dialog', { name: 'Restore Database from Backup' });
    await expect(restore).toBeVisible();
    expect(await restore.evaluate(panel => panel.scrollWidth <= panel.clientWidth)).toBe(true);
    await restore.getByLabel('Backup JSON file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('invalid-json') });
    await expect(restore).toContainText('not valid JSON');
    await page.keyboard.press('Escape');
    const danger = workspace.locator('details');
    await danger.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(workspace.getByLabel('Year to delete')).toHaveValue('');
    await expect(workspace.getByRole('button', { name: 'Preview deletion' })).toBeDisabled();
    await workspace.getByLabel('Year to delete').selectOption('2025');
    await workspace.getByRole('button', { name: 'Preview deletion' }).click();
    await expect(page.getByRole('dialog', { name: 'Purge Data for Year 2025' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`deletion-dialog-${theme}-mobile.png`) });
    await expect(page.locator('[data-guide="purge-execute"]')).toBeDisabled();
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
  });
}

test('empty annual records still allow a full backup and prevent deletion', async ({ page }) => {
  const { errors, writes } = await prepare(page, 'light', { empty: true });
  await expect(page.getByText('No annual activity records yet.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create backup', exact: true })).toBeEnabled();
  await page.locator('details summary').click();
  await expect(page.getByLabel('Year to delete')).toBeDisabled();
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});

test('failed overview can be retried without enabling unavailable backups', async ({ page }) => {
  const options = { failure: true };
  const { errors, writes } = await prepare(page, 'dark', options);
  await expect(page.getByRole('region', { name: 'Backup and data workspace' }).getByRole('alert')).toContainText('Refresh to try again');
  await expect(page.getByRole('button', { name: 'Create backup', exact: true })).toBeDisabled();
  options.failure = false;
  await page.getByRole('button', { name: 'Refresh database overview' }).click();
  await expect(page.getByRole('button', { name: 'Create backup', exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});

for (const [state, label] of [['offline', 'Offline'], ['setup', 'Setup required'], ['unavailable', 'Status unavailable']]) {
  test(`cloud ${state} is represented accurately`, async ({ page }) => {
    const { errors, writes } = await prepare(page, 'dark', { cloud: state });
    await expect(page.getByRole('region', { name: 'Backup and data workspace' }).getByText(label, { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
  });
}

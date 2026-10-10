import { test, expect, type Page } from '@playwright/test';

async function prepare(page: Page, options: { theme?: string; saved?: string; rejectSave?: boolean; running?: boolean } = {}) {
  const errors: string[] = [], writes: string[] = [], saves: string[] = [], copied: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.exposeFunction('recordServerSave', (value: string) => saves.push(value));
  await page.exposeFunction('recordCopiedAddress', (value: string) => copied.push(value));
  await page.addInitScript(options => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
    localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
    localStorage.setItem('dpc_theme_mode', options.theme || 'light');
    if (options.saved) localStorage.setItem('dpc_server_ip', options.saved);
    (window as any).electronAPI = {
      isElectron: false,
      getServerConfig: async () => ({ hostname: 'CHURCH-MAIN-PC', lanIps: ['192.168.1.10'], isMaster: !options.saved, isServerRunning: options.running ?? true }),
      setServerConfig: async ({ serverIp }: { serverIp: string }) => {
        await (window as any).recordServerSave(serverIp);
        if (options.rejectSave) throw new Error('Desktop settings could not be saved.');
        return { success: true };
      },
    };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (text: string) => (window as any).recordCopiedAddress(text) } });
  }, options);
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') { writes.push(path); return route.abort(); }
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Preview Administrator', email: 'admin@example.test', role_name: 'Admin', ministries: [] } };
    else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
    else if (path.endsWith('/duty/schedule') || path.endsWith('/dishwashing/schedule')) json = { schedule: [] };
    else if (path.endsWith('/cloud-sync/status')) json = { configured: true, connected: true, comparison: [] };
    else if (path.endsWith('/health')) json = { service: 'Preview server' };
    await route.fulfill({ json });
  });
  await page.goto('/');
  await expect(page.locator('aside')).toBeVisible();
  await page.keyboard.press('Control+p');
  const dialog = page.getByRole('dialog', { name: 'System Configuration', exact: true });
  await expect(dialog).toBeVisible();
  return { dialog, errors, writes, saves, copied };
}

for (const theme of ['light', 'dark']) {
  test(`configuration is readable and responsive with consistent actions (${theme})`, async ({ page }, testInfo) => {
    const checks = await prepare(page, { theme });
    const { dialog } = checks;
    await expect(dialog.getByRole('radio', { name: /This computer/ })).toBeChecked();
    await expect(dialog.getByLabel('Server address', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('Local server is running', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Current API address')).not.toBeVisible();
    await dialog.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(dialog.getByText('Current API address')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(dialog.getByText('Current API address')).not.toBeVisible();
    await dialog.getByRole('button', { name: 'Copy computer name' }).click();
    expect(checks.copied).toEqual(['CHURCH-MAIN-PC:4000']);
    const save = dialog.getByRole('button', { name: 'Save connection', exact: true });
    const size = await save.boundingBox();
    expect(size!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: testInfo.outputPath(`configuration-${theme}-desktop.png`) });
    await dialog.getByRole('radio', { name: /Another computer/ }).check();
    await expect(save).toBeDisabled();
    await dialog.getByLabel('Server address', { exact: true }).fill('CHURCH-PC');
    await expect(save).toBeEnabled();
    await dialog.getByRole('radio', { name: /This computer/ }).check();
    await dialog.getByRole('radio', { name: /Another computer/ }).check();
    await expect(dialog.getByLabel('Server address', { exact: true })).toHaveValue('CHURCH-PC');
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const mobileSave = await save.boundingBox();
    expect(mobileSave!.y + mobileSave!.height).toBeLessThan(844);
    await page.screenshot({ path: testInfo.outputPath(`configuration-${theme}-mobile.png`) });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await page.keyboard.press('Control+p');
    await expect(dialog.getByRole('radio', { name: /This computer/ })).toBeChecked();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(checks.saves).toEqual([]);
    expect(checks.writes).toEqual([]);
    expect(checks.errors).toEqual([]);
  });
}

test('connection failure can be retried and editing clears the old result', async ({ page }) => {
  const checks = await prepare(page, { saved: 'CHURCH-PC', running: false });
  let failure = true;
  await page.route('**/api/health', route => route.fulfill({ status: failure ? 503 : 200, json: {} }));
  await checks.dialog.getByRole('button', { name: 'Test Connection', exact: true }).click();
  await expect(checks.dialog.getByRole('alert')).toContainText('HTTP 503');
  failure = false;
  await checks.dialog.getByRole('button', { name: 'Test Connection', exact: true }).click();
  await expect(checks.dialog.getByRole('status')).toContainText('Connected to Database Server!');
  await checks.dialog.getByLabel('Server address', { exact: true }).fill('NEW-PC');
  await expect(checks.dialog.getByRole('status')).toHaveCount(0);
  await checks.dialog.getByRole('radio', { name: /This computer/ }).check();
  await expect(checks.dialog.getByText('Local server is not running', { exact: true })).toBeVisible();
  expect(checks.saves).toEqual([]);
  expect(checks.errors).toEqual([]);
});

test('discovery lets the user choose an address before saving', async ({ page }) => {
  const checks = await prepare(page);
  await checks.dialog.getByRole('radio', { name: /Another computer/ }).check();
  await checks.dialog.getByRole('button', { name: 'Find local server', exact: true }).click();
  await expect(checks.dialog.getByRole('status')).toContainText('Server found: CHURCH-MAIN-PC');
  await expect(checks.dialog.getByLabel('Server address', { exact: true })).toHaveValue('');
  await checks.dialog.getByRole('button', { name: 'Use this address', exact: true }).click();
  await expect(checks.dialog.getByLabel('Server address', { exact: true })).toHaveValue('http://CHURCH-MAIN-PC:4000');
  expect(checks.saves).toEqual([]);
  expect(checks.errors).toEqual([]);
});

test('a failed desktop save preserves the previous connection', async ({ page }) => {
  const checks = await prepare(page, { saved: 'ORIGINAL-PC', rejectSave: true });
  await checks.dialog.getByLabel('Server address', { exact: true }).fill('NEW-PC');
  await checks.dialog.getByRole('button', { name: 'Save connection', exact: true }).click();
  await expect(checks.dialog.getByRole('alert')).toContainText('Connection was not saved.');
  expect(await page.evaluate(() => localStorage.getItem('dpc_server_ip'))).toBe('ORIGINAL-PC');
  expect(checks.saves).toEqual(['NEW-PC']);
  await expect(checks.dialog.getByRole('button', { name: 'Save connection', exact: true })).toBeEnabled();
  expect(checks.errors).toEqual([]);
});

test('saving an address applies the desktop configuration and reloads the app', async ({ page }) => {
  const checks = await prepare(page);
  await checks.dialog.getByRole('radio', { name: /Another computer/ }).check();
  await checks.dialog.getByLabel('Server address', { exact: true }).fill('CHURCH-PC');
  const reload = page.waitForEvent('domcontentloaded');
  await checks.dialog.getByRole('button', { name: 'Save connection', exact: true }).click();
  await reload;
  expect(checks.saves).toEqual(['CHURCH-PC']);
  expect(await page.evaluate(() => localStorage.getItem('dpc_server_ip'))).toBe('CHURCH-PC');
  expect(checks.errors).toEqual([]);
});

test('invalid addresses cannot change the saved connection', async ({ page }) => {
  const checks = await prepare(page);
  await checks.dialog.getByRole('radio', { name: /Another computer/ }).check();
  await checks.dialog.getByLabel('Server address', { exact: true }).fill('https://user:password@server.example');
  await checks.dialog.getByRole('button', { name: 'Save connection', exact: true }).click();
  await expect(checks.dialog.getByRole('alert')).toContainText('without credentials');
  expect(checks.saves).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('dpc_server_ip'))).toBeNull();
  expect(checks.errors).toEqual([]);
});

test('cloud sync opens separately and returns to the connection draft', async ({ page }) => {
  const checks = await prepare(page);
  await checks.dialog.getByRole('radio', { name: /Another computer/ }).check();
  await checks.dialog.getByLabel('Server address', { exact: true }).fill('UNSAVED-PC');
  await checks.dialog.locator('summary').click();
  await checks.dialog.getByRole('button', { name: 'Open cloud sync', exact: true }).click();
  await expect(checks.dialog).toHaveCount(0);
  const cloud = page.locator('[data-viewport-overlay]').filter({ hasText: 'Supabase Cloud Sync & Backup' });
  await expect(cloud).toBeVisible();
  await cloud.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(checks.dialog).toBeVisible();
  await expect(checks.dialog.getByLabel('Server address', { exact: true })).toHaveValue('UNSAVED-PC');
  expect(checks.saves).toEqual([]);
  expect(checks.writes).toEqual([]);
  expect(checks.errors).toEqual([]);
});

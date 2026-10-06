import { test, expect, type Page, type Locator } from '@playwright/test';

async function prepare(page: Page, theme: string) {
  const errors: string[] = [];
  const writes: { path: string; body: any }[] = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(theme => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
    localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
    localStorage.setItem('dpc_theme_mode', theme);
  }, theme);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writes.push({ path, body: request.postDataJSON() });
      return route.fulfill({ json: { id: 20, message: 'Saved' } });
    }
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Admin', email: 'admin@example.test', username: 'admin', role_name: 'Admin', ministries: [] } };
    else if (path.endsWith('/ministries')) json = [{ id: 1, name: 'Youth', min_age: 17, max_age: 21 }];
    else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/members/check-duplicate')) json = { duplicateName: null };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
    else if (path.endsWith('/roles')) json = [{ id: 1, name: 'Admin' }];
    else if (path.endsWith('/study-topics')) json = { topics: [], total_count: 0 };
    else if (path.endsWith('/events/calendar')) json = { activities: [], birthdays: [] };
    await route.fulfill({ json });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open Start Here' })).toBeVisible();
  return { errors, writes };
}

async function navigate(page: Page, title: string) {
  if (page.viewportSize()!.width < 1024) await page.getByRole('button', { name: 'Toggle navigation menu' }).click();
  await page.getByTitle(title, { exact: true }).click();
}

async function assertFixedControls(page: Page, panel: Locator, saveName?: string) {
  const header = panel.locator('[data-modal-header]').first();
  const body = panel.locator('[data-modal-body]').first();
  const close = header.locator('button').last();
  await expect(header).toBeVisible();
  const before = await header.boundingBox();
  const save = saveName ? panel.getByRole('button', { name: saveName, exact: true }) : null;
  const saveBefore = await save?.boundingBox();
  await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => body.evaluate(element => element.scrollTop)).toBeGreaterThan(20);
  const after = await header.boundingBox();
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
  const box = await close.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThan(page.viewportSize()!.height);
  if (save) {
    const saveAfter = await save.boundingBox();
    expect(Math.abs(saveAfter!.y - saveBefore!.y)).toBeLessThan(1);
    expect(saveAfter!.y + saveAfter!.height).toBeLessThan(page.viewportSize()!.height);
    await save.click({ trial: true });
  }
  await close.click();
  await expect(panel).not.toBeVisible();
}

const forms = [
  { name: 'household', nav: 'Members & Families', open: 'New Household', heading: 'Create Household Family Group', save: 'Create Household' },
  { name: 'member', nav: 'Members & Families', open: 'Add Member', heading: 'Add New Member Record', save: 'Save Application Record' },
  { name: 'event', nav: 'Events & Celebrations', open: 'Add Event / Celebration', heading: 'Create Event / Celebration', save: 'Create Annual Celebration' },
  { name: 'user', nav: 'User Management', open: 'Add New User', heading: 'Add New User Account', save: 'Create User Account' },
  { name: 'Bible Study group', nav: 'Bible Study Groups', open: 'New Bible Study Group', heading: 'Create New Bible Study Small Group', save: 'Create Small Group' },
];

for (const viewport of [{ width: 1440, height: 500 }, { width: 390, height: 600 }]) {
  for (const form of forms) {
    test(`${form.name} header and actions remain visible after scrolling at ${viewport.width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      const state = await prepare(page, viewport.width === 390 ? 'dark' : 'light');
      await navigate(page, form.nav);
      await page.getByRole('button', { name: form.open, exact: true }).click();
      const panel = page.locator('[data-modal-panel]').filter({ has: page.getByRole('heading', { name: form.heading, exact: true }) });
      await expect(panel).toBeVisible();
      if (form.name === 'household') await page.screenshot({ path: testInfo.outputPath('household-fixed-header.png') });
      await assertFixedControls(page, panel, form.save);
      expect(state.errors).toEqual([]);
      expect(state.writes).toEqual([]);
    });
  }
  test(`Help close stays visible after scrolling at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const state = await prepare(page, 'light');
    await page.getByRole('button', { name: 'Open Start Here' }).click();
    await assertFixedControls(page, page.getByRole('dialog', { name: 'Start Here' }));
    expect(state.errors).toEqual([]);
  });
}

test('fixed household action still validates and submits its form', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  const state = await prepare(page, 'light');
  await navigate(page, 'Members & Families');
  await page.getByRole('button', { name: 'New Household', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create Household' });
  await dialog.getByRole('button', { name: 'Create Household', exact: true }).click();
  expect(state.writes).toEqual([]);
  await dialog.getByPlaceholder(/e.g. The .* Family/).fill('Santos Family');
  await dialog.getByRole('button', { name: 'Create Household', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({ path: '/api/households', body: { name: 'Santos Family' } });
  expect(state.errors).toEqual([]);
});

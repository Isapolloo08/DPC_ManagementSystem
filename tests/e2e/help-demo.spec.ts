import { test, expect, type Page } from '@playwright/test';
import { pageTours } from '../../client/src/components/help/workflowGuides';

async function prepare(page: Page, role = 'Admin') {
  const state = { writes: [] as string[], demoRequests: [] as string[], errors: [] as string[] };
  page.on('pageerror', error => state.errors.push(error.message));
  page.on('request', request => {
    if (request.url().includes('/api/') && request.frame() !== page.mainFrame()) state.demoRequests.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(role => {
    // Fixtures are for the parent only; the sample document initializes itself.
    if (location.search.includes('guide-demo=1')) return;
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.REAL');
    localStorage.setItem('dpc_theme_mode', 'dark');
    localStorage.setItem('dpc_kitchen_protocols', 'REAL PRIVATE PROTOCOL');
    localStorage.setItem(`dpc_help_welcome_v1:1:${role}`, 'seen');
  }, role);
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') { state.writes.push(`${request.method()} ${path}`); return route.fulfill({ status: 400, json: { error: 'No real writes permitted' } }); }
    let json: any = [];
    if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'REAL PRIVATE USER', role_name: role, email: 'real@example.test', ministries: [] } };
    else if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true, demoModeEnabled: false };
    else if (path.endsWith('/ministries')) json = [{ id: 1, name: 'Youth', min_age: 17, max_age: 25, member_count: 0 }];
    else if (path.endsWith('/reports/dashboard')) json = { metrics: { total_active_members: 0, total_households: 0, unenrolled_members_count: 0, upcoming_events_count: 0 }, ministry_breakdown: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/notifications/unread-count')) json = { count: 0 };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
    else if (path.endsWith('/study-topics')) json = { topics: [], total_count: 0 };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    else if (path.endsWith('/duty/schedule') || path.endsWith('/dishwashing/schedule')) json = { schedule: [], total_teams: 0 };
    await route.fulfill({ json });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open Start Here' })).toBeVisible();
  return state;
}
async function previewGroup(page: Page) {
  await page.getByRole('button', { name: 'Open Start Here' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Find a guide').fill('Manage my Bible study group');
  await dialog.getByRole('button', { name: /^Manage my Bible study group/ }).click();
  const guide = page.getByRole('region', { name: 'Manage my Bible study group', exact: true });
  await expect(guide).toHaveAttribute('data-guide-mode', 'setup');
  await guide.getByRole('button', { name: 'Preview with sample data' }).click();
  return page.frameLocator('iframe[title="Interactive guide demo"]');
}

test('empty group preview uses the real UI, dummy account and interactive roll call without server access', async ({ page }, testInfo) => {
  const state = await prepare(page);
  const frame = await previewGroup(page);
  const guide = frame.getByRole('region', { name: 'Manage my Bible study group', exact: true });
  await expect(frame.getByRole('button', { name: /Demo Admin Admin/ })).toBeVisible();
  await expect(frame.getByText('Sample Faith Group', { exact: true }).first()).toBeVisible();
  await expect(frame.locator('body')).not.toContainText('REAL PRIVATE USER');
  await expect(guide).toHaveAttribute('data-guide-mode', 'walkthrough');
  await guide.getByRole('button', { name: /Go to step 3:/ }).click();
  await expect(frame.locator('[data-guide="my-group-rollcall"]')).toHaveAttribute('data-guide-highlight', 'true');
  await expect(frame.locator('[data-guide="my-group-rollcall"]')).toContainText('Ana Sample');
  await frame.locator('[data-guide="my-group-rollcall"]').getByText('Ana Sample', { exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('actual-group-demo-dark.png') });
  await guide.getByRole('button', { name: /Go to step 4:/ }).click();
  await frame.getByRole('button', { name: 'Save Session Attendance' }).click();
  await expect(frame.getByText(/Logged attendance for 1 members/)).toBeVisible();
  await guide.getByRole('button', { name: 'Close guide' }).click();
  await frame.locator('[data-guide="my-group-attendance"]').click();
  await expect(frame.getByRole('button', { name: /Disciple Absentee Breakdown 3/ })).toBeVisible();
  await expect(frame.getByText('Ana Sample', { exact: true }).first()).toBeVisible();
  await frame.getByRole('button', { name: /Past Session History Logs/ }).click();
  await expect(frame.locator('main')).toContainText('Chapter 2');
  expect(state.writes).toEqual([]);
  expect(state.demoRequests).toEqual([]);
  expect(state.errors).toEqual([]);
  await page.getByRole('dialog').getByRole('button', { name: 'Return to real guide' }).click();
  await expect(page.locator('[data-guide="my-group-empty"]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('chms_token'))).toMatch(/\.REAL$/);
});

test('sample saves, reset, theme and logout cannot affect real data or preferences', async ({ page }) => {
  const state = await prepare(page);
  await previewGroup(page);
  let frame = page.frameLocator('iframe[title="Interactive guide demo"]');
  await frame.getByRole('button', { name: 'Close guide' }).click();
  await frame.locator('aside').getByRole('button', { name: /^Announcements/ }).click();
  await frame.locator('[data-guide="announcement-new"]').click();
  await frame.locator('[data-guide="announcement-title"]').fill('Practice announcement');
  await frame.locator('[data-guide="announcement-body"]').fill('This must exist only in memory.');
  await frame.locator('[data-guide="announcement-save"]').click();
  await expect(frame.getByText('Practice announcement', { exact: true })).toBeVisible();
  const blocked = await frame.locator('body').evaluate(async () => {
    try { await fetch('/api/members', { method: 'POST', body: 'private test' }); return false; }
    catch { return true; }
  });
  expect(blocked).toBe(true);
  await frame.getByRole('combobox', { name: 'Appearance' }).selectOption('light');
  expect(await page.evaluate(() => localStorage.getItem('dpc_theme_mode'))).toBe('dark');
  expect(await page.evaluate(() => localStorage.getItem('dpc_kitchen_protocols'))).toBe('REAL PRIVATE PROTOCOL');
  await page.getByRole('button', { name: 'Restart demo' }).click();
  frame = page.frameLocator('iframe[title="Interactive guide demo"]');
  await frame.getByRole('button', { name: 'Close guide' }).click();
  await frame.locator('aside').getByRole('button', { name: /^Announcements/ }).click();
  await expect(frame.getByText('Practice announcement', { exact: true })).toHaveCount(0);
  await frame.locator('aside').getByRole('button', { name: 'Sign Out of Account' }).click();
  await expect(frame.getByText(/Close or restart the demo/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('chms_token'))).toMatch(/\.REAL$/);
  expect(state.writes).toEqual([]);
  expect(state.demoRequests).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('sample batch roll call changes the displayed roster without reaching a backend', async ({ page }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/')) requests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-04T10:00:00+08:00'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?guide-demo=1&guide=batch-attendance&role=Admin&theme=dark');
  const guide = page.locator('.help-guide-panel');
  await guide.getByRole('button', { name: /Go to step 4:/ }).click();
  await expect(page.locator('[data-guide="attendance-method-absent"]')).toHaveAttribute('data-guide-highlight', 'true');
  await guide.getByRole('button', { name: 'Close guide' }).click();
  const row = page.locator('tbody tr').filter({ hasText: 'Ana Sample' });
  await row.getByRole('checkbox').check();
  await expect(page.locator('[data-guide="attendance-batch-save"]').first()).toContainText('1 Absent, 5 Present');
  await page.locator('[data-guide="attendance-batch-save"]').first().click();
  await expect(page.getByText('Attendance updated successfully (5 Present, 1 Absent)', { exact: true })).toBeVisible();
  await expect(row).toContainText('Absent');
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

for (const tab of Object.keys(pageTours)) {
  test(`sample ${tab} page mounts its real components and walkthrough using only dummy data`, async ({ page }) => {
    const errors: string[] = [], requests: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().includes('/api/') || request.url().includes('/socket.io/')) requests.push(request.url()); });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/?guide-demo=1&guide=page-${tab}&role=Admin&theme=dark`);
    await expect(page.locator('.help-guide-panel')).toHaveAttribute('data-guide-mode', 'walkthrough');
    await expect(page.locator('main')).not.toContainText('No assigned group');
    await expect(page.locator('main')).not.toContainText('Preparing sample workspace');
    await expect(page.locator('.help-step-navigation button')).toHaveCount(pageTours[tab].filter(step => !step.roles || step.roles.includes('Admin')).length);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

import { test, expect, type Page } from '@playwright/test';

const group = (id: number, name: string) => ({
  id, name, leader_name: 'Assigned Leader', leader_contact: 'assigned@example.test',
  members: [], status: 'active', category: 'General', ministry_id: 1,
  curriculum: 'Faith Foundations', current_chapter: 'Chapter 1',
  meeting_day: 'Wednesday', meeting_time: '7:00 PM - 8:00 PM', location: 'Room 1', max_capacity: 12,
});

async function prepare(page: Page, role: string, assigned: ReturnType<typeof group>[]) {
  const state = { assigned, fail: false, personalGroupRequests: 0 };
  await page.addInitScript(role => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
    localStorage.setItem('dpc_theme_mode', 'dark');
    localStorage.setItem(`dpc_help_welcome_v1:1:${role}`, 'seen');
  }, role);
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/setup-status') return route.fulfill({ json: { hasUsers: true, hasAdmin: true } });
    if (path === '/api/auth/me') return route.fulfill({ json: { user: {
      id: 1, name: 'Account Without Email', email: null, username: 'account', role_name: role, ministries: [],
    } } });
    if (path === '/api/ministries') return route.fulfill({ json: [] });
    if (path === '/api/groups/mine') {
      state.personalGroupRequests++;
      return route.fulfill(state.fail
        ? { status: 403, json: { error: 'Cannot load groups' } } : { json: state.assigned });
    }
    if (path === '/api/groups') {
      return route.fulfill({ json: [group(99, 'Other Person Private Group'), ...state.assigned] });
    }
    if (path === '/api/dishwashing/schedule') return route.fulfill({ json: { schedule: [
      { duty_date: '2026-10-04', date_formatted: 'Oct 4, 2026', status: 'scheduled', team: { id: 1, biblestudy_group_id: 11, tasks_checklist: 'Assigned group task' } },
      { duty_date: '2026-10-11', date_formatted: 'Oct 11, 2026', status: 'scheduled', team: { id: 2, biblestudy_group_id: 99, tasks_checklist: 'OTHER GROUP PRIVATE TASK' } },
    ] } });
    return route.fulfill({ status: 404, json: { error: 'Not part of this fixture' } });
  });
  await page.goto('/');
  await expect(page.locator('aside').getByRole('button', { name: /My Bible Study Group/ })).toBeVisible();
  await page.locator('aside').getByRole('button', { name: /My Bible Study Group/ }).click();
  return state;
}

async function refreshAssignments(page: Page) {
  // Deliver the same local event used when assignments change on another terminal.
  await page.evaluate(async () => {
    const moduleUrl = performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === '/src/socket.ts')?.name;
    if (!moduleUrl) throw new Error('Socket module was not loaded');
    const { socket } = await new Function('url', 'return import(url)')(moduleUrl);
    if (!socket.listeners('groups:changed').length) throw new Error('No active group listeners');
    socket.emitEvent(['groups:changed', {}]);
  });
}

for (const role of ['Pastor', 'Admin', 'Leader', 'Member']) {
  test(`${role} sees an empty state without assignments, never other groups`, async ({ page }) => {
    const state = await prepare(page, role, []);
    await expect(page.getByRole('heading', { name: 'No assigned group' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Switch my Bible study group' })).toHaveCount(0);
    await expect(page.getByText('Other Person Private Group')).toHaveCount(0);
    await expect(page.getByText('Facilitator / Leader Active')).toHaveCount(0);
    expect(state.personalGroupRequests).toBeGreaterThan(0);
  });
}

test('switcher, details, and duties contain only assigned groups', async ({ page }) => {
  const state = await prepare(page, 'Pastor', [group(11, 'My First Group'), group(12, 'My Second Group')]);
  const selector = page.getByRole('button', { name: 'Switch my Bible study group' });
  await expect(selector).toContainText('My First Group');
  await selector.click();
  await expect(page.getByText('Switch Small Group (2)')).toBeVisible();
  await expect(page.getByText('Other Person Private Group')).toHaveCount(0);
  await page.getByRole('button', { name: /My Second Group General/ }).click();
  await expect(selector).toContainText('My Second Group');
  await expect(page.getByText('No dishwashing assignments for this group.')).toBeVisible();
  await selector.click();
  await page.getByRole('button', { name: /My First Group General/ }).click();
  await page.getByRole('button', { name: /Sunday Dishwashing Roster/ }).click();
  await expect(page.getByText('Assigned group task', { exact: true })).toBeVisible();
  await expect(page.getByText('OTHER GROUP PRIVATE TASK')).toHaveCount(0);
  await expect(page.getByText('Couples for Christ Cell')).toHaveCount(0);
  expect(state.personalGroupRequests).toBeGreaterThan(0);
});

test('removing the selected assignment clears its details and open dialogs', async ({ page }) => {
  const state = await prepare(page, 'Admin', [group(11, 'My First Group'), group(12, 'My Second Group')]);
  const selector = page.getByRole('button', { name: 'Switch my Bible study group' });
  await expect(selector).toContainText('My First Group');
  state.assigned = [group(12, 'My Second Group')];
  await refreshAssignments(page);
  await expect(selector).toContainText('My Second Group');
  await expect(page.getByText('My First Group', { exact: true })).toHaveCount(0);
  state.assigned = [];
  await refreshAssignments(page);
  await expect(page.getByRole('heading', { name: 'No assigned group' })).toBeVisible();
  await expect(selector).toHaveCount(0);
});

test('failed personal-group fetch clears old data and supports retry', async ({ page }) => {
  const state = await prepare(page, 'Leader', [group(11, 'My First Group')]);
  await expect(page.getByRole('button', { name: 'Switch my Bible study group' })).toBeVisible();
  state.fail = true;
  await refreshAssignments(page);
  await expect(page.getByRole('heading', { name: 'Unable to load groups' })).toBeVisible();
  await expect(page.getByText('My First Group', { exact: true })).toHaveCount(0);
  state.fail = false;
  state.assigned = [];
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No assigned group' })).toBeVisible();
  expect(state.personalGroupRequests).toBeGreaterThan(0);
});

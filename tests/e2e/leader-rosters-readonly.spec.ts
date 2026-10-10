import { test, expect } from '@playwright/test';

test('Leader can read kitchen and Saturday rosters without management controls', async ({ page }) => {
  const errors: string[] = [];
  const writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const team = { id: 1, name: 'Faith service team', leader_name: 'Test Leader', members: [], members_count: 0, cycle_mode: 'custom', order_seq: 1, color: '#273560', is_active: true, ministry_id: null, tasks: 'Prepare the hall' };
  await page.addInitScript(() => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
    localStorage.setItem('dpc_help_welcome_v1:1:Leader', 'seen');
  });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (/\/(duty|dishwashing)\//.test(path) && route.request().method() !== 'GET') writes.push(path);
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Leader', username: 'leader', email: 'leader@example.test', role_name: 'Leader', ministries: [] } };
    else if (/\/(duty|dishwashing)\/teams$/.test(path)) json = [team];
    else if (/\/(duty|dishwashing)\/schedule$/.test(path)) json = { schedule: [], total_teams: 1, cycle_interval_weeks: 1 };
    else if (path.endsWith('/notifications')) json = { items: [], total: 0, totalPages: 1 };
    else if (path.endsWith('/notifications/unread-count')) json = { count: 0 };
    else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    await route.fulfill({ json });
  });
  await page.goto('/');
  for (const [title, prefix] of [['Saturday Duty Roster', 'duty'], ['Dishwashing Roster', 'washing']]) {
    await page.locator('aside').getByTitle(title, { exact: true }).click();
    await expect(page.getByText('Faith service team', { exact: true }).first()).toBeVisible();
    await expect(page.locator(`[data-guide="${prefix}-new"]`)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Edit (Team|Unit)|Remove (Team|Unit)|Swap|Mark as completed|Add Member/i })).toHaveCount(0);
    await page.locator(`[data-guide="${prefix === 'duty' ? 'duty-checklist-tab' : 'washing-protocols-tab'}"]`).click();
    await expect(page.locator(`[data-guide="${prefix}-task-new"], [data-guide="${prefix}-guideline-new"], [data-guide="${prefix}-checklist-new"], [data-guide="${prefix}-protocol-new"]`)).toHaveCount(0);
  }
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

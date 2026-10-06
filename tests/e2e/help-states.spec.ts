import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const group = { id: 11, name: 'Faith Group', leader_name: 'Guide User', members: [], status: 'active', category: 'General', ministry_id: 1, curriculum: 'Faith Foundations', current_chapter: 'Chapter 1', meeting_day: 'Wednesday', meeting_time: '7:00 PM - 8:00 PM', location: 'Room 1', max_capacity: 12 };
async function prepare(page: Page, role = 'Admin') {
  const state = { assigned: false, failure: false, pause: false, reads: 0, writes: [] as string[], errors: [] as string[], release: () => {} };
  page.on('pageerror', error => state.errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(role => {
    if (location.search.includes('guide-demo=1')) return;
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
    localStorage.setItem('dpc_theme_mode', 'dark');
    localStorage.setItem(`dpc_help_welcome_v1:1:${role}`, 'seen');
  }, role);
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      state.writes.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 400, json: { error: 'Guides must not save records' } });
    }
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true, demoModeEnabled: false };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Guide User', email: 'guide@example.test', role_name: role, ministries: [] } };
    else if (path.endsWith('/ministries')) json = [{ id: 1, name: 'Youth', min_age: 17, max_age: 25, member_count: 0 }];
    else if (path.endsWith('/groups/mine')) {
      state.reads++;
      if (state.pause) await new Promise<void>(resolve => { state.release = resolve; });
      if (state.failure) return route.fulfill({ status: 503, json: { error: 'Assignment service unavailable' } });
      json = state.assigned ? [group] : [];
    }
    else if (path.endsWith('/groups')) json = [group];
    else if (path.endsWith('/reports/dashboard')) json = { metrics: { total_active_members: 0, total_households: 0, unenrolled_members_count: 0, upcoming_events_count: 0 }, ministry_breakdown: [] };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
    else if (path.endsWith('/duty/schedule') || path.endsWith('/dishwashing/schedule')) json = { schedule: [], total_teams: 0 };
    else if (path.endsWith('/study-topics')) json = { topics: [], all: [], summary: {}, total: 0 };
    await route.fulfill({ json });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open Start Here' })).toBeVisible();
  return state;
}
async function startGroupGuide(page: Page) {
  await page.getByRole('button', { name: 'Open Start Here' }).click();
  await page.getByRole('dialog').getByLabel('Find a guide').fill('Manage my Bible study group');
  await page.getByRole('dialog').getByRole('button', { name: /^Manage my Bible study group/ }).click();
  return page.getByRole('region', { name: 'Manage my Bible study group', exact: true });
}

test('unassigned group explains setup, previews every step, then continues after refresh', async ({ page }, testInfo) => {
  const state = await prepare(page);
  const guide = await startGroupGuide(page);
  await expect(guide).toHaveAttribute('data-guide-mode', 'setup');
  await expect(guide).toContainText('No Bible study group is assigned to your account yet');
  await expect(guide.getByRole('button', { name: 'Open group assignment guide' })).toBeVisible();
  await guide.getByRole('button', { name: /Go to step 3:/ }).click();
  await guide.getByRole('button', { name: 'Preview with sample data' }).click();
  const preview = page.getByRole('dialog');
  const reads = state.reads;
  await expect(preview).toContainText('Dummy account and sample data only');
  const frame = page.frameLocator('iframe[title="Interactive guide demo"]');
  await expect(frame.getByText('Sample Faith Group', { exact: true }).first()).toBeVisible();
  const sampleGuide = frame.locator('.help-guide-panel');
  await expect(sampleGuide.locator('.help-step-navigation button')).toHaveCount(4);
  await sampleGuide.getByRole('button', { name: /Go to step 3:/ }).click();
  await expect(frame.locator('[data-guide="my-group-rollcall"]')).toHaveAttribute('data-guide-highlight', 'true');
  await page.screenshot({ path: testInfo.outputPath('empty-group-sample-dark.png') });
  await preview.getByRole('button', { name: 'Return to real guide' }).click();
  await expect(guide).toContainText('Step 3 of 3');
  await expect(page.locator('[data-guide="my-group-empty"]')).toBeVisible();
  expect(state.reads).toBe(reads);
  state.assigned = true;
  await guide.getByRole('button', { name: 'Refresh page data' }).click();
  await expect(guide.getByRole('button', { name: 'Continue walkthrough' })).toBeVisible();
  await guide.getByRole('button', { name: 'Continue walkthrough' }).click();
  await expect(guide).toHaveAttribute('data-guide-mode', 'walkthrough');
  await expect(guide).toContainText('Step 1 of 4');
  await expect(page.locator('[data-guide="my-group-switcher"]')).toHaveAttribute('data-guide-highlight', 'true');
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('staff can follow assignment prerequisites and return to the original guide', async ({ page }) => {
  const state = await prepare(page);
  const guide = await startGroupGuide(page);
  await guide.getByRole('button', { name: 'Open group assignment guide' }).click();
  const assignment = page.getByRole('region', { name: 'Assign a Bible study group to an account', exact: true });
  await expect(assignment).toHaveAttribute('data-guide-mode', 'walkthrough');
  await assignment.getByRole('button', { name: /Go to step 4:/ }).click();
  await expect(assignment.getByRole('button', { name: 'Next step' })).toBeDisabled();
  await expect(assignment.getByRole('button', { name: 'Check this step again' })).toBeVisible();
  await assignment.getByRole('button', { name: 'Check this step again' }).click();
  await expect(assignment.getByRole('button', { name: 'Next step' })).toBeDisabled();
  await assignment.getByRole('button', { name: 'Minimize guide' }).click();
  await page.locator('[data-guide="group-details"]').first().click();
  await page.getByRole('button', { name: 'Resume guide · 4/6' }).click();
  await expect(page.locator('[data-guide="group-leader"]')).toHaveAttribute('data-guide-highlight', 'true');
  await expect(assignment.getByRole('button', { name: 'Next step' })).toBeEnabled();
  // Return is available even without saving an assignment.
  await assignment.getByRole('button', { name: 'Return to Manage my Bible study group' }).click();
  await expect(guide).toHaveAttribute('data-guide-mode', 'setup');
  await expect(guide).toContainText('No Bible study group is assigned');
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

for (const role of ['Leader', 'Member']) {
  test(`${role} gets coordinator instructions and only permitted preview steps`, async ({ page }) => {
    const state = await prepare(page, role);
    await page.locator('aside').getByRole('button', { name: /^My Bible Study Group/ }).click();
    await expect(page.locator('[data-guide="my-group-empty"]')).toBeVisible();
    await page.getByRole('button', { name: 'How to use this page', exact: true }).click();
    await page.getByRole('dialog').locator('.help-page-step').nth(1).click();
    const guide = page.locator('.help-guide-panel');
    await expect(guide.getByRole('heading', { name: 'Check with your coordinator' })).toBeVisible();
    await expect(guide.getByRole('button', { name: 'Open group assignment guide' })).toHaveCount(0);
    await expect(guide.getByRole('button', { name: /Open setup guide/ })).toHaveCount(0);
    await guide.getByRole('button', { name: 'Preview with sample data' }).click();
    const preview = page.getByRole('dialog');
    await expect(preview).toContainText('Saves affect this demo only');
    const frame = page.frameLocator('iframe[title="Interactive guide demo"]');
    await expect(frame.locator('.help-guide-panel')).toHaveAttribute('data-guide-mode', 'walkthrough');
    if (role === 'Member') {
      await expect(frame.getByRole('button', { name: 'Save Session Attendance' })).toHaveCount(0);
      await expect(frame.getByRole('button', { name: 'Add Disciples' })).toHaveCount(0);
    }
    await preview.getByRole('button', { name: 'Close sample preview' }).click();
    await expect(guide).toContainText('Step 2 of 3');
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
  });
}

test('failed requests show retry and preserve the guide through loading and recovery', async ({ page }) => {
  const state = await prepare(page);
  state.failure = true;
  const guide = await startGroupGuide(page);
  await expect(guide).toHaveAttribute('data-guide-mode', 'error');
  await expect(guide).toContainText('This is different from an empty directory');
  await expect(guide).not.toContainText('No Bible study group is assigned');
  await expect(guide.getByRole('button', { name: 'Open group assignment guide' })).toHaveCount(0);
  state.failure = false;
  state.pause = true;
  await guide.getByRole('button', { name: 'Retry loading', exact: true }).click();
  await expect(guide).toHaveAttribute('data-guide-mode', 'loading');
  await expect(guide.getByRole('button', { name: 'Check readiness' })).toBeDisabled();
  state.assigned = true;
  state.release();
  await expect(guide.getByRole('button', { name: 'Continue walkthrough' })).toBeVisible();
  await guide.getByRole('button', { name: 'Continue walkthrough' }).click();
  await expect(guide).toHaveAttribute('data-guide-mode', 'walkthrough');
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('filtered empty groups explain scope while first-record forms remain available', async ({ page }) => {
  const state = await prepare(page);
  await page.locator('aside').getByRole('button', { name: /^Bible Study Groups/ }).click();
  await page.locator('[data-guide="groups-search"]').fill('No matching group');
  await page.getByRole('button', { name: 'How to use this page', exact: true }).click();
  await page.getByRole('dialog').locator('.help-page-step').first().click();
  const guide = page.locator('.help-guide-panel');
  await expect(guide.getByRole('heading', { name: 'Check the current filters' })).toBeVisible();
  await expect(guide).toContainText('does not mean the whole database is empty');
  await guide.getByRole('button', { name: 'Open setup guide: Create a Bible study group' }).click();
  await expect(guide).toHaveAttribute('data-guide-mode', 'walkthrough');
  await expect(page.locator('[data-guide="group-create"]')).toHaveAttribute('data-guide-highlight', 'true');
  await guide.getByRole('button', { name: /Go to step 2:/ }).click();
  await expect(page.locator('[data-guide="group-name"]')).toHaveAttribute('data-guide-highlight', 'true');
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('sample preview fits mobile dark mode and closing keeps real data unchanged', async ({ page }, testInfo) => {
  const state = await prepare(page);
  const guide = await startGroupGuide(page);
  await expect(guide).toHaveAttribute('data-guide-mode', 'setup');
  await page.setViewportSize({ width: 390, height: 844 });
  await guide.getByRole('button', { name: 'Preview with sample data' }).click();
  const preview = page.getByRole('dialog');
  await expect(preview).toBeVisible();
  const bounds = (await preview.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(await preview.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(preview).toHaveCSS('background-color', 'rgb(24, 34, 53)');
  await page.screenshot({ path: testInfo.outputPath('sample-guide-mobile-dark.png') });
  await preview.getByRole('button', { name: 'Close sample preview' }).click();
  await expect(guide).toHaveAttribute('data-guide-mode', 'setup');
  await guide.getByRole('button', { name: 'Close guide' }).click();
  await expect(page.locator('[data-guide="my-group-empty"]')).toBeVisible();
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('sample preview uses a separate sandbox document', () => {
  const source = readFileSync('client/src/components/help/GuidePreview.tsx', 'utf8');
  expect(source).not.toMatch(/import.*(?:api|pages\/|context\/Auth)|\bfetch\(|<form\b|data-guide=/);
  expect(source).toContain('guide-demo');
  expect(source).toContain('sandbox="allow-scripts allow-same-origin allow-forms"');
});

for (const [tab, endpoint, records, search, supportTarget] of [
  ['User Management', '**/api/users**', [{ id: 2, name: 'Sample Leader', role_name: 'Leader', email: 'leader@example.test', ministries: [] }], 'users-search', 'users-search'],
  ['Curriculum Books/Topics', '**/api/study-topics**', { topics: [{ id: 1, title: 'Faith Foundations', total_chapters: 8 }], all: [], summary: {}, total: 1 }, 'curriculum-search', 'curriculum-search'],
  ['Dishwashing Roster', '**/api/dishwashing/teams**', [{ id: 1, name: 'Fellowship Team', color: '#64748b', order_seq: 1, members: [] }], '', 'washing-filters'],
] as const) {
  test(`${tab} explains filtered empty results without claiming its directory is empty`, async ({ page }) => {
    const state = await prepare(page);
    await page.route(endpoint, route => route.fulfill({ json: records }));
    await page.locator('aside').getByRole('button', { name: new RegExp(`^${tab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
    const input = search ? page.locator(`[data-guide="${search}"]`) : page.getByPlaceholder('Search unit or leader...');
    await input.fill('No matching record');
    await page.getByRole('button', { name: 'How to use this page', exact: true }).click();
    await page.getByRole('dialog').locator('.help-page-step').first().click();
    const guide = page.locator('.help-guide-panel');
    await expect(guide).toHaveAttribute('data-guide-mode', 'setup');
    await expect(guide.getByRole('heading', { name: 'Check the current filters' })).toBeVisible();
    await expect(page.locator(`[data-guide="${supportTarget}"]`)).toHaveAttribute('data-guide-highlight', 'true');
    await input.fill('');
    await guide.getByRole('button', { name: 'Continue walkthrough' }).click();
    await expect(guide).toHaveAttribute('data-guide-mode', 'walkthrough');
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
  });
}

test('a first-record workflow waits for failed page data before opening its form', async ({ page }) => {
  const state = await prepare(page);
  let failed = true;
  await page.route('**/api/communications**', route => route.fulfill(failed
    ? { status: 503, json: { error: 'Announcements unavailable' } }
    : { json: [] }));
  await page.getByRole('button', { name: 'Open Start Here' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Find a guide').fill('Publish a church announcement');
  await dialog.locator('.help-task-card').first().click();
  const guide = page.locator('.help-guide-panel');
  await expect(guide).toHaveAttribute('data-guide-mode', 'error');
  failed = false;
  await guide.getByRole('button', { name: 'Retry loading', exact: true }).click();
  await guide.getByRole('button', { name: 'Continue walkthrough' }).click();
  await expect(guide).toHaveAttribute('data-guide-mode', 'walkthrough');
  await expect(page.locator('[data-guide="announcements-list"]')).toHaveAttribute('data-guide-highlight', 'true');
  await guide.getByRole('button', { name: /Go to step 3:/ }).click();
  await expect(page.locator('[data-guide="announcement-title"]')).toHaveAttribute('data-guide-highlight', 'true');
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

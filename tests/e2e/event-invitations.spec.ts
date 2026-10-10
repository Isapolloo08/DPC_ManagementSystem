import { test, expect, type Page } from '@playwright/test';
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
    else if (path.endsWith('/ministries')) json = [{ id: 1, name: 'Junior Adult', min_age: 36, max_age: 55, color: '#64748b', member_count: 0 }, { id: 2, name: 'Youth', min_age: 17, max_age: 21, color: '#22c55e', member_count: 0 }, { id: 3, name: 'Young Adult', min_age: 22, max_age: 35, color: '#6366f1', member_count: 0 }];
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

const token = 'a'.repeat(64);
for (const theme of ['light', 'dark']) test(`public event invitation needs no login and preserves one response (${theme})`, async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(theme => localStorage.setItem('dpc_theme_mode', theme), theme);
  const requests: any[] = [], unexpected: string[] = [];
  await page.route('**/api/**', async route => {
    if (!route.request().url().includes('/event-invitations/public/')) { unexpected.push(route.request().url()); return route.fulfill({ status: 401, json: {} }); }
    expect(route.request().headers().authorization).toBeUndefined();
    if (route.request().method() === 'POST') {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ json: { message: 'Saved' } });
    }
    return route.fulfill({ json: { title: 'Church Family Gathering', description: 'Join our fellowship.', start_time: '2099-10-20T09:00:00+08:00', end_time: '2099-10-20T12:00:00+08:00', deadline: '2099-10-19T18:00:00+08:00', location: 'Main Sanctuary', personal: false, accepting: true } });
  });
  await page.goto('/#/invite/' + token);
  await expect(page.getByRole('heading', { name: 'Church Family Gathering' })).toBeVisible();
  await expect(page.locator('aside')).toHaveCount(0);
  await page.getByLabel('Full name').fill('Juan Santos');
  await page.getByLabel('Email or mobile number').fill('juan@example.test');
  await page.getByRole('radio', { name: /Hindi ako makakadalo/ }).check();
  await expect(page.getByRole('button', { name: 'Submit response' })).toBeDisabled();
  await page.getByLabel('Reason / Dahilan').fill('Working that day');
  await page.screenshot({ path: info.outputPath('public-invitation-' + theme + '.png'), fullPage: true });
  await page.getByRole('button', { name: 'Submit response' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you, Juan Santos!' })).toBeVisible();
  await page.getByRole('button', { name: 'Change my response' }).click();
  await page.getByRole('radio', { name: /Oo, dadalo ako/ }).check();
  await page.getByRole('button', { name: 'Submit response' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you, Juan Santos!' })).toBeVisible();
  expect(requests[0].answer).toBe('no'); expect(requests[0].reason).toBe('Working that day');
  expect(requests[1].answer).toBe('yes'); expect(requests[0].responseKey).toBe(requests[1].responseKey);
  await page.reload();
  await page.getByLabel('Full name').fill('Juan Santos'); await page.getByLabel('Email or mobile number').fill('juan@example.test');
  await page.getByRole('radio', { name: /Hindi pa sigurado/ }).check();
  await page.getByRole('button', { name: 'Submit response' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you, Juan Santos!' })).toBeVisible();
  expect(requests[2].responseKey).toBe(requests[0].responseKey); expect(unexpected).toEqual([]);
});

test('personal and closed invitations avoid guest details and writes', async ({ page }) => {
  let accepting = true;
  await page.route('**/api/event-invitations/public/**', route => route.fulfill({ json: { title: 'Personal Gathering', start_time: '2099-01-01', end_time: '2099-01-02', deadline: '2098-12-30', personal: true, member_name: 'Maria Reyes', accepting } }));
  await page.goto('/#/invite/' + token);
  await expect(page.getByText('Personal invitation for')).toBeVisible();
  await expect(page.getByLabel('Full name')).toHaveCount(0); await expect(page.getByLabel('Email or mobile number')).toHaveCount(0);
  accepting = false; await page.reload();
  await expect(page.getByText(/Responses are closed/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit response' })).toHaveCount(0);
});

test('regular member search uses event scope and submits member identity instead of typed guest details', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const searches: string[] = [], payloads: any[] = [];
  await page.route('**/api/event-invitations/public/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/members')) {
      searches.push(url.searchParams.get('search') || '');
      return route.fulfill({ json: { members: [{ id: 9, name: 'Juan Santos' }] } });
    }
    if (route.request().method() === 'POST') { payloads.push(route.request().postDataJSON()); return route.fulfill({ json: { message: 'Saved' } }); }
    return route.fulfill({ json: { title: 'Youth Fellowship', ministry_name: 'Youth Ministry', start_time: '2099-01-01', end_time: '2099-01-02', deadline: '2098-12-30', personal: false, accepting: true } });
  });
  await page.goto('/#/invite/' + token);
  await expect(page.getByText('Event ministry: Youth Ministry')).toBeVisible();
  await page.getByRole('radio', { name: 'Regular Member', exact: true }).check();
  await expect(page.getByLabel('Email or mobile number')).toHaveCount(0);
  const memberInput = page.getByRole('combobox', { name: 'Your member name' });
  await expect(page.getByRole('combobox')).toHaveCount(1);
  await memberInput.fill('J');
  await expect(page.getByRole('option', { name: 'Juan Santos' })).toBeVisible();
  expect(searches).toContain('J');
  await page.getByRole('option', { name: 'Juan Santos' }).click();
  await expect(memberInput).toHaveValue('Juan Santos');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await memberInput.fill('Ju');
  await expect(page.getByRole('button', { name: 'Submit response' })).toBeDisabled();
  await expect(page.getByRole('option', { name: 'Juan Santos' })).toBeVisible();
  await memberInput.press('ArrowDown');
  await memberInput.press('Enter');
  await expect(memberInput).toHaveValue('Juan Santos');
  await page.getByRole('radio', { name: /Oo, dadalo ako/ }).check();
  await page.screenshot({ path: info.outputPath('regular-member-invitation.png'), fullPage: true });
  await page.getByRole('button', { name: 'Submit response' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you, Juan Santos!' })).toBeVisible();
  expect(payloads[0]).toMatchObject({ attendeeType: 'member', member_id: 9, name: 'Juan Santos', contact: '', answer: 'yes' });
  await page.getByRole('button', { name: 'Change my response' }).click();
  await page.getByRole('radio', { name: 'Guest', exact: true }).check();
  await expect(page.getByLabel('Full name')).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Your member name' })).toHaveCount(0);
});

test('organizer generates guest and personal links, sees responses and deactivates a link', async ({ page }, info) => {
  await prepare(page);
  const event = { id: 21, title: 'Church Family Gathering', description: 'Welcome', start_time: '2026-10-20T09:00:00+08:00', end_time: '2026-10-20T12:00:00+08:00', location: 'Sanctuary' };
  const links: any[] = [], payloads: any[] = [];
  await page.route('**/api/events*', route => route.fulfill({ json: [event] }));
  await page.route('**/api/members?*', route => route.fulfill({ json: { data: [{ id: 7, first_name: 'Maria', last_name: 'Reyes' }] } }));
  await page.route('**/api/event-invitations/events/**', async route => {
    const method = route.request().method();
    if (new URL(route.request().url()).pathname.endsWith('/members')) return route.fulfill({ json: [{ id: 7, first_name: 'Maria', last_name: 'Reyes' }] });
    if (method === 'POST') {
      const payload = route.request().postDataJSON(); payloads.push(payload);
      const link = { id: links.length + 1, token: String(links.length + 1).repeat(64), member_id: payload.member_id || null, member_name: 'Maria Reyes', enabled: true, accepting: true, deadline: event.start_time };
      links.unshift(link); return route.fulfill({ status: 201, json: link });
    }
    if (method === 'PATCH') { links[0].enabled = route.request().postDataJSON().enabled; links[0].accepting = links[0].enabled; return route.fulfill({ json: {} }); }
    return route.fulfill({ json: { links, responses: [{ id: 1, name: 'Juan Santos', contact: 'juan@example.test', answer: 'no', reason: 'Working', updated_at: event.start_time }], counts: { yes: 0, no: 1, maybe: 0, pending: 1 }, limit: 1000 } });
  });
  await navigate(page, 'Calendar');
  await page.getByText('Church Family Gathering', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Invitation Links & Responses' }).click();
  const dialog = page.getByRole('dialog', { name: 'Event invitations & responses' });
  await expect(dialog.getByText('Reason: Working')).toBeVisible();
  await dialog.getByLabel('Invitation website URL').fill('https://church.example.test/');
  await dialog.getByRole('button', { name: 'Generate Link' }).click();
  await expect(dialog.getByLabel('Invitation link 1', { exact: true })).toHaveValue('https://church.example.test/#/invite/' + '1'.repeat(64));
  await dialog.getByLabel('Link type').selectOption('personal');
  await dialog.getByLabel('Search member').fill('Maria'); await dialog.getByLabel('Recipient').selectOption('7');
  await dialog.getByRole('button', { name: 'Generate Link' }).click();
  expect(payloads[1].member_id).toBe(7);
  await dialog.getByRole('button', { name: 'Deactivate', exact: true }).first().click();
  await expect(dialog.getByRole('button', { name: 'Activate', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const box = await dialog.boundingBox(); expect(box && box.x >= 0 && box.x + box.width <= 391).toBeTruthy();
  await page.screenshot({ path: info.outputPath('organizer-invitations.png') });
});

for (const theme of ['light', 'dark']) test(`collaborative celebration targets persist when edited (${theme})`, async ({ page }, info) => {
  await prepare(page, theme);
  const rows: any[] = [], payloads: any[] = [];
  await page.route('**/api/events/recurring-sunday-cycle**', async route => {
    if (route.request().method() === 'POST' || route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON(); payloads.push(payload);
      const row = { ...payload, id: 51, ministry_ids: payload.ministry_ids, db_ministry_name: 'Youth + Young Adult', is_active: true, projected_date: '2026-10-11' };
      rows.splice(0, rows.length, row);
      return route.fulfill({ status: 201, json: { id: 51, message: 'Saved' } });
    }
    return route.fulfill({ json: { events: rows, year: 2026, available_years: [2026], total_annual_events: rows.length } });
  });
  await navigate(page, 'Events & Celebrations');
  await page.getByRole('button', { name: 'Add Event / Celebration', exact: true }).click();
  const panel = page.locator('[data-modal-panel]').last();
  const title = panel.locator('input[type="text"]').first();
  await title.fill('Youth & Young Adult Fellowship');
  await panel.getByRole('checkbox', { name: 'Youth', exact: true }).check();
  await panel.getByRole('checkbox', { name: 'Young Adult', exact: true }).check();
  await expect(panel.getByRole('checkbox', { name: 'Church-wide / All Ministries' })).not.toBeChecked();
  await expect(panel.getByText('2 ministries collaborating')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.locator('.event-ministry-picker').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('collaborative-celebration-' + theme + '.png'), fullPage: true });
  await panel.getByRole('button', { name: 'Create Annual Celebration', exact: true }).click();
  await expect(page.getByText('Youth & Young Adult Fellowship', { exact: true }).first()).toBeVisible();
  expect(payloads[0].ministry_ids).toEqual([2, 3]);
  await page.getByTitle('Close', { exact: true }).click();
  await page.getByTitle('Edit Celebration', { exact: true }).click();
  await expect(panel.getByRole('checkbox', { name: 'Youth', exact: true })).toBeChecked();
  await expect(panel.getByRole('checkbox', { name: 'Young Adult', exact: true })).toBeChecked();
  await panel.getByRole('checkbox', { name: 'Church-wide / All Ministries' }).check();
  await expect(panel.getByRole('checkbox', { name: 'Youth', exact: true })).not.toBeChecked();
  await expect(panel.getByRole('checkbox', { name: 'Young Adult', exact: true })).not.toBeChecked();
  await panel.getByRole('button', { name: 'Save Changes', exact: true }).click();
  expect(payloads[1].ministry_ids).toEqual([]);
});


import { test, expect, type Page } from '@playwright/test';

test.use({ launchOptions: { args: ['--disable-gpu'] } });
const address = 'Purok 1, Daet, Camarines Norte';
const addressPlaceholder = 'e.g. Purok 4, Sitio Maligaya, Brgy. Bagang, Daet, Camarines Norte';

async function prepare(page: Page, options: { structured?: boolean; existing?: boolean; otherHousehold?: boolean; exactName?: boolean; theme?: 'light' | 'dark' } = {}) {
  const source: any = { id: 1, first_name: 'Juan', last_name: 'Remot', birthdate: '1980-04-03', age: 46, gender: 'Male', status: 'active',
    household_id: 20, ministry_id: 1, ministry_name: 'Junior Adult', contact_phone: '09111111111', address,
    family_details: options.structured ? '' : `Brother: ${options.exactName ? 'Mark Andrie Remot' : 'Andrie'}` };
  const mother: any = { ...source, id: 2, first_name: 'Maria', gender: 'Female', family_details: '', contact_phone: '09222222222' };
  const members: any[] = [source, mother];
  if (options.existing) members.push({ id: 10, first_name: 'Mark Andrie', last_name: 'Remot', birthdate: '2004-10-15', age: 21,
    gender: 'Male', status: 'active', household_id: options.otherHousehold ? 99 : null, ministry_id: 2, ministry_name: 'Youth',
    address: 'Own address in Naga', contact_phone: '09444444444', attendance: ['2026-10-04'] });
  const household: any = { id: 20, name: 'Remot Household', address, primary_contact_phone: '09111111111',
    father_name: 'Juan Remot', mother_name: 'Maria Remot', family_members: options.structured ? [{ name: 'Andrie', relationship: 'Son', member_id: null }] : [] };
  const writes: { method: string; path: string; body: any }[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(theme => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
    localStorage.setItem('dpc_theme_mode', theme);
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
  }, options.theme || 'light');
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      const body = request.postDataJSON();
      writes.push({ method: request.method(), path, body });
      let member: any;
      if (request.method() === 'POST') {
        member = { ...body, id: 30, age: 21, ministry_name: 'Youth' };
        members.push(member);
      } else {
        member = members.find(member => member.id === Number(path.split('/').at(-1)));
        Object.assign(member, body);
      }
      const registration = body.household_registration;
      if (registration) {
        member.household_id = registration.household_id;
        const name = `${member.first_name} ${member.last_name}`;
        household.family_members = household.family_members.filter((entry: any) => entry.name !== registration.relative?.name && entry.member_id !== member.id);
        household.family_members.push({ name, member_id: member.id, relationship: registration.role === 'son' ? 'Son' : 'Family Member', aliases: [registration.relative.name] });
      }
      return route.fulfill({ json: { id: member.id, household_id: 20, message: 'Saved' } });
    }
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Admin', role_name: 'Admin', ministries: [] } };
    else if (path.endsWith('/ministries')) json = [{ id: 1, name: 'Junior Adult', min_age: 27, max_age: 59 }, { id: 2, name: 'Youth', min_age: 17, max_age: 26 }];
    else if (path.endsWith('/ministries/suggest')) json = { calculated_age: 21, suggested_ministry: { id: 2, name: 'Youth', min_age: 17, max_age: 26 } };
    else if (path.endsWith('/households')) json = [{ ...household, members: members.filter(member => member.household_id === 20), member_count: members.filter(member => member.household_id === 20).length }];
    else if (path.endsWith('/members')) {
      const search = url.searchParams.get('search')?.toLowerCase();
      json = search ? members.filter(member => `${member.first_name} ${member.last_name}`.toLowerCase().includes(search)) : members;
    }
    else if (/\/members\/\d+$/.test(path)) json = members.find(member => member.id === Number(path.split('/').at(-1)));
    else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/members/check-duplicate')) json = { duplicateName: members.find(member => `${member.first_name} ${member.last_name}`.toLowerCase() === url.searchParams.get('name')?.toLowerCase()) || null };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
    await route.fulfill({ json });
  });
  await page.goto('/');
  if (page.viewportSize()!.width < 1024) await page.getByRole('button', { name: 'Toggle navigation menu' }).click();
  await page.getByTitle('Members & Families', { exact: true }).click();
  await page.locator('main tbody tr').filter({ hasText: 'Juan Remot' }).getByRole('button', { name: 'Details', exact: true }).click();
  const relativeName = options.exactName ? 'Mark Andrie Remot' : 'Andrie';
  await page.getByRole('button', { name: `Register ${relativeName} as member`, exact: true }).click();
  const choice = page.getByRole('dialog', { name: 'Register family relative', exact: true });
  await expect(choice.getByRole('button', { name: 'Register as New Member', exact: true })).toBeEnabled();
  return { choice, source, household, members, writes, errors };
}

for (const structured of [false, true]) {
  test(`register ${structured ? 'household' : 'application-text'} relative with prefilled details and a stable profile link`, async ({ page }, testInfo) => {
    if (structured) await page.setViewportSize({ width: 390, height: 844 });
    const state = await prepare(page, { structured });
    await state.choice.getByLabel('Relative relationship in household').selectOption('son');
    await state.choice.getByRole('button', { name: 'Register as New Member', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Add New Member Record', exact: true });
    await expect(form.getByPlaceholder('e.g. Mark Andrie M. Remot')).toHaveValue('Andrie');
    await expect(form.locator('[data-guide="member-household"]')).toHaveValue('20');
    await expect(form.locator('[data-guide="member-household"]')).toBeDisabled();
    await expect(form.getByLabel('Your relationship in this household', { exact: true })).toHaveValue('son');
    await form.getByRole('button', { name: 'Type Manually', exact: true }).click();
    await expect(form.getByPlaceholder(addressPlaceholder)).toHaveValue(address);
    expect(state.writes).toEqual([]);
    await form.getByPlaceholder('e.g. Mark Andrie M. Remot').fill('Mark Andrie Remot');
    await form.getByText('Select birthdate', { exact: true }).click();
    const calendar = page.getByTitle('Previous Month', { exact: true }).locator('../..');
    await calendar.getByRole('button', { name: /^\d{4}$/ }).click();
    await calendar.getByRole('button', { name: '2004', exact: true }).click();
    await calendar.getByRole('button', { name: '15', exact: true }).click();
    await form.getByPlaceholder('e.g. 09123456789', { exact: true }).fill('09333333333');
    await expect(form.getByRole('button', { name: 'Create New', exact: true })).toHaveCount(0);
    await form.locator('[data-guide="member-household"]').scrollIntoViewIfNeeded();
    await expect(form.getByLabel('Household preview')).not.toContainText('Andrie — Son');
    await expect(form.getByLabel('Household preview')).toContainText('Mark Andrie Remot — Son');
    await page.screenshot({ path: testInfo.outputPath('relative-prefilled.png') });
    await form.getByRole('button', { name: 'Save Application Record', exact: true }).click();
    await expect(form).not.toBeVisible();
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].body).toMatchObject({ address, guardian_names: 'Juan Remot', guardian_phone: '09111111111',
      household_registration: { mode: 'existing', household_id: 20, role: 'son', relative: { name: 'Andrie', source_member_id: 1 } } });
    await expect(page.getByRole('button', { name: 'Register Andrie as member', exact: true })).toHaveCount(0);
    await expect(page.locator('[data-modal-panel]').filter({ hasText: 'Application for Membership Card' }).getByText('Mark Andrie Remot', { exact: true })).toBeVisible();
    await page.getByTitle("View Mark Andrie's Profile", { exact: true }).click();
    await expect(page.locator('[data-modal-panel]').filter({ hasText: 'Application for Membership Card' })).toContainText('Mark Andrie Remot');
    expect(state.errors).toEqual([]);
  });
}

test('linking an existing member uses their verified record and keeps their address and attendance', async ({ page }) => {
  const state = await prepare(page, { existing: true, exactName: true });
  await expect(state.choice).toContainText('Birthday: 2004-10-15');
  await state.choice.getByLabel('Relative relationship in household').selectOption('son');
  await state.choice.getByRole('button', { name: 'Link existing member Mark Andrie Remot', exact: true }).click();
  await expect(state.choice).not.toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({ method: 'PUT', path: '/api/members/10', body: { household_registration: {
    mode: 'existing', household_id: 20, role: 'son', relative: { name: 'Mark Andrie Remot', source_member_id: 1 } } } });
  expect(state.writes[0].body.address).toBeUndefined();
  expect(state.members.find(member => member.id === 10)).toMatchObject({ address: 'Own address in Naga', attendance: ['2026-10-04'] });
  await expect(page.getByRole('button', { name: 'Register Mark Andrie Remot as member', exact: true })).toHaveCount(0);
  await expect(page.getByTitle("View Mark Andrie's Profile", { exact: true })).toBeVisible();
  expect(state.errors).toEqual([]);
});

test('selecting a household after opening the form preserves the complete address through mode changes and edits', async ({ page }) => {
  const state = await prepare(page);
  await state.choice.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Close Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Add Member', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Add New Member Record', exact: true });
  await form.locator('[data-guide="member-household"]').selectOption('20');
  await form.getByRole('button', { name: 'Type Manually', exact: true }).click();
  await expect(form.getByPlaceholder(addressPlaceholder)).toHaveValue(address);
  await form.getByRole('button', { name: 'Switch to Dropdown Selector', exact: true }).click();
  await expect(form.getByPlaceholder('e.g. Phase 3, Happy Homes / P. Burgos St.')).toHaveValue('Purok 1');
  await form.getByPlaceholder('e.g. Phase 3, Happy Homes / P. Burgos St.').fill('Purok 2');
  await form.getByRole('button', { name: 'Type Manually', exact: true }).click();
  await expect(form.getByPlaceholder(addressPlaceholder)).toHaveValue('Purok 2, Daet, Camarines Norte');
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('an existing record in another household cannot be silently reassigned', async ({ page }) => {
  const state = await prepare(page, { existing: true, otherHousehold: true });
  await expect(state.choice.getByRole('button', { name: 'Link existing member Mark Andrie Remot', exact: true })).toBeDisabled();
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('cancelling relative registration leaves the family unchanged and clears the next blank member form', async ({ page }) => {
  const state = await prepare(page);
  await state.choice.getByRole('button', { name: 'Register as New Member', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Add New Member Record', exact: true });
  await form.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Register Andrie as member', exact: true })).toBeVisible();
  expect(state.writes).toEqual([]);
  await page.locator('[data-modal-panel]').filter({ hasText: 'Application for Membership Card' }).getByRole('button', { name: 'Close Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Add Member', exact: true }).click();
  await expect(form.getByPlaceholder('e.g. Mark Andrie M. Remot')).toHaveValue('');
  await expect(form.locator('[data-guide="member-household"]')).toHaveValue('');
  await expect(form.getByLabel('Your relationship in this household', { exact: true })).toHaveValue('');
  expect(state.errors).toEqual([]);
});

test('relative dialog keeps keyboard focus inside and restores its trigger on Escape', async ({ page }) => {
  const state = await prepare(page);
  await expect(state.choice.getByLabel('Search existing members for relative')).toBeFocused();
  const close = state.choice.getByRole('button', { name: 'Close relative registration', exact: true });
  const last = state.choice.getByRole('button', { name: 'Register as New Member', exact: true });
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();
  await expect(last).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(state.choice).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Register Andrie as member', exact: true })).toBeFocused();
  expect(state.writes).toEqual([]);
});

for (const theme of ['light', 'dark'] as const) {
  test(`relative chooser remains readable and scrollable in ${theme} mode`, async ({ page }, testInfo) => {
    await page.setViewportSize(theme === 'dark' ? { width: 390, height: 600 } : { width: 1440, height: 1000 });
    const state = await prepare(page, { existing: true, theme });
    await expect(state.choice).toHaveCSS('background-color', theme === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)');
    await expect(state.choice.getByLabel('Search existing members for relative')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)');
    const primary = state.choice.getByRole('button', { name: 'Register as New Member', exact: true });
    await expect(primary).toHaveCSS('background-color', 'rgb(44, 57, 104)');
    const contrast = await primary.evaluate(element => {
      const luminance = (color: string) => {
        const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const styles = getComputedStyle(element);
      const a = luminance(styles.color), b = luminance(styles.backgroundColor);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    await state.choice.locator('[data-modal-body]').evaluate(element => { element.scrollTop = element.scrollHeight; });
    const actionBounds = (await primary.boundingBox())!;
    expect(actionBounds.y + actionBounds.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    const overflow = await state.choice.evaluate(element => element.scrollWidth > element.clientWidth);
    expect(overflow).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`relative-chooser-${theme}.png`) });
    expect(state.errors).toEqual([]);
  });
}

test('failed member search hides old candidates and supports retry without losing the query', async ({ page }) => {
  const state = await prepare(page, { existing: true });
  let requests = 0;
  await page.route('**/api/members?**', async route => {
    if (new URL(route.request().url()).searchParams.get('search') !== 'Unavailable') return route.fallback();
    requests++;
    return requests === 1 ? route.fulfill({ status: 409, json: { error: 'Lookup is unavailable.' } }) : route.fulfill({ json: [] });
  });
  await state.choice.getByLabel('Search existing members for relative').fill('Unavailable');
  await expect(state.choice.getByRole('alert')).toHaveText('Lookup is unavailable.');
  await expect(state.choice.getByRole('button', { name: 'Link existing member Mark Andrie Remot', exact: true })).toHaveCount(0);
  await expect(state.choice.getByRole('button', { name: 'Register as New Member', exact: true })).toBeDisabled();
  await state.choice.getByRole('button', { name: 'Retry search', exact: true }).click();
  await expect(state.choice.getByRole('button', { name: 'Register as New Member', exact: true })).toBeEnabled();
  await expect(state.choice.getByLabel('Search existing members for relative')).toHaveValue('Unavailable');
  await expect(state.choice.getByRole('status')).toContainText('No existing member records found');
  expect(state.writes).toEqual([]);
});

test('a slow previous member search cannot replace the latest results', async ({ page }) => {
  const state = await prepare(page);
  let releaseOld!: () => void;
  const oldRequest = new Promise<void>(resolve => { releaseOld = resolve; });
  await page.route('**/api/members?**', async route => {
    const query = new URL(route.request().url()).searchParams.get('search');
    if (query === 'Old') {
      await oldRequest;
      return route.fulfill({ json: [{ ...state.source, id: 40, first_name: 'Old', last_name: 'Result' }] });
    }
    if (query === 'Latest') return route.fulfill({ json: [{ ...state.source, id: 41, first_name: 'Latest', last_name: 'Result' }] });
    return route.fallback();
  });
  const oldStarted = page.waitForRequest(request => new URL(request.url()).searchParams.get('search') === 'Old');
  await state.choice.getByLabel('Search existing members for relative').fill('Old');
  await oldStarted;
  await state.choice.getByLabel('Search existing members for relative').fill('Latest');
  await expect(state.choice.getByText('Latest Result', { exact: true })).toBeVisible();
  const oldFinished = page.waitForResponse(response => new URL(response.url()).searchParams.get('search') === 'Old');
  releaseOld();
  await oldFinished;
  await expect(state.choice.getByText('Latest Result', { exact: true })).toBeVisible();
  await expect(state.choice.getByText('Old Result', { exact: true })).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

test('a slow duplicate check cannot flag a different, newly entered name', async ({ page }) => {
  const state = await prepare(page);
  let releaseOld!: () => void;
  const oldRequest = new Promise<void>(resolve => { releaseOld = resolve; });
  await page.route('**/api/members/check-duplicate?**', async route => {
    const name = new URL(route.request().url()).searchParams.get('name');
    if (name === 'Older Person') {
      await oldRequest;
      return route.fulfill({ json: { duplicateName: { ...state.source, id: 40, first_name: 'Older', last_name: 'Person' } } });
    }
    if (name === 'Newer Person') return route.fulfill({ json: { duplicateName: null } });
    return route.fallback();
  });
  await state.choice.getByRole('button', { name: 'Register as New Member', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Add New Member Record', exact: true });
  const name = form.getByPlaceholder('e.g. Mark Andrie M. Remot');
  const oldStarted = page.waitForRequest(request => new URL(request.url()).searchParams.get('name') === 'Older Person');
  await name.fill('Older Person');
  await oldStarted;
  const newerFinished = page.waitForResponse(response => new URL(response.url()).searchParams.get('name') === 'Newer Person');
  await name.fill('Newer Person');
  await newerFinished;
  const oldFinished = page.waitForResponse(response => new URL(response.url()).searchParams.get('name') === 'Older Person');
  releaseOld();
  await oldFinished;
  await expect(name).toHaveValue('Newer Person');
  await expect(form.getByText('Name already registered in database!', { exact: true })).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

test('failed duplicate checks show recovery instead of reporting a verified name', async ({ page }) => {
  const state = await prepare(page);
  let requests = 0;
  await page.route('**/api/members/check-duplicate?**', async route => {
    if (new URL(route.request().url()).searchParams.get('name') !== 'Lookup Person') return route.fallback();
    requests++;
    return requests === 1 ? route.fulfill({ status: 409, json: { error: 'Name lookup is unavailable.' } }) : route.fulfill({ json: { duplicateName: null } });
  });
  await state.choice.getByRole('button', { name: 'Register as New Member', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Add New Member Record', exact: true });
  await form.getByPlaceholder('e.g. Mark Andrie M. Remot').fill('Lookup Person');
  await expect(form.getByRole('alert')).toContainText('Name lookup is unavailable.');
  await form.getByRole('button', { name: 'Retry name check', exact: true }).click();
  await expect(form.getByRole('alert')).toHaveCount(0);
  await expect(form.getByPlaceholder('e.g. Mark Andrie M. Remot')).toHaveValue('Lookup Person');
  expect(state.writes).toEqual([]);
});

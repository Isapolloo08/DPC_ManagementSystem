import { test, expect, type Page, type Locator } from '@playwright/test';

test.use({ launchOptions: { args: ['--disable-gpu'] } });
const addressPlaceholder = 'e.g. Purok 4, Sitio Maligaya, Brgy. Bagang, Daet, Camarines Norte';

async function prepare(page: Page, existing = false) {
  const writes: { path: string; body: any }[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const child = { id: 10, first_name: 'Ana', last_name: 'Santos', age: 21, birthdate: '2005-04-21', gender: 'Female', status: 'active', ministry_id: 2, ministry_name: 'Youth', household_id: existing ? 20 : null, contact_phone: '09333333333' };
  const otherChild = { ...child, id: 11, first_name: 'Ben', household_id: 99, gender: 'Male' };
  const households = existing ? [{ id: 20, name: 'Santos Household', father_name: null, mother_name: 'Maria Santos', guardian_name: null, family_members: [], members: [child] }] : [];
  await page.addInitScript(() => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
    localStorage.setItem('dpc_theme_mode', 'light');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
  });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writes.push({ path, body: request.postDataJSON() });
      return route.fulfill({ json: { id: 30, household_id: 20, message: 'Saved' } });
    }
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Admin', role_name: 'Admin', ministries: [] } };
    else if (path.endsWith('/ministries')) json = [
      { id: 1, name: 'Junior Adult', min_age: 27, max_age: 59 },
      { id: 2, name: 'Youth', min_age: 17, max_age: 26 },
      { id: 3, name: 'Old Adult', min_age: 60, max_age: 120 },
      { id: 4, name: 'Kinder', min_age: 3, max_age: 5 },
      { id: 5, name: 'Elementary', min_age: 6, max_age: 12 },
      { id: 6, name: 'Highschool', min_age: 13, max_age: 16 },
      { id: 7, name: 'Young Adult', min_age: 23, max_age: 26 }
    ];
    else if (path.endsWith('/members')) json = [child, otherChild];
    else if (path.endsWith('/households')) json = households;
    else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/members/check-duplicate')) json = { duplicateName: null };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
    await route.fulfill({ json });
  });
  await page.goto('/');
  if (page.viewportSize()!.width < 1024) await page.getByRole('button', { name: 'Toggle navigation menu' }).click();
  await page.getByTitle('Members & Families', { exact: true }).click();
  await page.getByRole('button', { name: 'Add Member', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Add New Member Record', exact: true });
  await form.getByPlaceholder('e.g. Mark Andrie M. Remot').fill('Juan Santos');
  await form.getByText('Select birthdate', { exact: true }).click();
  const calendar = page.getByTitle('Previous Month', { exact: true }).locator('../..');
  await calendar.getByRole('button', { name: /^\d{4}$/ }).click();
  await calendar.getByRole('button', { name: '1990', exact: true }).click();
  await calendar.getByRole('button', { name: '15', exact: true }).click();
  await form.getByRole('button', { name: /Widowed/ }).click();
  await form.getByRole('button', { name: 'Type Manually', exact: true }).click();
  await form.getByPlaceholder(addressPlaceholder).fill('Purok 1, Daet, Camarines Norte');
  await form.getByPlaceholder('e.g. 09123456789', { exact: true }).fill('09111111111');
  await form.getByRole('button', { name: 'Create New', exact: true }).click();
  return { form, writes, errors };
}

async function selectChild(form: Locator, existing = false) {
  await form.getByRole('combobox', { name: 'Your relationship in this household', exact: true }).selectOption('father');
  await form.getByRole('textbox', { name: 'Search existing family members', exact: true }).fill('Ana');
  await form.getByRole('button', { name: `${existing ? 'Join household with' : 'Link'} Ana Santos`, exact: true }).click();
  if (!existing) await expect(form.getByRole('combobox', { name: 'Relationship for Ana Santos', exact: true })).toHaveValue('Daughter');
  await expect(form.locator('[aria-label="Household preview"]')).toContainText('Juan Santos — Father');
  await expect(form.locator('[aria-label="Household preview"]')).toContainText(`Ana Santos — ${existing ? 'Family Member' : 'Daughter'}`);
}

test('selected spouse appears in the new household before choosing a household role and clears when removed', async ({ page }) => {
  const state = await prepare(page);
  await state.form.getByRole('button', { name: /Married/ }).click();
  await state.form.getByPlaceholder('Type to search existing member (e.g. Maria Clara)...').fill('Ana');
  await page.getByRole('button', { name: /^Ana Santos Female/ }).click();
  const preview = state.form.locator('[aria-label="Household preview"]');
  await expect(preview).toContainText('Ana Santos');
  await expect(preview).toContainText('Spouse · Registered member');
  await state.form.getByRole('button', { name: 'Change / Remove', exact: true }).click();
  await expect(preview).not.toContainText('Ana Santos');
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

for (const mobile of [false, true]) {
  test(`new parent links the existing child in one save${mobile ? ' on mobile' : ''}`, async ({ page }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const state = await prepare(page);
    await selectChild(state.form);
    await state.form.locator('[aria-label="Household preview"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('family-preview.png') });
    expect(state.writes).toEqual([]);
    await state.form.getByRole('button', { name: 'Save Application Record', exact: true }).click();
    await expect(state.form).not.toBeVisible();
    expect(state.writes.map(write => write.path)).toEqual(['/api/members']);
    expect(state.writes[0].body.household_registration).toMatchObject({ mode: 'create', name: 'Santos Household', role: 'father', family_members: [{ member_id: 10, name: 'Ana Santos', relationship: 'Daughter' }] });
    expect(state.errors).toEqual([]);
  });
}

test('joining the child household switches to Select List without family-link editing', async ({ page }) => {
  const state = await prepare(page, true);
  await selectChild(state.form, true);
  await expect(state.form.locator('[data-guide="member-household"]')).toHaveValue('20');
  await expect(state.form.locator('[aria-label="Household preview"]')).toContainText('Maria Santos — Mother');
  await expect(state.form.getByRole('textbox', { name: 'Search existing family members' })).toHaveCount(0);
  await expect(state.form.getByRole('combobox', { name: 'Relationship for Ana Santos', exact: true })).toHaveCount(0);
  await state.form.getByRole('button', { name: 'Save Application Record', exact: true }).click();
  await expect(state.form).not.toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body.household_registration).toMatchObject({ mode: 'existing', household_id: 20, role: 'father', family_members: [] });
  expect(state.errors).toEqual([]);
});

test('removing a selected child and switching modes does not save stale family links', async ({ page }) => {
  const state = await prepare(page);
  await selectChild(state.form);
  await state.form.getByRole('button', { name: 'Remove Ana Santos from selection' }).click();
  await expect(state.form.getByRole('combobox', { name: 'Relationship for Ana Santos' })).toHaveCount(0);
  await selectChild(state.form);
  await state.form.getByRole('button', { name: 'Select List', exact: true }).click();
  await state.form.getByRole('button', { name: 'Create New', exact: true }).click();
  await expect(state.form.getByRole('combobox', { name: 'Your relationship in this household' })).toHaveValue('');
  await expect(state.form.getByRole('combobox', { name: 'Relationship for Ana Santos' })).toHaveCount(0);
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

for (const role of ['son', 'daughter', 'grandfather', 'grandmother', 'grandchild']) {
  test(`Select List saves the member's ${role} relationship`, async ({ page }, testInfo) => {
    if (role === 'grandmother') await page.setViewportSize({ width: 390, height: 844 });
    const state = await prepare(page, true);
    await expect(state.form.getByRole('button', { name: 'Family Household', exact: true })).toHaveCount(0);
    await expect(state.form.getByRole('button', { name: 'Link Parents', exact: true })).toHaveCount(0);
    await state.form.getByRole('button', { name: 'Select List', exact: true }).click();
    await expect(state.form.getByText('Link Existing Family Members', { exact: true })).toHaveCount(0);
    await expect(state.form.getByRole('textbox', { name: 'Search existing family members', exact: true })).toHaveCount(0);
    await state.form.locator('[data-guide="member-household"]').selectOption('20');
    const relationship = state.form.getByRole('combobox', { name: 'Your relationship in this household', exact: true });
    await expect(relationship).toHaveAttribute('required', '');
    await relationship.selectOption(role);
    await expect(state.form.locator('[aria-label="Household preview"]')).toContainText('Maria Santos — Mother');
    if (role === 'grandfather' || role === 'grandmother') {
      await state.form.locator('[data-guide="member-family-links"]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('select-list-relationship.png') });
    }
    await state.form.getByRole('button', { name: 'Save Application Record', exact: true }).click();
    await expect(state.form).not.toBeVisible();
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].body.household_registration).toMatchObject({ mode: 'existing', household_id: 20, role, family_members: [] });
    expect(state.errors).toEqual([]);
  });
}

for (const ministry of [
  { id: '1', name: 'Junior Adult', canCreate: true },
  { id: '3', name: 'Old Adult', canCreate: true },
  { id: '2', name: 'Youth', canCreate: false },
  { id: '4', name: 'Kinder', canCreate: false },
  { id: '5', name: 'Elementary', canCreate: false },
  { id: '6', name: 'Highschool', canCreate: false },
  { id: '7', name: 'Young Adult', canCreate: false }
]) {
  test(`Create New eligibility for ${ministry.name}`, async ({ page }) => {
    const state = await prepare(page);
    await state.form.locator('[data-guide="member-ministry"]').first().selectOption(ministry.id);
    await expect(state.form.getByRole('button', { name: 'Create New', exact: true })).toHaveCount(ministry.canCreate ? 1 : 0);
    await expect(state.form.getByRole('region', { name: 'Parents’ household', exact: true })).toHaveCount(ministry.name === 'Junior Adult' ? 1 : 0);
    await expect(state.form.getByRole('button', { name: 'Select List', exact: true })).toBeVisible();
    await expect(state.form.getByRole('textbox', { name: 'Search existing family members', exact: true })).toHaveCount(ministry.canCreate ? 1 : 0);
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
  });
}

test('changing from adult Create New to Youth clears the draft family links', async ({ page }) => {
  const state = await prepare(page);
  await selectChild(state.form);
  await state.form.locator('[data-guide="member-ministry"]').first().selectOption('2');
  await expect(state.form.getByRole('button', { name: 'Create New', exact: true })).toHaveCount(0);
  await expect(state.form.locator('[data-guide="member-household"]')).toBeVisible();
  await expect(state.form.getByRole('textbox', { name: 'Search existing family members', exact: true })).toHaveCount(0);
  await expect(state.form.getByLabel('Your relationship in this household', { exact: true })).toHaveValue('');
  await state.form.locator('[data-guide="member-ministry"]').first().selectOption('1');
  await state.form.getByRole('button', { name: 'Create New', exact: true }).click();
  await expect(state.form.getByLabel('Relationship for Ana Santos', { exact: true })).toHaveCount(0);
  await expect(state.form.getByRole('textbox', { name: 'Search existing family members', exact: true })).toHaveValue('');
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

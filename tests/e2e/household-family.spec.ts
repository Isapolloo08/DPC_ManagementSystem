import { test, expect, type Page } from '@playwright/test';

async function prepare(page: Page, options: { motherOnly?: boolean; kinder?: boolean; noParents?: boolean; unassigned?: boolean; originalDetails?: string; relationship?: string; alternativeHousehold?: boolean } = {}) {
  const writes: { path: string; body: any }[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const ministries = [
    { id: 1, name: 'Kinder', min_age: 3, max_age: 5 },
    { id: 2, name: 'Highschool', min_age: 13, max_age: 16 },
    { id: 3, name: 'Junior Adult', min_age: 36, max_age: 55 },
    { id: 4, name: 'Elementary', min_age: 6, max_age: 12 },
    { id: 5, name: 'Youth', min_age: 17, max_age: 22 },
    { id: 6, name: 'Young Adult', min_age: 23, max_age: 35 },
    { id: 7, name: 'Old Adult', min_age: 56, max_age: 120 },
    { id: 8, name: 'General', min_age: 121, max_age: 999 }
  ];
  const father = { id: 10, first_name: 'Juan', last_name: 'Santos', birthdate: '1980-04-03', gender: 'Male', age: 46, ministry_id: 3, ministry_name: 'Junior Adult', contact_phone: '09111111111', household_id: 20, status: 'active' };
  const mother = { ...father, id: 11, first_name: 'Maria', gender: 'Female', contact_phone: '09222222222' };
  const child = { ...father, id: 12, first_name: 'Ana', gender: 'Female', birthdate: options.kinder ? '2022-04-03' : '2012-04-03', age: options.kinder ? 4 : 14, ministry_id: options.kinder ? 1 : 2, ministry_name: options.kinder ? 'Kinder' : 'Highschool', contact_phone: '09333333333', address: 'Daet, Camarines Norte', guardian_names: '', guardian_phone: '', school_name: 'Daet National High School', grade_level: 'Grade 9', invited_by: 'Pastor Pedro', family_details: options.originalDetails || '' };
  const members = options.motherOnly ? [mother, child] : [father, mother, child];
  const household: any = { id: 20, name: 'Santos Household', address: 'Daet', primary_contact_phone: '09444444444', father_name: options.motherOnly || options.noParents ? '' : 'Juan Santos', mother_name: options.noParents ? '' : 'Maria Santos', guardian_name: '', member_count: members.length, members };
  if (options.relationship) household.family_members = [{ member_id: child.id, name: 'Ana Santos', relationship: options.relationship }];
  const allMembers = options.unassigned ? [...members, { ...child, id: 13, first_name: 'Ben', household_id: null }] : members;
  const households = [household];
  if (options.alternativeHousehold) households.push({ id: 21, name: 'Reyes Household', mother_name: 'Teresa Reyes',
    family_members: [{ name: 'Miguel Reyes', relationship: 'Grandson', member_id: null }], members: [] });
  await page.addInitScript(() => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
    localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
  });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      const body = request.postDataJSON();
      writes.push({ path, body });
      const applyFamily = (target: any) => {
        for (const entry of body.family_members || []) {
          const member = allMembers.find(member => member.id === entry.member_id);
          if (member) member.household_id = target.id;
        }
        target.members = allMembers.filter(member => member.household_id === target.id);
      };
      if (path === '/api/households/20') { Object.assign(household, body); applyFamily(household); }
      if (path === '/api/households' && request.method() === 'POST') {
        const created = { ...body, id: 30 };
        applyFamily(created);
        households.push(created);
      }
      if (path === '/api/members/12') {
        Object.assign(child, body);
        if (body.household_parent) (household as any)[`${body.household_parent.role}_name`] = body.household_parent.name;
        if (body.household_registration?.role === 'daughter') household.family_members = [{ member_id: child.id, name: 'Ana Santos', relationship: 'Daughter' }];
      }
      return route.fulfill({ json: { id: path === '/api/households' ? 30 : 20, message: 'Saved' } });
    }
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Admin', role_name: 'Admin', ministries: [] } };
    else if (path.endsWith('/ministries')) json = ministries;
    else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/members/check-duplicate')) json = { duplicateName: null };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
    else if (path.endsWith('/households')) json = households;
    else if (path.endsWith('/members/12')) json = child;
    else if (path.endsWith('/members')) json = allMembers;
    await route.fulfill({ json });
  });
  await page.goto('/');
  if (page.viewportSize()!.width < 1024) await page.getByRole('button', { name: 'Toggle navigation menu' }).click();
  await page.getByTitle('Members & Families', { exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Ana Santos' })).toBeVisible();
  return { writes, errors, household };
}

async function editChild(page: Page) {
  await page.getByRole('row').filter({ hasText: 'Ana Santos' }).getByTitle('Edit Member Record').click();
  return page.getByRole('dialog', { name: 'Edit Member', exact: true });
}

test('linking a household supplements original family entries and profile saves preserve them', async ({ page }, testInfo) => {
  const original = 'Ate: Liza Santos, Kuya: Marco Santos, Mama: Maria Santos, Papa: Juan Santos';
  const state = await prepare(page, { originalDetails: original });
  await page.locator('main tbody tr').filter({ hasText: 'Ana Santos' }).getByRole('button', { name: 'Details', exact: true }).click();
  const profile = page.locator('[data-modal-panel]').filter({ hasText: 'Application for Membership Card' });
  await expect(profile.getByText('Liza Santos', { exact: true })).toBeVisible();
  await expect(profile.getByText('Marco Santos', { exact: true })).toBeVisible();
  // The linked parents replace matching application names in the view, without duplicating them.
  await expect(profile.getByText('Juan Santos', { exact: true })).toHaveCount(1);
  await expect(profile.getByText('Maria Santos', { exact: true })).toHaveCount(1);
  await expect(profile).toContainText('Family Members (5)');
  await profile.getByText('Liza Santos', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('preserved-family-details.png') });
  await profile.getByRole('button', { name: 'Edit Record', exact: true }).click();
  const app = page.getByRole('dialog', { name: 'Edit Member', exact: true });
  const details = app.getByPlaceholder('e.g. Parents, 2 siblings');
  await expect(details).toHaveValue('Father: Juan Santos; Mother: Maria Santos; Ana Santos; Ate: Liza Santos; Kuya: Marco Santos');
  await expect(details).toHaveAttribute('readonly', '');
  await expect(app.getByLabel('Additional family details', { exact: true })).toHaveValue(original);
  await expect(app.getByLabel('Additional family details', { exact: true })).not.toHaveAttribute('readonly', '');
  await app.getByLabel('Your relationship in this household', { exact: true }).selectOption('daughter');
  await app.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(app).not.toBeVisible();
  expect(state.writes[0].body.family_details).toBe(original);
  expect(state.errors).toEqual([]);
});

test('comma-separated original names remain visible alongside the linked father', async ({ page }) => {
  const state = await prepare(page, { originalDetails: 'Andrie, SI Mama, Si Papa' });
  await page.locator('main tbody tr').filter({ hasText: 'Ana Santos' }).getByRole('button', { name: 'Details', exact: true }).click();
  const profile = page.locator('[data-modal-panel]').filter({ hasText: 'Application for Membership Card' });
  for (const name of ['Andrie', 'SI Mama', 'Si Papa', 'Juan Santos']) await expect(profile.getByText(name, { exact: true })).toBeVisible();
  expect(state.errors).toEqual([]);
});

test('household roles reflect in family members and allow parents outside the directory', async ({ page }, testInfo) => {
  const state = await prepare(page);
  await page.getByRole('button', { name: /Households \(/ }).click();
  await expect(page.getByText('Father', { exact: true })).toBeVisible();
  await expect(page.getByText('Mother', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit household & family' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Household' });
  await dialog.getByPlaceholder("Search guardian or type full name...").fill('Tita Rosa');
  await dialog.getByRole('button', { name: 'Save Household' }).click();
  await expect(dialog).not.toBeVisible();
  expect(state.writes[0].body).toMatchObject({ father_name: 'Juan Santos', mother_name: 'Maria Santos', guardian_name: 'Tita Rosa' });
  await expect(page.getByText('Tita Rosa', { exact: true })).toBeVisible();
  await testInfo.attach('Household roles', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: /All Members \(/ }).click();
  const app = await editChild(page);
  await expect(app.getByPlaceholder('e.g. Parents, 2 siblings')).toHaveValue('Father: Juan Santos; Mother: Maria Santos; Guardian: Tita Rosa; Ana Santos');
  expect(state.errors).toEqual([]);
});

for (const motherOnly of [false, true]) {
  test(`Kinder application defaults to ${motherOnly ? 'mother when father is absent' : 'father before mother'}`, async ({ page }) => {
    const state = await prepare(page, { kinder: true, motherOnly });
    const app = await editChild(page);
    await expect(app.getByPlaceholder('e.g. Juan & Maria Bautista')).toHaveValue(motherOnly ? 'Maria Santos' : 'Juan Santos');
    await expect(app.getByPlaceholder('e.g. Juan & Maria Bautista')).toHaveAttribute('readonly', '');
    await app.getByLabel('Your relationship in this household', { exact: true }).selectOption('daughter');
    await app.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect(app).not.toBeVisible();
    expect(state.writes[0].body).toMatchObject({ guardian_names: motherOnly ? 'Maria Santos' : 'Juan Santos', guardian_phone: motherOnly ? '09222222222' : '09111111111', household_id: 20 });
    expect(state.writes[0].body.household_parent).toBeUndefined();
    expect(state.errors).toEqual([]);
  });
}

test('the application guardian remains separate from the member relationship in the household', async ({ page }) => {
  const state = await prepare(page, { kinder: true, noParents: true });
  const app = await editChild(page);
  await app.getByPlaceholder('e.g. Juan & Maria Bautista').fill('Lorna Santos');
  await app.getByLabel('Your relationship in this household', { exact: true }).selectOption('daughter');
  await app.getByPlaceholder('e.g. 09123456789', { exact: true }).last().fill('09555555555');
  await app.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(app).not.toBeVisible();
  expect(state.writes[0].body.guardian_names).toBe('Lorna Santos');
  expect(state.writes[0].body.household_parent).toBeUndefined();
  expect(state.writes[0].body.household_registration).toMatchObject({ mode: 'existing', household_id: 20, role: 'daughter' });
  expect(state.household.mother_name).toBe('');
  expect(state.errors).toEqual([]);
});

test('editing a member restores and updates their saved household relationship', async ({ page }) => {
  const state = await prepare(page, { relationship: 'Granddaughter' });
  const app = await editChild(page);
  await expect(app.getByLabel('Your relationship in this household', { exact: true })).toHaveValue('granddaughter');
  await app.getByLabel('Your relationship in this household', { exact: true }).selectOption('daughter');
  await app.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(app).not.toBeVisible();
  const reopened = await editChild(page);
  await expect(reopened.getByLabel('Your relationship in this household', { exact: true })).toHaveValue('daughter');
  expect(state.errors).toEqual([]);
});

test('edit household adds a church member and an unregistered relative and reflects both in applications', async ({ page }) => {
  const state = await prepare(page, { unassigned: true });
  await page.getByRole('button', { name: /Households \(/ }).click();
  await page.getByRole('button', { name: 'Edit household & family' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Household' });
  await dialog.getByRole('button', { name: 'Add Family Member', exact: true }).click();
  const linked = dialog.getByRole('group', { name: 'Family member 2', exact: true });
  await linked.getByPlaceholder('Search member or type full name...').fill('Ben');
  await page.getByRole('button', { name: /Ben Santos.*Highschool/ }).click();
  await expect(linked).toContainText('DPC Member:');
  await linked.getByRole('combobox').selectOption('Son');
  await dialog.getByRole('button', { name: 'Add Family Member', exact: true }).click();
  const custom = dialog.getByRole('group', { name: 'Family member 3', exact: true });
  await custom.getByPlaceholder('Search member or type full name...').fill('Carla Santos');
  await custom.getByRole('combobox').selectOption('Daughter');
  await dialog.getByRole('button', { name: 'Save Household', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(state.writes[0].body.family_members).toEqual(expect.arrayContaining([
    { name: 'Juan Santos', member_id: 10, relationship: 'Father' },
    { name: 'Ana Santos', member_id: 12, relationship: 'Family Member' },
    { name: 'Ben Santos', member_id: 13, relationship: 'Son' },
    { name: 'Carla Santos', member_id: null, relationship: 'Daughter' }
  ]));
  await expect(page.getByText('5 Family Members', { exact: true })).toBeVisible();
  await expect(page.getByText('Carla Santos', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /All Members \(/ }).click();
  const app = await editChild(page);
  await expect(app.getByPlaceholder('e.g. Parents, 2 siblings')).toHaveValue('Father: Juan Santos; Mother: Maria Santos; Ana Santos; Son: Ben Santos; Daughter: Carla Santos');
  expect(state.errors).toEqual([]);
});

for (const ministry of [
  { id: '1', name: 'Kinder' }, { id: '4', name: 'Elementary' },
  { id: '2', name: 'Highschool' }, { id: '5', name: 'Youth' },
  { id: '6', name: 'Young Adult' }, { id: '3', name: 'Junior Adult' },
  { id: '7', name: 'Old Adult' }, { id: '8', name: 'General' }
]) {
  test(`selecting a household reflects family members in the ${ministry.name} form`, async ({ page }, testInfo) => {
    if (ministry.name === 'Youth') await page.setViewportSize({ width: 390, height: 844 });
    const state = await prepare(page, { originalDetails: 'Andrie', relationship: 'Daughter' });
    const app = await editChild(page);
    await app.getByRole('button', { name: 'Individual', exact: true }).click();
    await expect(app.getByRole('textbox', { name: /^Family Members/ })).toHaveValue('Andrie');
    await app.locator('[data-guide="member-ministry"]').first().selectOption(ministry.id);
    await app.getByRole('button', { name: 'Select List', exact: true }).click();
    await app.locator('[data-guide="member-household"]').selectOption('20');
    const field = app.getByRole('textbox', { name: /^Family Members/ });
    await expect(field).toHaveValue('Father: Juan Santos; Mother: Maria Santos; Daughter: Ana Santos; Andrie');
    await expect(field).toHaveAttribute('readonly', '');
    await expect(app.getByLabel('Additional family details', { exact: true })).toHaveValue('Andrie');
    if (ministry.name === 'Youth') {
      await field.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('household-family-reflected.png') });
    }
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
  });
}

test('switching or clearing the household updates family reflection without overwriting entered relatives', async ({ page }) => {
  const state = await prepare(page, { originalDetails: 'Andrie', alternativeHousehold: true });
  const app = await editChild(page);
  const field = app.getByRole('textbox', { name: /^Family Members/ });
  await expect(field).toHaveValue('Father: Juan Santos; Mother: Maria Santos; Ana Santos; Andrie');
  await app.getByLabel('Additional family details', { exact: true }).fill('Andrie, Liza');
  await app.locator('[data-guide="member-household"]').selectOption('21');
  await expect(field).toHaveValue('Mother: Teresa Reyes; Grandson: Miguel Reyes; Andrie; Liza');
  await app.locator('[data-guide="member-household"]').selectOption('');
  await expect(field).toHaveValue('Andrie, Liza');
  await expect(field).not.toHaveAttribute('readonly', '');
  await expect(app.getByLabel('Additional family details', { exact: true })).toHaveCount(0);
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('create household adds name-only family members and removes unused draft rows on mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await prepare(page);
  await page.getByRole('button', { name: 'New Household', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create Household' });
  await dialog.getByPlaceholder('e.g. The Remot Family or Antonio Remot Household').fill('Reyes Household');
  await dialog.getByPlaceholder("e.g. Antonio Remot").fill('Roberto Reyes');
  await dialog.getByRole('button', { name: 'Add Family Member', exact: true }).click();
  const row = dialog.getByRole('group', { name: 'Family member 1', exact: true });
  await row.getByPlaceholder('Search member or type full name...').fill('Mateo Reyes');
  await row.getByRole('combobox').selectOption('Son');
  await dialog.getByRole('button', { name: 'Add Family Member', exact: true }).click();
  await dialog.getByRole('button', { name: 'Remove family member 2', exact: true }).click();
  await expect(dialog.getByRole('group', { name: /^Family member / })).toHaveCount(1);
  const bounds = await dialog.boundingBox();
  expect(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390 && bounds.height <= 844).toBeTruthy();
  await testInfo.attach('Family member editor mobile', { body: await page.screenshot(), contentType: 'image/png' });
  await dialog.getByRole('button', { name: 'Create Household', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(state.writes[0].body.family_members).toEqual([{ name: 'Roberto Reyes', relationship: 'Father', member_id: null }, { name: 'Mateo Reyes', relationship: 'Son', member_id: null }]);
  await page.getByRole('button', { name: /Households \(/ }).click();
  await expect(page.getByText('Mateo Reyes', { exact: true })).toBeVisible();
  expect(state.errors).toEqual([]);
});

test('duplicate family members do not save and cancelling discards draft additions', async ({ page }) => {
  const state = await prepare(page);
  await page.getByRole('button', { name: /Households \(/ }).click();
  await page.getByRole('button', { name: 'Edit household & family' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Household' });
  await dialog.getByRole('button', { name: 'Add Family Member', exact: true }).click();
  const row = dialog.getByRole('group', { name: 'Family member 2', exact: true });
  await row.getByPlaceholder('Search member or type full name...').fill('Ana Santos');
  await dialog.getByRole('button', { name: 'Save Household', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('remove any duplicate entries');
  expect(state.writes).toEqual([]);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Edit household & family' }).click();
  await expect(dialog.getByRole('group', { name: /^Family member / })).toHaveCount(1);
  expect(state.errors).toEqual([]);
});

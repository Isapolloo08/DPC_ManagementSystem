import { test, expect, type Page, type Locator } from '@playwright/test';

const addressPlaceholder = 'e.g. Purok 4, Sitio Maligaya, Brgy. Bagang, Daet, Camarines Norte';

async function prepare(page: Page, theme = 'light', existingHousehold = false) {
  const writes: { path: string; body: any }[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
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
      return route.fulfill({ json: { id: path.endsWith('/households') ? 20 : 30 } });
    }
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Admin', role_name: 'Admin', ministries: [] } };
    else if (path.endsWith('/ministries')) json = [{ id: 1, name: 'Junior Adult', min_age: 27, max_age: 59 }];
    else if (path.endsWith('/households') && existingHousehold) json = [{ id: 20, name: 'Dela Cruz Household',
      father_name: 'Juan Dela Cruz', family_members: [{ name: 'Andrie Dela Cruz', relationship: 'Son', member_id: null }], members: [] }];
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
  return { writes, errors };
}

async function birthday(page: Page, scope: Locator) {
  await scope.getByText('Select birthdate', { exact: true }).or(scope.getByText('Select birthday', { exact: true })).click();
  const calendar = page.getByTitle('Previous Month', { exact: true }).locator('../..');
  await calendar.getByRole('button', { name: /^\d{4}$/ }).click();
  await calendar.getByRole('button', { name: '1990', exact: true }).click();
  await calendar.getByRole('button', { name: '15', exact: true }).click();
}

async function enterMain(page: Page, existingHousehold = false) {
  const main = page.getByRole('dialog', { name: 'Add New Member Record', exact: true });
  await main.getByPlaceholder('e.g. Mark Andrie M. Remot').fill('Juan Dela Cruz');
  await birthday(page, main);
  await main.getByRole('button', { name: /Married/ }).click();
  await main.getByRole('button', { name: '+ Register Spouse as New Member', exact: true }).click();
  await expect(main.getByPlaceholder('e.g. Maria')).toHaveCount(0);
  await main.getByRole('button', { name: 'Type Manually', exact: true }).click();
  await main.getByPlaceholder(addressPlaceholder).fill('Purok 1, Daet, Camarines Norte');
  await main.getByPlaceholder('e.g. 09123456789', { exact: true }).fill('09123456789');
  await main.getByPlaceholder('Search member name or type custom...').fill('Pastor Pedro');
  if (existingHousehold) {
    await main.getByRole('button', { name: 'Select List', exact: true }).click();
    await main.locator('[data-guide="member-household"]').selectOption('20');
    await main.getByLabel('Your relationship in this household', { exact: true }).selectOption('husband');
    await expect(main.getByLabel('Family Members', { exact: true })).toHaveValue('Father: Juan Dela Cruz; Son: Andrie Dela Cruz');
  }
  await main.getByRole('button', { name: 'Continue to Partner', exact: true }).click();
  const partner = page.getByRole('dialog', { name: 'Register Partner as New Member', exact: true });
  await expect(partner).toBeVisible();
  return partner;
}

async function enterPartner(page: Page, partner: Locator) {
  await partner.getByPlaceholder('e.g. Maria', { exact: true }).fill('Maria');
  await birthday(page, partner);
}

test('separate partner step reflects shared details, retains inputs on back, and saves both once', async ({ page }, testInfo) => {
  const state = await prepare(page);
  const partner = await enterMain(page);
  expect(state.writes).toEqual([]);
  await expect(partner).toContainText('Pastor Pedro');
  await expect(partner).toContainText('Purok 1, Daet, Camarines Norte');
  await enterPartner(page, partner);
  await expect(partner.locator('[aria-label="Couple household summary"]')).toContainText('Dela Cruz Household');
  await expect(partner.locator('[aria-label="Couple household summary"]')).toContainText('Maria Dela Cruz · Spouse');
  await partner.getByRole('button', { name: 'Back to Member', exact: true }).first().click();
  const main = page.getByRole('dialog', { name: 'Add New Member Record', exact: true });
  await expect(main.locator('[aria-label="Household preview"]')).toContainText('Maria Dela Cruz');
  await expect(main.locator('[aria-label="Household preview"]')).toContainText('Spouse · New member');
  await main.getByPlaceholder(addressPlaceholder).fill('Purok 2, Daet, Camarines Norte');
  await main.getByPlaceholder('Search member name or type custom...').fill('Pastor Pablo');
  await main.getByRole('button', { name: 'Continue to Partner' }).click();
  await expect(partner.getByPlaceholder('e.g. Maria', { exact: true })).toHaveValue('Maria');
  await expect(partner).toContainText('Pastor Pablo');
  await expect(partner).toContainText('Purok 2, Daet, Camarines Norte');
  const left = await page.locator('[inert]').filter({ has: page.getByText('Add New Member Record', { exact: true }) }).boundingBox();
  const right = await partner.boundingBox();
  expect(left && right && right.x > left.x + left.width).toBeTruthy();
  await testInfo.attach('Partner modal desktop', { body: await page.screenshot({ path: testInfo.outputPath('partner-modal.png') }), contentType: 'image/png' });
  await partner.getByRole('button', { name: 'Save Both Members' }).click();
  await expect(partner).not.toBeVisible();
  expect(state.writes.map(write => write.path)).toEqual(['/api/members']);
  const payload = state.writes[0].body;
  expect(payload.household_registration).toMatchObject({ mode: 'create', name: 'Dela Cruz Household', family_members: [] });
  expect(payload.partner_record).toMatchObject({ first_name: 'Maria', last_name: 'Dela Cruz', invited_by: 'Pastor Pablo', address: 'Purok 2, Daet, Camarines Norte', household_id: null });
  expect(state.errors).toEqual([]);
});

test('partner form reflects the shared selected household and saves additional relatives separately', async ({ page }) => {
  const state = await prepare(page, 'light', true);
  const partner = await enterMain(page, true);
  await expect(partner.getByLabel('Partner Family Members / Children', { exact: true })).toHaveValue('Father: Juan Dela Cruz; Son: Andrie Dela Cruz');
  await partner.getByLabel('Additional family details', { exact: true }).fill('Liza Dela Cruz');
  await expect(partner.getByLabel('Partner Family Members / Children', { exact: true })).toHaveValue('Father: Juan Dela Cruz; Son: Andrie Dela Cruz; Liza Dela Cruz');
  await enterPartner(page, partner);
  await partner.getByRole('button', { name: 'Save Both Members' }).click();
  await expect(partner).not.toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body.household_registration).toMatchObject({ mode: 'existing', household_id: 20, role: 'husband' });
  expect(state.writes[0].body.partner_record.family_details).toBe('Liza Dela Cruz');
  expect(state.errors).toEqual([]);
});

test('mobile partner step uses a separate address and inviter without losing drafts on toggle', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await prepare(page);
  const partner = await enterMain(page);
  await enterPartner(page, partner);
  await partner.getByRole('radio', { name: 'No, different address', exact: true }).check();
  await partner.getByRole('button', { name: 'Type Manually', exact: true }).click();
  await partner.getByPlaceholder(addressPlaceholder).fill('Purok 3, Talisay, Camarines Norte');
  await partner.getByRole('radio', { name: 'Yes, same address', exact: true }).check();
  await partner.getByRole('radio', { name: 'No, different address', exact: true }).check();
  await expect(partner.getByPlaceholder(addressPlaceholder)).toHaveValue('Purok 3, Talisay, Camarines Norte');
  await partner.getByRole('radio', { name: 'No, different inviter', exact: true }).check();
  await partner.getByPlaceholder('Search member name or type custom...').fill('Sister Ana');
  await partner.getByRole('button', { name: 'Back to Member', exact: true }).first().click();
  await page.getByRole('button', { name: 'Continue to Partner', exact: true }).click();
  await expect(partner.getByPlaceholder(addressPlaceholder)).toHaveValue('Purok 3, Talisay, Camarines Norte');
  await expect(partner.getByPlaceholder('Search member name or type custom...')).toHaveValue('Sister Ana');
  const bounds = await partner.boundingBox();
  expect(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390 && bounds.height <= 844).toBeTruthy();
  await testInfo.attach('Partner modal mobile', { body: await page.screenshot({ path: testInfo.outputPath('partner-modal.png') }), contentType: 'image/png' });
  await partner.getByRole('button', { name: 'Save Both Members' }).click();
  await expect(partner).not.toBeVisible();
  expect(state.writes[0].body.partner_record).toMatchObject({ invited_by: 'Sister Ana', address: 'Purok 3, Talisay, Camarines Norte' });
  expect(state.errors).toEqual([]);
});

test('incomplete partner cannot write records and switching to search clears the partner flow', async ({ page }) => {
  const state = await prepare(page);
  const partner = await enterMain(page);
  await partner.getByRole('button', { name: 'Save Both Members' }).click();
  await expect(partner).toBeVisible();
  expect(state.writes).toEqual([]);
  await partner.getByPlaceholder('e.g. Maria', { exact: true }).fill('Maria');
  await partner.getByRole('button', { name: 'Save Both Members' }).click();
  await expect(page.getByText("Please enter the partner's first name, last name, and birthday.", { exact: true })).toBeVisible();
  expect(state.writes).toEqual([]);
  await partner.getByRole('button', { name: 'Back to Member', exact: true }).first().click();
  await page.getByRole('button', { name: 'Switch back to Search', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save Application Record', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue to Partner', exact: true })).toHaveCount(0);
  expect(state.errors).toEqual([]);
});


test('dark mode keeps the side modal readable and permits a partner with no shared inviter', async ({ page }, testInfo) => {
  const state = await prepare(page, 'dark');
  const partner = await enterMain(page);
  await enterPartner(page, partner);
  await partner.getByRole('radio', { name: 'No, different inviter', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(partner).toHaveCSS('background-color', 'rgb(30, 41, 59)');
  await testInfo.attach('Partner modal dark', { body: await page.screenshot({ path: testInfo.outputPath('partner-modal.png') }), contentType: 'image/png' });
  await partner.getByRole('button', { name: 'Save Both Members' }).click();
  await expect(partner).not.toBeVisible();
  expect(state.writes[0].body.partner_record.invited_by).toBe('');
  expect(state.writes[0].body.invited_by).toBe('Pastor Pedro');
  expect(state.errors).toEqual([]);
});

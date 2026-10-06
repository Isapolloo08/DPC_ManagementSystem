import { test, expect, type Page } from '@playwright/test';

// Software compositing avoids missing text in Windows headless GPU captures.
test.use({ launchOptions: { args: ['--disable-gpu'] } });

const members = [
  { id: 1, first_name: 'Alexson', last_name: 'Delos Angeles', contact_phone: '09294937729', age: 21, birthdate: '2005-04-21', birth_month_name: 'April', birth_day: 21 },
  { id: 2, first_name: 'Andrea Rose', last_name: 'Osorio', contact_phone: '09617231117', age: 18, birthdate: '2008-08-21', birth_month_name: 'August', birth_day: 21 },
  { id: 3, first_name: 'Angelica Kaye', last_name: 'Zaleta', contact_phone: '09303779343', age: 25, birthdate: '2001-07-14', birth_month_name: 'July', birth_day: 14 },
].map(member => ({ ...member, gender: 'Female', status: 'active', ministry_id: 1, ministry_name: 'Youth', ministry_color: '#6e8b74', household_id: null, baptism_status: 'not_baptized' }));

async function prepare(page: Page, mode: string, authenticated = true) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(({ mode, authenticated }) => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
    localStorage.setItem('dpc_theme_mode', mode);
    if (authenticated) localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
  }, { mode, authenticated });
  // The UI font must work when external font services are unavailable.
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) throw new Error('Typography previews must not write records');
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Mark Angelo', role_name: 'Admin', ministries: [] } };
    else if (path.endsWith('/ministries')) json = [{ id: 1, name: 'Youth', min_age: 17, max_age: 26 }, { id: 2, name: 'Junior Adult', min_age: 36, max_age: 55 }];
    else if (path.endsWith('/members')) json = members;
    else if (path.endsWith('/members/check-duplicate')) json = { duplicateName: null };
    else if (path.endsWith('/reports/dashboard')) json = { metrics: { total_active_members: 3, total_households: 0, unenrolled_members_count: 0, upcoming_events_count: 0 }, ministry_breakdown: [] };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
    else if (path.endsWith('/duty/schedule') || path.endsWith('/dishwashing/schedule')) json = { schedule: [], total_teams: 0 };
    await route.fulfill({ json });
  });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => [...document.fonts].some(font => font.family === 'Outfit' && font.status === 'loaded'))).toBe(true);
  return errors;
}

for (const mode of ['light', 'dark']) {
  test(`directory hierarchy and secondary text remain readable in ${mode}`, async ({ page }, testInfo) => {
    const errors = await prepare(page, mode);
    await expect(page.locator('.overview-heading h1')).toHaveCSS('font-weight', '500');
    await page.getByTitle('Members & Families', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Members & Family Directory', exact: true })).toHaveCSS('font-weight', '600');
    await expect(page.getByRole('heading', { name: 'Members & Family Directory', exact: true })).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(page.getByRole('button', { name: 'Add Member', exact: true })).toHaveCSS('font-weight', '500');
    const row = page.locator('main tbody tr').filter({ hasText: 'Alexson Delos Angeles' });
    const contact = row.getByText('09294937729', { exact: true });
    await expect(contact).toHaveCSS('font-weight', '400');
    await expect(contact).toHaveCSS('font-size', '12px');
    const contrast = await contact.evaluate(element => {
      const rgb = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
      const luminance = (channels: number[]) => channels.map(channel => {
        const value = channel / 255;
        return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
      }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
      let background = element.parentElement!;
      while (getComputedStyle(background).backgroundColor === 'rgba(0, 0, 0, 0)') background = background.parentElement!;
      const ink = luminance(rgb(getComputedStyle(element).color));
      const surface = luminance(rgb(getComputedStyle(background).backgroundColor));
      return (Math.max(ink, surface) + .05) / (Math.min(ink, surface) + .05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('heading', { name: 'Members & Family Directory', exact: true }).screenshot({ path: testInfo.outputPath('heading.png') });
    await page.screenshot({ path: testInfo.outputPath(`members-${mode}.png`), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Add Member', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Add New Member Record', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder('e.g. Mark Andrie M. Remot')).toHaveCSS('font-size', '13px');
    await page.setViewportSize({ width: 390, height: 844 });
    const bounds = await dialog.boundingBox();
    expect(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`member-modal-mobile-${mode}.png`) });
    expect(errors).toEqual([]);
  });
}

test('login keeps the bundled UI font on small screens with external fonts blocked', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await prepare(page, 'dark', false);
  await expect(page.getByRole('heading', { name: 'Sign In to Your Portal' })).toHaveCSS('font-weight', '600');
  await expect(page.getByRole('button', { name: 'Sign In to DPC Portal' })).toHaveCSS('font-weight', '500');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('login-mobile-dark.png'), fullPage: true });
  expect(errors).toEqual([]);
});

import { test, expect, type Page } from '@playwright/test';

test.use({ launchOptions: { args: ['--disable-gpu'] } });

async function prepare(page: Page, theme: string) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(theme => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('dpc_theme_mode', theme);
    localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
  }, theme);
  const members = Array.from({ length: 74 }, (_, i) => ({
    id: i + 1, first_name: `Member ${String(i + 1).padStart(2, '0')}`, last_name: 'Santos',
    age: 21, birthdate: '2005-04-21', birth_month_name: 'April', birth_day: 21,
    contact_phone: '09123456789', gender: 'Male', status: 'active',
    ministry_id: 1, ministry_name: 'Youth', ministry_color: '#6e8b74',
    baptism_status: 'not_baptized', attendance_health: 'action_required',
    bible_study_group_name: 'Youth Group', household_id: null
  }));
  await page.route('**/api/**', async route => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
      throw new Error('Scrolling checks must not write records');
    }
    const url = new URL(route.request().url());
    const path = url.pathname;
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Admin', role_name: 'Admin', ministries: [] } };
    else if (path.endsWith('/ministries')) json = [{ id: 1, name: 'Youth', min_age: 17, max_age: 26 }];
    else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
    else if (path.endsWith('/members/check-duplicate')) json = { duplicateName: null };
    else if (path.endsWith('/members')) {
      const search = url.searchParams.get('search')?.toLowerCase() || '';
      const filtered = members.filter(member => `${member.first_name} ${member.last_name}`.toLowerCase().includes(search));
      const current = Number(url.searchParams.get('page') || 1);
      const limit = Number(url.searchParams.get('limit') || 30);
      json = url.searchParams.has('page')
        ? { data: filtered.slice((current - 1) * limit, current * limit), pagination: { total: filtered.length, totalPages: Math.ceil(filtered.length / limit), page: current } }
        : filtered;
    }
    await route.fulfill({ json });
  });
  await page.goto('/');
  if (page.viewportSize()!.width < 1024) await page.getByRole('button', { name: 'Toggle navigation menu' }).click();
  await page.getByTitle('Members & Families', { exact: true }).click();
  await expect(page.locator('main tbody tr')).toHaveCount(30);
  return errors;
}

for (const viewport of [
  { width: 1920, height: 1080, theme: 'light' },
  { width: 1366, height: 768, theme: 'dark' },
  { width: 390, height: 844, theme: 'light' },
]) {
  test(`member controls and headers stay available while scrolling at ${viewport.width}px in ${viewport.theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const errors = await prepare(page, viewport.theme);
    const list = page.getByRole('region', { name: 'Member directory', exact: true });
    const search = page.getByRole('textbox', { name: 'Search members' });
    await page.locator('main').evaluate(element => { element.scrollTop = element.scrollHeight; });
    await list.evaluate(element => { element.scrollTop = 700; });
    await expect.poll(() => list.evaluate(element => element.scrollTop)).toBeGreaterThan(600);

    const assertPinned = async () => {
      const geometry = await page.evaluate(() => {
        const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
        const main = box('main');
        const toolbar = box('[data-directory-toolbar]');
        const list = box('[aria-label="Member directory"]');
        const header = box('main thead');
        const search = box('[aria-label="Search members"]');
        const add = box('[data-guide="member-add"]');
        return {
          mainTop: main.top, toolbarTop: toolbar.top, toolbarBottom: toolbar.bottom,
          listTop: list.top, listBottom: list.bottom, headerTop: header.top,
          searchTop: search.top, addBottom: add.bottom,
          headerBackground: getComputedStyle(document.querySelector('main thead')!).backgroundColor,
          documentOverflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(geometry.toolbarTop).toBeGreaterThanOrEqual(geometry.mainTop);
      expect(geometry.toolbarTop - geometry.mainTop).toBeLessThan(40);
      expect(geometry.searchTop).toBeGreaterThanOrEqual(geometry.toolbarTop);
      expect(geometry.addBottom).toBeLessThanOrEqual(geometry.toolbarBottom);
      expect(geometry.listTop).toBeGreaterThanOrEqual(geometry.toolbarBottom);
      expect(Math.abs(geometry.headerTop - geometry.listTop)).toBeLessThan(2);
      expect(geometry.listBottom).toBeLessThan(viewport.height);
      expect(geometry.headerBackground).not.toMatch(/rgba\(.+, 0\)|transparent/);
      expect(geometry.documentOverflow).toBe(false);
    };
    await assertPinned();
    await page.screenshot({ path: testInfo.outputPath('scrolled-directory.png'), animations: 'disabled' });

    // Horizontal scrolling uses the same table for its header and rows.
    if (viewport.width < 1400) {
      await list.evaluate(element => { element.scrollLeft = element.scrollWidth; });
      await expect.poll(() => list.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
      await assertPinned();
      await list.evaluate(element => { element.scrollLeft = 0; });
    }
    await page.getByTitle('Next Page', { exact: true }).click();
    await expect(page.locator('main tbody tr').first()).toContainText('Member 31');
    await expect.poll(() => list.evaluate(element => element.scrollTop)).toBe(0);

    await list.evaluate(element => { element.scrollTop = 700; });
    await search.fill('Member 74');
    await expect(page.locator('main tbody tr')).toHaveCount(1);
    await expect(page.locator('main tbody tr')).toContainText('Member 74');
    await expect.poll(() => list.evaluate(element => element.scrollTop)).toBe(0);
    await search.clear();
    await expect(page.locator('main tbody tr')).toHaveCount(30);

    await page.getByRole('button', { name: 'Add Member', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Add New Member Record', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

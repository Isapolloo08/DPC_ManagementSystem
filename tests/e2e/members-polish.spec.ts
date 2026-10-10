import { test, expect, type Page } from '@playwright/test';

test.use({ launchOptions: { args: ['--disable-gpu'] } });

async function prepare(page: Page, theme: string, noFollowUp = false) {
  const queries: string[] = [], writes: string[] = [], errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(theme => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    if (!localStorage.getItem('dpc_theme_mode')) localStorage.setItem('dpc_theme_mode', theme);
    localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
  }, theme);
  const members = Array.from({ length: 6 }, (_, index) => ({
    id: index + 1, first_name: `Member ${index + 1}`, last_name: 'Santos', age: 21,
    birthdate: '2005-04-21', birth_month_name: 'April', birth_day: 21, contact_phone: '09123456789',
    gender: 'Male', status: index === 2 ? 'visitor' : index === 3 ? 'inactive' : 'active',
    ministry_id: 1, ministry_name: 'Youth', ministry_color: '#6e8b74', household_id: null,
    baptism_status: index === 1 ? 'baptized' : 'not_baptized',
    attendance_health: !noFollowUp && index === 4 ? 'action_required' : index === 5 ? 'warning' : 'healthy',
    consecutive_absences: !noFollowUp && index === 4 ? 3 : index === 5 ? 1 : 0,
  }));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let json: any = [];
    if (route.request().method() !== 'GET') { writes.push(path); return route.fulfill({ json: { success: true } }); }
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
      queries.push(url.search);
      const rows = url.searchParams.get('attendance_health_filter') === 'action_required' ? [members[4]] : members;
      json = url.searchParams.has('page') ? { data: rows, pagination: { total: rows.length, totalPages: 1, page: 1 } } : rows;
    }
    await route.fulfill({ json });
  });
  await page.goto('/');
  if (page.viewportSize()!.width < 1024) await page.getByRole('button', { name: 'Toggle navigation menu' }).click();
  await page.locator('aside').getByTitle('Members & Families', { exact: true }).click();
  await expect(page.locator('main tbody tr')).toHaveCount(6);
  return { queries, writes, errors };
}

async function badgeContrasts(page: Page) {
  return page.locator('.members-table .member-badge').evaluateAll(elements => {
    const parse = (value: string) => value.match(/[\d.]+/g)!.map(Number);
    const over = (color: number[], below: number[]) => color.slice(0, 3).map((value, i) => value * (color[3] ?? 1) + below[i] * (1 - (color[3] ?? 1)));
    const luminance = (rgb: number[]) => rgb.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    return elements.map(element => {
      const ancestors: Element[] = []; let node: Element | null = element;
      while (node) { ancestors.unshift(node); node = node.parentElement; }
      const background = ancestors.reduce((bg, ancestor) => over(parse(getComputedStyle(ancestor).backgroundColor), bg), [255, 255, 255]);
      const foreground = over(parse(getComputedStyle(element).color), background);
      const a = luminance(foreground), b = luminance(background);
      return { text: element.textContent, contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
    });
  });
}

for (const theme of ['light', 'dark']) {
  test(`zero follow-up count uses neutral styling in ${theme}`, async ({ page }) => {
    const state = await prepare(page, theme, true);
    const chip = page.getByRole('button', { name: '0 need follow-up on this page', exact: true });
    await expect(chip).toHaveAttribute('data-count', '0');
    await expect(chip).toHaveCSS('color', theme === 'light' ? 'rgb(102, 112, 133)' : 'rgb(152, 162, 179)');
    await expect(page.locator('[data-guide="member-add"]').first()).toHaveCSS('color', 'rgb(59, 35, 0)');
    expect(state.writes).toEqual([]); expect(state.errors).toEqual([]);
  });
  for (const mobile of [false, true]) {
    test(`members polish in ${theme} ${mobile ? 'mobile' : 'desktop'}`, async ({ page }, info) => {
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      const state = await prepare(page, theme);
      const main = page.locator('main'), row = main.locator('tbody tr').first();
      await expect(row.locator('.member-row-actions button')).toHaveCount(3);
      await expect(row.getByRole('button', { name: 'Details', exact: true })).toBeVisible();
      for (const badge of await badgeContrasts(page)) expect(badge.contrast, `${theme}: ${badge.text}`).toBeGreaterThanOrEqual(4.5);
      const active = page.locator('aside .sidebar-nav-item[aria-current="page"]');
      await expect(active).toHaveCount(1);
      await expect(active).toHaveCSS('border-left-width', '3px');
      if (!mobile) {
        const calendar = page.locator('aside').getByTitle('Service Calendar', { exact: true });
        await calendar.hover();
        expect(await calendar.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(await active.evaluate(el => getComputedStyle(el).backgroundColor));
      }
      const trigger = row.getByRole('button', { name: 'More actions for Member 1 Santos', exact: true });
      await trigger.scrollIntoViewIfNeeded();
      const hit = await trigger.boundingBox(); expect(hit!.width).toBeGreaterThanOrEqual(36); expect(hit!.height).toBeGreaterThanOrEqual(36);
      await page.keyboard.press('Tab');
      await trigger.focus();
      await expect(trigger).toHaveCSS('outline-style', 'solid');
      await page.keyboard.press('ArrowDown');
      const menu = page.getByRole('menu');
      await expect(menu).toBeVisible();
      await expect(menu.getByRole('menuitem')).toHaveCount(4);
      const box = await menu.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      await page.screenshot({ path: info.outputPath('member-actions.png') });
      await page.keyboard.press('End');
      await expect(menu.getByRole('menuitem', { name: 'Delete Member Record' })).toBeFocused();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Delete Member Record', exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
      await page.keyboard.press('Shift+Tab');
      await expect(dialog.getByRole('button', { name: 'Close Delete Member Record', exact: true })).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(dialog.getByRole('button', { name: 'Yes, Delete Member', exact: true })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
      await trigger.click();
      await page.getByRole('menuitem', { name: 'Delete Member Record' }).click();
      await page.screenshot({ path: info.outputPath('member-delete.png') });
      await page.locator('.shared-modal-backdrop').click({ position: { x: 4, y: 4 } });
      await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
      expect(state.writes).toEqual([]);
      await main.getByRole('button', { name: '1 need follow-up on this page', exact: true }).click();
      await expect(main.locator('tbody tr')).toHaveCount(1);
      expect(state.queries.some(query => query.includes('attendance_health_filter=action_required'))).toBe(true);
      await page.getByLabel('Appearance', { exact: true }).selectOption(theme === 'dark' ? 'light' : 'dark');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'dark' ? 'light' : 'dark');
      for (const badge of await badgeContrasts(page)) expect(badge.contrast).toBeGreaterThanOrEqual(4.5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.reload();
      await expect(page.getByLabel('Appearance', { exact: true })).toHaveValue(theme === 'dark' ? 'light' : 'dark');
      expect(state.errors).toEqual([]);
    });
  }
}

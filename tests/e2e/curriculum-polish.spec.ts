import { test, expect, type Page } from '@playwright/test';

test.use({ launchOptions: { args: ['--disable-gpu'] } });

async function prepare(page: Page, theme: string, role = 'Admin') {
  const errors: string[] = [], writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(({ theme, role }) => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    if (!localStorage.getItem('dpc_theme_mode')) localStorage.setItem('dpc_theme_mode', theme);
    localStorage.setItem(`dpc_help_welcome_v1:1:${role}`, 'seen');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
  }, { theme, role });
  const groups = Array.from({ length: 16 }, (_, i) => ({
    id: i + 1, name: i === 0 ? '2 & BS ni ate Ap with a deliberately long group name' : `Study Group ${i + 1}`,
    curriculum: 'Romans', status: i >= 13 ? 'merged' : 'active', progress_stage: i < 2 ? 'completed' : 'intro',
    ministry_id: 1, ministry_name: 'Youth', ministry_color: '#6e8b74', leader_name: 'Test Leader',
    meeting_day: 'Wednesday', meeting_time: '7:00 PM', location: 'Small Worship Hall Floor 1',
    current_member_count: 12, merged_into_group_name: i >= 13 ? '2 & 3' : null,
    source_group_names: i === 0 ? 'Group A, Group B, Group C' : null,
  }));
  const topics = [{ id: 1, title: 'Romans', total_chapters: 16, summary_notes: 'A practical guide to faith and discipleship.', group_counts: { active: 13, completed: 2, ongoing: 11, merged: 3 }, group_preview: groups },
    { id: 2, title: 'Gospel of John and the life of Jesus Christ', total_chapters: 21, summary_notes: '', group_counts: { active: 0, completed: 0, ongoing: 0, merged: 0 }, group_preview: [] }];
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    let json: any = [];
    if (route.request().method() !== 'GET') { writes.push(path); return route.fulfill({ json: { success: true } }); }
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Admin', role_name: role, ministries: role === 'Coordinator' ? [{ id: 1, name: 'Youth' }] : [] } };
    else if (path.endsWith('/ministries')) json = [{ id: 1, name: 'Youth', min_age: 17, max_age: 26 }];
    else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
    else if (path.endsWith('/study-topics')) json = { topics, pagination: { total: 2, totalPages: 1, page: 1, limit: 20 }, summary: { totalBooks: 2, totalChapters: 37, groupsDone: 2, groupsOngoing: 11 } };
    else if (path.endsWith('/study-topics/1')) json = { topic: topics[0], all_groups: groups, group_members: [] };
    else if (path.endsWith('/study-topics/2')) json = { topic: topics[1], all_groups: [], group_members: [] };
    await route.fulfill({ json });
  });
  await page.goto('/');
  if (page.viewportSize()!.width < 1024) await page.getByRole('button', { name: 'Toggle navigation menu' }).click();
  await page.locator('aside').getByTitle('Curriculum Books/Topics', { exact: true }).click();
  await expect(page.locator('.curriculum-book-card')).toHaveCount(2);
  await expect(page.locator('.curriculum-group-card')).toHaveCount(13);
  return { errors, writes };
}

async function contrasts(page: Page) {
  return page.locator('.curriculum-page .ui-badge, .curriculum-page .ui-button--destructive').evaluateAll(elements => {
    const parse = (value: string) => value.match(/[\d.]+/g)!.map(Number);
    const over = (color: number[], below: number[]) => color.slice(0, 3).map((v, i) => v * (color[3] ?? 1) + below[i] * (1 - (color[3] ?? 1)));
    const luminance = (rgb: number[]) => rgb.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    return elements.map(element => {
      const ancestors: Element[] = []; let node: Element | null = element;
      while (node) { ancestors.unshift(node); node = node.parentElement; }
      const bg = ancestors.reduce((bg, el) => over(parse(getComputedStyle(el).backgroundColor), bg), [255,255,255]);
      const fg = over(parse(getComputedStyle(element).color), bg);
      const a = luminance(fg), b = luminance(bg);
      return { variant: element.className, text: element.textContent, ratio: (Math.max(a,b) + .05) / (Math.min(a,b) + .05) };
    });
  });
}

for (const theme of ['light', 'dark']) {
  for (const mobile of [false, true]) {
    test(`curriculum uses the shared design in ${theme} ${mobile ? 'mobile' : 'desktop'}`, async ({ page }, info) => {
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      const state = await prepare(page, theme);
      const inspector = page.getByRole('complementary', { name: 'Book of Study details', exact: true });
      await inspector.scrollIntoViewIfNeeded();
      await expect(inspector.getByRole('button', { name: 'Active (13)', exact: true })).toHaveAttribute('title', /including ongoing and completed/);
      const results = await contrasts(page);
      for (const result of results) expect(result.ratio, `${theme} ${result.text}`).toBeGreaterThanOrEqual(4.5);
      await info.attach('badge-contrast.json', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
      const body = inspector.locator('.curriculum-inspector-body');
      expect(await body.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
      await body.evaluate(el => { el.scrollTop = el.scrollHeight; });
      const footer = await inspector.locator('.curriculum-inspector-footer').boundingBox();
      expect(footer!.y + footer!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
      await expect(inspector.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
      await page.screenshot({ path: info.outputPath('curriculum-inspector.png') });
      await inspector.getByRole('button', { name: 'Delete', exact: true }).click();
      const confirmation = page.getByRole('dialog', { name: 'Delete Book of Study?', exact: true });
      await expect(confirmation).toBeVisible();
      await expect(confirmation.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
      await page.keyboard.press('Escape'); await expect(confirmation).toHaveCount(0);
      await inspector.getByRole('button', { name: 'Merged (3)', exact: true }).click();
      await expect(inspector.locator('.curriculum-group-card')).toHaveCount(3);
      await expect(inspector.getByText('Merged into:', { exact: false }).first()).toBeVisible();
      await inspector.getByRole('button', { name: 'Close Inspector', exact: true }).click();
      const first = page.locator('.curriculum-book-card').first();
      await first.scrollIntoViewIfNeeded();
      await expect(first).toHaveCSS('outline-width', '2px');
      await expect(first.getByText('+3 merged', { exact: true })).toHaveAttribute('title', /Merged into 2 & 3/);
      await expect(first.locator('.curriculum-chip-name').first().locator('..')).toHaveAttribute('title', /deliberately long/);
      await expect(page.getByLabel('Rows per page', { exact: false })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Open Start Here', exact: true })).toHaveCount(1);
      await expect(page.getByRole('button', { name: 'Start Here', exact: true })).toHaveCount(0);
      const active = page.locator('.sidebar-nav-item[aria-current="page"]'); await expect(active).toHaveCount(1);
      await first.getByRole('button', { name: 'Delete Romans', exact: true }).click();
      await expect(confirmation).toBeVisible(); await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.screenshot({ path: info.outputPath('curriculum-cards.png') });
      const add = page.locator('[data-guide="curriculum-new"]').first();
      await expect(add).toHaveCSS('background-color', theme === 'light' ? 'rgb(217, 164, 65)' : 'rgb(229, 184, 75)');
      await add.click();
      await expect(page.getByLabel('Book / Study Title *', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Close book form', exact: true }).click();
      const otherTheme = theme === 'dark' ? 'light' : 'dark';
      await page.getByLabel('Appearance', { exact: true }).selectOption(otherTheme);
      await expect(page.locator('html')).toHaveAttribute('data-theme', otherTheme);
      await page.reload(); await expect(page.getByLabel('Appearance', { exact: true })).toHaveValue(otherTheme);
      expect(state.writes).toEqual([]); expect(state.errors).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}

test('coordinator sidebar keeps ministry text clear and navigation aligned across both pages', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const state = await prepare(page, 'light', 'Coordinator');
  const sidebar = page.locator('.shared-layout-sidebar');
  const memberNav = sidebar.getByTitle('Members & Families', { exact: true });
  const geometry = async () => ({
    icon: (await memberNav.locator('.sidebar-nav-icon').boundingBox())!.x,
    text: (await memberNav.locator('span.min-w-0').boundingBox())!.x,
  });
  const before = await geometry();
  await memberNav.click();
  await expect(page.locator('.members-page')).toBeVisible();
  expect(await geometry()).toEqual(before);
  await expect(sidebar.locator('[aria-current="page"]')).toHaveCount(1);
  const calendar = sidebar.getByTitle('Service Calendar', { exact: true });
  await calendar.hover();
  await expect(calendar).toHaveCSS('background-color', 'rgb(248, 250, 252)');
  await expect(calendar).not.toHaveAttribute('aria-current', 'page');
  const row = sidebar.locator('.sidebar-ministry-row').filter({ hasText: 'Youth Ministry' });
  await row.scrollIntoViewIfNeeded();
  const rowBox = (await row.boundingBox())!;
  const controlsBox = (await sidebar.locator('.sidebar-scroll-controls').boundingBox())!;
  expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(controlsBox.y);
  const nameBox = (await row.getByTitle('Youth Ministry', { exact: true }).boundingBox())!;
  const ageBox = (await row.getByText('17-21 yrs', { exact: true }).boundingBox())!;
  expect(nameBox.x + nameBox.width).toBeLessThan(ageBox.x);
  await expect(sidebar.getByTitle('Collapse sidebar', { exact: true })).toHaveCSS('min-height', '36px');
  expect(state.writes).toEqual([]); expect(state.errors).toEqual([]);
});

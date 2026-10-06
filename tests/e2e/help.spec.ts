import { test, expect, type Page } from '@playwright/test';

const assignedGroup = {
  id: 11, name: 'Faith Group', leader_name: 'Guide User', members: [], status: 'active', category: 'General', ministry_id: 1,
  curriculum: 'Faith Foundations', current_chapter: 'Chapter 1', meeting_day: 'Wednesday',
  meeting_time: '7:00 PM - 8:00 PM', location: 'Room 1', max_capacity: 12,
};

async function prepare(page: Page, role = 'Admin', seen = false) {
  const writes: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(({ role, seen }) => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
    localStorage.setItem('dpc_theme_mode', 'light');
    // Only set once: reloads must actually exercise the saved welcome preference.
    if (seen && !sessionStorage.getItem('help_fixture_initialized')) localStorage.setItem(`dpc_help_welcome_v1:1:${role}`, 'seen');
    sessionStorage.setItem('help_fixture_initialized', 'true');
  }, { role, seen });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writes.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 400, json: { error: 'Guides must not write records' } });
    }
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true, demoModeEnabled: false };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Guide User', email: 'guide@example.test', role_name: role, ministries: [] } };
    else if (path.endsWith('/ministries')) json = [{ id: 1, name: 'Youth', min_age: 17, max_age: 21, member_count: 0 }];
    else if (path.endsWith('/groups/mine')) json = [assignedGroup];
    else if (path.endsWith('/attendance/roster')) json = [{ member_id: 1, first_name: 'Ana', last_name: 'Santos', birthdate: '2005-01-01', member_status: 'active', ministry_id: 1, ministry_name: 'Youth', is_present: 0, attendance_status: 'unmarked' }];
    else if (path.endsWith('/reports/dashboard')) json = { metrics: { total_active_members: 0, total_households: 0, unenrolled_members_count: 0, upcoming_events_count: 0 }, ministry_breakdown: [] };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: { today: 0, this_week: 0, this_month: 0 } };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: { total_qualified: 0, pending_nomination: 0 } };
    else if (path.endsWith('/duty/schedule') || path.endsWith('/dishwashing/schedule')) json = { schedule: [], total_teams: 0 };
    await route.fulfill({ json });
  });
  await page.goto('/');
  return { writes, errors };
}

test('welcome can be skipped, stays dismissed on reload, and can be replayed', async ({ page }) => {
  const state = await prepare(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Welcome to DPC' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close help' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Skip for now' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Start Here' })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open Start Here' })).toBeVisible();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Open Start Here' }).click();
  await dialog.getByRole('button', { name: 'Show the welcome tour again' }).click();
  const tour = page.getByRole('region', { name: 'Welcome tour' });
  await expect(tour).toContainText('Step 1 of 4');
  await expect(page.locator('[data-guide="workspace"]')).toHaveAttribute('data-guide-highlight', 'true');
  await tour.getByRole('button', { name: 'Next step' }).click();
  await expect(page.locator('aside')).toHaveAttribute('data-guide-highlight', 'true');
  await tour.getByRole('button', { name: 'Next step' }).click();
  await expect(page.locator('[data-guide="account"]')).toHaveAttribute('data-guide-highlight', 'true');
  await tour.getByRole('button', { name: 'Next step' }).click();
  await expect(page.getByRole('button', { name: 'Open Start Here' })).toHaveAttribute('data-guide-highlight', 'true');
  await tour.getByRole('button', { name: 'Finish guide' }).click();
  await expect(tour).not.toBeVisible();
  await expect(page.locator('[data-guide-highlight]')).toHaveCount(0);
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('dashboard leaves the church scene clear and opens guides from the navbar', async ({ page }, testInfo) => {
  const state = await prepare(page, 'Admin', true);
  await page.getByRole('combobox', { name: 'Appearance' }).selectOption('dark');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('.help-page-bar')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Getting started' })).toHaveCount(0);
    const workspace = page.locator('[data-guide="workspace"]');
    const topOffset = await workspace.evaluate(element => {
      const main = element.closest('main')!;
      return element.getBoundingClientRect().top - main.getBoundingClientRect().top - parseFloat(getComputedStyle(main).paddingTop);
    });
    expect(Math.abs(topOffset)).toBeLessThan(1);
    if (width === 1440) {
      await expect(page.locator('.church-building-image')).toBeVisible();
      await page.locator('.church-building-image').evaluate((image: HTMLImageElement) => image.decode());
      await page.screenshot({ path: testInfo.outputPath('dashboard-without-guide-bars.png') });
    }
    const launcher = page.getByRole('button', { name: 'Open Start Here' });
    await launcher.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: /Add a member/ })).toBeVisible();
    await dialog.getByRole('button', { name: 'How to use this page' }).click();
    await expect(dialog.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(launcher).toBeFocused();
  }
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

for (const role of ['Admin', 'Pastor', 'Coordinator', 'Leader', 'Volunteer', 'Member']) {
  test(`${role} gets only the tasks for their role`, async ({ page }) => {
    const state = await prepare(page, role);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const manager = ['Admin', 'Pastor', 'Coordinator'].includes(role);
    await expect(dialog.getByRole('button', { name: /Add a member/ })).toHaveCount(manager ? 1 : 0);
    await expect(dialog.getByRole('button', { name: /Create a Bible study group/ })).toHaveCount(manager ? 1 : 0);
    await expect(dialog.getByRole('button', { name: /Record Sunday attendance/ })).toHaveCount(manager || role === 'Volunteer' ? 1 : 0);
    await expect(dialog.getByRole('button', { name: /Manage my Bible study group/ })).toHaveCount(manager || role === 'Leader' ? 1 : 0);
    await expect(dialog.getByRole('button', { name: /Follow my Bible reading plan/ })).toBeVisible();
    await dialog.getByRole('button', { name: 'Skip for now' }).click();
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
  });
}

test('member guide follows dynamically opened form controls and can be minimized', async ({ page }) => {
  const state = await prepare(page, 'Admin', true);
  await page.getByRole('button', { name: 'Open Start Here' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Add a member/ }).click();
  const guide = page.getByRole('region', { name: 'Add a member', exact: true });
  await expect(page.locator('[data-guide="member-add"]')).toHaveAttribute('data-guide-highlight', 'true');
  await guide.getByRole('button', { name: 'Next step' }).click();
  await expect(page.locator('[data-guide="member-name"]')).toHaveAttribute('data-guide-highlight', 'true');
  await guide.getByRole('button', { name: 'Minimize guide' }).click();
  await expect(guide).not.toBeVisible();
  await expect(page.locator('[data-guide-highlight]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Resume guide · 2/8' }).click();
  await guide.getByRole('button', { name: /Go to step 7:/ }).click();
  await expect(page.getByRole('button', { name: 'Save Application Record' })).toHaveAttribute('data-guide-highlight', 'true');
  await guide.getByRole('button', { name: 'Close guide' }).click();
  await expect(page.getByRole('button', { name: 'Save Application Record' })).toBeVisible();
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('attendance guide highlights the service, search, and roster without recording attendance', async ({ page }) => {
  const state = await prepare(page, 'Volunteer');
  await page.getByRole('dialog').getByRole('button', { name: /Record Sunday attendance/ }).click();
  const guide = page.getByRole('region', { name: 'Record Sunday attendance' });
  for (const target of ['attendance-sunday', 'attendance-service', 'attendance-search', 'attendance-roster']) {
    await expect(page.locator(`[data-guide="${target}"]`).first()).toHaveAttribute('data-guide-highlight', 'true');
    await guide.getByRole('button', { name: target === 'attendance-roster' ? 'Finish guide' : 'Next step' }).click();
  }
  await page.getByRole('button', { name: 'How to use this page' }).click();
  await expect(page.getByRole('dialog')).toContainText("Use the date selector to choose today's or a past Sunday service.");
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('group setup guide connects to the create form and stops on navigation', async ({ page }) => {
  const state = await prepare(page);
  await page.getByRole('dialog').getByRole('button', { name: /Create a Bible study group/ }).click();
  const guide = page.getByRole('region', { name: 'Create a Bible study group' });
  await expect(page.locator('[data-guide="group-create"]')).toHaveAttribute('data-guide-highlight', 'true');
  await page.getByRole('button', { name: 'New Bible Study Group' }).click();
  await guide.getByRole('button', { name: 'Next step' }).click();
  await expect(page.locator('[data-guide="group-name"]')).toHaveAttribute('data-guide-highlight', 'true');
  await guide.getByRole('button', { name: /Go to step 7:/ }).click();
  await expect(page.getByRole('button', { name: 'Create Small Group', exact: true })).toHaveAttribute('data-guide-highlight', 'true');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('aside').getByRole('button', { name: /Announcements/ }).click();
  await expect(guide).not.toBeVisible();
  await expect(page.locator('[data-guide-highlight]')).toHaveCount(0);
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('leader guide uses the actual Curriculum & Roll-Call controls', async ({ page }) => {
  const state = await prepare(page, 'Leader');
  await page.getByRole('dialog').getByRole('button', { name: /Manage my Bible study group/ }).click();
  const guide = page.getByRole('region', { name: 'Manage my Bible study group' });
  await expect(page.locator('[data-guide="my-group-switcher"]')).toHaveAttribute('data-guide-highlight', 'true');
  await guide.getByRole('button', { name: 'Next step' }).click();
  await page.getByRole('button', { name: /Curriculum & Roll-Call/ }).click();
  await guide.getByRole('button', { name: 'Next step' }).click();
  await expect(page.locator('[data-guide="my-group-rollcall"]')).toHaveAttribute('data-guide-highlight', 'true');
  await guide.getByRole('button', { name: 'Next step' }).click();
  await expect(page.getByRole('button', { name: 'Save Session Attendance' })).toHaveAttribute('data-guide-highlight', 'true');
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('help fits a small screen and supports dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await prepare(page, 'Member');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await dialog.getByRole('button', { name: 'Take a quick welcome tour' }).click();
  const tour = page.getByRole('region', { name: 'Welcome tour' });
  await tour.getByRole('button', { name: 'Next step' }).click();
  await expect(page.getByRole('button', { name: 'Toggle navigation menu' })).toHaveAttribute('data-guide-highlight', 'true');
  await tour.getByRole('button', { name: 'Close guide' }).click();
  await page.getByRole('combobox', { name: 'Appearance' }).selectOption('dark');
  await page.getByRole('button', { name: 'Open Start Here' }).click();
  await expect(dialog).toHaveCSS('background-color', 'rgb(24, 34, 53)');
  await page.screenshot({ path: 'test-results/help-mobile-dark.png' });
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('spotlight blurs the surroundings, keeps the real control usable, and follows form scrolling', async ({ page }) => {
  const state = await prepare(page, 'Admin', true);
  await page.getByRole('button', { name: 'Open Start Here' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Add a member/ }).click();
  const guide = page.getByRole('region', { name: 'Add a member', exact: true });
  const frame = page.locator('.help-spotlight-frame');
  await expect(frame).toBeVisible();
  await expect(page.locator('.help-spotlight-shade')).toHaveCount(4);
  await expect(page.locator('.help-spotlight-shade').first()).toHaveCSS('backdrop-filter', 'blur(5px)');
  const add = page.getByRole('button', { name: 'Add Member', exact: true });
  const buttonBounds = (await add.boundingBox())!;
  const focusBounds = (await frame.boundingBox())!;
  expect(focusBounds.x).toBeLessThan(buttonBounds.x);
  expect(focusBounds.x + focusBounds.width).toBeGreaterThan(buttonBounds.x + buttonBounds.width);
  expect(await add.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
  })).toBe(true);
  await page.screenshot({ path: 'test-results/help-spotlight-button.png' });
  await add.click();
  await guide.getByRole('button', { name: 'Next step' }).click();
  const name = page.locator('[data-guide="member-name"]');
  await expect(name).toHaveAttribute('data-guide-highlight', 'true');
  await name.fill('Example Person');
  await expect(name).toHaveValue('Example Person');
  await expect.poll(async () => {
    const target = (await name.boundingBox())!;
    const focus = (await frame.boundingBox())!;
    return Math.abs(focus.y - (target.y - 8));
  }).toBeLessThan(1);
  await page.screenshot({ path: 'test-results/help-spotlight-form.png' });
  await name.evaluate(element => {
    let parent = element.parentElement;
    while (parent && parent.scrollHeight <= parent.clientHeight) parent = parent.parentElement;
    if (!parent) throw new Error('Member form must have a scroll container');
    parent.scrollTop += 32;
  });
  await expect.poll(async () => {
    const target = (await name.boundingBox())!;
    const focus = (await frame.boundingBox())!;
    return Math.abs(focus.y - (target.y - 8));
  }).toBeLessThan(1);
  await guide.getByRole('button', { name: 'Minimize guide' }).click();
  await expect(page.locator('.help-spotlight')).toHaveCount(0);
  await page.getByRole('button', { name: 'Resume guide · 2/8' }).click();
  await expect(frame).toBeVisible();
  await guide.getByRole('button', { name: 'Close guide' }).click();
  await expect(page.locator('.help-spotlight')).toHaveCount(0);
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('spotlight tracks the mobile navigation button after viewport changes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page, 'Member');
  await page.getByRole('dialog').getByRole('button', { name: 'Take a quick welcome tour' }).click();
  const guide = page.getByRole('region', { name: 'Welcome tour' });
  await guide.getByRole('button', { name: 'Next step' }).click();
  await page.setViewportSize({ width: 430, height: 780 });
  const menu = page.getByRole('button', { name: 'Toggle navigation menu' });
  const frame = page.locator('.help-spotlight-frame');
  await expect.poll(async () => {
    const target = (await menu.boundingBox())!;
    const focus = (await frame.boundingBox())!;
    return Math.abs(focus.x - Math.max(0, target.x - 8));
  }).toBeLessThan(1);
  await page.screenshot({ path: 'test-results/help-spotlight-mobile.png' });
  await guide.getByRole('button', { name: 'Close guide' }).click();
  await expect(page.locator('.help-spotlight')).toHaveCount(0);
});

test('Bible reading steps open the reader, switch views, scroll to targets, and support direct jumps', async ({ page }, testInfo) => {
  const state = await prepare(page, 'Admin', true);
  await page.route('https://bible-api.com/**', route => route.fulfill({ json: { reference: 'Example passage', verses: [{ verse: 1, text: 'Example Scripture text for the guide test.' }] } }));
  await page.getByRole('button', { name: 'Open Start Here' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Follow my Bible reading plan/ }).click();
  const guide = page.getByRole('region', { name: 'Follow my Bible reading plan' });
  await expect(page.locator('[data-guide="reading-today"]')).toHaveAttribute('data-guide-highlight', 'true');
  await expect(guide).toContainText('Step 1 of 5');
  await guide.getByRole('button', { name: 'Next step' }).click();
  await expect(page.locator('[data-guide="reading-chapters"]')).toHaveAttribute('data-guide-highlight', 'true');
  await expect(page.getByRole('button', { name: 'Close passage reader' })).toBeVisible();
  await guide.getByRole('button', { name: /Go to step 3:/ }).click();
  await expect(page.getByRole('button', { name: 'Close passage reader' })).toHaveCount(0);
  await expect(page.locator('[data-guide="reading-filters"]')).toHaveAttribute('data-guide-highlight', 'true');
  await expect(page.getByPlaceholder('Search by book (e.g. Genesis, Matthew, Romans)...')).toBeVisible();
  await guide.getByRole('button', { name: 'Next step' }).click();
  await expect(page.locator('[data-guide="reading-grid"]')).toHaveAttribute('data-guide-highlight', 'true');
  await expect(guide).toContainText('they do not confirm your personal completion');
  await guide.getByRole('button', { name: /Go to step 5:/ }).click();
  const calibrate = page.locator('[data-guide="reading-calibrate"]');
  await expect(calibrate).toHaveAttribute('data-guide-highlight', 'true');
  const bounds = (await calibrate.boundingBox())!;
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThan(page.viewportSize()!.height);
  await guide.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('[data-guide="reading-grid"]')).toHaveAttribute('data-guide-highlight', 'true');
  await page.screenshot({ path: testInfo.outputPath('reading-guide-detailed.png') });
  await guide.getByRole('button', { name: 'Close guide' }).click();
  await page.getByRole('button', { name: 'How to use this page', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Explore the daily schedule/ }).click();
  await expect(page.getByRole('region', { name: 'Daily Bible reading', exact: true })).toContainText('Step 3 of 5');
  await expect(page.locator('[data-guide="reading-filters"]')).toHaveAttribute('data-guide-highlight', 'true');
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('duty steps navigate between Saturday and Sunday rosters and return on Back', async ({ page }) => {
  const state = await prepare(page, 'Admin', true);
  await page.route('**/api/duty/teams**', route => route.fulfill({ json: [{ id: 1, name: 'Guide Team', color: '#4338ca', order_seq: 1, members: [], leader_name: 'Guide User' }] }));
  await page.route('**/api/dishwashing/teams**', route => route.fulfill({ json: [{ id: 1, name: 'Guide Team', color: '#4338ca', order_seq: 1, members: [], leader_name: 'Guide User' }] }));
  await page.getByRole('button', { name: 'Open Start Here' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Check my duty schedule/ }).click();
  const guide = page.getByRole('region', { name: 'Check my duty schedule' });
  await expect(page.locator('[data-guide="duty-teams"]')).toHaveAttribute('data-guide-highlight', 'true');
  await guide.getByRole('button', { name: 'Next step' }).click();
  await expect(page.locator('[data-guide="duty-schedule"]')).toHaveAttribute('data-guide-highlight', 'true');
  await guide.getByRole('button', { name: 'Next step' }).click();
  await expect(page.locator('[data-guide="dishwashing-schedule"]')).toHaveAttribute('data-guide-highlight', 'true');
  await guide.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('[data-guide="duty-schedule"]')).toHaveAttribute('data-guide-highlight', 'true');
  await guide.getByRole('button', { name: 'Minimize guide' }).click();
  await page.locator('aside').getByRole('button', { name: /Announcements/ }).click();
  await expect(page.getByRole('button', { name: /Resume guide/ })).toHaveCount(0);
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('dark help launchers, detailed steps and controls meet text contrast on desktop and mobile', async ({ page }, testInfo) => {
  const state = await prepare(page, 'Admin', true);
  await page.getByRole('combobox', { name: 'Appearance' }).selectOption('dark');
  await page.locator('aside').getByRole('button', { name: /Daily Bible Reading/ }).click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const contrast = async (selector: string) => page.locator(selector).first().evaluate(element => {
      const parse = (value: string) => (value.match(/[\d.]+/g) || []).map(Number);
      const luminance = (color: number[]) => color.slice(0, 3).map(value => {
        const channel = value / 255;
        return channel <= .04045 ? channel / 12.92 : Math.pow((channel + .055) / 1.055, 2.4);
      }).reduce((total, channel, index) => total + channel * [.2126, .7152, .0722][index], 0);
      let parent: Element | null = element;
      let background = [255, 255, 255];
      while (parent) {
        const candidate = parse(getComputedStyle(parent).backgroundColor);
        if (candidate.length === 3 || candidate[3] === 1) { background = candidate; break; }
        parent = parent.parentElement;
      }
      const foreground = luminance(parse(getComputedStyle(element).color));
      const behind = luminance(background);
      return (Math.max(foreground, behind) + .05) / (Math.min(foreground, behind) + .05);
    });
    expect(await contrast('.help-page-bar .help-text-button')).toBeGreaterThanOrEqual(4.5);
    await page.getByRole('button', { name: 'Open Start Here' }).click();
    expect(await contrast('.help-dialog h2')).toBeGreaterThanOrEqual(4.5);
    expect(await contrast('.help-tour-button strong')).toBeGreaterThanOrEqual(4.5);
    expect(await contrast('.help-secondary')).toBeGreaterThanOrEqual(4.5);
    await page.getByRole('dialog').getByRole('button', { name: /Follow my Bible reading plan/ }).click();
    expect(await contrast('.help-guide-panel h2')).toBeGreaterThanOrEqual(4.5);
    expect(await contrast('.help-step-details li')).toBeGreaterThanOrEqual(4.5);
    expect(await contrast('.help-step-navigation button[aria-current]')).toBeGreaterThanOrEqual(4.5);
    expect(await contrast('.help-step-navigation button:not([aria-current])')).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: testInfo.outputPath(`guide-dark-${width}.png`) });
    await page.getByRole('button', { name: 'Close guide' }).click();
  }
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

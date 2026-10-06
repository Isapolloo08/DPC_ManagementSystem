import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'Asia/Manila' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('dpc_theme_mode', 'light');
    localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
  });
  const ministries = ['Kinder', 'Elementary', 'Highschool', 'Youth', 'Young Adult', 'Junior Adult', 'Old Adult'].map((name, index) => ({
    id: index + 1, name, min_age: 3, max_age: 70, member_count: index,
    active_members_count: index, description: 'Learn Scripture, worship together, and grow in faith.',
  }));
  // Fixtures avoid changing or depending on the church database.
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true, demoModeEnabled: false };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Mark Angelo', role_name: 'Admin', ministries: [] } };
    else if (path.endsWith('/ministries')) json = ministries;
    else if (path.endsWith('/reports/dashboard')) json = {
      metrics: { total_active_members: 21, total_households: 10, unenrolled_members_count: 2, upcoming_events_count: 0 },
      ministry_breakdown: ministries,
    };
    else if (path.endsWith('/settings/general')) json = { settings: { church_name: 'Daet Presbyterian Church', pastor_name: 'Pastor Maria Santos' }, list: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: { today: 0, this_week: 0, this_month: 0 } };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: { total_qualified: 0, pending_nomination: 0 } };
    else if (path.endsWith('/duty/schedule') || path.endsWith('/dishwashing/schedule')) json = { schedule: [], total_teams: 0 };
    await route.fulfill({ status: 200, json });
  });
});

test('greeting types once, reserves its space, and keeps the complete accessible name', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-02T08:00:00+08:00') });
  await page.clock.pauseAt(new Date('2026-10-02T08:00:00+08:00'));
  await page.goto('/');
  const heading = page.getByRole('heading', { name: 'Good morning, Mark.', exact: true });
  await expect(heading).toBeVisible();
  const text = heading.locator('.text-type-content');
  await expect(text).toHaveText('');
  const numbers = page.locator('.overview-number-current');
  await expect(numbers).toHaveText(['0', '0', '0', '0']);
  await expect(page.getByRole('button', { name: '21 Members', exact: true })).toBeAttached();
  const size = await heading.boundingBox();
  await page.clock.runFor(400);
  await expect(text).toHaveText('Good');
  const intermediateCount = Number(await numbers.first().textContent());
  expect(intermediateCount).toBeGreaterThan(0);
  expect(intermediateCount).toBeLessThan(21);
  await page.clock.runFor(1500);
  await expect(text).toHaveText('Good morning, Mark.');
  await expect(numbers).toHaveText(['21', '2', '0', '10']);
  const settledSize = await heading.boundingBox();
  expect(settledSize!.width).toBe(size!.width);
  expect(settledSize!.height).toBe(size!.height);
  await page.clock.fastForward(10_000);
  await expect(text).toHaveText('Good morning, Mark.');
  await page.getByRole('combobox', { name: 'Appearance' }).selectOption('dark');
  await expect(text).toHaveText('Good morning, Mark.');
  await expect(numbers).toHaveText(['21', '2', '0', '10']);
});

test('greeting updates at time boundaries and catches up after sleep', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-10-02T04:59:59+08:00') });
  await page.clock.pauseAt(new Date('2026-10-02T04:59:59+08:00'));
  await page.goto('/');
  await expect(page.locator('.overview-heading h1')).toBeVisible();
  for (const boundary of [
    { at: '04:59:59', before: 'evening', after: 'morning' },
    { at: '11:59:59', before: 'morning', after: 'afternoon' },
    { at: '17:59:59', before: 'afternoon', after: 'evening' },
    { at: '21:59:59', before: 'evening', after: 'evening' },
  ]) {
    await page.clock.setSystemTime(new Date(`2026-10-02T${boundary.at}+08:00`));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.locator('.overview-heading h1')).toHaveAttribute('aria-label', `Good ${boundary.before}, Mark.`);
    await page.clock.fastForward(1100);
    await expect(page.locator('.text-type-content')).toHaveText(`Good ${boundary.after}, Mark.`);
  }
  await page.clock.setSystemTime(new Date('2026-10-03T00:00:00+08:00'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('.text-type-content')).toHaveText('Good evening, Mark.');
  await expect(page.locator('.dashboard-date-button')).toContainText('Oct 3');
});

test('reduced motion displays the greeting immediately without a blinking cursor', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-10-02T13:00:00+08:00') });
  await page.clock.pauseAt(new Date('2026-10-02T13:00:00+08:00'));
  await page.goto('/');
  await expect(page.locator('.text-type-content')).toHaveText('Good afternoon, Mark.');
  await expect(page.locator('.text-type-cursor')).toHaveCSS('visibility', 'hidden');
  await expect(page.locator('.overview-number-current')).toHaveText(['21', '2', '0', '10']);
  await expect(page.locator('.overview-heading')).toHaveCSS('animation-name', 'none');
});

for (const mode of ['light', 'dark']) {
  test(`ministry details overlap without moving rows and work by keyboard in ${mode} mode`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Appearance' }).selectOption(mode);
    const tiles = page.locator('.ministry-tile');
    await expect(tiles).toHaveCount(7);
    const tile = tiles.nth(1);
    await page.getByRole('heading', { name: /Ministries Directory & Status/ }).evaluate((element) => {
      window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 96);
    });
    await page.mouse.move(0, 0);
    const geometry = () => tiles.evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      const grid = element.closest('.ministry-directory')!.getBoundingClientRect();
      // Compare layout within the grid, independent of Playwright's scroll-to-focus.
      return { x: rect.x - grid.x, y: rect.y - grid.y, width: rect.width, height: rect.height };
    }));
    const before = await geometry();
    await tile.hover();
    const details = tile.locator('.ministry-hover-details');
    await expect(details).toBeVisible();
    expect(await geometry()).toEqual(before);
    const bounds = await details.boundingBox();
    const nextRow = await tiles.nth(4).boundingBox();
    expect(bounds!.y + bounds!.height).toBeGreaterThan(nextRow!.y);
    await page.screenshot({ path: testInfo.outputPath(`ministry-overlay-${mode}.png`) });
    await page.mouse.move(0, 0);
    await expect(details).toBeHidden();
    await page.getByRole('button', { name: 'Directory', exact: true }).focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(tile).toBeFocused();
    await expect(details).toBeVisible();
    expect(await geometry()).toEqual(before);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Members & Family Directory', exact: true })).toBeVisible();
  });
}

test('church focus opens by keyboard and provides the profile action; the navbar date opens the calendar', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.church-overview .dashboard-date-button')).toHaveCount(0);
  await expect(page.locator('header .dashboard-date-button')).toBeVisible();
  const building = page.locator('.church-overview .church-building-button');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await building.hover();
  await expect(building).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, -3)');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(building).toHaveCSS('transform', 'none');
  await page.mouse.move(0, 0);
  await building.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(building).toBeFocused();
  await expect(building).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(building).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.church-focus-panel')).toContainText('Pastor Maria Santos');
  await page.getByRole('button', { name: 'View church profile', exact: true }).click();
  await expect(page.getByText('Church Profile & System Preferences', { exact: true })).toBeVisible();
  await page.getByText('System Dashboard', { exact: true }).click();
  await page.getByRole('button', { name: /^Open church calendar for/ }).click();
  await expect(page.getByRole('heading', { name: 'Events & Master Calendar', exact: true })).toBeVisible();
});

test('hero lighting follows local time while stats keep AA contrast and layouts stay compact', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-10-02T08:00:00+08:00') });
  await page.goto('/');
  await expect(page.locator('.church-building-image')).toBeVisible();
  await page.locator('.church-building-image').evaluate((image: HTMLImageElement) => image.decode());
  for (const mode of ['light', 'dark']) {
    await page.getByRole('combobox', { name: 'Appearance' }).selectOption(mode);
    for (const [hour, lighting] of [[8, 'morning'], [14, 'afternoon'], [19, 'evening'], [23, 'night']] as const) {
      await page.clock.setSystemTime(new Date(`2026-10-02T${hour.toString().padStart(2, '0')}:00:00+08:00`));
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect(page.locator('.church-overview')).toHaveAttribute('data-time-of-day', lighting);
      const contrast = await page.locator('.church-overview').evaluate((hero) => {
        const luminance = (color: string) => {
          const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((value) => {
            const channel = value / 255;
            return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
          });
          return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
        };
        let surface: Element | null = hero;
        while (surface && getComputedStyle(surface).backgroundColor === 'rgba(0, 0, 0, 0)') surface = surface.parentElement;
        const background = luminance(getComputedStyle(surface || document.body).backgroundColor);
        return [...hero.querySelectorAll('.overview-stat strong, .overview-stat > span')].map((text) => {
          const foreground = luminance(getComputedStyle(text).color);
          return (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05);
        });
      });
      expect(Math.min(...contrast)).toBeGreaterThanOrEqual(4.5);
      await page.screenshot({ path: testInfo.outputPath(`hero-${mode}-${lighting}.png`) });
    }
  }
  for (const width of [1920, 1440, 1024, 900, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    if (width < 768) await expect.poll(() => page.locator('aside').first().evaluate((sidebar) => sidebar.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
    const hero = page.locator('.church-overview');
    const bounds = await hero.boundingBox();
    expect(bounds!.height).toBeLessThan(410);
    const numberPositions = await hero.locator('.overview-stat strong').evaluateAll((numbers) => numbers.map((number) => number.getBoundingClientRect().top));
    expect(Math.max(...numberPositions) - Math.min(...numberPositions)).toBeLessThan(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width >= 768) {
      const scene = await page.locator('.church-building-scene').boundingBox();
      const stats = await page.locator('.overview-summary').boundingBox();
      expect(stats!.y - (scene!.y + scene!.height)).toBeCloseTo(-8, 0);
      expect(stats!.x).toBeCloseTo(scene!.x, 0);
    } else {
      await expect(page.getByRole('button', { name: 'Open church overview', exact: true })).toBeVisible();
      await expect(page.locator('.church-building-button')).toBeHidden();
    }
    await page.screenshot({ path: testInfo.outputPath(`hero-responsive-${width}.png`) });
  }
  await expect(page.locator('.church-building-button')).toHaveCSS('transition-duration', '0s');
});

test('focus places the church in the upper center without moving cards and supports all dismiss controls', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.text-type-content')).toHaveText(/Good (morning|afternoon|evening), Mark\./);
  const hero = page.locator('.church-overview');
  const building = page.locator('.church-overview .church-building-button');
  const position = page.locator('.church-overview .church-building-position');
  const focusedPosition = page.locator('.church-focus-overlay .church-building-position');
  const before = await position.boundingBox();
  const cards = () => page.locator('.dashboard-workspace').evaluate(el => ({ top: el.getBoundingClientRect().top, height: el.getBoundingClientRect().height }));
  const cardsBefore = await cards();
  await building.click();
  await expect(hero).toHaveAttribute('data-church-focused', 'true');
  await expect.poll(async () => {
    const church = (await focusedPosition.boundingBox())!;
    const width = await page.evaluate(() => innerWidth);
    return Math.abs(church.x + church.width / 2 - width / 2);
  }).toBeLessThan(1);
  const after = (await focusedPosition.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(after.y + after.height / 2).toBeLessThan(viewport.height * .35);
  expect(after.width).toBeGreaterThan(before!.width);
  await expect(page.locator('.church-focus-backdrop')).toHaveCSS('backdrop-filter', 'blur(5px)');
  expect(await page.locator('.church-focus-backdrop').boundingBox()).toEqual({ x: 0, y: 0, ...viewport });
  expect(await cards()).toEqual(cardsBefore);
  await expect(page.locator('.church-focus-panel')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(hero).toHaveAttribute('data-church-focused', 'false');
  await expect(building).toBeFocused();
  await expect(page.locator('.church-focus-panel')).toBeHidden();
  await expect.poll(async () => Math.abs((await position.boundingBox())!.x - before!.x)).toBeLessThan(1);
  await page.keyboard.press('Space');
  await expect(building).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Close church overview', exact: true }).click();
  await expect(building).toHaveAttribute('aria-expanded', 'false');
  await expect(hero).toHaveAttribute('data-church-visible', 'false');
  await building.click();
  await page.locator('.church-focus-overlay .church-building-button').click();
  await expect(building).toHaveAttribute('aria-expanded', 'false');
  await expect(hero).toHaveAttribute('data-church-visible', 'false');
  await building.click();
  await page.locator('.scripture-card h2').click();
  await expect(building).toHaveAttribute('aria-expanded', 'false');
  expect(await cards()).toEqual(cardsBefore);
});

test('focus keeps theme ambience, real information and responsive geometry with reduced motion', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-10-02T19:00:00+08:00') });
  await page.route('**/api/events**', route => route.fulfill({ json: [{ id: 15, title: 'Church family prayer', start_time: '2026-10-04T09:00:00+08:00', location: 'Main sanctuary' }] }));
  await page.goto('/');
  const hero = page.locator('.church-overview');
  const panel = page.locator('.church-focus-panel');
  for (const mode of ['light', 'dark']) {
    await page.getByRole('combobox', { name: 'Appearance' }).selectOption(mode);
    await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition');
    for (const width of [1440, 1024, 768, 375, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      if (width < 768) await expect.poll(() => page.locator('aside').first().evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
      const before = (await hero.boundingBox())!;
      const cardsBefore = (await page.locator('.dashboard-workspace').boundingBox())!;
      await page.getByRole('button', { name: 'Open church overview', exact: true }).click();
      await expect(panel).toBeVisible();
      await expect(panel.locator('dd')).toHaveText(['21', '2', '0', '10']);
      await expect(panel).toContainText('Church family prayer');
      await expect(panel).toContainText('Pastor Maria Santos');
      await expect(page.locator('.church-focus-overlay .church-building-position')).toHaveCSS('transition-duration', '0s');
      await expect(page.locator('.church-stars i').first()).toHaveCSS('animation-name', 'none');
      await expect(page.locator('.church-dashboard-sky')).toBeHidden();
      await expect(page.locator('.church-star-belt').first()).toHaveCSS('animation-play-state', 'paused');
      const church = (await page.locator('.church-focus-overlay .church-building-position').boundingBox())!;
      const viewport = page.viewportSize()!;
      expect(church.x + church.width / 2).toBeCloseTo(viewport.width / 2, 0);
      const bounds = (await panel.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
      if (width < 1280) expect(bounds.y).toBeGreaterThanOrEqual(church.y + church.height - 24);
      expect((await hero.boundingBox())!.height).toBe(before.height);
      expect((await page.locator('.dashboard-workspace').boundingBox())!.y).toBe(cardsBefore.y);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`church-focus-${mode}-${width}.png`) });
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
      await expect(hero).toHaveAttribute('data-church-visible', 'false');
      await expect(page.locator('.church-dashboard-sky')).toBeVisible();
      if (width < 768) await expect(page.getByRole('button', { name: 'Open church overview', exact: true })).toBeFocused();
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Open church overview', exact: true }).click();
  await page.getByRole('button', { name: 'Open calendar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Events & Master Calendar', exact: true })).toBeVisible();
});

test('model focus hides the sky through close, uses a composited transition and survives hot refresh', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /Hooks|Expected ref|ChurchOverview/.test(message.text())) errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.locator('.text-type-content')).toHaveText(/Good (morning|afternoon|evening), Mark\./);
  await page.getByRole('combobox', { name: 'Appearance' }).selectOption('dark');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition');
  const sky = page.locator('.church-dashboard-sky');
  const hero = page.locator('.church-overview');
  for (let cycle = 0; cycle < 3; cycle++) {
    await expect(sky).toBeVisible();
    await page.getByRole('button', { name: 'Open church overview', exact: true }).click();
    await expect(sky).toBeHidden();
    await expect(page.locator('.church-focus-panel')).toBeVisible();
    await expect(page.locator('.church-focus-visual')).toHaveCSS('will-change', 'transform');
    await expect(page.locator('.church-focus-visual')).toHaveCSS('transition-duration', '0.36s');
    expect(await sky.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
    await expect(page.locator('.church-focus-panel')).toHaveCSS('backdrop-filter', 'none');
    if (cycle === 0) await page.screenshot({ path: testInfo.outputPath('church-focus-no-stars.png') });
    // Click without Playwright waiting for the departing visual to settle.
    await page.getByRole('button', { name: 'Close church overview', exact: true }).evaluate(element => (element as HTMLButtonElement).click());
    await expect(hero).toHaveAttribute('data-church-focused', 'false');
    await expect(sky).toBeHidden();
    await expect(hero).toHaveAttribute('data-church-visible', 'false');
    await expect(sky).toBeVisible();
    await expect(page.locator('.church-star-belt').first()).toHaveCSS('animation-play-state', 'running');
  }
  const heroHandle = await hero.elementHandle();
  // Re-evaluate the actual Vite module under the same refresh family, without a
  // page reload. The reset boundary must replace the mounted hook instances.
  const refreshError = await page.evaluate(async () => {
    const runtime = await import(/* @vite-ignore */ '/@react-refresh');
    const previous = await import(/* @vite-ignore */ '/src/components/dashboard/ChurchOverview.tsx');
    const next = await import(/* @vite-ignore */ `/src/components/dashboard/ChurchOverview.tsx?t=${Date.now()}`);
    return runtime.validateRefreshBoundaryAndEnqueueUpdate('/src/components/dashboard/ChurchOverview.tsx', previous, next);
  });
  expect(refreshError).toBeUndefined();
  await expect.poll(() => heroHandle!.evaluate(element => element.isConnected)).toBe(false);
  await page.getByRole('button', { name: 'Open church overview', exact: true }).click();
  await expect(sky).toBeHidden();
  await expect(page.locator('.church-focus-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(hero).toHaveAttribute('data-church-visible', 'false');
  expect(errors).toEqual([]);
});

test('sidebar resizing keeps the sky aligned and animates star groups instead of individual dots', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.locator('.text-type-content')).toHaveText(/Good (morning|afternoon|evening), Mark\./);
  const sidebar = page.locator('aside[data-guide="navigation"]');
  for (const theme of ['light', 'dark']) {
    await page.getByRole('combobox', { name: 'Appearance' }).selectOption(theme);
    await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition');
    await page.evaluate(() => {
      const main = document.querySelector('main')!;
      const sky = document.querySelector('.church-dashboard-sky')!;
      const samples: { edge: number; clip: number }[] = [];
      const observer = new ResizeObserver(() => {
        const clip = getComputedStyle(sky).clipPath.match(/inset\(0px 0px 0px ([\d.]+)px\)/);
        if (clip) samples.push({ edge: main.getBoundingClientRect().left, clip: Number(clip[1]) });
      });
      observer.observe(main);
      (window as any).sidebarSkySamples = { samples, observer };
    });
    for (let cycle = 0; cycle < 3; cycle++) {
      await page.getByTitle('Collapse sidebar', { exact: true }).click();
      await expect.poll(() => sidebar.evaluate(element => element.getBoundingClientRect().width)).toBe(80);
      await page.getByTitle('Expand sidebar (Click to un-collapse)', { exact: true }).click();
      await expect.poll(() => sidebar.evaluate(element => element.getBoundingClientRect().width)).toBe(256);
    }
    const samples = await page.evaluate(() => {
      const { samples, observer } = (window as any).sidebarSkySamples;
      observer.disconnect();
      return samples as { edge: number; clip: number }[];
    });
    expect(samples.length).toBeGreaterThan(6);
    expect(Math.max(...samples.map(sample => Math.abs(sample.edge - sample.clip)))).toBeLessThan(1);
    const animatedDots = await page.locator('.church-stars i').evaluateAll(dots => dots.filter(dot => getComputedStyle(dot).animationName !== 'none').length);
    expect(animatedDots).toBe(0);
    if (theme === 'dark') {
      await expect(page.locator('.church-star-tile').first()).toHaveCSS('animation-name', 'church-star-field-twinkle');
      await expect(page.locator('.church-star-belt').first()).toHaveCSS('animation-name', 'church-sky-drift');
    }
    await testInfo.attach(`Sidebar/sky alignment ${theme}`, { body: JSON.stringify(samples), contentType: 'application/json' });
  }
  // A rapid reversal should settle at the requested width, with navigation still usable.
  await page.getByTitle('Collapse sidebar', { exact: true }).click();
  await page.getByTitle('Expand sidebar (Click to un-collapse)', { exact: true }).click();
  await expect.poll(() => sidebar.evaluate(element => element.getBoundingClientRect().width)).toBe(256);
  await page.getByTitle('Members & Families', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add Member', exact: true })).toBeVisible();
});

test('reduced motion disables sidebar transitions and mobile navigation still opens and closes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const sidebar = page.locator('aside[data-guide="navigation"]');
  await page.getByTitle('Collapse sidebar', { exact: true }).click();
  await expect(sidebar).toHaveCSS('transition-property', 'none');
  await expect(sidebar).toHaveCSS('width', '80px');
  await page.getByTitle('Expand sidebar (Click to un-collapse)', { exact: true }).click();
  await expect(sidebar).toHaveCSS('width', '256px');
  await page.setViewportSize({ width: 390, height: 750 });
  await page.getByRole('button', { name: 'Toggle navigation menu' }).click();
  await expect.poll(() => sidebar.evaluate(element => element.getBoundingClientRect().left)).toBe(0);
  await page.getByTitle('Close Navigation', { exact: true }).click();
  await expect.poll(() => sidebar.evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
});

import { test, expect } from '@playwright/test';

// Appearance tests isolate the browser from the church database.
test.use({ timezoneId: 'Asia/Manila' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
  });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({ status: /\/(auth\/setup-status|auth\/me|ministries)$/.test(path) ? 200 : 404, json: path.endsWith('/auth/setup-status')
      ? { hasUsers: true, hasAdmin: true, demoModeEnabled: false }
      : path.endsWith('/auth/me')
        ? { user: { id: 1, name: 'Theme Preview', role_name: 'Admin', ministries: [] } }
        : [] });
  });
});

test('manual modes change surfaces, persist after reload, and ignore time of day', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-01T12:00:00+08:00') });
  await page.goto('/');
  const selector = page.getByRole('combobox', { name: 'Appearance' });
  await expect(selector).toHaveValue('auto');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await selector.selectOption('dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(15, 23, 42)');
  await expect(page.getByRole('heading', { name: 'Sign In to Your Portal' })).toHaveCSS('color', 'rgb(226, 232, 240)');
  await expect(page.getByPlaceholder('e.g. admin or admin@church.org')).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.reload();
  await expect(selector).toHaveValue('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await selector.selectOption('light');
  await page.clock.setSystemTime(new Date('2026-10-01T23:00:00+08:00'));
  await page.clock.fastForward(61_000);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(250, 247, 242)');
  await page.reload();
  await expect(selector).toHaveValue('light');
});

test('theme surfaces settle together behind one shared fade in both directions', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dpc_theme_mode', 'light'));
  await page.goto('/');
  const selector = page.getByRole('combobox', { name: 'Appearance' });
  await expect(selector).toBeVisible();
  await page.evaluate(() => {
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = (update) => {
      const transition = start(update);
      void transition.ready.then(() => {
        // Hold the visual fade so assertions observe the middle of the switch.
        const fade = document.getAnimations().find((animation) =>
          animation instanceof CSSAnimation && animation.animationName === 'theme-fade-in');
        if (fade) fade.pause();
      }).catch(() => {});
      return transition;
    };
  });
  for (const mode of ['dark', 'light']) {
    await selector.selectOption(mode);
    await expect.poll(() => page.evaluate(() => document.getAnimations().filter((animation) =>
      animation instanceof CSSAnimation && animation.animationName === 'theme-fade-in' && animation.playState === 'paused').length)).toBe(1);
    await expect(page.locator('body')).toHaveCSS('background-color', mode === 'dark' ? 'rgb(15, 23, 42)' : 'rgb(250, 247, 242)');
    await expect(page.getByRole('heading', { name: 'Sign In to Your Portal' })).toHaveCSS('color', mode === 'dark' ? 'rgb(226, 232, 240)' : 'rgb(41, 37, 32)');
    await expect(page.getByPlaceholder('e.g. admin or admin@church.org')).toHaveCSS('background-color', mode === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)');
    expect(await page.evaluate(() => document.getAnimations().filter((animation) =>
      animation instanceof CSSTransition && /color|shadow|fill|stroke/.test(animation.transitionProperty)).length)).toBe(0);
    await page.evaluate(() => document.getAnimations().forEach((animation) => {
      if (animation instanceof CSSAnimation && animation.animationName === 'theme-fade-in') animation.finish();
    }));
    await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition');
    // Normal input interactions regain their original transition after the fade.
    await expect(page.getByPlaceholder('e.g. admin or admin@church.org')).toHaveCSS('transition-duration', '0.3s');
  }
});

for (const fallback of ['reduced motion', 'unsupported browser']) {
  test(`theme switches all surfaces immediately with ${fallback}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('dpc_theme_mode', 'light'));
    if (fallback === 'reduced motion') await page.emulateMedia({ reducedMotion: 'reduce' });
    else await page.addInitScript(() => { document.startViewTransition = undefined as any; });
    await page.goto('/');
    for (const mode of ['dark', 'light']) {
      await page.getByRole('combobox', { name: 'Appearance' }).selectOption(mode);
      // No polling: surfaces with and without component transitions must settle
      // in the same update, even when the page-wide animation is unavailable.
      const appearance = await page.evaluate(() => ({
        background: getComputedStyle(document.body).backgroundColor,
        input: getComputedStyle(document.querySelector('input')!).backgroundColor,
        colorTransitions: document.getAnimations().filter((animation) =>
          animation instanceof CSSTransition && /color/.test(animation.transitionProperty)).length,
      }));
      expect(appearance.background).toBe(mode === 'dark' ? 'rgb(15, 23, 42)' : 'rgb(250, 247, 242)');
      expect(appearance.input).toBe(mode === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)');
      expect(appearance.colorTransitions).toBe(0);
      await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition');
    }
  });
}

test('rapid appearance changes finish on the latest choice', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dpc_theme_mode', 'light'));
  await page.goto('/');
  const selector = page.getByRole('combobox', { name: 'Appearance' });
  for (const mode of ['dark', 'light', 'dark', 'light', 'dark']) await selector.selectOption(mode);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition');
  await expect(page.getByPlaceholder('e.g. admin or admin@church.org')).toHaveCSS('background-color', 'rgb(30, 41, 59)');
});

for (const boundary of [
  { at: '2026-10-01T05:59:59+08:00', before: 'dark', after: 'light' },
  { at: '2026-10-01T17:59:59+08:00', before: 'light', after: 'dark' },
]) {
  test(`auto changes from ${boundary.before} to ${boundary.after} at the local boundary`, async ({ page }) => {
    await page.clock.install({ time: new Date(boundary.at) });
    await page.clock.pauseAt(new Date(boundary.at));
    await page.goto('/');
    await expect(page.getByRole('combobox', { name: 'Appearance' })).toHaveValue('auto');
    await expect(page.locator('html')).toHaveAttribute('data-theme', boundary.before);
    await page.clock.fastForward(1_100);
    await expect(page.locator('html')).toHaveAttribute('data-theme', boundary.after);
  });
}

test('auto catches up after sleep and manual mode can return to auto', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-01T12:00:00+08:00') });
  await page.goto('/');
  await expect(page.getByRole('combobox', { name: 'Appearance' })).toBeVisible();
  await page.clock.setSystemTime(new Date('2026-10-01T23:00:00+08:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('combobox', { name: 'Appearance' }).selectOption('light');
  await page.getByRole('combobox', { name: 'Appearance' }).selectOption('auto');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('pre-paint theme handles invalid preferences and unavailable storage', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-01T23:00:00+08:00') });
  await page.addInitScript(() => localStorage.setItem('dpc_theme_mode', 'invalid'));
  await page.goto('/');
  await expect(page.getByRole('combobox', { name: 'Appearance' })).toHaveValue('auto');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const result = await page.evaluate(async () => {
    const original = Storage.prototype.getItem;
    const script = await (await fetch('./theme-init.js')).text();
    try {
      Storage.prototype.getItem = () => { throw new Error('Storage blocked'); };
      new Function(script)();
      return document.documentElement.dataset.theme;
    } finally { Storage.prototype.getItem = original; }
  });
  expect(result).toBe('dark');
});

test('pre-paint theme restores manual choice before React starts', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dpc_theme_mode', 'dark'));
  await page.route('**/src/main.tsx', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('appearance syncs across tabs and remains usable on mobile', async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const second = await context.newPage();
  await second.route('**/api/**', (route) => route.fulfill({ json: { hasUsers: true, hasAdmin: true } }));
  await second.goto('/');
  await page.getByRole('combobox', { name: 'Appearance' }).selectOption('dark');
  await expect(second.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('combobox', { name: 'Appearance' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/theme-mobile-dark.png', fullPage: true });
});

test('authenticated shell and portal dialogs follow the chosen appearance', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
    localStorage.setItem('dpc_theme_mode', 'dark');
  });
  await page.goto('/');
  const selector = page.getByRole('combobox', { name: 'Appearance' });
  await expect(selector).toHaveValue('dark');
  await expect(page.locator('aside')).toHaveCSS('background-color', 'rgb(30, 41, 59)');
  await page.screenshot({ path: 'test-results/theme-dashboard-dark.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(selector).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await selector.selectOption('light');
  await expect(page.locator('aside')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await selector.selectOption('dark');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.keyboard.press('Control+p');
  await expect(page.getByRole('heading', { name: /System Configuration/i })).toBeVisible();
  // Shared secondary actions use the dark surface token.
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toHaveCSS('background-color', 'rgb(30, 41, 59)');
  await page.screenshot({ path: 'test-results/theme-shell-dark.png', fullPage: true });
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(250, 247, 242)');
});

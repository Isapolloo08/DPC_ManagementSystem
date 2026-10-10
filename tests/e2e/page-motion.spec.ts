import { test, expect } from '@playwright/test';

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`page entrance and metric count-up preserve loading (${reducedMotion})`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      sessionStorage.setItem('dpc_intro_shown', 'true');
      localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
      localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
    });
    let release!: () => void;
    const ready = new Promise<void>(resolve => { release = resolve; });
    let total = 120;
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let json: any = [];
      if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
      else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Admin', email: 'admin@example.test', role_name: 'Admin', ministries: [] } };
      else if (path.endsWith('/audit')) {
        await ready;
        json = Array.from({ length: total }, (_, i) => ({ id: i + 1, user_name: 'Test Admin', role_name: 'Admin', action: 'CREATE', target_table: 'members', target_id: i + 1, details: 'Registered test member', created_at: '2026-10-09T16:30:00Z' }));
      }
      else if (path.endsWith('/notifications')) json = { items: [], total: 0, totalPages: 1 };
      else if (path.endsWith('/notifications/unread-count')) json = { count: 0 };
      else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
      else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
      else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
      else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
      await route.fulfill({ json });
    });
    await page.goto('/');
    await page.locator('aside').getByTitle('System Audit Logs', { exact: true }).click();
    await expect(page.locator('.page-skeleton')).toBeVisible();
    const entrance = await page.locator('[data-guide="workspace"]').evaluate(el => getComputedStyle(el).animationName);
    expect(entrance).toBe(reducedMotion === 'reduce' ? 'none' : 'workspace-reveal');
    // Sample actual rendered numbers, rather than relying on timing a single frame.
    await page.evaluate(() => {
      const samples: string[] = [];
      (window as any).__metricSamples = samples;
      const begin = performance.now();
      const sample = () => {
        const el = document.querySelector('.stat-card .animated-number-current');
        if (el) samples.push(el.textContent || '');
        if (performance.now() - begin < 2000) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    release();
    const value = page.locator('.stat-card .animated-number-current').first();
    await expect(value).toHaveText('120');
    await expect(page.locator('.page-skeleton')).toHaveCount(0);
    const samples = await page.evaluate(() => (window as any).__metricSamples as string[]);
    if (reducedMotion === 'reduce') expect(samples.every(value => value === '120')).toBe(true);
    else expect(samples.some(value => Number(value) > 0 && Number(value) < 120)).toBe(true);
    const width = await page.locator('.animated-number').first().evaluate(el => ({
      outer: el.getBoundingClientRect().width,
      reserve: el.querySelector('.animated-number-reserve')!.getBoundingClientRect().width,
    }));
    expect(width.outer).toBeCloseTo(width.reserve, 1);
    total = 130;
    await page.getByRole('button', { name: 'Refresh Ledger', exact: true }).click();
    await expect(value).toHaveText('130');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.locator('aside').evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`page-motion-${reducedMotion}.png`), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('aside').getByTitle('Curriculum Books/Topics', { exact: true }).click();
    await expect(page.locator('[data-guide="workspace"] .page-header')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

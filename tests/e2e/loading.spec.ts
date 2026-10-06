import { test, expect, type Page } from '@playwright/test';

async function mockStartup(page: Page, signedIn = false) {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const requests: string[] = [];
  await page.addInitScript(signedIn => {
    localStorage.setItem('dpc_theme_mode', 'dark');
    if (signedIn) {
      localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
      localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
    }
  }, signedIn);
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) {
      await gate;
      json = { hasUsers: true, hasAdmin: true, demoModeEnabled: false };
    } else if (path.endsWith('/auth/me')) {
      json = { user: { id: 1, name: 'Mark Angelo', role_name: 'Admin', ministries: [] } };
    } else if (path.endsWith('/reports/dashboard')) {
      json = { metrics: { total_active_members: 21, total_households: 10 }, ministry_breakdown: [] };
    } else if (path.endsWith('/settings/general')) {
      json = { settings: { church_name: 'Daet Presbyterian Church' }, list: [] };
    } else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
    else if (path.endsWith('/duty/schedule') || path.endsWith('/dishwashing/schedule')) json = { schedule: [], total_teams: 0 };
    await route.fulfill({ status: 200, json });
  });
  return { release, requests };
}

test('original particle title, stars, meteor and logo remain on a throttled CPU', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const { release } = await mockStartup(page);
  await page.addInitScript(() => {
    (window as any).__cometFrames = [];
    const draw = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function(...args: any[]) {
      draw.apply(this, args as any);
      if ((this.canvas as HTMLCanvasElement).closest('.dpc-startup__meteor-layer[data-active="true"]')) {
        (window as any).__cometFrames.push(performance.now());
      }
    };
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.dpc-startup__line canvas')).toHaveCount(1);
  await expect(page.locator('.dpc-startup__line canvas')).toBeVisible();
  const frameGaps = await page.evaluate(() => new Promise<number[]>(resolve => {
    const gaps: number[] = [];
    let previous = performance.now();
    const started = previous;
    const sample = (now: number) => {
      gaps.push(now - previous);
      previous = now;
      if (now - started < 1600) requestAnimationFrame(sample);
      else resolve(gaps);
    };
    requestAnimationFrame(sample);
  }));
  const sorted = frameGaps.slice(1).sort((a, b) => a - b);
  const metrics = { frames: sorted.length, medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.floor(sorted.length * .95)] };
  console.log('Startup at 6x CPU slowdown:', JSON.stringify(metrics));
  expect(metrics.medianMs).toBeLessThan(100);
  await testInfo.attach('CPU throttled frame intervals', { body: JSON.stringify(metrics), contentType: 'application/json' });
  await testInfo.attach('Original star field', { body: await page.screenshot({ path: testInfo.outputPath('star-field.png') }), contentType: 'image/png' });
  await expect(page.locator('.dpc-startup__meteor')).toBeVisible();
  await expect(page.locator('.dpc-startup__meteor-layer canvas')).toHaveAttribute('data-renderer', 'three');
  await expect.poll(() => page.evaluate(() => (window as any).__cometFrames.length)).toBeGreaterThan(10);
  await testInfo.attach('Three.js shooting star', { body: await page.screenshot({ path: testInfo.outputPath('three-comet.png') }), contentType: 'image/png' });
  await expect(page.locator('.dpc-startup__logo--revealed')).toBeVisible();
  const cometFrames = await page.evaluate(() => (window as any).__cometFrames as number[]);
  const cometGaps = cometFrames.slice(1).map((time, index) => time - cometFrames[index]).sort((a, b) => a - b);
  const cometMetrics = { frames: cometFrames.length, medianMs: cometGaps[Math.floor(cometGaps.length / 2)], p95Ms: cometGaps[Math.floor(cometGaps.length * .95)] };
  console.log('Three.js comet at 6x CPU slowdown:', JSON.stringify(cometMetrics));
  expect(cometFrames.length).toBeGreaterThan(15);
  expect(cometMetrics.medianMs).toBeLessThan(50);
  await testInfo.attach('Three.js comet frame intervals', { body: JSON.stringify(cometMetrics), contentType: 'application/json' });
  await testInfo.attach('Original formed title and logo', { body: await page.screenshot({ path: testInfo.outputPath('formed-title.png') }), contentType: 'image/png' });
  release();
  await expect(page.locator('.dpc-startup')).toHaveCount(0);
  await page.getByPlaceholder('e.g. admin or admin@church.org').fill('loading-check');
  expect(errors).toEqual([]);
});

test('auth prepares once while the hidden dashboard waits for the original intro', async ({ page }) => {
  const { release, requests } = await mockStartup(page, true);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/');
  await expect.poll(() => requests.filter(path => path.endsWith('/auth/setup-status')).length).toBeGreaterThan(0);
  release();
  await expect.poll(() => requests.filter(path => path.endsWith('/auth/me')).length).toBeGreaterThan(0);
  const authRequests = requests.filter(path => path.includes('/auth/')).length;
  await page.clock.runFor(500);
  await expect(page.locator('.dpc-startup')).toHaveAttribute('data-phase', 'intro');
  await expect(page.locator('[data-guide="workspace"]')).toHaveCount(0);
  expect(requests.some(path => path.endsWith('/reports/dashboard'))).toBe(false);
  await page.clock.runFor(9000);
  await expect(page.locator('.dpc-startup')).toHaveCount(0);
  await expect(page.locator('[data-guide="workspace"]')).toBeVisible();
  await expect.poll(() => requests.some(path => path.endsWith('/reports/dashboard'))).toBe(true);
  expect(requests.filter(path => path.includes('/auth/')).length).toBe(authRequests);
  await expect(page.locator('[data-startup-phase]')).not.toHaveAttribute('inert', '');
  expect(await page.evaluate(() => document.body.classList.contains('dpc-startup-active'))).toBe(false);
});

test('reduced motion, small screens and session reuse retain the static fallback', async ({ page }) => {
  const { release } = await mockStartup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/');
  await expect(page.locator('.dpc-startup__static-title')).toHaveText('DPC ChurchManagement System');
  await expect(page.locator('.dpc-startup__line canvas')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  release();
  await page.clock.runFor(1600);
  await expect(page.locator('.dpc-startup')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.dpc-startup')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Sign In to Your Portal' })).toBeVisible();
});

test('a slow server still releases the intro for recovery without blocking keyboard input', async ({ page }) => {
  const { release } = await mockStartup(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/');
  await page.clock.runFor(9500);
  await expect(page.locator('.dpc-startup')).toHaveAttribute('data-phase', 'intro');
  await page.clock.runFor(1000);
  await expect(page.locator('.dpc-startup')).toHaveAttribute('data-phase', 'exiting');
  await page.clock.runFor(200);
  await expect(page.locator('.dpc-startup')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  await page.keyboard.press('Control+p');
  await expect(page.getByRole('heading', { name: 'System Configuration' })).toBeVisible();
  release();
});

test('cached 2D fallback preserves particles when GPU rendering is unavailable', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const { release } = await mockStartup(page);
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: any[]) {
      if (type === 'webgl' || type === 'webgl2') return null;
      return getContext.apply(this, [type, ...args] as any);
    } as any;
  });
  await page.goto('/');
  await expect(page.locator('.dpc-startup__line canvas')).toBeVisible();
  await expect(page.locator('.dpc-startup__meteor--fallback')).toBeVisible();
  await expect(page.locator('.dpc-startup__logo--revealed')).toBeVisible();
  const pixels = await page.locator('.dpc-startup__line canvas').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d')!;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let count = 0;
    for (let index = 3; index < data.length; index += 4) if (data[index] > 20) count += 1;
    return count;
  });
  expect(pixels).toBeGreaterThan(10000);
  await page.screenshot({ path: testInfo.outputPath('fallback-title.png') });
  release();
  await expect(page.locator('.dpc-startup')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('GPU context restoration and resize keep both mobile title lines visible', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const { release } = await mockStartup(page);
  await page.goto('/');
  await expect(page.locator('.dpc-startup__line canvas')).toBeVisible();
  await page.locator('.dpc-startup__line canvas').evaluate((canvas: HTMLCanvasElement) => new Promise<void>(resolve => {
    const gl = canvas.getContext('webgl')!;
    const extension = gl.getExtension('WEBGL_lose_context')!;
    canvas.addEventListener('webglcontextrestored', () => resolve(), { once: true });
    extension.loseContext();
    setTimeout(() => extension.restoreContext(), 100);
  }));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.dpc-startup__line canvas')).toHaveCount(2);
  await expect(page.locator('.dpc-startup__logo--revealed')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mobile-title.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  release();
  await expect(page.locator('.dpc-startup')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('losing the Three.js context keeps the original comet fallback and completes the intro', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const { release } = await mockStartup(page);
  await page.goto('/');
  const canvas = page.locator('.dpc-startup__meteor-layer canvas');
  await expect(canvas).toHaveAttribute('data-renderer', 'three');
  await canvas.evaluate((element: HTMLCanvasElement) => element.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext());
  await expect(page.locator('.dpc-startup__meteor--fallback')).toBeVisible();
  await expect(page.locator('.dpc-startup__logo--revealed')).toBeVisible();
  release();
  await expect(page.locator('.dpc-startup')).toHaveCount(0);
  expect(errors).toEqual([]);
});

import { randomUUID } from 'node:crypto';
import { test, expect, apiURL } from './fixtures';

const usernamePlaceholder = 'e.g. admin or admin@church.org';
const signIn = 'Sign In to DPC Portal';

test('backend and database are healthy', async ({ request }) => {
  const response = await request.get(`${apiURL}/api/health`);
  expect(response.ok(), 'Start the DPC backend with npm run dev:server before testing').toBeTruthy();
  expect(await response.json()).toMatchObject({ status: 'ok', database: 'connected' });
});

test('startup reaches the real login page', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Daet Presbyterian Church/);
  await expect(page.getByRole('heading', { name: 'Sign In to Your Portal' })).toBeVisible();
  // Clicking also verifies that the animated startup overlay has finished.
  await page.getByPlaceholder(usernamePlaceholder).click();
  await expect(page.getByRole('button', { name: signIn })).toBeEnabled();
  await testInfo.attach('DPC login page', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
});

test.describe('login interactions', () => {
  test.beforeEach(async ({ page }) => {
    // The startup animation has its own test above; skip repeats in this group.
    await page.addInitScript(() => sessionStorage.setItem('dpc_intro_shown', 'true'));
    await page.goto('/');
    await expect(page.getByRole('button', { name: signIn })).toBeVisible();
  });

  test('password can be shown and hidden without losing its value', async ({ page }) => {
    const password = page.locator('form input').nth(1);
    await password.fill('playwright-visibility-check');
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByTitle('Show password', { exact: true }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await expect(password).toHaveValue('playwright-visibility-check');
    await page.getByTitle('Hide password', { exact: true }).click();
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('empty username is blocked before an authentication request', async ({ page }) => {
    const loginRequests: string[] = [];
    page.on('request', request => {
      if (new URL(request.url()).pathname === '/api/auth/login') loginRequests.push(request.url());
    });
    await page.getByRole('button', { name: signIn }).click();
    const username = page.getByPlaceholder(usernamePlaceholder);
    await expect(username).toBeFocused();
    expect(await username.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
    expect(loginRequests).toEqual([]);
  });

  test('invalid credentials show the real API error and stay signed out', async ({ page, expectedApiErrors }) => {
    expectedApiErrors.push('401 POST /api/auth/login');
    await page.getByPlaceholder(usernamePlaceholder).fill(`playwright-missing-${randomUUID()}`);
    await page.locator('input[type="password"]').fill('not-a-real-password');
    const responsePromise = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/auth/login' && response.request().method() === 'POST');
    await page.getByRole('button', { name: signIn }).click();
    expect((await responsePromise).status()).toBe(401);
    await expect(page.getByText('Invalid email/username or password', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('chms_token'))).toBeNull();
  });
});

test('an expired session returns to login and clears its token', async ({ page }) => {
  const expiredToken = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${Buffer.from(JSON.stringify({ exp: 1 })).toString('base64url')}.expired-test`;
  await page.addInitScript(token => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('chms_token', token);
  }, expiredToken);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your Session Has Expired' })).toBeVisible();
  await page.getByRole('button', { name: 'Go to Login Page' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Sign In to Your Portal' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('chms_token'))).toBeNull();
});

test('login is usable at a mobile viewport without horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByPlaceholder(usernamePlaceholder).fill('mobile-layout-check');
  await expect(page.getByRole('button', { name: signIn })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  await testInfo.attach('DPC mobile login', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
});

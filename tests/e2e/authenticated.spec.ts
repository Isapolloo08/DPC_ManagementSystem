import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';

const usernamePlaceholder = 'e.g. admin or admin@church.org';
const signIn = 'Sign In to DPC Portal';

// Do not record the credential-bearing login request in a trace/video.
test.use({ trace: 'off', video: 'off' });

test('login, dashboard, session reload, member search, calendar, and logout', async ({ page }, testInfo) => {
  test.skip(!process.env.DPC_TEST_USERNAME || !process.env.DPC_TEST_PASSWORD,
    'Set DPC_TEST_USERNAME and DPC_TEST_PASSWORD to test an Admin/Pastor/Coordinator account.');
  test.setTimeout(120_000);
  await page.addInitScript(() => sessionStorage.setItem('dpc_intro_shown', 'true'));
  await page.goto('/');

  await test.step('sign in and load live dashboard data', async () => {
    await page.getByPlaceholder(usernamePlaceholder).fill(process.env.DPC_TEST_USERNAME!);
    await page.locator('input[type="password"]').fill(process.env.DPC_TEST_PASSWORD!);
    const loginResponse = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/auth/login' && response.request().method() === 'POST');
    const dashboardResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/reports/dashboard');
    await page.getByRole('button', { name: signIn }).click();
    expect((await loginResponse).status()).toBe(200);
    expect((await dashboardResponse).status()).toBe(200);
    await expect(page.getByRole('heading', { name: /^Welcome back,/ })).toBeVisible();
    await testInfo.attach('DPC dashboard', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  });

  await test.step('keep the authenticated session after reloading', async () => {
    const sessionResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/me');
    await page.reload();
    expect((await sessionResponse).status()).toBe(200);
    await expect(page.getByRole('heading', { name: /^Welcome back,/ })).toBeVisible();
  });

  await test.step('open members, search for a missing record, and clear the filter', async () => {
    const membersResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/members');
    await page.getByTitle('Members & Families', { exact: true }).click();
    const initialResponse = await membersResponse;
    expect(initialResponse.status()).toBe(200);
    const initialBody = await initialResponse.json();
    const initialRows = Array.isArray(initialBody) ? initialBody : initialBody.data;
    expect(Array.isArray(initialRows)).toBe(true);
    await expect(page.getByRole('heading', { name: 'Members & Family Directory' })).toBeVisible();
    await expect(page.locator('main tbody tr')).toHaveCount(initialRows.length);
    const search = page.getByPlaceholder('Search by name, email...');
    const query = `playwright-no-member-${randomUUID()}`;
    const searchResponse = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === '/api/members' && url.searchParams.get('search') === query;
    });
    await search.fill(query);
    const result = await searchResponse;
    expect(result.status()).toBe(200);
    const body = await result.json();
    expect(Array.isArray(body) ? body : body.data).toEqual([]);
    await expect(page.locator('main tbody tr')).toHaveCount(0);
    const clearResponse = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === '/api/members' && !url.searchParams.get('search');
    });
    await search.clear();
    const restoredResponse = await clearResponse;
    expect(restoredResponse.status()).toBe(200);
    const restoredBody = await restoredResponse.json();
    const restoredRows = Array.isArray(restoredBody) ? restoredBody : restoredBody.data;
    expect(Array.isArray(restoredRows)).toBe(true);
    await expect(search).toHaveValue('');
    await expect(page.locator('main tbody tr')).toHaveCount(restoredRows.length);
  });

  await test.step('open the live calendar and change the month', async () => {
    const eventsResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/events');
    await page.getByTitle('Calendar', { exact: true }).click();
    expect((await eventsResponse).status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible();
    const month = page.getByRole('heading', { name: /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/ });
    const initialMonth = await month.innerText();
    await page.getByTitle('Next Month', { exact: true }).click();
    await expect(month).not.toHaveText(initialMonth);
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    await expect(month).toHaveText(initialMonth);
    await testInfo.attach('DPC calendar', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  });

  await test.step('sign out and remove the saved session', async () => {
    await page.getByTitle('Sign Out of Account', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Sign In to Your Portal' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('chms_token'))).toBeNull();
  });
});

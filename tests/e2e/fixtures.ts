import { test as base, expect } from '@playwright/test';

export const apiURL = (process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:4000').replace(/\/+$/, '');

export const test = base.extend<{ browserChecks: void; expectedApiErrors: string[] }>({
  expectedApiErrors: async ({}, use) => { await use([]); },
  browserChecks: [async ({ page, expectedApiErrors }, use) => {
    const pageErrors: string[] = [];
    const serverErrors: string[] = [];
    const unexpectedWrites: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('response', response => {
      if (response.url().startsWith(`${apiURL}/api/`) && response.status() >= 400) {
        const error = `${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`;
        if (!expectedApiErrors.includes(error)) serverErrors.push(error);
      }
    });
    page.on('requestfailed', request => {
      const error = request.failure()?.errorText;
      // Navigating/reloading legitimately cancels requests still in flight.
      if (request.url().startsWith(`${apiURL}/api/`) && error !== 'net::ERR_ABORTED') {
        serverErrors.push(`${error} ${new URL(request.url()).pathname}`);
      }
    });
    // These smoke tests browse real data. Prevent accidental record changes.
    await page.route(`${apiURL}/api/**`, async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && path !== '/api/auth/login') {
        unexpectedWrites.push(`${request.method()} ${path}`);
        await route.abort('blockedbyclient');
        return;
      }
      await route.continue();
    });
    await page.addInitScript(serverURL => {
      localStorage.setItem('dpc_server_ip', serverURL);
    }, apiURL);

    await use();

    expect(pageErrors, 'Uncaught browser errors').toEqual([]);
    expect(serverErrors, 'API server errors').toEqual([]);
    expect(unexpectedWrites, 'Unexpected data-changing requests').toEqual([]);
  }, { auto: true }],
});

export { expect };

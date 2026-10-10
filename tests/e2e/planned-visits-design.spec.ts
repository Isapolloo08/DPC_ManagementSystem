import { test, expect } from '@playwright/test';

for (const theme of ['light', 'dark']) {
  for (const mobile of [false, true]) {
    test(`planned visits has clear statuses, responsive details and motion (${theme}, ${mobile ? 'mobile' : 'desktop'})`, async ({ page }, info) => {
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
      await page.emulateMedia({ reducedMotion: mobile ? 'reduce' : 'no-preference' });
      const errors: string[] = [], writes: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(theme => {
        sessionStorage.setItem('dpc_intro_shown', 'true');
        localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
        localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
        localStorage.setItem('dpc_theme_mode', theme);
      }, theme);
      const visits = ['New', 'Contacted', 'Visited', 'Cancelled'].map((status, i) => ({ id: i + 1, full_name: i ? ['Anna Cruz', 'Paolo Reyes', 'Maria Santos'][i - 1] : 'Mark Andrie Magna Remot With A Longer Family Name', visit_date: '2026-10-11', party: i ? 'Just me' : 'With friends', status, created_at: '2026-10-08T09:56:49Z' }));
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url()), path = url.pathname;
        let json: any = [];
        if (route.request().method() !== 'GET') writes.push(path);
        if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
        else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Preview Admin', role_name: 'Admin', ministries: [] } };
        else if (path.endsWith('/planned-visits')) {
          const status = url.searchParams.get('status'), date = url.searchParams.get('visit_date');
          const items = visits.filter(visit => (!status || visit.status === status) && (!date || visit.visit_date === date));
          json = { items, total: items.length, page: 1, totalPages: 1 };
        } else if (path.endsWith('/planned-visits/1')) json = { ...visits[0], email: 'visitor@example.test', phone: '09123456789', bringing_children: true, child_age_groups: ['6–12'], consent_at: '2026-10-08T09:56:49Z', questions: 'Where can we bring the children?', staff_notes: 'Meet at the welcome desk.' };
        else if (path.endsWith('/notifications')) json = { items: [], total: 0, totalPages: 1 };
        else if (path.endsWith('/notifications/unread-count')) json = { count: 0 };
        else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
        else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
        else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
        else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
        await route.fulfill({ json });
      });
      await page.goto('/');
      if (mobile) await page.getByRole('button', { name: 'Toggle navigation menu' }).click();
      await page.locator('aside').getByTitle('Planned visits', { exact: true }).click();
      const ledger = page.getByRole('region', { name: 'Visitor plans' });
      await expect(ledger).toBeVisible();
      for (const status of ['New', 'Contacted', 'Visited', 'Cancelled']) await expect(ledger.getByText(status, { exact: true }).filter({ visible: true })).toBeVisible();
      const row = page.locator(mobile ? '.visit-mobile-card' : '.visit-table tbody tr').first();
      await expect(row).toHaveCSS('animation-name', mobile ? 'none' : 'visit-reveal');
      await expect(ledger).toHaveCSS('opacity', '1');
      await expect(page.locator(mobile ? '.visit-mobile-card' : '.visit-table tbody tr').last()).toHaveCSS('opacity', '1');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (mobile) await row.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath(`visits-${theme}-${mobile ? 'mobile' : 'desktop'}.png`), fullPage: true });
      await ledger.getByRole('button', { name: `View visit for ${visits[0].full_name}`, exact: true }).click();
      const details = page.getByRole('region', { name: 'Visit details' });
      await expect(details.getByRole('heading', { name: visits[0].full_name, exact: true })).toBeVisible();
      await expect(details.getByLabel('Staff notes')).toHaveValue('Meet at the welcome desk.');
      await expect(details).toContainText('Where can we bring the children?');
      await details.getByRole('heading', { name: visits[0].full_name, exact: true }).scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`visit-details-${theme}-${mobile ? 'mobile' : 'desktop'}.png`), fullPage: true });
      await details.getByRole('button', { name: 'Close details' }).click();
      const filters = page.getByRole('region', { name: 'Visit filters' });
      await filters.getByLabel('Filter visits by status', { exact: true }).selectOption('Visited');
      await expect(page.locator(mobile ? '.visit-mobile-card' : '.visit-table tbody tr')).toHaveCount(1);
      await filters.getByLabel('Filter visits by date', { exact: true }).fill('2026-10-12');
      await expect(page.getByText('No planned visits match these filters.', { exact: true })).toBeVisible();
      await filters.getByRole('button', { name: 'Clear filters' }).click();
      await expect(page.locator(mobile ? '.visit-mobile-card' : '.visit-table tbody tr')).toHaveCount(4);
      await expect(page.getByLabel('planned visits rows per page')).toHaveValue('20');
      expect(errors).toEqual([]); expect(writes).toEqual([]);
    });
  }
}

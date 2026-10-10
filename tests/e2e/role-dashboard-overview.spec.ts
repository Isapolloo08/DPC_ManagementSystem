import { test, expect } from '@playwright/test';

for (const role of ['Leader', 'Volunteer']) {
  for (const mode of ['light', 'dark', 'mobile']) {
    test(`${role} keeps its dashboard with church overview in ${mode}`, async ({ page }, testInfo) => {
      if (mode === 'mobile') await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript(({ role, mode }) => {
        sessionStorage.setItem('dpc_intro_shown', 'true');
        localStorage.setItem('dpc_theme_mode', mode === 'dark' ? 'dark' : 'light');
        localStorage.setItem(`dpc_help_welcome_v1:1:${role}`, 'seen');
        localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
      }, { role, mode });
      await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname;
        let json: unknown = [];
        if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true, demoModeEnabled: false };
        else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Mark Angelo', role_name: role, ministries: [] } };
        else if (path.endsWith('/settings/general')) json = { settings: { church_name: 'Daet Presbyterian Church' }, list: [] };
        else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
        else if (path.endsWith('/duty/schedule') || path.endsWith('/dishwashing/schedule')) json = { schedule: [], total_teams: 0 };
        await route.fulfill({ status: 200, json });
      });
      await page.goto('/');
      const hero = page.locator('.church-overview');
      await expect(hero).toBeVisible();
      await expect(hero.locator('h1')).toHaveAttribute('aria-label', /Mark\./);
      await expect(page.getByText(role === 'Leader' ? 'Leader Quick Command Center' : 'Volunteer Quick Action Center', { exact: true })).toBeVisible();
      if (role === 'Leader') await expect(page.getByText('No Small Group Assigned', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Open church overview', exact: true }).filter({ visible: true }).click();
      const panel = page.locator('.church-focus-panel');
      await expect(panel).toBeVisible();
      await expect(panel.getByRole('button', { name: 'View church profile' })).toHaveCount(0);
      await expect(panel.getByRole('button', { name: 'View groups', exact: true })).toHaveCount(0);
      if (role === 'Leader') await expect(panel.getByRole('button', { name: 'My Bible study group' })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('church-focus.png') });
      await page.keyboard.press('Escape');
      await expect(hero).toHaveAttribute('data-church-visible', 'false');
      await expect(page.getByRole('button', { name: 'Open church overview', exact: true }).filter({ visible: true })).toBeFocused();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true });
    });
  }
}

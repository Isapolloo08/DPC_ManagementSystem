import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'Asia/Manila', launchOptions: { args: ['--disable-gpu'] } });

for (const theme of ['light', 'dark']) {
  for (const mobile of [false, true]) {
    test(`batch roll call is clear in ${theme} ${mobile ? 'mobile' : 'desktop'}`, async ({ page }, info) => {
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(theme => {
        sessionStorage.setItem('dpc_intro_shown', 'true');
        localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
        localStorage.setItem('dpc_theme_mode', theme);
        localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
      }, theme);
      const errors: string[] = [];
      const writes: any[] = [];
      page.on('pageerror', error => errors.push(error.message));
      const roster = Array.from({ length: 81 }, (_, index) => ({
        member_id: index + 1, first_name: `Member ${String(index + 1).padStart(2, '0')}`, last_name: 'Santos',
        birthdate: '1985-04-15', gender: 'Male', member_status: 'active', ministry_id: 1,
        ministry_name: 'Junior Adult', ministry_color: '#4A5568', household_id: 1, household_name: 'Santos',
        attendance_id: null, checked_in_at: null, checked_out_at: null, security_code: null,
        attendance_notes: null, is_present: 0, attendance_status: 'unmarked',
      }));
      await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname;
        let json: any = [];
        if (route.request().method() !== 'GET') { writes.push(route.request().postDataJSON()); json = { success: true }; }
        else if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
        else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Design Preview', role_name: 'Admin', ministries: [] } };
        else if (path.endsWith('/ministries')) json = [{ id: 1, name: 'Junior Adult', min_age: 36, max_age: 55 }];
        else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
        else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
        else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
        else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
        else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
        else if (path.endsWith('/attendance/roster')) json = roster;
        else if (path.endsWith('/events')) json = [{ id: 1, title: 'Church Anniversary', start_time: '2026-10-04T10:00:00+08:00', end_time: '2026-10-04T12:00:00+08:00', location: 'DPC' }];
        else if (path.endsWith('/events/1/attendance-roster')) json = { attendees: roster.map(item => ({ ...item, status: 'registered' })) };
        await route.fulfill({ json });
      });
      await page.goto('/');
      if (mobile) await page.getByRole('button', { name: 'Toggle navigation menu' }).click();
      await page.locator('aside').getByTitle('Attendance Live', { exact: true }).click();
      const main = page.locator('main');
      await main.locator('[data-guide="attendance-batch"]').click();
      const controls = main.getByRole('region', { name: 'Batch roll call controls' });
      await expect(controls).toBeVisible();
      await expect(main.locator('[data-guide="attendance-batch-save"]')).toHaveCount(1);
      await expect(main.getByRole('button', { name: 'Exit Batch Mode', exact: true })).toHaveCount(0);
      await expect(controls.locator('[data-guide="attendance-method-absent"]')).toHaveAttribute('aria-pressed', 'true');
      await main.locator('tbody input[type="checkbox"]').first().check();
      await expect(controls.getByRole('status')).toContainText('80 Present');
      await expect(controls.getByRole('status')).toContainText('1 Absent');
      await controls.locator('input').fill('Member 81');
      await expect(main.locator('tbody tr')).toHaveCount(1);
      await expect(controls.getByRole('status')).toContainText('1 selected');
      await controls.getByRole('button', { name: 'Select All (1)', exact: true }).click();
      await expect(controls.getByRole('status')).toContainText('2 selected');
      await controls.locator('input').fill('');
      await expect(main.locator('tbody tr')).toHaveCount(30);
      await controls.scrollIntoViewIfNeeded();
      expect(await controls.evaluate(element => getComputedStyle(element).animationName)).toBe('none');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath('batch-roll-call.png') });
      await controls.locator('[data-guide="attendance-batch-save"]').click();
      await expect.poll(() => writes.length).toBe(1);
      expect(writes[0].absent_ids).toEqual([1, 81]);
      expect(writes[0].present_ids).toHaveLength(79);
      await controls.locator('[data-guide="attendance-method-present"]').click();
      await expect(controls.getByRole('status')).toContainText('81 Absent');
      await controls.locator('[data-guide="attendance-method-selected"]').click();
      await expect(controls.getByRole('status')).toContainText('81 Unchanged');
      await expect(controls.locator('[data-guide="attendance-batch-save"]')).toBeDisabled();
      // Special event attendance shares the same controls and a single save action.
      await main.locator('[data-guide="attendance-event"]').click();
      await expect(main.locator('[data-guide="event-attendance-event"]')).toHaveValue('1');
      await main.locator('[data-guide="event-attendance-batch"]').click();
      await expect(controls).toBeVisible();
      await expect(main.locator('[data-guide="attendance-batch-save"]')).toHaveCount(1);
      await expect(controls.getByRole('status')).toContainText('81 Present');
      expect(errors).toEqual([]);
    });
  }
}

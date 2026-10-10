import { test, expect } from '@playwright/test';

for (const mode of ['light', 'dark', 'mobile']) {
  test(`leader overview preserves live content and actions in ${mode}`, async ({ page }, info) => {
    if (mode === 'mobile') await page.setViewportSize({ width: 390, height: 844 });
    let finished = false;
    await page.addInitScript(mode => {
      sessionStorage.setItem('dpc_intro_shown', 'true');
      localStorage.setItem('dpc_theme_mode', mode === 'dark' ? 'dark' : 'light');
      localStorage.setItem('dpc_help_welcome_v1:1:Leader', 'seen');
      localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
    }, mode);
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let json: unknown = [];
      if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
      else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Mark Angelo', role_name: 'Leader', ministries: [] } };
      else if (path.endsWith('/groups')) json = [{
        id: 11, name: 'Young Adults Discipleship', leader_id: 1, leader_name: 'Mark Angelo',
        meeting_day: 'Wednesday', meeting_time: '7:00 PM', location: 'Small Worship Hall',
        curriculum: 'Discipleship Training 2', curriculum_total_chapters: 12, current_chapter: 'Chapter 12',
        progress_stage: finished ? 'chapter_completed' : 'intro', max_capacity: 15, status: 'active',
        members: ['John Michael Santos', 'Rizza Lyn E. Domanicil', 'Kevin Lee', 'Sarah Villanueva', 'Camille Largo'].map((name, index) => ({ id: index + 1, member_name: name, joined_at: '2026-10-01', status: 'active' })),
      }];
      else if (path.endsWith('/study-topics')) json = { topics: [
        { id: 1, title: 'Foundations of Faith', total_chapters: 8, summary_notes: 'Study, reflect, and grow together.' },
        { id: 2, title: 'Scripture Study', total_chapters: 6 },
        { id: 3, title: 'Church History', total_chapters: 10 },
        { id: 4, title: 'Discipleship Training 2', total_chapters: 12, summary_notes: 'Rooted in Faith, Grounded in Love.' },
      ] };
      else if (path.endsWith('/events')) json = [{ id: 1, title: 'Sunday Divine Worship', start_time: '2026-10-11T09:30:00+08:00', location: 'Main Sanctuary' }, { id: 2, title: 'Midweek Prayer & Study', start_time: '2026-10-14T19:00:00+08:00', location: 'Discipleship Hall' }];
      else if (path.endsWith('/announcements')) json = [{ id: 1, title: 'Pastoral Council Bulletin', body: 'Please prepare your study guides for our next fellowship.\nBring your prayer requests and notebooks.', is_pinned: 1 }, { id: 2, title: 'Weekly group reminder', body: 'Our study group meets this Wednesday.', is_pinned: 0 }];
      else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
      else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
      else if (path.endsWith('/duty/schedule')) json = { schedule: [], total_teams: 0 };
      else if (path.endsWith('/dishwashing/schedule')) json = { schedule: [], thisSunday: { duty_date: '2026-10-11', team: { name: 'Team 2' } } };
      await route.fulfill({ json });
    });
    await page.route('https://bible-api.com/**', route => route.fulfill({ json: { reference: 'Zechariah 5', verses: [{ chapter: 5, verse: 1, text: 'Fixture verse for the passage reader.' }] } }));
    await page.goto('/');
    const content = page.locator('.leader-dashboard-content');
    await expect(content).toBeVisible();
    await expect(content.locator('.leader-metrics')).toContainText('33% small group occupancy');
    const progress = content.getByRole('progressbar', { name: 'Discipleship Training 2 curriculum completion' });
    await expect(progress).toHaveAttribute('aria-valuenow', '91.7');
    await expect(content.locator('.leader-topic').first()).toContainText('Discipleship Training 2');
    await expect(content.locator('.leader-roster-row')).toHaveCount(4);
    await expect(content.locator('.leader-roster-row')).toContainText(['Enrolled', 'Enrolled', 'Enrolled', 'Enrolled']);
    await expect(content).toContainText('Showing 4 of 5 disciples');
    await expect(content.locator('.leader-event')).toHaveCount(2);
    await expect(content.locator('.leader-notice[data-pinned="true"]')).toContainText('Pastoral Council Bulletin');
    await expect(page.locator('.text-type-content')).toHaveText(/Mark\./);
    await page.screenshot({ path: info.outputPath('populated-dashboard.png'), fullPage: true });
    await content.locator('.leader-panel-columns').scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('dashboard-panels.png') });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    finished = true;
    await page.reload();
    await expect(progress).toHaveAttribute('aria-valuenow', '100');
    await content.getByRole('button', { name: "Read Today's Chapters" }).click();
    const reader = page.locator('[data-modal-panel]').filter({ has: page.getByRole('button', { name: 'Close passage reader' }) });
    await expect(reader).toBeVisible();
    await reader.getByRole('button', { name: 'Close passage reader' }).click();
    await expect(reader).toHaveCount(0);
    await content.getByRole('button', { name: 'Manage in Portal' }).click();
    await expect(page.getByRole('heading', { name: 'My Bible Study Group', exact: true, level: 1 })).toBeVisible();
  });
}

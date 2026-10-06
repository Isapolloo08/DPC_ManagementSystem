import { test, expect } from '@playwright/test';
test.use({ timezoneId: 'Asia/Manila' });

test('roll call saves the lesson with attendance and preserves historical lessons', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-10-06T04:00:00Z'));
  const group = { id: 11, name: 'My Study Group', leader_name: 'Test Pastor', status: 'active', members: [{ id: 2, member_id: 2, member_name: 'Grace Reyes' }], category: 'General', curriculum: 'Romans', current_chapter: 'Chapter 2', meeting_day: 'Wednesday', meeting_time: '7:00 PM - 8:00 PM', max_capacity: 12 };
  const sessions = [{ session_date: '2026-09-23', topic_title: 'Gospel of John', chapter: 'Chapter 1', notes: 'Previous book', attendees: [{ member_id: 2 }] }];
  const saves: any[] = [];
  let failSave = true;
  await page.addInitScript(() => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
    localStorage.setItem('dpc_theme_mode', 'dark');
    localStorage.setItem('dpc_help_welcome_v1:1:Pastor', 'seen');
  });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Pastor', username: 'pastor', role_name: 'Pastor', ministries: [] } };
    else if (path.endsWith('/groups/mine')) json = [group];
    else if (path.endsWith('/dishwashing/schedule')) json = { schedule: [] };
    else if (path.endsWith('/study-topics')) json = { all: [{ id: 1, title: 'Romans', total_chapters: 16 }, { id: 2, title: 'Gospel of John', total_chapters: 21 }] };
    else if (path.endsWith('/groups/11/attendance')) {
      if (route.request().method() === 'POST') {
        const data = route.request().postDataJSON();
        saves.push(data);
        if (failSave) return route.fulfill({ status: 500, json: { error: 'Attendance save failed; try again.' } });
        if (data.update_group_progress) { group.curriculum = data.topic_title; group.current_chapter = data.chapter; }
        json = { message: 'Saved' };
      } else json = { sessions, summary: {}, members: [] };
    } else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    await route.fulfill({ json });
  });
  await page.goto('/');
  await page.locator('aside').getByTitle('My Bible Study Group', { exact: true }).click();
  await page.getByRole('button', { name: 'Take Weekly Roll-Call', exact: true }).click();
  await expect(page.getByLabel('Book / Study Topic', { exact: true })).toHaveValue('Romans');
  await expect(page.getByLabel('Chapter / Lesson', { exact: true })).toHaveValue('Chapter 2');
  const update = page.getByRole('checkbox', { name: /Update the group's current book/ });
  await expect(update).toBeChecked();
  await page.getByLabel('Book / Study Topic', { exact: true }).fill('Gospel of John');
  await page.getByLabel('Chapter / Lesson', { exact: true }).fill('Chapter 3');
  await page.getByRole('button', { name: 'Log Verified Attendance', exact: true }).click();
  await expect(page.getByText('Attendance save failed; try again.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Chapter / Lesson', { exact: true })).toHaveValue('Chapter 3');
  failSave = false;
  await page.getByRole('button', { name: 'Log Verified Attendance', exact: true }).click();
  await expect(page.getByLabel('Chapter / Lesson', { exact: true })).toHaveCount(0);
  expect(saves.at(-1)).toMatchObject({ session_date: '2026-09-30', topic_title: 'Gospel of John', chapter: 'Chapter 3', update_group_progress: true, present_member_ids: [2] });
  sessions.push({ session_date: '2026-09-30', topic_title: 'Gospel of John', chapter: 'Chapter 3', notes: '', attendees: [{ member_id: 2 }] });
  await page.getByRole('button', { name: 'Take Weekly Roll-Call', exact: true }).click();
  // Latest missing session is older than the two logged sessions.
  await expect(update).not.toBeChecked();
  await expect(update).toBeDisabled();
  await page.getByRole('button', { name: 'Change session meeting date' }).click();
  await page.getByRole('button', { name: /^All \(/ }).click();
  await page.getByRole('option').filter({ hasText: 'Sep 23' }).click();
  await page.getByRole('button', { name: 'Close session flyout' }).click();
  await expect(page.getByLabel('Book / Study Topic', { exact: true })).toHaveValue('Gospel of John');
  await expect(page.getByLabel('Chapter / Lesson', { exact: true })).toHaveValue('Chapter 1');
  await expect(update).not.toBeChecked();
  await expect(update).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel('Book / Study Topic', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Update Verified Attendance', exact: true })).toBeVisible();
  await page.getByText('Grace Reyes', { exact: true }).last().scrollIntoViewIfNeeded();
  await expect(page.getByText('Grace Reyes', { exact: true }).last()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('roll-call-mobile.png') });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
});

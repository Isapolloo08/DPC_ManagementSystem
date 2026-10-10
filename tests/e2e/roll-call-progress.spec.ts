import { test, expect } from '@playwright/test';
test.use({ timezoneId: 'Asia/Manila' });

for (const role of ['Pastor', 'Leader']) {
test(`${role} roll call saves allowed progress and preserves historical lessons`, async ({ page }, testInfo) => {
  page.on('dialog', dialog => dialog.accept());
  await page.clock.setFixedTime(new Date('2026-10-06T04:00:00Z'));
  const group = { id: 11, name: 'My Study Group', leader_name: 'Test Pastor', status: 'active', members: [{ id: 2, member_id: 2, member_name: 'Grace Reyes' }], category: 'General', curriculum: 'Romans', current_chapter: 'Chapter 2', progress_stage: 'midway', progress_notes: 'Chapter 2, page 12', meeting_day: 'Wednesday', meeting_time: '7:00 PM - 8:00 PM', max_capacity: 12 };
  const sessions = [{ session_date: '2026-09-23', topic_title: 'Gospel of John', chapter: 'Chapter 1', progress_stage: 'review', notes: 'Previous book', attendees: [{ member_id: 2 }] }];
  const saves: any[] = [];
  let failSave = true;
  await page.addInitScript(role => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
    localStorage.setItem('dpc_theme_mode', 'dark');
    localStorage.setItem(`dpc_help_welcome_v1:1:${role}`, 'seen');
  }, role);
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Pastor', username: 'pastor', role_name: role, ministries: [] } };
    else if (path.endsWith('/groups/mine')) json = [group];
    else if (path.endsWith('/dishwashing/schedule')) json = { schedule: [] };
    else if (path.endsWith('/study-topics')) json = { topics: [{ id: 1, title: 'Romans', total_chapters: 16 }, { id: 2, title: 'Gospel of John', total_chapters: 21 }], total_count: 2 };
    else if (path.endsWith('/groups/11/attendance')) {
      if (route.request().method() === 'POST') {
        const data = route.request().postDataJSON();
        saves.push(data);
        if (failSave) return route.fulfill({ status: 500, json: { error: 'Attendance save failed; try again.' } });
        if (data.update_group_progress) { group.curriculum = data.topic_title; group.current_chapter = data.chapter; group.progress_stage = data.progress_stage; group.progress_notes = data.notes; }
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
  if (role === 'Leader') await expect(page.locator('aside').getByRole('button', { name: /Books\/Topics/ })).toHaveCount(0);
  else await expect(page.locator('aside').getByRole('button', { name: /Books\/Topics/ })).toBeVisible();
  await expect(page.locator('aside').getByTitle('Saturday Duty Roster', { exact: true })).toBeVisible();
  await expect(page.locator('aside').getByTitle('Dishwashing Roster', { exact: true })).toBeVisible();
  await page.locator('aside').getByTitle('My Bible Study Group', { exact: true }).click();
  await page.getByRole('button', { name: 'Take Weekly Roll-Call', exact: true }).click();
  await expect(page.getByLabel('Book / Study Topic', { exact: true })).toHaveValue('Romans');
  await expect(page.getByLabel('Chapter / Lesson', { exact: true })).toHaveValue('Chapter 2');
  const update = page.getByRole('checkbox', { name: /Update the group's current (book|chapter)/ });
  await expect(update).toBeChecked();
  await expect(page.getByLabel('Study progress stage')).toHaveValue('midway');
  const notice = page.getByLabel('Lesson Notice & Specific Location (Saan Banda Sila)');
  await expect(notice).toHaveValue('Chapter 2, page 12');
  await expect(page.getByLabel('Chapter / Lesson').locator('option')).toHaveCount(16);
  const expectedBook = role === 'Leader' ? 'Romans' : 'Gospel of John';
  if (role === 'Leader') {
    await expect(page.getByLabel('Book / Study Topic')).toHaveAttribute('readonly', '');
    await expect(page.getByRole('combobox', { name: 'Book / Study Topic' })).toHaveCount(0);
  } else {
    await page.getByLabel('Book / Study Topic', { exact: true }).selectOption('Gospel of John');
    await expect(page.getByLabel('Chapter / Lesson').locator('option')).toHaveCount(21);
    await expect(page.getByLabel('Chapter / Lesson')).toHaveValue('Chapter 1');
    await expect(page.getByLabel('Study progress stage')).toHaveValue('intro');
  }
  await page.getByLabel('Chapter / Lesson', { exact: true }).selectOption('Chapter 3');
  await page.getByLabel('Study progress stage').selectOption('exam');
  await notice.fill('Chapter 3, page 18, question #3');
  await page.screenshot({ path: testInfo.outputPath('roll-call-progress-desktop.png') });
  await page.getByRole('button', { name: 'Log Verified Attendance', exact: true }).click();
  await expect(page.getByText('Attendance save failed; try again.', { exact: true })).toBeVisible();
  const toast = page.locator('[aria-live="polite"]');
  await expect(toast.getByText('Attendance save failed; try again.', { exact: true })).toBeVisible();
  await toast.getByTitle('Close', { exact: true }).click();
  await expect(page.getByLabel('Chapter / Lesson', { exact: true })).toHaveValue('Chapter 3');
  await expect(page.getByLabel('Study progress stage')).toHaveValue('exam');
  await expect(notice).toHaveValue('Chapter 3, page 18, question #3');
  failSave = false;
  await page.getByRole('button', { name: 'Log Verified Attendance', exact: true }).click();
  await expect(page.getByLabel('Chapter / Lesson', { exact: true })).toHaveCount(0);
  await expect(toast.getByText(/Weekly Roll-Call.*saved successfully!/)).toBeVisible();
  await expect(page.locator('.space-y-6.pb-12').getByText(/Weekly Roll-Call.*saved successfully!/)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('roll-call-success-toast.png') });
  await toast.getByTitle('Close', { exact: true }).click();
  expect(saves.at(-1)).toMatchObject({ session_date: '2026-09-30', topic_title: expectedBook, chapter: 'Chapter 3', progress_stage: 'exam', notes: 'Chapter 3, page 18, question #3', update_group_progress: true, present_member_ids: [2] });
  sessions.push({ session_date: '2026-09-30', topic_title: expectedBook, chapter: 'Chapter 3', progress_stage: 'exam', notes: 'Chapter 3, page 18, question #3', attendees: [{ member_id: 2 }] });
  await page.getByRole('button', { name: 'Take Weekly Roll-Call', exact: true }).click();
  // Opening roll call must keep the latest logged meeting selected, not an older gap.
  await expect(update).toBeChecked();
  await expect(update).toBeEnabled();
  await update.uncheck();
  await expect(update).not.toBeChecked();
  await update.check();
  await expect(update).toBeChecked();
  await page.getByLabel('Chapter / Lesson', { exact: true }).selectOption('Chapter 4');
  await page.getByLabel('Study progress stage').selectOption('chapter_completed');
  await notice.fill('Chapter 4 finished; discussion next meeting.');
  await page.getByRole('button', { name: 'Update Verified Attendance', exact: true }).click();
  await expect(update).toHaveCount(0);
  expect(saves.at(-1)).toMatchObject({ session_date: '2026-09-30', chapter: 'Chapter 4', progress_stage: 'chapter_completed', notes: 'Chapter 4 finished; discussion next meeting.', update_group_progress: true });
  expect(group).toMatchObject({ current_chapter: 'Chapter 4', progress_stage: 'chapter_completed', progress_notes: 'Chapter 4 finished; discussion next meeting.' });
  await page.getByRole('button', { name: 'Take Weekly Roll-Call', exact: true }).click();
  await page.getByRole('button', { name: 'Change session meeting date' }).click();
  await page.getByRole('button', { name: /^All \(/ }).click();
  // Explicitly selecting an older missing session still preserves current progress.
  await page.getByRole('option').filter({ hasText: 'Sep 16' }).click();
  await expect(update).not.toBeChecked();
  await expect(update).toBeDisabled();
  await expect(page.getByText(/A newer attendance session exists/)).toBeVisible();
  // A saved Wednesday must match its original date, rather than becoming a missing Tuesday.
  await page.getByRole('option').filter({ hasText: 'Sep 30' }).click();
  await expect(page.getByRole('button', { name: 'Update Verified Attendance', exact: true })).toBeVisible();
  await expect(page.getByLabel('Chapter / Lesson', { exact: true })).toHaveValue('Chapter 3');
  await expect(notice).toHaveValue('Chapter 3, page 18, question #3');
  await page.getByRole('option').filter({ hasText: 'Sep 23' }).click();
  await page.getByRole('button', { name: 'Close session flyout' }).click();
  await expect(page.getByLabel('Book / Study Topic', { exact: true })).toHaveValue('Gospel of John');
  await expect(page.getByLabel('Chapter / Lesson', { exact: true })).toHaveValue('Chapter 1');
  await expect(page.getByLabel('Study progress stage')).toHaveValue('review');
  await expect(notice).toHaveValue('Previous book');
  if (role === 'Leader') await expect(page.getByLabel('Book / Study Topic')).toHaveAttribute('readonly', '');
  await expect(update).not.toBeChecked();
  await expect(update).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel('Book / Study Topic', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Update Verified Attendance', exact: true })).toBeVisible();
  await page.getByText('Grace Reyes', { exact: true }).last().scrollIntoViewIfNeeded();
  await expect(page.getByText('Grace Reyes', { exact: true }).last()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('roll-call-mobile.png') });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Every visible entry point opens the same roll-call form without saving on open.
  const saveCount = saves.length;
  for (const tab of ['my-group-meetings', 'my-group-attendance']) {
    await page.locator(`[data-guide="${tab}"]`).click();
    await page.getByRole('button', { name: 'Take Weekly Roll-Call', exact: true }).click();
    await expect(page.getByText('Edit Session Attendance', { exact: true })).toBeVisible();
    await expect(notice).toBeVisible();
    await expect(page.getByLabel('Chapter / Lesson', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  expect(saves).toHaveLength(saveCount);
});
}

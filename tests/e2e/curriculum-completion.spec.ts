import { test, expect } from '@playwright/test';
import { getCurriculumCompletion } from '../../client/src/utils/curriculumCompletion';
import type { BibleStudyGroup } from '../../client/src/types';

const group: BibleStudyGroup = {
  id: 11, name: 'Completion Test Group', description: null, curriculum: 'Discipleship Training 2', ministry_id: null,
  leader_name: 'Test Leader', leader_contact: null, meeting_day: 'Wednesday', meeting_time: '7:00 PM', location: 'Room 1',
  category: 'General', max_capacity: 12, members: [], status: 'active', current_chapter: 'Chapter 12', curriculum_total_chapters: 12, progress_stage: 'intro',
};

for (const stage of ['intro', 'in_progress', 'midway', 'application', 'review', 'exam']) {
  test(`last chapter at ${stage} remains 91.7%`, () => {
    expect(getCurriculumCompletion({ ...group, progress_stage: stage })).toMatchObject({ current: 12, finished: 11, percent: 91.7, complete: false });
  });
}

test('chapter completion counts only finished chapters and preserves formal study completion', () => {
  expect(getCurriculumCompletion({ ...group, current_chapter: 'Chapter 1' }).percent).toBe(0);
  expect(getCurriculumCompletion({ ...group, current_chapter: 'Chapter 3' }).percent).toBe(16.7);
  expect(getCurriculumCompletion({ ...group, current_chapter: 'Chapter 3', progress_stage: 'chapter_completed' }).percent).toBe(25);
  expect(getCurriculumCompletion({ ...group, progress_stage: 'chapter_completed' })).toMatchObject({ finished: 12, percent: 100, complete: false });
  expect(getCurriculumCompletion({ ...group, status: 'completed' })).toMatchObject({ percent: 100, complete: true });
  expect(getCurriculumCompletion({ ...group, progress_stage: 'completed' }).percent).toBe(100);
  expect(getCurriculumCompletion({ ...group, current_chapter: 'Review / Q&A', progress_stage: 'review' }).percent).toBe(91.7);
  expect(getCurriculumCompletion({ ...group, current_chapter: 'Introduction' }).percent).toBe(0);
  expect(getCurriculumCompletion({ ...group, current_chapter: 'Chapter 99' }).percent).toBe(91.7);
  expect(getCurriculumCompletion(null).percent).toBe(0);
});

for (const theme of ['light', 'dark']) {
  test(`dashboard shows completion and current stage in ${theme}`, async ({ page }, info) => {
    let stage = 'intro';
    await page.addInitScript(theme => {
      sessionStorage.setItem('dpc_intro_shown', 'true');
      localStorage.setItem('dpc_theme_mode', theme);
      localStorage.setItem('dpc_help_welcome_v1:1:Leader', 'seen');
      localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
    }, theme);
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let json: unknown = [];
      if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
      else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Leader', role_name: 'Leader', ministries: [] } };
      else if (path.endsWith('/groups/mine')) json = [{ ...group, progress_stage: stage }];
      else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
      else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
      else if (path.endsWith('/dishwashing/schedule')) json = { schedule: [] };
      else if (path.endsWith('/study-topics')) json = { topics: [], total_count: 0 };
      await route.fulfill({ json });
    });
    await page.goto('/');
    await page.locator('aside').getByTitle('My Bible Study Group', { exact: true }).click();
    const bar = page.getByRole('progressbar', { name: 'Discipleship curriculum progress', exact: true });
    const card = bar.locator('..').locator('..').locator('..');
    await expect(bar).toHaveAttribute('aria-valuenow', '91.7');
    await expect(card).toContainText('Introduction / Starting');
    await expect(card).toContainText('11 of 12 chapters finished');
    await expect(card).toContainText('Curriculum completion');
    await card.screenshot({ path: info.outputPath(`completion-${theme}.png`) });
    stage = 'chapter_completed';
    await page.reload();
    await page.locator('aside').getByTitle('My Bible Study Group', { exact: true }).click();
    await expect(bar).toHaveAttribute('aria-valuenow', '100');
    await expect(card).toContainText('Chapter finished');
    await expect(card).toContainText('12 of 12 chapters finished');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(card).toContainText('100%');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

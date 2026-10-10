import { test, expect } from '@playwright/test';

for (const theme of ['light', 'dark']) {
  test(`chapter update fetches books and restores chapter stages (${theme})`, async ({ page }, info) => {
    const group = { id: 11, name: 'Discipleship group', status: 'active', curriculum: 'Discipleship Training 2', curriculum_total_chapters: 8, current_chapter: 'Chapter 5', progress_stage: 'midway', progress_notes: 'Continue discussion', meeting_day: 'Wednesday', meeting_time: '7:00 PM', category: 'General', leader_name: 'Test Pastor', member_count: 1, members: [] };
    const writes: any[] = [];
    let fail = true;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(theme => {
      sessionStorage.setItem('dpc_intro_shown', 'true');
      localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
      localStorage.setItem('dpc_theme_mode', theme);
      localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
    }, theme);
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let json: any = [];
      if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
      else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Admin', email: 'admin@example.test', username: 'admin', role_name: 'Admin', ministries: [] } };
      else if (path.endsWith('/groups/11') && route.request().method() === 'PUT') {
        const payload = route.request().postDataJSON();
        writes.push(payload);
        if (fail) return route.fulfill({ status: 500, json: { error: 'Try saving again' } });
        Object.assign(group, payload, { curriculum_total_chapters: payload.curriculum === 'Foundations' ? 3 : 8 });
        json = { message: 'Saved' };
      }
      else if (path.endsWith('/groups')) json = [group];
      else if (path.endsWith('/study-topics')) json = { topics: [{ id: 1, title: 'Discipleship Training 2', total_chapters: 8 }, { id: 2, title: 'Foundations', total_chapters: 3 }], total_count: 2 };
      else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
      else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
      else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
      else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
      else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
      await route.fulfill({ json });
    });
    await page.goto('/');
    await page.locator('aside').getByTitle('Bible Study Groups', { exact: true }).click();
    await page.getByRole('button', { name: 'Update Chapter', exact: true }).click();
    const form = page.locator('[data-guide="group-progress-form"]');
    const chapter = form.getByLabel('Chapter / Lesson');
    const stage = form.getByLabel('Study progress stage');
    await expect(chapter).toHaveValue('Chapter 5');
    await expect(chapter.locator('option')).toHaveCount(8);
    await expect(stage).toHaveValue('midway');
    await form.getByLabel('Book / Study Topic').selectOption('Foundations');
    await expect(chapter).toHaveValue('Chapter 1');
    await expect(chapter.locator('option')).toHaveCount(3);
    await expect(stage).toHaveValue('intro');
    await chapter.selectOption('Chapter 2');
    await stage.selectOption('review');
    const notice = form.getByLabel('Lesson Notice & Specific Location (Saan Banda Sila)');
    const savedNotice = 'Chapter 2, page 18, question #3';
    await notice.fill(savedNotice);
    await page.screenshot({ path: info.outputPath(`chapter-progress-${theme}.png`) });
    await page.getByRole('button', { name: 'Save Chapter Progress' }).click();
    await expect(page.getByText('Try saving again', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Okay', exact: true }).click();
    await expect(chapter).toHaveValue('Chapter 2');
    await expect(stage).toHaveValue('review');
    await expect(notice).toHaveValue(savedNotice);
    fail = false;
    await page.getByRole('button', { name: 'Save Chapter Progress' }).click();
    await expect(form).toHaveCount(0);
    expect(writes.at(-1)).toMatchObject({ curriculum: 'Foundations', current_chapter: 'Chapter 2', progress_stage: 'review', progress_notes: savedNotice });
    expect(group.status).toBe('active');
    await page.getByRole('button', { name: 'Update Chapter', exact: true }).click();
    await expect(chapter).toHaveValue('Chapter 2');
    await expect(stage).toHaveValue('review');
    await expect(notice).toHaveValue(savedNotice);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(form.getByLabel('Book / Study Topic')).toBeVisible();
    await expect(stage).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Chapter Progress' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`chapter-progress-mobile-${theme}.png`) });
    await stage.selectOption('chapter_completed');
    await page.getByRole('button', { name: 'Save Chapter Progress' }).click();
    await expect(form).toHaveCount(0);
    expect(writes.at(-1).progress_stage).toBe('chapter_completed');
    expect(group.status).toBe('active');
    expect(errors).toEqual([]);
  });
}

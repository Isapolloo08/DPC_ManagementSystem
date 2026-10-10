import { test, expect } from '@playwright/test';

const noticeLabel = 'Lesson Notice & Specific Location (Saan Banda Sila)';
for (const [role, theme] of [['Leader', 'light'], ['Leader', 'dark'], ['Coordinator', 'light']]) {
  test(`${role} updates study details and the specific lesson location (${theme})`, async ({ page }, info) => {
    const group = { id: 11, name: 'Discipleship Group', status: 'active', curriculum: 'Discipleship Training 2', curriculum_total_chapters: 12,
      current_chapter: 'Chapter 2', progress_stage: 'in_progress', progress_notes: 'Chapter 2, page 12', leader_name: 'Test Facilitator',
      meeting_day: 'Wednesday', meeting_time: '7:00 PM - 8:30 PM', location: 'Room 1', category: 'General', max_capacity: 12, members: [] };
    const writes: { path: string; data: any }[] = [];
    let fail = true;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ role, theme }) => {
      sessionStorage.setItem('dpc_intro_shown', 'true');
      localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
      localStorage.setItem('dpc_theme_mode', theme);
      localStorage.setItem(`dpc_help_welcome_v1:1:${role}`, 'seen');
    }, { role, theme });
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let json: any = [];
      if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
      else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Facilitator', email: 'test@example.test', username: 'test', role_name: role, ministries: [] } };
      else if (path.endsWith('/groups/11') && route.request().method() === 'PUT') {
        const data = route.request().postDataJSON();
        writes.push({ path, data });
        if (fail) return route.fulfill({ status: 500, json: { error: 'Study save failed; try again' } });
        Object.assign(group, data);
        json = { message: 'Saved' };
      }
      else if (path.endsWith('/groups/mine')) json = [group];
      else if (path.endsWith('/study-topics')) json = { topics: [{ id: 1, title: 'Discipleship Training 2', total_chapters: 4 }, { id: 2, title: 'Foundations', total_chapters: 3 }], total_count: 2 };
      else if (path.endsWith('/dishwashing/schedule')) json = { schedule: [] };
      else if (path.endsWith('/lookups')) json = [{ id: 1, name: 'Room 1', is_active: true }];
      else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
      else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
      else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
      else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
      else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
      await route.fulfill({ json });
    });
    await page.goto('/');
    await page.locator('aside').getByTitle('My Bible Study Group', { exact: true }).click();
    await page.locator('[data-guide="my-group-meetings"]').click();
    await page.getByRole('button', { name: 'Update Progress & Schedule', exact: true }).click();
    const form = page.locator('[data-guide="leader-study-form"]');
    const book = form.getByLabel('Book / Study Topic');
    const chapter = form.getByLabel('Chapter / Lesson');
    const stage = form.getByLabel('Study progress stage');
    const notice = form.getByLabel(noticeLabel);
    await expect(book).toHaveValue('Discipleship Training 2');
    await expect(chapter.locator('option')).toHaveCount(4);
    await expect(stage).toHaveValue('in_progress');
    await expect(notice).toHaveValue('Chapter 2, page 12');
    if (role === 'Leader') {
      await expect(book).toHaveAttribute('readonly', '');
      await expect(form.getByRole('combobox', { name: 'Book / Study Topic' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Update Book & Progress' })).toHaveCount(0);
    } else {
      await book.selectOption('Foundations');
      await expect(chapter.locator('option')).toHaveCount(3);
    }
    await chapter.selectOption('Chapter 3');
    await stage.selectOption('exam');
    const savedNotice = 'Chapter 3, verses 1–17; page 18, question #3. Review next meeting.';
    await notice.fill(savedNotice);
    await page.screenshot({ path: info.outputPath(`study-details-${role}-${theme}.png`) });
    await page.getByRole('button', { name: 'Save Study Changes', exact: true }).click();
    await expect(page.getByText('Study save failed; try again', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Okay', exact: true }).click();
    await expect(notice).toHaveValue(savedNotice);
    await expect(stage).toHaveValue('exam');
    fail = false;
    await page.getByRole('button', { name: 'Save Study Changes', exact: true }).click();
    await expect(form).toHaveCount(0);
    expect(writes.at(-1)?.data).toMatchObject({ current_chapter: 'Chapter 3', progress_stage: 'exam', progress_notes: savedNotice, meeting_day: 'Wednesday', meeting_time: '7:00 PM - 8:30 PM' });
    if (role === 'Leader') expect(writes.at(-1)?.data).not.toHaveProperty('curriculum');
    else expect(writes.at(-1)?.data.curriculum).toBe('Foundations');
    await expect(page.getByText(savedNotice, { exact: true })).toBeVisible();
    await expect(page.getByText('Exam / Assessment', { exact: true })).toBeVisible();
    await page.locator('[data-guide="my-group-overview"]').click();
    await expect(page.getByText(savedNotice, { exact: true })).toBeVisible();
    await page.locator('[data-guide="my-group-meetings"]').click();
    await page.getByRole('button', { name: 'Update Progress & Schedule', exact: true }).click();
    await expect(notice).toHaveValue(savedNotice);
    await page.setViewportSize({ width: 390, height: 844 });
    await notice.scrollIntoViewIfNeeded();
    await expect(notice).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Study Changes', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`study-details-mobile-${role}-${theme}.png`) });
    await notice.fill('');
    await page.getByRole('button', { name: 'Save Study Changes', exact: true }).click();
    await expect(form).toHaveCount(0);
    expect(writes.at(-1)?.data.progress_notes).toBe('');
    expect(writes.every(write => write.path === '/api/groups/11')).toBe(true);
    expect(errors).toEqual([]);
  });
}

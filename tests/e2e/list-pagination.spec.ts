import { test, expect } from '@playwright/test';

test('large lists request only the selected page, search beyond it, and keep global history totals', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
    localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
  });
  const logs = Array.from({ length: 205 }, (_, i) => ({ id: i + 1, user_name: 'Test Admin', role_name: 'Admin', action: 'CREATE', target_table: 'members', target_id: i + 1, details: `Record ${i + 1}`, created_at: '2026-10-10T01:00:00Z' }));
  const group = { id: 11, name: 'Discipleship group', status: 'active', curriculum: 'Romans', current_chapter: 'Chapter 5', progress_stage: 'midway', meeting_day: 'Wednesday', meeting_time: '7:00 PM', category: 'General', leader_name: 'Test Leader', current_member_count: 2, members: [] };
  const sessions = Array.from({ length: 120 }, (_, i) => ({ id: i + 1, session_date: new Date(Date.UTC(2026, 9, 7 - i * 7)).toISOString().slice(0, 10), topic_title: 'Romans', chapter: `Chapter ${i + 1}`, progress_stage: 'review', notes: `Lesson ${i + 1}`, recorded_by_name: 'Test Leader', present_count: 2, absent_count: 0, excused_count: 0, attendees: [], absentees: [], excused: [] }));
  const users = Array.from({ length: 65 }, (_, i) => ({ id: i + 1, name: `User ${i + 1}`, username: `user${i + 1}`, email: `user${i + 1}@example.test`, role_name: 'Leader', ministries: [], created_at: '2026-10-01T01:00:00Z' }));
  const books = Array.from({ length: 65 }, (_, i) => ({ id: i + 1, title: `Book ${i + 1}`, total_chapters: 12, summary_notes: '', group_counts: { active: 0, completed: 0, ongoing: 0, merged: 0 }, group_preview: [] }));
  const bulletins = Array.from({ length: 65 }, (_, i) => ({ id: i + 1, title: `Bulletin ${i + 1}`, body: 'Church announcement', is_pinned: 0, author_name: 'Test Admin', author_role: 'Admin', created_at: '2026-10-01T01:00:00Z' }));
  const households = Array.from({ length: 65 }, (_, i) => ({ id: i + 1, name: `Household ${i + 1}`, members: [], family_members: [] }));
  const requests: { path: string; page: number; limit: number; search: string }[] = [];
  const paged = (records: any[], url: URL) => {
    const limit = Number(url.searchParams.get('limit') || 30);
    const totalPages = Math.max(1, Math.ceil(records.length / limit));
    const current = Math.min(Number(url.searchParams.get('page') || 1), totalPages);
    requests.push({ path: url.pathname, page: current, limit, search: url.searchParams.get('search') || '' });
    return { data: records.slice((current - 1) * limit, current * limit), pagination: { page: current, limit, total: records.length, totalPages } };
  };
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Admin', email: 'admin@example.test', role_name: 'Admin', ministries: [] } };
    else if (path.endsWith('/audit')) {
      const search = url.searchParams.get('search');
      const matches = search ? logs.filter(log => log.details === search) : logs;
      json = { ...paged(matches, url), summary: { total: 205, creates: 205, updates: 0, deletes: 0, uniqueOperators: 1 }, options: { actions: ['CREATE'], entities: ['MEMBERS'], operators: ['Test Admin'], roles: ['Admin'] } };
    } else if (path.endsWith('/groups/11/attendance')) {
      const search = url.searchParams.get('search');
      json = { ...paged(search ? sessions.filter(session => session.notes === search) : sessions, url), history_summary: { total: 120, latest: sessions[0].session_date }, options: { books: ['Romans', 'John'], stages: ['review', 'intro'] } };
    } else if (path.endsWith('/groups')) json = url.searchParams.has('page') ? { ...paged([group], url), summary: { active: 1, completed: 0, archived: 0, all: 1, enrolled: 2 } } : [group];
    else if (path.endsWith('/users')) json = url.searchParams.has('page') ? { ...paged(users, url), summary: { total: 65, leader: 65 } } : users;
    else if (path.endsWith('/study-topics')) {
      if (url.searchParams.has('page')) { const result = paged(books, url); json = { topics: result.data, pagination: result.pagination, total_count: 65, summary: { totalBooks: 65, totalChapters: 780, totalGroups: 0, groupsDone: 0, groupsOngoing: 0 } }; }
      else json = { topics: books, total_count: 65 };
    }
    else if (path.endsWith('/communications/announcements')) json = paged(bulletins, url);
    else if (path.endsWith('/members')) json = url.searchParams.has('page') ? paged([], url) : [];
    else if (path.endsWith('/households')) json = url.searchParams.has('page') ? paged(households, url) : households;
    else if (path.endsWith('/notifications')) json = { items: [], total: 0, totalPages: 1 };
    else if (path.endsWith('/notifications/unread-count')) json = { count: 0 };
    else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    await route.fulfill({ json });
  });
  await page.goto('/');
  await page.locator('aside').getByTitle('System Audit Logs', { exact: true }).click();
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(30);
  const pager = page.getByRole('navigation', { name: 'audit events pagination' });
  await expect(pager).toContainText('of 205');
  await pager.getByRole('button', { name: 'Next audit events page' }).click();
  await expect(rows.first()).toContainText('Record 31');
  await page.getByLabel('audit events rows per page').selectOption('10');
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toContainText('Record 1');
  await page.getByLabel('Search audit logs').fill('Record 205');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Record 205');
  await expect(pager).toContainText('of 1');
  await page.getByLabel('Search audit logs').fill('no matches');
  await expect(page.getByText('No matching audit records found')).toBeVisible();
  await expect(pager).toContainText('0–0');
  await page.getByLabel('Search audit logs').fill('');
  await expect(rows).toHaveCount(10);
  await page.screenshot({ path: info.outputPath('audit-pagination.png') });
  expect(requests.some(req => req.path.endsWith('/audit') && req.page === 2 && req.limit === 30)).toBe(true);
  expect(requests.some(req => req.search === 'Record 205' && req.page === 1 && req.limit === 10)).toBe(true);

  for (const [title, label, firstOnNext] of [
    ['User Management', 'users', 'User 31'],
    ['Curriculum Books/Topics', 'books', 'Book 31'],
    ['Announcements', 'announcements', 'Bulletin 21'],
  ]) {
    await page.locator('aside').getByTitle(title, { exact: true }).click();
    const listPager = page.getByRole('navigation', { name: `${label} pagination` });
    await expect(listPager).toContainText('of 65');
    await listPager.getByRole('button', { name: `Next ${label} page` }).click();
    await expect(page.getByText(firstOnNext, { exact: true }).first()).toBeVisible();
    await listPager.getByLabel(`${label} rows per page`).selectOption('10');
    await expect(listPager).toContainText('Page 1 of 7');
  }
  await page.locator('aside').getByTitle('Members & Families', { exact: true }).click();
  await page.getByRole('button', { name: /Households \(/ }).click();
  const householdPager = page.getByRole('navigation', { name: 'households pagination' });
  await expect(householdPager).toContainText('of 65');
  await householdPager.getByRole('button', { name: 'Next households page' }).click();
  await expect(page.getByText('Household 21', { exact: true })).toBeVisible();

  await page.locator('aside').getByTitle('Bible Study Groups', { exact: true }).click();
  await page.getByRole('button', { name: 'Session History', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Session History' });
  await expect(dialog.getByRole('article')).toHaveCount(10);
  await expect(dialog.getByText('120 logged sessions', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Next sessions page' }).click();
  await expect(dialog.getByRole('article').first()).toContainText('Chapter 11');
  await expect(dialog.getByText('Latest session', { exact: true })).toHaveCount(0);
  await dialog.getByLabel('Search session history').fill('Lesson 120');
  await expect(dialog.getByRole('article')).toHaveCount(1);
  await expect(dialog.getByRole('article')).toContainText('Chapter 120');
  await expect(dialog.getByText('120 logged sessions', { exact: true })).toBeVisible();
  await dialog.locator('summary').filter({ hasText: 'Filter sessions' }).click();
  await expect(dialog.getByLabel('Filter sessions by book').locator('option')).toContainText(['All books', 'Romans', 'John']);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('history-pagination-mobile.png') });
  expect(errors).toEqual([]);
});

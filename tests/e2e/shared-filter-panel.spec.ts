import { test, expect, type Page } from '@playwright/test';
const group = { id: 11, name: 'Faith Group', leader_id: 1, leader_name: 'Preview User', members: [], status: 'active', category: 'General', ministry_id: 1, curriculum: 'Faith Foundations', meeting_day: 'Wednesday', meeting_time: '7:00 PM', location: 'Room 1', max_capacity: 12 };

async function prepare(page: Page, theme = 'light', role = 'Admin') {
  const errors: string[] = [], writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-09T14:00:00+08:00'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(({ theme, role }) => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('dpc_theme_mode', theme);
    localStorage.setItem(`dpc_help_welcome_v1:1:${role}`, 'seen');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
  }, { theme, role });
  const gates = new Map<string, { promise: Promise<void>; release: () => void }>();
  const state = {
    errors, writes,
    hold(path: string) { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); gates.set(path, { promise, release }); },
    release(path: string) { const gate = gates.get(path); gates.delete(path); gate?.release(); },
  };
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (gates.has(path)) await gates.get(path)!.promise;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
      writes.push(path); return route.fulfill({ status: 400, json: { error: 'Preview must not write records' } });
    }
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Preview User', email: 'preview@example.test', username: 'preview', role_name: role, ministries: [] } };
    else if (path.endsWith('/ministries')) json = [{ id: 1, name: 'Junior Adult', min_age: 36, max_age: 55, color: '#64748b', member_count: 0 }];
    else if (path.endsWith('/roles')) json = ['Admin', 'Pastor', 'Coordinator', 'Leader', 'Volunteer', 'Member', 'IT Admin'].map((name, i) => ({ id: i + 1, name, description: name }));
    else if (path.endsWith('/groups/mine')) json = [group];
    else if (path.endsWith('/reports/dashboard')) json = { metrics: { total_active_members: 0, total_households: 0, unenrolled_members_count: 0, upcoming_events_count: 0 }, ministry_breakdown: [] };
    else if (path.endsWith('/reports/growth-insights')) json = { baptisms: [], attendance_trends: [], groups_list: [], summary: {} };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0, total: 0, totalPages: 1 };
    else if (path.endsWith('/auth/profile-activity')) json = { attendanceCount: 0, groupsLed: [], groupsAttended: [], dutiesAssigned: [] };
    else if (path.endsWith('/planned-visits')) json = { items: [], total: 0, page: 1, totalPages: 1 };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], monthly_distribution: [], counts: { today: 0, this_week: 0, this_month: 0, next_30_days: 0 } };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: { total_qualified: 0, pending_nomination: 0 } };
    else if (path.endsWith('/duty/schedule') || path.endsWith('/dishwashing/schedule')) json = { schedule: [], total_teams: 0 };
    else if (path.endsWith('/services')) json = { services: [] };
    else if (path.endsWith('/attendance-log')) json = { rows: [], total: 0, summary: { total: 0, present: 0, absent: 0, excused: 0 } };
    else if (path.endsWith('/study-topics')) json = { topics: [], all: [], summary: {}, total: 0 };
    else if (path.endsWith('/events/recurring-sunday-cycle')) json = { events: [], year: 2026, summary: {} };
    else if (path.endsWith('/backup/summary')) json = { totalStats: {}, yearlyBreakdown: [] };
    else if (/\/groups\/\d+\/attendance-monitor$/.test(path)) json = { summary: {}, sessions: [], members: [] };
    await route.fulfill({ json });
  });
  await page.goto('/');
  await expect(page.locator(role === 'Admin' ? 'main .church-overview' : 'main [data-page-header]')).toBeVisible();
  return state;
}

async function navigate(page: Page, label: string) {
  if (await page.getByRole('button', { name: 'Toggle navigation menu' }).isVisible()) await page.getByRole('button', { name: 'Toggle navigation menu' }).click();
  await page.locator('aside').getByRole('button', { name: label, exact: true }).click();
}


const filterPages = ['Planned visits', 'Members & Families', 'Attendance Live', 'Attendance Log', 'Service Calendar', 'Bible Study Groups', 'Curriculum Books/Topics', 'Daily Bible Reading', 'Dishwashing Roster', 'Calendar', 'Events & Celebrations', 'Announcements', 'Analytics & Trends', 'User Management', 'System Audit Logs', 'Notifications'];
for (const theme of ['light', 'dark']) test('shared filters collapse without losing selections across pages (' + theme + ')', async ({ page }, info) => {
 test.setTimeout(180_000);
 const state = await prepare(page, theme);
 for (const label of filterPages) {
  await page.setViewportSize({width:1440,height:1000});
  await navigate(page, label);
  if (label === 'Daily Bible Reading') await page.locator('[data-guide="reading-calendar"]').click();
  const panels=page.locator('main .filter-panel');
  await expect(panels.first(), label).toBeVisible();
  for (const panel of await panels.all()) {
   await expect(panel.getByRole('button',{name:'Collapse filters',exact:true})).toBeVisible();
   const fields=panel.locator('.filter-panel-fields');
   const search = fields.locator('input[type="text"], input[type="search"], input:not([type])').first();
   if (await search.count()) await search.fill('Keep this selection');
   const before=await fields.locator('input, select').evaluateAll(nodes=>nodes.map(node=>(node as HTMLInputElement).value));
   await panel.getByRole('button',{name:'Collapse filters',exact:true}).click();
   await expect(fields).toBeHidden();
   await page.setViewportSize({width:390,height:844});
   const box=await panel.boundingBox();
   expect(box && box.x>=0 && box.x+box.width<=391, label+' collapsed bounds').toBeTruthy();
   await panel.getByRole('button',{name:'Expand filters',exact:true}).press('Enter');
   await expect(fields).toBeVisible();
   expect(await fields.locator('input, select').evaluateAll(nodes=>nodes.map(node=>(node as HTMLInputElement).value))).toEqual(before);
  }
  if (label === 'Members & Families') await expect(page.getByRole('button',{name:'Add Member',exact:true})).toBeVisible();
  if (label === 'Attendance Log' || label === 'Members & Families') await page.screenshot({path:info.outputPath(label+'-'+theme+'.png')});
 }
 expect(state.errors).toEqual([]);
});

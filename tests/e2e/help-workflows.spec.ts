import { test, expect, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { allTaskGuides, pageTours, workflowGuides } from '../../client/src/components/help/workflowGuides';
import { pageHelp } from '../../client/src/components/help/guideContent';
import { guideSupport } from '../../client/src/components/help/guidePrerequisites';

const roster = ['Ana', 'Ben', 'Carlo'].map((first_name, index) => ({
  member_id: index + 1, first_name, last_name: 'Santos', birthdate: '2005-01-01', gender: null,
  member_status: 'active', ministry_id: 1, ministry_name: 'Youth', ministry_color: '#64748b',
  household_id: 1, household_name: 'Santos', attendance_id: null, checked_in_at: null,
  checked_out_at: null, security_code: null, attendance_notes: null, is_present: 0, attendance_status: 'unmarked',
}));
const group = { id: 11, name: 'Faith Group', leader_name: 'Guide User', members: [], status: 'active', category: 'General', ministry_id: 1, curriculum: 'Faith Foundations', current_chapter: 'Chapter 1', meeting_day: 'Wednesday', meeting_time: '7:00 PM - 8:00 PM', location: 'Room 1', max_capacity: 12 };

async function prepare(page: Page, role = 'Admin') {
  const writes: string[] = [], errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-04T10:00:00+08:00'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(role => {
    if (location.search.includes('guide-demo=1')) return;
    sessionStorage.setItem('dpc_intro_shown', 'true');
    localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
    localStorage.setItem('dpc_theme_mode', 'dark');
    localStorage.setItem(`dpc_help_welcome_v1:1:${role}`, 'seen');
  }, role);
  await page.route('https://bible-api.com/**', route => route.fulfill({ json: { reference: 'Guide passage', verses: [{ verse: 1, text: 'Example text.' }] } }));
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writes.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 400, json: { error: 'Guide unexpectedly wrote data' } });
    }
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: true, hasAdmin: true, demoModeEnabled: false };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Guide User', email: 'guide@example.test', role_name: role, ministries: [] } };
    else if (path.endsWith('/ministries')) json = [{ id: 1, name: 'Youth', min_age: 17, max_age: 25, member_count: 3 }];
    else if (path.endsWith('/roles')) json = ['Admin', 'Pastor', 'Coordinator', 'Member', 'Leader', 'Volunteer', 'IT Admin'].map((name, index) => ({ id: index + 1, name, description: name }));
    else if (path.endsWith('/groups/mine')) json = [group];
    else if (path.endsWith('/reports/dashboard')) json = { metrics: { total_active_members: 3, total_households: 1, unenrolled_members_count: 3, upcoming_events_count: 0 }, ministry_breakdown: [] };
    else if (path.endsWith('/reports/growth-insights')) json = { baptisms: [], attendance_trends: [], groups_list: [], summary: {} };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/notifications/email-settings')) json = {};
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], monthly_distribution: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: 0, celebrants: [] })), counts: { today: 0, this_week: 0, this_month: 0, next_30_days: 0 } };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: { total_qualified: 0, pending_nomination: 0 } };
    else if (path.endsWith('/duty/schedule') || path.endsWith('/dishwashing/schedule')) json = { schedule: [], total_teams: 0 };
    else if (path.endsWith('/attendance/roster')) json = roster;
    else if (path.endsWith('/services')) json = { services: [] };
    else if (path.endsWith('/attendance-log')) json = { rows: [], total: 0, summary: { total: 0, present: 0, absent: 0, excused: 0 } };
    else if (path.endsWith('/study-topics')) json = { topics: [], all: [], summary: {}, total: 0 };
    else if (path.endsWith('/events/recurring-sunday-cycle')) json = { events: [], year: 2026, summary: {} };
    else if (path.endsWith('/backup/summary')) json = { totalStats: {}, yearlyBreakdown: [] };
    else if (/\/backup\/year-details\/\d+$/.test(path)) json = { success: true, year: 2026, tables: { attendance: [], events: [], duty_schedules: [] } };
    await route.fulfill({ json });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open Start Here' })).toBeVisible();
  return { writes, errors };
}

async function startTask(page: Page, id: string) {
  const task = allTaskGuides.find(guide => guide.id === id)!;
  await page.getByRole('button', { name: 'Open Start Here' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Find a guide').fill(task.title);
  await dialog.getByRole('button', { name: new RegExp(`^${task.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
  return page.getByRole('region', { name: task.title, exact: true });
}

test('every routed page and every workflow references real controls and safe openers', () => {
  const sources: string[] = [];
  function scan(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) scan(path);
      else if (entry.name.endsWith('.tsx')) sources.push(readFileSync(path, 'utf8'));
    }
  }
  scan('client/src');
  const anchors = new Set(sources.flatMap(source => [...source.matchAll(/data-guide="([^"]+)"/g)].map(match => match[1])));
  for (const tab of ['bible_study_categories', 'locations', 'ministries', 'events', 'communications', 'membership', 'backup_restore', 'notifications_email', 'general']) anchors.add(`settings-${tab}`);
  expect(Object.keys(pageTours).sort()).toEqual(Object.keys(pageHelp).sort());
  expect(Object.keys(guideSupport).sort()).toEqual(Object.keys(pageHelp).sort());
  for (const support of Object.values(guideSupport)) expect(anchors.has(support!.target), support!.target).toBe(true);
  expect(allTaskGuides.length).toBeGreaterThan(30);
  expect(new Set(allTaskGuides.map(task => task.id)).size).toBe(allTaskGuides.length);
  const safeOpeners = new Set(['group-edit', 'member-add', 'member-import', 'household-create', 'members-tab', 'households-tab', 'attendance-sunday', 'attendance-event', 'attendance-batch', 'attendance-guest', 'event-attendance-batch', 'group-create', 'group-progress', 'curriculum-new', 'calendar-agenda', 'celebration-new', 'duty-new', 'duty-teams-tab', 'duty-schedule-tab', 'duty-checklist-tab', 'duty-task-new', 'duty-guideline-new', 'washing-new', 'washing-teams-tab', 'dishwashing-schedule-tab', 'washing-protocols-tab', 'washing-protocol-new', 'washing-checklist-new', 'announcement-new', 'reports-demographics', 'users-new', 'service-new', 'profile-personal', 'profile-security', 'my-group-overview', 'my-group-add', 'my-group-bulletin', 'my-group-meetings', 'reading-open', 'reading-calendar', 'reading-photo', 'settings-general', 'settings-ministries', 'settings-ministry-new', 'settings-notifications_email', 'settings-backup_restore']);
  for (const steps of [...Object.values(pageTours), ...allTaskGuides.map(task => task.steps)]) {
    expect(steps.length).toBeGreaterThan(1);
    for (const step of steps) {
      expect(step.target, step.title).toBeTruthy();
      expect(step.target, step.title).not.toBe('workspace');
      expect(anchors.has(step.target!), `Missing anchor ${step.target}: ${step.title}`).toBe(true);
      for (const opener of typeof step.reveal === 'string' ? [step.reveal] : step.reveal ?? []) {
        expect(anchors.has(opener), `Missing opener ${opener}`).toBe(true);
        expect(safeOpeners.has(opener) || ['backup-open', 'restore-open'].includes(opener), `Unsafe guide action ${opener}`).toBe(true);
      }
    }
  }
  const batch = workflowGuides.find(task => task.id === 'batch-attendance')!;
  expect(batch.steps.map(step => step.target)).toEqual(expect.arrayContaining(['attendance-method-absent', 'attendance-method-present', 'attendance-method-selected', 'attendance-selection-tools', 'attendance-batch-save']));
});

const pages = [
  ['dashboard', 'System Dashboard'], ['members', 'Members & Families'], ['attendance', 'Attendance Live'], ['attendancelog', 'Attendance Log'],
  ['servicecalendar', 'Service Calendar'], ['biblestudy', 'Bible Study Groups'], ['leaderportal', 'My Bible Study Group'], ['curriculum', 'Curriculum Books/Topics'],
  ['biblereading', 'Daily Bible Reading'], ['duty', 'Saturday Duty Roster'], ['dishwashing', 'Dishwashing Roster'], ['events', 'Calendar'],
  ['sundaycycle', 'Events & Celebrations'], ['communications', 'Announcements'], ['reports', 'Analytics & Trends'], ['users', 'User Management'],
  ['audit', 'System Audit Logs'], ['settings', 'Settings & Backups'], ['notifications', 'Notifications'], ['profile', 'My Profile & Settings'],
] as const;
const emptyPages = new Set(['members', 'attendancelog', 'servicecalendar', 'biblestudy', 'curriculum', 'duty', 'dishwashing', 'events', 'sundaycycle', 'communications', 'users', 'audit', 'notifications']);
for (const [tab, label] of pages) {
  test(`${tab} page guide reaches its actual controls and explains missing records`, async ({ page }) => {
    const state = await prepare(page);
    await page.locator('aside').getByRole('button', { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
    await page.getByRole('button', { name: 'Open Start Here' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'How to use this page' }).click();
    const steps = pageTours[tab].filter(step => !step.roles || step.roles.includes('Admin'));
    if (emptyPages.has(tab)) {
      await expect(dialog.locator('.help-page-step')).toHaveCount(3);
      await expect(dialog).toContainText('Complete the setup for this page first');
      await dialog.locator('.help-page-step').last().click();
      const setup = page.getByRole('region', { name: pageHelp[tab].title, exact: true });
      await expect(setup).toHaveAttribute('data-guide-mode', 'setup');
      await expect(setup).toContainText('Step 3 of 3');
      await setup.getByRole('button', { name: 'Preview with sample data' }).click();
      await expect(dialog).toContainText('Saves affect this demo only');
      const frame = page.frameLocator('iframe[title="Interactive guide demo"]');
      const sampleGuide = frame.locator('.help-guide-panel');
      await expect(sampleGuide.locator('.help-step-navigation button')).toHaveCount(steps.length);
      for (const [index, step] of steps.entries()) {
        await sampleGuide.getByRole('button', { name: new RegExp(`^Go to step ${index + 1}:`) }).click();
        await expect(sampleGuide.getByRole('heading', { name: step.title, exact: true })).toBeVisible();
        await expect.poll(async () => await frame.locator(`[data-guide="${step.target}"][data-guide-highlight]`).count() > 0 || await sampleGuide.locator('.help-prerequisite').isVisible()).toBe(true);
      }
      await dialog.getByRole('button', { name: 'Close sample preview' }).click();
      await expect(setup).toContainText('Step 3 of 3');
      await setup.getByRole('button', { name: 'Close guide' }).click();
      expect(state.writes).toEqual([]);
      expect(state.errors).toEqual([]);
      return;
    }
    await expect(dialog.locator('.help-page-step')).toHaveCount(steps.length);
    // Starting at a numbered step must preserve its index, not restart at step 1.
    await dialog.locator('.help-page-step').last().click();
    const guide = page.getByRole('region', { name: pageHelp[tab].title, exact: true });
    await expect(guide).toContainText(`Step ${steps.length} of ${steps.length}`);
    for (const [index, step] of steps.entries()) {
      await guide.getByRole('button', { name: new RegExp(`^Go to step ${index + 1}:`) }).click();
      await expect(guide.getByRole('heading', { name: step.title, exact: true })).toBeVisible();
      // Tables can legitimately be empty; an explicit prerequisite must then be visible.
      await expect.poll(async () => await page.locator(`[data-guide="${step.target}"][data-guide-highlight]`).count() > 0 || await guide.locator('.help-prerequisite').isVisible()).toBe(true);
    }
    await guide.getByRole('button', { name: 'Close guide' }).click();
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
  });
}

test('batch guide opens controls on a direct jump and preserves method and selections', async ({ page }, testInfo) => {
  const state = await prepare(page);
  const guide = await startTask(page, 'batch-attendance');
  await guide.getByRole('button', { name: /Go to step 4:/ }).click();
  await expect(page.locator('[data-guide="attendance-method-absent"]')).toHaveAttribute('data-guide-highlight', 'true');
  await expect(page.locator('[data-guide="attendance-batch"]')).toHaveAttribute('aria-expanded', 'true');
  const row = page.locator('tbody tr').filter({ hasText: 'Ana Santos' });
  await row.getByRole('checkbox').check();
  await expect(row).toContainText('Will Mark Absent');
  await guide.getByRole('button', { name: /Go to step 5:/ }).click();
  await expect(page.locator('[data-guide="attendance-method-present"]')).toHaveAttribute('data-guide-highlight', 'true');
  await expect(row.getByRole('checkbox')).toBeChecked();
  await expect(row).toContainText('Will Mark Absent');
  await guide.getByRole('button', { name: /Go to step 10:/ }).click();
  await expect(page.locator('[data-guide="attendance-batch-save"]').first()).toHaveAttribute('data-guide-highlight', 'true');
  await expect(page.locator('[data-guide="attendance-batch-save"]').first()).toContainText('1 Absent, 2 Present');
  await guide.getByRole('button', { name: /Go to step 7:/ }).click();
  await expect(guide).toContainText('not the ministry scope');
  await page.locator('[data-guide="attendance-search"]').fill('Ana');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await guide.getByRole('button', { name: /Go to step 10:/ }).click();
  const save = page.locator('[data-guide="attendance-batch-save"]').first();
  await expect(save).toHaveAttribute('data-guide-highlight', 'true');
  await expect(save).toContainText('1 Absent, 2 Present');
  await expect.poll(async () => {
    const target = await save.boundingBox(), frame = await page.locator('.help-spotlight-frame').boundingBox();
    if (!target || !frame) return false;
    const x = target.x + target.width / 2, y = target.y + target.height / 2;
    return x >= frame.x && x <= frame.x + frame.width && y >= frame.y && y <= frame.y + frame.height;
  }).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('batch-guide-dark.png') });
  await guide.getByRole('button', { name: 'Finish guide' }).click();
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

for (const [id, index, target] of [
  ['household', 3, 'household-parents'], ['import-members', 1, 'import-file'], ['service-create', 2, 'service-date'],
  ['curriculum-create', 3, 'curriculum-lessons'], ['celebration-create', 2, 'celebration-kind'],
  ['duty-team', 3, 'duty-team-leader'], ['washing-team', 4, 'washing-team-leader'],
  ['publish-announcement', 3, 'announcement-audience'], ['user-create', 4, 'users-role'],
  ['church-settings', 1, 'settings-church-name'], ['reference-settings', 2, 'settings-ministry-form'],
  ['email-settings', 1, 'settings-email-form'], ['profile', 3, 'profile-password-form'],
  ['backup-download', 4, 'backup-auth'], ['restore-data', 1, 'restore-file'],
  ['backup-download', 3, 'backup-preview-tabs'],
  ['group-disciples', 3, 'my-group-add-form'],
] as const) {
  test(`${id} step ${index + 1} opens its prerequisites without saving`, async ({ page }) => {
    const state = await prepare(page);
    const guide = await startTask(page, id);
    await guide.getByRole('button', { name: new RegExp(`^Go to step ${index + 1}:`) }).click();
    await expect(page.locator(`[data-guide="${target}"][data-guide-highlight]`)).toBeVisible();
    await guide.getByRole('button', { name: 'Close guide' }).click();
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
  });
}

for (const [role, id, visible] of [
  ['Admin', 'backup-download', true], ['Pastor', 'backup-download', false],
  ['Leader', 'curriculum-create', true], ['Volunteer', 'batch-attendance', true],
  ['Member', 'batch-attendance', false],
] as const) {
  test(`${role} sees only authorized extended workflows (${id})`, async ({ page }) => {
    const state = await prepare(page, role);
    await page.getByRole('button', { name: 'Open Start Here' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Find a guide').fill(allTaskGuides.find(task => task.id === id)!.title);
    await expect(dialog.locator('.help-task-card')).toHaveCount(visible ? 1 : 0);
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
  });
}

for (const role of ['Leader', 'Volunteer']) {
  test(`${role} dashboard page tour follows their role-specific controls`, async ({ page }) => {
    const state = await prepare(page, role);
    await page.getByRole('button', { name: 'Open Start Here' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'How to use this page' }).click();
    await expect(dialog.locator('.help-page-step')).toHaveCount(3);
    await dialog.locator('.help-page-step').first().click();
    await expect(page.locator(`[data-guide="${role === 'Leader' ? 'leader-dashboard-summary' : 'volunteer-summary'}"]`)).toHaveAttribute('data-guide-highlight', 'true');
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
  });
}

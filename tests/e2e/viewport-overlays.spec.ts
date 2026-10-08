import { test, expect, type Page, type Locator } from '@playwright/test';

const event = { id: 7, title: 'Test fellowship', start_time: '2026-10-08T09:00:00', end_time: '2026-10-08T12:00:00', event_type: 'Special', status: 'active' };
const recurring = { id: 8, title: 'Test annual Sunday', month: 10, week_pattern: '2nd_sunday', is_active: true, projected_date: '2026-10-11', projected_formatted: 'October 11, 2026', color: '#64748b' };
const topic = { id: 3, title: 'Test curriculum book', total_chapters: 4, current_chapter: 1, is_active: 1 };

async function prepare(page: Page, theme = 'light', emptyInstallation = false) {
  const errors: string[] = [], writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(({ theme, emptyInstallation }) => {
    sessionStorage.setItem('dpc_intro_shown', 'true');
    if (!emptyInstallation) localStorage.setItem('chms_token', 'e30.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.test');
    localStorage.setItem('dpc_help_welcome_v1:1:Admin', 'seen');
    localStorage.setItem('dpc_theme_mode', theme);
  }, { theme, emptyInstallation });
  await page.route('https://bible-api.com/**', route => route.fulfill({ json: { reference: 'John 1', verses: [{ verse: 1, text: 'Test passage.' }] } }));
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
      writes.push(path);
      return route.abort();
    }
    let json: any = [];
    if (path.endsWith('/auth/setup-status')) json = { hasUsers: !emptyInstallation, hasAdmin: !emptyInstallation };
    else if (path.endsWith('/auth/me')) json = { user: { id: 1, name: 'Test Administrator', email: 'admin@example.test', role_name: 'Admin', ministries: [] } };
    else if (path.endsWith('/auth/profile-activity')) json = { attendanceCount: 0, groupsLed: [], groupsAttended: [], dutiesAssigned: [] };
    else if (path.endsWith('/reports/dashboard')) json = { metrics: {}, ministry_breakdown: [] };
    else if (path.endsWith('/settings/general')) json = { settings: {}, list: [] };
    else if (path.endsWith('/notifications')) json = { items: [], unread_count: 0 };
    else if (path.endsWith('/members/birthdays')) json = { celebrants: [], counts: {} };
    else if (path.endsWith('/members/baptism-candidates/qualified')) json = { candidates: [], counts: {} };
    else if (path.endsWith('/duty/schedule') || path.endsWith('/dishwashing/schedule')) json = { schedule: [] };
    else if (path.endsWith('/backup/summary')) json = { totalStats: {}, yearlyBreakdown: [] };
    else if (path.endsWith('/cloud-sync/status')) json = { configured: true, connected: true, cloudHost: 'test.example', comparison: [] };
    else if (path.endsWith('/services')) json = { services: [] };
    else if (path.endsWith('/events/recurring-sunday-cycle')) json = { events: [recurring], year: 2026, summary: {} };
    else if (path.endsWith('/events')) json = [event];
    else if (path.endsWith('/attendance-roster')) json = { event, attendees: [], summary: {} };
    else if (path.endsWith('/attendees')) json = [];
    else if (path.endsWith('/audit')) json = [{ id: 1, action: 'UPDATE', target_table: 'members', target_id: 1, created_at: '2026-10-08T10:00:00Z', user_name: 'Test Administrator' }];
    else if (path.endsWith('/study-topics')) json = { topics: [topic], all: [topic], summary: {}, total: 1 };
    else if (path.endsWith('/study-topics/3')) json = { topic, chapters: [], groups: [] };
    await route.fulfill({ json });
  });
  await page.goto('/');
  await expect(page.locator('[data-startup-phase="complete"]')).toBeVisible();
  return { errors, writes };
}

async function fullViewport(page: Page, overlay: Locator) {
  await expect(overlay).toBeVisible();
  await expect.poll(() => overlay.boundingBox()).toEqual({ x: 0, y: 0, ...page.viewportSize()! });
  // Test the painted hit area too, so a correct-sized layer hidden under the
  // navbar or sidebar cannot pass just by having the right dimensions.
  expect(await overlay.evaluate(element => [[2, 2], [innerWidth - 2, 2], [2, innerHeight - 2], [innerWidth - 2, innerHeight - 2]]
    .every(([x, y]) => { const hit = document.elementFromPoint(x, y); return hit === element || (hit !== null && element.contains(hit)); }))).toBe(true);
}

async function stage(page: Page, modulePath: string, exportName: string, props: Record<string, unknown> = {}) {
  // Render the real component inside the troublesome conditions: sibling
  // spacing, a transformed ancestor, a small scroll area, and page offsets.
  await page.evaluate(async ({ modulePath, exportName, props }) => {
    const importModule = new Function('url', 'return import(url)');
    const load = (path: string) => {
      // Use Vite's loaded module URLs, including HMR/version parameters, to
      // share the same React and context instances as the running app.
      const loaded = performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === path);
      return importModule(loaded?.name || path);
    };
    const [{ default: React }, clientModule, component, { AuthProvider }, { ToastProvider }, { GuideDataProvider }] = await Promise.all([
      load('/node_modules/.vite/deps/react.js'), load('/node_modules/.vite/deps/react-dom_client.js'), load('/src/' + modulePath),
      load('/src/context/AuthContext.tsx'), load('/src/context/ToastContext.tsx'), load('/src/components/help/GuideDataContext.tsx'),
    ]);
    const host = document.createElement('div');
    host.id = 'overlay-test-host';
    host.style.cssText = 'position:fixed;left:80px;top:100px;width:800px;height:450px;max-width:80vw;overflow:auto;transform:translateY(20px);z-index:45';
    document.body.append(host);
    const Component = component[exportName];
    const { createRoot } = clientModule.default || clientModule;
    createRoot(host).render(React.createElement(AuthProvider, null, React.createElement(ToastProvider, null,
      React.createElement(GuideDataProvider, null, React.createElement('div', { className: 'space-y-6' },
        React.createElement('div', null, 'Preceding content'), React.createElement(Component, { ...props, onClose: () => {}, onChange: () => {}, onSpecialChange: () => {} }))))));
  }, { modulePath, exportName, props });
  return page.locator('#overlay-test-host');
}

for (const theme of ['light', 'dark']) {
  test(`cloud sync and nested confirmations cover the app (${theme})`, async ({ page }, testInfo) => {
    const { errors, writes } = await prepare(page, theme);
    await page.locator('aside').getByRole('button', { name: /Settings & Backups/ }).click();
    await page.getByRole('button', { name: 'Backup & Data Management', exact: true }).click();
    await page.getByRole('button', { name: 'Manage cloud sync' }).click();
    const cloud = page.locator('[data-viewport-overlay]').filter({ hasText: 'Supabase Cloud Sync & Backup' });
    await fullViewport(page, cloud);
    await page.screenshot({ path: testInfo.outputPath(`cloud-backdrop-${theme}.png`) });
    await cloud.getByRole('button', { name: 'Push to Supabase Cloud' }).click();
    const confirmation = page.locator('[data-viewport-overlay]').filter({ hasText: 'Push Local Data to Supabase Cloud?' });
    await fullViewport(page, confirmation);
    await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(confirmation).toHaveCount(0);
    await cloud.getByRole('button', { name: 'Pull from Cloud' }).click();
    const pull = page.locator('[data-viewport-overlay]').filter({ hasText: 'Pull Data from Supabase Cloud?' });
    await fullViewport(page, pull);
    await pull.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await fullViewport(page, cloud);
    await cloud.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(cloud).toHaveCount(0);
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
  });
}

const cases = [
  { name: 'Bible alignment', path: 'components/bible/BibleScheduleAlignmentModal.tsx', exportName: 'BibleScheduleAlignmentModal', props: { isOpen: true } },
  { name: 'Scripture passage', path: 'components/common/ScripturePassageModal.tsx', exportName: 'ScripturePassageModal', props: { isOpen: true, dayReading: { chapters: [{ book: 'John', chapter: 1 }] } } },
  { name: 'Event attendance', path: 'components/common/EventAttendanceModal.tsx', exportName: 'EventAttendanceModal', props: { isOpen: true, event } },
  { name: 'Profile', path: 'components/profile/ProfileModal.tsx', exportName: 'ProfileModal', props: { isOpen: true } },
  { name: 'Bible printing', path: 'pages/BibleReadingPage.tsx', exportName: 'BibleReadingPage', button: 'Printable Guide' },
  { name: 'Special service', path: 'pages/ServiceCalendarPage.tsx', exportName: 'ServiceCalendarPage', button: 'Add Special Service' },
  { name: 'Audit inspection', path: 'pages/AuditPage.tsx', exportName: 'AuditPage', selector: '[data-guide="audit-inspect"]' },
  { name: 'Celebration editing', path: 'pages/SundayEventsCyclePage.tsx', exportName: 'SundayEventsCyclePage', button: 'Add Event / Celebration' },
  { name: 'Celebration scheduling', path: 'pages/SundayEventsCyclePage.tsx', exportName: 'SundayEventsCyclePage', selector: '[data-guide="celebration-sync"]' },
  { name: 'Walk-in attendance', path: 'components/attendance/EventAttendanceCheckInView.tsx', exportName: 'EventAttendanceCheckInView', props: { initialEventId: 7 }, button: '+ Add Walk-In' },
];

for (const item of cases) {
  test(`${item.name} backdrop escapes spacing, scrolling, and transforms`, async ({ page }) => {
    const { errors, writes } = await prepare(page);
    const host = await stage(page, item.path, item.exportName, item.props);
    if (item.button) await host.getByRole('button', { name: item.button, exact: true }).click();
    if (item.selector) await host.locator(item.selector).first().click();
    const overlay = page.locator('[data-viewport-overlay]');
    await fullViewport(page, overlay);
    await host.evaluate(element => { element.scrollTop = 200; });
    await fullViewport(page, overlay);
    await page.setViewportSize({ width: 390, height: 844 });
    await fullViewport(page, overlay);
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
  });
}

test('initial administrator setup covers the login screen', async ({ page }) => {
  const { errors, writes } = await prepare(page, 'dark', true);
  await fullViewport(page, page.locator('[data-viewport-overlay]'));
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});

test('mobile session sheet covers the viewport inside a dialog layout', async ({ page }) => {
  const { errors, writes } = await prepare(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await stage(page, 'components/biblestudy/SessionDatePicker.tsx', 'SessionDatePicker', {
    sessions: [], value: '2026-10-08', isSpecial: false, specialReason: '', isFlyoutOpen: true,
  });
  await fullViewport(page, page.locator('[data-viewport-overlay]'));
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});

test('mobile navigation shade covers the header and closes from the backdrop', async ({ page }) => {
  const { errors, writes } = await prepare(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Toggle navigation menu', exact: true }).click();
  const shade = page.locator('[data-viewport-overlay]');
  await expect(shade).toBeVisible();
  expect(await shade.boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 });
  await shade.click({ position: { x: 385, y: 500 } });
  await expect(shade).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});

test('mobile curriculum inspector shade covers the window and closes without blocking its panel', async ({ page }) => {
  const { errors, writes } = await prepare(page);
  await page.locator('aside').getByRole('button', { name: /Curriculum Book/ }).click();
  await expect(page.locator('[data-guide="curriculum-details"]')).toBeVisible();
  await page.setViewportSize({ width: 600, height: 844 });
  const shade = page.locator('[data-viewport-overlay]');
  await expect(shade).toBeVisible();
  expect(await shade.boundingBox()).toEqual({ x: 0, y: 0, width: 600, height: 844 });
  await page.getByRole('button', { name: 'Close Inspector', exact: true }).click();
  await expect(shade).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});

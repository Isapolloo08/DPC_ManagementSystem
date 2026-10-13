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
    else if (path.endsWith('/ministries')) json = [{ id: 1, name: 'Junior Adult', min_age: 36, max_age: 55, color: '#64748b', member_count: 0 }, { id: 2, name: 'Youth', min_age: 17, max_age: 21, color: '#22c55e', member_count: 0 }, { id: 3, name: 'Young Adult', min_age: 22, max_age: 35, color: '#6366f1', member_count: 0 }];
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
  await expect(page.locator(role === 'Admin' ? 'main .church-overview' : 'main')).toBeVisible();
  return state;
}

async function navigate(page: Page, label: string) {
  if (await page.getByRole('button', { name: 'Toggle navigation menu' }).isVisible()) await page.getByRole('button', { name: 'Toggle navigation menu' }).click();
  await page.locator('aside').getByRole('button', { name: label, exact: true }).click();
}

const token = 'a'.repeat(64);
test('future event attendance stays read-only until the Philippine event day',async({page})=>{
  const state=await prepare(page,'light','Coordinator');
  const event={id:33,title:'Tomorrow event',start_time:'2026-10-10T09:00:00+08:00',end_time:'2026-10-10T12:00:00+08:00'};
  const roster={event,can_manage_sunday_reflection:true,summary:{},attendees:[{member_id:7,first_name:'Maria',last_name:'Reyes',ministry_name:'Youth',status:'registered',attendance_confirmed:false}],guests:[{response_id:8,name:'Guest Visitor',answer:'yes',status:'unconfirmed',attendance_confirmed:false}]};
  await page.route('**/api/events*',route=>route.fulfill({json:[event]}));
  await page.route('**/api/attendance/roster*',route=>route.fulfill({json:[]}));
  await page.route('**/api/events/33/attendance-roster*',route=>route.fulfill({json:roster}));
  await navigate(page,'Attendance Live');await page.getByRole('button',{name:'Special Event Check-In',exact:true}).click();
  await expect(page.getByText(/Attendance can only be marked on 2026-10-10/)).toBeVisible();
  for(const person of ['Maria Reyes','Guest Visitor'])for(const name of ['Confirm present','Record absent','Record excused'])await expect(page.getByRole('row',{name:person,exact:true}).getByRole('button',{name,exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Batch Roll Call',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Close attendance & mark remaining Absent',exact:true})).toBeDisabled();
  await page.clock.setFixedTime(new Date('2026-10-10T00:00:00+08:00'));await page.getByRole('button',{name:'Refresh attendance',exact:true}).click();
  await expect(page.getByRole('row',{name:'Maria Reyes',exact:true}).getByRole('button',{name:'Confirm present',exact:true})).toBeEnabled();
  expect(state.writes).toEqual([]);expect(state.errors).toEqual([]);
});

for(const theme of ['light','dark'])test(`one manual finish action reviews event and linked Sunday absences (${theme})`,async({page},info)=>{
  if(theme==='dark')await page.setViewportSize({width:390,height:844});
  const state=await prepare(page,theme,'Coordinator');await page.clock.setFixedTime(new Date('2026-10-11T14:00:00+08:00'));
  const event={id:34,title:'Sunday Fellowship',start_time:'2026-10-11T09:00:00+08:00',end_time:'2026-10-11T12:00:00+08:00',sunday_service_date:'2026-10-11'};
  const roster={event,can_manage_sunday_reflection:true,attendance_closed_at:null as string|null,summary:{},attendees:[
    {member_id:7,first_name:'Maria',last_name:'Reyes',status:'attended',invitation_answer:'yes',attendance_confirmed:true},
    {member_id:8,first_name:'Juan',last_name:'Santos',status:'absent',invitation_answer:'no',attendance_confirmed:false},
    {member_id:9,first_name:'Pedro',last_name:'Cruz',status:'registered',invitation_answer:'maybe',attendance_confirmed:false},
    {member_id:10,first_name:'Ana',last_name:'Excused',status:'excused',attendance_confirmed:true}
  ],guests:[{response_id:11,name:'Guest Visitor',answer:'yes',status:'unconfirmed',attendance_confirmed:false}]};
  let fail=true;const writes:any[]=[];
  await page.route('**/api/events*',route=>route.fulfill({json:[event]}));
  await page.route('**/api/attendance/roster*',route=>route.fulfill({json:[]}));
  await page.route('**/api/events/34/attendance-roster*',route=>route.fulfill({json:roster}));
  await page.route('**/api/events/34/participation/close-preview*',route=>{
    const sunday=new URL(route.request().url()).searchParams.get('sunday')==='1';
    return route.fulfill({json:{event_members:[{member_id:8,name:'Juan Santos',answer:'no',reason:'Working'},{member_id:9,name:'Pedro Cruz',answer:'maybe',reason:''}],event_guests:[{response_id:11,name:'Guest Visitor',answer:'yes',reason:''}],sunday_members:sunday?[{member_id:9,name:'Pedro Cruz'}]:[],preserved_sunday:sunday?1:0,sunday_service_date:event.sunday_service_date,preview_token:sunday?'both-rosters':'event-only'}});
  });
  await page.route('**/api/events/34/participation/close',route=>{
    writes.push(route.request().postDataJSON());if(fail)return route.fulfill({status:503,json:{error:'Attendance closing failed. No partial result was committed.'}});
    roster.attendance_closed_at='2026-10-11T06:00:00Z';for(const p of [...roster.attendees,...roster.guests])if(!p.attendance_confirmed){p.status='absent';p.attendance_confirmed=true;}
    return route.fulfill({json:{closed:true,no_shows:2,declined:1,sunday_absent:1,preserved_sunday:1}});
  });
  await navigate(page,'Attendance Live');await page.getByRole('button',{name:'Special Event Check-In',exact:true}).click();
  await page.getByRole('button',{name:'Close attendance & mark remaining Absent',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Finalize remaining absences'});
  await expect(dialog).toContainText('3 remaining event participants');await expect(dialog).toContainText('1 member → Sunday Worship Absent');
  await expect(dialog).toContainText('Cannot attend — Working');await expect(dialog).not.toContainText('Maria Reyes');await expect(dialog).not.toContainText('Ana Excused');
  expect(writes).toEqual([]);
  await dialog.getByRole('checkbox').uncheck();await expect(dialog).not.toContainText('Sunday Worship Absent');
  await dialog.getByRole('checkbox').check();await expect(dialog).toContainText('1 member → Sunday Worship Absent');
  await page.screenshot({path:info.outputPath(`finish-attendance-${theme}.png`),fullPage:true});
  await dialog.getByRole('button',{name:'Mark remaining Absent & close',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('No partial result');
  fail=false;await dialog.getByRole('button',{name:'Mark remaining Absent & close',exact:true}).click();
  await expect(dialog).toHaveCount(0);expect(writes).toEqual([{reflect_sunday_absences:true,preview_token:'both-rosters',expected_sunday_service_date:'2026-10-11',ministry_id:'all'},{reflect_sunday_absences:true,preview_token:'both-rosters',expected_sunday_service_date:'2026-10-11',ministry_id:'all'}]);
  await expect(page.getByRole('row',{name:'Maria Reyes',exact:true}).getByText('Present',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Absent / Excused',exact:true}).click();await expect(page.getByRole('row',{name:'Ana Excused',exact:true}).getByText('Excused',{exact:true})).toBeVisible();
  expect(state.writes).toEqual([]);expect(state.errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
for(const theme of ['light','dark']) test(`Sunday reflection is opt-in and visible in individual and batch confirmations (${theme})`,async({page},info)=>{
  if(theme==='dark')await page.setViewportSize({width:390,height:844});
  const state=await prepare(page,theme,'Coordinator');
  await page.clock.setFixedTime(new Date('2026-10-25T14:00:00+08:00'));
  const event={id:32,title:'Sunday Fellowship',start_time:'2026-10-25T09:00:00+08:00',end_time:'2026-10-25T12:00:00+08:00',sunday_service_date:null as string|null};
  const roster={event,can_manage_sunday_reflection:true,attendees:[{member_id:7,first_name:'Maria',last_name:'Reyes',status:'registered',ministry_name:'Youth',invitation_answer:'yes',attendance_confirmed:false}],guests:[{response_id:10,name:'Guest Visitor',answer:'yes',status:'unconfirmed',attendance_confirmed:false}],summary:{}};
  const settings:(string|null)[]=[],marks:any[]=[];
  await page.route('**/api/events*',route=>route.fulfill({json:[event]}));
  await page.route('**/api/attendance/roster*',route=>route.fulfill({json:[]}));
  await page.route('**/api/events/32/attendance-roster*',route=>route.fulfill({json:roster}));
  await page.route('**/api/events/32/participation/sunday-reflection',route=>{
    event.sunday_service_date=route.request().postDataJSON().sunday_service_date;settings.push(event.sunday_service_date);
    return route.fulfill({json:{sunday_service_date:event.sunday_service_date}});
  });
  await page.route('**/api/events/32/participation/mark',route=>{marks.push(route.request().postDataJSON());return route.fulfill({json:{success:true}});});
  await navigate(page,'Attendance Live');await page.getByRole('button',{name:'Special Event Check-In',exact:true}).click();
  const panel=page.getByLabel('Sunday worship reflection',{exact:true});
  await expect(panel).toContainText('Off.');
  await expect(panel.getByRole('checkbox')).not.toBeChecked();
  await page.locator('main').evaluate(el=>el.scrollTo({top:0}));
  await page.screenshot({path:info.outputPath(`event-integration-layout-${theme}.png`),fullPage:true});
  await panel.getByRole('checkbox').check();expect(settings).toEqual([]);
  await expect(panel.getByLabel('Sunday service date')).toHaveValue('2026-10-25');
  await panel.getByRole('button',{name:'Save Sunday reflection'}).click();
  await expect(panel).toContainText('Enabled for 2026-10-25');expect(settings).toEqual(['2026-10-25']);
  await page.getByRole('row',{name:'Maria Reyes',exact:true}).getByRole('button',{name:'Confirm present',exact:true}).click();
  const arrival=page.getByRole('dialog',{name:'Confirm actual arrival'});
  await expect(arrival).toContainText('Sunday Worship on 2026-10-25');expect(marks).toEqual([]);
  await arrival.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('row',{name:'Guest Visitor',exact:true}).getByRole('button',{name:'Confirm present',exact:true}).click();
  await expect(arrival).not.toContainText('Sunday Worship on');await arrival.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Batch Roll Call',exact:true}).click();await page.getByLabel('Select Maria Reyes',{exact:true}).check();
  await page.getByRole('button',{name:'Save Attendance Changes',exact:true}).click();
  const review=page.getByRole('dialog',{name:'Review batch roll call'});
  await expect(review).toContainText('Sunday Worship on 2026-10-25');await review.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Exit Batch Roll Call',exact:true}).click();
  await page.getByRole('row',{name:'Maria Reyes',exact:true}).getByRole('button',{name:'Confirm present',exact:true}).click();
  await arrival.getByRole('button',{name:'Person is here — mark Present',exact:true}).click();
  await expect(arrival).toHaveCount(0);
  expect(marks).toEqual([{member_id:7,status:'attended',reason:'',expected_sunday_service_date:'2026-10-25'}]);
  await panel.getByRole('checkbox').uncheck();await panel.getByRole('button',{name:'Save Sunday reflection'}).click();
  await expect(panel).toContainText('Off.');expect(settings).toEqual(['2026-10-25',null]);
  expect(state.errors).toEqual([]);expect(state.writes).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
for(const theme of ['light','dark']) test(`special event batch roll call reviews scope, preserves decisions and retries safely (${theme})`,async({page},info)=>{
  if(theme==='dark')await page.setViewportSize({width:390,height:844});
  const state=await prepare(page,theme,'Coordinator');
  await page.clock.setFixedTime(new Date('2026-10-25T14:00:00+08:00'));
  const event={id:31,title:'Children’s Day & Sunday School Festival',start_time:'2026-10-25T09:00:00+08:00',end_time:'2026-10-25T12:00:00+08:00',location:'Small Worship Hall'};
  const roster={event,attendance_closed_at:null,summary:{},attendees:[
    {member_id:7,first_name:'Maria',last_name:'Reyes',ministry_name:'Youth',status:'registered',invitation_answer:'yes',attendance_confirmed:false},
    {member_id:9,first_name:'Pedro',last_name:'Cruz',ministry_name:'Youth',status:'registered',invitation_answer:'yes',attendance_confirmed:false},
    {member_id:11,first_name:'Already',last_name:'Present',ministry_name:'Youth',status:'attended',attendance_confirmed:true,checked_in_at:'2026-10-25T01:15:00Z'},
  ],guests:[{response_id:10,name:'Guest Visitor',answer:'yes',status:'unconfirmed',attendance_confirmed:false}]};
  const writes:any[]=[];let fail=true;
  await page.route('**/api/events*',route=>route.fulfill({json:[event]}));
  await page.route('**/api/attendance/roster*',route=>route.fulfill({json:[]}));
  await page.route('**/api/events/31/attendance-roster*',route=>route.fulfill({json:roster}));
  await page.route('**/api/events/31/attendance/batch-mark',route=>{
    const body=route.request().postDataJSON();writes.push(body);
    if(fail)return route.fulfill({status:503,json:{error:'Batch attendance was not saved.'}});
    for(const p of roster.attendees)if(body.present_ids.includes(p.member_id)||body.absent_ids.includes(p.member_id)){p.status=body.present_ids.includes(p.member_id)?'attended':'absent';p.attendance_confirmed=true;}
    return route.fulfill({json:{success:true}});
  });
  await navigate(page,'Attendance Live');
  await page.getByRole('button',{name:'Special Event Check-In',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Special Event Attendance',exact:true})).toBeVisible();
  await expect(page.getByLabel('Event attendance summary',{exact:true})).toBeVisible();
  await expect(page.getByRole('columnheader',{name:'Registration',exact:true})).toBeVisible();
  await expect(page.getByRole('row',{name:'Maria Reyes',exact:true})).toContainText('RSVP confirmed');
  await expect(page.getByRole('row',{name:'Already Present',exact:true})).toContainText('9:15 AM');
  await page.getByRole('button',{name:'Batch Roll Call',exact:true}).click();
  await expect(page.getByLabel('Select Guest Visitor',{exact:true})).toHaveCount(0);
  await expect(page.getByLabel('Select Already Present',{exact:true})).toHaveCount(0);
  await page.getByLabel('Select Maria Reyes',{exact:true}).check();
  await page.getByRole('button',{name:'Save Attendance Changes',exact:true}).click();
  const review=page.getByRole('dialog',{name:'Review batch roll call',exact:true});
  await expect(review).toContainText('1 Present · 0 Absent');expect(writes).toEqual([]);
  await review.getByRole('button',{name:'Confirm batch attendance',exact:true}).click();
  await expect(review.getByRole('alert')).toContainText('Batch attendance was not saved');
  fail=false;await review.getByRole('button',{name:'Confirm batch attendance',exact:true}).click();
  await expect(review).toHaveCount(0);
  expect(writes).toEqual([{present_ids:[7],absent_ids:[],notes:'',expected_sunday_service_date:null},{present_ids:[7],absent_ids:[],notes:'',expected_sunday_service_date:null}]);
  await page.locator('[data-guide="attendance-method-absent"]').click();
  await page.getByLabel('Select Pedro Cruz',{exact:true}).check();
  await page.getByRole('button',{name:'Save Attendance Changes',exact:true}).click();
  await expect(review.getByRole('button',{name:'Confirm batch attendance',exact:true})).toBeDisabled();
  await review.getByLabel('Batch absence reason').fill('Reported illness');
  await review.getByRole('button',{name:'Confirm batch attendance',exact:true}).click();
  await expect(review).toHaveCount(0);
  expect(writes.at(-1)).toEqual({present_ids:[],absent_ids:[9],notes:'Reported illness',expected_sunday_service_date:null});
  await page.getByRole('button',{name:'Exit Batch Roll Call',exact:true}).click();
  await page.locator('main').evaluate(el=>el.scrollTo({top:0}));
  await page.screenshot({path:info.outputPath(`special-event-attendance-${theme}.png`),fullPage:true});
  await page.locator('.event-attendance-directory-heading').scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath(`special-event-directory-${theme}.png`),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(state.errors).toEqual([]);expect(state.writes).toEqual([]);
});
test('unlinked Admin chooses a member before saving an RSVP',async({page})=>{
  await prepare(page);
  const payloads:any[]=[];
  await page.route('**/api/events*',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/events')return route.fulfill({json:[{id:501,title:'RSVP fixture',start_time:'2026-10-10T09:00:00+08:00',end_time:'2026-10-10T12:00:00+08:00',ministry_id:null,ministry_ids:[],rsvp_count:0}]});
    return route.fallback();
  });
  await page.route('**/api/event-invitations/events/501/members?*',route=>route.fulfill({json:[{id:502,first_name:'Juan',last_name:'Santos'}]}));
  await page.route('**/api/events/501/rsvp',route=>{payloads.push(route.request().postDataJSON());return route.fulfill({json:{message:'RSVP saved',status:'registered'}});});
  await navigate(page,'Calendar');
  await page.getByRole('button',{name:/RSVP \(0\)/}).first().click();
  const dialog=page.getByRole('dialog',{name:'Confirm RSVP'});
  await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:'Save RSVP'})).toBeDisabled();
  expect(payloads).toHaveLength(0);
  await dialog.getByLabel('Search member').fill('Juan');
  await dialog.getByRole('button',{name:'Juan Santos'}).click();
  await dialog.getByRole('button',{name:'Save RSVP'}).click();
  await expect(dialog).not.toBeVisible();expect(payloads).toEqual([{member_id:502,status:'registered'}]);
});
for (const theme of ['light', 'dark']) test(`public event invitation needs no login and preserves one response (${theme})`, async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(theme => localStorage.setItem('dpc_theme_mode', theme), theme);
  const requests: any[] = [], unexpected: string[] = [];
  await page.route('**/api/**', async route => {
    if (!route.request().url().includes('/event-invitations/public/')) { unexpected.push(route.request().url()); return route.fulfill({ status: 401, json: {} }); }
    expect(route.request().headers().authorization).toBeUndefined();
    if (route.request().method() === 'POST') {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ json: { message: 'Saved' } });
    }
    return route.fulfill({ json: { title: 'Church Family Gathering', description: 'Join our fellowship.', start_time: '2099-10-20T09:00:00+08:00', end_time: '2099-10-20T12:00:00+08:00', deadline: '2099-10-19T18:00:00+08:00', location: 'Main Sanctuary', personal: false, accepting: true } });
  });
  await page.goto('/#/invite/' + token);
  await expect(page.getByRole('heading', { name: 'Church Family Gathering' })).toBeVisible();
  await expect(page.locator('aside')).toHaveCount(0);
  await page.getByLabel('Full name').fill('Juan Santos');
  await page.getByLabel('Email or mobile number').fill('juan@example.test');
  await page.getByRole('radio', { name: /Hindi ako makakadalo/ }).check();
  await expect(page.getByRole('button', { name: 'Submit response' })).toBeDisabled();
  await page.getByLabel('Reason / Dahilan').fill('Working that day');
  await page.screenshot({ path: info.outputPath('public-invitation-' + theme + '.png'), fullPage: true });
  await page.getByRole('button', { name: 'Submit response' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you, Juan Santos!' })).toBeVisible();
  await page.getByRole('button', { name: 'Change my response' }).click();
  await page.getByRole('radio', { name: /Oo, dadalo ako/ }).check();
  await page.getByRole('button', { name: 'Submit response' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you, Juan Santos!' })).toBeVisible();
  expect(requests[0].answer).toBe('no'); expect(requests[0].reason).toBe('Working that day');
  expect(requests[1].answer).toBe('yes'); expect(requests[0].responseKey).toBe(requests[1].responseKey);
  await page.reload();
  await page.getByLabel('Full name').fill('Juan Santos'); await page.getByLabel('Email or mobile number').fill('juan@example.test');
  await page.getByRole('radio', { name: /Hindi pa sigurado/ }).check();
  await page.getByRole('button', { name: 'Submit response' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you, Juan Santos!' })).toBeVisible();
  expect(requests[2].responseKey).toBe(requests[0].responseKey); expect(unexpected).toEqual([]);
});

test('personal and closed invitations avoid guest details and writes', async ({ page }) => {
  let accepting = true;
  await page.route('**/api/event-invitations/public/**', route => route.fulfill({ json: { title: 'Personal Gathering', start_time: '2099-01-01', end_time: '2099-01-02', deadline: '2098-12-30', personal: true, member_name: 'Maria Reyes', accepting } }));
  await page.goto('/#/invite/' + token);
  await expect(page.getByText('Personal invitation for')).toBeVisible();
  await expect(page.getByLabel('Full name')).toHaveCount(0); await expect(page.getByLabel('Email or mobile number')).toHaveCount(0);
  accepting = false; await page.reload();
  await expect(page.getByText(/Responses are closed/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit response' })).toHaveCount(0);
});

test('regular member search uses event scope and submits member identity instead of typed guest details', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const searches: string[] = [], payloads: any[] = [];
  await page.route('**/api/event-invitations/public/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/members')) {
      searches.push(url.searchParams.get('search') || '');
      return route.fulfill({ json: { members: [{ id: 9, name: 'Juan Santos' }] } });
    }
    if (route.request().method() === 'POST') { payloads.push(route.request().postDataJSON()); return route.fulfill({ json: { message: 'Saved' } }); }
    return route.fulfill({ json: { title: 'Youth Fellowship', ministry_name: 'Youth Ministry', start_time: '2099-01-01', end_time: '2099-01-02', deadline: '2098-12-30', personal: false, accepting: true } });
  });
  await page.goto('/#/invite/' + token);
  await expect(page.getByText('Event ministry: Youth Ministry')).toBeVisible();
  await page.getByRole('radio', { name: 'Regular Member', exact: true }).check();
  await expect(page.getByLabel('Email or mobile number')).toHaveCount(0);
  const memberInput = page.getByRole('combobox', { name: 'Your member name' });
  await expect(page.getByRole('combobox')).toHaveCount(1);
  await memberInput.fill('J');
  await expect(page.getByRole('option', { name: 'Juan Santos' })).toBeVisible();
  expect(searches).toContain('J');
  await page.getByRole('option', { name: 'Juan Santos' }).click();
  await expect(memberInput).toHaveValue('Juan Santos');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await memberInput.fill('Ju');
  await expect(page.getByRole('button', { name: 'Submit response' })).toBeDisabled();
  await expect(page.getByRole('option', { name: 'Juan Santos' })).toBeVisible();
  await memberInput.press('ArrowDown');
  await memberInput.press('Enter');
  await expect(memberInput).toHaveValue('Juan Santos');
  await page.getByRole('radio', { name: /Oo, dadalo ako/ }).check();
  await page.screenshot({ path: info.outputPath('regular-member-invitation.png'), fullPage: true });
  await page.getByRole('button', { name: 'Submit response' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you, Juan Santos!' })).toBeVisible();
  expect(payloads[0]).toMatchObject({ attendeeType: 'member', member_id: 9, name: 'Juan Santos', contact: '', answer: 'yes' });
  await page.getByRole('button', { name: 'Change my response' }).click();
  await page.getByRole('radio', { name: 'Guest', exact: true }).check();
  await expect(page.getByLabel('Full name')).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Your member name' })).toHaveCount(0);
});

test('organizer generates guest and personal links, sees responses and deactivates a link', async ({ page }, info) => {
  await prepare(page);
  const event = { id: 21, title: 'Church Family Gathering', description: 'Welcome', start_time: '2026-10-20T09:00:00+08:00', end_time: '2026-10-20T12:00:00+08:00', location: 'Sanctuary' };
  const links: any[] = [], payloads: any[] = [];
  await page.route('**/api/events*', route => route.fulfill({ json: [event] }));
  await page.route('**/api/members?*', route => route.fulfill({ json: { data: [{ id: 7, first_name: 'Maria', last_name: 'Reyes' }] } }));
  await page.route('**/api/event-invitations/events/**', async route => {
    const method = route.request().method();
    if (new URL(route.request().url()).pathname.endsWith('/members')) return route.fulfill({ json: [{ id: 7, first_name: 'Maria', last_name: 'Reyes' }] });
    if (method === 'POST') {
      const payload = route.request().postDataJSON(); payloads.push(payload);
      const link = { id: links.length + 1, token: String(links.length + 1).repeat(64), member_id: payload.member_id || null, member_name: 'Maria Reyes', enabled: true, accepting: true, deadline: event.start_time };
      links.unshift(link); return route.fulfill({ status: 201, json: link });
    }
    if (method === 'DELETE') { links.splice(0,1); return route.fulfill({json:{message:'Invitation link deleted. Existing responses were preserved.'}}); }
    if (method === 'PATCH') { links[0].enabled = route.request().postDataJSON().enabled; links[0].accepting = links[0].enabled; return route.fulfill({ json: {} }); }
    return route.fulfill({ json: { links, responses: [{ id: 1, name: 'Juan Santos', contact: 'juan@example.test', answer: 'no', reason: 'Working', updated_at: event.start_time }], counts: { yes: 0, no: 1, maybe: 0, pending: 1 }, limit: 1000 } });
  });
  await navigate(page, 'Calendar');
  await page.getByText('Church Family Gathering', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Invitation Links & Responses' }).click();
  const dialog = page.locator('.event-workspace');
  await expect(dialog.getByText('Reason: Working')).toBeVisible();
  await dialog.getByLabel('Invitation website URL').fill('https://church.example.test/');
  await dialog.getByRole('button', { name: 'Generate Link' }).click();
  await expect(dialog.getByLabel('Invitation link 1', { exact: true })).toHaveValue('https://church.example.test/#/invite/' + '1'.repeat(64));
  await dialog.getByLabel('Link type').selectOption('personal');
  await dialog.getByLabel('Search member').fill('Maria'); await dialog.getByLabel('Recipient').selectOption('7');
  await dialog.getByRole('button', { name: 'Generate Link' }).click();
  expect(payloads[1].member_id).toBe(7);
  await dialog.getByRole('button', { name: 'Deactivate', exact: true }).first().click();
  await expect(dialog.getByRole('button', { name: 'Activate', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const box = await dialog.boundingBox(); expect(box && box.x >= 0 && box.x + box.width <= 391).toBeTruthy();
  await dialog.getByRole('button',{name:'Delete',exact:true}).first().click();
  await expect(page.getByRole('dialog',{name:'Delete invitation link?'})).toBeVisible();
  expect(links).toHaveLength(2);
  await page.getByRole('dialog',{name:'Delete invitation link?'}).getByRole('button',{name:'Delete invitation link',exact:true}).click();
  await expect(dialog.getByText('Invitation link deleted. Existing responses were preserved.')).toBeVisible();
  expect(links).toHaveLength(1);
  await expect(dialog.getByText('Reason: Working')).toBeVisible();
  await page.screenshot({ path: info.outputPath('organizer-invitations.png') });
});

for (const theme of ['light', 'dark']) test(`collaborative celebration targets persist when edited (${theme})`, async ({ page }, info) => {
  await prepare(page, theme);
  const rows: any[] = [], payloads: any[] = [];
  await page.route('**/api/events/recurring-sunday-cycle**', async route => {
    if (route.request().method() === 'POST' || route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON(); payloads.push(payload);
      const row = { ...payload, id: 51, ministry_ids: payload.ministry_ids, db_ministry_name: 'Youth + Young Adult', is_active: true, projected_date: '2026-10-11' };
      rows.splice(0, rows.length, row);
      return route.fulfill({ status: 201, json: { id: 51, message: 'Saved' } });
    }
    return route.fulfill({ json: { events: rows, year: 2026, available_years: [2026], total_annual_events: rows.length } });
  });
  await navigate(page, 'Events & Celebrations');
  await page.getByRole('button', { name: 'Add Event / Celebration', exact: true }).click();
  const panel = page.locator('[data-modal-panel]').last();
  const title = panel.locator('input[type="text"]').first();
  await title.fill('Youth & Young Adult Fellowship');
  await panel.getByRole('checkbox', { name: 'Youth', exact: true }).check();
  await panel.getByRole('checkbox', { name: 'Young Adult', exact: true }).check();
  await expect(panel.getByRole('checkbox', { name: 'Church-wide / All Ministries' })).not.toBeChecked();
  await expect(panel.getByText('2 ministries collaborating')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.locator('.event-ministry-picker').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('collaborative-celebration-' + theme + '.png'), fullPage: true });
  await panel.getByRole('button', { name: 'Create Annual Celebration', exact: true }).click();
  await expect(page.getByText('Youth & Young Adult Fellowship', { exact: true }).first()).toBeVisible();
  expect(payloads[0].ministry_ids).toEqual([2, 3]);
  await page.getByTitle('Close', { exact: true }).click();
  await page.getByTitle('Edit Celebration', { exact: true }).click();
  await expect(panel.getByRole('checkbox', { name: 'Youth', exact: true })).toBeChecked();
  await expect(panel.getByRole('checkbox', { name: 'Young Adult', exact: true })).toBeChecked();
  await panel.getByRole('checkbox', { name: 'Church-wide / All Ministries' }).check();
  await expect(panel.getByRole('checkbox', { name: 'Youth', exact: true })).not.toBeChecked();
  await expect(panel.getByRole('checkbox', { name: 'Young Adult', exact: true })).not.toBeChecked();
  await panel.getByRole('button', { name: 'Save Changes', exact: true }).click();
  expect(payloads[1].ministry_ids).toEqual([]);
});


for (const theme of ['light', 'dark']) test(`event workspace requires actual arrivals and closes no-shows (${theme})`, async ({page}, info) => {
  if (theme === 'dark') await page.setViewportSize({width:390,height:844});
  const state=await prepare(page,theme);
  await page.clock.setFixedTime(new Date('2026-10-08T14:00:00+08:00'));
  const event={id:21,title:'Event attendance fixture',start_time:'2026-10-08T09:00:00+08:00',end_time:'2026-10-08T12:00:00+08:00',location:'Sanctuary',ministry_ids:[]};
  const roster:any={event,can_manage_sunday_reflection:true,attendance_closed_at:null,summary:{},attendees:[
    {member_id:7,first_name:'Maria',last_name:'Reyes',status:'registered',invitation_answer:'yes',attendance_confirmed:false},
    {member_id:8,first_name:'Juan',last_name:'Santos',status:'absent',invitation_answer:'no',invitation_reason:'Working',attendance_notes:'[RSVP DECLINED] Working',attendance_confirmed:false},
    {member_id:9,first_name:'Pedro',last_name:'Cruz',status:'registered',invitation_answer:'yes',attendance_confirmed:false}
  ],guests:[{response_id:10,name:'Guest Visitor',answer:'yes',status:'unconfirmed',attendance_confirmed:false}]};
  const actions:any[]=[];
  await page.route('**/api/events*',route=>route.fulfill({json:[event]}));
  await page.route('**/api/event-invitations/events/**',route=>route.fulfill({json:{links:[],responses:[],counts:{yes:0,no:0,maybe:0,pending:0},limit:1000}}));
  await page.route('**/api/attendance/roster*',route=>route.fulfill({json:[]}));
  await page.route('**/api/events/21/attendance-roster*',route=>route.fulfill({json:roster}));
  await page.route('**/api/events/21/participation/*',route=>{
    const path=new URL(route.request().url()).pathname;
    if(route.request().method()==='GET')return route.fulfill({json:{event_members:roster.attendees.filter((m:any)=>!m.attendance_confirmed).map((m:any)=>({...m,name:`${m.first_name} ${m.last_name}`,answer:m.invitation_answer,reason:m.invitation_reason||''})),event_guests:[],sunday_members:[],preserved_sunday:0,sunday_service_date:null,preview_token:'fixture-preview'}});
    const body=route.request().postDataJSON();actions.push({path,body});
    if(path.endsWith('/mark')) {
      const person=body.member_id?roster.attendees.find((m:any)=>m.member_id===body.member_id):roster.guests.find((g:any)=>g.response_id===body.response_id);
      person.status=body.status;person.attendance_confirmed=true;
      return route.fulfill({json:{success:true}});
    }
    if(path.endsWith('/close')) {
      roster.attendance_closed_at='2026-10-09T06:00:00Z';
      for(const person of [...roster.attendees,...roster.guests]) if(!person.attendance_confirmed) {
        person.status='absent';person.attendance_confirmed=true;
        person.attendance_notes=person.invitation_reason||'No-show - arrival was not confirmed when attendance closed';
      }
      return route.fulfill({json:{closed:true,no_shows:1,declined:1}});
    }
    roster.attendance_closed_at=null;return route.fulfill({json:{closed:false,no_shows:0,declined:0}});
  });
  await navigate(page,'Calendar');
  await page.getByText(event.title,{exact:true}).first().click();
  await page.getByRole('button',{name:'Invitation Links & Responses'}).click();
  await expect(page.locator('.event-workspace')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Attendance & check-in',exact:true}).click();
  const maria=page.getByRole('row',{name:'Maria Reyes'});
  await expect(maria.getByText('Waiting for check-in')).toBeVisible();
  await expect(page.getByRole('row',{name:'Juan Santos'})).toHaveCount(0);
  expect(actions).toEqual([]);
  await page.getByRole('button',{name:'Absent / Excused',exact:true}).click();
  await expect(page.getByRole('row',{name:'Juan Santos'}).getByText('Reason / notes: Working')).toBeVisible();
  await page.getByRole('button',{name:'Expected & present',exact:true}).click();
  await maria.getByRole('button',{name:'Confirm present'}).click();
  expect(actions).toEqual([]);
  await page.getByRole('dialog',{name:'Confirm actual arrival'}).getByRole('button',{name:'Person is here \u2014 mark Present'}).click();
  await expect(maria.getByText('Present',{exact:true})).toBeVisible();
  await page.getByRole('row',{name:'Guest Visitor'}).getByRole('button',{name:'Confirm present'}).click();
  await page.getByRole('dialog',{name:'Confirm actual arrival'}).getByRole('button',{name:'Person is here \u2014 mark Present'}).click();
  await expect(page.getByRole('row',{name:'Guest Visitor'}).getByText('Present',{exact:true})).toBeVisible();
  expect(actions.map(a=>a.body)).toEqual([{member_id:7,status:'attended',reason:'',expected_sunday_service_date:null},{response_id:10,status:'attended',reason:'',expected_sunday_service_date:null}]);
  await page.getByRole('button',{name:'Close attendance & mark remaining Absent',exact:true}).click();
  await page.getByRole('dialog',{name:'Finalize remaining absences'}).getByRole('button',{name:'Mark remaining Absent & close'}).click();
  await expect(page.getByRole('button',{name:'Reopen attendance',exact:true})).toBeVisible();
  await expect(maria.getByText('Present',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Absent / Excused',exact:true}).click();
  await expect(page.getByRole('row',{name:'Pedro Cruz'}).getByText(/No-show/)).toBeVisible();
  await expect(page.getByRole('row',{name:'Pedro Cruz'}).getByRole('button',{name:'Confirm present'})).toBeDisabled();
  await page.screenshot({path:info.outputPath('event-workspace-'+theme+'.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  await page.getByRole('button',{name:'Open in Attendance Live'}).click();
  await expect(page.getByRole('heading',{name:'Special Event Attendance',exact:true})).toBeVisible();
  await expect(page.getByLabel('Select special event')).toHaveValue('21');
  await page.getByRole('button',{name:'Reopen attendance',exact:true}).click();
  await page.getByRole('dialog',{name:'Reopen event attendance'}).getByRole('button',{name:'Confirm reopen attendance'}).click();
  await expect(page.getByRole('button',{name:'Close attendance & mark remaining Absent',exact:true})).toBeVisible();
  await expect(page.getByRole('row',{name:'Maria Reyes'}).getByText('Present',{exact:true})).toBeVisible();
  expect(actions.map(a=>a.path.split('/').pop())).toEqual(['mark','mark','close','reopen']);
  expect(state.writes).toEqual([]);expect(state.errors).toEqual([]);
});

for(const role of ['Admin','Pastor','Coordinator','Volunteer'])test(`event absence finalization uses selected attendance scope for ${role}`,async({page})=>{
  const state=await prepare(page,'light',role);
  await page.clock.setFixedTime(new Date('2026-10-11T14:00:00+08:00'));
  const unrestricted=['Admin','Pastor'].includes(role),event={id:35,title:'Scoped attendance',start_time:'2026-10-11T09:00:00+08:00',end_time:'2026-10-11T12:00:00+08:00'};
  const members=[{member_id:7,first_name:'Youth',last_name:'Present',ministry_id:2,ministry_name:'Youth',status:'attended',attendance_confirmed:true},{member_id:8,first_name:'Youth',last_name:'No RSVP',ministry_id:2,ministry_name:'Youth',status:'unregistered',attendance_confirmed:false},{member_id:9,first_name:'Adult',last_name:'No RSVP',ministry_id:3,ministry_name:'Young Adult',status:'unregistered',attendance_confirmed:false}];
  const scopes=unrestricted?[{id:2,name:'Youth'},{id:3,name:'Young Adult'}]:[{id:2,name:'Youth'}];
  const closed=new Set<number>(),writes:any[]=[];
  await page.route('**/api/events*',route=>route.fulfill({json:[event]}));
  await page.route('**/api/attendance/roster*',route=>route.fulfill({json:[]}));
  await page.route('**/api/events/35/attendance-roster*',route=>{
    const selection=new URL(route.request().url()).searchParams.get('ministry_id');
    const attendees=members.filter(m=>(unrestricted||m.ministry_id===2)&&(selection==='all'||String(m.ministry_id)===selection)).map(m=>({...m,attendance_closed:closed.has(m.ministry_id)}));
    return route.fulfill({json:{event,can_finalize_attendance:true,can_manage_sunday_reflection:false,scope_ministries:scopes,attendees,guests:[],summary:{},attendance_closed_at:selection==='2'&&closed.has(2)?'2026-10-11T06:00:00Z':null}});
  });
  await page.route('**/api/events/35/participation/close-preview*',route=>{
    expect(new URL(route.request().url()).searchParams.get('ministry_id')).toBe('2');
    return route.fulfill({json:{event_members:[{member_id:8,name:'Youth No RSVP',answer:null,reason:null}],event_guests:[],sunday_members:[],preserved_sunday:0,sunday_service_date:null,preview_token:'youth-only'}});
  });
  await page.route('**/api/events/35/participation/close',route=>{
    writes.push(route.request().postDataJSON());closed.add(2);members[1].status='absent';members[1].attendance_confirmed=true;
    return route.fulfill({json:{closed:true,no_shows:1,declined:0}});
  });
  await navigate(page,'Attendance Live');await page.getByRole('button',{name:'Special Event Check-In',exact:true}).click();
  const scope=page.getByLabel('Attendance scope',{exact:true});
  await expect(scope).toContainText(unrestricted?'All event ministries & guests':'Assigned event ministries');
  if(!unrestricted){await expect(scope).not.toContainText('Young Adult');await expect(page.getByRole('row',{name:'Adult No RSVP',exact:true})).toHaveCount(0);}
  await scope.selectOption('2');await expect(page.getByRole('row',{name:'Youth Present',exact:true})).toBeVisible();await expect(page.getByRole('row',{name:'Youth No RSVP',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Close attendance & mark remaining Absent',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Finalize remaining absences'});await expect(dialog).toContainText('Scope: Youth');await expect(dialog).toContainText('Youth No RSVP');await expect(dialog).not.toContainText('Adult No RSVP');
  await dialog.getByRole('button',{name:'Mark remaining Absent & close',exact:true}).click();await expect(dialog).toHaveCount(0);
  expect(writes).toEqual([{reflect_sunday_absences:false,preview_token:'youth-only',expected_sunday_service_date:null,ministry_id:'2'}]);
  await page.getByRole('button',{name:'Absent / Excused',exact:true}).click();await expect(page.getByRole('row',{name:'Youth No RSVP',exact:true}).getByText('Absent',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Reopen attendance',exact:true})).toBeVisible();
  if(unrestricted){await scope.selectOption('3');await page.getByRole('button',{name:'All participants',exact:true}).click();await expect(page.getByRole('row',{name:'Adult No RSVP',exact:true}).getByRole('button',{name:'Confirm present',exact:true})).toBeEnabled();}
  expect(state.errors).toEqual([]);expect(state.writes).toEqual([]);
});

for(const theme of ['light','dark'])test(`absence review handles 80 names with searchable list and pinned actions (${theme})`,async({page},info)=>{
  if(theme==='dark')await page.setViewportSize({width:390,height:844});
  const state=await prepare(page,theme);await page.clock.setFixedTime(new Date('2026-10-13T21:30:00+08:00'));
  const event={id:36,title:'Ministry gathering',start_time:'2026-10-13T09:00:00+08:00',end_time:'2026-10-13T12:00:00+08:00'};
  const people=Array.from({length:80},(_,i)=>({member_id:i+1,name:i===0?'Rieza Lyn E. Domencil':i===1?'A very long member name that should wrap without covering the badge':'Ministry Member '+(i+1),answer:i===0?'no':null,reason:i===0?'Working':''}));
  await page.route('**/api/events*',route=>route.fulfill({json:[event]}));
  await page.route('**/api/attendance/roster*',route=>route.fulfill({json:[]}));
  await page.route('**/api/events/36/attendance-roster*',route=>route.fulfill({json:{event,can_finalize_attendance:true,scope_ministries:[{id:2,name:'Youth'}],attendees:[],guests:[],summary:{}}}));
  await page.route('**/api/events/36/participation/close-preview*',route=>route.fulfill({json:{event_members:people,event_guests:[],sunday_members:[],preserved_sunday:0,sunday_service_date:null,preview_token:'design-preview'}}));
  await navigate(page,'Attendance Live');await page.getByRole('button',{name:'Special Event Check-In',exact:true}).click();await page.getByRole('button',{name:'Close attendance & mark remaining Absent',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Finalize remaining absences'}),search=dialog.getByLabel('Search remaining participants');
  await expect(dialog).toContainText('80 remaining event participants');
  await search.fill('Rieza');await expect(dialog.locator('.event-close-list li')).toHaveCount(1);await expect(dialog).toContainText('1 of 80 shown');
  await search.fill('not-a-member');await expect(dialog).toContainText('No names match your search.');await search.fill('');
  await expect(dialog.locator('.event-close-list li')).toHaveCount(80);
  expect(await dialog.locator('.event-close-list').evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
  await dialog.locator('[data-modal-body]').evaluate(el=>el.scrollTop=0);
  await expect(dialog.getByRole('button',{name:'Mark remaining Absent & close',exact:true})).toBeInViewport();
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await dialog.screenshot({path:info.outputPath(`absence-review-${theme}.png`)});
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).toHaveCount(0);
  expect(state.writes).toEqual([]);expect(state.errors).toEqual([]);
});

test('expected event directory shows accepted RSVPs and arrivals while close review retains nonrespondents',async({page})=>{
  const state=await prepare(page);await page.clock.setFixedTime(new Date('2026-10-11T14:00:00+08:00'));
  const event={id:37,title:'RSVP directory',start_time:'2026-10-11T09:00:00+08:00',end_time:'2026-10-11T12:00:00+08:00'};
  const attendees=[{member_id:1,first_name:'Accepted',last_name:'Member',status:'registered',invitation_answer:'yes',attendance_confirmed:false},{member_id:2,first_name:'No RSVP',last_name:'Member',status:'unregistered',invitation_answer:null,attendance_confirmed:false},{member_id:3,first_name:'Maybe',last_name:'Member',status:'unregistered',invitation_answer:'maybe',attendance_confirmed:false},{member_id:4,first_name:'Declined',last_name:'Member',status:'absent',invitation_answer:'no',attendance_confirmed:false},{member_id:5,first_name:'Walk-in',last_name:'Member',status:'registered',invitation_answer:null,attendance_confirmed:false},{member_id:6,first_name:'Actual',last_name:'Arrival',status:'attended',invitation_answer:'no',attendance_confirmed:true}];
  await page.route('**/api/events*',route=>route.fulfill({json:[event]}));
  await page.route('**/api/attendance/roster*',route=>route.fulfill({json:[]}));
  await page.route('**/api/events/37/attendance-roster*',route=>route.fulfill({json:{event,can_finalize_attendance:true,summary:{},attendees,guests:[{response_id:8,name:'Accepted Guest',answer:'yes',status:'unconfirmed',attendance_confirmed:false},{response_id:9,name:'Maybe Guest',answer:'maybe',status:'unconfirmed',attendance_confirmed:false}]}}));
  await page.route('**/api/events/37/participation/close-preview*',route=>route.fulfill({json:{event_members:[{member_id:2,name:'No RSVP Member',answer:null,reason:null}],event_guests:[],sunday_members:[],preserved_sunday:0,sunday_service_date:null,preview_token:'directory-test'}}));
  await navigate(page,'Attendance Live');await page.getByRole('button',{name:'Special Event Check-In',exact:true}).click();
  for(const name of ['Accepted Member','Walk-in Member','Actual Arrival','Accepted Guest'])await expect(page.getByRole('row',{name,exact:true})).toBeVisible();
  for(const name of ['No RSVP Member','Maybe Member','Declined Member','Maybe Guest'])await expect(page.getByRole('row',{name,exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Batch Roll Call',exact:true}).click();await expect(page.getByLabel('Select No RSVP Member',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Select Accepted Member',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Exit Batch Roll Call',exact:true}).click();await page.getByRole('button',{name:'Close attendance & mark remaining Absent',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Finalize remaining absences'});await expect(dialog).toContainText('No RSVP Member');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'All participants',exact:true}).click();await expect(page.getByRole('row',{name:'No RSVP Member',exact:true})).toBeVisible();
  expect(state.writes).toEqual([]);expect(state.errors).toEqual([]);
});

for(const theme of ['light','dark'])test(`event roll call matches Sunday targets and selections across pages and households (${theme})`,async({page},info)=>{
  if(theme==='dark')await page.setViewportSize({width:390,height:844});
  const state=await prepare(page,theme);await page.clock.setFixedTime(new Date('2026-10-11T14:00:00+08:00'));
  const event={id:38,title:'Family fellowship',start_time:'2026-10-11T09:00:00+08:00',end_time:'2026-10-11T12:00:00+08:00'};
  const attendees=Array.from({length:30},(_,i)=>({member_id:i+1,first_name:'Person',last_name:String(i+1),household_name:i<15?'Remot':'Santos',ministry_name:'Youth',status:'registered',invitation_answer:'yes',attendance_confirmed:false}));
  attendees.push({member_id:99,first_name:'Recorded',last_name:'Present',household_name:'Remot',ministry_name:'Youth',status:'attended',invitation_answer:'yes',attendance_confirmed:true});
  const writes:any[]=[];
  await page.route('**/api/events*',route=>route.fulfill({json:[event]}));await page.route('**/api/attendance/roster*',route=>route.fulfill({json:[]}));
  await page.route('**/api/events/38/attendance-roster*',route=>route.fulfill({json:{event,attendees,guests:[],summary:{}}}));
  await page.route('**/api/events/38/attendance/batch-mark',route=>{writes.push(route.request().postDataJSON());return route.fulfill({json:{success:true}});});
  await navigate(page,'Attendance Live');await page.getByRole('button',{name:'Special Event Check-In',exact:true}).click();await page.getByRole('button',{name:'Batch Roll Call',exact:true}).click();
  await expect(page.getByText('Batch Mode Active',{exact:true})).toBeVisible();
  await expect(page.getByRole('columnheader',{name:'Roll Call Target',exact:true})).toBeVisible();
  await expect(page.getByRole('row',{name:'Person 1',exact:true}).getByRole('button')).toHaveCount(0);
  await page.getByLabel('Select all matching event members',{exact:true}).check();await expect(page.getByRole('button',{name:'Clear (30)',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Clear (30)',exact:true}).click();
  const search=page.locator('[data-guide="attendance-search"]');await search.fill('Person 30');await page.getByRole('button',{name:'Select All (1)',exact:true}).click();await search.fill('');
  await page.getByRole('button',{name:'Save Attendance Changes',exact:true}).click();const review=page.getByRole('dialog',{name:'Review batch roll call'});await expect(review).toContainText('Person 30');await expect(review).toContainText('1 Present · 0 Absent');await review.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.locator('[data-guide="attendance-method-present"]').click();await search.fill('Person 30');await page.getByLabel('Select Person 30',{exact:true}).check();await search.fill('');
  const row=page.getByRole('row',{name:'Person 1',exact:true});await expect(row).toContainText('Will Mark Absent (Default)');await expect(row).toHaveAttribute('data-batch-target','absent-default');
  await page.getByRole('button',{name:'Save Attendance Changes',exact:true}).click();await expect(review).toContainText('1 Present · 29 Absent');await review.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.locator('.event-attendance-directory-heading').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath(`event-roll-call-${theme}.png`),fullPage:true});
  await page.locator('[data-guide="attendance-batch-household"]').selectOption('Remot');await page.locator('[data-guide="attendance-method-absent"]').click();
  await page.getByRole('row',{name:'Person 1',exact:true}).locator('th[scope="row"]').click();await expect(page.getByLabel('Select Person 1',{exact:true})).toBeChecked();
  await expect(page.getByRole('row',{name:'Person 1',exact:true})).toContainText('Will Mark Absent');await expect(page.getByRole('row',{name:'Person 2',exact:true})).toContainText('Will Mark Present (Default)');
  await expect(page.getByRole('row',{name:'Recorded Present',exact:true})).toContainText('Recorded · Unchanged');await expect(page.getByLabel('Select Recorded Present',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Save Attendance Changes',exact:true}).click();await expect(review).toContainText('14 Present · 1 Absent');await review.getByLabel('Batch absence reason').fill('Confirmed no arrival');await review.getByRole('button',{name:'Confirm batch attendance',exact:true}).click();await expect(review).toHaveCount(0);
  expect(writes).toEqual([{present_ids:Array.from({length:14},(_,i)=>i+2),absent_ids:[1],notes:'Confirmed no arrival',expected_sunday_service_date:null}]);
  expect(state.writes).toEqual([]);expect(state.errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

for(const role of ['Admin','Pastor','Coordinator','Volunteer'])test(`close review selects multiple ministries and keeps remaining scope open (${role})`,async({page},info)=>{
  if(role==='Pastor')await page.setViewportSize({width:390,height:844});
  const state=await prepare(page,'light',role);await page.clock.setFixedTime(new Date('2026-10-11T14:00:00+08:00'));
  const unrestricted=['Admin','Pastor'].includes(role),event={id:39,title:'Scoped close',start_time:'2026-10-11T09:00:00+08:00',end_time:'2026-10-11T12:00:00+08:00'};
  const ministries=unrestricted?[{id:2,name:'Youth'},{id:3,name:'Young Adult'},{id:4,name:'Old Adult'}]:[{id:2,name:'Youth'},{id:3,name:'Young Adult'}];
  let finished=false;const writes:any[]=[];
  await page.route('**/api/events*',route=>route.fulfill({json:[event]}));await page.route('**/api/attendance/roster*',route=>route.fulfill({json:[]}));
  await page.route('**/api/events/39/attendance-roster*',route=>route.fulfill({json:{event,can_finalize_attendance:true,scope_ministries:ministries.map(m=>({...m,closed:finished&&m.id!==4})),attendees:[],guests:[],summary:{},attendance_closed_at:null,attendance_fully_closed:false}}));
  await page.route('**/api/events/39/participation/close-preview*',route=>{
    const ids=new URL(route.request().url()).searchParams.get('ministry_ids');
    return route.fulfill({json:{event_members:(ids?ids.split(',').map(Number):ministries.map(m=>m.id)).map(id=>({member_id:id,name:ministries.find(m=>m.id===id)!.name+' Member',answer:null,reason:null})),event_guests:[],sunday_members:[],preserved_sunday:0,sunday_service_date:null,preview_token:'selected-'+ids}});
  });
  await page.route('**/api/events/39/participation/close',route=>{writes.push(route.request().postDataJSON());finished=true;return route.fulfill({json:{closed:true,no_shows:2,declined:0}});});
  await navigate(page,'Attendance Live');await page.getByRole('button',{name:'Special Event Check-In',exact:true}).click();await page.getByRole('button',{name:'Close attendance & mark remaining Absent',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Finalize remaining absences'});await dialog.getByRole('radio',{name:'Choose ministries',exact:true}).check();
  if(unrestricted)await dialog.getByRole('checkbox',{name:'Old Adult',exact:true}).uncheck();else await expect(dialog.getByRole('checkbox',{name:'Old Adult',exact:true})).toHaveCount(0);
  await expect(dialog).toContainText('2 remaining event participants');await expect(dialog.locator('.event-close-list')).not.toContainText('Old Adult Member');
  await dialog.locator('[data-modal-body]').evaluate(el=>el.scrollTop=0);await dialog.screenshot({path:info.outputPath(`ministry-close-${role}.png`)});expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await dialog.getByRole('checkbox',{name:'Youth',exact:true}).uncheck();await dialog.getByRole('checkbox',{name:'Young Adult',exact:true}).uncheck();await expect(dialog.getByRole('button',{name:'Close selected ministries',exact:true})).toBeDisabled();
  await dialog.getByRole('checkbox',{name:'Youth',exact:true}).check();await dialog.getByRole('checkbox',{name:'Young Adult',exact:true}).check();await expect(dialog).toContainText('2 remaining event participants');
  await dialog.getByRole('button',{name:'Close selected ministries',exact:true}).click();await expect(dialog).toHaveCount(0);expect(writes[0].ministry_ids).toEqual([2,3]);
  await expect(page.getByRole('button',{name:'Close attendance & mark remaining Absent',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close attendance & mark remaining Absent',exact:true}).click();await dialog.getByRole('radio',{name:'Choose ministries',exact:true}).check();await expect(dialog.getByRole('checkbox',{name:'Youth · Closed',exact:true})).toBeDisabled();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(state.errors).toEqual([]);expect(state.writes).toEqual([]);
});

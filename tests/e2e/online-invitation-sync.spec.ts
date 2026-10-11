import {test,expect,type Page} from '@playwright/test';

const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';
async function fixture(page:Page,theme:string,role='Admin') {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(({theme,role})=>{
    sessionStorage.setItem('dpc_intro_shown','true');localStorage.setItem('dpc_theme_mode',theme);
    localStorage.setItem(`dpc_help_welcome_v1:1:${role}`,'seen');localStorage.setItem('chms_token','e30.'+btoa(JSON.stringify({exp:4102444800}))+'.test');
  },{theme,role});
  const event={id:11,title:'Online Fellowship',start_time:'2099-10-20T09:00:00Z',end_time:'2099-10-20T12:00:00Z',ministry_id:null,ministry_ids:[],location:'Sanctuary'};
  const pending=[first,second].map(submission=>({submission,revision:'1',event_identity:first,event_title:event.title,event_id:11,updated_at:'2026-10-11T09:00:00Z',status:'Pending'}));
  const state={state:'Ready',source_url:'https://online.example.test',source_id:first,receiver:second,last_check:'2026-10-11T09:00:00Z',pending};
  const pulls:any[]=[];let unread=1;
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname,method=route.request().method();let json:any=[];
    if(path.endsWith('/auth/setup-status'))json={hasUsers:true,hasAdmin:true};
    else if(path.endsWith('/auth/me'))json={user:{id:1,name:'Fixture Admin',email:'fixture@example.test',role_name:role,ministries:[]}};
    else if(path.endsWith('/notifications/unread-count'))json={count:unread};
    else if(path.endsWith('/notifications'))json={items:role==='Admin'?[{id:1,type:'online_invitation_submission',title:'Online invitation submissions',message:'2 pending responses require manual Pull.',is_read:unread===0,link_tab:'events',link_ref_id:11,created_at:'2026-10-11T09:00:00Z'}]:[],total:1,unread_count:unread,totalPages:1};
    else if(path.includes('/notifications/')&&method!=='GET'){unread=0;json={};}
    else if(path.endsWith('/invitation-sync/state'))json=state;
    else if(path.endsWith('/invitation-sync/preview'))json={submission:first,revision:'1',name:'Guest Online',contact:'guest@example.test',answer:'yes',reason:'',blocked:null};
    else if(path.endsWith('/invitation-sync/pull')){
      pulls.push(route.request().postDataJSON());state.pending[0].status='Imported locally · Confirmation pending';
      json={results:[{submission:first,status:'Imported locally · Confirmation pending'},{submission:second,status:'Blocked',error:'Member counterpart cannot be verified.'}],unprocessed:[]};
    }
    else if(path.endsWith('/invitation-sync/refresh')){state.state='Offline · Retrying';return route.fulfill({status:503,json:{error:'Online service unavailable; last-known results are stale.'}});}
    else if(path==='/api/events/11')json=event;
    else if(path.endsWith('/event-invitations/events/11'))json={links:[],responses:[],counts:{yes:0,no:0,maybe:0,pending:0},limit:1000};
    else if(path.endsWith('/events'))json=[event];
    else if(path.endsWith('/reports/dashboard'))json={metrics:{total_active_members:0,total_households:0,unenrolled_members_count:0,upcoming_events_count:0},ministry_breakdown:[]};
    else if(path.endsWith('/reports/growth-insights'))json={baptisms:[],attendance_trends:[],groups_list:[],summary:{}};
    else if(path.endsWith('/settings/general'))json={settings:{},list:[]};
    else if(path.endsWith('/members/birthdays'))json={celebrants:[],monthly_distribution:[],counts:{today:0,this_week:0,this_month:0,next_30_days:0}};
    else if(path.endsWith('/members/baptism-candidates/qualified'))json={candidates:[],counts:{total_qualified:0,pending_nomination:0}};
    else if(path.endsWith('/duty/schedule')||path.endsWith('/dishwashing/schedule'))json={schedule:[],total_teams:0};
    else if(path.endsWith('/events/recurring-sunday-cycle'))json={events:[],year:2026,summary:{}};
    else if(path.endsWith('/services'))json={services:[]};
    else if(path.endsWith('/study-topics'))json={topics:[],all:[],summary:{},total:0};
    else if(path.endsWith('/planned-visits'))json={items:[],total:0,page:1,totalPages:1};
    await route.fulfill({json});
  });await page.goto('/');return {pulls,state};
}

test('Admin explicitly verifies an existing local event without importing submissions',async({page})=>{
  const f=await fixture(page,'light');
  f.state.pending.forEach(p=>{(p as any).event_id=null;});
  const confirmations:any[]=[];
  await page.route('**/api/invitation-sync/verify-event/**',async route=>{
    if(route.request().url().endsWith('/inspect'))return route.fulfill({json:{source:first,fingerprint:'reviewed',event:{sync_identity:first,title:'Online Fellowship',start_time:'2099-10-20T09:00:00Z',end_time:'2099-10-20T12:00:00Z',location:'Sanctuary'},events:[{id:11,sync_identity:second,fingerprint:'local-review',title:'Local Fellowship',start_time:'2099-10-20T09:00:00Z',end_time:'2099-10-20T12:00:00Z',location:'Sanctuary'}]}});
    confirmations.push(route.request().postDataJSON());f.state.pending.forEach(p=>{p.event_id=11;});
    return route.fulfill({json:{event_id:11,verified_links:1,unmatched_online_links:0,state:f.state}});
  });
  await page.locator('aside').getByRole('button',{name:/Settings & Backups/}).click();
  await page.getByRole('button',{name:'Backup & Data Management',exact:true}).click();
  const panel=page.getByRole('region',{name:'Online invitation synchronization'});
  await expect(panel.getByRole('button',{name:'Verify event',exact:true})).toHaveCount(1);
  await panel.getByRole('button',{name:'Verify event',exact:true}).click();
  await expect(panel.getByRole('button',{name:'Confirm event verification'})).toBeDisabled();
  await panel.getByLabel('Existing local event').selectOption('11');
  await expect(panel.getByText('Local Fellowship',{exact:true})).toBeVisible();
  expect(confirmations).toHaveLength(0);expect(f.pulls).toHaveLength(0);
  await panel.getByLabel('I checked the details and confirm these are the same event.').check();
  await panel.getByRole('button',{name:'Confirm event verification'}).click();
  await expect(panel).toContainText('Event and matching invitation links verified');
  expect(confirmations).toEqual([{event_identity:first,event_id:11,local_identity:second,local_fingerprint:'local-review',source:first,fingerprint:'reviewed',confirm_same_event:true}]);
  expect(f.pulls).toHaveLength(0);
  await expect(panel.getByRole('button',{name:'Verify event',exact:true})).toHaveCount(0);
});

for(const theme of ['light','dark'])test(`Admin bell preview and explicit selected Pull (${theme})`,async({page},info)=>{
  await page.setViewportSize(theme==='dark'?{width:390,height:844}:{width:1440,height:1000});
  const f=await fixture(page,theme);await page.getByRole('button',{name:'Notifications, 1 unread',exact:true}).click();
  await page.getByRole('button',{name:/Online invitation submissions/}).click();
  await expect(page.getByRole('heading',{name:'Event invitations & responses'})).toBeVisible();
  const panel=page.getByRole('region',{name:'Pending online submissions'});
  await expect(panel.getByRole('heading',{name:'Pending online submissions (2)'})).toBeVisible();
  expect(f.pulls).toHaveLength(0);
  await panel.getByRole('button',{name:'Preview submission 1',exact:true}).click();
  await expect(panel.getByText('Guest Online', {exact:true})).toBeVisible();expect(f.pulls).toHaveLength(0);
  await panel.getByLabel('Select submission 1').check();await panel.getByLabel('Select submission 2').check();
  await page.screenshot({path:info.outputPath('online-submissions-'+theme+'.png'),fullPage:true});
  await panel.getByRole('button',{name:'Pull Selected (2)',exact:true}).click();
  expect(f.pulls).toEqual([{event_id:11,submissions:[first,second]}]);
  await expect(panel.getByLabel('Pull results')).toContainText('Confirmation pending');
  await expect(panel.getByLabel('Pull results')).toContainText('Member counterpart cannot be verified');
  await expect(panel.getByText('Guest Online',{exact:true})).toHaveCount(0);
  await expect(panel.getByRole('heading',{name:'Pending online submissions (1)'})).toBeVisible();
  await panel.getByRole('button',{name:'Check online',exact:true}).click();
  await expect(panel).toContainText('Offline · Retrying');expect(f.pulls).toHaveLength(1);
  await panel.getByRole('button',{name:'Preview submission 1',exact:true}).click();
  await expect(panel.getByText('Guest Online',{exact:true})).toBeVisible();
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('auth:session-expired',{detail:{message:'Fixture expired'}})));
  await expect(page.getByText('Guest Online',{exact:true})).toHaveCount(0);
  await expect(panel).toContainText('Administrator session expired');
});

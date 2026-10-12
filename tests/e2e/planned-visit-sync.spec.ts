import {test,expect} from '@playwright/test';
for(const role of ['Admin','Pastor'])test(`${role} previews without import and pulls visits across pages`,async({page},info)=>{
 await page.setViewportSize(role==='Pastor'?{width:390,height:844}:{width:1440,height:1000});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(role=>{sessionStorage.setItem('dpc_intro_shown','true');localStorage.setItem('dpc_theme_mode',role==='Pastor'?'dark':'light');localStorage.setItem('chms_token','e30.'+btoa(JSON.stringify({exp:4102444800}))+'.test');localStorage.setItem(`dpc_help_welcome_v1:1:${role}`,'seen');},role);
 const pending=Array.from({length:32},(_,i)=>({submission:`${String(i+1).padStart(8,'0')}-1111-4111-8111-111111111111`,revision:'1',visit_date:'2099-01-04',updated_at:'2026-10-12T00:00:00Z',status:'Pending'}));
 const state={state:'Ready',source_id:'11111111-1111-4111-8111-111111111111',last_check:'2026-10-12T00:00:00Z',pending};
 const pulls:string[][]=[],previews:string[]=[];
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;let json:any=[];
  if(path.endsWith('/auth/setup-status'))json={hasUsers:true,hasAdmin:true};
  else if(path.endsWith('/auth/me'))json={user:{id:1,name:'Fixture staff',role_name:role,ministries:[]}};
  else if(path.endsWith('/planned-visit-sync/state')||path.endsWith('/planned-visit-sync/refresh'))json=state;
  else if(path.endsWith('/planned-visit-sync/preview')){previews.push(route.request().postDataJSON().submission);json={submission:route.request().postDataJSON().submission,revision:'1',full_name:'Online Visitor',visit_date:'2099-01-04',party:'With family',visitor_reply:'Confirmed',email:'fixture@example.test',bringing_children:true,child_age_groups:['Ages 3–5'],questions:'Welcome desk?'};}
  else if(path.endsWith('/planned-visit-sync/pull')){const ids=route.request().postDataJSON().submissions;pulls.push(ids);state.pending=state.pending.filter(p=>!ids.includes(p.submission));json={results:ids.map((submission:string)=>({submission,status:'Synchronized'})),unprocessed:[]};}
  else if(path.endsWith('/planned-visits'))json={items:[],total:0,page:1,totalPages:1};
  else if(path.endsWith('/notifications/unread-count'))json={count:0};
  else if(path.endsWith('/notifications'))json={items:[],total:0,totalPages:1};
  else if(path.endsWith('/reports/dashboard'))json={metrics:{},ministry_breakdown:[]};
  else if(path.endsWith('/reports/growth-insights'))json={summary:{},baptisms:[],attendance_trends:[],groups_list:[]};
  else if(path.endsWith('/members/birthdays'))json={celebrants:[],counts:{}};
  else if(path.endsWith('/members/baptism-candidates/qualified'))json={candidates:[],counts:{}};
  else if(path.endsWith('/settings/general'))json={settings:{},list:[]};
  await route.fulfill({json});
 });
 await page.goto('/');if(role==='Pastor')await page.getByRole('button',{name:'Toggle navigation menu'}).click();
 await page.locator('aside').getByTitle('Planned visits',{exact:true}).click();
 const panel=page.getByRole('region',{name:'Pending online visits',exact:true});
 await expect(panel.getByRole('heading',{name:'Pending online visits (32)'})).toBeVisible();
 await expect(panel.getByRole('table').getByText('Online Visitor',{exact:true})).toHaveCount(10);
 await expect(panel.getByRole('table').getByText('fixture@example.test',{exact:true})).toHaveCount(10);
 await expect(panel.getByRole('rowheader').first()).toHaveCSS('text-transform','none');
 expect(pulls).toHaveLength(0);
 expect(new Set(previews).size).toBe(10);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('online-visits.png'),fullPage:true});
 await panel.getByRole('button',{name:'Preview',exact:true}).first().click();await expect(panel.getByRole('heading',{name:'Online Visitor'})).toBeVisible();expect(pulls).toHaveLength(0);
 await panel.getByRole('button',{name:'Close preview'}).click();
 await panel.getByRole('button',{name:'Next online visits page'}).click();await expect(panel.getByText('Page 2 of 4')).toBeVisible();
 await expect(panel.getByRole('table').getByText('Online Visitor',{exact:true})).toHaveCount(10);
 expect(new Set(previews).size).toBe(20);expect(pulls).toHaveLength(0);
 await panel.getByRole('button',{name:'Select all pending (32)'}).click();
 await panel.getByRole('button',{name:'Pull Selected (32)'}).click();
 await expect(panel.getByRole('heading',{name:'Pending online visits (0)'})).toBeVisible();
 expect(pulls.map(p=>p.length)).toEqual([25,7]);expect(new Set(pulls.flat()).size).toBe(32);
});

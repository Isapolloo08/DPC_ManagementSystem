import {test,expect} from '@playwright/test';
// Set PLAYWRIGHT_VISIT_WEBSITE_URL to a running public landing-page preview.
const website=process.env.PLAYWRIGHT_VISIT_WEBSITE_URL;
test.skip(!website,'A public landing-page preview is required for these cross-repository cases.');
for(const mobile of [false,true])test(`visitor confirms, cancels and reschedules privately (${mobile?'mobile':'desktop'})`,async({page},info)=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});
 await page.emulateMedia({reducedMotion:'reduce'});
 const actions:string[]=[];let visit={visit_date:'2099-01-04',party:'With family',visitor_reply:'Pending',revision:'1'};
 await page.route('**/api/planned-visits/manage',async route=>{
  const body=route.request().postDataJSON();
  if(body.action){actions.push(body.action);visit={...visit,revision:String(Number(visit.revision)+1),visitor_reply:body.action==='confirm'?'Confirmed':body.action==='cancel'?'Cancelled':'Pending',visit_date:body.action==='reschedule'?body.visit_date:visit.visit_date};}
  await route.fulfill({json:visit});
 });
 await page.goto(website+'/#/visit/'+'a'.repeat(64));
 await expect(page.getByRole('heading',{name:'Your Sunday visit',exact:true})).toBeVisible();
 expect(actions).toHaveLength(0);
 await page.getByRole('button',{name:'Confirm my visit'}).click();await expect(page.getByRole('button',{name:'Confirm my visit'})).toBeDisabled();
 await page.getByRole('button',{name:'Cancel my visit'}).click();await expect(page.getByRole('button',{name:'Cancel my visit'})).toBeDisabled();
 await page.getByLabel('Choose another Sunday').fill('2099-01-11');await page.getByRole('button',{name:'Reschedule',exact:true}).click();
 await expect(page.getByRole('heading',{name:/January 11, 2099/})).toBeVisible();
 expect(actions).toEqual(['confirm','cancel','reschedule']);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('manage-visit.png'),fullPage:true});
});

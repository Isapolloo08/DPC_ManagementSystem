import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import {db} from '../db/schema';
import {validDate,manilaToday} from '../services/plannedVisits';
import {revision} from '../services/invitationSync';
const router=Router();
const summary=(row:any)=>({visit_date:row.visit_date,party:row.party,visitor_reply:row.visitor_reply,revision:String(row.sync_revision)});
router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.use(rateLimit({windowMs:60000,limit:30,standardHeaders:true,legacyHeaders:false}));
router.post('/',async(req,res)=>{
 const {token,action,expected_revision,visit_date}=req.body||{};
 if(typeof token!=='string'||!/^([a-f0-9]{64})$/.test(token))return res.status(400).json({error:'Invalid visitor link.'});
 if(action!==undefined&&!['confirm','cancel','reschedule'].includes(action))return res.status(400).json({error:'Choose a valid visit action.'});
 if(action&&!revision(expected_revision))return res.status(400).json({error:'Reload the visit before making changes.'});
 if(action==='reschedule'&&(!validDate(visit_date)||visit_date<manilaToday()||new Date(visit_date+'T00:00:00Z').getUTCDay()!==0))return res.status(400).json({error:'Choose today or an upcoming Sunday.'});
 try {
  const result=await db.transaction(async c=>{
   const row=(await c.query('SELECT id,visit_date::text,party,visitor_reply,sync_revision::text FROM planned_visits WHERE management_token=$1 FOR UPDATE',[token])).rows[0];
   if(!row)return {status:404,error:'Visitor link not found.'};
   if(!action)return {status:200,data:summary(row)};
   if(row.visit_date<manilaToday())return {status:409,error:'This visit date has passed. Please contact the church.'};
   const reply=action==='confirm'?'Confirmed':action==='cancel'?'Cancelled':'Pending';
   const date=action==='reschedule'?visit_date:row.visit_date;
   // Retrying a successful click must not generate another revision.
   if(row.visitor_reply===reply&&row.visit_date===date)return {status:200,data:summary(row)};
   if(row.sync_revision!==expected_revision)return {status:409,error:'Your visit changed. Reload it before trying again.'};
   const changed=(await c.query(`UPDATE planned_visits SET visitor_reply=$1,visit_date=$2,updated_at=now() WHERE id=$3 RETURNING visit_date::text,party,visitor_reply,sync_revision::text`,[reply,date,row.id])).rows[0];
   return {status:200,data:summary(changed)};
  });
  return res.status(result.status).json(result.data||{error:result.error});
 }catch{return res.status(503).json({error:'Unable to update your visit. Reload it to check before retrying.'});}
});
export default router;

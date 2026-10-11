import {db} from '../db/schema';
import {invitationSync,SyncError,uuid,revision,digest} from './invitationSync';
import {validateVisit} from './plannedVisits';
import {JWT_SECRET} from '../middleware/auth';
import jwt from 'jsonwebtoken';
import {getActiveVisitStaffIds,emitVisitStaffEvent,getIO} from '../socket';

export const visitPayloadColumns=`receipt_id AS submission,sync_revision::text AS revision,submission_token,visit_date::text,
 party,bringing_children,child_age_groups,full_name,email,phone,questions,consent_at,created_at,updated_at,visitor_reply`;
export function checkedVisit(payload:any,id:string) {
  if(!payload||payload.submission!==id||!uuid(id)||!revision(payload.revision)||!['Pending','Confirmed','Cancelled'].includes(payload.visitor_reply)
    ||!['created_at','updated_at','consent_at'].every(k=>typeof payload[k]==='string'&&Number.isFinite(Date.parse(payload[k])))) throw new SyncError('Invalid online visit identity or revision.',409);
  const validated=validateVisit({...payload,email:payload.email??'',phone:payload.phone??'',consent:true},'0000-00-00');
  if(Object.keys(validated.errors).length) throw new SyncError('Online visit failed validation.',409);
  return {...validated.data,submission:payload.submission,revision:payload.revision,submission_token:payload.submission_token,
    visitor_reply:payload.visitor_reply,created_at:payload.created_at,updated_at:payload.updated_at,consent_at:payload.consent_at};
}
export async function visitAuthorized(header:string,id:number) {
  try {
    const claims=jwt.verify(header.replace(/^Bearer /,''),JWT_SECRET) as {id:number};
    const user=await db.get('SELECT r.name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1',[id]);
    return claims.id===id&&user&&['Admin','IT Admin','Pastor'].includes(user.name);
  } catch {return false;}
}

class PlannedVisitSync {
  private refreshing:Promise<void>|null=null;
  async state() {
    const node=await invitationSync.node();
    const status=await db.get('SELECT state,last_check FROM visit_sync_state WHERE id=1');
    const pending=await db.all(`SELECT p.submission,p.revision::text,p.visit_date::text,p.updated_at,
      CASE WHEN r.confirmed THEN 'Synchronized' WHEN r.submission IS NOT NULL THEN 'Confirmation pending' ELSE 'Pending' END AS status
      FROM visit_sync_pending p JOIN invitation_sync_node n ON n.source_id=p.source
      LEFT JOIN visit_sync_receipts r ON r.source=p.source AND r.receiver=n.identity AND r.submission=p.submission AND r.revision=p.revision
       AND EXISTS(SELECT 1 FROM planned_visits v WHERE v.id=r.visit_id AND v.receipt_id=r.submission AND v.sync_revision>=r.revision)
      WHERE r.submission IS NULL OR NOT r.confirmed ORDER BY p.updated_at DESC,p.submission`);
    return {state:node.source_id?status.state:'Not paired',source_id:node.source_id,last_check:status.last_check,pending};
  }
  async changed() {
    for(const id of await getActiveVisitStaffIds()) await emitVisitStaffEvent(id,'visit-sync:changed',{});
  }
  async notify() {
    const node=await invitationSync.node(),state=await this.state();
    const staff=await db.all<{id:number}>("SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name IN ('Admin','IT Admin','Pastor')");
    for(const user of staff) {
      const saved=await db.transaction(async c=>{
        let changed=false;
        for(const p of state.pending.filter(p=>p.status==='Pending')) {
          const claim=await c.query(`INSERT INTO notification_log(event_type,event_key,channel,recipient,status)
            VALUES('online_planned_visit',$1,'in_app',$2,'sent') ON CONFLICT DO NOTHING RETURNING id`,[node.source_id+':'+p.submission+':'+p.revision,String(user.id)]);
          changed ||= !!claim.rowCount;
        }
        const existing=(await c.query("SELECT id FROM notifications WHERE user_id=$1 AND type='online_planned_visit' ORDER BY id DESC LIMIT 1 FOR UPDATE",[user.id])).rows[0];
        const count=state.pending.filter(p=>p.status==='Pending').length;
        const message=`${count} online visit request(s) require manual Pull.`;
        if(existing)return (await c.query('UPDATE notifications SET message=$1,is_read=CASE WHEN $2 THEN false ELSE is_read END,created_at=CASE WHEN $2 THEN now() ELSE created_at END WHERE id=$3 RETURNING *',[message,changed,existing.id])).rows[0];
        if(!changed)return null;
        return (await c.query(`INSERT INTO notifications(user_id,type,title,message,link_tab) VALUES($1,'online_planned_visit','Online planned visits',$2,'plannedvisits') RETURNING *`,[user.id,message])).rows[0];
      });
      if(saved)await emitVisitStaffEvent(user.id,'notification:updated',saved);
    }
    await this.changed();
  }
  async refresh() {
    if(this.refreshing)return this.refreshing;
    this.refreshing=this.discover().finally(()=>{this.refreshing=null;});return this.refreshing;
  }
  private async discover() {
    const node=await invitationSync.node();
    try {
      const items:any[]=[];const seen=new Set<string>();let cursor:string|null=null;
      do {
        const page=await invitationSync.request('visits/metadata'+(cursor?'?cursor='+cursor:''));
        if(!Array.isArray(page.items)||page.items.length>100||(page.next!==null&&!uuid(page.next)))throw new SyncError('Invalid online visit metadata.',503);
        for(const item of page.items) {
          if(!uuid(item.submission)||!revision(item.revision)||seen.has(item.submission)||typeof item.visit_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(item.visit_date)||!Number.isFinite(Date.parse(item.updated_at)))throw new SyncError('Invalid online visit metadata.',503);
          seen.add(item.submission);items.push(item);
        }
        if(page.next!==null&&(!page.items.length||page.next!==page.items.at(-1).submission||page.next<=String(cursor||'')))throw new SyncError('Incomplete visit pagination.',503);
        cursor=page.next;if(items.length>=10000&&cursor)throw new SyncError('Online availability limit reached.',503);
      }while(cursor);
      await db.transaction(async c=>{
        await c.query('DELETE FROM visit_sync_pending WHERE source=$1',[node.source_id]);
        for(const p of items)await c.query('INSERT INTO visit_sync_pending(source,submission,revision,visit_date,updated_at) VALUES($1,$2,$3,$4,$5)',[node.source_id,p.submission,p.revision,p.visit_date,p.updated_at]);
        await c.query("UPDATE visit_sync_state SET state='Ready',last_check=now() WHERE id=1");
      });
      await this.notify();
    }catch(error){await db.run('UPDATE visit_sync_state SET state=$1 WHERE id=1',[error instanceof SyncError&&error.status===401?'Reconnect required':'Offline · Retrying']);await this.changed();throw error;}
  }
  async preview(id:string) {
    if(!uuid(id))throw new SyncError('Invalid visit identity.',400);
    return checkedVisit(await invitationSync.request('visits/submissions/'+id),id);
  }
  async pull(id:string,userId:number,header:string) {
    const node=await invitationSync.node(),payload=await this.preview(id);
    const {updated_at:_updated,...content}=payload;
    const hash=digest(JSON.stringify(content));
    await db.transaction(async c=>{
      await c.query('SELECT pg_advisory_xact_lock(237024)');
      // Recheck identity and permissions after the remote call, inside the commit boundary.
      const claims=jwt.verify(header.replace(/^Bearer /,''),JWT_SECRET) as {id:number};
      const role=(await c.query('SELECT r.name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1',[userId])).rows[0];
      if(claims.id!==userId||!role||!['Admin','IT Admin','Pastor'].includes(role.name))throw new SyncError('Visit authorization expired or revoked.',403);
      const current=(await c.query('SELECT identity,source_id FROM invitation_sync_node WHERE id=1 FOR SHARE')).rows[0];
      if(current.identity!==node.identity||current.source_id!==node.source_id)throw new SyncError('Visit source changed during Pull.',409);
      const receipt=(await c.query('SELECT payload_hash,visit_id FROM visit_sync_receipts WHERE source=$1 AND receiver=$2 AND submission=$3 AND revision=$4',[node.source_id,node.identity,id,payload.revision])).rows[0];
      if(receipt&&receipt.payload_hash!==hash)throw new SyncError('Same visit revision contains different data.',409);
      const existing=(await c.query('SELECT *,visit_date::text AS visit_date FROM planned_visits WHERE receipt_id=$1 OR submission_token=$2 FOR UPDATE',[id,payload.submission_token])).rows;
      if(existing.length>1||(existing[0]&&(existing[0].receipt_id!==id||existing[0].submission_token!==payload.submission_token)))throw new SyncError('Visit identity conflict; no data imported.',409);
      if(receipt&&(!existing[0]||existing[0].id!==receipt.visit_id||BigInt(existing[0].sync_revision)<BigInt(payload.revision)))throw new SyncError('Visit receipt is inconsistent with the local record.',409);
      if(receipt)return;
      if(existing[0]&&BigInt(existing[0].sync_revision)>BigInt(payload.revision))throw new SyncError('Online revision is older than the local visit.',409);
      if(existing[0]?.status==='Visited'&&existing[0].visit_date!==payload.visit_date)throw new SyncError('A recorded arrival cannot be moved to another date. Review this visit with the church staff.',409);
      const fields=[payload.visit_date,payload.party,payload.bringing_children,payload.child_age_groups,payload.full_name,payload.email,payload.phone,payload.questions,payload.visitor_reply,payload.revision];
      let visitId=existing[0]?.id;
      if(visitId) {
        // Visitor replies never overwrite staff notes or a confirmed arrival.
        await c.query(`UPDATE planned_visits SET visit_date=$1,party=$2,bringing_children=$3,child_age_groups=$4,full_name=$5,email=$6,phone=$7,questions=$8,visitor_reply=$9,sync_revision=$10,
          status=CASE WHEN status='Visited' THEN status WHEN $9='Cancelled' THEN 'Cancelled' WHEN status='Cancelled' THEN 'New' ELSE status END WHERE id=$11`,[...fields,visitId]);
      }else {
        visitId=(await c.query(`INSERT INTO planned_visits(visit_date,party,bringing_children,child_age_groups,full_name,email,phone,questions,visitor_reply,sync_revision,receipt_id,submission_token,payload_hash,consent_at,created_at,updated_at,status)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,CASE WHEN $9='Cancelled' THEN 'Cancelled' ELSE 'New' END) RETURNING id`,[...fields,id,payload.submission_token,hash,payload.consent_at,payload.created_at,payload.updated_at])).rows[0].id;
      }
      await c.query('INSERT INTO visit_sync_receipts(source,receiver,submission,revision,visit_id,payload_hash) VALUES($1,$2,$3,$4,$5,$6)',[node.source_id,node.identity,id,payload.revision,visitId,hash]);
      await c.query("INSERT INTO audit_logs(user_id,action,target_table,target_id,details) VALUES($1,'PULL_ONLINE_VISIT','planned_visits',$2,$3)",[userId,visitId,JSON.stringify({source:node.source_id,submission:id,revision:payload.revision})]);
    });
    let confirmed=true;try{await this.confirm(id,payload.revision);}catch{confirmed=false;}
    await this.notify();return {submission:id,status:confirmed?'Synchronized':'Confirmation pending'};
  }
  async confirm(id:string,rev:string) {
    const node=await invitationSync.node();
    const receipt=await db.get(`SELECT r.submission FROM visit_sync_receipts r JOIN planned_visits v ON v.id=r.visit_id AND v.receipt_id=r.submission AND v.sync_revision>=r.revision WHERE r.source=$1 AND r.receiver=$2 AND r.submission=$3 AND r.revision=$4`,[node.source_id,node.identity,id,rev]);
    if(!receipt)throw new SyncError('No committed local visit receipt.',409);
    const result=await invitationSync.request('visits/confirm',{method:'POST',body:JSON.stringify({submission:id,revision:rev})});
    if(result.confirmed!==true||result.submission!==id||result.revision!==rev)throw new SyncError('Online confirmation did not match the visit.',503);
    await db.run('UPDATE visit_sync_receipts SET confirmed=true WHERE source=$1 AND receiver=$2 AND submission=$3 AND revision=$4',[node.source_id,node.identity,id,rev]);
  }
  async recover() {
    const node=await invitationSync.node();
    for(const r of await db.all(`SELECT submission,revision::text FROM visit_sync_receipts WHERE source=$1 AND receiver=$2 AND NOT confirmed ORDER BY submission,revision LIMIT 25`,[node.source_id,node.identity]))await this.confirm(r.submission,r.revision).catch(()=>{});
  }
}
export const plannedVisitSync=new PlannedVisitSync();
export function startPlannedVisitSyncJobs() {
  let stopped=false,running=false,failures=0;
  let timer:NodeJS.Timeout;
  const run=async()=>{
    if(stopped||running)return;clearTimeout(timer);running=true;
    try {if((await invitationSync.node()).source_id&&(await getActiveVisitStaffIds()).length){await plannedVisitSync.recover();await plannedVisitSync.refresh();failures=0;}}
    catch{failures=Math.min(failures+1,4);}finally{running=false;}
    if(!stopped){timer=setTimeout(run,Math.min(300000,30000*2**failures));timer.unref();}
  };
  timer=setTimeout(run,0);timer.unref();const io=getIO(),wake=()=>{void run();};io?.on('connection',wake);
  return()=>{stopped=true;clearTimeout(timer);io?.off('connection',wake);};
}

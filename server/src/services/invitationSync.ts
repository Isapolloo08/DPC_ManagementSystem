import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { db } from '../db/schema';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, logAuditAction } from '../middleware/auth';
import { notifyPendingInvitations,updateOnlineInvitationCounts } from './notificationService';
import { emitUserEvent, getActiveAdminIds, getIO } from '../socket';

export class SyncError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
export const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export const revision = (value: unknown): value is string => typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value)<=9223372036854775807n;
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');

function encryptionKey() {
  const key = process.env.INVITATION_SYNC_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(key)) throw new SyncError('Configure the backend invitation synchronization encryption key before pairing.',503);
  return Buffer.from(key,'hex');
}
function protect(token: string) {
  const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
  return Buffer.concat([iv,cipher.update(token,'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64');
}
function reveal(value: string) {
  try {
    const data=Buffer.from(value,'base64'),cipher=createDecipheriv('aes-256-gcm',encryptionKey(),data.subarray(0,12));
    cipher.setAuthTag(data.subarray(-16)); return Buffer.concat([cipher.update(data.subarray(12,-16)),cipher.final()]).toString('utf8');
  } catch { throw new SyncError('Reconnect required: integration credential cannot be unlocked.',401); }
}

export function sourceOrigin(raw: unknown) {
  if(typeof raw!=='string') throw new SyncError('Choose the verified online API origin.',400);
  let url: URL; try { url=new URL(raw); } catch { throw new SyncError('Choose a valid online API origin.',400); }
  const allowed=(process.env.INVITATION_SYNC_ALLOWED_ORIGINS || 'https://dpc-managementsystem.onrender.com').split(',').map(s=>s.trim());
  const testLoopback=process.env.NODE_ENV==='test' && url.hostname==='127.0.0.1' && url.protocol==='http:';
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||(!testLoopback&&(url.protocol!=='https:'||!allowed.includes(url.origin))))
    throw new SyncError('The online API origin must be explicitly allowed by the Master backend.',400);
  return url.origin;
}

export async function remoteJson(origin: string, path: string, token: string, init: RequestInit = {}, headers: Record<string,string> = {}) {
  let response: globalThis.Response;
  try {
    response=await fetch(origin+'/api/'+path,{...init,redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,...headers}});
  } catch { throw new SyncError('Online service unavailable. Last-known availability is stale.',503); }
  if(response.status===401||response.status===403) throw new SyncError('Reconnect required: online authorization is unavailable.',401);
  if(response.status===429) throw new SyncError('Online service is rate limited. Please retry later.',429);
  if(!response.ok) throw new SyncError('Online request failed. No synchronization success was assumed.',[404,409].includes(response.status)?409:503);
  const text=await response.text(); if(text.length>2_000_000) throw new SyncError('Online response exceeded the supported limit.',503);
  try { return JSON.parse(text); } catch { throw new SyncError('Online response format is unsupported.',503); }
}

export class InvitationSync {
  private refreshing: Promise<void> | null = null;
  async node() {
    try {
      const node=await db.get('SELECT * FROM invitation_sync_node WHERE id=1');
      const capabilities=await db.get(`SELECT to_regclass('invitation_sync_receipts') AS receipts,to_regclass('invitation_sync_pending') AS pending,
        (SELECT count(*)::int FROM pg_trigger WHERE tgrelid='event_invitation_responses'::regclass AND tgname IN ('invitation_response_revision','retain_pending_invitation_response','retain_pending_invitation_truncate')) AS protections`);
      if(!node||!capabilities?.receipts||!capabilities.pending||capabilities.protections!==3) throw new Error('Missing receiver schema protections'); return node;
    } catch { throw new SyncError('Synchronization schema is not ready. Apply the approved migration before use.',503); }
  }
  async state() {
    const node=await this.node();
    const pending=await db.all(`SELECT p.submission,p.revision::text,p.event_identity,p.event_title,p.updated_at,e.id AS event_id,
      CASE WHEN r.submission IS NOT NULL AND r.confirmed THEN 'Synchronized'
           WHEN r.submission IS NOT NULL THEN 'Imported locally · Confirmation pending' ELSE 'Pending' END AS status
      FROM invitation_sync_pending p LEFT JOIN events e ON e.sync_identity=p.event_identity
      LEFT JOIN invitation_sync_receipts r ON r.source=p.source AND r.receiver=$1 AND r.submission=p.submission AND r.revision=p.revision
        AND EXISTS(SELECT 1 FROM event_invitation_responses b WHERE b.id=r.response_id AND b.sync_identity=r.submission AND b.sync_revision=r.revision)
      JOIN invitation_sync_node n ON n.source_id=p.source
      WHERE r.submission IS NULL OR NOT r.confirmed ORDER BY p.updated_at DESC`,[node.identity]);
    return {state:node.state,source_url:node.source_url,source_id:node.source_id,receiver:node.identity,last_check:node.last_check,pending};
  }
  async inspect(body: any) {
    encryptionKey(); const origin=sourceOrigin(body.url);
    if(typeof body.username!=='string'||typeof body.password!=='string'||!body.username.trim()||!body.password) throw new SyncError('Enter cloud Admin credentials for pairing.',400);
    const info=await remoteJson(origin,'invitation-sync/authorize','',{method:'POST',body:JSON.stringify({username:body.username,password:body.password})});
    if(!uuid(info.source)) throw new SyncError('Online source identity is invalid.',409);
    return {origin,source:info.source};
  }
  async pair(body: any) {
    const node=await this.node(),remote=await this.inspect(body);
    if(body.expected_source!==remote.source) throw new SyncError('Verify the displayed source identity before confirming pairing.',409);
    if(node.source_id&&node.source_id!==remote.source) throw new SyncError('Source identity mismatch. Existing receiver history cannot be silently reassigned.',409);
    if(node.identity===remote.source) throw new SyncError('The online source and Local Master must be separate databases.',409);
    const paired=await remoteJson(remote.origin,'invitation-sync/authorize','',{method:'POST',body:JSON.stringify({username:body.username,password:body.password,receiver:node.identity,expected_source:remote.source})});
    if(paired.source!==remote.source||typeof paired.credential!=='string'||!/^dpc_[a-f0-9]{64}$/.test(paired.credential)) throw new SyncError('Pairing response identity is invalid.',409);
    await db.run("UPDATE invitation_sync_node SET source_id=$1,source_url=$2,credential=$3,state='Ready' WHERE id=1",[remote.source,remote.origin,protect(paired.credential)]);
    return this.state();
  }
  async request(path: string, init: RequestInit = {}) {
    const node=await this.node();
    if(!node.source_id||!node.credential||!node.source_url) throw new SyncError('Pair the Local Master before checking submissions.',409);
    const result=await remoteJson(sourceOrigin(node.source_url),'invitation-sync/source/'+path,reveal(node.credential),init,{'X-Sync-Source':node.source_id,'X-Sync-Receiver':node.identity});
    if(result.source!==node.source_id) throw new SyncError('Online source identity mismatch.',409);
    return result;
  }
  async authorized(header: string, id: number) {
    try {
      const claims=jwt.verify(header.replace(/^Bearer /,''),JWT_SECRET) as {id:number};
      const user=await db.get('SELECT r.name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1',[id]);
      return claims.id===id&&user&&['Admin','IT Admin'].includes(user.name);
    } catch { return false; }
  }
  async refresh() {
    if(this.refreshing) return this.refreshing;
    this.refreshing=this.discover().finally(()=>{this.refreshing=null;});
    return this.refreshing;
  }
  private async discover() {
    const node=await this.node();
    try {
      const items:any[]=[];let cursor:string|null=null;const seen=new Set<string>();
      do {
        const page=await this.request('metadata'+(cursor?'?cursor='+encodeURIComponent(cursor):''));
        if(!Array.isArray(page.items)||page.items.length>100||(!uuid(page.next)&&page.next!==null)) throw new SyncError('Incomplete online availability response.',503);
        for(const item of page.items) {
          if(!uuid(item.submission)||!uuid(item.event_identity)||!revision(item.revision)||typeof item.event_title!=='string'||item.event_title.length>1000||!Number.isFinite(Date.parse(item.updated_at))||seen.has(item.submission)) throw new SyncError('Invalid online availability metadata.',503);
          seen.add(item.submission);items.push(item);
        }
        if(page.next!==null&&(!page.items.length||page.next!==page.items[page.items.length-1].submission||page.next<=String(cursor||''))) throw new SyncError('Invalid online availability pagination.',503);
        cursor=page.next;
        if(items.length>=10000&&cursor) throw new SyncError('Availability limit reached; cached results remain stale.',503);
      } while(cursor);
      await db.transaction(async c=>{
        await c.query('DELETE FROM invitation_sync_pending WHERE source=$1',[node.source_id]);
        for(const p of items) await c.query('INSERT INTO invitation_sync_pending(source,submission,revision,event_identity,event_title,updated_at) VALUES($1,$2,$3,$4,$5,$6)',[node.source_id,p.submission,p.revision,p.event_identity,p.event_title,p.updated_at]);
        await c.query("UPDATE invitation_sync_node SET last_check=now(),state='Ready' WHERE id=1 AND source_id=$1",[node.source_id]);
      });
      const state=await this.state();
      await notifyPendingInvitations(node.source_id,state.pending.filter(p=>p.status==='Pending'));
      await updateOnlineInvitationCounts();
      for(const id of await getActiveAdminIds()) emitUserEvent(id,'invitation-sync:changed',{});
    } catch(error) {
      const state=error instanceof SyncError&&[401,403].includes(error.status)?'Reconnect required':'Offline · Retrying';
      await db.run('UPDATE invitation_sync_node SET state=$1 WHERE id=1',[state]);
      for(const id of await getActiveAdminIds()) emitUserEvent(id,'invitation-sync:changed',{});
      throw error;
    }
  }
  private validate(payload: any, id: string) {
    if(payload.submission!==id||!uuid(payload.event_identity)||!uuid(payload.invitation_identity)||(payload.member_identity!==null&&!uuid(payload.member_identity))||!revision(payload.revision)||!['yes','no','maybe'].includes(payload.answer)||typeof payload.name!=='string'||!payload.name.trim()||payload.name.length>120||typeof payload.contact!=='string'||payload.contact.length>160||typeof payload.reason!=='string'||payload.reason.length>1000||(payload.answer==='no'&&!payload.reason.trim())||(!payload.member_identity&&!payload.contact.trim())) throw new SyncError('Online submission validation failed.',409);
  }
  private async mapping(c: {query: Function}, payload: any) {
    const event=(await c.query('SELECT id FROM events WHERE sync_identity=$1',[payload.event_identity])).rows[0];
    const link=(await c.query('SELECT id,event_id,member_id FROM event_invitation_links WHERE sync_identity=$1',[payload.invitation_identity])).rows[0];
    const member=payload.member_identity?(await c.query('SELECT id FROM members WHERE sync_identity=$1',[payload.member_identity])).rows[0]:null;
    if(!event||!link||link.event_id!==event.id||(payload.member_identity&&!member)||(link.member_id!=null&&link.member_id!==member?.id)) throw new SyncError('Blocked: existing event, member or invitation counterparts cannot be verified. Arrange explicit provenance repair.',409);
    return {event,link,member};
  }
  async preview(id: unknown) {
    if(!uuid(id)) throw new SyncError('Invalid submission identity.',400);
    const payload=await this.request('submissions/'+id);this.validate(payload,id);
    let blocked:string|null=null;
    try {await this.mapping({query:db.query.bind(db)},payload);} catch(error) {if(error instanceof SyncError)blocked=error.message;else throw error;}
    return {...payload,blocked};
  }
  async pull(id: string, eventId: number, userId: number, authHeader: string) {
    const node=await this.node(),payload=await this.request('submissions/'+id);this.validate(payload,id);
    const result=await db.transaction(async c=>{
      await c.query('SELECT pg_advisory_xact_lock(237024)');
      const claims=jwt.verify(authHeader.replace(/^Bearer /,''),JWT_SECRET) as {id:number};
      const role=(await c.query('SELECT r.name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1',[userId])).rows[0];
      if(claims.id!==userId||!role||!['Admin','IT Admin'].includes(role.name)) throw new SyncError('Admin authorization expired or revoked.',403);
      const {event,link,member}=await this.mapping(c,payload);
      if(event.id!==eventId) throw new SyncError('Submission belongs to another event.',409);
      const previous=(await c.query('SELECT r.revision::text,r.confirmed,b.sync_identity,b.sync_revision::text AS business_revision FROM invitation_sync_receipts r JOIN event_invitation_responses b ON b.id=r.response_id WHERE r.source=$1 AND r.receiver=$2 AND r.submission=$3 ORDER BY r.revision DESC LIMIT 1',[node.source_id,node.identity,id])).rows[0];
      if(previous&&(previous.sync_identity!==id||previous.business_revision!==previous.revision)) throw new SyncError('Blocked: local response and import receipt disagree. Arrange explicit integrity repair.',409);
      if(previous&&BigInt(previous.revision)>=BigInt(payload.revision)) return {revision:previous.revision,already:true,confirmed:previous.confirmed};
      const existing=(await c.query('SELECT id,sync_identity FROM event_invitation_responses WHERE sync_identity=$1 OR (event_id=$2 AND member_id=$3) FOR UPDATE',[id,event.id,member?.id||null])).rows;
      if(existing.length>1) throw new SyncError('Blocked: local responses have conflicting provenance.',409);
      const adopt=existing[0]&&existing[0].sync_identity!==id;
      if(adopt) {
        const history=await c.query('SELECT 1 FROM invitation_sync_receipts WHERE response_id=$1 LIMIT 1',[existing[0].id]);
        if(!member||history.rowCount) throw new SyncError('Blocked: a local response has conflicting or unverified provenance.',409);
        // Verified event/member identity establishes the existing unique member RSVP;
        // only this deliberate Pull can adopt its previously untracked response.
        await c.query('UPDATE event_invitation_responses SET sync_identity=$1 WHERE id=$2',[id,existing[0].id]);
      }
      const params=[link.id,'sync:'+id,payload.name.trim(),payload.contact.trim(),payload.answer,payload.reason,event.id,member?.id||null,id,payload.revision];
      const saved=(await c.query(`INSERT INTO event_invitation_responses(invitation_id,response_key,name,contact,answer,reason,event_id,member_id,sync_identity,sync_revision)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(sync_identity) DO UPDATE SET
        name=EXCLUDED.name,contact=EXCLUDED.contact,answer=EXCLUDED.answer,reason=EXCLUDED.reason,sync_revision=EXCLUDED.sync_revision,updated_at=now() RETURNING id`,params)).rows[0];
      if(member) await c.query(`INSERT INTO event_registrations(event_id,member_id,status) VALUES($1,$2,$3)
        ON CONFLICT(event_id,member_id) DO UPDATE SET status=EXCLUDED.status WHERE event_registrations.status NOT IN ('attended','checked_in')`,[event.id,member.id,payload.answer==='yes'?'registered':payload.answer==='no'?'cancelled':'pending']);
      await c.query('INSERT INTO invitation_sync_receipts(source,receiver,submission,revision,response_id) VALUES($1,$2,$3,$4,$5)',[node.source_id,node.identity,id,payload.revision,saved.id]);
      return {revision:payload.revision,already:false,confirmed:false};
    });
    let confirmed=result.confirmed;
    if(!confirmed) confirmed=await this.confirm(id,result.revision).catch(()=>false);
    await logAuditAction(userId,'INVITATION_PULL','events',eventId,result.already?'Reconciled previously imported online submission':'Imported an online invitation submission');
    await updateOnlineInvitationCounts().catch(()=>undefined);
    for(const admin of await getActiveAdminIds()) emitUserEvent(admin,'invitation-sync:changed',{});
    return {submission:id,revision:result.revision,status:confirmed?'Synchronized':'Imported locally · Confirmation pending',already_imported:result.already};
  }
  async confirm(id: string, rev: string) {
    const node=await this.node();
    const receipt=await db.get('SELECT confirmed FROM invitation_sync_receipts WHERE source=$1 AND receiver=$2 AND submission=$3 AND revision=$4',[node.source_id,node.identity,id,rev]);
    if(!receipt) throw new SyncError('No committed local receipt exists.',409);
    if(receipt.confirmed) return true;
    try {
      const ack=await this.request('confirm',{method:'POST',body:JSON.stringify({submission:id,revision:rev})});
      if(!ack.confirmed||ack.submission!==id||ack.revision!==rev) throw new SyncError('Online confirmation did not match the committed revision.',503);
      await db.run('UPDATE invitation_sync_receipts SET confirmed=true WHERE source=$1 AND receiver=$2 AND submission=$3 AND revision=$4',[node.source_id,node.identity,id,rev]);
      await updateOnlineInvitationCounts().catch(()=>undefined);return true;
    } catch(error) {
      await db.run(`UPDATE invitation_sync_receipts SET attempts=attempts+1,next_attempt=now()+make_interval(secs=>LEAST(3600,30*power(2,LEAST(attempts,7)))::integer) WHERE source=$1 AND receiver=$2 AND submission=$3 AND revision=$4`,[node.source_id,node.identity,id,rev]);
      if(error instanceof SyncError&&[401,403].includes(error.status)) {
        await db.run("UPDATE invitation_sync_node SET state='Reconnect required' WHERE id=1");
        for(const admin of await getActiveAdminIds()) emitUserEvent(admin,'invitation-sync:changed',{});
      }
      throw error;
    }
  }
  async recoverConfirmations() {
    const node=await this.node();if(!node.source_id||!node.credential) return;
    const receipts=await db.all(`SELECT submission,revision::text FROM invitation_sync_receipts WHERE source=$1 AND receiver=$2 AND NOT confirmed AND next_attempt<=now() ORDER BY next_attempt LIMIT 25`,[node.source_id,node.identity]);
    for(const r of receipts) await this.confirm(r.submission,r.revision).catch(()=>false);
  }
}
export const invitationSync = new InvitationSync();

export function startInvitationSyncJobs() {
  let stopped=false,failures=0,running=false;
  const run=async()=>{
    if(stopped||running) return;
    clearTimeout(timer);running=true;
    try {
      await invitationSync.recoverConfirmations();
      if((await invitationSync.node()).source_id&&(await getActiveAdminIds()).length) {await invitationSync.refresh();failures=0;}
    } catch {failures=Math.min(failures+1,7);}
    finally {running=false;}
    if(!stopped) timer=setTimeout(run,failures?Math.min(300000,30000*2**failures)+Math.random()*3000:30000);
    timer?.unref();
  };
  let timer:NodeJS.Timeout=setTimeout(run,0);timer.unref();
  const io=getIO();const wake=()=>{void run();};io?.on('connection',wake);
  return ()=>{stopped=true;clearTimeout(timer);io?.off('connection',wake);};
}

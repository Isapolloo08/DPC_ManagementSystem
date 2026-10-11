import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {AsyncLocalStorage} from 'async_hooks';
import {randomUUID} from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import {AddressInfo} from 'net';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import syncRouter from './invitationSync';
import invitationRouter from './eventInvitations';
import {db,sql} from '../db/schema';
import backupRouter from './backup';
import {transferTables,SyncSql} from '../db/cloudSyncTransfer';
import {JWT_SECRET} from '../middleware/auth';

test('online guest discovery and preview never import; manual Pull is atomic and recoverable',async t=>{
  const config={host:'127.0.0.1',port:5432,user:'postgres',password:'admin123',database:'chms_db',connectionTimeoutMillis:2000};
  const admin=new Pool(config);
  try {await admin.query('SELECT 1');} catch {await admin.end();t.skip('Local PostgreSQL fixture unavailable');return;}
  const names=['source','local'].map(x=>'sync_'+x+'_'+randomUUID().replace(/-/g,''));
  for(const name of names) await admin.query(`CREATE SCHEMA ${name}`);
  const pools=names.map(name=>new Pool({...config,options:`-c search_path=${name}`}));
  const context=new AsyncLocalStorage<Pool>();
  const originals={get:db.get,all:db.all,run:db.run,transaction:db.transaction,query:db.query};
  const oldSqlBegin=sql.begin;
  let failConfirmation=false;
  const servers=pools.map((pool,index)=>{
    const app=express();app.use(express.json());app.use((_req,_res,next)=>context.run(pool,next));
    app.use('/api/invitation-sync/source/confirm',(_req,res,next)=>{if(index===0&&failConfirmation)res.status(503).json({error:'Controlled transport fault'});else next();});
    app.use('/api/invitation-sync',syncRouter);app.use('/api/event-invitations',invitationRouter);app.use('/api/backup',backupRouter);return app.listen(0);
  });
  await Promise.all(servers.map(s=>new Promise<void>(r=>s.once('listening',r))));
  const origins=servers.map(s=>`http://127.0.0.1:${(s.address() as AddressInfo).port}`);
  const oldEnv={mode:process.env.NODE_ENV,key:process.env.INVITATION_SYNC_ENCRYPTION_KEY};
  process.env.NODE_ENV='test';process.env.INVITATION_SYNC_ENCRYPTION_KEY='1'.repeat(64);
  const token='a'.repeat(64),eventIdentity=randomUUID(),linkIdentity=randomUUID();
  const auth={Authorization:'Bearer '+jwt.sign({id:501},JWT_SECRET,{expiresIn:'1h'}),'Content-Type':'application/json'};
  const call=(side:number,route:string,body?:any)=>fetch(origins[side]+'/api/invitation-sync/'+route,{headers:auth,method:body===undefined?'GET':'POST',body:body===undefined?undefined:JSON.stringify(body)});
  try {
    for(const pool of pools) {
      for(const name of ['001_init_postgres.sql','007_notifications.sql','015_cloud_sync_columns.sql','017_family_tree.sql','020_event_invitations.sql','021_invitation_member_responses.sql','022_event_ministries.sql','023_invitation_sync.sql','024_event_guest_attendance.sql']) await pool.query(fs.readFileSync(path.join(__dirname,'../db/migrations',name),'utf8'));
      await pool.query("ALTER TABLE users ADD COLUMN temp_password TEXT; INSERT INTO roles(id,name) VALUES(501,'Admin'),(502,'Pastor')");
      await pool.query("INSERT INTO users(id,name,email,password_hash,role_id) VALUES(501,'Admin','admin@example.test',$1,501),(502,'Pastor','pastor@example.test',$1,502)",[await bcrypt.hash('fixture-password',4)]);
    }
    db.get=(async(q:string,p:any[]) => (await context.getStore()!.query(q,p)).rows[0]) as any;
    db.query=(async(q:string,p:any[]) => context.getStore()!.query(q,p)) as any;
    db.all=(async(q:string,p:any[]) => (await context.getStore()!.query(q,p)).rows) as any;
    db.run=(async(q:string,p:any[]) => {const r=await context.getStore()!.query(q,p);return {changes:r.rowCount,lastInsertRowid:r.rows[0]?.id};}) as any;
    db.transaction=(async(fn:any)=>{const c=await context.getStore()!.connect();try {await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}) as any;
    sql.begin=(fn:any)=>db.transaction(c=>fn({unsafe:async(q:string,p:any[]) => (await c.query(q,p)).rows}));
    for(const [i,pool] of pools.entries()) {
      await pool.query("INSERT INTO events(id,title,start_time,end_time,sync_identity) VALUES($1,'Fixture Fellowship','2099-10-20','2099-10-21',$2)",[i?701:501,i?randomUUID():eventIdentity]);
      await pool.query("INSERT INTO event_invitation_links(id,event_id,token,deadline,sync_identity) VALUES($1,$2,$3,'2099-10-19',$4)",[i?701:501,i?701:501,token,i?randomUUID():linkIdentity]);
    }
    const credentials={url:origins[0],username:'admin@example.test',password:'fixture-password'};
    const inspected=await call(1,'inspect',credentials);assert.equal(inspected.status,200);const identity=(await inspected.json() as any).source;
    const paired=await call(1,'pair',{...credentials,expected_source:identity});assert.equal(paired.status,200);assert.equal((await paired.json() as any).credential,undefined);
    assert.equal((await pools[0].query('SELECT temp_password FROM users WHERE id=501')).rows[0].temp_password,null);
    const submit=await fetch(origins[0]+'/api/event-invitations/public/'+token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Guest Fixture',contact:'guest@example.test',answer:'yes',responseKey:randomUUID()})});assert.equal(submit.status,200);
    const refreshed=await call(1,'refresh',{});assert.equal(refreshed.status,200);
    const state=await refreshed.json() as any;assert.equal(state.pending.length,1);assert.equal(state.pending[0].name,undefined);
    assert.equal((await pools[1].query('SELECT count(*)::int n FROM event_invitation_responses')).rows[0].n,0);
    const id=state.pending[0].submission;
    assert.equal(state.pending[0].event_id,null);
    const reviewResponse=await call(1,'verify-event/inspect',{event_identity:eventIdentity});assert.equal(reviewResponse.status,200);
    const review=await reviewResponse.json() as any;
    assert.equal(review.event.title,'Fixture Fellowship');assert.equal(review.links,undefined);
    const localChoice=review.events.find((e:any)=>e.id===701);
    const verification={event_identity:eventIdentity,event_id:701,local_identity:localChoice.sync_identity,local_fingerprint:localChoice.fingerprint,source:review.source,fingerprint:review.fingerprint,confirm_same_event:true};
    assert.equal((await call(1,'verify-event/confirm',{...verification,confirm_same_event:false})).status,400);
    assert.equal((await call(1,'verify-event/confirm',{...verification,fingerprint:'stale'})).status,409);
    await pools[0].query("UPDATE events SET title='Changed online title' WHERE id=501");
    assert.equal((await call(1,'verify-event/confirm',verification)).status,409);
    await pools[0].query("UPDATE events SET title='Fixture Fellowship' WHERE id=501");
    await pools[1].query("UPDATE events SET location='Changed location' WHERE id=701");
    assert.equal((await call(1,'verify-event/confirm',verification)).status,409);
    await pools[1].query('UPDATE events SET location=NULL WHERE id=701');
    await pools[1].query("INSERT INTO events(id,title,start_time,end_time) VALUES(702,'Conflicting link fixture','2099-12-20','2099-12-21')");
    await pools[1].query("INSERT INTO event_invitation_links(id,event_id,token,deadline,sync_identity) VALUES(702,702,$1,'2099-12-19',$2)",['c'.repeat(64),linkIdentity]);
    assert.equal((await call(1,'verify-event/confirm',verification)).status,409);
    assert.equal((await pools[1].query('SELECT sync_identity FROM events WHERE id=701')).rows[0].sync_identity,localChoice.sync_identity);
    assert.equal((await pools[1].query("SELECT count(*)::int n FROM audit_logs WHERE action='VERIFY_INVITATION_EVENT'")).rows[0].n,0);
    await pools[1].query('DELETE FROM events WHERE id=702');
    const verified=await call(1,'verify-event/confirm',verification);assert.equal(verified.status,200,await verified.clone().text());
    const verifiedBody=await verified.json() as any;assert.equal(verifiedBody.verified_links,1);assert.equal(verifiedBody.state.pending[0].event_id,701);
    assert.equal((await pools[1].query('SELECT count(*)::int n FROM event_invitation_responses')).rows[0].n,0);
    assert.equal((await pools[0].query('SELECT count(*)::int n FROM invitation_sync_confirmations')).rows[0].n,0);
    assert.equal((await pools[1].query("SELECT count(*)::int n FROM audit_logs WHERE action='VERIFY_INVITATION_EVENT'")).rows[0].n,1);
    assert.equal((await call(1,'verify-event/confirm',verification)).status,409); // stale local identity
    await assert.rejects(pools[0].query('DELETE FROM events WHERE id=501'),/Pending online invitation/);
    await assert.rejects(pools[0].query('TRUNCATE event_invitation_responses CASCADE'),/Pending online invitation/);
    const preview=await call(1,'preview',{submission:id});assert.equal(preview.status,200);assert.equal((await preview.json() as any).name,'Guest Fixture');
    assert.equal((await pools[1].query('SELECT count(*)::int n FROM event_invitation_responses')).rows[0].n,0);
    const pull=await call(1,'pull',{submissions:[id],event_id:701});assert.equal(pull.status,200);assert.equal((await pull.json() as any).results[0].status,'Synchronized');
    const repeated=await call(1,'pull',{submissions:[id],event_id:701});assert.equal(repeated.status,200);
    assert.equal((await pools[1].query('SELECT count(*)::int n FROM event_invitation_responses')).rows[0].n,1);
    const otherIdentity=randomUUID();
    await pools[0].query("INSERT INTO events(id,title,start_time,end_time,sync_identity) VALUES(555,'Different event','2099-11-20','2099-11-21',$1)",[otherIdentity]);
    const otherReview=await (await call(1,'verify-event/inspect',{event_identity:otherIdentity})).json() as any;
    const historyConflict=await call(1,'verify-event/confirm',{...verification,event_identity:otherIdentity,local_identity:eventIdentity,local_fingerprint:otherReview.events.find((e:any)=>e.id===701).fingerprint,fingerprint:otherReview.fingerprint});
    assert.equal(historyConflict.status,409);assert.match((await historyConflict.json() as any).error,/history/);
    assert.equal((await pools[1].query('SELECT count(*)::int n FROM members')).rows[0].n,0);
    assert.equal((await pools[1].query('SELECT count(*)::int n FROM event_registrations')).rows[0].n,0);
    // An answer changed online is pending again; source closures do not prevent Pull.
    await pools[0].query("UPDATE event_invitation_responses SET answer='no',reason='Working' WHERE sync_identity=$1",[id]);
    await pools[0].query('UPDATE event_invitation_links SET enabled=false');
    const updated=await call(1,'refresh',{});assert.equal((await updated.json() as any).pending.length,1);
    const sourceRevision=(await pools[0].query('SELECT sync_revision::text revision FROM event_invitation_responses WHERE sync_identity=$1',[id])).rows[0].revision;
    failConfirmation=true;
    const imported=await call(1,'pull',{submissions:[id],event_id:701});assert.equal((await imported.json() as any).results[0].status,'Imported locally · Confirmation pending');
    assert.equal((await pools[1].query('SELECT answer FROM event_invitation_responses')).rows[0].answer,'no');
    assert.equal((await pools[1].query('SELECT count(*)::int n FROM invitation_sync_receipts')).rows[0].n,2);
    // A new source revision during confirmation recovery must not be imported automatically.
    await pools[0].query("UPDATE event_invitation_responses SET answer='maybe',reason='' WHERE sync_identity=$1",[id]);
    failConfirmation=false;await pools[1].query("UPDATE invitation_sync_receipts SET next_attempt=now() WHERE NOT confirmed");
    assert.equal((await call(1,'retry-confirmations',{})).status,200);
    assert.equal((await pools[1].query('SELECT sync_revision::text revision FROM event_invitation_responses')).rows[0].revision,sourceRevision);
    const newer=await call(1,'refresh',{});assert.equal((await newer.json() as any).pending[0].status,'Pending');
    // Repeated and concurrent explicit Pull converge to one logical response.
    await Promise.all([call(1,'pull',{submissions:[id],event_id:701}),call(1,'pull',{submissions:[id],event_id:701})]);
    assert.equal((await pools[1].query('SELECT count(*)::int n FROM event_invitation_responses')).rows[0].n,1);
    assert.equal((await pools[1].query('SELECT count(*)::int n FROM invitation_sync_receipts')).rows[0].n,3);
    // Real broad transfers skip invitation answers in both directions.
    const transfer=async(from:number,to:number,direction:'push'|'pull',table='event_invitation_responses')=>{
      const target=await pools[to].connect();try {await target.query('BEGIN');
        const adapter:SyncSql={unsafe:async(q,p)=>(await pools[from].query(q,p)).rows};
        const conflict=table==='event_invitation_links'?'token':table==='event_registrations'?'event_id, member_id':'invitation_id, response_key';
        await transferTables(adapter,{unsafe:async(q,p)=>(await target.query(q,p)).rows},[{name:table,label:table,conflictTarget:conflict,isSerial:true}],direction);
        await target.query('COMMIT');}catch(e){await target.query('ROLLBACK');throw e;}finally{target.release();}
    };
    await pools[0].query("UPDATE event_invitation_responses SET answer='yes' WHERE sync_identity=$1",[id]);
    await transfer(0,1,'pull');assert.equal((await pools[1].query('SELECT answer FROM event_invitation_responses')).rows[0].answer,'maybe');
    await transfer(1,0,'push');assert.equal((await pools[0].query('SELECT answer FROM event_invitation_responses')).rows[0].answer,'yes');
    // Backup transport excludes credentials; an older restored receipt needs another manual Pull.
    const guestResponse=(await pools[1].query('SELECT id FROM event_invitation_responses WHERE sync_identity=$1',[id])).rows[0].id;
    await pools[1].query("INSERT INTO event_guest_attendance(response_id,status,recorded_by) VALUES($1,'attended',501)",[guestResponse]);
    await pools[1].query('INSERT INTO event_attendance_sessions(event_id,closed_by) VALUES(701,501)');
    const exported=await fetch(origins[1]+'/api/backup/export',{method:'POST',headers:auth,body:JSON.stringify({year:'all',password:'fixture-password'})});
    assert.equal(exported.status,200,await exported.clone().text());const backup=await exported.json() as any;
    assert.equal(backup.data.invitation_sync_node[0].credential,undefined);
    assert.equal(backup.data.invitation_sync_receipts.length,3);
    assert.equal(backup.data.event_guest_attendance.length,1);
    assert.equal(backup.data.event_attendance_sessions.length,1);
    await pools[1].query("UPDATE event_guest_attendance SET status='absent',reason='Changed after export'");
    await pools[1].query('DELETE FROM event_attendance_sessions');
    const restored=await fetch(origins[1]+'/api/backup/restore',{method:'POST',headers:auth,body:JSON.stringify({data:backup,mode:'replace',password:'fixture-password'})});
    assert.equal(restored.status,200,await restored.clone().text());
    assert.equal((await pools[1].query('SELECT status FROM event_guest_attendance WHERE response_id=$1',[guestResponse])).rows[0].status,'attended');
    assert.equal((await pools[1].query('SELECT closed_by FROM event_attendance_sessions WHERE event_id=701')).rows[0].closed_by,501);
    const restoredState=await call(1,'refresh',{});assert.equal((await restoredState.json() as any).pending[0].status,'Pending');
    assert.equal((await pools[1].query('SELECT answer FROM event_invitation_responses')).rows[0].answer,'maybe');
    // Member provenance differs from numeric IDs; a failed registration rolls back the response too.
    const memberIdentity=randomUUID();
    await pools[0].query("INSERT INTO members(id,first_name,last_name,birthdate,status,sync_identity) VALUES(801,'Member','Fixture','2000-01-01','active',$1)",[memberIdentity]);
    await pools[1].query("INSERT INTO members(id,first_name,last_name,birthdate,status) VALUES(801,'Wrong','Counterpart','2000-01-01','active')");
    await pools[0].query('UPDATE event_invitation_links SET enabled=true');
    const memberSubmit=await fetch(origins[0]+'/api/event-invitations/public/'+token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({attendeeType:'member',member_id:801,answer:'yes'})});assert.equal(memberSubmit.status,200);
    const membersPending=await call(1,'refresh',{});const memberId=(await membersPending.json() as any).pending.find((p:any)=>p.submission!==id).submission;
    const blocked=await call(1,'pull',{submissions:[memberId],event_id:701});assert.equal((await blocked.json() as any).results[0].status,'Blocked');
    await pools[1].query("INSERT INTO members(id,first_name,last_name,birthdate,status,sync_identity) VALUES(901,'Member','Fixture','2000-01-01','active',$1)",[memberIdentity]);
    await pools[1].query(`CREATE FUNCTION fixture_fail_registration() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled registration write failure'; END $$;
      CREATE TRIGGER fixture_fail_registration BEFORE INSERT ON event_registrations FOR EACH ROW EXECUTE FUNCTION fixture_fail_registration()`);
    const failed=await call(1,'pull',{submissions:[memberId],event_id:701});assert.equal((await failed.json() as any).results[0].status,'Failed');
    assert.equal((await pools[1].query('SELECT count(*)::int n FROM event_invitation_responses WHERE member_id=901')).rows[0].n,0);
    assert.equal((await pools[1].query('SELECT count(*)::int n FROM invitation_sync_receipts WHERE submission=$1',[memberId])).rows[0].n,0);
    await pools[1].query('DROP TRIGGER fixture_fail_registration ON event_registrations');
    // A previously untracked local RSVP can be updated only by deliberate Pull,
    // after its existing event/member counterparts have verified stable identities.
    await pools[1].query("INSERT INTO event_invitation_responses(invitation_id,response_key,name,answer,event_id,member_id) VALUES(701,'local-member','Member Fixture','maybe',701,901)");
    await pools[1].query("INSERT INTO event_registrations(event_id,member_id,status) VALUES(701,901,'checked_in')");
    const batch=await call(1,'pull',{submissions:[memberId,randomUUID()],event_id:701});const batchResults=(await batch.json() as any).results;
    assert.equal(batchResults[0].status,'Synchronized');assert.equal(batchResults[1].status,'Blocked');
    assert.equal((await pools[1].query('SELECT member_id FROM event_invitation_responses WHERE sync_identity=$1',[memberId])).rows[0].member_id,901);
    assert.equal((await pools[1].query('SELECT count(*)::int n FROM event_invitation_responses WHERE member_id=901')).rows[0].n,1);
    assert.equal((await pools[1].query('SELECT status FROM event_registrations WHERE member_id=901')).rows[0].status,'checked_in');
    assert.equal((await pools[1].query('SELECT count(*)::int n FROM attendance')).rows[0].n,0);
    // A newer manual answer cannot overwrite a confirmed absence or excuse.
    for(const actual of ['absent','excused']) {
      await pools[1].query('UPDATE event_registrations SET status=$1 WHERE member_id=901',[actual]);
      const change=await fetch(origins[0]+'/api/event-invitations/public/'+token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({attendeeType:'member',member_id:801,answer:actual==='absent'?'maybe':'yes'})});assert.equal(change.status,200);
      await call(1,'refresh',{});const changed=await call(1,'pull',{submissions:[memberId],event_id:701});assert.equal((await changed.json() as any).results[0].status,'Synchronized');
      assert.equal((await pools[1].query('SELECT status FROM event_registrations WHERE member_id=901')).rows[0].status,actual);
    }
    // Publication rejects the same bearer token with a different stable invitation identity.
    const conflictingLink=randomUUID();await pools[1].query('UPDATE event_invitation_links SET sync_identity=$1 WHERE id=701',[conflictingLink]);
    await assert.rejects(transfer(0,1,'pull','event_invitation_links'),/Invitation identity conflict/);
    assert.equal((await pools[1].query('SELECT sync_identity FROM event_invitation_links WHERE id=701')).rows[0].sync_identity,conflictingLink);
    await pools[1].query('UPDATE event_invitation_links SET sync_identity=$1 WHERE id=701',[linkIdentity]);
    // Planned status cannot bypass manual Pull; actual check-in still transfers in both directions.
    const sameEvent=randomUUID(),sameMember=randomUUID(),sameLink=randomUUID();
    for(const p of pools) {
      await p.query("INSERT INTO events(id,title,start_time,end_time,sync_identity) VALUES(999,'Transfer fixture','2099-01-01','2099-01-02',$1)",[sameEvent]);
      await p.query("INSERT INTO members(id,first_name,last_name,birthdate,sync_identity) VALUES(999,'Transfer','Fixture','2000-01-01',$1)",[sameMember]);
      await p.query("INSERT INTO event_invitation_links(id,event_id,token,deadline,sync_identity) VALUES(999,999,$1,'2099-01-01',$2)",['b'.repeat(64),sameLink]);
    }
    await pools[0].query("INSERT INTO event_invitation_responses(invitation_id,response_key,name,answer,event_id,member_id) VALUES(999,'member','Transfer Fixture','yes',999,999)");
    await pools[0].query("INSERT INTO event_registrations(event_id,member_id,status) VALUES(999,999,'registered')");
    // The other member registration has divergent fixture IDs; scope this check to the fixture event.
    await pools[0].query('DELETE FROM event_registrations WHERE event_id=501');
    await pools[1].query('DELETE FROM event_registrations WHERE event_id=701');
    await transfer(0,1,'pull','event_registrations');assert.equal((await pools[1].query('SELECT count(*)::int n FROM event_registrations WHERE event_id=999')).rows[0].n,0);
    await pools[0].query("UPDATE event_registrations SET status='attended' WHERE event_id=999");
    await transfer(0,1,'pull','event_registrations');assert.equal((await pools[1].query('SELECT status FROM event_registrations WHERE event_id=999')).rows[0].status,'attended');
    await pools[0].query("UPDATE event_registrations SET status='pending' WHERE event_id=999");
    await pools[1].query("UPDATE event_registrations SET status='checked_in' WHERE event_id=999");
    await transfer(1,0,'push','event_registrations');assert.equal((await pools[0].query('SELECT status FROM event_registrations WHERE event_id=999')).rows[0].status,'checked_in');
    for(const actual of ['absent','excused']) {
      await pools[1].query('UPDATE event_registrations SET status=$1 WHERE event_id=999',[actual]);
      await pools[0].query("UPDATE event_registrations SET status='registered' WHERE event_id=999");
      await transfer(0,1,'pull','event_registrations');assert.equal((await pools[1].query('SELECT status FROM event_registrations WHERE event_id=999')).rows[0].status,actual);
    }
    const receiver=(await pools[1].query('SELECT identity FROM invitation_sync_node')).rows[0].identity;
    await call(0,'source/revoke',{receiver});const revoked=await call(1,'refresh',{});assert.equal(revoked.status,409);
    const revokedState=await call(1,'state');assert.equal((await revokedState.json() as any).state,'Reconnect required');
  } finally {
    Object.assign(db,originals);sql.begin=oldSqlBegin;if(oldEnv.mode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldEnv.mode;
    if(oldEnv.key===undefined)delete process.env.INVITATION_SYNC_ENCRYPTION_KEY;else process.env.INVITATION_SYNC_ENCRYPTION_KEY=oldEnv.key;
    await Promise.all(servers.map(s=>new Promise<void>(r=>s.close(()=>r()))));await Promise.all(pools.map(p=>p.end()));
    for(const name of names) await admin.query(`DROP SCHEMA ${name} CASCADE`);await admin.end();
  }
});

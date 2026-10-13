import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {randomUUID} from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import {AddressInfo} from 'net';
import jwt from 'jsonwebtoken';
import router from './events';
import attendanceRouter from './attendance';
import {db} from '../db/schema';
import {JWT_SECRET} from '../middleware/auth';

test('RSVP selects a real member, rejects missing selection, and preserves attendance on retries',async()=>{
  const clock=mock.method(Date,'now',()=>Date.parse('2026-10-11T06:00:00Z'));
  const config={host:'127.0.0.1',port:5432,user:'postgres',password:process.env.TEST_POSTGRES_PASSWORD||'admin123',database:'chms_db',connectionTimeoutMillis:2000};
  const admin=new Pool(config),schema='rsvp_'+randomUUID().replace(/-/g,'');
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool=new Pool({...config,options:`-c search_path=${schema}`});
  const original={get:db.get,all:db.all,run:db.run,transaction:db.transaction};
  const app=express();app.use(express.json());app.use('/events',router);app.use('/attendance',attendanceRouter);const server=app.listen(0);
  await new Promise<void>(r=>server.once('listening',r));
  const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/events/501/rsvp`;
  try {
    for(const file of ['001_init_postgres.sql','007_notifications.sql','020_event_invitations.sql','021_invitation_member_responses.sql','022_event_ministries.sql','023_invitation_sync.sql','024_event_guest_attendance.sql','025_invitation_link_archive.sql','027_event_sunday_reflection.sql','028_event_attendance_ministry_sessions.sql'])await pool.query(fs.readFileSync(path.join(__dirname,'../db/migrations',file),'utf8'));
    await pool.query("INSERT INTO roles(id,name) VALUES(501,'Admin'),(502,'Member'); INSERT INTO users(id,name,email,password_hash,role_id) VALUES(501,'Admin','admin@fixture.test','fixture',501),(502,'Member','member@fixture.test','fixture',502)");
    await pool.query("INSERT INTO events(id,title,start_time,end_time) VALUES(501,'RSVP fixture','2099-01-01','2099-01-02'); INSERT INTO members(id,first_name,last_name,birthdate,status,user_id) VALUES(501,'Linked','Member','2000-01-01','active',502),(502,'Other','Member','2000-01-01','active',NULL)");
    db.get=(async(q:string,p:any[]) => (await pool.query(q,p)).rows[0]) as any;
    db.all=(async(q:string,p:any[]) => (await pool.query(q,p)).rows) as any;
    db.run=(async(q:string,p:any[]) => {const result=await pool.query(q,p);return {changes:result.rowCount};}) as any;
    db.transaction=(async(fn:any)=>{const c=await pool.connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}) as any;
    const call=(id:number,body:any)=>fetch(url,{method:'POST',headers:{Authorization:'Bearer '+jwt.sign({id},JWT_SECRET,{expiresIn:'1h'}),'Content-Type':'application/json'},body:JSON.stringify(body)});
    const missing=await call(501,{});assert.equal(missing.status,400);assert.match((await missing.json() as any).error,/select.*member/i);
    assert.equal((await call(501,{member_id:502,status:'attended'})).status,400);
    assert.equal((await call(502,{member_id:502})).status,403);
    assert.equal((await call(501,{member_id:999})).status,404);
    assert.equal((await call(501,{member_id:502})).status,200);
    await Promise.all([call(501,{member_id:502}),call(501,{member_id:502})]);
    assert.equal((await pool.query('SELECT count(*)::int n FROM event_registrations')).rows[0].n,1);
    assert.equal((await call(502,{})).status,200);
    await pool.query("UPDATE event_registrations SET status='checked_in' WHERE member_id=502");
    const repeated=await call(501,{member_id:502});assert.equal((await repeated.json() as any).status,'checked_in');
    assert.equal((await pool.query('SELECT count(*)::int n FROM attendance')).rows[0].n,0);
    // Invitation intentions shape the roster, without writing an actual arrival.
    await pool.query("INSERT INTO ministries(id,name) VALUES(501,'Fixture'); UPDATE members SET ministry_id=501; INSERT INTO members(id,first_name,last_name,birthdate,status,ministry_id) VALUES(503,'Uninvited','Member','2000-01-01','active',501)");
    await pool.query('DELETE FROM event_registrations');
    await pool.query("INSERT INTO event_invitation_links(id,event_id,token,deadline) VALUES(501,501,$1,'2099-01-01')",['d'.repeat(64)]);
    await pool.query(`INSERT INTO event_invitation_responses(id,invitation_id,response_key,name,answer,reason,event_id,member_id)
      VALUES(501,501,'m1','Linked Member','yes','',501,501),(502,501,'m2','Other Member','no','Working',501,502),
        (503,501,'g1','Guest Expected','yes','',501,NULL),(504,501,'g2','Guest Declined','no','Travel',501,NULL)`);
    const headers={Authorization:'Bearer '+jwt.sign({id:501},JWT_SECRET,{expiresIn:'1h'}),'Content-Type':'application/json'};
    const roster=async()=>{const result=await fetch(url.replace('/rsvp','/attendance-roster'),{headers});assert.equal(result.status,200,await result.clone().text());return result.json() as Promise<any>;};
    const mark=(body:any)=>fetch(url.replace('/rsvp','/participation/mark'),{method:'POST',headers,body:JSON.stringify(body)});
    for(const body of [{member_id:501,status:'attended'},{member_id:501,status:'absent',reason:'No arrival'},{response_id:503,status:'attended'},{member_id:501,status:'pending'}])assert.equal((await mark(body)).status,409);
    assert.equal((await fetch(url.replace('/rsvp','/attendance/batch-mark'),{method:'POST',headers,body:JSON.stringify({present_ids:[501]})})).status,409);
    assert.equal((await roster()).attendance_window.open,false);
    await pool.query("UPDATE events SET start_time='2026-10-11T01:00:00Z',end_time='2026-10-11T07:00:00Z' WHERE id=501");
    assert.equal((await roster()).attendance_window.open,true);
    await pool.query("INSERT INTO roles(id,name) VALUES(503,'Volunteer'); INSERT INTO users(id,name,email,password_hash,role_id) VALUES(503,'Volunteer','volunteer@fixture.test','fixture',503)");
    const volunteerHeaders={...headers,Authorization:'Bearer '+jwt.sign({id:503},JWT_SECRET,{expiresIn:'1h'})};
    assert.equal((await fetch(url.replace('/rsvp','/participation/mark'),{method:'POST',headers:volunteerHeaders,body:JSON.stringify({member_id:501,status:'attended'})})).status,403);
    assert.equal((await fetch(url.replace('/rsvp','/participation/mark'),{method:'POST',headers:volunteerHeaders,body:JSON.stringify({response_id:503,status:'attended'})})).status,403);
    assert.equal((await fetch(url.replace('/rsvp','/participation/close'),{method:'POST',headers:volunteerHeaders,body:'{}'})).status,403);
    assert.equal((await fetch(url.replace('/events/501/rsvp','/attendance/check-in'),{method:'POST',headers,body:JSON.stringify({member_id:501,event_id:501})})).status,400);
    await pool.query("INSERT INTO households(id,name) VALUES(501,'Fixture Family'); UPDATE members SET household_id=501 WHERE id=501");
    const planned=await roster();assert.equal(planned.attendees.length,3);assert.equal(planned.attendees.find((m:any)=>m.member_id===501).household_name,'Fixture Family');
    assert.equal(planned.attendees.find((m:any)=>m.member_id===501).status,'registered');
    assert.equal(planned.attendees.find((m:any)=>m.member_id===502).status,'absent');
    assert.match(planned.attendees.find((m:any)=>m.member_id===502).attendance_notes,/Working/);
    assert.equal(planned.guests.find((g:any)=>g.response_id===503).status,'unconfirmed');
    assert.equal(planned.guests.find((g:any)=>g.response_id===504).reason,'Travel');
    assert.equal((await pool.query('SELECT count(*)::int n FROM attendance')).rows[0].n,0);
    await pool.query(`CREATE FUNCTION fail_fixture_registration() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled failure'; END $$;
      CREATE TRIGGER fail_fixture_registration BEFORE INSERT ON event_registrations FOR EACH ROW EXECUTE FUNCTION fail_fixture_registration()`);
    assert.equal((await mark({member_id:501,status:'attended'})).status,503);
    assert.equal((await pool.query('SELECT count(*)::int n FROM attendance')).rows[0].n,0);
    await pool.query('DROP TRIGGER fail_fixture_registration ON event_registrations');
    assert.equal((await mark({member_id:501,status:'attended'})).status,200);
    assert.equal((await mark({response_id:503,status:'attended'})).status,200);
    assert.equal((await mark({response_id:504,status:'absent',reason:''})).status,400);
    await pool.query("UPDATE event_invitation_responses SET answer='no',reason='Changed intention' WHERE id=501");
    const confirmed=await roster();assert.equal(confirmed.attendees.find((m:any)=>m.member_id===501).status,'attended');
    assert.equal(confirmed.guests.find((g:any)=>g.response_id===503).status,'attended');
    assert.equal((await mark({response_id:503,status:'pending'})).status,200);
    assert.equal((await roster()).guests.find((g:any)=>g.response_id===503).status,'unconfirmed');
    assert.equal((await pool.query('SELECT count(*)::int n FROM members')).rows[0].n,3);
    const close=(action='close')=>fetch(url.replace('/rsvp','/participation/'+action),{method:'POST',headers,body:'{}'});
    assert.equal((await close()).status,409); // Never finalize a future event's no-shows.
    await pool.query("UPDATE events SET start_time='2020-01-01',end_time='2020-01-02' WHERE id=501");
    await pool.query(`CREATE FUNCTION fail_fixture_guest() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled guest failure'; END $$;
      CREATE TRIGGER fail_fixture_guest BEFORE INSERT ON event_guest_attendance FOR EACH ROW EXECUTE FUNCTION fail_fixture_guest()`);
    assert.equal((await close()).status,503);
    assert.equal((await pool.query('SELECT count(*)::int n FROM event_attendance_sessions')).rows[0].n,0);
    assert.equal((await pool.query('SELECT count(*)::int n FROM attendance WHERE member_id=502')).rows[0].n,0);
    await pool.query('DROP TRIGGER fail_fixture_guest ON event_guest_attendance');
    const closed=await close();assert.equal(closed.status,200,await closed.clone().text());
    const outcome=await closed.json() as any;assert.equal(outcome.no_shows,2);assert.equal(outcome.declined,2);
    assert.equal((await roster()).attendees.find((m:any)=>m.member_id===501).status,'attended');
    assert.match((await roster()).guests.find((g:any)=>g.response_id===503).reason,/No-show/);
    assert.equal((await mark({response_id:503,status:'attended'})).status,409);
    assert.equal((await fetch(url.replace('/rsvp','/attendance/mark'),{method:'POST',headers,body:JSON.stringify({member_id:502,status:'attended'})})).status,409);
    assert.equal((await call(501,{member_id:502,status:'registered'})).status,200);
    assert.equal((await pool.query('SELECT status FROM event_registrations WHERE member_id=502')).rows[0].status,'absent');
    // A Sunday roll call on the same day must never change special-event attendance.
    const sundayUrl=url.replace('/events/501/rsvp','/attendance');
    const sunday=(action:string,body:any)=>fetch(sundayUrl+'/'+action,{method:'POST',headers,body:JSON.stringify(body)});
    assert.equal((await sunday('batch-mark',{present_ids:[502]})).status,200);
    const eventAbsence=(await pool.query('SELECT id,notes FROM attendance WHERE event_id=501 AND member_id=502')).rows[0];
    assert.match(eventAbsence.notes,/Working/);
    assert.equal((await sunday('batch-mark',{unmark_ids:[502]})).status,200);
    assert.equal((await pool.query('SELECT count(*)::int n FROM attendance WHERE event_id=501 AND member_id=502')).rows[0].n,1);
    assert.equal((await sunday('check-out',{attendance_id:eventAbsence.id,force:true})).status,400);
    assert.equal((await fetch(sundayUrl+'/'+eventAbsence.id,{method:'DELETE',headers})).status,400);
    assert.equal((await close()).status,200);assert.equal((await pool.query('SELECT count(*)::int n FROM event_guest_attendance')).rows[0].n,2);
    assert.equal((await close('reopen')).status,200);assert.equal((await mark({response_id:503,status:'attended'})).status,409); // No backdated marking.
    // Sunday reflection is an explicit organizer opt-in, applied only to new Present confirmations.
    await pool.query("UPDATE events SET start_time='2026-10-11T01:00:00Z',end_time='2026-10-11T04:00:00Z' WHERE id=501");
    assert.equal((await mark({response_id:503,status:'attended'})).status,200);
    const reflection=(date:any,auth=headers)=>fetch(url.replace('/rsvp','/participation/sunday-reflection'),{method:'PUT',headers:auth,body:JSON.stringify({sunday_service_date:date})});
    assert.equal((await reflection('2026-10-11',volunteerHeaders)).status,403);
    for(const date of [undefined,'bad','2026-10-12','2026-10-04','2026-02-30'])assert.equal((await reflection(date)).status,400);
    assert.equal((await roster()).event.sunday_service_date,null);
    await pool.query("INSERT INTO members(id,first_name,last_name,status,ministry_id,birthdate) SELECT id,first_name,last_name,'active',501,'2000-01-01'::date FROM (VALUES(504,'Reflect','Single'),(505,'Reflect','Batch'),(506,'Keep','Absent'),(507,'Remain','Excused'),(508,'Rollback','Member')) AS fixture(id,first_name,last_name)");
    assert.equal((await mark({member_id:504,status:'attended'})).status,200);
    const countSunday=async(member:number)=>(await pool.query("SELECT count(*)::int n FROM attendance WHERE event_id IS NULL AND member_id=$1 AND DATE(checked_in_at)='2026-10-11'",[member])).rows[0].n;
    assert.equal(await countSunday(504),0); // Off by default.
    assert.equal((await reflection('2026-10-11')).status,200);
    assert.equal(await countSunday(504),0); // Enabling does not retroactively create arrivals.
    assert.equal((await mark({member_id:505,status:'attended',expected_sunday_service_date:null})).status,409);
    assert.equal((await pool.query('SELECT count(*)::int n FROM attendance WHERE member_id=505')).rows[0].n,0);
    await Promise.all([mark({member_id:504,status:'attended'}),mark({member_id:504,status:'attended'})]);
    assert.equal(await countSunday(504),1);
    const reflected=(await pool.query('SELECT * FROM attendance WHERE member_id=504 AND event_id IS NULL')).rows[0];
    assert.equal(reflected.reflected_from_event_id,501);
    assert.equal((await mark({response_id:503,status:'attended'})).status,200); // Guests remain event-only.
    assert.equal(await countSunday(503),0);
    await pool.query("INSERT INTO attendance(member_id,ministry_id,notes,checked_in_at) VALUES(506,501,'[ABSENT] Work','2026-10-11T01:30:00Z')");
    const batch=await fetch(url.replace('/rsvp','/attendance/batch-mark'),{method:'POST',headers,body:JSON.stringify({present_ids:[505,506],absent_ids:[507],notes:'Reported illness'})});
    assert.equal(batch.status,200,await batch.clone().text());
    assert.equal(await countSunday(505),1);assert.equal(await countSunday(506),1);assert.equal(await countSunday(507),0);
    assert.equal((await pool.query('SELECT notes,reflected_from_event_id FROM attendance WHERE member_id=506 AND event_id IS NULL')).rows[0].notes,'[ABSENT] Work');
    assert.equal((await mark({member_id:504,status:'pending'})).status,200);assert.equal(await countSunday(504),1);
    const sundayRoster=await fetch(sundayUrl+'/roster?date=2026-10-11',{headers});assert.equal(sundayRoster.status,200);
    assert.equal((await sundayRoster.json() as any[]).find(p=>p.member_id===504).reflected_from_event_title,'RSVP fixture');
    // An error in the reflected write rolls back the event confirmation as well.
    await pool.query(`CREATE FUNCTION fail_fixture_reflection() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reflected_from_event_id IS NOT NULL AND NEW.member_id=508 THEN RAISE EXCEPTION 'controlled reflection failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fail_fixture_reflection BEFORE INSERT ON attendance FOR EACH ROW EXECUTE FUNCTION fail_fixture_reflection()`);
    assert.equal((await mark({member_id:508,status:'attended'})).status,503);
    assert.equal((await pool.query('SELECT count(*)::int n FROM attendance WHERE member_id=508')).rows[0].n,0);
    await pool.query('DROP TRIGGER fail_fixture_reflection ON attendance');
    assert.equal((await mark({member_id:508,status:'attended'})).status,200);assert.equal(await countSunday(508),1);
    assert.equal((await reflection(null)).status,200);
    assert.equal((await mark({member_id:507,status:'attended'})).status,200);assert.equal(await countSunday(507),0);
    assert.equal(await countSunday(504),1); // Disabling never deletes existing Sunday history.
    // One reviewed close action finalizes remaining votes and event participants in both rosters.
    assert.equal((await reflection('2026-10-11')).status,200);
    await pool.query("INSERT INTO members(id,first_name,last_name,birthdate,status,ministry_id) VALUES(509,'Waiting','Voter','2000-01-01','active',501),(510,'Keep','Excused','2000-01-01','active',501); INSERT INTO event_registrations(event_id,member_id,status) VALUES(501,509,'registered'),(501,510,'registered')");
    await pool.query("INSERT INTO attendance(member_id,ministry_id,notes,checked_in_at) VALUES(510,501,'[EXCUSED] Travel','2026-10-11T01:30:00Z')");
    await pool.query("INSERT INTO event_invitation_responses(invitation_id,response_key,name,answer,reason,event_id,member_id) VALUES(501,'maybe509','Waiting Voter','maybe','Not sure',501,509)");
    const preview=async()=>{const result=await fetch(url.replace('/rsvp','/participation/close-preview?sunday=1'),{headers});assert.equal(result.status,200,await result.clone().text());return result.json() as Promise<any>;};
    let plan=await preview();assert(plan.event_members.some((p:any)=>p.member_id===509));assert(plan.sunday_members.some((p:any)=>p.member_id===509));
    assert(!plan.sunday_members.some((p:any)=>[504,505,506,508,510].includes(p.member_id)));
    assert.equal(await countSunday(509),0);
    const finish=(value:any)=>fetch(url.replace('/rsvp','/participation/close'),{method:'POST',headers,body:JSON.stringify({reflect_sunday_absences:true,expected_sunday_service_date:'2026-10-11',preview_token:value.preview_token})});
    // Someone checking in after review requires a fresh preview rather than an unexpected bulk write.
    assert.equal((await mark({member_id:510,status:'attended'})).status,200);
    assert.equal((await finish(plan)).status,409);
    plan=await preview();
    await pool.query(`CREATE FUNCTION fail_fixture_absence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reflected_from_event_id IS NOT NULL AND NEW.member_id=509 THEN RAISE EXCEPTION 'controlled absence failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fail_fixture_absence BEFORE INSERT ON attendance FOR EACH ROW EXECUTE FUNCTION fail_fixture_absence()`);
    assert.equal((await finish(plan)).status,503);assert.equal(await countSunday(509),0);
    assert.equal((await pool.query('SELECT count(*)::int n FROM attendance WHERE member_id=509 AND event_id=501')).rows[0].n,0);
    assert.equal((await pool.query('SELECT count(*)::int n FROM event_attendance_sessions')).rows[0].n,0);
    await pool.query('DROP TRIGGER fail_fixture_absence ON attendance');
    const finalized=await finish(plan);assert.equal(finalized.status,200,await finalized.clone().text());
    assert.equal(await countSunday(509),1);assert.match((await pool.query('SELECT notes FROM attendance WHERE member_id=509 AND event_id IS NULL')).rows[0].notes,/\[ABSENT\]/);
    assert.equal((await pool.query('SELECT notes FROM attendance WHERE member_id=510 AND event_id IS NULL')).rows[0].notes,'[EXCUSED] Travel');
    assert.equal((await finish(plan)).status,200);assert.equal(await countSunday(509),1);
    // Full active-member roll call and closures are enforced per assigned ministry.
    await pool.query(`INSERT INTO ministries(id,name) VALUES(502,'Second Fixture');
      INSERT INTO roles(id,name) VALUES(504,'Coordinator'),(505,'Pastor');
      INSERT INTO users(id,name,email,password_hash,role_id) VALUES(504,'Coordinator','coord@fixture.test','fixture',504),(505,'Pastor','pastor@fixture.test','fixture',505);
      INSERT INTO user_ministries(user_id,ministry_id) VALUES(503,501),(504,501);
      INSERT INTO events(id,title,start_time,end_time,created_by,sunday_service_date) VALUES(502,'Scoped Fixture','2026-10-11T01:00:00Z','2026-10-11T04:00:00Z',504,'2026-10-11');
      INSERT INTO members(id,first_name,last_name,birthdate,status,ministry_id) VALUES(511,'Second','Active','2000-01-01','active',502),(512,'Second','Inactive','2000-01-01','inactive',502);`);
    const scopedUrl=url.replace('/501/rsvp','/502');
    const coordHeaders={...headers,Authorization:'Bearer '+jwt.sign({id:504},JWT_SECRET,{expiresIn:'1h'})};
    const pastorHeaders={...headers,Authorization:'Bearer '+jwt.sign({id:505},JWT_SECRET,{expiresIn:'1h'})};
    const scopedGet=(suffix:string,auth=headers)=>fetch(scopedUrl+suffix,{headers:auth});
    const scopedPost=(suffix:string,body:any,auth=headers)=>fetch(scopedUrl+suffix,{method:'POST',headers:auth,body:JSON.stringify(body)});
    const restricted=await scopedGet('/attendance-roster',coordHeaders);assert.equal(restricted.status,200);
    const restrictedRoster=await restricted.json() as any;
    assert(restrictedRoster.attendees.some((m:any)=>m.member_id===503)); // No invitation or registration.
    assert(!restrictedRoster.attendees.some((m:any)=>m.member_id===511)); // Even the creator stays assigned-only.
    assert.equal(restrictedRoster.can_finalize_attendance,true);
    assert.equal((await scopedGet('/attendance-roster?ministry_id=502',coordHeaders)).status,403);
    for(const auth of [coordHeaders,volunteerHeaders]) {
      assert.equal((await scopedPost('/participation/mark',{member_id:511,status:'attended'},auth)).status,403);
      assert.equal((await scopedPost('/attendance/batch-mark',{present_ids:[501,511]},auth)).status,403);
      assert.equal((await scopedPost('/participation/close',{ministry_id:502},auth)).status,403);
    }
    assert.equal((await scopedPost('/participation/mark',{member_id:501,status:'attended'},volunteerHeaders)).status,200);
    assert.equal((await scopedPost('/participation/mark',{member_id:502,status:'excused',reason:'Illness'},coordHeaders)).status,200);
    const youthPreview=await scopedGet('/participation/close-preview?sunday=1',volunteerHeaders);
    assert.equal(youthPreview.status,200);const youthPlan=await youthPreview.json() as any;
    assert(youthPlan.event_members.some((m:any)=>m.member_id===503));
    assert(!youthPlan.event_members.some((m:any)=>[501,502,511,512].includes(m.member_id)));
    const youthFinish=await scopedPost('/participation/close',{reflect_sunday_absences:true,preview_token:youthPlan.preview_token,expected_sunday_service_date:'2026-10-11'},volunteerHeaders);
    assert.equal(youthFinish.status,200,await youthFinish.clone().text());
    assert.match((await pool.query('SELECT notes FROM attendance WHERE event_id=502 AND member_id=503')).rows[0].notes,/ABSENT/);
    assert.equal((await pool.query('SELECT count(*)::int n FROM attendance WHERE event_id=502 AND member_id=511')).rows[0].n,0);
    assert.equal((await pool.query('SELECT count(*)::int n FROM attendance WHERE event_id IS NULL AND member_id=511')).rows[0].n,0);
    assert.equal((await scopedPost('/participation/mark',{member_id:503,status:'attended',finalizing:true},volunteerHeaders)).status,409);
    assert.equal((await scopedPost('/participation/mark',{member_id:511,status:'attended'},pastorHeaders)).status,200); // Other scope is still open.
    const second=await scopedGet('/attendance-roster?ministry_id=502');assert.equal(second.status,200);
    const secondRoster=await second.json() as any;assert.equal(secondRoster.attendees.length,1);assert.equal(secondRoster.attendance_closed_at,null);
    assert.equal((await scopedPost('/participation/close',{ministry_id:'502'},pastorHeaders)).status,200);
    assert.equal((await scopedPost('/participation/reopen',{},volunteerHeaders)).status,200);
    assert.equal((await scopedGet('/attendance-roster?ministry_id=502').then(r=>r.json()) as any).attendance_closed_at!==null,true);
    assert.equal((await scopedPost('/participation/close',{},headers)).status,200);
    assert.equal((await scopedPost('/participation/reopen',{},volunteerHeaders)).status,409); // Cannot reopen someone else's global closure.
    assert.equal((await scopedGet('/attendance-roster',volunteerHeaders).then(r=>r.json()) as any).can_reopen_attendance,false);
    await pool.query('INSERT INTO event_ministries(event_id,ministry_id) VALUES(502,501)');
    const targeted=await scopedGet('/attendance-roster');assert.equal(targeted.status,200);
    assert(!(await targeted.json() as any).attendees.some((m:any)=>m.member_id===511));
    assert.equal((await scopedGet('/attendance-roster?ministry_id=502',pastorHeaders)).status,403);
    await pool.query("INSERT INTO ministries(id,name) VALUES(503,'Third Fixture'); INSERT INTO members(id,first_name,last_name,status,birthdate,ministry_id) VALUES(513,'Third','Active','active','2000-01-01',503); INSERT INTO events(id,title,start_time,end_time) VALUES(503,'Multiple Ministries','2026-10-11T01:00:00Z','2026-10-11T04:00:00Z')");
    const multiUrl=scopedUrl.replace('/502','/503');
    const multiPost=(suffix:string,body:any,auth=headers)=>fetch(multiUrl+suffix,{method:'POST',headers:auth,body:JSON.stringify(body)});
    assert.equal((await multiPost('/participation/mark',{member_id:501,status:'attended'})).status,200);
    assert.equal((await multiPost('/participation/close',{ministry_ids:[]})).status,400);
    assert.equal((await multiPost('/participation/close',{ministry_ids:null})).status,400);
    assert.equal((await multiPost('/participation/close',{ministry_ids:[999]})).status,400);
    for(const auth of [coordHeaders,volunteerHeaders])assert.equal((await multiPost('/participation/close',{ministry_ids:[501,502]},auth)).status,403);
    const selectedPreview=await fetch(multiUrl+'/participation/close-preview?ministry_ids=501,502',{headers});assert.equal(selectedPreview.status,200);
    const selectedPlan=await selectedPreview.json() as any;assert(selectedPlan.event_members.some((m:any)=>m.member_id===511));assert(!selectedPlan.event_members.some((m:any)=>m.member_id===513));
    assert.equal((await multiPost('/participation/close',{ministry_ids:[501],preview_token:selectedPlan.preview_token})).status,409);
    assert.equal((await multiPost('/participation/close',{ministry_ids:[502,501],preview_token:selectedPlan.preview_token})).status,200);
    const partial=await fetch(multiUrl+'/attendance-roster',{headers}).then(r=>r.json()) as any;assert.equal(partial.attendance_fully_closed,false);assert.equal(partial.attendance_closed_at,null);
    assert.equal((await pool.query('SELECT count(*)::int n FROM attendance WHERE event_id=503 AND member_id=513')).rows[0].n,0);
    assert.equal((await multiPost('/participation/mark',{member_id:513,status:'attended'},pastorHeaders)).status,200);
    assert.equal((await multiPost('/participation/close',{ministry_ids:[503]},pastorHeaders)).status,200);
    const complete=await fetch(multiUrl+'/attendance-roster',{headers}).then(r=>r.json()) as any;assert.equal(complete.attendance_fully_closed,true);assert(complete.attendance_closed_at);
    assert.equal((await multiPost('/participation/reopen',{ministry_ids:[501]},volunteerHeaders)).status,200);
    assert.equal((await fetch(multiUrl+'/attendance-roster',{headers}).then(r=>r.json()) as any).attendance_fully_closed,false);
  }finally{
    clock.mock.restore();
    Object.assign(db,original);await new Promise<void>(r=>server.close(()=>r()));await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();
  }
});

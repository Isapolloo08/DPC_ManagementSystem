import type {PoolClient} from 'pg';
import {db} from '../db/schema';
import type {AuthenticatedUser} from '../middleware/auth';
import {eventMinistryIdsSql,memberFitsEvent} from '../utils/eventMinistries';

export class ParticipationError extends Error {constructor(message:string,public status=400){super(message);}}
const privileged=(u:AuthenticatedUser)=>['Admin','IT Admin','Pastor'].includes(u.role_name);
const organizer=(u:AuthenticatedUser,e:any)=>privileged(u)||(u.role_name==='Coordinator'&&(e.created_by===u.id||e.ministry_ids.some((id:number)=>u.ministry_ids.includes(id))));
async function eventFor(id:number) {
  if(!Number.isSafeInteger(id)||id<1)throw new ParticipationError('Choose a valid event.');
  const event=await db.get(`SELECT e.*,${eventMinistryIdsSql('e')} AS ministry_ids FROM events e WHERE e.id=$1`,[id]);
  if(!event)throw new ParticipationError('Event not found.',404);
  return event;
}
export async function eventParticipation(id:number,user:AuthenticatedUser) {
  const event=await eventFor(id);
  const all=organizer(user,event);
  const attendees=await db.all(`SELECT m.id AS member_id,m.first_name,m.last_name,m.ministry_id,
    COALESCE(min.name,'Unassigned') AS ministry_name,min.color AS ministry_color,
    r.answer AS invitation_answer,r.reason AS invitation_reason,
    CASE WHEN att.notes ILIKE '%[ABSENT]%' THEN 'absent' WHEN att.notes ILIKE '%[EXCUSED]%' THEN 'excused'
      WHEN att.id IS NOT NULL OR er.status IN ('attended','checked_in') THEN 'attended'
      WHEN er.status IN ('absent','excused') THEN er.status
      WHEN r.answer='no' THEN 'absent' WHEN r.answer='yes' OR er.status='registered' THEN 'registered' ELSE 'unregistered' END AS status,
    COALESCE(att.notes,CASE WHEN r.answer='no' THEN '[RSVP DECLINED] '||r.reason END) AS attendance_notes,
    att.id AS attendance_id,att.checked_in_at,er.created_at AS registered_at,
    (att.id IS NOT NULL OR er.status IN ('attended','checked_in','absent','excused')) AS attendance_confirmed
    FROM members m LEFT JOIN ministries min ON min.id=m.ministry_id
    LEFT JOIN event_registrations er ON er.event_id=$1 AND er.member_id=m.id
    LEFT JOIN event_invitation_responses r ON r.event_id=$1 AND r.member_id=m.id
    LEFT JOIN attendance att ON att.event_id=$1 AND att.member_id=m.id
    WHERE (er.member_id IS NOT NULL OR r.id IS NOT NULL OR att.id IS NOT NULL)
      AND ($2::boolean OR m.ministry_id=ANY($3::integer[])) ORDER BY lower(m.last_name),lower(m.first_name)`,[id,all,user.ministry_ids]);
  const guests=all?await db.all(`SELECT r.id AS response_id,r.name,r.answer,r.reason AS invitation_reason,
    COALESCE(a.status,CASE WHEN r.answer='no' THEN 'absent' ELSE 'unconfirmed' END) AS status,
    COALESCE(a.reason,CASE WHEN r.answer='no' THEN r.reason END,'') AS reason,
    a.recorded_at,a.response_id IS NOT NULL AS attendance_confirmed
    FROM event_invitation_responses r LEFT JOIN event_guest_attendance a ON a.response_id=r.id
    WHERE r.event_id=$1 AND r.member_id IS NULL ORDER BY lower(r.name),r.id`,[id]):[];
  const statuses=[...attendees,...guests];
  const session=await db.get('SELECT closed_at FROM event_attendance_sessions WHERE event_id=$1',[id]);
  return {event,attendance_closed_at:session?.closed_at||null,attendees,guests,summary:{total_registered:attendees.filter(a=>a.status==='registered').length,
    total_attended:statuses.filter(a=>a.status==='attended').length,total_absent:statuses.filter(a=>a.status==='absent').length,
    total_excused:statuses.filter(a=>a.status==='excused').length,total_active_members:attendees.length}};
}
export async function markEventParticipant(id:number,body:any,user:AuthenticatedUser) {
  return markEventParticipants(id,[body],user);
}
export async function markEventParticipants(id:number,bodies:any[],user:AuthenticatedUser) {
  if(!bodies.length||bodies.length>100)throw new ParticipationError('Select between 1 and 100 participants.');
  for(const body of bodies) {
  if(!['attended','absent','excused','pending'].includes(body.status)||typeof(body.reason??'')!=='string'||(body.reason||'').length>1000)throw new ParticipationError('Choose a valid attendance status and reason.');
  const guest=body.response_id!==undefined;
  const target=guest?body.response_id:body.member_id;
  if(!Number.isSafeInteger(target)||target<1||(guest&&body.member_id!==undefined))throw new ParticipationError('Select one participant.');
  if(['absent','excused'].includes(body.status)&&!(body.reason||'').trim())throw new ParticipationError('Provide an absence reason.');
  }
  await eventFor(id);
  await db.transaction(async c=>{
    // Shared lock also serializes Pull and restore; changes cannot race their receipts.
    await c.query('SELECT pg_advisory_xact_lock(237024)');
    const staff=(await c.query('SELECT r.name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1',[user.id])).rows[0];
    if(!staff||staff.name!==user.role_name)throw new ParticipationError('Authorization changed. Sign in again.',403);
    const event=(await c.query(`SELECT e.*,${eventMinistryIdsSql('e')} AS ministry_ids FROM events e WHERE e.id=$1 FOR UPDATE`,[id])).rows[0];
    if(!event)throw new ParticipationError('Event not found.',404);
    const scope=(await c.query('SELECT ministry_id FROM user_ministries WHERE user_id=$1',[user.id])).rows.map(row=>row.ministry_id);
    user={...user,ministry_ids:scope};
    const closed=await c.query('SELECT 1 FROM event_attendance_sessions WHERE event_id=$1',[id]);
    if(closed.rowCount)throw new ParticipationError('Attendance is closed. Reopen it before making corrections.',409);
    for(const body of bodies)await writeParticipant(c,event,user,body);
  });
}

async function writeParticipant(c:PoolClient,event:any,user:AuthenticatedUser,body:any) {
  const id=event.id,guest=body.response_id!==undefined,target=guest?body.response_id:body.member_id;
    if(guest) {
      if(!organizer(user,event))throw new ParticipationError('Only this event’s organizers can confirm guests.',403);
      const response=(await c.query('SELECT id FROM event_invitation_responses WHERE id=$1 AND event_id=$2 AND member_id IS NULL FOR UPDATE',[target,id])).rows[0];
      if(!response)throw new ParticipationError('Guest response is not part of this event.',404);
      if(body.status==='pending')await c.query('DELETE FROM event_guest_attendance WHERE response_id=$1',[target]);
      else await c.query(`INSERT INTO event_guest_attendance(response_id,status,reason,recorded_by) VALUES($1,$2,$3,$4)
        ON CONFLICT(response_id) DO UPDATE SET status=EXCLUDED.status,reason=EXCLUDED.reason,recorded_by=EXCLUDED.recorded_by,recorded_at=now()`,[target,body.status,body.reason||'',user.id]);
    } else {
      const member=(await c.query('SELECT id,ministry_id,status FROM members WHERE id=$1',[target])).rows[0];
      if(!member)throw new ParticipationError('Member not found.',404);
      if(!organizer(user,event)&&!user.ministry_ids.includes(member.ministry_id))throw new ParticipationError('You cannot record attendance for this member.',403);
      if(!memberFitsEvent(member.ministry_id,event))throw new ParticipationError('Member is outside this event’s target ministries.',403);
      const current=(await c.query('SELECT id FROM attendance WHERE event_id=$1 AND member_id=$2 FOR UPDATE',[id,target])).rows;
      if(current.length>1)throw new ParticipationError('Duplicate attendance records require repair before recording this participant.',409);
      if(body.status==='pending') {
        await c.query('DELETE FROM attendance WHERE event_id=$1 AND member_id=$2',[id,target]);
        const answer=(await c.query('SELECT answer FROM event_invitation_responses WHERE event_id=$1 AND member_id=$2',[id,target])).rows[0]?.answer;
        await c.query(`INSERT INTO event_registrations(event_id,member_id,status) VALUES($1,$2,$3) ON CONFLICT(event_id,member_id) DO UPDATE SET status=EXCLUDED.status`,[id,target,answer==='no'?'cancelled':answer==='maybe'?'pending':'registered']);
      } else {
        const ministry=member.ministry_id||event.ministry_id||(await c.query('SELECT id FROM ministries ORDER BY id LIMIT 1')).rows[0]?.id;
        if(!ministry)throw new ParticipationError('Assign a ministry before recording attendance.');
        const notes=body.status==='attended'?'Confirmed arrival':`[${body.status==='absent'?'ABSENT':'EXCUSED'}] ${body.reason.trim()}`;
        if(current.length)await c.query('UPDATE attendance SET notes=$1,checked_in_by=$2,checked_in_at=now() WHERE id=$3',[notes,user.id,current[0].id]);
        else await c.query('INSERT INTO attendance(member_id,ministry_id,event_id,checked_in_by,notes) VALUES($1,$2,$3,$4,$5)',[target,ministry,id,user.id,notes]);
        await c.query(`INSERT INTO event_registrations(event_id,member_id,status) VALUES($1,$2,$3) ON CONFLICT(event_id,member_id) DO UPDATE SET status=EXCLUDED.status`,[id,target,body.status]);
      }
    }
    await c.query("INSERT INTO audit_logs(user_id,action,target_table,target_id,details) VALUES($1,'EVENT_ATTENDANCE','events',$2,$3)",[user.id,id,JSON.stringify({kind:guest?'guest':'member',participant:target,status:body.status})]);
}

export async function closeEventAttendance(id:number,user:AuthenticatedUser,reopen=false) {
  await eventFor(id);
  return db.transaction(async c=>{
    await c.query('SELECT pg_advisory_xact_lock(237024)');
    const event=(await c.query(`SELECT e.*,${eventMinistryIdsSql('e')} AS ministry_ids FROM events e WHERE e.id=$1 FOR UPDATE`,[id])).rows[0];
    const role=(await c.query('SELECT r.name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1',[user.id])).rows[0]?.name;
    const ministries=(await c.query('SELECT ministry_id FROM user_ministries WHERE user_id=$1',[user.id])).rows.map(row=>row.ministry_id);
    if(!event||role!==user.role_name||!organizer({...user,ministry_ids:ministries},event))throw new ParticipationError('Only this event’s organizers can close or reopen attendance.',403);
    if(reopen) {
      await c.query('DELETE FROM event_attendance_sessions WHERE event_id=$1',[id]);
      await c.query("INSERT INTO audit_logs(user_id,action,target_table,target_id,details) VALUES($1,'REOPEN_EVENT_ATTENDANCE','events',$2,'Reopened for corrections')",[user.id,id]);
      return {closed:false,no_shows:0,declined:0};
    }
    if(new Date(event.end_time).getTime()>Date.now())throw new ParticipationError('Close attendance after the scheduled event ends.',409);
    if((await c.query('SELECT 1 FROM event_attendance_sessions WHERE event_id=$1',[id])).rowCount)return {closed:true,no_shows:0,declined:0};
    const members=(await c.query(`SELECT m.id AS member_id,r.answer,r.reason FROM members m
      LEFT JOIN event_invitation_responses r ON r.member_id=m.id AND r.event_id=$1
      LEFT JOIN event_registrations er ON er.member_id=m.id AND er.event_id=$1
      WHERE (r.answer IN ('yes','no') OR er.status='registered')
        AND (er.status IS NULL OR er.status NOT IN ('attended','checked_in','absent','excused'))
        AND NOT EXISTS(SELECT 1 FROM attendance a WHERE a.member_id=m.id AND a.event_id=$1)
        AND (cardinality($2::integer[])=0 OR m.ministry_id=ANY($2::integer[])) ORDER BY m.id`,[id,event.ministry_ids])).rows;
    const guests=(await c.query(`SELECT r.id AS response_id,r.answer,r.reason FROM event_invitation_responses r
      WHERE r.event_id=$1 AND r.member_id IS NULL AND r.answer IN ('yes','no')
        AND NOT EXISTS(SELECT 1 FROM event_guest_attendance a WHERE a.response_id=r.id) ORDER BY r.id`,[id])).rows;
    let no_shows=0,declined=0;
    for(const participant of [...members,...guests]) {
      const reason=participant.answer==='no'?participant.reason||'Cannot attend — invitation declined':'No-show — arrival was not confirmed when attendance closed';
      await writeParticipant(c,event,{...user,ministry_ids:ministries},{...participant,status:'absent',reason});
      if(participant.answer==='no')declined++;else no_shows++;
    }
    await c.query('INSERT INTO event_attendance_sessions(event_id,closed_by) VALUES($1,$2)',[id,user.id]);
    await c.query("INSERT INTO audit_logs(user_id,action,target_table,target_id,details) VALUES($1,'CLOSE_EVENT_ATTENDANCE','events',$2,$3)",[user.id,id,JSON.stringify({no_shows,declined})]);
    return {closed:true,no_shows,declined};
  });
}

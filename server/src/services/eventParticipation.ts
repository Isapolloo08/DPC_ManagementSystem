import type {PoolClient} from 'pg';
import {createHash} from 'crypto';
import {db} from '../db/schema';
import type {AuthenticatedUser} from '../middleware/auth';
import {eventMinistryIdsSql,memberFitsEvent} from '../utils/eventMinistries';
import {attendanceDate,eventAttendanceWindow} from '../utils/eventAttendanceWindow';

export class ParticipationError extends Error {constructor(message:string,public status=400){super(message);}}
const privileged=(u:AuthenticatedUser)=>['Admin','IT Admin','Pastor'].includes(u.role_name);
const organizer=(u:AuthenticatedUser,e:any)=>privileged(u)||(u.role_name==='Coordinator'&&(e.created_by===u.id||e.ministry_ids.some((id:number)=>u.ministry_ids.includes(id))));
const localDate=attendanceDate;
function validateServiceDate(value:unknown,event:any) {
  if(value===null)return;
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new ParticipationError('Choose a valid Sunday service date.');
  const date=new Date(`${value}T00:00:00Z`);
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value||date.getUTCDay()!==0)throw new ParticipationError('The service date must be a Sunday.');
  if(value<localDate(event.start_time)||value>localDate(event.end_time))throw new ParticipationError('Choose a Sunday within this event’s scheduled dates.');
}
export async function setEventSundayReflection(id:number,value:unknown,user:AuthenticatedUser) {
  await eventFor(id);
  return db.transaction(async c=>{
    await c.query('SELECT pg_advisory_xact_lock(237024)');
    const event=(await c.query(`SELECT e.*,to_char(e.sunday_service_date,'YYYY-MM-DD') AS sunday_service_date,${eventMinistryIdsSql('e')} AS ministry_ids FROM events e WHERE e.id=$1 FOR UPDATE`,[id])).rows[0];
    if(!event)throw new ParticipationError('Event not found.',404);
    const staff=(await c.query('SELECT r.name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1',[user.id])).rows[0];
    const scope=(await c.query('SELECT ministry_id FROM user_ministries WHERE user_id=$1',[user.id])).rows.map(row=>row.ministry_id);
    if(!staff||staff.name!==user.role_name||!organizer({...user,ministry_ids:scope},event))throw new ParticipationError('Only this event’s organizers can change Sunday reflection.',403);
    if((await c.query('SELECT 1 FROM event_attendance_sessions WHERE event_id=$1',[id])).rowCount)throw new ParticipationError('Reopen attendance before changing Sunday reflection.',409);
    validateServiceDate(value,event);
    await c.query('UPDATE events SET sunday_service_date=$1 WHERE id=$2',[value,id]);
    await c.query("INSERT INTO audit_logs(user_id,action,target_table,target_id,details) VALUES($1,'EVENT_SUNDAY_REFLECTION','events',$2,$3)",[user.id,id,JSON.stringify({sunday_service_date:value})]);
    return {sunday_service_date:value};
  });
}
async function eventFor(id:number) {
  if(!Number.isSafeInteger(id)||id<1)throw new ParticipationError('Choose a valid event.');
  const event=await db.get(`SELECT e.*,to_char(e.sunday_service_date,'YYYY-MM-DD') AS sunday_service_date,${eventMinistryIdsSql('e')} AS ministry_ids FROM events e WHERE e.id=$1`,[id]);
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
  return {event,attendance_window:eventAttendanceWindow(event),can_manage_sunday_reflection:all,attendance_closed_at:session?.closed_at||null,attendees,guests,summary:{total_registered:attendees.filter(a=>a.status==='registered').length,
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
    const event=(await c.query(`SELECT e.*,to_char(e.sunday_service_date,'YYYY-MM-DD') AS sunday_service_date,${eventMinistryIdsSql('e')} AS ministry_ids FROM events e WHERE e.id=$1 FOR UPDATE`,[id])).rows[0];
    if(!event)throw new ParticipationError('Event not found.',404);
    const scope=(await c.query('SELECT ministry_id FROM user_ministries WHERE user_id=$1',[user.id])).rows.map(row=>row.ministry_id);
    user={...user,ministry_ids:scope};
    const closed=await c.query('SELECT 1 FROM event_attendance_sessions WHERE event_id=$1',[id]);
    if(closed.rowCount)throw new ParticipationError('Attendance is closed. Reopen it before making corrections.',409);
    const window=eventAttendanceWindow(event);
    if(!window.open)throw new ParticipationError(window.message,409);
    for(const body of bodies) {
      if(body.status==='attended'&&body.member_id!==undefined&&body.expected_sunday_service_date!==undefined&&body.expected_sunday_service_date!==event.sunday_service_date)throw new ParticipationError('Sunday reflection changed. Refresh attendance and review the service date before confirming again.',409);
      await writeParticipant(c,event,user,body);
    }
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
        if(body.status==='attended'&&event.sunday_service_date) {
          const serviceDate=typeof event.sunday_service_date==='string'?event.sunday_service_date:localDate(event.sunday_service_date);
          validateServiceDate(serviceDate,event);
          // The organizer's opt-in applies only to members this operator can confirm.
          // Retries and other event check-ins must preserve every existing Sunday decision.
          const existing=await c.query('SELECT id FROM attendance WHERE member_id=$1 AND event_id IS NULL AND DATE(checked_in_at)=$2::date',[target,serviceDate]);
          if(!existing.rowCount) {
            const group=(await c.query('SELECT name,max_age FROM ministries WHERE id=$1',[ministry])).rows[0];
            const child=group&&(group.name==='Kinder'||group.name==='Elementary'||group.max_age&&group.max_age<=12);
            const securityCode=child?`${group.name.substring(0,3).toUpperCase()}-${Math.floor(1000+Math.random()*9000)}`:null;
            const reflected=await c.query(`INSERT INTO attendance(member_id,ministry_id,checked_in_by,notes,checked_in_at,reflected_from_event_id,security_code)
              VALUES($1,$2,$3,'Sunday Divine Worship',$4::timestamptz,$5,$6) RETURNING id`,[target,ministry,user.id,`${serviceDate}T09:30:00+08:00`,id,securityCode]);
            await c.query("INSERT INTO audit_logs(user_id,action,target_table,target_id,details) VALUES($1,'REFLECT_EVENT_ATTENDANCE','attendance',$2,$3)",[user.id,reflected.rows[0].id,JSON.stringify({event_id:id,member_id:target,service_date:serviceDate})]);
          }
        }
      }
    }
    await c.query("INSERT INTO audit_logs(user_id,action,target_table,target_id,details) VALUES($1,'EVENT_ATTENDANCE','events',$2,$3)",[user.id,id,JSON.stringify({kind:guest?'guest':'member',participant:target,status:body.status})]);
}

type CloseOptions={reflect_sunday_absences?:unknown;preview_token?:unknown;expected_sunday_service_date?:unknown};

async function closePlan(c:PoolClient,event:any,reflectSunday:boolean) {
  const members=(await c.query(`SELECT m.id AS member_id,m.first_name||' '||m.last_name AS name,r.answer,r.reason FROM members m
    LEFT JOIN event_invitation_responses r ON r.member_id=m.id AND r.event_id=$1
    LEFT JOIN event_registrations er ON er.member_id=m.id AND er.event_id=$1
    WHERE (r.id IS NOT NULL OR er.status IN ('registered','pending'))
      AND (er.status IS NULL OR er.status NOT IN ('attended','checked_in','absent','excused'))
      AND NOT EXISTS(SELECT 1 FROM attendance a WHERE a.member_id=m.id AND a.event_id=$1)
      AND (cardinality($2::integer[])=0 OR m.ministry_id=ANY($2::integer[])) ORDER BY m.id`,[event.id,event.ministry_ids])).rows;
  const guests=(await c.query(`SELECT r.id AS response_id,r.name,r.answer,r.reason FROM event_invitation_responses r
    WHERE r.event_id=$1 AND r.member_id IS NULL
      AND NOT EXISTS(SELECT 1 FROM event_guest_attendance a WHERE a.response_id=r.id) ORDER BY r.id`,[event.id])).rows;
  let sundayMembers:any[]=[],preservedSunday=0;
  if(reflectSunday) {
    if(!event.sunday_service_date)throw new ParticipationError('Enable a linked Sunday service before marking Sunday absences.');
    validateServiceDate(event.sunday_service_date,event);
    if(event.sunday_service_date>attendanceDate(Date.now()))throw new ParticipationError('Sunday absences cannot be finalized before the linked service date.',409);
    const candidates=(await c.query(`SELECT m.id AS member_id,m.first_name||' '||m.last_name AS name,m.ministry_id,
      s.id AS sunday_attendance_id FROM members m
      LEFT JOIN event_registrations er ON er.member_id=m.id AND er.event_id=$1
      LEFT JOIN attendance a ON a.member_id=m.id AND a.event_id=$1
      LEFT JOIN attendance s ON s.member_id=m.id AND s.event_id IS NULL AND DATE(s.checked_in_at)=$3::date
      WHERE (m.id=ANY($2::integer[]) OR a.notes ILIKE '%[ABSENT]%' OR er.status='absent')
        AND (a.id IS NULL OR a.notes ILIKE '%[ABSENT]%')
        AND (er.status IS NULL OR er.status NOT IN ('attended','checked_in','excused'))
        AND (cardinality($4::integer[])=0 OR m.ministry_id=ANY($4::integer[])) ORDER BY m.id`,[event.id,members.map(m=>m.member_id),event.sunday_service_date,event.ministry_ids])).rows;
    sundayMembers=candidates.filter(m=>!m.sunday_attendance_id);
    preservedSunday=new Set(candidates.filter(m=>m.sunday_attendance_id).map(m=>m.member_id)).size;
  }
  const plan={event_members:members,event_guests:guests,sunday_members:sundayMembers,preserved_sunday:preservedSunday,sunday_service_date:event.sunday_service_date||null};
  const preview_token=createHash('sha256').update(JSON.stringify({id:event.id,end:event.end_time,reflectSunday,...plan})).digest('hex');
  return {...plan,preview_token};
}

async function organizerEvent(c:PoolClient,id:number,user:AuthenticatedUser) {
  const event=(await c.query(`SELECT e.*,to_char(e.sunday_service_date,'YYYY-MM-DD') AS sunday_service_date,${eventMinistryIdsSql('e')} AS ministry_ids FROM events e WHERE e.id=$1 FOR UPDATE`,[id])).rows[0];
  const role=(await c.query('SELECT r.name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1',[user.id])).rows[0]?.name;
  const ministries=(await c.query('SELECT ministry_id FROM user_ministries WHERE user_id=$1',[user.id])).rows.map(row=>row.ministry_id);
  if(!event||role!==user.role_name||!organizer({...user,ministry_ids:ministries},event))throw new ParticipationError('Only this event’s organizers can finalize attendance.',403);
  return {event,ministries};
}

export async function previewEventClose(id:number,user:AuthenticatedUser,reflectSunday=false) {
  await eventFor(id);
  return db.transaction(async c=>{
    await c.query('SELECT pg_advisory_xact_lock(237024)');
    const {event}=await organizerEvent(c,id,user);
    return closePlan(c,event,reflectSunday);
  });
}

export async function closeEventAttendance(id:number,user:AuthenticatedUser,reopen=false,options:CloseOptions={}) {
  if(options.reflect_sunday_absences!==undefined&&typeof options.reflect_sunday_absences!=='boolean')throw new ParticipationError('Choose whether to include Sunday absences.');
  await eventFor(id);
  return db.transaction(async c=>{
    await c.query('SELECT pg_advisory_xact_lock(237024)');
    const {event,ministries}=await organizerEvent(c,id,user);
    if(reopen) {
      await c.query('DELETE FROM event_attendance_sessions WHERE event_id=$1',[id]);
      await c.query("INSERT INTO audit_logs(user_id,action,target_table,target_id,details) VALUES($1,'REOPEN_EVENT_ATTENDANCE','events',$2,'Reopened for corrections')",[user.id,id]);
      return {closed:false,no_shows:0,declined:0};
    }
    if(new Date(event.end_time).getTime()>Date.now())throw new ParticipationError('Close attendance after the scheduled event ends.',409);
    if((await c.query('SELECT 1 FROM event_attendance_sessions WHERE event_id=$1',[id])).rowCount)return {closed:true,no_shows:0,declined:0};
    const plan=await closePlan(c,event,options.reflect_sunday_absences===true);
    if(options.expected_sunday_service_date!==undefined&&options.expected_sunday_service_date!==(event.sunday_service_date||null))throw new ParticipationError('The linked Sunday service changed. Review the remaining absences again.',409);
    if(options.preview_token!==undefined&&options.preview_token!==plan.preview_token)throw new ParticipationError('Attendance changed. Review the remaining absences again before confirming.',409);
    if(options.reflect_sunday_absences===true&&!options.preview_token)throw new ParticipationError('Review the event and Sunday absence list before confirming.');
    const members=plan.event_members,guests=plan.event_guests;
    let no_shows=0,declined=0;
    for(const participant of [...members,...guests]) {
      const reason=participant.answer==='no'?participant.reason||'Cannot attend — invitation declined':'No-show — arrival was not confirmed when attendance closed';
      await writeParticipant(c,event,{...user,ministry_ids:ministries},{...participant,status:'absent',reason});
      if(participant.answer==='no')declined++;else no_shows++;
    }
    for(const person of plan.sunday_members) {
      if(!person.ministry_id)throw new ParticipationError('Assign a ministry before finalizing Sunday attendance.');
      const saved=await c.query(`INSERT INTO attendance(member_id,ministry_id,checked_in_by,checked_in_at,notes,reflected_from_event_id)
        VALUES($1,$2,$3,$4::timestamptz,'[ABSENT] No attendance confirmed in the linked event and Sunday worship',$5) RETURNING id`,[person.member_id,person.ministry_id,user.id,`${event.sunday_service_date}T09:30:00+08:00`,id]);
      await c.query("INSERT INTO audit_logs(user_id,action,target_table,target_id,details) VALUES($1,'REFLECT_EVENT_ABSENCE','attendance',$2,$3)",[user.id,saved.rows[0].id,JSON.stringify({event_id:id,member_id:person.member_id,service_date:event.sunday_service_date})]);
    }
    await c.query('INSERT INTO event_attendance_sessions(event_id,closed_by) VALUES($1,$2)',[id,user.id]);
    await c.query("INSERT INTO audit_logs(user_id,action,target_table,target_id,details) VALUES($1,'CLOSE_EVENT_ATTENDANCE','events',$2,$3)",[user.id,id,JSON.stringify({no_shows,declined})]);
    return {closed:true,no_shows,declined,sunday_absent:plan.sunday_members.length,preserved_sunday:plan.preserved_sunday};
  });
}

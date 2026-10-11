import {useEffect,useRef,useState} from 'react';
import {api} from '../../api';
import {useAuth} from '../../context/AuthContext';
import {useSocketEvent} from '../../socket';
import {Button} from '../common/Button';
import {Pagination} from '../common/Pagination';
import {useListPagination} from '../../hooks/useListPagination';
import {Dialog} from '../common/Dialog';
import {EventRsvpModal} from './EventRsvpModal';
import type {EventAttendanceRosterResponse} from '../../types';

type Participant={key:string;name:string;kind:'Member'|'Guest';member_id?:number;response_id?:number;status:string;reason:string;confirmed:boolean;answer:string|null;ministry?:string};
export function EventAttendancePanel({eventId}:{eventId:number}) {
  const {user}=useAuth();
  const [data,setData]=useState<EventAttendanceRosterResponse|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [filter,setFilter]=useState('expected'),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[walkIn,setWalkIn]=useState(false),[ministry,setMinistry]=useState('all');
  const [action,setAction]=useState<{person:Participant;status:string}|null>(null),[reason,setReason]=useState('');
  const [closing,setClosing]=useState<'close'|'reopen'|null>(null),[notice,setNotice]=useState('');
  const closed=!!data?.attendance_closed_at;
  const current=useRef(eventId);current.current=eventId;
  useEffect(()=>{let active=true;setData(null);setLoading(true);setError('');api.getEventAttendanceRoster(eventId).then(s=>{if(active)setData(s);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[eventId]);
  const refresh=async()=>{setError('');try{const fresh=await api.getEventAttendanceRoster(eventId);if(current.current===eventId)setData(fresh);}catch(e){if(current.current===eventId)setError(e instanceof Error?e.message:'Unable to load attendance.');}};
  useSocketEvent('events:changed',p=>{if(p.id===eventId||p.event_id===eventId)void refresh();},[eventId]);
  const people:Participant[]=[...(data?.attendees||[]).map(m=>({key:'member:'+m.member_id,name:`${m.first_name} ${m.last_name}`,kind:'Member' as const,member_id:m.member_id,status:m.status,reason:m.attendance_notes||(m.attendance_confirmed?'':m.invitation_reason)||'',ministry:m.ministry_name||'Unassigned',confirmed:!!m.attendance_confirmed,answer:m.invitation_answer||null})),...(data?.guests||[]).map(g=>({key:'guest:'+g.response_id,name:g.name,kind:'Guest' as const,response_id:g.response_id,status:g.status,reason:g.reason||(g.attendance_confirmed?'':g.invitation_reason)||'',ministry:'Guests',confirmed:g.attendance_confirmed,answer:g.answer}))];
  const shown=people.filter(p=>(ministry==='all'||p.ministry===ministry)&&p.name.toLowerCase().includes(query.toLowerCase())&&(filter==='all'||(filter==='expected'&&((p.status==='registered'||p.status==='unconfirmed')&&(p.answer==='yes'||p.member_id!==undefined&&p.answer===null)||p.status==='attended'))||(filter==='present'&&p.status==='attended')||(filter==='absent'&&['absent','excused'].includes(p.status))||(filter==='pending'&&['registered','unregistered','unconfirmed'].includes(p.status))));
  const pagination=useListPagination(shown,`${eventId}:${filter}:${query}:${ministry}`);
  const ministries=[...new Set(people.map(p=>p.ministry!))].sort();
  const save=async()=>{
    if(!action)return;setBusy(true);setError('');
    try{await api.markEventParticipant(eventId,{member_id:action.person.member_id,response_id:action.person.response_id,status:action.status,reason});setAction(null);await refresh();}catch(e){setError(e instanceof Error?e.message:'Attendance was not saved.');}finally{setBusy(false);}
  };
  const start=(person:Participant,status:string)=>{setReason('');setAction({person,status});};
  const finalize=async()=>{
    if(!closing)return;setBusy(true);setError('');
    try{const result=await api.closeEventAttendance(eventId,closing==='reopen');setNotice(result.closed?`Attendance closed. ${result.no_shows} no-show(s) recorded as Absent; ${result.declined} declined response(s) recorded with their reasons.`:'Attendance reopened. Existing decisions remain available for correction.');setClosing(null);await refresh();}catch(e){setError(e instanceof Error?e.message:'Attendance closing failed.');}finally{setBusy(false);}
  };
  const title=(p:Participant)=>p.status==='attended'?'Present':p.status==='absent'?'Absent':p.status==='excused'?'Excused':p.answer==='maybe'?'Not sure · Unconfirmed':'Waiting for check-in';
  return <section className="space-y-4" aria-label="Event attendance">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Attendance & check-in</h2><p className="text-sm text-muted">RSVP confirms intention. Mark Present only after confirming the person has arrived.</p></div><div className="flex gap-2"><Button disabled={busy||loading} onClick={()=>void refresh()}>Refresh attendance</Button>{['Admin','IT Admin','Pastor','Coordinator'].includes(user?.role_name||'')&&<Button disabled={busy||closed} onClick={()=>setWalkIn(true)}>Add member walk-in</Button>}</div></div>
    <div className="event-invitations-counts">{[['Present',people.filter(p=>p.status==='attended').length],['Waiting',people.filter(p=>['registered','unconfirmed','unregistered'].includes(p.status)).length],['Absent / Excused',people.filter(p=>['absent','excused'].includes(p.status)).length]].map(([label,count])=><div key={label}><strong>{count}</strong><span>{label}</span></div>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted">{closed?`Closed ${new Date(data!.attendance_closed_at!).toLocaleString()}. Reopen to correct attendance or process newly pulled responses.`:'Open. Expected participants remain unconfirmed until an actual arrival is recorded.'}</p>{['Admin','IT Admin','Pastor','Coordinator'].includes(user?.role_name||'')&&<Button disabled={busy||loading||!data||(!closed&&new Date(data.event.end_time).getTime()>Date.now())} onClick={()=>setClosing(closed?'reopen':'close')}>{closed?'Reopen attendance':'Close attendance'}</Button>}</div>
    {!closed&&data&&new Date(data.event.end_time).getTime()>Date.now()&&<p className="text-xs text-muted">Close attendance after the scheduled end to classify expected participants with no confirmed arrival as Absent.</p>}
    {notice&&<p role="status" className="text-sm">{notice}</p>}
    <div className="flex flex-wrap gap-2" aria-label="Attendance filters">{[['expected','Expected & present'],['present','Present'],['absent','Absent / Excused'],['pending','Unconfirmed'],['all','All participants']].map(([value,label])=><Button key={value} aria-pressed={filter===value} variant={filter===value?'primary':'secondary'} onClick={()=>setFilter(value)}>{label}</Button>)}</div>
    <label className="ui-field">Search participants<input className="ui-input" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <label className="ui-field">Participant ministry<select className="ui-input" value={ministry} onChange={e=>setMinistry(e.target.value)}><option value="all">All ministries & guests</option>{ministries.map(m=><option key={m} value={m}>{m}</option>)}</select></label>
    {error&&<p role="alert" className="event-invitations-error">{error}</p>}
    {loading?<p role="status">Loading participants…</p>:!shown.length?<p className="text-sm text-muted">No participants in this view. Invitation responses become available locally after manual Pull.</p>:<div className="grid gap-3">{pagination.items.map(p=><article key={p.key} className="event-participant" aria-label={p.name}><div><strong>{p.name}</strong><p className="text-sm text-muted">{p.kind} · {title(p)}</p>{p.status==='absent'&&!p.confirmed&&<p className="text-xs text-muted">From RSVP: Cannot attend. No arrival has been recorded.</p>}{p.reason&&<p className="text-sm mt-2">Reason / notes: {p.reason.replace(/^\[(ABSENT|EXCUSED|RSVP DECLINED)\]\s*/,'')}</p>}</div><div className="flex flex-wrap gap-2">{p.status!=='attended'&&<Button variant="primary" disabled={busy||closed} onClick={()=>start(p,'attended')}>Confirm present</Button>}<Button disabled={busy||closed} onClick={()=>start(p,'absent')}>Record absent</Button><Button disabled={busy||closed} onClick={()=>start(p,'excused')}>Record excused</Button>{p.confirmed&&<Button disabled={busy||closed} onClick={()=>start(p,'pending')}>Reset confirmation</Button>}</div></article>)}</div>}
    {!loading&&shown.length>0&&<Pagination page={pagination.page} pageSize={pagination.pageSize} total={pagination.total} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="participants"/>}
    {action&&<Dialog title={action.status==='attended'?'Confirm actual arrival':action.status==='pending'?'Reset attendance confirmation':'Record absence'} description={action.person.name} onClose={()=>{if(!busy)setAction(null);}} busy={busy} footer={<><Button disabled={busy} onClick={()=>setAction(null)}>Cancel</Button><Button variant="primary" disabled={busy||(['absent','excused'].includes(action.status)&&!reason.trim())} onClick={()=>void save()}>{action.status==='attended'?'Person is here — mark Present':action.status==='pending'?'Reset confirmation':'Save absence'}</Button></>}>
      {action.status==='attended'?<p className="text-sm">Confirm that this person is physically at the event. Their RSVP alone does not count as attendance.</p>:action.status==='pending'?<p className="text-sm">Remove the recorded attendance decision. The invitation answer remains unchanged.</p>:<label className="ui-field">Absence reason<textarea className="ui-input" value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)}/></label>}
      {error&&<p role="alert" className="event-invitations-error">{error}</p>}
    </Dialog>}
    {closing&&<Dialog title={closing==='close'?'Close event attendance':'Reopen event attendance'} onClose={()=>{if(!busy)setClosing(null);}} busy={busy} footer={<><Button disabled={busy} onClick={()=>setClosing(null)}>Cancel</Button><Button variant="primary" disabled={busy} onClick={()=>void finalize()}>{closing==='close'?'Confirm close attendance':'Confirm reopen attendance'}</Button></>}>
      <p className="text-sm">{closing==='close'?'Confirmed arrivals stay Present. Expected participants without a recorded arrival become Absent with a no-show reason. Cannot-attend replies keep their stated reasons. Not-sure replies remain unconfirmed.':'Reopen for corrections. Existing attendance decisions are preserved.'}</p>
      {error&&<p role="alert" className="event-invitations-error">{error}</p>}
    </Dialog>}
    {walkIn&&<EventRsvpModal eventId={eventId} onClose={()=>setWalkIn(false)} onSaved={()=>void refresh()}/>}
  </section>;
}

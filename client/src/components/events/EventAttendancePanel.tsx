import {useEffect,useRef,useState} from 'react';
import {api} from '../../api';
import {useAuth} from '../../context/AuthContext';
import {useSocketEvent} from '../../socket';
import {Button} from '../common/Button';
import {Pagination} from '../common/Pagination';
import {useListPagination} from '../../hooks/useListPagination';
import {Dialog} from '../common/Dialog';
import {EventRsvpModal} from './EventRsvpModal';
import {EventSundayReflection} from './EventSundayReflection';
import {EventCloseAttendanceDialog} from './EventCloseAttendanceDialog';
import {StatCard} from '../common/StatCard';
import {FilterPanel} from '../common/FilterPanel';
import {BatchRollCallToolbar} from '../attendance/BatchRollCallToolbar';
import {UserCheck,UserX,Users,ListChecks,Clock,CheckCircle2} from 'lucide-react';
import './event-attendance.css';
import type {EventAttendanceRosterResponse} from '../../types';

type Participant={key:string;name:string;kind:'Member'|'Guest';member_id?:number;response_id?:number;status:string;reason:string;confirmed:boolean;answer:string|null;ministry?:string};
export function EventAttendancePanel({eventId}:{eventId:number}) {
  const {user}=useAuth();
  const [data,setData]=useState<EventAttendanceRosterResponse|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [filter,setFilter]=useState('expected'),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[walkIn,setWalkIn]=useState(false),[ministry,setMinistry]=useState('all');
  const [action,setAction]=useState<{person:Participant;status:string}|null>(null),[reason,setReason]=useState('');
  const [closing,setClosing]=useState<'close'|'reopen'|null>(null),[notice,setNotice]=useState('');
  const closed=!!data?.attendance_closed_at;
  const dateInManila=(value:string|number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  const attendanceOpen=data?.attendance_window?.open??(!!data&&dateInManila(Date.now())>=dateInManila(data.event.start_time)&&dateInManila(Date.now())<=dateInManila(data.event.end_time));
  const canMark=attendanceOpen&&!!user&&['Admin','IT Admin','Pastor','Coordinator','Leader','Volunteer'].includes(user.role_name);
  const [batch,setBatch]=useState(false),[method,setMethod]=useState<'present_only'|'absent_rest_present'|'present_rest_absent'>('present_only');
  const [selection,setSelection]=useState<Set<number>>(new Set()),[batchReview,setBatchReview]=useState(false),[batchReason,setBatchReason]=useState('');
  const current=useRef(eventId);current.current=eventId;
  useEffect(()=>{let active=true;setData(null);setLoading(true);setError('');api.getEventAttendanceRoster(eventId).then(s=>{if(active)setData(s);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[eventId]);
  const refresh=async()=>{setError('');try{const fresh=await api.getEventAttendanceRoster(eventId);if(current.current===eventId)setData(fresh);}catch(e){if(current.current===eventId)setError(e instanceof Error?e.message:'Unable to load attendance.');}};
  useSocketEvent('events:changed',p=>{if(p.id===eventId||p.event_id===eventId)void refresh();},[eventId]);
  const people:Participant[]=[...(data?.attendees||[]).map(m=>({key:'member:'+m.member_id,name:`${m.first_name} ${m.last_name}`,kind:'Member' as const,member_id:m.member_id,status:m.status,reason:m.attendance_notes||(m.attendance_confirmed?'':m.invitation_reason)||'',ministry:m.ministry_name||'Unassigned',confirmed:!!m.attendance_confirmed,answer:m.invitation_answer||null})),...(data?.guests||[]).map(g=>({key:'guest:'+g.response_id,name:g.name,kind:'Guest' as const,response_id:g.response_id,status:g.status,reason:g.reason||(g.attendance_confirmed?'':g.invitation_reason)||'',ministry:'Guests',confirmed:g.attendance_confirmed,answer:g.answer}))];
  const matchesStatus=(p:Participant)=>filter==='all'||(filter==='expected'&&((p.status==='registered'||p.status==='unconfirmed')&&(p.answer==='yes'||p.member_id!==undefined&&p.answer===null)||p.status==='attended'))||(filter==='present'&&p.status==='attended')||(filter==='absent'&&['absent','excused'].includes(p.status))||(filter==='pending'&&['registered','unregistered','unconfirmed'].includes(p.status));
  const shown=people.filter(p=>(ministry==='all'||p.ministry===ministry)&&p.name.toLowerCase().includes(query.toLowerCase())&&matchesStatus(p));
  const pagination=useListPagination(shown,`${eventId}:${filter}:${query}:${ministry}`);
  const ministries=[...new Set(people.map(p=>p.ministry!))].sort();
  const batchScope=people.filter(p=>p.member_id!==undefined&&!p.confirmed&&['registered','unregistered','unconfirmed'].includes(p.status)&&(ministry==='all'||p.ministry===ministry)&&matchesStatus(p));
  const matching=batchScope.filter(p=>p.name.toLowerCase().includes(query.toLowerCase()));
  const selectedIds=batchScope.filter(p=>selection.has(p.member_id!)).map(p=>p.member_id!);
  const presentIds=batchScope.filter(p=>method==='absent_rest_present'?!selection.has(p.member_id!):selection.has(p.member_id!)).map(p=>p.member_id!);
  const absentIds=method==='present_only'?[]:batchScope.filter(p=>method==='absent_rest_present'?selection.has(p.member_id!):!selection.has(p.member_id!)).map(p=>p.member_id!);
  const saveBatch=async()=>{
    if(!canMark||closed||busy||!presentIds.length&&!absentIds.length)return;
    setBusy(true);setError('');
    try{
      await api.batchMarkEventAttendance(eventId,{present_ids:presentIds,absent_ids:absentIds,notes:batchReason.trim(),expected_sunday_service_date:data?.event.sunday_service_date||null});
      setNotice(`Batch roll call saved: ${presentIds.length} Present, ${absentIds.length} Absent.`);
      setBatchReview(false);setSelection(new Set());setBatchReason('');await refresh();
    }catch(e){setError(e instanceof Error?e.message:'Batch attendance was not saved.');}finally{setBusy(false);}
  };
  const save=async()=>{
    if(!action||!canMark)return;setBusy(true);setError('');
    try{await api.markEventParticipant(eventId,{member_id:action.person.member_id,response_id:action.person.response_id,status:action.status,reason,expected_sunday_service_date:data?.event.sunday_service_date||null});setAction(null);await refresh();}catch(e){setError(e instanceof Error?e.message:'Attendance was not saved.');}finally{setBusy(false);}
  };
  const start=(person:Participant,status:string)=>{setReason('');setAction({person,status});};
  const finalize=async(options:{reflect_sunday_absences?:boolean;preview_token?:string;expected_sunday_service_date?:string|null}={})=>{
    if(!closing)return;setBusy(true);setError('');
    try{const result=await api.closeEventAttendance(eventId,closing==='reopen',options);setNotice(result.closed?`Attendance closed. ${result.no_shows} no-show(s) recorded as Absent; ${result.declined} declined response(s) recorded with their reasons. ${result.sunday_absent||0} marked Absent in Sunday Worship; existing Sunday records were preserved.`:'Attendance reopened. Existing decisions remain available for correction.');setClosing(null);setBatch(false);setBatchReview(false);setSelection(new Set());await refresh();}catch(e){setError(e instanceof Error?e.message:'Attendance closing failed.');}finally{setBusy(false);}
  };
  const title=(p:Participant)=>p.status==='attended'?'Present':p.status==='absent'?'Absent':p.status==='excused'?'Excused':p.answer==='maybe'?'Not sure · Unconfirmed':'Waiting for check-in';
  return <section className="event-attendance space-y-5" aria-label="Event attendance">
    {data&&!attendanceOpen&&<p role="status" className="rounded-xl border border-line p-4 text-sm">{data.attendance_window?.message||`Attendance can only be marked on ${dateInManila(data.event.start_time)}${dateInManila(data.event.start_time)!==dateInManila(data.event.end_time)?` through ${dateInManila(data.event.end_time)}`:''} (Philippine time).`} You can review the roster and prepare Sunday reflection settings.</p>}
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Attendance & check-in</h2><p className="text-sm text-muted">RSVP confirms intention. Mark Present only after confirming the person has arrived.</p></div><div className="flex gap-2"><Button disabled={busy||loading} onClick={()=>void refresh()}>Refresh attendance</Button>{['Admin','IT Admin','Pastor','Coordinator'].includes(user?.role_name||'')&&<Button disabled={busy||closed} onClick={()=>setWalkIn(true)}>Add member walk-in</Button>}</div></div>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Event attendance summary">
      <StatCard label="Present at Event" value={people.filter(p=>p.status==='attended').length} icon={<UserCheck/>} tone="emerald" description="Confirmed physical arrivals" />
      <StatCard label="Absent / Excused" value={people.filter(p=>['absent','excused'].includes(p.status)).length} icon={<UserX/>} tone="rose" description={`${people.filter(p=>p.status==='absent').length} Absent · ${people.filter(p=>p.status==='excused').length} Excused`} />
      <StatCard label="Waiting for Check-In" value={people.filter(p=>['registered','unconfirmed','unregistered'].includes(p.status)).length} icon={<Clock/>} tone="amber" description="Attendance not yet confirmed" />
      <StatCard label="Participants" value={people.length} icon={<Users/>} description={`${people.filter(p=>p.kind==='Member').length} Members · ${people.filter(p=>p.kind==='Guest').length} Guests`} />
    </div>
    {data&&<EventSundayReflection data={data} busy={busy||!!action||batchReview} onBusyChange={setBusy} onSaved={refresh} onError={setError}/>}
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted">{closed?`Closed ${new Date(data!.attendance_closed_at!).toLocaleString()}. Reopen to process newly pulled responses; marking corrections is available on event dates.`:'Open. Participants remain unconfirmed until an actual arrival is recorded or the organizer finalizes absences.'}</p>{data?.can_manage_sunday_reflection&&<Button disabled={busy||loading||(!closed&&new Date(data.event.end_time).getTime()>Date.now())} onClick={()=>{setError('');setClosing(closed?'reopen':'close');}}>{closed?'Reopen attendance':'Close attendance & mark remaining Absent'}</Button>}</div>
    {!closed&&data&&new Date(data.event.end_time).getTime()>Date.now()&&<p className="text-xs text-muted">Close attendance after the scheduled end to classify expected participants with no confirmed arrival as Absent.</p>}
    {notice&&<p role="status" className="text-sm">{notice}</p>}
    <FilterPanel title="Attendance filters" summary="Filter the event attendance roster">
    <div className="flex flex-wrap gap-2" aria-label="Attendance filters">{[['expected','Expected & present'],['present','Present'],['absent','Absent / Excused'],['pending','Unconfirmed'],['all','All participants']].map(([value,label])=><Button size="sm" key={value} disabled={busy} aria-pressed={filter===value} variant={filter===value?'primary':'secondary'} onClick={()=>{setFilter(value);setSelection(new Set());}}>{label}</Button>)}</div>
    <div className="grid sm:grid-cols-[minmax(0,1fr)_240px] gap-3 mt-3">
    <label className="ui-field">Search participants<input className="ui-input" disabled={busy} value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <label className="ui-field">Participant ministry<select className="ui-input" disabled={busy} value={ministry} onChange={e=>{setMinistry(e.target.value);setSelection(new Set());}}><option value="all">All ministries & guests</option>{ministries.map(m=><option key={m} value={m}>{m}</option>)}</select></label>
    </div></FilterPanel>
    <div className="event-attendance-directory">
    <header className="event-attendance-directory-heading"><div className="flex items-center gap-3"><span className="event-attendance-icon"><UserCheck size={20}/></span><div><h2 className="font-semibold text-sm">Special Event Attendance Directory <span className="text-xs text-muted font-normal">({shown.length} participants shown)</span></h2><p className="text-xs text-muted mt-1">Confirm arrivals, record absences, or update attendance in one roll call.</p></div></div><Button variant={batch?'secondary':'primary'} disabled={!canMark||busy||loading||(!batch&&(closed||!batchScope.length))} onClick={()=>{setBatch(!batch);setSelection(new Set());}}><ListChecks size={16}/>{batch?'Exit Batch Roll Call':'Batch Roll Call'}</Button></header>
    {batch&&!closed&&<div className="p-4"><BatchRollCallToolbar method={method} onMethodChange={value=>{setMethod(value);setSelection(new Set());}} selectedCount={selectedIds.length} scopeCount={batchScope.length} matchingCount={matching.length} search={query} onSearchChange={setQuery} onSelectAll={()=>setSelection(new Set(matching.map(p=>p.member_id!)))} onClear={()=>setSelection(new Set())} onInvert={()=>setSelection(new Set(batchScope.filter(p=>matching.includes(p)?!selection.has(p.member_id!):selection.has(p.member_id!)).map(p=>p.member_id!)))} onSave={()=>{if(presentIds.length+absentIds.length>100){setError('Select up to 100 members per batch, or narrow the ministry scope.');return;}setBatchReason('');setBatchReview(true);}} submitting={busy}/><p className="ui-help mt-3">Batch roll call applies to unconfirmed members in the selected ministry and status scope. Confirm guest arrivals individually; existing attendance decisions are preserved.</p></div>}
    {error&&<p role="alert" className="event-invitations-error">{error}</p>}
    {loading?<p role="status" className="p-5">Loading participants…</p>:!shown.length?<p className="text-sm text-muted p-5">No participants in this view. Invitation responses become available locally after manual Pull.</p>:<div className="event-attendance-table-wrap"><table className="event-attendance-table"><thead><tr>{batch&&!closed&&<th scope="col">Select</th>}<th scope="col">Member / Guest Name</th><th scope="col">Ministry</th><th scope="col">Attendance Status</th><th scope="col">Attendance Action</th></tr></thead><tbody>{pagination.items.map(p=><tr key={p.key} aria-label={p.name} data-status={p.status}>
      {batch&&!closed&&<td>{batchScope.some(person=>person.key===p.key)&&<input type="checkbox" aria-label={`Select ${p.name}`} checked={selection.has(p.member_id!)} disabled={busy} onChange={e=>{const checked=e.target.checked;setSelection(previous=>{const next=new Set(previous);if(checked)next.add(p.member_id!);else next.delete(p.member_id!);return next;});}}/>}</td>}
      <th scope="row"><div className="flex items-center gap-3"><span className="event-attendance-avatar">{p.name.split(/\s+/).slice(0,2).map(part=>part[0]).join('')}</span><div><strong>{p.name}</strong><p className="text-xs text-muted font-normal mt-1">{p.kind}</p></div></div></th>
      <td>{p.ministry}</td><td><span className={`event-attendance-status event-attendance-status--${p.status}`}><CheckCircle2 size={12}/>{title(p)}</span>{p.status==='absent'&&!p.confirmed&&<p className="text-xs text-muted mt-2">From RSVP: Cannot attend. No arrival has been recorded.</p>}{p.reason&&<p className="text-xs text-muted mt-2">Reason / notes: {p.reason.replace(/^\[(ABSENT|EXCUSED|RSVP DECLINED)\]\s*/,'')}</p>}</td>
      <td><div className="flex flex-wrap gap-2">{p.status!=='attended'&&<Button size="sm" variant="primary" disabled={!canMark||busy||closed} onClick={()=>start(p,'attended')}>Confirm present</Button>}<Button size="sm" disabled={!canMark||busy||closed} onClick={()=>start(p,'absent')}>Record absent</Button><Button size="sm" disabled={!canMark||busy||closed} onClick={()=>start(p,'excused')}>Record excused</Button>{p.confirmed&&<Button size="sm" disabled={!canMark||busy||closed} onClick={()=>start(p,'pending')}>Reset confirmation</Button>}</div></td>
    </tr>)}</tbody></table></div>}
    {!loading&&shown.length>0&&<Pagination page={pagination.page} pageSize={pagination.pageSize} total={pagination.total} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="participants"/>}
    </div>
    {batchReview&&!closed&&<Dialog title="Review batch roll call" onClose={()=>{if(!busy)setBatchReview(false);}} busy={busy} footer={<><Button disabled={busy} onClick={()=>setBatchReview(false)}>Cancel</Button><Button variant="primary" disabled={!canMark||busy||!presentIds.length&&!absentIds.length||absentIds.length>0&&!batchReason.trim()} onClick={()=>void saveBatch()}>Confirm batch attendance</Button></>}>
      <p className="text-sm">{presentIds.length} Present · {absentIds.length} Absent. Confirm that every person marked Present is physically at the event. Unselected records stay unchanged when using Selected Present Only.</p>
      {data?.event.sunday_service_date&&presentIds.length>0&&<p className="text-sm">Also mark these members Present in Sunday Worship on {data.event.sunday_service_date}. Confirm they attended worship too. Existing Sunday records will be preserved.</p>}
      <ul className="text-sm space-y-1 max-h-48 overflow-auto">{batchScope.filter(p=>presentIds.includes(p.member_id!)||absentIds.includes(p.member_id!)).map(p=><li key={p.key}>{p.name} · {presentIds.includes(p.member_id!)?'Present':'Absent'}</li>)}</ul>
      {absentIds.length>0&&<label className="ui-field">Batch absence reason<textarea className="ui-input" value={batchReason} maxLength={1000} disabled={busy} onChange={e=>setBatchReason(e.target.value)}/></label>}
      {error&&<p role="alert" className="event-invitations-error">{error}</p>}
    </Dialog>}
    {action&&<Dialog title={action.status==='attended'?'Confirm actual arrival':action.status==='pending'?'Reset attendance confirmation':'Record absence'} description={action.person.name} onClose={()=>{if(!busy)setAction(null);}} busy={busy} footer={<><Button disabled={busy} onClick={()=>setAction(null)}>Cancel</Button><Button variant="primary" disabled={!canMark||busy||(['absent','excused'].includes(action.status)&&!reason.trim())} onClick={()=>void save()}>{action.status==='attended'?'Person is here — mark Present':action.status==='pending'?'Reset confirmation':'Save absence'}</Button></>}>
      {action.status==='attended'?<p className="text-sm">Confirm that this person is physically at the event. Their RSVP alone does not count as attendance.</p>:action.status==='pending'?<p className="text-sm">Remove the recorded attendance decision. The invitation answer remains unchanged.</p>:<label className="ui-field">Absence reason<textarea className="ui-input" value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)}/></label>}
      {action.status==='attended'&&action.person.kind==='Member'&&data?.event.sunday_service_date&&<p className="text-sm">Also mark Present in Sunday Worship on {data.event.sunday_service_date}. Confirm this member attended worship too. Existing Sunday records will be preserved.</p>}
      {error&&<p role="alert" className="event-invitations-error">{error}</p>}
    </Dialog>}
    {closing==='close'&&<EventCloseAttendanceDialog eventId={eventId} serviceDate={data?.event.sunday_service_date||null} busy={busy} error={error} onClose={()=>setClosing(null)} onConfirm={finalize}/>}
    {closing==='reopen'&&<Dialog title="Reopen event attendance" onClose={()=>{if(!busy)setClosing(null);}} busy={busy} footer={<><Button disabled={busy} onClick={()=>setClosing(null)}>Cancel</Button><Button variant="primary" disabled={busy} onClick={()=>void finalize()}>Confirm reopen attendance</Button></>}>
      <p className="text-sm">Reopen to finalize newly imported responses. Existing decisions are preserved; marking corrections is available only on the event’s scheduled dates.</p>
      {error&&<p role="alert" className="event-invitations-error">{error}</p>}
    </Dialog>}
    {walkIn&&<EventRsvpModal eventId={eventId} onClose={()=>setWalkIn(false)} onSaved={()=>void refresh()}/>}
  </section>;
}

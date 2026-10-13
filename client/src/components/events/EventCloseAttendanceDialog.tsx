import {useEffect,useState} from 'react';
import {api} from '../../api';
import type {EventClosePreview} from '../../types';
import {Button} from '../common/Button';
import {Dialog} from '../common/Dialog';
import {UserX,Users,ShieldCheck,Church,Search,RefreshCw,CheckCircle2,LockKeyhole} from 'lucide-react';
import './event-close-attendance.css';

export function EventCloseAttendanceDialog({eventId,serviceDate,ministryId,scopeLabel,ministries,busy,error,onClose,onConfirm}:{eventId:number;serviceDate:string|null;ministryId:string;scopeLabel:string;ministries:{id:number;name:string;closed?:boolean}[];busy:boolean;error:string;onClose:()=>void;onConfirm:(options:{reflect_sunday_absences:boolean;preview_token:string;expected_sunday_service_date:string|null;ministry_ids?:number[]})=>Promise<void>}) {
  const [reflectSunday,setReflectSunday]=useState(!!serviceDate),[plan,setPlan]=useState<EventClosePreview|null>(null),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState(''),[revision,setRevision]=useState(0),[query,setQuery]=useState('');
  const [customScope,setCustomScope]=useState(false),[selectedMinistries,setSelectedMinistries]=useState<number[]>(ministryId==='all'?ministries.filter(m=>!m.closed).map(m=>m.id):[Number(ministryId)]);
  const selectionKey=selectedMinistries.join(',');
  const emptyScope=customScope&&!selectedMinistries.length;
  useEffect(()=>{let active=true;setLoading(true);setPlan(null);setLoadError('');
    if(emptyScope){setLoading(false);return()=>{active=false;};}
    api.previewEventClose(eventId,reflectSunday,ministryId,customScope?selectedMinistries:undefined).then(value=>{if(active)setPlan(value);}).catch(e=>{if(active)setLoadError(e instanceof Error?e.message:'Unable to review absences.');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[eventId,reflectSunday,revision,ministryId,customScope,selectionKey]);
  const people=plan?[...plan.event_members.map(p=>({...p,key:`member:${p.member_id}`,kind:'Member'})),...plan.event_guests.map(p=>({...p,key:`guest:${p.response_id}`,kind:'Guest'}))]:[];
  const matching=people.filter(p=>p.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <Dialog className="event-close-dialog" title="Finalize remaining absences" description="Review the roster before closing attendance." icon={<span className="event-close-heading-icon"><UserX size={22} aria-hidden="true"/></span>} onClose={()=>{if(!busy)onClose();}} busy={busy} footer={<>
    <Button className="event-close-refresh" size="sm" disabled={busy||loading} onClick={()=>setRevision(value=>value+1)}><RefreshCw size={14} className={loading?'animate-spin':''} aria-hidden="true"/>Review latest attendance</Button>
    <Button disabled={busy} onClick={onClose}>Cancel</Button><Button variant="primary" pending={busy} disabled={loading||!plan||emptyScope} onClick={()=>{if(plan)void onConfirm({reflect_sunday_absences:reflectSunday,preview_token:plan.preview_token,expected_sunday_service_date:plan.sunday_service_date,...(customScope?{ministry_ids:selectedMinistries}:{})});}}><LockKeyhole size={15} aria-hidden="true"/>{customScope?'Close selected ministries':'Mark remaining Absent & close'}</Button>
  </>}>
    <div className="event-close-scope"><Users size={15} aria-hidden="true"/><span><span className="event-close-eyebrow">Attendance scope</span><strong>Scope: {customScope?ministries.filter(m=>selectedMinistries.includes(m.id)).map(m=>m.name).join(', ')||'No ministry selected':scopeLabel}</strong></span></div>
    {ministries.length>0&&<fieldset className="event-close-ministries" disabled={busy}><legend>Ministries to close</legend><label><input type="radio" name="close-scope" checked={!customScope} onChange={()=>setCustomScope(false)}/>Use current scope: {scopeLabel}</label><label><input type="radio" name="close-scope" checked={customScope} onChange={()=>setCustomScope(true)}/>Choose ministries</label>{customScope&&<div>{ministries.map(m=><label key={m.id}><input type="checkbox" checked={selectedMinistries.includes(m.id)} disabled={m.closed} onChange={e=>setSelectedMinistries(previous=>e.target.checked?[...previous,m.id]:previous.filter(id=>id!==m.id))}/>{m.name}{m.closed?' · Closed':''}</label>)}</div>}<p>Only selected ministries close. The remaining ministries stay open. Guests without a ministry are included only when using the all-ministry scope.</p>{emptyScope&&<p role="status">Select at least one ministry to review.</p>}</fieldset>}
    <div className="event-close-summary">
      <div><span className="event-close-eyebrow">To be marked absent</span><div className="event-close-total">{loading?'—':people.length}<span>participants</span></div><p>{loading?'Preparing your review…':`${plan?.event_members.length||0} members · ${plan?.event_guests.length||0} guests`}</p></div>
      <div className="event-close-preserved"><ShieldCheck size={20} aria-hidden="true"/><div><strong>Existing records are protected</strong><p>Present, Excused, and recorded attendance decisions are preserved.</p></div></div>
    </div>
    <p className="event-close-instruction">Confirm that attendance has finished and the people below did not attend. Changes are saved when you confirm.</p>
    <section className="event-close-roster" aria-label="Remaining participants">
      <div className="event-close-section-heading"><h3>Remaining participants</h3><span className="event-close-count">{loading?'…':people.length}</span></div>
      {plan&&<p className="sr-only">{people.length} remaining event participants → Absent</p>}
      <label className="event-close-search"><Search size={16} aria-hidden="true"/><input aria-label="Search remaining participants" placeholder="Search by name…" value={query} disabled={busy||loading} onChange={e=>setQuery(e.target.value)}/></label>
      <div className="event-close-list" tabIndex={0} aria-label="Participants to mark absent" aria-busy={loading}>
        {loading?<div className="event-close-empty" role="status"><RefreshCw size={20} className="animate-spin" aria-hidden="true"/>Reviewing remaining participants…</div>:!plan?<p className="event-close-empty">The review could not be loaded. Try reviewing again.</p>:!matching.length?<div className="event-close-empty">{people.length?'No names match your search.':<><CheckCircle2 size={24} aria-hidden="true"/>Everyone in this scope has an attendance record.</>}</div>:<ul>{matching.map(p=><li key={p.key}><span className="event-close-avatar" aria-hidden="true">{p.name.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('')}</span><div className="event-close-person"><strong>{p.name}</strong><p>{p.answer==='no'?`Cannot attend${p.reason?` — ${p.reason}`:''}`:'No confirmed arrival'}</p></div><span className="event-close-kind">{p.kind}</span></li>)}</ul>}
      </div>
      {!loading&&people.length>0&&<p className="event-close-list-note">{matching.length} of {people.length} shown · Searching does not change who will be marked Absent.</p>}
    </section>
    <section className={`event-close-sunday ${reflectSunday?'is-enabled':''}`} aria-label="Sunday absence reflection">
      <Church size={20} aria-hidden="true"/><div>
        {serviceDate?<><label className="event-close-toggle"><input type="checkbox" checked={reflectSunday} disabled={busy} onChange={e=>setReflectSunday(e.target.checked)}/><span>Also mark these members Absent in Sunday Worship on {serviceDate}</span></label>{reflectSunday&&plan&&<><p className="event-close-sunday-result">{plan.sunday_members.length} {plan.sunday_members.length===1?'member':'members'} → Sunday Worship Absent ({plan.sunday_service_date})</p>{plan.sunday_members.length>0&&<details><summary>View Sunday members</summary><ul>{plan.sunday_members.map(p=><li key={p.member_id}>{p.name}</li>)}</ul></details>}<p>{plan.preserved_sunday} existing Sunday record(s) will stay unchanged. Guests are event-only.</p></>}{!reflectSunday&&<p>Sunday Worship stays unchanged.</p>}</>:<><strong>Sunday Worship stays unchanged</strong><p>Enable Sunday reflection for this event to include the linked service.</p></>}
      </div>
    </section>
    {(loadError||error)&&<p role="alert" className="event-invitations-error">{loadError||error}</p>}
  </Dialog>;
}

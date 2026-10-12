import {useEffect,useState} from 'react';
import {api} from '../../api';
import type {EventClosePreview} from '../../types';
import {Button} from '../common/Button';
import {Dialog} from '../common/Dialog';

export function EventCloseAttendanceDialog({eventId,serviceDate,busy,error,onClose,onConfirm}:{eventId:number;serviceDate:string|null;busy:boolean;error:string;onClose:()=>void;onConfirm:(options:{reflect_sunday_absences:boolean;preview_token:string;expected_sunday_service_date:string|null})=>Promise<void>}) {
  const [reflectSunday,setReflectSunday]=useState(!!serviceDate),[plan,setPlan]=useState<EventClosePreview|null>(null),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState(''),[revision,setRevision]=useState(0);
  useEffect(()=>{let active=true;setLoading(true);setPlan(null);setLoadError('');
    api.previewEventClose(eventId,reflectSunday).then(value=>{if(active)setPlan(value);}).catch(e=>{if(active)setLoadError(e instanceof Error?e.message:'Unable to review absences.');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[eventId,reflectSunday,revision]);
  return <Dialog title="Finalize remaining absences" onClose={()=>{if(!busy)onClose();}} busy={busy} footer={<><Button disabled={busy} onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy||loading||!plan} onClick={()=>{if(plan)void onConfirm({reflect_sunday_absences:reflectSunday,preview_token:plan.preview_token,expected_sunday_service_date:plan.sunday_service_date});}}>Mark remaining Absent & close</Button></>}>
    <p className="text-sm">Confirm that attendance has finished and these people did not attend. This is a manual action. Existing Present, Excused, and recorded attendance decisions are preserved.</p>
    {serviceDate?<label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={reflectSunday} disabled={busy} onChange={e=>setReflectSunday(e.target.checked)}/>Also mark these members Absent in Sunday Worship on {serviceDate}</label>:<p className="text-sm text-muted">Sunday Worship stays unchanged. Enable Sunday reflection for this event to include the linked service.</p>}
    {loading?<p role="status">Reviewing remaining participants…</p>:plan&&<>
      <p className="font-semibold text-sm">{plan.event_members.length+plan.event_guests.length} remaining event participants → Absent</p>
      <ul className="text-sm max-h-40 overflow-auto space-y-1">{[...plan.event_members,...plan.event_guests].map((p,index)=><li key={index}>{p.name} · {p.answer==='no'?`Cannot attend${p.reason?` — ${p.reason}`:''}`:'No confirmed arrival'}</li>)}</ul>
      {reflectSunday&&<><p className="font-semibold text-sm">{plan.sunday_members.length} {plan.sunday_members.length===1?'member':'members'} → Sunday Worship Absent ({plan.sunday_service_date})</p><ul className="text-sm max-h-40 overflow-auto space-y-1">{plan.sunday_members.map(p=><li key={p.member_id}>{p.name}</li>)}</ul><p className="text-xs text-muted">{plan.preserved_sunday} existing Sunday record(s) will stay unchanged. Guests are event-only. Only event participants are included.</p></>}
    </>}
    {(loadError||error)&&<p role="alert" className="event-invitations-error">{loadError||error}</p>}
    <Button size="sm" disabled={busy||loading} onClick={()=>setRevision(value=>value+1)}>Review latest attendance</Button>
  </Dialog>;
}

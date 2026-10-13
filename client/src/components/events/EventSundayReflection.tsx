import {useEffect,useState} from 'react';
import {Church} from 'lucide-react';
import {Button} from '../common/Button';
import {api} from '../../api';
import type {EventAttendanceRosterResponse} from '../../types';

const localDate=(value:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));

export function EventSundayReflection({data,busy,onBusyChange,onSaved,onError}:{data:EventAttendanceRosterResponse;busy:boolean;onBusyChange:(busy:boolean)=>void;onSaved:()=>Promise<void>;onError:(message:string)=>void}) {
  const savedDate=data.event.sunday_service_date||'';
  const firstDate=localDate(data.event.start_time),lastDate=localDate(data.event.end_time);
  const [enabled,setEnabled]=useState(!!savedDate),[date,setDate]=useState(savedDate||firstDate),[saving,setSaving]=useState(false);
  useEffect(()=>{setEnabled(!!savedDate);setDate(savedDate||firstDate);},[data.event.id,savedDate,firstDate]);
  const validSunday=/^\d{4}-\d{2}-\d{2}$/.test(date)&&new Date(`${date}T00:00:00Z`).getUTCDay()===0&&date>=firstDate&&date<=lastDate;
  const dirty=(enabled?date:'')!==savedDate;
  const locked=busy||saving||!!data.attendance_closed_at;
  const save=async()=>{
    setSaving(true);onBusyChange(true);onError('');
    try{await api.setEventSundayReflection(data.event.id,enabled?date:null);await onSaved();}
    catch(error){onError(error instanceof Error?error.message:'Sunday reflection was not saved.');}
    finally{setSaving(false);onBusyChange(false);}
  };
  return <div className="event-sunday-reflection space-y-3" aria-label="Sunday worship reflection">
    <div className="event-sunday-reflection-heading"><Church size={18} aria-hidden="true"/><div><h3 className="font-semibold text-sm">Sunday Worship attendance integration</h3><p className="text-sm text-muted mt-1">{savedDate?`Enabled for ${savedDate}. New confirmed member arrivals also mark Sunday Worship Present.`:'Off. Event check-ins are recorded separately from Sunday Worship.'}</p></div></div>
    {data.can_manage_sunday_reflection&&<>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} disabled={locked} onChange={e=>setEnabled(e.target.checked)}/>Also mark Present in Sunday Worship</label>
      {enabled&&<label className="ui-field">Sunday service date<input type="date" className="ui-input max-w-xs" value={date} min={firstDate} max={lastDate} disabled={locked} onChange={e=>setDate(e.target.value)}/>{!validSunday&&<span className="ui-help">Choose a Sunday within the event’s scheduled dates.</span>}</label>}
      <Button size="sm" disabled={locked||!dirty||enabled&&!validSunday} onClick={()=>void save()}>{saving?'Saving…':'Save Sunday reflection'}</Button>
    </>}
    <details className="event-sunday-reflection-help"><summary>How Sunday reflection works</summary><p className="text-xs text-muted">Applies to future individual and batch confirmations only. Confirm the member attended worship too. Existing Sunday records, guests, and Absent / Excused decisions stay unchanged. Resetting event attendance does not undo Sunday attendance.</p></details>
  </div>;
}

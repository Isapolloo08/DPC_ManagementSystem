import {useEffect,useState} from 'react';
import {api} from '../../api';
import {Button} from '../common/Button';
import {PageHeader} from '../common/PageHeader';
import {CalendarDays} from 'lucide-react';
import {EventAttendancePanel} from '../events/EventAttendancePanel';
import type {EventItem} from '../../types';
import '../events/event-invitations.css';

export function EventAttendanceCheckInView({initialEventId}:{initialEventId?:number}) {
  const [events,setEvents]=useState<EventItem[]>([]),[selected,setSelected]=useState<number|null>(initialEventId||null);
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  const load=async()=>{setLoading(true);setError('');try{const rows=await api.getEvents();setEvents(rows);setSelected(current=>current||rows[0]?.id||null);}catch(e){setError(e instanceof Error?e.message:'Unable to load events.');}finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);
  useEffect(()=>{if(initialEventId)setSelected(initialEventId);},[initialEventId]);
  const event=events.find(e=>e.id===selected);
  return <div className="space-y-5">
    <PageHeader icon={<CalendarDays/>} title="Special Event Attendance" description="Track event arrivals, record absences and excuses, and manage the attendance roster." actions={loading?<p role="status">Loading events…</p>:<label className="ui-field">Select special event<select className="ui-input" value={selected||''} onChange={e=>setSelected(e.target.value?Number(e.target.value):null)}><option value="">Choose an event</option>{events.map(e=><option value={e.id} key={e.id}>{e.title} · {new Date(e.start_time).toLocaleDateString()}</option>)}</select></label>}>
      {event&&<p className="text-sm text-muted">{new Date(event.start_time).toLocaleString()} – {new Date(event.end_time).toLocaleString()} · {event.location||'Location to follow'}</p>}
    </PageHeader>
    {error&&<p role="alert" className="event-invitations-error">{error}<Button onClick={()=>void load()}>Retry events</Button></p>}
    {selected&&!loading&&<EventAttendancePanel key={selected} eventId={selected}/>}
  </div>;
}

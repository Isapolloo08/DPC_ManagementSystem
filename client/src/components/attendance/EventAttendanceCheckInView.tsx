import {useEffect,useState} from 'react';
import {api} from '../../api';
import {Button} from '../common/Button';
import {PageHeader} from '../common/PageHeader';
import {CalendarDays,Clock,MapPin} from 'lucide-react';
import {EventAttendancePanel} from '../events/EventAttendancePanel';
import type {EventItem} from '../../types';
import '../events/event-invitations.css';
import './event-check-in.css';

export function EventAttendanceCheckInView({initialEventId}:{initialEventId?:number}) {
  const [events,setEvents]=useState<EventItem[]>([]),[selected,setSelected]=useState<number|null>(initialEventId||null);
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  const load=async()=>{setLoading(true);setError('');try{const rows=await api.getEvents();setEvents(rows);setSelected(current=>current||rows[0]?.id||null);}catch(e){setError(e instanceof Error?e.message:'Unable to load events.');}finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);
  useEffect(()=>{if(initialEventId)setSelected(initialEventId);},[initialEventId]);
  const event=events.find(e=>e.id===selected);
  const header=<PageHeader className="event-check-in-header" icon={<CalendarDays/>} title="Special Event Attendance" description="Track event arrivals, record absences and excuses, and manage the attendance roster." actions={loading?<p role="status">Loading events...</p>:<label className="ui-field">Select special event<select className="ui-input" value={selected||''} onChange={e=>setSelected(e.target.value?Number(e.target.value):null)}><option value="">Choose an event</option>{events.map(e=><option value={e.id} key={e.id}>{e.title} · {new Date(e.start_time).toLocaleDateString('en-PH',{timeZone:'Asia/Manila'})}</option>)}</select></label>}>
    {event&&<div className="event-check-in-details"><span><Clock size={14}/>{new Date(event.start_time).toLocaleString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'})} – {new Date(event.end_time).toLocaleString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'})}</span><span><MapPin size={14}/>{event.location||'Location to follow'}</span><small>Philippine time (UTC+8)</small></div>}
  </PageHeader>;
  return <div className="event-check-in space-y-5">
    {error&&<p role="alert" className="event-invitations-error">{error}<Button onClick={()=>void load()}>Retry events</Button></p>}
    {selected&&!loading?<EventAttendancePanel key={selected} eventId={selected} header={header}/>:header}
  </div>;
}

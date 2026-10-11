import {useEffect,useRef,useState} from 'react';
import {Calendar,ArrowLeft} from 'lucide-react';
import {Button} from '../components/common/Button';
import {PageHeader} from '../components/common/PageHeader';
import {EventInvitationsPanel} from '../components/events/EventInvitationsModal';
import {EventAttendancePanel} from '../components/events/EventAttendancePanel';
import type {EventItem} from '../types';
import '../components/events/event-invitations.css';

export function EventWorkspacePage({event,initialTab='invitations',onBack,onAttendanceLive}:{event:EventItem;initialTab?:string;onBack:()=>void;onAttendanceLive:()=>void}) {
  const [tab,setTab]=useState(initialTab);
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{root.current?.closest('main')?.scrollTo({top:0});},[event.id,tab]);
  return <div ref={root} className="event-workspace space-y-5">
    <Button variant="ghost" onClick={onBack}><ArrowLeft size={16}/>Back to calendar</Button>
    <PageHeader icon={<Calendar/>} title={event.title} description={`${new Date(event.start_time).toLocaleString()} · ${event.location||'Location to follow'}`} actions={<Button onClick={onAttendanceLive}>Open in Attendance Live</Button>}/>
    <div className="flex flex-wrap gap-2" aria-label="Event sections"><Button aria-pressed={tab==='invitations'} variant={tab==='invitations'?'primary':'secondary'} onClick={()=>setTab('invitations')}>Invitations & responses</Button><Button aria-pressed={tab==='attendance'} variant={tab==='attendance'?'primary':'secondary'} onClick={()=>setTab('attendance')}>Attendance & check-in</Button></div>
    <div className="bg-white border border-indigo-100 rounded-2xl p-4 sm:p-6">
      {tab==='invitations'?<><h2 className="text-lg font-semibold mb-4">Event invitations & responses</h2><EventInvitationsPanel event={event}/></>:<EventAttendancePanel eventId={event.id}/>}
    </div>
  </div>;
}

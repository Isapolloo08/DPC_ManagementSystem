import {useEffect,useState} from 'react';
import {api} from '../../api';
import {useAuth} from '../../context/AuthContext';
import {Dialog} from '../common/Dialog';
import {Button} from '../common/Button';
import type {Member} from '../../types';

export function EventRsvpModal({eventId,onClose,onSaved}:{eventId:number;onClose:()=>void;onSaved:()=>void}) {
  const {user}=useAuth();
  const organizer=!!user&&['Admin','IT Admin','Pastor','Coordinator'].includes(user.role_name);
  const [query,setQuery]=useState(''),[members,setMembers]=useState<Member[]>([]),[selected,setSelected]=useState<Member|null>(null);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    if(!organizer||query.trim().length<2){setMembers([]);setLoading(false);return;}
    let active=true;setLoading(true);
    const timer=setTimeout(()=>{api.getEventInvitationMembers(eventId,query.trim()).then(rows=>{if(active)setMembers(rows);}).catch(e=>{if(active)setError(e.message||'Unable to find members.');}).finally(()=>{if(active)setLoading(false);});},300);
    return()=>{active=false;clearTimeout(timer);};
  },[eventId,query,organizer]);
  const submit=async()=>{
    if(organizer&&!selected)return;
    setBusy(true);setError('');
    try{await api.rsvpEvent(eventId,selected?.id);onSaved();onClose();}catch(e){setError(e instanceof Error?e.message:'Unable to save RSVP.');}finally{setBusy(false);}
  };
  return <Dialog title="Confirm RSVP" description={organizer?'Choose the member whose planned attendance you want to register.':'Register planned attendance for your linked member profile.'} onClose={onClose} busy={busy}
    footer={<><Button disabled={busy} onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy||(organizer&&!selected)} onClick={()=>void submit()}>Save RSVP</Button></>}>
    {organizer&&<>
      <label className="ui-field">Search member<input className="ui-input" value={query} maxLength={120} disabled={busy} placeholder="Type at least 2 letters" onChange={e=>{setQuery(e.target.value);setSelected(null);setError('');}}/></label>
      {loading?<p role="status" className="ui-help">Searching members…</p>:<div className="grid gap-2" aria-label="Matching members">{members.map(member=><Button key={member.id} disabled={busy} variant={selected?.id===member.id?'primary':'secondary'} onClick={()=>setSelected(member)}>{member.first_name} {member.last_name}</Button>)}</div>}
      {!loading&&query.trim().length>=2&&!members.length&&<p className="ui-help">No matching members in this event’s target ministries.</p>}
      {selected&&<p role="status" className="ui-help">Selected: {selected.first_name} {selected.last_name}</p>}
    </>}
    {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  </Dialog>;
}

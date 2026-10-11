import {useState} from 'react';
import {api} from '../../api';
import {Button} from '../common/Button';
import type {EventVerification,InvitationSyncState,VerificationEvent} from '../../services/invitationSync';

function EventDetails({event}:{event:VerificationEvent}) {
  return <div className="text-sm"><p className="font-medium">{event.title}</p><p>{new Date(event.start_time).toLocaleString()} – {new Date(event.end_time).toLocaleString()}</p><p>{event.location||'No location recorded'}</p></div>;
}

export function VerifyInvitationEvent({identity,title,count,onVerified}:{identity:string;title:string;count:number;onVerified:(state:InvitationSyncState,message:string)=>void}) {
  const [review,setReview]=useState<EventVerification|null>(null);
  const [selected,setSelected]=useState(''),[confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const local=review?.events.find(e=>String(e.id)===selected);
  const inspect=async()=>{
    setBusy(true);setError('');setSelected('');setConfirmed(false);
    try{setReview(await api.inspectInvitationEvent(identity));}catch(e){setError(e instanceof Error?e.message:'Unable to inspect event.');}finally{setBusy(false);}
  };
  const save=async()=>{
    if(!review||!local?.id||!local.fingerprint||!confirmed)return;
    setBusy(true);setError('');
    try{
      const result=await api.verifyInvitationEvent({event_identity:identity,event_id:local.id,local_identity:local.sync_identity,local_fingerprint:local.fingerprint,source:review.source,fingerprint:review.fingerprint,confirm_same_event:true});
      setReview(null);
      onVerified(result.state,result.unmatched_online_links?`Event verified. ${result.unmatched_online_links} online invitation link(s) still need a matching local link/member before Pull.`:'Event and matching invitation links verified. Open this event’s invitation panel to review and manually Pull submissions.');
    }catch(e){setError(e instanceof Error?e.message:'Event verification failed.');}finally{setBusy(false);}
  };
  return <div className="border border-indigo-100 rounded-xl p-3 mt-3" aria-label={`Verify event: ${title}`}>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm">{title} · {count} pending submission{count===1?'':'s'}</p><Button disabled={busy} onClick={()=>void inspect()}>Verify event</Button></div>
    {review&&<div className="grid gap-3 mt-3 max-w-xl">
      <p className="text-xs text-muted">Compare the online event with an existing local event. Verification links their identities; submissions still require manual Pull.</p>
      <p className="text-xs text-muted">Create a full backup in this page before changing an event’s identity.</p>
      <div><h4 className="text-sm font-semibold mb-1">Online event</h4><EventDetails event={review.event}/></div>
      <label className="ui-field">Existing local event<select className="ui-input" value={selected} disabled={busy} onChange={e=>{setSelected(e.target.value);setConfirmed(false);}}><option value="">Choose a local event</option>{review.events.map(e=><option key={e.id} value={e.id}>{e.title} · {new Date(e.start_time).toLocaleDateString()}</option>)}</select></label>
      {local&&<div><h4 className="text-sm font-semibold mb-1">Local event</h4><EventDetails event={local}/></div>}
      {!review.events.length&&<p className="text-sm">No local events available. Restore or publish the verified event through your existing workflow first.</p>}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy||!local} onChange={e=>setConfirmed(e.target.checked)}/>I checked the details and confirm these are the same event.</label>
      <div className="flex gap-2"><Button variant="primary" disabled={busy||!local||!confirmed} onClick={()=>void save()}>Confirm event verification</Button><Button disabled={busy} onClick={()=>setReview(null)}>Cancel</Button></div>
    </div>}
    {error&&<p role="alert" className="event-invitations-error mt-2">{error}</p>}
  </div>;
}

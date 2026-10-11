import {useEffect,useRef,useState} from 'react';
import {Button} from '../common/Button';
import {api} from '../../api';
import {useSocketEvent} from '../../socket';
import type {InvitationSyncState,SubmissionPreview,PullOutcome} from '../../services/invitationSync';
import {useInvitationSyncSession} from '../../services/useInvitationSyncSession';

export function PendingOnlineSubmissions({eventId,onImported}:{eventId:number;onImported:()=>void}) {
  const authorized=useInvitationSyncSession();
  const [state,setState]=useState<InvitationSyncState|null>(null),[error,setError]=useState('');
  const [preview,setPreview]=useState<SubmissionPreview|null>(null),[selected,setSelected]=useState<string[]>([]);
  const [busy,setBusy]=useState(false),[outcomes,setOutcomes]=useState<PullOutcome[]>([]);
  const alive=useRef(false),generation=useRef(0);
  const load=async()=>{try {const s=await api.getInvitationSyncState();if(alive.current)setState(s);return s;}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Availability unavailable.');return null;}};
  useEffect(()=>{
    alive.current=authorized;
    if(!authorized){generation.current++;setPreview(null);setSelected([]);return;}
    void load().then(async cached=>{if(!cached?.source_id||!alive.current)return;try{const s=await api.refreshInvitationSync();if(alive.current)setState(s);}catch{void load();}});
    return()=>{alive.current=false;generation.current++;};
  },[eventId,authorized]);
  useSocketEvent('invitation-sync:changed',()=>void load());
  const refresh=async()=>{setBusy(true);setError('');try {const s=await api.refreshInvitationSync();if(alive.current)setState(s);}catch(e){if(alive.current){setError(e instanceof Error?e.message:'Online check failed.');void load();}}finally{if(alive.current)setBusy(false);}};
  const inspect=async(id:string)=>{const version=++generation.current;setBusy(true);setError('');setPreview(null);try {const p=await api.previewOnlineSubmission(id);if(alive.current&&generation.current===version)setPreview(p);}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Preview unavailable.');}finally{if(alive.current)setBusy(false);}};
  const pull=async(ids:string[])=>{setBusy(true);setError('');setOutcomes([]);try {const r=await api.pullOnlineSubmissions(eventId,ids);if(alive.current){setOutcomes(r.results);setSelected(r.unprocessed);setPreview(null);onImported();await load();if(r.unprocessed.length)setError('Some items were not processed. Recheck status before another manual Pull.');}}catch(e){if(alive.current){setError((e instanceof Error?e.message:'Pull interrupted.')+' Recheck status before retrying.');await load();}}finally{if(alive.current)setBusy(false);}};
  const items=state?.pending.filter(p=>p.event_id===eventId)||[];
  const pending=items.filter(p=>p.status==='Pending');
  if(!authorized) return <section aria-label="Pending online submissions"><p role="status">Administrator session expired. Sign in to view online submissions.</p></section>;
  return <section aria-label="Pending online submissions" className="event-invitations-online">
    <div className="event-invitations-heading"><h3>Pending online submissions <span className="text-muted">({pending.length})</span></h3><Button size="sm" disabled={busy||!state?.source_id} onClick={()=>void refresh()}>Check online</Button></div>
    <p className="text-xs text-muted" role="status">{state?.state||'Checking availability…'} · {state?.last_check?'Last checked '+new Date(state.last_check).toLocaleString():'No successful online check yet.'}</p>
    <p className="text-xs text-muted">Previewing or reading a notification does not import a response. Use Pull when ready.</p>
    {state?.state==='Not paired'&&<p className="text-xs text-muted">Pair the online invitation service in Settings → Backup & Data Management.</p>}
    {error&&<p role="alert" className="event-invitations-error">{error}</p>}
    {items.length===0&&<p className="text-xs text-muted">{state?.state==='Ready'&&state.last_check?'No pending online submissions for this event.':'Availability is unverified; reconnect or check online.'}</p>}
    {items.map((p,index)=><article key={p.submission} className="event-invitations-link">
      <div><label><input type="checkbox" aria-label={`Select submission ${index+1}`} disabled={busy||p.status!=='Pending'} checked={selected.includes(p.submission)} onChange={e=>setSelected(old=>e.target.checked?[...old,p.submission]:old.filter(id=>id!==p.submission))}/> Submission {index+1}</label><span>{p.status} · Updated {new Date(p.updated_at).toLocaleString()}</span></div>
      <div className="event-invitations-link-actions"><Button size="sm" disabled={busy} onClick={()=>void inspect(p.submission)}>Preview submission {index+1}</Button><Button size="sm" variant="primary" disabled={busy||p.status!=='Pending'} onClick={()=>void pull([p.submission])}>Pull submission {index+1}</Button></div>
    </article>)}
    {pending.length>0&&<Button variant="primary" disabled={busy||!selected.length||selected.length>25} onClick={()=>void pull(selected)}>{busy?'Working…':`Pull Selected (${selected.length})`}</Button>}
    {selected.length>25&&<p className="text-xs text-muted">Select up to 25 submissions per Pull.</p>}
    {preview&&<article className="event-invitations-responses" aria-label="Submission preview"><strong>{preview.name}</strong><p>{preview.contact||'Church member'} · {preview.answer==='yes'?'Attending':preview.answer==='no'?'Cannot attend':'Not yet sure'}</p>{preview.reason&&<p>Reason: {preview.reason}</p>}{preview.blocked&&<p role="alert" className="event-invitations-error">{preview.blocked}</p>}<Button size="sm" onClick={()=>setPreview(null)}>Close preview</Button></article>}
    {outcomes.length>0&&<div aria-label="Pull results" role="status">{outcomes.map((r,index)=><p key={r.submission}>Item {index+1}: {r.status}{r.error?' · '+r.error:''}</p>)}</div>}
  </section>;
}

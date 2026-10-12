import {useEffect,useRef,useState} from 'react';
import {Button} from '../common/Button';
import {Pagination} from '../common/Pagination';
import {useListPagination} from '../../hooks/useListPagination';
import {api} from '../../api';
import {useSocketEvent} from '../../socket';
import type {InvitationSyncState,SubmissionPreview,PullOutcome} from '../../services/invitationSync';
import {useInvitationSyncSession} from '../../services/useInvitationSyncSession';
import {useOnlineSubmissionDetails} from '../../hooks/useOnlineSubmissionDetails';

export function PendingOnlineSubmissions({eventId,onImported}:{eventId:number;onImported:()=>void}) {
  const authorized=useInvitationSyncSession();
  const [state,setState]=useState<InvitationSyncState|null>(null),[error,setError]=useState('');
  const [preview,setPreview]=useState<SubmissionPreview|null>(null),[selected,setSelected]=useState<string[]>([]);
  const [busy,setBusy]=useState(false),[outcomes,setOutcomes]=useState<PullOutcome[]>([]);
  const alive=useRef(false),generation=useRef(0);
  const load=async()=>{const version=generation.current;try {const s=await api.getInvitationSyncState();if(alive.current&&generation.current===version)setState(s);return s;}catch(e){if(alive.current&&generation.current===version)setError(e instanceof Error?e.message:'Availability unavailable.');return null;}};
  useEffect(()=>{
    alive.current=authorized;
    if(!authorized){generation.current++;setPreview(null);setSelected([]);setState(null);setOutcomes([]);setBusy(false);setError('');return;}
    void load().then(async cached=>{if(!cached?.source_id||!alive.current)return;try{const s=await api.refreshInvitationSync();if(alive.current)setState(s);}catch{void load();}});
    return()=>{alive.current=false;generation.current++;};
  },[eventId,authorized]);
  useSocketEvent('invitation-sync:changed',()=>void load());
  const refresh=async()=>{setBusy(true);setError('');try {const s=await api.refreshInvitationSync();if(alive.current)setState(s);}catch(e){if(alive.current){setError(e instanceof Error?e.message:'Online check failed.');void load();}}finally{if(alive.current)setBusy(false);}};
  const inspect=async(id:string)=>{const version=++generation.current;setBusy(true);setError('');setPreview(null);try {const p=await api.previewOnlineSubmission(id);if(alive.current&&generation.current===version)setPreview(p);}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Preview unavailable.');}finally{if(alive.current)setBusy(false);}};
  const items=state?.pending.filter(p=>p.event_id===eventId)||[];
  const pending=items.filter(p=>p.status==='Pending');
  const pendingIds=new Set(pending.map(p=>p.submission));
  const selection=selected.filter(id=>pendingIds.has(id));
  const pages=useListPagination(items,String(eventId),10);
  const details=useOnlineSubmissionDetails(pages.items,`${state?.source_id||''}:${eventId}:${state?.last_check||''}`,authorized,api.previewOnlineSubmission);
  const pageIds=pages.items.filter(p=>p.status==='Pending').map(p=>p.submission);
  const pageSelected=pageIds.filter(id=>selection.includes(id)).length;
  const choosePage=(checked:boolean)=>setSelected(old=>checked?[...new Set([...old,...pageIds])]:old.filter(id=>!pageIds.includes(id)));
  const pull=async(ids:string[])=>{
    const version=++generation.current;
    setBusy(true);setError('');setOutcomes([]);
    let remaining=[...ids];const results:PullOutcome[]=[];
    try {
      while(remaining.length&&alive.current&&generation.current===version) {
        const batch=remaining.slice(0,25),later=remaining.slice(25);
        const response=await api.pullOnlineSubmissions(eventId,batch);
        if(!alive.current||generation.current!==version)return;
        results.push(...response.results);remaining=[...response.unprocessed,...later];
        setOutcomes([...results]);setSelected(remaining);
        if(response.unprocessed.length){setError('Pull stopped. Remaining items stay selected. Check status before another manual Pull.');break;}
      }
      if(alive.current&&generation.current===version){setPreview(null);onImported();await load();}
    }catch(e){if(alive.current&&generation.current===version){setSelected(remaining);setOutcomes([...results]);setError((e instanceof Error?e.message:'Pull interrupted.')+' Remaining items stay selected. Recheck status before retrying.');onImported();await load();}}
    finally{if(alive.current&&generation.current===version)setBusy(false);}
  };
  if(!authorized) return <section aria-label="Pending online submissions"><p role="status">Administrator session expired. Sign in to view online submissions.</p></section>;
  return <section aria-label="Pending online submissions" className="event-invitations-online">
    <div className="event-invitations-heading"><h3>Pending online submissions <span className="text-muted">({pending.length})</span></h3><Button size="sm" disabled={busy||!state?.source_id} onClick={()=>void refresh()}>Check online</Button></div>
    <p className="text-xs text-muted" role="status">{state?.state||'Checking availability…'} · {state?.last_check?'Last checked '+new Date(state.last_check).toLocaleString():'No successful online check yet.'}</p>
    <p className="text-xs text-muted">Previewing or reading a notification does not import a response. Use Pull when ready.</p>
    {state?.state==='Not paired'&&<p className="text-xs text-muted">Pair the online invitation service in Settings → Backup & Data Management.</p>}
    {error&&<p role="alert" className="event-invitations-error">{error}</p>}
    {items.length===0&&<p className="text-xs text-muted">{state?.state==='Ready'&&state.last_check?'No pending online submissions for this event.':'Availability is unverified; reconnect or check online.'}</p>}
    {items.length>0&&<>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy||!pending.length} onClick={()=>setSelected(pending.map(p=>p.submission))}>Select all pending ({pending.length})</Button><Button size="sm" disabled={busy||!selection.length} onClick={()=>setSelected([])}>Clear selection</Button></div>
        <Button variant="primary" disabled={busy||!selection.length} onClick={()=>void pull(selection)}>{busy?'Working...':`Pull Selected (${selection.length})`}</Button>
      </div>
      <p className="text-xs text-muted">{selection.length} selected across all pages. Pull processes up to 25 per batch and stops if a request is interrupted.</p>
      <p className="text-xs text-muted">Details shown below are online previews. Only Pull imports them locally.</p>
      {pages.items.some(p=>details.rows[p.submission]?.status==='Unavailable')&&<div className="flex gap-2 items-center"><p className="text-xs text-muted">Some details are unavailable or changed online. Check online to refresh revisions.</p><Button size="sm" disabled={busy} onClick={details.retry}>Retry details</Button></div>}
      <p className="text-xs text-muted sm:hidden">Swipe the table sideways to see Status and Actions.</p>
      <div className="online-submissions-table-wrap" tabIndex={0} role="region" aria-label="Scrollable submissions table">
        <table className="online-submissions-table"><caption className="sr-only">Online submissions for this event</caption>
          <thead><tr><th><input type="checkbox" aria-label="Select pending submissions on this page" disabled={busy||!pageIds.length} checked={pageIds.length>0&&pageSelected===pageIds.length} ref={node=>{if(node)node.indeterminate=pageSelected>0&&pageSelected<pageIds.length;}} onChange={e=>choosePage(e.target.checked)}/></th><th scope="col">Respondent</th><th scope="col">Contact</th><th scope="col">RSVP / reason</th><th scope="col">Updated</th><th scope="col">Sync status</th><th scope="col">Actions</th></tr></thead>
          <tbody>{pages.items.map((p,index)=>{const number=(pages.page-1)*pages.pageSize+index+1;const outcome=outcomes.find(r=>r.submission===p.submission),detail=details.rows[p.submission],data=detail?.data;return <tr key={p.submission}>
            <td><input type="checkbox" aria-label={`Select submission ${number}`} disabled={busy||p.status!=='Pending'} checked={selection.includes(p.submission)} onChange={e=>setSelected(old=>e.target.checked?[...new Set([...old,p.submission])]:old.filter(id=>id!==p.submission))}/></td>
            <th scope="row"><span className="block">{data?.name||(detail?.status==='Unavailable'?'Details unavailable':'Loading details…')}</span><span className="block text-xs text-muted font-normal">{data?.member_identity?'Member':data?.member_identity===null?'Guest':''}{data?' · ':''}{p.submission.slice(0,8)}</span></th>
            <td className="online-submission-contact">{data?data.contact||'No contact provided':'—'}</td>
            <td>{data?data.answer==='yes'?'Attending':data.answer==='no'?'Cannot attend':'Not yet sure':'—'}{data?.reason&&<p className="text-xs text-muted mt-1 line-clamp-2">{data.reason}</p>}</td>
            <td>{new Date(p.updated_at).toLocaleString()}</td><td>{outcome?.status||p.status}{outcome?.error&&<p className="text-xs text-muted mt-1">{outcome.error}</p>}</td>
            <td><div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy} onClick={()=>void inspect(p.submission)} aria-label={`Preview submission ${number}`}>Preview</Button><Button size="sm" variant="primary" disabled={busy||p.status!=='Pending'} onClick={()=>void pull([p.submission])} aria-label={`Pull submission ${number}`}>Pull</Button></div></td>
          </tr>;})}</tbody>
        </table>
      </div>
      <Pagination page={pages.page} pageSize={pages.pageSize} total={pages.total} onPageChange={pages.setPage} onPageSizeChange={pages.setPageSize} label="submissions" loading={busy}/>
    </>}
    {preview&&<article className="event-invitations-responses" aria-label="Submission preview"><strong>{preview.name}</strong><p>{preview.contact||'Church member'} · {preview.answer==='yes'?'Attending':preview.answer==='no'?'Cannot attend':'Not yet sure'}</p>{preview.reason&&<p>Reason: {preview.reason}</p>}{preview.blocked&&<p role="alert" className="event-invitations-error">{preview.blocked}</p>}<Button size="sm" onClick={()=>setPreview(null)}>Close preview</Button></article>}
    {outcomes.length>0&&<div aria-label="Pull results" role="status">{outcomes.map((r,index)=><p key={r.submission}>Item {index+1}: {r.status}{r.error?' · '+r.error:''}</p>)}</div>}
  </section>;
}

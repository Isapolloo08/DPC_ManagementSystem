import {useEffect,useRef,useState} from 'react';
import {Button} from '../common/Button';
import {Pagination} from '../common/Pagination';
import {useListPagination} from '../../hooks/useListPagination';
import {api} from '../../api';
import {useSocketEvent} from '../../socket';
import {useInvitationSyncSession} from '../../services/useInvitationSyncSession';
import type {VisitSyncState,VisitPreview,VisitPullResult} from '../../services/plannedVisitSync';
import {useOnlineSubmissionDetails} from '../../hooks/useOnlineSubmissionDetails';
const visitRoles=['Admin','IT Admin','Pastor'];
export function PendingOnlineVisits({onImported}:{onImported:()=>void}) {
 const authorized=useInvitationSyncSession(visitRoles);
 const [state,setState]=useState<VisitSyncState|null>(null),[preview,setPreview]=useState<VisitPreview|null>(null);
 const [selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [results,setResults]=useState<VisitPullResult[]>([]);
 const alive=useRef(false),generation=useRef(0),working=useRef(false);
 const load=async()=>{const version=generation.current;try{const s=await api.getVisitSyncState();if(alive.current&&version===generation.current)setState(s);return s;}catch(e){if(alive.current&&version===generation.current)setError(e instanceof Error?e.message:'Availability unavailable.');return null;}};
 useEffect(()=>{
  alive.current=authorized;
  if(!authorized){setState(null);setPreview(null);setSelected([]);setResults([]);setError('');}
  else void load();
  return()=>{alive.current=false;generation.current++;};
 },[authorized]);
 useSocketEvent('visit-sync:changed',()=>{if(alive.current)void load();});
 const operation=async(fn:()=>Promise<void>)=>{
  if(working.current||!alive.current)return;working.current=true;setBusy(true);setError('');
  try{await fn();}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Online operation failed.');}
  finally{working.current=false;if(alive.current)setBusy(false);}
 };
 const refresh=()=>operation(async()=>{const version=generation.current;try{const s=await api.refreshVisitSync();if(alive.current&&version===generation.current)setState(s);}finally{if(alive.current&&version===generation.current)void load();}});
 const inspect=(id:string)=>operation(async()=>{setPreview(null);const version=generation.current,p=await api.previewOnlineVisit(id);if(alive.current&&version===generation.current)setPreview(p);});
 const pull=(ids:string[])=>operation(async()=>{
  const version=generation.current,all:VisitPullResult[]=[];setResults([]);setPreview(null);
  for(let i=0;i<ids.length&&alive.current&&version===generation.current;i+=25){
   const batch=ids.slice(i,i+25),response=await api.pullOnlineVisits(batch);all.push(...response.results);
   if(alive.current&&version===generation.current){setResults([...all]);onImported();await load();}
   if(response.unprocessed.length||response.results.some(r=>r.status==='Failed'))break;
  }
  if(alive.current&&version===generation.current)setSelected(old=>old.filter(id=>!all.some(r=>r.submission===id&&r.status!=='Failed')));
 });
 const items=state?.pending||[],pending=items.filter(p=>p.status==='Pending'),pendingIds=new Set(pending.map(p=>p.submission));
 const selection=selected.filter(id=>pendingIds.has(id));
 const pages=useListPagination(items,'online-visits',10),pageIds=pages.items.filter(p=>p.status==='Pending').map(p=>p.submission);
 const pageCount=pageIds.filter(id=>selection.includes(id)).length;
 const details=useOnlineSubmissionDetails(pages.items,`${state?.source_id||''}:${state?.last_check||''}`,authorized,api.previewOnlineVisit);
 if(!authorized)return null;
 return <section className="visit-ledger p-5 space-y-4" aria-label="Pending online visits">
  <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">Pending online visits ({pending.length})</h2><p className="text-xs text-muted mt-2">{state?.state||'Loading availability…'}{state?.last_check?` · Last checked ${new Date(state.last_check).toLocaleString()}`:''}</p></div><Button disabled={busy||!state?.source_id} onClick={()=>void refresh()}>Check online</Button></div>
  <p className="text-sm text-muted">Review requests and visitor changes here. Only Pull saves them locally; confirming a visit does not mark it Visited.</p>
  {state&&!state.source_id&&<p className="text-sm">An Admin must pair the online service in Settings &amp; Backups first.</p>}
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  {pages.items.some(p=>details.rows[p.submission]?.status==='Unavailable')&&<div className="flex gap-2 items-center"><p className="text-xs text-muted">Some online details are unavailable or changed. Check online to refresh revisions.</p><Button size="sm" disabled={busy} onClick={details.retry}>Retry details</Button></div>}
  {!!items.length&&<><div className="flex flex-wrap gap-2 items-center"><Button size="sm" disabled={busy||!pending.length} onClick={()=>setSelected(pending.map(p=>p.submission))}>Select all pending ({pending.length})</Button><Button size="sm" disabled={busy||!selection.length} onClick={()=>setSelected([])}>Clear selection</Button><Button variant="primary" disabled={busy||!selection.length} onClick={()=>void pull(selection)}>Pull Selected ({selection.length})</Button></div>
   <div className="overflow-x-auto" role="region" tabIndex={0} aria-label="Online visits table"><table className="visit-table online-visits-table w-full text-sm"><caption className="sr-only">Pending requests and visitor changes</caption><thead><tr><th><input type="checkbox" aria-label="Select online visits on this page" disabled={busy||!pageIds.length} checked={!!pageIds.length&&pageCount===pageIds.length} ref={n=>{if(n)n.indeterminate=pageCount>0&&pageCount<pageIds.length;}} onChange={e=>setSelected(old=>e.target.checked?[...new Set([...old,...pageIds])]:old.filter(id=>!pageIds.includes(id)))}/></th><th scope="col">Visitor</th><th scope="col">Contact</th><th scope="col">Visit date</th><th scope="col">Party</th><th scope="col">Visitor reply</th><th scope="col">Sync status</th><th scope="col">Actions</th></tr></thead><tbody>{pages.items.map(p=>{const detail=details.rows[p.submission],data=detail?.data;return <tr key={p.submission}>
    <td><input type="checkbox" aria-label={`Select visit ${p.submission.slice(0,8)}`} disabled={busy||p.status!=='Pending'} checked={selection.includes(p.submission)} onChange={e=>setSelected(old=>e.target.checked?[...new Set([...old,p.submission])]:old.filter(id=>id!==p.submission))}/></td>
    <th scope="row"><span className="block">{data?.full_name||(detail?.status==='Unavailable'?'Details unavailable':'Loading details…')}</span><span className="block text-xs text-muted font-normal">{p.submission.slice(0,8)} · Revision {p.revision}</span></th>
    <td className="online-submission-contact">{data?<>{data.email&&<span className="block">{data.email}</span>}{data.phone&&<span className="block">{data.phone}</span>}{!data.email&&!data.phone&&'No contact provided'}</>:'—'}</td>
    <td>{p.visit_date}</td><td>{data?.party||'—'}</td><td>{data?.visitor_reply||'—'}</td><td>{p.status}</td>
    <td><div className="flex gap-2"><Button size="sm" disabled={busy} onClick={()=>void inspect(p.submission)}>Preview</Button><Button size="sm" variant="primary" disabled={busy||p.status!=='Pending'} onClick={()=>void pull([p.submission])}>Pull</Button></div></td>
   </tr>;})}</tbody></table></div>
   <Pagination page={pages.page} pageSize={pages.pageSize} total={pages.total} onPageChange={pages.setPage} onPageSizeChange={pages.setPageSize} label="online visits" loading={busy}/></>}
  {state?.source_id&&!items.length&&<p className="text-sm text-muted">No pending online visits in the last successful check.</p>}
  {preview&&<article className="visit-detail" aria-label="Online visit preview"><h3 className="font-semibold">{preview.full_name}</h3><p>{preview.visit_date} · {preview.party} · {preview.visitor_reply}</p><p>{[preview.email,preview.phone].filter(Boolean).join(" · ")}</p>{preview.bringing_children&&<p>Children: {preview.child_age_groups.join(', ')||'Age groups not specified'}</p>}{preview.questions&&<p className="whitespace-pre-wrap">{preview.questions}</p>}<Button size="sm" onClick={()=>setPreview(null)}>Close preview</Button></article>}
  {!!results.length&&<div role="status">{results.map(r=><p key={r.submission}>{r.submission.slice(0,8)}: {r.status}{r.error?' · '+r.error:''}</p>)}</div>}
 </section>;
}

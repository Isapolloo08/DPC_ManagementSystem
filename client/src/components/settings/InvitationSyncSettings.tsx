import {useEffect,useState} from 'react';
import {api} from '../../api';
import {Button} from '../common/Button';
import type {InvitationSyncState} from '../../services/invitationSync';
import {useInvitationSyncSession} from '../../services/useInvitationSyncSession';

export function InvitationSyncSettings() {
  const authorized=useInvitationSyncSession();
  const [state,setState]=useState<InvitationSyncState|null>(null),[error,setError]=useState('');
  const [url,setUrl]=useState('https://dpc-managementsystem.onrender.com'),[username,setUsername]=useState(''),[password,setPassword]=useState('');
  const [source,setSource]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;api.getInvitationSyncState().then(s=>{if(active){setState(s);if(s.source_url)setUrl(s.source_url);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  const credentials={url,username,password};
  useEffect(()=>{if(!authorized){setPassword('');setUsername('');setSource('');}},[authorized]);
  const inspect=async()=>{setBusy(true);setError('');try{const s=await api.inspectInvitationSource(credentials);setSource(s.source);}catch(e){setError(e instanceof Error?e.message:'Source verification failed.');}finally{setBusy(false);}};
  const pair=async()=>{setBusy(true);setError('');try{setState(await api.pairInvitationSource({...credentials,expected_source:source}));setPassword('');setUsername('');setSource('');}catch(e){setError(e instanceof Error?e.message:'Pairing failed.');}finally{setBusy(false);}};
  if(!authorized)return null;
  return <section className="bg-white border border-indigo-100 rounded-2xl p-5 mb-5" aria-label="Online invitation synchronization">
    <h3 className="font-semibold text-indigo-950">Online invitation synchronization</h3>
    <p role="status" className="text-sm text-muted mt-2">{state?.state||'Availability unavailable'} · {state?.last_check?`${state.pending.filter(p=>p.status==='Pending').length} last-known pending`:'No successful online check yet.'}</p>
    <p className="text-xs text-muted mt-2">One Local Master checks for submissions. Administrators import them manually from each event’s invitation panel.</p>
    {state?.pending.filter(p=>!p.event_id).map(p=><p key={p.submission} className="text-xs event-invitations-error">{p.event_title}: local event counterpart is not verified. Arrange explicit identity repair before Pull.</p>)}
    <details className="mt-3"><summary className="cursor-pointer text-sm font-medium">{state?.source_id?'Reconnect online service':'Pair online service'}</summary>
      <div className="grid gap-3 mt-3 max-w-xl">
        <label className="ui-field">Online API origin<input className="ui-input" type="url" value={url} disabled={busy} onChange={e=>{setUrl(e.target.value);setSource('');}}/></label>
        <label className="ui-field">Cloud Admin email or username<input className="ui-input" autoComplete="off" value={username} disabled={busy} onChange={e=>{setUsername(e.target.value);setSource('');}}/></label>
        <label className="ui-field">Cloud Admin password<input className="ui-input" type="password" autoComplete="off" value={password} disabled={busy} onChange={e=>{setPassword(e.target.value);setSource('');}}/></label>
        <Button disabled={busy||!username||!password} onClick={()=>void inspect()}>Verify online source</Button>
        {source&&<><p className="text-xs text-muted break-all">Verified source identity: {source}. Confirm that this identifies the intended church database.</p><Button variant="primary" disabled={busy} onClick={()=>void pair()}>Confirm pairing</Button></>}
      </div>
    </details>
    {error&&<p role="alert" className="event-invitations-error mt-3">{error}</p>}
  </section>;
}

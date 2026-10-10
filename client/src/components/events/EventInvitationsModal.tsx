import { useEffect, useState } from 'react';
import { Link2, Copy, RefreshCw } from 'lucide-react';
import { ModalShell } from '../common/ModalShell';
import { Button } from '../common/Button';
import { api } from '../../api';
import type { EventItem, Member } from '../../types';
import { invitationUrl, type InvitationOverview, type InvitationLink } from '../../services/eventInvitations';
import './event-invitations.css';

export function EventInvitationsModal({ event, onClose }: { event: EventItem; onClose: () => void }) {
  const [data, setData] = useState<InvitationOverview | null>(null), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [message, setMessage] = useState('');
  const [mode, setMode] = useState('general'), [query, setQuery] = useState(''), [memberId, setMemberId] = useState('');
  const [members, setMembers] = useState<Member[]>([]), [deadline, setDeadline] = useState('');
  const [baseUrl, setBaseUrl] = useState(() => {
    try { return localStorage.getItem('dpc_invitation_site_url') || import.meta.env.VITE_PUBLIC_APP_URL || (window.location.protocol.startsWith('http') ? window.location.origin + window.location.pathname : 'http://localhost:3000/'); }
    catch { return import.meta.env.VITE_PUBLIC_APP_URL || 'http://localhost:3000/'; }
  });
  const ended = new Date(event.start_time).getTime() <= Date.now();
  const localLink = (() => { try { const host = new URL(baseUrl).hostname; return host === 'localhost' || host === '127.0.0.1' || /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(host); } catch { return false; } })();
  const load = async () => {
    setLoading(true); setError('');
    try { setData(await api.getEventInvitations(event.id)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to load invitations.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [event.id]);
  useEffect(() => {
    if (mode !== 'personal' || query.trim().length < 2) { setMembers([]); return; }
    let active = true;
    const timer = setTimeout(() => {
      api.getEventInvitationMembers(event.id, query.trim()).then(result => {
        if (active) setMembers(result);
      }).catch(() => { if (active) setError('Unable to search members. Please try again.'); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [mode, query, event.ministry_id]);
  const generate = async () => {
    setError(''); setMessage('');
    try {
      invitationUrl(baseUrl, '');
      const due = deadline ? new Date(deadline).toISOString() : undefined;
      setBusy(true);
      const link = await api.createEventInvitation(event.id, { member_id: mode === 'personal' ? Number(memberId) : undefined, deadline: due });
      try { localStorage.setItem('dpc_invitation_site_url', baseUrl); } catch { /* Clipboard still works without persistent preferences. */ }
      await load(); setMessage('Invitation link generated. Copy it below to share.');
      setGenerated(link.id);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to generate invitation.'); }
    finally { setBusy(false); }
  };
  const [generated, setGenerated] = useState<number | null>(null);
  const copy = async (link: InvitationLink) => {
    try { await navigator.clipboard.writeText(invitationUrl(baseUrl, link.token)); setMessage('Invitation link copied.'); setError(''); }
    catch { setError('Unable to copy automatically. Select and copy the link from its field.'); }
  };
  const toggle = async (link: InvitationLink) => {
    setBusy(true); setError('');
    try { await api.setEventInvitationEnabled(event.id, link.id, !link.enabled); await load(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to change link status.'); }
    finally { setBusy(false); }
  };
  return <ModalShell title="Event invitations & responses" subtitle={event.title} icon={<Link2 />} size="lg" onClose={onClose} busy={busy}>
    <div data-modal-body className="event-invitations-body">
      {error && <p role="alert" className="event-invitations-error">{error}</p>}
      {message && <p role="status" className="event-invitations-message">{message}</p>}
      <section className="event-invitations-generator">
        <h3>Generate invitation link</h3>
        <label className="ui-field">Invitation website URL<input className="ui-input" type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://your-church-website.com/" /></label>
        {localLink && <p className="text-xs text-muted">Local preview link. To share outside your network, host the invitation website and API online, then enter its public URL here.</p>}
          <div className="event-invitations-grid"><label className="ui-field">Link type<select className="ui-input" value={mode} onChange={e => { setMode(e.target.value); setMemberId(''); }}><option value="general">General link for members & guests</option><option value="personal">Personal link for a member</option></select></label>
          <label className="ui-field">Response deadline (optional)<input className="ui-input" type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} /><small className="text-muted">Defaults to the event start. Times use this device’s timezone.</small></label></div>
        {mode === 'personal' && <div className="event-invitations-grid"><label className="ui-field">Search member<input className="ui-input" value={query} onChange={e => { setQuery(e.target.value); setMemberId(''); }} placeholder="Type at least 2 letters…" /></label>
          <label className="ui-field">Recipient<select className="ui-input" value={memberId} onChange={e => setMemberId(e.target.value)}><option value="">Choose a member</option>{members.map(member => <option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>)}</select></label></div>}
        <p className="text-xs text-muted">Personal links identify the member automatically. General links offer Regular Member or Guest; member search follows the event ministry, while guests enter their name and contact details. A guest can update their response using the same browser.</p>
        <Button variant="primary" onClick={generate} disabled={busy || loading || ended || (mode === 'personal' && !memberId)}><Link2 size={15} />Generate Link</Button>
        {ended && <p className="text-xs text-muted">This event has started. New invitation responses are closed.</p>}
      </section>
      <section><div className="event-invitations-heading"><h3>Invitation links</h3><Button size="sm" onClick={() => void load()} disabled={loading || busy}><RefreshCw size={14} />Refresh</Button></div>
        {loading && !data ? <p role="status">Loading invitations…</p> : !data?.links.length ? <p className="text-xs text-muted">No invitation links yet.</p> : <div className="event-invitations-links">{data.links.map(link => {
          let url = ''; try { url = invitationUrl(baseUrl, link.token); } catch { /* Correct the website URL above before copying. */ }
          return <div key={link.id} className="event-invitations-link" data-generated={generated === link.id}><div><strong>{link.member_id ? link.member_name : 'Members & guests invitation'}</strong><span>{!link.enabled ? 'Deactivated' : link.accepting ? 'Open' : 'Closed'} · Respond by {new Date(link.deadline).toLocaleString()}</span></div>
            <input className="ui-input" aria-label={`Invitation link ${link.id}`} readOnly value={url} onFocus={e => e.target.select()} />
            <div className="event-invitations-link-actions"><Button size="sm" onClick={() => void copy(link)} disabled={!url}><Copy size={14} />Copy Link</Button><Button size="sm" onClick={() => void toggle(link)} disabled={busy}>{link.enabled ? 'Deactivate' : 'Activate'}</Button></div>
          </div>;
        })}</div>}
      </section>
      <section><h3>Event responses</h3><div className="event-invitations-counts">{([['yes', 'Attending'], ['no', 'Cannot attend'], ['maybe', 'Not sure'], ['pending', 'Members pending']] as const).map(([key, label]) => <div key={key}><strong>{data?.counts[key] || 0}</strong><span>{label}</span></div>)}</div>
        <p className="text-xs text-muted">These are planned responses. Record actual arrivals using Event Attendance & Check-In. Guest links cannot count people who have not replied.</p>
        {!data?.responses.length ? <p className="text-xs text-muted mt-3">No responses yet.</p> : <div className="event-invitations-responses">{data.responses.map(response => <article key={response.id}><div><strong>{response.name}</strong><span>{response.answer === 'yes' ? 'Attending' : response.answer === 'no' ? 'Cannot attend' : 'Not sure'}</span></div><p>{response.contact || 'Church member'} · {new Date(response.updated_at).toLocaleString()}</p>{response.reason && <p className="event-invitations-reason">Reason: {response.reason}</p>}</article>)}{data.responses.length === data.limit && <p className="text-xs text-muted">Showing the latest {data.limit} responses. Counts include all responses.</p>}</div>}
      </section>
    </div>
  </ModalShell>;
}

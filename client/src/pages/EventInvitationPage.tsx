import { useEffect, useId, useState, type FormEvent } from 'react';
import { CalendarDays, MapPin, CheckCircle2, HeartHandshake } from 'lucide-react';
import { Button } from '../components/common/Button';
import { publicInvitations, type PublicInvitation, type InvitationAnswer, type InvitationMember } from '../services/eventInvitations';
import './event-invitation.css';

const dateLabel = (value: string) => new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });

export function EventInvitationPage({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<PublicInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState(''), [contact, setContact] = useState('');
  const [answer, setAnswer] = useState<InvitationAnswer | ''>(''), [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false), [saved, setSaved] = useState(false);
  const [attendeeType, setAttendeeType] = useState<'member' | 'guest'>('guest');
  const [search, setSearch] = useState(''), [memberId, setMemberId] = useState('');
  const [members, setMembers] = useState<InvitationMember[]>([]), [searching, setSearching] = useState(false), [searchError, setSearchError] = useState('');
  const [memberSearchOpen, setMemberSearchOpen] = useState(false), [activeMember, setActiveMember] = useState(-1);
  const memberListId = useId();
  const showMemberResults = memberSearchOpen && !memberId && Boolean(search.trim());
  const chooseMember = (member: InvitationMember) => {
    setMemberId(String(member.id)); setName(member.name); setSearch(member.name); setMemberSearchOpen(false); setActiveMember(-1);
  };
  const [responseKey] = useState(() => {
    const storageKey = `dpc_invitation_receipt:${token}`;
    let previous: string | null = null;
    try { previous = localStorage.getItem(storageKey); } catch { /* Browser storage may be disabled. */ }
    const key = previous && /^[a-f0-9-]{36}$/.test(previous) ? previous : typeof crypto.randomUUID === 'function' ? crypto.randomUUID() :
      '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, digit => (Number(digit) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(digit) / 4)))).toString(16));
    try { localStorage.setItem(storageKey, key); } catch { /* The open page still supports updates. */ }
    return key;
  });
  useEffect(() => {
    let active = true;
    if (!token) { setError('This invitation link is invalid. Ask the organizer for a new link.'); setLoading(false); return; }
    publicInvitations.get(token).then(data => { if (active) { setInvitation(data); if (data.personal) setName(data.member_name); } })
      .catch(failure => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);
  useEffect(() => {
    let active = true;
    setMembers([]); setSearchError(''); setSearching(false); setActiveMember(-1);
    if (attendeeType !== 'member' || invitation?.personal || !invitation?.accepting || !search.trim() || memberId) return;
    setSearching(true);
    const timer = window.setTimeout(() => {
      publicInvitations.members(token, search.trim()).then(data => { if (active) setMembers(data.members); })
        .catch(failure => { if (active) setSearchError(failure.message); })
        .finally(() => { if (active) setSearching(false); });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [token, search, memberId, attendeeType, invitation?.personal, invitation?.accepting]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!answer || saving) return;
    setSaving(true); setError('');
    try { await publicInvitations.respond(token, { name, contact, answer, reason, responseKey, attendeeType: invitation?.personal ? undefined : attendeeType,
      member_id: !invitation?.personal && attendeeType === 'member' ? Number(memberId) : undefined }); setSaved(true); }
    catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to save your response.');
      if (failure instanceof Error && failure.message === 'Responses are closed for this invitation.') setInvitation(value => value ? { ...value, accepting: false } : null);
    }
    finally { setSaving(false); }
  };
  return <main className="event-invitation-page">
    <article className="event-invitation-card">
      <header><span className="event-invitation-icon"><HeartHandshake size={26} /></span><p>DAET PRESBYTERIAN CHURCH</p><h1>{invitation?.title || 'Event invitation'}</h1><p>You’re invited. Let us know if you can join us.</p></header>
      {loading ? <p role="status">Opening your invitation…</p> : <>
        {invitation && <>
          <div className="event-invitation-details"><p><CalendarDays size={17} /><span>{dateLabel(invitation.start_time)} – {dateLabel(invitation.end_time)}<small>Philippine time (UTC+8)</small></span></p>
            {invitation.location && <p><MapPin size={17} /><span>{invitation.location}</span></p>}
            <p>Event ministry: {invitation.ministry_name || 'All-Church'}</p></div>
          {invitation.description && <p className="event-invitation-description">{invitation.description}</p>}
        </>}
        {error && <p className="event-invitation-error" role="alert">{error}</p>}
        {invitation && (!invitation.accepting ? <p className="event-invitation-notice">Responses are closed for this invitation. Please contact the event organizer.</p> : saved ?
          <div className="event-invitation-success" role="status"><CheckCircle2 size={34} /><h2>Thank you, {name}!</h2><p>Your response has been saved: <strong>{answer === 'yes' ? 'I will attend' : answer === 'no' ? 'I cannot attend' : 'Not yet sure'}</strong>.</p><p>You can update your answer until {dateLabel(invitation.deadline)}.</p><Button onClick={() => setSaved(false)}>Change my response</Button></div> :
          <form onSubmit={submit} className="event-invitation-form">
            {invitation.personal ? <p className="event-invitation-notice">Personal invitation for <strong>{invitation.member_name}</strong>. Please keep this link for yourself.</p> : <>
              <fieldset><legend>Are you a regular member or a guest?</legend><div className="event-invitation-choices">{(['member', 'guest'] as const).map(type =>
                <label key={type} data-selected={attendeeType === type}><input type="radio" name="attendeeType" checked={attendeeType === type} onChange={() => { setAttendeeType(type); setName(''); setContact(''); setMemberId(''); setSearch(''); }} /><strong>{type === 'member' ? 'Regular Member' : 'Guest'}</strong></label>)}</div></fieldset>
              {attendeeType === 'member' ? <>
                <div className="event-invitation-member-search">
                  <label className="ui-field">Your member name<input className="ui-input" role="combobox" aria-autocomplete="list" aria-expanded={showMemberResults} aria-controls={showMemberResults ? memberListId : undefined}
                    aria-activedescendant={showMemberResults && activeMember >= 0 && members[activeMember] ? `${memberListId}-${members[activeMember].id}` : undefined}
                    aria-describedby={`${memberListId}-help`} value={search} maxLength={120} required placeholder="Type your name…" autoComplete="off"
                    onChange={e => { setSearch(e.target.value); setMemberId(''); setName(''); setMembers([]); setActiveMember(-1); setMemberSearchOpen(true); }}
                    onFocus={() => setMemberSearchOpen(true)} onBlur={() => setMemberSearchOpen(false)}
                    onKeyDown={e => {
                      if (e.key === 'Escape') { e.preventDefault(); setMemberSearchOpen(false); }
                      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.preventDefault(); setMemberSearchOpen(true);
                        if (members.length) setActiveMember(index => e.key === 'ArrowDown' ? (index + 1) % members.length : (index <= 0 ? members.length - 1 : index - 1));
                      } else if (e.key === 'Enter' && showMemberResults) {
                        e.preventDefault(); if (activeMember >= 0 && members[activeMember]) chooseMember(members[activeMember]);
                      }
                    }} /><small id={`${memberListId}-help`}>{memberId ? 'Member selected. Edit the name to search again.' : 'Type any letter, then select your name. Only active members covered by this event are listed.'}</small></label>
                  {showMemberResults && <div className="event-invitation-member-results">
                    <div role="listbox" id={memberListId} aria-label="Matching members">{!searching && !searchError && members.map((member, index) => <button type="button" role="option" tabIndex={-1} id={`${memberListId}-${member.id}`} key={member.id} aria-selected={activeMember === index}
                      onMouseDown={e => e.preventDefault()} onClick={() => chooseMember(member)}>{member.name}</button>)}</div>
                    {searchError ? <p role="alert">{searchError}</p> : searching ? <p role="status">Searching members…</p> : !members.length ? <p role="status">No matching members in this event’s ministry. Try another name or contact the organizer.</p> : null}
                  </div>}
                </div>
                <p className="event-invitation-deadline">Select your own name. Your response will be linked to your member record for event registration. Attendance is confirmed at check-in.</p>
              </> : <>
              <label className="ui-field">Full name<input className="ui-input" value={name} onChange={e => setName(e.target.value)} maxLength={120} required autoComplete="name" /></label>
              <label className="ui-field">Email or mobile number<input className="ui-input" value={contact} onChange={e => setContact(e.target.value)} maxLength={160} required autoComplete="email" /></label>
              </>}
            </>}
            <fieldset><legend>Makakadalo ka ba? / Can you attend?</legend><div className="event-invitation-choices">{([
              ['yes', 'Oo, dadalo ako', 'I will attend'], ['no', 'Hindi ako makakadalo', 'I cannot attend'], ['maybe', 'Hindi pa sigurado', 'Not yet sure'],
            ] as const).map(([value, label, subtitle]) => <label key={value} data-selected={answer === value}><input type="radio" name="answer" value={value} checked={answer === value} onChange={() => setAnswer(value)} required /><span><strong>{label}</strong><small>{subtitle}</small></span></label>)}</div></fieldset>
            {answer === 'no' && <label className="ui-field">Reason / Dahilan (required)<textarea className="ui-input" rows={3} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} required /><small>Your reason is visible to authorized event organizers.</small></label>}
            <p className="event-invitation-deadline">Please respond by {dateLabel(invitation.deadline)}. You can change your answer before the deadline.</p>
            <Button variant="primary" type="submit" pending={saving} disabled={!answer || (!invitation.personal && attendeeType === 'member' && !memberId) || (answer === 'no' && !reason.trim())}>{saving ? 'Saving…' : 'Submit response'}</Button>
          </form>)}
      </>}
    </article>
  </main>;
}

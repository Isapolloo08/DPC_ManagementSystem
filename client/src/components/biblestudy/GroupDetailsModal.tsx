import { useState, type ReactNode } from 'react';
import { BookOpen, Calendar, ChevronDown, ChevronUp, Mail, MapPin, Megaphone, Phone, Search, Users, BookmarkCheck } from 'lucide-react';
import type { BibleStudyGroup, BibleStudyMember, StudyTopic } from '../../types';
import { getCurriculumCompletion } from '../../utils/curriculumCompletion';
import { formatDisplayDate } from '../../utils/displayDate';
import { ModalShell } from '../common/ModalShell';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import './group-details.css';

interface Props {
  group: BibleStudyGroup;
  topics: StudyTopic[];
  stageLabel: string;
  footer: ReactNode;
  onUpdateProgress: () => void;
  onClose: () => void;
}

const memberName = (member: BibleStudyMember) =>
  (member.display_name || member.member_name || `${member.first_name || ''} ${member.last_name || ''}`).trim() || 'Unnamed member';
const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).map(word => word[0]).filter((_, index, words) => index === 0 || index === words.length - 1).join('').toUpperCase();

export function GroupDetailsModal({ group, topics, stageLabel, footer, onUpdateProgress, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [profile, setProfile] = useState<BibleStudyMember | null>(null);
  const members = [...(group.members || [])].sort((a, b) => memberName(a).localeCompare(memberName(b)));
  const filtered = members.filter(member => memberName(member).toLowerCase().includes(search.trim().toLowerCase()));
  const visible = showAll || search.trim() ? filtered : filtered.slice(0, 5);
  const count = group.current_member_count ?? members.length;
  const capacity = group.max_capacity;
  const book = group.completed_book_title_snapshot || group.curriculum || 'General Scripture Discussion';
  const chapter = group.completed_chapter || group.current_chapter || 'Chapter 1';
  const { total, finished, percent, complete } = getCurriculumCompletion(group, topics);
  const rosterStatus = (member: BibleStudyMember) => member.member_status || member.status;

  return <>
    <ModalShell title={group.name} subtitle={<span className="group-detail-tags">
      <Badge>{group.category || 'General'}</Badge><Badge>{group.ministry_name || 'All-Church'}</Badge>
      <Badge variant={group.status === 'active' || group.status === 'completed' ? 'success' : 'neutral'}>{group.status || 'Unknown status'}</Badge>
      <span className="group-detail-id">ID: GRP-{group.id}</span>
    </span>} icon={<Users />} size="lg" onClose={onClose} className="study-design group-details-modal" showCloseFooter={false} footer={footer}>
      <section className="group-detail-study" aria-label="Current study series">
        <div className="group-detail-study-top">
          <span className="group-detail-study-icon" aria-hidden="true"><BookOpen size={20} /></span>
          <div className="group-detail-study-copy">
            <div className="group-detail-eyebrow-row"><span className="group-detail-eyebrow">Current study series</span><Badge variant={complete ? 'success' : 'info'}>{stageLabel}</Badge></div>
            <h3>{book}</h3><p>{chapter}</p>
          </div>
          <div className="group-detail-progress">
            {group.status === 'active' && <Button size="sm" variant="secondary" data-guide="group-progress" onClick={onUpdateProgress}><BookmarkCheck size={13} />Update Progress</Button>}
            <div className="group-detail-progress-label"><span>Curriculum completion</span><strong>{percent}%</strong></div>
            <div className="group-detail-progress-bar" role="progressbar" aria-label="Study curriculum completion" aria-valuemin={0} aria-valuemax={total} aria-valuenow={finished} aria-valuetext={`${finished} of ${total} chapters finished`}><span style={{ width: `${percent}%` }} /></div>
            <span className="group-detail-eyebrow">{finished}/{total} chapters finished</span>
          </div>
        </div>
        {group.progress_notes && <p className="group-detail-notice"><Megaphone size={14} aria-hidden="true" /><span><strong>Notice:</strong> {group.progress_notes}</span></p>}
        {group.status === 'completed' && <p className="group-detail-notice"><span>Completed on: {formatDisplayDate(group.completed_at)} · Total chapters completed: {total}</span></p>}
        {group.status === 'archived' && <p className="group-detail-notice"><span>Archived: {formatDisplayDate(group.archived_at)} · {group.archived_by_name || 'Pastor / Admin'}{group.archive_reason && <> · Reason: {group.archive_reason}</>}</span></p>}
      </section>

      <div className="group-detail-info-grid">
        <section className="group-detail-info-card" aria-label="Schedule and capacity">
          <div className="group-detail-fact"><span className="group-detail-fact-icon"><Calendar size={16} /></span><div><h3>Weekly Schedule</h3><p>Every {group.meeting_day || 'day to be confirmed'}{group.meeting_time && <> · {group.meeting_time}</>}</p></div></div>
          <div className="group-detail-fact"><span className="group-detail-fact-icon group-detail-venue-icon"><MapPin size={16} /></span><div><h3>Assigned Venue</h3><p>{group.location || 'Venue to be confirmed'}</p></div></div>
          {group.is_rescheduled && <p className="group-detail-reschedule"><Badge variant="info">Next session rescheduled</Badge><span>{formatDisplayDate(group.rescheduled_date)}{group.rescheduled_time && <> · {group.rescheduled_time}</>}{group.reschedule_reason && <> · {group.reschedule_reason}</>}</span></p>}
          <div className="group-detail-card-divider"><h3 className="group-detail-eyebrow">Capacity & Roster</h3><div className="group-detail-capacity"><span>{count} / {capacity} enrolled</span><Badge variant={count >= capacity ? 'warning' : 'neutral'}>{count > capacity ? 'Over Capacity' : count === capacity ? 'At Capacity' : `${capacity - count} spots available`}</Badge></div></div>
        </section>
        <section className="group-detail-info-card" aria-label="Leadership and vision">
          <h3 className="group-detail-eyebrow">Designated group leader</h3>
          <div className="group-detail-leader"><span className="group-detail-avatar" aria-hidden="true">{initials(group.leader_name || 'Leader')}</span><div><strong>{group.leader_name || 'Leader to be assigned'}</strong><p><Mail size={12} aria-hidden="true" />{group.leader_contact || 'Contact through Church Office'}</p></div></div>
          {group.assistant_leader_name && <p className="group-detail-assistant">Assistant: {group.assistant_leader_name}{group.assistant_leader_contact && <> · {group.assistant_leader_contact}</>}</p>}
          <div className="group-detail-card-divider"><h3 className="group-detail-eyebrow">Group Vision & Overview</h3><p className="group-detail-vision">{group.description || 'A welcoming small group for spiritual growth, fellowship, and mutual prayer support.'}</p></div>
        </section>
      </div>
      {group.source_group_names && <p className="group-detail-source">Formed from source groups: {group.source_group_names}</p>}

      <section className="group-detail-roster" aria-label="Enrolled Members">
        <div className="group-detail-roster-heading"><div><div className="group-detail-eyebrow-row"><h3>Enrolled Members</h3><Badge variant="info">{count} enrolled · Capacity {capacity}</Badge></div><p>Group roster and enrollment details</p></div>
          <label className="group-detail-search"><Search size={15} aria-hidden="true" /><input aria-label="Search enrolled members" placeholder="Search enrolled members…" value={search} onChange={event => setSearch(event.target.value)} /></label>
        </div>
        <div className="group-detail-member-list" id={`group-roster-${group.id}`}>
          {visible.map((member, index) => {
            const status = rosterStatus(member);
            return <div key={member.id ?? member.member_id ?? index} className="study-roster-row group-detail-member">
              <span className={`group-detail-avatar group-detail-avatar--${index % 4}`} aria-hidden="true">{initials(memberName(member))}</span>
              <div className="group-detail-member-copy"><strong>{memberName(member)}</strong><div className="group-detail-member-meta"><span>Joined {formatDisplayDate(member.joined_at)}</span>{status && <Badge variant={status === 'active' ? 'success' : 'neutral'}>{status === 'active' ? 'Enrolled' : status}</Badge>}</div></div>
              <Button variant="ghost" size="sm" aria-label={`Profile of ${memberName(member)}`} onClick={() => setProfile(member)}>Profile</Button>
            </div>;
          })}
          {!visible.length && <p className="group-detail-empty">{members.length ? 'No members match your search.' : 'No members enrolled yet.'}</p>}
        </div>
        {members.length > 5 && !search.trim() && <Button variant="ghost" size="sm" className="group-detail-expand" aria-expanded={showAll} aria-controls={`group-roster-${group.id}`} onClick={() => setShowAll(!showAll)}>{showAll ? <>Show fewer members <ChevronUp size={14} /></> : <>View remaining {members.length - 5} enrolled members <ChevronDown size={14} /></>}</Button>}
      </section>
    </ModalShell>
    {profile && <ModalShell title={memberName(profile)} subtitle="Group member profile" icon={<Users />} onClose={() => setProfile(null)} size="sm" className="study-design group-member-profile">
      <dl><div><dt>Group</dt><dd>{group.name}</dd></div><div><dt>Joined</dt><dd>{formatDisplayDate(profile.joined_at)}</dd></div>{rosterStatus(profile) && <div><dt>Membership</dt><dd>{rosterStatus(profile) === 'active' ? 'Enrolled' : rosterStatus(profile)}</dd></div>}<div><dt><Mail size={14} />Email</dt><dd>{profile.contact_email || 'No email recorded'}</dd></div><div><dt><Phone size={14} />Phone</dt><dd>{profile.contact_phone || 'No phone recorded'}</dd></div></dl>
    </ModalShell>}
  </>;
}

import { ArrowUpRight, Clock, MapPin, Users } from 'lucide-react';
import type { BibleStudyGroup } from '../../types';
import type { NavTab } from '../layout/Sidebar';

interface GroupsTodayCardProps {
  groups: BibleStudyGroup[];
  dayName: string;
  onNavigate: (tab: NavTab) => void;
}

export function GroupsTodayCard({ groups, dayName, onNavigate }: GroupsTodayCardProps) {
  const group = groups[0];
  const openGroups = () => onNavigate('biblestudy');

  return <article className="overview-card groups-today-card">
    <div className="card-heading">
      <div><h2 className="font-semibold">Groups today</h2><p>{dayName} · Discipleship circles</p></div>
      <Users size={17} aria-hidden="true" />
    </div>
    {group ? <button type="button" className="group-today-preview" onClick={openGroups} aria-label={`View Bible study groups, including ${group.name}`}>
      <span className="group-today-title"><strong>{group.name}</strong><ArrowUpRight size={15} aria-hidden="true" /></span>
      {group.category && <span className="group-today-category">{group.category}</span>}
      <span className="group-today-meta"><Clock size={13} aria-hidden="true" />{group.meeting_time || 'Time to be confirmed'}</span>
      <span className="group-today-meta"><MapPin size={13} aria-hidden="true" />{group.location || 'Location to be confirmed'}</span>
      {group.leader_name && <span className="group-today-leader">Facilitated by <strong>{group.leader_name}</strong></span>}
      <span className="group-today-members">{group.current_member_count ?? group.members?.length ?? 0}{group.max_capacity > 0 ? ` / ${group.max_capacity}` : ''} members</span>
    </button> : <div className="overview-empty"><Users size={22} aria-hidden="true" /><p>No group meetings scheduled today.</p><button type="button" onClick={openGroups}>Find a group <ArrowUpRight size={14} aria-hidden="true" /></button></div>}
    <div className="card-footnote"><span>{groups.length} {groups.length === 1 ? 'group' : 'groups'} meeting today</span><button type="button" onClick={openGroups}>All groups <ArrowUpRight size={13} aria-hidden="true" /></button></div>
  </article>;
}

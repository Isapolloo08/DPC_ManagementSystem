import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, CalendarDays, X } from 'lucide-react';
import { api } from '../../api';
import type { EventItem } from '../../types';
import type { NavTab } from '../layout/Sidebar';

export interface ChurchStat {
  label: string;
  value: number | string;
  tab: NavTab;
}

interface ChurchFocusPanelProps {
  id: string;
  focused: boolean;
  stats: ChurchStat[];
  groupTab?: NavTab | null;
  nextGathering?: EventItem;
  onClose: () => void;
  onNavigate: (tab: NavTab) => void;
  onOpenProfile?: () => void;
}

export function ChurchFocusPanel({ id, focused, stats, groupTab = 'biblestudy', nextGathering, onClose, onNavigate, onOpenProfile }: ChurchFocusPanelProps) {
  const headingId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const [present, setPresent] = useState(focused);
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    if (focused) { setPresent(true); return; }
    const timeout = window.setTimeout(() => setPresent(false), 400);
    return () => window.clearTimeout(timeout);
  }, [focused]);
  useEffect(() => { if (panelRef.current) panelRef.current.inert = !focused; }, [focused, present]);
  useEffect(() => {
    if (!focused) return;
    let active = true;
    api.getGeneralSettings().then(data => { if (active) setSettings(data?.settings || {}); }).catch(() => {});
    return () => { active = false; };
  }, [focused]);

  const date = nextGathering ? new Date(nextGathering.start_time) : null;
  return <aside ref={panelRef} id={id} className="church-focus-panel" hidden={!present} aria-hidden={!focused} aria-labelledby={headingId}>
    <div className="church-focus-heading"><div><p>CHURCH OVERVIEW</p><h2 className="font-semibold" id={headingId}>{settings.church_name || 'Daet Presbyterian Church'}</h2></div><button type="button" className="overview-icon-button" aria-label="Close church overview" onClick={onClose}><X size={16} aria-hidden="true" /></button></div>
    <dl className="church-focus-stats">{stats.map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>
    <div className="church-focus-gathering"><p><CalendarDays size={13} aria-hidden="true" /> Next gathering</p>
      {nextGathering && date ? <><strong>{nextGathering.title}</strong><span>{date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span></> : <span>No upcoming gatherings scheduled.</span>}
    </div>
    {settings.pastor_name && <p className="church-focus-pastor">Pastor <strong>{settings.pastor_name}</strong></p>}
    <div className="church-focus-actions">
      {onOpenProfile && <button type="button" className="church-profile-action" onClick={onOpenProfile}>View church profile <ArrowUpRight size={14} aria-hidden="true" /></button>}
      <button type="button" onClick={() => onNavigate('events')}>Open calendar <ArrowUpRight size={13} aria-hidden="true" /></button>
      {groupTab && <button type="button" onClick={() => onNavigate(groupTab)}>{groupTab === 'leaderportal' ? 'My Bible study group' : 'View groups'} <ArrowUpRight size={13} aria-hidden="true" /></button>}
    </div>
  </aside>;
}

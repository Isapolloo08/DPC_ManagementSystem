// @refresh reset
// Remount this boundary when focus hooks change during development hot reload.
import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ArrowUpRight, BookOpen, CalendarDays, Church, Plus, Users } from 'lucide-react';
import type { BibleStudyGroup, DashboardMetrics, EventItem } from '../../types';
import type { NavTab } from '../layout/Sidebar';
import { TodayBibleReadingWidget } from '../common/TodayBibleReadingWidget';
import TextType from '../common/TextType';
import { ChurchBuilding } from './ChurchBuilding';
import type { ChurchStat } from './ChurchFocusPanel';
import { ChurchFocusOverlay } from './ChurchFocusOverlay';
import { ChurchSky } from './ChurchSky';
import { useChurchFocus } from './useChurchFocus';
import { GroupsTodayCard } from './GroupsTodayCard';
import { getTimeOfDay, useLocalTime } from '../../hooks/useLocalTime';
import './ChurchOverview.css';
import './ChurchFocus.css';
import './ChurchViewport.css';

interface ChurchOverviewProps {
  name: string;
  role: string;
  ministryName?: string;
  metrics?: DashboardMetrics | null;
  memberCount?: number | string;
  groupCount?: number;
  ungroupedMemberCount?: number;
  description?: ReactNode;
  actions?: ReactNode;
  stats?: ChurchStat[];
  groupTab?: NavTab | null;
  "data-guide"?: string;
  onNavigate: (tab: NavTab) => void;
  onOpenChurchProfile?: () => void;
  events: EventItem[];
}

function OverviewNumber({ value, index }: { value: number | string; index: number }) {
  const numberRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const element = numberRef.current;
    if (!element) return;
    const motion = gsap.matchMedia();
    motion.add({ reduce: '(prefers-reduced-motion: reduce)', animate: '(prefers-reduced-motion: no-preference)' }, (context) => {
      if (context.conditions?.reduce || typeof value !== 'number' || !Number.isFinite(value)) {
        element.textContent = String(value);
        return;
      }
      const counter = { value: 0 };
      element.textContent = '0';
      gsap.to(counter, {
        value, duration: 0.8, delay: 0.24 + index * 0.09, ease: 'power2.out',
        onUpdate: () => { element.textContent = String(Math.round(counter.value)); },
        onComplete: () => { element.textContent = String(value); },
      });
    });
    return () => motion.revert();
  }, [value, index]);

  return <span className="overview-number">
    <span className="overview-number-reserve">{value}</span>
    <span className="overview-number-current" ref={numberRef}>{value}</span>
  </span>;
}

export function ChurchOverview({ name, role, ministryName, metrics, memberCount = '—', groupCount = 0, ungroupedMemberCount = 0, description, actions, stats: roleStats, groupTab = 'biblestudy', "data-guide": guide, onNavigate, onOpenChurchProfile, events }: ChurchOverviewProps) {
  const focus = useChurchFocus();
  const panelId = useId();
  const now = useLocalTime();
  const timeOfDay = getTimeOfDay(now);
  const greeting = timeOfDay === 'morning' ? 'Good morning' : timeOfDay === 'afternoon' ? 'Good afternoon' : 'Good evening';
  const openProfile = ['Admin', 'IT Admin', 'Pastor'].includes(role) ? onOpenChurchProfile : undefined;
  const greetingText = `${greeting}, ${name.trim().split(/\s+/)[0] || 'friend'}.`;
  const stats: ChurchStat[] = roleStats ?? [
    { label: 'Members', value: memberCount, tab: 'members' },
    { label: 'Without groups', value: ungroupedMemberCount, tab: 'biblestudy' },
    { label: 'Small groups', value: groupCount, tab: 'biblestudy' },
    { label: 'Households', value: metrics?.metrics.total_households ?? '—', tab: 'members' },
  ];
  const nextGathering = events.filter(event => new Date(event.start_time).getTime() >= now.getTime()).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];

  return (
    <><section ref={focus.heroRef} className="church-overview" aria-label="Church overview" data-guide={guide} data-time-of-day={timeOfDay} data-church-focused={focus.focused} data-church-visible={focus.visible}>
      <div className="overview-heading">
        <div>
          <p className="overview-eyebrow"><span /> {roleStats ? `${role.toUpperCase()} WORKSPACE` : 'YOUR CHURCH, AT A GLANCE'}</p>
          <h1 className="font-semibold" aria-label={greetingText}>
            <span className="greeting-text" aria-hidden="true">
              <span className="greeting-reserve">{greetingText}<span className="ml-1">|</span></span>
              <TextType key={greetingText} as="span" text={greetingText} typingSpeed={55} initialDelay={180} loop={false} cursorClassName="greeting-cursor" />
            </span>
          </h1>
          <p className="overview-subtitle">{description ?? 'A little clarity for a meaningful day of ministry.'}</p>
          <div className="overview-scope"><Church size={15} aria-hidden="true" /><span>{ministryName || 'Church-wide overview'}</span><span className="scope-tag">{role}</span></div>
          <button ref={focus.mobileTriggerRef} type="button" className="overview-profile-link" aria-controls={panelId} aria-expanded={focus.focused} onClick={event => focus.open(event.currentTarget)}>Open church overview <ArrowUpRight size={14} aria-hidden="true" /></button>
          {actions && <div className="overview-role-assignment">{actions}</div>}
        </div>
      </div>
      <ChurchBuilding focused={focus.focused} panelId={panelId} buttonRef={focus.triggerRef} onToggle={trigger => focus.focused ? focus.close() : focus.open(trigger)} />
      <div data-guide="dashboard-summary" className="overview-summary">
        <div className="overview-stat-list">
          {stats.map((stat, index) => <button type="button" key={stat.label} aria-label={`${stat.value} ${stat.label}`} onClick={() => onNavigate(stat.tab)} className="overview-stat"><strong aria-hidden="true"><OverviewNumber value={stat.value} index={index} /></strong><span aria-hidden="true">{stat.label}</span></button>)}
        </div>
      </div>
    </section>
    <ChurchSky modelVisible={focus.visible} skyRef={focus.skyRef} />
    {focus.visible && focus.geometry && <ChurchFocusOverlay focused={focus.focused} entered={focus.entered} geometry={focus.geometry} overlayRef={focus.overlayRef} triggerRef={focus.focusTriggerRef} panelId={panelId} timeOfDay={timeOfDay} stats={stats} groupTab={groupTab} nextGathering={nextGathering} onClose={() => focus.close()} onNavigate={onNavigate} onOpenProfile={openProfile} />}
    </>
  );
}

interface ChurchOverviewCardsProps {
  events: EventItem[];
  eventCount: number;
  groups: BibleStudyGroup[];
  dayName: string;
  onNavigate: (tab: NavTab) => void;
}

export function ChurchOverviewCards({ events, eventCount, groups, dayName, onNavigate }: ChurchOverviewCardsProps) {
  return (
    <>
        <article data-guide="dashboard-reading" className="overview-card scripture-card">
          <div className="card-heading"><h2 className="font-semibold">A moment in the Word</h2><BookOpen size={16} /></div>
          <TodayBibleReadingWidget compact onNavigateToPlan={() => onNavigate('biblereading')} />
          <p className="scripture-footnote">Make room for what matters.</p>
        </article>

        <GroupsTodayCard groups={groups} dayName={dayName} onNavigate={onNavigate} />

        <article data-guide="dashboard-calendar" className="overview-card calendar-card">
          <div className="card-heading"><div><h2 className="font-semibold">Coming together</h2><p>Next on the church calendar</p></div><button type="button" className="overview-icon-button" aria-label="Open church calendar" onClick={() => onNavigate('events')}><Plus size={17} /></button></div>
          {events.length ? <div className="overview-event-list">{events.map((event, index) => {
            const date = new Date(event.start_time);
            return <button type="button" className="overview-event" key={event.id} onClick={() => onNavigate('events')}>
              <span className="event-date"><strong>{date.getDate()}</strong><span>{date.toLocaleDateString('en-US', { month: 'short' })}</span></span>
              <span className={`event-content ${index === 0 ? 'event-highlight' : ''}`}><strong>{event.title}</strong><span>{date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · {event.location || 'Location to be confirmed'}</span></span>
              <ArrowUpRight size={15} />
            </button>;
          })}</div> : <div className="overview-empty"><CalendarDays size={22} /><p>No upcoming gatherings yet.</p><button type="button" onClick={() => onNavigate('events')}>Open calendar <ArrowUpRight size={14} /></button></div>}
          <div className="card-footnote"><span>{eventCount} upcoming events</span><button type="button" onClick={() => onNavigate('events')}>Full calendar <ArrowUpRight size={13} /></button></div>
        </article>
    </>
  );
}

export function MinistryDistribution({ ministries, onNavigate }: { ministries: DashboardMetrics['ministry_breakdown']; onNavigate: (tab: NavTab) => void }) {
  const largestMinistry = Math.max(1, ...ministries.map((ministry) => ministry.member_count));
  return <div>
    {ministries.length > 0 ? <div className="ministry-chart" role="group" aria-label="Active members by ministry">
      {ministries.map((ministry, index) => <button type="button" className="ministry-bar-column" key={ministry.id} title={`${ministry.name}: ${ministry.member_count} members`} onClick={() => onNavigate('members')}>
        <span className="ministry-bar-value">{ministry.member_count}</span>
        <span className="ministry-bar-track"><span className={index === ministries.length - 1 ? 'ministry-bar gold' : 'ministry-bar'} style={{ height: `${Math.max(4, ministry.member_count / largestMinistry * 100)}%` }} /></span>
        <span className="ministry-bar-label">{ministry.name}</span>
      </button>)}
    </div> : <div className="overview-empty"><Users size={22} /><p>Ministry activity will appear here when data is available.</p></div>}
    <div className="card-footnote"><span><span className="legend-dot" /> Active members by ministry</span><button type="button" onClick={() => onNavigate('reports')}>View insights <ArrowUpRight size={13} /></button></div>
  </div>;
}

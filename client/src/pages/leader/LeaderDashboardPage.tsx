import { ChurchOverview } from "../../components/dashboard/ChurchOverview";
import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api";
import { useGuideDataState } from "../../components/help/GuideDataContext";
import {
  BibleStudyGroup, BibleStudyMember, StudyTopic,
  SaturdayDutyScheduleResponse, SundayDutyScheduleResponse,
  Announcement, EventItem
} from "../../types";
import { useSocketEvent } from "../../socket";
import { TodayBibleReadingWidget } from "../../components/common/TodayBibleReadingWidget";
import { NavTab } from "../../components/layout/Sidebar";
import {
  Users, Calendar, Clock, MapPin,
  BookmarkCheck, UserCheck, ArrowRight,
  Utensils, MessageSquare, BookOpen, ChevronRight,
  AlertCircle, Plus
} from "lucide-react";
import { getCurriculumCompletion } from "../../utils/curriculumCompletion";
import { formatDisplayDate } from "../../utils/displayDate";
import "./leader-dashboard.css";
import { DashboardSkeleton } from "../../components/common/SkeletonLoader";

interface LeaderDashboardPageProps {
  onNavigate: (tab: NavTab) => void;
}

export const LeaderDashboardPage: React.FC<LeaderDashboardPageProps> = ({ onNavigate }) => {
  const { user, selectedMinistryId, ministries } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [groups, setGroups] = useState<BibleStudyGroup[]>([]);
  const [studyTopics, setStudyTopics] = useState<StudyTopic[]>([]);
  const [dutySchedule, setDutySchedule] = useState<SaturdayDutyScheduleResponse | null>(null);
  const [dishwashingData, setDishwashingData] = useState<SundayDutyScheduleResponse | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);

  const loadDashboardData = async () => {
    guideData.clearError();
    try {
      setLoading(true);
      const ministryScope = selectedMinistryId ?? undefined;
      const [grps, topics, dutyRes, dishRes, annRes, evRes] = await Promise.all([
        api.getGroups({ ministry_id: ministryScope }).catch(err => { guideData.reportError(err); return []; }),
        api.getStudyTopics({ ministry_id: ministryScope }).catch(() => null),
        api.getDutySchedule({ ministry_id: ministryScope }).catch(() => null),
        api.getDishwashingSchedule({ count: 8 }).catch(() => null),
        api.getAnnouncements(ministryScope).catch(() => []),
        api.getEvents({ ministry_id: ministryScope, upcoming: true }).catch(() => [])
      ]);

      setGroups(grps || []);
      if (topics?.topics) setStudyTopics(topics.topics);
      if (dutyRes) setDutySchedule(dutyRes);
      if (dishRes) setDishwashingData(dishRes);
      setAnnouncements(annRes.slice(0, 3));
      setUpcomingEvents(evRes.slice(0, 3));
    } catch (err) {
      console.error("Failed to load leader dashboard:", err);
      guideData.reportError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedMinistryId, user?.id]);

  // Real-time synchronization
  useSocketEvent("groups:changed", () => loadDashboardData());
  useSocketEvent("attendance:changed", () => loadDashboardData());
  useSocketEvent("study_topics:changed", () => loadDashboardData());
  useSocketEvent("duty:changed", () => loadDashboardData());
  useSocketEvent("dishwashing:changed", () => loadDashboardData());
  useSocketEvent("events:changed", () => loadDashboardData());
  useSocketEvent("communications:changed", () => loadDashboardData());

  // Find groups led by this user
  const myLedGroups = useMemo(() => {
    if (!user) return [];
    return groups.filter(g =>
      g.leader_id === user.id ||
      (user.name && g.leader_name?.toLowerCase().includes(user.name.toLowerCase()))
    );
  }, [groups, user]);

  // Active Led Group (or first led group, or first group)
  const activeGroup = myLedGroups[0] || groups[0] || null;
  const guideData = useGuideDataState("dashboard", { loading, count: 1, retry: loadDashboardData });
  const disciples: BibleStudyMember[] = activeGroup?.members || [];

  // Match current active curriculum topic
  const currentTopic = useMemo(() => {
    if (!activeGroup?.curriculum) return null;
    return studyTopics.find(t =>
      t.title.toLowerCase().trim() === activeGroup.curriculum?.toLowerCase().trim()
    ) || null;
  }, [studyTopics, activeGroup?.curriculum]);

  // Designated Saturday Cleaning Duty
  const upcomingDuty = dutySchedule?.schedule?.find(s => {
    if (activeGroup?.ministry_id) {
      return s.team?.ministry_id === activeGroup.ministry_id;
    }
    return true;
  }) || dutySchedule?.schedule?.[0] || null;

  // Designated Sunday Dishwashing
  const upcomingDishwashing = dishwashingData?.thisSunday || dishwashingData?.nextSunday;

  const completion = getCurriculumCompletion(activeGroup, studyTopics);
  const previewTopics = currentTopic
    ? [currentTopic, ...studyTopics.filter(topic => topic.id !== currentTopic.id)].slice(0, 3)
    : studyTopics.slice(0, 3);
  const capacity = activeGroup?.max_capacity || 0;
  const occupancy = capacity ? Math.round(disciples.length / capacity * 100) : 0;

  if (loading && groups.length === 0) {
    return <DashboardSkeleton variant="service" />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* 1. Header Banner */}
      <div className="church-dashboard role-church-hero">
      <ChurchOverview name={user?.name || "Friend"} role="Leader" events={upcomingEvents}
        ministryName={activeGroup?.name || "Small group discipleship"} onNavigate={onNavigate} groupTab="leaderportal"
        stats={[
          { label: 'Disciples', value: disciples.length, tab: 'leaderportal' },
          { label: 'My groups', value: myLedGroups.length, tab: 'leaderportal' },
          { label: 'Study topics', value: studyTopics.length, tab: 'leaderportal' },
          { label: 'Upcoming events', value: upcomingEvents.length, tab: 'events' },
        ]}
        description={<>"Be shepherds of God's flock that is under your care, watching over them—not because you must, but because you are willing, as God wants you to be." (1 Peter 5:2).</>}
        data-guide="leader-dashboard-summary"
        actions={<>{activeGroup ? (
          <div className="shrink-0 bg-stone-50  rounded-2xl p-4 border border-stone-200 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber text-charcoal flex items-center justify-center font-medium text-sm shadow-sm">
              <Users className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <span className="text-[12px] font-medium text-amber-700 uppercase tracking-wider block">Assigned Small Group</span>
              <span className="text-sm font-medium text-charcoal block truncate max-w-[180px]">{activeGroup.name}</span>
              <span className="text-[12px] text-muted">{activeGroup.meeting_day} • {activeGroup.meeting_time}</span>
            </div>
          </div>
        ) : (
          <div className="shrink-0 bg-amber-500/10 rounded-2xl p-4 border border-amber-500/20 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-amber-700" />
            <div className="text-xs text-amber-700">
              <div className="font-medium">No Small Group Assigned</div>
              <div className="text-[12px] opacity-80">Contact Admin/Coordinator</div>
            </div>
          </div>
        )}</>} />
      </div>

      <div className="leader-dashboard-content">
        <div className="leader-metrics">
          <article className="leader-metric" data-tone="info">
            <div className="leader-metric-label"><h2>Disciples enrolled</h2><span className="leader-icon"><Users size={16} /></span></div>
            <p className="leader-metric-value">{disciples.length}<span>{capacity ? `/ ${capacity} capacity` : ' enrolled'}</span></p>
            <button className="leader-metric-detail" data-guide="leader-dashboard-group" onClick={() => onNavigate('leaderportal')}><span className="leader-dot" />{capacity ? `${occupancy}% small group occupancy` : 'Manage group roster'}<ChevronRight size={13} /></button>
          </article>
          <article className="leader-metric" data-tone="success">
            <div className="leader-metric-label"><h2>Weekly fellowship</h2><span className="leader-icon"><Clock size={16} /></span></div>
            <p className="leader-metric-value leader-metric-text">{activeGroup?.meeting_day || 'Not assigned'}<span>{activeGroup?.meeting_time}</span></p>
            <button className="leader-metric-detail" data-guide="leader-dashboard-group" onClick={() => onNavigate('leaderportal')}><MapPin size={13} />{activeGroup?.location || 'View group details'}<ChevronRight size={13} /></button>
          </article>
          <article className="leader-metric" data-tone="study">
            <div className="leader-metric-label"><h2>Active curriculum</h2><span className="leader-icon"><BookmarkCheck size={16} /></span></div>
            <p className="leader-metric-value leader-metric-text" title={activeGroup?.curriculum || undefined}>{activeGroup?.curriculum || 'No assigned book'}</p>
            <button className="leader-metric-detail" onClick={() => onNavigate('leaderportal')}>{activeGroup?.curriculum ? <><span>Chapter {completion.current} of {completion.total}</span><strong>{completion.percent}% done</strong></> : <span>Explore study topics <ChevronRight size={13} /></span>}</button>
          </article>
          <article className="leader-metric" data-tone="warning">
            <div className="leader-metric-label"><h2>Sunday ministry duty</h2><span className="leader-icon"><Utensils size={16} /></span></div>
            <p className="leader-metric-value leader-metric-text">Dishwashing duty</p>
            <button className="leader-metric-detail" onClick={() => onNavigate('dishwashing')}><Calendar size={13} /><span>{upcomingDishwashing?.duty_date ? formatDisplayDate(upcomingDishwashing.duty_date) : 'No upcoming duty'}</span>{upcomingDishwashing?.team && <span className="leader-badge">{upcomingDishwashing.team.name}</span>}</button>
          </article>
        </div>

        <TodayBibleReadingWidget layout="dashboard" onNavigateToPlan={() => onNavigate('biblereading')} />

        <section className="leader-commands" aria-labelledby="leader-commands-heading">
          <div className="leader-command-heading"><h2 id="leader-commands-heading">Leader Quick Command Center</h2><span>One-click actions</span></div>
          <div className="leader-command-grid">
            {[
              { label: 'Take Roll-Call', detail: 'Session attendance', icon: UserCheck, tab: 'leaderportal', tone: 'warning' },
              { label: 'Group Disciples', detail: 'Manage roster', icon: Users, tab: 'leaderportal', tone: 'info' },
              { label: 'Bible Topics', detail: 'Books & tracks', icon: BookmarkCheck, tab: 'curriculum', tone: 'study' },
              { label: 'Bible Reading', detail: '1-Year Scripture', icon: BookOpen, tab: 'biblereading', tone: 'success' },
              { label: 'Dishwashing', detail: 'Sunday kitchen', icon: Utensils, tab: 'dishwashing', tone: 'warning' },
            ].map(action => <button key={action.label} data-tone={action.tone} data-guide={action.tab === 'leaderportal' ? 'leader-dashboard-group' : undefined} onClick={() => onNavigate(action.tab as NavTab)}><span className="leader-icon"><action.icon size={18} /></span><strong>{action.label}</strong><span>{action.detail}</span></button>)}
          </div>
        </section>

        <div className="leader-panel-columns">
          <div className="leader-panel-stack">
            <section className="leader-panel" aria-labelledby="leader-roster-heading">
              <div className="leader-panel-heading"><div><span className="leader-icon" data-tone="info"><Users size={16} /></span><div><h2 id="leader-roster-heading">Disciples Roster</h2><p>{activeGroup ? `${activeGroup.name} (${disciples.length} members)` : 'Your assigned small group'}</p></div></div><button data-guide="leader-dashboard-group" onClick={() => onNavigate('leaderportal')}>Manage in Portal <ArrowRight size={13} /></button></div>
              {disciples.length ? <div className="leader-roster-list">{disciples.slice(0, 4).map((disciple, index) => {
                const name = disciple.member_name || `${disciple.first_name || ''} ${disciple.last_name || ''}`.trim() || 'Member';
                const initials = name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
                return <div className="leader-roster-row" key={disciple.id}><span className="leader-avatar" data-color={index % 4}>{initials}</span><div><strong>{name}</strong><span>{disciple.joined_at ? `Joined ${formatDisplayDate(disciple.joined_at)}` : disciple.contact_phone || 'Group disciple'}</span></div><span className="leader-badge" data-tone={disciple.status === 'inactive' || disciple.status === 'transferred' ? 'neutral' : 'success'}>{disciple.status === 'inactive' ? 'Inactive' : disciple.status === 'transferred' ? 'Transferred' : 'Enrolled'}</span></div>;
              })}</div> : <p className="leader-empty"><Users size={25} />No disciples assigned to this group yet.</p>}
              <div className="leader-panel-footer"><span>Showing {Math.min(4, disciples.length)} of {disciples.length} disciples</span><button className="leader-primary" onClick={() => onNavigate('leaderportal')}><Plus size={13} />{disciples.length ? 'Manage disciples' : 'Add Disciples in Portal'}</button></div>
            </section>

            <section className="leader-panel" aria-labelledby="leader-events-heading">
              <div className="leader-panel-heading"><div><span className="leader-icon" data-tone="study"><Calendar size={16} /></span><h2 id="leader-events-heading">Church Calendar & Events</h2></div><button data-guide="leader-dashboard-calendar" onClick={() => onNavigate('events')}>All Events <ArrowRight size={13} /></button></div>
              {upcomingEvents.length ? <div className="leader-events-grid">{upcomingEvents.map(event => {
                const date = new Date(event.start_time);
                return <button className="leader-event" key={event.id} onClick={() => onNavigate('events')}><span className="leader-event-date"><span>{date.toLocaleDateString(undefined, { month: 'short' })}</span><strong>{date.getDate()}</strong></span><span className="leader-event-description"><strong>{event.title}</strong><span>{date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}{event.location ? ` · ${event.location}` : ''}</span>{event.ministry_name && <span className="leader-badge" data-tone="info">{event.ministry_name}</span>}</span></button>;
              })}</div> : <p className="leader-empty"><Calendar size={25} />No upcoming events scheduled.</p>}
            </section>
          </div>

          <div className="leader-panel-stack">
            <section className="leader-panel" aria-labelledby="leader-topics-heading">
              <div className="leader-panel-heading"><div><span className="leader-icon" data-tone="study"><BookOpen size={16} /></span><h2 id="leader-topics-heading">Bible Study Topics & Books</h2></div><button onClick={() => onNavigate('curriculum')}>View All Books <ArrowRight size={13} /></button></div>
              {studyTopics.length ? <div className="leader-topic-list">{previewTopics.map(topic => {
                const isCurrent = topic.id === currentTopic?.id;
                return <button className="leader-topic" data-current={isCurrent} key={topic.id} onClick={() => onNavigate(isCurrent ? 'leaderportal' : 'curriculum')}><span className="leader-topic-title"><strong>{topic.title}</strong><span className="leader-badge" data-tone={isCurrent ? 'study' : 'neutral'}>{isCurrent ? (completion.complete ? 'Finished' : 'Active') : `${topic.total_chapters} chapters`}</span></span>{topic.summary_notes && <span className="leader-topic-summary">{topic.summary_notes}</span>}{isCurrent && <><span className="leader-topic-progress"><span>{activeGroup?.current_chapter || 'Not started'} · {completion.finished} chapters finished</span><strong>{completion.percent}%</strong></span><span className="leader-progress" role="progressbar" aria-label={`${topic.title} curriculum completion`} aria-valuenow={completion.percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${completion.percent}%` }} /></span></>}</button>;
              })}</div> : <p className="leader-empty"><BookOpen size={25} />No study topics registered.</p>}
            </section>

            <section className="leader-panel" aria-labelledby="leader-notices-heading">
              <div className="leader-panel-heading"><div><span className="leader-icon" data-tone="warning"><MessageSquare size={16} /></span><h2 id="leader-notices-heading">Church Announcements</h2></div><button onClick={() => onNavigate('communications')}>All Notices <ArrowRight size={13} /></button></div>
              {announcements.length ? <div className="leader-notice-list">{announcements.map(item => <article className="leader-notice" data-pinned={!!item.is_pinned} key={item.id}><div><h3>{item.title}</h3>{!!item.is_pinned && <span className="leader-badge" data-tone="warning">Pinned</span>}</div><p>{item.body}</p></article>)}</div> : <p className="leader-empty"><MessageSquare size={25} />No active announcements posted.</p>}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

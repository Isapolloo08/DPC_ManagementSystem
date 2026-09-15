import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api";
import {
  BibleStudyGroup, BibleStudyMember, StudyTopic,
  SaturdayDutyScheduleResponse, SundayDutyScheduleResponse,
  Announcement, EventItem, Ministry
} from "../../types";
import { useSocketEvent } from "../../socket";
import { TodayBibleReadingWidget } from "../../components/common/TodayBibleReadingWidget";
import { NavTab } from "../../components/layout/Sidebar";
import {
  Sparkles, Users, Calendar, Clock, MapPin,
  BookmarkCheck, UserCheck, ArrowRight, CalendarCheck,
  Utensils, MessageSquare, BookOpen, ChevronRight,
  ShieldCheck, AlertCircle, CheckCircle2, TrendingUp,
  Layers, Plus
} from "lucide-react";
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
    try {
      setLoading(true);
      const ministryScope = selectedMinistryId ?? undefined;
      const [grps, topics, dutyRes, dishRes, annRes, evRes] = await Promise.all([
        api.getGroups({ ministry_id: ministryScope }).catch(() => []),
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

  if (loading && groups.length === 0) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-md border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 right-32 w-64 h-64 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs font-black tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Small Group Discipleship Leader Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Welcome back, Leader {user?.name || ""}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-300/90 max-w-xl leading-relaxed">
              "Be shepherds of God's flock that is under your care, watching over them—not because you must, but because you are willing, as God wants you to be." (1 Peter 5:2).
            </p>
          </div>

          {activeGroup ? (
            <div className="shrink-0 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber text-charcoal flex items-center justify-center font-black text-sm shadow-sm">
                <Users className="w-5 h-5 text-slate-900" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">Assigned Small Group</span>
                <span className="text-sm font-black text-white block truncate max-w-[180px]">{activeGroup.name}</span>
                <span className="text-[11px] text-slate-300">{activeGroup.meeting_day} • {activeGroup.meeting_time}</span>
              </div>
            </div>
          ) : (
            <div className="shrink-0 bg-amber-500/10 rounded-2xl p-4 border border-amber-500/20 flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-amber-400" />
              <div className="text-xs text-amber-200">
                <div className="font-bold">No Small Group Assigned</div>
                <div className="text-[11px] opacity-80">Contact Admin/Coordinator</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Today's Bible Reading Devotion */}
      <TodayBibleReadingWidget onNavigateToPlan={() => onNavigate("biblereading")} />

      {/* 3. Executive Leader KPI Metrics (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* A. Disciples Roster Count */}
        <div className="bg-white rounded-2xl p-5 border border-sky-100 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Group Disciples</span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {disciples.length}
              <span className="text-xs font-normal text-slate-400 ml-1">/ {activeGroup?.max_capacity || 12} max</span>
            </div>
            <p className="text-xs text-sky-700 font-bold mt-0.5">
              {activeGroup ? activeGroup.name : "Active Group"}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Enrolled disciples</span>
            <button
              onClick={() => onNavigate("leaderportal")}
              className="text-xs font-bold text-sky-700 hover:text-sky-950 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform cursor-pointer"
            >
              <span>Manage Roster</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* B. Meeting Schedule & Attendance */}
        <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Weekly Fellowship</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black text-slate-900 truncate">
              {activeGroup?.meeting_day || "Wednesday"}
            </div>
            <p className="text-xs text-emerald-700 font-bold mt-0.5">
              {activeGroup?.meeting_time || "7:00 PM"} • {activeGroup?.location || "Sanctuary"}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Weekly Roll-Call</span>
            <button
              onClick={() => onNavigate("leaderportal")}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-950 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform cursor-pointer"
            >
              <span>Take Attendance</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* C. Active Curriculum & Study Topic */}
        <div className="bg-white rounded-2xl p-5 border border-indigo-100 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Curriculum Topic</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <BookmarkCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm font-black text-slate-900 truncate" title={activeGroup?.curriculum || "General Scripture Study"}>
              {activeGroup?.curriculum || "General Scripture Study"}
            </div>
            <p className="text-xs text-indigo-700 font-bold mt-0.5">
              {currentTopic ? `${currentTopic.total_chapters} Total Chapters` : `${studyTopics.length} Topics Available`}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Study Roadmap</span>
            <button
              onClick={() => onNavigate("curriculum")}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-950 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform cursor-pointer"
            >
              <span>Explore Books</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* D. Saturday Duty & Cleaning */}
        <div className="bg-white rounded-2xl p-5 border border-amber-100 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Saturday Church Duty</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm font-black text-slate-900 truncate">
              {upcomingDuty?.team?.name || "Sanctuary Cleaning"}
            </div>
            <p className="text-xs text-amber-800 font-bold mt-0.5">
              {upcomingDuty?.duty_date ? new Date(upcomingDuty.duty_date).toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" }) : "Scheduled Saturdays"}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">{upcomingDuty?.team?.leader_name ? `Leader: ${upcomingDuty.team.leader_name}` : "Church Roster"}</span>
            <button
              onClick={() => onNavigate("duty")}
              className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform cursor-pointer"
            >
              <span>View Roster</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Leader Quick Action Command Bar */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-5 bg-amber-500 rounded-full" />
            <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide">
              Leader Quick Command Center
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">One-click actions</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => onNavigate("leaderportal")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-amber-50/80 hover:bg-amber-100/90 border border-amber-200/80 text-amber-950 transition-all text-center group cursor-pointer hover:shadow-xs"
          >
            <UserCheck className="w-5 h-5 text-amber-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold">Take Roll-Call</span>
            <span className="text-[10px] text-amber-700/70">Session attendance</span>
          </button>

          <button
            onClick={() => onNavigate("leaderportal")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-sky-50/80 hover:bg-sky-100/90 border border-sky-200/80 text-sky-950 transition-all text-center group cursor-pointer hover:shadow-xs"
          >
            <Users className="w-5 h-5 text-sky-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold">Group Disciples</span>
            <span className="text-[10px] text-sky-700/70">Manage roster</span>
          </button>

          <button
            onClick={() => onNavigate("curriculum")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-indigo-50/80 hover:bg-indigo-100/90 border border-indigo-200/80 text-indigo-950 transition-all text-center group cursor-pointer hover:shadow-xs"
          >
            <BookmarkCheck className="w-5 h-5 text-indigo-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold">Bible Topics</span>
            <span className="text-[10px] text-indigo-700/70">Books & tracks</span>
          </button>

          <button
            onClick={() => onNavigate("biblereading")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-emerald-50/80 hover:bg-emerald-100/90 border border-emerald-200/80 text-emerald-950 transition-all text-center group cursor-pointer hover:shadow-xs"
          >
            <BookOpen className="w-5 h-5 text-emerald-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold">Bible Reading</span>
            <span className="text-[10px] text-emerald-700/70">1-Year Scripture</span>
          </button>

          <button
            onClick={() => onNavigate("duty")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-purple-50/80 hover:bg-purple-100/90 border border-purple-200/80 text-purple-950 transition-all text-center group cursor-pointer hover:shadow-xs"
          >
            <CalendarCheck className="w-5 h-5 text-purple-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold">Saturday Duty</span>
            <span className="text-[10px] text-purple-700/70">Sanctuary cleaning</span>
          </button>

          <button
            onClick={() => onNavigate("dishwashing")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-teal-50/80 hover:bg-teal-100/90 border border-teal-200/80 text-teal-950 transition-all text-center group cursor-pointer hover:shadow-xs"
          >
            <Utensils className="w-5 h-5 text-teal-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold">Dishwashing</span>
            <span className="text-[10px] text-teal-700/70">Sunday kitchen</span>
          </button>
        </div>
      </div>

      {/* 5. 2-Column: Group Disciples Roster & Curriculum Chapter Roadmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Disciples Roster Preview */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-600" />
              <h3 className="font-black text-sm text-slate-900">
                Disciples Roster ({disciples.length})
              </h3>
            </div>
            <button
              onClick={() => onNavigate("leaderportal")}
              className="text-xs font-bold text-sky-700 hover:text-sky-900 cursor-pointer flex items-center gap-1"
            >
              <span>Manage in Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {disciples.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
              <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-medium">No disciples assigned to this group yet.</p>
              <button
                onClick={() => onNavigate("leaderportal")}
                className="mt-3 px-3 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 transition-all cursor-pointer"
              >
                Add Disciples in Portal
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {disciples.slice(0, 6).map((d) => {
                const displayName = d.member_name || `${d.first_name || ""} ${d.last_name || ""}`.trim() || "Member";
                const initials = displayName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "M";

                return (
                  <div key={d.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-900 flex items-center justify-center font-black text-xs shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 truncate">{displayName}</div>
                        <div className="text-[10px] text-slate-500 truncate">{d.contact_phone || "Active disciple"}</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      Enrolled
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Active Curriculum Topics Preview */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <h3 className="font-black text-sm text-slate-900">Bible Study Topics & Books</h3>
            </div>
            <button
              onClick={() => onNavigate("curriculum")}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer flex items-center gap-1"
            >
              <span>View All Books</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {studyTopics.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-medium">No study topics registered.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {studyTopics.slice(0, 4).map((topic) => (
                <div
                  key={topic.id}
                  className="p-3.5 rounded-2xl bg-slate-50/80 hover:bg-indigo-50/50 border border-slate-200/80 transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-xs text-slate-900 truncate">{topic.title}</h4>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                      {topic.total_chapters} Ch
                    </span>
                  </div>
                  {topic.summary_notes && (
                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                      {topic.summary_notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 6. 2-Column: Upcoming Events & Ministry Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Events */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              <h3 className="font-black text-sm text-slate-900">Church Calendar & Events</h3>
            </div>
            <button
              onClick={() => onNavigate("events")}
              className="text-xs font-bold text-purple-700 hover:text-purple-900 cursor-pointer"
            >
              All Events →
            </button>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-medium">No upcoming events scheduled.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {upcomingEvents.map(event => (
                <div
                  key={event.id}
                  className="p-3.5 rounded-2xl bg-slate-50/80 hover:bg-purple-50/50 border border-slate-200/80 transition-all flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-slate-900 truncate">{event.title}</h4>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(event.start_time).toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" })}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                  {event.ministry_name && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-purple-800 border border-purple-200 shrink-0">
                      {event.ministry_name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Announcements */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-600" />
              <h3 className="font-black text-sm text-slate-900">Church Announcements</h3>
            </div>
            <button
              onClick={() => onNavigate("communications")}
              className="text-xs font-bold text-amber-800 hover:text-amber-950 cursor-pointer"
            >
              All Notices →
            </button>
          </div>

          {announcements.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-medium">No active announcements posted.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {announcements.map(item => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-slate-50/80 hover:bg-amber-50/50 border border-slate-200/80 transition-all space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-xs text-slate-900 truncate">{item.title}</h4>
                    {item.is_pinned && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                        PINNED
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

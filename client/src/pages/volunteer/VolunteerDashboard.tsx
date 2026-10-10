import { ChurchOverview } from "../../components/dashboard/ChurchOverview";
import { DashboardSkeleton } from "../../components/common/SkeletonLoader";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api";
import { useGuideDataState } from "../../components/help/GuideDataContext";
import {
  Announcement, EventItem, SaturdayDutyScheduleResponse,
  SundayDutyScheduleResponse, Ministry
} from "../../types";
import { useSocketEvent } from "../../socket";
import { TodayBibleReadingWidget } from "../../components/common/TodayBibleReadingWidget";
import { NavTab } from "../../components/layout/Sidebar";
import {
  HeartHandshake, CalendarCheck, Utensils, UserCheck,
  BookOpen, Calendar, MessageSquare, ArrowRight,
  Clock, MapPin, CheckCircle2, AlertCircle,
  Users, ChevronRight, ShieldCheck
} from "lucide-react";

interface VolunteerDashboardProps {
  onNavigate: (tab: NavTab) => void;
}

export const VolunteerDashboard: React.FC<VolunteerDashboardProps> = ({ onNavigate }) => {
  const { user, selectedMinistryId, ministries } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [dutySchedule, setDutySchedule] = useState<SaturdayDutyScheduleResponse | null>(null);
  const [dishwashingData, setDishwashingData] = useState<SundayDutyScheduleResponse | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);

  const assignedMinistry = user?.ministries && user.ministries.length > 0
    ? user.ministries[0]
    : ministries.find(m => m.id === selectedMinistryId) || null;

  const loadVolunteerData = async () => {
    guideData.clearError();
    try {
      setLoading(true);
      const ministryScope = assignedMinistry?.id || selectedMinistryId || undefined;
      const [dutyRes, dishRes, annRes, evRes] = await Promise.all([
        api.getDutySchedule({ ministry_id: ministryScope }).catch(err => { guideData.reportError(err); return null; }),
        api.getDishwashingSchedule({ count: 8 }).catch(() => null),
        api.getAnnouncements(ministryScope).catch(() => []),
        api.getEvents({ ministry_id: ministryScope, upcoming: true }).catch(() => [])
      ]);

      if (dutyRes) setDutySchedule(dutyRes);
      if (dishRes) setDishwashingData(dishRes);
      setAnnouncements(annRes.slice(0, 4));
      setUpcomingEvents(evRes.slice(0, 4));
    } catch (err) {
      console.error("Failed to load volunteer dashboard data:", err);
      guideData.reportError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVolunteerData();
  }, [assignedMinistry?.id, selectedMinistryId]);

  // Real-time synchronization
  useSocketEvent("duty:changed", () => loadVolunteerData());
  useSocketEvent("dishwashing:changed", () => loadVolunteerData());
  useSocketEvent("events:changed", () => loadVolunteerData());
  useSocketEvent("communications:changed", () => loadVolunteerData());
  useSocketEvent("attendance:changed", () => loadVolunteerData());

  // Upcoming duty for the volunteer's assigned ministry
  const upcomingDuty = dutySchedule?.schedule?.find(s => {
    if (!assignedMinistry) return true;
    return s.team?.ministry_id === assignedMinistry.id || s.team?.ministry_name?.toLowerCase() === assignedMinistry.name?.toLowerCase();
  }) || dutySchedule?.schedule?.[0] || null;

  // Next Dishwashing schedule
  const upcomingDishwashing = dishwashingData?.thisSunday || dishwashingData?.schedule?.[0] || null;
  const guideData = useGuideDataState("dashboard", { loading, count: 1, retry: loadVolunteerData });

  if (loading && !dutySchedule && !dishwashingData) return <DashboardSkeleton variant="service" />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* 1. Header Banner */}
      <div className="church-dashboard role-church-hero">
      <ChurchOverview name={user?.name || "Faithful Servant"} role="Volunteer" events={upcomingEvents}
        ministryName={assignedMinistry?.name || "Ministry service"} onNavigate={onNavigate} groupTab={null}
        stats={[
          { label: 'Cleaning duties', value: dutySchedule?.schedule?.length ?? 0, tab: 'duty' },
          { label: 'Dishwashing', value: dishwashingData?.schedule?.length ?? 0, tab: 'dishwashing' },
          { label: 'Announcements', value: announcements.length, tab: 'communications' },
          { label: 'Upcoming events', value: upcomingEvents.length, tab: 'events' },
        ]}
        description={<>"Whatever you do, work at it with all your heart, as working for the Lord, not for human masters." (Colossians 3:23).
          Here are your service assignments and ministry updates.</>}
        data-guide="volunteer-summary"
        actions={<>{assignedMinistry && (
          <div className="shrink-0 bg-stone-50  rounded-2xl p-4 border border-stone-200 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber text-charcoal flex items-center justify-center font-medium text-sm shadow-sm">
              {assignedMinistry.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <span className="text-[12px] font-medium text-muted uppercase tracking-wider block">Assigned Department</span>
              <span className="text-sm font-medium text-charcoal block">{assignedMinistry.name} Ministry</span>
              <span className="text-[12px] text-muted">{assignedMinistry.min_age}-{assignedMinistry.max_age} yrs bracket</span>
            </div>
          </div>
        )}</>} />
      </div>

      {/* 2. Today's Bible Reading Devotion */}
      <TodayBibleReadingWidget onNavigateToPlan={() => onNavigate("biblereading")} />

      {/* 3. Service & Roster Cards Grid (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* A. Saturday Duty Roster Card */}
        <div className="bg-white rounded-2xl p-5 border border-amber-200/70 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-amber-800 uppercase tracking-wider">Saturday Church Duty</span>
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                <CalendarCheck className="w-4 h-4 text-amber-700" />
              </div>
            </div>
            <div className="mt-2">
              <h3 className="text-sm font-semibold text-slate-900 line-clamp-1">
                {upcomingDuty?.team?.name || "Assigned Cleaning Shift"}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                <span>{upcomingDuty?.is_this_saturday ? new Date(upcomingDuty.duty_date).toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" }) : "Scheduled Saturdays"}</span>
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[12px] font-medium text-slate-500">
              {upcomingDuty?.team?.leader_name ? `Leader: ${upcomingDuty.team?.leader_name}` : "Church Roster"}
            </span>
            <button data-guide="volunteer-duty"
              onClick={() => onNavigate("duty")}
              className="text-xs font-medium text-amber-800 hover:text-amber-950 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform cursor-pointer"
            >
              <span>View Roster</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* B. Sunday Dishwashing Roster Card */}
        <div className="bg-white rounded-2xl p-5 border border-teal-200/70 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-teal-800 uppercase tracking-wider">Sunday Dishwashing</span>
              <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
                <Utensils className="w-4 h-4 text-teal-700" />
              </div>
            </div>
            <div className="mt-2">
              <h3 className="text-sm font-semibold text-slate-900 line-clamp-1">
                {upcomingDishwashing?.team?.name || "Kitchen Fellowship Crew"}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3 text-teal-600 shrink-0" />
                <span>{upcomingDishwashing?.duty_date ? new Date(upcomingDishwashing.duty_date).toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" }) : "This Sunday Cycle"}</span>
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[12px] font-medium text-slate-500">
              {upcomingDishwashing?.team?.leader_name ? `Leader: ${upcomingDishwashing.team?.leader_name}` : "Rotational Crew"}
            </span>
            <button
              onClick={() => onNavigate("dishwashing")}
              className="text-xs font-medium text-teal-800 hover:text-teal-950 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform cursor-pointer"
            >
              <span>View Cycle</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* C. Sunday Attendance Facilitator */}
        <div className="bg-white rounded-2xl p-5 border border-sky-200/70 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-sky-800 uppercase tracking-wider">Sunday Attendance</span>
              <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center">
                <UserCheck className="w-4 h-4 text-sky-700" />
              </div>
            </div>
            <div className="mt-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Live Check-In Desk
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Facilitate Sunday roll-call and visitor check-in.
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[12px] font-medium text-emerald-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Ready
            </span>
            <button data-guide="volunteer-attendance"
              onClick={() => onNavigate("attendance")}
              className="text-xs font-medium text-sky-800 hover:text-sky-950 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform cursor-pointer"
            >
              <span>Launch Roll-Call</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* D. Ministry & Fellowship */}
        <div className="bg-white rounded-2xl p-5 border border-indigo-200/70 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-indigo-800 uppercase tracking-wider">My Small Group</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-indigo-700" />
              </div>
            </div>
            <div className="mt-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Bible Study & Discipleship
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Join or lead small group Scripture discussions.
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[12px] font-medium text-slate-500">Fellowship</span>
            <button
              onClick={() => onNavigate("leaderportal")}
              className="text-xs font-medium text-indigo-800 hover:text-indigo-950 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform cursor-pointer"
            >
              <span>Open Portal</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Volunteer Quick Action Command Bar */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-5 bg-emerald-600 rounded-full" />
            <h3 className="font-semibold text-sm text-slate-900 uppercase tracking-wide">
              Volunteer Quick Action Center
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">One-click shortcuts</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button data-guide="volunteer-attendance"
            onClick={() => onNavigate("attendance")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-sky-50/80 hover:bg-sky-100/90 border border-sky-200/80 text-sky-900 transition-all text-center group cursor-pointer hover:shadow-xs"
          >
            <UserCheck className="w-5 h-5 text-sky-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium">Sunday Check-In</span>
            <span className="text-[12px] text-sky-700/70">Facilitate roll call</span>
          </button>

          <button data-guide="volunteer-duty"
            onClick={() => onNavigate("duty")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-amber-50/80 hover:bg-amber-100/90 border border-amber-200/80 text-amber-900 transition-all text-center group cursor-pointer hover:shadow-xs"
          >
            <CalendarCheck className="w-5 h-5 text-amber-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium">Saturday Duty</span>
            <span className="text-[12px] text-amber-700/70">Cleaning schedule</span>
          </button>

          <button
            onClick={() => onNavigate("dishwashing")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-teal-50/80 hover:bg-teal-100/90 border border-teal-200/80 text-teal-900 transition-all text-center group cursor-pointer hover:shadow-xs"
          >
            <Utensils className="w-5 h-5 text-teal-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium">Dishwashing</span>
            <span className="text-[12px] text-teal-700/70">Kitchen cycle</span>
          </button>

          <button
            onClick={() => onNavigate("biblereading")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-indigo-50/80 hover:bg-indigo-100/90 border border-indigo-200/80 text-indigo-900 transition-all text-center group cursor-pointer hover:shadow-xs"
          >
            <BookOpen className="w-5 h-5 text-indigo-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium">Bible Reading</span>
            <span className="text-[12px] text-indigo-700/70">1-Year Plan</span>
          </button>

          <button
            onClick={() => onNavigate("events")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-purple-50/80 hover:bg-purple-100/90 border border-purple-200/80 text-purple-900 transition-all text-center group cursor-pointer hover:shadow-xs"
          >
            <Calendar className="w-5 h-5 text-purple-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium">Events</span>
            <span className="text-[12px] text-purple-700/70">Church Calendar</span>
          </button>

          <button
            onClick={() => onNavigate("communications")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-rose-50/80 hover:bg-rose-100/90 border border-rose-200/80 text-rose-900 transition-all text-center group cursor-pointer hover:shadow-xs"
          >
            <MessageSquare className="w-5 h-5 text-rose-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium">Announcements</span>
            <span className="text-[12px] text-rose-700/70">Updates & news</span>
          </button>
        </div>
      </div>

      {/* 5. 2-Column: Upcoming Events & Ministry Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Upcoming Events */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <h3 className="font-semibold text-sm text-slate-900">Upcoming Events & Activities</h3>
            </div>
            <button
              onClick={() => onNavigate("events")}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-900 cursor-pointer"
            >
              View Calendar →
            </button>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-medium">No upcoming events scheduled right now.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {upcomingEvents.map(event => (
                <div
                  key={event.id}
                  className="p-3.5 rounded-2xl bg-slate-50/80 hover:bg-emerald-50/50 border border-slate-200/80 transition-all flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <h4 className="font-semibold text-xs text-slate-900 truncate">{event.title}</h4>
                    <div className="flex items-center gap-3 text-[12px] text-slate-500 mt-1">
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
                    <span className="px-2 py-0.5 rounded-md text-[12px] font-medium bg-white text-emerald-800 border border-emerald-200 shrink-0">
                      {event.ministry_name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Announcements */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              <h3 className="font-semibold text-sm text-slate-900">Ministry Announcements</h3>
            </div>
            <button
              onClick={() => onNavigate("communications")}
              className="text-xs font-medium text-indigo-700 hover:text-indigo-900 cursor-pointer"
            >
              All Notices →
            </button>
          </div>

          {announcements.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-medium">No current announcements posted.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {announcements.map(item => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-slate-50/80 hover:bg-indigo-50/50 border border-slate-200/80 transition-all space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-xs text-slate-900 truncate">{item.title}</h4>
                    {item.is_pinned && (
                      <span className="px-1.5 py-0.5 rounded text-[12px] font-medium bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                        PINNED
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-slate-600 line-clamp-2 leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

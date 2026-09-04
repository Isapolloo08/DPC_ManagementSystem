import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ChurchLogo } from "../components/common/ChurchLogo";
import { api } from "../api";
import { DashboardMetrics, Ministry, Announcement, EventItem, Member, BirthdayCelebrant, BirthdaySummary, BibleStudyGroup, SaturdayDutyScheduleResponse, DishwashingResponse } from "../types";
import {
  Users, UserCheck, Heart, MessageSquare, Calendar,
  AlertTriangle, ArrowRight, Sparkles, PlusCircle, CheckCircle2, Clock,
  Cake, Gift, PartyPopper, Send, X, Check, Share2, BookOpen, MapPin, ShieldCheck, Layers,
  Utensils
} from "lucide-react";
import { NavTab } from "../components/layout/Sidebar";

interface DashboardPageProps {
  onNavigate: (tab: NavTab) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user, ministries, selectedMinistryId } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);
  const [agingOutMembers, setAgingOutMembers] = useState<(Member & { current_age: number; suggested_next_ministry: Ministry })[]>([]);
  const [birthdaySummary, setBirthdaySummary] = useState<BirthdaySummary | null>(null);
  const [bibleStudyGroups, setBibleStudyGroups] = useState<BibleStudyGroup[]>([]);
  const [dutySchedule, setDutySchedule] = useState<SaturdayDutyScheduleResponse | null>(null);
  const [dishwashingData, setDishwashingData] = useState<DishwashingResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Greeting Modal State
  const [greetingMember, setGreetingMember] = useState<BirthdayCelebrant | null>(null);
  const [greetingMessage, setGreetingMessage] = useState<string>("");
  const [greetingSuccess, setGreetingSuccess] = useState<boolean>(false);
  const [sendingGreeting, setSendingGreeting] = useState<boolean>(false);

  const isCoordinator = user?.role_name === "Coordinator";
  const coordinatorMinistryId = isCoordinator && user?.ministries && user.ministries.length > 0
    ? user.ministries[0].id
    : (user?.role_name !== "Admin" && selectedMinistryId ? selectedMinistryId : null);
  const coordinatorMinistryName = user?.ministries && user.ministries.length > 0 ? user.ministries[0].name : "Youth";
  const scopedMemberCount = coordinatorMinistryId
    ? (metrics?.ministry_breakdown?.find(m => m.id === coordinatorMinistryId)?.member_count ?? 2)
    : (metrics?.metrics.total_active_members ?? "...");

  useEffect(() => {
    loadDashboard();
  }, [selectedMinistryId, coordinatorMinistryId]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const activeScope = coordinatorMinistryId ?? selectedMinistryId ?? undefined;
      const [m, a, e, ao, b, grps, dutyRes, dishRes] = await Promise.all([
        api.getDashboardMetrics(activeScope).catch((err) => {
          console.error("Metrics error:", err);
          return null;
        }),
        api.getAnnouncements(activeScope).catch(() => []),
        api.getEvents({ ministry_id: activeScope, upcoming: true }).catch(() => []),
        api.getAgingOutMembers().catch(() => []),
        api.getBirthdays({ ministry_id: activeScope, timeframe: "all" }).catch(() => null),
        api.getGroups({ ministry_id: activeScope }).catch(() => []),
        api.getDutySchedule({ ministry_id: activeScope }).catch(() => null),
        api.getDishwashingDuties().catch(() => null)
      ]);
      if (m) setMetrics(m);
      setAnnouncements(a.slice(0, 3));
      setUpcomingEvents(e.slice(0, 3));
      setAgingOutMembers(coordinatorMinistryId ? ao.filter((item: any) => item.ministry_id === coordinatorMinistryId) : ao);
      if (b) setBirthdaySummary(b);
      setBibleStudyGroups(grps);
      if (dutyRes) setDutySchedule(dutyRes);
      if (dishRes) setDishwashingData(dishRes);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGreeting = (celebrant: BirthdayCelebrant) => {
    setGreetingMember(celebrant);
    setGreetingMessage(
      `Happy ${celebrant.turning_age}th Birthday, ${celebrant.first_name}! 🎂 "The Lord bless you and keep you; the Lord make His face shine upon you and be gracious to you!" (Numbers 6:24-25). Praying for abundant grace, joy, and peace in your new year!`
    );
    setGreetingSuccess(false);
  };

  const handleSendGreeting = async () => {
    if (!greetingMember) return;
    try {
      setSendingGreeting(true);
      await api.sendBirthdayGreeting(greetingMember.id, {
        message: greetingMessage,
        channel: "announcement"
      });
      setGreetingSuccess(true);
      // Refresh announcements so newly posted birthday blessing appears
      const a = await api.getAnnouncements(selectedMinistryId ?? undefined);
      setAnnouncements(a.slice(0, 3));
      setTimeout(() => {
        setGreetingMember(null);
        setGreetingSuccess(false);
      }, 1500);
    } catch (err) {
      console.error("Failed to send birthday blessing:", err);
    } finally {
      setSendingGreeting(false);
    }
  };

  const activeMinistry = ministries.find((m) => m.id === selectedMinistryId);

  const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayDayName = DAYS_OF_WEEK[new Date().getDay()];

  const todayBibleStudyGroups = bibleStudyGroups.filter(
    (g) => g.meeting_day && g.meeting_day.trim().toLowerCase() === todayDayName.toLowerCase()
  );

  // Compute active Saturday duty & Sunday dishwashing turns
  const thisSaturdayDuty = dutySchedule?.schedule?.find(s => s.is_this_saturday) ||
    dutySchedule?.schedule?.find(s => !s.is_past) ||
    dutySchedule?.schedule?.[0] || null;
  const nextSaturdayDuty = dutySchedule?.schedule?.find(s => s !== thisSaturdayDuty && !s.is_past) || null;

  const thisSundayDishwashing = dishwashingData?.thisSunday || dishwashingData?.duties?.[0] || null;
  const nextSundayDishwashing = dishwashingData?.nextSunday || (dishwashingData?.duties && dishwashingData.duties.length > 1 ? dishwashingData.duties[1] : null);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800 text-white p-7 sm:p-8 shadow-xl border border-indigo-800/80">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-amber-400/20 via-indigo-500/10 to-transparent rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <ChurchLogo variant="badge" className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl shadow-xl ring-2 ring-white/20 shrink-0 mt-1" />
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-indigo-950 font-black text-xs shadow-xs uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {user?.role_name} Portal
                </span>
                {activeMinistry && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-indigo-100 text-xs font-semibold backdrop-blur-md border border-white/20 shadow-xs">
                    <Heart className="w-3.5 h-3.5 text-rose-300" />
                    {activeMinistry.name} Ministry View
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white drop-shadow-xs">
                Welcome back, <span className="text-amber-300">{user?.name}</span>! 👋
              </h1>
              <p className="text-xs sm:text-sm text-indigo-100/90 max-w-2xl leading-relaxed">
                Managing 7 age-bracket ministries, discipleship events, prayer requests, and small groups with faithful stewardship.
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              onClick={() => onNavigate("biblestudy")}
              className="group flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black px-4 py-2.5 rounded-2xl text-xs shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-indigo-950 group-hover:rotate-6 transition-transform" />
              <span>Small Groups</span>
            </button>
            <button
              onClick={() => onNavigate("events")}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2.5 rounded-2xl text-xs border border-white/20 backdrop-blur-md transition-all active:scale-95 cursor-pointer hover:border-white/40 shadow-xs"
            >
              <Calendar className="w-4 h-4 text-amber-300" />
              <span>Calendar</span>
            </button>
            <button
              onClick={() => onNavigate("members")}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2.5 rounded-2xl text-xs border border-white/20 backdrop-blur-md transition-all active:scale-95 cursor-pointer hover:border-white/40 shadow-xs"
            >
              <Users className="w-4 h-4 text-amber-300" />
              <span>Directory</span>
            </button>
          </div>
        </div>
      </div>

      {/* Aging Out / Ministry Transition Urgent Alert Banner */}
      {agingOutMembers.length > 0 && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/5 border border-amber-300/80 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm backdrop-blur-xs">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500/20 text-amber-700 rounded-2xl shrink-0 mt-0.5 shadow-xs">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-sm font-black text-indigo-950 tracking-tight">Ministry Transition Required</h3>
                <span className="text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white px-2.5 py-0.5 rounded-full shadow-xs">
                  {agingOutMembers.length} Members Aging Out
                </span>
              </div>
              <p className="text-xs text-charcoal/80 mt-1">
                The following disciples have reached their ministry's age limit and are ready to be promoted:
              </p>
              <div className="flex flex-wrap gap-2 mt-2.5">
                {agingOutMembers.slice(0, 3).map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-xs border border-amber-300 text-indigo-950 text-xs px-3 py-1 rounded-xl font-bold shadow-xs"
                  >
                    <span>{m.first_name} {m.last_name} (Age {m.current_age})</span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
                    <strong className="text-indigo-700">{m.suggested_next_ministry?.name || "Next Ministry"}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate("members")}
            className="self-start md:self-center px-4 py-2.5 bg-white hover:bg-amber-50 border border-amber-300 text-amber-900 text-xs font-black rounded-2xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 shrink-0 cursor-pointer active:scale-95"
          >
            <span>Review Transitions</span>
            <ArrowRight className="w-4 h-4 text-amber-700" />
          </button>
        </div>
      )}

      {/* Key Metric Cards - Top Executive KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
        {[
          {
            title: "Sunday Attendance",
            value: coordinatorMinistryId
              ? (metrics?.ministry_breakdown?.find(m => m.id === coordinatorMinistryId)?.today_checkins ?? "0")
              : (metrics?.metrics.today_checkins ?? "0"),
            subtitle: coordinatorMinistryId ? `${coordinatorMinistryName} present` : "Marked present today",
            icon: <UserCheck className="w-4 h-4 text-emerald-600" />,
            bgColor: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
            tab: "attendance" as NavTab,
            live: true
          },
          {
            title: coordinatorMinistryId ? `${coordinatorMinistryName} Members` : "Active Members",
            value: scopedMemberCount,
            subtitle: coordinatorMinistryId
              ? `${metrics?.metrics.total_active_members ?? 12} church-wide`
              : "Across 7 ministries",
            icon: <Users className="w-4 h-4 text-indigo-700" />,
            bgColor: "bg-indigo-50 text-indigo-700 border-indigo-200/60",
            tab: "members" as NavTab
          },
          {
            title: "Bible Study Groups",
            value: `${bibleStudyGroups.length || 6} Groups`,
            subtitle: todayBibleStudyGroups.length > 0
              ? `${todayBibleStudyGroups.length} meeting today! 📖`
              : `Active Life Groups`,
            icon: <BookOpen className="w-4 h-4 text-amber-700" />,
            bgColor: "bg-amber-50 text-amber-700 border-amber-200/60",
            tab: "biblestudy" as NavTab
          },
          {
            title: "Open Prayers",
            value: metrics?.metrics.open_prayer_requests ?? "...",
            subtitle: "Active prayer requests",
            icon: <MessageSquare className="w-4 h-4 text-rose-600" />,
            bgColor: "bg-rose-50 text-rose-700 border-rose-200/60",
            tab: "communications" as NavTab
          },
          {
            title: "Upcoming Events",
            value: metrics?.metrics.upcoming_events_count ?? "...",
            subtitle: "Scheduled services",
            icon: <Calendar className="w-4 h-4 text-sky-600" />,
            bgColor: "bg-sky-50 text-sky-700 border-sky-200/60",
            tab: "events" as NavTab
          },
          {
            title: "Households",
            value: metrics?.metrics.total_households ?? "...",
            subtitle: "Family groupings",
            icon: <Sparkles className="w-4 h-4 text-purple-600" />,
            bgColor: "bg-purple-50 text-purple-700 border-purple-200/60",
            tab: "members" as NavTab
          },
        ].map((card, idx) => (
          <div
            key={idx}
            onClick={() => onNavigate(card.tab)}
            className="group relative bg-white/95 rounded-3xl p-4 border border-indigo-100/90 shadow-2xs hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between"
          >
            {/* Top edge gradient highlight */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent group-hover:via-amber-400 transition-all" />
            
            <div className="flex items-center justify-between mb-2.5">
              <div className={`p-2.5 rounded-2xl ${card.bgColor} border group-hover:scale-110 transition-transform shadow-2xs`}>
                {card.icon}
              </div>
              {card.live && (
                <span className="flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Live
                </span>
              )}
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-indigo-950 tracking-tight truncate" title={String(card.value)}>
                {card.value}
              </div>
              <div className="text-xs font-bold text-charcoal/90 mt-0.5 truncate">{card.title}</div>
              <div className="text-[10px] font-medium text-charcoal/50 truncate mt-0.5">{card.subtitle}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ==================================================== */}
      {/* PROFESSIONAL DASHBOARD 2-COLUMN GRID (MAIN & SIDEBAR) */}
      {/* ==================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ==================================================== */}
        {/* LEFT MAIN CONTENT AREA (8 of 12 columns) */}
        {/* ==================================================== */}
        <div className="lg:col-span-8 space-y-6">

          {/* Bible Study Groups Today Showcase */}
          <div className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-indigo-50">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100/80 text-indigo-950 flex items-center justify-center font-bold shadow-2xs shrink-0 border border-indigo-200/60">
                  <BookOpen className="w-5 h-5 text-indigo-900" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-base lg:text-lg font-black text-indigo-950 tracking-tight">
                      📖 Bible Study Groups Today ({todayDayName})
                    </h2>
                    {todayBibleStudyGroups.length > 0 ? (
                      <span className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-black px-3 py-0.5 rounded-full shadow-xs animate-pulse">
                        ✨ {todayBibleStudyGroups.length} {todayBibleStudyGroups.length === 1 ? "Group" : "Groups"} Meeting!
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-charcoal/60 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-gray-200">
                        No groups on {todayDayName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-charcoal/60 mt-0.5">
                    Live tracking of active small groups, room venues, lesson curriculum, and designated leaders.
                  </p>
                </div>
              </div>

              <button
                onClick={() => onNavigate("biblestudy")}
                className="text-xs font-black text-indigo-950 hover:text-indigo-800 flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100/80 px-4 py-2 rounded-xl border border-indigo-200/80 transition-all shadow-2xs self-start sm:self-auto shrink-0 cursor-pointer active:scale-95"
              >
                <span>All Groups ({bibleStudyGroups.length})</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
              </button>
            </div>

            {todayBibleStudyGroups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {todayBibleStudyGroups.map((group) => (
                  <div
                    key={group.id}
                    className="p-5 rounded-2xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50/30 via-white to-amber-50/15 hover:border-amber-400 hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-indigo-950 text-white shadow-2xs">
                          {group.category || "LifeGroup"}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-lg border border-emerald-300">
                          <Clock className="w-3 h-3 text-emerald-600" />
                          <span>{group.meeting_time}</span>
                        </span>
                      </div>

                      <div>
                        <h3 className="font-black text-sm text-indigo-950 leading-snug">
                          {group.name}
                        </h3>
                        {group.description && (
                          <p className="text-[11px] text-charcoal/70 line-clamp-2 mt-1 leading-relaxed">
                            {group.description}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5 p-3 bg-white/90 rounded-xl border border-indigo-50 text-xs shadow-2xs">
                        <div className="flex items-center gap-2 text-charcoal">
                          <BookOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="truncate">
                            Curriculum: <strong className="text-indigo-950">{group.curriculum || "Scripture Discussion"}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-charcoal/80">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">
                            Location: <strong>{group.location}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-charcoal/80">
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                          <span className="truncate">
                            Leader: <strong>{group.leader_name}</strong> {group.leader_contact ? `(${group.leader_contact})` : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-indigo-50 text-xs">
                      <span className="text-[11px] text-charcoal/70 font-bold">
                        👥 <strong className="text-indigo-950">{group.current_member_count || 0}</strong> / {group.max_capacity} Enrolled
                      </span>
                      <button
                        onClick={() => onNavigate("biblestudy")}
                        className="flex items-center gap-1 text-xs font-black text-indigo-900 hover:text-amber-600 transition-colors cursor-pointer"
                      >
                        <span>Open Details</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gradient-to-br from-indigo-50/40 via-white to-amber-50/20 rounded-2xl p-6 border border-dashed border-indigo-200 text-center space-y-3.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-900 flex items-center justify-center mx-auto border border-indigo-100 shadow-2xs">
                  <BookOpen className="w-6 h-6 text-indigo-800" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h4 className="text-xs font-black text-indigo-950">
                    No Bible study groups scheduled to meet today ({todayDayName})
                  </h4>
                  <p className="text-[11px] text-charcoal/60">
                    You have {bibleStudyGroups.length} registered small groups meeting across the week (Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday).
                  </p>
                </div>
                <button
                  onClick={() => onNavigate("biblestudy")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-950 text-white text-xs font-bold hover:bg-indigo-900 shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span>Browse Full Small Group Schedule</span>
                </button>
              </div>
            )}
          </div>

          {/* ==================================================== */}
          {/* MINISTRIES SECTION: 7 Ministries Grid for Admin, Pastoral Care & Ministry Toolkit for Coordinator */}
          {/* ==================================================== */}
          {isCoordinator ? (
            /* COORDINATOR ALTERNATE VIEW: Ministry Pastoral Care & Spiritual Toolkit */
            <div className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-50">
                <div className="flex items-center gap-3.5">
                  <div 
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md font-black text-lg shrink-0"
                    style={{ backgroundColor: activeMinistry?.color || "#2C3968" }}
                  >
                    <Heart className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-black text-indigo-950">
                        {activeMinistry ? `${activeMinistry.name} Ministry Oversight` : `${coordinatorMinistryName} Ministry Oversight`}
                      </h2>
                      <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-400 text-indigo-950 shadow-2xs">
                        {activeMinistry?.min_age ? `${activeMinistry.min_age}-${activeMinistry.max_age || '+'} yrs` : "Designated"}
                      </span>
                    </div>
                    <p className="text-xs text-charcoal/60">
                      Discipleship pathway, monthly scripture theme, and pastoral care tools
                    </p>
                  </div>
                </div>

                <span className="text-xs font-bold text-indigo-950 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-200/80 self-start sm:self-auto">
                  Coordinator Command Hub
                </span>
              </div>

              {/* 2-Column Content: Scripture & Discipleship Pathway + Action Toolkit */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-1">
                {/* Left (7 cols): Ministry Vision & Scripture Theme of the Month */}
                <div className="lg:col-span-7 p-5 rounded-2xl bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800 text-white space-y-3.5 shadow-md border border-indigo-700/60 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black tracking-widest text-amber-300">
                        Monthly Ministry Focus
                      </span>
                      <span className="text-[10px] text-indigo-200 font-serif italic">
                        Colossians 3:16
                      </span>
                    </div>
                    <blockquote className="text-xs italic text-indigo-100/90 leading-relaxed pl-3 border-l-2 border-amber-400">
                      "Let the message of Christ dwell among you richly as you teach and admonish one another with all wisdom through psalms, hymns, and songs from the Spirit."
                    </blockquote>
                  </div>

                  <div className="pt-2.5 border-t border-indigo-700/60 flex items-center justify-between text-xs text-indigo-200">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>LifeGroup Discipleship & Biblical Stewardship</span>
                    </span>
                    <button
                      onClick={() => onNavigate("curriculum")}
                      className="text-amber-300 hover:text-amber-200 font-black text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <span>Study Topics</span> <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Right (5 cols): Coordinator Action Toolkit */}
                <div className="lg:col-span-5 p-4 rounded-2xl bg-ivory-light/80 border border-indigo-100/80 space-y-2.5 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider mb-0.5">
                      🛠️ Ministry Action Toolkit
                    </h4>
                    <p className="text-[11px] text-charcoal/60">Direct tools to shepherd this age bracket</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onNavigate("communications")}
                      className="p-2.5 rounded-xl bg-white hover:bg-amber-50 border border-indigo-100 hover:border-amber-300 text-charcoal hover:text-indigo-950 transition-all text-xs font-bold text-left flex items-center gap-2 cursor-pointer shadow-2xs"
                    >
                      <MessageSquare className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="truncate">Post Notice</span>
                    </button>

                    <button
                      onClick={() => onNavigate("curriculum")}
                      className="p-2.5 rounded-xl bg-white hover:bg-indigo-50 border border-indigo-100 hover:border-indigo-300 text-charcoal hover:text-indigo-950 transition-all text-xs font-bold text-left flex items-center gap-2 cursor-pointer shadow-2xs"
                    >
                      <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="truncate">Curriculum</span>
                    </button>

                    <button
                      onClick={() => onNavigate("events")}
                      className="p-2.5 rounded-xl bg-white hover:bg-emerald-50 border border-indigo-100 hover:border-emerald-300 text-charcoal hover:text-indigo-950 transition-all text-xs font-bold text-left flex items-center gap-2 cursor-pointer shadow-2xs"
                    >
                      <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="truncate">Add Event</span>
                    </button>

                    <button
                      onClick={() => onNavigate("members")}
                      className="p-2.5 rounded-xl bg-white hover:bg-rose-50 border border-indigo-100 hover:border-rose-300 text-charcoal hover:text-indigo-950 transition-all text-xs font-bold text-left flex items-center gap-2 cursor-pointer shadow-2xs"
                    >
                      <Users className="w-4 h-4 text-rose-600 shrink-0" />
                      <span className="truncate">Disciples</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* If there are aging-out members in coordinator's ministry, show promotion transition alert */}
              {agingOutMembers.length > 0 && (
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-300 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>{agingOutMembers.length} member(s)</strong> are approaching the upper age limit of this ministry.
                    </span>
                  </div>
                  <button
                    onClick={() => onNavigate("members")}
                    className="text-amber-900 font-black hover:underline shrink-0 cursor-pointer"
                  >
                    Review Transitions →
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ADMIN VIEW: Complete 7 Ministries Overview Grid */
            <div className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-indigo-950 flex items-center gap-2">
                    <span>7 Ministries Directory & Status</span>
                    <span className="text-xs font-medium text-charcoal/50">(Age-Bracketed Discipleship)</span>
                  </h2>
                  <p className="text-xs text-charcoal/60 mt-0.5">Live headcount, age rules, and active membership breakdown</p>
                </div>
                <button
                  onClick={() => onNavigate("members")}
                  className="text-xs font-black text-indigo-950 hover:text-amber-600 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>View All Members</span> <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {ministries.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => onNavigate("members")}
                    className="group p-4 rounded-2xl border border-indigo-100/80 hover:border-amber-400 bg-ivory-light/40 hover:bg-white transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full shadow-inner ring-2 ring-white"
                          style={{ backgroundColor: m.color }}
                        />
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-white text-indigo-950 border border-indigo-100 shadow-2xs">
                          {m.min_age ? `${m.min_age}-${m.max_age || '+'} yrs` : 'All ages'}
                        </span>
                      </div>
                      <h3 className="font-black text-sm text-indigo-950 group-hover:text-amber-600 transition-colors">{m.name}</h3>
                      <p className="text-[11px] text-charcoal/60 line-clamp-2 mt-1 leading-snug">
                        {m.description}
                      </p>
                    </div>

                    <div className="mt-3.5 pt-2.5 border-t border-indigo-50 flex items-center justify-between text-xs">
                      <span className="text-charcoal/60 font-medium">Members:</span>
                      <span className="font-black text-indigo-950 bg-indigo-50 group-hover:bg-amber-100 px-2.5 py-0.5 rounded-full transition-colors">
                        {m.active_members_count ?? 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Side-by-Side: Announcements & Upcoming Events */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Recent Announcements */}
            <div className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-indigo-50 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200/60 shadow-2xs">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-indigo-950">Recent Announcements</h3>
                      <p className="text-[11px] text-charcoal/50">Church-wide & ministry updates</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate("communications")}
                    className="text-xs font-black text-indigo-950 hover:text-amber-600 transition-colors cursor-pointer"
                  >
                    View Board
                  </button>
                </div>

                <div className="space-y-3">
                  {announcements.map((a) => (
                    <div key={a.id} className="p-3.5 rounded-2xl bg-ivory-light/70 border border-indigo-100/70 hover:border-amber-300 transition-all">
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <span className="text-xs font-black text-indigo-950 truncate">{a.title}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-900 border border-indigo-100 shrink-0">
                          {a.ministry_name || "Church-Wide"}
                        </span>
                      </div>
                      <p className="text-xs text-charcoal/70 line-clamp-2 leading-relaxed">
                        {a.body}
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-indigo-50/60 text-[10px] text-charcoal/50 flex items-center justify-between">
                        <span>By {a.author_name} ({a.author_role})</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-charcoal/40" />
                          <span>{new Date(a.created_at).toLocaleDateString()}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Upcoming Services & Events */}
            <div className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-indigo-50 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-2xs">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-indigo-950">Upcoming Events</h3>
                      <p className="text-[11px] text-charcoal/50">Services & fellowships</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate("events")}
                    className="text-xs font-black text-indigo-950 hover:text-amber-600 transition-colors cursor-pointer"
                  >
                    Calendar
                  </button>
                </div>

                <div className="space-y-3">
                  {upcomingEvents.map((evt) => (
                    <div key={evt.id} className="p-3.5 rounded-2xl bg-ivory-light/70 border border-indigo-100/70 hover:border-emerald-300 transition-all flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-xs font-black text-indigo-950">{evt.title}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200">
                            {evt.ministry_name || "All Church"}
                          </span>
                        </div>
                        <p className="text-xs text-charcoal/70 line-clamp-1">{evt.description}</p>
                        <div className="mt-2 text-[10px] text-charcoal/50 flex items-center gap-2 flex-wrap">
                          <span>📍 {evt.location || "Sanctuary"}</span>
                          <span>•</span>
                          <span>🕒 {new Date(evt.start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-indigo-950 bg-white border border-indigo-100 shadow-2xs px-3 py-1 rounded-xl block">
                          {evt.rsvp_count || 0} RSVPs
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* RIGHT SIDEBAR PANEL: DUTIES, BIRTHDAYS & SHORTCUTS (4 of 12 columns) */}
        {/* ==================================================== */}
        <div className="lg:col-span-4 space-y-5">

          {/* Service & Fellowship Turns (Admin only; hidden from Coordinators) */}
          {!isCoordinator && (
            <>
              {/* Section Heading */}
              <div className="flex items-center justify-between pb-1.5 border-b border-indigo-100">
                <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Service & Fellowship Turns</span>
                </h3>
                <span className="text-[10px] font-black text-indigo-900 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">Live Roster</span>
              </div>

              {/* WIDGET 1: Saturday Sanctuary & Facility Duty */}
              <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white rounded-3xl p-5 border border-amber-200/90 shadow-sm space-y-4 hover:border-amber-300 transition-all">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-amber-400 text-indigo-950 shadow-2xs">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-black text-indigo-950">Saturday Duty Roster</h4>
                      <span className="text-[10px] text-charcoal/60">Sanctuary & Facility Cleaning</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                    {thisSaturdayDuty ? thisSaturdayDuty.date_formatted || thisSaturdayDuty.duty_date : "This Sat"}
                  </span>
                </div>

                {thisSaturdayDuty?.team ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white/95 rounded-2xl border border-amber-200/60 shadow-2xs">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-inner ring-2 ring-white"
                          style={{ backgroundColor: thisSaturdayDuty.team.color || "#2C3968" }}
                        />
                        <span className="text-sm font-black text-indigo-950">{thisSaturdayDuty.team.name}</span>
                      </div>
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300">
                        {thisSaturdayDuty.status === "completed" ? "✓ Done" : "On Duty"}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-charcoal/80 px-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-charcoal/60">Leader:</span>
                        <strong className="text-indigo-950">{thisSaturdayDuty.team.leader_name || "Assigned Leader"}</strong>
                      </div>
                      {thisSaturdayDuty.team.leader_phone && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-charcoal/60">Contact:</span>
                          <span className="text-charcoal/70 font-mono text-[10px]">{thisSaturdayDuty.team.leader_phone}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-charcoal/60">Enrolled Volunteers:</span>
                        <strong className="text-indigo-950">{thisSaturdayDuty.team.members_count || thisSaturdayDuty.team.members?.length || 0} members</strong>
                      </div>
                    </div>

                    {nextSaturdayDuty?.team && (
                      <div className="text-[10px] text-charcoal/60 pt-2 border-t border-amber-200/60 flex items-center justify-between">
                        <span>Next ({nextSaturdayDuty.date_formatted}):</span>
                        <strong className="text-indigo-950">{nextSaturdayDuty.team.name}</strong>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-charcoal/50 italic text-center py-2">No Saturday duty team scheduled.</p>
                )}

                <button
                  onClick={() => onNavigate("duty")}
                  className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black text-xs py-2.5 px-3 rounded-2xl shadow-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <span>Open Saturday Duty Roster</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* WIDGET 2: Sunday Fellowship Meal Dishwashing Duty */}
              <div className="bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-white rounded-3xl p-5 border border-indigo-200/90 shadow-sm space-y-4 hover:border-indigo-300 transition-all">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-indigo-950 text-white shadow-2xs">
                      <Utensils className="w-4 h-4 text-amber-300" />
                    </span>
                    <div>
                      <h4 className="text-xs font-black text-indigo-950">Sunday Dishwashing</h4>
                      <span className="text-[10px] text-charcoal/60">Fellowship Meal Rotation</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-950 border border-indigo-300">
                    {thisSundayDishwashing ? new Date(thisSundayDishwashing.duty_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "This Sun"}
                  </span>
                </div>

                {thisSundayDishwashing ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-white/95 rounded-2xl border border-indigo-200/60 shadow-2xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-charcoal/50 uppercase">Assigned Group</span>
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-900 border border-indigo-200">
                          {thisSundayDishwashing.status === "completed" ? "✓ Done" : "This Sunday"}
                        </span>
                      </div>
                      <h5 className="text-sm font-black text-indigo-950 leading-tight">{thisSundayDishwashing.assigned_name}</h5>
                      {thisSundayDishwashing.partner_assigned_name && (
                        <p className="text-[11px] font-bold text-amber-800">
                          + Teamed Up: {thisSundayDishwashing.partner_assigned_name}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5 text-xs text-charcoal/80 px-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-charcoal/60">In-Charge:</span>
                        <strong className="text-indigo-950 truncate max-w-[150px]">{thisSundayDishwashing.leader_name || "Leader / Coordinator"}</strong>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-charcoal/60">Cycle Mode:</span>
                        <strong className="text-indigo-950 capitalize text-[10px]">{thisSundayDishwashing.cycle_mode === "biblestudy_group" ? "Bible Study Groups" : "Ministries"}</strong>
                      </div>
                    </div>

                    {nextSundayDishwashing && (
                      <div className="text-[10px] text-charcoal/60 pt-2 border-t border-indigo-100 flex items-center justify-between">
                        <span>Next Sun:</span>
                        <strong className="text-indigo-950 truncate max-w-[150px]">{nextSundayDishwashing.assigned_name}</strong>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-charcoal/50 italic text-center py-2">No dishwashing turn scheduled.</p>
                )}

                <button
                  onClick={() => onNavigate("dishwashing")}
                  className="w-full bg-indigo-950 hover:bg-indigo-900 text-white font-black text-xs py-2.5 px-3 rounded-2xl shadow-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <span>Open Dishwashing Roster</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}

          {/* Coordinator Scoped Ministry Summary Card (Shown when Coordinator logs in) */}
          {isCoordinator && activeMinistry && (
            <div className="bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800 text-white rounded-3xl p-6 shadow-md space-y-4 border border-indigo-700/60">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-indigo-950 px-3 py-1 rounded-full shadow-2xs">
                  Designated Ministry
                </span>
                <span className="text-xs font-semibold text-indigo-200">
                  {activeMinistry.min_age ? `${activeMinistry.min_age}-${activeMinistry.max_age || '+'} yrs` : "All Ages"}
                </span>
              </div>

              <div>
                <h4 className="text-lg font-black tracking-tight">{activeMinistry.name} Ministry</h4>
                <p className="text-xs text-indigo-200/80 mt-1 line-clamp-2 leading-relaxed">{activeMinistry.description}</p>
              </div>

              <div className="p-3.5 bg-white/10 rounded-2xl border border-white/10 flex items-center justify-between text-xs backdrop-blur-xs">
                <span>Active Disciples:</span>
                <strong className="text-base text-amber-300 font-black">{scopedMemberCount} Members</strong>
              </div>

              <button
                onClick={() => onNavigate("members")}
                className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black text-xs py-2.5 px-3 rounded-2xl shadow-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <span>Manage {activeMinistry.name} Members</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* WIDGET 3: Birthday Celebrations */}
          <div className="bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-indigo-500/10 rounded-3xl p-5 border border-amber-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-2xs shrink-0">
                  <PartyPopper className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-indigo-950">Birthday Celebrants</h4>
                  <span className="text-[10px] text-charcoal/60">{birthdaySummary?.counts.this_month || 0} this month</span>
                </div>
              </div>
              <button
                onClick={() => onNavigate("members")}
                className="text-[10px] font-black text-indigo-950 hover:text-amber-600 bg-white px-2.5 py-1 rounded-xl border border-indigo-100 shadow-2xs cursor-pointer transition-colors"
              >
                View All
              </button>
            </div>

            {birthdaySummary?.celebrants && birthdaySummary.celebrants.length > 0 ? (
              <div className="space-y-2.5">
                {birthdaySummary.celebrants.slice(0, 3).map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-2xl bg-white border border-indigo-50 shadow-2xs flex items-center justify-between gap-2.5 hover:border-amber-300 transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-white shrink-0 shadow-2xs ring-2 ring-white"
                        style={{ backgroundColor: c.ministry_color || "#2C3968" }}
                      >
                        {c.first_name[0]}{c.last_name[0]}
                      </div>
                      <div className="min-w-0">
                        <h5 className="font-black text-xs text-indigo-950 truncate">{c.first_name} {c.last_name}</h5>
                        <p className="text-[10px] text-charcoal/50">Turning {c.turning_age} • {c.birth_month_name} {c.birth_day}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenGreeting(c)}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-xl text-[10px] font-black shrink-0 transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                      title="Send Birthday Blessing"
                    >
                      <Gift className="w-3 h-3 text-amber-600" />
                      <span>Bless</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-charcoal/50 italic text-center py-2">No upcoming birthdays.</p>
            )}
          </div>

          {/* WIDGET 4: Quick Operational Shortcuts */}
          <div className="bg-white/95 rounded-3xl p-5 border border-indigo-100/90 shadow-sm space-y-3">
            <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider">⚡ Quick Action Hub</h4>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => onNavigate("attendance")}
                className="p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-200 text-left transition-all text-xs font-black flex flex-col justify-between cursor-pointer active:scale-95 shadow-2xs"
              >
                <UserCheck className="w-4 h-4 text-emerald-700 mb-1.5" />
                <span>Live Check-in</span>
              </button>
              <button
                onClick={() => onNavigate("biblestudy")}
                className="p-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200 text-left transition-all text-xs font-black flex flex-col justify-between cursor-pointer active:scale-95 shadow-2xs"
              >
                <BookOpen className="w-4 h-4 text-indigo-700 mb-1.5" />
                <span>Small Groups</span>
              </button>
              <button
                onClick={() => onNavigate("communications")}
                className="p-3 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 text-left transition-all text-xs font-black flex flex-col justify-between cursor-pointer active:scale-95 shadow-2xs"
              >
                <MessageSquare className="w-4 h-4 text-amber-700 mb-1.5" />
                <span>Prayer Board</span>
              </button>
              <button
                onClick={() => onNavigate(isCoordinator ? "members" : "users")}
                className="p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 text-charcoal border border-gray-200 text-left transition-all text-xs font-black flex flex-col justify-between cursor-pointer active:scale-95 shadow-2xs"
              >
                <ShieldCheck className="w-4 h-4 text-indigo-900 mb-1.5" />
                <span>{isCoordinator ? "Directory" : "User Roles"}</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Birthday Greeting Modal */}
      {greetingMember && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-indigo-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-100 text-amber-700">
                  <Cake className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-base text-charcoal">Send Birthday Blessing</h3>
                  <p className="text-xs text-charcoal/50">
                    To {greetingMember.first_name} {greetingMember.last_name} (Turning {greetingMember.turning_age})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setGreetingMember(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-charcoal/50 hover:text-charcoal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {greetingSuccess ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-sage-100 text-sage-700 mx-auto flex items-center justify-center">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-charcoal text-base">Birthday Blessing Posted!</h4>
                <p className="text-xs text-charcoal/60">
                  A celebratory blessing has been published to the church announcement board.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-charcoal mb-1.5">
                    Pastoral Message & Scripture Blessing
                  </label>
                  <textarea
                    rows={4}
                    value={greetingMessage}
                    onChange={(e) => setGreetingMessage(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                    placeholder="Write a warm birthday prayer or blessing..."
                  />
                </div>

                {/* Quick Scripture Presets */}
                <div>
                  <span className="text-[11px] font-semibold text-charcoal/60 block mb-1.5">
                    Insert Scripture Verse:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      {
                        label: "Numbers 6:24-25 (Blessing)",
                        verse: `"The Lord bless you and keep you; the Lord make His face shine upon you and be gracious to you!" (Numbers 6:24-25)`
                      },
                      {
                        label: "Jeremiah 29:11 (Hope & Future)",
                        verse: `"For I know the plans I have for you, declares the Lord, plans to give you a future and a hope." (Jeremiah 29:11)`
                      },
                      {
                        label: "Psalm 20:4 (Desires of Heart)",
                        verse: `"May He grant you your heart's desire and fulfill all your plans!" (Psalm 20:4)`
                      },
                      {
                        label: "Psalm 118:24 (Rejoice)",
                        verse: `"This is the day that the Lord has made; let us rejoice and be glad in it!" (Psalm 118:24)`
                      }
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setGreetingMessage(
                            `Happy ${greetingMember.turning_age}th Birthday, ${greetingMember.first_name}! 🎂 ${item.verse} Praying God's richest blessings over your life!`
                          );
                        }}
                        className="text-[10px] font-medium bg-indigo-50 text-indigo hover:bg-indigo-100 px-2 py-1 rounded-md border border-indigo-100 transition-colors"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setGreetingMember(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-charcoal/70 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendGreeting}
                    disabled={sendingGreeting || !greetingMessage.trim()}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition-all disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{sendingGreeting ? "Posting..." : "Publish Blessing"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
